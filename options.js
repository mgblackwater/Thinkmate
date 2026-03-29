// options.js
// Thinkmate options page logic

import * as storage from './core/storage.js';
import coaches from './coaches/index.js';

// --- DOM References ---
const providerSelect = document.getElementById('provider');
const geminiFields = document.getElementById('gemini-fields');
const openrouterFields = document.getElementById('openrouter-fields');
const ollamaFields = document.getElementById('ollama-fields');
const geminiKey = document.getElementById('gemini-key');
const geminiModel = document.getElementById('gemini-model');
const openrouterKey = document.getElementById('openrouter-key');
const openrouterModel = document.getElementById('openrouter-model');
const ollamaUrl = document.getElementById('ollama-url');
const ollamaModel = document.getElementById('ollama-model');
const panelPosition = document.getElementById('panel-position');
const coachList = document.getElementById('coach-list');
const statusMsg = document.getElementById('status-msg');

let currentSettings = {};

// --- Initialize ---
async function init() {
  currentSettings = await storage.getAll();

  providerSelect.value = currentSettings.provider;
  geminiKey.value = currentSettings.gemini_api_key;
  openrouterKey.value = currentSettings.openrouter_api_key;
  ollamaUrl.value = currentSettings.ollama_base_url;
  panelPosition.value = currentSettings.panel_position;

  showProviderFields(currentSettings.provider);
  loadModels(currentSettings.provider);
  renderCoachList();
}

// --- Provider Fields ---
function showProviderFields(provider) {
  geminiFields.classList.toggle('hidden', provider !== 'gemini');
  openrouterFields.classList.toggle('hidden', provider !== 'openrouter');
  ollamaFields.classList.toggle('hidden', provider !== 'ollama');
}

providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value;
  showProviderFields(provider);
  save({ provider });
  loadModels(provider);
});

// --- Model Loading ---
async function loadModels(provider) {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'fetch-models', provider });
    if (response.error) throw new Error(response.error);

    const models = response.models || [];

    switch (provider) {
      case 'gemini':
        populateSelect(geminiModel, models, currentSettings.gemini_model);
        break;
      case 'openrouter':
        populateSelect(openrouterModel, models, currentSettings.openrouter_model, m => `${m.name} (${m.pricing || 'Free'})`);
        break;
      case 'ollama':
        populateSelect(ollamaModel, models, currentSettings.ollama_model);
        break;
    }
  } catch (err) {
    console.error('Failed to load models:', err);
  }
}

function populateSelect(select, models, currentValue, labelFn) {
  select.innerHTML = '';
  if (models.length === 0) {
    select.innerHTML = '<option value="">No models available</option>';
    return;
  }
  models.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = labelFn ? labelFn(m) : m.name;
    if (m.id === currentValue) option.selected = true;
    select.appendChild(option);
  });
}

// --- Save Handlers ---
function save(obj) {
  storage.set(obj);
  Object.assign(currentSettings, obj);
  showStatus();
}

function showStatus() {
  statusMsg.classList.add('visible');
  setTimeout(() => statusMsg.classList.remove('visible'), 1500);
}

geminiKey.addEventListener('change', () => save({ gemini_api_key: geminiKey.value }));
geminiModel.addEventListener('change', () => save({ gemini_model: geminiModel.value }));
openrouterKey.addEventListener('change', () => {
  save({ openrouter_api_key: openrouterKey.value });
  // Clear model cache and reload
  storage.setLocal({ openrouter_models_cache: null, openrouter_models_cache_time: 0 });
  loadModels('openrouter');
});
openrouterModel.addEventListener('change', () => save({ openrouter_model: openrouterModel.value }));
ollamaUrl.addEventListener('change', () => {
  save({ ollama_base_url: ollamaUrl.value });
  loadModels('ollama');
});
ollamaModel.addEventListener('change', () => save({ ollama_model: ollamaModel.value }));
panelPosition.addEventListener('change', () => save({ panel_position: panelPosition.value }));

// --- Coach List ---
function renderCoachList() {
  coachList.innerHTML = '';

  coaches.forEach(coach => {
    const enabled = currentSettings.coaches_enabled[coach.id] ?? coach.enabled;

    const item = document.createElement('div');
    item.innerHTML = `
      <div class="coach-item">
        <div class="coach-info">
          <span class="coach-icon">${coach.icon}</span>
          <div>
            <div class="coach-name">${coach.name}</div>
            <div class="coach-desc">${coach.description}</div>
          </div>
        </div>
        <label class="toggle">
          <input type="checkbox" data-coach-toggle="${coach.id}" ${enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;

    // Coach-specific settings
    if (coach.settings && Object.keys(coach.settings).length > 0) {
      const settingsDiv = document.createElement('div');
      settingsDiv.className = `coach-settings ${enabled ? 'visible' : ''}`;
      settingsDiv.dataset.coachSettings = coach.id;

      Object.entries(coach.settings).forEach(([key, config]) => {
        const currentVal = currentSettings.coach_settings[coach.id]?.[key] ?? config.default;
        const field = document.createElement('div');
        field.className = 'field';

        if (config.type === 'select') {
          field.innerHTML = `
            <label>${config.label}</label>
            <select data-coach-setting="${coach.id}:${key}">
              ${config.options.map(opt => `<option value="${opt}" ${opt === currentVal ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          `;
        } else if (config.type === 'text') {
          field.innerHTML = `
            <label>${config.label}</label>
            <input type="text" data-coach-setting="${coach.id}:${key}" value="${currentVal || ''}">
          `;
        }

        settingsDiv.appendChild(field);
      });

      item.appendChild(settingsDiv);
    }

    coachList.appendChild(item);
  });

  // Event listeners for coach toggles
  coachList.addEventListener('change', (e) => {
    const toggleId = e.target.dataset.coachToggle;
    if (toggleId) {
      storage.setCoachEnabled(toggleId, e.target.checked);
      currentSettings.coaches_enabled[toggleId] = e.target.checked;

      // Show/hide coach settings
      const settingsDiv = coachList.querySelector(`[data-coach-settings="${toggleId}"]`);
      if (settingsDiv) {
        settingsDiv.classList.toggle('visible', e.target.checked);
      }
      showStatus();
    }

    const settingKey = e.target.dataset.coachSetting;
    if (settingKey) {
      const [coachId, key] = settingKey.split(':');
      storage.setCoachSetting(coachId, key, e.target.value);
      showStatus();
    }
  });
}

// --- Init ---
init();
