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

      // Select all existing content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);

      // Try execCommand first (best undo support)
      if (document.execCommand('insertText', false, text)) {
        this._dispatchInputEvents(el);
        return;
      }

      // Fallback: use DataTransfer to simulate paste (works on WhatsApp, Gmail, etc.)
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        });
        el.dispatchEvent(pasteEvent);

        // If paste was not handled by the app, fall back to direct manipulation
        if (!pasteEvent.defaultPrevented) {
          el.textContent = text;
        }
      } catch {
        // Last resort: direct text replacement
        el.textContent = text;
      }

      this._dispatchInputEvents(el);
    } else {
      el.focus();

      // Use native setter to bypass React/framework wrappers
      const nativeSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(el), 'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }

      this._dispatchInputEvents(el);
    }
  }

  _dispatchInputEvents(el) {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  destroy() {
    clearTimeout(this.debounceTimer);
    document.removeEventListener('focusin', this._onFocusIn, true);
    document.removeEventListener('focusout', this._onFocusOut, true);
  }
}
