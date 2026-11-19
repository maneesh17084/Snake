import type { GameState, Point } from './game';

export interface Theme {
  lcd: string;
  ink: string;
  accent: string;
}

interface Effect {
  kind: 'pickup' | 'crash';
  at: Point;
  start: number;
}

const PICKUP_MS = 340;
const CRASH_MS = 650;

export function createRenderer(canvas: HTMLCanvasElement, container: HTMLElement, reducedMotion: () => boolean) {
  const ctx = canvas.getContext('2d')!;
  let dpr = 1;
  let cell = 1;
  let ox = 0;
  let oy = 0;
  let cols = 1;
  let rows = 1;
  let theme: Theme = { lcd: '#c4cf9f', ink: '#1c2513', accent: '#2b62b0' };
  let effects: Effect[] = [];

  function layout() {
    const w = canvas.width;
    const h = canvas.height;
    cell = Math.max(1, Math.floor(Math.min(w / cols, h / rows)));
    ox = Math.floor((w - cell * cols) / 2);
    oy = Math.floor((h - cell * rows) / 2);
  }

  function resize() {
    const r = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    layout();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const cx = (x: number) => ox + x * cell;
  const cy = (y: number) => oy + y * cell;

  function drawGrid() {
    ctx.fillStyle = theme.lcd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Faint "unlit pixel" cells give the LCD texture.
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = theme.ink;
    const g = Math.max(1, Math.round(cell * 0.12));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) ctx.fillRect(cx(x) + g, cy(y) + g, cell - g * 2, cell - g * 2);
    ctx.globalAlpha = 1;
  }

  function drawFood(f: Point, now: number) {
    const pulse = reducedMotion() ? 1 : 0.88 + 0.12 * Math.sin(now / 160);
    const mx = cx(f.x) + cell / 2;
    const my = cy(f.y) + cell / 2;
    const r = cell * 0.46 * pulse;
    ctx.fillStyle = theme.ink;
    ctx.beginPath();
    ctx.moveTo(mx, my - r);
    ctx.lineTo(mx + r, my);
    ctx.lineTo(mx, my + r);
    ctx.lineTo(mx - r, my);
    ctx.closePath();
    ctx.fill();
    const ir = r * 0.45;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(mx - ir / 2, my - ir / 2, ir, ir);
  }

  function drawSnake(state: GameState, now: number) {
    const s = state.snake;
    const g = Math.max(1, Math.round(cell * 0.1));
    ctx.fillStyle = theme.ink;
    for (let i = s.length - 1; i >= 1; i--) {
      const p = s[i];
      ctx.fillRect(cx(p.x) + g, cy(p.y) + g, cell - g * 2, cell - g * 2);
      // Bridge toward the next segment so the body reads as one shape.
      const n = s[i - 1];
      const bx = Math.min(p.x, n.x);
      const by = Math.min(p.y, n.y);
      if (p.x !== n.x) ctx.fillRect(cx(bx) + cell - g, cy(by) + g, g * 2, cell - g * 2);
      else ctx.fillRect(cx(bx) + g, cy(by) + cell - g, cell - g * 2, g * 2);
    }

    const h = s[0];
    const crashed = state.status === 'lost';
    const blinkOff = crashed && !reducedMotion() && Math.floor(now / 110) % 2 === 0;
    const hx = cx(h.x);
    const hy = cy(h.y);
    const hg = Math.max(0, g - 1);
    ctx.fillStyle = blinkOff ? theme.ink : theme.accent;
    ctx.fillRect(hx + hg, hy + hg, cell - hg * 2, cell - hg * 2);
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = Math.max(1, Math.round(cell * 0.08));
    ctx.strokeRect(hx + hg + ctx.lineWidth / 2, hy + hg + ctx.lineWidth / 2, cell - hg * 2 - ctx.lineWidth, cell - hg * 2 - ctx.lineWidth);

    if (crashed) {
      // An X marks the collision.
      ctx.strokeStyle = theme.lcd;
      ctx.lineWidth = Math.max(2, cell * 0.14);
      const m = cell * 0.28;
      ctx.beginPath();
      ctx.moveTo(hx + m, hy + m);
      ctx.lineTo(hx + cell - m, hy + cell - m);
      ctx.moveTo(hx + cell - m, hy + m);
      ctx.lineTo(hx + m, hy + cell - m);
      ctx.stroke();
      return;
    }

    // Eyes face the direction of travel.
    const e = Math.max(2, Math.round(cell * 0.18));
    const near = cell * 0.62;
    const side1 = cell * 0.22;
    const side2 = cell * 0.78;
    const eyes: [number, number][] =
      state.dir === 'right' ? [[near, side1], [near, side2]]
      : state.dir === 'left' ? [[cell - near, side1], [cell - near, side2]]
      : state.dir === 'up' ? [[side1, cell - near], [side2, cell - near]]
      : [[side1, near], [side2, near]];
    ctx.fillStyle = theme.lcd;
    for (const [ex, ey] of eyes) ctx.fillRect(Math.round(hx + ex - e / 2), Math.round(hy + ey - e / 2), e, e);
  }

  /** Mouse Mode: a corner-bracket reticle on the cell the snake is chasing. */
  function drawTarget(t: Point) {
    const x = cx(t.x);
    const y = cy(t.y);
    const len = Math.max(3, Math.round(cell * 0.3));
    const w = Math.max(1, Math.round(cell * 0.1));
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.85;
    for (const [px, py, sx, sy] of [
      [x, y, 1, 1],
      [x + cell, y, -1, 1],
      [x, y + cell, 1, -1],
      [x + cell, y + cell, -1, -1],
    ]) {
      ctx.fillRect(sx > 0 ? px : px - len, sy > 0 ? py : py - w, len, w);
      ctx.fillRect(sx > 0 ? px : px - w, sy > 0 ? py : py - len, w, len);
    }
    ctx.globalAlpha = 1;
  }

  function drawEffects(now: number) {
    const reduced = reducedMotion();
    effects = effects.filter((fx) => now - fx.start < (fx.kind === 'pickup' ? PICKUP_MS : CRASH_MS));
    for (const fx of effects) {
      if (fx.kind !== 'pickup') continue;
      const t = (now - fx.start) / PICKUP_MS;
      const mx = cx(fx.at.x) + cell / 2;
      const my = cy(fx.at.y) + cell / 2;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = Math.max(1, cell * 0.12);
      ctx.globalAlpha = 1 - t;
      if (reduced) {
        ctx.strokeRect(cx(fx.at.x) + 1, cy(fx.at.y) + 1, cell - 2, cell - 2);
      } else {
        const r = cell * (0.5 + t * 0.9);
        ctx.strokeRect(mx - r, my - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function shakeOffset(now: number): [number, number] {
    if (reducedMotion()) return [0, 0];
    const fx = effects.find((f) => f.kind === 'crash');
    if (!fx) return [0, 0];
    const t = (now - fx.start) / 260;
    if (t >= 1) return [0, 0];
    const amp = cell * 0.22 * (1 - t);
    return [Math.sin(t * 40) * amp, Math.cos(t * 33) * amp * 0.6];
  }

  return {
    setTheme(t: Theme) {
      theme = t;
    },
    setGrid(c: number, r: number) {
      cols = c;
      rows = r;
      layout();
    },
    reset() {
      effects = [];
    },
    /** Grid cell under a viewport point, clamped to the board. */
    cellAt(clientX: number, clientY: number): Point {
      const r = canvas.getBoundingClientRect();
      const px = (clientX - r.left) * (canvas.width / Math.max(1, r.width));
      const py = (clientY - r.top) * (canvas.height / Math.max(1, r.height));
      const clamp = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
      return { x: clamp(Math.floor((px - ox) / cell), cols), y: clamp(Math.floor((py - oy) / cell), rows) };
    },
    pickup(at: Point, now: number) {
      effects.push({ kind: 'pickup', at: { ...at }, start: now });
    },
    crash(at: Point, now: number) {
      effects.push({ kind: 'crash', at: { ...at }, start: now });
    },
    draw(state: GameState, now: number, target: Point | null = null) {
      const [sx, sy] = shakeOffset(now);
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      drawGrid();
      if (state.food) drawFood(state.food, now);
      if (target && state.status === 'running') drawTarget(target);
      drawSnake(state, now);
      drawEffects(now);
      ctx.restore();
    },
  };
}
