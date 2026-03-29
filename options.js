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

// Sync DOM references
const syncStatusEl = document.getElementById('sync-status');
const syncLabel = document.getElementById('sync-label');
const supabaseUrlInput = document.getElementById('supabase-url');
const supabaseKeyInput = document.getElementById('supabase-key');
const syncNowBtn = document.getElementById('btn-sync-now');

let currentSettings = {};

// --- Initialize ---
async function init() {
  currentSettings = await storage.getAll();

  geminiKey.value = currentSettings.gemini_api_key;
  openrouterKey.value = currentSettings.openrouter_api_key;
  ollamaUrl.value = currentSettings.ollama_base_url;
  panelPosition.value = currentSettings.panel_position;
  themeSelect.value = currentSettings.theme || 'light';

  loadAllModels();
  renderCoachList();
  loadProfile();

  // Personalization + Memory toggles
  const persOn = currentSettings.personalization_enabled === true;
  const memOn = currentSettings.memory_enabled === true;
  const cloudOn = currentSettings.cloud_sync_enabled === true;
  togglePersonalization.checked = persOn;
  toggleMemory.checked = memOn;
  if (cloudOn) {
    document.querySelector('input[name="memory-storage"][value="cloud"]').checked = true;
  }
  const storageType = cloudOn ? 'cloud' : 'local';
  updatePersonalizationUI(persOn, memOn, storageType);

  if (memOn) renderInsights();

  loadSyncStatus();
  loadSyncConfig();
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
defaultModelSelect.addEventListener('change', () => save({ default_model: defaultModelSelect.value }));
panelPosition.addEventListener('change', () => save({ panel_position: panelPosition.value }));
themeSelect.addEventListener('change', () => save({ theme: themeSelect.value }));

// --- Personalization & Memory Toggles ---
const togglePersonalization = document.getElementById('toggle-personalization');
const toggleMemory = document.getElementById('toggle-memory');
const memorySection = document.getElementById('memory-section');
const memoryStorageOptions = document.getElementById('memory-storage-options');
const profileSection = document.getElementById('profile-section');
const supabaseFieldsSection = document.getElementById('supabase-fields');
const insightsSection = document.getElementById('insights-section');
const memoryStorageRadios = document.querySelectorAll('input[name="memory-storage"]');

function updatePersonalizationUI(persOn, memOn, storageType) {
  memorySection.classList.toggle('hidden', !persOn);
  profileSection.classList.toggle('hidden', !persOn);
  memoryStorageOptions.classList.toggle('hidden', !memOn);
  supabaseFieldsSection.classList.toggle('hidden', storageType !== 'cloud');
  insightsSection.style.display = memOn ? '' : 'none';
}

togglePersonalization.addEventListener('change', () => {
  const on = togglePersonalization.checked;
  save({ personalization_enabled: on });
  if (!on) {
    toggleMemory.checked = false;
    save({ memory_enabled: false, cloud_sync_enabled: false });
  }
  const storageType = document.querySelector('input[name="memory-storage"]:checked')?.value || 'local';
  updatePersonalizationUI(on, toggleMemory.checked, storageType);
});

toggleMemory.addEventListener('change', () => {
  const on = toggleMemory.checked;
  save({ memory_enabled: on });
  if (!on) {
    document.querySelector('input[name="memory-storage"][value="local"]').checked = true;
    save({ cloud_sync_enabled: false });
  }
  const storageType = document.querySelector('input[name="memory-storage"]:checked')?.value || 'local';
  updatePersonalizationUI(togglePersonalization.checked, on, storageType);
});

memoryStorageRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    const isCloud = radio.value === 'cloud';
    save({ cloud_sync_enabled: isCloud });
    supabaseFieldsSection.classList.toggle('hidden', !isCloud);
    if (isCloud) loadSyncStatus();
  });
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

// --- Sync ---

async function loadSyncConfig() {
  const data = await chrome.storage.sync.get({
    supabase_config: { url: '', anon_key: '' }
  });
  supabaseUrlInput.value = data.supabase_config.url || '';
  supabaseKeyInput.value = data.supabase_config.anon_key || '';
}

function saveSyncConfig() {
  chrome.storage.sync.set({
    supabase_config: {
      url: supabaseUrlInput.value.replace(/\/$/, ''),
      anon_key: supabaseKeyInput.value
    }
  });
  loadSyncStatus();
  showStatus();
}

supabaseUrlInput.addEventListener('change', saveSyncConfig);
supabaseKeyInput.addEventListener('change', saveSyncConfig);

async function loadSyncStatus() {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'sync-status' });
    const dot = syncStatusEl.querySelector('.dot');

    if (result.status === 'ready') {
      dot.className = 'dot green';
      syncLabel.textContent = 'Connected';
      syncNowBtn.disabled = false;
    } else {
      dot.className = 'dot gray';
      syncLabel.textContent = 'Not configured';
      syncNowBtn.disabled = true;
    }
  } catch {
    syncNowBtn.disabled = true;
  }
}

syncNowBtn.addEventListener('click', async () => {
  syncNowBtn.disabled = true;
  syncNowBtn.textContent = 'Syncing...';

  try {
    const result = await chrome.runtime.sendMessage({ type: 'sync-now' });
    if (result.error) throw new Error(result.error);
    renderInsights();
    loadProfile();
    showStatus();
  } catch (err) {
    alert(`Sync failed: ${err.message}`);
  } finally {
    syncNowBtn.disabled = false;
    syncNowBtn.textContent = 'Sync Now';
  }
});

// --- Init ---
init();
