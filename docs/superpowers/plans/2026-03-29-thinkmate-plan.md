# Thinkmate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that provides AI-powered coaching on any website, starting with a fully functional English Coach.

**Architecture:** Content script injects Shadow DOM panel into pages, detects input fields, captures text. Background service worker handles all API calls to avoid CORS. Coaches are instruction-based config files with declarative output schemas that the panel renders into tabs.

**Tech Stack:** Vanilla JS, Chrome Extension Manifest V3, Shadow DOM, chrome.storage API

---

### Task 1: Manifest + Icons + Project Skeleton

**Files:**
- Create: `manifest.json`
- Create: `icons/icon16.png`
- Create: `icons/icon48.png`
- Create: `icons/icon128.png`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Thinkmate",
  "version": "1.0.0",
  "description": "Your thinking partner — AI coaching layer for any website",
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://generativelanguage.googleapis.com/*",
    "https://openrouter.ai/*",
    "http://localhost/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "options_page": "options.html",
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "Thinkmate"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Generate placeholder icons**

Create simple colored square PNG icons at 16x16, 48x48, and 128x128 pixels. Use an inline SVG-to-canvas approach or just create minimal placeholder PNGs. The icons should be a teal/dark circle with "T" letter. For now, generate them as base64-encoded minimal PNGs written via a quick Node script, or create actual icon files using any available method.

If no image tooling is available, create a simple `icons/generate-icons.html` that the developer can open in a browser to download the icons:

```html
<!DOCTYPE html>
<html>
<body>
<script>
[16, 48, 128].forEach(size => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background circle
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();

  // Letter T
  ctx.fillStyle = '#00d4aa';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', size/2, size/2);

  const link = document.createElement('a');
  link.download = `icon${size}.png`;
  link.href = canvas.toDataURL();
  link.textContent = `Download icon${size}.png`;
  document.body.appendChild(link);
  document.body.appendChild(document.createElement('br'));
});
</script>
</body>
</html>
```

Open this file in a browser, click each link, save icons to `/icons/`.

- [ ] **Step 3: Create stub background.js and content.js**

`background.js`:
```js
// Thinkmate background service worker
// Will handle API routing in Task 5
console.log('Thinkmate background service worker loaded');
```

`content.js`:
```js
// Thinkmate content script
// Will bootstrap detector + panel in Task 9
console.log('Thinkmate content script loaded');
```

- [ ] **Step 4: Verify extension loads**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `/thinkmate` project folder
4. Verify: no errors, extension appears with icon
5. Open any webpage, check console for "Thinkmate content script loaded"
6. Check service worker console for "Thinkmate background service worker loaded"

- [ ] **Step 5: Commit**

```bash
git add manifest.json background.js content.js icons/
git commit -m "feat: project skeleton with manifest, icons, and stub scripts"
```

---

### Task 2: Storage Wrapper

**Files:**
- Create: `core/storage.js`

- [ ] **Step 1: Create core/storage.js**

This module wraps `chrome.storage.sync` with typed getter/setter functions and default values.

```js
// core/storage.js
// Wrapper around chrome.storage.sync with defaults and typed accessors

const DEFAULTS = {
  provider: 'gemini',
  gemini_api_key: '',
  gemini_model: 'gemini-2.0-flash',
  openrouter_api_key: '',
  openrouter_model: 'meta-llama/llama-3.3-70b-instruct:free',
  openrouter_models_cache: null,
  openrouter_models_cache_time: 0,
  ollama_base_url: 'http://localhost:11434',
  ollama_model: '',
  panel_position: 'anchored',
  coaches_enabled: { 'english-coach': true },
  coach_settings: {
    'english-coach': {
      ielts_target: '8.0',
      english_variant: 'American'
    }
  },
  custom_coaches: []
};

export async function getAll() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  return data;
}

export async function get(key) {
  const defaults = { [key]: DEFAULTS[key] };
  const data = await chrome.storage.sync.get(defaults);
  return data[key];
}

export async function set(obj) {
  await chrome.storage.sync.set(obj);
}

export async function getCoachEnabled(coachId) {
  const enabled = await get('coaches_enabled');
  return enabled[coachId] ?? false;
}

export async function setCoachEnabled(coachId, value) {
  const enabled = await get('coaches_enabled');
  enabled[coachId] = value;
  await set({ coaches_enabled: enabled });
}

export async function getCoachSetting(coachId, settingKey) {
  const settings = await get('coach_settings');
  return settings[coachId]?.[settingKey] ?? null;
}

export async function setCoachSetting(coachId, settingKey, value) {
  const settings = await get('coach_settings');
  if (!settings[coachId]) settings[coachId] = {};
  settings[coachId][settingKey] = value;
  await set({ coach_settings: settings });
}

export { DEFAULTS };
```

- [ ] **Step 2: Verify module loads**

Temporarily import in `background.js` to test:

```js
import * as storage from './core/storage.js';

chrome.runtime.onInstalled.addListener(async () => {
  const all = await storage.getAll();
  console.log('Thinkmate defaults:', all);
});
```

Reload extension, check service worker console for the defaults log.

- [ ] **Step 3: Remove temporary test code from background.js**

Revert `background.js` back to the stub (just the console.log). The real background.js imports will be added in Task 5.

```js
// Thinkmate background service worker
console.log('Thinkmate background service worker loaded');
```

- [ ] **Step 4: Commit**

```bash
git add core/storage.js background.js
git commit -m "feat: add chrome.storage wrapper with defaults"
```

---

### Task 3: Coach Registry + English Coach + Stubs

**Files:**
- Create: `coaches/english-coach.js`
- Create: `coaches/clarity-coach.js`
- Create: `coaches/decision-coach.js`
- Create: `coaches/debate-coach.js`
- Create: `coaches/stoic-coach.js`
- Create: `coaches/scrum-coach.js`
- Create: `coaches/systems-thinking-coach.js`
- Create: `coaches/tone-rewriter.js`
- Create: `coaches/translator-coach.js`
- Create: `coaches/custom-coach.js`
- Create: `coaches/index.js`

- [ ] **Step 1: Create coaches/english-coach.js**

```js
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
```

- [ ] **Step 2: Create stub coaches**

Each stub follows the same pattern. Create all of these files:

`coaches/clarity-coach.js`:
```js
const clarityCoach = {
  id: 'clarity-coach',
  name: 'Clarity Coach',
  description: 'Is your message clear to the reader?',
  icon: '💎',
  enabled: false,
  systemPrompt: () => 'You are a clarity coach. Analyze the text for clarity. Return JSON with: { "rewritten": "clearer version", "issues": [{ "original": "phrase", "issue": "why unclear", "suggestion": "clearer version" }] }',
  outputSchema: {
    tabs: [
      { key: 'rewritten', label: 'Rewritten', type: 'text' },
      { key: 'issues', label: 'Issues', type: 'list-of-cards', fields: ['original', 'issue', 'suggestion'] }
    ]
  },
  settings: {}
};
export default clarityCoach;
```

`coaches/decision-coach.js`:
```js
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
```

`coaches/debate-coach.js`:
```js
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
```

`coaches/stoic-coach.js`:
```js
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
```

`coaches/scrum-coach.js`:
```js
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
```

`coaches/systems-thinking-coach.js`:
```js
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
```

`coaches/tone-rewriter.js`:
```js
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
```

`coaches/translator-coach.js`:
```js
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
```

`coaches/custom-coach.js`:
```js
// Placeholder for user-created custom coaches
// Custom coaches are stored in chrome.storage and loaded at runtime
// This file exports a helper to create a coach config from user input

export function createCustomCoach({ id, name, icon, instruction, tabs }) {
  return {
    id,
    name,
    description: 'User-created custom coach',
    icon: icon || '⚡',
    enabled: true,
    systemPrompt: () => instruction + '\n\nReturn ONLY valid JSON, no markdown, no extra text.',
    outputSchema: {
      tabs: tabs && tabs.length > 0
        ? tabs
        : [{ key: 'result', label: 'Result', type: 'text' }]
    },
    settings: {}
  };
}

export default { id: 'custom-coach', createCustomCoach };
```

- [ ] **Step 3: Create coaches/index.js**

```js
// coaches/index.js
// Coach registry — import all coaches and export as array

import englishCoach from './english-coach.js';
import clarityCoach from './clarity-coach.js';
import decisionCoach from './decision-coach.js';
import debateCoach from './debate-coach.js';
import stoicCoach from './stoic-coach.js';
import scrumCoach from './scrum-coach.js';
import systemsThinkingCoach from './systems-thinking-coach.js';
import toneRewriter from './tone-rewriter.js';
import translatorCoach from './translator-coach.js';

// All built-in coaches in display order
export const coaches = [
  englishCoach,
  clarityCoach,
  decisionCoach,
  debateCoach,
  stoicCoach,
  scrumCoach,
  systemsThinkingCoach,
  toneRewriter,
  translatorCoach
];

export function getCoachById(id) {
  return coaches.find(c => c.id === id) || null;
}

export default coaches;
```

- [ ] **Step 4: Verify coaches load**

Temporarily add to `background.js`:

```js
import coaches from './coaches/index.js';
console.log('Thinkmate coaches:', coaches.map(c => `${c.icon} ${c.name} (${c.enabled ? 'ON' : 'OFF'})`));
```

Reload extension, check service worker console. Expected output:
```
Thinkmate coaches: ["🇬🇧 English Coach (ON)", "💎 Clarity Coach (OFF)", ...]
```

- [ ] **Step 5: Revert background.js to stub**

```js
// Thinkmate background service worker
console.log('Thinkmate background service worker loaded');
```

- [ ] **Step 6: Commit**

```bash
git add coaches/
git commit -m "feat: add English Coach config and stub coaches with registry"
```

---

### Task 4: API Client

**Files:**
- Create: `core/api.js`

- [ ] **Step 1: Create core/api.js**

This is the provider-agnostic API client used by background.js. Each provider has its own request formatter and response normalizer.

```js
// core/api.js
// Provider-agnostic API client — called from background.js only

export async function callProvider({ provider, apiKey, baseUrl, model, systemPrompt, userText }) {
  switch (provider) {
    case 'gemini':
      return callGemini({ apiKey, model, systemPrompt, userText });
    case 'openrouter':
      return callOpenRouter({ apiKey, model, systemPrompt, userText });
    case 'ollama':
      return callOllama({ baseUrl, model, systemPrompt, userText });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// --- Gemini ---

async function callGemini({ apiKey, model, systemPrompt, userText }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return { content: text };
}

// --- OpenRouter ---

async function callOpenRouter({ apiKey, model, systemPrompt, userText }) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://thinkmate.app',
      'X-Title': 'Thinkmate'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenRouter API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenRouter');
  return { content: text };
}

// --- Ollama ---

async function callOllama({ baseUrl, model, systemPrompt, userText }) {
  const url = `${baseUrl}/api/chat`;

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ],
    stream: false,
    format: 'json'
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status}. Is Ollama running at ${baseUrl}?`);
  }

  const data = await res.json();
  const text = data.message?.content;
  if (!text) throw new Error('Empty response from Ollama');
  return { content: text };
}

// --- Model Discovery ---

export async function fetchModels(provider, { apiKey, baseUrl } = {}) {
  switch (provider) {
    case 'gemini':
      return [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
      ];

    case 'openrouter': {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) throw new Error(`Failed to fetch OpenRouter models: ${res.status}`);
      const data = await res.json();
      return data.data
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(m => ({
          id: m.id,
          name: m.name || m.id,
          pricing: m.pricing
            ? `$${(parseFloat(m.pricing.prompt) * 1e6).toFixed(2)} / 1M tokens`
            : 'Free'
        }));
    }

    case 'ollama': {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`Failed to fetch Ollama models. Is Ollama running at ${baseUrl}?`);
      const data = await res.json();
      return (data.models || []).map(m => ({
        id: m.name,
        name: m.name
      }));
    }

    default:
      return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add core/api.js
git commit -m "feat: add provider-agnostic API client (Gemini, OpenRouter, Ollama)"
```

---

### Task 5: Background Service Worker

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Implement background.js**

Replace the stub with the full service worker that handles messages from content script and options page.

```js
// background.js
// Thinkmate service worker — handles API calls and message routing

import { callProvider, fetchModels } from './core/api.js';
import * as storage from './core/storage.js';

// Handle messages from content script and options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(err => {
    sendResponse({ error: err.message });
  });
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'analyze':
      return handleAnalyze(message);
    case 'fetch-models':
      return handleFetchModels(message);
    case 'check-provider':
      return handleCheckProvider();
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

async function handleAnalyze({ systemPrompt, userText }) {
  const settings = await storage.getAll();
  const provider = settings.provider;

  let apiKey, baseUrl, model;
  switch (provider) {
    case 'gemini':
      apiKey = settings.gemini_api_key;
      model = settings.gemini_model;
      if (!apiKey) throw new Error('NO_API_KEY');
      break;
    case 'openrouter':
      apiKey = settings.openrouter_api_key;
      model = settings.openrouter_model;
      if (!apiKey) throw new Error('NO_API_KEY');
      break;
    case 'ollama':
      baseUrl = settings.ollama_base_url;
      model = settings.ollama_model;
      if (!model) throw new Error('NO_MODEL');
      break;
  }

  const result = await callProvider({ provider, apiKey, baseUrl, model, systemPrompt, userText });
  return result;
}

async function handleFetchModels({ provider }) {
  const settings = await storage.getAll();
  let apiKey, baseUrl;

  switch (provider) {
    case 'openrouter':
      apiKey = settings.openrouter_api_key;
      // Check cache (24 hour TTL)
      if (settings.openrouter_models_cache && Date.now() - settings.openrouter_models_cache_time < 86400000) {
        return { models: settings.openrouter_models_cache };
      }
      break;
    case 'ollama':
      baseUrl = settings.ollama_base_url;
      break;
  }

  const models = await fetchModels(provider, { apiKey, baseUrl });

  // Cache OpenRouter models
  if (provider === 'openrouter') {
    await storage.set({
      openrouter_models_cache: models,
      openrouter_models_cache_time: Date.now()
    });
  }

  return { models };
}

async function handleCheckProvider() {
  const settings = await storage.getAll();
  const provider = settings.provider;
  let configured = false;

  switch (provider) {
    case 'gemini':
      configured = !!settings.gemini_api_key;
      break;
    case 'openrouter':
      configured = !!settings.openrouter_api_key;
      break;
    case 'ollama':
      configured = !!settings.ollama_model;
      break;
  }

  return { provider, configured };
}

// Handle toolbar icon click — send message to active tab to toggle panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' });
  }
});

console.log('Thinkmate background service worker loaded');
```

- [ ] **Step 2: Verify**

Reload extension. Check service worker console for "Thinkmate background service worker loaded" with no import errors.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat: implement background service worker with API routing"
```

---

### Task 6: Panel CSS

**Files:**
- Create: `panel.css`

- [ ] **Step 1: Create panel.css**

Dark theme, minimal, clean design. All styles scoped inside Shadow DOM.

```css
/* panel.css — Thinkmate panel styles (injected inside Shadow DOM) */

:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #e0e0e0;
  line-height: 1.5;
}

/* --- Trigger Button --- */

.tm-trigger {
  position: fixed;
  z-index: 2147483646;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #1a1a2e;
  border: 2px solid #00d4aa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  padding: 0;
}

.tm-trigger:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 212, 170, 0.3);
}

.tm-trigger-icon {
  color: #00d4aa;
  font-weight: bold;
  font-size: 16px;
  line-height: 1;
}

/* --- Panel Container --- */

.tm-panel {
  position: fixed;
  z-index: 2147483647;
  width: 420px;
  max-height: 520px;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.tm-panel.tm-visible {
  opacity: 1;
  transform: translateY(0);
}

/* --- Header --- */

.tm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #2a2a4a;
  flex-shrink: 0;
}

.tm-brand {
  font-size: 15px;
  font-weight: 700;
  color: #00d4aa;
  letter-spacing: 0.5px;
}

.tm-close {
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.tm-close:hover {
  color: #e0e0e0;
  background: #2a2a4a;
}

/* --- Input Area --- */

.tm-input-area {
  padding: 12px 16px;
  border-bottom: 1px solid #2a2a4a;
  flex-shrink: 0;
}

.tm-textarea {
  width: 100%;
  min-height: 80px;
  max-height: 120px;
  background: #0f0f23;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 13px;
  padding: 10px 12px;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.tm-textarea:focus {
  border-color: #00d4aa;
}

.tm-input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.tm-char-count {
  font-size: 11px;
  color: #666;
}

.tm-analyze-btn {
  background: #00d4aa;
  color: #1a1a2e;
  border: none;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.tm-analyze-btn:hover {
  background: #00eabb;
}

.tm-analyze-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* --- Coach Tabs --- */

.tm-coach-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid #2a2a4a;
  overflow-x: auto;
  flex-shrink: 0;
}

.tm-coach-tab {
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #888;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tm-coach-tab:hover {
  color: #e0e0e0;
  background: #2a2a4a;
}

.tm-coach-tab.tm-active {
  color: #00d4aa;
  border-color: #00d4aa;
  background: rgba(0, 212, 170, 0.1);
}

/* --- Result Tabs --- */

.tm-result-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 16px 0;
  flex-shrink: 0;
}

.tm-result-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #888;
  font-size: 12px;
  padding: 6px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tm-result-tab:hover {
  color: #e0e0e0;
}

.tm-result-tab.tm-active {
  color: #00d4aa;
  border-bottom-color: #00d4aa;
}

/* --- Result Content --- */

.tm-result-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  min-height: 0;
}

.tm-result-text {
  color: #e0e0e0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Cards */

.tm-card {
  background: #0f0f23;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.tm-card-field {
  margin-bottom: 6px;
}

.tm-card-field:last-child {
  margin-bottom: 0;
}

.tm-card-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  margin-bottom: 2px;
}

.tm-card-value {
  font-size: 13px;
  color: #e0e0e0;
}

.tm-card-original {
  color: #ff6b6b;
  text-decoration: line-through;
}

.tm-card-fix {
  color: #00d4aa;
  font-weight: 500;
}

/* Color Vowel */

.tm-color-vowel-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

/* Color Vowel color mappings */
.tm-vowel-blue { background: rgba(0, 100, 255, 0.2); color: #66b3ff; }
.tm-vowel-green { background: rgba(0, 180, 80, 0.2); color: #66cc88; }
.tm-vowel-pink, .tm-vowel-rose { background: rgba(255, 100, 150, 0.2); color: #ff88aa; }
.tm-vowel-silver { background: rgba(180, 180, 200, 0.2); color: #c0c0d0; }
.tm-vowel-red { background: rgba(255, 80, 80, 0.2); color: #ff8888; }
.tm-vowel-olive { background: rgba(140, 160, 80, 0.2); color: #aabb66; }
.tm-vowel-orange { background: rgba(255, 150, 50, 0.2); color: #ffaa55; }
.tm-vowel-wooden, .tm-vowel-brown { background: rgba(160, 120, 80, 0.2); color: #cc9966; }
.tm-vowel-mustard, .tm-vowel-yellow { background: rgba(200, 180, 50, 0.2); color: #ccbb44; }
.tm-vowel-purple { background: rgba(150, 80, 200, 0.2); color: #bb88dd; }
.tm-vowel-gray, .tm-vowel-grey { background: rgba(160, 160, 180, 0.2); color: #aaaacc; }
.tm-vowel-white { background: rgba(255, 255, 255, 0.15); color: #eeeeff; }
.tm-vowel-brown-cow, .tm-vowel-gold { background: rgba(180, 140, 60, 0.2); color: #ccaa55; }
.tm-vowel-toy, .tm-vowel-teal { background: rgba(0, 180, 160, 0.2); color: #44ccbb; }
.tm-vowel-go, .tm-vowel-boat { background: rgba(255, 100, 150, 0.2); color: #ff88aa; }

/* --- Action Buttons --- */

.tm-actions {
  display: flex;
  gap: 6px;
  padding: 8px 16px 12px;
  border-top: 1px solid #2a2a4a;
  flex-shrink: 0;
}

.tm-action-btn {
  flex: 1;
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
}

.tm-action-btn:hover {
  background: #3a3a5a;
}

.tm-action-btn.tm-primary {
  background: #00d4aa;
  border-color: #00d4aa;
  color: #1a1a2e;
  font-weight: 600;
}

.tm-action-btn.tm-primary:hover {
  background: #00eabb;
}

/* --- Toast --- */

.tm-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: #1a1a2e;
  border: 1px solid #00d4aa;
  color: #e0e0e0;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 2147483647;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.tm-toast.tm-visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* --- States --- */

.tm-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #888;
  font-size: 13px;
}

.tm-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #2a2a4a;
  border-top-color: #00d4aa;
  border-radius: 50%;
  animation: tm-spin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes tm-spin {
  to { transform: rotate(360deg); }
}

.tm-error {
  background: rgba(255, 80, 80, 0.1);
  border: 1px solid rgba(255, 80, 80, 0.3);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  color: #ff8888;
  font-size: 13px;
}

.tm-error-retry {
  background: none;
  border: 1px solid #ff8888;
  color: #ff8888;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 8px;
}

.tm-error-retry:hover {
  background: rgba(255, 80, 80, 0.1);
}

.tm-setup-card {
  text-align: center;
  padding: 24px 16px;
}

.tm-setup-card p {
  color: #888;
  margin: 0 0 12px;
  font-size: 13px;
}

.tm-setup-btn {
  background: #00d4aa;
  color: #1a1a2e;
  border: none;
  border-radius: 6px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tm-setup-btn:hover {
  background: #00eabb;
}

/* --- Perfect message --- */

.tm-perfect {
  text-align: center;
  padding: 20px;
  color: #00d4aa;
  font-size: 14px;
}

/* --- Empty tab --- */

.tm-empty-tab {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 13px;
}

/* --- Scrollbar --- */

.tm-result-area::-webkit-scrollbar {
  width: 6px;
}

.tm-result-area::-webkit-scrollbar-track {
  background: transparent;
}

.tm-result-area::-webkit-scrollbar-thumb {
  background: #2a2a4a;
  border-radius: 3px;
}

.tm-result-area::-webkit-scrollbar-thumb:hover {
  background: #3a3a5a;
}
```

- [ ] **Step 2: Commit**

```bash
git add panel.css
git commit -m "feat: add dark theme panel CSS with Color Vowel styles"
```

---

### Task 7: Panel Rendering Engine

**Files:**
- Create: `core/panel.js`

- [ ] **Step 1: Create core/panel.js**

The panel rendering engine builds the UI from coach configs and output schemas. It manages the Shadow DOM, tabs, results, and actions.

```js
// core/panel.js
// Panel rendering engine — builds UI from coach outputSchema

export class Panel {
  constructor({ coaches, onAnalyze, onApply, panelPosition }) {
    this.coaches = coaches;
    this.onAnalyze = onAnalyze;
    this.onApply = onApply;
    this.panelPosition = panelPosition || 'anchored';
    this.activeCoachId = coaches[0]?.id || null;
    this.activeTabKey = null;
    this.resultData = null;
    this.isVisible = false;
    this.sourceElement = null;

    this.host = document.createElement('div');
    this.host.id = 'thinkmate-root';
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    document.body.appendChild(this.host);

    this._injectStyles();
    this._buildTrigger();
    this._buildPanel();
  }

  _injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('panel.css');
    this.shadow.appendChild(link);
  }

  // --- Trigger Button ---

  _buildTrigger() {
    this.trigger = document.createElement('button');
    this.trigger.className = 'tm-trigger';
    this.trigger.innerHTML = '<span class="tm-trigger-icon">T</span>';
    this.trigger.style.display = 'none';
    this.trigger.addEventListener('click', () => this.toggle());
    this.shadow.appendChild(this.trigger);
  }

  showTrigger(rect) {
    if (this.panelPosition === 'toolbar') return;
    this.trigger.style.display = 'flex';
    this.trigger.style.top = `${rect.top + window.scrollY - 40}px`;
    this.trigger.style.left = `${rect.right + window.scrollX + 8}px`;

    // Keep within viewport
    const triggerRect = this.trigger.getBoundingClientRect();
    if (triggerRect.right > window.innerWidth) {
      this.trigger.style.left = `${rect.left + window.scrollX - 44}px`;
    }
    if (triggerRect.top < 0) {
      this.trigger.style.top = `${rect.bottom + window.scrollY + 4}px`;
    }
  }

  hideTrigger() {
    this.trigger.style.display = 'none';
  }

  // --- Panel ---

  _buildPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'tm-panel';
    this.panel.innerHTML = this._panelHTML();
    this.shadow.appendChild(this.panel);

    // Event delegation
    this.panel.addEventListener('click', (e) => this._handleClick(e));
    this.panel.addEventListener('input', (e) => this._handleInput(e));

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.host.contains(e.target) && e.target !== this.host) {
        this.hide();
      }
    });
  }

  _panelHTML() {
    const coachTabs = this.coaches.map(c =>
      `<button class="tm-coach-tab ${c.id === this.activeCoachId ? 'tm-active' : ''}" data-coach-id="${c.id}">${c.icon} ${c.name}</button>`
    ).join('');

    return `
      <div class="tm-header">
        <span class="tm-brand">Thinkmate</span>
        <button class="tm-close" data-action="close">&times;</button>
      </div>
      <div class="tm-coach-tabs">${coachTabs}</div>
      <div class="tm-input-area">
        <textarea class="tm-textarea" placeholder="Type or paste text to analyze..." data-input="text"></textarea>
        <div class="tm-input-footer">
          <span class="tm-char-count" data-display="char-count">0 chars / 0 words</span>
          <button class="tm-analyze-btn" data-action="analyze">Analyze</button>
        </div>
      </div>
      <div class="tm-result-tabs" data-container="result-tabs" style="display:none;"></div>
      <div class="tm-result-area" data-container="result-area"></div>
      <div class="tm-actions" data-container="actions" style="display:none;">
        <button class="tm-action-btn" data-action="copy">Copy</button>
        <button class="tm-action-btn tm-primary" data-action="apply">Apply</button>
      </div>
    `;
  }

  // --- Show / Hide / Toggle ---

  show(sourceElement, text) {
    this.sourceElement = sourceElement;
    const textarea = this.panel.querySelector('[data-input="text"]');
    textarea.value = text || '';
    this._updateCharCount(text || '');
    this._clearResult();

    this._positionPanel();
    this.panel.classList.add('tm-visible');
    this.isVisible = true;
    textarea.focus();
  }

  hide() {
    this.panel.classList.remove('tm-visible');
    this.isVisible = false;
  }

  toggle(sourceElement, text) {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(sourceElement, text);
    }
  }

  _positionPanel() {
    if (this.panelPosition === 'fixed' || this.panelPosition === 'toolbar') {
      this.panel.style.bottom = '20px';
      this.panel.style.right = '20px';
      this.panel.style.top = 'auto';
      this.panel.style.left = 'auto';
    } else {
      // Anchored near trigger
      const triggerRect = this.trigger.getBoundingClientRect();
      let top = triggerRect.bottom + 8;
      let left = triggerRect.left - 200;

      // Keep in viewport
      if (left < 8) left = 8;
      if (left + 420 > window.innerWidth) left = window.innerWidth - 428;
      if (top + 520 > window.innerHeight) top = triggerRect.top - 528;

      this.panel.style.top = `${top}px`;
      this.panel.style.left = `${left}px`;
      this.panel.style.bottom = 'auto';
      this.panel.style.right = 'auto';
    }
  }

  // --- Event Handlers ---

  _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const coachId = e.target.closest('[data-coach-id]')?.dataset.coachId;
    const tabKey = e.target.closest('[data-tab-key]')?.dataset.tabKey;

    if (action === 'close') this.hide();
    if (action === 'analyze') this._analyze();
    if (action === 'copy') this._copy();
    if (action === 'apply') this._apply();
    if (action === 'retry') this._analyze();
    if (action === 'open-options') chrome.runtime.sendMessage({ type: 'open-options' });
    if (coachId) this._switchCoach(coachId);
    if (tabKey) this._switchResultTab(tabKey);
  }

  _handleInput(e) {
    if (e.target.matches('[data-input="text"]')) {
      this._updateCharCount(e.target.value);
    }
  }

  _updateCharCount(text) {
    const el = this.panel.querySelector('[data-display="char-count"]');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    el.textContent = `${text.length} chars / ${words} words`;
  }

  // --- Coach Switching ---

  _switchCoach(coachId) {
    this.activeCoachId = coachId;
    this.panel.querySelectorAll('.tm-coach-tab').forEach(tab => {
      tab.classList.toggle('tm-active', tab.dataset.coachId === coachId);
    });
    this._clearResult();
  }

  // --- Analysis ---

  async _analyze() {
    const text = this.panel.querySelector('[data-input="text"]').value.trim();
    if (!text) return;

    const coach = this.coaches.find(c => c.id === this.activeCoachId);
    if (!coach) return;

    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    resultArea.innerHTML = '<div class="tm-loading"><div class="tm-spinner"></div>Analyzing...</div>';
    this.panel.querySelector('[data-container="result-tabs"]').style.display = 'none';
    this.panel.querySelector('[data-container="actions"]').style.display = 'none';
    this.panel.querySelector('[data-action="analyze"]').disabled = true;

    try {
      const result = await this.onAnalyze(coach, text);
      this.resultData = result;
      this._renderResult(coach, result);
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        resultArea.innerHTML = `
          <div class="tm-setup-card">
            <p>Configure your AI provider to get started</p>
            <button class="tm-setup-btn" data-action="open-options">Open Settings</button>
          </div>`;
      } else {
        resultArea.innerHTML = `
          <div class="tm-error">
            ${this._escapeHtml(err.message)}
            <br><button class="tm-error-retry" data-action="retry">Retry</button>
          </div>`;
      }
    } finally {
      this.panel.querySelector('[data-action="analyze"]').disabled = false;
    }
  }

  // --- Result Rendering ---

  _renderResult(coach, data) {
    const tabs = coach.outputSchema.tabs;
    const tabsContainer = this.panel.querySelector('[data-container="result-tabs"]');
    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    const actionsContainer = this.panel.querySelector('[data-container="actions"]');

    // Check for is_perfect flag
    if (data.is_perfect) {
      tabsContainer.style.display = 'none';
      actionsContainer.style.display = 'none';
      resultArea.innerHTML = '<div class="tm-perfect">Your text is perfect! No corrections needed.</div>';
      return;
    }

    // Build result tabs
    const firstNonEmptyTab = tabs.find(t => {
      const val = data[t.key];
      return val && (!Array.isArray(val) || val.length > 0);
    });
    this.activeTabKey = firstNonEmptyTab?.key || tabs[0].key;

    tabsContainer.innerHTML = tabs.map(t => {
      const val = data[t.key];
      const isEmpty = !val || (Array.isArray(val) && val.length === 0);
      return `<button class="tm-result-tab ${t.key === this.activeTabKey ? 'tm-active' : ''}" data-tab-key="${t.key}" ${isEmpty ? 'style="opacity:0.4"' : ''}>${t.label}</button>`;
    }).join('');
    tabsContainer.style.display = 'flex';

    this._renderTabContent(coach, data);
    actionsContainer.style.display = 'flex';
  }

  _switchResultTab(tabKey) {
    this.activeTabKey = tabKey;
    this.panel.querySelectorAll('.tm-result-tab').forEach(tab => {
      tab.classList.toggle('tm-active', tab.dataset.tabKey === tabKey);
    });
    const coach = this.coaches.find(c => c.id === this.activeCoachId);
    if (coach && this.resultData) {
      this._renderTabContent(coach, this.resultData);
    }
  }

  _renderTabContent(coach, data) {
    const tab = coach.outputSchema.tabs.find(t => t.key === this.activeTabKey);
    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    const value = data[this.activeTabKey];

    if (!value || (Array.isArray(value) && value.length === 0)) {
      resultArea.innerHTML = '<div class="tm-empty-tab">Nothing to flag here!</div>';
      return;
    }

    switch (tab.type) {
      case 'text':
        resultArea.innerHTML = `<div class="tm-result-text">${this._escapeHtml(value)}</div>`;
        break;

      case 'list-of-cards':
        resultArea.innerHTML = value.map(item => this._renderCard(item, tab.fields)).join('');
        break;

      case 'pronunciation-cards':
        resultArea.innerHTML = value.map(item => this._renderPronunciationCard(item)).join('');
        break;

      case 'list':
        resultArea.innerHTML = value.map(item =>
          `<div class="tm-card"><div class="tm-card-value">${this._escapeHtml(item)}</div></div>`
        ).join('');
        break;

      default:
        resultArea.innerHTML = `<div class="tm-result-text">${this._escapeHtml(JSON.stringify(value, null, 2))}</div>`;
    }
  }

  _renderCard(item, fields) {
    const fieldLabels = {
      original: 'Original', fix: 'Fix', explanation: 'Why',
      suggestion: 'Suggestion', reason: 'Why',
      issue: 'Issue', counter: 'Counter', point: 'Point',
      pattern: 'Pattern', type: 'Type', insight: 'Insight'
    };

    return `<div class="tm-card">${fields.map(f => {
      const labelText = fieldLabels[f] || f;
      const valueClass = f === 'original' ? 'tm-card-original' : (f === 'fix' || f === 'suggestion') ? 'tm-card-fix' : '';
      return `<div class="tm-card-field">
        <div class="tm-card-label">${labelText}</div>
        <div class="tm-card-value ${valueClass}">${this._escapeHtml(item[f] || '')}</div>
      </div>`;
    }).join('')}</div>`;
  }

  _renderPronunciationCard(item) {
    const colorVowel = item.color_vowel || {};
    const colorClass = `tm-vowel-${(colorVowel.color || '').toLowerCase().split(' ')[0]}`;

    return `<div class="tm-card">
      <div class="tm-card-field">
        <div class="tm-card-label">Word</div>
        <div class="tm-card-value" style="font-size:16px;font-weight:600;">${this._escapeHtml(item.word || '')}</div>
      </div>
      <div class="tm-card-field">
        <div class="tm-card-label">IPA</div>
        <div class="tm-card-value">${this._escapeHtml(item.phonetic || '')} &mdash; stress: ${this._escapeHtml(item.stress || '')}</div>
      </div>
      <div class="tm-card-field">
        <div class="tm-card-label">Color Vowel</div>
        <div class="tm-card-value">
          <span class="tm-color-vowel-badge ${colorClass}">
            ${this._escapeHtml(colorVowel.keyword || '')} ${this._escapeHtml(colorVowel.sound || '')}
          </span>
        </div>
      </div>
      <div class="tm-card-field">
        <div class="tm-card-label">Tip</div>
        <div class="tm-card-value">${this._escapeHtml(item.tip || '')}</div>
      </div>
    </div>`;
  }

  // --- Actions ---

  async _copy() {
    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    const text = this.resultData?.corrected || resultArea.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      this._showToast('Copied to clipboard');
    } catch {
      this._showToast('Failed to copy');
    }
  }

  _apply() {
    const text = this.resultData?.corrected || this.resultData?.rewritten || '';
    if (!text || !this.sourceElement) {
      this._copy();
      return;
    }

    try {
      if (this.onApply) {
        this.onApply(this.sourceElement, text);
        this._showToast('Applied!');
      }
    } catch {
      navigator.clipboard.writeText(text).then(() => {
        this._showToast('Copied to clipboard instead');
      });
    }
  }

  _showToast(message) {
    let toast = this.shadow.querySelector('.tm-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'tm-toast';
      this.shadow.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('tm-visible');
    setTimeout(() => toast.classList.remove('tm-visible'), 2000);
  }

  // --- Utilities ---

  _clearResult() {
    this.resultData = null;
    this.activeTabKey = null;
    this.panel.querySelector('[data-container="result-tabs"]').style.display = 'none';
    this.panel.querySelector('[data-container="result-area"]').innerHTML = '';
    this.panel.querySelector('[data-container="actions"]').style.display = 'none';
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Update settings ---

  updateCoaches(coaches) {
    this.coaches = coaches;
    this.activeCoachId = coaches[0]?.id || null;
    const tabsContainer = this.panel.querySelector('.tm-coach-tabs');
    tabsContainer.innerHTML = coaches.map(c =>
      `<button class="tm-coach-tab ${c.id === this.activeCoachId ? 'tm-active' : ''}" data-coach-id="${c.id}">${c.icon} ${c.name}</button>`
    ).join('');
  }

  updatePosition(position) {
    this.panelPosition = position;
  }

  destroy() {
    this.host.remove();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add core/panel.js
git commit -m "feat: add panel rendering engine with tabs, cards, and Color Vowel"
```

---

### Task 8: Input Field Detector

**Files:**
- Create: `core/detector.js`

- [ ] **Step 1: Create core/detector.js**

Detects focus on input, textarea, and contenteditable elements. Shows the trigger button after 500ms debounce. Provides text extraction and text application methods.

```js
// core/detector.js
// Detects active input fields and manages trigger button positioning

export class Detector {
  constructor({ onActivate, onDeactivate }) {
    this.onActivate = onActivate;
    this.onDeactivate = onDeactivate;
    this.activeElement = null;
    this.debounceTimer = null;

    this._onFocusIn = this._onFocusIn.bind(this);
    this._onFocusOut = this._onFocusOut.bind(this);

    document.addEventListener('focusin', this._onFocusIn, true);
    document.addEventListener('focusout', this._onFocusOut, true);
  }

  _isTextInput(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email', 'tel'].includes(type);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  _onFocusIn(e) {
    const el = e.target;
    if (!this._isTextInput(el)) return;

    // Don't trigger on our own panel elements
    if (el.closest('#thinkmate-root')) return;

    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.activeElement = el;
      const rect = el.getBoundingClientRect();
      this.onActivate(el, rect);
    }, 500);
  }

  _onFocusOut(e) {
    clearTimeout(this.debounceTimer);

    // Small delay to avoid flicker when focus moves between elements
    setTimeout(() => {
      const active = document.activeElement;
      if (!this._isTextInput(active) || active.closest('#thinkmate-root')) {
        // Don't deactivate if focus moved to our panel
        if (!document.activeElement?.closest?.('#thinkmate-root')) {
          this.activeElement = null;
          this.onDeactivate();
        }
      }
    }, 200);
  }

  getText(el) {
    if (!el) return '';
    if (el.isContentEditable) {
      return el.innerText || el.textContent || '';
    }
    return el.value || '';
  }

  applyText(el, text) {
    if (!el) throw new Error('No element to apply to');

    if (el.isContentEditable) {
      el.focus();
      // Use execCommand for undo support where available
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);

      if (document.execCommand('insertText', false, text)) {
        return;
      }
      // Fallback
      el.textContent = text;
    } else {
      el.focus();
      el.value = text;
    }

    // Dispatch events so frameworks pick up the change
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  destroy() {
    clearTimeout(this.debounceTimer);
    document.removeEventListener('focusin', this._onFocusIn, true);
    document.removeEventListener('focusout', this._onFocusOut, true);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add core/detector.js
git commit -m "feat: add input field detector with text extraction and apply"
```

---

### Task 9: Content Script (Wires Everything Together)

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Implement content.js**

Replace the stub. This is the entry point that bootstraps the detector, panel, and connects to the background service worker. Note: content scripts cannot use ES modules in Manifest V3, so we use importScripts pattern or inline everything. Since the content script needs to import from `/core` and `/coaches`, we'll use a build-free approach by loading modules via dynamic import.

Actually, Manifest V3 content scripts don't support ES module imports directly. We need to restructure: content.js will load as a classic script, and we'll use `chrome.runtime.getURL` + dynamic `import()` to load the modules.

```js
// content.js
// Thinkmate content script — bootstraps detector + panel

(async () => {
  // Dynamic import of ES modules from extension
  const { Panel } = await import(chrome.runtime.getURL('core/panel.js'));
  const { Detector } = await import(chrome.runtime.getURL('core/detector.js'));
  const storageModule = await import(chrome.runtime.getURL('core/storage.js'));
  const coachesModule = await import(chrome.runtime.getURL('coaches/index.js'));

  // Load settings
  const settings = await storageModule.getAll();

  // Filter to enabled coaches only
  const enabledCoaches = coachesModule.coaches.filter(
    c => settings.coaches_enabled[c.id] ?? c.enabled
  );

  if (enabledCoaches.length === 0) return;

  // --- Panel setup ---
  const panel = new Panel({
    coaches: enabledCoaches,
    panelPosition: settings.panel_position,
    onAnalyze: async (coach, text) => {
      // Build system prompt with coach settings
      const coachSettings = settings.coach_settings[coach.id] || {};
      const systemPrompt = typeof coach.systemPrompt === 'function'
        ? coach.systemPrompt(coachSettings)
        : coach.systemPrompt;

      // Send to background for API call
      const response = await chrome.runtime.sendMessage({
        type: 'analyze',
        systemPrompt,
        userText: text
      });

      if (response.error) throw new Error(response.error);

      // Parse JSON response
      try {
        return JSON.parse(response.content);
      } catch {
        // Try to extract JSON from response if wrapped in markdown
        const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        throw new Error('Unexpected response format. Please retry.');
      }
    },
    onApply: (element, text) => {
      detector.applyText(element, text);
    }
  });

  // --- Detector setup ---
  const detector = new Detector({
    onActivate: (el, rect) => {
      panel.showTrigger(rect);
      // Store reference so panel can grab text on open
      panel.sourceElement = el;
    },
    onDeactivate: () => {
      if (!panel.isVisible) {
        panel.hideTrigger();
      }
    }
  });

  // Override panel toggle to grab text from active element
  const originalToggle = panel.toggle.bind(panel);
  panel.toggle = () => {
    const el = detector.activeElement;
    const text = el ? detector.getText(el) : '';
    if (panel.isVisible) {
      panel.hide();
    } else {
      panel.show(el, text);
    }
  };

  // --- Listen for toolbar icon click ---
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggle-panel') {
      const el = detector.activeElement || document.activeElement;
      const text = detector.getText(el);
      if (panel.isVisible) {
        panel.hide();
      } else {
        panel.show(el, text);
      }
    }
  });

  // --- Listen for settings changes ---
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.coaches_enabled || changes.coach_settings) {
      storageModule.getAll().then(newSettings => {
        const newEnabled = coachesModule.coaches.filter(
          c => (newSettings.coaches_enabled[c.id] ?? c.enabled)
        );
        panel.updateCoaches(newEnabled);
      });
    }
    if (changes.panel_position) {
      panel.updatePosition(changes.panel_position.newValue);
    }
  });
})();
```

- [ ] **Step 2: Update manifest.json for dynamic imports**

Content scripts using dynamic `import()` need the module files to be listed as `web_accessible_resources`:

Add to `manifest.json`:

```json
"web_accessible_resources": [
  {
    "resources": [
      "core/panel.js",
      "core/detector.js",
      "core/storage.js",
      "core/api.js",
      "coaches/index.js",
      "coaches/english-coach.js",
      "coaches/clarity-coach.js",
      "coaches/decision-coach.js",
      "coaches/debate-coach.js",
      "coaches/stoic-coach.js",
      "coaches/scrum-coach.js",
      "coaches/systems-thinking-coach.js",
      "coaches/tone-rewriter.js",
      "coaches/translator-coach.js",
      "coaches/custom-coach.js",
      "panel.css"
    ],
    "matches": ["<all_urls>"]
  }
]
```

- [ ] **Step 3: Verify end-to-end**

1. Reload extension at `chrome://extensions/`
2. Open any webpage (e.g., Google)
3. Click in the search input field
4. After 500ms, the Thinkmate trigger button (teal "T") should appear near the input
5. Click trigger — panel should open with text from input auto-captured
6. Panel should show "Thinkmate" header, English Coach tab, text area, Analyze button
7. Close panel (click X or outside) — panel should animate out

Expected: Panel renders, no console errors. Analysis won't work yet until API key is configured (should show "Configure your AI provider" card).

- [ ] **Step 4: Commit**

```bash
git add content.js manifest.json
git commit -m "feat: implement content script wiring detector, panel, and coaches"
```

---

### Task 10: Options Page

**Files:**
- Create: `options.html`
- Create: `options.js`

- [ ] **Step 1: Create options.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Thinkmate — Settings</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f23;
      color: #e0e0e0;
      padding: 40px;
      max-width: 640px;
      margin: 0 auto;
      line-height: 1.5;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
    }

    .header h1 {
      font-size: 28px;
      color: #00d4aa;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .header p {
      color: #888;
      font-size: 14px;
      margin-top: 4px;
    }

    .section {
      background: #1a1a2e;
      border: 1px solid #2a2a4a;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .section h2 {
      font-size: 16px;
      font-weight: 600;
      color: #00d4aa;
      margin-bottom: 16px;
    }

    .field {
      margin-bottom: 16px;
    }

    .field:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-size: 13px;
      color: #aaa;
      margin-bottom: 6px;
    }

    select, input[type="text"], input[type="password"] {
      width: 100%;
      padding: 10px 12px;
      background: #0f0f23;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }

    select:focus, input:focus {
      border-color: #00d4aa;
    }

    .help-link {
      display: inline-block;
      margin-top: 6px;
      font-size: 12px;
      color: #00d4aa;
      text-decoration: none;
    }

    .help-link:hover {
      text-decoration: underline;
    }

    .coach-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .coach-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #0f0f23;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
    }

    .coach-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .coach-icon {
      font-size: 20px;
    }

    .coach-name {
      font-size: 14px;
      font-weight: 500;
    }

    .coach-desc {
      font-size: 11px;
      color: #888;
    }

    .toggle {
      position: relative;
      width: 40px;
      height: 22px;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #2a2a4a;
      border-radius: 22px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      left: 3px;
      bottom: 3px;
      background: #888;
      border-radius: 50%;
      transition: transform 0.2s ease, background 0.2s ease;
    }

    .toggle input:checked + .toggle-slider {
      background: rgba(0, 212, 170, 0.3);
    }

    .toggle input:checked + .toggle-slider::before {
      transform: translateX(18px);
      background: #00d4aa;
    }

    .coach-settings {
      padding: 12px;
      margin-top: 8px;
      background: #0f0f23;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      display: none;
    }

    .coach-settings.visible {
      display: block;
    }

    .coach-settings .field {
      margin-bottom: 12px;
    }

    .status-msg {
      text-align: center;
      font-size: 13px;
      color: #00d4aa;
      padding: 8px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .status-msg.visible {
      opacity: 1;
    }

    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Thinkmate</h1>
    <p>Your thinking partner</p>
  </div>

  <!-- Provider Section -->
  <div class="section">
    <h2>AI Provider</h2>

    <div class="field">
      <label for="provider">Provider</label>
      <select id="provider">
        <option value="gemini">Gemini</option>
        <option value="openrouter">OpenRouter</option>
        <option value="ollama">Ollama (Local)</option>
      </select>
    </div>

    <!-- Gemini fields -->
    <div id="gemini-fields">
      <div class="field">
        <label for="gemini-key">API Key</label>
        <input type="password" id="gemini-key" placeholder="Enter your Gemini API key">
        <a class="help-link" href="https://aistudio.google.com/apikey" target="_blank">Get a free API key from Google AI Studio</a>
      </div>
      <div class="field">
        <label for="gemini-model">Model</label>
        <select id="gemini-model"></select>
      </div>
    </div>

    <!-- OpenRouter fields -->
    <div id="openrouter-fields" class="hidden">
      <div class="field">
        <label for="openrouter-key">API Key</label>
        <input type="password" id="openrouter-key" placeholder="Enter your OpenRouter API key">
        <a class="help-link" href="https://openrouter.ai/keys" target="_blank">Get an API key from OpenRouter</a>
      </div>
      <div class="field">
        <label for="openrouter-model">Model</label>
        <select id="openrouter-model">
          <option value="">Enter API key to load models...</option>
        </select>
      </div>
    </div>

    <!-- Ollama fields -->
    <div id="ollama-fields" class="hidden">
      <div class="field">
        <label for="ollama-url">Base URL</label>
        <input type="text" id="ollama-url" placeholder="http://localhost:11434">
      </div>
      <div class="field">
        <label for="ollama-model">Model</label>
        <select id="ollama-model">
          <option value="">Click to load models...</option>
        </select>
      </div>
    </div>
  </div>

  <!-- UI Preferences -->
  <div class="section">
    <h2>UI Preferences</h2>
    <div class="field">
      <label for="panel-position">Panel Position</label>
      <select id="panel-position">
        <option value="anchored">Anchored (near input field)</option>
        <option value="fixed">Fixed Corner (bottom-right)</option>
        <option value="toolbar">Toolbar (click extension icon)</option>
      </select>
    </div>
  </div>

  <!-- Coaches -->
  <div class="section">
    <h2>Coaches</h2>
    <div id="coach-list" class="coach-list"></div>
  </div>

  <div class="status-msg" id="status-msg">Settings saved</div>

  <script src="options.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: Create options.js**

```js
// options.js
// Thinkmate options page logic

import * as storage from './core/storage.js';
import coaches from './coaches/index.js';

// --- DOM References ---
const providerSelect = document.getElementById('provider');
const geminiFields = document.getElementById('gemini-fields');
const openrouterFields = document.getElementById('openrouter-fields');
const ollamaFields = document.getElementById('ollama-fields');
const geminiKey = document.getElementById('gemini-key');
const geminiModel = document.getElementById('gemini-model');
const openrouterKey = document.getElementById('openrouter-key');
const openrouterModel = document.getElementById('openrouter-model');
const ollamaUrl = document.getElementById('ollama-url');
const ollamaModel = document.getElementById('ollama-model');
const panelPosition = document.getElementById('panel-position');
const coachList = document.getElementById('coach-list');
const statusMsg = document.getElementById('status-msg');

let currentSettings = {};

// --- Initialize ---
async function init() {
  currentSettings = await storage.getAll();

  providerSelect.value = currentSettings.provider;
  geminiKey.value = currentSettings.gemini_api_key;
  openrouterKey.value = currentSettings.openrouter_api_key;
  ollamaUrl.value = currentSettings.ollama_base_url;
  panelPosition.value = currentSettings.panel_position;

  showProviderFields(currentSettings.provider);
  loadModels(currentSettings.provider);
  renderCoachList();
}

// --- Provider Fields ---
function showProviderFields(provider) {
  geminiFields.classList.toggle('hidden', provider !== 'gemini');
  openrouterFields.classList.toggle('hidden', provider !== 'openrouter');
  ollamaFields.classList.toggle('hidden', provider !== 'ollama');
}

providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value;
  showProviderFields(provider);
  save({ provider });
  loadModels(provider);
});

// --- Model Loading ---
async function loadModels(provider) {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'fetch-models', provider });
    if (response.error) throw new Error(response.error);

    const models = response.models || [];

    switch (provider) {
      case 'gemini':
        populateSelect(geminiModel, models, currentSettings.gemini_model);
        break;
      case 'openrouter':
        populateSelect(openrouterModel, models, currentSettings.openrouter_model, m => `${m.name} (${m.pricing || 'Free'})`);
        break;
      case 'ollama':
        populateSelect(ollamaModel, models, currentSettings.ollama_model);
        break;
    }
  } catch (err) {
    console.error('Failed to load models:', err);
  }
}

function populateSelect(select, models, currentValue, labelFn) {
  select.innerHTML = '';
  if (models.length === 0) {
    select.innerHTML = '<option value="">No models available</option>';
    return;
  }
  models.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = labelFn ? labelFn(m) : m.name;
    if (m.id === currentValue) option.selected = true;
    select.appendChild(option);
  });
}

// --- Save Handlers ---
function save(obj) {
  storage.set(obj);
  Object.assign(currentSettings, obj);
  showStatus();
}

function showStatus() {
  statusMsg.classList.add('visible');
  setTimeout(() => statusMsg.classList.remove('visible'), 1500);
}

geminiKey.addEventListener('change', () => save({ gemini_api_key: geminiKey.value }));
geminiModel.addEventListener('change', () => save({ gemini_model: geminiModel.value }));
openrouterKey.addEventListener('change', () => {
  save({ openrouter_api_key: openrouterKey.value });
  // Clear model cache and reload
  storage.set({ openrouter_models_cache: null, openrouter_models_cache_time: 0 });
  loadModels('openrouter');
});
openrouterModel.addEventListener('change', () => save({ openrouter_model: openrouterModel.value }));
ollamaUrl.addEventListener('change', () => {
  save({ ollama_base_url: ollamaUrl.value });
  loadModels('ollama');
});
ollamaModel.addEventListener('change', () => save({ ollama_model: ollamaModel.value }));
panelPosition.addEventListener('change', () => save({ panel_position: panelPosition.value }));

// --- Coach List ---
function renderCoachList() {
  coachList.innerHTML = '';

  coaches.forEach(coach => {
    const enabled = currentSettings.coaches_enabled[coach.id] ?? coach.enabled;

    const item = document.createElement('div');
    item.innerHTML = `
      <div class="coach-item">
        <div class="coach-info">
          <span class="coach-icon">${coach.icon}</span>
          <div>
            <div class="coach-name">${coach.name}</div>
            <div class="coach-desc">${coach.description}</div>
          </div>
        </div>
        <label class="toggle">
          <input type="checkbox" data-coach-toggle="${coach.id}" ${enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;

    // Coach-specific settings
    if (coach.settings && Object.keys(coach.settings).length > 0) {
      const settingsDiv = document.createElement('div');
      settingsDiv.className = `coach-settings ${enabled ? 'visible' : ''}`;
      settingsDiv.dataset.coachSettings = coach.id;

      Object.entries(coach.settings).forEach(([key, config]) => {
        const currentVal = currentSettings.coach_settings[coach.id]?.[key] ?? config.default;
        const field = document.createElement('div');
        field.className = 'field';

        if (config.type === 'select') {
          field.innerHTML = `
            <label>${config.label}</label>
            <select data-coach-setting="${coach.id}:${key}">
              ${config.options.map(opt => `<option value="${opt}" ${opt === currentVal ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          `;
        } else if (config.type === 'text') {
          field.innerHTML = `
            <label>${config.label}</label>
            <input type="text" data-coach-setting="${coach.id}:${key}" value="${currentVal || ''}">
          `;
        }

        settingsDiv.appendChild(field);
      });

      item.appendChild(settingsDiv);
    }

    coachList.appendChild(item);
  });

  // Event listeners for coach toggles
  coachList.addEventListener('change', (e) => {
    const toggleId = e.target.dataset.coachToggle;
    if (toggleId) {
      storage.setCoachEnabled(toggleId, e.target.checked);
      currentSettings.coaches_enabled[toggleId] = e.target.checked;

      // Show/hide coach settings
      const settingsDiv = coachList.querySelector(`[data-coach-settings="${toggleId}"]`);
      if (settingsDiv) {
        settingsDiv.classList.toggle('visible', e.target.checked);
      }
      showStatus();
    }

    const settingKey = e.target.dataset.coachSetting;
    if (settingKey) {
      const [coachId, key] = settingKey.split(':');
      storage.setCoachSetting(coachId, key, e.target.value);
      showStatus();
    }
  });
}

// --- Init ---
init();
```

- [ ] **Step 3: Verify options page**

1. Right-click the Thinkmate extension icon → "Options" (or go to `chrome://extensions/` → Thinkmate → Details → Extension options)
2. Verify: dark themed page with "Thinkmate" header
3. Provider selector should show Gemini/OpenRouter/Ollama
4. Switching providers should show/hide the correct fields
5. Coach list should show English Coach (ON) and all stubs (OFF)
6. Toggling English Coach should show/hide its settings (IELTS Target, English Variant)
7. Changing a setting should show "Settings saved" toast

- [ ] **Step 4: Commit**

```bash
git add options.html options.js
git commit -m "feat: implement options page with provider config and coach management"
```

---

### Task 11: End-to-End Testing with Gemini

**Files:** None (manual testing)

- [ ] **Step 1: Configure Gemini API key**

1. Go to https://aistudio.google.com/apikey and get a free API key
2. Open Thinkmate options page
3. Select Gemini provider
4. Paste API key
5. Select "gemini-2.0-flash" model

- [ ] **Step 2: Test on a real page**

1. Go to https://www.google.com
2. Click in the search box
3. Type: "I goes to the store yesterday and buyed some stuffs"
4. Wait for trigger button to appear (500ms)
5. Click trigger button
6. Verify: text is auto-captured in panel text area
7. Verify: word/char count is shown
8. Click "Analyze"
9. Verify: loading spinner appears
10. Verify: results load with tabs (Corrected, Grammar, Vocabulary, Pronunciation, Practice)
11. Click through each tab — verify content renders correctly
12. On Pronunciation tab: verify Color Vowel badges render with colors
13. Click "Copy" — verify clipboard contains corrected text
14. Click "Apply" — verify text is written back to search box

- [ ] **Step 3: Test error states**

1. Remove API key from options
2. Click Analyze — verify "Configure your AI provider" card appears
3. Enter an invalid API key
4. Click Analyze — verify error message with retry button appears

- [ ] **Step 4: Test on WhatsApp Web / Gmail**

1. Open WhatsApp Web (web.whatsapp.com) or Gmail
2. Click in a message input (contenteditable)
3. Verify trigger button appears
4. Verify text capture works from contenteditable
5. Verify Apply writes text back to contenteditable

- [ ] **Step 5: Test panel positions**

1. Options → change panel position to "Fixed corner"
2. Verify panel opens in bottom-right
3. Change to "Toolbar" mode
4. Click extension icon in toolbar
5. Verify panel opens as popover

- [ ] **Step 6: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: resolve issues found during end-to-end testing"
```

---

### Task 12: Handle background.js open-options message

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Add open-options handler**

The panel sends `{ type: 'open-options' }` when user clicks "Open Settings" in the setup card. Add this handler to `background.js` inside the `handleMessage` function:

Add this case to the switch in `handleMessage`:

```js
    case 'open-options':
      chrome.runtime.openOptionsPage();
      return { ok: true };
```

- [ ] **Step 2: Commit**

```bash
git add background.js
git commit -m "fix: add open-options message handler to background.js"
```
