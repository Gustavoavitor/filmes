// ============================================================
// CINEMATECA PESSOAL — Rating Component
// Sistema de estrelas com meias estrelas (0.5 a 5.0)
// ============================================================

class StarRating {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} options
   * @param {number}  options.value    - Initial value (default 0)
   * @param {boolean} options.readOnly - Read only mode (display only)
   * @param {Function} options.onChange - Callback when rating changes
   * @param {number}  options.size     - Star font size in px (default 24)
   */
  constructor(container, options = {}) {
    this.container = container;
    this.value = options.value || 0;
    this.readOnly = options.readOnly || false;
    this.onChange = options.onChange || null;
    this.size = options.size || 24;
    this.hoverValue = 0;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.container.className = `star-rating-widget ${this.readOnly ? 'readonly' : 'interactive'}`;
    this.container.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 2px;
      direction: ltr;
    `;

    if (!this.readOnly) {
      // Interactive: render from right to left for CSS sibling trick
      // Actually we'll use JS hover approach
      this._renderInteractive();
    } else {
      this._renderDisplay();
    }
  }

  _renderDisplay() {
    const stars = this._buildStarHTML(this.value);
    this.container.innerHTML = stars;
  }

  _renderInteractive() {
    this.starsEl = document.createElement('div');
    this.starsEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
    `;

    for (let i = 1; i <= 5; i++) {
      // Half star
      const halfBtn = this._createStarBtn(i - 0.5);
      // Full star
      const fullBtn = this._createStarBtn(i);
      this.starsEl.appendChild(halfBtn);
      this.starsEl.appendChild(fullBtn);
    }

    this.container.appendChild(this.starsEl);
    this._updateDisplay();
  }

  _createStarBtn(val) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.value = val;
    const isHalf = val % 1 !== 0;

    btn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-size: ${this.size}px;
      line-height: 1;
      position: relative;
      width: ${isHalf ? this.size / 2 : this.size}px;
      overflow: hidden;
      text-align: ${isHalf ? 'left' : 'right'};
      color: var(--parchment, #E8DEC8);
      transition: transform 0.1s ease, color 0.15s ease;
    `;

    btn.innerHTML = '★';

    btn.addEventListener('mouseenter', () => {
      this.hoverValue = val;
      this._updateDisplay();
    });

    btn.addEventListener('mouseleave', () => {
      this.hoverValue = 0;
      this._updateDisplay();
    });

    btn.addEventListener('click', () => {
      this.value = val;
      this.hoverValue = 0;
      this._updateDisplay();
      if (this.onChange) this.onChange(val);
    });

    return btn;
  }

  _updateDisplay() {
    if (!this.starsEl) return;
    const displayVal = this.hoverValue || this.value;
    const btns = this.starsEl.querySelectorAll('button');

    btns.forEach(btn => {
      const btnVal = parseFloat(btn.dataset.value);
      const isHalf = btnVal % 1 !== 0;
      const starNum = Math.ceil(btnVal);

      let filled = false;
      if (isHalf) {
        // Half star button: fill if displayVal >= this half value
        filled = displayVal >= btnVal;
      } else {
        // Full star button: fill if displayVal >= full value
        filled = displayVal >= btnVal;
      }

      btn.style.color = filled
        ? 'var(--gold, #C8A050)'
        : 'var(--parchment, #E8DEC8)';

      if (filled) {
        btn.style.textShadow = '0 0 6px rgba(200,160,80,0.6)';
      } else {
        btn.style.textShadow = 'none';
      }

      // Scale effect on hover
      if (this.hoverValue && btnVal <= this.hoverValue) {
        btn.style.transform = 'scale(1.15)';
      } else {
        btn.style.transform = 'scale(1)';
      }
    });
  }

  setValue(val) {
    this.value = val;
    if (this.readOnly) {
      this._renderDisplay();
    } else {
      this._updateDisplay();
    }
  }

  getValue() {
    return this.value;
  }

  // Build static star HTML for display
  _buildStarHTML(val) {
    let html = '<span style="display:inline-flex;align-items:center;gap:2px;color:var(--gold,#C8A050);font-size:' + this.size + 'px">';
    for (let i = 1; i <= 5; i++) {
      if (val >= i) {
        html += '<span>★</span>';
      } else if (val >= i - 0.5) {
        // Half star using clip
        html += `<span style="position:relative;display:inline-block;">
          <span style="color:var(--parchment,#E8DEC8)">★</span>
          <span style="position:absolute;left:0;top:0;overflow:hidden;width:50%;color:var(--gold,#C8A050)">★</span>
        </span>`;
      } else {
        html += '<span style="color:var(--parchment,#E8DEC8)">★</span>';
      }
    }
    html += '</span>';
    return html;
  }
}

// ============================================================
// Helper: render a static star display
// ============================================================
function renderStars(container, value, size = 20) {
  const rating = new StarRating(container, { value, readOnly: true, size });
}

// Export
window.StarRating = StarRating;
window.renderStars = renderStars;
