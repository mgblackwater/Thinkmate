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
    const caretRect = el ? detector.getCaretRect(el) : null;
    if (panel.isVisible) {
      panel.hide();
    } else {
      panel.show(el, text, caretRect);
    }
  };

  // --- Listen for toolbar icon click ---
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggle-panel') {
      const el = detector.activeElement || document.activeElement;
      const text = detector.getText(el);
      const caretRect = detector.getCaretRect(el);
      if (panel.isVisible) {
        panel.hide();
      } else {
        panel.show(el, text, caretRect);
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
