// content.js
// Thinkmate content script — bootstraps detector + panel + memory

(async () => {
  // Dynamic import of ES modules from extension
  const { Panel } = await import(chrome.runtime.getURL('core/panel.js'));
  const { Detector } = await import(chrome.runtime.getURL('core/detector.js'));
  const storageModule = await import(chrome.runtime.getURL('core/storage.js'));
  const coachesModule = await import(chrome.runtime.getURL('coaches/index.js'));
  const memoryModule = await import(chrome.runtime.getURL('core/memory.js'));

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
    onGetSettings: async (coachId) => {
      const s = await storageModule.getAll();
      const coachSettings = s.coach_settings[coachId] || {};
      const currentModel = coachSettings.model_override || '';
      const defaultModel = s.default_model || '';
      // Parse default model name for display
      let modelName = '';
      if (defaultModel) {
        const [p, ...parts] = defaultModel.split(':');
        modelName = parts.join(':');
      }
      // Fetch all available models
      let models = [];
      try {
        const resp = await chrome.runtime.sendMessage({ type: 'fetch-models', provider: 'all' });
        models = resp.models || [];
      } catch { /* ignore */ }
      return { coachSettings, modelName, models, currentModel };
    },
    onSaveSetting: async (coachId, key, value) => {
      await storageModule.setCoachSetting(coachId, key, value);
    },
    onAnalyze: async (coach, text) => {
      // Read fresh settings
      const freshSettings = await storageModule.getAll();
      const coachSettings = freshSettings.coach_settings[coach.id] || {};
      const basePrompt = typeof coach.systemPrompt === 'function'
        ? coach.systemPrompt(coachSettings)
        : coach.systemPrompt;

      // Inject personalization context if enabled
      const persEnabled = (await storageModule.get('personalization_enabled')) === true;
      const contextPrefix = persEnabled ? await memoryModule.buildContextPrefix() : '';
      const systemPrompt = contextPrefix + basePrompt;

      // Check for per-coach model override
      const modelOverride = freshSettings.coach_settings[coach.id]?.model_override || '';

      // Send to background for API call
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          type: 'analyze',
          systemPrompt,
          userText: text,
          modelOverride
        });
      } catch (err) {
        throw new Error('Failed to reach Thinkmate. Try reloading the page.');
      }

      if (!response) throw new Error('No response from Thinkmate. Try reloading the page.');
      if (response.error) throw new Error(response.error);
      if (!response.content) throw new Error('Empty response from AI provider.');

      // Parse JSON response
      let result;
      try {
        result = JSON.parse(response.content);
      } catch {
        const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Unexpected response format. Please retry.');
        }
      }

      return result;
    },
    onApply: (element, text) => {
      detector.applyText(element, text);
    }
  });

  // --- Detector setup ---
  const detector = new Detector({
    onActivate: (el, elRect) => {
      panel.showTrigger(elRect);
      panel.sourceElement = el;
    },
    onDeactivate: () => {
      if (!panel.isVisible) {
        panel.hideTrigger();
      }
    }
  });

  // Hook trigger click to grab text from active or last-known element
  function openPanel() {
    const el = detector.activeElement || panel.sourceElement;
    const text = el ? detector.getText(el) : '';
    if (panel.isVisible) {
      panel.hide();
    } else {
      panel.show(el, text);
    }
  }
  panel._onTriggerClick = openPanel;

  // --- Listen for messages from background ---
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggle-panel') {
      openPanel();
    }
    if (message.type === 'analyze-selection' && message.text) {
      panel.show(null, message.text, lastSelectionRect);
    }
    if (message.type === 'quick-correct') {
      quickCorrect();
    }
  });

  // --- Quick-correct toast ---
  let quickToast = null;
  function showQuickToast(msg) {
    if (!quickToast) {
      quickToast = document.createElement('div');
      quickToast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#fff;border:1px solid #6c63ff;color:#2d3748;padding:8px 16px;border-radius:8px;font-size:13px;font-family:sans-serif;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,0.1);transition:opacity 0.3s;';
      document.body.appendChild(quickToast);
    }
    quickToast.textContent = msg;
    quickToast.style.opacity = '1';
    clearTimeout(quickToast._timer);
    quickToast._timer = setTimeout(() => { quickToast.style.opacity = '0'; }, 2500);
  }

  // --- Quick-correct: grab text, run configured coach, replace ---
  async function quickCorrect() {
    const el = detector.activeElement || document.activeElement;
    if (!el) return;
    const text = detector.getText(el);
    if (!text || text.trim().length < 2) return;

    // Show toast feedback
    showQuickToast('Correcting...');

    try {
      const freshSettings = await storageModule.getAll();
      const coachId = freshSettings.quick_correct_coach || 'english-coach';
      const coach = coachesModule.coaches.find(c => c.id === coachId);
      if (!coach) { showQuickToast('Coach not found'); return; }

      const coachSettings = freshSettings.coach_settings[coachId] || {};
      const basePrompt = typeof coach.systemPrompt === 'function'
        ? coach.systemPrompt(coachSettings) : coach.systemPrompt;

      const persEnabled = freshSettings.personalization_enabled === true;
      const contextPrefix = persEnabled ? await memoryModule.buildContextPrefix() : '';
      const systemPrompt = contextPrefix + basePrompt;
      const modelOverride = freshSettings.coach_settings[coachId]?.model_override || '';

      const response = await chrome.runtime.sendMessage({
        type: 'analyze',
        systemPrompt,
        userText: text,
        modelOverride
      });

      if (!response) { showQuickToast('No response. Try reloading.'); return; }
      if (response.error) { showQuickToast(response.error); return; }
      if (!response.content) { showQuickToast('Empty response'); return; }

      let result;
      try {
        result = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) result = JSON.parse(match[1]);
        else { showQuickToast('Bad response format'); return; }
      }

      // Replace text with corrected/rewritten version
      const replacement = result.corrected || result.rephrased || result.rewritten || result.translated;
      if (replacement && replacement !== text) {
        detector.applyText(el, replacement);
        showQuickToast('Corrected!');
      } else {
        showQuickToast('Already perfect!');
      }
    } catch (err) {
      console.error('[Thinkmate] Quick-correct failed:', err);
      showQuickToast('Failed: ' + (err.message || 'unknown error'));
    }
  }

  // --- Floating ✨ on text selection ---
  let lastSelectionRect = null;
  let lastSelectionRange = null;
  const selTrigger = document.createElement('div');
  selTrigger.id = 'thinkmate-sel-trigger';
  selTrigger.innerHTML = '✨';
  Object.assign(selTrigger.style, {
    position: 'fixed', zIndex: '2147483646',
    width: '32px', height: '32px', borderRadius: '50%',
    background: '#fff', border: '2px solid #6c63ff',
    display: 'none', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
  });

  selTrigger.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent losing selection
    e.stopPropagation();
  });

  selTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (text) {
      try {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        panel.show(null, text, rect);
      } catch {
        panel.show(null, text);
      }
    }
    selTrigger.style.display = 'none';
  });

  document.body.appendChild(selTrigger);

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text && text.length > 2) {
        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0) {
            lastSelectionRect = rect;
            lastSelectionRange = range.cloneRange();
            selTrigger.style.display = 'flex';
            selTrigger.style.top = `${rect.top - 38}px`;
            selTrigger.style.left = `${rect.right + 4}px`;
            // Keep in viewport
            if (rect.top - 38 < 4) selTrigger.style.top = `${rect.bottom + 4}px`;
            if (rect.right + 36 > window.innerWidth) selTrigger.style.left = `${rect.left - 36}px`;
          }
        } catch { /* ignore */ }
      } else {
        selTrigger.style.display = 'none';
      }
    }, 50);
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target !== selTrigger && !selTrigger.contains(e.target)) {
      selTrigger.style.display = 'none';
    }
  });

  // --- Listen for settings changes ---
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.coaches_enabled) {
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
