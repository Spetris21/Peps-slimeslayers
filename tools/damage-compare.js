// Before / after tables for the Update 7 damage balance (phase 3), from tools/damage-model.js run on two builds.
//   node tools/damage-compare.js path/to/old/public [path/to/new/public]
const path = require('path'), { execFileSync } = require('child_process');
const run = (dir, flag) => execFileSync(process.execPath, [path.join(__dirname, 'damage-model.js'), path.resolve(dir), flag].filter(Boolean)).toString();
const A = JSON.parse(run(process.argv[2], '--json')), B = JSON.parse(run(process.argv[3] || path.join(__dirname, '..', 'public'), '--json'));
const pc = v => Math.round(v * 100) + '%', f1 = v => v.toFixed(1);
const key = r => r.step.i + ':' + r.step.df + ':' + r.cls, am = {}; for (const r of A) am[key(r)] = r;
console.log('\n### Damage you deal along the ladder, before → after (the test slayer: on-level Rare +3 gear, best abilities its level allows)\n');
console.log('| Step | Class | Boss alone (pure damage) | Basic attacks | Abilities | Ultimate | Abilities used (after) |\n|---|---|---|---|---|---|---|');
for (const r of B) { const o = am[key(r)], m = r.m, n = (r.step.i < 12 ? ['Mossy Woods', 'Desert Temple', 'Sunken Crypt', 'Frost Peaks', 'Ember Forge', 'Storm Spire', 'Void Citadel', 'Abyssal Void', 'Glitch Realm', 'Drowned Cathedral', 'Clockwork Spire', 'Hollow Moon'][r.step.i] : '') + ' ' + ['Normal', 'Hard', 'Nightmare'][r.step.df];
  const t = x => x ? f1(x.boss / x.m.tot) + ' s' : '–', sh = (x, k) => x ? pc(x.m[k] / x.m.tot) : '–';
  console.log(`| ${n} (Lv ${r.step.lv}) | ${r.cls === 'mage' ? 'Mage' : 'Warrior'} | ${t(o)} → ${t(r)} | ${sh(o, 'basic')} → ${sh(r, 'basic')} | ${sh(o, 'abil')} → ${sh(r, 'abil')} | ${sh(o, 'ult')} → ${sh(r, 'ult')} | ${m.best.join(', ')} |`); }
const bt = s => s.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| Build') && /x \|/.test(l)).map(l => l.split('|').map(c => c.trim()));
const ta = bt(run(process.argv[2])), tb = bt(run(process.argv[3] || path.join(__dirname, '..', 'public')));
console.log('\n### Builds at the Void Citadel on Hard, before → after (damage next to the test slayer at the same step)\n');
console.log('| Build | Before | After |\n|---|---|---|'); tb.forEach((r, k) => console.log(`| ${r[1]} | ${ta[k] ? ta[k][3] : '–'} | ${r[3]} |`));
