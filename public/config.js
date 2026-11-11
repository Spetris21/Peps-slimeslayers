/* Slime Slayers - ALL balance numbers and game content live here. Change a number, reload, done.
   The server, the dungeon simulation and guest mode all read this file. Run `npm run sim` after big changes to check the pacing. */
(function (root) {
  'use strict';
  const C = {
    VERSION: 2,
    // ---------- player ----------
    // ---------- Update 7: THE LADDER ----------
    // Every dungeon on every difficulty is one step of LADDER_STEP levels, one after the other. Step k = dungeon x 3 + difficulty needs level max(1, 5k):
    // Mossy Woods Normal 1, Hard 5, Nightmare 10, Desert Temple Normal 15, Hard 20, Nightmare 25 ... the last dungeon's Nightmare 175.
    // 12 dungeons x 3 difficulties = 36 steps, so the max level is 36 x 5 = 180 (the last step has its own 5 levels to grind). Hardcore is the same level as its difficulty.
    // XP: a full Normal clear at level D gives MOB.XP x MOB.XP_GROWTH^(D-1) x MOB.RUN_W x (1 + CLEAR_BONUS) whatever the map's size; a level costs
    // LEVEL_XP x LEVEL_GROWTH^(lv-1). LEVEL_GROWTH is a bit faster than the XP growth, so every step takes longer than the one before it:
    // about 0.25 h per step in Mossy Woods, 3.4 h per step in the last dungeon, 44 h from level 1 to 180 (6 minutes a clear; see BALANCE.md)
    LADDER_STEP: 5,
    MAX_LEVEL: 180, LEVEL_XP: 22, LEVEL_GROWTH: 1.0785, LEVEL_EASY: 8,   // levels below LEVEL_EASY cost less so the first runs feel fast
    BASE_HP: 100, HP_PER_LEVEL: 8,
    HP_GROW: 160,               // Update 7 (final): armour gives no health any more. Your health grows with your level (x the gear growth curve) instead: what
                                // a full set of on-level armour and its Defense used to be worth, so a slayer is as tough as before, whatever they wear
    STAT_PER_LEVEL: 2,          // stat points you get every level
    STAT_POWER: 0.01,           // each point in your class stat (Power / Spell) = +1% damage
    STAT_VIT: 0.0133,           // each point in Vitality = +1.33% health
    REGEN_DELAY: 5, REGEN_PER_SEC: 0,      // no health regen in dungeons: you heal by respawning or with a healing ability
    // ---------- the dungeon clock ----------
    DUN_TIME: 720,              // 12 minutes to beat a dungeon on Normal (Update 7: the maps are 3x bigger); Hard and Nightmare get more (DIFFS time)
    DEATH_PEN: 10,              // every death takes 10 seconds off the clock
    HIT_GRACE: 0.25,   // seconds: a swing or ability that reaches the simulation this much early (20 Hz steps, network jitter) waits instead of being lost
    WALK_SPEED: 8, JUMP: 10, GRAVITY: 28,
    // ---------- classes (switch any time at the Class Trainer) ----------
    // Update 7: two classes, like the reference: the Warrior (Power, all the melee weapons) and the Mage (Spell Power, staffs). The Shadowblade and the
    // Guardian were folded into the Warrior: daggers (with their backstab) and hammers (with their stuns) are Warrior weapons, and their best
    // abilities are on the Warrior's ladder. Old Shadowblades and Guardians become Warriors and keep all their gear.
    CLASSES: {
      warrior: { n: 'Warrior', d: 'Heavy armour and big swings. 25% more health. Swords, greatswords, hammers and daggers.', hp: 1.25, stat: 'pow', weapons: ['sword', 'greatsword', 'hammer', 'dagger'] },
      mage: { n: 'Mage', d: 'Bolts and spells from a safe distance. Staffs. Easiest for solo play.', hp: 1.0, stat: 'spl', weapons: ['staff'] }
    },
    // ---------- combat ----------
    COMBO: [0.55, 0.65, 1.1],   // damage of basic hit 1, 2, 3 (hit 3 hits everything around you). Basic hits are weak: abilities do the real damage
    BASIC: { K: 0.21 },         // Update 7 (final): weapon swings hit with this share of your Power (a third of what they used to: abilities do the real damage)
    SMASH_RADIUS: 3.6,
    CRIT_CHANCE: 0.08, CRIT_MULT: 2,
    DODGE_COOLDOWN: 0.9, DODGE_TIME: 0.38, DODGE_SPEED: 17,
    TYPES: {
      sword:      { n: 'Sword',      speed: 1.0,  range: 3.2, arc: 1.5, aoe: 1.0, pow: 1.0 },
      dagger:     { n: 'Daggers',    speed: 1.55, range: 2.7, arc: 1.3, aoe: 0.8, pow: 0.75 },
      greatsword: { n: 'Greatsword', speed: 0.72, range: 3.8, arc: 1.9, aoe: 1.3, pow: 1.4 },    // Update 6 balance: 1.3 -> 1.4
      hammer:     { n: 'Hammer',     speed: 0.75, range: 3.0, arc: 1.6, aoe: 1.5, pow: 1.17 },   // Update 6 balance: 1.22 -> 1.17 (it also stuns and hits crowds)
      staff:      { n: 'Staff',      speed: 0.95, range: 9.0, arc: 0.7, aoe: 1.1, pow: 1.05, ranged: 1 }
    },
    // ---------- abilities: two slots, Q and E. Every dungeon unlocks its Warrior and Mage abilities when you reach it (t = that dungeon, lv = its
    // Normal level, worked out below). Update 7 (final): every damage ability hits each slime for BASE x your POWER (all your gear, x your class
    // stat points) per cast, x TIER (1.10) for every dungeon further along, so a new dungeon's abilities are always 10% stronger than the last
    // one's, per cast AND per second: every damage ability has the same cooldown (CD; one that leaves something behind waits until it is gone).
    // Abilities differ in their shape (one slime, an arc, a line, an area, a stun, a freeze, lingering hits), never in raw power; multi-hit
    // abilities share the cast's damage out over their hits. Buffs, shields, Blink and heals deal none.
    SPELL_SLOTS: 2,
    ABIL: { TIER: 1.10, BASE: 8, CD: { st: 7, aoe: 7, cc: 7, dot: 7 }, ST_BOSS: 1.5,   // ST_BOSS: single-target abilities deal +50% to bosses, mini-bosses and elites (area ones hit crowds)
      WEAPON_TIER: 1.10 },   // weapon swings: +10% for every dungeon your weapon is from (like the abilities)
    SPELLS: [
      { id: 'cleave', cls: 'warrior', t: 0, role: 'st', n: 'Cleave', cd: 3.5, k: 'arc', r: 4.6, arc: 2.6, el: 'phys', col: '#ff9a4a', d: 'A wide swing that hits everything in front of you.' },
      { id: 'charge', cls: 'warrior', t: 0, role: 'cc', n: 'Charge', cd: 6, k: 'dash', dist: 8, w: 2.4, stun: 0.6, el: 'phys', col: '#ffd06a', d: 'Rush forward, hitting and stunning every slime in your path.' },
      { id: 'fireball', cls: 'mage', t: 0, role: 'st', n: 'Fireball', cd: 2.8, k: 'proj', r: 2.6, range: 16, el: 'fire', col: '#ff6a1a', d: 'A ball of fire that bursts on the first slime it hits.' },
      { id: 'icelance', cls: 'mage', t: 0, role: 'aoe', n: 'Ice Lance', cd: 5, k: 'line', len: 15, w: 1.8, freeze: 1, el: 'frost', col: '#9ae8ff', d: 'A spear of ice through a line of slimes. It freezes them.' },
      { id: 'whirl', cls: 'warrior', t: 1, role: 'aoe', n: 'Whirlwind', cd: 8, k: 'spin', r: 4.4, ticks: 5, dur: 1.5, el: 'phys', col: '#ffb04a', d: 'Spin with your weapon out, hitting all around you five times.' },
      { id: 'twinstrike', cls: 'warrior', t: 1, role: 'st', n: 'Twin Strike', cd: 3, k: 'single', r: 3.8, el: 'phys', col: '#e8e0c8', d: 'Two fast cuts on one slime.' },
      { id: 'mend', cls: 'mage', t: 1, role: 'util', n: 'Mending Light', cd: 30, k: 'heal', heal: 0.05, dur: 4, r: 12, el: 'holy', col: '#7aff9a', d: 'You and every slayer near you heal 5% of your health every second for 4 seconds.' },
      { id: 'nova', cls: 'mage', t: 1, role: 'cc', n: 'Frost Nova', cd: 9, k: 'nova', r: 6, freeze: 2, el: 'frost', col: '#7ad8ff', d: 'A ring of frost bursts out of you and freezes everything near you.' },
      { id: 'sandstorm', cls: 'mage', t: 1, role: 'aoe', n: 'Sandstorm', cd: 12, k: 'spin', r: 5.5, ticks: 8, dur: 2.4, el: 'arcane', col: '#e8c070', d: 'A whirl of burning sand around you that grinds down whatever comes close.' },
      { id: 'fanknives', cls: 'warrior', t: 2, role: 'aoe', n: 'Fan of Knives', cd: 7, k: 'nova', r: 5.5, el: 'phys', col: '#c8c8d8', d: 'Throw knives in every direction.' },
      { id: 'shieldbash', cls: 'warrior', t: 2, role: 'cc', n: 'Shield Bash', cd: 5, k: 'single', r: 3.4, stun: 1.2, el: 'phys', col: '#c8b48a', d: 'Smash one slime so hard it is stunned.' },
      { id: 'barrage', cls: 'mage', t: 2, role: 'st', n: 'Arcane Barrage', cd: 7, k: 'missiles', count: 6, range: 16, el: 'arcane', col: '#c87aff', d: 'Six seeking bolts at the slimes near you.' },
      { id: 'bonespear', cls: 'mage', t: 2, role: 'aoe', n: 'Lantern Spear', cd: 9, k: 'line', len: 18, w: 2, el: 'arcane', col: '#e8e0c8', d: 'A long spear of ghost-light that pierces every slime in a line.' },
      { id: 'quake', cls: 'warrior', t: 3, role: 'cc', n: 'Earthshaker', cd: 9, k: 'nova', r: 5.6, stun: 1.4, el: 'phys', col: '#c8a060', d: 'Slam the ground: everything near you is hit and stunned.' },
      { id: 'cry', cls: 'warrior', t: 3, role: 'util', n: 'War Cry', cd: 24, k: 'buff', buff: 0.35, dur: 8, r: 14, el: 'phys', col: '#ff4a4a', d: 'You and your party deal 35% more damage for 8 seconds.' },
      { id: 'blizzard', cls: 'mage', t: 3, role: 'dot', n: 'Blizzard', cd: 16, k: 'zone', r: 6.5, dur: 4, every: 0.5, freeze: 0.6, range: 16, el: 'frost', col: '#bfe8ff', d: 'A storm of ice over an area: it hurts and freezes for 4 seconds.' },
      { id: 'blink', cls: 'mage', t: 3, role: 'util', n: 'Blink', cd: 6, k: 'blink', dist: 9, el: 'arcane', col: '#b45aff', d: 'Teleport a short way. Great for getting out of a red circle.' },
      // Update 7 (final): the dungeons with a buff or a utility ability get two more damage abilities, so every dungeon has something new that hits hard
      { id: 'frostcleave', cls: 'warrior', t: 3, role: 'aoe', n: 'Frost Cleaver', k: 'arc', r: 5.4, arc: 2.6, el: 'frost', col: '#9ae8ff', d: 'A freezing sweep through everything in front of you.' },
      { id: 'glacier', cls: 'warrior', t: 3, role: 'st', n: 'Glacier Smash', k: 'single', r: 4, stun: 0.8, el: 'frost', col: '#bfe8ff', d: 'Bring a fist of ice down on one slime.' },
      { id: 'comet', cls: 'mage', t: 3, role: 'st', n: 'Frost Comet', k: 'proj', r: 3, range: 17, el: 'frost', col: '#9ae8ff', d: 'A comet of ice that bursts on the first slime it hits.' },
      { id: 'hail', cls: 'mage', t: 3, role: 'aoe', n: 'Hailstorm', k: 'shower', r: 6, strikes: 8, sr: 2.4, dur: 2.4, range: 17, el: 'frost', col: '#bfe8ff', d: 'Eight chunks of hail smash down on an area.' },
      { id: 'leap', cls: 'warrior', t: 4, role: 'aoe', n: 'Leap Slam', cd: 9, k: 'leap', r: 4.8, dist: 8, stun: 1.2, el: 'phys', col: '#ff8a3a', d: 'Jump onto the slimes and crash down, stunning them.' },
      { id: 'flamewave', cls: 'warrior', t: 4, role: 'aoe', n: 'Searing Arc', cd: 10, k: 'arc', r: 7.5, arc: 2.2, el: 'fire', col: '#ff5a1a', d: 'A sweep of molten fire far out in front of you.' },
      { id: 'inferno', cls: 'mage', t: 4, role: 'dot', n: 'Inferno', cd: 12, k: 'zone', r: 4.2, dur: 5, every: 0.5, range: 16, el: 'fire', col: '#ff7a1a', d: 'Set an area on fire for 5 seconds.' },
      { id: 'magmabolt', cls: 'mage', t: 4, role: 'st', n: 'Magma Bolt', cd: 6, k: 'proj', r: 3, range: 15, el: 'fire', col: '#ff9a3a', d: 'A slow, heavy bolt of lava that bursts on impact.' },
      { id: 'shuriken', cls: 'warrior', t: 5, role: 'st', n: 'Storm Shuriken', cd: 9, k: 'missiles', count: 8, range: 14, el: 'phys', col: '#a8c0ff', d: 'Eight spinning stars that find the slimes near you.' },
      { id: 'holycharge', cls: 'warrior', t: 5, role: 'cc', n: 'Thunder Charge', cd: 7, k: 'dash', dist: 8, w: 2.6, stun: 0.8, el: 'storm', col: '#8ab0ff', d: 'A charge that crackles with lightning and stuns.' },
      { id: 'chain', cls: 'mage', t: 5, role: 'aoe', n: 'Chain Lightning', cd: 7, k: 'chain', jumps: 5, range: 14, hop: 7, fall: 0.85, el: 'storm', col: '#8ab0ff', d: 'Lightning that jumps between up to five slimes.' },
      { id: 'turret', cls: 'mage', t: 5, role: 'dot', n: 'Storm Totem', cd: 20, k: 'summon', dur: 8, every: 0.6, range: 11, el: 'storm', col: '#7ad8ff', d: 'A totem that zaps the nearest slime for 8 seconds.' },
      { id: 'shockwave', cls: 'warrior', t: 6, role: 'aoe', n: 'Shockwave', cd: 7, k: 'line', len: 13, w: 2.6, el: 'phys', col: '#d8c8ff', d: 'A wave through the ground in a straight line.' },
      { id: 'iron', cls: 'warrior', t: 6, role: 'util', n: 'Iron Skin', cd: 22, k: 'shield', red: 0.6, dur: 5, el: 'phys', col: '#c8c8d8', d: 'Take 60% less damage for 5 seconds.' },
      { id: 'consecrate', cls: 'mage', t: 6, role: 'dot', n: 'Hallowed Ground', cd: 12, k: 'zone', r: 5, dur: 5, every: 0.5, range: 10, el: 'holy', col: '#ffe08a', d: 'Holy fire on the ground around a spot for 5 seconds.' },
      { id: 'heal', cls: 'mage', t: 6, role: 'util', n: 'Healing Light', cd: 30, k: 'heal', heal: 0.08, dur: 5, r: 14, el: 'holy', col: '#7aff9a', d: 'You and every slayer near you heal 8% of your health every second for 5 seconds.' },
      { id: 'voidrend', cls: 'warrior', t: 6, role: 'aoe', n: 'Void Rend', k: 'arc', r: 6.5, arc: 2.6, el: 'void', col: '#b45aff', d: 'A wide sweep of void that tears through everything in front of you.' },
      { id: 'riftstrike', cls: 'warrior', t: 6, role: 'st', n: 'Rift Strike', k: 'single', r: 4, el: 'void', col: '#c87aff', d: 'Step through a rift and strike one slime from inside it.' },
      { id: 'voidbolt', cls: 'mage', t: 6, role: 'st', n: 'Void Bolt', k: 'proj', r: 3, range: 17, el: 'void', col: '#b45aff', d: 'A bolt of void that bursts on the first slime it hits.' },
      { id: 'nethernova', cls: 'mage', t: 6, role: 'aoe', n: 'Nether Nova', k: 'nova', r: 6.5, el: 'void', col: '#c87aff', d: 'A ring of void bursts out of you, hitting everything near you.' },
      { id: 'garrote', cls: 'warrior', t: 7, role: 'st', n: 'Garrote', cd: 9, k: 'single', r: 3.6, stun: 1.6, el: 'phys', col: '#ff4a6a', d: 'A brutal strike on one slime that stuns it.' },
      { id: 'divineleap', cls: 'warrior', t: 7, role: 'aoe', n: 'Sky Leap', cd: 10, k: 'leap', r: 5, dist: 8, stun: 1, el: 'phys', col: '#ffd84a', d: 'Leap high and come down like a hammer.' },
      { id: 'meteor', cls: 'mage', t: 7, role: 'aoe', n: 'Meteor', cd: 13, k: 'meteor', r: 4.8, delay: 1, range: 18, el: 'fire', col: '#ff5a2a', d: 'Call down a meteor: a huge blast after a second.' },
      { id: 'thorns', cls: 'mage', t: 7, role: 'dot', n: 'Thornfield', cd: 15, k: 'zone', r: 4.5, dur: 4, every: 0.5, root: 2.5, range: 14, el: 'nature', col: '#7aff5a', d: 'Thorny vines that root and cut the slimes on a spot.' },
      { id: 'bladedance', cls: 'warrior', t: 8, role: 'aoe', n: 'Blade Dance', cd: 10, k: 'spin', r: 4.2, ticks: 6, dur: 1.2, el: 'phys', col: '#e8e0ff', d: 'A fast dance of cuts all around you.' },
      { id: 'glitchslash', cls: 'warrior', t: 8, role: 'aoe', n: 'Glitch Slash', k: 'arc', r: 5.6, arc: 2.8, el: 'arcane', col: '#1aff8a', d: 'A slash that skips through space, hitting everything in front of you.' },
      { id: 'bitcrush', cls: 'warrior', t: 8, role: 'st', n: 'Bit Crusher', k: 'single', r: 4.2, stun: 0.6, el: 'arcane', col: '#3affc8', d: 'Crush one slime down to its last pixel.' },
      { id: 'berserk', cls: 'warrior', t: 8, role: 'util', n: 'Berserk', cd: 26, k: 'rage', spd: 0.6, dmg: 0.2, dur: 8, el: 'phys', col: '#ff2a2a', d: 'For 8 seconds you attack 60% faster and deal 20% more damage.' },
      { id: 'radiant', cls: 'mage', t: 8, role: 'cc', n: 'Radiant Nova', cd: 11, k: 'nova', r: 6, stun: 1.6, el: 'holy', col: '#fff0a0', d: 'A blinding burst of light that stuns everything around you.' },
      { id: 'clone', cls: 'mage', t: 8, role: 'dot', n: 'Mirror Image', cd: 24, k: 'summon', dur: 10, every: 0.5, range: 12, el: 'arcane', col: '#3affc8', d: 'A copy of you that casts at the slimes for 10 seconds.' },
      { id: 'chains', cls: 'warrior', t: 9, role: 'cc', n: 'Chain Hook', cd: 11, k: 'pull', self: 1, r: 10, stun: 1.2, el: 'phys', col: '#a8a8b8', d: 'Hooks drag every slime near you in, stunned.' },
      { id: 'deathmark', cls: 'warrior', t: 9, role: 'aoe', n: 'Death Mark', cd: 20, k: 'mark', r: 9, dur: 7, amp: 0.5, range: 14, el: 'phys', col: '#ff3a4a', d: 'Mark the slimes near a spot: they take 50% more damage for 7 seconds.' },
      { id: 'blackhole', cls: 'mage', t: 9, role: 'aoe', n: 'Black Hole', cd: 18, k: 'pull', r: 8, range: 16, delay: 1.6, el: 'arcane', col: '#8a4aff', d: 'Pull slimes into a spot, then crush them.' },
      { id: 'lightchains', cls: 'mage', t: 9, role: 'cc', n: 'Crystal Chains', cd: 12, k: 'pull', self: 1, r: 10, stun: 1.4, el: 'frost', col: '#5affe0', d: 'Chains of crystal drag slimes to you and hold them.' },
      { id: 'execute', cls: 'warrior', t: 10, role: 'st', n: 'Execute', cd: 11, k: 'single', r: 4.6, low: 2, el: 'phys', col: '#ff2a2a', d: 'A finishing blow: double damage to a slime below 30% health.' },
      { id: 'hammerfall', cls: 'warrior', t: 10, role: 'aoe', n: 'Skyfall', cd: 16, k: 'meteor', r: 5, delay: 1, range: 16, el: 'storm', col: '#ffd84a', d: 'Hurl your weapon into the sky: it falls on the spot like a meteor.' },
      { id: 'voidrift', cls: 'mage', t: 10, role: 'aoe', n: 'Void Rift', cd: 16, k: 'pull', r: 9, range: 16, delay: 1.4, el: 'void', col: '#b45aff', d: 'Tear open a rift that drags slimes in and bursts.' },
      { id: 'thunder', cls: 'mage', t: 10, role: 'aoe', n: 'Tempest Chain', cd: 11, k: 'chain', jumps: 8, range: 16, hop: 8, fall: 0.9, el: 'storm', col: '#ffe08a', d: 'Lightning that jumps between up to eight slimes.' },
      { id: 'bladestorm', cls: 'warrior', t: 11, role: 'aoe', n: 'Bladestorm', cd: 18, k: 'spin', r: 6, ticks: 10, dur: 3, el: 'phys', col: '#ffd0a0', d: 'Become a storm of steel for three seconds.' },
      { id: 'assassinate', cls: 'warrior', t: 11, role: 'st', n: 'Assassinate', cd: 12, k: 'single', r: 4, low: 3, el: 'phys', col: '#ff4aff', d: 'Three times the damage to a slime below 30% health.' },
      { id: 'storm', cls: 'mage', t: 11, role: 'aoe', n: 'Starfall', cd: 22, k: 'shower', r: 7, strikes: 9, sr: 2.4, dur: 3, range: 18, el: 'storm', col: '#9ab8ff', d: 'Nine strikes of starlight rain down on an area.' },
      { id: 'doom', cls: 'mage', t: 11, role: 'aoe', n: 'Doom', cd: 24, k: 'mark', r: 10, dur: 8, amp: 0.4, range: 16, el: 'void', col: '#ff2a6a', d: 'Curse the slimes near a spot: they take 40% more damage for 8 seconds.' }
    ],
    // ---------- Update 6: every weapon fights differently (combo, heavy, dash and air attacks), parry, perfect dodge, style, ultimates ----------
    // combo: each hit {m (damage x power), r (reach x weapon range), arc, gap (seconds before the next), fin (last hit: hits all around), kb, up (knock-up stun)}
    // heavy: hold to charge (t seconds to full), m at no charge -> full at full charge. dash: attack out of a dodge. air: a slam when you land from a jump
    MOVESETS: {
      sword: { combo: [{ m: 0.55, r: 1, gap: 0.3 }, { m: 0.65, r: 1, gap: 0.3 }, { m: 0.75, r: 1.05, arc: 1.9, gap: 0.32 }, { m: 1.2, r: 1.1, fin: 1, kb: 3, gap: 0.45 }] },
      greatsword: { combo: [{ m: 0.8, r: 1, arc: 2.2, gap: 0.48 }, { m: 0.95, r: 1.05, arc: 2.4, gap: 0.5 }, { m: 1.6, r: 1.15, fin: 1, kb: 4, gap: 0.62 }], armour: 0.35, armourT: 0.55, d: 'Slow, huge arcs. While swinging you take 35% less damage and can\'t be knocked back.' },
      dagger: { combo: [{ m: 0.38, r: 1, gap: 0.18 }, { m: 0.38, r: 1, gap: 0.18 }, { m: 0.45, r: 1, gap: 0.2 }, { m: 0.5, r: 1, gap: 0.2 }, { m: 0.95, r: 1.1, fin: 1, kb: 2, gap: 0.34 }], backstab: 1.6 },
      hammer: { combo: [{ m: 0.75, r: 1, gap: 0.42 }, { m: 0.85, r: 1, gap: 0.44 }, { m: 1.5, r: 1.1, fin: 1, kb: 1, up: 0.9, gap: 0.6 }] },
      staff: { combo: [{ m: 0.62, bolt: 1, gap: 0.34 }, { m: 0.62, bolt: 1, gap: 0.34 }, { m: 1.0, r: 1, burst: 3.4, fin: 1, kb: 2.5, gap: 0.5 }] }
    },
    PARRY: { WIN: 0.22, CD: 0.9, STUN: 1.6, STYLE: 4 },   // block in the last moment before a hit: no damage, the slime is stunned, your next hit crits
    PDODGE: { WIN: 0.22, STYLE: 3 },                         // dodge at the last moment: time slows for you, your next hit crits
    // style: a hit within GAP seconds keeps the chain; new kinds of move score more; getting hit halves it. Best rank in a run adds gold and XP
    STYLE: { GAP: 3, DECAY: 4, RANKS: ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'], AT: [0, 8, 20, 36, 56, 80, 110], BONUS: [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12] },
    // ability combos: what one ability sets up for another
    COMBOS: { shatter: 0.6, ignite: 0.4, execute: 1.0, stunCrit: 0.25 },   // hit a frozen slime with a physical blow +60% (ends the freeze); fire on a pulled/rooted slime +40%; Execute/Assassinate on a marked slime +100%; +25% crit chance on stunned slimes
    // ---------- controls: every key can be changed in Settings → Controls ('' = not bound). Mouse: left click attacks (hold for a heavy attack), right-drag turns the camera
    KEYS: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: '', jump: 'Space', dodge: 'KeyX', parry: 'KeyV', use: 'KeyF',
      s1: 'KeyQ', s2: 'KeyE', ping: 'KeyT', photo: 'KeyO', emotes: 'KeyG', gear: 'KeyI', char: 'KeyC', spells: 'KeyK', map: 'KeyM' },
    KEY_N: { up: 'Move forward', down: 'Move back', left: 'Move left', right: 'Move right', attack: 'Attack (extra key)', jump: 'Jump', dodge: 'Dodge roll', parry: 'Parry', use: 'Interact',
      s1: 'Ability (Q)', s2: 'Ability (E)', ping: 'Ping a spot (party)', photo: 'Photo mode', emotes: 'Emotes', gear: 'Inventory', char: 'Character', spells: 'Abilities', map: 'Dungeons' },
    // gamepad (standard layout): A jump · B dodge · X attack (hold to keep swinging) · Y interact · LB parry · LT/RT abilities 1-2 · Start settings · Back dungeons
    PAD: { DEAD: 0.18, LOOK: 2.6, HOLD: 0.28 },
    // ---------- gear ----------
    // six rarities: w = how often it drops (Common most), m = how strong its stats are, bonus stats grow with rarity too (AFFIX_COUNT)
    GEAR_RARITY: [
      { n: 'Common', c: '#a3a8b4', w: 52, m: 1 },
      { n: 'Uncommon', c: '#3ddc5a', w: 28, m: 1.2 },
      { n: 'Rare', c: '#3b8cff', w: 13, m: 1.45 },
      { n: 'Epic', c: '#b44dff', w: 5.2, m: 1.75 },
      { n: 'Legendary', c: '#ffc21a', w: 0.6, m: 2.15 },     // Update 7: rarer (was 1.5)
      { n: 'Ultimate', c: '#ff2a2a', w: 0.06, m: 2.7 }      // Update 7: much rarer (was 0.25)
    ],
    GEAR: { POW: 10, HP: 40, DEF: 8, GROWTH: 1.0656, UPGRADE_MAX: 10, UPGRADE_STAT: 0.08, UPGRADE_COST: 25, UPGRADE_GROWTH: 1.38,
      SELL: 6, BUY: 14, INV_MAX: 300, STASH_MAX: 120, LV_SPREAD: 4, CLASS_SHARE: 0.7 },  // CLASS_SHARE: loot is for your class 70% of the time
    // Update 7: loot is never above the level of the run that dropped it: a drop is the run's level or up to LV_SPREAD below
    // six gear slots. Update 7 (final): every piece gives ONE stat, Power (damage), x the item's level, rarity and upgrades; pow = how much a slot gives.
    // Your Power (all six added up, x your class stat points) is what your weapon swings and your abilities hit with
    SLOTS: {
      w: { n: 'Weapon', pow: 1, drop: 30 },
      h: { n: 'Helmet', pow: 0.35, drop: 16 },
      a: { n: 'Armour', pow: 0.5, drop: 18 },
      g: { n: 'Gloves', pow: 0.25, drop: 14 },
      b: { n: 'Boots', pow: 0.25, drop: 14 },
      r: { n: 'Ring', pow: 0.25, drop: 8 }
    },
    SLOT_ORDER: ['w', 'h', 'a', 'g', 'b', 'r'],
    // ---------- loot that drops in the dungeon (everyone gets their own drops) ----------
    // gear only drops from the FINAL BOSS: 4 random items for every player. Nothing else drops gear, and there are no health potions.
    DROPS: { BOSS_ITEMS: 4, PICK_R: 2.0, AUTO_DELAY: 2.5 },
    // gear from each dungeon has its own look (armour colours) and name
    GEAR_TIERS: [
      { p: 'Mossbark', g1: '#2e3a22', g2: '#5a6a2a', glow: '#7aff5a', w: '#7a6a4a' },
      { p: 'Sunscorched', g1: '#6a5228', g2: '#c8a050', glow: '#ffcf5a', w: '#d8c08a' },
      { p: 'Gravebound', g1: '#2a2d36', g2: '#4a5a6a', glow: '#7ad8ff', w: '#c8c8d0' },
      { p: 'Rimeforged', g1: '#4a6a8a', g2: '#bfe8ff', glow: '#9ae8ff', w: '#d8f0ff' },
      { p: 'Emberforged', g1: '#3a1a12', g2: '#8a2a1a', glow: '#ff7a1a', w: '#ff9a5a' },
      { p: 'Stormcaller', g1: '#22243a', g2: '#4a5a9a', glow: '#8ab0ff', w: '#a8c0ff' },
      { p: 'Voidtouched', g1: '#1a0e2a', g2: '#5a2a8a', glow: '#c87aff', w: '#8a4aff' },
      { p: 'Abyssal', g1: '#0e0a14', g2: '#3a0a2a', glow: '#ff2a6a', w: '#5a1a3a' },
      { p: 'Glitched', g1: '#0a1a10', g2: '#1aff8a', glow: '#1aff8a', w: '#1aff8a' },
      // Update 6 worlds
      { p: 'Tidebound', g1: '#0e2a30', g2: '#2a8a8a', glow: '#5affe0', w: '#9adfd8' },
      { p: 'Clockwork', g1: '#2a1e10', g2: '#c8963a', glow: '#ffc84a', w: '#e8c070' },
      { p: 'Lunar', g1: '#1a1e2e', g2: '#b8c4ff', glow: '#d8e4ff', w: '#e8eeff' }
    ],
    // ---------- slimes (stats scale with the dungeon level; these are multipliers) ----------
    // Update 7: slimes follow the ladder. Their level is the step's level; STEP_HP / STEP_DMG make every step a little tougher again on top of that (STEP_HP
    // also soaks up the abilities' 15% and the weapons' 12% per dungeon, so a boss takes about as long to beat at the end as at the start), so the
    // next step (even the next dungeon's Normal after a Nightmare) is always harder than the one before. RUN_W: a full Normal clear is worth this many
    // slimes of XP and gold, however many slimes the map has (each slime pays its share by its health), so bigger maps never change the pace
    // PARTY_HP: every slime, mini-boss and boss has x1.5 health for every player who joins (2 players x1.5, 3 x2.25, 4 x3.4; max 4 per run)
    MOB: { HP: 62, DMG: 8, XP: 0.38, XP_GROWTH: 1.0624, GOLD: 3, GROWTH: 1.0656, HP_LEVEL: 0.02, PARTY_HP: 1.5, MINI_HP: 8, BOSS_HP: 22, BOSS_DMG: 1.3, MINI_DMG: 2.1, STEP_HP: 1.0323, STEP_DMG: 1.01, RUN_W: 100, HC_DMG: 1.15,
      HPK: { mob: 1.4, elite: 1.4, mini: 2.5, boss: 2 },   // Update 7 (final): tougher slimes (x1.4), mini-bosses (x2.5) and bosses (x2), in every mode. STEP_HP: 1.10 a dungeon (3 steps), like the abilities
      // (the longer boss fights hit a little softer, BOSS_DMG 1.6 -> 1.3 and MINI_DMG 2.6 -> 2.1, so a boss is tougher to kill, not twice as deadly)
      SIZE: { mob: 1.45, elite: 1.3, mini: 1.15 } },   // Update 7 (final): slimes are drawn and collide this much bigger so they fit the big maps (bosses keep their size)
    // slimes hunt you through the whole dungeon (through open gates, round pillars); they only give up and go home when nobody is alive for RESET seconds
    CHASE: { SPEED: 4.6, ELITE: 3.8, RESET: 10 },
    // boss mechanics: HEART = the heart's health (share of the boss's), ORB = hunting orbs' health (x a normal slime) and speed, ONE_HIT = the safe-zone blast takes this share of your max health (at least)
    BOSS: { HEART: 0.06, ORB_HP: 0.35, ORB_SPEED: 4.4, ORB_LIFE: 9, ONE_HIT: 0.55, HEAL: 0.025, HEAL_EVERY: 2, POOL_TICK: 0.06, HUG: 2.2,
      SAFE: { R: 4.2, NEAR: 5, FAR: 11, T: 4.2 } },   // the safe-zone blast (Update 7 final): green circles of radius R, NEAR-FAR m from each slayer, at least T seconds to get in   // HUG: stand against a boss this long and it stomps
    // room hazards: POOL = share of max health every half second you stand in it; VENT = share of max health when it erupts
    HAZ: { POOL: 0.05, VENT: 0.16, VENT_PERIOD: 4.6, VENT_WARN: 0.9, VENT_UP: 0.5,
      // Update 6 world mechanics. TIDE: the room floods (stand on a raised dais), share of max health every half second + slower; BLADE: spinning clockwork arms
      // (jump over them), share of max health per hit; STAR: falling stars that land on a marked spot like vents; ICE: slippery floor; SAND: quicksand slows you
      TIDE: 0.05, TIDE_PERIOD: 15, TIDE_WARN: 2.6, TIDE_UP: 4.5, TIDE_SLOW: 0.55, BLADE: 0.14, BLADE_SPEED: 1.15, STAR: 0.2, STAR_PERIOD: 6.2, STAR_WARN: 1.6, STAR_UP: 0.45, SAND_SLOW: 0.5,
      LOW_GRAVITY: 0.48 },   // the Hollow Moon: gravity x this (higher, floatier jumps)
    MOBS: {
      moss: { n: 'Moss Beast', col: '#3d7a2e', feat: 'plain', hp: 0.7, dmg: 0.8, size: 0.75 }, shroom: { n: 'Mushroom Crawler', col: '#7a3a2a', feat: 'shroom', beh: 'spit', hp: 1, dmg: 1, size: 0.85 },
      thorn: { n: 'Thorn Creeper', col: '#2a5a24', feat: 'thorns', beh: 'burrow', hp: 1.5, dmg: 1.3, size: 0.95 }, brute: { n: 'Moss Brute', col: '#1f4a1c', feat: 'horns', hp: 6, dmg: 2.2, size: 1.5, elite: 1 }, barkwarden: { n: 'The Bark Warden', col: '#4a3a22', feat: 'horns', hp: 6, dmg: 2.2, size: 1.6, elite: 1 },
      treant: { n: 'Rotwood Treant Slime', col: '#3a2a1a', feat: 'treant', size: 3.6, boss: 1 },
      sand: { n: 'Sand Serpent', col: '#c8a060', feat: 'plain', beh: 'burrow', hp: 0.7, dmg: 0.8, size: 0.75 }, scarab: { n: 'Scarab Swarm', col: '#1e3a4a', feat: 'horns', beh: 'split', hp: 1, dmg: 1, size: 0.85 },
      mummy: { n: 'Mummified Walker', col: '#a89a7a', feat: 'wrap', beh: 'shield', hp: 1.5, dmg: 1.3, size: 0.95 }, guard: { n: 'Jackal Guard', col: '#7a5a1a', feat: 'helm', hp: 6, dmg: 2.2, size: 1.5, elite: 1 }, sandseer: { n: 'The Sand Seer', col: '#c8a05a', feat: 'wrap', hp: 6, dmg: 2.2, size: 1.5, elite: 1 },
      pharaoh: { n: 'The Slime Pharaoh', col: '#3a2e14', feat: 'pharaoh', size: 3.7, boss: 1 },
      bone: { n: 'Skeletal Slime', col: '#b8b0a0', feat: 'skull', beh: 'split', hp: 0.7, dmg: 0.8, size: 0.8 }, ghost: { n: 'Ghost Slime', col: '#6aa0b8', feat: 'ghost', beh: 'blink', hp: 1, dmg: 1, size: 0.85 },
      grave: { n: 'Grave Crawler', col: '#3a3a44', feat: 'tomb', beh: 'summon', hp: 1.5, dmg: 1.3, size: 1.0 }, cknight: { n: 'Crypt Knight Slime', col: '#2a2a33', feat: 'helm', hp: 6, dmg: 2.2, size: 1.55, elite: 1 },
      lich: { n: 'The Lich Slime', col: '#1a2a2a', feat: 'lich', size: 3.8, boss: 1 },
      ice: { n: 'Frost Bat', col: '#7ab8e8', feat: 'icicles', beh: 'fly', hp: 0.7, dmg: 0.8, size: 0.85 }, snow: { n: 'Ice Wolf', col: '#d8e4f0', feat: 'plain', beh: 'charge', hp: 1, dmg: 1, size: 0.95 },
      yeti: { n: 'Snow Golem', col: '#c8d0dc', feat: 'horns', beh: 'spit', hp: 1.5, dmg: 1.3, size: 1.1 }, frostgiant: { n: 'Frost Giant Slime', col: '#5a8ab8', feat: 'crown', hp: 6, dmg: 2.2, size: 1.6, elite: 1 }, rimewitch: { n: 'The Rime Witch', col: '#8ab8e0', feat: 'crown', hp: 6, dmg: 2.2, size: 1.5, elite: 1 },
      wyrm: { n: 'Frost Wyrm Slime', col: '#3a6a9a', feat: 'wyrm', size: 4.0, boss: 1 },
      magma: { n: 'Magma Hound', col: '#c83a10', feat: 'cracks', beh: 'charge', hp: 0.7, dmg: 0.8, size: 0.85 }, cinder: { n: 'Forge Imp', col: '#3a2a26', feat: 'cracks', beh: 'bomb', hp: 1, dmg: 1, size: 0.95 },
      forge: { n: 'Cinder Golem', col: '#5a4a44', feat: 'helm', beh: 'shield', hp: 1.5, dmg: 1.3, size: 1.1 }, pyro: { n: 'Pyrelord Slime', col: '#8a1a0a', feat: 'horns', hp: 6, dmg: 2.2, size: 1.6, elite: 1 },
      titan: { n: 'Inferno Titan Slime', col: '#5a1a0a', feat: 'titan', size: 4.2, boss: 1 },
      spark: { n: 'Spark Wisp', col: '#4a6aff', feat: 'plain', beh: 'blink', hp: 0.7, dmg: 0.8, size: 0.85 }, cloud: { n: 'Cloud Jelly', col: '#8a8aa8', feat: 'ghost', beh: 'heal', hp: 1, dmg: 1, size: 0.95 },
      thunder: { n: 'Thunder Beetle', col: '#3a3a8a', feat: 'horns', beh: 'charge', hp: 1.5, dmg: 1.3, size: 1.1 }, tempest: { n: 'Tempest Slime', col: '#2a2a6a', feat: 'crown', hp: 6, dmg: 2.2, size: 1.6, elite: 1 },
      dragon: { n: 'Storm Dragon Slime', col: '#1a1a4a', feat: 'dragon', size: 4.4, boss: 1 },
      voidling: { n: 'Void Eye', col: '#5a2a8a', feat: 'plain', beh: 'spit', hp: 0.7, dmg: 0.8, size: 0.85 }, shade: { n: 'Shadow Stalker', col: '#1a0a2a', feat: 'ghost', beh: 'blink', hp: 1, dmg: 1, size: 0.95 },
      abyss: { n: 'Crystal Knight', col: '#2a0a4a', feat: 'thorns', beh: 'shield', hp: 1.5, dmg: 1.3, size: 1.1 }, voidknight: { n: 'Void Knight Slime', col: '#140820', feat: 'helm', hp: 6, dmg: 2.2, size: 1.6, elite: 1 },
      king: { n: 'The Slime King', col: '#2a0a3a', feat: 'king', size: 4.8, boss: 1 },
      eye: { n: 'Eye Cluster', col: '#2a0a1a', feat: 'eyes', beh: 'summon', hp: 0.7, dmg: 0.8, size: 0.85 }, tendril: { n: 'Tentacle Crawler', col: '#3a0a2a', feat: 'tentacles', beh: 'burrow', hp: 1, dmg: 1, size: 0.95 },
      maw: { n: 'Maw Beast', col: '#1a0610', feat: 'maw', hp: 1.5, dmg: 1.3, size: 1.1 }, horror: { n: 'Abyssal Horror', col: '#0e0408', feat: 'horror', hp: 6, dmg: 2.2, size: 1.7, elite: 1 },
      abyssal: { n: 'The Abyssal Lord', col: '#12040c', feat: 'abyssal', size: 5, boss: 1 },
      glitchling: { n: 'Pixel Swarm', col: '#14a860', feat: 'cubes', beh: 'split', hp: 0.8, dmg: 1, size: 0.85 }, nullslime: { n: 'Broken Crawler', col: '#0a0a0a', feat: 'cubes', beh: 'bomb', hp: 1.4, dmg: 1.3, size: 1.0 },
      errorknight: { n: 'ERROR Knight', col: '#ff2a6a', feat: 'helm', hp: 6, dmg: 2.2, size: 1.6, elite: 1 }, glitchking: { n: 'The Corrupted', col: '#0a1a10', feat: 'cubes', size: 4.6, boss: 1 },
      // Update 6: the Drowned Cathedral, the Clockwork Spire, the Hollow Moon
      chorister: { n: 'Drowned Chorister', col: '#1a5a5a', feat: 'ghost', beh: 'heal', hp: 0.8, dmg: 0.8, size: 0.9 },
      barnacle: { n: 'Barnacle Slime', col: '#3a4a3a', feat: 'cracks', beh: 'shield', hp: 1.3, dmg: 1, size: 1.05 },
      eel: { n: 'Lamprey Slime', col: '#0e2a2a', feat: 'tentacles', beh: 'charge', hp: 0.9, dmg: 1.2, size: 0.95 },
      bellringer: { n: 'The Bell-Ringer', col: '#2a3a3a', feat: 'helm', hp: 6, dmg: 2.2, size: 1.7, elite: 1 },
      abbess: { n: 'The Drowned Abbess', col: '#0a2a2e', feat: 'ghost', hp: 6, dmg: 2.2, size: 1.75, elite: 1 },
      leviathan: { n: 'The Leviathan Bishop', col: '#0a2026', feat: 'tentacles', size: 5, boss: 1 },
      cog: { n: 'Cog Slime', col: '#6a4a1a', feat: 'cubes', beh: 'split', hp: 1, dmg: 0.9, size: 1 },
      piston: { n: 'Piston Slime', col: '#3a2e22', feat: 'helm', beh: 'charge', hp: 1.2, dmg: 1.2, size: 1 },
      spring: { n: 'Springjack', col: '#8a6a2a', feat: 'horns', beh: 'bomb', hp: 0.6, dmg: 1, size: 0.8 },
      foreman: { n: 'Foreman Gearheart', col: '#4a3418', feat: 'helm', hp: 6.5, dmg: 2.2, size: 1.8, elite: 1 },
      pendulum: { n: 'The Pendulum Knight', col: '#2a2418', feat: 'crown', hp: 6, dmg: 2.3, size: 1.7, elite: 1 },
      clockmaker: { n: 'The Clockmaker', col: '#3a2a14', feat: 'king', size: 4.8, boss: 1 },
      moth: { n: 'Moon Moth', col: '#c8ccf0', feat: 'eyes', beh: 'fly', hp: 0.7, dmg: 0.9, size: 0.85 },
      crater: { n: 'Crater Slime', col: '#6a6e80', feat: 'cracks', beh: 'burrow', hp: 1.2, dmg: 1.1, size: 1 },
      starspawn: { n: 'Starspawn', col: '#e8e0ff', feat: 'icicles', beh: 'blink', hp: 0.8, dmg: 1.2, size: 0.85 },
      hound: { n: 'The Lunar Hound', col: '#4a4e66', feat: 'horns', hp: 6, dmg: 2.3, size: 1.75, elite: 1 },
      eclipse: { n: 'The Eclipse Priest', col: '#14121e', feat: 'lich', hp: 6, dmg: 2.2, size: 1.7, elite: 1 },
      mooneater: { n: 'The Moon Eater', col: '#1a1c2a', feat: 'maw', size: 5.2, boss: 1 },
      mimic: { n: 'Mimic', col: '#3a2412', feat: 'mimic', hp: 8, dmg: 2.4, size: 1.35, elite: 1 },
      // second mini-bosses (the longer dungeons have two)
      banshee: { n: 'Wailing Banshee', col: '#5a8a9a', feat: 'ghost', hp: 6, dmg: 2.2, size: 1.6, elite: 1 },
      smelter: { n: 'Slag Smelter', col: '#4a3a34', feat: 'cracks', hp: 6, dmg: 2.2, size: 1.75, elite: 1 },
      conduit: { n: 'Conduit Sentinel', col: '#2a3a7a', feat: 'crown', hp: 6, dmg: 2.2, size: 1.65, elite: 1 },
      archon: { n: 'Void Archon', col: '#2a1248', feat: 'helm', hp: 6, dmg: 2.2, size: 1.7, elite: 1 },
      leech: { n: 'Leech Matriarch', col: '#3a0a22', feat: 'tentacles', hp: 6, dmg: 2.2, size: 1.75, elite: 1 },
      segfault: { n: 'SEGFAULT', col: '#5a0a24', feat: 'cubes', hp: 6, dmg: 2.2, size: 1.6, elite: 1 },
      // boss mechanics: a heart that keeps the boss immune, and orbs that hunt you
      heart: { n: 'Bound Heart', col: '#8a0a2a', feat: 'heart', hp: 1, dmg: 0, size: 1.3 },
      orb: { n: 'Hunting Orb', col: '#6a1a8a', feat: 'orb', hp: 1, dmg: 1, size: 0.6 }
    },
    // ---------- how slimes fight (MOBS[id].beh; none = the classic wind-up pounce). Every attack is shown on the floor first.
    BEH: {
      spit: { range: 9, keep: 5, wind: 0.7, travel: 0.8, r: 1.5, mult: 0.85, cd: 2.4 },        // lobs a glob at where you stand
      charge: { wind: 0.9, dist: 10, w: 1.0, mult: 1.1, cd: 2.6, near: 9 },                       // a red lane, then a dash along it
      fly: { hover: 1.7, wind: 0.75, r: 1.7, mult: 0.85 },                                        // hovers over you, then dives onto a circle
      burrow: { cd: 3.2, under: 2.2, speed: 1.9, wind: 0.85, r: 1.9, mult: 1.1 },                 // digs in (can't be hit), comes up under you
      shield: { red: 0.55, arc: 1.1, slow: 0.85 },                                                // takes 55% less damage from the front: hit it from behind
      split: { n: 2, sc: 0.62, hp: 0.3 },                                                          // splits into smaller slimes when killed
      heal: { every: 3.5, r: 8, pct: 0.12, keep: 6 },                                              // heals the slimes around it: kill it first
      summon: { every: 6.5, max: 2, sc: 0.7, hp: 0.45, keep: 6 },                                  // calls small slimes
      bomb: { speed: 1.35, fuse: 1.1, r: 2.7, mult: 1.7 },                                         // runs at you and explodes (kill it before the fuse ends)
      blink: { every: 4.5, out: 0.4, dist: 3.2 }                                                   // vanishes and reappears next to you, then pounces
    },
    // elites and mini-bosses can roll a modifier (shown by their aura): chance per elite, and the effects
    ELITE_MODS: { CHANCE: 0.6, MINI: 0.85, LIST: ['fast', 'shield', 'vamp', 'boom', 'frenzy'],
      fast: { spd: 1.35, wind: 0.8 }, shield: { hp: 0.3 }, vamp: { heal: 0.35 }, boom: { r: 3.6, fuse: 1.3, mult: 1.4 }, frenzy: { at: 0.5, spd: 1.4, wind: 0.7 } },
    // ---------- the Wilds (Update 6): an open overworld west of Duskhold, through the Wildgate Market. Camps of slimes (from every dungeon you have
    // reached, scaled to your best dungeon) wake when you come near and come back RESPAWN seconds after you clear them. Leave through the gate to be paid
    // for every camp cleared. Five hidden wayshrines (E) and one lost lantern in every dungeon are secrets to find.
    WILD: { X: -1700, Z: 0, R: 110, CAMPS: 11, WAKE: 15, RESPAWN: 70, PACK: [4, 6, 7], ELITE_AT: 1,
      WAYS: 5, WAY_GOLD: 1, WAY_ALL: 4, LANTERN_GOLD: 0.6, LANTERN_ALL: 5 },   // secrets pay gold: this many Normal clears of your best dungeon
    RELIC_GOLD: 0.6,                    // each hidden relic (Normal clears of your best dungeon)
    BESTIARY: { GOLD: 0.6, STEP: 0.18 },   // a finished bestiary page pays GOLD + STEP x the world's number (Normal clears of your best dungeon)
    // ---------- Update 6 · Phase 5: more to do ----------
    // the Endless Tower (in the Pit's arena): floor after floor; HEAL = share of health back after each floor; mutators from MUT_FROM
    TOWER: { MOBS: 5, ADD: 0.5, GROWTH: 1.09, DMG_GROWTH: 1.045, MINI_EVERY: 5, BOSS_EVERY: 10, BOSS_HP: 0.35, MUT_FROM: 3, HEAL: 0.35, PASS_XP: 40 },
    // mutators: a twist on a floor (the Tower) — most turn every slime into an elite of that kind
    MUTATORS: [
      { id: 'haste', n: 'Haste', d: 'Every slime is fast', mod: 'fast', col: '#7ad8ff' },
      { id: 'volatile', n: 'Volatile', d: 'Every slime explodes when it dies', mod: 'boom', col: '#ff8a3a' },
      { id: 'vampire', n: 'Bloodthirst', d: 'Slimes heal when they hit you', mod: 'vamp', col: '#ff2a4a' },
      { id: 'ironhide', n: 'Ironhide', d: 'Every slime has a shield to break first', mod: 'shield', col: '#c8c8d8' },
      { id: 'frenzy', n: 'Frenzy', d: 'Slimes go berserk below half health', mod: 'frenzy', col: '#ff5a1a' },
      { id: 'glass', n: 'Glass Cannon', d: 'You deal 60% more damage and take 60% more', dealt: 1.6, taken: 1.6, col: '#e8e0ff' },
      { id: 'giants', n: 'Giants', d: 'Half as many slimes, twice the size and three times the health', giants: 1, col: '#9aff6a' },
      { id: 'swarm', n: 'Swarm', d: 'Twice as many slimes with a third of the health', swarm: 1, col: '#ffd84a' }
    ],
    // the Battle Pass: free for everyone (no real money anywhere in this game). TIER_XP per tier; every run also gives a little XP
    PASS: { SEASON: 'Season 1 · The Turning Moon', TIERS: 30, TIER_XP: 1500, RUN_XP: { dungeon: 200, pit: 100, wild: 50, tower: 65, raid: 330 },   // Update 7 (final): runs give more pass XP (weekly challenges are gone)
      REWARDS: [['gold', 1], ['gold', 0.9], ['gold', 2], ['dust', 40], ['gold', 1.2], ['title', 'climber'], ['gold', 3], ['gold', 1.5], ['dust', 80], ['cosm', 'trailMoon'],
        ['gold', 4], ['gold', 1.8], ['dust', 120], ['gold', 5], ['cosm', 'capeTide'], ['gold', 2.1], ['gold', 6], ['dust', 160], ['gold', 2.4], ['title', 'tidecaller'],
        ['gold', 8], ['gold', 2.7], ['dust', 220], ['gold', 10], ['cosm', 'trailClock'], ['gold', 3], ['gold', 12], ['dust', 300], ['gold', 3.6], ['cosm', 'capeMoon']] },   // gold = this many runs' worth of gold
    PASS_COSM: { trailMoon: { k: 'trail', v: '#d8e4ff', n: 'Moonlit Trail' }, capeTide: { k: 'cape', v: '#1a6a6a', n: 'Tidecaller Cape' }, trailClock: { k: 'trail', v: '#ffc84a', n: 'Brass Trail' }, capeMoon: { k: 'cape', v: '#c8ccf0', n: 'Lunar Mantle' } },
    // crafting at the Forge: salvage gear into dust (by rarity), then spend dust and gold to reroll a bonus or raise an item's rarity
    CRAFT: { SALVAGE: [2, 5, 12, 30, 70, 150, 300], RARITY: { dust: [40, 90, 200, 450, 900], gold: [1, 2, 4, 8, 16] }, MAX_RARITY: 5 },   // gold = runs' worth
    // duels: 1 v 1 in the Pit's arena, weapons only (no abilities), everyone at the same health and damage. First to WINS knock-outs
    // Update 6 balance: a hit does PER_M x the move's multiplier x the weapon's power (see MOVESETS / TYPES), so every weapon knocks out in about 6 s
    DUEL: { HP: 1000, PER_M: 100, BACKSTAB: true, CRIT: 1.5, WINS: 3, RESPAWN: 2.5, GOLD_WIN: 0.6, GOLD_LOSS: 0.2, TIME: 240 },
    // world boss raids in Duskhold rotate between these (the hour the raid starts picks one)
    WORLD_BOSSES: [{ n: 'The Colossal Slime', rig: 'king', col: '#1a0a1a' }, { n: 'The Drowned Leviathan', rig: 'leviathan', col: '#0a2026' }, { n: 'The Great Clockwork', rig: 'clockmaker', col: '#3a2a14' },
      { n: 'The Moon Eater', rig: 'mooneater', col: '#1a1c2a' }, { n: 'The Inferno Titan', rig: 'titan', col: '#5a1a0a' }],
    TUTORIAL: { GOLD: 1.5, STEPS: [['move', 'Move with {up} {left} {down} {right} (or the left stick)'], ['combo', 'Attack 4 times in a row: click, click, click, click (or hold the attack to keep swinging)'],
      ['dodge', 'Dodge roll with {dodge}'], ['jump', 'Jump with {jump}'], ['parry', 'Parry with {parry} (just before a hit lands in a fight)'], ['gear', 'Open your Inventory with {gear}'], ['portal', 'Climb the great stairs to the Grand Gate and walk into the green Mossy Woods portal']] },   // {action} = the key it is bound to
    // ---------- sound (Update 6 · phase 7): a score per place (root MIDI note, scale, beat in seconds, pad wave, pad filter Hz, bell octave
    // offset, drone level, percussion kind), the ambience bed per place, and the footstep sound per dungeon
    MUSIC: {
      // Update 7 (final): every place has its own composed track. bpm, root (MIDI note), scale, prog (the chord of each bar, a scale degree), lead (the tune:
      // one string a bar, 16 steps; 0-9 a-d = scale degrees over two octaves, '-' holds, '.' rests), inst (the lead's sound: pluck, flute, reed, bell, organ,
      // saw, chip, glass, box), bass ('R' root, '5' fifth, 'O' octave, '-' holds), k / s / h (kick, snare, hat: x loud, o soft), town (the drums and the tune
      // also play out of a fight), pad (the chord's wave). Out of a fight a dungeon plays its pad, bass and a quiet tune; drums join when you fight
      TRACKS: {
        hub: { bpm: 92, root: 50, scale: 'dorian', prog: [0, 3, 0, 6, 2, 3, 6, 0], inst: 'pluck', pad: 'triangle', town: 1,
          lead: ['7...6.4.5...4.2.', '3...4.5.6...5...', '7.7.8.7.6.4.5...', '4.3.2.1.0.......', '2...4...7...6.5.', '4...3...2.3.4...', '7.8.9.8.7...6.4.', '5...4...0.......'],
          bass: 'R...5...R...5...', k: 'x.......x.......', s: '........o.......', h: '..o...o...o...o.' },
        woods: { bpm: 108, root: 55, scale: 'dorian', prog: [0, 6, 3, 4], inst: 'flute', pad: 'triangle',
          lead: ['0.2.4...3.2.0...', '6...5.4.3...4...', '2.4.7...6.4.5...', '4...2...0.......'], bass: 'R.R...5.R.....5.', k: 'x.....x...x.....', s: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' },
        desert: { bpm: 100, root: 52, scale: 'phryg', prog: [0, 1, 0, 6], inst: 'reed', pad: 'sawtooth',
          lead: ['7.8.7.6.5...4...', '5.6.5.4.2.1.0...', '4...5.6.7.8.7.6.', '5.4.2.1.0.......'], bass: 'R..R..R.5..5..R.', k: 'x..x..x...x..x..', s: '....x.......x...', h: '..o...o...o...o.' },
        crypt: { bpm: 76, root: 48, scale: 'minor', prog: [0, 5, 3, 4], inst: 'organ', pad: 'sawtooth',
          lead: ['7-------6---5---', '4-------2---3---', '4---5---6---7---', '6---4---5-------'], bass: 'R-------5-------', k: 'x.......x..x....', s: '........x.......', h: '................' },
        frost: { bpm: 92, root: 57, scale: 'minor', prog: [0, 5, 2, 6], inst: 'glass', pad: 'triangle',
          lead: ['7...9...b...9...', '8...7...5...4...', '7.9.b.9.7.5.4.5.', '4...2...0.......'], bass: 'R.......5.......', k: 'x.......x.......', s: '....o.......o...', h: 'o...o...o...o...' },
        ember: { bpm: 132, root: 50, scale: 'phryg', prog: [0, 0, 1, 6], inst: 'saw', pad: 'sawtooth',
          lead: ['0.0.1.0.3.1.0...', '4.4.5.4.3.1.0...', '7.7.8.7.6.5.4.3.', '4...3...1...0...'], bass: 'R.R.R.R.R.R.R.R.', k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
        storm: { bpm: 140, root: 47, scale: 'minor', prog: [0, 5, 3, 4], inst: 'chip', pad: 'square',
          lead: ['0.4.7.b.7.4.0.4.', '5.7.c.7.5.3.0.3.', '3.5.a.c.a.5.3.5.', '4.6.8.b.8.6.4.6.'], bass: 'R..R..R.R..R..R.', k: 'x...x...x...x...', s: '....x.......x...', h: 'oooooooooooooooo' },
        void: { bpm: 84, root: 49, scale: 'whole', prog: [0, 3, 1, 4], inst: 'glass', pad: 'sine',
          lead: ['0-------3-------', '5-------2-------', '4---3---2---1---', '0---------------'], bass: 'R---------------', k: 'x.......x.......', s: '............x...', h: '..o.......o.....' },
        abyss: { bpm: 72, root: 45, scale: 'loc', prog: [0, 1, 0, 4], inst: 'organ', pad: 'sawtooth',
          lead: ['0-----------1---', '................', '4-------3-------', '1---------------'], bass: 'R-------R-------', k: 'x...............', s: '........x.......', h: '................' },
        glitch: { bpm: 150, root: 53, scale: 'lyd', prog: [0, 1, 5, 4], inst: 'chip', pad: 'square',
          lead: ['0.2.4.7.9.7.4.2.', '0.2.4.7.9.b.9.7.', '8.7.6.4.6.7.8.9.', '7.7.4.4.0.0.4...'], bass: 'R.O.R.O.R.O.R.O.', k: 'x...x...x...x...', s: '....x.......x.x.', h: 'x.x.x.x.x.x.x.x.' },
        drowned: { bpm: 84, root: 43, scale: 'minor', prog: [0, 3, 5, 4], inst: 'flute', pad: 'triangle',
          lead: ['4..3..2..0..2...', '3..4..5..4..3...', '7..6..4..5..4...', '2..1..0.........'], bass: 'R.....5.....R...', k: 'x.....x.....x...', s: '......x.........', h: 'o..o..o..o..o...' },
        clock: { bpm: 120, root: 49, scale: 'harm', prog: [0, 3, 4, 0], inst: 'box', pad: 'square',
          lead: ['7.6.7.4.2.4.0...', '7.6.7.4.2.4.7...', '8.7.8.5.3.5.1...', '6.5.4.3.2.1.0...'], bass: 'R...R...5...5...', k: 'x.......x.......', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
        moon: { bpm: 70, root: 51, scale: 'lyd', prog: [0, 1, 0, 4], inst: 'bell', pad: 'sine',
          lead: ['7-------9-------', 'b-------9---7---', '6-------7-------', '4---------------'], bass: 'R-------5-------', k: 'x...............', s: '........o.......', h: '....o.......o...' },
        arena: { bpm: 138, root: 45, scale: 'harm', prog: [0, 3, 4, 0], inst: 'saw', pad: 'sawtooth',
          lead: ['0.0.3.0.4.3.0...', '0.0.3.0.6.5.4...', '7.7.6.4.3.4.6...', '4.3.2.1.0.......'], bass: 'R.R.R.R.5.5.5.5.', k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }
      },
      ALIAS: { wild: 'woods', tower: 'arena', pit: 'arena', duel: 'arena', raid: 'arena' },   // the other modes play one of the tracks above
      AMB: { hub: 'town', woods: 'wind', desert: 'sand', crypt: 'drip', frost: 'wind', ember: 'lava', storm: 'storm', void: 'hum', abyss: 'hum', glitch: 'hum', drowned: 'water', clock: 'clock', moon: 'space', wild: 'wind', tower: 'hum', pit: 'town', duel: 'town', raid: 'lava' },
      SURF: { woods: 'grass', wild: 'grass', desert: 'sand', frost: 'snow', clock: 'metal', drowned: 'water', glitch: 'metal', storm: 'stone' }
    },
    // ---------- dungeons: unlock by level; each has rooms of waves, a mini-boss and a boss ----------
    DUNGEONS: [
      { id: 'woods', n: 'Mossy Woods', lvl: 1, theme: 0, col: '#4f9a4a', mobs: ['moss', 'shroom', 'thorn'], elite: 'brute', minis: ['brute', 'barkwarden'], boss: 'treant', d: 'A rotting forest where the first slimes crawled out of the ground.' },
      { id: 'desert', n: 'Desert Temple', lvl: 15, theme: 6, col: '#d8a84a', mobs: ['sand', 'scarab', 'mummy'], elite: 'guard', minis: ['guard', 'sandseer'], boss: 'pharaoh', d: 'A buried temple. Its pharaoh never really died.' },
      { id: 'crypt', n: 'Sunken Crypt', lvl: 30, theme: 1, col: '#5a6a7a', mobs: ['bone', 'ghost', 'grave'], elite: 'cknight', minis: ['cknight', 'banshee'], boss: 'lich', d: 'Flooded tombs full of things that should stay buried.' },
      { id: 'frost', n: 'Frost Peaks', lvl: 45, theme: 2, col: '#9ab8d8', mobs: ['ice', 'snow', 'yeti'], elite: 'frostgiant', minis: ['frostgiant', 'rimewitch'], boss: 'wyrm', d: 'Frozen cliffs where a wyrm sleeps in the ice.' },
      { id: 'ember', n: 'Ember Forge', lvl: 60, theme: 3, col: '#c8501a', mobs: ['magma', 'cinder', 'forge'], elite: 'pyro', minis: ['pyro', 'smelter'], boss: 'titan', d: 'A forge of lava where slimes are melted into weapons.' },
      { id: 'storm', n: 'Storm Spire', lvl: 75, theme: 4, col: '#4a5aaa', mobs: ['spark', 'cloud', 'thunder'], elite: 'tempest', minis: ['tempest', 'conduit'], boss: 'dragon', d: 'A tower in the clouds that lightning never leaves.' },
      { id: 'void', n: 'Void Citadel', lvl: 90, theme: 5, col: '#7a3aaa', mobs: ['voidling', 'shade', 'abyss'], elite: 'voidknight', minis: ['voidknight', 'archon'], boss: 'king', d: 'The fortress of the Slime King, at the edge of nothing.' },
      { id: 'abyss', n: 'Abyssal Void', lvl: 105, theme: 7, col: '#aa1a4a', mobs: ['eye', 'tendril', 'maw'], elite: 'horror', minis: ['horror', 'leech'], boss: 'abyssal', d: 'Below the citadel. Below everything.' },
      { id: 'glitch', n: 'Glitch Realm', lvl: 120, theme: 8, col: '#1aff8a', mobs: ['glitchling', 'nullslime', 'glitchling'], elite: 'errorknight', minis: ['errorknight', 'segfault'], boss: 'glitchking', d: 'A broken place between the worlds, where the code of reality has come undone.' },
      // Update 6 worlds (reached from the Far Gates in the Wilds, or the dungeon finder). Update 7: every dungeon's lvl is its Normal step on the ladder
      { id: 'drowned', n: 'Drowned Cathedral', lvl: 135, theme: 9, col: '#2ab8b0', mobs: ['chorister', 'barnacle', 'eel'], elite: 'bellringer', minis: ['bellringer', 'abbess'], boss: 'leviathan', mech: 'tide', d: 'A cathedral swallowed by the sea. The tide comes in: climb onto the stone daises.' },
      { id: 'clock', n: 'Clockwork Spire', lvl: 150, theme: 10, col: '#e8a83a', mobs: ['cog', 'piston', 'spring'], elite: 'foreman', minis: ['foreman', 'pendulum'], boss: 'clockmaker', mech: 'blades', d: 'A tower of brass that never stops turning. Jump the spinning blades.' },
      { id: 'moon', n: 'Hollow Moon', lvl: 165, theme: 11, col: '#b8c8ff', mobs: ['moth', 'crater', 'starspawn'], elite: 'hound', minis: ['hound', 'eclipse'], boss: 'mooneater', mech: 'gravity', d: 'The inside of a dead moon. Low gravity, falling stars, and something hungry at the core.' }
    ],
    // ---------- dungeon layouts: every dungeon is built from its own plan (shapes, sizes, turns, side rooms, hazards) ----------
    // main: the rooms you must clear, in order (start ... boss, loot). k: start|mob|mini|boss|loot. w/d = size, or r = a round room.
    // dir = which way the hall leaves the room before (N/S/E/W), len = hall length, off = where the door sits on that wall (-1..1), jog = shift of the new room
    // waves: [[slime (0-2 = the dungeon's slimes, 'e' = its elite), how many], ...] per wave. obst: pillars|trees|stones|tombs|ring|cubes. haz: [pool|vent, how many]
    // side: optional rooms off a main room (from). A run's seed decides if each one is a treasure vault or an ambush (waves), so runs differ.
    // Update 7 · every dungeon is a full map, at least 3x the walkable area of Update 6: wide streets (st: buildings line the hall), bridges
    // over water / lava / chasms / sky / the void (br: the hall is a deck with railings and a drop on both sides), open cliff edges (cliff: that
    // wall is a parapet over a view far below), and one big landmark per dungeon (land) seen from the rooms. Room gates work as before.
    LAYOUTS: [
      { n: 'The old forest road', hall: 11, relic: 's0', land: { k: 'giantTree', dx: 150, dz: -120, s: 1 }, main: [
        { k: 'start', w: 34, d: 28 },
        { k: 'mob', w: 52, d: 44, dir: 'S', len: 30, off: 0.2, obst: 'trees', waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', r: 26, dir: 'E', len: 32, haz: ['pool', 3], waves: [[[0, 4], [1, 3]], [[1, 4], [2, 2]]] },
        { k: 'mob', w: 56, d: 42, dir: 'S', len: 30, br: 'water', obst: 'stones', cliff: 'E', waves: [[[1, 5]], [[2, 3], [0, 4]]] },
        { k: 'mini', w: 54, d: 48, dir: 'S', len: 28, obst: 'stones', n: 0 },
        { k: 'mob', w: 60, d: 40, dir: 'W', len: 34, jog: -4, st: 1, obst: 'trees', waves: [[[1, 5]], [[2, 3], [0, 4]], [['e', 1], [1, 3]]] },
        { k: 'mob', r: 28, dir: 'S', len: 30, haz: ['pool', 3], waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]]] },
        { k: 'mob', w: 50, d: 50, dir: 'S', len: 30, br: 'water', obst: 'trees', cliff: 'W', waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 54, d: 46, dir: 'E', len: 32, obst: 'stones', n: 1 },
        { k: 'mob', w: 56, d: 44, dir: 'S', len: 30, st: 1, obst: 'trees', waves: [[[1, 5], [2, 2]], [['e', 1], [0, 4]], [[2, 4]]] },
        { k: 'boss', r: 34, dir: 'S', len: 32 },
        { k: 'loot', w: 24, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 1, w: 26, d: 24, dir: 'W', len: 18, waves: [[[1, 3], [2, 2]]] }, { from: 6, w: 26, d: 24, dir: 'W', len: 18, waves: [[[2, 3], ['e', 1]]] }] },
      { n: 'The sand city and the sunken temple', hall: 12, relic: 's1', land: { k: 'pyramid', dx: -170, dz: -60, s: 1 }, main: [
        { k: 'start', w: 32, d: 28 },
        { k: 'mob', w: 44, d: 58, dir: 'S', len: 34, st: 1, obst: 'pillars', waves: [[[0, 5], [1, 1]], [[1, 4], [2, 2]]] },
        { k: 'mob', w: 58, d: 44, dir: 'S', len: 32, st: 1, obst: 'pillars', haz: ['vent', 4], waves: [[[1, 5]], [[0, 4], [2, 3]], [[2, 4]]] },
        { k: 'mob', w: 50, d: 50, dir: 'E', len: 34, waves: [[[2, 3], [1, 4]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 56, d: 48, dir: 'S', len: 30, obst: 'pillars', n: 0 },
        { k: 'mob', w: 48, d: 44, dir: 'S', len: 36, br: 'chasm', cliff: 'W', haz: ['vent', 3], waves: [[[1, 5], [2, 2]], [[2, 4], [0, 3]], [['e', 1], [1, 3]]] },
        { k: 'mob', r: 28, dir: 'E', len: 32, obst: 'ring', waves: [[[0, 5], [2, 2]], [[1, 5]], [['e', 1], [2, 2]]] },
        { k: 'mob', w: 56, d: 46, dir: 'S', len: 32, st: 1, obst: 'pillars', waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', r: 27, dir: 'W', len: 34, n: 1 },
        { k: 'mob', w: 52, d: 48, dir: 'S', len: 32, haz: ['vent', 4], waves: [[[1, 5], [0, 3]], [[2, 4], ['e', 1]], [[1, 4], [2, 2]]] },
        { k: 'boss', r: 34, dir: 'S', len: 34 },
        { k: 'loot', w: 24, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 2, w: 26, d: 26, dir: 'W', len: 20, waves: [[[2, 3], [0, 2]]] }, { from: 7, w: 26, d: 24, dir: 'E', len: 20, waves: [[[1, 3], ['e', 1]]] }] },
      { n: 'The sunken crystal temple', hall: 11, relic: 's0', land: { k: 'crystalSpire', dx: 160, dz: -140, s: 1 }, main: [
        { k: 'start', w: 30, d: 28 },
        { k: 'mob', w: 46, d: 52, dir: 'S', len: 30, obst: 'tombs', haz: ['pool', 2], waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 54, d: 44, dir: 'S', len: 34, br: 'water', obst: 'pillars', waves: [[[1, 4], [2, 2]], [[0, 5], [1, 2]]] },
        { k: 'mini', r: 28, dir: 'E', len: 32, n: 0 },
        { k: 'mob', w: 50, d: 50, dir: 'S', len: 32, br: 'water', obst: 'tombs', waves: [[[2, 3], [0, 4]], [['e', 1], [1, 4]]] },
        { k: 'mob', w: 60, d: 42, dir: 'S', len: 30, obst: 'pillars', haz: ['pool', 3], waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', r: 27, dir: 'W', len: 34, br: 'water', waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]]] },
        { k: 'mob', w: 52, d: 48, dir: 'S', len: 32, obst: 'tombs', cliff: 'W', waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mini', w: 54, d: 50, dir: 'S', len: 30, obst: 'pillars', n: 1 },
        { k: 'mob', w: 50, d: 44, dir: 'E', len: 34, st: 1, haz: ['pool', 2], waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'boss', r: 34, dir: 'S', len: 34 },
        { k: 'loot', w: 24, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 1, w: 26, d: 24, dir: 'W', len: 18, waves: [[[1, 3], [2, 2]]] }, { from: 5, w: 26, d: 26, dir: 'E', len: 18, waves: [[[2, 3], ['e', 1]]] }] },
      { n: 'The frozen fortress', hall: 12, relic: 's0', land: { k: 'keep', dx: -160, dz: -160, s: 1 }, main: [
        { k: 'start', w: 32, d: 28 },
        { k: 'mob', w: 50, d: 46, dir: 'S', len: 34, br: 'chasm', obst: 'stones', waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 58, d: 48, dir: 'S', len: 30, st: 1, obst: 'pillars', waves: [[[1, 4], [2, 2]], [[0, 5], [2, 2]]] },
        { k: 'mob', r: 27, dir: 'E', len: 34, br: 'chasm', cliff: 'S', haz: ['pool', 2], waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 54, d: 48, dir: 'N', len: 30, obst: 'pillars', n: 0 },
        { k: 'mob', w: 52, d: 46, dir: 'E', len: 34, st: 1, obst: 'stones', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', w: 48, d: 56, dir: 'S', len: 32, cliff: 'E', waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]]] },
        { k: 'mob', w: 56, d: 46, dir: 'S', len: 34, br: 'chasm', obst: 'stones', waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mini', r: 28, dir: 'W', len: 32, n: 1 },
        { k: 'mob', w: 54, d: 46, dir: 'S', len: 32, st: 1, obst: 'pillars', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'boss', r: 35, dir: 'S', len: 34 },
        { k: 'loot', w: 24, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 2, w: 28, d: 26, dir: 'W', len: 20, waves: [[[2, 3], [0, 2]]] }, { from: 9, w: 28, d: 26, dir: 'W', len: 20, waves: [[[1, 3], ['e', 1]]] }, { from: 5, w: 28, d: 26, dir: 'N', len: 20, waves: [[[0, 3], [1, 2]]] }] },
      { n: 'The heart of the volcano', hall: 12, relic: 's1', land: { k: 'volcano', dx: 180, dz: -40, s: 1 }, main: [
        { k: 'start', w: 32, d: 28 },
        { k: 'mob', w: 58, d: 50, dir: 'S', len: 32, haz: ['pool', 3], waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 56, d: 60, dir: 'E', len: 36, br: 'lava', obst: 'stones', waves: [[[1, 4], [2, 2]], [[0, 5], [2, 2]]] },
        { k: 'mini', r: 32, dir: 'S', len: 32, haz: ['pool', 3], n: 0 },
        { k: 'mob', w: 64, d: 50, dir: 'S', len: 34, br: 'lava', st: 1, waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mob', w: 58, d: 56, dir: 'W', len: 34, obst: 'stones', haz: ['vent', 4], waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'mob', r: 31, dir: 'S', len: 32, br: 'lava', cliff: 'W', waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', w: 62, d: 50, dir: 'S', len: 30, st: 1, haz: ['pool', 3], waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 60, d: 56, dir: 'E', len: 34, obst: 'stones', n: 1 },
        { k: 'mob', w: 58, d: 50, dir: 'S', len: 34, br: 'lava', haz: ['vent', 4], waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'boss', r: 40, dir: 'S', len: 34 },
        { k: 'loot', w: 24, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 1, w: 30, d: 28, dir: 'W', len: 20, waves: [[[2, 3], [0, 2]]] }, { from: 7, w: 30, d: 28, dir: 'W', len: 20, waves: [[[1, 3], ['e', 1]]] }, { from: 9, w: 30, d: 28, dir: 'W', len: 22, waves: [[[0, 3], [2, 2]]] }] },
      { n: 'The sky city', hall: 11, relic: 's1', land: { k: 'spire', dx: 0, dz: -200, s: 1 }, main: [
        { k: 'start', r: 18 },
        { k: 'mob', r: 26, dir: 'S', len: 36, br: 'sky', waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 54, d: 44, dir: 'E', len: 36, br: 'sky', cliff: 'E', obst: 'pillars', waves: [[[1, 4], [2, 2]], [[0, 5], [2, 2]]] },
        { k: 'mini', r: 28, dir: 'S', len: 36, br: 'sky', n: 0 },
        { k: 'mob', w: 56, d: 46, dir: 'W', len: 38, br: 'sky', st: 1, waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mob', r: 27, dir: 'S', len: 36, br: 'sky', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'mob', w: 52, d: 50, dir: 'E', len: 36, br: 'sky', cliff: 'N', obst: 'pillars', waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', r: 28, dir: 'S', len: 36, br: 'sky', waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 54, d: 48, dir: 'S', len: 34, br: 'sky', cliff: 'E', n: 1 },
        { k: 'mob', r: 27, dir: 'W', len: 36, br: 'sky', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'boss', r: 35, dir: 'S', len: 38, br: 'sky' },
        { k: 'loot', w: 22, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 2, w: 26, d: 24, dir: 'N', len: 22, br: 'sky', waves: [[[2, 3], [0, 2]]] }, { from: 7, w: 26, d: 24, dir: 'W', len: 22, br: 'sky', waves: [[[1, 3], ['e', 1]]] }] },
      { n: 'The citadel and its burning moat', hall: 12, relic: 's0', land: { k: 'citadel', dx: -150, dz: -120, s: 1 }, main: [
        { k: 'start', w: 32, d: 28 },
        { k: 'mob', w: 52, d: 48, dir: 'S', len: 38, br: 'lava', waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 66, d: 50, dir: 'S', len: 30, st: 1, obst: 'pillars', waves: [[[1, 4], [2, 2]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 60, d: 56, dir: 'E', len: 34, obst: 'pillars', n: 0 },
        { k: 'mob', w: 56, d: 56, dir: 'S', len: 32, st: 1, haz: ['vent', 3], waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mob', r: 31, dir: 'S', len: 34, br: 'lava', cliff: 'E', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'mob', w: 62, d: 50, dir: 'W', len: 34, st: 1, obst: 'pillars', waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]]] },
        { k: 'mob', w: 58, d: 58, dir: 'S', len: 32, haz: ['vent', 4], waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', r: 31, dir: 'S', len: 34, br: 'lava', n: 1 },
        { k: 'mob', w: 64, d: 50, dir: 'E', len: 34, st: 1, obst: 'pillars', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'boss', w: 70, d: 62, dir: 'S', len: 34 },
        { k: 'loot', w: 24, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 2, w: 28, d: 26, dir: 'W', len: 20, waves: [[[2, 3], [0, 2]]] }, { from: 7, w: 28, d: 26, dir: 'E', len: 20, waves: [[[1, 3], ['e', 1]]] }] },
      { n: 'Islands in the void', hall: 11, relic: 's1', land: { k: 'voidEye', dx: 160, dz: -150, s: 1 }, main: [
        { k: 'start', r: 18 },
        { k: 'mob', r: 29, dir: 'S', len: 36, br: 'void', waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 58, d: 50, dir: 'W', len: 36, br: 'void', cliff: 'N', obst: 'cubes', waves: [[[1, 4], [2, 2]], [[0, 5], [2, 2]]] },
        { k: 'mob', r: 30, dir: 'S', len: 36, br: 'void', haz: ['pool', 3], waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mini', w: 60, d: 54, dir: 'E', len: 38, br: 'void', n: 0 },
        { k: 'mob', r: 29, dir: 'E', len: 36, br: 'void', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'mob', w: 56, d: 56, dir: 'S', len: 36, br: 'void', cliff: 'E', obst: 'cubes', waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', r: 30, dir: 'W', len: 38, br: 'void', haz: ['pool', 3], waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 58, d: 54, dir: 'S', len: 36, br: 'void', n: 1 },
        { k: 'mob', r: 30, dir: 'S', len: 36, br: 'void', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'boss', r: 39, dir: 'S', len: 38, br: 'void' },
        { k: 'loot', w: 22, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 3, w: 28, d: 26, dir: 'W', len: 22, br: 'void', waves: [[[2, 3], [0, 2]]] }, { from: 9, w: 28, d: 26, dir: 'W', len: 22, br: 'void', waves: [[[1, 3], ['e', 1]]] }] },
      { n: 'The broken station', hall: 11, relic: 's0', land: { k: 'planet', dx: -180, dz: -180, s: 1 }, main: [
        { k: 'start', w: 30, d: 26 },
        { k: 'mob', w: 56, d: 48, dir: 'S', len: 34, st: 1, obst: 'cubes', waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 62, d: 52, dir: 'E', len: 36, br: 'void', waves: [[[1, 4], [2, 2]], [[0, 5], [2, 2]]] },
        { k: 'mob', w: 52, d: 62, dir: 'S', len: 32, st: 1, obst: 'cubes', haz: ['vent', 3], waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mini', r: 31, dir: 'S', len: 34, br: 'void', n: 0 },
        { k: 'mob', w: 64, d: 50, dir: 'W', len: 36, st: 1, waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'mob', w: 58, d: 56, dir: 'S', len: 34, br: 'void', cliff: 'W', obst: 'cubes', waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', w: 60, d: 50, dir: 'E', len: 34, st: 1, haz: ['vent', 4], waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 60, d: 56, dir: 'S', len: 34, br: 'void', n: 1 },
        { k: 'mob', w: 58, d: 50, dir: 'S', len: 34, st: 1, obst: 'cubes', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'boss', r: 40, dir: 'S', len: 36, br: 'void' },
        { k: 'loot', w: 22, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 1, w: 28, d: 26, dir: 'W', len: 20, waves: [[[2, 3], [0, 2]]] }, { from: 7, w: 28, d: 26, dir: 'E', len: 20, waves: [[[1, 3], ['e', 1]]] }] },
      { n: 'The drowned city by night', hall: 12, relic: 's1', land: { k: 'cathedral', dx: 170, dz: -130, s: 1 }, main: [
        { k: 'start', w: 32, d: 28 },
        { k: 'mob', w: 52, d: 62, dir: 'S', len: 34, st: 1, br: 'water', waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 64, d: 50, dir: 'S', len: 32, st: 1, obst: 'pillars', haz: ['tide', 1], waves: [[[1, 4], [2, 2]], [[0, 5], [2, 2]]] },
        { k: 'mob', w: 56, d: 56, dir: 'E', len: 36, br: 'water', st: 1, waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mini', r: 31, dir: 'S', len: 34, br: 'water', n: 0 },
        { k: 'mob', w: 62, d: 52, dir: 'S', len: 32, st: 1, obst: 'pillars', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'mob', w: 58, d: 58, dir: 'W', len: 36, br: 'water', st: 1, haz: ['tide', 1], waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', w: 60, d: 52, dir: 'S', len: 34, st: 1, waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 62, d: 56, dir: 'S', len: 32, br: 'water', obst: 'pillars', n: 1 },
        { k: 'mob', w: 58, d: 52, dir: 'E', len: 36, st: 1, br: 'water', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'boss', w: 70, d: 64, dir: 'S', len: 34 },
        { k: 'loot', w: 24, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 2, w: 28, d: 26, dir: 'W', len: 20, waves: [[[2, 3], [0, 2]]] }, { from: 7, w: 28, d: 26, dir: 'W', len: 20, waves: [[[1, 3], ['e', 1]]] }] },
      { n: 'The clockwork works', hall: 12, relic: 's0', land: { k: 'clockTower', dx: -160, dz: -120, s: 1 }, main: [
        { k: 'start', w: 32, d: 28 },
        { k: 'mob', w: 58, d: 52, dir: 'E', len: 34, st: 1, obst: 'cubes', waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 56, d: 60, dir: 'S', len: 34, br: 'chasm', haz: ['blades', 2], waves: [[[1, 4], [2, 2]], [[0, 5], [2, 2]]] },
        { k: 'mob', w: 64, d: 52, dir: 'W', len: 34, st: 1, obst: 'cubes', waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mini', r: 31, dir: 'S', len: 34, br: 'chasm', n: 0 },
        { k: 'mob', w: 62, d: 52, dir: 'S', len: 32, st: 1, haz: ['blades', 2], waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'mob', w: 58, d: 58, dir: 'E', len: 36, br: 'chasm', cliff: 'N', obst: 'cubes', waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', w: 60, d: 52, dir: 'S', len: 34, st: 1, haz: ['blades', 2], waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 62, d: 56, dir: 'W', len: 34, obst: 'cubes', n: 1 },
        { k: 'mob', w: 58, d: 52, dir: 'S', len: 34, st: 1, br: 'chasm', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'boss', r: 40, dir: 'S', len: 36 },
        { k: 'loot', w: 24, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 1, w: 28, d: 26, dir: 'N', len: 20, waves: [[[2, 3], [0, 2]]] }, { from: 6, w: 28, d: 26, dir: 'E', len: 20, waves: [[[1, 3], ['e', 1]]] }] },
      { n: 'Craters of the hollow moon', hall: 11, relic: 's1', land: { k: 'planet', dx: 170, dz: -190, s: 1.3 }, main: [
        { k: 'start', r: 18 },
        { k: 'mob', r: 33, dir: 'S', len: 34, haz: ['star', 2], waves: [[[0, 5]], [[1, 4], [0, 3]]] },
        { k: 'mob', w: 66, d: 56, dir: 'E', len: 38, br: 'void', obst: 'stones', waves: [[[1, 4], [2, 2]], [[0, 5], [2, 2]]] },
        { k: 'mob', r: 34, dir: 'S', len: 34, cliff: 'E', haz: ['star', 3], waves: [[[2, 3], [1, 3]], [['e', 1], [0, 4]], [[1, 5]]] },
        { k: 'mini', w: 66, d: 60, dir: 'W', len: 38, br: 'void', n: 0 },
        { k: 'mob', r: 33, dir: 'S', len: 34, obst: 'stones', waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]]] },
        { k: 'mob', w: 64, d: 62, dir: 'W', len: 36, br: 'void', haz: ['star', 3], waves: [[[0, 5], [2, 2]], [[1, 4], ['e', 1]], [[2, 4]]] },
        { k: 'mob', r: 34, dir: 'S', len: 34, cliff: 'W', waves: [[[2, 4], [1, 3]], [['e', 1], [0, 4]]] },
        { k: 'mini', w: 66, d: 60, dir: 'E', len: 38, br: 'void', obst: 'stones', n: 1 },
        { k: 'mob', r: 33, dir: 'S', len: 34, haz: ['star', 3], waves: [[[1, 5], [2, 2]], [[0, 4], ['e', 1]], [[2, 4]]] },
        { k: 'boss', r: 44, dir: 'S', len: 38, br: 'void' },
        { k: 'loot', w: 22, d: 18, dir: 'S', len: 10 }],
        side: [{ from: 2, w: 28, d: 26, dir: 'N', len: 22, waves: [[[2, 3], [0, 2]]] }, { from: 6, w: 28, d: 26, dir: 'N', len: 22, waves: [[[1, 3], ['e', 1]]] }] },
    ],
    // ---------- Update 7 · how each dungeon's slimes move (on top of their own bodies' walk cycles), one entry per dungeon ----------
    // hop: bounce height when moving, lean: tip into the run, sway: roll side to side, float: hover height (with a slow bob), jit: twitchy shake,
    // tick: moves in clockwork steps, low: low gravity (big slow hops)
    GAIT: [{ hop: 0.25, lean: 0.12, sway: 0.06 }, { hop: 0.04, lean: 0.22, sway: 0.16 }, { float: 0.5, sway: 0.05 }, { hop: 0.1, lean: 0.08, sway: 0.03 },
      { hop: 0.18, lean: 0.15, jit: 0.03 }, { float: 0.3, hop: 0.08, jit: 0.02 }, { float: 0.2, sway: 0.1, lean: 0.1 }, { hop: 0.08, sway: 0.2 },
      { hop: 0.12, jit: 0.06 }, { float: 0.15, sway: 0.13 }, { hop: 0.12, lean: 0.05, tick: 1 }, { float: 0.25, hop: 0.35, low: 1 }],
    // ---------- Update 7 · every boss and mini-boss has its OWN hand-made moveset ----------
    // SIG: signature moves. Each belongs to exactly one boss or mini-boss (the id starts with its owner). A move is a wind-up (pose: crouch,
    // raise, rear, tilt, spin, roar, channel, sink, shake, float; wind = seconds of warning) and its parts, the telegraphs it lays down:
    //   circle (at target|self|ahead|room; n, r, spread, step = delay between them, each = on every player), trail (lanes x n circles marching
    //   from the caster over arc degrees), fan (n beams from the caster over arc), cross (arms 2|4 through a point, rot), ring (n circles round
    //   a point at rad), spin (n beams one after another over arc: a sweep), leap (jump on the target, landing circle r), dash (charge through
    //   the target, width w), use (one of the shared rules - wave, summon, checker, safe, orbs, pools, teleport, meteor, nova - with this move's
    //   own name and timing). mult = damage x the caster's hit. np2 = extra pieces below half health.
    SIG: {
      // ---- Mossy Woods: the Rotwood Treant
      'treant.rootWall': { n: 'Root Wall', pose: 'crouch', wind: 0.9, mult: 1.1, tip: 'Roots burst up in a line: step to the side', parts: [{ k: 'trail', lanes: 1, n: 9, r: 2.2, step: 0.09, np2: 3 }] },
      'treant.seedBurst': { n: 'Seed Burst', pose: 'raise', wind: 0.8, mult: 0.8, tip: 'Seeds rain down around you', parts: [{ k: 'circle', at: 'target', n: 6, r: 1.8, spread: 6, step: 0.12, each: 1 }] },
      'treant.canopyCrush': { n: 'Canopy Crush', pose: 'rear', wind: 1.3, mult: 1.5, tip: 'It rears up: get away from it, then dodge the falling ring', parts: [{ k: 'circle', at: 'self', r: 7 }, { k: 'ring', at: 'self', n: 8, rad: 11, r: 2, delay: 0.5 }] },
      'treant.thornFan': { n: 'Thorn Fan', pose: 'tilt', wind: 0.8, mult: 1.0, tip: 'Thorn lines fan out: stand between them', parts: [{ k: 'fan', n: 5, arc: 100, w: 1.3, step: 0.08 }] },
      'treant.saplings': { n: 'Saplings', pose: 'roar', wind: 0, tip: 'Saplings sprout: kill them fast', parts: [{ k: 'use', m: 'summon' }] },
      'treant.forestWrath': { n: 'Forest Wrath', pose: 'roar', wind: 1.4, mult: 1.2, tip: 'Three root walls and falling seeds', parts: [{ k: 'trail', lanes: 3, arc: 60, n: 8, r: 2, step: 0.08 }, { k: 'circle', at: 'target', n: 3, r: 2, spread: 5, each: 1, delay: 0.6 }] },
      // ---- Desert Temple: the Slime Pharaoh
      'pharaoh.sandLash': { n: 'Sand Lash', pose: 'tilt', wind: 0.75, mult: 1.1, tip: 'Three whips of sand', parts: [{ k: 'fan', n: 3, arc: 50, w: 1.2, step: 0.1 }] },
      'pharaoh.curse': { n: 'Curse of the Sun', pose: 'raise', wind: 1.0, mult: 1.2, tip: 'A cross of sunfire under you', parts: [{ k: 'cross', at: 'target', arms: 4, w: 1.3 }] },
      'pharaoh.scarabRain': { n: 'Scarab Rain', pose: 'channel', wind: 0.9, mult: 0.7, tip: 'Scarabs drop all around: keep moving', parts: [{ k: 'circle', at: 'target', n: 8, r: 1.6, spread: 6, step: 0.08, each: 1 }] },
      'pharaoh.sarcophagus': { n: 'Open the Sarcophagi', pose: 'roar', wind: 0, tip: 'Mummies rise (one heals the Pharaoh: kill it first)', parts: [{ k: 'use', m: 'summon' }] },
      'pharaoh.sandstorm': { n: 'Sandstorm', pose: 'spin', wind: 0.9, mult: 0.9, tip: 'A wall of sand sweeps round', parts: [{ k: 'spin', n: 8, arc: 180, w: 1.6, step: 0.14 }] },
      'pharaoh.judgement': { n: 'Judgement of the Sun', pose: 'raise', wind: 0, tip: 'Stand in a GREEN circle', parts: [{ k: 'use', m: 'safe' }] },
      // ---- Sunken Crypt: the Lich
      'lich.graveHands': { n: 'Grave Hands', pose: 'channel', wind: 0.8, mult: 1.0, tip: 'Hands claw up under you, one after another', parts: [{ k: 'circle', at: 'target', n: 4, r: 2, spread: 4, step: 0.22, each: 1 }] },
      'lich.soulLance': { n: 'Soul Lance', pose: 'rear', wind: 1.0, mult: 1.5, tip: 'A long lance of souls: sidestep', parts: [{ k: 'fan', n: 1, w: 1.7 }] },
      'lich.phylactery': { n: 'Phylactery Blink', pose: 'sink', wind: 0, tip: 'It vanishes and lands on you', parts: [{ k: 'use', m: 'teleport' }] },
      'lich.boneCage': { n: 'Bone Cage', pose: 'raise', wind: 0.9, mult: 1.2, tip: 'A cage of bones closes: get out before the middle bursts', parts: [{ k: 'ring', at: 'target', n: 10, rad: 6, r: 1.8 }, { k: 'circle', at: 'target', r: 3.2, delay: 0.7 }] },
      'lich.wraiths': { n: 'Wraith Orbs', pose: 'channel', wind: 0, tip: 'Hunting wraiths: run or pop them', parts: [{ k: 'use', m: 'orbs' }] },
      'lich.deathSpiral': { n: 'Death Spiral', pose: 'spin', wind: 0.9, mult: 1.0, tip: 'A full circle of death sweeps round', parts: [{ k: 'spin', n: 12, arc: 360, w: 1.2, step: 0.1 }] },
      // ---- Frost Peaks: the Frost Wyrm
      'wyrm.breath': { n: 'Frost Breath', pose: 'rear', wind: 1.0, mult: 1.1, tip: 'A cone of frost: get behind or beside it', parts: [{ k: 'fan', n: 5, arc: 40, w: 1.2, step: 0.05 }] },
      'wyrm.tailSweep': { n: 'Tail Sweep', pose: 'tilt', wind: 0.7, mult: 1.2, tip: 'The tail sweeps close by: back off', parts: [{ k: 'spin', n: 6, arc: 140, w: 1.6, len: 13, step: 0.06 }] },
      'wyrm.icefall': { n: 'Icefall', pose: 'raise', wind: 0.8, mult: 0.9, tip: 'Icicles drop on everyone', parts: [{ k: 'circle', at: 'target', n: 5, r: 2.2, spread: 7, step: 0.12, each: 1 }] },
      'wyrm.glacierDive': { n: 'Glacier Dive', pose: 'crouch', wind: 0.9, mult: 1.5, tip: 'It dives onto you', parts: [{ k: 'leap', r: 6 }] },
      'wyrm.shatter': { n: 'Shatter the Ice', pose: 'roar', wind: 0, tip: 'The floor cracks: find a GREEN tile', parts: [{ k: 'use', m: 'checker' }] },
      'wyrm.blizzard': { n: 'Blizzard', pose: 'spin', wind: 1.0, mult: 0.9, tip: 'Hail all over the room', parts: [{ k: 'circle', at: 'room', n: 18, r: 2, spread: 22, step: 0.07 }] },
      // ---- Ember Forge: the Inferno Titan
      'titan.magmaFist': { n: 'Magma Fist', pose: 'rear', wind: 0.9, mult: 1.5, tip: 'It leaps on you with a burning fist', parts: [{ k: 'leap', r: 5 }] },
      'titan.fissure': { n: 'Fissure', pose: 'crouch', wind: 0.8, mult: 1.1, tip: 'Two cracks of lava run at you', parts: [{ k: 'trail', lanes: 2, arc: 30, n: 8, r: 2, step: 0.1 }] },
      'titan.slagRain': { n: 'Slag Rain', pose: 'raise', wind: 0, tip: 'Burning slag pools', parts: [{ k: 'use', m: 'pools' }] },
      'titan.eruption': { n: 'Eruption', pose: 'roar', wind: 0, tip: 'It erupts: get away, then dodge the ring', parts: [{ k: 'use', m: 'nova' }, { k: 'ring', at: 'self', n: 10, rad: 9, r: 2, delay: 1.6 }] },
      'titan.forgeHammer': { n: 'Forge Hammer', pose: 'shake', wind: 1.0, mult: 1.3, tip: 'Two hammer lines cross the room', parts: [{ k: 'cross', at: 'self', arms: 2, w: 1.8, rot: 45 }] },
      'titan.moltenCore': { n: 'Molten Core', pose: 'channel', wind: 0, tip: 'Stand in a GREEN circle', parts: [{ k: 'use', m: 'safe' }] },
      // ---- Storm Spire: the Storm Dragon
      'dragon.breath': { n: 'Lightning Breath', pose: 'rear', wind: 0.9, mult: 1.2, tip: 'Three bolts in a cone', parts: [{ k: 'fan', n: 3, arc: 30, w: 1.4, step: 0.1 }] },
      'dragon.chain': { n: 'Chain Lightning', pose: 'channel', wind: 0.7, mult: 0.9, tip: 'Strikes follow you: keep running', parts: [{ k: 'circle', at: 'target', n: 4, r: 2, spread: 2, step: 0.25, each: 1 }] },
      'dragon.gust': { n: 'Wing Gust', pose: 'tilt', wind: 0.8, mult: 1.0, tip: 'A gust sweeps half the room', parts: [{ k: 'spin', n: 7, arc: 180, w: 2, step: 0.07 }] },
      'dragon.diveBomb': { n: 'Dive Bomb', pose: 'float', wind: 1.1, mult: 1.6, tip: 'It flies up and crashes on you', parts: [{ k: 'leap', r: 6 }] },
      'dragon.stormCage': { n: 'Storm Cage', pose: 'raise', wind: 0.9, mult: 1.0, tip: 'A cage of lightning on the edge, orbs inside', parts: [{ k: 'ring', at: 'self', n: 14, rad: 14, r: 2.2 }, { k: 'use', m: 'orbs', delay: 0.4 }] },
      'dragon.thunderstorm': { n: 'Thunderstorm', pose: 'roar', wind: 1.0, mult: 1.0, tip: 'Lightning all over the room', parts: [{ k: 'circle', at: 'room', n: 24, r: 2, spread: 24, step: 0.06 }] },
      // ---- Void Citadel: the Slime King
      'king.decree': { n: 'Royal Decree', pose: 'raise', wind: 0.9, mult: 1.3, tip: 'Two lines of judgement through you', parts: [{ k: 'cross', at: 'target', arms: 2, w: 1.6 }] },
      'king.scepter': { n: 'Scepter Slam', pose: 'rear', wind: 1.0, mult: 1.5, tip: 'A slam in front, then a ring of shocks', parts: [{ k: 'circle', at: 'ahead', r: 5 }, { k: 'ring', at: 'ahead', n: 8, rad: 8, r: 2, delay: 0.4 }] },
      'king.guard': { n: 'Royal Guard', pose: 'roar', wind: 0, tip: 'His guard arrives (one heals him)', parts: [{ k: 'use', m: 'summon' }] },
      'king.crownStep': { n: 'Crown Step', pose: 'sink', wind: 0, tip: 'He vanishes and lands on you', parts: [{ k: 'use', m: 'teleport' }] },
      'king.risingFire': { n: 'The Moat Rises', pose: 'raise', wind: 0, tip: 'The burning moat floods the hall: stand in a GREEN circle', parts: [{ k: 'use', m: 'safe' }] },
      'king.execution': { n: 'Execution', pose: 'crouch', wind: 0.8, mult: 1.6, tip: 'He charges, then cuts a cross where you stood', parts: [{ k: 'dash', w: 2.4 }, { k: 'cross', at: 'target', arms: 4, w: 1.4, delay: 0.7 }] },
      // ---- Abyssal Void: the Abyssal Lord
      'abyssal.grasp': { n: 'Tentacle Grasp', pose: 'channel', wind: 0.8, mult: 1.1, tip: 'Tentacles burst up under you', parts: [{ k: 'circle', at: 'target', n: 3, r: 2.6, spread: 2.5, step: 0.3, each: 1 }] },
      'abyssal.gaze': { n: 'Abyssal Gaze', pose: 'rear', wind: 1.1, mult: 1.6, tip: 'A long beam: sidestep', parts: [{ k: 'fan', n: 1, w: 2.2 }] },
      'abyssal.maw': { n: 'Maw Pools', pose: 'crouch', wind: 0, tip: 'Mouths open in the floor', parts: [{ k: 'use', m: 'pools' }] },
      'abyssal.eyeStorm': { n: 'Eye Storm', pose: 'channel', wind: 0.6, mult: 0.9, tip: 'Eyes hunt you while the floor bites', parts: [{ k: 'use', m: 'orbs' }, { k: 'circle', at: 'target', n: 4, r: 2, spread: 6, each: 1, delay: 0.3 }] },
      'abyssal.voidGrid': { n: 'Void Grid', pose: 'roar', wind: 0, tip: 'Find a GREEN tile', parts: [{ k: 'use', m: 'checker' }] },
      'abyssal.consume': { n: 'Consume', pose: 'roar', wind: 0, tip: 'Stand in a GREEN circle', parts: [{ k: 'use', m: 'safe' }] },
      // ---- Glitch Realm: The Corrupted
      'glitchking.bitFlip': { n: 'Bit Flip', pose: 'shake', wind: 0.8, mult: 1.2, tip: 'A star of glitches through you', parts: [{ k: 'cross', at: 'target', arms: 4, w: 1.2 }] },
      'glitchking.packets': { n: 'Packet Burst', pose: 'channel', wind: 0.6, mult: 0.8, tip: 'Data packets rain down', parts: [{ k: 'circle', at: 'target', n: 6, r: 1.6, spread: 8, step: 0.05, each: 1 }] },
      'glitchking.exe': { n: 'teleport.exe', pose: 'sink', wind: 0, tip: 'It blinks onto you', parts: [{ k: 'use', m: 'teleport' }] },
      'glitchking.overflow': { n: 'Stack Overflow', pose: 'spin', wind: 0.9, mult: 1.0, tip: 'Four lines run out from it', parts: [{ k: 'trail', lanes: 4, arc: 270, n: 7, r: 1.8, step: 0.08 }] },
      'glitchking.leak': { n: 'Memory Leak', pose: 'roar', wind: 0, tip: 'Find a GREEN tile', parts: [{ k: 'use', m: 'checker' }] },
      'glitchking.bsod': { n: 'Blue Screen', pose: 'raise', wind: 0, tip: 'Stand in a GREEN circle', parts: [{ k: 'use', m: 'safe' }] },
      // ---- Drowned Cathedral: the Leviathan Bishop
      'leviathan.sermon': { n: 'Tidal Sermon', pose: 'raise', wind: 0.9, mult: 1.0, tip: 'A tide sweeps round', parts: [{ k: 'spin', n: 8, arc: 160, w: 1.6, step: 0.1 }] },
      'leviathan.toll': { n: 'Bell Toll', pose: 'shake', wind: 0, tip: 'A ring of sound: jump it', parts: [{ k: 'use', m: 'wave' }, { k: 'circle', at: 'self', r: 4, delay: 0.4 }] },
      'leviathan.choir': { n: 'Drowned Choir', pose: 'roar', wind: 0, tip: 'The choir rises (one heals him)', parts: [{ k: 'use', m: 'summon' }] },
      'leviathan.whirlpool': { n: 'Whirlpool', pose: 'channel', wind: 0.4, mult: 1.0, tip: 'Pools, and a ring of water on the edge', parts: [{ k: 'use', m: 'pools' }, { k: 'ring', at: 'room', n: 12, rad: 12, r: 2.2, delay: 0.6 }] },
      'leviathan.lunge': { n: 'Leviathan Lunge', pose: 'crouch', wind: 0.8, mult: 1.5, tip: 'He lunges through you', parts: [{ k: 'dash', w: 2.6 }] },
      'leviathan.flood': { n: 'The Flood', pose: 'raise', wind: 0, tip: 'Stand in a GREEN circle', parts: [{ k: 'use', m: 'safe' }] },
      // ---- Clockwork Spire: the Clockmaker
      'clockmaker.hands': { n: 'Clock Hands', pose: 'tilt', wind: 0.9, mult: 1.0, tip: 'The hands sweep the whole dial', parts: [{ k: 'spin', n: 12, arc: 360, w: 1.2, step: 0.08 }] },
      'clockmaker.cogs': { n: 'Cog Barrage', pose: 'channel', wind: 0.7, mult: 0.8, tip: 'Cogs drop around you', parts: [{ k: 'circle', at: 'target', n: 5, r: 1.8, spread: 6, step: 0.1, each: 1 }] },
      'clockmaker.escapement': { n: 'Escapement', pose: 'raise', wind: 1.0, mult: 1.2, tip: 'Four spokes turn out from it', parts: [{ k: 'cross', at: 'self', arms: 4, w: 1.4, rot: 22 }] },
      'clockmaker.pendulum': { n: 'Great Pendulum', pose: 'shake', wind: 0.9, mult: 1.3, tip: 'Two heavy swings', parts: [{ k: 'fan', n: 2, arc: 90, w: 2.2, step: 0.35 }] },
      'clockmaker.gears': { n: 'Gear Floor', pose: 'roar', wind: 0, tip: 'Find a GREEN tile', parts: [{ k: 'use', m: 'checker' }] },
      'clockmaker.midnight': { n: 'Midnight', pose: 'raise', wind: 0, tip: 'Stand in a GREEN circle', parts: [{ k: 'use', m: 'safe' }] },
      // ---- Hollow Moon: the Moon Eater
      'mooneater.beam': { n: 'Lunar Beam', pose: 'rear', wind: 1.0, mult: 1.5, tip: 'A beam of moonlight: sidestep', parts: [{ k: 'fan', n: 1, w: 2 }] },
      'mooneater.starfall': { n: 'Starfall', pose: 'channel', wind: 0.8, mult: 0.9, tip: 'Stars fall on everyone', parts: [{ k: 'circle', at: 'target', n: 6, r: 2, spread: 8, step: 0.1, each: 1 }] },
      'mooneater.phase': { n: 'Phase Shift', pose: 'sink', wind: 0, tip: 'It slips out of sight and lands on you', parts: [{ k: 'use', m: 'teleport' }] },
      'mooneater.well': { n: 'Gravity Well', pose: 'crouch', wind: 0.9, mult: 1.2, tip: 'A ring pulls shut, then the middle collapses', parts: [{ k: 'ring', at: 'target', n: 12, rad: 7, r: 1.6 }, { k: 'circle', at: 'target', r: 3, delay: 0.7 }] },
      'mooneater.crescent': { n: 'Crescent', pose: 'tilt', wind: 0.8, mult: 1.0, tip: 'A crescent sweeps across', parts: [{ k: 'spin', n: 9, arc: 200, w: 1.6, step: 0.06 }] },
      'mooneater.eclipse': { n: 'Total Eclipse', pose: 'raise', wind: 0, tip: 'Stand in a GREEN circle', parts: [{ k: 'use', m: 'safe' }] },
      // ---- mini-bosses: three moves each (the third only below half health)
      'brute.boulder': { n: 'Boulder Toss', pose: 'raise', wind: 0.9, mult: 1.2, parts: [{ k: 'circle', at: 'target', r: 3 }] },
      'brute.rush': { n: 'Bull Rush', pose: 'crouch', wind: 0.7, mult: 1.3, parts: [{ k: 'dash', w: 2 }] },
      'brute.quake': { n: 'Quake Stomp', pose: 'rear', wind: 0.9, mult: 1.2, parts: [{ k: 'circle', at: 'self', r: 5 }, { k: 'ring', at: 'self', n: 6, rad: 7.5, r: 1.8, delay: 0.4 }] },
      'barkwarden.bramble': { n: 'Bramble Line', pose: 'crouch', wind: 0.8, mult: 1.1, parts: [{ k: 'trail', lanes: 1, n: 6, r: 1.8, step: 0.1 }] },
      'barkwarden.gore': { n: 'Antler Gore', pose: 'rear', wind: 0.7, mult: 1.3, parts: [{ k: 'dash', w: 1.6 }] },
      'barkwarden.overgrowth': { n: 'Overgrowth', pose: 'roar', wind: 0.8, mult: 1.0, parts: [{ k: 'circle', at: 'target', n: 3, r: 2, spread: 4, step: 0.15, each: 1 }] },
      'guard.thrust': { n: 'Spear Thrust', pose: 'rear', wind: 0.6, mult: 1.3, parts: [{ k: 'fan', n: 1, len: 14, w: 1 }] },
      'guard.shieldCharge': { n: 'Shield Charge', pose: 'crouch', wind: 0.7, mult: 1.2, parts: [{ k: 'dash', w: 2 }] },
      'guard.howl': { n: 'Jackal Howl', pose: 'roar', wind: 0, parts: [{ k: 'use', m: 'summon' }] },
      'sandseer.glyphs': { n: 'Sand Glyphs', pose: 'channel', wind: 0.9, mult: 1.2, parts: [{ k: 'cross', at: 'target', arms: 2, w: 1.2, len: 20 }] },
      'sandseer.mirage': { n: 'Mirage', pose: 'sink', wind: 0, parts: [{ k: 'use', m: 'teleport' }] },
      'sandseer.dustDevils': { n: 'Dust Devils', pose: 'spin', wind: 0.8, mult: 0.9, parts: [{ k: 'circle', at: 'target', n: 4, r: 1.8, spread: 5, step: 0.15, each: 1 }] },
      'frostgiant.club': { n: 'Ice Club', pose: 'rear', wind: 0.8, mult: 1.4, parts: [{ k: 'circle', at: 'ahead', r: 4 }] },
      'frostgiant.avalanche': { n: 'Avalanche', pose: 'crouch', wind: 0.9, mult: 1.1, parts: [{ k: 'trail', lanes: 3, arc: 40, n: 5, r: 2, step: 0.1 }] },
      'frostgiant.frozenGround': { n: 'Frozen Ground', pose: 'shake', wind: 0.9, mult: 1.1, parts: [{ k: 'ring', at: 'self', n: 10, rad: 8, r: 2 }] },
      'rimewitch.lances': { n: 'Frost Lances', pose: 'tilt', wind: 0.8, mult: 1.1, parts: [{ k: 'fan', n: 3, arc: 40, w: 1, step: 0.08 }] },
      'rimewitch.prison': { n: 'Ice Prison', pose: 'raise', wind: 0.9, mult: 1.2, parts: [{ k: 'ring', at: 'target', n: 8, rad: 4.5, r: 1.6 }, { k: 'circle', at: 'target', r: 2.5, delay: 0.6 }] },
      'rimewitch.hail': { n: 'Hailstorm', pose: 'channel', wind: 0.8, mult: 0.9, parts: [{ k: 'circle', at: 'target', n: 6, r: 1.8, spread: 6, step: 0.08, each: 1 }] },
      'cknight.cleave': { n: 'Grave Cleave', pose: 'rear', wind: 0.7, mult: 1.4, parts: [{ k: 'fan', n: 1, len: 10, w: 2 }] },
      'cknight.march': { n: 'Death March', pose: 'crouch', wind: 0.7, mult: 1.2, parts: [{ k: 'dash', w: 2 }] },
      'cknight.cross': { n: 'Crypt Cross', pose: 'raise', wind: 0.9, mult: 1.2, parts: [{ k: 'cross', at: 'self', arms: 4, w: 1.3, len: 20 }] },
      'banshee.wail': { n: 'Wail', pose: 'roar', wind: 0, parts: [{ k: 'use', m: 'nova' }] },
      'banshee.shriek': { n: 'Shriek', pose: 'spin', wind: 0.8, mult: 1.0, parts: [{ k: 'fan', n: 4, arc: 270, w: 1.2 }] },
      'banshee.drift': { n: 'Phantom Drift', pose: 'sink', wind: 0, parts: [{ k: 'use', m: 'teleport' }] },
      'pyro.jet': { n: 'Flame Jet', pose: 'rear', wind: 0.7, mult: 1.2, parts: [{ k: 'fan', n: 1, len: 16, w: 1.6 }] },
      'pyro.rings': { n: 'Fire Rings', pose: 'raise', wind: 0.8, mult: 1.0, parts: [{ k: 'ring', at: 'self', n: 8, rad: 6, r: 2 }] },
      'pyro.pyre': { n: 'Pyre', pose: 'channel', wind: 0, parts: [{ k: 'use', m: 'pools' }] },
      'smelter.ladle': { n: 'Slag Ladle', pose: 'raise', wind: 0.9, mult: 1.3, parts: [{ k: 'circle', at: 'target', r: 3.5 }] },
      'smelter.bellows': { n: 'Bellows Charge', pose: 'crouch', wind: 0.7, mult: 1.2, parts: [{ k: 'dash', w: 2.2 }] },
      'smelter.spill': { n: 'Molten Spill', pose: 'tilt', wind: 0.8, mult: 1.0, parts: [{ k: 'trail', lanes: 2, arc: 60, n: 6, r: 2, step: 0.1 }] },
      'tempest.gale': { n: 'Gale', pose: 'spin', wind: 0.7, mult: 1.0, parts: [{ k: 'spin', n: 5, arc: 120, w: 1.6, step: 0.08 }] },
      'tempest.static': { n: 'Static Orbs', pose: 'channel', wind: 0, parts: [{ k: 'use', m: 'orbs' }] },
      'tempest.downdraft': { n: 'Downdraft', pose: 'float', wind: 0.8, mult: 1.0, parts: [{ k: 'circle', at: 'target', n: 4, r: 2, spread: 4, step: 0.12, each: 1 }] },
      'conduit.arcs': { n: 'Arc Lines', pose: 'raise', wind: 0.8, mult: 1.2, parts: [{ k: 'cross', at: 'target', arms: 2, w: 1.2, len: 26 }] },
      'conduit.overcharge': { n: 'Overcharge', pose: 'shake', wind: 0, parts: [{ k: 'use', m: 'nova' }] },
      'conduit.grid': { n: 'Conductor Grid', pose: 'roar', wind: 0, parts: [{ k: 'use', m: 'checker' }] },
      'voidknight.slash': { n: 'Void Slash', pose: 'tilt', wind: 0.6, mult: 1.3, parts: [{ k: 'fan', n: 2, arc: 30, len: 12, w: 1.4, step: 0.15 }] },
      'voidknight.shadowStep': { n: 'Shadow Step', pose: 'sink', wind: 0, parts: [{ k: 'use', m: 'teleport' }] },
      'voidknight.rift': { n: 'Rift Cross', pose: 'raise', wind: 0.9, mult: 1.2, parts: [{ k: 'cross', at: 'target', arms: 4, w: 1.3, len: 22 }] },
      'archon.nullOrbs': { n: 'Null Orbs', pose: 'channel', wind: 0, parts: [{ k: 'use', m: 'orbs' }] },
      'archon.sigil': { n: 'Sigil', pose: 'raise', wind: 0.9, mult: 1.1, parts: [{ k: 'ring', at: 'target', n: 8, rad: 5, r: 1.8 }] },
      'archon.judgement': { n: 'Judgement', pose: 'spin', wind: 0.9, mult: 1.1, parts: [{ k: 'fan', n: 6, arc: 300, w: 1.2 }] },
      'horror.eyeBeams': { n: 'Eye Beams', pose: 'rear', wind: 0.8, mult: 1.1, parts: [{ k: 'fan', n: 3, arc: 60, w: 1.3, step: 0.1 }] },
      'horror.grasp': { n: 'Grasp', pose: 'channel', wind: 0.7, mult: 1.1, parts: [{ k: 'circle', at: 'target', n: 2, r: 2.2, spread: 2, step: 0.3, each: 1 }] },
      'horror.ink': { n: 'Ink Pools', pose: 'crouch', wind: 0, parts: [{ k: 'use', m: 'pools' }] },
      'leech.latch': { n: 'Latch', pose: 'crouch', wind: 0.6, mult: 1.3, parts: [{ k: 'dash', w: 1.8 }] },
      'leech.brood': { n: 'Brood', pose: 'roar', wind: 0, parts: [{ k: 'use', m: 'summon' }] },
      'leech.drain': { n: 'Drain Spiral', pose: 'spin', wind: 0.8, mult: 1.0, parts: [{ k: 'spin', n: 8, arc: 360, w: 1.2, step: 0.08 }] },
      'errorknight.nullSlash': { n: 'Null Slash', pose: 'tilt', wind: 0.6, mult: 1.3, parts: [{ k: 'fan', n: 2, arc: 20, len: 14, w: 1.2 }] },
      'errorknight.undo': { n: 'Ctrl+Z', pose: 'sink', wind: 0, parts: [{ k: 'use', m: 'teleport' }] },
      'errorknight.errorCross': { n: 'Error Cross', pose: 'shake', wind: 0.9, mult: 1.2, parts: [{ k: 'cross', at: 'self', arms: 4, w: 1.2, len: 24 }] },
      'segfault.faults': { n: 'Fault Lines', pose: 'crouch', wind: 0.8, mult: 1.0, parts: [{ k: 'trail', lanes: 4, arc: 90, n: 5, r: 1.7, step: 0.08 }] },
      'segfault.dump': { n: 'Core Dump', pose: 'channel', wind: 0.7, mult: 0.9, parts: [{ k: 'circle', at: 'target', n: 5, r: 1.7, spread: 7, step: 0.06, each: 1 }] },
      'segfault.grid': { n: 'Segmented Grid', pose: 'roar', wind: 0, parts: [{ k: 'use', m: 'checker' }] },
      'bellringer.toll': { n: 'Toll', pose: 'shake', wind: 0, parts: [{ k: 'use', m: 'wave' }] },
      'bellringer.clapper': { n: 'Clapper Swing', pose: 'tilt', wind: 0.8, mult: 1.2, parts: [{ k: 'spin', n: 6, arc: 120, len: 10, w: 1.6, step: 0.07 }] },
      'bellringer.resonance': { n: 'Resonance', pose: 'raise', wind: 0.9, mult: 1.0, parts: [{ k: 'ring', at: 'self', n: 12, rad: 10, r: 2 }] },
      'abbess.holyWater': { n: 'Holy Water', pose: 'channel', wind: 0, parts: [{ k: 'use', m: 'pools' }] },
      'abbess.veil': { n: 'Veil Step', pose: 'sink', wind: 0, parts: [{ k: 'use', m: 'teleport' }] },
      'abbess.litany': { n: 'Litany', pose: 'raise', wind: 0.8, mult: 1.0, parts: [{ k: 'fan', n: 5, arc: 120, w: 1.2, step: 0.06 }] },
      'foreman.rivets': { n: 'Rivet Gun', pose: 'channel', wind: 0.6, mult: 0.9, parts: [{ k: 'circle', at: 'target', n: 4, r: 1.6, spread: 5, step: 0.1, each: 1 }] },
      'foreman.steam': { n: 'Steam Charge', pose: 'crouch', wind: 0.7, mult: 1.3, parts: [{ k: 'dash', w: 2.2 }] },
      'foreman.piston': { n: 'Piston Line', pose: 'shake', wind: 0.8, mult: 1.1, parts: [{ k: 'trail', lanes: 1, n: 8, r: 2, step: 0.08 }] },
      'pendulum.swing': { n: 'Swing', pose: 'tilt', wind: 0.7, mult: 1.2, parts: [{ k: 'fan', n: 2, arc: 120, w: 2, step: 0.3 }] },
      'pendulum.counterweight': { n: 'Counterweight', pose: 'float', wind: 0.8, mult: 1.4, parts: [{ k: 'leap', r: 4 }] },
      'pendulum.tickTock': { n: 'Tick-Tock', pose: 'spin', wind: 0.8, mult: 1.0, parts: [{ k: 'spin', n: 10, arc: 360, w: 1.2, step: 0.08 }] },
      'hound.pounce': { n: 'Pounce', pose: 'crouch', wind: 0.6, mult: 1.3, parts: [{ k: 'leap', r: 3.5 }] },
      'hound.howl': { n: 'Howl at the Moon', pose: 'roar', wind: 0, parts: [{ k: 'use', m: 'nova' }] },
      'hound.pack': { n: 'Pack Hunt', pose: 'roar', wind: 0, parts: [{ k: 'use', m: 'summon' }] },
      'eclipse.umbra': { n: 'Umbra', pose: 'raise', wind: 0.9, mult: 1.2, parts: [{ k: 'circle', at: 'target', r: 4 }, { k: 'ring', at: 'target', n: 8, rad: 6.5, r: 1.6, delay: 0.4 }] },
      'eclipse.corona': { n: 'Corona', pose: 'channel', wind: 0.9, mult: 1.0, parts: [{ k: 'ring', at: 'self', n: 12, rad: 9, r: 2 }] },
      'eclipse.darkSun': { n: 'Dark Sun', pose: 'roar', wind: 0, parts: [{ k: 'use', m: 'meteor' }] },
      'mimic.chomp': { n: 'Chomp', pose: 'crouch', wind: 0.5, mult: 1.3, parts: [{ k: 'dash', w: 1.8, len: 9 }] },
      'mimic.coins': { n: 'Coin Spit', pose: 'rear', wind: 0.7, mult: 0.9, parts: [{ k: 'circle', at: 'target', n: 5, r: 1.4, spread: 5, step: 0.07, each: 1 }] },
      'mimic.goldRush': { n: 'Gold Rush', pose: 'spin', wind: 0.8, mult: 1.0, parts: [{ k: 'spin', n: 6, arc: 360, w: 1.3, step: 0.08 }] }
    },
    // which moves each one uses: p1 above half health, p2 below half (faster), p3 below a quarter (bosses). heart: below half it hides behind a
    // heart you must break. healer: its summons include a healer
    BOSS_KITS: {
      treant: { p1: ['treant.rootWall', 'treant.seedBurst', 'treant.canopyCrush'], p2: ['treant.rootWall', 'treant.thornFan', 'treant.seedBurst', 'treant.saplings', 'treant.canopyCrush'], p3: ['treant.forestWrath', 'treant.thornFan', 'treant.rootWall', 'treant.canopyCrush'] },
      pharaoh: { p1: ['pharaoh.sandLash', 'pharaoh.curse', 'pharaoh.scarabRain'], p2: ['pharaoh.sandstorm', 'pharaoh.curse', 'pharaoh.sarcophagus', 'pharaoh.sandLash', 'pharaoh.scarabRain'], p3: ['pharaoh.judgement', 'pharaoh.sandstorm', 'pharaoh.curse', 'pharaoh.scarabRain'], healer: 1 },
      lich: { p1: ['lich.graveHands', 'lich.soulLance', 'lich.phylactery'], p2: ['lich.boneCage', 'lich.wraiths', 'lich.soulLance', 'lich.phylactery', 'lich.graveHands'], p3: ['lich.deathSpiral', 'lich.boneCage', 'lich.wraiths', 'lich.soulLance'], heart: 1 },
      wyrm: { p1: ['wyrm.breath', 'wyrm.tailSweep', 'wyrm.icefall'], p2: ['wyrm.glacierDive', 'wyrm.breath', 'wyrm.shatter', 'wyrm.tailSweep', 'wyrm.icefall'], p3: ['wyrm.blizzard', 'wyrm.glacierDive', 'wyrm.breath', 'wyrm.tailSweep'] },
      titan: { p1: ['titan.magmaFist', 'titan.fissure', 'titan.slagRain'], p2: ['titan.forgeHammer', 'titan.eruption', 'titan.magmaFist', 'titan.fissure', 'titan.slagRain'], p3: ['titan.moltenCore', 'titan.forgeHammer', 'titan.eruption', 'titan.magmaFist'] },
      dragon: { p1: ['dragon.breath', 'dragon.chain', 'dragon.gust'], p2: ['dragon.diveBomb', 'dragon.stormCage', 'dragon.breath', 'dragon.gust', 'dragon.chain'], p3: ['dragon.thunderstorm', 'dragon.diveBomb', 'dragon.breath', 'dragon.stormCage'] },
      king: { p1: ['king.decree', 'king.scepter', 'king.guard'], p2: ['king.crownStep', 'king.decree', 'king.risingFire', 'king.scepter', 'king.guard'], p3: ['king.execution', 'king.crownStep', 'king.decree', 'king.scepter'], heart: 1, healer: 1 },
      abyssal: { p1: ['abyssal.grasp', 'abyssal.gaze', 'abyssal.maw'], p2: ['abyssal.eyeStorm', 'abyssal.voidGrid', 'abyssal.gaze', 'abyssal.grasp', 'abyssal.maw'], p3: ['abyssal.consume', 'abyssal.eyeStorm', 'abyssal.gaze', 'abyssal.grasp'], heart: 1 },
      glitchking: { p1: ['glitchking.bitFlip', 'glitchking.packets', 'glitchking.exe'], p2: ['glitchking.overflow', 'glitchking.leak', 'glitchking.bitFlip', 'glitchking.exe', 'glitchking.packets'], p3: ['glitchking.bsod', 'glitchking.overflow', 'glitchking.bitFlip', 'glitchking.packets'] },
      leviathan: { p1: ['leviathan.sermon', 'leviathan.toll', 'leviathan.choir'], p2: ['leviathan.whirlpool', 'leviathan.lunge', 'leviathan.sermon', 'leviathan.toll', 'leviathan.choir'], p3: ['leviathan.flood', 'leviathan.lunge', 'leviathan.whirlpool', 'leviathan.sermon'], healer: 1 },
      clockmaker: { p1: ['clockmaker.hands', 'clockmaker.cogs', 'clockmaker.escapement'], p2: ['clockmaker.pendulum', 'clockmaker.gears', 'clockmaker.hands', 'clockmaker.escapement', 'clockmaker.cogs'], p3: ['clockmaker.midnight', 'clockmaker.pendulum', 'clockmaker.hands', 'clockmaker.escapement'], heart: 1 },
      mooneater: { p1: ['mooneater.beam', 'mooneater.starfall', 'mooneater.phase'], p2: ['mooneater.well', 'mooneater.crescent', 'mooneater.beam', 'mooneater.phase', 'mooneater.starfall'], p3: ['mooneater.eclipse', 'mooneater.well', 'mooneater.crescent', 'mooneater.beam'] },
      brute: { p1: ['brute.boulder', 'brute.rush'], p2: ['brute.quake', 'brute.rush', 'brute.boulder'] }, barkwarden: { p1: ['barkwarden.bramble', 'barkwarden.gore'], p2: ['barkwarden.overgrowth', 'barkwarden.gore', 'barkwarden.bramble'] },
      guard: { p1: ['guard.thrust', 'guard.shieldCharge'], p2: ['guard.howl', 'guard.thrust', 'guard.shieldCharge'] }, sandseer: { p1: ['sandseer.glyphs', 'sandseer.mirage'], p2: ['sandseer.dustDevils', 'sandseer.glyphs', 'sandseer.mirage'] },
      frostgiant: { p1: ['frostgiant.club', 'frostgiant.avalanche'], p2: ['frostgiant.frozenGround', 'frostgiant.club', 'frostgiant.avalanche'] }, rimewitch: { p1: ['rimewitch.lances', 'rimewitch.prison'], p2: ['rimewitch.hail', 'rimewitch.lances', 'rimewitch.prison'] },
      cknight: { p1: ['cknight.cleave', 'cknight.march'], p2: ['cknight.cross', 'cknight.cleave', 'cknight.march'] }, banshee: { p1: ['banshee.wail', 'banshee.shriek'], p2: ['banshee.drift', 'banshee.shriek', 'banshee.wail'] },
      pyro: { p1: ['pyro.jet', 'pyro.rings'], p2: ['pyro.pyre', 'pyro.jet', 'pyro.rings'] }, smelter: { p1: ['smelter.ladle', 'smelter.bellows'], p2: ['smelter.spill', 'smelter.ladle', 'smelter.bellows'] },
      tempest: { p1: ['tempest.gale', 'tempest.static'], p2: ['tempest.downdraft', 'tempest.gale', 'tempest.static'] }, conduit: { p1: ['conduit.arcs', 'conduit.overcharge'], p2: ['conduit.grid', 'conduit.arcs', 'conduit.overcharge'] },
      voidknight: { p1: ['voidknight.slash', 'voidknight.shadowStep'], p2: ['voidknight.rift', 'voidknight.slash', 'voidknight.shadowStep'] }, archon: { p1: ['archon.nullOrbs', 'archon.sigil'], p2: ['archon.judgement', 'archon.sigil', 'archon.nullOrbs'] },
      horror: { p1: ['horror.eyeBeams', 'horror.grasp'], p2: ['horror.ink', 'horror.eyeBeams', 'horror.grasp'] }, leech: { p1: ['leech.latch', 'leech.brood'], p2: ['leech.drain', 'leech.latch', 'leech.brood'] },
      errorknight: { p1: ['errorknight.nullSlash', 'errorknight.undo'], p2: ['errorknight.errorCross', 'errorknight.nullSlash', 'errorknight.undo'] }, segfault: { p1: ['segfault.faults', 'segfault.dump'], p2: ['segfault.grid', 'segfault.faults', 'segfault.dump'] },
      bellringer: { p1: ['bellringer.toll', 'bellringer.clapper'], p2: ['bellringer.resonance', 'bellringer.clapper', 'bellringer.toll'] }, abbess: { p1: ['abbess.holyWater', 'abbess.veil'], p2: ['abbess.litany', 'abbess.holyWater', 'abbess.veil'] },
      foreman: { p1: ['foreman.rivets', 'foreman.steam'], p2: ['foreman.piston', 'foreman.rivets', 'foreman.steam'] }, pendulum: { p1: ['pendulum.swing', 'pendulum.counterweight'], p2: ['pendulum.tickTock', 'pendulum.swing', 'pendulum.counterweight'] },
      hound: { p1: ['hound.pounce', 'hound.howl'], p2: ['hound.pack', 'hound.pounce', 'hound.howl'] }, eclipse: { p1: ['eclipse.umbra', 'eclipse.corona'], p2: ['eclipse.darkSun', 'eclipse.umbra', 'eclipse.corona'] },
      mimic: { p1: ['mimic.chomp', 'mimic.coins'], p2: ['mimic.goldRush', 'mimic.chomp', 'mimic.coins'] }
    },
    // how hard each move hits (x the boss's damage) and how long its warning shows (seconds)
    MOVES: { slam: [1.3, 1.15], ring: [0.7, 0.75], barrage: [0.6, 1.1], lines: [1.1, 1.0], cross: [1.2, 1.15], sweep: [0.8, 0.85], checker: [1.5, 2.0], safe: [2.6, 2.8],
             charge: [1.4, 0.9], teleport: [1.5, 1.2], stomp: [1.4, 0.75], orbs: [0.9, 0], meteor: [0.9, 1.0], nova: [1.6, 1.5], spiral: [0.8, 0.8], pools: [1, 1.0], summon: [0, 0.8] },
    MINI_EVERY: [4.6, 3.4],     // seconds between a mini-boss's special moves (above / below half health)
    DIFFS: [
      // Update 7: each difficulty is its own step on the ladder (lv = levels above the dungeon's Normal), so the step's level gives the extra health,
      // damage, XP and gold. hp / dmg add a little more on top; luck makes rare gear likelier
      { id: 'normal', n: 'Normal', hp: 1, dmg: 1, lv: 0, luck: 1, xp: 1, gold: 1, time: 1 },
      { id: 'hard', n: 'Hard', hp: 1.08, dmg: 1.05, lv: 5, luck: 2, xp: 1, gold: 1 , time: 840 / 720 },
      { id: 'nightmare', n: 'Nightmare', hp: 1.16, dmg: 1.1, lv: 10, luck: 3.5, xp: 1, gold: 1 , time: 960 / 720 }
    ],
    HARDCORE: { lv: 0, luck: 1.6, xp: 1.3, gold: 1.3, items: 1 },   // one life: die and you are out (if the party clears, you still get the rewards). Same level as its difficulty; the boss drops 1 more item
    // ---------- Boss Raids: one empowered boss in an arena, for exclusive Epic-or-better rings (and a rare cosmetic) ----------
    // a raid opens when you clear its dungeon on Hard. Nobody respawns during a raid: if the whole party falls, the raid is lost.
    // a raid is that dungeon's Nightmare level (its ring is never above it)
    RAID_BOSS: { HP: 3, DMG: 1.6, XP: 3, GOLD: 3, FIRST: 1, MIN_RARITY: 3, LUCK: 3, COSM_CHANCE: 0.15, RING_VALUE: 3, ADDS_HP: 0.5 },
    RAIDS: [
      { i: 0, ring: 'Rotwood Band', cosm: { k: 'trail', v: '#5aff3a', n: 'Rotwood Trail' } },
      { i: 1, ring: "Pharaoh's Seal", cosm: { k: 'cape', v: '#c8a040', n: 'Pharaoh Gold Cloak' } },
      { i: 2, ring: "Lich's Signet", cosm: { k: 'trail', v: '#3affc8', n: 'Soulfire Trail' } },
      { i: 3, ring: 'Wyrmcoil', cosm: { k: 'cape', v: '#9ad8ff', n: 'Wyrmscale Cloak' } },
      { i: 4, ring: "Titan's Knuckle", cosm: { k: 'trail', v: '#ff6a1a', n: 'Magma Trail' } },
      { i: 5, ring: 'Eye of the Storm', cosm: { k: 'cape', v: '#4a5aaa', n: 'Stormcloud Cloak' } },
      { i: 6, ring: 'Crownloop', cosm: { k: 'trail', v: '#c87aff', n: 'Void Trail' } },
      { i: 7, ring: 'Abyssal Halo', cosm: { k: 'cape', v: '#8a0a2a', n: 'Abyssal Shroud' } }
    ],
    // ---------- things in the dungeon between the fights ----------
    // breakable crates/urns: chance of gold (x one slime's gold), a potion, or a piece of gear
    PROPS: { GOLD: 0.45, GOLD_UNITS: 1 },
    // one treasure chest per run (hit it 3 times); 1 in 5 is a Mimic that fights back and drops double loot
    CHEST: { HITS: 3, MIMIC: 0.2, GOLD_UNITS: 12, MIMIC_GOLD: 2.5 },
    // spike traps across the halls: idle, then a red warning, then spikes (dodge, jump or time it). DMG = share of your max health (x difficulty)
    TRAP: { PERIOD: 3.4, WARN: 0.8, UP: 0.6, DMG: 0.1, DIFF: [1, 1.2, 1.4] },
    // one shrine per run: walk onto it for a power-up
    SHRINE_DUR: 30,
    SHRINES: [{ id: 'might', n: 'Shrine of Might', d: '+50% damage for 30 seconds', col: '#ff4a3a' }, { id: 'haste', n: 'Shrine of Haste', d: '+30% attack and move speed for 30 seconds', col: '#ffd84a' },
              { id: 'arcana', n: 'Shrine of Arcana', d: 'abilities recharge twice as fast for 30 seconds', col: '#3ad8ff' }, { id: 'fortune', n: 'Shrine of Fortune', d: '+60% loot luck for the rest of the run', col: '#c87aff' }],
    PARTY_MAX: 4,
    PARTY_XP: 0.05,   // party bonus: +5% XP for every other slayer in your run (up to +15%)
    RESPAWN_TIME: 5,            // seconds before you respawn at the last room you reached (not in Hardcore)
    CLEAR_BONUS: 0.35,          // finishing a dungeon gives this much extra XP and gold
    FIRST_CLEAR_GOLD: 1,        // the first time you clear each dungeon + difficulty you get this much extra gold (1 = double)
    MIN_CLEAR_FRACTION: 0.25,   // anti-cheat: a clear faster than this share of the expected solo time gives nothing
    MIN_WALK_FRACTION: 0.5,     // ... or faster than half the time it takes to walk from the start to the boss at top speed (Update 7: strong slayers can one-shot a low dungeon)
    // ---------- wave defence (The Pit) ----------
    PIT: { WAVE_MOBS: 4, WAVE_ADD: 1, WAVE_GROWTH: 1.12, DMG_GROWTH: 1.07 },
    // Update 6 balance: the Pit, the Tower and the Wilds pay k x a Normal clear of your best dungeon per wave / floor / camp, growing by 'grow' each
    // one (up to 'cap' of them). Aimed at 90% (Pit), 92% (Tower) and 55% (Wilds) of a dungeon's gold and XP per minute; only dungeons drop gear
    MODE_PAY: { pit: { k: 0.064, grow: 0.04, cap: 30 }, tower: { k: 0.075, grow: 0.05, cap: 30 }, wild: { k: 0.092, grow: 0, cap: 1 } },
    // ---------- events (server clock, minutes past each half hour) ----------
    // (Slime Rain was removed in Update 5)
    EVENTS: [{ id: 'coins', n: '2x Gold', at: 0, len: 5, c: '#ffc83a' },
             { id: 'raid', n: 'World Boss Raid', at: 15, len: 4, c: '#ff4a4a' }, { id: 'luck', n: 'Lucky Loot', at: 22, len: 5, c: '#c87aff' }],
    RAID_HP_PER_PLAYER: 220, RAID_MIN_HITS: 15, RAID_GOLD_RUNS: 1.6,   // raid health counts HITS (not damage) so every level helps the same
    WEEKLY_REWARDS: [4, 3, 2, 1.5, 1.5, 1, 1, 0.5, 0.5, 0.5],   // gold for the weekly top 10 (dungeon score), in Normal clears of your best dungeon
    // ---------- milestones, daily (Update 7 final: daily quests and weekly challenges are gone) ----------
    STREAK_GOLD: [0.2, 0.25, 0.3, 0.35, 0.5, 0.6, 0.9],   // login streak: gold in Normal clears of your best dungeon (day 1, 2, ... 7+)
    STREAK_LUCK: 0.02, STREAK_LUCK_MAX: 0.1,
    GIFT: { ITEMS: 4, LUCK: 1.5 },   // the Daily Gift (Update 7 final): 4 random pieces of gear from the hardest step your level can enter, with that step's loot luck x1.5
    MILESTONES: [
      { id: 'k100', n: 'Slay 100 slimes', stat: 'kills', need: 100, gold: 0.3 }, { id: 'k1000', n: 'Slay 1,000 slimes', stat: 'kills', need: 1000, gold: 0.9 },
      { id: 'k10000', n: 'Slay 10,000 slimes', stat: 'kills', need: 10000, gold: 3 }, { id: 'lv10', n: 'Reach level 15', stat: 'level', need: 15, gold: 0.48 },
      { id: 'raid1', n: 'Clear a Boss Raid', stat: 'raidClears', need: 1, gold: 0.9 }, { id: 'raid10', n: 'Clear 10 Boss Raids', stat: 'raidClears', need: 10, gold: 2.4 },
      { id: 'lv25', n: 'Reach level 45', stat: 'level', need: 45, gold: 1.2 }, { id: 'lv50', n: 'Reach level 90', stat: 'level', need: 90, gold: 2.4 }, { id: 'lv75', n: 'Reach level 135', stat: 'level', need: 135, gold: 6 }, { id: 'lv180', n: 'Reach level 180', stat: 'level', need: 180, gold: 9 },
      { id: 'c1', n: 'Clear your first dungeon', stat: 'clears', need: 1, gold: 0.6 }, { id: 'c25', n: 'Clear 25 dungeons', stat: 'clears', need: 25, gold: 1.5 }, { id: 'c100', n: 'Clear 100 dungeons', stat: 'clears', need: 100, gold: 3.6 },
      { id: 'b10', n: 'Defeat 10 bosses', stat: 'bossKills', need: 10, gold: 1.2 }, 
      { id: 'gl1', n: 'Find Legendary gear', stat: 'lootLeg', need: 1, gold: 0.9 },
      { id: 'nm1', n: 'Clear a Nightmare dungeon', stat: 'nmClears', need: 1, gold: 1.5 }, { id: 'hc1', n: 'Clear a Hardcore dungeon', stat: 'hcClears', need: 1, gold: 1.5 },
      { id: 'relic4', n: 'Find 4 relics', stat: 'relicN', need: 4, gold: 1.2 }, { id: 'pit10', n: 'Reach wave 10 in the Pit', stat: 'pitBest', need: 10, gold: 0.9 },
      // Update 6
      { id: 'parry50', n: 'Parry 50 attacks', stat: 'parries', need: 50, gold: 0.9 }, { id: 'pd50', n: 'Make 50 perfect dodges', stat: 'pdodges', need: 50, gold: 0.9 }, { id: 'ult10', n: 'Use 10 ultimates', stat: 'ults', need: 10, gold: 0.6 },
      { id: 'sss1', n: 'Reach style rank SSS', stat: 'sss', need: 1, gold: 1.8 }, { id: 'tower10', n: 'Reach floor 10 of the Endless Tower', stat: 'towerBest', need: 10, gold: 0.9 }, { id: 'tower25', n: 'Reach floor 25 of the Endless Tower', stat: 'towerBest', need: 25, gold: 1.8 },
      { id: 'camps25', n: 'Clear 25 camps in the Wilds', stat: 'wildCamps', need: 25, gold: 0.9 }, { id: 'ways5', n: 'Find all 5 wayshrines', stat: 'wayN', need: 5, gold: 1.2 }, { id: 'lanterns12', n: 'Find every lost lantern', stat: 'lanternN', need: 12, gold: 2.4 },
      { id: 'craft10', n: 'Craft 10 times', stat: 'crafts', need: 10, gold: 0.6 }, { id: 'pass10', n: 'Reach Battle Pass tier 10', stat: 'passTier', need: 10, gold: 0.9 }, { id: 'pass30', n: 'Finish the Battle Pass', stat: 'passTier', need: 30, gold: 3 },
      { id: 'duel1', n: 'Win a duel', stat: 'duelWins', need: 1, gold: 0.6 }, { id: 'best3', n: 'Complete 3 bestiary pages', stat: 'bestiary', need: 3, gold: 1.2 }
    ],
    TITLES: [{ id: 'rookie', n: 'Rookie' }, { id: 'hunter', n: 'Slime Hunter', stat: 'kills', need: 500 }, { id: 'slayer', n: 'Slime Slayer', stat: 'kills', need: 5000 },
             { id: 'delver', n: 'Dungeon Delver', stat: 'clears', need: 50 }, { id: 'bossbane', n: 'Bossbane', stat: 'bossKills', need: 25 },
             { id: 'nightmare', n: 'Nightmare', stat: 'nmClears', need: 10 }, { id: 'hardcore', n: 'Hardcore Hero', stat: 'hcClears', need: 5 }, { id: 'relic', n: 'Relic Seeker', stat: 'relicN', need: 8 },
             { id: 'champion', n: 'Pit Champion', stat: 'pitBest', need: 20 }, { id: 'raider', n: 'Raider', stat: 'raidClears', need: 1 }, { id: 'raidlord', n: 'Raid Lord', stat: 'raidClears', need: 25 },
             { id: 'legend', n: 'Living Legend', stat: 'level', need: 135 }, { id: 'pathfinder', n: 'Pathfinder', stat: 'wayN', need: 5 }, { id: 'lamplighter', n: 'Lamplighter', stat: 'lanternN', need: 12 },
             { id: 'moonbreaker', n: 'Moonbreaker', stat: 'level', need: 180 }, { id: 'climber', n: 'Tower Climber', pass: 1 }, { id: 'tidecaller', n: 'Tidecaller', pass: 1 }, { id: 'duelist', n: 'Duelist', stat: 'duelWins', need: 10 },
             { id: 'towerlord', n: 'Lord of the Tower', stat: 'towerBest', need: 50 }, { id: 'stylish', n: 'Stylish', stat: 'sss', need: 1 }, { id: 'parrygod', n: 'Untouchable', stat: 'parries', need: 500 }],
    // ---------- cosmetics (the Armory). Equipped armour changes your outfit unless you choose to show your outfit instead ----------
    LOOK: {
      skin: ['#f6d7bf', '#f0c8a0', '#e8b48a', '#d8a07a', '#c68a5e', '#b07450', '#8d5a3b', '#6e432a', '#4e2e1c', '#f0d0c8', '#d8b8a8', '#a88878'],
      hairC: ['#121116', '#2a1a14', '#4a2e1c', '#6a4a2a', '#8a6a3a', '#c8a060', '#e8d8b0', '#d8d8e2', '#7a1a20', '#3a1a4a', '#1a2a4a', '#2a4a3a'],
      eye: ['#6a7a90', '#3a6aa8', '#4a8a5a', '#7a4a28', '#2a2a30', '#b45aff', '#ff3a4a', '#e8a030', '#3ad8c8', '#c8c8d8'],
      cloth: ['#15151a', '#1c1e25', '#2a2d36', '#3a3e48', '#5a5e68', '#8a8e98', '#c8c8d0', '#5a1018', '#8a1a24', '#3a2218', '#5a3a26', '#7a5a3a',
              '#1a2a4a', '#2a3a6a', '#1a3a2a', '#2a4a2a', '#3a1a4a', '#5a2a7a', '#6a5a1a', '#a08a3a'],
      glow: ['#3ab8ff', '#ff2a2a', '#b45aff', '#7aff5a', '#ffb03a', '#ffffff', '#3affc8', '#ff4aff'],
      outfits: [{ id: 'tee', n: 'Street Clothes' }, { id: 'coat', n: 'Wanderer Coat', need: { stat: 'level', v: 10 } }, { id: 'ninja', n: 'Shadow Ninja', need: { stat: 'level', v: 20 } },
                { id: 'mage', n: 'Warlock Robes', need: { stat: 'bossKills', v: 1 } }, { id: 'knight', n: 'Dark Knight Armour', need: { stat: 'bossKills', v: 3 } }],
      capes: [{ id: '', n: 'None' }, { id: 'cape', n: 'Cloak', need: { stat: 'level', v: 15 } }],
      faces: ['serious', 'smirk', 'determined', 'angry', 'happy'],
      trails: ['#bfe8ff', '#ff4a4a', '#b45aff', '#7aff5a', '#ffb03a', '#ffffff']
    },
    EMOTE_IDS: ['wave', 'dance1', 'dance2', 'dance3', 'laugh', 'cry', 'flex', 'point', 'salute', 'sitE', 'cheer'],
    // ---------- Update 7: old saves. Gems, pets, eggs, the Gem Shop and talents are gone; this is what each becomes (gold) ----------
    // clears = Normal clears of your best dungeon worth of gold, worked out when the save is first loaded
    MIGRATE7: {
      GEM: 0.06,                 // every gem you had = 0.06 clears (about what a gem bought: 40 gems were 15 minutes of double gold)
      PET_EGG: [150, 500, 1500, 4500, 13000, 38000, 110000, 320000],   // what each dungeon's egg cost (gold)
      PET_RARITY: [1, 1.5, 2.5, 5, 15, 40, 100],                       // x the egg's cost by pet rarity (Common ... Godly): rarer pets took many eggs
      PET_TIER: [1, 3, 9],                                             // Golden pets took 3 pets, Rainbow 9
      PET_LEVEL: 0.1,            // + 0.1 clears for every level a pet had gained (feeding and fighting)
      TALENT: 0.5,               // every talent you had learned = 0.5 clears
      BOOST_GEMS_MIN: 2.3,       // a Gem Shop boost still running: its gems back for the minutes left (a 15-minute boost was 30-40 gems)
      SLOT_GEMS: [60, 150, 350], BAG_GEMS: [40, 80, 160]   // gems spent on pet slots and bag slots are paid back (as gold, at GEM)
    },
    // ---------- Update 7 · phase 2: old saves move onto the new ladder ----------
    // your level and every item's level slide along these points (old level -> new level, straight lines between them), so you stand at the same place
    // on the ladder as before: the start of each old dungeon is the start of the same dungeon now. Your stat points scale to the new total.
    MIGRATE8: { OLD: [1, 12, 24, 38, 51, 65, 78, 93, 108, 122, 136, 150], NEW: [1, 15, 30, 45, 60, 75, 90, 105, 135, 150, 165, 180] },
    // ---------- Update 7 · phase 3: old saves ----------
    // Shadowblades and Guardians become Warriors (their gear becomes Warrior gear of the same level, rarity and bonuses); every secret ability learned
    // from a tome (tomes are gone: the ladder gives the abilities) pays TOME clears of gold; ability bars keep the first two abilities that still exist
    MIGRATE9: { TOME: 1 },
    MIGRATE10: { RUNE: 20 },
    // ---------- the Shop (Update 7 final): cosmetic skins from chests paid with dust (salvage gear at the Blacksmith). Every chest holds the same skins;
    // a better chest only has better odds (w = weight of each skin rarity). A skin only changes how your armour or weapon looks: your gear and its
    // Power stay. A skin you already own pays DUPE dust back instead
    SHOP: {
      RAR: [{ n: 'Common', c: '#b4b8c4' }, { n: 'Rare', c: '#3b8cff' }, { n: 'Epic', c: '#b44dff' }, { n: 'Legendary', c: '#ffc21a' }, { n: 'Mythic', c: '#ff3a5a' }],
      CHESTS: [{ id: 'common', n: 'Common Chest', cost: 40, w: [70, 22, 6, 1.8, 0.2], col: '#8a8f9c' },
               { id: 'rare', n: 'Rare Chest', cost: 150, w: [35, 38, 18, 7, 2], col: '#3b8cff' },
               { id: 'legendary', n: 'Legendary Chest', cost: 500, w: [0, 25, 40, 25, 10], col: '#ffc21a' }],
      DUPE: [10, 30, 80, 200, 450],
      COSM: [
        { id: 'banana', k: 'armor', r: 0, n: 'Banana Suit', d: 'Ripe, proud and very yellow.' },
        { id: 'slime', k: 'armor', r: 0, n: 'Slime Costume', d: 'Blend in. They will never know.' },
        { id: 'cardboard', k: 'armor', r: 0, n: 'Cardboard Knight', d: 'Hand-made armour. Do not get it wet.' },
        { id: 'skeleton', k: 'armor', r: 0, n: 'Bone Costume', d: 'Spooky all year round.' },
        { id: 'chicken', k: 'armor', r: 1, n: 'Chicken Suit', d: 'Bawk.' },
        { id: 'pumpkin', k: 'armor', r: 1, n: 'Pumpkin Head', d: 'A carved grin that never stops.' },
        { id: 'royal', k: 'armor', r: 1, n: 'Royal Regalia', d: 'A crown, a cape and a fur collar.' },
        { id: 'pirate', k: 'armor', r: 1, n: 'Sea Captain', d: 'A long coat and a three-cornered hat.' },
        { id: 'shadow', k: 'armor', r: 1, n: 'Shadow Garb', d: 'Black cloth and a red sash.' },
        { id: 'duck', k: 'armor', r: 2, n: 'Pool Duck', d: 'A rubber duck ring. Ready for any flood.' },
        { id: 'ronin', k: 'armor', r: 2, n: 'Crimson Ronin', d: 'Red lacquered plates and a crested helm.' },
        { id: 'astro', k: 'armor', r: 2, n: 'Star Pilot', d: 'A spacesuit with a mirrored dome helmet.' },
        { id: 'dragon', k: 'armor', r: 3, n: 'Dragonscale Plate', d: 'Horned helm, scaled plate and leathery wings.' },
        { id: 'frost', k: 'armor', r: 3, n: 'Frost Warden', d: 'Ice crystals grow from the shoulders and crown.' },
        { id: 'gilded', k: 'armor', r: 3, n: 'Gilded Champion', d: 'Gold plate from helm to boots.' },
        { id: 'voidknight', k: 'armor', r: 4, n: 'Void Knight', d: 'Black plate, curling horns and a violet glow.' },
        { id: 'pan', k: 'weapon', r: 0, n: 'Frying Pan', d: 'Breakfast and battle.' },
        { id: 'fish', k: 'weapon', r: 0, n: 'Big Fish', d: 'Slap them with it.' },
        { id: 'baguette', k: 'weapon', r: 0, n: 'Baguette', d: 'Crusty. Deadly.' },
        { id: 'plunger', k: 'weapon', r: 0, n: 'Plunger', d: 'For the toughest clogs.' },
        { id: 'rubberchicken', k: 'weapon', r: 1, n: 'Rubber Chicken', d: 'It squeaks when it hits.' },
        { id: 'lollipop', k: 'weapon', r: 1, n: 'Giant Lollipop', d: 'A swirl of sugar on a stick.' },
        { id: 'pixel', k: 'weapon', r: 1, n: 'Pixel Blade', d: 'Eight bits of sharp.' },
        { id: 'broom', k: 'weapon', r: 1, n: 'Witch Broom', d: 'Sweeps slimes off their feet.' },
        { id: 'crystal', k: 'weapon', r: 2, n: 'Crystal Greatsword', d: 'A long blade of glowing crystal.' },
        { id: 'flame', k: 'weapon', r: 2, n: 'Flamebrand', d: 'A sword that is always on fire.' },
        { id: 'katana', k: 'weapon', r: 2, n: 'Moon Katana', d: 'A thin curved blade with a silver edge.' },
        { id: 'reaper', k: 'weapon', r: 3, n: 'Void Reaper', d: 'A huge curved blade on a long pole.' },
        { id: 'dragonmaul', k: 'weapon', r: 3, n: 'Dragon Maul', d: 'A horned hammer with an ember heart.' },
        { id: 'galaxy', k: 'weapon', r: 3, n: 'Galaxy Staff', d: 'Stars circle its glowing head.' },
        { id: 'guitar', k: 'weapon', r: 4, n: 'Rock Guitar', d: 'The loudest weapon in Duskhold.' },
        { id: 'dawn', k: 'weapon', r: 4, n: 'Dawnbreaker', d: 'A giant golden greatsword with a sun at its hilt.' }
      ] },   // Update 7 (final): runes are gone; each one on an old item becomes this much dust
    // ---------- feel ----------
    HITSTOP: 0.045
  };
  // Update 7: each ability's unlock level (its dungeon's Normal step) and damage multiplier, from ABIL (see above). hits = how many times it can hit
  // one slime per cast (ticks of a spin, missiles, zone ticks, a third of a shower's strikes), so a 10-tick spin hits softer per tick than a nuke
  // (a finisher that hits harder below 30% health counts that bonus over the 30% of a fight it works for)
  const hitsOf = sp => sp.k === 'spin' ? sp.ticks : sp.k === 'missiles' ? sp.count : sp.k === 'zone' || sp.k === 'summon' ? sp.dur / sp.every * 0.8 : sp.k === 'shower' ? sp.strikes * 0.35 : sp.low ? 1 + (sp.low - 1) * 0.3 : 1;
  // Update 7 (final): damage abilities take their cooldown from their role (never shorter than what they leave behind lasts); every cast is worth
  // BASE x TIER^t to each slime it reaches (sp.tot), shared over its hits (sp.mult per hit); an ability with a longer cooldown (it leaves
  // something behind for longer) is worth more per cast in the same ratio, so per second it is never weaker than its dungeon's others
  for (const sp of C.SPELLS) { sp.lv = Math.max(1, sp.t * 3 * C.LADDER_STEP); if (sp.role !== 'util') { sp.cd = Math.max(C.ABIL.CD[sp.role], (sp.dur || 0) + 2); sp.hits = hitsOf(sp);
    sp.tot = Math.round(C.ABIL.BASE * Math.pow(C.ABIL.TIER, sp.t) * sp.cd / C.ABIL.CD[sp.role] * 1000) / 1000; sp.mult = Math.round(sp.tot / sp.hits * 10000) / 10000; } }
  root.SS_CONFIG = C;
  if (typeof module !== 'undefined') module.exports = C;
})(typeof self !== 'undefined' ? self : this);
