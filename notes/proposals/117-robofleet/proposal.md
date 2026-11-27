# Proposal: Robofleet, an action game on a ship of rogue robots (working title)

> Our first "real" arcade game: a level up in scope from the entries so far.
> A ship's robot crew has gone rogue, and you are a small control core sent
> to clear them, deck by deck. You can't do it in your own shell. You take
> over robots and wear them, fight with what they carry, and slip past what
> you can't yet beat. Every encounter is a choice: fight, take over, or
> hide. The look and sound are the 1980s seen through a CRT: blocky, dark
> and rumbling. It's inspired by Paradroid, and differs from it in its
> takeover minigames, stealth in dynamic darkness, enemy AI, weapons, and
> later a salvage and build system. We build it in steps, with placeholder
> art and sound first, to find the fun in the models before polishing the
> look. Each step also tries out a piece of 109 (the game maker) and feeds
> 110 (the docs for makers). This proposal plans the first playable, one
> deck, and parks every other idea in [ideas.md](./ideas.md) to be brought
> back and weighed as the game grows.

**Status:** proposed. Nothing built. The four decisions in section 1.3 were
made on 2026-11-27. The rest is a draft for discussion.

**Written:** 2026-11-27, on `vnext` at `bbdc48cc`, against the arcade site,
`site-kit` (the entry host, arcade controls, seeded random), `audio90`, and
proposals 109 and 110 as they stand.

**Related:**
[ideas.md](./ideas.md) (everything not in the first playable),
[Adding an Entry](../../../packages/sites/arcade/src/entries/README.md) (and
its [originality rules](../../../packages/sites/arcade/src/entries/README.md#originality)),
[Fenceline](../../../packages/sites/arcade/src/entries/fenceline/) (the
biggest game so far, about 5,500 lines),
[109](../109-indie-game-maker.md) (gamefab: specs, scenarios, replays,
playtest notes pinned to a tick, tunables, cartridges),
[110](../110-docs-for-makers-and-their-agents.md) (the docs pages this game
should help write),
[073](../../tasks/backlog/073-models-take-their-random-source.md) (models
take their random source),
[080](../080-audio80-voices-in-the-audio90.md) (one chip kind, which bears
on the chip choice),
[103](../103-timelines-animations-and-players.md) (timelines, for the
presentation passes),
[107](../../archive/107-complete-pixi-3d-jsx.md) (PixiJS 3D, one
candidate for the 2.5D look).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | **You are a core that possesses robots.** A takeover moves you into a robot's body, whose modules become yours. Lose the body and you're ejected as the bare core, fragile but quiet. *Decided* | 1.3, 3.1 |
| 2 | **Every encounter is a three-way choice**, and the three feed each other: an unaware robot is easier to take over, fighting is loud, and hiding sets up both | 3.2 |
| 3 | **The first playable is one deck**: about 8 rooms, about 10 robots of 4 classes, fight, take over (one minigame) and sneak (sight, noise, one dark room), energy and a recharge pad. No lifts yet. *Decided* | 1.3, 4 |
| 4 | **Arcade controls**: the host's d-pad, fire and action, from keys or touch. Aim is kept separate from facing in the model, so free aim can come later. *Decided* | 1.3, 5.2 |
| 5 | **An arcade entry, shown in dev builds only**, at `packages/sites/arcade/src/entries/robofleet/`, until it's ready to list. *Decided* | 1.3, 11 |
| 6 | Models are renderer-neutral, in tile units. The 2.5D look is a later spike (Pixi 2D layers, or PixiJS 3D drawn at low resolution) and doesn't hold up the first playable | 5, 6, 8 |
| 7 | Light levels, line of sight and what the player perceives live in the model, because they decide detection. How the darkness is drawn is the view's | 5.4 |
| 8 | First takeover minigame: **Signal Lock**, a short tracking game on an oscilloscope trace, harder for higher tiers and easier from behind | 5.6 |
| 9 | Placeholders first: flat tiles, blocky robots with their designation, cones and a darkness grid; Audio80 placeholder sounds and a rumble | 6 |
| 10 | Build alongside 109 and 110: a numbered spec, seeded random, recorded input and exact replays, a few headless scenarios, then playtest notes pinned to a tick and a tunables panel. Keep a running list of what 110's pages need, and of what a genre cartridge could lift | 7 |
| 11 | Milestones after the first playable: the ship (decks and lifts), the look and sound, the build system. Each picks from [ideas.md](./ideas.md) when it starts | 8 |
| 12 | **Originality needs more care than usual**, because we borrow much of one classic's structure. A similarities list says how each borrowed mechanic is expressed as our own, reviewed at each milestone and before listing. Robots get a silhouette for each class, never a number on top. The title is checked in full before listing | 9 |

---

## 1. What it is

### 1.1 The pitch

A deep-space ship drifts with its robot crew in charge, and they've stopped
taking orders. You're a control core, a small device that can link into a
robot and drive it. Clear the ship, deck by deck. Your own shell is weak,
so you take over robots and use their bodies: their chassis, weapons and
sensors become yours until the body is wrecked. Bigger robots are harder to
take, so you climb: a cleaning drone first, then a sentry, then something
you'd have run from an hour ago.

The decks are dark, and the ship rumbles. Robots patrol, hear you, come
looking, and search where they lost you. Some decks are beyond you when you
first reach them, and you have to sneak through.

### 1.2 Inspired by, and different from

Credit in the entry: `inspiredBy: { title: 'Paradroid', maker: 'Hewson', year: 1985 }`.

**What we keep, as mechanics:** a ship setting seen from above; lifts
between decks and a side view of the ship; an autonomous robot crew gone
rogue, to be cleared; robots of classes and tiers, each with a designation;
take over or fight; energy and recharge pads; a deep rumble for the ship
(as much the film *Alien* as the classic).

**What's new:** takeover minigames (several, not one); a 2.5D,
pseudo-pixel-art look; stealth, with detection and hiding; decks you must
sneak through to advance; darkness and dynamic lighting, to make it
frightening; real enemy AI; weapons as modules; modular robots, salvage and
building, alongside takeovers; bosses. Prestige, and production and
resources, are ideas to weigh later.

Nothing is copied: not the classic's designations, robot designs, deck
layouts, takeover game, sounds or music (section 9).

### 1.3 Decided on 2026-11-27

- **The player** is a core that possesses robots (rather than a fixed
  player robot, or a core with a squad of captured allies, which stays in
  [ideas.md](./ideas.md#robots)).
- **The first playable** is one deck with all three choices (rather than
  two decks and a lift without stealth, or fight and takeover alone).
- **Controls** are the arcade controls (rather than twin-stick or mouse
  aim).
- **Its home** is an arcade entry, unlisted while it's built (rather than
  a package of its own, or a standalone project for 109).

## 2. Pillars

What makes it this game. A feature that serves none of them waits.

1. **You become the enemy.** Your power is borrowed. Every body is a
   different way to play, and losing one is a setback, not a death.
2. **Every encounter is a choice.** Fight, take over or hide, and the
   right answer depends on the body you're in, what they know, and what's
   around you.
3. **The ship is hostile and alive.** Dark rooms, a rumble you feel,
   robots that hear, search and call for help. Tension first, then action.
4. **Small, readable, retro.** Blocky shapes, a few colours, clear
   silhouettes, one screen of deck at a time, a CRT glow. You can always
   tell what a robot is and what it knows.

## 3. How it plays

### 3.1 The core and its bodies

- **The bare core** is small, quick and quiet, and hard to see in the
  dark. It has no weapon and can take only a few hits. It can take over
  robots, but higher tiers are hard to take from a bare core.
- **A body** is a robot you've taken over. Its modules decide what you can
  do: its chassis (integrity, speed, how loud it is), its weapon, and its
  sensors (how far and how wide you see). While you're in a body, damage
  hits the body's integrity, not you.
- **Losing a body** ejects you as the bare core, beside the wreck. That's
  the arcade's second chance: lose the core, and the game is over.
- **Taking over from a body** is easier than from the bare core, and
  easier the closer the target's tier is to the body you're in. Your old
  body powers down and is left as a wreck (salvage comes later).

### 3.2 Encounters: fight, take over or hide

| Choice | Good for | Costs |
| --- | --- | --- |
| **Fight** | Robots you outgun; quick | Noise, which brings others; damage to your body; the robot is destroyed, not gained |
| **Take over** | Gaining a better body; removing a robot quietly | You must touch it; energy for each attempt; a failure alerts it and costs more energy |
| **Hide** | Robots you can't beat yet; setting up a takeover | Time; staying in the dark, behind cover, out of cones |

They feed each other, which is the point:

- **An unaware robot is easier to take over** (the minigame is shorter and
  more forgiving), so sneaking up behind one pays.
- **Fighting is loud.** Shots carry, so a fight in one room draws the
  next room's patrol.
- **Bodies differ in stealth.** The bare core hides best. A heavy hauler
  is loud and easily seen, but it can fight its way out.

### 3.3 Energy

The core has one energy store. It drains slowly over time, faster while
you're in a body, and each takeover attempt costs a chunk (a failed one
costs more). Standing on a recharge pad refills it, slowly, and pads are
lit, so recharging is a risk. At zero energy, the core shuts down and the
game ends. The numbers are placeholders, in `data/`, to be tuned in
playtests (section 4.3).

### 3.4 A deck, and winning it

A deck is a grid of rooms joined by corridors and doors. Doors slide open
for any robot near them, and closed doors block sight. Rooms are lit or
dark. The deck is cleared when every robot on it is destroyed or taken
over. Score comes from each robot cleared, by tier, with a bonus for
takeovers and for clearing without being seen. In the first playable,
clearing the deck ends the game with a win.

## 4. The first playable: one deck

### 4.1 In scope

The requirements are numbered, as 109's spec is (109 section 4.1), so
steps, tests and playtest notes can point at them. Step M0.3 moves this
list into the entry's own `spec.md`, which then becomes the source.

- **R1** One deck, designed by hand from a blank grid, about 40 by 30
  tiles, about 8 rooms, kept as data. The view scrolls to follow you.
- **R2** Doors open for any robot within a tile, close after it leaves,
  and block sight while closed.
- **R3** You move in 8 directions with the d-pad, sliding along walls.
  Fire shoots in the direction you face. While fire is held, you strafe:
  you keep facing where you were.
- **R4** Four robot classes (section 5.5), each with its own chassis,
  weapon and sensors, and a designation drawn on it.
- **R5** Robots patrol set routes, investigate noises, attack what they
  see, search where they lost you, and give up and go back.
- **R6** A robot sees along its facing, within a cone and a range set by
  its sensors, blocked by walls and closed doors. In the dark, its range
  for spotting you is shorter.
- **R7** Being seen fills that robot's suspicion over a short time, and it
  attacks when suspicion is full. Out of sight, suspicion drains.
- **R8** Shots and heavy chassis make noise, which robots within its range
  hear and investigate.
- **R9** At least one dark room, where you see only a short way around you
  and robots are drawn only while you can perceive them.
- **R10** The action button, touching a robot, starts a takeover: the
  Signal Lock minigame (section 5.6). The game around it pauses.
- **R11** Signal Lock's difficulty rises with the target's tier above your
  current body's, and falls if the target is unaware.
- **R12** Win the takeover and you're in the new body, and your old one is
  left as a wreck. Lose it and you lose energy, are pushed back, and the
  target is alerted.
- **R13** Losing a body's integrity ejects you as the bare core.
- **R14** Energy drains over time, faster in a body, and costs per
  takeover attempt. One recharge pad refills it.
- **R15** The core's energy, or its integrity while bare, at zero ends the
  game. Clearing every robot wins it.
- **R16** A HUD: energy, the body's integrity and designation, robots
  left, score.
- **R17** Placeholder sound for shots, hits, explosions, alerts, takeover
  start, win and fail, the recharge pad, and a low ship rumble (section 6.2).
- **R18** Restart starts a new run on the same deck.

### 4.2 Out of scope for now

Lifts, other decks and the ship's side view; a deck alarm shared by every
robot; more than one minigame; salvage, parts and building; bosses; saving
a run; highscores; the 2.5D look, lighting effects and the CRT filter. All
are in [ideas.md](./ideas.md), most marked for a milestone in section 8.

### 4.3 What the first playable must tell us

The first playable is a question, not a product. Playtest it with these in
mind, and write down the answers in the progress log:

- Is the choice between fight, take over and hide a real choice, or is one
  answer always best?
- Does climbing from bare core to better bodies feel like progress, and
  does losing a body sting without being unfair?
- Does sneaking work with the arcade controls, and can you always read
  what a robot knows (unaware, suspicious, hunting, searching)?
- Is Signal Lock fun the tenth time, and is it short enough not to break
  the flow?
- Does the dark room frighten you, even with placeholder art?
- Does energy push you along without nagging you?
- How long does a deck take, and how long should it?

**Done when** the deck plays from start to a win or a loss, R1 to R18
hold, the models' tests and the scenarios in section 7 pass, and two
playtests have answered the questions above, with the answers deciding
what M2 changes.

## 5. Models

### 5.1 Layout

A bigger game than the others, so `models/` gets a subfolder for each
domain, each with its own barrel (the barrel rule still holds, and each
folder imports its siblings through their `index.ts`):

```
robofleet/
├── spec.md                The numbered requirements (section 4.1), the source of truth
├── start/                 entry.ts, details.ts, load.ts, thumbnail.webp, share.png
├── data/                  Tunables (speeds, ranges, energy costs), robot classes, the deck map
├── models/
│   ├── game-model.ts      GameModel: phases, the run, score; owns everything below
│   ├── deck/              The tile grid, rooms, doors, light levels, pads, wrecks
│   ├── robots/            RobotModel and its modules; the classes
│   ├── perception/        Line of sight, cones, noise, suspicion
│   ├── ai/                Each robot's brain: patrol, investigate, attack, search
│   ├── combat/            Shots (a pool), hits, damage
│   ├── takeover/          The takeover itself, and the Signal Lock minigame
│   └── player/            The core, its energy, which body it's in, what it perceives
└── views/                 Placeholders first (section 6)
```

### 5.2 Space and movement

Positions are in tile units, fractional (`x`, `y` across and down the deck,
rule 6), with a facing as one of 8 directions and an aim direction kept
apart from it (decision 4). Bodies are circles of a radius in tiles, and
slide along walls. Doors are tiles with an open amount from 0 to 1. All of
it advances in `update(deltaMs)`, and every random choice comes from a
random source passed in as an option (073), so a run replays exactly from
its seed and its input.

The player's input reaches the model as intent, never as controls: a held
move direction, `isFiring` (which also holds facing), and an action,
`interact()`, that starts a takeover when touching a robot.

### 5.3 Robots

One `RobotModel` for every robot, the player's body included: a class, a
tier, a designation, a position, a facing, integrity, and its three
modules. A robot is driven either by a brain (section 5.7) or by the
player's intent, and taking it over swaps which. Keeping one model means a
body behaves the same whoever drives it, and later lets a module come off
one robot and go on another.

### 5.4 Perception: sight, light and noise

These decide detection, so they're domain state, in the model:

- **Light**: each tile has a light level from 0 to 1, set by its room's
  lights. The view draws the darkness from it, and the model uses it for
  spotting.
- **Line of sight**: a walk through the tile grid between two points,
  stopped by walls and closed doors. A robot sees the player if the player
  is within its cone and range, the line is clear, and, in the dark, close
  enough.
- **Suspicion**: each robot's suspicion of the player, from 0 to 1, rises
  while it sees the player (faster when close, slower in the dark) and
  drains when it doesn't. That's what gives the player time to react, and
  what the view shows over its head.
- **Noise**: an event with a place and a radius (a shot, a heavy chassis
  walking, a door). Robots within the radius hear it and investigate.
- **What the player perceives**: the tiles in the player's own sight, plus
  a small radius around them in the dark. Robots outside it aren't drawn.
  This is the model's, not the view's, because it's gameplay: what you
  don't perceive, you can't target.

About ten robots, each casting one line a tick to the player plus a cone
check, is cheap. Sight is checked against the player only (robots don't
need to see each other yet).

### 5.5 The four classes

Placeholder names, each named for what it does, and a designation made of
a class code and its tier (for example `SN-2`). Our own scheme, not the
classic's three-digit numbers.

| Class | Tier | Role | Chassis | Weapon | Sensors |
| --- | --- | --- | --- | --- | --- |
| Sweeper | 1 | Cleaning drone, the first body you take | Slow, fragile, quiet | None | Short, narrow |
| Sentry | 2 | Patrols corridors | Middling | Light blaster | Middling |
| Hauler | 3 | Heavy lifter, slow and tough | Slow, tough, loud | Short-range heavy gun | Short, poor |
| Hunter | 4 | One per deck, the frightening one | Fast | Strong blaster | Long, wide |

### 5.6 Takeover and Signal Lock

`TakeoverModel` runs while a takeover is on, and `GameModel` pauses the deck
until it ends. The first minigame is **Signal Lock**: the target's signal
is a trace that drifts up and down an oscilloscope. You steer your own
trace with the d-pad to stay on it, and while you're within the band, a
lock bar fills. Fill it before the target's countdown runs out to win. The
tier difference sets the drift's speed and jitter and the band's width,
and an unaware target gives a longer countdown.

Why this one first: it's a tiny model (a position, a target, two timers),
it plays with the d-pad alone, it scales smoothly with tier, and its look
suits the CRT style. Other minigame ideas, and one minigame for each class
or maker, are in [ideas.md](./ideas.md#takeover).

### 5.7 Brains

Each robot not driven by the player has a brain, a small state machine:
**patrol** (follow its route), **investigate** (go to a noise, look round),
**attack** (close to its weapon's range, keep facing, fire), **search**
(sweep around where it last saw you), **return** (back to its route).
Paths are found on the tile grid (breadth-first or A*, cached by
destination). The Sweeper never attacks. When it spots you, it flees and
makes noise, which is its way of raising the alarm.

### 5.8 Phases

`GameModel`'s phases: `intro` (a short "deck 1" card), `playing`,
`takeover`, `ejected` (a moment's pause as the core pops out), `cleared`,
`shutDown`. The host's overlay and Restart handle the rest.

## 6. Views and placeholders

### 6.1 The first look

Pixi, 2D, drawn by code, nothing that has to be redrawn later to be
thrown away:

- Tiles as flat blocks: floor, wall, door, pad, wreck, in a few colours of
  an 80s palette.
- Robots as blocky silhouettes, a different shape for each class, in the
  class's colour, with a mark for facing. The designation shows in the HUD
  for your own body, and small beside a robot you've spotted, never as a
  big number on top. Round robots with a number on them are the classic's
  best-known image, and placeholders tend to stick (section 9.2).
- Each robot's cone, faint, and a suspicion mark over its head (none, `?`,
  `!`).
- Darkness as a grid of black squares over the deck, alpha from the light
  level and what the player perceives.
- Shots as small squares, a few frames of flash for hits.
- The HUD as console readouts; Signal Lock as a green trace on a dark
  screen.
- A camera that follows the player, as presentation state.

`pixelArt: true`, at a low resolution such as Burrow Bust's, so the
blockiness is real from the start.

### 6.2 The first sound

Audio80, for the decade (whether the rumble wants the Audio90's analog
engine is an open question, section 10): short placeholder effects for
each event in R17, and the rumble as a low, slowly shifting drone on one
voice, so we hear early whether it carries the mood.

### 6.3 Later passes

The look improves in passes, in play, once the models are fun: the 2.5D
renderer spike, lighting, pixel art, the CRT filter, then the sound
design. See section 8 and [ideas.md](./ideas.md#presentation).

## 7. Building it alongside 109 and 110

Each step of the game also tries a piece of 109 that needs no Maker, and
notes what 110's pages need. None of these should slow down finding the
fun. Drop any that does, and say why in the log.

### 7.1 109 pieces to try

| # | Piece | 109 section | When | What we learn |
| --- | --- | --- | --- | --- |
| S1 | A numbered `spec.md`, which steps, tests and notes cite | 4.1 | M0 | Whether a game's spec stays useful as it grows, or rots |
| S2 | Seeded random through options | 8 (073) | M1, from the start | The pattern for 073's other entries |
| S3 | Input recording and exact replay: the seed, each tick's `deltaMs` and intent | 3.5, 8 | M1 | What a headless runner needs, and its cost |
| S4 | A few headless scenarios, as slow tests: a bot clears the deck; a robot that sees you long enough attacks; a sneaking bot reaches the pad unseen | 4.2 | M1 | How scenarios are written, and how stable they are as tuning changes. They aren't held out from the builder, since there's no Maker yet; note what holding out would have caught |
| S5 | Playtest notes pinned to a tick: a dev key saves the tick, seed, recent input, state and a note, to replay later | 3.5 | M2 | Whether it changes how we playtest and fix |
| S6 | A tunables panel in dev, over `data/` | 10 stage 2 | M2 | Which values want live tuning |
| S7 | A hand-kept list of cartridge lifts: what's general to top-down action and stealth (tile sight, cones, suspicion, brains, the shot pool, possession) and what's this game's own | 5.2 | Ongoing | What a cartridge for this genre would hold, and where the line falls |
| S8 | Bots at a few skill levels, playing many runs, for difficulty | 4.3 grader 3 | M2 or later | Whether simulations predict what playtests find |

### 7.2 Notes for 110's pages

Keep a running list in the progress log, each note naming the 110 page it
feeds. Likely ones:

- `guide/phases-and-game-flow.md`: a game's screens, and a minigame as a
  phase that pauses the rest.
- `guide/input.md`: arcade controls to intent; strafing as a held state;
  aim apart from facing.
- `guide/randomness-saving-and-replays.md`: S2 and S3, from a real game.
- `guide/project-layout-and-tunables.md`: a game too big for one
  `models/` folder; spec, data and tunables.
- New topics 110 doesn't plan yet: enemy AI as models (brains, paths,
  perception), and where a big game draws the model and view line for
  light and visibility (section 5.4). Each may become a recipe.

## 8. Milestones after the first playable

Rough order, each revised from the last one's playtests. Each starts by
pulling its candidates from [ideas.md](./ideas.md) and deciding what's in.

- **M2, the ship.** Several decks, lifts and the ship's side view; a deck
  alarm; more classes; a second minigame; saving a run; the deck you must
  sneak through. Playtest notes (S5) and tunables (S6).
- **M3, the look and sound.** The 2.5D renderer spike (Pixi 2D layers, or
  PixiJS 3D drawn at low resolution and quantised to a palette), pixel art
  from generator scripts, dynamic lighting, the CRT filter, the rumble and
  music. Done interactively, in passes, as planned from the start.
- **M4, the build.** Salvage and dismantling, modules swapped between
  bodies, a workshop, upgrading the core.
- **Later.** Bosses, production and resources, prestige, highscores, and
  listing it on the arcade.

## 9. Originality

This game borrows more from one classic than any entry so far, so it
needs more care than the rules alone ask for. This section isn't legal
advice. If the game is ever sold, get proper advice first.

### 9.1 Where the line is

The entries' [originality rules](../../../packages/sites/arcade/src/entries/README.md#originality)
apply in full. Mechanics and ideas are free to use. How a game looks,
sounds and is laid out is not. Court cases show where the risk sits:

- **Tetris Holding v. Xio (2012).** Copying the rules was allowed, but
  copying the board, the pieces' look and how they moved was found to
  infringe.
- **Spry Fox v. 6waves (2012).** A game that kept another's mechanics and
  reskinned everything was let go to trial on its overall look and feel.
  It settled.
- **Data East v. Epyx (1988).** Likenesses that come from the idea itself
  (two karate fighters look like two karate fighters) don't count.

So the risk isn't any one borrowed mechanic. It's how many of them we
borrow, together with a look that echoes the classic. We borrow most of the
classic's structure (section 1.2), including its core idea, taking over
robots and driving them. What makes this a different game is stealth in
the dark, the enemy AI and the build system, so those must show in the
first 30 seconds of play. The first playable's dark room and sneaking are
there partly for this.

### 9.2 The similarities list

Each mechanic we borrow, and how we express it so that it's ours. Review
this list at the start of each milestone and before listing the game, and
add a row whenever a milestone borrows something new.

| Borrowed | How it's ours | Watch for |
| --- | --- | --- |
| A ship seen from above, deck by deck | 2.5D, dark, lit by its own lights; our own palette and deck designs | Flat grey metal floors and consoles in the classic's style |
| Taking over robots and driving them | A bare core that is ejected, not killed; takeover easier from behind; several minigames | Treating it as the whole game rather than one of three choices |
| The takeover game | Signal Lock and the other candidates in [ideas.md](./ideas.md#takeover), one for each class later | Any two-sided circuit, wiring or "colour the sides" game |
| Robot classes, tiers and designations | A class code and a tier (`SN-2`), shown small or in the HUD; a silhouette for each class | Three-digit numbers whose first digit is the class; round robots with a number on top |
| Lifts and a side view of the ship | Drawn our own way, decided at the start of M2 | A cross-section of decks in the classic's layout |
| Energy and recharge pads | One energy store for the core; pads lit, so recharging is a risk | - |
| A rogue robot crew to be cleared | Robots with jobs, brains, hearing and searching (section 5.7) | Robots that only wander and shoot |
| A deep ship rumble | Designed on our chip from its technique, shifting with the deck and alarm | Imitating the classic's sounds or a film's |

### 9.3 The title and the credit

- **"Robofleet" is a working title.** A web search on 2026-11-27 found no
  game by that name. It is the name of an MIT-licensed robotics project
  from UT Austin (2021) that manages fleets of service robots. That's a
  different field, so a clash is unlikely, but searches for the name will
  be crowded. Still to do before listing: Steam, the app stores, and the
  trademark registers (USPTO, TMview). While the entry shows only in dev,
  its id can change at no cost. Once listed, the id is in URLs, saved
  games and highscore keys, so settle the name first.
- **Who holds the classic's rights today** wasn't found in the same
  search. It matters only for a commercial release.
- **"Paradroid" appears only in the `inspiredBy` credit**: never in tags,
  the description, share images, search keywords or the title, and no
  "-droid" names.
- **In prose**, describe it as "a top-down robot action game with stealth,
  inspired by 1980s home computer games".
- **Robots, decks and the ship** are our own designs, from blank grids.
  **Sounds and music** are made on our chips, in a genre's style.

## 10. Open questions

- **Signal Lock, or another first minigame?** Candidates are in
  [ideas.md](./ideas.md#takeover). Signal Lock is recommended for its size.
- **Audio80 or Audio90?** The Audio80 fits the decade, but the Audio90's
  analog engine may make a far better rumble. 080 would let one chip do
  both. Try the rumble on each in M1.
- **What does energy drain mean in a body?** Section 3.3 drains faster in
  a body, which pushes you along. The other way, a body that slowly burns
  out under you, makes you change bodies often. Playtest one, note the
  other.
- **How does a dark room look before M3?** A grid of black squares may
  read as a mess rather than as fear. If so, try a cheap radial mask.
- **Does the bare core need a weapon?** None is recommended, so that bare
  means hide. A short stun that sets up a takeover is the alternative.
- **The screen's size and shape.** Landscape suits a top-down deck, but
  phones are held upright. Decide with the first deck.
- **How should an unlisted entry be launched?** Recommended: include it in
  `CATALOGUE` only when `import.meta.env.DEV`. The catalogue checks then
  cover it in tests, which run in dev, so it needs its thumbnail early.

## 11. Implementation steps

**M0, set up**

1. Make the entry's skeleton: `start/` (entry, details, load), an empty
   `GameModel` and `GameView`, `arcadeControls` and `soundChip` on its
   starter, and its place in `catalogue.ts`, behind `import.meta.env.DEV`.
2. A first, placeholder thumbnail, so the catalogue checks pass.
3. Move section 4.1's requirements into `robofleet/spec.md` (S1).
4. Design the deck on a blank grid, as data, checked against the
   similarities list (section 9.2).

**M1, the deck**

1. The deck: tiles, rooms, doors, lights, the pad (R1, R2), with its
   placeholder view and the following camera.
2. A robot, driven by the player's intent: movement, sliding, facing,
   strafing (R3), with the input wiring.
3. Shots, damage, wrecks (part of R4), and the HUD (R16).
4. The four classes (R4).
5. Perception: sight, cones, suspicion, noise, the dark room, what the
   player perceives (R6 to R9).
6. Brains (R5).
7. The core, energy, ejection, the pad, the end of the game (R13 to R15,
   R18).
8. Takeover and Signal Lock (R10 to R12).
9. Placeholder sound and the rumble (R17).
10. Recording, replay and the scenarios (S3, S4).
11. Two playtests, answering section 4.3, and the M2 plan, which starts
    by reviewing the similarities list (section 9.2).
