#!/usr/bin/env python3
"""The film's sound: events from the comp (events.json, cam.json) → SFX in one room, a restrained score, VO, ducking.

  python dump_events.py && python score.py   → mix.wav (then ffmpeg loudnorm to −16 LUFS, −3.5 dBTP)
"""
import json, sys, os
import numpy as np, soundfile as sf
from scipy import signal
sys.path.insert(0, os.path.expanduser("~/.claude/skills/onetake/scripts"))
from sfx_palette import Score, air, glass, wood, sub, bubble, SR

ev = json.load(open("events.json")); cam = json.load(open("cam.json"))
DUR = ev["T"]; N = int(DUR * SR)
s = Score(dur=DUR, T60=1.1)

for e in ev["events"]:
    t, k, pan, v = e["t"], e["kind"], e["pan"] * 0.6, e["v"]
    if k == "paper":
        s.place(air(0.28, 1400, 4200, 0.9, 0.3), t, gain=0.22 * v, pan=pan, send=0.25); s.place(wood(1800, 0.04), t + 0.02, gain=0.10 * v, pan=pan, send=0.2)
    elif k == "slide":
        s.place(air(0.8, 500, 1600, 1.2, 0.5), t, gain=0.16 * v, pan=pan, send=0.3)
    elif k == "click":
        s.place(wood(900, 0.05), t, gain=0.35 * v, pan=pan, send=0.2); s.place(wood(700, 0.05), t + 0.06, gain=0.22 * v, pan=pan, send=0.2)
    elif k == "land":
        s.place(glass(783.99, 1.1, 0.55), t, gain=0.16 * v, pan=pan, send=0.5)
    elif k == "tick":
        s.place(wood(1500, 0.04), t, gain=0.16 * v, pan=pan, send=0.15)
    elif k == "pop":
        s.place(bubble(480, 0.22), t, gain=0.45 * v, pan=pan, send=0.3); s.place(glass(1046.5, 0.5, 0.4), t + 0.03, gain=0.10 * v, pan=pan, send=0.4)
    elif k == "snap":
        s.place(wood(1700, 0.05), t, gain=0.45 * v, pan=pan, send=0.35)
    elif k == "drop":
        s.place(wood(240, 0.1), t, gain=0.30 * v, pan=pan, send=0.25)
    elif k == "whoosh":
        s.place(air(0.6, 300, 2800, 1.2, 0.4), t, gain=0.35 * v, pan=pan - 0.3, send=0.4, pan_to=pan)
    elif k == "slam":
        s.place(sub(52, 0.8), t, gain=0.85 * v, send=0.3); s.place(wood(150, 0.2), t, gain=0.7 * v, pan=pan, send=0.35)
    elif k == "trophy":
        s.place(sub(62, 1.1), t, gain=0.7 * v, send=0.35)
        for f in (523.25, 659.25, 783.99): s.place(glass(f, 1.8, 0.7), t + 0.02, gain=0.11 * v, pan=pan, send=0.55)
    elif k == "lid":
        s.place(wood(320, 0.08), t, gain=0.25 * v, pan=pan, send=0.3); s.place(air(0.5, 300, 1200, 1.0, 0.4), t, gain=0.15 * v, pan=pan, send=0.4)

# camera air: noise in two bands, brighter when close, as loud as the camera moves
ts = np.array(cam["t"]); sp = np.array(cam["speed"]); dep = np.array(cam["depth"])
tt = np.arange(N) / SR
spd = np.interp(tt, ts, sp); depth = np.interp(tt, ts, dep)
rng = np.random.default_rng(3); nz = rng.standard_normal(N)
lo = signal.sosfilt(signal.butter(2, [180, 700], "band", fs=SR, output="sos"), nz)
hi = signal.sosfilt(signal.butter(2, [1400, 5500], "band", fs=SR, output="sos"), nz)
amp = np.clip(spd, 0, 6) ** 1.3 * 0.012
camair = amp * ((1 - depth) * lo + depth * hi * 0.7)
sfx = s.mix(peak_db=-8.0)
sfx[:, 0] += camair * 0.9; sfx[:, 1] += camair * 0.9

# a restrained score: felt piano + warm pad, a soft pulse from the snap to the landing, a cadence on the end card
def piano(f, dur, vel=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (1.6 + h * 0.9)) for h, a in ((1, 1), (2, 0.42), (3, 0.18), (4, 0.08)))
    x *= np.minimum(1, t / 0.004) * vel
    return signal.sosfilt(signal.butter(2, 2600, fs=SR, output="sos"), x)
def pad(fs, dur, gain=0.05):
    n = int(dur * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * (1 + d) * t) for f in fs for d in (-0.003, 0, 0.003)) / (len(fs) * 3)
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.2)
    return x * env * gain
mus = np.zeros((N, 2))
def put(x, t, g=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(x));
    if i >= N: return
    mus[i:j, 0] += x[: j - i] * g * (1 - pan) ; mus[i:j, 1] += x[: j - i] * g * (1 + pan)
m = lambda n: 440 * 2 ** ((n - 69) / 12)
BEAT = 60 / 92
chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
motif = [76, 74, 72, 67, 69, 72, 71, 67]
for i, n in enumerate(motif):
    put(piano(m(n), 2.8, 0.32), 0.6 + i * BEAT * 2, pan=0.15)
for bar in range(int((DUR - 2) / (BEAT * 4))):
    t0 = bar * BEAT * 4; c = chords[bar % 4]
    put(pad([m(x - 12) for x in c], BEAT * 4 + 1.2, 0.05 if t0 < 16 else 0.065), t0)
    if 16.4 <= t0 < 31.5:
        for b in range(4):
            tb = t0 + b * BEAT
            put(piano(m(c[b % 3] + 12), 0.9, 0.16), tb, pan=-0.2 if b % 2 else 0.2)
            k = np.sin(2 * np.pi * 55 * np.arange(int(0.25 * SR)) / SR) * np.exp(-np.arange(int(0.25 * SR)) / SR * 18)
            if b % 2 == 0: put(k, tb, 0.18)
# the landing and the end cadence
for f in (60, 64, 67, 72): put(piano(m(f), 3.5, 0.28), 31.92)
for i, f in enumerate((67, 65, 64, 60)): put(piano(m(f), 3.2, 0.3), 37.7 + i * 0.42, pan=0.1)
for f in (48, 55, 60, 64, 67): put(piano(m(f), 4.5, 0.22), 39.4)
mus[int(41.0 * SR):] *= np.linspace(1, 0, N - int(41.0 * SR))[:, None]

# VO
vo = np.zeros(N)
NAR = [0.9, 4.5, 8.0, 10.3, 16.9, 21.6, 25.2, 30.3, 36.4]; MAS = [14.9, 28.1, 39.4]
for i, t in enumerate(NAR):
    x, _ = sf.read(f"vo/nar/t{i + 1}.wav"); x = x if x.ndim == 1 else x.mean(1); j = int(t * SR); vo[j:j + len(x)] += x[: N - j] * 0.9
for i, t in enumerate(MAS):
    x, _ = sf.read(f"vo/mas/p{i + 1}.wav"); x = x if x.ndim == 1 else x.mean(1); j = int(t * SR); vo[j:j + len(x)] += x[: N - j] * 0.95

# duck the music under the voice (−7 dB) and the big hits (−4 dB)
env = np.abs(signal.hilbert(vo)) if False else np.abs(vo)
env = signal.sosfilt(signal.butter(1, 4, fs=SR, output="sos"), env)
duck = 1 - 0.68 * np.clip(env / 0.025, 0, 1)
for e in ev["events"]:
    if e["kind"] in ("slam", "trophy"):
        i = int(e["t"] * SR); w = np.exp(-np.arange(int(0.8 * SR)) / SR * 5); j = min(N, i + len(w)); duck[i:j] *= 1 - 0.35 * w[: j - i]
mus *= duck[:, None]

sfx = sfx * 2.5
BREATHS = [(0.0, 0.88), (3.66, 4.42), (9.6, 10.28), (14.22, 14.86), (20.74, 21.56), (29.05, 29.5), (33.95, 34.5), (41.5, DUR)]
gate = np.ones(N)
for a, b in BREATHS:
    i, j = int(a * SR), min(N, int(b * SR)); r = int(0.18 * SR)
    gate[i:j] = 0
    if i - r > 0: gate[i - r:i] = np.minimum(gate[i - r:i], np.linspace(1, 0, r))
    if j + r < N and b < DUR: gate[j:j + r] = np.minimum(gate[j:j + r], np.linspace(0, 1, r))
mus *= gate[:, None]; sfx *= gate[:, None] ** 0.5
mix = sfx * 1.0 + mus * 1.0 + np.stack([vo, vo], 1)
mix = np.tanh(mix * 1.1) / 1.1
sf.write("mix.wav", mix.astype(np.float32), SR)
print("mix.wav", DUR, "s; peak", float(np.abs(mix).max()))

def db(x): return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-9)
for a, b, name in ((0.9, 3.6, "N1"), (4.6, 7.4, "N2"), (17.0, 20.6, "N5"), (21.0, 21.6, "gap"), (31.9, 32.8, "trophy"), (34.0, 36.3, "gap2"), (39.0, 41.0, "end")):
    i, j = int(a * SR), int(b * SR)
    print(f"{name:7s} vo {db(vo[i:j]):6.1f}  music {db(mus[i:j]):6.1f}  sfx {db(sfx[i:j]):6.1f} dBFS")
