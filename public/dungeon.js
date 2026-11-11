/* Slime Slayers - the dungeon simulation. The server runs it for every party (so nobody can cheat their damage or loot);
   offline guests run the very same code in the browser. Pure logic, no drawing: rooms and waves, slime + boss AI, everyone's health,
   attacks and spells. It reports what happened as events that the game turns into pictures and sounds. */
(function (root) {
  'use strict';
  const L = typeof module !== 'undefined' && !root.SL ? require('./logic.js') : root.SL, C = L.C, W = L.W;
  const SD = {}, TAU = Math.PI * 2, clamp = L.clamp;
  const ROOM_PAD = 1.0;
  // ---------------------------------------------------------------- create
  // o: {mode: 'dungeon'|'pit'|'raid', i (dungeon / raid boss), df, hc, seed, players: [{id, name, s}]}
  SD.create = function (o) {
    const mode = o.mode || 'dungeon', i = o.i || 0, lay = mode === 'pit' || mode === 'tower' || mode === 'duel' ? W.pit : mode === 'raid' ? W.raid : mode === 'wild' ? W.wild : W.layout(i), seed = o.seed || 1;
    const inst = { mode, i, df: o.df || 0, hc: !!o.hc, seed, rng: L.mulberry(seed), t: 0, lay, n: Math.max(1, Math.min(C.PARTY_MAX, o.players.length)), mobs: [], uid: 1, players: new Map(), events: [],
      rooms: lay.rooms.map(r => ({ st: r.kind === 'start' ? 'clear' : 'idle', wave: -1, next: 0 })), progress: 0, done: false, result: null, sched: [], zones: [], pitWave: 0, pitCleared: 0, lead: o.players[0] && o.players[0].s,
      drops: [], dropId: 1, summons: [], limit: mode === 'dungeon' ? L.dunTime(o.df || 0) : 0, pen: 0, tele: [], bpools: [], sealed: -1, side: {}, vph: 0, haz: [] };
    if (mode === 'pit' || mode === 'raid' || mode === 'tower') inst.rooms[0].st = 'idle';
    if (mode === 'duel') inst.rooms[0].st = 'active';
    if (mode === 'tower') { inst.towerFloor = 0; inst.towerCleared = 0; inst.mut = null; inst.mutsSeen = []; }
    if (mode === 'wild') { inst.rooms[0].st = 'active'; inst.wild = { camps: lay.camps.map(() => ({ st: 'idle', at: 0, n: 0 })) }; inst.wildCleared = 0; }
    if (mode === 'dungeon') { const f = L.runFeat(i, seed); inst.props = lay.props.map(p => Object.assign({ hp: 1, gone: false }, p)); inst.chest = Object.assign({ hp: C.CHEST.HITS, open: false }, f.chest);
      inst.shrine = Object.assign({ used: {} }, f.shrine); inst.traps = lay.traps; inst.side = f.side; inst.vph = f.vph; inst.haz = lay.haz; }
    else { inst.props = []; inst.chest = null; inst.shrine = null; inst.traps = []; }
    for (const p of o.players) SD.addPlayer(inst, p);
    if (mode === 'duel') { inst.limit = C.DUEL.TIME; inst.duel = { score: {}, winner: 0 }; let k = 0; for (const p of inst.players.values()) duelReset(inst, p, k++); }
    return inst;
  };
  // duels: everyone starts equal (call again after a server swaps in a guest's own stats)
  SD.duelPrep = inst => { if (inst.mode !== 'duel') return; let k = 0; for (const p of inst.players.values()) duelReset(inst, p, k++); };
  SD.addPlayer = function (inst, p) {
    const s = p.s, st = SD.playerStats(s), sp = inst.mode === 'pit' || inst.mode === 'tower' || inst.mode === 'duel' ? { x: W.ARENA.x, z: W.ARENA.z + 8 } : inst.mode === 'raid' ? { x: W.RAIDA.x, z: W.RAIDA.z + 14 } : inst.lay.start;
    inst.players.set(p.id, Object.assign({ id: p.id, name: p.name || 'Slayer', cls: s.cls, x: sp.x + [0, 1.7, -1.7, 3.4][inst.players.size % 4], z: sp.z + (inst.players.size % 2) * 0.8, y: 0, yaw: Math.PI, hp: st.max, dead: false, deadT: 0, out: false,
      iframe: 0, shield: 0, buff: 0, cds: {}, atkT: -9, hurtT: -99, kills: 0, dmgDone: 0, room: 0, area: 0, loot: [], bonus: 0, deaths: 0,
      sty: 0, rank: 0, styleBest: 0, chain: 0, chainT: -9, lastMove: '', comboN: -1, parryT: -9, parryCd: 0, nextCrit: false, stealth: 0, airT: -9, dashUsed: true }, st));
  };
  // everything the simulation needs to know about a player's power (taken from their saved state at the start)
  SD.playerStats = s => ({ max: L.maxHp(s), ap: L.ap(s), gp: L.power(s), crit: L.crit(s), critMult: L.critMult(s), leech: L.leech(s), speed: L.speed(s), type: L.weaponType(s), cdr: L.cdr(s),
    red: L.red(s), regen: L.regen(s), move: L.moveSpd(s), luck: L.luck(s, { now: Date.now(), ev: L.events(Date.now()) }),
    abil: 0, wpow: null, aset: {}, spells: (s.spells[s.cls] || []).filter(id => L.spellOk(s, L.spell(id))) });   // Update 7 (final): no gear powers, set bonuses or ultimates
  SD.removePlayer = (inst, id) => { inst.players.delete(id); if (!inst.players.size) { inst.done = true; inst.result = inst.result || 'left'; } };
  const ev = (inst, e) => { inst.events.push(e); };
  const alive = inst => [...inst.players.values()].filter(p => !p.dead && !p.out);
  // ---------------------------------------------------------------- slimes
  function spawnMob(inst, room, id, kind, x, z, delay) {
    const st = inst.mode === 'pit' || inst.mode === 'wild' || inst.mode === 'tower' ? null : inst.mode === 'raid' ? L.raidStats(inst.i, id, inst.n, kind) : L.mobStats(inst.i, id, inst.df, inst.n, kind, inst.hc), d = C.MOBS[id];
    const m = { uid: inst.uid++, id, kind, room: room.i, x, z, y: 0, yaw: Math.PI, hp: st ? st.hp : 1, max: st ? st.hp : 1, dmg: st ? st.dmg : 1, sc: (d.size || 1) * 1.15 * (kind === 'mini' ? 1.35 : 1) * (C.MOB.SIZE[kind] || 1),
      st: 'spawn', t: -(delay || 0), tx: x, tz: z, stun: 0, frz: 0, warn: 0, target: 0, atk: 0, atkT: 2.5, phase: 1, ring: null, away: 0, lost: 0, busy: 0, kit: C.BOSS_KITS[id] || null, hx: x, hz: z };
    // how it fights, and (elites and mini-bosses) a modifier
    if (kind === 'mob' && d.beh && C.BEH[d.beh]) m.beh = d.beh;
    if ((kind === 'elite' || kind === 'mini') && inst.mode === 'dungeon' && id !== 'mimic') { const EM = C.ELITE_MODS; if (inst.rng() < (kind === 'mini' ? EM.MINI : EM.CHANCE)) { m.mod = EM.LIST[Math.floor(inst.rng() * EM.LIST.length)]; if (m.mod === 'shield') m.shp = Math.round(m.max * EM.shield.hp); } }
    inst.mobs.push(m); ev(inst, { k: 'spawn', m: snapFull(m) });
    return m;
  }
  const snapFull = m => ({ u: m.uid, id: m.id, kind: m.kind, x: +m.x.toFixed(2), z: +m.z.toFixed(2), hp: m.hp, max: m.max, sc: m.sc, dl: Math.max(0, -m.t), mod: m.mod, beh: m.beh, child: m.child ? 1 : undefined });
  SD.snap = inst => inst.mobs.filter(m => m.hp > 0).map(m => [m.uid, +m.x.toFixed(2), +m.z.toFixed(2), +m.y.toFixed(2), +m.yaw.toFixed(2), m.hp, ST[m.st] || 0, +(m.warn || 0).toFixed(2), m.tx !== undefined ? +m.tx.toFixed(1) : 0, m.tz !== undefined ? +m.tz.toFixed(1) : 0]);
  const ST = { spawn: 1, idle: 2, chase: 3, wind: 4, leap: 5, recover: 6, intro: 7, fight: 8, slam: 9, wave: 10, barrage: 11, summon: 12, cast: 13, vanish: 14, home: 15, aim: 16, dash: 17, under: 18, fuse: 19, out: 20, dive: 21 };
  SD.STATES = Object.keys(ST).reduce((o, k) => (o[ST[k]] = k, o), {});
  // spread a wave across the far half of the room
  function spawnWave(inst, room, rs) {
    const q = inst.lay.rooms[room.i], list = room.kind === 'pit' ? null : inst.waveList(room, rs.wave), e = q.entry || { x: q.x, z: q.z + q.d / 2 };
    let ux = q.x - e.x, uz = q.z - e.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul; const vx = uz, vz = -ux, hd = q.round || Math.abs(ux) * q.w / 2 + Math.abs(uz) * q.d / 2, hw = q.round || Math.abs(vx) * q.w / 2 + Math.abs(vz) * q.d / 2;
    const free = (x, z) => W.floorOk(inst.lay, x, z, 1.5) && inst.lay.obst.every(o => Math.hypot(o.x - x, o.z - z) > o.r + 1.6) && inst.haz.every(h => Math.hypot(h.x - x, h.z - z) > h.r + 1);
    const spots = n => { const out = []; for (let k = 0; k < n; k++) { let x = q.x, z = q.z; for (let t = 0; t < 12; t++) { const f = (k + 0.5) / n - 0.5, a = f * (hw * 2 - 7) + (inst.rng() - 0.5) * 2.5, b = hd * (0.05 + inst.rng() * 0.5);
        x = q.x + ux * b + vx * a; z = q.z + uz * b + vz * a; if (free(x, z)) break; } out.push([x, z]); } return out; };
    const sp = room.kind === 'boss' ? [[q.x + ux * 3, q.z + uz * 3]] : spots(list.length); list.forEach((w, k) => { const m = spawnMob(inst, room, w.id, w.kind, sp[k][0], sp[k][1], k * 0.12); if (room.kind === 'mini' && w.kind === 'mob') m.arena = 1; });
    ev(inst, { k: 'wave', r: room.i, w: rs.wave });
  }
  function waveListFor(inst) {
    const d = C.DUNGEONS[inst.i];
    return (room, w) => { if (room.kind === 'mini') return [{ id: L.miniOf(inst.i, room), kind: 'mini' }, { id: d.mobs[0], kind: 'mob' }, { id: d.mobs[0], kind: 'mob' }];
      if (room.kind === 'boss') return [{ id: d.boss, kind: 'boss' }];
      const out = []; for (const [m, c] of room.waves[w]) for (let j = 0; j < c; j++) out.push({ id: m === 'e' ? d.elite : d.mobs[m], kind: m === 'e' ? 'elite' : 'mob' }); return out; };
  }
  // ---------------------------------------------------------------- step
  SD.step = function (inst, dt) {
    if (inst.done) return; inst.t += dt; if (!inst.waveList && inst.mode === 'dungeon') inst.waveList = waveListFor(inst);
    const t = inst.t;
    for (const p of inst.players.values()) playerTick(inst, p, dt);
    if (inst.mode === 'duel') duelTick(inst, dt); else if (inst.mode === 'pit') pitTick(inst, dt); else if (inst.mode === 'tower') towerTick(inst, dt); else if (inst.mode === 'raid') raidTick(inst, dt); else if (inst.mode === 'wild') wildTick(inst, dt); else roomsTick(inst, dt);
    for (const m of inst.mobs) { m.ox = m.x; m.oz = m.z; }
    for (const m of inst.mobs) if (m.hp > 0) { if (m.kind === 'boss') bossTick(inst, m, dt); else mobTick(inst, m, dt); casterTick(inst, m, dt); }
    // keep slimes apart
    const ms = inst.mobs; for (let a = 0; a < ms.length; a++) { const A = ms[a]; if (A.hp <= 0 || A.st === 'leap') continue; for (let b = a + 1; b < ms.length; b++) { const B = ms[b]; if (B.hp <= 0 || B.st === 'leap') continue;
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), mm = (A.sc + B.sc) * 0.75; if (d < mm && d > 1e-3) { const k = (mm - d) * 0.5 / d, wa = A.kind === 'boss' ? 0.1 : 1, wb = B.kind === 'boss' ? 0.1 : 1; A.x -= dx * k * wa; A.z -= dz * k * wa; B.x += dx * k * wb; B.z += dz * k * wb; } } }
    for (const m of ms) if (m.hp > 0) keepOnFloor(inst, m);
    for (const p of inst.players.values()) if (!p.dead && !p.out) { const q = pushOut(inst, p.x, p.z, p.y); p.x = q.x; p.z = q.z; }
    // slimes on fire (Ignite weapons, Molten Core)
    for (const m of ms) if (m.bleed && m.hp > 0 && t >= m.bleed.next) { if (t > m.bleed.until) { m.bleed = null; continue; } m.bleed.next = t + 0.5; const ow = inst.players.get(m.bleed.by); if (ow) damageMob(inst, m, m.bleed.dps, ow, { quiet: 1, dot: 1, fxp: 1 }); }
    for (const m of ms) if (m.burn && m.hp > 0 && t >= m.burn.next) { if (t > m.burn.until) { m.burn = null; continue; } m.burn.next = t + 0.5; const ow = inst.players.get(m.burn.by); if (ow) damageMob(inst, m, m.burn.dps * 0.5, ow, { fxp: 1, quiet: 1 }); }
    // telegraphs that have gone off, burning pools the bosses left
    if (inst.tele.length) inst.tele = inst.tele.filter(q => q.end > t);
    for (let k = inst.bpools.length - 1; k >= 0; k--) { const q = inst.bpools[k]; if (t > q.end) { inst.bpools.splice(k, 1); continue; } if (t < q.start || t < q.next) continue; q.next = t + 0.5;
      for (const p of inst.players.values()) if (!p.dead && p.y < 0.7 && Math.hypot(p.x - q.x, p.z - q.z) < q.r) hurtPlayer(inst, p, q.dmg, { x: q.x, z: q.z }); }
    // scheduled hits (fireballs in flight, meteors, whirlwind ticks, missiles, staff bolts)
    for (let k = inst.sched.length - 1; k >= 0; k--) { const q = inst.sched[k]; if (t < q.at) continue; inst.sched.splice(k, 1); q.fn(); }
    // areas that stay: the healing circle, and damaging ones (fire pit, thorns, blizzard)
    for (let k = inst.zones.length - 1; k >= 0; k--) { const z = inst.zones[k]; if (t > z.end) { inst.zones.splice(k, 1); continue; }
      if (t < z.next) continue;
      if (z.heal) { z.next = t + 0.5; for (const p of alive(inst)) if (Math.hypot(p.x - z.x, p.z - z.z) < z.r) heal(inst, p, p.max * z.heal * 0.5); continue; }
      z.next = t + z.every; const ow = inst.players.get(z.owner); if (!ow) continue;
      for (const m of inst.mobs) if (m.hp > 0 && m.st !== 'spawn' && m.st !== 'intro' && Math.hypot(m.x - z.x, m.z - z.z) - m.sc * 0.8 < z.r) damageMob(inst, m, z.dmg, ow, { freeze: z.freeze ? z.freeze * (m.kind === 'boss' ? 0.3 : 1) : 0, abil: 1, quiet: 1 }); }
    // turrets and clones shoot the nearest slime
    for (let k = inst.summons.length - 1; k >= 0; k--) { const q = inst.summons[k]; if (t > q.end) { inst.summons.splice(k, 1); continue; } if (t < q.next) continue; q.next = t + q.every;
      const ow = inst.players.get(q.owner), m = ow && nearestMob(inst, q.x, q.z, q.range); if (!m) continue;
      ev(inst, { k: 'zap', x0: +q.x.toFixed(1), z0: +q.z.toFixed(1), u: m.uid, s: q.id }); damageMob(inst, m, q.dmg, ow, { abil: 1 }); }
    // the dungeon clock: 12 / 14 / 16 minutes (L.dunTime), minus 10 seconds for every death
    if (inst.limit && !inst.done && t + inst.pen >= inst.limit) { finish(inst, 'time'); return; }
    inst.mobs = inst.mobs.filter(m => m.hp > 0 || t - m.deadAt < 0.05);
    dropsTick(inst); featTick(inst);
    // hardcore wipe: everyone out
    if (inst.mode === 'dungeon' && inst.hc && inst.players.size && !alive(inst).length && ![...inst.players.values()].some(p => p.dead && !p.out)) finish(inst, 'wipe');
  };
  // the arena of a boss or mini-boss room: the room and the hall that leads into it
  const inArena = (inst, r, x, z) => { const a = W.where(inst.i, x, z, 0), q = inst.lay.rooms[r]; return a === r || (q && a === 100 + q.hin); };
  function roomsTick(inst, dt) {
    const lay = inst.lay;
    for (let r = 1; r < lay.rooms.length; r++) {
      const room = lay.rooms[r], rs = inst.rooms[r], kind = room.kind === 'side' ? inst.side[r] || 'vault' : room.kind;
      if (rs.st === 'idle' && inst.rooms[room.from].st === 'clear' && kind !== 'loot') {
        if (kind === 'vault') { rs.st = 'clear'; ev(inst, { k: 'room', r, st: 'clear' }); continue; }
        if (alive(inst).some(p => W.where(inst.i, p.x, p.z, 1.5) === r)) { rs.st = 'active'; rs.wave = 0; rs.next = inst.t + (room.kind === 'boss' ? 1.6 : 0.4); rs.spawned = false; ev(inst, { k: 'room', r, st: 'active' });
          // boss and mini-boss rooms seal: everyone still outside is pulled in, then the gate drops behind you
          if (room.kind === 'boss' || room.kind === 'mini') { inst.sealed = r; const e = room.entry, [dx, dz] = W.DIRV[lay.halls[room.hin].dir];
            for (const p of alive(inst)) if (!inArena(inst, r, p.x, p.z)) { p.x = e.x + dx * 4 + (inst.rng() - 0.5) * 3; p.z = e.z + dz * 4 + (inst.rng() - 0.5) * 3; p.area = r; p.burstT = inst.t; p.iframe = Math.max(p.iframe, inst.t + 1); ev(inst, { k: 'tp', who: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2) }); } } }
      }
      if (rs.st === 'active') {
        if (!rs.spawned && inst.t >= rs.next) { rs.spawned = true; spawnWave(inst, room, rs); }
        else if (rs.spawned && !inst.mobs.some(m => m.room === r && m.hp > 0)) {
          const nWaves = room.waves ? room.waves.length : 1;
          if ((kind === 'mob' || kind === 'ambush') && rs.wave + 1 < nWaves) { rs.wave++; rs.spawned = false; rs.next = inst.t + 1.2; }
          else { rs.st = 'clear'; rs.clearT = inst.t; if (room.main) inst.progress = Math.max(inst.progress, r); if (inst.sealed === r) inst.sealed = -1; ev(inst, { k: 'room', r, st: 'clear' });
            if (kind === 'ambush') { for (const q of inst.players.values()) q.bonus = (q.bonus || 0) + C.CHEST.GOLD_UNITS * 0.5; ev(inst, { k: 'coins', x: +room.x.toFixed(1), z: +room.z.toFixed(1), n: 12, who: 0 }); }
            if (room.kind === 'boss') { inst.rooms[lay.loot] && (inst.rooms[lay.loot].st = 'clear'); finish(inst, 'clear'); } }
        }
      }
    }
  }
  function finish(inst, res) { if (inst.done) return; if (res === 'clear') collectAll(inst); inst.done = true; inst.result = res; ev(inst, { k: 'done', res, t: inst.t, progress: inst.progress, waves: inst.pitCleared }); }
  // ---------------------------------------------------------------- loot on the floor: gear (each player gets their own) + health potions (anyone)
  const D = C.DROPS;
  function addDrop(inst, o) { const d = Object.assign({ id: inst.dropId++, t: inst.t, gone: false }, o); inst.drops.push(d);
    ev(inst, { k: 'drop', id: d.id, d: d.k, x: +d.x.toFixed(2), z: +d.z.toFixed(2), own: d.own || 0, it: d.it ? SD.itemOut(d.it) : undefined, ab: d.ab }); return d; }
  SD.itemOut = it => ({ t: it.t, s: it.s, k: it.k, c: it.c, r: it.r, lv: it.lv, ax: it.ax, raid: it.raid });
  const near = (inst, x, z, r) => { const a = inst.rng() * TAU, d = r * (0.4 + inst.rng() * 0.6); return [x + Math.cos(a) * d, z + Math.sin(a) * d]; };
  function dropsFor(inst, m) {
    if (inst.mode !== 'dungeon' || m.kind !== 'boss') return; const rng = inst.rng;
    for (const p of inst.players.values()) {
      const n = L.dropsN(inst.hc);
      for (let k = 0; k < n; k++) { const it = L.makeItem({ cls: p.cls }, inst.i, L.lootLevel(inst.i, inst.df, inst.hc, rng), { luck: L.lootLuck(inst.df, inst.hc, p.luck), ringOk: true }, rng);
        const [x, z] = near(inst, m.x, m.z, 3.5); addDrop(inst, { k: 'item', x, z, own: p.id, it }); } }
  }
  function pick(inst, d, p) { if (d.gone) return; d.gone = true;
    if (d.k === 'item') p.loot.push(d.it);
    ev(inst, { k: 'pick', id: d.id, who: p.id }); }
  function collectAll(inst) { for (const d of inst.drops) if (!d.gone && d.k === 'item') { const p = inst.players.get(d.own); if (p) pick(inst, d, p); } }
  function dropsTick(inst) {
    const t = inst.t;
    // walk over loot to pick it up (potions only when you are hurt)
    for (const p of inst.players.values()) { if (p.dead || p.out) continue; const r = D.PICK_R;
      for (const d of inst.drops) { if (d.gone || t - d.t < 0.6 || (d.own && d.own !== p.id)) continue; if (d.k === 'pot' && p.hp >= p.max * 0.97) continue;
        if (Math.abs(d.x - p.x) < r && Math.abs(d.z - p.z) < r && Math.hypot(d.x - p.x, d.z - p.z) < r) pick(inst, d, p); } }
    // a cleared room's gear flies to its owners after a moment, so nobody misses their drops
    for (const rs of inst.rooms) if (rs.clearT !== undefined && !rs.collected && t > rs.clearT + D.AUTO_DELAY) { rs.collected = true; collectAll(inst); }
    // potions nobody needed fade away
    if (inst.drops.length > 60) inst.drops = inst.drops.filter(d => !d.gone);
  }
  // ---------------------------------------------------------------- crates, the treasure chest (or Mimic), spike traps, the shrine
  const inArc = (cx, cz, yaw, arc, x, z) => yaw === null || yaw === undefined || !arc || Math.abs(Math.atan2(Math.sin(Math.atan2(x - cx, z - cz) - yaw), Math.cos(Math.atan2(x - cx, z - cz) - yaw))) <= arc / 2 + 0.25;
  function giveItem(inst, p, x, z, luckK, chest) { const it = L.makeItem({ cls: p.cls }, inst.i, L.lootLevel(inst.i, inst.df, inst.hc, inst.rng), { luck: L.lootLuck(inst.df, inst.hc, p.luck) * (luckK || 1), ringOk: true }, inst.rng);
    const [dx, dz] = near(inst, x, z, 1.2); addDrop(inst, { k: 'item', x: dx, z: dz, own: p.id, it, chest: chest ? 1 : 0 }); }
  function hitProps(inst, p, cx, cz, r, yaw, arc) {
    if (inst.mode !== 'dungeon' || !inst.props) return; const P = C.PROPS, rng = inst.rng;
    for (const q of inst.props) { if (q.gone || Math.abs(q.x - cx) > r + 0.6 || Math.abs(q.z - cz) > r + 0.6 || Math.hypot(q.x - cx, q.z - cz) > r + 0.5 || !inArc(cx, cz, yaw, arc, q.x, q.z)) continue;
      q.gone = true; ev(inst, { k: 'brk', id: q.id, by: p.id, x: +q.x.toFixed(1), z: +q.z.toFixed(1) });
      if (rng() < P.GOLD) { p.bonus = (p.bonus || 0) + P.GOLD_UNITS; ev(inst, { k: 'coins', x: +q.x.toFixed(1), z: +q.z.toFixed(1), n: 4, who: p.id }); }
    }
    const c = inst.chest; if (c && !c.open && Math.hypot(c.x - cx, c.z - cz) < r + 0.9 && inArc(cx, cz, yaw, arc, c.x, c.z)) {
      if (c.mimic) { c.open = true; const room = inst.lay.rooms[c.room]; const m = spawnMob(inst, room, 'mimic', 'mini', c.x, c.z, 0.2); m.aggro = 99; ev(inst, { k: 'chest', a: 'mimic', u: m.uid, x: +c.x.toFixed(1), z: +c.z.toFixed(1) }); return; }
      c.hp--; if (c.hp > 0) { ev(inst, { k: 'chest', a: 'hit', hp: c.hp }); return; }
      c.open = true; ev(inst, { k: 'chest', a: 'open', x: +c.x.toFixed(1), z: +c.z.toFixed(1) });
      for (const q of inst.players.values()) q.bonus = (q.bonus || 0) + C.CHEST.GOLD_UNITS;
      ev(inst, { k: 'coins', x: +c.x.toFixed(1), z: +c.z.toFixed(1), n: 18, who: 0 }); }
  }
  SD.hitProps = hitProps;
  function featTick(inst) {
    if (inst.mode !== 'dungeon') return; const t = inst.t;
    // spike traps: when the spikes are up, anyone standing on the strip (not jumping, not rolling) gets hurt once per cycle
    for (const tr of inst.traps) { if (L.trapState(tr, t) !== 2) continue; const cyc = Math.floor((t + tr.ph) / C.TRAP.PERIOD);
      for (const p of inst.players.values()) { if (p.dead || p.out || p.y > 0.7 || t < p.iframe) continue; if (Math.abs(p.x - tr.x) > tr.w / 2 + 0.3 || Math.abs(p.z - tr.z) > tr.d / 2 + 0.3) continue;
        const hit = p.trapHit || (p.trapHit = {}); if (hit[tr.id] === cyc) continue; hit[tr.id] = cyc;
        hurtPlayer(inst, p, p.max * C.TRAP.DMG * (C.TRAP.DIFF[inst.df] || 1) * (1 - ((p.aset && p.aset.tideward) || 0)), { x: tr.x, z: tr.z }); ev(inst, { k: 'trap', id: tr.id, who: p.id }); } }
    // room hazards: burning pools hurt while you stand in them, vents erupt every few seconds (jump or step away);
    // Update 6: the tide floods a room (stand on a dais), clockwork blades spin (jump them), stars fall on marked spots
    for (const h of inst.haz) { const k = h.k, st = k === 'vent' ? L.ventState(h, t, inst.vph) : k === 'star' ? L.starState(h, t) : k === 'tide' ? L.tideState(h, t) : 2; if (st !== 2) continue;
      for (const p of inst.players.values()) { if (p.dead || p.out || t < p.iframe) continue; let dk, key, from = { x: h.x, z: h.z };
        if (k === 'tide') { const inRoom = h.round ? Math.hypot(p.x - h.x, p.z - h.z) < h.round : Math.abs(p.x - h.x) < h.w / 2 && Math.abs(p.z - h.z) < h.d / 2; if (!inRoom || p.y > 1.2 || L.tideSafe(h, p.x, p.z)) continue; dk = C.HAZ.TIDE; key = Math.floor(t * 2); from = null; }
        else if (k === 'blades') { if (p.y > 0.7 || !L.bladeHit(h, t, p.x, p.z)) continue; dk = C.HAZ.BLADE; key = Math.floor(L.bladeAng(h, t) * (h.dir || 1) / Math.PI); }
        else { if (p.y > 0.7 || Math.abs(p.x - h.x) > h.r || Math.abs(p.z - h.z) > h.r || Math.hypot(p.x - h.x, p.z - h.z) > h.r) continue;
          dk = k === 'vent' ? C.HAZ.VENT : k === 'star' ? C.HAZ.STAR : C.HAZ.POOL; key = k === 'vent' ? Math.floor((t + h.ph + inst.vph) / C.HAZ.VENT_PERIOD) : k === 'star' ? Math.floor((t + h.ph) / C.HAZ.STAR_PERIOD) : Math.floor(t * 2); }
        const hit = p.hazHit || (p.hazHit = {}); if (hit[h.id] === key) continue; hit[h.id] = key;
        hurtPlayer(inst, p, p.max * dk * (C.TRAP.DIFF[inst.df] || 1) * (1 - ((p.aset && p.aset.tideward) || 0)), from); ev(inst, { k: 'trap', id: -h.id, who: p.id }); } }
    // the shrine: walk onto it for its power-up (once each)
    const sh = inst.shrine; if (sh) for (const p of inst.players.values()) { if (p.dead || sh.used[p.id] || Math.abs(p.x - sh.x) > 1.9 || Math.abs(p.z - sh.z) > 1.9) continue; sh.used[p.id] = 1;
      const dur = C.SHRINE_DUR; if (sh.kind === 'might') p.might = t + dur; else if (sh.kind === 'haste') p.haste = t + dur; else if (sh.kind === 'arcana') p.arcana = t + dur; else if (sh.kind === 'fortune') p.luck = (p.luck || 1) * 1.6;
      ev(inst, { k: 'shrine', who: p.id, kind: sh.kind, dur: sh.kind === 'fortune' ? 0 : dur }); }
  }
  // gold from crates and the chest (in units of one slime's gold; the reward rules turn it into gold)
  SD.bonusOf = (inst, id) => { const p = inst.players.get(id); return { gold: p ? p.bonus || 0 : 0, style: p ? p.styleBest || 0 : 0 }; };
  // everything that dropped for this player in the run (picked up or not): this is their gear reward
  SD.lootOf = (inst, id) => { const p = inst.players.get(id); if (!p) return []; const out = p.loot.slice(); for (const d of inst.drops) if (!d.gone && d.k === 'item' && d.own === id) out.push(d.it); return out; };
  // ---------------------------------------------------------------- Boss Raid: one empowered boss, no respawns
  function raidTick(inst, dt) {
    const rs = inst.rooms[0], room = inst.lay.rooms[0];
    if (rs.st === 'idle') { rs.st = 'active'; rs.next = inst.t + 3; rs.spawned = false; ev(inst, { k: 'room', r: 0, st: 'active' }); }
    if (!rs.spawned && inst.t >= rs.next) { rs.spawned = true; const d = C.DUNGEONS[inst.i]; spawnMob(inst, room, d.boss, 'boss', room.x, room.z - 6, 0); }
    if (rs.spawned && !inst.mobs.some(m => m.kind === 'boss' && m.hp > 0)) { rs.st = 'clear'; inst.progress = 1; finish(inst, 'clear'); return; }
    if (inst.players.size && !alive(inst).length) finish(inst, 'wipe');
  }
  // ---------------------------------------------------------------- the Pit: endless waves
  // the Wilds: camps wake when someone comes near, are cleared when their slimes die, and come back after a while (when nobody is standing in them)
  function wildTick(inst, dt) {
    const t = inst.t, lay = inst.lay, room = lay.rooms[0], WI = inst.wild, pl = alive(inst), WC = C.WILD;
    lay.camps.forEach((c, k) => { const cs = WI.camps[k], near = m => pl.some(p => Math.hypot(p.x - c.x, p.z - c.z) < c.r + m);
      if (cs.st === 'idle') { if (!near(WC.WAKE)) return; cs.st = 'active'; const list = L.wildPack(inst.lead, c, cs.n);
        list.forEach((q, j) => { const a = j / list.length * TAU + inst.rng(), m = spawnMob(inst, room, q.id, q.kind, c.x + Math.sin(a) * c.r * 0.55, c.z + Math.cos(a) * c.r * 0.55, j * 0.12);
          m.hp = m.max = Math.round(q.hp * (C.MOB.HPK[q.kind] || 1) * L.partyHp(inst.n)); m.dmg = q.dmg; m.camp = k; m.hx = c.x; m.hz = c.z; });
        ev(inst, { k: 'camp', c: k, st: 'active' }); }
      else if (cs.st === 'active') { if (inst.mobs.some(m => m.camp === k && m.hp > 0)) return; cs.st = 'clear'; cs.at = t + WC.RESPAWN; cs.n++; inst.wildCleared++; ev(inst, { k: 'camp', c: k, st: 'clear', n: inst.wildCleared }); }
      else if (cs.st === 'clear' && t >= cs.at && !near(WC.WAKE + 12)) { cs.st = 'idle'; ev(inst, { k: 'camp', c: k, st: 'idle' }); } });
  }
  // the Endless Tower: floor after floor, each a little stronger; mini-bosses every 5th floor, a dungeon boss every 10th; from floor 3 each floor rolls a mutator
  // ---- duels (PvP): everyone at the same health; weapons only; knock-outs respawn; first to C.DUEL.WINS
  function duelReset(inst, p, k) { const a = inst.lay.rooms[0]; p.max = p.hp = C.DUEL.HP; p.red = 0; p.regen = 0; p.leech = 0; p.dead = false; p.x = a.x; p.z = a.z + (k % 2 ? 9 : -9); p.iframe = inst.t + 1.5; p.burstT = inst.t; }
  function duelTick(inst, dt) { const D = inst.duel, ps = [...inst.players.values()];
    for (const q of ps) if (q.dead && !q.duelDown) { q.duelDown = inst.t; const by = q.lastBy && inst.players.get(q.lastBy); if (by) { D.score[by.id] = (D.score[by.id] || 0) + 1; by.kills = (by.kills || 0) + 1; ev(inst, { k: 'duel', score: D.score, ko: q.id, by: by.id }); if (D.score[by.id] >= C.DUEL.WINS) { D.winner = by.id; finish(inst, 'duel'); return; } } }
    for (const q of ps) if (q.dead && q.duelDown && inst.t - q.duelDown >= C.DUEL.RESPAWN) { q.duelDown = 0; q.dead = false; let k = 0; for (const z of ps) duelReset(inst, z, k++); ev(inst, { k: 'respawn', who: q.id, x: +q.x.toFixed(1), z: +q.z.toFixed(1) }); for (const z of ps) if (z !== q) ev(inst, { k: 'tp', who: z.id, x: +z.x.toFixed(1), z: +z.z.toFixed(1), duel: 1 }); }
    if (inst.t >= inst.limit && !inst.done) { const [a, b] = ps, sa = a ? D.score[a.id] || 0 : 0, sb = b ? D.score[b.id] || 0 : 0; D.winner = sa > sb ? a.id : sb > sa ? b.id : 0; finish(inst, 'duel'); }
    if (ps.length < 2 && !inst.done) { D.winner = ps[0] ? ps[0].id : 0; finish(inst, 'duel'); } }
  function duelAttack(inst, p, a) { const t = inst.t, k = a.k, ty = C.TYPES[p.type] || C.TYPES.sword, MS = C.MOVESETS[p.type] || C.MOVESETS.sword;
    if (k === 'spell') return { ok: false, err: 'weapons only in a duel' };
    if (k !== 'basic') return { ok: false, err: 'weapon swings only' }; if (t - (p.atkT || -9) < 0.2) return { ok: false, err: 'too fast' };   // Update 7 (final): no heavies, dashes, air slams or ultimates
    p.atkT = t; const combo = k === 'basic' ? Math.max(0, Math.min(MS.combo.length - 1, a.combo | 0)) : 0, h = MS.combo[combo], fin = k === 'basic' && (h.fin || h.burst);
    const reach = ty.ranged && !fin ? ty.range + 1 : fin ? C.SMASH_RADIUS * ty.aoe : ty.range * (h.r || 1);
    const arc = fin ? 7 : (h.arc || ty.arc) + 0.7, yaw = isFinite(+a.yaw) ? +a.yaw : p.yaw || 0;
    let dmg = L.duelHit(p.type, k, combo, a.ch);
    if (p.nextCrit) { dmg *= C.DUEL.CRIT; p.nextCrit = false; }
    let n = 0; for (const q of inst.players.values()) { if (q === p || q.dead) continue; const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d > reach + 0.9) continue;
      if (arc < 6.2 && d > 0.8) { let df = Math.atan2(dx, dz) - yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); if (Math.abs(df) > arc / 2) continue; }
      let dq = dmg; if (C.DUEL.BACKSTAB && MS.backstab && (p.x - q.x) * Math.sin(q.yaw || 0) + (p.z - q.z) * Math.cos(q.yaw || 0) < -0.3) dq *= MS.backstab;   // daggers: from behind
      q.lastBy = p.id; const h0 = q.hp; hurtPlayer(inst, q, dq, { x: p.x, z: p.z }); if (q.hp < h0) { n++; p.dmgDone = (p.dmgDone || 0) + (h0 - Math.max(0, q.hp)); styleHit(inst, p, k === 'basic' ? 'combo' + combo : k); } }
    return { ok: true, n }; }
  function towerTick(inst, dt) {
    const rs = inst.rooms[0], room = inst.lay.rooms[0], TW = C.TOWER;
    if (rs.st === 'idle') { rs.st = 'active'; rs.next = inst.t + 2; }
    if (!inst.mobs.some(m => m.hp > 0) && inst.t >= rs.next) {
      if (inst.towerFloor > inst.towerCleared) { inst.towerCleared = inst.towerFloor; ev(inst, { k: 'floor', f: inst.towerFloor, cleared: 1 }); rs.next = inst.t + 3.5;
        for (const p of inst.players.values()) { if (p.dead && !p.out) { p.dead = false; p.hp = p.max; p.x = room.x; p.z = room.z + 6; p.burstT = inst.t; p.iframe = inst.t + 2; ev(inst, { k: 'respawn', who: p.id, x: room.x, z: room.z + 6 }); } else if (!p.dead) heal(inst, p, p.max * TW.HEAL, true); } return; }
      inst.towerFloor++; const F = L.towerFloor(inst.lead, inst.towerFloor, inst.seed), n = inst.n; inst.mut = F.mut; if (F.mut && !inst.mutsSeen.includes(F.mut.id)) inst.mutsSeen.push(F.mut.id);
      F.list.forEach((q, k) => { const a = (k / F.list.length) * TAU + inst.rng() * 0.3, r = q.kind === 'boss' ? 0 : room.round - 3, m = spawnMob(inst, room, q.id, q.kind, room.x + Math.sin(a) * r, room.z + Math.cos(a) * r - (q.kind === 'boss' ? 6 : 0), k * 0.1);
        m.hp = m.max = Math.round(q.hp * (C.MOB.HPK[q.kind] || 1) * L.partyHp(n)); m.dmg = q.dmg; m.aggro = 99; if (q.sc) m.sc *= q.sc; if (q.mod && m.kind !== 'boss') { m.mod = q.mod; if (q.mod === 'shield') m.shp = Math.round(m.max * C.ELITE_MODS.shield.hp); } });
      ev(inst, { k: 'floor', f: inst.towerFloor, mut: F.mut ? F.mut.id : '', boss: F.list.some(q => q.kind === 'boss' || q.kind === 'mini') ? 1 : 0 });
    }
    if (inst.players.size && !alive(inst).length) finish(inst, 'wipe');
  }
  function pitTick(inst, dt) {
    const rs = inst.rooms[0], room = inst.lay.rooms[0];
    if (rs.st === 'idle') { rs.st = 'active'; rs.next = inst.t + 2; rs.spawned = true; }
    if (!inst.mobs.some(m => m.hp > 0) && inst.t >= rs.next) {
      if (inst.pitWave > inst.pitCleared) { inst.pitCleared = inst.pitWave; ev(inst, { k: 'wave', r: 0, w: inst.pitWave, cleared: 1 }); rs.next = inst.t + 3;
        for (const p of inst.players.values()) if (p.dead && !p.out) { p.dead = false; p.hp = p.max; p.x = room.x; p.z = room.z + 6; p.burstT = inst.t; p.iframe = inst.t + 2; ev(inst, { k: 'respawn', who: p.id, x: room.x, z: room.z + 6 }); } return; }
      inst.pitWave++; const list = L.pitWave(inst.lead, inst.pitWave), n = inst.n;
      list.forEach((q, k) => { const a = (k / list.length) * TAU + inst.rng() * 0.3, r = room.round - 3, m = spawnMob(inst, room, q.id, q.kind, room.x + Math.sin(a) * r, room.z + Math.cos(a) * r, k * 0.1);
        m.hp = m.max = Math.round(q.hp * (C.MOB.HPK[q.kind] || 1) * L.partyHp(n)); m.dmg = q.dmg; m.aggro = 99; });
      ev(inst, { k: 'wave', r: 0, w: inst.pitWave });
    }
    if (inst.players.size && !alive(inst).length) finish(inst, 'wipe');
  }
  // ---------------------------------------------------------------- players
  function playerTick(inst, p, dt) {
    if (p.dead) { if (p.out) return; p.deadT -= dt; if (p.deadT <= 0 && (inst.mode === 'dungeon' || inst.mode === 'wild')) { p.dead = false; p.hp = p.max; const rp = inst.mode === 'wild' ? inst.lay.start : respawnPoint(inst); p.x = rp.x; p.z = rp.z; p.area = inst.mode === 'wild' ? 0 : Math.max(0, W.where(inst.i, rp.x, rp.z)); p.burstT = inst.t + 1; p.iframe = inst.t + 2; ev(inst, { k: 'respawn', who: p.id, x: rp.x, z: rp.z }); } return; }
    // style fades when you stop hitting things
    if (p.sty > 0 && inst.t - p.chainT > 2) { p.sty = Math.max(0, p.sty - C.STYLE.DECAY * dt); const r = L.styleRank(p.sty); if (r !== p.rank) { p.rank = r; ev(inst, { k: 'style', who: p.id, r, n: p.chain }); } }
    if (inst.t - p.hurtT > C.REGEN_DELAY && p.hp < p.max) heal(inst, p, p.max * C.REGEN_PER_SEC * dt, true);
    else if (p.regen > 0 && p.hp < p.max) heal(inst, p, p.max * p.regen * dt, true);
    if (inst.mode === 'dungeon') { const a = W.where(inst.i, p.x, p.z); if (a >= 0) { p.area = a; if (a < 100) p.room = Math.max(p.room, a); } }
  }
  function respawnPoint(inst) { const lay = inst.lay; let r = 0; for (let k = lay.nMain - 1; k >= 0; k--) if (inst.rooms[k].st !== 'idle') { r = k; break; } const q = lay.rooms[r];
    if (!q.entry) return { x: q.x, z: q.z }; const [dx, dz] = W.DIRV[lay.halls[q.hin].dir]; return { x: q.entry.x + dx * 4.5, z: q.entry.z + dz * 4.5 }; }
  function heal(inst, p, n, quiet) { if (p.dead) return; const before = p.hp; p.hp = Math.min(p.max, p.hp + n); if (!quiet && p.hp - before >= 1) ev(inst, { k: 'heal', who: p.id, n: Math.round(p.hp - before), hp: Math.round(p.hp) }); }
  // what happens when a slime dies: splitters split, explosive elites blow up
  function onDeath(inst, m) {
    if (m.beh === 'split' && !m.child && inst.mobs.length < 90) { const B2 = C.BEH.split, q = roomOf(inst, m);
      for (let k = 0; k < B2.n; k++) { const a = k / B2.n * Math.PI * 2 + inst.rng(), c2 = spawnMob(inst, q, m.id, 'mob', m.x + Math.sin(a) * 0.8, m.z + Math.cos(a) * 0.8, 0.15);
        c2.child = true; c2.beh = null; c2.sc = m.sc * B2.sc; c2.max = c2.hp = Math.max(1, Math.round(m.max * B2.hp)); c2.dmg = m.dmg * 0.7; c2.st = 'chase'; c2.t = 0.2; ev(inst, { k: 'mhp', u: c2.uid, hp: c2.hp, max: c2.max }); ev(inst, { k: 'msc', u: c2.uid, sc: +c2.sc.toFixed(2) }); } }
    if (m.mod === 'boom') { const EB = C.ELITE_MODS.boom; tele(inst, { hp: 1, dmg: m.dmg, x: m.x, z: m.z }, { s: 'c', x: m.x, z: m.z, r: EB.r }, EB.fuse, EB.mult); }
  }
  function hurtPlayer(inst, p, dmg, from, o) {
    if (!p || p.dead || p.out) return; const t = inst.t;
    if (t < (p.divT || 0)) return; if (inst.mut && inst.mut.taken) dmg *= inst.mut.taken;
    // perfect dodge: the hit would have landed just after you started rolling
    if (t < p.iframe) { if (p.pdOk && t - (p.dodgeT || -9) <= C.PDODGE.WIN * (1 + ((p.aset && p.aset.tempo) || 0)) + 0.12) { p.pdOk = false; p.nPdodge = (p.nPdodge || 0) + 1; p.nextCrit = true; p.pdBuff = t + 3; p.sty += C.PDODGE.STYLE; ev(inst, { k: 'pdodge', who: p.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1) }); } return; }
    // parry: blocked in the last moment (not the arena-wide one-shots)
    if (!(o && o.unblock) && t - (p.parryT || -9) <= C.PARRY.WIN * (1 + ((p.aset && p.aset.tempo) || 0))) { p.parryT = -9; p.parryCd = t + 0.25; p.iframe = t + 0.3; p.nextCrit = true; p.sty += C.PARRY.STYLE;
      const src = from && (from.ref || from); if (src && src.uid && src.hp > 0) { src.stun = Math.max(src.stun || 0, t + C.PARRY.STUN * (src.kind === 'boss' ? 0.35 : 1)); if (src.st === 'wind' || src.st === 'leap' || src.st === 'aim') { src.st = 'recover'; src.t = 0; src.warn = 0; src.y = 0; } }
      p.nParry = (p.nParry || 0) + 1; ev(inst, { k: 'parry', who: p.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1), u: from && from.uid }); return; }
    // armour sets: Storm Shield blocks a hit every few seconds, Glitched Code can make a hit miss
    const A = p.aset || {};
    if (A.ward && inst.t >= (p.swardT || 0)) { p.swardT = inst.t + (A.ward >= 1 ? 7 : 12); p.iframe = inst.t + 0.3; ev(inst, { k: 'blocked', who: p.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1) }); return; }
    if (A.phase && inst.rng() < A.phase) { p.iframe = inst.t + 0.2; ev(inst, { k: 'wfx', w: 'phase', t: 8, x: +p.x.toFixed(1), z: +p.z.toFixed(1), who: p.id }); return; }
    dmg *= 1 - clamp(p.red || 0, 0, 0.8);
    const MSw = C.MOVESETS[p.type]; if (MSw && MSw.armour && t - p.atkT < MSw.armourT) dmg *= 1 - MSw.armour;   // greatsword: super armour while swinging
    if (t < (p.avT || 0) && p.avRed) dmg *= 1 - p.avRed; if (t < (p.auraT || 0)) dmg *= 1 - (p.auraRed || 0);
    if (inst.t < p.shield) dmg *= 1 - (L.spell('iron').red);
    dmg = Math.max(1, Math.round(dmg)); p.hp -= dmg; p.hurtT = inst.t; styleHurt(inst, p); 
    if (from && from.mod === 'vamp' && from.hp > 0 && from.max) { from.hp = Math.min(from.max, from.hp + Math.round(dmg * C.ELITE_MODS.vamp.heal)); ev(inst, { k: 'mheal', u: from.uid, hp: from.hp }); }
    ev(inst, { k: 'hurt', who: p.id, n: dmg, hp: Math.max(0, Math.round(p.hp)), fx: from ? +from.x.toFixed(1) : null, fz: from ? +from.z.toFixed(1) : null });
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = C.RESPAWN_TIME; p.deaths++; if (inst.hc || inst.mode === 'pit') { if (inst.hc) p.out = true; }
      if (inst.limit && !p.out) inst.pen += C.DEATH_PEN;
      ev(inst, { k: 'die', who: p.id, out: !!p.out, pen: inst.limit && !p.out ? C.DEATH_PEN : 0 }); }
  }
  // the client tells us where its player is (10 times a second)
  // positions come from the player's own game; anything faster than running (plus dodge/leap/blink bursts) is pulled back
  SD.move = function (inst, id, x, y, z, yaw) { const p = inst.players.get(id); if (!p || p.dead) return; if (+y > 0.8) p.airT = inst.t;
    const dt = Math.min(0.5, Math.max(0.05, inst.t - (p.mvT === undefined ? inst.t : p.mvT))), dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    const lim = C.WALK_SPEED * Math.max(1, p.move || 1, p.speed || 1) * (inst.t < (p.haste || 0) ? 1.3 : 1) * 1.7 * dt + 3 + (inst.t - (p.burstT === undefined ? -9 : p.burstT) < 1.2 ? 14 : 0);
    if (d > lim) { x = p.x + dx / d * lim; z = p.z + dz / d * lim; }
    // bosses, mini-bosses and the boss's heart are solid: you can't stand inside them
    ({ x, z } = pushOut(inst, x, z, y));
    // closed gates are closed for everyone: you can't walk (or send yourself) past one, or out of a sealed boss arena
    if (inst.mode === 'dungeon' && !SD.canStand(inst, p, x, z)) { p.mvT = inst.t; p.y = y; p.yaw = yaw; return false; }
    p.mvT = inst.t; p.x = x; p.y = y; p.z = z; p.yaw = yaw; return true; };
  const solid = m => m.hp > 0 && (m.kind === 'boss' || m.kind === 'mini' || m.kind === 'heart') && m.st !== 'spawn' && !m.vanish && (m.y || 0) < 1.5;
  SD.solidR = m => m.sc * 0.85 + 0.4;
  // push a point out of every solid boss, never through a wall (tries other directions, else leaves it)
  function pushOut(inst, x, z, y) { if ((y || 0) > 2.2) return { x, z };
    for (const m of inst.mobs) { if (!solid(m)) continue; const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz), r = SD.solidR(m); if (d >= r) continue; const a0 = d < 1e-3 ? 0 : Math.atan2(dx, dz);
      for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) { const nx = m.x + Math.sin(a0 + da) * r, nz = m.z + Math.cos(a0 + da) * r; if (inst.mode !== 'dungeon' || W.where(inst.i, nx, nz, 0.3) >= 0) { x = nx; z = nz; break; } } }
    return { x, z }; }
  SD.pushOut = pushOut;
  SD.canStand = (inst, p, x, z) => { const lay = inst.lay; let a = W.where(inst.i, x, z, 0);
    // stepping off the floor is refused (the game never does it); someone already off the floor (an old position) may move back
    if (a < 0) { if (W.where(inst.i, p.x, p.z, 0) >= 0) return false; a = W.where(inst.i, x, z, -1.5); if (a < 0) return false; } if (a === p.area) return true;
    if (inst.sealed >= 0 && inArena(inst, inst.sealed, p.x, p.z) && !inArena(inst, inst.sealed, x, z)) return false;
    if (a >= 100) return W.hallOpen(lay, inst.rooms, a - 100) || (inst.sealed >= 0 && lay.rooms[inst.sealed].hin === a - 100 && inArena(inst, inst.sealed, p.x, p.z));
    const q = lay.rooms[a]; return a === 0 || q.hin < 0 || W.hallOpen(lay, inst.rooms, q.hin) || inst.rooms[a].st === 'active' && inst.sealed === a && inArena(inst, a, p.x, p.z) || inst.rooms[a].st === 'clear' && p.area >= 100 && lay.halls[p.area - 100] && (lay.halls[p.area - 100].a === a || lay.halls[p.area - 100].b === a); };
  SD.dodgeCd = p => C.DODGE_COOLDOWN * (1 - 0.6 * ((p.aset && p.aset.dodge) || 0));
  SD.dodge = function (inst, id) { const p = inst.players.get(id); if (!p || p.dead) return false; if (inst.t - (p.dodgeT || -9) < SD.dodgeCd(p) * 0.8) return false; p.dodgeT = inst.t; p.burstT = inst.t; p.iframe = Math.max(p.iframe, inst.t + C.DODGE_TIME); p.dashUsed = false; p.pdOk = true; return true; };
  // parry: press block just before a hit lands
  SD.parry = function (inst, id) { const p = inst.players.get(id); if (!p || p.dead) return false; if (inst.t < (p.parryCd || 0)) return false; p.parryT = inst.t; p.parryCd = inst.t + C.PARRY.CD; return true; };
  // style + ultimate bookkeeping
  function styleHit(inst, p, kind) { const t = inst.t, S = C.STYLE; if (t - p.chainT > S.GAP) p.chain = 0; p.chain++; p.chainT = t; p.sty += 1 + (kind !== p.lastMove ? 1.5 : 0) + (p.chain > 10 ? 0.5 : 0); p.lastMove = kind;
    const r = L.styleRank(p.sty); if (r !== p.rank) { p.rank = r; if (r > p.styleBest) p.styleBest = r; ev(inst, { k: 'style', who: p.id, r, n: p.chain }); } }
  function styleHurt(inst, p) { p.sty *= 0.5; p.chain = 0; const r = L.styleRank(p.sty); if (r !== p.rank) { p.rank = r; ev(inst, { k: 'style', who: p.id, r, n: 0 }); } }
  SD.styleOf = (inst, id) => { const p = inst.players.get(id); return p ? { rank: p.rank, best: p.styleBest, chain: p.chain, pts: Math.round(p.sty) } : null; };
  // ---------------------------------------------------------------- damage
  function nearestMob(inst, x, z, r) { let best = null, bd = r; for (const m of inst.mobs) { if (m.hp <= 0 || m.st === 'spawn' || m.st === 'intro') continue; const d = Math.hypot(m.x - x, m.z - z) - m.sc * 0.8; if (d < bd) { bd = d; best = m; } } return best; }
  SD.nearestMob = nearestMob;
  SD._hurt = (inst, p, dmg, from, o) => hurtPlayer(inst, p, dmg, from, o);   // used by the tests
  SD._bossLoot = inst => { const q = inst.lay.rooms[inst.lay.boss]; if (q && inst.mode === 'dungeon') dropsFor(inst, { kind: 'boss', x: q.x, z: q.z }); collectAll(inst); };   // test hook: a forced win still drops the boss loot
  function damageMob(inst, m, dmg, p, o) {
    if (!m || m.hp <= 0 || m.st === 'spawn' || m.st === 'intro') return 0;
    o = o || {}; if (o.sc) o = Object.assign({}, o.sc, o); let crit = false; const t0 = inst.t, CB = C.COMBOS;
    if (o.st1 && (m.kind === 'boss' || m.kind === 'mini' || m.kind === 'elite')) dmg *= C.ABIL.ST_BOSS;   // Update 7 (final): single-target abilities hit bosses, mini-bosses and elites harder

    if (!o.fxp) { const stunned = t0 < m.stun;
      // ability combos: freeze -> shatter (a physical blow), fire on a pulled/rooted slime, Execute/Assassinate on a marked one
      if (t0 < m.frz && o.phys && m.kind !== 'boss') { dmg *= 1 + CB.shatter; m.frz = 0; ev(inst, { k: 'combo', c: 'shatter', u: m.uid, by: p.id }); }
      if (o.el === 'fire' && (m.pull && t0 < m.pull.until + 0.6 || t0 < m.frz)) { dmg *= 1 + CB.ignite; ev(inst, { k: 'combo', c: 'ignite', u: m.uid, by: p.id }); }
      if (o.exec && t0 < (m.mark || 0)) { dmg *= 1 + CB.execute; ev(inst, { k: 'combo', c: 'execute', u: m.uid, by: p.id }); }
      if (t0 < (p.avT || 0) && p.avDmg) dmg *= 1 + p.avDmg; if (t0 < (p.auraT || 0)) dmg *= 1 + (p.auraBuff || 0);
      // daggers: hits from behind
      if (o.back !== false && p.type === 'dagger' && !o.abil0) { const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw), ax = p.x - m.x, az = p.z - m.z, dd = Math.hypot(ax, az) || 1; if ((ax * fx + az * fz) / dd < -0.25) { dmg *= C.MOVESETS.dagger.backstab; o.bs = 1; } }
      if (t0 < (p.stealth || 0)) { dmg *= p.stealthAmp || 2; p.stealth = 0; ev(inst, { k: 'stealth', who: p.id, on: 0 }); }
      if (p.nextCrit || (t0 < (p.avT || 0) && p.avCrit) || (stunned && inst.rng() < CB.stunCrit)) { crit = true; p.nextCrit = false; } }
    { crit = crit || inst.rng() < p.crit; if (crit) dmg *= p.critMult; if (inst.t < p.buff) dmg *= 1 + L.spell('cry').buff; if (inst.t < (p.might || 0)) dmg *= 1.5;
      if (!o.abil && inst.t < (p.rage || 0)) dmg *= 1 + (p.rageDmg || 0); }
    if (inst.t < (m.mark || 0)) dmg *= 1 + (m.markAmp || 0);
    // your weapon's power (each dungeon's weapons have their own) and your armour set
    if (p.aset && p.aset.hunt && (m.kind === 'boss' || m.kind === 'mini')) dmg *= 1 + p.aset.hunt;
    if (inst.mut && inst.mut.dealt) dmg *= inst.mut.dealt;
    // a boss hiding behind its heart takes no damage until the heart breaks
    if (m.immune) { if (!o.quiet && inst.t - (m.immT || -9) > 0.4) { m.immT = inst.t; ev(inst, { k: 'dmg', u: m.uid, n: 0, im: 1, by: p.id, hp: m.hp }); } return 0; }
    if (m.st === 'under' || m.st === 'out' || m.y < -0.5) return 0;
    let blk = 0;
    if (m.beh === 'shield') { const ax = (o.kx === undefined ? p.x : o.kx) - m.x, az = (o.kz === undefined ? p.z : o.kz) - m.z, dd = Math.hypot(ax, az) || 1, f = (ax * Math.sin(m.yaw) + az * Math.cos(m.yaw)) / dd;
      if (f > Math.cos(C.BEH.shield.arc)) { dmg *= 1 - C.BEH.shield.red; blk = 1; } }
    if (m.shp > 0) { const a = Math.min(m.shp, dmg); m.shp -= a; dmg -= a; if (m.shp <= 0) { m.shp = 0; ev(inst, { k: 'mshield', u: m.uid, on: 0 }); } if (dmg <= 0) { ev(inst, { k: 'dmg', u: m.uid, n: Math.round(a), sh: 1, by: p.id, hp: m.hp }); return 0; } }
    dmg = Math.max(1, Math.round(dmg)); const dealt = Math.min(dmg, m.hp); m.hp -= dmg; p.dmgDone += dealt;
    if (o.stun) m.stun = Math.max(m.stun, inst.t + o.stun); if (o.freeze) m.frz = Math.max(m.frz, inst.t + o.freeze);
    if (o.kb && m.kind !== 'boss') { const dx = m.x - (o.kx === undefined ? p.x : o.kx), dz = m.z - (o.kz === undefined ? p.z : o.kz), d = Math.hypot(dx, dz) || 1; m.x += dx / d * o.kb / Math.max(1, m.sc); m.z += dz / d * o.kb / Math.max(1, m.sc); }
    if (m.st === 'idle') { m.st = 'chase'; m.t = 0; }
    ev(inst, { k: 'dmg', u: m.uid, n: dmg, c: crit ? 1 : 0, by: p.id, hp: Math.max(0, m.hp), blk: blk || undefined, bs: o.bs || undefined });
    if (!o.fxp && !o.dot) { styleHit(inst, p, o.mv || (o.abil ? 'spell' : 'basic')); }
    if (o.bleed && m.hp > 0) { m.bleed = { until: inst.t + 3, next: inst.t + 0.5, dps: p.ap * 0.35, by: p.id }; }
    if (o.burnAdd && m.hp > 0) m.burn = { until: inst.t + 3, next: m.burn ? m.burn.next : inst.t + 0.5, dps: p.ap * 0.45, by: p.id };
    if (o.frzAdd && m.kind !== 'boss' && m.hp > 0) m.frz = Math.max(m.frz, inst.t + 1);
    if (m.hp <= 0) { m.hp = 0; m.deadAt = inst.t; p.kills++; if (!m.minion) { const kc = p.kc || (p.kc = {}); kc[m.id] = (kc[m.id] || 0) + 1; } ev(inst, { k: 'kill', u: m.uid, by: p.id }); dropsFor(inst, m); onDeath(inst, m);
      { if (o.sid && o.resetKill) { p.cds[o.sid] = 0; ev(inst, { k: 'reset', who: p.id, s: o.sid }); } }
      if (p.wpow && p.wpow.k === 'reap' && m.kind !== 'orb') { for (const k in p.cds) p.cds[k] -= p.wpow.v; ev(inst, { k: 'wfx', w: 'reap', t: p.wpow.t, x: R1(m.x), z: R1(m.z), who: p.id }); }
      if (m.id === 'mimic') { for (const q of inst.players.values()) q.bonus = (q.bonus || 0) + C.CHEST.GOLD_UNITS * C.CHEST.MIMIC_GOLD; ev(inst, { k: 'coins', x: +m.x.toFixed(1), z: +m.z.toFixed(1), n: 30, who: 0 }); }
      if (m.kind === 'boss' || m.kind === 'mini') { inst.mobs.forEach(q => { if (q.minion && q.hp > 0 && (m.kind === 'boss' || q.owner === m.uid)) { q.hp = 0; q.deadAt = inst.t; ev(inst, { k: 'kill', u: q.uid, by: p.id, fade: 1 }); } });
        if (m.kind === 'boss') { inst.tele.length = 0; inst.bpools.length = 0; inst.sched = inst.sched.filter(q => !q.boss); } } }
    return dmg;
  }
  // hit every listed slime that really is within reach of the attack
  function hitList(inst, p, uids, cx, cz, reach, mult, o) {
    let n = 0; const seen = new Set();
    for (const u of uids || []) { if (seen.has(u) || n >= 14) continue; seen.add(u); const m = inst.mobs.find(q => q.uid === u); if (!m || m.hp <= 0) continue;
      if (Math.hypot(m.x - cx, m.z - cz) - m.sc * 0.9 > reach + 2.2) continue; damageMob(inst, m, p.ap * mult, p, o); n++; }
    return n;
  }
  const inReach = (p, x, z, r) => Math.hypot(p.x - x, p.z - z) <= r + 3;
  // a = {k: 'basic', combo, targets, x, z (bolt impact)} | {k: 'spell', id, targets, x, z (target point), yaw}
  SD.attack = function (inst, id, a) {
    const p = inst.players.get(id); if (!p || p.dead || !a) return { ok: false }; if (inst.mode === 'duel') return duelAttack(inst, p, a);
    const t = inst.t, ty = C.TYPES[p.type] || C.TYPES.sword;
    const MS = C.MOVESETS[p.type] || C.MOVESETS.sword, spdK = p.speed * (t < (p.haste || 0) ? 1.3 : 1) * (t < (p.rage || 0) ? 1 + (p.rageSpd || 0) : 1) * (t < (p.avT || 0) ? 1 + (p.avSpd || 0) : 1);
    if (a.k === 'basic') {
      // each weapon has its own combo; a hit can only follow the one before it (so you can't spam the finisher)
      const list = MS.combo, n = list.length; let combo = clamp(a.combo | 0, 0, n - 1); if (combo !== 0 && (combo !== p.comboN + 1 || t - p.atkT > 1.4)) combo = 0;
      // the wait before a swing is the recovery of the swing you actually made before it (a first hit can't skip it: sending only
      // first hits used to be faster than the real combo)
      const gap = (combo > 0 ? list[combo - 1].gap : Math.max(0.18, p.lastGap || 0)) * 0.85 / spdK;
      // a swing that arrives a little early (the simulation's 20 Hz steps, network jitter) waits for its turn instead of being lost;
      // much too early is refused, and only one can wait, so you can never swing faster than the weapon allows
      if (t - p.atkT < gap) { const at = p.atkT + gap; if (at - t > C.HIT_GRACE || p.atkQ) return { ok: false, err: 'too fast' };
        p.atkQ = 1; inst.sched.push({ at, fn: () => { p.atkQ = 0; SD.attack(inst, id, a); } }); return { ok: true, queued: 1 }; }
      p.atkT = t; p.comboN = combo === n - 1 ? -1 : combo; const h = list[combo], mvk = 'combo' + combo; p.lastGap = h.gap;
      if (h.bolt) { const x = +a.x, z = +a.z; if (!isFinite(x) || !isFinite(z) || !inReach(p, x, z, ty.range + 1.5)) return { ok: false };
        const travel = Math.hypot(x - p.x, z - p.z) / 24; inst.sched.push({ at: t + travel, fn: () => { hitList(inst, p, a.targets, x, z, 1.6, h.m, { mv: mvk }); hitProps(inst, p, x, z, 1.6); } }); return { ok: true }; }
      if (h.fin || h.burst) { const R = h.burst || C.SMASH_RADIUS * ty.aoe * (h.r || 1); hitProps(inst, p, p.x, p.z, R);
        const got = hitList(inst, p, a.targets, p.x, p.z, R, h.m, { kb: h.kb || 3, stun: h.up, up: h.up, mv: mvk, phys: !ty.ranged, heavy: 1 }); if (h.up) ev(inst, { k: 'launch', by: id, u: a.targets && a.targets.slice(0, 12) }); return { ok: true, n: got }; }
      hitProps(inst, p, p.x, p.z, ty.range * (h.r || 1) + 0.6, isFinite(+a.yaw) && a.yaw !== undefined ? +a.yaw : null, (h.arc || ty.arc) + 0.6);
      return { ok: true, n: hitList(inst, p, a.targets, p.x, p.z, ty.range * (h.r || 1), h.m, { kb: 0.7, mv: mvk, phys: 1 }) };   // small knockback so the whole combo connects
    }
    if (a.k !== 'basic' && a.k !== 'spell') return { ok: false, err: 'no such attack' };   // Update 7 (final): heavies, dash attacks, air slams and ultimates are gone
    if (a.k === 'spell') {
      const sp = L.spell(a.id); if (!sp || sp.cls !== p.cls || !p.spells.includes(sp.id)) return { ok: false, err: 'no spell' };
      // what this ability is made of, for combos and talents (element, physical blow, execute, extra effects)
      const adds = sp.adds || [], el = sp.el || (sp.freeze || sp.id === 'blizzard' ? 'frost' : /fire|meteor|pit|storm|flame|inferno/.test(sp.id) ? 'fire' : sp.cls === 'mage' ? 'arcane' : 'phys');
      const SC = { el, phys: el === 'phys', exec: sp.low ? 1 : 0, sid: sp.id, st1: sp.role === 'st' ? 1 : 0, resetKill: sp.resetKill, bleed: adds.includes('bleed'), burnAdd: adds.includes('burn'), frzAdd: adds.includes('freeze'), mv: 'spell:' + sp.id, lowAt: sp.lowAt };
      if (t < (p.cds[sp.id] || 0)) { const at = p.cds[sp.id]; if (at - t > C.HIT_GRACE || p.spQ) return { ok: false, err: 'cooldown' };   // nearly ready: it fires the moment it is
        p.spQ = 1; inst.sched.push({ at, fn: () => { p.spQ = 0; SD.attack(inst, id, a); } }); return { ok: true, queued: 1 }; }
      p.cds[sp.id] = t + sp.cd * (1 - p.cdr) * 0.92 * (t < (p.arcana || 0) ? 0.5 : 1);
      p.casts = (p.casts || 0) + 1;
      const x = isFinite(+a.x) ? +a.x : p.x, z = isFinite(+a.z) ? +a.z : p.z, yaw = isFinite(+a.yaw) ? +a.yaw : p.yaw || 0, fx = { k: 'fx', s: sp.id, by: id, x: +x.toFixed(1), z: +z.toFixed(1), yaw: +yaw.toFixed(2) };
      // ability damage (Update 7): your GEAR POWER (every piece you wear) x your bonus ability damage x Berserk. The ability's mult already has its tier
      const AP = (p.gp || p.ap) * (t < (p.rage || 0) ? 1 + (p.rageDmg || 0) : 1), o0 = { abil: 1, sc: SC };   // your Power (all your gear x your class stat) x Berserk
      const inR = (cx, cz, r) => inst.mobs.filter(m => m.hp > 0 && m.st !== 'spawn' && m.st !== 'intro' && Math.hypot(m.x - cx, m.z - cz) - m.sc * 0.8 < r);
      // slimes in a straight line from (x0,z0) along yaw, length len, width w
      const inLine = (x0, z0, ya, len, w) => { const fx2 = Math.sin(ya), fz2 = Math.cos(ya);
        return inst.mobs.filter(m => { if (m.hp <= 0 || m.st === 'spawn' || m.st === 'intro') return false; const dx = m.x - x0, dz = m.z - z0, along = dx * fx2 + dz * fz2, side = Math.abs(dx * fz2 - dz * fx2);
          return along > -1 && along < len + m.sc * 0.6 && side < w / 2 + m.sc * 0.7; }); };
      // area abilities smash crates too
      if (sp.k === 'arc') hitProps(inst, p, p.x, p.z, sp.r, yaw, sp.arc); else if (sp.k === 'spin' || sp.k === 'nova') hitProps(inst, p, p.x, p.z, sp.r);
      else if ((sp.k === 'leap' || sp.k === 'proj' || sp.k === 'meteor' || sp.k === 'zone' || sp.k === 'shower') && Math.hypot(x - p.x, z - p.z) < (sp.range || sp.dist || 8) + 3) inst.sched.push({ at: t + (sp.delay || 0.4), fn: () => hitProps(inst, p, x, z, sp.r) });
      switch (sp.k) {
        case 'arc': case 'single': { let n = 0;
          if (sp.k === 'single') { const m = inst.mobs.find(q => q.uid === (a.targets || [])[0]); if (m && m.hp > 0 && Math.hypot(m.x - p.x, m.z - p.z) - m.sc < sp.r + 2.5) { damageMob(inst, m, AP * sp.mult * (m.hp < m.max * (sp.lowAt || 0.3) ? sp.low : 1), p, o0); n = 1; } }
          else n = hitList(inst, p, a.targets, p.x, p.z, sp.r, sp.mult * AP / p.ap, { kb: 2.5, abil: 1, sc: SC }); ev(inst, fx); return { ok: true, n }; }
        case 'spin': for (let k = 0; k < sp.ticks; k++) inst.sched.push({ at: t + k * sp.dur / sp.ticks, fn: () => { if (p.dead) return; for (const m of inR(p.x, p.z, sp.r)) { if (adds.includes('pull') && m.kind !== 'boss') { const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz) || 1; if (d > 1.8) { m.x += dx / d * 0.7; m.z += dz / d * 0.7; } } damageMob(inst, m, AP * sp.mult, p, { kb: adds.includes('pull') ? 0 : 0.8, abil: 1, sc: SC }); } } });
          ev(inst, Object.assign(fx, { dur: sp.dur, r: sp.r })); return { ok: true };
        case 'nova': for (const m of inR(p.x, p.z, sp.r)) damageMob(inst, m, AP * sp.mult, p, { freeze: sp.freeze, stun: sp.stun, kb: sp.stun ? 1.5 : 0, abil: 1, sc: SC }); ev(inst, Object.assign(fx, { r: sp.r }));
          if (adds.includes('echo')) inst.sched.push({ at: t + 1, fn: () => { if (p.dead) return; for (const m of inR(p.x, p.z, sp.r)) damageMob(inst, m, AP * sp.mult * 0.6, p, { stun: sp.stun ? 0.5 : 0, abil: 1, sc: SC }); ev(inst, Object.assign({}, fx, { x: +p.x.toFixed(1), z: +p.z.toFixed(1), r: sp.r })); } }); return { ok: true };
        case 'leap': { if (!inReach(p, x, z, sp.dist + 2)) return { ok: false }; p.burstT = t; inst.sched.push({ at: t + 0.45, fn: () => { for (const m of inR(x, z, sp.r)) damageMob(inst, m, AP * sp.mult, p, { stun: sp.stun, kb: 2, kx: x, kz: z, abil: 1, sc: SC }); } });
          p.iframe = Math.max(p.iframe, t + 0.45); ev(inst, fx); return { ok: true }; }
        case 'dash': { // charge along yaw: everything you pass through is hit and stunned
          p.burstT = t; p.iframe = Math.max(p.iframe, t + 0.35); const hit = inLine(p.x, p.z, yaw, sp.dist, sp.w);
          for (const m of hit) damageMob(inst, m, AP * sp.mult, p, { stun: sp.stun, kb: 1.2, abil: 1, sc: SC }); ev(inst, Object.assign(fx, { dist: sp.dist })); return { ok: true, n: hit.length }; }
        case 'line': { const hit = inLine(p.x, p.z, yaw, sp.len, sp.w); inst.sched.push({ at: t + 0.12, fn: () => { for (const m of hit) damageMob(inst, m, AP * sp.mult, p, { freeze: sp.freeze, kb: 1.5, abil: 1, sc: SC }); } });
          ev(inst, Object.assign(fx, { len: sp.len, w: sp.w })); return { ok: true, n: hit.length }; }
        case 'buff': for (const q of alive(inst)) if (Math.hypot(q.x - p.x, q.z - p.z) < sp.r) { q.buff = t + sp.dur; } ev(inst, Object.assign(fx, { dur: sp.dur })); return { ok: true };
        case 'rage': p.rage = t + sp.dur; p.rageSpd = sp.spd; p.rageDmg = sp.dmg; ev(inst, Object.assign(fx, { dur: sp.dur })); return { ok: true };
        case 'shield': p.shield = t + sp.dur; ev(inst, Object.assign(fx, { dur: sp.dur })); return { ok: true };
        case 'proj': { if (!inReach(p, x, z, sp.range + 1)) return { ok: false }; const travel = Math.hypot(x - p.x, z - p.z) / 26;
          inst.sched.push({ at: t + travel, fn: () => { for (const m of inR(x, z, sp.r)) damageMob(inst, m, AP * sp.mult, p, { kb: 2, kx: x, kz: z, abil: 1, sc: SC }); } }); ev(inst, fx); return { ok: true }; }
        case 'missiles': { const list = (a.targets || []).slice(0, 6); if (!list.length) { const m = nearestMob(inst, p.x, p.z, sp.range); if (m) list.push(m.uid); }
          for (let k = 0; k < sp.count; k++) { const u = list[k % Math.max(1, list.length)]; inst.sched.push({ at: t + 0.25 + k * 0.08, fn: () => { const m = inst.mobs.find(q => q.uid === u); if (m && m.hp > 0 && Math.hypot(m.x - p.x, m.z - p.z) < sp.range + 6) damageMob(inst, m, AP * sp.mult, p, o0); } }); }
          ev(inst, Object.assign(fx, { tg: list })); return { ok: true }; }
        case 'chain': { // jumps to the next closest slime that has not been hit yet
          let m = inst.mobs.find(q => q.uid === (a.targets || [])[0] && q.hp > 0) || nearestMob(inst, p.x, p.z, sp.range); if (!m || Math.hypot(m.x - p.x, m.z - p.z) > sp.range + 4) return { ok: false };
          const pts = [[+p.x.toFixed(1), +p.z.toFixed(1)]], seen = new Set(); let mult = sp.mult;
          for (let k = 0; k < sp.jumps && m; k++) { seen.add(m.uid); pts.push([+m.x.toFixed(1), +m.z.toFixed(1)]); damageMob(inst, m, AP * mult, p, { stun: 0.25, abil: 1, sc: SC }); mult *= sp.fall;
            let best = null, bd = sp.hop; for (const q of inst.mobs) { if (q.hp <= 0 || seen.has(q.uid) || q.st === 'spawn' || q.st === 'intro') continue; const d = Math.hypot(q.x - m.x, q.z - m.z) - q.sc * 0.8; if (d < bd) { bd = d; best = q; } } m = best; }
          ev(inst, Object.assign(fx, { pts })); return { ok: true, n: pts.length - 1 }; }
        case 'zone': { // a damaging area that stays (fire, thorns, blizzard)
          if (!inReach(p, x, z, sp.range + 1)) return { ok: false };
          if (sp.root) for (const m of inR(x, z, sp.r)) m.frz = Math.max(m.frz, t + sp.root * (m.kind === 'boss' ? 0.3 : 1));
          inst.zones.push({ x, z, r: sp.r, dmg: AP * sp.mult, every: sp.every, freeze: sp.freeze, end: t + sp.dur, next: t + 0.2, owner: p.id });
          ev(inst, Object.assign(fx, { dur: sp.dur, r: sp.r })); return { ok: true }; }
        case 'pull': { // drag slimes in; Chains of War pulls to you instantly, Black Hole / Void Rift pull to a point then explode
          if (sp.self) { for (const m of inR(p.x, p.z, sp.r)) { if (m.kind !== 'boss') { const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz) || 1, keep = 1.6 + m.sc * 0.8; if (d > keep) { m.x = p.x + dx / d * keep; m.z = p.z + dz / d * keep; } }
              damageMob(inst, m, AP * sp.mult, p, { stun: sp.stun, abil: 1, sc: SC }); } ev(inst, Object.assign(fx, { r: sp.r, x: +p.x.toFixed(1), z: +p.z.toFixed(1) })); return { ok: true }; }
          if (!inReach(p, x, z, sp.range + 1)) return { ok: false };
          for (const m of inR(x, z, sp.r)) if (m.kind !== 'boss') m.pull = { x, z, until: t + sp.delay };
          inst.sched.push({ at: t + sp.delay, fn: () => { for (const m of inR(x, z, sp.r * 0.6)) damageMob(inst, m, AP * sp.mult, p, { kb: 3, kx: x, kz: z, abil: 1, sc: SC }); ev(inst, { k: 'boom', x: +x.toFixed(1), z: +z.toFixed(1), r: sp.r * 0.6 }); } });
          ev(inst, Object.assign(fx, { r: sp.r, delay: sp.delay })); return { ok: true }; }
        case 'summon': { // a turret (or your glitched clone) that shoots the nearest slime
          if (!inReach(p, x, z, 6)) return { ok: false }; inst.summons = inst.summons || []; inst.summons.push({ x, z, dmg: AP * sp.mult, every: sp.every, range: sp.range, end: t + sp.dur, next: t + 0.4, owner: p.id, id: sp.id });
          ev(inst, Object.assign(fx, { dur: sp.dur })); return { ok: true }; }
        case 'mark': { if (!inReach(p, x, z, sp.range + 1)) return { ok: false }; const hit = inR(x, z, sp.r);
          for (const m of hit) { m.mark = t + sp.dur; m.markAmp = sp.amp; damageMob(inst, m, AP * sp.mult, p, o0); } ev(inst, Object.assign(fx, { tg: hit.map(m => m.uid), dur: sp.dur, r: sp.r })); return { ok: true, n: hit.length }; }
        case 'shower': { if (!inReach(p, x, z, sp.range + 1)) return { ok: false };
          for (let k = 0; k < sp.strikes; k++) { const at = t + 0.5 + k * sp.dur / sp.strikes, ang = inst.rng() * TAU, rr = Math.sqrt(inst.rng()) * sp.r, sx = x + Math.cos(ang) * rr, sz = z + Math.sin(ang) * rr;
            inst.sched.push({ at, fn: () => { ev(inst, { k: 'strike', x: +sx.toFixed(1), z: +sz.toFixed(1), r: sp.sr, by: p.id, s: sp.id }); for (const m of inR(sx, sz, sp.sr)) damageMob(inst, m, AP * sp.mult, p, { kb: 1.5, kx: sx, kz: sz, abil: 1, sc: SC }); } }); }
          ev(inst, Object.assign(fx, { r: sp.r, dur: sp.dur })); return { ok: true }; }
        case 'heal': if (!inReach(p, x, z, 4)) return { ok: false }; inst.zones.push({ x, z, r: sp.r, heal: sp.heal, end: t + sp.dur, next: t }); ev(inst, Object.assign(fx, { dur: sp.dur, r: sp.r })); return { ok: true };
        case 'meteor': { if (!inReach(p, x, z, sp.range + 1)) return { ok: false }; inst.sched.push({ at: t + sp.delay, fn: () => { for (const m of inR(x, z, sp.r)) damageMob(inst, m, AP * sp.mult, p, { kb: 3, kx: x, kz: z, abil: 1, sc: SC }); } });
          ev(inst, Object.assign(fx, { delay: sp.delay, r: sp.r })); return { ok: true }; }
        case 'blink': p.iframe = Math.max(p.iframe, t + 0.4); p.burstT = t; if (sp.crit) p.nextCrit = true; ev(inst, fx); return { ok: true };
        case 'stealth': p.stealth = t + sp.dur; p.stealthAmp = sp.amp; p.burstT = t; ev(inst, Object.assign(fx, { dur: sp.dur })); ev(inst, { k: 'stealth', who: p.id, on: 1, dur: sp.dur }); return { ok: true };
        case 'aura': for (const q of alive(inst)) if (Math.hypot(q.x - p.x, q.z - p.z) < sp.r) { q.auraT = t + sp.dur; q.auraBuff = sp.buff; q.auraRed = sp.red; } ev(inst, Object.assign(fx, { dur: sp.dur, r: sp.r })); return { ok: true };
      }
    }
    return { ok: false };
  };
  // ---------------------------------------------------------------- slime AI
  function roomOf(inst, m) { return inst.lay.rooms[m.room] || inst.lay.rooms[0]; }
  // bosses, mini-bosses and what they summon never leave their arena; everything else hunts you through the dungeon
  const stays = (inst, m) => inst.mode !== 'dungeon' || m.kind === 'boss' || m.kind === 'mini' || m.minion || m.arena;
  function keepInRoom(inst, m) { const q = roomOf(inst, m), r = m.sc * 0.7 + ROOM_PAD;
    if (q.round) { const dx = m.x - q.x, dz = m.z - q.z, d = Math.hypot(dx, dz), lim = q.round - r; if (d > lim) { m.x = q.x + dx / d * lim; m.z = q.z + dz / d * lim; } return; }
    m.x = clamp(m.x, q.x - q.w / 2 + r, q.x + q.w / 2 - r); m.z = clamp(m.z, q.z - q.d / 2 + r, q.z + q.d / 2 - r); }
  // the halls a slime may use: open gates (and the hall into its own sealed room)
  const mobHall = (inst, m) => h => W.hallOpen(inst.lay, inst.rooms, h) || (inst.lay.halls[h].b === m.room && inst.rooms[inst.lay.halls[h].a].st === 'clear');
  function keepOnFloor(inst, m) {
    if (stays(inst, m)) { keepInRoom(inst, m); } else {
      const lay = inst.lay, rad = m.sc * 0.7, ok = mobHall(inst, m);
      if (!W.floorOk(lay, m.x, m.z, rad, ok)) { if (W.floorOk(lay, m.x, m.oz, rad, ok)) m.z = m.oz; else if (W.floorOk(lay, m.ox, m.z, rad, ok)) m.x = m.ox; else if (W.floorOk(lay, m.ox, m.oz, rad, ok)) { m.x = m.ox; m.z = m.oz; } } }
    // round pillars, trees and stones are solid
    if (inst.mode === 'dungeon') for (const o of inst.lay.obst) { const dx = m.x - o.x, dz = m.z - o.z; if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue; const d = Math.hypot(dx, dz), mm = o.r + m.sc * 0.6; if (d < mm && d > 1e-3) { m.x = o.x + dx / d * mm; m.z = o.z + dz / d * mm; } }
  }
  // who a slime goes for: arena slimes only see players in their arena; hunters see everyone alive in the dungeon
  function targetFor(inst, m) { const tf = targetFor0(inst, m); if (tf && inst.t < (tf.stealth || 0) && m.kind !== 'boss') { const others = alive(inst).filter(q => q !== tf && inst.t >= (q.stealth || 0)); return others.length ? others.sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z))[0] : null; } return tf; }
  function targetFor0(inst, m) {
    let best = null, bd = 1e9; const arenaOnly = stays(inst, m) && inst.mode === 'dungeon', q = roomOf(inst, m);
    for (const p of inst.players.values()) { if (p.dead || p.out) continue;
      if (inst.mode !== 'dungeon') { if (!(q.round ? Math.hypot(p.x - q.x, p.z - q.z) < q.round + 4 : true)) continue; }
      else if (arenaOnly && !inArena(inst, m.room, p.x, p.z)) continue;
      const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  SD.targetFor = targetFor;
  // where to walk to reach (tx,tz): straight there in the same room, else the next doorway on the way
  function steer(inst, m, tx, tz, ta) {
    if (stays(inst, m)) return [tx, tz]; const lay = inst.lay, a0 = W.where(inst.i, m.x, m.z, 0); if (a0 >= 0) m.area = a0; const a = m.area === undefined ? m.room : m.area;
    let b = W.where(inst.i, tx, tz, 0); if (b < 0) b = ta === undefined ? a : ta; if (a === b) return [tx, tz];
    const e = W.nav(lay).next[a] && W.nav(lay).next[a][b]; return e ? [e.x, e.z] : [tx, tz];
  }
  const turn = (m, x, z, k) => { const a = Math.atan2(x - m.x, z - m.z); m.yaw += Math.atan2(Math.sin(a - m.yaw), Math.cos(a - m.yaw)) * Math.min(1, k); };
  function walk(inst, m, tx, tz, spd, dt, ta) { const [wx, wz] = steer(inst, m, tx, tz, ta), dx = wx - m.x, dz = wz - m.z, d = Math.hypot(dx, dz); turn(m, wx, wz, dt * 8); if (d > 0.1) { const st = Math.min(d, spd * dt); m.x += dx / d * st; m.z += dz / d * st; } }
  // ---------------------------------------------------------------- how each kind of slime fights (C.BEH). Return true when the move took this tick.
  const bSpd = (m, k) => ((m.kind === 'mob' ? C.CHASE.SPEED : C.CHASE.ELITE) / Math.sqrt(m.sc) + 1.2) * (k || 1);
  const inRoomQ = (q, x, z, pad) => q.round ? Math.hypot(x - q.x, z - q.z) < q.round - pad : Math.abs(x - q.x) < q.w / 2 - pad && Math.abs(z - q.z) < q.d / 2 - pad;
  const free = m => m.st === 'chase' || m.st === 'idle';
  function backOff(inst, m, p, d, k, dt) { walk(inst, m, m.x + (m.x - p.x) / d * 3, m.z + (m.z - p.z) / d * 3, bSpd(m, k) * 0.7, dt); turn(m, p.x, p.z, 1); m.st = 'chase'; }
  const BEHAV = {
    spit(inst, m, p, dt, k) { const B = C.BEH.spit, d = Math.hypot(p.x - m.x, p.z - m.z) || 0.01;
      if (m.st === 'aim') { m.warn = Math.min(1, m.t / B.wind); turn(m, p.x, p.z, 1);
        if (m.t >= B.wind) { m.st = 'recover'; m.t = 0; m.warn = 0; m.cd = inst.t + B.cd; ev(inst, { k: 'shot', x0: R1(m.x), z0: R1(m.z), x: R1(p.x), z: R1(p.z), dur: B.travel, u: m.uid }); tele(inst, m, { s: 'c', x: p.x, z: p.z, r: B.r }, B.travel, B.mult); } return true; }
      if (!free(m)) return false;
      if (d < B.range && d > 2.2 && inst.t > (m.cd || 0) && m.t > 0.4) { m.st = 'aim'; m.t = 0; return true; }
      if (d < B.keep && d > 1.8) { backOff(inst, m, p, d, k, dt); return true; } return false; },
    charge(inst, m, p, dt, k) { const B = C.BEH.charge, d = Math.hypot(p.x - m.x, p.z - m.z);
      if (m.st === 'aim') { m.warn = Math.min(1, m.t / B.wind); if (m.t >= B.wind) { m.st = 'dash'; m.t = 0; m.lx = m.x; m.lz = m.z; } return true; }
      if (m.st === 'dash') { const kk = Math.min(1, m.t / 0.28); m.x = m.lx + (m.tx - m.lx) * kk; m.z = m.lz + (m.tz - m.lz) * kk; if (kk >= 1) { m.st = 'recover'; m.t = 0; m.warn = 0; m.cd = inst.t + B.cd; ev(inst, { k: 'land', u: m.uid }); } return true; }
      if (!free(m)) return false; const q = roomOf(inst, m);
      if (d < B.near && d > 2.5 && inst.t > (m.cd || 0) && m.t > 0.4 && inRoomQ(q, m.x, m.z, 1.5)) { turn(m, p.x, p.z, 1); const yaw = m.yaw, len = Math.min(B.dist, reachIn(q, m.x, m.z, yaw, B.dist)), fx = Math.sin(yaw), fz = Math.cos(yaw);
        m.tx = m.x + fx * len; m.tz = m.z + fz * len; m.st = 'aim'; m.t = 0; tele(inst, m, { s: 'r', x: m.x + fx * len / 2, z: m.z + fz * len / 2, yaw, l: len / 2, w: B.w + m.sc * 0.25 }, B.wind, B.mult); return true; }
      return false; },
    fly(inst, m, p, dt, k) { const B = C.BEH.fly, d = Math.hypot(p.x - m.x, p.z - m.z);
      if (m.st === 'aim') { m.warn = Math.min(1, m.t / B.wind); m.y = B.hover + m.warn * 0.6; if (m.t >= B.wind) { m.st = 'dive'; m.t = 0; m.lx = m.x; m.lz = m.z; } return true; }
      if (m.st === 'dive') { const kk = Math.min(1, m.t / 0.25); m.x = m.lx + (m.tx - m.lx) * kk; m.z = m.lz + (m.tz - m.lz) * kk; m.y = (B.hover + 0.6) * (1 - kk); if (kk >= 1) { m.st = 'recover'; m.t = 0; m.warn = 0; ev(inst, { k: 'land', u: m.uid }); } return true; }
      if (m.st === 'recover') { m.y = Math.min(B.hover, m.y + dt * 3); return false; }
      if (!free(m)) return false; m.y += (B.hover - m.y) * Math.min(1, dt * 3);
      if (d < 3 + m.sc && m.t > 0.35) { m.st = 'aim'; m.t = 0; m.tx = p.x; m.tz = p.z; turn(m, p.x, p.z, 1); tele(inst, m, { s: 'c', x: p.x, z: p.z, r: B.r }, B.wind + 0.25, B.mult); return true; }
      walk(inst, m, p.x, p.z, bSpd(m, k) * 1.1, dt, p.area); m.st = 'chase'; return true; },
    burrow(inst, m, p, dt, k) { const B = C.BEH.burrow, d = Math.hypot(p.x - m.x, p.z - m.z);
      if (m.st === 'under') { walk(inst, m, p.x, p.z, bSpd(m, k) * B.speed, dt, p.area); m.y = -1;
        if (d < 1.2 || m.t > B.under) { m.st = 'aim'; m.t = 0; tele(inst, m, { s: 'c', x: m.x, z: m.z, r: B.r }, B.wind, B.mult); } return true; }
      if (m.st === 'aim') { m.warn = Math.min(1, m.t / B.wind); m.y = -1; if (m.t >= B.wind) { m.st = 'recover'; m.t = 0; m.y = 0; m.warn = 0; m.cd = inst.t + B.cd; ev(inst, { k: 'land', u: m.uid }); } return true; }
      if (!free(m)) return false;
      if (d > 3.5 && inst.t > (m.cd || 0) && m.t > 0.6) { m.st = 'under'; m.t = 0; m.y = -1; return true; } return false; },
    heal(inst, m, p, dt, k) { const B = C.BEH.heal, d = Math.hypot(p.x - m.x, p.z - m.z) || 0.01; m.hT = (m.hT === undefined ? B.every : m.hT) - dt;
      if (m.hT <= 0) { m.hT = B.every; let best = null; for (const q of inst.mobs) if (q !== m && q.hp > 0 && q.hp < q.max && q.kind !== 'boss' && Math.hypot(q.x - m.x, q.z - m.z) < B.r && (!best || q.hp / q.max < best.hp / best.max)) best = q;
        if (best) { best.hp = Math.min(best.max, best.hp + Math.round(best.max * B.pct)); ev(inst, { k: 'zap', x0: R1(m.x), z0: R1(m.z), u: best.uid, s: 'bheal' }); ev(inst, { k: 'mheal', u: best.uid, hp: best.hp }); } }
      if (free(m) && d < B.keep && d > 1.8) { backOff(inst, m, p, d, k, dt); return true; } return false; },
    summon(inst, m, p, dt, k) { const B = C.BEH.summon, d = Math.hypot(p.x - m.x, p.z - m.z) || 0.01; m.sT = (m.sT === undefined ? B.every * 0.5 : m.sT) - dt;
      if (m.sT <= 0 && free(m)) { m.sT = B.every; const kids = inst.mobs.filter(q => q.owner === m.uid && q.hp > 0).length, dd = C.DUNGEONS[inst.i], id0 = dd ? dd.mobs.find(x => x !== m.id && !C.MOBS[x].beh) || dd.mobs[0] : m.id;
        if (kids < B.max && inst.mobs.length < 90) { const a = inst.rng() * TAU, q2 = spawnMob(inst, roomOf(inst, m), id0, 'mob', m.x + Math.sin(a) * 1.6, m.z + Math.cos(a) * 1.6, 0.4);
          q2.owner = m.uid; q2.child = true; q2.beh = null; q2.sc *= B.sc; q2.max = q2.hp = Math.max(1, Math.round(q2.max * B.hp)); ev(inst, { k: 'mhp', u: q2.uid, hp: q2.hp, max: q2.max }); ev(inst, { k: 'msc', u: q2.uid, sc: +q2.sc.toFixed(2) }); ev(inst, { k: 'zap', x0: R1(m.x), z0: R1(m.z), u: q2.uid, s: 'summon' }); } }
      if (free(m) && d < B.keep && d > 1.8) { backOff(inst, m, p, d, k, dt); return true; } return false; },
    bomb(inst, m, p, dt, k) { const B = C.BEH.bomb, d = Math.hypot(p.x - m.x, p.z - m.z);
      if (m.st === 'fuse') { m.warn = Math.min(1, m.t / B.fuse); if (m.t >= B.fuse + 0.05) { m.hp = 0; m.deadAt = inst.t; ev(inst, { k: 'kill', u: m.uid, by: 0, fade: 1 }); } return true; }
      if (!free(m)) return false;
      if (d < 2.2 && m.t > 0.3) { m.st = 'fuse'; m.t = 0; tele(inst, m, { s: 'c', x: m.x, z: m.z, r: B.r }, B.fuse, B.mult); return true; }
      walk(inst, m, p.x, p.z, bSpd(m, k) * B.speed, dt, p.area); m.st = 'chase'; return true; },
    blink(inst, m, p, dt, k) { const B = C.BEH.blink, d = Math.hypot(p.x - m.x, p.z - m.z);
      if (m.st === 'out') { m.warn = Math.min(1, m.t / B.out); if (m.t >= B.out) { const q = roomOf(inst, m); for (let n = 0; n < 8; n++) { const a = inst.rng() * TAU, x = p.x + Math.sin(a) * B.dist, z = p.z + Math.cos(a) * B.dist; if (inst.mode !== 'dungeon' || W.where(inst.i, x, z, 0.8) >= 0) { m.x = x; m.z = z; break; } }
          turn(m, p.x, p.z, 1); m.st = 'wind'; m.t = 0; m.tx = p.x; m.tz = p.z; m.target = p.id; ev(inst, { k: 'zap', x0: R1(m.x), z0: R1(m.z), u: m.uid, s: 'blink' }); } return true; }
      if (!free(m)) return false; m.bT = (m.bT === undefined ? B.every * 0.5 : m.bT) - dt;
      if (m.bT <= 0 && d > 3 && d < 16) { m.bT = B.every; m.st = 'out'; m.t = 0; return true; } return false; }
  };
  function mobTick(inst, m, dt) {
    m.t += dt; if (m.st === 'spawn') { if (m.t >= 0.6) { m.st = 'chase'; m.t = 0; } return; }
    if (m.kind === 'heart') return;   // the boss's heart just sits there and pulses
    if (m.pull && inst.t < m.pull.until) { const dx = m.pull.x - m.x, dz = m.pull.z - m.z, d = Math.hypot(dx, dz); m.warn = 0; m.y = 0; if (m.st === 'wind' || m.st === 'leap') { m.st = 'recover'; m.t = 0; }
      if (d > 0.6) { const st = Math.min(d - 0.5, 11 * dt); m.x += dx / d * st; m.z += dz / d * st; } return; }
    if (inst.t < m.stun || inst.t < m.frz) { m.warn = 0; if (m.st === 'wind' || m.st === 'leap') { m.st = 'recover'; m.t = 0; m.y = 0; } return; }
    const p = targetFor(inst, m);
    // hunting orbs: float after you, burst when they reach you, fade after a while
    if (m.kind === 'orb') { if (inst.t > m.life) { m.hp = 0; m.deadAt = inst.t; ev(inst, { k: 'kill', u: m.uid, by: 0, fade: 1 }); return; }
      if (!p) return; walk(inst, m, p.x, p.z, C.BOSS.ORB_SPEED, dt); m.y = 0.9 + Math.sin(inst.t * 4 + m.uid) * 0.2;
      if (Math.hypot(p.x - m.x, p.z - m.z) < 1.5 && p.y < 2) { hurtPlayer(inst, p, m.dmg, m); m.hp = 0; m.deadAt = inst.t; ev(inst, { k: 'boom', x: +m.x.toFixed(1), z: +m.z.toFixed(1), r: 1.8 }); ev(inst, { k: 'kill', u: m.uid, by: 0, fade: 1 }); } return; }
    // a healer keeps its boss alive until you kill it
    if (m.healer) { m.healT = (m.healT === undefined ? C.BOSS.HEAL_EVERY : m.healT) - dt; if (m.healT <= 0) { m.healT = C.BOSS.HEAL_EVERY; const b = inst.mobs.find(q => q.uid === m.healer && q.hp > 0);
      if (b && b.hp < b.max) { b.hp = Math.min(b.max, b.hp + Math.round(b.max * C.BOSS.HEAL)); ev(inst, { k: 'zap', x0: +m.x.toFixed(1), z0: +m.z.toFixed(1), u: b.uid, s: 'bheal' }); ev(inst, { k: 'mheal', u: b.uid, hp: b.hp }); } } }
    if (m.kind === 'mini' && m.phase === 1 && m.hp < m.max * 0.5) { m.phase = 2; ev(inst, { k: 'bossPhase', u: m.uid, mini: 1 }); }
    // mini-bosses: a special move every few seconds (they stand still while they cast)
    if (m.kind === 'mini' && m.kit && inst.mode === 'dungeon') { if (inst.t < m.busy) { if (p) turn(m, p.x, p.z, dt * 4); return; }
      hugged(inst, m, dt, true); if (hugged(inst, m, dt) && p && m.st === 'chase') { m.hug = 0; cast(inst, m, p, 'stomp', 1); return; }
      m.atkT -= dt; if (m.atkT <= 0 && p && m.st === 'chase') { m.atkT = C.MINI_EVERY[m.phase - 1] || 4; const list = m.phase >= 2 ? m.kit.p2 : m.kit.p1; cast(inst, m, p, list[m.atk++ % list.length], m.phase >= 2 ? 0.85 : 1); return; } }
    // elite modifiers (fast, frenzied below half health) and how this slime fights
    const EM = C.ELITE_MODS, fr = m.mod === 'frenzy' && m.hp < m.max * EM.frenzy.at; if (fr && !m.fren) { m.fren = 1; ev(inst, { k: 'mfrenzy', u: m.uid }); }
    const spdK = (m.mod === 'fast' ? EM.fast.spd : 1) * (fr ? EM.frenzy.spd : 1) * (m.beh === 'shield' ? C.BEH.shield.slow : 1), windK = (m.mod === 'fast' ? EM.fast.wind : 1) * (fr ? EM.frenzy.wind : 1);
    if (m.beh && p && BEHAV[m.beh] && inst.mode !== 'raid' && BEHAV[m.beh](inst, m, p, dt, spdK)) return;
    const spd = bSpd(m, spdK);
    switch (m.st) {
      case 'idle': case 'chase': case 'home': {
        if (!p) { // nobody to hunt: after a while, walk home and heal up
          m.lost += dt; if (m.lost < C.CHASE.RESET || stays(inst, m)) { m.st = 'idle'; return; }
          m.st = 'home'; const q = roomOf(inst, m); walk(inst, m, m.hx, m.hz, spd, dt, q.i); if (Math.hypot(m.x - m.hx, m.z - m.hz) < 2) { m.hp = m.max; m.st = 'idle'; } return; }
        m.lost = 0; m.st = 'chase';
        const d = Math.hypot(p.x - m.x, p.z - m.z), reach = 2.2 + m.sc * 0.9;
        if (d < reach && m.t > 0.35) { turn(m, p.x, p.z, 1); m.st = 'wind'; m.t = 0; m.tx = p.x; m.tz = p.z; m.target = p.id; break; }
        walk(inst, m, p.x, p.z, spd, dt, p.area); break; }
      case 'wind': { const tel = (m.kind === 'mob' ? 0.65 : 0.8) * windK; m.warn = Math.min(1, m.t / tel); const tp = inst.players.get(m.target);
        if (tp && !tp.dead) { m.tx += (tp.x - m.tx) * Math.min(1, dt * 2.5); m.tz += (tp.z - m.tz) * Math.min(1, dt * 2.5); }
        if (m.t >= tel) { m.st = 'leap'; m.t = 0; m.lx = m.x; m.lz = m.z; const d2 = Math.hypot(m.tx - m.x, m.tz - m.z), lim = 2.6 + m.sc; if (d2 > lim) { m.tx = m.x + (m.tx - m.x) / d2 * lim; m.tz = m.z + (m.tz - m.z) / d2 * lim; } } break; }
      case 'leap': { const k = Math.min(1, m.t / 0.42); m.x = m.lx + (m.tx - m.lx) * k; m.z = m.lz + (m.tz - m.lz) * k; m.y = Math.sin(k * Math.PI) * (1.3 + m.sc * 0.4);
        if (k >= 1) { m.st = 'recover'; m.t = 0; m.y = 0; m.warn = 0; const hr = 1.9 + m.sc * 0.6;
          for (const q of inst.players.values()) if (!q.dead && Math.hypot(q.x - m.x, q.z - m.z) < hr && q.y < 1.6) hurtPlayer(inst, q, m.dmg, m); ev(inst, { k: 'land', u: m.uid }); }
        break; }
      case 'recover': if (m.t > (m.kind === 'mini' ? 0.6 : 0.75)) { m.st = 'chase'; m.t = 0; } break;
      default: m.st = 'chase';
    }
  }
  // ---------------------------------------------------------------- telegraphs: every hit from a boss is drawn on the floor first
  // shapes: c (circle x,z,r), r (rectangle: centre x,z, yaw, half length l, half width w), grid (tiles; '1' = danger), safe (everywhere in the arena except the green circles), pool (burns for a while)
  const R1 = v => +(+v).toFixed(1), R2 = v => +(+v).toFixed(2);
  function hits(inst, q, p) {
    switch (q.s) {
      case 'c': return Math.hypot(p.x - q.x, p.z - q.z) < q.r + 0.3;
      case 'r': { const fx = Math.sin(q.yaw), fz = Math.cos(q.yaw), dx = p.x - q.x, dz = p.z - q.z; return Math.abs(dx * fx + dz * fz) <= q.l + 0.3 && Math.abs(dx * fz - dz * fx) <= q.w + 0.4; }
      case 'grid': { const c = Math.floor((p.x - q.x0) / q.T), r = Math.floor((p.z - q.z0) / q.T); return c >= 0 && r >= 0 && c < q.nc && r < q.nr && q.bits[r * q.nc + c] === '1'; }
      case 'safe': return (q.room < 0 || inArena(inst, q.room, p.x, p.z) || inst.mode !== 'dungeon') && !q.safe.some(z => Math.hypot(p.x - z[0], p.z - z[1]) < z[2]);
    }
    return false;
  }
  SD.danger = (inst, x, z) => inst.tele.some(q => q.s !== 'pool' && hits(inst, q, { x, z })) || inst.bpools.some(q => inst.t > q.start - 0.6 && Math.hypot(x - q.x, z - q.z) < q.r + 0.5);
  function tele(inst, m, spec, dur, mult, o) {
    o = o || {}; const q = Object.assign({ end: inst.t + dur, mult, src: m }, spec); inst.tele.push(q);
    const e = { k: 'tele', s: q.s, dur: R2(dur) }; for (const k of ['x', 'z', 'r', 'l', 'w', 'yaw', 'x0', 'z0', 'T']) if (q[k] !== undefined) e[k] = R2(q[k]);
    if (q.s === 'grid') { e.nc = q.nc; e.nr = q.nr; e.bits = q.bits; } if (q.s === 'safe') { e.safe = q.safe.map(z => z.map(R1)); e.room = q.room; e.rd = q.rd; } ev(inst, e);
    inst.sched.push({ at: inst.t + dur, fn: () => { if (m.hp <= 0) return; for (const p of inst.players.values()) { if (p.dead || p.out) continue; if (q.s !== 'safe' && p.y > (q.s === 'c' ? 2.2 : 1.6)) continue; if (!hits(inst, q, p)) continue;
      const dmg = q.s === 'safe' ? Math.max(m.dmg * mult, p.max * C.BOSS.ONE_HIT) : m.dmg * mult; hurtPlayer(inst, p, dmg, Object.assign({ x: q.x === undefined ? m.x : q.x, z: q.z === undefined ? m.z : q.z }, m.uid ? { uid: m.uid, hp: m.hp, kind: m.kind, ref: m } : {}), { unblock: q.s === 'safe' }); }
      if (!o.quiet) ev(inst, { k: 'boom', x: R1(q.x === undefined ? m.x : q.x), z: R1(q.z === undefined ? m.z : q.z), r: q.r || q.w || 3, s: q.s }); } });
    return q;
  }
  SD.tele = tele;
  SD._spawn = (inst, room, id, kind, x, z) => { const m = spawnMob(inst, inst.lay.rooms[room], id, kind, x, z, 0); m.st = 'chase'; m.t = 1; return m; };   // tests
  // how far from (x,z) you can go along yaw before leaving the room (for charges and beams)
  function reachIn(q, x, z, yaw, max) { const fx = Math.sin(yaw), fz = Math.cos(yaw); let d = 0; while (d < max) { const nx = x + fx * (d + 1), nz = z + fz * (d + 1); if (q.round ? Math.hypot(nx - q.x, nz - q.z) > q.round - 1 : Math.abs(nx - q.x) > q.w / 2 - 1 || Math.abs(nz - q.z) > q.d / 2 - 1) break; d++; } return Math.max(4, d); }
  const sizeOf = q => q.round ? q.round * 2 : Math.max(q.w, q.d);
  function randIn(inst, q, m) { for (let k = 0; k < 20; k++) { const x = q.x + (inst.rng() - 0.5) * ((q.round ? q.round * 2 : q.w) - m * 2), z = q.z + (inst.rng() - 0.5) * ((q.round ? q.round * 2 : q.d) - m * 2); if (!q.round || Math.hypot(x - q.x, z - q.z) < q.round - m) return [x, z]; } return [q.x, q.z]; }
  const arenaPlayers = (inst, m) => { const q = roomOf(inst, m); return alive(inst).filter(p => inst.mode !== 'dungeon' || inArena(inst, q.i, p.x, p.z)); };
  // ---------------------------------------------------------------- the move library (bosses and mini-bosses). f < 1 = faster (enraged)
  const MOVE = {
    slam(inst, b, p, q, f) { const [mult, dur] = C.MOVES.slam, r = 3.6 + b.sc * 0.25; tele(inst, b, { s: 'c', x: p.x, z: p.z, r }, dur * f, mult); b.mv = { x0: b.x, z0: b.z, x1: p.x, z1: p.z, t0: inst.t + 0.45 * f, t1: inst.t + dur * f, hop: 4 + b.sc }; return dur * f + 0.35; },
    ring(inst, b, p, q, f) { inst.sched.push({ at: inst.t + 0.75 * f, fn: () => { if (b.hp <= 0) return; b.ring = { x: b.x, z: b.z, r: b.sc * 0.8, hit: {}, max: sizeOf(q) * 0.8 };
      ev(inst, { k: 'ring', x: R1(b.x), z: R1(b.z), r: b.sc * 0.8, sp: 10, max: sizeOf(q) * 0.8 }); } }); b.hopT = inst.t + 0.75 * f; return 1.5 * f; },
    barrage(inst, b, p, q, f) { const [mult, dur] = C.MOVES.barrage, list = arenaPlayers(inst, b); if (!list.length) list.push(p);
      list.forEach((tp, j) => { const n = j ? 3 : 7; for (let k = 0; k < n; k++) { const a = inst.rng() * TAU, r = k ? 1.5 + inst.rng() * 5 : 0, x = tp.x + Math.cos(a) * r, z = tp.z + Math.sin(a) * r, d = (dur + k * 0.08) * f;
        tele(inst, b, { s: 'c', x, z, r: 2.1 }, d, mult, { quiet: k > 0 }); ev(inst, { k: 'shot', x0: R1(b.x), z0: R1(b.z), x: R1(x), z: R1(z), dur: R2(d) }); } }); return 1.6 * f; },
    summon(inst, b, p, q, f) { const d = C.DUNGEONS[inst.i] || C.DUNGEONS[0], boss = b.kind === 'boss', n = boss ? (b.phase >= 2 ? 4 : 3) : 2;
      inst.sched.push({ at: inst.t + 0.8 * f, fn: () => { if (b.hp <= 0) return; for (let k = 0; k < n; k++) { const a = k / n * TAU + inst.rng(), m = spawnMob(inst, q, d.mobs[boss && k === 0 && b.kit && b.kit.healer ? 1 : 0], 'mob', b.x + Math.cos(a) * (b.sc + 2), b.z + Math.sin(a) * (b.sc + 2), 0.2);
          m.minion = true; m.owner = b.uid; if (boss && k === 0 && b.kit && b.kit.healer) { m.healer = b.uid; m.hp = m.max = m.max * 2; ev(inst, { k: 'healer', u: m.uid }); ev(inst, { k: 'mhp', u: m.uid, hp: m.hp, max: m.max }); } }
        if (b.phase === 3) { const a = inst.rng() * TAU, m = spawnMob(inst, q, d.elite, 'elite', b.x + Math.cos(a) * (b.sc + 3), b.z + Math.sin(a) * (b.sc + 3), 0.3); m.minion = true; m.owner = b.uid; } } });
      return 1.5 * f; },
    lines(inst, b, p, q, f) { const [mult, dur] = C.MOVES.lines, n = b.kind === 'boss' ? (b.phase >= 2 ? 5 : 4) : 3, y0 = Math.atan2(p.x - b.x, p.z - b.z), len = sizeOf(q);
      for (let k = 0; k < n; k++) { const yaw = y0 + (k - (n - 1) / 2) * 0.42, r0 = b.sc * 0.6, l = len / 2; tele(inst, b, { s: 'r', x: b.x + Math.sin(yaw) * (r0 + l), z: b.z + Math.cos(yaw) * (r0 + l), yaw, l, w: 1.3 }, dur * f, mult, { quiet: k > 0 }); }
      return dur * f + 0.3; },
    cross(inst, b, p, q, f) { const [mult, dur] = C.MOVES.cross, len = sizeOf(q), a0 = inst.rng() < 0.5 ? 0 : Math.PI / 4, waves = b.phase >= 2 ? 2 : 1;
      for (let w = 0; w < waves; w++) inst.sched.push({ at: inst.t + w * 0.95 * f, fn: () => { if (b.hp <= 0) return; for (let k = 0; k < 2; k++) tele(inst, b, { s: 'r', x: b.x, z: b.z, yaw: a0 + w * Math.PI / 4 + k * Math.PI / 2, l: len, w: 1.6 }, dur * f, mult, { quiet: k > 0 }); } });
      return (waves * 0.95 + dur) * f; },
    sweep(inst, b, p, q, f) { const [mult, dur] = C.MOVES.sweep, spokes = b.kind === 'boss' ? 3 : 2, steps = 6, r0 = SD.solidR(b) + 1.4, l = sizeOf(q) * 0.45, a0 = Math.atan2(p.x - b.x, p.z - b.z), sg = inst.rng() < 0.5 ? 1 : -1;
      for (let k = 0; k < steps; k++) inst.sched.push({ at: inst.t + k * 0.3 * f, fn: () => { if (b.hp <= 0) return; for (let j = 0; j < spokes; j++) { const yaw = a0 + sg * k * 0.4 + j * TAU / spokes;
        tele(inst, b, { s: 'r', x: b.x + Math.sin(yaw) * (r0 + l), z: b.z + Math.cos(yaw) * (r0 + l), yaw, l, w: 1.2 }, dur * f, mult, { quiet: true }); } } });
      return (steps * 0.3 + dur) * f + 0.2; },
    checker(inst, b, p, q, f) { const [mult, dur] = C.MOVES.checker, T = 5, W2 = q.round ? q.round * 2 : q.w, D2 = q.round ? q.round * 2 : q.d, nc = Math.max(2, Math.floor(W2 / T)), nr = Math.max(2, Math.floor(D2 / T)), x0 = q.x - nc * T / 2, z0 = q.z - nr * T / 2;
      let bits = ''; const cells = []; for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) { const cx = x0 + (c + 0.5) * T, cz = z0 + (r + 0.5) * T, inR = !q.round || Math.hypot(cx - q.x, cz - q.z) < q.round - 1; bits += inR ? '1' : '-'; if (inR) cells.push(r * nc + c); }
      const nSafe = Math.max(2, Math.round(cells.length * 0.2)); bits = bits.split(''); for (let k = 0; k < nSafe && cells.length; k++) bits[cells.splice(Math.floor(inst.rng() * cells.length), 1)[0]] = '0';
      tele(inst, b, { s: 'grid', x0, z0, T, nc, nr, bits: bits.join(''), x: q.x, z: q.z, r: 4 }, dur * f, mult); return dur * f + 0.4; },
    safe(inst, b, p, q, f) { const [mult, dur] = C.MOVES.safe, SZ = C.BOSS.SAFE, sp = [], R0 = SZ.R, inRoom = (x, z) => q.round ? Math.hypot(x - q.x, z - q.z) < q.round - R0 - 1 : Math.abs(x - q.x) < q.w / 2 - R0 - 1 && Math.abs(z - q.z) < q.d / 2 - R0 - 1;
      // Update 7 (final): one green circle a short run from every slayer (SAFE.NEAR..FAR metres away, never on the boss), at least two, and SAFE.T seconds to reach them
      const who = alive(inst).filter(o => inst.mode !== 'dungeon' || inArena(inst, q.i, o.x, o.z)); if (!who.length) who.push(p);
      for (const o of who.concat(who)) { if (sp.length >= Math.max(2, who.length)) break; for (let k = 0; k < 30; k++) { const a = inst.rng() * TAU, d = SZ.NEAR + inst.rng() * (SZ.FAR - SZ.NEAR), x = o.x + Math.sin(a) * d, z = o.z + Math.cos(a) * d;
        if (inRoom(x, z) && Math.hypot(x - b.x, z - b.z) > b.sc + R0 + 2 && sp.every(c => Math.hypot(c[0] - x, c[1] - z) > R0 * 2 + 1)) { sp.push([x, z, R0]); break; } } }
      for (let k = 0; k < 40 && sp.length < 2; k++) { const [x, z] = randIn(inst, q, R0 + 2); if (Math.hypot(x - b.x, z - b.z) > b.sc + R0 + 2 && sp.every(c => Math.hypot(c[0] - x, c[1] - z) > R0 * 2 + 1)) sp.push([x, z, R0]); }
      if (!sp.length) sp.push([q.x, q.z, R0]); const T = Math.max(SZ.T, dur * f);
      tele(inst, b, { s: 'safe', x: q.x, z: q.z, r: sizeOf(q) / 2, w: q.round || q.w / 2, l: q.round || q.d / 2, rd: q.round ? 1 : 0, safe: sp, room: inst.mode === 'dungeon' ? q.i : -1 }, T, mult); return T + 0.6; },
    charge(inst, b, p, q, f) { const [mult, dur] = C.MOVES.charge, yaw = Math.atan2(p.x - b.x, p.z - b.z), len = Math.min(30, reachIn(q, b.x, b.z, yaw, 30)), l = len / 2, w = b.sc * 0.6 + 0.7;
      tele(inst, b, { s: 'r', x: b.x + Math.sin(yaw) * l, z: b.z + Math.cos(yaw) * l, yaw, l, w }, dur * f, mult); b.yaw = yaw;
      b.mv = { x0: b.x, z0: b.z, x1: b.x + Math.sin(yaw) * Math.max(0, len - b.sc), z1: b.z + Math.cos(yaw) * Math.max(0, len - b.sc), t0: inst.t + dur * f - 0.05, t1: inst.t + dur * f + 0.3, hop: 0 }; return dur * f + 0.5; },
    teleport(inst, b, p, q, f) { const [mult, dur] = C.MOVES.teleport, r = 3.8 + b.sc * 0.2; let x = p.x, z = p.z; if (q.round) { const dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz), lim = q.round - b.sc; if (d > lim) { x = q.x + dx / d * lim; z = q.z + dz / d * lim; } }
      else { x = clamp(x, q.x - q.w / 2 + b.sc, q.x + q.w / 2 - b.sc); z = clamp(z, q.z - q.d / 2 + b.sc, q.z + q.d / 2 - b.sc); }
      b.vanish = { until: inst.t + dur * f, x, z }; tele(inst, b, { s: 'c', x, z, r }, dur * f, mult); return dur * f + 0.5; },
    orbs(inst, b, p, q, f) { const n = b.kind === 'boss' ? (b.phase >= 2 ? 3 : 2) : 2, st = L.mobStats(inst.mode === 'raid' ? inst.i : inst.i, 'orb', inst.df, inst.n, 'orb', inst.hc);
      for (let k = 0; k < n; k++) { const a = k / n * TAU + inst.rng(), m = spawnMob(inst, q, 'orb', 'orb', b.x + Math.cos(a) * (b.sc + 1.5), b.z + Math.sin(a) * (b.sc + 1.5), 0.1);
        m.hp = m.max = Math.max(1, st.hp); m.dmg = b.dmg * C.MOVES.orbs[0]; m.minion = true; m.owner = b.uid; m.life = inst.t + C.BOSS.ORB_LIFE; ev(inst, { k: 'mhp', u: m.uid, hp: m.hp, max: m.max }); }
      return 1.0 * f; },
    meteor(inst, b, p, q, f) { const [mult, dur] = C.MOVES.meteor, list = arenaPlayers(inst, b); if (!list.length) list.push(p);
      for (let k = 0; k < 3; k++) inst.sched.push({ at: inst.t + k * 0.55 * f, fn: () => { if (b.hp <= 0) return; for (const tp of list) if (!tp.dead) { tele(inst, b, { s: 'c', x: tp.x, z: tp.z, r: 2.6 }, dur * f, mult); ev(inst, { k: 'shot', x0: R1(tp.x + 3), z0: R1(tp.z + 3), x: R1(tp.x), z: R1(tp.z), dur: R2(dur * f), fall: 1 }); } } });
      return (1.1 + dur) * f; },
    nova(inst, b, p, q, f) { const [mult, dur] = C.MOVES.nova; tele(inst, b, { s: 'c', x: b.x, z: b.z, r: 6.5 + b.sc * 1.2 }, dur * f, mult); b.hopT = inst.t + dur * f; return dur * f + 0.4; },
    spiral(inst, b, p, q, f) { const [mult, dur] = C.MOVES.spiral, arms = b.phase >= 2 ? 3 : 2, a0 = inst.rng() * TAU, x0 = b.x, z0 = b.z;
      for (let k = 0; k < 9; k++) inst.sched.push({ at: inst.t + k * 0.14 * f, fn: () => { if (b.hp <= 0) return; for (let j = 0; j < arms; j++) { const a = a0 + j * TAU / arms + k * 0.55, rr = b.sc * 0.6 + 2.5 + k * 2.1, x = x0 + Math.cos(a) * rr, z = z0 + Math.sin(a) * rr;
        tele(inst, b, { s: 'c', x, z, r: 2.2 }, dur * f, mult, { quiet: true }); } } });
      return (9 * 0.14 + dur) * f + 0.2; },
    // standing right against a boss gets you stomped (it is not a safe spot)
    stomp(inst, b, p, q, f) { const [mult, dur] = C.MOVES.stomp; tele(inst, b, { s: 'c', x: b.x, z: b.z, r: SD.solidR(b) + 3.2 }, dur * f, mult); b.hopT = inst.t + dur * f; return dur * f + 0.3; },
    pools(inst, b, p, q, f) { const [mult, dur] = C.MOVES.pools, list = arenaPlayers(inst, b).slice(0, 2), n = b.kind === 'boss' ? 4 : 3, pts = list.map(tp => [tp.x, tp.z]);
      while (pts.length < n) pts.push(randIn(inst, q, 4)); const life = b.kind === 'boss' ? 8 : 6;
      for (const [x, z] of pts) { inst.bpools.push({ x, z, r: 2.6, start: inst.t + dur * f, end: inst.t + dur * f + life, next: 0, dmg: b.dmg * 0.35 * mult });
        ev(inst, { k: 'tele', s: 'pool', x: R2(x), z: R2(z), r: 2.6, dur: R2(dur * f + life), warm: R2(dur * f) }); }
      return dur * f + 0.4; }
  };
  SD.MOVES = Object.keys(MOVE);
  function cast(inst, m, p, name, f) { const q = roomOf(inst, m), S = C.SIG[name], fn = MOVE[name] || MOVE.slam; m.st = 'cast'; m.t = 0; m.warn = 0; m.y = 0;
    ev(inst, S ? { k: 'move', u: m.uid, m: name, n: S.n, tip: S.tip || '', pose: S.pose, w: R2((S.wind || 0) * f) } : { k: 'move', u: m.uid, m: name });
    const dur = S ? sig(inst, m, p, q, f, S) : fn(inst, m, p, q, f);
    m.busy = inst.t + dur; m.used = m.used || {}; m.used[name] = (m.used[name] || 0) + 1; return dur; }
  // ---------------------------------------------------------------- Update 7 · signature moves (C.SIG): every boss and mini-boss has its own.
  // A move is a wind-up (its pose plays on the client for `wind` seconds) and parts that lay telegraphs: circles, trails, fans and sweeps of
  // beams, crosses, rings, a leap, a dash, or one of the shared rules (use) with this move's own name and timing. Returns how long it keeps the caster busy.
  const USE = { wave: 'ring' };
  function sig(inst, b, p, q, f, S) {
    const ph = b.phase || 1, wind = (S.wind || 0) * f, aim = Math.atan2(p.x - b.x, p.z - b.z), size = sizeOf(q), r0 = SD.solidR(b); let end = Math.max(wind, 0.4);
    const at = (w, tp) => w === 'self' ? [b.x, b.z] : w === 'room' ? [q.x, q.z] : w === 'ahead' ? [b.x + Math.sin(aim) * (r0 + 3.5), b.z + Math.cos(aim) * (r0 + 3.5)] : [tp.x, tp.z];
    const bar = (cx, cz, yaw, l, w, d, mult, quiet) => tele(inst, b, { s: 'r', x: cx, z: cz, yaw, l, w }, d, mult, { quiet });
    for (const pt of S.parts) {
      const d0 = wind + (pt.delay || 0) * f, mult = pt.mult || S.mult || 1, n = (pt.n || 1) + (ph >= 2 && pt.np2 ? pt.np2 : 0), step = (pt.step || 0) * f, len = pt.len || size * 0.95;
      const tps = pt.each ? arenaPlayers(inst, b) : []; if (!tps.length) tps.push(p); let last = d0;
      switch (pt.k) {
        case 'circle': for (const tp of tps) { const [cx, cz] = at(pt.at || 'target', tp);
          for (let k = 0; k < n; k++) { const a = inst.rng() * TAU, r = k || pt.at === 'room' ? (pt.spread || 4) * Math.sqrt(inst.rng()) : 0, d = d0 + k * step;
            tele(inst, b, { s: 'c', x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, r: pt.r || 2.2 }, d, mult, { quiet: k > 0 }); last = Math.max(last, d); } } break;
        case 'trail': { const lanes = pt.lanes || 1, arc = (pt.arc || 0) * Math.PI / 180, tl = pt.len || size * 0.9;
          for (let j = 0; j < lanes; j++) { const a = aim + (lanes > 1 ? -arc / 2 + arc * j / (lanes - 1) : 0);
            for (let k = 1; k <= n; k++) { const t2 = r0 + 1 + k / n * tl, d = d0 + k * step; tele(inst, b, { s: 'c', x: b.x + Math.sin(a) * t2, z: b.z + Math.cos(a) * t2, r: pt.r || 2 }, d, mult, { quiet: k > 1 || j > 0 }); last = Math.max(last, d); } } break; }
        case 'fan': case 'spin': { const arc = (pt.arc || 0) * Math.PI / 180, full = arc > TAU - 0.01, rot = (pt.rot || 0) * Math.PI / 180;
          for (let k = 0; k < n; k++) { const a = aim + rot + (n > 1 ? (full ? k / n * TAU : -arc / 2 + arc * k / (n - 1)) : 0), d = d0 + k * step, L = Math.min(len, reachIn(q, b.x, b.z, a, len) + 1);
            bar(b.x + Math.sin(a) * (r0 * 0.5 + L / 2), b.z + Math.cos(a) * (r0 * 0.5 + L / 2), a, L / 2, pt.w || 1.4, d, mult, k > 0); last = Math.max(last, d); } break; }
        case 'cross': { const [cx, cz] = at(pt.at || 'target', p), arms = pt.arms || 2, rot = (pt.rot || 0) * Math.PI / 180 + (pt.at === 'self' ? aim : inst.rng() * Math.PI);
          for (let k = 0; k < arms; k++) bar(cx, cz, rot + k * Math.PI / arms, len / 2, pt.w || 1.4, d0, mult, k > 0); break; }
        case 'ring': { const [cx, cz] = at(pt.at || 'target', p); for (let k = 0; k < n; k++) { const a = k / n * TAU; tele(inst, b, { s: 'c', x: cx + Math.cos(a) * pt.rad, z: cz + Math.sin(a) * pt.rad, r: pt.r || 2 }, d0, mult, { quiet: k > 0 }); } break; }
        case 'leap': { const fl = 0.45 * f; tele(inst, b, { s: 'c', x: p.x, z: p.z, r: pt.r || 4 }, d0 + fl, mult); b.mv = { x0: b.x, z0: b.z, x1: p.x, z1: p.z, t0: inst.t + d0, t1: inst.t + d0 + fl, hop: 5 + b.sc }; last = d0 + fl; break; }
        case 'dash': { const yaw = aim, L = Math.min(pt.len || 30, reachIn(q, b.x, b.z, yaw, pt.len || 30)), l = L / 2;
          bar(b.x + Math.sin(yaw) * l, b.z + Math.cos(yaw) * l, yaw, l, pt.w || b.sc * 0.6 + 0.7, d0, mult); b.yaw = yaw;
          b.mv = { x0: b.x, z0: b.z, x1: b.x + Math.sin(yaw) * Math.max(0, L - b.sc), z1: b.z + Math.cos(yaw) * Math.max(0, L - b.sc), t0: inst.t + d0 - 0.05, t1: inst.t + d0 + 0.3, hop: 0 }; last = d0 + 0.3; break; }
        case 'use': { const m2 = USE[pt.m] || pt.m, fn = MOVE[m2]; if (!fn) break;
          if (d0 > 0.01) inst.sched.push({ at: inst.t + d0, fn: () => { if (b.hp > 0) fn(inst, b, targetFor(inst, b) || p, q, f); } }); else fn(inst, b, p, q, f);
          last = d0 + ((C.MOVES[m2] || [0, 1])[1] + 0.4) * f; break; }
      }
      end = Math.max(end, last);
    }
    return end + 0.4 * f;
  }
  SD._cast = cast;
  // moves that move the caster: leaps and charges (mv), teleports (vanish), little hops (hopT); and the boss's shockwave ring
  function casterTick(inst, m, dt) {
    if (m.mv) { const v = m.mv, k = clamp((inst.t - v.t0) / Math.max(0.01, v.t1 - v.t0), 0, 1); if (inst.t >= v.t0) { m.x = v.x0 + (v.x1 - v.x0) * k; m.z = v.z0 + (v.z1 - v.z0) * k; m.y = Math.sin(k * Math.PI) * v.hop; }
      if (k >= 1) { m.mv = null; m.y = 0; } }
    if (m.vanish) { if (inst.t < m.vanish.until) { m.st = 'vanish'; m.y = Math.min(40, m.y + dt * 60); } else { m.x = m.vanish.x; m.z = m.vanish.z; m.y = 0; m.vanish = null; m.st = m.kind === 'boss' ? 'fight' : 'recover'; m.t = 0; ev(inst, { k: 'land', u: m.uid }); } }
    if (m.hopT && !m.mv && !m.vanish) { const k = m.hopT - inst.t; m.y = k > 0 && k < 0.6 ? Math.sin((0.6 - k) / 0.6 * Math.PI) * 2 : 0; if (k < 0) m.hopT = 0; }
    if (m.ring) { const g = m.ring, prev = g.r; g.r += dt * 10; if (g.r > g.max) m.ring = null;
      else for (const q of inst.players.values()) { if (q.dead || q.y > 0.7 || g.hit[q.id]) continue; const d = Math.hypot(q.x - g.x, q.z - g.z); if (d >= prev - 0.4 && d <= g.r + 0.4) { g.hit[q.id] = 1; hurtPlayer(inst, q, m.dmg * C.MOVES.ring[0], g); } } }
  }
  // ---------------------------------------------------------------- bosses: their own move set (C.BOSS_KITS), faster below half health, some hide behind a heart
  // someone has been standing right against this boss for a while (counted in b.hug seconds)
  function hugged(inst, b, dt, count) { if (count) { const close = alive(inst).some(p => Math.hypot(p.x - b.x, p.z - b.z) < SD.solidR(b) + 1.3); b.hug = close ? (b.hug || 0) + dt : Math.max(0, (b.hug || 0) - dt * 2); } return (b.hug || 0) > C.BOSS.HUG; }
  const DEFAULT_KIT = { p1: ['slam', 'ring', 'barrage', 'summon'], p2: ['slam', 'ring', 'barrage', 'slam', 'summon', 'ring', 'barrage'] };
  function bossTick(inst, b, dt) {
    b.t += dt; const room = roomOf(inst, b), kit = b.kit || DEFAULT_KIT;
    if (b.st === 'spawn') { b.st = 'intro'; b.t = 0; ev(inst, { k: 'bossIntro', u: b.uid }); }
    if (b.st === 'intro') { if (b.t > 1.8) { b.st = 'fight'; b.t = 0; b.atkT = 1.2; } return; }
    if (inst.t < b.frz) return;
    if (b.phase === 1 && b.hp < b.max * 0.5) { b.phase = 2; ev(inst, { k: 'bossPhase', u: b.uid });
      if (kit.heart) { const dx = room.x - b.x, dz = room.z - b.z, d = Math.hypot(dx, dz) || 1, rr = (room.round || Math.min(room.w, room.d) / 2) * 0.6, x = room.x + dx / d * rr, z = room.z + dz / d * rr;
        const h = spawnMob(inst, room, 'heart', 'heart', x, z, 0.3); h.hp = h.max = Math.max(1, Math.round(b.max * C.BOSS.HEART)); h.minion = true; h.owner = b.uid; b.immune = h.uid; ev(inst, { k: 'immune', u: b.uid, on: 1, h: h.uid }); ev(inst, { k: 'mhp', u: h.uid, hp: h.hp, max: h.max }); } }
    if ((inst.mode === 'raid' || kit.p3) && b.phase === 2 && b.hp < b.max * 0.25) { b.phase = 3; ev(inst, { k: 'bossPhase', u: b.uid, p: 3 }); }   // Update 7: every boss has a third phase
    if (b.immune && !inst.mobs.some(q => q.uid === b.immune && q.hp > 0)) { b.immune = 0; ev(inst, { k: 'immune', u: b.uid, on: 0 }); }
    const fast = b.phase === 3 ? 0.65 : b.phase === 2 ? 0.8 : 1, p = targetFor(inst, b);
    if (b.vanish || b.mv || inst.t < b.busy) return;
    if (b.st !== 'fight') { b.st = 'fight'; b.t = 0; }
    if (!p) return;
    const dx = p.x - b.x, dz = p.z - b.z, dist = Math.hypot(dx, dz); hugged(inst, b, dt, true);
    if (dist > SD.solidR(b) + 3) { b.x += dx / dist * dt * 2.2 / fast; b.z += dz / dist * dt * 2.2 / fast; } turn(b, p.x, p.z, dt * 3); b.y = Math.abs(Math.sin(b.t * 3)) * 0.15; b.atkT -= dt;
    if (b.atkT <= 0) { const list = b.phase >= 3 && kit.p3 ? kit.p3 : b.phase >= 2 ? kit.p2 : kit.p1, ap = arenaPlayers(inst, b), tp = ap.length ? ap[Math.floor(inst.rng() * ap.length)] : p;
      if (hugged(inst, b, dt)) { b.hug = 0; cast(inst, b, p, 'stomp', fast); } else cast(inst, b, tp, list[b.atk++ % list.length], fast); b.atkT = (1.0 + inst.rng() * 0.4) * fast; }
  }
  // ---------------------------------------------------------------- results
  // what each player gets is worked out by L.runReward / L.pitReward with their own saved state
  SD.summary = inst => ({ mode: inst.mode, winner: inst.duel ? inst.duel.winner : 0, score: inst.duel ? inst.duel.score : null, i: inst.i, df: inst.df, hc: inst.hc, res: inst.result, progress: inst.progress, waves: inst.pitCleared, camps: inst.wildCleared || 0, t: inst.t, pen: inst.pen, limit: inst.limit,
    players: [...inst.players.values()].map(p => ({ id: p.id, name: p.name, kills: p.kills, dmg: Math.round(p.dmgDone), out: p.out, deaths: p.deaths, casts: p.casts || 0, style: p.styleBest || 0, parries: p.nParry || 0, pdodges: p.nPdodge || 0, ults: p.nUlt || 0, kc: p.kc || {} })), floor: inst.towerCleared || 0, muts: inst.mutsSeen || [] });
  // seconds left on the dungeon clock (0 = no clock)
  SD.timeLeft = inst => inst.limit ? Math.max(0, inst.limit - inst.t - inst.pen) : 0;
  SD.takeEvents = inst => { const e = inst.events; inst.events = []; return e; };
  root.SD = SD;
  if (typeof module !== 'undefined') module.exports = SD;
})(typeof self !== 'undefined' ? self : this);
