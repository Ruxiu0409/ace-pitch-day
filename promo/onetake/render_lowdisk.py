#!/usr/bin/env python3
"""render.py's shutter, but each finished frame is written as a JPEG instead of a PNG.

Same rules as onetake's scripts/render.py: 180° shutter centred on the frame time, captures per moving frame sized by
window.__motion (gap px apart, between smin and smax), the two ends captured first and a frame whose ends match written
as a hold, captures averaged in linear light. JPEG q95 keeps a 42 s 1080p film under ~400 MB on disk.

  python render_lowdisk.py comp.html --out frames/ [--workers 6] [--from 0 --to N]
"""
import argparse, asyncio, io, math, os, sys, time
import numpy as np
from PIL import Image
from multiprocessing import Process


def to_lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055) * 255.0


async def work(comp, out, frames, fps, dur, gap, smin, smax, shutter, wid):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist"])
        pg = await (await br.new_context(viewport={"width": 1920, "height": 1080})).new_page()
        await pg.goto("file://" + comp); await pg.evaluate("window.__ready")
        open_s = shutter / 360.0 / fps
        n = 0
        for f in frames:
            path = f"{out}/{f:05d}.jpg"
            if os.path.exists(path): continue
            t = f / fps
            async def cap(tt):
                await pg.evaluate(f"window.__seek({min(max(tt, 0.0), dur - 1e-6)})")
                return np.asarray(Image.open(io.BytesIO(await pg.screenshot(type="png"))).convert("RGB"), np.float64)
            if shutter <= 0:
                img = await cap(t)
            else:
                t0, t1 = max(t - open_s / 2, 0.0), min(t + open_s / 2, dur - 1e-6)
                try:
                    far = await pg.evaluate(f"window.__motion({t0}, {t1})")
                    S = min(smax, max(smin, math.ceil(far / gap)))
                except Exception:
                    S = 8
                a, b = await cap(t0), await cap(t1)
                if np.array_equal(a, b):
                    img = a
                else:
                    acc = to_lin(a) + to_lin(b)
                    for i in range(1, S - 1):
                        acc += to_lin(await cap(t0 + (t1 - t0) * i / (S - 1)))
                    img = to_srgb(acc / S)
            Image.fromarray(img.round().astype(np.uint8)).save(path, quality=95, subsampling=0)
            n += 1
            if n % 25 == 0: print(f"w{wid} {n}/{len(frames)} t={t:.2f}", flush=True)
        await br.close()


def run(comp, out, frames, fps, dur, gap, smin, smax, shutter, wid):
    asyncio.run(work(comp, out, frames, fps, dur, gap, smin, smax, shutter, wid))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("comp"); ap.add_argument("--out", required=True)
    ap.add_argument("--fps", type=int, default=30); ap.add_argument("--dur", type=float, default=43.5)
    ap.add_argument("--workers", type=int, default=6); ap.add_argument("--gap", type=float, default=24.0)
    ap.add_argument("--samples-min", type=int, default=4); ap.add_argument("--samples-max", type=int, default=12)
    ap.add_argument("--shutter", type=float, default=180.0)
    ap.add_argument("--from", dest="f0", type=int, default=0); ap.add_argument("--to", dest="f1", type=int, default=None)
    a = ap.parse_args()
    comp = os.path.abspath(a.comp); os.makedirs(a.out, exist_ok=True)
    N = round(a.dur * a.fps); f1 = a.f1 if a.f1 is not None else N
    allf = list(range(a.f0, f1))
    t = time.time()
    ps = [Process(target=run, args=(comp, os.path.abspath(a.out), allf[w::a.workers], a.fps, a.dur, a.gap, a.samples_min, a.samples_max, a.shutter, w)) for w in range(a.workers)]
    [p.start() for p in ps]; [p.join() for p in ps]
    print(f"done {len(allf)} frames in {time.time() - t:.0f}s")
