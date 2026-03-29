# Thinkmate

Your thinking partner — AI coaching layer for any website.

Thinkmate coaches the thinking behind your words, not just grammar. Works on WhatsApp, Gmail, LinkedIn, Twitter, Notion, and any website with text inputs.

## Install

### Chrome Web Store (pending review)
Coming soon.

### Manual Install (immediate)
1. [Download thinkmate-chrome.zip](dist/thinkmate-chrome.zip)
2. Unzip to a folder
3. Open `chrome://extensions/`
4. Enable **Developer mode** (top-right)
5. Click **Load unpacked** and select the unzipped folder

## Features

- **Plugin coaches** — English, Clarity, Debate, Stoic, Tone Rewriter, Translator, and more
- **Works everywhere** — any text input or selected text on any website
- **Bring your own AI** — Gemini (free), Groq (fast), OpenRouter (100+ models), Ollama (local/private)
- **Quick correct** — keyboard shortcut to instantly correct text without opening the panel
- **Select & analyze** — select any text on a page, right-click or click the floating button
- **Per-coach model** — choose different AI models for different coaches
- **Draggable panel** — move the coaching panel anywhere on the page
- **Memory & personalization** — learns your patterns and tailors coaching (opt-in)
- **Cloud sync** — optional Supabase integration for cross-device memory
- **Private by design** — no servers, your messages go directly to your AI provider

## AI Providers

| Provider | Speed | Cost | Privacy |
|----------|-------|------|---------|
| [Gemini](https://aistudio.google.com/apikey) | Fast | Free tier | Cloud |
| [Groq](https://console.groq.com/keys) | Very fast | Free tier | Cloud |
| [OpenRouter](https://openrouter.ai/keys) | Varies | Pay per use | Cloud |
| [Ollama](https://ollama.com) | Local | Free | Fully private |

## Keyboard Shortcuts

Set at `chrome://extensions/shortcuts`:
- **Open/close panel** — default: `Alt+Shift+T`
- **Quick correct** — default: `Alt+Shift+C`

## Privacy

Thinkmate has no servers. Your messages are sent directly to your chosen AI provider and never stored. [Full privacy policy](https://mgblackwater.github.io/Thinkmate/privacy.html).

## License

MIT
