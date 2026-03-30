// apply.js — runs in the MAIN world (page context)
// Bridges the content script's isolated world to apply text
// Handles: standard contentEditable, React/Lexical editors (WhatsApp), inputs

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-tm-apply') {
      const el = mutation.target;
      const text = el.getAttribute('data-tm-apply');
      if (!text) return;
      el.removeAttribute('data-tm-apply');

      el.focus();
      const originalText = el.textContent;
      const sel = window.getSelection();

      // Method 1: execCommand (works on Windows and some Mac apps)
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.addRange(range);
      if (document.execCommand('insertText', false, text) && el.textContent !== originalText) return;

      // Method 2: Lexical editor — clear via API, then paste into empty field
      const editor = el.__lexicalEditor;
      if (editor) {
        try {
          // Clear content through Lexical's state API
          const stateJSON = editor.getEditorState().toJSON();
          stateJSON.root.children = [{
            children: [],
            direction: null,
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          }];
          editor.setEditorState(editor.parseEditorState(JSON.stringify(stateJSON)));
          editor.update(() => {});
        } catch (e) {
          // Fallback: try clearing via update with internal node access
          try {
            editor.update(() => {
              const root = (editor._pendingEditorState || editor._editorState)._nodeMap.get('root');
              const writable = root.getWritable();
              writable.clear();
              const PNode = editor._nodes.get('paragraph')?.klass;
              if (PNode) writable.append(new PNode());
            });
          } catch (_) { /* continue to paste anyway */ }
        }

        // Paste into the now-cleared field
        setTimeout(() => {
          el.focus();
          const dt = new DataTransfer();
          dt.setData('text/plain', text);
          el.dispatchEvent(new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          }));

          // Verify — if still wrong, copy to clipboard
          requestAnimationFrame(() => {
            if (el.textContent?.trim() === text.trim()) return;
            copyFallback(el, text);
          });
        }, 50);
        return;
      }

      // Method 3: DOM fallback for non-Lexical contentEditable
      while (el.firstChild) el.firstChild.remove();
      el.appendChild(document.createTextNode(text));
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  }
});

function copyFallback(el, text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(el, 'Copied — press ⌘V to paste');
  });
}

function showToast(el, msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#1a1a2e', color: '#fff', padding: '8px 16px', borderRadius: '8px',
    fontSize: '13px', fontFamily: 'system-ui, sans-serif', zIndex: '2147483647',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'opacity 0.3s',
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['data-tm-apply'],
  subtree: true
});
