# Proposal: visual snapshot tests for views

> Let a view's tests be short pieces of code that pose it: build the view
> from fixed bindings (or a model in a known state), advance its time if it
> has presentation state, and return it. The test system finds every such
> test, draws each view once in a real browser, takes a picture, and
> compares it with a reference picture committed beside the test. A change
> in how a view looks fails its test with a diff image; an intended change
> is accepted with one command and reviewed like any other change. Built on
> Vitest's browser mode (`toMatchScreenshot`, Playwright's Chromium), in a
> project of its own so `npm test` stays fast and browser-free, with one
> browser profile reused between runs so it cannot lock the machine's
> account.

**Status:** proposed. Nothing is built. The design depends on a few things
that can only be measured: that Playwright's Chromium draws Pixi and
three.js the same way every run, how long a pose takes, and whether a
reused profile avoids the failed Windows logon. Step 1 is a spike that
measures them, and records the results here before anything else is built.

**Written:** 2026-10-05, against branch `036` at `4c3fd85`. Draws on the
workshop's version of the same idea (`mvt-workshop`, Lab 02, Experiment 2.1,
`src/labs/lab-02-testable-models/lab-02-experiments.mdx`), and its solution
on the workshop's `solutions-and-extras` branch at `604535d`. Vitest's
features are as its documentation described them on this date (Vitest 5;
the repo has 5.0.1). Nothing was measured for this proposal.

**Related:**
[Testing Views](../../packages/docs/building-with-mvt/iterating-with-confidence/testing-views.md)
and [Testing](../../packages/docs/building-with-mvt/iterating-with-confidence/testing.md)
(the docs this makes true),
[`packages/website/scripts/headless-chrome.ts`](../../packages/website/scripts/headless-chrome.ts)
and [`packages/website/src/snapshot.ts`](../../packages/website/src/snapshot.ts)
(the thumbnail pipeline, which already starts entries headless and
photographs them),
[036 section 9](../archive/036-website-arcade.md#9-thumbnails) (thumbnails),
[022 section 11.1](./022-renderer-agnostic-jsx.md#111-a-plain-object-jsx-target-for-tests-recommended-first) (a plain-object JSX target
that offered tree snapshots, deleted unused),
[018](../archive/018-one-view-convention.md) (whose views were checked by
eye because headless Chrome drew the canvas blank),
[`vitest.config.ts`](../../vitest.config.ts).

## Summary

| # | Decision | Section |
| --- | --- | --- |
| 1 | A visual test is one call, `visualTest(name, pose, options?)`, in a `*.visual.ts(x)` file beside the view. `pose` returns the view, built and advanced. Grouping is Vitest's own `describe` | [3](#3-writing-a-visual-test) |
| 2 | Time is advanced in the pose, with one helper, `advanceTime({ models, views, totalMs })`, which ticks models then views in frame-sized steps, as the host does | [3.2](#32-presentation-state-advancetime) |
| 3 | Run by Vitest's browser mode with the Playwright provider and Chromium, comparing with `toMatchScreenshot`. Not Playwright Test (the workshop's choice), and not a runner of our own on `headless-chrome.ts` | [4](#4-running-them-vitest-browser-mode) |
| 4 | A second Vitest project, `visual`. `npm test` runs only `unit`, as now; `npm run test:visual` and `npm run test:visual:update` run and accept the pictures | [4.2](#42-two-projects-and-the-commands) |
| 5 | One renderer per test file, reused by each test in it: a page has room for only a handful of WebGL contexts | [4.4](#44-one-renderer-per-file) |
| 6 | Every source of variation is pinned: a seeded `Math.random`, no wall-clock time, device scale 1, a fixed background, CSS animations off, software WebGL, and Chromium's version fixed by the lockfile | [5](#5-the-same-pixels-every-run) |
| 7 | Strict comparison: no mismatched pixels allowed by default, with a small per-pixel colour tolerance, unless step 1 measures noise | [6.1](#61-how-strict) |
| 8 | References live in `__screenshots__/` beside each test file, committed, named per browser and platform. Failures leave the actual picture and a diff under `.vitest/`, ignored by git | [6.2](#62-where-the-pictures-live) |
| 9 | One persistent browser profile per checkout (`persistentContext`), so a run costs no failed Windows logon, and no loops of runs | [7](#7-the-browser-on-this-machine) |
| 10 | Local only at first. CI later, on a Windows runner if step 1 shows its pixels match, otherwise not until a pinned Linux environment owns the references | [8](#8-ci) |
| 11 | Whole entries get a visual test each for free, from the code the thumbnail page already uses to start and advance them | [9](#9-whole-entries-for-free) |
| 12 | The existing scene-graph view tests stay. They test behaviour (which symbol a reel shows), not looks | [10](#10-what-stays-and-what-changes) |

## 1. Background

### 1.1 What view tests do now

The repo has 22 view test files (`git ls-files | grep views/.*\.test`).
All of them run in Node, build a view from fixed bindings, call
`refreshView`, and assert properties of the display objects:
`ReelView` checks which texture each sprite shows, `CityView` checks that a
chunk's `y` follows the scroll, `FlockView` checks a mesh's position and
heading. They are useful, and fast, and they test behaviour a picture would
show only indirectly.

None of them checks what a view looks like. The docs say otherwise.
[Testing](../../packages/docs/building-with-mvt/iterating-with-confidence/testing.md)
says "This project uses ... Playwright for visual snapshot tests", and
[Testing Views](../../packages/docs/building-with-mvt/iterating-with-confidence/testing-views.md)
describes a `/test-harness?view=door&advanceMs=200` page and
`toHaveScreenshot` calls. None of that exists. Task 015 wrote the page as
guidance, and nothing was built to match. No package depends on
Playwright.

Visual changes have been checked by eye. 018 records the attempt to
automate it: headless Chrome drew the Pixi canvas blank, so the check was
done by playtesting, and "automating it would need a browser driver such
as Playwright". The thumbnail pipeline (036 section 9) later solved the
blank canvas for its own purposes, by drawing WebGL on the GPU
(`--enable-gpu`), and showed that the repo's entries can be started
headless, advanced in frame-sized steps, and photographed reliably.

### 1.2 What we want

A view test that reads like a unit test and says only what matters: here
is the view, in this state. Everything else (finding the tests, drawing,
capturing, comparing, reporting, accepting) belongs to the test system,
written once.

The architecture makes this unusually cheap. A view is a function of its
bindings. Its presentation state starts valid at construction and advances
only through `update(deltaMs)`. Models advance only through
`update(deltaMs)`, never on the wall clock. So a posed view is
deterministic by construction: the same bindings and the same steps give
the same frame, with no waiting, no timers and no mocking of time. What
remains to pin down is the browser.

## 2. The workshop's version

The workshop (`mvt-workshop`) poses the same problem as an exercise:
"build a system that lets you write visual tests that feel as natural as
unit tests". Its solution, on the `solutions-and-extras` branch, works, and
has seven references for three views. It has four parts:

- **A registry**, `src/[system]/utils/visual-test.ts`. `visualSuite(name, body)`
  and `visualTest(name, create)` push `{ suite, name, create }` records into
  a module-level list.
- **A harness page**, `visual.html` and `src/visual/harness.ts`. It
  imports every `*.visual.ts` with `import.meta.glob(..., { eager: true })`,
  makes one 480 by 360 Pixi `Application`, and publishes the registry and a
  `__renderVisual(suite, name)` function on `window`. Rendering a test
  removes and destroys the last view, creates the next, centres it on the
  canvas, calls `app.render()` twice (the workshop's views fill themselves
  in `onRender`), and waits a frame.
- **A Playwright Test runner**, `src/visual/visual.runner.ts`. One test
  opens the page, reads the registry, and for each entry calls
  `__renderVisual`, waits 80 ms, and calls
  `expect.soft(canvas).toHaveScreenshot(file)`.
- **A config**, `src/visual/playwright.config.ts`, starting the Vite dev
  server, with `maxDiffPixelRatio: 0.002` and a comment worth keeping:
  "Loose ratios (e.g. 2%) miss real regressions like a text colour change."

Its test files look like this, and this proposal keeps the shape:

```ts
visualSuite('ToggleSwitchView', () => {
    visualTest('on', () => new ToggleSwitchView({ isOn: () => true, label: () => 'Music' }));
    visualTest('off', () => new ToggleSwitchView({ isOn: () => false, label: () => 'Music' }));
});
```

What to keep:

- **The authoring shape.** A file beside the view, one call per state, a
  factory that returns the view. Its test files carry one-line comments
  saying why each pose is deterministic ("the slide transition only animates
  on a change; a freshly-built toggle renders at its resting position"),
  which is the right habit.
- **The tight tolerance**, and the reason for it.
- **Committed references, `test:visual` and `test:visual:update`.**

What to change, and why:

- **Two runners and a bridge between them.** Playwright Test runs in Node
  and cannot import the browser-side registry, so the harness publishes it
  on `window`, and the runner makes one test of all the poses, with
  `expect.soft` so one failure does not hide the rest. A failure is then one
  red test with a list inside it; filtering to one pose, or watching one
  file, is not possible. Vitest's browser mode runs the test file itself in
  the page, so each pose is a real test: named, filterable, watchable,
  reported on its own (section 4.1).
- **Waiting by time.** `waitForTimeout(80)` and "render twice" stand in
  for knowing when the frame is done. Here a view's frame is done when
  `refreshView` returns and the renderer has drawn; nothing needs to wait
  but the compositor, and `toMatchScreenshot` already retries until two
  captures agree.
- **Centring on a fixed canvas.** The workshop builds every view around
  the origin and centres it in 480 by 360. This repo's views are drawn from
  their top-left, at many sizes, from a 20 pixel HUD line to a 960 by 540
  machine. The canvas fits the view's bounds unless the test gives a size
  (section 4.5).
- **`visualSuite`.** Vitest's `describe` already groups tests, and its name
  becomes part of the reference's file name.
- **Pixi only.** This repo has three renderers. The design covers Pixi and
  HTML from the start and three.js in a later step (section 3.5).
- **A fresh profile every run.** Playwright's default launch makes a new
  browser profile each time, which on this machine is a failed Windows
  logon each time (section 7).

## 3. Writing a visual test

### 3.1 A leaf view

`SpinButtonView` has four modes, each its own colour and label. Its visual
test, beside it, as `spin-button-view.visual.tsx`:

```tsx
import { describe } from 'vitest';
import { visualTest } from '#testing';
import { BUTTON_RADIUS } from './pixi-layout';
import { SpinButtonView, type SpinButtonMode } from './spin-button-view';

const MODES: readonly SpinButtonMode[] = ['spin', 'stop', 'skip', 'disabled'];

describe('SpinButtonView', () => {
    for (const mode of MODES) {
        visualTest(mode, () => SpinButtonView({ mode: () => mode, radius: BUTTON_RADIUS }));
    }
});
```

That is the whole test. It gives four references,
`__screenshots__/spin-button-view.visual.tsx/SpinButtonView-spin-chromium-win32.png`
and so on. The canvas is the button's bounds plus a small margin
(section 4.5). Its sizes come from the layout constants, as the unit tests'
expected values do, so retuning the button changes the picture, which is
the point, and not the test.

The held-down state comes from pointer events, not bindings, so it cannot
be posed this way. That is fine: a pose covers what bindings and time can
reach, and a view's private reaction to the pointer belongs to the
pointer's own tests, or to a playtest.

### 3.2 Presentation state: `advanceTime`

`WinBannerView` counts up to the win, as presentation state: it starts at
the amount it sees when built, and its update step moves the shown amount
towards the bound one. To photograph it mid-count, the win has to arrive
after the banner is built, and time has to pass:

```tsx
describe('WinBannerView', () => {
    visualTest('counting up, 300 ms in', async () => {
        let amount = 0;
        const view = WinBannerView({ isShown: () => true, amount: () => amount, caption: () => CAPTION });
        amount = WIN;
        await advanceTime({ views: [view], totalMs: 300 });
        return view;
    });
});
```

`advanceTime` is the docs' helper of the same name
([Testing Models](../../packages/docs/building-with-mvt/iterating-with-confidence/testing-models.md)),
extended to views, and taking its inputs by name:

```ts
export interface AdvanceTimeOptions {
    readonly totalMs: number;
    /** Each step: every model's `update`, in order... */
    readonly models?: readonly { readonly update: (deltaMs: number) => void }[];
    /** ...then `updateView` on every view. */
    readonly views?: readonly View[];
    /** Default 16, a frame at 60 frames a second, as the thumbnail page steps. */
    readonly stepMs?: number;
}

export function advanceTime(options: AdvanceTimeOptions): Promise<void>;
```

Each step runs the models' `update`, then `updateView` on each view, then
awaits a microtask, so a model with an internal `await` (as the docs'
helper allows for) moves on. It does not refresh: the harness refreshes
once, before it draws, as the host does once per frame. A view's first
`refresh` may come before its first `update`, which the rules already
require to work, so a pose with no time is just as valid.

The steps are small for the reason the thumbnail page gives: "models with
phases or timelines are not leap-safe: one giant step would skip what
happens between". That holds for view models too.

The helper goes into the same module as `visualTest` and is equally usable
from the Node unit tests, which today each write their own loop
(`FlockView`'s `frame()`, for one). Moving those to it is optional.

### 3.3 A top-level view, through its model

A top-level view takes the model. The pose builds the model, plays it to
the moment wanted, and returns the view:

```tsx
describe('Crumb Chase GameView', () => {
    visualTest('two seconds in', async () => {
        await textures.load();
        const model = createGameModel({ grid: MAZE_DATA, mouseSpawn: MOUSE_SPAWN, catSpawns: CAT_SPAWNS, penExit: PEN_EXIT });
        const view = GameView({ model });
        await advanceTime({ models: [model], views: [view], totalMs: 2000 });
        return view;
    }, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: true });
});
```

`textures.load()` works because the visual project runs under the
website's Vite config, whose spritesheet plugin serves the textures (section
4.2). The size is the game's screen, not its bounds, and `pixelArt` draws
it as its entry does: nearest-neighbour textures, no antialiasing.

Six of the entries' models call `Math.random()` without a seed (Astrovoid,
Boids, Burrow Bust, Dojo Duel, Galaxy Raiders, Kwazy Cactii). The harness
seeds it for every test (section 5), so those poses are deterministic too,
without touching the models.

### 3.4 An HTML view

An HTML view returns an element. The pose imports the view's stylesheet,
as its entry does, since the view's looks are half in CSS:

```tsx
import '../../fruit-machine.css';

describe('ControlPanelView', () => {
    visualTest('ready to spin', async () => {
        const art = await loadSymbolArt();
        const model = createFruitMachineModel({ seed: SEED });
        return ControlPanelView({ model, art });
    });
});
```

The harness puts the element in a host `<div>` that shrinks to fit it (or
takes the given size), and photographs the host. Styles from one test file
stay in that file's page, since Vitest gives each test file a page of its
own.

### 3.5 A three.js view

A three.js view returns an `Object3D`, and needs a camera, and usually
light, to be seen. Its options name them:

```tsx
visualTest('lever at rest', () => LeverView({ ... }), {
    width: 320,
    height: 320,
    camera: () => cameraLookingAt(LEVER_CENTRE),
    environment: 'room',
});
```

`environment: 'room'` gives it the `RoomEnvironment` the fruit machine
lights its bandit with; without one, nothing shines. three.js support is a
later step (step 5): Pixi and HTML cover most views, and a three.js
view's look depends on more of its entry's setup, which the step decides
how much to share.

### 3.6 The API

```ts
export type Pose<V> = () => V | Promise<V>;

export interface PixiPictureOptions {
    /** The canvas's size in CSS pixels. Default: the view's bounds after its first refresh, plus a margin. */
    readonly width?: number;
    readonly height?: number;
    /** Default: one dark grey, the same for every test, so transparent areas show. */
    readonly background?: number;
    /** Nearest-neighbour textures and no antialiasing, as a pixel-art entry is drawn. Default false. */
    readonly pixelArt?: boolean;
    /** Default 1. */
    readonly resolution?: number;
    /** Overrides the comparison's tolerance (section 6.1). */
    readonly tolerance?: PictureTolerance;
}

export interface HtmlPictureOptions {
    readonly width?: number;
    readonly height?: number;
    readonly background?: string;
    readonly tolerance?: PictureTolerance;
}

export interface ThreePictureOptions {
    readonly width: number;
    readonly height: number;
    readonly camera: () => Camera;
    readonly environment?: 'room';
    readonly background?: number;
    readonly tolerance?: PictureTolerance;
}

export function visualTest(name: string, pose: Pose<Container>, options?: PixiPictureOptions): void;
export function visualTest(name: string, pose: Pose<HTMLElement>, options?: HtmlPictureOptions): void;
export function visualTest(name: string, pose: Pose<Object3D>, options: ThreePictureOptions): void;
```

The kind of view is told apart at run time by what the pose returns
(`instanceof Container`, `Object3D` or `HTMLElement`); the overloads make
the options match at compile time. A three.js pose without a camera does
not compile.

It lives in the website, at `packages/website/src/testing/`, imported as
`#testing` (a second entry in the package's `imports`, beside `#shared`).
It is kept out of `#shared` because it imports Vitest, which must never
reach the site's bundle. Only the website has views to photograph today;
section 11 asks whether it should become a package.

## 4. Running them: Vitest browser mode

### 4.1 Why Vitest

| | Vitest browser mode (recommended) | Playwright Test (the workshop) | Our own, on `headless-chrome.ts` |
| --- | --- | --- | --- |
| Finding tests | Vitest's include glob | A registry, published on `window` by a harness page | Our own glob, and a registry |
| Where the test runs | In the page: the pose is ordinary code | In Node, driving a page that holds the poses | In Node, driving a page |
| One pose, one test | Yes: named, filterable (`-t`), watchable | No: one test loops over every pose | Ours to build |
| Comparing | `toMatchScreenshot`, pixelmatch, retries until stable | `toHaveScreenshot`, mature | `pngjs` (already a dependency) and pixelmatch, ours to wire |
| Accepting | `--update` | `--update-snapshots` | Ours to build |
| Diffs on failure | Reference, actual and diff images under `.vitest/` | Same, in its HTML report | Ours to build |
| Browser | Playwright's Chromium, version fixed by the lockfile | Same | The installed Chrome, which updates itself |
| Profile | `persistentContext` (Vitest 4.1 and later) | Fresh per launch, unless a custom fixture | One persistent profile, already |
| New dependencies | `@vitest/browser-playwright`, `playwright`, a Chromium download | `@playwright/test`, a Chromium download | `pixelmatch` |
| Runners in the repo | One (Vitest, as now) | Two | One, plus a script |

Vitest wins on the thing the user asked for: tests that read like unit
tests, because they are unit tests, run by the same runner, in the same
style, with the same `describe`, `-t` and watch mode. The comparison,
update and diff machinery is built in. And because the test runs in the
page, there is no harness page, no registry, and nothing published on
`window`.

Our own runner is the fallback if step 1 finds that Playwright's Chromium
cannot draw the repo's WebGL reliably. It reuses a profile safely today and
draws on the GPU. Its cost is that every convenience above is ours to
build, and that the installed Chrome updates itself, so references would
change under us without a commit to blame.

Playwright Test is ruled out: everything it offers, Vitest's browser mode
offers through the same Playwright, without a second runner.

### 4.2 Two projects, and the commands

The root `vitest.config.ts` becomes two projects:

- **`unit`**: everything that runs now, in Node, unchanged.
- **`visual`**: `**/*.visual.{ts,tsx}`, in browser mode, with the Playwright
  provider and one Chromium instance. Its Vite config is the website's
  (`packages/website/vite.config.ts`), merged, so the spritesheet and entry
  facts plugins serve what the views load, and `@mvtjs/source` resolves the
  libraries to their source as everywhere else.

The suffix `.visual.ts` (not `.visual.test.ts`) keeps the files out of the
`unit` project's default include without an exclude, and says at a glance
which kind of test a file holds.

| Command | Runs |
| --- | --- |
| `npm test` | `vitest run --project unit`: as now, no browser |
| `npm run test:visual` | `vitest run --project visual`: draws and compares every visual test |
| `npm run test:visual:update` | The same with `--update`: accepts every picture that differs, and writes new ones |
| `npm run test:visual -- -t SpinButton` | One group, as with any Vitest run |

`npm test` stays browser-free on purpose. It runs often, by people and by
agents, in CI and in worktrees, and a browser launch per run is slower,
needs the Chromium download, and on this machine has a cost of its own
(section 7). A visual run is something to do before committing a change to
how something looks, and after an upgrade of Pixi, three.js or Chromium.

### 4.3 What `visualTest` does

For each test, in the test file's page:

1. Seeds `Math.random` (section 5).
2. For a pixel-art pose, sets `TextureSource.defaultOptions.scaleMode` to
   `'nearest'` before the pose runs, since textures take it when they are
   made.
3. Runs the pose, and awaits it.
4. Calls `refreshView(view)`.
5. Mounts the view: on the file's Pixi stage, resized to the canvas size
   (section 4.5), in a host `<div>`, or in the file's three.js scene.
6. Draws once: `app.render()`, or the three.js renderer's `render`, or
   nothing for HTML.
7. Calls `expect.element(page.elementLocator(canvasOrHost)).toMatchScreenshot()`.
   Vitest names the reference from the test's full name, captures until two
   pictures agree, and compares with the reference.
8. Unmounts and destroys the view (`destroy({ children: true })`,
   `destroyObject`, `destroyElement`), in a `finally`, so a failed pose
   does not leave its view behind for the next.

No ticker runs. The Pixi `Application` is made with `autoStart: false`, as
the thumbnail page and the fruit machine make theirs, so nothing draws but
step 6.

### 4.4 One renderer per file

Vitest runs every test in a file in one page. A page keeps only a handful
of WebGL contexts alive (Chrome's limit is about 16) and drops the oldest
past that, so a Pixi `Application` per test would start losing canvases
partway through a long file. The harness makes one Pixi `Application` per
file on first use, and resizes it per test; likewise one three.js
renderer. Antialiasing is fixed when a context is made, so a file that
mixes pixel-art and smooth poses gets two applications, made on demand.

In practice a test file is one view, or one entry's views, and an entry is
either pixel art or not.

### 4.5 Sizing

Without a size, the canvas is the view's local bounds after its first
refresh, rounded out to whole pixels, plus a small fixed margin (so an
antialiased edge or a glow at the bounds is in the picture). The view is
moved by the bounds' top-left, so a view drawn around its origin, like the
spin button, is framed the same as one drawn from its corner.

A size, when given, is used as is, and the view stays where it put itself:
the right thing for a top-level view of a fixed screen.

The default has a consequence worth wanting: a view that grows or shrinks
changes the picture's size, and so fails its test, even if every pixel it
used to draw is unchanged.

## 5. The same pixels every run

A visual test is only useful if a pass means "unchanged". Every source of
variation found in this repo, and how it is pinned:

| Source | In this repo | Pinned by |
| --- | --- | --- |
| Model time | Models advance only through `update` | The rules; `advanceTime`'s fixed steps |
| View presentation time | Views advance only through their update step | The same |
| Unseeded random numbers | Six entries' models (eight files) call `Math.random()`. No view does (searched 2026-10-05) | The `visual` project's setup file replaces `Math.random` before each test with a small seeded generator, reset to the same seed per test |
| Seeds picked by a page | The fruit machine's load picks its seed with `Math.random()` | Same |
| Wall clock in a view | None found (`performance.now`, `Date.now`, `requestAnimationFrame` in views) | Lint (`@mvtjs/no-wall-clock`) covers models only; a pose that needs a view's wall clock is a bug in the view |
| CSS transitions and animations | HTML views use them | Screenshots taken with animations disabled (Playwright's `animations: 'disabled'`, passed as a screenshot option); transitions finish at once |
| Text caret, focus rings | The Arcade's search box | `caret: 'hide'`; poses do not focus elements unless that is the state photographed |
| Fonts | System fonts: `monospace` in most HUDs, `"Segoe UI", ...` in the fruit machine | References are per platform (the file name carries it); `document.fonts.ready` is awaited before drawing |
| Device pixel ratio | Varies by screen | Context option `deviceScaleFactor: 1`, and `resolution` 1 by default |
| GPU and driver | Thumbnails draw on the GPU | Visual tests draw with software WebGL (SwiftShader, Playwright's headless default), the same on any machine. Step 1 confirms which backend runs, and the setup logs its renderer string |
| Browser version | Chrome updates itself | Playwright's Chromium, its version fixed by the lockfile. An upgrade is a commit, and may come with a commit of new references |
| Canvas size | Varies by view | Section 4.5 |
| Background | Transparent canvas over whatever is behind | One fixed background colour |

The GPU row is a choice, not a default to accept unexamined. The site runs
on the GPU, and the thumbnails are taken on it. But a visual test asks
whether a view has changed, not whether a GPU draws it well, and software
rendering gives the same answer on every machine, including a CI runner
with no GPU. If step 1 finds that SwiftShader draws something wrongly (a
blend mode, a filter), the test for that view says so in its options, and
section 11 asks what to do.

## 6. Comparing and accepting

### 6.1 How strict

The workshop's experience is that loose ratios hide real regressions: 2%
of mismatched pixels missed a text colour change, so it settled on 0.2%.
With every source of variation pinned (section 5), the same machine
should give the same pixels exactly, and the default here is stricter
still:

- **No mismatched pixels allowed** (`allowedMismatchedPixels: 0`).
- **A small per-pixel colour tolerance** (pixelmatch's `threshold`, its
  default 0.1), which ignores differences too small to see and the
  antialiasing pixelmatch recognises.

Step 1 measures whether that holds: the same poses, run ten times in
separate runs, should give identical pictures. If they do not, the noise
it finds sets the default, and is recorded here. A test with a known
reason to be noisy (a filter, a gradient) can loosen its own tolerance,
with a comment saying why.

### 6.2 Where the pictures live

Vitest's default, unchanged: beside each test file,

```
spin-button-view.visual.tsx
__screenshots__/
└── spin-button-view.visual.tsx/
    ├── SpinButtonView-spin-chromium-win32.png
    ├── SpinButtonView-stop-chromium-win32.png
    └── ...
```

The references are committed, like the textures and the thumbnails. On
the first run of a new test, Vitest writes the reference and reports that
it needs a review; the next run compares with it.

Size: a leaf view's picture is small (a 120 pixel button). A top-level view
of a pixel-art game is its screen at resolution 1 (Crumb Chase's is its maze
at 20 pixels a tile, plus its HUD), and PNG compresses flat pixel art well. A
hundred tests should come to a few megabytes. Step 2 records the real
figure. The guidance that follows from it: photograph leaf views, plus one
or two whole screens per entry, not every frame of every animation.

### 6.3 When a test fails

Vitest leaves three pictures: the reference, the actual picture, and a
diff marking changed pixels in red (and antialiasing in yellow), the last
two under `.vitest/attachments/`, which `.gitignore` gains. The failure
names the test, so the pose is one click away.

Then one of two things is true:

- **The change is a regression.** Fix the view, rerun.
- **The change is intended.** Run `npm run test:visual:update` (with `-t`
  to accept only the tests meant), and review the changed references
  before staging them. VS Code's source control view shows a PNG's old and
  new versions side by side, which is the review. An agent never stages
  them: as with every change, the user stages while reviewing.

The value is in that review. A reference accepted without looking is a
test that has stopped testing.

### 6.4 Orphaned references

Renaming or deleting a test leaves its reference behind; nothing reads it
again, and nothing removes it. The harness records each reference a run
compares with (through a Vitest browser command, which runs in Node), and
a full run (no `-t`, no file filter) ends by listing the `__screenshots__/`
files no test used, and failing. `test:visual:update` deletes them
instead. This is step 6, after the tests exist in numbers that make stale
files likely.

## 7. The browser on this machine

Chrome 153 and later test a new profile's Windows password by logging in
with a blank one, and Windows counts each attempt as a failed logon. A
benchmark suite that made a new profile per case locked the user out of
the machine on 2026-10-02 after about ten cases (fixed in `e433c90`).
`headless-chrome.ts` now keeps one profile in `node_modules/.cache/`
for every launch.

Playwright's default launch makes a new profile in a temporary directory
each time, so `npm run test:visual` would be a failed logon per run, and
watch mode a failed logon per restart. Vitest's Playwright provider has a
`persistentContext` option (Vitest 4.1 and later), which keeps the
profile between runs, by default in
`node_modules/.cache/vitest-playwright-user-data`. The visual project
turns it on.

What is not known yet, and step 1 checks once, carefully:

- **Whether Playwright's Chromium makes the logon attempt at all.** It is
  built from the same Chromium, so assume it does.
- **Whether a reused profile is enough.** It is for Chrome
  (`headless-chrome.ts`). The check: count failed logons in the Security
  event log (event 4625) before and after two runs.
- **Whether `persistentContext` combines with `deviceScaleFactor` and the
  other context options**, and whether it limits Vitest to one test file
  at a time (one persistent context, one page at a time). If it does, the
  visual project runs its files in series, which is slower but fine at
  this size.

Each checkout has its own profile, under its own `node_modules/`. A new
worktree's first visual run is therefore one failed logon. Sharing one
profile between checkouts would avoid that, but two runs at once would
then fight over it (Chrome locks a profile in use). The proposal accepts
one logon per new checkout, and the guidance for agents is the same as for
the benchmarks: never run visual tests in a loop, and keep to a handful of
runs per half hour.

## 8. CI

The deploy workflows run `npm test` on `ubuntu-latest`. They are
unaffected: `npm test` is the `unit` project.

Running the visual tests in CI needs references made in the CI's
environment. The platform is part of each reference's name, and a Linux
runner's fonts differ from Windows' (`monospace` is a different face, and
Segoe UI does not exist), so Linux would need a full second set, made on
Linux.

Three options:

1. **Local only.** The tests are a check to run before committing a visual
   change. Recommended to start.
2. **A Windows CI job.** `windows-latest`, Playwright's Chromium, software
   WebGL: possibly the same pixels as this machine, so the same
   references. Step 1 can test that cheaply, by running the spike's tests
   on a Windows runner once. If they match, this is the next step.
3. **Linux references, made in a pinned container.** Playwright's Docker
   image, used both by CI and for updating references (locally, or by a
   workflow that commits them). The most portable, and the most machinery.
   Only if the project gains contributors on other platforms.

## 9. Whole entries, for free

The thumbnail page (`src/snapshot.ts`) already knows how to start any
entry headless at its play size, advance it by `thumbnailAdvanceMs` in
16 ms steps, playing its `thumbnailInput`, and draw one frame. That is a
visual test of the whole entry, minus the comparison.

One file, `entries/entries.visual.ts`, can loop over the catalogue and make
one `visualTest` per entry from the same code. To share it, the page's
`start` and `advance` move into a module both import. Then every entry has
a test of its whole screen, written once, catching what no leaf test sees:
layout, layering, a view left out of its parent.

Two cautions:

- **Element entries are not instant.** The page gives them 500 ms of real
  time to lay themselves out and start their renderers, which is the one
  wall-clock wait in the pipeline, and a likely source of flakiness. Pixi
  entries come first; element entries follow when they can say when they
  are ready.
- **These tests fail on any change to an entry.** That is their job, but
  it means an entry's own commit often accepts its new reference. They
  complement leaf tests, which say what changed; they do not replace them.

## 10. What stays, and what changes

**The scene-graph view tests stay.** They test what a view does with its
bindings (the reel shows the strip from its position down; traffic stays
off the water), which a picture shows only for the cases photographed.
The docs' guidance holds: assertions for behaviour and structure,
pictures for looks. A scene-graph test that only restates looks (a tint,
an alpha) is a candidate to become a pose, when someone is in that file
anyway.

**The docs become true.** `testing.md` already says the project uses
Playwright for visual tests; it gains how (Vitest's browser mode, through
Playwright). `testing-views.md` replaces its `/test-harness?view=...`
example with `visualTest` and `advanceTime`, and its section on
presentation state with section 3.2's example. The view skill
(`skill-mvt-view.md`) asks for a `.visual.tsx` beside a new view, with a
pose per state its bindings can show. AGENTS.md's command table gains the
two commands, and the project structure page gains `__screenshots__/` and
`src/testing/`.

## 11. Open questions

1. **Should the helper be a package?** `visualTest` and `advanceTime` are
   not specific to the website, and `advanceTime` is not specific to
   visual tests. A private `@mvtjs/testing` would serve the benchmarks or a
   future package's own views, and a published one would serve users of the
   libraries. Recommendation: start in `packages/website/src/testing/`, and
   move it when a second package needs it.
2. **CI** (section 8). Recommendation: local only, then a Windows job if
   step 1's check matches.
3. **What if SwiftShader draws something wrongly?** If a view uses a
   feature software WebGL gets wrong, the options are a GPU instance for
   that file only, or leaving that view to the eye. Decide when it
   happens, if it does.
4. **Resolution 1 or 2 by default?** 1 keeps references small and is what
   pixel art wants. Smooth views lose detail at 1 that a regression could
   hide in. Recommendation: 1, with `resolution: 2` for the views that
   need it.
5. **Should `npm test` ever include the visual project?** Recommendation:
   no (section 4.2). Revisit if visual runs prove fast and the logon
   question is settled for good.

## 12. Implementation steps

1. **Spike, and measure.** Add `@vitest/browser-playwright` and
   `playwright`, install Chromium, and make the `visual` project with
   `persistentContext`. Write `visualTest` for Pixi only, and the
   spin button's four poses and one pixel-art screen (Crumb Chase, section
   3.3). Measure and record here:
   - that the canvas is not blank, and which WebGL renderer drew it;
   - ten separate runs: identical pictures, or how much noise;
   - time to start the browser, and per pose;
   - failed logons (event 4625) before and after two runs;
   - whether `persistentContext` runs files in series, and accepts
     `deviceScaleFactor: 1`;
   - optionally, one run on a GitHub `windows-latest` runner, compared
     with these references.

   If Chromium cannot draw the repo's WebGL reliably, stop and reconsider
   section 4.1's fallback.
2. **The harness.** `#testing` with `visualTest` (Pixi and HTML) and
   `advanceTime`; the setup file (seeded `Math.random`, fonts, screenshot
   options); the two projects; the three npm scripts; `.vitest/` in
   `.gitignore`. Record the size of the references.
3. **First tests.** One file per renderer to start: the fruit machine's
   Pixi leaf views (spin button, win banner counting, reel window), one
   pixel-art game screen, and one HTML view (the Arcade's card, or the
   fruit machine's control panel). Make a deliberate change to one view,
   and check that its test fails with a useful diff, and that the update
   command accepts it.
4. **Whole entries.** Move `snapshot.ts`'s `start` and `advance` into a
   module the page and `entries.visual.ts` share; one test per Pixi entry.
5. **three.js.** Camera and environment options; the fruit machine's lever
   and the boids' flock. Element entries in `entries.visual.ts`, if they
   can say when they are ready.
6. **Orphaned references** (section 6.4).
7. **Docs** (section 10), with the documentation skill: `testing.md`,
   `testing-views.md`, `skill-mvt-view.md`, AGENTS.md, the project
   structure page.
8. **CI**, if section 11's second question is decided for it.

## Settled

Do not reopen without new information.

- **Snapshots of the scene graph, not of pixels.** 022 built a plain-object
  JSX target that could print a view's tree, and deleted it unused; the
  docs argue against such snapshots at length (a tree snapshot is coupled
  to structure and blind to what reaches the screen). Pictures only.
- **Drawing in Node.** Pixi 8 and three.js draw through a browser's WebGL;
  a Node canvas or headless-gl would test a different renderer from the one
  visitors run.
- **Hosted visual review services** (Chromatic, Argos and the like). They
  would send the repo's pictures to an outside service, and cost money,
  for what a local run and a review in source control already give.
