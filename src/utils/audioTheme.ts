import type { AppSettings } from '../types/game';

export const SET_KEY = 'lkset';

export function getSettings(): AppSettings {
  try {
    return JSON.parse(localStorage.getItem(SET_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify(s));
  } catch {
    // ignore storage errors
  }
}

export function getDefaultMatchSpeed(st: AppSettings): 0.25 | 0.5 | 1 | 2 | 4 {
  if (st.matchSpeed === 0.25 || st.matchSpeed === 0.5 || st.matchSpeed === 1 || st.matchSpeed === 2 || st.matchSpeed === 4) return st.matchSpeed;
  return 1;
}

export function applyTheme(theme?: 'light' | 'dark' | '') {
  const root = document.documentElement;
  let isDark = false;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    isDark = true;
  } else if (theme === 'light') {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    isDark = false;
  } else {
    root.removeAttribute('data-theme');
    isDark = Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);
  }
  const themeColor = isDark ? '#0c1c14' : '#ffffff';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', themeColor));
}

export let audioCtx: AudioContext | null = null;
export let crowdSource: AudioBufferSourceNode | null = null;

export function snd(freq: number, dur = 0.12, type: OscillatorType = 'square', vol = 0.05, delay = 0) {
  const st = getSettings();
  if (st.mute) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new AudioCtx();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const now = audioCtx.currentTime + delay;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + dur);
  } catch {
    // ignore audio block
  }
}

export const SFX = {
  tap: () => snd(520, 0.06, 'triangle', 0.035),
  pass: () => snd(260, 0.04, 'sine', 0.022),
  kick: () => snd(180, 0.055, 'triangle', 0.032),
  foul: () => snd(1480, 0.14, 'sine', 0.042),
  goal: () => [523, 659, 784, 1047].forEach((f, i) => snd(f, 0.18, 'square', 0.045, i * 0.1)),
  whistle: () => {
    snd(1800, 0.24, 'sine', 0.055);
    snd(1800, 0.36, 'sine', 0.055, 0.28);
  },
  win: () => [392, 523, 659, 784].forEach((f, i) => snd(f, 0.2, 'triangle', 0.055, i * 0.12)),
  lose: () => [330, 262, 196].forEach((f, i) => snd(f, 0.24, 'sawtooth', 0.035, i * 0.14))
};

export function setCrowdAudio(on: boolean) {
  try {
    if (crowdSource) {
      crowdSource.stop();
      crowdSource = null;
    }
    const st = getSettings();
    if (!on || st.mute || st.nocrowd) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new AudioCtx();
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    const filt = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    src.buffer = buf;
    src.loop = true;
    filt.type = 'bandpass';
    filt.frequency.value = 500;
    gain.gain.value = 0.014;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
    crowdSource = src;
  } catch {
    // ignore
  }
}

export function vibrate(pattern: number | number[]) {
  const st = getSettings();
  if (st.novib) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

export function triggerConfetti() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#f5c242', '#2fc476', '#ff7a5c', '#60a5fa', '#ffffff'];
  for (let i = 0; i < 45; i++) {
    const el = document.createElement('i');
    el.className = 'confetti-piece';
    el.style.left = `${Math.floor(Math.random() * 100)}%`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    el.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}
