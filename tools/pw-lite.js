// pw-lite: the small part of the Playwright API that the browser tests in tests/ use, driven straight over the Chrome DevTools
// protocol with the `ws` package. For computers without Playwright: it starts the installed Google Chrome (headless, with its own
// throwaway profile). Use it with  NODE_PATH=tools/pw-lite-modules  (that folder holds a `playwright` stub that loads this file).
//   PW_CHROME=/path/to/chrome   another Chrome or Chromium      PW_HEADFUL=1   show the window      PW_SWIFT=1  keep --use-gl=swiftshader
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const WS = require(path.join(__dirname, '..', 'node_modules', 'ws'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROMES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

class Conn {
  constructor(ws) { this.ws = ws; this.id = 0; this.wait = new Map(); this.subs = new Map();
    ws.on('message', m => { const d = JSON.parse(m); if (d.id && this.wait.has(d.id)) { const w = this.wait.get(d.id); this.wait.delete(d.id); d.error ? w.no(new Error(d.error.message + ' (' + w.method + ')')) : w.ok(d.result); return; }
      const h = this.subs.get(d.sessionId || ''); if (h) h(d.method, d.params || {}); }); }
  send(method, params, sessionId) { const id = ++this.id; const msg = { id, method, params: params || {} }; if (sessionId) msg.sessionId = sessionId;
    return new Promise((ok, no) => { this.wait.set(id, { ok, no, method }); this.ws.send(JSON.stringify(msg)); }); }
}

// key name -> what Chrome needs. Accepts Playwright names: 'w', 'KeyW', 'Digit1', 'Space', 'Enter', 'Escape', 'ArrowUp', 'Shift', 'F1'...
function keyInfo(k) {
  const named = { Space: [' ', 'Space', 32], Enter: ['Enter', 'Enter', 13], Escape: ['Escape', 'Escape', 27], Tab: ['Tab', 'Tab', 9], Backspace: ['Backspace', 'Backspace', 8],
    Shift: ['Shift', 'ShiftLeft', 16], Control: ['Control', 'ControlLeft', 17], Alt: ['Alt', 'AltLeft', 18], Meta: ['Meta', 'MetaLeft', 91],
    ArrowUp: ['ArrowUp', 'ArrowUp', 38], ArrowDown: ['ArrowDown', 'ArrowDown', 40], ArrowLeft: ['ArrowLeft', 'ArrowLeft', 37], ArrowRight: ['ArrowRight', 'ArrowRight', 39], Delete: ['Delete', 'Delete', 46] };
  if (named[k]) { const [key, code, kc] = named[k]; return { key, code, keyCode: kc, text: key === ' ' ? ' ' : key === 'Enter' ? '\r' : '' }; }
  if (k === ' ') return keyInfo('Space');
  let m = /^Key([A-Z])$/.exec(k); if (m) k = m[1].toLowerCase();
  m = /^Digit([0-9])$/.exec(k); if (m) k = m[1];
  m = /^F([0-9]{1,2})$/.exec(k); if (m) return { key: k, code: k, keyCode: 111 + +m[1], text: '' };
  if (k.length === 1) { const up = k.toUpperCase(), isL = /[a-z]/i.test(k), isD = /[0-9]/.test(k);
    const code = isL ? 'Key' + up : isD ? 'Digit' + k : ({ '-': 'Minus', '=': 'Equal', ',': 'Comma', '.': 'Period', '/': 'Slash', ';': 'Semicolon', "'": 'Quote', '[': 'BracketLeft', ']': 'BracketRight', '`': 'Backquote' })[k] || '';
    return { key: k, code, keyCode: isL || isD ? up.charCodeAt(0) : 0, text: k }; }
  return { key: k, code: k, keyCode: 0, text: '' };
}

class Mouse { constructor(p) { this.p = p; this.x = 0; this.y = 0; this.btn = 'none'; }
  ev(type, extra) { return this.p._s('Input.dispatchMouseEvent', Object.assign({ type, x: this.x, y: this.y, button: this.btn, buttons: this.btn === 'left' ? 1 : this.btn === 'right' ? 2 : 0, clickCount: 1 }, extra || {})); }
  async move(x, y, o) { const n = Math.max(1, (o && o.steps) | 0), x0 = this.x, y0 = this.y; for (let i = 1; i <= n; i++) { this.x = x0 + (x - x0) * i / n; this.y = y0 + (y - y0) * i / n; await this.ev('mouseMoved'); } }
  async down(o) { this.btn = (o && o.button) || 'left'; await this.ev('mousePressed'); }
  async up(o) { const b = (o && o.button) || this.btn || 'left'; this.btn = b; await this.ev('mouseReleased'); this.btn = 'none'; }
  async click(x, y, o) { await this.move(x, y); await this.down(o); if (o && o.delay) await sleep(o.delay); await this.up(o); }
  async wheel(dx, dy) { await this.p._s('Input.dispatchMouseEvent', { type: 'mouseWheel', x: this.x, y: this.y, deltaX: dx, deltaY: dy }); }
}
class Keyboard { constructor(p) { this.p = p; this.mods = 0; }
  async down(k) { const i = keyInfo(k); if (i.key === 'Shift') this.mods |= 8; await this.p._s('Input.dispatchKeyEvent', { type: i.text ? 'keyDown' : 'rawKeyDown', key: i.key, code: i.code, windowsVirtualKeyCode: i.keyCode, nativeVirtualKeyCode: i.keyCode, text: i.text || undefined, unmodifiedText: i.text || undefined, modifiers: this.mods }); }
  async up(k) { const i = keyInfo(k); if (i.key === 'Shift') this.mods &= ~8; await this.p._s('Input.dispatchKeyEvent', { type: 'keyUp', key: i.key, code: i.code, windowsVirtualKeyCode: i.keyCode, nativeVirtualKeyCode: i.keyCode, modifiers: this.mods }); }
  async press(k, o) { await this.down(k); if (o && o.delay) await sleep(o.delay); else await sleep(16); await this.up(k); }
  async type(t) { for (const ch of String(t)) await this.press(ch); }
}
class Locator { constructor(p, sel, n) { this.p = p; this.sel = sel; this.n = n || 0; }
  nth(n) { return new Locator(this.p, this.sel, n); } first() { return this.nth(0); }
  count() { return this.p.evaluate(s => document.querySelectorAll(s).length, this.sel); }
  boundingBox() { return this.p.evaluate(([s, n]) => { const e = document.querySelectorAll(s)[n]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, [this.sel, this.n]); }
  async click(o) { return this.p._clickSel(this.sel, this.n, o); }
  textContent() { return this.p.evaluate(([s, n]) => { const e = document.querySelectorAll(s)[n]; return e ? e.textContent : null; }, [this.sel, this.n]); }
}

class Page {
  constructor(br, sid, tid, vp) { this.br = br; this.sid = sid; this.tid = tid; this.vp = vp; this.h = {}; this.to = 30000; this.mouse = new Mouse(this); this.keyboard = new Keyboard(this); this.loaded = null; }
  _s(m, p) { return this.br.c.send(m, p, this.sid); }
  _emit(ev, a) { for (const f of this.h[ev] || []) try { f(a); } catch (e) { /* listener errors stay in the test */ } }
  async _init() {
    this.br.c.subs.set(this.sid, (m, p) => {
      if (m === 'Page.loadEventFired' && this.loaded) { const f = this.loaded; this.loaded = null; f(); }
      else if (m === 'Runtime.exceptionThrown') { const d = p.exceptionDetails || {}; this._emit('pageerror', { message: (d.exception && (d.exception.description || d.exception.value)) || d.text || 'error' }); }
      else if (m === 'Runtime.consoleAPICalled') { const txt = (p.args || []).map(a => a.value !== undefined ? String(a.value) : a.description || '').join(' '); this._emit('console', { type: () => p.type === 'warning' ? 'warning' : p.type, text: () => txt }); }
      else if (m === 'Page.javascriptDialogOpening') this._s('Page.handleJavaScriptDialog', { accept: true }).catch(() => 0);
      else if (m === 'Browser.downloadWillBegin' || m === 'Page.downloadWillBegin') { const dir = this.br.tmp, name = p.suggestedFilename, file = () => path.join(dir, name);
        this._emit('download', { suggestedFilename: () => name, url: () => p.url, path: async () => { for (let i = 0; i < 100 && !fs.existsSync(file()); i++) await sleep(100); return file(); },
          saveAs: async to => { for (let i = 0; i < 100 && !fs.existsSync(file()); i++) await sleep(100); await sleep(200); fs.copyFileSync(file(), to); } }); }
    });
    await this._s('Page.enable'); await this._s('Runtime.enable');
    await this._s('Emulation.setDeviceMetricsOverride', { width: this.vp.width, height: this.vp.height, deviceScaleFactor: 1, mobile: false });
    await this._s('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: this.br.tmp }).catch(() => 0);
    await this._s('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => 0);
  }
  on(ev, f) { (this.h[ev] = this.h[ev] || []).push(f); }
  setDefaultTimeout(ms) { this.to = ms; }
  addInitScript(fn, arg) { const src = typeof fn === 'function' ? '(' + fn.toString() + ')(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')' : String(fn); return this._s('Page.addScriptToEvaluateOnNewDocument', { source: src }); }
  url() { return this.evaluate(() => location.href); }
  async reload() { const done = new Promise(ok => { this.loaded = ok; }); await this._s('Page.reload'); await done; }
  async goto(url, o) { const t = (o && o.timeout) || this.to; const done = new Promise((ok, no) => { this.loaded = ok; setTimeout(() => no(new Error('goto timeout ' + url)), t); }); await this._s('Page.navigate', { url }); await done; }
  async evaluate(fn, arg) {
    const expr = typeof fn === 'function' ? '(' + fn.toString() + ')(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')' : String(fn);
    const r = await this._s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) { const d = r.exceptionDetails; throw new Error('evaluate: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text)); }
    return r.result ? r.result.value : undefined;
  }
  async waitForFunction(fn, arg, o) { const t0 = Date.now(), t = (o && o.timeout) || this.to; while (Date.now() - t0 < t) { if (await this.evaluate(fn, arg).catch(() => false)) return true; await sleep((o && o.polling) || 100); } throw new Error('waitForFunction timeout'); }
  waitForTimeout(ms) { return sleep(ms); }
  waitForEvent(ev, o) { return new Promise((ok, no) => { const f = a => ok(a); this.on(ev, f); setTimeout(() => no(new Error('waitForEvent timeout ' + ev)), (o && o.timeout) || this.to); }); }
  async screenshot(o) { const r = await this._s('Page.captureScreenshot', { format: 'png' }); const buf = Buffer.from(r.data, 'base64'); if (o && o.path) { fs.mkdirSync(path.dirname(o.path), { recursive: true }); fs.writeFileSync(o.path, buf); } return buf; }
  locator(sel) { return new Locator(this, sel); }
  // a stand-in for an element handle: null when nothing matches, else a small object (enough for the tests' truthiness checks)
  async $(sel) { const n = await this.evaluate(s => document.querySelectorAll(s).length, sel); return n ? new Locator(this, sel, 0) : null; }
  textContent(sel) { return this.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel); }
  innerText(sel) { return this.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel); }
  isVisible(sel) { return this.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; }, sel); }
  async waitForSelector(sel, o) { const t0 = Date.now(), t = (o && o.timeout) || this.to; while (Date.now() - t0 < t) { if (await this.evaluate(s => !!document.querySelector(s), sel)) return true; await sleep(100); } throw new Error('waitForSelector timeout ' + sel); }
  $$eval(sel, fn, arg) { return this.evaluate('(' + fn.toString() + ')(Array.from(document.querySelectorAll(' + JSON.stringify(sel) + ')), ' + JSON.stringify(arg === undefined ? null : arg) + ')'); }
  $eval(sel, fn, arg) { return this.evaluate('(' + fn.toString() + ')(document.querySelector(' + JSON.stringify(sel) + '), ' + JSON.stringify(arg === undefined ? null : arg) + ')'); }
  async _box(sel, n) { const t0 = Date.now(); while (Date.now() - t0 < this.to) {
      const b = await this.evaluate(([s, n]) => { const e = document.querySelectorAll(s)[n]; if (!e) return null; e.scrollIntoView({ block: 'center', inline: 'center' }); const r = e.getBoundingClientRect(); return r.width && r.height ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, [sel, n || 0]);
      if (b) return b; await sleep(100); } throw new Error('no element ' + sel); }
  async _clickSel(sel, n, o) { const b = await this._box(sel, n); await this.mouse.click(b.x, b.y, o); }
  click(sel, o) { return this._clickSel(sel, 0, o); }
  async focus(sel) { await this._box(sel, 0); await this.evaluate(s => { const e = document.querySelector(s); if (e.tabIndex < 0 && !/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(e.tagName)) e.tabIndex = -1; e.focus(); }, sel); }
  async fill(sel, v) { await this._box(sel, 0); await this.evaluate(([s, v]) => { const e = document.querySelector(s); e.focus(); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]); }
  async type(sel, t) { await this.focus(sel); await this.keyboard.type(t); }
  async press(sel, k) { await this.focus(sel); await this.keyboard.press(k); }
  async close() { await this.br.c.send('Target.closeTarget', { targetId: this.tid }).catch(() => 0); }
}

// like Playwright: every context (and every browser.newPage()) has its own storage, cookies and cache
class Context { constructor(br, o, id) { this.br = br; this.o = o || {}; this.id = id; } newPage() { return this.br._page(this.o, this.id); } close() { return this.br.c.send('Target.disposeBrowserContext', { browserContextId: this.id }).catch(() => 0); } }
class Browser {
  constructor(proc, c, tmp) { this.proc = proc; this.c = c; this.tmp = tmp; this.pages = []; }
  async newPage(o) { const cx = await this.newContext(o); return cx.newPage(); }
  async _page(o, ctxId) { const vp = (o && o.viewport) || { width: 1280, height: 720 };
    const { targetId } = await this.c.send('Target.createTarget', { url: 'about:blank', browserContextId: ctxId });
    const { sessionId } = await this.c.send('Target.attachToTarget', { targetId, flatten: true });
    const p = new Page(this, sessionId, targetId, vp); await p._init(); this.pages.push(p); return p; }
  async newContext(o) { const { browserContextId } = await this.c.send('Target.createBrowserContext', { disposeOnDetach: true }); return new Context(this, o, browserContextId); }
  async close() { try { await this.c.send('Browser.close'); } catch (e) { /* already gone */ } await sleep(300); try { this.proc.kill('SIGKILL'); } catch (e) { /* gone */ }
    try { fs.rmSync(this.tmp, { recursive: true, force: true }); } catch (e) { /* in use */ } }
}

const chromium = {
  async launch(o) {
    const exe = process.env.PW_CHROME || CHROMES.find(f => fs.existsSync(f)); if (!exe) throw new Error('pw-lite: no Chrome found (set PW_CHROME)');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pwlite-'));
    let extra = ((o && o.args) || []).filter(a => process.env.PW_SWIFT || !/use-gl=swiftshader|use-angle=swiftshader/.test(a));
    const args = [process.env.PW_HEADFUL ? '' : '--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + tmp, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
      '--allow-file-access-from-files', '--window-size=1400,900', ...extra, ...(process.env.PW_ARGS ? process.env.PW_ARGS.split(' ') : []), 'about:blank'].filter(Boolean);
    const proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    process.on('exit', () => { try { proc.kill('SIGKILL'); } catch (e) { /* gone */ } });
    let url = null; const t0 = Date.now();
    while (!url && Date.now() - t0 < 30000) { await sleep(100); try { const f = fs.readFileSync(path.join(tmp, 'DevToolsActivePort'), 'utf8').split('\n'); if (f[1]) url = 'ws://127.0.0.1:' + f[0].trim() + f[1].trim(); } catch (e) { /* not yet */ } }
    if (!url) { proc.kill(); throw new Error('pw-lite: Chrome did not start'); }
    const ws = new WS(url, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 }); await new Promise((ok, no) => { ws.once('open', ok); ws.once('error', no); });
    return new Browser(proc, new Conn(ws), tmp);
  }
};
module.exports = { chromium };
