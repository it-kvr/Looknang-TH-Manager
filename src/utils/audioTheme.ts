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

export function getDefaultMatchSpeed(st: AppSettings): 0.25 | 0.5 | 1 | 2 | 5 {
  if (st.matchSpeed === 0.25 || st.matchSpeed === 0.5 || st.matchSpeed === 1 || st.matchSpeed === 2 || st.matchSpeed === 5) return st.matchSpeed;
  if ((st.matchSpeed as number | undefined) === 4) return 5;
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

let masterBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let crowdGainNode: GainNode | null = null;
let crowdPresenceFilter: BiquadFilterNode | null = null;
let crowdLfo: OscillatorNode | null = null;
let crowdActive = false;
let noiseBuffer: AudioBuffer | null = null;
let unlockBound = false;

function getSfxScale(st: AppSettings): number {
  if (st.mute) return 0;
  const raw = typeof st.sfxVolume === 'number' ? st.sfxVolume : 85;
  return Math.max(0, Math.min(1, raw / 100));
}

function getCrowdScale(st: AppSettings): number {
  if (st.mute || st.nocrowd) return 0;
  const raw = typeof st.crowdVolume === 'number' ? st.crowdVolume : 70;
  return Math.max(0, Math.min(1, raw / 100));
}

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;

      masterBus = audioCtx.createGain();
      masterBus.gain.value = 0.92;

      sfxBus = audioCtx.createGain();
      sfxBus.gain.value = getSfxScale(getSettings());

      sfxBus.connect(comp);
      comp.connect(masterBus);
      masterBus.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => undefined);
    }
    if (sfxBus) {
      sfxBus.gain.setTargetAtTime(getSfxScale(getSettings()), audioCtx.currentTime, 0.02);
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  ensureAudio();
}

function bindAutoAudioUnlock() {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;
  const onFirstGesture = () => {
    const ctx = ensureAudio();
    if (ctx && ctx.state === 'running' && crowdActive && !crowdSource) {
      setCrowdAudio(true);
    }
  };
  window.addEventListener('pointerdown', onFirstGesture, { passive: true });
  window.addEventListener('touchstart', onFirstGesture, { passive: true });
  window.addEventListener('keydown', onFirstGesture, { passive: true });
}
bindAutoAudioUnlock();

function getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Paul Kellet pink-noise approximation for warm, non-harsh stadium noise
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  noiseBuffer = buf;
  return buf;
}

export function snd(freq: number, dur = 0.12, type: OscillatorType = 'triangle', vol = 0.05, delay = 0) {
  const st = getSettings();
  if (st.mute || getSfxScale(st) <= 0) return;
  const ctx = ensureAudio();
  if (!ctx || !sfxBus) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start(now);
    o.stop(now + dur + 0.02);
  } catch {
    // ignore audio block
  }
}

function playNoiseBurst(dur: number, filterType: BiquadFilterType, freq: number, q: number, vol: number, delay = 0) {
  const st = getSettings();
  if (st.mute || getSfxScale(st) <= 0) return;
  const ctx = ensureAudio();
  if (!ctx || !sfxBus) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = getPinkNoiseBuffer(ctx);
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = ctx.createGain();
    const now = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(sfxBus);
    src.start(now, Math.random() * 1.5, dur + 0.03);
  } catch {
    // ignore
  }
}

function playThump(startFreq: number, endFreq: number, dur: number, vol: number, delay = 0) {
  const st = getSettings();
  if (st.mute || getSfxScale(st) <= 0) return;
  const ctx = ensureAudio();
  if (!ctx || !sfxBus) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime + delay;
    o.type = 'sine';
    o.frequency.setValueAtTime(startFreq, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start(now);
    o.stop(now + dur + 0.02);
  } catch {
    // ignore
  }
}

function playPeaWhistle(duration = 0.24, delay = 0, baseFreq = 2680, vol = 0.048) {
  const st = getSettings();
  if (st.mute || getSfxScale(st) <= 0) return;
  const ctx = ensureAudio();
  if (!ctx || !sfxBus) return;
  try {
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.03, now + duration * 0.4);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.98, now + duration);

    // Rapid pea-trill inside referee whistle
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(42, now);
    lfoGain.gain.setValueAtTime(115, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.018);
    g.gain.setValueAtTime(vol * 0.9, now + Math.max(0.02, duration - 0.045));
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(g);
    g.connect(sfxBus);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + duration + 0.02);
    lfo.stop(now + duration + 0.02);

    // Subtle breath air rush
    playNoiseBurst(duration * 0.9, 'bandpass', 3200, 1.8, vol * 0.28, delay);
  } catch {
    // ignore
  }
}

export function pulseCrowdRoar(intensity = 0.85) {
  const st = getSettings();
  const scale = getCrowdScale(st);
  if (scale <= 0 || !audioCtx || !crowdGainNode || !crowdPresenceFilter) return;
  try {
    const now = audioCtx.currentTime;
    const baseGain = 0.048 * scale;
    const peakGain = baseGain * (1 + intensity * 2.1);
    crowdGainNode.gain.cancelScheduledValues(now);
    crowdGainNode.gain.setValueAtTime(crowdGainNode.gain.value, now);
    crowdGainNode.gain.linearRampToValueAtTime(peakGain, now + 0.14);
    crowdGainNode.gain.exponentialRampToValueAtTime(Math.max(0.002, baseGain), now + 1.9 + intensity * 0.9);

    crowdPresenceFilter.frequency.cancelScheduledValues(now);
    crowdPresenceFilter.frequency.setValueAtTime(crowdPresenceFilter.frequency.value, now);
    crowdPresenceFilter.frequency.linearRampToValueAtTime(1320, now + 0.16);
    crowdPresenceFilter.frequency.exponentialRampToValueAtTime(840, now + 2.0);
  } catch {
    // ignore
  }
}

export const SFX = {
  tap: () => {
    playThump(580, 340, 0.04, 0.045);
    snd(740, 0.038, 'triangle', 0.024);
  },
  confirm: () => {
    snd(523.25, 0.075, 'triangle', 0.042, 0);
    snd(659.25, 0.11, 'triangle', 0.045, 0.055);
  },
  coin: () => {
    snd(987.77, 0.07, 'sine', 0.042, 0);
    snd(1318.51, 0.14, 'sine', 0.048, 0.06);
  },
  levelUp: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => snd(f, 0.16, 'triangle', 0.048, i * 0.07));
  },
  pass: () => {
    playThump(155, 58, 0.055, 0.055);
    playNoiseBurst(0.032, 'lowpass', 950, 0.8, 0.025);
  },
  kick: () => {
    playThump(195, 46, 0.085, 0.085);
    playNoiseBurst(0.045, 'bandpass', 1400, 1.0, 0.042);
  },
  shot: () => {
    playThump(230, 44, 0.11, 0.105);
    playNoiseBurst(0.06, 'bandpass', 1750, 0.9, 0.055);
  },
  save: () => {
    playThump(170, 70, 0.07, 0.075);
    playNoiseBurst(0.09, 'bandpass', 2100, 1.1, 0.048);
    pulseCrowdRoar(0.45);
  },
  woodwork: () => {
    [435, 688, 1120].forEach((f, idx) => snd(f, 0.32 - idx * 0.05, 'triangle', 0.048 - idx * 0.01));
    playNoiseBurst(0.05, 'highpass', 1800, 1.2, 0.03);
    pulseCrowdRoar(0.55);
  },
  foul: () => {
    playPeaWhistle(0.22, 0, 2720, 0.05);
  },
  card: () => {
    playPeaWhistle(0.14, 0, 2780, 0.052);
    playPeaWhistle(0.24, 0.17, 2680, 0.052);
    playThump(140, 62, 0.14, 0.055, 0.05);
  },
  var: () => {
    snd(880, 0.13, 'sine', 0.045, 0);
    snd(1174.66, 0.22, 'sine', 0.048, 0.12);
  },
  sub: () => {
    snd(440, 0.09, 'triangle', 0.036, 0);
    snd(587.33, 0.12, 'triangle', 0.04, 0.07);
  },
  goal: () => {
    pulseCrowdRoar(1.0);
    // Warm stadium brass fanfare chord
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      snd(f, 0.24, 'triangle', 0.055, i * 0.085);
      snd(f * 0.5, 0.26, 'sawtooth', 0.018, i * 0.085);
    });
    snd(1046.5, 0.42, 'triangle', 0.052, 0.36);
  },
  whistle: () => {
    playPeaWhistle(0.22, 0, 2680, 0.052);
    playPeaWhistle(0.32, 0.26, 2640, 0.052);
  },
  halfWhistle: () => {
    playPeaWhistle(0.18, 0, 2680, 0.05);
    playPeaWhistle(0.36, 0.22, 2620, 0.054);
  },
  fullWhistle: () => {
    playPeaWhistle(0.16, 0, 2680, 0.05);
    playPeaWhistle(0.16, 0.21, 2680, 0.05);
    playPeaWhistle(0.42, 0.42, 2620, 0.055);
  },
  win: () => {
    [392, 493.88, 587.33, 783.99].forEach((f, i) => snd(f, 0.24, 'triangle', 0.055, i * 0.1));
    snd(783.99, 0.42, 'sine', 0.04, 0.42);
  },
  lose: () => {
    [349.23, 311.13, 261.63, 220].forEach((f, i) => snd(f, 0.26, 'triangle', 0.042, i * 0.13));
  }
};

export function refreshAudioSettings() {
  const st = getSettings();
  if (audioCtx && sfxBus) {
    sfxBus.gain.setTargetAtTime(getSfxScale(st), audioCtx.currentTime, 0.02);
  }
  const crowdScale = getCrowdScale(st);
  if (crowdActive) {
    if (crowdScale <= 0) {
      setCrowdAudio(false);
      crowdActive = true; // remember match still wants crowd if re-enabled
    } else if (!crowdSource) {
      setCrowdAudio(true);
    } else if (audioCtx && crowdGainNode) {
      crowdGainNode.gain.setTargetAtTime(0.048 * crowdScale, audioCtx.currentTime, 0.04);
    }
  }
}

export function setCrowdAudio(on: boolean) {
  crowdActive = on;
  try {
    if (crowdSource) {
      crowdSource.stop();
      crowdSource.disconnect();
      crowdSource = null;
    }
    if (crowdLfo) {
      crowdLfo.stop();
      crowdLfo.disconnect();
      crowdLfo = null;
    }
    crowdGainNode = null;
    crowdPresenceFilter = null;

    const st = getSettings();
    const scale = getCrowdScale(st);
    if (!on || scale <= 0) return;

    const ctx = ensureAudio();
    if (!ctx || !masterBus) return;

    const src = ctx.createBufferSource();
    src.buffer = getPinkNoiseBuffer(ctx);
    src.loop = true;

    // Warm low stadium murmur + mid crowd presence
    const lowBody = ctx.createBiquadFilter();
    lowBody.type = 'lowpass';
    lowBody.frequency.value = 420;

    const presence = ctx.createBiquadFilter();
    presence.type = 'bandpass';
    presence.frequency.value = 840;
    presence.Q.value = 0.85;

    const gain = ctx.createGain();
    gain.gain.value = 0.048 * scale;

    // Gentle crowd swell modulation
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.18;
    lfoGain.gain.value = 0.008 * scale;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    src.connect(lowBody);
    src.connect(presence);
    lowBody.connect(gain);
    presence.connect(gain);
    gain.connect(masterBus);

    src.start();
    lfo.start();

    crowdSource = src;
    crowdGainNode = gain;
    crowdPresenceFilter = presence;
    crowdLfo = lfo;
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
