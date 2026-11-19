import type { Mode } from './game';

const BEST_KEY = 'mirror-snake.best.v1';
const MUTE_KEY = 'mirror-snake.muted.v1';

type Bests = Record<Mode, number>;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — keep in memory only */
  }
}

const clean = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function createBestStore() {
  const bests: Bests = { normal: 0, mirror: 0, mouse: 0 };
  const raw = safeGet(BEST_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Bests>;
      bests.normal = clean(parsed.normal);
      bests.mirror = clean(parsed.mirror);
      bests.mouse = clean(parsed.mouse);
    } catch {
      /* corrupt value — start fresh */
    }
  }

  return {
    get: (mode: Mode) => bests[mode],
    /** Record a finished round. Returns the (possibly new) best for the mode. */
    submit(mode: Mode, score: number): { best: number; isRecord: boolean } {
      const isRecord = score > 0 && score > bests[mode];
      if (isRecord) {
        bests[mode] = score;
        safeSet(BEST_KEY, JSON.stringify(bests));
      }
      return { best: bests[mode], isRecord };
    },
  };
}

export const mutePref = {
  get: () => safeGet(MUTE_KEY) === '1',
  set: (muted: boolean) => safeSet(MUTE_KEY, muted ? '1' : '0'),
};
