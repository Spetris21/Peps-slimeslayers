/* Slime Slayers - synthesized sound (no audio files): effects placed in space (left/right and distance), a score for every world that
   grows with the fight (drums, then a boss layer), ambience beds (wind, water, lava, machinery) and short stingers. Update 6 · phase 7. */
(function (root) {
  'use strict';
  const A = { sfx: 0.7, music: 0.35, amb: 0.6, ctx: null, intensity: 0, zone: 'hub', boss: 0, lx: 0, lz: 0, lyaw: 0, played: 0 };
  let master, sfxG, musG, ambG, musDuck, noiseBuf, musicOn = false, nextBar = 0, bar = 0, lastPlay = {}, OUT = null, amb = null;
  function init() {
    if (A.ctx) return A.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; A.ctx = new AC();
      master = A.ctx.createGain(); master.gain.value = 0.9; master.connect(A.ctx.destination);
      const comp = A.ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.connect(master);
      sfxG = A.ctx.createGain(); sfxG.gain.value = A.sfx; sfxG.connect(comp);
      A.meter = A.ctx.createAnalyser(); A.meter.fftSize = 512; master.connect(A.meter);
      musDuck = A.ctx.createGain(); musDuck.gain.value = 1; musDuck.connect(comp);
      musG = A.ctx.createGain(); musG.gain.value = A.music * 0.5; musG.connect(musDuck);
      ambG = A.ctx.createGain(); ambG.gain.value = A.amb * 0.5; ambG.connect(comp);
      document.addEventListener('visibilitychange', () => { if (!A.ctx) return; if (document.hidden) A.ctx.suspend(); else A.ctx.resume(); });
      noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { A.ctx = null; }
    return A.ctx;
  }
  A.unlock = () => { const c = init(); if (c && c.state === 'suspended') c.resume(); };
  A.setVol = (s, m, a) => { A.sfx = s; A.music = m; if (a !== undefined) A.amb = a; if (sfxG) { sfxG.gain.value = s; musG.gain.value = m * 0.5; ambG.gain.value = A.amb * 0.5; } };
  function tone(f, dur, type, vol, when, dest, glide, attack, filt) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + (attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filt) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = filt; o.connect(f2); f2.connect(g); } else o.connect(g);
    g.connect(dest || OUT || sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, when, q, type, sweep, dest) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + (when || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq || 1000, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur); f.Q.value = q || 1;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || OUT || sfxG); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const S = {
    // Update 7 (final): a sharper blade swish (higher on each hit of the combo) and a punchy hit: a thump, a squelch of slime and a bright ring of steel
    swing(k) { const f = [1500, 1900, 1200, 1700][k || 0] || 1500; noise(0.2, 0.17, f, 0, 2.2, 'bandpass', f * 3.2); noise(0.12, 0.05, 6500, 0.03, 1, 'highpass'); tone(f * 0.4, 0.14, 'sawtooth', 0.012, 0.02, null, f * 0.15, 0.01, 2400); },
    hit(s) { tone(150 + Math.random() * 25, 0.16, 'sine', 0.32, 0, null, 48); noise(0.12, 0.2, 900, 0, 0.8, 'lowpass', 160); noise(0.16, 0.1, 700, 0.01, 2, 'bandpass', 260);
      tone(1700 + Math.random() * 300, 0.09, 'triangle', 0.03, 0.005); noise(0.04, 0.07, 4200, 0, 3); },
    // ability sounds by element (abil), then the heal
    abil(el) { switch (el) {
      case 'fire': noise(0.7, 0.24, 500, 0, 0.7, 'lowpass', 2400); tone(80, 0.6, 'sawtooth', 0.07, 0, null, 160, 0.03, 600); for (let i = 0; i < 6; i++) noise(0.04, 0.08, 3000, 0.1 + i * 0.07, 3); break;
      case 'frost': [0, 4, 7, 11, 14].forEach((n, i) => tone(NOTE(86 + n), 0.5, 'sine', 0.04, i * 0.025)); noise(0.35, 0.12, 7000, 0, 1.5, 'highpass'); noise(0.08, 0.15, 2600, 0.05, 4); break;
      case 'arcane': [0, 3, 7, 10, 14].forEach((n, i) => tone(NOTE(72 + n), 0.55, 'sine', 0.035, i * 0.045, null, NOTE(72 + n) * 1.02)); noise(0.5, 0.08, 1200, 0, 1, 'bandpass', 4800); break;
      case 'storm': tone(1600, 0.25, 'square', 0.035, 0, null, 180, 0.002, 4000); noise(0.3, 0.2, 2600, 0, 2, 'bandpass', 700); noise(0.6, 0.14, 300, 0.08, 0.6, 'lowpass', 70); break;
      case 'holy': for (const n of [0, 4, 7]) { tone(NOTE(67 + n), 0.9, 'sawtooth', 0.025, 0.02, null, 0, 0.12, 1400); } tone(NOTE(91), 0.8, 'sine', 0.05, 0.1); noise(0.6, 0.04, 8000, 0.1, 0.5, 'highpass'); break;
      case 'nature': tone(220, 0.08, 'triangle', 0.12, 0, null, 120); tone(330, 0.08, 'triangle', 0.08, 0.08, null, 160); noise(0.5, 0.12, 2400, 0.04, 0.8, 'bandpass', 900); break;
      case 'void': noise(0.5, 0.06, 200, 0, 1, 'bandpass', 4000); tone(110, 0.8, 'sawtooth', 0.08, 0.3, null, 38, 0.02, 500); tone(55, 1, 'sine', 0.2, 0.35, null, 30); break;
      default: noise(0.3, 0.2, 700, 0, 1, 'bandpass', 2600); tone(90, 0.35, 'sine', 0.3, 0.12, null, 40); noise(0.12, 0.15, 3800, 0.13, 3); tone(1400, 0.2, 'triangle', 0.03, 0.14); } },
    heal() { [0, 4, 7, 12].forEach((n, i) => tone(NOTE(72 + n), 0.9, 'sine', 0.05, i * 0.08)); noise(0.8, 0.04, 9000, 0.1, 0.5, 'highpass'); },
    crit() { S.hit(); tone(NOTE(81), 0.3, 'triangle', 0.07, 0.01); tone(NOTE(88), 0.25, 'triangle', 0.05, 0.03); noise(0.08, 0.12, 5000, 0, 4); },
    splat(s) { noise(0.32, 0.28, 900, 0, 1.2, 'lowpass', 140); tone(160 / Math.sqrt(s || 1), 0.25, 'sine', 0.22, 0, null, 50); noise(0.12, 0.1, 2400, 0.03, 2, 'bandpass', 600); },
    coin() { tone(NOTE(84 + (Math.random() * 3 | 0)), 0.09, 'triangle', 0.045); tone(NOTE(91), 0.16, 'triangle', 0.035, 0.05); },
    gem() { [0, 7, 12].forEach((n, i) => tone(NOTE(76 + n), 0.4, 'sine', 0.09, i * 0.06)); noise(0.3, 0.03, 7000, 0.05, 1, 'highpass'); },
    levelup() { [0, 3, 7, 12, 15].forEach((n, i) => tone(NOTE(50 + n), 0.9, 'sawtooth', 0.05, i * 0.08, null, 0, 0.02, 1400)); [0, 7, 12].forEach(n => tone(NOTE(74 + n), 1.2, 'triangle', 0.06, 0.4)); noise(0.8, 0.05, 6000, 0.3, 0.5, 'highpass'); },
    // Update 6 moves
    charge() { tone(110, 0.9, 'sawtooth', 0.05, 0, null, 330, 0.3, 900); noise(0.9, 0.05, 600, 0, 2, 'bandpass', 2400); },
    parry() { tone(NOTE(88), 0.5, 'triangle', 0.12); tone(NOTE(95), 0.4, 'sine', 0.08, 0.02); noise(0.12, 0.25, 5200, 0, 6); tone(180, 0.15, 'square', 0.08, 0, null, 90, 0.003, 1500); },
    perfect() { noise(0.5, 0.12, 300, 0, 1, 'bandpass', 3000); [0, 5, 12].forEach((n, i) => tone(NOTE(79 + n), 0.5, 'sine', 0.06, i * 0.04)); },
    rank(r) { const b = 60 + (r || 0) * 2; [0, 4, 7].forEach((n, i) => tone(NOTE(b + n), 0.35, 'triangle', 0.05, i * 0.05)); },
    hurt() { tone(90, 0.2, 'square', 0.12, 0, null, 50, 0.005, 600); noise(0.15, 0.2, 500, 0, 1, 'lowpass', 120); },
    dodge() { noise(0.25, 0.14, 500, 0, 1, 'bandpass', 2200); },
    special() { tone(60, 0.7, 'sawtooth', 0.15, 0, null, 30, 0.01, 500); noise(0.6, 0.25, 300, 0, 0.8, 'lowpass', 80); noise(0.4, 0.12, 900, 0, 1, 'bandpass', 3000); },
    boom() { tone(55, 0.9, 'sine', 0.35, 0, null, 28); noise(0.7, 0.3, 400, 0, 0.7, 'lowpass', 60); },
    roar() { tone(80, 1.5, 'sawtooth', 0.2, 0, null, 40, 0.1, 700); tone(120, 1.2, 'square', 0.06, 0.05, null, 55, 0.1, 500); noise(1.4, 0.25, 350, 0, 0.8, 'lowpass', 120); },
    growl(s) { if (Math.random() < 0.5) return; tone(140 / Math.sqrt(s || 1), 0.35, 'sawtooth', 0.04, 0, null, 90, 0.05, 400); },
    bossDie() { S.boom(); tone(NOTE(38), 2, 'sawtooth', 0.12, 0.1, null, NOTE(26), 0.05, 600); [0, 3, 7, 12].forEach((n, i) => tone(NOTE(62 + n), 1.4, 'triangle', 0.07, 0.6 + i * 0.12)); },
    thud() { tone(70, 0.3, 'sine', 0.3, 0, null, 35); noise(0.18, 0.14, 300, 0, 1, 'lowpass'); },
    spit() { noise(0.3, 0.14, 1400, 0, 1.5, 'bandpass', 300); },
    summon() { tone(NOTE(45), 1, 'sawtooth', 0.07, 0, null, NOTE(57), 0.1, 900); noise(0.9, 0.08, 1500, 0, 1, 'bandpass', 300); },
    pop(r) { noise(0.25, 0.22, 1600, 0, 0.7, 'bandpass', 400); tone(240, 0.22, 'sine', 0.15, 0, null, 900 + (r || 0) * 150); },
    crack(i) { noise(0.09, 0.22, 2400 + (i || 0) * 400, 0, 2); tone(900 + (i || 0) * 200, 0.05, 'square', 0.04, 0, null, 300); },
    shake(i) { noise(0.06, 0.1, 700 + i * 100, 0, 3); },
    reveal(r) { const base = [62, 64, 65, 67, 69, 72, 74][r] || 62, chord = r >= 3 ? [0, 3, 7, 12, 15] : [0, 3, 7];
      chord.forEach((n, i) => tone(NOTE(base + n), 0.7 + r * 0.15, 'triangle', 0.1, i * (r >= 4 ? 0.09 : 0.05)));
      if (r >= 4) { noise(1.2, 0.06, 6000, 0, 0.5, 'highpass'); [0, 7, 12, 19].forEach((n, i) => tone(NOTE(base + 12 + n), 1, 'sine', 0.07, 0.4 + i * 0.08)); }
      if (r >= 5) tone(NOTE(base - 24), 1.8, 'sawtooth', 0.08, 0, null, NOTE(base - 12), 0.05, 900); },
    jackpot() { tone(NOTE(38), 2, 'sawtooth', 0.09, 0, null, NOTE(50), 0.05, 1000); noise(1.6, 0.1, 7000, 0, 0.4, 'highpass'); [0, 3, 7, 12, 15, 19, 24].forEach((n, i) => tone(NOTE(62 + n), 0.6, 'triangle', 0.06, 0.15 + i * 0.07)); },
    sparkle() { [0, 7, 12, 19].forEach((n, i) => tone(NOTE(88 + n), 0.2, 'sine', 0.04, i * 0.04)); },
    whoosh() { noise(0.45, 0.14, 800, 0, 0.6, 'bandpass', 2400); },
    portal() { tone(NOTE(50), 0.9, 'sine', 0.12, 0, null, NOTE(74), 0.1); noise(0.9, 0.12, 400, 0, 0.6, 'bandpass', 3000); },
    click() { tone(520, 0.04, 'triangle', 0.05); noise(0.03, 0.05, 3000, 0, 2); },
    error() { tone(150, 0.2, 'sawtooth', 0.07, 0, null, 100, 0.005, 800); },
    unlock() { [0, 5, 7, 12].forEach((n, i) => tone(NOTE(62 + n), 0.5, 'triangle', 0.09, i * 0.09)); },
    buy() { tone(NOTE(72), 0.12, 'triangle', 0.1); tone(NOTE(79), 0.3, 'triangle', 0.1, 0.08); noise(0.1, 0.05, 5000, 0.08, 2, 'highpass'); },
    horn() { [0, 7, 12].forEach((n, i) => tone(NOTE(50 + n), 0.8, 'sawtooth', 0.06, i * 0.12, null, 0, 0.05, 900)); },
    win() { [0, 3, 7, 12, 15, 19].forEach((n, i) => tone(NOTE(62 + n), 0.5, 'triangle', 0.08, i * 0.09)); tone(NOTE(50), 1.4, 'sawtooth', 0.07, 0, null, 0, 0.05, 800); },
    milestone() { [0, 7, 12, 15, 19].forEach((n, i) => tone(NOTE(60 + n), 0.45, 'triangle', 0.07, i * 0.08)); },
    gift() { [0, 4, 7, 11, 14].forEach((n, i) => tone(NOTE(67 + n), 0.4, 'triangle', 0.08, i * 0.07)); },
    jump() { noise(0.12, 0.05, 900, 0, 1, 'bandpass', 1600); },
    land(v) { tone(80, 0.12, 'sine', 0.12 * Math.min(1, v || 0.5), 0, null, 45); noise(0.1, 0.06, 500, 0, 1, 'lowpass'); },
    thunder() { noise(2.2, 0.35, 200, 0, 0.6, 'lowpass', 50); tone(45, 1.5, 'sine', 0.2, 0.05, null, 30); },
    splash() { noise(0.4, 0.14, 2000, 0, 0.8, 'bandpass', 500); },
    ding(k) { tone(NOTE(79 + ((k || 0) % 5) * 2), 0.12, 'sine', 0.05); },
    fly() { tone(400, 0.25, 'sine', 0.05, 0, null, 1100); },
    zap() { noise(0.18, 0.16, 3200, 0, 2, 'bandpass', 900); tone(1200, 0.12, 'square', 0.04, 0, null, 300, 0.002, 4000); tone(1800, 0.08, 'sawtooth', 0.03, 0.04, null, 600); },
    shield() { tone(NOTE(76), 0.35, 'triangle', 0.08, 0, null, NOTE(88)); noise(0.2, 0.06, 5000, 0, 1, 'highpass'); },
    fire() { noise(0.6, 0.22, 900, 0, 0.6, 'lowpass', 300); tone(90, 0.5, 'sawtooth', 0.06, 0, null, 50, 0.02, 400); },
    ice() { [0, 5, 12].forEach((n, i) => tone(NOTE(84 + n), 0.25, 'sine', 0.05, i * 0.03)); noise(0.3, 0.1, 6000, 0, 1.4, 'highpass'); },
    tick(k) { tone(k ? 880 : 660, 0.06, 'square', 0.05, 0, null, 0, 0.002, 3000); },
    step(k) { const F = STEP[k] || STEP.stone; noise(F[2], F[1], F[0], 0, F[3], F[4]); if (k === 'water') noise(0.12, 0.05, 1800, 0.02, 1, 'bandpass', 700); if (k === 'metal') tone(1400 + Math.random() * 300, 0.05, 'triangle', 0.015); },
    // Update 6 · phase 7
    clang() { tone(NOTE(86), 0.5, 'triangle', 0.08); tone(NOTE(93), 0.35, 'sine', 0.05, 0.01); noise(0.08, 0.2, 4200, 0, 5); },
    heavyHit() { tone(70, 0.3, 'sine', 0.35, 0, null, 30); noise(0.25, 0.28, 500, 0, 0.8, 'lowpass', 90); noise(0.08, 0.12, 2200, 0, 2); },
    slam() { S.boom(); noise(0.4, 0.2, 1200, 0.02, 0.8, 'bandpass', 200); },
    stealth() { noise(0.5, 0.08, 2000, 0, 1, 'bandpass', 400); tone(NOTE(70), 0.6, 'sine', 0.03, 0, null, NOTE(58)); },
    tide() { noise(1.6, 0.16, 300, 0, 0.7, 'lowpass', 900); noise(1.2, 0.06, 2400, 0.3, 0.6, 'bandpass', 800); },
    blade() { noise(0.3, 0.09, 1800, 0, 3, 'bandpass', 3600); },
    star() { tone(NOTE(96), 0.6, 'sine', 0.04, 0, null, NOTE(72)); noise(0.5, 0.05, 6000, 0, 1, 'highpass'); },
    floor() { [0, 7, 12].forEach((n, i) => tone(NOTE(57 + n), 0.6, 'triangle', 0.07, i * 0.07)); },
    mutator() { tone(NOTE(45), 0.8, 'sawtooth', 0.06, 0, null, NOTE(44), 0.05, 700); noise(0.6, 0.06, 1500, 0.1, 1, 'bandpass', 300); },
    ko() { S.boom(); [0, -3, -7].forEach((n, i) => tone(NOTE(62 + n), 0.5, 'triangle', 0.07, i * 0.1)); },
    shutter() { noise(0.04, 0.2, 3000, 0, 2); noise(0.05, 0.12, 1500, 0.06, 2); },
    ping() { tone(NOTE(88), 0.25, 'sine', 0.08); tone(NOTE(95), 0.4, 'sine', 0.06, 0.08); },
    craft() { S.clang(); noise(0.3, 0.08, 800, 0.1, 1, 'lowpass'); },
    evolve() { [0, 4, 7, 12, 16, 19].forEach((n, i) => tone(NOTE(60 + n), 0.6, 'triangle', 0.07, i * 0.07)); noise(1, 0.05, 6000, 0.2, 0.5, 'highpass'); },
    page() { noise(0.12, 0.05, 2800, 0, 1, 'bandpass', 1600); }
  };
  const STEP = { stone: [600, 0.03, 0.05, 1.5, 'lowpass'], grass: [1800, 0.022, 0.07, 0.8, 'bandpass'], sand: [3200, 0.02, 0.08, 0.7, 'bandpass'], snow: [2400, 0.03, 0.09, 1.2, 'bandpass'],
    metal: [2600, 0.02, 0.04, 4, 'bandpass'], water: [900, 0.03, 0.08, 1, 'lowpass'], wood: [420, 0.04, 0.05, 2, 'bandpass'] };
  // a few sounds can fire many times per frame (coins, hits): limit how often each can start
  const GAP = { coin: 0.035, hit: 0.03, abil: 0.05, splat: 0.05, growl: 0.4, step: 0.12, pop: 0.05, blade: 0.25, clang: 0.05, heavyHit: 0.05, page: 0.08 };
  A.play = (name, arg) => { if (!A.ctx || A.sfx <= 0) return; const t = A.ctx.currentTime; if (GAP[name] && t - (lastPlay[name] || 0) < GAP[name]) return; lastPlay[name] = t; try { if (S[name]) { S[name](arg); A.played++; } } catch (e) {} };
  // a sound placed in the world: quieter with distance, left or right of where the camera looks (the listener is set every frame)
  A.listen = (x, z, yaw) => { A.lx = x; A.lz = z; A.lyaw = yaw; };
  A.at = (name, x, z, arg, range) => { if (!A.ctx || A.sfx <= 0 || !S[name]) return; const dx = x - A.lx, dz = z - A.lz, d = Math.hypot(dx, dz), R = range || 42; if (d > R) return;
    const t = A.ctx.currentTime; if (GAP[name] && t - (lastPlay[name] || 0) < GAP[name]) return; lastPlay[name] = t;
    const g = A.ctx.createGain(), k = 1 - d / R; g.gain.value = 0.15 + 0.85 * k * k; let node = g;
    if (A.ctx.createStereoPanner) { const pn = A.ctx.createStereoPanner(), a = Math.atan2(dx, dz) - A.lyaw; pn.pan.value = Math.max(-0.85, Math.min(0.85, -Math.sin(a) * Math.min(1, d / 6))); g.connect(pn); pn.connect(sfxG); } else g.connect(sfxG);
    OUT = node; try { S[name](arg); A.played++; } catch (e) {} OUT = null; setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 4000); };
  A.setIntensity = v => { A.intensity = v; };

  // ---------- the score (Update 7 final): every place has its own composed track (config MUSIC.TRACKS): a tune, a bass line, chords and drums.
  // Out of a fight a dungeon plays its chords, bass and a quiet tune; the drums and the full tune come in when you fight; a boss adds a low brass
  // ostinato and a choir. Duskhold's track plays everything, softly, all the time.
  const SC = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 4, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], lyd: [0, 2, 4, 6, 7, 9, 11], whole: [0, 2, 4, 6, 8, 10, 12], loc: [0, 1, 3, 5, 6, 8, 10] };
  const MU = (root.SS_CONFIG && root.SS_CONFIG.MUSIC) || {}, TR = MU.TRACKS || {}, ALIAS = MU.ALIAS || {};
  const TH = {}; for (const k in TR) TH[k] = TR[k]; for (const k in ALIAS) if (TR[ALIAS[k]]) TH[k] = TR[ALIAS[k]];
  A.setZone = z => { z = TH[z] ? z : 'hub'; if (z === A.zone) return; A.zone = z; if (A.ctx && musDuck) { const t = A.ctx.currentTime; musDuck.gain.cancelScheduledValues(t); musDuck.gain.setValueAtTime(musDuck.gain.value, t); musDuck.gain.linearRampToValueAtTime(0.0001, t + 0.8); musDuck.gain.linearRampToValueAtTime(1, t + 2.6); }
    bar = 0; setAmb(AMB_OF[z] || 'town'); };
  A.setBoss = on => { A.boss = on ? 1 : 0; };
  function pad(c, f, t0, len, wave, filt, vol) { for (const det of [-7, 7]) { const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = wave; o.frequency.value = f; o.detune.value = det;
      fl.type = 'lowpass'; fl.frequency.value = filt; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + len * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(fl); fl.connect(g); g.connect(musG); o.start(t0); o.stop(t0 + len + 0.1); } }
  function hitDrum(c, t, f, f2, vol, len) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g); g.connect(musG); o.start(t); o.stop(t + len + 0.05); }
  // one note of the tune on the track's instrument
  function voice(c, inst, f, t, len, vol) {
    const env = (g, a, d, v) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d); };
    const osc = (type, fr, v, a, d, filt, det) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(fr, t); if (det) o.detune.value = det; env(g, a, d, v);
      if (filt) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(filt * 2, t); fl.frequency.exponentialRampToValueAtTime(filt, t + Math.min(d, 0.3)); o.connect(fl); fl.connect(g); } else o.connect(g);
      g.connect(musG); o.start(t); o.stop(t + d + 0.05); return o; };
    switch (inst) {
      case 'pluck': osc('triangle', f, vol, 0.004, Math.min(len, 0.5) + 0.25); osc('sawtooth', f, vol * 0.25, 0.004, 0.18, 1800); break;   // a lute
      case 'flute': { const o = osc('sine', f, vol, 0.05, len + 0.1); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.2; lg.gain.value = f * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + len + 0.2);
        osc('triangle', f * 2, vol * 0.12, 0.05, len); break; }
      case 'reed': osc('sawtooth', f, vol * 0.7, 0.02, len + 0.05, 1300); osc('square', f * 1.002, vol * 0.25, 0.02, len, 900); break;   // a snake-charmer's pipe
      case 'organ': for (const [m, v] of [[1, 1], [2, 0.5], [3, 0.25]]) osc('sine', f * m, vol * v, 0.06, len + 0.15); break;
      case 'bell': osc('sine', f, vol, 0.003, len + 1.2); osc('sine', f * 2.76, vol * 0.25, 0.003, 0.6); break;
      case 'glass': osc('sine', f * 2, vol * 0.8, 0.003, len + 0.8); osc('triangle', f * 4, vol * 0.15, 0.003, 0.3); break;
      case 'box': osc('sine', f * 2, vol, 0.002, 0.45); osc('sine', f * 4.01, vol * 0.3, 0.002, 0.2); break;   // a music box
      case 'chip': osc('square', f, vol * 0.45, 0.002, Math.min(len, 0.2) + 0.02); break;
      default: osc('sawtooth', f, vol * 0.6, 0.01, len + 0.05, 1500, -6); osc('sawtooth', f, vol * 0.6, 0.01, len + 0.05, 1500, 6); }   // saw: a lead synth
  }
  const DEG = '0123456789abcd';
  function scheduleBar() {
    const c = A.ctx, T = TH[A.zone] || TH.hub; if (!T) { nextBar += 2; return; }
    const sc = SC[T.scale] || SC.minor, step = 60 / T.bpm / 4, t0 = nextBar, I = A.intensity, fight = I > 0.3 || T.town, deg = T.prog[bar % T.prog.length];
    const note = (d, oct) => T.root + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + (oct || 0));
    const chord = [note(deg), note(deg + 2), note(deg + 4)];
    chord.forEach(n => pad(c, NOTE(n - 12), t0, step * 16, T.pad || 'triangle', (T.pad === 'sawtooth' ? 700 : 1400) * (1 + I * 0.5), T.town ? 0.012 : 0.018));
    // the bass line
    const bl = T.bass || 'R...............'; for (let i = 0; i < 16; i++) { const ch = bl[i]; if (ch === '.' || ch === '-') continue; let len = 1; while (i + len < 16 && bl[i + len] === '-') len++;
      const n = ch === '5' ? note(deg + 4) - 12 : ch === 'O' ? note(deg) : note(deg) - 12; 
      const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(), tt = t0 + i * step; o.type = 'sawtooth'; o.frequency.value = NOTE(n - 12); fl.type = 'lowpass'; fl.frequency.value = 380 + I * 300;
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(fight ? 0.07 : 0.045, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + len * step * 0.95); o.connect(fl); fl.connect(g); g.connect(musG); o.start(tt); o.stop(tt + len * step + 0.05); }
    // the tune (quieter out of a fight; in a dungeon it rests every other bar until you fight)
    const ld = T.lead[bar % T.lead.length], quiet = !fight && bar % 2 === 1;
    if (!quiet) for (let i = 0; i < 16; i++) { const ch = ld[i], d = DEG.indexOf(ch); if (d < 0) continue; let len = 1; while (i + len < 16 && ld[i + len] === '-') len++;
      voice(c, T.inst, NOTE(note(d, 1)), t0 + i * step, len * step, (fight ? 0.05 : 0.03) * (T.town && I <= 0.3 ? 0.8 : 1)); }
    // drums: Duskhold always (softly), a dungeon when you fight
    if (fight) { const dv = T.town && I <= 0.3 ? 0.55 : Math.min(1, 0.6 + I * 0.5);
      for (let i = 0; i < 16; i++) { const t = t0 + i * step, w = t - c.currentTime;
        const kk = (T.k || '')[i], ss = (T.s || '')[i], hh = (T.h || '')[i];
        if (kk === 'x' || kk === 'o') hitDrum(c, t, 150, 42, (kk === 'x' ? 0.22 : 0.12) * dv, 0.32);
        if (ss === 'x' || ss === 'o') { noise(0.16, (ss === 'x' ? 0.13 : 0.07) * dv, 1900, w, 0.9, 'bandpass', 900, musG); hitDrum(c, t, 210, 140, 0.05 * dv, 0.1); }
        if (hh === 'x' || hh === 'o') noise(0.035, (hh === 'x' ? 0.045 : 0.025) * dv, 8000, w, 1, 'highpass', 0, musG); } }
    // the boss layer: a low brass ostinato and a choir that swells
    if (A.boss) { const beat = step * 2; for (let i = 0; i < 8; i += 2) { const t = t0 + i * beat; for (const det of [-5, 5]) { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = NOTE(chord[0] - 12 + (i === 6 ? 1 : 0)); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.08); f.frequency.exponentialRampToValueAtTime(400, t + beat * 1.5);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.8); o.connect(f); f.connect(g); g.connect(musG); o.start(t); o.stop(t + beat * 2); } }
      for (const n of [chord[0], chord[2]]) { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 4;   // an 'aah'
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + step * 6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + step * 16); o.connect(f); f.connect(g); g.connect(musG); o.start(t0); o.stop(t0 + step * 16.2); } }
    nextBar += step * 16; bar++;
  }
  // short musical stingers for big moments (over the music, not instead of it)
  A.sting = k => { if (!A.ctx || A.music <= 0) return; const T = TH[A.zone] || TH.hub, r = T.root + 12, sc = SC[T.scale] || SC.minor;
    const seq = { clear: [0, 4, 7, 12], boss: [0, 1, 0, -5], death: [7, 3, 0, -12], rank: [0, 7, 12], floor: [0, 4, 7] }[k] || [0, 7];
    seq.forEach((n, i) => tone(NOTE(r + (sc.includes(((n % 12) + 12) % 12) ? n : n - 1)), 0.9, k === 'boss' || k === 'death' ? 'sawtooth' : 'triangle', 0.05, i * 0.13, musG, 0, 0.02, 1600)); };
  // ---------- ambience: a bed of filtered noise per place (wind, water, lava, machinery) plus small sounds now and then
  const AMB_OF = MU.AMB || { hub: 'town' };
  const AMBK = { town: [500, 0.6, 0.05, 'lowpass'], wind: [700, 1.2, 0.08, 'bandpass'], sand: [2600, 0.8, 0.05, 'bandpass'], drip: [300, 0.7, 0.05, 'lowpass'], lava: [160, 0.8, 0.12, 'lowpass'], storm: [400, 1, 0.1, 'lowpass'],
    hum: [120, 3, 0.07, 'bandpass'], water: [500, 0.8, 0.09, 'lowpass'], clock: [250, 1, 0.05, 'lowpass'], space: [1800, 2, 0.04, 'bandpass'] };
  function setAmb(k) { if (!A.ctx) { A.ambK = k; return; } A.ambK = k; const c = A.ctx, P = AMBK[k] || AMBK.town;
    if (!amb) { const s2 = c.createBufferSource(); s2.buffer = noiseBuf; s2.loop = true; const f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.07; lg.gain.value = 0; lfo.connect(lg); lg.connect(f.frequency); s2.connect(f); f.connect(g); g.connect(ambG); g.gain.value = 0; s2.start(); lfo.start(); amb = { s: s2, f, g, lg }; }
    const t = c.currentTime; amb.f.type = P[3]; amb.f.frequency.setTargetAtTime(P[0], t, 0.8); amb.f.Q.setTargetAtTime(P[1], t, 0.8); amb.g.gain.setTargetAtTime(P[2], t, 1.2); amb.lg.gain.setTargetAtTime(P[0] * 0.45, t, 1); }
  function ambEvent() { if (!A.ctx || A.amb <= 0) return; const k = A.ambK, r = Math.random(), d = ambG;
    if (k === 'drip' || k === 'water') { if (r < 0.5) tone(NOTE(84 + (Math.random() * 10 | 0)), 0.18, 'sine', 0.05, 0, d, NOTE(96)); }
    else if (k === 'lava') { if (r < 0.4) noise(0.25, 0.12, 300, 0, 1, 'lowpass', 80, d); }
    else if (k === 'clock') { for (let i = 0; i < 4; i++) noise(0.03, 0.05, i % 2 ? 2600 : 3400, i * 0.5, 5, 'bandpass', 0, d); }
    else if (k === 'town') { if (r < 0.12) [0, 0.9].forEach(w => tone(NOTE(45), 2.6, 'sine', 0.05, w, d)); else if (r < 0.5) noise(0.05, 0.04, 2000, 0, 2, 'bandpass', 0, d); }
    else if (k === 'storm') { if (r < 0.08) S.thunder(); }
    else if (k === 'wind' || k === 'space') { if (r < 0.2) tone(NOTE(k === 'space' ? 91 : 79), 1.6, 'sine', 0.012, 0, d, NOTE(k === 'space' ? 86 : 74), 0.6); }
    else if (k === 'hum') { if (r < 0.3) tone(55 * (1 + (Math.random() * 3 | 0)), 2, 'sine', 0.025, 0, d, 0, 0.8); } }
  A.startMusic = function () {
    if (!init() || musicOn) return; musicOn = true; nextBar = A.ctx.currentTime + 0.3; setAmb(A.ambK || AMB_OF[A.zone] || 'town'); let ambT = 0;
    setInterval(() => { if (A.music > 0 && A.ctx.currentTime > nextBar - 1) scheduleBar(); else if (A.music <= 0) nextBar = A.ctx.currentTime + 0.2; if (++ambT % 6 === 0) ambEvent(); }, 300);
  };
  A.themes = Object.keys(TH);
  A.level = () => { if (!A.meter) return 0; const d = new Float32Array(A.meter.fftSize); A.meter.getFloatTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); return m; };
  A._bar = () => { if (A.ctx) { nextBar = Math.max(nextBar, A.ctx.currentTime + 0.05); scheduleBar(); } };
  root.SSAudio = A;
})(typeof self !== 'undefined' ? self : this);
