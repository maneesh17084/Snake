import { mutePref } from './storage';

type Ctor = typeof AudioContext;

/** Tiny square-wave bleeps generated with Web Audio — no asset files. */
export function createSound() {
  let ctx: AudioContext | null = null;
  let muted = mutePref.get();

  function ensure(): AudioContext | null {
    if (!ctx) {
      const AC: Ctor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq: number, dur: number, delay = 0, vol = 0.05, type: OscillatorType = 'square') {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock: () => void ensure(),
    get muted() {
      return muted;
    },
    setMuted(value: boolean) {
      muted = value;
      mutePref.set(value);
    },
    tick: () => tone(523, 0.07),
    go: () => tone(1047, 0.12),
    eat: () => {
      tone(988, 0.045);
      tone(1319, 0.06, 0.045);
    },
    crash: () => {
      tone(330, 0.09, 0, 0.06);
      tone(220, 0.12, 0.09, 0.06);
      tone(147, 0.22, 0.2, 0.06);
    },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, i * 0.11)),
  };
}
