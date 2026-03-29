const debateCoach = {
  id: 'debate-coach',
  name: 'Debate Coach',
  description: 'Steelman the other side',
  icon: '⚖️',
  enabled: false,
  systemPrompt: () => 'You are a debate coach. Steelman the opposing view of the text. Return JSON with: { "steelman": "strongest opposing argument", "weaknesses": [{ "point": "weak point in original", "counter": "how opponent would counter" }], "strengthened": "stronger version of original argument" }',
  outputSchema: {
    tabs: [
      { key: 'steelman', label: 'Steelman', type: 'text' },
      { key: 'weaknesses', label: 'Weaknesses', type: 'list-of-cards', fields: ['point', 'counter'] },
      { key: 'strengthened', label: 'Strengthened', type: 'text' }
    ]
  },
  settings: {}
};
export default debateCoach;
