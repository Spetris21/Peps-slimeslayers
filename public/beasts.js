/* Slime Slayers - creature bodies. Slimes can take any shape: hounds, knights, ghosts, serpents, swarms, golems.
   Every body is a small rig of parts (one mesh each) posed every frame from the slime's state:
   s = {t, mv (moving 0-1), ph (stride phase), w (wind-up 0-1), atk (attack pulse 0-1), hurt, sq (squash), air, die (0-1), phase, phT (time since phase change), lod}.
   White vertices take the slime's colour, magenta its darker shade, everything else keeps its own colour (bone, gold, iron...). */
(function (root) {
  'use strict';
  root.SSBeasts = function (E, L) {
    const B = {};
    const M = E.M, G = E.G, T = M.trs, TAU = Math.PI * 2, S = G.STRIDE;
    const X = (geo, x, y, z, yaw, pit, rol, sx, sy, sz) => G.xf(geo, T(x, y, z, yaw || 0, pit || 0, rol || 0, sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz));
    const paint = (geo, c) => { const a = geo.slice(), q = c === 'B' ? [1, 1, 1] : c === 'S' ? [1, 0, 1] : M.col(c); for (let i = 6; i < a.length; i += S) { a[i] = q[0]; a[i + 1] = q[1]; a[i + 2] = q[2]; } return a; };
    const P = (geo, c, x, y, z, yaw, pit, rol, sx, sy, sz) => paint(X(geo, x, y, z, yaw, pit, rol, sx, sy, sz), c);
    const cat = (...g) => [].concat(...g);
    // ---------------------------------------------------------------- shapes
    const SPH = G.sphere(1, 10, 7), SPL = G.sphere(1, 8, 5), SPS = G.sphere(1, 6, 4), CY = G.cyl(1, 1, 1, 8), CY5 = G.cyl(1, 1, 1, 5), CO = G.cyl(0, 1, 1, 6), CO4 = G.cyl(0, 1, 1, 4), BF = G.box(1, 1, 1, 0), BX = BF;
    const TOR = G.torus(1, 0.22, 12, 5), TORT = G.torus(1, 0.1, 12, 3), IC = G.ico(1, 0.3, 11), OCT = G.cyl(0, 1, 1, 4).concat(G.xf(G.cyl(0, 1, 1, 4), T(0, -1, 0, 0, Math.PI, 0)));
    const BONE = '#d8d0b8', DARK = '#141018', GOLD = '#c8a040', IRON = '#3a3a46', MOUTH = '#100608', TOOTH = '#e8e0c8', LAVA = '#ff6a1a';
    // lumpy goo: a sphere pushed in and out a little so it never looks machine-made
    function lump(geo, k, seed) { const a = geo.slice(); for (let i = 0; i < a.length; i += S) { const x = a[i], y = a[i + 1], z = a[i + 2], w = 1 + k * Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 2.3) * Math.sin(z * 3.3 + seed * 0.7) * 2.2; a[i] = x * w; a[i + 1] = y * w; a[i + 2] = z * w; } return a; }
    const goo = (rx, ry, rz, seed, k, lo) => lump(X(lo ? SPL : SPH, 0, 0, 0, 0, 0, 0, rx, ry, rz), k === undefined ? 0.05 : k, seed || 1);
    // a limb hanging down from its pivot (rounded, tapering)
    const tube = (len, r0, r1, seg) => G.lathe([[0, -len - r1 * 0.9], [r1 * 0.95, -len - r1 * 0.3], [r1, -len], [r0, -len * 0.08], [r0 * 0.7, r0 * 0.5], [0, r0 * 0.7]], seg || 8);
    // drops of goo hanging off a rim
    function drips(n, r, y, len, seed) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + (seed || 0), l = len * (0.6 + ((i * 7919) % 5) / 8); o.push(...P(SPS, 'B', Math.sin(a) * r, y - l * 0.5, Math.cos(a) * r, 0, 0, 0, 0.06 + l * 0.08, l * 0.5, 0.06 + l * 0.08)); } return o; }
    function spikes(n, r, y, len, w, col, tilt, seed) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + (seed || 0); o.push(...P(CO, col, Math.sin(a) * r, y, Math.cos(a) * r, a, Math.PI / 2 - (tilt || 0.4), 0, w, len, w)); } return o; }
    function horn(x, y, z, sd, len, w, col, curl) { const o = []; let yy = y, xx = x, zz = z, rot = sd * -0.4; for (let i = 0; i < 3; i++) { const ww = w * (1 - i * 0.28); o.push(...P(CO, i === 2 ? DARK : col, xx, yy, zz, 0, -0.1 - i * (curl || 0.25), rot, ww, len * 0.42, ww)); xx += sd * len * 0.12; yy += len * 0.3; zz -= len * 0.08; rot += sd * -0.32; } return o; }
    const eyeG = list => cat(...list.map(e => X(SPS, e[0], e[1], e[2], 0, 0, 0, e[3], e[4] || e[3] * 0.6, e[5] || e[3] * 0.5)));
    function teeth(n, w, y, z, len, up) { const o = []; for (let i = 0; i < n; i++) { const x = (i / (n - 1) - 0.5) * w; o.push(...P(CO4, TOOTH, x, y, z - Math.abs(x) * 0.3, 0, up ? 0 : Math.PI, 0, 0.035 + len * 0.1, len, 0.035 + len * 0.1)); } return o; }
    // ---------------------------------------------------------------- the rig
    function Rig() { const parts = [];
      return { parts, add(geo, at, parent, anim, o) { parts.push(Object.assign({ g: geo, at: at || [0, 0, 0], p: parent === undefined ? -1 : parent, a: anim || null }, o || {})); return parts.length - 1; },
        done(meta) { for (const q of parts) { q.m = E.mesh(q.g); q.g = null; } return Object.assign({ parts }, meta || {}); } }; }
    const A = new Float32Array(9), LM = new Float32Array(16), WM = [];
    const hide = A2 => { A2[6] = A2[7] = A2[8] = 0; };
    // draw a rig. base = root matrix, o = {col, col2, eye, glow, body (draw options for body parts)}
    function draw(rig, base, s, o) {
      const n = rig.parts.length; while (WM.length < n) WM.push(new Float32Array(16));
      for (let i = 0; i < n; i++) { const q = rig.parts[i]; A[0] = A[1] = A[2] = A[3] = A[4] = A[5] = 0; A[6] = A[7] = A[8] = 1;
        if (q.p2 && s.phase < 2) { hide(A); } else if (q.p1 && s.phase >= 2) { hide(A); }
        if (q.a && A[6] !== 0) q.a(s, A, q);
        if (q.p2 && s.phase >= 2 && s.phT < 0.6) { const k = s.phT / 0.6; A[6] *= k; A[7] *= k; A[8] *= k; }
        T(q.at[0] + A[0], q.at[1] + A[1], q.at[2] + A[2], A[3], A[4], A[5], A[6], A[7], A[8], LM); M.mul(q.p < 0 ? base : WM[q.p], LM, WM[i]);
        if (A[6] === 0 || (q.lod && s.lod)) continue;
        if (q.eye) E.draw(q.m, WM[i], o.eye, { emis: q.ge || 2.2, noShadow: true, rim: 0 });
        else if (q.glow) E.draw(q.m, WM[i], q.glow === 1 ? o.glow || o.eye : q.glow, { emis: (q.ge || 1.8) * (s.phase >= 2 && q.pulse ? 1.4 + Math.sin(s.t * 6) * 0.3 : 1), noShadow: true, rim: 0, alpha: q.alpha, add: q.add, depthWrite: q.alpha ? false : undefined });
        else E.draw(q.m, WM[i], o.col, q.alpha ? Object.assign({}, o.body, { alpha: q.alpha * (o.body.alpha || 1), depthWrite: true }) : o.body);
      }
    }
    // ---------------------------------------------------------------- common motions
    const sw = (s, off, amp) => Math.sin(s.ph * TAU + off) * amp * s.mv;
    const breathe = (s, A2, k) => { const b = 1 + Math.sin(s.t * 2.2) * (k || 0.03); A2[6] *= b * (1 + s.sq * 0.4); A2[7] *= (2 - b) * (1 - s.sq); A2[8] *= b; };
    const dieDroop = (s, A2, k) => { if (s.die) { A2[4] += s.die * (k || 0.6); A2[1] -= s.die * 0.2; } };
    // ================================================================ BODY PLANS
    // four legs (or six): hounds, wolves, beasts, beetles, dragons, the Mimic
    function quad(o) {
      const r = Rig(), Lg = o.L || 0.45, bw = o.bw || 0.55, bh = o.bh || 0.42, bl = o.bl || 0.8, hr = o.hr || 0.34, n = o.legs || 4;
      const body = r.add(cat(paint(goo(bw, bh, bl, o.seed || 2, o.lumpy), 'B'), drips(4, bw * 0.8, -bh * 0.55, 0.22, 0.4), o.bodyF ? o.bodyF(bw, bh, bl) : []), [0, Lg + bh * 0.55, 0], -1, (s, A2) => {
        A2[1] = Math.abs(Math.sin(s.ph * TAU * 2)) * 0.05 * s.mv - s.w * 0.12 + s.atk * 0.05; A2[4] = -s.w * 0.22 + s.atk * 0.3; A2[2] = s.atk * 0.35 - s.hurt * 0.1; A2[5] = Math.sin(s.ph * TAU) * 0.05 * s.mv; breathe(s, A2, 0.025); if (s.die) { A2[1] -= s.die * (Lg + bh * 0.3); A2[5] += s.die * 0.5; } });
      const head = r.add(cat(paint(goo(hr, hr * 0.85, hr * 1.05, (o.seed || 2) + 3), 'B'), o.headF ? o.headF(hr) : []), [0, bh * 0.35 + (o.hy || 0), bl * 0.9 + (o.hz || 0)], body, (s, A2) => {
        A2[4] = -s.w * 0.5 + s.atk * 0.55 + Math.sin(s.t * 1.3) * 0.05; A2[3] = Math.sin(s.t * 0.7) * 0.2 * (1 - s.mv) * (1 - s.w); A2[2] = s.w * -0.08; dieDroop(s, A2, 0.8); });
      if (o.jaw !== false) r.add(cat(P(BX, 'S', 0, -hr * 0.05, hr * 0.45, 0, 0, 0, hr * 1.2, hr * 0.28, hr * 1.0), P(BF, MOUTH, 0, hr * 0.09, hr * 0.48, 0, 0, 0, hr * 1.0, 0.02, hr * 0.85), teeth(5, hr * 0.9, hr * 0.1, hr * 0.92, hr * 0.28, true)),
        [0, -hr * 0.38, hr * 0.25], head, (s, A2) => { A2[4] = s.w * 0.55 + s.atk * 0.3 + Math.max(0, Math.sin(s.t * 1.7)) * 0.06 + s.die * 0.5; }, { lod: 1 });
      r.add(eyeG(o.eyes || [[-hr * 0.42, hr * 0.28, hr * 0.86, hr * 0.15], [hr * 0.42, hr * 0.28, hr * 0.86, hr * 0.15]]), [0, 0, 0], head, null, { eye: 1 });
      const lc = o.legC || 'S', lr0 = o.lr0 || 0.12, lr1 = o.lr1 || 0.085;
      for (let k = 0; k < n; k++) { const sd = k % 2 ? 1 : -1, row = Math.floor(k / 2), rows = n / 2, zf = rows === 1 ? 0 : row / (rows - 1) * 2 - 1, off = (row % 2 ? Math.PI : 0) + (sd > 0 ? Math.PI : 0);
        r.add(cat(paint(tube(Lg + bh * 0.45, lr0, lr1), lc), o.footF ? o.footF(Lg + bh * 0.45, lr1) : P(SPS, lc, 0, -(Lg + bh * 0.45) - lr1 * 0.3, lr1 * 0.6, 0, 0, 0, lr1 * 1.5, lr1 * 0.8, lr1 * 2)),
          [sd * bw * (o.legOut || 0.72), -bh * 0.3, -zf * bl * (o.legSpread || 0.6)], body, (s, A2) => { A2[4] = sw(s, off, 0.75) + s.w * 0.25 * -zf; A2[5] = sd * (0.06 + s.die * 0.9) + (n > 4 ? sd * 0.35 : 0); A2[1] = Math.max(0, Math.sin(s.ph * TAU + off)) * 0.06 * s.mv; }, { lod: n > 4 && row === 1 ? 1 : 0 }); }
      if (o.tail) { const tl = o.tail; r.add(cat(paint(X(CO, 0, 0, -tl * 0.5, 0, -Math.PI / 2, 0, o.tw || 0.12, tl, o.tw || 0.12), o.tailC || 'B'), o.tailF ? o.tailF(tl) : []), [0, bh * 0.15, -bl * 0.9], body, (s, A2) => { A2[3] = Math.sin(s.t * (3 + s.mv * 5)) * (0.25 + s.w * 0.3); A2[4] = 0.25 - s.w * 0.4 + s.die * 0.4; }); }
      if (o.extra) o.extra(r, body, head);
      return r.done({ h: Lg + bh * 2 + hr, kind: 'quad' });
    }
    // two legs, two arms: golems, knights, skeletons, imps, giants
    function biped(o) {
      const r = Rig(), Lg = o.L || 0.55, tw = o.tw || 0.48, th = o.th || 0.55, td = o.td || 0.34, hr = o.hr || 0.3, al = o.al || 0.62, ar = o.ar || 0.12;
      const hips = r.add(paint(goo(tw * 0.8, 0.16, td * 0.9, 4), o.hipC || 'S'), [0, Lg, 0], -1, (s, A2) => { A2[1] = Math.abs(Math.sin(s.ph * TAU * 2)) * 0.05 * s.mv - s.w * 0.08; A2[3] = Math.sin(s.ph * TAU) * 0.12 * s.mv; if (s.die) A2[1] -= s.die * Lg * 0.9; });
      const torso = r.add(cat(paint(goo(tw, th * 0.6, td, o.seed || 5, o.lumpy), 'B'), drips(5, tw * 0.75, -th * 0.35, 0.2, 1.2), o.torsoF ? o.torsoF(tw, th, td) : []), [0, th * 0.55, 0], hips, (s, A2) => {
        A2[4] = -s.w * 0.3 + s.atk * 0.45 + 0.08 * s.mv; A2[3] = -Math.sin(s.ph * TAU) * 0.1 * s.mv + s.w * (o.twist || 0); A2[2] = -s.hurt * 0.12; breathe(s, A2, 0.02); dieDroop(s, A2, 0.9); });
      const head = r.add(cat(paint(goo(hr, hr * 0.95, hr * 0.95, (o.seed || 5) + 4), o.headC || 'B'), o.headF ? o.headF(hr) : []), [0, th * 0.62 + hr * 0.75, td * 0.1], torso, (s, A2) => { A2[4] = -s.w * 0.2 + s.atk * 0.25 + Math.sin(s.t * 1.1) * 0.04; A2[3] = Math.sin(s.t * 0.6) * 0.25 * (1 - s.mv); dieDroop(s, A2, 0.7); });
      r.add(eyeG(o.eyes || [[-hr * 0.38, hr * 0.15, hr * 0.84, hr * 0.15], [hr * 0.38, hr * 0.15, hr * 0.84, hr * 0.15]]), [0, 0, 0], head, null, { eye: 1 });
      const swing = o.swing || 'both';   // both: both arms overhead then slam. right: one arm winds back then punches
      for (const sd of [-1, 1]) {
        r.add(cat(paint(tube(al, ar, ar * (o.fist ? 0.9 : 0.8)), o.armC || 'B'), o.fist ? P(o.fistS || SPH, o.fistC || 'S', 0, -al - o.fist * 0.4, 0.02, 0, 0, 0, o.fist, o.fist * 0.9, o.fist) : [], o.handF ? o.handF(sd, al) : []),
          [sd * (tw + ar * 0.6), th * 0.4, 0], torso, (s, A2) => { const both = swing === 'both' || sd > 0; A2[4] = -sw(s, sd > 0 ? 0 : Math.PI, 0.7) + (both ? -s.w * 2.5 + s.atk * 3.2 : s.w * 0.3) + (o.armRest || 0); A2[5] = sd * (0.12 + s.w * 0.25 * (both ? 1 : 0) + s.die * 0.8) + sd * (o.armOut || 0); if (o.armIdle) A2[4] += Math.sin(s.t * 1.7 + sd) * o.armIdle; }); }
      for (const sd of [-1, 1]) r.add(cat(paint(tube(Lg + 0.04, o.lr0 || 0.15, o.lr1 || 0.12), o.legC || 'S'), o.footF ? o.footF(Lg, sd) : P(BX, o.legC || 'S', 0, -Lg - 0.02, 0.06, 0, 0, 0, (o.lr1 || 0.12) * 2.2, 0.12, (o.lr1 || 0.12) * 3)),
        [sd * tw * 0.45, 0, 0], hips, (s, A2) => { A2[4] = sw(s, sd > 0 ? Math.PI : 0, 0.65) - s.w * 0.15; A2[5] = sd * (0.04 + s.die * 0.4); });
      if (o.extra) o.extra(r, torso, head, hips);
      return r.done({ h: Lg + th + hr * 2, kind: 'biped' });
    }
    // floating: ghosts, wisps, jellyfish, eyes, bats. Tendrils trail and sway
    function floater(o) {
      const r = Rig(), hv = o.hover || 1.1, br = o.br || 0.55;
      const core = r.add(cat(o.coreG ? o.coreG(br) : paint(goo(br, br * (o.bry || 1), br, o.seed || 7), 'B'), o.coreF ? o.coreF(br) : []), [0, hv, 0], -1, (s, A2) => {
        A2[1] = Math.sin(s.t * 1.8) * 0.12 + s.w * 0.35 - s.atk * 0.4; A2[4] = s.mv * 0.25 - s.w * 0.3 + s.atk * 0.5; A2[5] = Math.sin(s.t * 1.3) * 0.08; const b = 1 + s.w * 0.15 + Math.sin(s.t * 3) * 0.03; A2[6] = A2[8] = b; A2[7] = b * (1 - s.sq * 0.5);
        if (o.spin) A2[3] = s.t * o.spin; if (s.die) A2[1] -= s.die * hv; }, o.coreO);
      if (o.eyes !== false) r.add(eyeG(o.eyes || [[-br * 0.36, br * 0.2, br * 0.88, br * 0.16], [br * 0.36, br * 0.2, br * 0.88, br * 0.16]]), [0, 0, 0], core, o.eyeA || null, { eye: 1 });
      const nt = o.tendrils || 0, tl = o.tl || 0.8;
      for (let k = 0; k < nt; k++) { const a = k / nt * TAU + 0.3, rr = br * (o.tr || 0.6), seg = o.tseg || 2;
        let prev = r.add(paint(tube(tl / seg, o.tw || 0.08, (o.tw || 0.08) * 0.75, 6), o.tC || 'B'), [Math.sin(a) * rr, -br * (o.ty || 0.6), Math.cos(a) * rr], core, (s, A2) => { A2[4] = Math.sin(s.t * 2.1 + k) * 0.3 - s.mv * 0.4; A2[5] = Math.cos(s.t * 1.7 + k * 1.3) * 0.3; }, { lod: k % 2, alpha: o.tAlpha });
        for (let j = 1; j < seg; j++) prev = r.add(paint(tube(tl / seg, (o.tw || 0.08) * 0.75, (o.tw || 0.08) * 0.45, 6), o.tC || 'B'), [0, -tl / seg, 0], prev, (s, A2) => { A2[4] = Math.sin(s.t * 2.1 + k + j * 0.9) * 0.35 - s.mv * 0.3; A2[5] = Math.cos(s.t * 1.9 + k + j) * 0.3; }, { lod: 1, alpha: o.tAlpha }); }
      if (o.wings) for (const sd of [-1, 1]) r.add(paint(o.wingG ? o.wingG(sd) : cat(X(BF, sd * o.wings * 0.5, 0, -0.05, 0, 0, 0, o.wings, 0.03, o.wings * 0.55), X(CO4, sd * o.wings, 0, 0.05, 0, Math.PI / 2, 0, 0.04, 0.3, 0.04)), o.wingC || 'S'),
        [sd * br * 0.7, br * 0.15, -br * 0.1], core, (s, A2) => { A2[5] = sd * (Math.sin(s.t * (o.flap || 9)) * 0.6 + s.w * 0.4) - sd * s.die * 0.8; });
      if (o.extra) o.extra(r, core);
      return r.done({ h: hv + br * 2, kind: 'floater', fly: true });
    }
    // long and low with many little legs: crawlers, creepers
    function crawler(o) {
      const r = Rig(), n = o.segs || 3, sr = o.sr || 0.38, gap = o.gap || 0.55, Lg = o.L || 0.22;
      const segs = []; for (let i = 0; i < n; i++) { const k = 1 - i / (n + 1) * 0.5, z = -i * gap * k + gap * 0.6;
        segs.push(r.add(cat(paint(goo(sr * k * 1.1, sr * k * 0.75, sr * k, i + 9, 0.05, i > 0), 'B'), i === 0 && o.headF ? o.headF(sr) : [], o.segF ? o.segF(i, sr * k) : [], drips(3, sr * k * 0.8, -sr * 0.45 * k, 0.12, i)),
          [0, Lg + sr * k * 0.6, z], -1, (s, A2) => { A2[0] = Math.sin(s.t * 3 + s.ph * 4 - i * 0.9) * 0.08 * (0.3 + s.mv); A2[3] = Math.sin(s.ph * TAU * 2 - i * 1.1) * 0.15 * s.mv; A2[1] = Math.sin(s.t * 2 - i) * 0.02 - (i === 0 ? s.w * 0.15 - s.atk * 0.1 : 0); if (i === 0) { A2[4] = -s.w * 0.5 + s.atk * 0.6; A2[2] = s.atk * 0.3; } if (s.die) A2[1] -= s.die * Lg; breathe(s, A2, 0.03); }));
        if (o.legs !== false) for (const sd of [-1, 1]) r.add(paint(cat(X(CY5, sd * 0.22, 0, 0, 0, 0, sd * 1.2, o.lw || 0.05, 0.44, o.lw || 0.05), X(CO4, sd * 0.42, -0.2, 0, 0, 0, sd * 0.25 + Math.PI, o.lw || 0.05, 0.3, o.lw || 0.05)), o.legC || 'S'), [sd * sr * k * 0.8, -sr * 0.35 * k, 0], segs[i], (s, A2) => { A2[4] = Math.sin(s.ph * TAU * 2 + i * 1.7 + (sd > 0 ? Math.PI : 0)) * 0.6 * s.mv; A2[5] = sd * (0.1 + s.die * 0.6); }, { lod: i % 2 }); }
      r.add(eyeG(o.eyes || [[-sr * 0.4, sr * 0.3, sr * 0.88, sr * 0.14], [sr * 0.4, sr * 0.3, sr * 0.88, sr * 0.14]]), [0, 0, 0], segs[0], null, { eye: 1 });
      if (o.extra) o.extra(r, segs);
      return r.done({ h: Lg + sr * 1.6, kind: 'crawler' });
    }
    // a chain of segments that slithers (or flies, with wings)
    function serpent(o) {
      const r = Rig(), n = o.segs || 6, sr = o.sr || 0.36, gap = o.gap || 0.5, hv = o.hover || 0;
      const at = (s, i) => { const w = s.t * (2.2 + s.mv * 3) - i * 0.75, amp = (0.22 + s.mv * 0.25) * (i / n + 0.2); return [Math.sin(w) * amp, hv ? Math.sin(s.t * 1.4 - i * 0.6) * 0.25 : 0]; };
      const head = r.add(cat(paint(goo(sr * 1.15, sr * 0.85, sr * 1.3, 13), 'B'), o.headF ? o.headF(sr) : []), [0, hv + sr * 0.9, gap * 0.6], -1, (s, A2) => {
        const q = at(s, 0); A2[0] = q[0]; A2[1] = q[1] + s.w * (o.rear || 0.9) - s.atk * 0.5 + Math.sin(s.t * 1.5) * 0.06; A2[4] = -s.w * 0.6 + s.atk * 0.8; A2[2] = s.atk * 0.8 - s.w * 0.2; if (s.die) A2[1] -= s.die * (hv + sr * 0.6); });
      if (o.jaw !== false) r.add(cat(P(BX, 'S', 0, 0, sr * 0.7, 0, 0, 0, sr * 1.3, sr * 0.3, sr * 1.3), teeth(6, sr * 1.1, sr * 0.15, sr * 1.25, sr * 0.3, true)), [0, -sr * 0.4, sr * 0.1], head, (s, A2) => { A2[4] = s.w * 0.7 + s.atk * 0.4 + Math.max(0, Math.sin(s.t * 1.3)) * 0.08; }, { lod: 1 });
      r.add(eyeG(o.eyes || [[-sr * 0.55, sr * 0.35, sr * 1.0, sr * 0.16], [sr * 0.55, sr * 0.35, sr * 1.0, sr * 0.16]]), [0, 0, 0], head, null, { eye: 1 });
      for (let i = 1; i <= n; i++) { const k = 1 - i / (n + 2) * 0.75;
        r.add(cat(paint(goo(sr * k, sr * k * 0.85, sr * k * 1.1, 13 + i, 0.05, 1), 'B'), o.segF ? o.segF(i, sr * k) : []), [0, hv + sr * k * 0.85, -i * gap * (0.9 + k * 0.1)], -1, (s, A2) => {
          const q = at(s, i); A2[0] = q[0]; A2[1] = q[1] - (s.die ? s.die * (hv + sr * k * 0.5) : 0); A2[3] = Math.cos(s.t * (2.2 + s.mv * 3) - i * 0.75) * 0.4; breathe(s, A2, 0.03); }, { lod: i % 2 === 0 && i > 2 ? 1 : 0 }); }
      if (o.extra) o.extra(r, head);
      return r.done({ h: hv + sr * 2.5, kind: 'serpent' });
    }
    // a swarm: several small bodies hopping around one centre
    function swarm(o) {
      const r = Rig(), n = o.n || 5, br = o.br || 0.26;
      const hub = r.add([], [0, 0, 0], -1, (s, A2) => { if (s.die) { A2[6] = A2[7] = A2[8] = 1 - s.die; } });
      for (let k = 0; k < n; k++) { const a0 = k / n * TAU, rr = (o.spread || 0.6) * (0.6 + (k % 3) * 0.25);
        const b = r.add(cat(o.oneG ? o.oneG(br, k) : paint(goo(br, br * 0.7, br * 1.2, k + 20, 0.05, 1), 'B'), drips(2, br * 0.7, -br * 0.4, 0.08, k)), [0, br * 0.7, 0], hub, (s, A2) => {
          const a = a0 + s.t * (0.7 + (k % 2) * 0.4) * (k % 2 ? 1 : -1), ph = (s.t * (2.5 + k * 0.3) + k * 0.37) % 1; A2[0] = Math.sin(a) * rr * (1 - s.w * 0.6); A2[2] = Math.cos(a) * rr * (1 - s.w * 0.6) + s.atk * 0.6;
          A2[1] = (o.fly ? 0.6 + Math.sin(s.t * 3 + k) * 0.25 : Math.max(0, Math.sin(ph * Math.PI)) * 0.25 * (0.3 + s.mv)) + s.w * 0.15; A2[3] = a + Math.PI / 2 * (k % 2 ? 1 : -1); if (o.jitter && Math.random() < 0.04) A2[0] += (Math.random() - 0.5) * 0.4; });
        if (o.eyesEach !== false && k % 2 === 0) r.add(eyeG([[-br * 0.35, br * 0.25, br * 1.05, br * 0.18], [br * 0.35, br * 0.25, br * 1.05, br * 0.18]]), [0, 0, 0], b, null, { eye: 1, lod: 1 }); }
      if (o.extra) o.extra(r, hub);
      return r.done({ h: 1.0, kind: 'swarm' });
    }
    B.swarm = swarm;
    // ================================================================ THE DUNGEON CREATURES (by slime id)
    const bark = '#3a2616', moss = '#2e5a26', leaf = ['#17361a', '#1f4420', '#2a5222'];
    const DEF = {
      // ---- Mossy Woods: mossy beasts, mushroom crawlers, thorn creepers
      moss: () => quad({ seed: 3, bw: 0.58, bh: 0.44, bl: 0.72, hr: 0.36, L: 0.32, tail: 0.4, bodyF: (w, h, l) => cat(...[0, 1, 2, 3, 4].map(i => P(IC, i % 2 ? '#1e4a1a' : '#2a6224', Math.sin(i * 1.9) * w * 0.5, h * 0.75, l * (0.5 - i * 0.25), i, 0, 0, 0.22 + (i % 3) * 0.06, 0.14, 0.22)), horn(0.18, h * 0.6, l * 0.6, 1, 0.35, 0.05, bark, 0.1), horn(-0.18, h * 0.6, l * 0.6, -1, 0.35, 0.05, bark, 0.1)),
        headF: hr => cat(horn(hr * 0.5, hr * 0.5, 0, 1, 0.45, 0.06, bark, 0.35), horn(-hr * 0.5, hr * 0.5, 0, -1, 0.45, 0.06, bark, 0.35)) }),
      shroom: () => crawler({ segs: 3, sr: 0.36, L: 0.16, segF: (i, r2) => i > 0 ? cat(P(CY5, '#c8bca0', 0, r2 * 0.6, 0, 0, 0, 0, r2 * 0.18, r2 * 0.6, r2 * 0.18), P(G.lathe([[0, 0], [1, 0], [0.8, 0.3], [0, 0.42]], 10), '#7a2a1a', 0, r2 * 0.95, 0, 0, 0, 0, r2 * 0.75, r2 * 0.7, r2 * 0.75)) : [],
        headF: sr => cat(P(G.lathe([[0, 0], [1, 0], [0.95, 0.28], [0.55, 0.55], [0, 0.62]], 16), '#6a1a14', 0, sr * 0.55, -sr * 0.1, 0, -0.15, 0, sr * 1.7, sr * 1.5, sr * 1.7), ...[0, 1, 2, 3, 4, 5].map(i => P(SPS, '#d8ccb0', Math.sin(i * 2.4) * sr * 0.95, sr * (1.25 + (i % 2) * 0.1), Math.cos(i * 2.4) * sr * 0.95 - sr * 0.1, 0, 0, 0, sr * 0.2, sr * 0.1, sr * 0.2))) }),
      thorn: () => serpent({ segs: 6, sr: 0.3, gap: 0.42, rear: 0.6, headF: sr => cat(spikes(7, sr * 0.9, sr * 0.3, 0.3, 0.05, '#0e1a08', 0.2), horn(sr * 0.4, sr * 0.6, 0, 1, 0.4, 0.05, '#1a2a10', 0.2), horn(-sr * 0.4, sr * 0.6, 0, -1, 0.4, 0.05, '#1a2a10', 0.2)),
        segF: (i, r2) => spikes(5, r2 * 0.85, r2 * 0.25, 0.25, 0.04, '#0e1a08', 0.15, i) }),
      brute: () => biped({ seed: 8, L: 0.42, tw: 0.62, th: 0.7, td: 0.48, hr: 0.28, al: 0.78, ar: 0.17, fist: 0.26, fistS: IC, fistC: '#4a4a40', armRest: -0.25, twist: 0.3,
        torsoF: (w, h, d) => cat(...[0, 1, 2, 3, 4, 5].map(i => P(IC, i % 2 ? '#1e4a1a' : '#2a6224', Math.sin(i * 1.4) * w * 0.6, h * 0.35 + (i % 3) * 0.1, -d * 0.6, i, 0, 0, 0.26, 0.18, 0.2)), horn(w * 0.45, h * 0.5, -0.1, 1, 0.5, 0.07, bark, 0.15), horn(-w * 0.45, h * 0.5, -0.1, -1, 0.5, 0.07, bark, 0.15)),
        headF: hr => horn(hr * 0.6, hr * 0.4, 0.05, 1, 0.5, 0.06, '#b8ac90', 0.3).concat(horn(-hr * 0.6, hr * 0.4, 0.05, -1, 0.5, 0.06, '#b8ac90', 0.3)) }),
      // Update 7: the Bark Warden, the woods' second mini-boss: a tall knot of bark with a crown of antlers and moss on its shoulders
      barkwarden: () => biped({ seed: 9, L: 0.58, tw: 0.54, th: 0.78, td: 0.42, hr: 0.27, al: 0.84, ar: 0.15, fist: 0.22, fistS: IC, fistC: '#3a2a18', armRest: -0.15, twist: 0.25, swing: 'both',
        torsoF: (w, h, d) => cat(...[0, 1, 2, 3].map(i => P(CY5, '#3a2a18', (i - 1.5) * w * 0.45, h * 0.1, d * 0.62, 0, 0.1 * (i - 1.5), 0, 0.09, h * 0.9, 0.09)), ...[0, 1, 2].map(i => P(IC, '#3a7a2a', (i - 1) * w * 0.7, h * 0.62, -d * 0.2, i, 0, 0, 0.3, 0.16, 0.26))),
        headF: hr => cat(horn(hr * 0.5, hr * 0.5, 0, 1, 0.9, 0.06, '#5a4028', 0.6), horn(-hr * 0.5, hr * 0.5, 0, -1, 0.9, 0.06, '#5a4028', 0.6), horn(hr * 0.3, hr * 0.7, -0.05, 1, 0.55, 0.045, '#5a4028', 0.4), horn(-hr * 0.3, hr * 0.7, -0.05, -1, 0.55, 0.045, '#5a4028', 0.4)) }),
      // ---- Desert Temple: sand serpents, scarab swarms, mummified walkers
      sand: () => serpent({ segs: 7, sr: 0.3, gap: 0.38, rear: 1.1, headF: sr => cat(P(CO, '#8a6a3a', 0, sr * 0.2, sr * 1.3, 0, Math.PI / 2, 0, sr * 0.35, sr * 0.6, sr * 0.35), spikes(4, sr * 0.6, sr * 0.7, 0.22, 0.04, '#6a4a24', -0.6)), segF: (i, r2) => P(TOR, '#8a6a3a', 0, 0, 0, 0, Math.PI / 2, 0, r2 * 0.95, r2 * 0.95, r2 * 0.6) }),
      scarab: () => swarm({ n: 5, br: 0.24, spread: 0.6, oneG: (br, k) => cat(paint(goo(br, br * 0.65, br * 1.2, k + 30, 0.05, 1), 'B'), P(TORT, GOLD, 0, br * 0.3, 0, 0, Math.PI / 2, 0, br * 0.05, br * 1.1, br * 1.2), P(BF, DARK, 0, br * 0.55, 0, 0, 0, 0, 0.02, 0.04, br * 2.2),
        ...[-1, 1].flatMap(sd => [0, 1, 2].map(j => P(CY5, DARK, sd * br * 1.0, -br * 0.3, (j - 1) * br * 0.6, 0, 0, sd * 1.0, 0.02, br * 0.8, 0.02))), P(CO4, '#3a2a14', 0, br * 0.1, br * 1.35, 0, Math.PI / 2 - 0.3, 0, 0.05, br * 0.5, 0.05)) }),
      mummy: () => biped({ seed: 12, L: 0.55, tw: 0.42, th: 0.6, td: 0.3, hr: 0.28, al: 0.62, ar: 0.11, armRest: -1.3, armIdle: 0.12, swing: 'both', headC: 'B',
        torsoF: (w, h) => cat(...[0, 1, 2, 3, 4].map(i => P(TORT, i % 2 ? '#c8bc9a' : '#a89a78', 0, -h * 0.35 + i * h * 0.17, 0, 0, 0.15 * (i % 2 ? 1 : -1), 0.1, w * 1.05, w * 1.05, w * 0.75)), P(BX, '#c8bc9a', w * 0.5, -h * 0.2, w * 0.3, 0.5, 0, 0.4, 0.06, h * 0.8, 0.04)),
        headF: hr => cat(...[0, 1, 2].map(i => P(TORT, '#c8bc9a', 0, -hr * 0.3 + i * hr * 0.4, 0, 0, 0.2 * (i - 1), 0, hr * 1.05, hr * 1.05, hr * 1.05))), handF: () => drips(2, 0.06, -0.6, 0.3, 1), eyes: [[-0.1, 0.06, 0.25, 0.05], [0.1, 0.06, 0.25, 0.05]] }),
      guard: () => biped({ seed: 14, L: 0.6, tw: 0.5, th: 0.62, td: 0.34, hr: 0.26, al: 0.66, ar: 0.12, swing: 'right', twist: 0.5,
        torsoF: (w, h, d) => cat(P(BX, GOLD, 0, h * 0.1, d * 0.75, 0, 0, 0, w * 1.5, h * 0.6, 0.06), P(BX, '#1a2a6a', 0, h * 0.1, d * 0.8, 0, 0, 0, w * 1.0, h * 0.4, 0.03), P(BX, GOLD, 0, h * 0.62, 0, 0, 0, 0, w * 2.3, 0.08, d * 2)),
        headF: hr => cat(P(CO4, '#1a1a24', 0, hr * 0.1, hr * 0.9, 0, Math.PI / 2, 0.785, hr * 0.32, hr * 1.1, hr * 0.32), P(CO4, '#1a1a24', -hr * 0.45, hr * 0.95, -hr * 0.1, 0, -0.15, 0, hr * 0.18, hr * 0.9, hr * 0.12), P(CO4, '#1a1a24', hr * 0.45, hr * 0.95, -hr * 0.1, 0, -0.15, 0, hr * 0.18, hr * 0.9, hr * 0.12), P(BX, GOLD, 0, -hr * 0.2, 0, 0, 0, 0, hr * 2.1, hr * 0.25, hr * 2.1)),
        handF: sd => sd > 0 ? cat(P(CY5, '#5a3a1a', 0, -0.62, 0.3, 0, Math.PI / 2, 0, 0.035, 1.6, 0.035), P(CO4, GOLD, 0, -0.62, 1.15, 0, Math.PI / 2, 0, 0.08, 0.35, 0.03)) : [] }),
      // ---- Sunken Crypt: skeletal slimes, ghosts, grave crawlers
      bone: () => biped({ seed: 16, L: 0.55, tw: 0.36, th: 0.55, td: 0.26, hr: 0.27, al: 0.6, ar: 0.06, armC: BONE, legC: BONE, hipC: BONE, lr0: 0.06, lr1: 0.05, headC: BONE,
        torsoF: (w, h) => cat(...[0, 1, 2, 3].map(i => P(TORT, BONE, 0, -h * 0.25 + i * h * 0.17, 0, 0, 0, 0, w * (1.1 - Math.abs(i - 1.5) * 0.12), w * 1.1, w * 0.75)), P(CY5, BONE, 0, 0, -w * 0.6, 0, 0, 0, 0.05, h * 0.9, 0.05)),
        headF: hr => cat(P(SPS, '#0a0808', -hr * 0.36, hr * 0.12, hr * 0.8, 0, 0, 0, hr * 0.24, hr * 0.26, hr * 0.12), P(SPS, '#0a0808', hr * 0.36, hr * 0.12, hr * 0.8, 0, 0, 0, hr * 0.24, hr * 0.26, hr * 0.12), P(BX, BONE, 0, -hr * 0.75, hr * 0.3, 0, 0, 0, hr * 1.2, hr * 0.3, hr * 1.0), teeth(5, hr * 0.9, -hr * 0.55, hr * 0.82, hr * 0.18, true)) }),
      ghost: () => floater({ hover: 1.05, br: 0.5, bry: 1.2, tendrils: 5, tl: 0.9, tw: 0.1, tAlpha: 0.6, tseg: 2, coreO: { alpha: 0.62 },
        coreF: br => cat(P(G.lathe([[0.55, -0.2], [0.62, 0.3], [0.5, 0.75], [0, 0.95]], 12), 'S', 0, 0, -0.05, 0, -0.15, 0, br * 1.6, br * 1.5, br * 1.6), P(SPS, '#06080c', 0, br * 0.2, br * 0.55, 0, 0, 0, br * 0.55, br * 0.6, br * 0.3)), eyes: [[-0.14, 0.18, 0.42, 0.07], [0.14, 0.18, 0.42, 0.07]] }),
      grave: () => crawler({ segs: 2, sr: 0.48, gap: 0.6, L: 0.3, lw: 0.06, legC: BONE, headF: sr => cat(P(BX, '#5a5866', 0, sr * 0.95, -sr * 0.3, 0, 0.3, 0.1, sr * 1.2, sr * 1.5, sr * 0.3), P(BX, '#2a2830', 0, sr * 1.25, -sr * 0.2, 0, 0.3, 0.1, sr * 0.7, sr * 0.08, sr * 0.32), teeth(6, sr * 1.0, -sr * 0.15, sr * 0.95, sr * 0.3, false)),
        segF: (i, r2) => i ? cat(P(IC, '#4a4856', 0, r2 * 0.6, 0, i, 0, 0, r2 * 0.6, r2 * 0.4, r2 * 0.6), drips(3, r2 * 0.9, -r2 * 0.2, 0.14, i)) : [] }),
      cknight: () => biped({ seed: 18, L: 0.6, tw: 0.52, th: 0.62, td: 0.36, hr: 0.27, al: 0.66, ar: 0.13, armC: 'S', swing: 'right', twist: 0.45,
        torsoF: (w, h, d) => cat(P(BX, IRON, 0, h * 0.05, 0, 0, 0, 0, w * 2.05, h * 1.0, d * 2.1), P(BX, '#5a0a12', 0, h * 0.05, d * 1.06, 0, 0, 0, w * 0.5, h * 0.9, 0.03), ...[-1, 1].map(sd => P(SPH, IRON, sd * w * 1.05, h * 0.55, 0, 0, 0, 0, w * 0.45, w * 0.3, w * 0.45))),
        headF: hr => cat(P(G.lathe([[1.05, -0.9], [1.08, 0.2], [0.85, 0.75], [0, 0.95]], 12), IRON, 0, 0, 0, 0, 0, 0, hr, hr, hr), P(BF, '#08080a', 0, hr * 0.05, hr * 0.98, 0, 0, 0, hr * 1.2, hr * 0.14, 0.04), P(BX, '#6a0e14', 0, hr * 1.1, -hr * 0.2, 0, 0, 0, hr * 0.18, hr * 0.6, hr * 1.4)), eyes: [[-0.09, 0.02, 0.26, 0.05], [0.09, 0.02, 0.26, 0.05]],
        handF: sd => sd > 0 ? cat(P(BX, '#8a8e98', 0, -0.68, 0.45, 0, Math.PI / 2, 0, 0.08, 1.0, 0.03), P(BX, '#2a2420', 0, -0.68, -0.08, 0, 0, 0, 0.3, 0.05, 0.08)) : cat(P(BX, IRON, -0.08, -0.45, 0.2, 0, 0, 0, 0.08, 0.85, 0.6), P(BX, '#5a0a12', -0.13, -0.45, 0.2, 0, 0, 0, 0.02, 0.5, 0.22)) }),
      banshee: () => floater({ hover: 1.4, br: 0.42, bry: 1.1, tendrils: 6, tl: 1.4, tw: 0.09, tseg: 2, tAlpha: 0.55, tr: 0.8, ty: 0.4, coreO: { alpha: 0.6 },
        coreF: br => cat(P(G.lathe([[0.5, -0.6], [0.45, 0.1], [0.3, 0.6], [0, 0.8]], 12), 'S', 0, -br * 0.4, 0, 0, 0, 0, br * 1.6, br * 1.8, br * 1.4), P(SPS, '#020306', 0, br * 0.05, br * 0.8, 0, 0, 0, br * 0.22, br * 0.42, br * 0.15), ...[-1, 1].map(sd => P(CO, 'S', sd * br * 0.9, br * 0.5, -br * 0.2, 0, -0.5, sd * 0.4, br * 0.25, br * 1.8, br * 0.15))),
        eyes: [[-0.12, 0.22, 0.36, 0.06], [0.12, 0.22, 0.36, 0.06]] }),
      // ---- Frost Peaks: frost bats, ice wolves, snow golems
      ice: () => floater({ hover: 1.6, br: 0.32, wings: 0.8, flap: 12, wingC: 'S', coreF: br => cat(P(CO4, 'S', -br * 0.55, br * 0.95, 0, 0, 0, 0.3, br * 0.22, br * 0.6, br * 0.12), P(CO4, 'S', br * 0.55, br * 0.95, 0, 0, 0, -0.3, br * 0.22, br * 0.6, br * 0.12), teeth(2, br * 0.5, -br * 0.3, br * 0.85, br * 0.35, false), spikes(5, br * 0.7, -br * 0.4, 0.18, 0.04, '#bfe8ff', -0.9)),
        wingG: sd => cat(X(BF, sd * 0.42, 0, 0, 0, 0, 0, 0.8, 0.03, 0.45), ...[0, 1, 2].map(j => X(CO4, sd * (0.15 + j * 0.3), -0.03, -0.25, 0, Math.PI, 0, 0.035, 0.3, 0.035))), eyes: [[-0.11, 0.08, 0.28, 0.06], [0.11, 0.08, 0.28, 0.06]] }),
      snow: () => quad({ seed: 22, bw: 0.42, bh: 0.38, bl: 0.82, hr: 0.3, hz: 0.12, L: 0.5, legOut: 0.65, lr0: 0.09, lr1: 0.06, tail: 0.6, tw: 0.1, tailF: tl => spikes(4, 0.06, 0, 0.18, 0.03, '#d8f0ff', 0, 0).map((v, i) => v),
        bodyF: (w, h, l) => cat(...[0, 1, 2, 3, 4, 5].map(i => P(CO, '#bfe8ff', 0, h * 0.75, l * (0.6 - i * 0.24), 0, -0.5, 0, 0.07, 0.35 - Math.abs(i - 2) * 0.05, 0.07))),
        headF: hr => cat(P(CO, 'B', 0, -hr * 0.15, hr * 1.1, 0, Math.PI / 2, 0, hr * 0.5, hr * 1.2, hr * 0.42), P(CO4, 'S', -hr * 0.5, hr * 0.8, -hr * 0.1, 0, -0.2, 0.2, hr * 0.22, hr * 0.7, hr * 0.12), P(CO4, 'S', hr * 0.5, hr * 0.8, -hr * 0.1, 0, -0.2, -0.2, hr * 0.22, hr * 0.7, hr * 0.12)), eyes: [[-0.13, 0.1, 0.27, 0.05], [0.13, 0.1, 0.27, 0.05]] }),
      yeti: () => biped({ seed: 24, L: 0.38, tw: 0.6, th: 0.62, td: 0.55, hr: 0.38, al: 0.5, ar: 0.13, fist: 0.18, lr0: 0.2, lr1: 0.16,
        torsoF: (w, h) => cat(paint(goo(w * 1.05, h * 0.55, w * 1.0, 25), 'B').map(v => v), P(SPS, '#1a1a1a', 0, h * 0.15, w * 0.95, 0, 0, 0, 0.05, 0.05, 0.03), P(SPS, '#1a1a1a', 0, -h * 0.1, w * 1.0, 0, 0, 0, 0.05, 0.05, 0.03)),
        headF: hr => cat(P(CO, '#d86a1a', 0, 0, hr * 1.15, 0, Math.PI / 2, 0, hr * 0.12, hr * 0.5, hr * 0.12), P(CY, '#1a1a20', 0, hr * 0.95, 0, 0, 0, 0, hr * 0.6, hr * 0.12, hr * 0.6), P(CY, '#1a1a20', 0, hr * 1.25, 0, 0, 0, 0, hr * 0.42, hr * 0.5, hr * 0.42), spikes(6, hr * 0.5, hr * 1.55, 0.16, 0.03, '#bfe8ff', -1.0)),
        eyes: [[-0.13, 0.12, 0.34, 0.06, 0.06], [0.13, 0.12, 0.34, 0.06, 0.06]] }),
      // Update 7: the Sand Seer: a thin robed priest in a tall gold headdress (the desert's second mini-boss)
      sandseer: () => biped({ seed: 17, L: 0.52, tw: 0.42, th: 0.7, td: 0.3, hr: 0.24, al: 0.7, ar: 0.1, swing: 'both', twist: 0.4,
        torsoF: (w, h, d) => cat(P(CO, '#d8c08a', 0, -h * 0.35, 0, 0, 0, 0, w * 1.5, h * 1.1, d * 1.6), P(BX, GOLD, 0, h * 0.45, d * 0.55, 0, 0, 0, w * 1.6, 0.08, 0.05), P(BX, '#2a4a8a', 0, h * 0.15, d * 0.6, 0, 0, 0, w * 0.4, h * 0.6, 0.04)),
        headF: hr => cat(P(CO4, GOLD, 0, hr * 1.25, -hr * 0.1, 0.785, 0, 0, hr * 0.95, hr * 1.6, hr * 0.95), P(BX, '#2a4a8a', 0, hr * 0.5, 0, 0, 0, 0, hr * 2.0, hr * 0.22, hr * 2.0), P(BF, GOLD, 0, hr * 0.15, hr * 0.92, 0, 0, 0, hr * 0.9, hr * 0.12, 0.03)) }),
      // Update 7: the Rime Witch: a hunched frost-hag with a crown of icicles and a cloak of shards (the peaks' second mini-boss)
      rimewitch: () => biped({ seed: 27, L: 0.48, tw: 0.46, th: 0.66, td: 0.36, hr: 0.27, al: 0.72, ar: 0.11, swing: 'both', twist: 0.35,
        torsoF: (w, h, d) => cat(...[0, 1, 2, 3, 4].map(i => P(OCT, '#d8f0ff', (i - 2) * w * 0.4, h * 0.2, -d * 0.7, 0, 0.5, (i - 2) * 0.2, 0.1, 0.5, 0.1)), P(CO, '#3a5a8a', 0, -h * 0.3, -d * 0.1, 0, 0, 0, w * 1.4, h * 1.0, d * 1.5)),
        headF: hr => cat(spikes(9, hr * 0.75, hr * 0.55, 0.55, 0.045, '#e8f8ff', -1.25), P(BX, '#8ab8e0', 0, -hr * 0.35, hr * 0.6, 0, 0, 0, hr * 0.5, hr * 0.5, hr * 0.5)) }),
      frostgiant: () => biped({ seed: 26, L: 0.62, tw: 0.6, th: 0.75, td: 0.42, hr: 0.28, al: 0.78, ar: 0.15, fist: 0.2, swing: 'both',
        torsoF: (w, h, d) => cat(...[0, 1, 2, 3, 4, 5, 6].map(i => P(OCT, '#bfe8ff', Math.sin(i * 0.9) * w * 0.9, h * (0.3 + (i % 3) * 0.12), -d * 0.5 + Math.cos(i) * 0.1, i, -0.4, 0, 0.12, 0.35 + (i % 2) * 0.15, 0.12)), P(BX, '#5a8ab8', 0, h * 0.05, d * 0.7, 0, 0, 0, w * 1.4, h * 0.6, 0.06)),
        headF: hr => cat(spikes(7, hr * 0.7, hr * 0.7, 0.4, 0.05, '#d8f0ff', -1.1), P(CY, '#5a8ab8', 0, hr * 0.55, 0, 0, 0, 0, hr * 1.05, hr * 0.14, hr * 1.05), P(BX, '#d8e4f0', 0, -hr * 0.55, hr * 0.5, 0, 0, 0, hr * 1.2, hr * 0.7, hr * 0.5)),
        handF: sd => sd > 0 ? cat(P(CY5, '#9ad0f0', 0, -0.8, 0.0, 0, 0, 0, 0.06, 0.4, 0.06), P(OCT, '#bfe8ff', 0, -1.25, 0, 0, 0, 0, 0.26, 0.5, 0.26)) : [] }),
      // ---- Ember Forge: magma hounds, forge imps, cinder golems
      magma: () => quad({ seed: 28, bw: 0.5, bh: 0.4, bl: 0.78, hr: 0.33, L: 0.4, tail: 0.5, tailC: '#1a0e0a', bodyF: (w, h, l) => cat(...[0, 1, 2, 3, 4, 5, 6].map(i => P(IC, '#1e120e', Math.sin(i * 2.1) * w * 0.55, h * 0.55 + (i % 2) * 0.1, l * (0.6 - i * 0.2), i, 0, 0, 0.24, 0.13, 0.24))),
        headF: hr => cat(horn(hr * 0.5, hr * 0.5, -0.05, 1, 0.4, 0.06, '#1a1010', 0.4), horn(-hr * 0.5, hr * 0.5, -0.05, -1, 0.4, 0.06, '#1a1010', 0.4)),
        extra: (r, body, head) => { r.add(cat(...[0, 1, 2, 3, 4, 5, 6, 7].map(i => X(BF, Math.sin(i * 2.3) * 0.32, 0.22 + (i % 3) * 0.08, 0.5 - i * 0.16, i, 0, 0, 0.18, 0.03, 0.05))), [0, 0, 0], body, (s, A2) => { const f = 0.9 + Math.sin(s.t * 7) * 0.1; A2[6] = A2[7] = A2[8] = f; }, { glow: LAVA, ge: 2.6, pulse: 1 });
          r.add(cat(...[0, 1, 2, 3, 4].map(i => X(CO, (i - 2) * 0.09, 0.2, -0.1 - Math.abs(i - 2) * 0.05, 0, -0.3, (i - 2) * 0.25, 0.07, 0.4, 0.07))), [0, 0, 0], head, (s, A2) => { A2[7] = 0.8 + Math.sin(s.t * 11) * 0.2; }, { glow: '#ffb03a', ge: 3, lod: 1 }); } }),
      cinder: () => biped({ seed: 30, L: 0.3, tw: 0.32, th: 0.38, td: 0.28, hr: 0.3, al: 0.42, ar: 0.07, swing: 'right', armRest: -0.4,
        torsoF: (w, h) => cat(P(CO, 'S', 0, -h * 0.2, -w * 0.9, 0, -2.2, 0, 0.05, 0.7, 0.05), P(CO4, '#ff6a1a', 0, -h * 0.4, -w * 1.5, 0, -2.4, 0.785, 0.08, 0.16, 0.08)),
        headF: hr => cat(horn(hr * 0.55, hr * 0.5, 0, 1, 0.4, 0.06, '#1a0a08', 0.5), horn(-hr * 0.55, hr * 0.5, 0, -1, 0.4, 0.06, '#1a0a08', 0.5), P(CO4, 'S', -hr * 0.9, hr * 0.2, 0, 0, 0, 1.2, hr * 0.15, hr * 0.6, hr * 0.08), P(CO4, 'S', hr * 0.9, hr * 0.2, 0, 0, 0, -1.2, hr * 0.15, hr * 0.6, hr * 0.08), teeth(4, hr * 0.7, -hr * 0.35, hr * 0.88, hr * 0.22, true)),
        extra: (r, torso) => { for (const sd of [-1, 1]) r.add(paint(cat(X(BF, sd * 0.3, 0, -0.05, 0, 0, 0, 0.55, 0.02, 0.32), X(CO4, sd * 0.55, 0.05, 0, 0, Math.PI / 2, 0, 0.03, 0.25, 0.03)), '#2a0a08'), [sd * 0.2, 0.18, -0.25], torso, (s, A2) => { A2[5] = sd * (0.3 + Math.sin(s.t * 10) * 0.35); }); },
        handF: sd => sd > 0 ? cat(P(CY5, '#3a2a20', 0, -0.42, 0.25, 0, Math.PI / 2, 0, 0.025, 1.0, 0.025), ...[-1, 0, 1].map(j => P(CO4, '#5a5a60', j * 0.07, -0.42, 0.8, 0, Math.PI / 2, 0, 0.02, 0.2, 0.02))) : [] }),
      forge: () => biped({ seed: 32, L: 0.5, tw: 0.58, th: 0.65, td: 0.42, hr: 0.24, al: 0.7, ar: 0.16, fist: 0.24, fistS: BX, fistC: '#2a2422', armC: 'S',
        torsoF: (w, h, d) => cat(P(BX, '#2a2422', 0, h * 0.1, 0, 0, 0, 0, w * 2.1, h * 1.05, d * 2.0), P(BX, '#3a3230', 0, h * 0.6, 0, 0, 0, 0, w * 2.4, 0.12, d * 2.2), P(CY, '#2a2422', 0, h * 0.7, -d * 0.6, 0, 0, 0, 0.12, 0.6, 0.12)),
        headF: hr => cat(P(BX, '#2a2422', 0, 0, 0, 0, 0, 0, hr * 2.2, hr * 1.8, hr * 2.0), P(BF, '#100808', 0, hr * 0.1, hr * 1.02, 0, 0, 0, hr * 1.6, hr * 0.2, 0.02)), eyes: [[-0.1, 0.03, 0.25, 0.05, 0.03], [0.1, 0.03, 0.25, 0.05, 0.03]],
        extra: (r, torso) => { r.add(cat(X(SPH, 0, 0.1, 0.36, 0, 0, 0, 0.22, 0.22, 0.08), X(BF, 0, 0.1, 0.44, 0.785, 0, 0, 0.02, 0.36, 0.02)), [0, 0, 0], torso, (s, A2) => { const f = 1 + Math.sin(s.t * 4) * 0.08; A2[6] = A2[7] = A2[8] = f; }, { glow: LAVA, ge: 2.8, pulse: 1 });
          r.add(X(CY, 0, 1.2, -0.25, 0, 0, 0, 0.1, 0.05, 0.1), [0, 0, 0], torso, (s, A2) => { if (Math.random() < 0.02) A2[7] = 3; }, { glow: '#ff9a3a', ge: 2, lod: 1 }); } }),
      pyro: () => biped({ seed: 34, L: 0.62, tw: 0.46, th: 0.72, td: 0.34, hr: 0.28, al: 0.7, ar: 0.11, swing: 'right',
        torsoF: (w, h, d) => cat(P(G.lathe([[1.2, -1.2], [1.0, -0.4], [0.75, 0.3], [0.6, 0.9]], 12), '#2a0a06', 0, -h * 0.05, 0, 0, 0, 0, w, h * 0.7, d * 1.3), P(BX, GOLD, 0, h * 0.4, d * 0.6, 0, 0, 0, w * 1.2, 0.06, 0.05)),
        headF: hr => cat(horn(hr * 0.55, hr * 0.4, 0, 1, 0.55, 0.07, '#140808', 0.45), horn(-hr * 0.55, hr * 0.4, 0, -1, 0.55, 0.07, '#140808', 0.45)),
        handF: sd => sd > 0 ? cat(P(CY5, '#1a1010', 0, -0.7, 0, 0, 0, 0, 0.03, 1.7, 0.03), P(SPS, '#3a1a0a', 0, 0.15, 0, 0, 0, 0, 0.1, 0.1, 0.1)) : [],
        extra: (r, torso, head) => { r.add(cat(...[0, 1, 2, 3, 4, 5].map(i => X(CO, Math.sin(i * 1.05) * 0.18, 0.28, Math.cos(i * 1.05) * 0.18, 0, 0, 0, 0.09, 0.5, 0.09))), [0, 0.05, 0], head, (s, A2) => { A2[7] = 0.85 + Math.sin(s.t * 13) * 0.15 + s.w * 0.5; A2[3] = s.t; }, { glow: '#ff7a1a', ge: 3 }); } }),
      smelter: () => crawler({ segs: 2, sr: 0.62, gap: 0.75, L: 0.3, lw: 0.08, legC: '#2a2422', headF: sr => cat(P(CY, '#2a2422', 0, sr * 0.75, 0, 0, 0, 0, sr * 0.95, sr * 0.65, sr * 0.95), P(TOR, '#3a3230', 0, sr * 1.1, 0, 0, 0, 0, sr * 0.95, sr * 0.95, sr * 0.95), P(CO, '#2a2422', 0, sr * 0.9, sr * 1.0, 0, Math.PI / 2 - 0.3, 0, sr * 0.2, sr * 0.6, sr * 0.2)),
        extra: (r, sg) => { r.add(X(CY, 0, 1.17, 0, 0, 0, 0, 0.55, 0.03, 0.55), [0, 0, 0], sg[0], (s, A2) => { A2[6] = A2[8] = 1 + Math.sin(s.t * 3) * 0.03; }, { glow: LAVA, ge: 2.4, pulse: 1 }); } }),
      // ---- Storm Spire: sparking wisps, cloud jellyfish, thunder beetles
      spark: () => floater({ hover: 1.3, br: 0.3, coreG: br => paint(goo(br, br, br, 40, 0.12), 'B'), eyes: [[-0.1, 0.05, 0.27, 0.06], [0.1, 0.05, 0.27, 0.06]],
        extra: (r, core) => { r.add(X(SPH, 0, 0, 0, 0, 0, 0, 0.17, 0.17, 0.17), [0, 0, 0], core, null, { glow: 1, ge: 3.4 }); for (let k = 0; k < 4; k++) r.add(X(OCT, 0, 0, 0, 0, 0, 0, 0.05, 0.1, 0.05), [0, 0, 0], core, (s, A2) => { const a = s.t * (3 + k) + k * 1.6; A2[0] = Math.sin(a) * 0.5; A2[2] = Math.cos(a) * 0.5; A2[1] = Math.sin(s.t * 5 + k) * 0.25; }, { glow: '#c8d8ff', ge: 3, lod: k > 1 }); } }),
      cloud: () => floater({ hover: 1.7, br: 0.55, bry: 0.6, tendrils: 6, tl: 1.3, tw: 0.05, tseg: 2, tr: 0.75, ty: 0.2, tAlpha: 0.7, coreO: { alpha: 0.78 },
        coreG: br => paint(G.lathe([[0.9, -0.1], [1.0, 0.1], [0.92, 0.45], [0.6, 0.75], [0, 0.85]], 16), 'B').map((v, i) => v), coreF: br => cat(...[0, 1, 2, 3, 4, 5].map(i => P(SPS, 'S', Math.sin(i) * 0.3, 0.1, Math.cos(i) * 0.3, 0, 0, 0, 0.14, 0.08, 0.14))), eyes: [[-0.15, 0.25, 0.42, 0.06], [0.15, 0.25, 0.42, 0.06]],
        extra: (r, core) => r.add(X(SPH, 0, 0.25, 0, 0, 0, 0, 0.3, 0.22, 0.3), [0, 0, 0], core, (s, A2) => { A2[6] = A2[7] = A2[8] = 0.9 + (Math.random() < 0.08 ? 0.5 : 0); }, { glow: '#9ab8ff', ge: 2.4 }) }),
      thunder: () => quad({ seed: 44, legs: 6, bw: 0.62, bh: 0.34, bl: 0.75, hr: 0.28, hy: -0.08, L: 0.18, lr0: 0.05, lr1: 0.04, legOut: 0.85, legSpread: 0.55, jaw: false,
        bodyF: (w, h, l) => cat(P(SPH, 'S', 0, h * 0.2, 0, 0, 0, 0, w * 1.05, h * 0.9, l * 1.02), P(BF, DARK, 0, h * 1.05, 0, 0, 0, 0, 0.03, 0.05, l * 1.9)),
        headF: hr => cat(P(CO, '#2a2a40', 0, hr * 0.5, hr * 0.85, 0, 0.9, 0, hr * 0.25, hr * 1.6, hr * 0.22), P(CO4, DARK, -hr * 0.55, -hr * 0.2, hr * 0.9, 0, 1.3, 0.4, 0.04, hr * 0.7, 0.04), P(CO4, DARK, hr * 0.55, -hr * 0.2, hr * 0.9, 0, 1.3, -0.4, 0.04, hr * 0.7, 0.04)),
        extra: (r, body) => r.add(cat(...[-1, 1].flatMap(sd => [0, 1, 2].map(j => X(BF, sd * (0.25 + j * 0.08), 0.36, 0.4 - j * 0.35, sd * 0.4, 0, 0, 0.03, 0.02, 0.32)))), [0, 0, 0], body, (s, A2) => { A2[6] = A2[7] = A2[8] = Math.random() < 0.1 ? 1.15 : 1; }, { glow: '#8ab0ff', ge: 2.6, pulse: 1 }) }),
      tempest: () => floater({ hover: 1.2, br: 0.55, spin: 3, coreG: br => cat(...[0, 1, 2, 3].map(i => P(TOR, i % 2 ? 'S' : 'B', 0, -0.5 + i * 0.32, 0, i, 0, 0, br * (0.55 + i * 0.25), br * (0.55 + i * 0.25), br * 0.5))), eyes: [[0, 0.3, 0.32, 0.12, 0.12]],
        extra: (r, core) => { r.add(X(SPH, 0, 0, 0, 0, 0, 0, 0.22, 0.22, 0.22), [0, 0.3, 0], core, null, { glow: '#c8d8ff', ge: 3 }); for (let k = 0; k < 3; k++) r.add(paint(X(IC, 0, 0, 0, 0, 0, 0, 0.16), '#3a3a50'), [0, 0, 0], core, (s, A2) => { const a = s.t * 4 + k * 2.1; A2[0] = Math.sin(a) * 0.95; A2[2] = Math.cos(a) * 0.95; A2[1] = -0.3 + k * 0.3; }, { lod: 1 }); } }),
      conduit: () => biped({ seed: 46, L: 0.55, tw: 0.42, th: 0.8, td: 0.32, hr: 0.22, al: 0.62, ar: 0.1, armC: 'S', armOut: 0.3,
        torsoF: (w, h, d) => cat(P(CY, '#2a2c3a', 0, h * 0.1, 0, 0, 0, 0, w * 0.9, h * 1.1, w * 0.9), ...[0, 1, 2].map(i => P(TORT, '#8a8ea0', 0, -h * 0.3 + i * h * 0.3, 0, 0, 0, 0, w * 1.1, w * 1.1, w * 1.1))),
        headF: hr => cat(P(CO4, '#2a2c3a', 0, hr * 0.4, 0, 0.785, 0, 0, hr * 1.1, hr * 1.4, hr * 1.1), P(CY5, '#8a8ea0', 0, hr * 1.6, 0, 0, 0, 0, 0.03, hr * 1.6, 0.03)), eyes: [[0, 0.05, 0.24, 0.09, 0.04]],
        extra: (r, torso) => { for (let k = 0; k < 2; k++) r.add(X(TORT, 0, 0, 0, 0, 0, 0, 0.75 + k * 0.25, 0.75 + k * 0.25, 0.75 + k * 0.25), [0, 0.2 + k * 0.4, 0], torso, (s, A2) => { A2[4] = Math.sin(s.t * 1.3 + k) * 0.5; A2[3] = s.t * (1 + k); A2[1] = Math.sin(s.t * 2 + k) * 0.1; }, { glow: '#8ab0ff', ge: 2.2 }); } }),
      // ---- Void Citadel: void eyes, shadow stalkers, crystal knights
      voidling: () => floater({ hover: 1.3, br: 0.42, tendrils: 6, tl: 0.7, tw: 0.06, tseg: 2, eyes: false, coreF: br => cat(P(SPH, '#e8e0f0', 0, 0, br * 0.35, 0, 0, 0, br * 0.75, br * 0.75, br * 0.7), P(TORT, 'S', 0, 0, br * 0.6, 0, Math.PI / 2, 0, br * 0.8, br * 0.8, br * 0.6)),
        extra: (r, core) => { const iris = r.add(X(SPH, 0, 0, 0, 0, 0, 0, 0.17, 0.17, 0.08), [0, 0, 0.5], core, (s, A2) => { A2[0] = Math.sin(s.t * 0.9) * 0.06; A2[1] = Math.cos(s.t * 1.3) * 0.04; const k = 1 + s.w * 0.6; A2[6] = A2[7] = k; }, { glow: 1, ge: 2.6 });
          r.add(X(SPH, 0, 0, 0.05, 0, 0, 0, 0.07, 0.07, 0.04), [0, 0, 0.04], iris, null, { glow: '#050208', ge: 0 });
          r.add(cat(X(BF, 0, 0.32, 0.5, 0, -0.3, 0, 0.7, 0.04, 0.3), X(BF, 0, -0.32, 0.5, 0, 0.3, 0, 0.7, 0.04, 0.3)), [0, 0, 0], core, (s, A2) => { const bl = Math.sin(s.t * 0.8) > 0.96 ? 0.2 : 1; A2[7] = bl; }, { glow: '#1a0a2a', ge: 0, lod: 1 }); } }),
      shade: () => quad({ seed: 50, bw: 0.38, bh: 0.34, bl: 0.9, hr: 0.28, hz: 0.1, L: 0.62, lr0: 0.07, lr1: 0.045, legOut: 0.7, tail: 0.9, tw: 0.07, eyes: [[-0.12, 0.08, 0.27, 0.09, 0.025, 0.04], [0.12, 0.08, 0.27, 0.09, 0.025, 0.04]],
        bodyF: (w, h, l) => cat(...[0, 1, 2, 3, 4].map(i => P(CO, 'S', 0, h * 0.7, l * (0.6 - i * 0.3), 0, -0.6, 0, 0.06, 0.3, 0.06))), footF: (len, r1) => P(CO4, 'S', 0, -len - 0.05, 0.12, 0, Math.PI / 2, 0, r1, 0.25, r1),
        extra: (r, body) => r.add(paint(goo(0.6, 0.45, 1.05, 51), 'S'), [0, 0, 0], body, (s, A2) => { const k = 1 + Math.sin(s.t * 3) * 0.05; A2[6] = A2[7] = A2[8] = k; }, { glow: '#2a0a4a', ge: 0.3, alpha: 0.35, add: false }) }),
      abyss: () => biped({ seed: 52, L: 0.6, tw: 0.44, th: 0.62, td: 0.32, hr: 0.25, al: 0.62, ar: 0.11, swing: 'right', armC: 'S',
        torsoF: (w, h, d) => cat(...[0, 1, 2, 3, 4, 5].map(i => P(OCT, '#c87aff', Math.sin(i * 1.7) * w * 0.8, h * (0.2 + (i % 3) * 0.2), Math.cos(i * 1.7) * d * 0.9, i, (i % 2 ? 0.4 : -0.4), 0, 0.1, 0.25, 0.1))),
        headF: hr => cat(P(OCT, '#c87aff', 0, hr * 0.9, 0, 0, 0, 0, hr * 0.5, hr * 1.1, hr * 0.5), P(BX, '#140a22', 0, 0, 0, 0, 0, 0, hr * 2.05, hr * 1.9, hr * 2.0)), eyes: [[0, 0.03, 0.26, 0.11, 0.03]],
        handF: sd => sd > 0 ? P(OCT, '#c87aff', 0, -0.75, 0.45, 0, Math.PI / 2, 0, 0.1, 0.6, 0.04) : [] }),
      voidknight: () => biped({ seed: 54, L: 0.66, tw: 0.54, th: 0.68, td: 0.38, hr: 0.27, al: 0.72, ar: 0.13, swing: 'both', armC: 'S',
        torsoF: (w, h, d) => cat(P(BX, '#140820', 0, h * 0.05, 0, 0, 0, 0, w * 2.1, h * 1.05, d * 2.1), ...[-1, 1].map(sd => P(CO4, '#2a1248', sd * w * 1.1, h * 0.7, 0, 0.785, 0, sd * -0.5, w * 0.45, w * 0.9, w * 0.45)), P(BF, '#c87aff', 0, h * 0.1, d * 1.06, 0, 0, 0.785, 0.15, 0.15, 0.02)),
        headF: hr => cat(P(BX, '#140820', 0, 0, 0, 0, 0, 0, hr * 2.1, hr * 2.2, hr * 2.1), P(CO4, '#2a1248', -hr * 0.8, hr * 1.1, 0, 0, 0, 0.4, hr * 0.2, hr * 1.2, hr * 0.2), P(CO4, '#2a1248', hr * 0.8, hr * 1.1, 0, 0, 0, -0.4, hr * 0.2, hr * 1.2, hr * 0.2)), eyes: [[-0.09, 0.03, 0.29, 0.06, 0.02], [0.09, 0.03, 0.29, 0.06, 0.02]],
        handF: sd => sd > 0 ? cat(P(CY5, '#1a1020', 0, -0.72, 0.5, 0, Math.PI / 2, 0, 0.03, 2.0, 0.03), P(CO4, '#c87aff', 0, -0.72, 1.6, 0, Math.PI / 2, 0, 0.16, 0.6, 0.03)) : [] }),
      archon: () => floater({ hover: 1.5, br: 0.42, bry: 1.3, eyes: [[0, 0.3, 0.38, 0.1, 0.04]], coreF: br => cat(P(G.lathe([[0.7, -1.3], [0.6, -0.3], [0.45, 0.3], [0.3, 0.8], [0, 1.0]], 12), 'S', 0, -0.1, 0, 0, 0, 0, br * 1.3, br * 1.2, br * 1.3), P(SPS, '#050208', 0, br * 0.55, br * 0.35, 0, 0, 0, br * 0.4, br * 0.45, br * 0.3)),
        extra: (r, core) => { r.add(X(TORT, 0, 0, 0, 0, Math.PI / 2, 0, 0.4, 0.4, 0.4), [0, 1.05, -0.15], core, (s, A2) => { A2[3] = s.t * 0.5; }, { glow: '#e0a0ff', ge: 2.4 });
          for (let k = 0; k < 4; k++) r.add(X(OCT, 0, 0, 0, 0, 0, 0, 0.1, 0.24, 0.1), [0, 0, 0], core, (s, A2) => { const a = s.t * 1.2 + k * TAU / 4; A2[0] = Math.sin(a) * 0.9; A2[2] = Math.cos(a) * 0.9; A2[1] = Math.sin(s.t * 2 + k) * 0.2 + 0.2; A2[3] = s.t * 2; }, { glow: '#c87aff', ge: 2.2 }); } }),
      // ---- Abyssal Void: eye clusters, tentacle crawlers, maw beasts
      eye: () => floater({ hover: 1.2, br: 0.46, eyes: false, tendrils: 4, tl: 0.6, tw: 0.07, coreF: br => cat(...[0, 1, 2, 3, 4, 5].map(i => { const a = i * 1.15, y = Math.sin(i * 2.3) * 0.3; return P(SPH, '#e8d8d0', Math.sin(a) * br * 0.7, y, Math.cos(a) * br * 0.7, 0, 0, 0, 0.16 + (i % 3) * 0.04); })),
        extra: (r, core) => { r.add(cat(...[0, 1, 2, 3, 4, 5].map(i => { const a = i * 1.15, y = Math.sin(i * 2.3) * 0.3, rr = 0.46 * 0.7 + 0.16 + (i % 3) * 0.04 - 0.02; return X(SPS, Math.sin(a) * rr, y, Math.cos(a) * rr, 0, 0, 0, 0.07, 0.07, 0.04); })), [0, 0, 0], core, (s, A2) => { A2[3] = Math.sin(s.t * 0.7) * 0.15; }, { glow: 1, ge: 2.8 }); } }),
      tendril: () => crawler({ segs: 2, sr: 0.44, gap: 0.5, L: 0.18, legs: false, eyes: [[0, 0.3, 0.42, 0.1, 0.1]],
        extra: (r, sg) => { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.5; let prev = r.add(paint(tube(0.35, 0.09, 0.07, 6), 'S'), [Math.sin(a) * 0.35, -0.1, Math.cos(a) * 0.35], sg[0], (s, A2) => { A2[4] = Math.cos(a) * 0.9 + Math.sin(s.ph * TAU * 2 + k) * 0.4 * s.mv + Math.sin(s.t * 2 + k) * 0.15; A2[5] = -Math.sin(a) * 0.9; });
          r.add(paint(tube(0.35, 0.07, 0.04, 6), 'S'), [0, -0.35, 0], prev, (s, A2) => { A2[4] = 0.5 + Math.sin(s.t * 2.4 + k) * 0.3; }, { lod: 1 }); } } }),
      maw: () => quad({ seed: 58, bw: 0.62, bh: 0.5, bl: 0.7, hr: 0.5, hz: -0.05, hy: 0.05, L: 0.3, lr0: 0.15, lr1: 0.11, eyes: [[-0.3, 0.32, 0.38, 0.06], [0.3, 0.32, 0.38, 0.06], [0, 0.42, 0.36, 0.05], [-0.18, 0.46, 0.3, 0.04], [0.18, 0.46, 0.3, 0.04]],
        headF: hr => cat(P(SPH, MOUTH, 0, -hr * 0.15, hr * 0.55, 0, 0, 0, hr * 0.8, hr * 0.45, hr * 0.5), teeth(8, hr * 1.3, hr * 0.05, hr * 0.92, hr * 0.3, false)), bodyF: (w, h, l) => spikes(6, w * 0.55, h * 0.6, 0.35, 0.06, BONE, 0.9) }),
      horror: () => biped({ seed: 60, L: 0.55, tw: 0.55, th: 0.72, td: 0.45, hr: 0.32, al: 0.85, ar: 0.12, armOut: 0.25, swing: 'both', eyes: [[-0.14, 0.12, 0.3, 0.06], [0.14, 0.12, 0.3, 0.06], [0, 0.24, 0.29, 0.05], [-0.22, 0.26, 0.24, 0.04], [0.22, 0.26, 0.24, 0.04]],
        headF: hr => cat(P(SPH, MOUTH, 0, -hr * 0.4, hr * 0.6, 0, 0, 0, hr * 0.6, hr * 0.35, hr * 0.4), teeth(6, hr * 1.0, -hr * 0.3, hr * 0.95, hr * 0.25, false), horn(hr * 0.6, hr * 0.5, 0, 1, 0.6, 0.07, '#2a0a14', 0.3), horn(-hr * 0.6, hr * 0.5, 0, -1, 0.6, 0.07, '#2a0a14', 0.3)),
        extra: (r, torso) => { for (const sd of [-1, 1]) r.add(paint(cat(tube(0.6, 0.08, 0.05, 6), X(CO4, 0, -0.68, 0.05, 0, Math.PI, 0, 0.06, 0.2, 0.06)), 'S'), [sd * 0.45, 0.05, 0.15], torso, (s, A2) => { A2[4] = -0.6 + Math.sin(s.t * 2.3 + sd) * 0.4 - s.w * 1.2 + s.atk * 1.5; A2[5] = sd * 0.6; }); } }),
      leech: () => serpent({ segs: 6, sr: 0.48, gap: 0.55, rear: 0.7, jaw: false, eyes: false, headF: sr => cat(P(TOR, '#2a0610', 0, 0, sr * 1.15, 0, Math.PI / 2, 0, sr * 0.75, sr * 0.75, sr * 0.75), P(SPH, MOUTH, 0, 0, sr * 1.2, 0, 0, 0, sr * 0.55, sr * 0.55, sr * 0.2), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i / 8 * TAU; return P(CO4, TOOTH, Math.sin(a) * sr * 0.5, Math.cos(a) * sr * 0.5, sr * 1.3, 0, Math.PI / 2, 0, 0.04, sr * 0.3, 0.04); })),
        segF: (i, r2) => P(TORT, 'S', 0, 0, 0, 0, Math.PI / 2, 0, r2 * 1.02, r2 * 1.02, r2 * 0.3) }),
      // ---- Glitch Realm: pixel swarms, broken-shape crawlers, error knights
      glitchling: () => swarm({ n: 7, br: 0.18, spread: 0.65, fly: true, jitter: 1, oneG: (br, k) => cat(P(BF, k % 3 ? 'B' : '#1aff8a', 0, 0, 0, k, k * 0.5, 0, br * 1.6, br * 1.6, br * 1.6)), eyesEach: false }),
      nullslime: () => crawler({ segs: 3, sr: 0.4, gap: 0.5, L: 0.2, lw: 0.04, legC: '#1aff8a', headF: sr => cat(P(BF, '#0a0a0a', 0, 0, 0, 0.3, 0, 0.2, sr * 1.6, sr * 1.3, sr * 1.5), P(BF, '#ff2a6a', sr * 0.6, sr * 0.5, 0, 0.5, 0, 0, sr * 0.5, sr * 0.5, sr * 0.5)),
        segF: (i, r2) => cat(P(BF, i % 2 ? '#0a0a0a' : '#1aff8a', 0, r2 * 0.3, 0, i * 0.7, 0, i * 0.4, r2 * 1.4, r2 * 1.1, r2 * 1.3)), extra: (r, sg) => { for (const q of sg) { const f = r.parts[q].a; r.parts[q].a = (s, A2) => { f(s, A2); if (Math.random() < 0.05) { A2[0] += (Math.random() - 0.5) * 0.4; A2[1] += (Math.random() - 0.5) * 0.2; } }; } } }),
      errorknight: () => biped({ seed: 64, L: 0.62, tw: 0.5, th: 0.66, td: 0.36, hr: 0.27, al: 0.68, ar: 0.13, swing: 'right', armC: 'S',
        torsoF: (w, h, d) => cat(P(BF, '#1a0a12', 0, h * 0.05, 0, 0, 0, 0, w * 2.1, h * 1.05, d * 2.1), P(BF, '#ff2a6a', 0, h * 0.15, d * 1.06, 0, 0, 0, w * 0.6, 0.06, 0.02), P(BF, '#1aff8a', w * 0.4, -h * 0.25, d * 1.06, 0, 0, 0, w * 0.3, 0.05, 0.02)),
        headF: hr => cat(P(BF, '#1a0a12', 0, 0, 0, 0, 0, 0, hr * 2.0, hr * 2.0, hr * 2.0), P(BF, '#ff2a6a', 0, hr * 0.05, hr * 1.0, 0, 0, 0, hr * 1.5, hr * 0.25, 0.02)), eyes: [[0, 0.0, 0.29, 0.08, 0.02]],
        handF: sd => sd > 0 ? cat(P(BF, '#1aff8a', 0, -0.7, 0.5, 0, Math.PI / 2, 0, 0.1, 1.1, 0.04), P(BF, '#0a0a0a', 0, -0.7, -0.05, 0, 0, 0, 0.32, 0.06, 0.1)) : [],
        extra: (r, torso) => { const f = r.parts[torso].a; r.parts[torso].a = (s, A2) => { f(s, A2); if (Math.random() < 0.04) A2[0] += (Math.random() - 0.5) * 0.35; }; } }),
      segfault: () => floater({ hover: 1.3, br: 0.45, eyes: [[0, 0.1, 0.48, 0.12, 0.04]], coreG: br => paint(X(BF, 0, 0, 0, 0.4, 0.3, 0.2, br * 1.6, br * 1.6, br * 1.6), 'B'),
        extra: (r, core) => { for (let k = 0; k < 6; k++) r.add(paint(X(BF, 0, 0, 0, k, k * 0.7, 0, 0.3, 0.3, 0.3), k % 2 ? '#0a0a0a' : 'S'), [0, 0, 0], core, (s, A2) => { const a = k / 6 * TAU + s.t * 0.6, sp = 0.6 + Math.max(0, Math.sin(s.t * 1.3 + k)) * 0.5 + s.w * 0.6; A2[0] = Math.sin(a) * sp; A2[2] = Math.cos(a) * sp; A2[1] = Math.sin(s.t * 2 + k) * 0.3; A2[3] = s.t * (k % 2 ? 2 : -2); if (Math.random() < 0.03) A2[1] += 0.4; }); } }),
      // ---- Update 6 · Drowned Cathedral: drowned choir ghosts, barnacle crawlers, lampreys
      chorister: () => floater({ hover: 1.15, br: 0.42, bry: 1.25, tendrils: 5, tl: 1.0, tw: 0.07, tseg: 2, tC: '#1a4a3a', tAlpha: 0.75, coreO: { alpha: 0.8 }, eyes: [[-0.13, 0.24, 0.37, 0.05], [0.13, 0.24, 0.37, 0.05]],
        coreF: br => cat(P(CO, '#0e2a2a', 0, br * 0.55, -0.03, 0, 0, 0, br * 0.78, br * 1.0, br * 0.78), P(SPH, MOUTH, 0, -0.02, br * 0.88, 0, 0, 0, br * 0.15, br * 0.24, br * 0.08), ...[0, 1, 2].map(i => P(CY5, '#2a6a4a', (i - 1) * 0.18, -br * 0.9, 0.1, 0, 0, (i - 1) * 0.3, 0.035, 0.35, 0.035))),
        extra: (r, core) => { r.add(cat(X(CY5, 0, -0.12, 0, 0, 0, 0, 0.05, 0.18, 0.05), X(SPS, 0, 0.02, 0, 0, 0, 0, 0.06, 0.1, 0.06)), [0.5, -0.05, 0.3], core, (s, A2) => { A2[4] = Math.sin(s.t * 2) * 0.15; }, { glow: '#7affe8', ge: 3 }); } }),
      barnacle: () => quad({ seed: 80, legs: 6, bw: 0.6, bh: 0.42, bl: 0.72, hr: 0.28, hz: 0.1, L: 0.24, lr0: 0.11, lr1: 0.08, legOut: 0.9, legSpread: 0.7, legC: '#3a3a30',
        bodyF: (w, h, l) => cat(P(SPH, '#4a5444', 0, h * 0.35, -0.05, 0, 0, 0, w * 1.05, h * 0.85, l * 1.05), ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => P(G.lathe([[0.1, 0], [0.12, 0.1], [0.06, 0.16], [0, 0.16]], 6), i % 3 ? '#c8c0a0' : '#7a8a6a', Math.sin(i * 1.7) * w * 0.62, h * (0.75 + (i % 3) * 0.08), Math.cos(i * 1.7) * l * 0.6, 0, 0.2 * Math.sin(i), 0.2 * Math.cos(i), 1.3, 1.3, 1.3))) }),
      eel: () => serpent({ segs: 7, sr: 0.3, gap: 0.42, rear: 1.0, jaw: false, eyes: [[-0.16, 0.14, 0.32, 0.045], [0.16, 0.14, 0.32, 0.045]],
        headF: sr => cat(P(TOR, '#0a1a1a', 0, 0, sr * 1.25, 0, Math.PI / 2, 0, sr * 0.7, sr * 0.7, sr * 0.7), P(SPH, MOUTH, 0, 0, sr * 1.32, 0, 0, 0, sr * 0.5, sr * 0.5, sr * 0.12), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i / 8 * TAU; return P(CO4, TOOTH, Math.sin(a) * sr * 0.42, Math.cos(a) * sr * 0.42, sr * 1.36, 0, Math.PI / 2, 0, 0.03, 0.12, 0.03); })),
        segF: (i, r2) => cat(P(CO4, '#2a5a5a', 0, r2 * 0.95, 0, 0, 0, 0, 0.04, r2 * 0.6, r2 * 0.4), i % 2 ? P(SPS, '#5affe0', r2 * 0.8, r2 * 0.2, 0, 0, 0, 0, 0.05) : []) }),
      bellringer: () => biped({ seed: 82, L: 0.5, tw: 0.56, th: 0.72, td: 0.46, hr: 0.27, al: 0.82, ar: 0.13, swing: 'both', armC: 'S', hipC: '#1a2a2a',
        headF: hr => cat(P(CO, '#0e1a1a', 0, hr * 0.45, -0.04, 0, 0, 0, hr * 1.25, hr * 1.5, hr * 1.25), P(TORT, '#5a7a4a', 0, hr * 0.15, 0, 0, 0, 0, hr * 1.2, hr, hr * 1.2)), eyes: [[-0.09, 0.08, 0.25, 0.05], [0.09, 0.08, 0.25, 0.05]],
        handF: (sd, al) => sd > 0 ? cat(P(CY5, IRON, 0, -al * 0.5, 0, 0, 0, 0, 0.03, al * 0.6, 0.03), P(G.lathe([[0, 0], [0.3, -0.04], [0.36, -0.4], [0.5, -0.62], [0.52, -0.68], [0, -0.66]], 12), '#5a7a4a', 0, -al - 0.15, 0, 0, 0, 0, 1, 1, 1)) : [],
        torsoF: (w, h, d) => cat(...[0, 1, 2].map(i => P(TORT, IRON, 0, h * (0.2 - i * 0.25), 0, 0, 0, 0.3 - i * 0.2, w * 1.02, h * 0.5, d * 1.05))) }),
      abbess: () => floater({ hover: 1.35, br: 0.48, bry: 1.5, tendrils: 7, tl: 1.5, tw: 0.08, tseg: 2, tC: '#0e2a2a', tAlpha: 0.65, coreO: { alpha: 0.78 }, eyes: [[-0.12, 0.42, 0.42, 0.05], [0.12, 0.42, 0.42, 0.05]],
        coreF: br => cat(P(BX, '#e8e4d8', 0, br * 0.55, 0.05, 0, 0, 0, br * 1.05, br * 1.1, br * 0.95), P(BX, '#0a1414', 0, br * 0.55, -0.02, 0, 0, 0, br * 1.2, br * 1.3, br * 1.0), P(CO, '#0a1414', 0, -br * 0.2, 0, 0, 0, 0, br * 1.1, br * 1.4, br * 1.1)),
        extra: (r, core) => { r.add(X(TOR, 0, 0, 0, 0, Math.PI / 2, 0, 0.42, 0.42, 0.42), [0, 0.95, -0.25], core, (s, A2) => { A2[3] = s.t * 0.5; }, { glow: '#7affe8', ge: 2.4, alpha: 0.85, add: 1 }); } }),
      // ---- Clockwork Spire: rolling cogs, piston brutes, wind-up springjacks
      cog: () => floater({ hover: 0.62, br: 0.42, eyes: [[-0.12, 0.08, 0.4, 0.06], [0.12, 0.08, 0.4, 0.06]], coreO: {},
        extra: (r, core) => { r.add(paint(cat(X(CY, 0, 0, 0, 0, 0, Math.PI / 2, 0.62, 0.16, 0.62), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => { const a = i / 10 * TAU; return X(BF, 0, Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0, a, 0, 0.15, 0.12, 0.13); }), X(CY, 0, 0, 0, 0, 0, Math.PI / 2, 0.16, 0.22, 0.16)), '#b88a3a'),
          [0, 0, 0], core, (s, A2) => { A2[4] = s.t * (1 + s.mv * 4); });
          for (const sd of [-1, 1]) r.add(paint(cat(X(CY5, 0, -0.12, 0, 0, 0, 0, 0.04, 0.24, 0.04), X(SPS, 0, -0.28, 0, 0, 0, 0, 0.07)), '#5a4a3a'), [sd * 0.4, -0.05, 0.1], core, (s, A2) => { A2[4] = Math.sin(s.t * 6 + sd) * 0.5 - s.w * 1.2 + s.atk * 1.5; A2[5] = sd * 0.5; }); } }),
      piston: () => biped({ seed: 84, L: 0.42, tw: 0.58, th: 0.58, td: 0.46, hr: 0.25, al: 0.56, ar: 0.14, fist: 0.24, fistS: CY, fistC: '#8a6a3a', armC: '#5a4a3a', legC: '#3a3028', swing: 'right', lumpy: 0.02,
        headF: hr => cat(P(CY, '#2a2420', 0, hr * 0.9, -0.05, 0, 0, 0, hr * 0.35, hr * 0.9, hr * 0.35), P(TOR, '#b88a3a', -hr * 0.4, hr * 0.15, hr * 0.8, 0, Math.PI / 2, 0, 0.1, 0.1, 0.1), P(TOR, '#b88a3a', hr * 0.4, hr * 0.15, hr * 0.8, 0, Math.PI / 2, 0, 0.1, 0.1, 0.1)),
        torsoF: (w, h, d) => cat(P(CY, '#8a6a3a', 0, 0, 0, 0, 0, 0, w * 1.02, h * 0.3, d * 1.02), ...[-1, 1].map(sd => P(CY5, '#5a4a3a', sd * w * 0.7, -h * 0.1, -d * 0.6, 0, 0, 0, 0.08, h * 0.9, 0.08))) }),
      spring: () => floater({ hover: 1.0, br: 0.3, eyes: [[-0.1, 0.06, 0.27, 0.06], [0.1, 0.06, 0.27, 0.06]],
        coreF: br => cat(P(BF, '#b88a3a', 0, 0, -br * 1.1, 0, 0, 0, 0.05, 0.05, 0.25), P(TORT, '#b88a3a', 0, 0, -br * 1.35, 0, 0, Math.PI / 2, 0.16, 0.16, 0.16)),
        extra: (r, core) => { for (let k = 0; k < 4; k++) r.add(paint(X(TOR, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.2), '#8a8a92'), [0, -0.35 - k * 0.14, 0], core, (s, A2) => { const b = Math.abs(Math.sin(s.t * 6)); A2[1] = b * k * 0.04; }); } }),
      foreman: () => biped({ seed: 86, L: 0.55, tw: 0.62, th: 0.72, td: 0.5, hr: 0.27, al: 0.8, ar: 0.15, fist: 0.22, fistC: '#3a3028', armC: 'S', swing: 'right',
        headF: hr => cat(P(SPH, '#e8b83a', 0, hr * 0.55, 0, 0, 0, 0, hr * 1.15, hr * 0.6, hr * 1.2), P(CY, '#e8b83a', 0, hr * 0.42, 0.05, 0, 0, 0, hr * 1.35, 0.03, hr * 1.4)),
        handF: (sd, al) => sd > 0 ? cat(P(BX, IRON, 0, -al - 0.35, 0, 0, 0, 0, 0.08, 0.7, 0.08), P(TOR, IRON, 0, -al - 0.75, 0, 0, Math.PI / 2, 0, 0.16, 0.16, 0.16)) : [],
        torsoF: (w, h, d) => cat(...[0, 1].map(i => P(BX, '#8a6a3a', (i - 0.5) * w * 0.9, h * 0.1, d * 0.85, 0, 0, 0, 0.06, h * 1.1, 0.04))) }),
      pendulum: () => biped({ seed: 88, L: 0.62, tw: 0.5, th: 0.7, td: 0.36, hr: 0.26, al: 0.72, ar: 0.12, armC: 'S', swing: 'right', twist: 0.5,
        headF: hr => cat(P(BX, '#3a3028', 0, hr * 0.05, 0, 0, 0, 0, hr * 1.6, hr * 1.7, hr * 1.6), P(BF, '#0a0806', 0, hr * 0.1, hr * 0.81, 0, 0, 0, hr * 1.1, hr * 0.12, 0.02), P(CO4, '#b88a3a', 0, hr * 1.05, 0, 0, 0, 0, 0.08, hr * 0.8, 0.08)),
        handF: (sd, al) => sd > 0 ? cat(P(CY5, '#b88a3a', 0, -al - 0.4, 0, 0, 0, 0, 0.025, 0.8, 0.025), P(CY, '#d8d0c0', 0, -al - 0.9, 0, 0, 0, Math.PI / 2, 0.32, 0.04, 0.32)) : P(CY, '#b88a3a', 0, -al * 0.6, 0.12, 0, 0, Math.PI / 2, 0.3, 0.06, 0.3),
        extra: (r, torso) => { r.add(X(CY, 0, 0, 0, 0, Math.PI / 2, 0, 0.26, 0.04, 0.26), [0, 0.1, 0.38], torso, null, { glow: '#ffc84a', ge: 2.2 });
          r.add(paint(X(BF, 0, -0.12, 0, 0, 0, 0, 0.025, 0.22, 0.02), '#1a1008'), [0, 0.1, 0.41], torso, (s, A2) => { A2[5] = -s.t * 1.2; }); } }),
      // ---- Hollow Moon: moon moths, crater moles, starspawn
      moth: () => floater({ hover: 1.7, br: 0.3, bry: 1.3, wings: 1.05, flap: 7, wingC: '#d8dcf0', eyes: [[-0.12, 0.18, 0.24, 0.07], [0.12, 0.18, 0.24, 0.07]],
        coreF: br => cat(...[-1, 1].map(sd => P(CY5, '#c8ccf0', sd * 0.1, br * 1.3, 0.12, 0, 0.4, sd * 0.4, 0.015, 0.4, 0.015)), P(SPH, '#e8eaff', 0, -br * 0.9, -0.05, 0, 0, 0, br * 0.7, br * 0.9, br * 0.7)),
        extra: (r, core) => { for (const sd of [-1, 1]) r.add(cat(X(SPS, sd * 0.55, 0.03, 0, 0, 0, 0, 0.13, 0.03, 0.13), X(SPS, sd * 0.9, 0.03, -0.1, 0, 0, 0, 0.08, 0.03, 0.08)), [sd * 0.21, 0.045, -0.03], core, (s, A2) => { A2[5] = sd * (Math.sin(s.t * 7) * 0.6 + s.w * 0.4) - sd * s.die * 0.8; }, { glow: '#9ab8ff', ge: 2.4 }); } }),
      crater: () => quad({ seed: 90, bw: 0.62, bh: 0.4, bl: 0.7, hr: 0.32, L: 0.18, lr0: 0.15, lr1: 0.13, legOut: 0.8, tail: 0, eyes: [[-0.14, 0.12, 0.3, 0.05], [0.14, 0.12, 0.3, 0.05]], legC: '#4a4e60',
        headF: hr => cat(P(CO, '#c8bca8', 0, -hr * 0.1, hr * 1.05, 0, Math.PI / 2, 0, hr * 0.32, hr * 0.6, hr * 0.32), ...[-1, 1].map(sd => P(CO4, '#e8e0d0', sd * hr * 0.6, -hr * 0.6, hr * 0.4, 0, 0, Math.PI, 0.05, 0.25, 0.05))),
        bodyF: (w, h, l) => cat(...[0, 1, 2, 3, 4, 5].map(i => P(TOR, '#3a3e50', Math.sin(i * 2.1) * w * 0.55, h * (0.55 + (i % 2) * 0.12), Math.cos(i * 2.1) * l * 0.55, 0, 0, 0, 0.13 + (i % 3) * 0.04, 0.13, 0.13 + (i % 3) * 0.04))) }),
      starspawn: () => floater({ hover: 1.3, br: 0.3, spin: 2.5, eyes: [[-0.09, 0.05, 0.28, 0.05], [0.09, 0.05, 0.28, 0.05]],
        extra: (r, core) => { r.add(cat(...[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * TAU; return X(CO4, Math.sin(a) * 0.38, Math.cos(a) * 0.38, 0, 0, 0, -a, 0.08, 0.35, 0.08); }), X(CO4, 0, 0, 0.38, 0, Math.PI / 2, 0, 0.08, 0.3, 0.08), X(CO4, 0, 0, -0.38, 0, -Math.PI / 2, 0, 0.08, 0.3, 0.08)),
          [0, 0, 0], core, (s, A2) => { A2[5] = s.t * 1.7; const b = 1 + Math.sin(s.t * 5) * 0.12 + s.w * 0.3; A2[6] = A2[7] = A2[8] = b; }, { glow: '#e8eaff', ge: 2.6 });
          for (let k = 0; k < 3; k++) r.add(X(SPS, 0, 0, 0, 0, 0, 0, 0.05), [0, 0, 0], core, (s, A2) => { const a = s.t * 2.4 + k * TAU / 3; A2[0] = Math.sin(a) * 0.6; A2[2] = Math.cos(a) * 0.6; A2[1] = Math.sin(a * 2) * 0.2; }, { glow: '#9ab8ff', ge: 3, lod: 1 }); } }),
      hound: () => quad({ seed: 92, bw: 0.55, bh: 0.48, bl: 0.95, hr: 0.38, hz: 0.12, L: 0.6, lr0: 0.12, lr1: 0.08, legOut: 0.62, tail: 0.85, tw: 0.11, eyes: [[-0.17, 0.12, 0.34, 0.06], [0.17, 0.12, 0.34, 0.06]],
        headF: hr => cat(P(CO, '#3a3e54', 0, -hr * 0.05, hr * 1.2, 0, Math.PI / 2, 0, hr * 0.42, hr * 0.85, hr * 0.42), ...[-1, 1].map(sd => P(CO4, '#3a3e54', sd * hr * 0.5, hr * 0.8, -hr * 0.1, 0, 0, sd * -0.3, 0.1, 0.4, 0.07))),
        bodyF: (w, h, l) => cat(...[0, 1, 2, 3, 4].map(i => P(CO4, '#8a90b0', 0, h * 0.75, l * (0.5 - i * 0.25), 0, -0.3, 0, 0.07, 0.35 - Math.abs(i - 2) * 0.06, 0.07))),
        extra: (r, body) => { r.add(X(TOR, 0, 0, 0, 0, 0, 0, 0.32, 0.32, 0.18), [0, 0.62, -0.1], body, null, { glow: '#d8e4ff', ge: 2.2 }); } }),
      eclipse: () => floater({ hover: 1.35, br: 0.45, bry: 1.45, tendrils: 6, tl: 1.2, tw: 0.08, tseg: 2, tC: '#14121e', coreO: {}, eyes: [[-0.12, 0.36, 0.38, 0.05], [0.12, 0.36, 0.38, 0.05]],
        coreF: br => cat(P(CO, '#0e0c16', 0, br * 0.6, -0.04, 0, 0, 0, br * 0.85, br * 1.0, br * 0.85), P(CO, '#0e0c16', 0, -br * 0.3, 0, 0, 0, 0, br * 1.15, br * 1.5, br * 1.15)),
        extra: (r, core) => { r.add(X(CY, 0, 0, 0, 0, Math.PI / 2, 0, 0.62, 0.03, 0.62), [0, 0.75, -0.45], core, (s, A2) => { A2[5] = s.t * 0.3; }, { glow: '#ffd0a0', ge: 2.4 }); r.add(paint(X(CY, 0, 0, 0, 0, Math.PI / 2, 0, 0.52, 0.035, 0.52), DARK), [0, 0.75, -0.43], core); } }),
      // ---- the Mimic: a chest that walks on spider legs, all teeth and tongue
      mimic: () => quad({ seed: 66, legs: 6, bw: 0.55, bh: 0.35, bl: 0.55, hr: 0.3, hy: 0.2, hz: -0.45, L: 0.42, lr0: 0.05, lr1: 0.04, legOut: 0.95, legSpread: 0.75, legC: '#2a1a10', jaw: false, eyes: [[-0.25, 0.05, 0.3, 0.06], [0.25, 0.05, 0.3, 0.06], [0, 0.1, 0.32, 0.05]],
        bodyF: (w, h, l) => cat(P(BX, '#4a2a14', 0, 0, 0, 0, 0, 0, w * 2.1, h * 2.0, l * 2.1), P(BX, '#8a7a4a', w * 0.6, 0, 0, 0, 0, 0, 0.06, h * 2.05, l * 2.15), P(BX, '#8a7a4a', -w * 0.6, 0, 0, 0, 0, 0, 0.06, h * 2.05, l * 2.15), teeth(8, w * 1.8, h * 0.95, l * 1.0, 0.18, true)),
        headF: hr => cat(P(BX, '#4a2a14', 0, 0.05, 0.5, 0, 0, 0, 1.18, 0.32, 1.12), P(BX, '#d8b44a', 0, -0.05, 1.07, 0, 0, 0, 0.2, 0.2, 0.06), teeth(8, 1.0, -0.12, 1.02, 0.18, false), P(BX, '#c8283a', 0, -0.15, 0.8, 0, 0.4, 0, 0.3, 0.06, 0.8)),
        extra: (r, body, head) => { const f = r.parts[head].a; r.parts[head].a = (s, A2) => { f(s, A2); A2[4] = -0.5 - s.w * 0.6 - Math.max(0, Math.sin(s.t * 3)) * 0.15 + s.atk * 0.6; A2[3] = 0; }; } })
    };
    // ================================================================ BOSSES (each built from scratch)
    // Rotwood Treant: a towering slime tree. Root legs, a split bark face, branch arms, a canopy. Phase 2: the canopy burns with sickly fire
    DEF.treant = () => biped({ seed: 70, L: 0.62, tw: 0.55, th: 1.05, td: 0.48, hr: 0.4, al: 1.0, ar: 0.11, armC: bark, legC: bark, hipC: bark, lr0: 0.2, lr1: 0.24, headC: bark, swing: 'both', armOut: 0.35,
      torsoF: (w, h, d) => cat(P(CY, bark, 0, 0, 0, 0, 0, 0, w * 0.9, h * 1.2, d * 1.1), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => P(BX, '#2a1a0e', Math.sin(i * 0.8) * w * 0.85, (i % 4) * h * 0.25 - h * 0.4, Math.cos(i * 0.8) * d * 0.95, i * 0.8, 0, 0, 0.12, h * 0.7, 0.05)), P(IC, moss, w * 0.4, h * 0.2, d * 0.8, 1, 0, 0, 0.2, 0.25, 0.1), drips(6, w * 0.9, -h * 0.4, 0.35, 2)),
      headF: hr => cat(P(BF, '#0a0604', 0, -hr * 0.2, hr * 0.85, 0, 0, 0, hr * 0.9, hr * 0.22, 0.08), teeth(6, hr * 0.8, -hr * 0.12, hr * 0.92, hr * 0.25, false), P(BF, '#0a0604', 0, hr * 0.55, hr * 0.92, 0, 0, 0.2, 0.05, hr * 0.8, 0.04),
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => P(IC, leaf[i % 3], Math.sin(i * 0.7) * hr * 2.2, hr * (1.6 + (i % 3) * 0.45), Math.cos(i * 0.7) * hr * 1.8 - hr * 0.3, i, 0, 0, hr * (1.1 + (i % 2) * 0.4), hr * 0.8, hr * (1.1 + (i % 2) * 0.4))),
        ...[-1, 1].map(sd => P(CY5, bark, sd * hr * 0.9, hr * 1.2, -hr * 0.2, 0, 0, sd * -0.6, 0.07, hr * 2.2, 0.07))),
      eyes: [[-0.15, 0.12, 0.36, 0.08, 0.05], [0.15, 0.12, 0.36, 0.08, 0.05]],
      handF: sd => cat(...[-1, 0, 1].map(j => P(CO, bark, j * 0.08, -1.1, 0.06, 0, 0.3 * j, sd * 0.2, 0.05, 0.45, 0.05)), P(IC, leaf[1], sd * 0.1, -0.5, -0.05, 1, 0, 0, 0.18, 0.12, 0.18)),
      footF: (len, sd) => cat(...[0, 1, 2, 3].map(j => P(CO, bark, Math.sin(j * 1.6 + sd) * 0.1, -len, Math.cos(j * 1.6 + sd) * 0.12, j * 1.6, Math.PI / 2 - 0.25, 0, 0.09, 0.55, 0.09))),
      extra: (r, torso, head) => { r.add(cat(...[0, 1, 2, 3, 4, 5].map(i => X(CO, Math.sin(i * 1.1) * 0.7, 1.7 + (i % 3) * 0.2, Math.cos(i * 1.1) * 0.55 - 0.2, 0, 0, 0, 0.16, 0.7, 0.16))), [0, 0, 0], head, (s, A2) => { A2[7] = 0.8 + Math.sin(s.t * 9) * 0.2; }, { glow: '#9aff3a', ge: 2.6, p2: 1 });
        r.add(cat(...[0, 1, 2].map(i => X(SPS, Math.sin(i * 2.1) * 0.35, 0.1 + i * 0.25, 0.5, 0, 0, 0, 0.09))), [0, 0, 0], torso, null, { glow: '#9aff3a', ge: 2.2, pulse: 1 }); } });
    // Slime Pharaoh: a sarcophagus body, a striped headdress and two floating golden hands. Phase 2: the coffin lid splits and shows the glowing core
    DEF.pharaoh = () => { const r = Rig();
      const body = r.add(cat(P(G.lathe([[0.55, 0], [0.75, 0.15], [0.7, 0.9], [0.58, 1.55], [0.42, 1.85], [0, 1.9]], 4), '#2a2010', 0, 0, 0, 0.785, 0, 0, 1, 1, 0.8), ...[0, 1, 2, 3, 4].map(i => P(BX, i % 2 ? '#1a2a6a' : GOLD, 0, 0.35 + i * 0.28, 0.46 - i * 0.02, 0, 0, 0, 0.9 - i * 0.06, 0.14, 0.04)), drips(8, 0.6, 0.1, 0.3, 1)),
        [0, 0.25, 0], -1, (s, A2) => { A2[1] = Math.sin(s.t * 1.5) * 0.08 + s.w * 0.15; A2[4] = -s.w * 0.15 + s.atk * 0.15; A2[5] = Math.sin(s.t * 0.9) * 0.03; if (s.die) { A2[4] -= s.die * 1.4; A2[1] -= s.die * 0.3; } });
      r.add(paint(goo(0.38, 0.6, 0.12, 71), 'B'), [0, 0.95, 0.42], body, (s, A2) => { A2[7] = s.phase >= 2 ? 1 : 0.0001; }, { p2: 1 });
      r.add(X(SPH, 0, 0, 0, 0, 0, 0, 0.2, 0.3, 0.08), [0, 1.0, 0.5], body, null, { glow: 1, ge: 3, p2: 1, pulse: 1 });
      const lid = r.add(cat(P(BX, GOLD, 0, 0, 0, 0, 0, 0, 0.9, 1.1, 0.06), P(BX, '#1a2a6a', 0, 0.1, 0.035, 0, 0, 0, 0.5, 0.5, 0.02), ...[-1, 1].map(sd => P(BX, '#1a2a6a', sd * 0.2, -0.3, 0.035, 0, 0, sd * 0.785, 0.06, 0.45, 0.02))), [0, 0.95, 0.5], body, (s, A2) => { const o2 = s.phase >= 2 ? Math.min(1, s.phT / 0.8) : 0; A2[1] = -o2 * 0.4; A2[4] = o2 * 1.2; A2[2] = o2 * 0.2; });
      const head = r.add(cat(P(G.lathe([[0.62, -0.5], [0.66, -0.1], [0.5, 0.25], [0.28, 0.45], [0, 0.5]], 14), GOLD, 0, 0, -0.08, 0, 0, 0, 1, 1, 0.9), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = (i / 8 - 0.5) * 2.8; return P(BX, '#1a2a6a', Math.sin(a) * 0.6, -0.15, Math.cos(a) * 0.5 - 0.1, a, 0, 0, 0.1, 0.55, 0.04); }),
        P(BX, '#2a2010', 0, -0.05, 0.42, 0, 0, 0, 0.42, 0.5, 0.1), P(CY5, '#1a2a6a', 0, -0.48, 0.42, 0, 0.2, 0, 0.06, 0.35, 0.06), P(CO, GOLD, 0, 0.25, 0.38, 0, 0.4, 0, 0.07, 0.3, 0.07)), [0, 2.15, 0], body, (s, A2) => { A2[4] = -s.w * 0.25 + s.atk * 0.2; A2[3] = Math.sin(s.t * 0.5) * 0.15; });
      r.add(eyeG([[-0.1, 0.02, 0.48, 0.06, 0.03], [0.1, 0.02, 0.48, 0.06, 0.03]]), [0, 0, 0], head, null, { eye: 1 });
      for (const sd of [-1, 1]) { const hand = r.add(cat(P(BX, GOLD, 0, 0, 0, 0, 0, 0, 0.32, 0.42, 0.12), ...[0, 1, 2, 3].map(j => P(BX, GOLD, -0.11 + j * 0.075, -0.32, 0, 0, 0, 0, 0.05, 0.25, 0.05)), P(BX, GOLD, sd * -0.18, -0.05, 0.05, 0, 0, sd * 0.6, 0.06, 0.22, 0.06)), [sd * 1.15, 1.4, 0.35], body, (s, A2) => {
          A2[1] = Math.sin(s.t * 2 + sd) * 0.15 + s.w * 0.9 - s.atk * 1.0; A2[2] = s.atk * 0.8; A2[0] = sd * (s.w * 0.3); A2[4] = -s.w * 1.2 + s.atk * 1.4; A2[5] = sd * Math.sin(s.t * 1.3) * 0.2; if (s.die) A2[1] -= s.die * 1.6; });
        r.add(X(TORT, 0, 0, 0, 0, Math.PI / 2, 0, 0.3, 0.3, 0.3), [0, 0, 0], hand, (s, A2) => { A2[3] = s.t * 2; }, { glow: '#2aff9a', ge: 2, lod: 1 }); }
      r.add(cat(X(CY5, 0, 0, 0, 0, 0, 0, 0.03, 0.9, 0.03), X(TORT, 0, 0.55, 0, 0, Math.PI / 2, 0, 0.14, 0.18, 0.14)), [0.95, 1.2, 0.45], body, (s, A2) => { A2[1] = Math.sin(s.t * 2.3) * 0.12; A2[3] = s.t * 0.7; }, { glow: GOLD, ge: 1.2, lod: 1 });
      return r.done({ h: 2.8, kind: 'pharaoh' }); };
    // The Lich: a hovering cloaked skeleton. The phylactery burns in its chest; skeletal hands hold a staff. Phase 2: the hood falls and the crown blazes
    DEF.lich = () => { const r = Rig();
      const robe = r.add(cat(P(G.lathe([[0.85, -0.2], [0.8, 0.3], [0.62, 0.9], [0.45, 1.35], [0.35, 1.6], [0, 1.65]], 14), '#0c0a10', 0, 0, 0, 0, 0, 0, 1, 1, 1), ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => { const a = i / 9 * TAU; return P(CO4, '#0c0a10', Math.sin(a) * 0.8, -0.35, Math.cos(a) * 0.8, a, Math.PI, 0, 0.14, 0.5, 0.05); }), drips(9, 0.78, -0.25, 0.3, 0.5),
        ...[0, 1, 2].map(i => P(TORT, BONE, 0, 0.75 + i * 0.16, 0.18, 0, 0.2, 0, 0.3 - i * 0.03, 0.3, 0.22))), [0, 0.65, 0], -1, (s, A2) => { A2[1] = Math.sin(s.t * 1.4) * 0.15 + s.w * 0.3; A2[4] = -s.w * 0.12 + s.atk * 0.15; A2[5] = Math.sin(s.t * 0.8) * 0.04; if (s.die) { A2[1] -= s.die * 0.6; A2[7] = 1 - s.die * 0.6; } });
      r.add(cat(X(OCT, 0, 0, 0, 0, 0, 0, 0.13, 0.22, 0.13)), [0, 0.95, 0.24], robe, (s, A2) => { A2[3] = s.t * 1.5; const k = 1 + Math.sin(s.t * 4) * 0.1; A2[6] = A2[7] = A2[8] = k; }, { glow: '#3affc8', ge: 3.2, pulse: 1 });
      const head = r.add(cat(P(SPH, BONE, 0, 0, 0, 0, 0, 0, 0.3, 0.32, 0.3), P(SPS, '#050505', -0.11, 0.03, 0.24, 0, 0, 0, 0.08, 0.09, 0.05), P(SPS, '#050505', 0.11, 0.03, 0.24, 0, 0, 0, 0.08, 0.09, 0.05), P(BX, BONE, 0, -0.22, 0.12, 0, 0, 0, 0.3, 0.12, 0.22), teeth(5, 0.22, -0.16, 0.25, 0.06, true)), [0, 1.75, 0.05], robe, (s, A2) => { A2[4] = -s.w * 0.3 + s.atk * 0.3; A2[3] = Math.sin(s.t * 0.6) * 0.2; });
      r.add(P(G.lathe([[0.5, -0.45], [0.46, 0.0], [0.34, 0.3], [0, 0.5]], 12), '#0a080e', 0, 0.08, -0.2, 0, -0.35, 0, 1, 1, 0.85), [0, 0, 0], head, null, { p1: 1 });   // the hood sits back so the skull shows
      r.add(cat(P(CY, '#5a4a2a', 0, 0.28, 0, 0, 0, 0, 0.3, 0.08, 0.3), ...[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * TAU; return P(CO4, '#5a4a2a', Math.sin(a) * 0.27, 0.42, Math.cos(a) * 0.27, a, 0, 0, 0.05, 0.25, 0.03); })), [0, 0, 0], head, null, { p2: 1 });
      r.add(cat(...[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * TAU; return X(SPS, Math.sin(a) * 0.27, 0.6, Math.cos(a) * 0.27, 0, 0, 0, 0.04); })), [0, 0, 0], head, null, { glow: '#3affc8', ge: 3, p2: 1 });
      r.add(eyeG([[-0.11, 0.03, 0.26, 0.04, 0.04], [0.11, 0.03, 0.26, 0.04, 0.04]]), [0, 0, 0], head, null, { eye: 1 });
      for (const sd of [-1, 1]) { const arm = r.add(cat(P(CY5, '#0c0a10', 0, -0.25, 0, 0, 0, 0, 0.14, 0.55, 0.14), P(CY5, BONE, 0, -0.65, 0.02, 0, 0, 0, 0.035, 0.4, 0.035), ...[0, 1, 2].map(j => P(CY5, BONE, (j - 1) * 0.04, -0.95, 0.05, 0, 0.2, 0, 0.015, 0.16, 0.015)), sd > 0 ? cat(P(CY5, '#2a2018', 0, -0.9, 0.05, 0, 0, 0, 0.03, 2.2, 0.03), P(SPS, BONE, 0, 0.25, 0.05, 0, 0, 0, 0.16, 0.18, 0.16)) : []), [sd * 0.55, 1.45, 0.05], robe, (s, A2) => {
          A2[4] = -0.35 - s.w * (sd > 0 ? 0.4 : 2.2) + s.atk * (sd > 0 ? 0.3 : 2.6) + Math.sin(s.t * 1.2 + sd) * 0.08; A2[5] = sd * (0.25 + s.w * 0.3); });
        if (sd > 0) r.add(X(SPH, 0, 0, 0, 0, 0, 0, 0.11), [0, 0.25, 0.05], arm, (s, A2) => { const k = 1 + s.w * 0.8; A2[6] = A2[7] = A2[8] = k; }, { glow: '#3affc8', ge: 3 }); }
      return r.done({ h: 2.6, kind: 'lich', fly: true }); };
    // Frost Wyrm: a long ice serpent with wings, an icy jaw and icicle spines. Phase 2: the wings spread wide and frost pours off them
    DEF.wyrm = () => serpent({ segs: 9, sr: 0.4, gap: 0.42, hover: 0.5, rear: 1.4,
      headF: sr => cat(horn(sr * 0.45, sr * 0.6, -sr * 0.2, 1, 0.7, 0.07, '#d8eaf8', 0.15), horn(-sr * 0.45, sr * 0.6, -sr * 0.2, -1, 0.7, 0.07, '#d8eaf8', 0.15), P(CO, 'B', 0, 0, sr * 1.4, 0, Math.PI / 2, 0, sr * 0.6, sr * 1.0, sr * 0.45), spikes(5, sr * 0.5, sr * 0.8, 0.3, 0.04, '#bfe8ff', -0.7)),
      segF: (i, r2) => cat(P(CO, '#bfe8ff', 0, r2 * 0.85, 0, 0, -0.4, 0, 0.06, 0.4 * (1 - i / 12), 0.06), P(SPS, 'S', 0, -r2 * 0.5, 0, 0, 0, 0, r2 * 0.8, r2 * 0.3, r2 * 0.9)),
      extra: (r, head) => { for (const sd of [-1, 1]) { const wing = r.add(paint(cat(X(BF, sd * 0.75, 0, 0, 0, 0, 0, 1.5, 0.03, 0.8), ...[0, 1, 2, 3].map(j => X(CO4, sd * (0.2 + j * 0.42), 0, -0.3 - j * 0.05, 0, Math.PI, 0, 0.04, 0.55, 0.04)), ...[0, 1, 2].map(j => X(CO, sd * (0.35 + j * 0.45), -0.02, -0.65, 0, Math.PI, 0, 0.05, 0.35, 0.05))), '#5a8ab8'), [sd * 0.3, 0.9, -0.4], -1, (s, A2) => {
            A2[5] = sd * (Math.sin(s.t * 2.2) * 0.35 + 0.2 + (s.phase >= 2 ? 0.25 : 0) + s.w * 0.5); A2[1] = Math.sin(s.t * 1.4) * 0.25; A2[0] = Math.sin(s.t * 2.2 - 0.75) * 0.1; if (s.die) A2[5] -= sd * s.die; }); }
        r.add(cat(...[0, 1, 2, 3].map(i => X(OCT, (i - 1.5) * 0.15, 0.1, 0.5, 0, Math.PI / 2, 0, 0.04, 0.12, 0.04))), [0, 0, 0], head, null, { glow: '#bff8ff', ge: 2.2, p2: 1 }); } });
    // Inferno Titan: a molten golem with a lava core and rock armour plates. Phase 2: the plates crack off and the core blazes
    DEF.titan = () => biped({ seed: 76, L: 0.62, tw: 0.62, th: 0.9, td: 0.52, hr: 0.26, al: 0.95, ar: 0.2, fist: 0.32, fistS: IC, fistC: '#1a1210', armC: 'S', legC: 'S', lr0: 0.2, lr1: 0.24, swing: 'both', armOut: 0.15,
      torsoF: (w, h, d) => cat(P(IC, '#1a1210', -w * 0.9, h * 0.55, 0, 1, 0, 0, w * 0.55, w * 0.45, w * 0.55), P(IC, '#1a1210', w * 0.9, h * 0.55, 0, 2, 0, 0, w * 0.55, w * 0.45, w * 0.55), horn(w * 0.6, h * 0.7, -0.1, 1, 0.7, 0.1, '#140c0a', 0.3), horn(-w * 0.6, h * 0.7, -0.1, -1, 0.7, 0.1, '#140c0a', 0.3)),
      headF: hr => cat(P(BX, '#1a1210', 0, hr * 0.2, 0, 0, 0, 0, hr * 2.2, hr * 1.4, hr * 2.0), P(BF, '#0a0604', 0, -hr * 0.2, hr * 1.02, 0, 0, 0, hr * 1.4, hr * 0.25, 0.02)), eyes: [[-0.1, 0.05, 0.27, 0.07, 0.03], [0.1, 0.05, 0.27, 0.07, 0.03]],
      extra: (r, torso, head) => { r.add(X(SPH, 0, 0.05, 0.38, 0, 0, 0, 0.32, 0.32, 0.16), [0, 0, 0], torso, (s, A2) => { const k = 1 + Math.sin(s.t * 3) * 0.06 + s.w * 0.2; A2[6] = A2[7] = A2[8] = k; }, { glow: LAVA, ge: 3, pulse: 1 });
        r.add(cat(...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => X(BF, Math.sin(i * 1.3) * 0.5, -0.4 + (i % 5) * 0.2, Math.cos(i * 1.3) * 0.4 + 0.08, i * 1.3, 0, (i % 2 ? 0.6 : -0.5), 0.04, 0.3, 0.03))), [0, 0, 0], torso, null, { glow: '#ff8a2a', ge: 2.4, pulse: 1 });
        r.add(cat(...[0, 1, 2, 3, 4, 5].map(i => P(BX, '#2a1c18', Math.sin(i * 1.05) * 0.62, -0.1 + (i % 3) * 0.3, Math.cos(i * 1.05) * 0.5, i * 1.05, 0, 0, 0.42, 0.32, 0.1))), [0, 0, 0], torso, (s, A2) => { if (s.phase >= 2) { const k = Math.min(1, s.phT * 1.5); A2[1] = -k * 2; A2[6] = A2[7] = A2[8] = Math.max(0.0001, 1 - k); } });
        r.add(cat(...[0, 1, 2, 3, 4].map(i => X(CO, (i - 2) * 0.12, 0.35, -0.05, 0, 0, (i - 2) * 0.2, 0.1, 0.55, 0.1))), [0, 0, 0], head, (s, A2) => { A2[7] = 0.85 + Math.sin(s.t * 12) * 0.15; }, { glow: '#ffb03a', ge: 3, p2: 1 }); } });
    // Storm Dragon: a winged dragon of storm cloud with lightning in its veins. Phase 2: lightning crackles over the whole body
    DEF.dragon = () => quad({ seed: 78, bw: 0.55, bh: 0.48, bl: 0.95, hr: 0.32, hy: 0.55, hz: 0.25, L: 0.55, lr0: 0.13, lr1: 0.09, tail: 1.6, tw: 0.16,
      bodyF: (w, h, l) => cat(...[0, 1, 2, 3, 4, 5].map(i => P(CO, '#2a2a40', 0, h * 0.85, l * (0.7 - i * 0.28), 0, -0.5, 0, 0.07, 0.35, 0.07)), P(CY, 'B', 0, h * 0.5, l * 0.75, 0, -0.9, 0, 0.22, 0.75, 0.22)),
      headF: hr => cat(P(CO, 'B', 0, -hr * 0.1, hr * 1.2, 0, Math.PI / 2, 0, hr * 0.55, hr * 1.2, hr * 0.42), horn(hr * 0.5, hr * 0.5, -hr * 0.3, 1, 0.6, 0.06, '#2a2a40', 0.15), horn(-hr * 0.5, hr * 0.5, -hr * 0.3, -1, 0.6, 0.06, '#2a2a40', 0.15)),
      tailF: tl => cat(P(CO4, '#8ab0ff', 0, 0, -tl, 0, -Math.PI / 2, 0, 0.18, 0.3, 0.05)),
      extra: (r, body) => { for (const sd of [-1, 1]) r.add(paint(cat(X(BF, sd * 0.9, 0, 0, 0, 0, 0, 1.8, 0.03, 0.9), ...[0, 1, 2, 3].map(j => X(CO4, sd * (0.25 + j * 0.5), 0, -0.35, 0, Math.PI, 0, 0.04, 0.7, 0.04))), '#1a1a40'), [sd * 0.4, 0.45, 0.1], body, (s, A2) => { A2[5] = sd * (Math.sin(s.t * (s.mv > 0.3 ? 4 : 1.6)) * 0.4 + 0.25 + s.w * 0.6); if (s.die) A2[5] -= sd * s.die * 1.2; });
        r.add(cat(...[0, 1, 2, 3, 4, 5, 6, 7].map(i => X(BF, Math.sin(i * 2.1) * 0.35, 0.1 + (i % 3) * 0.12, 0.7 - i * 0.2, i, 0, 0.5, 0.025, 0.02, 0.4))), [0, 0, 0], body, (s, A2) => { A2[6] = A2[7] = A2[8] = Math.random() < (s.phase >= 2 ? 0.4 : 0.12) ? 1.2 : 1; }, { glow: '#9ab8ff', ge: 3, pulse: 1 }); } });
    // The Slime King: a giant armoured king on a throne of slime, cape, crown and sceptre. Phase 2: he rises off the throne
    DEF.king = () => { const r = Rig();
      r.add(cat(paint(goo(1.05, 0.4, 0.95, 80, 0.07), 'S'), P(BX, 'S', 0, 0.7, -0.75, 0, 0.1, 0, 1.6, 1.3, 0.3), ...[-1, 1].map(sd => P(SPH, 'S', sd * 0.95, 0.55, -0.55, 0, 0, 0, 0.25, 0.4, 0.25)), drips(10, 0.95, -0.1, 0.3, 0.3)), [0, 0.35, -0.1], -1, (s, A2) => { breathe(s, A2, 0.04); if (s.die) A2[7] *= 1 - s.die * 0.8; });
      const torso = r.add(cat(paint(goo(0.62, 0.62, 0.55, 81), 'B'), P(BX, '#2a2630', 0, 0.1, 0.35, 0, 0, 0, 0.95, 0.75, 0.2), P(BX, '#8a6a2a', 0, 0.35, 0.46, 0, 0, 0, 1.0, 0.08, 0.04), ...[-1, 1].map(sd => P(SPH, '#2a2630', sd * 0.62, 0.45, 0, 0, 0, 0, 0.3, 0.22, 0.3)), P(SPS, '#ff2a8a', 0, 0.1, 0.47, 0, 0, 0, 0.08, 0.08, 0.04)), [0, 1.2, 0.1], -1, (s, A2) => {
        A2[1] = (s.phase >= 2 ? 0.35 : 0) + Math.sin(s.t * 1.6) * 0.04 - s.w * 0.1; A2[4] = -s.w * 0.25 + s.atk * 0.3; A2[2] = s.phase >= 2 ? 0.25 : 0; breathe(s, A2, 0.02); if (s.die) { A2[1] -= s.die * 0.9; A2[4] += s.die * 0.5; } });
      r.add(paint(cat(X(BF, 0, -0.55, -0.1, 0, 0.12, 0, 1.4, 1.4, 0.05)), '#3a0a2a'), [0, 0.45, -0.5], torso, (s, A2) => { A2[4] = Math.sin(s.t * 1.1) * 0.06 + s.mv * 0.3; });
      const head = r.add(cat(paint(goo(0.38, 0.36, 0.36, 82), 'B'), P(CY, '#8a6a2a', 0, 0.3, 0, 0, 0, 0, 0.34, 0.1, 0.34), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i / 8 * TAU; return P(CO4, '#8a6a2a', Math.sin(a) * 0.31, 0.5, Math.cos(a) * 0.31, a, 0, 0, 0.06, 0.32, 0.04); }), P(SPS, '#ff2a8a', 0, 0.32, 0.34, 0, 0, 0, 0.06, 0.06, 0.03), teeth(5, 0.3, -0.12, 0.33, 0.08, true)), [0, 0.85, 0.05], torso, (s, A2) => { A2[4] = -s.w * 0.25 + s.atk * 0.2; A2[3] = Math.sin(s.t * 0.5) * 0.2; });
      r.add(eyeG([[-0.13, 0.06, 0.33, 0.06, 0.04], [0.13, 0.06, 0.33, 0.06, 0.04], [-0.06, 0.16, 0.34, 0.035], [0.06, 0.16, 0.34, 0.035]]), [0, 0, 0], head, null, { eye: 1 });
      for (const sd of [-1, 1]) { const arm = r.add(cat(paint(tube(0.75, 0.16, 0.13), 'B'), P(SPH, '#2a2630', 0, -0.8, 0, 0, 0, 0, 0.18, 0.18, 0.18), sd > 0 ? cat(P(CY5, '#8a6a2a', 0, -0.85, 0.3, 0, Math.PI / 2 + 0.4, 0, 0.04, 1.5, 0.04), P(SPS, '#ff2a8a', 0, -0.85 + 0.3, 1.0, 0, 0, 0, 0.12, 0.12, 0.12)) : []), [sd * 0.78, 0.4, 0], torso, (s, A2) => {
          A2[4] = (sd > 0 ? -0.6 : -0.2) - s.w * 2.2 + s.atk * 2.6 + Math.sin(s.t * 1.4 + sd) * 0.06; A2[5] = sd * (0.2 + s.w * 0.2 + s.die * 0.8); }); }
      return r.done({ h: 2.6, kind: 'king' }); };
    // The Abyssal Lord: a many-eyed tentacle horror with a gaping maw. Phase 2: more eyes open and the tentacles thrash
    DEF.abyssal = () => { const r = Rig();
      const body = r.add(cat(paint(goo(0.95, 0.9, 0.9, 85, 0.09), 'B'), horn(0.5, 0.7, -0.1, 1, 0.8, 0.09, '#1a0a10', 0.3), horn(-0.5, 0.7, -0.1, -1, 0.8, 0.09, '#1a0a10', 0.3), spikes(8, 0.75, 0.55, 0.35, 0.06, '#2a0a14', 0.7), drips(10, 0.85, -0.6, 0.35, 0.2)), [0, 1.15, 0], -1, (s, A2) => {
        A2[1] = Math.sin(s.t * 1.2) * 0.08 - s.w * 0.2; A2[4] = -s.w * 0.2 + s.atk * 0.25; breathe(s, A2, 0.05); if (s.die) { A2[1] -= s.die * 0.9; A2[7] *= 1 - s.die * 0.5; } });
      const jaw = r.add(cat(P(SPH, MOUTH, 0, 0.05, 0.25, 0, 0, 0, 0.55, 0.12, 0.45), teeth(9, 0.9, 0.1, 0.62, 0.22, true), P(SPH, 'S', 0, -0.05, 0.2, 0, 0, 0, 0.7, 0.2, 0.55)), [0, -0.25, 0.55], body, (s, A2) => { A2[4] = 0.15 + s.w * 0.6 + s.atk * 0.2 + Math.max(0, Math.sin(s.t * 0.9)) * 0.12; });
      r.add(cat(P(SPH, MOUTH, 0, -0.1, 0.8, 0, 0, 0, 0.5, 0.35, 0.18), teeth(9, 0.9, -0.05, 0.92, 0.22, false)), [0, 0, 0], body, null, {});
      const eyesAt = []; for (let i = 0; i < 11; i++) { const a = (i / 10 - 0.5) * 2.6, y = 0.15 + (i % 3) * 0.22 + (i % 2) * 0.08; eyesAt.push([Math.sin(a) * 0.84, y, Math.cos(a) * 0.78, 0.07 + (i % 4) * 0.02]); }
      r.add(eyeG(eyesAt.slice(0, 6)), [0, 0, 0], body, null, { eye: 1 }); r.add(eyeG(eyesAt.slice(6)), [0, 0, 0], body, (s, A2) => { if (s.phase < 2) hide(A2); else { const k = Math.min(1, s.phT); A2[7] = k; } }, { eye: 1 });
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; let prev = -1;
        for (let j = 0; j < 4; j++) { const w = 0.14 - j * 0.028; prev = r.add(paint(tube(0.42, w, w * 0.8, 6), j === 3 ? DARK : 'S'), j === 0 ? [Math.sin(a) * 0.75, -0.55, Math.cos(a) * 0.75] : [0, -0.42, 0], j === 0 ? body : prev, (s, A2) => {
            const thr = s.phase >= 2 ? 1.6 : 1; A2[4] = (j === 0 ? Math.cos(a) * 1.2 : 0.35) + Math.sin(s.t * 1.8 * thr + k + j * 0.8) * 0.35 * thr + s.w * (j === 0 ? -0.5 : 0); A2[5] = (j === 0 ? -Math.sin(a) * 1.2 : 0) + Math.cos(s.t * 1.5 * thr + k * 1.3 + j) * 0.3 * thr; }, { lod: j > 1 ? 1 : 0 }); } }
      return r.done({ h: 2.8, kind: 'abyssal' }); };
    // The Corrupted: a shifting glitch form that breaks apart and reassembles (blob -> knight -> scattered cubes)
    DEF.glitchking = () => { const r = Rig(), n = 14, hubI = r.add([], [0, 0, 0], -1, (s, A2) => { if (s.die) { A2[6] = A2[8] = 1 + s.die; A2[7] = Math.max(0.0001, 1 - s.die); } });
      const formA = i => { const a = i * 2.4, rr = 0.6 + (i % 3) * 0.2; return [Math.sin(a) * rr, 0.5 + (i % 5) * 0.32, Math.cos(a) * rr * 0.8]; };
      const formB = i => { const col = [[0, 2.2, 0], [0, 1.7, 0], [0, 1.3, 0], [-0.6, 1.8, 0], [0.6, 1.8, 0], [-0.9, 1.4, 0.1], [0.9, 1.4, 0.1], [-0.3, 0.9, 0], [0.3, 0.9, 0], [-0.3, 0.45, 0], [0.3, 0.45, 0], [-1.05, 1.0, 0.25], [1.05, 1.0, 0.25], [0, 2.55, 0]]; return col[i]; };
      for (let i = 0; i < n; i++) { const sz = i < 3 ? 0.55 : 0.32 + (i % 3) * 0.08;
        r.add(paint(X(BF, 0, 0, 0, i, i * 0.4, 0, sz, sz, sz), i % 4 === 0 ? '#1aff8a' : i % 4 === 1 ? '#ff2a6a' : 'B'), [0, 0, 0], hubI, (s, A2) => {
          const cyc = (s.t * 0.16 + (s.phase >= 2 ? 0.5 : 0)) % 1, f = cyc < 0.4 ? 0 : cyc < 0.5 ? (cyc - 0.4) * 10 : cyc < 0.85 ? 1 : 1 - (cyc - 0.85) / 0.15, a = formA(i), b = formB(i), sc = Math.sin((cyc * 4 + i * 0.13) * Math.PI);
          const brk = (cyc > 0.4 && cyc < 0.5) || cyc > 0.85 ? 0.5 : 0; A2[0] = a[0] + (b[0] - a[0]) * f + Math.sin(i * 7 + s.t * 3) * brk; A2[1] = a[1] + (b[1] - a[1]) * f + s.w * 0.3 * (i % 2 ? 1 : -1) + Math.sin(s.t * 2 + i) * 0.05; A2[2] = a[2] + (b[2] - a[2]) * f + Math.cos(i * 5 + s.t * 3) * brk;
          A2[3] = s.t * (i % 2 ? 0.7 : -0.5) * (1 - f) ; A2[4] = s.atk * 0.4; if (Math.random() < 0.03) { A2[0] += (Math.random() - 0.5) * 0.6; A2[6] = A2[7] = A2[8] = 1.4; } if (sc < -0.97) A2[1] += 0.2; }); }
      r.add(eyeG([[-0.15, 0, 0.29, 0.08, 0.03], [0.15, 0, 0.29, 0.08, 0.03]]), [0, 0, 0], 1 + 0, (s, A2) => { }, { eye: 1 });
      r.add(X(SPH, 0, 0, 0, 0, 0, 0, 0.3), [0, 1.3, 0], hubI, (s, A2) => { const k = 1 + Math.sin(s.t * 5) * 0.15 + s.w * 0.5; A2[6] = A2[7] = A2[8] = k; A2[1] = Math.sin(s.t) * 0.2; }, { glow: '#1aff8a', ge: 3.2, pulse: 1 });
      return r.done({ h: 2.8, kind: 'glitchking' }); };
    // the colossal slime in the town raid uses the King's body
    const cache = {};
    B.has = id => !!DEF[id];
    B.get = id => cache[id] || (cache[id] = DEF[id] ? DEF[id]() : null);
    // ---- Update 6 bosses
    // The Leviathan Bishop: a drowned sea-serpent in a cracked mitre, an angler's lure of cold light, barnacled coils. Phase 2: its throat lights up and a second lure grows
    DEF.leviathan = () => serpent({ segs: 8, sr: 0.48, gap: 0.55, hover: 0.25, rear: 1.4, eyes: [[-0.24, 0.18, 0.5, 0.07], [0.24, 0.18, 0.5, 0.07], [-0.32, 0.3, 0.38, 0.05], [0.32, 0.3, 0.38, 0.05]],
      headF: sr => cat(P(CO4, '#e8e0c8', 0, sr * 1.35, -0.08, 0, 0, 0, sr * 0.55, sr * 1.0, sr * 0.35), P(BF, GOLD, 0, sr * 1.0, -0.08, 0, 0, 0, sr * 1.0, sr * 0.12, sr * 0.62), P(BF, GOLD, 0, sr * 1.5, sr * 0.02, 0, 0, 0, 0.04, sr * 0.7, 0.02),
        P(CY5, '#1a3a3a', 0, sr * 0.95, sr * 0.95, 0, 0.9, 0, 0.035, sr * 1.0, 0.035), ...[0, 1, 2, 3].map(i => P(G.lathe([[0.1, 0], [0.12, 0.1], [0.05, 0.15], [0, 0.15]], 6), '#c8c0a0', Math.sin(i * 1.9) * sr * 0.8, sr * 0.55, -sr * 0.4 + Math.cos(i * 1.9) * sr * 0.3, 0, 0.3, 0, 1, 1, 1))),
      segF: (i, r2) => cat(...[-1, 1].map(sd => P(CO4, '#1a4a4a', sd * r2 * 0.95, -r2 * 0.1, 0, 0, 0, sd * -1.25, 0.05, r2 * 0.8, r2 * 0.55)), i % 2 ? P(G.lathe([[0.1, 0], [0.12, 0.1], [0.05, 0.15], [0, 0.15]], 6), '#c8c0a0', r2 * 0.3, r2 * 0.85, 0, 0, 0, 0.3, 1.3, 1.3, 1.3) : [], i % 3 === 0 ? P(SPS, '#5affe0', 0, r2 * 0.2, r2 * 0.95, 0, 0, 0, 0.06) : []),
      extra: (r, head) => { r.add(cat(X(SPH, 0, 0, 0, 0, 0, 0, 0.13)), [0, 1.0, 1.0], head, (s, A2) => { A2[1] = Math.sin(s.t * 2.2) * 0.06; A2[0] = Math.cos(s.t * 1.6) * 0.05; }, { glow: '#7affe8', ge: 3.2 });
        r.add(X(SPH, 0, 0, 0, 0, 0, 0, 0.22, 0.16, 0.08), [0, -0.15, 0.62], head, null, { glow: '#5affe0', ge: 3, p2: 1, pulse: 1 });
        r.add(cat(X(CY5, 0, 0.35, 0, 0, -0.6, 0, 0.03, 0.7, 0.03), X(SPH, 0, 0.72, 0.4, 0, 0, 0, 0.1)), [0.3, 0.75, 0.3], head, (s, A2) => { A2[5] = Math.sin(s.t * 1.8) * 0.2; }, { glow: '#7affe8', ge: 2.6, p2: 1 }); } });
    // The Clockmaker: a clock-faced tinkerer with gears turning on its back and a giant winding key. Phase 2: the glass cracks, its hands spin wild, two more arms unfold
    DEF.clockmaker = () => biped({ seed: 94, L: 0.6, tw: 0.55, th: 0.85, td: 0.42, hr: 0.42, al: 0.9, ar: 0.12, armC: '#5a4a3a', legC: '#3a3028', hipC: '#3a3028', headC: '#3a3028', swing: 'both',
      eyes: [[-0.15, 0.1, 0.47, 0.06, 0.06, 0.03], [0.15, 0.1, 0.47, 0.06, 0.06, 0.03]],
      headF: hr => cat(P(CY, '#f0e8d0', 0, 0, hr * 0.62, 0, Math.PI / 2, 0, hr * 0.92, 0.06, hr * 0.92), P(TOR, '#b88a3a', 0, 0, hr * 0.64, 0, Math.PI / 2, 0, hr * 0.95, hr * 0.95, hr * 0.95), ...[...Array(12)].map((_, i) => { const a = i / 12 * TAU; return P(BF, '#1a1008', Math.sin(a) * hr * 0.75, Math.cos(a) * hr * 0.75, hr * 0.66, 0, 0, -a, 0.025, i % 3 ? 0.06 : 0.11, 0.01); }),
        P(CY5, '#b88a3a', 0, hr * 1.0, -0.05, 0, 0, 0, hr * 0.12, hr * 0.3, hr * 0.12), P(SPS, '#b88a3a', 0, hr * 1.3, -0.05, 0, 0, 0, hr * 0.16)),
      torsoF: (w, h, d) => cat(P(BX, '#5a2a1a', 0, 0, d * 0.25, 0, 0, 0, w * 1.6, h * 1.05, d * 1.4), ...[0, 1, 2].map(i => P(SPS, '#b88a3a', 0, h * (0.3 - i * 0.25), d * 0.95, 0, 0, 0, 0.05))),
      handF: (sd, al) => sd > 0 ? cat(P(CY5, '#b88a3a', 0, -al - 0.3, 0, 0, 0, 0, 0.04, 0.55, 0.04), P(TOR, '#b88a3a', 0, -al - 0.62, 0, 0, 0, Math.PI / 2, 0.16, 0.16, 0.16), P(TOR, '#b88a3a', 0, -al - 0.62, 0.0, 0, Math.PI / 2, Math.PI / 2, 0.16, 0.16, 0.16)) : P(BX, IRON, 0, -al - 0.2, 0.05, 0, 0, 0, 0.18, 0.35, 0.05),
      extra: (r, torso, head) => {
        r.add(paint(X(BF, 0, 0.13, 0, 0, 0, 0, 0.025, 0.26, 0.015), '#1a1008'), [0, 0, 0.7 * 0.42], head, (s, A2) => { A2[5] = -s.t * (s.phase >= 2 ? 6 : 0.6); });
        r.add(paint(X(BF, 0, 0.09, 0, 0, 0, 0, 0.03, 0.18, 0.015), '#1a1008'), [0, 0, 0.7 * 0.42], head, (s, A2) => { A2[5] = -s.t * (s.phase >= 2 ? 3.5 : 0.08); });
        for (const [x, y, rr, sp] of [[-0.3, 0.35, 0.42, 1], [0.32, 0.05, 0.32, -1.4], [0, -0.3, 0.26, 2]]) r.add(paint(cat(X(CY, 0, 0, 0, 0, Math.PI / 2, 0, rr, 0.08, rr), ...[...Array(10)].map((_, i) => { const a = i / 10 * TAU; return X(BF, Math.sin(a) * rr * 1.08, Math.cos(a) * rr * 1.08, 0, 0, 0, -a, 0.09, 0.1, 0.08); })), '#b88a3a'),
          [x, y, -0.48], torso, (s, A2) => { A2[5] = s.t * sp * (s.phase >= 2 ? 2.5 : 1); });
        r.add(X(BF, 0, 0, 0, 0, 0, 0.6, 0.02, 0.5, 0.012), [0.05, 0, 0.29], head, null, { glow: '#ffc84a', ge: 3, p2: 1 });
        for (const sd of [-1, 1]) r.add(paint(cat(tube(0.7, 0.07, 0.05, 6), X(CY, 0, -0.78, 0, 0, 0, Math.PI / 2, 0.24, 0.03, 0.24)), '#8a6a3a'), [sd * 0.35, 0.2, -0.4], torso, (s, A2) => { A2[4] = -1.6 + Math.sin(s.t * 3 + sd) * 0.5 - s.w * 0.8 + s.atk * 1.4; A2[5] = sd * 0.9; }, { p2: 1 }); } });
    // The Moon Eater: a moon-sized maw with grey cratered skin, a ring of teeth and a crown of eyes. Phase 2: its throat burns white and the craters crack open
    DEF.mooneater = () => floater({ hover: 1.7, br: 0.95, eyes: false, tendrils: 8, tl: 1.7, tw: 0.11, tseg: 3, tC: '#3a3e50', coreO: {},
      coreG: br => cat(paint(goo(br, br * 0.92, br, 96, 0.04), 'B'), ...[0, 1, 2, 3, 4, 5, 6].map(i => { const a = i * 1.3 + 0.4, y = Math.sin(i * 2.2) * 0.5; return P(TOR, '#2a2c3a', Math.sin(a) * br * 0.86, y * br, Math.cos(a) * br * 0.86 - 0.05, a, Math.PI / 2 - y, 0, 0.16 + (i % 3) * 0.05, 0.16 + (i % 3) * 0.05, 0.08); })),
      coreF: br => cat(P(SPH, MOUTH, 0, -br * 0.15, br * 0.62, 0, 0, 0, br * 0.62, br * 0.5, br * 0.42), ...[...Array(14)].map((_, i) => { const a = i / 14 * TAU, x = Math.cos(a) * br * 0.55, y = Math.sin(a) * br * 0.44 - br * 0.15; return P(CO4, TOOTH, x, y, br * 0.92, 0, Math.PI / 2, -a - Math.PI / 2, 0.05, 0.22, 0.05); })),
      extra: (r, core) => { r.add(cat(...[-2, -1, 0, 1, 2].map(i => X(SPS, i * 0.18, 0.62 + (2 - Math.abs(i)) * 0.06, 0.62 - Math.abs(i) * 0.06, 0, 0, 0, 0.08, 0.08, 0.05))), [0, 0, 0], core, (s, A2) => { A2[1] = Math.sin(s.t * 3) * 0.02; }, { eye: 1 });
        r.add(X(SPH, 0, 0, 0, 0, 0, 0, 0.36, 0.28, 0.12), [0, -0.15, 0.55], core, null, { glow: '#e8eaff', ge: 3, p2: 1, pulse: 1 });
        r.add(cat(...[0, 1, 2, 3, 4, 5].map(i => { const a = i * 1.3 + 0.4, y = Math.sin(i * 2.2) * 0.5; return X(SPS, Math.sin(a) * 0.83, y * 0.95, Math.cos(a) * 0.83 - 0.05, 0, 0, 0, 0.1, 0.1, 0.05); })), [0, 0, 0], core, null, { glow: '#9ab8ff', ge: 2.6, p2: 1 });
        for (const sd of [-1, 1]) r.add(paint(cat(X(CO, 0, 0.5, 0, 0, 0, sd * -0.5, 0.12, 0.9, 0.12)), '#c8ccf0'), [sd * 0.7, 0.55, -0.1], core, (s, A2) => { A2[5] = sd * (Math.sin(s.t * 1.2) * 0.08 + s.w * 0.3); }); } });
    B.draw = draw;
    // how each kind of creature breaks apart when it dies
    B.deathFx = { ice: 'shatter', snow: 'shatter', yeti: 'shatter', frostgiant: 'shatter', wyrm: 'shatter', magma: 'ash', cinder: 'ash', forge: 'ash', pyro: 'ash', smelter: 'ash', titan: 'ash',
      bone: 'bones', ghost: 'wisp', grave: 'bones', cknight: 'bones', banshee: 'wisp', lich: 'bones', glitchling: 'pixels', nullslime: 'pixels', errorknight: 'pixels', segfault: 'pixels', glitchking: 'pixels',
      spark: 'sparks', cloud: 'sparks', thunder: 'sparks', tempest: 'sparks', conduit: 'sparks', dragon: 'sparks', voidling: 'void', shade: 'void', abyss: 'shatter', voidknight: 'void', archon: 'void', king: 'void',
      sand: 'sand', scarab: 'sand', mummy: 'sand', guard: 'sand', pharaoh: 'sand',
      chorister: 'wisp', abbess: 'wisp', barnacle: 'bones', eel: 'void', bellringer: 'bones', leviathan: 'void', cog: 'sparks', piston: 'sparks', spring: 'sparks', foreman: 'sparks', pendulum: 'sparks', clockmaker: 'sparks',
      moth: 'wisp', crater: 'shatter', starspawn: 'sparks', hound: 'shatter', eclipse: 'void', mooneater: 'void' };
    return B;
  };
})(typeof self !== 'undefined' ? self : this);
