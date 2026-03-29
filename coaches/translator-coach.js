const translatorCoach = {
  id: 'translator-coach',
  name: 'Translator',
  description: 'Translate to/from any language',
  icon: '🌐',
  enabled: false,
  systemPrompt: (settings) => `Translate the text to ${settings.target_language || 'Spanish'}. Return JSON with: { "translated": "translated text", "notes": "translation notes or nuances" }`,
  outputSchema: {
    tabs: [
      { key: 'translated', label: 'Translated', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' }
    ]
  },
  settings: {
    target_language: { label: 'Target Language', type: 'text', default: 'Spanish' }
  }
};
export default translatorCoach;
