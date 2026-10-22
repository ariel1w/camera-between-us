// plays the whole piece with the voice over (sound muted at the output) and logs, ten times a second,
// the level of the voice and of everything else, so tools/mix_report.py can check every line
// usage: xvfb-run -a node tools/mix_sweep.mjs http://127.0.0.1:8765/ out.jsonl [speedIndex]
import { chromium } from 'playwright-core';
import fs from 'fs';
const [url, out, spd = '5'] = process.argv.slice(2);
const b = await chromium.launch({ headless: false, executablePath: process.env.CHROME, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGE ERROR', e.message));
await p.goto(url);
await p.waitForFunction(() => window.cbu && document.querySelector('#begin'), null, { timeout: 120000 });
await p.evaluate(() => { localStorage.setItem('cbu-vo', 'duo'); document.querySelector('#begin').onclick(); });
await p.waitForFunction(() => window.cbu.score.ready, null, { timeout: 120000 });
await p.waitForTimeout(5000);
await p.evaluate(i => { document.querySelectorAll('#speeds button')[+i].click(); document.querySelector('#play').click(); }, spd);
const f = fs.createWriteStream(out);
const t0 = Date.now();
for (;;) {
  const r = await p.evaluate(() => {
    const c = window.cbu, pos = c.pos, sl = c.slots;
    let k = sl.findIndex(s => pos >= s.start && pos < s.start + s.len); if (k < 0) k = sl.length - 1;
    const s = sl[k], m = c.score.meterNow || {};
    return { k, kind: s.kind, sec: s.sec, li: s.li, who: s.line && s.line.s, vo: c.vo.slot, vp: c.vo.el.paused, bg: m.bg, v: m.v, cut: m.cut, on: m.on, rg: c.score.rider ? 20 * Math.log10(c.score.rider.gain.value + 1e-9) : 0, auto: c.auto };
  });
  r.t = (Date.now() - t0) / 1000; f.write(JSON.stringify(r) + '\n');
  if (r.kind === 'credits' || r.t > 4 * 3600) break;
  await p.waitForTimeout(100);
}
f.end(); await Promise.race([b.close(), new Promise(r => setTimeout(r, 5000))]); process.exit(0);
