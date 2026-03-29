# ✨ Thinkmate

Your thinking partner — AI coaching layer for any website.

Thinkmate coaches the thinking behind your words, not just grammar. Works on WhatsApp, Gmail, LinkedIn, Twitter, Notion, and any website.

**[Landing Page](https://mgblackwater.github.io/Thinkmate/)** · **[Privacy Policy](https://mgblackwater.github.io/Thinkmate/privacy.html)** · **[Chrome Web Store](https://chrome.google.com/webstore)** (pending review)

## Install

### Chrome Web Store (pending review)
Coming soon — submitted for review.

### Manual Install (immediate)
1. Download [`thinkmate-chrome.zip`](dist/thinkmate-chrome.zip)
2. Unzip to a folder
3. Open `chrome://extensions/`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the unzipped folder
6. Open Thinkmate settings — configure an AI provider (Gemini recommended — free)

## Features

### Coaching
- **9 plugin coaches** — English, Clarity, Decision, Debate, Stoic, Scrum, Systems Thinking, Tone Rewriter, Translator
- **English Coach** — grammar, vocabulary, pronunciation with Color Vowel approach, IELTS level targeting
- **Translator** — 28+ languages with dropdown + custom language support
- **Inline coach settings** — change target language, IELTS level, tone directly in the panel

### How to Trigger
- **Input fields** — ✨ button appears near any text input when you start typing
- **Text selection** — select any text on any page, ✨ button appears nearby
- **Right-click** — select text → right-click → "Analyze with Thinkmate"
- **Keyboard shortcut** — set at `chrome://extensions/shortcuts`
- **Quick Correct** — keyboard shortcut to instantly correct text without opening the panel (configurable coach)
- **Toolbar icon** — click the Thinkmate icon in Chrome toolbar

### AI Providers
Configure multiple providers simultaneously. Pick the best model per coach.

| Provider | Speed | Cost | Privacy | Get Key |
|----------|-------|------|---------|---------|
| Gemini | Fast | Free tier | Cloud | [aistudio.google.com](https://aistudio.google.com/apikey) |
| Groq | Very fast | Free tier | Cloud | [console.groq.com](https://console.groq.com/keys) |
| OpenRouter | Varies | Pay per use | Cloud | [openrouter.ai](https://openrouter.ai/keys) |
| Ollama | Local | Free | Fully private | [ollama.com](https://ollama.com) |

### Panel
- **Scrollable sections** — all coaching results in one scrollable view with anchor navigation
- **Per-coach model selector** — choose a different AI model for each coach
- **Draggable** — grab the header to reposition anywhere
- **Copy & Apply** — copy results or apply corrected text directly to the input field
- **Light theme** — clean, modern UI that works on any website
- **Shadow DOM** — never conflicts with page styles

### Personalization & Memory (opt-in)
All off by default. Enable in settings:
- **Personalization** — provide your profile (name, goals, native language) to tailor coaching
- **Memory** — learns your recurring mistakes and tracks progress
  - Local storage with 90-day rolling window
  - Optional cloud sync via your own Supabase project
- **Insights** — view your weak areas, strong areas, coach usage, and site usage

### Privacy
- **No servers** — Thinkmate has zero backend infrastructure
- **Direct to provider** — your text goes straight to your configured AI provider
- **Nothing stored** — only settings and coaching patterns (if memory is enabled)
- **Open source** — full transparency, audit the code yourself

## Keyboard Shortcuts

Set your preferred shortcuts at `chrome://extensions/shortcuts`:

| Action | Suggested Key |
|--------|--------------|
| Open/close panel | `Alt+Shift+T` |
| Quick correct | `Alt+Shift+C` |

Quick Correct coach is configurable in Settings → Preferences.

## Tech Stack

- Vanilla JS — no frameworks, no build step
- Chrome Extension Manifest V3
- Shadow DOM for CSS isolation
- `chrome.storage.sync` for settings (cross-device)
- `chrome.storage.local` for memory data
- `declarativeNetRequest` for Ollama CORS handling

## File Structure

```
thinkmate/
  manifest.json
  background.js          — service worker: API routing, shortcuts, context menu
  content.js             — content script: detector, panel, selection trigger
  panel.css              — panel styles (injected in Shadow DOM)
  options.html/js        — settings page
  rules.json             — declarativeNetRequest rules for Ollama
  /coaches
    index.js             — coach registry
    english-coach.js     — fully implemented
    clarity-coach.js     — stub
    ...8 more coach stubs
  /core
    api.js               — Gemini, Groq, OpenRouter, Ollama clients
    panel.js             — panel rendering engine
    detector.js          — input field detection + text apply
    storage.js           — chrome.storage wrapper
    memory.js            — personalization + auto-learning
    sync.js              — Supabase cloud sync
  /icons
    icon16/48/128.png
```

## Contributing

Open source under MIT. Issues and PRs welcome at [github.com/mgblackwater/Thinkmate](https://github.com/mgblackwater/Thinkmate).

## License

MIT
