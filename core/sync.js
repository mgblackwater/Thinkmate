// core/sync.js
// Supabase cross-device sync — anon key + direct REST, no auth needed
// User brings their own Supabase project

const SYNC_CONFIG_KEY = 'supabase_config';

const CONFIG_DEFAULTS = {
  url: '',
  anon_key: '',
  user_id: ''
};

export async function getConfig() {
  const data = await chrome.storage.sync.get({ [SYNC_CONFIG_KEY]: CONFIG_DEFAULTS });
  const config = data[SYNC_CONFIG_KEY];

  // Generate a stable user ID on first use
  if (config.url && !config.user_id) {
    config.user_id = crypto.randomUUID();
    await chrome.storage.sync.set({ [SYNC_CONFIG_KEY]: config });
  }

  return config;
}

export async function setConfig(config) {
  await chrome.storage.sync.set({ [SYNC_CONFIG_KEY]: config });
}

// --- Supabase REST helper ---

async function supabaseFetch(config, path, options = {}) {
  const res = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.anon_key,
      ...options.headers
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// --- Sync: Push + Pull ---

export async function syncToRemote(profile, memory) {
  const config = await getConfig();
  if (!config.url || !config.anon_key) return false;

  await supabaseFetch(config, '/rest/v1/user_data', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: config.user_id,
      profile,
      memory,
      updated_at: new Date().toISOString()
    })
  });

  return true;
}

export async function syncFromRemote() {
  const config = await getConfig();
  if (!config.url || !config.anon_key) return null;

  const result = await supabaseFetch(
    config,
    `/rest/v1/user_data?id=eq.${config.user_id}&select=profile,memory,updated_at`,
    { headers: { Accept: 'application/vnd.pgrst.object+json' } }
  );

  return result || null;
}

/**
 * Full sync: pull remote, merge with local, push back.
 * On first sync, local data is pushed up if remote is empty.
 */
export async function performFullSync() {
  const config = await getConfig();
  if (!config.url || !config.anon_key) return { synced: false, reason: 'not_configured' };

  const localProfile = await chrome.storage.sync.get({ user_profile: {} });
  const localMemory = await chrome.storage.local.get({ learned_memory: {} });
  const profile = localProfile.user_profile;
  const memory = localMemory.learned_memory;

  let remote;
  try {
    remote = await syncFromRemote();
  } catch {
    remote = null;
  }

  if (!remote || !remote.updated_at) {
    await syncToRemote(profile, memory);
    return { synced: true, direction: 'up' };
  }

  // Merge and push back
  const mergedProfile = { ...profile, ...remote.profile };
  const mergedMemory = mergeMemory(memory, remote.memory);

  await chrome.storage.sync.set({ user_profile: mergedProfile });
  await chrome.storage.local.set({ learned_memory: mergedMemory });
  await syncToRemote(mergedProfile, mergedMemory);

  return { synced: true, direction: 'merged' };
}

/**
 * Merge two memory objects. Dedup by category+pattern, keep highest counts.
 */
function mergeMemory(local, remote) {
  if (!remote || Object.keys(remote).length === 0) return local;
  if (!local || Object.keys(local).length === 0) return remote;

  // Error patterns — dedup by category+pattern, keep highest count
  const patternMap = new Map();
  for (const e of (local.error_patterns || [])) {
    patternMap.set(`${e.category}:${e.pattern}`, e);
  }
  for (const e of (remote.error_patterns || [])) {
    const key = `${e.category}:${e.pattern}`;
    const existing = patternMap.get(key);
    if (!existing || e.count > existing.count) {
      patternMap.set(key, e);
    }
  }

  // Strong areas — dedup by category, keep highest streak
  const strongMap = new Map();
  for (const s of (local.strong_areas || [])) strongMap.set(s.category, s);
  for (const s of (remote.strong_areas || [])) {
    const existing = strongMap.get(s.category);
    if (!existing || s.streak > existing.streak) strongMap.set(s.category, s);
  }

  // Coach usage — keep highest count per coach
  const coachUsage = { ...(local.coach_usage || {}) };
  for (const [id, data] of Object.entries(remote.coach_usage || {})) {
    if (!coachUsage[id] || data.count > coachUsage[id].count) coachUsage[id] = data;
  }

  // Site usage — keep highest count per site
  const siteUsage = { ...(local.site_usage || {}) };
  for (const [site, count] of Object.entries(remote.site_usage || {})) {
    if (!siteUsage[site] || count > siteUsage[site]) siteUsage[site] = count;
  }

  return {
    error_patterns: [...patternMap.values()],
    strong_areas: [...strongMap.values()],
    coach_usage: coachUsage,
    site_usage: siteUsage
  };
}

// --- Status ---

export async function getSyncStatus() {
  const config = await getConfig();
  if (!config.url || !config.anon_key) return { status: 'not_configured' };
  return { status: 'ready', user_id: config.user_id };
}
