// Update 7 · phase 3: the damage YOU deal, from the game's own rules, along the whole ladder (for BALANCE.md before / after).
//   node tools/damage-model.js [path/to/public] [--json]
// A test slayer at each step: all six slots at the step's level minus 2 (an average drop), Rare, +3 upgrades, 75% of the stat points in the
// class stat and 25% in Vitality, the best abilities its level allows in every ability slot. Single-target damage per second against a boss:
//   basic = the weapon's full combo (the animation timings players feel), abilities = damage per cast / cooldown. (Update 7 final: no ultimates; gear is Power only.)
const path = require('path'), DIR = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..', 'public'));
const L = require(path.join(DIR, 'logic.js')), C = L.C, JSON_OUT = process.argv.includes('--json');
{ let a = 4242; Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }   // the same gear rolls every run
const table = (title, head, rows) => { console.log('\n### ' + title + '\n\n| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|'); for (const r of rows) console.log('| ' + r.join(' | ') + ' |'); };
const f1 = v => v >= 100 ? Math.round(v) : v.toFixed(1), pc = v => Math.round(v * 100) + '%';
// the combo timings (seconds per hit) of each weapon's animations (char.js); the server's gap rule can never beat them
const DUR = { sword: [0.42, 0.42, 0.36, 0.56], greatsword: [0.62 / 0.71, 0.62 / 0.71, 0.78 / 0.77], dagger: [0.24, 0.24, 0.3 / 1.45, 0.3 / 1.45, 0.44 / 1.25], hammer: [0.52 / 0.82, 0.54 / 0.8, 0.7 / 0.88], staff: [0.42, 0.42, 0.6] };
const steps = () => { const out = []; C.DUNGEONS.forEach((d, i) => { if (d.secret) return; for (let df = 0; df < 3; df++) out.push({ i, df, lv: L.dunLevel(i, df) }); }); return out.sort((a, b) => a.lv - b.lv); };
const gp = s => L.power ? L.power(s) : L.gearPower ? L.gearPower(s) : L.ap(s);   // Update 7 (final): Power; before that gear power, before Update 7 attack power
function slayer(cls, weapon, lv, i, o) {
  o = o || {}; const s = L.fresh('m'); s.level = lv; if (cls !== 'warrior') L.setClass(s, cls); const glv = Math.max(1, lv - (o.below === undefined ? 2 : o.below));
  for (const slot of C.SLOT_ORDER) { const it = L.makeItem(s, i, glv, { slot, rarity: o.r === undefined ? 2 : o.r }, Math.random); it.c = slot === 'r' ? '' : cls; it.k = slot === 'w' ? weapon : L.kindFor(cls, slot); it.up = o.up === undefined ? 3 : o.up; L.addItem(s, it); L.equip(s, it.u); }
  const pts = L.statPoints(s), main = C.CLASSES[cls].stat, k = o.main === undefined ? 0.75 : o.main; s.stats[main] = Math.round(pts * k); s.stats.vit = pts - s.stats[main];
  return s;
}
// one ability's single-target damage per cast (in units of the damage base it uses) and its utility (a damage buff) for the model
function perCast(sp) {
  if (!sp.mult) return 0; if (sp.tot) return sp.tot;   // (Update 7 final: every cast is worth sp.tot to each slime it reaches)
  const h = sp.k === 'spin' ? sp.ticks : sp.k === 'missiles' ? sp.count : sp.k === 'zone' ? sp.dur / sp.every * 0.8 : sp.k === 'summon' ? sp.dur / sp.every * 0.8 : sp.k === 'shower' ? sp.strikes * 0.35 : 1;
  return sp.mult * h * (sp.k === 'single' && sp.low ? 1 + (sp.low - 1) * 0.3 : 1);
}
function model(s, cls) {
  const ty = L.type(s), type = L.weaponType(s), M = C.MOVESETS[type], crit = 1 + Math.max(0, L.crit(s)) * (L.critMult(s) - 1), ap = L.ap(s), base = gp(s) * (1 + L.abil(s)), cdr = L.cdr(s);
  const cyc = DUR[type].reduce((a, b) => a + b, 0) / Math.min(2, L.speed(s) / ty.speed), basic = ap * M.combo.reduce((a, h) => a + h.m, 0) * ty.pow / cyc * crit;
  const slots = C.SPELL_SLOTS, list = C.SPELLS.filter(sp => sp.cls === cls && L.spellOk(s, sp)).map(sp => ({ sp, d: perCast(sp) * base * crit / Math.max(0.6, sp.cd * (1 - cdr)) })).sort((a, b) => b.d - a.d);
  const best = list.slice(0, slots), abil = best.reduce((a, q) => a + q.d, 0);
  return { ap, gp: gp(s), basic, abil, tot: basic + abil, best: best.map(q => q.sp.n || q.sp.id), crit };
}
const rows = [], json = [];
for (const st of steps()) { if (st.df !== 0 && st !== steps()[steps().length - 1] && st.df !== 2) continue;
  for (const [cls, wpn] of [['warrior', 'sword'], ['mage', 'staff']]) { const s = slayer(cls, wpn, st.lv, st.i), m = model(s, cls), b = L.mobStats(st.i, C.DUNGEONS[st.i].boss, st.df, 1, 'boss'), mob = L.mobStats(st.i, C.DUNGEONS[st.i].mobs[0], st.df, 1, 'mob');
    rows.push([C.DUNGEONS[st.i].n + ' ' + C.DIFFS[st.df].n[0], st.lv, C.CLASSES[cls].n, f1(m.tot), pc(m.basic / m.tot), pc(m.abil / m.tot), f1(b.hp / m.tot) + ' s', f1(mob.hp / m.tot) + ' s', m.best.join(', ')]);
    json.push({ step: st, cls, m, boss: b.hp, mob: mob.hp }); } }
if (JSON_OUT) { console.log(JSON.stringify(json)); process.exit(0); }
table('Damage you deal along the ladder (single target, per second; N/H/N = difficulty)', ['Step', 'Level', 'Class', 'Damage/s', 'Basic', 'Abilities', 'Boss alone', 'A slime', 'Abilities used'], rows);
// builds: is any build or weapon far ahead (or behind) of the others at the same step?
const bst = steps().find(x => x.i === 6 && x.df === 1), B = [];
const build = (name, cls, wpn, o) => { const s = slayer(cls, wpn, bst.lv, bst.i, o), m = model(s, cls); return { name, m }; };
const builds = [build('Warrior · sword (the test slayer)', 'warrior', 'sword'), build('Warrior · greatsword', 'warrior', 'greatsword'), build('Warrior · hammer', 'warrior', 'hammer'), build('Warrior · daggers', 'warrior', 'dagger'),
  build('Mage · staff', 'mage', 'staff'), build('Glass cannon: all Strength, Ultimate gear +10', 'warrior', 'sword', { main: 1, r: 5, up: 10 }),
  build('Strong: Legendary +6', 'warrior', 'sword', { r: 4, up: 6 }), build('Tank: all Vitality, Rare +3', 'warrior', 'sword', { main: 0 }), build('Fresh to the step: gear 5 levels behind, Common', 'warrior', 'sword', { below: 5, r: 0, up: 0 })];
const ref = builds[0].m.tot; for (const q of builds) B.push([q.name, f1(q.m.tot), (q.m.tot / ref).toFixed(2) + 'x', pc(q.m.basic / q.m.tot), pc(q.m.abil / q.m.tot)]);
table('Builds at ' + C.DUNGEONS[bst.i].n + ' ' + C.DIFFS[bst.df].n + ' (level ' + bst.lv + '): damage per second next to the test slayer', ['Build', 'Damage/s', 'vs test slayer', 'Basic', 'Abilities'], B);
