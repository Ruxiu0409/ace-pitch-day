import { writeFileSync } from 'node:fs';

const SR = 48000;
const TOTAL = 51.5;
const N = Math.ceil(TOTAL * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);

const DROP = 11.8, BEAT = 0.5, PRIZE = 39.3, FINAL = 44.8;
const POPS = [21.3, 37.3, 48.4];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 12345;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };

function add(t0, buf, gain = 1, pan = 0, send = 0) {
  const s = Math.floor(t0 * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < buf.length; i++) {
    const j = s + i; if (j < 0 || j >= N) continue;
    L[j] += buf[i] * gl; R[j] += buf[i] * gr;
    if (send) { sendL[j] += buf[i] * gl * send; sendR[j] += buf[i] * gr * send; }
  }
}

function pluck(freq, dur, bright = 0.5) {
  const n = Math.floor(dur * SR), p = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(p); for (let i = 0; i < p; i++) line[i] = rand();
  const out = new Float32Array(n); let idx = 0, last = 0;
  const damp = 0.996;
  for (let i = 0; i < n; i++) {
    const v = line[idx]; const nx = line[(idx + 1) % p];
    const avg = (v * (0.5 + bright * 0.5) + nx * (0.5 - bright * 0.5)) * damp;
    line[idx] = avg; idx = (idx + 1) % p;
    last = last * 0.3 + v * 0.7;
    out[i] = last * Math.min(1, i / 40);
  }
  return out;
}

function pad(freqs, dur, { attack = 1.5, release = 1.5, cutoff = 1200, detune = 0.006 } = {}) {
  const n = Math.floor(dur * SR); const out = new Float32Array(n);
  const ph = []; freqs.forEach((f) => [-1, 0, 1].forEach((d) => ph.push({ f: f * (1 + d * detune), p: Math.random() })));
  let y1 = 0, y2 = 0; const a = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
  for (let i = 0; i < n; i++) {
    let s = 0; for (const o of ph) { o.p += o.f / SR; o.p -= Math.floor(o.p); s += o.p * 2 - 1; }
    s /= ph.length;
    y1 += a * (s - y1); y2 += a * (y1 - y2);
    const t = i / SR; const env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release);
    out[i] = y2 * env;
  }
  return out;
}

function sine(f0, f1, dur, decay) {
  const n = Math.floor(dur * SR); const out = new Float32Array(n); let p = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; const f = f1 + (f0 - f1) * Math.exp(-t * 18); p += f / SR; out[i] = Math.sin(2 * Math.PI * p) * Math.exp(-t / decay); }
  return out;
}
const kick = () => { const k = sine(160, 45, 0.6, 0.18); for (let i = 0; i < 200; i++) k[i] += rand() * 0.3 * (1 - i / 200); return k; };
function noiseHit(dur, decay, hp = 0.9) {
  const n = Math.floor(dur * SR); const out = new Float32Array(n); let prev = 0;
  for (let i = 0; i < n; i++) { const w = rand(); out[i] = (w - prev * hp) * Math.exp(-(i / SR) / decay); prev = w; }
  return out;
}
const hat = () => noiseHit(0.08, 0.02, 0.98);
function snare() { const a = noiseHit(0.3, 0.08, 0.6); const b = sine(220, 180, 0.3, 0.06); for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.7 + b[i] * 0.5; return a; }
function impact() {
  const boom = sine(90, 32, 3.5, 1.1);
  const n = noiseHit(3.5, 0.6, 0.2);
  let y = 0; for (let i = 0; i < n.length; i++) { y += 0.05 * (n[i] - y); boom[i] += y * 1.6; }
  return boom;
}
function riser(dur) {
  const n = Math.floor(dur * SR); const out = new Float32Array(n); let y = 0, p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n; const cut = 300 + Math.pow(t, 2) * 9000; const a = 1 - Math.exp(-2 * Math.PI * cut / SR);
    y += a * (rand() - y); p += (200 + t * t * 1400) / SR;
    out[i] = (y * 0.8 + Math.sin(2 * Math.PI * p) * 0.25) * Math.pow(t, 1.6);
  }
  return out;
}
function bass(freq, dur) {
  const n = Math.floor(dur * SR); const out = new Float32Array(n); let p = 0, y = 0;
  for (let i = 0; i < n; i++) { p += freq / SR; const s = Math.sin(2 * Math.PI * p) * 0.8 + ((p % 1) * 2 - 1) * 0.25; y += 0.08 * (s - y); out[i] = y * Math.min(1, i / 100) * Math.min(1, (n - i) / 400); }
  return out;
}

const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const roots = [45, 41, 36, 43];

// Intro: dark drone + sparse piano motif
add(0, pad([midi(33), midi(40), midi(45)], DROP - 0.2, { attack: 3, release: 0.4, cutoff: 500 }), 0.9, 0, 0.4);
add(0, pad([midi(57), midi(60), midi(64)], DROP - 0.2, { attack: 4, release: 0.4, cutoff: 900 }), 0.35, 0, 0.6);
[[1.2, 76], [2.4, 72], [3.6, 69], [5.4, 76], [6.6, 74], [7.8, 72], [9.0, 71]].forEach(([t, m]) => add(t, pluck(midi(m), 3, 0.6), 0.45, 0.2, 0.7));
for (let t = 6.0; t < 9.9; t += 1.0) add(t, kick(), 0.25 + (t - 6) * 0.08, 0, 0.1);
add(9.9, riser(1.8), 0.9, 0, 0.3);
for (let i = 0; i < 16; i++) { const t = 9.9 + 1.7 * (1 - Math.pow(1 - i / 16, 1.8)); add(t, snare(), 0.15 + i * 0.025, 0, 0.2); }

// Drop
add(DROP, impact(), 1.3, 0, 0.6);
add(DROP, noiseHit(2.5, 0.7, 0.95), 0.35, 0, 0.6);
add(DROP, pad(chords[0].map((m) => midi(m)), 4.0, { attack: 0.05, release: 2, cutoff: 2500 }), 0.5, 0, 0.5);

// Drive section
const driveStart = DROP + 8 * BEAT;
for (let t = driveStart, b = 0; t < FINAL - 0.01; t += BEAT, b++) {
  const inBuild = t >= PRIZE - 2 * 2 && t < PRIZE;
  if (!inBuild || b % 2 === 0) add(t, kick(), 0.95, 0, 0.05);
  add(t + BEAT / 2, hat(), 0.22, 0.3, 0);
  if (b % 2 === 1) add(t, hat(), 0.1, -0.3, 0);
  if (b % 4 === 2 && t > 20) add(t, snare(), 0.35, 0, 0.25);
}
for (let t = driveStart, bar = 0; t < FINAL - 0.01; t += 4 * BEAT, bar++) {
  const c = chords[bar % 4], r = roots[bar % 4];
  add(t, pad(c.map((m) => midi(m)), 4 * BEAT + 0.3, { attack: 0.08, release: 0.3, cutoff: t > PRIZE ? 3200 : 1800 }), 0.42, 0, 0.35);
  for (let k = 0; k < 8; k++) add(t + k * BEAT / 2, bass(midi(r - 12), BEAT / 2 - 0.02), 0.55);
  const arpNotes = [c[0] + 12, c[1] + 12, c[2] + 12, c[1] + 12];
  for (let k = 0; k < 16; k++) {
    const tt = t + k * BEAT / 4;
    add(tt, pluck(midi(arpNotes[k % 4] + (t > PRIZE ? 12 : 0)), 0.6, 0.8), t > PRIZE ? 0.22 : 0.16, (k % 2 ? 0.4 : -0.4), 0.3);
  }
}
add(PRIZE - 2, riser(2), 0.8, 0, 0.3);
for (let i = 0; i < 16; i++) add(PRIZE - 2 + i * 0.125, snare(), 0.12 + i * 0.02, 0, 0.2);
add(PRIZE, impact(), 1.1, 0, 0.6);
add(PRIZE, noiseHit(2.5, 0.7, 0.95), 0.35, 0, 0.6);

// Mascot pops
function boing() { const n = Math.floor(0.22 * SR); const out = new Float32Array(n); let p = 0; for (let i = 0; i < n; i++) { const t = i / SR; p += (320 + 900 * (t / 0.22)) / SR; out[i] = Math.sin(2 * Math.PI * p) * Math.exp(-t * 14) * 0.9; } return out; }
POPS.forEach((t) => { add(t, boing(), 0.55, 0.5, 0.3); add(t + 0.05, pluck(midi(84), 0.4, 0.9), 0.35, 0.5, 0.3); });

// Final
add(FINAL, impact(), 1.0, 0, 0.7);
add(FINAL, pad([midi(45), midi(57), midi(60), midi(64), midi(69)], TOTAL - FINAL, { attack: 0.1, release: 4, cutoff: 2200 }), 0.55, 0, 0.6);
[[FINAL + 0.5, 76], [FINAL + 1.3, 72], [FINAL + 2.1, 74], [FINAL + 3.2, 69]].forEach(([t, m]) => add(t, pluck(midi(m), 3.5, 0.6), 0.45, 0.15, 0.7));

// Sidechain-style pump on the drive section pads/bass
// (applied to the whole bus between driveStart and FINAL, keyed to beats)
for (let i = Math.floor(driveStart * SR); i < Math.floor(FINAL * SR) && i < N; i++) {
  const ph = ((i / SR - driveStart) % BEAT) / BEAT;
  const g = 0.55 + 0.45 * Math.min(1, ph * 4);
  L[i] *= g; R[i] *= g;
}

// Reverb send (Schroeder)
function reverb(inp, combs, aps) {
  const out = new Float32Array(N);
  for (const [d, fb] of combs) { const buf = new Float32Array(d); let idx = 0, lp = 0; for (let i = 0; i < N; i++) { const y = buf[idx]; lp = y * 0.7 + lp * 0.3; buf[idx] = inp[i] + lp * fb; idx = (idx + 1) % d; out[i] += y; } }
  for (const d of aps) { const buf = new Float32Array(d); let idx = 0; for (let i = 0; i < N; i++) { const b = buf[idx]; const y = -out[i] + b; buf[idx] = out[i] + b * 0.5; idx = (idx + 1) % d; out[i] = y; } }
  return out;
}
const rl = reverb(sendL, [[1557, 0.86], [1617, 0.86], [1491, 0.86], [1422, 0.86]].map(([d, f]) => [d * 2, f]), [225, 556]);
const rr = reverb(sendR, [[1617, 0.86], [1557, 0.86], [1356, 0.86], [1188, 0.86]].map(([d, f]) => [d * 2, f]), [241, 579]);
for (let i = 0; i < N; i++) { L[i] += rl[i] * 0.12; R[i] += rr[i] * 0.12; }

let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = 0.89 / peak;
const fadeOut = (i) => { const t = i / SR; return t > TOTAL - 2.5 ? Math.max(0, (TOTAL - t) / 2.5) : 1; };
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const f = fadeOut(i) * norm;
  pcm.writeInt16LE(Math.round(Math.tanh(L[i] * f * 1.1) * 32000), 44 + i * 4);
  pcm.writeInt16LE(Math.round(Math.tanh(R[i] * f * 1.1) * 32000), 46 + i * 4);
}
writeFileSync(new URL('./music.wav', import.meta.url), pcm);
console.log('music.wav', TOTAL, 's, peak', peak.toFixed(2));
