import { Camera }        from './engine/camera.js';
import { SpatialGrid }   from './engine/grid.js';
import { Renderer }      from './engine/renderer.js';
import { InputHandler }  from './systems/input.js';
import { updateMovement } from './systems/movement.js';
import { updateCombat }  from './systems/combat.js';
import { updateMorale, applyGeneralAura } from './systems/morale.js';
import { AIController }  from './ai/ai.js';
import { ArmyBuilderUI } from './ui/armyBuilder.js';
import { BattleUISystem } from './ui/battleUI.js';
import { GAME_STATE } from './constants.js';

class Game {
  constructor() {
    this.canvas   = document.getElementById('gameCanvas');
    this.ctx      = this.canvas.getContext('2d');

    this.camera   = new Camera(this.canvas);
    this.grid     = new SpatialGrid();
    this.renderer = new Renderer(this.ctx, this.camera);
    this.input    = new InputHandler(this.canvas, this);

    this.state    = GAME_STATE.ARMY_BUILDER;

    this.playerFaction  = 'france';
    this.aiFaction      = 'england';
    this.playerArmyDef  = [];
    this.selectedMap    = 'open_plains';
    this.map            = null;

    this.playerArmy   = [];
    this.aiArmy       = [];
    this.selectedUnits = [];

    this.gameSpeed  = 1;
    this.paused     = false;
    this.battleTimer = 0;
    this.battleResult = null;

    this.formationDraw = { active: false, path: [] };

    this.ai         = new AIController(this);
    this.armyBuilderUI = new ArmyBuilderUI(this);
    this.battleUISystem = new BattleUISystem(this);

    this._lastTime  = 0;
    this._tickAccum = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Show initial screen
    this.setState(GAME_STATE.ARMY_BUILDER);

    requestAnimationFrame(t => this._loop(t));
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.state === GAME_STATE.DEPLOYMENT || this.state === GAME_STATE.BATTLE) {
      this.camera.fitToScreen();
    }
    this.camera.clamp();
  }

  setState(newState) {
    this.state = newState;

    document.getElementById('army-builder').style.display = 'none';
    document.getElementById('battle-ui').style.display    = 'none';
    document.getElementById('end-screen').style.display   = 'none';
    document.getElementById('deploy-hint').style.display  = 'none';

    if (newState === GAME_STATE.ARMY_BUILDER) {
      document.getElementById('army-builder').style.display = 'flex';
      this.armyBuilderUI._populateFactions();
      this.armyBuilderUI._populateMaps();
      this.armyBuilderUI._renderArmy();
    } else if (newState === GAME_STATE.DEPLOYMENT) {
      document.getElementById('battle-ui').style.display   = 'block';
      document.getElementById('deploy-hint').style.display = 'block';
      this.camera.fitToScreen();
      this.battleUISystem.reset();
    } else if (newState === GAME_STATE.BATTLE) {
      document.getElementById('battle-ui').style.display = 'block';
      this.battleTimer = 0;
      this.paused      = false;
      this.gameSpeed   = 1;
      this.selectedUnits = [];
      this.battleUISystem.reset();
      this.ai.reset();
    } else if (newState === GAME_STATE.BATTLE_END) {
      document.getElementById('battle-ui').style.display  = 'block';
      document.getElementById('end-screen').style.display = 'flex';
      this.battleUISystem.showEndScreen(this.battleResult);
    }
  }

  togglePause() {
    this.paused = !this.paused;
    this.battleUISystem.update();
  }

  setSpeed(s) {
    this.paused    = false;
    this.gameSpeed = s;
    this.battleUISystem.update();
  }

  _loop(timestamp) {
    const rawDt = Math.min((timestamp - this._lastTime) / 1000, 0.08);
    this._lastTime = timestamp;

    if (this.state === GAME_STATE.BATTLE && !this.paused) {
      const dt = rawDt * this.gameSpeed;
      this._update(dt);
    } else if (this.state === GAME_STATE.DEPLOYMENT) {
      // Still update soldier positions for visual polish
      const dt = rawDt;
      for (const u of [...this.playerArmy, ...this.aiArmy]) {
        u.updateSoldierPositions(dt);
      }
    }

    // Keyboard camera movement (WASD + Q/E)
    if (this.state === GAME_STATE.BATTLE || this.state === GAME_STATE.DEPLOYMENT) {
      this.input.update(rawDt);
    }

    this._render();

    if (this.state === GAME_STATE.BATTLE || this.state === GAME_STATE.DEPLOYMENT ||
        this.state === GAME_STATE.BATTLE_END) {
      this.battleUISystem.update();
    }

    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    const allUnits = [...this.playerArmy, ...this.aiArmy];

    // Update particles
    for (const u of allUnits) u.updateParticles(dt);

    // Rebuild spatial grid
    this.grid.clear();
    for (const u of allUnits) {
      if (!u.isShattered && !u.isDead) this.grid.insert(u);
    }

    // Movement
    for (const u of allUnits) {
      if (!u.isShattered) updateMovement(u, dt, this.map);
    }

    // Combat
    updateCombat(allUnits, this.grid, dt);

    // Morale
    updateMorale(allUnits, dt);
    applyGeneralAura(this.playerArmy, dt);
    applyGeneralAura(this.aiArmy, dt);

    // AI
    this.ai.update(dt);

    this.battleTimer += dt;

    this._checkBattleEnd();
  }

  _checkBattleEnd() {
    if (this.state !== GAME_STATE.BATTLE) return;
    const playerAlive = this.playerArmy.filter(u => !u.isShattered && !u.isDead);
    const aiAlive     = this.aiArmy.filter(u => !u.isShattered && !u.isDead);

    const playerDead = playerAlive.length === 0;
    const aiDead     = aiAlive.length === 0;

    if (!playerDead && !aiDead) return;

    const playerLosses = this.playerArmy.reduce((s, u) => s + (u.maxCount - u.aliveCount), 0);
    const enemyLosses  = this.aiArmy.reduce((s, u)     => s + (u.maxCount - u.aliveCount), 0);

    const playerTotal  = this.playerArmy.reduce((s, u) => s + u.maxCount, 0) || 1;
    const lossPct      = playerLosses / playerTotal;

    const won = !playerDead && aiDead;
    let type  = 'Defeat';
    if (won) {
      if (lossPct < 0.15)      type = 'Massacre';
      else if (lossPct < 0.35) type = 'Costly Victory';
      else if (lossPct < 0.55) type = 'Pyrrhic Victory';
      else                     type = 'Heroic Victory';
    }

    this.battleResult = {
      won,
      type,
      enemyKills: enemyLosses,
      ownLosses:  playerLosses,
      duration:   this.battleTimer,
    };
    this.setState(GAME_STATE.BATTLE_END);
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === GAME_STATE.ARMY_BUILDER) return;

    // Terrain
    this.renderer.drawTerrain(this.map);

    // Deployment zones
    if (this.state === GAME_STATE.DEPLOYMENT) {
      this.renderer.drawDeploymentZones();
    }

    // Units
    const allUnits = [...this.playerArmy, ...this.aiArmy];
    for (const u of allUnits) {
      this.renderer.drawUnit(u, this.selectedUnits.includes(u));
    }

    // Formation draw preview
    if (this.formationDraw.active && this.formationDraw.path.length > 1) {
      this.renderer.drawFormationPreview(this.formationDraw.path);
    }

    // Box select
    this.renderer.drawBoxSelect(this.input.getBoxSelectRect());

    // Minimap
    if (this.state === GAME_STATE.BATTLE || this.state === GAME_STATE.DEPLOYMENT) {
      this.renderer.drawMinimap(this.playerArmy, this.aiArmy, this.map);
    }
  }

  restartBattle() {
    this.battleResult  = null;
    this.selectedUnits = [];
    document.getElementById('end-screen').style.display = 'none';
    this.armyBuilderUI._startBattle();
  }

  returnToBuilder() {
    this.battleResult  = null;
    this.playerArmy    = [];
    this.aiArmy        = [];
    this.selectedUnits = [];
    this.setState(GAME_STATE.ARMY_BUILDER);
  }
}

// Expose to window for HTML button onclick handlers
const game = new Game();
window.game = game;

// Deployment "Begin Battle" button
document.getElementById('begin-battle-btn').addEventListener('click', () => {
  if (game.state === GAME_STATE.DEPLOYMENT) {
    game.setState(GAME_STATE.BATTLE);
  }
});
