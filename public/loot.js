/* Slime Slayers - loot on the dungeon floor: your gear drops from the final boss (a little model of the item + a light beam in its rarity
   colour, taller for rarer loot) and gold coins that burst out of slimes and fly to you. The simulation decides what drops
   and who picks it up; this file only draws it. */
(function (root) {
  'use strict';
  root.SSLoot = function (E, L, CH, WD, AU) {
    const C = L.C, M = E.M, G = E.G, T = M.trs, TAU = Math.PI * 2;
    const LT = { list: new Map(), coins: [] };
    const ms = {
      beam: E.mesh(G.cyl(1, 1, 1, 14, false)), coin: E.mesh(G.cyl(0.17, 0.17, 0.05, 14)), sph: E.mesh(G.sphere(1, 14, 10)), neck: E.mesh(G.cyl(0.09, 0.12, 0.22, 10)),
      helm: E.mesh(G.box(0.62, 0.56, 0.62, 0.22)), slit: E.mesh(G.box(0.46, 0.07, 0.1, 0.02)), chest: E.mesh(G.box(0.86, 0.82, 0.46, 0.12)), shoulder: E.mesh(G.box(0.34, 0.24, 0.5, 0.1)),
      glove: E.mesh(G.box(0.3, 0.42, 0.3, 0.08)), cuff: E.mesh(G.box(0.36, 0.12, 0.36, 0.04)), boot: E.mesh(G.box(0.3, 0.5, 0.32, 0.08)), toe: E.mesh(G.box(0.3, 0.18, 0.5, 0.07)),
      ring: E.mesh(G.torus(0.26, 0.07, 20, 8)), gem: E.mesh(G.sphere(0.11, 10, 7)),
      cover: E.mesh(G.box(0.62, 0.12, 0.8, 0.03)), pages: E.mesh(G.box(0.56, 0.16, 0.74, 0.01)), rune: E.mesh(G.torus(0.16, 0.025, 16, 4))
    };
    const BEAM_H = [1.6, 2.6, 4, 6, 9, 12, 15];
    const rcol = r => (C.GEAR_RARITY[r] || C.GEAR_RARITY[0]).c;
    const tier = it => C.GEAR_TIERS[it.t] || C.GEAR_TIERS[0];
    LT.clear = () => { LT.list.clear(); LT.coins.length = 0; };
    LT.get = id => LT.list.get(id);
    // e: {id, d: 'item', x, z, own, it}
    LT.add = function (e) {
      const a = Math.random() * TAU;
      LT.list.set(e.id, { id: e.id, kind: e.d, x: e.x, z: e.z, own: e.own || 0, it: e.it || null, ab: e.ab || null, age: 0, y: 0.4, vy: 5.5 + Math.random() * 2, spin: a, pick: null });
      if (AU && e.it && e.it.r >= 4) AU.play('reveal', Math.min(5, e.it.r));
    };
    // picked up: fly to whoever took it (or just fade when a potion expires)
    LT.pick = function (id, to) { const d = LT.list.get(id); if (!d || d.pick) return d; d.pick = { t: 0, to: to || null }; return d; };
    // coins burst out of a slime and come to you (only a picture: the gold is counted by the run rules)
    LT.burst = function (x, z, n, big) { for (let k = 0; k < n; k++) { const a = Math.random() * TAU, v = 2 + Math.random() * 3 * (big ? 1.6 : 1);
      LT.coins.push({ x, y: 0.8, z, vx: Math.cos(a) * v, vy: 5 + Math.random() * 4, vz: Math.sin(a) * v, t: 0, home: 0.7 + Math.random() * 0.4, spin: Math.random() * 6 }); } };
    let tick = 0;
    LT.update = function (dt, P) {
      for (const d of LT.list.values()) {
        d.age += dt; d.spin += dt * 1.6;
        if (d.pick) { d.pick.t += dt; const q = d.pick.to; if (q) { const k = Math.min(1, dt * 12); d.x += (q.x - d.x) * k; d.z += (q.z - d.z) * k; d.y += ((q.y || 0) + 1.4 - d.y) * k; } if (d.pick.t > 0.35) LT.list.delete(d.id); continue; }
        if (d.vy !== 0 || d.y > 0.45) { d.vy -= 22 * dt; d.y += d.vy * dt; if (d.y <= 0.45) { d.y = 0.45; d.vy = d.vy < -3 ? -d.vy * 0.35 : 0; } }
      }
      tick = Math.max(0, tick - dt);
      for (let i = LT.coins.length - 1; i >= 0; i--) { const c = LT.coins[i]; c.t += dt; c.spin += dt * 10;
        if (c.t < c.home) { c.vy -= 20 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; if (c.y < 0.1) { c.y = 0.1; c.vy = Math.abs(c.vy) * 0.4; c.vx *= 0.6; c.vz *= 0.6; } }
        else { const dx = P.x - c.x, dz = P.z - c.z, dy = P.y + 1.2 - c.y, dd = Math.hypot(dx, dz, dy), sp = 14 + (c.t - c.home) * 30;
          if (dd < 0.6 || dd > 40 || c.t > 4) { LT.coins.splice(i, 1); if (dd < 0.6 && tick <= 0 && AU) { AU.play('coin'); tick = 0.06; } continue; }
          c.x += dx / dd * sp * dt; c.y += dy / dd * sp * dt; c.z += dz / dd * sp * dt; } }
    };
    // which drops you can see: your own gear, and potions (anyone can use them)
    LT.mine = (d, myId) => d.kind === 'pot' || d.own === myId;
    function drawItem(it, x, y, z, yaw, s) {
      const tc = tier(it), g1 = tc.g1, g2 = tc.g2, glow = it.r >= 3 ? rcol(it.r) : tc.glow, o = { soft: 1, spec: 0.8, col2: g2 };
      switch (it.s) {
        case 'w': { const m = T(x, y + 0.1, z, yaw, -Math.PI / 2 + 0.45, 0.35, s * 1.05, s * 1.05, s * 1.05);
          E.draw(CH.weaponMesh(it.k === 'staff' || it.k === 'hammer' || it.k === 'dagger' || it.k === 'greatsword' ? it.k : 'sword', 'body'), m, tc.w, { soft: 1, col2: glow, spec: 0.8 });
          E.draw(CH.weaponMesh(it.k === 'staff' || it.k === 'hammer' || it.k === 'dagger' || it.k === 'greatsword' ? it.k : 'sword', 'glow'), m, glow, { soft: 1, emis: 2, noShadow: true }); break; }
        case 'h': E.draw(ms.helm, T(x, y, z, yaw, 0, 0, s, s, s), g1, o); E.draw(ms.slit, T(x + Math.sin(yaw) * 0.3 * s, y - 0.02 * s, z + Math.cos(yaw) * 0.3 * s, yaw, 0, 0, s, s, s), glow, { emis: 2, noShadow: true }); break;
        case 'a': E.draw(ms.chest, T(x, y, z, yaw, 0, 0, s, s, s), g1, o); for (const sd of [-1, 1]) E.draw(ms.shoulder, T(x + Math.cos(yaw) * sd * 0.5 * s, y + 0.34 * s, z - Math.sin(yaw) * sd * 0.5 * s, yaw, 0, sd * 0.25, s, s, s), g2, o);
          E.draw(ms.gem, T(x + Math.sin(yaw) * 0.24 * s, y + 0.12 * s, z + Math.cos(yaw) * 0.24 * s, 0, 0, 0, s, s, s), glow, { emis: 2, noShadow: true }); break;
        case 'g': for (const sd of [-1, 1]) { const px = x + Math.cos(yaw) * sd * 0.24 * s, pz = z - Math.sin(yaw) * sd * 0.24 * s; E.draw(ms.glove, T(px, y, pz, yaw, 0, sd * 0.2, s, s, s), g1, o); E.draw(ms.cuff, T(px, y + 0.2 * s, pz, yaw, 0, sd * 0.2, s, s, s), g2, o); } break;
        case 'b': for (const sd of [-1, 1]) { const px = x + Math.cos(yaw) * sd * 0.22 * s, pz = z - Math.sin(yaw) * sd * 0.22 * s; E.draw(ms.boot, T(px, y + 0.08 * s, pz, yaw, 0, 0, s, s, s), g1, o);
          E.draw(ms.toe, T(px + Math.sin(yaw) * 0.12 * s, y - 0.1 * s, pz + Math.cos(yaw) * 0.12 * s, yaw, 0, 0, s, s, s), g2, o); } break;
        default: E.draw(ms.ring, T(x, y, z, yaw, 0.5, 0, s * 1.3, s * 1.3, s * 1.3), '#c8a050', { spec: 1.2 }); E.draw(ms.gem, T(x, y + 0.3 * s, z, 0, 0, 0, s * 1.4, s * 1.4, s * 1.4), rcol(it.r), { emis: 2.2, noShadow: true });
      }
    }
    LT.drawItem = drawItem;
    // V: {t, eye, parts}; labels: names over your loot when you are close
    LT.draw = function (V, labels, myId) {
      const t = V.t, ex = V.eye[0], ez = V.eye[2];
      for (const d of LT.list.values()) {
        if (!LT.mine(d, myId)) continue;
        const fade = d.pick ? Math.max(0, 1 - d.pick.t / 0.35) : 1, bob = d.pick ? 0 : Math.sin(t * 2.4 + d.id) * 0.08, y = d.y + bob + 0.25;
        if (d.kind === 'pot') { const s = 0.85 * fade + 0.01;
          E.draw(ms.sph, T(d.x, y, d.z, 0, 0, 0, 0.24 * s, 0.26 * s, 0.24 * s), '#d8202a', { emis: 0.9, spec: 1.2 });
          E.draw(ms.neck, T(d.x, y + 0.3 * s, d.z, 0, 0, 0, s, s, s), '#c8d0d8', { spec: 1.2, alpha: 0.8 }); E.draw(ms.sph, T(d.x, y + 0.44 * s, d.z, 0, 0, 0, 0.07 * s, 0.06 * s, 0.07 * s), '#6a4a2a');
          E.draw(ms.beam, T(d.x, 0.9, d.z, t, 0, 0, 0.16, 1.8, 0.16), '#ff3a3a', { mode: 3, add: true, alpha: 0.25 * fade, noShadow: true, depthWrite: false, cull: false });
          if (WD.decal && E.quality !== 'low') WD.decal(d.x, 0.07, d.z, 1.6, '#ff2a2a', 0.35 * fade);
          continue; }
        const it = d.it; if (!it) continue; const col = rcol(it.r), h = BEAM_H[it.r] || 2, pulse = 0.75 + Math.sin(t * 3 + d.id) * 0.25;
        drawItem(it, d.x, y + 0.2, d.z, d.spin, 1.3 * fade + 0.02);
        E.draw(ms.beam, T(d.x, h / 2, d.z, 0, 0, 0, 0.13 + it.r * 0.03, h, 0.13 + it.r * 0.03), col, { mode: 3, add: true, alpha: 0.6 * pulse * fade, noShadow: true, depthWrite: false, cull: false });
        if (it.r >= 2) E.draw(ms.beam, T(d.x, h * 0.4, d.z, 0, 0, 0, 0.34 + it.r * 0.05, h * 0.8, 0.34 + it.r * 0.05), col, { mode: 3, add: true, alpha: 0.14 * pulse * fade, noShadow: true, depthWrite: false, cull: false });
        if (WD.decal) WD.decal(d.x, 0.07, d.z, 1.8 + it.r * 0.35, col, (0.3 + it.r * 0.06) * fade);
        if (V.parts && it.r >= 3 && Math.random() < 0.25) E.particle({ x: d.x + (Math.random() - 0.5) * 0.5, y: 0.3, z: d.z + (Math.random() - 0.5) * 0.5, vx: 0, vy: 1.5 + Math.random() * 2, vz: 0, life: 0.9, size: 0.1, col, add: true });
        const dd = (d.x - ex) ** 2 + (d.z - ez) ** 2;
        if (!d.pick && labels && dd < 30 * 30) labels.push({ t: L.itemName(it), x: d.x, y: y + 1.05, z: d.z, sz: 10, c: col });
      }
      for (const c of LT.coins) E.draw(ms.coin, T(c.x, c.y, c.z, c.spin, Math.PI / 2, 0, 1, 1, 1), '#e8b43a', { emis: 0.6, spec: 1.4 });
    };
    // ---------------------------------------------------------------- dungeon features: crates/urns (a look per dungeon), the treasure chest, the shrine, spike traps
    const fm = { hbox: E.mesh(G.box(1, 1, 1, 0)), hdisc: E.mesh(G.cyl(1, 1, 1, 32)), blade: E.mesh(G.box(1, 1, 1, 0.08)), star: E.mesh(G.sphere(1, 8, 6)), crate: E.mesh(G.box(1, 1, 1, 0.06)), band: E.mesh(G.box(1.04, 0.1, 1.04, 0)), barrel: E.mesh(G.cyl(0.42, 0.48, 1, 12)), hoop: E.mesh(G.cyl(0.5, 0.5, 0.08, 12)),
      urn: E.mesh(G.lathe([[0, 0], [0.3, 0], [0.42, 0.25], [0.44, 0.55], [0.3, 0.85], [0.2, 0.95], [0.26, 1.05], [0, 1.05]], 12)), oct: E.mesh(G.sphere(1, 4, 2)), sac: E.mesh(G.sphere(1, 10, 8)),
      ped: E.mesh(G.cyl(0.55, 0.75, 1, 8)), cap: E.mesh(G.cyl(0.7, 0.62, 0.18, 8)), plate: E.mesh(G.box(1, 0.1, 1, 0)), spike: null };
    const spikeCache = {};
    function spikeMesh(w, d) { const key = w.toFixed(1) + 'x' + d.toFixed(1); if (spikeCache[key]) return spikeCache[key]; const o = [], nx = Math.max(3, Math.round(w / 0.9)), nz = Math.max(2, Math.round(d / 0.8)); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) o.push(...G.xf(G.cyl(0, 0.13, 0.8, 4), T(-w / 2 + (i + 0.5) * w / nx, 0.4, -d / 2 + (j + 0.5) * d / nz, 0, 0, 0, 1, 1, 1))); return (spikeCache[key] = E.mesh(o)); }
    const PROP_LOOK = { woods: ['crate', 'barrel', 'crate'], desert: ['urn', 'urn', 'crate'], crypt: ['urn', 'crate', 'urn'], frost: ['ice', 'ice', 'crate'], ember: ['barrel', 'barrel', 'crate'],
      storm: ['crate', 'barrel', 'crate'], void: ['crystal', 'crystal', 'urn'], abyss: ['sac', 'sac', 'urn'], glitch: ['cube', 'cube', 'cube'] };
    LT.propKind = (th, v) => (PROP_LOOK[th] || PROP_LOOK.woods)[v % 3];
    LT.drawFeat = function (V, F, runT, th, myId) {
      if (!F) return; const t = V.t, low = E.quality === 'low';
      for (const q of F.props) { if (q.gone) continue; const k = LT.propKind(th, q.v), yaw = q.id * 1.7, x = q.x, z = q.z, s = 0.85 + (q.id % 3) * 0.08;
        switch (k) {
          case 'crate': E.draw(fm.crate, T(x, 0.5 * s, z, yaw, 0, 0, s, s, s), '#6a4a2a', { soft: 1, tex: 'wood', texMode: 1 }); E.draw(fm.band, T(x, 0.5 * s, z, yaw, 0, 0, s, s * 0.7, s), '#3a2a1a', { spec: 0.4 }); break;
          case 'barrel': E.draw(fm.barrel, T(x, 0.5 * s, z, yaw, 0, 0, s, s, s), th === 'ember' ? '#2a2226' : '#5a3a22', { soft: 1, tex: th === 'ember' ? 'metal' : 'wood', texMode: 1 });
            for (const yy of [0.18, 0.82]) E.draw(fm.hoop, T(x, yy * s, z, 0, 0, 0, s, s, s), th === 'ember' ? '#ff6a1a' : '#2a2a30', th === 'ember' ? { emis: 0.8 } : { spec: 1 }); break;
          case 'urn': E.draw(fm.urn, T(x, 0, z, yaw, 0, 0, s, s, s), th === 'desert' ? '#a8784a' : th === 'void' ? '#2a1a3a' : '#5a5866', { soft: 1, spec: 0.3 }); break;
          case 'ice': E.draw(fm.crate, T(x, 0.5 * s, z, yaw, 0.1, 0.05, s * 0.9, s, s * 0.9), '#9ad8ff', { soft: 1, spec: 1.4, alpha: 0.82 }); break;
          case 'crystal': E.draw(fm.oct, T(x, 0.6, z, yaw + t * 0.3, 0, 0, 0.42, 0.75, 0.42), '#b45aff', { emis: 1.2, spec: 1 }); break;
          case 'sac': E.draw(fm.sac, T(x, 0.45, z, yaw, 0, 0, 0.5, 0.45 + Math.sin(t * 2 + q.id) * 0.03, 0.5), '#5a1020', { soft: 1, spec: 0.8 }); break;
          case 'cube': E.draw(fm.crate, T(x, 0.45 + Math.sin(t * 1.5 + q.id) * 0.1, z, yaw + t * 0.4, 0.3, 0.2, 0.7, 0.7, 0.7), q.id % 2 ? '#1aff8a' : '#0a2a18', { emis: q.id % 2 ? 1 : 0.2 }); break;
        } }
      // the treasure chest: shakes when hit; a Mimic breathes a little (if you look closely)
      const c = F.chest; if (c && !c.gone) { c.shake = Math.max(0, (c.shake || 0) - V.dt * 3); c.openK = Math.min(1, (c.openK || 0) + (c.open ? V.dt * 2 : 0));
        const sh = c.shake * Math.sin(t * 60) * 0.12, breathe = c.mimic && !c.open ? Math.max(0, Math.sin(t * 2.2)) * 0.06 : 0;
        WD.drawChest(c.x + sh, 0, c.z, c.yaw + Math.PI, Math.max(c.openK, breathe), c.open ? null : '#ffd84a', '#4a2a14');
        if (!c.open && WD.decal) WD.decal(c.x, 0.07, c.z, 3.4, '#ffd84a', 0.25 + Math.sin(t * 3) * 0.08);
        if (c.open && V.parts && c.openK < 1 && Math.random() < 0.8) E.particle({ x: c.x + (Math.random() - 0.5), y: 1, z: c.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 3, vz: (Math.random() - 0.5) * 2, life: 1, size: 0.12, col: Math.random() < 0.5 ? '#ffd84a' : '#ffffff', add: true, g: 5 }); }
      // the shrine: a stone pedestal with a floating orb (gone once you used it)
      const sr = F.shrine; if (sr) { const d = C.SHRINES.find(q => q.id === sr.kind) || C.SHRINES[0], used = sr.used;
        E.draw(fm.ped, T(sr.x, 0.5, sr.z, 0, 0, 0, 1, 1, 1), '#4a4652', { soft: 1, tex: 'rock', texMode: 1 }); E.draw(fm.cap, T(sr.x, 1.05, sr.z, 0, 0, 0, 1, 1, 1), '#2e2a34', { spec: 0.5 });
        if (!used) { const y = 1.8 + Math.sin(t * 2) * 0.15; E.draw(fm.sac, T(sr.x, y, sr.z, t, 0, 0, 0.32, 0.32, 0.32), d.col, { emis: 2.4, noShadow: true });
          if (WD.decal) WD.decal(sr.x, 0.07, sr.z, 4.6, d.col, 0.4 + Math.sin(t * 3) * 0.1, WD.runeTex);
          if (V.parts && Math.random() < 0.4) E.particle({ x: sr.x + (Math.random() - 0.5) * 1.2, y: 1.2, z: sr.z + (Math.random() - 0.5) * 1.2, vx: 0, vy: 1.4, vz: 0, life: 1, size: 0.1, col: d.col, add: true }); } }
      // spike traps: a metal grate; a red glow before the spikes shoot up
      for (const tr of F.traps) { const st = L.trapState(tr, runT), c2 = ((runT + tr.ph) % C.TRAP.PERIOD + C.TRAP.PERIOD) % C.TRAP.PERIOD, up = C.TRAP.PERIOD - C.TRAP.UP;
        E.draw(fm.plate, T(tr.x, 0.03, tr.z, 0, 0, 0, tr.w, 1, tr.d), '#1e1c22', { tex: 'metal', texMode: 1, spec: 0.6 });
        if (!tr.mesh) tr.mesh = spikeMesh(tr.w - 0.3, tr.d - 0.3);
        const h = st === 2 ? Math.min(1, (c2 - up) / 0.08) : st === 1 ? 0.12 : 0.02;
        if (h > 0.03) E.draw(tr.mesh, T(tr.x, -0.8 + h * 0.8 + 0.05, tr.z, 0, 0, 0, 1, 1, 1), '#8a8e98', { spec: 1.2 });
        if (st === 1 && WD.decal) WD.decal(tr.x, 0.09, tr.z, Math.max(tr.w, tr.d) * 1.1, '#ff2a1a', 0.25 + Math.sin(t * 24) * 0.15);
        else if (st === 0 && !low && WD.decal) WD.decal(tr.x, 0.08, tr.z, Math.max(tr.w, tr.d) * 0.9, '#ff2a1a', 0.06); }
      // vents: rumble red, then erupt (a column of fire / frost / lightning in the dungeon's colour)
      const vcol = { woods: '#9aff5a', desert: '#ffb84a', crypt: '#7ad8ff', frost: '#bfe8ff', ember: '#ff6a1a', storm: '#8ab0ff', void: '#c87aff', abyss: '#ff2a4a', glitch: '#1aff8a' }[th] || '#ff6a1a';
      if (F.haz) for (const h of F.haz) { if (h.k !== 'vent') continue; const st = L.ventState(h, runT, F.vph);
        if (st === 1) { if (WD.decal) WD.decal(h.x, 0.12, h.z, h.r * 2.2, '#ff2a1a', 0.3 + Math.sin(t * 22) * 0.15); if (V.parts && Math.random() < 0.5) E.particle({ x: h.x + (Math.random() - 0.5) * h.r, y: 0.2, z: h.z + (Math.random() - 0.5) * h.r, vx: 0, vy: 1.5, vz: 0, life: 0.5, size: 0.15, col: '#5a5058', a: 0.6 }); }
        else if (st === 2) { E.draw(fm.barrel, T(h.x, 2.5, h.z, t * 4, 0, 0, h.r * 1.7, 5, h.r * 1.7), vcol, { alpha: 0.45, add: true, emis: 2.4, noShadow: true, depthWrite: false });
          if (V.parts) for (let j = 0; j < (low ? 2 : 5); j++) E.particle({ x: h.x + (Math.random() - 0.5) * h.r * 1.5, y: 0.3, z: h.z + (Math.random() - 0.5) * h.r * 1.5, vx: (Math.random() - 0.5) * 2, vy: 8 + Math.random() * 6, vz: (Math.random() - 0.5) * 2, life: 0.6, size: 0.25, col: Math.random() < 0.5 ? vcol : '#ffffff', add: true, g: 6 }); }
        else if (!low && WD.decal) WD.decal(h.x, 0.11, h.z, h.r * 1.8, vcol, 0.05); }
      // Update 6 hazards: the tide (water rises over the room), clockwork blades (spinning arms), falling stars (warning circle, a star drops, a burst)
      if (F.haz) for (const h of F.haz) {
        if (h.k === 'tide') { const lv = L.tideLevel(h, runT); if (lv <= 0.01) continue; const y = -0.15 + lv * 0.75, st = L.tideState(h, runT);
          if (h.round) E.draw(fm.hdisc, T(h.x, y - 0.5, h.z, 0, 0, 0, h.round - 0.3, 1, h.round - 0.3), '#1a6a6a', { mode: 1, alpha: 0.78, spec: 1, emis: 0.15, noShadow: true });
          else E.draw(fm.hbox, T(h.x, y - 0.5, h.z, 0, 0, 0, h.w - 0.6, 1, h.d - 0.6), '#1a6a6a', { mode: 1, alpha: 0.78, spec: 1, emis: 0.15, noShadow: true });
          if (st === 1 && WD.decal) for (const q of h.safe) WD.decal(q[0], 0.25, q[1], q[2] * 2.3, '#7affe8', 0.25 + Math.sin(t * 10) * 0.12);
          if (V.parts && st === 2 && Math.random() < (low ? 0.2 : 0.6)) E.particle({ x: h.x + (Math.random() - 0.5) * (h.w - 2), y: y + 0.05, z: h.z + (Math.random() - 0.5) * (h.d - 2), vx: 0, vy: 0.6, vz: 0, life: 0.6, size: 0.18, col: '#bfffff', a: 0.5 }); }
        else if (h.k === 'blades') { const a = L.bladeAng(h, runT); if (AU && AU.at && Math.abs(Math.sin(a * 2)) < 0.06) AU.at('blade', h.x, h.z, 0, 22);
          E.draw(fm.blade, T(h.x, 0.45, h.z, a, 0, 0, 0.32, 0.2, h.r * 2), '#c8b8a0', { spec: 1.4 });
          E.draw(fm.blade, T(h.x, 0.45, h.z, a, 0, 0, 0.06, 0.24, h.r * 2 + 0.05), '#ffc84a', { emis: 1.6, noShadow: true });
          if (V.parts && !low && Math.random() < 0.4) { const sd = Math.random() < 0.5 ? 1 : -1; E.particle({ x: h.x + Math.sin(a) * h.r * sd, y: 0.3, z: h.z + Math.cos(a) * h.r * sd, vx: Math.cos(a) * 3 * sd, vy: 2, vz: -Math.sin(a) * 3 * sd, life: 0.3, size: 0.08, g: 10, col: '#ffd88a', add: true }); } }
        else if (h.k === 'star') { const st = L.starState(h, runT), H = C.HAZ, c = ((runT + h.ph) % H.STAR_PERIOD + H.STAR_PERIOD) % H.STAR_PERIOD, up = H.STAR_PERIOD - H.STAR_UP, k = (c - (up - H.STAR_WARN)) / H.STAR_WARN;
          if (st === 2 && !h._snd && AU && AU.at) { h._snd = 1; AU.at('star', h.x, h.z, 0, 50); AU.at('boom', h.x, h.z, 0, 40); } else if (st !== 2) h._snd = 0;
          if (st === 1) { if (WD.decal) WD.decal(h.x, 0.1, h.z, h.r * 2.2, '#9ab8ff', 0.25 + k * 0.35); const y = 0.5 + (1 - k) * 34;
            E.draw(fm.star, T(h.x + (1 - k) * 6, y, h.z - (1 - k) * 3, t * 3, 0, 0, 0.55, 0.55, 0.55), '#e8eaff', { emis: 3, noShadow: true });
            if (V.parts) E.particle({ x: h.x + (1 - k) * 6, y, z: h.z - (1 - k) * 3, vx: 0, vy: 0, vz: 0, life: 0.5, size: 0.7, col: '#9ab8ff', add: true }); }
          else if (st === 2) { const q = (c - up) / H.STAR_UP; E.draw(fm.hdisc, T(h.x, 0.1, h.z, 0, 0, 0, h.r * (0.4 + q * 0.8), 0.05, h.r * (0.4 + q * 0.8)), '#d8e4ff', { emis: 2.5, alpha: 1 - q, add: true, noShadow: true, depthWrite: false });
            if (V.parts && q < 0.3) for (let j = 0; j < (low ? 3 : 8); j++) { const aa = Math.random() * TAU, v = 3 + Math.random() * 6; E.particle({ x: h.x, y: 0.4, z: h.z, vx: Math.cos(aa) * v, vy: 2 + Math.random() * 5, vz: Math.sin(aa) * v, life: 0.5, size: 0.2, g: 9, col: Math.random() < 0.5 ? '#e8eaff' : '#9ab8ff', add: true }); } }
          else if (!low && WD.decal) WD.decal(h.x, 0.1, h.z, h.r * 1.9, '#9ab8ff', 0.05); } }
    };
    // pieces that fly out when a crate breaks
    LT.debris = function (x, z, col) { for (let k = 0; k < 14; k++) { const a = Math.random() * TAU, v = 2 + Math.random() * 4; E.particle({ x, y: 0.5, z, vx: Math.cos(a) * v, vy: 3 + Math.random() * 4, vz: Math.sin(a) * v, life: 0.8, size: 0.22, g: 14, col }); } };
    LT.featLights = function (out, F) { if (!F) return; const sr = F.shrine; if (sr && !sr.used) out.push({ x: sr.x, y: 2, z: sr.z, r: 6, i: 1.3, col: (C.SHRINES.find(q => q.id === sr.kind) || C.SHRINES[0]).col });
      const c = F.chest; if (c && !c.open) out.push({ x: c.x, y: 1.4, z: c.z, r: 4.5, i: 0.8, col: '#ffd84a' });
      if (F.haz && F.runT !== undefined) for (const h of F.haz) if ((h.k === 'vent' && L.ventState(h, F.runT, F.vph) === 2) || (h.k === 'star' && L.starState(h, F.runT) === 2)) out.push({ x: h.x, y: 1.5, z: h.z, r: 7, i: 1.4, col: h.k === 'star' ? '#c8d8ff' : '#ff8a3a' }); };
    // point lights for the engine (a glow around each of your drops)
    LT.lights = function (out, myId) { for (const d of LT.list.values()) { if (!LT.mine(d, myId) || d.pick) continue; out.push({ x: d.x, y: 1.2, z: d.z, r: d.kind === 'pot' ? 3.5 : 3 + (d.it ? d.it.r : 0) * 0.8, col: d.kind === 'pot' ? '#ff3a3a' : rcol(d.it ? d.it.r : 0), i: d.kind === 'pot' ? 0.9 : 0.7 + (d.it ? d.it.r * 0.15 : 0) }); } };
    return LT;
  };
})(typeof self !== 'undefined' ? self : this);
