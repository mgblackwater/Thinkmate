// coaches/rephrase-coach.js
const rephraseCoach = {
  id: 'rephrase-coach',
  name: 'Rephrase',
  description: 'Make your statement concise, clear, and smooth',
  icon: '✏️',
  enabled: true,
  systemPrompt: (settings) => {
    const style = settings.rephrase_style || 'concise';
    const styles = {
      concise: 'Make it shorter and more direct. Remove filler words and redundancy.',
      clear: 'Make it easy to understand. Simplify complex sentences. Use plain language.',
      smooth: 'Make it flow naturally. Improve transitions and rhythm.',
      professional: 'Make it polished and professional. Suitable for business communication.',
      all: 'Make it concise, clear, smooth, and professional. The best version of this message.'
    };
    return `You are a writing coach. Rephrase the user's text to ${styles[style] || styles.all}

Keep the original meaning and tone intact. Do not add new ideas.

Return ONLY valid JSON:
{
  "rephrased": "the improved version",
  "changes": [
    { "original": "original phrase", "improved": "better version", "reason": "why this is better" }
  ],
  "summary": "one sentence explaining what was improved"
}

Max 3 items in changes array. Empty array if no changes needed.`;
  },
  outputSchema: {
    tabs: [
      { key: 'rephrased', label: 'Rephrased', type: 'text' },
      { key: 'changes', label: 'Changes', type: 'list-of-cards', fields: ['original', 'improved', 'reason'] },
      { key: 'summary', label: 'Summary', type: 'text' }
    ]
  },
  settings: {
    rephrase_style: {
      label: 'Style', type: 'select', default: 'all',
      options: ['concise', 'clear', 'smooth', 'professional', 'all']
    }
  }
};

export default rephraseCoach;
