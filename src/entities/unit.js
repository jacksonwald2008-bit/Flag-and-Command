import {
  UNIT_STATS, SS, US, MORALE_STATE,
  MORALE_WAVERING_THRESHOLD, MORALE_ROUTING_THRESHOLD, MORALE_BROKEN_THRESHOLD,
  SOLDIER_SPACING, RANK_DEPTH,
} from '../constants.js';

let _nextId = 0;

export class Unit {
  constructor(type, team, x, y, facing = 0) {
    this.id      = _nextId++;
    this.type    = type;
    this.team    = team;
    this.x       = x;
    this.y       = y;
    this.facing  = facing; // radians, 0=north, clockwise

    const stats = UNIT_STATS[type];
    this.stats = stats;
    this.currentRanks = stats.ranks; // can be overridden by formation drag

    // State
    this.state      = US.IDLE;
    this.morale     = stats.morale;
    this.maxMorale  = stats.morale;
    this.moraleState = MORALE_STATE.STEADY;

    // Movement
    this.targetX   = x;
    this.targetY   = y;
    this.targetFacing = facing;
    this.isMoving  = false;
    this.speed     = stats.speed;

    // Combat
    this.reloadTimer   = 0;
    this.inCombat      = false;
    this.combatTimer   = 0; // how long been in combat (for morale decay)
    this.meleeTarget   = null;
    this.fireTarget    = null;
    this.lastFiredAt   = 0;
    this.ammo          = stats.isArtillery ? 30 : 60;

    // Routing
    this.routTimer     = 0;
    this.isShattered   = false;
    this.isBroken      = false;
    this.routDirX      = 0;
    this.routDirY      = 1;

    // Particles (owned by unit, rendered by renderer)
    this.particles = [];

    // Build soldiers
    this.soldiers = [];
    for (let i = 0; i < stats.soldierCount; i++) {
      this.soldiers.push({ x, y, state: SS.IDLE, reloadTimer: 0, rankIdx: 0 });
    }

    // Initial layout
    this.layoutFormation();
    // Snap soldiers to positions immediately
    for (const s of this.soldiers) { s.x = s.tx; s.y = s.ty; }
  }

  get aliveCount() {
    let n = 0;
    for (const s of this.soldiers) if (s.state !== SS.DEAD) n++;
    return n;
  }

  get maxCount() { return this.stats.soldierCount; }

  get moralePercent() { return this.morale / this.maxMorale; }

  get isDead() { return this.aliveCount === 0; }

  // Forward unit vector (world space)
  get fwdX() { return  Math.sin(this.facing); }
  get fwdY() { return -Math.cos(this.facing); }
  // Right unit vector
  get rightX() { return Math.cos(this.facing); }
  get rightY() { return Math.sin(this.facing); }

  // Approximate front width in meters
  get frontWidth() {
    const alive = this.aliveCount;
    const perRank = Math.ceil(alive / this.currentRanks);
    return perRank * SOLDIER_SPACING;
  }

  // Compute bounding radius for culling/hit testing
  get boundRadius() {
    return Math.max(this.frontWidth / 2 + 10, 20);
  }

  layoutFormation() {
    const alive = this.soldiers.filter(s => s.state !== SS.DEAD);
    const count  = alive.length;
    if (count === 0) return;

    const ranks   = this.currentRanks;
    const perRank = Math.ceil(count / ranks);
    const fwdX = this.fwdX, fwdY = this.fwdY;
    const rtX  = this.rightX, rtY = this.rightY;

    let i = 0;
    for (let rank = 0; rank < ranks && i < count; rank++) {
      const rankCount = Math.min(perRank, count - rank * perRank);
      for (let file = 0; file < rankCount && i < count; file++, i++) {
        const s = alive[i];
        const offsetRight = (file - (rankCount - 1) / 2) * SOLDIER_SPACING;
        const offsetBack  = rank * RANK_DEPTH;
        s.tx = this.x + rtX * offsetRight - fwdX * offsetBack;
        s.ty = this.y + rtY * offsetRight - fwdY * offsetBack;
        s.rankIdx = rank;
      }
    }
  }

  // Move soldiers smoothly toward their target positions
  updateSoldierPositions(dt) {
    const moveSpeed = this.speed * 3; // soldiers move faster than unit to stay in formation
    for (const s of this.soldiers) {
      if (s.state === SS.DEAD) continue;
      if (s.tx === undefined) continue;
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.05) { s.x = s.tx; s.y = s.ty; continue; }
      const step = Math.min(dist, moveSpeed * dt);
      s.x += (dx / dist) * step;
      s.y += (dy / dist) * step;
    }
  }

  // Remove a soldier (killed)
  killSoldier(count = 1) {
    let killed = 0;
    for (const s of this.soldiers) {
      if (killed >= count) break;
      if (s.state !== SS.DEAD) { s.state = SS.DEAD; killed++; }
    }
    return killed;
  }

  // Applies morale damage and updates state
  damageMorale(amount) {
    this.morale = Math.max(0, this.morale - amount);
    this._updateMoraleState();
  }

  restoreMorale(amount) {
    this.morale = Math.min(this.maxMorale, this.morale + amount);
    this._updateMoraleState();
  }

  _updateMoraleState() {
    if (this.isShattered) return;
    const m = this.morale;
    if      (m <= MORALE_BROKEN_THRESHOLD)   this.moraleState = MORALE_STATE.BROKEN;
    else if (m <= MORALE_ROUTING_THRESHOLD)  this.moraleState = MORALE_STATE.ROUTING;
    else if (m <= MORALE_WAVERING_THRESHOLD) this.moraleState = MORALE_STATE.WAVERING;
    else                                      this.moraleState = MORALE_STATE.STEADY;
  }

  // Order unit to move to world position
  moveTo(wx, wy, newFacing = null) {
    this.targetX = wx;
    this.targetY = wy;
    if (newFacing !== null) this.targetFacing = newFacing;
    this.state   = US.MOVING;
    this.isMoving = true;
    this.inCombat = false;
    this.reloadTimer = 0;
  }

  // Order unit to form along a line (from world start→end)
  formLine(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    // Facing: perpendicular to line, toward enemy half of map
    const lineAngle = Math.atan2(dy, dx); // angle of line direction
    // Two possible normals; pick the one pointing "forward" (toward map center if enemy unknown)
    const normal1 = lineAngle - Math.PI / 2;
    const normal2 = lineAngle + Math.PI / 2;
    const facing = this.team === 0 ? normal1 : normal2; // rough heuristic; player = face north
    this.moveTo(mx, my, facing);
    this.targetFacing = facing;
  }

  addParticle(x, y, type) {
    this.particles.push({ x, y, type, life: 1.0, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8 });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt * (p.type === 'smoke' ? 1.0 : 2.5);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
}
