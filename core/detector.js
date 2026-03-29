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

  getCaretRect(el) {
    if (!el) return null;

    // For contenteditable, use selection API
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rects = range.getClientRects();
        if (rects.length > 0) {
          return rects[rects.length - 1];
        }
      }
    }

    // For input/textarea, approximate from element position
    // (no reliable way to get exact caret pixel position in standard inputs)
    return el.getBoundingClientRect();
  }

  applyText(el, text) {
    if (!el) throw new Error('No element to apply to');

    if (el.isContentEditable) {
      // Find the root contenteditable element
      let target = el;
      while (target.parentElement && target.parentElement.isContentEditable) {
        target = target.parentElement;
      }

      // Inject into page context — content script's execCommand
      // doesn't work on some React apps (WhatsApp)
      const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      const script = document.createElement('script');
      script.textContent = `(function(){
        var el = document.querySelector('[contenteditable="true"]:focus') || document.activeElement;
        if (!el) return;
        el.focus();
        window.getSelection().selectAllChildren(el);
        document.execCommand('insertText', false, '${escaped}');
      })()`;
      target.focus();
      document.head.appendChild(script);
      script.remove();
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
