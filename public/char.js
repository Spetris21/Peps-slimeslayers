/* Slime Slayers - characters.
   Rounded bodies made of smooth shapes, painted faces with 12 expressions (blinking, eyes that look at things),
   hairstyles with bouncy secondary motion, outfit textures, a skeleton with blended animations, a 3-hit sword combo,
   reactions and 11 emotes. Everything is drawn with the engine's E.draw, so it works in the game and the lab. */
(function (root) {
  'use strict';
  root.SSChar = function (E) {
    const M = E.M, G = E.G, T = M.trs, mul = M.mul;
    const CH = {};
    const PI = Math.PI, TAU = PI * 2;
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k;
    const ease = k => k * k * (3 - 2 * k), easeOut = k => 1 - (1 - k) * (1 - k) * (1 - k), easeIn = k => k * k * k, lin = k => k;
    const WHITE = [1, 1, 1], MAG = [1, 0, 1];
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    // ================================================================ BODY SIZES (Roblox-style blocky avatar, ~2.5 units tall)
    // legs 0.96 (thigh + lower leg with shoe), torso 0.96 wide, arms beside the torso, a rounded block head
    const D = CH.D = { WAIST: 1.02, HIPX: 0.24, HIPY: -0.06, THIGH: 0.48, SHIN: 0.48, SHX: 0.715, SHY: 0.8, UA: 0.43, FA: 0.4, NECK: 0.9, HEADY: 0.31 };
    const HB = [0.31, 0.29, 0.3]; // head half size

    // ================================================================ GEOMETRY HELPERS
    function vtx(a, p, n, c, u, v) { a.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], u, v); }
    // lathe around Y. Front = +z, seam at the back. pts [[r, y]...] bottom→top. o: {col, zs (depth scale), a0, a1 (angle range), v(y)}
    function lathe(pts, seg, o) {
      o = o || {}; const col = o.col || WHITE, zs = o.zs || 1, a0 = o.a0 === undefined ? -PI : o.a0, a1 = o.a1 === undefined ? PI : o.a1, a = [];
      const N = pts.map((p, i) => { const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)], dr = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dr, dy) || 1; return [dy / l, -dr / l]; });
      const y0 = pts[0][1], y1 = pts[pts.length - 1][1];
      const P = (i, s) => { const ang = a0 + (a1 - a0) * s / seg, sn = Math.sin(ang), cs = Math.cos(ang), r = pts[i][0], y = pts[i][1];
        return [[r * sn, y, r * cs * zs], norm([N[i][0] * sn, N[i][1], N[i][0] * cs / zs]), s / seg, o.v ? o.v(y) : (y - y0) / ((y1 - y0) || 1)]; };
      for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < seg; s++) {
        const A = P(i, s), B = P(i, s + 1), C = P(i + 1, s + 1), Dd = P(i + 1, s);
        for (const q of [A, B, C, A, C, Dd]) vtx(a, q[0], q[1], col, q[2], q[3]);
      }
      return G.fix(a);
    }
    // tapered capsule hanging down from a joint at y = 0 to y = -len
    function capsule(r1, r2, len, col, seg) {
      const pts = [], n = 5;
      for (let i = 0; i <= n; i++) { const a = -PI / 2 + PI / 2 * i / n; pts.push([Math.cos(a) * r2, -len + Math.sin(a) * r2]); }
      for (let i = 0; i <= n; i++) { const a = PI / 2 * i / n; pts.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
      pts[0][0] = 0; pts[pts.length - 1][0] = 0;
      return lathe(pts, seg || 14, { col });
    }
    function sphere(r, col, seg, rings) { seg = seg || 16; rings = rings || 10; const pts = []; for (let i = 0; i <= rings; i++) { const a = -PI / 2 + PI * i / rings; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } pts[0][0] = 0; pts[rings][0] = 0; return lathe(pts, seg, { col }); }
    const X = (geo, x, y, z, yaw, pit, rol, sx, sy, sz, col) => G.xf(geo, T(x, y, z, yaw || 0, pit || 0, rol || 0, sx === undefined ? 1 : sx, sy === undefined ? (sx === undefined ? 1 : sx) : sy, sz === undefined ? (sx === undefined ? 1 : sx) : sz), col);
    const merge = (...g) => { const o = []; for (const a of g) for (let i = 0; i < a.length; i++) o.push(a[i]); return o; };
    const setUV = (geo, u, v) => { for (let k = 0; k < geo.length; k += 11) { geo[k + 9] = u; geo[k + 10] = v; } return geo; };
    // a matrix whose Y axis points along dir and Z axis close to zHint
    function frame(pos, dir, zHint) {
      const y = norm(dir); let z = zHint; const d = dot(z, y); z = norm([z[0] - y[0] * d, z[1] - y[1] * d, z[2] - y[2] * d]); const x = cross(y, z);
      return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, pos[0], pos[1], pos[2], 1]);
    }
    // points on a rounded-box shell around the head (for hair, hoods, helmets): phi = around (0 = front), height y
    const SE = 0.42, spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e), sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const elOf = y => Math.asin(clamp(spow(clamp(y / HB[1], -1, 1), 1 / SE), -1, 1));
    const surfE = (phi, el, rr) => { rr = rr || 1; const c = Math.cos(el); return [HB[0] * rr * spow(c * Math.sin(phi), SE), HB[1] * rr * spow(Math.sin(el), SE), HB[2] * rr * spow(c * Math.cos(phi), SE)]; };
    const surf = (phi, y, rr) => surfE(phi, elOf(y), rr);
    const surfNE = (phi, el) => { const e = 0.004, a = surfE(phi, el), b = surfE(phi + e, el), c = surfE(phi, Math.min(PI / 2, el + e)), n = cross(sub(b, a), sub(c, a)), l = Math.hypot(n[0], n[1], n[2]);
      if (l < 1e-9) return [0, Math.sign(el) || 1, 0]; const o = [n[0] / l, n[1] / l, n[2] / l]; return dot(o, a) < 0 ? [-o[0], -o[1], -o[2]] : o; };
    const surfN = (phi, y) => surfNE(phi, elOf(y));
    const surfUp = (phi, y) => { const el = elOf(y); return norm(sub(surfE(phi, Math.min(PI / 2, el + 0.02)), surfE(phi, el - 0.02))); };

    // ================================================================ BODY MESHES
    const MESH = {}, mesh = (k, fn) => MESH[k] || (MESH[k] = E.mesh(fn()));
    const RB = (r) => G.box(1, 1, 1, r === undefined ? 0.14 : r);
    // a box from y0 (top) down to y1 (bottom); cx/cz offsets
    const BX = (w, y0, y1, d, col, r, cx, cz, yaw, pit, rol) => X(RB(r), cx || 0, (y0 + y1) / 2, cz || 0, yaw || 0, pit || 0, rol || 0, w, y0 - y1, d, col);
    // head: rounded block. The front face is UV-mapped flat so a painted face sits on it; everything else maps to the skin border
    function headGeo() {
      const g = X(RB(0.3), 0, 0, 0, 0, 0, 0, HB[0] * 2, HB[1] * 2, HB[2] * 2);
      for (let k = 0; k < g.length; k += 11) { const x = g[k], y = g[k + 1], z = g[k + 2];
        if (z > 0.02) { g[k + 9] = 0.5 + x / 0.66; g[k + 10] = 0.5 - y / 0.62; } else { g[k + 9] = x > 0 ? 1.3 : -0.3; g[k + 10] = 0.5 - y / 0.62; } }
      return g;
    }
    // torso: textured shirt (UV wraps around: u = angle, v = height)
    function torsoGeo(shape) {
      const w = shape === 'slim' ? 0.9 : shape === 'chunky' ? 1.08 : 1, g = BX(0.96 * w, 0.9, 0.06, 0.48 * (shape === 'chunky' ? 1.1 : 1), WHITE, 0.16);
      for (let k = 0; k < g.length; k += 11) { const x = g[k], y = g[k + 1], z = g[k + 2]; g[k + 9] = 0.5 + Math.atan2(x, z) / TAU; g[k + 10] = 0.06 + 0.94 * clamp((0.9 - y) / 0.84, 0, 1); }
      return g;
    }
    function pelvisGeo(shape) {
      const w = shape === 'slim' ? 0.9 : shape === 'chunky' ? 1.08 : 1;
      return merge(BX(0.94 * w, 0.1, -0.16, 0.46, WHITE, 0.16), BX(0.97 * w, 0.07, -0.02, 0.49, [0.24, 0.15, 0.1], 0.3), BX(0.13, 0.08, -0.03, 0.04, [1, 0.8, 0.28], 0.3, 0, 0.245));
    }
    // limbs: white = clothing (tint 1), magenta = tint 2 (skin on arms, shoes on lower legs)
    const thighGeo = (shorts) => shorts ? merge(BX(0.46, 0.05, -0.24, 0.46, WHITE, 0.16), BX(0.43, -0.2, -0.5, 0.43, MAG, 0.16)) : BX(0.45, 0.05, -0.5, 0.45, WHITE, 0.16);
    const shinGeo = () => merge(BX(0.44, 0.02, -0.3, 0.44, WHITE, 0.16), BX(0.47, -0.27, -0.45, 0.5, MAG, 0.25, 0, 0.025), BX(0.48, -0.43, -0.5, 0.52, [0.95, 0.93, 0.88], 0.3, 0, 0.03), BX(0.3, -0.27, -0.33, 0.06, [0.95, 0.93, 0.88], 0.3, 0, 0.26));
    function upperArmGeo(sleeve) {
      if (sleeve === 'long') return BX(0.44, 0.1, -0.46, 0.44, WHITE, 0.16);
      if (sleeve === 'none') return BX(0.42, 0.1, -0.46, 0.42, MAG, 0.16);
      return merge(BX(0.46, 0.11, -0.2, 0.46, WHITE, 0.16), BX(0.42, -0.1, -0.46, 0.42, MAG, 0.16));
    }
    const foreArmGeo = sleeve => sleeve === 'long' ? merge(BX(0.43, 0.04, -0.24, 0.43, WHITE, 0.16), BX(0.41, -0.2, -0.44, 0.41, MAG, 0.2)) : BX(0.41, 0.04, -0.44, 0.41, MAG, 0.2);

    // ================================================================ GEAR (outfits on top of the body)
    const GOLD = [0.72, 0.55, 0.24], FUR = [0.7, 0.68, 0.66], DARK = [0.08, 0.08, 0.12], STEEL = [0.78, 0.82, 0.9], WOOD = [0.42, 0.26, 0.14];
    const GEO = {
      // ---- adventurer coat with a big fur collar (open at the front)
      coatTorso: () => { const g = [BX(1.02, 0.93, 0.03, 0.06, WHITE, 0.3, 0, -0.255), BX(0.06, 0.93, 0.03, 0.52, WHITE, 0.3, -0.51), BX(0.06, 0.93, 0.03, 0.52, WHITE, 0.3, 0.51),
          BX(0.32, 0.93, 0.03, 0.06, WHITE, 0.3, -0.35, 0.255), BX(0.32, 0.93, 0.03, 0.06, WHITE, 0.3, 0.35, 0.255), BX(1.02, 0.95, 0.89, 0.52, WHITE, 0.3),
          BX(0.07, 0.86, 0.03, 0.075, MAG, 0.3, -0.19, 0.262), BX(0.07, 0.86, 0.03, 0.075, MAG, 0.3, 0.19, 0.262)];
        for (const y of [0.62, 0.42, 0.22]) g.push(BX(0.05, y + 0.025, y - 0.025, 0.03, GOLD, 0.4, -0.25, 0.29));
        let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 34; i++) { const a = i / 34 * TAU, x = Math.sin(a) * 0.47, z = Math.cos(a) * 0.29; if (z > 0.2 && Math.abs(x) < 0.17) continue; g.push(X(sphere(0.075 + rnd() * 0.03, FUR, 9, 6), x, 0.88 + rnd() * 0.04, z)); }
        for (const s of [-1, 1]) for (const y of [0.8, 0.7, 0.6, 0.5]) g.push(X(sphere(0.06 + rnd() * 0.015, FUR, 9, 6), s * (0.2 + rnd() * 0.02), y, 0.29));
        return merge(...g); },
      coatTails: () => merge(BX(1.0, 0.0, -0.74, 0.05, WHITE, 0.3, 0, -0.25), BX(0.05, 0.0, -0.72, 0.5, WHITE, 0.3, -0.5), BX(0.05, 0.0, -0.72, 0.5, WHITE, 0.3, 0.5),
        BX(0.3, 0.0, -0.7, 0.05, WHITE, 0.3, -0.33, 0.255), BX(0.3, 0.0, -0.7, 0.05, WHITE, 0.3, 0.33, 0.255), BX(1.02, -0.66, -0.76, 0.06, MAG, 0.3, 0, -0.255), BX(0.32, -0.62, -0.72, 0.06, MAG, 0.3, -0.33, 0.262), BX(0.32, -0.62, -0.72, 0.06, MAG, 0.3, 0.33, 0.262)),
      coatSleeve: () => BX(0.49, 0.13, -0.47, 0.49, WHITE, 0.25),
      coatCuff: () => merge(BX(0.48, 0.05, -0.2, 0.48, WHITE, 0.25), BX(0.5, -0.14, -0.24, 0.5, MAG, 0.35)),
      // ---- golden knight
      kChest: () => merge(BX(1.02, 0.9, 0.05, 0.52, WHITE, 0.25), BX(0.98, 0.88, 0.38, 0.1, WHITE, 0.4, 0, 0.255), BX(0.9, 0.4, 0.14, 0.09, WHITE, 0.4, 0, 0.26),
        BX(1.0, 0.41, 0.36, 0.12, GOLD, 0.4, 0, 0.27), BX(1.0, 0.9, 0.86, 0.12, GOLD, 0.4, 0, 0.27), BX(0.07, 0.86, 0.4, 0.12, GOLD, 0.4, 0, 0.31), BX(0.66, 1.0, 0.86, 0.44, GOLD, 0.45),
        BX(0.9, 0.14, 0.08, 0.1, GOLD, 0.4, 0, 0.27)),
      kGem: () => X(sphere(0.085, WHITE, 12, 8), 0, 0.64, 0.33, 0, 0, 0, 1, 1, 0.55),
      // ---- Update 7 · the layered plate under every dungeon's armour (WHITE = the set's metal, MAG = its trim)
      b7Chest: () => merge(...[-1, 1].map(sd => X(FB, sd * 0.2, 0.7, 0.3, 0, 0, sd * 0.72, 0.5, 0.1, 0.06, MAG)), BX(1.08, 0.18, 0.04, 0.6, MAG, 0.08), BX(0.24, 0.2, 0.02, 0.64, WHITE, 0.08, 0, 0),
        BX(0.76, 0.98, 0.88, 0.54, MAG, 0.1), ...[0, 1].flatMap(r => [-1, 0, 1].map(k => BX(0.28, 0.38 - r * 0.12, 0.26 - r * 0.12, 0.06, r ? MAG : WHITE, 0.1, k * 0.3, 0.29 + r * 0.01))),
        ...[-1, 1].flatMap(sd => [0.32, 0.56].map(y => X(FB, sd * 0.52, y, 0, 0, 0, 0, 0.05, 0.06, 0.5, MAG)))),
      b7ChestG: () => merge(X(FB, 0, 0.56, 0.33, 0, 0, PI / 4, 0.13, 0.13, 0.03, WHITE), ...[-1, 1].map(sd => X(FB, sd * 0.2, 0.66, 0.335, 0, 0, sd * 0.72, 0.36, 0.022, 0.012, WHITE)), X(FB, 0, 0.11, 0.33, 0, 0, 0, 0.1, 0.06, 0.02, WHITE)),
      b7Paul: () => merge(BX(0.4, 0.26, -0.02, 0.56, WHITE, 0.08, -0.1), BX(0.42, 0.0, -0.06, 0.6, MAG, 0.06, -0.11), BX(0.36, -0.06, -0.2, 0.5, WHITE, 0.08, -0.12), BX(0.38, -0.2, -0.24, 0.54, MAG, 0.06, -0.13),
        ...[-0.16, 0, 0.16].map((z, k) => X(FB, -0.24, 0.42 - Math.abs(k - 1) * 0.05, z, 0, 0, 0.35, 0.05, 0.34 - Math.abs(k - 1) * 0.08, 0.13, k === 1 ? WHITE : MAG))),
      b7PaulG: () => merge(X(FB, -0.31, 0.12, 0.0, 0, 0, 0, 0.02, 0.09, 0.09, WHITE), X(FB, -0.29, -0.13, 0.0, 0, 0, 0, 0.02, 0.05, 0.16, WHITE)),
      b7Arm: () => merge(BX(0.3, -0.2, -0.25, 0.3, MAG, 0.1), BX(0.3, -0.31, -0.35, 0.3, MAG, 0.1)),
      b7Bracer: () => merge(BX(0.32, -0.04, -0.3, 0.32, WHITE, 0.08), BX(0.34, -0.02, -0.07, 0.34, MAG, 0.06), X(FB, 0, -0.18, 0.17, 0, 0, 0, 0.22, 0.04, 0.02, MAG)),
      b7Thigh: () => merge(BX(0.3, -0.06, -0.36, 0.08, WHITE, 0.08, 0, 0.17), BX(0.32, -0.04, -0.09, 0.09, MAG, 0.06, 0, 0.175), BX(0.08, -0.06, -0.34, 0.26, WHITE, 0.08, -0.17, 0)),
      b7ThighG: () => X(FB, 0, -0.22, 0.22, 0, 0, 0, 0.08, 0.08, 0.02, WHITE),
      b7Knee: () => merge(BX(0.24, 0.04, -0.1, 0.1, WHITE, 0.08, 0, 0.17), X(FB, 0, -0.03, 0.225, 0, 0, PI / 4, 0.07, 0.07, 0.02, MAG)),
      // ---- Update 7 · armour accessories (fixed colours: leather, fur, iron, bone, steel; MAG = the set's trim)
      acBelt: () => merge(BX(1.08, 0.04, -0.1, 0.6, [0.22, 0.14, 0.09], 0.06), X(FB, 0, -0.03, 0.31, 0, 0, 0, 0.16, 0.12, 0.03, MAG), BX(0.16, -0.06, -0.24, 0.14, [0.27, 0.18, 0.11], 0.1, 0.4, 0.22), BX(0.14, -0.06, -0.22, 0.12, [0.27, 0.18, 0.11], 0.1, -0.42, 0.18), X(FB, 0.4, -0.08, 0.3, 0, 0, 0, 0.12, 0.03, 0.02, MAG)),
      acChain: () => merge(...[0, 1, 2].map(k => BX(1.04 - k * 0.02, -0.36 - k * 0.05, -0.41 - k * 0.05, 0.56 - k * 0.01, k % 2 ? [0.32, 0.33, 0.37] : [0.42, 0.43, 0.47], 0.05))),
      acStrap: () => merge(X(FB, 0.03, 0.5, 0.31, 0, 0, -0.86, 1.16, 0.1, 0.04, [0.22, 0.14, 0.09]), ...[-0.3, -0.1, 0.1, 0.3].map(t => X(sphere(0.026, MAG, 6, 4), 0.03 + t * 0.65, 0.5 - t * 0.76, 0.34)), X(FB, 0.03, 0.5, -0.31, 0, 0, 0.86, 1.16, 0.1, 0.04, [0.22, 0.14, 0.09])),
      acFur: () => merge(...[-0.48, -0.32, -0.16, 0, 0.16, 0.32, 0.48].map((x, k) => X(sphere(1, [0.25, 0.21, 0.17], 8, 5), x, 0.96 + (k % 2) * 0.03, -0.02, k, 0, 0, 0.17, 0.11, 0.24))),
      acHorn: () => merge(X(spikeGeo(0.38, 0.06), -0.24, 0.34, -0.02, 0, -0.35, 0.45, 1, 1, 1, [0.82, 0.78, 0.68]), X(spikeGeo(0.22, 0.045), -0.2, 0.3, 0.14, 0, 0.2, 0.6, 1, 1, 1, [0.82, 0.78, 0.68])),
      acTrophy: () => merge(...[-1, 1].flatMap(sd => [X(FB, 0, 0.5, -0.34, 0, 0, sd * 0.75, 1.05, 0.09, 0.03, [0.62, 0.64, 0.68]), X(FB, sd * 0.4, 0.5 + 0.34, -0.34, 0, 0, sd * 0.75, 0.2, 0.06, 0.05, [0.22, 0.14, 0.09])])),
      b7Mantle: () => merge(BX(1.1, 0.96, 0.78, 0.6, MAG, 0.12), ...[-1, 1].flatMap(sd => [0, 1, 2].map(k => X(FB, sd * (0.36 + k * 0.08), 1.04 + k * 0.02, -0.05 + k * 0.03, 0, 0, -sd * (0.3 + k * 0.15), 0.05, 0.26 - k * 0.05, 0.3, k === 1 ? WHITE : MAG)))),
      kPauldron: () => { const g = []; for (let i = 0; i < 3; i++) { const y = 0.15 - i * 0.11, w = 0.62 - i * 0.05;
          g.push(X(RB(0.45), -0.06 - i * 0.03, y, 0, 0, 0, 0.32, w, 0.13, w)); g.push(X(RB(0.45), -0.07 - i * 0.03, y - 0.05, 0, 0, 0, 0.32, w + 0.03, 0.04, w + 0.03, GOLD)); }
        g.push(X(spikeGeo(0.3, 0.075), -0.24, 0.2, 0.12, 0, 0, 0.8)); g.push(X(spikeGeo(0.26, 0.07), -0.24, 0.18, -0.14, 0, 0, 0.9)); return merge(...g); },
      kPGem: () => X(sphere(0.055, WHITE, 10, 7), -0.3, 0.12, 0.2),
      kGauntlet: () => merge(BX(0.5, -0.06, -0.36, 0.5, WHITE, 0.3), BX(0.53, -0.03, -0.1, 0.53, GOLD, 0.35), BX(0.2, -0.12, -0.3, 0.06, GOLD, 0.4, 0, 0.26)),
      kGreave: () => merge(BX(0.5, 0.02, -0.28, 0.52, WHITE, 0.3, 0, 0.01), X(RB(0.5), 0, 0.02, 0.24, 0, 0, 0, 0.3, 0.2, 0.12, GOLD)),
      kTassets: () => merge(BX(0.46, -0.06, -0.36, 0.07, WHITE, 0.35, 0, 0.26), BX(0.46, -0.32, -0.37, 0.08, GOLD, 0.4, 0, 0.265), BX(0.08, -0.06, -0.33, 0.4, WHITE, 0.35, -0.5), BX(0.08, -0.06, -0.33, 0.4, WHITE, 0.35, 0.5)),
      kHelm: () => { const g = [X(RB(0.32), 0, 0.03, 0, 0, 0, 0, 0.71, 0.67, 0.7), BX(0.5, 0.04, -0.04, 0.05, DARK, 0.3, 0, 0.35), BX(0.1, 0.0, -0.24, 0.05, DARK, 0.3, 0, 0.35), BX(0.09, 0.42, 0.33, 0.66, GOLD, 0.45), BX(0.74, 0.2, 0.15, 0.73, GOLD, 0.35)];
        for (let i = 0; i < 6; i++) g.push(X(sphere(0.09 - i * 0.004, MAG, 10, 7), 0, 0.44 + Math.sin(i / 5 * PI) * 0.08, 0.22 - i * 0.12));
        return merge(...g); },
      kVisor: () => merge(BX(0.13, 0.025, -0.02, 0.02, WHITE, 0.3, -0.12, 0.372), BX(0.13, 0.025, -0.02, 0.02, WHITE, 0.3, 0.12, 0.372)),
      // ---- mage: robe, flared skirt, hood, little shoulder mantle
      mRobe: () => merge(BX(1.02, 0.92, 0.03, 0.52, WHITE, 0.25), X(RB(0.4), -0.12, 0.62, 0.26, 0, 0, -0.5, 0.06, 0.6, 0.03, MAG), X(RB(0.4), 0.12, 0.62, 0.26, 0, 0, 0.5, 0.06, 0.6, 0.03, MAG), BX(1.04, 0.14, 0.04, 0.54, MAG, 0.3), X(sphere(0.06, GOLD, 10, 7), 0, 0.09, 0.28)),
      mSkirt: () => merge(lathe([[0.52, 0.05], [0.54, -0.2], [0.6, -0.55], [0.66, -0.86]], 20, { zs: 0.62 }), lathe([[0.665, -0.8], [0.68, -0.8], [0.68, -0.9], [0.665, -0.9]], 20, { zs: 0.62, col: MAG })),
      mHood: () => merge(hairCap(0.24, -0.3, 1.22, 0.22, true), outHead(spikeGeo(0.3, 0.15), PI, 0.22, 1.1, 1.6, -0.6)),
      mMantle: () => merge(BX(1.12, 0.96, 0.8, 0.6, MAG, 0.45), BX(0.4, 0.98, 0.9, 0.62, GOLD, 0.45)),
      // ---- mage gloves + boots (cloth with a coloured band)
      mWrap: () => merge(BX(0.46, -0.02, -0.4, 0.46, WHITE, 0.3), BX(0.48, -0.08, -0.15, 0.48, MAG, 0.35), BX(0.47, -0.3, -0.36, 0.47, MAG, 0.35)),
      mBoot: () => merge(BX(0.5, -0.12, -0.5, 0.54, WHITE, 0.3, 0, 0.02), BX(0.54, -0.04, -0.15, 0.56, MAG, 0.35, 0, 0.01), BX(0.5, -0.43, -0.53, 0.6, WHITE, 0.3, 0, 0.05)),
      // ---- ninja: scarf with trailing tails, headband with a metal plate, sash
      nScarf: () => merge(X(RB(0.5), 0, 0.93, 0, 0, 0, 0, 0.74, 0.2, 0.56), BX(0.18, 0.96, 0.8, 0.1, WHITE, 0.4, 0.12, -0.27)),
      nScarfTail: () => merge(X(RB(0.4), -0.09, -0.33, -0.02, 0, 0, 0.08, 0.15, 0.7, 0.04), X(RB(0.4), 0.09, -0.3, -0.02, 0, 0, -0.1, 0.14, 0.64, 0.04)),
      nBand: () => merge(X(RB(0.5), 0, 0.13, 0, 0, 0, 0, 0.665, 0.09, 0.645, MAG), BX(0.24, 0.18, 0.08, 0.03, STEEL, 0.3, 0, 0.33)),
      nBandTail: () => merge(X(RB(0.4), -0.05, -0.17, 0, 0, 0, 0.12, 0.08, 0.36, 0.02, MAG), X(RB(0.4), 0.05, -0.15, 0, 0, 0, -0.15, 0.08, 0.32, 0.02, MAG)),
      nSash: () => merge(BX(0.98, 0.1, -0.03, 0.5, MAG, 0.3), X(RB(0.4), 0.3, -0.12, 0.25, 0, 0, 0.3, 0.12, 0.2, 0.05, MAG))
    };
    // which pieces each outfit uses. b = bone, glow = drawn glowing, mirror = flipped for the left side, spring = bouncy, hideHair
    const OUTFITS = CH.OUTFITS = {
      tee: { n: 'Starter Tee', parts: [] },
      coat: { n: 'Adventurer Coat', sleeve: 'long', parts: [{ b: 'torso', k: 'coatTorso' }, { b: 'pelvis', k: 'coatTails', spring: 'coat' }, { b: 'ua', k: 'coatSleeve' }, { b: 'fa', k: 'coatCuff' }] },
      knight: { n: 'Golden Knight', sleeve: 'long', hideHair: true, metal: 1, parts: [{ b: 'torso', k: 'kChest' }, { b: 'torso', k: 'kGem', glow: 1 }, { b: 'ua', k: 'kPauldron', mirror: 1 }, { b: 'ua', k: 'kPGem', glow: 1, mirror: 1 },
        { b: 'fa', k: 'kGauntlet' }, { b: 'sh', k: 'kGreave' }, { b: 'pelvis', k: 'kTassets' }, { b: 'head', k: 'kHelm' }, { b: 'head', k: 'kVisor', glow: 1 }] },
      mage: { n: 'Arcane Mage', sleeve: 'long', hideHair: true, parts: [{ b: 'torso', k: 'mRobe' }, { b: 'pelvis', k: 'mSkirt' }, { b: 'head', k: 'mHood' }, { b: 'torso', k: 'mMantle' }] },
      // dungeon gear: the same armour without the head piece (helmets and hoods are their own item, see lk.helm)
      plate: { n: 'Plate Armour', sleeve: 'long', metal: 1, parts: [{ b: 'torso', k: 'kChest' }, { b: 'torso', k: 'kGem', glow: 1 }, { b: 'ua', k: 'kPauldron', mirror: 1 }, { b: 'ua', k: 'kPGem', glow: 1, mirror: 1 },
        { b: 'pelvis', k: 'kTassets' }] },
      robe: { n: 'Spell Robes', sleeve: 'long', parts: [{ b: 'torso', k: 'mRobe' }, { b: 'pelvis', k: 'mSkirt' }, { b: 'torso', k: 'mMantle' }] },
      ninja: { n: 'Shadow Ninja', sleeve: 'long', parts: [{ b: 'torso', k: 'nScarf' }, { b: 'torso', k: 'nScarfTail', spring: 'scarf', pivot: [0, 0.88, -0.27] }, { b: 'head', k: 'nBand' }, { b: 'head', k: 'nBandTail', spring: 'band', pivot: [0, 0.12, -0.32] }, { b: 'pelvis', k: 'nSash' }] }
    };
    // ---- weapons: body (tint = blade colour, magenta = gem) + a glowing part
    const WEAPONS = CH.WEAPONS = {
      sword: { n: 'Steel Sword', body: () => merge(X(lathe([[0, 0], [0.1, 0.04], [0.105, 0.82], [0.08, 0.95], [0, 1.1]], 4, { zs: 0.26 }), 0, 0, 0.13, 0, PI / 2, 0),
          BX(0.44, 0.05, -0.05, 0.1, GOLD, 0.45, 0, 0.11), X(sphere(0.06, GOLD, 10, 7), 0.22, 0, 0.11), X(sphere(0.06, GOLD, 10, 7), -0.22, 0, 0.11), X(capsule(0.05, 0.05, 0.27, [0.36, 0.21, 0.12], 10), 0, 0, 0.07, 0, -PI / 2, 0), X(sphere(0.075, MAG, 12, 8), 0, 0, -0.23)),
        glow: () => X(sphere(0.045, WHITE, 10, 7), 0, 0.048, 0.11, 0, 0, 0, 1, 1, 0.6), tip: [0.25, 1.2] },
      greatsword: { n: 'Radiant Greatsword', body: () => merge(X(lathe([[0, 0], [0.15, 0.05], [0.16, 1.15], [0.12, 1.3], [0, 1.5]], 4, { zs: 0.22 }), 0, 0, 0.16, 0, PI / 2, 0),
          BX(0.62, 0.07, -0.07, 0.14, GOLD, 0.45, 0, 0.13), X(spikeGeo(0.2, 0.07), 0.3, 0, 0.13, 0, 0, -1.3), X(spikeGeo(0.2, 0.07), -0.3, 0, 0.13, 0, 0, 1.3), X(capsule(0.055, 0.055, 0.34, [0.25, 0.14, 0.1], 10), 0, 0, 0.08, 0, -PI / 2, 0), X(sphere(0.08, GOLD, 12, 8), 0, 0, -0.3)),
        glow: () => merge(X(lathe([[0, 0], [0.035, 0.04], [0.035, 1.05], [0, 1.2]], 4, { zs: 1.2 }), 0, 0, 0.22, 0, PI / 2, 0), X(sphere(0.07, WHITE, 12, 8), 0, 0, 0.13, 0, 0, 0, 1, 1, 1.6)), tip: [0.3, 1.62] },
      staff: { n: 'Star Staff', body: () => merge(X(capsule(0.05, 0.045, 1.7, WOOD, 10), 0, 0, -0.55, 0, -PI / 2, 0), BX(0.12, 0.05, -0.05, 0.12, GOLD, 0.4, 0, 1.08), X(spikeGeo(0.22, 0.05), 0.09, 0, 1.15, 0, 0.5, -0.5), X(spikeGeo(0.22, 0.05), -0.09, 0, 1.15, 0, 0.5, 0.5), X(spikeGeo(0.22, 0.05), 0, 0.09, 1.15, 0, 0.9, 0)),
        glow: () => X(G.ico(0.13, 0.12, 4), 0, 0, 1.33), tip: [1.1, 1.45], orb: [0, 0, 1.33] },
      dagger: { n: 'Twin Fang', body: () => merge(X(lathe([[0, 0], [0.07, 0.03], [0.07, 0.38], [0, 0.55]], 4, { zs: 0.3 }), 0, 0, 0.09, 0, PI / 2, 0), BX(0.24, 0.04, -0.04, 0.07, STEEL, 0.4, 0, 0.08), X(capsule(0.04, 0.04, 0.17, DARK, 10), 0, 0, 0.05, 0, -PI / 2, 0)),
        glow: () => X(lathe([[0, 0], [0.02, 0.03], [0.02, 0.3], [0, 0.4]], 4, { zs: 1 }), 0, 0, 0.12, 0, PI / 2, 0), tip: [0.15, 0.6] },
      hammer: { n: 'Slime Smasher', body: () => merge(X(capsule(0.05, 0.05, 1.0, WOOD, 10), 0, 0, -0.2, 0, -PI / 2, 0), X(RB(0.35), 0, 0, 0.82, 0, 0, 0, 0.6, 0.36, 0.36), BX(0.64, 0.2, -0.2, 0.06, GOLD, 0.4, 0, 0.82), X(RB(0.35), 0.33, 0, 0.82, 0, 0, 0, 0.06, 0.3, 0.3, MAG), X(RB(0.35), -0.33, 0, 0.82, 0, 0, 0, 0.06, 0.3, 0.3, MAG)),
        glow: () => X(sphere(0.07, WHITE, 10, 7), 0, 0.19, 0.82), tip: [0.6, 1.0] }
    };
    // ================================================================ DUNGEON GEAR (Update 5): every dungeon's weapons and armour have their own models
    // tier = the dungeon the item comes from: 0 Mossbark, 1 Sunscorched, 2 Gravebound, 3 Rimeforged, 4 Emberforged, 5 Stormcaller, 6 Voidtouched, 7 Abyssal, 8 Glitched
    // colours: WHITE = the tier's metal colour (tint 1), MAG = its trim / gem colour (tint 2); the fixed colours below stay as they are
    const BONE = [0.86, 0.82, 0.72], LEAF = [0.18, 0.36, 0.13], BARK = [0.3, 0.2, 0.12], ICE = [0.72, 0.88, 1], OBS = [0.07, 0.06, 0.09], DARKR = [0.16, 0.04, 0.08];
    const GRIP = [BARK, [0.32, 0.2, 0.1], [0.2, 0.18, 0.2], [0.45, 0.55, 0.68], OBS, [0.14, 0.14, 0.28], OBS, DARKR, OBS, [0.1, 0.2, 0.22], [0.25, 0.16, 0.08], [0.16, 0.17, 0.24]];
    const TN = CH.TIER_N = ['Mossbark', 'Sunscorched', 'Gravebound', 'Rimeforged', 'Emberforged', 'Stormcaller', 'Voidtouched', 'Abyssal', 'Glitched', 'Tidebound', 'Clockwork', 'Lunar'];
    const tRnd = s0 => { let v = (s0 * 7919 + 13) % 2147483647; return () => (v = (v * 16807) % 2147483647) / 2147483647; };
    // a flat bar in the blade plane (x-z) from (x0,z0) to (x1,z1), w wide, t thick
    const FB = G.box(1, 1, 1, 0), FBx = (w, y0, y1, d, col, r, cx, cz) => X(FB, cx || 0, (y0 + y1) / 2, cz || 0, 0, 0, 0, w, y0 - y1, d, col);   // flat boxes: few vertices (school laptops)
    const bar = (x0, z0, x1, z1, w, t, col) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 0.001; return X(FB, (x0 + x1) / 2, 0, (z0 + z1) / 2, Math.atan2(dx, dz), 0, 0, w, t, l, col); };
    // a spike lying in the blade plane, pointing at angle a (0 = along +z, PI/2 = +x)
    const spk = (x, z, a, L, w, col) => X(spikeGeo(L, w), x, 0, z, a, PI / 2, 0, 1, 1, 1, col);
    const gem3 = (r, h, col) => lathe([[0, -h], [r, 0], [0, h]], 5, { col });
    const cubeG = (sz, x, y, z, a, col) => X(FB, x, y, z, a, a * 0.6, a * 0.3, sz, sz, sz, col);
    const ring = (R, r, x, y, z, yaw, pit, rol, col) => X(G.torus(R, r, 16, 5), x, y, z, yaw || 0, pit || 0, rol || 0, 1, 1, 1, col);
    // ---- blades (sword, greatsword, dagger): length L, width W, starting just past the guard
    function tierBlade(t, L, W) {
      const z0 = 0.12, T = W * 0.42, b = [], g = [], r = tRnd(t + 3);
      switch (t) {
        case 0: { let x = 0; for (let k = 0; k < 6; k++) { const za = z0 + k * L / 6, zb = z0 + (k + 1) * L / 6, nx = (k % 2 ? 1 : -1) * W * 0.14; b.push(bar(x, za, nx, zb, W * (1.1 - k * 0.12), T, WHITE)); x = nx; }
          for (let k = 0; k < 5; k++) { const sd = k % 2 ? 1 : -1; b.push(spk(sd * W * 0.42, z0 + (k + 0.6) * L / 6, sd * 0.95, W * 0.95, W * 0.16, BARK)); }
          b.push(spk(x, z0 + L - 0.02, 0, W * 1.3, W * 0.36, WHITE)); for (const zf of [0.25, 0.55, 0.8]) g.push(X(sphere(W * 0.13, WHITE, 8, 6), 0, T * 0.55, z0 + L * zf)); break; }
        case 1: { b.push(bar(0, z0, 0, z0 + L * 0.42, W, T, WHITE)); const R = L * 0.34, zs = z0 + L * 0.42; let px = 0, pz = zs;
          for (let k = 1; k <= 7; k++) { const a = k / 7 * 2.3, nx = R - R * Math.cos(a), nz = zs + R * Math.sin(a); b.push(bar(px, pz, nx, nz, W * (1.05 - k * 0.07), T, WHITE)); g.push(bar(px - W * 0.32, pz, nx - W * 0.32, nz, W * 0.12, T * 1.3, WHITE)); px = nx; pz = nz; }
          b.push(spk(px, pz, 2.4, W * 1.1, W * 0.3, WHITE)); b.push(bar(-W * 0.45, z0, -W * 0.45, z0 + L * 0.4, W * 0.1, T * 1.5, MAG)); break; }
        case 2: { for (let k = 0; k < 7; k++) { const z = z0 + (k + 0.5) * L / 7.4; b.push(X(sphere(W * (0.3 - k * 0.022), BONE, 9, 6), W * 0.12, 0, z, 0, 0, 0, 1, 0.8, 1.15)); if (k % 2 === 0) g.push(X(sphere(W * 0.07, WHITE, 6, 4), W * 0.12, T * 0.7, z)); }
          b.push(bar(-W * 0.25, z0, -W * 0.18, z0 + L * 0.9, W * 0.75, T * 0.7, WHITE)); for (let k = 0; k < 6; k++) b.push(spk(W * 0.38, z0 + (k + 0.5) * L / 6.5, 1.25, W * 0.55, W * 0.12, BONE));
          b.push(spk(0, z0 + L * 0.92, 0, W * 1.0, W * 0.3, BONE)); break; }
        case 3: { for (let k = 0; k < 4; k++) { const z = z0 + L * (0.12 + k * 0.22), x = (r() - 0.5) * W * 0.2; b.push(X(gem3(W * (0.62 - k * 0.07), L * 0.16, WHITE), x, 0, z, r() * 3, PI / 2, 0, 1, 0.55, 1)); }
          b.push(X(gem3(W * 0.4, L * 0.16, WHITE), 0, 0, z0 + L * 0.93, 0, PI / 2, 0, 1, 0.55, 1)); for (let k = 0; k < 4; k++) { const sd = k % 2 ? 1 : -1; b.push(X(gem3(W * 0.16, W * 0.5, ICE), sd * W * 0.5, 0, z0 + L * (0.2 + k * 0.18), 0, PI / 2, sd * 0.9)); }
          g.push(bar(0, z0, 0, z0 + L * 0.88, W * 0.12, T * 1.4, WHITE)); break; }
        case 4: { b.push(bar(0, z0, 0, z0 + L * 0.84, W * 1.6, T * 1.2, OBS)); b.push(bar(0, z0 + L * 0.8, -W * 0.45, z0 + L, W * 1.15, T * 1.2, OBS));
          for (let k = 0; k < 5; k++) b.push(spk(W * 0.78, z0 + (k + 0.6) * L / 6, 1.35, W * 0.4, W * 0.15, OBS)); let x = 0;
          for (let k = 0; k < 6; k++) { const nx = (k % 2 ? 1 : -1) * W * 0.22; g.push(bar(x, z0 + k * L * 0.14, nx, z0 + (k + 1) * L * 0.14, W * 0.08, T * 1.5, WHITE)); x = nx; } g.push(bar(-W * 0.82, z0 + 0.04, -W * 0.82, z0 + L * 0.8, W * 0.06, T * 1.4, WHITE)); break; }
        case 5: { const pts = [[0, z0], [W * 0.5, z0 + L * 0.24], [-W * 0.42, z0 + L * 0.5], [W * 0.46, z0 + L * 0.72], [0, z0 + L * 0.88]];
          for (let k = 0; k < pts.length - 1; k++) { b.push(bar(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], W * 0.85, T, WHITE)); g.push(bar(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], W * 0.22, T * 1.4, WHITE)); }
          b.push(spk(0, z0 + L * 0.86, 0.45, W * 0.9, W * 0.22, WHITE), spk(0, z0 + L * 0.86, -0.45, W * 0.75, W * 0.2, WHITE)); break; }
        case 6: { for (let k = 0; k < 4; k++) { const z = z0 + 0.08 + k * L / 4.3, s1 = 1 - k * 0.13; b.push(X(gem3(W * 0.55 * s1, L * 0.1, WHITE), 0, 0, z, k * 0.7, PI / 2, 0, 1, 0.5, 1)); if (k < 3) g.push(X(sphere(W * 0.1, WHITE, 6, 4), 0, 0, z + L * 0.12)); }
          b.push(X(gem3(W * 0.3, L * 0.16, WHITE), 0, 0, z0 + L * 0.95, 0, PI / 2, 0, 1, 0.5, 1)); g.push(ring(W * 1.05, W * 0.05, 0, 0, z0 + L * 0.45, 0, PI / 2, 0, WHITE)); break; }
        case 7: { let x = 0; for (let k = 0; k < 10; k++) { const nx = Math.sin((k + 1) * 1.25) * W * 0.26; b.push(bar(x, z0 + k * L / 10.5, nx, z0 + (k + 1) * L / 10.5, W * (1.05 - k * 0.06), T, WHITE)); x = nx;
            if (k % 2 === 0) for (const sd of [-1, 1]) b.push(spk(x + sd * W * 0.45, z0 + (k + 0.5) * L / 10.5, sd * 2.2, W * 0.38, W * 0.1, BONE)); }
          b.push(spk(x, z0 + L * 0.95, 0, W * 0.9, W * 0.26, WHITE)); b.push(X(sphere(W * 0.32, MAG, 10, 7), 0, 0, z0 + 0.05, 0, 0, 0, 1, 0.7, 1)); g.push(X(sphere(W * 0.14, WHITE, 8, 5), 0, W * 0.2, z0 + 0.05)); break; }
        case 8: { for (let k = 0; k < 9; k++) { const sz = W * (1.0 - k * 0.07); b.push(cubeG(sz, (r() - 0.5) * W * 0.5, 0, z0 + sz / 2 + k * L / 9.3, 0, OBS)); if (k % 3 === 1) g.push(cubeG(sz * 0.55, (r() - 0.5) * W * 0.3, sz * 0.25, z0 + k * L / 9.3 + sz / 2, 0, WHITE)); }
          for (let k = 0; k < 3; k++) b.push(cubeG(W * 0.3, (k % 2 ? 1 : -1) * W * (0.9 + r() * 0.4), 0, z0 + L * (0.3 + k * 0.25), r(), OBS)); break; }
      }
      return { b, g };
    }
    // ---- hilts: guard + grip + pommel in the dungeon's style (s = size)
    function tierHilt(t, s, gl) {
      const b = [], g = [], gz = 0.11 * s, grip = GRIP[t] || BARK;
      b.push(X(capsule(0.05 * s, 0.05 * s, (gl || 0.27) * s, grip, 10), 0, 0, 0.07 * s, 0, -PI / 2, 0)); const pz = -(gl || 0.27) * s + 0.04;
      switch (t) {
        case 0: for (const sd of [-1, 1]) { b.push(bar(sd * 0.04 * s, gz, sd * 0.24 * s, gz + 0.06 * s, 0.07 * s, 0.07 * s, BARK)); b.push(X(sphere(0.08 * s, LEAF, 8, 5), sd * 0.24 * s, 0, gz + 0.1 * s, 0, 0, sd * 0.5, 1, 0.35, 1.6)); }
          b.push(X(sphere(0.07 * s, BARK, 9, 6), 0, 0, pz), X(sphere(0.05 * s, LEAF, 8, 5), 0, 0, pz - 0.05 * s, 0, 0, 0, 1.2, 0.6, 1.2)); break;
        case 1: for (let k = -2; k <= 2; k++) { const a = k * 0.32; b.push(bar(Math.sin(a) * 0.17 * s, gz - Math.cos(a) * 0.04 * s + 0.04 * s, Math.sin(a + 0.32) * 0.17 * s, gz - Math.cos(a + 0.32) * 0.04 * s + 0.04 * s, 0.06 * s, 0.07 * s, GOLD)); }
          b.push(ring(0.06 * s, 0.018 * s, 0, 0, pz - 0.04 * s, 0, 0, PI / 2, GOLD), bar(-0.07 * s, pz + 0.02, 0.07 * s, pz + 0.02, 0.03 * s, 0.03 * s, GOLD)); break;
        case 2: for (const sd of [-1, 1]) b.push(spk(sd * 0.05 * s, gz, sd * 2.3, 0.24 * s, 0.045 * s, BONE)); b.push(FBx(0.2 * s, 0.04 * s, -0.04 * s, 0.08 * s, BONE, 0.4, 0, gz));
          b.push(X(sphere(0.085 * s, BONE, 10, 7), 0, 0, pz)); g.push(X(sphere(0.022 * s, WHITE, 6, 4), -0.03 * s, 0.07 * s, pz + 0.01), X(sphere(0.022 * s, WHITE, 6, 4), 0.03 * s, 0.07 * s, pz + 0.01)); break;
        case 3: for (const a of [1.35, -1.35, 1.9, -1.9]) b.push(X(gem3(0.035 * s, 0.13 * s, ICE), Math.sin(a) * 0.1 * s, 0, gz + Math.cos(a) * 0.1 * s, a, PI / 2, 0)); b.push(X(gem3(0.06 * s, 0.1 * s, ICE), 0, 0, pz - 0.03 * s, 0, PI / 2, 0)); break;
        case 4: b.push(FBx(0.4 * s, 0.07 * s, -0.07 * s, 0.13 * s, OBS, 0.2, 0, gz)); for (const sd of [-1, 1]) b.push(spk(sd * 0.2 * s, gz + 0.03, sd * 0.55, 0.2 * s, 0.06 * s, OBS));
          b.push(ring(0.065 * s, 0.022 * s, 0, 0, pz - 0.03 * s, 0, 0, PI / 2, OBS)); g.push(FBx(0.3 * s, 0.02 * s, -0.02 * s, 0.135 * s, WHITE, 0.2, 0, gz)); break;
        case 5: for (const sd of [-1, 1]) { b.push(bar(sd * 0.04 * s, gz, sd * 0.26 * s, gz - 0.1 * s, 0.09 * s, 0.03 * s, WHITE)); b.push(bar(sd * 0.04 * s, gz + 0.02, sd * 0.2 * s, gz - 0.14 * s, 0.06 * s, 0.03 * s, WHITE)); }
          for (let k = 0; k < 3; k++) b.push(ring(0.058 * s, 0.012 * s, 0, 0, 0.02 * s - k * 0.08 * s, 0, PI / 2, 0, MAG)); b.push(X(sphere(0.065 * s, MAG, 10, 7), 0, 0, pz)); g.push(X(sphere(0.035 * s, WHITE, 8, 5), 0, 0, pz)); break;
        case 6: b.push(FBx(0.12 * s, 0.04 * s, -0.04 * s, 0.08 * s, OBS, 0.3, 0, gz)); g.push(ring(0.16 * s, 0.014 * s, 0, 0, gz + 0.02, 0, PI / 2, 0, WHITE)); b.push(X(gem3(0.05 * s, 0.09 * s, WHITE), 0, 0, pz - 0.09 * s, 0, PI / 2, 0)); break;
        case 7: for (const sd of [-1, 1]) for (const a of [2.5, 2.85]) b.push(spk(sd * 0.04 * s, gz, sd * a, 0.2 * s, 0.035 * s, DARKR)); b.push(X(sphere(0.075 * s, MAG, 10, 7), 0, 0, pz)); g.push(X(sphere(0.03 * s, WHITE, 6, 4), 0, 0.06 * s, pz)); break;
        case 8: for (let k = -2; k <= 2; k++) b.push(cubeG(0.07 * s, k * 0.07 * s, 0, gz, 0, k % 2 ? OBS : MAG)); b.push(cubeG(0.09 * s, 0, 0, pz, 0.6, OBS)); g.push(cubeG(0.04 * s, 0, 0.05 * s, pz, 0.6, WHITE)); break;
      }
      return { b, g };
    }
    // ---- hammer heads and staff tops
    function tierHammer(t) {
      const b = [X(capsule(0.05, 0.05, 1.0, GRIP[t] || WOOD, 10), 0, 0, -0.2, 0, -PI / 2, 0)], g = [], hz = 0.82, r = tRnd(t + 11);
      switch (t) {
        case 0: b.push(X(G.cyl(0.21, 0.23, 0.66, 10), 0, 0, hz, 0, 0, PI / 2, 1, 1, 1, WHITE)); for (let k = 0; k < 5; k++) b.push(X(sphere(0.07 + r() * 0.04, LEAF, 8, 5), (r() - 0.5) * 0.5, 0.2, hz + (r() - 0.5) * 0.2, 0, 0, 0, 1, 0.5, 1));
          b.push(X(sphere(0.07, [0.6, 0.15, 0.1], 8, 5), 0.18, 0.24, hz + 0.05, 0, 0, 0, 1, 0.5, 1)); g.push(X(sphere(0.04, WHITE, 6, 4), -0.33, 0, hz), X(sphere(0.04, WHITE, 6, 4), 0.33, 0, hz)); break;
        case 1: for (const sd of [-1, 1]) b.push(X(G.cyl(0, 0.2, 0.38, 4), sd * 0.24, 0, hz, 0.785, 0, -sd * PI / 2, 1, 1, 1, WHITE)); b.push(FBx(0.18, 0.2, -0.2, 0.3, MAG, 0.3, 0, hz)); g.push(X(sphere(0.07, WHITE, 8, 5), 0, 0.2, hz)); break;
        case 2: b.push(X(sphere(0.27, BONE, 12, 8), 0, 0, hz, 0, 0, 0, 1.2, 1, 1), FBx(0.3, -0.08, -0.26, 0.14, BONE, 0.3, 0, hz + 0.18)); for (const sd of [-1, 1]) b.push(spk(sd * 0.25, hz - 0.1, sd * 2.0, 0.3, 0.06, BONE));
          g.push(X(sphere(0.06, WHITE, 6, 4), -0.1, 0.18, hz + 0.12), X(sphere(0.06, WHITE, 6, 4), 0.1, 0.18, hz + 0.12)); break;
        case 3: b.push(X(FB, 0, 0, hz, 0, 0, 0, 0.6, 0.38, 0.38, WHITE)); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; b.push(X(gem3(0.06, 0.18, ICE), Math.cos(a) * 0.3, Math.sin(a) * 0.2, hz, 0, 0, a - PI / 2)); } g.push(FBx(0.5, 0.05, -0.05, 0.05, WHITE, 0.3, 0, hz + 0.2)); break;
        case 4: b.push(FBx(0.5, 0.15, -0.15, 0.34, OBS, 0.12, -0.05, hz), FBx(0.4, 0.22, 0.15, 0.4, OBS, 0.1, -0.05, hz)); b.push(X(spikeGeo(0.36, 0.13), 0.2, 0, hz, 0, 0, -PI / 2, 1, 1, 1, OBS)); g.push(FBx(0.44, 0.01, -0.01, 0.35, WHITE, 0.1, -0.05, hz)); break;
        case 5: b.push(X(G.cyl(0.13, 0.13, 0.64, 10), 0, 0, hz, 0, 0, PI / 2, 1, 1, 1, WHITE)); for (const x of [-0.22, 0, 0.22]) b.push(ring(0.17, 0.03, x, 0, hz, 0, 0, PI / 2, MAG)); b.push(X(spikeGeo(0.3, 0.04), 0, 0.12, hz, 0, 0, 0, 1, 1, 1, WHITE));
          g.push(X(sphere(0.08, WHITE, 8, 5), -0.36, 0, hz), X(sphere(0.08, WHITE, 8, 5), 0.36, 0, hz)); break;
        case 6: b.push(X(FB, 0, 0, hz + 0.12, 0.785, 0.6, 0.3, 0.42, 0.42, 0.42, WHITE)); g.push(X(sphere(0.1, WHITE, 8, 5), 0, 0, hz + 0.12), ring(0.36, 0.02, 0, 0, hz + 0.12, 0, 0.5, 0.3, WHITE)); break;
        case 7: for (let k = 0; k < 4; k++) b.push(X(sphere(0.17, WHITE, 10, 7), (k % 2 ? 0.12 : -0.12), (k < 2 ? 0.08 : -0.08), hz + (k % 3) * 0.05)); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; b.push(X(spikeGeo(0.32, 0.05), Math.cos(a) * 0.22, Math.sin(a) * 0.18, hz + 0.1, 0, 0.6, a, 1, 1, 1, DARKR)); }
          b.push(X(sphere(0.12, MAG, 10, 7), 0, 0.2, hz)); g.push(X(sphere(0.06, WHITE, 6, 4), 0, 0.3, hz)); break;
        case 8: for (let k = 0; k < 6; k++) b.push(cubeG(0.2 + r() * 0.08, (r() - 0.5) * 0.5, (r() - 0.5) * 0.18, hz + (r() - 0.5) * 0.2, r() * 2, k % 3 ? OBS : MAG)); g.push(cubeG(0.12, 0, 0, hz, 0.4, WHITE)); break;
      }
      return { body: () => merge(...b), glow: () => merge(...g), tip: [0.6, 1.0] };
    }
    function tierStaff(t) {
      const b = [X(capsule(0.05, 0.045, 1.7, GRIP[t] || WOOD, 10), 0, 0, -0.55, 0, -PI / 2, 0)], g = [], r = tRnd(t + 21); let orb = [0, 0, 1.33];
      switch (t) {
        case 0: for (const [x, y, z] of [[0.15, 0.05, 1.36], [-0.14, -0.03, 1.33], [0, 0.12, 1.44]]) { b.push(bar(0, 1.1, x, z, 0.06, 0.06, BARK)); b.push(X(sphere(0.07, LEAF, 8, 5), x, y, z + 0.04, 0, 0, 0, 1.4, 0.6, 1)); }
          g.push(X(sphere(0.09, WHITE, 10, 7), 0, 0, 1.3)); break;
        case 1: b.push(ring(0.2, 0.025, 0, 0, 1.33, 0, 0, 0, GOLD)); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.push(spk(Math.sin(a) * 0.22, 1.33 + Math.cos(a) * 0.22, a, 0.12, 0.035, GOLD)); } g.push(X(sphere(0.11, WHITE, 10, 7), 0, 0, 1.33)); break;
        case 2: b.push(X(sphere(0.14, BONE, 10, 7), 0, 0, 1.26, 0, 0, 0, 1, 1.1, 1)); for (const sd of [-1, 1]) b.push(X(spikeGeo(0.2, 0.04), sd * 0.1, 0, 1.32, 0, 0, -sd * 0.6, 1, 1, 1, BONE));
          g.push(X(sphere(0.03, WHITE, 6, 4), -0.05, 0.1, 1.28), X(sphere(0.03, WHITE, 6, 4), 0.05, 0.1, 1.28), X(sphere(0.07, WHITE, 8, 5), 0, 0, 1.46)); orb = [0, 0, 1.46]; break;
        case 3: for (const [a, h] of [[0, 0.24], [0.5, 0.17], [-0.5, 0.17]]) b.push(X(gem3(0.07, h, ICE), Math.sin(a) * 0.08, 0, 1.25 + h * 0.6, 0, PI / 2 - a * 0, a)); g.push(X(gem3(0.04, 0.12, WHITE), 0, 0, 1.3, 0, PI / 2, 0)); break;
        case 4: for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; b.push(bar(Math.sin(a) * 0.05, 1.12, Math.sin(a) * 0.15, 1.3, 0.04, 0.04, OBS), bar(Math.sin(a) * 0.15, 1.3, Math.sin(a) * 0.04, 1.46, 0.04, 0.04, OBS)); }
          g.push(X(sphere(0.1, WHITE, 10, 7), 0, 0, 1.3), X(G.cyl(0, 0.07, 0.2, 6), 0, 0, 1.43, 0, PI / 2, 0, 1, 1, 1, WHITE)); orb = [0, 0, 1.3]; break;
        case 5: b.push(X(spikeGeo(0.42, 0.045), 0, 0, 1.1, 0, PI / 2, 0, 1, 1, 1, WHITE)); for (const z of [1.18, 1.28, 1.38]) b.push(ring(0.11 - (z - 1.18) * 0.2, 0.015, 0, 0, z, 0, PI / 2, 0, MAG)); g.push(X(sphere(0.07, WHITE, 8, 5), 0, 0, 1.54)); orb = [0, 0, 1.54]; break;
        case 6: g.push(X(sphere(0.1, WHITE, 10, 7), 0, 0, 1.36)); b.push(ring(0.2, 0.018, 0, 0, 1.36, 0, 0.6, 0, MAG), ring(0.17, 0.018, 0, 0, 1.36, 1.2, 1.1, 0, MAG)); orb = [0, 0, 1.36]; break;
        case 7: b.push(X(sphere(0.15, MAG, 12, 8), 0, 0, 1.33)); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; b.push(X(spikeGeo(0.3, 0.035), Math.cos(a) * 0.06, Math.sin(a) * 0.06, 1.14, 0, PI / 2 - 0.4, a, 1, 1, 1, DARKR)); }
          g.push(X(sphere(0.07, WHITE, 8, 5), 0, 0.09, 1.38)); orb = [0, 0.09, 1.38]; break;
        case 8: for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; b.push(cubeG(0.07, Math.sin(a) * 0.17, Math.cos(a) * 0.05, 1.33 + Math.cos(a) * 0.12, a, k % 2 ? OBS : MAG)); } g.push(cubeG(0.1, 0, 0, 1.33, 0.785, WHITE)); break;
      }
      return { body: () => merge(...b), glow: () => merge(...g), tip: [1.1, 1.45], orb };
    }
    // the Paladin's shield (on the outside of the left forearm): face, trim, boss and a glowing sigil
    const shieldGeo = () => merge(X(RB(0.3), 0.15, -0.14, 0.02, 0, 0, 0, 0.07, 0.74, 0.58, WHITE), X(RB(0.3), 0.12, -0.14, 0.02, 0, 0, 0, 0.05, 0.84, 0.68, MAG),
      X(sphere(0.09, MAG, 8, 6), 0.2, -0.1, 0.02, 0, 0, 0, 0.7, 1, 1), X(FB, 0.19, -0.18, 0.02, 0, 0, 0, 0.02, 0.56, 0.06, MAG), X(FB, 0.19, -0.02, 0.02, 0, 0, 0, 0.02, 0.06, 0.4, MAG));
    const shieldGlow = () => merge(X(FB, 0.2, -0.3, 0.02, 0, 0, 0, 0.012, 0.16, 0.035, WHITE), X(sphere(0.035, WHITE, 6, 4), 0.25, -0.1, 0.02));
    // a dungeon's weapon of kind k: {body, glow, tip, orb}
    const TW = {};
    CH.tierWeapon = (k, t) => { const key = k + ':' + t; if (TW[key]) return TW[key]; let w;
      if (k === 'hammer') w = tierHammer(t); else if (k === 'staff') w = tierStaff(t);
      else { const big = k === 'greatsword', dg = k === 'dagger', L = big ? 1.42 : dg ? 0.44 : 1.0, Wd = big ? 0.17 : dg ? 0.075 : 0.11, bl = tierBlade(t, L, Wd), h = tierHilt(t, big ? 1.3 : dg ? 0.65 : 1, big ? 0.34 : dg ? 0.17 : 0.27);
        w = { body: () => merge(...bl.b, ...h.b), glow: () => merge(...(bl.g.length ? bl.g : [X(sphere(0.02, WHITE, 4, 3), 0, 0, 0.12)]), ...h.g), tip: [0.25, L + 0.15] }; }
      w.n = TN[t] + ' ' + k; return (TW[key] = w); };
    // ---- armour pieces for each dungeon (extras on top of the plate / robe / helmet / gloves / boots)
    function tierPaul(t, sc) { // shoulder piece on the upper arm, outer side = -x
      const o = [], r = tRnd(t + 31), S = sc || 1, P = (g) => o.push(G.xf(g, T(0, 0, 0, 0, 0, 0, S, S, S)));
      switch (t) {
        case 0: for (let k = 0; k < 3; k++) P(X(FB, -0.08 - k * 0.04, 0.14 - k * 0.1, (r() - 0.5) * 0.1, r() * 0.3, 0, 0.3 + r() * 0.2, 0.34, 0.12, 0.56, BARK)); for (let k = 0; k < 4; k++) P(X(sphere(0.08, LEAF, 8, 5), -0.22 + r() * 0.1, 0.2 + r() * 0.06, (r() - 0.5) * 0.4, 0, 0, 0, 1.3, 0.6, 1.3));
          P(X(spikeGeo(0.24, 0.04), -0.2, 0.22, 0.08, 0, 0, 0.6, 1, 1, 1, BARK)); break;
        case 1: P(X(sphere(0.26, WHITE, 12, 8), -0.12, 0.12, 0, 0, 0, 0.3, 1, 0.6, 1.1)); for (let k = 0; k < 3; k++) P(X(FB, -0.26, 0.06 - k * 0.07, -0.05, 0, 0.3 + k * 0.25, 0.5, 0.04, 0.24 - k * 0.04, 0.4, MAG)); P(X(sphere(0.06, MAG, 8, 5), -0.3, 0.16, 0.12)); break;
        case 2: P(X(sphere(0.2, BONE, 10, 7), -0.14, 0.16, 0, 0, 0, 0.3, 1, 0.9, 1)); P(FBx(0.2, 0.05, -0.04, 0.16, BONE, 0.3, -0.16, 0.12)); for (const z of [-0.1, 0.1]) P(X(spikeGeo(0.24, 0.05), -0.2, 0.28, z, 0, z * 3, 0.5, 1, 1, 1, BONE)); break;
        case 3: P(X(FB, -0.08, 0.12, 0, 0, 0, 0.3, 0.34, 0.12, 0.58, WHITE)); for (const [z, a, h] of [[0, 0.3, 0.3], [0.14, 0.6, 0.22], [-0.14, 0.5, 0.22]]) P(X(gem3(0.06, h, ICE), -0.2, 0.25, z, 0, z * 2, a)); break;
        case 4: for (let k = 0; k < 3; k++) P(X(FB, -0.08 - k * 0.04, 0.16 - k * 0.1, 0, 0, 0, 0.32, 0.38 - k * 0.04, 0.13, 0.66 - k * 0.04, OBS)); for (const z of [-0.18, 0, 0.18]) P(X(spikeGeo(0.32, 0.07), -0.22, 0.24, z, 0, z * 1.5, 0.75, 1, 1, 1, OBS)); break;
        case 5: P(X(FB, -0.08, 0.12, 0, 0, 0, 0.3, 0.32, 0.12, 0.54, WHITE)); for (let k = 0; k < 3; k++) P(X(FB, -0.22, 0.28 + k * 0.03, -0.12 + k * 0.08, 0, -0.5 + k * 0.1, 0.4, 0.02, 0.36 - k * 0.06, 0.12, WHITE)); P(ring(0.13, 0.02, -0.14, 0.12, 0, 0, 0, 0.3 + PI / 2, MAG)); break;
        case 6: P(X(FB, -0.08, 0.1, 0, 0, 0, 0.3, 0.32, 0.1, 0.52, OBS)); for (const [x, y, z] of [[-0.2, 0.4, 0], [-0.1, 0.34, 0.16], [-0.12, 0.36, -0.16]]) P(X(gem3(0.06, 0.13, WHITE), x, y, z, r() * 3, 0, 0.3)); break;
        case 7: P(X(sphere(0.2, WHITE, 10, 7), -0.12, 0.12, 0, 0, 0, 0, 1, 0.7, 1.1)); for (let k = 0; k < 4; k++) P(X(spikeGeo(0.32, 0.045), -0.24, 0.05, -0.15 + k * 0.1, 0, 0, PI - 0.5 + k * 0.1, 1, 1, 1, DARKR)); P(X(sphere(0.06, MAG, 8, 5), -0.26, 0.16, 0.08)); break;
        case 8: for (let k = 0; k < 4; k++) P(cubeG(0.16, -0.1 - (k % 2) * 0.1, 0.12 + Math.floor(k / 2) * 0.13, (k % 2 ? 0.08 : -0.08), 0, k % 3 ? OBS : MAG)); break;
        // Update 7: Tidebound (shell scallops and coral), Clockwork (a gear on the shoulder, rivets), Lunar (a crescent rising off the shoulder)
        case 9: for (let k = 0; k < 4; k++) P(X(sphere(0.16, k % 2 ? MAG : WHITE, 10, 6), -0.16 - k * 0.02, 0.24 - k * 0.07, (k - 1.5) * 0.12, 0, 0, 0.4, 1, 0.35, 0.8)); for (let k = 0; k < 3; k++) P(X(spikeGeo(0.2 + k * 0.05, 0.03), -0.22, 0.3, -0.1 + k * 0.1, 0, 0, 0.5 - k * 0.2, 1, 1, 1, [0.9, 0.42, 0.45])); break;
        case 10: P(ring(0.14, 0.035, -0.3, 0.2, 0, 0, 0, PI / 2, MAG)); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; P(X(FB, -0.3, 0.2 + Math.sin(a) * 0.18, Math.cos(a) * 0.18, 0, a, 0, 0.05, 0.06, 0.06, MAG)); } for (const z of [-0.14, 0.14]) P(X(sphere(0.03, OBS, 6, 4), -0.27, 0.06, z)); break;
        case 11: for (let k = 0; k < 7; k++) { const a = -0.9 + k * 0.3; P(X(FB, -0.22 + Math.cos(a) * 0.04, 0.3 + Math.sin(a + 0.9) * 0.12, Math.sin(a) * 0.22, 0, 0, 0.2, 0.04, 0.05, 0.09, WHITE)); } P(X(sphere(0.07, MAG, 10, 7), -0.24, 0.42, 0)); break;
      }
      return merge(...o);
    }
    function tierChest(t) { // over the chest plate (torso: front = +z 0.25, top y 0.9)
      const o = [], r = tRnd(t + 41);
      switch (t) {
        case 0: for (let k = 0; k < 3; k++) o.push(X(FB, (k - 1) * 0.14, 0.5 + k * 0.06, 0.29, 0, 0, 0.8, 0.05, 0.75, 0.04, LEAF)); for (let k = 0; k < 5; k++) o.push(X(sphere(0.06, LEAF, 8, 5), (r() - 0.5) * 0.7, 0.85, 0.2 + r() * 0.08)); break;
        case 1: for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.6; o.push(X(FB, Math.sin(a) * 0.28, 0.82 - Math.cos(a) * 0.12, 0.27, a, 0, 0, 0.07, 0.11, 0.04, k % 2 ? GOLD : MAG)); } break;
        case 2: for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) o.push(X(FB, sd * 0.17, 0.72 - k * 0.12, 0.29, sd * 0.25, 0, sd * 0.25, 0.26, 0.05, 0.05, BONE)); o.push(FBx(0.06, 0.8, 0.3, 0.05, BONE, 0.5, 0, 0.29)); break;
        case 3: o.push(X(gem3(0.08, 0.16, ICE), 0, 0.6, 0.31, 0, 0, 0)); for (let k = 0; k < 6; k++) o.push(X(gem3(0.03, 0.1, ICE), (k - 2.5) * 0.15, 0.92, 0.18, 0, 0.3, (k - 2.5) * 0.2)); break;
        case 4: for (let k = 0; k < 5; k++) o.push(FBx(0.04, 0.72, 0.36, 0.05, OBS, 0.3, (k - 2) * 0.09, 0.3)); break;
        case 5: o.push(FBx(0.6, 0.94, 0.88, 0.5, WHITE, 0.4)); for (const sd of [-1, 1]) o.push(X(FB, sd * 0.3, 1.02, -0.05, 0, 0.3, sd * 0.4, 0.04, 0.2, 0.35, WHITE)); break;
        case 6: o.push(X(gem3(0.06, 0.12, WHITE), 0, 1.15, -0.2, 0.6, 0, 0)); break;
        case 7: o.push(FBx(0.4, 0.42, 0.22, 0.04, OBS, 0.4, 0, 0.28)); for (let k = 0; k < 7; k++) { o.push(X(spikeGeo(0.07, 0.025), -0.17 + k * 0.057, 0.42, 0.3, 0, 0, PI, 1, 1, 1, BONE), X(spikeGeo(0.07, 0.025), -0.17 + k * 0.057, 0.22, 0.3, 0, 0, 0, 1, 1, 1, BONE)); } break;
        case 8: for (let k = 0; k < 7; k++) o.push(cubeG(0.09 + r() * 0.06, (r() - 0.5) * 0.8, 0.2 + r() * 0.65, 0.27, 0, k % 2 ? OBS : MAG)); break;
        case 9: for (let k = 0; k < 5; k++) { const a = (k - 2) * 0.35; o.push(X(sphere(0.1, MAG, 10, 6), Math.sin(a) * 0.3, 0.78 - Math.abs(k - 2) * 0.05, 0.28, 0, 0, a, 1, 0.5, 0.45)); } o.push(X(spikeGeo(0.22, 0.04), 0, 0.42, 0.31, 0, 0, PI, 1, 1, 1, [0.9, 0.42, 0.45])); break;
        case 10: o.push(ring(0.13, 0.03, 0, 0.64, 0.3, 0, PI / 2, 0, MAG)); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; o.push(X(FB, Math.sin(a) * 0.16, 0.64 + Math.cos(a) * 0.16, 0.3, 0, 0, -a, 0.05, 0.06, 0.05, MAG)); } for (const sd of [-1, 1]) o.push(X(FB, sd * 0.3, 0.55, 0.28, 0, 0, 0, 0.04, 0.5, 0.04, OBS)); break;
        case 11: for (let k = 0; k < 9; k++) { const a = -1.2 + k * 0.3; o.push(X(FB, Math.sin(a) * 0.22, 0.62 + Math.cos(a) * 0.22, 0.29, 0, 0, -a, 0.05, 0.05, 0.04, WHITE)); } break;
      }
      return o.length ? merge(...o) : X(sphere(0.001, WHITE, 3, 2), 0, 0.5, 0);
    }
    function tierChestGlow(t) {
      switch (t) {
        case 2: return merge(X(sphere(0.03, WHITE, 6, 4), -0.12, 0.2, 0.16), X(sphere(0.03, WHITE, 6, 4), -0.18, 0.2, 0.12));
        case 4: return FBx(0.36, 0.7, 0.38, 0.02, WHITE, 0.2, 0, 0.285);
        case 5: { const pts = [[0.02, 0.78], [-0.06, 0.62], [0.05, 0.6], [-0.03, 0.42]]; const o = []; for (let k = 0; k < 3; k++) o.push(X(FB, (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2, 0.3, 0, 0, Math.atan2(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]), 0.035, Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]), 0.03, WHITE)); return merge(...o); }
        case 6: return ring(0.14, 0.018, 0, 0.6, 0.29, 0, PI / 2, 0, WHITE);
        case 7: return X(sphere(0.045, WHITE, 8, 5), 0, 0.32, 0.29);
        case 8: return merge(cubeG(0.05, -0.1, 0.62, 0.3, 0, WHITE), cubeG(0.04, 0.14, 0.45, 0.3, 0, WHITE), cubeG(0.05, 0.02, 0.3, 0.3, 0, WHITE));
        case 3: return X(gem3(0.03, 0.08, WHITE), 0, 0.6, 0.32);
        case 9: return merge(X(sphere(0.04, WHITE, 8, 5), 0, 0.42, 0.33), X(sphere(0.025, WHITE, 6, 4), -0.12, 0.72, 0.33), X(sphere(0.025, WHITE, 6, 4), 0.12, 0.72, 0.33));
        case 10: return X(FB, 0, 0.64, 0.33, 0, 0, 0.5, 0.025, 0.14, 0.02, WHITE);
        case 11: return merge(X(sphere(0.05, WHITE, 8, 5), 0.06, 0.66, 0.31), X(sphere(0.02, WHITE, 6, 4), -0.12, 0.5, 0.31), X(sphere(0.02, WHITE, 6, 4), 0.15, 0.45, 0.31));
        default: return X(sphere(0.045, WHITE, 8, 5), 0, 0.64, 0.32);
      }
    }
    function tierHelm(t, hood) { // on the head (centre at 0, top ~0.38, front +z)
      const o = [], r = tRnd(t + 51), k = hood ? 0.8 : 1;
      switch (t) {
        case 0: for (const sd of [-1, 1]) { o.push(X(spikeGeo(0.42 * k, 0.04), sd * 0.24, 0.3, -0.02, 0, -0.2, -sd * 0.55, 1, 1, 1, BARK)); o.push(X(spikeGeo(0.2 * k, 0.03), sd * 0.34, 0.48, 0, 0, 0.3, -sd * 1.1, 1, 1, 1, BARK), X(spikeGeo(0.16 * k, 0.03), sd * 0.3, 0.42, 0.06, 0, 0.8, -sd * 0.3, 1, 1, 1, BARK)); }
          for (let q = 0; q < 6; q++) { const a = q / 6 * PI - PI / 2; o.push(X(sphere(0.07, LEAF, 8, 5), Math.sin(a) * 0.32, 0.3, Math.cos(a) * 0.3 * 0.2 + 0.05, 0, 0, 0, 1.3, 0.6, 1)); } break;
        case 1: for (const sd of [-1, 1]) for (let q = 0; q < 4; q++) o.push(FBx(0.06, 0.24 - q * 0.17, 0.08 - q * 0.17, 0.2, q % 2 ? MAG : WHITE, 0.2, sd * 0.38, -0.02));
          o.push(FBx(0.56, -0.06, -0.48, 0.06, WHITE, 0.2, 0, -0.33), X(spikeGeo(0.18, 0.04), 0, 0.36, 0.3, 0, -0.4, 0, 1, 1, 1, GOLD), FBx(0.72, 0.36, 0.28, 0.72, GOLD, 0.3)); break;
        case 2: for (const sd of [-1, 1]) o.push(X(spikeGeo(0.36 * k, 0.07), sd * 0.3, 0.26, 0, 0, 0, -sd * 1.0, 1, 1, 1, BONE), X(spikeGeo(0.18 * k, 0.05), sd * 0.5, 0.5, 0, 0, 0, -sd * 0.2, 1, 1, 1, BONE));
          if (!hood) o.push(FBx(0.5, -0.2, -0.36, 0.1, BONE, 0.3, 0, 0.32)); else o.push(FBx(0.5, 0.06, -0.1, 0.06, BONE, 0.3, 0, 0.34)); break;
        case 3: for (let q = 0; q < 7; q++) { const a = q / 7 * TAU; o.push(X(gem3(0.045, (q % 2 ? 0.12 : 0.2) * k, ICE), Math.sin(a) * 0.26, 0.4, Math.cos(a) * 0.26, 0, 0, 0)); } break;
        case 4: for (const sd of [-1, 1]) { o.push(X(spikeGeo(0.5 * k, 0.09), sd * 0.3, 0.12, 0, 0, -0.2, -sd * 1.3, 1, 1, 1, OBS)); o.push(X(spikeGeo(0.24 * k, 0.07), sd * 0.62, 0.34, 0.1, 0, -0.5, -sd * 0.3, 1, 1, 1, OBS)); }
          if (!hood) o.push(FBx(0.08, 0.46, 0.3, 0.6, OBS, 0.4)); break;
        case 5: for (const sd of [-1, 1]) for (let q = 0; q < 3; q++) o.push(X(FB, sd * 0.38, 0.14 + q * 0.08, -0.08 - q * 0.05, 0, -0.5 - q * 0.2, sd * 0.2, 0.03, 0.08, 0.32 - q * 0.06, WHITE));
          o.push(X(FB, 0, 0.46, -0.05, 0, -0.3, 0, 0.04, 0.22, 0.4, MAG)); break;
        case 6: o.push(X(gem3(0.06, 0.2 * k, WHITE), 0, 0.56, 0, 0, 0, 0)); break;
        case 7: for (let q = 0; q < 7; q++) { const a = (q / 6 - 0.5) * 3.6 + PI; o.push(X(spikeGeo(0.36, 0.04), Math.sin(a) * 0.3, 0.0, Math.cos(a) * 0.3, 0, a === PI ? 0 : 0.2, PI - Math.sin(a) * 0.3, 1, 1, 1, DARKR)); } break;
        case 9: for (let q = 0; q < 5; q++) { const a = (q - 2) * 0.4; o.push(X(sphere(0.13, q % 2 ? MAG : WHITE, 10, 6), Math.sin(a) * 0.2, 0.4 - Math.abs(q - 2) * 0.04, Math.cos(a) * 0.05 - 0.05, 0, -0.4, a, 1, 0.4, 0.9)); } for (const sd of [-1, 1]) o.push(X(spikeGeo(0.26 * k, 0.035), sd * 0.34, 0.2, -0.05, 0, 0, -sd * 1.1, 1, 1, 1, [0.9, 0.42, 0.45])); break;
        case 10: o.push(ring(0.2, 0.04, 0, 0.42, -0.02, 0, 0, 0, MAG)); for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; o.push(X(FB, Math.sin(a) * 0.24, 0.42, Math.cos(a) * 0.24, a, 0, 0, 0.07, 0.05, 0.07, MAG)); } if (!hood) for (const sd of [-1, 1]) o.push(X(FB, sd * 0.38, 0.06, 0.02, 0, 0, 0, 0.1, 0.16, 0.16, OBS)); break;
        case 11: for (let q = 0; q < 9; q++) { const a = -1.3 + q * 0.32; o.push(X(FB, Math.sin(a) * 0.36, 0.3 + Math.cos(a) * 0.3, -0.06, 0, 0, -a, 0.05, 0.08, 0.06, WHITE)); } break;
        case 8: if (!hood) o.push(X(FB, 0, 0.04, 0, 0, 0, 0, 0.76, 0.72, 0.74, WHITE)); for (let q = 0; q < 5; q++) o.push(cubeG(0.1, (r() - 0.5) * 0.6, 0.38 + r() * 0.08, (r() - 0.5) * 0.5, 0, q % 2 ? OBS : MAG)); break;
      }
      return o.length ? merge(...o) : X(sphere(0.001, WHITE, 3, 2), 0, 0, 0);
    }
    function tierHelmGlow(t) {
      switch (t) {
        case 2: return merge(X(sphere(0.035, WHITE, 6, 4), -0.11, 0.06, 0.34), X(sphere(0.035, WHITE, 6, 4), 0.11, 0.06, 0.34));
        case 6: return ring(0.26, 0.02, 0, 0.58, 0, 0, 0.15, 0, WHITE);
        case 7: return merge(X(sphere(0.04, WHITE, 6, 4), 0, 0.22, 0.36), X(sphere(0.03, WHITE, 6, 4), -0.13, 0.14, 0.35), X(sphere(0.03, WHITE, 6, 4), 0.13, 0.14, 0.35));
        case 8: return FBx(0.5, 0.06, 0.0, 0.02, WHITE, 0.1, 0, 0.375);
        case 3: return X(gem3(0.03, 0.1, WHITE), 0, 0.46, 0.25);
        case 9: return merge(X(sphere(0.03, WHITE, 6, 4), -0.1, 0.08, 0.35), X(sphere(0.03, WHITE, 6, 4), 0.1, 0.08, 0.35));
        case 10: return X(sphere(0.06, WHITE, 8, 5), 0, 0.42, 0.22);
        case 11: return X(sphere(0.05, WHITE, 8, 5), 0, 0.62, 0);
        default: return null;
      }
    }
    function tierLimb(t, kind) { // gauntlet (forearm, y 0..-0.44) or greave (shin, y 0..-0.5) extras
      const o = [], g = kind === 'g', y = g ? -0.2 : -0.06;
      switch (t) {
        case 0: o.push(X(spikeGeo(0.16, 0.03), 0, y, -0.25, 0, -1.2, 0, 1, 1, 1, BARK), X(sphere(0.06, LEAF, 8, 5), 0.18, y + 0.05, 0.18, 0, 0, 0, 1.2, 0.6, 1)); break;
        case 1: o.push(FBx(0.55, y + 0.05, y - 0.03, 0.55, GOLD, 0.35), FBx(0.55, y - 0.12, y - 0.16, 0.55, MAG, 0.35)); break;
        case 2: if (g) for (let q = 0; q < 3; q++) o.push(X(spikeGeo(0.14, 0.025), (q - 1) * 0.1, -0.42, 0.16, 0, PI - 0.3, 0, 1, 1, 1, BONE)); else o.push(X(sphere(0.12, BONE, 9, 6), 0, 0.0, 0.25, 0, 0, 0, 1, 0.9, 0.7)); break;
        case 3: for (const x of [-0.12, 0.12]) o.push(X(gem3(0.04, 0.14, ICE), x, y + 0.08, 0.2, 0, 0.6, 0)); break;
        case 4: for (const a of [-0.8, 0, 0.8]) o.push(X(spikeGeo(0.18, 0.05), Math.sin(a) * 0.28, y, Math.cos(a) * 0.28, 0, 1.3, a, 1, 1, 1, OBS)); break;
        case 5: for (let q = 0; q < 2; q++) o.push(ring(0.29, 0.02, 0, y - q * 0.1, 0, 0, 0, 0, MAG)); o.push(X(FB, 0.29, y + 0.05, -0.05, 0, -0.4, 0, 0.03, 0.2, 0.22, WHITE)); break;
        case 6: o.push(X(gem3(0.04, 0.12, WHITE), 0.34, y + 0.1, 0, 0, 0, 0.5)); break;
        case 7: for (let q = 0; q < 3; q++) o.push(X(spikeGeo(0.2, 0.03), (q - 1) * 0.12, y - 0.1, 0.22, 0, 2.2, 0, 1, 1, 1, DARKR)); break;
        case 8: for (let q = 0; q < 3; q++) o.push(cubeG(0.1, (q - 1) * 0.16, y, 0.26, 0, q % 2 ? OBS : MAG)); break;
        case 9: for (let q = 0; q < 3; q++) o.push(X(sphere(0.08, q % 2 ? MAG : WHITE, 8, 5), (q - 1) * 0.14, y, 0.25, 0, 0, 0, 1, 0.5, 0.6)); break;
        case 10: o.push(ring(0.08, 0.025, 0.28, y, 0, 0, 0, PI / 2, MAG)); for (const q of [-0.12, 0.12]) o.push(X(sphere(0.025, OBS, 6, 4), q, y - 0.08, 0.26)); break;
        case 11: for (let q = 0; q < 4; q++) o.push(X(FB, 0.27, y + 0.1 - q * 0.06, (q - 1.5) * 0.06, 0, 0, 0.3, 0.04, 0.05, 0.05, WHITE)); break;
      }
      return o.length ? merge(...o) : X(sphere(0.001, WHITE, 3, 2), 0, 0, 0);
    }
    for (let t = 0; t < 12; t++) { GEO['tPaul' + t] = () => tierPaul(t); GEO['tPaulS' + t] = () => tierPaul(t, 0.75); GEO['tChest' + t] = () => tierChest(t); GEO['tChestG' + t] = () => tierChestGlow(t);
      GEO['tHelm' + t] = () => tierHelm(t, false); GEO['tHood' + t] = () => tierHelm(t, true); GEO['tGaunt' + t] = () => tierLimb(t, 'g'); GEO['tGreave' + t] = () => tierLimb(t, 'b');
      // the dungeon's plate (warrior) and robes (mage): the base set with that dungeon's own shoulders, chest and glow
      // Update 7: on top of the layered plate (b7...), so every set has square finned pauldrons, a V of trim, a glowing gem, banded arms and studded thighs
      const B7 = [{ b: 'torso', k: 'b7Chest' }, { b: 'torso', k: 'b7ChestG', glow: 1 }, { b: 'ua', k: 'b7Paul', mirror: 1 }, { b: 'ua', k: 'b7PaulG', glow: 1, mirror: 1 }, { b: 'ua', k: 'b7Arm', mirror: 1 }, { b: 'fa', k: 'b7Bracer', mirror: 1 },
        { b: 'th', k: 'b7Thigh', mirror: 1 }, { b: 'th', k: 'b7ThighG', glow: 1, mirror: 1 }, { b: 'sh', k: 'b7Knee', mirror: 1 }];
      OUTFITS['plate' + t] = { n: TN[t] + ' Plate', sleeve: 'long', metal: 1, noGlow: 1, parts: [{ b: 'torso', k: 'kChest' }, ...B7, { b: 'torso', k: 'tChest' + t }, { b: 'torso', k: 'tChestG' + t, glow: 1 }, { b: 'ua', k: 'tPaul' + t, mirror: 1, up: 1 }, { b: 'pelvis', k: 'kTassets' }] };
      OUTFITS['robe' + t] = { n: TN[t] + ' Robes', sleeve: 'long', noGlow: 1, parts: [{ b: 'torso', k: 'mRobe' }, { b: 'pelvis', k: 'mSkirt' }, { b: 'torso', k: 'mMantle' }, { b: 'torso', k: 'b7Mantle' }, { b: 'torso', k: 'b7ChestG', glow: 1 }, { b: 'fa', k: 'b7Bracer', mirror: 1 }, { b: 'torso', k: 'tChest' + t }, { b: 'torso', k: 'tChestG' + t, glow: 1 }, { b: 'ua', k: 'tPaulS' + t, mirror: 1 }] }; }
    // ================================================================ Update 7 (final): cosmetic skins from the Shop's chests (our own designs)
    // An armour skin is an outfit (parts on the body) with its own colours; it replaces how your armour, helmet, gloves and boots look (your gear
    // and its Power stay). A weapon skin replaces the weapon's model. WHITE = tint 1 (the skin's main colour), MAG = tint 2 (its trim).
    const YEL = [0.95, 0.82, 0.22], BRN = [0.36, 0.22, 0.1], GRN = [0.3, 0.62, 0.26], ORG = [0.98, 0.52, 0.12], RED = [0.78, 0.12, 0.1], BLK = [0.05, 0.05, 0.07], BONEW = [0.93, 0.91, 0.85],
      GLASS = [0.06, 0.08, 0.13], SILV = [0.8, 0.84, 0.9], PINK = [0.98, 0.5, 0.72], CYAN = [0.45, 0.9, 1], TAN = [0.86, 0.72, 0.46], CREAM = [0.98, 0.96, 0.9];
    const torus = (R0, r, seg, col) => { const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU; pts.push([R0 + Math.cos(a) * r, Math.sin(a) * r]); } return lathe(pts, seg || 16).map((v, k) => v); };   // a torus round the y axis
    const tint = (geo, col) => G.xf(geo, T(0, 0, 0, 0, 0, 0, 1, 1, 1), col);
    const around = (n, fn) => { const g = []; for (let i = 0; i < n; i++) g.push(fn(i / n * TAU, i)); return merge(...g); };
    Object.assign(GEO, {
      // ---- Banana Suit: a peel body over the torso, a peel cap with flaps and a stem
      csBanana: () => merge(tint(lathe([[0, -0.14], [0.36, -0.12], [0.56, 0.16], [0.61, 0.5], [0.55, 0.82], [0.32, 1.0], [0, 1.05]], 14, { zs: 0.64 }), WHITE),
        X(sphere(0.07, BRN, 8, 6), 0, -0.13, 0), X(sphere(0.05, BRN, 8, 6), 0, 1.04, 0)),
      csBananaTop: () => merge(tint(lathe([[0.335, 0.16], [0.3, 0.3], [0.18, 0.4], [0, 0.44]], 14), WHITE), X(capsule(0.045, 0.035, 0.16, BRN, 8), 0, 0.42, 0),
        ...[PI, PI * 0.62, -PI * 0.62].map(a => X(RB(0.4), Math.sin(a) * 0.33, 0.06, Math.cos(a) * 0.33, a, 0.18, 0, 0.3, 0.42, 0.05, WHITE))),
      // ---- Slime Costume: a glossy green blob and a drop-shaped cap with two googly eyes
      csSlimeBody: () => tint(lathe([[0, -0.16], [0.42, -0.13], [0.62, 0.2], [0.64, 0.55], [0.55, 0.85], [0.3, 1.02], [0, 1.06]], 16, { zs: 0.7 }), WHITE),
      csSlimeTop: () => merge(tint(lathe([[0.34, 0.12], [0.3, 0.3], [0.16, 0.5], [0.04, 0.66], [0, 0.7]], 14), WHITE),
        ...[-1, 1].map(s => X(sphere(0.1, CREAM, 10, 8), s * 0.13, 0.44, 0.17)), ...[-1, 1].map(s => X(sphere(0.045, BLK, 8, 6), s * 0.13, 0.45, 0.26))),
      // ---- Cardboard Knight: boxes and tape (an eye slot in the box helmet)
      csBoxChest: () => merge(BX(1.12, 0.96, -0.06, 0.64, WHITE, 0.06), BX(1.14, 0.62, 0.52, 0.66, MAG, 0.04), BX(0.12, 0.97, -0.07, 0.66, MAG, 0.04, 0.3), X(RB(0.1), 0, 0.42, 0.33, 0, 0, 0.78, 0.22, 0.22, 0.02, RED)),
      csBoxHelm: () => merge(BX(0.76, 0.44, -0.36, 0.74, WHITE, 0.05), BX(0.46, 0.1, -0.02, 0.03, BLK, 0.1, 0, 0.375), BX(0.78, 0.3, 0.22, 0.76, MAG, 0.04), BX(0.08, 0.5, 0.42, 0.08, MAG, 0.1)),
      csBoxPad: () => merge(BX(0.52, 0.18, -0.2, 0.52, WHITE, 0.06), BX(0.54, 0.04, -0.04, 0.54, MAG, 0.04)),
      // ---- Bone Costume: a spine and ribs on the chest, bones down the limbs, a skull mask
      csRibs: () => { const g = [BX(0.08, 0.88, 0.08, 0.04, BONEW, 0.5, 0, 0.275)]; for (let i = 0; i < 4; i++) { const y = 0.78 - i * 0.16; for (const s of [-1, 1]) g.push(X(RB(0.5), s * 0.2, y, 0.272, 0, 0, s * (0.25 + i * 0.05), 0.34, 0.06, 0.03, BONEW)); }
        g.push(X(RB(0.5), 0, 0.12, 0.272, 0, 0, 0, 0.4, 0.1, 0.03, BONEW)); return merge(...g); },
      csBoneLimb: () => merge(BX(0.07, 0.0, -0.4, 0.04, BONEW, 0.5, 0, 0.25), X(sphere(0.05, BONEW, 8, 6), 0, -0.02, 0.25), X(sphere(0.05, BONEW, 8, 6), 0, -0.4, 0.25)),
      csSkull: () => merge(X(RB(0.45), 0, 0.02, 0, 0, 0, 0, 0.66, 0.66, 0.64, BONEW), ...[-1, 1].map(s => X(sphere(0.085, BLK, 10, 8), s * 0.13, 0.06, 0.29, 0, 0, 0, 1, 1, 0.5)),
        X(RB(0.3), 0, -0.07, 0.32, 0, 0, 0.78, 0.06, 0.06, 0.02, BLK), ...[-2, -1, 0, 1, 2].map(i => BX(0.045, -0.15, -0.23, 0.02, BLK, 0.2, i * 0.06, 0.32))),
      // ---- Chicken Suit: a white puff, wings, a red comb, a beak and a wattle
      csChickBody: () => merge(tint(lathe([[0, -0.12], [0.44, -0.08], [0.62, 0.3], [0.6, 0.66], [0.42, 0.92], [0, 0.98]], 14, { zs: 0.72 }), WHITE),
        ...[-1, 1].map(s => X(sphere(0.12, WHITE, 8, 6), s * 0.22, 0.02, -0.34, 0, 0, 0, 1, 0.7, 1.4))),
      csWing: () => merge(X(RB(0.5), -0.22, -0.16, -0.05, 0, 0.2, 0.25, 0.1, 0.46, 0.34, WHITE), X(RB(0.5), -0.25, -0.36, -0.1, 0, 0.3, 0.35, 0.08, 0.2, 0.26, CREAM)),
      csChickHead: () => merge(...[[-0.1, 0.38], [0, 0.42], [0.1, 0.38]].map(([z, y]) => X(sphere(0.085, RED, 10, 8), 0, y, z - 0.02, 0, 0, 0, 0.6, 1, 1)),
        X(lathe([[0, 0], [0.08, 0.01], [0, 0.17]], 6), 0, 0.0, 0.29, 0, PI / 2, 0, 1, 1, 0.8, ORG), X(sphere(0.06, RED, 8, 6), 0, -0.13, 0.31)),
      // ---- Pumpkin Head: a ribbed pumpkin with a carved grin, a stem and a leaf; a vine collar
      csPumpkin: () => { const g = [tint(lathe([[0, -0.3], [0.24, -0.29], [0.4, -0.18], [0.44, 0.02], [0.4, 0.2], [0.24, 0.31], [0, 0.32]], 10), WHITE)];   // ten ribs (the lathe's facets)
        for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * TAU; g.push(X(RB(0.5), Math.sin(a) * 0.43, 0.01, Math.cos(a) * 0.43, a, 0, 0, 0.035, 0.42, 0.02, MAG)); }
        for (const s of [-1, 1]) g.push(X(lathe([[0, 0], [0.09, 0.01], [0, 0.13]], 3), s * 0.13, 0.08, 0.385, 0, PI / 2, 0, 1, 1, 0.2, BLK));
        for (let i = -2; i <= 2; i++) g.push(X(RB(0.2), i * 0.07, -0.13 + (i % 2 ? 0.035 : 0), 0.4, 0, 0, 0.78, 0.065, 0.065, 0.02, BLK));
        g.push(X(capsule(0.045, 0.035, 0.16, GRN, 8), 0.02, 0.36, 0, 0, 0, 0.2), X(RB(0.5), 0.12, 0.43, 0.02, 0.4, 0, 0.5, 0.18, 0.02, 0.1, GRN)); return merge(...g); },
      csVine: () => merge(tint(torus(0.44, 0.05, 14), MAG).map(v => v), ...[0, 1.6, 3.2, 4.8].map(a => X(RB(0.5), Math.sin(a) * 0.46, 0.06, Math.cos(a) * 0.3, a, 0.4, 0, 0.16, 0.02, 0.1, MAG))).map(v => v),
      // ---- Royal Regalia: a gold crown with gems and a white fur collar
      csCrown: () => merge(tint(lathe([[0.27, 0.2], [0.28, 0.33], [0.26, 0.33], [0.25, 0.2]], 14), [0.95, 0.76, 0.24]),
        around(7, a => X(lathe([[0, 0], [0.06, 0.02], [0, 0.14]], 4), Math.sin(a) * 0.265, 0.33, Math.cos(a) * 0.265, a, 0, 0, 1, 1, 0.6, [0.95, 0.76, 0.24])),
        around(4, a => X(sphere(0.035, a < 1 ? RED : [0.2, 0.4, 0.95], 8, 6), Math.sin(a) * 0.28, 0.26, Math.cos(a) * 0.28))),
      csFur: () => { let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, g = []; for (let i = 0; i < 30; i++) { const a = i / 30 * TAU; g.push(X(sphere(0.085 + rnd() * 0.03, CREAM, 9, 6), Math.sin(a) * 0.5, 0.92 + rnd() * 0.04, Math.cos(a) * 0.3)); } return merge(...g); },
      // ---- Sea Captain: a three-cornered hat with a trim and a white emblem
      csTricorn: () => merge(X(lathe([[0, 0.2], [0.52, 0.2], [0.56, 0.26], [0.5, 0.27], [0, 0.27]], 3), 0, 0, 0, PI / 3, 0, 0, 1, 1, 1, WHITE),
        tint(lathe([[0.3, 0.22], [0.29, 0.36], [0.2, 0.46], [0, 0.48]], 12), WHITE), X(lathe([[0.555, 0.25], [0.565, 0.27], [0.555, 0.29]], 3), 0, 0, 0, PI / 3, 0, 0, 1, 1, 1, MAG), X(sphere(0.06, BONEW, 8, 6), 0, 0.34, 0.3)),
      // ---- Pool Duck: a rubber ring round the waist with a duck's head at the front; a bucket hat
      csDuckRing: () => merge(tint(torus(0.6, 0.17, 18), WHITE), X(sphere(0.2, WHITE, 12, 10), 0, 0.3, 0.66), X(RB(0.5), 0, 0.27, 0.86, 0, 0, 0, 0.2, 0.07, 0.16, MAG), ...[-1, 1].map(s => X(sphere(0.035, BLK, 8, 6), s * 0.09, 0.38, 0.82))),
      csBucket: () => merge(tint(lathe([[0.42, 0.14], [0.44, 0.17], [0.31, 0.2], [0.29, 0.38], [0.24, 0.44], [0, 0.45]], 14), MAG)),
      // ---- Crimson Ronin: a lacquered dome helm with a wide brim, a forked gold crest and a face guard
      csKabuto: () => merge(tint(lathe([[0.36, 0.0], [0.36, 0.2], [0.28, 0.38], [0, 0.46]], 14), WHITE), X(lathe([[0, 0.12], [0.58, 0.04], [0.6, 0.02], [0, 0.08]], 14), 0, 0, -0.05, 0, 0, 0, 1, 1, 0.9, MAG),
        ...[-1, 1].map(s => X(RB(0.5), s * 0.14, 0.45, 0.3, 0, -0.5, s * 0.55, 0.06, 0.4, 0.03, [0.95, 0.76, 0.24])), BX(0.5, -0.1, -0.3, 0.06, MAG, 0.4, 0, 0.33)),
      // ---- Star Pilot: a mirrored dome helmet with a white rim, a life-support pack on the back
      csDome: () => merge(X(sphere(0.47, GLASS, 18, 14), 0, 0.03, 0.02), tint(torus(0.4, 0.07, 18), WHITE).map(v => v), X(sphere(0.12, [0.7, 0.85, 1], 8, 6), 0.18, 0.22, 0.36, 0, 0, 0, 1, 0.6, 0.2)),
      csPack: () => merge(BX(0.7, 0.92, 0.12, 0.3, WHITE, 0.2, 0, -0.42), BX(0.14, 0.86, 0.2, 0.12, MAG, 0.4, -0.22, -0.6), BX(0.14, 0.86, 0.2, 0.12, MAG, 0.4, 0.22, -0.6), ...[0.7, 0.55, 0.4].map((y, i) => BX(0.07, y, y - 0.07, 0.03, [RED, GRN, CYAN][i], 0.4, -0.3 + i * 0.1, 0.27))),
      // ---- Dragonscale Plate: horns sweeping back from the helm, a snout ridge; leathery wings on the back
      csHorns: () => merge(...[-1, 1].map(s => X(spikeGeo(0.5, 0.09), s * 0.24, 0.24, -0.02, 0, -1.1, -s * 0.55, 1, 1, 1, MAG)), BX(0.08, 0.36, 0.16, 0.5, MAG, 0.4, 0, 0.08)),
      csWings: () => merge(...[-1, 1].map(s => merge(X(capsule(0.035, 0.02, 0.9, MAG, 6), s * 0.18, 0.78, -0.3, 0, 0, -s * 1.05), X(RB(0.2), s * 0.62, 0.6, -0.34, s * 0.25, 0, -s * 0.3, 0.8, 0.55, 0.03, WHITE),
        X(capsule(0.025, 0.015, 0.6, MAG, 6), s * 0.5, 0.95, -0.32, 0, 0, -s * 2.0)))),
      // ---- Frost Warden: ice crystals growing from the shoulders and a crown of ice
      csIceSpikes: () => merge(...[[-0.05, 0.1, 0.42, 0], [0.12, 0.08, 0.3, 0.4], [-0.2, 0.06, 0.3, -0.4]].map(([z, y, L0, r]) => X(lathe([[0, 0], [0.07, 0.04], [0.05, L0 * 0.7], [0, L0]], 5), -0.24, y, z, 0, r, 0.9, 1, 1, 1, CYAN))),
      csIceCrown: () => merge(tint(torus(0.3, 0.035, 14), CYAN).map(v => v), around(6, a => X(lathe([[0, 0], [0.055, 0.03], [0.035, 0.2], [0, 0.32]], 5), Math.sin(a) * 0.29, 0.3, Math.cos(a) * 0.29, a, 0, 0, 1, a < 0.5 ? 1.3 : 1, 1, CYAN))),
      // ---- Void Knight: curling horns and a hovering ring of shards behind the head
      csVoidHorns: () => merge(...[-1, 1].map(s => merge(X(spikeGeo(0.32, 0.09), s * 0.3, 0.2, 0, 0, 0, -s * 1.2, 1, 1, 1, MAG), X(spikeGeo(0.3, 0.06), s * 0.55, 0.28, 0.02, 0, 0, s * 0.7, 1, 1, 1, MAG)))),
      csVoidHalo: () => around(8, a => X(lathe([[0, 0], [0.04, 0.03], [0, 0.16]], 4), Math.sin(a) * 0.46, 0.08 + Math.cos(a) * 0.46, -0.38, 0, 0, -a, 1, 1, 0.6, WHITE))
    });
    const SKIN_BASE = { plate: [{ b: 'torso', k: 'kChest' }, { b: 'torso', k: 'b7Chest' }, { b: 'torso', k: 'b7ChestG', glow: 1 }, { b: 'ua', k: 'b7Paul', mirror: 1 }, { b: 'ua', k: 'b7PaulG', glow: 1, mirror: 1 }, { b: 'ua', k: 'b7Arm', mirror: 1 },
      { b: 'fa', k: 'b7Bracer', mirror: 1 }, { b: 'th', k: 'b7Thigh', mirror: 1 }, { b: 'sh', k: 'b7Knee', mirror: 1 }, { b: 'pelvis', k: 'kTassets' }, { b: 'fa', k: 'kGauntlet' }, { b: 'sh', k: 'kGreave' }] };
    const limbs = k => [{ b: 'ua', k, mirror: 1 }, { b: 'fa', k, mirror: 1 }, { b: 'th', k, mirror: 1 }, { b: 'sh', k, mirror: 1 }];
    // skin id -> outfit + colours (g1 tint 1, g2 tint 2, glow, shirt, pants, shoes, sleeve, mask)
    const SKINS = CH.SKINS = {
      banana: { fit: { hideHair: 1, parts: [{ b: 'torso', k: 'csBanana' }, { b: 'head', k: 'csBananaTop' }] }, g1: '#f2d23a', g2: '#5a3a1a', shirt: '#f2d23a', pants: '#e2c22a', shoes: '#5a3a1a' },
      slime: { fit: { hideHair: 1, metal: 1, parts: [{ b: 'torso', k: 'csSlimeBody' }, { b: 'head', k: 'csSlimeTop' }] }, g1: '#4ad86a', g2: '#2a8a3e', shirt: '#3ac85a', pants: '#2aa84a', shoes: '#2a8a3e' },
      cardboard: { fit: { hideHair: 1, hideHead: 1, parts: [{ b: 'torso', k: 'csBoxChest' }, { b: 'head', k: 'csBoxHelm' }, { b: 'ua', k: 'csBoxPad', mirror: 1 }] }, g1: '#b88a52', g2: '#8a8a7a', shirt: '#6a5a44', pants: '#4a4034', shoes: '#3a3024' },
      skeleton: { fit: { hideHair: 1, hideHead: 1, parts: [{ b: 'torso', k: 'csRibs' }, { b: 'head', k: 'csSkull' }, ...limbs('csBoneLimb')] }, g1: '#e8e4d8', g2: '#e8e4d8', shirt: '#121216', pants: '#121216', shoes: '#121216' },
      chicken: { fit: { hideHair: 1, parts: [{ b: 'torso', k: 'csChickBody' }, { b: 'ua', k: 'csWing', mirror: 1 }, { b: 'head', k: 'csChickHead' }] }, g1: '#f4f2ec', g2: '#e04a2a', shirt: '#f4f2ec', pants: '#f4f2ec', shoes: '#ff9a2a' },
      pumpkin: { fit: { hideHair: 1, hideHead: 1, parts: [{ b: 'head', k: 'csPumpkin' }, { b: 'torso', k: 'csVine' }] }, g1: '#f2821a', g2: '#3a7a2a', shirt: '#2a2a30', pants: '#3a2a1a', shoes: '#2a1a10' },
      royal: { fit: { sleeve: 'long', parts: [{ b: 'torso', k: 'mRobe' }, { b: 'pelvis', k: 'mSkirt' }, { b: 'torso', k: 'csFur' }, { b: 'head', k: 'csCrown' }] }, g1: '#a01a28', g2: '#e8b84a', shirt: '#a01a28', pants: '#3a1a24', shoes: '#2a1418', cape: '#a01a28' },
      pirate: { fit: { sleeve: 'long', hideHair: 1, parts: [{ b: 'torso', k: 'coatTorso' }, { b: 'pelvis', k: 'coatTails', spring: 'coat' }, { b: 'ua', k: 'coatSleeve' }, { b: 'fa', k: 'coatCuff' }, { b: 'head', k: 'csTricorn' }] }, g1: '#1e2a4a', g2: '#d8b04a', shirt: '#e8e0d0', pants: '#2a2420', shoes: '#1a1410' },
      shadow: { fit: { sleeve: 'long', parts: OUTFITS.ninja.parts }, g1: '#16161c', g2: '#b0141e', shirt: '#16161c', pants: '#16161c', shoes: '#0e0e12', mask: '#16161c' },
      duck: { fit: { parts: [{ b: 'pelvis', k: 'csDuckRing' }, { b: 'head', k: 'csBucket' }] }, g1: '#ffd84a', g2: '#ff8a2a', shirt: '#3ab8ff', pants: '#3ab8ff', shoes: '#ffd84a', sleeve: 'none' },
      ronin: { fit: { sleeve: 'long', metal: 1, noGlow: 1, hideHair: 1, parts: [...SKIN_BASE.plate, { b: 'head', k: 'csKabuto' }] }, g1: '#9a1a1a', g2: '#1a1414', glow: '#ffd84a', shirt: '#1a1414', pants: '#1a1414', shoes: '#1a1414' },
      astro: { fit: { sleeve: 'long', hideHair: 1, hideHead: 1, parts: [{ b: 'torso', k: 'csPack' }, { b: 'torso', k: 'kChest' }, { b: 'head', k: 'csDome' }, { b: 'fa', k: 'kGauntlet' }, { b: 'sh', k: 'kGreave' }] }, g1: '#e8ecf0', g2: '#ff8a2a', shirt: '#e8ecf0', pants: '#e8ecf0', shoes: '#c8ccd4' },
      dragon: { fit: { sleeve: 'long', metal: 1, noGlow: 1, hideHair: 1, parts: [...SKIN_BASE.plate, { b: 'head', k: 'kHelm' }, { b: 'head', k: 'csHorns' }, { b: 'torso', k: 'csWings' }] }, g1: '#5a1414', g2: '#c8a040', glow: '#ff5a1a', shirt: '#2a0e0e', pants: '#2a0e0e', shoes: '#1a0a0a' },
      frost: { fit: { sleeve: 'long', metal: 1, hideHair: 1, parts: [...SKIN_BASE.plate, { b: 'head', k: 'kHelm' }, { b: 'head', k: 'csIceCrown' }, { b: 'ua', k: 'csIceSpikes', mirror: 1 }] }, g1: '#bfe0f8', g2: '#4a7aa8', glow: '#9ae8ff', shirt: '#2a3a52', pants: '#2a3a52', shoes: '#1a2a3a' },
      gilded: { fit: { sleeve: 'long', metal: 1, noGlow: 1, hideHair: 1, parts: OUTFITS.knight.parts }, g1: '#e8b84a', g2: '#fff0b0', glow: '#ffd84a', shirt: '#5a4214', pants: '#5a4214', shoes: '#3a2a0e' },
      voidknight: { fit: { sleeve: 'long', metal: 1, hideHair: 1, parts: [...SKIN_BASE.plate, { b: 'head', k: 'kHelm' }, { b: 'head', k: 'csVoidHorns' }, { b: 'head', k: 'csVoidHalo', glow: 1 }] }, g1: '#16121e', g2: '#3a2a5a', glow: '#b45aff', shirt: '#0e0a14', pants: '#0e0a14', shoes: '#0a0810' }
    };
    for (const id in SKINS) OUTFITS['cs_' + id] = Object.assign({ n: id }, SKINS[id].fit);
    // ---- weapon skins (held like any weapon: the grip at the origin, the business end along +z)
    const pole = (L0, r, col, z0) => X(capsule(r, r, L0, col, 10), 0, 0, z0 || 0, 0, PI / 2, 0);
    const WSK = CH.WSKINS = {
      pan: { sp: 0.3, col: '#2a2a30', gem: '#f4f0e6', gl: '#ffc83a', body: () => merge(pole(0.62, 0.04, [0.18, 0.12, 0.08], -0.08), X(lathe([[0, 0], [0.3, 0], [0.34, 0.08], [0.32, 0.09], [0, 0.025]], 18), 0, 0, 0.86, 0, 0, PI / 2, 1, 1, 1, WHITE), X(sphere(0.15, MAG, 10, 6), -0.03, 0.02, 0.86, 0, 0, 0, 0.25, 1, 1)),
        glow: () => X(sphere(0.07, WHITE, 10, 7), -0.05, 0.02, 0.86, 0, 0, 0, 0.5, 1, 1), tip: [0.55, 1.15] },
      fish: { sp: 0.15, col: '#7aa8c8', gem: '#e8f0f4', gl: '#ffffff', body: () => merge(X(sphere(0.5, WHITE, 14, 10), 0, 0, 0.62, 0, 0, 0, 0.22, 0.36, 1), X(sphere(0.45, MAG, 12, 8), 0, -0.06, 0.62, 0, 0, 0, 0.18, 0.28, 0.9),
          ...[-1, 1].map(s => X(RB(0.3), 0, s * 0.12, 0.05, 0, s * 0.6, 0, 0.04, 0.28, 0.18, WHITE)), X(RB(0.3), 0, 0.3, 0.6, 0, 0.2, 0, 0.03, 0.18, 0.4, WHITE), ...[-1, 1].map(s => X(sphere(0.04, BLK, 8, 6), s * 0.1, 0.08, 1.02))),
        glow: () => X(sphere(0.015, WHITE, 6, 4), 0.11, 0.1, 1.04), tip: [0.3, 1.1] },
      baguette: { sp: 0, col: '#c8904a', gem: '#7a4a1a', gl: '#ffe0a0', body: () => merge(X(capsule(0.085, 0.08, 1.25, WHITE, 12), 0, 0, -0.12, 0, PI / 2, 0), ...[0.15, 0.4, 0.65, 0.9].map(z => X(RB(0.4), 0, 0.075, z, 0, 0.5, 0, 0.09, 0.02, 0.12, MAG))),
        glow: () => X(sphere(0.012, WHITE, 6, 4), 0, 0.09, 0.5), tip: [0.3, 1.1] },
      plunger: { sp: 0.1, col: '#c8241e', gem: '#7a5030', gl: '#ffffff', body: () => merge(pole(0.95, 0.035, [0.5, 0.33, 0.18], -0.1), X(lathe([[0.04, 0], [0.2, 0.05], [0.24, 0.2], [0.2, 0.22], [0, 0.12]], 14), 0, 0, 0.82, 0, PI / 2, 0, 1, 1, 1, WHITE)),
        glow: () => X(sphere(0.012, WHITE, 6, 4), 0, 0, 1.0), tip: [0.4, 1.05] },
      rubberchicken: { sp: 0.1, col: '#f2d23a', gem: '#e8341e', gl: '#ff9a2a', body: () => merge(X(capsule(0.1, 0.13, 0.75, WHITE, 12), 0, 0, 0.1, 0, PI / 2, 0), X(sphere(0.13, WHITE, 12, 8), 0, 0.04, 0.95), X(RB(0.5), 0, 0.17, 0.95, 0, 0, 0, 0.04, 0.12, 0.16, MAG),
          ...[-1, 1].map(s => X(capsule(0.02, 0.02, 0.18, ORG, 6), s * 0.05, 0, -0.1, 0, -PI / 2, 0))),
        glow: () => X(lathe([[0, 0], [0.05, 0.01], [0, 0.12]], 6), 0, 0.02, 1.06, 0, PI / 2, 0), tip: [0.3, 1.1] },
      lollipop: { sp: 0.25, col: '#ff5aa8', gem: '#ffffff', gl: '#ffd8ec', body: () => merge(pole(0.9, 0.035, CREAM, -0.15), X(lathe([[0, 0], [0.32, 0], [0.33, 0.06], [0, 0.07]], 20), 0, 0, 0.98, 0, 0, PI / 2, 1, 1, 1, WHITE),
          ...[0.08, 0.16, 0.24].map(r => X(torus(r, 0.025, 18), -0.04, 0, 0.98, 0, 0, PI / 2, 1, 1, 1, MAG))),
        glow: () => X(sphere(0.05, WHITE, 8, 6), -0.05, 0, 0.98, 0, 0, 0, 0.3, 1, 1), tip: [0.6, 1.3] },
      pixel: { sp: 0, col: '#5ad8ff', gem: '#2a4a8a', gl: '#bff4ff', body: () => { const g = [BX(0.08, 0.04, -0.04, 0.3, [0.35, 0.22, 0.12], 0, 0, -0.06), BX(0.36, 0.06, -0.06, 0.08, MAG, 0, 0, 0.12)];
          for (let i = 0; i < 8; i++) g.push(BX(0.1, 0.05, -0.05, 0.11, WHITE, 0, (i % 2 ? 0.02 : -0.02), 0.22 + i * 0.11)); g.push(BX(0.06, 0.04, -0.04, 0.06, WHITE, 0, 0, 1.13)); return merge(...g); },
        glow: () => BX(0.03, 0.06, -0.06, 0.8, WHITE, 0, 0, 0.62), tip: [0.25, 1.15] },
      broom: { sp: 0, col: '#d8b85a', gem: '#8a2a2a', gl: '#ffe8a0', body: () => merge(pole(1.4, 0.035, [0.4, 0.26, 0.14], -0.3), X(lathe([[0.06, 0], [0.16, 0.08], [0.24, 0.45], [0.2, 0.5], [0, 0.48]], 12), 0, 0, 1.05, 0, PI / 2, 0, 1, 1, 1, WHITE), X(torus(0.08, 0.025, 12), 0, 0, 1.1, 0, PI / 2, 0, 1, 1, 1, MAG)),
        glow: () => X(sphere(0.012, WHITE, 6, 4), 0, 0, 1.3), tip: [0.9, 1.5] },
      crystal: { sp: 0.5, col: '#7ae8ff', gem: '#2a6a9a', gl: '#bff8ff', body: () => merge(X(lathe([[0, 0], [0.16, 0.06], [0.18, 1.2], [0.12, 1.42], [0, 1.66]], 4, { zs: 0.4 }), 0, 0, 0.16, 0, PI / 2, 0, 1, 1, 1, WHITE),
          BX(0.56, 0.08, -0.08, 0.12, MAG, 0.3, 0, 0.14), X(capsule(0.05, 0.05, 0.34, [0.15, 0.2, 0.3], 10), 0, 0, 0.08, 0, -PI / 2, 0), X(G.ico(0.09, 0.1, 3), 0, 0, -0.3, 0, 0, 0, 1, 1, 1, CYAN)),
        glow: () => X(lathe([[0, 0], [0.05, 0.05], [0.05, 1.25], [0, 1.45]], 4, { zs: 1 }), 0, 0, 0.2, 0, PI / 2, 0), tip: [0.3, 1.8] },
      flame: { sp: 0.45, col: '#3a3438', gem: '#ffb03a', gl: '#ff7a1a', body: () => merge(X(lathe([[0, 0], [0.1, 0.04], [0.1, 0.84], [0.07, 0.96], [0, 1.08]], 4, { zs: 0.26 }), 0, 0, 0.13, 0, PI / 2, 0, 1, 1, 1, WHITE),
          BX(0.46, 0.06, -0.06, 0.1, MAG, 0.45, 0, 0.11), X(capsule(0.05, 0.05, 0.27, [0.3, 0.12, 0.08], 10), 0, 0, 0.07, 0, -PI / 2, 0)),
        glow: () => merge(...[0, 1, 2, 3, 4, 5].map(i => X(sphere(0.12 - i * 0.012, WHITE, 8, 6), 0, (i % 2 ? 0.03 : -0.03), 0.3 + i * 0.16, 0, 0, 0, 0.5, 1.3, 1))), tip: [0.25, 1.2] },
      katana: { sp: 0.6, col: '#e8eef4', gem: '#c8a040', gl: '#d8e8ff', body: () => { const g = []; for (let i = 0; i < 6; i++) g.push(X(RB(0.3), 0, i * i * 0.004, 0.2 + i * 0.17, 0, -i * 0.03, 0, 0.04, 0.07, 0.18, WHITE));
          g.push(X(lathe([[0, 0], [0.11, 0], [0.11, 0.02], [0, 0.02]], 12), 0, 0, 0.1, 0, PI / 2, 0, 1, 1, 1, MAG), X(capsule(0.04, 0.04, 0.32, [0.12, 0.1, 0.16], 8), 0, 0, 0.08, 0, -PI / 2, 0)); return merge(...g); },
        glow: () => X(RB(0.3), 0, 0.05, 0.62, 0, -0.08, 0, 0.012, 0.02, 0.95), tip: [0.25, 1.2] },
      reaper: { sp: 0.35, col: '#1a1420', gem: '#5a3a7a', gl: '#c87aff', body: () => { const g = [pole(1.75, 0.04, [0.12, 0.1, 0.14], -0.5)]; for (let i = 0; i < 7; i++) { const a = i / 6 * 1.6; g.push(X(RB(0.3), -Math.sin(a) * 0.55, 0, 1.18 - (1 - Math.cos(a)) * 0.35, 0, 0, a, 0.2 - i * 0.02, 0.05, 0.12, WHITE)); }
          g.push(X(sphere(0.07, MAG, 10, 7), 0, 0, 1.24)); return merge(...g); },
        glow: () => { const g = []; for (let i = 0; i < 7; i++) { const a = i / 6 * 1.6; g.push(X(RB(0.3), -Math.sin(a) * 0.63, 0, 1.12 - (1 - Math.cos(a)) * 0.38, 0, 0, a, 0.04, 0.02, 0.12, WHITE)); } return merge(...g); }, tip: [0.9, 1.3] },
      dragonmaul: { sp: 0.35, col: '#4a1414', gem: '#c8a040', gl: '#ff5a1a', body: () => merge(pole(1.0, 0.05, [0.2, 0.12, 0.08], -0.2), X(RB(0.3), 0, 0, 0.86, 0, 0, 0, 0.66, 0.4, 0.4, WHITE), BX(0.7, 0.22, -0.22, 0.06, MAG, 0.4, 0, 0.86),
          ...[-1, 1].map(s => X(spikeGeo(0.3, 0.07), s * 0.3, 0.18, 0.86, 0, 0, -s * 0.9, 1, 1, 1, MAG))),
        glow: () => X(G.ico(0.11, 0.15, 5), 0, 0, 1.07), tip: [0.6, 1.0] },
      galaxy: { sp: 0.3, col: '#2a2048', gem: '#d8c8ff', gl: '#9ab8ff', body: () => merge(pole(1.7, 0.045, [0.16, 0.12, 0.22], -0.55), X(torus(0.24, 0.03, 18), 0, 0, 1.35, 0, PI / 2, 0, 1, 1, 1, MAG), BX(0.14, 0.05, -0.05, 0.14, MAG, 0.4, 0, 1.1)),
        glow: () => merge(X(sphere(0.13, WHITE, 12, 8), 0, 0, 1.35), ...[0, 2.1, 4.2].map(a => X(G.ico(0.045, 0.1, 2), Math.cos(a) * 0.24, Math.sin(a) * 0.24, 1.35))), tip: [1.1, 1.5], orb: [0, 0, 1.35] },
      guitar: { sp: 0.25, col: '#c8241e', gem: '#f4f0e6', gl: '#ffd84a', body: () => merge(BX(0.08, 0.03, -0.03, 0.82, [0.3, 0.18, 0.08], 0.2, 0, 0.35), BX(0.12, 0.04, -0.04, 0.2, [0.15, 0.1, 0.06], 0.2, 0, -0.12),
          X(sphere(0.26, WHITE, 14, 10), 0, 0, 0.9, 0, 0, 0, 0.42, 1, 0.82), X(sphere(0.21, WHITE, 14, 10), 0, 0, 1.2, 0, 0, 0, 0.42, 1, 0.75), X(sphere(0.06, BLK, 10, 6), 0.1, 0, 0.98, 0, 0, 0, 0.2, 1, 1),
          ...[-0.03, -0.01, 0.01, 0.03].map(y => BX(0.006, y + 0.003, y - 0.003, 1.05, MAG, 0, 0.06, 0.55))),
        glow: () => merge(BX(0.02, 0.07, -0.07, 0.05, WHITE, 0.3, 0.1, 0.8), BX(0.02, 0.07, -0.07, 0.05, WHITE, 0.3, 0.1, 0.9)), tip: [0.6, 1.4] },
      dawn: { sp: 0.55, col: '#f0c85a', gem: '#fff4c0', gl: '#ffd84a', body: () => merge(X(lathe([[0, 0], [0.2, 0.06], [0.21, 1.4], [0.15, 1.6], [0, 1.85]], 4, { zs: 0.22 }), 0, 0, 0.18, 0, PI / 2, 0, 1, 1, 1, WHITE),
          X(capsule(0.06, 0.06, 0.4, [0.3, 0.2, 0.1], 10), 0, 0, 0.1, 0, -PI / 2, 0), X(sphere(0.09, MAG, 10, 7), 0, 0, -0.36)),
        glow: () => merge(X(lathe([[0, 0], [0.22, 0], [0.22, 0.05], [0, 0.05]], 18), 0, 0, 0.14, 0, PI / 2, 0), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => X(spikeGeo(0.16, 0.04), Math.cos(i / 8 * TAU) * 0.24, Math.sin(i / 8 * TAU) * 0.24, 0.16, 0, 0, i / 8 * TAU - PI / 2))), tip: [0.35, 2.0] }
    };
    for (const id in WSK) WEAPONS['ws_' + id] = { n: id, body: WSK[id].body, glow: WSK[id].glow, tip: WSK[id].tip, orb: WSK[id].orb, spec: WSK[id].sp, flat: 1 };   // sp: its own shine (wood, bread and rubber don't shine like steel); flat: no wrap light or full rim (they washed dark skins out to white)
    // what a look looks like with skins on: sk = [armour skin id, weapon skin id] (from the gear look)
    CH.applySkins = (o, sk) => { if (!Array.isArray(sk)) return o;
      const a = SKINS[sk[0]]; if (a) { o.outfit = 'cs_' + sk[0]; o.gear1 = a.g1; o.gear2 = a.g2; o.glow = a.glow || a.g2; delete o.helm; delete o.glove; delete o.boot; o.rar = 0;
        for (const k of ['shirt', 'pants', 'shoes', 'mask']) if (a[k]) o[k] = a[k]; o.sleeve = a.sleeve || (a.fit.sleeve === 'long' ? 'long' : o.sleeve); o.pattern = 'plain'; o.shorts = false; if (a.cape) { o.cape = 'cape'; o.capeC = a.cape; } }
      const w = WSK[sk[1]]; if (w) { o.wpn = 'ws_' + sk[1]; delete o.wtier; o.weapon = w.col; o.gem = w.gem; o.wglow = w.gl; o.off = ''; }
      return o; };
    const HG = {}; CH.tierHelmGlow = t => { if (HG[t] === undefined) { const g = tierHelmGlow(t); HG[t] = g ? E.mesh(g) : null; } return HG[t]; };
    function capeGeo() { // hangs from the upper back, curved, 2-sided; clasps = tint 2
      const a = [], W = 0.92, H = 1.25, nx = 8, ny = 8;
      const P = (i, j) => { const u = i / nx, v = j / ny, x = (u - 0.5) * W * (1 + v * 0.3), z = -Math.cos((u - 0.5) * PI) * 0.06 - v * 0.05, y = -v * H; return [[x, y, z], norm([0, 0.1, -1]), u, v]; };
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), Dd = P(i, j + 1); for (const q of [A, B, C, A, C, Dd]) vtx(a, q[0], q[1], WHITE, q[2], q[3]); }
      return merge(a, X(sphere(0.065, MAG, 10, 7), -W / 2 + 0.06, 0, 0.03), X(sphere(0.065, MAG, 10, 7), W / 2 - 0.06, 0, 0.03));
    }
    // ================================================================ HAIR (shells + strands that follow the block head)
    // cap down to a hairline: yF = hairline height at the forehead, yB = at the back, dip = how far it comes down over the ears
    function hairCap(yF, yB, rr, dip) {
      const seg = 36, rows = 10, a = [];
      const e = phi => elOf(lerp(yF, yB, (1 - Math.cos(phi)) / 2) - (dip || 0) * Math.pow(Math.sin(phi), 2));
      const P = (i, j, k) => { const phi = -PI + TAU * i / seg, e0 = e(phi), el = e0 + (PI / 2 - e0) * Math.pow(j / rows, 0.8); return [surfE(phi, el, k), surfNE(phi, el)]; };
      for (let i = 0; i < seg; i++) for (let j = 0; j < rows; j++) { const A = P(i, j, rr), B = P(i + 1, j, rr), C = P(i + 1, j + 1, rr), Dd = P(i, j + 1, rr); for (const q of [A, B, C, A, C, Dd]) vtx(a, q[0], q[1], WHITE, 0, 0); }
      for (let i = 0; i < seg; i++) { // a thick rolled edge
        const p0 = -PI + TAU * i / seg, p1 = -PI + TAU * (i + 1) / seg, o0 = surfE(p0, e(p0), rr), o1 = surfE(p1, e(p1), rr), i0 = surfE(p0, e(p0) + 0.12, 0.97), i1 = surfE(p1, e(p1) + 0.12, 0.97), n0 = [0, -1, 0];
        for (const q of [o0, o1, i1, o0, i1, i0]) vtx(a, q, n0, WHITE, 0, 0);
      }
      return G.fix(a);
    }
    const strandGeo = (L, w) => lathe([[0, -L], [w * 0.42, -L * 0.9], [w * 0.82, -L * 0.62], [w, -L * 0.28], [w * 0.92, -0.02], [w * 0.5, w * 0.28], [0, w * 0.36]], 12, { zs: 0.5 });
    const spikeGeo = (L, w) => lathe([[0, -0.02], [w, 0], [w * 0.75, L * 0.4], [w * 0.38, L * 0.75], [0, L]], 9, { zs: 0.7 });
    // a strand hanging down over the head at (phi, height y); tilt lifts the tip off, roll fans it sideways
    function onHead(geo, phi, y, rr, tilt, roll, sc, col) { const m = frame(surf(phi, y, rr), surfUp(phi, y), surfN(phi, y)); return G.xf(geo, mul(m, T(0, 0, 0, 0, -(tilt || 0), roll || 0, sc || 1, sc || 1, sc || 1)), col); }
    // a spike sticking out of the head: back = leans toward the back, up = leans up
    function outHead(geo, phi, y, rr, back, up, sc, col) { const n = surfN(phi, y), bk = [-Math.sin(phi), 0, -Math.cos(phi)], d = norm([n[0] + bk[0] * (back || 0), n[1] + (up || 0), n[2] + bk[2] * (back || 0)]); return G.xf(geo, mul(frame(surf(phi, y, rr), d, [0, 0.3, 1]), T(0, 0, 0, 0, 0, 0, sc || 1, sc || 1, sc || 1)), col); }
    function bangs(n, span, y, L, w, rr, tilt, sweep, jit) { const g = []; for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : i / (n - 1) - 0.5, phi = k * span, j = jit ? Math.sin(i * 2.7) * jit : 0; g.push(onHead(strandGeo(L * (1 - Math.abs(k) * 0.25) * (1 + j), w), phi, y, rr, tilt, -k * 0.5 + (sweep || 0) + j, 1)); } return merge(...g); }
    const HAIR = {
      messy: () => { // anime hero hair: lots of strands, side locks, tufts on top
        const g = [hairCap(0.15, -0.24, 1.08, 0.16), bangs(8, 1.45, 0.2, 0.2, 0.075, 1.08, 0.12, 0.15, 0.25)];
        for (const s of [-1, 1]) { g.push(onHead(strandGeo(0.3, 0.085), s * 1.05, 0.08, 1.08, 0.08, s * 0.1)); g.push(onHead(strandGeo(0.26, 0.08), s * 1.45, 0.06, 1.07, 0.08, s * -0.05)); }
        const tufts = [[0.2, 0.28, 0.2, 0.08, 1.2, 0.9], [-0.35, 0.28, 0.22, 0.08, 1.4, 0.8], [0.7, 0.24, 0.2, 0.08, 1.6, 0.4], [-0.9, 0.24, 0.22, 0.08, 1.6, 0.3], [1.6, 0.2, 0.2, 0.08, 1.5, 0.1], [-1.7, 0.2, 0.2, 0.08, 1.5, 0.1], [2.5, 0.2, 0.22, 0.09, 1.0, -0.3], [-2.5, 0.2, 0.22, 0.09, 1.0, -0.3], [PI, 0.12, 0.22, 0.09, 0.8, -0.6]];
        for (const [phi, y, L, w, back, up] of tufts) g.push(outHead(spikeGeo(L, w), phi, y, 1.0, back, up));
        for (const k of [-0.5, -0.17, 0.17, 0.5]) g.push(onHead(strandGeo(0.24, 0.09), PI + k, -0.12, 1.07, 0.25, k * 0.5));
        return { geo: merge(...g) }; },
      spiky: () => {
        const g = [hairCap(0.17, -0.2, 1.08, 0.14), bangs(6, 1.3, 0.21, 0.16, 0.08, 1.08, 0.18)];
        const sp = [[0, 0.29, 0.3, 0.1, 0.5, 0.6], [0.6, 0.27, 0.27, 0.09, 0.8, 0.4], [-0.6, 0.27, 0.27, 0.09, 0.8, 0.4], [1.4, 0.2, 0.24, 0.09, 1.0, 0], [-1.4, 0.2, 0.24, 0.09, 1.0, 0], [2.2, 0.2, 0.25, 0.09, 1.1, -0.2], [-2.2, 0.2, 0.25, 0.09, 1.1, -0.2], [PI, 0.12, 0.25, 0.1, 1.0, -0.4], [2.8, 0.27, 0.27, 0.1, 0.9, 0.2], [-2.8, 0.27, 0.27, 0.1, 0.9, 0.2]];
        for (const [phi, y, L, w, back, up] of sp) g.push(outHead(spikeGeo(L, w), phi, y, 1.0, back, up));
        return { geo: merge(...g) }; },
      bob: () => ({ geo: merge(hairCap(0.19, -0.05, 1.08, -0.05), X(lathe([[0.3, 0.1], [0.34, 0], [0.35, -0.12], [0.34, -0.22], [0.3, -0.26], [0.27, -0.22]], 26, { a0: 0.9, a1: TAU - 0.9 }), 0, 0, 0, 0, 0, 0, 1.08, 1, 1.05), bangs(8, 1.5, 0.22, 0.19, 0.075, 1.08, 0.08)) }),
      ponytail: () => { const g = [hairCap(0.16, -0.18, 1.08, 0.14), bangs(6, 1.35, 0.21, 0.19, 0.08, 1.08, 0.1, 0.25)];
        const tie = surf(PI, 0.16, 1.1); g.push(X(G.torus(1, 0.38, 14, 8), tie[0], tie[1], tie[2] - 0.015, 0, PI / 2 + 0.4, 0, 0.065, 0.065, 0.065, MAG));
        return { geo: merge(...g), tail: { pos: [tie[0], tie[1] - 0.01, tie[2] - 0.06], segs: [mesh('ptail1', () => strandGeo(0.34, 0.12)), mesh('ptail2', () => strandGeo(0.32, 0.1))], len: 0.3 } }; },
      curly: () => { const g = [hairCap(0.18, -0.18, 1.06, 0.12)]; let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 52; i++) { const phi = -PI + rnd() * TAU, y = lerp(0.18, -0.15, (1 - Math.cos(phi)) / 2) + 0.03 + rnd() * 0.3; if (Math.abs(phi) < 0.85 && y < 0.24) continue; if (y > HB[1]) continue;
          const p = surf(phi, y, 1.07); g.push(X(sphere(0.085 + rnd() * 0.04, WHITE, 10, 7), p[0], p[1], p[2])); }
        g.push(bangs(6, 1.3, 0.23, 0.13, 0.085, 1.08, 0.3)); return { geo: merge(...g) }; },
      buns: () => { const g = [hairCap(0.18, -0.2, 1.08, 0.14), bangs(6, 1.35, 0.22, 0.17, 0.08, 1.08, 0.12)];
        for (const s of [-1, 1]) { const p = surf(s * 0.9, 0.29, 1.08); g.push(X(sphere(0.15, WHITE, 16, 10), p[0], p[1] + 0.07, p[2] - 0.02)); g.push(X(G.torus(1, 0.32, 14, 7), p[0], p[1] + 0.0, p[2] - 0.02, 0, 0, s * -0.4, 0.1, 0.1, 0.1, MAG)); }
        return { geo: merge(...g) }; }
    };
    CH.hairStyles = Object.keys(HAIR);
    const hairCache = {};
    const hairOf = st => hairCache[st] || (hairCache[st] = (() => { const h = (HAIR[st] || HAIR.messy)(); return { m: E.mesh(h.geo), tail: h.tail }; })());

    // ================================================================ COLOURS
    const hex = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    const rgb = (c, k, a) => `rgba(${clamp(c[0] * k, 0, 255) | 0},${clamp(c[1] * k, 0, 255) | 0},${clamp(c[2] * k, 0, 255) | 0},${a === undefined ? 1 : a})`;

    // ================================================================ FACES
    // expression: eye shape, brows [inner, outer] (+ = lower), mouth, extras
    const EXPR = CH.EXPR = {
      serious:    { eye: 'open', lid: 0.3, brow: [6, -2], mouth: 'set' },
      smirk:      { eye: 'open', lid: 0.22, brow: [4, -4], mouth: 'smirk' },
      happy:      { eye: 'open', brow: [0, 0], mouth: 'smile' },
      excited:    { eye: 'sparkle', brow: [-7, -7], mouth: 'grin', big: 1.08 },
      determined: { eye: 'open', lid: 0.34, brow: [9, -5], mouth: 'set' },
      surprised:  { eye: 'wide', brow: [-12, -10], mouth: 'o' },
      sad:        { eye: 'open', lid: 0.12, low: 0.14, brow: [-9, 7], mouth: 'frown', tear: 1, wet: 1 },
      angry:      { eye: 'open', lid: 0.42, slant: 1, brow: [13, -7], mouth: 'teeth' },
      sleepy:     { eye: 'open', lid: 0.62, brow: [3, 5], mouth: 'small' },
      cheeky:     { eye: 'wink', brow: [-5, -7], mouth: 'tongue' },
      laugh:      { eye: 'arc', brow: [-7, -5], mouth: 'grin' },
      cry:        { eye: 'shut', brow: [-11, 8], mouth: 'wobble', streams: 1 },
      hurt:       { eye: 'xx', brow: [9, 0], mouth: 'zigzag' },
      blink:      { eye: 'closed', brow: [0, 0], mouth: 'smile' }
    };
    CH.expressions = Object.keys(EXPR).filter(k => k !== 'blink');
    const EYE_STYLES = CH.eyeStyles = ['sharp', 'round', 'big', 'calm', 'cat', 'dot'];
    function paintFace(g, f) {
      const W = 256, cx = 128, ey = 148, ex = 45, skin = hex(f.skin), eyeC = hex(f.eye), brow = hex(f.brow), sp = EXPR[f.expr] || EXPR.happy;
      g.clearRect(0, 0, W, W); g.fillStyle = rgb(skin, 1 / 1.12); g.fillRect(0, 0, W, W);
      // cheeks + tiny nose
      if (f.blush) for (const s of [-1, 1]) { const gr = g.createRadialGradient(cx + s * 68, ey + 34, 2, cx + s * 68, ey + 34, 26); gr.addColorStop(0, sp.mouth === 'teeth' ? 'rgba(255,70,60,0.55)' : 'rgba(255,105,120,0.5)'); gr.addColorStop(1, 'rgba(255,105,120,0)'); g.fillStyle = gr; g.fillRect(cx + s * 68 - 30, ey + 4, 60, 60); }
      if (f.freckles) { g.fillStyle = rgb(skin, 0.62, 0.7); for (const s of [-1, 1]) for (const [dx, dy] of [[-8, -4], [2, 2], [10, -3], [-2, 8]]) { g.beginPath(); g.arc(cx + s * 64 + dx, ey + 24 + dy, 2.2, 0, TAU); g.fill(); } }
      g.strokeStyle = rgb(skin, 0.7, 0.55); g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(cx, ey + 22, 4, 0.2 * PI, 0.8 * PI); g.stroke();
      const lx = f.lx || 0, ly = f.ly || 0, style = f.eyeStyle || 'round';
      for (const s of [-1, 1]) {
        const x = cx + s * ex; let kind = sp.eye;
        if (kind === 'wink') kind = s < 0 ? 'arc' : 'open';
        if (f.blink && (kind === 'open' || kind === 'sparkle' || kind === 'wide')) kind = 'closed';
        drawEye(g, x, ey, s, kind, sp, style, eyeC, skin, lx, ly);
      }
      // brows: thick rounded strokes, inner end near the middle
      if (style !== 'dot' || true) { g.strokeStyle = rgb(brow, 0.85); g.lineWidth = 8; g.lineCap = 'round';
        for (const s of [-1, 1]) { const x = cx + s * ex, by = ey - 42; const ix = x - s * 15, ox = x + s * 17, iy = by + sp.brow[0], oy = by + sp.brow[1];
          g.beginPath(); g.moveTo(ix, iy); g.quadraticCurveTo((ix + ox) / 2, Math.min(iy, oy) - 6, ox, oy); g.stroke(); } }
      if (f.mask) { const mc = hex(f.mask); g.fillStyle = rgb(mc, 1 / 1.12); g.beginPath(); g.moveTo(0, ey + 22); g.quadraticCurveTo(cx, ey + 10, W, ey + 22); g.lineTo(W, W); g.lineTo(0, W); g.closePath(); g.fill();
        g.strokeStyle = rgb(mc, 0.6); g.lineWidth = 3; g.beginPath(); g.moveTo(0, ey + 22); g.quadraticCurveTo(cx, ey + 10, W, ey + 22); g.stroke(); g.strokeStyle = rgb(mc, 0.75, 0.6); g.lineWidth = 2; for (const x of [cx - 30, cx + 30]) { g.beginPath(); g.moveTo(x, ey + 24); g.lineTo(x + (x < cx ? -6 : 6), W); g.stroke(); } }
      else drawMouth(g, cx, ey + 46, sp.mouth, skin);
      if (sp.tear) { g.fillStyle = 'rgba(120,200,255,0.9)'; g.beginPath(); const tx = cx + ex + 14, ty = ey + 30; g.moveTo(tx, ty - 9); g.quadraticCurveTo(tx + 7, ty + 2, tx, ty + 6); g.quadraticCurveTo(tx - 7, ty + 2, tx, ty - 9); g.fill(); }
      if (sp.streams) { g.fillStyle = 'rgba(120,200,255,0.85)'; for (const s of [-1, 1]) { const x = cx + s * ex; g.beginPath(); g.moveTo(x - 7, ey + 6); g.quadraticCurveTo(x - 9 + s * 3, ey + 40, x - 5 + s * 6, ey + 70); g.lineTo(x + 7 + s * 6, ey + 70); g.quadraticCurveTo(x + 9 + s * 3, ey + 40, x + 7, ey + 6); g.closePath(); g.fill(); } }
    }
    function drawEye(g, x, y, s, kind, sp, style, eyeC, skin, lx, ly) {
      const ink = '#16121a', big = (sp.big || 1) * (style === 'big' ? 1.12 : style === 'calm' ? 0.95 : 1);
      if (style === 'sharp') sp = Object.assign({}, sp, { lid: Math.max(sp.lid || 0, 0.28), slant: sp.slant || (sp.lid ? 0 : 1) });
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (kind === 'closed') { g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(x - 17, y - 2); g.quadraticCurveTo(x, y + 12, x + 17, y - 2); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(x + s * 17, y - 2); g.lineTo(x + s * 23, y - 6); g.stroke(); return; }
      if (kind === 'arc') { g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 17, y + 6); g.quadraticCurveTo(x, y - 16, x + 17, y + 6); g.stroke(); return; }
      if (kind === 'shut') { g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(x - 17, y); g.quadraticCurveTo(x, y + 9, x + 17, y); g.stroke(); g.beginPath(); g.moveTo(x - s * 5, y + 6); g.lineTo(x - s * 9, y + 13); g.moveTo(x + s * 6, y + 6); g.lineTo(x + s * 9, y + 13); g.lineWidth = 3; g.stroke(); return; }
      if (kind === 'xx') { g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(x + s * 13, y - 13); g.lineTo(x - s * 9, y); g.lineTo(x + s * 13, y + 13); g.stroke(); return; }
      if (style === 'dot') { g.fillStyle = ink; g.beginPath(); g.ellipse(x + lx * 3, y + ly * 3, 9 * big, (kind === 'wide' ? 15 : 12) * big, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + lx * 3 - 3, y + ly * 3 - 5, 3.2, 0, TAU); g.fill(); return; }
      const rx = (kind === 'wide' ? 21 : style === 'sharp' ? 20 : 19) * big, ry = (kind === 'wide' ? 28 : style === 'sharp' ? 20 : style === 'cat' ? 23 : 26) * big;
      g.save(); g.beginPath(); g.ellipse(x, y, rx, ry, style === 'cat' ? -s * 0.25 : 0, 0, TAU); g.clip();
      // white with a soft shadow under the lid
      const wg = g.createLinearGradient(0, y - ry, 0, y + ry); wg.addColorStop(0, '#d9dbe8'); wg.addColorStop(0.35, '#ffffff'); wg.addColorStop(1, '#ffffff'); g.fillStyle = wg; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
      const irx = rx * (kind === 'wide' ? 0.62 : 0.84), iry = ry * (kind === 'wide' ? 0.6 : 0.84), ix = x + lx * rx * 0.22, iy = y + ly * ry * 0.16 + (kind === 'wide' ? 0 : 2);
      const ig = g.createLinearGradient(0, iy - iry, 0, iy + iry); ig.addColorStop(0, rgb(eyeC, 0.42)); ig.addColorStop(0.55, rgb(eyeC, 1)); ig.addColorStop(1, rgb(eyeC, 1.45));
      g.fillStyle = ig; g.beginPath(); g.ellipse(ix, iy, irx, iry, 0, 0, TAU); g.fill();
      g.strokeStyle = rgb(eyeC, 0.35, 0.8); g.lineWidth = 2; g.stroke();
      g.fillStyle = '#1b0f1c'; g.beginPath(); g.ellipse(ix, iy + 1, irx * (style === 'cat' ? 0.22 : kind === 'wide' ? 0.36 : 0.48), iry * (kind === 'wide' ? 0.4 : 0.55), 0, 0, TAU); g.fill();
      if (kind === 'sparkle') { star(g, ix - irx * 0.12, iy - iry * 0.18, irx * 0.62, '#ffffff'); star(g, ix + irx * 0.42, iy + iry * 0.42, irx * 0.24, '#ffffff'); }
      else { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ix - irx * 0.34, iy - iry * 0.4, irx * 0.4, iry * 0.33, -0.4, 0, TAU); g.fill(); g.beginPath(); g.arc(ix + irx * 0.38, iy + iry * 0.38, irx * 0.17, 0, TAU); g.fill();
        if (sp.wet) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(ix, iy + iry * 0.62, irx * 0.75, iry * 0.18, 0, 0, TAU); g.fill(); } }
      // eyelids for determined / angry / sleepy / sad
      g.fillStyle = rgb(skin, 1 / 1.12); const top = y - ry, lidY = top + ry * 2 * (sp.lid || 0);
      if (sp.lid) { g.beginPath(); if (sp.slant) { g.moveTo(x - rx - 2, top - 2); g.lineTo(x + rx + 2, top - 2); g.lineTo(x + rx + 2, lidY + s * 7); g.lineTo(x - rx - 2, lidY - s * 7); } else { g.rect(x - rx - 2, top - 2, rx * 2 + 4, lidY - top + 2); } g.fill(); }
      if (sp.low) { const lowY = y + ry - ry * 2 * sp.low; g.fillRect(x - rx - 2, lowY, rx * 2 + 4, ry * 2); }
      g.restore();
      // lash line along the top edge (follows the lid) + a little flick at the outer corner
      g.strokeStyle = '#2a1622'; g.lineWidth = 6;
      if (sp.lid) { g.beginPath(); if (sp.slant) { g.moveTo(x - rx, lidY - s * 7 * (1 - 0)); g.lineTo(x + rx, lidY + s * 7); } else { const w = Math.sqrt(Math.max(0, 1 - Math.pow((lidY - y) / ry, 2))) * rx; g.moveTo(x - w, lidY); g.lineTo(x + w, lidY); } g.stroke(); }
      else { g.beginPath(); g.ellipse(x, y, rx, ry, style === 'cat' ? -s * 0.25 : 0, PI + 0.25, TAU - 0.25); g.stroke(); }
      g.lineWidth = 4; g.beginPath(); const fx = x + s * rx * 0.92, fy = sp.lid ? lidY + (sp.slant ? s * 7 : 0) : y - ry * 0.5; g.moveTo(fx, fy); g.lineTo(fx + s * 8, fy - 7); g.stroke();
      g.lineWidth = 2; g.strokeStyle = 'rgba(42,22,34,0.35)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0.35, PI - 0.35); g.stroke();
    }
    function star(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - PI / 2, k = i % 2 ? r * 0.32 : r; g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); } g.closePath(); g.fill(); }
    function drawMouth(g, x, y, m, skin) {
      const ink = '#3b1418'; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 5.5;
      if (m === 'smile') { g.beginPath(); g.moveTo(x - 15, y - 4); g.quadraticCurveTo(x, y + 12, x + 15, y - 4); g.stroke(); }
      else if (m === 'grin' || m === 'wobble') {
        g.beginPath(); g.moveTo(x - 22, y - 7);
        if (m === 'wobble') { g.quadraticCurveTo(x - 11, y - 12, x, y - 7); g.quadraticCurveTo(x + 11, y - 12, x + 22, y - 7); g.quadraticCurveTo(x, y + 14, x - 22, y - 7); }
        else { g.quadraticCurveTo(x, y - 3, x + 22, y - 7); g.quadraticCurveTo(x + 18, y + 24, x, y + 24); g.quadraticCurveTo(x - 18, y + 24, x - 22, y - 7); }
        g.closePath(); g.fill(); g.save(); g.clip();
        if (m === 'grin') { g.fillStyle = '#fff'; g.fillRect(x - 24, y - 12, 48, 9); }
        g.fillStyle = '#ff6b7f'; g.beginPath(); g.ellipse(x, y + (m === 'grin' ? 21 : 10), 13, 9, 0, 0, TAU); g.fill(); g.restore();
      }
      else if (m === 'smirk') { g.beginPath(); g.moveTo(x - 11, y + 2); g.quadraticCurveTo(x + 4, y + 5, x + 13, y - 5); g.stroke(); }
      else if (m === 'set') { g.beginPath(); g.moveTo(x - 12, y + 1); g.quadraticCurveTo(x + 2, y + 3, x + 13, y - 3); g.stroke(); }
      else if (m === 'o') { g.beginPath(); g.ellipse(x, y + 4, 9, 12, 0, 0, TAU); g.fill(); g.fillStyle = '#ff6b7f'; g.beginPath(); g.ellipse(x, y + 10, 6, 4, 0, 0, TAU); g.fill(); }
      else if (m === 'frown') { g.beginPath(); g.moveTo(x - 13, y + 6); g.quadraticCurveTo(x, y - 6, x + 13, y + 6); g.stroke(); }
      else if (m === 'teeth') { g.beginPath(); g.moveTo(x - 17, y + 6); g.quadraticCurveTo(x, y - 8, x + 17, y + 6); g.lineTo(x + 15, y + 11); g.quadraticCurveTo(x, y + 2, x - 15, y + 11); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x - 12, y + 6); g.quadraticCurveTo(x, y - 2, x + 12, y + 6); g.stroke(); }
      else if (m === 'small') { g.beginPath(); g.ellipse(x, y + 2, 5, 4, 0, 0, TAU); g.fill(); }
      else if (m === 'tongue') { g.beginPath(); g.moveTo(x - 15, y - 4); g.quadraticCurveTo(x, y + 10, x + 15, y - 4); g.stroke(); g.fillStyle = '#ff6b7f'; g.beginPath(); g.moveTo(x + 1, y + 4); g.quadraticCurveTo(x + 2, y + 18, x + 9, y + 17); g.quadraticCurveTo(x + 15, y + 15, x + 12, y + 2); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = 2.5; g.stroke(); }
      else if (m === 'zigzag') { g.beginPath(); g.moveTo(x - 15, y + 3); for (let i = 1; i <= 6; i++) g.lineTo(x - 15 + i * 5, y + (i % 2 ? -3 : 3)); g.stroke(); }
    }
    // face textures are cached: a face only repaints when its expression, blink or look direction changes
    const faceCache = new Map(), fcv = document.createElement('canvas'); fcv.width = fcv.height = 256; const fg = fcv.getContext('2d');
    function faceTex(f) {
      const key = [f.skin, f.eye, f.brow, f.eyeStyle, f.expr, f.blink ? 1 : 0, f.lx, f.ly, f.freckles ? 1 : 0, f.mask || '', f.blush ? 1 : 0].join('|');
      let t = faceCache.get(key); if (t) { faceCache.delete(key); faceCache.set(key, t); return t; }
      paintFace(fg, f); t = E.canvasTex(fcv); faceCache.set(key, t);
      if (faceCache.size > 120) { const k0 = faceCache.keys().next().value; E.freeTex(faceCache.get(k0)); faceCache.delete(k0); }
      return t;
    }
    CH.paintFace = paintFace;

    // ================================================================ OUTFIT TEXTURE (shirt)
    const PATTERNS = CH.patterns = ['plain', 'stripes', 'stars', 'camo', 'split'];
    const shirtCache = new Map(), scv = document.createElement('canvas'); scv.width = scv.height = 256; const sg = scv.getContext('2d');
    function paintShirt(g, o) {
      const c = hex(o.shirt), c2 = hex(o.shirt2 || '#ffffff'), W = 256, top = 16;
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, top); // reserved white corner (neck samples it)
      g.fillStyle = rgb(c, 1 / 1.12); g.fillRect(0, top, W, W - top);
      const p = o.pattern || 'plain';
      if (p === 'stripes') { g.fillStyle = rgb(c2, 1 / 1.12, 0.9); for (let y = top + 30; y < W - 20; y += 34) g.fillRect(0, y, W, 13); }
      if (p === 'stars') { for (let i = 0; i < 26; i++) { const x = (i * 97) % W, y = top + 20 + ((i * 53) % (W - top - 40)); star(g, x, y, 10, rgb(c2, 1 / 1.12, 0.9)); } }
      if (p === 'camo') { for (let i = 0; i < 40; i++) { g.fillStyle = rgb(c, [0.75, 1.2, 0.9][i % 3] / 1.12); g.beginPath(); g.ellipse((i * 71) % W, top + (i * 37) % (W - top), 18 + (i % 4) * 6, 11 + (i % 3) * 5, i, 0, TAU); g.fill(); } }
      if (p === 'split') { g.fillStyle = rgb(c2, 1 / 1.12); g.fillRect(0, top, W / 2, W - top); }
      // collar (front), hem, sleeve-side seams and a chest emblem: a little slime
      g.fillStyle = rgb(c2, 1 / 1.12); g.beginPath(); g.moveTo(88, top); g.quadraticCurveTo(128, top + 52, 168, top); g.lineTo(156, top); g.quadraticCurveTo(128, top + 34, 100, top); g.closePath(); g.fill();
      g.fillRect(0, W - 16, W, 16); g.fillStyle = rgb(c, 0.8 / 1.12); g.fillRect(0, W - 18, W, 3);
      g.fillStyle = 'rgba(0,0,0,0.08)'; for (const x of [64, 192]) g.fillRect(x - 1, top, 3, W - top);
      if (o.emblem === true) { const ex = 128, ey = 118; g.fillStyle = rgb(c2, 1 / 1.12); g.beginPath(); g.arc(ex, ey, 25, 0, TAU); g.fill();
        g.fillStyle = '#6fe06a'; g.beginPath(); g.moveTo(ex - 17, ey + 12); g.quadraticCurveTo(ex - 18, ey - 16, ex, ey - 17); g.quadraticCurveTo(ex + 18, ey - 16, ex + 17, ey + 12); g.closePath(); g.fill();
        g.fillStyle = '#1b0f1c'; g.beginPath(); g.arc(ex - 6, ey - 2, 3, 0, TAU); g.arc(ex + 6, ey - 2, 3, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 9, ey - 9, 3.5, 0, TAU); g.fill(); }
    }
    function shirtTex(o) {
      const key = [o.shirt, o.shirt2, o.pattern, o.emblem].join('|');
      let t = shirtCache.get(key); if (t) return t;
      paintShirt(sg, o); t = E.canvasTex(scv); shirtCache.set(key, t);
      if (shirtCache.size > 60) { const k0 = shirtCache.keys().next().value; E.freeTex(shirtCache.get(k0)); shirtCache.delete(k0); }
      return t;
    }

    // ================================================================ LOOKS
    CH.defaultLook = () => ({ skin: '#f5c9a6', hair: 'messy', hairC: '#1a181e', hairC2: '#8a1a24', eye: '#6a7a90', eyeStyle: 'sharp', freckles: false, mask: null,
      shirt: '#2a2d36', shirt2: '#15161b', pattern: 'plain', sleeve: 'short', pants: '#1c1e25', shorts: false, shoes: '#18181c', shape: 'regular', height: 1, head: 1, cape: null,
      outfit: 'tee', gear1: '#6a4a30', gear2: '#3a2a20', glow: '#5fe0ff', wpn: 'sword', weapon: '#dfe9f5', gem: '#4fd2ff' });

    // ================================================================ POSES + ANIMATIONS
    // pose keys (radians unless noted): y (bob, units) sq (squash) lean twist side htw hro (hip twist/roll) rp rr (whole-body pitch/roll around the waist) spin
    // hx hy hz (head), r_* / l_* arms: f fwd, o out, y sweep, t twist, e elbow; rl_* / ll_* legs: f fwd, o out, k knee, a ankle; wg (blade up) wr (blade roll); nf (no flat feet)
    const KEYS = CH.KEYS = ['y', 'sq', 'lean', 'twist', 'side', 'htw', 'hro', 'rp', 'rr', 'spin', 'hx', 'hy', 'hz', 'r_f', 'r_o', 'r_y', 'r_t', 'r_e', 'l_f', 'l_o', 'l_y', 'l_t', 'l_e',
      'rl_f', 'rl_o', 'rl_k', 'rl_a', 'll_f', 'll_o', 'll_k', 'll_a', 'wg', 'wr', 'nf', 'l_g'];
    function lerpPose(a, b, k, keys) { const o = keys ? Object.assign({}, a) : {}; for (const key of keys || KEYS) { const va = a[key] || 0, vb = b[key] || 0; if (va || vb) o[key] = va + (vb - va) * k; } o.face = k < 0.5 ? (a.face || b.face) : (b.face || a.face); o.wpn = a.wpn || b.wpn; o.trail = k < 0.5 ? a.trail : b.trail; return o; }
    CH.lerpPose = lerpPose;
    const UPPER = KEYS.filter(k => /^(r_|l_|w|lean|twist|side|h[xyz])/.test(k));
    function kf(t, keys) {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (t <= b[0]) return lerpPose(a[1], b[1], (b[2] || ease)((t - a[0]) / (b[0] - a[0]))); }
      return keys[keys.length - 1][1];
    }
    const add = (p, q) => { for (const k in q) p[k] = typeof q[k] === 'number' ? (p[k] || 0) + q[k] : q[k]; return p; };
    const rest = () => ({ r_o: 0.05, l_o: 0.05, r_e: 0.14, l_e: 0.14, r_f: 0.04, l_f: 0.04, rl_o: 0.02, ll_o: 0.02 });
    const READY = { r_f: 0.62, r_e: 1.05, r_o: 0.22, r_t: 0.2, wg: 0.55, l_f: 0.35, l_o: 0.32, l_e: 0.7, lean: 0.1, rl_f: 0.28, rl_k: 0.3, ll_f: -0.18, ll_k: 0.18, twist: -0.12, htw: 0.08, y: -0.02, wpn: 1 };
    const A = CH.ANIM = {};
    A.idle = (t, c) => { const b = Math.sin(t * 2.1), p = rest();
      add(p, { y: b * 0.012, lean: 0.02 + b * 0.012, r_o: b * 0.03, l_o: b * 0.03, r_e: b * 0.05, l_e: b * 0.05, hro: Math.sin(t * 0.7) * 0.035, hx: -0.03 + Math.sin(t * 0.9) * 0.03, hz: Math.sin(t * 0.6) * 0.04 });
      p.side = -p.hro * 0.6;
      return c && c.armed ? add(lerpPose(p, READY, 1), { y: b * 0.01, r_e: b * 0.04 }) : p; };
    A.walk = (t, c) => { const ph = c ? c.phase : t * 8, s = Math.sin(ph), p = rest();
      add(p, { rl_f: s * 0.55, ll_f: -s * 0.55, rl_k: Math.max(0, Math.sin(ph + 1.9)) * 0.95 + 0.06, ll_k: Math.max(0, Math.sin(ph + PI + 1.9)) * 0.95 + 0.06,
        r_f: -s * 0.55, l_f: s * 0.55, r_e: 0.12, l_e: 0.12, y: Math.abs(Math.cos(ph)) * 0.05 - 0.02, lean: 0.07, htw: s * 0.13, twist: -s * 0.09, hro: Math.cos(ph) * 0.04, hy: s * 0.04 });
      if (c && c.armed) { p.r_f = 0.5 - s * 0.15; p.r_e = 1.0; p.r_o = 0.22; p.wg = 0.5; p.wpn = 1; }
      return p; };
    A.run = (t, c) => { const ph = c ? c.phase : t * 11, s = Math.sin(ph), p = {};
      add(p, { rl_f: s * 0.95 + 0.12, ll_f: -s * 0.95 + 0.12, rl_k: Math.max(0, Math.sin(ph + 2.0)) * 1.55 + 0.2, ll_k: Math.max(0, Math.sin(ph + PI + 2.0)) * 1.55 + 0.2,
        r_f: -s * 0.9, l_f: s * 0.9, r_e: 1.3, l_e: 1.3, r_o: 0.2, l_o: 0.2, y: Math.abs(Math.cos(ph)) * 0.1 - 0.03, lean: 0.27, htw: s * 0.2, twist: -s * 0.17, hx: -0.16, hy: s * 0.05 });
      if (c && c.armed) { p.r_f = 0.4 - s * 0.25; p.r_e = 1.2; p.wg = 0.9; p.wpn = 1; }
      return p; };
    A.jump = () => ({ rl_f: 0.95, rl_k: 1.35, ll_f: -0.2, ll_k: 0.55, r_f: 0.5, r_o: 1.05, r_e: 0.55, l_f: 0.5, l_o: 1.05, l_e: 0.55, lean: -0.04, hx: -0.18 });
    A.fall = (t) => ({ rl_f: 0.25 + Math.sin(t * 9) * 0.22, ll_f: 0.25 - Math.sin(t * 9) * 0.22, rl_k: 0.45 + Math.sin(t * 9 + 1) * 0.2, ll_k: 0.45 - Math.sin(t * 9 + 1) * 0.2,
      r_o: 1.85 + Math.sin(t * 13) * 0.28, l_o: 1.85 + Math.sin(t * 13 + 1.7) * 0.28, r_e: 0.3, l_e: 0.3, r_f: 0.2, l_f: 0.2, lean: 0.05, hx: 0.12, face: t > 0.5 ? 'surprised' : undefined });
    A.doubleJump = (t) => { const k = clamp(t / 0.48, 0, 1), tuck = Math.sin(k * PI);
      return lerpPose(A.jump(), { rp: easeOut(k) * TAU, rl_f: 1.75, ll_f: 1.75, rl_k: 2.2, ll_k: 2.2, r_f: 1.15, l_f: 1.15, r_e: 1.7, l_e: 1.7, r_o: 0.35, l_o: 0.35, hx: 0.3, nf: 1, face: 'excited' }, Math.max(tuck, k < 1 ? 0.6 : 0)); };
    A.land = (t) => { const k = clamp(t / 0.3, 0, 1), d = (1 - k) * (1 - k); return add(rest(), { sq: 0.24 * d, y: -0.13 * d, rl_f: 0.55 * d, rl_k: 1.1 * d, ll_f: 0.55 * d, ll_k: 1.1 * d, r_f: 0.35 * d, l_f: 0.35 * d, r_o: 0.45 * d, l_o: 0.45 * d, lean: 0.18 * d }); };
    A.swim = (t) => { const ph = t * 4.2, s9 = Math.sin(t * 9);
      return { rp: 1.25, nf: 1, y: 0.3 + Math.sin(t * 2.1) * 0.04, r_f: ph % TAU, l_f: (ph + PI) % TAU, r_o: 0.3, l_o: 0.3, r_e: 0.35, l_e: 0.35, r_t: 0.3, l_t: 0.3,
        rl_f: s9 * 0.35, ll_f: -s9 * 0.35, rl_k: 0.3 + s9 * 0.15, ll_k: 0.3 - s9 * 0.15, rl_a: 0.6, ll_a: 0.6, hx: -0.95, twist: Math.sin(ph) * 0.28, htw: Math.sin(ph) * 0.18 }; };
    const SIT = { y: -0.67, nf: 1, rl_f: 1.57, ll_f: 1.57, rl_o: 0.1, ll_o: 0.1, rl_k: 0.1, ll_k: 0.1, r_f: 0.85, l_f: 0.85, r_e: 0.35, l_e: 0.35, r_o: 0.1, l_o: 0.1, lean: -0.05 };
    A.sit = (t) => add(Object.assign({}, SIT), { lean: Math.sin(t * 2) * 0.015, hz: Math.sin(t * 0.8) * 0.06, hx: 0.04 });
    // ---- sword combo: 3 hits (slash, backhand, jumping smash). trail = the swing window
    A.slash1 = t => kf(t, [[0, READY],
      [0.11, { twist: -0.6, r_f: 0.25, r_o: 1.45, r_y: -0.65, r_e: 0.45, r_t: 0, wg: 0.15, l_f: 0.6, l_o: 0.45, l_e: 0.8, lean: 0.06, rl_f: 0.32, rl_k: 0.32, ll_f: -0.22, ll_k: 0.2, htw: -0.15, wpn: 1, face: 'determined' }, easeOut],
      [0.21, { twist: 0.62, r_f: 0.22, r_o: 1.45, r_y: 1.35, r_e: 0.08, wg: 0.0, l_f: -0.25, l_o: 0.6, l_e: 0.5, lean: 0.22, rl_f: 0.55, rl_k: 0.45, ll_f: -0.35, ll_k: 0.25, htw: 0.2, y: -0.035, wpn: 1, trail: 1, face: 'determined' }, easeIn],
      [0.27, { twist: 0.66, r_f: 0.25, r_o: 1.35, r_y: 1.45, r_e: 0.12, wg: 0.05, l_f: -0.2, l_o: 0.55, l_e: 0.5, lean: 0.22, rl_f: 0.55, rl_k: 0.45, ll_f: -0.35, ll_k: 0.25, htw: 0.2, y: -0.035, wpn: 1, face: 'determined' }, lin],
      [0.44, READY]]);
    A.slash2 = t => kf(t, [[0, READY],
      [0.1, { twist: 0.62, r_f: 0.95, r_o: -0.3, r_y: 0.35, r_e: 1.55, r_t: 0.6, wg: 0.6, wr: 0.5, l_o: 0.45, l_f: 0.1, l_e: 0.6, lean: 0.08, htw: 0.15, rl_f: 0.3, rl_k: 0.3, ll_f: -0.2, wpn: 1, face: 'determined' }, easeOut],
      [0.2, { twist: -0.58, r_f: 0.45, r_o: 1.55, r_y: -0.25, r_e: 0.12, r_t: 0, wg: 0.08, wr: 0, l_o: 0.5, l_f: 0.5, l_e: 0.9, lean: 0.2, htw: -0.2, y: -0.035, rl_f: 0.45, rl_k: 0.42, ll_f: -0.3, ll_k: 0.22, wpn: 1, trail: 1, face: 'determined' }, easeIn],
      [0.26, { twist: -0.62, r_f: 0.42, r_o: 1.6, r_y: -0.35, r_e: 0.15, wg: 0.1, l_o: 0.5, l_f: 0.5, l_e: 0.9, lean: 0.2, htw: -0.2, y: -0.035, rl_f: 0.45, rl_k: 0.42, ll_f: -0.3, ll_k: 0.22, wpn: 1, face: 'determined' }, lin],
      [0.44, READY]]);
    A.slash3 = t => kf(t, [[0, READY],
      [0.17, { y: 0.3, r_f: 2.95, r_e: 0.65, r_o: 0.12, wg: 0.95, l_f: 2.5, l_e: 0.8, l_o: 0.2, lean: -0.24, rl_f: 0.95, rl_k: 1.45, ll_f: 0.45, ll_k: 0.95, hx: -0.22, wpn: 1, face: 'angry' }, easeOut],
      [0.27, { y: -0.09, sq: 0.16, r_f: 0.95, r_e: 0.0, wg: -0.45, l_f: 0.75, l_o: 0.6, l_e: 0.4, lean: 0.42, rl_f: 0.75, rl_k: 1.25, ll_f: -0.3, ll_k: 0.85, hx: 0.12, wpn: 1, trail: 1, face: 'angry' }, easeIn],
      [0.4, { y: -0.07, sq: 0.07, r_f: 0.9, r_e: 0.05, wg: -0.4, l_f: 0.7, l_o: 0.6, l_e: 0.4, lean: 0.38, rl_f: 0.7, rl_k: 1.15, ll_f: -0.3, ll_k: 0.8, hx: 0.1, wpn: 1, face: 'determined' }, lin],
      [0.6, READY]]);
    CH.COMBO = [{ a: 'slash1', dur: 0.44, hit: 0.2 }, { a: 'slash2', dur: 0.44, hit: 0.19 }, { a: 'slash3', dur: 0.6, hit: 0.27, smash: 1 }];
    // ---- Update 6: a moveset for every weapon (combos, heavy, dash, air, parry, ultimate). l_g = off-hand grip
    const S = (o, q) => Object.assign({}, o, q);
    const STAB_W = { twist: -0.45, r_f: 0.75, r_o: 0.35, r_y: -0.3, r_e: 1.75, wg: 1.1, l_f: 0.7, l_o: 0.25, l_e: 1.2, lean: 0.04, rl_f: 0.3, rl_k: 0.35, ll_f: -0.2, ll_k: 0.2, htw: -0.1, wpn: 1, face: 'determined' };
    const STAB_H = { twist: 0.42, r_f: 1.52, r_o: 0.12, r_y: 0.1, r_e: 0.06, wg: 1.38, l_f: 0.3, l_o: 0.3, l_e: 1.35, lean: 0.27, rl_f: 0.62, rl_k: 0.45, ll_f: -0.45, ll_k: 0.3, htw: 0.12, y: -0.04, wpn: 1, trail: 1, face: 'determined' };
    A.stabR = t => kf(t, [[0, READY], [0.07, STAB_W, easeOut], [0.12, STAB_H, easeIn], [0.16, S(STAB_H, { trail: 0 }), lin], [0.26, READY]]);
    // left-hand stab: the off-hand dagger leads, the right arm pulls back
    const LSTAB_W = { twist: 0.45, l_f: 0.75, l_o: 0.35, l_y: -0.3, l_e: 1.75, l_g: 0.5, r_f: 0.7, r_o: 0.3, r_e: 1.3, wg: 0.8, lean: 0.04, ll_f: 0.3, ll_k: 0.35, rl_f: -0.2, rl_k: 0.2, htw: 0.1, wpn: 1, face: 'determined' };
    const LSTAB_H = { twist: -0.42, l_f: 1.52, l_o: 0.12, l_y: 0.1, l_e: 0.06, l_g: 0.85, r_f: 0.45, r_o: 0.35, r_e: 1.5, wg: 0.9, lean: 0.27, ll_f: 0.62, ll_k: 0.45, rl_f: -0.45, rl_k: 0.3, htw: -0.12, y: -0.04, wpn: 1, face: 'determined' };
    A.stabL = t => kf(t, [[0, READY], [0.07, LSTAB_W, easeOut], [0.12, LSTAB_H, easeIn], [0.16, LSTAB_H, lin], [0.26, READY]]);
    // spinning finisher (sword, daggers): wind, full turn with the blade out, recover
    const SPIN_W = { twist: -0.9, r_f: 0.35, r_o: 1.2, r_y: -0.9, r_e: 0.35, wg: 0.15, l_f: 0.5, l_o: 0.9, l_e: 0.6, lean: 0.12, y: -0.06, rl_f: 0.4, rl_k: 0.6, ll_f: -0.3, ll_k: 0.5, htw: -0.2, wpn: 1, face: 'angry' };
    const SPIN_H = { twist: 0.5, r_f: 0.25, r_o: 1.5, r_y: 1.2, r_e: 0.06, wg: 0.0, l_f: -0.1, l_o: 1.3, l_e: 0.3, lean: 0.18, y: 0.06, rl_f: 0.35, rl_k: 0.3, ll_f: -0.3, ll_k: 0.4, wpn: 1, face: 'angry' };
    A.spinFin = t => kf(t, [[0, READY], [0.12, SPIN_W, easeOut], [0.3, S(SPIN_H, { spin: TAU, trail: 1 }), ease], [0.3001, S(SPIN_H, { spin: 0 }), lin], [0.36, SPIN_H, lin], [0.56, READY]]);
    // staff: thrust the staff forward to loose a bolt (two mirrored versions)
    const CAST_H = { twist: 0.3, r_f: 1.45, r_o: 0.2, r_e: 0.15, wg: 1.3, l_f: 1.2, l_o: 0.1, l_e: 0.5, lean: 0.18, rl_f: 0.45, rl_k: 0.35, ll_f: -0.3, wpn: 1, trail: 1, face: 'determined' };
    A.castR = t => kf(t, [[0, READY], [0.09, { twist: -0.35, r_f: 0.9, r_e: 1.6, wg: 0.9, l_f: 0.8, l_e: 1.4, lean: 0.02, wpn: 1, face: 'determined' }, easeOut], [0.16, CAST_H, easeIn], [0.22, S(CAST_H, { trail: 0 }), lin], [0.42, READY]]);
    A.castR2 = t => kf(t, [[0, READY], [0.09, { twist: 0.4, r_f: 1.6, r_o: 0.8, r_e: 1.2, wg: 0.4, l_f: 1.1, l_e: 1.0, lean: 0.04, wpn: 1, face: 'determined' }, easeOut], [0.16, S(CAST_H, { twist: -0.25, r_o: 0.05 }), easeIn], [0.22, CAST_H, lin], [0.42, READY]]);
    // heavy: crouch and gather power (held), then a huge release
    A.heavyHold = (t) => { const q = Math.sin(t * 38) * 0.015 * Math.min(1, t * 2);
      return { twist: -0.75 + q, r_f: 1.9, r_o: 0.65, r_y: -0.6, r_e: 0.8, wg: 0.9, l_f: 1.0, l_o: 0.5, l_e: 1.1, l_g: 0.3, lean: 0.24, y: -0.14 + q, sq: 0.05, rl_f: 0.62, rl_k: 1.05, ll_f: -0.45, ll_k: 0.75, htw: -0.25, hx: 0.06, wpn: 1, face: 'angry' }; };
    const SWEEP_H = { twist: 0.85, r_f: 0.3, r_o: 1.5, r_y: 1.45, r_e: 0.05, wg: -0.05, l_f: -0.2, l_o: 0.9, l_e: 0.5, lean: 0.3, y: -0.08, rl_f: 0.75, rl_k: 0.75, ll_f: -0.5, ll_k: 0.45, htw: 0.3, wpn: 1, trail: 1, face: 'angry' };
    A.heavyRel = t => kf(t, [[0, A.heavyHold(0)], [0.14, SWEEP_H, easeIn], [0.32, S(SWEEP_H, { trail: 0, twist: 0.95 }), lin], [0.6, READY]]);
    // slam weapons (hammer, greatsword, staff) release overhead
    A.heavySlam = t => kf(t, [[0, A.heavyHold(0)], [0.08, { y: 0.25, r_f: 3.0, r_e: 0.5, r_o: 0.1, wg: 1.0, l_f: 2.6, l_e: 0.7, lean: -0.25, rl_f: 0.9, rl_k: 1.3, ll_f: 0.4, ll_k: 0.9, hx: -0.2, wpn: 1, face: 'angry' }, easeOut],
      [0.16, { y: -0.16, sq: 0.2, r_f: 0.85, r_e: 0.0, wg: -0.55, l_f: 0.7, l_o: 0.6, l_e: 0.4, lean: 0.5, rl_f: 0.85, rl_k: 1.4, ll_f: -0.35, ll_k: 1.0, hx: 0.15, wpn: 1, trail: 1, face: 'angry' }, easeIn],
      [0.36, { y: -0.12, sq: 0.1, r_f: 0.85, r_e: 0.05, wg: -0.5, l_f: 0.7, l_o: 0.6, l_e: 0.4, lean: 0.44, rl_f: 0.8, rl_k: 1.3, ll_f: -0.35, ll_k: 0.95, hx: 0.12, wpn: 1, face: 'angry' }, lin], [0.65, READY]]);
    // dash attack: a lunging thrust out of the roll
    A.dashAtk = t => kf(t, [[0, S(STAB_W, { lean: 0.35, y: -0.12, rl_k: 0.8, ll_k: 0.6 })], [0.1, S(STAB_H, { lean: 0.5, y: -0.16, rl_f: 0.95, rl_k: 0.7, ll_f: -0.7, ll_k: 0.15, r_f: 1.6 }), easeIn], [0.24, S(STAB_H, { trail: 0, lean: 0.45, y: -0.14, rl_f: 0.9, rl_k: 0.7, ll_f: -0.65 }), lin], [0.42, READY]]);
    // air attack: weapon over the head while falling, then the ground slam pose on landing
    A.airSlam = t => { const k = Math.min(1, t / 0.12);
      return lerpPose(READY, { y: 0.2, r_f: 3.0, r_e: 0.4, r_o: 0.12, wg: 1.1, l_f: 2.5, l_e: 0.7, l_o: 0.2, lean: -0.15, rl_f: 1.1, rl_k: 1.6, ll_f: 0.7, ll_k: 1.5, hx: -0.15, wpn: 1, face: 'angry' }, easeOut(k)); };
    A.airLand = t => kf(t, [[0, { y: -0.2, sq: 0.24, r_f: 0.8, r_e: 0.0, wg: -0.6, l_f: 0.7, l_o: 0.6, l_e: 0.4, lean: 0.55, rl_f: 0.9, rl_k: 1.5, ll_f: -0.3, ll_k: 1.1, hx: 0.15, wpn: 1, trail: 1, face: 'angry' }], [0.25, { y: -0.14, sq: 0.1, r_f: 0.8, r_e: 0.05, wg: -0.55, l_f: 0.7, l_o: 0.6, l_e: 0.4, lean: 0.45, rl_f: 0.85, rl_k: 1.3, ll_f: -0.3, ll_k: 1.0, wpn: 1, face: 'angry' }, lin], [0.5, READY]]);
    // parry: weapon (and shield) snapped across the body
    const GUARD = { twist: -0.2, r_f: 1.25, r_o: -0.15, r_y: 0.9, r_e: 1.25, wg: 1.45, wr: 1.4, l_f: 1.35, l_o: 0.25, l_y: -0.4, l_e: 1.4, l_g: 0.2, lean: -0.08, y: -0.08, rl_f: 0.35, rl_k: 0.55, ll_f: -0.45, ll_k: 0.4, hx: 0.08, wpn: 1, face: 'determined' };
    A.parry = t => kf(t, [[0, READY], [0.05, GUARD, easeOut], [0.26, S(GUARD, { y: -0.06 }), lin], [0.42, READY]]);
    A.parryHit = t => kf(t, [[0, GUARD], [0.08, S(SWEEP_H, { trail: 1, lean: 0.15 }), easeOut], [0.3, READY]]);
    // ultimate: rise, weapon to the sky, then down
    A.ultCast = t => kf(t, [[0, READY], [0.25, { y: 0.1, r_f: 3.05, r_e: 0.05, r_o: 0.08, wg: -1.4, l_f: 2.4, l_o: 0.8, l_e: 0.3, lean: -0.22, hx: -0.35, rl_f: 0.2, ll_f: -0.1, rl_k: 0.15, ll_k: 0.1, wpn: 1, face: 'angry' }, easeOut],
      [0.65, { y: 0.14, r_f: 3.05, r_e: 0.05, r_o: 0.08, wg: -1.4, l_f: 2.5, l_o: 0.9, l_e: 0.25, lean: -0.26, hx: -0.4, rl_f: 0.2, ll_f: -0.1, wpn: 1, face: 'angry' }, lin],
      [0.8, { y: -0.16, sq: 0.2, r_f: 0.9, r_e: 0.0, wg: -0.45, l_f: 0.8, l_o: 0.6, l_e: 0.4, lean: 0.48, rl_f: 0.8, rl_k: 1.35, ll_f: -0.3, ll_k: 1.0, hx: 0.12, wpn: 1, trail: 1, face: 'angry' }, easeIn], [1.15, READY]]);
    // each weapon's combo: animation, length, the moment it hits, time-scale; the last is the finisher (C.MOVESETS has the damage)
    CH.MOVES = {
      sword: [{ a: 'slash1', dur: 0.42, hit: 0.2 }, { a: 'slash2', dur: 0.42, hit: 0.19 }, { a: 'stabR', dur: 0.36, hit: 0.12 }, { a: 'spinFin', dur: 0.56, hit: 0.27, fin: 1 }],
      greatsword: [{ a: 'slash1', dur: 0.62, hit: 0.28, ts: 0.71 }, { a: 'slash2', dur: 0.62, hit: 0.27, ts: 0.71 }, { a: 'slash3', dur: 0.78, hit: 0.35, ts: 0.77, fin: 1 }],
      dagger: [{ a: 'stabR', dur: 0.24, hit: 0.11 }, { a: 'stabL', dur: 0.24, hit: 0.11 }, { a: 'slash1', dur: 0.3, hit: 0.14, ts: 1.45 }, { a: 'slash2', dur: 0.3, hit: 0.13, ts: 1.45 }, { a: 'spinFin', dur: 0.44, hit: 0.22, ts: 1.25, fin: 1 }],
      hammer: [{ a: 'slash2', dur: 0.52, hit: 0.24, ts: 0.82 }, { a: 'slash1', dur: 0.54, hit: 0.25, ts: 0.8 }, { a: 'slash3', dur: 0.7, hit: 0.3, ts: 0.88, fin: 1 }],
      staff: [{ a: 'castR', dur: 0.42, hit: 0.16 }, { a: 'castR2', dur: 0.42, hit: 0.16 }, { a: 'slash3', dur: 0.6, hit: 0.27, fin: 1 }]
    };
    // other moves: dur (99 = held until something replaces it), hit time + the event it sends
    CH.MOVES_X = { heavyHold: { dur: 99, lock: 1 }, heavyRel: { dur: 0.6, hit: 0.13, ev: 'heavy' }, heavySlam: { dur: 0.65, hit: 0.16, ev: 'heavy' }, dashAtk: { dur: 0.42, hit: 0.1, ev: 'dash' },
      airSlam: { dur: 99, lock: 1 }, airLand: { dur: 0.5, hit: 0.01, ev: 'air' }, parry: { dur: 0.42 }, parryHit: { dur: 0.3 }, ultCast: { dur: 1.15, lock: 1 } };
    A.hit = t => kf(t, [[0, {}], [0.06, { lean: -0.38, hx: -0.4, hz: 0.12, r_o: 0.85, l_o: 0.85, r_f: 0.35, l_f: 0.35, r_e: 0.5, l_e: 0.5, y: 0.03, rl_f: -0.2, ll_f: 0.25, rl_k: 0.3, face: 'hurt' }, easeOut], [0.34, {}]]);
    A.victory = t => { if (t > 0.75) { const b = Math.sin(t * 3); return { r_f: 2.95, r_e: 0.05, r_o: 0.1, wg: -1.35, l_f: -0.25, l_o: 0.18, l_t: -0.62, l_e: 1.01, lean: -0.08 + b * 0.01, hx: -0.15, y: b * 0.01, rl_o: 0.12, ll_o: 0.12, wpn: 1, face: 'excited' }; }
      return kf(t, [[0, {}], [0.18, { y: -0.05, sq: 0.16, lean: 0.25, rl_f: 0.45, ll_f: 0.45, rl_k: 0.9, ll_k: 0.9, r_f: -0.3, l_f: -0.3, wpn: 1, face: 'excited' }, easeOut],
        [0.45, { y: 0.6, spin: TAU, r_f: 2.95, r_e: 0.05, wg: -1.35, l_o: 1.2, l_e: 1.7, l_t: -1.2, lean: -0.1, rl_f: 0.6, rl_k: 1.1, ll_f: 0.2, ll_k: 0.6, wpn: 1, face: 'excited' }, easeOut],
        [0.62, { y: -0.02, sq: 0.12, spin: TAU, r_f: 2.95, r_e: 0.05, wg: -1.35, l_o: 0.6, l_e: 1.9, l_t: -1.1, lean: 0.05, rl_k: 0.5, ll_k: 0.5, rl_f: 0.25, ll_f: 0.25, wpn: 1, face: 'excited' }, easeIn],
        [0.75, { r_f: 2.95, r_e: 0.05, r_o: 0.1, wg: -1.35, l_f: -0.25, l_o: 0.18, l_t: -0.62, l_e: 1.01, lean: -0.08, hx: -0.15, rl_o: 0.12, ll_o: 0.12, spin: TAU, wpn: 1, face: 'excited' }]]); };
    // ---- emotes (loop)
    const EM = CH.EMOTES = [
      { id: 'wave', n: 'Wave', ico: '👋' }, { id: 'dance1', n: 'Bounce', ico: '🕺' }, { id: 'dance2', n: 'Floss', ico: '💃' }, { id: 'dance3', n: 'Robot', ico: '🤖' },
      { id: 'laugh', n: 'Laugh', ico: '😂' }, { id: 'cry', n: 'Cry', ico: '😭' }, { id: 'flex', n: 'Flex', ico: '💪' }, { id: 'point', n: 'Point', ico: '👉' },
      { id: 'salute', n: 'Salute', ico: '🫡' }, { id: 'sitE', n: 'Sit', ico: '🪑' }, { id: 'cheer', n: 'Cheer', ico: '🙌' }];
    A.wave = t => add(rest(), { r_f: -0.13, r_o: 2.65, r_t: 1.73, r_e: 0.45 + Math.sin(t * 11) * 0.38, hz: 0.1, hx: -0.06, side: -0.05, face: 'smirk' });
    A.dance1 = t => { const s = Math.sin(t * 7.5), b = Math.abs(s); return { y: b * 0.11 - 0.05, rl_k: (1 - b) * 0.65, ll_k: (1 - b) * 0.65, rl_f: (1 - b) * 0.32, ll_f: (1 - b) * 0.32, r_f: 1.1 + s * 0.9, l_f: 1.1 - s * 0.9, r_e: 1.6, l_e: 1.6, r_o: 0.4, l_o: 0.4, hro: Math.sin(t * 3.75) * 0.16, side: -Math.sin(t * 3.75) * 0.08, hz: Math.sin(t * 3.75) * 0.12, face: 'excited' }; };
    A.dance2 = t => { const ph = t * 6.5, th = Math.sin(ph) * 0.62, fb = Math.sin(ph * 0.5) > 0 ? 0.62 : -0.62; return { r_o: -th + 0.25, l_o: th + 0.25, r_f: fb, l_f: -fb, r_e: 0.05, l_e: 0.05, hro: -Math.sin(ph) * 0.2, htw: Math.sin(ph) * 0.12, side: Math.sin(ph) * 0.1, twist: -Math.sin(ph) * 0.1, rl_k: Math.max(0, Math.sin(ph)) * 0.35, ll_k: Math.max(0, -Math.sin(ph)) * 0.35, hz: -Math.sin(ph) * 0.08, face: 'cheeky' }; };
    const ROBOT = [{ r_o: 1.5, r_t: 1.57, r_e: 1.57, l_o: 0.15, l_e: 1.57, twist: 0.35, hy: -0.45 }, { r_o: 0.15, r_e: 1.57, l_o: 1.5, l_t: 1.57, l_e: 1.57, twist: -0.35, hy: 0.45 },
      { r_f: 1.57, r_e: 0.02, l_f: 1.57, l_e: 0.02, y: -0.05, rl_k: 0.35, ll_k: 0.35, rl_f: 0.2, ll_f: 0.2 }, { r_o: 1.5, r_e: 0.02, l_o: 1.5, l_e: 0.02, hx: 0.25, y: 0.02 }];
    const md = (a, n) => ((a % n) + n) % n;
    A.dance3 = t => { const q = Math.floor(t * 3.2), k = clamp((t * 3.2 - q) * 7, 0, 1); return Object.assign(lerpPose(ROBOT[md(q + 3, 4)], ROBOT[md(q, 4)], easeOut(k)), { face: 'determined' }); };
    A.laugh = t => { const s = Math.sin(t * 24); return { lean: -0.16 + s * 0.035, hx: -0.28 + s * 0.06, r_f: 0.71, r_o: 0.16, r_t: -1.5, r_e: 0.98, l_f: 1.96, l_o: -0.08, l_t: -1.43, l_e: 1.42, y: Math.abs(s) * 0.025, rl_o: 0.05, ll_o: 0.05, face: 'laugh' }; };
    A.cry = t => { const s = Math.sin(t * 17); return { r_f: 2.12, r_o: -0.3, r_t: -1.16, r_e: 0.88 + s * 0.05, l_f: 2.12, l_o: -0.3, l_t: -1.16, l_e: 0.88 - s * 0.05, hx: 0.22 + s * 0.03, lean: 0.12, twist: s * 0.03, y: s * 0.01, rl_k: 0.12, ll_k: 0.12, face: 'cry' }; };
    A.flex = t => { const s = Math.sin(t * 5), k = Math.abs(s); return { r_o: 1.5, r_t: 1.52, r_e: 1.64 + k * 0.18, l_o: 1.5, l_t: 1.52, l_e: 1.64 + k * 0.18, lean: -0.1, sq: -0.03 * k, hx: -0.12, rl_o: 0.16, ll_o: 0.16, face: 'determined' }; };
    A.point = t => Object.assign(rest(), { r_f: 1.5, r_e: 0.04, r_o: 0.08, r_y: -0.12, l_f: -0.25, l_o: 0.18, l_t: -0.62, l_e: 1.01, hy: -0.08, hx: Math.sin(t * 3) * 0.02, twist: 0.12, face: 'cheeky' });
    A.salute = t => ({ r_f: 2.69, r_o: 0.11, r_t: -1.39, r_e: 1.33, l_o: 0.04, l_e: 0.08, lean: -0.03, hx: -0.06 + Math.sin(t * 2) * 0.01, face: 'determined' });
    A.sitE = t => add(A.sit(t), { face: 'happy' });
    A.cheer = t => { const b = Math.abs(Math.sin(t * 6)); return { y: b * 0.26, rl_k: (1 - b) * 0.7 + 0.1, ll_k: (1 - b) * 0.7 + 0.1, rl_f: (1 - b) * 0.35, ll_f: (1 - b) * 0.35, r_f: 2.85, l_f: 2.85, r_o: 0.45 + Math.sin(t * 12) * 0.15, l_o: 0.45 - Math.sin(t * 12) * 0.15, r_e: 0.2, l_e: 0.2, hx: -0.2, face: 'excited' }; };
    // never let one bad animation break the game: negative times are clamped and any error falls back to idle
    CH.pose = (name, t, c) => { t = Math.max(0, +t || 0); try { const p = (A[name] || A.idle)(t, c || {}); for (const k in p) if (typeof p[k] === 'number' && !isFinite(p[k])) p[k] = 0; return p; } catch (e) { return A.idle(t, {}); } };

    // ================================================================ DRAWING
    const mT = new Float32Array(16), mA = new Float32Array(16), mB = new Float32Array(16), mR0 = new Float32Array(16), mRoot = new Float32Array(16), mMir = new Float32Array(16), mUp = new Float32Array(16);
    const mHip = new Float32Array(16), mSp = new Float32Array(16), mHead = new Float32Array(16), mL1 = new Float32Array(16), mL2 = new Float32Array(16), mL3 = new Float32Array(16);
    // Update 7 · outlines (Medium / High; the engine skips them on Low): a thin dark edge round the body and gear, and on Epic or better gear a glowing
    // edge in its rarity colour (lk.oglow). Glowing parts themselves (noShadow) get none. CH.outline = false turns them off (the Character Lab can)
    const OUTL = { col: [0.035, 0.03, 0.045], w: 0.018 }; let curOL = null, curGOL = null;
    const draw = (msh, m, col, o) => { if (o) o.outline = curOL && !o.noShadow && !o.alpha ? (o.gearPart ? curGOL : curOL) : undefined; E.draw(msh, m, col, o); };
    const P0 = {}, MIR = T(0, 0, 0, 0, 0, 0, -1, 1, 1);
    const gearMesh = k => mesh('gear:' + k, GEO[k]);
    const sMat = new Float32Array(16), sMat2 = new Float32Array(16);
    function spring(sp, key) { return sp ? (sp[key] || (sp[key] = { p: 0, r: 0, vp: 0, vr: 0 })) : { p: 0, r: 0 }; }
    // draw every gear piece of the outfit that sits on bone b (side s for limbs: -1 right, 1 left)
    function gear(lk, fit, b, m, s, sp, o) {
      if (!fit) return;
      for (const g of fit.parts) {
        if (g.b !== b) continue;
        let mm = m;
        if (g.mirror && s > 0) { mul(m, MIR, mMir); mm = mMir; }
        if (g.up) { T(-0.04, 0.12, 0, 0, 0, 0, 1, 1, 1, mT); mul(mm, mT, mUp); mm = mUp; }
        if (g.spring) { const q = spring(sp, g.spring), pv = g.pivot || [0, 0, 0]; T(pv[0], pv[1], pv[2], 0, Math.max(-0.1, q.p) * 0.8 + (g.pivot ? 0.15 : 0), q.r * 0.5, 1, 1, 1, mT); mul(m, mT, sMat); mm = sMat; }
        if (g.glow && fit.noGlow) { draw(gearMesh(g.k), mm, lk.gear2 || lk.gear1, { soft: 1, spec: 1.2, gearPart: 1 }); continue; }
        const glow = g.glow ? { soft: 1, emis: 2.2, noShadow: true } : { soft: 1, col2: lk.gear2, cull: g.mirror ? false : undefined, spec: fit.metal ? 1 : 0, gearPart: 1 };
        draw(gearMesh(g.k), mm, g.glow ? lk.glow : lk.gear1, glow);
      }
      // Update 7: armour accessories, more of them the rarer the armour (instead of glow): a belt with pouches, a chainmail fringe, a chest
      // strap with rivets, a fur mantle, horns on the pauldrons, crossed blades on the back
      if (fit.noGlow) for (const q of ACC) { if (q.b !== b || (lk.rar || 0) < q.r || (q.plate && !fit.metal)) continue; let mm = m;
        if (q.mirror && s > 0) { mul(m, MIR, mMir); mm = mMir; } draw(gearMesh(q.k), mm, lk.gear1, { soft: 1, col2: lk.gear2, spec: 0.5, gearPart: 1 }); }
    }
    const ACC = [{ b: 'pelvis', k: 'acBelt', r: 1 }, { b: 'pelvis', k: 'acChain', r: 2, plate: 1 }, { b: 'torso', k: 'acStrap', r: 2 }, { b: 'torso', k: 'acFur', r: 3 }, { b: 'ua', k: 'acHorn', r: 4, mirror: 1, plate: 1 }, { b: 'torso', k: 'acTrophy', r: 5 }];
    // o: {face, blink, lx, ly, springs, trail, lod, weapon (force show)}
    CH.draw = function (lk, P, x, y, z, yaw, o) {
      o = o || {}; P = P || P0; const g = k => P[k] || 0;
      curOL = CH.outline !== false && o.outline !== false && !o.lod ? OUTL : null; curGOL = curOL && lk.oglow ? { col: lk.oglow, w: 0.03, glow: 1.5 } : curOL;
      const fit = OUTFITS[lk.outfit] && OUTFITS[lk.outfit].parts.length ? OUTFITS[lk.outfit] : null, sleeve = fit && fit.sleeve || lk.sleeve || 'short';
      const sc = lk.height || 1, sq = g('sq'), shape = lk.shape || 'regular', skinO = { soft: 1, col2: lk.skin }, sp = o.springs;
      const R0 = T(x, y + g('y') * sc, z, yaw + g('spin'), 0, 0, sc * (1 + sq * 0.45), sc * (1 - sq), sc * (1 + sq * 0.45), mR0);
      let root = R0;
      if (g('rp') || g('rr')) { T(0, D.WAIST, 0, 0, g('rp'), g('rr'), 1, 1, 1, mA); mul(R0, mA, mB); T(0, -D.WAIST, 0, 0, 0, 0, 1, 1, 1, mA); root = mul(mB, mA, mRoot); }
      // hips + legs
      T(0, D.WAIST, 0, g('htw'), 0, g('hro'), 1, 1, 1, mT); mul(root, mT, mHip);
      draw(mesh('pelvis' + shape, () => pelvisGeo(shape)), mHip, lk.pants, skinO);
      gear(lk, fit, 'pelvis', mHip, 0, sp, o);
      const thigh = mesh('thigh' + (lk.shorts ? 's' : ''), () => thighGeo(lk.shorts)), shin = mesh('shin', shinGeo), flat = g('nf') ? 0 : 0.85;
      for (const s of [-1, 1]) {
        const L = s < 0 ? 'rl_' : 'll_', f = g(L + 'f'), k = g(L + 'k');
        T(s * D.HIPX, D.HIPY, 0, 0, -f, s * g(L + 'o'), 1, 1, 1, mT); mul(mHip, mT, mL1); draw(thigh, mL1, lk.pants, skinO); gear(lk, fit, 'th', mL1, s, sp, o);
        T(0, -D.THIGH, 0, 0, k, 0, 1, 1, 1, mT); mul(mL1, mT, mL2);
        draw(shin, mL2, lk.shorts ? lk.skin : lk.pants, { soft: 1, col2: lk.shoes }); gear(lk, fit, 'sh', mL2, s, sp, o);
        if (lk.boot && !(fit && fit.parts.some(q => q.k === 'kGreave'))) { draw(gearMesh(lk.boot === 'boots' ? 'mBoot' : 'kGreave'), mL2, lk.bc1 || lk.gear1, { soft: 1, col2: lk.bc2 || lk.gear2, spec: lk.boot === 'boots' ? 0 : 1, gearPart: 1 });
          if (lk.btier !== undefined) draw(gearMesh('tGreave' + lk.btier), mL2, lk.bc1 || lk.gear1, { soft: 1, col2: lk.bc2 || lk.gear2, spec: 0.6, gearPart: 1 }); }
      }
      // torso + head
      T(0, D.WAIST, 0, g('twist'), g('lean'), g('side'), 1, 1, 1, mT); mul(root, mT, mSp);
      draw(mesh('torso' + shape, () => torsoGeo(shape)), mSp, '#ffffff', { soft: 1, tex: shirtTex(lk), texMode: 1 });
      gear(lk, fit, 'torso', mSp, 0, sp, o);
      if (lk.cape) drawCape(lk, sp);
      const hs = lk.head || 1;
      T(0, D.NECK, 0, g('hy'), g('hx'), g('hz'), 1, 1, 1, mT); mul(mSp, mT, mB); T(0, D.HEADY * hs, 0, 0, 0, 0, hs, hs, hs, mT); mul(mB, mT, mHead);
      const fx = { skin: lk.skin, eye: lk.eye, brow: lk.hairC, eyeStyle: lk.eyeStyle, expr: o.face || P.face || lk.face || 'serious', blink: !!o.blink, lx: o.lx || 0, ly: o.ly || 0, freckles: lk.freckles, mask: lk.mask, blush: lk.blush };
      const hl = lk.helm || '', helm = hl === 'helm' || (fit && (fit.hideHead || fit.parts.some(q => q.k === 'kHelm')));   // a skin can hide the head (a pumpkin, a box, a dome)
      if (!helm) draw(mesh('head', headGeo), mHead, '#ffffff', { soft: 1, tex: faceTex(fx), texMode: 1 });
      if (!(fit && fit.hideHair) && !hl) { const hair = hairOf(lk.hair); draw(hair.m, mHead, lk.hairC, { soft: 1, col2: lk.hairC2 }); if (hair.tail) drawTail(hair.tail, lk, sp); }
      gear(lk, fit, 'head', mHead, 0, sp, o);
      // a helmet or hood from your gear (its own colours: hc1 body, hc2 trim)
      if (hl === 'helm') { draw(gearMesh('kHelm'), mHead, lk.hc1 || lk.gear1, { soft: 1, col2: lk.hc2 || lk.gear2, spec: 1, gearPart: 1 }); if (lk.htier !== 8) draw(gearMesh('kVisor'), mHead, '#0c0b10', { soft: 1, spec: 0.4 }); }   // Update 7 (feedback): no glowing armour
      else if (hl === 'hood') draw(gearMesh('mHood'), mHead, lk.hc1 || lk.gear1, { soft: 1, col2: lk.hc2 || lk.gear2, gearPart: 1 });
      // each dungeon's helmet / hood has its own shape on top (antlers, a headdress, horns, an ice crown, a halo...)
      if (hl && lk.htier !== undefined) { draw(gearMesh((hl === 'hood' ? 'tHood' : 'tHelm') + lk.htier), mHead, lk.hc1 || lk.gear1, { soft: 1, col2: lk.hc2 || lk.gear2, spec: hl === 'helm' ? 1 : 0, gearPart: 1 });
        const hgm = CH.tierHelmGlow(lk.htier); if (hgm) draw(hgm, mHead, lk.hc2 || lk.gear2, { soft: 1, spec: 1, gearPart: 1 }); }
      // arms
      const ua = mesh('ua' + sleeve, () => upperArmGeo(sleeve)), fa = mesh('fa' + (sleeve === 'long' ? 'l' : 's'), () => foreArmGeo(sleeve));
      const wk = lk.wpn || 'sword', wp = lk.wtier !== undefined && WEAPONS[wk] ? CH.tierWeapon(wk, lk.wtier) : WEAPONS[wk], wkey = wk + (lk.wtier !== undefined ? ':' + lk.wtier : '');
      for (const s of [-1, 1]) {
        const A_ = s < 0 ? 'r_' : 'l_';
        T(s * D.SHX, D.SHY, 0, -s * g(A_ + 'y'), -g(A_ + 'f'), s * g(A_ + 'o'), 1, 1, 1, mT); mul(mSp, mT, mA); T(0, 0, 0, s * g(A_ + 't'), 0, 0, 1, 1, 1, mT); mul(mA, mT, mL1);
        draw(ua, mL1, lk.shirt, skinO); gear(lk, fit, 'ua', mL1, s, sp, o);
        T(0, -D.UA, 0, 0, -g(A_ + 'e'), 0, 1, 1, 1, mT); mul(mL1, mT, mL2); draw(fa, mL2, lk.shirt, skinO); gear(lk, fit, 'fa', mL2, s, sp, o);
        if (lk.glove && !(fit && fit.parts.some(q => q.k === 'kGauntlet'))) { draw(gearMesh(lk.glove === 'wraps' ? 'mWrap' : 'kGauntlet'), mL2, lk.gc1 || lk.gear1, { soft: 1, col2: lk.gc2 || lk.gear2, spec: lk.glove === 'wraps' ? 0 : 1, gearPart: 1 });
          if (lk.gtier !== undefined) draw(gearMesh('tGaunt' + lk.gtier), mL2, lk.gc1 || lk.gear1, { soft: 1, col2: lk.gc2 || lk.gear2, spec: 0.6, gearPart: 1 }); }
        // off-hand: the Rogue's second dagger, the Paladin's shield
        if (s > 0 && lk.off && (P.wpn || o.weapon)) {
          T(0, -D.FA + 0.04, 0.02, 0, -(0.55 + g('l_g')), 0, 1, 1, 1, mT); mul(mL2, mT, mL3);
          if (lk.off === 'shield') { draw(mesh('shield', shieldGeo), mL2, lk.weapon || '#b8c0cc', { soft: 1, col2: lk.gem || '#d8b05a', spec: 1 });
            draw(mesh('shieldg', shieldGlow), mL2, lk.wglow || lk.glow, { soft: 1, emis: 2.2, noShadow: true }); }
          else if (wp) { draw(mesh('wpn:' + wkey, wp.body), mL3, lk.weapon, { soft: wp.flat ? 0 : 1, rim: wp.flat ? 0.25 : undefined, col2: lk.gem, spec: wp.spec !== undefined ? wp.spec : 0.8, gearPart: 1 }); draw(mesh('wpng:' + wkey, wp.glow), mL3, lk.wglow || lk.glow, { soft: 1, emis: 2.2, noShadow: true }); }
        }
        if (s < 0 && (P.wpn || o.weapon) && wp) {
          T(0, -D.FA + 0.04, 0.02, 0, -g('wg'), g('wr'), 1, 1, 1, mT); mul(mL2, mT, mL3);
          if (wp.hold) { const h = wp.hold; T(h[0], h[1], h[2], h[3], h[4], h[5], 1, 1, 1, mT); mul(mL3, mT, mA); mL3.set(mA); }
          draw(mesh('wpn:' + wkey, wp.body), mL3, lk.weapon, { soft: wp.flat ? 0 : 1, rim: wp.flat ? 0.25 : undefined, col2: lk.gem, spec: wp.spec !== undefined ? wp.spec : 0.8, gearPart: 1 });
          draw(mesh('wpng:' + wkey, wp.glow), mL3, lk.wglow || lk.glow, { soft: 1, emis: 2.2, noShadow: true });
          if (o.trail) o.trail.push({ a: M.apply(mL3, 0, 0, wp.tip[0]), b: M.apply(mL3, 0, 0, wp.tip[1]), on: !!P.trail });
          if (wp.orb && o.parts !== false && Math.random() < 0.35) { const q = M.apply(mL3, wp.orb[0], wp.orb[1], wp.orb[2]); E.particle({ x: q[0], y: q[1], z: q[2], vx: (Math.random() - 0.5) * 0.6, vy: 0.5, vz: (Math.random() - 0.5) * 0.6, life: 0.7, size: 0.13, col: lk.wglow || lk.glow, add: true }); }
        }
      }
      return mHead;
    };
    // ---- bouncy parts (ponytail, cape): a damped spring per part, pushed by how the body moves
    CH.stepSprings = function (sp, dt, drive) { // drive: {fwd (local forward speed), side, vy, lean}
      if (!sp) return; dt = Math.min(dt, 0.05);
      for (const key in sp) { const s = sp[key], tp = (s.base || 0) + clamp(drive.fwd * 0.07 - drive.vy * 0.025, -0.4, 0.9) + (drive.lean || 0) * 0.6, tr = clamp(-drive.side * 0.06, -0.5, 0.5);
        s.vp += ((tp - s.p) * 55 - s.vp * 6.5) * dt; s.vr += ((tr - s.r) * 55 - s.vr * 6.5) * dt; s.p += s.vp * dt; s.r += s.vr * dt; }
    };
    CH.kickSprings = (sp, amount) => { if (sp) for (const k in sp) sp[k].vp += amount; };
    function drawTail(tl, lk, sp) {
      const s1 = spring(sp, 'tail1'), s2 = spring(sp, 'tail2');
      T(tl.pos[0], tl.pos[1], tl.pos[2], 0, 0.35 + s1.p, s1.r, 1, 1, 1, mT); mul(mHead, mT, sMat);
      draw(tl.segs[0], sMat, lk.hairC, { soft: 1 });
      T(0, -tl.len, 0, 0, 0.15 + (s2.p - s1.p) * 0.8, (s2.r - s1.r) * 0.8, 1, 1, 1, mT); mul(sMat, mT, sMat2);
      draw(tl.segs[1], sMat2, lk.hairC, { soft: 1 });
    }
    function drawCape(lk, sp) {
      const s = spring(sp, 'cape'); if (sp && s.base === undefined) s.base = 0.12;
      T(0, 0.86, -0.29, 0, 0.1 + Math.max(-0.08, s.p) * 1.1, s.r * 0.5, 1, 1, 1, mT); mul(mSp, mT, sMat);
      draw(mesh('cape', capeGeo), sMat, lk.cape, { soft: 1, col2: lk.cape2 || '#ffd84a', cull: false });
    }
    // ---- sword trail: a fading ribbon through the last blade positions
    const trailTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 4; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 4); return E.canvasTex(c); })();
    CH.drawTrail = function (pts, dm, col) { // pts newest last
      const on = pts.filter(p => p.on); if (on.length < 2) return; const a = [], n = on.length;
      for (let i = 0; i < n - 1; i++) { const p0 = on[i], p1 = on[i + 1], u0 = 1 - i / (n - 1), u1 = 1 - (i + 1) / (n - 1), nn = [0, 1, 0];
        for (const [p, u] of [[p0.a, u0], [p0.b, u0], [p1.b, u1], [p0.a, u0], [p1.b, u1], [p1.a, u1]]) vtx(a, p, nn, WHITE, u, 0.5); }
      E.updateMesh(dm, a); E.draw(dm, M.ident(), col || '#bfefff', { tex: trailTex, texMode: 1, mode: 3, add: true, alpha: 0.9, cull: false, noShadow: true, depthWrite: false });
    };

    // ================================================================ RUNTIME STATE (blending, actions, faces)
    // st = CH.create(look); each frame: CH.update(st, dt, {speed, vy, grounded, swim, sit}); then CH.drawState(st, x, y, z, yaw)
    CH.create = (look) => ({ look, t: 0, phase: 0, air: 0, act: null, actT: 0, base: {}, pose: {}, springs: {}, trailPts: [], trailMesh: E.dynMesh(), expr: null, exprT: 0,
      blinkT: 2 + Math.random() * 2, blink: 0, lookAt: null, lx: 0, ly: 0, combo: 0, comboT: 0, armed: false, idleT: 0, events: [], landT: 9, djT: 9 });
    CH.play = function (st, name, opt) {
      opt = opt || {};
      if (name === 'attack') { // next hit of this weapon's combo (pressing early queues it; the finisher ends the chain)
        const list = CH.MOVES[opt.kind] || CH.MOVES.sword, n = list.length;
        if (st.act && st.act.combo && st.actT < st.act.dur * 0.8) { st.queued = true; st.qKind = opt.kind; return false; }
        if (st.act && st.act.lock) return false;
        const cont = (st.act && st.act.combo && !st.act.fin) || (st.comboOpen && st.comboT < 0.4), i = cont ? (st.combo + 1) % n : 0, c = list[i];
        st.combo = i; st.comboN = n; st.act = { a: c.a, dur: c.dur, hit: c.hit, smash: c.fin, fin: c.fin, ts: c.ts, combo: 1, upper: false, kind: opt.kind }; st.actT = 0; st.hitDone = false; st.armed = true; st.armedT = 4; st.queued = false; return true;
      }
      if (CH.MOVES_X[name]) { const m = CH.MOVES_X[name]; st.act = { a: name, dur: m.dur, hit: m.hit, ev: m.ev, lock: m.lock, upper: !!opt.upper, ch: opt.ch }; st.actT = 0; st.hitDone = false; st.armed = true; st.armedT = 4; st.queued = false; st.comboOpen = false; return true; }
      if (name === 'doubleJump') { st.djT = 0; return true; }
      if (name === 'land') { st.landT = 0; return true; }
      const em = CH.EMOTES.find(e => e.id === name);
      st.act = { a: name, dur: em ? 9999 : name === 'victory' ? 2.4 : name === 'hit' ? 0.34 : 1, loop: !!em, upper: name === 'hit' && opt.moving }; st.actT = 0; return true;
    };
    CH.stopEmote = st => { if (st.act && st.act.loop) st.act = null; };
    CH.say = (st, expr, dur) => { st.expr = expr; st.exprT = dur || 1.5; };
    CH.update = function (st, dt, inp) {
      st.t += dt; const sp = inp.speed || 0; st.phase += dt * sp * (sp > 6.5 ? 2.0 : 2.7);
      if (st.events.length > 12) st.events.splice(0, st.events.length - 12);   // other players' move events are never read
      st.air = inp.grounded ? 0 : st.air + dt; st.djT += dt; st.landT += dt; st.exprT -= dt; st.comboT += dt; st.armedT = (st.armedT || 0) - dt; if (st.armedT <= 0) st.armed = false;
      if (sp > 0.5 || !inp.grounded) { st.idleT = 0; if (st.act && st.act.loop) st.act = null; } else st.idleT += dt;
      // base layer: locomotion
      const c = { phase: st.phase, armed: st.armed }; let base;
      if (inp.swim) base = A.swim(st.t);
      else if (inp.sit) base = A.sit(st.t);
      else if (!inp.grounded && st.air > 0.05) base = st.djT < 0.48 ? A.doubleJump(st.djT) : inp.vy > 0 ? A.jump(st.t) : lerpPose(A.jump(st.t), A.fall(st.air), clamp(-inp.vy / 6, 0, 1));
      else { const w = clamp(sp / 4, 0, 1), r = clamp((sp - 4.5) / 3, 0, 1); base = lerpPose(lerpPose(A.idle(st.t, c), A.walk(st.t, c), w), A.run(st.t, c), r); if (st.landT < 0.3) base = add(base, A.land(st.landT)); }
      // action layer
      let pose = base;
      if (st.act) {
        st.actT += dt; const a = st.act;
        if (a.combo && !st.hitDone && st.actT >= a.hit) { st.hitDone = true; st.events.push({ k: a.smash ? 'smash' : 'hit', combo: st.combo, fin: a.fin, n: st.comboN }); }
        if (a.ev && !st.hitDone && st.actT >= a.hit) { st.hitDone = true; st.events.push({ k: a.ev, ch: a.ch }); }
        if (st.actT >= a.dur && !a.loop) { const q = st.queued; st.comboOpen = !!a.combo && !a.fin; st.act = null; st.queued = false; st.comboT = 0; if (q) CH.play(st, 'attack', { kind: st.qKind }); }
        else { const ap = A[a.a](st.actT * (a.ts || 1), c), fin = a.loop ? 1 : clamp(Math.min(st.actT / 0.06, (a.dur - st.actT) / 0.1), 0, 1);
          pose = lerpPose(base, ap, a.combo ? 1 : fin, (a.upper || (a.combo && sp > 0.5)) ? UPPER : null); if (a.combo && sp > 0.5) { pose.y = base.y; } pose.face = ap.face || base.face; pose.trail = ap.trail; pose.wpn = ap.wpn || base.wpn; }
      }
      // face: actions > short reactions > falling > sleepy when idle long > happy, with blinking
      st.blinkT -= dt; if (st.blinkT <= 0) { st.blink = 0.13; st.blinkT = 2.2 + Math.random() * 2.6; } st.blink -= dt;
      let face = pose.face || (st.exprT > 0 ? st.expr : null) || (st.air > 0.7 ? 'surprised' : st.idleT > 25 ? 'sleepy' : st.armed ? 'determined' : (st.look.face || 'serious'));
      st.face = face; st.pose = pose;
      CH.stepSprings(st.springs, dt, { fwd: sp, side: 0, vy: inp.vy || 0, lean: pose.lean || 0 });
    };
    CH.drawState = function (st, x, y, z, yaw, o) {
      o = o || {};
      // eyes look toward a point (head turns a little, eyes do the rest)
      let lx = 0, ly = 0, P = st.pose;
      if (st.lookAt) { const dx = st.lookAt[0] - x, dz = st.lookAt[2] - z, dy = st.lookAt[1] - (y + 2.2); let a = Math.atan2(dx, dz) - yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) < 1.9) { const hy = clamp(a * 0.45, -0.55, 0.55); P = Object.assign({}, P, { hy: (P.hy || 0) + hy }); lx = clamp(Math.round((a - hy) * 2.6), -2, 2); ly = clamp(Math.round(-Math.atan2(dy, Math.hypot(dx, dz)) * 2.5), -1, 1); } }
      const tr = st.trailPts; if (tr.length > 9) tr.splice(0, tr.length - 9);
      const head = CH.draw(st.look, P, x, y, z, yaw, { face: st.face, blink: st.blink > 0, lx: -lx, ly, springs: st.springs, trail: tr, lod: o.lod });
      if (tr.length && !P.trail) tr.forEach(p => p.on = false);
      CH.drawTrail(tr, st.trailMesh, o.trailCol);
      return head;
    };
    CH.look = (lk) => Object.assign(CH.defaultLook(), lk || {});
    CH.weaponMesh = (k, part) => mesh((part === 'glow' ? 'wpng:' : 'wpn:') + k, WEAPONS[k][part === 'glow' ? 'glow' : 'body']);
    return CH;
  };
})(typeof self !== 'undefined' ? self : this);
