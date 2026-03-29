// Placeholder for user-created custom coaches
// Custom coaches are stored in chrome.storage and loaded at runtime
// This file exports a helper to create a coach config from user input

export function createCustomCoach({ id, name, icon, instruction, tabs }) {
  return {
    id,
    name,
    description: 'User-created custom coach',
    icon: icon || '⚡',
    enabled: true,
    systemPrompt: () => instruction + '\n\nReturn ONLY valid JSON, no markdown, no extra text.',
    outputSchema: {
      tabs: tabs && tabs.length > 0
        ? tabs
        : [{ key: 'result', label: 'Result', type: 'text' }]
    },
    settings: {}
  };
}

export default { id: 'custom-coach', createCustomCoach };
