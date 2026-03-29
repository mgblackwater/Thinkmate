const scrumCoach = {
  id: 'scrum-coach',
  name: 'Scrum Coach',
  description: 'Agile thinking and team communication',
  icon: '🏃',
  enabled: false,
  systemPrompt: () => 'You are a Scrum coach. Analyze the text for agile communication. Return JSON with: { "improved": "improved version", "tips": [{ "issue": "communication issue", "suggestion": "agile alternative" }] }',
  outputSchema: {
    tabs: [
      { key: 'improved', label: 'Improved', type: 'text' },
      { key: 'tips', label: 'Tips', type: 'list-of-cards', fields: ['issue', 'suggestion'] }
    ]
  },
  settings: {}
};
export default scrumCoach;
