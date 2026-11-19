// Pure game logic — no DOM. Shared by both modes; only input mapping differs.

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Mode = 'normal' | 'mirror' | 'mouse';
export type Status = 'running' | 'lost' | 'won';
export type StepEvent = 'move' | 'eat' | 'collide' | 'win' | 'idle';

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  cols: number;
  rows: number;
  /** Head first. */
  snake: Point[];
  dir: Dir;
  /** Validated, already-mapped turns waiting to be applied (one per step). */
  queue: Dir[];
  food: Point | null;
  score: number;
  eaten: number;
  status: Status;
  /** Cell the head tried to enter when the round was lost. */
  collision: Point | null;
}

export type Rng = () => number;

export const POINTS_PER_FOOD = 10;
export const MAX_QUEUED_TURNS = 2;

/** Identical in both modes. */
export const SPEED = { startMs: 150, stepMs: 4, minMs: 65 } as const;

export const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const VECTORS: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Mirror Mode reverses both axes; Normal and Mouse pass inputs through. */
export function mapInput(input: Dir, mode: Mode): Dir {
  return mode === 'mirror' ? OPPOSITE[input] : input;
}

export function stepInterval(foodEaten: number): number {
  return Math.max(SPEED.minMs, SPEED.startMs - foodEaten * SPEED.stepMs);
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function placeFood(cols: number, rows: number, snake: Point[], rng: Rng): Point | null {
  const occupied = new Set(snake.map((p) => p.y * cols + p.x));
  const free: number[] = [];
  for (let i = 0; i < cols * rows; i++) if (!occupied.has(i)) free.push(i);
  if (free.length === 0) return null;
  const idx = free[Math.min(free.length - 1, Math.floor(rng() * free.length))];
  return { x: idx % cols, y: Math.floor(idx / cols) };
}

export interface CreateOptions {
  cols: number;
  rows: number;
  rng?: Rng;
  snake?: Point[];
  dir?: Dir;
  food?: Point | null;
}

export function createGame(opts: CreateOptions): GameState {
  const { cols, rows, rng = Math.random } = opts;
  let snake = opts.snake?.map((p) => ({ ...p }));
  if (!snake) {
    const y = Math.floor(rows / 2);
    const headX = Math.max(2, Math.floor(cols / 2) - 2);
    snake = [0, 1, 2].map((i) => ({ x: headX - i, y }));
  }
  const food = opts.food !== undefined ? opts.food : placeFood(cols, rows, snake, rng);
  return {
    cols,
    rows,
    snake,
    dir: opts.dir ?? 'right',
    queue: [],
    food,
    score: 0,
    eaten: 0,
    status: 'running',
    collision: null,
  };
}

/**
 * Queue an already-mapped direction. Rejected if it repeats or reverses the
 * last planned direction, so a burst of inputs can never add up to a 180.
 */
export function requestTurn(state: GameState, dir: Dir): boolean {
  if (state.status !== 'running') return false;
  const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
  if (dir === last || dir === OPPOSITE[last]) return false;
  if (state.queue.length >= MAX_QUEUED_TURNS) return false;
  state.queue.push(dir);
  return true;
}

/** Map a raw player input through the mode, then validate it. */
export function steer(state: GameState, input: Dir, mode: Mode): boolean {
  return requestTurn(state, mapInput(input, mode));
}

/** Advance one movement step. Applies at most one direction change. */
export function step(state: GameState, rng: Rng = Math.random): StepEvent {
  if (state.status !== 'running') return 'idle';

  const next = state.queue.shift();
  if (next && next !== OPPOSITE[state.dir]) state.dir = next;

  const v = VECTORS[state.dir];
  const head = state.snake[0];
  const nh = { x: head.x + v.x, y: head.y + v.y };

  if (nh.x < 0 || nh.y < 0 || nh.x >= state.cols || nh.y >= state.rows) {
    state.status = 'lost';
    state.collision = nh;
    return 'collide';
  }

  const eating = state.food !== null && same(nh, state.food);
  // The tail moves away this step unless we grow, so it's a legal target.
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => same(p, nh))) {
    state.status = 'lost';
    state.collision = nh;
    return 'collide';
  }

  state.snake.unshift(nh);
  if (!eating) {
    state.snake.pop();
    return 'move';
  }

  state.score += POINTS_PER_FOOD;
  state.eaten += 1;
  state.food = placeFood(state.cols, state.rows, state.snake, rng);
  if (state.food === null) {
    state.status = 'won';
    return 'win';
  }
  return 'eat';
}

/**
 * Mouse Mode: pick the turn that brings the head closer to `target`.
 * Prefers the axis with the larger gap, never reverses, and when the target
 * is directly behind, turns toward the side of the board with more room.
 * Returns null when the head is already on the target (keep going straight).
 */
export function aimToward(state: GameState, target: Point): Dir | null {
  const head = state.snake[0];
  const dx = target.x - head.x;
  const dy = target.y - head.y;
  if (dx === 0 && dy === 0) return null;

  const h: Dir | null = dx === 0 ? null : dx > 0 ? 'right' : 'left';
  const v: Dir | null = dy === 0 ? null : dy > 0 ? 'down' : 'up';
  const ordered = Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h];
  const back = OPPOSITE[state.dir];
  const pick = ordered.find((d): d is Dir => d !== null && d !== back);
  if (pick) return pick;

  // Target is straight behind: swing out toward the roomier side.
  if (state.dir === 'left' || state.dir === 'right') return head.y > (state.rows - 1) / 2 ? 'up' : 'down';
  return head.x > (state.cols - 1) / 2 ? 'left' : 'right';
}

/** Replace any pending turns with the single best turn toward `target`. */
export function steerToward(state: GameState, target: Point): void {
  if (state.status !== 'running') return;
  state.queue = [];
  const d = aimToward(state, target);
  if (d) requestTurn(state, d);
}
