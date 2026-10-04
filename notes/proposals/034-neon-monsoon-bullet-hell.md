# Proposal: Neon Monsoon, a 1990s Bullet Hell Scroller

> A new cabinet game: a vertical shoot-'em-up in the style of the mid-1990s
> arcade bullet hells, where the screen fills with slow, bright, patterned
> bullets and the player threads a tiny hitbox through the gaps. It fills a
> gap in the cabinet, which has a horizontal scroller and a formation shooter
> but nothing dense, and it is the first game with thousands of things on
> screen at once: up to 2048 enemy bullets, against Galaxy Raiders' 10. That
> makes it a real game to test what 013 claims about the architecture's one
> inherent cost, re-reading presented state every frame. This proposal
> designs the game, then the models and views that keep it inside the
> project's rules at that scale, and ends with a spike to run before
> building the rest.

**Status:** implemented, 2026-10-03 (built on branch `neon-monsoon-game`,
brought onto `1738c19`), except the boss replay benchmark of
[7.2](#72-benchmarks). [Section 11](#11-as-built) records what changed from
the design and what was measured. The phase 0 spike was folded into the
build: 6.1 and 6.2 were measured against the real field and view.

**Written:** 2026-10-03, against `vnext` at `dd3ec54`, with the games' renames
in the working tree. Read for it: Galaxy Raiders' and Fuel Run's models, views,
entries and texture generators, the falling-sand demo's grain grid and its
fixed-step `DemoModel`, the boids view, the shared keyboard and touch input,
[game-entry.ts](../../site/src/games/game-entry.ts), the
[hot-paths guide](../../docs/building-with-mvt/performance/hot-paths.md) and
[013](./013-mvt-performance-ceiling.md). Every timing below is an estimate or
a target; nothing has been measured yet ([section 6](#6-performance-what-to-measure)).

**Related:**
[Adding a Game](../../site/src/games/README.md) -
[galaxy-raiders/](../../site/src/games/galaxy-raiders/) -
[fuel-run/](../../site/src/games/fuel-run/) -
[grain-grid.ts](../../site/src/demos/falling-sand/models/grain-grid/grain-grid.ts) -
[Originality](../../site/src/games/README.md#originality) (the rules this game follows) -
[013](./013-mvt-performance-ceiling.md) -
[Presenting Collections](../../docs/building-with-mvt/presenting-the-world/collections.md)

## Summary

| Decision | Recommendation | Section |
| --- | --- | --- |
| Shape of the game | Vertical scroller, portrait 240 x 320, one stage and a three-phase boss, then a harder second loop | [2](#2-the-game) |
| Title | **Neon Monsoon** (placeholder), id `neon-monsoon` | [3](#3-staying-original) |
| Controls | 8-way move, auto-fire, hold Shift (secondary) to focus, Space (primary) to bomb. No change to the shared input | [2.3](#23-controls) |
| Simulation clock | A fixed 60 Hz step inside the game model, with seeded random numbers, so a run is deterministic and replayable | [4.2](#42-a-fixed-step) |
| Enemy bullets | One model holds every bullet in typed arrays, packed, removed by swapping with the last. No record per bullet | [4.3](#43-the-bullet-field) |
| Bullet patterns | Data tables, run by a small emitter in the model. No GSAP on the bullet path | [4.4](#44-patterns-as-data) |
| Collisions | Brute force against one tiny hitbox. No spatial grid | [4.6](#46-collisions) |
| Bullet view | One `ParticleContainer`, plain TypeScript, no state per bullet | [5.2](#52-the-bullet-view) |
| Bullet bindings | Index-addressed queries (`bulletX(i)`), measured against reading the arrays directly before settling | [6.2](#62-how-the-view-reads-2000-bullets) |
| Benchmarks | A recorded-input replay of the boss's last phase in `games-and-demos` | [7.2](#72-benchmarks) |

---

## 1. Why This Game

- **A gap in the cabinet.** Fuel Run scrolls sideways and Galaxy Raiders is a
  fixed-screen formation shooter. Nothing has the genre that defined arcade
  shooters from about 1993 to 2000: dense, readable bullet patterns, a
  hitbox a few pixels wide, and scoring that rewards risk.
- **A different scale.** Every game so far keeps its entities in the tens.
  Galaxy Raiders allows 2 player bullets and 8 enemy bullets
  ([model-constants.ts](../../site/src/games/galaxy-raiders/models/model-constants.ts)).
  A bullet hell routinely shows 500 to 1000 bullets, and a cancel at the end
  of a boss phase turns them all into score gems at once. Only the demos
  (boids, falling sand) go beyond a few hundred, and they are demos.
- **A real-world test of 013.** 013 argues that the architecture's one
  inherent cost is re-reading presented state every frame. A bullet view
  re-reads every bullet's position, angle and kind every frame. This game
  puts that cost in a shipping game, at a scale where it shows up in a
  profile but should stay well inside a frame.
- **Things no game shows yet.** Typed-array storage in a game model (falling
  sand shows it, but as one of three storage variants in a demo); a fixed
  step and seeded random numbers, which make a run replayable; and bullet
  patterns written as data.

## 2. The Game

### 2.1 Premise and look

Night over a rain-soaked coastal city. The player flies a small interceptor
north, against an automated weather fleet that seeds the storm. The stage
ends at the fleet's flagship, a tower-ship called the Stormcore.

The look is mid-1990s arcade pixel art at integer scale, in a cyberpunk
night. Seen from high above, the city is a circuit board: dark grey
rooftops, streets like traces with neon running along the kerbs, buildings
like chips with glowing pins, neon signs and decals, and traffic streaking
along the avenues, all under slanting rain. The enemy craft are dark
gunmetal with thin neon trim.

The spectrum is split in two ([5.5](#55-readability)). Everything that glows
in the world is cool neon: cyan, magenta, violet, blue. Every bullet is
warm: red, orange, amber, gold, with white-hot cores, the brightest things on
the screen.

### 2.2 Screen

A portrait arena of **240 x 320 world-units**, one world-unit per pixel at
1x, like Galaxy Raiders. `integerScale: true`. The HUD is drawn over the arena
(score and chain at the top, lives and bombs at the bottom), as 1990s
portrait cabinets did, rather than in a separate bar that would shrink the
play area.

### 2.3 Controls

| Action | Keyboard | Touch | `GameInputConfig` |
| --- | --- | --- | --- |
| Move (8 directions) | Arrows or WASD | Floating joystick | `onXDirectionChanged`, `onYDirectionChanged` |
| Shoot | Always on | Always on | (none) |
| Focus (hold) | Shift | Button "Focus" | `onSecondaryButtonChanged` |
| Bomb | Space | Button "Bomb" | `onPrimaryButtonChanged` |
| Restart after game over | Enter | Restart | `onRestartButtonChanged` |

The shared keyboard view already maps Shift to the secondary button and
Space to the primary, and Shift is the genre's usual focus key, so the game
needs no change to [site/src/shared/](../../site/src/shared/). The cost is
auto-fire: there is no third button for shooting. Most later ports and touch
versions of these games auto-fire too, and it suits touch. See open question 2.

### 2.4 The ship

- **Speed:** 150 world-units per second, 60 while focused. Movement is
  8-way and digital, like an arcade stick.
- **Hitbox:** a circle of radius 2 at the cockpit, far smaller than the
  sprite. While focused, it is drawn as a white dot in a pink ring above
  everything but the HUD.
- **Graze radius:** 14. A bullet that passes within it without hitting
  scores a graze, once per bullet.
- **Shot:** unfocused, a spread of 3, 5 or 7 streams depending on power;
  focused, a narrow column of faster shots that does more damage per
  second. Power has four levels, raised by items that larger enemies drop,
  and drops by one on death.

### 2.5 Bombs

Three per life. A bomb turns every enemy bullet on screen into a score gem,
damages every enemy in the arena, and makes the ship invulnerable for 2.5
seconds. The screen flashes and shakes, both derived from the model's bomb
timer ([5.4](#54-presentation-state)).

### 2.6 Enemies

All names are this game's own ([section 3](#3-staying-original)).

| Kind | Role | Moves | Fires |
| --- | --- | --- | --- |
| `kite` | Small flyer, dies in one or two hits, comes in lines and V shapes | Data-driven paths: straight, swoop, hover then leave | Nothing, or one aimed bullet; on the second loop, a small ring on death |
| `lancer` | Fast diver | Enters high, pauses, dives at the ship | Aimed streams of 3 to 5 |
| `turret` | Rooftop gun, part of the ground | Scrolls with the city | Rotating fans |
| `barge` | Large slow carrier, drops power items | Drifts down the screen | Rings, then spirals while damaged |
| `gunship` | Mid-boss | Enters, strafes side to side | Two patterns, 30 seconds, then leaves |
| `stormcore` | Boss | Holds the top third of the screen | Three phases ([2.7](#27-the-boss)) |

### 2.7 The boss

The Stormcore has three phases. Each has its own segment of the health bar
and a time limit (about 40 seconds). When a phase's health runs out, every
bullet on screen becomes a gem and the next phase starts after a short pause;
when its time runs out, the phase ends without its bonus.

1. **Squall:** alternating rings of 24, with aimed fans of 5 between them.
2. **Cyclone:** a slowly turning double spiral, with aimed streams from two
   side cannons.
3. **Downpour:** lanes of slow, curving "rain" bullets falling with gaps that
   drift across the screen, under a fast single spiral. This is the densest
   moment in the game, around 800 bullets, and the one the benchmark replays.

### 2.8 Scoring

- **Chain.** Each kill within 1.5 seconds of the last extends a chain, and a
  kill scores its base points times the chain length (capped). A gauge in
  the HUD shows the time left. The idea is common across the genre; the
  names are ours.
- **Graze:** 10 points each.
- **Gems:** cancelled bullets become gems that fly to the ship and score 10
  each, so ending a boss phase on a full screen pays.
- **Phase bonus:** for each boss phase cleared without dying or bombing.

### 2.9 Lives, death and game over

Three lives. On death: lose a power level, cancel every bullet on screen
(without gems), respawn at the bottom with 2 seconds of invulnerability, and
refill bombs to three. Game over shows the score; Enter restarts. A high
score lasts for the session; keeping it longer is the host's business, not
the model's.

### 2.10 The stage

About two and a half minutes, at a constant scroll except while a boss is on
screen.

| Time | What happens |
| --- | --- |
| 0:00 | Ship flies in. Kites in lines; no bullets for the first 5 seconds |
| 0:10 | Kites in V shapes firing aimed shots; first rooftop turrets |
| 0:30 | Lancers; turret clusters with crossing fans |
| 0:45 | Mid-boss: the gunship |
| 1:15 | Barges with kite escorts; first power items in quantity |
| 1:50 | A quiet stretch, then a warning banner |
| 2:00 | The Stormcore, three phases |
| End | Score tally, then the second loop |

### 2.11 The second loop

Clearing the boss starts the stage again, harder: bullets 20% faster,
emitters 25% denser, and kites release a small ring when they die (often
called revenge bullets, a common late-1990s second-loop rule). The HUD shows
the loop number. Two loops is the end of v1.

## 3. Staying Original

This game follows the games' [originality rules](../../site/src/games/README.md#originality):
**ideas and mechanics are free; titles, character designs, artwork and
specific level layouts are not.**

**Free to use, and used here:** vertical scrolling, a hitbox smaller than
the sprite, a focus or slow mode, grazing, bombs that clear bullets,
cancelling bullets into score items, chain scoring, a mid-boss and a
multi-phase boss with health bars and time limits, harder second loops, and
the general look of 1990s pixel-art shooters. Each of these appears in
dozens of games from many studios.

**Not used:** the titles, ship designs, characters and boss designs of any
existing shooter, and the names of their systems; bullet patterns
transcribed from a named boss or spell card (our patterns are designed from
the parameters in [4.4](#44-patterns-as-data), not copied by eye); music and
sound effects. "Bullet hell" and "danmaku" are genre names and fine in prose.

**Art provenance.** Every sprite is a character grid in a new
`site/scripts/generate-neon-monsoon-textures.ts`, like the other games'
generators, so where the art came from is in the repo.

**Title.** "Neon Monsoon" is a placeholder. Search it as the
[originality rules](../../site/src/games/README.md#originality) describe
before adopting it.

## 4. Models

### 4.1 Module layout

```
site/src/games/neon-monsoon/
├── neon-monsoon-entry.ts
├── data/                  constants, stage-data, pattern-data, textures
├── models/
│   ├── common.ts          BulletKind, EnemyKind, PatternKind, GamePhase...
│   ├── model-constants.ts
│   ├── random.ts          seeded random numbers (see 4.2)
│   ├── bullet-field.ts    every bullet of one side, in typed arrays
│   ├── gem-field.ts       cancelled bullets flying to the ship
│   ├── emitter.ts         runs one pattern into a bullet field
│   ├── ship-model.ts
│   ├── enemy-model.ts     one pooled record per enemy, like Galaxy Raiders'
│   ├── boss-model.ts      phases, health segments, time limits
│   ├── stage-model.ts     scroll, stage time, the spawn script's cursor
│   ├── player-input.ts
│   └── game-model.ts      root: fixed step, collisions, scoring, phases
└── views/                 see section 5
```

### 4.2 A fixed step

The game model's `update(deltaMs)` adds `deltaMs` to an accumulator and runs
whole steps of `STEP_MS = 1000 / 60`, keeping the remainder for next time.
Each step calls every child's `update(STEP_MS)`, so the children are ordinary
models that happen always to be given the same `deltaMs`. This is the
falling-sand `DemoModel`'s approach, applied to a whole game.

Why a fixed step:

- **Pattern spacing.** A ring of 24 fired every 300 ms, or a spiral turning
  7 degrees per shot, has spacing that depends on exactly when each bullet
  is fired and how far it has moved since. With a variable step, a pattern
  comes out slightly differently at 60 Hz, 144 Hz and on a stuttering phone,
  and gaps the player relies on change width.
- **Determinism.** With a fixed step and seeded random numbers, the same
  inputs give the same run, bit for bit. That gives model tests that assert
  on a whole minute of play, a replay for the benchmark
  ([7.2](#72-benchmarks)), and a cheap path to an attract mode later.

**At most four steps per update.** After a long frame (a tab switch, a
garbage collection), the model runs four steps and drops the rest of the
accumulator, so the game slows down instead of jumping. This is also how
1990s boards behaved under load, and players of the genre expect it.

**Random numbers.** A seeded generator in `models/random.ts`, a copy of the
falling sand demo's `createRandom` (open question 4). Nothing in the models
calls `Math.random`.

**No interpolation in v1.** A view shows the latest step's state. On a
120 Hz display, each step is shown for two frames, as on the original
hardware. Interpolating would need every bullet's previous position in the
model and a step fraction in the bindings; see open question 3.

### 4.3 The bullet field

One `BulletField` holds every bullet of one side. The enemies' has a
capacity of 2048; the player's shots use a second field of 128.

```ts
export interface BulletField {
    /** Live bullets, at indices 0 to count - 1. */
    readonly count: number;
    readonly capacity: number;
    /** Position in world-units. Only meaningful for an index below `count`. */
    xOf: (index: number) => number;
    yOf: (index: number) => number;
    /** Direction of travel in radians, for bullets drawn pointing along it. */
    angleOf: (index: number) => number;
    kindOf: (index: number) => BulletKind;
    /** Milliseconds since it was fired, for the spawn flash. */
    ageOf: (index: number) => number;
    /** Positional rather than an options object: fired thousands of times a second. Returns false when full. */
    fire: (x: number, y: number, speed: number, angle: number, kind: BulletKind, accel: number, turnRate: number) => boolean;
    /** Remove the bullet at `index`; the last bullet moves into its place. */
    remove: (index: number) => void;
    /** Remove every bullet, calling `each` with each one's position first (for gems). */
    clear: (each?: (x: number, y: number) => void) => void;
    update: (deltaMs: number) => void;
}
```

**Storage.** One typed array per field: `Float64Array`s for x, y, speed,
angle, acceleration, turn rate, velocity and age; `Uint8Array`s for kind and
a grazed flag. Velocity is cached from speed and angle, and recomputed only
for bullets that turn or accelerate, so a straight bullet costs two adds per
step.

**Packed, removed by swapping.** Live bullets occupy indices `0` to
`count - 1`. Removing one moves the last into its place, and the update loop
runs backwards so a swap never skips a bullet. Loops run over `count`, not
`capacity`, and nothing is allocated after construction. The price is that a
bullet's index can change from one frame to the next, so **no view may keep
state per bullet index** ([5.2](#52-the-bullet-view)). Everything a view
shows about a bullet comes from the field: its age gives the spawn flash,
its kind the texture, its angle the rotation. This mirrors falling sand's
`'arrays'` grid, except that a grain keeps its id for life and a bullet does
not.

**Why not one record per bullet**, as Galaxy Raiders does: 2048 closure
records with getters, scanned in full every step whether active or not, is
the layout the hot-paths guide warns against at this scale. Falling sand's
`'objects'` and `'arrays'` storage measure the difference in a demo; this
game should not need to rediscover it. Settled; do not reopen without new
information.

**Off-screen bullets** are removed once outside the arena by a margin of 16.
**A full field drops new bullets**, which a test pins down, so an
over-dense pattern thins rather than throws.

`GemField` has the same layout, plus a homing step toward the ship and a
`collected` count the game model reads for scoring.

### 4.4 Patterns as data

A pattern is a plain record in `data/pattern-data.ts`; its `kind` selects the
shape:

```ts
type PatternDef =
    | { kind: 'ring'; count: number; spinPerShot: number; ...Common }
    | { kind: 'fan'; count: number; spreadDeg: number; isAimed: boolean; ...Common }
    | { kind: 'spiral'; arms: number; degPerShot: number; ...Common }
    | { kind: 'stream'; burst: number; burstGapMs: number; isAimed: boolean; ...Common }
    | { kind: 'rain'; lanes: number; gapLanes: number; driftPerShot: number; ...Common };

// Common: bulletKind, speed, accel, turnRate, intervalMs, durationMs, offsetX, offsetY
```

(Sketch: `...Common` stands for the shared fields.) An `Emitter` runs one
pattern: a timer, an angle that turns for spirals and rings, and a reference
to the field it fires into. An enemy owns zero or more emitters, positioned
relative to itself; a boss phase is a list of emitters running together.
"Aimed" reads the ship's position at the moment of firing.

Patterns stay data so they can be tuned without touching code, and so a
test can say "a ring of 24 fires 24 bullets 15 degrees apart" against the
same tables the game uses.

**No GSAP on the bullet path.** The other games drive phase delays with
paused GSAP timelines advanced by `deltaMs`, which is fine for them. An
emitter fires on step counts and must match step for step across runs; a
counter is simpler and cheaper than a timeline per emitter. Game-phase
pauses (death, the warning banner, the tally) use counters too, so the whole
model is one clock.

### 4.5 The stage script and scrolling

`data/stage-data.ts` is a list of events sorted by stage time: spawn an
enemy (kind, entry x, path, emitters, item drop), show the warning, start the
mid-boss or the boss. `StageModel` keeps a cursor and fires every event whose
time has passed. Enemy paths are data too (`'straight'`, `'swoop-left'`,
`'hover-then-leave'`, `'dive'`), evaluated from the enemy's age.

`StageModel` also owns `scrollY`, the distance flown in world-units, which
stops while a boss is on screen. Rooftop turrets are placed in city
coordinates and move down the arena with the scroll. The background views
draw from `scrollY` alone ([5.3](#53-the-other-views)).

### 4.6 Collisions

Per step:

- **Enemy bullets against the ship:** one squared-distance test per bullet
  against the hitbox, and a second against the graze radius. Under 5,000
  comparisons at a full field; a few microseconds (estimated).
- **Player shots against enemies:** at most 128 x 40.
- **Gems:** collected within a radius of the ship.

There is one player, and the hitbox is tiny, so a spatial grid would cost
more to maintain than it saves. Settled; reopen only if a profile shows
collisions above 10% of the step.

### 4.7 Phases

`GamePhase = 'playing' | 'warning' | 'dying' | 'tally' | 'game-over'`. The
boss's own phases (`'squall' | 'cyclone' | 'downpour'` plus their
transitions) live in `BossModel`, which the game model asks for its health,
time left and phase.

## 5. Views

### 5.1 Layers

From back to front: city background, rain, rooftop turrets, gems, player
shots, air enemies, the ship, explosions, **enemy bullets**, the hitbox
marker, the HUD. Enemy bullets sit above every enemy so none is ever hidden
behind one.

### 5.2 The bullet view

`BulletView`, in plain TypeScript, since its whole job is managing display
objects each frame.

- One Pixi `ParticleContainer` with dynamic position and rotation, and a
  pool of `Particle`s allocated at construction, one per slot of capacity.
- Each refresh makes the number of particles shown equal to `count`, then
  for each live index sets position, rotation (needle kinds only), texture
  from the kind, and a scale from the age for the spawn flash. The texture is
  set every frame because a swap can put a different kind at an index.
- The view keeps **nothing** per bullet. Its pool is display objects, not
  state; which particle shows which bullet changes freely.
- Textures are pre-coloured per kind, rather than tinted, so tint need not
  be a dynamic property.

Two things to settle in the spike ([6.1](#61-the-bullet-view-particlecontainer-or-a-sprite-pool)):
the cheapest way in Pixi 8.21 to show a varying number of particles without
allocating, and whether `ParticleContainer` beats a pool of `Sprite`s in a
plain `Container` (the boids view's approach) at this count.

### 5.3 The other views

- **Enemies, ship, items, HUD:** JSX, as most of Galaxy Raiders and Fuel Run
  are; enemies through a `<List>` over the pooled enemy records.
- **Player shots and gems:** the bullet view again, with their own fields
  and textures.
- **City background:** plain TypeScript, a ring buffer of chunks of ground
  positioned from `scrollY`, like Fuel Run's terrain view, each drawn once
  in two layers: the dark ground, and its neon with additive blending.
- **Traffic:** light streaks on the avenues, a function of stage time and
  `scrollY`, like the rain.
- **Rain:** streaks whose positions are a function of the model's stage time,
  so the view keeps no state at all and the rain is the same on every replay.
- **Boss health bar and chain gauge:** JSX, from the model.

### 5.4 Presentation state

Only cosmetic, and only where the model does not already track it:

- **Enemy hit flash:** a short white flash when an enemy's health drops,
  timed by the enemy view's `update` and triggered by `watch` on the health
  binding.
- **Boss health bar easing:** the bar slides down to the true value, a
  smoothed counter like the docs' example.

Bomb flash and screen shake need no presentation state: the model's bomb
timer is in the bindings, and the view derives both from it.

### 5.5 Readability

The genre lives or dies on whether the player can see the bullets. Rules for
the art and the views:

- Enemy bullets are the brightest things on screen, with white cores and
  saturated rims, and only ever warm colours. The world's neon is only ever
  cool, and stays thin: lines, decals and signs on dark ground.
- Player shots are drawn at half opacity so they never hide enemy bullets.
- No enemy bullet colour is reused for scenery, craft, items or
  explosions. Explosions are electric (violet, cyan, white), not fiery.
- New bullets flash larger for their first 100 ms, so a pattern announces
  itself.
- The hitbox marker is drawn above everything but the HUD while focusing.

### 5.6 Textures

A character-grid generator, `site/scripts/generate-neon-monsoon-textures.ts`,
loaded through `createTextureRegistry` as the other games do. Bullet
shapes: pellets (8 x 8), orbs (14 x 14), needles (12 x 5, drawn along their
angle) and rain (12 x 3), in red, orange, amber and gold.
Plus the ship (16 x 24), each enemy, items, gems, explosion frames and the
lives and bombs icons.

## 6. Performance: What to Measure

**Targets** (not measurements): a full field of 2048 enemy bullets plus 1000
gems at 60 fps on a mid-range phone; a model step under 1 ms on a desktop at
2000 bullets; no allocation per step or per frame in the bullet, gem and
emitter paths.

### 6.1 The bullet view: `ParticleContainer` or a sprite pool

*Measured on the CPU side only, and `ParticleContainer` kept: see
[11.3](#113-measurements).*

Measure refresh and render time at 500, 1000, 2000 and 4000 bullets, for:

- a `ParticleContainer` with a pool of `Particle`s;
- a plain `Container` with a pool of `Sprite`s.

Take whichever is cheaper. If `ParticleContainer` is awkward about a varying
count, the sprite pool is the fallback, and it is the boids view's pattern.

### 6.2 How the view reads 2000 bullets

*Settled: query bindings, wired straight to the field's methods. See
[11.3](#113-measurements).*

This is 013's inherent cost in a game. Compare:

| | Binding | Per bullet per frame |
| --- | --- | --- |
| A | Index-addressed queries: `bulletX: (i) => number`, `bulletY`, `bulletAngle`, `bulletKind`, `bulletAge`, wired by the game view to the field's `xOf` and the rest | 5 binding calls, each calling a model method |
| B | The field itself as a fixed binding (`bullets: BulletField`, read once), and the view calls `xOf(i)` directly | 5 method calls |
| C | The field exposes its arrays read-only, and the view indexes them | 5 array reads |

A follows the style guide (query bindings named for what they return, like
`tileKindAt(row, col)`). C is fastest on paper but hands the view the
model's storage. **Recommend A unless it costs more than about 0.3 ms per
frame over C at 2000 bullets**; then B, which keeps the storage private.
Record the numbers in this section whichever way it goes.

## 7. Tests and Benchmarks

### 7.1 Model tests

- **Bullet field:** fire and count; removal by swap keeps every other
  bullet; a full field drops new bullets; off-screen removal; turning
  bullets follow their turn rate.
- **Emitters:** a ring of 24 fires 24 bullets 15 degrees apart; a spiral
  advances its angle per shot; an aimed fan's middle bullet points at the
  ship.
- **Collisions:** a hit inside the hitbox; a graze scored once per bullet,
  not once per step.
- **Fixed step:** `update(50)` runs three steps and carries none; two
  `update(10)` calls run one step; a 1-second update runs four and drops the
  rest.
- **Determinism:** two games with the same seed and the same recorded inputs
  have the same score, bullet count and ship position after 60 seconds.
- **Stage and boss:** the script reaches the boss; a boss phase ends on
  health and on time; ending on health turns bullets into gems.

### 7.2 Benchmarks

Add `neon-monsoon` to `benchmarks/suites/games-and-demos.ts`, driven by a
recorded-input replay that reaches the boss's Downpour phase (seeded, so the
same every run), timing the densest stretch. If 6.1 and 6.2 come out close,
add a bullet-count sweep in the style of `falling-sand-scaling` using a
benchmark-only pattern. Keep to the existing benchmark practice: A/B
comparisons interleaved from worktrees, never on a busy machine.

## 8. Ruled Out

Do not reopen without new information.

- **Horizontal scrolling.** Fuel Run already scrolls sideways, and the
  1990s bullet hells were overwhelmingly portrait.
- **A variable step.** Patterns would differ by frame rate, and runs would
  not replay ([4.2](#42-a-fixed-step)).
- **One model record per bullet** ([4.3](#43-the-bullet-field)).
- **A spatial grid for collisions** ([4.6](#46-collisions)).
- **A custom mesh or shader for bullets.** That is 013's flat-array mesh
  experiment, a separate question. Start with what Pixi provides.

## 9. Open Questions

1. **Title.** "Neon Monsoon" is a placeholder; search it before adopting it
   ([3](#3-staying-original)).
2. **Auto-fire, or a fire button?** Recommended auto-fire ([2.3](#23-controls)).
   A held fire button needs a third button in `GameInputConfig`, a key for it
   in the keyboard view and a third touch button: a shared change touching
   every game's input.
3. **Interpolate for displays above 60 Hz?** Recommended not in v1
   ([4.2](#42-a-fixed-step)). Revisit if the motion looks rough on a
   120 Hz screen.
4. **Copy `createRandom`, or share it?** Recommended copy: it is about 20
   lines, and the games are otherwise self-contained. Share it if a third
   user appears.
5. **Touch movement.** Most touch shooters move the ship by the finger's
   drag, not a joystick. Start with the existing floating joystick; a
   relative-drag mode would be a new option in the shared touch input.
6. **Scope of v1.** One stage and two loops, recommended. A second stage is
   mostly data and art once the first works.
7. **Write up the bullet field in the docs?** If 6.2 settles cleanly, the
   field and its bindings make a good example for
   [Presenting Collections](../../docs/building-with-mvt/presenting-the-world/collections.md)
   or the hot-paths guide. Decide once the numbers are in.

## 10. Implementation Steps

Run `npm run lint`, `npm test` and `npm run build` after each step.

**Phase 0: spike** (decides 6.1 and 6.2 before the rest is built).

1. ~~`BulletField`, `Emitter` and a bullet view, with one stationary emitter
   that can fill the field, in a throwaway entry.~~ Done, folded into the
   build rather than a throwaway entry.
2. ~~Measure [6.1](#61-the-bullet-view-particlecontainer-or-a-sprite-pool) and
   [6.2](#62-how-the-view-reads-2000-bullets); record the numbers here and
   pick.~~ Done ([11.3](#113-measurements)).

**Phase 1: the core loop.**

3. ~~Module skeleton, entry with `inputConfig`, registration in
   [games/index.ts](../../site/src/games/index.ts) and
   [main.ts](../../site/src/main.ts).~~ Done.
4. ~~Fixed step, seeded random numbers, ship with focus and shots, collisions
   with hitbox and graze, lives, game over, a minimal HUD. Placeholder
   graphics.~~ Done.

**Phase 2: the stage.**

5. ~~Stage script and `StageModel`, scrolling city background, rain.~~ Done.
6. ~~Kites, lancers, turrets and barges with their paths and emitters; power
   items.~~ Done.

**Phase 3: scoring and bombs.**

7. ~~Bombs, cancelling into gems, `GemField`, chain and graze scoring, the
   chain gauge.~~ Done.

**Phase 4: bosses.**

8. ~~The gunship, then the Stormcore's three phases, health segments, time
   limits, phase bonus, warning banner and tally.~~ Done.

**Phase 5: art and feel.**

9. ~~The texture generator and palette; explosions; the readability rules in
   [5.5](#55-readability); enemy hit flash and health bar easing.~~ Done.

**Phase 6: finishing.**

10. ~~The second loop, `instructions` text, `thumbnailAdvanceMs` (enough to
    show the first kites and bullets, about 8 seconds).~~ Done (9 seconds).
11. ~~The model tests in [7.1](#71-model-tests).~~ Done, plus a view test
    for the bullet layer.
12. The benchmark in [7.2](#72-benchmarks). In part: the game is in
    `games-and-demos` under the suite's shared input script. The boss
    replay is not done ([11.4](#114-still-open)).
13. ~~The README games table and the site landing page, worded as the
    originality rules ask ("inspired by 1990s arcade shooters", no other
    game's title).~~ README done; the landing page names no games, so it
    needed nothing.
14. Move this proposal to `notes/archive/`.

## 11. As Built

### 11.1 Where it is

[site/src/games/neon-monsoon/](../../site/src/games/neon-monsoon/), with its
texture generator in
[site/scripts/generate-neon-monsoon-textures.ts](../../site/scripts/generate-neon-monsoon-textures.ts).
Everything in sections 2 to 5 was built as designed, apart from the changes
below.

### 11.2 Changes from the design

- **No `'spiral'` pattern kind.** A spiral is a ring of two to four bullets
  fired often while it spins, so `'ring'` with `spinPerVolleyDeg` covers
  both. The kinds are `'ring'`, `'fan'`, `'stream'` and `'rain'`.
- **`BulletField` does its own collision loops**: `findTouching(x, y, radius)`
  and `markGrazed(x, y, radius)`, so the typed-array loops stay inside the model
  that owns the arrays. Kinds and their hit radii are one option,
  `hitRadii: Record<K, number>`, and the field is generic over its kinds.
- **Ground and air enemies are two slot lists** (`groundEnemies`,
  `airEnemies`) rather than one with a flag: turrets are drawn under
  everything flying and cannot ram the ship, and two lists say both at once.
- **The hit flash is not presentation state.** Section 5.4 planned a timer
  in the enemy view. Item views inside a `<List>` show one enemy after
  another as slots are reused, so state kept per view can carry over from
  the last occupant; and `<List>` did not then skip an empty slot's update
  step (since fixed, [11.4](#114-still-open)). The enemy and boss models record `msSinceHit`
  instead, and `HitFlashView` is a pure function of it. The boss health
  bar's slide stays as presentation state, outside any list.
- **Phases.** `GamePhase` is `'playing' | 'dying' | 'tally' | 'game-over' |
  'all-clear'`. The warning is a timer, not a phase: play goes on under it.
  The boss's lifecycle is `BossPhase`, and its three attacks are
  `attackKind`, so "phase" means one thing.
- **Scoring is its own model**, `ScoreModel` (score, high score, chain,
  grazes, extend scores), owned by the game model, which polls its
  `extendsEarned` to give lives. Section 4.1's layout did not have it.
- **Lives count the ship flying.** `lives` starts at 3, and the game ends at 0.
- **The look, after a playtest (2026-10-04).** The first build's city was
  plain dark blocks, and its bullets pink, amber, cyan and violet: nothing
  said "neon". The city became the circuit board of 2.1, with traffic, the
  craft gained neon trim, and the spectrum was split: bullets warm, neon
  cool, so the neon can shine without confusing the bullets. The bullet
  kinds were renamed for their new colours.
- **Every game-phase timer is a counter**, as 4.4 recommended; no GSAP
  anywhere in the game.

### 11.3 Measurements

CPU side only, in Node through Vitest, on the development machine: the
median of five runs of 1500 frames each, after 200 warm-up frames, run once
on 2026-10-03. Not interleaved from worktrees, so treat the ratios as a
guide. Microseconds per frame. Nothing is rendered, so GPU upload and draw
are not included.

| Bullets | Model step | A: wrapped queries | B: field methods as bindings | C: raw arrays | Sprite pool |
| --- | --- | --- | --- | --- | --- |
| 500 | 8.7 | 25.2 | 14.4 | 2.5 | 15.6 |
| 1000 | 17.6 | 49.8 | 28.8 | 4.3 | 31.7 |
| 2000 | 42.7 | 120.4 | 70.4 | 10.9 | 82.7 |
| 4000 | 86.7 | 225.2 | 144.1 | 23.4 | 159.8 |

- **Model step**: the field's `update`, `markGrazed` and `findTouching` for one step.
  43 µs at 2000 bullets, against the 1 ms target.
- **A** wraps each read in a closure (`xAt={(i) => field.xOf(i)}`). **B**
  passes the field's own methods as the query bindings
  (`xAt={field.xOf}`), which is what the game does: the same bindings and
  the same view, with one call per read instead of two. **C** is the same
  loop reading raw typed arrays. (This differs from 6.2's table, whose B
  was the field as one fixed binding; that was not needed.)
- **Decision (6.2): B.** It costs about 60 µs a frame more than C at 2000
  bullets, far under the 0.3 ms threshold, and it keeps the field's storage
  private and the view reusable. Much of the gap is the call per read and
  the string-keyed texture lookup; neither is worth removing at this scale.
- **Decision (6.1): `ParticleContainer`.** On the CPU it is 15% cheaper
  than a sprite pool doing the same reads. The GPU side, where a particle
  container should gain most, was not measured: it needs a browser, and
  headless Chrome launches are rationed on this machine.

The game's own row in `games-and-demos` (one run, not saved): 10 µs a frame
in all, and 1.8 KB allocated a frame. That uses the suite's shared input
script, which loses its last life at 55 s with at most 47 bullets on screen,
so it measures the early stage and a game over, not the dense attacks.

### 11.4 Still open

- **A boss replay for the benchmark** ([7.2](#72-benchmarks)). Reaching the
  Downpour attack needs input that survives two minutes: either a recorded
  run, or an autopilot that writes `PlayerInput` as a player does (an
  attract mode, which would also make a good MVT example). Neither exists
  yet.
- ~~**`<List>` and update steps**, in `@mvtjs/utils`. `<List>` hid an empty
  slot and skipped its subtree in `refreshView`, but not in `updateView`, so
  an item view's update step still ran for an empty slot and read an absent
  item. Found when a first draft of the hit flash crashed in the
  benchmark.~~ Fixed (2026-10-04): an emptied slot whose item view has an
  update step is given an update gate as it empties, kept at the list's
  level. Measured level with the old `<List>` on the falling-sand sprites
  view at 20,000 grains, interleaved; a first version that kept the gate's
  state in each slot's closure was about 10% slower there. An update step still
  sees last frame's item in the frame after the model removes it: a
  follow-up in [017](../tasks/backlog/017-misc-loose-ends.md) (Fix).
- **Final title**, touch movement and interpolation: open questions 1, 3
  and 5, unchanged.
- **Balance.** The patterns were tuned from the numbers, not by playing the
  whole stage, so the boss attacks' densities may want a pass in the
  browser.
