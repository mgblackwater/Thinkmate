// background.js
// Thinkmate service worker — handles API calls and message routing

import { callProvider, fetchModels } from './core/api.js';
import * as storage from './core/storage.js';
import * as sync from './core/sync.js';

// Handle messages from content script and options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(err => {
    sendResponse({ error: err.message });
  });
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'analyze':
      return handleAnalyze(message);
    case 'fetch-models':
      return handleFetchModels(message);
    case 'check-provider':
      return handleCheckProvider();
    case 'open-options':
      chrome.runtime.openOptionsPage();
      return { ok: true };
    case 'sync-status':
      return sync.getSyncStatus();
    case 'sync-now':
      return handleSyncNow();
    case 'sync-push':
      return handleSyncPush(message);
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

async function handleAnalyze({ systemPrompt, userText, sessionMessages, modelOverride }) {
  const settings = await storage.getAll();

  // Parse provider:model format (e.g. "gemini:gemini-2.0-flash")
  const selected = modelOverride || settings.default_model || '';
  const [provider, ...modelParts] = selected.split(':');
  const model = modelParts.join(':'); // rejoin in case model has colons (e.g. ollama tags)

  if (!provider || !model) throw new Error('NO_MODEL');

  let apiKey, baseUrl;
  switch (provider) {
    case 'gemini':
      apiKey = settings.gemini_api_key;
      if (!apiKey) throw new Error('NO_API_KEY');
      break;
    case 'openrouter':
      apiKey = settings.openrouter_api_key;
      if (!apiKey) throw new Error('NO_API_KEY');
      break;
    case 'groq':
      apiKey = settings.groq_api_key;
      if (!apiKey) throw new Error('NO_API_KEY');
      break;
    case 'ollama':
      baseUrl = settings.ollama_base_url;
      break;
  }

  const result = await callProvider({ provider, apiKey, baseUrl, model, systemPrompt, userText, sessionMessages });
  return result;
}

async function handleFetchModels({ provider }) {
  const settings = await storage.getAll();

  // If no specific provider, fetch from all configured providers
  if (provider === 'all') {
    const allModels = [];

    // Gemini
    if (settings.gemini_api_key) {
      try {
        const models = await fetchModels('gemini', { apiKey: settings.gemini_api_key });
        allModels.push(...models.map(m => ({ ...m, provider: 'gemini', providerName: 'Gemini' })));
      } catch { /* skip */ }
    }

    // Groq
    if (settings.groq_api_key) {
      try {
        const models = await fetchModels('groq', { apiKey: settings.groq_api_key });
        allModels.push(...models.map(m => ({ ...m, provider: 'groq', providerName: 'Groq' })));
      } catch { /* skip */ }
    }

    // OpenRouter
    if (settings.openrouter_api_key) {
      try {
        const cache = await storage.getLocal('openrouter_models_cache');
        const cacheTime = await storage.getLocal('openrouter_models_cache_time', 0);
        let models;
        if (cache && Date.now() - cacheTime < 86400000) {
          models = cache;
        } else {
          models = await fetchModels('openrouter', { apiKey: settings.openrouter_api_key });
          await storage.setLocal({ openrouter_models_cache: models, openrouter_models_cache_time: Date.now() });
        }
        allModels.push(...models.map(m => ({ ...m, provider: 'openrouter', providerName: 'OpenRouter' })));
      } catch { /* skip */ }
    }

    // Ollama
    try {
      const models = await fetchModels('ollama', { baseUrl: settings.ollama_base_url });
      if (models.length > 0) {
        allModels.push(...models.map(m => ({ ...m, provider: 'ollama', providerName: 'Ollama' })));
      }
    } catch { /* skip */ }

    return { models: allModels };
  }

  // Single provider fetch (legacy support)
  let apiKey, baseUrl;
  switch (provider) {
    case 'gemini': apiKey = settings.gemini_api_key; break;
    case 'openrouter':
      apiKey = settings.openrouter_api_key;
      const cache = await storage.getLocal('openrouter_models_cache');
      const cacheTime = await storage.getLocal('openrouter_models_cache_time', 0);
      if (cache && Date.now() - cacheTime < 86400000) return { models: cache };
      break;
    case 'ollama': baseUrl = settings.ollama_base_url; break;
  }

  const models = await fetchModels(provider, { apiKey, baseUrl });
  if (provider === 'openrouter') {
    await storage.setLocal({ openrouter_models_cache: models, openrouter_models_cache_time: Date.now() });
  }
  return { models };
}

async function handleCheckProvider() {
  const settings = await storage.getAll();
  const provider = settings.provider;
  let configured = false;

  switch (provider) {
    case 'gemini':
      configured = !!settings.gemini_api_key;
      break;
    case 'openrouter':
      configured = !!settings.openrouter_api_key;
      break;
    case 'ollama':
      configured = !!settings.ollama_model;
      break;
  }

  return { provider, configured };
}

// --- Sync handlers ---

async function handleSyncNow() {
  const result = await sync.performFullSync();
  return result;
}

async function handleSyncPush({ profile, memory }) {
  const pushed = await sync.syncToRemote(profile, memory);
  return { ok: pushed };
}

// Handle toolbar icon click — send message to active tab to toggle panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' });
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'toggle-panel') {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' });
  } else if (command === 'quick-correct') {
    chrome.tabs.sendMessage(tab.id, { type: 'quick-correct' });
  }
});

// Context menu — "Analyze with Thinkmate"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'thinkmate-analyze',
    title: 'Analyze with Thinkmate',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'thinkmate-analyze' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'analyze-selection',
      text: info.selectionText
    });
  }
});

console.log('Thinkmate background service worker loaded');
