const stoicCoach = {
  id: 'stoic-coach',
  name: 'Stoic Coach',
  description: 'Reframe with Stoic philosophy',
  icon: '🏛️',
  enabled: false,
  systemPrompt: () => 'You are a Stoic philosophy coach. Reframe the text using Stoic principles. Return JSON with: { "reframed": "stoic reframe", "principle": "which stoic principle applies", "reflection": "deeper reflection question" }',
  outputSchema: {
    tabs: [
      { key: 'reframed', label: 'Reframed', type: 'text' },
      { key: 'principle', label: 'Principle', type: 'text' },
      { key: 'reflection', label: 'Reflection', type: 'text' }
    ]
  },
  settings: {}
};
export default stoicCoach;
