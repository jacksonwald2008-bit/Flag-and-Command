import { CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, WORLD_W, WORLD_H } from '../constants.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = WORLD_W / 2;
    this.y = WORLD_H / 2;
    this.scale = 0.55;
    this.fitToScreen();
    this._isDragging = false;
    this._dragStart = null;
  }

  // World → screen
  wx(worldX) { return (worldX - this.x) * this.scale + this.canvas.width  / 2; }
  wy(worldY) { return (worldY - this.y) * this.scale + this.canvas.height / 2; }

  // Screen → world
  sx(screenX) { return (screenX - this.canvas.width  / 2) / this.scale + this.x; }
  sy(screenY) { return (screenY - this.canvas.height / 2) / this.scale + this.y; }

  // World length → screen pixels
  wLen(meters) { return meters * this.scale; }

  // Fit: scale so the entire map is visible, canvas background fills the rest
  fitToScreen(bottomBarPx = 0) {
    const W = this.canvas.width  || window.innerWidth;
    const H = (this.canvas.height || window.innerHeight) - bottomBarPx;
    // Use whichever axis needs LESS zoom — whole map visible, grass fills remainder
    this.scale = Math.min(W / WORLD_W, H / WORLD_H) * 0.95;
    this.x = WORLD_W / 2;
    this.y = WORLD_H / 2;
  }

  zoom(factor, screenX, screenY) {
    const worldX = this.sx(screenX);
    const worldY = this.sy(screenY);
    this.scale = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, this.scale * factor));
    // Keep the point under cursor stationary
    this.x = worldX - (screenX - this.canvas.width  / 2) / this.scale;
    this.y = worldY - (screenY - this.canvas.height / 2) / this.scale;
    this.clamp();
  }

  pan(dx, dy) {
    this.x -= dx / this.scale;
    this.y -= dy / this.scale;
    this.clamp();
  }

  clamp() {
    const halfW = (this.canvas.width  / 2) / this.scale;
    const halfH = (this.canvas.height / 2) / this.scale;
    const margin = 200; // allow slight overscroll
    this.x = Math.max(-margin, Math.min(WORLD_W + margin, this.x));
    this.y = Math.max(-margin, Math.min(WORLD_H + margin, this.y));
  }

  get viewBounds() {
    const hw = (this.canvas.width  / 2) / this.scale;
    const hh = (this.canvas.height / 2) / this.scale;
    return {
      left:   this.x - hw,
      right:  this.x + hw,
      top:    this.y - hh,
      bottom: this.y + hh,
    };
  }

  isVisible(wx, wy, radius = 0) {
    const b = this.viewBounds;
    return wx + radius > b.left  &&
           wx - radius < b.right &&
           wy + radius > b.top   &&
           wy - radius < b.bottom;
  }

  // Center camera on a world point
  centerOn(wx, wy) {
    this.x = wx;
    this.y = wy;
    this.clamp();
  }

  // Set transform on ctx so world coords draw directly
  applyTransform(ctx) {
    ctx.setTransform(
      this.scale, 0,
      0, this.scale,
      this.canvas.width  / 2 - this.x * this.scale,
      this.canvas.height / 2 - this.y * this.scale,
    );
  }

  resetTransform(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
