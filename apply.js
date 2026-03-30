// apply.js — runs in the MAIN world (page context)
// Bridges the content script's isolated world to apply text
// via execCommand in the page's JavaScript context

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-tm-apply') {
      const el = mutation.target;
      const text = el.getAttribute('data-tm-apply');
      if (!text) return;
      el.removeAttribute('data-tm-apply');

      el.focus();

      // Try multiple selection methods — different apps need different approaches
      const sel = window.getSelection();
      sel.selectAllChildren(el);

      if (!sel.toString()) {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      if (!sel.toString()) {
        document.execCommand('selectAll', false, null);
      }

      document.execCommand('insertText', false, text);
    }
  }
});

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['data-tm-apply'],
  subtree: true
});
