// Unlockable colour sets. Each mode has its own collection; a skin unlocks
// once the player's best score *in that mode* reaches `unlockAt`.

import type { Mode } from './game';

export interface Skin {
  id: string;
  name: string;
  /** Best score needed in this skin's mode. 0 = always available. */
  unlockAt: number;
  board: string;
  snake: string;
  head: string;
  fruit: string;
  fruitCore: string;
  /** Mouse Mode reticle and cursor colour. */
  target: string;
}

export const UNLOCK_SCORES = [50, 75, 100, 150, 200, 300] as const;

type Colors = Omit<Skin, 'id' | 'unlockAt'>;

function collection(mode: Mode, sets: Colors[]): Skin[] {
  return sets.map((c, i) => ({
    ...c,
    id: `${mode}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    unlockAt: i === 0 ? 0 : UNLOCK_SCORES[i - 1],
  }));
}

export const SKINS: Record<Mode, Skin[]> = {
  normal: collection('normal', [
    { name: 'Classic LCD', board: '#c3cf9c', snake: '#1b2412', head: '#2459a8', fruit: '#1b2412', fruitCore: '#2459a8', target: '#2459a8' },
    { name: 'Amber Terminal', board: '#1a1206', snake: '#ffb000', head: '#fff1c2', fruit: '#ff5a1f', fruitCore: '#ffe08a', target: '#fff1c2' },
    { name: 'Deep Ocean', board: '#0b2a3c', snake: '#4fd1c5', head: '#e6fffb', fruit: '#ff6b6b', fruitCore: '#ffd166', target: '#e6fffb' },
    { name: 'Pocket Grey', board: '#c9c9b8', snake: '#3a3a32', head: '#7a1f3d', fruit: '#7a1f3d', fruitCore: '#f4e04d', target: '#7a1f3d' },
    { name: 'Forest Floor', board: '#1d3b24', snake: '#a7e07a', head: '#f2ffd9', fruit: '#e63946', fruitCore: '#ffd6a5', target: '#f2ffd9' },
    { name: 'Royal Velvet', board: '#1b1440', snake: '#f5c542', head: '#fff6d5', fruit: '#ff4d8d', fruitCore: '#ffffff', target: '#fff6d5' },
    { name: 'Inferno', board: '#200606', snake: '#ff7a18', head: '#ffe66d', fruit: '#00e5ff', fruitCore: '#ffffff', target: '#ffe66d' },
  ]),
  mirror: collection('mirror', [
    { name: 'Mirror LCD', board: '#c3cf9c', snake: '#1b2412', head: '#c2410c', fruit: '#1b2412', fruitCore: '#c2410c', target: '#c2410c' },
    { name: 'Negative', board: '#1b2412', snake: '#c3cf9c', head: '#ff9558', fruit: '#ff9558', fruitCore: '#1b2412', target: '#ff9558' },
    { name: 'Sunset Glass', board: '#2b1035', snake: '#ff8a5b', head: '#ffd3b6', fruit: '#ffe66d', fruitCore: '#ff2e63', target: '#ffd3b6' },
    { name: 'Frosted Pane', board: '#dff3f8', snake: '#2c5d78', head: '#e4572e', fruit: '#e4572e', fruitCore: '#ffffff', target: '#e4572e' },
    { name: 'Copper', board: '#2a1a12', snake: '#d98b4b', head: '#ffe0b8', fruit: '#6be3c4', fruitCore: '#ffffff', target: '#ffe0b8' },
    { name: 'Neon Pink', board: '#120818', snake: '#ff3fa4', head: '#ffd1ec', fruit: '#3df5ff', fruitCore: '#ffffff', target: '#ffd1ec' },
    { name: 'Quicksilver', board: '#e9e9ee', snake: '#44475a', head: '#ff3b30', fruit: '#ff3b30', fruitCore: '#ffd60a', target: '#ff3b30' },
  ]),
  mouse: collection('mouse', [
    { name: 'Pointer LCD', board: '#c3cf9c', snake: '#1b2412', head: '#7c2d9e', fruit: '#1b2412', fruitCore: '#7c2d9e', target: '#7c2d9e' },
    { name: 'Arcade Night', board: '#0d0f1a', snake: '#39ff88', head: '#c6ffe0', fruit: '#ff3864', fruitCore: '#ffe66d', target: '#ffe66d' },
    { name: 'Lavender', board: '#ece4fb', snake: '#4b2a7b', head: '#e0559a', fruit: '#e0559a', fruitCore: '#ffffff', target: '#4b2a7b' },
    { name: 'Code Rain', board: '#020b05', snake: '#00c853', head: '#b9f6ca', fruit: '#b9f6ca', fruitCore: '#00c853', target: '#00e676' },
    { name: 'Candy Pop', board: '#fff0f6', snake: '#ff4f9a', head: '#7b2ff7', fruit: '#00b4d8', fruitCore: '#ffffff', target: '#7b2ff7' },
    { name: 'Deep Space', board: '#070b24', snake: '#8ab4ff', head: '#ffffff', fruit: '#ffb703', fruitCore: '#fb5607', target: '#ff006e' },
    { name: 'Laser Gold', board: '#121212', snake: '#ffd700', head: '#ffffff', fruit: '#ff1744', fruitCore: '#ffffff', target: '#00e5ff' },
  ]),
};

export const isUnlocked = (skin: Skin, best: number) => best >= skin.unlockAt;

/** Skins whose threshold was crossed going from `before` to `after`. */
export function newlyUnlocked(mode: Mode, before: number, after: number): Skin[] {
  return SKINS[mode].filter((s) => s.unlockAt > before && s.unlockAt <= after);
}

/** The next locked skin for a mode, if any. */
export function nextUnlock(mode: Mode, best: number): Skin | undefined {
  return SKINS[mode].find((s) => !isUnlocked(s, best));
}

/** Resolve a stored choice, falling back to the default if it's unknown or locked. */
export function resolveSkin(mode: Mode, id: string | undefined, best: number): Skin {
  const list = SKINS[mode];
  const found = list.find((s) => s.id === id);
  return found && isUnlocked(found, best) ? found : list[0];
}
