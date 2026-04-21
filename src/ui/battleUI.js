import { TEAM_COLORS, MORALE_STATE, UNIT_STATS } from '../constants.js';

const CARD_W = 78;
const CARD_H = 96;

// Unit type abbreviation shown on card
const TYPE_LABEL = {
  militia:            'MIL',
  line_infantry:      'INF',
  grenadier:          'GRN',
  black_watch:        'HLG',
  prussian_grenadier: 'PGR',
  horse_gunner:       'HGN',
  sabre_cavalry:      'CAV',
  artillery:          'ART',
};

export class BattleUISystem {
  constructor(game) {
    this.game             = game;
    this.el               = document.getElementById('battle-ui');
    this._topBar          = document.getElementById('battle-topbar');
    this._cardBar         = document.getElementById('unit-card-bar');
    this._detailPanel     = document.getElementById('unit-detail');
    this._enemyPanel      = document.getElementById('enemy-panel');
    this._endScreen       = document.getElementById('end-screen');
    this._lastRosterUpdate = 0;
    this._topBarInited    = false;
  }

  show() { this.el.style.display = 'block'; }
  hide() { this.el.style.display = 'none'; }

  update() {
    this._updateTopBar();
    this._updateCardBar();
    this._updateDetailPanel();
    this._updateEnemyPanel();
  }

  // ── TOP BAR ──────────────────────────────────────────────────
  _initTopBar() {
    if (this._topBarInited) return;
    this._topBarInited = true;
    this._topBar.innerHTML = `
      <div id="tb-timer" class="tb-timer">0:00</div>
      <div class="tb-speeds">
        <button id="tb-pause" class="speed-btn active" onclick="game.togglePause()">⏸</button>
        <button id="tb-s1"    class="speed-btn"        onclick="game.setSpeed(1)">1×</button>
        <button id="tb-s2"    class="speed-btn"        onclick="game.setSpeed(2)">2×</button>
        <button id="tb-s3"    class="speed-btn"        onclick="game.setSpeed(3)">3×</button>
      </div>
    `;
  }

  _updateTopBar() {
    const g = this.game;
    this._initTopBar();
    const mins = Math.floor(g.battleTimer / 60);
    const secs = Math.floor(g.battleTimer % 60).toString().padStart(2, '0');
    const tmEl = document.getElementById('tb-timer');
    if (tmEl) tmEl.textContent = `${mins}:${secs}`;

    const setActive = (id, on) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', on);
    };
    setActive('tb-pause', g.paused);
    setActive('tb-s1',    !g.paused && g.gameSpeed === 1);
    setActive('tb-s2',    !g.paused && g.gameSpeed === 2);
    setActive('tb-s3',    !g.paused && g.gameSpeed === 3);
  }

  // ── BOTTOM CARD BAR ──────────────────────────────────────────
  _updateCardBar() {
    const now = performance.now();
    if (now - this._lastRosterUpdate < 80) return;
    this._lastRosterUpdate = now;

    const bar = this._cardBar;
    if (!bar) return;

    const units    = this.game.playerArmy;
    const selected = this.game.selectedUnits;

    // Build/update cards — reuse existing DOM nodes if count matches
    if (bar.children.length !== units.length) {
      bar.innerHTML = '';
      for (const u of units) bar.appendChild(this._makeCard(u));
    }

    // Update each card in place
    for (let i = 0; i < units.length; i++) {
      this._updateCard(bar.children[i], units[i], selected.includes(units[i]));
    }
  }

  _makeCard(unit) {
    const div = document.createElement('div');
    div.className = 'unit-card';
    div.innerHTML = `
      <div class="uc-type">${TYPE_LABEL[unit.type] || 'INF'}</div>
      <div class="uc-name">${unit.stats.name}</div>
      <div class="uc-count">200/200</div>
      <div class="uc-morale-bg"><div class="uc-morale-fill"></div></div>
      <div class="uc-state">Steady</div>
    `;
    div.addEventListener('click', () => {
      this.game.selectedUnits = [unit];
      this.game.camera.centerOn(unit.x, unit.y);
    });
    return div;
  }

  _updateCard(el, unit, isSelected) {
    if (!el) return;

    const pct      = unit.aliveCount / unit.maxCount;
    const moraleW  = Math.round(unit.morale / unit.maxMorale * 100);
    const state    = unit.moraleState;
    const color    = _moraleBarColor(state);
    const stateStr = state.charAt(0).toUpperCase() + state.slice(1);

    el.className = 'unit-card' +
      (isSelected       ? ' selected'  : '') +
      (unit.isShattered ? ' shattered' : '') +
      (state === 'routing' || state === 'broken' ? ' routing' : '');

    // Type badge background tinted by team color + morale
    const typeBadge = el.querySelector('.uc-type');
    if (typeBadge) typeBadge.textContent = TYPE_LABEL[unit.type] || 'INF';

    const countEl = el.querySelector('.uc-count');
    if (countEl) countEl.textContent = `${unit.aliveCount}/${unit.maxCount}`;

    const fillEl = el.querySelector('.uc-morale-fill');
    if (fillEl) { fillEl.style.width = moraleW + '%'; fillEl.style.background = color; }

    const stateEl = el.querySelector('.uc-state');
    if (stateEl) { stateEl.textContent = stateStr; stateEl.style.color = _moraleTextColor(state); }
  }

  // ── SELECTED UNIT DETAIL ─────────────────────────────────────
  _updateDetailPanel() {
    const el   = this._detailPanel;
    if (!el) return;
    const unit = this.game.selectedUnits[0];
    if (!unit) { el.style.display = 'none'; return; }
    el.style.display = 'block';

    const moraleW = Math.round(unit.morale / unit.maxMorale * 100);
    el.innerHTML = `
      <div class="ud-title">${unit.stats.name}</div>
      <div class="ud-row"><span>Soldiers</span><span>${unit.aliveCount} / ${unit.maxCount}</span></div>
      <div class="ud-row"><span>Morale</span><span>${Math.round(unit.morale)} / ${unit.maxMorale}</span></div>
      <div class="ud-bar"><div style="width:${moraleW}%;background:${_moraleBarColor(unit.moraleState)};height:100%"></div></div>
      <div class="ud-row"><span>Status</span><span style="color:${_moraleTextColor(unit.moraleState)}">${unit.moraleState}</span></div>
      <div class="ud-row"><span>Ammo</span><span>${unit.ammo}</span></div>
    `;
  }

  // ── ENEMY PANEL ───────────────────────────────────────────────
  _updateEnemyPanel() {
    const el = this._enemyPanel;
    if (!el) return;
    const living = this.game.aiArmy.reduce((s, u) => s + u.aliveCount, 0);
    const total  = this.game.aiArmy.reduce((s, u) => s + u.maxCount, 0) || 1;
    const alive  = this.game.aiArmy.filter(u => !u.isShattered && !u.isDead).length;
    const pct    = Math.round(living / total * 100);
    el.innerHTML = `
      <div class="ep-label">ENEMY</div>
      <div class="ep-strength" style="color:${TEAM_COLORS[1]}">~${living} men</div>
      <div class="ep-bar-bg"><div class="ep-bar-fill" style="width:${pct}%"></div></div>
      <div class="ep-units">${alive} units active</div>
    `;
  }

  // ── END SCREEN ────────────────────────────────────────────────
  showEndScreen(result) {
    const el = this._endScreen;
    if (!el || !result) return;
    el.style.display = 'flex';
    const col = result.won ? '#ddaa00' : '#ff5533';
    el.innerHTML = `
      <div class="end-box">
        <h2 style="color:${col}">${result.won ? 'VICTORY' : 'DEFEAT'}</h2>
        <p class="end-type">${result.type}</p>
        <div class="end-stats">
          <div>Enemy killed: <strong>${result.enemyKills}</strong></div>
          <div>Own losses: <strong>${result.ownLosses}</strong></div>
          <div>Duration: <strong>${_fmtTime(result.duration)}</strong></div>
        </div>
        <div class="end-btns">
          <button onclick="game.restartBattle()" class="end-btn">Restart Battle</button>
          <button onclick="game.returnToBuilder()" class="end-btn">Army Builder</button>
        </div>
      </div>
    `;
  }

  hideEndScreen() {
    if (this._endScreen) this._endScreen.style.display = 'none';
  }
}

function _moraleBarColor(state) {
  switch (state) {
    case MORALE_STATE.STEADY:    return '#22bb44';
    case MORALE_STATE.WAVERING:  return '#ddaa00';
    case MORALE_STATE.ROUTING:   return '#dd4422';
    case MORALE_STATE.BROKEN:    return '#884422';
    default:                     return '#444444';
  }
}

function _moraleTextColor(state) {
  switch (state) {
    case MORALE_STATE.STEADY:    return '#44ee66';
    case MORALE_STATE.WAVERING:  return '#ffcc00';
    case MORALE_STATE.ROUTING:   return '#ff6644';
    case MORALE_STATE.BROKEN:    return '#ff4422';
    default:                     return '#666666';
  }
}

function _fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}
