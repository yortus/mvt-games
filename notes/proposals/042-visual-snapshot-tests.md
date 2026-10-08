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
> same pictures on Windows, Linux and macOS, CI included, with nothing to
> install beyond `npm ci`. Everything that differs between machines is
> pinned inside the browser itself: one Chromium build, fetched by
> Playwright on first use; software WebGL, 2D drawing and compositing;
> canvas text drawn as paths from test fonts, by our own code; and HTML
> text replaced by a blank font that keeps the layout and draws nothing.
> What remains is rounding in arm64 processors, at most 2 levels of 255
> per channel, which a small tolerance absorbs. A fingerprint of the
> environment is committed and checked before anything is compared. Runs
> on Vitest's browser mode. No Docker, no VM, no licences.

**Status:** steps 1 to 7 done. The spike (2026-10-07) measured 1000
pictures in 12.7 s, and the same pictures on Windows, Linux x64, Linux
arm64 and macOS arm64 (see [Spike results](#spike-results)); the design
was revised to it (2026-10-08). The harness is built (2026-10-08):
`packages/website/src/testing/` (`#testing`) and
`packages/website/scripts/visual/`, with its own tests, on branch
`visual-tests` (the spike's code is in its history, up to `b7f40c3`).
The first eleven visual tests are in (step 3), and CI runs them on every
push, on all three systems when the pinning could change (step 4).
Every entry has a picture of its whole screen (step 5), three.js views
have pictures too (step 6), and a full run finds references left behind
(step 7); the docs are next.

**Written:** 2026-10-05; revised 2026-10-06 to put speed and consistency
first, then again the same day to drop the Docker container for pinning
inside the browser, so that setup is `npm ci` and nothing else; revised
2026-10-08 to the spike's results, which replaced the test-font ladder of
section 5.4 with text drawn as paths (canvas) and a blank font (HTML).
Against branch `036` at `4c3fd85`; the spike against `vnext` at
`5afdd2e`. Draws on the workshop's version of the same idea
(`mvt-workshop`, Lab 02, Experiment 2.1,
`src/labs/lab-02-testable-models/lab-02-experiments.mdx`), and its
solution on the workshop's `solutions-and-extras` branch at `604535d`.
Vitest 5.0.1, Playwright 1.63.0 (Chrome 153.0.8010.12). Timings are the
spike's measurements unless a sentence says it is an estimate.

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
| 3 | **Speed budget:** within a few times a unit test. Measured: 1000 pictures of real views in 12.7 s, start-up included; a WebGL picture 6 ms at the median, 22 ms at the 95th percentile. Every run prints the same figures | [4.1](#41-the-budget) |
| 4 | **One page for the whole run** (`isolate: false`) and **one Pixi renderer**: modules, shaders and textures load once. Every dependency is pre-bundled before the first test, or a mid-run re-bundle loads a second Pixi | [4.3](#43-one-page-one-renderer) |
| 5 | **No screenshots on the fast path.** Pixi and three.js pictures are read from the renderer (`readPixels`), hashed in the page, and compared with the hash stored in the reference PNG. No PNG is encoded, decoded or sent anywhere unless the hashes differ | [4.4](#44-pixels-from-the-renderer-hashes-not-images) |
| 6 | HTML views need a real screenshot, taken through the DevTools protocol (35-60 ms), in a project of their own that isolates each file, since their stylesheets would otherwise leak | [4.5](#45-html-the-slow-path-kept-small) |
| 7 | **One environment, pinned inside the browser.** Playwright's headless shell (its build fixed by the lockfile, fetched on first use), software WebGL (SwiftShader), software 2D drawing and compositing, hinting off, locale, time zone and scale. Nothing to install beyond `npm ci` | [5.3](#53-one-environment-pinned-inside-the-browser) |
| 8 | **Text is not left to the system.** Canvas text (Pixi) is laid out and drawn as paths by our own code, from test fonts. HTML text uses a blank TrueType font: every character an empty glyph 0.625 em wide, font sizes rounded to quarter pixels, so layout is kept and nothing is drawn. Rotated images are sampled nearest-neighbour and unstyled text fields are 20ch wide | [5.4](#54-text-the-hard-part) |
| 9 | A committed **fingerprint** (browser build, WebGL renderer, and the hashes of a calibration set of pictures), checked before any comparison. Where it does not match, the tests refuse to compare or update, and say why | [5.5](#55-a-fingerprint-checked-first) |
| 10 | **Exact first, tolerance second.** A pass is an identical hash. Only on a mismatch is the picture compared, passing when no channel of any pixel differs by more than 2 levels of 255 (arm64 rounding), and a pass within tolerance is reported, not hidden | [5.6](#56-exact-first-tolerance-second) |
| 11 | References are PNGs written by our own encoder (byte-identical for identical pixels, on any machine), carrying their pixel hash in a text chunk, with no platform in their names: there is one environment | [5.7](#57-reference-files-the-same-bytes-from-any-machine) |
| 12 | Containers and VMs (Docker, Podman, Rancher Desktop, WSL) would pin more, but each needs an install, and WSL, on Windows. Kept only as a last resort, and not needed: the spike matched Windows, Linux and macOS without one | [5.8](#58-containers-vms-and-the-other-alternatives) |
| 13 | Run by Vitest's browser mode with the Playwright provider. Two projects apart from `unit`: `visual` (Pixi and three.js, one shared page) and `visual-html` (a page per file). `npm test` stays browser-free until step 3 has real tests to time | [6](#6-running-them) |
| 14 | CI runs the visual tests on every push, on Ubuntu, against the same references; a Playwright upgrade also runs them on Windows and macOS | [9](#9-ci) |
| 15 | Whole entries get a visual test each, from the code the thumbnail page already uses to start and advance them | [10](#10-whole-entries-for-free) |
| 16 | The existing scene-graph view tests stay. They test behaviour, not looks | [11](#11-what-stays-and-what-changes) |
| 17 | **Order cannot change a picture.** The harness resets what it shares, patches a Pixi pool that leaks rounding between graphics, and fails a picture that is blank; models keep no state at module level | [5.1](#51-within-a-run) |

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

Three properties decide whether such a suite gets used or quietly
abandoned:

- **Speed.** The unit suite runs over 1500 tests in about 15 seconds,
  about 10 ms a test, start-up included. If a visual test costs a
  hundred times that, nobody adds the fortieth one, and nobody runs the
  suite before committing. The goal is a cost per picture close enough to
  a unit test's that adding one is not a decision.
- **Consistency.** A picture must depend on the code and nothing else: not
  the machine, its operating system, GPU, fonts or locale, or the browser
  that happened to update itself last night. A suite whose references only
  match on one machine fails everywhere else, and a failure people learn to
  ignore is worse than no test.
- **No setup.** Clone, `npm ci`, run. No Docker, no VM, no system fonts
  to install, nothing with a licence to check. A step a contributor (or
  a fresh CI runner, or an agent's new worktree) has to remember is a
  step that gets skipped.

The architecture makes a good start on the first two. A view is a
function of its bindings. Its presentation state starts valid at
construction and advances only through `update(deltaMs)`. Models advance
only through `update(deltaMs)`, never on the wall clock. So a posed view
is deterministic by construction, and needs no waiting: the same bindings
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
- **Playwright's own Chromium**, installed by Playwright rather than the
  machine's Chrome. Section 5.3 builds on it.

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
  names carry `-chromium`, but the pictures depend on the machine's fonts,
  GPU and operating system too. Section 5 makes them depend on none of
  those.
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
    }, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
});
```

`textures.load()` works because the visual project runs under the
website's Vite config, whose spritesheet plugin serves the textures. It
loads once per run, not once per test, since the page lives for the whole
run (section 4.3). The size is the game's screen, not its bounds. A
picture is drawn as pixel art by default (hard edges, whole-pixel
positions, nearest-neighbour textures), as this game is; a smooth view
says `artStyle: 'smooth'`.

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
takes the given size), waits for its fonts and every image (lazy ones
too), and photographs the host. HTML pictures take the slower path
(section 4.5).

The picture keeps every box, border, background, image and control, and
no letters: HTML text is drawn in a blank font (section 5.4), so a test
of an HTML view checks its layout and styling, not its copy. A view whose
looks depend on its CSS selectors gets the markup round it that its entry
gives it (the fruit machine's quadrant, the Arcade's `.arcade`), which the
pose builds.

### 3.5 A three.js view

A three.js view returns an `Object3D`, and needs a camera, and usually
light, to be seen. Its options make the camera, and can dress the scene
the view is drawn in as its entry does:

```tsx
visualTest('200 ms into a pull', () => pulledFor(200), {
    width: 240,
    height: 300,
    camera: sideCamera,
    scene: dressBanditScene,
});
```

`dressBanditScene` is the fruit machine's own: its starter calls it too.
It sets the tone mapping, the background, and the blurred `RoomEnvironment`
the bandit's paint and chrome reflect; without one, nothing shines. The
harness calls a dressing once per page, keeps its scene, and adds each
picture's view to it (with the renderer settings it chose), because an
environment map takes a second or more to make in software WebGL. A view
that brings its own lights (the boids' flock) needs no dressing.

Pictures are drawn on the canvas of one renderer kept for every three.js
picture, not into a render target, because three.js tone-maps and
converts colour only on the way to the canvas; the pixels are read
straight back, before the page composites them, so it is still no
screenshot. Always antialiased, so a picture over the size budget is drawn
at a lower resolution, as a smooth Pixi one is.

### 3.6 The API

```ts
export type Pose<V> = () => V | Promise<V>;

export interface PixiPictureOptions {
    /** The picture's size in pixels. Default: the view's bounds after its first refresh, plus a margin. */
    readonly width?: number;
    readonly height?: number;
    /** Default: one opaque dark grey, the same for every test, so transparent areas show. */
    readonly background?: number;
    /**
     * `'pixel'` (the default): hard edges, whole-pixel positions,
     * nearest-neighbour textures, always full size. `'smooth'`: antialiased
     * edges, fractional positions, smooth textures, and drawn at a lower
     * resolution when over the size budget (section 7.3).
     */
    readonly artStyle?: 'pixel' | 'smooth';
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
    /** Dresses the scene and renderer as the view's entry does; called once per page. */
    readonly scene?: (options: { readonly scene: Scene; readonly renderer: WebGLRenderer }) => void;
    readonly background?: number;
}

export function visualTest(name: string, pose: Pose<Container>, options?: PixiPictureOptions): void;
export function visualTest(name: string, pose: Pose<Object3D>, options: ThreePictureOptions): void;
export function visualTest(name: string, pose: Pose<Element>, options?: HtmlPictureOptions): void;
```

The kind of view is told apart at run time by what the pose returns
(`instanceof Object3D` or `Element`, else Pixi); the overloads make
the options match at compile time. A three.js pose without a camera does
not compile.

There is no per-test tolerance option. A test that needs one is a test
whose picture is not deterministic, and section 5.6 handles the
environment-wide case; a single view that cannot be drawn the same way
twice is a finding to fix or to record, not to paper over.

The browser-side code lives in the website, at
`packages/website/src/testing/`, imported as `#testing` (a second entry in
the package's `imports`, beside `#shared`). It is kept out of `#shared`
because it imports Vitest, which must never reach the site's bundle. The
Node-side code (the browser commands, the PNG encoder, the Vite plugin
that maps font names, section 5.4) lives in
`packages/website/scripts/visual/`, beside the other build-time tools.
Only the website has views to photograph today; open question 3 asks
whether it should become a package.

## 4. Speed

### 4.1 The budget

The unit suite: over 1500 tests in about 15 s, about 10 ms a test with
start-up spread across them. A visual test does strictly more (it draws,
and reads pixels back), so matching that exactly is not realistic. Within
a few times it is, and that is the target. Measured by the spike on this
machine (Windows, 14 cores), on 1000 pictures of real views in 100 files:

| Measure | Target | Measured |
| --- | --- | --- |
| Start-up, once per run: launch the browser, load the page and its modules and fonts, make the renderer, compile shaders | 3 s | 2.4 s |
| A Pixi or three.js picture, median | 5 ms | 6.1 ms (a spin button 1.9, a banner with text 6.4) |
| The same, 95th percentile (whole screens, big textures) | 25 ms | 22.4 ms (whole screens alone: median 38) |
| An HTML picture | 30 ms | 35-60 ms |
| Vitest's own cost per test | | 1.5 ms |
| 1000 pictures, start-up included | 20 s | 12.7 s |
| Watch mode: one edited view's file, re-run | under 1 s | about 230 ms |
| `test:visual:update` with nothing changed | writes no file | |

Drawing in SwiftShader is 86% of the time in the page, building the views
10%, hashing 3%. On GitHub's four-core runners the same 1000 took 29 s
(Ubuntu) and 36 s (Windows). Every run prints the same figures (start-up,
median and 95th percentile per kind, the ten slowest tests), so a slow
test is noticed when it is added, not a year later.

The first run on a machine also downloads Playwright's Chromium (section
5.3), once, into a cache every checkout shares. That is not counted.

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
them. Measured on 100 of the spike's pictures: Vitest's defaults with
`toMatchScreenshot`, 12.0 s; one shared page with screenshots, 10.4 s; a
page per file with pixels from the renderer, 4.9 s; this design, 3.1 s.

### 4.3 One page, one renderer

Vitest runs each test file in a fresh iframe by default. With
`isolate: false`, it runs every file in the same iframe, one after
another. Vitest's docs warn of the cost, shared state between files; a
reported example went from 7 s to 600 ms. Here it means:

- **Modules load once.** Pixi, three.js, the libraries and every view are
  evaluated once per run (per worker, section 4.6), not once per file.
- **One renderer.** One Pixi `Application` for every picture, pixel art
  included: MSAA belongs to the render texture each picture is drawn
  into, and pixel rounding is set per picture. The WebGL context's own
  `antialias` setting still changes MSAA edges in render textures, so it
  is fixed (off), not left to a default. One three.js renderer beside it,
  made on first use; a three.js picture between Pixi pictures changes
  none of them. Chrome keeps only about 16 WebGL contexts per page, so
  this is also what keeps a long run from losing its canvases.
- **Shaders compile once.** Software WebGL compiles them on the CPU, which
  is slow enough to matter if it happened per file.
- **Textures load once.** Each entry's texture registry keeps what it
  loaded, so `textures.load()` in a pose costs a check after the first.
- **Fonts load once.** The test fonts (section 5.4) load before the first
  picture.
- **Every dependency is bundled before the first test.** Vite's
  optimizer, finding a new dependency mid-run, re-bundles, and the files
  after that point load a second copy of Pixi whose objects are not the
  first's (`Texture.WHITE` among them; text fills throw). The visual
  projects list every dependency in `optimizeDeps.include`. A stale
  optimizer cache after a dependency change can still break the first run
  after it; CI starts cold.

Shared state is the price, and section 5.1 lists what the harness resets
before every test so that order cannot change a picture. A periodic run
in shuffled order (`--sequence.shuffle`) checks that it does not.

### 4.4 Pixels from the renderer, hashes not images

For a Pixi or three.js view, a picture never needs to be a screenshot.
The harness:

1. Renders the posed view: a Pixi view into a `RenderTexture` of the
   picture's size, kept in a pool by size, so the canvas is never resized
   and no texture is made per test; a three.js view onto its renderer's
   canvas, sized to the picture, since three.js tone-maps only on the way
   to the canvas (section 3.5).
2. Reads the pixels back (`readPixels`, through Pixi's `getPixels`, or
   straight from the three.js canvas before the page composites it).
   With software WebGL this is a
   memory copy; there is no compositor, no colour management and no
   PNG anywhere.
3. Hashes them in the page: SHA-256 through `crypto.subtle.digest`,
   which runs at native speed (a 960 by 540 picture is about 2 MB, a
   millisecond or two). The width and height go into the hash too.
4. Compares the hash with the reference's. The references' hashes reach
   the page once per run, as one small table (section 5.7); a passing
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
through a browser command that asks Chrome for a screenshot of the
element's rectangle through the DevTools protocol
(`Page.captureScreenshot` with a clip and `optimizeForSpeed`), decodes
and hashes it in Node, and compares it with the reference the same way:
35-60 ms a picture, against 90-130 ms through Vitest's `page.screenshot`,
with identical pixels. The clip is rounded outwards, as Playwright's
element screenshots are. Two measures keep this path from dragging the
rest:

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
already spreads a draw across CPU cores, so more workers barely help:
1000 pictures took 10.8 s with one worker, 9.6 s with two and 9.5 s with
four. One worker is the default.

### 4.7 Cheap to add

Adding a picture costs one line of code and nothing else: no
registration, no config, no new file to wire up. The first run reports it
as new and fails; `npm run test:visual:update -- --picture <name>` writes its
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
| State kept at module level | Astrovoid numbered its asteroids' shapes with a module-level counter, so shapes depended on the games before (fixed 2026-10-07: the game model owns it). No other entry has a module-level `let` | The models' rule; a lint rule against module-level `let` in model files would keep it so |
| A Pixi pool | Pixi 8.21's `BatchableGraphics.reset()` keeps `roundPixels`, so a batch pooled by a pixel-art picture rounds the curves of the next graphics built from the pool (one MSAA sample at rounded corners) | The setup file patches `reset` to clear it, until Pixi fixes it (task 017) |
| Hooks in a shared module | A `beforeEach` registered by a module two test files import runs for the first file only: the module evaluates once | Per-test resets live in the harness and the setup file, never in a shared module |
| Dependencies found mid-run | Vite re-bundles, and later files load a second Pixi | Every dependency pre-bundled (section 4.3) |
| Seeds picked by a page | The fruit machine's load picks its seed with `Math.random()` | Same |
| Wall clock in a view | None found (`performance.now`, `Date.now`, `requestAnimationFrame` in views) | Lint covers models only; a pose that needs a view's wall clock is a bug in the view |
| No ticker | Pixi applications tick themselves by default | Made with `autoStart: false`, as the thumbnail page and the fruit machine make theirs; the harness draws once per picture |
| Global Pixi defaults | `TextureSource.defaultOptions.scaleMode`, set per entry | Set before each pose runs, from the test's `artStyle` |
| Left-over views | A failed pose could leave its view mounted | Unmounted and destroyed in a `finally` |
| Stylesheets | HTML views import CSS that stays in the page | HTML pictures run isolated per file (section 4.5) |
| CSS transitions and animations | HTML views use them | Screenshots taken with animations disabled; transitions finish at once |
| Text caret, focus | The Arcade's search box | Caret hidden; poses do not focus unless that is the state photographed |
| Order of tests | Shared page (section 4.3) | The resets above; a shuffled run in CI each week checks that order changes nothing. The spike's shuffled runs found the three rows above it; with them fixed, every order gave the same 1000 pictures |
| A pose that draws nothing | A view placed out of the picture's frame, or not mounted | A picture that is all background fails ("the view drew nothing inside it") |

### 5.2 Across machines: what differs

Everything in section 5.1 is within our code. Across machines, the
browser and the machine under it differ, and each of these changes
pixels:

| Source | How it differs | Effect on pictures |
| --- | --- | --- |
| **Text rasterisation** | For the fonts a system has installed, Chrome draws glyphs with DirectWrite on Windows, FreeType (moving to Fontations) on Linux, Core Text on macOS | Every glyph's antialiasing differs, even with the same font file |
| **Installed fonts** | `monospace` is Consolas on Windows, DejaVu Sans Mono or Liberation Mono on Linux; Segoe UI exists only on Windows | Different letters, widths, wrapping, bounds |
| **GPU and driver** | A different GPU, or the same one with another driver, rounds and antialiases differently | Edges, gradients, MSAA |
| **2D canvas drawing** | Chrome draws canvas 2D on the GPU where it can | The same as above, for Pixi's text, which is drawn on a 2D canvas first |
| **Browser version** | The installed Chrome updates itself | Anything, at any time, with no commit to blame |
| **Locale and time zone** | Number and date formatting (`toLocaleString`) follow the machine | Text content itself |
| **Device scale** | High-DPI screens | Picture size |
| **Colour management** | Display profiles | Screenshots' colours (not `readPixels`) |
| **CPU** | Software drawing (SwiftShader, Skia) generates or picks code for the CPU it runs on | Measured: nothing between x64 machines, and nothing in WebGL on arm64. Skia's CPU drawing on arm64 rounds differently, by at most 2 levels of 255 once section 5.4's measures are in (blur, rotated images, some edges) |
| **Text layout** | Chrome's own font engine rounds each letter's advance to a whole pixel under the default hinting; DirectWrite and macOS keep fractions | Lines of different widths, so wrapping, box sizes and everything after them move |
| **Fallback fonts** | Characters a page's fonts lack (emoji, ⛶) come from whatever fonts the machine has | Measured: differs even between two Windows machines |
| **Compositing** | macOS composites transformed boxes its own way | Rotated and 3D boxes' edges (up to 14 levels) |
| **Form controls** | A text field's default width comes from the font's average character width, which each system works out its own way. Other controls (buttons, checkboxes, radios, sliders, progress bars, meters, selects, textareas) matched everywhere | Unstyled text fields' widths |

The usual answer, one set of references per platform, is the worst of
both: every visual change needs updating on every platform, and the set
for the platform you are not on cannot be updated at all. Ruled out
(see Settled). The other usual answer, a container everyone draws in,
needs Docker or a VM (section 5.8). This proposal pins each row of the
table inside the browser instead.

### 5.3 One environment, pinned inside the browser

Each row of section 5.2, and what pins it, with nothing installed beyond
`npm ci`:

- **Browser version: Playwright's headless shell.** Playwright pins one
  Chromium build per Playwright version, and the lockfile pins
  Playwright, so the browser changes only in a commit that changes the
  lockfile. It is the same Chromium revision on Windows, Linux and macOS
  (Chrome 153.0.8010.12 for Playwright 1.63).
  `npm run test:visual` checks that it is installed and, the first time,
  has Playwright download it (its headless shell, about 100 MB) into
  Playwright's cache in the user's profile, which every checkout and
  worktree then shares. `npm ci` itself downloads nothing, so CI jobs and
  checkouts that never run visual tests do not pay for it.
- **GPU: none.** The launch arguments select ANGLE on SwiftShader, the
  CPU implementation of WebGL that ships inside Chromium, the same code on
  every operating system. A machine's GPU and driver no longer take part.
  SwiftShader is also what makes the canvas draw at all in a headless
  browser without a GPU, the cause of 018's blank canvas.
- **2D canvas: on the CPU.** Accelerated 2D canvas and GPU
  rasterisation are turned off, so Pixi's text, drawn on a 2D canvas
  before it becomes a texture, is drawn by Skia's software rasteriser:
  again the same code everywhere.
- **Compositing: in software** (`--disable-gpu --disable-gpu-compositing`),
  which brings macOS's transformed boxes into line with the others.
- **Text: not the system's.** Hinting off (`--font-render-hinting=none`),
  so Linux keeps fractional advances as Windows and macOS do; grayscale
  antialiasing (`--disable-lcd-text`); and section 5.4's measures.
- **Locale, time zone, scale, colour:** set in the browser context:
  locale `en-US`, time zone `UTC`, device scale 1, colour profile sRGB
  (`--force-color-profile=srgb`), scrollbars hidden, reduced motion.
- **CPU:** cannot be pinned, only measured, and absorbed (section 5.6).

The browser is a native process, launched by Playwright on whatever
machine runs the tests. On Windows, the full Chrome's failed-logon
problem does not come back: the headless shell makes no logon attempt
(section 8).

### 5.4 Text, the hard part

Pinning the browser build and turning off the GPU leaves text: the fonts
a machine has, how its font engine lays letters out, and how it draws
them. The first version of this design pinned text with test fonts in
formats Chrome draws with its own engine everywhere (CFF2, then COLRv1).
The spike measured that ladder and it does not hold: the same CFF2 font
is antialiased and positioned differently on Windows, Linux and macOS
(see [Spike results](#spike-results)). What holds is to take text away
from the system altogether, in two ways, one for canvases and one for
HTML.

**Canvas text (Pixi): drawn by us, as paths.** The harness replaces a 2D
canvas's `fillText`, `strokeText` and `measureText`, for the test fonts,
with its own layout and drawing: fontkit lays the text out from the test
font's file (at the weight asked for, with kerning and letter spacing),
and each glyph's outline is filled or stroked as a `Path2D`. Skia fills
paths on the CPU the same way everywhere. Fill colours, gradients,
strokes and drop shadows all apply as they do to text, since they apply
to paths. Pixi's own measuring goes through the same `measureText`, so
layout and drawing agree. The test fonts are Adobe's Source Sans 3 and
Source Code Pro, variable, under the SIL Open Font License, committed
under `src/testing/fonts/`. With this, every Pixi picture the spike made
(all 22 entry screens, every fruit machine leaf view) matched on all four
runners, one 1 level off on arm64.

**Standing in for every family the views name.** The views ask for
`monospace` (39 times), the fruit machine's
`"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`, the site's
`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`, a `ui-monospace`
stack and a `Georgia, serif` one. The harness wraps the canvas's `font`
setter and rewrites the font string Pixi sets: generic families
(`monospace`, `sans-serif`, `system-ui`, ...) and named ones (`Segoe UI`,
`Consolas`, ...) become the test fonts. A family it does not know fails
the test that used it ("font 'Comic Sans MS' is not pinned: add it to
the test fonts' names").

**HTML text: a blank font.** DOM text cannot be drawn by our code, and
nothing tried in the browser makes the system draw it the same way. So
it is not drawn. One rule, `font-family: "Visual Blank" !important`, on every
element, pseudo-element, placeholder and form control, puts all HTML
text in a test font whose every code point (cmap format 13, so nothing
falls back to a system font, emoji and CJK included) is one empty glyph,
0.625 em wide, with fixed vertical metrics. Layout is kept, and the
letters are gone. The font is TrueType: Windows (DirectWrite) and macOS
lay a TrueType font out with exact fractional advances, and agree with
each other exactly; with `--font-render-hinting=none`, Linux keeps
fractions too. (A CFF2 blank font does not work: Chrome's own engine
rounds its advances on Windows and Linux, macOS does not.) Linux still
scales a font in 64ths of a pixel where the others use the exact size, so
two more measures make it agree (found by CI in step 4): the font has
1024 units per em, a power of two, and the harness rounds every element's
font size to the nearest quarter pixel before the picture is taken. With
both, a probe of every eighth of a pixel from 6 to 40 px, in lines of 1
to 400 characters, matched exactly on all three systems at every quarter
pixel; with 1000 units per em, Linux was a 64th or two off at most sizes,
whole pixels included, enough to move a box's edge a pixel. It is written, table by
table, by `scripts/visual/blank-font.ts` (`npm run generate-blank-font
-w @mvtjs/website`), its output committed as
`src/testing/fonts/visual-blank.ttf`; a unit test checks the two agree.
The spike built it with Python's fontTools; the Node port's tables match
that font's, but for its name.

What a blank-text picture shows: every box, border, background, image,
control, bullet and underline, and the layout itself. What it cannot
show: changes to copy, text colour, weight, style or alignment; and,
since text takes 0.625 em per character rather than its real width,
and font sizes are rounded to quarter pixels, lines
wrap and boxes size differently from the real page, so an overflow that
only real text causes would not appear. For this repo's HTML views (the
Arcade's, the fruit machine's panel and terminal, the boids' panel),
layout and styling are what a visual test is for; the copy is checked,
where it matters, by scene-graph tests.

**The rest of HTML.** Three more differences were found, each pinned by a
rule the harness applies to HTML pictures only:

- **Rotated images are sampled nearest-neighbour.** Smooth sampling under
  a rotation rounds differently on arm64 (up to 26 levels). The harness
  sets `image-rendering: pixelated` on each image under a rotating
  transform, and only those: scaled images stay smooth, which matched
  everywhere. With it, the difference is 2 levels. The Arcade's tilted
  card photos look slightly jagged in their pictures.
- **Unstyled text fields are 20 characters wide by `ch`.** A text field's
  default width comes from the font's average character width, which
  each system works out its own way. The rule
  `:where(input[type=text], ...) { width: 20ch }` has no specificity, so
  any width a view sets still wins; the repo's text fields set theirs.
- **Text in an SVG drawn as an image cannot be pinned.** An SVG image
  cannot use the page's fonts, so its `<text>` is drawn with the
  system's. Art drawn as SVG images draws words as outlines, as the fruit
  machine's wild symbol now does (2026-10-07).

With all of it, the spike's 38 HTML pictures (13 of single features, 8
of form controls, 9 of images, 8 of real views) were identical on
Windows and Linux x64, and within 2 levels per channel on Linux arm64 and
macOS arm64. Section 5.6 absorbs the 2 levels.

### 5.5 A fingerprint, checked first

The worst failure of a visual suite is three hundred red tests caused by
one thing nobody can see: a different browser, a font that was not
pinned. So before comparing anything, the run checks that it is in the
reference environment.

A committed file, `packages/website/visual-environment.json`, holds the
reference environment's fingerprint:

- the browser's version, and the WebGL renderer string (which names
  ANGLE and SwiftShader, and their versions);
- the locale, time zone and device scale;
- the hashes of a **calibration set**: a couple of dozen small pictures,
  each exercising one way a picture can differ. Each test font, at
  several sizes and weights, in canvas text, with a stroke, a gradient
  and a shadow. An antialiased circle, with and without MSAA. A gradient.
  A blur filter. A texture sampled linearly and nearest. A lit, shaded
  three.js sphere. In HTML: blank text at several sizes and fractional
  sizes (its layout is the most fragile thing pinned, see section 5.9),
  boxes and shadows, a rotated box and a rotated image, filters, each
  form control.

At the start of a run, each worker draws the calibration set and compares
it with the committed fingerprint, with the same tolerance as any
picture (section 5.6). If anything differs, the run stops before the
first test, and says what differed: "the HTML text layout calibration
picture differs from the reference: text is not laid out the same way on
this machine". One clear error, not three hundred.

The same check guards updating: `test:visual:update` refuses to write
references when the fingerprint does not match, so a wrong picture cannot
be accepted by accident. Upgrading the environment (a new Playwright, so a
new Chromium) is deliberate: `test:visual:update --environment` rewrites
the fingerprint, and the same commit carries every reference the upgrade
changed, each reviewable.

### 5.6 Exact first, tolerance second

With one environment, the expected result is identical pixels, and a pass
is an identical hash. That is also what keeps passing tests fast (section
4.4).

There is one gap no pinning closes: whether software drawing gives
bit-identical results on different CPUs. SwiftShader generates its code
for the CPU it runs on, and Skia picks among code paths by the CPU's
features. Measured: between x64 machines, none; on arm64 (Linux, and
Apple Silicon Macs), WebGL is identical too, but Skia's CPU drawing
rounds differently in blurs, rotated images and some antialiased edges,
by at most 2 levels of 255 per channel, sometimes over thousands of
pixels (a rotated photo: about 1000 pixels at 2 levels; a blurred panel:
6000 at 1).

So the answer is not to give up exactness everywhere, and the tolerance
is per channel, not a count of pixels: a count small enough to catch a
real change (the workshop's "a handful") would fail these, and a count
large enough to pass them would let a real change through. On a hash
mismatch, the picture goes to Node, which compares it with the reference
pixel by pixel. It passes if no channel of any pixel differs by more
than 2 levels. Then:

- **Within tolerance:** the test passes, and the run's summary counts it
  ("12 pictures matched within tolerance, not exactly"). A count that
  grows is a signal; a count that stays at zero means the tolerance never
  mattered.
- **Beyond tolerance:** the test fails, with the diff.

The tolerance is fixed and small, for the workshop's reason: a loose one
hides real regressions (2% of mismatched pixels missed a text colour
change). A change of colour or position is almost never within 2 levels
everywhere: moving an edge by a pixel changes its pixels by far more,
and a colour tweak that small is invisible. On Windows and Linux x64 the
tolerance never applies; every picture is identical. The fingerprint
uses the same rule, so a machine whose calibration pictures differ only
within tolerance is let through, and counted.

### 5.7 Reference files: the same bytes from any machine

References are PNGs, because people review them, and VS Code's source
control view shows a PNG's old and new versions side by side. Three
choices make them consistent too:

- **Written by our encoder, never the browser's, and only when the pixels
  change.** A small PNG encoder in Node, lossless and as small as a
  simple encoder makes a picture: a palette (1, 2, 4 or 8 bits a pixel)
  for 256 colours or fewer, otherwise RGB for an opaque picture, each row
  with whichever of PNG's five filters suits it; one compression level, no
  timestamps or metadata beyond our own. Against one fixed filter in RGBA,
  it made the references 30% smaller (the spike's 1000 pictures, 34%;
  Kwazy Cactii's whole screen, 585 to 353 KB). Node's
  zlib could still compress the same pixels to different bytes on another
  version or processor, so the update never rewrites a reference whose
  pixels match (or match within tolerance): accepting a picture that did
  not really change is not a change git sees.
- **The pixel hash travels inside the file**, in a PNG text chunk written
  right after the header. Reading the expected hashes at the start of a
  run is reading the first hundred or so bytes of each reference, not
  decoding it: 500 references are a few tens of milliseconds. CI's weekly
  run (section 9) decodes every reference and checks that its pixels still
  match its hash, so a hand-edited PNG cannot pass unnoticed.
- **No platform in the name.** `SpinButtonView-spin.png`, not
  `...-chromium-win32.png`. There is one environment; a name that suggests
  otherwise invites a second set.

### 5.8 Containers, VMs and the other alternatives

Every option that was considered for pinning the environment, against the
three properties of section 1.2:

| Option | Beyond `npm ci` | Licence | Consistency | Speed |
| --- | --- | --- | --- | --- |
| **Pinned inside the browser** (recommended) | Nothing; Chromium is fetched on first run | Apache 2.0 (Playwright, SwiftShader), BSD (Chromium), OFL (fonts), MIT (fontkit) | Measured on Windows, Linux and macOS: identical on x64, within 2 levels on arm64. Canvas text drawn by us; HTML text not drawn (section 5.4) | Best: a native browser, nothing in between |
| Docker Desktop, a Linux container running Playwright's browser server | Docker Desktop, and WSL 2 on Windows | Paid for larger organisations (250 or more staff, or over US$10 million revenue); free for personal use | The most complete: the operating system, fonts and libraries pinned by an image digest | Tests tunnel the page's requests to the container; slower start |
| Podman, or Rancher Desktop, with the same container | The tool, and WSL 2 on Windows | Apache 2.0, free | As Docker | As Docker |
| WSL 2 itself, with Playwright's Linux browser | WSL 2 and a distribution | Free | Linux's fonts, but only as pinned as the distribution's packages | Good |
| A remote browser (a server, or a cloud workspace) | An account, a running server | Costs money | As a container | Network latency on every request |
| References made and checked only in CI | Nothing | Free | Complete | No local check at all: every visual change round-trips through CI |

Containers pin more than this proposal can (the whole operating system,
so HTML pictures could keep their letters), and for a team on mixed
machines they would be the conventional answer. Here they fail the third
property: every one needs an install, and on Windows each also needs WSL
2, which this machine does not have. The spike made them unnecessary.
They stay the last resort, for if a Chromium upgrade breaks the pinning
of section 5.4 and nothing inside the browser restores it: a container
(Podman, to avoid the licence question) is where this would go next. Its
speed (estimated: the same per picture, a few seconds more to start, and
tens of seconds when the VM is not yet running) would be measured then.

### 5.9 Will it last?

Pinning inside the browser leans on how Chromium and the systems under
it behave, so it is fair to ask what could undo it later. What each
measure relies on, from the sturdiest:

- **Canvas text relies on Skia filling paths.** Drawing glyphs as paths
  from the font file, with our own layout, involves no font engine and no
  system. Nothing short of a change to Skia's path filling, inside the
  pinned Chromium, can move it.
- **WebGL relies on SwiftShader.** The same CPU implementation everywhere,
  inside Playwright's Chromium. Since Chrome 137 it takes
  `--enable-unsafe-swiftshader`; Chrome keeps it for testing and headless
  use, and ANGLE's own tests depend on it. If it were ever removed, there
  would be no software WebGL common to every system (Windows has WARP and
  Linux has llvmpipe, which differ), and WebGL pictures would need one
  system or a container. This is the largest long-term risk.
- **HTML text relies on three layout engines agreeing.** The blank font's
  advances are laid out by DirectWrite on Windows, Core Text on macOS and
  Chrome's own engine (Fontations) on Linux. They agree because the font
  is as simple as a font can be (one glyph, one advance, no hinting, no
  kerning) and hinting is off; but unlike everything else here, two of
  them belong to the operating system, so an operating system update could
  in principle change them. Nothing is drawn, so only layout is at stake,
  and the HTML text calibration pictures (section 5.5) would catch it on
  the first run.
- **Software compositing and hinting rely on switches.**
  `--font-render-hinting` is a switch of the headless shell; the GPU
  switches are long-standing Chromium switches. A Playwright upgrade that
  dropped one would show in the calibration pictures.
- **Nothing on the machine can change the rest.** Skia, SwiftShader and
  the switches are inside Playwright's Chromium, pinned by the lockfile.
  Only upgrading Playwright can change them, and that is a commit.
- **An upgrade is checked where it would show.** A commit that changes
  Playwright's version, or the harness, runs the visual tests on Ubuntu,
  Windows and macOS (section 9). If a new Chromium changed any of the above, the calibration
  pictures disagree between the three, and the upgrade stops there, before
  any reference is rewritten. The fix is then to find the new switch or
  rule, as the spike found these, or to stay on the older Playwright while
  deciding. A container is the last resort (section 5.8).

## 6. Running them

### 6.1 Why Vitest

| | Vitest browser mode (recommended) | Playwright Test (the workshop) | Our own runner on `headless-chrome.ts` |
| --- | --- | --- | --- |
| Finding tests | Vitest's include glob | A registry, published on `window` by a harness page | Our own glob and registry |
| Where the test runs | In the page: a pose is ordinary code | In Node, driving a page that holds the poses | In Node, driving a page |
| One pose, one test | Yes: named, filterable (`-t`), watchable | No: one test loops over every pose | Ours to build |
| One page for every file | `isolate: false` | Yes, by design | Yes |
| Pinned browser | Playwright's Chromium | Playwright's Chromium | The installed Chrome, which updates itself |
| Comparison, update, report | Ours (section 4.4), on Vitest's commands and reporters | Built in, screenshot-based | Ours |
| Runners in the repo | One (Vitest, as now) | Two | One, plus a script |

The comparison is ours whichever runner is chosen, because the fast path
(section 4.4) is not a screenshot. Vitest is then the one that gives
unit-test ergonomics for free: the same `describe`, `-t`, watch mode and
reporters, in the runner the repo already uses. Vitest's own
`toMatchScreenshot` is not used: it captures screenshots, retries until
two agree, and names references per platform, which are the three things
sections 4 and 5 set out to avoid.

Our own runner, on `headless-chrome.ts`, was the fallback if Vitest's
per-test overhead in browser mode proved too high. The spike measured it
at about 1.5 ms a test, so it is not needed.

### 6.2 Projects, and the commands

The root `vitest.config.ts` stays as it is, the unit tests in Node. The
visual tests have a config of their own,
`packages/website/vitest.visual.config.ts`, so `npm test` and an editor's
Vitest integration see no change. It has two projects
(`scripts/visual/projects.ts`):

- **`visual`**: `src/**/*.visual.tsx` except `*.html.visual.tsx`, in
  browser mode, `isolate: false`.
- **`visual-html`**: `src/**/*.html.visual.tsx`, the same but isolated
  per file.

Both visual projects use the website's Vite config, merged, so the
spritesheet and entry facts plugins serve what the views load, and
`@mvtjs/source` resolves the libraries to their source as everywhere
else. They add the browser's launch switches (section 5.3), one setup
file (fonts, the canvas text replacement, the blank font's rule for
HTML, the seeded `Math.random`, the Pixi patch) and an
`optimizeDeps.include` listing every dependency (section 4.3). The
suffix `.visual.tsx` (not `.visual.test.tsx`) keeps the files out of the
`unit` project's default include.

| Command | Runs |
| --- | --- |
| `npm test` | As now: the unit tests, no browser |
| `npm run test:visual` | Installs Playwright's headless shell if missing, checks the fingerprint, runs both visual projects (`scripts/visual/run.ts`) |
| `npm run test:visual:update` | The same, writing a reference for every picture that changed or is new, and none for the rest |
| `npm run test:visual:environment` | The same, also rewriting the fingerprint and the calibration set's references, after a deliberate upgrade |
| `npm run test:visual -- -t SpinButton` | One group, as with any Vitest run; `-- --watch` to watch |
| `npm run test:visual:update -- --picture SpinButtonView-stop` | The test whose picture has that name, as a failure suggests. A test's full name (`SpinButtonView > stop`) has spaces and shell characters, which npm drops or a shell reinterprets on the way through (the `>` became a redirect in step 3); a picture's name has neither. The runner turns it into the `-t` pattern, and starts Vitest with no shell between |

Whether `npm test` should include the visual projects is open question 2.

### 6.3 What `visualTest` does

For each test:

1. Resets the shared state (section 5.1): seeds `Math.random`, resets
   Pixi's texture defaults, then sets nearest-neighbour scaling for a
   pixel-art pose.
2. Runs the pose, and awaits it.
3. Calls `refreshView(view)`.
4. Works out the picture's size (section 6.5).
5. **WebGL:** renders the background and the view into a pooled render
   texture, reads the pixels, fails the test if they are all background,
   hashes them, compares with the reference's hash. **HTML:** mounts the
   element in a host `<div>`, waits for fonts and images (lazy ones made
   eager), sets nearest-neighbour sampling on rotated images (section
   5.4), and asks Node, by a browser command, for the screenshot, its
   hash and the comparison.
6. On a mismatch, or a missing reference: sends the pixels to Node, and
   fails or passes as Node decides (section 7).
7. Unmounts and destroys the view (`destroy({ children: true })`,
   `destroyObject`, `destroyElement`), in a `finally`.

### 6.4 The browser commands

Vitest's browser commands are functions that run in Node and are called
from the page. The harness needs four:

- `visualReferences()`: once per worker, the table of reference names and
  hashes, read from the files' text chunks (section 5.7), and the
  fingerprint.
- `visualMismatch(name, pixels)`: decodes the reference, compares within
  tolerance, writes the actual picture and a diff to `.vitest/visual/`,
  or, when updating, writes the new reference. Returns the verdict.
- `visualCapture(name, rect)`: for HTML, a screenshot of the host's
  rectangle (offset by the test iframe's position) through the DevTools
  protocol, decoded, hashed and compared the same way.
- `visualDone(names)`: at the end of a full run, the names of the pictures
  compared, so Node can list references no test used (section 7.4).

Updating is a flag Node reads (`test:visual:update` sets it), not
something the page needs to know.

### 6.5 Sizing

Without a size, the picture is the view's bounds after its first
refresh, rounded out to whole pixels, plus a small fixed margin (so an
antialiased edge or a glow at the bounds is in the picture). The bounds
are measured in the view's parent's space (the harness's holder), so the
view's own position counts: a view's `getLocalBounds()` leaves it out,
and in the spike framed two views (a banner placed at x = 480, meters at
y = 464) in empty space, whose blank pictures matched everywhere. The
view is moved by the bounds' top-left, so a view drawn around its
origin, like the spin button, is framed the same as one drawn from its
corner. A picture that is all background fails (section 5.1).

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
- **The change is intended.** Run `npm run test:visual:update` (with
  `--picture <name>`, as the failure prints it, to accept only the
  pictures meant), and review the changed references
  before staging them. An agent never stages them: as with every change,
  the user stages while reviewing.

The value is in that review. A reference accepted without looking is a
test that has stopped testing.

### 7.2 A new picture

A test with no reference fails, in every mode but update, with "new
picture: run `npm run test:visual:update -- --picture <name>`, and review it".
It never writes a reference by itself: in CI, a missing reference must be
a failure, not a file written into a throwaway checkout.

### 7.3 Size

A leaf view's picture is small (the spin button is about 120 pixels
across). A top-level view of a pixel-art game is its screen at
resolution 1 (Crumb Chase's is its maze at 20 pixels a tile, plus its
HUD), and PNG compresses flat pixel art well. Measured in step 3, with
the encoder of section 5.7: a spin button 3.5 KB, a game screen 12-17 KB,
a blurred reel window 85 KB (blur does not compress); the 36 references
then committed, 305 KB. A hundred pictures come to about 1.5 MB, and git
keeps every version of each. The guidance that follows: photograph leaf
views, plus one or two whole screens per entry, not every frame of every
animation.

Three measures keep size, and so storage and drawing time, in hand
without making pictures less exact:

- **One option, `artStyle`: `'pixel'` or `'smooth'`.** A picture is
  drawn as pixel art unless its test says `artStyle: 'smooth'`: hard
  edges, whole-pixel positions, and
  nearest-neighbour sampling for the textures a pose makes (the games'
  spritesheets are always nearest-neighbour). A smooth picture gets
  antialiased edges, fractional positions and smooth sampling. A test
  that leaves a smooth view at the default gets a jagged picture: unfaithful,
  but consistent, and plain to see in review.
- **A budget, `maxPixels`**, set once in `vitest.visual.config.ts`,
  default 500,000 (about a 960 by 540 screen). A smooth picture over it is
  drawn at a lower resolution, halving until it fits (half, a quarter,
  ...), so each picture pixel is an exact square of view pixels. It stays
  exact (SwiftShader draws it the same everywhere), but every detail
  finer than a picture pixel is averaged away, so the summary lists every
  picture drawn that way. Pixel art is never drawn smaller (it would drop
  whole texels), nor HTML (the browser's own scaling differs between
  systems): over the budget, they fail, saying to crop the picture
  (`width`, `height`), pose part of the view, or give a smooth view
  `artStyle: 'smooth'`.
- **The figures, every run.** The summary gives the references' total
  size and the largest files, beside the timings.

Downscaling every picture after it is drawn was considered and rejected
(2026-10-08): it saves no time, since drawing, not hashing or diffing, is
where the time goes (86% of it), and diffing happens only for a picture
that changed; and averaging makes a change smaller, so that a one-pixel
change of 8 levels becomes 2 after a 2:1 downscale, inside the tolerance
arm64 needs. Drawing smooth views over the budget at a lower resolution
gets the speed, and the summary keeps it in view. So were a per-test
`resolution` and an opt-out `large` (2026-10-08): one option and one
budget are simpler, and pixel art is the default because leaving out the
option should never make a picture less exact.

### 7.4 Orphaned references

Renaming or deleting a test leaves its reference behind. A full run ends
by listing the references no test compared with, and failing;
`test:visual:update` deletes them instead (and a test file's directory,
and `__screenshots__`, when that empties them).

A full run is one the runner was given no arguments for but
`--sequence.shuffle` and its seed (so the weekly run counts), not
interrupted, with every file loaded and no test skipped: only then is an
unused reference an orphan, not the reference of a test that sat the run
out. Vitest does not tell reporters a run's file filters, so the runner,
which sees every argument, says whether a run is full. Each test records
its picture's name as it starts, so one that fails before drawing still
counts as using its reference; calibration pictures, drawn as a page is
set up rather than by tests, are reported to Node by the page with the
set it compared.

## 8. The browser on this machine

Chrome 153 and later test a new profile's Windows password by logging in
with a blank one, and Windows counts each attempt as a failed logon. A
benchmark suite that made a new profile per case locked the user out of
the machine on 2026-10-02 (fixed in `e433c90`); `headless-chrome.ts` now
keeps one profile for every launch.

**Playwright's headless shell does not do it.** Measured in step 1: the
account's bad-password count stayed at 0 across a new persistent profile,
Playwright's default fresh temporary profile, and about 80 later runs;
one launch of the installed Chrome 154 with a fresh profile, as a
control, raised it by exactly one. The count can be read without admin
(the Security log cannot):
`([ADSI]"WinNT://$env:COMPUTERNAME/$env:USERNAME,user").BadPasswordAttempts`.
So the visual projects use Playwright's default launch, with no
`persistentContext`, and any number of workers.

The rule for agents changes accordingly: visual runs may be repeated
freely; launches of the installed Chrome (the thumbnail and load-time
scripts, `headless-chrome.ts`) keep the old care. If a Playwright upgrade
ever brings a headless shell that does test the password, the first run
after it will show it in that count, which `npm run test:visual` can
check on Windows before and after launching, and refuse to go on.

## 9. CI

The deploy workflows run `npm test` on `ubuntu-latest`, unaffected. The
visual tests have a workflow of their own, `.github/workflows/visual.yml`:

- **Every push, on Ubuntu.** `npm run test:visual` after the same
  `npm ci`, with Playwright's browser kept between runs by the cache
  action, keyed on Playwright's version. About 5 s of tests; the job,
  `npm ci` and the browser included, takes under a minute. Pull requests
  from forks run it too (a pull request from a branch here is already
  run by its push).
- **All three systems when the pinning could change.** A first job
  compares the commit with the one before it (a new branch, with `main`):
  if Playwright's version changed (so Chromium's), or the harness did
  (`src/testing/`, `scripts/visual/`, the visual config, the fingerprint,
  the workflow), the tests also run on `windows-latest` and
  `macos-latest` (arm64). An upgrade or a harness change that draws or
  lays out differently on one system is caught before it is accepted
  (section 5.9). Its first run did exactly that: Linux laid the blank
  font out a fraction of a pixel differently at fractional font sizes,
  which section 5.4's two measures now pin.
- **Weekly, and on demand** (Mondays 03:00 UTC, or "Run workflow"): all
  three systems, since runner images change under us (`ubuntu-latest`
  moves to Ubuntu 26 on 2026-10-19); the tests in a shuffled order
  (`--sequence.shuffle`, seeded with the run's id, printed in the log to
  repeat it), to show no picture depends on the ones before it (section
  4.3); and `npm run test:visual:check-references`, which decodes every
  reference and checks its pixels against the hash it carries (section
  5.7).

No job writes references: contributors on any of the three systems (and
Claude Code's cloud sessions, on Linux) update them on their own machine.
A changed picture fails its job with an annotation per picture on the
run's page (Vitest's `github-actions` reporter: how many pixels, by how
much, the rectangle holding them, and the files), and the actual and diff
images are uploaded as an artifact for the reviewer. A failure before any
test (the environment check) has no annotation of its own, so the job
makes one from the run's last lines. The visual summary (timings, sizes)
goes on the job's summary page.

## 10. Whole entries, for free

The thumbnail page (`src/snapshot.ts`) already knows how to start any
entry headless at its play size, advance it by `thumbnailAdvanceMs` in
16 ms steps, playing its `thumbnailInput`, and draw one frame. That is a
visual test of the whole entry, minus the comparison.

One file, `entries/entries.visual.tsx`, loops over the catalogue and
makes one `visualTest` per Pixi entry from the same code: the runner's
`startPixiHeadless` and `advanceHeadless`, which the thumbnail page now
uses too. Every entry has a test of its whole screen, written once,
catching what no leaf test sees: layout, layering, a view left out of its
parent. Each is drawn at its thumbnail moment, in its own art style (the
test file reads the starter's `pixelArt`; the harness knows nothing of
entries), on black as the host draws round a play area. A smooth entry
over the size budget is drawn at a lower resolution (Boids, 960 by 605,
at half); pixel art over it is cropped by the test file (Kwazy Cactii,
1600 by 2180, to three of its tiles and its score bar). The spike
did this for all 11 Pixi entries, at their thumbnail moment and two
seconds in: 22 pictures, about 4 s, identical on all four runners with
canvas text drawn as paths. Its fruit machine reels and paytables
differed until the wild symbol's word became outlines (section 5.4), and
Astrovoid's until its asteroid seeds moved into its model (section 5.1).

Two cautions:

- **Element entries say when they are ready.** The thumbnail page gave
  them 500 ms of real time to lay themselves out and start their
  renderers. Since step 6 an element session has an optional `ready`
  promise (the fruit machine's settles when its Pixi renderer has
  started), which both the page and `entries.html.visual.tsx` await, so no
  wall-clock wait is left. Element entries are HTML pictures, being part
  DOM; their WebGL canvases appear as on screen. The two over the size
  budget (the fruit machine, 1280 by 800, and Boids 3D, 960 by 600) are
  laid out at 880 by 550, as in a smaller window.
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
and gains the problems this proposal is built around (speed, and
consistency without a container, with its compromises: canvas text drawn
by the harness, HTML text not drawn at all), since they are what a
reader adopting MVT elsewhere most needs to hear. The view skill (`skill-mvt-view.md`)
asks for a `.visual.tsx` beside a new view, with a picture per state its
bindings can show. AGENTS.md's command table gains the commands, and the
project structure page gains `__screenshots__/`, `src/testing/` and
`scripts/visual/`.

## 12. Open questions

1. **Is blank HTML text enough?** HTML pictures check layout and
   styling, not copy, and lay text out 0.625 em per character, not at its
   real width (section 5.4). For this repo's HTML views that is what a
   visual test is for. Recommendation: accept it; revisit if an HTML
   view's looks come to depend on its text (a view whose overflow
   matters, say), which a scene-graph test or a container would then
   cover.
2. **Visual tests in `npm test`?** Measured: 1000 pictures in 12.7 s; a
   realistic suite of a few hundred would add 4-6 s and a browser launch,
   plus the one-time download. Recommendation: decide after step 3, with
   real tests to time; lean towards yes.
3. **A package?** `visualTest` and `advanceTime` are not specific to the
   website, and `advanceTime` is not specific to visual tests. A private
   `@mvtjs/testing` would serve the benchmarks or a future package's own
   views; a published one would serve users of the libraries, and the
   pinning of section 5 would be most of its value. Recommendation: start
   in the website, and move it when a second package needs it.
4. **What if SwiftShader draws something wrongly?** If a view uses a
   feature software WebGL gets wrong, its pictures would be consistently
   wrong, which still catches changes, but would confuse a reviewer.
   Decide when it happens, if it does.
5. ~~**Resolution 1 or 2 by default?**~~ Settled 2026-10-08: 1, never
   more; a smooth picture over the size budget is drawn at less to fit
   (section 7.3).
6. ~~**A lint rule against module-level `let` in model files?**~~
   Settled 2026-10-08: added in step 2 as `@mvtjs/no-module-state`, in
   the `architecture` preset beside `no-wall-clock`. Astrovoid's shared
   asteroid counter (section 5.1) was the only case, already fixed.

## 13. Implementation steps

1. ~~**Spike, and measure.**~~ Done 2026-10-07; see [Spike results](#spike-results). Before building anything to keep:
   - **The browser.** Add `@vitest/browser-playwright` and `playwright`;
     launch Playwright's Chromium headless shell with SwiftShader and
     software 2D canvas, with `persistentContext`. Confirm the canvas is
     not blank, and record the WebGL renderer string. Count failed logons
     before and after two runs (section 8).
   - **Consistency.** Draw the calibration set and a few real views, with
     the test fonts (rung 1). Run ten times here: identical hashes, or how
     much noise. Run the same on GitHub's `ubuntu-latest` and
     `windows-latest` runners: identical to this machine's, or how much
     noise, and in which calibration pictures. If text differs, climb the
     ladder (section 5.4) one rung at a time and record each result.
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
2. ~~**The harness**~~ Done 2026-10-08. Browser side in
   `src/testing/` (`#testing`), Node side in `scripts/visual/`, with unit
   tests for the font, the PNG files, the comparison, the picture names
   and `advanceTime`, and its own visual tests
   (`src/testing/visual-test.visual.tsx` and its `.html.` sibling): ten
   pictures in about 2 s, start-up included. A changed picture fails with
   its reference, actual and diff paths and the command to accept it; a
   wrong environment stops the run in a second, before any picture is
   compared. Built as listed: from the spike's code (`packages/website/visual-spike/`,
   in `visual-tests`' history up to `b7f40c3`), rewritten to the repo's conventions. `#testing`
   with `visualTest` (Pixi first, then HTML) and `advanceTime`; the setup
   file and its resets, the seeded `Math.random` and the Pixi pool patch;
   the test fonts, the canvas `font` rewrite and the canvas text drawn as
   paths (on fontkit); the blank TrueType font and its generator, the HTML
   rules (blank text, text fields' width) and nearest-neighbour rotated
   images; the launch switches; the PNG encoder and its hash chunk; the
   per-channel comparison; the browser commands, the HTML capture through
   the DevTools protocol among them; the fingerprint and the calibration
   set; the two visual projects, with every dependency pre-bundled; the npm
   scripts, with the browser installed on first run; `.vitest/` in
   `.gitignore`. The run's timing summary. The lint rule of open
   question 6.
3. ~~**First tests.**~~ Done 2026-10-08. Eleven pictures beside their
   views: the fruit machine's spin button (its three modes), win banner
   (a win counted, and counting up 300 ms in), reel window (at rest, and
   spinning), and control panel (HTML: ready, and mid-spin); and Crumb
   Chase's whole screen (pixel art: at the start, and two seconds in).
   With the harness's own, 21 pictures in about 2.5 s. References: 220 KB
   for the eleven, 20 KB each on average (a spin button 3.5 KB, a game
   screen 17 KB, the blurred reels 95 KB: blur does not compress), so a
   hundred pictures come to about 2 MB. The deliberate change (the spin
   button's stop colour) failed only its own picture, with the diff
   files and the command to accept it, and that command rewrote that one
   reference and no other. Found on the way:
   - The suggested `-t "SpinButtonView > stop"` lost its quotes through
     npm, and its `>` became a shell redirect. Hence `--picture <name>`
     (section 6.2), and the runner starts Vitest and Playwright with no
     shell.
   - HTML views here return `Element`, not `HTMLElement`; `visualTest`
     takes either.
   - A view styled by its entry's layout needs that layout round it: the
     fruit machine's panel sits in a quadrant of a two-by-two grid, so its
     pose builds one quadrant spanning a machine one quadrant in size, at
     the size the entry's play area gives it (derived from the entry's
     `screenWidth` and `screenHeight`).
   Original plan: the fruit machine's Pixi leaf views (spin button, win
   banner counting, reel window), one pixel-art game screen, and one HTML
   view (the Arcade's card, or the fruit machine's control panel). Make a
   deliberate change to one view, and check that its test fails with a
   useful diff, and that the update command accepts it and only it.
   Record the size of the references.
4. ~~**CI.**~~ Done 2026-10-08, as section 9 describes:
   `.github/workflows/visual.yml`, replacing the spike's workflow, and
   `npm run test:visual:check-references`; the spike's code deleted. On
   Ubuntu the job takes about 35 s with its caches warm, 5 s of it tests;
   Windows and macOS about a minute and a half. Checked: a view change
   runs Ubuntu only and fails with an annotation per picture and the diff
   images as an artifact; a harness change runs all three; the weekly
   path (dispatched by hand) shuffled the order on all three and found
   all 36 references matching their hashes. Found on the way:
   - **The first cross-platform run failed, usefully.** Ubuntu stopped at
     the HTML calibration: one box's edge a pixel off, in the 17.3 px line
     of `blank-text`. The spike had seen Linux lay the blank font out a
     fraction of a pixel differently at some fractional sizes, but its
     real views never crossed a pixel. A probe of every eighth of a pixel
     from 6 to 40 px, in eight font variants and three `text-rendering`
     values, showed that Linux scales fonts in 64ths of a pixel; with 1000
     units per em it was off at most sizes, whole pixels included, and
     no `text-rendering` value helped. With a power of two (16, 64, 1024
     or 2048 units per em) all three systems matched exactly at every
     quarter pixel, in lines of 1 to 400 characters. Hence the blank font
     at 1024 units per em (0.625 em advances, not 0.6) and font sizes
     rounded to quarter pixels by the harness (section 5.4). macOS now
     matches Windows exactly in every picture, without the tolerance.
   - A failure before any test (the calibration's abort) makes no Vitest
     annotation, and the logs need a login to read; the job turns the
     run's last lines into an annotation then. Every difference's message
     now gives the rectangle holding it.
   - `npx playwright install --with-deps` took up to ten minutes on a slow
     Ubuntu mirror, mostly fetching fonts the harness never uses; the
     runners already have the libraries, so it is not used.
5. ~~**Whole entries.**~~ Done 2026-10-08, as section 10 describes: the
   eleven Pixi entries, one picture each, 180 KB of references (Kwazy
   Cactii's crop 64 KB, Falling Sand 35 KB, the pixel-art games 1 to 3
   KB). With the rest, 33 pictures in about 4 s here and 7 s on
   Ubuntu, cold, identical on all three systems. Found on the way: an
   entry's code brought in `pixi-solid` and Solid, which Vite's optimizer
   then found mid-run (with a warm cache), the case that loads a second
   Pixi; they are pre-bundled with the rest now, and the projects'
   comment says any new dependency of an entry belongs there.
6. ~~**three.js.**~~ Done 2026-10-08, as sections 3.5 and 10 describe:
   `camera` and `scene` options (a dressing function in place of the
   planned `environment: 'room'`, so a view is drawn in its entry's own
   scene, which the fruit machine's `dressBanditScene` and
   `frameBanditCamera` now share between its starter and its tests),
   drawn on a canvas, not a render target (planned), for tone mapping.
   Two three.js pictures in the calibration set (lights; a room
   environment, tone-mapped), three in the harness's own tests. Tests:
   the lever (at rest, 200 and 450 ms into a pull), the bandit (ready, and
   mid-spin), the flock (at the start, and two seconds in); and the two
   element entries' whole screens, in `entries.html.visual.tsx`. 45
   pictures: about 8 s here, 13 s on Ubuntu, identical on Windows and
   Linux and, for 12 three.js pictures, within the tolerance on macOS.
   Found on the way:
   - **An environment map is slow in software WebGL**: a second here, five
     on a CI runner, and every picture of the bandit paid it until the
     harness kept each dressing's scene (the lever's later pictures went
     from a second to 5 ms). `readPixels` is where it shows, since it waits
     for the work queued before it. Each page still pays it once per
     dressing; the calibration's own uses a 32-pixel map, the same code
     for a fraction of the time.
   - **The texture registry's sampling was never applied.** Shuffling
     the order (new test files moved the entries' file) changed two entry
     pictures, Neon Monsoon and Kwazy Cactii: `createTextureRegistry`
     asked for nearest-neighbour sampling as `data.scaleMode`, which Pixi
     8's spritesheet loader ignores (it reads `data.textureOptions`). So
     every pixel-art game's sheet took whatever
     `TextureSource.defaultOptions.scaleMode` was when it loaded: on the
     site, smooth for the first game started on a fresh page, nearest for
     one started after a pixel-art game, and smooth in every thumbnail.
     Fixed in `@mvtjs/pixi`, with a changeset; Kwazy Cactii, whose art is
     scaled, now looks the same, slightly crisper, every time, and its
     thumbnail will change when they are next made.
7. ~~**Orphaned references**~~ Done 2026-10-08, as section 7.4
   describes. Checked with two planted orphans, one a test's and one a
   calibration picture: a full run listed both and failed (every test
   passing), a filtered run (`--picture`) ignored them, and the update
   deleted them.
8. **Docs** (section 11), with the documentation skill.

## Spike results

The record of step 1. The design sections above were revised to match on
2026-10-08; this section keeps what was measured, and how.

Measured 2026-10-07 on branch `visual-tests` (from `vnext` at `5afdd2e`):
Vitest 5.0.1, `@vitest/browser-playwright` 5.0.1, Playwright 1.63.0, whose
headless shell is Chrome 153.0.8010.12. This machine: Windows 11, 14
cores. CI: GitHub's `windows-latest`, `ubuntu-latest`, `ubuntu-24.04-arm`
and `macos-latest` (arm64). The harness is the design of sections 4 and 6
in miniature: one shared page (`isolate: false`), one Pixi renderer,
render textures read with `readPixels`, SHA-256 in the page, and a
Node-side command only on a mismatch.

### The browser and failed logons (section 8)

**Playwright's headless shell makes no logon attempt.** The account's
bad-password count (readable without admin through ADSI,
`[ADSI]"WinNT://<computer>/<user>,user"`, `BadPasswordAttempts`) stayed at
0 across a brand-new persistent profile, Playwright's default fresh
temporary profile, and about 80 later runs. As a control, one launch of the
installed Chrome 154 with a fresh profile raised it by exactly one. So
`persistentContext` is not needed; the logon problem belongs to the full
Chrome only. SwiftShader WebGL 2 works headless
(`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)...))`), launched
in about 0.6 s.

### Speed (section 4)

1000 pictures of real views (fruit machine leaf views: spin buttons, win
banners mid-count, meters, marquee lights, reel windows, paytables, game
over; and 20 whole entry screens), 100 files, one worker:

| Measure | Target | Measured |
| --- | --- | --- |
| 1000 pictures, start-up included | 10 s for 500 | 12.7 s wall |
| Start-up (Vitest, Vite, browser, page, fonts) | 3 s | about 2.4 s |
| A WebGL picture, median | 5 ms | 6.1 ms (spin button 1.9, meters 3.9, banner 6.4) |
| The same, 95th percentile | 25 ms | 22.4 ms (reel window, 592 by 360 with a mask, 22 ms; whole screens median 38 ms) |
| Vitest's own cost per test | | about 1.5 ms |
| Watch mode: edit a view, its file re-runs | under 1 s | about 230 ms |
| HTML picture (element screenshot) | 30 ms | 90-130 ms through `page.screenshot`; 35-60 ms through the DevTools protocol (`Page.captureScreenshot` with a clip, `optimizeForSpeed`), identical pixels |
| Memory | no leak | about 100 MB after garbage collection, then about 3 MB more per 100 pictures |

Where the time goes: drawing in SwiftShader (86% of in-page time), then
building the views (10%); hashing is 3%, under 1 ms for a 960 by 540 picture.

Two, four workers: 9.6 s and 9.5 s against 10.8 s for one (before the
banner fix below). Not worth the extra start-ups and memory: one worker by
default.

What the design saves, on the same 100 pictures:

| Setup | 100 pictures |
| --- | --- |
| Vitest's defaults (a fresh page per file) and `toMatchScreenshot` | 12.0 s |
| One page, `toMatchScreenshot` | 10.4 s |
| A fresh page per file, pixels from the renderer | 4.9 s |
| One page, pixels from the renderer (this design) | 3.1 s |

Screenshots cost about 90 ms a picture; isolation about 180 ms a file.
1000 pictures done the obvious way would take about two minutes.

### Consistency within a run (section 5.1)

Ten runs in a row, and shuffled runs (`--sequence.shuffle`), give identical
hashes for every picture, once four things found by the spike were fixed.
Each is a design change:

1. **Every dependency must be pre-bundled before the first test.** Vite's
   optimizer found a new dependency mid-run and re-bundled, so files after
   that point loaded a second copy of Pixi (`Texture.WHITE` was no longer
   the first copy's, and text fills threw). The visual project lists every
   dependency in `optimizeDeps.include`. A stale optimizer cache after a
   dependency change can still break the first run after it; CI starts cold
   and is not affected.
2. **A Pixi bug: `BatchableGraphics.reset()` keeps `roundPixels`.** Pooled
   batches from a pixel-art (rounded) graphic round the next graphics
   context built from the pool, so a smooth view's curves snapped to whole
   pixels depending on what was drawn before it (one MSAA sample at
   rounded corners). Found by shuffling, isolated by probes, fixed in the
   harness by patching `reset` to clear it. The same can happen in the
   Arcade when a smooth entry follows a pixel-art one in the same page.
   Worth reporting to Pixi.
3. **Module-level state in a model.** Astrovoid's `asteroid-model.ts`
   keeps `let nextSeed = 1` at module level, so asteroid shapes depend on
   how many asteroids the page made before. It is the only module-level
   `let` in any entry. The model should own the counter; a lint rule
   (no module-level `let` in model files) would keep it so.
4. **The harness's own.** Pictures are framed by the bounds of a holder
   around the view, so the view's own position counts (`getLocalBounds()`
   on the view leaves it out, and framed two views in empty space). A
   picture that is all background now fails ("the view drew nothing inside
   it"). Hooks registered in a module shared between files run for the
   first file only, so per-test cleanup belongs in the harness, never in a
   shared module.

Also measured: one Pixi renderer serves pixel-art and smooth pictures
(MSAA is the render texture's, rounding is set per picture); the WebGL
context's own `antialias` attribute changes MSAA edges in render textures,
so it must be fixed, not left to default. A three.js picture between Pixi
pictures changes nothing.

### Consistency across machines (section 5.2 to 5.4)

Two CI rounds on four runners, every picture hashed and compared with the
references made on this machine.

**Everything but text is bit-identical everywhere.** Graphics with and
without MSAA, gradients, blur filters, linear and nearest texture
sampling, stencil masks, three.js lighting, whole pixel-art screens, and
DOM boxes with gradients, rounded corners, shadows and rotation: the same
hashes on Windows x64, Linux x64, Linux arm64 and macOS arm64. SwiftShader's
two code generators (Subzero on x64, LLVM on arm64) agree. The CPU
question of section 5.6 is answered: no difference for WebGL.

**Windows to Windows is identical, text included**, in every variant:
GitHub's `windows-latest` matched this machine on all 39 calibration and
entry pictures and all 1000 speed pictures (bar the two Astrovoid
pictures, finding 3 above).

**Text, rung by rung (section 5.4):**

| Rung | Canvas text (Pixi) on Linux and macOS | DOM text on Linux and macOS |
| --- | --- | --- |
| 1. CFF2 test fonts | Differs: antialiasing (max channel delta 51) and glyph positions (223); macOS lays text out narrower (a 1049-pixel line is 1042) | Differs |
| 1a. The same, with `--font-render-hinting=none --disable-font-subpixel-positioning` | Worse: sizes differ on Linux too | Differs |
| 2. COLRv1 test fonts (built by `fonts/build-colr.py`) | Differs; and colour glyphs ignore a gradient fill, as predicted | Differs |
| 2a. COLRv1 with the flags | Differs | Differs |
| **3. Canvas text drawn as paths** | **Identical** on Linux x64. On the two arm64 runners, identical except one picture (a drop shadow, 367 pixels off by 1 level of 255) | Not covered |

Rung 3, as built in the spike (`text-paths.ts`, about 200 lines): the
canvas's `fillText`, `strokeText` and `measureText` are replaced, for the
test fonts only, by fontkit's layout of the same CFF2 files (at the weight
asked for, with kerning) and `Path2D` fills. Fill styles, gradients,
strokes, letter spacing and shadows work unchanged, since they apply to
paths as to text. With it, all 22 entry screens and every fruit machine
leaf view match across all four systems.

**Two kinds of text no rung pins:**

- **DOM text.** Nothing tried inside the browser makes it match. Rung 4
  (Windows as the one reference system) is the answer for HTML pictures:
  their project runs on Windows only, and in CI on `windows-latest`.
- **Text inside an SVG drawn as an image.** The fruit machine's wild symbol
  is an SVG with a `<text>` element in Arial Black; an SVG image cannot
  use the page's fonts, so it is drawn with the system's. It made 73 reel
  windows and all 40 paytables differ. The fix belongs in the art: draw the
  word as outlines.

The off-by-one shadow on arm64 is what section 5.6's tolerance is for: it
would pass, counted, within tolerance.

### HTML without containers (study, 2026-10-08)

Can HTML pictures match across systems if text is given up? Two CI rounds,
21 HTML pictures: 13 of single features (8 without text: boxes, borders,
transforms, filters, images, native form controls, a scrolling box, a
canvas; 5 with text: wrapping, weights, symbols and emoji, decorations and
lists, controls with labels), and 8 of real views (the Arcade's card, entry
info, pause menu and about note; the 3D boids' panel; the fruit machine's
control panel twice and its terminal). Each file isolated, with its own
stylesheet. Five ways of treating text, each compared with Windows
references:

| Text | Windows x64 | Linux x64 | Linux arm64 | macOS arm64 |
| --- | --- | --- | --- | --- |
| Native (as the page asks) | 20/21: symbols and emoji differ in size | 9/21 | 8/21 | 7/21 |
| **Blank**: one empty glyph, 0.6 em wide, for every code point | **21/21** | **21/21** | 18/21, the rest within 14 levels of 255 | 10/21 |
| Block: the same, drawn as bars | 21/21 | 9/21: bar edges antialiased differently | 8/21 | 7/21 |
| Blank with real widths (the sans test font, outlines removed) | 21/21 | 15/21: buttons a pixel apart | 13/21 | 11/21 |
| Green text, differ ignoring green | 20/21 | 9/21 | 8/21 | 6/21 |

**Is it only text that differs?** Between Windows and Linux on x64, yes:
all 8 pictures without text matched exactly, native checkboxes, radios,
range sliders, progress bars, meters and scroll boxes included. On arm64
(both systems), blur and backdrop filters differ by 1 level, and a
rotated, scaled image (the Arcade card's photo) by up to 14: numeric
differences in Skia's CPU code, which a per-channel tolerance of about 16
levels would absorb (a count of mismatched pixels would not: the card has
21,000 of them). macOS differs in more than text, though its form
controls without labels matched: rotated and 3D-transformed boxes
antialias differently (98 pixels, up to 14 levels), and the card's
photo differs by up to 210 levels.

**Why blank works and the others do not.** Text decides layout through
its glyphs' advances. On Windows and Linux, Chrome rounds each advance of
the blank font to a whole pixel (13 px text: 0.6 em is 7.8 px, laid out
as 8), the same on both; macOS keeps fractions (7.802), so lines are
different widths there. A real font's advances and kerning do not round
the same way on Windows and Linux (a 22-letter line: 121.984 against
122.000 pixels), enough to move a button's edge by a pixel. Bars are
drawn by each system's glyph rasteriser, which antialiases their edges
differently. Green text keeps the native fonts, so everything laid out
around the text moves: the entry info panel still differs in 14,000
pixels that are not green.

**Native text is not stable even between Windows machines.** The symbols
and emoji picture changed size between this machine and GitHub's Windows
runner: characters the page's fonts lack (⛶, emoji) come from whatever
fonts each machine has installed. The Arcade's runner view uses ⛶. With
the blank font, which maps every code point, nothing reaches a system
font, and the two agreed.

**What blank text costs.** Pictures keep every box, border, background,
image, control, bullet, underline and the layout itself, and lose the
letters: a change to copy, text colour, weight, style or alignment is
invisible, and text takes 0.6 em per character, so lines wrap and boxes
size differently from the real page (an overflow that only real text
causes would not show). Canvas text is unaffected: it keeps rung 3.

**Conclusion.** Blank HTML text gives identical pictures on Windows and
Linux x64, the systems of this machine, CI and Claude Code's cloud
sessions; on arm64 Linux, identical within a small per-channel tolerance;
not on macOS. It also makes the Windows-only route safer, since native
HTML text differed between two Windows machines.

**Bringing macOS in: fractional advances everywhere.** Who rounds the
blank font's advances depends on which engine lays it out: Chrome's own
font engine (every CFF2 font, and on Linux every web font) rounds them
to whole pixels under the default hinting; DirectWrite (a TrueType font
on Windows) and macOS keep exact fractions, and agree with each other to
the 1/64 pixel. `--font-render-hinting=none` makes Linux keep fractions
too; it changes nothing on Windows. So the blank font is rebuilt as
TrueType (`fonts/build-blank-variants.py`, `VTBlankTT.ttf`; an empty
glyph, every code point, which DirectWrite honours) and the browser
launched with that flag:

| | Windows x64 | Linux x64 | Linux arm64 | macOS arm64 |
| --- | --- | --- | --- | --- |
| TrueType blank text, `--font-render-hinting=none` | 21/21 | 20/21 | 17/21 | 18/21 |

All 8 real views match on all four, except the Arcade card's photo on
the two arm64 runners (up to 14 levels). What is left:

- Form controls with text at their default size (13.33 px): Linux's
  advances differ from Windows' and macOS's by a fraction of a pixel at
  some fractional sizes (17.3 px: 228.125 against 228.234 for 22
  characters), enough to move a control's edge. The repo's own controls
  set `font: inherit`, so its views escaped it here.
- arm64: blur and backdrop filters (1 level), a wavy underline (1 level),
  the scaled photo (14 levels).
- macOS: rotated and 3D-transformed boxes (98 pixels, up to 14 levels).

Every remaining difference but the default-sized controls is within 14
levels per channel, so a per-channel tolerance of about 16 would pass all
the real views on all three systems. Next to try: the photo (lossless
images, or nearest-neighbour scaling), and the default control size.

**The photo, the controls and the compositor** (one more round, 30
pictures: the 21 above and 9 of images):

- **Rotation, not decoding.** WebP and PNG pictures at natural size,
  scaled smoothly and scaled pixelated all match on every system. Rotated
  ones differ on both arm64 runners, identically (up to 26 levels): it is
  the CPU, not macOS. The Arcade card's photo is tilted, which is all of
  its difference.
- **Controls' default size is not the cause.** With
  `:where(input, button, select, textarea) { font-size: 13px }`, which
  replaces only the browser's default, the controls-with-text picture
  still differs on Linux and macOS (the same as before, near enough).
  Something in the controls themselves (a select's arrow, a text field's
  inner box) is drawn or sized per system. The repo's controls are a
  styled button, progress bars and a range slider, and all of them
  matched.
- **Software compositing** (`--disable-gpu --disable-gpu-compositing`)
  fixes macOS's transformed boxes, but adds 1-level differences on both
  arm64 runners in the fruit machine panel, the entry info and the
  filters. Not worth it.

With TrueType blank text, hinting off, and nothing else: Windows 30/30,
Linux x64 29/30 (only the unstyled controls with text), and on arm64 the
rotated images (26 levels), blur and backdrop filters (1), a wavy
underline (1), the unstyled controls, and on macOS its transformed boxes
(14).

**Closing the gap** (two more rounds, 38 pictures: 8 more, one per form
control):

- Buttons (default, disabled, styled), selects and textareas match
  everywhere. Only unstyled text fields differ, in width: their default
  width comes from the font's average character width, which each system
  works out its own way. A zero-specificity rule sets it to `20ch` (the
  width of 20 zeros, which lays out the same everywhere); a width the
  page sets still wins.
- Rotated images sampled nearest-neighbour (`image-rendering: pixelated`,
  set by the harness on images under a rotating transform, and only
  those) cut arm64's difference from 26 levels to 2.
- Software compositing, despite its 1-level noise on arm64, removes
  macOS's 14-level transformed boxes.

All of it together, TrueType blank text, `--font-render-hinting=none`,
nearest-neighbour rotated images, software compositing
(`--disable-gpu --disable-gpu-compositing`) and the text field width:

| | Windows x64 | Linux x64 | Linux arm64 | macOS arm64 |
| --- | --- | --- | --- | --- |
| Identical | 38/38 | 38/38 | 29/38 | 29/38 |
| Within 2 levels per channel | 38/38 | 38/38 | **38/38** | **38/38** |

macOS and arm64 Linux differ from Windows in the same 9 pictures by the
same amounts: what is left is the CPU's rounding (rotated images 2
levels, blur, a wavy underline and a few panel edges 1), not the
operating system. **HTML pictures can be the same on all three systems
without containers**, given blank text and a per-channel tolerance of 2
on arm64. Pixi and three.js pictures, with text drawn as paths, already
were (one picture 1 level off on arm64).

The compromises, all confined to the visual tests: HTML text draws
nothing and takes 0.6 em per character (0.625 em since step 4, with font
sizes in quarter pixels); rotated images are sampled
nearest-neighbour; the compositor is software (as it effectively is
headless already); unstyled text fields are 20 characters wide by
`ch`, not by the font's average; and a tolerance of 2 levels, which a
real change rarely stays within.

## Settled

Do not reopen without new information.

- **Nothing to install beyond `npm ci`.** A requirement, from the user
  (2026-10-06): no Docker, no VM, nothing with a licence to check. It is
  why section 5 pins the environment inside the browser, and why
  containers are the last resort (section 5.8), not the design.
- **One set of references per platform.** Every visual change would need
  updating on every platform, and the set for a platform you are not on
  cannot be updated at all. One environment instead.
- **Tolerance as the answer to inconsistency.** A tolerance loose enough to
  absorb another operating system's text rendering is loose enough to miss
  a real change to text (the workshop's finding). Tolerance is only the
  second check, small and counted (section 5.6).
- **The machine's own Chrome.** It updates itself, so references would
  change with no commit to blame. Playwright's Chromium, pinned by the
  lockfile, instead.
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
- **Test fonts as the way to pin text** (2026-10-07). CFF2 test fonts
  (drawn by Chrome's own engine everywhere), the same as COLRv1 colour
  fonts, and either with hinting and subpixel positioning switched off:
  each still antialiased or positioned text differently on Linux and
  macOS. Canvas text is drawn as paths instead; HTML text is blank.
- **Native HTML text, on any system** (2026-10-08). It differed even
  between this machine and GitHub's Windows runner, where characters came
  from fallback fonts (emoji, ⛶).
- **Ways to keep HTML text visible without containers** (2026-10-08):
  a block font (each character a bar; the bars' edges are antialiased
  differently); a blank font with real widths and kerning (advances round
  a fraction of a pixel differently); green text with a differ that
  ignores green (native fonts move the layout around the text); a CFF2
  blank font (Windows and Linux round its advances, macOS does not).
- **Windows as the one reference system.** Considered when HTML text
  could not be pinned (2026-10-07); superseded by the blank TrueType font,
  which matches Windows, Linux and macOS, and makes Windows-to-Windows
  agree too.
- **A count of mismatched pixels as the tolerance.** arm64's rounding
  touches thousands of pixels by 1 or 2 levels; a count small enough to
  catch a real change fails those. The tolerance is per channel (section
  5.6).
