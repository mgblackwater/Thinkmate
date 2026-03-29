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

  // Current domain for session context
  const currentDomain = window.location.hostname;

  // Filter to enabled coaches only
  const enabledCoaches = coachesModule.coaches.filter(
    c => settings.coaches_enabled[c.id] ?? c.enabled
  );

  if (enabledCoaches.length === 0) return;

  // --- Panel setup ---
  const panel = new Panel({
    coaches: enabledCoaches,
    panelPosition: settings.panel_position,
    onGetModelName: async (coachId) => {
      const s = await storageModule.getAll();
      const override = s.coach_settings[coachId]?.model_override;
      const modelStr = override || s.default_model || '';
      if (!modelStr) return '';
      const [provider, ...parts] = modelStr.split(':');
      const model = parts.join(':');
      return `${model} (${provider})`;
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
      const memEnabled = (await storageModule.get('memory_enabled')) === true;
      const contextPrefix = persEnabled ? await memoryModule.buildContextPrefix() : '';
      const systemPrompt = contextPrefix + basePrompt;

      // Build session history messages (requires memory to be on)
      const sessionMessages = memEnabled ? memoryModule.buildSessionMessages(currentDomain) : [];

      // Check for per-coach model override
      const modelOverride = freshSettings.coach_settings[coach.id]?.model_override || '';

      // Send to background for API call
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          type: 'analyze',
          systemPrompt,
          userText: text,
          sessionMessages,
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

      // Update memory if enabled (async, don't block UI)
      const memoryEnabled = (await storageModule.get('memory_enabled')) === true;
      if (memoryEnabled) {
        memoryModule.addSessionEntry(currentDomain, text, result);
        memoryModule.updateMemory({
          coachId: coach.id,
          domain: currentDomain,
          responseData: result
        }).catch(err => console.error('[Thinkmate] Memory update failed:', err));
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
      panel.show(null, message.text);
    }
  });

  // --- Floating ✨ on text selection ---
  let selectionTrigger = null;

  function createSelectionTrigger() {
    if (selectionTrigger) return;
    selectionTrigger = document.createElement('div');
    selectionTrigger.id = 'thinkmate-sel-trigger';
    selectionTrigger.innerHTML = '✨';
    selectionTrigger.style.cssText = 'position:fixed;z-index:2147483646;width:32px;height:32px;border-radius:50%;background:#fff;border:2px solid #6c63ff;display:none;align-items:center;justify-content:center;font-size:16px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.12);transition:transform 0.15s ease;';
    selectionTrigger.addEventListener('mouseenter', () => { selectionTrigger.style.transform = 'scale(1.1)'; });
    selectionTrigger.addEventListener('mouseleave', () => { selectionTrigger.style.transform = 'scale(1)'; });
    selectionTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text) {
        panel.show(null, text);
      }
      hideSelectionTrigger();
    });
    document.body.appendChild(selectionTrigger);
  }

  function showSelectionTrigger(rect) {
    createSelectionTrigger();
    selectionTrigger.style.display = 'flex';
    selectionTrigger.style.top = `${rect.top - 38}px`;
    selectionTrigger.style.left = `${rect.right + 4}px`;

    // Keep in viewport
    if (parseInt(selectionTrigger.style.top) < 4) {
      selectionTrigger.style.top = `${rect.bottom + 4}px`;
    }
    if (parseInt(selectionTrigger.style.left) + 32 > window.innerWidth) {
      selectionTrigger.style.left = `${rect.left - 36}px`;
    }
  }

  function hideSelectionTrigger() {
    if (selectionTrigger) selectionTrigger.style.display = 'none';
  }

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text && text.length > 1) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showSelectionTrigger(rect);
      } else {
        hideSelectionTrigger();
      }
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (selectionTrigger && e.target !== selectionTrigger) {
      hideSelectionTrigger();
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
