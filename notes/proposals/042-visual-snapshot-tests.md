# Proposal: visual snapshot tests for views

> Let a view's tests be short pieces of code that pose it: build the view
> from fixed bindings (or a model in a known state), advance its time if it
> has presentation state, and return it. The test system finds every such
> test, draws each view, and compares the picture with a reference
> committed beside the test. A change in how a view looks fails its test
> with a diff image; an intended change is accepted with one command and
> reviewed like any other change.
>
> Two problems sink most visual test suites, and this design is built
> around them. **Speed:** the target is unit-test speed, hundreds of
> pictures in seconds, so that adding one is free and running all of them
> is routine. Pictures are drawn in one long-lived page, read straight
> from the renderer, hashed in the page and compared with a hash the
> reference file carries; the slow work (PNG files, diffs) happens only
> when a picture has changed. **Consistency:** the same code gives the
> same pictures on every machine, CI included. Every machine draws in one
> pinned environment, a Linux container running Playwright's browser
> server, with software WebGL, pinned fonts and locale. A fingerprint of
> that environment is committed, and checked before anything is compared.
> Runs on Vitest's browser mode.

**Status:** proposed. Nothing is built. Both headline goals rest on
numbers that can only be measured: how long a picture takes on the fast
path, and whether the container gives identical pixels on this machine and
on a GitHub runner. Step 1 is a spike that measures both, at scale, and
records the results here before anything else is built. Docker is not
installed on this machine (nor WSL), and the design needs it (section
5.3, open question 1).

**Written:** 2026-10-05, revised 2026-10-06 to put speed and consistency
first. Against branch `036` at `4c3fd85`. Draws on the workshop's version
of the same idea (`mvt-workshop`, Lab 02, Experiment 2.1,
`src/labs/lab-02-testable-models/lab-02-experiments.mdx`), and its
solution on the workshop's `solutions-and-extras` branch at `604535d`.
Vitest's and Playwright's features are as their documentation described
them on these dates (Vitest 5, the repo has 5.0.1; Playwright 1.63).
Nothing was measured for this proposal; every timing in it is an
estimate, and says so.

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
| 1 | A visual test is one call, `visualTest(name, pose, options?)`, in a `*.visual.tsx` beside the view. `pose` returns the view, built and advanced. Grouping is Vitest's own `describe` | [3](#3-writing-a-visual-test) |
| 2 | Time is advanced in the pose with `advanceTime({ models, views, totalMs })`, which ticks models then views in frame-sized steps, as the host does | [3.2](#32-presentation-state-advancetime) |
| 3 | **Speed budget:** within a few times a unit test. 500 pictures in about 10 s, start-up included; a WebGL picture about 5 ms at the median. Measured at scale in step 1, and printed by every run | [4.1](#41-the-budget) |
| 4 | **One page for the whole run** (`isolate: false`): modules load once, one WebGL context, shaders compile once, textures load once | [4.3](#43-one-page-one-renderer) |
| 5 | **No screenshots on the fast path.** Pixi and three.js pictures are read from the renderer (`readPixels`), hashed in the page, and compared with the hash stored in the reference PNG. No PNG is encoded, decoded or sent anywhere unless the hashes differ | [4.4](#44-pixels-from-the-renderer-hashes-not-images) |
| 6 | HTML views need a real screenshot: a slower path, in a project of their own that isolates each file, since their stylesheets would otherwise leak | [4.5](#45-html-the-slow-path-kept-small) |
| 7 | **One reference environment:** a Linux container (Playwright's image, pinned by digest) running Playwright's browser server. Every machine and CI connects to it; the tests and Vite stay on the host. Software WebGL, pinned fonts, locale, time zone and scale | [5.3](#53-one-reference-environment-a-pinned-container) |
| 8 | A committed **fingerprint** of that environment (browser, WebGL renderer, and the hashes of a calibration set of pictures), checked before any comparison. Elsewhere, the tests refuse to compare or update, and say why | [5.4](#54-a-fingerprint-checked-first) |
| 9 | **Exact first, tolerance second.** A pass is an identical hash. Only on a mismatch is the picture compared with a small tolerance, and a pass within tolerance is reported, not hidden | [5.5](#55-exact-first-tolerance-second) |
| 10 | References are PNGs written by our own encoder (byte-identical for identical pixels, on any machine), carrying their pixel hash in a text chunk, with no platform in their names: there is one platform | [5.6](#56-reference-files-the-same-bytes-from-any-machine) |
| 11 | Run by Vitest's browser mode, with the Playwright provider connecting to the container. A `visual` project apart from `unit`; `npm test` stays browser-free unless step 1 shows visual runs are fast enough to join it | [6](#6-running-them) |
| 12 | CI runs the visual tests on every push, in the same container, against the same references | [9](#9-ci) |
| 13 | Whole entries get a visual test each, from the code the thumbnail page already uses to start and advance them | [10](#10-whole-entries-for-free) |
| 14 | The existing scene-graph view tests stay. They test behaviour, not looks | [11](#11-what-stays-and-what-changes) |

## 1. Background

### 1.1 What view tests do now

The repo has 22 view test files. All of them run in Node, build a view
from fixed bindings, call `refreshView`, and assert properties of the
display objects: `ReelView` checks which texture each sprite shows,
`CityView` checks that a chunk's `y` follows the scroll, `FlockView`
checks a mesh's position and heading. They are useful and fast, and they
test behaviour a picture would show only indirectly.

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
blank canvas for its own purposes by drawing WebGL on the GPU, and showed
that the repo's entries can be started headless, advanced in frame-sized
steps, and photographed reliably.

### 1.2 What we want

A view test that reads like a unit test and says only what matters: here
is the view, in this state. Everything else (finding the tests, drawing,
capturing, comparing, reporting, accepting) belongs to the test system,
written once.

Two properties decide whether such a suite gets used or quietly
abandoned:

- **Speed.** The unit suite runs over 1500 tests in about 15 seconds,
  about 10 ms a test, start-up included. If a visual test costs a
  hundred times that, nobody adds the fortieth one, and nobody runs the
  suite before committing. The goal is a cost per picture close enough to
  a unit test's that adding one is not a decision.
- **Consistency.** A picture must depend on the code and nothing else: not
  the machine, its GPU, its fonts, its locale, or the browser that
  happened to update itself last night. A suite whose references only
  match on one machine fails everywhere else, and a failure people learn to
  ignore is worse than no test.

The architecture makes a good start on both. A view is a function of its
bindings. Its presentation state starts valid at construction and advances
only through `update(deltaMs)`. Models advance only through
`update(deltaMs)`, never on the wall clock. So a posed view is
deterministic by construction, and needs no waiting: the same bindings
and the same steps give the same frame, the moment `refreshView` returns.
What remains is the browser, and how much work is done per picture.

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
- **One page and one `Application` for every picture.** This is the
  workshop's best speed decision, probably by accident: modules load once
  and the WebGL context is made once. Section 4.3 keeps it.
- **The tight tolerance**, and the reason for it.
- **Committed references, `test:visual` and `test:visual:update`.**

What to change, and why:

- **Every picture is a screenshot, and waits.** Each pose costs a waited
  frame, an 80 ms sleep, and Playwright's screenshot assertion, which
  captures until two captures agree, encodes PNGs and compares them in
  Node. That is roughly 100 ms or more a picture before any drawing:
  ten times the budget. Section 4.4 replaces all of it for WebGL views.
- **Two runners and a bridge between them.** Playwright Test runs in Node
  and cannot import the browser-side registry, so the harness publishes it
  on `window`, and the runner makes one test of all the poses, with
  `expect.soft` so one failure does not hide the rest. A failure is then
  one red test with a list inside it; filtering to one pose, or watching
  one file, is not possible. Vitest's browser mode runs the test file in
  the page, so each pose is a real test: named, filterable, watchable,
  reported on its own.
- **References from whichever machine ran last.** The workshop's file
  names carry `-chromium`, but the pictures depend on the machine's fonts
  and GPU too. Section 5 makes one environment the only one.
- **Centring on a fixed canvas.** This repo's views are drawn from their
  top-left, at sizes from a 20 pixel HUD line to a 960 by 540 machine. The
  picture fits the view's bounds unless the test gives a size (section 6.5).
- **`visualSuite`.** Vitest's `describe` already groups tests.
- **Pixi only.** This repo has three renderers. The design covers Pixi and
  HTML from the start and three.js in a later step (section 3.5).

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
`__screenshots__/spin-button-view.visual.tsx/SpinButtonView-spin.png` and
so on. The picture is the button's bounds plus a small margin (section
6.5). Its sizes come from the layout constants, as the unit tests'
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
happens between". That holds for view models too. Small steps cost
little: 300 ms is 19 steps of plain function calls, no drawing.

The helper is equally usable from the Node unit tests, which today each
write their own loop (`FlockView`'s `frame()`, for one).

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
website's Vite config, whose spritesheet plugin serves the textures. It
loads once per run, not once per test, since the page lives for the whole
run (section 4.3). The size is the game's screen, not its bounds, and
`pixelArt` draws it as its entry does: nearest-neighbour textures, no
antialiasing.

Six entries' models (eight files) call `Math.random()` without a seed:
Astrovoid, Boids, Burrow Bust, Dojo Duel, Galaxy Raiders and Kwazy
Cactii. The harness seeds it for every test (section 5.1), so those poses
are deterministic too, without touching the models.

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
takes the given size), and photographs the host. HTML pictures take the
slower path (section 4.5).

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
later step (step 6): Pixi and HTML cover most views, and a three.js view's
look depends on more of its entry's setup, which that step decides how
much to share. Its pictures take the fast path, like Pixi's.

### 3.6 The API

```ts
export type Pose<V> = () => V | Promise<V>;

export interface PixiPictureOptions {
    /** The picture's size in pixels. Default: the view's bounds after its first refresh, plus a margin. */
    readonly width?: number;
    readonly height?: number;
    /** Default: one opaque dark grey, the same for every test, so transparent areas show. */
    readonly background?: number;
    /** Nearest-neighbour textures and no antialiasing, as a pixel-art entry is drawn. Default false. */
    readonly pixelArt?: boolean;
    /** Default 1. */
    readonly resolution?: number;
}

export interface HtmlPictureOptions {
    readonly width?: number;
    readonly height?: number;
    readonly background?: string;
}

export interface ThreePictureOptions {
    readonly width: number;
    readonly height: number;
    readonly camera: () => Camera;
    readonly environment?: 'room';
    readonly background?: number;
}

export function visualTest(name: string, pose: Pose<Container>, options?: PixiPictureOptions): void;
export function visualTest(name: string, pose: Pose<HTMLElement>, options?: HtmlPictureOptions): void;
export function visualTest(name: string, pose: Pose<Object3D>, options: ThreePictureOptions): void;
```

The kind of view is told apart at run time by what the pose returns
(`instanceof Container`, `Object3D` or `HTMLElement`); the overloads make
the options match at compile time. A three.js pose without a camera does
not compile.

There is no per-test tolerance option. A test that needs one is a test
whose picture is not deterministic, and section 5.5 handles the
environment-wide case; a single view that cannot be drawn the same way
twice is a finding to fix or to record, not to paper over.

The browser-side code lives in the website, at
`packages/website/src/testing/`, imported as `#testing` (a second entry in
the package's `imports`, beside `#shared`). It is kept out of `#shared`
because it imports Vitest, which must never reach the site's bundle. The
Node-side code (the browser commands, the PNG encoder, the container
script) lives in `packages/website/scripts/visual/`, beside the other
build-time tools. Only the website has views to photograph today; open
question 4 asks whether it should become a package.

## 4. Speed

### 4.1 The budget

The unit suite: over 1500 tests in about 15 s, about 10 ms a test with
start-up spread across them. A visual test does strictly more (it draws,
and reads pixels back), so matching that exactly is not realistic. Within
a few times it is, and that is the target:

| Measure | Target |
| --- | --- |
| Start-up, once per run: connect to the browser, load the page and its modules, make the renderer, compile shaders | 3 s |
| A Pixi or three.js picture, median | 5 ms |
| The same, 95th percentile (whole screens, big textures) | 25 ms |
| An HTML picture, median | 30 ms |
| Overhead per test file | 5 ms |
| 500 pictures, nine in ten of them WebGL, start-up included | 10 s |
| Watch mode: one edited view's file, re-run | under 1 s |
| `test:visual:update` with nothing changed | writes no file |

None of these is measured yet. Step 1 measures them at scale, on a
generated suite of 1000 pictures of real views, and if a target is missed,
says where the time went. Every run then prints the same figures (start-up,
median and 95th percentile per kind, the ten slowest tests), so a slow
test is noticed when it is added, not a year later.

### 4.2 Where the time goes, done the obvious way

The obvious setup (Vitest's browser mode with its defaults and
`toMatchScreenshot`) would be one to two orders of magnitude off the
budget. Estimated costs, before any drawing:

| Cost | Paid | Estimate |
| --- | --- | --- |
| A fresh iframe per test file, re-evaluating Pixi and the website's modules | Per file | 100-300 ms |
| A new WebGL context per file, its shaders compiled again, its textures loaded again | Per file | 50-200 ms |
| A screenshot: the compositor's frame, encoded as PNG in the browser | Per capture | 10-50 ms |
| Capturing until two captures agree (screenshot stability) | Per picture | At least twice the above |
| Sending the PNG to Node, decoding it, decoding the reference, comparing | Per picture | 5-20 ms |

At 500 pictures in 150 files, that is roughly one to three minutes. Each
of these costs is avoidable for a WebGL view, and the next sections avoid
them.

### 4.3 One page, one renderer

Vitest runs each test file in a fresh iframe by default. With
`isolate: false`, it runs every file in the same iframe, one after
another. Vitest's docs warn of the cost, shared state between files; a
reported example went from 7 s to 600 ms. Here it means:

- **Modules load once.** Pixi, three.js, the libraries and every view are
  evaluated once per run (per worker, section 4.6), not once per file.
- **One renderer.** One Pixi `Application` (two if both pixel-art and
  smooth pictures appear, since antialiasing is fixed when the context is
  made), one three.js renderer, made on first use and kept. Chrome keeps
  only about 16 WebGL contexts per page, so this is also what keeps a long
  run from losing its canvases.
- **Shaders compile once.** Software WebGL compiles them on the CPU, which
  is slow enough to matter if it happened per file.
- **Textures load once.** Each entry's texture registry keeps what it
  loaded, so `textures.load()` in a pose costs a check after the first.
- **Fonts settle once.** `document.fonts.ready` is awaited once, before
  the first picture.

Shared state is the price, and section 5.1 lists what the harness resets
before every test so that order cannot change a picture. A periodic run
in shuffled order (`--sequence.shuffle`) checks that it does not.

### 4.4 Pixels from the renderer, hashes not images

For a Pixi or three.js view, a picture never needs to be a screenshot.
The harness:

1. Renders the posed view into a render texture of the picture's size
   (`RenderTexture` in Pixi, `WebGLRenderTarget` in three.js), kept in a
   pool by size, so the canvas is never resized and no texture is made per
   test.
2. Reads the pixels back (`readPixels`, through Pixi's `extract.pixels`
   or three.js's `readRenderTargetPixels`). With software WebGL this is a
   memory copy; there is no compositor, no colour management and no
   PNG anywhere.
3. Hashes them in the page: SHA-256 through `crypto.subtle.digest`,
   which runs at native speed (a 960 by 540 picture is about 2 MB, a
   millisecond or two). The width and height go into the hash too.
4. Compares the hash with the reference's. The references' hashes reach
   the page once per run, as one small table (section 5.6); a passing
   test makes no call to Node at all.

Only when the hashes differ, or there is no reference, does the picture
leave the page: its pixels go to Node by a Vitest browser command, which
decides (section 7) whether it is a failure, a pass within tolerance, or,
when updating, a new reference to write. The slow work lives entirely on
that path, which a passing run never takes.

The pictures are opaque: the background is drawn first, so every pixel's
alpha is 255. That removes premultiplied alpha from the question, and
makes a transparent hole in a view show up as the background colour.

### 4.5 HTML: the slow path, kept small

An HTML view has no renderer to read back from; its picture is what the
browser composites, and only a screenshot sees that. Its pictures go
through a browser command that takes an element screenshot with
Playwright (`animations: 'disabled'`, `caret: 'hide'`, scale 1), hashes
it in Node, and compares it with the reference the same way. Estimated at
20-40 ms a picture. Two measures keep this path from dragging the rest:

- **A project of its own, isolated per file.** An HTML view's stylesheet
  is injected into the page's `<head>` when its file imports it, and
  stays there. In a shared page, one file's CSS would change the next
  file's pictures. So `*.visual.tsx` files that photograph HTML views are
  named `*.html.visual.tsx` and run in a `visual-html` project with
  isolation on, at the cost of a fresh page per file. There are few such
  views today (the Arcade's, the fruit machine's panel and terminal, the
  boids' panel).
- **Batching, if it is ever needed.** Mounting every HTML pose of a file
  side by side in fixed-size cells and taking one screenshot, cut up in
  Node, would make the per-picture cost a few milliseconds. It is left
  until HTML pictures are numerous enough to matter.

### 4.6 Parallel workers

Vitest's browser mode can run several pages at once. Each has its own
modules and renderer, so start-up is paid once per worker. Software WebGL
already spreads a draw across CPU cores, so more workers do not
necessarily mean faster runs. Step 1 measures one, two and four workers
and picks the default.

### 4.7 Cheap to add

Adding a picture costs one line of code and nothing else: no
registration, no config, no new file to wire up. The first run reports it
as new and fails; `npm run test:visual:update -- -t <name>` writes its
reference; the reference is reviewed like any other change. A view file
with five pictures adds perhaps 25 ms to a run.

## 5. Consistency

### 5.1 Within a run

The same environment must give the same picture every run, whatever ran
before it. Every source of variation found in this repo, and how it is
pinned:

| Source | In this repo | Pinned by |
| --- | --- | --- |
| Model time | Models advance only through `update` | The rules; `advanceTime`'s fixed steps |
| View presentation time | Views advance only through their update step | The same |
| Unseeded random numbers | Six entries' models call `Math.random()`. No view does (searched 2026-10-05) | Before each test, the setup file replaces `Math.random` with a small seeded generator, reset to the same seed |
| Seeds picked by a page | The fruit machine's load picks its seed with `Math.random()` | Same |
| Wall clock in a view | None found (`performance.now`, `Date.now`, `requestAnimationFrame` in views) | Lint covers models only; a pose that needs a view's wall clock is a bug in the view |
| No ticker | Pixi applications tick themselves by default | Made with `autoStart: false`, as the thumbnail page and the fruit machine make theirs; the harness draws once per picture |
| Global Pixi defaults | `TextureSource.defaultOptions.scaleMode`, set per entry | Reset before each test, then set from `pixelArt` before the pose runs |
| Left-over views | A failed pose could leave its view mounted | Unmounted and destroyed in a `finally` |
| Stylesheets | HTML views import CSS that stays in the page | HTML pictures run isolated per file (section 4.5) |
| CSS transitions and animations | HTML views use them | Screenshots taken with animations disabled; transitions finish at once |
| Text caret, focus | The Arcade's search box | Caret hidden; poses do not focus unless that is the state photographed |
| Order of tests | Shared page (section 4.3) | The resets above; a shuffled run in CI each week checks that order changes nothing |

### 5.2 Across machines: what differs

Everything in section 5.1 is within our code. Across machines, the
browser and the machine under it differ, and each of these changes
pixels:

| Source | How it differs | Effect on pictures |
| --- | --- | --- |
| **Text rasterisation** | Chrome draws glyphs with DirectWrite on Windows, FreeType on Linux, Core Text on macOS | Every glyph's antialiasing differs, even with the same font file. This alone rules out sharing references across operating systems |
| **Installed fonts** | `monospace` is Consolas on Windows, DejaVu Sans Mono or Liberation Mono on Linux; Segoe UI exists only on Windows | Different letters, widths, wrapping, bounds |
| **GPU and driver** | A different GPU, or the same one with another driver, rounds and antialiases differently | Edges, gradients, MSAA |
| **Browser version** | The installed Chrome updates itself | Anything, at any time, with no commit to blame |
| **Locale and time zone** | Number and date formatting (`toLocaleString`) follow the machine | Text content itself |
| **Device scale** | High-DPI screens | Picture size |
| **Colour management** | Display profiles | Screenshots' colours (not `readPixels`) |
| **CPU** | Software WebGL compiles shaders for the CPU it runs on | Possibly nothing; unknown until measured (section 5.5) |

The usual answer, one set of references per platform, is the worst of
both: every visual change needs updating on every platform, and the set
for the platform you are not on cannot be updated at all. Ruled out
(see Settled).

### 5.3 One reference environment: a pinned container

Instead, there is one environment, and every machine uses it:

- **A Linux container**, built from Playwright's own image
  (`mcr.microsoft.com/playwright:v<version>-noble`), pinned by digest,
  with a `Dockerfile` of a few lines in `scripts/visual/`. It runs
  Playwright's browser server (`playwright run-server`), and nothing else.
  Fonts, the browser build, the operating system's libraries: all fixed by
  the digest.
- **The tests stay on the host.** Vitest and Vite run where they run now.
  The Playwright provider's `connectOptions` connect to the container's
  browser over a websocket, and Playwright's `exposeNetwork: '<loopback>'`
  lets that browser reach the host's Vite server as `localhost`, through
  the same connection. Nothing needs mounting into the container, and the
  repo's files are never read across the Windows-Linux boundary, which
  would be slow.
- **Software WebGL, explicitly.** The launch arguments select ANGLE on
  SwiftShader. The container has no GPU, so this is also what it would do
  anyway; saying so means a GPU-equipped CI runner cannot change it.
- **The rest pinned in the browser context:** locale `en-US`, time zone
  `UTC`, device scale 1, colour profile sRGB, scrollbars hidden.
- **Long-lived.** `npm run test:visual` starts the container if it is not
  running, and leaves it running: a second run, or watch mode, connects in
  a fraction of a second. `npm run visual:stop` stops it.
- **The same in CI** (section 9): GitHub's Ubuntu runners have Docker, and
  run the same image.

Two facts about this machine follow. **It needs Docker**, which needs WSL
2 on Windows, and neither is installed. That is a one-time install per
machine (Docker Desktop, or Podman), and open question 1. And **the
failed-logon problem disappears**: the browser runs as a Linux user in a
container, and never touches Windows' logon (section 8).

The pictures will not look exactly as a visitor on Windows sees the site:
a Segoe UI label will be drawn in the container's fallback sans. That is
fine. A visual test answers "has this changed?", not "is this what a
visitor sees?", and the container answers it the same way everywhere. If
the stand-in fonts ever make reviewing diffs confusing, the image can add
the fonts the site names (where their licences allow) or the site can
serve its own; either is a change to the image, made once.

**CPU architecture** is the one thing the image cannot pin. Playwright's
images are built for x64 and arm64, and SwiftShader generates code for the
CPU it runs on. Every machine in sight today is x64 (this one, and GitHub's
standard runners). An arm64 machine (an Apple Silicon Mac) would run the
x64 image under emulation, slower but the same, rather than the arm64 one.

### 5.4 A fingerprint, checked first

The worst failure of a visual suite is three hundred red tests caused by
one thing nobody can see: a different browser, a missing font. So before
comparing anything, the run checks that it is in the reference
environment.

A committed file, `packages/website/visual-environment.json`, holds the
reference environment's fingerprint:

- the browser's version, and the WebGL renderer string (which names
  ANGLE and SwiftShader, and their versions);
- the locale, time zone and device scale;
- the hashes of a **calibration set**: a dozen tiny pictures, each
  exercising one way a picture can differ. Text in each font family the
  views use, in canvas text (Pixi) and in the DOM. An antialiased circle,
  with and without MSAA. A gradient. A blur filter. A texture sampled
  linearly and nearest. A lit, shaded three.js sphere.

At the start of a run, each worker draws the calibration set and compares
it, and the rest, with the committed fingerprint. If anything differs, the
run stops before the first test, and says what differed: "the monospace
calibration picture differs: this is not the reference environment (is
the container running? `npm run test:visual` starts it)". One clear
error, not three hundred.

The same check guards updating: `test:visual:update` refuses to write
references outside the reference environment, so a wrong picture cannot
be accepted by accident. Upgrading the environment (a new Playwright, a
new image) is deliberate: `test:visual:update --environment` rewrites the
fingerprint, and the same commit carries every reference the upgrade
changed, each reviewable.

### 5.5 Exact first, tolerance second

With one environment, the expected result is identical pixels, and a pass
is an identical hash. That is also what keeps passing tests fast (section
4.4).

There is one gap no pinning closes: whether SwiftShader gives
bit-identical results on different x64 CPUs (this machine's, and a GitHub
runner's). It should, and step 1 measures it, but if it does not, the
answer is not to give up exactness everywhere. On a hash mismatch, the
picture goes to Node, which compares it with the reference using
pixelmatch with a small tolerance (its default per-pixel colour threshold,
and a handful of mismatched pixels at most). Then:

- **Within tolerance:** the test passes, and the run's summary counts it
  ("12 pictures matched within tolerance, not exactly"). A count that
  grows is a signal; a count that stays at zero means the tolerance never
  mattered.
- **Beyond tolerance:** the test fails, with the diff.

The tolerance is fixed and small, for the workshop's reason: a loose one
hides real regressions (2% of mismatched pixels missed a text colour
change). A real change to a view changes hundreds of pixels, not a
handful.

### 5.6 Reference files: the same bytes from any machine

References are PNGs, because people review them, and VS Code's source
control view shows a PNG's old and new versions side by side. Three
choices make them consistent too:

- **Written by our encoder, never the browser's.** A small PNG encoder in
  Node (on `pngjs`, already a dependency) with fixed settings: one filter,
  one compression level, no timestamps or metadata beyond our own. The same
  pixels give the same bytes, on any machine, so accepting a picture that
  did not really change is not a change git sees.
- **The pixel hash travels inside the file**, in a PNG text chunk written
  right after the header. Reading the expected hashes at the start of a
  run is reading the first hundred or so bytes of each reference, not
  decoding it: 500 references are a few tens of milliseconds. CI's weekly
  run (section 9) decodes every reference and checks that its pixels still
  match its hash, so a hand-edited PNG cannot pass unnoticed.
- **No platform in the name.** `SpinButtonView-spin.png`, not
  `...-chromium-win32.png`. There is one platform; a name that suggests
  otherwise invites a second set.

## 6. Running them

### 6.1 Why Vitest

| | Vitest browser mode (recommended) | Playwright Test (the workshop) | Our own runner on `headless-chrome.ts` |
| --- | --- | --- | --- |
| Finding tests | Vitest's include glob | A registry, published on `window` by a harness page | Our own glob and registry |
| Where the test runs | In the page: a pose is ordinary code | In Node, driving a page that holds the poses | In Node, driving a page |
| One pose, one test | Yes: named, filterable (`-t`), watchable | No: one test loops over every pose | Ours to build |
| One page for every file | `isolate: false` | Yes, by design | Yes |
| Remote browser in a container | `connectOptions`, passed to Playwright's `connect` | Yes | No: CDP to a local Chrome |
| Comparison, update, report | Ours (section 4.4), on Vitest's commands and reporters | Built in, screenshot-based | Ours |
| Runners in the repo | One (Vitest, as now) | Two | One, plus a script |

The comparison is ours whichever runner is chosen, because the fast path
(section 4.4) is not a screenshot. Vitest is then the one that gives
unit-test ergonomics for free: the same `describe`, `-t`, watch mode and
reporters, in the runner the repo already uses. Vitest's own
`toMatchScreenshot` is not used: it captures screenshots, retries until
two agree, and names references per platform, which are the three things
sections 4 and 5 set out to avoid.

Our own runner, on `headless-chrome.ts`, is the fallback if step 1 finds
Vitest's per-test overhead in browser mode too high to meet the budget.
The workshop's one-page design is close to the fast path already; the
difference would be reading pixels instead of screenshots.

### 6.2 Projects, and the commands

The root `vitest.config.ts` becomes three projects:

- **`unit`**: everything that runs now, in Node, unchanged.
- **`visual`**: `**/*.visual.tsx` except `*.html.visual.tsx`, in browser
  mode, `isolate: false`, connected to the container.
- **`visual-html`**: `**/*.html.visual.tsx`, the same but isolated per
  file.

Both visual projects use the website's Vite config, merged, so the
spritesheet and entry facts plugins serve what the views load, and
`@mvtjs/source` resolves the libraries to their source as everywhere
else. The suffix `.visual.tsx` (not `.visual.test.tsx`) keeps the files
out of the `unit` project's default include.

| Command | Runs |
| --- | --- |
| `npm test` | `vitest run --project unit`: as now, no browser, no Docker |
| `npm run test:visual` | Starts the container if needed, checks the fingerprint, runs both visual projects |
| `npm run test:visual:update` | The same, writing a reference for every picture that changed or is new, and none for the rest |
| `npm run test:visual -- -t SpinButton` | One group, as with any Vitest run |
| `npm run visual:stop` | Stops the container |

Whether `npm test` should include the visual projects is open question 3.
If step 1 meets the budget, a visual run adds a few seconds, and the case
for one command is strong. The cost is that `npm test` would then need
Docker running.

### 6.3 What `visualTest` does

For each test:

1. Resets the shared state (section 5.1): seeds `Math.random`, resets
   Pixi's texture defaults, then sets nearest-neighbour scaling for a
   pixel-art pose.
2. Runs the pose, and awaits it.
3. Calls `refreshView(view)`.
4. Works out the picture's size (section 6.5).
5. **WebGL:** renders the background and the view into a pooled render
   texture, reads the pixels, hashes them, compares with the reference's
   hash. **HTML:** mounts the element in a host `<div>`, and asks Node,
   by a browser command, for the screenshot, its hash and the comparison.
6. On a mismatch, or a missing reference: sends the pixels to Node, and
   fails or passes as Node decides (section 7).
7. Unmounts and destroys the view (`destroy({ children: true })`,
   `destroyObject`, `destroyElement`), in a `finally`.

### 6.4 The browser commands

Vitest's browser commands are functions that run in Node and are called
from the page. The harness needs four:

- `visualReferences()`: once per worker, the table of reference names and
  hashes, read from the files' text chunks (section 5.6), and the
  fingerprint.
- `visualMismatch(name, pixels)`: decodes the reference, compares within
  tolerance, writes the actual picture and a diff to `.vitest/visual/`,
  or, when updating, writes the new reference. Returns the verdict.
- `visualScreenshot(name, selector)`: for HTML, an element screenshot
  through Playwright, hashed and compared the same way.
- `visualDone(names)`: at the end of a full run, the names of the pictures
  compared, so Node can list references no test used (section 7.4).

Updating is a flag Node reads (`test:visual:update` sets it), not
something the page needs to know.

### 6.5 Sizing

Without a size, the picture is the view's local bounds after its first
refresh, rounded out to whole pixels, plus a small fixed margin (so an
antialiased edge or a glow at the bounds is in the picture). The view is
moved by the bounds' top-left, so a view drawn around its origin, like the
spin button, is framed the same as one drawn from its corner.

A size, when given, is used as is, and the view stays where it put itself:
the right thing for a top-level view of a fixed screen.

The default has a consequence worth wanting: a view that grows or shrinks
changes the picture's size, and so fails its test, even if every pixel it
used to draw is unchanged.

Small pictures are also fast pictures: hashing, and any comparison, scale
with the pixel count. Resolution defaults to 1 for that reason too.

## 7. Comparing and accepting

### 7.1 When a test fails

The failure names the test and how many pixels differ, and points at three
files: the reference, the actual picture and a diff (changed pixels in
red), the last two under `.vitest/visual/`, which `.gitignore` gains. Where
Vitest's reporters can show attachments, the two are attached to the test
as well, so its UI shows them (step 2 checks what browser mode supports).

Then one of two things is true:

- **The change is a regression.** Fix the view, rerun.
- **The change is intended.** Run `npm run test:visual:update` (with `-t`
  to accept only the tests meant), and review the changed references
  before staging them. An agent never stages them: as with every change,
  the user stages while reviewing.

The value is in that review. A reference accepted without looking is a
test that has stopped testing.

### 7.2 A new picture

A test with no reference fails, in every mode but update, with "new
picture: run `npm run test:visual:update -- -t <name>`, and review it".
It never writes a reference by itself: in CI, a missing reference must be
a failure, not a file written into a throwaway checkout.

### 7.3 Size

A leaf view's picture is small (the spin button is about 120 pixels
across). A top-level view of a pixel-art game is its screen at
resolution 1 (Crumb Chase's is its maze at 20 pixels a tile, plus its
HUD), and PNG compresses flat pixel art well. A hundred pictures should
come to a few megabytes. Step 3 records the real figure. The guidance
that follows: photograph leaf views, plus one or two whole screens per
entry, not every frame of every animation.

### 7.4 Orphaned references

Renaming or deleting a test leaves its reference behind. A full run (no
`-t`, no file filter) ends by listing the references no test compared
with, and failing; `test:visual:update` deletes them instead.

## 8. The browser on this machine

Chrome 153 and later test a new profile's Windows password by logging in
with a blank one, and Windows counts each attempt as a failed logon. A
benchmark suite that made a new profile per case locked the user out of
the machine on 2026-10-02 (fixed in `e433c90`); `headless-chrome.ts` now
keeps one profile for every launch.

The container removes the problem: its browser is a Linux process, and
never consults Windows. Nothing in this design launches a browser on
Windows.

If open question 1 is answered "no Docker" for some machine, and a
native browser is used there after all, Vitest's Playwright provider has
`persistentContext` (Vitest 4.1 and later), which keeps one profile in
`node_modules/.cache/`; one failed logon per checkout, then none. Such a
machine is not the reference environment, so its runs could not compare
with the committed references (section 5.4); see open question 2.

## 9. CI

The deploy workflows run `npm test` on `ubuntu-latest`, unaffected.

A visual job runs `npm run test:visual` on every push, with the same
image, started by the same script. GitHub's Ubuntu runners have Docker,
and are x64. If step 1's estimate holds, the job costs well under a
minute beyond `npm ci` and pulling the image (cacheable).

A weekly scheduled job runs the suite in shuffled order, and decodes
every reference to check that its pixels match its stored hash (sections
4.3 and 5.6).

Consistency between this machine and CI is the claim most worth testing
before relying on it, and step 1 tests it directly: the same spike suite,
run in the container here and on a GitHub runner, must give identical
hashes.

## 10. Whole entries, for free

The thumbnail page (`src/snapshot.ts`) already knows how to start any
entry headless at its play size, advance it by `thumbnailAdvanceMs` in
16 ms steps, playing its `thumbnailInput`, and draw one frame. That is a
visual test of the whole entry, minus the comparison.

One file, `entries/entries.visual.tsx`, can loop over the catalogue and
make one `visualTest` per entry from the same code. To share it, the
page's `start` and `advance` move into a module both import. Then every
entry has a test of its whole screen, written once, catching what no leaf
test sees: layout, layering, a view left out of its parent.

Two cautions:

- **Element entries are not instant.** The page gives them 500 ms of real
  time to lay themselves out and start their renderers: the one
  wall-clock wait in the pipeline, against both goals of this proposal.
  Pixi entries come first; element entries follow when they can say when
  they are ready.
- **These tests fail on any change to an entry.** That is their job, but
  an entry's own commits will often accept a new reference. They
  complement leaf tests, which say what changed; they do not replace them.

## 11. What stays, and what changes

**The scene-graph view tests stay.** They test what a view does with its
bindings (the reel shows the strip from its position down; traffic stays
off the water), which a picture shows only for the cases photographed.
The docs' guidance holds: assertions for behaviour and structure,
pictures for looks. A scene-graph test that only restates looks (a tint,
an alpha) is a candidate to become a picture, when someone is in that file
anyway.

**The docs become true.** `testing.md` already says the project uses
Playwright for visual tests; it gains how. `testing-views.md` replaces its
`/test-harness?view=...` example with `visualTest` and `advanceTime`,
and gains the two problems this proposal is built around, since they are
what a reader adopting MVT elsewhere most needs to hear. The view skill
(`skill-mvt-view.md`) asks for a `.visual.tsx` beside a new view, with a
picture per state its bindings can show. AGENTS.md's command table gains
the commands, and the project structure page gains `__screenshots__/`,
`src/testing/` and `scripts/visual/`.

## 12. Open questions

1. **Docker on every development machine?** Consistency, as designed,
   needs it (section 5.3), and this machine has neither Docker nor WSL. The
   install is one-time, and Docker Desktop is free for personal use;
   Podman is an alternative without a licence question. Recommendation:
   yes. Without it, references can only be made and checked in CI.
2. **A local mode without the container?** For a machine without Docker,
   a mode that draws in a native browser and compares only with that
   machine's own earlier run (kept under `node_modules/.cache/`, never
   committed) would still answer "did my refactor change anything?". It
   adds a second way to run, and a second set of pictures to explain.
   Recommendation: not unless question 1 is answered no somewhere.
3. **Visual tests in `npm test`?** Recommendation: decide after step 1. If
   the budget holds, yes, with `npm test` starting the container like
   `test:visual` does.
4. **A package?** `visualTest` and `advanceTime` are not specific to the
   website, and `advanceTime` is not specific to visual tests. A private
   `@mvtjs/testing` would serve the benchmarks or a future package's own
   views; a published one would serve users of the libraries.
   Recommendation: start in the website, and move it when a second
   package needs it.
5. **What if SwiftShader draws something wrongly?** If a view uses a
   feature software WebGL gets wrong, its pictures would be consistently
   wrong, which still catches changes, but would confuse a reviewer.
   Decide when it happens, if it does.
6. **Resolution 1 or 2 by default?** 1 keeps pictures small and fast, and
   is what pixel art wants. Smooth views lose detail at 1 that a
   regression could hide in. Recommendation: 1, with `resolution: 2` for
   the views that need it.

## 13. Implementation steps

1. **Spike, and measure.** Before building anything to keep:
   - **Consistency.** Install Docker (question 1). Build the image; run
     the browser server; connect Vitest with `exposeNetwork`. Draw the
     calibration set and a few real views: confirm the canvas is not
     blank, and record the WebGL renderer string. Run ten times: identical
     hashes, or how much noise. Run the same on a GitHub `ubuntu-latest`
     runner: identical hashes to this machine's, or how much noise.
   - **Speed.** A throwaway generated suite of 1000 pictures from real
     views (every spin button mode, every reel position, every entry's
     HUD at several values, a few whole screens), in 100 files. With
     `isolate: false`, pixels read from the renderer, and in-page hashing,
     measure: start-up, per picture (median, 95th percentile), per file,
     with one, two and four workers. Measure the same suite with Vitest's
     defaults and `toMatchScreenshot`, to record what the design saves.
     Record memory after 1000 pictures, to catch leaks.
   - Record everything here. If the speed targets are missed by far, find
     where the time goes before moving on; if Vitest's own per-test
     overhead is the cause, reconsider section 6.1's fallback.
2. **The harness.** `#testing` with `visualTest` (Pixi first, then HTML)
   and `advanceTime`; the setup file and its resets; the PNG encoder and
   its hash chunk; the browser commands; the fingerprint and the
   calibration set; the three projects; the npm scripts and the container
   script; `.vitest/` in `.gitignore`. The run's timing summary.
3. **First tests.** The fruit machine's Pixi leaf views (spin button, win
   banner counting, reel window), one pixel-art game screen, and one HTML
   view (the Arcade's card, or the fruit machine's control panel). Make a
   deliberate change to one view, and check that its test fails with a
   useful diff, and that the update command accepts it and only it.
   Record the size of the references.
4. **CI.** The visual job on every push; the weekly shuffled and
   verification job.
5. **Whole entries.** Move `snapshot.ts`'s `start` and `advance` into a
   module the page and `entries.visual.tsx` share; one test per Pixi entry.
6. **three.js.** Camera and environment options, render targets and
   `readRenderTargetPixels`; the fruit machine's lever and the boids'
   flock. Element entries in `entries.visual.tsx`, if they can say when
   they are ready.
7. **Orphaned references** (section 7.4).
8. **Docs** (section 11), with the documentation skill.

## Settled

Do not reopen without new information.

- **One set of references per platform.** Every visual change would need
  updating on every platform, and the set for a platform you are not on
  cannot be updated at all. One reference environment instead (section
  5.3).
- **Native browsers made consistent by shims.** Pinning software WebGL in
  a native Chromium, and drawing canvas text from bundled fonts through
  a patched `fillText`, could make Pixi pictures match across operating
  systems. It cannot do the same for DOM text, which every HTML view has,
  and it would test a patched browser. The container pins everything
  without patching anything.
- **Tolerance as the answer to inconsistency.** A tolerance loose enough to
  absorb another operating system's text rendering is loose enough to miss
  a real change to text (the workshop's finding). Tolerance is only the
  second check, small and counted (section 5.5).
- **Screenshots for WebGL views.** Slower (section 4.2), and subject to
  the compositor and colour management. Pixels are read from the renderer.
- **Snapshots of the scene graph, not of pixels.** 022 built a plain-object
  JSX target that could print a view's tree, and deleted it unused; the
  docs argue against such snapshots at length. Pictures only.
- **Drawing in Node.** Pixi 8 and three.js draw through a browser's WebGL;
  a Node canvas or headless-gl would test a different renderer from the one
  visitors run.
- **Hosted visual review services** (Chromatic, Argos and the like). They
  would send the repo's pictures to an outside service, and cost money,
  for what a local run and a review in source control already give.
