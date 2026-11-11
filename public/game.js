/* Slime Slayers - game core: state, networking, matchmaking, dungeon runs (online: the server's simulation; offline: the same
   simulation running here), controls, camera, combat + spells, zones, main loop. */
(function () {
  'use strict';
  const L = SL, C = L.C, W = L.W, $ = q => document.querySelector(q), clamp = L.clamp, fmt = L.fmt, TAU = Math.PI * 2;
  const canvas = $('#c'), ov = $('#ov'), og = ov.getContext('2d');
  const E = TLEngine(canvas);
  if (!E.ok) { document.body.innerHTML = '<div style="padding:40px;font:20px sans-serif;color:#fff;background:#000;height:100%">Sorry, this browser has WebGL turned off, so the 3D game cannot start. Try Chrome or Edge, or turn on hardware acceleration in the browser settings.</div>'; return; }
  const M = E.M, T = M.trs;
  // if the graphics card resets (busy laptops do this), save and offer a reload instead of freezing
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); try { if (App && App.mode === 'guest') saveGuest(); } catch (x) {}
    if (document.getElementById('glLost')) return; const d = document.createElement('div'); d.id = 'glLost';
    d.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;background:#07060ae8;color:#e8e2ee;font:700 18px Outfit,sans-serif;text-align:center;padding:20px';
    d.innerHTML = '<div>The graphics card reset (busy laptops sometimes do this).<br>Your progress is saved.<br><br><button id="glReload" style="font-size:17px;padding:10px 22px">Reload the game</button></div>';
    document.body.appendChild(d); document.getElementById('glReload').onclick = () => location.reload(); });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  const CH = SSChar(E), AU = SSAudio, WD = SSWorld(E, L, CH); WD.build();
  const MB = SSMobs(E, L, WD, AU);
  const LT = SSLoot(E, L, CH, WD, AU);
  try { Promise.all([document.fonts.load('900 40px Outfit'), document.fonts.load('600 40px Outfit')]).then(() => { WD.refreshSigns(); UI.drawLogo(); }).catch(() => {}); } catch (e) {}
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---------- settings ----------
  const SET = Object.assign({ quality: 'auto', sfx: 0.7, music: 0.35, amb: 0.6, sens: 1, names: true, shake: true, nums: true, allNums: false, fps: false, shiftKey: true, cine: true }, store.get('ss_settings', {}));
  const touch = 'ontouchstart' in window && matchMedia('(pointer: coarse)').matches; if (touch) document.body.classList.add('touch');
  const QP = (() => { try { return new URLSearchParams(location.search).get('q'); } catch (e) { return null; } })();
  if (['low', 'med', 'high'].includes(QP)) SET.quality = QP;   // ?q=low in the address forces Low graphics (school laptops)
  let autoQ = SET.quality === 'auto', extraScale = 1;
  try { E.setQuality(autoQ ? (touch ? 'low' : 'med') : SET.quality); } catch (e) { try { E.setQuality('low'); } catch (x) {} }
  AU.setVol(SET.sfx, SET.music, SET.amb);

  // ---------- app state ----------
  const P = { x: W.SPAWN[0], y: 0, z: W.SPAWN[1], vy: 0, yaw: Math.PI, gr: true, coy: 0, jumps: 0, spd: 0, ox: 0, oz: 0, hp: 100, dead: false, deadT: 0, iframe: false, dodgeT: 0, dodgeCD: 0,
    kx: 0, kz: 0, hurtT: 9, atkLock: 0, lunge: 0, netA: '', netN: 0, dx: 0, dz: 0, mv: false, out: false, leap: null };
  const cam = { x: P.x, y: 0, z: P.z, yaw: 0, pitch: 0.36, dist: 13 };
  const App = { E, settings: SET, s: null, mode: null, online: false, inGame: false, others: new Map(), board: null, trade: null, tradeReq: null, myId: 1, myName: '', P, tOff: 0, zone: { t: 'hub', k: -1 }, near: null, raid: null,
    run: null, party: null, parties: [], results: null };
  window.App = App;
  App.now = () => Date.now() + App.tOff;
  App.audio = (n, a) => AU.play(n, a);
  App.ctx = () => { const now = App.now(); return { now, ev: L.events(now) }; };
  let me = CH.create(CH.look()), meKey = '';
  const lookCache = new Map();
  // avatar look + visible gear -> character look. gl = {w:[kind,tier,rarity], a, h, cls}
  function toCH(lk, gl) {
    const key = JSON.stringify(lk) + '|' + JSON.stringify(gl); let v = lookCache.get(key); if (v) return v;
    const base = Object.assign({}, lk || L.fresh().look), g = gl || { w: ['sword', 0, 0] }, w = g.w || ['sword', 0, 0], wt = C.GEAR_TIERS[w[1]] || C.GEAR_TIERS[0];
    const o = { cape: base.cape ? base.capeC : '', cape2: base.gear2, wpn: w[0] === 'hammer' || w[0] === 'dagger' || w[0] === 'greatsword' || w[0] === 'staff' ? w[0] : 'sword', weapon: wt.w, gem: w[2] >= 3 ? C.GEAR_RARITY[w[2]].c : wt.glow, wglow: wt.glow, wtier: w[1] | 0, emblem: false, blush: false, off: g.cls === 'rogue' && w[0] === 'dagger' ? 'dagger' : g.cls === 'paladin' && w[0] !== 'staff' ? 'shield' : '' };
    if (g.a) { const at = C.GEAR_TIERS[g.a[1]] || C.GEAR_TIERS[0]; o.outfit = (g.a[0] === 'robe' ? 'robe' : 'plate') + ((g.a[1] | 0) % 12); o.gear1 = at.g1; o.gear2 = at.g2; o.glow = at.glow; }
    if (g.h) { const ht = C.GEAR_TIERS[g.h[1]] || C.GEAR_TIERS[0]; o.helm = g.h[0] === 'hood' ? 'hood' : 'helm'; o.hc1 = ht.g1; o.hc2 = ht.g2; o.htier = (g.h[1] | 0) % 12; o.hglow = ht.glow; if (!g.a) o.glow = ht.glow; }
    if (g.g) { const gt = C.GEAR_TIERS[g.g[1]] || C.GEAR_TIERS[0]; o.glove = g.g[0] === 'wraps' ? 'wraps' : 'gauntlet'; o.gc1 = gt.g1; o.gc2 = gt.g2; o.gtier = (g.g[1] | 0) % 12; }
    if (g.b) { const bt = C.GEAR_TIERS[g.b[1]] || C.GEAR_TIERS[0]; o.boot = g.b[0] === 'boots' ? 'boots' : 'greaves'; o.bc1 = bt.g1; o.bc2 = bt.g2; o.btier = (g.b[1] | 0) % 12; }
    // Update 7: Epic or better gear glows round its edges in its rarity colour (the best piece you wear decides)
    { const best = Math.max(...[g.w, g.a, g.h, g.g, g.b].map(q => q ? q[2] | 0 : 0)); o.rar = g.a ? g.a[2] | 0 : 0; }   // Update 7 (feedback): no glow round the edges; the armour's rarity adds accessories instead
    const lk2 = Object.assign(base, o); CH.applySkins(lk2, g.sk);   // Update 7 (final): Shop skins only change looks
    v = CH.look(lk2);
    if (lookCache.size > 200) lookCache.clear(); lookCache.set(key, v); return v;
  }
  App.toCH = toCH;
  function myGear() { return L.gearLook(App.s); }
  function myLook() { const s = App.s, gl = myGear(), key = JSON.stringify(s.look) + JSON.stringify(gl); if (key !== meKey) { meKey = key; me.look = toCH(s.look, gl); } return me.look; }

  // ---------- network ----------
  let ws = null, wsReady = false, pendingAuth = null, reconnectT = 0, token = store.get('ss_token', null), savedName = store.get('ss_name', '');
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  App.send = send;
  function connect() {
    if (location.protocol === 'file:') { setOffline('Opened as a file: accounts need the server. Guest mode works offline (solo dungeons).'); return; }
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch (e) { setOffline('Could not reach the server.'); return; }
    ws.onopen = () => { wsReady = true; if (pendingAuth) { send(pendingAuth); pendingAuth = null; } else if (App.inGame) reauth(); };
    ws.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch (e) { return; } try { onMsg(d); } catch (e) { console.warn(e); } };
    ws.onclose = ev => { const was = App.online; wsReady = false; App.online = false; App.others.clear(); App.party = null; if (MB.raid) MB.endRaid(false); App.raid = null;
      const full = ev && ev.code === 1013, why = full && ev.reason ? ev.reason : '';   // the server is full / too many connections from your network: it says so, and we try again a bit later
      if (RUN && !RUN.local && !RUN.done) { endRunLocalFallback('The connection dropped. Your run was lost.'); }
      if (was) UI.sys(why ? why + '. Reconnecting...' : 'Disconnected. Reconnecting...', '#ffcf8a'); if (!App.inGame && !was) setOffline(why ? why + '. You can still play as a guest (solo dungeons).' : 'Server not reachable right now. You can still play as a guest (solo dungeons).');
      if (ev && ev.code === 1008) return;   // this page isn't allowed to connect (another website): no point retrying
      clearTimeout(reconnectT); reconnectT = setTimeout(connect, full ? 15000 : 3000); };
    ws.onerror = () => {};
  }
  function setOffline(msg) { $('#authnote').textContent = msg; $('#authnote').style.color = '#ffcf8a'; $('#loginbtn').disabled = $('#regbtn').disabled = location.protocol === 'file:'; }
  function reauth() { if (App.mode === 'account' && token) send({ t: 'resume', token }); else if (App.mode === 'guest') send({ t: 'guest', n: App.myName, lv: App.s.level }); }
  App.auth = function (msg) { AU.unlock(); if (wsReady) send(msg); else { pendingAuth = msg; if (!ws || ws.readyState > 1) connect(); setTimeout(() => { if (pendingAuth) UI.authMsg('Cannot reach the server. Try guest mode.'); }, 5000); } };
  App.playGuest = function (name) {
    AU.unlock(); name = String(name || '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || ('Guest' + (1000 + Math.random() * 9000 | 0));
    App.mode = 'guest'; App.myName = name; store.set('ss_gname', name);
    App.s = L.migrate(store.get('ss_guest_v2', null)); App.s.name = name;
    const d = L.daily(App.s, App.now()); if (d) setTimeout(() => dailyToast(d), 1500);
    enterGame(); mig7Note(); if (wsReady) send({ t: 'guest', n: name, lv: App.s.level });
  };
  // Update 7: an old save's gems, pets and talents were turned into gold when it loaded. Say so once, then forget it
  function mig7Note() { const m = App.s && App.s.mig7; if (!m) return; const parts = [];
    if (m.gems) parts.push(fmt(m.gems) + ' gems'); if (m.pets) parts.push(m.pets + ' pet' + (m.pets > 1 ? 's' : '')); if (m.talents) parts.push(m.talents + ' talent' + (m.talents > 1 ? 's' : '')); if (m.tomes) parts.push(m.tomes + ' ability tome' + (m.tomes > 1 ? 's' : ''));
    setTimeout(() => { UI.celebrate('Update 7', 'Gems, pets, talents and tomes are gone. Your ' + (parts.join(', ') || 'old extras') + ' became gold', '+' + fmt(m.gold) + ' gold', '#ffd84a'); AU.play('coin');
      UI.sys('Update 7: gems, pets, eggs, the Gem Shop and talents were removed. You were paid ' + fmt(m.gold) + ' gold for ' + (parts.join(', ') || 'them') + '.', '#ffd84a'); App.act('mig7'); }, 2200); }
  function dailyToast(d) { UI.toast('Day ' + d.streak + ' login streak! +' + fmt(d.gold) + ' gold', '#ffd84a'); AU.play('coin'); }
  function onMsg(d) {
    switch (d.t) {
      case 'auth': if (d.quiet) { token = null; store.set('ss_token', null); $('#resumebtn').classList.add('hidden'); if (App.inGame) location.reload(); return; } UI.authMsg(d.err); break;
      case 'welcome':
        App.myId = d.id; App.myName = d.name; App.online = true; App.tOff = d.time - Date.now();
        App.others.clear(); d.players.forEach(addOther); App.board = d.board; WD.board(d.board); App.parties = d.parties || [];
        if (!d.guest) { App.mode = 'account'; if (d.token) { token = d.token; store.set('ss_token', token); } store.set('ss_name', d.name); App.s = L.migrate(JSON.parse(JSON.stringify(d.s))); }
        if (d.raid && App.zone.t === 'hub') { App.raid = d.raid; MB.startRaid(d.raid); } else App.raid = d.raid;
        if (!App.inGame) enterGame(); else if (App.welcomed) UI.sys('Reconnected!', '#7dff6a');
        if (!d.guest) mig7Note();
        App.welcomed = true; if (d.guest) sendLook();
        UI.sys('Connected · ' + (d.players.length + 1) + ' online · press Enter to chat', '#9ad8a0'); break;
      case 'kick': alert(d.m); location.reload(); break;
      case 'st': { App.tOff = d.time - Date.now(); App.s = L.migrate(JSON.parse(JSON.stringify(d.s))); if (UI.cur && UI.cur !== 'avatar' && UI.cur !== 'trade') throttledRender(); break; }
      case 'res': handleRes(d.a, d.r); break;
      case 'fx': if (d.k === 'daily') dailyToast(d); else if (d.k === 'msg') UI.toast(d.m, d.c); else if (d.k === 'ms') milestones(d.ids); break;
      case 'u': for (const a of d.p) { if (a[0] === App.myId) continue; const o = App.others.get(a[0]); if (!o) continue; o.tx = a[1]; o.ty = a[2]; o.tz = a[3]; o.tyaw = a[4]; o.mv = a[5]; o.lv = a[6]; o.inst = a[8] || 0;
        if (a[7] !== undefined && a[7] !== o.a) { o.a = a[7]; otherAnim(o, a[7]); } } break;
      case 'j': addOther(d.p); UI.sys(d.p.n + (d.p.g ? ' (guest)' : '') + ' joined', '#9a94a8'); break;
      case 'l': { const o = App.others.get(d.id); if (o) UI.sys(o.n + ' left', '#9a94a8'); App.others.delete(d.id); if (UI.cur === 'trade' || UI.cur === 'board') UI.render(); break; }
      case 'c': UI.addChat(d.n, d.m, d.c); if (d.id === App.myId) bubble = { m: d.m, t: Tm }; else { const o = App.others.get(d.id); if (o) { o.bub = d.m; o.bt = Tm; } } break;
      case 'b': App.board = d.b; WD.board(d.b); if (UI.cur === 'board') UI.render(); break;
      case 'lk': { const o = App.others.get(d.id); if (o) { o.lk = d.lk; o.ti = d.ti; if (d.gl) o.gl = d.gl; if (d.lv) o.lv = d.lv; } break; }
      case 'em': { const o = App.others.get(d.id); if (o && o.st) CH.play(o.st, d.e); break; }
      case 'mm': onMM(d); break;
      case 'dstart': startOnlineRun(d); break;
      case 'dg': if (RUN && !RUN.local) onRunData(d); break;
      case 'fix': if (RUN && !RUN.local && !P.dead) tp(d.x, d.z); break;   // the server put you back (a closed gate, a sealed arena)
      case 'dend': onRunEnd(d); break;
      case 'duel': if (d.a === 'req') { App.duelReq = { from: d.from, n: d.n }; UI.show('duelreq'); AU.play('horn'); } break;
      case 'ping': pingFx(d.x, d.z, d.n); break;
      case 'raid':
        if (d.a === 'start') { App.raid = d.r; AU.play('roar'); UI.toast('WORLD BOSS RAID! ' + (C.WORLD_BOSSES[d.r.wb || 0] || C.WORLD_BOSSES[0]).n + ' attacks Duskhold!', '#ff9a8a'); if (App.zone.t === 'hub') MB.startRaid(d.r); }
        else { App.raid = null; MB.endRaid(d.win); AU.play(d.win ? 'win' : 'whoosh'); raidResult(d); } break;
      case 'rh': if (d.r) { App.raid = d.r; if (App.zone.t === 'hub') { if (!MB.raid) MB.startRaid(d.r); MB.raidInfo(d.r); } } break;
      case 'ev': AU.play('horn'); break;
      case 'tr':
        if (d.a === 'req') { App.tradeReq = { from: d.from, name: d.name }; UI.toast(d.name + ' wants to trade! Open Boards → Trade.', '#9ad8a0'); UI.sys(d.name + ' sent you a trade request (Boards → Trade).', '#9ad8a0'); if (UI.cur === 'trade' || UI.cur === 'board') UI.show('trade'); }
        else if (d.a === 'state') { App.trade = d; App.tradeReq = null; App.tOff = d.time - Date.now(); if (UI.cur !== 'trade') UI.show('trade'); else UI.render(); }
        else if (d.a === 'end') { App.trade = null; UI.tradeSel = {}; UI.tradeItems = []; UI.toast(d.m, d.c); if (UI.cur === 'trade') UI.render(); } break;
    }
  }
  let renderT = 0; function throttledRender() { const n = performance.now(); if (n - renderT > 250) { renderT = n; UI.render(); } }
  function addOther(p) { App.others.set(p.id, { id: p.id, n: p.n, g: p.g, lv: p.lv, lk: p.lk, ti: p.ti, gl: p.gl, x: p.x, y: p.y, z: p.z, tx: p.x, ty: p.y, tz: p.z, yaw: 0, tyaw: 0, mv: 0, bub: '', bt: 0, st: null, a: '', inst: 0 }); }
  function otherAnim(o, a) { if (!o.st || !a) return; const k = a.split('#')[0];
    const OA = { x: 'dashAtk', z: 'airSlam', l: 'airLand', c: 'heavyHold', r: 'heavyRel', m: 'heavySlam', p: 'parry', u: 'ultCast' };
    if (OA[k]) { CH.play(o.st, OA[k]); if (o.st.act) { o.st.act.dur = Math.min(o.st.act.dur, 2.5); o.st.act.ev = null; } return; }
    if (k[0] === 'a') CH.play(o.st, 'attack', { kind: o.gl && o.gl.w ? o.gl.w[0] : 'sword' }); else if (k === 'h') CH.play(o.st, 'hit'); else if (k === 'j') CH.play(o.st, 'doubleJump'); else if (k[0] === 's') { o.st.act = { a: 'slash3', dur: 0.6, hit: 9, combo: 1 }; o.st.actT = 0; }
    else if (k === 'd') o.roll = 0.0001; else if (k === 'v') CH.play(o.st, 'victory'); }
  App.tradeSend = o => send(Object.assign({ t: 'tr' }, o));
  function raidResult(d) {
    if (d.r && d.r.ok) { UI.celebrate(d.win ? 'Raid victory' : 'Raid over', d.hits + ' hits landed', '+' + fmt(d.r.gold) + ' gold', '#ffd84a'); AU.play('coin'); }
    else if (d.r && d.r.guest && App.mode === 'guest') { const rw = L.raidReward(App.s); L.give(App.s, rw.gold); saveGuest(); UI.celebrate(d.win ? 'Raid victory' : 'Raid over', d.hits + ' hits landed', '+' + fmt(rw.gold) + ' gold', '#ffd84a'); AU.play('coin'); }
    else if (d.hits > 0) UI.toast(d.win ? 'The Colossal Slime fell! Land ' + C.RAID_MIN_HITS + '+ hits next time for a reward.' : 'The Colossal Slime escaped...', '#ffcf8a');
    else if (d.win) UI.sys('The Colossal Slime was defeated in Duskhold.', '#9ad8a0');
  }
  function milestones(ids) {
    const ms = ids.map(id => C.MILESTONES.find(x => x.id === id)).filter(Boolean); if (!ms.length) return;
    const gold = ms.reduce((a, m) => a + L.clears(App.s, m.gold), 0);
    ms.slice(0, 3).forEach(m => UI.celebrate('Milestone', m.n, '+' + fmt(L.clears(App.s, m.gold)) + ' gold', '#d8b46a'));
    AU.play('milestone'); UI.sys('Milestone' + (ms.length > 1 ? 's' : '') + ': ' + ms.map(m => m.n).join(', ') + ' (+' + fmt(gold) + ' gold)', '#e8d8a8');
  }

  // ---------- actions (accounts: the server decides; guests: the same rules run here) ----------
  const nearSt = k => { const q = W.STN[k]; return !!q && W.inHub(P.x, P.z) && !RUN && Math.hypot(P.x - q.x, P.z - q.z) < 6; };
  App.nearSt = nearSt;
  App.act = function (a, args) {
    args = args || {}; AU.unlock();
    if (App.mode === 'account') { if (!App.online) { UI.toast('Reconnecting to the server...', '#ffcf8a'); return; } send(Object.assign({ t: 'act', a }, args)); return; }
    const r = localAct(a, args); handleRes(a, r); saveGuest();
  };
  function localAct(a, g) {
    const s = App.s, ctx = App.ctx(), now = ctx.now, town = W.inHub(P.x, P.z) && !RUN;
    switch (a) {
      case 'equip': return L.equip(s, +g.u);
      case 'store': return L.store(s, +g.u, !!g.on);
      case 'swap': return L.swapWeapon(s);
      case 'unequip': return L.unequip(s, g.slot);
      case 'sell': return L.sell(s, (g.us || []).map(Number));
      case 'autosell': return L.setAutoSell(s, g.r, g.on);
      case 'upg': return nearSt('smith') ? L.upgradeItem(s, +g.u, g.n | 0 || 1) : { ok: false, err: 'Visit the Blacksmith' };
      case 'upgAll': return nearSt('smith') ? L.upgradeAll(s) : { ok: false, err: 'Visit the Blacksmith' };
      case 'buyGear': return nearSt('smith') ? L.buyGear(s, +g.i, g.slot) : { ok: false, err: 'Visit the Blacksmith' };
      case 'stat': return L.addStat(s, g.k, g.n || 1);
      case 'resetStats': return town ? L.resetStats(s) : { ok: false, err: 'Reset your stats in town' };
      case 'cls': return town ? L.setClass(s, g.cls) : { ok: false, err: 'Swap class in town' };
      case 'spell': return RUN ? { ok: false, err: 'Change spells in town' } : L.setSpell(s, g.slot, g.id);
      case 'showArmor': s.showArmor = !!g.on; return { ok: true, on: s.showArmor };
      case 'seen': return Object.assign(L.seen(s, g.u === 'all' ? 'all' : +g.u), { quiet: 1 });
      case 'gift': return nearSt('gift') ? L.dailyGift(s, now, ctx, Math.random) : { ok: false, err: 'Open your gift at the Daily Gift chest' };
      case 'title': return L.setTitle(s, g.id);
      case 'outfit': return L.saveOutfit(s, g.i, g.look);
      case 'relic': { const rel = RUN && RUN.mode === 'dungeon' && RUN.i === g.i ? W.layout(g.i).relic : null; return rel && Math.hypot(P.x - rel.x, P.z - rel.z) < 6 ? L.relic(s, g.i) : { ok: false, quiet: 1 }; }
      case 'lantern': { const ln = RUN && RUN.mode === 'dungeon' && RUN.i === g.i ? W.layout(g.i).lantern : null; return ln && Math.hypot(P.x - ln.x, P.z - ln.z) < 6 ? L.lantern(s, g.i) : { ok: false, quiet: 1 }; }
      case 'way': { const w = W.wild.ways[g.i]; return RUN && RUN.mode === 'wild' && w && Math.hypot(P.x - w.x, P.z - w.z) < 6 ? L.wayshrine(s, g.i) : { ok: false, err: 'Stand at the wayshrine' }; }
      case 'passClaim': return L.passClaim(s, g.k | 0);
      case 'bestiary': return L.bestiaryClaim(s, g.i | 0);
      case 'salvage': return nearSt('smith') ? L.salvage(s, (g.us || []).map(Number)) : { ok: false, err: 'Visit the Blacksmith' };
      case 'uprarity': return nearSt('smith') ? L.upRarity(s, +g.u, Math.random) : { ok: false, err: 'Visit the Blacksmith' };
      case 'chest': return town ? L.openChest(s, String(g.id || ''), Math.random) : { ok: false, err: 'Open chests in town' };
      case 'skin': return L.setSkin(s, g.kind, g.id);
      case 'tut': return L.tutDone(s);
      case 'mig7': return L.seenMig7(s);
    }
    return { ok: false };
  }
  function handleRes(a, r) {
    if (!r) return;
    if (!r.ok) { if (!r.quiet && r.err) { UI.toast(r.err, '#ff9a9a'); AU.play('error'); } return; }
    const s = App.s;
    switch (a) {
      case 'equip': { const it = L.item(s, r.u); UI.toast('Equipped ' + (it ? L.itemName(it) : ''), it ? C.GEAR_RARITY[it.r].c : '#e8e2ee'); AU.play('click'); netNow = true; break; }
      case 'unequip': UI.toast('Unequipped', '#e8e2ee'); netNow = true; break;
      case 'store': UI.toast(r.on ? 'Moved to Storage' : 'Moved to your bag', '#e8e2ee'); AU.play('click'); break;
      case 'swap': { const it = L.eqItem(s, 'w'); UI.toast('Swapped to ' + (it ? L.itemName(it) : 'your other weapon'), it ? C.GEAR_RARITY[it.r].c : '#e8e2ee'); AU.play('click'); netNow = true; break; }
      case 'sell': UI.toast('Sold ' + r.n + ' item' + (r.n === 1 ? '' : 's') + ' for ' + fmt(r.gold) + ' gold', '#e0b44a'); AU.play('coin'); break;
      case 'autosell': UI.toast('Auto-sell ' + C.GEAR_RARITY[r.r].n + ': ' + (r.on ? 'ON' : 'OFF'), '#e8e2ee'); break;
      case 'upg': { const it = L.item(s, r.u); UI.toast((it ? L.itemName(it) : 'Item') + ' upgraded' + (r.n > 1 ? ' ' + r.n + ' times' : '') + '! (' + fmt(r.gold) + ' gold)', '#9ad8ff'); AU.play('buy'); UI.flash('#ff8a3a'); netNow = true; break; }
      case 'upgAll': UI.toast('Spent ' + fmt(r.gold) + ' gold on ' + r.n + ' upgrade' + (r.n === 1 ? '' : 's') + ' for your worn gear', '#9ad8ff'); AU.play('buy'); UI.flash('#ff8a3a'); netNow = true; break;
      case 'buyGear': { const it = L.item(s, r.u); UI.toast('Bought ' + (it ? L.itemName(it) : 'gear') + ' · equip it in your inventory (I)', '#ffd8a8'); AU.play('buy'); break; }
      case 'stat': AU.play('click'); break;
      case 'resetStats': UI.toast('Stat points refunded', '#e8e2ee'); break;
      case 'cls': UI.toast('You are now a ' + C.CLASSES[r.cls].n + '!', '#ffd8a8'); AU.play('levelup'); UI.flash('#ff4aff'); netNow = true; break;
      case 'spell': AU.play('click'); break;
      case 'showArmor': netNow = true; break;
      case 'gift': UI.giftRes = r; AU.play('gift'); UI.show('gift'); break;
      case 'title': UI.toast('Title: ' + L.titleName(r.title), '#e8d8a8'); break;
      case 'outfit': UI.toast('Outfit saved to slot ' + (r.i + 1), '#e8e2ee'); break;
      case 'lantern': if (!r.already) { UI.celebrate('Lost lantern found', r.n + ' / ' + L.ND + (r.all ? ' · every lantern is lit! Title: Lamplighter' : ' · its light goes up on the Lamplighter\'s tower'), '+' + fmt(r.gold) + ' gold', '#ffc86a'); AU.play('reveal', 4); } break;
      case 'way': if (r.already) UI.toast('You have already found this wayshrine (' + r.n + '/' + C.WILD.WAYS + ')', '#9ad8ff'); else { UI.celebrate('Wayshrine found', r.n + ' / ' + C.WILD.WAYS + (r.all ? ' · all found! Title: Pathfinder' : ''), '+' + fmt(r.gold) + ' gold', '#9ad8ff'); AU.play('reveal', 4); } break;
      case 'passClaim': UI.toast('Battle Pass tier ' + (r.k + 1) + ': ' + r.what, '#ffd84a'); AU.play(r.kind === 'cosm' || r.kind === 'title' ? 'reveal' : 'coin', 3); break;
      case 'bestiary': UI.celebrate('Bestiary page complete', C.DUNGEONS[r.i].n + ' · every creature slain', '+' + fmt(r.gold) + ' gold', C.DUNGEONS[r.i].col); AU.play('reveal', 3); break;
      case 'salvage': AU.play('craft'); UI.toast('Salvaged ' + r.n + ' item' + (r.n === 1 ? '' : 's') + ' into ' + r.dust + ' dust', '#c8b8ff'); AU.play('buy'); UI.craftSel = []; break;
      case 'uprarity': AU.play('craft'); UI.celebrate('Rarity raised', 'Your item is now ' + C.GEAR_RARITY[r.r].n, '', C.GEAR_RARITY[r.r].c); AU.play('reveal', r.r); UI.flash(C.GEAR_RARITY[r.r].c); netNow = true; break;
      case 'chest': UI.chestRes && UI.chestRes(r); break;
      case 'skin': { const q = L.cosm(r.id); UI.toast(q ? 'Skin on: ' + q.n : (r.kind === 'armor' ? 'Armour' : 'Weapon') + ' skin off', q ? C.SHOP.RAR[q.r].c : '#e8e2ee'); AU.play('click'); netNow = true; break; }
      case 'tut': case 'mig7': break;
      case 'relic': if (!r.already) { UI.celebrate('Relic found', r.n + ' / 8' + (r.n >= 8 ? ' · all found! Title: Relic Seeker' : ''), '+' + fmt(r.gold) + ' gold', '#1aff8a'); AU.play('reveal', 5); } break;
    }
    UI.hud(); if (UI.cur) UI.render();
    if (App.mode === 'guest') milestones(L.checkMilestones(s));
  }
  function levelUp(lv, ups) { UI.celebrate('Level ' + lv, '+' + (ups * C.STAT_PER_LEVEL) + ' stat points · open Character (C) to spend them', '', '#d8b46a'); AU.play('levelup');
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; E.particle({ x: P.x + Math.cos(a) * 0.8, y: P.y + 0.2, z: P.z + Math.sin(a) * 0.8, vx: Math.cos(a) * 1.5, vy: 3 + Math.random() * 3, vz: Math.sin(a) * 1.5, life: 1.2, size: 0.12, col: '#e8c87a', add: true }); } }
  function saveGuest() { if (App.mode === 'guest' && App.s) store.set('ss_guest_v2', App.s); }
  setInterval(saveGuest, 5000); addEventListener('beforeunload', saveGuest);
  function sendLook() { if (App.online && App.s) send({ t: 'look', look: App.s.look }); }
  App.setLook = function (look) {
    const s = App.s, v = L.validLook(look, s); if (!v) return;
    s.look = v; saveGuest(); if (App.online) send({ t: 'look', look: v }); if (UI.cur === 'avatar') UI.render();
  };
  App.saveOutfit = i => App.act('outfit', { i, look: App.s.look });
  App.setTitle = function (id) { if (App.mode === 'account') return App.act('title', { id }); const r = L.setTitle(App.s, id); handleRes('title', r); if (r.ok) saveGuest(); };
  App.emote = function (id) { if (P.dead) return; CH.play(me, id); if (App.online) send({ t: 'em', e: id }); $('#emotes').classList.remove('on'); AU.play('click'); };
  App.mainMenu = () => { saveGuest(); location.reload(); };
  App.logout = () => { send({ t: 'logout', all: true }); store.set('ss_token', null); location.reload(); };
  App.resetGuest = () => { try { localStorage.removeItem('ss_guest_v2'); } catch (e) {} location.reload(); };
  App.setSetting = function (k, v) {
    if (k === '_') { UI.arg = null; return; }
    SET[k] = v; store.set('ss_settings', SET);
    if (k === 'quality') { autoQ = v === 'auto'; extraScale = 1; try { E.setQuality(autoQ ? 'med' : v); } catch (e) { try { E.setQuality('low'); } catch (x) {} } }
    if (k === 'sfx' || k === 'music' || k === 'amb') AU.setVol(SET.sfx, SET.music, SET.amb);
    if (k === 'fps') $('#fps').style.display = v ? '' : 'none';
    applyLook();
  };
  // graphics effects and accessibility settings -> the renderer, the telegraph colours and the page
  const FX_KEYS = { fxBloom: 'bloom', fxVig: 'vignette', fxGrain: 'grain', fxGrade: 'grade', fxAO: 'ao', fxFog: 'fog' };
  function applyLook() { for (const k in FX_KEYS) E.fx[FX_KEYS[k]] = SET[k] !== false; MB.cb = !!SET.cb;
    document.documentElement.style.setProperty('--ts', SET.textSize === 'large' ? '1.12' : SET.textSize === 'huge' ? '1.25' : '1'); document.body.classList.toggle('bigtext', SET.textSize === 'large' || SET.textSize === 'huge'); }
  App.applyLook = applyLook;
  App.avatarClosed = () => {};

  // ================================================================ MATCHMAKING (server parties) + DUNGEON RUNS
  // what the server needs to know about a guest's power (guests keep their save on this device; the server caps it)
  function guestStats() { const st = SD.playerStats(App.s); return { cls: App.s.cls, ap: st.ap, max: st.max, crit: st.crit, critMult: st.critMult, leech: st.leech, speed: st.speed, cdr: st.cdr, type: st.type, spells: st.spells,
    red: st.red, move: st.move, luck: st.luck, abil: st.abil, gp: st.gp }; }
  function mm(a, o) { send(Object.assign({ t: 'mm', a }, o || {}, App.mode === 'guest' ? { st: guestStats() } : {})); }
  App.canPlay = (mode, i, df) => { const s = App.s; if (mode === 'pit' || mode === 'wild' || mode === 'tower') return null; const d = C.DUNGEONS[i]; if (mode === 'raid') return L.raidUnlocked(s, i) ? null : 'Clear ' + d.n + ' on Hard to open this raid'; if (!L.dunUnlocked(s, i)) return d.secret ? 'Find all 8 relics to open the Glitch Realm' : 'Reach level ' + d.lvl;
    if (!L.diffUnlocked(s, i, df)) return C.DIFFS[df].n + ' needs level ' + L.dunLevel(i, df); return null; };
  App.playSolo = function (mode, i, df, hc) { const err = App.canPlay(mode, i, df); if (err) return UI.toast(err, '#ff9a9a'); if (RUN && RUN.mode === 'wild' && mode !== 'wild') { App.pendingPlay = [mode, i, df, hc]; App.leaveRun(true); return; } if (RUN) return;
    if (App.online) mm('solo', { mode, i, df, hc }); else startLocalRun(mode, i, df, hc); UI.hide(); };
  App.quickMatch = function (mode, i, df, hc) { const err = App.canPlay(mode, i, df); if (err) return UI.toast(err, '#ff9a9a'); if (!App.online) return App.playSolo(mode, i, df, hc); mm('quick', { mode, i, df, hc }); };
  App.createParty = function (mode, i, df, hc, open) { const err = App.canPlay(mode, i, df); if (err) return UI.toast(err, '#ff9a9a'); if (!App.online) return UI.toast('Parties need the server. Play solo instead.', '#ffcf8a'); mm('create', { mode, i, df, hc, open }); };
  App.joinParty = id => mm('join', { id });
  App.leaveParty = () => mm('leave');
  App.startParty = () => mm('start');
  App.partySet = (mode, i, df, hc, open) => mm('set', { mode, i, df, hc, open });
  App.kick = id => mm('kick', { id });
  App.listParties = () => mm('list');
  function onMM(d) {
    if (d.a === 'party') { const was = App.party; App.party = d.p; if (!was) { UI.toast('Party ready · ' + (d.p.mode === 'pit' ? 'The Pit' : d.p.mode === 'raid' ? 'Boss Raid' : C.DUNGEONS[d.p.i].n) + (d.p.mode === 'dungeon' ? ' · ' + C.DIFFS[d.p.df].n : ''), '#9ad8a0'); AU.play('unlock'); } if (UI.cur === 'dungeons') UI.render(); UI.hud(); }
    else if (d.a === 'left') { App.party = null; if (d.m) UI.toast(d.m, '#ffcf8a'); if (UI.cur === 'dungeons') UI.render(); UI.hud(); }
    else if (d.a === 'list') { App.parties = d.list || []; if (UI.cur === 'dungeons') throttledRender(); }
    else if (d.a === 'err') { UI.toast(d.m, '#ff9a9a'); AU.play('error'); }
  }
  // ---------------------------------------------------------------- the run
  let RUN = null, stepAcc = 0;
  App.getRun = () => RUN;
  WD.gateOpen = (i, h) => !RUN || RUN.i !== i || RUN.mode !== 'dungeon' || W.hallOpen(W.layout(i), RUN.rooms, h);
  function runBase(o) {
    const dun = !o.mode || o.mode === 'dungeon';
    return Object.assign({ mode: 'dungeon', i: 0, df: 0, hc: false, local: false, id: 0, players: new Map(), rooms: dun ? W.layout(o.i || 0).rooms.map((q, k) => k ? 'i' : 'c') : ['i'], cleared: false, done: false, t0: performance.now(), kills: 0, openT: 0, boss: null, cds: {}, waves: 0, wave: 0 }, o);
  }
  function enterRunWorld(x, z) {
    MB.clear(); LT.clear(); fxList.length = 0; projectiles.length = 0; UI.hide(); fadeT = 0.0001; $('#fade').style.opacity = 1; AU.play('portal');
    setTimeout(() => { tp(x, z); P.yaw = Math.PI; cam.yaw = 0; cam.pitch = Math.max(cam.pitch, 0.42); $('#fade').style.opacity = 0; fadeT = 0; portalCD = 2.5; P.dead = false; P.out = false; $('#dead').classList.add('hidden');
      const R = RUN; if (!R) return; if (R.mode === 'pit') UI.zone('The Pit', 'Wave defence · ' + (R.players.size > 1 ? R.players.size + ' slayers' : 'solo'));
      else if (R.mode === 'tower') UI.zone('The Endless Tower', 'Climb as high as you can · a mutator twists every floor from floor ' + C.TOWER.MUT_FROM);
      else if (R.mode === 'duel') UI.zone('Duel', 'First to ' + C.DUEL.WINS + ' knock-outs · weapons only · parry and dodge win fights');
      else if (R.mode === 'wild') UI.zone('The Wilds', 'Camps of slimes wake as you come near · find the 5 wayshrines · the Far Gates are in the west');
      else if (R.mode === 'raid') UI.zone('Boss Raid', C.MOBS[C.DUNGEONS[R.i].boss].n + ' · level ' + L.raidLevel(R.i) + ' · nobody respawns');
      else { const d = C.DUNGEONS[R.i]; UI.zone(d.n, C.DIFFS[R.df].n + (R.hc ? ' · HARDCORE · one life' : '') + ' · Level ' + L.dunLevel(R.i, R.df, R.hc)); }
      AU.play('horn'); }, 380);
  }
  // crates, the treasure chest, the shrine and the traps of this run (the same on the server and every player's screen: layout + seed)
  function runFeatures(mode, i, seed) { if (mode !== 'dungeon') return null; const lay = W.layout(i), f = L.runFeat(i, seed);
    return { props: lay.props.map(p => Object.assign({ gone: false }, p)), chest: Object.assign({ open: false, shake: 0, openK: 0 }, f.chest), shrine: Object.assign({ used: false }, f.shrine), traps: lay.traps.map(t => Object.assign({}, t)),
      haz: lay.haz, vph: f.vph, side: f.side }; }
  const runTime = () => !RUN ? 0 : RUN.local ? RUN.inst.t : (RUN.st || 0) + (RUN.stAt ? (performance.now() - RUN.stAt) / 1000 : 0);
  // crates and the closed chest are solid (the world collision asks the run)
  WD.propSolid = (x, z, rad) => { const F = RUN && RUN.feat; if (!F) return [x, z];
    for (const q of F.props) { if (q.gone) continue; const dx = x - q.x, dz = z - q.z, m = 0.5 + rad; if (dx * dx + dz * dz < m * m) { const d = Math.hypot(dx, dz) || 1; x = q.x + dx / d * m; z = q.z + dz / d * m; } }
    const c = F.chest; if (c && !c.open) { const dx = x - c.x, dz = z - c.z, m = 0.85 + rad; if (dx * dx + dz * dz < m * m) { const d = Math.hypot(dx, dz) || 1; x = c.x + dx / d * m; z = c.z + dz / d * m; } }
    return [x, z]; };
  function startLocalRun(mode, i, df, hc) {
    const seed = (Math.random() * 1e9) | 0, inst = SD.create({ mode, i, df, hc, seed, players: [{ id: App.myId, name: App.myName, s: App.s }] }), p = inst.players.get(App.myId);
    RUN = runBase({ mode, i, df, hc: !!hc, local: true, inst, seed, feat: runFeatures(mode, i, seed) });
    RUN.players.set(App.myId, { id: App.myId, n: App.myName, cls: App.s.cls, max: p.max, hp: p.hp, dead: false, out: false });
    P.hp = p.hp; enterRunWorld(p.x, p.z); App.run = RUN; UI.hud();
  }
  function startOnlineRun(d) {
    RUN = runBase({ mode: d.mode, i: d.i, df: d.df, hc: !!d.hc, local: false, id: d.inst, seed: d.seed, feat: runFeatures(d.mode, d.i, d.seed) });
    for (const q of d.players) RUN.players.set(q.id, { id: q.id, n: q.n, cls: q.cls, max: q.max, hp: q.max, dead: false, out: false });
    P.hp = d.me.hp; enterRunWorld(d.me.x, d.me.z); App.run = RUN; UI.hud();
  }
  function onRunData(d) {
    for (const e of d.e) runEvent(e);
    MB.applySnap(d.m, SD.STATES);
    for (const a of d.p) { const q = RUN.players.get(a[0]); if (!q) continue; q.hp = a[1]; q.dead = a[2] > 0; q.out = a[2] === 2; q.buff = a[3]; q.shield = a[4]; if (a[0] === App.myId) { P.hp = a[1]; RUN.me = Object.assign(RUN.me || {}, { rank: a[6] || 0, chain: a[7] || 0, pts: a[8] || 0 }); } }
    if (d.r) for (let k = 0; k < d.r.length; k++) RUN.rooms[k] = d.r[k];
    if (d.st !== undefined) { RUN.st = d.st; RUN.stAt = performance.now(); }
    if (d.tl !== undefined) { RUN.tl = d.tl; RUN.tlAt = performance.now(); }
  }
  // the dungeon clock: 12 / 14 / 16 minutes by difficulty (L.dunTime), minus 10 seconds for every death
  App.timeLeft = () => { const R = RUN; if (!R || R.mode !== 'dungeon') return null; if (R.local) return R.inst.limit ? SD.timeLeft(R.inst) : null; if (R.tl === undefined) return null; return Math.max(0, R.tl - (R.done ? 0 : (performance.now() - R.tlAt) / 1000)); };
  // what to do about each boss move (shown the first time you see it, and under the boss bar)
  const MOVE_TIPS = { safe: 'Huge blast! Stand in a GREEN circle', checker: 'The floor will explode: find a GREEN tile', sweep: 'Rotating beams: hug the boss or keep moving', orbs: 'Hunting orbs: outrun them or pop them', teleport: 'It vanished: get off the red circle',
    charge: 'Charge: step out of the red lane', ring: 'Shockwave: JUMP (Space) over it', nova: 'Get away from it!', pools: 'Burning ground: keep moving', spiral: 'Spiral blast: weave between the circles', cross: 'Cross beams: stand between the lines', lines: 'Step out of the red lines',
    meteor: 'Meteors fall where you stand: keep moving', slam: 'Slam: roll (Q) out of the circle', barrage: 'Barrage: roll (Q) away', summon: 'It calls for help', stomp: 'Too close! It stomps: back off' };
  const roomName = r => { const q = W.layout(RUN.i).rooms[r]; return q.kind === 'boss' ? 'The boss: ' + C.MOBS[C.DUNGEONS[RUN.i].boss].n : q.kind === 'mini' ? 'Mini-boss: ' + C.MOBS[L.miniOf(RUN.i, q)].n : q.kind === 'side' ? 'Side room' : 'Room ' + r; };
  function runEvent(e) {
    const R = RUN; if (!R) return;
    switch (e.k) {
      case 'hurt': { const q = R.players.get(e.who); if (q) q.hp = e.hp; if (e.who === App.myId) { P.hp = e.hp; hurtFx(e.n, e.fx, e.fz); } else if (R.mode === 'duel') { const o = App.others.get(e.who); if (o) { MB.num(o.x, (o.y || 0) + 3, o.z, '-' + Math.round(e.n), '#ffd84a', 1.1); hitstop = Math.max(hitstop, C.HITSTOP); App.shake(0.2); AU.play('hit'); } } break; }
      case 'heal': { const q = R.players.get(e.who); if (q) q.hp = e.hp; if (e.who === App.myId) { P.hp = e.hp; if (SET.nums !== false) MB.num(P.x, P.y + 3, P.z, '+' + e.n, '#7aff8a', 0.8); } break; }
      case 'die': { const q = R.players.get(e.who); if (q) { q.dead = true; q.out = e.out; q.hp = 0; } if (e.who === App.myId) myDeath(e.out); else if (q) UI.sys(q.n + (e.out ? ' is out (Hardcore)' : ' was slain'), '#ff9a9a');
        if (e.pen) { UI.timePen && UI.timePen(e.pen, e.who === App.myId ? 'You died' : (q ? q.n + ' died' : 'A death')); AU.play('error'); } break; }
      case 'move': { const m = MB.list.get(e.u); if (m && e.pose) { m.pose = e.pose; m.poseAt = performance.now(); m.poseW = e.w || 0; }   // Update 7: the move's own wind-up
        const tip = e.n ? e.n + (e.tip ? ' · ' + e.tip : '') : MOVE_TIPS[e.m]; if (!tip || !m) break; R.tip = { s: (m.kind === 'mini' ? m.d.n + ': ' : '') + tip, at: performance.now() }; R.seenMoves = R.seenMoves || {};
        const loud = e.m === 'safe' || e.m === 'checker' || /GREEN/.test(tip); if (!R.seenMoves[e.m] || loud) { R.seenMoves[e.m] = 1; UI.toast(tip, loud ? '#7aff9a' : '#ffb08a'); } break; }
      // a weapon power or armour set going off: a flash in that dungeon's colour (and a word over you for the defensive ones)
      case 'wfx': { const col = (C.GEAR_TIERS[e.t] || C.GEAR_TIERS[0]).glow, mine = e.who === App.myId; ring(e.x, e.z, e.r || 1.6, col, e.r ? 0.45 : 0.3);
        if (mine && SET.nums !== false) { const word = { root: 'ROOTED', frost: 'FROZEN', reap: 'SOUL REAP', glitch: 'x2', phase: 'PHASED', molten: 'MOLTEN', sun: 'SUNBURST' }[e.w]; if (word) MB.num(e.x, 2.6, e.z, word, col, 0.9); }
        if (e.w === 'sun' || e.w === 'molten') AU.play('fire'); break; }
      case 'tp': if (e.who === App.myId) { tp(e.x, e.z); if (!e.duel) { UI.toast('Pulled into the arena · the gate is sealed', '#ff9a7a'); AU.play('portal'); } } break;
      case 'respawn': { const q = R.players.get(e.who); if (q) { q.dead = false; q.hp = q.max; } if (e.who === App.myId) { P.dead = false; $('#dead').classList.add('hidden'); tp(e.x, e.z); P.iframeT = 2; P.hp = q ? q.max : P.hp; AU.play('unlock'); } break; }
      case 'room': R.rooms[e.r] = e.st[0]; if (R.mode === 'raid') { if (e.st === 'active') { AU.setIntensity(1); R.boss = true; } break; } if (e.st === 'active') { const q = W.layout(R.i).rooms[e.r]; if (q.kind === 'boss' || q.kind === 'mini') UI.zone(roomName(e.r).replace(/^The boss: |^Mini-boss: /, ''), q.kind === 'boss' ? 'Boss fight' : 'Mini-boss'); AU.setIntensity(q.kind === 'boss' ? 1 : 0.6); if (q.kind === 'boss') R.boss = true; }
        else if (e.st === 'clear') { const q = W.layout(R.i).rooms[e.r]; if (q.kind === 'side' && R.feat && R.feat.side[e.r] === 'vault') break; AU.play('unlock'); AU.setIntensity(0); if (q.kind === 'side') UI.toast('Ambush beaten · bonus gold', '#ffd84a'); else if (q.kind !== 'boss') UI.toast('Room cleared · the gate is open', '#9ad8a0'); } break;
      case 'immune': if (e.on) { UI.zone('The boss is shielded', 'Break the heart to hurt it again'); AU.play('shield'); } else { UI.toast('The heart is broken · the boss can be hurt', '#ffd84a'); AU.play('unlock'); } MB.event(e, App.myId, SET); break;
      case 'healer': UI.toast('A healer is keeping the boss alive · kill it first', '#7aff8a'); MB.event(e, App.myId, SET); break;
      case 'floor': if (e.cleared) { R.floors = e.f; UI.toast('Floor ' + e.f + ' cleared!', '#9ad8a0'); AU.play('floor'); AU.sting && AU.sting('floor'); } else { R.floor = e.f; const mu = C.MUTATORS.find(q => q.id === e.mut); R.mut = mu || null;
          UI.zone('Floor ' + e.f, (e.boss ? 'A guardian waits · ' : '') + (mu ? 'Mutator: ' + mu.n + ' · ' + mu.d : 'The Endless Tower')); AU.play(mu ? 'mutator' : 'horn'); AU.setIntensity(e.boss ? 1 : 0.7); } break;
      case 'duel': R.score = e.score; { const by = e.by === App.myId, ko = e.ko === App.myId, o = App.others.get(by ? e.ko : e.by);
          UI.zone(by ? 'KNOCK-OUT!' : ko ? 'Knocked out' : 'KO', 'Score ' + (e.score[App.myId] || 0) + ' – ' + (o ? e.score[o.id] || 0 : 0) + ' · first to ' + C.DUEL.WINS); AU.play('ko'); AU.play(by ? 'win' : 'hurt'); } break;
      case 'camp': (R.campSt || (R.campSt = {}))[e.c] = e.st; if (e.st === 'active') { UI.toast('A camp of slimes wakes up!', '#ff9a7a'); AU.play('horn'); AU.setIntensity(0.7); } else if (e.st === 'clear') { R.camps = e.n; UI.toast('Camp cleared (' + e.n + ') · it comes back in a while', '#9ad8a0'); AU.play('unlock'); AU.setIntensity(0); } break;
      case 'wave': if (R.mode === 'pit') { if (e.cleared) { R.waves = e.w; UI.toast('Wave ' + e.w + ' cleared!', '#9ad8a0'); AU.play('unlock'); } else { R.wave = e.w; UI.zone('Wave ' + e.w, 'The Pit'); AU.play('horn'); AU.setIntensity(1); } } break;
      case 'fx': { const sp = L.spell(e.s); if (e.by !== App.myId) spellFx(e, false); else if (sp && (sp.k === 'chain' || sp.k === 'mark')) spellFx(e, true); break; }
      case 'strike': { const col = SPCOL[e.s] || '#ff7a2a'; ring(e.x, e.z, e.r, col, 0.4); fxList.push({ k: 'beam', x: e.x, z: e.z, yaw: 0, len: 0.01, w: 0.01, col, t: 0, life: 0.01 });
        for (let j = 0; j < 18; j++) { const a = Math.random() * TAU, v = 2 + Math.random() * 4; E.particle({ x: e.x, y: 0.4, z: e.z, vx: Math.cos(a) * v, vy: 3 + Math.random() * 5, vz: Math.sin(a) * v, life: 0.7, size: 0.22, g: 9, col: Math.random() < 0.5 ? col : '#ffd25a', add: true }); }
        if (Math.hypot(e.x - P.x, e.z - P.z) < 18) { App.shake(0.25); AU.play('thud'); } break; }
      case 'zap': { const m = MB.list.get(e.u); if (m) projectiles.push({ x: e.x0, y: 1.6, z: e.z0, tx: m.x, tz: m.z, tgt: m, t: 0, col: SPCOL[e.s] || '#3ad8ff', sp: 30 }); break; }
      case 'boom': for (let j = 0; j < 30; j++) { const a = Math.random() * TAU, v = 3 + Math.random() * 6; E.particle({ x: e.x, y: 0.8, z: e.z, vx: Math.cos(a) * v, vy: 2 + Math.random() * 4, vz: Math.sin(a) * v, life: 0.7, size: 0.24, g: 6, col: Math.random() < 0.5 ? '#c040ff' : '#ffffff', add: true }); } break;
      case 'kill': { if (e.by === App.myId) R.kills++; const m = MB.list.get(e.u); if (m && R.mode !== 'raid') LT.burst(m.x, m.z, m.boss ? 22 : m.kind === 'mini' ? 12 : m.kind === 'elite' ? 7 : 3, m.boss || m.kind === 'mini'); MB.event(e, App.myId, SET); break; }
      case 'drop': LT.add(e); break;
      case 'blocked': { const mine = e.who === App.myId, owner = mine ? P : (App.others.get(e.who) || { x: e.x, z: e.z }); ring(owner.x, owner.z, 2.6, '#d8f0ff', 0.45); if (mine) { if (SET.nums !== false) MB.num(P.x, P.y + 3, P.z, 'BLOCKED', '#d8f0ff', 1); AU.play('shield'); } break; }
      case 'brk': { const F = R.feat, q = F && F.props.find(p => p.id === e.id); if (q) { q.gone = true; const k = LT.propKind(WD.thOf(R.i).n, q.v);
          LT.debris(q.x, q.z, k === 'urn' ? '#a8784a' : k === 'ice' ? '#bfe8ff' : k === 'crystal' ? '#c87aff' : k === 'sac' ? '#8a1a2a' : k === 'cube' ? '#1aff8a' : '#6a4a2a'); AU.play('crack'); if (e.by === App.myId) App.shake(0.15); } break; }
      case 'coins': if (!e.who || e.who === App.myId) { LT.burst(e.x, e.z, e.n, e.n > 10); } break;
      case 'chest': { const c = R.feat && R.feat.chest; if (!c) break;
        if (e.a === 'hit') { c.shake = 1; AU.play('shake'); }
        else if (e.a === 'open') { c.open = true; AU.play('jackpot'); UI.toast('Treasure chest!', '#ffd84a'); App.shake(0.4); }
        else if (e.a === 'mimic') { c.open = true; c.gone = true; AU.play('roar'); UI.zone('It\'s a Mimic!', 'Beat it for double loot'); App.shake(0.9); LT.debris(c.x, c.z, '#4a2a14'); } break; }
      case 'shrine': { const d = C.SHRINES.find(q => q.id === e.kind) || C.SHRINES[0];
        if (e.who === App.myId) { if (R.feat && R.feat.shrine) R.feat.shrine.used = true; UI.zone(d.n, d.d); AU.play('sparkle'); UI.flash(d.col); ring(P.x, P.z, 3.5, d.col, 0.7);
          if (e.dur) (R.buffs || (R.buffs = {}))[e.kind] = performance.now() / 1000 + e.dur; }
        else { const q = R.players.get(e.who); if (q) UI.sys(q.n + ' used the ' + d.n, d.col); } break; }
      case 'trap': if (e.who === App.myId) AU.play('crack'); break;
      case 'pick': { const who = e.who === App.myId ? P : e.who ? (App.others.get(e.who) || null) : null, d = LT.pick(e.id, who);
        if (d && e.who === App.myId) { if (d.kind === 'item' && d.it) { UI.lootCard(d.it); AU.play(d.it.r >= 3 ? 'gem' : 'pop'); } } break; }
      case 'done': if (R.local) finishLocal(e); else { R.done = true; R.result = e.res; if (e.res === 'clear') onCleared(); } break;
      case 'gone': { const q = R.players.get(e.who); if (q) UI.sys(q.n + ' left the run', '#9a94a8'); R.players.delete(e.who); break; }
      case 'dmg': MB.event(e, App.myId, SET); break;
      // ---- Update 6: parry, perfect dodge, style, combos
      case 'parry': if (e.who === App.myId) { CH.play(me, 'parryHit'); hitstop = Math.max(hitstop, 0.22); App.shake(0.55); AU.play('parry'); if (SET.nums !== false) MB.num(P.x, P.y + 3.3, P.z, 'PARRY!', '#ffe08a', 1.3); }
        ring(e.x, e.z, 2.2, '#ffe08a', 0.4); if (V_parts()) for (let j = 0; j < 24; j++) { const a = Math.random() * TAU, v = 4 + Math.random() * 7; E.particle({ x: e.x + Math.sin(a) * 0.6, y: 1.4, z: e.z + Math.cos(a) * 0.6, vx: Math.cos(a) * v, vy: 1 + Math.random() * 4, vz: Math.sin(a) * v, life: 0.35, size: 0.14, g: 8, col: '#fff2b0', add: true }); } break;
      case 'pdodge': if (e.who === App.myId) { slowT = 0.55; AU.play('perfect'); if (SET.nums !== false) MB.num(P.x, P.y + 3.2, P.z, 'PERFECT DODGE', '#9ae8ff', 1.2);
          if (V_parts()) for (let j = 0; j < 16; j++) E.particle({ x: P.x + (Math.random() - 0.5) * 0.8, y: P.y + 0.3 + Math.random() * 1.8, z: P.z + (Math.random() - 0.5) * 0.8, vx: 0, vy: 0.3, vz: 0, life: 0.6, size: 0.35, col: '#5ab8ff', add: true }); }
        ring(e.x, e.z, 1.8, '#9ae8ff', 0.4); break;
      case 'style': if (e.who === App.myId) { if (RUN.me) { RUN.me.rank = e.r; RUN.me.chain = e.n; } if (UI.styleRank) UI.styleRank(e.r, e.n); if (e.r >= 3 && e.n) AU.play('rank', e.r); if (e.r >= 5 && e.n && AU.sting) AU.sting('rank'); } break;
      case 'combo': { const m = MB.list.get(e.u), CC = { shatter: ['SHATTER!', '#bfefff'], ignite: ['IGNITE!', '#ff8a3a'], execute: ['EXECUTE!', '#ff3a5a'] }[e.c] || [String(e.c).toUpperCase(), '#ffffff'];
        if (m) { if (SET.nums !== false) MB.num(m.x, (m.y || 0) + m.sc * 2 + 1.5, m.z, CC[0], CC[1], 1.15); ring(m.x, m.z, m.sc + 0.8, CC[1], 0.35); } if (e.by === App.myId) AU.play('crit'); break; }
      case 'launch': for (const u of e.u || []) { const m = MB.list.get(u); if (m) { m.launchT = 0.6; dustBurst(m.x, m.z, 1.2); } } break;
      case 'stealth': { const q = e.who === App.myId ? P : App.others.get(e.who); if (q && e.on) { fxList.push({ k: 'aura', follow: q, col: '#8a5aff', t: 0, life: e.dur || 4, stealth: 1 }); AU.at ? AU.at('stealth', q.x, q.z) : AU.play('stealth'); } if (q && !e.on) for (const f of fxList) if (f.stealth && f.follow === q) f.life = 0;
        if (e.who === App.myId && e.on) UI.toast('Hidden · your next hit is deadly', '#b89aff'); break; }
      case 'divine': { const q = e.who === App.myId ? P : App.others.get(e.who); if (q) { fxList.push({ k: 'aura', follow: q, col: '#ffe08a', t: 0, life: e.dur }); fxList.push({ k: 'flames', follow: q, col: '#ffe08a', t: 0, life: e.dur }); } if (e.who === App.myId) UI.toast('Divine Shield · nothing can hurt you', '#ffe08a'); break; }
      default: MB.event(e, App.myId, SET);
    }
  }
  function onCleared() { const R = RUN; R.cleared = true; R.openT = 0; AU.setIntensity(0); AU.play('win'); CH.play(me, 'victory'); netAnim('v'); App.shake(1); hitstop = 0.3;
    UI.celebrate(R.mode === 'pit' ? 'The Pit' : 'Dungeon cleared', R.mode === 'pit' ? '' : C.DUNGEONS[R.i].n + ' · ' + C.DIFFS[R.df].n, 'Loot in the chest room · the portal home is open', '#ffd84a'); }
  // offline: the run finished in the local simulation -> rewards with the same rules the server uses
  function finishLocal(e) {
    const R = RUN; if (R.done) return; R.done = true; R.result = e.res; const secs = R.inst.t, ctx = App.ctx(), s = App.s;
    let r; if (R.mode === 'pit') r = L.pitReward(s, R.inst.pitCleared, ctx, Math.random); else if (R.mode === 'tower') r = L.towerReward(s, R.inst.towerCleared, ctx, Math.random); else if (R.mode === 'wild') r = L.wildReward(s, R.inst.wildCleared, ctx, Math.random); else if (R.mode === 'raid') r = L.bossRaidReward(s, R.i, e.res === 'clear', ctx, Math.random, secs); else r = L.runReward(s, R.i, R.df, R.hc, R.inst.progress, ctx, Math.random, secs, SD.lootOf(R.inst, App.myId), SD.bonusOf(R.inst, App.myId));
    if (e.res === 'clear') onCleared();
    saveGuest(); showResults({ sum: SD.summary(R.inst), r, err: '', early: false, secs: Math.round(secs) }, e.res === 'clear' ? 1800 : 600);
  }
  function onRunEnd(d) {
    const R = RUN; if (!R) return;
    if (App.mode === 'guest' && !d.err && d.sum) { const ctx = App.ctx(); d.r = d.sum.mode === 'pit' ? L.pitReward(App.s, d.sum.waves, ctx, Math.random) : d.sum.mode === 'tower' ? L.towerReward(App.s, d.sum.floor, ctx, Math.random) : d.sum.mode === 'duel' ? L.duelReward(App.s, d.sum.winner === App.myId) : d.sum.mode === 'wild' ? L.wildReward(App.s, d.sum.camps, ctx, Math.random) : d.sum.mode === 'raid' ? L.bossRaidReward(App.s, d.sum.i, d.sum.res === 'clear' && !d.early, ctx, Math.random, d.secs) : L.runReward(App.s, d.sum.i, d.sum.df, d.sum.hc, d.sum.progress, ctx, Math.random, d.secs, d.loot || [], d.bonus); saveGuest(); }
    R.done = true; if (d.sum && d.sum.res === 'clear' && !R.cleared) onCleared();
    showResults(d, d.sum && d.sum.res === 'clear' && !d.early ? 1800 : 300);
  }
  // challenges, pass XP, counters (guests apply them here; accounts get them from the server in r.chg)
  function afterRunLocal(d) { const sum = d.sum, me = sum && sum.players && sum.players.find(q => q.id === App.myId); if (!me || !d.r || !d.r.ok) return;
    if (App.mode === 'guest') d.r.chg = L.afterRun(App.s, sum.mode, me, sum, App.now(), !!d.r.cleared);
    (d.r.chg || []).forEach((c, k) => setTimeout(() => { UI.toast('Challenge complete: ' + c.n + ' · +' + c.xp + ' pass XP', '#9ad8ff'); AU.play('unlock'); }, (delay2 + 1200) + k * 900)); }
  let delay2 = 0;
  function showResults(d, delay) { delay2 = delay || 0; try { afterRunLocal(d); } catch (e) { console.error(e); } if (AU.sting && d && d.sum && (d.sum.res === 'clear' || (d.sum.winner && d.sum.winner === App.myId))) AU.sting('clear');
    App.results = Object.assign({ mode: RUN.mode, i: RUN.i, df: RUN.df, hc: RUN.hc, kills: RUN.kills }, d);
    const r = d.r; if (r && r.ups) setTimeout(() => levelUp(r.level, r.ups), delay + 300);
    if (r && r.cosm) setTimeout(() => { UI.celebrate('Raid cosmetic', r.cosm.n, 'New in the Shop · Colours', r.cosm.v); AU.play('reveal', 5); }, delay + 900);
    if (r && r.items) r.items.filter(it => it.r >= 4).forEach(it => UI.sys('You found ' + C.GEAR_RARITY[it.r].n.toUpperCase() + ' gear: ' + L.itemName(it) + '!', C.GEAR_RARITY[it.r].c));
    setTimeout(() => { UI.show('results'); AU.play(r && r.ok ? 'gem' : 'whoosh'); }, delay);
    if (App.mode === 'guest') milestones(L.checkMilestones(App.s));
  }
  function endRunLocalFallback(msg) { if (!RUN) return; UI.toast(msg, '#ff9a9a'); exitRun(); }
  // leave the dungeon and walk back out of its portal in town
  function exitRun() {
    const R = RUN; RUN = null; App.run = null; MB.clear(); LT.clear(); fxList.length = 0; projectiles.length = 0; AU.setIntensity(0); P.dead = false; P.out = false; $('#dead').classList.add('hidden'); P.hp = L.maxHp(App.s);
    const k = R && R.mode === 'dungeon' && W.PORTALS[R.i] ? R.i : -1, g = W.STN.arena;
    if (R && (R.mode === 'pit' || R.mode === 'tower' || R.mode === 'duel')) travelTo(g.x + 2, g.z + 2, Math.atan2(-g.x, -g.z));
    else if (R && R.mode === 'wild') travelTo(W.ANNEX.x0 + 10, 10, -Math.PI / 2);
    else if (k >= 0) { const h = W.portalHome(k); travelTo(h.x, h.z, h.yaw); }
    else travelTo(W.SPAWN[0], W.SPAWN[1], Math.PI);
    UI.hud();
  }
  App.leaveRun = function (confirmed) {
    const R = RUN; if (!R) return;
    if (R.done) { UI.hide(); exitRun(); return; }
    if (!confirmed) return UI.show('leave');
    if (R.local) { const ctx = App.ctx(), s = App.s; const r = R.mode === 'pit' ? L.pitReward(s, R.inst.pitCleared, ctx, Math.random) : R.mode === 'tower' ? L.towerReward(s, R.inst.towerCleared, ctx, Math.random) : R.mode === 'wild' ? L.wildReward(s, R.inst.wildCleared, ctx, Math.random) : R.mode === 'raid' ? L.bossRaidReward(s, R.i, false, ctx, Math.random) : L.runReward(s, R.i, R.df, R.hc, R.inst.progress, ctx, Math.random, R.inst.t, SD.lootOf(R.inst, App.myId), SD.bonusOf(R.inst, App.myId));
      R.done = true; saveGuest(); showResults({ sum: SD.summary(R.inst), r, err: '', early: true, secs: Math.round(R.inst.t) }, 50); }
    else mm('leaveRun');
    UI.hide();
  };
  App.closeResults = () => { UI.hide(); if (RUN && RUN.done && !RUN.cleared) exitRun(); const pp = App.pendingPlay; if (pp) { App.pendingPlay = null; setTimeout(() => App.playSolo(pp[0], pp[1], pp[2], pp[3]), 900); } };
  App.again = function () { const R = App.results; if (!R) return; exitRun(); setTimeout(() => { if (App.party && App.party.leader === App.myId) App.startParty(); else if (!App.party) App.playSolo(R.mode, R.i, R.df, R.hc); }, 700); };
  // ---------------------------------------------------------------- combat: my attacks become requests to the simulation
  function attackSim(a) { if (!RUN || RUN.done || P.dead) return; if (RUN.local) SD.attack(RUN.inst, App.myId, a); else send({ t: 'atk', a }); }
  App.attackSim = attackSim;

  // ---------- zones, travel, portals ----------
  let fadeT = 0, zoneKey = '';
  function tp(x, z, y) { P.x = x; P.z = z; P.y = y || (WD.ready && WD.groundAt ? WD.groundAt(x, z) : 0); P.vy = 0; P.kx = P.kz = 0; P.ox = x; P.oz = z; cam.x = x; cam.y = P.y; cam.z = z; camK = 1; }
  function travelTo(x, z, yaw, msg) { if (fadeT > 0) return; fadeT = 0.0001; $('#fade').style.opacity = 1; AU.play('portal');
    setTimeout(() => { tp(x, z); P.yaw = yaw; cam.yaw = yaw + Math.PI; $('#fade').style.opacity = 0; fadeT = 0; portalCD = 2; if (msg) UI.toast(msg, '#e8e2ee'); }, 380); }
  App.travelHub = () => { if (RUN) return App.leaveRun(); UI.hide(); travelTo(W.SPAWN[0], W.SPAWN[1], Math.PI); };
  function zoneChanged(z) {
    if (!RUN) { MB.clear(); }
    if (z.t === 'hub') { UI.zone('Duskhold', 'The last safe town · walk into a portal to find a dungeon'); if (App.raid) MB.startRaid(App.raid); }
  }
  MB.onBossStart = b => { UI.zone(b.d.n, 'Boss fight'); AU.setIntensity(1); AU.sting && AU.sting('boss'); if (RUN) RUN.boss = true; };
  MB.onBossPhase = b => { UI.toast((b ? b.d.n : 'The boss') + ' is enraged!', '#ff8a6a'); App.shake(0.8); };
  MB.onShake = a => App.shake(a);
  MB.onKill = m => { if (m.boss) { hitstop = 0.35; App.shake(1.2); } else if (m.elite) { hitstop = Math.max(hitstop, 0.09); App.shake(0.45); } };
  MB.onMyHit = (m, e) => { hitstop = Math.max(hitstop, C.HITSTOP * (e && e.c ? 1.8 : 1)); if (e && e.c) App.shake(0.28); else App.shake(0.12); AU.play('hit'); };
  let raidPend = 0;
  MB.onRaidHit = n => { raidPend += n; };
  setInterval(() => { if (raidPend > 0 && App.online) { send({ t: 'rh', n: Math.min(10, raidPend) }); raidPend = 0; } }, 250);

  // ---------- combat ----------
  let hitstop = 0, comboShow = 0;
  const footP = { d: 0, s: 1 }, FOOT_COL = { woods: '#4a4a32', crypt: '#5a5a6a', frost: '#dce8f4', ember: '#3a2a26', storm: '#4a4c5e', void: '#3a2a4a', desert: '#a8865a', abyss: '#4a1a24', glitch: '#1a4a2a' };
  const myType = () => L.type(App.s);
  function netAnim(k) { P.netN = (P.netN + 1) % 100; P.netA = k + '#' + P.netN; netNow = true; }
  const projectiles = [], fxList = [];
  const glowCol = () => (C.GEAR_TIERS[(L.eqItem(App.s, 'w') || { t: 0 }).t] || C.GEAR_TIERS[0]).glow;
  // the closest crate (or the closed treasure chest) within r: attacks aim at it when no slime is in reach
  function nearestProp(r) { const F = RUN && RUN.feat; if (!F) return null; let best = null, bd = r;
    for (const q of F.props) { if (q.gone) continue; const d = Math.hypot(q.x - P.x, q.z - P.z); if (d < bd) { bd = d; best = q; } }
    const c = F.chest; if (c && !c.open) { const d = Math.hypot(c.x - P.x, c.z - P.z) - 0.6; if (d < bd) best = c; } return best; }
  // ---------------------------------------------------------------- attacking: your weapon's combo of swings (hold to keep swinging) · parry
  // the simulation decides every hit; this side plays the animation and sends the attack at the moment the blade connects
  let gT = 0, holdT = 0, lastAtk = -9, lastGapK = 0, slowT = 0, camCin = null; const pendAtk = [];   // lastGapK: the recovery of my last swing (the simulation uses the same)
  const myKind = () => L.weaponType(App.s), myMS = () => C.MOVESETS[myKind()] || C.MOVESETS.sword;
  const atkSpd = () => L.speed(App.s) * (buffOn('rage') ? 1 + (L.spell('berserk').spd || 0) : 1);
  // never send faster than the simulation accepts: wait a moment instead (gT runs with the game clock, so hitstop slows it too)
  // sel: picks the targets again when a waiting swing is finally sent (a slime that lunged or circled you in the meantime is where it is now)
  function sendAtk(a, gap, sel) { const at = Math.max(gT, lastAtk + (gap || 0)); lastAtk = at; if (at > gT + 1e-3) pendAtk.push({ at, a, sel }); else attackSim(a); }
  // the slimes a swing of reach R and arc reaches: a little forgiving, and a slime right next to you counts even if it is beside or behind you
  // (you turn to face it); the simulation still checks every hit's distance
  function swingTargets(R, arc) { let list = MB.inArea(P.x, P.z, P.yaw, R + 0.4, Math.min(TAU, arc + 0.35));
    if (!list.length) { const m = MB.nearest(P.x, P.z, R + 0.6); if (m && m.uid !== undefined && MB.list.has(m.uid)) { P.yaw = Math.atan2(m.x - P.x, m.z - P.z); list = MB.inArea(P.x, P.z, P.yaw, R + 0.4, Math.min(TAU, arc + 0.35)); if (!list.includes(m)) list.unshift(m); } }
    return list.slice(0, 16).map(q => q.uid); }
  function aimAt(reach) { const ty = myType(), m = MB.nearest(P.x, P.z, ty.ranged ? 11 : (reach || ty.range) + 2.5), pr = m ? null : nearestProp(ty.ranged ? 10 : ty.range + 1.2);
    if (m) P.yaw = Math.atan2(m.x - P.x, m.z - P.z); else if (pr) P.yaw = Math.atan2(pr.x - P.x, pr.z - P.z); else if (P.mv) P.yaw = Math.atan2(P.dx, P.dz); }
  function attack() {
    if (!App.s || P.dead || busy() || App.photoOn || fadeT > 0 || P.leap || P.dash || (me.act && me.act.lock)) return;
    const ty = myType();
    if (P.dodgeT > 0) { P.atkBuf = 0.45; return; }   // remembered: it swings as the roll ends
    const started = CH.play(me, 'attack', { kind: myKind() }); if (!started) return;
    aimAt(); P.atkLock = 0.3; P.lunge = ty.ranged ? 0 : 0.12; comboShow = me.combo + 1; AU.play('swing', me.combo); netAnim('a' + me.combo);
  }
  function parry() {
    if (!App.s || P.dead || busy() || P.parryCd > 0 || P.leap || P.dash || P.slam || fadeT > 0) return;
    P.parryCd = C.PARRY.CD; App.tutStep('parry'); CH.play(me, 'parry'); netAnim('p'); AU.play('swing', 0);
    if (RUN && !RUN.done) { if (RUN.local) SD.parry(RUN.inst, App.myId); else send({ t: 'parry' }); }
  }
  // your style rank: from the local simulation, or from the server's 10 Hz update
  function myStyle() { if (!RUN) return null; if (RUN.local) return RUN.inst ? SD.styleOf(RUN.inst, App.myId) : null; return RUN.me || { rank: 0, chain: 0, best: 0 }; }
  App.myStyle = myStyle;
  // the blade connects (an event from the animation): send that move
  function onMoveEvent(ev) {
    const ty = myType(), MS = myMS(), col = glowCol();
    if (ev.k === 'hit' || ev.k === 'smash') return onSwingHit(ev);
  }
  function onSwingHit(ev) {
    if ((ev.combo | 0) >= 3) App.tutStep('combo');
    const ty = myType(), list = myMS().combo, combo = Math.min(ev.combo | 0, list.length - 1), h = list[combo], col = glowCol(), gap = (combo > 0 ? list[combo - 1].gap : Math.max(0.18, lastGapK)) * 0.9 / atkSpd(); lastGapK = h.gap;
    if (h.bolt) { const tgt = MB.nearest(P.x, P.z, ty.range + 1.5), pr = tgt ? null : nearestProp(ty.range + 1), tx = tgt ? tgt.x : pr ? pr.x : P.x + Math.sin(P.yaw) * ty.range, tz = tgt ? tgt.z : pr ? pr.z : P.z + Math.cos(P.yaw) * ty.range;
      projectiles.push({ x: P.x + Math.sin(P.yaw) * 0.8, y: P.y + 1.6, z: P.z + Math.cos(P.yaw) * 0.8, tx, tz, tgt, t: 0, col, sp: 24 }); AU.play('spit');
      const near = MB.inArea(tx, tz, 0, 2.4, TAU).map(q => q.uid); if (tgt && !near.includes(tgt.uid)) near.unshift(tgt.uid);
      if (RUN) sendAtk({ k: 'basic', combo, targets: near.slice(0, 16), x: +tx.toFixed(2), z: +tz.toFixed(2) }, gap); else if (App.zone.t === 'hub') MB.hitTown(tx, tz, 0, 2.4, TAU, {}); return; }
    const fin = h.fin || h.burst, R = fin ? h.burst || C.SMASH_RADIUS * ty.aoe * (h.r || 1) : ty.range * (h.r || 1), arc = fin ? TAU : h.arc || ty.arc;
    if (RUN) { const sel = a => { a.targets = swingTargets(R, arc); a.x = +P.x.toFixed(2); a.z = +P.z.toFixed(2); a.yaw = +P.yaw.toFixed(2); return a; }; sendAtk(sel({ k: 'basic', combo }), gap, sel); }
    else if (App.zone.t === 'hub') { const n = MB.hitTown(P.x, P.z, P.yaw, R, arc, {}); if (n) { hitstop = Math.max(hitstop, C.HITSTOP); AU.play('hit'); } }
    if (fin) { ring(P.x, P.z, R, col); App.shake(0.35); if (h.up) dustBurst(P.x, P.z, R); }
  }
  // ---- effects for the new moves
  function dustBurst(x, z, r) { if (!V_parts()) return; for (let i = 0; i < 22; i++) { const a = Math.random() * TAU, v = r * (1 + Math.random()); E.particle({ x: x + Math.cos(a) * 0.5, y: 0.2, z: z + Math.sin(a) * 0.5, vx: Math.cos(a) * v, vy: 1 + Math.random() * 2, vz: Math.sin(a) * v, life: 0.6, size: 0.45, drag: 3.5, col: '#8a8494', a: 0.45 }); } }
  function arcFx(x, z, yaw, r, arc, col) { if (!V_parts()) return; for (let i = 0; i <= 16; i++) { const a = yaw - arc / 2 + arc * i / 16, sx = Math.sin(a), sz = Math.cos(a);
    E.particle({ x: x + sx * r * 0.7, y: 1.1 + Math.random() * 0.3, z: z + sz * r * 0.7, vx: sx * 6 + Math.cos(a) * 4, vy: 0.2, vz: sz * 6 - Math.sin(a) * 4, life: 0.28, size: 0.28, drag: 4, col, add: true }); } }
  function ring(x, z, r, col, life) { fxList.push({ k: 'ring', x, z, r, col, t: 0, life: life || 0.35 }); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; E.particle({ x: x + Math.cos(a) * 0.6, y: 0.2, z: z + Math.sin(a) * 0.6, vx: Math.cos(a) * r * 2.4, vy: 1 + Math.random(), vz: Math.sin(a) * r * 2.4, life: 0.4, size: 0.2, drag: 3, col, add: true }); } }
  // ---------------------------------------------------------------- abilities (Update 7: 2 slots, Q and E)
  const SPCOL = { bheal: '#5aff7a', static: '#8ab0ff' }; for (const sp of C.SPELLS) SPCOL[sp.id] = sp.col || '#ffffff';
  App.SPCOL = SPCOL;
  // seconds of cooldown left (the Shrine of Arcana makes abilities recharge twice as fast)
  App.spellCd = id => RUN ? Math.max(0, (RUN.cds[id] || 0) - performance.now() / 1000) : 0;
  const buffOn = k => !!(RUN && RUN.buffs && RUN.buffs[k] > performance.now() / 1000);
  App.buffOn = buffOn;
  function castSpell(slot) {
    const s = App.s; if (!s || P.dead || busy() || fadeT > 0 || P.leap || P.dash) return;
    const id = s.spells[s.cls][slot]; if (!RUN && nearPoint()) return use();   // Update 7 (final): in town, Q / E at a glowing circle opens it (the gift chest, the Blacksmith...)
    if (!id) { UI.toast('Empty ability slot · pick abilities in Abilities (K)', '#c8c0d4'); return; }
    const sp = L.spell(id); if (!sp || !L.spellOk(s, sp)) return;
    if (!RUN) { UI.toast('Abilities work in dungeons and the Pit', '#c8c0d4'); return; }
    const now = performance.now() / 1000; if ((RUN.cds[id] || 0) > now) { AU.play('error'); return; }
    RUN.cds[id] = now + L.spellCd(s, sp) * 0.92 * (buffOn('arcana') ? 0.5 : 1);
    // cancel: an ability cuts off the end of a swing (once the blade has landed) or a charging heavy
    if (P.charge) { P.charge = null; me.act = null; } else if (me.act && (me.act.combo || me.act.ev) && me.hitDone) { me.act = null; P.atkLock = 0; }
    const reach = sp.range || sp.len || sp.dist || (sp.r ? sp.r + 3 : 8);
    const tgt = MB.nearest(P.x, P.z, reach); let tx = tgt ? tgt.x : P.x + Math.sin(P.yaw) * Math.min(8, reach * 0.6), tz = tgt ? tgt.z : P.z + Math.cos(P.yaw) * Math.min(8, reach * 0.6);
    if (tgt && sp.k !== 'blink' && sp.k !== 'heal' && sp.k !== 'dash') P.yaw = Math.atan2(tgt.x - P.x, tgt.z - P.z);
    let targets = [];
    switch (sp.k) {
      case 'arc': targets = MB.inArea(P.x, P.z, P.yaw, sp.r, sp.arc).map(q => q.uid); break;
      case 'single': case 'chain': targets = tgt ? [tgt.uid] : []; break;
      case 'missiles': targets = MB.alive().filter(q => Math.hypot(q.x - P.x, q.z - P.z) < sp.range).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)).slice(0, 6).map(q => q.uid); break;
      case 'leap': { const d = Math.min(sp.dist, Math.hypot(tx - P.x, tz - P.z)), a = P.yaw; const c = clampToFloor(P.x + Math.sin(a) * d, P.z + Math.cos(a) * d); tx = c[0]; tz = c[1]; P.leap = { x0: P.x, z0: P.z, x1: tx, z1: tz, t: 0 }; break; }
      case 'dash': { // charge: aim at the nearest slime if there is one, otherwise where you are running
        const a = tgt ? Math.atan2(tgt.x - P.x, tgt.z - P.z) : P.mv ? Math.atan2(P.dx, P.dz) : P.yaw; P.yaw = a;
        const c = clampToFloor(P.x + Math.sin(a) * sp.dist, P.z + Math.cos(a) * sp.dist); tx = c[0]; tz = c[1]; P.dash = { x0: P.x, z0: P.z, x1: tx, z1: tz, t: 0 }; break; }
      case 'blink': { const a = P.mv ? Math.atan2(P.dx, P.dz) : P.yaw; let bx = P.x, bz = P.z; for (let k = 1; k <= 18; k++) { const nx = P.x + Math.sin(a) * sp.dist * k / 18, nz = P.z + Math.cos(a) * sp.dist * k / 18, c = WD.collide(nx, nz, 0.45, 0);
          if (Math.hypot(c[0] - nx, c[1] - nz) > 0.05 || (RUN.mode === 'dungeon' && W.where(RUN.i, nx, nz, 0.3) < 0)) break; bx = nx; bz = nz; }
        spellFx({ s: 'blink', x: P.x, z: P.z }, true); tx = bx; tz = bz; P.x = bx; P.z = bz; P.yaw = a; break; }
      case 'summon': { const d = Math.min(4, Math.hypot(tx - P.x, tz - P.z)), a = P.yaw, c = clampToFloor(P.x + Math.sin(a) * d * 0.5, P.z + Math.cos(a) * d * 0.5); tx = c[0]; tz = c[1]; break; }
      case 'heal': case 'nova': case 'spin': case 'buff': case 'shield': case 'rage': case 'stealth': case 'aura': tx = P.x; tz = P.z; break;
      case 'pull': if (sp.self) { tx = P.x; tz = P.z; } break;
    }
    attackSim({ k: 'spell', id, targets, x: +tx.toFixed(2), z: +tz.toFixed(2), yaw: +P.yaw.toFixed(2) });
    if (App.mode === 'guest') s.spellsCast++;
    if (sp.k === 'rage') (RUN.buffs || (RUN.buffs = {})).rage = now + sp.dur;
    if (sp.k !== 'chain' && sp.k !== 'mark') spellFx({ s: id, x: tx, z: tz, yaw: P.yaw, tg: targets, by: App.myId }, true);
    const physical = sp.cls === 'warrior' || sp.cls === 'rogue' || sp.cls === 'paladin' || sp.k === 'arc' || sp.k === 'spin' || sp.k === 'dash';
    me.act = { a: physical && !['buff', 'shield', 'rage', 'aura', 'stealth', 'mark'].includes(sp.k) ? 'slash3' : 'point', dur: 0.5, upper: true }; me.actT = 0; me.armed = true; me.armedT = 4; netAnim('s' + slot);
    if (sp.k === 'heal') AU.play('heal'); else if (sp.k === 'buff' || sp.k === 'rage') AU.play('horn'); else if (sp.k === 'shield') AU.play('shield'); else if (sp.k === 'blink') AU.play('whoosh');
    else AU.play('abil', sp.el || 'phys');   // Update 7 (final): every ability sounds like its element (fire roars, frost chimes, storm cracks...)
    UI.castFlash && UI.castFlash(slot, sp);
  }
  App.castSpell = castSpell;
  function clampToFloor(x, z) { if (!RUN || RUN.mode !== 'dungeon') { if (RUN && (RUN.mode === 'pit' || RUN.mode === 'raid')) return WD.bound({ t: RUN.mode === 'pit' ? 'arena' : 'raid' }, x, z); return [x, z]; }
    const steps = 16; let lx = P.x, lz = P.z; for (let k = 1; k <= steps; k++) { const nx = P.x + (x - P.x) * k / steps, nz = P.z + (z - P.z) * k / steps; if (W.where(RUN.i, nx, nz, 0.4) < 0) break; const c = WD.collide(nx, nz, 0.45, 0); if (Math.hypot(c[0] - nx, c[1] - nz) > 0.1) break; lx = nx; lz = nz; } return [lx, lz]; }
  // ability visuals (mine right away, other players' when the simulation reports them). Each kind has its own look, coloured by the ability
  function spellFx(e, mine) {
    const sp = L.spell(e.s); if (!sp && e.s !== 'blink') return; const col = SPCOL[e.s] || '#ffffff';
    const caster = mine ? P : (App.others.get(e.by) || { x: e.x, y: 0, z: e.z }), follow = mine ? P : caster;
    if (!sp) { for (let i = 0; i < 26; i++) E.particle({ x: e.x + (Math.random() - 0.5), y: Math.random() * 2.4, z: e.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 2, vy: 1, vz: (Math.random() - 0.5) * 2, life: 0.6, size: 0.18, col: '#b45aff', add: true }); return; }
    const burst = (x, z, r, n, c2) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, rr = Math.random() * r; E.particle({ x: x + Math.cos(a) * rr, y: 0.3, z: z + Math.sin(a) * rr, vx: Math.cos(a) * 2, vy: 2 + Math.random() * 3, vz: Math.sin(a) * 2, life: 0.7, size: 0.2, col: c2 || col, add: true }); } };
    switch (sp.k) {
      case 'arc': fxList.push({ k: 'arc', x: caster.x, z: caster.z, yaw: e.yaw, r: sp.r, arc: sp.arc, col, t: 0, life: 0.35 }); if (mine) App.shake(0.3); break;
      case 'spin': fxList.push({ k: 'spin', follow, r: sp.r, col, t: 0, life: sp.dur }); break;
      case 'leap': fxList.push({ k: 'delay', t: 0, life: 0.45, at: () => { ring(e.x, e.z, sp.r, col); App.shake(0.6); AU.play('thud'); } }); break;
      case 'nova': ring(caster.x, caster.z, sp.r, col, 0.5); burst(caster.x, caster.z, sp.r, 40); if (sp.stun) { App.shake(0.6); AU.play('thud'); } break;
      case 'buff': ring(caster.x, caster.z, 3, col, 0.6); fxList.push({ k: 'aura', follow, col, t: 0, life: sp.dur }); break;
      case 'aura': ring(caster.x, caster.z, sp.r, col, 0.7); ring(caster.x, caster.z, 2.5, '#ffffff', 0.4); fxList.push({ k: 'aura', follow, col, t: 0, life: sp.dur }); break;
      case 'stealth': if (V_parts()) for (let j = 0; j < 40; j++) { const a = Math.random() * TAU, v = 1 + Math.random() * 3; E.particle({ x: caster.x, y: 0.3 + Math.random() * 1.8, z: caster.z, vx: Math.cos(a) * v, vy: 0.4, vz: Math.sin(a) * v, life: 1.1, size: 0.6 + Math.random() * 0.5, drag: 2, col: '#2a2236', a: 0.6 }); } break;
      case 'rage': ring(caster.x, caster.z, 2.5, col, 0.5); fxList.push({ k: 'aura', follow, col, t: 0, life: sp.dur }); fxList.push({ k: 'flames', follow, col, t: 0, life: sp.dur }); break;
      case 'shield': fxList.push({ k: 'bubble', follow, col, t: 0, life: sp.dur }); break;
      case 'single': { const m = (e.tg && MB.list.get(e.tg[0])) || null; fxList.push({ k: 'slash', x: m ? m.x : e.x, z: m ? m.z : e.z, col, t: 0, life: 0.4 }); if (mine) App.shake(0.5); break; }
      case 'proj': projectiles.push({ x: caster.x, y: 1.6, z: caster.z, tx: e.x, tz: e.z, t: 0, col, sp: 26, big: 1.6, boom: sp.r }); break;
      case 'missiles': { const list = (e.tg || []).map(u => MB.list.get(u)).filter(Boolean); for (let k = 0; k < sp.count; k++) { const m = list[k % Math.max(1, list.length)]; projectiles.push({ x: caster.x, y: 1.8, z: caster.z, tx: m ? m.x : e.x, tz: m ? m.z : e.z, tgt: m, t: -k * 0.08, col, sp: 20, curve: (k % 2 ? 1 : -1) * (1 + k * 0.3) }); } break; }
      case 'heal': fxList.push({ k: 'heal', x: e.x, z: e.z, r: sp.r, col, t: 0, life: sp.dur }); break;
      case 'meteor': fxList.push({ k: 'meteor', x: e.x, z: e.z, r: sp.r, col, t: 0, life: sp.delay + 0.1, delay: sp.delay }); break;
      case 'dash': fxList.push({ k: 'trail', follow, col, t: 0, life: 0.45 }); if (mine) App.shake(0.25); AU.play('dodge'); break;
      case 'line': fxList.push({ k: 'beam', x: caster.x, z: caster.z, yaw: e.yaw, len: sp.len, w: sp.w, col, t: 0, life: 0.45 }); if (mine) App.shake(0.35); break;
      case 'chain': if (e.pts) { fxList.push({ k: 'bolt', pts: e.pts, col, t: 0, life: 0.4 }); for (const q of e.pts.slice(1)) ring(q[0], q[1], 1.2, col, 0.3); } break;
      case 'zone': fxList.push({ k: 'zone', x: e.x, z: e.z, r: sp.r, col, t: 0, life: sp.dur, frost: !!sp.freeze, thorns: !!sp.root }); if (sp.root || sp.freeze) ring(e.x, e.z, sp.r, col, 0.5); break;
      case 'pull': if (sp.self) { ring(caster.x, caster.z, sp.r, col, 0.5); fxList.push({ k: 'chains', follow, r: sp.r, col, t: 0, life: 0.5 }); App.shake(0.5); }
        else fxList.push({ k: 'vortex', x: e.x, z: e.z, r: sp.r, col, t: 0, life: sp.delay + 0.3, delay: sp.delay }); break;
      case 'summon': fxList.push({ k: 'turret', x: e.x, z: e.z, col, t: 0, life: sp.dur, clone: sp.id === 'clone', by: e.by }); ring(e.x, e.z, 2, col, 0.5); break;
      case 'mark': ring(e.x, e.z, sp.r, col, 0.6); for (const u of e.tg || []) fxList.push({ k: 'mark', u, col, t: 0, life: sp.dur }); break;
      case 'shower': fxList.push({ k: 'zone', x: e.x, z: e.z, r: sp.r, col, t: 0, life: sp.dur + 0.6, warn: 1 }); break;
    }
  }
  App.spellFx = spellFx;
  // ping: mark a spot for your party (T)
  let pingT = 0;
  const SURF = C.MUSIC.SURF;
  function stepSurf() { if (RUN && RUN.mode === 'dungeon') { const id = C.DUNGEONS[RUN.i].id; return SURF[id] || 'stone'; } if (RUN && RUN.mode === 'wild') return 'grass'; return 'stone'; }
  function ping() { if (!App.s || busy() || performance.now() - pingT < 1500) return; pingT = performance.now(); const m = MB.nearest(P.x, P.z, 20), x = m ? m.x : P.x + Math.sin(P.yaw) * 8, z = m ? m.z : P.z + Math.cos(P.yaw) * 8;
    pingFx(x, z, App.myName); AU.play('ping'); if (App.online) send({ t: 'ping', x: +x.toFixed(1), z: +z.toFixed(1) }); }
  function pingFx(x, z, n) { fxList.push({ k: 'ping', x, z, n, t: 0, life: 4 }); ring(x, z, 2, '#ffd84a', 0.6); AU.play('click'); if (n && n !== App.myName) UI.toast(n + ' pinged a spot', '#ffd84a'); }
  function dodge() {
    if (!App.s || P.dead || busy() || P.dodgeCD > 0 || fadeT > 0 || P.leap || P.dash || P.slam) return;
    App.tutStep('dodge'); P.dodgeT = C.DODGE_TIME; P.dodgeAt = gT; P.dodgeCD = C.DODGE_COOLDOWN; const a = P.mv ? Math.atan2(P.dx, P.dz) : P.yaw; P.yaw = a; P.rollYaw = a; me.act = null;
    if (RUN && !RUN.done) { if (RUN.local) SD.dodge(RUN.inst, App.myId); else send({ t: 'dodge' }); }
    AU.play('dodge'); netAnim('d'); for (let i = 0; i < 10; i++) E.particle({ x: P.x, y: P.y + 0.2, z: P.z, vx: (Math.random() - 0.5) * 3, vy: 0.8, vz: (Math.random() - 0.5) * 3, life: 0.4, size: 0.35, drag: 3, col: '#8a8494', a: 0.5 });
  }
  function hurtFx(dmg, fx, fz) {
    AU.play('hurt'); App.shake(0.45); $('#vig').style.opacity = 0.75; setTimeout(() => $('#vig').style.opacity = 0, 140); P.hurtT = 0;
    if (SET.nums !== false) MB.num(P.x, P.y + 2.9, P.z, '-' + Math.round(dmg), '#ff4a4a', 1.1);
    if (fx !== null && fx !== undefined) { const dx = P.x - fx, dz = P.z - fz, d = Math.hypot(dx, dz) || 1; P.kx += dx / d * 5; P.kz += dz / d * 5; P.vy = Math.max(P.vy, 2.5); P.gr = false; }   // a short shove: you stay in reach to hit back
    // a hit makes you flinch, but never cuts off an attack you are in the middle of (and a charge keeps going)
    if (!me.act || !(me.act.combo || me.act.ev || me.act.lock)) { CH.play(me, 'hit', { moving: P.mv }); netAnim('h'); }
  }
  function myDeath(out) {
    P.dead = true; P.out = !!out; P.hp = 0; me.act = null; P.leap = null; P.dash = null; AU.play('bossDie'); AU.sting && AU.sting('death'); $('#dead').classList.remove('hidden');
    $('#dead h1').textContent = out ? 'YOU ARE OUT' : 'YOU WERE SLAIN'; $('#deadpen').textContent = ''; P.deadT = C.RESPAWN_TIME; if (App.mode === 'guest') App.s.deaths++;
  }
  // town: the raid boss shockwave only knocks you about
  function townHurt(R) { const dx = P.x - R.x, dz = P.z - R.z, d = Math.hypot(dx, dz) || 1; P.kx += dx / d * 12; P.kz += dz / d * 12; P.vy = 6; P.gr = false; AU.play('hurt'); App.shake(0.4); CH.play(me, 'hit', { moving: P.mv }); }

  // ---------- interaction ----------
  let portalCD = 0;
  const ptsKey = () => WD.zoneKey(App.zone);
  function nearPoint() {
    const pts = WD.points[ptsKey()] || []; let best = null, bd = 99;
    for (const q of pts) { const d = Math.hypot(P.x - q.x, P.z - q.z); if (d < q.r && d < bd && !q.walk) { bd = d; best = q; } } return best;
  }
  function walkTriggers() {
    if (portalCD > 0 || fadeT > 0 || P.dead) return; const pts = WD.points[ptsKey()] || [];
    for (const q of pts) { if (!q.walk || Math.hypot(P.x - q.x, P.z - q.z) > q.r || Math.abs(P.y - (q.y || 0)) > 2) continue; portalCD = 1.5;
      const push = () => { const a = P.yaw + Math.PI; P.x += Math.sin(a) * 2.2; P.z += Math.cos(a) * 2.2; };
      if (q.key === 'portal') { App.tutStep('portal'); UI.show('dungeons', { i: q.k }); push(); }
      else if (q.key === 'leave') { if (RUN) App.leaveRun(RUN.done); else exitRun(); push(); }
      else if (q.key === 'wilds') { if (!RUN) App.playSolo('wild', 0, 0, false); push(); }
      else if (q.key === 'leaveWild') { if (RUN && RUN.mode === 'wild') App.leaveRun(true); push(); }
      else if (q.key === 'leaveWin') { if (RUN && RUN.cleared) { UI.hide(); exitRun(); } else { UI.toast('Defeat the boss to open the way home', '#ffcf8a'); push(); } }
      return; }
  }
  function use() {
    if (P.dead || fadeT > 0) return;
    const q = nearPoint(); if (!q) return UI.toast(RUN ? 'Fight! Clear each room to open the gate.' : 'Stand on a glowing circle, then press ' + App.keyName(BIND.use) + ' or E', '#c8c0d4');
    switch (q.key) {
      case 'smith': return UI.show('forge');
      case 'armory': return UI.show('avatar');
      case 'quests': return UI.show('quests');
      case 'gift': return L.giftReady(App.s, App.now()) ? App.act('gift') : UI.show('quests');
      case 'arena': return UI.show('dungeons', { mode: 'pit' });
      case 'board': return UI.show('board');
      case 'map': return UI.show('dungeons');
      case 'way': return App.act('way', { i: q.i });
      case 'lanterns': { const n = (App.s.lanterns || []).length; return UI.toast('Lost lanterns: ' + n + ' / ' + L.ND + ' · one is hidden in a corner of every dungeon' + (n >= L.ND ? ' · all found!' : ''), '#ffd88a'); }
    }
  }
  // Update 6 world mechanics on this side: the Hollow Moon's low gravity (and the Lunar armour set), wading through the Drowned Cathedral's tide
  const runMech = () => RUN && RUN.mode === 'dungeon' ? C.DUNGEONS[RUN.i].mech : '';
  const worldGrav = () => runMech() === 'gravity' ? C.HAZ.LOW_GRAVITY : 1;
  const jumpK = () => 1;
  let tideWarnT = -1;
  function myTide() { if (runMech() !== 'tide' || !RUN.feat || !RUN.feat.haz) return null; for (const h of RUN.feat.haz) { if (h.k !== 'tide') continue;
      if (h.round ? Math.hypot(P.x - h.x, P.z - h.z) < h.round : Math.abs(P.x - h.x) < h.w / 2 && Math.abs(P.z - h.z) < h.d / 2) return h; } return null; }
  function tideSlow() { const h = myTide(); if (!h) return 1; const rt = runTime(), st = L.tideState(h, rt);
    if (st === 1) { const cyc = Math.floor((rt + h.ph) / C.HAZ.TIDE_PERIOD); if (cyc !== tideWarnT) { tideWarnT = cyc; UI.toast('The tide is coming in! Climb onto a glowing dais', '#7affe8'); AU.play('splash'); AU.play('tide'); } }
    return st === 2 && P.y < 1.2 && !L.tideSafe(h, P.x, P.z) ? C.HAZ.TIDE_SLOW : 1; }
  function jump() {
    if (P.dead || busy() || P.dodgeT > 0 || P.leap) return;
    if (P.coy > 0) { P.vy = C.JUMP * jumpK(); P.coy = 0; P.gr = false; P.jumps = 1; AU.play('jump'); }
    else if (P.jumps < 2) { P.jumps = 2; P.vy = C.JUMP * 0.92 * jumpK(); CH.play(me, 'doubleJump'); netAnim('j'); AU.play('jump');
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; E.particle({ x: P.x, y: P.y + 0.2, z: P.z, vx: Math.cos(a) * 3, vy: -0.5, vz: Math.sin(a) * 3, life: 0.4, size: 0.2, col: glowCol(), add: true }); } }
  }

  // ---------- input ----------
  const K = {}; let jx = 0, jy = 0, held = false, drag = null, shiftLock = false, netNow = false;
  const busy = () => !!UI.cur || !App.inGame || $('#emotes').classList.contains('on') || document.activeElement === $('#cin');
  function setShiftLock(on) { if (on && !SET.shiftKey) return; if (on) { try { canvas.requestPointerLock(); } catch (e) {} } else if (document.pointerLockElement) document.exitPointerLock(); shiftLock = on; }
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) shiftLock = false; });
  // ---------- photo mode (O): no HUD, orbit the camera freely, filters, save a picture ----------
  const PHOTO_F = ['none', 'grayscale(1) contrast(1.15)', 'sepia(0.75) contrast(1.08) brightness(1.05)', 'saturate(1.55) contrast(1.08)', 'hue-rotate(195deg) saturate(1.15)', 'contrast(1.3) brightness(0.92) saturate(0.6)'], PHOTO_N = ['No filter', 'Noir', 'Old photo', 'Vivid', 'Cold moon', 'Grim'];
  App.photoOn = false; let photoF = 0, photoShot = false, menuSkip = 0;
  App.photo = on => { App.photoOn = !!on; document.body.classList.toggle('photo', App.photoOn); if (!on) { canvas.style.filter = ''; photoF = 0; } else { UI.hide(); UI.toast('Photo mode · drag to orbit · wheel to zoom · 1-6 filters · Space saves a picture · O or Esc to leave', '#e8e2ee'); } };
  App.photoSave = () => { photoShot = true; };
  App.photoFilter = () => { photoF = (photoF + 1) % PHOTO_F.length; canvas.style.filter = PHOTO_F[photoF] === 'none' ? '' : PHOTO_F[photoF]; UI.toast(PHOTO_N[photoF], '#e8e2ee'); };
  function photoKey(e) { if (e.code === 'Escape' || KEYACT[e.code] === 'photo') { App.photo(false); return; } if (e.code >= 'Digit1' && e.code <= 'Digit6') { photoF = +e.code.slice(5) - 1; canvas.style.filter = PHOTO_F[photoF] === 'none' ? '' : PHOTO_F[photoF]; UI.toast(PHOTO_N[photoF], '#e8e2ee'); }
    if (e.code === 'Space') { photoShot = true; } if (KEYACT[e.code] === 'emotes') $('#emotes').classList.toggle('on'); }
  function takePhoto() { AU.play('shutter'); try { const c2 = document.createElement('canvas'); c2.width = canvas.width; c2.height = canvas.height; const g = c2.getContext('2d'); if (PHOTO_F[photoF] !== 'none') g.filter = PHOTO_F[photoF]; g.drawImage(canvas, 0, 0);
      g.filter = 'none'; g.font = '600 ' + Math.round(c2.height / 40) + 'px Outfit,sans-serif'; g.fillStyle = 'rgba(255,240,200,0.7)'; g.textAlign = 'right'; g.fillText('SLIME SLAYERS', c2.width - 16, c2.height - 16);
      const a = document.createElement('a'); a.download = 'slime-slayers-' + Date.now() + '.png'; a.href = c2.toDataURL('image/png'); a.click(); AU.play('click'); UI.toast('Photo saved to your downloads', '#9ad8a0'); App.lastPhoto = a.href.length; } catch (err) { UI.toast('Could not save the photo here', '#ff9a9a'); } }
  // ---------- the tutorial (new players): a small panel with one step at a time ----------
  const TUT = C.TUTORIAL.STEPS; let tutN = 0, moveT = 0;
  App.tutStep = k => { if (!App.s || App.s.tut === 'done' || store.get('ss_tut_skip', 0) || !TUT[tutN] || TUT[tutN][0] !== k) return; tutN++; store.set('ss_tut_' + App.myName, tutN); AU.play('unlock');
    if (tutN >= TUT.length) { App.act('tut'); UI.celebrate('Tutorial complete', 'You know every move now. Go slay some slimes!', '+' + fmt(L.clears(App.s, C.TUTORIAL.GOLD)) + ' gold', '#9ad8a0'); } tutPanel(); };
  App.tutSkip = () => { store.set('ss_tut_skip', 1); tutPanel(); };
  App.tutAgain = () => { store.set('ss_tut_skip', 0); tutPanel(); };
  function tutPanel() { const e = $('#tut'); if (!e) return; if (tutN === 0 && !App.tutLoaded && App.myName) { App.tutLoaded = 1; tutN = +store.get('ss_tut_' + App.myName, 0) || 0; }
    const on = App.inGame && App.s && App.s.tut !== 'done' && !store.get('ss_tut_skip', 0) && App.s.level < 20 && tutN < TUT.length && !RUN;
    e.classList.toggle('on', !!on); if (on) { const t = e.querySelector('.tt'); if (t._n !== tutN) { t._n = tutN; t.innerHTML = '<small>TUTORIAL ' + (tutN + 1) + ' / ' + TUT.length + '</small>' + TUT[tutN][1].replace(/\{(\w+)\}/g, (m, k) => '<kbd>' + App.keyName(BIND[k]) + '</kbd>'); } } }
  App.tutPanel = tutPanel; App.myLook = myLook; App.myKind = () => myKind(); App.gfxQ = () => E.quality;
  // ---------- gamepad (standard layout; C.PAD) ----------
  const pad = { mx: 0, mz: 0, prev: [], held: false, seen: false };
  addEventListener('gamepadconnected', e => { pad.seen = true; UI.toast('Controller connected · A jump · B dodge · X attack (hold to keep swinging) · LB parry', '#9ad8ff'); });
  let padLook = 0;
  function pollPad(dt) {
    pad.mx = pad.mz = 0; if (!navigator.getGamepads) return; let gp = null;
    if (!pad.seen) { if (++padLook % 90) return; try { if (![...navigator.getGamepads()].some(g => g && g.connected)) return; } catch (e) { return; } pad.seen = true; }   // only poll once a controller exists
    try { for (const g of navigator.getGamepads()) if (g && g.connected && (!gp || g.mapping === 'standard')) gp = g; } catch (e) { return; } if (!gp) return;
    const D = C.PAD.DEAD, dz = v => Math.abs(v || 0) < D ? 0 : (v - Math.sign(v) * D) / (1 - D), ax = gp.axes;
    const now = gp.buttons.map(q => !!(q && (q.pressed || q.value > 0.5))), was = pad.prev, down = i => now[i] && !was[i]; pad.prev = now;
    if (UI.cur) { if (down(1) || down(9)) UI.hide(); return; }
    if (!App.inGame) return;
    if (down(9)) return UI.show('settings'); if (down(8)) return UI.show('dungeons');
    if (busy()) return;
    pad.mx = dz(ax[0]); pad.mz = dz(ax[1]); cam.yaw -= dz(ax[2]) * C.PAD.LOOK * dt * SET.sens; cam.pitch = clamp(cam.pitch + dz(ax[3]) * C.PAD.LOOK * 0.55 * dt * SET.sens, -0.15, 1.2);
    if (down(0)) jump(); if (down(1)) dodge(); if (down(3)) use(); if (down(4)) parry();
    if (down(6)) castSpell(0); if (down(7)) castSpell(1); if (down(12)) castSpell(2); if (down(13)) castSpell(3);
    if (down(2)) { pad.held = true; held = true; attack(); } else if (pad.held && !now[2]) { pad.held = false; held = false; }
  }
  App._pad = pad;
  // key bindings (Settings → Controls): action -> key code, and the reverse
  let BIND = {}, KEYACT = {};
  // Update 7: abilities moved to Q and E (two slots), dodge to X, use to F and parry to V. Old custom keys for those, for the removed slots 3-4, or that
  // would clash with the new keys are dropped, once, so nothing ends up on two actions
  if (SET.keysV !== 7) { const k = Object.assign({}, SET.keys || {}), moved = ['s1', 's2', 'dodge', 'use', 'parry', 'heavy'], taken = moved.map(a => C.KEYS[a]).filter(Boolean);
    for (const a of Object.keys(k)) if (!(a in C.KEYS) || moved.includes(a) || taken.includes(k[a])) delete k[a]; SET.keys = k; SET.keysV = 7; store.set('ss_settings', SET); }
  function loadBinds() { BIND = Object.assign({}, C.KEYS, SET.keys || {}); KEYACT = {}; for (const a in BIND) if (BIND[a]) KEYACT[BIND[a]] = a; App.BIND = BIND; }
  loadBinds();
  App.keyName = code => !code ? '—' : code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code.startsWith('Numpad') ? 'Num ' + code.slice(6) : { Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' }[code] || code;
  // bind a key: if another action had it, that action gets this one's old key (a swap, so nothing is left unbound by accident)
  App.bindKey = function (act, code) { if (!(act in C.KEYS)) return; const keys = Object.assign({}, BIND), old = keys[act];
    for (const a in keys) if (a !== act && keys[a] === code) keys[a] = old || ''; keys[act] = code; const diff = {}; for (const a in keys) if (keys[a] !== C.KEYS[a]) diff[a] = keys[a];
    App.setSetting('keys', diff); loadBinds(); UI.keysChanged && UI.keysChanged(); };
  App.resetKeys = () => { App.setSetting('keys', {}); loadBinds(); UI.keysChanged && UI.keysChanged(); };
  setTimeout(() => { try { UI.keysChanged && UI.keysChanged(); } catch (e) {} }, 0);
  const RESERVED = ['Escape', 'Enter', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  function doAction(act) {
    switch (act) {
      case 'use': return use(); case 'jump': return jump(); case 'dodge': return dodge(); case 'parry': return parry();
      case 'attack': held = true; return attack();
      case 's1': case 's2': return castSpell(+act[1] - 1);
      case 'emotes': return $('#emotes').classList.toggle('on');
      case 'ping': return ping(); case 'photo': return App.photo(!App.photoOn);
      case 'gear': return UI.show('gear'); case 'char': return UI.show('char'); case 'spells': return UI.show('spells'); case 'map': return UI.show('dungeons');
    }
  }
  addEventListener('keydown', e => {
    // Settings → Controls is waiting for a key
    if (App.photoOn && App.inGame && !UI.binding) { e.preventDefault(); photoKey(e); return; }
    if (UI.binding) { e.preventDefault(); e.stopPropagation(); if (e.code !== 'Escape' && !RESERVED.includes(e.code)) App.bindKey(UI.binding, e.code); UI.binding = null; UI.render(); return; }
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT')) { if (tg.id === 'cin') { if (e.code === 'Enter') sendChat(); if (e.code === 'Escape') tg.blur(); } return; }
    if (!App.inGame) return;
    if (e.code === 'Escape') { $('#emotes').classList.remove('on'); if (UI.cur) { if (UI.cur === 'results') App.closeResults(); else UI.hide(); } else if (shiftLock) setShiftLock(false); else UI.show('settings'); return; }
    if (e.code === 'Enter' && !UI.cur && !e.repeat) { e.preventDefault(); $('#cin').focus(); for (const k in K) K[k] = 0; if (shiftLock) setShiftLock(false); return; }
    if (UI.cur) { if (KEYACT[e.code] === 'use' && UI.cur !== 'avatar') UI.hide(); return; }
    if (KEYACT[e.code] === 'emotes' && !e.repeat) { $('#emotes').classList.toggle('on'); return; }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && !busy()) { setShiftLock(!shiftLock); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    K[e.code] = 1; if (busy() || e.repeat) return;
    const act = KEYACT[e.code]; if (act) doAction(act);
  }, true);
  addEventListener('keyup', e => { K[e.code] = 0; const act = KEYACT[e.code]; if (act === 'attack') held = false; }, true);
  addEventListener('blur', () => { for (const k in K) K[k] = 0; held = false; });
  $('#cin').addEventListener('focus', () => $('#chat').classList.add('typing')); $('#cin').addEventListener('blur', () => $('#chat').classList.remove('typing'));
  function sendChat() { const i = $('#cin'), m = i.value.trim().slice(0, 120); i.value = ''; i.blur(); canvas.focus(); if (!m) return; if (App.online) send({ t: 'c', m }); else { UI.addChat(App.myName, m); bubble = { m, t: Tm }; } }
  canvas.addEventListener('pointerdown', e => {
    AU.unlock(); canvas.focus(); if (busy()) return;
    if (shiftLock) { if (e.button === 0) { held = true; attack(); } return; }
    if (App.photoOn) { drag = { x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} return; }
    if (e.pointerType === 'mouse') { if (e.button === 0) { held = true; attack(); } else drag = { x: e.clientX, y: e.clientY }; }
    else drag = { x: e.clientX, y: e.clientY, t: performance.now(), sx: e.clientX, sy: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (shiftLock) { cam.yaw -= e.movementX * 0.0035 * SET.sens; cam.pitch = clamp(cam.pitch + e.movementY * 0.003 * SET.sens, -0.25, 1.2); return; }
    if (!drag) return; cam.yaw -= (e.clientX - drag.x) * 0.006 * SET.sens; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.005 * SET.sens, -0.15, 1.2); drag.x = e.clientX; drag.y = e.clientY;
  });
  canvas.addEventListener('pointerup', e => { if (e.button === 0) held = false; if (drag && drag.t && performance.now() - drag.t < 250 && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 10) attack(); drag = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { cam.dist = clamp(cam.dist + e.deltaY * 0.01, App.photoOn ? 2.5 : 5, App.photoOn ? 40 : 26); e.preventDefault(); }, { passive: false });
  const tbtn = (id, fn, hold) => { const b = $(id); if (!b) return; b.onpointerdown = e => { e.preventDefault(); AU.unlock(); if (hold) held = true; if (!busy()) fn(); }; if (hold) b.onpointerup = b.onpointercancel = () => held = false; };
  tbtn('#tAtk', attack, true); tbtn('#tJmp', jump); tbtn('#tDdg', dodge); tbtn('#tUse', use); tbtn('#tPry', parry);
  // Update 7: the town buttons (Play, Inventory, Cosmetics) and Swap / Shift-lock (reference photo 19)
  { const on = (id, fn) => { const e = $(id); if (e) e.onclick = e2 => { e2.stopPropagation(); fn(); }; };
    on('#tbPlay', () => { const s = App.s; let i = 0; for (let k = 0; k < L.ND; k++) if (L.dunUnlocked(s, k)) i = k; UI.show('dungeons', { i }); });
    on('#tbInv', () => UI.show('gear')); on('#tbCos', () => UI.show('avatar')); on('#tbSwap', () => App.act('swap'));
    on('#tbShift', () => { if (shiftLock) setShiftLock(false); else { try { canvas.requestPointerLock(); } catch (e) {} shiftLock = true; } $('#tbShift').classList.toggle('on', shiftLock); }); }
  for (let k = 0; k < C.SPELL_SLOTS; k++) { tbtn('#tS' + k, () => castSpell(k)); const el = $('#sp' + k); if (el) el.onclick = () => { if (!busy()) castSpell(k); }; }
  const joy = $('#joy'), knob = $('#knob');
  function jm(e) { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - 62) / 62, y = (e.clientY - r.top - 62) / 62; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } jx = x; jy = y; knob.style.left = 39 + x * 40 + 'px'; knob.style.top = 39 + y * 40 + 'px'; }
  joy.onpointerdown = e => { joy.setPointerCapture(e.pointerId); jm(e); }; joy.onpointermove = e => { if (e.buttons || e.pointerType === 'touch') jm(e); };
  joy.onpointerup = joy.onpointercancel = () => { jx = jy = 0; knob.style.left = knob.style.top = '39px'; };
  const menuMap = { mDun: 'dungeons', mGear: 'gear', mChar: 'char', mSpells: 'spells', mQuests: 'quests', mProfile: 'profile', mBoard: 'board', mSet: 'settings' };
  for (const id in menuMap) { const b = $('#' + id); if (b) b.onclick = () => { if (UI.cur === menuMap[id]) UI.hide(); else UI.show(menuMap[id]); }; }
  $('#mEmote').onclick = () => { if (UI.cur) UI.hide(); $('#emotes').classList.toggle('on'); };
  function resizeOv() { const d = Math.min(devicePixelRatio || 1, 2); ov.width = innerWidth * d; ov.height = innerHeight * d; og.setTransform(d, 0, 0, d, 0, 0); }
  addEventListener('resize', resizeOv); resizeOv();
  CH.EMOTES.forEach((em, i) => { const a = i / CH.EMOTES.length * TAU - Math.PI / 2, b = document.createElement('button');
    b.innerHTML = '<span>' + em.ico + '</span>' + em.n; b.style.left = (150 + Math.cos(a) * 112 - 48) + 'px'; b.style.top = (150 + Math.sin(a) * 112 - 31) + 'px'; b.onclick = () => App.emote(em.id); $('#emring').appendChild(b); });
  $('#emotes').addEventListener('click', e => { if (e.target.id === 'emotes') $('#emotes').classList.remove('on'); });

  // ---------- enter game ----------
  function enterGame() {
    App.inGame = true; $('#start').classList.add('hidden'); $('#hud').classList.remove('hidden');
    tp(W.SPAWN[0], W.SPAWN[1]); P.yaw = Math.PI; cam.yaw = 0; cam.pitch = 0.32; cam.dist = 13; P.hp = L.maxHp(App.s);
    canvas.focus(); AU.unlock(); AU.play('horn'); AU.startMusic(); zoneKey = '';
    UI.hud(); UI.sys('Welcome to Duskhold, ' + App.myName + '. Slimes have overrun the dungeons.', '#e8d8a8');
    if (!App.s.clears) setTimeout(() => UI.toast('WASD to move · walk into the green Mossy Woods portal to start your first dungeon', '#e8e2ee'), 1800);
    $('#fps').style.display = SET.fps ? '' : 'none';
  }
  $('#gName').value = store.get('ss_gname', '');
  if (token && savedName) { const b = $('#resumebtn'); b.classList.remove('hidden'); b.textContent = 'Continue as ' + savedName; b.onclick = () => App.auth({ t: 'resume', token }); }
  UI.drawLogo(); connect();

  // ---------- update ----------
  let lanternT = 0, msT = 0, shakeAmt = 0, Tm = 0, bubble = null, dailyT = 0, netT = 0, stepT = 0, relicT = 0, moveK = 1;
  function update(dt) {
    const s = App.s, now = App.now();
    if (!App.inGame || !s) { cam.yaw += dt * 0.05; return; }
    pollPad(dt);
    if (App.mode === 'guest') { s.time += dt; msT += dt; if (msT > 1) { msT = 0; milestones(L.checkMilestones(s)); } dailyT += dt; if (dailyT > 60) { dailyT = 0; const d = L.daily(s, now); if (d) dailyToast(d); } }
    // zone
    const z = WD.zoneAt(P.x, P.z), zk = z.t + z.k; App.zone = z; if (zk !== zoneKey) { zoneKey = zk; zoneChanged(z); }
    MB.rainOn = false;   // Slime Rain was removed (Update 5)
    // timers
    P.dodgeCD = Math.max(0, P.dodgeCD - dt); P.atkLock = Math.max(0, P.atkLock - dt); P.iframeT = Math.max(0, (P.iframeT || 0) - dt); P.hurtT += dt; portalCD = Math.max(0, portalCD - dt);
    P.iframe = P.dodgeT > 0 || P.iframeT > 0;
    if (RUN) { if (RUN.cleared) RUN.openT += dt; if (P.dead) { P.deadT -= dt; $('#deadt').textContent = P.out ? (RUN.players.size > 1 ? 'Hardcore: you are out for this run. Watch your party or leave.' : '') : RUN.mode === 'raid' ? 'Nobody respawns in a raid. Watch your party, or leave.' : RUN.mode === 'pit' ? 'You are back when this wave is cleared' : 'Respawning in ' + Math.ceil(Math.max(0, P.deadT)) + '...'; } }
    else { P.hp = L.maxHp(s); if (P.dead) { P.dead = false; $('#dead').classList.add('hidden'); } }
    gT += dt; P.parryCd = Math.max(0, (P.parryCd || 0) - dt);
    while (pendAtk.length && gT >= pendAtk[0].at) { const q = pendAtk.shift(); attackSim(q.sel ? q.sel(q.a) : q.a); }   // in order, so the combo stays a combo
    // a click during a dodge roll swings as soon as the roll ends; holding the attack keeps swinging
    if (P.atkBuf > 0) { P.atkBuf -= dt; if (P.dodgeT <= 0 && !busy() && !P.dead) { P.atkBuf = 0; attack(); } }
    if (held && !busy() && !P.dead) { holdT += dt; attack(); } else holdT = 0;
    // movement input
    let ix = (K[BIND.right] ? 1 : 0) - (K[BIND.left] ? 1 : 0) + jx + pad.mx, iz = (K[BIND.down] ? 1 : 0) - (K[BIND.up] ? 1 : 0) + jy + pad.mz;
    if (K.ArrowLeft) cam.yaw += dt * 2.2; if (K.ArrowRight) cam.yaw -= dt * 2.2; if (K.ArrowUp) iz -= 1; if (K.ArrowDown) iz += 1;
    if (busy() || P.dead || App.photoOn) ix = iz = 0;
    if (P.spd > 2.5) { moveT += dt; if (moveT > 1.2) App.tutStep('move'); } if (UI.cur === 'gear') App.tutStep('gear');
    const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; } P.mv = il > 0.1;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw); P.dx = ix * cy + iz * sy; P.dz = -ix * sy + iz * cy;
    const haste = RUN && RUN.buffs && RUN.buffs.haste > performance.now() / 1000 ? 1.3 : 1;
    let spd = C.WALK_SPEED * moveK * haste * tideSlow() * (me.act && me.act.combo ? 0.45 : 1) * (P.charge ? 0.3 : P.slam ? 0.2 : me.act && me.act.lock ? 0.15 : 1);
    let vx = P.dx * spd, vz = P.dz * spd;
    if (P.dodgeT > 0) { P.dodgeT -= dt; const k = P.dodgeT / C.DODGE_TIME; vx = Math.sin(P.rollYaw) * C.DODGE_SPEED * (0.4 + k); vz = Math.cos(P.rollYaw) * C.DODGE_SPEED * (0.4 + k); }
    if (P.lunge > 0) { P.lunge -= dt; vx += Math.sin(P.yaw) * 6; vz += Math.cos(P.yaw) * 6; }
    if (P.kx || P.kz) { vx += P.kx; vz += P.kz; const kd = Math.max(0, 1 - dt * 7); P.kx *= kd; P.kz *= kd; if (Math.abs(P.kx) + Math.abs(P.kz) < 0.05) P.kx = P.kz = 0; }
    const px0 = P.x, pz0 = P.z;
    if (P.leap) { const q = P.leap; q.t += dt; const k = Math.min(1, q.t / 0.45); P.x = q.x0 + (q.x1 - q.x0) * k; P.z = q.z0 + (q.z1 - q.z0) * k; P.y = Math.sin(k * Math.PI) * 2.6; if (k >= 1) { P.leap = null; P.y = 0; } vx = vz = 0; }
    if (P.dash) { const q = P.dash; q.t += dt; const k = Math.min(1, q.t / 0.26); P.x = q.x0 + (q.x1 - q.x0) * k; P.z = q.z0 + (q.z1 - q.z0) * k; P.iframeT = Math.max(P.iframeT, 0.1); vx = vz = 0;
      if (V_parts()) for (let j = 0; j < 3; j++) E.particle({ x: P.x + (Math.random() - 0.5) * 0.8, y: 0.4 + Math.random() * 1.4, z: P.z + (Math.random() - 0.5) * 0.8, vx: 0, vy: 0.5, vz: 0, life: 0.35, size: 0.28, col: SPCOL.charge, add: true });
      if (k >= 1) P.dash = null; }
    P.x += vx * dt; P.z += vz * dt;
    { const c = WD.collide(P.x, P.z, 0.45, P.y); P.x = c[0]; P.z = c[1]; const b = WD.bound(z, P.x, P.z); P.x = b[0]; P.z = b[1]; }
    // bosses, mini-bosses and the boss's heart are solid (the server checks this too)
    if (RUN && P.y < 2.2) for (const m of MB.list.values()) { if (m.dead || !(m.boss || m.mini || m.kind === 'heart') || m.st === 'spawn' || m.st === 'vanish' || (m.y || 0) > 1.5) continue;
      const dx = P.x - m.x, dz = P.z - m.z, d = Math.hypot(dx, dz), r = m.sc * 0.85 + 0.4; if (d < r && d > 1e-3) { P.x = m.x + dx / d * r; P.z = m.z + dz / d * r; } }
    // stay on the dungeon floor (no walking off into the dark)
    if (z.t === 'dun' && W.where(z.k, P.x, P.z, 0.35) < 0) { if (W.where(z.k, P.x, pz0, 0.35) >= 0) P.z = pz0; else if (W.where(z.k, px0, P.z, 0.35) >= 0) P.x = px0; else { P.x = px0; P.z = pz0; } }
    if (shiftLock) P.yaw = cam.yaw + Math.PI;
    else if (P.mv && P.atkLock <= 0 && P.dodgeT <= 0) { const a = Math.atan2(P.dx, P.dz); let df = a - P.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); P.yaw += df * Math.min(1, dt * 14); }
    // vertical: gravity, ground, crates
    if (!P.leap) { const oy = P.y; P.vy -= C.GRAVITY * dt * worldGrav() * (P.slam ? 1 / worldGrav() : 1); P.y += P.vy * dt; P.gr = false;
      const ground = WD.floorAt(P.x, P.z, oy); P.groundY = ground;
      if (P.y <= ground && P.slam) { P.slam = null; CH.play(me, 'airLand'); netAnim('l'); AU.play('slam'); }
      if (P.y <= ground) { P.y = ground; if (P.vy < -6) { CH.play(me, 'land'); AU.play('land', -P.vy / 16); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; E.particle({ x: P.x + Math.cos(a) * 0.4, y: P.y + 0.1, z: P.z + Math.sin(a) * 0.4, vx: Math.cos(a) * 2.5, vy: 0.6, vz: Math.sin(a) * 2.5, life: 0.45, size: 0.35, drag: 3, col: '#8a8494', a: 0.5 }); } }
        P.vy = 0; P.gr = true; P.jumps = 0; } }
    P.coy = P.gr ? 0.1 : Math.max(0, P.coy - dt);
    // walk-in triggers: portals; relics
    walkTriggers();
    if (RUN && RUN.mode === 'dungeon' && !(s.lanterns || []).includes(RUN.i)) { lanternT -= dt; const ln = W.layout(RUN.i).lantern; if (lanternT <= 0 && Math.hypot(P.x - ln.x, P.z - ln.z) < 1.8) { lanternT = 3; App.act('lantern', { i: RUN.i }); } }
    if (RUN && RUN.mode === 'dungeon' && RUN.i < 8 && !s.relics.includes(RUN.i)) { relicT -= dt; const r = W.layout(RUN.i).relic; if (relicT <= 0 && Math.hypot(P.x - r.x, P.z - r.z) < 1.8) { relicT = 3; App.act('relic', { i: RUN.i }); } }
    const np = nearPoint(); App.near = np ? np.key : null;
    // the run: local simulation steps here (fixed 20 Hz), online data arrives by message
    if (RUN && RUN.local && !RUN.done) {
      const inst = RUN.inst; if (!(fadeT > 0) && SD.move(inst, App.myId, P.x, P.y, P.z, P.yaw) === false && RUN.mode === 'dungeon') { const q = inst.players.get(App.myId); if (q && !q.dead) { P.x = q.x; P.z = q.z; } } stepAcc += dt;
      while (stepAcc >= 0.05) { stepAcc -= 0.05; SD.step(inst, 0.05); for (const e of SD.takeEvents(inst)) runEvent(e); if (!RUN || RUN.done) break; }
      if (RUN && RUN.inst) { MB.fromSim(RUN.inst); const p = RUN.inst.players.get(App.myId); if (p) { P.hp = p.hp; const q = RUN.players.get(App.myId); q.hp = p.hp; q.dead = p.dead; q.buff = RUN.inst.t < p.buff; q.shield = RUN.inst.t < p.shield; }
        for (let k = 0; k < RUN.inst.rooms.length; k++) RUN.rooms[k] = RUN.inst.rooms[k].st[0];
        if (p && p.dead && !P.dead) myDeath(p.out); if (p && !p.dead && P.dead) { P.dead = false; $('#dead').classList.add('hidden'); tp(p.x, p.z); } }
    }
    // animation: speed from real movement
    { const hs = Math.hypot(P.x - P.ox, P.z - P.oz) / Math.max(dt, 1e-3); P.ox = P.x; P.oz = P.z; P.spd += (Math.min(hs, 14) - P.spd) * Math.min(1, dt * 10);
      if (P.gr && P.spd > 2) { stepT += dt * P.spd; if (stepT > 2.4) { stepT = 0; AU.play('step', stepSurf()); } } }
    AU.listen && AU.listen(P.x, P.z, cam.yaw + Math.PI);
    if (me.act && me.act.combo) me.actT += dt * (L.speed(s) * (buffOn('rage') ? 1 + (L.spell('berserk').spd || 0) : 1) - 1);
    me.look = myLook();
    CH.update(me, dt, { speed: P.dodgeT > 0 ? 0 : P.spd, vy: P.vy, grounded: P.gr });
    for (const ev of me.events) onMoveEvent(ev); me.events.length = 0;
    if (!me.act || !me.act.combo) comboShow = 0;
    // projectiles (staff bolts, fireballs, missiles: visual only, the simulation decides the damage)
    for (let i = projectiles.length - 1; i >= 0; i--) { const q = projectiles[i]; q.t += dt; if (q.t < 0) continue; if (q.tgt && !q.tgt.dead && q.tgt.hp > 0) { q.tx = q.tgt.x; q.tz = q.tgt.z; }
      const dx = q.tx - q.x, dz = q.tz - q.z, d = Math.hypot(dx, dz), st = q.sp * dt; if (V_parts()) E.particle({ x: q.x, y: q.y, z: q.z, vx: 0, vy: 0, vz: 0, life: 0.25, size: 0.3 * (q.big || 1), col: q.col, add: true });
      if (d < st || q.t > 1.4) { projectiles.splice(i, 1); ring(q.tx, q.tz, q.boom || 1.4, q.col); if (q.boom) { App.shake(0.35); AU.play('thud'); } continue; }
      const c = q.curve ? Math.sin(Math.min(1, q.t * 2) * Math.PI) * q.curve * 0.15 : 0;
      q.x += dx / d * st + (-dz / d) * c; q.z += dz / d * st + (dx / d) * c; q.y += ((1.2) - q.y) * Math.min(1, dt * 4); }
    for (let i = fxList.length - 1; i >= 0; i--) { const f = fxList[i]; f.t += dt; if (f.k === 'delay' && !f.done && f.t >= f.life) { f.done = 1; f.at(); } if (f.k === 'meteor' && !f.done && f.t >= f.delay) { f.done = 1; ring(f.x, f.z, f.r, f.col, 0.5); App.shake(0.8); AU.play('boom');
        for (let j = 0; j < 50; j++) { const a = Math.random() * TAU, v = 2 + Math.random() * 6; E.particle({ x: f.x, y: 0.4, z: f.z, vx: Math.cos(a) * v, vy: 3 + Math.random() * 6, vz: Math.sin(a) * v, life: 0.9, size: 0.25, g: 9, col: Math.random() < 0.5 ? '#ff7a1a' : '#ffd25a', add: true }); } }
      if (f.k === 'vortex' && !f.done && f.t >= f.delay) { f.done = 1; ring(f.x, f.z, f.r * 0.7, f.col, 0.5); App.shake(0.7); AU.play('boom'); }
      if (f.k === 'vortex' && !f.done && V_parts() && Math.random() < 0.7) { const a = Math.random() * TAU, rr = f.r * (0.6 + Math.random() * 0.4); E.particle({ x: f.x + Math.cos(a) * rr, y: 0.3 + Math.random(), z: f.z + Math.sin(a) * rr, vx: -Math.cos(a) * rr * 1.6, vy: 0.3, vz: -Math.sin(a) * rr * 1.6, life: 0.55, size: 0.22, col: f.col, add: true }); }
      if (f.k === 'zone' && V_parts() && Math.random() < (f.warn ? 0.2 : 0.55)) { const a = Math.random() * TAU, rr = Math.random() * f.r; E.particle({ x: f.x + Math.cos(a) * rr, y: 0.15, z: f.z + Math.sin(a) * rr, vx: 0, vy: f.frost ? 0.6 : 2.2, vz: 0, life: 0.7, size: f.frost ? 0.16 : 0.24, col: f.col, add: true }); }
      if (f.k === 'swirl' && V_parts()) { const q = f.follow; for (let j = 0; j < 3; j++) { const a = f.t * 9 + j * TAU / 3, rr = f.r * (0.55 + 0.45 * Math.sin(f.t * 3 + j)); E.particle({ x: q.x + Math.cos(a) * rr, y: (q.y || 0) + 1 + Math.sin(a * 2) * 0.3, z: q.z + Math.sin(a) * rr, vx: -Math.sin(a) * 9, vy: 0, vz: Math.cos(a) * 9, life: 0.22, size: 0.3, col: f.col, add: true }); } }
      if (f.k === 'flames' && V_parts() && Math.random() < 0.6) { const q = f.follow; E.particle({ x: q.x + (Math.random() - 0.5) * 0.9, y: (q.y || 0) + 0.3 + Math.random() * 1.6, z: q.z + (Math.random() - 0.5) * 0.9, vx: 0, vy: 2.4, vz: 0, life: 0.45, size: 0.2, col: f.col, add: true }); }
      if (f.t > f.life) fxList.splice(i, 1); }
    LT.update(dt, P);
    // slimes (renderer)
    MB.update(dt, { P: { x: P.x, y: P.y, z: P.z, dead: P.dead, iframe: P.iframe }, online: RUN && !RUN.local, t: Tm, onTownHurt: townHurt });
    if (MB.boss && !MB.boss.dead && RUN) { const b = MB.boss, tip = RUN.tip && performance.now() - RUN.tip.at < 3500 ? RUN.tip.s : null;
      UI.boss({ n: b.d.n, hp: b.hp, max: b.max, p2: b.phase >= 2, sub: b.immune ? 'SHIELDED · break the Bound Heart to hurt it' : tip ? tip : b.phase === 3 ? 'FRENZY · it calls its elite guard · stay out of the red' : b.phase === 2 ? 'ENRAGED · faster moves · watch the floor' : 'Every boss fights differently · read the floor, dodge (Q), jump (Space)' }); }
    else if (MB.raid && App.raid && z.t === 'hub') UI.boss({ n: (C.WORLD_BOSSES[App.raid.wb || 0] || C.WORLD_BOSSES[0]).n, hp: MB.raid.hp, max: MB.raid.max, sub: 'World Boss Raid · everyone online fights together · ' + (App.raid.n || 0) + ' slayers' });
    else UI.boss(null);
    // camera follow
    const k = Math.min(1, dt * 9); cam.x += (P.x - cam.x) * k; cam.y += (P.y - cam.y) * Math.min(1, dt * (Math.abs(P.y - cam.y) > 3 ? 10 : 6)); cam.z += (P.z - cam.z) * k;
    // others (only the ones in the same place as you: town, or your run)
    App.others.forEach(o => {
      const kk = Math.min(1, dt * 10), px = o.x, py = o.y, pz = o.z; o.x += (o.tx - o.x) * kk; o.y += (o.ty - o.y) * kk; o.z += (o.tz - o.z) * kk;
      o.vis = RUN ? (!RUN.local && o.inst === RUN.id) : (!o.inst && W.inHub(o.x, o.z));
      const hs = Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-3), vv = (o.y - py) / Math.max(dt, 1e-3); o.spd = (o.spd || 0) + (Math.min(hs, 14) - (o.spd || 0)) * Math.min(1, dt * 8); o.vy = (o.vy || 0) + (vv - (o.vy || 0)) * Math.min(1, dt * 8);
      o.air = Math.abs(o.vy) > 1.2 && o.y > 0.3; let df = o.tyaw - o.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); o.yaw += df * kk;
      if (!o.st) o.st = CH.create(toCH(o.lk, o.gl)); o.st.look = toCH(o.lk, o.gl); CH.update(o.st, dt, { speed: o.spd, vy: o.vy, grounded: !o.air });
      if (o.roll !== undefined) { o.roll += dt; if (o.roll > C.DODGE_TIME) o.roll = undefined; }
    });
    // network position
    netT += dt; if (App.online && !(fadeT > 0) && (netT > 0.1 || netNow)) { netT = 0; netNow = false; send({ t: 'p', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), w: +P.yaw.toFixed(2), m: P.mv ? 1 : 0, a: P.netA, lv: s.level,
      gl: App.mode === 'guest' ? myGear() : undefined }); }
  }
  const V_parts = () => E.quality !== 'low';

  // ---------- run guides: where to go next (minimap + an arrow when the room is clear) ----------
  const mmap = $('#mmap'), mg = mmap ? mmap.getContext('2d') : null;
  function objective() {
    const R = RUN; if (!R || R.mode !== 'dungeon') return null; const lay = W.layout(R.i);
    if (R.cleared) return { x: lay.exit.x, z: lay.exit.z, n: 'Portal home' };
    const ri = R.rooms.findIndex((c, i) => i > 0 && i <= lay.boss && c !== 'c'); if (ri < 0 || R.rooms[ri] === 'a') return null;
    const q = lay.rooms[ri], h = lay.halls[q.hin], pr = W.where(R.i, P.x, P.z), n = q.kind === 'boss' ? 'The boss' : q.kind === 'mini' ? 'Mini-boss' : 'Room ' + ri;
    if (pr !== q.i && pr !== 100 + h.i) { const w = pr >= 0 && W.nav(lay).next[pr] && W.nav(lay).next[pr][q.i]; if (w && pr !== h.a) return { x: w.x, z: w.z, n }; return { x: h.pa.x, z: h.pa.z, n }; }
    const [dx, dz] = W.DIRV[h.dir]; return { x: h.pb.x + dx * 3, z: h.pb.z + dz * 3, n };
  }
  function rr2(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function drawMinimap(t) {
    if (mg && RUN && RUN.mode === 'wild') return drawWildMap(t);
    if (!mg || !RUN || RUN.mode !== 'dungeon') return; const R = RUN, S = 380, k = S / 110, lay = W.layout(R.i);
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, S, S);
    mg.fillStyle = 'rgba(10,8,14,0.84)'; rr2(mg, 3, 3, S - 6, S - 6, 18); mg.fill(); mg.strokeStyle = '#6a5636'; mg.lineWidth = 4; mg.stroke();
    mg.save(); rr2(mg, 8, 8, S - 16, S - 16, 13); mg.clip(); mg.translate(S / 2, S / 2); mg.rotate(cam.yaw); mg.scale(k, k); mg.translate(-P.x, -P.z);
    mg.fillStyle = '#25212b'; for (const h of lay.halls) mg.fillRect(h.x - h.w / 2, h.z - h.d / 2, h.w, h.d);
    lay.rooms.forEach((q, i) => { const st = R.rooms[i]; mg.fillStyle = st === 'a' ? `rgba(150,32,36,${0.55 + Math.sin(t * 6) * 0.2})` : st === 'c' ? '#2b3a30' : '#1b1921';
      mg.strokeStyle = q.kind === 'boss' ? '#d8283a' : q.kind === 'loot' ? '#d8b46a' : q.kind === 'mini' ? '#d8682a' : q.kind === 'side' ? '#6a5a8a' : '#4a4252'; mg.lineWidth = 0.7;
      if (q.round) { mg.beginPath(); mg.arc(q.x, q.z, q.round, 0, TAU); mg.fill(); mg.stroke(); } else { mg.fillRect(q.x - q.w / 2, q.z - q.d / 2, q.w, q.d); mg.strokeRect(q.x - q.w / 2, q.z - q.d / 2, q.w, q.d); } });
    mg.fillStyle = '#3a3440'; for (const o of lay.obst) { mg.beginPath(); mg.arc(o.x, o.z, o.r, 0, TAU); mg.fill(); }
    (WD.gates[R.i] || []).forEach(g => { if (!WD.gateOpen(R.i, g.k)) { mg.fillStyle = '#d8283a'; if (g.ax === 'x') mg.fillRect(g.x - 0.6, g.z - g.w / 2, 1.2, g.w); else mg.fillRect(g.x - g.w / 2, g.z - 0.6, g.w, 1.2); } });
    mg.fillStyle = '#ff4a4a'; for (const m of MB.alive()) { mg.beginPath(); mg.arc(m.x, m.z, m.boss ? 2.4 : m.kind === 'mini' ? 1.6 : 1, 0, TAU); mg.fill(); }
    for (const d of LT.list.values()) if (LT.mine(d, App.myId) && !d.pick) { mg.fillStyle = C.GEAR_RARITY[d.it ? d.it.r : 0].c; mg.fillRect(d.x - 0.8, d.z - 0.8, 1.6, 1.6); }
    App.others.forEach(o => { if (!o.vis) return; mg.fillStyle = '#7aff8a'; mg.beginPath(); mg.arc(o.x, o.z, 1.2, 0, TAU); mg.fill(); });
    const ob = objective(); if (ob) { const pz = 1 + Math.sin(t * 5) * 0.25; mg.fillStyle = '#ffd84a'; mg.beginPath(); mg.moveTo(ob.x, ob.z - 2.2 * pz); mg.lineTo(ob.x + 1.7 * pz, ob.z); mg.lineTo(ob.x, ob.z + 2.2 * pz); mg.lineTo(ob.x - 1.7 * pz, ob.z); mg.closePath(); mg.fill(); }
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); mg.fillStyle = '#ffffff'; mg.strokeStyle = '#000'; mg.lineWidth = 0.45; mg.beginPath(); mg.moveTo(P.x + fx * 2.8, P.z + fz * 2.8);
    mg.lineTo(P.x - fx * 1.5 + fz * 1.6, P.z - fz * 1.5 - fx * 1.6); mg.lineTo(P.x - fx * 0.6, P.z - fz * 0.6); mg.lineTo(P.x - fx * 1.5 - fz * 1.6, P.z - fz * 1.5 + fx * 1.6); mg.closePath(); mg.fill(); mg.stroke();
    mg.restore();
  }
  // the Wilds map: roads, camps (red = awake, green = cleared), the Far Gates, the gate home and the wayshrines you have found
  function drawWildMap(t) { const R = RUN, S = 380, k = S / 130, WL = W.wild, cs = R.campSt || {};
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, S, S); mg.fillStyle = 'rgba(10,12,10,0.84)'; rr2(mg, 3, 3, S - 6, S - 6, 18); mg.fill(); mg.strokeStyle = '#4a6a46'; mg.lineWidth = 4; mg.stroke();
    mg.save(); rr2(mg, 8, 8, S - 16, S - 16, 13); mg.clip(); mg.translate(S / 2, S / 2); mg.rotate(cam.yaw); mg.scale(k, k); mg.translate(-P.x, -P.z);
    mg.fillStyle = '#1a2418'; mg.beginPath(); mg.arc(W.WILD.x, W.WILD.z, W.WILD.r, 0, TAU); mg.fill(); mg.strokeStyle = '#3a3022'; mg.lineWidth = 3; for (const [a, b] of WL.roads) { mg.beginPath(); mg.moveTo(a.x, a.z); mg.lineTo(b.x, b.z); mg.stroke(); }
    mg.fillStyle = '#2a3a26'; for (const o of WL.obst) { mg.beginPath(); mg.arc(o.x, o.z, o.r, 0, TAU); mg.fill(); }
    for (const c of WL.camps) { const st = cs[c.k]; mg.fillStyle = st === 'active' ? `rgba(220,50,40,${0.6 + Math.sin(t * 6) * 0.25})` : st === 'clear' ? '#3a7a46' : ['#5a7a3a', '#8a6a2a', '#8a2a2a'][c.tier]; mg.beginPath(); mg.arc(c.x, c.z, c.r, 0, TAU); mg.fill(); }
    for (const g of WL.gates) { mg.fillStyle = C.DUNGEONS[g.k].col; mg.fillRect(g.x - 2, g.z - 3, 4, 6); } mg.fillStyle = '#ffd84a'; mg.fillRect(WL.exit.x - 2, WL.exit.z - 3, 4, 6);
    for (const w of WL.ways) if ((App.s.ways || []).includes(w.i)) { mg.fillStyle = '#9ad8ff'; mg.beginPath(); mg.arc(w.x, w.z, 2, 0, TAU); mg.fill(); }
    mg.fillStyle = '#ff4a4a'; for (const m of MB.alive()) { mg.beginPath(); mg.arc(m.x, m.z, 1.4, 0, TAU); mg.fill(); }
    App.others.forEach(o => { if (!o.vis) return; mg.fillStyle = '#7aff8a'; mg.beginPath(); mg.arc(o.x, o.z, 1.6, 0, TAU); mg.fill(); });
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); mg.fillStyle = '#ffffff'; mg.strokeStyle = '#000'; mg.lineWidth = 0.6; mg.beginPath(); mg.moveTo(P.x + fx * 3.6, P.z + fz * 3.6);
    mg.lineTo(P.x - fx * 2 + fz * 2.1, P.z - fz * 2 - fx * 2.1); mg.lineTo(P.x - fx * 0.8, P.z - fz * 0.8); mg.lineTo(P.x - fx * 2 - fz * 2.1, P.z - fz * 2 + fx * 2.1); mg.closePath(); mg.fill(); mg.stroke(); mg.restore(); }
  // on the screen: a gold marker over the next doorway (or an arrow at the edge when it is behind you), only when nothing is attacking you
  function drawGuide(t) {
    const ob = objective(); if (!ob || MB.alive().length || UI.cur) return; const dist = Math.hypot(ob.x - P.x, ob.z - P.z); if (dist < 3.5) return;
    const W0 = innerWidth, H0 = innerHeight, p = E.project(ob.x, 2.2, ob.z), on = p && p[0] > 50 && p[0] < W0 - 50 && p[1] > 70 && p[1] < H0 - 110, pulse = 1 + Math.sin(t * 5) * 0.12;
    og.save(); og.lineJoin = 'round';
    if (on) { const x = p[0], y = p[1]; og.translate(x, y); og.fillStyle = '#ffd84a'; og.strokeStyle = '#000'; og.lineWidth = 3; og.beginPath(); og.moveTo(0, 10 * pulse); og.lineTo(-10 * pulse, -6); og.lineTo(-4, -6); og.lineTo(-4, -16); og.lineTo(4, -16); og.lineTo(4, -6); og.lineTo(10 * pulse, -6); og.closePath(); og.stroke(); og.fill();
      og.font = '800 13px Outfit,sans-serif'; og.textAlign = 'center'; og.lineWidth = 4; og.strokeText(ob.n + ' · ' + Math.round(dist) + 'm', 0, -24); og.fillStyle = '#f2dca0'; og.fillText(ob.n + ' · ' + Math.round(dist) + 'm', 0, -24); }
    else { const dx = ob.x - P.x, dz = ob.z - P.z, rx = dx * Math.cos(cam.yaw) - dz * Math.sin(cam.yaw), ry = dx * Math.sin(cam.yaw) + dz * Math.cos(cam.yaw), a = Math.atan2(ry, rx);
      const x = W0 / 2 + Math.cos(a) * Math.min(W0, H0) * 0.36, y = H0 / 2 + Math.sin(a) * Math.min(W0, H0) * 0.3; og.translate(x, y); og.rotate(a); og.fillStyle = '#ffd84a'; og.strokeStyle = '#000'; og.lineWidth = 3;
      og.beginPath(); og.moveTo(18 * pulse, 0); og.lineTo(-8, -13); og.lineTo(-3, 0); og.lineTo(-8, 13); og.closePath(); og.stroke(); og.fill(); }
    og.restore();
  }

  // ---------- render ----------
  let fpsAcc = 0, fpsN = 0, fpsShow = 60, qT = 0, qBad = 0, camK = 1, qGood = 0, qUp = false, qLock = false;
  const rollPose = k => ({ rp: k * TAU, y: -0.55 * Math.sin(k * Math.PI), rl_f: 1.7, ll_f: 1.7, rl_k: 2.2, ll_k: 2.2, r_f: 1.3, l_f: 1.3, r_e: 1.7, l_e: 1.7, r_o: 0.3, l_o: 0.3, hx: 0.5, nf: 1, face: 'determined' });
  const RINGM = MB.ms.ring, DISCM = MB.ms.disc, ORBM = MB.ms.orbM;
  const BOXM = E.mesh(E.G.box(1, 1, 1, 0)), CRYM = E.mesh(E.G.lathe([[0, -1], [0.5, -0.1], [0.42, 0.3], [0, 1]], 6)), SPIKEM = E.mesh(E.G.lathe([[0.22, 0], [0.12, 0.5], [0, 1.1]], 5));
  const fxo = (alpha, emis) => ({ emis: emis || 2.5, alpha, add: true, noShadow: true, depthWrite: false });
  // a glowing bar from (x0,z0) to (x1,z1) at height y (beams, lightning, chains)
  function bar(x0, z0, x1, z1, y, w, col, alpha, emis) { const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz); if (d < 0.01) return; E.draw(BOXM, T((x0 + x1) / 2, y, (z0 + z1) / 2, Math.atan2(dx, dz), 0, 0, w, w, d), col, fxo(alpha, emis)); }
  function drawFx(t) {
    for (const f of fxList) { const k = f.t / f.life;
      if (f.k === 'ping') { const a = 1 - k; E.draw(ORBM, T(f.x, 7, f.z, 0, 0, 0, 0.18, 14, 0.18), '#ffd84a', { emis: 2.5, alpha: 0.6 * a, add: true, noShadow: true, depthWrite: false }); E.draw(RINGM, T(f.x, 0.15, f.z, t * 2, 0, 0, 1.4 + Math.sin(t * 8) * 0.2, 1, 1.4 + Math.sin(t * 8) * 0.2), '#ffd84a', { emis: 2, alpha: a, add: true, noShadow: true, depthWrite: false }); continue; }
      if (f.k === 'ring') { const big = Math.min(1, 4 / Math.max(4, f.r)); E.draw(RINGM, T(f.x, 0.3, f.z, 0, 0, 0, f.r * (0.3 + k * 0.7), 3 * big, f.r * (0.3 + k * 0.7)), f.col, { emis: 1.4 + big, alpha: (1 - k) * (0.5 + big * 0.5), add: true, noShadow: true, depthWrite: false }); }
      else if (f.k === 'arc') { for (let j = 0; j < 9; j++) { const a = f.yaw - f.arc / 2 + f.arc * j / 8, rr = f.r * (0.5 + k * 0.5); E.draw(ORBM, T(f.x + Math.sin(a) * rr, 0.9, f.z + Math.cos(a) * rr, 0, 0, 0, 0.35 * (1 - k), 0.12, 0.35 * (1 - k)), f.col, { emis: 2.5, add: true, alpha: 1 - k, noShadow: true, depthWrite: false }); } }
      else if (f.k === 'spin') { const q = f.follow; for (let j = 0; j < 3; j++) { const a = t * 14 + j * TAU / 3; E.draw(ORBM, T(q.x + Math.sin(a) * f.r * 0.8, 1, q.z + Math.cos(a) * f.r * 0.8, 0, 0, 0, 0.3, 0.12, 0.3), f.col, { emis: 2.5, add: true, alpha: 0.9, noShadow: true, depthWrite: false }); }
        E.draw(RINGM, T(q.x, 0.5, q.z, t * 6, 0, 0, f.r, 1.2, f.r), f.col, { emis: 1.2, alpha: 0.3, add: true, noShadow: true, depthWrite: false }); }
      else if (f.k === 'aura') { const q = f.follow; E.draw(RINGM, T(q.x, 0.1 + (t * 1.5 % 1) * 2.2, q.z, 0, 0, 0, 1.1, 1, 1.1), f.col, { emis: 2, alpha: 0.6 * (1 - (t * 1.5 % 1)), add: true, noShadow: true, depthWrite: false }); }
      else if (f.k === 'bubble') { const q = f.follow; E.draw(ORBM, T(q.x, (q.y || 0) + 1.3, q.z, t, 0, 0, 1.5, 1.7, 1.5), f.col, { emis: 0.8, alpha: 0.18 + Math.sin(t * 6) * 0.04, add: true, noShadow: true, depthWrite: false }); }
      else if (f.k === 'slash') { for (let j = 0; j < 2; j++) E.draw(DISCM, T(f.x, 1.2, f.z, 0, Math.PI / 2, (j ? 0.8 : -0.8), 0.2 + k * 2.4, 1, 0.08), f.col, { mode: 3, add: true, alpha: 1 - k, noShadow: true, depthWrite: false, cull: false }); }
      else if (f.k === 'heal') { E.draw(DISCM, T(f.x, 0.08, f.z, 0, 0, 0, f.r, 1, f.r), f.col, { mode: 3, add: true, alpha: 0.18 * (1 - Math.max(0, k - 0.8) * 5), noShadow: true, depthWrite: false }); E.draw(RINGM, T(f.x, 0.12, f.z, t, 0, 0, f.r, 1, f.r), f.col, { emis: 2, noShadow: true });
        if (V_parts() && Math.random() < 0.6) { const a = Math.random() * TAU, r = Math.random() * f.r; E.particle({ x: f.x + Math.cos(a) * r, y: 0.2, z: f.z + Math.sin(a) * r, vx: 0, vy: 1.6, vz: 0, life: 0.9, size: 0.14, col: f.col, add: true }); } }
      else if (f.k === 'beam') { const L0 = f.len * Math.min(1, k * 4), sx = Math.sin(f.yaw), sz = Math.cos(f.yaw), fade = 1 - k;
        bar(f.x + sx * 0.6, f.z + sz * 0.6, f.x + sx * L0, f.z + sz * L0, 0.9, f.w * 0.5 * fade + 0.1, f.col, 0.55 * fade);
        bar(f.x + sx * 0.6, f.z + sz * 0.6, f.x + sx * L0, f.z + sz * L0, 0.9, 0.18, '#ffffff', 0.9 * fade, 3);
        E.draw(DISCM, T(f.x + sx * L0 / 2, 0.06, f.z + sz * L0 / 2, f.yaw, 0, 0, f.w * 0.5, 1, L0 / 2), f.col, Object.assign(fxo(0.25 * fade), { mode: 3 })); }
      else if (f.k === 'bolt') { const fade = 1 - k; for (let j = 0; j + 1 < f.pts.length; j++) { const a0 = f.pts[j], a1 = f.pts[j + 1]; let px = a0[0], pz = a0[1];
          for (let q = 1; q <= 4; q++) { const tq = q / 4, jx = q < 4 ? (Math.random() - 0.5) * 1.2 : 0, jz = q < 4 ? (Math.random() - 0.5) * 1.2 : 0, nx = a0[0] + (a1[0] - a0[0]) * tq + jx, nz = a0[1] + (a1[1] - a0[1]) * tq + jz;
            bar(px, pz, nx, nz, 1.3, 0.16, f.col, fade); bar(px, pz, nx, nz, 1.3, 0.06, '#ffffff', fade, 3); px = nx; pz = nz; } } }
      else if (f.k === 'zone') { const fade = Math.min(1, (f.life - f.t) * 2), grow = Math.min(1, f.t * 6), r = f.r * grow;
        E.draw(DISCM, T(f.x, 0.07, f.z, 0, 0, 0, r, 1, r), f.col, Object.assign(fxo((f.warn ? 0.12 : 0.22) * fade), { mode: 3 }));
        E.draw(RINGM, T(f.x, 0.12, f.z, t * (f.frost ? 0.5 : 2), 0, 0, r, 2, r), f.col, fxo(0.8 * fade, 2));
        if (f.thorns) for (let j = 0; j < 9; j++) { const a = j * 2.39, rr = r * (0.25 + (j % 3) * 0.3), hgt = Math.min(1, f.t * 5) * (0.9 + (j % 2) * 0.5) * fade; E.draw(SPIKEM, T(f.x + Math.cos(a) * rr, 0, f.z + Math.sin(a) * rr, a, 0.2, 0, 1, hgt, 1), f.col, fxo(0.9, 1.6)); }
        if (f.frost) E.draw(RINGM, T(f.x, 0.5 + Math.sin(t * 3) * 0.2, f.z, -t, 0, 0, r * 0.7, 2, r * 0.7), '#ffffff', fxo(0.4 * fade, 2)); }
      else if (f.k === 'vortex' && !f.done) { const kk = f.t / f.delay; E.draw(DISCM, T(f.x, 0.07, f.z, 0, 0, 0, f.r, 1, f.r), f.col, Object.assign(fxo(0.15 + kk * 0.2), { mode: 3 }));
        for (let j = 0; j < 3; j++) { const rr = f.r * (1 - ((kk * 2 + j / 3) % 1)); E.draw(RINGM, T(f.x, 0.3 + j * 0.3, f.z, t * (4 + j), 0, 0, rr, 2, rr), f.col, fxo(0.8, 2.5)); }
        E.draw(ORBM, T(f.x, 1.2, f.z, t, 0, 0, 0.5 + kk * 0.6, 0.5 + kk * 0.6, 0.5 + kk * 0.6), '#0a0014', { emis: 0, noShadow: true }); E.draw(RINGM, T(f.x, 1.2, f.z, t * 6, 1.2, 0, 0.8 + kk * 0.6, 3, 0.8 + kk * 0.6), f.col, fxo(1, 3)); }
      else if (f.k === 'turret') { const fade = Math.min(1, (f.life - f.t) * 3), m = MB.nearest(f.x, f.z, 13), yaw = m ? Math.atan2(m.x - f.x, m.z - f.z) : t;
        if (f.clone) { const o = f.by === App.myId ? null : App.others.get(f.by), lk = o && o.st ? o.st.look : myLook(), jx = Math.random() < 0.12 ? (Math.random() - 0.5) * 0.5 : 0;
          CH.draw(lk, null, f.x + jx, 0, f.z, yaw, { weapon: true }); if (V_parts() && Math.random() < 0.5) E.particle({ x: f.x + (Math.random() - 0.5), y: Math.random() * 2.4, z: f.z + (Math.random() - 0.5), vx: 0, vy: 0.6, vz: 0, life: 0.4, size: 0.16, col: f.col, add: true }); }
        else { E.draw(CRYM, T(f.x, 1.5 + Math.sin(t * 3) * 0.15, f.z, t * 2, 0, 0, 0.7 * fade, 0.9 * fade, 0.7 * fade), f.col, { emis: 1.6, noShadow: true }); E.draw(RINGM, T(f.x, 1.5, f.z, -t * 3, 0.6, 0, 0.9, 2, 0.9), f.col, fxo(0.8 * fade, 2.5)); }
        E.draw(RINGM, T(f.x, 0.1, f.z, t, 0, 0, 1.3, 2, 1.3), f.col, fxo(0.7 * fade, 2)); }
      else if (f.k === 'mark') { const m = MB.list.get(f.u); if (m && !m.dead && m.hp > 0) { const y = (m.y || 0) + m.sc * 2.1 + 0.8; E.draw(RINGM, T(m.x, y, m.z, t * 3, 0, 0, 0.55, 3, 0.55), f.col, fxo(0.9, 3)); E.draw(CRYM, T(m.x, y, m.z, t * 2, Math.PI, 0, 0.18, 0.3, 0.18), f.col, fxo(0.9, 3)); } }
      else if (f.k === 'chains') { const q = f.follow, fade = 1 - k; for (const m of MB.alive()) { if (Math.hypot(m.x - q.x, m.z - q.z) > f.r + 2) continue; bar(q.x, q.z, m.x, m.z, 1, 0.12, f.col, fade, 1.5); } }
      else if (f.k === 'meteor' && !f.done) { const kk = f.t / f.delay; E.draw(DISCM, T(f.x, 0.08, f.z, 0, 0, 0, f.r, 1, f.r), '#ff2a1a', { mode: 3, add: true, alpha: 0.15 + kk * 0.3, noShadow: true, depthWrite: false });
        E.draw(ORBM, T(f.x + (1 - kk) * 6, 0.6 + (1 - kk) * 22, f.z - (1 - kk) * 4, t * 4, 0, 0, 1.1, 1.1, 1.1), '#3a1a0a', { emis: 0.6 }); if (V_parts()) E.particle({ x: f.x + (1 - kk) * 6, y: 0.6 + (1 - kk) * 22, z: f.z - (1 - kk) * 4, vx: 0, vy: 0, vz: 0, life: 0.5, size: 0.9, col: '#ff7a1a', add: true }); }
    }
  }
  function render(t, dt) {
    const s = App.s || L.fresh('x'), z = App.inGame ? App.zone : { t: 'hub', k: -1 };
    let tx = cam.x, ty = cam.y + 1.8, tz = cam.z, dist = cam.dist, cyaw = cam.yaw, cp = cam.pitch;
    if (!App.inGame) { tx = 0; ty = 4; tz = 0; dist = 42; cp = 0.22; }
    if (shiftLock) { tx += Math.cos(cyaw) * 1.4; tz -= Math.sin(cyaw) * 1.4; ty += 0.3; }
    if (UI.cur === 'avatar') { cyaw = P.yaw + Math.sin(t * 0.5) * 0.45; dist = 5.6; cp = 0.1; ty = P.y + 1.5; const off = Math.min(1.4, innerWidth / 900); tx = P.x - Math.cos(cyaw) * off * -1; tz = P.z + Math.sin(cyaw) * off * -1; }
    if (camCin && App.inGame) { const c = camCin; c.t += dt; const k = Math.min(1, c.t / c.dur), bell = Math.sin(k * Math.PI), sw = bell * bell * (3 - 2 * bell);
      cyaw = c.yaw + Math.sin(k * Math.PI) * 0.95; dist = dist + (6 - dist) * sw; cp = cp + (0.06 - cp) * sw; ty += 0.5 * sw; if (k >= 1) { camCin = null; document.body.classList.remove('cine'); } else document.body.classList.add('cine'); }
    let eye = [tx + Math.sin(cyaw) * Math.cos(cp) * dist, Math.max(ty + Math.sin(cp) * dist, -8), tz + Math.cos(cyaw) * Math.cos(cp) * dist];
    // camera collision: pull in when a wall, tree or building is between you and the camera
    if (App.inGame && UI.cur !== 'avatar' && UI.cur !== 'gear') { const dx = eye[0] - tx, dy = eye[1] - ty, dz = eye[2] - tz, n = Math.ceil(dist / 0.45); let k = 1;
      for (let i = 2; i <= n; i++) { const f = i / n; if (WD.blocked(tx + dx * f, ty + dy * f, tz + dz * f)) { k = Math.max(3.5 / dist, (i - 1.6) / n); break; } }
      camK = k < camK ? k : camK + (k - camK) * Math.min(1, dt * 2.5); eye = [tx + dx * camK, Math.max(ty + dy * camK, 0.4), tz + dz * camK]; }
    if (App._camOv) { eye = App._camOv.eye.slice(); [tx, ty, tz] = App._camOv.tgt; }   // a fixed camera for screenshots and tests (bird's-eye views)
    const eye0 = eye.slice(), tgt0 = [tx, ty, tz]; App._eye = eye0; App._camK = camK;
    if (shakeAmt > 0.001 && SET.shake !== false) { // smooth shake (layered sines, not random jitter); "Low" keeps a third of it
      const kk = shakeAmt * shakeAmt * 0.55 * (SET.shake === 'low' ? 0.35 : 1), q = t * 41, n1 = Math.sin(q) * 0.6 + Math.sin(q * 2.3 + 1.7) * 0.4, n2 = Math.sin(q * 1.7 + 0.5) * 0.6 + Math.sin(q * 3.1) * 0.4, n3 = Math.sin(q * 1.3 + 2.1) * 0.6 + Math.sin(q * 2.7 + 0.3) * 0.4;
      eye[0] += n1 * kk * 0.5; eye[1] += n2 * kk * 0.5; eye[2] += n3 * kk * 0.5; tx += n2 * kk * 0.3; ty += n1 * kk * 0.3; }
    shakeAmt = Math.max(0, shakeAmt - dt * 1.8);
    const lt = WD.light(z, t, dt);
    // a zone can see further than the quality's base distance (the big town); Low gets a little of it; a test camera may set its own
    E.far = (E.farBase || E.far) * (lt.farK > 1 ? (E.quality === 'low' ? 1 : lt.farK) : 1); if (App._camOv && App._camOv.far) E.far = App._camOv.far;
    const env = Object.assign({ eye, target: [tx, ty, tz], fov: 1.02, dt, time: t, focus: [P.x, P.y, P.z] }, lt);
    // (Update 7 final: nothing is cut away or faded any more; the camera moves in front of whatever would hide you, see above)
    const labels = [], V = { zone: z, t, dt, eye, target: [tx, ty, tz], s, parts: E.quality !== 'low' && SET.weather !== false, near: App.near, now: App.now(), labels, P, run: RUN, sun: lt.sun };
    WD.draw(V);
    MB.draw(V);
    if (RUN) { LT.draw(V, labels, App.myId); if (RUN.feat) { RUN.feat.runT = runTime(); LT.drawFeat(V, RUN.feat, RUN.feat.runT, WD.thOf(RUN.i).n, App.myId); } }
    drawFx(t);
    for (const q of projectiles) if (q.t >= 0) E.draw(ORBM, T(q.x, q.y, q.z, 0, 0, 0, 0.25 * (q.big || 1), 0.25 * (q.big || 1), 0.25 * (q.big || 1)), q.col, { emis: 3, noShadow: true });
    // lights this frame: the zone's torches etc., your loot, fireballs in flight, spell impacts, and a soft glow from your weapon so you never vanish in the dark
    E.lights.length = 0; WD.lights(V, E.lights); if (RUN) { LT.lights(E.lights, App.myId); LT.featLights(E.lights, RUN.feat); }
    for (const q of projectiles) if (q.t >= 0) E.lights.push({ x: q.x, y: q.y, z: q.z, r: 5 * (q.big || 1), i: 1.3, col: q.col });
    for (const f of fxList) if (f.k === 'ring') { const k = 1 - f.t / f.life; if (k > 0) E.lights.push({ x: f.x, y: 1, z: f.z, r: f.r * 1.5 + 2, i: 1.7 * k, col: f.col }); }
    if (App.inGame) E.lights.push({ x: P.x, y: P.y + 2.6, z: P.z, r: 7, i: 0.6, col: glowCol() });
    if (App.inGame && V.parts && P.gr && !P.dead) { const mv = Math.hypot(P.x - (footP.x || P.x), P.z - (footP.z || P.z)); footP.d += mv; footP.x = P.x; footP.z = P.z;
      if (footP.d > (P.dodgeT > 0 ? 0.5 : 1.15)) { footP.d = 0; footP.s = -footP.s; const th = z.t === 'dun' ? WD.thOf(z.k).n : '', col = FOOT_COL[th] || '#6a6474', sx = Math.cos(P.yaw) * 0.22 * footP.s, sz = -Math.sin(P.yaw) * 0.22 * footP.s;
        for (let j = 0; j < (P.dodgeT > 0 ? 3 : 2); j++) E.particle({ x: P.x + sx + (Math.random() - 0.5) * 0.3, y: P.y + 0.12, z: P.z + sz + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.8, vy: 0.4 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.8, life: 0.7, size: 0.55, grow: 1.4, col, soft: true, a: 0.35, drag: 2 });
        if (th === 'ember' && Math.random() < 0.5) E.particle({ x: P.x, y: P.y + 0.1, z: P.z, vx: (Math.random() - 0.5) * 1.5, vy: 1.5, vz: (Math.random() - 0.5) * 1.5, life: 0.6, size: 0.06, col: '#ff8a2a', add: true, g: 2 }); } }
    if (App.inGame) {
      let pose = null; if (P.dodgeT > 0) pose = Object.assign({}, me.pose, rollPose(1 - P.dodgeT / C.DODGE_TIME));
      if (P.dead) pose = Object.assign({}, CH.pose('idle', 0), { rp: -1.5, y: -0.9, face: 'hurt', r_o: 1.2, l_o: 1.2 });
      if (z.t !== 'hub' && !me.armed) { me.armed = true; me.armedT = 1; }
      if (pose) CH.draw(myLook(), pose, P.x, P.y, P.z, P.yaw, { face: pose.face, springs: me.springs, trail: me.trailPts, weapon: z.t !== 'hub' }); else CH.drawState(me, P.x, P.y, P.z, P.yaw, { trailCol: s.look.trail });
      if (SET.names !== false && UI.cur !== 'avatar' && UI.cur !== 'gear' && !RUN) { labels.push({ t: App.myName + '  · Lv ' + s.level, x: P.x, y: P.y + 3.25, z: P.z, sz: 12, c: '#e8e2ee', name: 1 });
        if (s.title && s.title !== 'rookie') labels.push({ t: L.titleName(s.title).toUpperCase(), x: P.x, y: P.y + 2.95, z: P.z, sz: 9, c: '#d8b46a' }); }
      if (bubble && Tm - bubble.t < 6) labels.push({ t: bubble.m.length > 40 ? bubble.m.slice(0, 40) + '…' : bubble.m, x: P.x, y: P.y + 3.8, z: P.z, sz: 12, bub: 1 });
      if (E.quality === 'low') E.draw(WD.ms.disc, T(P.x, Math.max(0, WD.floorAt(P.x, P.z, P.y)) + 0.04, P.z, 0, 0, 0, 0.75, 1, 0.75), '#000000', { alpha: 0.3, mode: 3, noShadow: true });
      if (App.near && !busy()) { const q = W.STN[App.near]; if (q) labels.push({ t: (touch ? 'USE' : App.keyName(BIND.use) + ' / E') + '  ·  ' + q.l, x: P.x, y: P.y + 3.7, z: P.z, sz: 14, c: '#f2dca0', prompt: 1 }); }
    }
    App.others.forEach(o => {
      if (!o.vis) return; const d2 = (o.x - eye[0]) ** 2 + (o.z - eye[2]) ** 2; if (d2 > (E.far + 10) ** 2 || !o.st) return;
      if (o.roll !== undefined) CH.draw(o.st.look, Object.assign({}, o.st.pose, rollPose(o.roll / C.DODGE_TIME)), o.x, o.y, o.z, o.yaw, { springs: o.st.springs });
      else CH.drawState(o.st, o.x, o.y, o.z, o.yaw, { lod: d2 > 900, trailCol: o.lk ? o.lk.trail : undefined });
      const rp = RUN && RUN.players.get(o.id);
      if (SET.names !== false) { labels.push({ t: o.n + (o.g ? ' (guest)' : '') + '  · Lv ' + (o.lv || 1), x: o.x, y: o.y + 3.25, z: o.z, sz: 11, c: rp ? '#9ad8a0' : '#c8c0d4', name: 1 });
        if (rp) labels.push({ bar: rp.hp / rp.max, x: o.x, y: o.y + 2.75, z: o.z, w: 0.9, good: 1 });
        else if (o.ti && o.ti !== 'rookie') labels.push({ t: L.titleName(o.ti).toUpperCase(), x: o.x, y: o.y + 2.95, z: o.z, sz: 9, c: '#d8b46a' }); }
      if (o.bub && Tm - o.bt < 6) labels.push({ t: o.bub.length > 40 ? o.bub.slice(0, 40) + '…' : o.bub, x: o.x, y: o.y + 3.8, z: o.z, sz: 11, bub: 1 });
    });
    E.frame(env);
    // ---------- overlay: names, prompts, health bars, damage numbers ----------
    og.clearRect(0, 0, innerWidth, innerHeight);
    og.textAlign = 'center'; og.lineJoin = 'round';
    for (const l of labels) {
      const p = E.project(l.x, l.y, l.z); if (!p || p[2] > E.far + 20) continue;
      if (l.bar !== undefined) { const w = clamp(900 / p[2], 36, 120) * (l.w || 1), h = clamp(90 / p[2], 4, 8); og.fillStyle = '#000c'; og.fillRect(p[0] - w / 2 - 1.5, p[1] - 1.5, w + 3, h + 3); og.fillStyle = l.good ? '#0a2a10' : '#3a0a10'; og.fillRect(p[0] - w / 2, p[1], w, h);
        og.fillStyle = l.good ? '#4ac85a' : l.bar > 0.5 ? '#c8283a' : l.bar > 0.25 ? '#d8582a' : '#e8282a'; og.fillRect(p[0] - w / 2, p[1], w * clamp(l.bar, 0, 1), h);
        if (l.name) { og.font = `800 ${clamp(150 / p[2], 10, 13)}px Outfit,sans-serif`; og.lineWidth = 3; og.strokeStyle = '#000'; og.strokeText(l.name, p[0], p[1] - 4); og.fillStyle = '#ff8a7a'; og.fillText(l.name, p[0], p[1] - 4); } continue; }
      const sz = clamp(l.sz * 13 / p[2], 9, l.prompt ? 18 : 26); og.font = `${l.prompt ? 900 : 800} ${sz}px Outfit,"Trebuchet MS",sans-serif`;
      if (l.bub) { const w = og.measureText(l.t).width; og.fillStyle = '#e8e2eeee'; rrect(p[0] - w / 2 - 8, p[1] - sz, w + 16, sz * 1.4, 5); og.fill(); og.fillStyle = '#16141a'; og.fillText(l.t, p[0], p[1]); continue; }
      if (l.prompt) { const w = og.measureText(l.t).width; og.fillStyle = '#0c0a10dd'; rrect(p[0] - w / 2 - 10, p[1] - sz - 2, w + 20, sz * 1.5, 4); og.fill(); og.strokeStyle = '#8a6a3a'; og.lineWidth = 1; og.stroke(); }
      og.lineWidth = Math.max(3, sz / 4); og.strokeStyle = '#000d'; og.strokeText(l.t, p[0], p[1]); og.fillStyle = l.c || '#fff'; og.fillText(l.t, p[0], p[1]);
    }
    if (SET.nums !== false) for (const n of MB.nums) { const p = E.project(n.x + n.vx * n.t, n.y + n.t * 1.6, n.z); if (!p) continue; const pop = n.t < 0.12 ? 1 + (0.12 - n.t) * 5 : 1, sz = clamp(26 * n.big * pop * 10 / p[2], 11, 26 * n.big * pop);
      og.globalAlpha = n.t > 0.6 ? 1 - (n.t - 0.6) / 0.4 : 1; og.font = `900 ${sz}px Outfit,sans-serif`; og.lineWidth = sz / 5; og.strokeStyle = '#000'; og.strokeText(n.txt, p[0], p[1]); og.fillStyle = n.col; og.fillText(n.txt, p[0], p[1]); }
    og.globalAlpha = 1;
    // fps + auto quality (drops to Low on slow school laptops)
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 1) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; if (SET.fps) $('#fps').textContent = fpsShow + ' fps · ' + E.quality + ' · ' + E.stats.draws + ' draws · ' + E.stats.tris + ' tris';
      // Auto graphics: step down when under 50 fps, and try one step up after 8 smooth seconds (never again once a step up failed)
      if (autoQ && App.inGame && document.visibilityState === 'visible') { qT++; if (fpsShow < 50) qBad++; if (fpsShow >= 58) qGood++; else qGood = 0;
        if (qT >= 3) { if (qBad >= 2) { if (qUp) qLock = true; qGood = 0; if (E.quality === 'high') E.setQuality('med'); else if (E.quality === 'med') E.setQuality('low'); else if (extraScale > 0.6) { extraScale -= 0.15; E.setQuality('low', extraScale); } } qT = 0; qBad = 0; }
        if (!qLock && qGood >= 8) { qGood = 0; qUp = true; if (extraScale < 1) { extraScale = Math.min(1, extraScale + 0.15); E.setQuality('low', extraScale); } else if (E.quality === 'low') E.setQuality('med'); else if (E.quality === 'med') E.setQuality('high'); } } }
    if (App.inGame) UI.skills({ dodge: P.dodgeCD, combo: comboShow, comboN: me.comboN || (CH.MOVES[myKind()] || []).length || 3, use: !!App.near, parry: P.parryCd || 0, st: myStyle() });
    if (RUN && (RUN.mode === 'dungeon' || RUN.mode === 'wild') && App.inGame) { if (RUN.mode === 'dungeon') drawGuide(t); if (++mmN % (E.quality === 'low' ? 3 : 2) === 0) drawMinimap(t); }   // the minimap is a big 2D canvas: 20-30 updates a second is plenty
  }
  let mmN = 0;
  function rrect(x, y, w, h, r) { og.beginPath(); og.moveTo(x + r, y); og.arcTo(x + w, y, x + w, y + h, r); og.arcTo(x + w, y + h, x, y + h, r); og.arcTo(x, y + h, x, y, r); og.arcTo(x, y, x + w, y, r); og.closePath(); }

  // ---------- main loop ----------
  let last = 0, hudT = 0, errShown = false;
  function frame(ms) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (ms - last) / 1000 || 0.016); last = ms; Tm = ms / 1000;
    try {
      const real = dt; if (hitstop > 0) { hitstop -= dt; dt *= 0.25; } else if (slowT > 0) { slowT -= real; dt *= 0.4; }
      if (fadeT > 0) fadeT += real;
      update(dt);
      // on Low, a full menu covers the world: draw the world behind it at a third of the rate (the 3D preview gets the time instead)
      if (!(UI.cur && UI.cur !== 'avatar' && E.quality === 'low' && (++menuSkip % 3))) render(Tm, dt); if (photoShot) { photoShot = false; takePhoto(); }
      hudT += real; if (App.inGame && hudT > 0.2) { hudT = 0; document.body.classList.toggle('inrun', !!RUN); document.body.classList.toggle('intown', !RUN); tutPanel(); AU.setZone && AU.setZone(RUN ? (RUN.mode === 'dungeon' ? C.DUNGEONS[RUN.i].id : RUN.mode) : W.inWild && W.inWild(P.x, P.z) ? 'wild' : 'hub'); AU.setBoss && AU.setBoss(!!(RUN && RUN.boss && !RUN.cleared && !RUN.done)); moveK = App.s ? L.moveSpd(App.s) : 1; const ql = E.quality === 'low'; if (document.body._ql !== ql) { document.body._ql = ql; document.body.classList.toggle('qlow', ql); } document.body.classList.toggle('inrun', !!(RUN && (RUN.mode === 'dungeon' || RUN.mode === 'wild')));
        if (RUN && RUN.mode === 'dungeon') { const lay = W.layout(RUN.i), ri = RUN.rooms.findIndex((c, i) => i > 0 && i <= lay.boss && c !== 'c'); RUN.nextGate = ri > 0 && RUN.rooms[ri] === 'i' && W.hallOpen(lay, RUN.rooms, lay.rooms[ri].hin) ? lay.rooms[ri].hin : -1; } UI.hud(); if (UI.cur === 'trade' || UI.cur === 'shop') throttledRender(); }
      App.frames = (App.frames || 0) + 1;
    } catch (e) { if (!errShown) { errShown = true; console.error(e); } App.lastError = String(e && e.stack || e); }
  }
  App.shake = a => { shakeAmt = Math.max(shakeAmt, a); };
  // test helper: run the local simulation fast (the headless test browser only manages a couple of frames a second)
  function ff(secs, fn) { for (let n = 0; n < secs / 0.05 && RUN && RUN.local && !RUN.done; n++) { if (fn) fn(RUN.inst); SD.move(RUN.inst, App.myId, P.x, P.y, P.z, P.yaw); SD.step(RUN.inst, 0.05); for (const e of SD.takeEvents(RUN.inst)) runEvent(e); if (RUN && RUN.inst) MB.fromSim(RUN.inst); MB.update(0.05, { P, online: false, t: Tm }); } }
  App._debug = { moves: { parry, myStyle, onMoveEvent, setHeld: v => { held = v; }, gT: () => gT, pend: () => pendAtk.length }, P, cam, tp: (x, z) => { tp(x, z); if (RUN && RUN.local && RUN.mode === 'dungeon') { const q = RUN.inst.players.get(App.myId); if (q) { q.x = x; q.z = z; q.area = Math.max(0, W.where(RUN.i, x, z)); } } }, E, WD, MB, CH, LT, me, use, attack, castSpell, dodge, jump, travelTo, startLocalRun, getRun: () => RUN, exitRun, ff };
  try { applyLook(); } catch (e) {}
  requestAnimationFrame(frame);
})();
