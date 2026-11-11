/* Slime Slayers - the world: Duskhold (the hub castle town and dungeon lobby), nine dungeons (rooms + halls from logic.js W.layout,
   each with its own look), and the Pit (wave defence arena). Static scenery is merged into 48-unit chunks so it is cheap to draw.
   This file also owns collision (walls, closed dungeon gates), zones, per-zone lighting, signs, portals and the leaderboard tablets. */
(function (root) {
  'use strict';
  root.SSWorld = function (E, L, CH) {
    const M = E.M, G = E.G, T = M.trs, C = L.C, W = L.W, TAU = Math.PI * 2, clamp = L.clamp;
    const WD = { ready: false };
    let rs = 1; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647, R = (a, b) => a + rnd() * (b - a), seed = s => { rs = (s % 2147483646) + 1; };
    const pick = a => a[Math.floor(rnd() * a.length)];
    const canvas = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
    const mix = (a, b, k) => { const A = Array.isArray(a) ? a : M.hex(a), B = Array.isArray(b) ? b : M.hex(b); return A.map((v, i) => v + (B[i] - v) * k); };

    // ---------------------------------------------------------------- shared geometry
    const BX = G.box(1, 1, 1, 0), BXR = G.box(1, 1, 1, 0.12), CY6 = G.cyl(1, 1, 1, 6), CY8 = G.cyl(1, 1, 1, 8), CY12 = G.cyl(1, 1, 1, 12), CY20 = G.cyl(1, 1, 1, 20);
    const CO4 = G.cyl(0, 1, 1, 4), CO6 = G.cyl(0, 1, 1, 6), CO8 = G.cyl(0, 1, 1, 8), CO12 = G.cyl(0, 1, 1, 12), SPH = G.sphere(1, 10, 7);
    const ICO = [1, 2, 3, 4, 5, 6].map(s => G.ico(1, 0.32, s * 13 + 5)), ICOS = [1, 2, 3].map(s => G.ico(1, 0.12, s * 7 + 2));
    const ms = WD.ms = {
      quad: E.mesh(G.quad(1, 1)), disc: E.mesh(G.disc(1, 32, 0, 1)), box: E.mesh(G.box(1, 1, 1, 0.08)), boxS: E.mesh(BX), sph: E.mesh(SPH), cyl: E.mesh(CY12),
      cone: E.mesh(CO8), ring: E.mesh(G.torus(1, 0.06, 40, 6)), ringT: E.mesh(G.torus(1, 0.16, 32, 6)), ico: E.mesh(G.ico(1, 0.25, 9)), oct: E.mesh(G.cyl(0, 1, 1, 4).concat(G.xf(G.cyl(0, 1, 1, 4), T(0, -1, 0, 0, Math.PI, 0)))),
      flame: E.mesh(G.cyl(0, 1, 1, 6)), beam: E.mesh(G.cyl(1, 1, 1, 16, false)), plat: E.mesh(G.box(1, 1, 1, 0.1)), chestB: null, chestL: null
    };
    // ---------------------------------------------------------------- static helpers (chunked by position)
    let CK = 'c';   // chunk name prefix: 't' marks scenery detail (the forests on the town's hills) that Low draws only nearby
    function S(geo, m, col, tex) { E.addStatic(geo, m, PAL ? PAL(col) : col, tex, CK + Math.floor(m[12] / 48) + ',' + Math.floor(m[14] / 48)); }
    // Update 7 · a brighter, more saturated palette for the dungeons: every surface colour's lightness is lifted (dark stays dark-ish, never black)
    // and its saturation raised, so the chunky shapes read in the new light. PAL is on while a dungeon is built.
    let PAL = null;
    const VIVID = (lift, sat) => (lift *= 0.55, sat = 1 + (sat - 1) * 0.3, c => { const [r, g, b] = M.col(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      if (d < 1e-4 && l > 0.97) return [r, g, b];
      const s0 = d < 1e-4 ? 0 : d / (1 - Math.abs(2 * l - 1)), h = d < 1e-4 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      const L2 = Math.min(0.78, l + (0.62 - l) * lift * (1 - l)), S2 = Math.min(1, s0 * sat + 0.04), q = (1 - Math.abs(2 * L2 - 1)) * S2, x = q * (1 - Math.abs(h % 2 - 1)), m0 = L2 - q / 2;
      const [a, bb, cc] = h < 1 ? [q, x, 0] : h < 2 ? [x, q, 0] : h < 3 ? [0, q, x] : h < 4 ? [0, x, q] : h < 5 ? [x, 0, q] : [q, 0, x]; return [a + m0, bb + m0, cc + m0]; });
    const PAL_K = { woods: [0.3, 1.0], desert: [0.34, 1.08], crypt: [0.46, 1.08], frost: [0.36, 1.05], ember: [0.16, 0.98], storm: [0.4, 1.08], void: [0.36, 1.12], abyss: [0.3, 1.05], glitch: [0.3, 1.08], drowned: [0.4, 1.12], clock: [0.36, 1.08], moon: [0.4, 1.0] };
    // Y0: the height things are built on (the town's terraces); 0 everywhere else
    let Y0 = 0;
    const P = (geo, x, y, z, yaw, sx, sy, sz, col, tex, pit, rol) => S(geo, T(x, y + Y0, z, yaw || 0, pit || 0, rol || 0, sx, sy, sz), col, tex);
    // ---------------------------------------------------------------- collision: circles and rotated boxes in a grid
    const grid = new Map(), CELL = 8, gk = (i, j) => (i + 2000) * 8192 + (j + 2000);
    function addCol(c) {
      const ext = (c.r || Math.hypot(c.hw, c.hd)) + 1.2;
      if (c.a) { c.ca = Math.cos(c.a); c.sa = Math.sin(c.a); } else { c.ca = 1; c.sa = 0; }
      for (let i = Math.floor((c.x - ext) / CELL); i <= Math.floor((c.x + ext) / CELL); i++) for (let j = Math.floor((c.z - ext) / CELL); j <= Math.floor((c.z + ext) / CELL); j++) {
        const k = gk(i, j); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); }
      return c;
    }
    const circ = (x, z, r, h, top) => addCol({ x, z, r, h: h ? h + Y0 : 99, top: top === undefined ? undefined : top + Y0 });
    const rect = (x, z, w, d, a, h, top) => addCol({ x, z, hw: w / 2, hd: d / 2, a: a || 0, h: h ? h + Y0 : 99, top: top === undefined ? undefined : top + Y0 });
    WD.collide = function (x, z, rad, y) {
      y = y || 0; const a = grid.get(gk(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return [x, z];
      for (const c of a) {
        if (y >= c.h - 0.08 || (c.top !== undefined && c.top <= y + 0.45)) continue;   // above it, or a low ledge you step up onto (stairs, decks)
        if (c.r) { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + rad; if (d < m) { if (d < 1e-4) { x += m; continue; } x = c.x + dx / d * m; z = c.z + dz / d * m; } }
        else {
          const dx = x - c.x, dz = z - c.z; let lx = dx * c.ca - dz * c.sa, lz = dx * c.sa + dz * c.ca; const ex = c.hw + rad, ez = c.hd + rad;
          if (Math.abs(lx) < ex && Math.abs(lz) < ez) { if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = Math.sign(lx || 1) * ex; else lz = Math.sign(lz || 1) * ez;
            x = c.x + lx * c.ca + lz * c.sa; z = c.z - lx * c.sa + lz * c.ca; }
        }
      }
      return [x, z];
    };
    WD._grid = grid; WD._gk = gk; WD._CELL = CELL;
    // is a point inside something solid? (used to stop the camera going through walls and trees)
    WD.blocked = function (x, y, z) {
      const a = grid.get(gk(Math.floor(x / CELL), Math.floor(z / CELL))); if (a) for (const c of a) { if (c.nocam || y > c.h || (c.top !== undefined && y > c.top)) continue;
        if (c.r) { if (c.r > 0.3 && Math.hypot(x - c.x, z - c.z) < c.r + 0.15) return true; } // posts are too thin to matter
        else { const dx = x - c.x, dz = z - c.z, lx = dx * c.ca - dz * c.sa, lz = dx * c.sa + dz * c.ca; if (c.hw > 0.6 && c.hd > 0.6 && Math.abs(lx) < c.hw - 0.05 && Math.abs(lz) < c.hd - 0.05) return true; } }
      if (Math.abs(x) < 200 && Math.abs(z) < 200 && WD.hubH && y < WD.hubH(x, z) - 0.2) return true;   // the town's hills
      return false;
    };
    // highest walkable top under (x,z) that is not above your feet (crates, steps, plinths)
    WD.floorAt = function (x, z, y) {
      const a = grid.get(gk(Math.floor(x / CELL), Math.floor(z / CELL))); let best = 0; if (!a) return 0;
      for (const c of a) { if (c.top === undefined || c.top > y + 0.45 || c.top <= best) continue;
        if (c.r) { if (Math.hypot(x - c.x, z - c.z) <= c.r) best = c.top; }   // edges count (a step and the terrace it meets share an edge)
        else { const dx = x - c.x, dz = z - c.z, lx = dx * c.ca - dz * c.sa, lz = dx * c.sa + dz * c.ca; if (Math.abs(lx) <= c.hw + 1e-3 && Math.abs(lz) <= c.hd + 1e-3) best = c.top; } }
      return best;
    };
    // the highest walkable top at (x,z), whatever your height (for teleports onto the terraces)
    WD.groundAt = (x, z) => WD.floorAt(x, z, 1e6);
    // ---------------------------------------------------------------- zones + bounds
    WD.zoneAt = function (x, z) {
      if (Math.abs(x) < 200 && Math.abs(z) < 200) return { t: 'hub', k: -1 };
      if (W.inArena(x, z) || Math.hypot(x - W.ARENA.x, z - W.ARENA.z) < 80) return { t: 'arena', k: -1 };
      if (W.inRaid(x, z)) return { t: 'raid', k: -1 };
      if (W.inWild(x, z)) return { t: 'wild', k: -1 };
      const k = W.dunAt(x, z); if (k >= 0) return { t: 'dun', k };
      return { t: 'void', k: -1 };
    };
    WD.bound = function (zone, x, z) {
      if (zone.t === 'hub') { // the plaza circle, the west gate and the Wildgate Market annex
        const A = W.ANNEX, G2 = W.WEST_GATE, inGate = x < G2.x + 4 && x > A.x1 - 2 && Math.abs(z - G2.z) < G2.w / 2 - 0.6, inAnx = x > A.x0 + 0.8 && x < A.x1 + 1 && z > A.z0 + 0.8 && z < A.z1 - 0.8;
        if (!inGate && !inAnx) { if (x < A.x1 + 1 && x > A.x0 - 4 && z > A.z0 - 2 && z < A.z1 + 2) { x = Math.max(A.x0 + 0.8, Math.min(A.x1 + 1, x)); z = Math.max(A.z0 + 0.8, Math.min(A.z1 - 0.8, z)); }
          else { const T0 = W.TOWN, e = W.townE(x, z), m = 0.985; if (e > m) { x = T0.cx + (x - T0.cx) * m / e; z = T0.cz + (z - T0.cz) * m / e; } } } }
      else if (zone.t === 'wild') { const dx = x - W.WILD.x, dz = z - W.WILD.z, d = Math.hypot(dx, dz), m = W.WILD.r - 1; if (d > m) { x = W.WILD.x + dx * m / d; z = W.WILD.z + dz * m / d; } }
      else if (zone.t === 'arena') { const dx = x - W.ARENA.x, dz = z - W.ARENA.z, d = Math.hypot(dx, dz), m = W.ARENA.r - 0.5; if (d > m) { x = W.ARENA.x + dx * m / d; z = W.ARENA.z + dz * m / d; } }
      else if (zone.t === 'raid') { const dx = x - W.RAIDA.x, dz = z - W.RAIDA.z, d = Math.hypot(dx, dz), m = W.RAIDA.r - 0.5; if (d > m) { x = W.RAIDA.x + dx * m / d; z = W.RAIDA.z + dz * m / d; } }
      return [x, z];
    };

    // ---------------------------------------------------------------- textures: glow decals, signs
    const glowTex = WD.glowTex = E.canvasTex(canvas(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }));
    const ringTex = WD.ringTex = E.canvasTex(canvas(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.shadowColor = '#fff'; g.shadowBlur = 12; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke();
      g.lineWidth = 2; g.setLineDash([6, 8]); g.beginPath(); g.arc(64, 64, 40, 0, TAU); g.stroke(); }));
    const runeTex = E.canvasTex(canvas(256, 256, (g) => { g.translate(128, 128); g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 118, 0, TAU); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 96, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.beginPath(); g.moveTo(0, -96); g.lineTo(83, 48); g.stroke(); }
      g.font = '900 22px serif'; g.fillStyle = '#fff'; const glyph = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'; for (let i = 0; i < 12; i++) { g.save(); g.rotate(i / 12 * TAU); g.fillText(glyph[i], -7, -100); g.restore(); } }));
    WD.runeTex = runeTex;
    // the dark band where floors meet walls (fake ambient occlusion: one merged mesh per zone) and the soft moonbeams
    const aoTex = E.canvasTex(canvas(16, 64, (g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 16, 64); }));
    const shaftTex = E.canvasTex(canvas(64, 256, (g) => { const im = g.createImageData(64, 256), d = im.data, st = [0.2, 0.37, 0.55, 0.71, 0.86].map(v => [v, 0.3 + Math.random() * 0.7]);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) { const u = x / 63, v = y / 255, prof = Math.pow(Math.sin(Math.PI * u), 2); let s = 0.55; for (const [c0, k] of st) s += k * Math.exp(-Math.pow((u - c0) * 18, 2)) * 0.5;
        const a = prof * s * Math.pow(v, 1.6) * (0.75 + 0.25 * Math.sin(v * 9 + u * 3)), i = (y * 64 + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255); }
      g.putImageData(im, 0, 0); }));
    const shaftM = E.mesh([0, 1, 2].flatMap(k => G.xf(G.quad(1, 1), T(0, 0.5, 0, k * Math.PI / 3, 0, 0, 1, 1, 1))));
    const AOS = {}; let aoKey = null;   // zone -> floor strips beside walls
    function aoStrip(x0, z0, x1, z1, nx, nz, w) { if (!aoKey) return; const a = AOS[aoKey] || (AOS[aoKey] = []), y = 0.045, ex = nx * w, ez = nz * w;
      const v = [[x0, z0, 0, 0], [x1, z1, 1, 0], [x1 + ex, z1 + ez, 1, 1], [x0 + ex, z0 + ez, 0, 1]];
      for (const k of [0, 1, 2, 0, 2, 3]) a.push(v[k][0], y, v[k][1], 0, 1, 0, 1, 1, 1, v[k][2], v[k][3]); }
    function aoBox(x, z, hw, hd, w) { aoStrip(x - hw, z - hd, x + hw, z - hd, 0, -1, w); aoStrip(x + hw, z + hd, x - hw, z + hd, 0, 1, w); aoStrip(x - hw, z + hd, x - hw, z - hd, -1, 0, w); aoStrip(x + hw, z - hd, x + hw, z + hd, 1, 0, w); }
    // a chevron on the floor pointing the way (texture "up" = forward)
    const arrowTex = WD.arrowTex = E.canvasTex(canvas(128, 128, (g) => { g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.beginPath(); g.moveTo(64, 14); g.lineTo(112, 70); g.lineTo(88, 70); g.lineTo(64, 42); g.lineTo(40, 70); g.lineTo(16, 70);
      g.closePath(); g.fill(); g.beginPath(); g.moveTo(64, 58); g.lineTo(112, 114); g.lineTo(88, 114); g.lineTo(64, 86); g.lineTo(40, 114); g.lineTo(16, 114); g.closePath(); g.fill(); }));
    const FONT = '"Outfit","Trebuchet MS","Segoe UI",sans-serif';
    // a dark iron-framed board with engraved gold letters
    function paintSign(g, w, h, title, sub, col) {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d1a1f'); gr.addColorStop(1, '#0e0c10'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(0, Math.random() * h, w, 1 + Math.random() * 2); }
      g.strokeStyle = '#5a4a32'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.strokeStyle = '#21180f'; g.lineWidth = 2; g.strokeRect(12, 12, w - 24, h - 24);
      for (const [x, y] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) { g.fillStyle = '#7a6640'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.fillStyle = '#2a2014'; g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill(); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = sub ? h * 0.36 : h * 0.46; g.font = `900 ${fs}px ${FONT}`; while (g.measureText(title).width > w - 60 && fs > 10) { fs -= 2; g.font = `900 ${fs}px ${FONT}`; }
      const ty = sub ? h * 0.4 : h * 0.53;
      g.fillStyle = '#000'; g.fillText(title, w / 2 + 2, ty + 3);
      const tg = g.createLinearGradient(0, ty - fs / 2, 0, ty + fs / 2); tg.addColorStop(0, '#f2dca0'); tg.addColorStop(0.55, '#c9a45a'); tg.addColorStop(1, '#8a6a32'); g.fillStyle = tg; g.fillText(title, w / 2, ty);
      if (col) { g.fillStyle = col; g.fillRect(w / 2 - 60, ty + fs * 0.62, 120, 3); }
      if (sub) { g.font = `700 ${h * 0.17}px ${FONT}`; g.fillStyle = '#b8b0c0'; g.fillText(sub, w / 2, h * 0.76); }
    }
    const signs = [];
    function sign(title, sub, col, w, h) { const s = { title, sub, col, w: w || 512, h: h || 160 }; s.c = canvas(s.w, s.h, (g, cw, ch) => paintSign(g, cw, ch, title, sub, col)); s.t = E.canvasTex(s.c); signs.push(s); return s; }
    WD.refreshSigns = () => { for (const s of signs) { const g = s.c.getContext('2d'); g.clearRect(0, 0, s.w, s.h); paintSign(g, s.w, s.h, s.title, s.sub, s.col); E.updateCanvasTex(s.t, s.c); } paintBoards(); };
    WD.setSign = (s, title, sub) => { if (s.title === title && s.sub === sub) return; s.title = title; s.sub = sub; const g = s.c.getContext('2d'); g.clearRect(0, 0, s.w, s.h); paintSign(g, s.w, s.h, title, sub, s.col); E.updateCanvasTex(s.t, s.c); };

    // ---------------------------------------------------------------- the dynamic list (things drawn every frame), per zone
    const DYN = { hub: [], arena: [], raid: [], wild: [] }; for (let k = 0; k < L.ND; k++) DYN['d' + k] = [];
    const torch = (list, x, y, z, col, big) => list.push({ k: 'torch', x, y: y + Y0, z, col: col || '#ff7a1a', big: big || 1 });
    const win = (list, x, y, z, yaw, w, h) => list.push({ k: 'win', x, y: y + Y0, z, yaw, w, h });
    const banner = (list, x, y, z, yaw, w, h, tex) => list.push({ k: 'banner', x, y: y + Y0, z, yaw, w, h, tex });
    const signAt = (list, s, x, y, z, yaw, w, h) => list.push({ k: 'sign', s, x, y: y + Y0, z, yaw, w, h });
    const bannerTex = (col, emblem) => E.canvasTex(canvas(64, 192, (g) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.lineTo(64, 170); g.lineTo(46, 158); g.lineTo(32, 192); g.lineTo(18, 158); g.lineTo(0, 170); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, 64, 10); g.fillStyle = '#8a7040'; g.fillRect(5, 14, 3, 140); g.fillRect(56, 14, 3, 140);
      g.fillStyle = '#0d0809'; g.beginPath(); g.moveTo(32, 46); g.lineTo(50, 70); g.lineTo(42, 112); g.lineTo(32, 100); g.lineTo(22, 112); g.lineTo(14, 70); g.closePath(); g.fill();
      g.fillStyle = emblem || '#ff3a3a'; g.beginPath(); g.moveTo(22, 74); g.lineTo(30, 80); g.lineTo(22, 82); g.fill(); g.beginPath(); g.moveTo(42, 74); g.lineTo(34, 80); g.lineTo(42, 82); g.fill(); }));
    const BAN_RED = bannerTex('#4a0c14'), BAN_BLUE = bannerTex('#101a3a', '#5ad8ff'), BAN_GREEN = bannerTex('#0e2a14', '#9aff6a'), BAN_PURP = bannerTex('#2a0e3a', '#e07aff'), BAN_BLACK = bannerTex('#121014', '#ff2a2a');

    // ---------------------------------------------------------------- reusable builders
    // Update 7 · chunky stylised trees and rocks (reference photos 04, 09, 10): fat six-sided tiers that overlap, a lit and a shaded tone, a slight lean
    function pine(x, z, h, col, snow) {
      const lean = R(-0.05, 0.05), lean2 = R(-0.05, 0.05), w = h / 6, lit = mix(col, '#ffffff', 0.1), dark = mix(col, '#000000', 0.22);
      P(CY6, x, h * 0.13, z, rnd() * 3, 0.26 * w, h * 0.26, 0.26 * w, '#4a2e1a', 'bark');
      for (let k = 0; k < 4; k++) { const r = (1.75 - k * 0.36) * w, y = h * (0.3 + k * 0.165); P(CO6, x + lean * y, y, z + lean2 * y, k * 0.55 + rnd() * 0.3, r, h * 0.33, r, k % 2 ? lit : k === 0 ? dark : col, undefined, lean, lean2); }
      if (snow) for (let k = 0; k < 3; k++) { const y = h * (0.42 + k * 0.165); P(CO6, x + lean * y, y, z + lean2 * y, k * 0.55, (1.3 - k * 0.34) * w, h * 0.12, (1.3 - k * 0.34) * w, '#e8f0f8', undefined, lean, lean2); }
      circ(x, z, 0.35 * w + 0.2);
    }
    const AUTUMN = ['#a4561e', '#92421c', '#b07828', '#86381a'];   // Update 7 (feedback): deep autumn, not candy orange
    function autumnPine(x, z, h) { pine(x, z, h, pick(AUTUMN)); }
    function oak(x, z, s, trunk, leaf, glowCol) { // gnarled dark tree with blob canopy
      P(CY8, x, 1.6 * s, z, R(0, 3), 0.45 * s, 3.2 * s, 0.45 * s, trunk, 'bark');
      for (let k = 0; k < 3; k++) { const a = rnd() * TAU; P(CY6, x + Math.sin(a) * 0.6 * s, 3.2 * s, z + Math.cos(a) * 0.6 * s, a, 0.14 * s, 1.8 * s, 0.14 * s, trunk, 'bark', 0.7, 0); }
      for (let k = 0; k < 4; k++) { const a = rnd() * TAU, r = k ? 1.5 * s : 0; P(pick(ICO), x + Math.sin(a) * r, (4 + R(0, 1.2)) * s, z + Math.cos(a) * r, rnd() * 3, (1.7 + rnd() * 0.6) * s, (1.3 + rnd() * 0.4) * s, (1.7 + rnd() * 0.6) * s, mix(leaf, '#000000', rnd() * 0.3)); }
      circ(x, z, 0.5 * s + 0.15);
    }
    function deadTree(x, z, s, col) {
      P(CY6, x, 1.8 * s, z, 0, 0.32 * s, 3.6 * s, 0.32 * s, col, 'bark', R(-0.08, 0.08), R(-0.08, 0.08));
      for (let k = 0; k < 5; k++) { const a = rnd() * TAU, y = (2 + rnd() * 1.8) * s, l = (1 + rnd()) * s; P(CY6, x + Math.sin(a) * l * 0.4, y + l * 0.3, z + Math.cos(a) * l * 0.4, a, 0.07 * s, l, 0.07 * s, col, 'bark', 0.9 + rnd() * 0.4, 0); }
      circ(x, z, 0.35 * s + 0.1);
    }
    function rock(x, z, s, col, solid, moss) { const sx = s * R(1, 1.4), sy = s * R(0.6, 0.9), sz = s * R(0.9, 1.3), a = rnd() * 6; P(pick(ICO), x, s * 0.45, z, a, sx, sy, sz, col, 'rock');
      if (moss) P(pick(ICOS), x, s * 0.45 + sy * 0.55, z, a, sx * 0.85, sy * 0.35, sz * 0.85, moss, 'grass');   // a mossy (or snowy) cap
      if (solid !== false) circ(x, z, s * 0.95, s * 0.9); }
    function house(list, x, z, yaw, w, d, h, wall, beam, roof) { // timber house with glowing windows
      const c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      P(BX, x, h / 2, z, yaw, w, h, d, wall, 'white');
      for (const yy of [0.15, h * 0.5, h - 0.1]) P(BX, x, yy, z, yaw, w + 0.15, 0.28, d + 0.15, beam, 'wood');
      for (const q of [-w / 2, -w / 6, w / 6, w / 2]) { const p = at(q, 0); P(BX, p[0], h / 2, p[1], yaw, 0.28, h, d + 0.15, beam, 'wood'); }
      const rl = Math.hypot(d / 2 + 0.5, 1.6);
      for (const sd of [-1, 1]) { const p = at(0, sd * (d / 4 + 0.1)); P(BX, p[0], h + 0.8, p[1], yaw, w + 0.7, 0.32, rl, roof, 'wood', sd * 0.72, 0); }
      { const p = at(0, 0); P(BX, p[0], h + 0.35, p[1], yaw, w - 0.2, 1.2, d * 0.55, wall, 'white'); }
      const fz = d / 2 + 0.02; for (const q of [-w / 3, w / 3]) { const p = at(q, fz); win(list, p[0], h * 0.62, p[1], yaw, 0.85, 0.95); }
      { const p = at(0, fz); P(BX, p[0], 1, p[1], yaw, 1.1, 2, 0.2, '#1e140c', 'wood'); }
      if (rnd() < 0.6) { const p = at(w * 0.3, -d * 0.2); P(BX, p[0], h + 1.6, p[1], yaw, 0.6, 1.6, 0.6, '#2a2630', 'brick'); }
      rect(x, z, w + 0.2, d + 0.2, yaw);
    }
    function wallSeg(x, z, yaw, len, h, col) { P(BX, x, h / 2, z, yaw, len, h, 1.6, col, 'brick'); for (const k of [-0.3, 0.3]) { const c = Math.cos(yaw), s = Math.sin(yaw); P(BX, x + c * k * len, h + 0.4, z - s * k * len, yaw, len * 0.28, 0.8, 1.7, mix(col, '#000000', 0.1), 'brick'); } }
    function tower(list, x, z, r, h, col, roof) {
      P(CY20, x, h / 2, z, 0, r, h, r, col, 'brick'); P(CY20, x, h + 0.3, z, 0, r + 0.35, 0.6, r + 0.35, mix(col, '#000000', 0.2), 'rock');
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; P(BX, x + Math.cos(a) * (r + 0.1), h + 0.95, z + Math.sin(a) * (r + 0.1), -a, 0.7, 0.7, 0.6, col, 'brick'); }
      if (roof) { P(CO12, x, h + 2.9, z, 0, r + 0.45, 4.6, r + 0.45, roof); P(CY6, x, h + 5.6, z, 0, 0.05, 1.2, 0.05, '#2a2a30'); }
      for (let k = 0; k < Math.floor(h / 3.2); k++) { const a = rnd() * TAU; win(list, x + Math.cos(a) * (r + 0.02), 2.4 + k * 2.8, z + Math.sin(a) * (r + 0.02), Math.atan2(Math.cos(a), Math.sin(a)), 0.45, 0.85); }
      circ(x, z, r + 0.1);
    }
    function lampPost(list, x, z, col) { P(CY8, x, 1.3, z, 0, 0.07, 2.6, 0.07, '#18161c'); P(BX, x, 2.65, z, 0, 0.32, 0.06, 0.32, '#18161c'); for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) P(BX, x + dx, 2.95, z + dz, 0, 0.04, 0.6, 0.04, '#18161c'); P(CO4, x, 3.42, z, 0.785, 0.3, 0.3, 0.3, '#18161c'); torch(list, x, 2.75, z, col, 0.75); circ(x, z, 0.25); }
    function crate(x, z, s, yaw) { P(BXR, x, s / 2, z, yaw, s, s, s, '#3a2818', 'wood'); rect(x, z, s, s, yaw, s, s); }
    function barrel(x, z) { P(CY12, x, 0.55, z, 0, 0.45, 1.1, 0.45, '#33221a', 'wood'); P(CY12, x, 0.3, z, 0, 0.47, 0.08, 0.47, '#1a1612'); P(CY12, x, 0.8, z, 0, 0.47, 0.08, 0.47, '#1a1612'); circ(x, z, 0.5, 1.1, 1.1); }
    function arch(x, z, yaw, wd, h, col, tex, nocam) { // stone arch: two pillars and a curved top, opening along local x
      const c = Math.cos(yaw), s = Math.sin(yaw);
      for (const sd of [-1, 1]) { P(BX, x + c * sd * wd / 2, h / 2, z - s * sd * wd / 2, yaw, 1.2, h, 1.3, col, tex || 'brick'); const q = circ(x + c * sd * wd / 2, z - s * sd * wd / 2, 0.75); if (nocam) q.nocam = true; }
      for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI, ax = Math.cos(a) * wd / 2, ay = h + Math.sin(a) * wd / 2 * 0.75; P(BX, x + c * ax, ay, z - s * ax, yaw, 1.1, 1.0, 1.25, col, tex || 'brick', 0, a - Math.PI / 2); }
    }
    function groundTiles(cx, cz, half, col, tex, tile) {
      tile = tile || 24; const n = Math.ceil(half * 2 / tile);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = cx - half + (i + 0.5) * tile, z = cz - half + (j + 0.5) * tile; S(G.plane(tile, tile, 2, 2), T(x, 0, z), col, tex); }
    }

    const LOW_NEAR = { torch: 1, candle: 1, smoke: 1, sign: 1, banner: 1, orb: 1, glowRing: 1, floorRune: 1, rune: 1 };
    // ================================================================ DUSKHOLD (the hub and dungeon lobby)
    // Update 7 · rebuilt as a green hillside town (the style of reference photos 04, 09 and 10, our own layout): a valley ringed by pine hills
    // and snowy peaks, a river with a rope bridge and a stone bridge, timber houses on several levels, winding stone paths, the Enchanter's
    // round tower, every station a real building, and the Grand Gate terrace where the twelve dungeon portals stand in an arc.
    // Heights: the square and most streets are y 0, the Grand Gate terrace +3, the hill terraces +2.5 / +3 and the windmill rise +6.
    const HUBD = DYN.hub;
    WD.portalSigns = []; WD.stationSigns = {};
    const D_hubCandle = (x, y, z) => HUBD.push({ k: 'candle', x, y: y + Y0, z });
    const RIVER = WD.RIVER = { x0: 40, x1: 48, z0: -112, z1: 192, y: -0.7, bridges: [{ z: -4, w: 3.2, rope: true }, { z: 32, w: 4.6 }] };
    // raised walkable ground [x0, x1, z0, z1, top]: the Grand Gate terrace, the windmill rise above it, the west hill, the east hill
    const TERR = WD.TERR = [[-74, 40, -96, -28, 3], [-76, -50, -96, -66, 6], [-66, -34, 28, 60, 2.5], [54, 76, -50, -22, 3]];
    const GRASS = '#3c5a2c', PATH = '#7b7466', STONE = '#77726a', STONE_D = '#57534c', COPE = '#8c8676', TIMBER = '#3b2819';
    const PLASTER = ['#a99c84', '#9a8c74', '#b2a58c', '#8c806c'], ROOFS = ['#7a3228', '#3a4860', '#5a3c2a', '#3e4a34', '#5c3038', '#6c4a2e'];
    // the hills: a low-poly height field that rises outside the town's edge (a rounded rectangle), with a mountain wall to the north
    function hubHeight(x, z) {
      const e = W.townE(x, z); if (e < 1.03) return 0;
      let h = (e - 1.03) * 62 + Math.max(0, -100 - z) * 0.45;
      h += (Math.sin(x * 0.083 + 1.3) * Math.cos(z * 0.071) + Math.sin((x - z) * 0.047) * 0.7) * Math.min(h, 9) * 0.45;
      if (z > -114) h *= L.clamp((Math.abs(x - 44) - 5) / 15, 0, 1);                                   // the river's valley
      { const A = W.ANNEX, dx = Math.max(A.x0 - 6 - x, 0, x - (W.WEST_GATE.x + 2)), dz = Math.max(A.z0 - 6 - z, 0, z - A.z1 - 6); const k = L.clamp(Math.hypot(dx, dz) / 34, 0, 1); h *= k * k * (3 - 2 * k); }   // the market's hollow (gentle green slopes up from it)
      if (z > 76) h *= L.clamp((Math.abs(x) - 5) / 14, 0, 1);                                            // the south road
      return Math.min(h, 92);
    }
    WD.hubH = hubHeight;
    function hills() {
      const N = 4, X0 = -192, n = 96, geo = {}, push = (key, tex, v) => { const k = key + '|' + tex; (geo[k] || (geo[k] = { key, tex, a: [] })).a.push(...v); };
      const H = []; for (let i = 0; i <= n; i++) { H[i] = []; for (let j = 0; j <= n; j++) H[i][j] = hubHeight(X0 + i * N, X0 + j * N); }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x0 = X0 + i * N, z0 = X0 + j * N, x1 = x0 + N, z1 = z0 + N;
        if (x0 >= RIVER.x0 && x1 <= RIVER.x1 && z0 >= RIVER.z0) continue;   // the river's channel
        const q = [[x0, H[i][j], z0], [x1, H[i + 1][j], z0], [x1, H[i + 1][j + 1], z1], [x0, H[i][j + 1], z1]];
        for (const tri of (i + j) % 2 ? [[0, 2, 1], [0, 3, 2]] : [[0, 3, 1], [1, 3, 2]]) {
          const [a, b, c] = tri.map(k => q[k]), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
          const hy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3, jit = rnd() * 0.05 - 0.025, cliff = ny < 0.45, steep = ny < 0.62, slope = ny < 0.8;
          const snow = ny > 0.42 && hy > (cz < -120 ? 34 : 70) + rnd() * 8;   // snow caps on the northern mountains (and only the very tops elsewhere)
          const col = M.col(snow ? '#eef3f8' : cliff ? '#6c685f' : steep ? (hy > 20 ? '#5e6450' : '#506444') : slope ? (hy > 26 ? '#506646' : '#40602f') : hy > 30 ? '#4a6436' : hy > 0.05 ? '#3e5c2e' : GRASS).map(v => Math.max(0, Math.min(1, v + jit)));
          const tex = snow ? 'white' : cliff ? 'rock' : 'grass', key = 'c' + Math.floor((a[0] + b[0] + c[0]) / 3 / 48) + ',' + Math.floor((a[2] + b[2] + c[2]) / 3 / 48);
          const order = uz * vx - ux * vz > 0 ? [a, b, c] : [a, c, b];
          push(key, tex, order.flatMap(p => [p[0], p[1], p[2], nx, ny, nz, col[0], col[1], col[2], p[0] / 8, p[2] / 8]));
        }
      }
      for (const k in geo) E.addStatic(geo[k].a, null, null, geo[k].tex, geo[k].key);
    }
    // a beam from one point to another (ropes, rails, braces)
    function beam(x0, y0, z0, x1, y1, z1, t, col, tex) { const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, h = Math.hypot(dx, dz);
      P(BX, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(dx, dz), t, t, Math.hypot(h, dy), col, tex, -Math.atan2(dy, h), 0); }
    // stone steps from (x0,z0) at height y0 up to (x1,z1) at y1; every step is walkable (steps are lower than 0.45)
    function stairs(x0, z0, x1, z1, w, y0, y1, col) {
      // every step is at least 0.95 deep (deeper than a slayer is wide), so the step after next never blocks you; the top end stays put
      const n0 = Math.ceil((y1 - y0) / 0.32), len0 = Math.hypot(x1 - x0, z1 - z0), want = n0 * 0.95;
      if (len0 < want) { x0 = x1 - (x1 - x0) / len0 * want; z0 = z1 - (z1 - z0) / len0 * want; }
      const n = n0, dx = (x1 - x0) / n, dz = (z1 - z0) / n, yaw = Math.atan2(x1 - x0, z1 - z0), dep = Math.hypot(dx, dz);
      for (let i = 0; i < n; i++) { const cx = x0 + dx * (i + 0.5), cz = z0 + dz * (i + 0.5), top = y0 + (y1 - y0) * (i + 1) / n;
        P(BX, cx, (top + y0 - 0.3) / 2, cz, yaw, w, top - y0 + 0.3, dep + 0.02, i % 2 ? col : mix(col, '#ffffff', 0.06), 'rock'); rect(cx, cz, w, dep, yaw, top, top); }
      for (const sd of [-1, 1]) { const c = Math.cos(yaw), s = Math.sin(yaw), ox = c * sd * (w / 2 + 0.3), oz = -s * sd * (w / 2 + 0.3);   // low side walls
        beam(x0 + ox, y0 + 0.5, z0 + oz, x1 + ox, y1 + 0.5, z1 + oz, 0.6, STONE_D, 'rock'); P(BX, x0 + ox, y0 + 0.35, z0 + oz, yaw, 0.62, 0.7, 0.62, STONE_D, 'rock'); }
    }
    // a raised terrace: retaining walls of big stones with buttresses, a grass top; its collider is a block you stand on
    function terrace(x0, x1, z0, z1, top, gaps) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      P(BX, cx, top / 2 - 0.4, cz, 0, w, top + 0.8, d, STONE, 'rock');
      S(G.plane(w, d, Math.ceil(w / 12), Math.ceil(d / 12)), T(cx, top + 0.015, cz), GRASS, 'grass');
      [[x0, z1, x1, z1, 0, 1], [x0, z0, x1, z0, 0, -1], [x0, z0, x0, z1, -1, 0], [x1, z0, x1, z1, 1, 0]].forEach(([ax, az, bx, bz, nx, nz], f) => {
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 7));
        P(BX, (ax + bx) / 2 + nx * 0.06, top - 0.12, (az + bz) / 2 + nz * 0.06, nx ? Math.PI / 2 : 0, len + 0.3, 0.3, 0.5, COPE, 'rock');
        for (let i = 0; i <= n; i++) { const t = i / n, px = ax + (bx - ax) * t + nx * 0.4, pz = az + (bz - az) * t + nz * 0.4; if (gaps.some(([gx, gz, gw]) => Math.abs(px - gx) < gw && Math.abs(pz - gz) < gw)) continue;
          P(BX, px, top / 2 - 0.25, pz, 0, nx ? 0.8 : 1.4, top + 0.1, nx ? 1.4 : 0.8, STONE_D, 'rock'); rect(px, pz, nx ? 0.8 : 1.4, nx ? 1.4 : 0.8, 0, top - 0.1, top - 0.1); } });
      rect(cx, cz, w, d, 0, top, top);
    }
    // a winding stone path through the points (at the current height)
    function path(pts, w, col) { col = col || PATH;
      for (let i = 0; i < pts.length; i++) { const [x, z] = pts[i]; P(CY12, x, 0.035, z, 0, w / 2, 0.07, w / 2, col, 'cobble');
        if (i) { const [px, pz] = pts[i - 1]; P(BX, (x + px) / 2, 0.035, (z + pz) / 2, Math.atan2(x - px, z - pz), w, 0.07, Math.hypot(x - px, z - pz), col, 'cobble'); } }
      for (let i = 0; i < pts.length - 1; i++) if (rnd() < 0.5) { const [x, z] = pts[i], [nx, nz] = pts[i + 1], t = rnd(), a = Math.atan2(nx - x, nz - z), sd = rnd() < 0.5 ? -1 : 1;   // flowers along the way
        flowers(x + (nx - x) * t + Math.cos(a) * sd * (w / 2 + 0.8), z + (nz - z) * t - Math.sin(a) * sd * (w / 2 + 0.8)); }
    }
    const FLOWERS = ['#b4586a', '#c8ac56', '#cfc9bd', '#7a62a0', '#b06e3c'];
    function flowers(x, z) { const c = pick(FLOWERS); for (let k = 0; k < 4; k++) { const a = rnd() * TAU, r = rnd() * 0.7; P(BX, x + Math.cos(a) * r, 0.2, z + Math.sin(a) * r, rnd() * 3, 0.22, 0.16, 0.22, c); }   // chunky little blooms (cheap: boxes)
      P(CY6, x, 0.08, z, rnd() * 3, 0.75, 0.16, 0.75, '#344c28', 'grass'); }
    function bush(x, z, s) { for (let k = 0; k < 3; k++) { const a = rnd() * TAU, r = k ? s * 0.5 : 0; P(pick(ICO), x + Math.cos(a) * r, s * 0.45, z + Math.sin(a) * r, rnd() * 3, s * R(0.7, 0.9), s * R(0.55, 0.7), s * R(0.7, 0.9), mix('#2f4a26', '#3e5a2e', rnd()), 'grass'); } circ(x, z, s * 0.7, s * 0.9); }
    // a pitched roof (45 degrees) over a w x d box whose walls end at `top`, with gable ends in the wall colour and a ridge beam
    function roofOn(x, z, yaw, w, d, top, roof, wall) {
      const c = Math.cos(yaw), s = Math.sin(yaw), rh = d / 2 + 0.25, run = d / 2 + 0.65, sl = run * Math.SQRT2;
      for (const sd of [-1, 1]) P(BX, x + s * sd * run / 2, top + rh - run / 2 + 0.12, z + c * sd * run / 2, yaw, w + 0.9, 0.32, sl, roof, 'wood', sd * Math.PI / 4, 0);
      if (wall) P(BX, x, top, z, yaw, w - 0.04, rh * Math.SQRT2, rh * Math.SQRT2, wall, 'white', Math.PI / 4, 0);
      P(BX, x, top + rh + 0.25, z, yaw, w + 1.0, 0.3, 0.3, mix(roof, '#000000', 0.35), 'wood');
      return top + rh;
    }
    // a timber-framed house: stone footing, plaster walls, dark beams and braces, a steep roof, chimney, lit windows with shutters, a door
    function home(list, x, z, yaw, w, d, h, o) {
      o = o || {}; const c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      const wall = o.wall || pick(PLASTER), roof = o.roof || pick(ROOFS), beamC = TIMBER, f = 0.55, top = f + h;
      P(BX, x, f / 2, z, yaw, w + 0.4, f, d + 0.4, STONE, 'rock');
      P(BX, x, f + h / 2, z, yaw, w, h, d, wall, 'white');
      for (const yy of [f + 0.12, top - 0.1].concat(o.two ? [f + h * 0.52] : [])) P(BX, x, yy, z, yaw, w + 0.14, 0.26, d + 0.14, beamC, 'wood');
      for (const q of [-w / 2, w / 2]) for (const r of [-d / 2, d / 2]) { const p = at(q, r); P(BX, p[0], f + h / 2, p[1], yaw, 0.32, h, 0.32, beamC, 'wood'); }
      for (const sd of [-1, 1]) for (const q of [-w / 2 + 0.6, w / 2 - 0.6]) { const p = at(q, sd * (d / 2 + 0.05)), yy = o.two ? f + h * 0.76 : f + h * 0.5, hh = o.two ? h * 0.46 : h * 0.9;
        P(BX, p[0], yy, p[1], yaw, Math.hypot(0.9, hh), 0.2, 0.1, beamC, 'wood', 0, (q > 0 ? 1 : -1) * Math.atan2(hh, 0.9)); }
      for (const sd of [-1, 1]) { const p = at(sd * (w / 2 + 0.05), 0); P(BX, p[0], f + h / 2, p[1], yaw + Math.PI / 2, 0.24, h, 0.1, beamC, 'wood'); }
      const rt = roofOn(x, z, yaw, w, d, top, roof, wall);
      if (o.chimney !== false) { const p = at(w * 0.3, -d * 0.2); P(BX, p[0], top + rt * 0.0 + (rt - top) * 0.75, p[1], yaw, 0.75, (rt - top) * 1.5 + 0.8, 0.75, STONE_D, 'brick'); if (o.smoke) HUBD.push({ k: 'smoke', x: p[0], y: Y0 + top + (rt - top) * 1.5 + 0.6, z: p[1] }); }
      const fz = d / 2 + 0.06, wy = o.two ? [f + h * 0.28, f + h * 0.76] : [f + h * 0.55], shut = mix(roof, '#000000', 0.12);
      for (const sd of [1, -1]) for (const yy of wy) for (const q of w > 5.5 ? [-w / 3, 0, w / 3] : [-w / 4, w / 4]) {
        if (sd > 0 && yy === wy[0] && Math.abs(q) < 0.9) continue;
        const p = at(q, sd * fz); win(list, p[0], yy, p[1], sd > 0 ? yaw : yaw + Math.PI, 0.9, 1.0);
        for (const k of [-1, 1]) { const pp = at(q + k * 0.66, sd * (fz + 0.03)); P(BX, pp[0], yy, pp[1], yaw, 0.34, 1.05, 0.08, shut, 'wood'); }
        if (sd > 0 && rnd() < 0.6) { const pp = at(q, fz + 0.2); P(BX, pp[0], yy - 0.62, pp[1], yaw, 1.0, 0.24, 0.32, '#6a4228', 'wood'); for (let k = 0; k < 3; k++) { const p3 = at(q - 0.3 + k * 0.3, fz + 0.22); P(BX, p3[0], yy - 0.44, p3[1], rnd() * 3, 0.2, 0.16, 0.2, pick(FLOWERS)); } } }
      { const p = at(o.door || 0, fz); P(BX, p[0], f + 1.05, p[1], yaw, 1.25, 2.1, 0.14, '#5a341c', 'wood'); const q = at(o.door || 0, d / 2 + 0.55); P(BX, q[0], f / 2, q[1], yaw, 1.7, f, 0.9, STONE_D, 'rock');
        const l = at((o.door || 0) + 0.95, fz + 0.2); if (rnd() < 0.5) torch(list, l[0], f + 2.2, l[1], '#ffb060', 0.7); }
      rect(x, z, w + 0.5, d + 0.5, yaw);
      return rt;
    }
    function fence(x0, z0, x1, z1) { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 2.6));
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; P(BX, x, 0.6, z, Math.atan2(x1 - x0, z1 - z0), 0.2, 1.2, 0.2, '#6a4a2a', 'wood'); }
      for (const y of [0.5, 0.95]) beam(x0, y, z0, x1, y, z1, 0.12, '#7a5632', 'wood'); }
    function lantern(list, x, z, col) {   // a timber lamp post with a hanging lantern (warm light)
      P(BX, x, 1.7, z, 0, 0.22, 3.4, 0.22, TIMBER, 'wood'); P(BX, x + 0.45, 3.3, z, 0, 1.0, 0.16, 0.16, TIMBER, 'wood'); P(BX, x, 0.15, z, 0, 0.5, 0.3, 0.5, STONE_D, 'rock');
      P(BX, x + 0.8, 2.85, z, 0.785, 0.32, 0.42, 0.32, '#2a2228', 'metal'); torch(list, x + 0.8, 2.85, z, col || '#ffb04a', 0.8); circ(x, z, 0.25); }
    function bunting(x0, y0, z0, x1, y1, z1) {   // a rope with little flags strung between two posts (photo 04)
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.2), sag = 0.6, pt = t => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t];
      for (let i = 0; i < n; i++) { const a = pt(i / n), b = pt((i + 1) / n); beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.05, '#3a2a1a');
        if (i % 1 === 0) { const m = pt((i + 0.5) / n); P(CO4, m[0], m[1] - 0.22, m[2], Math.atan2(x1 - x0, z1 - z0), 0.22, -0.4, 0.04, pick(['#8a3a34', '#b0944a', '#3e5a7a', '#c8c0b0', '#4e6a3a'])); } }
    }
    function buildHub() {
      seed(42); const GT = W.GATE;
      hills();
      // ---- the river: stone banks, a bed, water, a waterfall from the mountains; it is solid except at the two bridges
      { const cx = (RIVER.x0 + RIVER.x1) / 2, wd = RIVER.x1 - RIVER.x0, len = RIVER.z1 - RIVER.z0, cz = (RIVER.z0 + RIVER.z1) / 2;
        P(BX, cx, -1.9, cz, 0, wd, 0.3, len, '#2e4a44', 'rock');
        for (const x of [RIVER.x0, RIVER.x1]) { P(BX, x, -0.85, cz, 0, 0.8, 1.9, len, STONE_D, 'rock'); P(BX, x, 0.06, cz, 0, 1.0, 0.16, len, COPE, 'rock'); }
        for (let z = RIVER.z0 + 6; z < RIVER.z1; z += R(5, 11)) P(pick(ICO), R(RIVER.x0 + 1, RIVER.x1 - 1), -1.6, z, rnd() * 6, R(0.5, 1.1), R(0.5, 0.9), R(0.5, 1.1), '#46524a', 'rock');
        HUBD.push({ k: 'water', x: cx, y: RIVER.y, z: cz, w: wd, d: len });
        const fallTop = hubHeight(cx, RIVER.z0 - 6);
        HUBD.push({ k: 'fall', x: cx, z: RIVER.z0 - 0.6, y0: RIVER.y, y1: fallTop - 1, w: wd - 1 });
        for (let k = 0; k < 9; k++) P(pick(ICO), cx + R(-7, 7), R(0, fallTop * 0.7), RIVER.z0 - R(1, 5), rnd() * 6, R(2.5, 5), R(2, 4), R(2, 4), '#666058', 'rock');
        let z0 = RIVER.z0 - 6; for (const b of RIVER.bridges.concat([{ z: RIVER.z1 + 10, w: 0 }])) { const z1 = b.z - b.w / 2; const q = rect(cx, (z0 + z1) / 2, wd + 0.6, z1 - z0, 0); q.nocam = true; z0 = b.z + b.w / 2; } }
      // the rope bridge (z -4): planks that sag a little, posts and rope rails
      { const b = RIVER.bridges[0], xa = RIVER.x0 - 3, xb = RIVER.x1 + 3, n = 22, sagY = x => 0.32 - 0.22 * (1 - Math.pow((x - (xa + xb) / 2) / ((xb - xa) / 2), 2));
        for (let i = 0; i < n; i++) { const x = xa + (xb - xa) * (i + 0.5) / n; P(BX, x, sagY(x) - 0.06, b.z, 0, (xb - xa) / n - 0.08, 0.12, b.w - R(0, 0.3), mix('#5a4028', '#4a3420', rnd()), 'wood'); }
        for (let i = 0; i < 6; i++) { const x = xa + (xb - xa) * (i + 0.5) / 6; rect(x, b.z, (xb - xa) / 6 + 0.02, b.w, 0, sagY(x), sagY(x)); }
        for (const sd of [-1, 1]) { const z = b.z + sd * (b.w / 2 + 0.1); for (const x of [xa, xb]) { P(BX, x, 1.0, z, 0, 0.36, 2.2, 0.36, TIMBER, 'wood'); circ(x, z, 0.3); }
          for (let i = 0; i < 8; i++) { const t0 = i / 8, t1 = (i + 1) / 8, xa0 = xa + (xb - xa) * t0, xa1 = xa + (xb - xa) * t1; beam(xa0, sagY(xa0) + 1.05, z, xa1, sagY(xa1) + 1.05, z, 0.08, '#8a7450'); beam(xa1, sagY(xa1) + 1.05, z, xa1, sagY(xa1), z, 0.05, '#8a7450'); }
          const q = rect((xa + xb) / 2, z + sd * 0.15, xb - xa, 0.3, 0); q.nocam = true; }
        lantern(HUBD, xa - 1.2, b.z - 2.6); lantern(HUBD, xb + 0.4, b.z + 2.6); }
      // the stone bridge (z 32): an arched deck with parapets
      { const b = RIVER.bridges[1], xa = RIVER.x0 - 2.5, xb = RIVER.x1 + 2.5, cx = (xa + xb) / 2;
        P(BX, cx, -0.25, b.z, Math.PI / 2, b.w, 1.1, xb - xa, STONE, 'brick'); P(BX, cx, 0.32, b.z, Math.PI / 2, b.w, 0.06, xb - xa, PATH, 'cobble'); rect(cx, b.z, xb - xa, b.w, 0, 0.34, 0.34);
        for (const ox of [-4, 0, 4]) for (const sd of [-1, 1]) P(CY12, cx + ox, RIVER.y, b.z + sd * (b.w / 2 + 0.01), 0, 0.75, 0.06, 0.75, '#1e2e2e', 'rock', Math.PI / 2, 0);
        for (const sd of [-1, 1]) { const z = b.z + sd * (b.w / 2 + 0.25); P(BX, cx, 0.75, z, Math.PI / 2, 0.5, 0.9, xb - xa, COPE, 'brick'); const q = rect(cx, z, xb - xa, 0.5, 0); q.nocam = true; } }
      // ---- terraces and the steps that climb them
      const GAPS = [[0, -28, 10], [-46, -28, 4], [32, -28, 4], [-34, 42, 4], [58, -22, 4], [-50, -71, 4]];
      TERR.forEach(([x0, x1, z0, z1, top]) => terrace(x0, x1, z0, z1, top, GAPS));
      stairs(0, -19, 0, -28, 16, 0, 3, '#7a7366'); stairs(-46, -19, -46, -28, 5, 0, 3, STONE); stairs(32, -19, 32, -28, 5, 0, 3, STONE);
      stairs(-27, 42, -34, 42, 4, 0, 2.5, STONE); stairs(58, -15, 58, -22, 4, 0, 3, STONE);
      Y0 = 3; stairs(-44, -71, -50, -71, 4, 0, 3, STONE); Y0 = 0;
      for (const sd of [-1, 1]) { lantern(HUBD, sd * 9.6, -18.4); }
      // ---- the town square: worn paving in rings, the slayer statue's plinth (the statue is drawn live), braziers, benches, a well, stalls
      S(G.disc(17, 64, 0.025, 1), T(0, 0, 0), '#7a7366', 'cobble');
      S(G.disc(7.5, 48, 0.04, 1), T(0, 0, 0), '#857e70', 'tile');
      for (const [r, n] of [[17, 64], [7.5, 30]]) for (let i = 0; i < n; i++) { const a = i / n * TAU; P(BX, Math.sin(a) * r, 0.06, Math.cos(a) * r, a, 1.25, 0.1, 0.6, COPE, 'rock'); }
      P(CY20, 0, 0.3, 0, 0, 3.4, 0.6, 3.4, STONE_D, 'rock'); P(BX, 0, 1.05, 0, Math.PI / 4, 3.4, 1.0, 3.4, STONE, 'brick'); P(BX, 0, 1.62, 0, Math.PI / 4, 3.0, 0.18, 3.0, COPE, 'rock');
      circ(0, 0, 3.4, 0.6, 0.6); circ(0, 0, 2.3);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4, x = Math.sin(a) * 5, z = Math.cos(a) * 5; P(CY8, x, 0.5, z, 0, 0.32, 1, 0.32, STONE_D, 'rock'); P(CY8, x, 1.12, z, 0, 0.55, 0.28, 0.55, '#3a3438', 'metal'); torch(HUBD, x, 1.4, z, '#ff8a2a', 1.6); circ(x, z, 0.55); }
      for (const [x, z, a] of [[-12.5, -5, 1.2], [12.5, -5, -1.2], [-6, 12.5, 0.3], [6, 12.5, -0.3], [-13, 6, 1.9], [13, 6, -1.9]]) { P(BX, x, 0.45, z, a, 2.2, 0.14, 0.62, '#7a5432', 'wood'); for (const sd of [-1, 1]) P(BX, x + Math.cos(a) * sd * 0.9, 0.22, z - Math.sin(a) * sd * 0.9, a, 0.16, 0.45, 0.52, STONE_D, 'rock'); rect(x, z, 2.2, 0.6, a, 0.55, 0.55); }
      { const x = 13, z = 15; P(CY12, x, 0.55, z, 0, 1.25, 1.1, 1.25, STONE, 'brick'); P(CY12, x, 1.13, z, 0, 1.0, 0.06, 1.0, '#2a4a5a'); for (const sd of [-1, 1]) P(BX, x + sd * 1.05, 1.8, z, 0, 0.16, 1.6, 0.16, TIMBER, 'wood');
        roofOn(x, z, 0, 2.4, 1.8, 2.6, '#b8482e'); circ(x, z, 1.3, 1.1); }
      const AWN = ['#7a3028', '#344c70', '#3e5a34', '#8a6a30', '#5a3462'];
      for (const [x, z, a, k] of [[-14, -12, 0.9, 0], [-17, 3, 1.5, 1], [17, 0, -1.5, 2]]) { const c = Math.cos(a), s = Math.sin(a);
        P(BX, x, 0.55, z, a, 3.2, 1.1, 1.4, '#7a5432', 'wood'); for (const ox of [-1.5, 1.5]) for (const oz of [-0.6, 0.6]) P(BX, x + c * ox + s * oz, 1.5, z - s * ox + c * oz, a, 0.14, 3.0, 0.14, TIMBER, 'wood');
        P(BX, x, 3.0, z, a, 3.8, 0.12, 2.2, AWN[k], 'wood', 0.22); for (let j = 0; j < 4; j++) P(pick(ICO), x + c * (j - 1.5) * 0.7, 1.28, z - s * (j - 1.5) * 0.7, rnd() * 3, 0.24, 0.22, 0.24, pick(['#d84a3a', '#e8b83a', '#8ad84a', '#e88a3a']));
        rect(x, z, 3.4, 1.6, a, 1.1, 1.1); D_hubCandle(x + c * 1.1, 1.2, z - s * 1.1); }
      // ---- the streets: stone paths from the square to every building, the bridges, the gates and the terraces
      for (const p of [[[0, -16], [0, -19]], [[-15, 4], [-21, 5.5], [-26, 6]], [[-12, -9], [-17, -12.5], [-21, -14]], [[-16, -3], [-28, -4], [-40, -5], [-48, -6]], [[-48, -6], [-50, -2], [-58, 6], [-66, 9], [-78, 10]],
        [[14, -8], [20, -11], [25, -12]], [[16, -2], [26, -3], [34, -4], [37.5, -4]], [[50.5, -4], [54, -5], [58, -6]], [[12, 10], [22, 18], [30, 28], [37, 32]], [[51, 32], [55, 28], [58, 24]],
        [[0, 16], [0, 30], [3, 42], [-1, 56], [1, 68], [0, 82]], [[-10, 16], [-10, 22]], [[10, 16], [10, 22]], [[-11, 20], [-18, 30], [-24, 40], [-27, 42]], [[58, -9], [58, -12.5]],
        [[3, 42], [14, 46], [24, 52], [30, 62]], [[-1, 56], [-14, 56], [-24, 62]], [[32, -19], [32, -12], [26, -6]], [[-46, -19], [-46, -12]]]) path(p, 3.2);
      Y0 = 3; path([[-36, -40], [-44, -44], [-52, -42], [-60, -46]], 2.8); path([[-40, -56], [-44, -64], [-44, -71]], 2.8); Y0 = 2.5; path([[-34, 42], [-42, 44], [-50, 42], [-54, 46]], 2.6); Y0 = 3; path([[58, -22], [60, -30], [64, -36]], 2.6); Y0 = 0;
      for (const [x, z] of [[-8, 34], [8, 34], [-6, 50], [8, 60], [-5, 72], [6, 76], [20, -3], [30, -6], [-34, -6], [-60, 4], [24, 24], [34, 30], [54, -2], [56, 30]]) lantern(HUBD, x, z);
      bunting(-8.3, 3.2, 34, 8.3, 3.2, 34); bunting(19.7, 3.2, -3, 29.7, 3.2, -6); bunting(-6.2, 3.2, 50, 7.7, 3.2, 60);
      // ---- THE GRAND GATE: the terrace's paved plaza, twelve portal arches in an arc, the great curved wall and its sealed gate behind them
      Y0 = GT.y;
      P(BX, 0, 0.03, -36, 0, 15, 0.06, 16, '#857e70', 'tile'); S(G.disc(21, 56, GT.y + 0.035, 1), T(GT.x, 0, GT.z), '#7d7669', 'tile');
      for (let i = 0; i < 44; i++) { const a = (180 + (i + 0.5) * 180 / 44) * Math.PI / 180; P(BX, GT.x + Math.cos(a) * 28, 0.04, GT.z + Math.sin(a) * 28, Math.atan2(-Math.cos(a), -Math.sin(a)), 4.4, 0.08, 7.6, i % 2 ? '#78716a' : '#827a70', 'tile'); }
      for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; P(BX, GT.x + Math.cos(a) * 21, 0.07, GT.z + Math.sin(a) * 21, Math.atan2(-Math.cos(a), -Math.sin(a)), 2.2, 0.1, 0.6, COPE, 'rock'); }
      for (const a of [200, 230, 250, 290, 310, 340]) { const r = a * Math.PI / 180; bush(GT.x + Math.cos(r) * 24, GT.z + Math.sin(r) * 24, 0.9); }
      for (const sd of [-1, 1]) { for (const z of [-33, -38]) lantern(HUBD, sd * 8.6, z); bush(sd * 14, -34, 1.2); flowers(sd * 18, -36); flowers(sd * 12, -40); }
      S(G.disc(12, 48, GT.y + 0.06, 1), T(GT.x, 0, GT.z), '#8a8274', 'tile'); for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; P(BX, GT.x + Math.sin(a) * 12, 0.08, GT.z + Math.cos(a) * 12, a, 1.9, 0.08, 0.7, '#8a8070', 'rock'); }
      HUBD.push({ k: 'floorRune', x: GT.x, y: GT.y, z: GT.z, r: 10, col: '#7ad0e8' });
      P(CY20, GT.x, 0.5, GT.z, 0, 2.2, 1.0, 2.2, STONE, 'brick'); P(CY20, GT.x, 1.1, GT.z, 0, 2.5, 0.2, 2.5, COPE, 'rock'); circ(GT.x, GT.z, 2.3); HUBD.push({ k: 'orb', x: GT.x, y: GT.y + 2.6, z: GT.z, col: '#7ad0e8' });
      W.PORTALS.forEach(p => {
        const yaw = Math.atan2(GT.x - p.x, GT.z - p.z), d = C.DUNGEONS[p.k], wc = d.col;
        P(CY20, p.x, 0.15, p.z, 0, 3.0, 0.3, 3.0, STONE_D, 'rock'); P(CY20, p.x, 0.32, p.z, 0, 2.6, 0.06, 2.6, mix(wc, '#000000', 0.3));
        arch(p.x, p.z, yaw, 4.8, 5.4, '#76717e');
        for (const sd of [-1, 1]) { const px = p.x + Math.cos(yaw) * sd * 2.4, pz = p.z - Math.sin(yaw) * sd * 2.4; P(BX, px, 5.6, pz, yaw, 1.5, 0.4, 1.5, COPE, 'rock'); torch(HUBD, px + Math.sin(yaw) * 0.8, 4.4, pz + Math.cos(yaw) * 0.8, wc); }
        const sg = sign(d.n.toUpperCase(), 'Level ' + d.lvl + '+', wc, 512, 150); WD.portalSigns[p.k] = sg;
        signAt(HUBD, sg, p.x + Math.sin(yaw) * 1.0, 8.4, p.z + Math.cos(yaw) * 1.0, yaw, 4.6, 1.35);
        HUBD.push({ k: 'portal', x: p.x, y: GT.y + 3.0, z: p.z, yaw, r: 2.1, col: wc, dk: p.k });
      });
      { const R0 = 37, a0 = 184, a1 = 356, n = 30;
        for (let i = 0; i < n; i++) { const a = (a0 + (i + 0.5) * (a1 - a0) / n) * Math.PI / 180, x = GT.x + Math.cos(a) * R0, z = GT.z + Math.sin(a) * R0, yaw = Math.atan2(-Math.cos(a), -Math.sin(a)), len = R0 * (a1 - a0) / n * Math.PI / 180 + 0.4;
          if (Math.abs(x) < 6 && z < GT.z - 30) continue; wallSeg(x, z, yaw, len, 8, '#6c6772'); rect(x, z, len, 1.8, yaw); }
        for (const a of [a0, 214, 242, 298, 326, a1]) { const r = a * Math.PI / 180; tower(HUBD, GT.x + Math.cos(r) * (R0 + 0.6), GT.z + Math.sin(r) * (R0 + 0.6), a === a0 || a === a1 ? 3.2 : 2.4, a === a0 || a === a1 ? 13 : 10.5, '#726d78', '#3a4860'); }
        const gz = GT.z - R0; arch(0, gz, 0, 9, 10, '#6c6772'); for (const sd of [-1, 1]) { tower(HUBD, sd * 8.4, gz - 0.5, 3.0, 15, '#726d78', '#463656'); }
        P(BX, 0, 4.6, gz - 0.4, 0, 8.6, 9.2, 0.5, '#5a3a22', 'wood'); for (const y of [2, 4.6, 7.2]) P(BX, 0, y, gz - 0.1, 0, 8.8, 0.3, 0.3, '#3a3438', 'metal'); rect(0, gz - 0.4, 10, 1.4, 0);
        P(BX, 0, 13.4, gz, 0, 12, 1.4, 2.6, '#6c6772', 'brick');
        banner(HUBD, -2.6, 9.5, gz + 1.1, 0, 1.4, 4, BAN_PURP); banner(HUBD, 2.6, 9.5, gz + 1.1, 0, 1.4, 4, BAN_PURP);
        const sg = sign('THE GRAND GATE', 'Twelve dungeons · walk into a portal', '#8ad8ff', 640, 150); signAt(HUBD, sg, 0, 15.3, gz + 1.4, 0, 7.5, 1.75); }
      Y0 = 0;
      // the terrace's front: a balustrade either side of the great stairs, lamps and banners
      for (const [xa, xb] of [[-72, -48.6], [-43.4, -8.4], [8.4, 29.4], [34.6, 39.5]]) { beam(xa, 3.55, -28.3, xb, 3.55, -28.3, 0.35, COPE, 'rock'); for (let x = xa; x <= xb; x += 2.4) P(BX, x, 3.3, -28.3, 0, 0.3, 0.6, 0.3, STONE, 'rock'); const q = rect((xa + xb) / 2, -28.3, xb - xa, 0.4, 0, 4, 4); q.nocam = true; }
      for (const x of [-20, 20]) { banner(HUBD, x, 1.4, -27.7, 0, 1.4, 2.4, BAN_BLUE); }
      // ---- FORGE: a stone smithy with a timber canopy over the open front, a roaring furnace, an anvil, racks and a big chimney
      { const x = -36, z = 6, yaw = Math.PI / 2, c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
        { const p = at(0, -1.5); P(BX, p[0], 2.5, p[1], yaw, 11, 5.0, 6, STONE, 'brick'); roofOn(p[0], p[1], yaw, 11, 6, 5.0, '#86502e', STONE); rect(p[0], p[1], 11.4, 6.4, yaw); }
        { const p = at(0, 2.9); P(BX, p[0], 3.9, p[1], yaw, 11.6, 0.25, 3.6, '#86502e', 'wood', 0.32, 0); for (const lx of [-5.4, 0, 5.4]) { const q = at(lx, 4.4); P(BX, q[0], 1.9, q[1], yaw, 0.4, 3.8, 0.4, TIMBER, 'wood'); circ(q[0], q[1], 0.3); } }
        { const p = at(-3.6, -3.2); P(BX, p[0], 5.5, p[1], yaw, 2.0, 11, 2.0, STONE_D, 'brick'); P(BX, p[0], 11.1, p[1], yaw, 2.3, 0.4, 2.3, COPE, 'rock'); HUBD.push({ k: 'smoke', x: p[0], y: 11.6, z: p[1] }); }
        { const p = at(-3.2, 1.7); P(BX, p[0], 1.15, p[1], yaw, 2.6, 2.3, 1.8, STONE_D, 'brick'); rect(p[0], p[1], 2.7, 1.9, yaw); const f = at(-3.2, 2.63); HUBD.push({ k: 'furnace', x: f[0], y: 1.0, z: f[1], yaw }); }
        { const p = at(0.6, 3.0); P(BX, p[0], 0.35, p[1], yaw + 0.3, 0.7, 0.7, 0.5, '#3a3438'); P(BX, p[0], 0.86, p[1], yaw + 0.3, 1.35, 0.34, 0.56, '#5a5a66', 'metal'); circ(p[0], p[1], 0.7, 1.0); }
        { const p = at(3.6, 1.6); P(BX, p[0], 1.1, p[1], yaw, 2.6, 2.2, 0.18, TIMBER, 'wood'); for (let i = 0; i < 4; i++) { const q = at(2.7 + i * 0.6, 1.75); P(BX, q[0], 1.3, q[1], yaw, 0.12, 1.8, 0.06, '#b8bcc8', 'metal'); } rect(p[0], p[1], 2.8, 0.6, yaw); }
        { const p = at(4.8, 3.6); HUBD.push({ k: 'mannequin', x: p[0], z: p[1], yaw: yaw + 0.5, fit: 'plate' }); circ(p[0], p[1], 0.6); }
        { const p = at(-5.8, 3.6); barrel(p[0], p[1]); const q = at(-4.9, 4.4); crate(q[0], q[1], 0.9, 0.3); }
        const sg = sign('BLACKSMITH', 'Upgrade · Salvage · Buy gear', W.STN.smith.c); WD.stationSigns.smith = sg; { const p = at(0, 4.75); signAt(HUBD, sg, p[0], 4.6, p[1], yaw, 4, 1.25); }
        for (const lx of [-5.4, 5.4]) { const q = at(lx, 4.7); torch(HUBD, q[0], 3.2, q[1], '#ff7a1a'); } }
      // ---- the old tower (Update 7 final: the Enchanter is gone, its tower stays as the town's landmark): (stone shaft, a timber-framed top room, a tall purple cone roof), a floating orb at the door
      { const x = -27, z = -20, R0 = 4.4, da = Math.atan2(-z, -x), dyaw = Math.atan2(Math.cos(da), Math.sin(da)), dx = Math.cos(da), dz = Math.sin(da);
        P(CY20, x, 0.5, z, 0, R0 + 0.8, 1.0, R0 + 0.8, STONE_D, 'rock'); P(CY20, x, 6.5, z, 0, R0, 12, R0, '#7a7484', 'brick');
        P(CY20, x, 12.6, z, 0, R0 + 1.0, 0.5, R0 + 1.0, COPE, 'rock'); P(CY20, x, 14.9, z, 0, R0 + 0.75, 4.2, R0 + 0.75, '#b4a890', 'white');
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; P(BX, x + Math.cos(a) * (R0 + 0.78), 14.9, z + Math.sin(a) * (R0 + 0.78), Math.atan2(Math.cos(a), Math.sin(a)), 0.28, 4.2, 0.16, TIMBER, 'wood'); }
        for (const yy of [13.0, 16.9]) P(CY20, x, yy, z, 0, R0 + 0.84, 0.28, R0 + 0.84, TIMBER, 'wood');
        P(CO12, x, 17.5, z, 0, R0 + 2.4, 1.3, R0 + 2.4, '#3a2a52'); P(CO12, x, 21.4, z, 0, R0 + 1.6, 9.0, R0 + 1.6, '#46325e');
        P(CY6, x, 26.6, z, 0, 0.12, 2.4, 0.12, '#d8b84a', 'metal'); P(SPH, x, 28.0, z, 0, 0.36, 0.36, 0.36, '#ffd86a');
        for (let k = 0; k < 4; k++) { const a = da + 1.2 + k * 1.3; win(HUBD, x + Math.cos(a) * (R0 + 0.03), 3.4 + k * 2.2, z + Math.sin(a) * (R0 + 0.03), Math.atan2(Math.cos(a), Math.sin(a)), 0.6, 1.05); }
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; win(HUBD, x + Math.cos(a) * (R0 + 0.8), 15.0, z + Math.sin(a) * (R0 + 0.8), Math.atan2(Math.cos(a), Math.sin(a)), 0.9, 1.15); }
        for (const yy of [4.2, 9.2]) HUBD.push({ k: 'glowRing', x, y: yy, z, r: R0 + 0.06, col: '#c08aff' });
        P(BX, x + dx * (R0 + 0.05), 1.6, z + dz * (R0 + 0.05), dyaw, 1.7, 2.6, 0.3, '#4a2a62', 'wood'); P(BX, x + dx * (R0 + 0.2), 3.05, z + dz * (R0 + 0.2), dyaw, 2.3, 0.4, 0.6, COPE, 'rock');
        circ(x, z, R0 + 0.8);
        torch(HUBD, x + dx * (R0 + 0.35) + dz * 1.4, 2.6, z + dz * (R0 + 0.35) - dx * 1.4, '#c08aff'); }
      // ---- QUEST BOARD and DAILY GIFT, each under a little timber roof
      { const x = -10, z = 24.6; for (const sd of [-1, 1]) P(BX, x + sd * 1.9, 1.6, z, 0, 0.26, 3.2, 0.26, TIMBER, 'wood'); P(BX, x, 1.9, z, 0, 3.6, 1.9, 0.18, '#8a6238', 'wood');
        roofOn(x, z, 0, 4.2, 1.2, 3.2, '#5c7a40'); HUBD.push({ k: 'questPapers', x, y: 1.9, z: z - 0.12 }); rect(x, z, 4.2, 0.6);
        const sg = sign('REWARDS', 'Battle Pass · Milestones', W.STN.quests.c, 512, 150); WD.stationSigns.quests = sg; signAt(HUBD, sg, x, 3.15, z - 0.85, Math.PI, 3.0, 0.9); }
      // DAILY GIFT (after reference photo 3): a heap of gold, coin sacks and loot round the chest, a sword stuck in the top, two signboards
      { const x = 10, z = 25; for (let k = 0; k < 9; k++) { const a = rnd() * TAU, r = rnd() * 1.6; P(pick(ICO), x + Math.cos(a) * r, 0.25, z + Math.sin(a) * r, rnd() * 6, R(1.2, 1.9), R(0.6, 1.1), R(1.2, 1.9), pick(['#b88a2e', '#c8982e']), 'metal'); }   // a lumpy heap, not a dome
        for (let k = 0; k < 70; k++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * 3.4, hh = Math.max(0.12, 1.9 - r * 0.5); P(CY8, x + Math.cos(a) * r, hh * 0.55, z + Math.sin(a) * r, rnd() * 3, R(0.32, 0.5), 0.12, R(0.32, 0.5), pick(['#d8a83a', '#c4962e', '#e6b84a']), 'metal', R(-0.5, 0.5), R(-0.5, 0.5)); }
        for (let k = 0; k < 4; k++) { const a = k * 1.7 + 0.4; P(SPH, x + Math.cos(a) * 2.2, 0.45, z + Math.sin(a) * 2.2, a, 0.45, 0.5, 0.45, '#8a6a44', 'wood'); P(CY8, x + Math.cos(a) * 2.2, 0.9, z + Math.sin(a) * 2.2, 0, 0.12, 0.2, 0.12, '#5a4228', 'wood'); }
        P(BX, x + 1.4, 0.5, z - 1.6, 0.5, 1.0, 0.7, 0.7, '#5a3a22', 'wood'); P(BX, x - 1.7, 0.35, z + 1.4, 0.2, 0.7, 0.5, 0.5, '#5a3a22', 'wood');
        beam(x + 0.3, 0.9, z + 0.3, x + 0.4, 2.9, z + 0.1, 0.12, '#9aa0a8', 'metal'); P(BX, x + 0.38, 2.2, z + 0.15, 0, 0.6, 0.1, 0.12, '#6a4a2a', 'wood');
        P(BX, x, 0.25, z, 0, 2.0, 0.5, 1.6, '#a07c38', 'metal'); rect(x, z, 4.2, 4.2, 0, 1.2, 0.5); HUBD.push({ k: 'giftChest', x, y: 0.55, z: z - 0.4, yaw: Math.PI });
        for (const [sx, yaw] of [[-3.6, 0.5], [3.6, -0.5]]) { P(BX, x + sx, 0.9, z + 1.2, yaw, 0.16, 1.8, 0.16, TIMBER, 'wood'); P(BX, x + sx, 1.9, z + 1.2, yaw, 2.2, 1.2, 0.12, '#5a4028', 'wood'); circ(x + sx, z + 1.2, 0.3); }
        const sg = sign('DAILY GIFT', 'Come back every day', W.STN.gift.c, 512, 150); WD.stationSigns.gift = sg; signAt(HUBD, sg, x - 3.6 + 0.03, 1.9, z + 1.12, Math.PI + 0.5, 2.0, 0.6);
        const sg2 = sign('FREE GEAR', '4 pieces of gear every day', '#3ad8e0', 512, 150); signAt(HUBD, sg2, x + 3.6 - 0.03, 1.9, z + 1.12, Math.PI - 0.5, 2.0, 0.6); }
      // ---- THE PIT: a stone gatehouse (wave defence) with square towers, a portcullis and black banners
      { const x = -56, z = -8, yaw = Math.atan2(-x, -z), c = Math.cos(yaw), s = Math.sin(yaw);
        arch(x, z, yaw, 6, 6.5, '#665c5c'); HUBD.push({ k: 'pitGate', x: x + s * 0.2, z: z + c * 0.2, yaw });
        for (const sd of [-1, 1]) { const tx = x + c * sd * 6.2, tz = z - s * sd * 6.2; P(BX, tx, 5, tz, yaw, 4.4, 10, 4.4, '#6a605c', 'brick'); P(BX, tx, 10.3, tz, yaw, 5.0, 0.6, 5.0, COPE, 'rock');
          for (const [ox, oz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) P(BX, tx + c * ox + s * oz, 11.0, tz - s * ox + c * oz, yaw, 1.0, 0.9, 1.0, '#6a605c', 'brick'); rect(tx, tz, 4.6, 4.6, yaw);
          banner(HUBD, x + c * sd * 4.2 + s * 2.3, 6.2, z - s * sd * 4.2 + c * 2.3, yaw, 1.3, 3.6, BAN_BLACK); torch(HUBD, x + c * sd * 3.4 + s * 1.0, 6.6, z - s * sd * 3.4 + c * 1.0, '#ff2a1a', 1.3); }
        P(BX, x - s * 3, 4, z - c * 3, yaw, 8.2, 8, 4, '#5e5652', 'brick'); rect(x - s * 3, z - c * 3, 8.2, 4, yaw);
        const sg = sign('THE PIT', 'Wave defence · how long can you last?', W.STN.arena.c); WD.stationSigns.arena = sg; signAt(HUBD, sg, x + s * 0.8, 8.4, z + c * 0.8, yaw, 4.0, 1.25); }
      // ---- HALL OF SLAYERS (across the rope bridge): a columned stone hall, the three leaderboard tablets inside
      { const x = 66, z = -6, yaw = -Math.PI / 2, c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
        P(BX, x, 0.2, z, yaw, 14, 0.4, 9, COPE, 'rock'); rect(x, z, 14, 9, yaw, 0.4, 0.4); { const p = at(0, 5.0); P(BX, p[0], 0.1, p[1], yaw, 12, 0.2, 1.2, STONE, 'rock'); }
        { const p = at(0, -3.9); P(BX, p[0], 3.4, p[1], yaw, 13, 6.4, 1.0, '#77727e', 'brick'); rect(p[0], p[1], 13, 1.0, yaw); }
        for (const sd of [-1, 1]) { const p = at(sd * 6.3, -0.3); P(BX, p[0], 3.4, p[1], yaw, 0.8, 6.4, 7.0, '#77727e', 'brick'); rect(p[0], p[1], 0.8, 7.0, yaw); }
        for (let i = 0; i < 6; i++) { const p = at(-5.2 + i * 2.08, 3.6); P(CY12, p[0], 3.4, p[1], 0, 0.42, 6.0, 0.42, '#a8a094', 'white'); P(BX, p[0], 0.6, p[1], 0, 1.0, 0.4, 1.0, COPE, 'rock'); P(BX, p[0], 6.5, p[1], 0, 1.0, 0.3, 1.0, COPE, 'rock'); circ(p[0], p[1], 0.45); }
        { const p = at(0, 0); P(BX, p[0], 6.9, p[1], yaw, 14, 0.6, 9, COPE, 'rock'); roofOn(p[0], p[1], yaw, 13.4, 8.6, 7.2, '#3a4860', '#d8d0c0'); }
        for (let i = -1; i <= 1; i++) { const p = at(i * 3.9, -3.3); HUBD.push({ k: 'tablet', i: i + 1, x: p[0], y: 3.2, z: p[1], yaw }); }
        const sg = sign('HALL OF SLAYERS', 'Leaderboards', W.STN.board.c); WD.stationSigns.board = sg; { const p = at(0, 4.35); signAt(HUBD, sg, p[0], 5.7, p[1], yaw, 4.6, 1.35); }
        for (const sd of [-1, 1]) { const p = at(sd * 6.6, 4.8); torch(HUBD, p[0], 2.4, p[1], '#ffd84a'); } }
      // ---- the SHOP (was the Armory; across the stone bridge): a two-storey tailor's shop, an awning over the shop window, mannequins outside
      { const x = 66, z = 24, yaw = -Math.PI / 2, c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
        home(HUBD, x, z, yaw, 9, 6, 6.2, { two: true, roof: '#c8763a', wall: '#b8ac96', door: -2.6 });
        { const p = at(1.4, 3.6); P(BX, p[0], 2.8, p[1], yaw, 5.2, 0.12, 1.8, '#6e2e26', 'wood', 0.3); for (const lx of [-1.2, 4.0]) { const q = at(lx, 4.4); P(BX, q[0], 1.4, q[1], yaw, 0.14, 2.8, 0.14, TIMBER, 'wood'); } }
        HUBD.push({ k: 'mannequin', x: x - 5.0, z: z - 2.4, yaw: yaw + 0.3, fit: 'coat' }); HUBD.push({ k: 'mannequin', x: x - 5.0, z: z + 2.6, yaw: yaw - 0.3, fit: 'knight' }); circ(x - 5.0, z - 2.4, 0.6); circ(x - 5.0, z + 2.6, 0.6);
        const sg = sign('SHOP', 'Chests · Skins · Your look', W.STN.armory.c); WD.stationSigns.armory = sg; { const p = at(1.4, 3.35); signAt(HUBD, sg, p[0], 3.9, p[1], yaw, 3.4, 1.05); } }
      // ---- the gates: the south gatehouse (sealed) and the west gate to the Wildgate Market
      { const z = 82; arch(0, z, 0, 8, 7.5, STONE); for (const sd of [-1, 1]) tower(HUBD, sd * 6.4, z + 0.4, 2.6, 11, STONE, '#b8482e'); P(BX, 0, 3.4, z + 0.5, 0, 7.4, 6.8, 0.4, '#5a3a22', 'wood'); rect(0, z + 0.5, 14, 1.2, 0);
        P(BX, 0, 9.6, z, 0, 9.4, 1.2, 2.2, STONE, 'brick'); banner(HUBD, -2.8, 5.6, z - 0.9, Math.PI, 1.3, 3.4, BAN_RED); banner(HUBD, 2.8, 5.6, z - 0.9, Math.PI, 1.3, 3.4, BAN_RED); }
      { const G2 = W.WEST_GATE; arch(G2.x, G2.z, Math.PI / 2, G2.w + 1.5, 8, STONE); for (const sd of [-1, 1]) tower(HUBD, G2.x - 0.4, G2.z + sd * (G2.w / 2 + 2.4), 2.3, 11, STONE, '#3a4860');
        for (const sd of [-1, 1]) { const q = rect(G2.x - 0.4, G2.z + sd * (G2.w / 2 + 8), 3, 12, 0); P(BX, G2.x - 0.4, 2.2, G2.z + sd * (G2.w / 2 + 8), 0, 2.4, 4.4, 12, STONE, 'brick'); }
        const sg2 = sign('WILDGATE MARKET', 'Duskhold · west ward', '#ffd84a', 512, 150); signAt(HUBD, sg2, G2.x + 1.2, 9.2, G2.z, -Math.PI / 2, 4.4, 1.3); }
      // ---- the Wildgate Market beyond the west gate (stalls, the Lamplighter's tower, a map table, the gate to the Wilds)
      { const A = W.ANNEX, G2 = W.WEST_GATE, cx = (A.x0 + A.x1) / 2, cz = (A.z0 + A.z1) / 2, wd = A.x1 - A.x0, dp = A.z1 - A.z0;
        P(BX, (A.x1 + G2.x) / 2, 0.035, G2.z, Math.PI / 2, G2.w, 0.05, G2.x - A.x1 + 2, PATH, 'cobble');
        P(BX, cx, 0.025, cz, 0, wd, 0.05, dp, '#a49880', 'cobble');
        for (const z of [A.z0, A.z1]) for (let x = A.x0; x < A.x1 + 2; x += 6) { P(BX, x + 3, 1.6, z, 0, 6.2, 3.2, 1.0, STONE, 'brick'); circ(x + 3, z, 3.1, 3.2); }
        for (let z = A.z0; z < A.z1; z += 4) if (Math.abs(z + 2 - G2.z) > 4.5) { P(BX, A.x0, 1.6, z + 2, 0, 1.0, 3.2, 4.2, STONE, 'brick'); circ(A.x0, z + 2, 2.1, 3.2); }
        for (let k = 0; k < 6; k++) { const x = A.x0 + 12 + (k % 3) * 11, z = k < 3 ? A.z1 - 4.5 : A.z0 + 4.5, sd = k < 3 ? -1 : 1;
          P(BX, x, 0.55, z, 0, 3.6, 1.1, 1.6, '#7a5432', 'wood'); for (const ox of [-1.7, 1.7]) P(BX, x + ox, 1.6, z - sd * 0.6, 0, 0.16, 3.2, 0.16, TIMBER, 'wood');
          P(BX, x, 3.2, z, 0, 4.2, 0.12, 2.6, AWN[k % AWN.length], 'wood', sd * 0.25); P(BX, x - 0.8, 1.25, z, 0.3, 0.5, 0.35, 0.5, pick(['#c89a5a', '#8ab85a', '#c85a4a']), 'wood'); circ(x, z, 1.9, 1.1);
          if (k % 2 === 0) D_hubCandle(x + 1.2, 1.35, z); }
        tower(HUBD, A.x0 + 6, A.z1 - 5, 2.8, 14, STONE, '#3a4860'); HUBD.push({ k: 'lanternTower', x: A.x0 + 6, z: A.z1 - 5, y: 15.5 });
        P(BX, cx + 4, 1.0, G2.z - 5.5, 0, 3, 0.2, 2, '#7a5432', 'wood'); P(BX, cx + 4, 0.5, G2.z - 5.5, 0, 0.4, 1.0, 0.4, TIMBER, 'wood'); P(BX, cx + 4, 1.12, G2.z - 5.5, 0.1, 2.6, 0.04, 1.7, '#e8d8a8', 'wood'); circ(cx + 4, G2.z - 5.5, 1.7, 1.2);
        arch(A.x0 + 2, G2.z, Math.PI / 2, 6.5, 7.5, STONE); HUBD.push({ k: 'portal', x: A.x0 + 2, y: 3.4, z: G2.z, yaw: Math.PI / 2, r: 2.6, col: '#9ad8a0' });
        const sg = sign('THE WILDS', 'Camps of slimes · secrets · the Far Gates', '#9ad8a0', 512, 150); signAt(HUBD, sg, A.x0 + 3, 8.8, G2.z, Math.PI / 2, 4.6, 1.4);
        for (const sd of [-1, 1]) torch(HUBD, A.x0 + 3, 6.4, G2.z + sd * 3.9, '#9ad8a0'); }
      // ---- houses on every level: the streets (y 0), the west hill (+2.5), the gate terrace's west ward (+3), the east hill (+3), the windmill rise (+6)
      const HOUSES = [
        [0, 30, 14, 0.4, 6, 5, 3.6], [0, -24, 24, 1.4, 6.5, 5, 4.4, 1], [0, 18, 42, -0.3, 6, 5, 3.6], [0, 28, 40, -1.2, 5.5, 5, 6, 1], [0, 32, 54, -1.6, 6, 5, 3.6], [0, 18, 60, 0.2, 7, 5, 6.2, 1], [0, 28, 70, 0.1, 5.5, 4.6, 3.6],
        [0, -16, 46, 1.6, 6, 5, 3.8], [0, -26, 56, 1.1, 6, 5, 6, 1], [0, -12, 66, 0.2, 5.5, 4.6, 3.6], [0, -26, 70, 0.6, 6, 4.8, 3.8], [0, 30, 4, -1.6, 6, 5, 6, 1],
        [2.5, -44, 34, 0.2, 6.5, 5, 4], [2.5, -56, 36, 0.4, 6, 5, 6.4, 1], [2.5, -46, 52, 1.5, 6, 5, 3.8], [2.5, -58, 52, 0.9, 5.5, 5, 3.6],
        [3, -50, -36, 0.1, 6.5, 5, 6, 1], [3, -62, -38, 0.4, 6, 5, 3.8], [3, -50, -50, 1.5, 6, 5, 3.6], [3, -64, -54, 1.1, 6, 5, 6, 1], [3, -52, -62, 1.0, 5.5, 4.6, 3.6],
        [3, 68, -28, -0.4, 6, 5, 3.8], [3, 70, -40, -1.2, 6, 5, 6, 1], [3, 59, -43, -0.1, 5.5, 4.6, 3.6], [6, -58, -76, 0.6, 6, 5, 3.8]];
      HOUSES.forEach(([y, x, z, yaw, w, d, h, two], i) => { Y0 = y; home(HUBD, x, z, yaw, w, d, h, { two: !!two, smoke: i % 4 === 0 }); });
      // the windmill on the rise (+6): a round stone mill, a cone roof, four sails
      Y0 = 6; { const x = -66, z = -84; P(CY12, x, 4, z, 0, 3.0, 8, 3.0, '#a89c88', 'white'); P(CY12, x, 0.4, z, 0, 3.4, 0.8, 3.4, STONE, 'rock'); P(CO12, x, 9.8, z, 0, 3.6, 3.8, 3.6, '#b8482e'); circ(x, z, 3.2);
        for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; P(BX, x + 3.3, 8.2 + Math.sin(a) * 3.2, z + Math.cos(a) * 3.2, Math.PI / 2, 0.16, 6.4, 0.2, TIMBER, 'wood', 0, a); P(BX, x + 3.4, 8.2 + Math.sin(a) * 4.0, z + Math.cos(a) * 4.0, Math.PI / 2, 1.4, 4.0, 0.06, '#b8ae9a', 'white', 0, a); }
        win(HUBD, x + 3.02, 5.2, z, Math.PI / 2, 0.8, 1.0); } Y0 = 0;
      // ---- trees: pines and autumn pines in the streets' corners and gardens, a forest on every hill, snowy pines up on the mountains
      for (const [x, z, h, aut] of [[-30, 22, 8, 0], [-31, 32, 9, 1], [-14, -24, 9, 0], [12, -24, 8, 1], [36, 18, 9, 0], [34, -14, 8, 1], [22, 32, 8, 1], [-30, -8, 7, 0], [6, 50, 7, 1], [-8, 76, 8, 0], [12, 74, 8, 1], [-34, 64, 9, 0], [38, 70, 9, 1], [52, 10, 9, 0], [54, 44, 8, 1], [72, 8, 9, 0], [52, -18, 8, 1], [-66, -14, 9, 1], [-64, 22, 8, 0], [-38, -16, 8, 1]]) aut ? autumnPine(x, z, h) : pine(x, z, h, pick(['#22402a', '#28482e', '#1e3a26']));
      Y0 = 3; for (const [x, z, h, aut] of [[-70, -44, 9, 1], [-60, -64, 8, 0], [-42, -84, 9, 1], [-34, -36, 7, 0], [36, -40, 7, 1], [74, -34, 8, 0], [-68, -30, 9, 0]]) aut ? autumnPine(x, z, h) : pine(x, z, h, '#22402a'); Y0 = 2.5; for (const [x, z] of [[-62, 30], [-38, 56], [-64, 44]]) autumnPine(x, z, 8); Y0 = 0;
      for (let i = 0; i < 160; i++) { const x = R(-70, 72), z = R(-26, 78); if (W.townE(x, z) > 0.93 || (x > RIVER.x0 - 4 && x < RIVER.x1 + 4) || Math.hypot(x, z) < 22 || Math.abs(x) < 7 || TERR.some(([x0, x1, z0, z1]) => x > x0 - 2 && x < x1 + 2 && z > z0 - 2 && z < z1 + 2)) continue;
        if (WD.collide(x, z, 2.4, 0)[0] !== x) continue; const g = grid.get(gk(Math.floor(x / CELL), Math.floor(z / CELL))); if (g && g.some(c => c.r ? Math.hypot(x - c.x, z - c.z) < c.r + 3 : Math.abs(x - c.x) < c.hw + 3 && Math.abs(z - c.z) < c.hd + 3)) continue;
        if (rnd() < 0.3) autumnPine(x, z, R(7, 11)); else pine(x, z, R(8, 13), pick(['#1e3a26', '#22402a', '#1a3422'])); }
      for (const [x, z] of [[-6, 38], [8, 38], [-20, 36], [24, 46], [-30, 48], [-24, -10], [-11, -23], [11, -23], [-40, 18], [16, 30]]) bush(x, z, R(0.9, 1.4));
      for (let i = 0; i < 60; i++) flowers(R(-60, 60), R(-20, 76));
      CK = 't'; for (let i = 0; i < 1300; i++) { const x = R(-188, 188), z = R(-188, 188), e = W.townE(x, z); if (e < 1.05 || e > 2.3) continue; const y = hubHeight(x, z); if (y > 66) continue;
        if ((x > RIVER.x0 - 3 && x < RIVER.x1 + 3 && z > RIVER.z0 - 4) || (x < -70 && x > -136 && z > -18 && z < 38)) continue;
        const h = R(8, 16) * (y > 30 ? 0.85 : 1); Y0 = y - 0.4; if (y > 36 && z < -100) pine(x, z, h, '#203a2c', true); else if (rnd() < 0.24) autumnPine(x, z, h); else pine(x, z, h, pick(['#22402a', '#264430', '#1e3a26', '#2c4a32'])); }
      Y0 = 0;
      for (let i = 0; i < 40; i++) { const x = R(-186, 186), z = R(-186, 186); if (W.townE(x, z) < 1.08 || (x < -66 && x > -140 && z > -22 && z < 42)) continue; Y0 = hubHeight(x, z) - 0.6; rock(x, z, R(1.4, 4), '#6a665e', false, '#3e5a32'); } Y0 = 0;
      CK = 'c';
      // ---- fields on the east bank (crop rows, haystacks) and an orchard of autumn trees south-west
      { const x0 = 52, x1 = 66, z0 = 38, z1 = 58; for (let i = 0; i < 9; i++) { const x = x0 + (i + 0.5) * (x1 - x0) / 9; P(BX, x, 0.18, (z0 + z1) / 2, 0, 0.9, 0.36, z1 - z0 - 1, i % 3 === 1 ? '#9a8240' : '#4e6a34', 'grass'); P(BX, x + 0.78, 0.03, (z0 + z1) / 2, 0, 0.66, 0.05, z1 - z0 - 1, '#7a5a38', 'dirt'); }
        fence(x0 - 1, z0 - 1, x1 + 1, z0 - 1); fence(x0 - 1, z0 - 1, x0 - 1, z1 + 1); fence(x0 - 1, z1 + 1, x1 + 1, z1 + 1);
        for (const [x, z] of [[68, 42], [69, 50]]) { P(CY12, x, 0.9, z, 0, 1.3, 1.8, 1.3, '#a88a4a', 'grass'); P(CO12, x, 2.3, z, 0, 1.35, 1.1, 1.35, '#9a7e44', 'grass'); circ(x, z, 1.3); } }
      for (const [x, z] of [[-40, 66], [-46, 62], [-40, 74], [-48, 70], [-34, 76]]) { if (W.townE(x, z) < 0.98) oak(x, z, 0.9, '#5a3a22', pick(AUTUMN)); }
      // ---- the edge of town: a post-and-rail fence and hedges where the streets meet the hills
      { const N = 150, pts = []; for (let i = 0; i <= N; i++) { const t = i / N * TAU, c = Math.cos(t), s = Math.sin(t); pts.push([W.TOWN.cx + Math.sign(c) * Math.sqrt(Math.abs(c)) * W.TOWN.rx * 1.005, W.TOWN.cz + Math.sign(s) * Math.sqrt(Math.abs(s)) * W.TOWN.rz * 1.005]); }
        const skip = (x, z) => TERR.some(([x0, x1, z0, z1]) => x > x0 - 2 && x < x1 + 2 && z > z0 - 2 && z < z1 + 2) || (Math.abs(x) < 10 && z > 60) || (x < -60 && Math.abs(z - W.WEST_GATE.z) < 12) || (x > RIVER.x0 - 4 && x < RIVER.x1 + 4);
        for (let i = 0; i < N; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1]; if (skip((x0 + x1) / 2, (z0 + z1) / 2)) continue; if (i % 5 === 2) bush((x0 + x1) / 2, (z0 + z1) / 2, 1.3); else fence(x0, z0, x1, z1); } }
      // ---- far peaks on the skyline (north), with snow caps
      for (const [x, z, h, r] of [[-120, -250, 120, 70], [-30, -280, 160, 80], [70, -260, 130, 70], [160, -220, 110, 60], [-200, -200, 100, 60], [230, -120, 90, 60], [-240, -60, 80, 60]]) {
        P(CO6, x, h / 2, z, rnd() * 3, r, h, r, '#5e6674', 'rock'); P(CO6, x, h * 0.84, z, rnd() * 3, r * 0.33, h * 0.33, r * 0.33, '#f2f6fa', 'white'); }
    }

    // ================================================================ DUNGEON THEMES
    // floor, walls, the stuff outside the walls, props along the walls, ambient particles and light for each look
    const TH = [
      { n: 'woods', floor: '#2a3020', ft: 'forest', wall: '#3a4434', wt: 'mossy', trim: '#2a3226', out: '#16241a', ot: 'grass', shaft: '#9ad8a8', look: { sky: { kind: 7, a: [0.06, 0.1, 0.08], moon: 0.06, moonCol: [0.82, 0.95, 0.86] }, grade: { expo: 1.14, sat: 1.06, con: 1.06, lift: [0.0, 0.016, 0.01], gain: [1.02, 1.02, 0.95], vig: 0.62, vigCol: [0, 0.05, 0.02], bloom: 0.65 }, rim: [0.32, 0.55, 0.38], mist: { col: [0.07, 0.13, 0.09], h: 1.3, k: 0.55 }, haze: 1.1, mat: {} }, amb: 'fireflies',
        light: { sunCol: [0.8, 1.02, 1.08], skyCol: [0.34, 0.52, 0.44], gndCol: [0.1, 0.17, 0.1], fog: [0.04, 0.085, 0.07], skyTop: [0.01, 0.025, 0.03], skyHor: [0.05, 0.12, 0.1], stars: true, sun: [-0.4, 0.66, -0.55] } },
      { n: 'crypt', floor: '#2c2a34', ft: 'cobble', wall: '#4a4654', wt: 'crypt', trim: '#2c2a34', out: '#1a1820', ot: 'dirt', shaft: '#9ab0ff', look: { sky: { kind: 0, a: [0.1, 0.1, 0.16], moon: 0.045, moonCol: [0.72, 0.78, 1.0] }, grade: { expo: 1.18, sat: 0.92, con: 1.08, lift: [0.0, 0.01, 0.035], gain: [1.03, 0.99, 1.02], vig: 0.68, vigCol: [0, 0, 0.04], bloom: 0.6 }, rim: [0.42, 0.48, 0.8], mist: { col: [0.09, 0.1, 0.16], h: 1.0, k: 0.6 }, haze: 1.1, mat: { cobble: { wet: 0.85, spec: 0.3 }, crypt: { wet: 0.25 } } }, amb: 'wisps',
        light: { sunCol: [0.72, 0.78, 1.18], skyCol: [0.36, 0.36, 0.58], gndCol: [0.12, 0.1, 0.16], fog: [0.07, 0.07, 0.12], skyTop: [0.015, 0.015, 0.045], skyHor: [0.1, 0.09, 0.17], stars: true, sun: [0.45, 0.6, -0.55] } },
      { n: 'frost', floor: '#5a7088', ft: 'ice', wall: '#7a98b8', wt: 'iceRock', trim: '#4a6888', out: '#b8c8d8', ot: 'sand', shaft: '#bfe8ff', look: { sky: { kind: 2, a: [0.2, 1.0, 0.6], b: [0.6, 0.3, 1.0], moon: 0.04, moonCol: [0.9, 0.95, 1.0] }, grade: { expo: 1.0, sat: 0.95, con: 1.05, lift: [0.0, 0.02, 0.05], gain: [0.96, 1.0, 1.06], vig: 0.5, bloom: 0.7 }, rim: [0.6, 0.8, 1.0], mist: { col: [0.45, 0.55, 0.7], h: 0.8, k: 0.35 }, haze: 1.0, mat: {} }, amb: 'snow',
        light: { sunCol: [0.8, 0.9, 1.15], skyCol: [0.45, 0.55, 0.75], gndCol: [0.3, 0.35, 0.45], fog: [0.1, 0.13, 0.2], skyTop: [0.02, 0.035, 0.09], skyHor: [0.14, 0.18, 0.3], stars: true, sun: [-0.3, 0.7, -0.6] } },
      { n: 'ember', floor: '#2a1a14', ft: 'basalt', wall: '#3a2620', wt: 'brick', trim: '#1e120e', out: '#140c0a', ot: 'rock', shaft: '#ff9a5a', look: { sky: { kind: 6, a: [0.12, 0.05, 0.04], b: [0.9, 0.3, 0.05], moon: 0.07, moonCol: [1.0, 0.35, 0.15] }, grade: { expo: 1.0, sat: 1.15, con: 1.08, lift: [0.03, 0.0, 0.0], gain: [1.06, 0.98, 0.9], vig: 0.62, vigCol: [0.06, 0.01, 0], bloom: 0.8 }, rim: [1.0, 0.45, 0.2], mist: { col: [0.14, 0.05, 0.03], h: 1.5, k: 0.35 }, haze: 1.0, mat: { basalt: { glow: [0.7, 0.2, 0.02] } } }, amb: 'embers',
        light: { sunCol: [1.15, 0.58, 0.34], skyCol: [0.48, 0.2, 0.14], gndCol: [0.34, 0.09, 0.03], fog: [0.13, 0.045, 0.025], skyTop: [0.04, 0.008, 0.008], skyHor: [0.24, 0.06, 0.02], stars: false, sun: [0.3, 0.55, -0.7] } },
      { n: 'storm', floor: '#262838', ft: 'slate', wall: '#3a3e58', wt: 'brick', trim: '#22243a', out: '#141624', ot: 'rock', shaft: '#a8b8ff', look: { sky: { kind: 1, a: [0.13, 0.14, 0.22], moon: 0 }, grade: { expo: 1.08, sat: 0.9, con: 1.1, lift: [0, 0.01, 0.04], gain: [0.98, 1.0, 1.05], vig: 0.62, bloom: 0.7 }, rim: [0.5, 0.6, 1.0], mist: { col: [0.09, 0.1, 0.16], h: 1.2, k: 0.45 }, haze: 1.1, mat: { slate: { wet: 0.6 } } }, amb: 'rain',
        light: { sunCol: [0.7, 0.76, 1.25], skyCol: [0.32, 0.35, 0.58], gndCol: [0.1, 0.1, 0.18], fog: [0.07, 0.075, 0.13], skyTop: [0.015, 0.015, 0.05], skyHor: [0.11, 0.11, 0.21], stars: false, sun: [-0.5, 0.6, -0.5] } },
      { n: 'void', floor: '#1c1030', ft: 'obsidian', wall: '#2e1a48', wt: 'rock', trim: '#140a22', out: '#0c0616', ot: 'tile', shaft: '#c89aff', look: { sky: { kind: 3, a: [0.6, 0.2, 1.0], b: [0.2, 0.4, 1.0], moon: 0.08, moonCol: [0.9, 0.7, 1.0] }, grade: { expo: 1.08, sat: 1.15, con: 1.06, lift: [0.02, 0, 0.045], gain: [1.02, 0.96, 1.06], vig: 0.66, vigCol: [0.03, 0, 0.06], bloom: 0.8 }, rim: [0.72, 0.42, 1.0], mist: { col: [0.11, 0.04, 0.18], h: 1.0, k: 0.5 }, haze: 1.1, mat: { obsidian: { glow: [0.55, 0.18, 1.0] } } }, amb: 'motes',
        light: { sunCol: [0.85, 0.58, 1.25], skyCol: [0.32, 0.18, 0.52], gndCol: [0.1, 0.04, 0.16], fog: [0.055, 0.02, 0.09], skyTop: [0.01, 0.0, 0.03], skyHor: [0.11, 0.03, 0.19], stars: true, sun: [0.4, 0.6, -0.6] } },
      { n: 'desert', floor: '#7a6040', ft: 'sand', wall: '#9a7a4a', wt: 'sandstone', trim: '#6a5030', out: '#5a4428', ot: 'sand', shaft: '#ffd8a0', look: { sky: { kind: 8, a: [0.25, 0.15, 0.12], moon: 0.09, moonCol: [1.0, 0.85, 0.62] }, grade: { expo: 1.05, sat: 1.08, con: 1.05, lift: [0.03, 0.015, 0.0], gain: [1.06, 1.0, 0.9], vig: 0.55, vigCol: [0.04, 0.02, 0], bloom: 0.6 }, rim: [1.0, 0.72, 0.42], mist: { col: [0.28, 0.2, 0.13], h: 0.8, k: 0.3 }, haze: 1.0, mat: {} }, amb: 'sand',
        light: { sunCol: [1.12, 0.8, 0.55], skyCol: [0.5, 0.36, 0.3], gndCol: [0.3, 0.2, 0.1], fog: [0.12, 0.08, 0.06], skyTop: [0.03, 0.015, 0.03], skyHor: [0.22, 0.12, 0.08], stars: true, sun: [0.5, 0.5, -0.5] } },
      { n: 'abyss', floor: '#24101a', ft: 'flesh', wall: '#34121f', wt: 'flesh', trim: '#160810', out: '#0a0408', ot: 'rock', shaft: '#ff6a7a', look: { sky: { kind: 5, a: [0.45, 0.03, 0.05], moon: 0.12, moonCol: [1.0, 0.16, 0.1] }, grade: { expo: 1.12, sat: 1.0, con: 1.1, lift: [0.025, 0, 0.012], gain: [1.03, 0.96, 0.98], vig: 0.75, vigCol: [0.06, 0, 0.01], bloom: 0.7 }, rim: [1.0, 0.3, 0.4], mist: { col: [0.12, 0.02, 0.04], h: 0.9, k: 0.42 }, haze: 1.1, mat: { flesh: { glow: [0.5, 0.03, 0.08], wet: 0.4 } } }, amb: 'blood',
        light: { sunCol: [0.95, 0.42, 0.55], skyCol: [0.36, 0.1, 0.18], gndCol: [0.14, 0.03, 0.06], fog: [0.06, 0.012, 0.03], skyTop: [0.012, 0.0, 0.006], skyHor: [0.12, 0.02, 0.05], stars: false, sun: [0.3, 0.6, -0.6] } },
      { n: 'glitch', floor: '#0a140e', ft: 'circuit', wall: '#0e2a1a', wt: 'circuit', trim: '#06140c', out: '#040a06', ot: 'tile', shaft: '#6affb0', look: { sky: { kind: 4, a: [0.1, 1.0, 0.5], b: [1.0, 0.1, 0.4], moon: 0 }, grade: { expo: 1.08, sat: 1.1, con: 1.1, lift: [0, 0.022, 0.01], gain: [0.95, 1.05, 1.0], vig: 0.62, bloom: 0.85 }, rim: [0.2, 1.0, 0.6], mist: { col: [0.0, 0.09, 0.05], h: 0.8, k: 0.4 }, haze: 1.1, mat: { circuit: { glow: [0.1, 1.0, 0.5] } } }, amb: 'glitch',
        light: { sunCol: [0.6, 1.15, 0.85], skyCol: [0.2, 0.45, 0.32], gndCol: [0.05, 0.18, 0.1], fog: [0.015, 0.07, 0.04], skyTop: [0.0, 0.02, 0.01], skyHor: [0.02, 0.12, 0.06], stars: true, sun: [0.3, 0.7, 0.5] } },
      // Update 6 worlds
      { n: 'drowned', floor: '#1e2e2e', ft: 'cobble', wall: '#3a4a48', wt: 'crypt', trim: '#1a2a28', out: '#0a1416', ot: 'dirt', shaft: '#7affe8', amb: 'rain', look: { sky: { kind: 1, a: [0.06, 0.13, 0.14], moon: 0.05, moonCol: [0.7, 1.0, 0.95] }, grade: { expo: 1.12, sat: 0.95, con: 1.08, lift: [0.0, 0.02, 0.025], gain: [0.96, 1.03, 1.02], vig: 0.66, vigCol: [0, 0.02, 0.03], bloom: 0.7 }, rim: [0.3, 0.7, 0.66], mist: { col: [0.05, 0.12, 0.12], h: 1.3, k: 0.7 }, haze: 1.2, mat: { cobble: { wet: 1.0, spec: 0.35 }, crypt: { wet: 0.55 } } },
        light: { sunCol: [0.66, 0.98, 1.0], skyCol: [0.22, 0.42, 0.42], gndCol: [0.06, 0.12, 0.12], fog: [0.035, 0.08, 0.08], skyTop: [0.008, 0.02, 0.025], skyHor: [0.05, 0.12, 0.12], stars: false, sun: [0.35, 0.62, -0.6] } },
      { n: 'clock', floor: '#2a2018', ft: 'metal', wall: '#4a3a28', wt: 'brick', trim: '#6a4a24', out: '#120c08', ot: 'rock', shaft: '#ffc84a', amb: 'motes', look: { sky: { kind: 6, a: [0.16, 0.1, 0.05], b: [1.0, 0.7, 0.25], moon: 0.06, moonCol: [1.0, 0.85, 0.5] }, grade: { expo: 1.1, sat: 1.1, con: 1.08, lift: [0.025, 0.014, 0.0], gain: [1.06, 1.0, 0.9], vig: 0.62, vigCol: [0.03, 0.015, 0], bloom: 0.7 }, rim: [0.8, 0.6, 0.3], mist: { col: [0.12, 0.08, 0.04], h: 0.9, k: 0.5 }, haze: 1.0, mat: { metal: { spec: 0.9, gloss: 0.8 }, brick: { spec: 0.15 } } },
        light: { sunCol: [1.15, 0.9, 0.6], skyCol: [0.45, 0.32, 0.2], gndCol: [0.18, 0.1, 0.05], fog: [0.09, 0.06, 0.035], skyTop: [0.02, 0.012, 0.008], skyHor: [0.16, 0.1, 0.05], stars: true, sun: [-0.4, 0.62, -0.55] } },
      { n: 'moon', floor: '#5a5e70', ft: 'iceRock', wall: '#6a6e84', wt: 'rock', trim: '#3a3e50', out: '#16182a', ot: 'rock', shaft: '#d8e4ff', amb: 'motes', look: { sky: { kind: 3, a: [0.3, 0.35, 0.8], b: [0.8, 0.85, 1.0], moon: 0.22, moonCol: [0.92, 0.95, 1.0] }, grade: { expo: 1.05, sat: 0.85, con: 1.1, lift: [0.01, 0.012, 0.035], gain: [0.98, 1.0, 1.06], vig: 0.6, vigCol: [0, 0, 0.04], bloom: 0.75 }, rim: [0.6, 0.66, 1.0], mist: { col: [0.12, 0.13, 0.2], h: 0.8, k: 0.45 }, haze: 0.9, mat: { iceRock: { sparkle: 0.5, spec: 0.3 } } },
        light: { sunCol: [0.9, 0.95, 1.2], skyCol: [0.32, 0.34, 0.5], gndCol: [0.14, 0.14, 0.2], fog: [0.06, 0.065, 0.11], skyTop: [0.004, 0.004, 0.015], skyHor: [0.08, 0.085, 0.16], stars: true, sun: [0.45, 0.7, -0.45] } }
    ];
    WD.TH = TH;
    WD.points = {}; // interaction points per zone key (hub, d0..d8, arena)
    // ---------------------------------------------------------------- Update 7 · the new look (reference photos 02-10)
    // brighter, more saturated light with a soft sky; a clean cel band (toon) and outlines make the chunky shapes read at a glance; night zones keep
    // their dark-fantasy mood but get warm, glowing windows and stronger moonlight. Each entry replaces that theme's light and look.
    const DAY = (top, hor, sun, cloud, shade) => ({ kind: 9, a: cloud, b: shade, moon: 0.045, moonCol: sun });
    const LOOK7 = {
      woods: { light: { sunCol: [1.3, 1.18, 0.9], skyCol: [0.5, 0.66, 0.68], gndCol: [0.22, 0.3, 0.14], fog: [0.42, 0.56, 0.5], skyTop: [0.16, 0.36, 0.62], skyHor: [0.72, 0.86, 0.82], stars: false, sun: [-0.4, 0.72, -0.5] },
        look: { sky: DAY(0, 0, [1.0, 0.95, 0.8], [0.98, 0.98, 0.94], [0.55, 0.64, 0.72]), grade: { expo: 1.12, sat: 1.28, con: 1.06, lift: [0.0, 0.02, 0.01], gain: [1.0, 1.04, 0.94], vig: 0.32, vigCol: [0, 0.02, 0.01], bloom: 0.5 }, rim: [0.75, 0.95, 0.65], mist: { col: [0.5, 0.66, 0.55], h: 1.4, k: 0.25 }, haze: 0.8, toon: 0.5, mat: {} } },
      desert: { light: { sunCol: [1.55, 1.3, 0.98], skyCol: [0.62, 0.62, 0.7], gndCol: [0.5, 0.36, 0.2], fog: [0.78, 0.7, 0.58], skyTop: [0.14, 0.38, 0.75], skyHor: [0.92, 0.84, 0.7], stars: false, sun: [0.45, 0.78, -0.42] },
        look: { sky: DAY(0, 0, [1.0, 0.94, 0.78], [1.0, 0.97, 0.9], [0.66, 0.7, 0.8]), grade: { expo: 1.08, sat: 1.22, con: 1.08, lift: [0.02, 0.012, 0.0], gain: [1.05, 1.0, 0.92], vig: 0.3, vigCol: [0.04, 0.02, 0], bloom: 0.45 }, rim: [1.0, 0.85, 0.6], mist: { col: [0.8, 0.7, 0.55], h: 0.8, k: 0.2 }, haze: 0.7, toon: 0.55, mat: {} } },
      crypt: { light: { sunCol: [0.75, 0.85, 1.25], skyCol: [0.34, 0.4, 0.66], gndCol: [0.16, 0.14, 0.2], fog: [0.1, 0.12, 0.22], skyTop: [0.03, 0.05, 0.14], skyHor: [0.16, 0.18, 0.34], stars: true, sun: [-0.45, 0.62, -0.6] },
        look: { sky: { kind: 0, a: [0.2, 0.22, 0.36], moon: 0.06, moonCol: [0.9, 0.95, 1.0] }, grade: { expo: 1.22, sat: 1.16, con: 1.06, lift: [0.0, 0.012, 0.04], gain: [1.04, 1.0, 1.0], vig: 0.45, vigCol: [0, 0, 0.04], bloom: 0.7 }, rim: [0.55, 0.65, 1.0], mist: { col: [0.12, 0.14, 0.26], h: 1.2, k: 0.35 }, haze: 0.9, toon: 0.4, mat: { cobble: { wet: 0.5, spec: 0.3 } } } },
      frost: { light: { sunCol: [1.2, 1.18, 1.28], skyCol: [0.6, 0.7, 0.92], gndCol: [0.4, 0.44, 0.52], fog: [0.62, 0.7, 0.84], skyTop: [0.2, 0.34, 0.62], skyHor: [0.78, 0.84, 0.95], stars: false, sun: [0.4, 0.5, -0.6] },
        look: { sky: DAY(0, 0, [0.95, 0.97, 1.0], [0.92, 0.95, 1.0], [0.55, 0.62, 0.78]), grade: { expo: 1.05, sat: 1.12, con: 1.06, lift: [0.0, 0.02, 0.05], gain: [0.96, 1.0, 1.06], vig: 0.32, vigCol: [0, 0.01, 0.04], bloom: 0.55 }, rim: [0.7, 0.85, 1.0], mist: { col: [0.7, 0.78, 0.9], h: 1.3, k: 0.3 }, haze: 0.9, toon: 0.5, mat: { ice: { sparkle: 0.7, spec: 0.5 } } } },
      ember: { light: { sunCol: [1.3, 0.86, 0.6], skyCol: [0.5, 0.34, 0.32], gndCol: [0.4, 0.14, 0.06], fog: [0.2, 0.08, 0.06], skyTop: [0.06, 0.02, 0.03], skyHor: [0.42, 0.13, 0.06], stars: false, sun: [0.3, 0.55, -0.7] },
        look: { sky: { kind: 6, a: [0.22, 0.08, 0.06], b: [1.0, 0.42, 0.1], moon: 0.07, moonCol: [1.0, 0.45, 0.15] }, grade: { expo: 1.1, sat: 1.12, con: 1.1, lift: [0.02, 0.0, 0.0], gain: [1.04, 0.98, 0.94], vig: 0.45, vigCol: [0.06, 0.01, 0], bloom: 0.8 }, rim: [1.0, 0.55, 0.25], mist: { col: [0.24, 0.08, 0.04], h: 1.5, k: 0.3 }, haze: 0.9, toon: 0.45, mat: { basalt: { glow: [0.9, 0.3, 0.04] } } } },
      storm: { light: { sunCol: [0.95, 1.0, 1.4], skyCol: [0.42, 0.46, 0.72], gndCol: [0.16, 0.16, 0.26], fog: [0.16, 0.18, 0.28], skyTop: [0.04, 0.05, 0.12], skyHor: [0.22, 0.24, 0.4], stars: false, sun: [-0.5, 0.6, -0.5] },
        look: { sky: { kind: 1, a: [0.22, 0.24, 0.38], moon: 0 }, grade: { expo: 1.18, sat: 1.12, con: 1.08, lift: [0, 0.01, 0.04], gain: [0.98, 1.0, 1.05], vig: 0.45, bloom: 0.7 }, rim: [0.6, 0.7, 1.0], mist: { col: [0.16, 0.18, 0.28], h: 1.2, k: 0.35 }, haze: 1.0, toon: 0.45, mat: { slate: { wet: 0.6 } } } },
      void: { light: { sunCol: [1.3, 0.8, 1.15], skyCol: [0.46, 0.3, 0.62], gndCol: [0.2, 0.08, 0.24], fog: [0.14, 0.06, 0.2], skyTop: [0.05, 0.02, 0.1], skyHor: [0.62, 0.26, 0.36], stars: true, sun: [0.4, 0.4, -0.6] },
        look: { sky: { kind: 10, a: [1.0, 0.62, 0.5], b: [0.3, 0.18, 0.42], moon: 0.05, moonCol: [1.0, 0.6, 0.4] }, grade: { expo: 1.14, sat: 1.24, con: 1.06, lift: [0.02, 0, 0.04], gain: [1.04, 0.97, 1.04], vig: 0.45, vigCol: [0.03, 0, 0.06], bloom: 0.75 }, rim: [0.85, 0.55, 1.0], mist: { col: [0.2, 0.1, 0.26], h: 1.0, k: 0.35 }, haze: 0.9, toon: 0.45, mat: { obsidian: { glow: [0.7, 0.25, 1.0] } } } },
      abyss: { light: { sunCol: [1.2, 0.6, 0.72], skyCol: [0.5, 0.18, 0.28], gndCol: [0.24, 0.06, 0.1], fog: [0.14, 0.03, 0.07], skyTop: [0.03, 0.0, 0.02], skyHor: [0.26, 0.05, 0.1], stars: false, sun: [0.3, 0.6, -0.6] },
        look: { sky: { kind: 5, a: [0.6, 0.06, 0.08], moon: 0.12, moonCol: [1.0, 0.25, 0.15] }, grade: { expo: 1.2, sat: 1.18, con: 1.08, lift: [0.025, 0, 0.012], gain: [1.03, 0.96, 0.98], vig: 0.5, vigCol: [0.06, 0, 0.01], bloom: 0.75 }, rim: [1.0, 0.4, 0.5], mist: { col: [0.2, 0.04, 0.08], h: 0.9, k: 0.35 }, haze: 1.0, toon: 0.4, mat: { flesh: { glow: [0.7, 0.05, 0.12], wet: 0.4 } } } },
      glitch: { light: { sunCol: [0.8, 1.35, 1.05], skyCol: [0.28, 0.6, 0.45], gndCol: [0.08, 0.26, 0.15], fog: [0.03, 0.12, 0.08], skyTop: [0.0, 0.03, 0.02], skyHor: [0.04, 0.2, 0.12], stars: true, sun: [0.3, 0.7, 0.5] },
        look: { sky: { kind: 4, a: [0.15, 1.0, 0.6], b: [1.0, 0.2, 0.5], moon: 0 }, grade: { expo: 1.16, sat: 1.22, con: 1.08, lift: [0, 0.022, 0.01], gain: [0.95, 1.05, 1.0], vig: 0.45, bloom: 0.9 }, rim: [0.3, 1.0, 0.7], mist: { col: [0.02, 0.14, 0.08], h: 0.8, k: 0.35 }, haze: 1.0, toon: 0.5, mat: { circuit: { glow: [0.15, 1.0, 0.6] } } } },
      drowned: { light: { sunCol: [0.85, 1.25, 1.35], skyCol: [0.3, 0.62, 0.7], gndCol: [0.1, 0.24, 0.26], fog: [0.06, 0.2, 0.24], skyTop: [0.02, 0.08, 0.14], skyHor: [0.12, 0.36, 0.42], stars: false, sun: [0.35, 0.62, -0.6] },
        look: { sky: { kind: 3, a: [0.2, 0.8, 0.9], b: [0.3, 0.5, 1.0], moon: 0.05, moonCol: [0.7, 1.0, 0.95] }, grade: { expo: 1.2, sat: 1.26, con: 1.06, lift: [0.0, 0.03, 0.04], gain: [0.94, 1.04, 1.06], vig: 0.42, vigCol: [0, 0.02, 0.04], bloom: 0.85 }, rim: [0.4, 0.95, 1.0], mist: { col: [0.08, 0.24, 0.28], h: 1.3, k: 0.45 }, haze: 1.0, toon: 0.4, mat: { cobble: { wet: 1.0, spec: 0.4 }, crypt: { wet: 0.55 } } } },
      clock: { light: { sunCol: [1.5, 1.25, 0.85], skyCol: [0.62, 0.6, 0.66], gndCol: [0.32, 0.22, 0.12], fog: [0.75, 0.68, 0.6], skyTop: [0.2, 0.42, 0.78], skyHor: [1.0, 0.86, 0.62], stars: false, sun: [-0.4, 0.62, -0.55] },
        look: { sky: DAY(0, 0, [1.0, 0.9, 0.65], [1.0, 0.95, 0.85], [0.68, 0.66, 0.74]), grade: { expo: 1.08, sat: 1.2, con: 1.08, lift: [0.025, 0.014, 0.0], gain: [1.06, 1.0, 0.92], vig: 0.3, vigCol: [0.03, 0.015, 0], bloom: 0.6 }, rim: [1.0, 0.8, 0.45], mist: { col: [0.8, 0.72, 0.6], h: 0.9, k: 0.25 }, haze: 0.8, toon: 0.55, mat: { metal: { spec: 0.9, gloss: 0.8 }, brick: { spec: 0.15 } } } },
      moon: { light: { sunCol: [1.1, 1.12, 1.4], skyCol: [0.4, 0.42, 0.62], gndCol: [0.2, 0.2, 0.28], fog: [0.1, 0.1, 0.18], skyTop: [0.008, 0.008, 0.03], skyHor: [0.14, 0.14, 0.26], stars: true, sun: [0.45, 0.7, -0.45] },
        look: { sky: { kind: 3, a: [0.4, 0.45, 1.0], b: [0.9, 0.5, 1.0], moon: 0.22, moonCol: [0.95, 0.97, 1.0] }, grade: { expo: 1.14, sat: 1.12, con: 1.1, lift: [0.01, 0.012, 0.035], gain: [0.98, 1.0, 1.06], vig: 0.45, vigCol: [0, 0, 0.04], bloom: 0.8 }, rim: [0.7, 0.75, 1.0], mist: { col: [0.16, 0.16, 0.26], h: 0.8, k: 0.35 }, haze: 0.9, toon: 0.45, mat: { iceRock: { sparkle: 0.5, spec: 0.3 } } } }
    };
    for (const th of TH) { const L7 = LOOK7[th.n]; if (L7) { th.light = L7.light; th.look = L7.look; } }
    const thOf = i => TH[C.DUNGEONS[i].theme] || TH[0];
    WD.thOf = thOf;
    const WALL_H = 3.6, WALL_T = 1.2;
    WD.gates = [];   // per dungeon: [{x, z, w, k (hall index)}] — closed until room k is cleared
    WD.gateOpen = null; // set by the game: (dungeon, hall) => true when that gate is open
    // a wall from (x0,z0) to (x1,z1) (axis aligned) with the dungeon's look; solid up to WALL_H
    function dwall(th, x0, z0, x1, z1) {
      const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.05) return; const x = (x0 + x1) / 2, z = (z0 + z1) / 2, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const yaw = alongX ? 0 : Math.PI / 2;
      P(BX, x, WALL_H / 2, z, yaw, len, WALL_H, WALL_T, th.wall, th.wt);
      P(BX, x, WALL_H + 0.18, z, yaw, len + 0.1, 0.36, WALL_T + 0.3, th.trim, 'rock');
      P(BX, x, 0.3, z, yaw, len + 0.05, 0.6, WALL_T + 0.25, th.trim, 'rock');
      rect(x, z, alongX ? len : WALL_T, alongX ? WALL_T : len, 0, WALL_H + 0.4);
      const hw = alongX ? len / 2 : WALL_T / 2 + 0.12, hd = alongX ? WALL_T / 2 + 0.12 : len / 2; aoBox(x, z, hw, hd, 1.5);
    }
    // a side of a room with openings (list of [centre, width]) cut out of it
    function side(th, fixed, a0, a1, horiz, holes) {
      let cur = a0; holes = holes.slice().sort((p, q) => p[0] - q[0]);
      for (const [c, w] of holes) { const h0 = c - w / 2, h1 = c + w / 2; if (h0 > cur) horiz ? dwall(th, cur, fixed, h0, fixed) : dwall(th, fixed, cur, fixed, h0); cur = Math.max(cur, h1); }
      if (a1 > cur) horiz ? dwall(th, cur, fixed, a1, fixed) : dwall(th, fixed, cur, fixed, a1);
    }
    function pillar(th, x, z, h, r) { P(BX, x, h / 2, z, 0, r * 2, h, r * 2, th.wall, th.wt); P(BX, x, h + 0.25, z, 0, r * 2 + 0.4, 0.5, r * 2 + 0.4, th.trim, 'rock'); P(BX, x, 0.25, z, 0, r * 2 + 0.4, 0.5, r * 2 + 0.4, th.trim, 'rock'); rect(x, z, r * 2, r * 2, 0, h + 0.5); aoBox(x, z, r + 0.2, r + 0.2, 1.2); }

    // ---------------------------------------------------------------- props that sit along room walls (one kit per theme)
    function wallProp(th, D, x, z, yaw, big) {
      switch (th.n) {
        case 'woods': if (rnd() < 0.5) { const s = R(0.3, 0.6); P(CY6, x, s * 0.5, z, 0, s * 0.18, s, s * 0.18, '#c8c0a8'); D.push({ k: 'shroom', x, y: s, z, s, col: pick(['#3affc8', '#7aff5a', '#3ab8ff']) }); }
          else { P(CY8, x, 0.6, z, R(0, 3), 0.55, 1.2, 0.55, '#3a2a1a', 'bark'); for (let k = 0; k < 3; k++) P(pick(ICOS), x + R(-0.6, 0.6), 1.2 + rnd() * 0.3, z + R(-0.6, 0.6), rnd() * 6, R(0.4, 0.7), R(0.3, 0.5), R(0.4, 0.7), pick(['#163018', '#1c3a1c'])); circ(x, z, 0.6, 1.6, 1.2); } break;
        case 'crypt': if (rnd() < 0.5) { P(BX, x, 0.7, z, yaw, 0.8, 1.4, 0.22, '#5a5866', 'rock', R(-0.1, 0.1), R(-0.08, 0.08)); P(CY12, x, 1.4, z, yaw, 0.4, 0.22, 0.4, '#5a5866', 'rock', Math.PI / 2, 0); circ(x, z, 0.45, 1.7); if (rnd() < 0.5) D.push({ k: 'candle', x: x + 0.5, y: 0.25, z: z + 0.3 }); }
          else { P(BX, x, 0.35, z, yaw, 2.1, 0.7, 0.9, '#2a1c16', 'wood'); P(BX, x, 0.72, z, yaw, 2.15, 0.06, 0.95, '#141014'); rect(x, z, yaw ? 0.9 : 2.1, yaw ? 2.1 : 0.9, 0, 0.75, 0.75); } break;
        case 'frost': { const h = R(1.5, 3.5); P(CO6, x, h / 2, z, rnd() * 3, R(0.4, 0.8), h, R(0.4, 0.8), '#8ad0ff'); D.push({ k: 'crystal', x, y: h * 0.4, z, col: '#7ad8ff' }); circ(x, z, 0.6, h); break; }
        case 'ember': if (rnd() < 0.5) { P(CY8, x, 0.5, z, 0, 0.32, 1, 0.32, '#2a1a14', 'rock'); P(CY8, x, 1.12, z, 0, 0.55, 0.28, 0.55, '#1c1210'); torch(D, x, 1.4, z, '#ff6a1a', 1.4); circ(x, z, 0.55, 1.3); }
          else { P(BX, x, 0.35, z, 0.3, 0.7, 0.7, 0.5, '#1c1a20'); P(BX, x, 0.86, z, 0.3, 1.3, 0.32, 0.55, '#2c2a32', 'metal'); circ(x, z, 0.7, 1.0); } break;
        case 'storm': { const h = R(2.5, 4.2); P(CY6, x, h / 2, z, 0, 0.18, h, 0.18, '#5a5e70', 'metal'); P(CY6, x, h + 0.5, z, 0, 0.05, 1, 0.05, '#8a8ea0', 'metal'); D.push({ k: 'rod', x, y: h + 1, z }); circ(x, z, 0.3, h + 1); break; }
        case 'void': { const h = R(2, 4); P(BX, x, h / 2, z, rnd() * 3, 0.8, h, 0.8, '#120a1c', 'rock'); P(CO4, x, h + 0.6, z, 0.78, 0.6, 1.2, 0.6, '#120a1c'); D.push({ k: 'rune', x, y: h * 0.55, z, col: '#c87aff' }); circ(x, z, 0.6, h + 1.2); break; }
        case 'desert': if (rnd() < 0.5) { P(CY12, x, 0.55, z, 0, 0.42, 1.1, 0.42, '#8a5a30', 'rock'); P(CY12, x, 1.15, z, 0, 0.28, 0.12, 0.28, '#6a4020'); circ(x, z, 0.45, 1.1, 1.1); }
          else { const h = R(2, 3.5); P(CY12, x, h / 2, z, 0, 0.5, h, 0.5, '#a88a5a', 'brick'); P(BX, x, h + 0.2, z, 0, 1.3, 0.4, 1.3, '#7a5a30', 'rock'); circ(x, z, 0.55, h + 0.4); } break;
        case 'abyss': { const h = R(2, 4.5); for (let k = 0; k < 4; k++) P(CY8, x + Math.sin(k * 1.7) * 0.15, h * (0.15 + k * 0.22), z + Math.cos(k * 1.7) * 0.15, k, 0.3 - k * 0.05, h * 0.3, 0.3 - k * 0.05, '#3a0a1e', 'rock', Math.sin(k) * 0.3, Math.cos(k) * 0.3);
          if (rnd() < 0.5) D.push({ k: 'eyeW', x, y: h * 0.5, z, s: R(0.25, 0.45), ph: rnd() * 6 }); circ(x, z, 0.45, h); break; }
        case 'glitch': D.push({ k: 'crystalF', x, y: R(1.5, 4), z, s: R(0.5, 1.1), ph: rnd() * 6, col: pick(['#1aff8a', '#ff2a6a', '#0a0a0a']) }); break;
      }
    }
    // ---------------------------------------------------------------- the world outside the walls (each theme)
    function outside(th, D, i, x, z) {
      const off = m => W.where(i, x, z, -m) < 0; if (!off(4)) return; const far = off(11);
      switch (th.n) {
        case 'woods': if (!far) { rock(x, z, R(0.8, 1.6), '#5a6458', false, '#4a8a3a'); break; } if (rnd() < 0.6) oak(x, z, R(1.4, 2.2), '#1e140e', pick(['#0e2212', '#132a16'])); else pine(x, z, R(9, 14), pick(['#0f2318', '#132b1d'])); break;
        case 'crypt': if (rnd() < 0.4) deadTree(x, z, R(1.2, 1.8), '#1a1618'); else { const a = rnd() * TAU; P(BX, x, 0.8, z, a, 0.9, 1.6, 0.25, '#4a4856', 'rock', R(-0.15, 0.15)); } break;
        case 'frost': if (far && rnd() < 0.6) pine(x, z, R(9, 15), pick(['#1a3434', '#20403c']), true); else rock(x, z, R(1.2, far ? 3 : 1.8), '#c8d4e4', false); break;
        case 'ember': if (rnd() < 0.3 || !far) { const r = R(3, 6); P(CY20, x, 0.03, z, 0, r + 0.6, 0.06, r + 0.6, '#2a1008'); D.push({ k: 'lava', x, z, r }); }
          else { const h = R(3, 9); P(CO6, x, h / 2, z, rnd() * 3, R(0.8, 1.8), h, R(0.8, 1.8), '#1a1010', 'rock', R(-0.15, 0.15), R(-0.15, 0.15)); } break;
        case 'storm': if (far && rnd() < 0.5) { const h = R(8, 20); P(CO6, x, h / 2, z, rnd() * 3, R(1.2, 2.4), h, R(1.2, 2.4), '#2a2c40', 'rock'); } else D.push({ k: 'float', x, y: R(6, 14), z, s: R(1, 2.8), ph: rnd() * 6 }); break;
        case 'void': if (far && rnd() < 0.5) { const h = R(6, 14); P(BX, x, h / 2, z, rnd() * 3, 1.4, h, 1.4, '#120a1c', 'rock'); P(CO4, x, h + 1, z, 0.78, 1.1, 2, 1.1, '#120a1c'); }
          else D.push({ k: 'crystalF', x, y: R(3, 10), z, s: R(0.6, 1.5), ph: rnd() * 6, col: pick(['#c87aff', '#ff4aff', '#7a5aff']) }); break;
        case 'desert': if (rnd() < 0.55) P(pick(ICO), x, -0.4, z, rnd() * 6, R(5, 10), R(1.5, 3.5), R(5, 10), '#6a5030', 'sand');
          else if (rnd() < 0.5) { const h = R(3, 8); P(CY12, x, h / 2, z, 0, 0.7, h, 0.7, '#a88a5a', 'brick', R(-0.1, 0.1), R(-0.1, 0.1)); }
          else if (far) { const h = R(7, 12); P(BX, x, h / 2, z, rnd() * 3, 1.3, h, 1.3, '#8a6a3a', 'brick'); P(CO4, x, h + 0.8, z, 0.78, 1, 1.6, 1, '#c8a040'); } break;
        case 'abyss': if (far && rnd() < 0.6) { const h = R(6, 14); let px = x, pz = z; for (let k = 0; k < 6; k++) { const w = 0.9 - k * 0.13; P(CY8, px, h * k / 6 + h / 12, pz, k, w, h / 5.5, w, k % 2 ? '#3a0a1e' : '#2a0614', 'rock', Math.sin(k + x) * 0.35, Math.cos(k + z) * 0.35); px += Math.sin(k + x) * 0.4; pz += Math.cos(k + z) * 0.4; } }
          else D.push({ k: 'eyeW', x, y: R(2, 7), z, s: R(0.6, 1.4), ph: rnd() * 6 }); break;
        case 'glitch': { const s = R(1, far ? 4 : 2); P(BX, x, s / 2 + R(0, far ? 6 : 1), z, rnd() * 3, s, s, s, pick(['#0a2a18', '#1aff8a', '#062010', '#0a3a20']), 'tile'); break; }
      }
    }
    // ---------------------------------------------------------------- room decorations: braziers framing the doors, banners, floor detail for each look
    const BAN_TH = { woods: () => BAN_GREEN, crypt: () => BAN_BLUE, frost: () => BAN_BLUE, ember: () => BAN_RED, storm: () => BAN_BLUE, void: () => BAN_PURP, desert: () => BAN_RED, abyss: () => BAN_BLACK, glitch: () => BAN_GREEN };
    function brazier(th, D, x, z, col) { P(CY8, x, 0.55, z, 0, 0.18, 1.1, 0.18, '#1a161a', 'metal'); P(CY12, x, 1.15, z, 0, 0.62, 0.32, 0.62, '#2a2428', 'metal'); P(CY12, x, 0.05, z, 0, 0.5, 0.1, 0.5, th.trim, 'rock');
      torch(D, x, 1.45, z, col, 1.3); circ(x, z, 0.6, 1.4); }
    const fireOf = (th, d) => th.n === 'void' || th.n === 'glitch' || th.n === 'storm' || th.n === 'drowned' || th.n === 'moon' ? d.col : th.n === 'abyss' ? '#c8283a' : th.n === 'frost' ? '#7ad8ff' : th.n === 'clock' ? '#ffb84a' : '#ff7a1a';
    // the walls of a room as segments: each {x0,z0,x1,z1, nx,nz (inward normal)}, with doorways cut out (round rooms: arc pieces)
    function roomSides(q, lay) {
      const holes = { N: [], S: [], E: [], W: [] }, opp = { N: 'S', S: 'N', E: 'W', W: 'E' }, doorAng = [];
      for (const h of lay.halls) { if (h.a === q.i) { holes[h.dir].push([h.dir === 'N' || h.dir === 'S' ? h.pa.x : h.pa.z, h.hw]); doorAng.push(Math.atan2(h.pa.x - q.x, h.pa.z - q.z)); }
        if (h.b === q.i) { holes[opp[h.dir]].push([h.dir === 'N' || h.dir === 'S' ? h.pb.x : h.pb.z, h.hw]); doorAng.push(Math.atan2(h.pb.x - q.x, h.pb.z - q.z)); } }
      return { holes, doorAng };
    }
    // a stone doorframe: two posts and a lintel across an opening (ax = the axis the hall runs along)
    function doorFrame(th, x, z, ax, w) { const yaw = ax === 'z' ? 0 : Math.PI / 2, c = Math.cos(yaw), sn = Math.sin(yaw);
      for (const sd of [-1, 1]) { const px = x + c * sd * (w / 2 + 0.45), pz = z - sn * sd * (w / 2 + 0.45); P(BX, px, (WALL_H + 1.4) / 2, pz, yaw, 1.1, WALL_H + 1.4, WALL_T + 0.5, th.trim, 'rock'); }
      P(BX, x, WALL_H + 1.0, z, yaw, w + 2, 0.8, WALL_T + 0.6, th.trim, 'rock'); P(BX, x, WALL_H + 1.55, z, yaw, w + 1.2, 0.3, WALL_T + 0.2, mix(th.trim, '#000000', 0.3), 'rock'); }
    // the solid things inside rooms, in each dungeon's look
    function obstacle(th, D, o, d) {
      const x = o.x, z = o.z, r = o.r, k = o.k;
      if (k === 'trees') { if (th.n === 'woods') oak(x, z, R(1.1, 1.5), '#1e140e', pick(['#0e2212', '#132a16'])); else deadTree(x, z, R(1.1, 1.5), mix(th.wall, '#000000', 0.4)); circ(x, z, r, 6); return; }
      if (k === 'stones') { const h = R(2.6, 4.2); P(BX, x, h / 2, z, rnd() * 3, r * 1.3, h, r * 0.9, mix(th.wall, '#000000', 0.25), 'rock', R(-0.08, 0.08), R(-0.08, 0.08)); P(pick(ICO), x + 0.6, 0.3, z - 0.4, rnd() * 6, 0.7, 0.45, 0.6, th.trim, 'rock');
        if (th.n === 'frost') P(BX, x, h + 0.05, z, 0, r * 1.25, 0.18, r * 0.85, '#d8e4f0'); circ(x, z, r, h); return; }
      if (k === 'tombs') { P(BX, x, 0.55, z, 0, 1.3, 1.1, 2.3, mix(th.wall, '#000000', 0.2), 'rock'); P(BX, x, 1.18, z, 0, 1.45, 0.18, 2.45, th.trim, 'rock'); P(BX, x, 1.35, z + 0.2, 0, 0.5, 0.16, 1.1, mix(th.wall, '#ffffff', 0.08), 'rock');
        if (rnd() < 0.4) D.push({ k: 'candle', x: x + 0.45, y: 1.27, z: z - 0.9 }); circ(x, z, r, 1.3, 1.3); return; }
      if (k === 'cubes') { for (let j = 0; j < 3; j++) { const s2 = 1.6 - j * 0.45; P(BX, x + R(-0.2, 0.2), s2 / 2 + j * 1.3, z + R(-0.2, 0.2), rnd() * 3, s2, s2, s2, pick(['#0a2a18', '#06140c', '#0e3a20']), 'tile'); }
        D.push({ k: 'crystalF', x, y: 4.6, z, s: 0.5, ph: rnd() * 6, col: pick(['#1aff8a', '#ff2a6a']) }); circ(x, z, r, 4); return; }
      // pillars: a column in the dungeon's look
      const h = WALL_H + 2.6;
      switch (th.n) {
        case 'frost': P(CO6, x, h / 2, z, rnd() * 3, r * 1.1, h, r * 1.1, '#9ad0f0'); P(CY6, x, 0.4, z, 0, r * 1.3, 0.8, r * 1.3, '#5a7a98', 'rock'); D.push({ k: 'crystal', x, y: 1.6, z, col: '#7ad8ff' }); break;
        case 'storm': P(CY12, x, h / 2, z, 0, r * 0.75, h, r * 0.75, '#2c2e42', 'metal'); for (let j = 0; j < 4; j++) P(CY12, x, 1 + j * 1.3, z, 0, r * 0.95, 0.18, r * 0.95, '#4a5a8a', 'metal'); D.push({ k: 'rod', x, y: h + 0.4, z }); break;
        case 'void': P(BX, x, h / 2, z, 0.785, r * 1.5, h, r * 1.5, '#140a22', 'rock'); P(CO4, x, h + 0.8, z, 0.785, r * 1.1, 1.6, r * 1.1, '#140a22'); D.push({ k: 'rune', x, y: h * 0.55, z, col: '#c87aff' }); break;
        case 'ember': P(BX, x, h / 2, z, 0, r * 1.7, h, r * 1.7, '#241612', 'brick'); P(BX, x, 0.4, z, 0, r * 2.1, 0.8, r * 2.1, '#160e0c', 'rock'); P(BX, x, h - 0.2, z, 0, r * 2.1, 0.5, r * 2.1, '#160e0c', 'rock');
          for (let j = 0; j < 3; j++) P(BX, x + r * 0.86, 1.2 + j * 1.1, z, 0, 0.04, 0.6, 0.5, '#ff5a1a'); break;
        default: P(BX, x, 0.35, z, 0, r * 2.2, 0.7, r * 2.2, th.trim, 'rock'); P(CY12, x, h / 2, z, 0, r * 0.85, h, r * 0.85, th.wall, th.wt); P(BX, x, h - 0.3, z, 0, r * 2.1, 0.6, r * 2.1, th.trim, 'rock');
          if (rnd() < 0.5) P(pick(ICO), x + r * 1.3, 0.25, z + R(-0.6, 0.6), rnd() * 6, 0.5, 0.35, 0.45, th.trim, 'rock');
      }
      circ(x, z, r + 0.05, h);
    }
    // a mature, lived-in look: buttresses on the walls, chains, rubble, bones, cracked slabs
    function wallDetail(th, D, x, z, nx, nz, i) {
      const yaw = Math.atan2(nx, nz); P(BX, x + nx * 0.3, WALL_H / 2 + 0.2, z + nz * 0.3, yaw, 0.9, WALL_H + 0.4, 0.6, mix(th.wall, '#000000', 0.18), th.wt);
      P(BX, x + nx * 0.5, 0.3, z + nz * 0.5, yaw, 1.2, 0.6, 1.0, th.trim, 'rock');
      if (rnd() < 0.3) D.push({ k: 'chainH', x: x + nx * 0.8, y: WALL_H - 0.2, z: z + nz * 0.8, n: 5, ph: rnd() * 6, small: 1 });
    }
    function rubble(th, x, z) { for (let j = 0; j < 4; j++) P(pick(ICO), x + R(-0.8, 0.8), R(0.05, 0.2), z + R(-0.8, 0.8), rnd() * 6, R(0.25, 0.55), R(0.15, 0.35), R(0.25, 0.5), mix(th.trim, '#000000', R(0, 0.3)), 'rock'); }
    function bones(x, z) { for (let b = 0; b < 6; b++) P(CY6, x + R(-0.5, 0.5), 0.06, z + R(-0.5, 0.5), rnd() * 6, 0.06, R(0.5, 0.9), 0.06, '#b8b0a0', null, Math.PI / 2, 0); P(SPH, x, 0.18, z, 0, 0.22, 0.2, 0.24, '#c8c0a8'); }
    // ================================================================ A DUNGEON (built from its own plan in W.layout)
    // ---------------------------------------------------------------- Update 7 · full maps: bridges, streets, cliffs, floating islands, landmarks
    // holes: where the ground falls away (round a bridge, beyond a cliff edge); on the floating maps there is no ground at all (null)
    const FLOAT = { storm: 'sky', abyss: 'void' };
    const DROP = { water: 3.2, lava: 4, chasm: 28, sky: 0, void: 0 };
    const LIQ = { water: '#2e7a9a', lava: '#ff5a1a' };
    function mapHoles(lay, th) {
      if (FLOAT[th.n]) return null;
      // Update 7 (final): the pits come from W.pits (shared with the tests): cut back so none runs under a room, a hall, a street or the landmark
      return W.pits(lay.i).map(p => { if (p.k === 'bridge') lay.halls[p.hall].hole = p.r; else lay.rooms[p.room].hole = p.r; return p.r; });
    }
    // the walls of a pit: all four sides go down to its floor (so you never see under the ground)
    function pitWalls(r, depth, col) { const [x0, x1, z0, z1] = r, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wx = x1 - x0, wz = z1 - z0;
      P(BX, cx, -depth / 2, z0 + 0.3, 0, wx, depth, 0.6, col, 'rock'); P(BX, cx, -depth / 2, z1 - 0.3, 0, wx, depth, 0.6, col, 'rock');
      P(BX, x0 + 0.3, -depth / 2, cz, 0, 0.6, depth, wz, col, 'rock'); P(BX, x1 - 0.3, -depth / 2, cz, 0, 0.6, depth, wz, col, 'rock'); }
    const inHole = (holes, x, z, m) => holes === null || holes.some(([x0, x1, z0, z1]) => x > x0 - (m || 0) && x < x1 + (m || 0) && z > z0 - (m || 0) && z < z1 + (m || 0));
    const railCol = th => mix(th.trim, '#000000', 0.1);
    // a bridge: the hall is a deck on piers with railings, the ground falls away either side (water, lava, a chasm, the sky, the void)
    function bridge(th, D, h, i, kind) {
      const along = h.ax === 'x', len = along ? h.w : h.d, hw = h.hw, deck = mix(th.trim, th.floor, 0.4), drop = DROP[kind] === undefined ? 20 : DROP[kind] || 30;
      P(BX, h.x, -0.75, h.z, 0, along ? len : hw + 0.8, 1.3, along ? hw + 0.8 : len, deck, 'rock');
      for (const sd of [-1, 1]) { const ox = along ? 0 : sd * (hw / 2 + 0.25), oz = along ? sd * (hw / 2 + 0.25) : 0, n = Math.max(2, Math.round(len / 2.8));
        P(BX, h.x + ox, 1.05, h.z + oz, along ? 0 : Math.PI / 2, len, 0.22, 0.3, railCol(th), 'rock'); P(BX, h.x + ox, 0.1, h.z + oz, along ? 0 : Math.PI / 2, len, 0.3, 0.5, railCol(th), 'rock');
        for (let k = 0; k <= n; k++) { const t = -len / 2 + len * k / n; P(BX, h.x + ox + (along ? t : 0), 0.6, h.z + oz + (along ? 0 : t), 0, 0.32, 1.2, 0.32, railCol(th), 'rock'); }
        if (kind === 'sky' || kind === 'void') for (let k = 1; k < n; k += 3) { const t = -len / 2 + len * k / n; torch(D, h.x + ox + (along ? t : 0), 1.45, h.z + oz + (along ? 0 : t), kind === 'void' ? '#c86aff' : '#9ad8ff', 0.6); } }
      const piers = Math.max(1, Math.floor(len / 14)), pd = kind === 'sky' || kind === 'void' ? 9 : drop + 1;
      for (let k = 1; k <= piers; k++) { const t = -len / 2 + len * k / (piers + 1), px = h.x + (along ? t : 0), pz = h.z + (along ? 0 : t);
        if (kind === 'sky' || kind === 'void') P(CO4, px, -1.4 - pd / 2, pz, Math.PI / 4, hw * 0.55, pd, 2.4, mix(th.wall, '#000000', 0.15), 'rock', Math.PI);
        else P(BX, px, -pd / 2 - 0.6, pz, 0, along ? 2.2 : hw + 1.2, pd, along ? hw + 1.2 : 2.2, mix(th.wall, '#000000', 0.12), th.wt); }
      if (!h.hole) return;   // the floating maps: no ground, nothing to dig
      // the drop: banks on both sides and what lies below
      const [hx0, hx1, hz0, hz1] = h.hole, cx = (hx0 + hx1) / 2, cz = (hz0 + hz1) / 2, wx = hx1 - hx0, wz = hz1 - hz0;
      pitWalls(h.hole, drop + 0.6, mix(th.out, '#000000', 0.2));
      P(BX, cx, -drop - 0.2, cz, 0, wx, 0.4, wz, mix(th.out, '#000000', 0.45), 'rock');
      for (let k = 0; k < Math.round(wx * wz / 140); k++) P(pick(ICO), R(hx0, hx1), -drop + R(-0.2, 0.6), R(hz0, hz1), rnd() * 6, R(0.8, 2.4), R(0.6, 1.6), R(0.8, 2.4), mix(th.out, '#000000', 0.3), 'rock');
      if (LIQ[kind]) D.push({ k: 'liquid', x: cx, y: -drop + 0.6, z: cz, w: wx - 0.4, d: wz - 0.4, col: LIQ[kind], lava: kind === 'lava' });
    }
    // a street: low kerbs instead of walls, and the dungeon's own houses standing shoulder to shoulder along both sides
    function street(th, D, h, i) {
      const along = h.ax === 'x', len = along ? h.w : h.d, hw = h.hw, n = Math.max(1, Math.floor(len / 10));
      for (const sd of [-1, 1]) { const ox = along ? 0 : sd * (hw / 2 + 0.35), oz = along ? sd * (hw / 2 + 0.35) : 0;
        P(BX, h.x + ox, 0.45, h.z + oz, along ? 0 : Math.PI / 2, len, 0.9, 0.7, th.trim, 'rock'); rect(h.x + ox, h.z + oz, along ? len : 0.7, along ? 0.7 : len, 0, 0.9);
        for (let k = 0; k < n; k++) { const t = -len / 2 + (k + 0.5) * len / n, bw = len / n - R(0.6, 1.6), bd = R(7, 9.5), bh = R(6, 12.5), off = hw / 2 + 0.9 + bd / 2;
          const bx = h.x + (along ? t : sd * off), bz = h.z + (along ? sd * off : t), yaw = along ? (sd > 0 ? Math.PI : 0) : (sd > 0 ? -Math.PI / 2 : Math.PI / 2);
          townHouse(th, D, bx, bz, yaw, bw, bd, bh); } }
    }
    // one building in a dungeon street, in that dungeon's style (its front faces the street: local +z)
    function townHouse(th, D, x, z, yaw, w, d, h) {
      const c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c], wall = mix(th.wall, '#ffffff', 0.06), trim = th.trim, n = th.n;
      P(BX, x, h / 2, z, yaw, w, h, d, wall, th.wt); P(BX, x, 0.4, z, yaw, w + 0.3, 0.8, d + 0.3, trim, 'rock');
      if (n === 'desert' || n === 'ember' || n === 'glitch' || n === 'clock' || n === 'moon') { P(BX, x, h + 0.25, z, yaw, w + 0.4, 0.5, d + 0.4, trim, 'rock');
        if (n === 'desert' && rnd() < 0.5) P(SPH, x, h + 0.4, z, 0, w * 0.32, w * 0.3, w * 0.32, mix(wall, '#ffffff', 0.2), th.wt);
        if ((n === 'ember' || n === 'clock') && rnd() < 0.6) { const p = at(w * 0.25, -d * 0.2); P(CY8, p[0], h + 2.2, p[1], 0, 0.6, 4.4, 0.6, trim, 'brick'); D.push({ k: 'smoke', x: p[0], y: h + 4.6, z: p[1] }); }
        if (n === 'glitch' || n === 'moon') P(BX, x, h * 0.62, z, yaw, w + 0.08, 0.18, d + 0.08, n === 'glitch' ? '#1aff8a' : '#9ab8ff'); }
      else if (n === 'void' || n === 'storm') { P(CO4, x, h + w * 0.55, z, yaw + Math.PI / 4, w * 0.72, w * 1.1, d * 0.72, mix(trim, '#000000', 0.2)); }
      else { roofOn(x, z, yaw + Math.PI / 2, d, w, h, n === 'frost' ? '#e8f0f8' : n === 'crypt' || n === 'drowned' ? '#2e3442' : n === 'woods' ? '#5a3a2a' : mix(trim, '#000000', 0.2), wall); }
      const rows = Math.max(1, Math.floor((h - 1) / 3.2)), cols = Math.max(1, Math.floor(w / 3));
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { if (rnd() < 0.3) continue; const lx = -w / 2 + (k + 0.5) * w / cols, p = at(lx, d / 2 + 0.03); win(D, p[0], 2.2 + r * 3.2, p[1], yaw, 0.85, 1.2); }
      { const p = at(rnd() < 0.5 ? -w * 0.2 : w * 0.2, d / 2 + 0.05); P(BX, p[0], 1.1, p[1], yaw, 1.3, 2.2, 0.16, mix(trim, '#000000', 0.3), 'wood'); }
      rect(x, z, w, d, yaw);
    }
    // an open cliff edge instead of a wall: a parapet, the rock face falling away and a landscape far below
    function cliffEdge(th, D, i, q) {
      const hx = q.round || q.w / 2, hz = q.round || q.d / 2, e = WALL_T / 2, sd = q.cliff, ns = sd === 'N' || sd === 'S', sg = sd === 'E' || sd === 'N' ? 1 : -1, low = -42;
      const ex = ns ? q.x : q.x + sg * (hx + e), ez = ns ? q.z + sg * (hz + e) : q.z, len = (ns ? hx : hz) * 2;
      if (!q.round) { P(BX, ex, 0.55, ez, ns ? 0 : Math.PI / 2, len, 1.1, 0.9, th.trim, 'rock'); for (let k = 0; k <= Math.round(len / 3); k++) { const t = -len / 2 + k * len / Math.round(len / 3); P(BX, ex + (ns ? t : 0), 0.85, ez + (ns ? 0 : t), 0, 0.6, 1.7, 0.6, th.wall, th.wt); } }
      if (!q.hole) return;   // a floating map: nothing below but cloud or void (the island hangs there)
      const [cx0, cx1, cz0, cz1] = q.hole, flen = ns ? cx1 - cx0 : cz1 - cz0, fc = ns ? (cx0 + cx1) / 2 : (cz0 + cz1) / 2;
      const fx = ns ? fc : ex + sg * 1.2, fz = ns ? ez + sg * 1.2 : fc; P(BX, fx, low / 2, fz, ns ? 0 : Math.PI / 2, flen, -low, 1.6, mix(th.wall, '#000000', 0.25), 'rock');
      for (let k = 0; k < 8; k++) { const t = R(-flen / 2 + 4, flen / 2 - 4); P(pick(ICO), fx + (ns ? t : sg * R(2, 4)), R(low * 0.8, -6), fz + (ns ? sg * R(2, 4) : 0) + (ns ? 0 : t), rnd() * 6, R(3, 7), R(4, 9), R(3, 7), mix(th.wall, '#000000', 0.2), 'rock'); }
      // Update 7 (final): the far side and both flanks step down in three terraces (a canyon, not a walled pit); the cliff face stays sheer.
      // u runs away from the room (0 at the cliff face, U at the far edge), v across it; every step is sealed to the one above.
      const U = ns ? cz1 - cz0 : cx1 - cx0, V = ns ? cx1 - cx0 : cz1 - cz0, vc = ns ? (cx0 + cx1) / 2 : (cz0 + cz1) / 2, steps = 3, sh = -low / steps, ins = Math.min(9, U / 5, V / 7);
      const box = (u0, u1, v0, v1, y0, y1, col, mat) => { if (u1 - u0 < 0.05 || v1 - v0 < 0.05) return; const ua = sg > 0 ? (ns ? cz0 : cx0) + u0 : (ns ? cz1 : cx1) - u1, ub = ua + (u1 - u0);
        const x0 = ns ? vc + v0 : ua, x1 = ns ? vc + v1 : ub, z0 = ns ? ua : vc + v0, z1 = ns ? ub : vc + v1; P(BX, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, x1 - x0, y1 - y0, z1 - z0, col, mat); };
      const at = (u, v) => { const w = sg > 0 ? (ns ? cz0 : cx0) + u : (ns ? cz1 : cx1) - u; return ns ? [vc + v, w] : [w, vc + v]; };
      const rk = mix(th.wall, '#000000', 0.3), keep = Y0;
      for (let k = 0; k < steps; k++) { const fu = U - k * ins, hv = V / 2 - k * ins, top = -k * sh, bot = -(k + 1) * sh;
        box(fu - 0.6, fu, -hv, hv, bot, top, rk, 'rock'); box(0, fu, -hv, -hv + 0.6, bot, top, rk, 'rock'); box(0, fu, hv - 0.6, hv, bot, top, rk, 'rock');   // this step's walls
        if (k < steps - 1) { const nu = fu - ins, nv = hv - ins;   // the ledge it ends on, with a few things growing there
          box(nu, fu, -hv, hv, bot - 0.4, bot, th.out, th.ot); box(0, nu, -hv, -nv, bot - 0.4, bot, th.out, th.ot); box(0, nu, nv, hv, bot - 0.4, bot, th.out, th.ot);
          Y0 = bot; for (let j = 0; j < 10; j++) { const r = rnd(), [x, z] = r < 0.4 ? at(R(nu + 1.5, fu - 1.5), R(-hv + 2, hv - 2)) : at(R(4, nu - 2), (r < 0.7 ? -1 : 1) * R(nv + 1.5, hv - 1.5)); outside(th, D, i, x, z); } Y0 = keep; }
        else box(0, fu, -hv, hv, bot - 0.4, bot, th.out, th.ot); }   // the canyon floor
      for (let k = 0; k < 14; k++) { const s2 = rnd() < 0.5 ? -1 : 1, kk = rnd() * steps | 0, [x, z] = rnd() < 0.5 ? at(U - kk * ins - R(1, 2.5), R(-V / 2 + kk * ins + 2, V / 2 - kk * ins - 2)) : at(R(4, U - kk * ins - 3), s2 * (V / 2 - kk * ins - R(1, 2.5)));
        P(pick(ICO), x, -(kk + 1) * sh + R(0.5, 2), z, rnd() * 6, R(1.8, 4), R(1.5, 3.5), R(1.8, 4), mix(th.wall, '#000000', 0.2), 'rock'); }   // fallen rock at the foot of each step
      Y0 = low; for (let k = 0; k < 40; k++) { const [x, z] = at(R(5, U - 2 * ins - 4), R(-V / 2 + 2 * ins + 3, V / 2 - 2 * ins - 3)); outside(th, D, i, x, z); } Y0 = keep;
    }
    // the island under a room of a floating map, and clouds or void-motes drifting below
    function island(th, q) {
      const hx = q.round || q.w / 2, hz = q.round || q.d / 2, deep = Math.max(hx, hz) * 0.9 + 6, rk = mix(th.wall, '#000000', 0.2);
      if (q.round) P(CO8, q.x, -0.4 - deep / 2, q.z, 0, hx + 1.5, deep, hz + 1.5, rk, 'rock', Math.PI);
      else P(CO4, q.x, -0.4 - deep / 2, q.z, Math.PI / 4, (hx + 1.5) * 1.414, deep, (hz + 1.5) * 1.414, rk, 'rock', Math.PI);
      for (let k = 0; k < 6; k++) { const a = rnd() * TAU; P(pick(ICO), q.x + Math.cos(a) * hx * 0.8, -R(2, deep * 0.6), q.z + Math.sin(a) * hz * 0.8, rnd() * 6, R(2, 5), R(2, 5), R(2, 5), rk, 'rock'); }
    }
    // one landmark per dungeon: a huge thing beside the map you keep seeing over the walls
    // Update 7 (final): the view in the distance: a ring of big shapes in each dungeon's own style out on the far ground (fog softens them)
    function farView(th, D, i, bb, MH, land) {
      const CX = W.DX(i), n = 72, fl = FLOAT[th.n], dark = mix(th.out, '#000000', 0.25), wall = mix(th.wall, '#000000', 0.15);
      for (let k = 0; k < n; k++) { const a = k / n * TAU + rnd() * 0.12, cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, rx = (bb.x1 - bb.x0) / 2 + R(70, 170), rz = (bb.z1 - bb.z0) / 2 + R(70, 170);
        let x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; x = Math.max(CX - 390, Math.min(CX + 390, x)); const s = R(0.8, 1.5), keep = Y0;
        if (MH && inHole(MH, x, z, 32)) continue; if (land && Math.hypot(x - land.x, z - land.z) < 60 * (land.s || 1)) continue;   // never over a pit, never inside the landmark
        if (fl) { Y0 = R(-30, 10); P(pick(ICO), x, 0, z, rnd() * 6, R(10, 22) * s, R(8, 16) * s, R(10, 22) * s, wall, 'rock'); P(CO6, x, -R(10, 18) * s, z, rnd() * 3, R(6, 10) * s, R(14, 24) * s, R(6, 10) * s, dark, 'rock', Math.PI); Y0 = keep; continue; }
        switch (th.n) {
          case 'woods': if (k % 3) { P(pick(ICO), x, 2, z, rnd() * 6, R(24, 40) * s, R(8, 18) * s, R(24, 40) * s, '#3a5a2e', 'grass'); for (let j = 0; j < 4; j++) pine(x + R(-14, 14), z + R(-14, 14), R(14, 22), pick(['#1e3a26', '#24402a'])); } else oak(x, z, R(3, 4.5), '#3a2a1c', '#2e4a26'); break;
          case 'desert': if (k % 4 === 0) { P(CO4, x, 14 * s, z, Math.PI / 4, 16 * s, 28 * s, 16 * s, '#b89058', 'sandstone'); } else if (k % 4 === 1) { for (let j = 0; j < 3; j++) P(CY8, x + j * 4, 7 * s, z, 0, 1.4, 14 * s - j * 3, 1.4, '#a88a5a', 'sandstone'); } else P(pick(ICO), x, 1, z, rnd() * 6, R(28, 50) * s, R(6, 14) * s, R(28, 50) * s, '#b8925a', 'sand'); break;
          case 'crypt': if (k % 3 === 0) { P(BX, x, 10 * s, z, rnd() * 3, 7 * s, 20 * s, 7 * s, wall, th.wt); P(CO4, x, 23 * s, z, 0.785, 6 * s, 8 * s, 6 * s, dark); } else if (k % 3 === 1) deadTree(x, z, R(3, 5), '#2a2428'); else P(pick(ICO), x, 3, z, rnd() * 6, R(20, 34) * s, R(10, 20) * s, R(20, 34) * s, wall, 'rock'); break;
          case 'frost': P(CO6, x, 18 * s, z, rnd() * 3, R(16, 26) * s, 36 * s, R(16, 26) * s, '#8aa4c4', 'iceRock'); P(CO6, x, 30 * s, z, rnd() * 3, 7 * s, 12 * s, 7 * s, '#eef4fa', 'white'); break;
          case 'ember': if (k % 3 === 0) { P(CO12, x, 16 * s, z, 0, 28 * s, 32 * s, 28 * s, '#2e2220', 'basalt'); D.push({ k: 'smoke', x, y: 32 * s, z }); } else P(CO4, x, 10 * s, z, rnd() * 3, 5 * s, R(16, 26) * s, 5 * s, '#24181a', 'basalt'); break;
          case 'void': P(CO4, x, 20 * s, z, rnd() * 3, R(4, 7) * s, R(30, 50) * s, R(4, 7) * s, '#2a1a3a', 'obsidian'); if (k % 2) P(BX, x + 6, 6 * s, z, rnd() * 3, 9 * s, 12 * s, 9 * s, '#3a2a4e', 'brick'); break;
          case 'glitch': P(BX, x, R(4, 30), z, rnd() * 3, R(6, 14) * s, R(6, 14) * s, R(6, 14) * s, pick(['#0a2a18', '#123a24', '#06140c']), 'tile'); break;
          case 'drowned': { const hgt = R(12, 30) * s; P(BX, x, hgt / 2, z, rnd() * 0.4, R(10, 16) * s, hgt, R(10, 16) * s, '#2e3a3c', 'crypt'); P(CO4, x, hgt + 6 * s, z, 0.785, 6 * s, 12 * s, 6 * s, '#1a2626'); break; }
          case 'clock': { const hgt = R(18, 36) * s; P(CY8, x, hgt / 2, z, 0, 2.6 * s, hgt, 2.6 * s, '#3e3024', 'brick'); D.push({ k: 'smoke', x, y: hgt + 1, z });
            if (k % 2) { P(BX, x + 6 * s, 7 * s, z, 0, 14 * s, 14 * s, 10 * s, '#4a3828', 'brick'); P(CO4, x + 6 * s, 17 * s, z, 0.785, 10 * s, 6 * s, 8 * s, '#2e2218'); }
            else P(CY12, x, hgt * 0.62, z + 2.8 * s, 0, 5 * s, 0.7 * s, 5 * s, '#7a6440', 'metal', Math.PI / 2, 0); break; }   // a chimney and a workshop, or a tower with a great gear
          case 'moon': if (k % 3 === 0) { P(CO6, x, 14 * s, z, rnd() * 3, R(5, 9) * s, 28 * s, R(5, 9) * s, '#4a4e60', 'rock'); P(CO6, x + R(-8, 8), 8 * s, z + R(-8, 8), rnd() * 3, R(3, 6) * s, 16 * s, R(3, 6) * s, '#565a6c', 'rock'); }
            else if (k % 3 === 1) { const cr = R(16, 26) * s; P(CY20, x, 0.5, z, 0, cr, 1.0, cr, '#5a5e70', 'rock'); P(CY20, x, 0.56, z, 0, cr * 0.62, 1.1, cr * 0.62, '#3a3e4e', 'rock'); }   // a crater: a raised rim, a dark floor
            else P(pick(ICO), x, 3, z, rnd() * 6, R(16, 26) * s, R(6, 12) * s, R(16, 26) * s, '#6a6e80', 'rock'); break;
          default: P(pick(ICO), x, 2, z, rnd() * 6, R(18, 30) * s, R(8, 16) * s, R(18, 30) * s, wall, 'rock'); }
      }
    }
    // clutter along the walls of the plain halls (crates, rubble, the dungeon's own bits) so the corridors are not bare
    // Update 7 (final): plain halls get things standing against their walls: low plinths with urns, rubble, shields hung on the wall.
    // Everything sits within 0.4 m of the wall, behind where a player or slime can reach, so nothing is ever walked through.
    function hallClutter(th, D, i, h) { const along = h.ax === 'x', len = along ? h.w : h.d, n = Math.floor((len - 6) / 7), stone = mix(th.wall, '#000000', 0.18);
      for (let k = 0; k < n; k++) { if (rnd() < 0.3) continue; const t = -len / 2 + 3 + (k + 0.5) * (len - 6) / n, sd = rnd() < 0.5 ? -1 : 1, o = h.hw / 2 - 0.2, x = h.x + (along ? t : sd * o), z = h.z + (along ? sd * o : t), yaw = along ? 0 : Math.PI / 2, r = rnd();
        if (r < 0.4) { P(BX, x, 0.3, z, yaw, 1.3, 0.6, 0.4, stone, th.wt); P(CY8, x, 0.85, z, 0, 0.32, 0.5, 0.32, mix(th.trim, '#3a2818', 0.4), 'rock'); }
        else if (r < 0.75) { for (let j = 0; j < 3; j++) P(pick(ICOS), x + (along ? R(-0.7, 0.7) : 0), 0.1, z + (along ? 0 : R(-0.7, 0.7)), rnd() * 6, R(0.2, 0.3), R(0.15, 0.3), R(0.2, 0.3), stone, 'rock'); }
        else { const w0 = h.hw / 2 - 0.05, sx = h.x + (along ? t : sd * w0), sz = h.z + (along ? sd * w0 : t); P(CY12, sx, 2.2, sz, along ? 0 : Math.PI / 2, 0.8, 0.08, 0.8, mix(th.trim, '#000000', 0.25), 'metal', Math.PI / 2, 0); } } }
    function landmark(th, D, i, L0) {
      const { k, x, z } = L0, s = L0.s || 1, d = C.DUNGEONS[i], col = d.col;
      switch (k) {
        case 'giantTree': P(CY8, x, 32 * s, z, 0, 7 * s, 64 * s, 7 * s, '#4a3424', 'bark'); for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; P(CY6, x + Math.cos(a) * 7 * s, 3 * s, z + Math.sin(a) * 7 * s, a, 2.2 * s, 9 * s, 2.2 * s, '#4a3424', 'bark', 0.6, 0); }
          for (let j = 0; j < 9; j++) { const a = rnd() * TAU, r = j ? R(10, 22) * s : 0; P(pick(ICO), x + Math.cos(a) * r, (58 + R(-6, 14)) * s, z + Math.sin(a) * r, rnd() * 3, R(16, 24) * s, R(11, 16) * s, R(16, 24) * s, pick(['#3a7a3a', '#4a8a40', '#2e6a34']), 'grass'); } break;
        case 'pyramid': P(CO4, x, 34 * s, z, Math.PI / 4, 62 * s, 68 * s, 62 * s, '#d8b070', 'sandstone'); P(CO4, x, 66 * s, z, Math.PI / 4, 6 * s, 6 * s, 6 * s, '#ffd86a', 'metal'); D.push({ k: 'orb', x, y: 71 * s, z, col: '#ffd86a', s: 8 }); break;
        case 'crystalSpire': for (let j = 0; j < 7; j++) { const a = j / 7 * TAU, r = j ? 9 * s : 0, hh = (j ? R(30, 50) : 90) * s; P(CO6, x + Math.cos(a) * r, hh / 2, z + Math.sin(a) * r, a, (j ? 4 : 7) * s, hh, (j ? 4 : 7) * s, pick(['#6ae8ff', '#8ab8ff', '#4ad8e8']), 'ice', R(-0.15, 0.15), R(-0.15, 0.15)); }
          D.push({ k: 'orb', x, y: 88 * s, z, col: '#6ae8ff', s: 8 }); break;
        case 'keep': P(CY12, x, 35 * s, z, 0, 12 * s, 70 * s, 12 * s, '#b8c8d8', 'iceRock'); P(CO12, x, 80 * s, z, 0, 15 * s, 22 * s, 15 * s, '#e8f0f8'); for (const a of [0.6, 2.7, 4.6]) { P(CY8, x + Math.cos(a) * 22 * s, 22 * s, z + Math.sin(a) * 22 * s, 0, 5 * s, 44 * s, 5 * s, '#a8b8cc', 'iceRock'); P(CO8, x + Math.cos(a) * 22 * s, 49 * s, z + Math.sin(a) * 22 * s, 0, 6.5 * s, 11 * s, 6.5 * s, '#e8f0f8'); } break;
        case 'volcano': P(CO12, x, 30 * s, z, 0, 80 * s, 60 * s, 80 * s, '#3a2a26', 'basalt'); P(CY12, x, 58 * s, z, 0, 20 * s, 4 * s, 20 * s, '#2a1a16', 'basalt'); D.push({ k: 'lava', x, z, r: 16 * s, y: 60 * s }); D.push({ k: 'smoke', x, y: 62 * s, z, big: 4 }); break;
        case 'spire': P(CY8, x, 60 * s, z, 0, 5 * s, 120 * s, 5 * s, '#5a6080', 'slate'); for (const y of [30, 60, 90]) P(CY20, x, y * s, z, 0, 14 * s, 1.2 * s, 14 * s, '#7a8ab0', 'metal'); P(CO8, x, 124 * s, z, 0, 7 * s, 12 * s, 7 * s, '#4a5aaa'); D.push({ k: 'orb', x, y: 131 * s, z, col: '#9ad8ff', s: 6 }); break;
        case 'citadel': P(BX, x, 30 * s, z, 0, 40 * s, 60 * s, 40 * s, '#3e2a4e', 'brick'); for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { P(CY12, x + ox * 22 * s, 40 * s, z + oz * 22 * s, 0, 7 * s, 80 * s, 7 * s, '#4a3460', 'brick'); P(CO12, x + ox * 22 * s, 88 * s, z + oz * 22 * s, 0, 9 * s, 16 * s, 9 * s, '#2a1a3a'); }
          D.push({ k: 'orb', x, y: 64 * s, z, col, s: 8 }); break;
        case 'voidEye': P(SPH, x, 60 * s, z, 0, 22 * s, 22 * s, 22 * s, '#2a1020'); P(SPH, x + 18 * s, 62 * s, z, 0, 8 * s, 10 * s, 10 * s, '#ff3a5a'); D.push({ k: 'orb', x: x + 22 * s, y: 62 * s, z, col: '#ff3a5a', s: 6 }); break;
        case 'planet': P(SPH, x, 95 * s, z, 0, 46 * s, 46 * s, 46 * s, i === 8 ? '#3a8a6a' : '#8a7aa8', 'rock'); P(CY20, x, 95 * s, z, 0.3, 74 * s, 0.6 * s, 74 * s, i === 8 ? '#9affd8' : '#d8c8ff', 'white', 0.35, 0.2); break;
        case 'cathedral': P(BX, x, 18 * s, z, 0, 26 * s, 36 * s, 60 * s, '#3a4a48', 'crypt'); roofOn(x, z, Math.PI / 2, 60 * s, 26 * s, 36 * s, '#1e2a2a', '#3a4a48'); for (const sd of [-1, 1]) { P(BX, x + sd * 9 * s, 34 * s, z - 34 * s, 0, 10 * s, 68 * s, 10 * s, '#3a4a48', 'crypt'); P(CO4, x + sd * 9 * s, 80 * s, z - 34 * s, Math.PI / 4, 8 * s, 24 * s, 8 * s, '#1e2a2a'); }
          win(D, x, 30 * s, z - 30.2 * s, Math.PI, 9 * s, 9 * s); break;
        case 'clockTower': P(BX, x, 45 * s, z, 0, 18 * s, 90 * s, 18 * s, '#5a4430', 'brick'); P(CO4, x, 100 * s, z, Math.PI / 4, 14 * s, 20 * s, 14 * s, '#3a2a1a'); for (const [yaw, ox, oz] of [[0, 0, 9.2], [Math.PI / 2, 9.2, 0], [Math.PI, 0, -9.2], [-Math.PI / 2, -9.2, 0]]) { win(D, x + ox * s, 76 * s, z + oz * s, yaw, 12 * s, 12 * s); }
          for (let j = 0; j < 5; j++) P(CY12, x + R(-14, 14) * s, R(20, 70) * s, z + 10 * s, 0, R(4, 8) * s, 1.2 * s, R(4, 8) * s, '#c8a040', 'metal', Math.PI / 2, 0); break;
      }
    }
    function buildDungeon(i) {
      const d = C.DUNGEONS[i], th = thOf(i), lay = W.layout(i), D = DYN['d' + i], rooms = lay.rooms, halls = lay.halls, bb = lay.bb, fire = fireOf(th, d); seed(5000 + i * 131); aoKey = 'd' + i;
      // ground outside + floors
      const MH = mapHoles(lay, th), fl = FLOAT[th.n];
      if (MH !== null) { const gx = bb.x0 - 36, gz = bb.z0 - 36, up = (v, o) => o + Math.ceil((v - o) / 12) * 12, dn = (v, o) => o + Math.floor((v - o) / 12) * 12;
        const IX0 = dn(Math.min(bb.x0 - 36, ...MH.map(r => r[0])), gx), IX1 = up(Math.max(bb.x1 + 36, ...MH.map(r => r[1])), gx), IZ0 = dn(Math.min(bb.z0 - 36, ...MH.map(r => r[2])), gz), IZ1 = up(Math.max(bb.z1 + 36, ...MH.map(r => r[3])), gz);
        // the 12 m grid is cut at every pit edge too, so the ground meets each pit's wall exactly (no gaps to see through)
        const cuts = (a0, a1, ks) => { const s = new Set(); for (let v = a0; v < a1 + 0.01; v += 12) s.add(Math.round(v * 1000) / 1000); for (const v of ks) if (v > a0 && v < a1) s.add(Math.round(v * 1000) / 1000); return [...s].sort((p, q) => p - q); };
        const xs = cuts(IX0, IX1, MH.flatMap(r => [r[0], r[1]])), zs = cuts(IZ0, IZ1, MH.flatMap(r => [r[2], r[3]]));
        for (let b = 0; b < zs.length - 1; b++) for (let a = 0; a < xs.length - 1; a++) { const x0 = xs[a], x1 = xs[a + 1], z0 = zs[b], z1 = zs[b + 1];
          if (x1 - x0 < 0.01 || z1 - z0 < 0.01 || inHole(MH, (x0 + x1) / 2, (z0 + z1) / 2)) continue; S(G.plane(x1 - x0, z1 - z0, 1, 1), T((x0 + x1) / 2, -0.02, (z0 + z1) / 2), th.out, th.ot); }
        const O = 200, far = mix(th.out, '#000000', 0.08), CX = W.DX(i), band = (x0, x1, z0, z1) => { x0 = Math.max(x0, CX - 398); x1 = Math.min(x1, CX + 398); if (x1 <= x0) return; const wx = x1 - x0, wz = z1 - z0; for (let a = 0; a < wx - 0.01; a += 64) for (let b = 0; b < wz - 0.01; b += 64) { const tw = Math.min(64, wx - a), td = Math.min(64, wz - b); S(G.plane(tw, td, 1, 1), T(x0 + a + tw / 2, -0.03, z0 + b + td / 2), far, th.ot); } };
        band(IX0 - O, IX1 + O, IZ0 - O, IZ0); band(IX0 - O, IX1 + O, IZ1, IZ1 + O); band(IX0 - O, IX0, IZ0, IZ1); band(IX1, IX1 + O, IZ0, IZ1); }   // the land goes on, past the view distance
      else P(BX, (bb.x0 + bb.x1) / 2, fl === 'sky' ? -70 : -90, (bb.z0 + bb.z1) / 2, 0, bb.x1 - bb.x0 + 500, 1, bb.z1 - bb.z0 + 500, fl === 'sky' ? '#b8c8e8' : '#1c0a20', 'white');   // far below: a sea of cloud, or the void
      for (const q of rooms) { if (q.round) { S(G.disc(q.round + 0.7, 48, 0.01, 1), T(q.x, 0, q.z), th.floor, th.ft); S(G.disc(q.round - 1.6, 48, 0.021, 1), T(q.x, 0, q.z), mix(th.floor, '#000000', 0.18), th.ft); }
        else { P(BX, q.x, -0.1, q.z, 0, q.w, 0.24, q.d, th.floor, th.ft); P(BX, q.x, 0.021, q.z, 0, q.w - 2.4, 0.02, q.d - 2.4, mix(th.floor, '#000000', 0.18), th.ft); } }
      for (const h of halls) P(BX, h.x, -0.09, h.z, 0, h.w, 0.24, h.d, mix(th.floor, '#000000', 0.08), th.ft);
      const lit = []; // torch spots, so banners and props keep clear of them
      rooms.forEach(q => {
        const { holes, doorAng } = roomSides(q, lay), mainCol = th.n === 'void' || th.n === 'glitch' || th.n === 'storm' ? d.col : '#ff7a1a';
        const freeAlong = (list, c) => list.every(([hc, hw]) => Math.abs(c - hc) > hw / 2 + 2.2), CA = { N: 0, S: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
        if (q.cliff && !q.round) holes[q.cliff].push([q.cliff === 'N' || q.cliff === 'S' ? q.x : q.z, (q.cliff === 'N' || q.cliff === 'S' ? q.w : q.d) + 6]);   // an open cliff edge, no wall
        if (q.round) { // ring of wall pieces with gaps at the doors
          const R0 = q.round + WALL_T / 2, n = Math.max(16, Math.ceil(TAU * R0 / 2.4)), segL = TAU * R0 / n;
          for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * TAU, gap = doorAng.some(da => { const df = Math.abs(Math.atan2(Math.sin(a - da), Math.cos(a - da))); return df < Math.asin(Math.min(1, (lay.hw / 2 + 0.6) / q.round)) + TAU / n * 0.5; });
            if (gap || (q.cliff && Math.abs(Math.atan2(Math.sin(a - CA[q.cliff]), Math.cos(a - CA[q.cliff]))) < 0.85)) continue; const x = q.x + Math.sin(a) * R0, z = q.z + Math.cos(a) * R0;
            P(BX, x, WALL_H / 2, z, a + Math.PI / 2, segL + 0.2, WALL_H, WALL_T, th.wall, th.wt); P(BX, x, WALL_H + 0.18, z, a + Math.PI / 2, segL + 0.25, 0.36, WALL_T + 0.3, th.trim, 'rock'); P(BX, x, 0.3, z, a + Math.PI / 2, segL + 0.2, 0.6, WALL_T + 0.25, th.trim, 'rock');
            rect(x, z, segL + 0.2, WALL_T, a + Math.PI / 2, WALL_H + 0.4);
            { const ca = Math.cos(a), sa = Math.sin(a), ri = q.round, k0 = (k) / n * TAU, k1 = (k + 1) / n * TAU; aoStrip(q.x + Math.sin(k0) * ri, q.z + Math.cos(k0) * ri, q.x + Math.sin(k1) * ri, q.z + Math.cos(k1) * ri, -Math.sin(a), -Math.cos(a), 1.5); }
            const nx = -Math.sin(a), nz = -Math.cos(a), clearDoor = doorAng.every(da => Math.abs(Math.atan2(Math.sin(a - da), Math.cos(a - da))) > 0.55);
            if (clearDoor && k % 3 === 0) wallDetail(th, D, x + nx * WALL_T / 2, z + nz * WALL_T / 2, nx, nz, i);
            if (clearDoor && k % 6 === 3) { const tx = x + nx * (WALL_T / 2 + 0.2), tz = z + nz * (WALL_T / 2 + 0.2); P(BX, tx, 3.2, tz, a, 0.3, 0.5, 0.3, '#1a1614', 'metal'); torch(D, tx + nx * 0.1, 3.7, tz + nz * 0.1, mainCol, 1); lit.push([tx, tz]); }
            else if (clearDoor && k % 6 === 0 && q.kind !== 'loot') banner(D, x + nx * (WALL_T / 2 + 0.08), 2.4, z + nz * (WALL_T / 2 + 0.08), Math.atan2(nx, nz), 1.1, 2.9, (BAN_TH[th.n] || BAN_TH.woods)()); }
        } else {
          const x0 = q.x - q.w / 2 - WALL_T / 2, x1 = q.x + q.w / 2 + WALL_T / 2, zN = q.z + q.d / 2 + WALL_T / 2, zS = q.z - q.d / 2 - WALL_T / 2;
          side(th, zN, x0 - WALL_T / 2, x1 + WALL_T / 2, true, holes.N); side(th, zS, x0 - WALL_T / 2, x1 + WALL_T / 2, true, holes.S);
          side(th, x0, zS, zN, false, holes.W); side(th, x1, zS, zN, false, holes.E);
          for (const [px, pz] of [[x0, zN], [x1, zN], [x0, zS], [x1, zS]]) pillar(th, px, pz, WALL_H + 1.2, 0.95);
          // buttresses, torches and banners along each wall (clear of the doors)
          const walls = [['N', q.x, q.z + q.d / 2, 0, -1, q.w, true], ['S', q.x, q.z - q.d / 2, 0, 1, q.w, true], ['E', q.x + q.w / 2, q.z, -1, 0, q.d, false], ['W', q.x - q.w / 2, q.z, 1, 0, q.d, false]];
          for (const [sd, cx0, cz0, nx, nz, len, horiz] of walls) { const n = Math.max(2, Math.round(len / 5.5)), list = holes[sd];
            for (let j = 0; j < n; j++) { const f = (j + 0.5) / n - 0.5, x = horiz ? cx0 + f * len : cx0, z = horiz ? cz0 : cz0 + f * len, c = horiz ? x : z; if (!freeAlong(list, c)) continue;
              if (j % 3 === 1) { const tx = x + nx * 0.15, tz = z + nz * 0.15; P(BX, tx, 3.2, tz, 0, 0.3, 0.5, 0.3, '#1a1614', 'metal'); torch(D, tx + nx * 0.1, 3.7, tz + nz * 0.1, mainCol, 1); lit.push([tx, tz]); }
              else { wallDetail(th, D, x, z, nx, nz, i); if (j % 3 === 2 && q.kind !== 'loot' && len > 14) banner(D, x + nx * 0.92, 2.4, z + nz * 0.92, Math.atan2(nx, nz), 1.0, 2.6, (BAN_TH[th.n] || BAN_TH.woods)()); } } }
        }
        // props along the walls, leaving the middle free for fighting
        if (q.kind === 'mob' || q.kind === 'mini' || q.kind === 'start' || q.kind === 'side') { const np = Math.round((q.w + q.d) / 4.2);
          for (let j = 0; j < np; j++) { let px, pz, yaw = 0;
            if (q.round) { const a = rnd() * TAU; px = q.x + Math.sin(a) * (q.round - 1.3); pz = q.z + Math.cos(a) * (q.round - 1.3); yaw = a; if (doorAng.some(da => Math.abs(Math.atan2(Math.sin(a - da), Math.cos(a - da))) < 0.5)) continue; }
            else { const sdx = rnd() < 0.5 ? -1 : 1, along = rnd() < 0.5; px = along ? q.x + R(-q.w / 2 + 2, q.w / 2 - 2) : q.x + sdx * (q.w / 2 - 1.3); pz = along ? q.z + sdx * (q.d / 2 - 1.3) : q.z + R(-q.d / 2 + 2, q.d / 2 - 2); yaw = along ? 0 : Math.PI / 2; }
            let clear = Math.hypot(px - lay.relic.x, pz - lay.relic.z) > 3; for (const h of halls) for (const dp of [h.pa, h.pb]) if (Math.hypot(px - dp.x, pz - dp.z) < lay.hw / 2 + 2.5) clear = false;
            for (const q2 of lay.props) if (Math.hypot(px - q2.x, pz - q2.z) < 2) clear = false; for (const q2 of lay.spots) if (Math.hypot(px - q2.x, pz - q2.z) < 2.8) clear = false;
            for (const l2 of lit) if (Math.hypot(px - l2[0], pz - l2[1]) < 1.6) clear = false;
            if (clear) wallProp(th, D, px, pz, yaw); } }
        // floor detail: patches, cracks, rubble and bones
        const fl = (x, z, r, col, tx) => S(G.disc(r, 14, 0.028 + rnd() * 0.004, 1), T(x, 0, z, rnd() * 6, 0, 0, 1, 1, 1), col, tx);
        const inQ = (x, z, m) => q.round ? Math.hypot(x - q.x, z - q.z) < q.round - m : Math.abs(x - q.x) < q.w / 2 - m && Math.abs(z - q.z) < q.d / 2 - m;
        const spots = q.kind === 'boss' ? 12 : q.kind === 'start' || q.kind === 'loot' ? 3 : Math.round(q.w * q.d / 140);
        for (let j = 0; j < spots; j++) { const x = q.x + R(-q.w / 2 + 3.6, q.w / 2 - 3.6), z = q.z + R(-q.d / 2 + 3.6, q.d / 2 - 3.6); if (!inQ(x, z, 3)) continue;
          switch (th.n) {
            case 'woods': fl(x, z, R(0.8, 2.2), pick(['#1e3418', '#243c1c', '#2a2416']), 'grass'); if (rnd() < 0.3) rubble(th, x + 1, z); break;
            case 'crypt': if (rnd() < 0.5) { S(G.disc(R(0.8, 1.8), 16, 0.03, 1), T(x, 0, z), '#1a2a3a'); D.push({ k: 'puddle', x, z }); } else fl(x, z, R(0.6, 1.4), '#3a3844', 'cobble'); break;
            case 'desert': fl(x, z, R(1.2, 2.6), '#8a6a40', 'sand'); if (rnd() < 0.25) rubble(th, x, z); break;
            case 'frost': fl(x, z, R(0.8, 1.8), '#9aaabc', 'sand'); break;
            case 'ember': { const a2 = rnd() * 3; for (let s2 = 0; s2 < 3; s2++) P(BX, x + Math.sin(a2 + s2) * s2 * 0.5, 0.03, z + Math.cos(a2 + s2) * s2 * 0.5, a2 + s2 * 0.7, R(1.2, 2.2), 0.02, 0.09, '#c8401a'); D.push({ k: 'crack', x, z, a: a2 }); break; }
            case 'storm': case 'void': if (j < 2) D.push({ k: 'floorRune', x, z, r: R(1.2, 1.8), col: d.col }); else { fl(x, z, R(0.6, 1.2), th.wall, 'tile'); if (rnd() < 0.3) rubble(th, x, z); } break;
            case 'abyss': fl(x, z, R(0.6, 1.6), '#3a0610'); if (rnd() < 0.3) bones(x, z); break;
            case 'glitch': P(BX, x, 0.03, z, 0, R(0.8, 1.6), 0.02, R(0.8, 1.6), pick(['#0a3a1a', '#1aff8a', '#062010']), 'tile'); break;
          } }
        if ((th.n === 'crypt' || th.n === 'abyss' || th.n === 'desert') && q.kind !== 'start') for (let j = 0; j < 3; j++) { const x = q.x + R(-q.w / 2 + 2.5, q.w / 2 - 2.5), z = q.z + R(-q.d / 2 + 2.5, q.d / 2 - 2.5);
          if (!inQ(x, z, 2) || lay.props.some(p2 => Math.hypot(p2.x - x, p2.z - z) < 1.8) || lay.spots.some(p2 => Math.hypot(p2.x - x, p2.z - z) < 2.5)) continue; bones(x, z); }
        // boss and mini-boss rooms: a rune circle, tall pillars by the walls with braziers
        if (q.kind === 'boss' || q.kind === 'mini') { const n = q.kind === 'boss' ? 6 : 4, rr = q.round ? q.round - 2.6 : null;
          for (let j = 0; j < n; j++) { let px, pz; if (q.round) { const a = (j + 0.5) / n * TAU; if (doorAng.some(da => Math.abs(Math.atan2(Math.sin(a - da), Math.cos(a - da))) < 0.45)) continue; px = q.x + Math.sin(a) * rr; pz = q.z + Math.cos(a) * rr; }
            else { if (j >= 4) break; const ax = j % 2 ? 1 : -1, az = j < 2 ? 1 : -1; px = q.x + ax * (q.w / 2 - 3); pz = q.z + az * (q.d / 2 - 3); }
            pillar(th, px, pz, q.kind === 'boss' ? 7 : 5, q.kind === 'boss' ? 1.1 : 0.8); if (q.kind === 'boss' && j % 2 === 0) torch(D, px, 7.9, pz, fire, 1.3); } }
        if (q.kind === 'boss') { const rr = (q.round || Math.min(q.w, q.d) / 2) * 0.72; S(G.disc(rr, 48, 0.03, 1), T(q.x, 0.04, q.z), mix(th.floor, d.col, 0.14), 'tile'); D.push({ k: 'bossRune', x: q.x, z: q.z, r: rr * 0.92, col: d.col }); }
      });
      // obstacles, hazards
      for (const o of lay.obst) obstacle(th, D, o, d);
      for (const h of lay.haz) { if (h.k === 'pool') { const col = th.n === 'ember' ? '#ff5a1a' : th.n === 'woods' ? '#5a8a1a' : th.n === 'abyss' ? '#c81a3a' : th.n === 'frost' ? '#7ad8ff' : d.col;
          S(G.disc(h.r + 0.5, 24, 0.022, 1), T(h.x, 0, h.z), mix(th.floor, '#000000', 0.5), th.ft); D.push({ k: th.n === 'ember' ? 'lava' : 'pool', x: h.x, z: h.z, r: h.r, col }); }
        else if (h.k === 'tide') { for (const q of h.safe) { P(CY12, q[0], 0.07, q[1], 0, q[2], 0.14, q[2], mix(th.wall, '#ffffff', 0.1), 'tile'); P(CY12, q[0], 0.12, q[1], 0, q[2] * 0.75, 0.1, q[2] * 0.75, mix(th.trim, '#000000', 0.2), 'crypt'); D.push({ k: 'dais', x: q[0], z: q[1], r: q[2] }); } }
        else if (h.k === 'blades') { S(G.disc(h.r + 0.5, 32, 0.02, 1), T(h.x, 0.005, h.z), mix(th.floor, '#000000', 0.45), 'metal'); P(CY12, h.x, 0.25, h.z, 0, 0.7, 0.5, 0.7, '#3a2a18', 'metal'); P(CY12, h.x, 0.5, h.z, 0, 0.35, 0.3, 0.35, '#b88a3a', 'metal'); }
        else if (h.k === 'star') { S(G.disc(h.r + 0.3, 24, 0.02, 1), T(h.x, 0.006, h.z), mix(th.floor, '#000000', 0.55), th.ft); for (let j = 0; j < 7; j++) { const a = j / 7 * TAU; P(BX, h.x + Math.sin(a) * (h.r + 0.2), 0.08, h.z + Math.cos(a) * (h.r + 0.2), a, 0.6, 0.18, 0.4, mix(th.wall, '#000000', 0.2), 'rock'); } }
        else { P(CY12, h.x, 0.06, h.z, 0, h.r, 0.12, h.r, '#141216', 'metal'); P(CY12, h.x, 0.1, h.z, 0, h.r * 0.55, 0.12, h.r * 0.55, mix(th.trim, '#000000', 0.4), 'rock');
          for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; P(BX, h.x + Math.sin(a) * h.r * 0.8, 0.14, h.z + Math.cos(a) * h.r * 0.8, a, 0.25, 0.1, h.r * 0.5, '#24202a', 'metal'); } } }
      // halls: side walls, a doorframe at both ends, the gate at the start (closed until the room before it is cleared)
      halls.forEach(h => {
        const [dx, dz] = W.DIRV[h.dir], A = rooms[h.a], Bq = rooms[h.b], e0 = A.round ? -1.0 : 0.3, e1 = Bq.round ? -1.0 : 0.3;
        const s0x = h.pa.x - dx * e0, s0z = h.pa.z - dz * e0, s1x = h.pb.x + dx * e1, s1z = h.pb.z + dz * e1, off = h.hw / 2 + WALL_T / 2;
        if (h.br) bridge(th, D, h, i, h.br); else if (h.st) street(th, D, h, i);
        else if (h.ax === 'z') { dwall(th, h.x - off, s0z, h.x - off, s1z); dwall(th, h.x + off, s0z, h.x + off, s1z); } else { dwall(th, s0x, h.z - off, s1x, h.z - off); dwall(th, s0x, h.z + off, s1x, h.z + off); }
        doorFrame(th, h.pa.x, h.pa.z, h.ax, h.hw); doorFrame(th, h.pb.x, h.pb.z, h.ax, h.hw);
        // braziers either side of the door you leave by, a torch pair halfway down long halls
        if (A.kind !== 'boss' && A.kind !== 'loot') for (const sd of [-1, 1]) { const bx = h.pa.x - dx * 1.6 + (h.ax === 'z' ? sd * (h.hw / 2 + 1.6) : 0), bz = h.pa.z - dz * 1.6 + (h.ax === 'x' ? sd * (h.hw / 2 + 1.6) : 0); if (W.where(i, bx, bz, 0.6) === A.i) brazier(th, D, bx, bz, fire); }
        if (h.len >= 20 && !h.br && !h.st) { const mx = (h.pa.x + h.pb.x) / 2, mz = (h.pa.z + h.pb.z) / 2; for (const sd of [-1, 1]) { const tx = mx + (h.ax === 'z' ? sd * (h.hw / 2 + 0.15) : 0), tz = mz + (h.ax === 'x' ? sd * (h.hw / 2 + 0.15) : 0); torch(D, tx, 3.5, tz, fire, 0.9); } }
        const gx = h.pa.x + dx * (A.round ? 0.8 : WALL_T / 2), gz = h.pa.z + dz * (A.round ? 0.8 : WALL_T / 2), yaw = h.ax === 'z' ? 0 : Math.PI / 2;
        (WD.gates[i] || (WD.gates[i] = [])).push({ x: gx, z: gz, w: h.hw, k: h.i, ax: h.ax, yaw, dx, dz });
        D.push({ k: 'gate', x: gx, z: gz, w: h.hw, h: h.i, i, len: h.len, yaw, dx, dz });
      });
      // signs over the doors: the dungeon's name, mini-bosses and the boss
      const signOver = (q, sg, w, hgt) => { const h = halls.find(h2 => h2.a === q.i && rooms[h2.b].main) || halls[q.hin]; if (!h) return; const out = h.a === q.i, dp = out ? h.pa : h.pb, [dx, dz] = W.DIRV[h.dir], nx = out ? -dx : dx, nz = out ? -dz : dz;
        const sx = dp.x + nx * 0.12, sz = dp.z + nz * 0.12; D.push({ k: 'sign', s: sg, x: sx, y: WALL_H + hgt / 2 + 2.0, z: sz, yaw: Math.atan2(nx, nz), w, h: hgt, nx, nz }); };
      rooms.forEach(q => { if (q.kind === 'boss') signOver(q, sign(C.MOBS[d.boss].n.toUpperCase(), 'Final boss · every boss fights differently', '#ff4a4a', 640, 150), 5.4, 1.3);
        if (q.kind === 'mini') signOver(q, sign(C.MOBS[L.miniOf(i, q)].n.toUpperCase(), 'Mini-boss', '#ff8a4a', 512, 140), 3.8, 1.05); });
      // start room: way back to town, the dungeon's name
      const st = rooms[0], hx = st.round ? st.x - st.round + 1.6 : st.x - st.w / 2 + 1.1, hz = st.z + 1.5; D.push({ k: 'portal', x: hx, y: 3, z: hz, yaw: Math.PI / 2, r: 2.1, col: '#9ab8ff', home: 1 });
      arch(hx - 0.2, hz, Math.PI / 2, 5, 5.2, th.wall, th.wt, true);
      const hs = sign('DUSKHOLD', 'the way home', '#9ab8ff', 512, 130); D.push({ k: 'sign', s: hs, x: hx - 1.0, y: WALL_H + 2.3, z: hz, yaw: Math.PI / 2, w: 3.2, h: 0.82, nx: 1, nz: 0 });
      signOver(st, sign(d.n.toUpperCase(), 'Level ' + d.lvl + '+ · ' + lay.n + ' · ' + C.MOBS[d.boss].n, d.col, 640, 160), 5.4, 1.35);
      S(G.disc(2.6, 32, 0.035, 1), T(lay.start.x, 0.03, lay.start.z), mix(th.floor, d.col, 0.3), 'tile');
      // loot room: the chest and the way home
      const lt = rooms[lay.loot]; D.push({ k: 'lootChest', x: lt.x, z: lt.z, i }); rect(lt.x, lt.z, 1.7, 1.1, 0, 1.3, 1.0);
      D.push({ k: 'portal', x: lay.exit.x, y: 3, z: lay.exit.z, yaw: lay.exit.yaw, r: 2.1, col: '#9ab8ff', home: 2 }); arch(lay.exit.x - Math.sin(lay.exit.yaw) * 0.2, lay.exit.z - Math.cos(lay.exit.yaw) * 0.2, lay.exit.yaw + Math.PI / 2, 5, 5.2, th.wall, th.wt, true);
      // the hidden relic (one per dungeon except the Glitch Realm itself)
      if (i < 8) D.push({ k: 'relic', i, x: lay.relic.x, z: lay.relic.z });
      D.push({ k: 'lantern', i, x: lay.lantern.x, z: lay.lantern.z });   // a lost lantern (Update 6 secret): dim, in a corner
      // outside the walls
      const area = (bb.x1 - bb.x0 + 120) * (bb.z1 - bb.z0 + 120), no = Math.min(900, Math.round(area / 110));
      for (let n = 0; n < no; n++) { const x = R(bb.x0 - 55, bb.x1 + 55), z = R(bb.z0 - 55, bb.z1 + 55);
        if (MH === null) { if (W.where(i, x, z, -8) >= 0 || rnd() < 0.6) continue; const sky = fl === 'sky'; P(pick(ICO), x, R(-46, -10), z, rnd() * 6, R(3, 9), R(2, sky ? 4 : 7), R(3, 9), sky ? pick(['#f2f6ff', '#dfe8f8']) : pick(['#3a1a3e', '#2a1030', '#5a2a5e']), sky ? 'white' : 'rock'); continue; }
        if (!inHole(MH, x, z, 3)) outside(th, D, i, x, z); }
      if (MH !== null) { const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, hx = (bb.x1 - bb.x0) / 2, hz = (bb.z1 - bb.z0) / 2, L1 = lay.land;   // Update 7 (final): more out in the middle distance
        for (let n = 0; n < Math.round(no * 0.35); n++) { const a = rnd() * TAU, x = cx + Math.cos(a) * (hx + R(55, 120)), z = cz + Math.sin(a) * (hz + R(55, 120));
          if (inHole(MH, x, z, 3) || (L1 && Math.hypot(x - L1.x, z - L1.z) < 50 * (L1.s || 1))) continue; outside(th, D, i, x, z); } }
      rooms.forEach(q => { if (q.cliff) cliffEdge(th, D, i, q); if (fl) island(th, q); });
      if (lay.land) landmark(th, D, i, lay.land);
      farView(th, D, i, bb, MH, lay.land); halls.forEach(h => { if (!h.br && !h.st) hallClutter(th, D, i, h); });
      WD.points['d' + i] = [{ key: 'leave', x: hx + 0.3, z: hz, r: 1.6, walk: 1 }, { key: 'leaveWin', x: lay.exit.x, z: lay.exit.z, r: 1.7, walk: 1 }];
      // moonbeams falling into the bigger rooms (dust drifts in them)
      for (const q of rooms) { if (q.kind === 'loot') continue; const n = Math.max(1, Math.min(3, Math.round((q.w * q.d) / 380)));
        for (let j = 0; j < n; j++) { const x = q.x + R(-q.w / 2 + 4, q.w / 2 - 4), z = q.z + R(-q.d / 2 + 4, q.d / 2 - 4); if (q.round && Math.hypot(x - q.x, z - q.z) > q.round - 4) continue; D.push({ k: 'shaft', x, z, w: R(2.6, 4.2), h: 15, col: th.shaft || '#8aa0d8', ph: rnd() * 6 }); } }
      // hanging chains that swing, water that drips (crypt, abyss, ember)
      if (th.n === 'crypt' || th.n === 'abyss' || th.n === 'ember') for (const q of rooms) { if (q.round || q.kind === 'loot') continue; for (let j = 0; j < 2; j++) { const sdx = rnd() < 0.5 ? -1 : 1, along = rnd() < 0.5;
        const x = along ? q.x + R(-q.w / 2 + 3, q.w / 2 - 3) : q.x + sdx * (q.w / 2 - 0.9), z = along ? q.z + sdx * (q.d / 2 - 0.9) : q.z + R(-q.d / 2 + 3, q.d / 2 - 3);
        D.push({ k: 'chainH', x, y: WALL_H + 0.2, z, n: 5 + (rnd() * 4 | 0), ph: rnd() * 6 }); if (th.n === 'crypt') D.push({ k: 'drip', x: x + R(-1, 1), z: z + R(-1, 1), ph: rnd() * 6, every: R(1.6, 3.2) }); } }
      aoKey = null;
    }
    // closed gates are solid (checked after the static colliders)
    const gateCollide = (x, z, rad) => {
      const i = W.dunAt(x, z); if (i < 0 || !WD.gates[i] || !WD.gateOpen) return [x, z];
      for (const g of WD.gates[i]) { if (WD.gateOpen(i, g.k)) continue; const hw = g.w / 2 + rad, hd = WALL_T / 2 + rad;
        if (g.ax === 'x') { if (Math.abs(z - g.z) < hw && Math.abs(x - g.x) < hd) x = x > g.x ? g.x + hd : g.x - hd; }
        else if (Math.abs(x - g.x) < hw && Math.abs(z - g.z) < hd) z = z > g.z ? g.z + hd : g.z - hd; }
      return [x, z]; };
    const baseCollide = WD.collide;
    WD.collide = function (x, z, rad, y) { const r = baseCollide(x, z, rad, y), g = gateCollide(r[0], r[1], rad); return WD.propSolid ? WD.propSolid(g[0], g[1], rad) : g; };

    // ================================================================ THE PIT (arena)
    function buildArena() {
      seed(7); const ax = W.ARENA.x, az = W.ARENA.z, D = DYN.arena, r = W.ARENA.r; aoKey = 'arena';
      for (let i = 0; i < 40; i++) { const a0 = i / 40 * TAU, a1 = (i + 1) / 40 * TAU; aoStrip(ax + Math.sin(a0) * (r + 0.6), az + Math.cos(a0) * (r + 0.6), ax + Math.sin(a1) * (r + 0.6), az + Math.cos(a1) * (r + 0.6), -Math.sin(a0), -Math.cos(a0), 1.8); }
      groundTiles(ax, az, 72, '#140e10', 'rock');
      S(G.disc(r + 1, 48, 0.03, 1), T(ax, 0, az), '#3a2e2a', 'dirt'); S(G.disc(5, 32, 0.05, 1), T(ax, 0, az), '#4a1a14', 'cobble');
      for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, x = ax + Math.sin(a) * (r + 1.2), z = az + Math.cos(a) * (r + 1.2); P(BX, x, 2.2, z, a, (r + 1.2) * TAU / 40 + 0.2, 4.4, 1.2, '#3a3036', 'brick'); }
      for (let t = 0; t < 4; t++) for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, rr2 = r + 3 + t * 2.2, x = ax + Math.sin(a) * rr2, z = az + Math.cos(a) * rr2; P(BX, x, 4.6 + t * 1.3, z, a, rr2 * TAU / 48 + 0.25, 1.3, 2.2, t % 2 ? '#2e262c' : '#342a30', 'rock'); }
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU, x = ax + Math.sin(a) * (r + 0.6), z = az + Math.cos(a) * (r + 0.6); arch(x, z, a, 4.4, 4.6, '#2a2026'); D.push({ k: 'gateDark', x, z, yaw: a + Math.PI }); torch(D, x + Math.cos(a) * 3, 5.6, z - Math.sin(a) * 3, '#ff2a1a'); torch(D, x - Math.cos(a) * 3, 5.6, z + Math.sin(a) * 3, '#ff2a1a'); }
      for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; banner(D, ax + Math.sin(a) * (r + 0.55), 3.4, az + Math.cos(a) * (r + 0.55), a + Math.PI, 1.1, 3, i % 2 ? BAN_RED : BAN_BLACK); }
      const s = sign('THE PIT', 'Survive the waves', '#ff4a4a', 512, 150); signAt(D, s, ax, 6.8, az + r + 0.4, Math.PI, 4, 1.2);
      for (let j = 0; j < 4; j++) D.push({ k: 'shaft', x: ax + R(-8, 8), z: az + R(-8, 8), w: R(3, 4.5), h: 16, col: '#ff8a5a', ph: rnd() * 6 });
      WD.points.arena = []; aoKey = null;
    }
    // ================================================================ THE WILDS (Update 6): an open overworld west of Duskhold
    function buildWild() {
      seed(911); const WL = W.wild, X = W.WILD.x, Z = W.WILD.z, RR = W.WILD.r, D = DYN.wild; aoKey = null;
      groundTiles(X, Z, RR + 40, '#141c12', 'grass');
      S(G.disc(RR + 2, 96, 0.02, 1), T(X, 0, Z), '#2a3822', 'grass');
      // roads of packed dirt
      for (const [a, b] of WL.roads) { const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
        P(BX, (a.x + b.x) / 2, 0.03, (a.z + b.z) / 2, yaw, 4.2, 0.03, len, '#3a3022', 'dirt'); for (let j = 0; j < len / 6; j++) { const k = j * 6 / len; rock(a.x + dx * k + Math.cos(yaw) * 2.6 * (j % 2 ? 1 : -1), a.z + dz * k - Math.sin(yaw) * 2.6 * (j % 2 ? 1 : -1), 0.25, '#4a4438', false); } }
      // the edge: a ring of old cliffs and dense dead woods (you can't leave except by the gates)
      for (let i = 0; i < 90; i++) { const a = i / 90 * TAU, r = RR + 1.5 + R(0, 3); P(pick(ICO), X + Math.sin(a) * r, R(1.5, 4), Z + Math.cos(a) * r, rnd() * 6, R(3, 5), R(3, 7), R(3, 5), '#2a2a30', 'rock'); }
      for (let i = 0; i < 60; i++) { const a = rnd() * TAU, r = RR + 8 + rnd() * 25; deadTree(X + Math.sin(a) * r, Z + Math.cos(a) * r, R(1.2, 2), '#1a1612'); }
      const th = TH[0], d = C.DUNGEONS[0];
      for (const o of WL.obst) { if (o.k === 'trees') { if (rnd() < 0.55) oak(o.x, o.z, R(1.1, 1.6), '#1e140e', pick(['#0e2212', '#132a16', '#1a2a12'])); else deadTree(o.x, o.z, R(1.1, 1.6), '#2a2018'); }
        else rock(o.x, o.z, o.r * 1.2, '#3a3a40'); }
      // camps of slimes: a ring of stones, a crude totem with the camp's danger colour
      for (const c of WL.camps) { const col = ['#9aff5a', '#ffb84a', '#ff4a4a'][c.tier]; S(G.disc(c.r + 1, 32, 0.025, 1), T(c.x, 0, c.z), '#2a2418', 'dirt');
        for (let j = 0; j < 9; j++) { const a = j / 9 * TAU; rock(c.x + Math.sin(a) * (c.r + 1), c.z + Math.cos(a) * (c.r + 1), 0.5, '#3a3830', false); }
        P(CY6, c.x, 1.4, c.z, 0, 0.18, 2.8, 0.18, '#2a1a10', 'bark'); P(pick(ICO), c.x, 3.0, c.z, 0, 0.45, 0.4, 0.45, '#d8d0b8', 'rock'); circ(c.x, c.z, 0.4, 3);
        D.push({ k: 'rune', x: c.x, y: 3.0, z: c.z, col }); }
      // the Wanderers' Camp in the middle: tents, a fire, a signpost, lanterns
      { const c = WL.camp0; S(G.disc(11, 40, 0.025, 1), T(c.x, 0, c.z), '#3a3022', 'dirt');
        for (let j = 0; j < 4; j++) { const a = j / 4 * TAU + 0.4, x = c.x + Math.sin(a) * 7, z = c.z + Math.cos(a) * 7; P(CO4, x, 1.4, z, a + Math.PI / 4, 2.4, 2.8, 2.4, pick(['#4a3a2a', '#3a2a3a', '#2a3a3a']), 'wood'); circ(x, z, 2, 2.8); }
        P(CY8, c.x, 0.15, c.z, 0, 1.0, 0.3, 1.0, '#2a2420', 'rock'); torch(D, c.x, 0.6, c.z, '#ff8a3a', 2); circ(c.x, c.z, 0.9, 0.6);
        const sg = sign('THE WILDS', 'Camps · wayshrines · Far Gates west', '#9ad8a0', 512, 150); P(BX, c.x + 3.5, 1.4, c.z - 3.5, 0.8, 0.18, 2.8, 0.18, '#2a1a10', 'wood'); signAt(D, sg, c.x + 3.5, 3.0, c.z - 3.5, 0.8 + Math.PI, 2.4, 0.75);
        for (const [x, z] of [[c.x - 9, c.z + 3], [c.x + 9, c.z - 3]]) { P(CY6, x, 1.5, z, 0, 0.08, 3, 0.08, '#1a1612', 'metal'); D.push({ k: 'candle', x, y: 3.0, z }); } }
      // the gate home (east) and the three Far Gates (west) to the Update 6 worlds
      { const e = WL.exit; arch(e.x, e.z, Math.PI / 2, 6, 6.5, '#3e3a48'); D.push({ k: 'portal', x: e.x, y: 3.1, z: e.z, yaw: -Math.PI / 2, r: 2.4, col: '#ffd84a' });
        const sg = sign('DUSKHOLD', 'Leave the Wilds (you are paid for every camp)', '#ffd84a', 512, 150); signAt(D, sg, e.x - 1, 7.2, e.z, -Math.PI / 2, 4.2, 1.25); torch(D, e.x - 1, 5.6, e.z - 3.6, '#ffb84a'); torch(D, e.x - 1, 5.6, e.z + 3.6, '#ffb84a'); }
      for (const g of WL.gates) { const dd = C.DUNGEONS[g.k], yaw = Math.PI / 2; P(CY20, g.x, 0.15, g.z, 0, 3.6, 0.3, 3.6, '#2a2830', 'rock'); arch(g.x, g.z, yaw, 5.4, 6, '#3e3a48');
        D.push({ k: 'portal', x: g.x, y: 3.15, z: g.z, yaw, r: 2.3, col: dd.col, dk: g.k }); const sg = sign(dd.n.toUpperCase(), 'Level ' + dd.lvl + '+ · a Far Gate', dd.col, 512, 150); signAt(D, sg, g.x + 1, 8.0, g.z, yaw, 4.6, 1.4);
        torch(D, g.x + 0.6, 6.2, g.z - 3.5, dd.col); torch(D, g.x + 0.6, 6.2, g.z + 3.5, dd.col); }
      // five wayshrines, hidden in the woods: a weathered obelisk with a rune (bright until you find it)
      for (const w of WL.ways) { P(BX, w.x, 1.6, w.z, rnd() * 3, 0.9, 3.2, 0.9, '#4a4a54', 'rock'); P(CO4, w.x, 3.6, w.z, 0.785, 0.7, 0.8, 0.7, '#4a4a54', 'rock'); P(CY8, w.x, 0.1, w.z, 0, 1.6, 0.2, 1.6, '#3a3a40', 'rock'); circ(w.x, w.z, 0.7, 3.2);
        D.push({ k: 'way', x: w.x, z: w.z, i: w.i }); }
      // moonbeams and mist
      for (let j = 0; j < 8; j++) { const a = rnd() * TAU, r = rnd() * RR * 0.8; D.push({ k: 'shaft', x: X + Math.sin(a) * r, z: Z + Math.cos(a) * r, w: R(3, 5), h: 18, col: '#9ab8d8', ph: rnd() * 6 }); }
      const wp = WD.points.wild = [{ key: 'leaveWild', x: WL.exit.x, z: WL.exit.z, r: 2.2, walk: 1 }];
      for (const g of WL.gates) wp.push({ key: 'portal', k: g.k, x: g.x, z: g.z, r: 2.0, walk: 1 });
      for (const w of WL.ways) wp.push({ key: 'way', i: w.i, x: w.x, z: w.z, r: 3.2, label: 'WAYSHRINE', col: '#9ad8ff' });
      wp.push({ key: 'map', x: WL.camp0.x + 3.5, z: WL.camp0.z - 3.5, r: 2.6, label: 'MAP', col: '#9ad8a0' });
    }
    // ================================================================ THE RAID ARENA (Boss Raids)
    function buildRaid() {
      seed(77); const ax = W.RAIDA.x, az = W.RAIDA.z, D = DYN.raid, r = W.RAIDA.r; aoKey = 'raid';
      for (let i = 0; i < 48; i++) { const a0 = i / 48 * TAU, a1 = (i + 1) / 48 * TAU; aoStrip(ax + Math.sin(a0) * (r + 0.6), az + Math.cos(a0) * (r + 0.6), ax + Math.sin(a1) * (r + 0.6), az + Math.cos(a1) * (r + 0.6), -Math.sin(a0), -Math.cos(a0), 1.8); }
      groundTiles(ax, az, 72, '#0e0a10', 'rock');
      S(G.disc(r + 1, 64, 0.03, 1), T(ax, 0, az), '#2a2430', 'cobble'); S(G.disc(r * 0.55, 48, 0.045, 1), T(ax, 0, az), '#221c28', 'tile');
      D.push({ k: 'bossRune', x: ax, z: az, r: r * 0.5, col: '#ff2a3a', always: 1 });
      // the ring wall and stepped stands
      for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, x = ax + Math.sin(a) * (r + 1.2), z = az + Math.cos(a) * (r + 1.2); P(BX, x, 1.6, z, a, (r + 1.2) * TAU / 48 + 0.2, 3.2, 1.2, '#2a2430', 'brick'); }
      for (let t = 0; t < 3; t++) for (let i = 0; i < 56; i++) { const a = i / 56 * TAU, rr2 = r + 3 + t * 2.4, x = ax + Math.sin(a) * rr2, z = az + Math.cos(a) * rr2; P(BX, x, 3.6 + t * 1.4, z, a, rr2 * TAU / 56 + 0.25, 1.4, 2.4, t % 2 ? '#1e1a22' : '#262028', 'rock'); }
      // eight pillars with hanging chains and braziers
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU, x = ax + Math.sin(a) * (r - 1.2), z = az + Math.cos(a) * (r - 1.2);
        P(BX, x, 3.5, z, a, 1.4, 7, 1.4, '#2e2834', 'brick'); P(BX, x, 7.2, z, a, 1.9, 0.5, 1.9, '#1a161e', 'rock'); P(BX, x, 0.3, z, a, 1.9, 0.6, 1.9, '#1a161e', 'rock'); rect(x, z, 1.4, 1.4, a, 7.5);
        torch(D, x - Math.sin(a) * 0.9, 4.4, z - Math.cos(a) * 0.9, '#ff3a2a', 1.3);
        for (let k = 0; k < 6; k++) P(BX, x - Math.sin(a) * 0.75, 6.8 - k * 0.32, z - Math.cos(a) * 0.75, a + k * 0.8, 0.12, 0.3, 0.06, '#3a3440', 'metal'); }
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; banner(D, ax + Math.sin(a) * (r + 0.55), 2.4, az + Math.cos(a) * (r + 0.55), a + Math.PI, 1.0, 2.6, i % 2 ? BAN_RED : BAN_BLACK); }
      const s = sign('BOSS RAID', 'Nobody respawns · win together or fall together', '#ff4a4a', 640, 150); signAt(D, s, ax, 7.6, az + r + 2.6, Math.PI, 5.6, 1.3);
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; D.push({ k: 'chainH', x: ax + Math.sin(a) * (r - 2.2), y: 7, z: az + Math.cos(a) * (r - 2.2), n: 8, ph: i }); }
      D.push({ k: 'shaft', x: ax, z: az - 4, w: 5, h: 18, col: '#ff5a6a', ph: 1 });
      WD.points.raid = []; aoKey = null;
    }
    // windows, banners and the warm glow under every torch never move: merge each zone's into a few meshes (fewer draw calls)
    const MERGED = {};
    // lights: every torch, candle, lava pool, crystal, portal... in a zone becomes a point light (the engine uses the nearest few)
    const LIGHTS = WD.LIGHTS = {};
    function lightOf(d) {
      switch (d.k) {
        case 'torch': return { x: d.x, y: d.y - 0.3, z: d.z, r: 7.5 + 1.5 * Math.min(1, (d.big || 1) - 1), i: 1.0, col: d.col, fl: 1.8 };
        case 'pool': return { x: d.x, y: 0.6, z: d.z, r: d.r * 1.6 + 2, i: 0.5, col: d.col, fl: 0.4 };
        case 'candle': return { x: d.x, y: d.y + 0.3, z: d.z, r: 4, i: 1.3, col: '#ff9a3a', fl: 1 };
        case 'furnace': return { x: d.x + Math.sin(d.yaw) * 1.2, y: d.y, z: d.z + Math.cos(d.yaw) * 1.2, r: 9, i: 1.5, col: '#ff6a1a', fl: 1 };
        case 'lava': return { x: d.x, y: (d.y || 0) + 0.7, z: d.z, r: d.r * 2 + 3, i: 1.3, col: '#ff5a1a', fl: 0.5 };
        case 'crystal': return { x: d.x, y: d.y + 0.4, z: d.z, r: 5, i: 0.75, col: d.col };
        case 'crystalF': return d.col === '#0a0a0a' ? null : { x: d.x, y: d.y, z: d.z, r: 4.5, i: 0.6, col: d.col };
        case 'shroom': return { x: d.x, y: d.y + 0.2, z: d.z, r: 3 + d.s * 2, i: 0.7, col: d.col };
        case 'rune': return { x: d.x, y: d.y, z: d.z, r: 4.5, i: 0.7, col: d.col };
        case 'eyeW': return { x: d.x, y: d.y, z: d.z, r: 3 + d.s * 2, i: 0.55, col: '#ff2a4a' };
        case 'portal': return { x: d.x + Math.sin(d.yaw || 0) * 1, y: d.y, z: d.z + Math.cos(d.yaw || 0) * 1, r: 8, i: 1.1, col: d.col, por: 1 };
        case 'orb': return { x: d.x, y: d.y, z: d.z, r: 7, i: 1.1, col: d.col };
        case 'relic': return { x: d.x, y: 1.4, z: d.z, r: 4, i: 0.8, col: '#1aff8a', relic: d.i };
        case 'lantern': return { x: d.x, y: 1.2, z: d.z, r: 3.2, i: 0.55, col: '#ffc86a', lantern: d.i, fl: 1.2 };
        case 'rod': return { x: d.x, y: d.y, z: d.z, r: 3.5, i: 0.6, col: '#8ab0ff' };
        case 'win': return { x: d.x + Math.sin(d.yaw || 0) * 0.8, y: d.y, z: d.z + Math.cos(d.yaw || 0) * 0.8, r: 5, i: 0.55, col: '#ff8a2a' };
      }
      return null;
    }
    function mergeZone(key) {
      const list = DYN[key], win = [], glow = [], ban = new Map(), BOXG = G.box(1, 1, 1, 0), Q = G.quad(1, 1), rest = [];
      LIGHTS[key] = list.map(lightOf).filter(Boolean);
      for (const d of list) {
        if (d.k === 'win') win.push(...G.xf(BOXG, T(d.x, d.y, d.z, d.yaw, 0, 0, d.w * 0.8, d.h * 0.8, 0.1)));
        else if (d.k === 'banner') { if (!ban.has(d.tex)) ban.set(d.tex, []); ban.get(d.tex).push(...G.xf(Q, T(d.x, d.y, d.z, d.yaw, 0, 0, d.w, d.h, 1))); d.merged = 1; rest.push(d); }
        else { if (d.k === 'torch' || d.k === 'furnace' || d.k === 'candle') { const c = M.hex(d.k === 'candle' ? '#ff9a3a' : d.col || '#ff6a1a').map(v => v * 0.999), s = d.k === 'candle' ? 2.2 : d.k === 'furnace' ? 7 : 4 * d.big;
            const fx = d.k === 'furnace' ? Math.sin(d.yaw) * 2 : 0, fz = d.k === 'furnace' ? Math.cos(d.yaw) * 2 : 0;
            glow.push(...G.xf(Q, T(d.x + fx, 0.055 + glow.length * 1e-7, d.z + fz, 0, -Math.PI / 2, 0, s, s, 1), c)); }
          rest.push(d); }
      }
      DYN[key] = rest;
      MERGED[key] = { win: win.length ? E.mesh(win) : null, glow: glow.length ? E.mesh(glow) : null, ban: [...ban].map(([tex, g]) => ({ tex, m: E.mesh(g) })), ao: AOS[key] && AOS[key].length ? E.mesh(AOS[key]) : null }; delete AOS[key];
    }
    WD.build = function () {
      buildHub(); for (let i = 0; i < L.ND; i++) { const k = PAL_K[thOf(i).n] || [0.35, 1.08]; PAL = VIVID(k[0], k[1]); buildDungeon(i); } PAL = null; buildArena(); buildRaid(); buildWild();
      for (const key in DYN) mergeZone(key);
      E.buildStatic();
      // hub interaction points: stations (press E), portals (walk in)
      const hp = WD.points.hub = [];
      for (const key in W.STN) { const q = W.STN[key]; hp.push({ key, x: q.x, z: q.z, r: 3.0, label: q.l, col: q.c }); }
      W.PORTALS.forEach(p => hp.push({ key: 'portal', k: p.k, x: p.x, z: p.z, y: p.y || 0, r: 1.9, walk: 1 }));
      hp.push({ key: 'wilds', x: W.ANNEX.x0 + 2.5, z: W.WEST_GATE.z, r: 2.2, walk: 1 });
      hp.push({ key: 'map', x: (W.ANNEX.x0 + W.ANNEX.x1) / 2 + 4, z: W.WEST_GATE.z - 5.5, r: 2.8, label: 'MAP TABLE', col: '#9ad8a0' });
      hp.push({ key: 'lanterns', x: W.ANNEX.x0 + 6, z: W.ANNEX.z1 - 8.5, r: 3, label: 'LAMPLIGHTER', col: '#ffd88a' });
      WD.ready = true;
    };
    WD.zoneKey = z => z.t === 'hub' ? 'hub' : z.t === 'dun' ? 'd' + z.k : z.t;
    // the lights near you this frame (V: {zone, t, P, s, run})
    WD.lights = function (V, out) {
      const list = LIGHTS[WD.zoneKey(V.zone)]; if (!list) return; const fx = V.P ? V.P.x : V.eye[0], fz = V.P ? V.P.z : V.eye[2], R2 = 60 * 60, t = V.t, s = V.s;
      for (const l of list) { const dx = l.x - fx, dz = l.z - fz; if (dx * dx + dz * dz > R2) continue; if (l.relic !== undefined && s && s.relics.includes(l.relic)) continue; if (l.lantern !== undefined && (E.quality === 'low' || (s && (s.lanterns || []).includes(l.lantern)))) continue;
        const f = l.fl ? 1 + (Math.sin(t * 17 + l.x) * 0.08 + Math.sin(t * 29 + l.z) * 0.05 + Math.sin(t * 6.3 + l.x * 0.7) * 0.06) * l.fl : 1;
        out.push({ x: l.x, y: l.y, z: l.z, r: l.r, i: l.i * f, col: l.col }); }
      // the open gate you should go through glows gold; the treasure chest glows when the boss is dead
      const run = V.run; if (run && run.mode === 'dungeon' && V.zone.t === 'dun' && WD.gates[run.i]) { const g = WD.gates[run.i].find(q => q.k === run.nextGate); if (g) out.push({ x: g.x + g.dx, y: 2.5, z: g.z + g.dz, r: 7, i: 0.8 + Math.sin(t * 4) * 0.25, col: '#ffd84a' });
        if (run.cleared) { const lt = W.layout(run.i).rooms[W.layout(run.i).loot]; out.push({ x: lt.x, y: 2, z: lt.z, r: 8, i: 1.2, col: '#ffd84a' }); } }
    };

    // ================================================================ LIGHTING PER ZONE
    // Update 7: Duskhold at dusk (reference photo 10): a low warm sun, a deep blue sky with lit clouds and an orange horizon, warm windows
    // Update 7 · Duskhold in soft afternoon daylight (reference photo 04): a blue sky with big clouds, a cool blue haze on the far hills, warm sun
    const HUB_LIGHT = { sunCol: [1.3, 1.02, 0.74], skyCol: [0.38, 0.46, 0.6], gndCol: [0.15, 0.17, 0.1], fog: [0.48, 0.56, 0.66], skyTop: [0.24, 0.4, 0.68], skyHor: [0.78, 0.74, 0.68], stars: false, sun: [0.62, 0.3, 0.45],
      look: { sky: { kind: 9, a: [0.95, 0.92, 0.88], b: [0.46, 0.52, 0.64], moon: 0.035, moonCol: [1.0, 0.86, 0.66] }, grade: { expo: 1.0, sat: 0.96, con: 1.14, lift: [0.0, 0.006, 0.02], gain: [1.03, 1.0, 0.95], vig: 0.48, vigCol: [0.01, 0.015, 0.03], bloom: 0.42 }, rim: [0.95, 0.78, 0.6], mist: { col: [0.48, 0.56, 0.66], h: 3.2, k: 0.34 }, haze: 1.1, toon: 0.2, farK: 1.6, win: 1.8, mat: { cobble: { wet: 0.12 } } } };
    const RAID_LIGHT = { sunCol: [0.95, 0.6, 0.7], skyCol: [0.34, 0.16, 0.26], gndCol: [0.16, 0.05, 0.08], fog: [0.06, 0.02, 0.04], skyTop: [0.015, 0.0, 0.01], skyHor: [0.12, 0.03, 0.06], stars: true, sun: [-0.3, 0.7, 0.4],
      look: { sky: { kind: 5, a: [0.4, 0.03, 0.08], moon: 0.11, moonCol: [1.0, 0.2, 0.15] }, grade: { expo: 1.08, sat: 1.1, con: 1.1, lift: [0.03, 0, 0.015], gain: [1.05, 0.95, 0.98], vig: 0.72, vigCol: [0.06, 0, 0.02], bloom: 0.8 }, rim: [1.0, 0.3, 0.45], mist: { col: [0.12, 0.02, 0.05], h: 1.1, k: 0.45 }, haze: 1.0, mat: { cobble: { wet: 0.4 } } } };
    const ARENA_LIGHT = { sunCol: [1.0, 0.72, 0.68], skyCol: [0.42, 0.26, 0.3], gndCol: [0.22, 0.1, 0.1], fog: [0.09, 0.04, 0.05], skyTop: [0.03, 0.01, 0.015], skyHor: [0.16, 0.05, 0.06], stars: true, sun: [0.3, 0.75, 0.4],
      look: { sky: { kind: 6, a: [0.14, 0.05, 0.05], b: [0.8, 0.25, 0.08], moon: 0.07, moonCol: [1.0, 0.45, 0.25] }, grade: { expo: 1.06, sat: 1.12, con: 1.08, lift: [0.03, 0.005, 0], gain: [1.06, 0.97, 0.92], vig: 0.65, vigCol: [0.05, 0.01, 0], bloom: 0.7 }, rim: [1.0, 0.5, 0.35], mist: { col: [0.16, 0.07, 0.05], h: 1.0, k: 0.3 }, haze: 1.0, mat: {} } };
    const WILD_LIGHT = { sunCol: [1.4, 1.26, 1.0], skyCol: [0.54, 0.66, 0.8], gndCol: [0.26, 0.32, 0.16], fog: [0.6, 0.7, 0.78], skyTop: [0.15, 0.36, 0.7], skyHor: [0.8, 0.88, 0.92], stars: false, sun: [-0.5, 0.66, -0.5],
      look: { sky: { kind: 9, a: [1.0, 0.99, 0.95], b: [0.58, 0.66, 0.78], moon: 0.045, moonCol: [1.0, 0.95, 0.8] }, grade: { expo: 1.1, sat: 1.24, con: 1.06, lift: [0.0, 0.012, 0.02], gain: [1.0, 1.03, 0.96], vig: 0.3, vigCol: [0, 0.01, 0.03], bloom: 0.5 }, rim: [0.8, 0.9, 0.7], mist: { col: [0.6, 0.7, 0.75], h: 1.6, k: 0.25 }, haze: 0.85, toon: 0.5, mat: {} } };
    const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); }, MOON_DIR = norm([-0.47, 0.53, -0.71]);
    let flash = 0;
    WD.light = function (zone, t, dt) {
      const th = zone.t === 'dun' ? thOf(zone.k) : null, L0 = th ? th.light : zone.t === 'arena' ? ARENA_LIGHT : zone.t === 'raid' ? RAID_LIGHT : zone.t === 'wild' ? WILD_LIGHT : HUB_LIGHT;
      const o = Object.assign({}, L0, { sun: norm(L0.sun) }), lk = (th ? th.look : L0.look) || {};
      o.grade = lk.grade ? Object.assign({}, lk.grade, { sat: Math.min(lk.grade.sat || 1, 1.0) * 0.94, bloom: (lk.grade.bloom || 0) * 0.7 }) : lk.grade; o.rimCol = lk.rim;   // Update 7 (feedback): calmer colour o.mist = lk.mist; o.haze = lk.haze; o.mat = lk.mat; o.toon = lk.toon || 0; o.flash = 0; o.farK = th ? 1.3 : lk.farK || 1;   // Update 7: the bigger dungeon maps see further (not on Low)
      o.sky = Object.assign({ moonDir: MOON_DIR }, lk.sky || {});
      // with real torchlight on, the moonlight in dungeons is dimmer so the torches make pools of light (dark between them, warm under them)
      if (th && !E.noLights && !(o.sky && (o.sky.kind === 9 || o.sky.kind === 10))) { const k = 0.9; o.sunCol = o.sunCol.map(c => c * k); o.skyCol = o.skyCol.map(c => c * k); o.gndCol = o.gndCol.map(c => c * k); }
      if (th && th.n === 'storm') { // lightning flashes in the Storm Spire
        flash = Math.max(0, flash - dt * 3); if (Math.random() < dt * 0.25) { flash = 1; WD.onThunder && WD.onThunder(); }
        if (flash > 0) { const f = flash * (0.6 + Math.random() * 0.4); o.sunCol = o.sunCol.map(c => c + f * 1.4); o.skyHor = o.skyHor.map(c => c + f * 0.35); o.skyCol = o.skyCol.map(c => c + f * 0.5); o.flash = f; o.flashCol = [f * 0.25, f * 0.28, f * 0.4]; }
      }
      return o;
    };

    // ================================================================ LEADERBOARD TABLETS
    const boards = [0, 1, 2].map(() => ({ c: canvas(512, 768, () => {}), t: null }));
    boards.forEach(b => { b.t = E.canvasTex(b.c); });
    let boardData = null;
    function paintBoards() {
      const titles = ['THIS WEEK', 'ALL TIME', 'THE PIT'], subs = ['slimes slain', 'level', 'best wave'];
      boards.forEach((b, i) => {
        const g = b.c.getContext('2d'), w = 512, h = 768; g.clearRect(0, 0, w, h);
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1c1a22'); gr.addColorStop(1, '#0c0b10'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#6a5636'; g.lineWidth = 10; g.strokeRect(6, 6, w - 12, h - 12); g.strokeStyle = '#2a2014'; g.lineWidth = 2; g.strokeRect(18, 18, w - 36, h - 36);
        g.textAlign = 'center'; g.font = `900 52px ${FONT}`; const tg = g.createLinearGradient(0, 40, 0, 100); tg.addColorStop(0, '#f2dca0'); tg.addColorStop(1, '#a8823e'); g.fillStyle = tg; g.fillText(titles[i], w / 2, 88);
        g.font = `700 24px ${FONT}`; g.fillStyle = '#8a8296'; g.fillText(subs[i].toUpperCase(), w / 2, 122);
        g.fillStyle = '#5a4630'; g.fillRect(60, 140, w - 120, 3);
        const rows = boardData ? (i === 0 ? boardData.week : i === 1 ? boardData.all : boardData.arena) || [] : [];
        if (!rows.length) { g.font = `600 26px ${FONT}`; g.fillStyle = '#6a6474'; g.fillText(boardData ? 'No slayers yet' : 'Offline', w / 2, 300); }
        rows.slice(0, 10).forEach((r, j) => { const y = 190 + j * 56;
          g.textAlign = 'left'; g.font = `900 30px ${FONT}`; g.fillStyle = j === 0 ? '#ffd84a' : j === 1 ? '#d8d8e2' : j === 2 ? '#d8945a' : '#8a8494'; g.fillText((j + 1) + '.', 40, y);
          g.font = `800 30px ${FONT}`; g.fillStyle = '#e8e2f0'; let nm = String(r[0]); while (g.measureText(nm).width > 270 && nm.length > 3) nm = nm.slice(0, -1); g.fillText(nm, 92, y);
          g.textAlign = 'right'; g.fillStyle = '#c9a45a'; g.fillText(L.fmt(r[1]), w - 40, y); });
        E.updateCanvasTex(b.t, b.c);
      });
    }
    paintBoards();
    WD.board = b => { boardData = b; paintBoards(); };

    // ================================================================ PER-FRAME DRAWING
    const statueLook = CH.look({ outfit: 'knight', skin: '#55545c', shirt: '#4e4d56', pants: '#4a4952', shoes: '#4a4952', gear1: '#5c5b64', gear2: '#45444c', glow: '#22222a', cape: '#45444c', cape2: '#55545c', wpn: 'greatsword', weapon: '#605f68', gem: '#55545c', hairC: '#4a4a52' });
    const statuePose = Object.assign(CH.pose('victory', 3), { face: 'serious' });
    const mannequinLooks = { coat: CH.look({ outfit: 'coat', skin: '#3a2e24', eye: '#3a2e24', hairC: '#3a2e24', hair: 'messy', shirt: '#1a1a20', pants: '#15151a', shoes: '#141418', gear1: '#2e221a', gear2: '#5a1018' }),
      knight: CH.look({ outfit: 'knight', skin: '#3a2e24', gear1: '#2f333c', gear2: '#5a0a12', glow: '#ff2a2a', cape: '#16121a', cape2: '#72560f', shirt: '#121216', pants: '#121216', shoes: '#2f333c' }),
      plate: CH.look({ outfit: 'plate', helm: 'helm', skin: '#3a2e24', gear1: '#3a3236', gear2: '#6a4a2a', hc1: '#3a3236', hc2: '#6a4a2a', glow: '#ff7a1a', shirt: '#121216', pants: '#121216', shoes: '#2f2a2c',
        glove: 'gauntlet', gc1: '#3a3236', gc2: '#6a4a2a', boot: 'greaves', bc1: '#3a3236', bc2: '#6a4a2a' }) };
    const mannequinPose = Object.assign(CH.pose('idle', 0), { r_o: 0.32, l_o: 0.32, r_e: 0.1, l_e: 0.1 });
    const chest = (() => { const b = G.box(1.6, 0.9, 1.0, 0.06), lid = G.cyl(0.5, 0.5, 1.6, 12);
      return { base: E.mesh(b), lid: E.mesh(G.xf(lid, T(0, 0, 0, 0, 0, Math.PI / 2, 1, 1, 1))), band: E.mesh(G.box(0.12, 1.0, 1.06, 0)) }; })();
    WD.chest = chest;
    const tmp = new Float32Array(16);
    const chainLink = E.mesh(G.xf(G.torus(0.09, 0.028, 10, 5), T(0, 0, 0, 0, 0, Math.PI / 2, 1, 1.7, 1))), chainHook = E.mesh(G.merge(G.xf(G.torus(0.14, 0.035, 12, 5), T(0, 0, 0, 0, Math.PI / 2, 0, 1, 1, 1)), G.xf(G.cyl(0, 0.07, 0.3, 5), T(0.14, -0.15, 0, 0, Math.PI, 0, 1, 1, 1))));
    function drawChest(x, y, z, yaw, open, glow, col) {
      E.draw(chest.base, T(x, y + 0.45, z, yaw), col || '#3a2414', { soft: 1, tex: 'wood', texMode: 1 });
      for (const sd of [-0.55, 0.55]) E.draw(chest.band, T(x + Math.cos(yaw) * sd, y + 0.47, z - Math.sin(yaw) * sd, yaw), '#6a5a3a', { spec: 0.8 });
      const lidA = -open * 1.6, hx = -Math.sin(yaw) * 0.5, hz = -Math.cos(yaw) * 0.5;
      E.draw(chest.lid, M.mul(T(x + hx, y + 0.9, z + hz, yaw, lidA, 0), T(0, 0, 0.5, 0, 0, 0, 1, 0.55, 1), tmp), col || '#3a2414', { soft: 1, tex: 'wood', texMode: 1 });
      if (glow) E.draw(ms.quad, T(x, y + 1.2, z, yaw, 0, 0, 2.6, 2.6, 1), glow, { tex: glowTex, mode: 3, add: true, alpha: 0.5, depthWrite: false, noShadow: true });
    }
    WD.drawChest = drawChest;
    function decal(x, y, z, s, col, a, tex) { E.draw(ms.quad, T(x, y, z, 0, -Math.PI / 2, 0, s, s, 1), col, { tex: tex || glowTex, mode: 3, add: true, alpha: a, depthWrite: false, noShadow: true, cull: false }); }
    WD.decal = decal;
    const hsl2rgb = WD.hsl2rgb = h => { h = ((h % 360) + 360) % 360 / 60; const c = 1, x = c * (1 - Math.abs(h % 2 - 1)); const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]; return [r, g, b]; };
    const gateLift = {};
    const rackLooks = { sword: CH.look({ wpn: 'sword', weapon: '#8a8e98', gem: '#ff7a1a', wglow: '#ff7a1a' }), staff: CH.look({ wpn: 'staff', weapon: '#5a3a24', gem: '#7ad8ff', wglow: '#7ad8ff' }) };
    // V: {zone, t, dt, eye, s (state), parts, near, now, labels, run: {i, cleared, mine}}
    WD.draw = function (V) {
      const t = V.t, z0 = V.zone, list = DYN[WD.zoneKey(z0)] || [];
      const ex = V.eye[0], ez = V.eye[2], far2 = (E.far + 8) * (E.far + 8), low = E.quality === 'low', s = V.s, th = z0.t === 'dun' ? thOf(z0.k) : null;
      const MZ = MERGED[WD.zoneKey(z0)];
      if (MZ) { const I = M.ident();
        // Update 7: windows glow warm (brighter at night so they bloom; still lit at dusk and in the day)
        if (MZ.win) { const lk = th ? th.look : z0.t === 'hub' ? HUB_LIGHT.look : z0.t === 'wild' ? WILD_LIGHT.look : null, kind = lk && lk.sky ? lk.sky.kind : 0, nk = lk && lk.win ? lk.win : kind === 9 ? 0.55 : kind === 10 ? 1.05 : 1.5;
          E.draw(MZ.win, I, '#ffffff', { emis: nk, noShadow: true, tex: 'window', texMode: 1 }); }
        if (low) for (const b of MZ.ban) E.draw(b.m, I, '#a8a8b0', { tex: b.tex, texMode: 1, mode: 3, cull: false, noShadow: true });
        if (MZ.ao && !low) E.draw(MZ.ao, I, '#000000', { tex: aoTex, texMode: 1, mode: 3, alpha: E.quality === 'high' ? 0.42 : 0.55, depthWrite: false, noShadow: true, cull: false, bias: 500 });
        if (MZ.glow && !low) E.draw(MZ.glow, I, '#ffffff', { tex: glowTex, texMode: 1, mode: 3, add: true, alpha: z0.t === 'dun' ? 0.07 : 0.16, depthWrite: false, noShadow: true, cull: false }); }
      // skip things behind the camera or well outside the view (a wide cone with a margin), so busy places cost less
      const vtx = V.target ? V.target[0] - ex : 0, vtz = V.target ? V.target[2] - ez : -1, vl = Math.hypot(vtx, vtz) || 1, fwx = vtx / vl, fwz = vtz / vl;
      for (const d of list) {
        const dx = d.x === undefined ? 0 : d.x - ex, dz = d.z === undefined ? 0 : d.z - ez; if (d.x !== undefined && dx * dx + dz * dz > far2) continue;
        if (low && LOW_NEAR[d.k] && dx * dx + dz * dz > 2500) continue;   // on Low, small things far away are left out (flames, signs, smoke)
        if (d.x !== undefined && d.k !== 'shaft') { const fwd = dx * fwx + dz * fwz; if (fwd < -10 || Math.abs(dx * fwz - dz * fwx) > fwd * 1.25 + 12) continue; }
        switch (d.k) {
          case 'torch': { const f = 1 + Math.sin(t * 17 + d.x) * 0.12 + Math.sin(t * 29 + d.z) * 0.08, b = d.big;
            E.draw(ms.flame, T(d.x, d.y + 0.12 * b * f, d.z, t * 2.1 + d.x, Math.sin(t * 9 + d.z) * 0.08, 0, 0.15 * b, 0.42 * f * b, 0.15 * b), d.col, { emis: 2.6, noShadow: true });
            E.draw(ms.flame, T(d.x, d.y + 0.08 * b, d.z, -t * 2.7, 0, 0, 0.08 * b, 0.26 * f * b, 0.08 * b), '#ffe0a0', { emis: 3, noShadow: true });
            if (!low && dx * dx + dz * dz < 1600) E.draw(ms.quad, T(d.x, d.y + 0.15, d.z, Math.atan2(ex - d.x, ez - d.z), 0, 0, 1.0 * b * f, 1.0 * b * f, 1), d.col, { tex: glowTex, mode: 3, add: true, alpha: z0.t === 'dun' ? 0.22 : 0.45, depthWrite: false, noShadow: true });
            if (V.parts && Math.random() < (low ? 0.08 : 0.2)) E.particle({ x: d.x + (Math.random() - 0.5) * 0.2, y: d.y + 0.1, z: d.z + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 0.4, vy: 1.2 + Math.random(), vz: (Math.random() - 0.5) * 0.4, life: 0.7, size: 0.12 * b, col: Math.random() < 0.5 ? d.col : '#ffd25a', add: true });
            break; }
          case 'win': E.draw(ms.box, T(d.x, d.y, d.z, d.yaw, 0, 0, d.w * 0.8, d.h * 0.8, 0.1), '#ff8a2a', { emis: 0.85 + Math.sin(t * 3 + d.x) * 0.1, noShadow: true }); break;
          case 'banner': if (low && d.merged) break; if (dx * dx + dz * dz > 2500) { if (d.merged) E.draw(ms.quad, T(d.x, d.y, d.z, d.yaw, 0, 0, d.w, d.h, 1), '#a8a8b0', { tex: d.tex, texMode: 1, mode: 3, cull: false, noShadow: true }); break; }
            { const gust = Math.sin(t * 0.7 + d.x * 0.3) * 0.5 + 0.5, fl = Math.sin(t * 2.3 + d.z) * (0.04 + gust * 0.06), py = Math.sin(t * 1.7 + d.x) * (0.05 + gust * 0.08);
              E.draw(ms.quad, M.mul(T(d.x, d.y + d.h / 2, d.z, d.yaw, py, fl), T(0, -d.h / 2, Math.abs(py) * 0.2, 0, 0, 0, d.w, d.h * (1 - gust * 0.02), 1), tmp), '#a8a8b0', { tex: d.tex, texMode: 1, mode: 3, cull: false, noShadow: true }); } break;
          case 'shaft': if (low || dx * dx + dz * dz > 2200) break; { const fl = 0.8 + 0.2 * Math.sin(t * 0.6 + d.ph) + 0.08 * Math.sin(t * 2.3 + d.ph * 2), sun = V.sun || MOON_DIR, ly = Math.atan2(sun[0], sun[2]);
              E.draw(shaftM, T(d.x, 0, d.z, ly, -0.32, 0, d.w, d.h, d.w), d.col, { tex: shaftTex, texMode: 1, mode: 3, add: true, alpha: 0.17 * fl, depthWrite: false, noShadow: true, cull: false });
              decal(d.x, 0.05, d.z, d.w * 2.4, d.col, 0.1 * fl);
              if (V.parts && Math.random() < 0.25) E.particle({ x: d.x + (Math.random() - 0.5) * d.w * 0.8, y: Math.random() * 5, z: d.z + (Math.random() - 0.5) * d.w * 0.8, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.1, vz: (Math.random() - 0.5) * 0.15, life: 4, size: 0.05, col: d.col, add: true, a: 0.8 }); } break;
          case 'chainH': if (dx * dx + dz * dz > 1600) break; { const sw = Math.sin(t * 0.9 + d.ph) * (d.small ? 0.06 : 0.12), sw2 = Math.cos(t * 0.7 + d.ph) * 0.05, n = d.n, L0 = d.small ? 0.26 : 0.34;
              for (let j = 0; j < n; j++) { const yy = d.y - (j + 0.5) * L0; E.draw(chainLink, T(d.x + Math.sin(sw) * (j + 0.5) * L0, yy, d.z + Math.sin(sw2) * (j + 0.5) * L0, j % 2 ? Math.PI / 2 : 0, sw2, sw, d.small ? 0.8 : 1, 1, 1), '#2a262e', { spec: 0.9, noShadow: low, rim: 0.4 }); }
              if (!d.small) { const yy = d.y - n * L0 - 0.2; E.draw(chainHook, T(d.x + Math.sin(sw) * n * L0, yy, d.z + Math.sin(sw2) * n * L0, 0, sw2, sw, 1, 1, 1), '#3a343e', { spec: 0.9, noShadow: low, rim: 0.4 }); } } break;
          case 'drip': { const per = d.every, k = ((t + d.ph) % per) / per, fall = 0.55; if (dx * dx + dz * dz > 900) break;
              if (k < fall) { const y = (WALL_H + 0.2) * (1 - (k / fall) ** 2); E.draw(ms.sph, T(d.x, y, d.z, 0, 0, 0, 0.04, 0.09, 0.04), '#9ab8e8', { emis: 0.6, noShadow: true, spec: 1 }); }
              else { const r = (k - fall) / (1 - fall); E.draw(ms.ring, T(d.x, 0.06, d.z, 0, 0, 0, 0.1 + r * 0.9, 1, 0.1 + r * 0.9), '#9ab8e8', { mode: 3, add: true, alpha: (1 - r) * 0.5, noShadow: true, depthWrite: false });
                if (V.parts && r < 0.06 && Math.random() < 0.5) for (let j = 0; j < 3; j++) E.particle({ x: d.x, y: 0.05, z: d.z, vx: (Math.random() - 0.5) * 1.2, vy: 1.4 + Math.random(), vz: (Math.random() - 0.5) * 1.2, life: 0.35, size: 0.04, col: '#bcd4ff', g: 9 }); } } break;
          case 'sign': if (z0.t === 'dun' && d.nx !== undefined && V.P && (V.P.x - d.x) * d.nx + (V.P.z - d.z) * d.nz < 0.4) break; E.draw(ms.quad, T(d.x, d.y, d.z, d.yaw, 0, 0, d.w, d.h, 1), '#ffffff', { tex: d.s.t, texMode: 1, mode: 3, noShadow: true }); break;
          case 'portal': { const locked = d.dk !== undefined && s && !L.dunUnlocked(s, d.dk), shut = d.home === 2 && !(V.run && V.run.cleared), col = locked || shut ? '#3a3a44' : d.col;
            E.draw(ms.disc, T(d.x, d.y, d.z, d.yaw, Math.PI / 2, 0, d.r, d.r, d.r), col, { mode: 4, alpha: locked || shut ? 0.5 : 0.92, noShadow: true, cull: false });
            if (!low && !locked && !shut) decal(d.x + Math.sin(d.yaw) * 1.5, 0.08, d.z + Math.cos(d.yaw) * 1.5, 7, col, 0.22);
            if (locked) { E.draw(ms.box, T(d.x + Math.sin(d.yaw) * 0.15, d.y, d.z + Math.cos(d.yaw) * 0.15, d.yaw, 0, 0.785, 4.4, 0.12, 0.1), '#24222a', { spec: 1 }); E.draw(ms.box, T(d.x + Math.sin(d.yaw) * 0.15, d.y, d.z + Math.cos(d.yaw) * 0.15, d.yaw, 0, -0.785, 4.4, 0.12, 0.1), '#24222a', { spec: 1 });
              E.draw(ms.box, T(d.x + Math.sin(d.yaw) * 0.3, d.y - 0.1, d.z + Math.cos(d.yaw) * 0.3, d.yaw, 0, 0, 0.7, 0.6, 0.25), '#5a4a2a', { spec: 1 }); }
            else if (!shut && V.parts && Math.random() < 0.6) { const a = Math.random() * TAU, rr = d.r * (0.4 + Math.random() * 0.6), c = Math.cos(d.yaw), sn = Math.sin(d.yaw);
              E.particle({ x: d.x + c * Math.cos(a) * rr, y: d.y + Math.sin(a) * rr, z: d.z - sn * Math.cos(a) * rr, vx: Math.sin(d.yaw) * 1.2, vy: 0.3, vz: Math.cos(d.yaw) * 1.2, life: 0.9, size: 0.14, col, add: true }); }
            break; }
          case 'glitchPortal': { const on = true; E.draw(ms.disc, T(d.x, d.y, d.z, d.yaw, Math.PI / 2, 0, 2.6, 2.6, 2.6), on ? '#1aff8a' : '#0a2a18', { mode: 4, alpha: on ? 0.9 : 0.25 + (Math.random() < 0.05 ? 0.4 : 0), noShadow: true, cull: false }); break; }
          case 'furnace': { const f = 0.8 + Math.sin(t * 9 + d.x) * 0.15 + Math.random() * 0.1; E.draw(ms.quad, T(d.x, d.y, d.z, d.yaw, 0, 0, 1.3, 1.2, 1), '#ff6a1a', { emis: 2.2 * f, noShadow: true });
            if (V.parts && Math.random() < 0.3) E.particle({ x: d.x, y: d.y, z: d.z, vx: Math.sin(d.yaw) * 1.5 + (Math.random() - 0.5), vy: 1.5 + Math.random() * 2, vz: Math.cos(d.yaw) * 1.5 + (Math.random() - 0.5), life: 1, size: 0.08, col: '#ffb03a', add: true, g: -1 }); break; }
          case 'smoke': if (V.parts && Math.random() < 0.25) E.particle({ x: d.x + (Math.random() - 0.5) * 0.6, y: d.y, z: d.z + (Math.random() - 0.5) * 0.6, vx: 0.4, vy: 1.4, vz: 0.1, life: 3.5, size: 1.1, grow: 2.2, col: '#2a2830', a: 0.45 }); break;
          case 'water': E.draw(ms.boxS, T(d.x, d.y, d.z, 0, 0, 0, d.w, 0.04, d.d), '#5f7c88', { mode: 1, alpha: 0.88, emis: 0.12, spec: 1, noShadow: true }); break;
          case 'fall': { const hh = d.y1 - d.y0; E.draw(ms.boxS, T(d.x, d.y0 + hh / 2, d.z, 0, 0, 0, d.w, hh, 0.3), '#c4d4dc', { mode: 1, alpha: 0.78, emis: 0.12, spec: 1, noShadow: true });
            if (V.parts && Math.random() < 0.6) E.particle({ x: d.x + (Math.random() - 0.5) * d.w, y: d.y0 + 0.3, z: d.z + 0.6, vx: (Math.random() - 0.5) * 1.5, vy: 1.6 + Math.random() * 1.5, vz: 1.2 + Math.random(), life: 1.4, size: 1.2, grow: 1.6, col: '#f2faff', a: 0.5, drag: 1 }); break; }
          case 'glowRing': E.draw(ms.cyl, T(d.x, d.y, d.z, 0, 0, 0, d.r, 0.18, d.r), d.col, { emis: 1.8 + Math.sin(t * 2 + d.y) * 0.4, noShadow: true }); break;
          case 'liquid': E.draw(ms.boxS, T(d.x, d.y, d.z, 0, 0, 0, d.w, 0.05, d.d), d.col, d.lava ? { mode: 2, noShadow: true } : { mode: 1, alpha: 0.9, emis: 0.1, spec: 1, noShadow: true }); break;
          case 'orb': { const y = d.y + Math.sin(t * 2) * 0.15, os = 0.42 * (d.s || 1); E.draw(ms.sph, T(d.x, y, d.z, 0, 0, 0, os, os, os), d.col, { emis: 2.4, noShadow: true });
            E.draw(ms.quad, T(d.x, y, d.z, Math.atan2(ex - d.x, ez - d.z), 0, 0, 2.6, 2.6, 1), d.col, { tex: glowTex, mode: 3, add: true, alpha: 0.6, depthWrite: false, noShadow: true });
            E.draw(ms.quad, T(d.x, 0.08, d.z, t * 0.4, -Math.PI / 2, 0, 3.2, 3.2, 1), d.col, { tex: runeTex, mode: 3, add: true, alpha: 0.5, depthWrite: false, noShadow: true, cull: false });
            for (let i = 0; i < 3; i++) { const a = t * 1.4 + i * TAU / 3; E.draw(ms.oct, T(d.x + Math.cos(a) * 0.9, y + Math.sin(t * 3 + i) * 0.2, d.z + Math.sin(a) * 0.9, t * 2, 0, 0, 0.09, 0.14, 0.09), d.col, { emis: 2, noShadow: true }); } break; }
          case 'mannequin': if (dx * dx + dz * dz < 700) { E.draw(ms.cyl, T(d.x, 0.08, d.z, 0, 0, 0, 0.5, 0.16, 0.5), '#2a2226', { tex: 'wood', texMode: 1 }); CH.draw(mannequinLooks[d.fit], mannequinPose, d.x, 0.16, d.z, d.yaw, { face: 'serious', parts: false }); } break;
          case 'rack': if (dx * dx + dz * dz < 700) { const lk = rackLooks[d.wpn], m = T(d.x, 1.15, d.z, d.yaw, -Math.PI / 2 + 0.25, 0, 1, 1, 1); E.draw(CH.weaponMesh(d.wpn, 'body'), m, lk.weapon, { soft: 1, col2: lk.gem, spec: 0.8 }); E.draw(CH.weaponMesh(d.wpn, 'glow'), m, lk.wglow, { soft: 1, emis: 2, noShadow: true }); } break;
          case 'questPapers': { const done = []; for (let i = 0; i < 3; i++) E.draw(ms.box, T(d.x - 1.1 + i * 1.1, d.y + (i % 2 ? 0.1 : -0.1), d.z, Math.PI, 0, (i - 1) * 0.06, 0.8, 1.05, 0.03), done[i] ? '#d8c890' : '#a89a78', { emis: done[i] ? 0.4 : 0, noShadow: true }); break; }
          case 'giftChest': { const ready = s && L.giftReady(s, V.now); drawChest(d.x, d.y, d.z, d.yaw, 0, ready ? '#ff4a6a' : null, '#2a1a14');
            if (ready && V.parts && Math.random() < 0.3) E.particle({ x: d.x + (Math.random() - 0.5) * 1.6, y: d.y + 1, z: d.z + (Math.random() - 0.5), vx: 0, vy: 0.8, vz: 0, life: 1, size: 0.1, col: '#ff8aa0', add: true }); break; }
          case 'pitGate': { for (let i = -2; i <= 2; i++) { const c = Math.cos(d.yaw), sn = Math.sin(d.yaw); E.draw(ms.boxS, T(d.x + c * i * 1.05, 3.2, d.z - sn * i * 1.05, d.yaw, 0, 0, 0.14, 6.2, 0.14), '#1a1418', { spec: 0.8 }); }
            for (const y of [1.5, 3.5, 5.5]) E.draw(ms.boxS, T(d.x, y, d.z, d.yaw, 0, 0, 5.4, 0.14, 0.14), '#1a1418', { spec: 0.8 });
            E.draw(ms.quad, T(d.x - Math.sin(d.yaw) * 0.4, 3, d.z - Math.cos(d.yaw) * 0.4, d.yaw, 0, 0, 5, 6, 1), '#ff2a1a', { tex: glowTex, mode: 3, add: true, alpha: 0.25 + Math.sin(t * 2) * 0.05, depthWrite: false, noShadow: true }); break; }
          case 'tablet': E.draw(ms.quad, T(d.x, d.y, d.z, d.yaw, 0, 0, 2.9, 4.3, 1), '#ffffff', { tex: boards[d.i].t, texMode: 1, mode: 3, noShadow: true }); break;
          case 'shroom': E.draw(ms.sph, T(d.x, d.y, d.z, 0, 0, 0, d.s * 0.55, d.s * 0.3, d.s * 0.55), d.col, { emis: 1.4, noShadow: true }); if (!low && d.s > 0.4) decal(d.x, 0.06, d.z, d.s * 6, d.col, 0.16); break;
          case 'candle': { const f = 1 + Math.sin(t * 13 + d.x) * 0.15; E.draw(ms.cyl, T(d.x, d.y, d.z, 0, 0, 0, 0.06, 0.25, 0.06), '#d8d0b8'); E.draw(ms.flame, T(d.x, d.y + 0.15, d.z, t, 0, 0, 0.04 * f, 0.14 * f, 0.04 * f), '#ffb04a', { emis: 3, noShadow: true }); break; }
          case 'pool': { const pf = 0.85 + Math.sin(t * 2 + d.x) * 0.1; E.draw(ms.disc, T(d.x, 0.07, d.z, 0, 0, 0, d.r, 1, d.r), d.col, { mode: 1, alpha: 0.85, emis: 0.55 * pf, spec: 1, noShadow: true }); if (!low) decal(d.x, 0.1, d.z, d.r * 2.6, d.col, 0.14 * pf);
            if (!low) for (let j = 0; j < 3; j++) { const ph = (t * 0.45 + j / 3 + d.x * 0.1) % 1, a = j * 2.1 + Math.floor(t * 0.45 + j / 3) * 1.7, rr = d.r * 0.6 * ((j * 0.37 + Math.floor(t * 0.45 + j / 3) * 0.61) % 1);
              E.draw(ms.ring, T(d.x + Math.cos(a) * rr, 0.1, d.z + Math.sin(a) * rr, 0, 0, 0, 0.15 + ph * 0.8, 1, 0.15 + ph * 0.8), d.col, { mode: 3, add: true, alpha: (1 - ph) * 0.45, noShadow: true, depthWrite: false });
              if (ph < 0.25) E.draw(ms.sph, T(d.x + Math.cos(a) * rr, 0.08 + ph * 0.4, d.z + Math.sin(a) * rr, 0, 0, 0, 0.12 * (1 - ph * 3), 0.1 * (1 - ph * 3), 0.12 * (1 - ph * 3)), d.col, { emis: 0.9, spec: 1, noShadow: true }); }
            if (V.parts && Math.random() < 0.1) E.particle({ x: d.x + (Math.random() - 0.5) * d.r, y: 0.2, z: d.z + (Math.random() - 0.5) * d.r, vx: 0, vy: 1.2, vz: 0, life: 1.2, size: 0.12, col: d.col, add: true }); break; }
          case 'lava': E.draw(ms.disc, T(d.x, (d.y || 0) + 0.07, d.z, 0, 0, 0, d.r, 1, d.r), '#ff5a1a', { mode: 2, noShadow: true }); if (!low && !d.y) decal(d.x, 0.1, d.z, d.r * 3, '#ff4a0a', 0.18); if (V.parts && Math.random() < 0.15) E.particle({ x: d.x + (Math.random() - 0.5) * d.r, y: 0.2, z: d.z + (Math.random() - 0.5) * d.r, vx: 0, vy: 2, vz: 0, life: 1.2, size: 0.12, col: '#ffb03a', add: true, g: 2 }); break;
          case 'crystal': E.draw(ms.oct, T(d.x, d.y + 0.3, d.z, t * 0.4, 0, 0, 0.4, 0.8, 0.4), d.col, { emis: 1.6, noShadow: true, alpha: 0.85 }); break;
          case 'rod': if (Math.random() < 0.004) { E.draw(ms.beam, T(d.x, d.y + 20, d.z, 0, 0, 0, 0.15, 40, 0.15), '#c8d8ff', { mode: 3, add: true, alpha: 1, noShadow: true }); } E.draw(ms.sph, T(d.x, d.y, d.z, 0, 0, 0, 0.18, 0.18, 0.18), '#8ab0ff', { emis: 2 + Math.sin(t * 7 + d.x) }); break;
          case 'float': { const y = d.y + Math.sin(t * 0.7 + d.ph) * 0.5; E.draw(ms.ico, T(d.x, y, d.z, t * 0.1 + d.ph, 0, 0, d.s, d.s * 0.6, d.s), '#2e3048', { tex: 'rock', texMode: 2 }); break; }
          case 'rune': E.draw(ms.quad, T(d.x, d.y, d.z, Math.atan2(ex - d.x, ez - d.z), 0, t * 0.5, 1.6, 1.6, 1), d.col, { tex: runeTex, mode: 3, add: true, alpha: 0.7, depthWrite: false, noShadow: true }); break;
          case 'crystalF': { const y = d.y + Math.sin(t + d.ph) * 0.4, glitch = th && th.n === 'glitch'; E.draw(glitch ? ms.boxS : ms.oct, T(d.x + (glitch && Math.random() < 0.03 ? (Math.random() - 0.5) : 0), y, d.z, t * 0.6 + d.ph, glitch ? d.ph : 0, 0, d.s * (glitch ? 0.8 : 0.4), d.s * (glitch ? 0.8 : 1), d.s * (glitch ? 0.8 : 0.4)), d.col, { emis: d.col === '#0a0a0a' ? 0 : 1.6, noShadow: true }); break; }
          case 'eyeW': { const blink = Math.sin(t * 0.7 + d.ph) > 0.97 ? 0.1 : 1, y = d.y + Math.sin(t + d.ph) * 0.1; E.draw(ms.sph, T(d.x, y, d.z, 0, 0, 0, d.s, d.s * blink, d.s), '#1a0408', { soft: 1 });
            E.draw(ms.sph, T(d.x + Math.sin(Math.atan2(ex - d.x, ez - d.z)) * d.s * 0.7, y, d.z + Math.cos(Math.atan2(ex - d.x, ez - d.z)) * d.s * 0.7, 0, 0, 0, d.s * 0.45, d.s * 0.45 * blink, d.s * 0.45), '#ff2a4a', { emis: 2, noShadow: true }); break; }
          case 'way': { const found = s && (s.ways || []).includes(d.i); E.draw(ms.quad, T(d.x, 0.22, d.z, t * 0.3, -Math.PI / 2, 0, 3.2, 3.2, 1), found ? '#5a6a7a' : '#9ad8ff', { tex: runeTex, mode: 3, add: true, alpha: found ? 0.12 : 0.4 + Math.sin(t * 2.5 + d.i) * 0.15, depthWrite: false, noShadow: true, cull: false });
            if (!found && V.parts && Math.random() < 0.15) E.particle({ x: d.x + (Math.random() - 0.5) * 1.2, y: 0.5 + Math.random() * 3, z: d.z + (Math.random() - 0.5) * 1.2, vx: 0, vy: 0.8, vz: 0, life: 1.2, size: 0.12, col: '#9ad8ff', add: true }); break; }
          case 'dais': E.draw(ms.quad, T(d.x, 0.205, d.z, t * 0.2, -Math.PI / 2, 0, d.r * 1.8, d.r * 1.8, 1), '#7affe8', { tex: runeTex, mode: 3, add: true, alpha: 0.32 + Math.sin(t * 2 + d.x) * 0.08, depthWrite: false, noShadow: true, cull: false }); break;
          case 'bossRune': { const run = V.run, on = (run && run.boss) || d.always; E.draw(ms.quad, T(d.x, 0.07, d.z, t * 0.15, -Math.PI / 2, 0, d.r * 2, d.r * 2, 1), d.col, { tex: runeTex, mode: 3, add: true, alpha: on ? 0.35 : 0.12, depthWrite: false, noShadow: true, cull: false }); break; }
          case 'gate': { const open = WD.gateOpen ? WD.gateOpen(d.i, d.h) : false, key = d.i + ':' + d.h; let lift = gateLift[key] || 0; lift += ((open ? 1 : 0) - lift) * Math.min(1, V.dt * 3); gateLift[key] = lift;
            const run = V.run, c = Math.cos(d.yaw || 0), sn = Math.sin(d.yaw || 0), gdx = d.dx || 0, gdz = d.dz === undefined ? -1 : d.dz;
            if (open && run && run.mode === 'dungeon' && run.i === d.i && run.nextGate === d.h) { const pulse = 0.65 + Math.sin(t * 4) * 0.35;
              E.draw(ms.quad, T(d.x, 2.6, d.z, Math.atan2(ex - d.x, ez - d.z), 0, 0, d.w * 0.9, 6, 1), '#ffd84a', { tex: glowTex, mode: 3, add: true, alpha: 0.28 * pulse, depthWrite: false, noShadow: true });
              for (let k = 0; k < 5; k++) { const f = (t * 0.7 + k / 5) % 1, dd = 0.8 + f * Math.max(2, (d.len || 10) - 1.6);
                E.draw(ms.quad, T(d.x + gdx * dd, 0.1 + k * 0.001, d.z + gdz * dd, Math.atan2(gdx, gdz) + Math.PI, -Math.PI / 2, 0, 2.2, 2.2, 1), '#ffd84a', { tex: arrowTex, mode: 3, add: true, alpha: (1 - Math.abs(f - 0.5) * 2) * 0.85, depthWrite: false, noShadow: true, cull: false }); } }
            const y = lift * (WALL_H - 0.6), n = Math.max(3, Math.round(d.w / 0.8)); if (lift > 0.98) break;
            for (let i = 0; i < n; i++) { const o = -d.w / 2 + (i + 0.5) * d.w / n; E.draw(ms.boxS, T(d.x + c * o, WALL_H / 2 + y, d.z - sn * o, d.yaw || 0, 0, 0, 0.16, WALL_H, 0.16), '#1a1418', { spec: 0.8 }); }
            for (const yy of [0.8, 2.4, 4.0]) E.draw(ms.boxS, T(d.x, yy + y, d.z, d.yaw || 0, 0, 0, d.w, 0.14, 0.18), '#1a1418', { spec: 0.8 });
            if (!open) E.draw(ms.quad, T(d.x - gdx * 0.3, 2.4, d.z - gdz * 0.3, d.yaw || 0, 0, 0, d.w, 4.6, 1), '#ff2a1a', { tex: glowTex, mode: 3, add: true, alpha: 0.12 + Math.sin(t * 3) * 0.04, depthWrite: false, noShadow: true, cull: false }); break; }
          case 'lootChest': { const run = V.run, open = run && run.cleared && run.i === d.i; drawChest(d.x, 0, d.z, 0, open ? Math.min(1, (run.openT || 0) * 2) : 0, open ? null : run && run.i === d.i ? '#ffd84a' : null, '#3a2414');
            if (open && V.parts && Math.random() < 0.6) E.particle({ x: d.x + (Math.random() - 0.5), y: 1.1, z: d.z, vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 2, vz: (Math.random() - 0.5) * 2, life: 1, size: 0.12, col: Math.random() < 0.5 ? '#ffd84a' : '#ffffff', add: true, g: 4 }); break; }
          case 'relic': if (s && !s.relics.includes(d.i)) { const y = 1.3 + Math.sin(t * 2) * 0.2;
            E.draw(ms.oct, T(d.x, y, d.z, t * 1.5, 0, 0, 0.35, 0.6, 0.35), '#1aff8a', { emis: 2.2, noShadow: true }); E.draw(ms.quad, T(d.x, y, d.z, Math.atan2(ex - d.x, ez - d.z), 0, 0, 2.2, 2.2, 1), '#1aff8a', { tex: glowTex, mode: 3, add: true, alpha: 0.5, depthWrite: false, noShadow: true });
            if (V.parts && Math.random() < 0.2) E.particle({ x: d.x, y, z: d.z, vx: (Math.random() - 0.5), vy: 0.8, vz: (Math.random() - 0.5), life: 1, size: 0.1, col: '#7affb8', add: true }); } break;
          case 'lantern': if (s && !(s.lanterns || []).includes(d.i)) { const sw = Math.sin(t * 1.3 + d.i) * 0.08;
            E.draw(ms.oct, T(d.x, 0.5, d.z, t * 0.4, 0, 0, 0.18, 0.26, 0.18), '#ffc86a', { emis: 1.8 + Math.sin(t * 9 + d.i) * 0.3, noShadow: true }); if (E.quality === 'low') break;
            E.draw(ms.boxS || ms.oct, T(d.x, 0.45, d.z, sw, 0, 0, 0.32, 0.5, 0.32), '#2a2018', { spec: 0.6 }); E.draw(ms.quad, T(d.x, 0.55, d.z, Math.atan2(ex - d.x, ez - d.z), 0, 0, 1.4, 1.4, 1), '#ffc86a', { tex: glowTex, mode: 3, add: true, alpha: 0.35, depthWrite: false, noShadow: true }); } break;
          case 'lanternTower': { const n = s ? (s.lanterns || []).length : 0; for (let j = 0; j < L.ND; j++) { const a = j / L.ND * TAU + 0.3, on = j < n; if (!on && E.quality === 'low') break;
              E.draw(ms.oct, T(d.x + Math.sin(a) * 2.2, d.y - 2.4, d.z + Math.cos(a) * 2.2, a, 0, 0, 0.22, 0.32, 0.22), on ? '#ffc86a' : '#2a2420', on ? { emis: 2.2, noShadow: true } : { spec: 0.3 }); } break; }
          case 'gateDark': E.draw(ms.quad, T(d.x, 2.6, d.z, d.yaw, 0, 0, 3.6, 4.8, 1), '#050306', { mode: 3, noShadow: true }); break;
          case 'puddle': if (!low) decal(d.x, 0.05, d.z, 2.6, '#6a8aaa', 0.1 + Math.sin(t * 1.5 + d.x) * 0.04); break;
          case 'crack': decal(d.x, 0.06, d.z, 3.2, '#ff4a0a', 0.22 + Math.sin(t * 2 + d.x) * 0.08); break;
          case 'floorRune': E.draw(ms.quad, T(d.x, (d.y || 0) + 0.06, d.z, t * 0.2 + d.x, -Math.PI / 2, 0, d.r * 2, d.r * 2, 1), d.col, { tex: runeTex, mode: 3, add: true, alpha: 0.32, depthWrite: false, noShadow: true, cull: false }); break;
        }
      }
      // statue in the hub centre
      if (z0.t === 'hub') { const d2 = ex * ex + ez * ez; if (d2 < far2) CH.draw(statueLook, statuePose, 0, 1.71, 0, 0, { face: 'serious', parts: false }); }
      // station pads: glowing rings
      if (z0.t === 'hub') for (const key in W.STN) { const q = W.STN[key], near = V.near === key; decal(q.x, 0.07, q.z, near ? 5.6 : 5, q.c, near ? 0.75 : 0.42 + Math.sin(t * 2 + q.x) * 0.08, ringTex); }
      ambient(V, th);
    };
    // ambient particles around the camera
    function ambient(V, th) {
      if (!V.parts) return; const z0 = V.zone, ex = V.eye[0], ez = V.eye[2], R2 = () => (Math.random() - 0.5) * 50;
      const a = th ? th.amb : z0.t === 'hub' ? 'dust' : z0.t === 'arena' ? 'ash' : z0.t === 'raid' ? 'blood' : 'none';
      const mist = th ? th.look.mist : z0.t === 'hub' ? HUB_LIGHT.look.mist : z0.t === 'raid' ? RAID_LIGHT.look.mist : z0.t === 'arena' ? ARENA_LIGHT.look.mist : null;
      if (mist && E.quality !== 'low' && E.fx.fog !== false && Math.random() < 0.22) { const c = mist.col.map(v => Math.min(1, v * 2.6 + 0.04)); E.particle({ x: ex + R2() * 0.8, y: 0.25 + Math.random() * 0.7, z: ez + R2() * 0.8, vx: 0.25 + Math.random() * 0.2, vy: 0.02, vz: (Math.random() - 0.5) * 0.2, life: 9, size: 4.5 + Math.random() * 4, grow: 0.6, col: c, soft: true, a: 0.16 }); }
      if (th && th.n === 'ember' && Math.random() < 0.35) E.particle({ x: ex + R2(), y: 9, z: ez + R2(), vx: 0.4, vy: -0.7, vz: 0.1, life: 7, size: 0.07, col: '#5a4a48', a: 0.7 });
      if (a === 'fireflies' && Math.random() < 0.5) E.particle({ x: ex + R2(), y: 0.5 + Math.random() * 3, z: ez + R2(), vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.6, life: 3, size: 0.09, col: Math.random() < 0.7 ? '#c8ff5a' : '#5affc8', add: true });
      else if (a === 'wisps' && Math.random() < 0.25) E.particle({ x: ex + R2(), y: 0.3 + Math.random() * 2, z: ez + R2(), vx: 0.3, vy: 0.15, vz: 0.1, life: 4, size: 0.35, col: '#5a8aff', add: true, a: 0.4 });
      else if (a === 'snow') for (let i = 0; i < 3; i++) E.particle({ x: ex + R2(), y: 12, z: ez + R2(), vx: 0.6, vy: -2, vz: 0.2, life: 6, size: 0.1, col: '#ffffff', a: 0.9 });
      else if (a === 'embers' && Math.random() < 0.7) E.particle({ x: ex + R2(), y: Math.random() * 2, z: ez + R2(), vx: 0.4, vy: 1.5, vz: 0.2, life: 3, size: 0.08, col: Math.random() < 0.5 ? '#ff7a1a' : '#ffb03a', add: true });
      else if (a === 'rain') for (let i = 0; i < 6; i++) E.particle({ x: ex + R2(), y: 14, z: ez + R2(), vx: 1.5, vy: -26, vz: 0.5, life: 0.6, size: 0.06, col: '#9ab0d8', a: 0.6 });
      else if (a === 'motes' && Math.random() < 0.5) E.particle({ x: ex + R2(), y: Math.random() * 6, z: ez + R2(), vx: 0, vy: 0.3, vz: 0, life: 4, size: 0.12, col: Math.random() < 0.5 ? '#c87aff' : '#ff4aff', add: true });
      else if (a === 'sand' && Math.random() < 0.6) E.particle({ x: ex + R2(), y: 0.2 + Math.random() * 2.5, z: ez + R2(), vx: 2.4, vy: 0.1, vz: 0.6, life: 3, size: 0.07, col: '#c8a878', a: 0.55 });
      else if (a === 'blood' && Math.random() < 0.4) E.particle({ x: ex + R2(), y: Math.random() * 5, z: ez + R2(), vx: 0, vy: 0.25, vz: 0, life: 4, size: 0.11, col: Math.random() < 0.6 ? '#ff2a4a' : '#8a0a1a', add: true, a: 0.7 });
      else if (a === 'glitch' && Math.random() < 0.5) E.particle({ x: ex + R2(), y: Math.random() * 12, z: ez + R2(), vx: 0, vy: 0, vz: 0, life: 0.4, size: 0.4, col: Math.random() < 0.5 ? '#1aff8a' : '#ff2a6a', add: true, fade: false });
      else if (a === 'dust' && Math.random() < 0.3) E.particle({ x: ex + R2(), y: 0.3 + Math.random() * 3, z: ez + R2(), vx: 0.15, vy: 0.05, vz: 0, life: 4, size: 0.06, col: '#9ab0ff', add: true, a: 0.6 });
      else if (a === 'ash' && Math.random() < 0.4) E.particle({ x: ex + R2(), y: 8, z: ez + R2(), vx: 0.3, vy: -0.6, vz: 0.1, life: 6, size: 0.08, col: '#8a7a78', a: 0.6 });
    }
    return WD;
  };
})(typeof self !== 'undefined' ? self : this);
