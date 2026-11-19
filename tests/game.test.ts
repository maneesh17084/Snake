import { describe, expect, it } from 'vitest';
import {
  createGame,
  mapInput,
  placeFood,
  step,
  steer,
  steerToward,
  aimToward,
  stepInterval,
  SPEED,
  type Dir,
  type Mode,
} from '../src/game';

const fixedRng = () => 0;

describe('control mapping', () => {
  const table: [Dir, Dir, Dir][] = [
    // input, normal, mirror
    ['up', 'up', 'down'],
    ['down', 'down', 'up'],
    ['left', 'left', 'right'],
    ['right', 'right', 'left'],
  ];
  it.each(table)('%s → normal %s, mirror %s', (input, normal, mirror) => {
    expect(mapInput(input, 'normal')).toBe(normal);
    expect(mapInput(input, 'mirror')).toBe(mirror);
  });

  it.each<[Mode, Dir, Dir]>([
    ['normal', 'up', 'up'],
    ['normal', 'down', 'down'],
    ['mirror', 'up', 'down'],
    ['mirror', 'down', 'up'],
  ])('%s: pressing %s while moving right moves %s', (mode, input, expected) => {
    const g = createGame({ cols: 10, rows: 10, food: null });
    const head = { ...g.snake[0] };
    expect(steer(g, input, mode)).toBe(true);
    step(g, fixedRng);
    expect(g.dir).toBe(expected);
    expect(g.snake[0].y).toBe(head.y + (expected === 'up' ? -1 : 1));
  });

  it('mirror: pressing Right while moving right requests left and is ignored', () => {
    const g = createGame({ cols: 10, rows: 10, food: null });
    expect(steer(g, 'right', 'mirror')).toBe(false);
    step(g, fixedRng);
    expect(g.dir).toBe('right');
  });

  it('normal: pressing Left while moving right is ignored', () => {
    const g = createGame({ cols: 10, rows: 10, food: null });
    expect(steer(g, 'left', 'normal')).toBe(false);
  });

  it('mirror: pressing Left while moving right is a no-op (maps to right)', () => {
    const g = createGame({ cols: 10, rows: 10, food: null });
    expect(steer(g, 'left', 'mirror')).toBe(false);
  });
});

describe('turn queue', () => {
  it('applies at most one change per step', () => {
    const g = createGame({ cols: 10, rows: 10, food: null });
    expect(steer(g, 'up', 'normal')).toBe(true);
    expect(steer(g, 'left', 'normal')).toBe(true);
    step(g, fixedRng);
    expect(g.dir).toBe('up');
    step(g, fixedRng);
    expect(g.dir).toBe('left');
    expect(g.status).toBe('running');
  });

  it('cannot sneak a reversal through rapid inputs', () => {
    const g = createGame({ cols: 10, rows: 10, food: null });
    // Moving right: up then down would be a 180 relative to the queued up.
    expect(steer(g, 'up', 'normal')).toBe(true);
    expect(steer(g, 'down', 'normal')).toBe(false);
    step(g, fixedRng);
    expect(g.dir).toBe('up');
  });

  it('caps queued turns', () => {
    const g = createGame({ cols: 10, rows: 10, food: null });
    expect(steer(g, 'up', 'normal')).toBe(true);
    expect(steer(g, 'left', 'normal')).toBe(true);
    expect(steer(g, 'down', 'normal')).toBe(false);
  });
});

describe('food, growth, scoring', () => {
  it('places food only on free cells', () => {
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    for (let i = 0; i < 50; i++) {
      const f = placeFood(3, 2, snake, () => i / 50)!;
      expect(f.y).toBe(1);
    }
    expect(placeFood(3, 1, snake, Math.random)).toBeNull();
  });

  it('eating grows by one and awards 10 points', () => {
    const g = createGame({
      cols: 10,
      rows: 10,
      snake: [
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ],
      food: { x: 4, y: 5 },
    });
    expect(step(g, fixedRng)).toBe('eat');
    expect(g.snake).toHaveLength(4);
    expect(g.score).toBe(10);
    expect(g.eaten).toBe(1);
    expect(g.food).not.toBeNull();
    expect(g.snake.some((p) => p.x === g.food!.x && p.y === g.food!.y)).toBe(false);
  });
});

describe('collisions', () => {
  it.each<Mode>(['normal', 'mirror'])('%s: wall ends the round', (mode) => {
    const g = createGame({
      cols: 5,
      rows: 5,
      snake: [
        { x: 4, y: 2 },
        { x: 3, y: 2 },
        { x: 2, y: 2 },
      ],
      food: null,
    });
    expect(step(g, fixedRng)).toBe('collide');
    expect(g.status).toBe('lost');
    expect(steer(g, 'up', mode)).toBe(false);
  });

  it('body ends the round', () => {
    // Head at (2,2) moving down into its own body at (2,3).
    const g = createGame({
      cols: 6,
      rows: 6,
      snake: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      dir: 'left',
      food: null,
    });
    steer(g, 'down', 'normal');
    expect(step(g, fixedRng)).toBe('collide');
  });

  it('may move into the cell the tail is leaving', () => {
    const g = createGame({
      cols: 6,
      rows: 6,
      snake: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
      ],
      dir: 'left',
      food: null,
    });
    steer(g, 'down', 'normal');
    expect(step(g, fixedRng)).toBe('move');
  });
});

describe('full-board win', () => {
  it.each<Mode>(['normal', 'mirror'])('%s: filling the board wins', (mode) => {
    // 3x1 board, snake fills two cells, food in the last one.
    const g = createGame({
      cols: 3,
      rows: 1,
      snake: [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
      food: { x: 2, y: 0 },
    });
    steer(g, mode === 'mirror' ? 'left' : 'right', mode); // no-op either way
    expect(step(g, fixedRng)).toBe('win');
    expect(g.status).toBe('won');
    expect(g.score).toBe(10);
    expect(g.snake).toHaveLength(3);
  });
});

describe('speed', () => {
  it('starts, ramps and caps identically for both modes', () => {
    expect(stepInterval(0)).toBe(SPEED.startMs);
    expect(stepInterval(1)).toBeLessThan(stepInterval(0));
    expect(stepInterval(1000)).toBe(SPEED.minMs);
    for (let i = 1; i < 60; i++) expect(stepInterval(i)).toBeLessThanOrEqual(stepInterval(i - 1));
  });
});

describe('mouse mode aiming', () => {
  // Default snake: head at (3,5) moving right on a 10x10 board.
  const make = () => createGame({ cols: 10, rows: 10, food: null });

  it('keeps going straight when the target is ahead or under the head', () => {
    const g = make();
    expect(aimToward(g, { x: 8, y: 5 })).toBe('right');
    expect(aimToward(g, g.snake[0])).toBeNull();
  });

  it('turns along the axis with the larger gap', () => {
    const g = make();
    expect(aimToward(g, { x: 5, y: 0 })).toBe('up');
    expect(aimToward(g, { x: 9, y: 7 })).toBe('right');
  });

  it('never reverses; uses the other axis instead', () => {
    const g = make();
    expect(aimToward(g, { x: 0, y: 4 })).toBe('up');
  });

  it('swings toward the roomier side when the target is directly behind', () => {
    const g = createGame({ cols: 10, rows: 10, food: null, snake: [{ x: 5, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }] });
    expect(aimToward(g, { x: 0, y: 2 })).toBe('down');
  });

  it('steerToward replaces queued turns and moves the head toward the target', () => {
    const g = make();
    steer(g, 'down', 'normal');
    steerToward(g, { x: 3, y: 0 });
    expect(g.queue).toEqual(['up']);
    step(g, fixedRng);
    expect(g.snake[0]).toEqual({ x: 3, y: 4 });
  });
});
