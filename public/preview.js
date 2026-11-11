/* Slime Slayers - the 3D character preview (Inventory and Armory): a second, small WebGL view of your slayer in the gear you wear.
   Drag to turn it, click to swing. It only renders while it is on screen, and on Low graphics it renders at 24 fps with the lean shader. */
(function (root) {
  'use strict';
  let cv = null, E = null, CH = null, st = null, lookKey = '', getLook = null, yaw = 0.5, spin = 0, drag = null, run = false, last = 0, T0 = 0, lowGap = 0, ped = null, ring = null;
  const PV = root.SSPreview = { frames: 0, ok: true };
  function init() {
    cv = document.createElement('canvas'); cv.id = 'pvc'; cv.title = 'Drag to turn · click to swing';
    E = root.TLEngine(cv); if (!E || !E.ok) { PV.ok = false; return false; }
    CH = root.SSChar(E); const G = E.G;
    ped = E.mesh(G.cyl(1.05, 1.15, 0.22, 36)); ring = E.mesh(G.torus(1.12, 0.035, 40, 6));
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, moved: 0 }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx); yaw -= dx * 0.012; spin = -dx * 0.6; });
    cv.addEventListener('pointerup', () => { if (drag && drag.moved < 4 && st) CH.play(st, 'attack', { kind: st.kind || 'sword' }); drag = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); PV.zoom = Math.max(3.2, Math.min(8.5, (PV.zoom || 6.4) + e.deltaY * 0.004)); }, { passive: false });
    return true;
  }
  // host: an empty element in a panel; look(): the CH look to draw (with the gear you wear); quality: the game's graphics level
  PV.attach = function (host, look, quality, kind) {
    if (!host) return false; if (!cv && !init()) { host.innerHTML = '<div class="note" style="padding:20px">3D preview needs WebGL.</div>'; return false; }
    getLook = look; const q = quality === 'low' ? 'low' : 'med'; if (E.quality !== q) E.setQuality(q);
    host.appendChild(cv); const lk = look(); if (!st) st = CH.create(lk); st.kind = kind; refresh(lk);
    if (!run) { run = true; last = 0; requestAnimationFrame(frame); }
    return true;
  };
  function refresh(lk) { const key = JSON.stringify(lk); if (key !== lookKey) { lookKey = key; st.look = lk; } }
  function frame(ms) {
    if (!cv || !document.body.contains(cv) || !cv.offsetWidth) { run = false; return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ms - last) / 1000 || 0.016);
    if (E.quality === 'low') { lowGap += dt; if (lowGap < 1 / 24) return; lowGap = 0; }
    last = ms; T0 += dt;
    try { draw(Math.min(0.06, dt + (E.quality === 'low' ? 1 / 24 - dt : 0))); } catch (e) { PV.err = String(e && e.message || e); }
  }
  function draw(dt) {
    if (getLook) refresh(getLook());
    if (!drag) { spin *= Math.pow(0.04, dt); yaw += (spin + 0.18) * dt; }
    CH.update(st, dt, { speed: 0, vy: 0, grounded: true });
    const M = E.M, T = M.trs, z = PV.zoom || 6.4, ty = 1.85;
    const tr = st.trailPts; if (tr.length > 9) tr.splice(0, tr.length - 9);
    CH.draw(st.look, st.pose, 0, 0.22, 0, yaw, { face: st.face, blink: st.blink > 0, springs: st.springs, trail: tr, weapon: true }); if (tr.length && !st.pose.trail) tr.forEach(p => p.on = false); CH.drawTrail(tr, st.trailMesh);
    E.draw(ped, T(0, 0.11, 0), '#1c1822', { soft: 0.4 });
    E.draw(ring, T(0, 0.225, 0, T0 * 0.3), '#c9a45c', { emis: 1.4, alpha: 0.75, mode: 3, add: true, noShadow: true, depthWrite: false });
    const sun = [-0.42, 0.7, 0.58], l = Math.hypot(...sun);
    E.frame({ eye: [0, ty + 0.45, z], target: [0, ty, 0], fov: 0.6, sun: sun.map(v => v / l), dt, time: T0, focus: [0, 0, 0],
      sunCol: [1.05, 0.98, 1.05], skyCol: [0.42, 0.38, 0.56], gndCol: [0.16, 0.12, 0.16], fog: [0.06, 0.05, 0.09], skyTop: [0.03, 0.025, 0.05], skyHor: [0.09, 0.07, 0.12], stars: false });
    PV.frames++;
  }
  PV.swing = () => { if (st) CH.play(st, 'attack', { kind: st.kind || 'sword' }); };
})(typeof self !== 'undefined' ? self : this);
