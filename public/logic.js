/* Slime Slayers - shared game rules. The server uses them to own every player's progress; guest mode runs the same code locally.
   Dungeon Quest style: classes, stat points, gear with level requirements and rarities, dungeons unlocked by level. */
(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && !root.SS_CONFIG ? require('./config.js') : root.SS_CONFIG;
  const L = { C };
  const clamp = L.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  L.hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  L.mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
  L.fmt = n => { n = Math.floor(n || 0); if (n < 1000) return String(n); let u = 0, v = n; while (v >= 1000 && u < UNITS.length - 1) { v /= 1000; u++; } let t = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, ''); return t + UNITS[u]; };
  // days roll over at midnight Sydney time (close enough: UTC+10); weeks start on Monday
  L.dayKey = now => new Date(now + 10 * 3600000).toISOString().slice(0, 10);
  L.weekKey = now => { const d = new Date(now + 10 * 3600000), wd = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - wd * 86400000).toISOString().slice(0, 10); };
  const ok = o => Object.assign({ ok: true }, o || {}), no = err => ({ ok: false, err });

  // ================================================================ content
  L.ND = C.DUNGEONS.length;
  L.mob = id => C.MOBS[id] ? Object.assign({ id }, C.MOBS[id]) : undefined;
  L.dun = i => C.DUNGEONS[i];
  L.spell = id => C.SPELLS.find(s => s.id === id);
  // the abilities a class can use: its own + the secret (any class) ones
  L.spellsFor = cls => C.SPELLS.filter(s => s.cls === cls);
  // can this player put the ability on their bar? Update 7: your class's abilities unlock when your level reaches their dungeon (2 per class per dungeon)
  L.spellOk = (s, sp) => !!sp && sp.cls === s.cls && s.level >= sp.lv;
  L.spellHow = sp => 'Reach ' + C.DUNGEONS[sp.t].n + ' (level ' + sp.lv + ')';
  // ================================================================ world layout (shared by the renderer, the dungeon simulation and the server)
  const W = L.W = { PORTALS: [], STN: {} };
  // Update 7 · the town is a green hillside valley: its edge is a rounded rectangle (|u|^4 + |v|^4 = 1) around TOWN; the Wildgate Market
  // (Update 6) lies outside the west gate. The Grand Gate terrace (3 above the square) holds the twelve dungeon portals on an arc.
  W.TOWN = { cx: 0, cz: -4, rx: 76, rz: 86 };
  W.townE = (x, z) => { const u = (x - W.TOWN.cx) / W.TOWN.rx, v = (z - W.TOWN.cz) / W.TOWN.rz; return Math.pow(u * u * u * u + v * v * v * v, 0.25); };
  W.ANNEX = { x0: -124, x1: -78, z0: -6, z1: 26 }; W.WEST_GATE = { x: -76, z: 10, w: 7 };
  W.inAnnex = (x, z) => x > W.ANNEX.x0 && x < W.ANNEX.x1 + 4 && z > W.ANNEX.z0 && z < W.ANNEX.z1;
  W.inHub = (x, z) => W.townE(x, z) < 1.05 || W.inAnnex(x, z);
  W.STN = {
    smith: { x: -26, z: 6, l: 'BLACKSMITH', c: '#ff8a3a' },
    armory: { x: 58, z: 24, l: 'SHOP', c: '#ffc83a' },
    quests: { x: -10, z: 22, l: 'REWARDS', c: '#7aff5a' }, gift: { x: 10, z: 22, l: 'DAILY GIFT', c: '#3ad8e0' },
    arena: { x: -50, z: -7, l: 'THE PIT (WAVES)', c: '#ff4a4a' }, board: { x: 58, z: -6, l: 'HALL OF SLAYERS', c: '#ffd84a' }
  };
  W.SPAWN = [0, 30];
  W.GATE = { x: 0, z: -54, r: 28, y: 3 };
  for (let k = 0; k < C.DUNGEONS.length; k++) { const a = (192 + k * 156 / Math.max(1, C.DUNGEONS.length - 1)) * Math.PI / 180; W.PORTALS.push({ k, x: W.GATE.x + Math.cos(a) * W.GATE.r, z: W.GATE.z + Math.sin(a) * W.GATE.r, y: W.GATE.y }); }
  // where you appear when you come home from dungeon k: a few steps in front of its portal, facing the plaza
  W.portalHome = k => { const p = W.PORTALS[k], a = Math.atan2(W.GATE.x - p.x, W.GATE.z - p.z); return { x: p.x + Math.sin(a) * 5, z: p.z + Math.cos(a) * 5, yaw: a }; };
  // the Pit (wave defence) is its own walled arena west of town
  W.ARENA = { x: -800, z: 0, r: 26 };
  W.inArena = (x, z) => Math.hypot(x - W.ARENA.x, z - W.ARENA.z) < W.ARENA.r + 6;
  // dungeon i lives in its own strip far east of town; every party in it is a separate instance
  W.DX = i => 800 * (i + 1);
  W.dunAt = (x, z) => { const i = Math.round(x / 800) - 1; if (i < 0 || i >= L.ND) return -1; const b = W.layout(i).bb; return x > b.x0 - 70 && x < b.x1 + 70 && z > b.z0 - 70 && z < b.z1 + 70 ? i : -1; };
  // rooms and halls of a dungeon (world coordinates), built from the dungeon's own plan in C.LAYOUTS. kind: start, mob, mini, boss, loot, side
  // main rooms come first (0 = start ... boss, loot), then side rooms. Every hall: a (room it leaves) -> b (room it reaches), ax = the axis it runs along
  const LAYOUT = [], DIRV = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
  W.DIRV = DIRV;
  W.layout = i => {
    if (LAYOUT[i]) return LAYOUT[i];
    const B = C.LAYOUTS[i] || C.LAYOUTS[0], r = L.mulberry(9001 + i * 31), cx = W.DX(i), rooms = [], halls = [], HW = B.hall || 7;
    const half = q => q.round ? [q.round, q.round] : [q.w / 2, q.d / 2];
    const mk = (p, n, kind) => ({ i: n, kind, cliff: p.cliff || '', x: 0, z: 0, w: p.r ? p.r * 2 : p.w, d: p.r ? p.r * 2 : p.d, round: p.r || 0, waves: p.waves || null, obstK: p.obst || '', hazK: p.haz || null, mini: p.n || 0, main: kind !== 'side', from: -1, hin: -1 });
    const box = q => { const [hx, hz] = half(q); return [q.x - hx, q.x + hx, q.z - hz, q.z + hz]; };
    const hit = (A, Bq, m) => A[0] < Bq[1] + m && Bq[0] < A[1] + m && A[2] < Bq[3] + m && Bq[2] < A[3] + m;
    function attach(a, q, p) {
      const dir = p.dir || 'S', [dx, dz] = DIRV[dir], [ahx, ahz] = half(a), [qhx, qhz] = half(q), len = p.len || 14;
      const along = dx ? ahz : ahx, off = a.round ? 0 : clamp(p.off || 0, -1, 1) * Math.max(0, along - HW / 2 - 2.5);
      const ax = a.x + (dx ? dx * ahx : off), az = a.z + (dz ? dz * ahz : off), bx = ax + dx * len, bz = az + dz * len;
      const qAlong = dx ? qhz : qhx, jl = Math.max(0, qAlong - HW / 2 - 2.5), jog = q.round ? 0 : clamp(p.jog || 0, -jl, jl);
      q.x = dx ? bx + dx * qhx : bx - jog; q.z = dz ? bz + dz * qhz : bz - jog;
      const eA = a.round ? 1.8 : 0.3, eB = q.round ? 1.8 : 0.3, ax2 = dx ? 'x' : 'z';
      const s0 = (dx ? ax : az) - (dx || dz) * eA, s1 = (dx ? bx : bz) + (dx || dz) * eB, c = (s0 + s1) / 2, L2 = Math.abs(s1 - s0);
      const h = { i: halls.length, a: a.i, b: q.i, dir, ax: ax2, x: dx ? c : ax, z: dz ? c : az, w: dx ? L2 : HW, d: dz ? L2 : HW, hw: HW, len, pa: { x: ax, z: az }, pb: { x: bx, z: bz } };
      // nothing may overlap (a plan that does is a mistake in config.js)
      const hb = [h.x - h.w / 2, h.x + h.w / 2, h.z - h.d / 2, h.z + h.d / 2], qb = box(q);
      for (const o of rooms) { if (hit(qb, box(o), 5)) throw new Error('layout ' + i + ': room ' + q.i + ' overlaps room ' + o.i); if (o !== a && hit(hb, box(o), 1.5)) throw new Error('layout ' + i + ': hall to ' + q.i + ' crosses room ' + o.i); }
      for (const o of halls) { const ob = [o.x - o.w / 2, o.x + o.w / 2, o.z - o.d / 2, o.z + o.d / 2]; if (hit(qb, ob, 3) && o.a !== q.i && o.b !== q.i) throw new Error('layout ' + i + ': room ' + q.i + ' crosses hall ' + o.i); if (o.a !== a.i && o.b !== a.i && hit(hb, ob, 2)) throw new Error('layout ' + i + ': halls cross ' + o.i); }
      h.br = p.br || ''; h.st = p.st || 0;   // Update 7: a bridge (what is below) / a street lined with houses
      halls.push(h); q.from = a.i; q.hin = h.i; q.entry = h.pb;
    }
    B.main.forEach((p, n) => { const q = mk(p, n, p.k); if (n === 0) { q.x = cx; q.z = 140; } else attach(rooms[n - 1], q, p); rooms.push(q); });
    const nMain = rooms.length, boss = nMain - 2, loot = nMain - 1;
    (B.side || []).forEach(p => { const q = mk(p, rooms.length, 'side'); q.waves = p.waves || null; attach(rooms[p.from], q, p); rooms.push(q); });
    // the doorways of each room
    const doors = q => halls.filter(h => h.a === q.i || h.b === q.i).map(h => h.a === q.i ? h.pa : h.pb);
    const farDoor = (q, x, z, m) => doors(q).every(dp => Math.hypot(dp.x - x, dp.z - z) > m);
    const inside = (q, x, z, m) => q.round ? Math.hypot(x - q.x, z - q.z) < q.round - m : Math.abs(x - q.x) < q.w / 2 - m && Math.abs(z - q.z) < q.d / 2 - m;
    // obstacles inside rooms (round pillars, trees, stones...): solid for players AND slimes
    const obst = [];
    rooms.forEach(q => { const k = q.obstK; if (!k) return; const out = [], ok = (x, z, rr) => inside(q, x, z, 3 + rr) && farDoor(q, x, z, 7) && Math.hypot(x - q.x, z - q.z) > (q.kind === 'boss' ? 8 : 4.5) && out.every(o => Math.hypot(o.x - x, o.z - z) > 5.5);
      if (k === 'pillars' || k === 'tombs') { const nx = q.w >= 44 ? 3 : 2, nz = q.d >= 40 ? 3 : 2, rr = k === 'pillars' ? 1.2 : 1.0;
        for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) { const x = q.x + (nx === 3 ? (a - 1) * q.w / 3.2 : (a ? 1 : -1) * q.w / 4.2), z = q.z + (nz === 3 ? (b - 1) * q.d / 3.2 : (b ? 1 : -1) * q.d / 4.2); if (ok(x, z, rr)) out.push({ x, z, r: rr, k }); } }
      else if (k === 'ring') { for (let a = 0; a < 6; a++) { const an = (a + 0.5) / 6 * Math.PI * 2, x = q.x + Math.cos(an) * q.round * 0.62, z = q.z + Math.sin(an) * q.round * 0.62; if (ok(x, z, 1.1)) out.push({ x, z, r: 1.1, k: 'pillars' }); } }
      else { const n = Math.max(3, Math.round(q.w * q.d / 260)), rr = k === 'trees' ? 0.9 : k === 'stones' ? 1.15 : 1.0; for (let t = 0; t < 80 && out.length < n; t++) { const x = q.x + (r() - 0.5) * (q.w - 8), z = q.z + (r() - 0.5) * (q.d - 8); if (ok(x, z, rr)) out.push({ x, z, r: rr, k }); } }
      for (const o of out) { o.room = q.i; obst.push(o); } });
    const clearOfObst = (x, z, m) => obst.every(o => Math.hypot(o.x - x, o.z - z) > o.r + m);
    // room hazards: burning pools that stay, vents that erupt every few seconds
    const haz = [];
    rooms.forEach(q => { if (!q.hazK) return; const [k, n] = q.hazK, rr = k === 'pool' ? 2.6 : k === 'blades' ? 4.6 : k === 'star' ? 2.8 : 2.4, mine = [];
      // the tide floods the whole room; three or four raised daises stay dry (away from the doors)
      if (k === 'tide') { const safe = [], want = q.round ? 3 : 4, dr = 2.4;
        for (let t = 0; t < 200 && safe.length < want; t++) { const x = q.x + (r() - 0.5) * ((q.round ? q.round * 2 : q.w) - 12), z = q.z + (r() - 0.5) * ((q.round ? q.round * 2 : q.d) - 12);
          if (!inside(q, x, z, dr + 2.5) || !farDoor(q, x, z, 7) || !clearOfObst(x, z, dr + 1.5) || safe.some(o => Math.hypot(o[0] - x, o[1] - z) < 9)) continue; safe.push([+x.toFixed(2), +z.toFixed(2), dr]); }
        haz.push({ id: haz.length + 1, k: 'tide', x: q.x, z: q.z, w: q.round ? q.round * 2 : q.w, d: q.round ? q.round * 2 : q.d, round: q.round, r: Math.max(q.w, q.d), room: q.i, safe, ph: r() * C.HAZ.TIDE_PERIOD }); return; }
      for (let t = 0; t < 120 && mine.length < n; t++) { const x = q.x + (r() - 0.5) * (q.w - 10), z = q.z + (r() - 0.5) * (q.d - 10);
        if (!inside(q, x, z, rr + 3) || !farDoor(q, x, z, 8) || !clearOfObst(x, z, rr + 2) || mine.some(o => Math.hypot(o.x - x, o.z - z) < 8)) continue; mine.push({ id: haz.length + mine.length + 1, k, x, z, r: rr, room: q.i, ph: r() * (k === 'star' ? C.HAZ.STAR_PERIOD : C.HAZ.VENT_PERIOD), dir: r() < 0.5 ? 1 : -1 }); }
      haz.push(...mine); });
    // where a run's treasure chest and shrine can stand: by walls with no door (mob rooms and side rooms; the run's seed picks)
    const spots = [];
    rooms.forEach(q => { if (q.kind !== 'mob' && q.kind !== 'side') return; if (q.kind === 'mob' && spots.filter(s2 => rooms[s2.room].kind === 'mob').length >= 8) return;
      const cand = q.round ? [0, 1, 2, 3].map(a => { const an = a * Math.PI / 2 + Math.PI / 4; return { x: q.x + Math.cos(an) * (q.round - 2.2), z: q.z + Math.sin(an) * (q.round - 2.2), yaw: Math.atan2(-Math.cos(an), -Math.sin(an)) }; })
        : [{ x: q.x - q.w / 2 + 1.8, z: q.z + q.d * 0.12, yaw: Math.PI / 2 }, { x: q.x + q.w / 2 - 1.8, z: q.z + q.d * 0.12, yaw: -Math.PI / 2 }, { x: q.x, z: q.z + q.d / 2 - 1.8, yaw: Math.PI }, { x: q.x, z: q.z - q.d / 2 + 1.8, yaw: 0 }];
      let n = 0; for (const c of cand) { if (n >= 2) break; if (!farDoor(q, c.x, c.z, HW / 2 + 3) || !clearOfObst(c.x, c.z, 2.5)) continue; spots.push(Object.assign({ room: q.i }, c)); n++; } });
    // breakable crates and urns along the walls (clear of doorways, the spots, obstacles and the middle where you fight)
    const props = [];
    rooms.forEach(q => { if (q.kind !== 'mob' && q.kind !== 'mini' && q.kind !== 'start' && q.kind !== 'side') return; const n = q.kind === 'start' ? 3 : q.kind === 'side' ? 6 : Math.round((q.w + q.d) / 9);
      for (let k = 0, tries = 0; k < n && tries < 80; tries++) { let x, z;
        if (q.round) { const an = r() * Math.PI * 2, rr = q.round - 1.5 - r() * 1.2; x = q.x + Math.cos(an) * rr; z = q.z + Math.sin(an) * rr; }
        else { const corner = r() < 0.45, sx = r() < 0.5 ? -1 : 1, sz = r() < 0.5 ? -1 : 1, alongX = r() < 0.5;
          x = corner ? q.x + sx * (q.w / 2 - 1.5 - r() * 1.5) : alongX ? q.x + (r() - 0.5) * (q.w - 6) : q.x + sx * (q.w / 2 - 1.4);
          z = corner ? q.z + sz * (q.d / 2 - 1.5 - r() * 1.5) : alongX ? q.z + sz * (q.d / 2 - 1.4) : q.z + (r() - 0.5) * (q.d - 6); }
        if (!farDoor(q, x, z, HW / 2 + 2.5) || !clearOfObst(x, z, 1.5) || spots.some(sp => Math.hypot(sp.x - x, sp.z - z) < 2.6) || props.some(p => Math.hypot(p.x - x, p.z - z) < 1.6)) continue;
        props.push({ id: props.length + 1, room: q.i, x, z, v: Math.floor(r() * 3) }); k++; } });
    // spike traps across halls between fights (not the first hall, not into the boss or the loot room)
    const traps = [];
    halls.forEach(h => { const A = rooms[h.a], Bq = rooms[h.b]; if (!A.main || !Bq.main || h.a === 0 || Bq.kind === 'boss' || Bq.kind === 'loot' || traps.length >= 6) return;
      const n = h.len >= 22 ? 2 : 1; for (let k = 0; k < n; k++) { const f = n === 1 ? 0.5 : 0.3 + k * 0.4, x = h.pa.x + (h.pb.x - h.pa.x) * f, z = h.pa.z + (h.pb.z - h.pa.z) * f;
        traps.push({ id: traps.length + 1, x, z, w: h.ax === 'z' ? h.hw - 0.4 : 2.4, d: h.ax === 'z' ? 2.4 : h.hw - 0.4, ph: traps.length * 0.85, hall: h.i }); } });
    // the hidden relic: in a side room ('s0', 's1') or a main room
    let rq = typeof B.relic === 'string' ? rooms.filter(q => q.kind === 'side')[+B.relic.slice(1)] : rooms[B.relic]; if (!rq) rq = rooms[2];
    let relic = null; for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const x = rq.round ? rq.x + sx * rq.round * 0.55 : rq.x + sx * (rq.w / 2 - 2.2), z = rq.round ? rq.z + sz * rq.round * 0.55 : rq.z + sz * (rq.d / 2 - 2.2);
      if (farDoor(rq, x, z, HW / 2 + 2) && clearOfObst(x, z, 2) && !props.some(p => Math.hypot(p.x - x, p.z - z) < 2) && !spots.some(sp => Math.hypot(sp.x - x, sp.z - z) < 3)) { relic = { x, z, room: rq.i }; break; } }
    if (!relic) relic = { x: rq.x + 2, z: rq.z + 2, room: rq.i };
    // the loot room: chest in the middle, the portal home on the far wall
    const lq = rooms[loot], ld = lq.entry, ex = lq.x - ld.x, ez = lq.z - ld.z, el = Math.hypot(ex, ez) || 1, lh = Math.min(lq.w, lq.d) / 2;
    const exit = { x: lq.x + ex / el * (lh - 2.4), z: lq.z + ez / el * (lh - 2.4), yaw: Math.atan2(-ex / el, -ez / el) };
    const st = rooms[0], bb = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
    for (const q of [...rooms, ...halls]) { bb.x0 = Math.min(bb.x0, q.x - q.w / 2); bb.x1 = Math.max(bb.x1, q.x + q.w / 2); bb.z0 = Math.min(bb.z0, q.z - q.d / 2); bb.z1 = Math.max(bb.z1, q.z + q.d / 2); }
    // the lost lantern (Update 6): tucked into a corner of a main mob room, a different one in every dungeon
    let lantern = null; { const mobRooms = rooms.filter(q => q.kind === 'mob' && q.main), lq2 = mobRooms[(i * 2 + 1) % Math.max(1, mobRooms.length)] || rooms[1];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = lq2.round ? lq2.x + sx * lq2.round * 0.6 : lq2.x + sx * (lq2.w / 2 - 1.8), z = lq2.round ? lq2.z + sz * lq2.round * 0.6 : lq2.z + sz * (lq2.d / 2 - 1.8);
        if (farDoor(lq2, x, z, HW / 2 + 2) && clearOfObst(x, z, 1.6) && !props.some(p => Math.hypot(p.x - x, p.z - z) < 2) && !haz.some(h => Math.hypot(h.x - x, h.z - z) < (h.k === 'tide' ? 0 : h.r + 2)) && Math.hypot(x - relic.x, z - relic.z) > 6) { lantern = { x, z, room: lq2.i }; break; } }
      if (!lantern) lantern = { x: lq2.x - 3, z: lq2.z - 3, room: lq2.i }; }
    const bq = rooms[boss], land = B.land ? { k: B.land.k, s: B.land.s || 1, x: B.land.dx >= 0 ? bb.x1 + 75 : bb.x0 - 75, z: bq.z + 30 } : null;   // the landmark stands beside the boss
    LAYOUT[i] = { i, n: B.n, land, rooms, halls, boss, loot, nMain, start: { x: st.x, z: st.z - 1 }, exit, relic, lantern, props, traps, spots, obst, haz, bb, hw: HW };
    return LAYOUT[i];
  };
  // Update 7 (final): where the ground falls away round a bridge or past a cliff edge, worked out once for the page and the tests.
  // Each pit is a rectangle [x0, x1, z0, z1], cut back so it never runs under a room, a hall, a street's houses, another pit or the landmark.
  W.pits = i => { const lay = W.layout(i); if (lay.pits) return lay.pits; const T = 1.2, M = 0.25, obs = [], out = [];
    for (const q of lay.rooms) { const e = (q.round || 0) + T + M; obs.push(q.round ? { room: q.i, c: [q.x, q.z, e], r: [q.x - e, q.x + e, q.z - e, q.z + e] } : { room: q.i, r: [q.x - q.w / 2 - T - M, q.x + q.w / 2 + T + M, q.z - q.d / 2 - T - M, q.z + q.d / 2 + T + M] }); }
    for (const h of lay.halls) { const s = h.st ? h.hw / 2 + 11.5 : h.br ? h.hw / 2 + 0.8 : h.hw / 2 + T + M; obs.push({ hall: h.i, r: h.ax === 'x' ? [h.x - h.w / 2, h.x + h.w / 2, h.z - s, h.z + s] : [h.x - s, h.x + s, h.z - h.d / 2, h.z + h.d / 2] }); }
    if (lay.land) { const e = 45 * (lay.land.s || 1); obs.push({ land: 1, c: [lay.land.x, lay.land.z, e], r: [lay.land.x - e, lay.land.x + e, lay.land.z - e, lay.land.z + e] }); }
    const hits = (r, o) => o.c ? Math.hypot(Math.max(r[0] - o.c[0], 0, o.c[0] - r[1]), Math.max(r[2] - o.c[1], 0, o.c[1] - r[3])) < o.c[2] - 0.02
      : Math.min(r[1], o.r[1]) - Math.max(r[0], o.r[0]) > 0.02 && Math.min(r[3], o.r[3]) - Math.max(r[2], o.r[2]) > 0.02;
    const holds = (r, c) => r[0] <= c[0] + 1e-6 && r[1] >= c[1] - 1e-6 && r[2] <= c[2] + 1e-6 && r[3] >= c[3] - 1e-6;
    const clip = (r, core, skip) => { r = r.slice(); for (let n = 0; n < 40; n++) { const o = obs.find(o2 => !skip(o2) && hits(r, o2)); if (!o) return r; let b = o.r;
        if (o.c) { const [cx, cz, R0] = o.c, dz = Math.max(r[2] - cz, 0, cz - r[3]), dx = Math.max(r[0] - cx, 0, cx - r[1]), hx = Math.sqrt(Math.max(0, R0 * R0 - dz * dz)), hz = Math.sqrt(Math.max(0, R0 * R0 - dx * dx)); b = [cx - hx, cx + hx, cz - hz, cz + hz]; }   // a round room: cut just clear of the circle
        const opts = [[b[1], r[1], r[2], r[3]], [r[0], b[0], r[2], r[3]], [r[0], r[1], b[3], r[3]], [r[0], r[1], r[2], b[2]]].filter(c => c[1] - c[0] > 1 && c[3] - c[2] > 1 && holds(c, core));
        if (!opts.length) return null; opts.sort((p, q) => (q[1] - q[0]) * (q[3] - q[2]) - (p[1] - p[0]) * (p[3] - p[2])); r = opts[0]; } return null; };
    for (const q of lay.rooms) if (q.cliff) { const hx = q.round || q.w / 2, hz = q.round || q.d / 2, e = T + 0.6, L0 = 70, sd = q.cliff;
      const r = sd === 'E' ? [q.x + hx + e, q.x + hx + e + L0, q.z - hz - 12, q.z + hz + 12] : sd === 'W' ? [q.x - hx - e - L0, q.x - hx - e, q.z - hz - 12, q.z + hz + 12] : sd === 'N' ? [q.x - hx - 12, q.x + hx + 12, q.z + hz + e, q.z + hz + e + L0] : [q.x - hx - 12, q.x + hx + 12, q.z - hz - e - L0, q.z - hz - e];
      const core = sd === 'E' ? [r[0], r[0] + 12, q.z - hz, q.z + hz] : sd === 'W' ? [r[1] - 12, r[1], q.z - hz, q.z + hz] : sd === 'N' ? [q.x - hx, q.x + hx, r[2], r[2] + 12] : [q.x - hx, q.x + hx, r[3] - 12, r[3]];
      const c = clip(r, core, o => o.room === q.i); const p = { k: 'cliff', room: q.i, r: c || core, ok: !!c }; out.push(p); obs.push({ pit: 1, r: p.r }); }
    for (const h of lay.halls) if (h.br) { const along = h.ax === 'x', r = along ? [h.x - h.w / 2 + 1.5, h.x + h.w / 2 - 1.5, h.z - 24, h.z + 24] : [h.x - 24, h.x + 24, h.z - h.d / 2 + 1.5, h.z + h.d / 2 - 1.5];
      const s = h.hw / 2 + 4, core = along ? [r[0] + 6, r[1] - 6, h.z - s, h.z + s] : [h.x - s, h.x + s, r[2] + 6, r[3] - 6];   // the middle of the span always has its drop
      const c = clip(r, core, o => o.hall === h.i); const p = { k: 'bridge', hall: h.i, r: c || core, ok: !!c }; out.push(p); obs.push({ pit: 1, r: p.r }); }
    return (lay.pits = out); };
  // can you walk through hall h right now? (its gate opens when the room before it is cleared; a boss or mini-boss room seals while you fight)
  // rs = the run's room states ('c' clear, 'a' active, 'i' idle, as letters or {st})
  W.hallOpen = (lay, rs, h) => { const q = lay.halls[h], S = k => { const v = rs[k]; return typeof v === 'string' ? v[0] : v && v.st ? v.st[0] : 'i'; };
    if (S(q.a) !== 'c') return false; const b = lay.rooms[q.b]; return !((b.kind === 'boss' || b.kind === 'mini') && S(q.b) === 'a'); };
  // the room or hall an area id names (rooms 0..n, halls 100+)
  W.area = (lay, a) => a >= 100 ? lay.halls[a - 100] : lay.rooms[a];
  // how slimes get around: for every pair of areas, the next area on the way, and the doorway to aim for
  W.nav = lay => { if (lay.navT) return lay.navT; const adj = new Map(), ids = lay.rooms.map(q => q.i).concat(lay.halls.map(h => 100 + h.i));
    for (const id of ids) adj.set(id, []);
    for (const h of lay.halls) { const [dx, dz] = DIRV[h.dir], H = 100 + h.i;
      adj.get(h.a).push({ to: H, x: h.pa.x + dx * 2, z: h.pa.z + dz * 2 }); adj.get(H).push({ to: h.a, x: h.pa.x - dx * 2.5, z: h.pa.z - dz * 2.5 });
      adj.get(h.b).push({ to: H, x: h.pb.x - dx * 2, z: h.pb.z - dz * 2 }); adj.get(H).push({ to: h.b, x: h.pb.x + dx * 2.5, z: h.pb.z + dz * 2.5 }); }
    const next = {}; for (const s0 of ids) { const nx = next[s0] = {}, seen = new Set([s0]), q = [];
      for (const e of adj.get(s0)) { nx[e.to] = e; seen.add(e.to); q.push([e.to, e]); }
      while (q.length) { const [a, first] = q.shift(); for (const e of adj.get(a)) if (!seen.has(e.to)) { seen.add(e.to); nx[e.to] = first; q.push([e.to, first]); } } }
    return (lay.navT = { adj, next }); };
  // is a circle of radius rad standing on the floor? halls only count if hallOk(h) says so (closed gates block slimes too)
  W.floorOk = (lay, x, z, rad, hallOk) => {
    for (const q of lay.rooms) { if (q.round) { if (Math.hypot(x - q.x, z - q.z) <= q.round - rad) return true; } else if (Math.abs(x - q.x) <= q.w / 2 - rad && Math.abs(z - q.z) <= q.d / 2 - rad) return true; }
    for (const h of lay.halls) { if (hallOk && !hallOk(h.i)) continue; const ac = h.ax === 'z' ? Math.abs(x - h.x) <= h.w / 2 - rad && Math.abs(z - h.z) <= h.d / 2 + rad + 0.6 : Math.abs(z - h.z) <= h.d / 2 - rad && Math.abs(x - h.x) <= h.w / 2 + rad + 0.6; if (ac) return true; }
    return false; };
  // a run's treasure chest (maybe a Mimic), shrine, which side rooms are vaults or ambushes, and how the vents are timed: picked by the run's seed, so the server and every player agree
  L.runFeat = (i, seed) => { const lay = W.layout(i), r = L.mulberry((seed | 0) ^ 0x5eed), a = Math.floor(r() * lay.spots.length); let b = Math.floor(r() * lay.spots.length); for (let k = 0; k < lay.spots.length && lay.spots[b].room === lay.spots[a].room; k++) b = (b + 1) % lay.spots.length;
    const kind = C.SHRINES[Math.floor(r() * C.SHRINES.length)].id, side = {}; for (const q of lay.rooms) if (q.kind === 'side') side[q.i] = r() < 0.5 ? 'ambush' : 'vault';
    return { chest: Object.assign({ mimic: r() < C.CHEST.MIMIC }, lay.spots[a]), shrine: Object.assign({ kind }, lay.spots[b]), side, vph: r() * C.HAZ.VENT_PERIOD }; };
  // where the spike strip in a hall is right now: 0 idle, 1 warning, 2 spikes up (t = run time)
  L.trapState = (tr, t) => { const c = ((t + tr.ph) % C.TRAP.PERIOD + C.TRAP.PERIOD) % C.TRAP.PERIOD, up = C.TRAP.PERIOD - C.TRAP.UP; return c >= up ? 2 : c >= up - C.TRAP.WARN ? 1 : 0; };
  // a vent: 0 quiet, 1 rumbling (warning), 2 erupting
  // Update 6 hazards (the same answers on the server and in the page, so nothing needs to be sent): 0 calm, 1 warning, 2 active
  L.tideState = (h, t) => { const H = C.HAZ, c = ((t + h.ph) % H.TIDE_PERIOD + H.TIDE_PERIOD) % H.TIDE_PERIOD, up = H.TIDE_PERIOD - H.TIDE_UP; return c >= up ? 2 : c >= up - H.TIDE_WARN ? 1 : 0; };
  L.tideLevel = (h, t) => { const H = C.HAZ, c = ((t + h.ph) % H.TIDE_PERIOD + H.TIDE_PERIOD) % H.TIDE_PERIOD, up = H.TIDE_PERIOD - H.TIDE_UP, w = up - H.TIDE_WARN;
    return c >= up ? Math.min(1, (H.TIDE_PERIOD - c) / 0.8) : c >= w ? (c - w) / H.TIDE_WARN : 0; };   // 0 dry .. 1 flooded (for drawing the water)
  L.tideSafe = (h, x, z) => h.safe.some(q => Math.hypot(x - q[0], z - q[1]) < q[2]);
  L.starState = (h, t) => { const H = C.HAZ, c = ((t + h.ph) % H.STAR_PERIOD + H.STAR_PERIOD) % H.STAR_PERIOD, up = H.STAR_PERIOD - H.STAR_UP; return c >= up ? 2 : c >= up - H.STAR_WARN ? 1 : 0; };
  L.bladeAng = (h, t) => (t + h.ph) * C.HAZ.BLADE_SPEED * (h.dir || 1);
  // is (x, z) on one of the two spinning arms (a bar through the centre)?
  L.bladeHit = (h, t, x, z) => { const dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz); if (d > h.r + 0.4 || d < 0.6) return false; const a = L.bladeAng(h, t);
    const across = Math.abs(dx * Math.cos(a) - dz * Math.sin(a)); return across < 0.75; };
  L.ventState = (v, t, vph) => { const H = C.HAZ, c = ((t + v.ph + (vph || 0)) % H.VENT_PERIOD + H.VENT_PERIOD) % H.VENT_PERIOD, up = H.VENT_PERIOD - H.VENT_UP; return c >= up ? 2 : c >= up - H.VENT_WARN ? 1 : 0; };
  // is (x,z) on the floor of this dungeon? returns the room index, 100 + hall index, or -1
  // a hall reaches a little further into its rooms than the rooms' padding, so a doorway never has a gap where you get stuck
  W.where = (i, x, z, pad) => { const lay = W.layout(i); pad = pad || 0;
    for (const q of lay.rooms) { if (q.round) { if (Math.hypot(x - q.x, z - q.z) <= q.round - pad) return q.i; } else if (Math.abs(x - q.x) <= q.w / 2 - pad && Math.abs(z - q.z) <= q.d / 2 - pad) return q.i; }
    for (let h = 0; h < lay.halls.length; h++) { const q = lay.halls[h], e = Math.max(0.01, pad + 0.1);
      if (q.ax === 'z' ? Math.abs(x - q.x) <= q.w / 2 - pad && Math.abs(z - q.z) <= q.d / 2 + e : Math.abs(z - q.z) <= q.d / 2 - pad && Math.abs(x - q.x) <= q.w / 2 + e) return 100 + h; }
    return -1; };
  // the Pit's layout: one big round room
  W.pit = { rooms: [{ i: 0, kind: 'pit', x: W.ARENA.x, z: W.ARENA.z, w: 46, d: 46, round: W.ARENA.r }], halls: [] };
  // ---- the Wilds: one huge open clearing (a round 'room'), camps of slimes, roads, woods, hidden wayshrines, the Far Gates to the Update 6 worlds
  W.WILD = { x: C.WILD.X, z: C.WILD.Z, r: C.WILD.R };
  W.inWild = (x, z) => Math.hypot(x - W.WILD.x, z - W.WILD.z) < W.WILD.r + 30;
  W.wild = (() => { const X = W.WILD.x, Z = W.WILD.z, R = W.WILD.r, r = L.mulberry(4242), room = { i: 0, kind: 'wild', x: X, z: Z, w: R * 2, d: R * 2, round: R };
    const start = { x: X + R - 12, z: Z }, exit = { x: X + R - 4, z: Z }, camp0 = { x: X + 18, z: Z };   // the Wanderers' Camp in the middle (a safe spot)
    const gates = [9, 10, 11].map((k, j) => ({ k, x: X - R + 9, z: Z + (j - 1) * 26 }));
    // roads: from the gate to the camp, from the camp to each Far Gate, and a loop
    const roads = [[start, camp0], ...gates.map(g => [camp0, g]), [camp0, { x: X - 20, z: Z + 70 }], [camp0, { x: X - 10, z: Z - 72 }]];
    const nearRoad = (x, z, m) => roads.some(([a, b]) => { const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz, k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)); return Math.hypot(x - a.x - dx * k, z - a.z - dz * k) < m; });
    const camps = [], keep = [start, exit, camp0, ...gates].map(q => [q.x, q.z, 14]);
    for (let t = 0; t < 600 && camps.length < C.WILD.CAMPS; t++) { const a = r() * Math.PI * 2, d = 26 + r() * (R - 38), x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d;
      if (keep.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2] + 10) || camps.some(c => Math.hypot(c.x - x, c.z - z) < 26)) continue;
      const far = Math.hypot(x - start.x, z - start.z) / (R * 2); camps.push({ k: camps.length, x, z, r: 7, tier: far < 0.4 ? 0 : far < 0.7 ? 1 : 2 }); }
    // five wayshrines hidden near the edge of the woods, off the roads
    const ways = []; for (let t = 0; t < 800 && ways.length < C.WILD.WAYS; t++) { const a = r() * Math.PI * 2, d = R - 10 - r() * 14, x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d;
      if (nearRoad(x, z, 12) || keep.some(q => Math.hypot(q[0] - x, q[1] - z) < 24) || camps.some(c => Math.hypot(c.x - x, c.z - z) < 16) || ways.some(w => Math.hypot(w.x - x, w.z - z) < 40)) continue; ways.push({ i: ways.length, x, z }); }
    // woods and rocks (solid): thick near the edge, thin in the middle, never on a road, a camp or a secret
    const obst = []; for (let t = 0; t < 2600 && obst.length < 230; t++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (R - 3), x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d, edge = d / R;
      if (r() > 0.25 + edge * 0.85) continue; const rr = 0.8 + r() * 0.8;
      if (nearRoad(x, z, 5) || keep.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2]) || camps.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 5) || ways.some(w => Math.hypot(w.x - x, w.z - z) < 4.5) || obst.some(o => Math.hypot(o.x - x, o.z - z) < o.r + rr + 1.2)) continue;
      obst.push({ x, z, r: rr, k: r() < 0.72 ? 'trees' : 'stones', room: 0 }); }
    return { rooms: [room], halls: [], obst, camps, ways, gates, roads, start, exit, camp0, props: [], traps: [], haz: [], bb: { x0: X - R, x1: X + R, z0: Z - R, z1: Z + R } }; })();
  // a camp's slimes: from a dungeon you have reached (each camp its own), as strong as your best dungeon; later camps bring an elite
  L.wildPack = (s, c, round) => { const best = L.bestDun(s), i = (c.k * 3 + (round || 0)) % (best + 1), d = C.DUNGEONS[i], n = C.WILD.PACK[c.tier] + Math.min(2, round || 0), out = [];
    for (let j = 0; j < n; j++) { const elite = c.tier >= C.WILD.ELITE_AT && j === 0, id = elite ? d.elite : d.mobs[j % 3], st = L.mobStats(best, C.MOBS[id] ? id : d.mobs[0], 0, 1, elite ? 'elite' : 'mob');
      out.push(Object.assign({ id, kind: elite ? 'elite' : 'mob' }, st)); } return out; };
  L.wildReward = function (s, camps, ctx, rng) {
    camps = clamp(camps | 0, 0, 300); let { xp, gold } = L.modePay(s, 'wild', camps);
    xp = Math.round(xp * L.xpMult(s, ctx)); gold = Math.round(gold * L.goldMult(s, ctx));
    L.give(s, gold); const ups = L.addXp(s, xp); s.wildCamps = (s.wildCamps || 0) + camps; return ok({ camps, xp, gold, items: [], kept: [], sold: 0, ups, level: s.level }); };
  // the Boss Raid arena (every raid instance uses the same arena, each party sees only its own fight)
  W.RAIDA = { x: -800, z: 420, r: 24 };
  W.inRaid = (x, z) => Math.hypot(x - W.RAIDA.x, z - W.RAIDA.z) < W.RAIDA.r + 30;
  W.raid = { rooms: [{ i: 0, kind: 'boss', x: W.RAIDA.x, z: W.RAIDA.z, w: 46, d: 46, round: W.RAIDA.r }], halls: [] };

  // ================================================================ items
  // item: {u (id), t (tier = dungeon), s (slot w/h/a/g/b/r), k (kind), c (class or ''), r (rarity), lv (level needed), up (+0..10), en (rune),
  //        ax (bonus stat ids), raid (raid ring), nw (new: not looked at yet)}
  const SLOT_N = {}; for (const k in C.SLOTS) SLOT_N[k] = C.SLOTS[k].n;
  L.SLOT_N = SLOT_N; L.SLOTS = C.SLOT_ORDER;
  const KIND_N = { sword: 'Blade', greatsword: 'Greatsword', hammer: 'Maul', dagger: 'Fangs', staff: 'Staff', helm: 'Helm', hood: 'Hood', plate: 'Plate', robe: 'Robes', ring: 'Ring',
    gauntlet: 'Gauntlets', wraps: 'Handwraps', greaves: 'Greaves', boots: 'Boots' };
  L.KIND_N = KIND_N;
  // what each class wears in each slot
  const KINDS = { warrior: { h: 'helm', a: 'plate', g: 'gauntlet', b: 'greaves' }, mage: { h: 'hood', a: 'robe', g: 'wraps', b: 'boots' } };
  const MAIN_W = { warrior: 'sword', mage: 'staff' };
  L.kindFor = (cls, slot) => slot === 'w' ? (MAIN_W[cls] || 'sword') : slot === 'r' ? 'ring' : (KINDS[cls] || KINDS.warrior)[slot];
  const ALL_KINDS = Object.keys(KIND_N);
  const grow = lv => Math.pow(C.GEAR.GROWTH, lv - 1), rm = it => C.GEAR_RARITY[it.r].m, upg = it => 1 + (it.up || 0) * C.GEAR.UPGRADE_STAT;
  L.grow = grow;
  const slotOf = it => C.SLOTS[it.s] || C.SLOTS.w;
  // Update 7 (final): an item has one stat, Power (damage): its level, rarity, upgrades and slot. Nothing else (no health, no defense, no % bonuses)
  L.itemPow = it => it ? C.GEAR.POW * grow(it.lv) * rm(it) * upg(it) * slotOf(it).pow : 0;
  L.itemPowAt = (it, up) => it ? C.GEAR.POW * grow(it.lv) * rm(it) * (1 + up * C.GEAR.UPGRADE_STAT) * slotOf(it).pow : 0;   // what it would have at +up
  L.itemName = it => { if (it.raid !== undefined && C.RAIDS[it.raid]) return C.RAIDS[it.raid].ring + (it.up ? ' +' + it.up : ''); const t = C.GEAR_TIERS[it.t] || C.GEAR_TIERS[0]; return t.p + ' ' + (KIND_N[it.k] || 'Gear') + (it.up ? ' +' + it.up : ''); };
  L.itemValue = it => Math.max(1, Math.round(C.GEAR.SELL * grow(it.lv) * rm(it) * (1 + (it.up || 0) * 0.3) * (it.raid !== undefined ? C.RAID_BOSS.RING_VALUE : 1)));
  L.upgradeCost = it => Math.round(C.GEAR.UPGRADE_COST * grow(it.lv) * rm(it) * Math.pow(C.GEAR.UPGRADE_GROWTH, it.up || 0));
  L.itemClassOk = (s, it) => !it.c || it.c === s.cls;
  L.canEquip = (s, it) => !!it && s.level >= it.lv && L.itemClassOk(s, it);
  L.item = (s, u) => s.inv.find(it => it.u === u);
  L.eqItem = (s, slot) => s.eq[slot] ? L.item(s, s.eq[slot]) : null;
  // a random piece of loot: tier (dungeon), level, which class it leans to, luck (rarity), opts {slot, rarity, ring}
  // luck helps the rarest tiers most: rarity i gets luck^(i/3) (Nightmare = 6 luck makes Legendary ~6x likelier)
  L.rollRarity = (luck, rng) => { const w = C.GEAR_RARITY.map((r, i) => i === 0 ? r.w : r.w * Math.pow(Math.max(1, luck), i / 3)), t = w.reduce((a, b) => a + b, 0); let x = rng() * t; for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return 0; };
  L.rollSlot = (rng, ringOk) => { const list = C.SLOT_ORDER.filter(k => ringOk || k !== 'r'), tot = list.reduce((a, k) => a + C.SLOTS[k].drop, 0); let x = rng() * tot; for (const k of list) { x -= C.SLOTS[k].drop; if (x < 0) return k; } return 'w'; };
  L.makeItem = function (s, tier, lv, opts, rng) {
    opts = opts || {}; const others = Object.keys(C.CLASSES).filter(c => c !== s.cls), cls = rng() < C.GEAR.CLASS_SHARE ? s.cls : others[(s.uid || 0) % others.length];
    const slot = opts.slot || (opts.ring ? 'r' : L.rollSlot(rng, opts.ringOk));
    const WS = (C.CLASSES[cls] || C.CLASSES.warrior).weapons || ['sword'], k = slot === 'w' ? (cls === 'mage' ? 'staff' : WS[Math.floor(rng() * WS.length)]) : L.kindFor(cls, slot);
    return { u: 0, t: tier, s: slot, k, c: slot === 'r' ? '' : cls, r: opts.rarity !== undefined ? opts.rarity : L.rollRarity(opts.luck || 1, rng), lv: clamp(Math.round(lv), 1, C.MAX_LEVEL), up: 0 };
  };
  L.invMax = s => C.GEAR.INV_MAX;
  // the bag only holds what you are NOT wearing (equipped gear sits in its slot, not in the bag)
  L.bagN = s => s.inv.reduce((n, it) => n + (L.isEquipped(s, it.u) || it.st ? 0 : 1), 0);
  // Update 7 · Storage: items you keep out of your bag (they do not count against it); it.st marks a stored item
  L.stashN = s => s.inv.reduce((n, it) => n + (it.st && !L.isEquipped(s, it.u) ? 1 : 0), 0);
  L.store = function (s, u, on) { const it = L.item(s, u); if (!it) return no('No such item'); if (L.isEquipped(s, u)) return no('Take it off first');
    if (on) { if (it.st) return no('Already in Storage'); if (L.stashN(s) >= C.GEAR.STASH_MAX) return no('Your Storage is full (' + C.GEAR.STASH_MAX + ')'); it.st = 1; delete it.nw; }
    else { if (!it.st) return no('Not in Storage'); if (L.bagN(s) >= L.invMax(s)) return no('Your inventory is full'); delete it.st; }
    return { ok: true, u, on: !!on }; };
  // Update 7 · Swap: back to the weapon you held before (s.prevW, set whenever you equip a different weapon)
  L.swapWeapon = function (s) { const it = s.prevW && L.item(s, s.prevW); if (!it || L.isEquipped(s, it.u)) return no('No other weapon to swap to'); return L.equip(s, it.u); };
  // adds loot to the inventory. returns {kept: bool, sold: gold} (a full inventory or auto-sell turns it into gold)
  L.addItem = function (s, it) {
    if ((it.r <= 1 && s.autoSell[it.r]) || L.bagN(s) >= L.invMax(s)) { const g = L.itemValue(it); L.give(s, g, 0); return { kept: false, sold: g }; }
    it.u = s.uid++; it.nw = 1; s.inv.push(it); if (it.r >= 4) s.lootLeg++; return { kept: true, sold: 0 };
  };
  L.starter = (s, cls, slot) => { slot = slot || 'w'; const it = { u: s.uid++, t: 0, s: slot, k: L.kindFor(cls, slot), c: cls, r: 0, lv: 1, up: 0 }; s.inv.push(it); return it; };
  // display lines for an item: [label, value, kind] kind: 'pow' | 'hp' | 'def' | affix id
  L.itemLines = it => [{ k: 'pow', n: 'Power', v: L.itemPow(it) }];

  // ================================================================ state
  L.fresh = name => {
    const s = {
      v: C.VERSION, name: name || 'Slayer', cls: 'warrior', gold: 0, goldTotal: 0, xp: 0, level: 1, stats: { pow: 0, spl: 0, vit: 0 },
      inv: [], eq: { w: 0, h: 0, a: 0, g: 0, b: 0, r: 0 }, uid: 1, autoSell: [false, false], drops: [],
      spells: { warrior: ['cleave', 'charge'], mage: ['fireball', 'icelance'] }, rv: 10,
      styleBest: 0,
      kills: 0, killsBy: {}, bossKills: 0, clears: 0, nmClears: 0, hcClears: 0, lootLeg: 0, pitBest: 0, deaths: 0, spellsCast: 0, dun: {}, raids: {}, raidClears: 0, cosm: [],
      relics: [],
      look: { skin: '#f0c8a0', hair: 'messy', hairC: '#121116', hairC2: '#7a1a20', eye: '#6a7a90', eyeStyle: 'sharp', face: 'serious', freckles: false,
        outfit: 'tee', shirt: '#2a2d36', shirt2: '#15151a', pattern: 'plain', sleeve: 'short', pants: '#1c1e25', shorts: false, shoes: '#15151a',
        gear1: '#3a2218', gear2: '#5a1018', glow: '#3ab8ff', cape: '', capeC: '#15151a', trail: '#bfe8ff', shape: 'regular', height: 1, head: 1, mask: '' },
      showArmor: true, outfits: [null, null, null], skins: { own: [], armor: '', weapon: '' }, title: 'rookie', ms: {}, giftDay: '', daily: { last: '', streak: 0 }, time: 0
    };
    // you start with a weapon, a helmet and armour for both classes (the Warrior set is worn)
    for (const sl of ['w', 'h', 'a']) { const it = L.starter(s, 'warrior', sl); s.eq[sl] = it.u; L.starter(s, 'mage', sl); }
    return s;
  };
  L.migrate = s => {
    const f = L.fresh(s && s.name);
    if (!s || typeof s !== 'object' || s.v !== C.VERSION) return f;
    // gear rarities used to be 7 (with Mythic): Mythic becomes Legendary, Ultimate moves down one. Life steal / regen stats and runes are gone
    if (!s.rv && Array.isArray(s.inv)) { for (const it of s.inv) { if (!it) continue; if (it.r === 5) it.r = 4; else if (it.r >= 6) it.r = 5; } s.rv = 2; }
    // Update 5: levels are 1.5x (max 75 -> 112). Your level, your gear's levels and your stat points move to the new scale, so you are exactly as strong
    if ((s.rv | 0) < 3) { const up = v => v <= 1 ? 1 : Math.min(C.MAX_LEVEL, Math.round(v * 1.5)), oldNeed = lv => 60 * Math.pow(1.12, lv - 1) * (lv < 5 ? 0.4 + lv * 0.12 : 1);
      const lv0 = Math.max(1, s.level | 0), lv1 = up(lv0), frac = lv0 >= 75 ? 0 : clamp((s.xp || 0) / oldNeed(lv0), 0, 0.99); s.level = lv1; s.xp = Math.round(frac * L.xpNeed(lv1));
      if (Array.isArray(s.inv)) for (const it of s.inv) if (it) it.lv = up(it.lv | 0);
      if (s.stats) { const tot = (lv1 - 1) * C.STAT_PER_LEVEL, old = (s.stats.pow | 0) + (s.stats.spl | 0) + (s.stats.vit | 0), k = old ? tot / Math.max(old, (lv0 - 1) * 2) : 0;
        for (const st of ['pow', 'spl', 'vit']) s.stats[st] = Math.floor((s.stats[st] | 0) * k); }
      s.rv = 3; }
    if (Array.isArray(s.inv)) for (const it of s.inv) { if (!it) continue; it.r = clamp(it.r | 0, 0, C.GEAR_RARITY.length - 1); }
    for (const k in f) if (s[k] === undefined || typeof s[k] !== typeof f[k] || Array.isArray(f[k]) !== Array.isArray(s[k])) s[k] = f[k];
    for (const k of ['daily', 'look', 'stats', 'eq', 'spells']) for (const j in f[k]) if (s[k][j] === undefined) s[k][j] = f[k][j];
    if ((s.rv | 0) < 7) L.migrate7(s);
    if ((s.rv | 0) < 8) L.migrate8(s);
    if ((s.rv | 0) < 9) L.migrate9(s);
    if ((s.rv | 0) < 10) L.migrate10(s);
    if (!C.CLASSES[s.cls]) s.cls = 'warrior';
    // abilities that are no longer allowed (renamed, removed, or a higher unlock level) come off the bar; the bar keeps the first SPELL_SLOTS that are
    // still allowed (Update 7: 4 slots became 2), and an empty bar gets the class's two starters back
    for (const cls in s.spells) { if (!C.CLASSES[cls]) { delete s.spells[cls]; continue; } const was = s.cls; s.cls = cls;
      let list = (Array.isArray(s.spells[cls]) ? s.spells[cls] : []).filter((id, k, a) => id && a.indexOf(id) === k && L.spellOk(s, L.spell(id))).slice(0, C.SPELL_SLOTS);
      if (!list.length) list = f.spells[cls].slice(); s.cls = was; while (list.length < C.SPELL_SLOTS) list.push(''); s.spells[cls] = list; }
    s.inv = s.inv.filter(it => it && it.k && (C.TYPES[it.k] || ALL_KINDS.includes(it.k)) && C.SLOTS[it.s]);
    // older saves had no starter armour: give the basic helmet + armour to anyone who has none
    for (const sl of ['h', 'a']) if (!s.inv.some(it => it.s === sl)) { for (const cls of ['warrior', 'mage']) { const it = L.starter(s, cls, sl); if (cls === s.cls && !s.eq[sl]) s.eq[sl] = it.u; } }
    for (const sl in s.eq) if (s.eq[sl] && !L.item(s, s.eq[sl])) s.eq[sl] = 0;
    if (!Array.isArray(s.drops)) s.drops = [];
    if (!L.validLook(s.look, s)) s.look = f.look;
    if (s.pass) L.passEnsure(s);   // Update 6 · phase 8: tiers cost more now, keep the tier you had
    { const S = L.skinsOf(s); S.own = [...new Set(S.own.filter(id => typeof id === 'string' && L.cosm(id)))]; for (const k of ['armor', 'weapon']) { const q = L.cosm(S[k]); if (!q || q.k !== k || !S.own.includes(S[k])) S[k] = ''; } }
    return s;
  };
  // Update 7: gems, pets, eggs, the Gem Shop and talents are gone. Whatever an old save had becomes gold, once (the numbers are C.MIGRATE7).
  // clears = Normal clears of the save's best dungeon. s.mig7 keeps what was converted so the game can say so once (then it is cleared)
  L.GONE7 = ['gems', 'gemsTotal', 'invBought', 'slotsBought', 'pets', 'plv', 'pxp', 'index', 'hatched', 'legend', 'autoDel', 'boost', 'tal'];
  // Update 7 · phase 2: the new ladder. An old level (and every item's level) slides along C.MIGRATE8, so you stand at the same place on the ladder;
  // you keep the same share of the way to your next level, and your stat points scale to the new total
  L.remapLevel = v => { const M = C.MIGRATE8, o = M.OLD, n = M.NEW; v = Math.max(1, +v || 1); if (v >= o[o.length - 1]) return n[n.length - 1];
    for (let k = 0; k < o.length - 1; k++) if (v <= o[k + 1]) return clamp(Math.round(n[k] + (v - o[k]) * (n[k + 1] - n[k]) / (o[k + 1] - o[k])), 1, C.MAX_LEVEL); return C.MAX_LEVEL; };
  L.migrate8 = s => {
    const oldNeed = lv => Math.round(30 * Math.pow(1.0785, lv - 1) * (lv < 8 ? 0.4 + lv * 0.6 / 8 : 1));   // Update 6's cost of a level
    const lv0 = clamp(s.level | 0, 1, 150), lv1 = L.remapLevel(lv0), frac = lv0 >= 150 ? 0 : clamp((+s.xp || 0) / oldNeed(lv0), 0, 0.99);
    s.level = lv1; s.xp = lv1 >= C.MAX_LEVEL ? 0 : Math.floor(frac * L.xpNeed(lv1));
    if (Array.isArray(s.inv)) for (const it of s.inv) if (it) it.lv = clamp(L.remapLevel(it.lv | 0), 1, C.MAX_LEVEL);
    if (s.stats) { const tot = (lv1 - 1) * C.STAT_PER_LEVEL, used = (s.stats.pow | 0) + (s.stats.spl | 0) + (s.stats.vit | 0), k = used ? tot / Math.max(used, (lv0 - 1) * C.STAT_PER_LEVEL) : 0;
      for (const st of ['pow', 'spl', 'vit']) s.stats[st] = Math.floor((s.stats[st] | 0) * k); }
    s.rv = 8;
  };
  // Update 7 · phase 3: two classes. Shadowblades and Guardians become Warriors (their gear becomes Warrior gear: same level, rarity, bonuses and
  // upgrades; daggers and hammers stay daggers and hammers); tome abilities are gone (the ladder gives every ability), each one learned pays gold
  L.migrate9 = s => {
    const tomes = Array.isArray(s.learned) ? s.learned.filter(x => typeof x === 'string').length : 0;
    if (!C.CLASSES[s.cls]) s.cls = 'warrior';
    if (Array.isArray(s.inv)) for (const it of s.inv) { if (!it || !it.c || C.CLASSES[it.c]) continue; it.c = 'warrior'; if (it.s !== 'w' && it.s !== 'r') it.k = L.kindFor('warrior', it.s); }
    if (s.spells) for (const k of Object.keys(s.spells)) if (!C.CLASSES[k]) delete s.spells[k];
    if (tomes) { const g = L.give(s, L.clears(s, tomes * C.MIGRATE9.TOME)); s.mig7 = s.mig7 || { gems: 0, pets: 0, talents: 0, gold: 0 }; s.mig7.tomes = tomes; s.mig7.gold += g; }
    delete s.learned; s.rv = 9;
  };
  // Update 7 (final): ultimates, daily quests, weekly challenges, bonus stats on gear and runes are gone. Every rune that was on an item pays
  // MIGRATE10.RUNE dust (for the Shop's chests); gear keeps its level, rarity and upgrades (its Power)
  L.migrate10 = s => {
    let runes = 0; if (Array.isArray(s.inv)) for (const it of s.inv) { if (!it) continue; if (it.en) runes++; delete it.en; delete it.ax; delete it.x; delete it.x2; }
    if (runes) s.dust = (s.dust || 0) + runes * C.MIGRATE10.RUNE;
    for (const k of ['ult', 'q', 'ch']) delete s[k]; s.rv = 10;
  };
  L.seenMig7 = s => { delete s.mig7; return ok({ quiet: 1 }); };
  L.migrate7 = (s, now) => {
    const M = C.MIGRATE7, clear = Math.max(1, L.runGold(L.bestDun(s))), n = v => Math.max(0, Math.min(1e12, +v || 0)); now = now || Date.now();
    let gems = Math.floor(n(s.gems)), nPets = 0, nTal = 0, petGold = 0;
    for (let k = 0; k < Math.min(n(s.invBought), M.BAG_GEMS.length); k++) gems += M.BAG_GEMS[k];
    for (let k = 0; k < Math.min(n(s.slotsBought), M.SLOT_GEMS.length); k++) gems += M.SLOT_GEMS[k];
    if (s.boost && typeof s.boost === 'object') for (const k in s.boost) { const left = ((+s.boost[k] || 0) - now) / 60000; if (left > 0) gems += Math.round(Math.min(60, left) * M.BOOST_GEMS_MIN); }
    if (s.pets && typeof s.pets === 'object') for (const id in s.pets) { const cnt = Math.min(9999, Math.floor(n(s.pets[id]))), pid = +id; if (!cnt || !(pid >= 0)) continue;
      const tier = pid >= 2000 ? 2 : pid >= 1000 ? 1 : 0, b = pid - tier * 1000, egg = Math.floor(b / 7), r = b % 7; if (!(egg >= 0 && egg < M.PET_EGG.length)) continue;
      const lv = Math.max(1, Math.min(60, (s.plv && s.plv[id]) | 0)); petGold += cnt * M.PET_EGG[egg] * (M.PET_RARITY[r] || 1) * (M.PET_TIER[tier] || 1) + (lv - 1) * M.PET_LEVEL * clear; nPets += cnt; }
    if (s.tal && typeof s.tal === 'object') for (const cls in s.tal) if (Array.isArray(s.tal[cls])) nTal += Math.min(60, s.tal[cls].filter(x => typeof x === 'string').length);
    const gold = Math.round(gems * M.GEM * clear + petGold + nTal * M.TALENT * clear);
    if (gold > 0) { L.give(s, gold); s.mig7 = { gems, pets: nPets, talents: nTal, gold }; }
    for (const k of L.GONE7) delete s[k];
    if (s.title === 'tamer') s.title = 'rookie';
    s.rv = 7;
  };

  // ================================================================ stats
  L.xpNeed = lv => Math.round(C.LEVEL_XP * Math.pow(C.LEVEL_GROWTH, lv - 1) * (lv < C.LEVEL_EASY ? 0.4 + lv * 0.6 / C.LEVEL_EASY : 1));
  L.statPoints = s => (s.level - 1) * C.STAT_PER_LEVEL - s.stats.pow - s.stats.spl - s.stats.vit;
  L.mainStat = s => s.stats[C.CLASSES[s.cls].stat] || 0;
  L.gearItems = s => C.SLOT_ORDER.map(k => L.eqItem(s, k)).filter(Boolean);
  L.weaponType = s => { const it = L.eqItem(s, 'w'); return it ? it.k : s.cls === 'mage' ? 'staff' : 'sword'; };
  L.type = s => C.TYPES[L.weaponType(s)];
  // Update 7 (final) · Power: every piece you wear (its Power) added up, x your class stat (each point +1%). Abilities hit with all of it (x their
  // own multiplier, +10% for each dungeon further along); weapon swings hit with BASIC.K of it (x the weapon type, +10% for each dungeon the weapon
  // is from): a third of what they used to, so abilities do the real damage. Health: your level and Vitality (armour gives none)
  L.weaponTier = s => { const w = L.eqItem(s, 'w'); return Math.pow(C.ABIL.WEAPON_TIER, w ? clamp(w.t | 0, 0, L.ND - 1) : 0); };
  L.dmgK = s => 1 + L.mainStat(s) * C.STAT_POWER;
  L.power = s => Math.max(3, C.SLOT_ORDER.reduce((a, k) => a + L.itemPow(L.eqItem(s, k)), 0)) * L.dmgK(s);
  L.ap = s => Math.max(1, L.power(s) * C.BASIC.K * L.type(s).pow * L.weaponTier(s));
  L.gearBase = it => it ? C.GEAR.POW * L.grow(it.lv) * C.GEAR_RARITY[it.r].m * (1 + (it.up || 0) * C.GEAR.UPGRADE_STAT) : 0;
  L.gearPower = L.power;
  L.maxHp = s => Math.round((C.BASE_HP + (s.level - 1) * C.HP_PER_LEVEL + C.HP_GROW * grow(s.level)) * C.CLASSES[s.cls].hp * (1 + s.stats.vit * C.STAT_VIT));
  L.red = s => 0; L.speed = s => L.type(s).speed; L.moveSpd = s => 1; L.regen = s => 0; L.crit = s => C.CRIT_CHANCE; L.critMult = s => C.CRIT_MULT; L.cdr = s => 0; L.leech = s => 0; L.abil = s => 0;
  // timed server events (every 30 minutes): returns {id: endTime} for active events plus the next one coming up
  L.events = now => { const m = (now / 60000) % 30, out = {}; let next = null, best = 99;
    for (const e of C.EVENTS) { if (m >= e.at && m < e.at + e.len) out[e.id] = now + (e.at + e.len - m) * 60000; const d = ((e.at - m) % 30 + 30) % 30; if (d < best && !out[e.id]) { best = d; next = { id: e.id, n: e.n, in: d * 60000 }; } }
    out.next = next; return out; };
  L.goldMult = (s, ctx) => ctx.ev && ctx.ev.coins ? 2 : 1;
  L.xpMult = (s, ctx) => 1 + C.PARTY_XP * Math.max(0, Math.min(C.PARTY_MAX, (ctx && ctx.party) | 0) - 1);
  L.streakLuck = s => Math.min(C.STREAK_LUCK_MAX, Math.max(0, (s.daily.streak || 0) - 1) * C.STREAK_LUCK);
  L.luck = (s, ctx) => 1 + (ctx.ev && ctx.ev.luck ? 0.5 : 0) + L.streakLuck(s);
  L.spellCd = (s, sp) => sp.cd;
  // the most damage per second this player could possibly deal (the server refuses faster kills)
  L.maxDps = s => { const ap = L.ap(s), gp = L.power(s), crit = 1 + Math.max(0, L.crit(s)) * (L.critMult(s) - 1), ty = L.type(s);
    let spells = 0; for (const id of s.spells[s.cls] || []) { const sp = L.spell(id); if (sp && sp.mult) spells += sp.mult * (sp.ticks || sp.count || sp.jumps || sp.strikes || (sp.dur && sp.every ? sp.dur / sp.every : 1)) / L.spellCd(s, sp) * 6; }
    return crit * (ap * L.speed(s) * 1.9 * 6 * ty.aoe * Math.max(1, C.COMBO[2]) + gp * spells * 1.6) * 1.3 * 1.6; };   // x1.6: Berserk, War Cry and shrines stack

  // ================================================================ rewards + levels
  // gold is the only currency (Update 7). clears(s, k) = k Normal clears of your best dungeon worth of gold: rewards that should matter at every level use it
  L.give = (s, gold) => { gold = Math.round(gold || 0); if (gold > 0) { s.gold += gold; s.goldTotal += gold; } return gold; };
  L.clears = (s, k) => Math.max(1, Math.round(L.runGold(L.bestDun(s)) * (k || 0)));
  L.addXp = (s, xp) => { let ups = 0; s.xp += xp; while (s.level < C.MAX_LEVEL && s.xp >= L.xpNeed(s.level)) { s.xp -= L.xpNeed(s.level); s.level++; ups++; } if (s.level >= C.MAX_LEVEL) s.xp = 0; return ups; };

  // ================================================================ dungeons
  L.dunRec = (s, i) => s.dun[i] || (s.dun[i] = { c: [0, 0, 0], hc: 0, best: [0, 0, 0] });
  // Update 7 · the ladder: step k = dungeon x 3 + difficulty needs level max(1, k x LADDER_STEP). Hardcore is the same level as its difficulty
  L.NSTEP = L.ND * 3;
  L.stepOf = (i, df) => i * 3 + (df | 0);
  // the dungeon clock: 12 minutes on Normal, 14 on Hard, 16 on Nightmare (Update 7 final: the slimes are tougher)
  L.dunTime = df => Math.round(C.DUN_TIME * ((C.DIFFS[df | 0] || C.DIFFS[0]).time || 1));
  L.stepLevel = k => Math.max(1, k * C.LADDER_STEP);
  L.dunLevel = (i, df) => L.stepLevel(L.stepOf(i, df));
  L.dunUnlocked = (s, i) => !!C.DUNGEONS[i] && s.level >= L.dunLevel(i, 0);
  L.diffUnlocked = (s, i, df) => s.level >= L.dunLevel(i, df);   // every difficulty opens by level (its step on the ladder)
  L.bestDun = s => { let b = 0; for (let i = 0; i < L.ND; i++) if (L.dunUnlocked(s, i)) b = i; return b; };
  // the hardest step a level can enter (for the guide, the finder and the balance sheet)
  L.bestStep = lv => { let k = 0; for (let j = 0; j < L.NSTEP; j++) if (lv >= L.stepLevel(j)) k = j; return k; };
  // how much of a run's XP and gold one slime is worth: its share of the run's health (boss, minis, elites weigh more)
  const hpmOf = (id, kind) => kind === 'boss' ? C.MOB.BOSS_HP : kind === 'mini' ? C.MOB.MINI_HP : kind === 'orb' ? C.BOSS.ORB_HP : (C.MOBS[id] || { hp: 1 }).hp;
  const RW = {}; L.runWeight = i => RW[i] || (RW[i] = Math.max(1, L.runList(i).reduce((a, m) => a + hpmOf(m.id, m.kind), 0)));
  // hp/dmg/xp/gold of one slime. kind: 'mob' | 'elite' | 'mini' | 'boss' | 'orb'. XP and gold are shared out so a full Normal clear always pays MOB.RUN_W slimes' worth
  // (Update 7 final: HPK makes slimes x1.4, mini-bosses x2.5 and bosses x2 tougher)
  // a party's enemies: x MOB.PARTY_HP health for every player who joins (compounding), counted up to PARTY_MAX players
  L.partyHp = n => Math.pow(C.MOB.PARTY_HP, Math.max(0, Math.min(C.PARTY_MAX, (n | 0) || 1) - 1));
  L.mobStats = (i, id, df, n, kind, hc) => {
    const m = C.MOBS[id] || { hp: 1, dmg: 1 }, D = L.dunLevel(i, df), k = L.stepOf(i, df), g = Math.pow(C.MOB.GROWTH, D - 1), diff = C.DIFFS[df], party = L.partyHp(n);
    const hpm = hpmOf(id, kind), dm = kind === 'boss' ? C.MOB.BOSS_DMG : kind === 'mini' ? C.MOB.MINI_DMG : m.dmg, share = C.MOB.RUN_W / L.runWeight(i);
    return { hp: Math.round(C.MOB.HP * g * (1 + C.MOB.HP_LEVEL * D) * hpm * diff.hp * party * Math.pow(C.MOB.STEP_HP, k) * (C.MOB.HPK[kind] || 1)), dmg: Math.round(C.MOB.DMG * g * dm * diff.dmg * (hc ? C.MOB.HC_DMG : 1) * Math.pow(C.MOB.STEP_DMG, k) * 10) / 10,
      xp: C.MOB.XP * Math.pow(C.MOB.XP_GROWTH, D - 1) * hpm * share, gold: C.MOB.GOLD * g * hpm * share };
  };
  // the XP and gold of a full clear before your bonuses (gear, events, party): the same for every map at that step
  L.clearXp = (i, df, hc) => C.MOB.XP * Math.pow(C.MOB.XP_GROWTH, L.dunLevel(i, df) - 1) * C.MOB.RUN_W * (C.DIFFS[df].xp || 1) * (hc ? C.HARDCORE.xp : 1) * (1 + C.CLEAR_BONUS);
  // every slime a run spawns, room by room (also used for the anti-cheat time check and the reward totals)
  L.runMobs = (i, df, n, hc) => L.runList(i).map(m => Object.assign({}, m, L.mobStats(i, m.id, df, n, m.kind, hc)));
  const RL = {}; L.runList = i => {
    if (RL[i]) return RL[i]; const d = C.DUNGEONS[i], lay = W.layout(i), out = [];
    for (const room of lay.rooms) { if (!room.main) continue;
      if (room.kind === 'mob') room.waves.forEach((wave, wi) => wave.forEach(([m, c]) => { for (let j = 0; j < c; j++) out.push({ room: room.i, wave: wi, id: m === 'e' ? d.elite : d.mobs[m], kind: m === 'e' ? 'elite' : 'mob' }); }));
      if (room.kind === 'mini') { out.push({ room: room.i, wave: 0, id: L.miniOf(i, room), kind: 'mini' }); for (let j = 0; j < 2; j++) out.push({ room: room.i, wave: 0, id: d.mobs[0], kind: 'mob' }); }
      if (room.kind === 'boss') out.push({ room: room.i, wave: 0, id: d.boss, kind: 'boss' });
    }
    return (RL[i] = out);
  };
  L.miniOf = (i, room) => { const d = C.DUNGEONS[i]; return (d.minis || [d.elite])[room.mini || 0] || d.elite; };
  L.runGold = i => L.runMobs(i, 0, 1, false).reduce((a, m) => a + m.gold, 0) * (1 + C.CLEAR_BONUS);
  // the fastest a party could possibly clear (seconds): all slime health divided by everyone's best damage
  // the walk from the start through every main room to the boss, at the fastest anyone can move (move speed cap, straight lines between rooms)
  const WT = {}; L.walkTime = i => { if (WT[i] !== undefined) return WT[i]; const R = W.layout(i).rooms.filter(r => r.main && r.kind !== 'loot').sort((a, b) => a.i - b.i); let d = 0; for (let k = 1; k < R.length; k++) d += Math.hypot(R[k].x - R[k - 1].x, R[k].z - R[k - 1].z);
    return (WT[i] = d / (C.WALK_SPEED * 1.5)); };   // (the Shrine of Haste and dodge rolls: never faster than 1.5x walking)
  L.minClearTime = (i, df, n, hc, partyDps) => Math.max(L.runMobs(i, df, n, hc).reduce((a, m) => a + m.hp, 0) / Math.max(1, partyDps) * C.MIN_CLEAR_FRACTION, L.walkTime(i) * C.MIN_WALK_FRACTION);
  // rewards for one player at the end of a run. rooms = rooms cleared (6 = boss dead), kills = slimes slain by the party
  // the luck and level of loot dropped in a run (also used by the dungeon simulation for each player's drops)
  L.lootLuck = (df, hc, luck) => C.DIFFS[df].luck * (hc ? C.HARDCORE.luck : 1) * (luck || 1);
  // Update 7: loot is never above the run's level (the run's level is the cap): the step's level, or up to LV_SPREAD below it
  L.lootLevel = (i, df, hc, rng) => Math.max(1, L.dunLevel(i, df) - Math.floor(rng() * (C.GEAR.LV_SPREAD + 1)));
  L.dropsN = hc => C.DROPS.BOSS_ITEMS + (hc ? C.HARDCORE.items : 0);   // items the final boss drops for each slayer (Hardcore: one more)
  // checks loot that came out of a run (the server's simulation made it; guests' saves only trust sane items)
  L.cleanItem = (it, i) => { if (!it || typeof it !== 'object' || !C.SLOTS[it.s] || !(C.TYPES[it.k] || ALL_KINDS.includes(it.k))) return null;
    const r = clamp(it.r | 0, 0, C.GEAR_RARITY.length - 1);
    return { u: 0, t: clamp(it.t | 0, 0, L.ND - 1), s: it.s, k: it.k, c: it.s === 'r' ? '' : (C.CLASSES[it.c] ? it.c : 'warrior'), r, lv: clamp(it.lv | 0, 1, C.MAX_LEVEL), up: 0, raid: it.raid !== undefined && C.RAIDS[it.raid] ? it.raid : undefined }; };
  L.runReward = function (s, i, df, hc, rooms, ctx, rng, secs, loot, extra) {
    const d = C.DUNGEONS[i], diff = C.DIFFS[df], mobs = L.runMobs(i, df, 1, hc).filter(m => m.room <= rooms), cleared = rooms >= W.layout(i).boss;
    const hcm = hc ? C.HARDCORE : { xp: 1, gold: 1, luck: 1, items: 0, lv: 0 };
    let xp = mobs.reduce((a, m) => a + m.xp, 0) * diff.xp * hcm.xp, gold = mobs.reduce((a, m) => a + m.gold, 0) * diff.gold * hcm.gold;
    if (cleared) { xp *= 1 + C.CLEAR_BONUS; gold *= 1 + C.CLEAR_BONUS; }
    // gold from crates and the treasure chest (counted in slimes' worth of gold by the simulation)
    const bonusUnits = extra ? clamp(+extra.gold || 0, 0, 200) : 0;
    gold += bonusUnits * L.mobStats(i, d.mobs[0], df, 1, 'mob', hc).gold * diff.gold * hcm.gold;
    // your best style rank in the run (worked out by the simulation) adds a little gold and XP
    const style = extra ? clamp(+extra.style | 0, 0, C.STYLE.RANKS.length - 1) : 0, sk = 1 + (C.STYLE.BONUS[style] || 0);
    xp = Math.round(xp * L.xpMult(s, ctx) * sk); gold = Math.round(gold * L.goldMult(s, ctx) * sk); if (style > (s.styleBest | 0)) s.styleBest = style;
    // the first clear of each dungeon + difficulty pays extra gold
    const rec = L.dunRec(s, i), first = cleared && !rec.c[df]; if (first) gold = Math.round(gold * (1 + C.FIRST_CLEAR_GOLD));
    // loot: what dropped for you in the dungeon (runs from the simulation pass it in); without it, roll the old way
    const items = [];
    if (Array.isArray(loot)) { for (const x of loot.slice(0, 40)) { const it = L.cleanItem(x, i); if (it) items.push(it); } }
    else { const nItems = cleared ? L.dropsN(hc) : 0, luck = L.lootLuck(df, hc, L.luck(s, ctx));
      for (let k = 0; k < nItems; k++) items.push(L.makeItem(s, i, L.lootLevel(i, df, hc, rng), { luck, ring: df === 2 && cleared && rng() < 0.12 }, rng)); }
    // apply
    L.give(s, gold); const ups = L.addXp(s, xp), kept = [];
    let sold = 0; for (const it of items) { const r = L.addItem(s, it); if (r.kept) kept.push(it.u); sold += r.sold; }
    L.noteDrops(s, kept);
    const kills = mobs.length; s.kills += kills;
    for (const m of mobs) s.killsBy[m.id] = (s.killsBy[m.id] || 0) + 1;
    for (const q of W.layout(i).rooms) if (q.kind === 'mini' && rooms >= q.i) { const id = L.miniOf(i, q); s.killsBy[id] = s.killsBy[id] || 1; }
    if (cleared) { rec.c[df]++; if (hc) { rec.hc++; s.hcClears++; } s.clears++; s.bossKills++; if (df === 2) s.nmClears++;
      if (secs && (!rec.best[df] || secs < rec.best[df])) rec.best[df] = Math.round(secs); }
    return ok({ i, df, hc: !!hc, cleared, xp, gold, items, kept, sold, ups, level: s.level, first, kills, style });
  };
  // the inventory's "recent drops" strip: newest first, at most 16
  L.noteDrops = (s, uids) => { if (!uids || !uids.length) return; s.drops = uids.slice().reverse().concat((s.drops || []).filter(u => !uids.includes(u))).slice(0, 16); };
  L.seen = (s, u) => { const it = u === 'all' ? null : L.item(s, u); if (u === 'all') { for (const x of s.inv) delete x.nw; return ok({}); } if (!it) return no('No such item'); delete it.nw; return ok({ u }); };
  // wave defence: wave w spawns these slimes (from your best dungeon)
  L.pitWave = (s, w) => { const i = L.bestDun(s), d = C.DUNGEONS[i], n = C.PIT.WAVE_MOBS + Math.floor(w * C.PIT.WAVE_ADD), out = [];
    for (let j = 0; j < n; j++) { const id = w % 5 === 0 && j === 0 ? d.elite : d.mobs[Math.min(2, Math.floor(j / 3 + w / 4)) % 3], st = L.mobStats(i, id, 0, 1, id === d.elite ? 'elite' : 'mob');
      out.push(Object.assign({ id, kind: id === d.elite ? 'elite' : 'mob' }, st, { hp: Math.round(st.hp * Math.pow(C.PIT.WAVE_GROWTH, w - 1)), dmg: Math.round(st.dmg * Math.pow(C.PIT.DMG_GROWTH, w - 1) * 10) / 10 })); } return out; };
  // what the Pit, the Tower and the Wilds pay: a share of a Normal clear of your best dungeon for every wave / floor / camp
  L.modePay = (s, mode, units) => { const P = C.MODE_PAY[mode], mobs = L.runMobs(L.bestDun(s), 0, 1, false), b = 1 + C.CLEAR_BONUS; let k = 0;
    for (let u = 1; u <= units; u++) k += P.k * (1 + P.grow * (Math.min(u, P.cap) - 1)); return { xp: mobs.reduce((a, m) => a + m.xp, 0) * b * k, gold: mobs.reduce((a, m) => a + m.gold, 0) * b * k }; };
  L.pitReward = function (s, waves, ctx, rng) {
    waves = clamp(waves | 0, 0, 200); let { xp, gold } = L.modePay(s, 'pit', waves);
    xp = Math.round(xp * L.xpMult(s, ctx)); gold = Math.round(gold * L.goldMult(s, ctx)); const items = [];   // gear only comes from dungeon bosses
    L.give(s, gold); const ups = L.addXp(s, xp), kept = []; let sold = 0; for (const it of items) { const r = L.addItem(s, it); if (r.kept) kept.push(it.u); sold += r.sold; }
    L.noteDrops(s, kept);
    const rec = waves > s.pitBest; if (rec) s.pitBest = waves; return ok({ waves, xp, gold, items, kept, sold, ups, rec, level: s.level });
  };

  // ================================================================ Update 6 · Phase 5: the Endless Tower, challenges + Battle Pass, crafting, pets 2.0, duels, bestiary
  // ---- the Endless Tower: what each floor holds (the seed only shuffles which creatures come; rewards use seed 1 so they never depend on luck)
  L.towerFloor = (s, f, seed) => { const T = C.TOWER, best = L.bestDun(s), r = L.mulberry(((seed || 1) * 31 + f * 7919) >>> 0), mut = f >= T.MUT_FROM ? C.MUTATORS[Math.floor(r() * C.MUTATORS.length)] : null;
    const pick = () => { const k = Math.floor(r() * (best + 1)); return C.DUNGEONS[k]; }, hpK = Math.pow(T.GROWTH, f - 1), dmK = Math.pow(T.DMG_GROWTH, f - 1), out = [];
    let n = T.MOBS + Math.floor(f * T.ADD); if (mut && mut.giants) n = Math.ceil(n / 2); if (mut && mut.swarm) n *= 2;
    if (f % T.BOSS_EVERY === 0) { const dd = pick(), st = L.mobStats(best, dd.boss, 0, 1, 'boss'); out.push({ id: dd.boss, kind: 'boss', hp: st.hp * T.BOSS_HP * hpK, dmg: st.dmg * dmK, xp: st.xp, gold: st.gold }); n = Math.ceil(n / 2); }
    else if (f % T.MINI_EVERY === 0) { const dd = pick(), ms = dd.minis || [dd.elite], id = ms[Math.floor(r() * ms.length)], st = L.mobStats(best, id, 0, 1, 'mini'); out.push({ id, kind: 'mini', hp: st.hp * hpK, dmg: st.dmg * dmK, xp: st.xp, gold: st.gold }); n = Math.ceil(n / 2); }
    for (let j = 0; j < n; j++) { const dd = pick(), elite = j === 0 && f % 3 === 0, id = elite ? dd.elite : dd.mobs[Math.floor(r() * 3)], st = L.mobStats(best, id, 0, 1, elite ? 'elite' : 'mob');
      out.push({ id, kind: elite ? 'elite' : 'mob', hp: st.hp * hpK * (mut && mut.giants ? 3 : mut && mut.swarm ? 0.34 : 1), dmg: st.dmg * dmK, xp: st.xp, gold: st.gold, sc: mut && mut.giants ? 1.9 : undefined, mod: mut && mut.mod }); }
    return { list: out, mut }; };
  L.towerReward = function (s, floors, ctx, rng) { const T = C.TOWER; floors = clamp(floors | 0, 0, 300); let { xp, gold } = L.modePay(s, 'tower', floors);
    xp = Math.round(xp * L.xpMult(s, ctx)); gold = Math.round(gold * L.goldMult(s, ctx)); L.give(s, gold); const ups = L.addXp(s, xp);
    const rec = floors > (s.towerBest || 0); if (rec) s.towerBest = floors; return ok({ floors, xp, gold, items: [], kept: [], sold: 0, ups, rec, level: s.level }); };
  // ---- the free Battle Pass (it fills from your runs)
  L.passEnsure = s => { if (!s.pass || s.pass.season !== C.PASS.SEASON) s.pass = { season: C.PASS.SEASON, xp: 0, claimed: [], v: 2 };
    if (s.pass.v !== 2) { s.pass.xp = Math.round(s.pass.xp * 1.5); s.pass.v = 2; }   // phase 8 made tiers cost 1500 XP (was 1000): keep everyone's tier
    return s.pass; };
  L.passXp = (s, n) => { L.passEnsure(s).xp += Math.max(0, n | 0); };
  L.passTier = s => Math.min(C.PASS.TIERS, Math.floor(L.passEnsure(s).xp / C.PASS.TIER_XP));
  L.passReward = (s, k) => { const [kind, v] = C.PASS.REWARDS[k]; return kind === 'gold' ? Math.round(L.runGold(L.bestDun(s)) * v) + ' gold' : kind === 'dust' ? v + ' dust' : kind === 'title' ? 'Title: ' + (C.TITLES.find(t => t.id === v) || { n: v }).n : C.PASS_COSM[v].n; };
  L.passClaim = function (s, k) { const P = L.passEnsure(s); k = k | 0; if (!(k >= 0 && k < C.PASS.TIERS)) return no('No such tier'); if (k >= L.passTier(s)) return no('Reach tier ' + (k + 1) + ' first'); if (P.claimed.includes(k)) return no('Already claimed');
    const [kind, v] = C.PASS.REWARDS[k], what = L.passReward(s, k);
    if (kind === 'gold') L.give(s, L.clears(s, v)); else if (kind === 'dust') s.dust = (s.dust || 0) + v;
    else if (kind === 'title') { if (!s.passTitles) s.passTitles = []; if (!s.passTitles.includes(v)) s.passTitles.push(v); } else if (kind === 'cosm' && !s.cosm.includes(v)) s.cosm.push(v);
    P.claimed.push(k); return ok({ k, kind, v, what }); };
  // after every run: lifetime counters, pass XP, the bestiary (me = this player's line of the run summary)
  L.afterRun = function (s, mode, me, sum, now, cleared) { const got = []; if (!me || !sum) return got; const add = (k, n, keep) => { if (!(n > 0)) return; if (keep !== false) s[k] = (s[k] || 0) + n; };
    add('parries', me.parries); add('pdodges', me.pdodges); add('kills', me.kills, false); add('spellsCast', me.casts, false);
    if (me.style >= 4) add('styleS', 1); if (me.style >= 6) s.sss = (s.sss || 0) + 1;
    if (mode === 'dungeon' && cleared) { add('clears', 1, false); add('bossKills', 1, false); }
    if (mode === 'raid' && cleared) add('raidClears', 1, false);
    if (mode === 'wild') add('camps', sum.camps, false); if (mode === 'tower') add('floors', sum.floor);
    if (mode !== 'dungeon' && me.kc) for (const id in me.kc) if (C.MOBS[id]) s.killsBy[id] = (s.killsBy[id] || 0) + Math.min(9999, me.kc[id] | 0);   // dungeon kills are counted by the run reward
    L.passXp(s, (C.PASS.RUN_XP[mode] || 0) * (mode === 'dungeon' && !cleared ? 0.4 : 1)); return got; };
  // ---- the bestiary: every creature of a world seen and slain -> a reward (once)
  L.bestiaryOf = i => { const d = C.DUNGEONS[i]; return [...new Set([...d.mobs, ...(d.minis || [d.elite]), d.elite, d.boss])]; };
  L.bestiaryDone = (s, i) => L.bestiaryOf(i).every(id => (s.killsBy[id] || 0) > 0);
  L.bestiaryClaim = function (s, i) { if (!C.DUNGEONS[i]) return no('No such page'); if (!L.bestiaryDone(s, i)) return no('Slay every creature of ' + C.DUNGEONS[i].n + ' first'); if (!s.bestClaim) s.bestClaim = []; if (s.bestClaim.includes(i)) return no('Already claimed');
    s.bestClaim.push(i); const gold = L.give(s, L.clears(s, C.BESTIARY.GOLD + i * C.BESTIARY.STEP)); return ok({ i, gold }); };
  // ---- crafting at the Forge: salvage into dust, reroll one bonus, raise the rarity
  L.salvage = function (s, us) { let dust = 0, n = 0; for (const u of (us || []).slice(0, 60)) { const it = L.item(s, +u); if (!it || L.isEquipped(s, it.u) || it.raid !== undefined) continue; dust += C.CRAFT.SALVAGE[it.r] || 1; s.inv = s.inv.filter(q => q.u !== it.u); n++; }
    if (!n) return no('Nothing to salvage (equipped and raid gear is kept)'); s.dust = (s.dust || 0) + dust; s.crafts = (s.crafts || 0) + 1; return ok({ n, dust }); };
  L.craftCost = (s, kind, it) => { const CR = C.CRAFT, g = L.runGold(L.bestDun(s)); return { dust: CR.RARITY.dust[Math.min(4, it.r)], gold: Math.round(g * CR.RARITY.gold[Math.min(4, it.r)]) }; };
  L.upRarity = function (s, u, rng) { const it = L.item(s, +u); if (!it) return no('No such item'); if (it.r >= C.CRAFT.MAX_RARITY) return no('Already as rare as crafting can make it');
    const c = L.craftCost(s, 'rarity', it); if ((s.dust || 0) < c.dust || s.gold < c.gold) return no('Needs ' + c.dust + ' dust and ' + c.gold + ' gold'); s.dust -= c.dust; s.gold -= c.gold;
    it.r++; s.crafts = (s.crafts || 0) + 1; return ok({ u: it.u, r: it.r }); };
  // ---- duels (PvP): normalised so gear and level never decide it, only skill
  L.duelHit = (type, kind, combo) => { const M = C.MOVESETS[type] || C.MOVESETS.sword, ty = C.TYPES[type] || C.TYPES.sword, D = C.DUEL;
    const m = M.combo[Math.max(0, Math.min(M.combo.length - 1, combo | 0))].m;
    return Math.round(D.PER_M * m * ty.pow); };
  L.duelReward = (s, won) => { const g = Math.round(L.runGold(L.bestDun(s)) * (won ? C.DUEL.GOLD_WIN : C.DUEL.GOLD_LOSS)); L.give(s, g); if (won) s.duelWins = (s.duelWins || 0) + 1; s.duels = (s.duels || 0) + 1; return ok({ won, gold: g }); };
  // ---- the tutorial (new players): one small reward at the end
  L.tutDone = s => { if (s.tut === 'done') return no('Already done'); s.tut = 'done'; const gold = L.give(s, L.clears(s, C.TUTORIAL.GOLD)); return ok({ gold }); };
  // ================================================================ Boss Raids
  L.raidUnlocked = (s, k) => !!C.RAIDS[k] && !!(s.dun[k] && s.dun[k].c[1] > 0);
  L.raidLevel = k => L.dunLevel(k, 2);
  // raid slimes: the dungeon's Nightmare numbers, the boss much tougher
  L.raidStats = (k, id, n, kind) => { const st = L.mobStats(k, id, 2, n, kind, false), R = C.RAID_BOSS;
    return { hp: Math.round(st.hp * (kind === 'boss' ? R.HP : R.ADDS_HP)), dmg: Math.round(st.dmg * R.DMG * 10) / 10, xp: st.xp, gold: st.gold }; };
  L.raidMinTime = (k, n, dps) => L.raidStats(k, C.DUNGEONS[k].boss, n, 'boss').hp / Math.max(1, dps) * C.MIN_CLEAR_FRACTION;
  // an exclusive raid ring: Epic or better (Power only, like all gear)
  L.raidRing = (s, k, luck, rng) => { const R = C.RAIDS[k], it = L.makeItem(s, k, Math.max(1, L.raidLevel(k) - Math.floor(rng() * 3)), { ring: true, rarity: Math.max(C.RAID_BOSS.MIN_RARITY, L.rollRarity(luck * C.RAID_BOSS.LUCK, rng)) }, rng);
    it.raid = k; return it; };
  L.bossRaidReward = function (s, k, cleared, ctx, rng, secs) {
    if (!C.RAIDS[k]) return no('No such raid');
    if (!cleared) return ok({ k, raid: true, cleared: false, xp: 0, gold: 0, items: [], kept: [], sold: 0, ups: 0, level: s.level });
    const R = C.RAID_BOSS, b = L.raidStats(k, C.DUNGEONS[k].boss, 1, 'boss'), first = !s.raids[k];
    const xp = Math.round(b.xp * R.XP * L.xpMult(s, ctx)), gold = Math.round(b.gold * R.GOLD * L.goldMult(s, ctx) * (first ? 1 + R.FIRST : 1));
    const ring = L.raidRing(s, k, L.luck(s, ctx), rng), items = [ring];
    L.give(s, gold); const ups = L.addXp(s, xp), kept = []; let sold = 0; for (const it of items) { const r = L.addItem(s, it); if (r.kept) kept.push(it.u); sold += r.sold; }
    L.noteDrops(s, kept);
    let cosm = null; const cz = C.RAIDS[k].cosm, cid = 'raid' + k; if (cz && !s.cosm.includes(cid) && (first || rng() < R.COSM_CHANCE)) { s.cosm.push(cid); cosm = cz; }
    s.raids[k] = (s.raids[k] || 0) + 1; s.raidClears++; s.bossKills++; s.kills++;
    s.killsBy[C.DUNGEONS[k].boss] = (s.killsBy[C.DUNGEONS[k].boss] || 0) + 1;
    return ok({ k, raid: true, cleared: true, xp, gold, items, kept, sold, ups, level: s.level, first, cosm, secs: secs ? Math.round(secs) : 0 });
  };
  // cosmetic colours that only drop from raids
  L.cosmOwned = (s, kind, v) => C.RAIDS.some((r, k) => r.cosm && r.cosm.k === kind && r.cosm.v === v && s && s.cosm.includes('raid' + k)) || Object.keys(C.PASS_COSM).some(id => C.PASS_COSM[id].k === kind && C.PASS_COSM[id].v === v && s && s.cosm.includes(id));

  // ================================================================ character actions
  L.setClass = function (s, cls) {
    if (!C.CLASSES[cls]) return no('No such class'); if (s.cls === cls) return ok({ cls });
    s.cls = cls; const gearSlots = C.SLOT_ORDER.filter(k => k !== 'r');
    for (const sl of gearSlots) { const it = L.eqItem(s, sl); if (it && !L.itemClassOk(s, it)) s.eq[sl] = 0; }
    for (const sl of gearSlots) if (!s.eq[sl]) { const best = s.inv.filter(it => it.s === sl && L.canEquip(s, it)).sort((a, b) => L.itemScore(b) - L.itemScore(a))[0]; if (best) s.eq[sl] = best.u; }
    if (!s.eq.w) { const st = L.starter(s, cls); s.eq.w = st.u; }
    // a new class gets its own starter helmet / hood and armour / robe the first time (Shadowblade and Guardian in Update 6)
    for (const sl of ['h', 'a']) if (!s.eq[sl] && !s.inv.some(it => it.s === sl && it.c === cls)) { const st = L.starter(s, cls, sl); if (L.canEquip(s, st)) s.eq[sl] = st.u; }
    return ok({ cls });
  };
  L.styleRank = pts => { let r = 0; for (let k = 0; k < C.STYLE.AT.length; k++) if (pts >= C.STYLE.AT[k]) r = k; return r; };
  L.addStat = function (s, k, n) { n = Math.max(1, n | 0); if (!['pow', 'spl', 'vit'].includes(k)) return no('No such stat'); if (L.statPoints(s) < n) return no('No stat points left'); s.stats[k] += n; return ok({ k, n }); };
  L.resetStats = s => { s.stats = { pow: 0, spl: 0, vit: 0 }; return ok({}); };
  L.setSpell = function (s, slot, id) {
    slot = slot | 0; if (slot < 0 || slot >= C.SPELL_SLOTS) return no('Bad slot');
    if (id) { const sp = L.spell(id); if (!sp || sp.cls !== s.cls) return no('Not a ' + C.CLASSES[s.cls].n + ' ability');
      if (!L.spellOk(s, sp)) return no('Unlocks at level ' + sp.lv + ' (' + C.DUNGEONS[sp.t].n + ')'); }
    const list = s.spells[s.cls] || (s.spells[s.cls] = ['', '']); for (let i = 0; i < list.length; i++) if (id && list[i] === id) list[i] = '';
    list[slot] = id || ''; return ok({ slot, id });
  };
  L.equip = function (s, u) { const it = L.item(s, u); if (!it) return no('No such item'); if (s.level < it.lv) return no('You need level ' + it.lv); if (!L.itemClassOk(s, it)) return no('That is for ' + C.CLASSES[it.c].n + 's');
    const old = s.eq[it.s]; if (it.s === 'w' && old && old !== it.u) s.prevW = old;   // remembered for Swap
    const was = old && old !== it.u ? L.item(s, old) : null; if (was && it.st) was.st = 1;   // (from the bag: one leaves, one comes back, the count is the same)
    s.eq[it.s] = it.u; delete it.nw; delete it.st; return ok({ u, slot: it.s }); };
  L.unequip = function (s, slot) { if (!C.SLOTS[slot]) return no('No such slot'); if (!s.eq[slot]) return no('Nothing equipped'); if (L.bagN(s) >= L.invMax(s)) return no('Your inventory is full: sell something first'); s.eq[slot] = 0; return ok({ slot }); };
  L.isEquipped = (s, u) => Object.values(s.eq).includes(u);
  L.sell = function (s, uids) { let gold = 0, n = 0; const set = new Set(uids); s.inv = s.inv.filter(it => { if (set.has(it.u) && !L.isEquipped(s, it.u)) { gold += L.itemValue(it); n++; return false; } return true; });
    if (!n) return no('Nothing sold'); L.give(s, gold, 0); return ok({ gold, n }); };
  // the Blacksmith: up to n upgrades on one piece (as many as your gold pays for), or Spend all (your worn gear, cheapest upgrade first)
  L.upgradePlan = (s, it, n) => { let gold = 0, k = 0, up = it.up || 0; while (k < n && up < C.GEAR.UPGRADE_MAX) { const c = L.upgradeCost(Object.assign({}, it, { up })); if (gold + c > s.gold) break; gold += c; up++; k++; } return { n: k, gold }; };
  L.upgradeLeft = it => { let g = 0; for (let up = it.up || 0; up < C.GEAR.UPGRADE_MAX; up++) g += L.upgradeCost(Object.assign({}, it, { up })); return g; };
  L.wornPlan = s => { const lv = {}; let gold = 0, n = 0; for (;;) { let best = null, bc = Infinity; for (const k of C.SLOT_ORDER) { const it = L.eqItem(s, k); if (!it) continue; const up = lv[it.u] !== undefined ? lv[it.u] : it.up || 0; if (up >= C.GEAR.UPGRADE_MAX) continue;
      const c = L.upgradeCost(Object.assign({}, it, { up })); if (c < bc) { bc = c; best = it; } } if (!best || gold + bc > s.gold || n >= 60) break; gold += bc; n++; lv[best.u] = (lv[best.u] !== undefined ? lv[best.u] : best.up || 0) + 1; } return { n, gold, lv }; };
  L.upgradeItem = function (s, u, n) { const it = L.item(s, u); if (!it) return no('No such item'); if (it.up >= C.GEAR.UPGRADE_MAX) return no('Already +' + C.GEAR.UPGRADE_MAX);
    const p = L.upgradePlan(s, it, clamp(n | 0 || 1, 1, C.GEAR.UPGRADE_MAX)); if (!p.n) return no('Not enough gold!'); s.gold -= p.gold; it.up += p.n; return ok({ u, up: it.up, n: p.n, gold: p.gold }); };
  L.upgradeAll = function (s) { const p = L.wornPlan(s); if (!p.n) return no('Not enough gold to upgrade your gear'); for (const u in p.lv) { const it = L.item(s, +u); if (it) it.up = p.lv[u]; } s.gold -= p.gold; return ok({ n: p.n, gold: p.gold }); };
  // the Forge sells plain (Common) gear for every dungeon you have unlocked, at that dungeon's level
  L.shopPrice = (i) => Math.round(C.GEAR.BUY * grow(C.DUNGEONS[i].lvl) * 2.5);
  L.buyGear = function (s, i, slot) {
    const d = C.DUNGEONS[i]; if (!d) return no('No such gear'); if (!L.dunUnlocked(s, i)) return no('Unlocks at level ' + L.dunLevel(i, 0));
    if (!C.SLOTS[slot] || slot === 'r') return no('No such gear'); const price = L.shopPrice(i); if (s.gold < price) return no('Not enough gold!');
    if (L.bagN(s) >= L.invMax(s)) return no('Your inventory is full'); s.gold -= price;
    const it = { u: s.uid++, t: i, s: slot, k: L.kindFor(s.cls, slot), c: s.cls, r: 0, lv: d.lvl, up: 0 };
    s.inv.push(it); return ok({ u: it.u });
  };
  L.setAutoSell = (s, r, on) => { r = r | 0; if (r < 0 || r > 1) return no('Only Common and Uncommon'); s.autoSell[r] = !!on; return ok({ r, on: !!on }); };
  // ================================================================ relics (one hidden in every dungeon)
  // Update 6 secrets: wayshrines in the Wilds, one lost lantern in every dungeon
  L.wayshrine = function (s, i) { const WC = C.WILD; if (!(i >= 0 && i < WC.WAYS)) return no('No wayshrine here'); if (!s.ways) s.ways = []; if (s.ways.includes(i)) return ok({ already: true, n: s.ways.length });
    s.ways.push(i); const all = s.ways.length >= WC.WAYS, gold = L.give(s, L.clears(s, WC.WAY_GOLD + (all ? WC.WAY_ALL : 0))); return ok({ i, n: s.ways.length, gold, all }); };
  L.lantern = function (s, i) { if (!(i >= 0 && i < L.ND)) return no('No lantern here'); if (!s.lanterns) s.lanterns = []; if (s.lanterns.includes(i)) return ok({ already: true, n: s.lanterns.length });
    s.lanterns.push(i); const all = s.lanterns.length >= L.ND, gold = L.give(s, L.clears(s, C.WILD.LANTERN_GOLD + (all ? C.WILD.LANTERN_ALL : 0))); return ok({ i, n: s.lanterns.length, gold, all }); };
  L.relic = function (s, i) { if (i < 0 || i >= 8) return no('No relic here'); if (s.relics.includes(i)) return ok({ already: true }); s.relics.push(i); const gold = L.give(s, L.clears(s, C.RELIC_GOLD)); return ok({ i, n: s.relics.length, gold }); };
  // event rewards scale with your best dungeon so they matter at every level
  L.raidReward = s => ({ gold: L.clears(s, C.RAID_GOLD_RUNS) });
  // ================================================================ daily: login streak, gift
  L.daily = function (s, now) {
    const key = L.dayKey(now); let res = null;
    if (s.daily.last !== key) { const y = L.dayKey(now - 86400000); s.daily.streak = s.daily.last === y ? s.daily.streak + 1 : 1; s.daily.last = key;
      const g = L.give(s, L.clears(s, C.STREAK_GOLD[Math.min(s.daily.streak, C.STREAK_GOLD.length) - 1])); res = { streak: s.daily.streak, gold: g }; }
    return res;
  };
  L.giftReady = (s, now) => s.giftDay !== L.dayKey(now);
  L.dailyGift = function (s, now, ctx, rng) {
    if (!L.giftReady(s, now)) return no('Come back tomorrow for another gift!');
    // Update 7 (final): 4 random pieces of gear from the highest dungeon and difficulty your level can enter (that step's level and loot luck)
    s.giftDay = L.dayKey(now); const k = Math.min(L.bestStep(s.level), L.NSTEP - 1), i = Math.min(L.ND - 1, Math.floor(k / 3)), df = k - i * 3, lv = Math.min(s.level, L.dunLevel(i, df)), items = [], kept = []; let sold = 0;
    for (let n = 0; n < C.GIFT.ITEMS; n++) { const it = L.makeItem(s, i, Math.max(1, lv - Math.floor(rng() * (C.GEAR.LV_SPREAD + 1))), { luck: (C.DIFFS[df].luck || 1) * C.GIFT.LUCK, ringOk: true }, rng); const r = L.addItem(s, it); items.push(it); if (r.kept) kept.push(it.u); sold += r.sold; }
    return ok({ items, kept, sold, i, df });
  };
  // ================================================================ milestones + titles
  L.statVal = (s, k) => k === 'passTier' ? L.passTier(s) : k === 'bestiary' ? (s.bestClaim || []).length : k === 'relicN' ? s.relics.length : k === 'wayN' ? (s.ways || []).length : k === 'lanternN' ? (s.lanterns || []).length : (s[k] || 0);
  L.checkMilestones = s => { const got = []; for (const m of C.MILESTONES) if (!s.ms[m.id] && L.statVal(s, m.stat) >= m.need) { s.ms[m.id] = 1; L.give(s, L.clears(s, m.gold)); got.push(m.id); } return got; };
  L.titleOk = (s, t) => !!t && (t.pass ? (s.passTitles || []).includes(t.id) : (!t.stat || L.statVal(s, t.stat) >= t.need));
  L.setTitle = (s, id) => { const t = C.TITLES.find(x => x.id === id); if (!t) return no('No such title'); if (!L.titleOk(s, t)) return no('Title locked'); s.title = id; return ok({ title: id }); };
  L.titleName = id => (C.TITLES.find(t => t.id === id) || C.TITLES[0]).n;
  L.unlocked = (s, need) => !need || L.statVal(s, need.stat) >= need.v;
  // ================================================================ looks (validated on the server so nobody can wear locked cosmetics)
  const HEX = /^#[0-9a-f]{6}$/i, HAIR = ['messy', 'spiky', 'bob', 'ponytail', 'curly', 'buns'], EYES = ['sharp', 'round', 'big', 'calm', 'cat', 'dot'], PAT = ['plain', 'stripes', 'stars', 'camo', 'split'];
  L.HAIR = HAIR; L.EYES = EYES; L.PATTERNS = PAT;
  L.validLook = function (lk, s) {
    if (!lk || typeof lk !== 'object') return null;
    const o = {}, col = (k, d) => { o[k] = HEX.test(lk[k]) ? lk[k].toLowerCase() : d; };
    const d = { skin: '#f0c8a0', hairC: '#121116', hairC2: '#7a1a20', eye: '#6a7a90', shirt: '#2a2d36', shirt2: '#15151a', pants: '#1c1e25', shoes: '#15151a', gear1: '#3a2218', gear2: '#5a1018', glow: '#3ab8ff', capeC: '#15151a', trail: '#bfe8ff' };
    for (const k in d) col(k, d[k]);
    // raid cosmetics: these colours only count if you have earned them
    if (s && !C.LOOK.trails.includes(o.trail) && !L.cosmOwned(s, 'trail', o.trail)) o.trail = d.trail;
    if (s && !C.LOOK.cloth.includes(o.capeC) && !L.cosmOwned(s, 'cape', o.capeC)) o.capeC = d.capeC;
    o.mask = HEX.test(lk.mask) ? lk.mask.toLowerCase() : '';
    o.hair = HAIR.includes(lk.hair) ? lk.hair : 'messy'; o.eyeStyle = EYES.includes(lk.eyeStyle) ? lk.eyeStyle : 'sharp'; o.pattern = PAT.includes(lk.pattern) ? lk.pattern : 'plain';
    o.face = C.LOOK.faces.includes(lk.face) ? lk.face : 'serious'; o.freckles = !!lk.freckles; o.shorts = !!lk.shorts;
    o.sleeve = ['short', 'long', 'none'].includes(lk.sleeve) ? lk.sleeve : 'short'; o.shape = ['slim', 'regular', 'chunky'].includes(lk.shape) ? lk.shape : 'regular';
    o.height = clamp(+lk.height || 1, 0.9, 1.1); o.head = clamp(+lk.head || 1, 0.9, 1.15);
    const of = C.LOOK.outfits.find(x => x.id === lk.outfit); o.outfit = of && (!s || L.unlocked(s, of.need)) ? of.id : 'tee';
    const cp = C.LOOK.capes.find(x => x.id === lk.cape); o.cape = cp && (!s || L.unlocked(s, cp.need)) ? cp.id : '';
    return o;
  };
  L.setLook = (s, lk) => { const v = L.validLook(lk, s); if (!v) return no('Bad look'); s.look = v; return ok({ look: v }); };
  L.saveOutfit = (s, i, lk) => { i = i | 0; if (i < 0 || i > 2) return no('Bad slot'); const v = L.validLook(lk, s); if (!v) return no('Bad look'); s.outfits[i] = v; return ok({ i }); };
  // ---- the Shop (Update 7 final): chests paid with dust give cosmetic skins; a skin only changes how your armour or weapon looks
  L.cosm = id => C.SHOP.COSM.find(q => q.id === id);
  L.skinsOf = s => { if (!s.skins || typeof s.skins !== 'object' || !Array.isArray(s.skins.own)) s.skins = { own: [], armor: '', weapon: '' }; return s.skins; };
  L.openChest = function (s, cid, rng) { const ch = C.SHOP.CHESTS.find(q => q.id === cid); if (!ch) return no('No such chest'); if ((s.dust || 0) < ch.cost) return no('Needs ' + ch.cost + ' dust (salvage gear at the Blacksmith)');
    const S = L.skinsOf(s), tot = ch.w.reduce((a, b) => a + b, 0); let x = rng() * tot, r = 0; for (; r < ch.w.length - 1; r++) { x -= ch.w[r]; if (x < 0) break; }
    while (r > 0 && !C.SHOP.COSM.some(q => q.r === r)) r--; const pool = C.SHOP.COSM.filter(q => q.r === r), it = pool[Math.floor(rng() * pool.length)];
    s.dust -= ch.cost; const dupe = S.own.includes(it.id), refund = dupe ? C.SHOP.DUPE[r] : 0; if (dupe) s.dust += refund; else S.own.push(it.id);
    return ok({ chest: ch.id, id: it.id, r, dupe, refund }); };
  L.setSkin = function (s, kind, id) { const S = L.skinsOf(s); if (kind !== 'armor' && kind !== 'weapon') return no('No such slot'); id = String(id || '');
    if (id) { const q = L.cosm(id); if (!q || q.k !== kind) return no('No such skin'); if (!S.own.includes(id)) return no('Open chests in the Shop to get it'); }
    S[kind] = id; return ok({ kind, id }); };
  // what other players need to draw you: your look + the visible parts of your gear
  L.gearLook = s => { const w = L.eqItem(s, 'w'), v = sl => { const it = L.eqItem(s, sl); return it && s.showArmor ? [it.k, it.t, it.r] : null; };
    const S = L.skinsOf(s); return { w: w ? [w.k, w.t, w.r] : [s.cls === 'mage' ? 'staff' : 'sword', 0, 0], a: v('a'), h: v('h'), g: v('g'), b: v('b'), cls: s.cls, sk: [S.armor || '', S.weapon || ''] }; };
  // how good an item is for comparing: its Power
  L.itemScore = it => L.itemPow(it);

  root.SL = L;
  if (typeof module !== 'undefined') module.exports = L;
})(typeof self !== 'undefined' ? self : this);
