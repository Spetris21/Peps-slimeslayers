# Slime Slayers - build notes (read this first after a context reset)

User: Parker (teen, Sydney). Co-owner Wolfie. Wants a Roblox-style simulator, DARK FANTASY NIGHT mood (NOT shiny/babyish:
no pastel, no blush/cute faces, glow only on magic/weapons/eyes). Roblox blocky avatars (R15-style with elbows/knees) + detailed gear.
User said: "finish every phase till game is done" -> keep going phase after phase without waiting for approval; send screenshots + files after each phase.
Rules: all balance numbers in public/config.js; tests; offline single file + zip; Low quality must be smooth on school laptops;
credits "Owners: Parker & Wolfie" + "School project — remember to only play at home!". Never help bypass school filters.

## Tech
- Loop (Phase 3, Dungeon Quest style): Duskhold lobby -> portal -> dungeon finder (difficulty, Hardcore, solo / quick match / party) -> instanced run
  (5 rooms + boss + loot room, gates open per cleared room) -> results (XP, gold, gems, gear) -> next dungeon unlocks by level.
- public/config.js (SS_CONFIG, VERSION 2): everything tunable (classes, spells, gear rarities/tiers, mobs, 9 dungeons, difficulties, Hardcore, Pit, pets, eggs,
  events, quests, milestones, titles, looks). public/logic.js (SL): shared rules, layout W (hub STN, 8 portals arc r35 at -150..-30deg, dungeon i at DX=800(i+1),
  W.layout(i) rooms/halls/start/exit/relic, W.where), items, stats, rewards (runReward, pitReward, minClearTime), actions, pets, daily, milestones, looks.
- public/dungeon.js (SD): the simulation. SD.create/addPlayer/removePlayer/step/move (speed clamp)/dodge/attack (basic + 12 spells, reach-checked target lists)/
  snap/summary/takeEvents. Events: spawn dmg kill tele boom ring shot land bossIntro bossPhase hurt heal die respawn room wave fx done.
- server.js: accounts (scrypt), sessions, ACTIONS (v2), PARTIES/MATCHMAKING ('mm' create/solo/join/quick/leave/start/kick/set/list; solo parties dissolve
  after the run), INSTANCES (SD per party, 50 ms tick, 'dg' every 100 ms with events + snapshot + player hp + room states, 'dend' rewards with min clear time),
  raid, trading (pets + items), leaderboards (week = dungeon score, all = level, arena = Pit), weekly rewards. Test hooks: SS_TEST_RAID, SS_TEST_HOOKS ('test' msg).
- Client: game.js (RUN object: local SD for offline / server data online; combat -> attack requests; spells 1-4 with VFX; gates via WD.gateOpen; results),
  mobs.js (renderer + new feats, raid/rain in town), world.js (hub + 9 dungeon builders with theme kits + gates + Pit; WALL_H 3.6; camera-friendly colliders),
  ui.js (finder/lobby, results, backpack, character, spellbook, trainer, forge, enchanter, hatchery, pets, quests, shop, profile, boards, trade, avatar),
  char.js (plate/robe outfits + helm/hood overlay from gear), hatch.js (8 eggs, gold).
- Tests: tests/test-logic.js (45: rules + simulation + raids + loot/gear/pets/doorways/crates/traps/shrines, with tests/bot.js), test-server.js (26: matchmaking, runs, raids, anti-cheat, loot, crates), browser-play.js (10), real-play.js (a full dungeon with real keyboard + mouse input), lab-buttons.js (54),
  game-shots.js (tour + 11 emotes), sim.js (pacing: ~5h solo to 75). Run browser tests with NODE_PATH=/opt/npm-tools/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers.
  Swiftshader is ~1-2 fps: the local sim has App._debug.ff(secs) to fast-forward runs in tests.
- tools/build-offline.js -> SlimeSlayers-offline.html + SlimeSlayers-CharacterLab.html. Contact sheets: python3 /tmp/claude-0/sheet.py out.png cols width "title" file:label ...

## Phases
- [x] Phase 1: style + characters + lab.
- [x] Phase 2: server + logic + config, Duskhold, worlds, combat, slimes, bosses, pets, hatch, avatar, HUD, menus, tests, offline build.
- [x] Phase 3: Dungeon Quest conversion: 9 dungeons, matchmaking + parties, server-run simulation, classes + spells, gear rarities, stats, Hardcore, Pit, results.
- [x] Phase 4: Boss Raids (mode 'raid' in sim/server/finder; W.RAIDA arena at (-800,420); raid rings with x2 affix + unique names; raid cosmetics in s.cosm
      validated by L.validLook; phase 3 frenzy), L.fmt fix (100K showed as 1K), camera fixes (nocam arch pillars, prop collider heights), signs hide once passed,
      tests (rules 35, server 25, browser 10), screenshot tour with raids, final report.

- [x] Phase 5 (user feedback: "you can't actually play the dungeons"): found with a real keyboard+mouse playtest (tests/real-play.js) — the floor
      check had a 0.04-unit gap at every doorway where a straight walk got stuck forever (W.where hall reach now > room padding; test walks every
      door at 10 step sizes). Home portal moved off the camera line; minimap + gold floor arrows/marker to the next door; ?q= quality param;
      WebGL context loss handled; no sim moves during the loading fade. Loot drops in the sim (personal, rarity beams, pickup cards, auto-collect
      on room clear, SD.lootOf -> rewards), health potions, 6 gear slots (gloves/boots drawn on characters), bonus stats on all gear (L.affixes),
      Defense (L.defRed), move speed, starter helm+armour, new inventory (character preview, ▲▼ stat preview, recent drops, NEW badges). Pets:
      damage on a curve (C.PET_DPS/PET_CURVE), family bonuses (L.petBonus) and dungeon abilities (C.PET_FAM). Dungeons: point lights in the
      engine (torches/braziers/lava/crystals/portals/spells/loot), dimmer moonlight, braziers + banners + floor detail per theme, crates (gold,
      potions, gear), a treasure chest per run (20% Mimic), spike traps in the halls, a shrine per run (L.runFeat from the run seed).

- [x] Update 3 (user: inventory name + easier to see, lots more abilities, 4 random items only from the final boss, 12-minute clock with -10s per
      death, six rarities grey/green/blue/purple/gold/red, equipped gear hidden from the bag, no easy healing, ability-focused combat, a more
      colourful UI for 14-18 year olds, simpler inventory):
      config: GEAR_RARITY 6 tiers {n,c,w,m} + AFFIX_COUNT, DUN_TIME 720 / DEATH_PEN 10, DROPS.BOSS_ITEMS 4, TOME_CHANCE/TOME_HC, REGEN 0, no
      leech/regen affixes (AFFIX_RENAME), Arcana shrine (replaced Life), Focus rune (replaced Vampiric), wisp 'ward', bat 'drain' (no heal),
      33 SPELLS (12 warrior, 12 mage, 9 'any' tome abilities, each with col + d). Kinds: arc dash spin nova leap buff rage shield single line
      proj missiles chain zone pull summon mark shower heal meteor blink. logic: spellOk/spellHow/learn, s.learned, migrate rv:2 (rarity remap,
      affix rename, vamp->focus), L.bagN (bag = unequipped only; unequip any slot incl. weapon unless the bag is full), runReward learns tomes.
      dungeon.js: inst.limit/pen + 'time' result, SD.timeLeft, zones/summons/pull/mark, boss-only drops (tome replaces an item), crates/chest/
      Mimic pay gold only. server: dg.tl. Client: castSpell targeting per kind, P.dash, new fx (beam bolt zone vortex turret clone mark chains),
      events strike/zap/boom/blocked/ward, die.pen -> "-10s" popup; UI: canvas ability icons (UI.spellImg), ability bar (big, coloured, names),
      #timer (warn 3:00 / crit 1:00 + ticks), gold INVENTORY button (+ NEW count) and an Emotes button, panel accent colours (PANEL_COL), new
      inventory (equipped row, stat line, bag tabs with counts, one sort button, rarity key), Abilities book (class + secret sections, how to get),
      results (clock left, deaths, new abilities, time up), tome loot model. Tests: rules 51, server 26.

- [x] Update 4 (user: unique layouts, bigger/more detailed dungeons, slimes follow you everywhere, dimmer torches, unique boss move sets, difficulty curve,
      8-minute clock, inventory always coloured, balance pass)
      inventory: the real grey cause was `.bi.no{filter:grayscale}` (items you can't equip yet); now a thin red edge + red Lv badge, colours stay.
      layouts: C.LAYOUTS (one plan per dungeon: main rooms with k/w/d or r/dir/len/off/jog/waves/obst/haz + side rooms) -> W.layout builds rooms, halls
      (a->b, dir, ax, pa/pb doors), obstacles, hazards, spots, props, traps, relic, exit, bb. Overlaps throw. W.nav (next area + doorway), W.floorOk,
      W.hallOpen (gate rule incl. sealed boss/mini rooms), L.runFeat adds per-run side room kinds (vault/ambush) and vent timing.
      sim: slimes hunt across areas (stays() = boss/mini/minions/mini adds keep to their room), keepOnFloor with gates, obstacles solid, reset home after
      C.CHASE.RESET s with nobody alive. Boss/mini rooms seal and pull stragglers in ('tp'). SD.canStand: server refuses moves past closed gates,
      out of a sealed arena, or into the void; the client is snapped back ('fix' online, local snap offline).
      bosses: C.BOSS_KITS (p1/p2, heart, healer) + C.MOVES [mult, warning] + SD move library (slam ring barrage summon lines cross sweep checker safe
      charge teleport orbs meteor nova spiral pools). Telegraph shapes c/r/grid/safe/pool. 'orb' and 'heart' are mobs (minions). Mini-bosses cast
      every C.MINI_EVERY s. Second mini-bosses: banshee smelter conduit archon leech segfault.
      difficulty: DIFFS Hard {hp 1.45, dmg 1.3, lv 1}, NM {hp 2, dmg 1.65, lv 2}; MOB.DUN_STEP 1.12 / DUN_STEP_DMG 1.06 per dungeon. Test checks the curve.
      tests: unique layouts, curve, no-cheese (chase, gates, seal), every boss uses every move, heart immunity. Bot: routes through doors, dodges any
      shape, skill option (missed dodges), targets hearts/healers.

- [x] Update 5 (user: bosses solid, no Slime Rain, every dungeon's weapons/armour look completely different with their own effects, 2x easier
      levelling, Hard/Nightmare by level instead of clears, every level requirement 1.5x)
      bosses: SD.pushOut (server + every step, never through a wall) + client push in game.js; SD.solidR = sc*0.85+0.4. Standing within
      solidR+1.3 for C.BOSS.HUG s -> 'stomp' (bosses and minis). Boss approach distance solidR+3, sweep safe ring starts at solidR+1.4.
      canStand refuses steps off the floor (bot cut corners through the 1.5 margin and got stuck); bot lines up with doorways.
      levels: MAX 112, dungeon lvl x1.5, DIFFS lv [0,2,3], growth^(1/1.5) for MOB/GEAR/XP, HP_PER_LEVEL 8, STAT_POWER 0.01, LEVEL_XP 30
      (half per level), spell lv x1.5, milestones/titles/looks x1.5. Migration rv 3: level, item levels and stats x1.5. L.diffUnlocked by level.
      gear: char.js tierBlade/tierHilt/tierHammer/tierStaff + tierPaul/tierChest/tierHelm/tierLimb (flat boxes: low vertex counts),
      OUTFITS plate0-8 / robe0-8, look fields wtier/htier/gtier/btier/hglow (game.js toCH). C.GEAR_SETS[t] {w power, a set}. L.weaponPower,
      L.armourSets, L.setBonus (red/move/cdr feed the stats). Sim: weaponProc (root frost sun burn static glitch, void/devour damage, reap on kill),
      armourReact (chill, molten), Storm Shield / Glitched Code in hurtPlayer, Void Walker dodge cd (SD.dodgeCd). Icons per tier in ui.js.
      Slime Rain removed from C.EVENTS, server, client and logic.

- [~] Update 6 (the big one: 9 phases, done in order; user says "continue" for what is left)
  - [x] Phase 1 look + lighting. engine.js rewritten (head = math/geometry unchanged): 512px procedural textures (new: forest mossy crypt ice iceRock
    basalt slate obsidian sandstone flesh circuit) with glow masks in alpha (lava seams, veins, circuits; zone sets the colour), TEXMAT (spec gloss wet
    sparkle bump), bump from texture brightness (FX>=1), point-light specular (wet floors), rim light (uRim per draw, zone rimCol), HDR half-float scene
    when possible (OUT 0) else LDR post (OUT 1) else inline grade on Low (OUT 2): tmap/look/vign in GRADE glsl. Post: SSAO (High, depth texture,
    plane-aware), bloom, FXAA, colour grade, vignette, grain. Shadows snapped in light space + bilinear PCF + edge fade + normal offset. Height mist +
    exp haze, sky kinds 0-8 (storm, aurora, nebula, glitch, blood moon, ash...) with moon disc in the shader. Wall cutaway (uCut, Bayer dither) between
    camera and player. Telegraph modes 5 (circle) / 6 (rect) with charge fill. Particles: kind 2 = soft smoke, floor bounce. E.fx toggles.
    world.js: TH[i].look {sky, grade, rim, mist, haze, mat}, HUB/RAID/ARENA_LIGHT.look; aoStrip/aoBox merged dark bands at wall feet (MERGED.ao);
    moonbeam shafts, swinging chains (chainH), drips, flapping banners (Med/High), bubbling pools, drifting fog particles. Torch r 7.5 i 1.0.
    game.js: env.cut, footstep dust (FOOT_COL), smooth shake + 'low' option, applyLook (FX_KEYS, cb, textSize), Auto quality 50 fps with one step-up.
    Settings: effect toggles + Accessibility (danger colours, shake Full/Low/Off, text size). mobs.js: telegraphs via modes 5/6, hit sparks, flash.
  - [x] Phase 2 monsters. public/beasts.js (SSBeasts): rigs of parts (quad, biped, floater, crawler, serpent, swarm + custom bosses), posed from
    s = {t, mv, ph, w, atk, hurt, sq, die, phase, phT, lod}; p2/p1 parts for phase changes; deathFx per creature (shatter ash bones wisp pixels sparks
    void sand). Every mob id has a body (51). mobs.js drawRig (melt death, boss 2 s break-up), modAura, new states. Sim (dungeon.js): C.BEH
    behaviours spit charge fly burrow shield split heal summon bomb blink (BEHAV), ST codes 16-21, C.ELITE_MODS fast shield vamp boom frenzy,
    onDeath (split, boom), SD._spawn test hook. Creature names updated in config (ids unchanged). Tests: logic 61.
  - [x] Phase 3 moveset. Sim (dungeon.js): C.MOVESETS combos (order enforced by p.comboN, gap per hit / speed), heavy (charge time checked),
    dash (dodge within 0.75 s, once), air (p.airT from SD.move y>0.8), parry window + cooldown, perfect dodge, style (sty/rank/chain, decay, halves
    when hurt, styleBest -> L.runReward bonus), ult meter + C.ULTS kinds (nova spin avatar meteors timestop beam reaper divine), talents (L.talentFx
    stat/sp merged with L.spellFor), combos (shatter ignite execute stunCrit), stealth + aura spells. Classes rogue (Shadowblade) and paladin
    (Guardian), 12 spells each, starter weapon + helmet + armour on first switch. Client: char.js new anims (stabR/L, spinFin, castR/R2,
    heavyHold/Rel/Slam, dashAtk, airSlam/airLand, parry/parryHit, ultCast), CH.MOVES per weapon (dur/hit/ts), CH.MOVES_X (ev events),
    off-hand (lk.off: rogue dagger, paladin shield). game.js: attack() = dash/air/combo, hold -> startCharge/releaseHeavy, parry(), ultimate(),
    onMoveEvent sends at the hit frame via sendAtk (waits for the sim's gap: pendAtk on the game clock gT), hits no longer cancel attacks,
    run events parry pdodge style ultReady ult combo heavyfx launch stealth divine, cinematic camera camCin + #cine bars, slow-mo slowT, key
    bindings (C.KEYS, SET.keys, App.bindKey swaps conflicts), gamepad (pollPad, only after one is seen). Server: atk kinds heavy/dash/air/ult,
    'parry', spam guard (24 atk/s), dg players carry ult/rank/chain/sty, guest talents + ult replayed through L.learnTalent/L.setUlt, acts
    talent/talentReset/setult. UI: Abilities book tabs (Abilities, Talents, Ultimate, Moveset), trainer with 4 classes, Settings Combat + Controls,
    HUD ult ring (#skU), parry (#skF), style rank (#style), combo pips per weapon; HUD writes cached (no per-frame style writes).
    Tests: logic 68, server 28, browser 10, lab 54, tests/moveset-play.js (13 checks: combo 0-3, heavy, parry, dash, air, style, ult + cinematic,
    gamepad X/LB, rebinding), tests/pose-shots.js.
  - [x] Phase 4 worlds. config: DUNGEONS 9-11 (drowned 120, clock 133, moon 146; mech tide/blades/gravity), LAYOUTS 9-11, 18 MOBS,
    BOSS_KITS (leviathan healer, clockmaker heart, mooneater), GEAR_TIERS/SETS 9-11 (undertow/tideward, escape/tempo, moonfall/lunar),
    HAZ TIDE/BLADE/STAR/LOW_GRAVITY, MAX_LEVEL 150, WILD, titles pathfinder/lamplighter/moonbreaker. logic: haz kinds tide (room flood, safe
    daises), blades (spinning bar), star (vent-like); L.tideState/tideLevel/tideSafe/starState/bladeAng/bladeHit; lay.lantern per dungeon;
    W.wild (one round room R 110 at x -1700: camps, ways, gates, roads, obst), L.wildPack/wildReward, L.wayshrine/lantern, W.ANNEX (Wildgate
    Market counts as town), item class fix (rogue/paladin kept), class weapon pools. dungeon.js: hazards for tide/blades/star (+tideward),
    new weapon procs, tempo/lunar sets, mode 'wild' (wildTick: wake/clear/respawn camps, respawn at the gate), summary.camps. server: mode wild,
    acts way/lantern (proximity), x bound 12000. Client: TH 9-11 (looks, skies), hazard art (daises, blade pivots, craters) + live drawing in
    loot.js (rising water, spinning blades, falling stars), beasts for all 18 (3 custom bosses with phase-2 parts), low gravity + Lunar jump,
    tide slow + warning, buildWild (roads, woods, cliffs, camps, Wanderers' Camp, Far Gates, wayshrines), Wildgate Market annex (west gate,
    stalls, Lamplighter's tower, map table, the Wildgate), hub bound with annex, Wilds minimap, finder tile, results/run bar for wild.
    Tests: logic 71, server 29.
  - [x] Phase 5 gameplay. config: TOWER, MUTATORS (8), CHALLENGES (12, CH_PER_WEEK 5), PASS (30 tiers, RUN_XP, REWARDS) + PASS_COSM, CRAFT,
    DUEL, WORLD_BOSSES (5), TUTORIAL (8 steps), PET_EVOLVE, PARTY_XP, KEYS ping/photo, titles climber/tidecaller/duelist/towerlord/stylish/
    parrygod, 14 milestones. logic: towerFloor/towerReward, chList/chEnsure/chAdd (weekly, hashed by week), passEnsure/passXp/passTier/
    passReward/passClaim, afterRun (counters + challenges + pass XP + non-dungeon kills), bestiaryOf/Done/Claim, salvage/craftCost/reroll/
    upRarity, petEvo/petEvoK/feedPet, duelReward, tutDone, xpMult party bonus. dungeon.js: mode 'tower' (towerTick: floors, heal, mutators incl.
    glass dealt/taken), mode 'duel' (duelReset/Tick/Attack: fixed HP and damage, weapons only, first to WINS, time limit), counters nParry/
    nPdodge/nUlt, kc per mob, summary winner/score/floor/muts. server: modes tower/duel, onDuel (req/acc/dec), ping relay, acts passClaim/
    bestiary/salvage/reroll/uprarity/feed/tut, world boss rotation (raid.wb), tower/duel boards, ctx.party. Client: photo mode (O, filters,
    orbit, save PNG), tutorial panel (#tut, steps hooked into move/combo/heavy/dodge/jump/parry/gear/portal), ping fx, pet evolution visuals
    (pets.js opt.evo), UI: finder Tower tile + panel, run bar/results for tower and duel, duel request modal, Duel button in Players online,
    Quests tabs (Daily, Weekly challenges, Battle Pass, Milestones), Forge tabs (Upgrade, Crafting, Buy gear), pet Feed + evolution badge,
    bestiary pages with claims, profile stats, Battle Pass swatches in the Armory. UI.render skips identical HTML (no lost clicks).
    Tests: logic 79, server 31, tests/phase5-play.js (two real browser players: tutorial, photo, pass, crafting, pets, bestiary, tower, duel).
  - [x] Phase 6 UI. index.html: a 'UI v6' CSS layer (loaded last): tokens (--o0..o4, --edge, --brz), buttons, panel frame (.pbox::before
    bronze corners, ::after accent rule), header (.ph h2 display font + diamond), #pnav screen bar, tabs (.boardtabs/.tabs2/.tabs one style),
    cards, HUD (#lvl, bars, dock, skills, runbar, toast, goal), finder tiles, item/bag/slot tiles, zone title, results tiles (.res6),
    inventory (.inv6/.doll6/#pv), character (.char6/.hero6), settings tabs (.setg/.sg). public/preview.js (SSPreview): a second TLEngine +
    SSChar on its own canvas, attached into #pv after each render (the canvas moves between renders, so its WebGL context is kept); renders
    only while on screen; 24 fps and the lean shader on Low; drag/click/wheel. ui.js: navBar(), the gear panel is a centred wide panel (the
    old side panel + camera framing are gone), new inventory layout, character hero header, results tiles, settings tabs, UI.render skips
    identical HTML. game.js exposes App.myLook/myKind/gfxQ. Tests: tests/ui-tour.js (every screen; preview draws and stops).
  - [x] Phase 7 audio. audio.js: buses sfx/music (+ duck for zone crossfades)/ambience, a meter (AnalyserNode) for tests, visibility suspend;
    tone()/noise() route to OUT (a StereoPanner + distance gain) when AU.at(name, x, z, arg, range) is used; AU.listen from the camera every
    frame; themed score per zone (C.MUSIC.THEMES: root, scale, beat, wave, filter, bell octave, drone, percussion war/hand/tick/glass/chip),
    4 progressions, fight percussion by intensity, boss layer (brass ostinato + choir) via AU.setBoss, AU.sting(clear/boss/death/rank/floor),
    ambience bed (looping filtered noise + LFO, per C.MUSIC.AMB) and ambience events, footsteps per surface (C.MUSIC.SURF), 15 new effects.
    game.js: zone/boss follow (hudT), listener, step surface, stingers and new effects on events; mobs.js/loot.js place sounds. Settings: amb.
    Tests: tests/audio-play.js.
  - [x] Phase 8 balance. tests/balance.js prints the tables (weapons PvE + duel KO, class ability DPS, mode economy share by level,
    progression hours per world, Battle Pass weeks, costs); BALANCE.md has before/after. Changes: DUNGEONS 9-11 lvl 108/122/136; TYPES
    greatsword pow 1.4, hammer 1.17; cleave 3.0, execute cd 11, fireball 3.0, icelance 2.8, twinstrike 3.5; DUEL {PER_M 100, ULT 320,
    BACKSTAB} with L.duelHit (dungeon.js duelAttack uses it, plus dagger backstab); MODE_PAY {pit, tower, wild} with L.modePay used by
    pit/tower/wild rewards (old XP/GOLD multipliers removed); PASS.TIER_XP 1500. Tests: logic 82 (3 balance guards).
  - [x] Phase 9 polish. #tut: no pointer events except Skip, bottom placement under 1100px; tutorial text {action} -> bound key; #photobar
    (App.photoFilter/photoSave); L.migrate -> passEnsure (pass.v 2 scales old XP x1.5); results: no clock for duels; Vitality text;
    menu-covered world render throttle on Low; minimap every 3rd frame on Low (2nd otherwise) and drawn in the Wilds (it never was). Final runs: tests/final runner (logic, server, audio, ui-tour, browser-play, moveset,
    phase5, lab) + Low A/B bench vs the pre-Update-6 build.


- [~] Update 7 "THE WHOLE GAME, REMADE" (10 phases, reference/update7/PROMPT.md; photos 01-19 + notes.txt). Done in order; user says "continue" for what is left.
  Tooling on this Mac (no Playwright/Node preinstalled): Node 22 lives in ../_node (source ../env.sh), tools/pw-lite.js = the bit of the Playwright API
  the browser tests use, over the Chrome DevTools protocol with the installed Google Chrome (NODE_PATH=tools/pw-lite-modules; each newPage gets its own
  context like Playwright). tools/run-browser-tests.sh runs tests into logs (a test's server child can't block a pipe); tools/snap-test.sh runs them on
  a copy of HEAD (../_snap) so editing can continue. tools/sheet.js = contact sheets (reference photo next to our screenshot).
  - [x] Phase 1 remove: gems, Gem Shop (boosts, pet/bag slots), pets (eggs, hatchery, fusing, Pets 2.0, pet abilities in the sim), talents. Gold is
    the only currency: every gem reward pays gold in "clears" (L.clears(s, k) = k Normal clears of your best dungeon); runes cost L.enchCost; bag 300.
    Old saves: L.migrate7 (rv 7) pays C.MIGRATE7 gold for gems, bag/pet slots, running boosts, pets (egg cost x rarity x Golden/Rainbow + levels) and
    talents; deletes L.GONE7 keys; tamer title -> rookie; hatch quests -> clear quests; s.mig7 note shown once (act 'mig7' clears it). Server: pending
    weekly rewards in clears (old gem entries converted), trades are gear only, removed acts do nothing. Sim: Storm Shield block is event 'blocked'.
    Deleted public/pets.js, public/hatch.js, hatchery building, P key, Pets/Shop buttons, Talents tab. Tests: logic 82, server 31, tests/u7-saves.js.
  - [x] Phase 2 ladder: step k = dungeon*3 + difficulty needs L.stepLevel(k) = max(1, 5k); L.dunLevel(i, df) (Hardcore same); 36 steps, MAX_LEVEL 180.
    Glitch Realm no longer secret. Mobs: level growth + MOB.STEP_HP/STEP_DMG per step, DIFFS hp 1/1.08/1.16 dmg 1/1.05/1.1, xp/gold from the level only;
    XP and gold per mob = share of MOB.RUN_W by health (L.runList/runWeight cached) so a full clear pays L.clearXp(i, df, hc) whatever the map.
    LEVEL_XP 22 / LEVEL_GROWTH 1.0785: ~0.25 h per early step -> 3.4 h per last step, 44 h to 180 at 6 min a clear (tools/ladder-compare.js).
    Loot: L.lootLevel = run level minus 0..LV_SPREAD(4), never above; chest +1 gone; raid = Nightmare level, ring capped; L.dropsN(hc) (+1 Hardcore).
    Rarity weights Legendary 1.5->0.6, Ultimate 0.25->0.06. Old saves: L.migrate8 (rv 8) slides level + item levels along C.MIGRATE8 knots,
    keeps the xp fraction, scales stat points. Tests: logic 86, tests/u7-ladder.js.
  - [x] Phase 3 abilities: 2 classes (warrior, mage; rogue/paladin folded into warrior), SPELL_SLOTS 2 on Q/E (keys: dodge X, use F, parry V,
    heavy unbound; game.js drops clashing old custom keys once, SET.keysV 7). C.SPELLS = 48 (t = dungeon, role st/aoe/dot/cc/util); config
    computes sp.lv (= dungeon Normal level) and sp.mult = ABIL.P[role] x cd / hits x ABIL.TIER^t at load. L.gearPower (all slots x ABIL.SLOT,
    no weapon type) for abilities, L.ap x L.weaponTier (1.12^weapon dungeon) for weapon attacks, L.ultTier (1.15^bestDun) for ultimates
    (playerStats gp, ultK). CAPS crit .35 critd .8 pow .3 abil .4 spd .3 cdr .3. MOB.STEP_HP 1.045. No tomes (L.migrate9 rv 9: tomes -> gold,
    rogue/paladin -> warrior gear, bars keep first 2 valid). L.walkTime floor in L.minClearTime (MIN_WALK_FRACTION). tools/damage-model.js
    (+ --json, damage-compare.js) = the balance sheet; test 'Update 7 damage balance' runs it. Tests: logic 88, server 31, tests/u7-abilities.js.
  - [x] Phase 4 look: engine.js uToon (cel band on diffuse, env.toon from look.toon), sky kinds 9 day / 10 dusk (uMoonCol = sun colour, uMoon = sun
    size; the moon disc is skipped for kind >= 9), outline pass (q.o.outline {col, w, glow}: OUTLINE_VS pushes the mesh out along world normals,
    cull FRONT, after the opaque queue; never on Low; E.stats.outlines), SSAO threshold raised (no banding on flat ground), TEXGEN 'window'.
    world.js LOOK7 (per-theme light + look, replaces TH light/look), HUB_LIGHT dusk (sun in front of the portals), WILD daylight, PAL / VIVID
    (dungeon albedo lifted at build time, PAL_K per theme), windows textured and brighter at night, chunky six-sided pines (autumnPine), rocks
    with moss caps. char.js: dark outlines on body + gear (gearPart), Epic+ gear glows in its rarity colour (lk.oglow from game.js toCH).
    mobs.js: monster outlines (thicker on bosses). Low A/B bench (uncapped, 3 runs): town +3.7%, crypt +0.3%, ember boss 0.0%. tests/u7-look.js.
  - [x] Phase 5 town: logic.js W.TOWN (rounded-rectangle edge, W.townE = (|u|^4+|v|^4)^(1/4)), W.GATE {0,-54,r 28,y 3} with W.PORTALS for all
    12 dungeons (y 3) and W.portalHome(k); new W.STN spots; ANNEX/WEST_GATE moved west; HUB_R and PORTAL_GLITCH gone. world.js buildHub rewritten:
    hills() height field (hubHeight: rises outside the edge, mountain wall north, river valley, market hollow, south road; faceted, vertex
    colours, snow north), RIVER (x 40-48, solid except the rope bridge z -4 and stone bridge z 32), TERR terraces (gate +3, windmill +6, west
    hill +2.5, east hill +3) with stairs() (steps >= 0.95 deep), home() timber houses, roofOn(), path(), lantern(), bunting(), fence(),
    flowers(), bush(); stations as buildings (Forge smithy, Enchanter round tower, Trainer ring, Hall colonnade, Armory shop, Pit gatehouse).
    Y0 = build height (P, circ, rect, torch, win, banner, signAt add it). WD.collide: a ledge whose top <= feet + 0.45 is stepped onto;
    WD.floorAt edges inclusive; WD.groundAt; WD.hubH (camera kept above the hills); WD.bound clamps to the town edge. New dyn: water, fall,
    glowRing; floorRune takes y. HUB_LIGHT is now soft daylight (sky kind 9) with look.farK 1.6 (E.farBase x farK; Low x1.33). SSAO predicts
    the surface in 1/z (no banding at grazing angles). game.js: portal walk-ins compare heights (q.y), tp() lands on WD.groundAt, App._camOv
    (fixed test camera, optional far). tests/u7-town.js (flood fill reachability, stairs/bridge with the keyboard, 12 portals, 8 stations,
    home from a run), real-play walks via the stairs.
  - [x] Phase 6 maps: config LAYOUTS rewritten (12-15 rooms, two minis, 2-3 side rooms each; 3.07x-3.87x the Update 6 walkable area;
    hall fields br water|lava|chasm|sky|void and st, room field cliff N|S|E|W, layout land {k}); DUN_TIME 480 -> 720. logic.js: halls carry
    br/st, rooms carry cliff, lay.land beside the boss. world.js: mapHoles/inHole (ground tiles 12 m, skipped where the ground falls away;
    48 m tiles carry the land on beyond the map), bridge() (deck, piers, railings, banks, liquid dyn), street() + townHouse() (houses in each
    dungeon's style), cliffEdge() (parapet, rock face, a landscape 42 below), island() (Storm Spire and Abyssal Void float: no ground, cloud
    sea or void below), landmark() (giantTree, pyramid, crystalSpire, keep, volcano, spire, citadel, voidEye, planet, cathedral, clockTower).
    Dungeons see 1.3x further (not on Low). engine.js: static chunks culled by the view frustum (they were only culled by distance), 't' detail
    chunks drawn within 40 m on Low, E.mapView (overview shots without fog). tools/clear-times.js; tests/u7-maps.js; logic test 'Update 7 maps'.
  - [x] Phase 7 bosses + mobs: config SIG (147 signature moves, ids '<owner>.<move>', each owned by one boss / mini-boss: n, pose, wind, mult,
    tip, parts circle|trail|fan|spin|cross|ring|leap|dash|use) and BOSS_KITS rewritten to them (bosses p1/p2/p3, minis p1/p2, the Mimic).
    New minis: barkwarden (woods), sandseer (desert), rimewitch (frost) with their own beasts.js bodies, so every dungeon has two different
    mini-bosses. dungeon.js sig() lays the telegraphs; cast() sends {n, tip, pose, w}; every boss gets a third phase below 25% (kit.p3).
    mobs.js: per-move wind-up poses (crouch, raise, rear, tilt, spin, roar, channel, sink, shake, float) on the root, C.GAIT per dungeon
    (hop, lean, sway, float, jitter, clockwork tick, low gravity), crouch before a pounce, stretch on the leap, recoil when hit. game.js tips
    show the move's name. tools/movesets.js writes MOVESETS.md. Tests: logic 'own hand-made moveset', 'every signature move runs', u7-bosses.js.
  - [x] Phase 8 armour: char.js b7 pieces (the layered plate under every set: V trim + gem glow, belt, abdomen plates, finned square
    pauldrons with studs, banded arms, bracers, studded thigh plates, knee cops; b7Mantle for robes), tiers 9-11 (Tidebound, Clockwork, Lunar)
    get their own pauldron / chest / glow / helm / helm glow / limb pieces (were reusing 0-2); outfits 'plate'+t / 'robe'+t for 12 tiers;
    glow strength follows the armour's rarity (lk.rar from toCH, Ultimate pulses). Lab: the 12 sets as looks. Preview uses them as-is.
  - [x] Phase 9 UI: Update 7 skin (index.html CSS block: panels, pill buttons, big timer + HARDCORE tag, HP/EXP plate, 74 px Q/E slots,
    town pills Play / Inventory / Cosmetics, Swap / Shift-lock bars, inventory side tabs Gear / Skills / Storage, Q/E under the doll, n/300
    count, 3 px rarity frames). Storage (C.GEAR.STASH_MAX 120, it.st, L.store / L.stashN, act 'store') and Swap (s.prevW, L.swapWeapon, act
    'swap') in logic, game.js offline and server.js. tests/u7-ui.js, logic test 'Storage ... Swap'.
  - [x] Feedback round (Parker: "too childish, saturation slop, remove armour glow, match my photos"; photos in reference/update7-feedback):
    HUB_LIGHT = warm low sun, blue-grey mist, glowing windows (look.win), muted town palette (olive greens, grey stone, dark timber, deep
    autumn), a wood of pines between the houses, the Daily Gift as a heap of gold with signboards and a cyan ring; everywhere grade sat
    capped (x0.94, bloom x0.7) and VIVID softened. Armour: no emissive parts (noGlow outfits draw gems/studs in trim metal, dark visors,
    no rarity glow edge), accessories by rarity instead (ACC: belt + pouches, chainmail, strap, fur mantle, horns, crossed blades).
    Inventory after photo 4: big grey panel without header, 30 px vertical tabs, a silhouette paper doll, Q/E, 62-68 px square slots with
    rarity frames, n/300; the 3D preview stays on the Character screen. Panels and buttons are flat greys.
  - [x] Phase 10: the % vs flat stat comparison bug (a % Power bonus was compared with flat Power: "-737057%"), Void Citadel waves,
    measured pacing (BALANCE.md), browser-play and real-play updated for 12-room maps (the keyboard bot walks door to door).
  - [x] Final round A (Parker: "this will be the final version"): bigger dungeon slimes (C.MOB.SIZE), more decoration and far views per
    dungeon (world.js hallClutter / farView / terraces), the holes in every dungeon floor (W.pits clips pits around rooms and doors; void
    bridges get a 30 m pit; cliffEdge skips maps without ground), Q / E names no longer cover the key, server security fixes (malformed
    URL -> 400, look-ups by typed names use own() so '__proto__' / 'constructor' can't reach Object.prototype, traded items arrive unstored,
    relic / wayshrine checks use the simulated position).
  - [x] Final round B (Parker's list + 8 screenshots): HPK health x1.4 mobs / elites, x2.5 minis, x2 bosses (BOSS_DMG 1.3, MINI_DMG 2.1,
    HP_GROW 160); BOSS.SAFE.T 4.2 s for the two-safe-spot blast; clocks L.dunTime = DUN_TIME x DIFFS.time (12 / 14 / 16 min). Removed:
    ultimates (C.ULT/ULTS, R key, #skU, ult meter in snapshots), heavy / dash / air (hold = keep swinging), Class Trainer (Swap class button,
    act 'cls' anywhere in town), Enchanter + runes, rerolls, affixes / set bonuses / weapon powers (gear = Power only: itemLines, L.power),
    daily quests + weekly challenges (s.q / s.ch, settings, keys, HUD). L.migrate10 (rv 10): runes -> MIGRATE10.RUNE dust each, strips
    en / ax / x / x2 / ult / q / ch. Abilities: C.ABIL (tot = BASE x TIER^t per cast, CD 7 s for damage roles, ST_BOSS x1.5 vs boss / mini /
    elite), 10 new damage abilities in the buff dungeons, Mage squad heals (mend t1, heal t6); basic C.BASIC.K 0.21 (a third). Blacksmith
    (R.forge: price, Upgrades x/10, Upgrade / 10x / Spend all = L.upgradeItem(s,u,n) / L.upgradeAll, gold left, Power when maxed, search,
    sort; Salvage; Buy gear). Shop (R.avatar tabs chests / coll: C.SHOP 3 chests paid with dust, 32 skins in char.js CH.SKINS / WSKINS,
    L.openChest / L.setSkin, gearLook sk, UI.chestRes reel). Daily Gift = 4 drops from L.bestStep. Music: C.MUSIC.TRACKS (hub, 12 dungeons,
    arena) + ALIAS, new swing / hit / abil(el) / heal sounds. Q / E at a station in town = use(). HUD fixes from the screenshots (run HUD
    positions, Hall sign, no see-through cut-outs).
    Tests: logic 96, server 34 (Blacksmith, Swap class, chests / skins, gift, removed actions, security), browser tests updated
    (moveset-play = combat without heavy / dash / air / ult, u7-ui Shop, u7-saves migrate10, ui-tour, audio-play, phase5-play).
  - [x] Final checks (Update 7 final, last pass): loot pop-up no longer calls the removed affix helpers (it crashed on pickups); bought gear has no
    en / ax fields; raid rings lost their affix data; ult meter gone from snapshots; a click during a dodge roll swings as the roll ends
    (P.atkBuf); the town Shop sign (was ARMORY); milestone pop-up lifted above the Q / E names; Blacksmith shows small Power with one decimal;
    abilities with a longer cooldown (Storm Totem, Mirror Image, Death Mark, Doom) are worth more per cast in the same ratio so every
    dungeon's abilities are 10% stronger per second; weapon skins get their own shine (sp) and flat lighting (no wrap / full rim: dark skins
    washed out to white). tools: ladder-report measures with each difficulty's clock; run-browser-tests.sh sets NODE_PATH itself and only
    says PASS when the test printed its success line. Static scan: no code calls a removed L. / C. / SD. name.
  - [x] Online round (Parker: "hits sometimes don't register, mostly when enemies attack you"; "ready for a website"; "max 4 per dungeon,
    x1.5 health per player"): SD.attack queues a swing / ability that arrives up to C.HIT_GRACE (0.25 s) early (p.atkQ / p.spQ, one at a
    time) instead of refusing it (20 Hz steps and jitter lost ~1 swing in 10); the wait before a swing is the recovery of the last swing
    made (p.lastGap / lastGapK: first-hit spam used to beat the combo); game.js picks targets when a waiting swing is sent (sendAtk sel),
    swingTargets() is a little forgiving and counts the slime right beside you, pendAtk goes out in order, hurt shove 8 -> 5.
    L.partyHp(n) = MOB.PARTY_HP (1.5) ^ (n-1), n capped at PARTY_MAX 4 (mobStats, Pit, Tower, Wilds; inst.n capped; server slices
    members). server.js: gzip + ETag/304 + GET/HEAD only + Referrer-Policy, MAX_PLAYERS / MAX_PER_IP (close 1013, the game shows why and
    retries in 15 s), Origin must be this server's host (or ALLOWED_ORIGINS; close 1008), proxies on 100.64/10 trusted (TRUST_PROXY=1 for
    all), per-run try/catch (instError ends that run), uncaughtException / unhandledRejection logged. HOSTING.md. Tests: logic 'hits
    always register', 'parties: up to 4 ... x1.5'; server 'gzip / 304', 'another site can't connect', 'full server / per-address limit'.
