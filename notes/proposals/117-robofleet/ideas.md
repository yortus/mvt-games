# Robofleet: Ideas for Later

Every idea for Robofleet that isn't in the first playable. Nothing here is
decided. Each milestone starts by reading this page, pulling in what it
wants, and marking what it took. Add ideas as they come up in playtests,
with the date and where they came from.

Each idea carries a tag:

- **(M2)**, **(M3)**, **(M4)**: a first guess at the milestone it suits, from
  [the proposal's section 8](./proposal.md#8-milestones-after-the-first-playable).
- **(later)**: after M4, or once the game shows it needs it.
- **(question)**: something to decide before it can be built.
- **(taken, Mn)**: pulled into a milestone. Leave the line here, so the
  history is in one place.

Ideas from the first planning notes (2026-11-27) are marked with a ★.

## Contents

- [The ship](#the-ship)
- [Robots](#robots)
- [Takeover](#takeover)
- [Stealth and detection](#stealth-and-detection)
- [Light and atmosphere](#light-and-atmosphere)
- [Combat and weapons](#combat-and-weapons)
- [Enemy AI](#enemy-ai)
- [Salvage, upgrades and building](#salvage-upgrades-and-building)
- [Production and resources](#production-and-resources)
- [Bosses](#bosses)
- [Progression and the long game](#progression-and-the-long-game)
- [Presentation](#presentation)
- [Sound and music](#sound-and-music)
- [Setting and story](#setting-and-story)
- [Controls and devices](#controls-and-devices)
- [Tools](#tools)

## The ship

- ★ **Lifts between decks**, and a side view of the ship to choose a deck
  from. **(M2)**
- ★ **Decks you must cross to advance that are far harder than you are.**
  You sneak through, because you can't fight through yet. **(M2)**
- **A deck alarm.** A robot that raises the alarm puts every robot on the
  deck on guard for a while. Robots might raise it at terminals, so you
  can stop them before they get there. **(M2)**
- **Locked decks or doors** that need a body of a high enough tier, or a
  class with clearance, to open. A reason to choose a body, not just to
  climb. **(M2)**
- **Vents only the bare core fits through.** A route for hiding and
  shortcuts, and a reason to leave a body behind for a while. **(M2)**
- **A power room on each deck.** Take it over, or wreck it, and the deck's
  lights go out: easier to hide, harder to see. **(M3)**
- **Terminals**: a map of the deck, a robot list, a log of what happened.
  Maybe taken over with the same minigames. **(M2)**
- **Security cameras**, as robots that can't move. **(M2)**
- **Decks designed by hand, or generated?** Hand-made decks suit a tight
  arcade game; generated ones suit replays and a roguelite. Perhaps
  hand-made rooms joined by a generator. **(question)**
- **A deck's state kept when you leave it**, so robots you skipped are
  still there when you come back. **(M2)**

## Robots

- ★ **Modular robots.** Chassis, locomotion (wheels, legs, hover),
  weapon, sensors, armour, utility. The first playable has three modules;
  more come with the build system. **(M4)**
- ★ **Types, tiers and designations.** Our own scheme, a class code and a
  tier (`SN-2`), shown small or in the HUD, never as a big number on top
  (see [proposal section 9.2](./proposal.md#92-the-similarities-list)).
  Perhaps a serial number too, as scenery. **(question)** on how much the
  designation should tell you.
- **A robot database**, filled in as you meet or take over each class: its
  modules, its tier, what it's weak to. **(M2)**
- **Classes with jobs that change the deck**: a repair robot that fixes the
  others, a cleaner that clears away wrecks (and notices them), a guard
  dog that tracks noise, a swarm of tiny drones, a loader that moves
  crates (and cover). **(M2)**
- **A squad of captured robots.** Leave a body you've taken under simple
  orders (hold, follow, guard) instead of wrecking it. Rich, and a lot of
  AI. Weighed against the core-only design on 2026-11-27 and left for
  later. **(later)**
- **Robots that need energy too**, and go to recharge pads. A queue at a
  pad is an opening, and a pad you've wrecked starves them. **(M2)**
- **Manufacturers**, each with a look, a sound and a takeover minigame of
  its own. **(M3)**

## Takeover

- ★ **Minigames for takeover**, more than one. Candidates:
  - **Signal Lock**: stay on a drifting trace. *Chosen for the first
    playable.*
  - **Relay Race**: route power across a small grid of switches to the
    target's core before its defence closes the paths.
  - **Handshake**: press in time with the target's protocol pulses, which
    speed up and skip. Plays well with the sound chip.
  - **Code Echo**: repeat a sequence of tones and directions, longer for
    higher tiers.
  - **Firewall**: a tiny shooter inside the target, clearing blocks to
    reach its core.
  - **Lock Pick**: turn tumblers, feeling for each one's sweet spot.
- **One minigame for each class or manufacturer**, so you learn which you
  are good at, and a robot's look tells you what you'll face. **(M3)**
- **Outcomes between a win and a loss**: a partial takeover that lasts a
  short while, or a body you're in that fights you back. **(question)**
- **Awareness matters**: from behind, unaware, is easier. *In the first
  playable.* Stunned (by an EMP weapon) could be easier still. **(M2)**
- **Taking over terminals, doors, cameras and pads**, with the same
  minigames. **(M2)**
- **A body that burns out**: possessing a body far above your core's rank
  wears it down over time. The alternative to energy draining faster in a
  body ([proposal section 10](./proposal.md#10-open-questions)).
  **(question)**

## Stealth and detection

- ★ **Hiding and detection.** *In the first playable*, in a simple form:
  cones, suspicion, noise and one dark room.
- **Playing dead.** Power a body down, and patrols take it for a wreck,
  until they notice a wreck where there wasn't one. **(M2)**
- **Wrecks are noticed.** A patrol that finds a wreck, or your old body,
  investigates and may raise the alarm. **(M2)**
- **Distractions**: something you can throw or set off, to make a noise
  somewhere else. **(M2)**
- **A lamp on your body**: on, you see further, and they see you sooner.
  **(M2)**
- **Footsteps by chassis**: legs clank, wheels hum, hover is near silent.
  **(M2)**
- **Cover that blocks sight**: crates, consoles, alcoves. **(M2)**
- **A motion tracker**: shows movement around you as blips, but only what
  moves, and it beeps. The *Alien* feeling. **(M3)**
- **A sonar ping** that shows robots through walls for a moment, and tells
  them where you are. **(M2)**

## Light and atmosphere

- ★ **Dark decks and dynamic lighting**, to frighten. The first playable
  has light levels in the model; drawing them well is **(M3)**.
- **Flickering lights**, a room that goes dark on a timer, emergency
  lighting in red when the alarm is up, strobes. **(M3)**
- **Shooting out lights.** **(M2)**
- **Your body's sensors set what you see**: a body with poor sensors sees
  less of the dark. **(M2)**
- **Steam, sparks and smoke**, which hide you and catch the light. **(M3)**

## Combat and weapons

- ★ **Weapons**, as modules on bodies. Candidates: a blaster, a scatter
  gun, a beam that has to be held on target, an EMP that stuns (and sets
  up a takeover), mines, a ram for heavy chassis. **(M2)**
- **Energy or ammunition?** Weapons drawing on the core's energy ties
  fighting to the energy pillar. Ammunition makes salvage matter.
  **(question)**
- **Robots hurting each other** with stray shots, and holding a grudge.
  **(M2)**
- **Knockback, and explosions that wreck what's near.** **(M2)**
- **Free aim**, with a mouse or a second stick. The model keeps aim apart
  from facing, so this needs no model rewrite. **(later)**

## Enemy AI

- ★ **Enemy AI.** *In the first playable*: patrol, investigate, attack,
  search, return.
- **Robots that talk to each other**: one that sees you calls the nearest
  for help, so a fight grows. **(M2)**
- **Flanking and holding back**: a squad that splits, one that waits at a
  door. **(M2)**
- **Retreating to repair or recharge** when hurt. **(M2)**
- **A stalker**: one robot on a deck that hunts you on and off, led by a
  pacing director that eases off after a close call. **(M3)**
- **Robots that remember**: a room where they lost you is searched first
  next time. **(M2)**

## Salvage, upgrades and building

- ★ **An upgrade and build system**, alongside takeovers, not instead of
  them. **(M4)**
- ★ **Reuse captured parts, or dismantle them for resources.** A wreck can
  be stripped of a module, or broken down for scrap. **(M4)**
- **A workshop station** on some decks: swap modules on the body you're
  in, or build a body from parts and jump into it. **(M4)**
- **Upgrading the core itself**: more energy, a rank that makes takeovers
  easier, a better bare shell. **(M4)**
- **Scanning as you take over**: each class you take teaches you its
  blueprint, so you can build it later. **(M4)**

## Production and resources

- ★ **Production and resources?** Ship factories that build robots: wreck
  one to stop the deck refilling, or take it over to build your own.
  Resources such as scrap, circuits and power cells. **(later)**
  **(question)** on whether this fits an arcade game or pulls it towards
  strategy.

## Bosses

- ★ **Bosses.** A deck boss guarding a lift, with a takeover minigame of
  its own. **(later)**
- **The ship's mind** as the last boss, the thing that turned the crew.
  **(later)**
- **A boss you can take over**, and keep, if you win a very hard
  minigame. **(later)**

## Progression and the long game

- ★ **Prestige?** "Robofleet" suggests a fleet. Clear one ship, move to the
  next, harder, keeping some of the core's upgrades. **(later)**
  **(question)**
- **Score and highscores**, through the arcade's highscore tables, once the
  scoring feels right. **(later)**
- **Saving a run**, through the site's saved games. **(M2)**
- **A roguelite mode**, with generated decks and a seed of the day.
  **(later)**
- **Difficulty settings.** **(later)**

## Presentation

- ★ **A 2.5D, pseudo-pixel-art look.** Candidates for the M3 spike:
  - **Pixi 2D with layers**: walls drawn with a front face and a top, robots
    as stacked sprite slices, faked height. Cheapest, and stays 2D.
  - **PixiJS 3D at low resolution**: a low-poly scene with real lights and
    shadows, drawn into a small texture with nearest filtering and
    quantised to a palette, then scaled up. Lighting comes free; needs
    `draws3d` and the leak checks (AGENTS.md, 3D).
  - **Pixi 2D with normal maps**: flat sprites that light like 3D.
  **(M3)**
- ★ **A CRT effect**: scanlines, a slight curve, bloom, a little colour
  fringing, phosphor afterglow. A post-processing filter, with a setting
  to turn it off. **(M3)**
- ★ **80s colours**: our own palette in the spirit of the home computers of
  the time, not a copy of one machine's. **(M3)**
- **The HUD as ship consoles**, in the site's pixel font. **(M3)**
- **A title screen and intro**: the ship drifting, the rumble, the core
  arriving. **(M3)**
- **Deck changes**: the lift ride, the side view, the next deck's card.
  **(M2)** for the logic, **(M3)** for the look.

## Sound and music

- ★ **The ship's rumble**: a deep drone, felt more than heard, that shifts
  with the deck, rises with the alarm and drops in the dark. A placeholder
  is in the first playable. **(M3)** for the real one.
- **Each class sounds different**: servos, treads, hover hum, heavy
  footfalls, so you can hear what's coming round the corner. **(M3)**
- **Takeover sounds** that match each minigame. **(M3)**
- **Music that follows the tension**: sparse ambience while you sneak,
  stingers when you're spotted, a pulse while hunted. **(M3)**
- **Audio80 or Audio90**: see [proposal section 10](./proposal.md#10-open-questions).
  **(question)**

## Setting and story

- **Why the crew turned**, told a line at a time in terminal logs. Kept
  light: it's an arcade game. **(later)**
- **The ship's name and the core's purpose**, our own. **(M3)**

## Controls and devices

- **Gamepads**, if the arcade controls don't already read them.
  **(question)**
- **Touch**: the host's touch controls first. A takeover minigame must play
  on them too. **(M2)**
- **Free aim**: see [Combat and weapons](#combat-and-weapons).

## Tools

Most of these are 109's, tried on this game ([proposal section 7](./proposal.md#7-building-it-alongside-109-and-110)).

- **A deck editor**, in place of ASCII maps, once there are several decks.
  Perhaps 109's map editor, or Tiled import. **(M2)**
- **A robot class editor**, for modules and stats. **(M4)**
- **A replay viewer**: scrub through a recorded run, see each robot's
  brain state. **(M2)**
- **Debug views**: cones, paths, suspicion, light levels, noise rings,
  each toggled by a key in dev. **(M2)**, though some may arrive in M1 as
  they're needed.
