// options.js
// Thinkmate options page logic

import * as storage from './core/storage.js';
import * as memory from './core/memory.js';
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

  providerSelect.value = currentSettings.provider;
  geminiKey.value = currentSettings.gemini_api_key;
  openrouterKey.value = currentSettings.openrouter_api_key;
  ollamaUrl.value = currentSettings.ollama_base_url;
  panelPosition.value = currentSettings.panel_position;
  themeSelect.value = currentSettings.theme || 'light';

  showProviderFields(currentSettings.provider);
  loadModels(currentSettings.provider);
  renderCoachList();
  loadProfile();

  // Memory toggles
  const memOn = currentSettings.memory_enabled === true;
  const cloudOn = currentSettings.cloud_memory_enabled === true;
  toggleMemory.checked = memOn;
  toggleCloud.checked = cloudOn;
  supabaseUrl.value = currentSettings.supabase_url || '';
  supabaseKey.value = currentSettings.supabase_anon_key || '';
  updateMemoryUI(memOn, cloudOn);

  if (memOn) renderInsights();
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
themeSelect.addEventListener('change', () => save({ theme: themeSelect.value }));

// --- Memory & Privacy Toggles ---
const toggleMemory = document.getElementById('toggle-memory');
const toggleCloud = document.getElementById('toggle-cloud');
const cloudSection = document.getElementById('cloud-memory-section');
const supabaseFields = document.getElementById('supabase-fields');
const insightsSection = document.getElementById('insights-section');
const supabaseUrl = document.getElementById('supabase-url');
const supabaseKey = document.getElementById('supabase-key');

function updateMemoryUI(memoryOn, cloudOn) {
  cloudSection.classList.toggle('hidden', !memoryOn);
  insightsSection.style.display = memoryOn ? '' : 'none';
  supabaseFields.classList.toggle('hidden', !cloudOn);
}

toggleMemory.addEventListener('change', () => {
  const on = toggleMemory.checked;
  save({ memory_enabled: on });
  if (!on) {
    toggleCloud.checked = false;
    save({ cloud_memory_enabled: false });
  }
  updateMemoryUI(on, toggleCloud.checked);
});

toggleCloud.addEventListener('change', () => {
  const on = toggleCloud.checked;
  save({ cloud_memory_enabled: on });
  supabaseFields.classList.toggle('hidden', !on);
});

supabaseUrl.addEventListener('change', () => save({ supabase_url: supabaseUrl.value }));
supabaseKey.addEventListener('change', () => save({ supabase_anon_key: supabaseKey.value }));

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

// --- Insights ---
async function renderInsights() {
  const mem = await memory.getMemory();

  // Error patterns
  const errorsContainer = document.getElementById('insights-errors');
  if (mem.error_patterns.length === 0) {
    errorsContainer.innerHTML = '<div class="insight-empty">No patterns learned yet. Start using Thinkmate!</div>';
  } else {
    const sorted = [...mem.error_patterns].sort((a, b) => b.count - a.count);
    errorsContainer.innerHTML = sorted.map((e, i) => `
      <div class="insight-item">
        <span class="category">${e.category}</span>
        <span class="pattern">${escapeHtml(e.pattern)}</span>
        <span class="count">${e.count}x</span>
        <button class="insight-delete" data-delete-pattern="${i}" title="Delete">&times;</button>
      </div>
    `).join('');
  }

  // Strong areas
  const strongContainer = document.getElementById('insights-strong');
  if (mem.strong_areas.length === 0) {
    strongContainer.innerHTML = '<div class="insight-empty">Keep practicing to build strong areas!</div>';
  } else {
    strongContainer.innerHTML = mem.strong_areas.map(s =>
      `<span class="insight-strong">${s.category} (${s.streak} streak)</span>`
    ).join('');
  }

  // Coach usage
  const coachesContainer = document.getElementById('insights-coaches');
  const coachEntries = Object.entries(mem.coach_usage).sort((a, b) => b[1].count - a[1].count);
  if (coachEntries.length === 0) {
    coachesContainer.innerHTML = '<div class="insight-empty">No usage data yet.</div>';
  } else {
    coachesContainer.innerHTML = coachEntries.map(([id, data]) => {
      const coach = coaches.find(c => c.id === id);
      const name = coach ? `${coach.icon} ${coach.name}` : id;
      return `<div class="insight-usage"><span>${name}</span><span>${data.count} sessions</span></div>`;
    }).join('');
  }

  // Site usage
  const sitesContainer = document.getElementById('insights-sites');
  const siteEntries = Object.entries(mem.site_usage).sort((a, b) => b[1] - a[1]);
  if (siteEntries.length === 0) {
    sitesContainer.innerHTML = '<div class="insight-empty">No site data yet.</div>';
  } else {
    sitesContainer.innerHTML = siteEntries.map(([site, count]) =>
      `<div class="insight-usage"><span>${escapeHtml(site)}</span><span>${count} sessions</span></div>`
    ).join('');
  }

  // Delete pattern handler
  errorsContainer.addEventListener('click', async (e) => {
    const idx = e.target.dataset.deletePattern;
    if (idx !== undefined) {
      await memory.deleteErrorPattern(parseInt(idx));
      renderInsights();
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
  if (confirm('Clear all learned memory? This cannot be undone. Your profile will be kept.')) {
    await memory.clearAllMemory();
    renderInsights();
    showStatus();
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Init ---
init();
