import {
  FACTION_DATA, FACTION_UNITS, UNIT_STATS, GAME_STATE,
  DEPLOY_ZONE_PLAYER, DEPLOY_ZONE_AI, TEAM_PLAYER, TEAM_AI,
} from '../constants.js';
import { Unit } from '../entities/unit.js';
import { MAPS, MAP_KEYS } from '../maps/maps.js';

export class ArmyBuilderUI {
  constructor(game) {
    this.game = game;
    this.el   = document.getElementById('army-builder');
    this._buildDOM();
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }

  _buildDOM() {
    this.el.innerHTML = `
      <div class="ab-header">
        <h1 class="ab-title">FLAG AND COMMAND</h1>
        <p class="ab-sub">Command the line</p>
      </div>
      <div class="ab-body">
        <div class="ab-col ab-left">
          <div class="ab-section-title">FACTION</div>
          <div id="ab-factions" class="ab-factions"></div>
          <div class="ab-section-title" style="margin-top:18px">ROSTER</div>
          <div id="ab-roster" class="ab-roster"></div>
        </div>
        <div class="ab-col ab-center">
          <div class="ab-section-title">YOUR ARMY <span id="ab-soldier-count">0 / 20</span></div>
          <div id="ab-army-list" class="ab-army-list"></div>
          <div class="ab-actions">
            <button id="ab-clear" class="ab-btn ab-btn-danger">Clear Army</button>
            <button id="ab-start" class="ab-btn ab-btn-primary">Start Battle →</button>
          </div>
        </div>
        <div class="ab-col ab-right">
          <div class="ab-section-title">MAP</div>
          <div id="ab-maps" class="ab-map-list"></div>
          <div class="ab-section-title" style="margin-top:18px">UNIT STATS</div>
          <div id="ab-stats" class="ab-stats-panel">
            <p style="color:#666;font-size:12px">Click a unit to see stats</p>
          </div>
        </div>
      </div>
    `;

    this._populateFactions();
    this._populateMaps();
    this._populateRoster();
    this._renderArmy();

    document.getElementById('ab-clear').addEventListener('click', () => {
      this.game.playerArmyDef = [];
      this._renderArmy();
    });

    document.getElementById('ab-start').addEventListener('click', () => this._startBattle());
  }

  _populateFactions() {
    const el = document.getElementById('ab-factions');
    el.innerHTML = '';
    for (const [key, data] of Object.entries(FACTION_DATA)) {
      const btn = document.createElement('button');
      btn.className = 'ab-faction-btn' + (this.game.playerFaction === key ? ' selected' : '');
      btn.textContent = data.name;
      btn.dataset.faction = key;
      btn.addEventListener('click', () => {
        this.game.playerFaction = key;
        this.game.aiFaction = this._pickEnemyFaction(key);
        document.querySelectorAll('.ab-faction-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.game.playerArmyDef = [];
        this._populateRoster();
        this._renderArmy();
      });
      el.appendChild(btn);
    }
  }

  _pickEnemyFaction(playerFaction) {
    const others = Object.keys(FACTION_DATA).filter(f => f !== playerFaction);
    return others[Math.floor(Math.random() * others.length)];
  }

  _populateRoster() {
    const el = document.getElementById('ab-roster');
    el.innerHTML = '';
    const units = FACTION_UNITS[this.game.playerFaction] || [];
    for (const type of units) {
      const stats = UNIT_STATS[type];
      const div   = document.createElement('div');
      div.className = 'ab-roster-item';
      div.innerHTML = `
        <span class="ab-unit-name">${stats.name}</span>
        <span class="ab-unit-info">${stats.soldierCount} men · Cost ${stats.cost}</span>
        <button class="ab-add-btn">+</button>
      `;
      div.querySelector('.ab-add-btn').addEventListener('click', () => {
        if (this.game.playerArmyDef.length >= 20) {
          alert('Army is at capacity (20 units).');
          return;
        }
        this.game.playerArmyDef.push(type);
        this._renderArmy();
      });
      div.addEventListener('click', e => {
        if (e.target.classList.contains('ab-add-btn')) return;
        this._showUnitStats(type);
      });
      el.appendChild(div);
    }
  }

  _populateMaps() {
    const el = document.getElementById('ab-maps');
    el.innerHTML = '';
    for (const key of MAP_KEYS) {
      const map = MAPS[key];
      const btn = document.createElement('div');
      btn.className = 'ab-map-item' + (this.game.selectedMap === key ? ' selected' : '');
      btn.innerHTML = `<strong>${map.name}</strong><br><span>${map.desc}</span>`;
      btn.addEventListener('click', () => {
        this.game.selectedMap = key;
        document.querySelectorAll('.ab-map-item').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      el.appendChild(btn);
    }
  }

  _renderArmy() {
    const el = document.getElementById('ab-army-list');
    el.innerHTML = '';
    const def = this.game.playerArmyDef;
    if (!def.length) {
      el.innerHTML = '<p style="color:#555;font-size:13px;padding:8px">No units added yet. Click + in the roster.</p>';
    }
    for (let i = 0; i < def.length; i++) {
      const type  = def[i];
      const stats = UNIT_STATS[type];
      const row   = document.createElement('div');
      row.className = 'ab-army-row';
      row.innerHTML = `
        <span>${stats.name}</span>
        <span style="color:#888">${stats.soldierCount} men</span>
        <button class="ab-remove-btn" data-idx="${i}">✕</button>
      `;
      row.querySelector('.ab-remove-btn').addEventListener('click', () => {
        this.game.playerArmyDef.splice(i, 1);
        this._renderArmy();
      });
      el.appendChild(row);
    }
    document.getElementById('ab-soldier-count').textContent = `${this.game.playerArmyDef.length} / 20`;
  }

  _showUnitStats(type) {
    const s   = UNIT_STATS[type];
    const el  = document.getElementById('ab-stats');
    el.innerHTML = `
      <div class="ab-stat-name">${s.name}</div>
      <table class="ab-stat-table">
        <tr><td>Soldiers</td><td>${s.soldierCount}</td></tr>
        <tr><td>Morale</td><td>${s.morale}</td></tr>
        <tr><td>Accuracy</td><td>${Math.round(s.accuracy * 100)}%</td></tr>
        <tr><td>Melee Dmg</td><td>${s.meleeDmg}</td></tr>
        <tr><td>Speed</td><td>${s.speed} m/s</td></tr>
        <tr><td>Reload</td><td>${s.reloadTime ?? '—'} s</td></tr>
        <tr><td>Ranks</td><td>${s.ranks}</td></tr>
        <tr><td>Type</td><td>${s.isCavalry ? 'Cavalry' : s.isArtillery ? 'Artillery' : 'Infantry'}</td></tr>
        ${s.isElite ? '<tr><td colspan="2" style="color:#ddaa00">⭐ Elite Unit</td></tr>' : ''}
      </table>
    `;
  }

  _startBattle() {
    const g = this.game;
    if (!g.playerArmyDef.length) {
      alert('Add at least one unit to your army.');
      return;
    }
    if (!g.selectedMap) {
      alert('Select a map.');
      return;
    }

    // Build player army units
    g.playerArmy = _buildArmy(g.playerArmyDef, TEAM_PLAYER, DEPLOY_ZONE_PLAYER);

    // Build AI army — match player unit count
    const aiDef = _buildAIArmy(g.aiFaction, g.playerArmyDef.length);
    g.aiArmy = _buildArmy(aiDef, TEAM_AI, DEPLOY_ZONE_AI);

    g.map = MAPS[g.selectedMap];

    g.setState(GAME_STATE.DEPLOYMENT);
  }
}

function _buildArmy(defs, team, zone) {
  const units   = [];
  const n       = defs.length;
  const facing  = team === TEAM_PLAYER ? 0 : Math.PI; // north or south

  // Space units evenly, starting from left edge of deployment zone
  const spacing = Math.min(zone.w / Math.max(n, 1), 120); // max 120m gap
  const startX  = zone.x + spacing * 0.5;

  for (let i = 0; i < n; i++) {
    const x = startX + i * spacing;
    // Shift toward the back of the zone so the formation + flag visually centers
    const y = zone.y + zone.h * (team === TEAM_PLAYER ? 0.65 : 0.35);
    units.push(new Unit(defs[i], team, x, y, facing));
  }
  return units;
}

function _buildAIArmy(faction, playerUnitCount) {
  const available  = FACTION_UNITS[faction];
  const uniqueUnit = available[available.length - 1];
  const priorities = ['line_infantry', 'line_infantry', 'sabre_cavalry', uniqueUnit, 'artillery', 'militia'];
  const target     = Math.min(playerUnitCount, 20);
  const def        = [];

  for (let attempt = 0; def.length < target && attempt < 80; attempt++) {
    const type = priorities[attempt % priorities.length];
    if (!available.includes(type)) continue;
    def.push(type);
  }
  if (!def.length) def.push('line_infantry');
  return def;
}
