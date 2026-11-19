import { describe, expect, it } from 'vitest';
import type { Mode } from '../src/game';
import { SKINS, UNLOCK_SCORES, isUnlocked, newlyUnlocked, nextUnlock, resolveSkin } from '../src/skins';

const modes: Mode[] = ['normal', 'mirror', 'mouse'];

describe('skin collections', () => {
  it.each(modes)('%s has a free default plus 6 unlockable sets at 50/75/100/150/200/300', (m) => {
    expect(SKINS[m]).toHaveLength(7);
    expect(SKINS[m].map((s) => s.unlockAt)).toEqual([0, ...UNLOCK_SCORES]);
    expect(UNLOCK_SCORES).toEqual([50, 75, 100, 150, 200, 300]);
  });

  it('every skin id is unique across all modes', () => {
    const ids = modes.flatMap((m) => SKINS[m].map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every colour is a hex value', () => {
    for (const m of modes)
      for (const s of SKINS[m])
        for (const c of [s.board, s.snake, s.head, s.fruit, s.fruitCore, s.target]) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('unlocking', () => {
  it('unlocks exactly at the threshold', () => {
    const s75 = SKINS.mirror[2];
    expect(isUnlocked(s75, 74)).toBe(false);
    expect(isUnlocked(s75, 75)).toBe(true);
  });

  it('reports every threshold crossed by a single big round', () => {
    expect(newlyUnlocked('mouse', 40, 110).map((s) => s.unlockAt)).toEqual([50, 75, 100]);
    expect(newlyUnlocked('mouse', 110, 120)).toEqual([]);
    expect(newlyUnlocked('normal', 0, 0)).toEqual([]);
  });

  it('points at the next locked skin', () => {
    expect(nextUnlock('normal', 0)?.unlockAt).toBe(50);
    expect(nextUnlock('normal', 160)?.unlockAt).toBe(200);
    expect(nextUnlock('normal', 300)).toBeUndefined();
  });

  it('falls back to the default for unknown or still-locked choices', () => {
    const [def, , second] = SKINS.normal;
    expect(resolveSkin('normal', undefined, 500)).toBe(def);
    expect(resolveSkin('normal', 'nope', 500)).toBe(def);
    expect(resolveSkin('normal', second.id, 10)).toBe(def);
    expect(resolveSkin('normal', second.id, 75)).toBe(second);
    // A skin from another mode can't be used here.
    expect(resolveSkin('normal', SKINS.mouse[1].id, 500)).toBe(def);
  });
});
