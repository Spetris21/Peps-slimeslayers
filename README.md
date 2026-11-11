# Slime Slayers

A multiplayer dark fantasy dungeon crawler in the browser, inspired by Dungeon Quest: team up, clear dungeons, level up, unlock harder
dungeons with rarer gear. Roblox-style blocky characters, custom WebGL engine.
Owners: Parker & Wolfie. School project — remember to only play at home!

## Play
- **With the server (accounts, matchmaking, parties, trading, leaderboards, raids):** install Node 18+, then in this folder run `npm install`
  and `npm start`, and open http://localhost:3000. Friends on the same network join with your computer's address, e.g. http://192.168.1.20:3000.
- **On a website:** see **HOSTING.md** (a Node.js host with WebSockets, a disk that keeps `data/`, the settings).
- **Offline:** double-click `SlimeSlayers-offline.html` (guest mode, solo dungeons, saved on that device).
- **Character Lab:** `SlimeSlayers-CharacterLab.html` (every look, animation, emote and face).
- Add `?q=low` to the address to force Low graphics (smooth on school laptops). Settings → Graphics also has Low/Medium/High/Auto.

## Controls
WASD move · drag with the right mouse (or Shift for shift-lock mouse-look) to turn the camera · scroll to zoom · **click to attack** (every weapon
has its own 4-hit combo; **hold** the button to keep swinging) · **Q** and **E** your two abilities · **X** dodge roll (you can't be hit while
rolling: roll through red circles) · **Space** jump, twice for a double jump · **V** parry · **F** use (in town **Q** / **E** work too when you stand
in a station's glowing circle) · **M** dungeons · **I** inventory · **C** character · **K** abilities · **G** emotes · **T** ping · **O** photo mode
· **Enter** chat · **Esc** menu. Every key can be changed in Menu → Controls. Touch screens get a joystick and buttons; controllers work too.

## How it plays
- **Duskhold** is the lobby town on a green hillside: the square with the slayer statue, the **Grand Gate** up the great stairs (all twelve
  dungeon portals), the **Blacksmith** (upgrade, salvage and buy gear), the **Shop** (chests and skins), the **Rewards** board (Battle Pass and
  milestones), the **Daily Gift**, **The Pit** and the **Hall of Slayers** (leaderboards and duels) across the river. Walk into a station's
  glowing circle and press **F** (or Q / E).
- **Walk into a portal** to open the dungeon finder: pick Normal / Hard / Nightmare (each needs a level), turn on **Hardcore** (one life,
  more luck, more XP), then **Play solo**, **Quick match** or **Create party** (public or friends only, up to 4). Every slime, mini-boss and
  boss has **x1.5 health for each player who joins** (2 players x1.5, 3 x2.25, 4 x3.4), and everyone gets the full rewards. The finder also has **The Pit** (waves), the **Endless Tower**, **the Wilds** and **Boss Raids**.
- **Twelve dungeons**: Mossy Woods (Lv 1), Desert Temple (15), Sunken Crypt (30), Frost Peaks (45), Ember Forge (60), Storm Spire (75),
  Void Citadel (90), Abyssal Void (105), the secret Glitch Realm (120, opens when you find the 8 relics hidden in the other dungeons),
  Drowned Cathedral (135), Clockwork Spire (150) and Hollow Moon (165). Every dungeon and difficulty is one 5-level step; max level 180.
  Every dungeon is a big map of its own (streets, bridges, cliffs, a landmark beside every boss) with its own slimes, music and two mini-bosses.
- **The dungeon clock**: Normal **12 minutes**, Hard **14**, Nightmare **16** (big timer at the top). Every death takes 10 seconds off. When it
  hits zero the run ends and the boss loot is gone (you are still paid for the rooms you cleared).
- **Bosses and mini-bosses fight their own way** (147 named moves, three boss phases; all written out in MOVESETS.md). Every attack is drawn
  on the floor first and a tip under the boss bar says what to do. Bosses are solid: keep moving.
- **Loot only comes from the final boss**: 4 random items for every player. Six rarities: Common (grey) → Uncommon (green) → Rare (blue) →
  Epic (purple) → Legendary (gold) → Ultimate (red, rarest). **Gear only has Power** (no confusing percentage bonuses): the rarer, the higher
  the level and the more upgrades, the more Power. Your health comes from your level, your class and Vitality.
- **Abilities do the real damage.** Each dungeon unlocks new Warrior and Mage abilities (2 per class, 4 in the dungeons that also teach a
  support ability such as War Cry or Iron Skin), and each dungeon's abilities are 10% stronger than the last. They scale with your gear's
  Power, your stat points and your weapon. Single-target abilities hit bosses, mini-bosses and elites 50% harder. Swinging your weapon is
  the backup.
- **The Mage heals the squad**: Mending Light (from Desert Temple) and Healing Light (from Void Citadel) heal everyone in the circle.
  There are no potions, no regeneration in fights and no life steal.
- **Character (C)**: 2 stat points per level into Power (Warrior), Spell Power (Mage) or Vitality. **Swap class** (Warrior ↔ Mage) with one
  button anywhere in town; the right weapon and armour go on by themselves.
- **The Blacksmith**: pick a piece of gear, see its price, its upgrades (x / 10) and its Power, then **Upgrade**, **Upgrade 10x** or
  **Spend all** (upgrades the gear you wear, cheapest first). It shows how much gold is left to max a piece and its Power when maxed, with search
  and sort. **Salvage** spare gear into **dust**, raise an item's rarity with dust and gold, or buy plain gear for any dungeon you can enter.
- **The Shop**: three chests paid with dust: **Common** (40), **Rare** (150) and **Legendary** (500, the best odds). All hold the same 32 skins:
  troll costumes (Banana Suit, Chicken Suit, Pool Duck...), silly weapons (Frying Pan, Baguette, Plunger, Rubber Chicken...) and epic gear
  (Dragonscale Plate, Void Knight, Crystal Greatsword, Void Reaper, Dawnbreaker...). A skin only changes how your armour or weapon looks:
  you keep wearing your real gear and all its Power. A duplicate gives dust back.
- **The Daily Gift**: once a day, 4 random drops from the highest dungeon and difficulty your level can enter.
- **Boss Raids**: clear a dungeon on Hard to open its raid: one empowered boss with a third frenzy phase, nobody respawns. A win pays an
  exclusive Epic-or-better raid ring and, the first time (then rarely), a raid-only cloak colour or weapon trail.
- **Also**: the Battle Pass (30 tiers, runs give pass XP), milestones and titles, the bestiary, duels, trading, leaderboards, and events every
  30 minutes (2x Gold, the World Boss Raid, Lucky Loot).
- **Fair**: nothing can be bought with real money and nothing is pay-to-win. The server checks every reward, gate, position and price.

## Update 7 · final version

- **Hits always register**: a swing or ability that reaches the server a moment early (the simulation's 20 steps a second, a
  laggy connection) now waits for its turn instead of being thrown away; each swing picks its targets when it is sent, a slime right
  beside you counts, and getting hit shoves you less far, so you stay in reach to hit back. (Sending only first hits, which was faster
  than the real combo, no longer works.)
- **Ready for a website**: up to 4 players per run, x1.5 enemy health per player who joins, gzipped pages, connection limits, other
  websites can't connect, one broken run can't stop the server. See HOSTING.md.

- **Tougher fights**: slimes have 1.4x health, mini-bosses 2.5x and bosses 2x. Clear times were re-tuned so every dungeon still fits its clock
  (see BALANCE.md), and Hard / Nightmare get 14 / 16 minutes.
- **The floor-wide blast with two safe spots** waits longer before it goes off, so there is time to reach the green circle.
- **Abilities remade**: every dungeon's abilities are useful (10% stronger per dungeon, scaling with Power, stats and weapon); new damage
  abilities where a dungeon only had a buff (Frost Cleaver, Glacier Smash, Void Rend, Rift Strike, Glitch Slash, Bit Crusher; Frost Comet,
  Hailstorm, Void Bolt, Nether Nova); the Mage heals the squad. Basic attacks do a third of the damage they did.
- **Removed**: ultimates, heavy / dash / air attacks (holding the attack just keeps swinging), the Class Trainer (now a **Swap class** button),
  the Enchanter and runes, rerolls, percentage bonuses on gear, daily quests and weekly challenges. Each is gone from the menus, settings, keys,
  HUD and server too. Old saves are migrated: every rune pays 20 dust, gear keeps its level, rarity, upgrades and Power.
- **The Forge is now the Blacksmith** (Upgrade, Upgrade 10x, Spend all, search and sort), **Cosmetics are now the Shop** (three dust chests,
  32 skins that only change looks), and the Daily Gift gives 4 drops from your best dungeon.
- **Sound**: new lobby music, every dungeon has its own soundtrack, new sword swing and hit sounds, a sound per ability element and for heals.
- **Fixes**: weapon skins show their real colours (a dark frying pan, a red plunger), a click during a dodge roll swings as the roll ends, Q / E work at the gift chest and the Blacksmith in town, ability names no longer cover their keys, bigger slimes, more decoration
  and distant views, the holes in the dungeon floors are fixed, the run HUD and the Hall of Slayers sign no longer overlap, nothing fades out
  of view any more, and several server security fixes (bad web addresses, special account names, trading stored items, teleporting in runs).

## Update 7 · the whole game, remade

(Some of this changed again in the final version above.)

- **No more Gem Shop, pets or talents.** Old saves load and are paid in gold for what was removed (the exact table is in BALANCE.md).
- **One level ladder**: every dungeon and difficulty is one 5-level step (Mossy Woods Normal 1, Hard 5, Nightmare 10, Desert Temple Normal 15 ...),
  36 steps, max level 180. Hardcore is the same level; loot is never above the run's level; Legendary and Ultimate are rarer.
- **Abilities**: each dungeon unlocks 2 Warrior and 2 Mage abilities on **Q** and **E**; they hit with your gear power, 15% stronger per dungeon.
- **New look**: brighter colours, day and dusk skies, outlines, glowing gear edges, chunky trees and rocks (Low graphics is no slower).
- **Duskhold is a green hillside town**: a river with a rope bridge and a stone bridge, houses on hill terraces, the Enchanter's round tower,
  every station a real building, and the **Grand Gate** up the great stairs with all twelve dungeon portals.
- **Every dungeon is a full map**, at least 3x bigger: streets lined with houses, bridges over water, lava, chasms, the sky and the void,
  open cliff edges, and a landmark beside every boss. The dungeon clock is now **12 minutes**.
- **Bosses and mini-bosses fight their own way**: 147 named moves, each one belongs to one boss or mini-boss, with its own wind-up pose and
  telegraph; bosses have three phases. Every dungeon has two different mini-bosses. Each dungeon's slimes move in their own style.
  All of them are written out in **MOVESETS.md**.
- **Armour**: twelve sets (one per dungeon) built on a layered plate: finned square pauldrons, a glowing V of trim and gem, banded arms,
  studded thighs; the better the rarity, the brighter it glows. Try them all in the Character Lab.
- **New HUD and screens**: a big timer at the top (with a HARDCORE tag), an HP / EXP plate, big Q / E slots with cooldowns; in town
  **Play**, **Inventory** and **Cosmetics** buttons plus **Swap** (back to your other weapon) and **Shift-lock**. The Inventory has side tabs
  **Gear / Skills / Storage** (Storage keeps up to 120 items out of your bag).

## Update 6 (all nine phases done)
- **A whole new look**: a new renderer with HDR lighting, bloom on glowing things, colour grading per dungeon, vignette, film grain, soft stable
  shadows, ambient occlusion (High), wet floors that reflect torches (crypt), frost sparkle, lava that flows and glows, glowing seams in the Ember
  floor, veins in the Abyss walls, circuits in the Glitch Realm, bumpy stone, a sky for every place (storm clouds, aurora, nebula, blood moon,
  ash, a glitched sky), drifting fog, moonbeams with dust, swinging chains, dripping water, bubbling pools, flapping banners, footstep dust.
  **See-through walls**: a wall between the camera and you is cut away so you never lose your character. Danger circles and lanes have a bright
  edge and a fill that charges up (colour-blind option in Settings). Settings has a switch for every effect, plus screen shake Full/Low/Off and text size.
  Low graphics is as fast as before (it uses a lean shader); Auto picks the level that keeps 50+ fps.
- **Real monsters**: every slime, elite, mini-boss and boss has its own body built from moving parts (beasts, knights, ghosts, serpents, swarms,
  golems...), its own walk, wind-up, attack, hurt and death (ice shatters, fire turns to ash, the dead fall to bones, glitches break into pixels).
  Bosses change shape in phase 2 (the Treant's canopy burns, the Pharaoh's coffin opens, the Titan's armour falls off, the Abyssal Lord opens more
  eyes). Slimes fight differently: spitters, chargers, flyers, burrowers (can't be hit underground), shielded ones (hit them from behind),
  splitters, healers, summoners, bombers (kill them before the fuse ends) and blinkers. Elites can be Fast, Shielded, Vampiric, Explosive or Frenzied.
- **A real moveset**: every weapon has its own combo (sword 4 hits ending in a spin, twin daggers 5, greatsword/hammer/staff 3), a held **heavy
  attack** (hold click or V; a hammer slams the ground, a staff fires a beam), a **dash attack** (attack straight out of a dodge) and an **air slam**
  (attack while jumping). **Parry** (F) just before a hit: no damage, the slime is stunned and your next hit crits. A **perfect dodge** slows time.
  Abilities cancel the end of a swing. A **style rank** (D, C, B, A, S, SS, SSS) climbs as you mix moves and drops when you get hit; your best rank
  adds up to +12% gold and XP. An **ultimate meter** fills as you fight: press R for your class's ultimate (2-3 per class, picked in the Abilities
  book) with a short cinematic camera (can be turned off).
- **Two new classes**: the **Shadowblade** (rogue: twin daggers, stealth, huge hits from behind) and the **Guardian** (paladin: hammer and shield,
  stuns, party auras). Each has 12 abilities, starter gear, its own moveset and ultimates.
- **Talents**: a point every 4 levels, three branches of six per class (e.g. Carnage / Earthshaker / Juggernaut), changing how abilities work.
  Ability combos: freeze then hit = Shatter, fire on a pulled slime = Ignite, mark then Execute.
- **Controls**: every key can be changed in Settings → Controls. Controllers work (A jump, B dodge, X attack / hold for heavy, Y interact,
  LB parry, RB ultimate, LT/RT and D-pad abilities). The server checks every move (order of combo hits, charge time, dodge before a dash attack,
  jump before an air slam, a full meter for the ultimate) and drops message spam.
- **Three new worlds** past the Abyss, each with its own mechanic, creatures, mini-bosses, boss and gear: the **Drowned Cathedral**
  (level 120: the tide floods rooms, climb onto the glowing daises), the **Clockwork Spire** (level 133: spinning clockwork blades to jump)
  and the **Hollow Moon** (level 146: low gravity and falling stars). Their gear has new weapon powers (Undertow, Escapement, Moonfall) and set
  bonuses (Tideward, Perfect Timing, Lunar Grace). Max level is now 150.
- **The Wilds**: an open overworld west of town (through the new **Wildgate Market**). Camps of slimes wake as you come near and come back
  later; you are paid for every camp when you leave. Five hidden **wayshrines** (title: Pathfinder) and the three **Far Gates** to the new
  worlds. Every dungeon also hides a **lost lantern** (title: Lamplighter); the Lamplighter's tower in the market lights one for each you find.

- **More to do**: the **Endless Tower** (floor after floor of slimes from every world you have reached; from floor 3 a **mutator** twists every
  floor: Haste, Volatile, Bloodthirst, Ironhide, Frenzy, Glass Cannon, Giants, Swarm; a mini-boss every 5 floors, a boss every 10).
  **Weekly challenges** (five a week, the same for everyone) and a free **Battle Pass** (30 tiers of gold, gems, dust, titles, a trail and a
  cloak; no real money anywhere). **World boss raids** in Duskhold now rotate between five bosses. **Duels**: challenge another slayer from the
  Hall of Slayers; one on one in the arena with the same health and fixed damage, weapons only, first to 3 knock-outs. **Crafting** at the
  Forge: salvage gear into dust, reroll one bonus, raise an item's rarity (up to Legendary). **Pets 2.0**: pets evolve at levels 10/20/30
  (Awakened, Ascended, Mythic: bigger, glowing and stronger) and you can feed them gold. The **bestiary** pays gems for every finished world.
  Parties get **+5% XP for every other slayer**, and **T** pings a spot for your party. **Photo mode** (O): no HUD, orbit and zoom the camera,
  six filters, Space saves a picture. New players get a short **tutorial** (skip any time). Tower and duel leaderboards, 14 new milestones.

- **A rebuilt UI**: one look for every screen (obsidian panels with forged-bronze corners, one accent colour per screen, underlined tabs,
  calmer metal buttons, a darker HUD and menu dock). A **screen bar** at the top of every menu jumps between Inventory, Character, Abilities,
  Pets, Quests, Profile, Hall of Slayers, Gem Shop and Menu. The **Inventory** has your slayer in **3D** in the middle of the gear you wear
  (drag to turn, click to swing, scroll to zoom); the **Character** screen shows it too, with your power at a glance. Results open with
  four big tiles (time, kills, damage, best style). The Menu has tabs: Graphics, Sound, Gameplay, Controls, Account.

- **New sound**: every world has its own music (its own key, scale, tempo and instruments: a dorian forest, a phrygian desert, a
  glassy frost, ticking clockwork, an airy moon...), drums come in when you fight and a **boss layer** (low brass and a choir) joins boss
  fights. **Ambience** under the music (town bells and fires, wind, dripping water, lava, the hum of the void, clockwork, space). Sounds are
  **placed in the world**: slime deaths, spit, shockwaves, blades and falling stars are louder when close and come from the left or right.
  Footsteps change with the ground (stone, grass, sand, snow, metal, water). Short musical **stingers** for a clear, a boss, a death, an S rank
  and a Tower floor. New effects for heavies, slams, stealth, the tide, mutators, knock-outs, crafting, evolutions, pings and photos. Menu →
  Sound has an **Ambience** volume, and the sound pauses when the game's tab is hidden.

- **Balance pass** (all numbers and before/after tables in `BALANCE.md`): no more 9-hour wall after the Abyssal Void (the new worlds
  are now level 108 / 122 / 136); duels are fair for every weapon (each knocks out in about 6 seconds, daggers still win from behind);
  greatswords hit a little harder and hammers a little softer; Warrior abilities slightly down, Mage and Shadowblade slightly up; the Pit,
  the Tower and the Wilds now pay the same share of a dungeon at every level (about 91%, 92% and 55%); the Battle Pass takes about 4½ weeks
  at 5 hours a week.

- **Polish and fixes**: the tutorial no longer blocks clicks on the menu on smaller screens (and it shows your own keys if you changed
  them); photo mode has on-screen buttons (Filter, Save picture, Leave) for touch screens; old saves keep their Battle Pass tier; duel
  results no longer show a dungeon clock; Vitality's description shows a tidy number; on Low graphics the world behind a full menu is drawn
  at a third of the rate so menus (and the 3D preview) stay smooth; the minimap redraws 20-30 times a second instead of every frame, and
  the Wilds now show their minimap (it was left blank).

## For developers
- All balance numbers and content: `public/config.js` (change a number, reload). Rules shared by the server and offline guests: `public/logic.js`.
- `public/dungeon.js` is the dungeon simulation (slime AI, bosses, damage, rooms, waves). The server runs it for every party at 20 ticks a second and
  streams events + snapshots; offline guests run the same code in the page. The client only sends movement and attack requests; the server works out
  every hit (reach checks, cooldowns, attack speed, movement speed), pays rewards, and refuses impossibly fast clears.
- Tests: `npm test` (rules + simulation + server). Browser: `node tests/browser-play.js` (real server, real pages: matchmaking, runs, offline build),
  `node tests/lab-buttons.js`, `node tests/moveset-play.js out` (combat through real mouse, keys and a fake controller),
  `node tests/pose-shots.js out` (attack poses), screenshot tour + emote check `node tests/game-shots.js shots`, a full dungeon played with real keyboard and mouse
  input `node tests/real-play.js` (slow: ~20 minutes in the test browser). Pacing simulation: `npm run sim` (add a number for a party size).
- All the browser tests in a row (each into its own log, PASS only when the test says so): `tools/run-browser-tests.sh out hit-reg u7-saves u7-ui ...`
  (`hit-reg` holds the attack next to slimes that stand still and that attack you, and checks every swing registers).
  Balance tools: `node tools/damage-model.js`, `node tools/clear-times.js`, `node tools/ladder-report.js public measured` (see BALANCE.md).
- Build the single files: `node tools/build-offline.js`.
