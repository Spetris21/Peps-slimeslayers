// Update 7 · how long a run takes on each dungeon map: a geared test slayer (the test bot, its gear at the step's level) on Normal, Hard and
// Nightmare, solo, against the dungeon clock. Walking is included (the bot walks every hall). node tools/clear-times.js [path/to/public]
const path = require('path'), DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', 'public'));
const L = require(path.join(DIR, 'logic.js')), C = L.C, SD = require(path.join(DIR, 'dungeon.js')), bot = require(path.join(__dirname, '..', 'tests', 'bot.js'));
const rows = [];
for (let i = 0; i < L.ND; i++) { const r = [C.DUNGEONS[i].n];
  for (let df = 0; df < 3; df++) { const lv = L.dunLevel(i, df), s = bot.char('a', i % 2 ? 'mage' : 'warrior', lv, 1, i);
    const inst = SD.create({ mode: 'dungeon', i, df, hc: false, seed: 300 + i * 7 + df, players: [{ id: 1, name: 'a', s }] }), res = bot.play(inst, { maxT: L.dunTime(df) });
    r.push(res.res === 'clear' ? Math.round(res.t / 6) / 10 + ' min' : res.res); }
  const lay = L.W.layout(i); r.push(lay.rooms.length); rows.push(r); }
console.log('| Dungeon | Normal | Hard | Nightmare | Rooms |\n|---|---|---|---|---|'); for (const r of rows) console.log('| ' + r.join(' | ') + ' |');
console.log('\n(clock: ' + [0, 1, 2].map(df => L.dunTime(df) / 60).join(' / ') + ' minutes on Normal / Hard / Nightmare)');
