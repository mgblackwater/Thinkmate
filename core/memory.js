// core/memory.js
// Memory system — profile, auto-learned patterns, session context

import * as storage from './storage.js';

// --- User Profile (chrome.storage.sync) ---

const PROFILE_DEFAULTS = {
  name: '',
  nationality: '',
  native_language: '',
  profession: '',
  seniority: '',
  goals: '',
  work_context: '',
  communication_style: 'direct'
};

export async function getProfile() {
  const data = await chrome.storage.sync.get({ user_profile: PROFILE_DEFAULTS });
  return { ...PROFILE_DEFAULTS, ...data.user_profile };
}

export async function setProfile(profile) {
  await chrome.storage.sync.set({ user_profile: profile });
  triggerSync();
}

// --- Auto-learned Memory (chrome.storage.local) ---

const MEMORY_DEFAULTS = {
  error_patterns: [],
  strong_areas: [],
  coach_usage: {},
  site_usage: {}
};

export async function getMemory() {
  const data = await chrome.storage.local.get({ learned_memory: MEMORY_DEFAULTS });
  return { ...MEMORY_DEFAULTS, ...data.learned_memory };
}

async function saveMemory(memory) {
  await chrome.storage.local.set({ learned_memory: memory });
  triggerSync();
}

// --- Session Context (in-memory, per domain) ---

const sessionContextMap = {};

export function getSessionContext(domain) {
  return sessionContextMap[domain] || [];
}

export function addSessionEntry(domain, userText, assistantResponse) {
  if (!sessionContextMap[domain]) {
    sessionContextMap[domain] = [];
  }
  sessionContextMap[domain].push(
    { role: 'user', content: userText },
    { role: 'assistant', content: JSON.stringify(assistantResponse) }
  );
  // Keep max 3 pairs (6 messages)
  if (sessionContextMap[domain].length > 6) {
    sessionContextMap[domain] = sessionContextMap[domain].slice(-6);
  }
}

export function clearSessionContext(domain) {
  delete sessionContextMap[domain];
}

// --- Context Injection ---

export async function buildContextPrefix() {
  const profile = await getProfile();
  const memory = await getMemory();

  const parts = [];

  // Profile info
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.nationality) parts.push(`Nationality: ${profile.nationality}`);
  if (profile.native_language) parts.push(`Native language: ${profile.native_language}`);
  if (profile.profession) {
    const role = profile.seniority ? `${profile.profession} (${profile.seniority})` : profile.profession;
    parts.push(`Profession: ${role}`);
  }
  if (profile.goals) parts.push(`Goals: ${profile.goals}`);
  if (profile.work_context) parts.push(`Work context: ${profile.work_context}`);
  if (profile.communication_style) parts.push(`Preferred style: ${profile.communication_style}`);

  // Weak areas (top 5 by count)
  if (memory.error_patterns.length > 0) {
    const top = memory.error_patterns
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(e => `${e.pattern} (${e.category}, ${e.count}x)`);
    parts.push(`Known weak areas: ${top.join(', ')}`);
  }

  // Strong areas
  if (memory.strong_areas.length > 0) {
    const strong = memory.strong_areas.map(s => s.category);
    parts.push(`Strong areas: ${strong.join(', ')}`);
  }

  if (parts.length === 0) return '';

  return `About the user:\n${parts.join('. ')}.\nTailor all feedback to this profile. Be concise and direct.\n\n`;
}

export function buildSessionMessages(domain) {
  return getSessionContext(domain);
}

// --- Memory Update (called after each coaching response) ---

// Track consecutive clean sessions per category (in-memory)
const cleanStreaks = {};

export async function updateMemory({ coachId, domain, responseData }) {
  const memory = await getMemory();
  const today = new Date().toISOString().split('T')[0];

  // Determine which categories had errors
  const categories = ['grammar', 'vocabulary', 'pronunciation'];
  const categoriesWithErrors = [];
  const categoriesClean = [];

  for (const cat of categories) {
    const items = responseData[cat];
    if (Array.isArray(items) && items.length > 0) {
      categoriesWithErrors.push(cat);

      // Extract patterns from items
      for (const item of items) {
        const pattern = item.explanation || item.reason || item.tip || item.fix || 'general';
        const shortPattern = pattern.length > 60 ? pattern.slice(0, 60) + '...' : pattern;

        const existing = memory.error_patterns.find(
          e => e.category === cat && e.pattern === shortPattern
        );
        if (existing) {
          existing.count++;
          existing.last_seen = today;
        } else {
          memory.error_patterns.push({
            category: cat,
            pattern: shortPattern,
            count: 1,
            last_seen: today
          });
        }
      }
    } else {
      categoriesClean.push(cat);
    }
  }

  // Track strong areas (3 consecutive clean sessions)
  for (const cat of categoriesClean) {
    cleanStreaks[cat] = (cleanStreaks[cat] || 0) + 1;
    if (cleanStreaks[cat] >= 3) {
      const existing = memory.strong_areas.find(s => s.category === cat);
      if (!existing) {
        memory.strong_areas.push({ category: cat, streak: cleanStreaks[cat], since: today });
      } else {
        existing.streak = cleanStreaks[cat];
      }
    }
  }

  // Reset clean streaks for categories with errors
  for (const cat of categoriesWithErrors) {
    cleanStreaks[cat] = 0;
    // Remove from strong areas if it was there
    memory.strong_areas = memory.strong_areas.filter(s => s.category !== cat);
  }

  // Update coach usage
  if (!memory.coach_usage[coachId]) {
    memory.coach_usage[coachId] = { count: 0, last_used: today };
  }
  memory.coach_usage[coachId].count++;
  memory.coach_usage[coachId].last_used = today;

  // Update site usage
  if (domain) {
    memory.site_usage[domain] = (memory.site_usage[domain] || 0) + 1;
  }

  // Prune old entries (90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  memory.error_patterns = memory.error_patterns.filter(e => e.last_seen >= cutoffStr);

  await saveMemory(memory);
}

// --- Delete/clear helpers for options page ---

export async function deleteErrorPattern(index) {
  const memory = await getMemory();
  memory.error_patterns.splice(index, 1);
  await saveMemory(memory);
}

export async function clearAllMemory() {
  await saveMemory(MEMORY_DEFAULTS);
}

export async function exportAllData() {
  const profile = await getProfile();
  const memory = await getMemory();
  return { profile, memory, exported_at: new Date().toISOString() };
}

// --- Sync trigger (debounced, best-effort) ---

let syncTimer = null;

function triggerSync() {
  // Debounce: wait 2s after last save before syncing
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const profile = await getProfile();
      const memory = await getMemory();
      await chrome.runtime.sendMessage({
        type: 'sync-push',
        profile,
        memory
      });
    } catch {
      // Sync is best-effort — ignore failures silently
    }
  }, 2000);
}

export { PROFILE_DEFAULTS, MEMORY_DEFAULTS };
