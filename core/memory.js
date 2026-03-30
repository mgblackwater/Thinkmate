// core/memory.js
// Personalization — user profile for tailored coaching
// Stored in chrome.storage.sync (persists permanently, syncs across devices)

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
}

// --- Context Injection ---

export async function buildContextPrefix() {
  const profile = await getProfile();
  const parts = [];

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

  if (parts.length === 0) return '';

  return `About the user:\n${parts.join('. ')}.\nTailor all feedback to this profile. Be concise and direct.\n\n`;
}

// --- Export ---

export async function exportAllData() {
  const profile = await getProfile();
  return { profile, exported_at: new Date().toISOString() };
}

export { PROFILE_DEFAULTS };
