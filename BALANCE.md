# Slime Slayers · balance

Every number in this file comes from the tools in `tools/` and `tests/` (run them on any build to get the same tables):
`node tools/ladder-compare.js path/to/old/public` (levels and loot, before / after), `node tools/ladder-report.js` (this build only),
`node tests/balance.js` (weapons, classes, economy), `node tests/sim.js` (a bot plays the real simulation from level 1).
The tests in `tests/test-logic.js` fail if a later change pushes these numbers out of their target ranges.

# Update 7

## Phase 1 · What old saves get for what was removed

Gems, pets, eggs, the Gem Shop (boosts, pet slots, bag slots) and talents are gone. Gold is the only currency. When an old save loads
for the first time, everything it had from those systems becomes gold, once, and the game says so (a banner plus a chat line).
"A clear" below means the gold of one Normal clear of that save's best dungeon, so the payment is fair at every level (all numbers are `C.MIGRATE7`).

| What the save had | What it becomes |
|---|---|
| Every gem in the wallet | 0.06 clears of gold (40 gems bought 15 minutes of double gold, about 2.5 clears) |
| Bag slots bought (+10 each, 40 / 80 / 160 gems) | the gems back, as gold at the rate above. Everyone's bag is now 300 slots |
| Pet slots bought (60 / 150 / 350 gems) | the gems back, as gold at the rate above |
| A Gem Shop boost still running | 2.3 gems a minute left, as gold (a 15-minute boost cost 30-40 gems) |
| Every pet | the gold its egg cost x its rarity (Common x1, Uncommon x1.5, Rare x2.5, Epic x5, Legendary x15, Secret x40, Godly x100); Golden x3 and Rainbow x9 (they took 3 or 9 pets); + 0.1 clears for every level it had gained |
| Every talent learned | 0.5 clears of gold (talents were free, but they took levels to earn) |
| The Beast Tamer title (pets) | goes back to Rookie |
| Today's "Hatch eggs" quest | becomes a "Clear dungeons" quest of the same tier |
| A weekly leaderboard reward still waiting in gems | paid in gold at the gem rate |

Example: a level 60 save with 640 gems, 2 bag slots, 3 Epic Frost pets and 4 talents (a clear is 17.2K gold there) gets 0.78M for the gems and
slots, 0.07M for the pets and 0.03M for the talents: **about 0.89M gold** (checked with `L.migrate`). It then moves onto the new ladder at level 70.

Everything that used to pay gems now pays gold (in clears of your best dungeon, so it matters at every level):

| Reward | Before | After |
|---|---|---|
| Dungeon clear | 2 / 4 / 8 gems (Normal / Hard / Nightmare) + 2 for Hardcore | (nothing extra: the clear's own gold) |
| First clear of a dungeon + difficulty | 3x the difficulty's gems | double gold for that clear |
| Boss Raid | 6 gems (18 the first time) | double gold the first time |
| Pit / Tower / Wilds | 1 gem every 5 waves / 3 floors / 4 camps | (nothing extra: they already pay a fixed share of a clear) |
| World Boss Raid | 20 gems + 0.4 clears | 1.6 clears |
| Daily quest | 3-8 gems + 0.5 clears | 0.68-1.22 clears |
| Login streak (day 1 ... 7+) | 3, 4, 5, 6, 8, 10, 15 gems | 0.2, 0.25, 0.3, 0.35, 0.5, 0.6, 0.9 clears |
| Daily gift | 4 / 8 / 15 gems, 1 clear or a boost | 0.25 / 0.5 / 0.9 / 1.2 / 1.8 / 3 clears |
| Milestones | 5-100 gems | 0.3-6 clears (plus a new one: level 180, 9 clears) |
| Battle Pass gem tiers | 15-60 gems | 0.9-3.6 clears |
| Relic / wayshrine / lantern / bestiary page | 10 / 15 (+60) / 10 (+80) / 10+3 per world gems | 0.6 / 1 (+4) / 0.6 (+5) / 0.6 + 0.18 per world clears |
| Tutorial | 25 gems | 1.5 clears |
| Duel win | 5 gems + 0.6 clears | 0.6 clears |
| Weekly leaderboard top 10 | 60 ... 5 gems | 4 ... 0.5 clears |
| A rune at the Enchanter | 25 gems | 1.5 clears |

## Phase 2 · The ladder, the XP curve and loot

**The ladder:** every dungeon on every difficulty is one step of exactly 5 levels: Mossy Woods Normal 1, Hard 5, Nightmare 10, Desert Temple
Normal 15, Hard 20, Nightmare 25 ... Hollow Moon Nightmare 175. 12 dungeons x 3 difficulties = 36 steps, so the max level is 36 x 5 = **180**
(was 150). Hardcore is the same level as its difficulty (it used to be 3 levels higher). The Glitch Realm is an ordinary step now (it was
secret, outside the ladder); the 8 relics still pay gold and the Relic Seeker title.

**Slimes follow the ladder:** a step's slimes are its level, plus 2% health and 1% damage per step on top (`MOB.STEP_HP`, `STEP_DMG`), so
every step is harder than the one before, a new dungeon's Normal included. Hard and Nightmare add only a little (+8% / +16% health,
+5% / +10% damage): the 5 levels do the rest. A full clear pays the same XP and gold whatever the size of the map (`MOB.RUN_W`), so the bigger
maps of phase 6 cannot change the pace.

**XP:** a level costs `LEVEL_XP x LEVEL_GROWTH^(level-1)` (22 x 1.0785^...), a bit faster than XP per clear grows, so every step takes
about 7.5% longer than the one before: earlier dungeons level you up much faster (0.6 h for Mossy Woods), later ones are a real grind
(9.6 h for the last dungeon), and no step is a wall. 44 hours from level 1 to 180 at 6 minutes a clear. (The pacing bot,
`tests/sim.js`, clears today's maps in about 2 minutes, so it reaches 180 in 16 hours of play; the maps get 3x bigger in phase 6.)

**Loot:** nothing a run drops is above that run's level: boss items, the treasure chest (it used to add +1) and raid rings (they used to add
up to +2 on top of the raid's level) are the run's level or up to 4 below it (`GEAR.LV_SPREAD` 6 -> 4, and below instead of above). Example:
a Hardcore run at level 85 drops gear of level 81-85, never 86+. Raids are their dungeon's Nightmare level. Hardcore's boss drops one more item.
**Legendary** drops 2.5x less often (weight 1.5 -> 0.6) and **Ultimate** about 4x less often (0.25 -> 0.06).

### Hours per step, before → after (6 min a clear, the hardest step your level allows)

| Step | Levels before | Hours before | Levels after | Hours after | Total hours before / after |
|---|---|---|---|---|---|
| Mossy Woods · Normal | 1 → 3 | 0.10 | 1 → 5 | 0.11 | 0.1 / 0.1 |
| Mossy Woods · Hard | 3 → 4 | 0.04 | 5 → 10 | 0.24 | 0.1 / 0.4 |
| Mossy Woods · Nightmare | 4 → 12 | 0.53 | 10 → 15 | 0.29 | 0.7 / 0.6 |
| Desert Temple · Normal | 12 → 14 | 0.16 | 15 → 20 | 0.31 | 0.8 / 1.0 |
| Desert Temple · Hard | 14 → 15 | 0.06 | 20 → 25 | 0.33 | 0.9 / 1.3 |
| Desert Temple · Nightmare | 15 → 24 | 0.58 | 25 → 30 | 0.36 | 1.5 / 1.6 |
| Sunken Crypt · Normal | 24 → 26 | 0.17 | 30 → 35 | 0.39 | 1.6 / 2.0 |
| Sunken Crypt · Hard | 26 → 27 | 0.06 | 35 → 40 | 0.42 | 1.7 / 2.5 |
| Sunken Crypt · Nightmare | 27 → 38 | 0.79 | 40 → 45 | 0.45 | 2.5 / 2.9 |
| Frost Peaks · Normal | 38 → 40 | 0.21 | 45 → 50 | 0.49 | 2.7 / 3.4 |
| Frost Peaks · Hard | 40 → 41 | 0.08 | 50 → 55 | 0.52 | 2.8 / 3.9 |
| Frost Peaks · Nightmare | 41 → 51 | 0.85 | 55 → 60 | 0.57 | 3.6 / 4.5 |
| Ember Forge · Normal | 51 → 53 | 0.29 | 60 → 65 | 0.61 | 3.9 / 5.1 |
| Ember Forge · Hard | 53 → 54 | 0.11 | 65 → 70 | 0.66 | 4.0 / 5.7 |
| Ember Forge · Nightmare | 54 → 65 | 1.39 | 70 → 75 | 0.71 | 5.4 / 6.5 |
| Storm Spire · Normal | 65 → 67 | 0.31 | 75 → 80 | 0.76 | 5.7 / 7.2 |
| Storm Spire · Hard | 67 → 68 | 0.11 | 80 → 85 | 0.82 | 5.9 / 8.0 |
| Storm Spire · Nightmare | 68 → 78 | 1.27 | 85 → 90 | 0.89 | 7.1 / 8.9 |
| Void Citadel · Normal | 78 → 80 | 0.43 | 90 → 95 | 0.96 | 7.5 / 9.9 |
| Void Citadel · Hard | 80 → 81 | 0.16 | 95 → 100 | 1.03 | 7.7 / 10.9 |
| Void Citadel · Nightmare | 81 → 93 | 2.30 | 100 → 105 | 1.11 | 10.0 / 12.0 |
| Abyssal Void · Normal | 93 → 95 | 0.45 | 105 → 110 | 1.20 | 10.5 / 13.2 |
| Abyssal Void · Hard | 95 → 96 | 0.16 | 110 → 115 | 1.29 | 10.6 / 14.5 |
| Abyssal Void · Nightmare | 96 → 108 | 2.43 | 115 → 120 | 1.39 | 13.0 / 15.9 |
| Glitch Realm · Normal | (secret, off the ladder) | – | 120 → 125 | 1.50 | 13.0 / 17.4 |
| Glitch Realm · Hard | (secret, off the ladder) | – | 125 → 130 | 1.62 | 13.0 / 19.0 |
| Glitch Realm · Nightmare | (secret, off the ladder) | – | 130 → 135 | 1.75 | 13.0 / 20.8 |
| Drowned Cathedral · Normal | 108 → 110 | 0.60 | 135 → 140 | 1.88 | 13.6 / 22.7 |
| Drowned Cathedral · Hard | 110 → 111 | 0.22 | 140 → 145 | 2.03 | 13.9 / 24.7 |
| Drowned Cathedral · Nightmare | 111 → 122 | 2.84 | 145 → 150 | 2.19 | 16.7 / 26.9 |
| Clockwork Spire · Normal | 122 → 124 | 0.73 | 150 → 155 | 2.36 | 17.4 / 29.2 |
| Clockwork Spire · Hard | 124 → 125 | 0.27 | 155 → 160 | 2.54 | 17.7 / 31.8 |
| Clockwork Spire · Nightmare | 125 → 136 | 3.46 | 160 → 165 | 2.74 | 21.2 / 34.5 |
| Hollow Moon · Normal | 136 → 138 | 0.94 | 165 → 170 | 2.96 | 22.1 / 37.5 |
| Hollow Moon · Hard | 138 → 139 | 0.35 | 170 → 175 | 3.19 | 22.5 / 40.7 |
| Hollow Moon · Nightmare | 139 → 150 | 4.48 | 175 → 180 | 3.44 | 26.9 / 44.1 |

### Hours per dungeon, before → after

| Dungeon | Before | After |
|---|---|---|
| Mossy Woods | 0.67 h (Lv 1) | 0.64 h (Lv 1) |
| Desert Temple | 0.81 h (Lv 12) | 1.00 h (Lv 15) |
| Sunken Crypt | 1.02 h (Lv 24) | 1.26 h (Lv 30) |
| Frost Peaks | 1.13 h (Lv 38) | 1.58 h (Lv 45) |
| Ember Forge | 1.80 h (Lv 51) | 1.97 h (Lv 60) |
| Storm Spire | 1.69 h (Lv 65) | 2.47 h (Lv 75) |
| Void Citadel | 2.89 h (Lv 78) | 3.10 h (Lv 90) |
| Abyssal Void | 3.04 h (Lv 93) | 3.88 h (Lv 105) |
| Glitch Realm | secret | 4.87 h (Lv 120) |
| Drowned Cathedral | 3.66 h (Lv 108) | 6.10 h (Lv 135) |
| Clockwork Spire | 4.46 h (Lv 122) | 7.64 h (Lv 150) |
| Hollow Moon | 5.77 h (Lv 136) | 9.58 h (Lv 165) |

### Loot odds, before → after (one boss item; runs needed on average, with every boss item you get)

| Run | Legendary per item | Ultimate per item | Runs per Legendary | Runs per Ultimate |
|---|---|---|---|---|
| Normal | 1.50% → 0.607% | 0.250% → 0.061% | 17 → 42 | 100 → 410 |
| Hard | 3.08% → 1.26% | 0.646% → 0.159% | 9 → 20 | 39 → 158 |
| Nightmare | 5.22% → 2.18% | 1.32% → 0.331% | 5 → 12 | 19 → 76 |
| Nightmare Hardcore | 7.80% → 3.34% | 2.31% → 0.592% | 4 → 6 | 11 → 34 |

## Phase 3 · Abilities and the damage you deal

**Two classes.** The Warrior (Power: swords, greatswords, hammers, daggers) and the Mage (Spell Power: staffs), like the reference. The
Shadowblade and the Guardian are folded into the Warrior: daggers keep their backstab and hammers their stuns, and their best abilities are
on the Warrior's ladder. Old Shadowblades and Guardians become Warriors and keep all their gear (it becomes Warrior gear of the same level,
rarity, bonuses and upgrades). Tome abilities are gone (each one learned pays 1 clear of gold); ability bars keep their first two abilities.

**Two ability slots, Q and E** (dodge moved to X, use to F, parry to V; old custom keys that clash are reset once). **Every dungeon unlocks
2 Warrior and 2 Mage abilities** when your level reaches it: 48 in all (`C.SPELLS`, `t` = the dungeon).

**Gear power.** Abilities and ultimates hit with your *gear power*: every piece you wear counts (weapon 1, armour 0.5, helmet 0.35, gloves,
boots and ring 0.25 each: `ABIL.SLOT`), with its level, rarity and upgrades, times your class stat. The weapon's type does not count, so a
slow greatsword's abilities hit no harder than a dagger's (before, they did: the greatsword was 26% ahead). Basic attacks, heavies, dashes
and air slams still hit with attack power (weapon-led), and get +12% for every dungeon your weapon is from (`ABIL.WEAPON_TIER`).

**15% per dungeon.** An ability's damage comes from its role (damage per second at tier 0: single target 0.9, area 0.72, damage over time
0.66, crowd control 0.56 x gear power: `ABIL.P`), spread over its hits and cooldown, x 1.15 for every dungeon further along. So the same
role is exactly 15% stronger one dungeon later (the last dungeon's abilities are 1.15^11 = 4.65x the first's) and no ability is a trap.
Ultimates grow 15% per dungeon your level has reached. Slime health grows 4.5% per step (it was 2%) to soak up that growth, so a boss
takes about as long at level 175 as at level 1.

**No build runs away.** Every bonus stat is capped: crit chance 35% (was 75%), crit damage +80%, damage +30%, ability damage +40%, attack
speed +30%, cooldowns 30%. The maximum-damage check (anti-cheat) uses gear power too, and no clear can be faster than half the walk from the
start to the boss.

Before = the Update 6 build at the same step (its own levels); after = this build. "Boss alone" is the boss's health divided by the test
slayer's damage per second with nothing in the way (real fights take 2-3x longer: dodging, phases, adds).

### Damage you deal along the ladder, before → after (the test slayer: on-level Rare +3 gear, best abilities its level allows)

| Step | Class | Boss alone (pure damage) | Basic attacks | Abilities | Ultimate | Abilities used (after) |
|---|---|---|---|---|---|---|
| Mossy Woods Normal (Lv 1) | Warrior | 9.7 s → 7.3 s | 49% → 37% | 32% → 42% | 19% → 21% | Cleave, Charge |
| Mossy Woods Normal (Lv 1) | Mage | 9.3 s → 7.4 s | 40% → 32% | 43% → 49% | 17% → 19% | Fireball, Ice Lance |
| Mossy Woods Nightmare (Lv 10) | Warrior | 22.6 s → 10.9 s | 47% → 35% | 33% → 43% | 20% → 22% | Cleave, Charge |
| Mossy Woods Nightmare (Lv 10) | Mage | 17.9 s → 9.2 s | 40% → 32% | 42% → 48% | 18% → 20% | Fireball, Ice Lance |
| Desert Temple Normal (Lv 15) | Warrior | 9.1 s → 7.4 s | 31% → 33% | 48% → 47% | 21% → 21% | Twin Strike, Cleave |
| Desert Temple Normal (Lv 15) | Mage | 7.9 s → 8.3 s | 27% → 31% | 54% → 47% | 19% → 22% | Fireball, Sandstorm |
| Desert Temple Nightmare (Lv 25) | Warrior | 16.6 s → 9.7 s | 33% → 33% | 46% → 47% | 21% → 21% | Twin Strike, Cleave |
| Desert Temple Nightmare (Lv 25) | Mage | 16.0 s → 11.0 s | 28% → 32% | 55% → 48% | 18% → 20% | Fireball, Sandstorm |
| Sunken Crypt Normal (Lv 30) | Warrior | 9.7 s → 7.9 s | 33% → 35% | 48% → 45% | 19% → 20% | Twin Strike, Fan of Knives |
| Sunken Crypt Normal (Lv 30) | Mage | 8.4 s → 7.3 s | 25% → 27% | 58% → 53% | 18% → 20% | Arcane Barrage, Lantern Spear |
| Sunken Crypt Nightmare (Lv 40) | Warrior | 18.7 s → 10.5 s | 29% → 32% | 53% → 48% | 18% → 21% | Twin Strike, Fan of Knives |
| Sunken Crypt Nightmare (Lv 40) | Mage | 18.6 s → 11.7 s | 28% → 30% | 55% → 51% | 17% → 19% | Arcane Barrage, Lantern Spear |
| Frost Peaks Normal (Lv 45) | Warrior | 11.2 s → 9.1 s | 34% → 33% | 46% → 43% | 20% → 24% | Twin Strike, Fan of Knives |
| Frost Peaks Normal (Lv 45) | Mage | 10.9 s → 9.6 s | 29% → 35% | 54% → 44% | 17% → 21% | Arcane Barrage, Blizzard |
| Frost Peaks Nightmare (Lv 55) | Warrior | 19.8 s → 11.4 s | 30% → 34% | 49% → 43% | 21% → 23% | Twin Strike, Fan of Knives |
| Frost Peaks Nightmare (Lv 55) | Mage | 22.0 s → 12.3 s | 27% → 32% | 55% → 46% | 19% → 22% | Arcane Barrage, Blizzard |
| Ember Forge Normal (Lv 60) | Warrior | 13.5 s → 9.0 s | 34% → 31% | 46% → 46% | 20% → 24% | Leap Slam, Searing Arc |
| Ember Forge Normal (Lv 60) | Mage | 11.6 s → 9.6 s | 26% → 31% | 56% → 48% | 18% → 21% | Magma Bolt, Arcane Barrage |
| Ember Forge Nightmare (Lv 70) | Warrior | 25.7 s → 12.3 s | 30% → 31% | 49% → 46% | 21% → 24% | Leap Slam, Searing Arc |
| Ember Forge Nightmare (Lv 70) | Mage | 21.3 s → 12.2 s | 25% → 28% | 56% → 50% | 18% → 22% | Magma Bolt, Arcane Barrage |
| Storm Spire Normal (Lv 75) | Warrior | 13.4 s → 8.4 s | 27% → 27% | 53% → 49% | 19% → 24% | Storm Shuriken, Leap Slam |
| Storm Spire Normal (Lv 75) | Mage | 14.7 s → 8.7 s | 29% → 29% | 53% → 49% | 17% → 22% | Magma Bolt, Chain Lightning |
| Storm Spire Nightmare (Lv 85) | Warrior | 26.3 s → 10.8 s | 27% → 30% | 53% → 49% | 19% → 22% | Storm Shuriken, Leap Slam |
| Storm Spire Nightmare (Lv 85) | Mage | 26.2 s → 11.3 s | 26% → 26% | 56% → 52% | 18% → 22% | Magma Bolt, Chain Lightning |
| Void Citadel Normal (Lv 90) | Warrior | 14.9 s → 9.2 s | 27% → 31% | 53% → 46% | 19% → 23% | Storm Shuriken, Shockwave |
| Void Citadel Normal (Lv 90) | Mage | 17.1 s → 10.0 s | 29% → 30% | 53% → 46% | 17% → 24% | Magma Bolt, Hallowed Ground |
| Void Citadel Nightmare (Lv 100) | Warrior | 29.2 s → 11.4 s | 29% → 30% | 52% → 47% | 19% → 23% | Storm Shuriken, Shockwave |
| Void Citadel Nightmare (Lv 100) | Mage | 27.5 s → 12.5 s | 26% → 30% | 56% → 46% | 18% → 24% | Magma Bolt, Hallowed Ground |
| Abyssal Void Normal (Lv 105) | Warrior | 16.2 s → 8.7 s | 28% → 27% | 53% → 50% | 18% → 23% | Garrote, Sky Leap |
| Abyssal Void Normal (Lv 105) | Mage | 19.1 s → 9.9 s | 31% → 29% | 52% → 48% | 17% → 24% | Meteor, Thornfield |
| Abyssal Void Nightmare (Lv 115) | Warrior | 34.2 s → 11.6 s | 31% → 26% | 51% → 52% | 18% → 22% | Garrote, Sky Leap |
| Abyssal Void Nightmare (Lv 115) | Mage | 33.2 s → 12.4 s | 29% → 29% | 53% → 48% | 17% → 22% | Meteor, Thornfield |
| Glitch Realm Normal (Lv 120) | Warrior | – → 9.1 s | – → 28% | – → 48% | – → 24% | Garrote, Blade Dance |
| Glitch Realm Normal (Lv 120) | Mage | – → 9.9 s | – → 27% | – → 48% | – → 25% | Mirror Image, Meteor |
| Glitch Realm Nightmare (Lv 130) | Warrior | – → 12.1 s | – → 27% | – → 50% | – → 23% | Garrote, Blade Dance |
| Glitch Realm Nightmare (Lv 130) | Mage | – → 13.3 s | – → 33% | – → 44% | – → 23% | Mirror Image, Meteor |
| Drowned Cathedral Normal (Lv 135) | Warrior | 20.2 s → 9.5 s | 25% → 30% | 56% → 48% | 19% → 22% | Death Mark, Garrote |
| Drowned Cathedral Normal (Lv 135) | Mage | 22.9 s → 9.6 s | 27% → 25% | 55% → 49% | 18% → 26% | Black Hole, Mirror Image |
| Drowned Cathedral Nightmare (Lv 145) | Warrior | 43.4 s → 11.7 s | 27% → 28% | 55% → 47% | 18% → 25% | Death Mark, Garrote |
| Drowned Cathedral Nightmare (Lv 145) | Mage | 42.3 s → 13.3 s | 27% → 26% | 57% → 48% | 16% → 26% | Black Hole, Mirror Image |
| Clockwork Spire Normal (Lv 150) | Warrior | 23.5 s → 8.9 s | 27% → 27% | 54% → 52% | 19% → 20% | Execute, Skyfall |
| Clockwork Spire Normal (Lv 150) | Mage | 25.9 s → 9.8 s | 27% → 29% | 55% → 48% | 18% → 23% | Tempest Chain, Void Rift |
| Clockwork Spire Nightmare (Lv 160) | Warrior | 45.8 s → 11.4 s | 25% → 28% | 56% → 49% | 19% → 23% | Execute, Skyfall |
| Clockwork Spire Nightmare (Lv 160) | Mage | 51.1 s → 13.5 s | 27% → 29% | 55% → 48% | 18% → 23% | Tempest Chain, Void Rift |
| Hollow Moon Normal (Lv 165) | Warrior | 25.7 s → 9.8 s | 27% → 27% | 54% → 52% | 19% → 21% | Assassinate, Execute |
| Hollow Moon Normal (Lv 165) | Mage | 28.6 s → 10.3 s | 28% → 26% | 54% → 50% | 18% → 24% | Starfall, Doom |
| Hollow Moon Nightmare (Lv 175) | Warrior | 47.8 s → 11.3 s | 27% → 23% | 54% → 54% | 19% → 24% | Assassinate, Execute |
| Hollow Moon Nightmare (Lv 175) | Mage | 49.9 s → 12.8 s | 24% → 26% | 58% → 51% | 19% → 23% | Starfall, Doom |

### Builds at the Void Citadel on Hard, before → after (damage next to the test slayer at the same step)

| Build | Before | After |
|---|---|---|
| Warrior · sword (the test slayer) | 1.00x | 1.00x |
| Warrior · greatsword | 1.26x | 1.03x |
| Warrior · hammer | 0.96x | 0.94x |
| Warrior · daggers | 0.93x | 0.94x |
| Mage · staff | 1.06x | 1.09x |
| Glass cannon: all Power, Ultimate gear +10, crit bonuses | 48.31x | 7.21x |
| Strong: Legendary +6, damage bonuses on every piece | 4.10x | 2.57x |
| Tank: all Vitality, Rare +3 | 0.44x | 0.41x |
| Fresh to the step: gear 5 levels behind, Common | 0.40x | 0.43x |

## Phase 6 · The maps and the clock

Every dungeon is now a full map: 12-15 rooms (two mini-bosses each), streets, bridges, cliffs and a landmark. Walkable area, Update 6 → Update 7:

| Dungeon | Area before (m²) | Area after (m²) | x |
|---|---|---|---|
| Mossy Woods | 8,271 | 32,026 | 3.87 |
| Desert Temple | 10,743 | 33,251 | 3.10 |
| Sunken Crypt | 10,533 | 32,374 | 3.07 |
| Frost Peaks | 11,253 | 34,890 | 3.10 |
| Ember Forge | 12,615 | 42,235 | 3.35 |
| Storm Spire | 10,175 | 33,177 | 3.26 |
| Void Citadel | 12,293 | 39,916 | 3.25 |
| Abyssal Void | 12,137 | 38,776 | 3.19 |
| Glitch Realm | 10,994 | 40,007 | 3.64 |
| Drowned Cathedral | 12,769 | 40,849 | 3.20 |
| Clockwork Spire | 13,446 | 41,599 | 3.09 |
| Hollow Moon | 14,715 | 46,895 | 3.19 |

The clock goes from 8 to **12 minutes** (`DUN_TIME 720`). How long a solo run takes now (the test bot, on-level gear at the step's level,
walking every hall; `node tools/clear-times.js`):

| Dungeon | Normal | Hard | Nightmare | Rooms |
|---|---|---|---|---|
| Mossy Woods | 4 min | 4.4 min | 5.7 min | 14 |
| Desert Temple | 4.9 min | 5.6 min | 8.2 min | 14 |
| Sunken Crypt | 4.9 min | 5.2 min | 7.2 min | 14 |
| Frost Peaks | 4.9 min | 5.2 min | 6.9 min | 15 |
| Ember Forge | 5.3 min | 5.6 min | 7.1 min | 15 |
| Storm Spire | 4.9 min | 5.7 min | 6.9 min | 14 |
| Void Citadel | 6 min | 8 min | time | 14 |
| Abyssal Void | 6.3 min | 6.9 min | 7.3 min | 14 |
| Glitch Realm | 5.2 min | 5.6 min | 7.5 min | 14 |
| Drowned Cathedral | 5.6 min | 6.9 min | 9.7 min | 14 |
| Clockwork Spire | 6.1 min | 6.5 min | 9.1 min | 14 |
| Hollow Moon | 5.1 min | 5.9 min | 7.1 min | 14 |

(clock: 12 minutes)

A party, better gear or a few levels over the step clears much faster; the bare-minimum solo Nightmare runs are the ones near the clock.
Phase 10 re-checks this together with the final XP pacing.

## Phase 10 · Final pacing on the new maps

The same ladder, now timed with each step's real clear time on the new maps (the test bot, solo, gear at the step's level, walking every
hall) plus a minute between runs. Earlier dungeons go fast, every dungeon is still a grind, and 180 takes **55.3 hours** of Normal-clear XP
(was 44.1 at a flat 6 minutes a clear). The Void Citadel's longest rooms lost a wave each so its bare-minimum solo Nightmare fits the clock.
`node tools/ladder-report.js public measured`

#### Hours per step (measured minutes a clear, max level 180)

| Step | Dungeon | Difficulty | Levels | Clears | Min/clear | Hours | Total hours |
|---|---|---|---|---|---|---|---|
| 1 | Mossy Woods | Normal | 1 → 5 | 1.1 | 5.0 | 0.09 | 0.1 |
| 2 | Mossy Woods | Hard | 5 → 10 | 2.4 | 5.3 | 0.21 | 0.3 |
| 3 | Mossy Woods | Nightmare | 10 → 15 | 2.9 | 6.7 | 0.32 | 0.6 |
| 4 | Desert Temple | Normal | 15 → 20 | 3.1 | 6.1 | 0.31 | 0.9 |
| 5 | Desert Temple | Hard | 20 → 25 | 3.3 | 6.9 | 0.38 | 1.3 |
| 6 | Desert Temple | Nightmare | 25 → 30 | 3.6 | 8.8 | 0.53 | 1.9 |
| 7 | Sunken Crypt | Normal | 30 → 35 | 3.9 | 5.7 | 0.37 | 2.2 |
| 8 | Sunken Crypt | Hard | 35 → 40 | 4.2 | 6.2 | 0.43 | 2.6 |
| 9 | Sunken Crypt | Nightmare | 40 → 45 | 4.5 | 7.9 | 0.59 | 3.2 |
| 10 | Frost Peaks | Normal | 45 → 50 | 4.9 | 5.7 | 0.46 | 3.7 |
| 11 | Frost Peaks | Hard | 50 → 55 | 5.2 | 6.2 | 0.54 | 4.2 |
| 12 | Frost Peaks | Nightmare | 55 → 60 | 5.7 | 7.2 | 0.67 | 4.9 |
| 13 | Ember Forge | Normal | 60 → 65 | 6.1 | 6.4 | 0.65 | 5.6 |
| 14 | Ember Forge | Hard | 65 → 70 | 6.6 | 6.7 | 0.74 | 6.3 |
| 15 | Ember Forge | Nightmare | 70 → 75 | 7.1 | 8.2 | 0.97 | 7.3 |
| 16 | Storm Spire | Normal | 75 → 80 | 7.6 | 5.8 | 0.74 | 8.0 |
| 17 | Storm Spire | Hard | 80 → 85 | 8.2 | 6.3 | 0.86 | 8.9 |
| 18 | Storm Spire | Nightmare | 85 → 90 | 8.9 | 7.7 | 1.14 | 10.0 |
| 19 | Void Citadel | Normal | 90 → 95 | 9.6 | 6.4 | 1.02 | 11.0 |
| 20 | Void Citadel | Hard | 95 → 100 | 10.3 | 7.9 | 1.35 | 12.4 |
| 21 | Void Citadel | Nightmare | 100 → 105 | 11.1 | 9.9 | 1.83 | 14.2 |
| 22 | Abyssal Void | Normal | 105 → 110 | 12 | 7.0 | 1.40 | 15.6 |
| 23 | Abyssal Void | Hard | 110 → 115 | 12.9 | 7.6 | 1.64 | 17.3 |
| 24 | Abyssal Void | Nightmare | 115 → 120 | 13.9 | 8.7 | 2.02 | 19.3 |
| 25 | Glitch Realm | Normal | 120 → 125 | 15 | 6.3 | 1.57 | 20.8 |
| 26 | Glitch Realm | Hard | 125 → 130 | 16.2 | 6.9 | 1.87 | 22.7 |
| 27 | Glitch Realm | Nightmare | 130 → 135 | 17.5 | 8.0 | 2.32 | 25.0 |
| 28 | Drowned Cathedral | Normal | 135 → 140 | 18.8 | 6.9 | 2.16 | 27.2 |
| 29 | Drowned Cathedral | Hard | 140 → 145 | 20.3 | 7.9 | 2.67 | 29.9 |
| 30 | Drowned Cathedral | Nightmare | 145 → 150 | 21.9 | 10.4 | 3.78 | 33.6 |
| 31 | Clockwork Spire | Normal | 150 → 155 | 23.6 | 6.6 | 2.60 | 36.3 |
| 32 | Clockwork Spire | Hard | 155 → 160 | 25.4 | 8.0 | 3.39 | 39.6 |
| 33 | Clockwork Spire | Nightmare | 160 → 165 | 27.4 | 9.7 | 4.42 | 44.1 |
| 34 | Hollow Moon | Normal | 165 → 170 | 29.6 | 6.6 | 3.23 | 47.3 |
| 35 | Hollow Moon | Hard | 170 → 175 | 31.9 | 6.6 | 3.53 | 50.8 |
| 36 | Hollow Moon | Nightmare | 175 → 180 | 34.4 | 7.8 | 4.49 | 55.3 |

## Final version · tougher fights, remade abilities, Power-only gear

Parker's last list: slimes 1.4x health, mini-bosses 2.5x, bosses 2x; abilities that scale with gear, stats and weapon, each dungeon's 10%
stronger than the last; basic attacks a third of what they were; no ultimates; gear with Power only. These are the numbers after it.

| | Health | Damage they deal | Where |
|---|---|---|---|
| Slimes and elites | x1.4 | as before | `C.MOB.HPK` |
| Mini-bosses | x2.5 | x2.1 | `C.MOB.HPK`, `C.MOB.MINI_DMG` |
| Bosses | x2 | x1.3 | `C.MOB.HPK`, `C.MOB.BOSS_DMG` |
| Players | `HP_GROW` 120 → 160 (more health per level) | | so the longer fights don't double the deaths |

- **The clock**: Normal 12, Hard 14, Nightmare 16 minutes (`C.DIFFS[].time`); the two-safe-spot floor blast gives 4.2 s to reach the green circle (`C.BOSS.SAFE.T`).
- **Abilities** (`C.ABIL`): one cast is worth `8 x 1.10^tier x Power` to every slime it reaches (Power = all the gear you wear x your class
  stat points x your weapon's tier). Damage abilities share a 7 s cooldown; one that leaves something behind for longer (Storm Totem, Mirror
  Image, Death Mark, Doom) has a longer cooldown and is worth more per cast in the same ratio, so **per second every dungeon's abilities are
  exactly 10% stronger than the dungeon before**. Single-target abilities hit bosses, mini-bosses and elites 50% harder (`ST_BOSS`).
- **Basic attacks**: `C.BASIC.K` 0.21 (a third of before). Swings are about 14% of your damage, abilities 86%.
- **Gear**: Power only. No crit, cooldown, gold, luck or set bonuses; no runes. +8% Power per upgrade, 10 upgrades.

### Damage you deal along the ladder (the test slayer: on-level Rare +3 gear, the best two abilities it has)
`node tools/damage-model.js` · the Normal step of every dungeon; Warrior and Mage are within 1% of each other everywhere, and both always
use their newest dungeon's abilities.

| Step | Level | Class | Damage/s | Basic | Abilities | Boss alone | A slime | Abilities used |
|---|---|---|---|---|---|---|---|---|
| Mossy Woods N | 1 | Warrior | 134 | 14% | 86% | 20.7 s | 0.5 s | Cleave, Charge |
| Mossy Woods N | 1 | Mage | 134 | 14% | 86% | 20.8 s | 0.5 s | Fireball, Ice Lance |
| Desert Temple N | 15 | Warrior | 383 | 14% | 86% | 24.8 s | 0.6 s | Whirlwind, Twin Strike |
| Desert Temple N | 15 | Mage | 381 | 14% | 86% | 24.9 s | 0.6 s | Frost Nova, Sandstorm |
| Sunken Crypt N | 30 | Warrior | 1302 | 14% | 86% | 25.6 s | 0.6 s | Fan of Knives, Shield Bash |
| Sunken Crypt N | 30 | Mage | 1294 | 14% | 86% | 25.8 s | 0.6 s | Arcane Barrage, Lantern Spear |
| Frost Peaks N | 45 | Warrior | 4281 | 14% | 86% | 26.4 s | 0.6 s | Earthshaker, Frost Cleaver |
| Frost Peaks N | 45 | Mage | 4256 | 14% | 86% | 26.5 s | 0.6 s | Blizzard, Frost Comet |
| Ember Forge N | 60 | Warrior | 13907 | 14% | 86% | 26.8 s | 0.6 s | Leap Slam, Searing Arc |
| Ember Forge N | 60 | Mage | 13825 | 14% | 86% | 27.0 s | 0.6 s | Inferno, Magma Bolt |
| Storm Spire N | 75 | Warrior | 44295 | 14% | 86% | 27.3 s | 0.6 s | Storm Shuriken, Thunder Charge |
| Storm Spire N | 75 | Mage | 44034 | 14% | 86% | 27.5 s | 0.6 s | Storm Totem, Chain Lightning |
| Void Citadel N | 90 | Warrior | 140146 | 14% | 86% | 27.6 s | 0.6 s | Shockwave, Void Rend |
| Void Citadel N | 90 | Mage | 139319 | 14% | 86% | 27.8 s | 0.6 s | Hallowed Ground, Void Bolt |
| Abyssal Void N | 105 | Warrior | 437450 | 14% | 86% | 27.9 s | 0.6 s | Garrote, Sky Leap |
| Abyssal Void N | 105 | Mage | 434870 | 14% | 86% | 28.1 s | 0.6 s | Meteor, Thornfield |
| Glitch Realm N | 120 | Warrior | 1360188 | 14% | 86% | 28.1 s | 0.7 s | Blade Dance, Glitch Slash |
| Glitch Realm N | 120 | Mage | 1352158 | 14% | 86% | 28.3 s | 0.7 s | Radiant Nova, Mirror Image |
| Drowned Cathedral N | 135 | Warrior | 4186620 | 14% | 86% | 28.4 s | 0.7 s | Chain Hook, Death Mark |
| Drowned Cathedral N | 135 | Mage | 4161973 | 14% | 86% | 28.5 s | 0.7 s | Black Hole, Crystal Chains |
| Clockwork Spire N | 150 | Warrior | 12857194 | 14% | 86% | 28.5 s | 0.9 s | Execute, Skyfall |
| Clockwork Spire N | 150 | Mage | 12781342 | 14% | 86% | 28.6 s | 0.9 s | Void Rift, Tempest Chain |
| Hollow Moon N | 165 | Warrior | 39172669 | 14% | 86% | 28.7 s | 0.6 s | Bladestorm, Assassinate |
| Hollow Moon N | 165 | Mage | 38941491 | 14% | 86% | 28.8 s | 0.6 s | Starfall, Doom |

### Builds at the Void Citadel on Hard

| Build | Damage/s | vs test slayer | Basic | Abilities |
|---|---|---|---|---|
| Warrior · sword (the test slayer) | 198313 | 1.00x | 14% | 86% |
| Warrior · greatsword | 207540 | 1.05x | 18% | 82% |
| Warrior · hammer | 201859 | 1.02x | 16% | 84% |
| Warrior · daggers | 189101 | 0.95x | 10% | 90% |
| Mage · staff | 197143 | 0.99x | 14% | 86% |
| Glass cannon: all Strength, Ultimate gear +10 | 640581 | 3.23x | 14% | 86% |
| Strong: Legendary +6 | 350964 | 1.77x | 14% | 86% |
| Tank: all Vitality, Rare +3 | 82288 | 0.41x | 14% | 86% |
| Fresh to the step: gear 5 levels behind, Common | 91155 | 0.46x | 14% | 86% |

### Clear times on the new health (the test bot, solo, walking every hall)
`node tools/clear-times.js` (Uncommon +1 gear at the step's level: the weakest a slayer can be when a step opens; one class per dungeon).
On Nightmare this gear is at the edge on purpose (the Drowned Cathedral runs out of time); a slayer who farmed the step before is comfortable.

| Dungeon | Normal | Hard | Nightmare | Rooms |
|---|---|---|---|---|
| Mossy Woods | 5.1 min | 6 min | 7.4 min | 14 |
| Desert Temple | 6.8 min | 7.9 min | 10.8 min | 14 |
| Sunken Crypt | 6.8 min | 7.9 min | 9.4 min | 14 |
| Frost Peaks | 5 min | 5.7 min | 7 min | 15 |
| Ember Forge | 6 min | 6.9 min | 9.2 min | 15 |
| Storm Spire | 5.8 min | 6.6 min | 8.9 min | 14 |
| Void Citadel | 6.3 min | 8.6 min | 12.8 min | 14 |
| Abyssal Void | 6.7 min | 7.4 min | 8.6 min | 14 |
| Glitch Realm | 6.2 min | 7 min | 9.4 min | 14 |
| Drowned Cathedral | 6.4 min | 7.6 min | time | 14 |
| Clockwork Spire | 6.7 min | 7.8 min | 10.1 min | 14 |
| Hollow Moon | 6.1 min | 6.5 min | 8.6 min | 14 |

Rare +3 gear at the step's level (both classes):

| Dungeon | Normal W / M | Hard W / M | Nightmare W / M |
|---|---|---|---|
| Mossy Woods | 4.8 / 5.1 min | 5.1 / 5.3 min | 6.3 / 5.6 min |
| Desert Temple | 5.6 / 5.7 min | 6.6 / 6.2 min | 8.4 / 7.6 min |
| Sunken Crypt | 5.9 / 6.1 min | 6.9 / 6.8 min | 7.7 / 8.3 min |
| Frost Peaks | 5.0 / 4.6 min | 5.9 / 4.8 min | 6.4 / 5.8 min |
| Ember Forge | 4.9 / 5.3 min | 6.0 / 6.0 min | 6.9 / 7.1 min |
| Storm Spire | 6.2 / 4.8 min | 6.8 / 5.4 min | 8.2 / 6.6 min |
| Void Citadel | 5.3 / 5.4 min | 6.9 / 6.0 min | 10.8 / 7.8 min |
| Abyssal Void | 6.9 / 6.0 min | 7.5 / 6.7 min | 7.7 / 7.2 min |
| Glitch Realm | 5.3 / 5.6 min | 6.0 / 6.2 min | 7.2 / 8.6 min |
| Drowned Cathedral | 4.8 / 5.2 min | 5.8 / 6.1 min | 6.1 / 7.8 min |
| Clockwork Spire | 6.5 / 5.7 min | 6.8 / 6.2 min | 7.6 / 7.3 min |
| Hollow Moon | 5.1 / 5.6 min | 6.3 / 5.9 min | 7.4 / 6.6 min |

### Pacing
`node tools/ladder-report.js public measured` (each step's measured clear time with the weakest gear, a failed run counts its full clock,
+1 minute between runs): **64.9 hours** to level 180 (was 55.3 before the health went up).

| Dungeon | Opens at | Hours |
|---|---|---|
| Mossy Woods | Lv 1 | 0.80 |
| Desert Temple | Lv 15 | 1.60 |
| Sunken Crypt | Lv 30 | 1.93 |
| Frost Peaks | Lv 45 | 1.82 |
| Ember Forge | Lv 60 | 2.70 |
| Storm Spire | Lv 75 | 3.31 |
| Void Citadel | Lv 90 | 5.31 |
| Abyssal Void | Lv 105 | 5.72 |
| Glitch Realm | Lv 120 | 6.98 |
| Drowned Cathedral | Lv 135 | 10.08 |
| Clockwork Spire | Lv 150 | 12.06 |
| Hollow Moon | Lv 165 | 12.55 |

### Parties (up to 4)
Every slime, mini-boss and boss has **x1.5 health for each player who joins** (`C.MOB.PARTY_HP`, compounding; dungeons, raids, the Pit,
the Tower and the Wilds). Damage taken is unchanged and everyone gets the full rewards. With equal players a party still clears a bit
faster than one slayer alone, but not four times faster:

| Players | Enemy health | Party damage | Time to kill vs solo |
|---|---|---|---|
| 1 | x1 | x1 | 1.00 |
| 2 | x1.5 | x2 | 0.75 |
| 3 | x2.25 | x3 | 0.75 |
| 4 | x3.38 | x4 | 0.84 |

(It was +60% health per extra player before: x1.6 / x2.2 / x2.8.)

### The Shop and dust
Dust comes from salvaging gear at the Blacksmith (Common 2, Uncommon 5, Rare 12, Epic 30, Legendary 70, Ultimate 150 per item). Chests (`C.SHOP.CHESTS`); a skin you already own
gives dust back (`C.SHOP.DUPE`: 10 / 30 / 80 / 200 / 450). Even when you own every skin, a chest gives back less than it cost, so dust can
never be farmed from chests.

| Chest | Cost | Common | Rare | Epic | Legendary | Mythic | Dust back once you own all 32 |
|---|---|---|---|---|---|---|---|
| Common | 40 | 70% | 22% | 6% | 1.8% | 0.2% | 23 |
| Rare | 150 | 35% | 38% | 18% | 7% | 2% | 52 |
| Legendary | 500 | 0% | 25% | 40% | 25% | 10% | 135 |

Buying gear at the Blacksmith, upgrading it to +10 and selling it gives back at most 1.5% of the gold, so gold can't be farmed either.
Old saves: every rune that was on an item becomes 20 dust (`C.MIGRATE10`).

# Update 6 (for reference)


Every number below comes from `node tests/balance.js` (run it on any build to get the same tables). *Before* is the build from before this phase and *after* is this build. The tests in `tests/test-logic.js` ("Update 6 balance: …") fail if a later change pushes any of these numbers out of their target range.

Assumptions: a dungeon clear takes 6 minutes, 10 Pit waves take 5 minutes, 10 Tower floors take 6 minutes and 8 Wilds camps take 8 minutes. Damage is shown as a multiple of attack power, before critical hits.

## Weapons: combo damage per second (x attack power) and duel time to knock out

**Changed:** greatsword power 1.3 → 1.4, hammer power 1.22 → 1.17 (the hammer also stuns and hits crowds). Duels no longer deal a flat 70 per hit (120 for a finisher): a hit now does `DUEL.PER_M` (100) × the move's multiplier × the weapon's power, so every weapon's knock-out time is between 5.6 and 6.2 seconds instead of 3.1 (daggers) to 10.6 (greatsword). Daggers still deal 60% more from behind, in duels too.

**Before**

| Weapon | Combo | Combo time | PvE damage/s | Duel damage per combo | Duel KO time |
|---|---|---|---|---|---|
| Sword | 4 hits | 1.76 s | 1.79 | 330 | 5.33 s |
| Greatsword | 3 hits | 2.76 s | 1.58 | 260 | 10.61 s |
| Daggers | 5 hits | 1.25 s | 1.60 (2.56 from behind) | 400 | 3.11 s |
| Hammer | 3 hits | 2.10 s | 1.80 | 260 | 8.09 s |
| Staff | 3 hits | 1.44 s | 1.63 | 260 | 5.54 s |

**After**

| Weapon | Combo | Combo time | PvE damage/s | Duel damage per combo | Duel KO time |
|---|---|---|---|---|---|
| Sword | 4 hits | 1.76 s | 1.79 | 315 | 5.59 s |
| Greatsword | 3 hits | 2.76 s | 1.70 | 469 | 5.88 s |
| Daggers | 5 hits | 1.25 s | 1.60 (2.56 from behind) | 201 | 6.20 s |
| Hammer | 3 hits | 2.10 s | 1.72 | 363 | 5.80 s |
| Staff | 3 hits | 1.44 s | 1.63 | 235 | 6.13 s |

## Classes: ability damage per second from the four best abilities (x attack power)

**Changed:** Warrior Cleave 3.2 → 3.0 and Execute cooldown 10 → 11 s; Mage Fireball 2.9 → 3.0 and Ice Lance 2.6 → 2.8; Shadowblade Twin Strike 3.4 → 3.5. Now the fragile classes hit hardest (Shadowblade, then Warrior and Mage) and the Guardian, who has the most health and buffs the party, deals the least.

**Before**

| Class | Health | Ability damage/s | Abilities |
|---|---|---|---|
| Warrior | x1.25 health | 2.84 | Cleave 3.2/3.5s, Execute 8.5/10s, Shockwave 3.8/7s, Leap Slam 4.8/9s |
| Mage | x1 health | 2.53 | Fireball 2.9/2.8s, Meteor 7.5/13s, Ice Lance 2.6/5s, Chain Lightning 2.8/7s |
| Shadowblade | x1.05 health | 2.76 | Twin Strike 3.4/3s, Assassinate 8.5/12s, Garrote 5.2/9s, Fan of Knives 2.4/7s |
| Guardian | x1.35 health | 2.37 | Judgement 2.9/3.5s, Hammer of Light 3.3/6s, Hammerfall 8.5/16s, Shield Bash 2.3/5s |

**After**

| Class | Health | Ability damage/s | Abilities |
|---|---|---|---|
| Warrior | x1.25 health | 2.71 | Cleave 3/3.5s, Execute 8.5/11s, Shockwave 3.8/7s, Leap Slam 4.8/9s |
| Mage | x1 health | 2.61 | Fireball 3/2.8s, Meteor 7.5/13s, Ice Lance 2.8/5s, Chain Lightning 2.8/7s |
| Shadowblade | x1.05 health | 2.80 | Twin Strike 3.5/3s, Assassinate 8.5/12s, Garrote 5.2/9s, Fan of Knives 2.4/7s |
| Guardian | x1.35 health | 2.37 | Judgement 2.9/3.5s, Hammer of Light 3.3/6s, Hammerfall 8.5/16s, Shield Bash 2.3/5s |

## Economy: gold / XP per minute, the other modes as a share of your best dungeon

**Changed:** the Pit, the Tower and the Wilds used to add up the gold of the slimes they spawned, so how good they were depended on your level (the Pit went from 105% of a dungeon at level 20 to 52% at level 140). Now each wave, floor or camp pays a fixed share of a Normal clear of your best dungeon (`MODE_PAY`), growing a little with each wave or floor. The Pit pays about 91% of what dungeons pay per minute and the Tower about 92%, at every level. The Wilds pay 55% because they're more relaxed. Dungeons stay the best, because they are the only place gear drops.

**Before**

| Level | Best dungeon | Dungeon gold / XP per min | Pit | Endless Tower | The Wilds |
|---|---|---|---|---|---|
| 20 | Desert Temple | 153 / 15 | 105% / 85% | 112% / 112% | 50% / 42% |
| 60 | Ember Forge | 1828 / 155 | 105% / 84% | 112% / 112% | 50% / 42% |
| 100 | Abyssal Void | 32462 / 2423 | 86% / 68% | 91% / 91% | 40% / 34% |
| 140 | Clockwork Spire | 392404 / 25966 | 52% / 42% | 94% / 94% | 42% / 36% |

**After**

| Level | Best dungeon | Dungeon gold / XP per min | Pit | Endless Tower | The Wilds |
|---|---|---|---|---|---|
| 20 | Desert Temple | 153 / 15 | 91% / 90% | 92% / 92% | 55% / 56% |
| 60 | Ember Forge | 1828 / 155 | 91% / 91% | 92% / 92% | 55% / 55% |
| 100 | Abyssal Void | 32462 / 2423 | 91% / 91% | 92% / 92% | 55% / 55% |
| 140 | Hollow Moon | 453119 / 29714 | 91% / 91% | 92% / 92% | 55% / 55% |

## Progression: hours from each world to the next (hardest difficulty you can enter, 6 min a clear)

**Changed:** the Update 6 worlds were at levels 120 / 133 / 146, which left a 27-level wall after the Abyssal Void (9 hours of clears). They are now at 108 / 122 / 136, the same 14-level steps as the rest of the game. A new player reaches level 150 in about 27 hours instead of 30, with no world taking longer than 6 hours.

**Before**

| World | Levels | Clears | Hours | Total hours |
|---|---|---|---|---|
| Mossy Woods | 1 → 12 | 7 | 0.7 | 0.7 |
| Desert Temple | 12 → 24 | 8 | 0.8 | 1.5 |
| Sunken Crypt | 24 → 38 | 10 | 1.0 | 2.5 |
| Frost Peaks | 38 → 51 | 11 | 1.1 | 3.6 |
| Ember Forge | 51 → 65 | 18 | 1.8 | 5.4 |
| Storm Spire | 65 → 78 | 17 | 1.7 | 7.1 |
| Void Citadel | 78 → 93 | 29 | 2.9 | 10.0 |
| Abyssal Void | 93 → 120 | 91 | 9.1 | 19.1 |
| Drowned Cathedral | 120 → 133 | 39 | 3.9 | 23.0 |
| Clockwork Spire | 133 → 146 | 47 | 4.7 | 27.7 |
| Hollow Moon | 146 → 150 | 18 | 1.8 | 29.6 |

**After**

| World | Levels | Clears | Hours | Total hours |
|---|---|---|---|---|
| Mossy Woods | 1 → 12 | 7 | 0.7 | 0.7 |
| Desert Temple | 12 → 24 | 8 | 0.8 | 1.5 |
| Sunken Crypt | 24 → 38 | 10 | 1.0 | 2.5 |
| Frost Peaks | 38 → 51 | 11 | 1.1 | 3.6 |
| Ember Forge | 51 → 65 | 18 | 1.8 | 5.4 |
| Storm Spire | 65 → 78 | 17 | 1.7 | 7.1 |
| Void Citadel | 78 → 93 | 29 | 2.9 | 10.0 |
| Abyssal Void | 93 → 108 | 30 | 3.0 | 13.0 |
| Drowned Cathedral | 108 → 122 | 37 | 3.7 | 16.7 |
| Clockwork Spire | 122 → 136 | 45 | 4.5 | 21.2 |
| Hollow Moon | 136 → 150 | 58 | 5.8 | 26.9 |

## Battle Pass: weeks to finish all 30 tiers

**Changed:** a tier now needs 1500 pass XP instead of 1000. Someone who plays 5 hours a week finishes the season in about 4½ weeks instead of 3. Someone who plays 2 hours a week finishes in about 7 weeks.

**Before**

| Play per week | Pass XP per week | Weeks |
|---|---|---|
| 2 h | 6650 | 4.5 |
| 5 h | 10250 | 2.9 |
| 10 h | 16250 | 1.8 |

**After**

| Play per week | Pass XP per week | Weeks |
|---|---|---|
| 2 h | 6650 | 6.8 |
| 5 h | 10250 | 4.4 |
| 10 h | 16250 | 2.8 |

## Costs, in dungeon clears worth of gold

**Not changed:** crafting and pet feeding are priced in clears of your best dungeon, so they stay the same at every level.

**Before**

| Reroll a bonus | Common → Uncommon | Rare → Epic | Epic → Legendary | Feed a pet (half a level) |
|---|---|---|---|---|
| 0.50 | 1.00 | 4.00 | 8.00 | 0.25 |

**After**

| Reroll a bonus | Common → Uncommon | Rare → Epic | Epic → Legendary | Feed a pet (half a level) |
|---|---|---|---|---|
| 0.50 | 1.00 | 4.00 | 8.00 | 0.25 |
