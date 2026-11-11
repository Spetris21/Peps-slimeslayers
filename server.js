/* Slime Slayers - game server.
   Serves the game, keeps accounts (scrypt passwords, sessions), owns every account's progress (anti-cheat), runs matchmaking,
   parties and the dungeon instances (the simulation in public/dungeon.js runs here, so damage and loot can't be faked),
   the town events, the World Boss Raid, trading and the leaderboards. Guests play with their own local save.
   Run: npm install && npm start   (settings by environment variable: PORT, DATA_DIR, MAX_PLAYERS, MAX_PER_IP, ALLOWED_ORIGINS, TRUST_PROXY;
   see HOSTING.md for putting the game on a website)
   Owners: Parker & Wolfie. School project, remember to only play at home! */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
let WebSocketServer;
try { ({ WebSocketServer } = require('ws')); } catch (e) { console.error('Missing the "ws" package. Run:  npm install'); process.exit(1); }
const L = require('./public/logic.js'), C = L.C, W = L.W, SD = require('./public/dungeon.js');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const SAVE_EVERY = 10000;
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 300, MAX_PER_IP = +process.env.MAX_PER_IP || 12;   // connections: the whole server / one address (a family shares one)
// which web pages may open a game connection: by default only pages from this server itself (another site can't run the game against it)
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
// ============================================================ DATABASE (JSON file)
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { users: {}, emails: {}, sessions: {}, week: { id: '', scores: {} }, lastWeek: null, pending: {} };
try {
  if (fs.existsSync(DB_FILE)) db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
} catch (e) {
  console.error('db.json is broken, trying the backup:', e.message);
  try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE + '.bak', 'utf8'))); } catch (e2) { console.error('No usable backup, starting empty.'); }
}
for (const u in db.users) db.users[u].state = L.migrate(db.users[u].state);
let dirty = false;
function saveDb(sync) {
  if (!dirty && !sync) return;
  dirty = false;
  const data = JSON.stringify(db), tmp = DB_FILE + '.tmp';
  try {
    if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, DB_FILE + '.bak');
    fs.writeFileSync(tmp, data); fs.renameSync(tmp, DB_FILE);
  } catch (e) { console.error('Save failed:', e.message); dirty = true; }
}
setInterval(saveDb, SAVE_EVERY);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('Saving and shutting down...'); dirty = true; saveDb(true); process.exit(0); });
// online, one unexpected error must never take the whole server (and everyone's run) down: log it, keep going, save soon
process.on('uncaughtException', e => { console.error('Unexpected error (the server keeps running):', e); dirty = true; });
process.on('unhandledRejection', e => { console.error('Unexpected error (the server keeps running):', e); dirty = true; });

// ============================================================ HTTP (static files)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); return res.end('Bad request'); }   // a malformed address must never crash the server
  if (p === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok ' + clients.size); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    // files are read once and kept (squeezed with gzip for the browsers that take it); a browser that already has this version gets 304
    const tag = '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"', head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: tag,
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === tag) { res.writeHead(304, head); return res.end(); }
    const send2 = f => { const gz = /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) && f.gz, body = gz ? f.gz : f.buf; if (gz) head['Content-Encoding'] = 'gzip'; head['Content-Length'] = body.length; res.writeHead(200, head); res.end(req.method === 'HEAD' ? undefined : body); };
    const c = fileCache.get(file); if (c && c.tag === tag) return send2(c);
    fs.readFile(file, (err2, buf) => { if (err2) { res.writeHead(404); return res.end('Not found'); }
      const f = { tag, buf, gz: /\.(html|js|css|json|txt|svg)$/.test(file) && buf.length > 1024 ? zlib.gzipSync(buf, { level: 9 }) : null }; fileCache.set(file, f); send2(f); });
  });
});
const fileCache = new Map();

// ============================================================ HELPERS
const clients = new Map(); let nextId = 1;
const now = () => Date.now();
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;   // look-ups by a name a player typed never reach Object.prototype
const send = (c, o) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); };
const broadcast = (o, except) => { const m = JSON.stringify(o); for (const c of clients.values()) if (c.ready && c !== except && c.ws.readyState === 1) c.ws.send(m); };
const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : null;
const BAD = /\b(f+u+c+k+\w*|s+h+i+t+\w*|b+i+t+c+h+\w*|c+u+n+t+\w*|d+i+c+k+\w*|a+s+s+h+o+l+e+\w*|w+h+o+r+e+\w*|s+l+u+t+\w*)\b/gi;
const cleanText = t => String(t || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120).replace(BAD, m => '*'.repeat(m.length)).trim();
const sys = (m, c) => broadcast({ t: 'c', n: null, m, c });

function ctxFor(c) { const t = now(); return { now: t, ev: L.events(t) }; }
function markSnap(c) { c.snapDirty = true; dirty = true; }
function publicState(s) { return s; }
function lookOf(c) { return c.s ? c.s.look : (c.guestLook || null); }
function titleOf(c) { return c.s ? c.s.title : (c.guestTitle || ''); }
function levelOf(c) { return c.s ? c.s.level : c.guestLv || 1; }
function gearOf(c) { return c.s ? L.gearLook(c.s) : (c.guestGear || null); }
function playerInfo(c) { return { id: c.id, n: c.name, g: c.guest ? 1 : 0, lv: levelOf(c), x: c.pos.x, y: c.pos.y, z: c.pos.z, lk: lookOf(c), ti: titleOf(c), gl: gearOf(c), pt: c.party || 0 }; }
// guests report their own power when they join a party; cap it to what their level could possibly reach
function guestStats(c) {
  const st = c.guestStats || {}, lv = levelOf(c), cap = C.GEAR.POW * Math.pow(C.GEAR.GROWTH, lv - 1) * 2.45 * 1.8 * 1.3 * (1 + (lv - 1) * C.STAT_PER_LEVEL * C.STAT_POWER) * 1.6;
  const s = L.fresh(c.name); s.level = lv; s.cls = C.CLASSES[st.cls] ? st.cls : 'warrior'; s.spells[s.cls] = Array.isArray(st.spells) ? st.spells.slice(0, C.SPELL_SLOTS).map(String) : s.spells[s.cls];
  const out = SD.playerStats(s); out.ap = Math.min(num(st.ap, 1, 1e12) || out.ap, cap); out.gp = Math.min(num(st.gp, 1, 1e12) || out.gp, cap * 1.6); out.max = Math.min(num(st.max, 50, 1e12) || out.max, cap * 40); out.crit = Math.min(num(st.crit, 0, 0.6) || out.crit, 0.6);
  out.critMult = Math.min(num(st.critMult, 1, 3.5) || 2, 3.5); out.leech = 0; out.abil = Math.min(num(st.abil, 0, 3) || 0, 3); out.speed = Math.min(num(st.speed, 0.5, 2.5) || 1, 2.5); out.cdr = Math.min(num(st.cdr, 0, 0.4) || 0, 0.4);
  out.red = Math.min(num(st.red, 0, 0.8) || 0, 0.8); out.regen = 0; out.move = Math.min(Math.max(num(st.move, 1, 1.5) || 1, 1), 1.5); out.luck = Math.min(Math.max(num(st.luck, 1, 10) || 1, 1), 10);
  out.type = C.TYPES[st.type] ? st.type : (s.cls === 'mage' ? 'staff' : 'sword');
  return { s, st: out };
}

// ============================================================ ACCOUNTS
const fails = new Map(); // key -> [timestamps]
function tooMany(key, max) { const t = now(), a = (fails.get(key) || []).filter(x => t - x < 10 * 60000); fails.set(key, a); return a.length >= max; }
function fail(key) { const a = fails.get(key) || []; a.push(now()); fails.set(key, a); }
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
function newSession(u) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(token)] = { u, exp: now() + 30 * 86400000 }; dirty = true;
  return token;
}
async function register(c, d) {
  const name = String(d.u || '').trim(), pw = String(d.p || ''), email = String(d.e || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9_]{3,14}$/.test(name)) return authFail(c, 'Username: 3-14 letters, numbers or _');
  if (pw.length < 6 || pw.length > 72) return authFail(c, 'Password must be 6-72 characters');
  if (!/^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@]{2,}$/.test(email) || email.length > 100) return authFail(c, 'Enter a valid email');
  if (tooMany('reg:' + c.ip, 5)) return authFail(c, 'Too many new accounts from here. Try later.');
  const key = name.toLowerCase();
  if (own(db.users, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) return authFail(c, 'That username is taken');
  if (own(db.emails, email)) return authFail(c, 'That email already has an account');
  fail('reg:' + c.ip);
  const salt = crypto.randomBytes(16).toString('hex'), hash = (await scrypt(pw, salt)).toString('hex');
  if (own(db.users, key)) return authFail(c, 'That username is taken');
  db.users[key] = { name, email, salt, hash, created: now(), last: now(), state: L.fresh(name) };
  db.emails[email] = key; dirty = true;
  log('New account', name);
  login(c, key, newSession(key));
}
async function loginPw(c, d) {
  const id = String(d.u || '').trim().toLowerCase(), pw = String(d.p || '');
  if (tooMany('ip:' + c.ip, 10) || tooMany('u:' + id, 5)) return authFail(c, 'Too many tries. Wait a few minutes.');
  const key = own(db.users, id) ? id : own(db.emails, id);
  const u = typeof key === 'string' ? own(db.users, key) : undefined;
  const hash = await scrypt(pw, u ? u.salt : 'nosuchuser-salt');
  if (!u || !crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) {
    fail('ip:' + c.ip); fail('u:' + id);
    return authFail(c, 'Wrong username/email or password');
  }
  login(c, key, newSession(key));
}
function resume(c, d) {
  const sess = own(db.sessions, sha(String(d.token || '')));
  if (!sess || sess.exp < now() || !own(db.users, sess.u)) return authFail(c, 'Session expired. Please log in.', true);
  sess.exp = now() + 30 * 86400000; dirty = true;
  login(c, sess.u, null);
}
function authFail(c, err, quiet) { send(c, { t: 'auth', ok: false, err, quiet: !!quiet }); }

function login(c, key, token) {
  for (const o of clients.values()) if (o !== c && o.user === key) { send(o, { t: 'kick', m: 'You logged in somewhere else.' }); o.ws.close(); leave(o); }
  const u = db.users[key]; u.last = now();
  c.user = key; c.name = u.name; c.guest = false; c.s = u.state; c.s.name = u.name;
  enter(c, token);
  const d = L.daily(c.s, now());
  if (d) send(c, { t: 'fx', k: 'daily', ...d });
  deliverPending(c);
  checkMs(c);
  markSnap(c);
}
function guest(c, d) {
  let n = String(d.n || '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || ('Guest' + (1000 + Math.random() * 9000 | 0));
  if (own(db.users, n.toLowerCase())) n = n.slice(0, 12) + '_g';
  c.name = n; c.guest = true; c.s = null; c.guestLv = num(d.lv, 1, C.MAX_LEVEL) || 1;
  enter(c, null);
}
function enter(c, token) {
  c.ready = true;
  const others = [...clients.values()].filter(o => o.ready && o !== c).map(playerInfo);
  send(c, { t: 'welcome', id: c.id, name: c.name, guest: c.guest, token, s: c.s ? publicState(c.s) : null, time: now(), players: others, board: boardMsg(), raid: raidInfo(), parties: partyList() });
  broadcast({ t: 'j', p: playerInfo(c) }, c);
  log((c.guest ? 'Guest ' : 'Player ') + c.name + ' joined (' + clients.size + ' online)');
}
function deliverPending(c) {
  const p = own(db.pending, c.user); if (!Array.isArray(p) || !p.length) return;
  // rewards waiting for you (the weekly leaderboard). Old entries from before Update 7 were in gems: they pay gold now
  for (const r of p) { const g = L.give(c.s, L.clears(c.s, r.clears !== undefined ? +r.clears || 0 : (+r.gems || 0) * C.MIGRATE7.GEM)); send(c, { t: 'fx', k: 'msg', m: r.msg + ' +' + L.fmt(g) + ' gold!', c: '#ffd84a' }); }
  delete db.pending[c.user]; markSnap(c);
}

// ============================================================ WORLD BOSS RAID (shared by everyone online, counts hits so every level helps)
let raid = { active: false, hp: 0, max: 0, end: 0, window: 0, hits: new Map(), last: 0 };
function raidInfo() { return raid.active ? { hp: raid.hp, max: raid.max, end: raid.end, n: raid.hits.size, wb: raid.wb || 0 } : null; }
const wbName = () => (C.WORLD_BOSSES[raid.wb || 0] || C.WORLD_BOSSES[0]).n;
function startRaid(end) {
  const n = [...clients.values()].filter(c => c.ready).length;
  raid = { active: true, max: C.RAID_HP_PER_PLAYER * Math.max(1, n), hp: 0, end, window: end, hits: new Map(), last: 0, wb: Math.floor(now() / 3600000) % C.WORLD_BOSSES.length }; raid.hp = raid.max;
  sys('🐉 WORLD BOSS RAID! ' + wbName() + ' is attacking Duskhold. Everyone hit it together!', '#ff4a4a'); broadcast({ t: 'raid', a: 'start', r: raidInfo() });
}
function hitRaid(c, n) {
  if (!raid.active || !L.W.inHub(c.pos.x, c.pos.z) || Math.hypot(c.pos.x, c.pos.z) > 30) return;
  const t = now(); c.raidTok = Math.min(6, (c.raidTok ?? 6) + (t - (c.raidT || t)) / 1000 * 4); c.raidT = t; n = Math.min(n, Math.floor(c.raidTok)); if (n <= 0) return; c.raidTok -= n;
  raid.hp = Math.max(0, raid.hp - n); raid.hits.set(c.id, (raid.hits.get(c.id) || 0) + n);
  if (raid.hp <= 0) endRaid(true);
}
function endRaid(win) {
  if (!raid.active) return; raid.active = false;
  for (const [id, hits] of raid.hits) { const c = clients.get(id); if (!c) continue; let r = null;
    if (win && hits >= C.RAID_MIN_HITS) { if (c.s) { const rw = L.raidReward(c.s); L.give(c.s, rw.gold); markSnap(c); r = Object.assign({ ok: true }, rw); } else r = { ok: true, guest: 1 }; }
    send(c, { t: 'raid', a: 'end', win, hits, r }); }
  for (const c of clients.values()) if (c.ready && !raid.hits.has(c.id)) send(c, { t: 'raid', a: 'end', win, hits: 0 });
  sys(win ? '🏆 ' + wbName() + ' was defeated by ' + raid.hits.size + ' slayers!' : '💨 ' + wbName() + ' escaped...', win ? '#7dff6a' : '#ffcf8a');
}

// ============================================================ TRADING
const trades = new Map(); let nextTrade = 1;
function tradeOf(c) { return c.trade ? trades.get(c.trade) : null; }
function tradeSend(T) {
  for (const id of [T.a, T.b]) {
    const c = clients.get(id); if (!c) continue;
    const other = clients.get(id === T.a ? T.b : T.a);
    const oth = id === T.a ? T.b : T.a, oc = clients.get(oth), withItems = (cl, o) => ({ items: o.items, itemData: cl && cl.s ? o.items.map(u => L.item(cl.s, u)).filter(Boolean) : [] });
    send(c, { t: 'tr', a: 'state', id: T.id, with: other ? other.name : '?', mine: withItems(c, T.offer[id]), theirs: withItems(oc, T.offer[oth]),
      ready: !!T.ready[id], theirReady: !!T.ready[id === T.a ? T.b : T.a], go: T.go || 0, time: now() });
  }
}
function tradeEnd(T, msg, color) {
  trades.delete(T.id);
  for (const id of [T.a, T.b]) { const c = clients.get(id); if (c) { c.trade = 0; send(c, { t: 'tr', a: 'end', m: msg, c: color }); } }
}
function validOffer(s, offer) {
  let kinds = 0;
  for (const u of offer.items) { kinds++; if (!L.item(s, u) || L.isEquipped(s, u)) return false; }
  return kinds <= 12;
}
function tradeExecute(T) {
  const A = clients.get(T.a), B = clients.get(T.b);
  if (!A || !B || !A.s || !B.s) return tradeEnd(T, 'Trade cancelled (player left)', '#ff9a9a');
  const oa = T.offer[T.a], ob = T.offer[T.b];
  if (!validOffer(A.s, oa) || !validOffer(B.s, ob)) return tradeEnd(T, 'Trade failed: the gear changed. Nothing was swapped.', '#ff9a9a');
  if (!oa.items.length && !ob.items.length) return tradeEnd(T, 'Empty trade cancelled', '#ff9a9a');
  const fromBag = (s, o) => o.items.filter(u => { const it = L.item(s, u); return it && !it.st; }).length;   // stored items leave Storage, not the bag
  if (L.bagN(A.s) - fromBag(A.s, oa) + ob.items.length > L.invMax(A.s) || L.bagN(B.s) - fromBag(B.s, ob) + oa.items.length > L.invMax(B.s)) return tradeEnd(T, 'Trade failed: a backpack is full', '#ff9a9a');
  const move = (from, to, offer) => { const items = offer.items.map(u => L.item(from, u)); from.inv = from.inv.filter(it => !offer.items.includes(it.u)); if (from.prevW && offer.items.includes(from.prevW)) from.prevW = 0;
    for (const it of items) { it.u = to.uid++; delete it.st; it.nw = 1; to.inv.push(it); } };
  move(A.s, B.s, oa); move(B.s, A.s, ob);
  markSnap(A); markSnap(B); dirty = true; saveDb(true);
  try { fs.appendFileSync(path.join(DATA_DIR, 'trades.log'), JSON.stringify({ t: new Date().toISOString(), a: A.name, b: B.name, aGave: oa, bGave: ob }) + '\n'); } catch (e) {}
  log('Trade', A.name, '<->', B.name);
  tradeEnd(T, 'Trade complete! 🤝', '#7dff6a');
}
// duels: ask someone in town; if they accept, both go to the arena (weapons only, same health for both)
function onDuel(c, d) {
  const busy = q => !q || !q.ready || q.inst || (q.party && parties.get(q.party) && parties.get(q.party).state === 'run');
  if (d.a === 'req') { const o = clients.get(num(d.to, 0, 1e9) | 0); if (!o || o === c) return; if (busy(c) || busy(o)) return send(c, { t: 'fx', k: 'msg', m: 'You both need to be in town (not in a run)', c: '#ff9a9a' });
    const t = now(); if (c.duelT && t - c.duelT < 5000) return; c.duelT = t; o.duelFrom = c.id; send(o, { t: 'duel', a: 'req', from: c.id, n: c.name }); send(c, { t: 'fx', k: 'msg', m: 'Duel request sent to ' + o.name, c: '#ffd84a' }); return; }
  if (d.a === 'dec') { const o = clients.get(c.duelFrom); c.duelFrom = 0; if (o) send(o, { t: 'fx', k: 'msg', m: c.name + ' declined the duel', c: '#ff9a9a' }); return; }
  if (d.a === 'acc') { const o = clients.get(c.duelFrom); c.duelFrom = 0; if (!o || busy(o) || busy(c)) return send(c, { t: 'fx', k: 'msg', m: 'That duel is no longer possible', c: '#ff9a9a' });
    for (const m of [c, o]) if (m.party) leaveParty(m, true);
    const P = { id: nextParty++, leader: o.id, members: [o.id, c.id], mode: 'duel', i: 0, df: 0, hc: false, open: false, state: 'lobby', created: now(), solo: true };
    parties.set(P.id, P); o.party = c.party = P.id; startRun(P); sys(o.name + ' and ' + c.name + ' are fighting a duel in the arena!', '#ffd84a'); }
}
function onTrade(c, d) {
  if (c.guest || !c.s) return send(c, { t: 'fx', k: 'msg', m: 'Log in to trade (guests cannot trade)', c: '#ff9a9a' });
  const T = tradeOf(c);
  if (d.a === 'req') {
    const o = clients.get(d.to);
    if (!o || !o.ready || o === c) return;
    if (o.guest) return send(c, { t: 'fx', k: 'msg', m: o.name + ' is a guest and cannot trade', c: '#ff9a9a' });
    if (T || o.trade) return send(c, { t: 'fx', k: 'msg', m: 'One of you is already trading', c: '#ff9a9a' });
    if (c.lastReq && now() - c.lastReq < 4000) return;
    c.lastReq = now(); o.reqFrom = { id: c.id, t: now() };
    send(o, { t: 'tr', a: 'req', from: c.id, name: c.name });
    send(c, { t: 'fx', k: 'msg', m: 'Trade request sent to ' + o.name, c: '#bfe8ff' });
  } else if (d.a === 'accept') {
    const o = clients.get(d.from);
    if (!o || !c.reqFrom || c.reqFrom.id !== o.id || now() - c.reqFrom.t > 30000 || T || o.trade || !o.s) return send(c, { t: 'fx', k: 'msg', m: 'That trade request expired', c: '#ff9a9a' });
    c.reqFrom = null;
    const NT = { id: nextTrade++, a: o.id, b: c.id, offer: { [o.id]: { items: [] }, [c.id]: { items: [] } }, ready: {}, go: 0 };
    trades.set(NT.id, NT); o.trade = c.trade = NT.id; tradeSend(NT);
  } else if (d.a === 'decline') {
    const o = clients.get(d.from); c.reqFrom = null;
    if (o) send(o, { t: 'fx', k: 'msg', m: c.name + ' declined the trade', c: '#ff9a9a' });
  } else if (!T) return;
  else if (d.a === 'offer') {
    const offer = { items: [] }; let kinds = 0;
    if (Array.isArray(d.items)) for (const u of d.items.slice(0, 12)) { const it = L.item(c.s, u); if (it && !L.isEquipped(c.s, u) && !offer.items.includes(u) && ++kinds <= 12) offer.items.push(u); }
    T.offer[c.id] = offer; T.ready = {}; T.go = 0; tradeSend(T);
  } else if (d.a === 'ready') {
    T.ready[c.id] = !!d.v;
    T.go = (T.ready[T.a] && T.ready[T.b]) ? now() + 3000 : 0;
    tradeSend(T);
  } else if (d.a === 'cancel') tradeEnd(T, c.name + ' cancelled the trade', '#ff9a9a');
}

// ============================================================ ACTIONS (account players; guests run the same rules locally)
const NEAR = 6; // leniency for lag
function act(c, d) {
  const s = c.s, t = now(), ctx = ctxFor(c), a = String(d.a || '');
  if (!s) return;
  if (c.lastAct && t - c.lastAct < 25) return; c.lastAct = t;
  let r;
  const town = () => L.W.inHub(c.pos.x, c.pos.z) && !c.inst;
  const nearHub = k => { const q = L.W.STN[k]; return q && town() && Math.hypot(c.pos.x - q.x, c.pos.z - q.z) < NEAR + 3; };
  switch (a) {
    case 'equip': r = L.equip(s, num(d.u, 0, 1e9) | 0); if (r.ok) broadcastLook(c); break;
    case 'store': r = L.store(s, num(d.u, 0, 1e9) | 0, !!d.on); break;
    case 'swap': r = L.swapWeapon(s); if (r.ok) broadcastLook(c); break;
    case 'unequip': r = L.unequip(s, String(d.slot || '')); if (r.ok) broadcastLook(c); break;
    case 'sell': r = Array.isArray(d.us) ? L.sell(s, d.us.slice(0, 80).map(u => num(u, 0, 1e9) | 0)) : { ok: false }; break;
    case 'autosell': r = L.setAutoSell(s, num(d.r, 0, 9) | 0, !!d.on); break;
    case 'upg': r = nearHub('smith') ? L.upgradeItem(s, num(d.u, 0, 1e9) | 0, num(d.n, 1, C.GEAR.UPGRADE_MAX) | 0 || 1) : { ok: false, err: 'Visit the Blacksmith' }; if (r.ok) broadcastLook(c); break;
    case 'upgAll': r = nearHub('smith') ? L.upgradeAll(s) : { ok: false, err: 'Visit the Blacksmith' }; if (r.ok) broadcastLook(c); break;
    case 'buyGear': r = nearHub('smith') ? L.buyGear(s, num(d.i, 0, 20) | 0, String(d.slot || '')) : { ok: false, err: 'Visit the Blacksmith' }; break;
    case 'stat': r = L.addStat(s, String(d.k || ''), num(d.n, 1, 500) | 0); break;
    case 'resetStats': r = town() ? L.resetStats(s) : { ok: false, err: 'Reset your stats in town' }; break;
    case 'cls': r = town() ? L.setClass(s, String(d.cls || '')) : { ok: false, err: 'Swap class in town' }; if (r.ok) broadcastLook(c); break;
    case 'spell': r = c.inst ? { ok: false, err: 'Change spells in town' } : L.setSpell(s, num(d.slot, 0, 9) | 0, d.id ? String(d.id) : ''); break;
    case 'showArmor': s.showArmor = !!d.on; r = { ok: true, on: s.showArmor }; broadcastLook(c); break;
    case 'seen': r = Object.assign(L.seen(s, d.u === 'all' ? 'all' : num(d.u, 0, 1e9) | 0), { quiet: 1 }); break;
    case 'gift': r = nearHub('gift') ? L.dailyGift(s, t, ctx, Math.random) : { ok: false, err: 'Open your gift at the Daily Gift chest' }; break;
    case 'title': r = L.setTitle(s, String(d.id || '')); if (r.ok) broadcastLook(c); break;
    case 'outfit': r = L.saveOutfit(s, num(d.i, 0, 2) | 0, d.look); break;
    case 'relic': { const I = c.inst && insts.get(c.inst), i = num(d.i, 0, 9) | 0; const rel = I && I.inst.mode === 'dungeon' && I.inst.i === i ? L.W.layout(i).relic : null;
      r = rel && Math.hypot(c.pos.x - rel.x, c.pos.z - rel.z) < NEAR ? L.relic(s, i) : { ok: false, quiet: 1 }; if (r.ok && !r.already) sys(c.name + ' found a hidden relic! (' + s.relics.length + '/8)', '#7affb8'); break; }
    case 'passClaim': r = L.passClaim(s, num(d.k, 0, 99) | 0); break;
    case 'bestiary': r = L.bestiaryClaim(s, num(d.i, 0, 20) | 0); break;
    case 'salvage': r = nearHub('smith') ? L.salvage(s, Array.isArray(d.us) ? d.us.slice(0, 60).map(Number) : []) : { ok: false, err: 'Visit the Blacksmith' }; break;
    case 'uprarity': r = nearHub('smith') ? L.upRarity(s, num(d.u, 0, 1e9) | 0, Math.random) : { ok: false, err: 'Visit the Blacksmith' }; if (r.ok) broadcastLook(c); break;
    case 'chest': r = town() ? L.openChest(s, String(d.id || ''), Math.random) : { ok: false, err: 'Open chests in town' }; break;
    case 'skin': r = L.setSkin(s, String(d.kind || ''), String(d.id || '')); if (r.ok) broadcastLook(c); break;
    case 'tut': r = L.tutDone(s); break;
    case 'mig7': r = L.seenMig7(s); break;
    case 'way': { const I = c.inst && insts.get(c.inst), i = num(d.i, 0, 9) | 0, w = L.W.wild.ways[i];
      r = I && I.inst.mode === 'wild' && w && Math.hypot(c.pos.x - w.x, c.pos.z - w.z) < NEAR + 2 ? L.wayshrine(s, i) : { ok: false, err: 'Stand at the wayshrine' }; if (r.ok && !r.already) sys(c.name + ' found a hidden wayshrine in the Wilds (' + r.n + '/' + C.WILD.WAYS + ')', '#9ad8ff'); break; }
    case 'lantern': { const I = c.inst && insts.get(c.inst), i = num(d.i, 0, 20) | 0; const ln = I && I.inst.mode === 'dungeon' && I.inst.i === i ? L.W.layout(i).lantern : null;
      r = ln && Math.hypot(c.pos.x - ln.x, c.pos.z - ln.z) < NEAR ? L.lantern(s, i) : { ok: false, quiet: 1 }; if (r.ok && !r.already) sys(c.name + ' found a lost lantern (' + r.n + '/' + L.ND + ')', '#ffd88a'); break; }
    default: return;
  }
  if (!r) return;
  send(c, { t: 'res', a, r, q: d.q });
  checkMs(c);
  markSnap(c);
}
function broadcastLook(c) { broadcast({ t: 'lk', id: c.id, lk: lookOf(c), ti: titleOf(c), gl: gearOf(c), lv: levelOf(c) }, c); }
function checkMs(c) { if (!c.s) return; const got = L.checkMilestones(c.s); if (got.length) { send(c, { t: 'fx', k: 'ms', ids: got }); markSnap(c); } }

// ============================================================ PARTIES + MATCHMAKING
const parties = new Map(); let nextParty = 1;
const insts = new Map(); let nextInst = 1;
function partyInfo(P) { return { id: P.id, leader: P.leader, mode: P.mode, i: P.i, df: P.df, hc: P.hc, open: P.open, state: P.state,
  members: P.members.map(id => { const m = clients.get(id); return m ? { id, n: m.name, lv: levelOf(m), cls: m.s ? m.s.cls : (m.guestStats && m.guestStats.cls) || 'warrior', g: m.guest ? 1 : 0 } : null; }).filter(Boolean) }; }
function partyList() { return [...parties.values()].filter(P => P.open && P.state === 'lobby' && P.members.length < C.PARTY_MAX).slice(0, 30).map(partyInfo); }
let listDirty = true;
function partySend(P) { const info = partyInfo(P); for (const id of P.members) { const m = clients.get(id); if (m) send(m, { t: 'mm', a: 'party', p: info }); } listDirty = true; }
function mmErr(c, m) { send(c, { t: 'mm', a: 'err', m }); }
// can this player enter this dungeon on this difficulty?
function canEnter(c, mode, i, df) {
  if (mode === 'pit' || mode === 'wild' || mode === 'tower' || mode === 'duel') return null; const d = C.DUNGEONS[i]; if (!d) return 'No such dungeon';
  if (mode === 'raid') { if (!C.RAIDS[i]) return 'No such raid'; if (c.s) return L.raidUnlocked(c.s, i) ? null : 'Clear ' + d.n + ' on Hard to open this raid'; return levelOf(c) < L.raidLevel(i) - 2 ? 'You need level ' + (L.raidLevel(i) - 2) : null; }
  if (c.s) { if (!L.dunUnlocked(c.s, i)) return 'You need level ' + L.dunLevel(i, 0); if (!L.diffUnlocked(c.s, i, df)) return C.DIFFS[df].n + ' needs level ' + L.dunLevel(i, df); }
  else if (levelOf(c) < L.dunLevel(i, df)) return 'You need level ' + L.dunLevel(i, df);
  return null;
}
function partyOf(c) { return c.party ? parties.get(c.party) : null; }
function leaveParty(c, quiet) {
  const P = partyOf(c); if (!P) return; leaveInst(c);
  P.members = P.members.filter(id => id !== c.id); c.party = 0; if (!quiet) send(c, { t: 'mm', a: 'left' });
  if (!P.members.length) { parties.delete(P.id); listDirty = true; return; }
  if (P.leader === c.id) P.leader = P.members[0];
  partySend(P);
}
function onMM(c, d) {
  const a = String(d.a || ''), mode = d.mode === 'pit' ? 'pit' : d.mode === 'raid' ? 'raid' : d.mode === 'wild' ? 'wild' : d.mode === 'tower' ? 'tower' : 'dungeon', i = num(d.i, 0, L.ND - 1) | 0, df = mode === 'dungeon' ? num(d.df, 0, 2) | 0 : 0, hc = !!d.hc && mode === 'dungeon';
  if (d.st && typeof d.st === 'object' && c.guest) c.guestStats = d.st;
  if (a === 'list') return send(c, { t: 'mm', a: 'list', list: partyList() });
  if (c.inst && a !== 'leave' && a !== 'leaveRun') return mmErr(c, 'Finish or leave your dungeon first');
  if (a === 'create' || a === 'solo') {
    const err = canEnter(c, mode, i, df); if (err) return mmErr(c, err);
    leaveParty(c, true);
    const P = { id: nextParty++, leader: c.id, members: [c.id], mode, i, df, hc, open: a !== 'solo' && d.open !== false, state: 'lobby', created: now(), solo: a === 'solo' };
    parties.set(P.id, P); c.party = P.id; partySend(P);
    if (a === 'solo') startRun(P);
    return;
  }
  if (a === 'join' || a === 'quick') {
    let P = a === 'join' ? parties.get(num(d.id, 0, 1e9) | 0) : [...parties.values()].filter(q => q.open && q.state === 'lobby' && q.mode === mode && q.i === i && q.df === df && q.hc === hc && q.members.length < C.PARTY_MAX).sort((x, y) => y.members.length - x.members.length)[0];
    if (!P && a === 'quick') return onMM(c, Object.assign({}, d, { a: 'create', open: true }));
    if (!P || P.state !== 'lobby' || !P.open) return mmErr(c, 'That party is gone or already in a dungeon');
    if (P.members.length >= C.PARTY_MAX) return mmErr(c, 'That party is full');
    const err = canEnter(c, P.mode, P.i, P.df); if (err) return mmErr(c, err);
    if (P.members.includes(c.id)) return partySend(P);
    leaveParty(c, true); P.members.push(c.id); c.party = P.id; partySend(P);
    for (const id of P.members) { const m = clients.get(id); if (m && m !== c) send(m, { t: 'fx', k: 'msg', m: c.name + ' joined your party', c: '#9ad8a0' }); }
    return;
  }
  const P = partyOf(c); if (!P) return mmErr(c, 'You are not in a party');
  if (a === 'leave') return leaveParty(c);
  if (a === 'leaveRun') return leaveInst(c, true);
  if (P.leader !== c.id) return mmErr(c, 'Only the party leader can do that');
  if (a === 'set' && P.state === 'lobby') { for (const id of P.members) { const m = clients.get(id), err = m && canEnter(m, mode, i, df); if (err) return mmErr(c, (m === c ? '' : m.name + ': ') + err); }
    Object.assign(P, { mode, i, df, hc, open: d.open !== false }); return partySend(P); }
  if (a === 'kick') { const m = clients.get(num(d.id, 0, 1e9) | 0); if (m && m !== c && P.members.includes(m.id)) { leaveParty(m, true); send(m, { t: 'mm', a: 'left', m: 'You were removed from the party' }); } return; }
  if (a === 'start' && P.state === 'lobby') return startRun(P);
}

// ============================================================ DUNGEON INSTANCES (the simulation runs here)
function startRun(P) {
  const members = P.members.map(id => clients.get(id)).filter(m => m && m.ready).slice(0, C.PARTY_MAX); if (!members.length) return;   // never more than 4 in a run
  for (const m of members) { const err = canEnter(m, P.mode, P.i, P.df); if (err) { for (const q of members) mmErr(q, m.name + ': ' + err); return; } }
  for (const m of members) leaveInst(m);
  const seed = (Math.random() * 1e9) | 0, players = members.map(m => ({ id: m.id, name: m.name, s: m.s || guestStats(m).s }));
  const inst = SD.create({ mode: P.mode, i: P.i, df: P.df, hc: P.hc, seed, players });
  for (const m of members) if (!m.s) { const p = inst.players.get(m.id); Object.assign(p, guestStats(m).st); p.hp = p.max; }   // guests: their own (capped) power
  SD.duelPrep(inst);   // ...except in a duel, where everyone has the same health
  const I = { id: nextInst++, party: P.id, inst, members: members.map(m => m.id), start: now(), dps: members.reduce((a, m) => a + (m.s ? L.maxDps(m.s) : inst.players.get(m.id).ap * 20), 0), tick: 0, ended: false };
  insts.set(I.id, I); P.state = 'run'; P.inst = I.id;
  for (const m of members) { m.inst = I.id; const p = inst.players.get(m.id);
    send(m, { t: 'dstart', inst: I.id, mode: P.mode, i: P.i, df: P.df, hc: P.hc, seed, me: { x: p.x, z: p.z, hp: p.hp, max: p.max },
      players: [...inst.players.values()].map(q => ({ id: q.id, n: q.name, cls: q.cls, max: q.max })) }); }
  partySend(P);
  log('Run', P.mode, P.mode === 'pit' || P.mode === 'duel' || P.mode === 'tower' || P.mode === 'wild' ? '' : C.DUNGEONS[P.i].n + (P.mode === 'raid' ? ' raid' : ''), C.DIFFS[P.df].n, P.hc ? 'HC' : '', 'x' + members.length);
}
// a player leaves a run early (or disconnects): partial rewards for the rooms the party cleared
function leaveInst(c, early) {
  const I = c.inst && insts.get(c.inst); c.inst = 0; if (!I) return;
  if (early && !I.inst.done) giveReward(I, c, true);
  SD.removePlayer(I.inst, c.id); I.members = I.members.filter(id => id !== c.id);
  if (!I.members.length) endInst(I);
  else for (const id of I.members) { const m = clients.get(id); if (m) send(m, { t: 'dg', e: [{ k: 'gone', who: c.id }] }); }
}
function endInst(I) { insts.delete(I.id); const P = parties.get(I.party); if (!P || P.inst !== I.id) return;
  if (P.solo) { parties.delete(P.id); for (const id of P.members) { const m = clients.get(id); if (m && m.party === P.id) { m.party = 0; send(m, { t: 'mm', a: 'left' }); } } listDirty = true; return; } // a solo run's party is only a wrapper
  P.state = 'lobby'; P.inst = 0; partySend(P); }
// rewards for one member (accounts: applied here; guests: they apply the same rules to their local save)
function giveReward(I, c, early) {
  if (I.paid && I.paid[c.id]) return; (I.paid || (I.paid = {}))[c.id] = 1;
  const inst = I.inst, secs = (now() - I.start) / 1000, sum = SD.summary(inst), me = sum.players.find(p => p.id === c.id);
  let r = null, err = '';
  if (c.s) {
    const ctx = ctxFor(c); ctx.party = inst.mode === 'duel' ? 1 : inst.n;
    if (inst.mode === 'pit') r = L.pitReward(c.s, inst.pitCleared, ctx, Math.random);
    else if (inst.mode === 'wild') r = L.wildReward(c.s, inst.wildCleared, ctx, Math.random);
    else if (inst.mode === 'tower') r = L.towerReward(c.s, inst.towerCleared, ctx, Math.random);
    else if (inst.mode === 'duel') r = L.duelReward(c.s, !!inst.duel && inst.duel.winner === c.id);
    else if (inst.mode === 'raid') { const minT = inst.result === 'clear' ? L.raidMinTime(inst.i, inst.n, I.dps) : 0;
      if (secs < minT) { err = 'That was impossibly fast. No rewards.'; log('Refused raid', c.name, secs.toFixed(0), '<', minT.toFixed(0)); }
      else r = L.bossRaidReward(c.s, inst.i, inst.result === 'clear' && !early, ctx, Math.random, secs);
      if (r && r.ok && r.cleared) sys(c.name + ' defeated the ' + C.MOBS[C.DUNGEONS[inst.i].boss].n + ' raid and won the ' + L.itemName(r.items[0]) + '!', C.GEAR_RARITY[r.items[0].r].c); }
    else { const minT = inst.result === 'clear' ? L.minClearTime(inst.i, inst.df, inst.n, inst.hc, I.dps) : 0;
      if (secs < minT) { err = 'That was impossibly fast. No rewards.'; log('Refused clear', c.name, secs.toFixed(0), '<', minT.toFixed(0)); }
      else r = L.runReward(c.s, inst.i, inst.df, inst.hc, inst.progress, ctx, Math.random, secs, SD.lootOf(inst, c.id), SD.bonusOf(inst, c.id)); }
    if (r && r.ok) { r.chg = L.afterRun(c.s, inst.mode, me, sum, now(), !!r.cleared); checkMs(c);
      if (inst.mode === 'raid' && r.cleared) addWeek(c, (inst.i + 1) * 40); else if (inst.mode === 'dungeon' && r.cleared) { addWeek(c, (inst.i + 1) * (inst.df + 1) * 10 * (inst.hc ? 1.5 : 1)); } else if (inst.mode === 'pit') addWeek(c, inst.pitCleared * 2); else if (inst.mode === 'wild') addWeek(c, inst.wildCleared);
      if (r.items) r.items.forEach(it => { if (it.r >= 5) sys(c.name + ' found ' + C.GEAR_RARITY[it.r].n.toUpperCase() + ' gear: ' + L.itemName(it) + '!', C.GEAR_RARITY[it.r].c); }); }
    checkMs(c); markSnap(c);
  }
  send(c, { t: 'dend', sum, r, err, early: !!early, secs: Math.round(secs), me, loot: err ? [] : SD.lootOf(inst, c.id), bonus: err ? { gold: 0 } : SD.bonusOf(inst, c.id) });
}
function instTick(dt) {
  for (const I of insts.values()) { try { tickInst(I, dt); } catch (e) { instError(I, e); } }
}
// a run that hits an unexpected error ends like a left run (everyone is paid for the rooms cleared); if even that fails, it is closed
function instError(I, e) {
  console.error('Run error (that run is closed, the others go on):', e); I.errs = (I.errs || 0) + 1;
  if (I.errs < 3) { I.inst.done = true; I.inst.result = I.inst.result || 'left'; return; }
  let sum; try { sum = SD.summary(I.inst); } catch (e2) { sum = { mode: I.inst.mode, res: 'left', i: I.inst.i, df: I.inst.df }; }
  for (const id of I.members) { const m = clients.get(id); if (m && m.inst === I.id) { m.inst = 0; send(m, { t: 'dend', sum, r: null, err: 'This run hit a problem and was closed', early: true, secs: 0, loot: [], bonus: { gold: 0 } }); } }
  try { endInst(I); } catch (e3) { insts.delete(I.id); }
}
function tickInst(I, dt) {
  {
    const inst = I.inst; if (!inst.done) SD.step(inst, dt);
    const e = SD.takeEvents(inst); I.buf = (I.buf || []).concat(e); I.tick++;
    if (I.tick % 2 === 0 || inst.done) {
      const pl = [...inst.players.values()].map(p => [p.id, Math.round(p.hp), p.dead ? (p.out ? 2 : 1) : 0, inst.t < p.buff ? 1 : 0, inst.t < p.shield ? 1 : 0, 0, p.rank || 0, p.chain || 0, Math.round(p.sty || 0)]);
      const msg = JSON.stringify({ t: 'dg', e: I.buf, m: SD.snap(inst), p: pl, r: inst.rooms.map(q => q.st[0]), st: +inst.t.toFixed(2), tl: +SD.timeLeft(inst).toFixed(1) }); I.buf = [];
      for (const id of I.members) { const m = clients.get(id); if (m && m.ws.readyState === 1) m.ws.send(msg); }
    }
    if (inst.done && !I.ended) { I.ended = true; for (const id of I.members) { const m = clients.get(id); if (m) giveReward(I, m, false); } I.endAt = now(); }
    if (I.ended && now() - I.endAt > 1500) { for (const id of I.members) { const m = clients.get(id); if (m && m.inst === I.id) m.inst = 0; } endInst(I); }
  }
}

// ============================================================ LEADERBOARDS
let boardCache = null, boardAt = 0;
function boardMsg() {
  if (boardCache && now() - boardAt < 4000) return boardCache;
  const users = Object.values(db.users);
  const all = users.map(u => [u.name, u.state.level, u.state.clears]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 10);
  const arena = users.filter(u => u.state.pitBest > 0).map(u => [u.name, u.state.pitBest, u.state.level]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const week = Object.entries(db.week.scores).map(([k, v]) => [db.users[k] ? db.users[k].name : k, Math.floor(v), db.users[k] ? db.users[k].state.level : 1]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const tower = users.filter(u => u.state.towerBest > 0).map(u => [u.name, u.state.towerBest, u.state.level]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const duel = users.filter(u => u.state.duelWins > 0).map(u => [u.name, u.state.duelWins, u.state.level]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  boardCache = { week, all, arena, tower, duel, last: db.lastWeek, weekId: db.week.id, rewards: C.WEEKLY_REWARDS }; boardAt = now();
  return boardCache;
}
function addWeek(c, v) { if (!c.user || !(v > 0)) return; db.week.scores[c.user] = (db.week.scores[c.user] || 0) + v; }
function weeklyCheck() {
  const wk = L.weekKey(now()); if (db.week.id === wk) return;
  if (db.week.id) {
    const top = Object.entries(db.week.scores).sort((a, b) => b[1] - a[1]).slice(0, C.WEEKLY_REWARDS.length);
    db.lastWeek = { id: db.week.id, top: top.map(([k, v]) => [db.users[k] ? db.users[k].name : k, Math.floor(v)]) };
    top.forEach(([k], i) => { (db.pending[k] = db.pending[k] || []).push({ clears: C.WEEKLY_REWARDS[i], msg: 'Weekly leaderboard #' + (i + 1) + ' reward!' }); });
    if (top.length) sys('New week! Last week\'s top slayer: ' + db.lastWeek.top[0][0] + '.', '#ffd000');
    for (const c of clients.values()) if (c.user) deliverPending(c);
  }
  db.week = { id: wk, scores: {} }; dirty = true; boardCache = null;
}

// ============================================================ CONNECTIONS
// a proxy in front of the server (same machine or local network) adds the player's address to X-Forwarded-For; from anywhere else the header is ignored,
// so nobody can dodge the login and sign-up limits by sending a made-up address
// (hosting services put their proxy on a private or carrier address: 100.64-127.x too; TRUST_PROXY=1 trusts the header from anywhere, only for a
// server that can only be reached through its host's proxy)
const isProxy = a => process.env.TRUST_PROXY === '1' || /^(::1|127\.|::ffff:127\.|10\.|::ffff:10\.|192\.168\.|::ffff:192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:172\.(1[6-9]|2\d|3[01])\.|(::ffff:)?100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|fc|fd)/i.test(a);
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
wss.on('connection', (ws, req) => {
  const sock = String(req.socket.remoteAddress || '?'), fwd = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean).pop() || '';
  const ip = fwd && isProxy(sock) ? fwd : sock, origin = String(req.headers.origin || '').toLowerCase();
  // a page from another website can't open a game connection (unless ALLOWED_ORIGINS lists it); tools and tests send no Origin at all
  if (origin && !(ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.includes(origin) : origin.replace(/^https?:\/\//, '') === String(req.headers.host || '').toLowerCase())) { ws.close(1008, 'Not allowed'); return; }
  if (clients.size >= MAX_PLAYERS) { ws.close(1013, 'The server is full, try again soon'); return; }
  let same = 0; for (const o of clients.values()) if (o.ip === ip) same++; if (same >= MAX_PER_IP) { ws.close(1013, 'Too many connections from your network'); return; }
  const c = { ws, id: nextId++, ip, ready: false, name: '', guest: true, s: null, user: null, party: 0, inst: 0,
    pos: { x: 0, y: 0, z: 8, w: 0, m: 0, a: '' }, snapDirty: false, lastSnap: 0, alive: true, msgN: 0, msgT: now(), chatT: 0, trade: 0 };
  clients.set(c.id, c);
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', async raw => {
    const t = now(); if (t - c.msgT > 1000) { c.msgT = t; c.msgN = 0; } if (++c.msgN > 120) return;
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || typeof d.t !== 'string') return;
    try { await onMsg(c, d); } catch (e) { console.error('Message error:', e); }
  });
  ws.on('close', () => leave(c)); ws.on('error', () => {});
});
async function onMsg(c, d) {
  if (!c.ready) {
    if (c.authBusy) return; c.authBusy = true;
    try { if (d.t === 'register') await register(c, d); else if (d.t === 'login') await loginPw(c, d); else if (d.t === 'resume') resume(c, d); else if (d.t === 'guest') guest(c, d); } finally { c.authBusy = false; }
    return;
  }
  switch (d.t) {
    case 'p': { // position + yaw + animation (others see you run, attack and emote)
      const x = num(d.x, -2000, 12000), y = num(d.y, -100, 300), z = num(d.z, -500, 500); if (x === null || y === null || z === null) return;
      c.pos = { x, y, z, w: num(d.w, -10, 10) || 0, m: num(d.m, 0, 30) || 0, a: typeof d.a === 'string' ? d.a.slice(0, 12) : '' };
      const I = c.inst && insts.get(c.inst); if (I && SD.move(I.inst, c.id, x, y, z, c.pos.w) === false && I.inst.mode === 'dungeon') { const now = Date.now(), pl = I.inst.players.get(c.id); if (pl && !pl.dead && (!c.fixT || now - c.fixT > 600)) { c.fixT = now; send(c, { t: 'fix', x: +pl.x.toFixed(2), z: +pl.z.toFixed(2) }); } }
      if (I) { const pl = I.inst.players.get(c.id); if (pl) { c.pos.x = pl.x; c.pos.z = pl.z; } }   // the server's own idea of where you are (speed-limited, walls and gates checked)
      if (c.guest) { c.guestLv = num(d.lv, 1, C.MAX_LEVEL) || 1; if (d.gl && typeof d.gl === 'object') c.guestGear = sanitizeGear(d.gl); }
      break; }
    case 'act': act(c, d); break;
    case 'mm': onMM(c, d); break;
    case 'atk': { const I = c.inst && insts.get(c.inst); if (I && d.a && typeof d.a === 'object') { const a = d.a; const kk = a.k === 'spell' ? 'spell' : 'basic';
        if (c.atkN === undefined || now() - c.atkW > 1000) { c.atkW = now(); c.atkN = 0; } if (++c.atkN > 24) break;   // spam guard: the simulation also rate-limits every move
        const ar = SD.attack(I.inst, c.id, { k: kk, combo: num(a.combo, 0, 7) | 0, ch: num(a.ch, 0, 1) || 0, id: typeof a.id === 'string' ? a.id.slice(0, 12) : '',
        targets: Array.isArray(a.targets) ? a.targets.slice(0, 16).map(u => num(u, 0, 1e9) | 0) : [], x: num(a.x, -2000, 12000), z: num(a.z, -500, 500), yaw: num(a.yaw, -10, 10) || 0 }); if (a.k === 'spell' && c.s && ar && ar.ok !== false) { c.s.spellsCast++; markSnap(c); } } break; }
    case 'dodge': { const I = c.inst && insts.get(c.inst); if (I) SD.dodge(I.inst, c.id); break; }
    case 'parry': { const I = c.inst && insts.get(c.inst); if (I) SD.parry(I.inst, c.id); break; }
    case 'rh': hitRaid(c, Math.floor(num(d.n, 0, 10) || 0)); break;
    case 'tr': onTrade(c, d); break;
    case 'duel': onDuel(c, d); break;
    case 'ping': { const t = now(); if (c.pingT && t - c.pingT < 1500) return; c.pingT = t; const P = c.party && parties.get(c.party), x = num(d.x, -2000, 12000), z = num(d.z, -500, 500); if (!P || x === null || z === null) return;
      for (const id of P.members) { const m = clients.get(id); if (m && m !== c) send(m, { t: 'ping', id: c.id, n: c.name, x, z }); } break; }
    case 'c': { const t = now(); if (t - c.chatT < 1200) return; c.chatT = t; const m = cleanText(d.m); if (!m) return; broadcast({ t: 'c', n: c.name, m, id: c.id }); break; }
    case 'look': {
      if (c.s) { const r = L.setLook(c.s, d.look); if (!r.ok) return send(c, { t: 'fx', k: 'msg', m: r.err, c: '#ff9a9a' }); markSnap(c); }
      else { const v = L.validLook(d.look, null); if (!v) return; v.outfit = v.outfit === 'tee' || v.outfit === 'coat' ? v.outfit : 'tee'; c.guestLook = v; c.guestTitle = ''; }
      broadcastLook(c); break; }
    case 'em': { const t = now(); if (c.emT && t - c.emT < 900) return; c.emT = t; if (!C.EMOTE_IDS.includes(d.e)) return; broadcast({ t: 'em', id: c.id, e: d.e }, c); break; }
    case 'test': if (process.env.SS_TEST_HOOKS) testHook(c, d); break;
    case 'logout': if (c.user) for (const k in db.sessions) if (db.sessions[k].u === c.user && d.all) delete db.sessions[k]; break;
  }
}
// test-only hooks (SS_TEST_HOOKS=1, used by tests/test-server.js): peek at a run, pretend time passed, force a clear
function testHook(c, d) {
  if (d.a === 'level' && c.s) { c.s.level = Math.max(1, Math.min(C.MAX_LEVEL, num(d.lv, 1, 999) | 0)); c.s.xp = 0; markSnap(c); return send(c, { t: 'test', a: 'level', lv: c.s.level }); }
  const I = c.inst && insts.get(c.inst); if (!I) return send(c, { t: 'test', a: d.a, none: 1 });
  if (d.a === 'inst') return send(c, { t: 'test', a: 'inst', players: [...I.inst.players.values()].map(p => ({ id: p.id, x: p.x, z: p.z, ap: p.ap, max: p.max, hp: p.hp, cls: p.cls, talIds: p.talIds, ultId: p.ultId, parryCd: p.parryCd, iframe: p.iframe, t: I.inst.t })), mobs: I.inst.mobs.filter(m => m.hp > 0).map(m => ({ u: m.uid, x: m.x, z: m.z, st: m.st })), rooms: I.inst.rooms.map(r => r.st), minT: I.inst.mode === 'raid' ? L.raidMinTime(I.inst.i, I.inst.n, I.dps) : L.minClearTime(I.inst.i, I.inst.df, I.inst.n, I.inst.hc, I.dps) });
  if (d.a === 'age') { I.start -= num(d.secs, 0, 1e5) * 1000; return send(c, { t: 'test', a: 'age' }); }
  if (d.a === 'win') { const inst = I.inst; inst.rooms.forEach(r => { r.st = 'clear'; }); inst.mobs.forEach(m => { m.hp = 0; }); SD._bossLoot(inst); inst.progress = inst.mode === 'raid' ? 1 : inst.lay.boss; inst.done = true; inst.result = 'clear'; inst.events.push({ k: 'done', res: 'clear', t: inst.t, progress: 5 }); return send(c, { t: 'test', a: 'win' }); }
}
function sanitizeGear(g) { const part = v => Array.isArray(v) && typeof v[0] === 'string' && L.KIND_N[v[0]] ? [v[0], num(v[1], 0, L.ND - 1) | 0, num(v[2], 0, C.GEAR_RARITY.length - 1) | 0] : null;   // every dungeon's tier (there are 12)
  const sk = Array.isArray(g.sk) ? [0, 1].map(k => { const q = typeof g.sk[k] === 'string' && L.cosm(g.sk[k]); return q && q.k === (k ? 'weapon' : 'armor') ? q.id : ''; }) : ['', ''];   // a guest's skins: only real ones
  return { w: part(g.w) || ['sword', 0, 0], a: part(g.a), h: part(g.h), g: part(g.g), b: part(g.b), cls: C.CLASSES[g.cls] ? g.cls : 'warrior', sk }; }
function leave(c) {
  if (!clients.has(c.id)) return;
  leaveParty(c, true); clients.delete(c.id);
  const T = tradeOf(c); if (T) tradeEnd(T, c.name + ' left, trade cancelled', '#ff9a9a');
  if (c.ready) { broadcast({ t: 'l', id: c.id }); log(c.name + ' left (' + clients.size + ' online)'); }
  dirty = true;
}

// ============================================================ GAME LOOP
let lastEv = '', lastWeekCheck = 0, lastList = 0;
setInterval(() => instTick(0.05), 50);
setInterval(() => {
  const t = now(), ev = L.events(t);
  if (ev.raid && !raid.active && raid.window !== ev.raid && !process.env.SS_TEST_RAID) startRaid(ev.raid);
  if (raid.active && t >= raid.end) endRaid(false);
  if (raid.active && t - raid.last > 300) { raid.last = t; broadcast({ t: 'rh', r: raidInfo() }); }
  const key = ['coins', 'luck'].filter(k => ev[k]).join();
  if (key !== lastEv) { if (ev.coins && !lastEv.includes('coins')) sys('2x GOLD for 5 minutes!', '#ffc83a');
    if (ev.luck && !lastEv.includes('luck')) sys('LUCKY LOOT! Better loot luck for 5 minutes!', '#c87aff'); lastEv = key; broadcast({ t: 'ev', time: t }); }
  for (const T of trades.values()) if (T.go && t >= T.go) tradeExecute(T);
  const pos = [];
  for (const c of clients.values()) {
    if (!c.ready) continue;
    pos.push([c.id, +c.pos.x.toFixed(2), +c.pos.y.toFixed(2), +c.pos.z.toFixed(2), +c.pos.w.toFixed(2), +c.pos.m.toFixed(1), levelOf(c), c.pos.a, c.inst || 0]);
    if (c.s && c.snapDirty && t - c.lastSnap > 200) { c.snapDirty = false; c.lastSnap = t; send(c, { t: 'st', s: c.s, time: t }); }
  }
  if (pos.length) broadcast({ t: 'u', p: pos });
  if (listDirty && t - lastList > 1000) { lastList = t; listDirty = false; const msg = { t: 'mm', a: 'list', list: partyList() }; for (const c of clients.values()) if (c.ready && !c.inst) send(c, msg); }
  if (t - lastWeekCheck > 30000) { lastWeekCheck = t; weeklyCheck(); }
}, 100);
let boardTick = 0;
setInterval(() => {
  const t = now();
  for (const c of clients.values()) {
    if (!c.ready || !c.s) continue;
    c.s.time += 1; checkMs(c);
    if (t % 60000 < 1000) { const d = L.daily(c.s, t); if (d) { send(c, { t: 'fx', k: 'daily', ...d }); markSnap(c); } }
  }
  if (++boardTick % 5 === 0) { boardCache = null; broadcast({ t: 'b', b: boardMsg() }); }
  for (const k in db.sessions) if (db.sessions[k].exp < t) { delete db.sessions[k]; dirty = true; }
  if (boardTick % 60 === 0) for (const [k, a] of fails) if (!a.some(x => t - x < 10 * 60000)) fails.delete(k);
}, 1000);
setInterval(() => { for (const c of clients.values()) { if (!c.alive) { c.ws.terminate(); leave(c); continue; } c.alive = false; try { c.ws.ping(); } catch (e) {} } }, 20000);
weeklyCheck();
// test hook only: SS_TEST_RAID=<hp> starts a World Boss Raid 1.5 seconds after start (used by tests/test-server.js)
if (process.env.SS_TEST_RAID) setTimeout(() => { C.RAID_HP_PER_PLAYER = +process.env.SS_TEST_RAID; startRaid(now() + 60000); }, 1500);
server.listen(PORT, () => log(`Slime Slayers running on http://localhost:${PORT}  (data in ${DATA_DIR})`));
module.exports = { server, db, clients, parties, insts };
