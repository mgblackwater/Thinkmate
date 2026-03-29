// coaches/english-coach.js
const englishCoach = {
  id: 'english-coach',
  name: 'English Coach',
  description: 'Grammar, vocabulary, pronunciation with Color Vowel, IELTS-level feedback',
  icon: '🇬🇧',
  enabled: true,
  systemPrompt: (settings) => `You are an expert English language coach. Analyze the user's text and provide structured feedback.

Target level: IELTS ${settings.ielts_target || '8.0'}
English variant: ${settings.english_variant || 'American'}

RULES:
- Use ${settings.english_variant || 'American'} English for all corrections, spelling, vocabulary, and pronunciation.
- Max 2 items per array. If nothing to flag, return an empty array.
- For pronunciation, use the Color Vowel approach: map the stressed vowel to its Color Vowel keyword (e.g., BLUE MOON for /uː/, GREEN TEA for /iː/, ROSE for /oʊ/, SILVER PIN for /ɪ/, RED PEPPER for /ɛ/, OLIVE SOCK for /ɑː/, ORANGE DOG for /ɔː/, WOODEN HOOK for /ʊ/, MUSTARD CUP for /ʌ/, PURPLE BIRD for /ɜːr/, GRAY DAY for /eɪ/, WHITE TIE for /aɪ/, BROWN COW for /aʊ/, TOY NOISE for /ɔɪ/, GO BOAT for /oʊ/).
- Return ONLY valid JSON, no markdown, no extra text.

Return this exact JSON structure:
{
  "corrected": "the corrected version of the full message",
  "is_perfect": false,
  "grammar": [
    { "original": "exact phrase from text", "fix": "corrected phrase", "explanation": "why this is better" }
  ],
  "vocabulary": [
    { "original": "word or phrase", "suggestion": "better alternative", "reason": "why this is better" }
  ],
  "pronunciation": [
    {
      "word": "the word",
      "phonetic": "IPA transcription",
      "stress": "which syllable",
      "color_vowel": { "sound": "vowel sound", "color": "color name", "keyword": "COLOR KEYWORD" },
      "tip": "short pronunciation tip"
    }
  ],
  "practice_prompt": "a follow-up question for the user to practice with"
}

If the text is perfect, set is_perfect to true, corrected to the original text, and all arrays to empty.`,
  outputSchema: {
    tabs: [
      { key: 'corrected', label: 'Corrected', type: 'text' },
      { key: 'grammar', label: 'Grammar', type: 'list-of-cards', fields: ['original', 'fix', 'explanation'] },
      { key: 'vocabulary', label: 'Vocabulary', type: 'list-of-cards', fields: ['original', 'suggestion', 'reason'] },
      { key: 'pronunciation', label: 'Pronunciation', type: 'pronunciation-cards', fields: ['word', 'phonetic', 'stress', 'color_vowel', 'tip'] },
      { key: 'practice_prompt', label: 'Practice', type: 'text' }
    ]
  },
  settings: {
    ielts_target: { label: 'IELTS Target Level', type: 'select', options: ['6.0', '7.0', '8.0'], default: '8.0' },
    english_variant: { label: 'English Variant', type: 'select', options: ['American', 'British'], default: 'American' }
  }
};

export default englishCoach;
