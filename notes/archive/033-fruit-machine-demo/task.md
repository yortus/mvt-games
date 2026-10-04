# Fruit Machine Demo

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-03 |
| Updated  | 2026-10-03 |

## Description

A demo of **one model with many projections**: a five-reel fruit machine
whose single model is played and watched through four views at once, on
three renderers and a text terminal, arranged in quadrants on one page.

| Quadrant     | Renderer             | What it is                                                  |
| ------------ | -------------------- | ----------------------------------------------------------- |
| Top left     | Pixi (`@mvtjs/pixi/jsx`)   | The modern 2D machine: symbol art, decals, spin button, win celebrations |
| Top right    | three.js (`@mvtjs/three/jsx`) | An old one-armed bandit in 3D, swaying, drag to turn, pull the lever |
| Bottom left  | HTML (`@mvtjs/html/jsx`)   | A control panel: every piece of model state, plus Spin and Stop |
| Bottom right | HTML (`@mvtjs/html/jsx`)   | A text terminal: type `spin`, get ASCII reels back           |

Pressing spin anywhere spins all four: the 3D lever pulls itself, the panel's
numbers run, the terminal prints the result. That is the point of the demo,
and the source should make it obvious why it works: every view reads the same
model every frame, and none of them talks to another.

The demo and its source are a showcase for MVT, so both are held to a polish
bar: the model is composed from small single-purpose models with their own
tests, each view is layered from child views, and the README explains what to
look for.

### Scope decisions (agreed 2026-10-03)

- **Celebration cycles through every winning way path**, one step per path,
  once, then the machine goes idle. A spin with many paths has a long
  celebration; `stop` cuts it short, and every view offers stop.
- **`spin()` resolves when the machine is idle again**: after the reels land
  and the celebration (if any) has finished or been stopped. `canSpin` is false
  while celebrating.
- **Its own page**, like Boids in 3D: `site/demos/fruit-machine/`, linked from
  the gallery's subtitle. The gallery only runs Pixi demos; task 026 would make
  it a card later.
- **The 3D cabinet sways gently on its own, and can be dragged to turn it all
  the way round.** Tapping the lever spins, or stops when `canStop`.
- JSX for every view.

### Settled questions (agreed 2026-10-03, do not reopen without new information)

- **Landing:** a reel jumps unseen to just above its stop when it starts
  settling, rather than waiting for the stop to come round (section 2.5).
- **Credits:** start at 10 bets; below one bet is game over, with no top-up.
- **Wild:** reels 2-5 only, paying nothing on its own.
- **Celebration opener:** one 1.5 s step showing every winning cell at once,
  then the paths.
- **Name and theme:** "Fruit Machine", with the fruit in section 5.1.
- **Keyboard:** no global Space-to-spin; the terminal takes typing.

## 1. Rules of the Game

- **Window:** 5 reels, 3 rows. Each reel has a fixed strip of symbols; the
  window shows three consecutive strip entries per reel, top to bottom
  `strip[stop]`, `strip[stop + 1]`, `strip[stop + 2]` (wrapping).
- **Symbols:** `pic1`-`pic6` (pic1 pays most) and `wild`. The model knows only
  these names; the fruit theme is presentation (section 5.1).
- **Ways, 243 of them:** a win is a path of one cell per reel, from reel 1
  rightwards across 3, 4 or 5 adjacent reels, all showing the same symbol.
  `wild` substitutes for any picture.
- **`wild` never appears on reel 1 and pays nothing on its own.** So a path's
  symbol is always the one on reel 1, no path can count for two symbols, and
  the expected return has an exact closed form (section 2.3).
- **Each path pays separately:** `paytable[symbol][length]` credits. A spin's
  win is the sum over its paths.
- **Stake:** a fixed bet per spin (25 credits, a common 243-ways stake), taken
  when the spin starts. The balance starts at 10 bets (250 credits).
- **Game over** when the machine goes idle with less than one bet left. There
  is no way to add credits; reloading the page starts again. It should rarely
  happen: the tuning targets a small chance of it (section 2.3).
- **Return to player about 120%**, to make it fun: the test suite holds it to
  115-125% exactly (section 2.3). As shipped: 119.5%, with about 81% of spins
  winning something, and 3.3% of players out of credits within 100 spins.
- **Strips:** 27 symbols on the first reel, 28 on the rest, with no symbol
  within three places of itself, so a window never shows a picture twice on a
  reel (`data/reel-strips.ts`).

## 2. Model

All under `site/src/demos/fruit-machine/models/`, domain units only (strip
indices, credits, milliseconds), time advanced only through `update(deltaMs)`.

### 2.1 Composition

| Part | Kind | Job |
| --- | --- | --- |
| `createRandom` | small model | Seeded xorshift32, so tests and the page's first spins are reproducible. Copied from falling-sand rather than imported across demos |
| `createReelModel` | small model, x5 | One reel's motion: stopped, spinning at a fixed speed, settling onto a chosen stop |
| `evaluateWays` | pure function | A window in, the list of winning paths and the total out |
| `computeReturn` | pure function | The exact RTP and hit rate of a set of strips and a paytable |
| `createCelebrationModel` | small model | An opening step for all the wins, then one per win, at a fixed pace; can be cut short |
| `createFruitMachineModel` | top-level model | Owns the reels, the wallet, the phase and the celebration; the actions and their guards |

### 2.2 The top-level interface

```ts
type MachinePhase = 'idle' | 'spinning' | 'celebrating' | 'gameOver';

interface FruitMachineModel {
    readonly reels: readonly ReelModel[];
    readonly phase: MachinePhase;
    /** True from a `stop()` during a spin until the reels land. */
    readonly isStopping: boolean;
    readonly balance: number;
    readonly bet: number;
    /** The win of the last spin to land; 0 from the start of a spin. */
    readonly lastWin: number;
    /** Counts spins; views watch it to notice a new spin, whoever started it. */
    readonly spinCount: number;
    /** The current spin's result, decided when it started; undefined before the first spin. */
    readonly outcome: SpinOutcome | undefined;
    readonly celebration: CelebrationModel;

    readonly canSpin: boolean;   // idle (and so balance >= bet)
    readonly canStop: boolean;   // spinning and not already stopping, or celebrating
    /** Takes the bet, decides the result, spins. Resolves with the outcome once idle again, or game over. */
    spin: () => Promise<SpinOutcome>;
    /** Lands the reels quickly and skips the celebration, or ends the celebration. Never starts a spin. */
    stop: () => void;
    update: (deltaMs: number) => void;
}

interface SpinOutcome {
    readonly stops: readonly number[];
    readonly window: readonly (readonly SymbolKind[])[];   // [reel][row]
    readonly wins: readonly WayWin[];                      // highest payout first
    readonly totalWin: number;
}

interface WayWin {
    readonly symbol: SymbolKind;
    /** The row of each cell on the path, reel 1 first; its length is the win's length (3-5). */
    readonly rows: readonly number[];
    readonly payout: number;
}

type CelebrationStepKind = 'allWins' | 'oneWin';

interface CelebrationModel {
    readonly isActive: boolean;
    /** The wins being celebrated, highest payout first. Empty when not active. */
    readonly wins: readonly WayWin[];
    readonly stepKind: CelebrationStepKind;
    /** The win the step shows, during a `oneWin` step; undefined otherwise. */
    readonly win: WayWin | undefined;
    /** Counts steps from 0 (the opener), so views can notice a new step. -1 when not active. */
    readonly stepIndex: number;
    /** 0 to 1 through the step, linear. */
    readonly progress: number;
}
```

Calling `spin` when `!canSpin`, or `stop` when `!canStop`, is a programming
error and asserts (`assert` from `@mvtjs/utils`): every view checks the guard
first, and the terminal says why it can't.

### 2.3 Return to player, exactly

Because reels stop independently and a path's symbol is fixed by reel 1, the
expected return per symbol S is a sum over lengths k of

    paytable[S][k] x E[c1] x ... x E[ck] x P(c(k+1) = 0)

where `c_r` is the number of cells on reel r showing S (or wild, on reels 2-5)
at a uniformly random stop. `computeReturn` evaluates it in microseconds, and
the hit rate by enumerating reels 1-3 (about 24^3 combinations). Its test:

- asserts RTP within 115-125% and hit rate within a band, and prints a
  per-symbol breakdown when it fails, so tuning strips is a test loop;
- checks `computeReturn` against a Monte Carlo run of the real model (tens of
  thousands of seeded spins, driven by `update`), which also tests
  `evaluateWays` and the wallet end to end;
- estimates, by seeded runs from the starting balance, the chance of game
  over within the first 100 spins, and holds it under 5%.

**What tuning found (step 1; do not reopen without new information).** At a
120% return, starting with 10 bets, the chance of game over is set by how
much a spin's win swings. The first shapes tried, with the wins' size rising
steeply up the paytable, ran out of credits for about 20% of players within
100 spins. Two changes brought that down to 3.3%: a flatter paytable (a
five-of-a-kind pays about three times a three-of-a-kind, not seven), and
strips that never show a picture twice on one reel, which keeps a spin's
ways few (1.9 per winning spin on average). The price is a high hit rate:
81% of spins win something, many of them less than the bet. The plan's first
target, a 35-45% hit rate, can't be had alongside a 120% return and rare game
over from 10 bets: fewer wins at the same return means bigger ones, and
bigger swings. Scratch tuning scripts are not kept; the figures come from
`computeReturn` and the tests.

The README quotes the final figures.

### 2.4 The spin timeline

| Time (ms) | What happens |
| --- | --- |
| 0 | `spin()`: bet taken, `lastWin` = 0, `spinCount` + 1, five stops drawn, outcome evaluated; every reel spins at full speed, 20 strip positions per second |
| 1000 + 500 i | Reel i (0-4) starts settling: 500 ms onto its stop |
| 3500 | Last reel lands: win credited to `balance` and `lastWin`; `celebrating` if there are wins, else `idle` (the promise resolves) |
| + 1500 | Celebration opener: every winning cell at once |
| + 800 per path | One celebration step per winning path, highest payout first; then `idle`, and the promise resolves |

Wherever the machine would go `idle`, it goes `gameOver` instead if the
balance is below one bet; the promise resolves the same way. No action leaves
`gameOver`.

`stop()` while spinning: every reel still turning settles from where it is
over 200 ms, reels already settling finish within 200 ms, the win is credited
on landing, and the machine goes straight to `idle`, skipping the
celebration. `stop()` while celebrating: `idle` at once. Timings live in
`data/` as named constants.

### 2.5 Reel motion, and where the easing lives

```ts
type ReelPhase = 'stopped' | 'spinning' | 'settling';

interface ReelModel {
    readonly strip: readonly SymbolKind[];
    readonly phase: ReelPhase;
    /** Fractional strip index of the top row. Falls as the reel turns (symbols move down), wrapping. */
    readonly position: number;
    /** The strip index the reel lands on. */
    readonly stopIndex: number;
    /** How far, in strip positions, the settle travels. */
    readonly settleDistance: number;
    /** 0 to 1 through the settle, linear. 0 when not settling. */
    readonly progress: number;
    // spin / hurry / update, used by the machine model only
}
```

While settling, the model's own position is linear:
`stopIndex + (1 - progress) * settleDistance`. **The landing's bounce is not
in the model.** Each view eases `progress` its own way, as a pure function of
`(stopIndex, settleDistance, progress)` in its refresh, so it needs no state:
Pixi lands with a springy back-out, the 3D drums with a heavy mechanical
clunk, the terminal snaps, the panel prints the raw linear numbers. Same
domain transition, four presentations; the README makes this point.

**Landing on a decided stop.** The schedule is fixed and the speed is fixed,
so a reel can't both turn honestly and land on a stop drawn at random. When a
reel starts settling, it jumps to `settleDistance` above its stop and settles
from there: what video slots do. At 20 symbols a second the jump can't be
seen, and the panel's numbers will show it, which is worth a line in the
README. Waiting for the stop to come round instead was ruled out: it adds up
to a second of jitter to the left-to-right rhythm.

### 2.6 The async action

`spin()` returns a promise, a first for a model in this repo. It doesn't break
the time rule: no timers, the model stores the promise's `resolve` and calls
it from inside `update`, on the tick the machine goes idle. If nothing ticks,
nothing resolves, so tests stay deterministic:

```ts
const done = model.spin();
advance(model, 3500 + celebration);
expect(await done).toEqual(model.outcome);
```

Continuations run as microtasks after the frame's callback, after `update` and
`refresh`. `stop()` resolves the promise too (the outcome was decided anyway);
nothing rejects.

The terminal is the natural consumer: its `spin` command awaits the promise
and holds the prompt until it resolves, like a running command (section
5.5). The buttons fire and forget (`void model.spin()`).

## 3. Data

`site/src/demos/fruit-machine/data/`: `reel-strips.ts` (five strips),
`paytable.ts` (pays for 3, 4 and 5 of a kind, per picture), and
`machine-constants.ts` (bet, starting balance, spin speed, the timeline's
durations, celebration step time).

## 4. Page and Loop

- `site/demos/fruit-machine/index.html`: the site nav, a short caption, and a
  2x2 grid of quadrants, each labelled with its renderer. One column on
  narrow screens.
- `site/src/demos/fruit-machine/main.ts`: awaits the symbol art, creates the
  one model and the four views, and runs **one** `requestAnimationFrame` loop
  for all of them, as Boids in 3D does for two:

  ```ts
  model.update(deltaMs);
  updateView(pixiApp.stage, deltaMs); updateView(scene, deltaMs);
  updateView(panel, deltaMs);         updateView(terminal, deltaMs);
  refreshView(pixiApp.stage); refreshView(scene); refreshView(panel); refreshView(terminal);
  pixiApp.render();
  threeRenderer.render(scene, camera);
  ```

  The Pixi `Application` is created with `autoStart: false` so its ticker
  doesn't run a second loop. The delta is clamped, as in Boids in 3D.
- The Pixi canvas has a fixed design size (16:9) scaled to its quadrant at the
  display's pixel density; the three.js canvas fills its quadrant.
- `vite.config.ts` gains the page as a build input; `site/demos/index.html`'s
  subtitle links it beside Boids in 3D.

## 5. Views

`site/src/demos/fruit-machine/views/`, one subdirectory per projection, each
with a barrel, plus the shared art. Top-level views take `{ model }` (and the
art); every leaf view takes bindings.

Every view shows game over in its own way: a "GAME OVER" banner over the Pixi
reels, a "TILT"-style lamp on the 3D top box with the lever locked, the
panel's phase and greyed buttons, and a closing line in the terminal ("Out of
credits. GAME OVER. Reload to play again.").

### 5.1 Shared art and theme (`views/art/`)

Clean, flat and bright: each symbol uses 2-3 tones, with no gradients or
outlines-for-shading.

| Model | Fruit | Tones | Terminal label |
| --- | --- | --- | --- |
| `pic1` | Watermelon slice | rind green, flesh red, seed near-black | `MELON` |
| `pic2` | Grapes | violet, deep violet, leaf green | `GRAPES` |
| `pic3` | Cherries | red, deep red, stem green | `CHERRY` |
| `pic4` | Orange | orange, pale orange, leaf green | `ORANGE` |
| `pic5` | Lemon | yellow, pale yellow | `LEMON` |
| `pic6` | Blueberries | blue, navy, pale blue | `BERRY` |
| `wild` | Star with "WILD" | gold, deep gold, white | `*WILD*` |

- `palette.ts`: every colour, named by symbol and tone, plus the UI colours.
- `symbol-svgs.ts`: each symbol's SVG markup, written in code from the palette
  (one source of truth for colour; easy to tweak).
- `load-symbol-art.ts`: rasterises each SVG once to a canvas at load (plus a
  vertically blurred copy for the reels in motion), and gives data URLs for
  the HTML panel. It returns renderer-neutral canvases; the Pixi views wrap
  them as `Texture`s and the three.js views as `CanvasTexture`s, so both draw
  the same pixels and the art module depends on neither.
- `symbol-names.ts`: display names and terminal labels.

### 5.2 Pixi.js: the modern machine (`views/pixi/`)

`PixiMachineView({ model, art })`, layered back to front:

| Child view | Shows | State |
| --- | --- | --- |
| `BackdropView` | Flat geometric decals, fruit silhouettes, the title banner | none |
| `MarqueeLightsView` | A ring of bulbs that chase slowly when idle, fast when spinning, and flash on a win | presentation: a light clock, advanced in `update` |
| `ReelView` x5 | A masked column of 4 recycled sprites; blurred textures at full speed; back-out landing | none: eased position is a pure function of the reel |
| `WinPathView` | The current celebration step: path line through its cells, the cells popping, the rest dimmed | none: derived from step and progress; the line redrawn only when the step changes |
| `JuiceBurstView` | A burst of droplets in the symbol's colours at each step | presentation: a pre-allocated particle pool |
| `MetersView` | Balance, bet and win plates | none |
| `WinCounterView` | "WIN 1,250", rolling up, with the step's caption ("CHERRY x4, 30") | presentation: the displayed amount chases `lastWin` |
| `SpinButtonView` | One round button: SPIN, STOP while spinning, SKIP while celebrating, greyed when neither | presentation: pressed dip while the pointer is down |

`SpinButtonView` takes `mode: () => 'spin' | 'stop' | 'skip' | 'disabled'` and
`onPressed`; the top-level view maps the model's phase and guards to the mode,
and a press to `stop()` or `spin()`.

### 5.3 three.js: the one-armed bandit (`views/three/`)

`BanditView({ model, art, dragSurface })`:

- **Turntable:** the whole cabinet sways about 15 degrees either side of front
  on its own; dragging horizontally on the canvas turns it any amount, and it
  stays where it is left, the sway continuing around it. Both are presentation
  state, advanced in `update`. A move under a few pixels is a tap, so the lever
  still gets its click.
- **`CabinetBodyView`:** body, top box, coin tray and chrome trim from boxes,
  in a vintage version of the same flat palette (cherry red, cream, chrome).
  `MeshToonMaterial` with a three-step gradient map keeps the 2-3 tone look.
- **`ReelDrumsView`:** five cylinders on a horizontal axis behind a window
  frame, each wrapped in a texture of its strip (the symbol canvases stacked),
  turned to the eased position. The landing is a heavier, mechanical clunk than
  Pixi's.
- **`WinLampsView`:** translucent highlights in front of the current path's
  cells, and a top lamp that flashes through the celebration.
- **`LeverView`:** rod and red ball. It plays a pull-and-spring-back each time
  `spinCount` changes, whichever view started the spin (an `EdgeTween`).
  Tapping it spins, or stops when `canStop`.
- Lights, camera and `createPointerPicker` are set up in `main.ts`, as Boids
  in 3D does. The drag listeners are added and removed by the view itself.

### 5.4 HTML: the control panel (`views/panel/`)

`ControlPanelView({ model, art })`, an inspector that shows everything:

- Meters: balance, bet, last win.
- Status: phase, `isStopping`, `spinCount`, and `canSpin` and `canStop` as
  on/off pills.
- Spin and Stop buttons, `disabled` bound to the guards.
- Reels table: each reel's phase, position (2 dp), stop index and settle
  `<progress>`. This is where the linear model numbers can be compared with the
  eased motion in the other quadrants.
- Window: a 3x5 grid of small symbol images, the current path's cells
  highlighted.
- Wins: a `<List>` of paths (symbol, rows, payout), the current step's row
  highlighted, shown once the reels land. During a spin, a "Peek" `<details>`
  shows the result the model already decided.
- Paytable, collapsed.

Numbers that change every frame are formatted only when their displayed value
changes, keeping `refresh` free of per-frame allocation.

### 5.5 Terminal (`views/terminal/`)

`TerminalView({ model })`, HTML JSX styled as a terminal: a transcript, a live
area, and a prompt with an input. Its logic is in a view model,
`createTerminalViewModel({ model })`, tested on its own:

- **Commands:** `spin` (Enter on an empty line repeats the last command),
  `stop`, `balance`, `paytable`, `help`, `clear`. Unknown commands and
  failed guards say why ("can't spin: a spin is in progress", "not enough
  credits").
- **A running command:** `spin` awaits the model's promise; until it resolves
  there is no prompt, and Ctrl+C stops, as in a shell.
- **Spins from anywhere:** by watching `spinCount`, `phase` and the
  celebration step, it logs every spin, including ones started from the other
  views: the bet, the landed window as a box of labels, each path as it is
  celebrated (`CHERRY x4  rows 1-2-1-3  +30`), the total.
- **Live area:** the reels turning, as ASCII, while a spin runs; rebuilt only
  when a reel's whole-symbol position changes.
- Up and down recall history. A small ASCII banner greets the user.
- The transcript is capped, and the view rewrites its text only when it
  changes.

Transcript, history and the running command are the terminal's own UI state,
not domain state; the view model holds them, as a view model may.

## 6. Tests

| File | Covers |
| --- | --- |
| `reel-model.test.ts` | spins at 20 positions/s; starts settling on schedule; lands exactly on its stop; hurry from spinning and from settling |
| `evaluate-ways.test.ts` | hand-made windows: 3/4/5 of a kind, wild substitution, path counts up to 243, no win across a gap, ordering |
| `compute-return.test.ts` | RTP 115-125% and hit-rate band for the shipped data; agrees with a Monte Carlo run of the model |
| `celebration-model.test.ts` | steps at the set pace, finishes, cut short |
| `fruit-machine-model.test.ts` | guards in every phase; wallet accounting; the promise resolves on idle, after landing or celebrating; stop in each phase; game over, and that nothing leaves it |
| `terminal-view-model.test.ts` | each command; guard messages; logging a spin started elsewhere; the prompt held while a spin runs |
| `control-panel-view.test.ts` | buttons follow the guards; clicking calls the action |
| Pixi leaf views, as worthwhile | `SpinButtonView`'s modes; `ReelView`'s sprite textures at a given position |

## 7. Files

```
site/demos/fruit-machine/index.html
site/src/demos/fruit-machine/
├── README.md
├── main.ts
├── data/        index.ts, reel-strips.ts, paytable.ts, machine-constants.ts
├── models/      index.ts, symbol-kind.ts, random.ts, reel-model.ts, evaluate-ways.ts,
│                compute-return.ts, celebration-model.ts, fruit-machine-model.ts (+ tests)
└── views/
    ├── index.ts
    ├── art/       palette.ts, symbol-svgs.ts, symbol-names.ts, load-symbol-art.ts
    ├── pixi/      pixi-machine-view.tsx and its child views
    ├── three/     bandit-view.tsx and its child views
    ├── panel/     control-panel-view.tsx
    └── terminal/  terminal-view.tsx, terminal-view-model.ts (+ test)
```

Also changed: `site/vite.config.ts`, `site/demos/index.html`, `notes/README.md`.

## Open Questions

None. The plan's questions were answered on 2026-10-03; see Settled
questions.

## Implementation Steps

Each step ends with `npm run lint`, `npm test` and `npm run build` passing.

1. ~~**Data and models**, with their tests, tuning strips and paytable to the
   RTP band. Review the model before any view is built.~~ Done.
2. ~~**Page and loop:** the page, its build input, the gallery link, and
   `main.ts` driving the model and four placeholder views.~~ Done, with the
   real views rather than placeholders.
3. ~~**Art:** palette, symbol SVGs and loader; review the art (shown first in
   the panel, the cheapest place to see it).~~ Done; reviewed as a rendered
   contact sheet.
4. ~~**Control panel**, with its test.~~ Done.
5. ~~**Terminal** and its view model, with tests.~~ Done.
6. ~~**Pixi machine**, layer by layer in the order of 5.2.~~ Done.
7. ~~**three.js bandit**: cabinet and drums, then lever, turntable and lamps.~~
   Done.
8. ~~**Polish and review:** responsive layout, a check for per-frame
   allocation in `refresh`, a pass with the code-review skill.~~ Done.
9. ~~**README** (what each quadrant shows, the easing point, the async action,
   the RTP figures) and the notes index.~~ Done.

## What Changed from the Plan

Recorded so the plan above still reads as it was agreed.

- **Art (5.1).** `SymbolArt` is `canvasFor`, `blurredCanvasFor` and `urlFor`.
  The planned strip canvases went: the drums paint their own textures from
  the symbol canvases, since a drum lying on its side needs each picture
  turned a quarter turn and the strip laid out round it.
- **Pixi (5.2).** A paytable strip down the left was added. The win banner
  sits over the title, which it hides while it shows, not across the bottom
  of the window, where it covered the bottom row being celebrated. Win frames
  are gold: white was lost on the cream reels.
- **three.js (5.3).** Three symbols of 28 must fill the window, so the drums
  have a radius of 2.4 units and the cabinet is deep. The lever stands out on
  a bracket, well forward, so it stays in sight as the cabinet sways. A
  credit display under the window shows the balance and win; the top sign
  says GAME OVER at the end, in place of a TILT lamp. Lights live in the view,
  the camera in `main.ts`. The view listens for drags on the canvas itself and
  releases its listeners when destroyed; a press that moves more than 6 pixels
  is a drag, so it doesn't pull the lever.
- **Terminal (5.5).** While a spin it started runs, it accepts `stop` as well
  as Ctrl+C.
- **Tests (6).** Also: `lever-view.test.ts`, `reel-view.test.ts`,
  `ascii-art.test.ts`, and `shared-helpers.test.ts` for the landing eases, lit
  cells and formatting. 94 tests in all. The top-level Pixi and three.js views
  aren't unit tested (they need canvases, which happy-dom lacks); they were
  checked in headless Chrome, through every input: the Pixi button, the panel
  buttons, the terminal, the lever, stopping and dragging.

## Acceptance Criteria

- [x] One model drives four views on one page, in one loop; any view's input
      is reflected by all four
- [x] Rules as in section 1; RTP 115-125% asserted by an exact test
- [x] Game over below one bet, shown by every view; under about 5% of
      players reach it within 100 spins
- [x] `spin()` resolves when the machine is idle; `stop()` cuts a spin or a
      celebration short without starting a spin; `canSpin` and `canStop` guard
      both
- [x] Timeline as in section 2.4: 20 positions/s, settling from 1 s, 0.5 s
      apart, 0.5 s eased landings
- [x] Celebration steps through every winning path in Pixi, three.js, the
      panel and the terminal
- [x] The landing ease lives in the views, not the model
- [x] Pixi, three.js and HTML views written in JSX, composed from child views
- [x] Shared flat symbol art, 2-3 tones per symbol, used by Pixi and three.js
- [x] 3D cabinet sways, turns by drag, and spins or stops from its lever
- [x] Terminal: `spin` and Enter, ASCII output, logs spins from every view
- [x] Model and view-model tests as in section 6
- [x] README, gallery link, build input and notes index updated

## Progress Log

- 2026-10-03: Created from the user's notes, with four scope decisions
  agreed (above). Plan awaiting review.
- 2026-10-03: Open questions answered (see Settled questions): the landing
  jumps; 10 bets to start and game over below one bet, with no top-up; the
  rest as proposed.
- 2026-10-03: Moved to active. Step 1 done: data (`data/`) and models
  (`models/`), 54 tests passing, lint and types clean. RTP 119.5%, hit rate
  81%, game over within 100 spins 3.3% (see "What tuning found" in 2.3). The
  tests found one bug on the way: a reel's spin started from its new stop
  rather than where it was. The seeded random numbers scramble the seed
  first, so neighbouring seeds don't start alike. Awaiting review before the
  views.
- 2026-10-03: Moved, at the user's request, to its own worktree and branch
  (`fruit-machine-demo`, from `vnext` at `dd3ec54`), to keep it apart from
  other work in the main checkout.
- 2026-10-03: Steps 2-9 done. The page runs the four views from one model in
  one loop; 94 tests pass; lint, types and the production build are clean.
  Checked in headless Chrome (one profile, reused). See "What Changed from the
  Plan". Done.
- 2026-10-04: Brought into the main worktree for review. Changes from
  playtesting: `stop()` during a spin now only lands the reels, and the win
  is celebrated as usual; a second `stop()` cuts the celebration short (the
  plan's 2.4 had a stop during a spin skip the celebration). The panel's
  window is dark, and the panel and terminal keep room for their scrollbars.
  The terminal moved to top right, the 3D machine to bottom right. The
  cabinet is repainted dark yellow, with deep cherry bands and top box,
  chrome trim and a near-black base, in physically based materials
  (clear-coated paint, polished chrome, glass over the window) reflecting a
  dimmed `RoomEnvironment`, in place of the toon shading. The cabinet's sway
  is halved, to about 7.5 degrees either way.
- 2026-10-04: More playtesting: the cabinet is a traditional golden yellow
  rather than mustard, its lettering a light blue, yellow's complement; the
  front decals sit higher, clear of the lower band, and the right-hand one is
  grapes, since the gold wild was lost on the yellow paint.
- 2026-10-04: The cabinet's bands and top box are now watermelon pink (after
  a try in the blueberries' blue that didn't look right), and the lamp the
  symbols' leaf green, both taken from the art's palette; the lever knob
  stays red.
- 2026-10-04: Fixed flicker at the 3D window's edges: z-fighting between the
  chrome trim and the frame round the opening, whose faces lay in the same
  planes. The trim now reaches 0.03 units into the window (`TRIM_LIP`).
- 2026-10-04: The cabinet is lemon yellow; its lettering is the pale blue of
  a blueberry's highlight (the full blueberry blue was too dark on the black
  panels), and its lamp orange, in place of the leaf green, which clashed
  with the warm yellow and pink. All from the symbols' palette.
- 2026-10-04: The wild symbol has a rainbow background: a rounded tile of
  diagonal stripes in the six fruits' colours behind its star (the one symbol
  over the three-tone limit, on purpose). An arch and concentric rings were
  tried first; the star hid too much of each.
- 2026-10-04: The wild's gold star was lost on the rainbow, so it went: the
  wild is now big white WILD lettering with a dark outline on the stripes (a
  white star was tried too, but the word was cramped inside it). The starting
  balance is now four bets (the user's change): about a fifth of players see
  game over within 20 spins. Tests now take their expected values from the
  constants, and the game-over test checks the machine's steadiness from an
  explicit ten bets, so tuning a constant no longer breaks them.
