import { GRID_CELL, GRID_COLS, GRID_ROWS, WORLD_W, WORLD_H } from '../constants.js';

// Spatial partitioning grid for fast neighbor lookups
export class SpatialGrid {
  constructor() {
    this.cells = new Array(GRID_COLS * GRID_ROWS).fill(null).map(() => []);
  }

  _cellIdx(worldX, worldY) {
    const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(worldX / GRID_CELL)));
    const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(worldY / GRID_CELL)));
    return row * GRID_COLS + col;
  }

  clear() {
    for (let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
  }

  insert(unit) {
    const idx = this._cellIdx(unit.x, unit.y);
    this.cells[idx].push(unit);
  }

  // Returns all units within radius of (wx, wy), optionally filtered by team
  query(wx, wy, radius, team = -1) {
    const results = [];
    const minCol = Math.max(0, Math.floor((wx - radius) / GRID_CELL));
    const maxCol = Math.min(GRID_COLS - 1, Math.floor((wx + radius) / GRID_CELL));
    const minRow = Math.max(0, Math.floor((wy - radius) / GRID_CELL));
    const maxRow = Math.min(GRID_ROWS - 1, Math.floor((wy + radius) / GRID_CELL));
    const r2 = radius * radius;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cell = this.cells[row * GRID_COLS + col];
        for (const unit of cell) {
          if (team !== -1 && unit.team !== team) continue;
          const dx = unit.x - wx;
          const dy = unit.y - wy;
          if (dx * dx + dy * dy <= r2) results.push(unit);
        }
      }
    }
    return results;
  }

  // Returns nearest enemy unit within radius, or null
  nearestEnemy(unit, radius) {
    const enemies = this.query(unit.x, unit.y, radius);
    let best = null;
    let bestDist2 = Infinity;
    for (const other of enemies) {
      if (other.team === unit.team || other.isShattered) continue;
      const dx = other.x - unit.x;
      const dy = other.y - unit.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) { bestDist2 = d2; best = other; }
    }
    return best;
  }

  // Returns all units in a given radius without team filter
  queryAll(wx, wy, radius) {
    return this.query(wx, wy, radius, -1);
  }
}
