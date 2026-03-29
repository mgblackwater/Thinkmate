// core/panel.js
// Panel rendering engine — builds UI from coach outputSchema

export class Panel {
  constructor({ coaches, onAnalyze, onApply, panelPosition }) {
    this.coaches = coaches;
    this.onAnalyze = onAnalyze;
    this.onApply = onApply;
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
    this.trigger.innerHTML = '<span class="tm-trigger-icon">T</span>';
    this.trigger.style.display = 'none';
    this.trigger.addEventListener('click', () => this.toggle());
    this.shadow.appendChild(this.trigger);
  }

  showTrigger(rect) {
    if (this.panelPosition === 'toolbar') return;
    this.trigger.style.display = 'flex';
    this.trigger.style.top = `${rect.top + window.scrollY - 40}px`;
    this.trigger.style.left = `${rect.right + window.scrollX + 8}px`;

    // Keep within viewport
    const triggerRect = this.trigger.getBoundingClientRect();
    if (triggerRect.right > window.innerWidth) {
      this.trigger.style.left = `${rect.left + window.scrollX - 44}px`;
    }
    if (triggerRect.top < 0) {
      this.trigger.style.top = `${rect.bottom + window.scrollY + 4}px`;
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
      <div class="tm-result-tabs" data-container="result-tabs" style="display:none;"></div>
      <div class="tm-result-area" data-container="result-area"></div>
      <div class="tm-actions" data-container="actions" style="display:none;">
        <button class="tm-action-btn" data-action="copy">Copy</button>
        <button class="tm-action-btn tm-primary" data-action="apply">Apply</button>
      </div>
    `;
  }

  // --- Show / Hide / Toggle ---

  show(sourceElement, text) {
    this.sourceElement = sourceElement;
    const textarea = this.panel.querySelector('[data-input="text"]');
    textarea.value = text || '';
    this._updateCharCount(text || '');
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

  toggle(sourceElement, text) {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(sourceElement, text);
    }
  }

  _positionPanel() {
    if (this.panelPosition === 'fixed' || this.panelPosition === 'toolbar') {
      this.panel.style.bottom = '20px';
      this.panel.style.right = '20px';
      this.panel.style.top = 'auto';
      this.panel.style.left = 'auto';
    } else {
      // Anchored near trigger
      const triggerRect = this.trigger.getBoundingClientRect();
      let top = triggerRect.bottom + 8;
      let left = triggerRect.left - 200;

      // Keep in viewport
      if (left < 8) left = 8;
      if (left + 420 > window.innerWidth) left = window.innerWidth - 428;
      if (top + 520 > window.innerHeight) top = triggerRect.top - 528;

      this.panel.style.top = `${top}px`;
      this.panel.style.left = `${left}px`;
      this.panel.style.bottom = 'auto';
      this.panel.style.right = 'auto';
    }
  }

  // --- Event Handlers ---

  _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const coachId = e.target.closest('[data-coach-id]')?.dataset.coachId;
    const tabKey = e.target.closest('[data-tab-key]')?.dataset.tabKey;

    if (action === 'close') this.hide();
    if (action === 'analyze') this._analyze();
    if (action === 'copy') this._copy();
    if (action === 'apply') this._apply();
    if (action === 'retry') this._analyze();
    if (action === 'open-options') chrome.runtime.sendMessage({ type: 'open-options' });
    if (coachId) this._switchCoach(coachId);
    if (tabKey) this._switchResultTab(tabKey);
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

  // --- Coach Switching ---

  _switchCoach(coachId) {
    this.activeCoachId = coachId;
    this.panel.querySelectorAll('.tm-coach-tab').forEach(tab => {
      tab.classList.toggle('tm-active', tab.dataset.coachId === coachId);
    });
    this._clearResult();
  }

  // --- Analysis ---

  async _analyze() {
    const text = this.panel.querySelector('[data-input="text"]').value.trim();
    if (!text) return;

    const coach = this.coaches.find(c => c.id === this.activeCoachId);
    if (!coach) return;

    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    resultArea.innerHTML = '<div class="tm-loading"><div class="tm-spinner"></div>Analyzing...</div>';
    this.panel.querySelector('[data-container="result-tabs"]').style.display = 'none';
    this.panel.querySelector('[data-container="actions"]').style.display = 'none';
    this.panel.querySelector('[data-action="analyze"]').disabled = true;

    try {
      const result = await this.onAnalyze(coach, text);
      this.resultData = result;
      this._renderResult(coach, result);
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        resultArea.innerHTML = `
          <div class="tm-setup-card">
            <p>Configure your AI provider to get started</p>
            <button class="tm-setup-btn" data-action="open-options">Open Settings</button>
          </div>`;
      } else {
        resultArea.innerHTML = `
          <div class="tm-error">
            ${this._escapeHtml(err.message)}
            <br><button class="tm-error-retry" data-action="retry">Retry</button>
          </div>`;
      }
    } finally {
      this.panel.querySelector('[data-action="analyze"]').disabled = false;
    }
  }

  // --- Result Rendering ---

  _renderResult(coach, data) {
    const tabs = coach.outputSchema.tabs;
    const tabsContainer = this.panel.querySelector('[data-container="result-tabs"]');
    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    const actionsContainer = this.panel.querySelector('[data-container="actions"]');

    // Check for is_perfect flag
    if (data.is_perfect) {
      tabsContainer.style.display = 'none';
      actionsContainer.style.display = 'none';
      resultArea.innerHTML = '<div class="tm-perfect">Your text is perfect! No corrections needed.</div>';
      return;
    }

    // Build result tabs
    const firstNonEmptyTab = tabs.find(t => {
      const val = data[t.key];
      return val && (!Array.isArray(val) || val.length > 0);
    });
    this.activeTabKey = firstNonEmptyTab?.key || tabs[0].key;

    tabsContainer.innerHTML = tabs.map(t => {
      const val = data[t.key];
      const isEmpty = !val || (Array.isArray(val) && val.length === 0);
      return `<button class="tm-result-tab ${t.key === this.activeTabKey ? 'tm-active' : ''}" data-tab-key="${t.key}" ${isEmpty ? 'style="opacity:0.4"' : ''}>${t.label}</button>`;
    }).join('');
    tabsContainer.style.display = 'flex';

    this._renderTabContent(coach, data);
    actionsContainer.style.display = 'flex';
  }

  _switchResultTab(tabKey) {
    this.activeTabKey = tabKey;
    this.panel.querySelectorAll('.tm-result-tab').forEach(tab => {
      tab.classList.toggle('tm-active', tab.dataset.tabKey === tabKey);
    });
    const coach = this.coaches.find(c => c.id === this.activeCoachId);
    if (coach && this.resultData) {
      this._renderTabContent(coach, this.resultData);
    }
  }

  _renderTabContent(coach, data) {
    const tab = coach.outputSchema.tabs.find(t => t.key === this.activeTabKey);
    const resultArea = this.panel.querySelector('[data-container="result-area"]');
    const value = data[this.activeTabKey];

    if (!value || (Array.isArray(value) && value.length === 0)) {
      resultArea.innerHTML = '<div class="tm-empty-tab">Nothing to flag here!</div>';
      return;
    }

    switch (tab.type) {
      case 'text':
        resultArea.innerHTML = `<div class="tm-result-text">${this._escapeHtml(value)}</div>`;
        break;

      case 'list-of-cards':
        resultArea.innerHTML = value.map(item => this._renderCard(item, tab.fields)).join('');
        break;

      case 'pronunciation-cards':
        resultArea.innerHTML = value.map(item => this._renderPronunciationCard(item)).join('');
        break;

      case 'list':
        resultArea.innerHTML = value.map(item =>
          `<div class="tm-card"><div class="tm-card-value">${this._escapeHtml(item)}</div></div>`
        ).join('');
        break;

      default:
        resultArea.innerHTML = `<div class="tm-result-text">${this._escapeHtml(JSON.stringify(value, null, 2))}</div>`;
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
    this.activeTabKey = null;
    this.panel.querySelector('[data-container="result-tabs"]').style.display = 'none';
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
