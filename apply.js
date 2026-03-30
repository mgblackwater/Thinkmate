// apply.js — runs in the MAIN world (page context)

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-tm-apply') {
      const el = mutation.target;
      const text = el.getAttribute('data-tm-apply');
      if (!text) return;
      el.removeAttribute('data-tm-apply');

      // Focus and select all — try multiple methods
      el.focus();

      // Method 1: selectAllChildren (standard)
      const sel = window.getSelection();
      sel.selectAllChildren(el);

      // Method 2: if nothing selected, try range-based
      if (!sel.toString()) {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // Method 3: if still nothing, try execCommand selectAll
      if (!sel.toString()) {
        document.execCommand('selectAll', false, null);
      }

      console.log('[Thinkmate] Selected text:', JSON.stringify(sel.toString().substring(0, 30)));
      document.execCommand('insertText', false, text);
    }
  }
});

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['data-tm-apply'],
  subtree: true
});
