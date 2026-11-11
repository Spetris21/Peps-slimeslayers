/* Slime Slayers - HUD (ability bar, run bar, dungeon clock, party frames), menus/panels (dungeon finder + party lobby, results, inventory,
   character, abilities, class trainer, forge, enchanter, quests, profile, boards, trade), avatar editor, start screen, toasts. */
(function (root) {
  'use strict';
  const L = root.SL, C = L.C, W = L.W, $ = q => document.querySelector(q), fmt = L.fmt;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = { cur: null, boardTab: 'week', avTab: 'chests', gearSel: null, gearTab: 'all', spSel: null, dsel: null };
  root.UI = UI;
  const A = () => root.App;
  const ico = (id, cls) => `<svg class="i ${cls || ''}"><use href="#i-${id}"/></svg>`;
  const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const near = k => A().nearSt(k);

  // ================================================================ icons painted on 2D canvases (cached as images)
  const iconCache = {};
  function shadeHex(h, k) { const c = parseInt(h.slice(1), 16), r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
  // gear icons: the item's shape in its dungeon's colours, framed by rarity (cached as images)
  UI.itemIcon = function (it, plain) {
    const key = 'i5' + it.k + it.t + '_' + it.r + (plain ? 'p' : ''); if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'), tier = C.GEAR_TIERS[it.t] || C.GEAR_TIERS[0], rar = plain ? { c: '#5a5470' } : C.GEAR_RARITY[it.r];
    const gr = g.createRadialGradient(48, 52, 4, 48, 52, 56); gr.addColorStop(0, shadeHex(rar.c, 0.42)); gr.addColorStop(1, '#0b0a0f'); g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
    const metal = tier.w, dark = tier.g1, trim = tier.g2, glow = tier.glow;
    g.save(); g.translate(48, 50); g.shadowColor = glow; g.shadowBlur = it.r >= 3 && !plain ? 12 : 4;
    const P = (pts, f) => { g.fillStyle = f; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); };
    const T9 = it.t | 0;
    // each dungeon's blade has its own shape (wooden thorns, khopesh, bone, ice, cleaver, lightning, void shards, flamberge, pixels)
    const blade = (len, wd) => { g.shadowBlur = 0;
      switch (T9) {
        case 0: P([[-wd, 0], [-wd * 1.2, -len * 0.5], [-wd * 0.6, -len], [0, -len - wd * 2], [wd * 0.7, -len], [wd * 1.1, -len * 0.5], [wd, 0]], metal); g.fillStyle = '#2a1c10'; for (let k = 1; k < 5; k++) { const y = -len * k / 5, sd = k % 2 ? 1 : -1; g.beginPath(); g.moveTo(sd * wd, y); g.lineTo(sd * (wd + 6), y - 4); g.lineTo(sd * wd, y - 6); g.fill(); } g.fillStyle = '#4a8a2a'; g.beginPath(); g.ellipse(-wd - 4, 0, 6, 3, 0.5, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(wd + 4, 0, 6, 3, -0.5, 0, 6.3); g.fill(); break;
        case 1: g.fillStyle = metal; g.beginPath(); g.moveTo(-wd, 0); g.lineTo(-wd, -len * 0.5); g.quadraticCurveTo(-wd, -len * 1.05, wd * 3.4, -len * 0.92); g.lineTo(wd * 2.4, -len * 0.78); g.quadraticCurveTo(wd, -len * 0.82, wd, -len * 0.45); g.lineTo(wd, 0); g.closePath(); g.fill(); break;
        case 2: g.fillStyle = '#d8d0b8'; for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(0, -len * (k + 0.5) / 7.4, wd * 1.1, len / 16, 0, 0, 6.3); g.fill(); } g.fillStyle = metal; g.fillRect(-wd * 1.6, -len * 0.92, wd * 0.9, len * 0.92); g.fillStyle = '#d8d0b8'; for (let k = 0; k < 6; k++) { const y = -len * (k + 0.5) / 6.5; g.beginPath(); g.moveTo(wd, y + 3); g.lineTo(wd + 6, y); g.lineTo(wd, y - 3); g.fill(); } break;
        case 3: g.fillStyle = metal; for (let k = 0; k < 4; k++) { const y = -len * (0.14 + k * 0.22), w2 = wd * (1.5 - k * 0.15); g.beginPath(); g.moveTo(0, y + len * 0.13); g.lineTo(w2, y); g.lineTo(0, y - len * 0.13); g.lineTo(-w2, y); g.closePath(); g.fill(); } g.beginPath(); g.moveTo(0, -len - wd * 3); g.lineTo(wd, -len * 0.85); g.lineTo(-wd, -len * 0.85); g.fill(); break;
        case 4: P([[-wd * 1.6, 0], [-wd * 1.6, -len * 0.82], [-wd * 0.4, -len - wd], [wd * 1.6, -len * 0.82], [wd * 1.6, 0]], '#1e1618'); g.fillStyle = '#1e1618'; for (let k = 1; k < 5; k++) { const y = -len * k / 5.5; g.beginPath(); g.moveTo(wd * 1.6, y); g.lineTo(wd * 1.6 + 5, y - 3); g.lineTo(wd * 1.6, y - 6); g.fill(); } g.strokeStyle = glow; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); for (let k = 1; k < 7; k++) g.lineTo((k % 2 ? 1 : -1) * wd * 0.5, -len * k / 7.5); g.stroke(); break;
        case 5: g.strokeStyle = metal; g.lineWidth = wd * 1.8; g.lineJoin = 'miter'; g.beginPath(); g.moveTo(0, 0); g.lineTo(wd * 1.2, -len * 0.25); g.lineTo(-wd * 1.1, -len * 0.5); g.lineTo(wd * 1.2, -len * 0.72); g.lineTo(0, -len * 0.88); g.stroke(); P([[-1, -len * 0.86], [-wd * 1.4, -len - wd * 1.5], [0, -len * 0.95], [wd * 1.4, -len - wd * 1.8], [1, -len * 0.86]], metal);
          g.strokeStyle = glow; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(wd * 1.2, -len * 0.25); g.lineTo(-wd * 1.1, -len * 0.5); g.lineTo(wd * 1.2, -len * 0.72); g.lineTo(0, -len * 0.88); g.stroke(); break;
        case 6: g.fillStyle = metal; for (let k = 0; k < 4; k++) { const y = -len * (0.1 + k * 0.24), h = len * 0.1 * (1 - k * 0.1); g.beginPath(); g.moveTo(0, y + h); g.lineTo(wd * 1.2, y); g.lineTo(0, y - h * 1.3); g.lineTo(-wd * 1.2, y); g.closePath(); g.fill(); } g.strokeStyle = glow; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -len * 0.45, wd * 2.4, 4, 0, 0, 6.3); g.stroke(); break;
        case 7: g.fillStyle = metal; g.beginPath(); g.moveTo(-wd, 0); for (let k = 0; k <= 10; k++) g.lineTo(-wd + Math.sin(k * 1.25) * 3, -len * k / 10); g.lineTo(0, -len - wd * 2); for (let k = 10; k >= 0; k--) g.lineTo(wd + Math.sin(k * 1.25) * 3, -len * k / 10); g.closePath(); g.fill(); g.fillStyle = '#ff2a6a'; g.beginPath(); g.arc(0, -3, 3.5, 0, 6.3); g.fill(); break;
        case 8: for (let k = 0; k < 8; k++) { const sz = wd * (2.1 - k * 0.12); g.fillStyle = k % 3 === 1 ? glow : '#0c0c0c'; g.fillRect(-sz / 2 + ((k * 37) % 5 - 2), -len * (k + 1) / 8.5, sz, sz); } g.fillStyle = '#0c0c0c'; g.fillRect(wd + 4, -len * 0.5, 4, 4); g.fillRect(-wd - 8, -len * 0.7, 4, 4); break;
        default: P([[-wd, 0], [-wd, -len], [0, -len - wd * 2], [wd, -len], [wd, 0]], metal); g.fillStyle = glow; g.fillRect(-1, -len, 2, len);
      } };
    // a small badge of the dungeon's style on armour (antlers, a headdress, a skull, ice, horns, wings, a halo, an eye, pixels)
    const motif = (x, y, s2) => { g.save(); g.translate(x, y); g.scale(s2, s2); g.shadowBlur = 0; g.lineWidth = 2.4;
      switch (T9) {
        case 0: g.strokeStyle = '#5a3a1e'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 4, 0); g.lineTo(sd * 10, -12); g.lineTo(sd * 16, -16); g.moveTo(sd * 8, -8); g.lineTo(sd * 14, -6); g.stroke(); } g.fillStyle = '#4a8a2a'; g.beginPath(); g.arc(0, -2, 3, 0, 6.3); g.fill(); break;
        case 1: g.fillStyle = '#c8a040'; g.fillRect(-12, -6, 24, 4); g.fillStyle = '#1a2a6a'; for (let k = 0; k < 5; k++) g.fillRect(-12 + k * 5, -2, 2.5, 10); g.fillStyle = '#c8a040'; g.beginPath(); g.moveTo(0, -14); g.lineTo(3, -6); g.lineTo(-3, -6); g.fill(); break;
        case 2: g.fillStyle = '#d8d0b8'; g.beginPath(); g.arc(0, -4, 7, 0, 6.3); g.fill(); g.fillRect(-4, 1, 8, 5); g.fillStyle = '#0a0808'; g.fillRect(-4, -6, 3, 3); g.fillRect(1, -6, 3, 3); break;
        case 3: g.fillStyle = '#bfe8ff'; for (const [a, h] of [[0, 14], [-0.5, 10], [0.5, 10]]) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, -h); g.lineTo(3, 0); g.lineTo(-3, 0); g.fill(); g.restore(); } break;
        case 4: g.fillStyle = '#1a1210'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 4, 0); g.quadraticCurveTo(sd * 16, -4, sd * 12, -16); g.lineTo(sd * 8, -6); g.fill(); } g.fillStyle = '#ff6a1a'; g.fillRect(-2, -4, 4, 4); break;
        case 5: g.fillStyle = '#a8c0ff'; for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(sd * 3, 0); g.lineTo(sd * (12 + k * 3), -10 + k * 4); g.lineTo(sd * (10 + k * 3), -6 + k * 4); g.fill(); } break;
        case 6: g.strokeStyle = '#c87aff'; g.beginPath(); g.ellipse(0, -10, 10, 3, 0, 0, 6.3); g.stroke(); g.fillStyle = '#8a4aff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(3, 0); g.lineTo(0, 6); g.lineTo(-3, 0); g.fill(); break;
        case 7: g.fillStyle = '#3a0a1e'; g.beginPath(); g.arc(0, -3, 7, 0, 6.3); g.fill(); g.fillStyle = '#ff2a6a'; g.beginPath(); g.arc(0, -3, 3, 0, 6.3); g.fill(); g.strokeStyle = '#3a0a1e'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 5, 2); g.quadraticCurveTo(sd * 12, 6, sd * 9, 14); g.stroke(); } break;
        case 8: for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#1aff8a' : '#0a0a0a'; g.fillRect(-9 + (k % 3) * 6, -10 + Math.floor(k / 3) * 6, 5, 5); } break;
      } g.restore(); };
    const hilt = gw => { g.shadowBlur = 0; g.fillStyle = '#2a1c12'; g.fillRect(-3, 0, 6, 16); g.fillStyle = trim; g.fillRect(-gw, -3, gw * 2, 6); g.fillStyle = glow; g.beginPath(); g.arc(0, 19, 3.5, 0, 6.3); g.fill(); };
    switch (it.k) {
      case 'sword': g.rotate(-0.7); blade(40, 5); hilt(12); break;
      case 'greatsword': g.rotate(-0.7); g.translate(0, 6); blade(46, 8); hilt(16); break;
      case 'dagger': g.save(); g.translate(-12, 6); g.rotate(-0.5); blade(24, 4); hilt(8); g.restore(); g.save(); g.translate(13, 2); g.rotate(0.45); blade(24, 4); hilt(8); g.restore(); break;
      case 'hammer': g.rotate(-0.6); g.shadowBlur = 0; g.fillStyle = '#2a1c12'; g.fillRect(-3, -26, 6, 50); g.shadowBlur = 8;
        switch (T9) {
          case 0: g.fillStyle = metal; g.beginPath(); g.ellipse(0, -30, 20, 10, 0, 0, 6.3); g.fill(); g.fillStyle = '#4a8a2a'; for (const x of [-10, 2, 12]) { g.beginPath(); g.arc(x, -38, 4, 0, 6.3); g.fill(); } break;
          case 1: g.fillStyle = metal; g.beginPath(); g.moveTo(-26, -30); g.lineTo(-8, -40); g.lineTo(-8, -20); g.fill(); g.beginPath(); g.moveTo(26, -30); g.lineTo(8, -40); g.lineTo(8, -20); g.fill(); g.fillStyle = trim; g.fillRect(-8, -40, 16, 20); break;
          case 2: g.fillStyle = '#d8d0b8'; g.beginPath(); g.arc(0, -32, 14, 0, 6.3); g.fill(); g.fillRect(-8, -22, 16, 7); g.fillStyle = glow; g.fillRect(-7, -36, 5, 5); g.fillRect(2, -36, 5, 5); break;
          case 3: g.fillStyle = metal; g.fillRect(-18, -40, 36, 20); g.fillStyle = '#bfe8ff'; for (const [x, y] of [[-20, -44], [0, -46], [20, -44]]) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 3, y + 4); g.lineTo(x - 3, y + 4); g.fill(); } break;
          case 4: g.fillStyle = '#1e1618'; g.fillRect(-14, -40, 28, 18); g.beginPath(); g.moveTo(14, -36); g.lineTo(28, -30); g.lineTo(14, -26); g.fill(); g.fillStyle = glow; g.fillRect(-14, -31, 28, 2); break;
          case 5: g.fillStyle = metal; g.fillRect(-20, -36, 40, 12); g.strokeStyle = trim; g.lineWidth = 3; for (const x of [-12, 0, 12]) { g.beginPath(); g.ellipse(x, -30, 3, 10, 0, 0, 6.3); g.stroke(); } g.fillStyle = glow; g.beginPath(); g.arc(-22, -30, 4, 0, 6.3); g.arc(22, -30, 4, 0, 6.3); g.fill(); break;
          case 6: g.save(); g.translate(0, -36); g.rotate(0.785); g.fillStyle = metal; g.fillRect(-11, -11, 22, 22); g.restore(); g.fillStyle = glow; g.beginPath(); g.arc(0, -36, 4, 0, 6.3); g.fill(); break;
          case 7: g.fillStyle = metal; for (const [x, y] of [[-8, -34], [8, -34], [0, -40], [0, -28]]) { g.beginPath(); g.arc(x, y, 9, 0, 6.3); g.fill(); } g.fillStyle = '#ff2a6a'; g.beginPath(); g.arc(0, -34, 4, 0, 6.3); g.fill(); break;
          case 8: for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? glow : '#0c0c0c'; g.fillRect(-18 + (k % 3) * 12, -42 + Math.floor(k / 3) * 12, 11, 11); } break;
          default: g.fillStyle = metal; g.fillRect(-19, -40, 38, 20); g.fillStyle = trim; g.fillRect(-19, -33, 38, 4);
        } break;
      case 'staff': g.rotate(-0.5); g.shadowBlur = 0; g.fillStyle = '#3a2618'; g.fillRect(-3, -30, 6, 64); g.shadowBlur = 16; g.fillStyle = glow; g.beginPath(); g.arc(0, -38, 8, 0, 6.3); g.fill(); g.strokeStyle = metal; g.lineWidth = 3; g.shadowBlur = 0;
        switch (T9) {
          case 0: for (const a of [-0.8, 0, 0.8]) { g.beginPath(); g.moveTo(0, -30); g.lineTo(Math.sin(a) * 14, -38 - Math.cos(a) * 12); g.stroke(); } g.fillStyle = '#4a8a2a'; g.beginPath(); g.arc(-12, -46, 4, 0, 6.3); g.arc(12, -46, 4, 0, 6.3); g.fill(); break;
          case 1: g.beginPath(); g.arc(0, -38, 13, 0, 6.3); g.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; g.beginPath(); g.moveTo(Math.cos(a) * 14, -38 + Math.sin(a) * 14); g.lineTo(Math.cos(a) * 19, -38 + Math.sin(a) * 19); g.stroke(); } break;
          case 2: g.fillStyle = '#d8d0b8'; g.beginPath(); g.arc(0, -36, 10, 0, 6.3); g.fill(); g.fillStyle = glow; g.fillRect(-6, -39, 4, 4); g.fillRect(2, -39, 4, 4); break;
          case 3: g.fillStyle = '#bfe8ff'; for (const [x, h] of [[0, 20], [-7, 13], [7, 13]]) { g.beginPath(); g.moveTo(x, -30 - h); g.lineTo(x + 4, -30); g.lineTo(x - 4, -30); g.fill(); } break;
          case 4: g.strokeStyle = '#1e1618'; for (const x of [-9, -3, 3, 9]) { g.beginPath(); g.moveTo(x * 0.4, -28); g.quadraticCurveTo(x * 1.5, -38, x * 0.4, -50); g.stroke(); } break;
          case 5: g.beginPath(); g.moveTo(0, -30); g.lineTo(0, -56); g.stroke(); g.strokeStyle = trim; for (const y of [-36, -44]) { g.beginPath(); g.ellipse(0, y, 9, 3, 0, 0, 6.3); g.stroke(); } break;
          case 6: g.strokeStyle = trim; g.beginPath(); g.ellipse(0, -38, 15, 5, 0.6, 0, 6.3); g.stroke(); g.beginPath(); g.ellipse(0, -38, 15, 5, -0.6, 0, 6.3); g.stroke(); break;
          case 7: g.fillStyle = '#3a0a1e'; g.beginPath(); g.arc(0, -38, 10, 0, 6.3); g.fill(); g.fillStyle = glow; g.beginPath(); g.arc(0, -38, 4, 0, 6.3); g.fill(); break;
          case 8: for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; g.fillStyle = k % 2 ? glow : '#0c0c0c'; g.fillRect(Math.cos(a) * 14 - 3, -38 + Math.sin(a) * 14 - 3, 6, 6); } break;
          default: g.beginPath(); g.arc(0, -38, 11, 2.4, 0.7); g.stroke();
        } break;
      case 'helm': P([[-20, 14], [-22, -6], [-14, -20], [0, -24], [14, -20], [22, -6], [20, 14]], dark); g.shadowBlur = 0; g.fillStyle = '#060508'; g.fillRect(-14, -4, 28, 5); g.fillStyle = glow; g.fillRect(-10, -3, 7, 2); g.fillRect(3, -3, 7, 2); g.fillStyle = trim; g.fillRect(-2, -26, 4, 22); break;
      case 'hood': P([[-22, 22], [-20, -4], [-10, -22], [6, -26], [16, -14], [22, 6], [20, 22], [10, 10], [-10, 10]], dark); g.shadowBlur = 0; g.fillStyle = '#050407'; P([[-11, 10], [-9, -6], [9, -6], [11, 10]], '#050407'); g.fillStyle = glow; g.fillRect(-6, 0, 4, 2); g.fillRect(3, 0, 4, 2); break;
      case 'plate': P([[-26, -18], [-12, -24], [12, -24], [26, -18], [22, 4], [16, 26], [-16, 26], [-22, 4]], dark); g.shadowBlur = 0; g.fillStyle = trim; g.fillRect(-26, -20, 14, 8); g.fillRect(12, -20, 14, 8); g.fillRect(-2, -22, 4, 46); g.fillStyle = glow; g.beginPath(); g.arc(0, -6, 4, 0, 6.3); g.fill(); break;
      case 'robe': P([[-14, -24], [14, -24], [20, 0], [28, 28], [-28, 28], [-20, 0]], dark); g.shadowBlur = 0; g.fillStyle = trim; g.fillRect(-28, 22, 56, 6); g.fillRect(-3, -24, 6, 52); g.fillStyle = glow; g.beginPath(); g.arc(0, -14, 3.5, 0, 6.3); g.fill(); break;
      case 'gauntlet': for (const sd of [-1, 1]) { g.save(); g.translate(sd * 14, 4); g.rotate(sd * 0.18); P([[-10, 20], [-11, -8], [-6, -18], [6, -18], [11, -8], [10, 20]], dark); g.shadowBlur = 0; g.fillStyle = trim; g.fillRect(-12, 12, 24, 7); g.fillRect(-9, -12, 18, 4); g.fillStyle = glow; g.fillRect(-2, -2, 4, 4); g.restore(); } break;
      case 'wraps': for (const sd of [-1, 1]) { g.save(); g.translate(sd * 14, 4); g.rotate(sd * 0.18); P([[-9, 20], [-9, -14], [-4, -20], [4, -20], [9, -14], [9, 20]], dark); g.shadowBlur = 0; g.fillStyle = trim; for (const y of [-8, 2, 12]) g.fillRect(-10, y, 20, 3); g.fillStyle = glow; g.fillRect(-1.5, 15, 3, 3); g.restore(); } break;
      case 'greaves': for (const sd of [-1, 1]) { g.save(); g.translate(sd * 13, 0); P([[-8, -24], [8, -24], [9, 10], [sd > 0 ? 18 : 9, 22], [sd > 0 ? -9 : -18, 22], [-9, 10]], dark); g.shadowBlur = 0; g.fillStyle = trim; g.fillRect(-9, -24, 18, 6); g.fillRect(-9, 4, 18, 4); g.fillStyle = glow; g.fillRect(-2, -12, 4, 4); g.restore(); } break;
      case 'boots': for (const sd of [-1, 1]) { g.save(); g.translate(sd * 13, 0); P([[-8, -20], [8, -20], [8, 10], [sd > 0 ? 17 : 8, 22], [sd > 0 ? -8 : -17, 22], [-8, 10]], dark); g.shadowBlur = 0; g.fillStyle = trim; g.fillRect(-9, -20, 18, 6); g.fillStyle = glow; g.fillRect(-2, -6, 4, 3); g.restore(); } break;
      case 'ring': g.lineWidth = 7; g.strokeStyle = metal; g.beginPath(); g.arc(0, 6, 18, 0, 6.3); g.stroke(); g.shadowBlur = 16; g.fillStyle = it.r >= 3 && !plain ? rar.c : glow; g.beginPath(); g.moveTo(0, -24); g.lineTo(10, -12); g.lineTo(0, -2); g.lineTo(-10, -12); g.closePath(); g.fill(); break;
    }
    if (it.k === 'helm' || it.k === 'hood') motif(0, -22, 1.2); else if (it.k === 'plate' || it.k === 'robe') motif(0, -2, 1.05); else if (it.s === 'g' || it.s === 'b') motif(0, -16, 0.75);
    g.restore();
    g.strokeStyle = rar.c; g.lineWidth = it.r >= 4 && !plain ? 4 : 2; g.strokeRect(2, 2, 92, 92);
    return (iconCache[key] = c.toDataURL());
  };
  // ability icons: a glyph for what the ability does, in the ability's own colour (painted once, cached as images)
  const lighten = (h, k) => { const c = parseInt(h.slice(1), 16), f = v => Math.round(v + (255 - v) * k); return `rgb(${f((c >> 16) & 255)},${f((c >> 8) & 255)},${f(c & 255)})`; };
  UI.spellImg = function (id) {
    const key = 's' + id; if (iconCache[key]) return iconCache[key];
    const sp = L.spell(id) || { k: 'nova', col: '#8a8494' }, col = sp.col, lt = lighten(col, 0.55), TAU = Math.PI * 2;
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
    const gr = g.createRadialGradient(48, 38, 4, 48, 48, 66); gr.addColorStop(0, shadeHex(col, 0.8)); gr.addColorStop(0.5, shadeHex(col, 0.28)); gr.addColorStop(1, '#06040a'); g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
    g.save(); g.translate(48, 48); g.globalAlpha = 0.16; g.fillStyle = lt; for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(-6, -70); g.lineTo(6, -70); g.fill(); } g.restore();
    g.save(); g.translate(48, 48); g.shadowColor = col; g.shadowBlur = 12; g.fillStyle = lt; g.strokeStyle = lt; g.lineCap = 'round'; g.lineJoin = 'round';
    const P = (pts, close) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); if (close !== false) g.closePath(); };
    const W = (w) => { g.lineWidth = w; g.stroke(); };
    const orb = (x, y, r, f) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = f || lt; g.fill(); };
    const flake = (x, y, r) => { g.save(); g.translate(x, y); g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke(); } g.restore(); };
    const bolt = (s) => { P([[4 * s, -34 * s], [-14 * s, 4 * s], [-1 * s, 4 * s], [-6 * s, 34 * s], [15 * s, -6 * s], [2 * s, -6 * s]]); g.fill(); };
    const kind = { thorns: 'thorns', blizzard: 'snow', clone: 'clone', cry: 'horn', heal: 'heal' }[sp.id] || sp.k;
    switch (kind) {
      case 'arc': g.beginPath(); g.arc(0, 14, 36, Math.PI * 1.08, Math.PI * 1.92); g.arc(0, 30, 30, Math.PI * 1.86, Math.PI * 1.14, true); g.closePath(); g.fill(); P([[-8, 30], [8, 30], [3, 6], [-3, 6]]); g.fill(); break;
      case 'dash': for (const y of [-14, 0, 14]) { P([[-36, y], [-12, y]], false); W(5); } P([[-6, -24], [32, 0], [-6, 24], [2, 0]]); g.fill(); break;
      case 'spin': g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 26, 0.3, 2.6); g.stroke(); g.beginPath(); g.arc(0, 0, 26, 3.4, 5.7); g.stroke();
        P([[-26, 10], [-36, -6], [-16, -6]]); g.fill(); P([[26, -10], [36, 6], [16, 6]]); g.fill(); orb(0, 0, 7); break;
      case 'nova': { const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = i % 2 ? 14 : 36; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } P(pts); g.fill(); if (sp.freeze) { g.strokeStyle = shadeHex(col, 0.3); flake(0, 0, 10); } break; }
      case 'leap': P([[-10, -36], [10, -36], [10, -8], [22, -8], [0, 14], [-22, -8], [-10, -8]]); g.fill(); P([[-36, 28], [36, 28]], false); W(5); P([[-14, 28], [-20, 36]], false); W(3); P([[12, 28], [20, 36]], false); W(3); break;
      case 'horn': P([[-30, -8], [-30, 8], [-14, 8], [18, 26], [18, -26], [-14, -8]]); g.fill(); for (const a of [-0.5, 0, 0.5]) { P([[26 + Math.cos(a) * 4, Math.sin(a) * 18], [36, Math.sin(a) * 28]], false); W(4); } break;
      case 'buff': for (const y of [10, -6, -22]) { P([[-24, y + 12], [0, y - 6], [24, y + 12]], false); W(7); } break;
      case 'line': P([[-34, 30], [24, -24], [34, -34], [30, -20]]); g.fill(); g.globalAlpha = 0.6; P([[-36, 12], [-14, -10]], false); W(4); P([[-12, 36], [10, 14]], false); W(4); break;
      case 'shield': P([[0, -34], [28, -24], [26, 6], [0, 34], [-26, 6], [-28, -24]]); g.fill(); g.fillStyle = shadeHex(col, 0.35); P([[0, -22], [16, -16], [15, 4], [0, 22], [-15, 4], [-16, -16]]); g.fill(); break;
      case 'rage': g.beginPath(); g.moveTo(0, -36); g.bezierCurveTo(26, -12, 30, 6, 22, 22); g.bezierCurveTo(14, 36, -14, 36, -22, 22); g.bezierCurveTo(-30, 6, -18, -6, -10, -18); g.bezierCurveTo(-8, -6, -2, -2, 4, -4); g.bezierCurveTo(0, -16, 2, -26, 0, -36); g.fill();
        g.fillStyle = shadeHex(col, 0.3); P([[-12, 12], [-4, 18], [-12, 22]]); g.fill(); P([[12, 12], [4, 18], [12, 22]]); g.fill(); break;
      case 'single': P([[-32, -28], [-24, -34], [32, 28], [24, 34]]); g.fill(); P([[32, -28], [24, -34], [-32, 28], [-24, 34]]); g.fill(); break;
      case 'pull': if (sp.self) { g.lineWidth = 6; for (let i = -1; i <= 1; i++) { g.save(); g.translate(i * 16, -i * 16); g.rotate(-Math.PI / 4); g.beginPath(); g.ellipse(0, 0, 13, 7, 0, 0, TAU); g.stroke(); g.restore(); } }
        else { g.lineWidth = 5; g.beginPath(); for (let a = 0; a < TAU * 2.2; a += 0.15) { const r = 3 + a * 4.6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); orb(0, 0, 8, '#0a0012'); } break;
      case 'proj': g.globalAlpha = 0.75; P([[-34, 30], [2, -2], [-8, 14]]); g.fill(); P([[-24, 34], [8, 6], [-4, 2]]); g.fill(); g.globalAlpha = 1; orb(12, -12, 18); orb(12, -12, 9, '#fff'); break;
      case 'missiles': for (const [x, y] of [[-18, 18], [4, -4], [22, -24]]) { g.globalAlpha = 0.6; P([[x - 18, y + 14], [x, y]], false); W(4); g.globalAlpha = 1; orb(x, y, 8); } break;
      case 'chain': bolt(1); g.globalAlpha = 0.7; orb(-26, -26, 5); orb(26, 26, 5); orb(26, -28, 4); break;
      case 'blink': g.setLineDash([5, 6]); g.lineWidth = 4; g.beginPath(); g.arc(-16, 4, 14, 0, TAU); g.stroke(); g.setLineDash([]); orb(18, -6, 14); P([[-4, 4], [6, -2]], false); W(4); break;
      case 'zone': g.lineWidth = 5; g.beginPath(); g.ellipse(0, 22, 34, 11, 0, 0, TAU); g.stroke(); for (const [x, h] of [[-18, 30], [0, 44], [18, 32]]) { g.beginPath(); g.moveTo(x - 8, 22); g.quadraticCurveTo(x - 8, 22 - h * 0.6, x, 22 - h); g.quadraticCurveTo(x + 8, 22 - h * 0.6, x + 8, 22); g.fill(); } break;
      case 'thorns': g.lineWidth = 5; g.beginPath(); g.ellipse(0, 24, 34, 10, 0, 0, TAU); g.stroke(); for (const [x, h] of [[-22, 28], [-8, 44], [8, 38], [22, 26]]) { P([[x - 6, 24], [x, 24 - h], [x + 6, 24]]); g.fill(); } break;
      case 'snow': flake(0, 0, 32); orb(0, 0, 6); for (const [x, y] of [[-26, -26], [26, 24], [24, -26]]) orb(x, y, 4); break;
      case 'heal': P([[-10, -32], [10, -32], [10, -10], [32, -10], [32, 10], [10, 10], [10, 32], [-10, 32], [-10, 10], [-32, 10], [-32, -10], [-10, -10]]); g.fill(); break;
      case 'meteor': g.globalAlpha = 0.7; P([[36, -36], [-2, -2], [12, 6]]); g.fill(); g.globalAlpha = 1; orb(-8, 6, 20); g.fillStyle = shadeHex(col, 0.35); orb(-14, 2, 5, shadeHex(col, 0.35)); orb(-2, 14, 4, shadeHex(col, 0.35)); break;
      case 'summon': P([[0, -34], [16, -4], [0, 26], [-16, -4]]); g.fill(); g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 32, 10, -0.3, 0, TAU); g.stroke(); P([[-14, 34], [14, 34]], false); W(5); break;
      case 'clone': for (const [x, a] of [[-12, 0.45], [10, 1]]) { g.globalAlpha = a; orb(x, -18, 9); P([[x - 13, 34], [x - 10, -4], [x + 10, -4], [x + 13, 34]]); g.fill(); } break;
      case 'mark': g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.stroke(); for (const [a, b] of [[[0, -36], [0, -16]], [[0, 36], [0, 16]], [[-36, 0], [-16, 0]], [[36, 0], [16, 0]]]) { P([a, b], false); W(5); } orb(0, 0, 7); break;
      case 'shower': for (const [x, y, r] of [[-18, -14, 9], [14, -22, 7], [6, 14, 11], [-24, 22, 6]]) { g.globalAlpha = 0.6; P([[x + 14, y - 14], [x, y]], false); W(4); g.globalAlpha = 1; orb(x, y, r); } break;
      default: orb(0, 0, 24);
    }
    g.restore();
    g.lineWidth = 4; g.strokeStyle = col; g.strokeRect(2, 2, 92, 92); g.lineWidth = 1; g.strokeStyle = '#ffffff44'; g.strokeRect(6, 6, 84, 84);
    return (iconCache[key] = c.toDataURL());
  };
  UI.spellIco = id => `<img class="spi" src="${UI.spellImg(id)}" alt="">`;

  // ================================================================ toasts, chat, celebrate
  UI.toast = function (t, c) { const e = $('#toast'); e.textContent = t; e.style.color = c || '#e8e2ee'; e.classList.add('on'); clearTimeout(UI.toast.t); UI.toast.t = setTimeout(() => e.classList.remove('on'), 2400); };
  UI.addChat = function (n, m, c) {
    const l = $('#clog'), d = document.createElement('div');
    if (n) { const b = document.createElement('b'); b.textContent = n + ': '; b.style.color = 'hsl(' + (L.hash(n) % 360) + ',70%,70%)'; d.appendChild(b); }
    d.appendChild(document.createTextNode(m)); if (!n) d.style.color = c || '#cdc6d8';
    l.appendChild(d); while (l.children.length > 8) l.removeChild(l.firstChild);
  };
  UI.sys = (m, c) => UI.addChat(null, m, c);
  UI.flash = (col, strong) => { const f = $('#flash'); f.style.background = col || '#fff'; f.style.transition = 'none'; f.style.opacity = strong ? 0.8 : 0.4; requestAnimationFrame(() => { f.style.transition = 'opacity .7s'; f.style.opacity = 0; }); };
  const celQ = []; let celOn = false;
  UI.celebrate = function (title, sub, reward, col) { celQ.push([title, sub, reward, col]); if (!celOn) nextCel(); };
  function nextCel() { const q = celQ.shift(); if (!q) { celOn = false; return; } celOn = true; const e = $('#celebrate'); e.querySelector('h2').textContent = q[0]; e.querySelector('p').textContent = q[1] || ''; e.querySelector('.rw').textContent = q[2] || '';
    e.querySelector('h2').style.filter = q[3] ? `drop-shadow(0 0 12px ${q[3]})` : ''; e.classList.add('on'); setTimeout(() => { e.classList.remove('on'); setTimeout(nextCel, 350); }, 2300); }
  UI.zone = function (title, sub) { const z = $('#zone'); z.querySelector('h1').textContent = title; z.querySelector('p').textContent = sub || ''; z.classList.add('on'); clearTimeout(UI.zone.t); UI.zone.t = setTimeout(() => z.classList.remove('on'), 2600); };
  UI.bump = id => { const e = $(id); e.classList.remove('up'); void e.offsetWidth; e.classList.add('up'); };

  // ================================================================ HUD
  let lastGold = -1, runHtml = '', partyHtml = '', spellKey = '';
  const DIFF_C = ['#9ad8a0', '#ffb85a', '#ff5a5a'];
  const score = it => L.itemScore(it);
  // the best item you could equip in each slot that beats what you wear
  function upgrades(s) { const out = []; for (const sl of C.SLOT_ORDER) { const cur = L.eqItem(s, sl), best = s.inv.filter(it => it.s === sl && L.canEquip(s, it) && !L.isEquipped(s, it.u)).sort((a, b) => score(b) - score(a))[0]; if (best && (!cur || score(best) > score(cur) * 1.02)) out.push(best); } return out; }
  UI.upgrades = upgrades;
  UI.hud = function () {
    const app = A(), s = app.s; if (!s) return;
    const now = app.now(), P = app.P, RUN = app.getRun && app.getRun();
    $('#goldn').textContent = fmt(s.gold); if (s.gold > lastGold && lastGold >= 0) UI.bump('#gold'); lastGold = s.gold;
    $('#lvln').textContent = s.level; $('#pname').innerHTML = esc(app.myName) + '<i>' + esc(C.CLASSES[s.cls].n).toUpperCase() + '</i>' + (s.title && s.title !== 'rookie' ? '<i>' + esc(L.titleName(s.title)).toUpperCase() + '</i>' : '');
    const mx = RUN ? (RUN.players.get(app.myId) || { max: L.maxHp(s) }).max : L.maxHp(s), hp = Math.max(0, P.hp), k = Math.min(1, hp / mx); $('#hpbar i').style.width = (k * 100) + '%'; $('#hpbar b').style.width = (k * 100) + '%'; $('#hpbar span').textContent = fmt(Math.ceil(hp)) + ' / ' + fmt(mx);
    $('#xpbar i').style.width = (s.level >= C.MAX_LEVEL ? 100 : s.xp / L.xpNeed(s.level) * 100) + '%';
    $('#lowhp').style.opacity = RUN && !P.dead && k < 0.3 ? 0.6 : 0;
    // events bar
    const ev = L.events(now), bar = $('#evbar'); let cls = '', txt = '';
    if (ev.raid && app.raid) { cls = 'on'; txt = 'WORLD BOSS RAID IN DUSKHOLD · ' + mmss(ev.raid - now); }
    else if (ev.coins) { cls = 'on coins'; txt = '2X GOLD · ' + mmss(ev.coins - now); }
    else if (ev.luck) { cls = 'on luck'; txt = 'LUCKY LOOT · ' + mmss(ev.luck - now); }
    else if (ev.next && !RUN) txt = 'Next event: ' + ev.next.n + ' in ' + mmss(ev.next.in) + (ev.next.id === 'raid' && !app.online ? ' (online only)' : '');
    bar.className = cls; bar.textContent = txt; bar.style.display = txt ? '' : 'none';
    const bs = []; const sl = L.streakLuck(s); if (sl > 0) bs.push(`<span class="bst">${s.daily.streak}-day streak · +${Math.round(sl * 100)}% luck</span>`);
    // menu alerts
    const ups = upgrades(s);
    $('#mQuests').classList.toggle('alert', L.giftReady(s, now) || UI.passUnclaimed(s) > 0);
    const nNew = s.inv.filter(it => it.nw && !L.isEquipped(s, it.u)).length; $('#mGear').classList.toggle('alert', ups.length > 0 || nNew > 0); $('#invn').textContent = nNew ? nNew + ' NEW' : '';
    $('#mChar').classList.toggle('alert', L.statPoints(s) > 0);
    $('#mSpells').classList.toggle('alert', s.spells[s.cls].some(x => !x) && L.spellsFor(s.cls).some(sp => L.spellOk(s, sp) && !s.spells[s.cls].includes(sp.id)));
    $('#mDun').classList.toggle('alert', !!app.party && !RUN);
    // run bar + party frames
    let rh = '';
    if (RUN) { const t = Math.floor((performance.now() - RUN.t0) / 1000), tm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      if (RUN.mode === 'pit') rh = `<b>THE PIT</b><span>Wave ${RUN.wave || 1} · cleared ${RUN.waves}</span><span>${tm}</span>`;
      else if (RUN.mode === 'tower') rh = `<b style="color:#c8a0ff">ENDLESS TOWER</b><span>Floor ${RUN.floor || 1}</span>${RUN.mut ? `<span style="color:${RUN.mut.col}" title="${esc(RUN.mut.d)}">${esc(RUN.mut.n)}</span>` : ''}<span>Cleared ${RUN.floors || 0} · best ${s.towerBest || 0}</span><span>${tm}</span>`;
      else if (RUN.mode === 'duel') { const sc = RUN.score || {}, ids = [...RUN.players.keys()], nm = id => { const q = RUN.players.get(id); return q ? esc(q.n) : '?'; };
        rh = `<b style="color:#ffd84a">DUEL</b>${ids.map(id => `<span style="color:${id === app.myId ? '#9ad8a0' : '#ff9a9a'}">${nm(id)} ${sc[id] || 0}</span>`).join('<span>vs</span>')}<span>first to ${C.DUEL.WINS}</span><span>${tm}</span>`; }
      else if (RUN.mode === 'wild') rh = `<b style="color:#9ad8a0">THE WILDS</b><span>Camps cleared ${RUN.camps || 0}</span><span>Wayshrines ${(s.ways || []).length}/${C.WILD.WAYS}</span><span>${tm}</span>`;
      else if (RUN.mode === 'raid') rh = `<b style="color:#ff6a5a">BOSS RAID</b><span>${esc(C.MOBS[C.DUNGEONS[RUN.i].boss].n)}</span><span>${RUN.cleared ? 'CLEARED' : 'no respawns'}</span><span>${tm}</span>`;
      else { const d = C.DUNGEONS[RUN.i], lay = SL.W.layout(RUN.i), done = RUN.rooms.filter((r, i) => i > 0 && i <= lay.boss && r === 'c').length;
        const nowS = performance.now() / 1000, bf = RUN.buffs ? Object.keys(RUN.buffs).filter(k => RUN.buffs[k] > nowS).map(k => { const sd = C.SHRINES.find(q => q.id === k); return `<span style="color:${sd ? sd.col : '#fff'}">${sd ? sd.n.replace('Shrine of ', '') : k} ${Math.ceil(RUN.buffs[k] - nowS)}s</span>`; }).join('') : '';
        rh = `<b style="color:${d.col};filter:brightness(1.4)">${esc(d.n).toUpperCase()}</b><span style="color:${DIFF_C[RUN.df]}">${C.DIFFS[RUN.df].n}${RUN.hc ? ' · HARDCORE' : ''}</span><span style="color:#fff">${RUN.cleared ? 'CLEARED' : 'Rooms ' + done + '/' + lay.boss}</span>${bf}`; } }
    // the text changes every second; the Leave button stays the same element so it can always be clicked
    if (rh !== runHtml) { runHtml = rh; $('#rbtxt').innerHTML = rh; $('#runbar').classList.toggle('hidden', !rh); }
    if (RUN) { const lb = $('#rbleave'), want = RUN.done ? 'Exit' : 'Leave'; if (lb.textContent !== want) lb.textContent = want; }
    let ph = '';
    if (RUN && RUN.players.size > 1) for (const q of RUN.players.values()) { if (q.id === app.myId) continue; ph += `<div class="pf${q.dead ? ' dead' : ''}"><b>${esc(q.n)}</b><span class="m">${C.CLASSES[q.cls] ? C.CLASSES[q.cls].n : ''}${q.out ? ' · OUT' : q.dead ? ' · down' : ''}</span><div class="bar"><i style="width:${Math.max(0, q.hp / q.max * 100)}%"></i></div></div>`; }
    else if (!RUN && app.party && app.party.members.length > 1) ph = '<div class="pfh">PARTY</div>' + app.party.members.filter(m => m.id !== app.myId).map(m => `<div class="pf"><b>${esc(m.n)}</b><span class="m">Lv ${m.lv} ${C.CLASSES[m.cls] ? C.CLASSES[m.cls].n : ''}${m.id === app.party.leader ? ' · leader' : ''}</span></div>`).join('');
    if (ph !== partyHtml) { partyHtml = ph; $('#party').innerHTML = ph; }
    // spell bar: the 4 spells of your class
    const sk = s.cls + s.spells[s.cls].join() + s.level;
    if (sk !== spellKey) { spellKey = sk; for (let i = 0; i < C.SPELL_SLOTS; i++) { const id = (s.spells[s.cls] || [])[i], sp = id && L.spell(id), e = $('#sp' + i);
      e.innerHTML = (sp ? UI.spellIco(id) + `<span class="nm">${esc(sp.n)}</span>` : '<span class="m">+</span><span class="nm">empty</span>') + `<kbd>${(A().keyName || String)((A().BIND || C.KEYS)['s' + (i + 1)])}</kbd><div class="cd"></div><div class="cn"></div>`; e._cd = e._cn = null; e._a = e._tx = undefined;
      e.style.setProperty('--sc', sp ? sp.col : '#4a3c6a'); e.title = sp ? sp.n + ' · ' + sp.d : 'Empty slot: pick abilities in the Abilities book (K)'; e.classList.toggle('empty', !sp);
      const tb = $('#tS' + i); if (tb) { tb.style.backgroundImage = sp ? 'url(' + UI.spellImg(id) + ')' : ''; tb.style.backgroundSize = 'cover'; tb.style.borderColor = sp ? sp.col : ''; tb.style.boxShadow = sp ? '0 0 12px ' + sp.col : ''; } } }
    UI.goal(s, now);
  };
  let goalHtml = '';
  const MB_bossK = () => { const b = A()._debug && A()._debug.MB.boss; return b && b.max ? 1 - b.hp / b.max : 0; };
  UI.goal = function (s, now) {
    const app = A(), RUN = app.getRun && app.getRun(), out = [], best = L.bestDun(s), next = C.DUNGEONS[best + 1], ups = upgrades(s), pts = L.statPoints(s);
    let g;
    if (RUN && RUN.mode === 'raid' && !RUN.cleared) g = { h: 'Boss Raid', t: 'Beat ' + C.MOBS[C.DUNGEONS[RUN.i].boss].n + '. Nobody respawns. Dodge (Q) the red circles, jump (Space) the rings.', k: MB_bossK() };
    else if (RUN && RUN.mode === 'dungeon' && !RUN.cleared) g = { h: 'Dungeon', t: 'Clear every room and beat ' + C.MOBS[C.DUNGEONS[RUN.i].boss].n + ' before the clock runs out (every death costs ' + C.DEATH_PEN + 's). Only the boss drops gear. Abilities: ' + A().keyName(A().BIND.s1) + ' and ' + A().keyName(A().BIND.s2) + ' · Dodge: ' + A().keyName(A().BIND.dodge), k: RUN.rooms.filter((r, i) => i > 0 && i < 6 && r === 'c').length / 5 };
    else if (RUN && RUN.cleared) g = { h: 'Cleared!', t: 'Walk through the portal behind the chest to go home, or press Exit.', k: 1, done: 1 };
    else if (!s.clears) g = { h: 'First dungeon', t: 'Climb the great stairs north of the square to the Grand Gate and walk into the green Mossy Woods portal (far left).', k: 0 };
    else if (pts > 0) g = { h: 'Stat points', t: 'You have ' + pts + ' points. Open Character (C) and put them into ' + (s.cls === 'mage' ? 'Spell Power' : 'Power') + '.', k: 1, done: 1 };
    else if (ups.length) g = { h: 'Better gear', t: 'Equip ' + L.itemName(ups[0]) + ' in your Inventory (I).', k: 1, done: 1 };
    else if (next && s.level < next.lvl) { const k = L.bestStep(s.level), nl = L.stepLevel(k + 1); g = { h: 'Next step', t: (k % 3 < 2 ? C.DUNGEONS[best].n + ' on ' + C.DIFFS[k % 3 + 1].n : next.n) + ' opens at level ' + nl + ' (you are ' + s.level + ').', k: (s.level - L.stepLevel(k)) / Math.max(1, nl - L.stepLevel(k)) }; }
    else if (!L.dunRec(s, best).c[0]) g = { h: 'New dungeon', t: C.DUNGEONS[best].n + ' is open! Walk into its portal.', k: 1, done: 1 };
    else if (!L.dunRec(s, best).c[1]) g = { h: 'Go harder', t: 'Clear ' + C.DUNGEONS[best].n + ' on Hard for rarer loot and more XP.', k: 0 };
    else g = { h: 'Endgame', t: 'Nightmare and Hardcore drop the rarest gear. Relics: ' + s.relics.length + '/8.', k: s.relics.length / 8 };
    out.push(`<div class="gl${g.done ? ' done' : ''}"><h4>${esc(g.h)}</h4>${esc(g.t)}<div class="pb"><i style="width:${Math.min(100, g.k * 100)}%"></i></div></div>`);
    const h = out.slice(0, 3).join(''); if (h !== goalHtml) { goalHtml = h; $('#goal').innerHTML = h; }
  };
  // skills: cooldown sweeps (called every frame)
  // cached HUD elements; every write below only happens when the value changes (cheap on school laptops)
  const HE = {}, he = id => HE[id] || (HE[id] = $(id));
  UI.skills = function (cd) {
    const app = A(), s = app.s;
    const set = (e, left, total, txt) => { const a = total > 0 ? Math.round(Math.max(0, left / total) * 180) * 2 : 0;
      if (e._a !== a) { e._a = a; const c = e._cd || (e._cd = e.querySelector('.cd')); if (c) c.style.setProperty('--a', a + 'deg'); }
      txt = txt || ''; if (e._tx !== txt) { e._tx = txt; const n = e._cn || (e._cn = e.querySelector('.cn')); if (n) n.textContent = txt; }
      const on = left > 0 ? '1' : '0'; if (left <= 0 && e.dataset.cd === '1') { e.classList.remove('ready'); void e.offsetWidth; e.classList.add('ready'); } if (e.dataset.cd !== on) e.dataset.cd = on; };
    // Update 7 (final): the touch buttons show the same cooldowns (on a phone the key bar is hidden)
    const tset = (id, left) => { const e = he(id); if (!e) return; const t = left > 0 ? (left < 1 ? left.toFixed(1) : String(Math.ceil(left))) : ''; if (e._tt !== t) { e._tt = t; e.dataset.cdn = t; } };
    set(he('#skQ'), cd.dodge, C.DODGE_COOLDOWN); tset('#tDdg', cd.dodge);
    const arc = app.buffOn && app.buffOn('arcana') ? 0.5 : 1;
    for (let i = 0; i < C.SPELL_SLOTS; i++) { const id = (s.spells[s.cls] || [])[i], sp = id && L.spell(id), left = sp ? app.spellCd(id) : 0; set(he('#sp' + i), left, sp ? L.spellCd(s, sp) * 0.92 * arc : 0, left > 0 ? (left < 1 ? left.toFixed(1) : Math.ceil(left)) : ''); tset('#tS' + i, left); }
    clock();
    // combo pips: one per hit of this weapon's combo
    const cb = he('#skA .cb'), cn = (cd.comboN || 3) + ':' + cd.combo; if (cb && cb._k !== cn) { cb._k = cn; if (cb.children.length !== (cd.comboN || 3)) cb.innerHTML = '<i></i>'.repeat(cd.comboN || 3); [...cb.children].forEach((b, i) => b.classList.toggle('on', cd.combo > i)); }
    const ue = he('#skE'), uo = cd.use ? '1' : '0.45'; if (ue._o !== uo) { ue._o = uo; ue.style.opacity = uo; }
    set(he('#skF'), cd.parry, C.PARRY.CD); tset('#tPry', cd.parry);
    // style rank (only in a run)
    const st = cd.st, sb = he('#style');
    const on = !!(st && (st.rank > 0 || st.chain > 2)); if (sb._on !== on) { sb._on = on; sb.classList.toggle('on', on); }
    if (st && on) { const R = C.STYLE.RANKS, r = st.rank, lo = C.STYLE.AT[r], hi = C.STYLE.AT[r + 1] || lo + 40;
      if (sb._r !== r) { sb._r = r; const e = he('#stR'); e.textContent = R[r]; sb.style.setProperty('--rc', RANK_C[r]); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
      const n = st.chain > 1 ? st.chain + ' HIT COMBO' : RANK_W[r]; if (sb._n !== n) { sb._n = n; he('#stN').textContent = n; }
      const kb = Math.max(0.04, Math.min(1, ((st.pts || lo) - lo) / (hi - lo))).toFixed(2); if (sb._kb !== kb) { sb._kb = kb; sb.style.setProperty('--k', kb); } }
  };
  const RANK_C = ['#9a94a8', '#7ad8ff', '#7aff8a', '#ffd84a', '#ff9a3a', '#ff4a6a', '#ff4aff'], RANK_W = ['DULL', 'COOL', 'BRUTAL', 'AWESOME', 'STYLISH', 'SAVAGE', 'SLIME SLAYER'];
  UI.styleRank = () => {};   // the HUD reads the rank every frame; kept so events can poke it
  UI.ultBanner = (n, col) => { const e = $('#cineN'); if (!e) return; e.textContent = n; e.style.setProperty('--uc', col); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); clearTimeout(UI._banT); UI._banT = setTimeout(() => e.classList.remove('on'), 2500); };
  UI.tint = (col, dur) => { const e = $('#tint'); e.style.setProperty('--tc', col); e.classList.add('on'); requestAnimationFrame(() => e.style.opacity = 0.55); clearTimeout(UI._tintT); UI._tintT = setTimeout(() => { e.style.opacity = 0; setTimeout(() => e.classList.remove('on'), 400); }, dur * 1000); };
  // key labels on the HUD follow Settings → Controls
  UI.keysChanged = () => { const B = A().BIND || C.KEYS, kn = A().keyName || (c => c); const lab = (sel, a) => { const e = $(sel + ' kbd'); if (e) e.textContent = kn(B[a]); };
    lab('#skQ', 'dodge'); lab('#skE', 'use'); lab('#skF', 'parry'); for (let i = 0; i < C.SPELL_SLOTS; i++) { const e = $('#sp' + i + ' kbd'); if (e) e.textContent = kn(B['s' + (i + 1)]); } UI._spellKeys = 1; };
  // the dungeon clock (12 minutes; every death takes 10 seconds off)
  let clockTxt = '', clockCls = '', lastTick = -1;
  function clock() {
    const app = A(), tl = app.timeLeft ? app.timeLeft() : null, e = $('#timer'), RUN = app.getRun && app.getRun();
    if (tl === null || !RUN || RUN.cleared) { if (!e.classList.contains('hidden')) e.classList.add('hidden'); return; }
    e.classList.remove('hidden'); const sec = Math.ceil(tl), txt = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'), cls = tl <= 60 ? 'crit' : tl <= 180 ? 'warn' : '';
    if (txt !== clockTxt) { clockTxt = txt; $('#timern').textContent = txt; $('#timerbar i').style.width = Math.max(0, tl / L.dunTime(RUN.df) * 100) + '%'; if (tl <= 10 && sec !== lastTick && !RUN.done) { lastTick = sec; app.audio('tick', sec <= 3 ? 1 : 0); } }
    const hc = RUN.hc ? ' hc' : ''; if (cls + hc !== clockCls) { clockCls = cls + hc; e.className = cls + hc; if (cls === 'warn') UI.toast('3 minutes left!', '#ffd36a'); if (cls === 'crit') UI.toast('1 minute left! Beat the boss!', '#ff8a8a'); }
  }
  UI.timePen = function (pen, who) { const box = $('#timepen'), d = document.createElement('div'); d.innerHTML = '-' + pen + 's<small>' + esc(who) + '</small>'; box.appendChild(d); setTimeout(() => d.remove(), 1900);
    const dp = $('#deadpen'); if (dp && who === 'You died') dp.textContent = '-' + pen + ' seconds off the dungeon clock'; };
  UI.castFlash = function (slot) { const e = $('#sp' + slot); if (!e) return; e.classList.remove('cast'); void e.offsetWidth; e.classList.add('cast'); };
  UI.boss = function (b) {
    const e = $('#bossbar'); if (!b) { e.classList.add('hidden'); return; }
    e.classList.remove('hidden'); e.classList.toggle('p2', !!b.p2); e.querySelector('.bn').textContent = b.n; e.querySelector('.bar i').style.width = Math.max(0, b.hp / b.max * 100) + '%';
    e.querySelector('.bar span').textContent = fmt(Math.max(0, b.hp)) + ' / ' + fmt(b.max); e.querySelector('.bt').textContent = b.sub || '';
  };

  // ================================================================ PANELS
  const TITLES = { dungeons: ['Dungeons', 'find a party · pick a difficulty'], results: ['Run complete', ''], leave: ['Leave the dungeon?', ''], gear: ['Inventory', 'take gear off to put it back in your bag'], char: ['Character', 'class · stats · power'],
    spells: ['Abilities', 'two slots · Q and E'], forge: ['Blacksmith', 'upgrade · salvage · buy gear'],
    quests: ['Rewards', 'Battle Pass · milestones · daily gift'],
    profile: ['Profile', 'stats · records · bestiary'], board: ['Hall of Slayers', 'leaderboards'], settings: ['Menu', 'settings · account · credits'],
    gift: ['Daily Gift', 'a free reward every day'], avatar: ['Shop', 'chests · skins · your look'], trade: ['Trade', 'swap gear with another slayer'], duelreq: ['Duel challenge', 'one on one · weapons only'] };
  const PANEL_COL = { gear: ['#ffc23a', '#ff7a1a'], spells: ['#b44dff', '#3b8cff'], dungeons: ['#ff5a3a', '#b44dff'], char: ['#3b9cff', '#2ae0e0'],
    quests: ['#ffb21a', '#ff5a3a'], gift: ['#ffb21a', '#ff4ad8'], profile: ['#2ae0e0', '#3b8cff'], board: ['#ffd23a', '#ff8a1a'], settings: ['#a89ad8', '#6a5aa8'], results: ['#ffc23a', '#b44dff'],
    forge: ['#ff8a3a', '#ffc23a'], trade: ['#2ae0e0', '#3ddc5a'], avatar: ['#ff4ad8', '#3b8cff'], leave: ['#ff3a4a', '#ff8a3a'], duelreq: ['#ffd84a', '#ff3a4a'] };
  UI.show = function (name, arg) {
    UI.cur = name; UI.arg = arg; const p = $('#panel'), box = $('#pbox'), pc = PANEL_COL[name] || ['#b44dff', '#3b8cff']; box.style.setProperty('--pa', pc[0]); box.style.setProperty('--pb', pc[1]); p.classList.remove('hidden'); p.classList.toggle('sidep', name === 'avatar');
    box.className = 'pbox' + (name === 'avatar' ? ' side' : ['dungeons', 'forge', 'gear', 'quests'].includes(name) ? ' wide' : name === 'leave' || name === 'duelreq' ? ' small' : '') + (name === 'gear' ? ' invbox' : '');
    navBar(name);
    const t = TITLES[name] || [name, '']; $('#ptitle').textContent = t[0]; $('#psub').textContent = t[1];
    if (name === 'avatar') UI.avUndo = [JSON.stringify(A().s.look)];
    if (name === 'dungeons') { const d = UI.dsel || (UI.dsel = { mode: 'dungeon', i: 0, df: 0, hc: false, open: true }); if (arg && arg.mode === 'pit') d.mode = 'pit'; else if (arg && arg.mode === 'tower') d.mode = 'tower'; else if (arg && arg.mode === 'wild') d.mode = 'wild'; else if (arg && arg.i !== undefined) { d.mode = 'dungeon'; d.i = arg.i; } else if (!UI.dselSet) { d.i = L.bestDun(A().s); }
      UI.dselSet = true; if (!L.diffUnlocked(A().s, d.i, d.df)) d.df = 0; A().listParties(); }
    if (name === 'results') { const r = A().results; $('#ptitle').textContent = resultTitle(r); }
    if (UI.lastShown !== name) $('#pbody').scrollTop = 0; UI.lastShown = name;
    UI.render(); A().audio('click');
  };
  const NAV = [['gear', 'Inventory', 'chest', '#f0c45a'], ['char', 'Character', 'user', '#5aa8ff'], ['spells', 'Abilities', 'bolt', '#b47aff'],
    ['quests', 'Rewards', 'scroll', '#ffb84a'], ['profile', 'Profile', 'star', '#4ad8d8'], ['board', 'Hall of Slayers', 'trophy', '#ffd84a'], ['settings', 'Menu', 'gear', '#a89ad8']];
  function navBar(name) { const nv = $('#pnav'), on = NAV.some(n => n[0] === name); nv.classList.toggle('on', on); if (!on) return;
    nv.innerHTML = NAV.map(([k, n, ic, c]) => `<button class="${k === name ? 'on' : ''}" data-nav="${k}" style="--nc:${c}">${ico(ic)}${n}</button>`).join('');
    nv.querySelectorAll('[data-nav]').forEach(b => { b.onclick = e => { e.stopPropagation(); if (b.dataset.nav !== UI.cur) { UI.show(b.dataset.nav); A().audio('page'); } }; }); }
  UI.hide = function () { if (!UI.cur) return; const was = UI.cur; UI.cur = null; $('#panel').classList.add('hidden'); if (was === 'avatar') A().avatarClosed && A().avatarClosed(); try { $('#c').focus(); } catch (e) {} };
  $('#pclose').onclick = () => { if (UI.cur === 'results') A().closeResults(); else UI.hide(); };
  $('#rbleave').onclick = () => { const r = A().getRun(); A().leaveRun(r && r.done); };
  $('#panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') { if (UI.cur === 'results') A().closeResults(); else UI.hide(); } });
  UI.render = function () { if (!UI.cur) return; const fn = R[UI.cur], pb = $('#pbody'), h = fn ? fn(A().s) : ''; if (pb._h === h && pb._cur === UI.cur && pb.firstChild) return; pb._h = h; pb._cur = UI.cur;   // nothing changed: keep the same buttons (no flicker, no lost clicks)
    const sc = pb.scrollTop; pb.innerHTML = h; pb.scrollTop = sc; bind(); preview(); };
  function preview() { const host = document.getElementById('pv'); if (!host || !window.SSPreview || !A().myLook) return; SSPreview.attach(host, () => A().myLook(), A().gfxQ ? A().gfxQ() : 'med', A().myKind ? A().myKind() : 'sword'); }
  // all buttons use data-a="action" data-x="arg"
  function bind() { $('#pbody').querySelectorAll('[data-a]').forEach(b => { b.onclick = e => { e.stopPropagation(); act(b.dataset.a, b.dataset.x, b); }; }); if (UI.cur === 'forge') UI.bsBind(); }
  function act(a, x, el) {
    const app = A(), s = app.s, d = UI.dsel;
    switch (a) {
      // dungeons + parties
      case 'dsel': d.mode = x === 'pit' || x === 'wild' || x === 'tower' ? x : 'dungeon'; if (d.mode === 'dungeon') d.i = +x; if (!L.diffUnlocked(s, d.i, d.df)) d.df = 0; UI.render(); break;
      case 'rsel': d.mode = 'raid'; d.i = +x; UI.render(); break;
      case 'ddf': d.df = +x; UI.render(); break;
      case 'dhc': d.hc = !d.hc; UI.render(); break;
      case 'dopen': d.open = !d.open; UI.render(); break;
      case 'solo': app.playSolo(d.mode, d.i, d.df, d.hc); break;
      case 'quick': app.quickMatch(d.mode, d.i, d.df, d.hc); break;
      case 'pcreate': app.createParty(d.mode, d.i, d.df, d.hc, d.open); break;
      case 'pjoin': app.joinParty(+x); break;
      case 'pleave': app.leaveParty(); break;
      case 'pstart': app.startParty(); break;
      case 'pset': app.partySet(d.mode, d.i, d.df, d.hc, d.open); break;
      case 'pkick': app.kick(+x); break;
      case 'again': UI.hide(); app.again(); break;
      case 'home': UI.hide(); app.leaveRun(true); break;
      case 'stay': UI.hide(); break;
      case 'leaveyes': app.leaveRun(true); break;
      // gear
      case 'gsel': { UI.gearSel = +x; const it = L.item(s, +x); if (it && it.nw) app.act('seen', { u: +x }); UI.render(); break; }
      case 'gsort': UI.gearSort = x; UI.render(); break;
      case 'seenall': app.act('seen', { u: 'all' }); break;
      case 'openInv': UI.show('gear'); break;
      case 'gtab': UI.gearTab = x; UI.render(); break;
      case 'equip': app.act('equip', { u: +x }); break;
      case 'store': app.act('store', { u: +x, on: el && el.dataset.y === '1' }); break;
      case 'invview': UI.gearView = x; if (x === 'skills') { UI.spTab = 'ab'; UI.show('spells'); } else UI.show('gear'); break;
      case 'unequip': app.act('unequip', { slot: x }); break;
      case 'sell': app.act('sell', { us: [+x] }); UI.gearSel = null; break;
      case 'sellc': { const us = s.inv.filter(it => it.r === 0 && !L.isEquipped(s, it.u)).map(it => it.u); if (us.length) app.act('sell', { us }); else UI.toast('No unequipped Common gear', '#c8c0d4'); break; }
      case 'autosell': app.act('autosell', { r: +x, on: !s.autoSell[+x] }); break;
      case 'showArmor': app.act('showArmor', { on: !s.showArmor }); break;
      case 'upg': app.act('upg', { u: +x, n: 1 }); break;
      case 'bsSel': UI.bsSel = +x; UI.render(); break;
      case 'bsMode': UI.bsMode = UI.bsMode === x ? '1' : x; UI.render(); break;
      case 'bsUp': if (UI.bsMode === 'all') app.act('upgAll'); else app.act('upg', { u: UI.bsSel, n: UI.bsMode === '10' ? 10 : 1 }); break;
      case 'buyGear': { const [i, slot] = x.split(':'); app.act('buyGear', { i: +i, slot }); break; }
      // character
      case 'stat': { const [k, n] = x.split(':'); app.act('stat', { k, n: n === 'all' ? L.statPoints(s) : +n }); break; }
      case 'resetStats': app.act('resetStats'); break;
      case 'cls': app.act('cls', { cls: x }); break;
      case 'swapCls': app.act('cls', { cls: s.cls === 'mage' ? 'warrior' : 'mage' }); break;
      case 'spSel': UI.spSel = x; UI.render(); break;
      case 'spSlot': { const id = UI.spSel; if (id) { app.act('spell', { slot: +x, id }); UI.spSel = null; } else app.act('spell', { slot: +x, id: '' }); break; }
      case 'spAuto': { const list = s.spells[s.cls] || [], free = list.indexOf(''); app.act('spell', { slot: free >= 0 ? free : C.SPELL_SLOTS - 1, id: x }); break; }
      // quests, gift
      case 'gift': app.act('gift'); break;
      case 'title': app.setTitle(x); break;
      case 'btab': UI.boardTab = x; UI.render(); break;
      case 'bind': UI.binding = UI.binding === x ? null : x; UI.render(); break;
      case 'resetKeys': app.resetKeys(); UI.binding = null; UI.render(); break;
      case 'set': { const [k, v] = x.split(':'); app.setSetting(k, v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v); UI.render(); break; }
      case 'logout': app.logout(); break;
      case 'menu': app.mainMenu(); break;
      case 'reset': if (confirmReset()) app.resetGuest(); break;
      case 'credits': UI.show('settings', 'credits'); break;
      case 'avtab': UI.avTab = x; UI.render(); break;
      case 'chest': if (!UI.spinning) app.act('chest', { id: x }); break;
      case 'skinOn': { const q = L.cosm(x); if (q) app.act('skin', { kind: q.k, id: x }); break; }
      case 'skinOff': app.act('skin', { kind: x, id: '' }); break;
      case 'lk': { const [k, v] = x.split('|'); avSet(k, v); break; }
      case 'lkr': avRandom(); break;
      case 'lku': avUndo(); break;
      case 'lks': app.saveOutfit(+x); break;
      case 'lkl': { const o = s.outfits[+x]; if (o) { pushUndo(); app.setLook(Object.assign({}, o)); } break; }
      // trading
      case 'trreq': app.tradeSend({ a: 'req', to: +x }); break;
      case 'duelreq': app.send({ t: 'duel', a: 'req', to: +x }); break;
      case 'duelacc': app.send({ t: 'duel', a: 'acc' }); app.duelReq = null; UI.hide(); break;
      case 'dueldec': app.send({ t: 'duel', a: 'dec' }); app.duelReq = null; UI.hide(); break;
      case 'qtab': UI.qTab = x; UI.render(); app.audio('page'); break;
      case 'setTab': UI.setTab = x; UI.render(); break;
      case 'photo': UI.hide(); app.photo(true); break;
      case 'tutAgain': app.tutAgain(); UI.hide(); break;
      case 'ftab': UI.fTab = x; UI.render(); break;
      case 'pass': app.act('passClaim', { k: +x }); break;
      case 'openGear': UI.show('gear'); break;
      case 'passAll': { const P = L.passEnsure(s), t = L.passTier(s); for (let k = 0; k < t; k++) if (!P.claimed.includes(k)) app.act('passClaim', { k }); break; }
      case 'bclaim': app.act('bestiary', { i: +x }); break;
      case 'feed': app.act('feed', { id: +x }); break;
      case 'csel': { const u = +x, a = UI.craftSel || (UI.craftSel = []); const k = a.indexOf(u); if (k >= 0) a.splice(k, 1); else a.push(u); UI.render(); break; }
      case 'cselAll': UI.craftSel = s.inv.filter(it => !L.isEquipped(s, it.u) && it.raid === undefined && it.r <= +x).map(it => it.u); UI.render(); break;
      case 'salvage': if ((UI.craftSel || []).length) app.act('salvage', { us: UI.craftSel.slice() }); break;
      case 'uprarity': app.act('uprarity', { u: +x }); break;
      case 'tracc': app.tradeSend({ a: 'accept', from: +x }); app.tradeReq = null; break;
      case 'trdec': app.tradeSend({ a: 'decline', from: +x }); app.tradeReq = null; UI.render(); break;
      case 'tritem': { const u = +x, i = UI.tradeItems.indexOf(u); if (i >= 0) UI.tradeItems.splice(i, 1); else if (UI.tradeItems.length < 8) UI.tradeItems.push(u); sendOffer(); break; }
      case 'trready': app.tradeSend({ a: 'ready', v: !(app.trade && app.trade.ready) }); break;
      case 'trcancel': app.tradeSend({ a: 'cancel' }); break;
      case 'trade': UI.show('trade'); break;
      case 'emote': app.emote(x); break;
      case 'openSpells': UI.show('spells'); break;
    }
  }
  UI.tradeItems = [];
  function sendOffer() { A().tradeSend({ a: 'offer', items: UI.tradeItems }); }
  let resetArm = 0; function confirmReset() { const n = performance.now(); if (n - resetArm < 3000) return true; resetArm = n; UI.toast('Press again to delete your guest save', '#ffcf8a'); return false; }
  const notHere = (k, what) => `<div class="note warn" style="margin-bottom:10px">${ico('lock')} Visit the ${esc(W.STN[k].l)} in Duskhold to ${what}.</div>`;
  const R = {};
  const rarC = r => C.GEAR_RARITY[r].c;
  // ---------- dungeons: finder, party lobby ----------
  function dunCard(s, i, sel) {
    const d = C.DUNGEONS[i], open = L.dunUnlocked(s, i), rec = L.dunRec(s, i);
    return `<button class="dun${open ? '' : ' lock'}${sel ? ' on' : ''}" data-a="dsel" data-x="${i}" style="--dc:${d.col}"><b>${esc(d.n)}</b><span>Lv ${d.lvl}${open ? '' : ' · locked'}</span><i>${[0, 1, 2].map(k => `<em style="color:${rec.c[k] ? DIFF_C[k] : '#3a3442'}">●</em>`).join('')}</i></button>`;
  }
  R.dungeons = s => {
    const app = A(), d = UI.dsel, P = app.party, RUN = app.getRun();
    if (RUN && RUN.mode !== 'wild') return `<div class="note">You are in a run. Finish it or leave first.</div>`;
    const list = C.DUNGEONS.map((_, i) => dunCard(s, i, d.mode === 'dungeon' && d.i === i)).join('') + `<button class="dun${d.mode === 'pit' ? ' on' : ''}" data-a="dsel" data-x="pit" style="--dc:#ff4a4a"><b>The Pit</b><span>Wave defence</span><i>best ${s.pitBest}</i></button>`
      + `<button class="dun${d.mode === 'tower' ? ' on' : ''}" data-a="dsel" data-x="tower" style="--dc:#c8a0ff"><b>Endless Tower</b><span>Floors and mutators</span><i>best ${s.towerBest || 0}</i></button>`
      + `<button class="dun${d.mode === 'wild' ? ' on' : ''}" data-a="dsel" data-x="wild" style="--dc:#9ad8a0"><b>The Wilds</b><span>Open overworld</span><i>${(s.ways || []).length}/${C.WILD.WAYS} shrines</i></button>`
      + '<div class="pfh" style="margin-top:6px">BOSS RAIDS</div>' + C.RAIDS.map((R, k) => { const open = L.raidUnlocked(s, k), D = C.DUNGEONS[k]; return `<button class="dun${open ? '' : ' lock'}${d.mode === 'raid' && d.i === k ? ' on' : ''}" data-a="rsel" data-x="${k}" style="--dc:${D.col}"><b>${esc(C.MOBS[D.boss].n.replace(/^The /, ''))}</b><span>Lv ${L.raidLevel(k)}${open ? '' : ' · clear ' + esc(D.n) + ' on Hard'}</span><i>${s.raids[k] ? '✓ ' + s.raids[k] : ''}</i></button>`; }).join('');
    let right = '';
    if (d.mode === 'raid') { const R = C.RAIDS[d.i], D = C.DUNGEONS[d.i], b = L.raidStats(d.i, D.boss, 1, 'boss'), owned = s.cosm.includes('raid' + d.i);
      right = `<h3 style="color:#ff6a5a">BOSS RAID · ${esc(C.MOBS[D.boss].n).toUpperCase()}</h3><p class="m">One empowered boss in the raid arena, with a third frenzy phase that calls its elite guard. Nobody respawns: if the whole party falls, the raid is lost. Best with friends.</p>
        <div class="kv"><span>Boss level</span><b>${L.raidLevel(d.i)}${s.level < L.raidLevel(d.i) ? ' <span class="warn">(you are ' + s.level + ')</span>' : ''}</b><span>Boss health (solo)</span><b>${fmt(b.hp)}</b><span>Exclusive ring</span><b style="color:${rarC(3)}">${esc(R.ring)} · Epic or better</b>
        <span>Rare cosmetic</span><b style="color:${R.cosm.v};filter:brightness(1.3)">${esc(R.cosm.n)}${owned ? ' ✓' : ' (guaranteed the first time)'}</b><span>Wins</span><b>${s.raids[d.i] || 0}</b></div>
        ${L.raidUnlocked(s, d.i) ? '' : `<p class="warn">${ico('lock')} Clear ${esc(D.n)} on Hard to open this raid.</p>`}`; }
    else if (d.mode === 'wild') right = `<h3 style="color:#9ad8a0">THE WILDS</h3><p class="m">An open overworld west of Duskhold (through the Wildgate Market). Camps of slimes from every dungeon you have reached wake when you come near and come back a while after you clear them. Find the five hidden wayshrines. The Far Gates to the new worlds stand at its west edge.</p>
      <div class="kv"><span>Camps cleared (all time)</span><b>${s.wildCamps || 0}</b><span>Wayshrines</span><b>${(s.ways || []).length} / ${C.WILD.WAYS}</b><span>Loot</span><b>gold and XP for every camp</b><span>Lost lanterns</span><b>${(s.lanterns || []).length} / ${L.ND} (one hidden in every dungeon)</b></div>`;
    else if (d.mode === 'tower') { const T = C.TOWER, nx = (s.towerBest || 0) + 1, prev = [1, 2, 3].map(k => { const f = Math.max(1, nx - 1 + k); const fl = L.towerFloor(s, f, 1); return `<span>Floor ${f}</span><b>${fl.list.length} slimes${fl.list.some(m => m.kind === 'boss') ? ' · a boss' : fl.list.some(m => m.kind === 'mini') ? ' · a mini-boss' : ''}${fl.mut ? ' · <span style="color:' + fl.mut.col + '">' + esc(fl.mut.n) + '</span>' : ''}</b>`; }).join('');
      right = `<h3 style="color:#c8a0ff">THE ENDLESS TOWER</h3><p class="m">Floor after floor of slimes from every world you have reached, a little stronger each time. From floor ${T.MUT_FROM} a mutator twists every floor. A mini-boss every ${T.MINI_EVERY} floors, a boss every ${T.BOSS_EVERY}. You heal ${Math.round(T.HEAL * 100)}% between floors. When the party falls, you are paid for every floor you cleared.</p>
      <div class="kv"><span>Your best</span><b>floor ${s.towerBest || 0}</b>${prev}<span>Loot</span><b>gold and XP for every floor · Battle Pass XP</b></div>
      <div class="sec">Mutators</div><div class="muts">${C.MUTATORS.map(m => `<span style="--mc:${m.col}" title="${esc(m.d)}"><b>${esc(m.n)}</b>${esc(m.d)}</span>`).join('')}</div>`; }
    else if (d.mode === 'pit') right = `<h3 class="gold">THE PIT</h3><p class="m">Endless waves of slimes from your best dungeon. Every wave is stronger. When the whole party is down, the run ends and you are paid for every wave cleared.</p>
      <div class="kv"><span>Your best</span><b>wave ${s.pitBest}</b><span>Loot</span><b>gold and XP for every wave</b><span>Gear</span><b>only from dungeon bosses</b></div>`;
    else { const D = C.DUNGEONS[d.i], open = L.dunUnlocked(s, d.i), rec = L.dunRec(s, d.i), mobs = L.runMobs(d.i, d.df, 1, d.hc), diff = C.DIFFS[d.df], hcm = d.hc ? C.HARDCORE : { xp: 1, gold: 1 };
      const xp = Math.round(L.clearXp(d.i, d.df, d.hc)), gold = Math.round(mobs.reduce((a, m) => a + m.gold, 0) * diff.gold * hcm.gold * (1 + C.CLEAR_BONUS)), lvl = L.dunLevel(d.i, d.df);
      right = `<h3 style="color:${D.col}">${esc(D.n).toUpperCase()}</h3><p class="m">${esc(D.d)}</p>
        <div class="kv"><span>Slime level</span><b>${lvl}${s.level < lvl ? ' <span class="warn">(you are ' + s.level + ')</span>' : ''}</b><span>Boss</span><b>${esc(C.MOBS[D.boss].n)}</b><span>Rewards (clear)</span><b>~${fmt(xp)} XP · ~${fmt(gold)} gold${rec.c[d.df] ? '' : ' (x' + (1 + C.FIRST_CLEAR_GOLD) + ' on your first clear)'}</b>
        <span>Time limit</span><b>${Math.floor(L.dunTime(d.df) / 60)}:00 · -${C.DEATH_PEN}s for every death</b>
        <span>Boss loot</span><b>${L.dropsN(d.hc)} random ${esc(C.GEAR_TIERS[d.i].p)} items · level ${Math.max(1, lvl - C.GEAR.LV_SPREAD)}-${lvl} (never above the run)${d.df === 2 ? ' · rings!' : ''}</b><span>Unlocks</span><b>${C.SPELLS.filter(q => q.t === d.i && q.cls === s.cls).map(q => esc(q.n)).join(' and ')} (${C.CLASSES[s.cls].n} abilities)</b><span>Best time</span><b>${rec.best[d.df] ? Math.floor(rec.best[d.df] / 60) + ':' + String(rec.best[d.df] % 60).padStart(2, '0') : '—'}</b></div>
        <div class="sec">Difficulty</div><div class="opts">${C.DIFFS.map((df, k) => { const ok = L.diffUnlocked(s, d.i, k); return `<button class="${d.df === k ? 'on' : ''}" data-a="ddf" data-x="${k}" ${ok ? '' : 'disabled'} style="color:${DIFF_C[k]}">${df.n}<span class="lk">${ok ? 'Lv ' + L.dunLevel(d.i, k) : 'needs Lv ' + L.dunLevel(d.i, k)}</span></button>`; }).join('')}
          <button class="${d.hc ? 'on' : ''}" data-a="dhc">${ico('skull')} Hardcore ${d.hc ? 'ON' : 'off'}<span class="lk" style="color:#c8a0a0">one life · +${Math.round((C.HARDCORE.luck - 1) * 100)}% luck</span></button></div>
        ${open ? '' : `<p class="warn">${ico('lock')} ${esc(app.canPlay('dungeon', d.i, 0))}</p>`}`; }
    const err = app.canPlay(d.mode, d.i, d.df);
    let btns = `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="r big" data-a="solo" ${err ? 'disabled' : ''}>Play solo</button>`;
    if (app.online) btns += `<button class="g big" data-a="quick" ${err ? 'disabled' : ''}>Quick match</button><button class="c" data-a="pcreate" ${err ? 'disabled' : ''}>Create party</button><button class="${d.open ? 'on' : ''} k" data-a="dopen">${d.open ? 'Public' : 'Friends only'}</button>`;
    btns += '</div>' + (app.online ? '<div class="note" style="margin-top:6px">Quick match puts you in an open party for this dungeon and difficulty (or makes one). Up to ' + C.PARTY_MAX + ' slayers · every enemy has x' + C.MOB.PARTY_HP + ' health for each player who joins · everyone gets full rewards and +' + Math.round(C.PARTY_XP * 100) + '% XP for every other slayer.</div>' : '<div class="note warn" style="margin-top:6px">Offline: solo runs only. Parties and matchmaking need the server.</div>');
    let lobby = '';
    if (P) { const lead = P.leader === app.myId, name = P.mode === 'pit' ? 'The Pit' : P.mode === 'tower' ? 'The Endless Tower' : P.mode === 'wild' ? 'The Wilds' : P.mode === 'raid' ? 'Boss Raid: ' + C.MOBS[C.DUNGEONS[P.i].boss].n : C.DUNGEONS[P.i].n;
      lobby = `<div class="lobby"><div class="sec">Your party · ${esc(name)} · <span style="color:${DIFF_C[P.df]}">${C.DIFFS[P.df].n}</span>${P.hc ? ' · HARDCORE' : ''} · ${P.open ? 'public' : 'friends only'}</div>
        ${P.members.map(m => `<div class="trow"><b style="flex:1">${m.id === P.leader ? ico('star') + ' ' : ''}${esc(m.n)}${m.g ? ' <span class="m">(guest)</span>' : ''}</b><span class="m">Lv ${m.lv} · ${C.CLASSES[m.cls] ? C.CLASSES[m.cls].n : ''}</span>${lead && m.id !== app.myId ? `<button class="k" data-a="pkick" data-x="${m.id}">Kick</button>` : ''}</div>`).join('')}
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">${lead ? `<button class="r big" data-a="pstart">Start (${P.members.length}/${C.PARTY_MAX})</button><button class="k" data-a="pset">Use the dungeon picked on the left</button>` : '<span class="m">Waiting for the leader to start...</span>'}<button data-a="pleave">Leave party</button></div></div>`; }
    const open = (app.parties || []).filter(q => !P || q.id !== P.id);
    const plist = app.online ? `<div class="sec">Open parties (${open.length})</div>` + (open.length ? open.slice(0, 12).map(q => `<div class="trow"><b style="flex:1">${esc(q.members[0] ? q.members[0].n : '?')}'s party</b><span class="m">${q.mode === 'pit' ? 'The Pit' : q.mode === 'tower' ? 'Endless Tower' : q.mode === 'wild' ? 'The Wilds' : q.mode === 'raid' ? 'Raid: ' + esc(C.MOBS[C.DUNGEONS[q.i].boss].n) : esc(C.DUNGEONS[q.i].n)} · <span style="color:${DIFF_C[q.df]}">${C.DIFFS[q.df].n}</span>${q.hc ? ' · HC' : ''} · ${q.members.length}/${C.PARTY_MAX}</span><button class="g" data-a="pjoin" data-x="${q.id}" ${app.canPlay(q.mode, q.i, q.df) ? 'disabled' : ''}>Join</button></div>`).join('') : '<div class="note">No open parties right now. Make one, or use Quick match.</div>') : '';
    return `<div class="dgrid"><div class="dlist">${list}</div><div class="ddet">${lobby}${right}${P ? '' : btns}${plist}</div></div>`;
  };
  // ---------- results ----------
  function resultTitle(r) { if (!r) return 'Run over'; if (r.err) return 'No rewards'; if (r.mode === 'pit') return 'The Pit · ' + ((r.sum && r.sum.waves) || 0) + ' waves'; if (r.mode === 'wild') return 'The Wilds · ' + ((r.sum && r.sum.camps) || 0) + ' camps'; if (r.mode === 'tower') return 'Endless Tower · ' + ((r.sum && r.sum.floor) || 0) + ' floors';
    if (r.mode === 'duel') return !r.sum || !r.sum.winner ? 'Duel over · a draw' : r.sum.winner === A().myId ? 'You won the duel!' : 'You lost the duel';
    if (r.mode === 'raid') return r.sum && r.sum.res === 'clear' && !r.early ? 'Raid cleared' : r.early ? 'You left the raid' : 'The raid is lost';
    const res = r.sum && r.sum.res; return res === 'clear' ? 'Dungeon cleared' : r.early ? 'You left the run' : res === 'time' ? 'Time\'s up!' : res === 'wipe' ? 'Your party fell' : 'Run over'; }
  R.results = s => {
    const app = A(), r = app.results; if (!r) return '';
    const rw = r.r, sum = r.sum || { players: [] }, me = sum.players.find(p => p.id === app.myId) || {}, t = r.secs || 0, tm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    const D = r.mode === 'pit' || r.mode === 'wild' || r.mode === 'tower' || r.mode === 'duel' ? null : C.DUNGEONS[r.i];
    let h = `<div class="res">${D ? `<div class="m" style="color:${D.col}">${esc(D.n).toUpperCase()} · <span style="color:${DIFF_C[r.df]}">${C.DIFFS[r.df].n}</span>${r.hc ? ' · HARDCORE' : ''}</div>` : ''}
      <div class="res6"><div><span>Time</span><b>${tm}</b></div><div><span>Kills</span><b>${fmt(me.kills || 0)}</b></div><div><span>Damage</span><b>${fmt(me.dmg || 0)}</b></div><div><span>Best style</span><b style="color:${RANK_C[me.style || 0]}">${['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'][me.style || 0]}</b></div></div>
      <div class="kv">${r.mode === 'pit' ? `<span>Waves cleared</span><b>${sum.waves || 0}</b>` : r.mode === 'tower' ? `<span>Floors cleared</span><b>${sum.floor || 0}</b>${(sum.muts || []).length ? `<span>Mutators faced</span><b>${[...new Set(sum.muts)].map(id => { const m = C.MUTATORS.find(q => q.id === id); return m ? `<span style="color:${m.col}">${esc(m.n)}</span>` : ''; }).join(' · ')}</b>` : ''}` : r.mode === 'duel' ? `<span>Score</span><b>${sum.players.map(p => esc(p.name) + ' ' + ((sum.score || {})[p.id] || 0)).join(' · ')}</b>` : r.mode === 'wild' ? `<span>Camps cleared</span><b>${sum.camps || 0}</b>` : r.mode === 'raid' ? `<span>Raid boss</span><b>${esc(C.MOBS[C.DUNGEONS[r.i].boss].n)}</b>` : `<span>Rooms cleared</span><b>${Math.min(SL.W.layout(r.i).boss, sum.progress || 0)} / ${SL.W.layout(r.i).boss}</b>`}
        ${sum.limit && r.mode !== 'duel' ? `<span>Clock left</span><b style="color:${sum.res === 'time' ? '#ff7a7a' : '#9ad8ff'}">${mmss(Math.max(0, sum.limit - (sum.t || 0) - (sum.pen || 0)) * 1000)}</b><span>Deaths</span><b>${me.deaths || 0}${me.deaths ? ' <span class="m">(-' + me.deaths * C.DEATH_PEN + 's)</span>' : ''}</b>` : ''}${me.casts ? `<span>Abilities used</span><b>${fmt(me.casts)}</b>` : ''}${me.parries || me.pdodges ? `<span>Parries · perfect dodges</span><b>${me.parries || 0} · ${me.pdodges || 0}</b>` : ''}</div>`;
    if (sum.res === 'time' && !r.early) h += `<div class="note warn" style="margin-top:8px">${ico('skull')} The clock hit zero. You get ${Math.floor(L.dunTime(r.df) / 60)} minutes on ${C.DIFFS[r.df] ? C.DIFFS[r.df].n : "Normal"} and each death takes ${C.DEATH_PEN} seconds off. Use your abilities to clear rooms faster.</div>`;
    if (r.err) h += `<p class="warn">${esc(r.err)}</p>`;
    if (rw && rw.ok) {
      h += `<div class="sec">Rewards</div><div class="rw">${rw.xp ? `<span class="big">+${fmt(rw.xp)} XP</span>` : ''}${rw.gold ? `<span class="big" style="color:var(--coin)">+${fmt(rw.gold)} gold${rw.first ? ' · first clear!' : ''}</span>` : ''}${rw.ups ? `<span class="big" style="color:var(--gold2)">LEVEL ${rw.level}!</span>` : ''}${rw.rec ? '<span class="big" style="color:var(--gold2)">New record!</span>' : ''}</div>`;
      if (r.mode === 'duel') h += `<div class="note">${rw.won ? 'Duel wins: ' + (A().s.duelWins || 0) : 'Every duel teaches something. Parry the finisher and punish.'}</div>`;
      if (rw.items && rw.items.length) h += `<div class="sec">Boss loot · ${rw.items.length} item${rw.items.length === 1 ? '' : 's'}</div><div class="loot">${rw.items.slice().sort((a, b) => b.r - a.r).map(it => `<div class="li" style="--rc:${rarC(it.r)}"><img src="${UI.itemIcon(it)}"><div><b style="color:${rarC(it.r)}">${esc(L.itemName(it))}</b><span class="m"><span class="rar" style="--rc:${rarC(it.r)};padding:0 6px;font-size:10px">${C.GEAR_RARITY[it.r].n}</span> ${esc(L.SLOT_N[it.s])} · Lv ${it.lv}${it.c ? ' · ' + C.CLASSES[it.c].n : ''}${rw.kept && rw.kept.includes(it.u) ? '' : ' · sold'}</span><span class="m sl">${shortLines(it)}</span></div></div>`).join('')}</div>${rw.sold ? `<div class="note">Sold for ${fmt(rw.sold)} gold (auto-sell or full backpack).</div>` : ''}
        <div class="row" style="margin-top:8px"><button class="c" data-a="openInv">Open your inventory (I)</button></div>`;
      else if (r.mode === 'dungeon' && !(sum.res === 'clear')) h += `<div class="note">Gear only drops from the final boss: beat it before the clock runs out for ${L.dropsN(r.hc)} random items.</div>`;
      else if (r.mode === 'raid' && !rw.cleared) h += '<div class="note">Raid rewards only come from a win. Bring friends, better gear, or a healer.</div>';
      if (rw.cosm) h += `<div class="sec">Raid cosmetic unlocked</div><div class="qrow"><span class="sw" style="background:${rw.cosm.v};width:26px;height:26px"></span><div class="q"><b>${esc(rw.cosm.n)}</b><div class="m" style="color:var(--mut)">New ${rw.cosm.k === 'cape' ? 'cloak colour' : 'weapon trail'} in the Armory</div></div></div>`;
    } else if (!r.err && app.mode === 'account') h += '<div class="note">No rewards this time.</div>';
    if (sum.players.length > 1) h += `<div class="sec">Party</div><table class="lb">${sum.players.map(p => `<tr class="${p.id === app.myId ? 'me' : ''}"><td></td><td>${esc(p.name)}${p.out ? ' (out)' : ''}</td><td>${fmt(p.kills)} kills · ${fmt(p.dmg)} dmg</td></tr>`).join('')}</table>`;
    const lead = !app.party || app.party.leader === app.myId;
    h += `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${lead ? '<button class="r big" data-a="again">Play again</button>' : ''}<button class="g big" data-a="home">Return to Duskhold</button>${sum.res === 'clear' && !r.early ? '<button data-a="stay">Stay and look around</button>' : ''}</div></div>`;
    return h;
  };
  R.duelreq = s => { const q = A().duelReq; if (!q) return '<div class="note">No duel request.</div>';
    return `<div class="credits"><h3 style="color:#ffd84a">${esc(q.n)} challenges you to a duel</h3><p>One on one in the Pit's arena. Everyone has the same health and damage, so only skill counts: combos, heavies, parries and dodges. No abilities. First to ${C.DUEL.WINS} knock-outs wins ${C.DUEL.GEMS_WIN} gems.</p>
      <div class="row" style="display:flex;gap:8px;justify-content:center"><button class="r big" data-a="duelacc">Accept</button><button class="k big" data-a="dueldec">Decline</button></div></div>`; };
  R.leave = s => { const run = A().getRun(); const n = run ? (run.mode === 'pit' ? run.waves + ' waves' : run.mode === 'wild' ? (run.camps || 0) + ' camps' : run.rooms.filter((x, i) => i > 0 && i < 6 && x === 'c').length + ' rooms') : '';
    return `<div class="credits"><p>You keep the rewards for what you cleared so far (${n}).${run && run.players.size > 1 ? ' Your party carries on without you.' : ''}</p><div class="row" style="display:flex;gap:8px;justify-content:center"><button class="r big" data-a="leaveyes">Leave</button><button class="k big" data-a="stay">Keep fighting</button></div></div>`; };
  // ---------- gear: inventory (equipment, your stats, the bag, the item you picked, recent drops) ----------
  const lineTxt = l => fmt(Math.round(l.v));
  function shortLines(it) { return L.itemLines(it).map(l => esc(l.n) + ' ' + fmt(Math.round(l.v))).join(' · '); }
  UI.shortLines = shortLines;
  // your stats now, and what they would be with item `it` equipped instead
  // Update 7 (final): three numbers. Power (all your gear x your class stat: what abilities hit with), Health (your level and Vitality), and what one weapon swing hits for
  function statsOf(s) { return { pow: L.power(s), hp: L.maxHp(s), swing: L.ap(s) }; }
  function withItem(s, it) { return Object.assign({}, s, { eq: Object.assign({}, s.eq, { [it.s]: it.u }) }); }
  const STAT_ROWS = [['pow', 'Power', v => fmt(Math.round(v))], ['hp', 'Health', v => fmt(Math.round(v))], ['swing', 'Weapon swing', v => fmt(Math.round(v))]];
  function statPanel(s, preview) {
    const a = statsOf(s), b = preview ? statsOf(withItem(s, preview)) : null;
    return `<div class="pst">${STAT_ROWS.map(([k, n, f]) => {
      let d = ''; if (b) { const dv = b[k] - a[k]; if (Math.abs(dv) > Math.max(1e-6, Math.abs(a[k]) * 0.001)) d = `<em class="${dv > 0 ? 'up' : 'dn'}">${dv > 0 ? '▲' : '▼'} ${f(b[k])}</em>`; }
      return `<span>${n}</span><b>${f(a[k])}${d}</b>`; }).join('')}</div>`;
  }
  // the main numbers in one line, with ▲▼ for what changes if you equip the picked item
  function statSum(s, preview) {
    const a = statsOf(s), b = preview ? statsOf(withItem(s, preview)) : null;
    return `<div class="sum">${STAT_ROWS.map(([k, n, f]) => {
      let d = ''; if (b) { const dv = b[k] - a[k]; if (Math.abs(dv) > Math.max(1e-6, Math.abs(a[k]) * 0.001)) d = `<em class="${dv > 0 ? 'up' : 'dn'}">${dv > 0 ? '▲' : '▼'}${f(b[k])}</em>`; }
      return `<span>${n}<b>${f(a[k])}</b>${d}</span>`; }).join('')}</div>`;
  }
  const rarChip = (r, extra) => `<span class="rar" style="--rc:${rarC(r)}"><i></i>${C.GEAR_RARITY[r].n}${extra || ''}</span>`;
  function itemCard(s, it, near) {
    const eq = L.isEquipped(s, it.u), cur = L.eqItem(s, it.s), ty = it.s === 'w' ? C.TYPES[it.k] : null;
    const st = L.itemLines(it), cs = cur && !eq ? L.itemLines(cur) : null;
    const rows = st.map(l => { const c = cs && cs.find(q => q.k === l.k), dv = cs ? l.v - (c ? c.v : 0) : 0;
      const dtx = cs && Math.abs(dv) > 1e-6 ? ` <em style="color:${dv > 0 ? 'var(--ok)' : '#ff7a7a'}">${(dv > 0 ? '+' : '') + fmt(Math.round(dv))}</em>` : '';
      return `<div class="stat"><span>${esc(l.n)}</span><b>${lineTxt(l)}${dtx}</b></div>`; }).join('');
    const can = L.canEquip(s, it), why = s.level < it.lv ? 'Needs level ' + it.lv : !L.itemClassOk(s, it) ? 'For ' + C.CLASSES[it.c].n + 's' : '', full = L.bagN(s) >= L.invMax(s);
    return `<div class="it icard" style="--rc:${rarC(it.r)}"><div style="display:flex;gap:10px;align-items:center"><img src="${UI.itemIcon(it)}" style="width:68px;height:68px;border-radius:8px;box-shadow:0 0 14px ${rarC(it.r)}66"><div><h3 style="color:${rarC(it.r)}">${esc(L.itemName(it))}</h3>
      <div style="margin:3px 0">${rarChip(it.r)}</div><div class="m">${esc(L.SLOT_N[it.s])}${ty ? ' · ' + esc(ty.n) + (ty.ranged ? ' (ranged)' : '') : ''}${it.c ? ' · ' + C.CLASSES[it.c].n : ' · any class'} · Lv ${it.lv}${it.up ? ' · <span style="color:var(--gold)">+' + it.up + '</span>' : ''}</div></div></div>
      ${eq ? '<div class="m cmp" style="color:#7aff8a">You are wearing this</div>' : cur ? `<div class="m cmp">Compared with your ${esc(L.itemName(cur))}</div>` : '<div class="m cmp" style="color:var(--ok)">Your ' + esc(L.SLOT_N[it.s]).toLowerCase() + ' slot is empty: this is pure gain</div>'}
      ${rows}${ty ? `<div class="stat"><span>Swing speed ${ty.speed}x · Reach ${ty.range} · Area ${ty.aoe}x</span><b></b></div>` : ''}
      <div class="rowbig">${eq ? `<button class="c" data-a="unequip" data-x="${it.s}" ${full ? 'disabled' : ''}>Take off</button>` : `<button class="g" data-a="equip" data-x="${it.u}" ${can ? '' : 'disabled'}>Equip</button><button class="k" data-a="store" data-x="${it.u}" data-y="${it.st ? 0 : 1}">${it.st ? 'Take out' : 'Store'}</button><button class="k" data-a="sell" data-x="${it.u}">Sell · ${fmt(L.itemValue(it))} ${ico('coin')}</button>`}</div>
      ${eq && full ? '<div class="m bagfull">Your bag is full: sell something to take this off</div>' : why ? `<div class="m warn">${esc(why)}</div>` : ''}
      <div class="row">${near.forge ? (it.up < C.GEAR.UPGRADE_MAX ? `<button class="c" data-a="upg" data-x="${it.u}" ${s.gold >= L.upgradeCost(it) ? '' : 'disabled'}>Upgrade +${it.up + 1} · ${fmt(L.upgradeCost(it))}</button>` : '<span class="tag">MAX +10</span>') : ''}</div></div>`;
  }
  const bagBtn = (s, it, ups) => `<button class="bi r${it.r}${UI.gearSel === it.u ? ' on' : ''}${L.canEquip(s, it) ? '' : ' no'}${it.nw ? ' nw' : ''}" data-a="gsel" data-x="${it.u}" style="--rc:${rarC(it.r)}" title="${esc(L.itemName(it))} · ${C.GEAR_RARITY[it.r].n}"><img src="${UI.itemIcon(it)}"><span class="rn"></span><b class="lv${s.level < it.lv ? ' no' : ''}">Lv ${it.lv}</b>${it.up ? `<i>+${it.up}</i>` : ''}${ups.includes(it.u) ? '<em>▲</em>' : ''}</button>`;
  R.gear = s => {
    const tab = UI.gearTab || 'all', sort = UI.gearSort || 'best', ups = upgrades(s).map(it => it.u), near = { forge: A().nearSt('smith') };
    const stash = UI.gearView === 'stash', bag = s.inv.filter(it => !L.isEquipped(s, it.u) && !it.st === !stash), max = stash ? C.GEAR.STASH_MAX : L.invMax(s);
    if (UI.gearSel && !L.item(s, UI.gearSel)) UI.gearSel = null;
    if (!UI.gearSel) UI.gearSel = (bag.find(it => it.nw) || bag.slice().sort((a, b) => score(b) - score(a))[0] || {}).u || s.eq.w || null;
    const sel = UI.gearSel && L.item(s, UI.gearSel), prev = sel && !L.isEquipped(s, sel.u) && L.canEquip(s, sel) ? sel : null;
    const slot = sl => { const it = L.eqItem(s, sl); return `<button class="eqs${it && UI.gearSel === it.u ? ' on' : ''}${sel && sel.s === sl && !L.isEquipped(s, sel.u) ? ' tgt' : ''}" ${it ? `data-a="gsel" data-x="${it.u}"` : `data-a="gtab" data-x="${sl}"`} style="--rc:${it ? rarC(it.r) : '#3a3060'}" title="${it ? esc(L.itemName(it)) : 'Empty: equip something from your bag'}">${it ? `<img src="${UI.itemIcon(it)}">` : `<div class="empty">empty</div>`}<span>${esc(L.SLOT_N[sl])}${it ? ' · Lv ' + it.lv : ''}</span></button>`; };
    const sorter = { best: (a, b) => (b.nw ? 1 : 0) - (a.nw ? 1 : 0) || score(b) - score(a), rarity: (a, b) => b.r - a.r || b.lv - a.lv, newest: (a, b) => b.u - a.u }[sort] || ((a, b) => b.u - a.u);
    const items = bag.filter(it => tab === 'all' || it.s === tab).sort(sorter), nNew = bag.filter(it => it.nw).length;
    const TABS = [['all', 'All'], ['w', 'Weapons'], ['h', 'Helmets'], ['a', 'Armour'], ['g', 'Gloves'], ['b', 'Boots'], ['r', 'Rings']];
    const totW = C.GEAR_RARITY.reduce((a, r) => a + r.w, 0);
    const qe = (s.spells[s.cls] || []).slice(0, C.SPELL_SLOTS).map((id, k) => { const sp = id && L.spell(id); return `<button class="qe" data-a="invview" data-x="skills" title="${sp ? esc(sp.n) : 'empty'}">${sp ? `<b style="color:${sp.col || '#fff'}">${esc(sp.n)}</b>` : '<b>—</b>'}<kbd>${['Q', 'E'][k]}</kbd></button>`; }).join('');
    const side = `<div class="vtabs">${[['gear', 'Gear'], ['skills', 'Skills'], ['stash', 'Storage']].map(([k, n]) => `<button class="${(UI.gearView || 'gear') === k ? 'on' : ''}" data-a="invview" data-x="${k}">${n}</button>`).join('')}</div>`;
    // Update 7 (after feedback): laid out like reference photo 4: grey side tabs, a dark silhouette with the worn gear on it, Q / E under it,
    // a grid of square slots with rarity-coloured frames and the bag count; the picked item's card and your totals below the grid
    const sq = sl => { const it = L.eqItem(s, sl); return `<button class="sq8${it && UI.gearSel === it.u ? ' on' : ''}${sel && sel.s === sl && !L.isEquipped(s, sel.u) ? ' tgt' : ''}" ${it ? `data-a="gsel" data-x="${it.u}"` : `data-a="gtab" data-x="${sl}"`} style="--rc:${it ? rarC(it.r) : '#555'}" title="${it ? esc(L.itemName(it)) + ' · Lv ' + it.lv : L.SLOT_N[sl] + ': empty'}">${it ? `<img src="${UI.itemIcon(it)}">` : ''}</button>`; };
    const vt = `<div class="vt8">${[['gear', 'Gear'], ['skills', 'Skills'], ['stash', 'Storage']].map(([k, n]) => `<button class="${(UI.gearView || 'gear') === k ? 'on' : ''}" data-a="invview" data-x="${k}">${n}</button>`).join('')}</div>`;
    const ab = (s.spells[s.cls] || []).slice(0, C.SPELL_SLOTS).map((id, k) => { const sp = id && L.spell(id); return `<div class="ab8"><kbd>${['Q', 'E'][k]}</kbd><button class="sq8 sp8" data-a="invview" data-x="skills" style="--rc:${sp ? sp.col || '#7a7a7a' : '#555'}" title="${sp ? esc(sp.n) : 'empty'}">${sp ? `<i>${esc(sp.n.split(' ').map(w => w[0]).join('').slice(0, 2))}</i>` : ''}</button></div>`; }).join('');
    return `<div class="inv8">${vt}
      <div class="doll8"><div class="sil8"><div class="hd8">${sq('h')}</div><div class="am8 l"></div><div class="to8">${sq('a')}</div><div class="am8 r"></div>
        <div class="hn8 l">${sq('w')}</div><div class="hn8 r">${sq('g')}</div><div class="lg8 l"></div><div class="lg8 r"></div><div class="ft8">${sq('b')}</div><div class="rg8">${sq('r')}</div></div>
        <div class="abr8">${ab}</div></div>
      <div class="grid8"><div class="top8"><div class="tabs8">${TABS.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="gtab" data-x="${k}">${n}</button>`).join('')}<button data-a="gsort" data-x="${{ best: 'rarity', rarity: 'newest', newest: 'best' }[sort] || 'best'}">Sort: ${{ best: 'Best', rarity: 'Rarity', newest: 'Newest' }[sort] || 'Best'}</button>${nNew ? `<button data-a="seenall">${nNew} new ✓</button>` : ''}</div>
          <div class="bagcount"><b class="${bag.length >= max ? 'bagfull' : ''}">${bag.length}/${max}</b></div></div>
        <div class="bag bag8">${items.map(it => bagBtn(s, it, ups)).join('') || `<div class="note" style="grid-column:1/-1">${bag.length ? 'Nothing in this tab.' : stash ? 'Storage is empty. Pick an item in your bag and press Store.' : 'Your bag is empty. Beat a dungeon\'s final boss: it drops ' + C.DROPS.BOSS_ITEMS + ' random items.'}</div>`}${Array.from({ length: Math.max(0, 28 - items.length) }, () => '<span class="bi8 emp"></span>').join('')}</div>
        <div class="info8">${sel ? itemCard(s, sel, near) : '<div class="note">Pick an item to see it.</div>'}</div>
        <details class="more8"><summary>Totals and bag tools</summary>${statSum(s, prev)}
          <div class="row" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button data-a="sellc">Sell all Common</button>${[0, 1].map(r => `<button class="${s.autoSell[r] ? 'on' : ''}" data-a="autosell" data-x="${r}">Auto-sell ${C.GEAR_RARITY[r].n}</button>`).join('')}<button data-a="showArmor">Show armour: ${s.showArmor ? 'ON' : 'off'}</button></div></details></div></div>`;
  };
  // a card that pops up when you pick up gear in a dungeon: what it is and how it compares with what you wear
  UI.lootCard = function (it) {
    const s = A().s, feed = $('#lootfeed'); if (!feed || !s) return;
    const cur = L.eqItem(s, it.s), better = !cur || L.itemScore(it) > L.itemScore(cur) * 1.02, mine = L.itemClassOk(s, it), lvOk = s.level >= it.lv;
    const main = L.itemLines(it).filter(l => !l.pct)[0], cm = cur && main ? L.itemLines(cur).find(l => l.k === main.k && !l.pct) : null, dv = main ? main.v - (cm ? cm.v : 0) : 0;
    const d = document.createElement('div'); d.className = 'lc'; d.style.setProperty('--rc', rarC(it.r));
    d.innerHTML = `<img src="${UI.itemIcon(it)}"><div><b style="color:${rarC(it.r)}">${esc(L.itemName(it))}</b><span class="m">${C.GEAR_RARITY[it.r].n} ${esc(L.SLOT_N[it.s])} · Lv ${it.lv}${it.c ? ' · ' + C.CLASSES[it.c].n : ''}</span>
      <span class="m">${main ? esc(main.n) + ' ' + fmt(Math.round(main.v)) + (mine && cur ? ` <em style="color:${dv >= 0 ? 'var(--ok)' : '#ff7a7a'}">${dv >= 0 ? '▲' : '▼'}${fmt(Math.abs(Math.round(dv)))}</em>` : '') : ''}</span>
      ${!mine ? '<span class="m" style="color:#ff9a7a">for ' + C.CLASSES[it.c].n + 's</span>' : !lvOk ? '<span class="m" style="color:#ffcf8a">needs level ' + it.lv + '</span>' : better ? '<span class="m" style="color:var(--ok)">▲ upgrade · equip it in your inventory (I)</span>' : ''}</div>`;
    feed.appendChild(d); while (feed.children.length > 4) feed.removeChild(feed.firstChild);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, it.r >= 4 ? 7000 : 4500);
    if (it.r >= 4) UI.flash(rarC(it.r));
  };
  // ---------- character ----------
  R.char = s => {
    const pts = L.statPoints(s), cls = C.CLASSES[s.cls], main = cls.stat, ctx = A().ctx();
    const stat = (k, n, d) => `<div class="qrow"><div class="q"><b>${n}${k === main ? ' <span class="tag" style="background:#5a4a2a;color:var(--gold2)">your class stat</span>' : ''}</b><div class="m" style="color:var(--mut)">${d}</div></div><b style="font-size:20px;min-width:40px;text-align:center">${s.stats[k]}</b>
      <button class="g" data-a="stat" data-x="${k}:1" ${pts ? '' : 'disabled'}>+1</button><button class="g" data-a="stat" data-x="${k}:5" ${pts >= 5 ? '' : 'disabled'}>+5</button><button class="k" data-a="stat" data-x="${k}:all" ${pts ? '' : 'disabled'}>All</button></div>`;
    return `<div class="char6"><div id="pv" class="sm"><span class="hint">drag to turn · click to swing</span></div><div class="hero6"><small>${s.title ? esc(L.titleName(s.title)) : 'Slayer of Duskhold'}</small><h3>${esc(A().myName || '')}</h3><div class="m">Level ${s.level} ${cls.n}${s.level < C.MAX_LEVEL ? ' · ' + fmt(s.xp) + ' / ' + fmt(L.xpNeed(s.level)) + ' XP' : ' · max level'}</div><div class="pb" style="margin:8px 0 10px"><i style="width:${s.level < C.MAX_LEVEL ? Math.min(100, s.xp / L.xpNeed(s.level) * 100) : 100}%"></i></div>
      <div class="pow6"><div><span>Power</span><b>${fmt(L.power(s))}</b></div><div><span>Health</span><b>${fmt(L.maxHp(s))}</b></div><div><span>Weapon swing</span><b>${fmt(L.ap(s))}</b></div></div>
      <div class="row" style="margin-top:10px"><button class="p" data-a="swapCls" ${A().getRun() ? 'disabled' : ''}>Swap class · become a ${s.cls === 'mage' ? 'Warrior' : 'Mage'}</button></div></div></div>

      <div class="sec">Stat points: ${pts}</div>
      ${stat('pow', 'Strength', '+' + (C.STAT_POWER * 100).toFixed(1) + '% damage each (weapon swings and abilities) · the Warrior class stat')}${stat('spl', 'Spell Power', '+' + (C.STAT_POWER * 100).toFixed(1) + '% damage each (weapon swings and abilities) · the Mage class stat')}${stat('vit', 'Vitality', '+' + +(C.STAT_VIT * 100).toFixed(2) + '% health each · everyone')}
      <div class="note">You get ${C.STAT_PER_LEVEL} points every level. Only your class stat raises damage, so ${cls.n}s should put most points into ${main === 'pow' ? 'Strength' : 'Spell Power'}. Resetting is free in town.</div>
      <div class="row" style="margin:8px 0"><button class="k" data-a="resetStats">Reset points</button></div>
      <div class="sec">Your power</div><div class="kv"><span>Power</span><b>${fmt(L.power(s))} · every piece of gear you wear, x your ${main === 'pow' ? 'Strength' : 'Spell Power'}</b><span>Abilities</span><b>hit with all of your Power</b>
        <span>Weapon swing</span><b>${fmt(L.ap(s))} · a third of the old swing: abilities do the real damage</b><span>Max health</span><b>${fmt(L.maxHp(s))} · from your level and Vitality</b><span>Critical hits</span><b>${(L.crit(s) * 100).toFixed(0)}% chance · ${Math.round(L.critMult(s) * 100)}% damage</b>
        <span>Loot luck</span><b>${L.luck(s, ctx).toFixed(2)}x</b></div>`;
  };
  // ---------- spells ----------
  // ---------- abilities ----------
  R.spells = s => R.abilities(s);
  R.abilities = s => {
    const list = s.spells[s.cls] || ['', ''], sel = UI.spSel, app = A(), inRun = !!app.getRun(), gp = L.power(s), keys = ['s1', 's2'].map(k => app.keyName((app.BIND || C.KEYS)[k]));
    // Update 7 (final): every damage ability hits each slime for (its total) x your Power per cast, and every dungeon's abilities are 10% stronger than the last
    const card = sp => { const ok = L.spellOk(s, sp), on = list.includes(sp.id), many = sp.ticks || sp.count || sp.strikes || (sp.every ? Math.round(sp.dur / sp.every) : 0);
      const dmg = sp.tot ? fmt(sp.tot * gp) : '', how = sp.tot ? (many ? ' over ' + many + ' hits' : sp.jumps ? ' · jumps ' + sp.jumps + ' times' : '') + (sp.role === 'st' ? ' · +' + Math.round((C.ABIL.ST_BOSS - 1) * 100) + '% vs bosses' : '') : '';
      return `<div class="ab${ok ? '' : ' lock'}${on ? ' on' : ''}${sel === sp.id ? ' sel' : ''}" style="--sc:${sp.col}"><img src="${UI.spellImg(sp.id)}"><h3>${esc(sp.n)}</h3><div class="m">${esc(sp.d)}</div>
        <div class="tagz"><span>${L.spellCd(s, sp).toFixed(1)}s</span>${dmg ? `<span title="${Math.round(sp.tot * 100)}% of your Power to each slime it reaches, every cast">${dmg} dmg${how}</span>` : sp.k === 'heal' ? '<span style="color:#7aff9a">heals your party</span>' : '<span>utility</span>'}${ok ? (on ? '<span style="color:#7aff8a;border-color:#2e7a3a">On your bar</span>' : `<button class="g" data-a="spAuto" data-x="${sp.id}" ${inRun ? 'disabled' : ''}>Equip</button><button class="k" data-a="spSel" data-x="${sp.id}" ${inRun ? 'disabled' : ''}>Pick Q / E</button>`) : `<span class="how">${ico('lock')} ${esc(L.spellHow(sp))}</span>`}</div></div>`; };
    const mine = C.SPELLS.filter(sp => sp.cls === s.cls), nOk = mine.filter(sp => L.spellOk(s, sp)).length;
    const tiers = C.DUNGEONS.map((d, t) => { const sps = mine.filter(sp => sp.t === t); if (!sps.length) return ''; const open = s.level >= L.dunLevel(t, 0);
      return `<div class="abt${open ? '' : ' lock'}" style="--dc:${d.col}"><div class="abth"><b>${esc(d.n)}</b><span>${open ? 'unlocked' : 'level ' + L.dunLevel(t, 0)} · tier ${t + 1} · ${fmt(C.ABIL.BASE * Math.pow(C.ABIL.TIER, t) * gp)} damage per ability</span></div><div class="abg">${sps.map(card).join('')}</div></div>`; }).join('');
    return `<div class="sec">Your abilities · keys ${keys.join(' and ')}</div><div class="spbar two">${[0, 1].map(i => { const sp = list[i] && L.spell(list[i]); return `<button class="sps${sel ? ' pick' : ''}" style="--sc:${sp ? sp.col : '#4a3c6a'}" data-a="spSlot" data-x="${i}" ${inRun ? 'disabled' : ''}>${sp ? `<img src="${UI.spellImg(sp.id)}"><b>${esc(sp.n)}</b>` : '<b class="m" style="padding:18px 0">empty</b>'}<kbd>${esc(keys[i])}</kbd></button>`; }).join('')}</div>
      <div class="note" style="margin:6px 0 4px">${inRun ? 'Change abilities in town.' : sel ? 'Now click Q or E above for ' + esc(L.spell(sel).n) + '.' : 'Press Equip, or Pick Q / E and click a slot above. Click a slot on its own to empty it.'} Abilities hit with your <b>Power</b> (${fmt(gp)}: every piece of gear you wear, x your class stat points), and every dungeon's abilities are 10% stronger than the dungeon before.</div>
      <div class="sec">${C.CLASSES[s.cls].n} abilities · ${nOk} / ${mine.length} unlocked · new ones in every dungeon</div>${tiers}`;
  };
  // ---------- the Blacksmith (Update 7 final): pick a piece of gear, see what the next upgrade costs and what it will have when maxed; upgrade it once,
  // 10 times, or spend all your gold on your worn gear (cheapest upgrade first). Salvage turns gear into dust for the Shop's chests.
  const bsSorts = { worn: 'Worn first', power: 'Power', rarity: 'Rarity', level: 'Level' };
  R.forge = s => {
    const near = A().nearSt('smith'), tab = UI.fTab || 'upg', head = (near ? '' : notHere('smith', 'upgrade, salvage and buy gear')) + tabBar('ftab', tab, [['upg', 'Upgrade'], ['salv', 'Salvage · ' + fmt(s.dust || 0) + ' dust'], ['shop', 'Buy gear']]);
    if (tab === 'salv') return head + R.salvage(s, near);
    if (tab === 'shop') { const shop = C.DUNGEONS.map((d, i) => d.secret || !L.dunUnlocked(s, i) ? '' : `<div class="trow"><b style="flex:1;color:${d.col}">${esc(C.GEAR_TIERS[i].p)} gear <span class="m">· Lv ${d.lvl} · Common</span></b>${['w', 'h', 'a', 'g', 'b'].map(sl => `<button class="k" data-a="buyGear" data-x="${i}:${sl}" ${near && s.gold >= L.shopPrice(i) ? '' : 'disabled'}>${esc(L.KIND_N[L.kindFor(s.cls, sl)])} · ${fmt(L.shopPrice(i))}</button>`).join('')}</div>`).join('');
      return head + `<div class="note" style="margin-bottom:6px">Common gear for every dungeon you can enter. Bosses drop much better gear (Uncommon to Ultimate).</div>${shop}`; }
    const sort = bsSorts[UI.bsSort] ? UI.bsSort : 'worn', mode = UI.bsMode || '1', MX = C.GEAR.UPGRADE_MAX, fp = v => v < 100 ? String(Math.round(v * 10) / 10) : fmt(v);
    const items = s.inv.slice().sort(sort === 'power' ? (a, b) => L.itemPow(b) - L.itemPow(a) : sort === 'rarity' ? (a, b) => b.r - a.r || L.itemPow(b) - L.itemPow(a) : sort === 'level' ? (a, b) => b.lv - a.lv || b.r - a.r
      : (a, b) => L.isEquipped(s, b.u) - L.isEquipped(s, a.u) || L.itemPow(b) - L.itemPow(a));
    if (!UI.bsSel || !L.item(s, UI.bsSel)) UI.bsSel = s.eq.w || (items[0] && items[0].u); const it = L.item(s, UI.bsSel);
    let left = '<div class="note">Pick a piece of gear on the right.</div>';
    if (it) { const n = mode === '10' ? 10 : 1, plan = L.upgradePlan(s, it, n), left2 = L.upgradeLeft(it), maxed = it.up >= MX, worn = L.wornPlan(s), uc = it.r < C.CRAFT.MAX_RARITY ? L.craftCost(s, 'rarity', it) : null;
      const price = mode === 'all' ? worn.gold : plan.gold, can = mode === 'all' ? worn.n > 0 : plan.n > 0;
      left = `<div class="bs-card" style="--rc:${rarC(it.r)}"><div class="bs-top"><div class="bs-img"><img src="${UI.itemIcon(it)}"></div><div class="bs-price"><span>Price:</span><b>${mode === 'all' ? (worn.n ? fmt(price) : '—') : maxed ? 'MAX' : fmt(price || L.upgradeCost(it))}</b></div></div>
        <div class="bs-name" style="color:${rarC(it.r)}">${esc(L.itemName(it))}</div><div class="bs-ups">Upgrades: <b>${it.up}/${MX}</b></div>
        <div class="bs-pow"><span>Power</span><b>${fp(L.itemPow(it))}${!maxed && mode !== 'all' && plan.n ? ` <em>▲ ${fp(L.itemPowAt(it, it.up + plan.n))}</em>` : ''}</b></div>
        <button class="g big bs-go" data-a="bsUp" ${near && can && (mode === 'all' || !maxed) ? '' : 'disabled'}>${mode === 'all' ? (worn.n ? 'Spend all · ' + worn.n + ' upgrade' + (worn.n === 1 ? '' : 's') + ' on your worn gear' : 'Nothing you can afford') : maxed ? 'Fully upgraded' : 'Upgrade' + (plan.n > 1 ? ' x' + plan.n : '') + (plan.n ? '' : ' · not enough gold')}</button>
        ${uc ? `<button class="r bs-rar" data-a="uprarity" data-x="${it.u}" ${near && (s.dust || 0) >= uc.dust && s.gold >= uc.gold ? '' : 'disabled'}>Raise to <b style="color:${rarC(it.r + 1)}">${C.GEAR_RARITY[it.r + 1].n}</b> · ${uc.dust} dust + ${fmt(uc.gold)} gold</button>` : ''}</div>
        <div class="bs-modes"><button class="bs-tg${mode === '10' ? ' on' : ''}" data-a="bsMode" data-x="10"><i></i>Upgrade 10x</button><button class="bs-tg${mode === 'all' ? ' on' : ''}" data-a="bsMode" data-x="all"><i></i>Spend all</button></div>
        <div class="bs-info">${maxed ? 'This piece is fully upgraded.' : `<b class="coin">${fmt(left2)}</b> gold left to fully upgrade.`} It will have <b>${fp(L.itemPowAt(it, MX))}</b> Power when maxed (+${Math.round(C.GEAR.UPGRADE_STAT * 100)}% each upgrade).<br><span class="m">Spend all upgrades the gear you wear, cheapest first, until your gold runs out.</span></div>`; }
    const grid = items.map(q => `<button class="bi r${q.r}${q.u === UI.bsSel ? ' on' : ''}${L.isEquipped(s, q.u) ? ' eq' : ''}" data-a="bsSel" data-x="${q.u}" data-n="${esc(L.itemName(q).toLowerCase())}" style="--rc:${rarC(q.r)}" title="${esc(L.itemName(q))} · Power ${fmt(L.itemPow(q))}"><img src="${UI.itemIcon(q)}"><b class="lv">+${q.up}</b></button>`).join('');
    return head + `<div class="bs"><div class="bs-l">${left}</div><div class="bs-r"><div class="bs-bar"><input id="bsSearch" placeholder="Search..." value="${esc(UI.bsQ || '')}" autocomplete="off"><select id="bsSort">${Object.entries(bsSorts).map(([k, n]) => `<option value="${k}"${k === sort ? ' selected' : ''}>Sort: ${n}</option>`).join('')}</select></div>
      <div class="bag bs-grid">${grid || '<div class="note">No gear yet.</div>'}</div><div class="m" style="margin-top:6px">${fmt(s.gold)} gold · ${fmt(s.dust || 0)} dust</div></div></div>`;
  };
  // filtering the Blacksmith's grid as you type (without redrawing the panel, so the search box keeps focus)
  UI.bsBind = () => { const q = $('#bsSearch'), so = $('#bsSort'); if (!q) return; const f = () => { UI.bsQ = q.value; const v = q.value.trim().toLowerCase(); document.querySelectorAll('.bs-grid .bi').forEach(b => { b.style.display = !v || b.dataset.n.includes(v) ? '' : 'none'; }); };
    q.oninput = f; q.onkeydown = e => e.stopPropagation(); f(); if (so) so.onchange = () => { UI.bsSort = so.value; UI.render(); }; };
  R.salvage = (s, near) => {
    const sel = (UI.craftSel || (UI.craftSel = [])).filter(u => L.item(s, u)), CR = C.CRAFT; UI.craftSel = sel;
    const loose = s.inv.filter(it => !L.isEquipped(s, it.u) && it.raid === undefined).sort((a, b) => a.r - b.r || a.lv - b.lv), dust = sel.reduce((a, u) => a + (CR.SALVAGE[L.item(s, u).r] || 1), 0);
    return `<div class="note">Salvage gear you don't need into <b>dust</b>: open chests with it in the Shop, or raise an item's rarity here. Equipped and raid gear is never salvaged. Dust per item: ${CR.SALVAGE.slice(0, 6).map((d, r) => `<span style="color:${rarC(r)}">${d}</span>`).join(' / ')}</div>
      <div class="opts" style="margin:6px 0">${[0, 1, 2].map(r => `<button data-a="cselAll" data-x="${r}">All ${r ? C.GEAR_RARITY[r].n + ' and below' : C.GEAR_RARITY[0].n}</button>`).join('')}<button data-a="cselAll" data-x="-1">None</button></div>
      <div class="bag">${loose.map(q => `<button class="bi${sel.includes(q.u) ? ' on' : ''}" data-a="csel" data-x="${q.u}" style="--rc:${rarC(q.r)}" title="${esc(L.itemName(q))}"><img src="${UI.itemIcon(q)}"></button>`).join('') || '<div class="note">Your bag has nothing to salvage.</div>'}</div>
      <button class="r big" data-a="salvage" style="margin-top:8px" ${near && sel.length ? '' : 'disabled'}>Salvage ${sel.length} item${sel.length === 1 ? '' : 's'} · +${dust} dust</button>`;
  };
  // ---------- quests ----------
  const tabBar = (key, cur, list) => `<div class="boardtabs">${list.map(([k, n, al]) => `<button class="${cur === k ? 'r' : ''}${al ? ' alert' : ''}" data-a="${key}" data-x="${k}">${n}</button>`).join('')}</div>`;
  const passOf = s => s.pass && s.pass.season === C.PASS.SEASON ? s.pass : { xp: 0, claimed: [] }, passTierOf = s => Math.min(C.PASS.TIERS, Math.floor(passOf(s).xp / C.PASS.TIER_XP));
  UI.passUnclaimed = s => { const P = passOf(s), t = passTierOf(s); let n = 0; for (let k = 0; k < t; k++) if (!P.claimed.includes(k)) n++; return n; };
  R.quests = s => {
    const app = A(), now = app.now(), tab = ['pass', 'ms', 'gift'].includes(UI.qTab) ? UI.qTab : 'pass', un = UI.passUnclaimed(s);
    const head = tabBar('qtab', tab, [['pass', 'Battle Pass' + (un ? ' (' + un + ')' : ''), un], ['ms', 'Milestones'], ['gift', 'Daily gift' + (L.giftReady(s, now) ? ' (1)' : ''), L.giftReady(s, now)]]);
    if (tab === 'pass') { const P = passOf(s), t = passTierOf(s), into = P.xp - t * C.PASS.TIER_XP;
      return head + `<div class="passhd"><div><b style="color:#ffd84a">${esc(C.PASS.SEASON)}</b><div class="m">Free for everyone. Earn XP from every run (${Object.entries(C.PASS.RUN_XP).map(([k, v]) => k + ' ' + v).join(' · ')}).</div></div>
        <div class="ptier"><span>TIER</span><b>${t}</b><span>/ ${C.PASS.TIERS}</span></div></div>${t < C.PASS.TIERS ? `<div class="pb" style="margin:6px 0 10px"><i style="width:${into / C.PASS.TIER_XP * 100}%"></i></div><div class="m" style="margin-bottom:8px">${fmt(into)} / ${fmt(C.PASS.TIER_XP)} XP to tier ${t + 1}</div>` : '<div class="note">Season complete!</div>'}
        ${un ? `<button class="g" data-a="passAll" style="margin-bottom:8px">Claim all (${un})</button>` : ''}<div class="pass">${C.PASS.REWARDS.map((rw, k) => { const got = P.claimed.includes(k), open = k < t, big = rw[0] === 'cosm' || rw[0] === 'title';
          const col = rw[0] === 'gold' ? 'var(--coin)' : rw[0] === 'dust' ? '#c8b8ff' : rw[0] === 'cosm' ? C.PASS_COSM[rw[1]].v : '#ffd84a';
          return `<div class="pt${got ? ' got' : open ? ' open' : ''}${big ? ' big' : ''}" style="--pc:${col}"><small>${k + 1}</small><b>${esc(L.passReward(s, k))}</b>${got ? '<span>✓</span>' : open ? `<button class="g" data-a="pass" data-x="${k}">Claim</button>` : `<span>${ico('lock')}</span>`}</div>`; }).join('')}</div>`; }
    if (tab === 'ms') return head + `<div class="grid">${C.MILESTONES.map(m => { const got = s.ms[m.id], v = L.statVal(s, m.stat); return `<div class="it${got ? ' sel' : ''}"><h3>${esc(m.n)}</h3><div class="stat"><span>${got ? 'Complete' : fmt(Math.min(v, m.need)) + ' / ' + fmt(m.need)}</span><b>+${fmt(L.clears(s, m.gold))} ${ico('coin')}</b></div><div class="pb"><i style="width:${Math.min(1, v / m.need) * 100}%"></i></div></div>`; }).join('')}</div>`;
    const gr = L.giftReady(s, now), k = Math.min(L.bestStep(s.level), L.NSTEP - 1), gi = Math.min(L.ND - 1, Math.floor(k / 3)), gdf = k - gi * 3;
    return head + `<div class="note" style="margin-bottom:8px">Every day the Daily Gift chest in Duskhold gives you <b>${C.GIFT.ITEMS} random pieces of gear</b> from the hardest dungeon your level can enter: right now <b style="color:${C.DUNGEONS[gi].col}">${esc(C.DUNGEONS[gi].n)} · ${C.DIFFS[gdf].n}</b> (level ${Math.min(s.level, L.dunLevel(gi, gdf))}).</div>
      <div class="sec">Daily gift &amp; streak</div><div class="qrow"><div class="q"><b>Login streak: ${s.daily.streak} day${s.daily.streak === 1 ? '' : 's'}</b><div class="m" style="color:var(--mut)">+${Math.round(L.streakLuck(s) * 100)}% luck · come back tomorrow for ${fmt(L.clears(s, C.STREAK_GOLD[Math.min(s.daily.streak, C.STREAK_GOLD.length - 1)]))} gold</div></div>
      ${gr ? (app.nearSt('gift') ? '<button class="r" data-a="gift">Open gift</button>' : '<span class="m">Gift ready at the Daily Gift chest</span>') : '<span class="tag">Gift opened · back tomorrow</span>'}</div>`;
  };
  R.gift = s => { const r = UI.giftRes; if (!r || !r.items) { UI.qTab = 'gift'; return R.quests(s); }
    return `<div class="credits"><h3 class="gold">Daily Gift</h3><p class="m">${C.GIFT.ITEMS} pieces of gear from ${esc(C.DUNGEONS[r.i] ? C.DUNGEONS[r.i].n : '')} · ${C.DIFFS[r.df] ? C.DIFFS[r.df].n : ''}</p></div>
      <div class="giftg">${r.items.map(it => `<div class="it" style="--rc:${rarC(it.r)}"><img src="${UI.itemIcon(it)}" style="width:56px;height:56px;border-radius:8px;box-shadow:0 0 12px ${rarC(it.r)}66"><b style="color:${rarC(it.r)}">${esc(L.itemName(it))}</b><div class="m">${C.GEAR_RARITY[it.r].n} · Lv ${it.lv} · Power ${fmt(L.itemPow(it))}</div></div>`).join('')}</div>
      ${r.sold ? `<p class="note">Your bag was full: some were sold for ${fmt(r.sold)} gold.</p>` : ''}<div class="row" style="justify-content:center;margin-top:10px"><button class="g" data-a="openGear">Open Inventory</button></div><p class="note" style="text-align:center">Come back tomorrow for another.</p>`; };
  // ---------- profile ----------
  R.profile = s => {
    const recs = C.DUNGEONS.map((d, i) => { const r = s.dun[i]; if (!r || !(r.c[0] + r.c[1] + r.c[2])) return ''; return `<tr><td></td><td style="color:${d.col}">${esc(d.n)}</td><td>${r.c.map((n, k) => `<span style="color:${DIFF_C[k]}">${n}</span>`).join(' / ')}${r.hc ? ' · HC ' + r.hc : ''}${r.best[0] ? ' · best ' + Math.floor(r.best[0] / 60) + ':' + String(r.best[0] % 60).padStart(2, '0') : ''}</td></tr>`; }).join('');
    return `<div class="kv"><span>Class</span><b>${C.CLASSES[s.cls].n}</b><span>Level</span><b>${s.level}</b><span>Dungeons cleared</span><b>${fmt(s.clears)}</b><span>Nightmare clears</span><b>${fmt(s.nmClears)}</b><span>Hardcore clears</span><b>${fmt(s.hcClears)}</b><span>Bosses defeated</span><b>${fmt(s.bossKills)}</b><span>Slimes slain</span><b>${fmt(s.kills)}</b>
      <span>Best Pit wave</span><b>${s.pitBest}</b><span>Best Tower floor</span><b>${s.towerBest || 0}</b><span>Duels won</span><b>${fmt(s.duelWins || 0)} / ${fmt(s.duels || 0)}</b><span>Parries · perfect dodges</span><b>${fmt(s.parries || 0)} · ${fmt(s.pdodges || 0)}</b><span>Battle Pass</span><b>tier ${passTierOf(s)}</b><span>Legendary+ gear found</span><b>${s.lootLeg}</b><span>Relics</span><b>${s.relics.length} / 8</b><span>Deaths</span><b>${fmt(s.deaths)}</b><span>Time played</span><b>${Math.floor(s.time / 3600)}h ${Math.floor(s.time / 60) % 60}m</b><span>Gold earned</span><b>${fmt(s.goldTotal)}</b></div>
      ${recs ? `<div class="sec">Dungeon clears (Normal / Hard / Nightmare)</div><table class="lb">${recs}</table>` : ''}
      <div class="sec">Titles</div><div class="opts">${C.TITLES.map(t => { const ok = L.titleOk(s, t); return `<button class="${s.title === t.id ? 'on' : ''}" data-a="title" data-x="${t.id}" ${ok ? '' : 'disabled'}>${esc(t.n)}${ok ? '' : `<span class="lk">${esc(t.stat)} ${fmt(t.need)}</span>`}</button>`; }).join('')}</div>
      <div class="sec">Bestiary · ${C.DUNGEONS.filter((d, i) => L.bestiaryDone(s, i)).length} / ${C.DUNGEONS.length} pages complete</div>${C.DUNGEONS.map((d, i) => { const ids = L.bestiaryOf(i), seen = ids.filter(id => s.killsBy[id]).length, done = seen === ids.length, got = (s.bestClaim || []).includes(i);
        if (!seen && !L.dunUnlocked(s, i)) return ''; return `<div class="bpage" style="--dc:${d.col}"><div class="bph"><b>${esc(d.n)}</b><span class="m">${seen} / ${ids.length} creatures</span>${done ? got ? '<span class="tag">Claimed</span>' : `<button class="g" data-a="bclaim" data-x="${i}">Claim ${10 + i * 3} ${ico('gem')}</button>` : ''}</div>
        <div class="grid">${ids.map(id => { const m = C.MOBS[id], n = s.killsBy[id] || 0; return `<div class="it${n ? '' : ' lock'}"><h3 style="color:${n ? m.col : 'var(--mut)'};filter:brightness(1.6)">${n ? esc(m.n) : '???'}</h3><div class="stat"><span>${id === d.boss ? 'Boss' : id === d.elite ? 'Elite' : (d.minis || []).includes(id) ? 'Mini-boss' : 'Slime'}</span><b>${fmt(n)} slain</b></div></div>`; }).join('')}</div></div>`; }).join('')}`;
  };
  // ---------- leaderboards ----------
  R.board = s => { const b = A().board, tab = UI.boardTab || 'week', rows = b ? (b[tab] || []) : [], lab = { week: 'dungeon score this week (harder dungeons and difficulties score more)', all: 'level', arena: 'best Pit wave', tower: 'best Endless Tower floor', duel: 'duels won' };
    const me = A().myName;
    return `<div class="boardtabs">${[['week', 'This week'], ['all', 'All time'], ['arena', 'The Pit'], ['tower', 'The Tower'], ['duel', 'Duels']].map(([k, n]) => `<button class="${tab === k ? 'r' : ''}" data-a="btab" data-x="${k}">${n}</button>`).join('')}</div>
      ${!b ? '<div class="note">Leaderboards need the server (you are offline).</div>' : rows.length ? `<table class="lb">${rows.map((r, i) => `<tr class="${r[0] === me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r[0])}</td><td>${fmt(r[1])}</td></tr>`).join('')}</table><div class="note" style="margin-top:6px">${lab[tab]}${tab === 'week' ? ' · the top 10 win gold every Monday' : ''}</div>` : '<div class="note">No slayers yet. Be the first!</div>'}
      ${b && b.last && b.last.top && b.last.top.length ? `<div class="sec">Last week</div><div class="note">${b.last.top.slice(0, 3).map((r, i) => (i + 1) + '. ' + esc(r[0]) + ' (' + fmt(r[1]) + ')').join(' · ')}</div>` : ''}
      <div class="sec">Players online</div>${A().others.size ? [...A().others.values()].map(o => `<div class="trow"><b style="flex:1">${esc(o.n)}${o.g ? ' <span class="m">(guest)</span>' : ''}</b><span class="m">Lv ${o.lv || 1}${o.inst ? ' · in a dungeon' : ''}</span>${!o.g && A().mode === 'account' ? `<button data-a="trreq" data-x="${o.id}">${ico('swap')} Trade</button>` : ''}${A().online && !o.inst ? `<button class="r" data-a="duelreq" data-x="${o.id}">${ico('sword')} Duel</button>` : ''}</div>`).join('') : '<div class="note">Nobody else is online right now.</div>'}`; };
  // ---------- settings ----------
  R.settings = s => {
    const app = A(), S = app.settings;
    if (UI.arg === 'credits') return `<div class="credits"><h3 class="gold">SLIME SLAYERS</h3><p><b>Owners: Parker &amp; Wolfie</b></p><p>School project — remember to only play at home!</p><p class="note">Made with a custom WebGL engine. Every sound is synthesized. Fonts: Outfit &amp; Boldonse (SIL Open Font License).</p><button class="k" data-a="set" data-x="_:0">Back</button></div>`;
    const opt = (k, vals, labels) => `<div class="opts">${vals.map((v, i) => `<button class="${S[k] === v ? 'on' : ''}" data-a="set" data-x="${k}:${v}">${labels[i]}</button>`).join('')}</div>`;
    const onoff = k => opt(k, [true, false], ['On', 'Off']), sv = k => S[k] === undefined ? Object.assign({}, S, { [k]: true }) : S, o2 = (k, vals, labels) => `<div class="opts">${vals.map((v, i) => `<button class="${(S[k] === undefined ? vals[0] : S[k]) === v ? 'on' : ''}" data-a="set" data-x="${k}:${v}">${labels[i]}</button>`).join('')}</div>`;
    return `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="c" data-a="photo">Photo mode (O)</button>${app.s && app.s.tut === 'done' ? '' : '<button data-a="tutAgain">Show the tutorial</button>'}</div>
      ${tabBar('setTab', UI.setTab || 'gfx', [['gfx', 'Graphics'], ['snd', 'Sound'], ['play', 'Gameplay'], ['keys', 'Controls'], ['acc', 'Account']])}<div class="setg" data-tab="${UI.setTab || 'gfx'}"><section class="sg" data-g="gfx">
      <div class="sec">Graphics</div>${opt('quality', ['auto', 'low', 'med', 'high'], ['Auto', 'Low (school laptop)', 'Medium', 'High'])}
      <div class="note">Auto starts on Medium and steps down (or back up) to stay above 50 fps. The effects below only show on Medium and High.</div>
      <div class="kv"><span>Bloom (glow)</span>${o2('fxBloom', [true, false], ['On', 'Off'])}<span>Colour grading</span>${o2('fxGrade', [true, false], ['On', 'Off'])}<span>Vignette</span>${o2('fxVig', [true, false], ['On', 'Off'])}<span>Film grain</span>${o2('fxGrain', [true, false], ['On', 'Off'])}<span>Ambient occlusion (High)</span>${o2('fxAO', [true, false], ['On', 'Off'])}<span>Fog &amp; mist</span>${o2('fxFog', [true, false], ['On', 'Off'])}<span>Weather &amp; particles</span>${o2('weather', [true, false], ['On', 'Off'])}</div>
      <div class="sec">Accessibility</div><div class="kv"><span>Danger colours</span>${o2('cb', [false, true], ['Red / green', 'Colour-blind (orange / blue)'])}<span>Screen shake</span>${o2('shake', [true, 'low', false], ['Full', 'Low', 'Off'])}<span>Text size</span>${o2('textSize', ['normal', 'large', 'huge'], ['Normal', 'Large', 'Huge'])}</div>
      </section><section class="sg" data-g="snd"><div class="sec">Sound</div><div class="kv"><span>Effects</span>${opt('sfx', [0, 0.35, 0.7, 1], ['Off', 'Low', 'Med', 'High'])}<span>Music</span>${opt('music', [0, 0.2, 0.35, 0.6], ['Off', 'Low', 'Med', 'High'])}<span>Ambience</span>${opt('amb', [0, 0.3, 0.6, 1], ['Off', 'Low', 'Med', 'High'])}</div>
      </section><section class="sg" data-g="play"><div class="sec">Gameplay</div><div class="kv"><span>Camera sensitivity</span>${opt('sens', [0.6, 1, 1.5], ['Low', 'Normal', 'High'])}<span>Name tags</span>${opt('names', [true, false], ['On', 'Off'])}<span>Damage numbers</span>${opt('nums', [true, false], ['On', 'Off'])}<span>Party damage numbers</span>${opt('allNums', [true, false], ['On', 'Off'])}<span>Show FPS</span>${opt('fps', [true, false], ['On', 'Off'])}</div>
      </section><section class="sg" data-g="keys"><div class="sec">Controls</div><div class="note">Click a key, then press the new key (Esc cancels). Mouse: click to attack (hold to keep swinging) · drag to turn the camera · Shift locks the mouse. Controller: A jump · B dodge · X attack · Y interact · LB parry · LT/RT abilities · Start settings.</div>
      <div class="kv">${Object.keys(C.KEYS).map(k => `<span>${esc(C.KEY_N[k] || k)}</span><div><button class="k kb${UI.binding === k ? ' wait' : ''}" data-a="bind" data-x="${k}">${UI.binding === k ? 'press a key…' : esc((app.keyName || String)((app.BIND || C.KEYS)[k]))}</button></div>`).join('')}</div>
      <div class="row" style="margin:8px 0"><button class="k" data-a="resetKeys">Reset to default keys</button></div>
      </section><section class="sg" data-g="acc"><div class="sec">Account</div><div class="row" style="display:flex;gap:8px;flex-wrap:wrap">${app.mode === 'account' ? '<button class="r" data-a="logout">Log out</button>' : '<button class="r" data-a="reset">Delete guest save</button>'}<button data-a="menu">Main menu</button><button data-a="credits">Credits</button></div>
      </section></div>
      <div class="note" style="margin-top:12px">Owners: Parker &amp; Wolfie · School project — remember to only play at home!</div>`;
  };
  // ---------- trade ----------
  R.trade = s => {
    const app = A(), T = app.trade;
    if (!T) { const rq = app.tradeReq; return (rq ? `<div class="qrow"><div class="q"><b>${esc(rq.name)} wants to trade</b></div><button class="g" data-a="tracc" data-x="${rq.from}">Accept</button><button data-a="trdec" data-x="${rq.from}">Decline</button></div>` : '') +
      `<div class="note">${app.mode === 'account' ? 'Pick a player to send a trade request.' : 'Log in to trade (guests cannot trade).'}</div>` + [...app.others.values()].filter(o => !o.g).map(o => `<div class="trow"><b style="flex:1">${esc(o.n)}</b><span class="m">Lv ${o.lv || 1}</span>${app.mode === 'account' ? `<button data-a="trreq" data-x="${o.id}">Request</button>` : ''}</div>`).join(''); }
    const list = o => { const it = (o.itemData || []).map(q => `<span class="tag" style="color:${rarC(q.r)}">${esc(L.itemName(q))} · Lv ${q.lv}</span>`); return it.join(' ') || '<span class="m">nothing</span>'; };
    const left = T.go ? Math.max(0, Math.ceil((T.go - app.now()) / 1000)) : 0;
    const items = s.inv.filter(it => !L.isEquipped(s, it.u)).sort((a, b) => b.r - a.r).slice(0, 40);
    return `<div class="kv"><span>You give</span><div>${list(T.mine)}</div><span>${esc(T.with)} gives</span><div>${list(T.theirs)}</div></div>
      <div class="row" style="display:flex;gap:8px;margin:12px 0"><button class="${T.ready ? 'g' : 'r'}" data-a="trready">${T.ready ? 'Ready ✓ (click to undo)' : 'Ready'}</button><button data-a="trcancel">Cancel</button><span class="m">${T.theirReady ? esc(T.with) + ' is ready' : ''}${left ? ' · swapping in ' + left : ''}</span></div>
      <div class="sec">Your gear (click to add or remove)</div><div class="bag">${items.map(it => `<button class="bi${UI.tradeItems.includes(it.u) ? ' on' : ''}" data-a="tritem" data-x="${it.u}" style="--rc:${rarC(it.r)}" title="${esc(L.itemName(it))}"><img src="${UI.itemIcon(it)}"></button>`).join('') || '<span class="m">No spare gear</span>'}</div>`;
  };

  // ================================================================ AVATAR EDITOR (live 3D preview: the camera turns to face you)
  const AVT = [['chests', 'Chests'], ['coll', 'My skins'], ['body', 'Body'], ['face', 'Face'], ['hair', 'Hair'], ['clothes', 'Clothes'], ['gear', 'Colours'], ['slots', 'Saved']];
  function pushUndo() { const s = A().s; UI.avUndo = UI.avUndo || []; UI.avUndo.push(JSON.stringify(s.look)); if (UI.avUndo.length > 30) UI.avUndo.shift(); }
  function avSet(k, v) { pushUndo(); const lk = Object.assign({}, A().s.look); lk[k] = v === 'true' ? true : v === 'false' ? false : (k === 'height' || k === 'head') ? +v : v; A().setLook(lk); }
  function avUndo() { const u = UI.avUndo; if (!u || u.length < 2) return; u.pop(); A().setLook(JSON.parse(u[u.length - 1])); }
  function avRandom() { pushUndo(); const P = a => a[Math.floor(Math.random() * a.length)], s = A().s, LK = C.LOOK, out = Object.assign({}, s.look);
    Object.assign(out, { skin: P(LK.skin), hair: P(L.HAIR), hairC: P(LK.hairC), hairC2: P(LK.hairC), eye: P(LK.eye), eyeStyle: P(L.EYES), shirt: P(LK.cloth.slice(0, 14)), shirt2: P(LK.cloth), pants: P(LK.cloth.slice(0, 6)), shoes: P(LK.cloth.slice(0, 4)),
      pattern: P(L.PATTERNS), sleeve: P(['short', 'long', 'none']), gear1: P(LK.cloth), gear2: P(LK.cloth.slice(7)), glow: P(LK.glow), face: P(LK.faces), outfit: P(LK.outfits.filter(o => L.unlocked(s, o.need))).id, capeC: P(LK.cloth) });
    A().setLook(out); }
  const sw = (k, list, cur) => `<div class="swatches">${list.map(c => `<button class="sw${cur === c ? ' on' : ''}" style="background:${c}" data-a="lk" data-x="${k}|${c}" title="${c}"></button>`).join('')}</div>`;
  const opts = (k, list, cur, names, lockFn) => `<div class="opts">${list.map((v, i) => { const lk = lockFn && lockFn(v); return `<button class="${cur === v ? 'on' : ''}" data-a="lk" data-x="${k}|${v}" ${lk ? 'disabled' : ''}>${esc(names ? names[i] : v)}${lk ? `<span class="lk">${esc(lk)}</span>` : ''}</button>`; }).join('')}</div>`;
  // colours that only drop from Boss Raids
  const passSw = (s, kind, key, cur) => { const ids = Object.keys(C.PASS_COSM).filter(id => C.PASS_COSM[id].k === kind); if (!ids.length) return '';
    return `<div class="note" style="margin:8px 0 4px">Battle Pass ${kind === 'cape' ? 'cloak colours' : 'trails'}</div><div class="swatches">${ids.map(id => { const c = C.PASS_COSM[id], own = s.cosm.includes(id), t = C.PASS.REWARDS.findIndex(r => r[1] === id) + 1;
      return own ? `<button class="sw${cur === c.v ? ' on' : ''}" style="background:${c.v}" data-a="lk" data-x="${key}|${c.v}" title="${esc(c.n)}"></button>` : `<button class="sw" style="background:${c.v};opacity:.25" disabled title="${esc(c.n)} · Battle Pass tier ${t}"></button>`; }).join('')}</div>`; };
  const raidSw = (s, kind, key, cur) => { const list = C.RAIDS.map((r, k) => ({ r, k })).filter(q => q.r.cosm.k === kind); if (!list.length) return passSw(s, kind, key, cur);
    return `<div class="note" style="margin:8px 0 4px">Raid ${kind === 'cape' ? 'cloak colours' : 'trails'}</div><div class="swatches">${list.map(({ r, k }) => { const own = s.cosm.includes('raid' + k); return own ? `<button class="sw${cur === r.cosm.v ? ' on' : ''}" style="background:${r.cosm.v}" data-a="lk" data-x="${key}|${r.cosm.v}" title="${esc(r.cosm.n)}"></button>` : `<button class="sw" style="background:${r.cosm.v};opacity:.25" disabled title="${esc(r.cosm.n)} · drops from the ${esc(C.MOBS[C.DUNGEONS[k].boss].n)} raid"></button>`; }).join('')}</div>` + passSw(s, kind, key, cur); };
  const needTxt = n => n ? (n.stat === 'level' ? 'Level ' + n.v : n.stat === 'bossKills' ? n.v + ' boss kill' + (n.v > 1 ? 's' : '') : n.stat + ' ' + n.v) : '';
  R.avatar = s => {
    const lk = s.look, LK = C.LOOK, t = AVT.some(a => a[0] === UI.avTab) ? UI.avTab : (UI.avTab = 'chests'); let h = `<div class="avtabs">${AVT.map(([k, n]) => `<button class="${t === k ? 'on' : ''}" data-a="avtab" data-x="${k}">${n}</button>`).join('')}</div>`;
    // ---- Update 7 (final) · the Shop: chests paid with dust, and the skins you own (a skin only changes looks; your gear and its Power stay)
    const SH = C.SHOP, S = L.skinsOf(s), rc = r => SH.RAR[r].c;
    if (t === 'chests') { const tot = w => w.reduce((a, b) => a + b, 0);
      return h + `<div class="note" style="margin:6px 0 10px">You have <b style="color:#c8b8ff">${fmt(s.dust || 0)} dust</b>. Get more by salvaging gear at the Blacksmith. Every chest holds the same ${SH.COSM.length} skins; better chests have better odds. A skin you already own gives dust back.</div>
        <div class="chests">${SH.CHESTS.map(ch => `<div class="chest" style="--cc:${ch.col}"><div class="cbox"><i></i><b></b></div><h3>${esc(ch.n)}</h3><div class="odds">${ch.w.map((w, r) => w ? `<span style="color:${rc(r)}">${SH.RAR[r].n} ${(w / tot(ch.w) * 100).toFixed(w / tot(ch.w) < 0.01 ? 1 : 0)}%</span>` : '').join('')}</div>
          <button class="g big" data-a="chest" data-x="${ch.id}" ${(s.dust || 0) >= ch.cost && !UI.spinning ? '' : 'disabled'}>Open · ${ch.cost} dust</button></div>`).join('')}</div>
        <div id="reel" class="reel${UI.reelOn ? ' on' : ''}"><div class="rtrack"></div><i class="rmark"></i><div class="rres"></div></div>
        <div class="sec">Owned: ${S.own.length} / ${SH.COSM.length}</div>`; }
    if (t === 'coll') { const card = q => { const own = S.own.includes(q.id), on = S[q.k] === q.id;
        return `<div class="skc${own ? '' : ' no'}${on ? ' on' : ''}" style="--rc:${rc(q.r)}"><div class="skt">${q.k === 'armor' ? 'ARMOUR' : 'WEAPON'} · ${SH.RAR[q.r].n.toUpperCase()}</div><h3>${esc(q.n)}</h3><div class="m">${esc(q.d)}</div>
          ${own ? (on ? `<button class="k" data-a="skinOff" data-x="${q.k}">Take off</button>` : `<button class="g" data-a="skinOn" data-x="${q.id}">Wear</button>`) : '<span class="m">Not found yet</span>'}</div>`; };
      return h + `<div class="note" style="margin:6px 0 8px">Skins change how your armour or weapon looks. Your gear, its Power and your class stay exactly the same.</div>
        <div class="sec">Armour skins</div><div class="skg">${SH.COSM.filter(q => q.k === 'armor').map(card).join('')}</div><div class="sec">Weapon skins</div><div class="skg">${SH.COSM.filter(q => q.k === 'weapon').map(card).join('')}</div>`; }
    if (t === 'body') h += `<div class="sec">Skin</div>${sw('skin', LK.skin, lk.skin)}<div class="sec">Build</div>${opts('shape', ['slim', 'regular', 'chunky'], lk.shape, ['Slim', 'Regular', 'Chunky'])}
      <div class="sec">Height</div>${opts('height', [0.92, 1, 1.08], lk.height, ['Short', 'Normal', 'Tall'])}<div class="sec">Head size</div>${opts('head', [0.92, 1, 1.1], lk.head, ['Small', 'Normal', 'Big'])}`;
    if (t === 'face') h += `<div class="sec">Expression</div>${opts('face', LK.faces, lk.face, LK.faces.map(f => f[0].toUpperCase() + f.slice(1)))}<div class="sec">Eyes</div>${opts('eyeStyle', L.EYES, lk.eyeStyle, L.EYES.map(f => f[0].toUpperCase() + f.slice(1)))}
      <div class="sec">Eye colour</div>${sw('eye', LK.eye, lk.eye)}<div class="sec">Face mask</div>${opts('mask', ['', '#16161c', '#5a1018', '#2a2d36'], lk.mask, ['None', 'Black', 'Blood red', 'Steel'])}<div class="sec">Freckles</div>${opts('freckles', [false, true], lk.freckles, ['Off', 'On'])}`;
    if (t === 'hair') h += `<div class="sec">Style</div>${opts('hair', L.HAIR, lk.hair, L.HAIR.map(f => f[0].toUpperCase() + f.slice(1)))}<div class="sec">Colour</div>${sw('hairC', LK.hairC, lk.hairC)}<div class="sec">Tips / streak</div>${sw('hairC2', LK.hairC, lk.hairC2)}`;
    if (t === 'clothes') h += `<div class="sec">Outfit</div>${opts('outfit', LK.outfits.map(o => o.id), lk.outfit, LK.outfits.map(o => o.n), v => { const o = LK.outfits.find(x => x.id === v); return L.unlocked(s, o.need) ? '' : needTxt(o.need); })}
      <div class="sec">Shirt</div>${sw('shirt', LK.cloth, lk.shirt)}<div class="sec">Shirt detail</div>${sw('shirt2', LK.cloth, lk.shirt2)}<div class="sec">Pattern</div>${opts('pattern', L.PATTERNS, lk.pattern, L.PATTERNS.map(f => f[0].toUpperCase() + f.slice(1)))}
      <div class="sec">Sleeves</div>${opts('sleeve', ['short', 'long', 'none'], lk.sleeve, ['Short', 'Long', 'None'])}<div class="sec">Pants</div>${sw('pants', LK.cloth, lk.pants)}${opts('shorts', [false, true], lk.shorts, ['Trousers', 'Shorts'])}<div class="sec">Boots</div>${sw('shoes', LK.cloth, lk.shoes)}`;
    if (t === 'gear') h += `<div class="sec">Armour / gear colour</div>${sw('gear1', LK.cloth, lk.gear1)}<div class="sec">Trim colour</div>${sw('gear2', LK.cloth, lk.gear2)}<div class="sec">Magic glow</div>${sw('glow', LK.glow, lk.glow)}
      <div class="sec">Cloak</div>${opts('cape', LK.capes.map(c => c.id), lk.cape, LK.capes.map(c => c.n), v => { const o = LK.capes.find(x => x.id === v); return L.unlocked(s, o.need) ? '' : needTxt(o.need); })}${lk.cape ? sw('capeC', LK.cloth, lk.capeC) + raidSw(s, 'cape', 'capeC', lk.capeC) : ''}<div class="sec">Weapon trail</div>${sw('trail', LK.trails, lk.trail)}${raidSw(s, 'trail', 'trail', lk.trail)}`;
    if (t === 'slots') h += `<div class="sec">Saved outfits</div>${[0, 1, 2].map(i => `<div class="qrow"><div class="q"><b>Slot ${i + 1}</b> <span class="m">${s.outfits[i] ? esc((C.LOOK.outfits.find(o => o.id === s.outfits[i].outfit) || {}).n || '') + ' · ' + esc(s.outfits[i].hair) : 'empty'}</span></div><button class="g" data-a="lkl" data-x="${i}" ${s.outfits[i] ? '' : 'disabled'}>Wear</button><button data-a="lks" data-x="${i}">Save here</button></div>`).join('')}`;
    h += `<div class="row" style="display:flex;gap:8px;margin-top:14px"><button data-a="lkr">Randomise</button><button data-a="lku" ${UI.avUndo && UI.avUndo.length > 1 ? '' : 'disabled'}>Undo</button><span class="note" style="align-self:center">Changes save automatically.</span></div>
      <div class="sec">Emotes</div><div class="opts">${C.EMOTE_IDS.map(e => `<button data-a="emote" data-x="${e}">${e === 'sitE' ? 'sit' : e}</button>`).join('')}</div>`;
    return h;
  };

  // the chest opening: a reel of skins (odds of that chest) spins and stops on the one the rules picked
  UI.chestRes = r => { const SH = C.SHOP, ch = SH.CHESTS.find(q => q.id === r.chest) || SH.CHESTS[0], tot = ch.w.reduce((a, b) => a + b, 0), win = L.cosm(r.id);
    const roll = () => { let x = Math.random() * tot, k = 0; for (; k < ch.w.length - 1; k++) { x -= ch.w[k]; if (x < 0) break; } const pool = SH.COSM.filter(q => q.r === k); return pool.length ? pool[Math.floor(Math.random() * pool.length)] : SH.COSM[0]; };
    const N = 42, AT = 36, list = []; for (let i = 0; i < N; i++) list.push(i === AT ? win : roll());
    UI.spinning = true; UI.reelOn = true; if (UI.cur !== 'avatar') UI.show('avatar'); UI.avTab = 'chests'; UI.render();
    const reel = $('#reel'); if (!reel) { UI.spinning = false; return; } const track = reel.querySelector('.rtrack'), res = reel.querySelector('.rres');
    track.innerHTML = list.map(q => `<div class="rc" style="--rc:${SH.RAR[q.r].c}"><small>${q.k === 'armor' ? 'ARMOUR' : 'WEAPON'}</small><b>${esc(q.n)}</b></div>`).join(''); res.textContent = '';
    const CW = 132, w = reel.clientWidth || 600, end = AT * CW + CW / 2 - w / 2 + (Math.random() - 0.5) * CW * 0.6;
    track.style.transition = 'none'; track.style.transform = 'translateX(0)'; void track.offsetWidth;
    track.style.transition = 'transform 4.2s cubic-bezier(.08,.6,.12,1)'; track.style.transform = `translateX(${-end}px)`; A().audio && A().audio('page');
    let ticks = 0; const tk = setInterval(() => { if (++ticks > 26) return clearInterval(tk); A().audio && A().audio('click'); }, 150);
    setTimeout(() => { UI.spinning = false; const c = SH.RAR[r.r].c; res.innerHTML = `<b style="color:${c}">${r.dupe ? 'Already yours' : 'NEW!'} ${esc(win.n)}</b><span>${SH.RAR[r.r].n} ${win.k === 'armor' ? 'armour' : 'weapon'} skin${r.dupe ? ' · +' + r.refund + ' dust back' : ' · wear it in My skins'}</span>`;
      reel.classList.add('done'); UI.celebrate && !r.dupe && r.r >= 3 && UI.celebrate(SH.RAR[r.r].n + ' skin!', win.n, '', c); A().audio && A().audio('reveal');
      setTimeout(() => { reel.classList.remove('done'); }, 2500); document.querySelectorAll('[data-a="chest"]').forEach(b => { const q = SH.CHESTS.find(z => z.id === b.dataset.x); b.disabled = !(q && (A().s.dust || 0) >= q.cost); }); }, 4300); };

  // ================================================================ start screen
  const tabs = { tGuest: 'fGuest', tLogin: 'fLogin', tReg: 'fReg' };
  for (const t in tabs) $('#' + t).onclick = () => { for (const k in tabs) { $('#' + k).classList.toggle('on', k === t); $('#' + tabs[k]).classList.toggle('hidden', k !== t); } $('#authnote').textContent = ''; };
  UI.authMsg = m => { $('#authnote').textContent = m; $('#authnote').style.color = '#ff9a9a'; };
  $('#guestbtn').onclick = () => A().playGuest($('#gName').value);
  $('#loginbtn').onclick = () => { $('#authnote').textContent = 'Logging in...'; $('#authnote').style.color = '#ccc'; A().auth({ t: 'login', u: $('#lUser').value, p: $('#lPass').value }); };
  $('#regbtn').onclick = () => { $('#authnote').textContent = 'Creating account...'; $('#authnote').style.color = '#ccc'; A().auth({ t: 'register', u: $('#rUser').value, e: $('#rEmail').value, p: $('#rPass').value }); };
  for (const id of ['lPass', 'rPass', 'gName']) $('#' + id).addEventListener('keydown', e => { if (e.code === 'Enter') ({ lPass: '#loginbtn', rPass: '#regbtn', gName: '#guestbtn' })[id] && $(({ lPass: '#loginbtn', rPass: '#regbtn', gName: '#guestbtn' })[id]).click(); });
  // the logo: heavy carved letters with slime dripping off them
  UI.drawLogo = function () {
    const c = $('#logo'), d = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth, h = c.clientHeight; if (!w) return; c.width = w * d; c.height = h * d; const g = c.getContext('2d'); g.scale(d, d);
    const fs = Math.min(h * 0.62, w / 7.2); g.font = `900 ${fs}px ${'"Outfit","Arial Black",sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = 'SLIME SLAYERS', y = h * 0.46; let sd = 5; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    g.save(); g.shadowColor = '#000'; g.shadowBlur = 24; g.shadowOffsetY = 8; g.fillStyle = '#000'; g.fillText(txt, w / 2, y); g.restore();
    // drips
    const tw = g.measureText(txt).width; g.fillStyle = '#3d8a2a';
    for (let i = 0; i < 16; i++) { const x = w / 2 - tw / 2 + r() * tw, len = fs * (0.15 + r() * 0.5), dw = fs * (0.03 + r() * 0.04); g.beginPath(); g.moveTo(x - dw, y + fs * 0.2); g.lineTo(x - dw * 0.6, y + fs * 0.2 + len); g.arc(x, y + fs * 0.2 + len, dw * 0.9, Math.PI, 0, true); g.lineTo(x + dw, y + fs * 0.2); g.fill(); }
    // purple to blue letters with a bright edge (still heavy and dark-outlined)
    const gr = g.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); gr.addColorStop(0, '#f4e8ff'); gr.addColorStop(0.28, '#c46aff'); gr.addColorStop(0.55, '#7a3aff'); gr.addColorStop(0.8, '#3b6cff'); gr.addColorStop(1, '#1a2a8a');
    g.lineWidth = fs * 0.12; g.strokeStyle = '#0a0614'; g.strokeText(txt, w / 2, y); g.save(); g.shadowColor = '#8a4aff'; g.shadowBlur = fs * 0.35; g.fillStyle = gr; g.fillText(txt, w / 2, y); g.restore(); g.fillStyle = gr; g.fillText(txt, w / 2, y);
    // slime coating the top of the letters
    g.save(); g.beginPath(); g.rect(0, y - fs * 0.62, w, fs * 0.24); g.clip(); const sg = g.createLinearGradient(0, y - fs * 0.6, 0, y - fs * 0.35); sg.addColorStop(0, '#7aff5a'); sg.addColorStop(1, '#2a6a1a'); g.fillStyle = sg; g.fillText(txt, w / 2, y); g.restore();
    g.lineWidth = 2; g.strokeStyle = '#ffffff55'; g.strokeText(txt, w / 2, y);
  };
  addEventListener('resize', () => { if (!$('#start').classList.contains('hidden')) UI.drawLogo(); });
  return UI;
})(typeof self !== 'undefined' ? self : this);
