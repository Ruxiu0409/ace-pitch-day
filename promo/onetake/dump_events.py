"""comp → events.json (__events) and cam.json (camera speed and depth at 120 Hz) for score.py."""
import asyncio, json, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist"]); pg = await (await br.new_context(viewport={"width": 1920, "height": 1080})).new_page()
        await pg.goto("file://" + os.path.abspath("comp.html")); await pg.evaluate("window.__ready")
        ev = await pg.evaluate("window.__events()")
        cam = await pg.evaluate("""(() => { const t = [], speed = [], depth = []; const D = window.__meta.dur;
          for (let i = 0; i <= D * 120; i++) { const x = i / 120; t.push(x); speed.push(window.__camSpeed(x)); }
          return { t, speed, depth: t.map(() => 0) }; })()""")
        json.dump(ev, open("events.json", "w"), indent=1); json.dump(cam, open("cam.json", "w"))
        print(len(ev["events"]), "events")
        await br.close()
asyncio.run(main())
