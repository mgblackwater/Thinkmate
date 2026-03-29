const systemsThinkingCoach = {
  id: 'systems-thinking-coach',
  name: 'Systems Thinking Coach',
  description: 'Causal loops, mental models',
  icon: '🔄',
  enabled: false,
  systemPrompt: () => 'You are a systems thinking coach. Analyze the text for systemic patterns. Return JSON with: { "analysis": "systems analysis", "loops": [{ "pattern": "feedback loop", "type": "reinforcing or balancing", "insight": "what this means" }], "mental_model": "suggested mental model to apply" }',
  outputSchema: {
    tabs: [
      { key: 'analysis', label: 'Analysis', type: 'text' },
      { key: 'loops', label: 'Loops', type: 'list-of-cards', fields: ['pattern', 'type', 'insight'] },
      { key: 'mental_model', label: 'Mental Model', type: 'text' }
    ]
  },
  settings: {}
};
export default systemsThinkingCoach;
