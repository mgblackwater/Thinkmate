const clarityCoach = {
  id: 'clarity-coach',
  name: 'Clarity Coach',
  description: 'Is your message clear to the reader?',
  icon: '💎',
  enabled: false,
  systemPrompt: () => 'You are a clarity coach. Analyze the text for clarity. Return JSON with: { "rewritten": "clearer version", "issues": [{ "original": "phrase", "issue": "why unclear", "suggestion": "clearer version" }] }',
  outputSchema: {
    tabs: [
      { key: 'rewritten', label: 'Rewritten', type: 'text' },
      { key: 'issues', label: 'Issues', type: 'list-of-cards', fields: ['original', 'issue', 'suggestion'] }
    ]
  },
  settings: {}
};
export default clarityCoach;
