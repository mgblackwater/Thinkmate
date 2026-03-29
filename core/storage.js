// core/storage.js
// Wrapper around chrome.storage.sync with defaults and typed accessors

const DEFAULTS = {
  provider: 'gemini',
  gemini_api_key: '',
  gemini_model: 'gemini-2.0-flash',
  openrouter_api_key: '',
  openrouter_model: 'meta-llama/llama-3.3-70b-instruct:free',
  ollama_base_url: 'http://localhost:11434',
  ollama_model: '',
  panel_position: 'cursor',
  theme: 'light',
  coaches_enabled: { 'english-coach': true },
  coach_settings: {
    'english-coach': {
      ielts_target: '8.0',
      english_variant: 'American'
    }
  },
  custom_coaches: []
};

export async function getAll() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  return data;
}

export async function get(key) {
  const defaults = { [key]: DEFAULTS[key] };
  const data = await chrome.storage.sync.get(defaults);
  return data[key];
}

export async function set(obj) {
  await chrome.storage.sync.set(obj);
}

export async function getCoachEnabled(coachId) {
  const enabled = await get('coaches_enabled');
  return enabled[coachId] ?? false;
}

export async function setCoachEnabled(coachId, value) {
  const enabled = await get('coaches_enabled');
  enabled[coachId] = value;
  await set({ coaches_enabled: enabled });
}

export async function getCoachSetting(coachId, settingKey) {
  const settings = await get('coach_settings');
  return settings[coachId]?.[settingKey] ?? null;
}

export async function setCoachSetting(coachId, settingKey, value) {
  const settings = await get('coach_settings');
  if (!settings[coachId]) settings[coachId] = {};
  settings[coachId][settingKey] = value;
  await set({ coach_settings: settings });
}

// --- Local storage (for large data like model caches) ---

export async function getLocal(key, defaultValue = null) {
  const data = await chrome.storage.local.get({ [key]: defaultValue });
  return data[key];
}

export async function setLocal(obj) {
  await chrome.storage.local.set(obj);
}

export { DEFAULTS };
