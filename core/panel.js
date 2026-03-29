// core/panel.js
// Panel rendering engine — builds UI from coach outputSchema

export class Panel {
  constructor({ coaches, onAnalyze, onApply, onGetModelName, panelPosition }) {
    this.coaches = coaches;
    this.onAnalyze = onAnalyze;
    this.onApply = onApply;
    this.onGetModelName = onGetModelName;
    this.panelPosition = panelPosition || 'anchored';
    this.activeCoachId = coaches[0]?.id || null;
    this.activeTabKey = null;
    this.resultData = null;
    this.isVisible = false;
    this.sourceElement = null;

    this.host = document.createElement('div');
    this.host.id = 'thinkmate-root';
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    document.body.appendChild(this.host);

    this._injectStyles();
    this._buildTrigger();
    this._buildPanel();
  }

  _injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('panel.css');
    this.shadow.appendChild(link);
  }

  // --- Trigger Button ---

  _buildTrigger() {
    this.trigger = document.createElement('button');
    this.trigger.className = 'tm-trigger';
    this.trigger.innerHTML = '<span class="tm-trigger-icon">✨</span>';
    this.trigger.style.display = 'none';
    // Use late binding so content.js can override toggle()
    this.trigger.addEventListener('click', () => {
      if (this._onTriggerClick) {
        this._onTriggerClick();
      } else {
        this.toggle();
      }
    });
    this.shadow.appendChild(this.trigger);
  }

  showTrigger(elRect) {
    if (this.panelPosition === 'toolbar') return;

    // Position just outside the top-right corner of the input field
    this.trigger.style.display = 'flex';
    this.trigger.style.top = `${elRect.top + window.scrollY - 40}px`;
    this.trigger.style.left = `${elRect.right + window.scrollX + 8}px`;

    // Keep within viewport
    const triggerBounds = this.trigger.getBoundingClientRect();
    if (triggerBounds.right > window.innerWidth) {
      this.trigger.style.left = `${window.innerWidth - 44}px`;
    }
    if (triggerBounds.top < 0) {
      this.trigger.style.top = `${elRect.bottom + window.scrollY + 4}px`;
    }
  }

  hideTrigger() {
    this.trigger.style.display = 'none';
  }

  // --- Panel ---

  _buildPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'tm-panel';
    this.panel.innerHTML = this._panelHTML();
    this.shadow.appendChild(this.panel);

    // Event delegation
    this.panel.addEventListener('click', (e) => this._handleClick(e));
    this.panel.addEventListener('input', (e) => this._handleInput(e));

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.host.contains(e.target) && e.target !== this.host) {
        this.hide();
      }
    });
  }

  _panelHTML() {
    const coachTabs = this.coaches.map(c =>
      `<button class="tm-coach-tab ${c.id === this.activeCoachId ? 'tm-active' : ''}" data-coach-id="${c.id}">${c.icon} ${c.name}</button>`
    ).join('');

    return `
      <div class="tm-header">
        <span class="tm-brand">Thinkmate</span>
        <span class="tm-model-label" data-display="model-name"></span>
        <button class="tm-close" data-action="close">&times;</button>
      </div>
      <div class="tm-coach-tabs">${coachTabs}</div>
      <div class="tm-input-area">
        <textarea class="tm-textarea" placeholder="Type or paste text to analyze..." data-input="text"></textarea>
        <div class="tm-input-footer">
          <span class="tm-char-count" data-display="char-count">0 chars / 0 words</span>
          <button class="tm-analyze-btn" data-action="analyze">Analyze</button>
        </div>
      </div>
      <div class="tm-section-nav" data-container="section-nav" style="display:none;"></div>
      <div class="tm-result-area" data-container="result-area"></div>
      <div class="tm-actions" data-container="actions" style="display:none;">
        <button class="tm-action-btn" data-action="copy">Copy</button>
        <button class="tm-action-btn tm-primary" data-action="apply">Apply</button>
      </div>
    `;
  }

  // --- Show / Hide / Toggle ---

  show(sourceElement, text, caretRect) {
    this.sourceElement = sourceElement;
    this.caretRect = caretRect || null;
    const textarea = this.panel.querySelector('[data-input="text"]');
    textarea.value = text || '';
    this._updateCharCount(text || '');
    this._updateModelLabel();
    this._clearResult();

    this._positionPanel();
    this.panel.classList.add('tm-visible');
    this.isVisible = true;
    textarea.focus();
  }

  hide() {
    this.panel.classList.remove('tm-visible');
    this.isVisible = false;
  }

  toggle(sourceElement, text, caretRect) {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(sourceElement, text, caretRect);
    }
  }

  _positionPanel() {
    const panelWidth = 520;
    const panelMaxHeight = 620;

    if (this.panelPosition === 'fixed' || this.panelPosition === 'toolbar') {
      this.panel.style.bottom = '20px';
      this.panel.style.right = '20px';
      this.panel.style.top = 'auto';
      this.panel.style.left = 'auto';
    } else {
      // Use trigger button as anchor
      const triggerRect = this.trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      // Horizontal: align right edge with trigger
      let left = triggerRect.right - panelWidth;
      if (left < 8) left = 8;
      if (left + panelWidth > window.innerWidth) left = window.innerWidth - panelWidth - 8;

      this.panel.style.left = `${left}px`;
      this.panel.style.right = 'auto';

      if (spaceBelow >= panelMaxHeight) {
        // Enough room below — place below trigger
        this.panel.style.top = `${triggerRect.bottom + 4}px`;
        this.panel.style.bottom = 'auto';
      } else {
        // Not enough below — anchor to bottom of trigger using CSS bottom
        const bottomOffset = window.innerHeight - triggerRect.top + 4;
        this.panel.style.bottom = `${bottomOffset}px`;
        this.panel.style.top = 'auto';
      }
    }
  }

  // --- Event Handlers ---

  _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const coachId = e.target.closest('[data-coach-id]')?.dataset.coachId;
    const anchorKey = e.target.closest('[data-anchor]')?.dataset.anchor;

    if (action === 'close') this.hide();
    if (action === 'analyze') this._analyze();
    if (action === 'copy') this._copy();
    if (action === 'apply') this._apply();
    if (action === 'retry') this._analyze();
    if (action === 'open-options') chrome.runtime.sendMessage({ type: 'open-options' });
    if (coachId) this._switchCoach(coachId);
    if (anchorKey) this._scrollToSection(anchorKey);
  }

  _handleInput(e) {
    if (e.target.matches('[data-input="text"]')) {
      this._updateCharCount(e.target.value);
    }
  }

  _updateCharCount(text) {
    const el = this.panel.querySelector('[data-display="char-count"]');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    el.textContent = `${text.length} chars / ${words} words`;
  }

  async _updateModelLabel() {
    const el = this.panel.querySelector('[data-display="model-name"]');
    if (!el || !this.onGetModelName) return;
    try {
      const name = await this.onGetModelName(this.activeCoachId);
      el.textContent = name || '';
    } catch {
      el.textContent = '';
    }
  }

  // --- Coach Switching ---

  _switchCoach(coachId) {
    this.activeCoachId = coachId;
    this.panel.querySelectorAll('.tm-coach-tab').forEach(tab => {
      tab.classList.toggle('tm-active', tab.dataset.coachId === coachId);
    });
    this._clearResult();
    this._updateModelLabel();
  }

  // --- Analysis ---

  async _analyze() {
    const text = this.panel.querySelector('[data-input="text"]').value.trim();
    if (!text) return;

    const coach = this.coaches.find(c => c.id === this.activeCoachId);
    if (!coach) return;

    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    resultArea.innerHTML = '<div class="tm-loading"><div class="tm-spinner"></div>Analyzing...</div>';
    this.panel.querySelector('[data-container="section-nav"]').style.display = 'none';
    this.panel.querySelector('[data-container="actions"]').style.display = 'none';
    this.panel.querySelector('[data-action="analyze"]').disabled = true;

    try {
      const result = await this.onAnalyze(coach, text);
      this.resultData = result;
      this._renderResult(coach, result);
    } catch (err) {
      console.error('[Thinkmate] Analysis error:', err);
      const msg = err?.message || String(err) || 'Unknown error';
      if (msg === 'NO_API_KEY' || msg === 'NO_MODEL') {
        resultArea.innerHTML = `
          <div class="tm-setup-card">
            <p>Configure your AI provider to get started</p>
            <button class="tm-setup-btn" data-action="open-options">Open Settings</button>
          </div>`;
      } else {
        resultArea.innerHTML = `
          <div class="tm-error">
            <div class="tm-error-title">Something went wrong</div>
            <div class="tm-error-detail">${this._escapeHtml(msg)}</div>
            <button class="tm-error-retry" data-action="retry">Retry</button>
            <button class="tm-error-retry" data-action="open-options" style="margin-left:6px;">Settings</button>
          </div>`;
      }
    } finally {
      this.panel.querySelector('[data-action="analyze"]').disabled = false;
    }
  }

  // --- Result Rendering (scrollable sections) ---

  _renderResult(coach, data) {
    const tabs = coach.outputSchema.tabs;
    const navContainer = this.panel.querySelector('[data-container="section-nav"]');
    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    const actionsContainer = this.panel.querySelector('[data-container="actions"]');

    // Check for is_perfect flag
    if (data.is_perfect) {
      navContainer.style.display = 'none';
      actionsContainer.style.display = 'none';
      resultArea.innerHTML = '<div class="tm-perfect">Your text is perfect! No corrections needed.</div>';
      return;
    }

    // Filter to non-empty sections
    const nonEmptyTabs = tabs.filter(t => {
      const val = data[t.key];
      return val && (!Array.isArray(val) || val.length > 0);
    });

    // Build anchor nav
    navContainer.innerHTML = nonEmptyTabs.map(t =>
      `<button class="tm-nav-link" data-anchor="${t.key}">${t.label}</button>`
    ).join('');
    navContainer.style.display = nonEmptyTabs.length > 1 ? 'flex' : 'none';

    // Build all sections as one scrollable page
    let sectionsHtml = '';
    for (const tab of tabs) {
      const value = data[tab.key];
      const isEmpty = !value || (Array.isArray(value) && value.length === 0);
      if (isEmpty) continue;

      sectionsHtml += `<div class="tm-section" id="tm-section-${tab.key}">`;
      sectionsHtml += `<div class="tm-section-header">${tab.label}</div>`;
      sectionsHtml += this._renderSectionContent(tab, value);
      sectionsHtml += `</div>`;
    }

    resultArea.innerHTML = sectionsHtml;
    actionsContainer.style.display = 'flex';
  }

  _scrollToSection(key) {
    const section = this.panel.querySelector(`#tm-section-${key}`);
    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    if (section && resultArea) {
      resultArea.scrollTo({
        top: section.offsetTop - resultArea.offsetTop,
        behavior: 'smooth'
      });
    }

    // Highlight active nav link
    this.panel.querySelectorAll('.tm-nav-link').forEach(link => {
      link.classList.toggle('tm-active', link.dataset.anchor === key);
    });
  }

  _renderSectionContent(tab, value) {
    switch (tab.type) {
      case 'text':
        return `<div class="tm-result-text">${this._escapeHtml(value)}</div>`;

      case 'list-of-cards':
        return value.map(item => this._renderCard(item, tab.fields)).join('');

      case 'pronunciation-cards':
        return value.map(item => this._renderPronunciationCard(item)).join('');

      case 'list':
        return value.map(item =>
          `<div class="tm-card"><div class="tm-card-value">${this._escapeHtml(item)}</div></div>`
        ).join('');

      default:
        return `<div class="tm-result-text">${this._escapeHtml(JSON.stringify(value, null, 2))}</div>`;
    }
  }

  _renderCard(item, fields) {
    const fieldLabels = {
      original: 'Original', fix: 'Fix', explanation: 'Why',
      suggestion: 'Suggestion', reason: 'Why',
      issue: 'Issue', counter: 'Counter', point: 'Point',
      pattern: 'Pattern', type: 'Type', insight: 'Insight'
    };

    return `<div class="tm-card">${fields.map(f => {
      const labelText = fieldLabels[f] || f;
      const valueClass = f === 'original' ? 'tm-card-original' : (f === 'fix' || f === 'suggestion') ? 'tm-card-fix' : '';
      return `<div class="tm-card-field">
        <div class="tm-card-label">${labelText}</div>
        <div class="tm-card-value ${valueClass}">${this._escapeHtml(item[f] || '')}</div>
      </div>`;
    }).join('')}</div>`;
  }

  _renderPronunciationCard(item) {
    const colorVowel = item.color_vowel || {};
    const colorClass = `tm-vowel-${(colorVowel.color || '').toLowerCase().split(' ')[0]}`;

    return `<div class="tm-card">
      <div class="tm-card-field">
        <div class="tm-card-label">Word</div>
        <div class="tm-card-value" style="font-size:16px;font-weight:600;">${this._escapeHtml(item.word || '')}</div>
      </div>
      <div class="tm-card-field">
        <div class="tm-card-label">IPA</div>
        <div class="tm-card-value">${this._escapeHtml(item.phonetic || '')} &mdash; stress: ${this._escapeHtml(item.stress || '')}</div>
      </div>
      <div class="tm-card-field">
        <div class="tm-card-label">Color Vowel</div>
        <div class="tm-card-value">
          <span class="tm-color-vowel-badge ${colorClass}">
            ${this._escapeHtml(colorVowel.keyword || '')} ${this._escapeHtml(colorVowel.sound || '')}
          </span>
        </div>
      </div>
      <div class="tm-card-field">
        <div class="tm-card-label">Tip</div>
        <div class="tm-card-value">${this._escapeHtml(item.tip || '')}</div>
      </div>
    </div>`;
  }

  // --- Actions ---

  async _copy() {
    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    const text = this.resultData?.corrected || resultArea.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      this._showToast('Copied to clipboard');
    } catch {
      this._showToast('Failed to copy');
    }
  }

  _apply() {
    const text = this.resultData?.corrected || this.resultData?.rewritten || '';
    if (!text || !this.sourceElement) {
      this._copy();
      return;
    }

    try {
      if (this.onApply) {
        this.onApply(this.sourceElement, text);
        this._showToast('Applied!');
      }
    } catch {
      navigator.clipboard.writeText(text).then(() => {
        this._showToast('Copied to clipboard instead');
      });
    }
  }

  _showToast(message) {
    let toast = this.shadow.querySelector('.tm-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'tm-toast';
      this.shadow.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('tm-visible');
    setTimeout(() => toast.classList.remove('tm-visible'), 2000);
  }

  // --- Utilities ---

  _clearResult() {
    this.resultData = null;
    this.panel.querySelector('[data-container="section-nav"]').style.display = 'none';
    this.panel.querySelector('[data-container="result-area"]').innerHTML = '';
    this.panel.querySelector('[data-container="actions"]').style.display = 'none';
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Update settings ---

  updateCoaches(coaches) {
    this.coaches = coaches;
    this.activeCoachId = coaches[0]?.id || null;
    const tabsContainer = this.panel.querySelector('.tm-coach-tabs');
    tabsContainer.innerHTML = coaches.map(c =>
      `<button class="tm-coach-tab ${c.id === this.activeCoachId ? 'tm-active' : ''}" data-coach-id="${c.id}">${c.icon} ${c.name}</button>`
    ).join('');
  }

  updatePosition(position) {
    this.panelPosition = position;
  }

  destroy() {
    this.host.remove();
  }
}
