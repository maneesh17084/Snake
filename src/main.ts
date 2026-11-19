import './style.css';
import { createGame, step, steer, steerToward, stepInterval, type Dir, type GameState, type Mode, type Point } from './game';
import { createRenderer } from './renderer';
import { createSound } from './sound';
import { createBestStore } from './storage';

const COLS = 18;
const ROWS = 18;
const COUNT_MS = 480;
const SWIPE_PX = 22;

type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'ending' | 'results';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const app = $('app');
const hud = $('hud');
const stage = $('stage');
const screen = $('screen');
const canvas = $<HTMLCanvasElement>('board');
const modeName = $('mode-name');
const modeHint = $('mode-hint');
const scoreEl = $('score');
const bestEl = $('best');
const bestStat = $('best-stat');
const muteBtn = $<HTMLButtonElement>('mute-btn');
const pauseBtn = $<HTMLButtonElement>('pause-btn');
const countdown = $('countdown');
const countdownMode = $('countdown-mode');
const countdownNum = $('countdown-num');
const countdownHint = $('countdown-hint');
const menu = $('menu');
const pauseOverlay = $('pause');
const results = $('results');
const announcer = $('announcer');

const MODE_LABEL: Record<Mode, string> = { normal: 'Normal', mirror: 'Mirror', mouse: 'Mouse' };
const MODE_HINT: Record<Mode, string> = {
  normal: 'Standard controls',
  mirror: 'Controls reversed',
  mouse: 'Snake follows your pointer',
};

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const best = createBestStore();
const sound = createSound();
const renderer = createRenderer(canvas, screen, () => reducedQuery.matches);
renderer.setGrid(COLS, ROWS);

let phase: Phase = 'menu';
let mode: Mode = 'normal';
let game: GameState = createGame({ cols: COLS, rows: ROWS });
let acc = 0;
let countdownTimer: number | undefined;
let goTimer: number | undefined;
let endTimer: number | undefined;
/** Last pointer position in viewport coords (Mouse Mode steering). */
let pointer: { x: number; y: number } | null = null;

/* ---------- helpers ---------- */

const pad = (n: number) => String(n).padStart(4, '0');

function announce(msg: string) {
  announcer.textContent = '';
  // Re-set on the next frame so screen readers notice repeated messages.
  requestAnimationFrame(() => (announcer.textContent = msg));
}

function setPhase(p: Phase) {
  phase = p;
  app.dataset.phase = p;
  pauseBtn.disabled = !(p === 'playing' || p === 'countdown');
}

function readTheme() {
  const cs = getComputedStyle(app);
  return {
    lcd: cs.getPropertyValue('--lcd').trim(),
    ink: cs.getPropertyValue('--ink').trim(),
    accent: cs.getPropertyValue('--accent').trim(),
  };
}

function setMode(m: Mode) {
  mode = m;
  app.dataset.mode = m;
  modeName.textContent = MODE_LABEL[m];
  modeHint.textContent = MODE_HINT[m];
  renderer.setTheme(readTheme());
}

function updateHud() {
  const stored = best.get(mode);
  scoreEl.textContent = pad(game.score);
  bestEl.textContent = pad(Math.max(stored, game.score));
  bestStat.classList.toggle('is-record', game.score > 0 && game.score > stored);
}

function refreshMenuBests() {
  document.querySelectorAll<HTMLElement>('[data-best]').forEach((el) => {
    el.textContent = String(best.get(el.dataset.best as Mode));
  });
}

const overlays = [menu, pauseOverlay, results];

function showOverlay(el: HTMLElement, focusSel?: string) {
  overlays.forEach((o) => (o.hidden = o !== el));
  hud.inert = true;
  stage.inert = true;
  const target = (focusSel && el.querySelector<HTMLElement>(focusSel)) || el.querySelector<HTMLElement>('button');
  target?.focus({ preventScroll: true });
}

function hideOverlays() {
  overlays.forEach((o) => (o.hidden = true));
  hud.inert = false;
  stage.inert = false;
  screen.focus({ preventScroll: true });
}

function clearTimers() {
  window.clearInterval(countdownTimer);
  window.clearTimeout(goTimer);
  window.clearTimeout(endTimer);
  countdownTimer = goTimer = endTimer = undefined;
}

/* ---------- flow ---------- */

function goToMenu() {
  clearTimers();
  countdown.hidden = true;
  setPhase('menu');
  refreshMenuBests();
  showOverlay(menu, `[data-start="${mode}"]`);
}

function startRound(m: Mode) {
  clearTimers();
  sound.unlock();
  setMode(m);
  game = createGame({ cols: COLS, rows: ROWS });
  acc = 0;
  renderer.reset();
  updateHud();
  hideOverlays();
  announce(`${MODE_LABEL[m]} Mode. ${MODE_HINT[m]}.`);
  runCountdown();
}

function runCountdown() {
  setPhase('countdown');
  countdownMode.textContent = `${MODE_LABEL[mode]} Mode`;
  countdownHint.textContent = MODE_HINT[mode];
  countdown.hidden = false;
  countdown.classList.remove('is-go');
  let n = 3;
  const show = (v: string) => {
    countdownNum.textContent = v;
    // Restart the pop animation.
    countdownNum.classList.remove('pop');
    void countdownNum.offsetWidth;
    countdownNum.classList.add('pop');
  };
  show(String(n));
  sound.tick();
  countdownTimer = window.setInterval(() => {
    n--;
    if (n > 0) {
      show(String(n));
      sound.tick();
      return;
    }
    window.clearInterval(countdownTimer);
    show('GO');
    countdown.classList.add('is-go');
    sound.go();
    acc = 0;
    setPhase('playing');
    goTimer = window.setTimeout(() => (countdown.hidden = true), 380);
  }, COUNT_MS);
}

function pause() {
  if (phase !== 'playing' && phase !== 'countdown') return;
  clearTimers();
  countdown.hidden = true;
  setPhase('paused');
  showOverlay(pauseOverlay);
  announce('Paused');
}

function resume() {
  if (phase !== 'paused') return;
  hideOverlays();
  runCountdown();
}

function endRound(won: boolean) {
  setPhase('ending');
  const { best: b, isRecord } = best.submit(mode, game.score);
  endTimer = window.setTimeout(() => showResults(won, b, isRecord), won ? 900 : 800);
}

function showResults(won: boolean, b: number, isRecord: boolean) {
  setPhase('results');
  $('results-title').textContent = won ? 'Board Cleared!' : 'Game Over';
  $('results-mode').textContent = `${MODE_LABEL[mode]} Mode`;
  $('final-score').textContent = String(game.score);
  $('final-best-label').textContent = `Best · ${MODE_LABEL[mode]}`;
  $('final-best').textContent = String(b);
  $('record-badge').hidden = !isRecord;
  results.dataset.mode = mode;
  results.querySelectorAll<HTMLElement>('[data-start]').forEach((btn) => {
    btn.classList.toggle('is-last', btn.dataset.start === mode);
  });
  updateHud();
  showOverlay(results, `[data-start="${mode}"]`);
  announce(
    `${won ? 'Board cleared' : 'Game over'}. Score ${game.score}. ${MODE_LABEL[mode]} best ${b}.${isRecord ? ' New record!' : ''}`,
  );
}

function mouseTarget(): Point | null {
  return mode === 'mouse' && pointer ? renderer.cellAt(pointer.x, pointer.y) : null;
}

function tick(now: number) {
  const target = mouseTarget();
  if (target) steerToward(game, target);
  const food = game.food;
  const ev = step(game);
  if (ev === 'eat' || ev === 'win') {
    if (food) renderer.pickup(food, now);
    sound.eat();
    updateHud();
  }
  if (ev === 'collide') {
    renderer.crash(game.collision ?? game.snake[0], now);
    sound.crash();
    navigator.vibrate?.(80);
    endRound(false);
  } else if (ev === 'win') {
    sound.win();
    endRound(true);
  }
}

function handleSteer(input: Dir) {
  if (phase !== 'playing' || mode === 'mouse') return;
  steer(game, input, mode);
}

/* ---------- main loop ---------- */

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(now - last, 100);
  last = now;
  if (phase === 'playing') {
    acc += dt;
    let iv = stepInterval(game.eaten);
    while (acc >= iv && phase === 'playing') {
      acc -= iv;
      tick(now);
      iv = stepInterval(game.eaten);
    }
  }
  renderer.draw(game, now, phase === 'menu' ? null : mouseTarget());
  requestAnimationFrame(frame);
}

/* ---------- input ---------- */

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

function isButton(t: EventTarget | null) {
  return t instanceof HTMLButtonElement;
}

/** Arrow keys move focus in menus — never mirrored. */
function moveMenuFocus(dir: Dir, overlay: HTMLElement) {
  const buttons = [...overlay.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
  if (!buttons.length) return;
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const delta = dir === 'up' || dir === 'left' ? -1 : 1;
  const next = i === -1 ? 0 : (i + delta + buttons.length) % buttons.length;
  buttons[next].focus();
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const dir = KEY_DIR[key];

  if (key === 'm' && !e.repeat) {
    toggleMute();
    return;
  }

  if (phase === 'playing' || phase === 'countdown' || phase === 'ending') {
    if (dir) {
      e.preventDefault();
      if (!e.repeat) handleSteer(dir);
      return;
    }
    if (key === 'Escape' || key === 'p' || (key === ' ' && !isButton(e.target))) {
      e.preventDefault();
      pause();
    }
    return;
  }

  if (phase === 'paused' && (key === 'Escape' || key === 'p')) {
    e.preventDefault();
    resume();
    return;
  }

  const open = overlays.find((o) => !o.hidden);
  if (open && dir && (key.startsWith('Arrow'))) {
    e.preventDefault();
    moveMenuFocus(dir, open);
  }
});

// Mouse Mode: remember where the pointer is; the snake turns toward it each step.
const trackPointer = (e: PointerEvent) => {
  if (mode === 'mouse') pointer = { x: e.clientX, y: e.clientY };
};
window.addEventListener('pointermove', trackPointer);
window.addEventListener('pointerdown', trackPointer);

// Swipes: fire as soon as the finger travels far enough; chain within one touch.
let swipeStart: { x: number; y: number; id: number } | null = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  sound.unlock();
  swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
});
stage.addEventListener('pointermove', (e) => {
  if (!swipeStart || e.pointerId !== swipeStart.id || mode === 'mouse') return;
  const dx = e.clientX - swipeStart.x;
  const dy = e.clientY - swipeStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  handleSteer(dir);
  swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
});
const endSwipe = () => (swipeStart = null);
stage.addEventListener('pointerup', endSwipe);
stage.addEventListener('pointercancel', endSwipe);
// Belt and braces for browsers that ignore touch-action.
stage.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

document.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((btn) =>
  btn.addEventListener('click', () => startRound(btn.dataset.start as Mode)),
);
pauseBtn.addEventListener('click', pause);
$('resume-btn').addEventListener('click', resume);
$('pause-home-btn').addEventListener('click', goToMenu);
$('results-home-btn').addEventListener('click', goToMenu);

function syncMute() {
  muteBtn.setAttribute('aria-pressed', String(sound.muted));
  muteBtn.setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound');
  muteBtn.dataset.muted = String(sound.muted);
}
function toggleMute() {
  sound.setMuted(!sound.muted);
  syncMute();
  announce(sound.muted ? 'Sound off' : 'Sound on');
}
muteBtn.addEventListener('click', toggleMute);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', pause);
window.addEventListener('pagehide', pause);

/* ---------- boot ---------- */

syncMute();
setMode('normal');
setPhase('menu');
refreshMenuBests();
updateHud();
showOverlay(menu);
requestAnimationFrame(frame);

// Test hook for local end-to-end checks; removed from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __snake: unknown }).__snake = { game: () => game, phase: () => phase, mode: () => mode };
}
