/* Tapping Legends - tiny WebGL renderer (no libraries needed).
   Lighting, soft shadow maps, fog, sky, procedural textures, static batching, particles.
   Works on WebGL2 or WebGL1. */
(function (root) {
  'use strict';
  // ================================================================ MATH (column-major mat4)
  const M = {};
  M.ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  M.mul = function (a, b, o) {
    o = o || new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  };
  M.persp = function (fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  };
  M.ortho = function (l, r, b, t, n, f) {
    const o = new Float32Array(16);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
  };
  M.lookAt = function (e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  };
  M.invert = function (m) {
    const o = new Float32Array(16), a = m;
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5],
      b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12],
      b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return M.ident(); d = 1 / d;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  };
  // translate * rotY(yaw) * rotX(pitch) * rotZ(roll) * scale
  M.trs = function (x, y, z, yaw, pitch, roll, sx, sy, sz, o) {
    o = o || new Float32Array(16);
    yaw = yaw || 0; pitch = pitch || 0; roll = roll || 0;
    if (sx === undefined) sx = 1; if (sy === undefined) sy = sx; if (sz === undefined) sz = sx;
    const cy = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    // R = Ry * Rx * Rz
    const r00 = cy * cr + syw * sp * sr, r01 = cp * sr, r02 = -syw * cr + cy * sp * sr;
    const r10 = -cy * sr + syw * sp * cr, r11 = cp * cr, r12 = syw * sr + cy * sp * cr;
    const r20 = syw * cp, r21 = -sp, r22 = cy * cp;
    o[0] = r00 * sx; o[1] = r01 * sx; o[2] = r02 * sx; o[3] = 0;
    o[4] = r10 * sy; o[5] = r11 * sy; o[6] = r12 * sy; o[7] = 0;
    o[8] = r20 * sz; o[9] = r21 * sz; o[10] = r22 * sz; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  };
  M.apply = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  M.hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
  M.col = c => typeof c === 'string' ? M.hex(c) : c;
  M.lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // ================================================================ GEOMETRY (non-indexed, interleaved pos3 nrm3 col3 uv2)
  const G = {};
  const STRIDE = 11;
  function push(a, p, n, uv) { a.push(p[0], p[1], p[2], n[0], n[1], n[2], 1, 1, 1, uv[0], uv[1]); }
  G.STRIDE = STRIDE;
  // make every triangle counter-clockwise when seen from the side its normals point to
  function fix(a) {
    for (let k = 0; k < a.length; k += STRIDE * 3) {
      const b = k + STRIDE, c = k + STRIDE * 2;
      const ux = a[b] - a[k], uy = a[b + 1] - a[k + 1], uz = a[b + 2] - a[k + 2], vx = a[c] - a[k], vy = a[c + 1] - a[k + 1], vz = a[c + 2] - a[k + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = a[k + 3] + a[b + 3] + a[c + 3], my = a[k + 4] + a[b + 4] + a[c + 4], mz = a[k + 5] + a[b + 5] + a[c + 5];
      if (nx * mx + ny * my + nz * mz < 0) for (let i = 0; i < STRIDE; i++) { const t = a[b + i]; a[b + i] = a[c + i]; a[c + i] = t; }
    }
    return a;
  }
  G.fix = fix;
  // rounded box: subdivided cube pushed out from an inner box
  G.box = function (w, h, d, r) {
    const hw = w / 2, hh = h / 2, hd = d / 2, a = [];
    r = Math.min(r || 0, hw, hh, hd);
    const ticks = (e) => r > 0.001 ? [-e, -e + r * 0.3, -e + r, e - r, e - r * 0.3, e] : [-e, e];
    const ix = hw - r, iy = hh - r, iz = hd - r;
    const P = (x, y, z) => {
      if (r <= 0.001) return null;
      const cx = Math.max(-ix, Math.min(ix, x)), cy = Math.max(-iy, Math.min(iy, y)), cz = Math.max(-iz, Math.min(iz, z));
      let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz);
      if (l < 1e-6) return null; dx /= l; dy /= l; dz /= l;
      return [[cx + dx * r, cy + dy * r, cz + dz * r], [dx, dy, dz]];
    };
    const face = (axis, sign) => {
      const [u, v, e1, e2, e0] = axis === 0 ? [2, 1, hd, hh, hw] : axis === 1 ? [0, 2, hw, hd, hh] : [0, 1, hw, hh, hd];
      const tu = ticks(e1), tv = ticks(e2);
      const vert = (iu, iv) => {
        const p = [0, 0, 0]; p[axis] = sign * e0; p[u] = tu[iu]; p[v] = tv[iv];
        const nn = [0, 0, 0]; nn[axis] = sign;
        const q = P(p[0], p[1], p[2]);
        return { p: q ? q[0] : p, n: q ? q[1] : nn, uv: [(tu[iu] + e1) / (2 * e1), (tv[iv] + e2) / (2 * e2)] };
      };
      for (let i = 0; i < tu.length - 1; i++) for (let j = 0; j < tv.length - 1; j++) {
        let A = vert(i, j), B = vert(i + 1, j), Cc = vert(i + 1, j + 1), D = vert(i, j + 1);
        // keep counter-clockwise winding facing outwards
        const flip = (axis === 1) ? sign < 0 : sign > 0;
        if (axis === 0 ? sign < 0 : flip) { const t = B; B = D; D = t; }
        push(a, A.p, A.n, A.uv); push(a, B.p, B.n, B.uv); push(a, Cc.p, Cc.n, Cc.uv);
        push(a, A.p, A.n, A.uv); push(a, Cc.p, Cc.n, Cc.uv); push(a, D.p, D.n, D.uv);
      }
    };
    for (let ax = 0; ax < 3; ax++) { face(ax, 1); face(ax, -1); }
    return fix(a);
  };
  // lathe around Y. pts = [[radius, y], ...] from bottom to top
  G.lathe = function (pts, seg, smooth) {
    const a = [], N = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      let dr = p1[0] - p0[0], dy = p1[1] - p0[1]; const l = Math.hypot(dr, dy) || 1;
      N.push([dy / l, -dr / l]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      let n0 = N[i], n1 = N[i + 1];
      if (smooth === false) { const dr = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dr, dy) || 1; n0 = n1 = [dy / l, -dr / l]; }
      for (let s = 0; s < seg; s++) {
        const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const v = (pt, nn, c, sn, u, vv) => ({ p: [pt[0] * c, pt[1], pt[0] * sn], n: [nn[0] * c, nn[1], nn[0] * sn], uv: [u, vv] });
        const A = v(pts[i], n0, c0, s0, s / seg, i / pts.length), B = v(pts[i], n0, c1, s1, (s + 1) / seg, i / pts.length),
          Cc = v(pts[i + 1], n1, c1, s1, (s + 1) / seg, (i + 1) / pts.length), D = v(pts[i + 1], n1, c0, s0, s / seg, (i + 1) / pts.length);
        push(a, A.p, A.n, A.uv); push(a, Cc.p, Cc.n, Cc.uv); push(a, B.p, B.n, B.uv);
        push(a, A.p, A.n, A.uv); push(a, D.p, D.n, D.uv); push(a, Cc.p, Cc.n, Cc.uv);
      }
    }
    return fix(a);
  };
  G.sphere = function (r, seg, rings) {
    seg = seg || 16; rings = rings || 10; const pts = [];
    for (let i = 0; i <= rings; i++) { const t = -Math.PI / 2 + Math.PI * i / rings; pts.push([Math.cos(t) * r, Math.sin(t) * r]); }
    pts[0][0] = 0; pts[rings][0] = 0;
    return G.lathe(pts, seg);
  };
  G.cyl = function (rt, rb, h, seg, caps) {
    seg = seg || 12; const a = G.lathe([[rb, -h / 2], [rt, h / 2]], seg, false);
    if (caps !== false) {
      if (rt > 0) a.push(...G.disc(rt, seg, h / 2, 1));
      if (rb > 0) a.push(...G.disc(rb, seg, -h / 2, -1));
    }
    return a;
  };
  G.disc = function (r, seg, y, dir) {
    const a = []; y = y || 0; dir = dir || 1;
    for (let s = 0; s < seg; s++) {
      const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2;
      const p0 = [Math.cos(a0) * r, y, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, y, Math.sin(a1) * r];
      const uv = p => [p[0] / (2 * r) + 0.5, p[2] / (2 * r) + 0.5], n = [0, dir, 0], c = [0, y, 0];
      if (dir > 0) { push(a, c, n, [0.5, 0.5]); push(a, p1, n, uv(p1)); push(a, p0, n, uv(p0)); }
      else { push(a, c, n, [0.5, 0.5]); push(a, p0, n, uv(p0)); push(a, p1, n, uv(p1)); }
    }
    return fix(a);
  };
  G.torus = function (R, r, seg, tube) {
    seg = seg || 24; tube = tube || 8; const a = [];
    const P = (i, j) => { const u = i / seg * Math.PI * 2, v = j / tube * Math.PI * 2, cx = Math.cos(u), sx = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      return { p: [(R + r * cv) * cx, r * sv, (R + r * cv) * sx], n: [cv * cx, sv, cv * sx], uv: [i / seg, j / tube] }; };
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
      const A = P(i, j), B = P(i + 1, j), Cc = P(i + 1, j + 1), D = P(i, j + 1);
      push(a, A.p, A.n, A.uv); push(a, Cc.p, Cc.n, Cc.uv); push(a, B.p, B.n, B.uv);
      push(a, A.p, A.n, A.uv); push(a, D.p, D.n, D.uv); push(a, Cc.p, Cc.n, Cc.uv);
    }
    return fix(a);
  };
  G.quad = function (w, h) { // facing +Z, centered
    const a = [], n = [0, 0, 1], x = w / 2, y = h / 2;
    push(a, [-x, -y, 0], n, [0, 1]); push(a, [x, -y, 0], n, [1, 1]); push(a, [x, y, 0], n, [1, 0]);
    push(a, [-x, -y, 0], n, [0, 1]); push(a, [x, y, 0], n, [1, 0]); push(a, [-x, y, 0], n, [0, 0]);
    return a;
  };
  G.plane = function (w, d, nx, nz) { // facing +Y, subdivided
    const a = [], n = [0, 1, 0]; nx = nx || 1; nz = nz || 1;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = -w / 2 + w * i / nx, x1 = -w / 2 + w * (i + 1) / nx, z0 = -d / 2 + d * j / nz, z1 = -d / 2 + d * (j + 1) / nz;
      const uv = (x, z) => [x / w + 0.5, z / d + 0.5];
      push(a, [x0, 0, z0], n, uv(x0, z0)); push(a, [x0, 0, z1], n, uv(x0, z1)); push(a, [x1, 0, z1], n, uv(x1, z1));
      push(a, [x0, 0, z0], n, uv(x0, z0)); push(a, [x1, 0, z1], n, uv(x1, z1)); push(a, [x1, 0, z0], n, uv(x1, z0));
    }
    return a;
  };
  G.egg = (r, h, seg) => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12, ang = -Math.PI / 2 + Math.PI * t, k = t > 0.5 ? 0.82 + 0.18 * (1 - (t - 0.5) * 2) : 1; pts.push([Math.cos(ang) * r * k, Math.sin(ang) * h / 2 * (t > 0.5 ? 1.15 : 1)]); } pts[0][0] = 0; pts[12][0] = 0; return G.lathe(pts, seg || 16); };
  G.ico = function (r, jag, seed) { // chunky low-poly blob (for bushes/rocks)
    const t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    let sd = seed || 1; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const P = V.map(v => { const l = Math.hypot(...v), k = r * (1 + (rnd() - 0.5) * (jag || 0)); return v.map(c => c / l * k); });
    const a = [];
    for (const f of F) {
      const p0 = P[f[0]], p1 = P[f[1]], p2 = P[f[2]];
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      push(a, p0, [nx, ny, nz], [0, 0]); push(a, p1, [nx, ny, nz], [1, 0]); push(a, p2, [nx, ny, nz], [0, 1]);
    }
    return a;
  };
  // transform + recolor a geometry (returns new array)
  G.xf = function (geo, m, col) {
    col = col ? M.col(col) : null;
    // normal matrix = inverse transpose of upper 3x3
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc || 1;
    const n00 = A / det, n01 = B / det, n02 = Cc / det, n10 = -(b * i - c * h) / det, n11 = (a * i - c * g) / det, n12 = -(a * h - b * g) / det,
      n20 = (b * f - c * e) / det, n21 = -(a * f - c * d) / det, n22 = (a * e - b * d) / det;
    const o = new Array(geo.length);
    for (let k = 0; k < geo.length; k += STRIDE) {
      const x = geo[k], y = geo[k + 1], z = geo[k + 2], nx = geo[k + 3], ny = geo[k + 4], nz = geo[k + 5];
      o[k] = m[0] * x + m[4] * y + m[8] * z + m[12]; o[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; o[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      let qx = n00 * nx + n01 * ny + n02 * nz, qy = n10 * nx + n11 * ny + n12 * nz, qz = n20 * nx + n21 * ny + n22 * nz; const l = Math.hypot(qx, qy, qz) || 1;
      o[k + 3] = qx / l; o[k + 4] = qy / l; o[k + 5] = qz / l;
      o[k + 6] = col ? col[0] * geo[k + 6] : geo[k + 6]; o[k + 7] = col ? col[1] * geo[k + 7] : geo[k + 7]; o[k + 8] = col ? col[2] * geo[k + 8] : geo[k + 8];
      o[k + 9] = geo[k + 9]; o[k + 10] = geo[k + 10];
    }
    return o;
  };
  G.merge = (...gs) => [].concat(...gs);

  // ================================================================ PROCEDURAL TEXTURES
  // Every surface texture is drawn on a canvas at start-up (512px on Medium/High, 256px on Low). Brightness doubles as height:
  // the shader turns it into bumps (mortar and cracks sink, stone faces stand up). A texture can also carry a glow mask in its
  // alpha channel (alpha < 1 = glowing): lava seams, void veins, circuit traces. The zone says what colour they glow.
  function noiseTex(size, fn) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    let gm = null; const glow = () => { if (!gm) { const k = document.createElement('canvas'); k.width = k.height = size; gm = k.getContext('2d'); gm.fillStyle = '#000'; gm.fillRect(0, 0, size, size); } return gm; };
    fn(x, size, glow);
    if (gm) { // glow mask -> alpha (255 = no glow, 128 = full glow)
      const im = x.getImageData(0, 0, size, size), gd = gm.getImageData(0, 0, size, size).data, d = im.data;
      for (let i = 0; i < d.length; i += 4) d[i + 3] = 255 - (gd[i] >> 1);
      x.putImageData(im, 0, 0);
    }
    return c;
  }
  let sd = 99; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const grey = (v, a) => a === undefined ? `rgb(${v | 0},${v | 0},${v | 0})` : `rgba(${v | 0},${v | 0},${v | 0},${a})`;
  // draw fn at x, and again shifted by +-s so the texture tiles seamlessly
  function wrap(s, x, y, w, h, fn) { for (const ox of [0, -s, s]) for (const oy of [0, -s, s]) { if (x + ox > s || x + ox + w < 0 || y + oy > s || y + oy + h < 0) continue; fn(x + ox, y + oy); } }
  function speckle(g, s, n, a, sz) { for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? grey(0, rnd() * a) : grey(255, rnd() * a * 0.7); const k = (sz || 2) * (0.5 + rnd()); g.fillRect(rnd() * s, rnd() * s, k, k); } }
  // everything below is drawn again shifted by the texture size where it crosses an edge, so no seams show when the texture repeats
  const OFFS = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  function each(g, x0, y0, x1, y1, fn) { const s = g.canvas.width; for (const [ox, oy] of OFFS) { const dx = ox * s, dy = oy * s; if (x1 + dx < 0 || x0 + dx > s || y1 + dy < 0 || y0 + dy > s) continue; fn(dx, dy); } }
  function crackLine(g, x, y, len, w, dark, light, ang) { let a = ang === undefined ? rnd() * 6.283 : ang; g.lineCap = 'round';
    const pts = [[x, y]]; for (let k = 0; k < len; k++) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * 6; y += Math.sin(a) * 6; pts.push([x, y]); }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    each(g, Math.min(...xs) - w, Math.min(...ys) - w, Math.max(...xs) + w, Math.max(...ys) + w, (dx, dy) => {
      if (light) { g.strokeStyle = light; g.lineWidth = w * 0.8; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + 1 + dx, p[1] + 1 + dy) : g.moveTo(p[0] + 1 + dx, p[1] + 1 + dy)); g.stroke(); }
      g.strokeStyle = dark; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy)); g.stroke(); });
    return pts; }
  function blob(g, x, y, r, n, jag) { const pts = []; for (let k = 0; k < n; k++) { const a = k / n * 6.283, rr = r * (1 - jag / 2 + rnd() * jag); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    each(g, x - r * 1.5, y - r * 1.5, x + r * 1.5, y + r * 1.5, (dx, dy) => { g.beginPath(); for (const p of pts) g.lineTo(x + dx + p[0], y + dy + p[1]); g.closePath(); g.fill(); }); }
  function ell(g, x, y, rx, ry, a) { each(g, x - rx, y - rx, x + rx, y + rx, (dx, dy) => { g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, a, 0, 7); g.fill(); }); }
  // rows of stone blocks with bevelled edges, chips and cracks. o: {rows, n (blocks per row) or w: [min,max], gap, base, vary, bevel, chip, crack, round, stagger}
  function blocks(g, s, o, each) {
    g.fillStyle = grey(o.mortar === undefined ? 60 : o.mortar); g.fillRect(0, 0, s, s);
    const rows = o.rows, bh = s / rows, gap = o.gap * s / 256;
    for (let r = 0; r < rows; r++) {
      const ws = []; let tot = 0; const n = o.n || 4; for (let k = 0; k < n; k++) { const w = 0.6 + rnd() * 0.8; ws.push(w); tot += w; }
      let x = o.stagger ? (r % 2) * s / n * 0.5 : rnd() * s;
      for (let k = 0; k < n; k++) { const w = ws[k] / tot * s, v = o.base + (rnd() - 0.5) * o.vary * 2, y = r * bh;
        wrap(s, x, y, w, bh, (bx, by) => {
          const x0 = bx + gap / 2, y0 = by + gap / 2, ww = w - gap, hh = bh - gap, rr = Math.min(o.round || 3, ww / 3, hh / 3) * s / 256;
          g.fillStyle = grey(v); g.beginPath(); g.moveTo(x0 + rr, y0); g.arcTo(x0 + ww, y0, x0 + ww, y0 + hh, rr); g.arcTo(x0 + ww, y0 + hh, x0, y0 + hh, rr); g.arcTo(x0, y0 + hh, x0, y0, rr); g.arcTo(x0, y0, x0 + ww, y0, rr); g.closePath(); g.fill();
          const bv = (o.bevel || 3) * s / 256; g.save(); g.clip();
          const gr = g.createLinearGradient(0, y0, 0, y0 + hh); gr.addColorStop(0, grey(255, 0.1)); gr.addColorStop(0.5, grey(255, 0)); gr.addColorStop(1, grey(0, 0.14)); g.fillStyle = gr; g.fillRect(x0, y0, ww, hh);
          g.fillStyle = grey(255, 0.22); g.fillRect(x0, y0, ww, bv); g.fillRect(x0, y0, bv, hh); g.fillStyle = grey(0, 0.28); g.fillRect(x0, y0 + hh - bv, ww, bv); g.fillRect(x0 + ww - bv, y0, bv, hh);
          for (let i = 0; i < ww * hh / 90; i++) { g.fillStyle = rnd() < 0.5 ? grey(0, rnd() * 0.12) : grey(255, rnd() * 0.08); const q = (1 + rnd() * 3) * s / 256; g.fillRect(x0 + rnd() * ww, y0 + rnd() * hh, q, q); }
          for (let i = 0; i < (o.chip || 0); i++) if (rnd() < 0.5) { g.fillStyle = grey(0, 0.35); const e = rnd() < 0.5; blob(g, e ? x0 + rnd() * ww : (rnd() < 0.5 ? x0 : x0 + ww), e ? (rnd() < 0.5 ? y0 : y0 + hh) : y0 + rnd() * hh, (3 + rnd() * 6) * s / 256, 6, 0.8); }
          if (rnd() < (o.crack || 0)) crackLine(g, x0 + rnd() * ww, y0 + rnd() * hh, 4 + rnd() * 6 | 0, 1.4 * s / 256, grey(20, 0.6), grey(255, 0.12));
          if (each) each(g, x0, y0, ww, hh, v);
          g.restore(); });
        x += w; }
    }
  }
  const TEXGEN = {
    white: (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); },
    // Update 7: a lit window: warm glass (brighter in the middle, like a lamp inside), a dark wooden frame and a cross of glazing bars
    window: (g, s) => { const gr = g.createRadialGradient(s / 2, s * 0.55, s * 0.05, s / 2, s * 0.5, s * 0.7); gr.addColorStop(0, '#fff4c8'); gr.addColorStop(0.45, '#ffc864'); gr.addColorStop(1, '#d8782a');
      g.fillStyle = gr; g.fillRect(0, 0, s, s); g.fillStyle = '#2a1a10'; const f = s * 0.09, b = s * 0.05; g.fillRect(0, 0, s, f); g.fillRect(0, s - f, s, f); g.fillRect(0, 0, f, s); g.fillRect(s - f, 0, f, s);
      g.fillRect(s / 2 - b / 2, 0, b, s); g.fillRect(0, s * 0.45 - b / 2, s, b); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(f * 1.4, f * 1.4, s * 0.12, s * 0.28); },
    grass: (g, s) => {
      g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) { g.fillStyle = grey(rnd() < 0.5 ? 255 : 0, 0.06 + rnd() * 0.06); blob(g, rnd() * s, rnd() * s, (10 + rnd() * 30) * s / 256, 9, 0.5); }
      for (let i = 0; i < 5200 * s / 512; i++) { const v = 140 + rnd() * 115, x = rnd() * s, y = rnd() * s, h = (3 + rnd() * 7) * s / 256, a = (rnd() - 0.5) * 0.8;
        g.strokeStyle = grey(v); g.lineWidth = 1.2 * s / 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * h, y - Math.cos(a) * h); g.stroke(); }
      speckle(g, s, 500, 0.15);
    },
    dirt: (g, s) => {
      g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 70; i++) { g.fillStyle = grey(rnd() < 0.5 ? 0 : 255, 0.05 + rnd() * 0.07); blob(g, rnd() * s, rnd() * s, (8 + rnd() * 28) * s / 256, 8, 0.6); }
      for (let i = 0; i < 340 * s / 256; i++) { const v = 110 + rnd() * 130, x = rnd() * s, y = rnd() * s, r = (1.5 + rnd() * 4.5) * s / 256; g.fillStyle = grey(v); ell(g, x, y, r, r * (0.6 + rnd() * 0.4), rnd() * 3); g.fillStyle = grey(255, 0.25); ell(g, x - r * 0.25, y - r * 0.3, r * 0.4, r * 0.25, 0); }
      speckle(g, s, 900, 0.18);
    },
    // woods floor: packed earth, fallen leaves, twigs and roots
    forest: (g, s) => {
      TEXGEN.dirt(g, s);
      g.lineCap = 'round'; for (let i = 0; i < 7; i++) { g.strokeStyle = grey(55, 0.8); g.lineWidth = (3 + rnd() * 5) * s / 256; let x = rnd() * s, y = rnd() * s, a = rnd() * 6.3; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 10; k++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * 14 * s / 256; y += Math.sin(a) * 14 * s / 256; g.lineTo(x, y); } g.stroke(); g.strokeStyle = grey(255, 0.12); g.lineWidth *= 0.35; g.stroke(); }
      for (let i = 0; i < 260 * s / 256; i++) { const x = rnd() * s, y = rnd() * s, r = (3 + rnd() * 5) * s / 256, a = rnd() * 6.3; g.fillStyle = grey(90 + rnd() * 110); ell(g, x, y, r, r * 0.45, a);
        g.strokeStyle = grey(0, 0.3); g.lineWidth = 0.8 * s / 256; g.beginPath(); g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
      for (let i = 0; i < 40; i++) { g.strokeStyle = grey(70 + rnd() * 60); g.lineWidth = 1.5 * s / 256; const x = rnd() * s, y = rnd() * s, a = rnd() * 6.3, l = (6 + rnd() * 14) * s / 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    },
    tile: (g, s) => { blocks(g, s, { rows: 4, n: 4, gap: 5, base: 200, vary: 22, bevel: 3, chip: 2, crack: 0.25, stagger: true, mortar: 70 }); speckle(g, s, 600, 0.1); },
    wood: (g, s) => {
      const n = 4, h = s / n;
      for (let j = 0; j < n; j++) {
        const v = 175 + rnd() * 55; g.fillStyle = grey(v); g.fillRect(0, j * h, s, h);
        for (let k = 0; k < 26; k++) { g.strokeStyle = grey(rnd() < 0.7 ? 0 : 255, 0.04 + rnd() * 0.09); g.lineWidth = (0.6 + rnd() * 1.6) * s / 256; g.beginPath(); const y = j * h + rnd() * h; g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + (rnd() - 0.5) * 8, s * 0.6, y + (rnd() - 0.5) * 8, s, y); g.stroke(); }
        if (rnd() < 0.6) { const kx = rnd() * s, ky = j * h + h * (0.3 + rnd() * 0.4); g.strokeStyle = grey(0, 0.25); g.lineWidth = 1.2 * s / 256; for (let r = 2; r < 9; r += 2.2) { g.beginPath(); g.ellipse(kx, ky, r * 1.8 * s / 256, r * s / 256, 0, 0, 7); g.stroke(); } }
        g.fillStyle = grey(0, 0.5); g.fillRect(0, j * h, s, 3 * s / 256); g.fillStyle = grey(255, 0.18); g.fillRect(0, j * h + 3 * s / 256, s, 2 * s / 256);
        const cx = (j * 97 * s / 256) % s; g.fillStyle = grey(0, 0.4); g.fillRect(cx, j * h, 3 * s / 256, h);
        for (const nx of [cx - 8 * s / 256, cx + 10 * s / 256]) for (const ny of [j * h + h * 0.25, j * h + h * 0.75]) { g.fillStyle = grey(40); g.beginPath(); g.arc(nx, ny, 2 * s / 256, 0, 7); g.fill(); g.fillStyle = grey(255, 0.4); g.beginPath(); g.arc(nx - 0.6, ny - 0.6, 0.8 * s / 256, 0, 7); g.fill(); }
      }
    },
    sand: (g, s) => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) { g.fillStyle = grey(rnd() < 0.5 ? 0 : 255, 0.04 + rnd() * 0.05); blob(g, rnd() * s, rnd() * s, (14 + rnd() * 40) * s / 256, 10, 0.5); }
      for (let y = 0; y < s; y += 9 * s / 256) { g.strokeStyle = grey(0, 0.09); g.lineWidth = 2.5 * s / 256; g.beginPath(); for (let x = 0; x <= s; x += 6) g.lineTo(x, y + Math.sin(x / s * Math.PI * 4 + y * 0.07) * 4 * s / 256); g.stroke();
        g.strokeStyle = grey(255, 0.12); g.lineWidth = 1.2 * s / 256; g.beginPath(); for (let x = 0; x <= s; x += 6) g.lineTo(x, y - 2 * s / 256 + Math.sin(x / s * Math.PI * 4 + y * 0.07) * 4 * s / 256); g.stroke(); }
      for (let i = 0; i < 5000 * s / 256; i++) { g.fillStyle = grey(150 + rnd() * 105); g.fillRect(rnd() * s, rnd() * s, s / 256, s / 256); }
    },
    candy: (g, s) => {
      g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s);
      const cols = ['#ff6fae', '#7fd8ff', '#fff176', '#b388ff', '#9cff8f', '#ffffff'];
      for (let i = 0; i < 160; i++) { g.save(); g.translate(rnd() * s, rnd() * s); g.rotate(rnd() * 3.14); g.fillStyle = cols[rnd() * cols.length | 0]; g.fillRect(-5, -1.5, 10, 3); g.restore(); }
    },
    metal: (g, s) => {
      g.fillStyle = '#c0c0c0'; g.fillRect(0, 0, s, s); const n = 2, w = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const gr = g.createLinearGradient(i * w, j * w, i * w + w, j * w + w); gr.addColorStop(0, '#e4e4e4'); gr.addColorStop(1, '#a8a8a8');
        g.fillStyle = gr; g.fillRect(i * w + 3, j * w + 3, w - 6, w - 6);
        for (let k = 0; k < 40; k++) { g.strokeStyle = grey(rnd() < 0.5 ? 255 : 0, 0.05); g.lineWidth = 1; const y = j * w + rnd() * w; g.beginPath(); g.moveTo(i * w, y); g.lineTo(i * w + w, y); g.stroke(); }
        for (const [a, b] of [[10, 10], [w - 14, 10], [10, w - 14], [w - 14, w - 14]]) { g.fillStyle = '#6a6a6a'; g.beginPath(); g.arc(i * w + a + 2, j * w + b + 2, 4 * s / 256, 0, 7); g.fill(); g.fillStyle = '#f0f0f0'; g.beginPath(); g.arc(i * w + a + 1, j * w + b + 1, 1.6 * s / 256, 0, 7); g.fill(); }
      }
      g.strokeStyle = grey(0, 0.4); g.lineWidth = 4 * s / 256; g.strokeRect(1, 1, s - 2, s - 2); g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
      for (let i = 0; i < 30; i++) { g.fillStyle = grey(40, 0.12); blob(g, rnd() * s, rnd() * s, (3 + rnd() * 10) * s / 256, 7, 0.7); }
    },
    brick: (g, s) => { blocks(g, s, { rows: 8, n: 4, gap: 6, base: 186, vary: 30, bevel: 3, chip: 3, crack: 0.2, stagger: true, mortar: 64, round: 2 }); speckle(g, s, 900, 0.12); },
    cobble: (g, s) => { // irregular worn cobblestones with dark gaps
      g.fillStyle = grey(48); g.fillRect(0, 0, s, s); const n = 8, w = s / n;
      for (let j = 0; j < n; j++) for (let i = -1; i <= n; i++) {
        const cx = (i + (j % 2) * 0.5 + 0.5) * w + (rnd() - 0.5) * w * 0.25, cy = (j + 0.5) * w + (rnd() - 0.5) * w * 0.2, v = 120 + rnd() * 60, rw = w * (0.42 + rnd() * 0.08), rh = w * (0.38 + rnd() * 0.07), pts = [];
        for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283 + rnd() * 0.3; pts.push([Math.cos(a) * rw * (0.85 + rnd() * 0.2), Math.sin(a) * rh * (0.85 + rnd() * 0.2)]); }
        wrap(s, cx - rw, cy - rh, rw * 2, rh * 2, (bx, by) => { const x = bx + rw, y = by + rh;
          g.fillStyle = grey(v); g.beginPath(); pts.forEach(p => g.lineTo(x + p[0], y + p[1])); g.closePath(); g.fill(); g.save(); g.clip();
          const gr = g.createRadialGradient(x - rw * 0.3, y - rh * 0.35, 1, x, y, rw * 1.1); gr.addColorStop(0, grey(255, 0.22)); gr.addColorStop(0.6, grey(255, 0)); gr.addColorStop(1, grey(0, 0.32)); g.fillStyle = gr; g.fillRect(x - rw, y - rh, rw * 2, rh * 2);
          for (let k = 0; k < 10; k++) { g.fillStyle = rnd() < 0.5 ? grey(0, rnd() * 0.12) : grey(255, rnd() * 0.08); g.fillRect(x + (rnd() - 0.5) * rw * 1.6, y + (rnd() - 0.5) * rh * 1.6, (2 + rnd() * 4) * s / 256, (2 + rnd() * 3) * s / 256); }
          g.restore(); });
      }
      speckle(g, s, 1200, 0.16);
    },
    bark: (g, s) => { // vertical grooves
      g.fillStyle = '#a8a8a8'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) { const x = rnd() * s, w = (2 + rnd() * 6) * s / 256, v = 60 + rnd() * 100; g.fillStyle = grey(v);
        g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= s; y += 16) g.lineTo(x + Math.sin(y * 0.05 + i) * 4, y); g.lineTo(x + w, s); for (let y = s; y >= 0; y -= 16) g.lineTo(x + w + Math.sin(y * 0.05 + i) * 4, y); g.fill(); }
      for (let i = 0; i < 500; i++) { g.fillStyle = grey(0, rnd() * 0.18); g.fillRect(rnd() * s, rnd() * s, 3 * s / 256, s / 256); }
    },
    rock: (g, s) => {
      g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) { const v = 110 + rnd() * 120, x = rnd() * s, y = rnd() * s, r = (8 + rnd() * 28) * s / 256; g.fillStyle = grey(v);
        blob(g, x, y, r, 7, 0.5); g.fillStyle = grey(255, 0.12); blob(g, x - r * 0.2, y - r * 0.3, r * 0.5, 6, 0.6); }
      for (let i = 0; i < 26; i++) crackLine(g, rnd() * s, rnd() * s, 3 + rnd() * 5 | 0, 1.6 * s / 256, grey(0, 0.35), grey(255, 0.1));
      speckle(g, s, 1500, 0.16);
    },
    // woods walls: rough stone blocks under creeping moss and hanging roots
    mossy: (g, s) => {
      blocks(g, s, { rows: 6, n: 3, gap: 7, base: 168, vary: 34, bevel: 4, chip: 4, crack: 0.35, mortar: 52, round: 6 });
      for (let i = 0; i < 70; i++) { const y = rnd() < 0.6 ? rnd() * s * 0.35 : rnd() * s, r = (6 + rnd() * 22) * s / 256; g.fillStyle = `rgba(${150 + rnd() * 40 | 0},${200 + rnd() * 40 | 0},${120 + rnd() * 30 | 0},${0.35 + rnd() * 0.3})`; blob(g, rnd() * s, y, r, 9, 0.7); }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${170 + rnd() * 60 | 0},${210 + rnd() * 40 | 0},${140},${0.4})`; g.fillRect(rnd() * s, rnd() * s * 0.4, 2 * s / 256, 2 * s / 256); }
      g.lineCap = 'round'; for (let i = 0; i < 9; i++) { let x = rnd() * s, y = s; g.strokeStyle = grey(50, 0.7); g.lineWidth = (1.5 + rnd() * 2) * s / 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * 10; y -= 10 * s / 256; g.lineTo(x, y); } g.stroke(); }
    },
    // crypt walls: big ashlar blocks, grime streaks running down from the top, carved niches
    crypt: (g, s) => {
      blocks(g, s, { rows: 4, n: 3, gap: 6, base: 176, vary: 24, bevel: 4, chip: 4, crack: 0.45, mortar: 46, round: 2 }, (g2, x, y, w, h) => {
        if (rnd() < 0.18) { g2.fillStyle = grey(30, 0.75); const nw = w * 0.22, nh = h * 0.55; g2.fillRect(x + w / 2 - nw / 2, y + h * 0.25, nw, nh); g2.beginPath(); g2.arc(x + w / 2, y + h * 0.25, nw / 2, Math.PI, 0); g2.fill(); g2.fillStyle = grey(255, 0.15); g2.fillRect(x + w / 2 - nw / 2, y + h * 0.25 + nh, nw, 2 * s / 256); }
        if (rnd() < 0.2) { g2.strokeStyle = grey(30, 0.5); g2.lineWidth = 2 * s / 256; const cx = x + w * (0.2 + rnd() * 0.6), cy = y + h * 0.5; g2.beginPath(); g2.moveTo(cx, cy - h * 0.25); g2.lineTo(cx, cy + h * 0.25); g2.moveTo(cx - h * 0.12, cy - h * 0.1); g2.lineTo(cx + h * 0.12, cy - h * 0.1); g2.stroke(); } });
      for (let i = 0; i < 40; i++) { const x = rnd() * s, w = (2 + rnd() * 8) * s / 256, l = (30 + rnd() * 120) * s / 256, gr = g.createLinearGradient(0, s - l, 0, s); gr.addColorStop(0, grey(0, 0)); gr.addColorStop(1, grey(0, 0.18 + rnd() * 0.15)); g.fillStyle = gr; g.fillRect(x, s - l, w, l); }
      speckle(g, s, 1400, 0.14);
    },
    // frost floor: cracked ice plates with cloudy depths and trapped bubbles
    ice: (g, s) => {
      g.fillStyle = grey(196); g.fillRect(0, 0, s, s);
      for (let i = 0; i < 50; i++) { g.fillStyle = grey(rnd() < 0.6 ? 255 : 120, 0.06 + rnd() * 0.08); const x = rnd() * s, y = rnd() * s, r = (12 + rnd() * 36) * s / 256; blob(g, x, y, r, 10, 0.5); }
      for (let i = 0; i < 14; i++) { const x = rnd() * s, y = rnd() * s, p = crackLine(g, x, y, 10 + rnd() * 14 | 0, 2.2 * s / 256, grey(70, 0.75), grey(255, 0.55));
        for (let k = 0; k < 3; k++) { const q = p[(rnd() * p.length) | 0]; crackLine(g, q[0], q[1], 3 + rnd() * 4 | 0, 1.1 * s / 256, grey(90, 0.6), grey(255, 0.4)); } }
      for (let i = 0; i < 160; i++) { const x = rnd() * s, y = rnd() * s, r = (0.8 + rnd() * 2.2) * s / 256; g.strokeStyle = grey(255, 0.5); g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
      speckle(g, s, 600, 0.08);
    },
    // frost walls: layered rock with frost bands
    iceRock: (g, s) => {
      TEXGEN.rock(g, s);
      for (let i = 0; i < 20; i++) { const y = rnd() * s, h = (3 + rnd() * 10) * s / 256; g.fillStyle = grey(255, 0.12 + rnd() * 0.18); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 5); g.lineTo(s, y + h); for (let x = s; x >= 0; x -= 16) g.lineTo(x, y + h + Math.sin(x * 0.04 + i) * 4); g.fill(); }
      for (let i = 0; i < 400; i++) { g.fillStyle = grey(255, 0.6); g.fillRect(rnd() * s, rnd() * s, s / 256, s / 256); }
    },
    // ember floor: cracked basalt plates; the seams glow like lava
    basalt: (g, s, glow) => {
      g.fillStyle = grey(30); g.fillRect(0, 0, s, s); const n = 5, w = s / n, gm = glow();
      const P = []; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) P.push([i * w + (i % n ? (rnd() - 0.5) * w * 0.5 : 0), j * w + (j % n ? (rnd() - 0.5) * w * 0.5 : 0)]);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = [P[j * (n + 1) + i], P[j * (n + 1) + i + 1], P[(j + 1) * (n + 1) + i + 1], P[(j + 1) * (n + 1) + i]], v = 120 + rnd() * 60, cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2, k = 0.86;
        g.fillStyle = grey(v); g.beginPath(); q.forEach(p => g.lineTo(cx + (p[0] - cx) * k, cy + (p[1] - cy) * k)); g.closePath(); g.fill(); g.save(); g.clip();
        const gr = g.createLinearGradient(cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2); gr.addColorStop(0, grey(255, 0.16)); gr.addColorStop(1, grey(0, 0.3)); g.fillStyle = gr; g.fillRect(cx - w, cy - w, w * 2, w * 2);
        for (let k2 = 0; k2 < 30; k2++) { g.fillStyle = grey(rnd() < 0.5 ? 0 : 255, rnd() * 0.1); g.fillRect(cx + (rnd() - 0.5) * w, cy + (rnd() - 0.5) * w, 3 * s / 256, 2 * s / 256); }
        g.restore();
        if (rnd() < 0.55) { gm.strokeStyle = grey(255, 0.25 + rnd() * 0.75); gm.lineWidth = (2 + rnd() * 3) * s / 256; gm.beginPath(); const k0 = rnd() * 4 | 0; for (let e = 0; e < 2; e++) { const a0 = q[(k0 + e) % 4], a1 = q[(k0 + e + 1) % 4]; gm.moveTo(a0[0], a0[1]); gm.lineTo(a1[0], a1[1]); } gm.stroke(); } }
      for (let i = 0; i < 10; i++) { const p = crackLine(g, rnd() * s, rnd() * s, 5 + rnd() * 6 | 0, 2 * s / 256, grey(15, 0.9)); gm.strokeStyle = grey(255, 0.9); gm.lineWidth = 2.2 * s / 256; gm.beginPath(); p.forEach((q, k) => k ? gm.lineTo(q[0], q[1]) : gm.moveTo(q[0], q[1])); gm.stroke(); }
    },
    // storm floor: slate flagstones, uneven sizes
    slate: (g, s) => {
      g.fillStyle = grey(50); g.fillRect(0, 0, s, s); const n = 6, w = s / n, used = new Set();
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if (used.has(j * n + i)) continue; const big = i < n - 1 && j < n - 1 && !used.has(j * n + i + 1) && rnd() < 0.3, sz = big ? 2 : 1; if (big) [j * n + i + 1, (j + 1) * n + i, (j + 1) * n + i + 1].forEach(k => used.add(k));
        const x0 = i * w + 3 * s / 256, y0 = j * w + 3 * s / 256, ww = w * sz - 6 * s / 256, v = 140 + rnd() * 50; g.fillStyle = grey(v); g.fillRect(x0, y0, ww, ww);
        for (let k = 0; k < 6; k++) { g.strokeStyle = grey(rnd() < 0.5 ? 0 : 255, 0.06 + rnd() * 0.06); g.lineWidth = (1 + rnd() * 3) * s / 256; const yy = y0 + rnd() * ww; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + ww, yy + (rnd() - 0.5) * 10); g.stroke(); }
        g.fillStyle = grey(255, 0.18); g.fillRect(x0, y0, ww, 2 * s / 256); g.fillStyle = grey(0, 0.3); g.fillRect(x0, y0 + ww - 2 * s / 256, ww, 2 * s / 256);
        if (rnd() < 0.3) crackLine(g, x0 + rnd() * ww, y0 + rnd() * ww, 4, 1.2 * s / 256, grey(20, 0.6)); }
      speckle(g, s, 1200, 0.12);
    },
    // void floor: polished obsidian tiles with violet veins (glow)
    obsidian: (g, s, glow) => {
      const gm = glow(); blocks(g, s, { rows: 3, n: 3, gap: 5, base: 120, vary: 18, bevel: 2, chip: 1, crack: 0, mortar: 24, round: 1 }, (g2, x, y, w, h) => {
        for (let k = 0; k < 3; k++) { g2.fillStyle = grey(255, 0.08); g2.beginPath(); g2.moveTo(x + rnd() * w, y); g2.lineTo(x + rnd() * w + 20, y); g2.lineTo(x + rnd() * w, y + h); g2.lineTo(x + rnd() * w - 20, y + h); g2.fill(); } });
      for (let i = 0; i < 9; i++) { const p = crackLine(g, rnd() * s, rnd() * s, 8 + rnd() * 10 | 0, 1.6 * s / 256, grey(200, 0.55)); gm.strokeStyle = grey(255, 0.5 + rnd() * 0.5); gm.lineWidth = 2 * s / 256; gm.beginPath(); p.forEach((q, k) => k ? gm.lineTo(q[0], q[1]) : gm.moveTo(q[0], q[1])); gm.stroke(); }
    },
    // desert walls: sandstone blocks, worn edges, carved glyphs
    sandstone: (g, s) => {
      blocks(g, s, { rows: 5, n: 3, gap: 5, base: 196, vary: 22, bevel: 3, chip: 5, crack: 0.25, mortar: 110, round: 5 }, (g2, x, y, w, h) => {
        if (rnd() < 0.45) { g2.strokeStyle = grey(70, 0.55); g2.lineWidth = 2.2 * s / 256; g2.lineCap = 'round'; const n = 2 + rnd() * 3 | 0;
          for (let k = 0; k < n; k++) { const cx = x + w * (k + 0.5) / n, cy = y + h / 2, r = h * 0.22, t = rnd() * 5 | 0; g2.beginPath();
            if (t === 0) { g2.ellipse(cx, cy, r, r * 0.55, 0, 0, 7); g2.moveTo(cx + r * 0.25, cy); g2.arc(cx, cy, r * 0.25, 0, 7); }
            else if (t === 1) { g2.moveTo(cx, cy - r); g2.lineTo(cx, cy + r); g2.moveTo(cx - r * 0.6, cy - r * 0.4); g2.lineTo(cx + r * 0.6, cy - r * 0.4); g2.arc(cx, cy - r * 0.75, r * 0.3, 0, 7); }
            else if (t === 2) { g2.moveTo(cx - r, cy + r); g2.lineTo(cx, cy - r); g2.lineTo(cx + r, cy + r); g2.closePath(); }
            else if (t === 3) { g2.moveTo(cx - r, cy); g2.quadraticCurveTo(cx, cy - r * 1.4, cx + r, cy); g2.moveTo(cx - r * 0.5, cy + r * 0.6); g2.lineTo(cx + r * 0.5, cy + r * 0.6); }
            else { for (let q = 0; q < 3; q++) { g2.moveTo(cx - r, cy - r + q * r); g2.lineTo(cx + r, cy - r + q * r); } }
            g2.stroke(); } } });
      for (let i = 0; i < 40; i++) { g.fillStyle = grey(255, 0.06); blob(g, rnd() * s, rnd() * s, (10 + rnd() * 20) * s / 256, 8, 0.6); }
    },
    // abyss: living walls, veins that pulse (glow) and pores
    flesh: (g, s, glow) => {
      g.fillStyle = grey(150); g.fillRect(0, 0, s, s); const gm = glow();
      for (let i = 0; i < 80; i++) { const x = rnd() * s, y = rnd() * s, r = (10 + rnd() * 26) * s / 256; wrap(s, x - r, y - r, r * 2, r * 2, (bx, by) => { const gr = g.createRadialGradient(bx + r * 0.8, by + r * 0.7, 1, bx + r, by + r, r); gr.addColorStop(0, grey(255, 0.22)); gr.addColorStop(0.7, grey(255, 0.02)); gr.addColorStop(1, grey(0, 0.2)); g.fillStyle = gr; g.beginPath(); g.arc(bx + r, by + r, r, 0, 7); g.fill(); }); }
      const vein = (x, y, a, w, n, d) => { const p = crackLine(g, x, y, n, w, grey(40, 0.8), grey(255, 0.15), a); if (d < 2) for (let k = 0; k < 2; k++) { const q = p[(1 + rnd() * (p.length - 2)) | 0]; vein(q[0], q[1], a + (rnd() - 0.5) * 2, w * 0.6, n * 0.6 | 0, d + 1); }
        if (rnd() < 0.55) { gm.strokeStyle = grey(255, 0.6 + rnd() * 0.4); gm.lineWidth = w * 0.9; gm.lineCap = 'round'; gm.beginPath(); p.forEach((q, k) => k ? gm.lineTo(q[0], q[1]) : gm.moveTo(q[0], q[1])); gm.stroke(); } };
      for (let i = 0; i < 7; i++) vein(rnd() * s, rnd() * s, rnd() * 6.3, 3.2 * s / 256, 12, 0);
      for (let i = 0; i < 220; i++) { g.fillStyle = grey(30, 0.5); g.beginPath(); g.arc(rnd() * s, rnd() * s, (0.8 + rnd() * 1.8) * s / 256, 0, 7); g.fill(); }
    },
    // glitch: dark panels with circuit traces (glow)
    circuit: (g, s, glow) => {
      const gm = glow(); blocks(g, s, { rows: 4, n: 4, gap: 4, base: 70, vary: 14, bevel: 2, chip: 0, crack: 0, mortar: 26, round: 1, stagger: false });
      const st = s / 32; g.lineCap = 'square';
      for (let i = 0; i < 26; i++) { let x = Math.round(rnd() * 32) * st, y = Math.round(rnd() * 32) * st; const pts = [[x, y]]; let dir = rnd() * 4 | 0;
        for (let k = 0; k < 6 + rnd() * 8; k++) { const l = (1 + rnd() * 4 | 0) * st; x += [l, 0, -l, 0][dir]; y += [0, l, 0, -l][dir]; pts.push([x, y]); dir = (dir + (rnd() < 0.5 ? 1 : 3)) % 4; }
        for (const [ctx, col, w] of [[g, grey(160, 0.8), 1.6], [gm, grey(255, 0.7 + rnd() * 0.3), 2.2]]) { ctx.strokeStyle = col; ctx.lineWidth = w * s / 256; ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
          ctx.fillStyle = col; for (const p of [pts[0], pts[pts.length - 1]]) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.6 * s / 256, 0, 7); ctx.fill(); } } }
    }
  };

  // ================================================================ SHADERS
  // Colour pipeline. OUT 0: the scene is drawn in HDR and the post pass tone-maps + grades it. OUT 1: no float buffers, so the
  // shaders tone-map and the post pass grades. OUT 2 (Low, no post): the shaders tone-map, grade and vignette in one go.
  const GRADE = `
uniform vec4 uGA; uniform vec3 uLift, uGain; uniform vec4 uVig; uniform vec2 uRes;
vec3 tmap(vec3 c){ c *= uGA.x; vec3 k = max(c - 0.78, 0.0); return min(c, 0.78) + (1.0 - exp(-k * 2.4)) * 0.22; }
vec3 look(vec3 c){ float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uGA.y); c = (c - 0.3) * uGA.z + 0.3; c = c * uGain + uLift * (1.0 - c); return clamp(c, 0.0, 1.0); }
vec3 vign(vec3 c, vec2 uv){ vec2 q = uv - 0.5; q.x *= uRes.x / max(uRes.y, 1.0) * 0.75; float v = smoothstep(0.95, 0.25, length(q)); return c * mix(1.0, v, uVig.a) + uVig.rgb * (1.0 - v) * uVig.a * 0.12; }`;
  const OUTF = o => o === 0 ? 'vec3 outc(vec3 c){ return c; }' : o === 1 ? 'vec3 outc(vec3 c){ return tmap(c); }' : o === 3 ? 'vec3 outc(vec3 c){ c *= uGA.x; c = min(c, vec3(0.8)) + max(c - 0.8, 0.0) * 0.35; return look(c); }' : 'vec3 outc(vec3 c){ return vign(look(tmap(c)), gl_FragCoord.xy / uRes); }';
  const VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec3 aC; attribute vec2 aU;
uniform mat4 uVP, uM, uLVP; uniform vec3 uTint, uTint2; uniform float uNOff;
varying vec3 vW, vN, vC; varying vec2 vU; varying vec4 vL;
void main(){ vec4 w = uM * vec4(aP,1.0); vW = w.xyz; vN = (uM * vec4(aN,0.0)).xyz;
  float isW = step(2.99, aC.r + aC.g + aC.b), isM = step(0.99, aC.r) * step(aC.g, 0.01) * step(0.99, aC.b);
  vC = mix(mix(aC, uTint, isW), uTint2, isM); vU = aU; vL = uLVP * vec4(w.xyz + normalize(vN) * uNOff, 1.0); gl_Position = uVP * w; }`;
  const FS = (shadow, nl, fx, out, special) => `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define SHADOW ${shadow}
#define NL ${nl || 0}
#define FX ${fx}
#define SPECIAL ${special ? 1 : 0}
uniform sampler2D uTex, uShadow;
#if NL > 0
uniform vec4 uPL[NL]; uniform vec3 uPC[NL];
#endif
uniform float uTexMode, uTexScale, uEmis, uAlpha, uMode, uTime, uFogNear, uFogFar, uShadowTexel, uSoft, uSpec, uRim, uBump, uFogK, uToon;
uniform vec4 uMat, uCut, uP4, uMistP; uniform vec3 uGlow;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uFogCol, uCam, uRimCol, uMist, uFlash;
varying vec3 vW, vN, vC; varying vec2 vU; varying vec4 vL;
${GRADE}
${OUTF(out)}
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
#if SHADOW > 0
float sh1(vec2 uv, float z){ return step(z, texture2D(uShadow, uv).r); }
float shB(vec2 uv, float z){ vec2 g = uv / uShadowTexel - 0.5, f = fract(g), c = (floor(g) + 0.5) * uShadowTexel;
  return mix(mix(sh1(c, z), sh1(c + vec2(uShadowTexel, 0.0), z), f.x), mix(sh1(c + vec2(0.0, uShadowTexel), z), sh1(c + vec2(uShadowTexel), z), f.x), f.y); }
#endif
float shadowAt(){
#if SHADOW == 0
  return 1.0;
#else
  vec3 p = vL.xyz / vL.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float z = p.z - 0.0012, s;
#if SHADOW == 1
  s = shB(p.xy, z);
#else
  float o = uShadowTexel * 0.9; s = (shB(p.xy + vec2(-o, -o), z) + shB(p.xy + vec2(o, -o), z) + shB(p.xy + vec2(-o, o), z) + shB(p.xy + vec2(o, o), z)) * 0.25;
#endif
  vec2 e = abs(p.xy * 2.0 - 1.0); s = mix(s, 1.0, smoothstep(0.82, 1.0, max(e.x, e.y)));
  return mix(0.32, 1.0, s);
#endif
}
#if FX > 0
float fogAt(float d){ float f = smoothstep(uFogNear, uFogFar, d); float k = d * uFogK; return clamp(max(f, 1.0 - exp(-k * k)), 0.0, 1.0); }
#else
float fogAt(float d){ return smoothstep(uFogNear * 0.8, uFogFar, d); }
#endif
vec3 mistAt(vec3 c, float d){
  if (uMistP.y <= 0.0) return c;
  float h = exp(-max(vW.y + 0.2, 0.0) / uMistP.x), n = 0.55 + 0.45 * vnoise(vW.xz * 0.09 + vec2(uTime * 0.05, uTime * 0.03)) * vnoise(vW.xz * 0.23 - uTime * 0.04);
  return mix(c, uMist, clamp(h * n * uMistP.y * smoothstep(4.0, 14.0, d), 0.0, 0.85));
}
void main(){
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // see-through walls: anything tall between the camera and you is cut away with a soft dither
#if SPECIAL == 0
  if (uCut.w > 0.5 && vW.y > uCut.y + 0.35) {
    vec2 dir = uCut.xz - uCam.xz; float L2 = max(dot(dir, dir), 1.0), t = clamp(dot(vW.xz - uCam.xz, dir) / L2, 0.0, 1.0);
    float dp = length(vW.xz - (uCam.xz + dir * t)), lineY = mix(uCam.y, uCut.y + 1.0, t), rad = mix(1.6, 3.4, t);
    float k = (1.0 - smoothstep(rad * 0.55, rad, dp)) * (1.0 - smoothstep(0.86, 0.97, t)) * smoothstep(lineY - 2.6, lineY - 1.2, vW.y);
    vec2 bp = mod(floor(gl_FragCoord.xy), 4.0); float bay = (mod(bp.x + bp.y * 2.0, 4.0) * 4.0 + mod(bp.x * 2.0 + bp.y * 3.0, 4.0)) / 16.0 + 0.03;   // ordered dither: a clean screen-door pattern
    if (k > 0.02 && bay < k * 1.1) discard;
  }
#endif
  vec3 base = vC;
  vec2 wuv = vW.xz;
  float gmask = 0.0;
  if (uTexMode > 0.5) {
    vec2 uv = vU; vec3 T = vec3(1.0, 0.0, 0.0), B = vec3(0.0, 0.0, 1.0);
    if (uTexMode > 1.5) { vec3 a = abs(n); if (a.y > 0.55) uv = vW.xz; else if (a.x > a.z) { uv = vW.zy; T = vec3(0.0, 0.0, 1.0); B = vec3(0.0, 1.0, 0.0); } else { uv = vW.xy; B = vec3(0.0, 1.0, 0.0); } uv *= uTexScale; }
    vec4 tx = texture2D(uTex, uv);
    base *= tx.rgb * 1.12; gmask = (1.0 - tx.a) * 2.0;
#if FX > 0
    if (uBump > 0.0 && uTexMode > 1.5) { float px = 1.0 / 512.0, h0 = dot(tx.rgb, vec3(0.333));
      float hx = dot(texture2D(uTex, uv + vec2(px, 0.0)).rgb, vec3(0.333)), hy = dot(texture2D(uTex, uv + vec2(0.0, px)).rgb, vec3(0.333));
      n = normalize(n - (T * (hx - h0) + B * (hy - h0)) * uBump * 9.0); }
#endif
  }
  float emis = uEmis;
  vec3 V = normalize(uCam - vW);
  float d = length(vW - uCam);
#if SPECIAL
  if (uMode > 0.5 && uMode < 1.5) { // water
    float w1 = vnoise(wuv * 1.3 + vec2(uTime * 0.6, uTime * 0.4)), w2 = vnoise(wuv * 2.7 - vec2(uTime * 0.5, -uTime * 0.3));
    n = normalize(vec3((w1 - 0.5) * 0.6, 1.0, (w2 - 0.5) * 0.6));
    base = mix(vC * 0.7, vC * 1.3, w1 * w2 * 1.5);
  } else if (uMode > 1.5 && uMode < 2.5) { // lava: a dark crust that drifts over bright molten rock
    vec2 q = wuv * 0.8 + vec2(uTime * 0.07, uTime * 0.05);
    float w1 = vnoise(q + vec2(uTime * 0.2, 0.0)), w2 = vnoise(q * 2.6 - vec2(uTime * 0.25, uTime * 0.1)), w3 = vnoise(q * 6.0 + uTime * 0.4);
    float k = smoothstep(0.42, 0.7, w1 * 0.55 + w2 * 0.35 + w3 * 0.15), crack = 1.0 - smoothstep(0.0, 0.08, abs(w2 - 0.5));
    vec3 hot = mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.85, 0.35), w3);
    base = mix(vec3(0.16, 0.035, 0.02), hot, max(k, crack * 0.8)); emis = 1.6 * max(k, crack * 0.8) + 0.25;
    gl_FragColor = vec4(outc(mix(base * (emis + 0.3), uFogCol, fogAt(d))), uAlpha); return;
  } else if (uMode > 2.5 && uMode < 3.5) { // unlit (signs, decals, glows)
    vec4 t = uTexMode > 0.5 ? texture2D(uTex, vU) : vec4(1.0);
    vec3 c = mix(vC * t.rgb * (1.0 + uEmis), uFogCol, fogAt(d) * 0.85);
    gl_FragColor = vec4(outc(c), t.a * uAlpha); if (gl_FragColor.a < 0.02) discard; return;
  } else if (uMode > 3.5 && uMode < 4.5) { // swirl portal
    vec2 q = vU - 0.5; float r = length(q) * 2.0, a = atan(q.y, q.x);
    float sw = sin(a * 3.0 + r * 9.0 - uTime * 4.0) * 0.5 + 0.5, sw2 = sin(a * 5.0 - r * 14.0 + uTime * 6.0) * 0.5 + 0.5;
    vec3 c = mix(vC * 0.15, vC * 1.8 + 0.15, sw * sw) * (1.35 - r) + vC * sw2 * 0.25 * (1.0 - r);
    c += vec3(1.0) * pow(max(1.0 - r, 0.0), 6.0) * 0.8 + vC * smoothstep(0.82, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r)) * 2.0;
    gl_FragColor = vec4(outc(c), (1.0 - smoothstep(0.9, 1.0, r)) * uAlpha); return;
  } else if (uMode > 4.5 && uMode < 6.5) { // danger telegraphs: a bright crisp edge, hazard stripes and a fill that charges up (uP4.x = 0..1)
    vec2 q = vU - 0.5; float k = uP4.x, r, edge, fill, front;
    if (uMode < 5.5) { r = length(q) * 2.0; if (r > 1.0) discard; edge = smoothstep(0.88, 0.955, r);
      fill = 1.0 - smoothstep(k - 0.015, k, r); front = smoothstep(k - 0.07, k, r) * (1.0 - smoothstep(k, k + 0.012, r)) * step(0.03, k); }
    else { vec2 a = abs(q) * 2.0; r = max(a.x, a.y); float ew = uP4.y > 0.0 ? uP4.y : 0.05; edge = max(smoothstep(1.0 - ew * 1.6, 1.0 - ew * 0.4, a.x), smoothstep(1.0 - ew * 0.6, 1.0 - ew * 0.15, a.y));
      fill = 1.0 - smoothstep(k - 0.02, k, a.x); front = smoothstep(k - 0.09, k, a.x) * (1.0 - smoothstep(k, k + 0.02, a.x)) * step(0.03, k); }
    float stripe = step(0.55, fract((vW.x + vW.z) * 0.9 - uTime * 1.2)), pulse = 0.85 + 0.15 * sin(uTime * 14.0) * step(0.85, k);
    float a = clamp(edge * (0.85 + k * 0.15) + fill * (0.2 + stripe * 0.1 + k * 0.22) + front * 0.8 + 0.06, 0.0, 1.0) * pulse;
    vec3 c = vC * (0.7 + edge * 1.8 + front * 2.2 + fill * 0.4);
    gl_FragColor = vec4(outc(c), a * uAlpha); return;
  }
#endif
  float ndl = dot(n, uSunDir);
  float sh = shadowAt();
  float diff = mix(smoothstep(-0.05, 0.45, ndl) * 0.85 + max(ndl, 0.0) * 0.15, smoothstep(-0.45, 0.6, ndl) * 0.9 + 0.08, uSoft);
  // Update 7: a soft cel band (lit side / shadow side) like the reference's clean low-poly look; uToon = how much (0 = smooth)
  diff = mix(diff, smoothstep(0.08, 0.2, ndl) * 0.78 + diff * 0.22, uToon * (1.0 - uSoft * 0.6));
  vec3 hemi = mix(uGndCol, uSkyCol, n.y * 0.5 + 0.5) + uFlash;
  // contact shadow: the sides of things get darker where they meet the ground, and floors get darker under overhangs
  float ao = 1.0 - (1.0 - abs(n.y)) * 0.42 * (1.0 - smoothstep(0.0, 1.5, vW.y)) * step(-0.4, vW.y);
  // wet surfaces are darker and shinier
  float wet = uMat.z, spk = uMat.y;
  base *= 1.0 - wet * 0.25;
  vec3 col = base * (hemi * 0.66 * ao + uSunCol * diff * sh * 0.84);
  float specK = max(uSpec, uMat.x) , shin = mix(18.0, 140.0, max(spk, wet));
#if NL > 0
  // point lights (torches, braziers, lava, magic, loot): warm pools with a hot core, plus their shine on wet or polished floors
  vec3 pl = vec3(0.0), ps = vec3(0.0);
  for (int i = 0; i < NL; i++) { vec3 Ld = uPL[i].xyz - vW; float dl = length(Ld), x = dl / max(uPL[i].w, 0.001); vec3 L = Ld / max(dl, 0.001);
#if FX > 0
    float w = max(1.0 - x * x, 0.0); float a = w * w * (0.55 + 1.2 / (1.0 + dl * dl * 0.35));
    float nd = max(dot(n, L), 0.0) * (0.75 + uSoft * 0.1) + 0.22; pl += uPC[i] * a * nd;
    ps += uPC[i] * a * pow(max(dot(n, normalize(L + V)), 0.0), shin) * (0.15 + specK * 1.2 + wet * 2.2);
#else
    float a = max(0.0, 1.0 - x); a *= a * 1.35; pl += uPC[i] * a * (max(dot(n, L), 0.0) * 0.75 + 0.25);
#endif
  }
  col += base * pl * ao + ps;
#endif
  float rv = 1.0 - max(dot(n, V), 0.0), rv2 = rv * rv, fres = rv2 * rv;
  col += fres * (0.18 + uSoft * 0.15) * mix(uSkyCol, uSunCol, uSoft * 0.5) * (0.5 + 0.5 * sh);
  col += rv2 * uRim * uRimCol * (0.6 + 0.4 * sh);           // rim light: characters and slimes pop off dark floors
  vec3 H = normalize(V + uSunDir);
  col += pow(max(dot(n, H), 0.0), 40.0 + uSpec * 50.0 + spk * 60.0) * (0.22 + uSpec * 1.3 + specK * 0.8 + wet * 1.5) * sh * uSunCol;
  col += uSpec * base * 0.35 * rv2 * uSkyCol;
  col += wet * fres * uSkyCol * 0.5;
#if FX > 0
  if (uMat.w > 0.0) { // frost sparkle: tiny glints that twinkle as you move
    float g = h21(floor(vW.xz * 22.0) + floor(V.xz * 7.0)) , gg = h21(floor(vW.zx * 31.0) + floor(V.zx * 5.0));
    col += vec3(0.9, 0.97, 1.0) * (step(0.992, g) + step(0.994, gg) * 0.6) * uMat.w * (0.4 + sh);
  }
#endif
  col += base * emis;
  if (gmask > 0.0) col += uGlow * gmask * (0.75 + 0.25 * sin(uTime * 2.0 + vW.x * 0.3 + vW.z * 0.2));   // glowing seams in the texture (lava, veins, circuits)
#if SPECIAL
  if (uMode > 0.5 && uMode < 1.5) col += pow(max(dot(n, H), 0.0), 60.0) * 0.6 * uSunCol;
#endif
#if FX > 0
  col = mistAt(col, d);
#endif
  col = mix(col, uFogCol, fogAt(d));
  gl_FragColor = vec4(outc(col), uAlpha);
}`;
  const DEPTH_VS = `attribute vec3 aP; uniform mat4 uLVP, uM; void main(){ gl_Position = uLVP * uM * vec4(aP,1.0); }`;
  // Update 7 · outlines: a clean dark edge round characters and monsters, a glowing one round gear (the reference's look). The hull is the mesh pushed
  // out along its normals (in world space, wider far away so it stays a steady line on screen), drawn with front faces culled, unlit
  const OUTLINE_VS = `attribute vec3 aP; attribute vec3 aN; uniform mat4 uVP, uM; uniform vec3 uCam; uniform float uW;
void main(){ vec4 w = uM * vec4(aP, 1.0); vec3 n = normalize((uM * vec4(aN, 0.0)).xyz); float k = clamp(length(w.xyz - uCam) / 14.0, 0.7, 2.2); w.xyz += n * uW * k; gl_Position = uVP * w; }`;
  const OUTLINE_FS = out => `precision mediump float; uniform vec3 uCol; uniform float uGlowK; ${GRADE} ${OUTF(out)} void main(){ gl_FragColor = vec4(outc(uCol * (1.0 + uGlowK)), 1.0); }`;
  const DEPTH_FS = `precision mediump float; void main(){ gl_FragColor = vec4(1.0); }`;
  const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
  // skies: 0 moonlit clouds, 1 storm, 2 aurora, 3 nebula, 4 glitch, 5 blood moon, 6 ash and fire, 7 mist forest, 8 desert stars, 9 daylight, 10 dusk
  const SKY_FS = out => `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat4 uInvVP; uniform vec3 uTop, uHor, uSunDir, uCam, uMoonDir, uMoonCol, uSkyA, uSkyB; uniform float uStars, uTime, uKind, uFlash, uMoon;
varying vec2 vP;
${GRADE}
${OUTF(out)}
float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
bool K(float k){ return abs(uKind - k) < 0.5; }
void main(){
  vec4 a = uInvVP * vec4(vP, 1.0, 1.0); vec3 d = normalize(a.xyz / a.w - uCam);
  float t = clamp(d.y * 1.4 + 0.15, 0.0, 1.0), up = smoothstep(-0.05, 0.3, d.y);
  vec3 c = mix(uHor, uTop, pow(t, 0.8));
  vec2 cp = d.xz / (d.y + 0.16);
  // stars
  if (uStars > 0.5) { vec3 q = floor(d * 160.0); float st = step(0.9962, h31(q)) * (0.55 + 0.45 * sin(uTime * 2.0 + h31(q + 1.0) * 30.0));
    float milky = pow(max(1.0 - abs(d.y - 0.32 * sin(d.x * 2.6 + 0.8)), 0.0), 7.0) * fbm(d.xz * 6.0);
    c += vec3(st) * up + uSkyA * milky * 0.35 * up; }
  // the moon (a disc with a soft halo; craters from noise)
  float md = dot(d, uMoonDir), mr = uMoon;
  if (mr > 0.0 && uKind < 8.5) { float disc = smoothstep(cos(mr), cos(mr * 0.94), md); vec3 mc = uMoonCol * (0.78 + 0.22 * fbm(d.xy * 38.0 + d.z * 11.0));
    c += uMoonCol * (pow(max(md, 0.0), 900.0 / max(mr * 12.0, 0.2)) * 0.35 + pow(max(md, 0.0), 24.0) * 0.12) * up; c = mix(c, mc, disc * up); }
  // clouds and what makes each sky its own
  if (K(1.0)) { // storm: heavy clouds racing past, lightning inside them
    vec2 q = cp * 0.9 + vec2(uTime * 0.05, uTime * 0.02); float cl = smoothstep(0.35, 0.75, fbm(q)), cl2 = fbm(q * 2.0 + 3.0);
    vec3 cc = mix(uSkyA * 0.5, uSkyA, cl2) + vec3(0.7, 0.8, 1.0) * uFlash * (0.4 + cl2) * 1.6;
    c = mix(c, cc, cl * up * 0.95) + vec3(0.5, 0.6, 1.0) * uFlash * 0.25;
  } else if (K(2.0)) { // aurora ribbons
    for (int i = 0; i < 3; i++) { float fi = float(i), y0 = 0.22 + fi * 0.09 + 0.06 * sin(d.x * 2.0 + uTime * 0.13 + fi * 2.0), band = exp(-pow((d.y - y0) * 11.0, 2.0));
      float cur = 0.5 + 0.5 * sin(d.x * 22.0 + d.z * 8.0 + uTime * (0.6 + fi * 0.2) + fbm(d.xz * 3.0 + fi) * 6.0);
      c += mix(uSkyA, uSkyB, fi / 2.0) * band * (0.25 + cur * 0.75) * 0.55 * up; }
    float cl = smoothstep(0.62, 0.85, fbm(cp * 1.2 + uTime * 0.01)); c = mix(c, uHor * 1.3, cl * 0.4 * up);
  } else if (K(3.0)) { // nebula: coloured gas, more stars
    float n1 = fbm(d.xz * 2.2 + d.y + uTime * 0.004), n2 = fbm(d.xz * 4.5 - d.y * 2.0 + 5.0);
    c += (uSkyA * smoothstep(0.45, 0.85, n1) + uSkyB * smoothstep(0.55, 0.9, n2) * 0.8) * 0.65 * up;
  } else if (K(4.0)) { // glitch: scan bands, a broken grid and flickering blocks
    vec2 g = vec2(atan(d.x, d.z) * 6.0, d.y * 18.0); float grid = max(step(0.95, fract(g.x)), step(0.92, fract(g.y))) * 0.25;
    float blk = step(0.93, h21(floor(g * vec2(2.0, 1.0)) + floor(uTime * 3.0))) * 0.6, scan = step(0.985, fract(d.y * 4.0 - uTime * 0.4)) * 0.6;
    c += uSkyA * (grid + blk + scan) * up + uSkyB * step(0.97, h21(floor(vP * 30.0) + floor(uTime * 8.0))) * 0.2;
  } else if (K(5.0)) { // blood moon: red clouds lit from behind
    float cl = smoothstep(0.42, 0.8, fbm(cp * 1.1 + vec2(uTime * 0.008, 0.0))); vec3 cc = mix(uSkyA * 0.35, uSkyA, pow(max(md, 0.0), 6.0));
    c = mix(c, cc, cl * up * 0.85);
  } else if (K(6.0)) { // ash and fire: smoke lit orange from the forges below
    float cl = fbm(cp * 0.8 + vec2(uTime * 0.012, uTime * 0.004)); vec3 cc = mix(uSkyA * 0.2, uSkyB, smoothstep(0.3, 0.8, cl) * (1.0 - t * 0.7));
    c = mix(c, cc, smoothstep(0.3, 0.65, cl) * 0.9 * up) + uSkyB * pow(1.0 - abs(d.y), 10.0) * 0.4;
  } else if (K(9.0) || K(10.0)) { // Update 7: daylight (9) and dusk (10). uSkyA = the clouds' lit colour, uSkyB = their shadow; uMoonCol = the sun
    float sd = max(dot(d, uSunDir), 0.0), dusk = K(10.0) ? 1.0 : 0.0;
    c += uMoonCol * (pow(sd, 6.0) * (0.22 + dusk * 0.35) + pow(sd, 60.0) * 0.5) * (0.4 + up * 0.6);
    c = mix(c, uMoonCol * 1.6, smoothstep(cos(uMoon), cos(uMoon * 0.8), sd) * up);
    vec2 q = cp * 0.55 + vec2(uTime * 0.006, uTime * 0.002); float n = fbm(q), n2 = fbm(q * 2.3 + 4.0);
    float cl = smoothstep(0.46, 0.7, n) * smoothstep(0.0, 0.18, d.y), lit = clamp(0.55 + (n2 - 0.5) * 1.4 + sd * 0.4, 0.0, 1.0);
    vec3 cc = mix(uSkyB, uSkyA, lit) + uMoonCol * pow(sd, 4.0) * (0.25 + dusk * 0.5) * cl;
    c = mix(c, cc, cl * 0.92);
    c += uHor * pow(1.0 - abs(d.y), 14.0) * (0.25 + dusk * 0.35);   // a bright band of haze on the horizon
  } else { // 0, 7, 8: soft moonlit clouds (forest mist / desert haze change the colours)
    vec2 q = cp * 1.4 + vec2(uTime * 0.012, uTime * 0.006); float cl = smoothstep(0.5, 0.8, fbm(q)) * smoothstep(0.02, 0.25, d.y);
    vec3 cc = mix(uSkyA, uHor * 1.4, 0.4) + uMoonCol * pow(max(md, 0.0), 5.0) * 0.35;
    c = mix(c, cc, cl * (K(8.0) ? 0.35 : 0.7));
  }
  c += uHor * pow(1.0 - abs(d.y), 8.0) * 0.2;
  if (d.y < 0.0) c = mix(c, uHor * 0.8, clamp(-d.y * 3.0, 0.0, 1.0));
  gl_FragColor = vec4(outc(c), 1.0);
}`;
  // particles: kind 0 solid round, 1 glowing (additive), 2 soft smoke and fog
  const PT_VS = `attribute vec3 aP; attribute vec4 aC; attribute float aS; uniform mat4 uVP; uniform float uScale; varying vec4 vC;
void main(){ vec4 p = uVP * vec4(aP, 1.0); gl_Position = p; gl_PointSize = clamp(aS * uScale / max(p.w, 0.1), 1.0, 220.0); vC = aC; }`;
  const PT_FS = `precision mediump float; varying vec4 vC; uniform float uSoft;
void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard;
  float a = uSoft > 1.5 ? (1.0 - r * r) * (1.0 - r * r) * 0.9 : uSoft > 0.5 ? pow(1.0 - r, 1.6) : (1.0 - smoothstep(0.7, 1.0, r));
  gl_FragColor = vec4(vC.rgb, vC.a * a); }`;

  // ================================================================ ENGINE
  function Engine(canvas) {
    const E = { M, G, ok: false, quality: 'med', stats: { draws: 0, tris: 0 } };
    // effect switches (Settings): bloom, vignette, grain, grade (colour grading), ao (ambient occlusion), fog (mist + haze), cut (see-through walls)
    E.fx = { bloom: true, vignette: true, grain: true, grade: true, ao: true, fog: true, cut: true };
    const opts = { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', opts), gl2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return E;
    E.gl = gl; E.webgl2 = gl2;
    const depthExt = gl2 ? true : !!gl.getExtension('WEBGL_depth_texture');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    // HDR render targets (half floats) when the browser can draw into them
    let hdrType = 0;
    if (gl2) { if (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')) hdrType = gl.HALF_FLOAT; }
    else { const hf = gl.getExtension('OES_texture_half_float'); if (hf && gl.getExtension('EXT_color_buffer_half_float') && gl.getExtension('OES_texture_half_float_linear')) hdrType = hf.HALF_FLOAT_OES; }
    E.canShadow = depthExt;

    function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src); return s; }
    function program(vs, fs, attrs) {
      const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    }
    let progMain = null, progFx = null, progKey = '', progNL = 0, progSky = null, progOut = null, OUT = 2;
    // point lights: the game fills E.lights every frame with {x, y, z, r (reach), col ('#hex' or [r,g,b]), i (strength)}; the nearest NL are used
    E.lights = []; const NLQ = { low: 4, med: 8, high: 12 }; let plBuf = new Float32Array(48), pcBuf = new Float32Array(36);
    const progDepth = program(DEPTH_VS, DEPTH_FS, ['aP']);
    const progPt = program(PT_VS, PT_FS, ['aP', 'aC', 'aS']);
    const skyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    // ---------- textures
    const texCache = {};
    function uploadCanvas(c, repeat) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      const pot = (c.width & (c.width - 1)) === 0 && (c.height & (c.height - 1)) === 0;
      const wrap = repeat && pot ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      if (aniso && pot) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(E.quality === 'low' ? 2 : 8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      return t;
    }
    E.tex = function (name) {
      if (texCache[name]) return texCache[name];
      const gen = TEXGEN[name] || TEXGEN.white;
      return (texCache[name] = uploadCanvas(noiseTex(name === 'white' ? 4 : E.quality === 'low' ? 256 : 512, gen), true));
    };
    E.canvasTex = (c, repeat) => uploadCanvas(c, repeat);
    E.freeTex = t => gl.deleteTexture(t);
    E.updateCanvasTex = (t, c) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); };
    E.TEXGEN = TEXGEN;
    const TEXSCALE = { grass: 0.22, dirt: 0.3, tile: 0.25, wood: 0.35, sand: 0.18, candy: 0.25, metal: 0.25, rock: 0.2, brick: 0.3, cobble: 0.32, bark: 0.5, white: 1,
      forest: 0.22, mossy: 0.26, crypt: 0.24, ice: 0.14, iceRock: 0.2, basalt: 0.2, slate: 0.2, obsidian: 0.16, sandstone: 0.24, flesh: 0.2, circuit: 0.2 };
    // surface materials: spec (shine), gloss (tight highlight), wet, sparkle, bump (how deep the texture's relief looks)
    const TEXMAT = { white: {}, grass: { bump: 0.5 }, dirt: { bump: 0.6 }, forest: { bump: 0.7 }, tile: { spec: 0.25, gloss: 0.5, bump: 0.7 }, wood: { spec: 0.08, bump: 0.6 },
      sand: { bump: 0.45 }, metal: { spec: 0.9, gloss: 0.8, bump: 0.5 }, rock: { spec: 0.1, bump: 0.9 }, brick: { spec: 0.08, bump: 1.0 }, cobble: { spec: 0.15, gloss: 0.4, bump: 1.0 },
      bark: { bump: 1.0 }, mossy: { spec: 0.06, bump: 1.0 }, crypt: { spec: 0.1, bump: 0.9 }, ice: { spec: 0.6, gloss: 0.9, bump: 0.5, sparkle: 1 }, iceRock: { spec: 0.35, gloss: 0.6, bump: 0.8, sparkle: 0.6 },
      basalt: { spec: 0.15, gloss: 0.4, bump: 1.0 }, slate: { spec: 0.3, gloss: 0.6, bump: 0.7 }, obsidian: { spec: 0.8, gloss: 0.95, bump: 0.4 }, sandstone: { spec: 0.05, bump: 0.9 },
      flesh: { spec: 0.45, gloss: 0.6, bump: 0.9 }, circuit: { spec: 0.4, gloss: 0.8, bump: 0.5 } };
    E.TEXMAT = TEXMAT;

    // ---------- meshes
    function upload(arr) {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr instanceof Float32Array ? arr : new Float32Array(arr), gl.STATIC_DRAW);
      return { b, n: arr.length / STRIDE };
    }
    E.mesh = geo => upload(geo);
    E.dynMesh = () => ({ b: gl.createBuffer(), n: 0 });
    E.updateMesh = (m, arr) => { gl.bindBuffer(gl.ARRAY_BUFFER, m.b); gl.bufferData(gl.ARRAY_BUFFER, arr instanceof Float32Array ? arr : new Float32Array(arr), gl.DYNAMIC_DRAW); m.n = arr.length / STRIDE; };
    function bindMesh(m, depthOnly) {
      gl.bindBuffer(gl.ARRAY_BUFFER, m.b);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE * 4, 0);
      if (!depthOnly) {
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE * 4, 12);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, STRIDE * 4, 24);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, STRIDE * 4, 36);
      }
    }

    // ---------- static world batches: chunk -> tex -> array
    const staticSrc = {}, chunks = [];
    E.addStatic = function (geo, m, col, tex, chunk) {
      chunk = chunk || 'hub'; tex = tex || 'white';
      const c = staticSrc[chunk] || (staticSrc[chunk] = {}); const arr = c[tex] || (c[tex] = []);
      const g = m ? G.xf(geo, m, col) : (col ? G.xf(geo, M.ident(), col) : geo);
      for (let i = 0; i < g.length; i++) arr.push(g[i]);
    };
    E.buildStatic = function () {
      for (const ck in staticSrc) {
        const parts = [], mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (const tex in staticSrc[ck]) {
          const a = staticSrc[ck][tex];
          for (let i = 0; i < a.length; i += STRIDE) for (let k = 0; k < 3; k++) { if (a[i + k] < mn[k]) mn[k] = a[i + k]; if (a[i + k] > mx[k]) mx[k] = a[i + k]; }
          parts.push({ tex, mesh: upload(a), scale: TEXSCALE[tex] || 0.25 });
        }
        chunks.push({ name: ck, parts, mn, mx, visible: true, detail: ck[0] === 't' });   // 't…' chunks: scenery detail (far forests)
        delete staticSrc[ck];
      }
    };
    E.chunkVisible = (name, v) => { for (const c of chunks) if (c.name === name) c.visible = v; };

    // ---------- draw queue (dynamic)
    const POOL = 3000, qM = []; for (let i = 0; i < POOL; i++) qM.push(new Float32Array(16));
    let queue = [], qn = 0, layerQ = []; // layerQ: drawn last, on top of the world (the hatch show)
    // opt: {tex, texMode(1 uv, 2 world), emis, alpha, mode(0 lit,1 water,2 lava,3 unlit,4 portal,5 telegraph circle,6 telegraph rect), prog (telegraph charge 0-1),
    //       noShadow, cull:false, rim (0 = no rim light), spec, soft, add, depthWrite}
    E.draw = function (mesh, m, col, opt) {
      if (qn >= POOL) return;
      const mm = qM[qn++]; mm.set(m);
      const q = { mesh, m: mm, col: col ? M.col(col) : [1, 1, 1], o: opt || {} };
      if (q.o.layer) layerQ.push(q); else queue.push(q);
    };

    // ---------- particles
    const PMAX = 2400, pData = new Float32Array(PMAX * 8), parts = [];
    const pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, pData.byteLength, gl.DYNAMIC_DRAW);
    E.particleCap = 900;
    // p: {x,y,z,vx,vy,vz,life,size,col:[r,g,b],add:bool,soft:bool (smoke/fog),g:gravity,drag,fade,grow}
    E.particle = function (p) {
      if (parts.length >= E.particleCap) return;
      p.t = 0; p.col = M.col(p.col || '#ffffff'); if (p.g === undefined) p.g = 0; if (p.a === undefined) p.a = 1; parts.push(p);
    };
    E.particleCount = () => parts.length;
    function updateParticles(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt;
        if (p.t >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        p.vy -= p.g * dt; if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      }
    }

    // ---------- shadow map
    let shadowSize = 0, shadowFB = null, shadowTex = null;
    function depthTex(w, h, hi) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      if (gl2) gl.texImage2D(gl.TEXTURE_2D, 0, hi ? gl.DEPTH_COMPONENT24 : gl.DEPTH_COMPONENT16, w, h, 0, gl.DEPTH_COMPONENT, hi ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, w, h, 0, gl.DEPTH_COMPONENT, hi ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return t; }
    function setupShadow(size) {
      if (shadowFB) { gl.deleteFramebuffer(shadowFB); gl.deleteTexture(shadowTex); shadowFB = null; }
      shadowSize = size; if (!size || !depthExt) { shadowSize = 0; return; }
      shadowTex = depthTex(size, size);
      shadowFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
      if (!gl2) { // WebGL1 wants a colour attachment too
        const cr = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, cr); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, size, size);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, cr);
      }
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); shadowSize = 0; shadowFB = null; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // ---------- post: ambient occlusion, bloom, edge smoothing, tone map + colour grade, vignette, film grain
    const POST_VS = `attribute vec2 aP; varying vec2 vU; void main(){ vU = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
    const BRIGHT_FS = `precision mediump float; uniform sampler2D uT; uniform vec2 uPx; uniform float uTh; varying vec2 vU;
vec3 s(vec2 o){ vec3 c = texture2D(uT, vU + o * uPx).rgb; float l = max(c.r, max(c.g, c.b)); return c * smoothstep(uTh, uTh + 0.6, l) * min(1.0, 3.0 / max(l, 0.001)); }
void main(){ gl_FragColor = vec4((s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0))) * 0.25, 1.0); }`;
    const BLUR_FS = `precision mediump float; uniform sampler2D uT; uniform vec2 uDir; varying vec2 vU;
void main(){ vec3 c = texture2D(uT, vU).rgb * 0.227; c += (texture2D(uT, vU + uDir * 1.385).rgb + texture2D(uT, vU - uDir * 1.385).rgb) * 0.316; c += (texture2D(uT, vU + uDir * 3.23).rgb + texture2D(uT, vU - uDir * 3.23).rgb) * 0.07; gl_FragColor = vec4(c, 1.0); }`;
    // ambient occlusion from the depth buffer: samples that stick out in front of the local surface darken it (corners, wall feet, under slimes)
    const AO_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uD; uniform vec2 uPx, uNF; uniform float uProj, uR, uK; varying vec2 vU;
float lz(vec2 uv){ float z = texture2D(uD, uv).r * 2.0 - 1.0; return 2.0 * uNF.x * uNF.y / (uNF.y + uNF.x - z * (uNF.y - uNF.x)); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){
  float z0 = lz(vU); if (z0 > uNF.y * 0.97) { gl_FragColor = vec4(1.0); return; }
  float zr = lz(vU + vec2(uPx.x, 0.0)), zl = lz(vU - vec2(uPx.x, 0.0)), zu = lz(vU + vec2(0.0, uPx.y)), zd = lz(vU - vec2(0.0, uPx.y));
  // the surface is predicted in 1/z, which is linear across the screen for a flat surface (so wide flat ground never bands at a grazing angle)
  float i0 = 1.0 / z0, ir = 1.0 / zr, il = 1.0 / zl, iu = 1.0 / zu, id = 1.0 / zd;
  float gx = abs(ir - i0) < abs(i0 - il) ? ir - i0 : i0 - il, gy = abs(iu - i0) < abs(i0 - id) ? iu - i0 : i0 - id;
  float rpx = min(uR * uProj / z0, 48.0), occ = 0.0, ang = h21(gl_FragCoord.xy) * 6.283;
  for (int i = 0; i < 10; i++) { float fi = (float(i) + 0.5) / 10.0, a = ang + fi * 25.13; vec2 o = vec2(cos(a), sin(a)) * rpx * sqrt(fi);
    float z = lz(vU + o * uPx), dz = 1.0 / max(i0 + gx * o.x + gy * o.y, 1e-4) - z;
    occ += smoothstep(0.09 + z0 * 0.014, 0.4 + z0 * 0.014, dz) * (1.0 - smoothstep(uR, uR * 2.5, dz)); }   // Update 7: a higher floor so flat ground never bands
  gl_FragColor = vec4(vec3(1.0 - clamp(occ / 10.0 * uK, 0.0, 0.85)), 1.0);
}`;
    const COMP_FS = out => `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uT, uB, uA; uniform float uK, uAO, uGrain, uTime, uGr; uniform vec2 uPx, uAPx; varying vec2 vU;
${GRADE}
vec3 L3(vec3 c){ return min(c, vec3(1.0)); }
vec3 fxaa(vec2 uv){ vec3 L = vec3(0.299, 0.587, 0.114);
  vec3 nw = texture2D(uT, uv + vec2(-1.0, -1.0) * uPx).rgb, ne = texture2D(uT, uv + vec2(1.0, -1.0) * uPx).rgb, sw = texture2D(uT, uv + vec2(-1.0, 1.0) * uPx).rgb, se = texture2D(uT, uv + vec2(1.0, 1.0) * uPx).rgb, m = texture2D(uT, uv).rgb;
  float a = dot(L3(nw), L), b = dot(L3(ne), L), c = dot(L3(sw), L), d = dot(L3(se), L), e = dot(L3(m), L), lo = min(e, min(min(a, b), min(c, d))), hi = max(e, max(max(a, b), max(c, d)));
  vec2 dir = vec2(-((a + b) - (c + d)), (a + c) - (b + d)); float red = max((a + b + c + d) * 0.03125, 0.0078125), rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, -8.0, 8.0) * uPx;
  vec3 A = 0.5 * (texture2D(uT, uv + dir * (-1.0 / 6.0)).rgb + texture2D(uT, uv + dir * (1.0 / 6.0)).rgb), B = A * 0.5 + 0.25 * (texture2D(uT, uv - dir * 0.5).rgb + texture2D(uT, uv + dir * 0.5).rgb);
  float lb = dot(L3(B), L); return (lb < lo || lb > hi) ? A : B; }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){
  vec3 c = fxaa(vU);
  if (uAO > 0.0) { float ao = (texture2D(uA, vU + vec2(-uAPx.x, -uAPx.y)).r + texture2D(uA, vU + vec2(uAPx.x, -uAPx.y)).r + texture2D(uA, vU + vec2(-uAPx.x, uAPx.y)).r + texture2D(uA, vU + uAPx).r) * 0.25; c *= mix(1.0, ao, uAO); }
  c += texture2D(uB, vU).rgb * uK;
  ${out === 0 ? 'c = tmap(c);' : ''}
  if (uGr > 0.5) c = look(c);
  c = vign(c, vU);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c += (h21(vU * 731.0 + fract(uTime * 7.13)) - 0.5) * uGrain * (1.0 - l * 0.6);
  gl_FragColor = vec4(c, 1.0);
}`;
    let progBright = null, progBlur = null, progComp = null, progAO = null, post = null, compOut = -1;
    E.bloom = 0.7; E.bloomTh = 0.8; E.vignette = 0.85;
    function makeFB(w, h, depth, hdr) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      if (hdr && hdrType) gl.texImage2D(gl.TEXTURE_2D, 0, gl2 ? gl.RGBA16F : gl.RGBA, w, h, 0, gl.RGBA, hdrType, null); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      let rb = null, dt = null;
      if (depth === 'tex' && depthExt) { dt = depthTex(w, h, true); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dt, 0); }
      else if (depth) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { f, t, rb, dt, w, h, ok };
    }
    function freeFB(b) { if (!b) return; gl.deleteFramebuffer(b.f); gl.deleteTexture(b.t); if (b.rb) gl.deleteRenderbuffer(b.rb); if (b.dt) gl.deleteTexture(b.dt); }
    function postFor(W, H, wantAO) {
      const key = W + 'x' + H + (wantAO ? 'a' : '');
      if (post && post.key === key) return post.ok ? post : null;
      if (post) { freeFB(post.scene); freeFB(post.a); freeFB(post.b); freeFB(post.ao); }
      if (!progBright) { progBright = program(POST_VS, BRIGHT_FS, ['aP']); progBlur = program(POST_VS, BLUR_FS, ['aP']); }
      const bw = Math.max(1, W >> 2), bh = Math.max(1, H >> 2);
      post = { key, W, H, scene: makeFB(W, H, wantAO ? 'tex' : true, true), a: makeFB(bw, bh, false, true), b: makeFB(bw, bh, false, true) };
      if (!post.scene.ok && hdrType) { hdrType = 0; freeFB(post.scene); freeFB(post.a); freeFB(post.b); post = null; return postFor(W, H, wantAO); } // no float targets after all
      post.hdr = !!hdrType; post.ok = post.scene.ok && post.a.ok && post.b.ok;
      if (wantAO && post.scene.dt) { post.ao = makeFB(Math.max(1, W >> 1), Math.max(1, H >> 1)); if (!progAO) try { progAO = program(POST_VS, AO_FS, ['aP']); } catch (e) { progAO = false; } }
      return post.ok ? post : null;
    }
    function quad() { gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.enableVertexAttribArray(0); for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    function setGrade(u, gr) {
      if (!u.uGA) return; const g = E.fx.grade !== false ? gr : null;
      gl.uniform4f(u.uGA, gr.expo || 1, g ? (g.sat === undefined ? 1.1 : g.sat) : 1.1, g ? g.con || 1 : 1, 0);
      gl.uniform3fv(u.uLift, g && g.lift ? g.lift : ZERO3); gl.uniform3fv(u.uGain, g && g.gain ? g.gain : ONE3);
      const v = E.fx.vignette !== false ? (gr.vig === undefined ? 0.55 : gr.vig) : 0, vc = gr.vigCol || ZERO3; gl.uniform4f(u.uVig, vc[0], vc[1], vc[2], v);
      if (u.uRes) gl.uniform2f(u.uRes, canvas.width, canvas.height);
    }
    function runPost(pp, W, H, env, nearF) {
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0);
      const gr = env.grade || {}, out = pp.hdr ? 0 : 1;
      if (compOut !== out) { progComp = program(POST_VS, COMP_FS(out), ['aP']); compOut = out; }
      // ambient occlusion (half size)
      const ao = pp.ao && progAO && E.fx.ao !== false && Q[E.quality].ao;
      if (ao) { gl.bindFramebuffer(gl.FRAMEBUFFER, pp.ao.f); gl.viewport(0, 0, pp.ao.w, pp.ao.h); gl.useProgram(progAO.p); gl.bindTexture(gl.TEXTURE_2D, pp.scene.dt); gl.uniform1i(progAO.u.uD, 0);
        gl.uniform2f(progAO.u.uPx, 1 / W, 1 / H); gl.uniform2f(progAO.u.uNF, 0.2, nearF); gl.uniform1f(progAO.u.uProj, H / 2 / Math.tan((env.fov || 1) / 2)); gl.uniform1f(progAO.u.uR, 0.9); gl.uniform1f(progAO.u.uK, gr.ao === undefined ? 1.6 : gr.ao); quad(); }
      // bloom (quarter size)
      const bloomOn = E.fx.bloom !== false;
      if (bloomOn) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pp.a.f); gl.viewport(0, 0, pp.a.w, pp.a.h); gl.useProgram(progBright.p);
        gl.bindTexture(gl.TEXTURE_2D, pp.scene.t); gl.uniform1i(progBright.u.uT, 0); gl.uniform2f(progBright.u.uPx, 1.5 / W, 1.5 / H); gl.uniform1f(progBright.u.uTh, gr.bloomTh || (pp.hdr ? 0.95 : E.bloomTh)); quad();
        gl.useProgram(progBlur.p); gl.uniform1i(progBlur.u.uT, 0);
        for (let i = 0; i < 2; i++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, pp.b.f); gl.bindTexture(gl.TEXTURE_2D, pp.a.t); gl.uniform2f(progBlur.u.uDir, (1 + i) / pp.a.w, 0); quad();
          gl.bindFramebuffer(gl.FRAMEBUFFER, pp.a.f); gl.bindTexture(gl.TEXTURE_2D, pp.b.t); gl.uniform2f(progBlur.u.uDir, 0, (1 + i) / pp.a.h); quad();
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); const u = progComp.u; gl.useProgram(progComp.p);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ao ? pp.ao.t : pp.a.t); gl.uniform1i(u.uA, 2);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, pp.a.t); gl.uniform1i(u.uB, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pp.scene.t); gl.uniform1i(u.uT, 0);
      gl.uniform1f(u.uK, bloomOn ? (gr.bloom === undefined ? E.bloom : gr.bloom) : 0); gl.uniform2f(u.uPx, 1 / W, 1 / H); gl.uniform2f(u.uAPx, 1 / Math.max(1, W >> 1), 1 / Math.max(1, H >> 1));
      gl.uniform1f(u.uAO, ao ? 1 : 0); gl.uniform1f(u.uGrain, E.fx.grain !== false ? (gr.grain === undefined ? 0.025 : gr.grain) : 0); gl.uniform1f(u.uTime, env.time || 0); gl.uniform1f(u.uGr, 1);
      setGrade(u, gr); quad();
    }
    // ---------- quality
    const Q = {
      low:  { shadow: 0,    pcf: 0, scale: 0.7, maxDpr: 1,   far: 75,  parts: 350, post: 0, fx: 0, ao: 0 },
      med:  { shadow: 1024, pcf: 1, scale: 1,   maxDpr: 1,   far: 105, parts: 900, post: 1, fx: 1, ao: 0 },
      high: { shadow: 2048, pcf: 2, scale: 1,   maxDpr: 1.5, far: 145, parts: 1800, post: 1, fx: 2, ao: 1 }
    };
    E.Q = Q;
    function buildMain() {
      const cfg = Q[E.quality], pcf = shadowSize ? cfg.pcf : 0, nl = E.noLights ? 0 : NLQ[E.quality] || 0;
      OUT = cfg.post && E.post !== false ? (hdrType ? 0 : 1) : E.quality === 'low' ? 3 : 2;
      const key = [pcf, nl, cfg.fx, OUT].join(':'); if (key === progKey) return;
      try { progMain = program(VS, FS(pcf, nl, cfg.fx, OUT, 0), ['aP', 'aN', 'aC', 'aU']); progFx = program(VS, FS(pcf, nl, cfg.fx, OUT, 1), ['aP', 'aN', 'aC', 'aU']); progNL = nl; }
      catch (e) { if (!nl && !cfg.fx) throw e; console.warn('main shader fallback', e.message.slice(0, 200)); E.noLights = true; progMain = program(VS, FS(pcf, 0, 0, OUT, 0), ['aP', 'aN', 'aC', 'aU']); progFx = program(VS, FS(pcf, 0, 0, OUT, 1), ['aP', 'aN', 'aC', 'aU']); progNL = 0; }
      progSky = program(SKY_VS, SKY_FS(OUT), ['aP']); progOut = program(OUTLINE_VS, OUTLINE_FS(OUT), ['aP', 'aN']); progKey = key;
    }
    E.setQuality = function (q, extraScale) {
      E.quality = Q[q] ? q : 'med'; const cfg = Q[E.quality];
      setupShadow(cfg.shadow); buildMain();
      E.far = E.farBase = cfg.far; E.particleCap = cfg.parts; E.renderScale = cfg.scale * (extraScale || 1);
      E.resize();
    };
    E.resize = function () {
      const cfg = Q[E.quality], dpr = Math.min(window.devicePixelRatio || 1, cfg.maxDpr) * E.renderScale;
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };

    // ---------- frame
    let VP = M.ident(), LVP = M.ident(), invVP = M.ident(), camPos = [0, 0, 0];
    E.project = function (x, y, z) {
      const m = VP, X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Wc = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (Wc < 0.1) return null;
      return [(X / Wc * 0.5 + 0.5) * canvas.clientWidth, (1 - (Y / Wc * 0.5 + 0.5)) * canvas.clientHeight, Wc];
    };
    E.camPos = () => camPos;
    const ZERO3 = [0, 0, 0], ONE3 = [1, 1, 1], IDENT = M.ident(), MISTOFF = [1, 0, 0, 0], CUTOFF = [0, 0, 0, 0];
    function setCommon(u, env) {
      gl.uniform3fv(u.uSunDir, env.sun); gl.uniform3fv(u.uSunCol, env.sunCol); gl.uniform3fv(u.uSkyCol, env.skyCol); gl.uniform3fv(u.uGndCol, env.gndCol);
      gl.uniform3fv(u.uFogCol, env.fog); gl.uniform3fv(u.uCam, camPos); gl.uniform1f(u.uFogNear, E.mapView ? 1e6 : E.far * 0.45); gl.uniform1f(u.uFogFar, E.mapView ? 2e6 : E.far);   // mapView: overview shots without distance fog
      gl.uniform1f(u.uFogK, E.fx.fog !== false && env.haze && !E.mapView ? env.haze / E.far : 0);
      gl.uniform1f(u.uTime, env.time); gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uLVP, false, LVP);
      gl.uniform1f(u.uShadowTexel, shadowSize ? 1 / shadowSize : 0); gl.uniform1f(u.uNOff, shadowSize ? (E.quality === 'high' ? 38 : 30) * 2 / shadowSize * 1.2 : 0);
      gl.uniform3fv(u.uRimCol, env.rimCol || [0.35, 0.4, 0.6]); gl.uniform3fv(u.uFlash, env.flashCol || ZERO3); gl.uniform1f(u.uToon, env.toon || 0);
      const mi = env.mist; if (mi && E.fx.fog !== false && E.quality !== 'low') { gl.uniform3fv(u.uMist, mi.col); gl.uniform4f(u.uMistP, mi.h || 1.2, mi.k || 0.5, 0, 0); } else { gl.uniform3fv(u.uMist, ZERO3); gl.uniform4fv(u.uMistP, MISTOFF); }
      setGrade(u, env.grade || {});
    }
    function setMat(u, tex, ov) { const m = TEXMAT[tex] || TEXMAT.white, o = ov && ov[tex];
      const sp = o && o.spec !== undefined ? o.spec : m.spec || 0, gl0 = o && o.gloss !== undefined ? o.gloss : m.gloss || 0, wet = o && o.wet !== undefined ? o.wet : m.wet || 0, spk = o && o.sparkle !== undefined ? o.sparkle : m.sparkle || 0;
      gl.uniform4f(u.uMat, sp, gl0, wet, spk); gl.uniform1f(u.uBump, o && o.bump !== undefined ? o.bump : m.bump || 0); gl.uniform3fv(u.uGlow, o && o.glow ? o.glow : ZERO3); }
    const FR = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    function inView(c) { for (const [a, b, cc, d] of FR) if (a * (a > 0 ? c.mx[0] : c.mn[0]) + b * (b > 0 ? c.mx[1] : c.mn[1]) + cc * (cc > 0 ? c.mx[2] : c.mn[2]) + d < 0) return false; return true; }
    function chunkNear(c, cx, cz, r) {
      const dx = Math.max(c.mn[0] - cx, 0, cx - c.mx[0]), dz = Math.max(c.mn[2] - cz, 0, cz - c.mx[2]);
      return dx * dx + dz * dz < r * r;
    }
    // env: {eye, target, fov, sun, sunCol, skyCol, gndCol, fog, skyTop, skyHor, stars, time, focus, dt,
    //       grade {expo, sat, con, lift, gain, vig, vigCol, grain, bloom, bloomTh, ao}, rimCol, mist {col, h, k}, haze, mat {tex: {spec, gloss, wet, sparkle, bump, glow}},
    //       sky {kind, a, b, moon (radius), moonDir, moonCol}, flash (0-1), flashCol, cut [x, y, z] (see-through walls around this point)}
    E.frame = function (env) {
      E.resize();
      const W = canvas.width, H = canvas.height; gl.viewport(0, 0, W, H);
      camPos = env.eye;
      const nearF = E.far + 40, proj = M.persp(env.fov || 1.0, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.2, nearF);
      const view = M.lookAt(env.eye, env.target, [0, 1, 0]);
      VP = M.mul(proj, view); invVP = M.invert(VP);
      // Update 7 · the six view-frustum planes, so static chunks outside the view are skipped (they were only skipped by distance before)
      for (let p = 0; p < 6; p++) { const k = p >> 1, s = p & 1 ? -1 : 1; FR[p][0] = VP[3] + s * VP[k]; FR[p][1] = VP[7] + s * VP[4 + k]; FR[p][2] = VP[11] + s * VP[8 + k]; FR[p][3] = VP[15] + s * VP[12 + k]; }
      updateParticles(env.dt || 0.016);
      let draws = 0, tris = 0;
      buildMain();
      const cfg = Q[E.quality], wantAO = !!cfg.ao && E.fx.ao !== false;
      const pp = OUT < 2 ? postFor(W, H, wantAO) : null, target = pp ? pp.scene.f : null;
      if (OUT < 2 && !pp) { E.post = false; progKey = ''; buildMain(); }
      // ---- shadow pass (snapped to whole shadow texels in light space so edges never shimmer)
      const f = env.focus || env.target;
      if (shadowSize && !E.shadowOff) {
        const S = E.quality === 'high' ? 38 : 30, sun = env.sun, lv = M.lookAt([sun[0] * 100, sun[1] * 100, sun[2] * 100], [0, 0, 0], [0, 1, 0]);
        const vx = lv[0] * f[0] + lv[4] * f[1] + lv[8] * f[2] + lv[12], vy = lv[1] * f[0] + lv[5] * f[1] + lv[9] * f[2] + lv[13], vz = lv[2] * f[0] + lv[6] * f[1] + lv[10] * f[2] + lv[14];
        const texel = 2 * S / shadowSize, sx = Math.round(vx / texel) * texel, sy = Math.round(vy / texel) * texel;
        LVP = M.mul(M.ortho(sx - S, sx + S, sy - S, sy + S, -vz - 90, -vz + 90), lv);
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.viewport(0, 0, shadowSize, shadowSize);
        gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
        gl.colorMask(false, false, false, false);
        gl.useProgram(progDepth.p); gl.uniformMatrix4fv(progDepth.u.uLVP, false, LVP);
        gl.enableVertexAttribArray(0); for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
        gl.uniformMatrix4fv(progDepth.u.uM, false, IDENT);
        for (const c of chunks) if (c.visible && chunkNear(c, f[0], f[2], S * 1.5)) for (const p of c.parts) { bindMesh(p.mesh, true); gl.drawArrays(gl.TRIANGLES, 0, p.mesh.n); }
        for (const q of queue) if (!q.o.noShadow && !(q.o.mode >= 1) && (q.o.alpha === undefined || q.o.alpha >= 1)) { gl.uniformMatrix4fv(progDepth.u.uM, false, q.m); bindMesh(q.mesh, true); gl.drawArrays(gl.TRIANGLES, 0, q.mesh.n); }
        gl.colorMask(true, true, true, true);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, W, H);
      if (target) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
      // ---- sky
      const sky = env.sky || {}, flash = env.flash || 0;
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.useProgram(progSky.p); const su = progSky.u;
      for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
      gl.enableVertexAttribArray(0); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.uniformMatrix4fv(su.uInvVP, false, invVP); gl.uniform3fv(su.uTop, env.skyTop); gl.uniform3fv(su.uHor, env.skyHor);
      gl.uniform3fv(su.uSunDir, env.sun); gl.uniform3fv(su.uCam, camPos); gl.uniform1f(su.uStars, env.stars ? 1 : 0); gl.uniform1f(su.uTime, env.time);
      gl.uniform1f(su.uKind, sky.kind || 0); gl.uniform3fv(su.uSkyA, sky.a || env.skyHor); gl.uniform3fv(su.uSkyB, sky.b || env.skyTop); gl.uniform1f(su.uFlash, flash);
      gl.uniform1f(su.uMoon, sky.moon === undefined ? 0.05 : sky.moon); gl.uniform3fv(su.uMoonDir, sky.moonDir || [-0.5, 0.55, -0.67]); gl.uniform3fv(su.uMoonCol, sky.moonCol || [0.85, 0.9, 1.0]);
      setGrade(su, env.grade || {});
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // ---- main
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      // lights: the nearest to what you are looking at
      if (progNL) { const f2 = env.focus || env.target, L2 = E.lights; plBuf.fill(0); pcBuf.fill(0);
        for (const l of L2) l._d = (l.x - f2[0]) ** 2 + (l.z - f2[2]) ** 2 - l.r * l.r * 0.5;
        L2.sort((a, b) => a._d - b._d);
        for (let i = 0; i < Math.min(progNL, L2.length); i++) { const l = L2[i], c = typeof l.col === 'string' ? M.hex(l.col) : l.col, k = l.i === undefined ? 1 : l.i;
          plBuf[i * 4] = l.x; plBuf[i * 4 + 1] = l.y; plBuf[i * 4 + 2] = l.z; plBuf[i * 4 + 3] = l.r; pcBuf[i * 3] = c[0] * k; pcBuf[i * 3 + 1] = c[1] * k; pcBuf[i * 3 + 2] = c[2] * k; }
        E.stats.lights = Math.min(progNL, L2.length); }
      // two programs: the lean one for lit surfaces (the whole world), the effects one (water, lava, glows, portals, telegraphs). Each is set up the first time it is used this frame
      const ready = new Set(); let P = null, u = null;
      const use = (Q2) => { if (P === Q2) return; P = Q2; u = Q2.u; gl.useProgram(Q2.p); if (ready.has(Q2)) return; ready.add(Q2);
        setCommon(u, env); if (progNL) { gl.uniform4fv(u.uPL, plBuf.subarray(0, progNL * 4)); gl.uniform3fv(u.uPC, pcBuf.subarray(0, progNL * 3)); }
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowSize ? shadowTex : E.tex('white')); gl.uniform1i(u.uShadow, 1); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(u.uTex, 0);
        gl.uniformMatrix4fv(u.uM, false, IDENT); gl.uniform3f(u.uTint, 1, 1, 1); gl.uniform3f(u.uTint2, 1, 1, 1); gl.uniform1f(u.uSoft, 0); gl.uniform1f(u.uSpec, 0); gl.uniform1f(u.uEmis, 0); gl.uniform1f(u.uAlpha, 1); gl.uniform1f(u.uMode, 0);
        gl.uniform1f(u.uRim, 0.12); gl.uniform4f(u.uP4, 0, 0, 0, 0); gl.uniform4fv(u.uCut, CUTOFF); gl.uniform4f(u.uMat, 0, 0, 0, 0); gl.uniform1f(u.uBump, 0); gl.uniform3fv(u.uGlow, ZERO3); };
      for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
      use(progMain);
      const cut = env.cut && E.fx.cut !== false; if (cut) gl.uniform4f(u.uCut, env.cut[0], env.cut[1], env.cut[2], 1);
      gl.uniform1f(u.uTexMode, 2);
      const cx = camPos[0], cz = camPos[2], mat = env.mat;
      let nch = 0;
      for (const c of chunks) {
        if (!c.visible || !chunkNear(c, cx, cz, E.far + 10) || !inView(c)) continue;
        if (c.detail && E.quality === 'low' && !chunkNear(c, cx, cz, 40)) continue;   // far forest detail is left out on Low
        nch++;
        for (const p of c.parts) {
          gl.bindTexture(gl.TEXTURE_2D, E.tex(p.tex)); gl.uniform1f(u.uTexMode, p.tex === 'white' ? 0 : 2); gl.uniform1f(u.uTexScale, p.scale); setMat(u, p.tex, mat);
          bindMesh(p.mesh); gl.drawArrays(gl.TRIANGLES, 0, p.mesh.n); draws++; tris += p.mesh.n / 3;
        }
      }
      gl.uniform4fv(u.uCut, CUTOFF); gl.uniform4f(u.uMat, 0, 0, 0, 0); gl.uniform1f(u.uBump, 0); gl.uniform3fv(u.uGlow, ZERO3);
      const trans = [];
      const drawItem = (q) => {
        const o = q.o; use(o.mode >= 1 ? progFx : progMain);
        gl.uniformMatrix4fv(u.uM, false, q.m); gl.uniform3fv(u.uTint, q.col); gl.uniform3fv(u.uTint2, o.col2 ? M.col(o.col2) : ONE3); gl.uniform1f(u.uSoft, o.soft || 0); gl.uniform1f(u.uSpec, o.spec || 0);
        gl.uniform1f(u.uEmis, o.emis || 0); gl.uniform1f(u.uAlpha, o.alpha === undefined ? 1 : o.alpha); gl.uniform1f(u.uMode, o.mode || 0); gl.uniform1f(u.uRim, o.rim === undefined ? 1 : o.rim);
        if (o.mode === 5 || o.mode === 6) gl.uniform4f(u.uP4, o.prog || 0, o.edge || 0, 0, 0);
        if (o.tex) { gl.bindTexture(gl.TEXTURE_2D, typeof o.tex === 'string' ? E.tex(o.tex) : o.tex); gl.uniform1f(u.uTexMode, o.texMode || 1); gl.uniform1f(u.uTexScale, o.texScale || TEXSCALE[o.tex] || 0.25); }
        else gl.uniform1f(u.uTexMode, 0);
        if (o.cull === false) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
        if (o.nofog) gl.uniform1f(u.uFogFar, 1e9), gl.uniform1f(u.uFogNear, 1e9 - 1), gl.uniform1f(u.uFogK, 0);
        bindMesh(q.mesh); gl.drawArrays(gl.TRIANGLES, 0, q.mesh.n); draws++; tris += q.mesh.n / 3;
        if (o.nofog) gl.uniform1f(u.uFogFar, E.far), gl.uniform1f(u.uFogNear, E.far * 0.45), gl.uniform1f(u.uFogK, E.fx.fog !== false && env.haze ? env.haze / E.far : 0);
      };
      const outl = E.outlines !== false && E.quality !== 'low' ? [] : null;
      for (const q of queue) {
        if ((q.o.alpha !== undefined && q.o.alpha < 1) || q.o.mode >= 3 || q.o.blend) { q.d = Math.hypot(q.m[12] - cx, q.m[13] - camPos[1], q.m[14] - cz) + (q.o.bias || 0); trans.push(q); }
        else { drawItem(q); if (outl && q.o.outline) outl.push(q); }
      }
      // ---- outlines (after the solid things, before the see-through ones)
      if (outl && outl.length) { const ou = progOut.u; gl.useProgram(progOut.p); P = null; gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
        gl.uniformMatrix4fv(ou.uVP, false, VP); gl.uniform3fv(ou.uCam, camPos); setGrade(ou, env.grade || {}); gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
        for (const q of outl) { const O = q.o.outline; gl.uniformMatrix4fv(ou.uM, false, q.m); gl.uniform3fv(ou.uCol, typeof O.col === 'string' ? M.col(O.col) : O.col || ZERO3); gl.uniform1f(ou.uW, O.w || 0.03); gl.uniform1f(ou.uGlowK, O.glow || 0);
          bindMesh(q.mesh); gl.drawArrays(gl.TRIANGLES, 0, q.mesh.n); draws++; tris += q.mesh.n / 3; }
        gl.cullFace(gl.BACK); for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i); E.stats.outlines = outl.length; } else E.stats.outlines = 0;
      // ---- transparent (far to near)
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      trans.sort((a, b) => b.d - a.d);
      for (const q of trans) {
        if (q.o.add) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(!!q.o.depthWrite); drawItem(q);
      }
      gl.depthMask(true);
      // ---- particles (solid, then soft smoke, then glowing)
      const drawParts = (layer) => {
        if (!parts.length) return;
        gl.useProgram(progPt.p);
        for (let i = 3; i < 4; i++) gl.disableVertexAttribArray(i);
        gl.uniformMatrix4fv(progPt.u.uVP, false, VP); gl.uniform1f(progPt.u.uScale, canvas.height * 0.9);
        gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);
        gl.depthMask(false);
        for (const kind of [0, 2, 1]) {
          let n = 0;
          for (const p of parts) {
            if ((p.add ? 1 : p.soft ? 2 : 0) !== kind || !!p.layer !== layer) continue;
            const k = p.t / p.life, a = p.a * (p.fade === false ? 1 : (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85)), o = n * 8;
            pData[o] = p.x; pData[o + 1] = p.y; pData[o + 2] = p.z; pData[o + 3] = p.col[0]; pData[o + 4] = p.col[1]; pData[o + 5] = p.col[2]; pData[o + 6] = a;
            pData[o + 7] = p.size * (p.grow ? 1 + k * p.grow : 1); n++;
          }
          if (!n) continue;
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, pData.subarray(0, n * 8));
          gl.blendFunc(gl.SRC_ALPHA, kind === 1 ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(progPt.u.uSoft, kind);
          gl.drawArrays(gl.POINTS, 0, n); draws++;
        }
        gl.depthMask(true);
      };
      drawParts(false);
      // ---- top layer (hatch show): fresh depth buffer so nothing in the world can cover it
      if (layerQ.length) {
        gl.clear(gl.DEPTH_BUFFER_BIT); const P0 = P; P = null; use(P0 || progMain); for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
        gl.activeTexture(gl.TEXTURE0);
        const lt = [];
        gl.disable(gl.BLEND);
        for (const q of layerQ) { if ((q.o.alpha !== undefined && q.o.alpha < 1) || q.o.mode >= 3 || q.o.blend) { q.d = Math.hypot(q.m[12] - cx, q.m[13] - camPos[1], q.m[14] - cz) + (q.o.bias || 0); lt.push(q); } else drawItem(q); }
        gl.enable(gl.BLEND); lt.sort((a, b) => b.d - a.d);
        for (const q of lt) { gl.blendFunc(gl.SRC_ALPHA, q.o.add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(!!q.o.depthWrite); drawItem(q); }
        gl.depthMask(true);
        drawParts(true);
      }
      gl.disable(gl.BLEND);
      if (pp) runPost(pp, W, H, env, nearF);
      queue = []; qn = 0; layerQ = [];
      E.stats.draws = draws; E.stats.tris = tris | 0; E.stats.chunks = nch; E.stats.parts = parts.length; E.stats.out = OUT; E.stats.hdr = !!(pp && pp.hdr); E.stats.ao = !!(pp && pp.ao && wantAO);
    };
    E.setQuality('med');
    E.ok = true;
    return E;
  }
  Engine.M = M; Engine.G = G;
  root.TLEngine = Engine;
})(typeof self !== 'undefined' ? self : this);
