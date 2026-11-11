/* Slime Slayers - slime renderer. The dungeon simulation (dungeon.js, run by the server or locally for offline guests) decides
   where slimes are and what they do; this file draws them: meshes (one tinted body + fixed-colour features + glowing eyes),
   hop/squash animation, telegraph circles, shockwaves, boss shots, hit flashes, death splats, coins and damage numbers.
   It also still runs the two town events that are purely visual: the World Boss Raid slime and slime rain. */
(function (root) {
  'use strict';
  root.SSMobs = function (E, L, WD, AU) {
    const M = E.M, G = E.G, T = M.trs, C = L.C, TAU = Math.PI * 2, clamp = L.clamp;
    const MB = { list: new Map(), fx: [], nums: [], coins: [], tele: [], rings: [], shots: [], raid: null, rain: [], boss: null };
    const BS = root.SSBeasts ? root.SSBeasts(E, L) : null; MB.BS = BS;   // creature bodies (beasts.js)
    const shade = (hex, k) => { const c = M.hex(hex); return c.map(v => Math.max(0, Math.min(1, v * k))); };
    const X = (geo, x, y, z, yaw, pit, rol, sx, sy, sz, col) => G.xf(geo, T(x, y, z, yaw || 0, pit || 0, rol || 0, sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz), col);
    const colorize = (geo, c) => { const a = geo.slice(), q = M.col(c); for (let i = 0; i < a.length; i += G.STRIDE) { a[i + 6] = q[0]; a[i + 7] = q[1]; a[i + 8] = q[2]; } return a; };
    const MAG = [1, 0, 1], BONE = '#d8d0b8', MOUTH = '#120708', DARK = '#16141a';
    // ---------------------------------------------------------------- the slime body: a lumpy glossy dome
    function bodyGeo(seed, peak) {
      const prof = [[0, 0], [0.8, 0], [0.97, 0.1], [1.03, 0.3], [0.98, 0.55], [0.84, 0.78], [0.6, 0.98], [0.3, 1.1 + peak * 0.15], [0, 1.15 + peak * 0.25]];
      const g = G.lathe(prof, 22);
      for (let i = 0; i < g.length; i += G.STRIDE) { const x = g[i], y = g[i + 1], z = g[i + 2], a = Math.atan2(x, z), w = 1 + 0.055 * Math.sin(a * 3 + seed + y * 3) + 0.035 * Math.sin(a * 5 - seed * 2);
        g[i] = x * w; g[i + 2] = z * w; }
      return g;
    }
    // angry face: slanted brows (tint 2 = darker body), a wide dark mouth with jagged teeth
    function faceGeo(big, noMouth) {
      const out = [], s = big ? 1.15 : 1;
      for (const sd of [-1, 1]) out.push(...colorize(X(G.box(0.42, 0.09, 0.16, 0.03), sd * 0.32 * s, 0.9, 0.84, 0, 0, sd * -0.5, 1, 1, 1), MAG));
      if (noMouth) return out;
      out.push(...colorize(X(G.sphere(1, 14, 8), 0, 0.42, 0.9, 0, 0, 0, 0.5 * s, 0.17, 0.2), MOUTH));
      for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.15 * s; out.push(...colorize(X(G.cyl(0, 0.06, 0.2, 4), x, 0.52 - Math.abs(x) * 0.25, 1.0 - Math.abs(x) * 0.25, 0, Math.PI, 0, 1, 1, 1), BONE)); }
      for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.17 * s; out.push(...colorize(X(G.cyl(0, 0.05, 0.15, 4), x, 0.32 - Math.abs(x) * 0.15, 0.99 - Math.abs(x) * 0.25, 0, 0, 0, 1, 1, 1), BONE)); }
      return out;
    }
    const eyesGeo = (big, n) => { const o = [], s = big ? 1.1 : 1; for (const sd of [-1, 1]) o.push(...X(G.sphere(1, 10, 6), sd * 0.31 * s, 0.74, 0.89, sd * -0.25, 0, sd * -0.5, 0.14 * s, 0.045 * s, 0.06));
      if (n === 4) for (const sd of [-1, 1]) o.push(...X(G.sphere(1, 8, 5), sd * 0.18, 0.98, 0.72, 0, -0.3, sd * -0.4, 0.07, 0.04, 0.05)); return o; };
    // ---------------------------------------------------------------- features (fixed colours unless white = body colour)
    const CONE = G.cyl(0, 1, 1, 6), CONE4 = G.cyl(0, 1, 1, 4), BOX = G.box(1, 1, 1, 0.08), SPH = G.sphere(1, 10, 7), CYL = G.cyl(1, 1, 1, 10), ICO = G.ico(1, 0.3, 5);
    function horns(o, col, s, y, spread, curl) { for (const sd of [-1, 1]) { let x = sd * spread, yy = y, z = 0.2, rot = sd * -0.5;
      for (let i = 0; i < 3; i++) { const w = (0.16 - i * 0.045) * s; o.push(...colorize(X(CONE, x, yy + 0.18 * s, z, 0, -0.15 - i * curl, rot, w, 0.38 * s, w), i === 2 ? DARK : col)); x += sd * 0.12 * s; yy += 0.28 * s; z -= 0.06 * s; rot += sd * -0.35; } } }
    function crown(o, col, gem, r, y, n, h) { o.push(...colorize(X(CYL, 0, y, 0, 0, 0, 0, r, 0.12, r), col)); for (let i = 0; i < n; i++) { const a = i / n * TAU; o.push(...colorize(X(CONE4, Math.sin(a) * r * 0.92, y + h * 0.5, Math.cos(a) * r * 0.92, a, 0, 0, 0.1 * r * 2, h, 0.06 * r * 2), col)); }
      if (gem) o.push(...colorize(X(G.sphere(1, 8, 6), 0, y + 0.03, r * 0.98, 0, 0, 0, 0.09, 0.09, 0.05), gem)); }
    function tentacles(o, n, col, len, y0) { for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.2; let x = Math.sin(a) * 0.85, z = Math.cos(a) * 0.85, y = y0;
      for (let j = 0; j < 4; j++) { const w = 0.13 - j * 0.025; o.push(...colorize(X(CYL, x, y, z, a, 1.1 + j * 0.25, 0, w, len * 0.3, w), j === 3 ? DARK : col)); x += Math.sin(a) * len * 0.22; z += Math.cos(a) * len * 0.22; y += len * (0.1 - j * 0.09); } } }
    const FEAT = {
      plain: () => [],
      shroom: () => { const o = colorize(X(G.lathe([[0, 0], [1, 0], [0.95, 0.25], [0.6, 0.5], [0, 0.58]], 16), 0, 0.95, 0, 0, 0, 0.15, 0.92, 0.8, 0.92), '#5a1410');
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.3, r = i % 2 ? 0.45 : 0.72; o.push(...colorize(X(SPH, Math.sin(a) * r, 1.0 + (0.72 - r) * 0.5 + 0.18, Math.cos(a) * r, 0, 0, 0, 0.1, 0.05, 0.1), '#c8bca0')); } return o; },
      thorns: () => { const o = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, y = 0.45 + (i % 3) * 0.25, r = 0.95 - (i % 3) * 0.12; o.push(...colorize(X(CONE, Math.sin(a) * r, y, Math.cos(a) * r, a, Math.PI / 2 - 0.3, 0, 0.09, 0.42, 0.09), '#0c1608')); }
        o.push(...colorize(X(CONE, 0, 1.25, 0, 0, 0, 0, 0.12, 0.5, 0.12), '#0c1608')); return o; },
      horns: () => { const o = []; horns(o, '#b8ac90', 1, 0.82, 0.42, 0.25); return o; },
      skull: () => { const o = colorize(X(G.box(0.62, 0.52, 0.34, 0.12), 0, 0.98, 0.62, 0, -0.3, 0, 1, 1, 1), BONE);
        for (const sd of [-1, 1]) o.push(...colorize(X(SPH, sd * 0.14, 1.0, 0.8, 0, 0, 0, 0.09, 0.1, 0.05), '#0a0808'));
        o.push(...colorize(X(BOX, 0.55, 0.6, 0.3, 0.6, 0, 0.9, 0.5, 0.09, 0.09), BONE), ...colorize(X(BOX, -0.6, 0.75, -0.2, -0.4, 0, -0.7, 0.45, 0.08, 0.08), BONE)); return o; },
      ghost: () => { const o = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; o.push(...X(CONE, Math.sin(a) * 0.65, -0.12, Math.cos(a) * 0.65, a, Math.PI, 0, 0.22, 0.4, 0.22)); } return o; },
      tomb: () => colorize(X(G.box(0.6, 0.8, 0.16, 0.06), 0, 1.2, -0.45, 0, 0.35, 0.12, 1, 1, 1), '#5a5866').concat(colorize(X(G.box(0.4, 0.06, 0.18, 0), 0, 1.32, -0.43, 0, 0.35, 0.12, 1, 1, 1), '#2a2830')),
      helm: () => { const o = colorize(X(G.lathe([[0.72, 0], [0.74, 0.3], [0.6, 0.55], [0.3, 0.68], [0, 0.7]], 14), 0, 0.82, 0, 0, 0, 0, 1, 1, 1), '#3a3c46');
        o.push(...colorize(X(BOX, 0, 1.0, 0.66, 0, 0, 0, 0.55, 0.07, 0.16), '#0a0a0c'), ...colorize(X(BOX, 0, 1.5, -0.05, 0, 0, 0, 0.1, 0.35, 0.7), '#6a0e14'), ...colorize(X(CONE, 0, 1.25, 0, 0, 0, 0, 0.06, 0.4, 0.06), '#3a3c46')); return o; },
      icicles: () => { const o = []; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = i ? 0.5 : 0; o.push(...colorize(X(CONE, Math.sin(a) * r, 1.1 - r * 0.3 + 0.2, Math.cos(a) * r, a, -r * 0.6, 0, 0.12, 0.6 - r * 0.3, 0.12), '#bfe8ff')); } return o; },
      crown: () => { const o = []; crown(o, '#2a2630', '#ff2a3a', 0.48, 1.08, 7, 0.38); return o; },
      cracks: () => [],
      // desert: bandage strips wound round the body; the pharaoh's striped headdress and beard
      wrap: () => { const o = []; for (let i = 0; i < 6; i++) { const y = 0.2 + i * 0.16, r = 1.0 - Math.max(0, i - 2) * 0.12; o.push(...colorize(X(G.torus(1, 0.05, 22, 4), 0, y, 0, 0, 0.12 * (i % 2 ? 1 : -1), 0.1, r, 1, r), i % 2 ? '#c8bc9a' : '#a89a78')); }
        o.push(...colorize(X(BOX, 0.5, 0.35, 0.6, 0.6, 0, 0.5, 0.08, 0.5, 0.05), '#c8bc9a')); return o; },
      pharaoh: () => { const o = colorize(X(G.lathe([[0.95, 0], [0.98, 0.25], [0.7, 0.62], [0.2, 0.75], [0, 0.76]], 16), 0, 0.7, -0.05, 0, 0, 0, 1.06, 1, 1.06), '#c8a040');
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; o.push(...colorize(X(BOX, Math.sin(a) * 0.98, 0.9, Math.cos(a) * 0.98, a, 0, 0, 0.12, 0.42, 0.04), '#1a2a6a')); }
        o.push(...colorize(X(G.cyl(0.07, 0.12, 0.6, 6), 0, 0.12, 0.92, 0, 0.25, 0, 1, 1, 1), '#2a1e0a'), ...colorize(X(CONE, 0, 1.5, 0.75, 0, 0.5, 0, 0.1, 0.35, 0.1), '#c8a040'));
        crown(o, '#8a6a2a', '#2aff9a', 0.35, 1.45, 5, 0.22); return o; },
      // abyss: many eyes, tentacles, a gaping maw
      eyes: () => [],
      tentacles: () => { const o = []; tentacles(o, 6, '#2a0618', 1.4, 0.35); return o; },
      maw: () => { const o = colorize(X(G.sphere(1, 16, 10), 0, 0.55, 0.62, 0, 0, 0, 0.72, 0.5, 0.42), '#06020a');
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; o.push(...colorize(X(CONE, Math.cos(a) * 0.6, 0.55 + Math.sin(a) * 0.4, 0.88, 0, Math.PI / 2, a + Math.PI / 2, 0.06, 0.24, 0.06), BONE)); } return o; },
      horror: () => { const o = []; tentacles(o, 8, '#1a0410', 2, 0.3); horns(o, '#3a1a20', 1.1, 0.85, 0.45, 0.3); return o; },
      abyssal: () => { const o = []; tentacles(o, 10, '#140208', 2.4, 0.25); crown(o, '#2a0a14', '#ff2a6a', 0.5, 1.12, 9, 0.55); horns(o, '#1a0a10', 1.3, 0.9, 0.5, 0.25); return o; },
      // glitch: floating broken cubes
      cubes: () => { const o = []; for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.6 + (i % 3) * 0.25, y = 0.4 + (i % 4) * 0.3; o.push(...colorize(X(BOX, Math.sin(a) * r, y, Math.cos(a) * r, a, i * 0.3, i * 0.5, 0.22 + (i % 2) * 0.12, 0.22 + (i % 2) * 0.12, 0.22 + (i % 2) * 0.12), i % 3 ? '#0a0a0a' : '#1aff8a')); } return o; },
      treant: () => { const o = []; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.2; o.push(...colorize(X(CYL, Math.sin(a) * 0.5, 1.15, Math.cos(a) * 0.5, a, 0.6, 0, 0.07, 0.8, 0.07), '#2a1a10'));
          o.push(...colorize(X(ICO, Math.sin(a) * 0.82, 1.5, Math.cos(a) * 0.82, a, 0, 0, 0.32, 0.24, 0.32), i % 2 ? '#1a3418' : '#24401c')); }
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; o.push(...colorize(X(BOX, Math.sin(a) * 0.98, 0.3 + (i % 3) * 0.2, Math.cos(a) * 0.98, a, 0, 0, 0.18, 0.5, 0.06), '#2a1a10')); } horns(o, '#2a1a10', 0.9, 0.95, 0.4, 0.1); return o; },
      lich: () => { const o = colorize(X(G.lathe([[0.95, 0], [0.9, 0.3], [0.7, 0.6], [0.35, 0.85], [0.05, 1.05]], 14, false), 0, 0.55, -0.12, 0, -0.25, 0, 1.08, 1.0, 1.08), '#0c0a10');
        crown(o, '#5a4a2a', '#3affc8', 0.38, 1.3, 6, 0.3); return o; },
      wyrm: () => { const o = []; horns(o, '#d8eaf8', 1.3, 0.85, 0.42, 0.18); for (let i = 0; i < 6; i++) o.push(...colorize(X(CONE, 0, 1.0 - i * 0.12, -0.2 - i * 0.16, 0, -0.9, 0, 0.14, 0.42, 0.06), '#bfe8ff'));
        for (const sd of [-1, 1]) o.push(...colorize(X(G.box(1.3, 0.05, 0.7, 0), sd * 1.05, 0.9, -0.3, sd * 0.4, 0, sd * 0.5, 1, 1, 1), '#5a8ab8')); return o; },
      titan: () => { const o = []; horns(o, '#1a1010', 1.4, 0.8, 0.45, 0.3); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; o.push(...colorize(X(G.box(0.5, 0.35, 0.12, 0.04), Math.sin(a) * 0.96, 0.5, Math.cos(a) * 0.96, a, 0, 0, 1, 1, 1), '#1a1210')); } return o; },
      dragon: () => { const o = []; horns(o, '#2a2a40', 1.3, 0.85, 0.4, 0.22); for (let i = 0; i < 7; i++) o.push(...colorize(X(CONE, 0, 1.05 - i * 0.12, -0.15 - i * 0.15, 0, -0.95, 0, 0.12, 0.4, 0.05), '#8ab0ff'));
        for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) o.push(...colorize(X(G.box(0.5, 0.04, 1.1 - j * 0.25, 0), sd * (0.95 + j * 0.42), 1.0 + j * 0.15, -0.35, sd * (0.5 + j * 0.15), 0, sd * (0.3 + j * 0.2), 1, 1, 1), '#1a1a40')); return o; },
      king: () => { const o = []; crown(o, '#8a6a2a', '#ff2a8a', 0.55, 1.14, 8, 0.55); o.push(...colorize(X(G.box(1.9, 1.2, 0.08, 0.04), 0, 0.6, -0.9, 0, 0.15, 0, 1, 1, 1), '#3a0a2a')); return o; },
      // the Mimic: a slime wearing a treasure chest lid, all teeth and tongue
      mimic: () => { const o = colorize(X(G.box(1.9, 0.5, 1.5, 0.08), 0, 1.25, -0.25, 0, -0.55, 0, 1, 1, 1), '#4a2a14');
        for (const sd of [-0.6, 0.6]) o.push(...colorize(X(G.box(0.12, 0.54, 1.56, 0), sd, 1.25, -0.25, 0, -0.55, 0, 1, 1, 1), '#8a7a4a'));
        o.push(...colorize(X(G.box(0.25, 0.25, 0.1, 0.03), 0, 1.0, 0.55, 0, -0.55, 0, 1, 1, 1), '#d8b44a'));
        for (let i = 0; i < 9; i++) { const x = (i - 4) * 0.2; o.push(...colorize(X(G.cyl(0, 0.08, 0.3, 4), x, 0.98, 0.42, 0, Math.PI + 0.5, 0, 1, 1, 1), BONE)); }
        o.push(...colorize(X(G.box(0.36, 0.08, 1.1, 0.04), 0, 0.5, 1.05, 0, 0.35, 0, 1, 1, 1), '#c8283a')); return o; }
    };
    const EYE = { ghost: '#9ae8ff', treant: '#9aff4a', lich: '#3affc8', wyrm: '#9ae8ff', titan: '#ffb03a', dragon: '#9ab8ff', king: '#ff4aff', icicles: '#9ae8ff', pharaoh: '#2aff9a', wrap: '#ffb03a',
      eyes: '#ff2a4a', tentacles: '#ff2a6a', maw: '#ff3a3a', horror: '#ff1a4a', abyssal: '#ff2a6a', cubes: '#1aff8a', mimic: '#ffb03a' };
    const BOSSF = ['treant', 'lich', 'wyrm', 'titan', 'dragon', 'king', 'pharaoh', 'abyssal'];
    const meshes = {};
    function meshFor(feat, big, boss) {
      const key = feat + (big ? '!' : '') + (boss ? 'B' : ''); if (meshes[key]) return meshes[key];
      boss = boss || BOSSF.includes(feat);
      const body = bodyGeo(feat.length * 1.7, feat === 'ghost' ? 0.5 : boss ? 0.2 : 0).concat(faceGeo(big || boss, feat === 'maw'), (FEAT[feat] || FEAT.plain)());
      const cracks = feat === 'cracks' || feat === 'titan' ? (() => { const o = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.3, y = 0.25 + (i % 3) * 0.25; o.push(...X(BOX, Math.sin(a) * (1.0 - y * 0.15), y, Math.cos(a) * (1.0 - y * 0.15), a, 0, (i % 2 ? 0.6 : -0.5), 0.05, 0.4, 0.04)); } return E.mesh(o); })() : null;
      let eyes = eyesGeo(big || boss, boss ? 4 : 2);
      if (feat === 'eyes' || feat === 'horror' || feat === 'abyssal') { const n = feat === 'eyes' ? 9 : 6; for (let i = 0; i < n; i++) { const a = (i / n - 0.5) * 2.4, y = 0.45 + (i % 3) * 0.24; eyes = eyes.concat(X(G.sphere(1, 8, 5), Math.sin(a) * 0.92, y, Math.cos(a) * 0.92, a, 0, 0, 0.1, 0.07, 0.05)); } }
      return (meshes[key] = { body: E.mesh(body), eyes: E.mesh(eyes), cracks, eye: EYE[feat] || '#ff2a2a', ghost: feat === 'ghost', glitch: feat === 'cubes' });
    }
    MB.meshFor = meshFor;
    const boxM = E.mesh(G.box(1, 1, 1, 0)), crysM = E.mesh(G.cyl(0, 1, 1, 5).concat(G.xf(G.cyl(0, 1, 1, 5), T(0, -1, 0, 0, Math.PI, 0)))), chainM = E.mesh(G.torus(1, 0.18, 10, 4));
    const disc = E.mesh(G.disc(1, 24, 0, 1)), ring = E.mesh(G.torus(1, 0.05, 48, 4)), coinM = E.mesh(G.cyl(0.22, 0.22, 0.06, 12)), orbM = E.mesh(G.sphere(1, 10, 7)), boneM = E.mesh(G.box(1, 1, 1, 0.1));
    const teleQ = E.mesh(G.plane(1, 1));
    MB.ms = { disc, ring, coinM, orbM, teleQ };

    // ---------------------------------------------------------------- the run's slimes (mirrors the simulation)
    MB.clear = () => { MB.list.clear(); MB.boss = null; MB.coins.length = 0; MB.fx.length = 0; MB.tele.length = 0; MB.rings.length = 0; MB.shots.length = 0; MB.rain.length = 0; };
    function add(f) {
      const d = L.mob(f.id) || L.mob('moss'), boss = f.kind === 'boss';
      const m = { uid: f.u, id: f.id, d, kind: f.kind, x: f.x, z: f.z, y: 0, yaw: Math.PI, nx: f.x, nz: f.z, ny: 0, nyaw: Math.PI, hp: f.hp, max: f.max, sc: f.sc, st: 'spawn', warn: 0, tx: f.x, tz: f.z,
        flash: 0, sq: 0, dead: 0, spawnT: (f.dl || 0) + 0.6, spawnD: (f.dl || 0) + 0.6, hop: Math.random(), mv: 0, mesh: meshFor(d.feat || 'plain', f.kind !== 'mob', boss), col: d.col, col2: shade(d.col, 0.45), boss, elite: f.kind === 'elite' || f.kind === 'mini', mini: f.kind === 'mini', phase: 1, seen: 0 };
      m.mod = f.mod; m.beh = f.beh; m.child = !!f.child; m.shOn = f.mod === 'shield';
      m.rig = BS && BS.has(f.id) ? BS.get(f.id) : null; m.ph = Math.random(); m.atkP = 0; m.castT = 0; m.phT = 9; m.pst = 'spawn'; m.anim = { t: 0, mv: 0, ph: 0, w: 0, atk: 0, hurt: 0, sq: 0, air: 0, die: 0, phase: 1, phT: 9, lod: false };
      MB.list.set(m.uid, m); if (boss) MB.boss = m; return m;
    }
    // online: a 10 Hz snapshot [uid, x, z, y, yaw, hp, stCode, warn, tx, tz]
    MB.applySnap = function (arr, STATES) {
      const t = performance.now();
      for (const a of arr) { let m = MB.list.get(a[0]); if (!m) continue; m.nx = a[1]; m.nz = a[2]; m.ny = a[3]; m.nyaw = a[4]; if (a[5] < m.hp) m.hp = a[5]; else m.hp = a[5];
        const st = STATES[a[6]] || 'chase'; if (st !== m.st && m.st === 'spawn' && m.spawnT > 0.05) { /* keep growing */ } m.st = st; m.warn = a[7]; m.tx = a[8]; m.tz = a[9]; m.seen = t; }
      for (const m of MB.list.values()) if (!m.dead && m.seen && t - m.seen > 1500) MB.list.delete(m.uid); // vanished without a kill event (should not happen)
    };
    // offline: copy straight from the local simulation
    MB.fromSim = function (inst) {
      for (const q of inst.mobs) { const m = MB.list.get(q.uid); if (!m || m.dead) continue; m.nx = q.x; m.nz = q.z; m.ny = q.y; m.nyaw = q.yaw; m.hp = q.hp; m.st = q.st; m.warn = q.warn || 0; m.tx = q.tx; m.tz = q.tz; m.phase = q.phase || 1; }
    };
    function num(x, y, z, txt, col, big) { MB.nums.push({ x, y, z, txt, col, big: big || 1, t: 0, vx: (Math.random() - 0.5) * 1.5 }); if (MB.nums.length > 70) MB.nums.shift(); }
    MB.num = num;
    function goo(m, n, spd) { const c = M.hex(m.col); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = spd * (0.4 + Math.random());
      E.particle({ x: m.x, y: (m.y || 0) + m.sc * 0.6, z: m.z, vx: Math.cos(a) * v, vy: 2 + Math.random() * 4, vz: Math.sin(a) * v, life: 0.7 + Math.random() * 0.5, size: 0.14 + Math.random() * 0.2 * m.sc, g: 16, col: c.map(q => q * (0.7 + Math.random() * 0.5)) }); } }
    // death effects by creature type: ice shatters, fire turns to ash, the dead fall to bones, glitches break into pixels
    function deathFx(m) { const k = BS && BS.deathFx[m.id], n = Math.round((m.boss ? 60 : m.elite ? 26 : 12) * (E.quality === 'low' ? 0.5 : 1)), y = (m.y || 0) + m.sc * 0.7, sc = m.sc;
      const P2 = (o) => E.particle(Object.assign({ x: m.x + (Math.random() - 0.5) * sc, y: y + (Math.random() - 0.5) * sc * 0.6, z: m.z + (Math.random() - 0.5) * sc }, o));
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (2 + Math.random() * 4) * Math.sqrt(sc), vx = Math.cos(a) * v, vz = Math.sin(a) * v;
        switch (k) {
          case 'shatter': P2({ vx, vy: 3 + Math.random() * 5, vz, life: 1.1, size: 0.12 + Math.random() * 0.14 * sc, col: Math.random() < 0.5 ? '#d8f4ff' : '#8ad0ff', g: 16, floor: 0.05 }); break;
          case 'ash': P2({ vx: vx * 0.3, vy: 1 + Math.random() * 2, vz: vz * 0.3, life: 2.2, size: 0.4 * Math.sqrt(sc), grow: 1.5, col: '#2a2224', soft: true, a: 0.6 }); if (i % 2) P2({ vx: vx * 0.5, vy: 2 + Math.random() * 3, vz: vz * 0.5, life: 1.2, size: 0.07, col: '#ff8a2a', add: true, g: -0.5 }); break;
          case 'bones': P2({ vx, vy: 4 + Math.random() * 4, vz, life: 1.4, size: 0.12 + Math.random() * 0.1, col: '#d8d0b8', g: 18, floor: 0.06 }); break;
          case 'wisp': P2({ vx: vx * 0.2, vy: 1.5 + Math.random() * 2, vz: vz * 0.2, life: 1.6, size: 0.35, grow: 1, col: m.col, soft: true, a: 0.5 }); break;
          case 'pixels': P2({ vx, vy: Math.random() * 3, vz, life: 0.9, size: 0.16, col: Math.random() < 0.5 ? '#1aff8a' : '#ff2a6a', add: true, fade: false, drag: 2 }); break;
          case 'sparks': P2({ vx: vx * 1.6, vy: 2 + Math.random() * 4, vz: vz * 1.6, life: 0.5, size: 0.09, col: '#c8d8ff', add: true, drag: 3 }); break;
          case 'void': P2({ vx: -vx * 0.3, vy: 0.5, vz: -vz * 0.3, life: 1.0, size: 0.3, grow: -0.6, col: '#a04aff', add: true }); break;
          case 'sand': P2({ vx: vx * 0.6, vy: 1 + Math.random() * 2, vz: vz * 0.6, life: 1.5, size: 0.3, grow: 1.2, col: '#b89a6a', soft: true, a: 0.6, g: 2 }); break;
        } } }
    // simulation events -> visuals. me = my player id (my hits show bigger), P = my position (coins fly to me)
    MB.event = function (e, me, opt) {
      opt = opt || {};
      switch (e.k) {
        case 'spawn': add(e.m); break;
        case 'dmg': { const m = MB.list.get(e.u); if (!m || m.dead) break; if (e.im) { if (e.by === me) num(m.x, m.y + m.sc * 1.6, m.z, 'IMMUNE', '#ff7aa0', 1.1); break; } m.hp = e.hp; m.flash = 0.1; m.sq = Math.min(0.35, m.sq + 0.22);
          const mine = e.by === me;
          if (e.sh || e.blk) { if (mine && opt.nums !== false) num(m.x, m.y + m.sc * 1.7 + 0.4, m.z, e.sh ? 'SHIELDED' : 'BLOCKED · hit its back', '#7ac8ff', 0.85); if (e.sh) break; }
          if (opt.nums !== false && (mine || opt.allNums)) num(m.x + (Math.random() - 0.5) * 0.6, m.y + m.sc * 1.5 + 0.3, m.z, (e.c ? 'CRIT ' : '') + L.fmt(e.n), e.c ? '#ffcf3a' : mine ? '#ffffff' : '#a8a2b4', e.c ? 1.45 : mine ? 1 : 0.75);
          goo(m, e.c ? 10 : 4, 3); m.flash = e.c ? 0.14 : 0.1;
          if (opt.parts !== false) { const n = e.c ? 9 : 4, y = (m.y || 0) + m.sc * 0.7; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 3 + Math.random() * 5;
            E.particle({ x: m.x, y, z: m.z, vx: Math.cos(a) * v, vy: 1 + Math.random() * 4, vz: Math.sin(a) * v, life: 0.22 + Math.random() * 0.15, size: e.c ? 0.16 : 0.1, col: e.c ? '#ffe08a' : '#fff4dc', add: true, drag: 4 }); }
            if (e.c) E.particle({ x: m.x, y, z: m.z, vx: 0, vy: 0, vz: 0, life: 0.18, size: m.sc * 2.2, grow: 1.5, col: '#ffd86a', add: true, a: 0.8 }); }
          if (mine) MB.onMyHit && MB.onMyHit(m, e); break; }
        case 'kill': { const m = MB.list.get(e.u); if (!m || m.dead) break; m.hp = 0; m.dead = 0.0001; m.st = 'dead';
          goo(m, m.boss ? 100 : m.elite ? 30 : 14, m.boss ? 12 : 6); deathFx(m); MB.fx.push({ k: 'splat', x: m.x, z: m.z, s: m.sc * 1.3, col: m.col, t: 0 });
          const n = m.boss ? 26 : m.elite ? 9 : 2 + Math.floor(Math.random() * 3);
          if (e.by === me) for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 2 + Math.random() * 4 * (m.boss ? 2 : 1); MB.coins.push({ x: m.x, y: m.y + m.sc * 0.8, z: m.z, vx: Math.cos(a) * v, vy: 5 + Math.random() * 5, vz: Math.sin(a) * v, t: 0 }); }
          AU && (m.boss || !AU.at ? AU.play(m.boss ? 'bossDie' : m.kind === 'orb' ? 'pop' : 'splat', m.sc) : AU.at(m.kind === 'orb' ? 'pop' : 'splat', m.x, m.z, m.sc)); if (m.boss) { MB.tele.length = 0; MB.rings.length = 0; MB.shots.length = 0; }
          MB.onKill && MB.onKill(m, e); break; }
        case 'tele': MB.tele.push(Object.assign({ t: 0 }, e, { s: e.s || 'c' })); if (e.s === 'safe') { AU && AU.play('roar'); MB.onSafe && MB.onSafe(e); } else if (e.s === 'grid') AU && AU.play('tick'); break;
        case 'mhp': { const m = MB.list.get(e.u); if (m) { m.hp = e.hp; m.max = e.max; } break; }
        case 'msc': { const m = MB.list.get(e.u); if (m) m.sc = e.sc; break; }
        case 'mshield': { const m = MB.list.get(e.u); if (m) { m.shOn = !!e.on; if (!e.on) { for (let i = 0; i < 16; i++) { const a = Math.random() * TAU; E.particle({ x: m.x, y: m.sc * 0.8, z: m.z, vx: Math.cos(a) * 5, vy: 2 + Math.random() * 3, vz: Math.sin(a) * 5, life: 0.6, size: 0.12, col: '#9ad8ff', add: true, g: 6 }); } num(m.x, m.sc * 1.8, m.z, 'SHIELD BROKEN', '#7ac8ff', 1.1); } } break; }
        case 'mfrenzy': { const m = MB.list.get(e.u); if (m) { m.fren = 1; m.sq = 0.4; num(m.x, m.sc * 1.9, m.z, 'FRENZY!', '#ff4a2a', 1.2); } AU && AU.play('roar'); break; }
        case 'mheal': { const m = MB.list.get(e.u); if (m) { const n = e.hp - m.hp; m.hp = e.hp; if (n > 0) num(m.x, (m.y || 0) + m.sc * 1.8, m.z, '+' + L.fmt(n), '#5aff7a', 1.1); } break; }
        case 'immune': { const m = MB.list.get(e.u); if (m) { m.immune = e.on ? e.h || 1 : 0; m.sq = 0.4; } break; }
        case 'healer': { const m = MB.list.get(e.u); if (m) m.healer = 1; break; }
        case 'boom': { const col = MB.boss ? MB.boss.col : '#ff4a2a';
          for (let j = 0; j < 14; j++) { const a = j / 14 * TAU; E.particle({ x: e.x + Math.cos(a) * e.r * 0.8, y: 0.2, z: e.z + Math.sin(a) * e.r * 0.8, vx: Math.cos(a) * 4, vy: 2, vz: Math.sin(a) * 4, life: 0.5, size: 0.4, drag: 2, col, a: 0.8 }); }
          AU && AU.play('thud'); MB.onShake && MB.onShake(e.r > 3 ? 0.7 : 0.35); break; }
        case 'ring': MB.rings.push({ x: e.x, z: e.z, r: e.r, sp: e.sp || 10, max: e.max || 20 }); AU && (AU.at ? AU.at('boom', e.x, e.z, 0, 70) : AU.play('boom')); MB.onShake && MB.onShake(0.6); break;
        case 'shot': { const m = e.u ? MB.list.get(e.u) : null; MB.shots.push({ x0: e.x0, z0: e.z0, x: e.x, z: e.z, dur: e.dur, t: 0, col: m ? m.col : null, small: !!m }); AU && (AU.at ? AU.at('spit', e.x0, e.z0) : AU.play('spit')); break; }
        case 'land': { const m = MB.list.get(e.u); if (!m) break; m.sq = 0.35; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; E.particle({ x: m.x + Math.cos(a) * m.sc, y: 0.15, z: m.z + Math.sin(a) * m.sc, vx: Math.cos(a) * 3, vy: 0.6, vz: Math.sin(a) * 3, life: 0.4, size: 0.3, drag: 3, col: m.col, a: 0.7 }); } break; }
        case 'bossIntro': { const m = MB.list.get(e.u); AU && AU.play('roar'); if (m) MB.onBossStart && MB.onBossStart(m); break; }
        case 'bossPhase': { const m = MB.list.get(e.u); if (m) { m.phase = e.p || 2; m.sq = 0.4; m.phT = 0; goo(m, 60, 8); } AU && AU.play('roar'); MB.onBossPhase && MB.onBossPhase(m); break; }
      }
    };
    // ---------------------------------------------------------------- queries for my attacks (target lists sent to the simulation)
    const live = () => [...MB.list.values()].filter(m => !m.dead && m.hp > 0 && m.st !== 'spawn' && m.st !== 'intro');
    MB.alive = live;
    MB.nearest = function (x, z, r) { let best = null, bd = r; for (const m of live()) { const d = Math.hypot(m.x - x, m.z - z) - m.sc * 0.8; if (d < bd) { bd = d; best = m; } }
      if (MB.raid && MB.raid.on) { const R = MB.raid, d = Math.hypot(R.x - x, R.z - z) - R.sc * 0.85; if (d < bd) { bd = d; best = R; } }
      for (const q of MB.rain) { if (q.dead) continue; const d = Math.hypot(q.x - x, q.z - z) - 0.5; if (d < bd) { bd = d; best = q; } }
      return best; };
    // slimes inside an arc in front of (x,z) facing yaw (arc >= TAU = all around)
    MB.inArea = function (x, z, yaw, range, arc) {
      const out = [], fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (const m of live()) { const dx = m.x - x, dz = m.z - z, d = Math.hypot(dx, dz), rr = m.sc * 0.85; if (d - rr > range) continue;
        if (arc < TAU - 0.01 && d > rr + 0.4) { const a = Math.acos(clamp((dx * fx + dz * fz) / (d || 1), -1, 1)); if (a > arc / 2 + Math.atan2(rr, d)) continue; } out.push(m); }
      return out; };
    // town events (raid boss + rain slimes) are hit locally
    MB.hitTown = function (x, z, yaw, range, arc, src) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw), test = (q, sc) => { const dx = q.x - x, dz = q.z - z, d = Math.hypot(dx, dz), rr = sc * 0.85; if (d - rr > range) return false; if (arc >= TAU - 0.01 || d < rr + 0.4) return true;
        return Math.acos(clamp((dx * fx + dz * fz) / (d || 1), -1, 1)) < arc / 2 + Math.atan2(rr, d); };
      let n = 0; if (MB.raid && MB.raid.on && test(MB.raid, MB.raid.sc)) { raidHit(MB.raid, src); n++; }
      for (const q of MB.rain) if (!q.dead && test(q, 0.55)) { rainHit(q, src); n++; }
      return n; };

    // ---------------------------------------------------------------- per-frame animation
    // ctx: {P (my position), online (interpolate), t}
    MB.update = function (dt, ctx) {
      const P = ctx.P, k = ctx.online ? Math.min(1, dt * 12) : 1;
      for (const m of MB.list.values()) {
        m.flash = Math.max(0, m.flash - dt); m.sq *= Math.max(0, 1 - dt * 6); if (m.launchT > 0) m.launchT = Math.max(0, m.launchT - dt); m.atkP = Math.max(0, (m.atkP || 0) - dt * 2.8); m.phT = (m.phT || 0) + dt;
        if ((m.pst === 'wind' || m.pst === 'aim' || m.pst === 'out') && m.st !== m.pst) m.atkP = 1; if (m.st === 'cast') m.castT = Math.min(1, (m.castT || 0) + dt * 1.6); else { if (m.castT > 0.3) m.atkP = 1; m.castT = 0; } m.pst = m.st;
        if (m.rig) m.ph = (m.ph || 0) + dt * m.mv * (1.5 / Math.sqrt(Math.max(0.5, m.sc)));
        if (m.dead) { m.dead += dt; if (m.boss && m.rig && m.dead < 2.2 && Math.random() < dt * 14) { goo(m, 6, 7); if (Math.random() < 0.3) deathFx(m); } // a boss comes apart for two seconds
          if (m.dead > (m.rig ? (m.boss ? 2.4 : 1.4) : 1.2)) MB.list.delete(m.uid); continue; }
        if (m.spawnT > 0) m.spawnT -= dt;
        const ox = m.x, oz = m.z; m.x += (m.nx - m.x) * k; m.z += (m.nz - m.z) * k;
        let df = m.nyaw - m.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); m.yaw += df * Math.min(1, dt * 12);
        const sp = Math.hypot(m.x - ox, m.z - oz) / Math.max(dt, 1e-3); m.mv += (Math.min(1, sp / 2) - m.mv) * Math.min(1, dt * 8);
        if (m.st === 'leap' || m.ny > 0.05) { m.y += (m.ny - m.y) * (ctx.online ? Math.min(1, dt * 14) : 1); m.sq = m.st === 'leap' ? -0.2 : m.sq; }
        else if (m.st === 'wind') { m.y *= 0.7; m.sq = 0.25 * m.warn; }
        else if (m.mv > 0.2 && !m.boss && (!m.rig || m.rig.kind === 'swarm')) { m.hop += dt * (1.9 / Math.sqrt(m.sc)); const ph = m.hop % 1, air = ph < 0.55; m.y = air ? Math.sin(ph / 0.55 * Math.PI) * 0.4 * Math.sqrt(m.sc) * m.mv : 0; m.sq = air ? -0.1 : Math.max(m.sq, 0.1 * Math.sin((ph - 0.55) / 0.45 * Math.PI)); }
        else m.y += (m.ny - m.y) * Math.min(1, dt * 10);
      }
      // coins pop out then fly to you
      for (let i = MB.coins.length - 1; i >= 0; i--) { const c = MB.coins[i]; c.t += dt;
        if (c.t < 0.45) { c.vy -= 22 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; if (c.y < 0.15) { c.y = 0.15; c.vy *= -0.4; c.vx *= 0.6; c.vz *= 0.6; } }
        else { const dx = P.x - c.x, dy = P.y + 1.2 - c.y, dz = P.z - c.z, d = Math.hypot(dx, dy, dz), s = 8 + (c.t - 0.45) * 40; if (d < 0.6 || c.t > 3) { MB.coins.splice(i, 1); AU && AU.play('coin'); continue; } c.x += dx / d * Math.min(d, s * dt); c.y += dy / d * Math.min(d, s * dt); c.z += dz / d * Math.min(d, s * dt); } }
      for (let i = MB.fx.length - 1; i >= 0; i--) { const f = MB.fx[i]; f.t += dt; if (f.t > (f.life || 4)) MB.fx.splice(i, 1); }
      for (let i = MB.nums.length - 1; i >= 0; i--) { const n = MB.nums[i]; n.t += dt; if (n.t > 1.0) MB.nums.splice(i, 1); }
      for (let i = MB.tele.length - 1; i >= 0; i--) { const q = MB.tele[i]; q.t += dt; if (q.t >= q.dur) { MB.tele.splice(i, 1); if (q.s === 'safe' || q.s === 'grid') MB.onShake && MB.onShake(0.8); } }
      for (let i = MB.shots.length - 1; i >= 0; i--) { const q = MB.shots[i]; q.t += dt; if (q.t >= q.dur) MB.shots.splice(i, 1); }
      for (let i = MB.rings.length - 1; i >= 0; i--) { const q = MB.rings[i]; q.r += q.sp * dt; if (q.r > q.max) MB.rings.splice(i, 1); }
      if (MB.raid) raidTick(MB.raid, dt, ctx);
      rainTick(dt);
    };

    // ---------------------------------------------------------------- World Boss Raid (shared health from the server; its shockwave is only a show in town)
    MB.startRaid = function (info) { MB.raid = { id: 'raid', info, d: { col: '#1a0a1a', feat: 'king' }, x: 0, z: -9.5, y: 0, sc: 4.6, yaw: 0, hp: info.hp, max: info.max, flash: 0, sq: 0, on: true, raidS: true, mesh: meshFor('king'), col: '#2a0a26', col2: shade('#2a0a26', 0.4), t: 0, ring: 0, ringR: 0 }; };
    MB.raidInfo = info => { if (!MB.raid) return; if (info.hp < MB.raid.hp) MB.raid.flash = 0.08; MB.raid.hp = info.hp; MB.raid.max = info.max; };
    MB.endRaid = win => { if (MB.raid) { const R = MB.raid; goo(R, win ? 200 : 40, 14); MB.fx.push({ k: 'splat', x: R.x, z: R.z, s: 8, col: R.col, t: 0 }); } MB.raid = null; };
    function raidHit(R, src) { R.flash = 0.08; R.sq = Math.min(0.2, R.sq + 0.08); num(R.x + (Math.random() - 0.5) * 3, R.sc * 1.6, R.z + 2, 'HIT', '#ffcf3a', 1.1); goo(R, 4, 4); MB.onRaidHit && MB.onRaidHit(1, src); }
    function raidTick(R, dt, ctx) { R.t += dt; R.flash = Math.max(0, R.flash - dt); R.sq *= 0.9; R.y = Math.abs(Math.sin(R.t * 1.4)) * 0.3; const P = ctx.P; R.yaw = Math.atan2(P.x - R.x, P.z - R.z);
      if (R.ring > 0) { const prev = R.ringR; R.ringR += dt * 9; if (R.ringR > 26) R.ring = 0; else if (!P.dead && !P.iframe && P.y < 0.7) { const pd = Math.hypot(P.x - R.x, P.z - R.z); if (pd >= prev - 0.4 && pd <= R.ringR + 0.4) { ctx.onTownHurt && ctx.onTownHurt(R); R.ring = 0; } } }
      if ((R.t % 7) < dt && R.t > 3) { R.ring = 1; R.ringR = R.sc * 0.8; AU && AU.play('boom'); MB.onShake && MB.onShake(0.5); } }
    // ---------------------------------------------------------------- slime rain (town event): little slimes drop from the sky; one hit pops them
    let rainAcc = 0;
    MB.rainOn = false;
    function rainTick(dt) {
      if (MB.rainOn) { rainAcc += dt; while (rainAcc > 0.35) { rainAcc -= 0.35; if (MB.rain.length < 26) { const a = Math.random() * TAU, r = 4 + Math.random() * 26; MB.rain.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 22 + Math.random() * 8, vy: 0, t: 0, col: ['#3d6a2e', '#4a2a6a', '#8a7020', '#2a4a7a'][Math.random() * 4 | 0], rainS: true, sc: 0.55 }); } } }
      for (let i = MB.rain.length - 1; i >= 0; i--) { const q = MB.rain[i]; q.t += dt; if (q.dead) { q.dead += dt; if (q.dead > 0.3) MB.rain.splice(i, 1); continue; }
        if (q.y > 0) { q.vy -= 18 * dt; q.y += q.vy * dt; if (q.y <= 0) { q.y = 0; q.vy = 0; } } else { q.hop = (q.hop || 0) + dt * 2.5; q.y = Math.max(0, Math.sin(q.hop * Math.PI) * 0.6); if (Math.sin(q.hop * Math.PI) > 0) { q.x += Math.sin(q.t * 0.7 + i) * dt * 2; q.z += Math.cos(q.t * 0.6 + i) * dt * 2; } }
        if (q.t > 12) MB.rain.splice(i, 1); }
    }
    function rainHit(q, src) { if (q.dead) return; q.dead = 0.0001; goo(Object.assign({ sc: 0.6, y: 0.3 }, q), 14, 4); for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; MB.coins.push({ x: q.x, y: 0.5, z: q.z, vx: Math.cos(a) * 2, vy: 5, vz: Math.sin(a) * 2, t: 0 }); } AU && AU.play('pop', 1); MB.onRainKill && MB.onRainKill(q, src); }

    // ---------------------------------------------------------------- drawing
    const mT = new Float32Array(16), flashC = {};
    // danger is red and safe is green; the colour-blind option swaps them for orange-yellow and blue
    MB.cb = false; const TELE_COL = () => MB.cb ? '#ffb01a' : '#ff2a12', TELE_SAFE = () => MB.cb ? '#2a8aff' : '#3aff6a';
    const FLASH = c => flashC[c] || (flashC[c] = M.hex(c).map(v => Math.min(1, v * 0.4 + 0.55)));
    const RB = new Float32Array(16);
    const MOB_OL = { col: [0.03, 0.02, 0.035], w: 0.028 }, MOB_OL_BOSS = { col: [0.03, 0.02, 0.035], w: 0.05 };
    function drawRig(m, V, scale, d2) {
      const a = m.anim || (m.anim = {}), dieK = m.dead ? Math.min(1, m.dead / (m.boss ? 2.0 : 1.0)) : 0, s = m.sc * (scale || 1), sq = clamp(m.sq, -0.3, 0.4);
      a.t = V.t + (m.uid || 0) * 0.37; a.mv = m.dead ? 0 : m.mv; a.ph = m.ph || 0; a.w = m.dead ? 0 : Math.max(m.st === 'wind' || m.st === 'aim' || m.st === 'fuse' ? m.warn : 0, m.castT || 0) * (m.st === 'fuse' ? 0.6 + Math.sin(V.t * 30) * 0.4 : 1); a.atk = m.atkP || 0; a.hurt = m.flash > 0 ? 1 : 0; a.sq = sq * 0.5; a.air = m.y > 0.1 ? 1 : 0;
      a.die = dieK; a.phase = m.phase || 1; a.phT = m.phT === undefined ? 9 : m.phT; a.lod = E.quality === 'low' || d2 > 700;
      const gl = (m.rig.kind === 'glitchking' || m.id === 'glitchling' || m.id === 'errorknight') && Math.random() < 0.05 ? (Math.random() - 0.5) * 0.4 : 0;
      const ly = m.launchT > 0 && !m.boss ? Math.sin((1 - m.launchT / 0.6) * Math.PI) * 2.2 : 0;   // knocked into the air by a launcher
      // Update 7: each boss / mini-boss move has its own wind-up pose (crouch, raise, rear, tilt, spin, roar, channel, sink, shake, float), held for the move's
      // warning time, then released; it also drives the rig's own wind-up (jaws open, arms back)
      let px = 0, py = 0, pz = 0, pyaw = 0, ppit = 0, prol = 0, sxk = 1, syk = 1;
      if (m.pose && !m.dead) { const el = (performance.now() - m.poseAt) / 1000, W2 = Math.max(0.35, m.poseW || 0), k = el < W2 ? Math.min(1, el / W2 * 1.4) : Math.max(0, 1 - (el - W2) / 0.35);
        if (k <= 0 && el > W2) m.pose = null;
        else { a.w = Math.max(a.w, k); const jit = () => (Math.random() - 0.5) * 0.14 * k * s;
          switch (m.pose) {
            case 'crouch': syk = 1 - 0.24 * k; sxk = 1 + 0.12 * k; break;
            case 'raise': syk = 1 + 0.18 * k; py = 0.35 * k * s; break;
            case 'rear': ppit = -0.5 * k; py = 0.3 * k * s; break;
            case 'tilt': prol = 0.35 * k; pyaw = -0.6 * k; break;
            case 'spin': pyaw = el * 10 * k; break;
            case 'roar': syk = 1 + 0.1 * k; sxk = 1 + 0.1 * k; px = jit(); pz = jit(); break;
            case 'channel': py = 0.55 * k * s; pyaw = Math.sin(el * 6) * 0.15 * k; break;
            case 'sink': py = -0.8 * k * s; syk = 1 - 0.15 * k; break;
            case 'shake': px = jit() * 1.6; pz = jit() * 1.6; break;
            case 'float': py = 2.4 * k; ppit = 0.2 * k; break;
          } } }
      // Update 7: each dungeon's slimes move their own way (C.GAIT), crouch before they pounce, stretch as they leap and recoil when hit
      if (!m.boss && !m.dead) { const G2 = C.GAIT[Math.round(m.x / 800) - 1]; if (G2) { const mv = m.mv || 0, ph = (m.ph || 0) * TAU * (G2.low ? 0.5 : 1), st = G2.tick ? Math.floor(ph / (Math.PI / 2)) * (Math.PI / 2) : ph;
          if (G2.hop) { const h = Math.abs(Math.sin(st)); py += h * G2.hop * mv * s; syk *= 1 + (h - 0.5) * 0.12 * mv; sxk *= 1 - (h - 0.5) * 0.06 * mv; }
          if (G2.lean) ppit += G2.lean * mv; if (G2.sway) prol += Math.sin(ph) * G2.sway * mv;
          if (G2.float) py += G2.float * s + Math.sin(V.t * 2 + (m.uid || 0)) * 0.08 * s; if (G2.jit && Math.random() < 0.3) { px += (Math.random() - 0.5) * G2.jit * s; pz += (Math.random() - 0.5) * G2.jit * s; } }
        if (m.st === 'wind') { const w = m.warn || 0; syk *= 1 - 0.18 * w; sxk *= 1 + 0.1 * w; ppit -= 0.18 * w; } else if (m.st === 'leap') { syk *= 1.14; sxk *= 0.92; ppit += 0.2; }
        if (m.flash > 0) { ppit -= Math.min(0.25, m.flash * 2.5); syk *= 1 - Math.min(0.1, m.flash); } }
      T(m.x + gl + px, m.y + ly + py, m.z + pz, m.yaw + pyaw, ppit, prol, s * (1 + dieK * 0.25) * sxk, s * (1 - dieK * 0.35) * syk, s * (1 + dieK * 0.25) * sxk, RB);
      const hurt = m.flash > 0, o = { col2: m.col2, spec: 0.95, soft: m.boss ? 0.85 : 0.55, rim: 1.2, emis: hurt ? (m.boss ? 0.15 : 0.25) + m.flash * (m.boss ? 3 : 6) : 0,
        // Update 7: a clean dark outline (Medium / High, near the camera) so every creature reads against the brighter worlds; bosses get a thicker one
        outline: d2 < 900 ? (m.boss ? MOB_OL_BOSS : MOB_OL) : undefined };
      if (dieK > 0.6) o.alpha = Math.max(0.05, 1 - (dieK - 0.6) * 2.5);
      if (m.st === 'out') { o.alpha = Math.max(0.08, 1 - m.warn); if (V.parts && Math.random() < 0.5) E.particle({ x: m.x + (Math.random() - 0.5) * s, y: Math.random() * s * 1.5, z: m.z + (Math.random() - 0.5) * s, vx: 0, vy: 1.5, vz: 0, life: 0.4, size: 0.12, col: m.col, add: true }); }
      if (m.st === 'under' || (m.y || 0) < -0.5) { // dug in: a churning mound of dirt moves under the floor
        E.draw(disc, T(m.x, 0.06, m.z, V.t * 2, 0, 0, s * 0.8, 1, s * 0.8), '#1a1410', { alpha: 0.7, mode: 3, noShadow: true, depthWrite: false });
        E.draw(MB.ms.orbM, T(m.x, -0.05, m.z, V.t, 0, 0, s * 0.55, 0.28, s * 0.55), m.col2 ? m.col : m.col, { soft: 1, spec: 0.4 });
        if (V.parts && Math.random() < 0.5) E.particle({ x: m.x + (Math.random() - 0.5) * s, y: 0.1, z: m.z + (Math.random() - 0.5) * s, vx: (Math.random() - 0.5) * 2, vy: 2.5, vz: (Math.random() - 0.5) * 2, life: 0.5, size: 0.08, col: '#3a2c22', g: 12 }); return; }
      BS.draw(m.rig, RB, a, { col: hurt ? FLASH(m.col) : m.col, eye: m.mesh.eye, glow: m.mesh.eye, body: o });
      if (E.quality === 'low') E.draw(disc, T(m.x, 0.04, m.z, 0, 0, 0, s, 1, s), '#000000', { alpha: 0.3, mode: 3, noShadow: true });
      if (m.boss || m.elite) E.draw(disc, T(m.x, 0.06, m.z, 0, 0, 0, s * (m.boss ? 1.6 : 1.3), 1, s * (m.boss ? 1.6 : 1.3)), m.boss ? '#ff2a1a' : '#c8281a', { alpha: m.boss ? 0.2 : 0.12, mode: 3, add: true, noShadow: true, depthWrite: false });
      if (m.mod && !m.dead) modAura(m, V, s);
    }
    // elite modifier auras: fast (gold streaks), shielded (a blue bubble), vampiric (a dark red mist), explosive (a pulsing orange core), frenzied (red flames)
    const MOD_COL = { fast: '#ffd84a', shield: '#5ab8ff', vamp: '#c8102a', boom: '#ff8a1a', frenzy: '#ff2a1a' };
    MB.MOD_NAME = { fast: 'Fast', shield: 'Shielded', vamp: 'Vampiric', boom: 'Explosive', frenzy: 'Frenzied' };
    function modAura(m, V, s) { const col = MOD_COL[m.mod], P2 = V.parts;
      E.draw(ring, T(m.x, 0.1, m.z, V.t * 1.5, 0, 0, s * 1.15, 1, s * 1.15), col, { emis: 2.2, noShadow: true });
      if (m.mod === 'shield' && m.shOn) E.draw(orbM, T(m.x, (m.y || 0) + s * 0.75, m.z, V.t * 0.4, 0, 0, s * 1.25, s * 1.05, s * 1.25), col, { alpha: 0.16 + Math.sin(V.t * 4) * 0.04, add: true, emis: 1.2, noShadow: true, depthWrite: false });
      else if (m.mod === 'boom') E.draw(orbM, T(m.x, (m.y || 0) + s * 0.8, m.z, 0, 0, 0, s * 0.35, s * 0.35, s * 0.35), col, { emis: 2 + Math.sin(V.t * 9) * 1, noShadow: true, alpha: 0.8, add: true, depthWrite: false });
      if (!P2) return;
      if (m.mod === 'fast' && m.mv > 0.2 && Math.random() < 0.6) E.particle({ x: m.x + (Math.random() - 0.5) * s, y: (m.y || 0) + Math.random() * s * 1.2, z: m.z + (Math.random() - 0.5) * s, vx: -Math.sin(m.yaw) * 3, vy: 0, vz: -Math.cos(m.yaw) * 3, life: 0.25, size: 0.1, col, add: true });
      else if (m.mod === 'vamp' && Math.random() < 0.3) E.particle({ x: m.x + (Math.random() - 0.5) * s * 1.4, y: 0.2, z: m.z + (Math.random() - 0.5) * s * 1.4, vx: 0, vy: 0.5, vz: 0, life: 1.2, size: 0.5, grow: 1, col: '#3a0610', soft: true, a: 0.5 });
      else if ((m.mod === 'frenzy' && m.fren && Math.random() < 0.7) || (m.mod === 'frenzy' && Math.random() < 0.1)) E.particle({ x: m.x + (Math.random() - 0.5) * s, y: (m.y || 0) + s * (0.5 + Math.random()), z: m.z + (Math.random() - 0.5) * s, vx: 0, vy: 2.2, vz: 0, life: 0.45, size: 0.22, col: Math.random() < 0.5 ? '#ff2a1a' : '#ff8a1a', add: true }); }
    function drawSlime(m, V, scale, d2) {
      if (m.rig) return drawRig(m, V, scale, d2 || 0);
      const s = m.sc * (scale || 1), sq = clamp(m.sq, -0.3, 0.4), sx = s * (1 + sq * 0.5), sy = s * (1 - sq);
      const gl = m.mesh.glitch && Math.random() < 0.06 ? (Math.random() - 0.5) * 0.4 : 0;
      const mat = T(m.x + gl, m.y, m.z, m.yaw, 0, 0, sx, sy, sx, mT), hurt = m.flash > 0;
      const o = { col2: m.col2, spec: 0.9, soft: m.boss || m.raidS ? 0.9 : m.elite ? 0.65 : 0.5, rim: 1.2 }; if (hurt) o.emis = (m.boss || m.raidS ? 0.15 : 0.25) + m.flash * (m.boss || m.raidS ? 3 : 6); if (m.mesh.ghost) { o.alpha = 0.62; o.depthWrite = true; }
      E.draw(m.mesh.body, mat, hurt ? FLASH(m.col) : m.col, o);
      E.draw(m.mesh.eyes, mat, m.mesh.eye, { emis: m.boss || m.raidS ? 1.3 : 2.0, noShadow: true });
      if (m.mesh.cracks) E.draw(m.mesh.cracks, mat, '#ff6a1a', { emis: 2.5 + Math.sin(V.t * 5 + (m.uid || 0)) * 0.6, noShadow: true });
      if (E.quality === 'low') E.draw(disc, T(m.x, 0.04, m.z, 0, 0, 0, s, 1, s), '#000000', { alpha: 0.3, mode: 3, noShadow: true });
      // bosses and elites stand in a dim red haze so they read against dark floors
      if (m.boss || m.elite) E.draw(disc, T(m.x, 0.06, m.z, 0, 0, 0, s * (m.boss ? 1.6 : 1.3), 1, s * (m.boss ? 1.6 : 1.3)), m.boss ? '#ff2a1a' : '#c8281a', { alpha: m.boss ? 0.22 : 0.14, mode: 3, add: true, noShadow: true, depthWrite: false });
    }
    MB.drawSlime = drawSlime;
    // V: {t, eye, labels, parts}
    MB.draw = function (V) {
      const ex = V.eye[0], ez = V.eye[2], far2 = (E.far + 5) ** 2;
      for (const f of MB.fx) if (f.k === 'splat') { const a = Math.max(0, 1 - f.t / 4); E.draw(disc, T(f.x, 0.05 + (f.x % 1) * 0.01, f.z, f.x, 0, 0, f.s * Math.min(1, f.t * 6), 1, f.s * 0.85 * Math.min(1, f.t * 6)), f.col, { alpha: 0.75 * a, mode: 3, noShadow: true, depthWrite: false }); }
      for (const m of MB.list.values()) {
        const d2 = (m.x - ex) ** 2 + (m.z - ez) ** 2; if (d2 > far2) continue; if (m.dead) { if (m.rig && m.dead < (m.boss ? 2.2 : 1.0)) drawRig(m, V, 1, d2); continue; }
        if (m.spawnT > 0) { const k = 1 - m.spawnT / Math.max(0.6, m.spawnD); if (k > 0) { drawSlime(m, V, Math.max(0.05, k)); if (V.parts && Math.random() < 0.3) E.particle({ x: m.x + (Math.random() - 0.5) * m.sc, y: 0.1, z: m.z + (Math.random() - 0.5) * m.sc, vx: 0, vy: 2, vz: 0, life: 0.5, size: 0.2, col: m.col, a: 0.7 }); }
          else E.draw(ring, T(m.x, 0.08, m.z, 0, 0, 0, m.sc * 0.9, 1, m.sc * 0.9), m.col, { emis: 1.2, alpha: 0.6, noShadow: true }); continue; }
        if (m.kind === 'orb') { const y = (m.y || 0.9) + 0.2, pul = 1 + Math.sin(V.t * 9 + m.uid) * 0.12, s2 = 0.55 * pul; E.draw(orbM, T(m.x, y, m.z, 0, 0, 0, s2, s2, s2), m.col, { emis: 2.2, noShadow: true });
          E.draw(orbM, T(m.x, y, m.z, 0, 0, 0, s2 * 1.7, s2 * 1.7, s2 * 1.7), m.col, { alpha: 0.25, add: true, emis: 1.5, noShadow: true, depthWrite: false }); E.draw(disc, T(m.x, 0.06, m.z, 0, 0, 0, 1.4, 1, 1.4), '#ff2a1a', { alpha: 0.22, mode: 3, add: true, noShadow: true, depthWrite: false });
          if (V.parts && Math.random() < 0.5) E.particle({ x: m.x, y, z: m.z, vx: (Math.random() - 0.5), vy: 0.6, vz: (Math.random() - 0.5), life: 0.5, size: 0.18, col: m.col, add: true }); continue; }
        if (m.kind === 'heart') { const pul = 1 + Math.sin(V.t * 6) * 0.08 + (m.flash > 0 ? 0.12 : 0), y = 2.2 + Math.sin(V.t * 1.7) * 0.25;
          E.draw(crysM, T(m.x, y, m.z, V.t * 0.8, 0, 0, 0.9 * pul, 1.5 * pul, 0.9 * pul), m.flash > 0 ? '#ffffff' : '#ff2a5a', { emis: 2.4, spec: 1, noShadow: true });
          for (let j = 0; j < 3; j++) E.draw(chainM, T(m.x, y, m.z, V.t * (0.6 + j * 0.3) + j, Math.PI / 2 + j * 0.7, 0, 1.5 + j * 0.2, 1.5 + j * 0.2, 1.5 + j * 0.2), '#3a2a30', { spec: 0.8, noShadow: true });
          E.draw(disc, T(m.x, 0.07, m.z, 0, 0, 0, 3, 1, 3), '#ff2a5a', { alpha: 0.25, mode: 3, add: true, noShadow: true, depthWrite: false });
          if (MB.boss && MB.boss.immune && !MB.boss.dead) { const b = MB.boss, dx = b.x - m.x, dz = b.z - m.z, dd = Math.hypot(dx, dz); E.draw(boxM, T((m.x + b.x) / 2, y * 0.8, (m.z + b.z) / 2, Math.atan2(dx, dz), 0, 0, 0.12, 0.12, dd), '#ff2a5a', { alpha: 0.5 + Math.sin(V.t * 8) * 0.2, add: true, emis: 2, noShadow: true, depthWrite: false }); }
          if (V.labels && d2 < 1600) V.labels.push({ bar: m.hp / m.max, x: m.x, y: y + 2, z: m.z, w: 1.6, name: 'Bound Heart · break it' }); continue; }
        drawSlime(m, V, 1, d2);
        if (m.immune) E.draw(orbM, T(m.x, m.y + m.sc * 0.7, m.z, V.t * 0.5, 0, 0, m.sc * 1.45, m.sc * 1.2, m.sc * 1.45), '#ff4a8a', { alpha: 0.16 + Math.sin(V.t * 5) * 0.05, add: true, emis: 1.4, noShadow: true, depthWrite: false });
        if (m.healer) { E.draw(ring, T(m.x, 0.1, m.z, 0, 0, 0, m.sc * 1.3, 1, m.sc * 1.3), '#5aff7a', { emis: 2, noShadow: true }); if (V.parts && Math.random() < 0.3) E.particle({ x: m.x + (Math.random() - 0.5) * m.sc, y: m.sc, z: m.z + (Math.random() - 0.5) * m.sc, vx: 0, vy: 1.5, vz: 0, life: 0.7, size: 0.14, col: '#5aff7a', add: true }); }
        if (m.st === 'wind' && m.warn > 0) { const r = 1.9 + m.sc * 0.6; E.draw(disc, T(m.tx, 0.07, m.tz, 0, 0, 0, r, 1, r), TELE_COL(), { mode: 5, prog: m.warn, alpha: 0.9, add: true, noShadow: true, depthWrite: false }); }
        if (V.labels && d2 < 1100 && !m.boss && (m.hp < m.max || m.elite)) V.labels.push({ bar: m.hp / m.max, x: m.x, y: m.y + m.sc * ((m.rig && m.rig.h) || 1.35) * 0.95 + 0.35, z: m.z, w: m.elite ? 1.5 : 1, name: m.elite ? (m.mod ? MB.MOD_NAME[m.mod] + ' ' : '') + m.d.n : null });
        if (m.elite && V.parts && Math.random() < 0.3) E.particle({ x: m.x + (Math.random() - 0.5) * m.sc * 1.6, y: 0.2, z: m.z + (Math.random() - 0.5) * m.sc * 1.6, vx: 0, vy: 1.4, vz: 0, life: 0.8, size: 0.16, col: '#ff2a2a', add: true });
        if (m.boss && m.phase >= 2 && V.parts && Math.random() < (m.phase === 3 ? 0.9 : 0.6)) E.particle({ x: m.x + (Math.random() - 0.5) * m.sc * 2, y: Math.random() * m.sc * 1.5, z: m.z + (Math.random() - 0.5) * m.sc * 2, vx: 0, vy: 2, vz: 0, life: 0.8, size: 0.3, col: '#ff2a1a', add: true });
        if (m.boss && m.id === 'lich' && V.parts) for (let i = 0; i < 3; i++) { const a = V.t * 1.3 + i * TAU / 3; E.draw(boneM, T(m.x + Math.cos(a) * m.sc * 1.3, m.y + m.sc * 1.2 + Math.sin(V.t * 2 + i) * 0.4, m.z + Math.sin(a) * m.sc * 1.3, a, 0, 0, 0.45, 0.4, 0.45), BONE, { soft: 1 }); }
      }
      const bcol = MB.boss ? MB.boss.col : '#ff4a2a', bcolOf = () => MB.boss ? '#ff6a2a' : '#ff6a2a';
      const tf = (a) => ({ alpha: a, mode: 3, noShadow: true, depthWrite: false });
      const TF = (k, a) => ({ mode: 5, prog: k, alpha: a === undefined ? 0.95 : a, add: true, noShadow: true, depthWrite: false }), RF = (k, a, e) => ({ mode: 6, prog: k, edge: e || 0.04, alpha: a === undefined ? 0.95 : a, add: true, noShadow: true, depthWrite: false });
      const red = TELE_COL(), safeC = TELE_SAFE();
      for (const q of MB.tele) { const k = Math.min(1, q.t / q.dur);
        switch (q.s) {
          case 'r': E.draw(teleQ, T(q.x, 0.08, q.z, q.yaw, 0, 0, q.w * 2, 1, q.l * 2), red, RF(k, 0.95, Math.min(0.12, 0.35 / Math.max(0.5, q.w)))); break;
          case 'grid': { const T2 = q.T; for (let r = 0; r < q.nr; r++) for (let c2 = 0; c2 < q.nc; c2++) { const b = q.bits[r * q.nc + c2]; if (b === '-') continue; const x = q.x0 + (c2 + 0.5) * T2, z = q.z0 + (r + 0.5) * T2;
              if (b === '1') E.draw(teleQ, T(x, 0.08, z, 0, 0, 0, T2 - 0.3, 1, T2 - 0.3), red, RF(k, 0.85, 0.08)); else E.draw(teleQ, T(x, 0.09, z, 0, 0, 0, T2 - 0.3, 1, T2 - 0.3), safeC, RF(1, 0.55 + Math.sin(V.t * 10) * 0.15, 0.1)); } break; }
          case 'safe': { if (q.rd) E.draw(disc, T(q.x, 0.08, q.z, 0, 0, 0, q.w, 1, q.w), red, TF(k, 0.8)); else E.draw(teleQ, T(q.x, 0.08, q.z, 0, 0, 0, q.w * 2, 1, q.l * 2), red, RF(k, 0.8, 0.02));
            for (const z of q.safe) { E.draw(disc, T(z[0], 0.1, z[1], 0, 0, 0, z[2], 1, z[2]), safeC, TF(1, 0.75 + Math.sin(V.t * 8) * 0.2));
              E.draw(boxM, T(z[0], 3, z[1], 0, 0, 0, 0.25, 6, 0.25), safeC, { alpha: 0.35, add: true, emis: 2, noShadow: true, depthWrite: false }); } break; }
          case 'pool': { const warm = q.warm || 1, hot = q.t > warm, a2 = hot ? Math.min(1, (q.dur - q.t) / 0.6) : q.t / warm;
            if (!hot) E.draw(disc, T(q.x, 0.08, q.z, 0, 0, 0, q.r, 1, q.r), red, TF(a2, 0.9));
            else { E.draw(disc, T(q.x, 0.08, q.z, 0, 0, 0, q.r, 1, q.r), bcolOf(), { alpha: 0.55 * Math.max(0, a2), mode: 3, add: true, noShadow: true, depthWrite: false }); E.draw(disc, T(q.x, 0.085, q.z, 0, 0, 0, q.r, 1, q.r), red, TF(1, 0.5 * Math.max(0, a2)));
              if (V.parts && Math.random() < 0.35) E.particle({ x: q.x + (Math.random() - 0.5) * q.r * 1.4, y: 0.2, z: q.z + (Math.random() - 0.5) * q.r * 1.4, vx: 0, vy: 1.6, vz: 0, life: 0.8, size: 0.2, col: bcolOf(), add: true }); } break; }
          default: E.draw(disc, T(q.x, 0.08, q.z, 0, 0, 0, q.r, 1, q.r), red, TF(k));
        } }
      for (const s of MB.shots) { const k = s.t / s.dur, x = s.x0 + (s.x - s.x0) * k, z = s.z0 + (s.z - s.z0) * k, y = s.small ? 1 + Math.sin(k * Math.PI) * 3.5 - k * 0.9 : 4 + Math.sin(k * Math.PI) * 9 - k * 4, r = s.small ? 0.3 : 0.5, col = s.col || bcol;
        E.draw(orbM, T(x, y, z, 0, 0, 0, r, r, r), col, { spec: 1, emis: 0.9 }); if (V.parts) E.particle({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.3, size: r * 0.8, col, a: 0.6 }); }
      for (const g of MB.rings) { E.draw(ring, T(g.x, 0.25, g.z, 0, 0, 0, g.r, 4, g.r), '#ff5a2a', { emis: 2.5, noShadow: true }); E.draw(ring, T(g.x, 0.25, g.z, 0, 0, 0, Math.max(0.1, g.r - 0.25), 2, Math.max(0.1, g.r - 0.25)), bcol, { emis: 1, noShadow: true }); }
      const R = MB.raid; if (R) { if (!R.rig && BS) { const WB = C.WORLD_BOSSES[(R.info && R.info.wb) || 0] || C.WORLD_BOSSES[0]; R.rig = BS.get(WB.rig) || BS.get('king'); R.d.col = WB.col; R.anim = { t: 0, mv: 0, ph: 0, w: 0, atk: 0, hurt: 0, sq: 0, air: 0, die: 0, phase: 1, phT: 9 }; R.mv = 0; R.ph = 0; } drawSlime(R, V, 1, 0); if (R.ring > 0) E.draw(ring, T(R.x, 0.25, R.z, 0, 0, 0, R.ringR, 4, R.ringR), '#ff3aff', { emis: 2.5, noShadow: true }); }
      for (const q of MB.rain) { if (q.dead) continue; drawSlime({ x: q.x, y: q.y, z: q.z, sc: 0.55, sq: q.y > 0.05 ? -0.15 : 0.1, yaw: q.t, mesh: meshFor('plain'), col: q.col, col2: shade(q.col, 0.4), flash: 0, uid: 0 }, V); }
      for (const c of MB.coins) E.draw(coinM, T(c.x, c.y, c.z, V.t * 6, Math.PI / 2, 0, 1, 1, 1), '#c9a24a', { spec: 1, emis: 0.35, noShadow: true });
    };
    return MB;
  };
})(typeof self !== 'undefined' ? self : this);
