// background.js
// Thinkmate service worker — handles API calls and message routing

import { callProvider, fetchModels } from './core/api.js';
import * as storage from './core/storage.js';

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
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

async function handleAnalyze({ systemPrompt, userText }) {
  const settings = await storage.getAll();
  const provider = settings.provider;

  let apiKey, baseUrl, model;
  switch (provider) {
    case 'gemini':
      apiKey = settings.gemini_api_key;
      model = settings.gemini_model;
      if (!apiKey) throw new Error('NO_API_KEY');
      break;
    case 'openrouter':
      apiKey = settings.openrouter_api_key;
      model = settings.openrouter_model;
      if (!apiKey) throw new Error('NO_API_KEY');
      break;
    case 'ollama':
      baseUrl = settings.ollama_base_url;
      model = settings.ollama_model;
      if (!model) throw new Error('NO_MODEL');
      break;
  }

  const result = await callProvider({ provider, apiKey, baseUrl, model, systemPrompt, userText });
  return result;
}

async function handleFetchModels({ provider }) {
  const settings = await storage.getAll();
  let apiKey, baseUrl;

  switch (provider) {
    case 'openrouter':
      apiKey = settings.openrouter_api_key;
      // Check cache (24 hour TTL)
      if (settings.openrouter_models_cache && Date.now() - settings.openrouter_models_cache_time < 86400000) {
        return { models: settings.openrouter_models_cache };
      }
      break;
    case 'ollama':
      baseUrl = settings.ollama_base_url;
      break;
  }

  const models = await fetchModels(provider, { apiKey, baseUrl });

  // Cache OpenRouter models
  if (provider === 'openrouter') {
    await storage.set({
      openrouter_models_cache: models,
      openrouter_models_cache_time: Date.now()
    });
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

// Handle toolbar icon click — send message to active tab to toggle panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' });
  }
});

console.log('Thinkmate background service worker loaded');
