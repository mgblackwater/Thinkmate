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
      // Read fresh settings (user may have changed API key since page load)
      const freshSettings = await storageModule.getAll();
      const coachSettings = freshSettings.coach_settings[coach.id] || {};
      const systemPrompt = typeof coach.systemPrompt === 'function'
        ? coach.systemPrompt(coachSettings)
        : coach.systemPrompt;

      // Send to background for API call
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          type: 'analyze',
          systemPrompt,
          userText: text
        });
      } catch (err) {
        throw new Error('Failed to reach Thinkmate. Try reloading the page.');
      }

      if (!response) throw new Error('No response from Thinkmate. Try reloading the page.');
      if (response.error) throw new Error(response.error);
      if (!response.content) throw new Error('Empty response from AI provider.');

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

  // Hook trigger click to grab text + caret position from active element
  function openPanel() {
    const el = detector.activeElement;
    const text = el ? detector.getText(el) : '';
    const caretRect = el ? detector.getCaretRect(el) : null;
    if (panel.isVisible) {
      panel.hide();
    } else {
      panel.show(el, text, caretRect);
    }
  }
  panel._onTriggerClick = openPanel;

  // --- Listen for toolbar icon click ---
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
