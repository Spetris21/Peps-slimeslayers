// Before / after tables for the Update 7 ladder: hours per step and loot odds of two builds side by side.
//   node tools/ladder-compare.js path/to/old/public [path/to/new/public] [minutes per clear = 6]
const path = require('path');
const load = d => { const L = require(path.join(path.resolve(d), 'logic.js')); return { L, C: L.C }; };
const A = load(process.argv[2]), B = load(process.argv[3] || path.join(__dirname, '..', 'public')), MIN = +(process.argv[4] || 6);
const table = (title, head, rows) => { console.log('\n### ' + title + '\n\n| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|'); for (const r of rows) console.log('| ' + r.join(' | ') + ' |'); };
function steps({ L, C }) {
  const out = []; C.DUNGEONS.forEach((d, i) => { if (d.secret) return; for (let df = 0; df < 3; df++) out.push({ i, df, lv: L.dunLevel(i, df) }); }); out.sort((a, b) => a.lv - b.lv || a.i - b.i);
  const xp = (i, df) => L.clearXp ? L.clearXp(i, df, false) : L.runMobs(i, df, 1, false).reduce((a, m) => a + m.xp, 0) * C.DIFFS[df].xp * (1 + C.CLEAR_BONUS);
  out.forEach((st, k) => { const next = out[k + 1] ? out[k + 1].lv : C.MAX_LEVEL; let runs = 0; for (let lv = st.lv; lv < next; lv++) runs += L.xpNeed(lv) / xp(st.i, st.df); st.to = next; st.h = runs * MIN / 60; });
  return out;
}
const a = steps(A), b = steps(B), key = st => st.i + ':' + st.df, am = {}; for (const st of a) am[key(st)] = st;
let ta = 0, tb = 0; const rows = [];
for (const st of b) { const o = am[key(st)]; ta += o ? o.h : 0; tb += st.h;
  rows.push([B.C.DUNGEONS[st.i].n + ' · ' + B.C.DIFFS[st.df].n, o ? o.lv + ' → ' + o.to : '(secret, off the ladder)', o ? o.h.toFixed(2) : '–', st.lv + ' → ' + st.to, st.h.toFixed(2), (o ? ta.toFixed(1) : ta.toFixed(1)) + ' / ' + tb.toFixed(1)]); }
table('Hours per step, before → after (' + MIN + ' min a clear, the hardest step your level allows)', ['Step', 'Levels before', 'Hours before', 'Levels after', 'Hours after', 'Total hours before / after'], rows);
const per = (s, C) => { const o = {}; for (const st of s) o[st.i] = (o[st.i] || 0) + st.h; return o; }, pa = per(a), pb = per(b);
table('Hours per dungeon, before → after', ['Dungeon', 'Before', 'After'], B.C.DUNGEONS.map((d, i) => [d.n, pa[i] !== undefined ? pa[i].toFixed(2) + ' h (Lv ' + A.C.DUNGEONS[i].lvl + ')' : 'secret', pb[i].toFixed(2) + ' h (Lv ' + d.lvl + ')']));
// loot odds
const odds = ({ L, C }, luck) => { const n = 100000, c = new Array(C.GEAR_RARITY.length).fill(0); for (let j = 0; j < n; j++) { let u = false; c[L.rollRarity(luck, () => { if (u) return 0.5; u = true; return (j + 0.5) / n; })]++; } return c.map(v => v / n); };
const pc = v => (v * 100 >= 1 ? (v * 100).toFixed(2) : (v * 100).toFixed(3)) + '%';
const orow = []; for (const [nm, df, hc] of [['Normal', 0, false], ['Hard', 1, false], ['Nightmare', 2, false], ['Nightmare Hardcore', 2, true]]) {
  const oa = odds(A, A.L.lootLuck(df, hc, 1)), ob = odds(B, B.L.lootLuck(df, hc, 1)), na = A.C.DROPS.BOSS_ITEMS, nb = B.L.dropsN ? B.L.dropsN(hc) : B.C.DROPS.BOSS_ITEMS;
  const run = (o, k, n) => 1 - Math.pow(1 - o[k], n);
  orow.push([nm, pc(oa[4]) + ' → ' + pc(ob[4]), pc(oa[5]) + ' → ' + pc(ob[5]), Math.round(1 / run(oa, 4, na)) + ' → ' + Math.round(1 / run(ob, 4, nb)), Math.round(1 / run(oa, 5, na)) + ' → ' + Math.round(1 / run(ob, 5, nb))]); }
table('Loot odds, before → after (one boss item; runs needed on average, with every boss item you get)', ['Run', 'Legendary per item', 'Ultimate per item', 'Runs per Legendary', 'Runs per Ultimate'], orow);
