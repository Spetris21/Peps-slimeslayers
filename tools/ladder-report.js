// Update 7 · phase 2: the level ladder and loot odds of one build, as markdown tables (BALANCE.md uses them for before / after).
//   node tools/ladder-report.js [path/to/public] [minutes per clear = 6 | measured]
//   'measured' (Update 7): each step's own clear time, from the test bot running that dungeon on that difficulty on the new maps, solo, with
//   gear at the step's level (walking every hall), plus 1 minute between runs (results, the portal, the finder)
// Hours per step: a slayer always runs the hardest step their level allows (Normal clears only count the XP of the run itself:
// no gear bonuses, no party, no events). A step is one dungeon on one difficulty; the step ends when the next step opens.
const path = require('path'), DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', 'public')), MEAS = process.argv[3] === 'measured', MIN = MEAS ? 0 : +(process.argv[3] || 6);
const L = require(path.join(DIR, 'logic.js')), C = L.C;
const table = (title, head, rows) => { console.log('\n### ' + title + '\n\n| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|'); for (const r of rows) console.log('| ' + r.join(' | ') + ' |'); };
// every (dungeon, difficulty) step this build has, in level order (secret dungeons only if they are part of the ladder)
const steps = []; C.DUNGEONS.forEach((d, i) => { if (d.secret) return; for (let df = 0; df < C.DIFFS.length; df++) steps.push({ i, df, lv: L.dunLevel(i, df) }); });
steps.sort((a, b) => a.lv - b.lv || a.i - b.i);
const clearXp = (i, df) => L.clearXp ? L.clearXp(i, df, false) : L.runMobs(i, df, 1, false).reduce((a, m) => a + m.xp, 0) * C.DIFFS[df].xp * (1 + C.CLEAR_BONUS);
const rows = []; let tot = 0;
function measure(i, df) { const SD = require(path.join(DIR, 'dungeon.js')), bot = require(path.join(__dirname, '..', 'tests', 'bot.js')); let t = 0, n = 0;
  for (const seed of [11, 23]) { const s = bot.char('a', i % 2 ? 'mage' : 'warrior', L.dunLevel(i, df), 1, i), inst = SD.create({ mode: 'dungeon', i, df, hc: false, seed: seed + i * 7 + df, players: [{ id: 1, name: 'a', s }] }), r = bot.play(inst, { maxT: L.dunTime(df) });
    t += r.res === 'clear' ? r.t : L.dunTime(df); n++; } return t / n / 60 + 1; }
steps.forEach((st, k) => {
  const next = steps[k + 1] ? steps[k + 1].lv : C.MAX_LEVEL; let runs = 0;
  for (let lv = st.lv; lv < next; lv++) runs += L.xpNeed(lv) / clearXp(st.i, st.df);
  const per = MEAS ? measure(st.i, st.df) : MIN, h = runs * per / 60; tot += h; st.h = h; st.per = per;
  rows.push([k + 1, C.DUNGEONS[st.i].n, C.DIFFS[st.df].n, st.lv + ' → ' + next, Math.round(runs * 10) / 10].concat(MEAS ? [st.per.toFixed(1)] : [], [h.toFixed(2), tot.toFixed(1)]));
});
table('Hours per step (' + (MEAS ? 'measured minutes a clear' : MIN + ' minutes a clear') + ', max level ' + C.MAX_LEVEL + ')', ['Step', 'Dungeon', 'Difficulty', 'Levels', 'Clears'].concat(MEAS ? ['Min/clear'] : [], ['Hours', 'Total hours']), rows);
// per dungeon: the three steps together
const per = {}; for (const st of steps) per[st.i] = (per[st.i] || 0) + st.h;
table('Hours per dungeon (its Normal, Hard and Nightmare steps)', ['Dungeon', 'Opens at', 'Hours'], Object.keys(per).map(i => [C.DUNGEONS[i].n, 'Lv ' + C.DUNGEONS[i].lvl, per[i].toFixed(2)]));
// loot odds: the chance that one dropped item is Legendary or Ultimate (exact, from the build's own roll)
const odds = luck => { const n = 200000, c = new Array(C.GEAR_RARITY.length).fill(0); for (let j = 0; j < n; j++) { let used = false; const r = L.rollRarity(luck, () => { if (used) return 0.5; used = true; return (j + 0.5) / n; }); c[r]++; } return c.map(v => v / n); };
const pcts = v => (v * 100 >= 1 ? (v * 100).toFixed(2) : (v * 100).toFixed(3)) + '%';
const orows = [];
for (const [name, df, hc] of [['Normal', 0, false], ['Hard', 1, false], ['Nightmare', 2, false], ['Normal Hardcore', 0, true], ['Hard Hardcore', 1, true], ['Nightmare Hardcore', 2, true]]) {
  const luck = L.lootLuck(df, hc, 1), o = odds(luck), items = (C.DROPS.BOSS_ITEMS || 4) + (hc && L.dropsN ? L.dropsN(true) - L.dropsN(false) : 0);
  const perRun = k => 1 - Math.pow(1 - o[k], items);
  orows.push([name, 'x' + (+luck.toFixed(2)), pcts(o[3]), pcts(o[4]), pcts(o[5]), pcts(perRun(4)), pcts(perRun(5)), Math.round(1 / perRun(5))]);
}
table('Loot odds for one boss item (player luck 1)', ['Run', 'Loot luck', 'Epic', 'Legendary', 'Ultimate', 'Legendary in a run', 'Ultimate in a run', 'Runs per Ultimate'], orows);
