// Contact sheets for the phase reports: our screenshots next to the reference photos, as one PNG.
//   node tools/sheet.js out.png "Title" ref1.png:"caption" ours1.png:"caption" [ref2 ours2 ...]   (images in pairs, left = reference)
//   Set COLS=3 for a plain grid instead of pairs; SUB='...' sets the line under the title. A caption starting with '=' marks one of our own shots wherever it sits. Uses the browser driver (Playwright, or tools/pw-lite via NODE_PATH).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [out, title, ...items] = process.argv.slice(2);
if (!out || !items.length) { console.log('usage: node tools/sheet.js out.png "Title" img:caption ...'); process.exit(1); }
const cols = +(process.env.COLS || 2), W = +(process.env.W || 1400);
const cells = items.map(s => { const i = s.indexOf(':', s.lastIndexOf('.png') > 0 ? s.lastIndexOf('.png') : 0); const f = i > 0 ? s.slice(0, i) : s, cap = i > 0 ? s.slice(i + 1) : path.basename(f);
  return { src: 'data:image/png;base64,' + fs.readFileSync(path.resolve(f)).toString('base64'), cap }; });
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#141118;color:#ece6f2;font:600 15px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;width:${W}px}
h1{margin:0;padding:16px 20px 6px;font-size:22px;letter-spacing:.02em} .sub{padding:0 20px 12px;color:#a89fb6;font-size:13px}
.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;padding:0 20px 20px}
figure{margin:0;background:#1e1a24;border-radius:10px;overflow:hidden;border:1px solid #2e2836}
img{display:block;width:100%;height:auto;max-height:${Math.round(W / cols * 0.75)}px;object-fit:contain;background:#0c0b0f}
figcaption{padding:8px 10px;font-size:13px;color:#d8d0e4} figure.ref figcaption::before{content:'REFERENCE · ';color:#ffc84a;font-weight:800}
figure.ours figcaption::before{content:'SLIME SLAYERS · ';color:#7ad8ff;font-weight:800}
</style></head><body><h1>${esc(title)}</h1><div class="sub">${process.env.SUB !== undefined ? esc(process.env.SUB) : cols === 2 ? 'Left: the reference photo (the style to match). Right: our game, this build.' : ''}</div>
<div class="g">${cells.map((c, k) => `<figure class="${c.cap[0] === '=' ? 'ours' : cols === 2 ? (k % 2 ? 'ours' : 'ref') : ''}"><img src="${c.src}"><figcaption>${esc(c.cap.replace(/^=/, ''))}</figcaption></figure>`).join('')}</div></body></html>`;
(async () => {
  const b = await chromium.launch({}); const p = await b.newPage({ viewport: { width: W, height: 900 } });
  const tmp = path.resolve(out + '.html'); fs.writeFileSync(tmp, html); await p.goto('file://' + tmp); await new Promise(r => setTimeout(r, 400));
  const h = await p.evaluate(() => document.body.scrollHeight); await p._s('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: 1, mobile: false }).catch(() => 0);
  if (p.setViewportSize) await p.setViewportSize({ width: W, height: h }).catch(() => 0);
  await new Promise(r => setTimeout(r, 300)); await p.screenshot({ path: path.resolve(out), fullPage: true }); fs.unlinkSync(tmp); await b.close(); console.log('wrote', out, W + 'x' + h);
})().catch(e => { console.error(e); process.exit(1); });
