// core/sync.js
// Supabase cross-device sync — REST API client + Google OAuth + sync logic
// No SDK needed — uses fetch against Supabase REST endpoints

// --- Config ---

const SYNC_CONFIG_KEY = 'supabase_config';
const SESSION_KEY = 'supabase_session';

const CONFIG_DEFAULTS = {
  url: '',
  anon_key: ''
};

export async function getConfig() {
  const data = await chrome.storage.sync.get({ [SYNC_CONFIG_KEY]: CONFIG_DEFAULTS });
  return data[SYNC_CONFIG_KEY];
}

export async function setConfig(config) {
  await chrome.storage.sync.set({ [SYNC_CONFIG_KEY]: config });
}

// --- Session (stored in local storage) ---

export async function getSession() {
  const data = await chrome.storage.local.get({ [SESSION_KEY]: null });
  return data[SESSION_KEY];
}

async function saveSession(session) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}

// --- Auth: Google OAuth via chrome.identity ---

export async function signInWithGoogle() {
  const config = await getConfig();
  if (!config.url || !config.anon_key) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const redirectUrl = chrome.identity.getRedirectURL();

  // Build Supabase OAuth URL
  const authUrl = `${config.url}/auth/v1/authorize?` + new URLSearchParams({
    provider: 'google',
    redirect_to: redirectUrl
  }).toString();

  // Launch interactive auth flow
  const callbackUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(responseUrl);
        }
      }
    );
  });

  // Parse tokens from callback URL fragment
  // Supabase redirects with: #access_token=...&refresh_token=...&expires_in=...&token_type=bearer
  const hash = new URL(callbackUrl).hash.substring(1);
  const params = new URLSearchParams(hash);

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600');

  if (!accessToken) {
    throw new Error('AUTH_FAILED');
  }

  // Get user info from Supabase
  const user = await supabaseFetch(config, '/auth/v1/user', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + (expiresIn * 1000),
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email
    }
  };

  await saveSession(session);
  return session;
}

export async function signOut() {
  const config = await getConfig();
  const session = await getSession();

  // Revoke token on Supabase (best-effort)
  if (session?.access_token && config.url) {
    try {
      await supabaseFetch(config, '/auth/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    } catch {
      // Ignore — we clear locally regardless
    }
  }

  await clearSession();
}

// --- Token Refresh ---

async function refreshAccessToken() {
  const config = await getConfig();
  const session = await getSession();

  if (!session?.refresh_token || !config.url) return null;

  try {
    const result = await supabaseFetch(config, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });

    const newSession = {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: Date.now() + (result.expires_in * 1000),
      user: session.user
    };

    await saveSession(newSession);
    return newSession;
  } catch {
    // Refresh failed — session expired, user needs to sign in again
    await clearSession();
    return null;
  }
}

async function getValidSession() {
  let session = await getSession();
  if (!session) return null;

  // Refresh if token expires within 60 seconds
  if (session.expires_at - Date.now() < 60000) {
    session = await refreshAccessToken();
  }

  return session;
}

// --- Supabase REST helpers ---

async function supabaseFetch(config, path, options = {}) {
  const url = `${config.url}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': config.anon_key,
    ...options.headers
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }

  // Some endpoints return empty body (e.g. logout)
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// --- Sync: Push + Pull ---

export async function syncToRemote(profile, memory) {
  const config = await getConfig();
  const session = await getValidSession();
  if (!session || !config.url) return false;

  const payload = {
    id: session.user.id,
    profile,
    memory,
    updated_at: new Date().toISOString()
  };

  await supabaseFetch(config, '/rest/v1/user_data', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(payload)
  });

  return true;
}

export async function syncFromRemote() {
  const config = await getConfig();
  const session = await getValidSession();
  if (!session || !config.url) return null;

  const result = await supabaseFetch(
    config,
    `/rest/v1/user_data?id=eq.${session.user.id}&select=profile,memory,updated_at`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: 'application/vnd.pgrst.object+json'
      }
    }
  );

  return result || null;
}

/**
 * Full sync: pull remote, merge with local, push back.
 * Strategy: last-write-wins per field group (profile vs memory).
 * On first sign-in, local data is pushed up if remote is empty.
 */
export async function performFullSync() {
  const config = await getConfig();
  const session = await getValidSession();
  if (!session || !config.url) return { synced: false, reason: 'not_signed_in' };

  // Get local data
  const localProfile = await chrome.storage.sync.get({ user_profile: {} });
  const localMemory = await chrome.storage.local.get({ learned_memory: {} });
  const profile = localProfile.user_profile;
  const memory = localMemory.learned_memory;

  let remote;
  try {
    remote = await syncFromRemote();
  } catch {
    // No remote data yet (404 or empty) — push local up
    remote = null;
  }

  if (!remote || !remote.updated_at) {
    // First sync — push local data to remote
    await syncToRemote(profile, memory);
    return { synced: true, direction: 'up' };
  }

  // Merge: remote wins for profile (simpler), merge error patterns for memory
  const mergedProfile = { ...profile, ...remote.profile };
  const mergedMemory = mergeMemory(memory, remote.memory);

  // Save merged data locally
  await chrome.storage.sync.set({ user_profile: mergedProfile });
  await chrome.storage.local.set({ learned_memory: mergedMemory });

  // Push merged data to remote
  await syncToRemote(mergedProfile, mergedMemory);

  return { synced: true, direction: 'merged' };
}

/**
 * Merge two memory objects. Combines error_patterns (dedup by category+pattern),
 * takes max counts, merges coach/site usage, and unions strong_areas.
 */
function mergeMemory(local, remote) {
  if (!remote || Object.keys(remote).length === 0) return local;
  if (!local || Object.keys(local).length === 0) return remote;

  // Merge error_patterns — dedup by category+pattern, keep highest count
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

  // Merge strong_areas — dedup by category, keep highest streak
  const strongMap = new Map();
  for (const s of (local.strong_areas || [])) {
    strongMap.set(s.category, s);
  }
  for (const s of (remote.strong_areas || [])) {
    const existing = strongMap.get(s.category);
    if (!existing || s.streak > existing.streak) {
      strongMap.set(s.category, s);
    }
  }

  // Merge coach_usage — keep highest count per coach
  const coachUsage = { ...(local.coach_usage || {}) };
  for (const [id, data] of Object.entries(remote.coach_usage || {})) {
    if (!coachUsage[id] || data.count > coachUsage[id].count) {
      coachUsage[id] = data;
    }
  }

  // Merge site_usage — keep highest count per site
  const siteUsage = { ...(local.site_usage || {}) };
  for (const [site, count] of Object.entries(remote.site_usage || {})) {
    if (!siteUsage[site] || count > siteUsage[site]) {
      siteUsage[site] = count;
    }
  }

  return {
    error_patterns: [...patternMap.values()],
    strong_areas: [...strongMap.values()],
    coach_usage: coachUsage,
    site_usage: siteUsage
  };
}

// --- Status helper ---

export async function getSyncStatus() {
  const config = await getConfig();
  const session = await getValidSession();

  if (!config.url || !config.anon_key) {
    return { status: 'not_configured' };
  }

  if (!session) {
    return { status: 'signed_out' };
  }

  return { status: 'signed_in', user: session.user };
}
