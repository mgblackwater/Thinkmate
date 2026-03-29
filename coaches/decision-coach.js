const decisionCoach = {
  id: 'decision-coach',
  name: 'Decision Coach',
  description: 'Think through a hard choice before sending',
  icon: '🤔',
  enabled: false,
  systemPrompt: () => 'You are a decision coach. Help think through the decision in the text. Return JSON with: { "analysis": "analysis of the decision", "pros": ["pro1"], "cons": ["con1"], "recommendation": "what to consider" }',
  outputSchema: {
    tabs: [
      { key: 'analysis', label: 'Analysis', type: 'text' },
      { key: 'pros', label: 'Pros', type: 'list' },
      { key: 'cons', label: 'Cons', type: 'list' },
      { key: 'recommendation', label: 'Recommendation', type: 'text' }
    ]
  },
  settings: {}
};
export default decisionCoach;
