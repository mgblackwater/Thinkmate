// core/api.js
// Provider-agnostic API client — called from background.js only

export async function callProvider({ provider, apiKey, baseUrl, model, systemPrompt, userText, sessionMessages }) {
  switch (provider) {
    case 'gemini':
      return callGemini({ apiKey, model, systemPrompt, userText, sessionMessages });
    case 'openrouter':
      return callOpenRouter({ apiKey, model, systemPrompt, userText, sessionMessages });
    case 'ollama':
      return callOllama({ baseUrl, model, systemPrompt, userText, sessionMessages });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// --- Gemini ---

async function callGemini({ apiKey, model, systemPrompt, userText, sessionMessages }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build contents with session history
  const contents = [];
  if (sessionMessages && sessionMessages.length > 0) {
    for (const msg of sessionMessages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
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

async function callOpenRouter({ apiKey, model, systemPrompt, userText, sessionMessages }) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const messages = [{ role: 'system', content: systemPrompt }];
  if (sessionMessages && sessionMessages.length > 0) {
    messages.push(...sessionMessages);
  }
  messages.push({ role: 'user', content: userText });

  const body = { model, messages };

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

async function callOllama({ baseUrl, model, systemPrompt, userText, sessionMessages }) {
  const url = `${baseUrl}/api/chat`;

  const messages = [{ role: 'system', content: systemPrompt }];
  if (sessionMessages && sessionMessages.length > 0) {
    messages.push(...sessionMessages);
  }
  messages.push({ role: 'user', content: userText });

  const body = { model, messages, stream: false, format: 'json' };

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
    case 'gemini': {
      const fallback = [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
      ];
      if (!apiKey) return fallback;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) return fallback;
        const data = await res.json();
        const models = (data.models || [])
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', '')
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return models.length > 0 ? models : fallback;
      } catch {
        return fallback;
      }
    }

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
