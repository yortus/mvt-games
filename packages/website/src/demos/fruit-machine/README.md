# Fruit Machine

A five-reel fruit machine, played and watched through four views at once:
a modern machine in Pixi, an old one-armed bandit in three.js, an HTML
control panel, and a text terminal. Spin from any of them (the Pixi button,
the 3D lever, the panel's Spin, or `spin` in the terminal) and all four
follow. None of them knows the others exist.

The page is `packages/website/demos/fruit-machine/` (`/demos/fruit-machine/` on the dev
server). It is a page of its own, like Boids in 3D, because the demos gallery
only runs Pixi demos (task 026).

## The game

- 5 reels of 3 rows, each reel a fixed strip of 27 or 28 symbols: six
  fruits and a wild. The model calls them `pic1` to `pic6` and `wild`; the
  fruit is the views' theme.
- **243 ways:** a win is a path of one cell per reel, from the first reel
  across 3, 4 or 5 adjacent reels, all the same fruit, the wild standing in
  for any. Each way pays on its own.
- A bet of 25 credits a spin, from a starting balance of 100 credits.
  Below 25 credits, the game is over: reload to play again.
- It pays back **119.5%** on average, worked out exactly by
  `computeReturn`. 81% of spins win something, many of them less than the
  bet. With only four bets to start, about a fifth of players see game over
  within 20 spins (31% within 100). The machine itself is steady: from ten
  bets, about 3% would run out within 100 spins. The test suite holds the
  return and that steadiness, and checks the exact return against a long run
  of the machine itself.

## What it shows

**One model, four projections.** Everything the machine is lives in
`createFruitMachineModel`: the reels, the balance, the phase, the
celebration, and the two actions, `spin()` and `stop()`, with their guards
`canSpin` and `canStop`. `stop()` cuts short whatever is running: during a
spin it lands the reels at once, and the win is still paid and shown; during
the win display it ends it, ready for the next spin. Each view reads the
model every frame and draws it its own way, and any view may call the
actions. Nothing connects the views to each other; the page's one loop
updates the model, then calls `updateView` and `refreshView` on all four
roots (the same functions for every renderer), then lets Pixi and three.js
draw.

**The model decides; the views take their time.** A spin's result is drawn
from the seeded random numbers the moment it starts, and evaluated at once.
The reels then spin at 20 positions a second, start to settle one second
in, half a second apart from left to right, and each lands over half a
second. Open "Peek" in the panel during a spin to see the result the model
already holds.

**The landing's bounce lives in the views.** The model settles a reel
linearly: `progress` rises steadily from 0 to 1 while the reel moves from
`settleDistance` above its stop down onto it. Each view eases that its own
way, as a pure function of the model (`shownReelPosition` in
`views/shared/reel-landing.ts`), with no state of its own:

| View | Landing |
| --- | --- |
| Pixi | `easeOutBack`: overshoots and springs back |
| three.js | `easeClunk`: arrives fast, rocks to rest like a mechanical stop |
| Panel | none: the raw, linear numbers, and a settle bar filling steadily |
| Terminal | none: whole symbols only |

Watch the panel's Position column as a reel starts to settle: it jumps.
The stop was drawn at random, and a reel turning at a fixed speed to a fixed
schedule can't also arrive on it honestly, so as it starts to settle it
jumps to just above its stop, as video slots do. At 20 symbols a second
nobody sees it, except in the numbers.

**An action that returns a promise, without breaking the time rule.**
`spin()` returns a `Promise<SpinOutcome>` that resolves when the machine is
idle again. The model uses no timers: it keeps the promise's `resolve` and
calls it from inside `update`, on the tick the spin ends. A machine that
isn't updated never resolves, so tests stay deterministic. The terminal is
the natural consumer: its `spin` command awaits the promise and holds the
prompt until it resolves, as a shell does, and Ctrl+C stops the spin.

**Composition, both sides.** The machine model composes a reel model per
reel, a celebration model, a pure ways evaluator and a seeded random source;
each has its own tests. Each top-level view is layered from leaf views that
take bindings: the Pixi machine is a backdrop, a paytable, marquee lights,
the reels, the win path, a juice burst, meters, a win banner, the spin
button and a game-over overlay.

**Presentation state, where the model has no say.** The marquee's chase,
the juice droplets, the win banner counting up, the button sinking under a
finger, the lever swinging whenever a spin starts (from any view), and the
cabinet's sway and drag are all the views' own, advanced in `update`. The
terminal's transcript, history and running command are its own too, kept in
a view model (`terminal-view-model.ts`) with tests of its own.

**Change detection for costly writes.** Text is made only when the value
it shows changes (`memoiseLast`, and `lastFor` for replaced objects); the 3D
credit display and sign repaint their canvases only on change; the terminal
rebuilds its ASCII reels only when a reel moves a whole symbol; the cells a
celebration lights are worked out once per step (`createLitCells`).

## The art

The symbols are SVG written in code (`views/art/symbol-svgs.ts`) from one
palette, flat with two or three tones each. The wild is the exception: big
white WILD lettering on rainbow stripes in all the fruits' colours, since it
stands in for every one of them. `loadSymbolArt` draws them once
to canvases that both renderers share: the Pixi views make textures of them,
and the three.js drums are painted from them, so both show the same pixels.
The HTML panel shows the SVGs themselves.

The three.js cabinet is the one exception to the flat style: it is painted,
clear-coated and chromed with physically based materials, which shine by
reflecting an environment map the page sets on the scene (`RoomEnvironment`,
dimmed). Its colours are named by role in `views/three/bandit-layout.ts`.

## Files

```
data/       Symbol kinds, reel strips, paytable, bet and timings
models/     The machine, its reels, celebration, ways evaluator and exact return
views/
  art/        Palette, symbol SVGs and names, and the shared canvases
  shared/     Helpers every view uses: landing eases, lit cells, credit formatting
  pixi/       The modern machine
  three/      The one-armed bandit
  panel/      The control panel
  terminal/   The terminal, its view model and its ASCII art
main.ts     The page: one model, four views, one loop
```
