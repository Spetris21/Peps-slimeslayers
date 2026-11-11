/* Slime Slayers - Character Lab: try every look, animation, emote and expression. Also used for the screenshots. */
(function () {
  'use strict';
  const canvas = document.getElementById('c'), E = TLEngine(canvas);
  if (!E.ok) { document.body.innerHTML = '<p style="padding:30px">WebGL is turned off in this browser.</p>'; return; }
  const M = E.M, G = E.G, T = M.trs, CH = window.CH = SSChar(E), TAU = Math.PI * 2;
  E.setQuality(new URLSearchParams(location.search).get('q') || 'high');
  // ---------- a castle-town plaza at dusk
  const S = (geo, m, col, tex) => E.addStatic(geo, m, col, tex, 'lab');
  const WIN = []; let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  S(G.disc(90, 48), T(0, -0.02, 0), '#3c3a48', 'tile');
  S(G.disc(5.6, 40), T(0, 0.006, 0), '#4a4658', 'tile');
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; S(G.box(1.2, 0.08, 0.5, 0.1), T(Math.sin(a) * 5.9, 0.03, Math.cos(a) * 5.9, a), '#2a2833', 'rock'); }
  // castle wall + towers behind the plaza
  for (let i = -7; i <= 7; i++) { const a = i * 0.13, x = Math.sin(a) * 24, z = -Math.cos(a) * 24;
    S(G.box(3.3, 6, 1.6, 0.1), T(x, 3, z, -a), '#5c5868', 'brick');
    for (const k of [-1, 1]) S(G.box(0.9, 0.8, 1.7, 0.1), T(x + Math.cos(a) * k * 0.8, 6.4, z + Math.sin(a) * k * 0.8, -a), '#55515f', 'brick'); }
  for (const a of [-0.95, -0.32, 0.32, 0.95]) { const x = Math.sin(a) * 24, z = -Math.cos(a) * 24, h = a === -0.32 || a === 0.32 ? 12 : 9.5;
    S(G.cyl(2.3, 2.5, h, 20), T(x, h / 2, z), '#5f5b6b', 'brick'); S(G.cyl(2.8, 2.8, 0.6, 20), T(x, h + 0.3, z), '#46424f', 'rock');
    S(G.cyl(0, 2.9, 4.2, 20), T(x, h + 2.7, z), '#1c1f33'); S(G.cyl(0.06, 0.06, 1.4, 6), T(x, h + 5.4, z), '#3a3a44');
    for (let k = 0; k < 3; k++) WIN.push([x + Math.sin(a) * -2.35, 2.5 + k * 2.4, z + Math.cos(a) * 2.35, -a, 0.5, 0.9]); }
  // timber houses on both sides
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
    const x = s * (14 + k * 1.5), z = -6 - k * 7, rot = s * -1.2, roof = k ? '#3a2226' : '#22283a';
    S(G.box(6, 4.2, 5, 0.05), T(x, 2.1, z, rot), '#6e6658', 'white');
    for (const yy of [0.1, 2.1, 4.1]) S(G.box(6.15, 0.3, 5.15, 0.05), T(x, yy, z, rot), '#2e2018', 'wood');
    for (const q of [-2.9, -1, 1, 2.9]) S(G.box(0.3, 4.2, 5.15, 0.05), T(x + Math.cos(rot) * q, 2.1, z - Math.sin(rot) * q, rot), '#2e2018', 'wood');
    S(G.box(6.6, 0.4, 3.9, 0.05), T(x - Math.sin(rot) * 1.3, 5.2, z - Math.cos(rot) * 1.3, rot, 0.75, 0), roof, 'wood');
    S(G.box(6.6, 0.4, 3.9, 0.05), T(x + Math.sin(rot) * 1.3, 5.2, z + Math.cos(rot) * 1.3, rot, -0.75, 0), roof, 'wood');
    for (const q of [-1.5, 1.5]) WIN.push([x + Math.cos(rot) * q + Math.sin(rot) * 2.55, 2.8, z - Math.sin(rot) * q + Math.cos(rot) * 2.55, rot, 1.1, 1.2]);
    S(G.box(1.2, 2, 0.25, 0.2), T(x + Math.sin(rot) * 2.55, 1, z + Math.cos(rot) * 2.55, rot), '#24180f', 'wood');
  }
  // pine trees and a few crates + barrels
  for (let i = 0; i < 14; i++) { const a = (rnd() - 0.5) * 2.6, r = 18 + rnd() * 8, x = Math.sin(a) * r * 1.1, z = -Math.cos(a) * r * 0.6 - 2;
    if (z < -17 || z > -6) continue; S(G.cyl(0.3, 0.4, 1.6, 8), T(x, 0.8, z), '#5a3a26', 'wood');
    for (let k = 0; k < 3; k++) S(G.cyl(0, 2.2 - k * 0.5, 2.4, 9), T(x, 2.2 + k * 1.3, z), ['#14261e', '#182e24', '#1c352a'][k]); }
  for (const [x, z] of [[-7.5, -4], [7.8, -3.4], [-8.4, 2.5]]) { S(G.box(1.1, 1.1, 1.1, 0.08), T(x, 0.55, z, rnd()), '#3e2a1a', 'wood'); S(G.cyl(0.45, 0.45, 1.1, 12), T(x + 1.3, 0.55, z + 0.4), '#33221a', 'wood'); }
  E.buildStatic();

  // ---------- glowing lanterns, banners and slime monsters
  const bannerTex = E.canvasTex((() => { const c = document.createElement('canvas'); c.width = 64; c.height = 192; const g = c.getContext('2d');
    g.fillStyle = '#5a0f18'; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.lineTo(64, 170); g.lineTo(46, 158); g.lineTo(32, 192); g.lineTo(18, 158); g.lineTo(0, 170); g.closePath(); g.fill();
    g.fillStyle = '#1a0a0e'; g.fillRect(0, 0, 64, 10); g.fillStyle = '#8a7040'; g.fillRect(5, 14, 3, 140); g.fillRect(56, 14, 3, 140);
    g.fillStyle = '#12080a'; g.beginPath(); g.moveTo(32, 46); g.lineTo(50, 70); g.lineTo(42, 112); g.lineTo(32, 100); g.lineTo(22, 112); g.lineTo(14, 70); g.closePath(); g.fill();
    g.fillStyle = '#ff3a3a'; g.beginPath(); g.moveTo(22, 74); g.lineTo(30, 80); g.lineTo(22, 82); g.fill(); g.beginPath(); g.moveTo(42, 74); g.lineTo(34, 80); g.lineTo(42, 82); g.fill(); return c; })());
  const lampM = E.mesh(G.box(1, 1, 1, 0.25)), postM = E.mesh(G.cyl(0.07, 0.09, 1, 8)), capM = E.mesh(G.cyl(0.18, 0.1, 0.3, 8)), quadM = E.mesh(G.quad(1, 1)), discM = E.mesh(G.disc(1, 32, 0, 1));
  const slimeM = E.mesh(G.ico(1, 0.2, 7)), eyeM = E.mesh(G.sphere(1, 12, 8)), crownM = E.mesh(G.cyl(0, 0.5, 1, 4)), toothM = E.mesh(G.cyl(0, 0.5, 1, 4));
  const LAMPS = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; if (Math.cos(a) > 0.7) continue; LAMPS.push([Math.sin(a) * 7.4, Math.cos(a) * 7.4]); }
  const SLIMES = window.SLIMES = [{ x: -4.2, z: -2.8, s: 0.8, c: '#2f6a22', ph: 0 }, { x: 4.4, z: -3.2, s: 0.7, c: '#3a1a5a', ph: 2 }, { x: 0.4, z: -6.5, s: 1.8, c: '#1e1028', ph: 1, king: 1 }];
  function drawProps(t) {
    E.draw(discM, M.mul(T(-60, 70, -95), T(0, 0, 0, 0, Math.PI / 2 - 0.5, 0, 9, 9, 9)), '#dfe8ff', { mode: 3, nofog: true, noShadow: true, cull: false });
    for (const w of WIN) E.draw(lampM, T(w[0], w[1], w[2], w[3], 0, 0, w[4] * 0.8, w[5] * 0.8, 0.12), '#ff8a2a', { emis: 0.85 + Math.sin(t * 3 + w[0]) * 0.1, noShadow: true });
    for (const [x, z] of LAMPS) { // torches: iron post, fire, sparks
      E.draw(postM, T(x, 1.3, z, 0, 0, 0, 1, 2.6, 1), '#1a181e', { soft: 1 }); E.draw(capM, T(x, 2.65, z), '#2a262e');
      const f = 1 + Math.sin(t * 17 + x) * 0.12 + Math.sin(t * 29 + z) * 0.08; E.draw(lampM, T(x, 2.98, z, t, 0, 0, 0.2 * f, 0.34 * f, 0.2 * f), '#ff7a1a', { emis: 3, noShadow: true });
      E.draw(lampM, T(x, 3.0, z, -t * 1.3, 0, 0, 0.11, 0.22 * f, 0.11), '#ffd27a', { emis: 3, noShadow: true });
      if (Math.random() < 0.5) E.particle({ x: x + (Math.random() - 0.5) * 0.2, y: 3.05, z: z + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 0.4, vy: 1.2 + Math.random(), vz: (Math.random() - 0.5) * 0.4, life: 0.7, size: 0.12, col: Math.random() < 0.5 ? '#ff8a2a' : '#ffd25a', add: true }); }
    for (let i = -6; i <= 6; i += 2) { const a = i * 0.13, x = Math.sin(a) * 23.1, z = -Math.cos(a) * 23.1 + 0.05; E.draw(quadM, T(x, 3.6 + Math.sin(t * 1.5 + i) * 0.03, z, -a, 0, Math.sin(t * 1.3 + i) * 0.03, 1.3, 3.8, 1), '#9a9aa8', { tex: bannerTex, texMode: 1, mode: 3, cull: false, noShadow: true }); }
    if (Math.random() < 0.3) E.particle({ x: (Math.random() - 0.5) * 30, y: 0.3 + Math.random() * 3, z: -Math.random() * 18, vx: 0.15, vy: 0.05, vz: 0, life: 4, size: 0.06, col: '#9ab0ff', add: true, a: 0.6 });
    for (const q of SLIMES) { if (LAB.noSlimes) break; const b = Math.sin(t * 3 + q.ph), sq = 1 + b * 0.08, y = Math.max(0, Math.sin(t * 3 + q.ph)) * 0.25 * q.s, yaw = Math.atan2(-q.x, -q.z + 6) * 0.6;
      E.draw(slimeM, T(q.x, q.s * 0.72 * (2 - sq) + y, q.z, yaw, 0, 0, q.s * sq, q.s * 0.78 * (2 - sq), q.s * sq), q.c, { soft: 1, spec: 0.8 });
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      for (const s of [-1, 1]) { const ex = fx * q.s * 0.74 + rx * s * q.s * 0.3, ez = fz * q.s * 0.74 + rz * s * q.s * 0.3; // angry glowing eyes
        E.draw(eyeM, T(q.x + ex, q.s * 0.9 + y, q.z + ez, yaw, 0, s * -0.55, q.s * 0.16, q.s * 0.07, q.s * 0.08), '#ff1a1a', { emis: 1.5, noShadow: true }); }
      for (let k = -2; k <= 2; k++) { const tx = fx * q.s * 0.77 + rx * k * q.s * 0.1, tz = fz * q.s * 0.77 + rz * k * q.s * 0.1; // jagged teeth
        E.draw(toothM, T(q.x + tx, q.s * 0.62 + y, q.z + tz, yaw, Math.PI, 0, q.s * 0.07, q.s * 0.14, q.s * 0.05), '#d8d4c8', { soft: 1 }); }
      if (q.king) for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; E.draw(crownM, T(q.x + Math.cos(a) * q.s * 0.38, q.s * 1.42 + y, q.z + Math.sin(a) * q.s * 0.38, 0, 0, Math.cos(a) * 0.3, q.s * 0.14, q.s * 0.5, q.s * 0.14), '#2a2630', { soft: 1, spec: 1 }); }
      if (Math.random() < 0.15) E.particle({ x: q.x + (Math.random() - 0.5) * q.s, y: q.s * 0.3, z: q.z + (Math.random() - 0.5) * q.s, vx: 0, vy: -0.5, vz: 0, life: 0.8, size: 0.1 * q.s, col: q.c, g: 4 });
    }
  }
  // ---------- looks
  const LOOKS = window.LOOKS = [
    { name: 'Wanderer', look: CH.look({ hair: 'messy', hairC: '#121116', eye: '#7a8aa8', skin: '#e8c0a0', shirt: '#1a1a20', sleeve: 'long', pants: '#15151a', shoes: '#141418', outfit: 'coat', gear1: '#2e221a', gear2: '#5a1018', wpn: 'sword', weapon: '#8a929e', gem: '#3ab8ff', glow: '#3ab8ff' }) },
    { name: 'Dark Knight', look: CH.look({ skin: '#d8a888', outfit: 'knight', gear1: '#2f333c', gear2: '#5a0a12', glow: '#ff2a2a', cape: '#16121a', cape2: '#72560f', shirt: '#121216', pants: '#121216', shoes: '#2f333c', wpn: 'greatsword', weapon: '#5a606c', gem: '#ff2a2a' }) },
    { name: 'Warlock', look: CH.look({ skin: '#b98060', outfit: 'mage', gear1: '#15131c', gear2: '#5a2a9a', glow: '#b45aff', shirt: '#15131c', pants: '#100e16', shoes: '#100e16', eye: '#b45aff', wpn: 'staff', weapon: '#cfc6e0', gem: '#b45aff' }) },
    { name: 'Shadow Ninja', look: CH.look({ skin: '#e8c0a0', hair: 'spiky', hairC: '#d8d8e2', eye: '#ff3a4a', mask: '#16161c', outfit: 'ninja', gear1: '#7a0e1a', gear2: '#16161c', glow: '#ff2a3a', shirt: '#16161c', pants: '#16161c', shoes: '#101014', wpn: 'dagger', weapon: '#7a828e', gem: '#ff2a3a' }) },
    { name: 'Slayer', look: CH.look({ skin: '#8a5a3c', hair: 'buns', hairC: '#2a1418', hairC2: '#9a1a24', eye: '#e8a030', shirt: '#2a2d36', shirt2: '#9a1a24', pattern: 'split', sleeve: 'none', pants: '#1c1e25', shoes: '#18181c', wpn: 'hammer', weapon: '#4a4e58', gem: '#e8a030', glow: '#ff8a1a' }) },
    // Update 7: the twelve dungeon armour sets (the layered plate + that dungeon's own pieces), each at a higher rarity so the glow grows
    ...[['#2e3a22', '#5a6a2a', '#7aff5a'], ['#6a5228', '#c8a050', '#ffcf5a'], ['#2a2d36', '#4a5a6a', '#7ad8ff'], ['#4a6a8a', '#bfe8ff', '#9ae8ff'], ['#3a1a12', '#8a2a1a', '#ff7a1a'], ['#22243a', '#4a5a9a', '#8ab0ff'],
      ['#1a0e2a', '#5a2a8a', '#c87aff'], ['#0e0a14', '#3a0a2a', '#ff2a6a'], ['#0a1a10', '#1aff8a', '#1aff8a'], ['#0e2a30', '#2a8a8a', '#5affe0'], ['#2a1e10', '#c8963a', '#ffc84a'], ['#1a1e2e', '#b8c4ff', '#d8e4ff']].map(([g1, g2, gl], t) => {
      const rar = Math.min(5, 1 + Math.floor(t / 2.4)), rc = ['#9a9aa8', '#5ad85a', '#4aa8ff', '#b45aff', '#ffb02a', '#ff3a3a'][rar];
      return { name: CH.TIER_N[t] + ' set', look: CH.look({ skin: '#e8c0a0', outfit: 'plate' + t, gear1: g1, gear2: g2, glow: gl, helm: 'helm', hc1: g1, hc2: g2, htier: t, hglow: gl, glove: 'gauntlet', gc1: g1, gc2: g2, gtier: t, boot: 'greaves', bc1: g1, bc2: g2, btier: t,
        shirt: '#14121a', pants: '#14121a', shoes: g1, wpn: 'sword', weapon: g2, gem: gl, rar }) }; }),
    // Update 7 (final): the Shop's cosmetic skins, an armour skin with a weapon skin each (16 + 16)
    ...(() => { const C = window.SS_CONFIG, A = C.SHOP.COSM.filter(q => q.k === 'armor'), W = C.SHOP.COSM.filter(q => q.k === 'weapon');
      return A.map((a, i) => ({ name: 'Skin: ' + a.n + ' + ' + W[i].n, look: CH.look(CH.applySkins({ skin: '#e8c0a0', hair: 'messy', hairC: '#2a1a12', eye: '#6a7a90', shirt: '#2a2d36', pants: '#1c1e25', shoes: '#15151a', wpn: 'sword', weapon: '#c8c8d0', gem: '#ffd84a', glow: '#3ab8ff' }, [a.id, W[i].id])) })); })()
  ];
  // ---------- demo animations (some move the character, e.g. jumps)
  const DEMO = {
    jump: t => { t %= 1.7; if (t < 0.9) { const y = 4 * 1.3 * (t / 0.9) * (1 - t / 0.9), vy = (1 - 2 * t / 0.9); return { p: vy > 0 ? CH.pose('jump', t) : CH.lerpPose(CH.pose('jump', t), CH.pose('fall', t), Math.min(1, -vy * 1.5)), y }; } return { p: t < 1.2 ? Object.assign(CH.pose('idle', t), CH.pose('land', t - 0.9)) : CH.pose('idle', t), y: 0 }; },
    doubleJump: t => { t %= 2.1; if (t < 1.25) { const y = t < 0.35 ? 1.6 * Math.sin(t / 0.35 * Math.PI / 2) : 1.6 + 1.1 * Math.sin(Math.min(1, (t - 0.35) / 0.9) * Math.PI) - 1.6 * Math.max(0, (t - 0.8) / 0.45) ** 2;
      return { p: t < 0.35 ? CH.pose('jump', t) : t < 0.83 ? CH.pose('doubleJump', t - 0.35) : CH.lerpPose(CH.pose('jump', t), CH.pose('fall', t), Math.min(1, (t - 0.83) * 3)), y: Math.max(0, y) }; } return { p: t < 1.55 ? Object.assign(CH.pose('idle', t), CH.pose('land', t - 1.25)) : CH.pose('idle', t), y: 0 }; },
    combo: t => { t %= 2.0; const C = CH.COMBO; let k = t; for (const c of C) { if (k < c.dur) return { p: CH.pose(c.a, k), y: 0 }; k -= c.dur; } return { p: CH.pose('idle', t, { armed: true }), y: 0 }; },
    hit: t => { t %= 1.2; const base = CH.pose('idle', t, { armed: true }); return { p: t < 0.34 ? CH.lerpPose(base, CH.pose('hit', t), Math.min(1, t / 0.06, (0.34 - t) / 0.1)) : base, y: 0 }; },
    victory: t => ({ p: CH.pose('victory', t % 3.4), y: 0 }),
    walk: t => ({ p: CH.pose('walk', t, { phase: t * 10.5 }), y: 0, spd: 4 }),
    run: t => ({ p: CH.pose('run', t, { phase: t * 16 }), y: 0, spd: 8 }),
    walkArmed: t => ({ p: CH.pose('walk', t, { phase: t * 10.5, armed: true }), y: 0, spd: 4 }),
    swim: t => ({ p: CH.pose('swim', t), y: 0.2 }),
    idleArmed: t => ({ p: CH.pose('idle', t, { armed: true }), y: 0 })
  };
  const ANIMS = [['idle', 'Idle'], ['idleArmed', 'Ready'], ['walk', 'Walk'], ['run', 'Run'], ['walkArmed', 'Walk + sword'], ['jump', 'Jump'], ['doubleJump', 'Double jump'], ['swim', 'Swim'], ['sit', 'Sit'], ['combo', '3-hit combo'], ['hit', 'Get hit'], ['victory', 'Victory']];
  const animPose = (name, t) => DEMO[name] ? DEMO[name](t) : { p: CH.pose(name, t), y: 0 };

  // ---------- lab state (also driven by the screenshot scripts)
  const LAB = window.LAB = {
    chars: [{ look: LOOKS[0].look, x: 0, z: 0, yaw: 0, anim: 'idle', t: null, face: null, springs: {}, trail: [], dm: E.dynMesh() }],
    cam: { yaw: 0.35, pitch: 0.1, dist: 7.2, ty: 1.4, tx: 0, tz: 0 }, time: null, spin: false, sel: 0, face: null, blinkAuto: true
  };
  LAB.set = function (list) { LAB.chars = list.map(c => Object.assign({ x: 0, z: 0, yaw: 0, anim: 'idle', t: null, face: null, springs: {}, trail: [], dm: E.dynMesh() }, c)); };
  // ---------- input
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; LAB.cam.yaw -= (e.clientX - drag.x) * 0.008; LAB.cam.pitch = Math.max(-0.3, Math.min(1.2, LAB.cam.pitch + (e.clientY - drag.y) * 0.006)); drag = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', () => { drag = null; canvas.style.cursor = 'grab'; });
  canvas.addEventListener('wheel', e => { LAB.cam.dist = Math.max(2.2, Math.min(18, LAB.cam.dist + e.deltaY * 0.005)); e.preventDefault(); }, { passive: false });
  // ---------- panel
  const panel = document.getElementById('panel');
  function ui() {
    const c = LAB.chars[0], btn = (txt, on, fn) => `<button class="${on ? 'on' : ''}" onclick="${fn}">${txt}</button>`;
    panel.innerHTML = `<h1>Character Lab</h1><div class="sub">Slime Slayers · every look, animation, emote and face<br>Owners: Parker &amp; Wolfie</div>
      <div class="sec">Look</div><div class="bs">${LOOKS.map((l, i) => btn(l.name, c.look === l.look, `LAB.pick(${i})`)).join('')}</div>
      <div class="sec">Hair</div><div class="bs">${CH.hairStyles.map(h => btn(h, c.look.hair === h, `LAB.hair('${h}')`)).join('')}</div>
      <div class="sec">Animations</div><div class="bs">${ANIMS.map(([k, n]) => btn(n, c.anim === k, `LAB.anim('${k}')`)).join('')}</div>
      <div class="sec">Emotes</div><div class="bs">${CH.EMOTES.map(e => btn(e.ico + ' ' + e.n, c.anim === e.id, `LAB.anim('${e.id}')`)).join('')}</div>
      <div class="sec">Faces</div><div class="bs">${['auto'].concat(CH.expressions).map(x => btn(x, (LAB.face || 'auto') === x, `LAB.setFace('${x}')`)).join('')}</div>
      <div class="sec">View</div><div class="bs">${btn('Front', 0, 'LAB.view(0)')}${btn('Side', 0, 'LAB.view(1)')}${btn('Back', 0, 'LAB.view(2)')}${btn('Face', 0, 'LAB.view(3)')}${btn('Turntable', LAB.spin, 'LAB.spin=!LAB.spin;LAB.ui()')}${btn('All 5', LAB.chars.length > 1, 'LAB.all()')}</div>`;
  }
  LAB.ui = ui;
  LAB.pick = i => { LAB.set([{ look: LOOKS[i].look, anim: LAB.chars[0].anim }]); ui(); };
  LAB.hair = h => { LAB.chars[0].look = Object.assign({}, LAB.chars[0].look, { hair: h }); ui(); };
  LAB.anim = a => { LAB.chars.forEach(c => { c.anim = a; c.t0 = T0; c.t = null; }); ui(); };
  LAB.setFace = f => { LAB.face = f === 'auto' ? null : f; ui(); };
  LAB.view = v => { const C = LAB.cam; C.yaw = [0.0001, Math.PI / 2, Math.PI, 0.0001][v]; C.pitch = v === 3 ? 0.04 : 0.1; C.dist = v === 3 ? 2.8 : 7.2; C.ty = v === 3 ? 2.15 : 1.4; };
  LAB.all = () => { if (LAB.chars.length > 1) return LAB.pick(0); LAB.set(LOOKS.map((l, i) => ({ look: l.look, x: (i - 2) * 2.3, z: Math.abs(i - 2) * -0.7, anim: LAB.chars[0].anim }))); LAB.cam.dist = 12; LAB.cam.ty = 1.4; ui(); };
  ui();

  // ---------- render loop
  let last = 0, T0 = 0;
  function frame(ms) {
    requestAnimationFrame(frame); // scheduled first, so an error in one frame can never freeze the lab
    try { draw(ms); } catch (e) { LAB.lastError = String(e && e.message || e); console.warn(e); }
  }
  // sanity check used by the tests: every part is a real number and the character is where it should be
  LAB.check = () => { for (const c of LAB.chars) { if (!c.head || !c.head.every(isFinite)) return 'head position is not a number'; if (c.head[1] < 0.6 || c.head[1] > 6) return 'head at height ' + c.head[1].toFixed(2);
      for (const k in c.lastPose || {}) if (typeof c.lastPose[k] === 'number' && !isFinite(c.lastPose[k])) return 'pose ' + k + ' is not a number'; } return LAB.lastError ? 'error: ' + LAB.lastError : 'ok'; };
  function draw(ms) {
    const dt = Math.min(0.05, (ms - last) / 1000 || 0.016); last = ms; T0 += dt;
    const t = LAB.time !== null ? LAB.time : T0, C = LAB.cam;
    if (LAB.spin) C.yaw += dt * 0.5;
    const tx = C.tx, ty = C.ty, tz = C.tz, eye = [tx + Math.sin(C.yaw) * Math.cos(C.pitch) * C.dist, ty + Math.sin(C.pitch) * C.dist, tz + Math.cos(C.yaw) * Math.cos(C.pitch) * C.dist];
    for (const c of LAB.chars) {
      const lt = Math.max(0, c.t !== null && c.t !== undefined ? c.t : t - (c.t0 || 0)), d = animPose(c.anim, lt), P = c.pose || d.p;
      // eyes follow the camera
      const a0 = Math.atan2(eye[0] - c.x, eye[2] - c.z) - c.yaw, a = Math.atan2(Math.sin(a0), Math.cos(a0));
      const lx = Math.abs(a) < 1.6 ? -Math.max(-2, Math.min(2, Math.round(a * 1.6))) : 0, ly = Math.max(-1, Math.min(1, Math.round(-(eye[1] - 1.8) / C.dist * 2)));
      const blink = LAB.blinkAuto && c.t === null && ((lt + c.x * 0.7) % 3.3) < 0.13;
      CH.stepSprings(c.springs, dt, { fwd: d.spd || 0, side: 0, vy: 0, lean: P.lean || 0 });
      const hm = CH.draw(c.look, P, c.x, d.y || 0, c.z, c.yaw, { face: c.face || LAB.face || P.face || 'happy', blink, lx: c.lx !== undefined ? c.lx : lx, ly: c.ly !== undefined ? c.ly : ly, springs: c.springs, trail: c.trail, weapon: c.weapon });
      c.head = [hm[12], hm[13], hm[14]]; c.lastPose = P;
      if (c.trail.length > 9) c.trail.splice(0, c.trail.length - 9);
      if (!P.trail) c.trail.forEach(p => p.on = false);
      CH.drawTrail(c.trail, c.dm, c.look.weapon === '#ffb070' ? '#ffb070' : '#bfefff');
      // blob shadow under the feet when shadows are off
      if (E.quality === 'low') E.draw(E.labDisc || (E.labDisc = E.mesh(G.disc(0.5, 20))), T(c.x, 0.02, c.z, 0, 0, 0, 1.2, 1, 1.2), '#000000', { alpha: 0.25, mode: 3, noShadow: true });
    }
    const sun = (() => { const v = [-0.45, 0.62, -0.6], l = Math.hypot(...v); return v.map(x => x / l); })();
    drawProps(t);
    E.frame({ eye, target: [tx, ty, tz], fov: 0.9, sun, dt, time: t, focus: [tx, 0, tz], sunCol: [0.85, 0.92, 1.3], skyCol: [0.46, 0.5, 0.78], gndCol: [0.2, 0.16, 0.24], fog: [0.09, 0.1, 0.19], skyTop: [0.02, 0.03, 0.09], skyHor: [0.1, 0.11, 0.24], stars: true });
    LAB.frames = (LAB.frames || 0) + 1;
  }
  requestAnimationFrame(frame);
})();
