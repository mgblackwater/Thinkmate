// options.js
// Thinkmate options page logic

import * as storage from './core/storage.js';
import * as memory from './core/memory.js';
import coaches from './coaches/index.js';

// --- DOM References ---
const geminiKey = document.getElementById('gemini-key');
const openrouterKey = document.getElementById('openrouter-key');
const ollamaUrl = document.getElementById('ollama-url');
const defaultModelSelect = document.getElementById('default-model');
const panelPosition = document.getElementById('panel-position');
const themeSelect = document.getElementById('theme');
const coachList = document.getElementById('coach-list');
const statusMsg = document.getElementById('status-msg');

// Profile fields
const profileFields = {
  name: document.getElementById('profile-name'),
  nationality: document.getElementById('profile-nationality'),
  native_language: document.getElementById('profile-language'),
  profession: document.getElementById('profile-profession'),
  seniority: document.getElementById('profile-seniority'),
  goals: document.getElementById('profile-goals'),
  work_context: document.getElementById('profile-work'),
  communication_style: document.getElementById('profile-style')
};


let currentSettings = {};

// --- Initialize ---
async function init() {
  currentSettings = await storage.getAll();

  geminiKey.value = currentSettings.gemini_api_key;
  openrouterKey.value = currentSettings.openrouter_api_key;
  groqKey.value = currentSettings.groq_api_key;
  ollamaUrl.value = currentSettings.ollama_base_url;
  panelPosition.value = currentSettings.panel_position;
  themeSelect.value = currentSettings.theme || 'light';

  loadAllModels();
  renderCoachList();
  populateQuickCorrectCoaches();
  loadProfile();

  // Personalization toggle
  const persOn = currentSettings.personalization_enabled === true;
  togglePersonalization.checked = persOn;
  profileSection.classList.toggle('hidden', !persOn);
}

// --- Profile ---
async function loadProfile() {
  const profile = await memory.getProfile();
  for (const [key, el] of Object.entries(profileFields)) {
    if (el) el.value = profile[key] || '';
  }
}

function saveProfile() {
  const profile = {};
  for (const [key, el] of Object.entries(profileFields)) {
    if (el) profile[key] = el.value;
  }
  memory.setProfile(profile);
  showStatus();
}

// Auto-save profile on change
for (const el of Object.values(profileFields)) {
  if (el) el.addEventListener('change', saveProfile);
}

// --- Model Loading (unified across all providers) ---
const providerStatusEl = document.getElementById('provider-status');
let allModels = [];

function showProviderStatus(type, message) {
  providerStatusEl.style.display = 'block';
  providerStatusEl.style.background = type === 'success' ? '#f0fff4' : type === 'error' ? '#fff5f5' : '#ebf8ff';
  providerStatusEl.style.border = type === 'success' ? '1px solid #c6f6d5' : type === 'error' ? '1px solid #fed7d7' : '1px solid #bee3f8';
  providerStatusEl.style.color = type === 'success' ? '#276749' : type === 'error' ? '#c53030' : '#2b6cb0';
  providerStatusEl.textContent = message;
}

async function loadAllModels() {
  providerStatusEl.style.display = 'none';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'fetch-models', provider: 'all' });
    if (response.error) throw new Error(response.error);
    allModels = response.models || [];

    populateUnifiedSelect(defaultModelSelect, allModels, currentSettings.default_model);
    updateCoachModelDropdowns();

    if (allModels.length > 0) {
      const providers = [...new Set(allModels.map(m => m.providerName))];
      showProviderStatus('success', `${allModels.length} models from ${providers.join(', ')}`);
    } else {
      showProviderStatus('error', 'No providers configured. Add an API key above.');
    }
  } catch (err) {
    showProviderStatus('error', `Failed to load models: ${err.message || err}`);
  }
}

function populateUnifiedSelect(select, models, currentValue) {
  select.innerHTML = '';
  if (models.length === 0) {
    select.innerHTML = '<option value="">No models available</option>';
    return;
  }

  // Group by provider
  const grouped = {};
  models.forEach(m => {
    if (!grouped[m.providerName]) grouped[m.providerName] = [];
    grouped[m.providerName].push(m);
  });

  for (const [providerName, providerModels] of Object.entries(grouped)) {
    const group = document.createElement('optgroup');
    group.label = providerName;
    providerModels.forEach(m => {
      const option = document.createElement('option');
      option.value = `${m.provider}:${m.id}`;
      option.textContent = m.pricing ? `${m.name} (${m.pricing})` : m.name;
      if (`${m.provider}:${m.id}` === currentValue) option.selected = true;
      group.appendChild(option);
    });
    select.appendChild(group);
  }
}

function updateCoachModelDropdowns() {
  document.querySelectorAll('[data-coach-setting$=":model_override"]').forEach(select => {
    const currentVal = select.value;
    select.innerHTML = '<option value="">Use default model</option>';
    populateUnifiedOptions(select, allModels, currentVal);
  });
}

function populateUnifiedOptions(select, models, currentValue) {
  const grouped = {};
  models.forEach(m => {
    if (!grouped[m.providerName]) grouped[m.providerName] = [];
    grouped[m.providerName].push(m);
  });

  for (const [providerName, providerModels] of Object.entries(grouped)) {
    const group = document.createElement('optgroup');
    group.label = providerName;
    providerModels.forEach(m => {
      const option = document.createElement('option');
      option.value = `${m.provider}:${m.id}`;
      option.textContent = m.name;
      if (`${m.provider}:${m.id}` === currentValue) option.selected = true;
      group.appendChild(option);
    });
    select.appendChild(group);
  }
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

geminiKey.addEventListener('change', () => {
  save({ gemini_api_key: geminiKey.value });
  loadAllModels();
});
openrouterKey.addEventListener('change', () => {
  save({ openrouter_api_key: openrouterKey.value });
  storage.setLocal({ openrouter_models_cache: null, openrouter_models_cache_time: 0 });
  loadAllModels();
});
ollamaUrl.addEventListener('change', () => {
  save({ ollama_base_url: ollamaUrl.value });
  loadAllModels();
});
const groqKey = document.getElementById('groq-key');
groqKey.addEventListener('change', () => {
  save({ groq_api_key: groqKey.value });
  loadAllModels();
});
defaultModelSelect.addEventListener('change', () => save({ default_model: defaultModelSelect.value }));
panelPosition.addEventListener('change', () => save({ panel_position: panelPosition.value }));
themeSelect.addEventListener('change', () => save({ theme: themeSelect.value }));

// Quick Correct Coach dropdown
const quickCorrectSelect = document.getElementById('quick-correct-coach');
function populateQuickCorrectCoaches() {
  quickCorrectSelect.innerHTML = '';
  coaches.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = `${c.icon} ${c.name}`;
    if (c.id === currentSettings.quick_correct_coach) option.selected = true;
    quickCorrectSelect.appendChild(option);
  });
}
quickCorrectSelect.addEventListener('change', () => save({ quick_correct_coach: quickCorrectSelect.value }));

// --- Personalization Toggle ---
const togglePersonalization = document.getElementById('toggle-personalization');
const profileSection = document.getElementById('profile-section');

togglePersonalization.addEventListener('change', () => {
  const on = togglePersonalization.checked;
  save({ personalization_enabled: on });
  profileSection.classList.toggle('hidden', !on);
});

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

    // Always show settings (at minimum: model override)
    const settingsDiv = document.createElement('div');
    settingsDiv.className = `coach-settings ${enabled ? 'visible' : ''}`;
    settingsDiv.dataset.coachSettings = coach.id;

    // Model override dropdown
    const modelOverride = currentSettings.coach_settings[coach.id]?.model_override || '';
    const modelField = document.createElement('div');
    modelField.className = 'field';
    modelField.innerHTML = `
      <label>Model Override</label>
      <select data-coach-setting="${coach.id}:model_override" style="font-size:12px;">
        <option value="" ${!modelOverride ? 'selected' : ''}>Use default model</option>
      </select>
      <div style="font-size:11px; color:#a0aec0; margin-top:4px;">Leave as default to use the provider's model, or select a specific model for this coach.</div>
    `;
    settingsDiv.appendChild(modelField);

    // Coach-specific settings
    if (coach.settings && Object.keys(coach.settings).length > 0) {
      Object.entries(coach.settings).forEach(([key, config]) => {
        // Check showWhen condition
        if (config.showWhen) {
          const [depKey, depVal] = Object.entries(config.showWhen)[0];
          const depCurrent = currentSettings.coach_settings[coach.id]?.[depKey] ?? coach.settings[depKey]?.default;
          if (depCurrent !== depVal) return;
        }

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
            <input type="text" data-coach-setting="${coach.id}:${key}" value="${currentVal || ''}" placeholder="${config.placeholder || ''}">
          `;
        }

        settingsDiv.appendChild(field);
      });
    }

    item.appendChild(settingsDiv);

    coachList.appendChild(item);
  });

  coachList.addEventListener('change', (e) => {
    const toggleId = e.target.dataset.coachToggle;
    if (toggleId) {
      storage.setCoachEnabled(toggleId, e.target.checked);
      currentSettings.coaches_enabled[toggleId] = e.target.checked;
      const settingsDiv = coachList.querySelector(`[data-coach-settings="${toggleId}"]`);
      if (settingsDiv) settingsDiv.classList.toggle('visible', e.target.checked);
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

// --- Export / Clear ---
document.getElementById('btn-export').addEventListener('click', async () => {
  const data = await memory.exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thinkmate-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-clear').addEventListener('click', async () => {
  if (confirm('Clear all settings and profile? This cannot be undone.')) {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
    location.reload();
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


// --- Shortcuts link ---
document.getElementById('shortcuts-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// --- Init ---
init();
