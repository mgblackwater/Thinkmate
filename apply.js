// apply.js — runs in the MAIN world (page context)
// Watches for data-tm-apply attributes set by the content script
// and applies text using execCommand in the page's context

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-tm-apply') {
      const el = mutation.target;
      const text = el.getAttribute('data-tm-apply');
      if (!text) return;
      el.removeAttribute('data-tm-apply');
      el.focus();
      window.getSelection().selectAllChildren(el);
      document.execCommand('insertText', false, text);
    }
  }
});

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['data-tm-apply'],
  subtree: true
});
