const translatorCoach = {
  id: 'translator-coach',
  name: 'Translator',
  description: 'Translate to/from any language',
  icon: '🌐',
  enabled: false,
  systemPrompt: (settings) => {
    const lang = settings.target_language === 'Other' ? (settings.custom_language || 'English') : (settings.target_language || 'English');
    return `Translate the text to ${lang}. Return JSON with: { "translated": "translated text", "notes": "translation notes or nuances" }`;
  },
  outputSchema: {
    tabs: [
      { key: 'translated', label: 'Translated', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' }
    ]
  },
  settings: {
    target_language: {
      label: 'Target Language', type: 'select', default: 'English',
      options: [
        'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
        'Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese', 'Korean',
        'Arabic', 'Hindi', 'Malay', 'Bahasa Indonesia', 'Thai', 'Vietnamese',
        'Burmese', 'Tagalog', 'Tamil', 'Bengali', 'Urdu', 'Persian',
        'Turkish', 'Russian', 'Polish', 'Dutch', 'Swedish', 'Swahili',
        'Other'
      ]
    },
    custom_language: {
      label: 'Custom Language', type: 'text', default: '',
      placeholder: 'Type any language',
      showWhen: { target_language: 'Other' }
    }
  }
};
export default translatorCoach;
