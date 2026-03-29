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
    onAnalyze: async (coach, text) => {
      // Read fresh settings
      const freshSettings = await storageModule.getAll();
      const coachSettings = freshSettings.coach_settings[coach.id] || {};
      const basePrompt = typeof coach.systemPrompt === 'function'
        ? coach.systemPrompt(coachSettings)
        : coach.systemPrompt;

      // Inject memory context prefix
      const contextPrefix = await memoryModule.buildContextPrefix();
      const systemPrompt = contextPrefix + basePrompt;

      // Build session history messages
      const sessionMessages = memoryModule.buildSessionMessages(currentDomain);

      // Send to background for API call
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          type: 'analyze',
          systemPrompt,
          userText: text,
          sessionMessages
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

      // Update memory (async, don't block UI)
      memoryModule.addSessionEntry(currentDomain, text, result);
      memoryModule.updateMemory({
        coachId: coach.id,
        domain: currentDomain,
        responseData: result
      }).catch(err => console.error('[Thinkmate] Memory update failed:', err));

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

  // --- Listen for toolbar icon click / keyboard shortcut ---
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggle-panel') {
      openPanel();
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
