// apply.js — runs in the MAIN world (page context)
// Listens for custom events from the content script to apply text

window.addEventListener('thinkmate-apply', (e) => {
  const { targetId, text } = e.detail;
  const el = document.querySelector(`[data-tm-apply="${targetId}"]`);
  if (!el) return;
  el.removeAttribute('data-tm-apply');
  el.focus();
  window.getSelection().selectAllChildren(el);
  document.execCommand('insertText', false, text);
});
