import { TEAM_COLORS, MORALE_STATE, GAME_STATE } from '../constants.js';

export class BattleUISystem {
  constructor(game) {
    this.game        = game;
    this.el          = document.getElementById('battle-ui');
    this._selectedEl = document.getElementById('unit-detail');
    this._topBar     = document.getElementById('battle-topbar');
    this._roster     = document.getElementById('battle-roster');
    this._enemyPanel = document.getElementById('enemy-panel');
    this._endScreen  = document.getElementById('end-screen');
    this._lastRosterUpdate = 0;
  }

  show() { this.el.style.display = 'block'; }
  hide() { this.el.style.display = 'none'; }

  update() {
    this._updateTopBar();
    this._updateRoster();
    this._updateEnemyPanel();
    this._updateSelectedUnit();
  }

  _initTopBar() {
    const tb = this._topBar;
    if (!tb || tb.dataset.inited) return;
    tb.dataset.inited = '1';
    tb.innerHTML = `
      <div class="tb-morale"><span id="tb-strength" style="color:${TEAM_COLORS[0]}">● Army: 100%</span></div>
      <div id="tb-timer" class="tb-timer">0:00</div>
      <div class="tb-speeds">
        <button id="tb-pause" class="speed-btn" onclick="game.togglePause()">⏸</button>
        <button id="tb-s1"    class="speed-btn" onclick="game.setSpeed(1)">1×</button>
        <button id="tb-s2"    class="speed-btn" onclick="game.setSpeed(2)">2×</button>
        <button id="tb-s3"    class="speed-btn" onclick="game.setSpeed(3)">3×</button>
      </div>
    `;
  }

  _updateTopBar() {
    const g  = this.game;
    const tb = this._topBar;
    if (!tb) return;
    this._initTopBar();

    const totalPlayer = g.playerArmy.reduce((s, u) => s + u.maxCount, 0) || 1;
    const livePlayer  = g.playerArmy.reduce((s, u) => s + u.aliveCount, 0);
    const pct         = Math.round(livePlayer / totalPlayer * 100);

    const mins = Math.floor(g.battleTimer / 60);
    const secs = Math.floor(g.battleTimer % 60).toString().padStart(2, '0');

    const strEl = document.getElementById('tb-strength');
    const tmEl  = document.getElementById('tb-timer');
    if (strEl) strEl.textContent = `● Army: ${pct}%`;
    if (tmEl)  tmEl.textContent  = `${mins}:${secs}`;

    const setActive = (id, active) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', active);
    };
    setActive('tb-pause', g.paused);
    setActive('tb-s1',    !g.paused && g.gameSpeed === 1);
    setActive('tb-s2',    !g.paused && g.gameSpeed === 2);
    setActive('tb-s3',    !g.paused && g.gameSpeed === 3);
  }

  _updateRoster() {
    const now = performance.now();
    if (now - this._lastRosterUpdate < 100) return; // 10fps max
    this._lastRosterUpdate = now;
    const el = this._roster;
    if (!el) return;
    el.innerHTML = '';
    for (const unit of this.game.playerArmy) {
      const div = document.createElement('div');
      div.className = 'roster-unit' +
        (this.game.selectedUnits.includes(unit) ? ' selected' : '') +
        (unit.isShattered ? ' shattered' : '');
      const moraleW = Math.round(unit.morale / unit.maxMorale * 100);
      const stateLabel = unit.moraleState.charAt(0).toUpperCase() + unit.moraleState.slice(1);
      div.innerHTML = `
        <div class="ru-name">${unit.stats.name}</div>
        <div class="ru-count">${unit.aliveCount}/${unit.maxCount}</div>
        <div class="ru-morale-bg"><div class="ru-morale-fill" style="width:${moraleW}%;background:${_moraleBarColor(unit.moraleState)}"></div></div>
        <div class="ru-state" style="color:${_moraleTextColor(unit.moraleState)}">${stateLabel}</div>
      `;
      div.addEventListener('click', () => {
        this.game.selectedUnits = [unit];
        // Center camera on unit
        this.game.camera.centerOn(unit.x, unit.y);
      });
      el.appendChild(div);
    }
  }

  _updateEnemyPanel() {
    const el = this._enemyPanel;
    if (!el) return;
    const alive  = this.game.aiArmy.filter(u => !u.isShattered && !u.isDead);
    const total  = this.game.aiArmy.reduce((s, u) => s + u.maxCount, 0);
    const living = this.game.aiArmy.reduce((s, u) => s + u.aliveCount, 0);
    const pct    = total > 0 ? Math.round(living / total * 100) : 0;
    el.innerHTML = `
      <div style="color:#aaa;font-size:11px;margin-bottom:4px">ENEMY</div>
      <div style="color:${TEAM_COLORS[1]};font-size:13px">~${living} soldiers</div>
      <div style="font-size:11px;color:#888">Strength: ${pct}%</div>
      <div style="font-size:11px;color:#888">Units: ${alive.length} active</div>
    `;
  }

  _updateSelectedUnit() {
    const el = this._selectedEl;
    if (!el) return;
    const unit = this.game.selectedUnits[0];
    if (!unit) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const s = unit.stats;
    const moraleW = Math.round(unit.morale / unit.maxMorale * 100);
    el.innerHTML = `
      <div class="ud-title">${s.name}</div>
      <div class="ud-row"><span>Soldiers</span><span>${unit.aliveCount} / ${unit.maxCount}</span></div>
      <div class="ud-row"><span>Morale</span><span>${Math.round(unit.morale)} / ${unit.maxMorale}</span></div>
      <div class="ud-morale-bar"><div style="width:${moraleW}%;background:${_moraleBarColor(unit.moraleState)};height:100%"></div></div>
      <div class="ud-row"><span>Status</span><span style="color:${_moraleTextColor(unit.moraleState)}">${unit.moraleState}</span></div>
      <div class="ud-row"><span>Ammo</span><span>${unit.ammo}</span></div>
      <div class="ud-row"><span>Speed</span><span>${s.speed} m/s</span></div>
    `;
  }

  showEndScreen(result) {
    const el = this._endScreen;
    if (!el) return;
    el.style.display = 'flex';
    const titleColor = result.won ? '#ddaa00' : '#ff5533';
    el.innerHTML = `
      <div class="end-box">
        <h2 style="color:${titleColor}">${result.won ? 'VICTORY' : 'DEFEAT'}</h2>
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
    const el = this._endScreen;
    if (el) el.style.display = 'none';
  }
}

function _moraleBarColor(state) {
  switch (state) {
    case MORALE_STATE.STEADY:    return '#22bb44';
    case MORALE_STATE.WAVERING:  return '#ddaa00';
    case MORALE_STATE.ROUTING:   return '#dd4422';
    case MORALE_STATE.BROKEN:    return '#884422';
    case MORALE_STATE.SHATTERED: return '#444444';
    default: return '#22bb44';
  }
}

function _moraleTextColor(state) {
  switch (state) {
    case MORALE_STATE.STEADY:    return '#44cc66';
    case MORALE_STATE.WAVERING:  return '#ddaa00';
    case MORALE_STATE.ROUTING:   return '#ff6644';
    case MORALE_STATE.BROKEN:    return '#ff4422';
    case MORALE_STATE.SHATTERED: return '#888888';
    default: return '#44cc66';
  }
}

function _fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}
