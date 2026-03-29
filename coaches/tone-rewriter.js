const toneRewriter = {
  id: 'tone-rewriter',
  name: 'Tone Rewriter',
  description: 'Rewrite in formal/casual/professional/friendly tone',
  icon: '🎭',
  enabled: false,
  systemPrompt: (settings) => `Rewrite the text in a ${settings.tone || 'professional'} tone. Return JSON with: { "rewritten": "rewritten version", "tone_notes": "what changed and why" }`,
  outputSchema: {
    tabs: [
      { key: 'rewritten', label: 'Rewritten', type: 'text' },
      { key: 'tone_notes', label: 'Notes', type: 'text' }
    ]
  },
  settings: {
    tone: { label: 'Tone', type: 'select', options: ['formal', 'casual', 'professional', 'friendly'], default: 'professional' }
  }
};
export default toneRewriter;
