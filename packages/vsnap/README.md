# vsnap

> `vsnap` makes visual testing as convenient as unit testing.
> A visual test is a kind of snapshot test (also known as a visual
> regression test). Snapshot tests compare a test's output with a saved copy.
> In a visual test, that snapshot is an image.
> A visual test builds a view in a known state, renders it to
> an image, and compares that image with a reference image, which is an
> accepted image committed beside the test file.
> 
> To be as convenient as unit
> tests, visual tests must be fast, and must give the same result on every
> machine. This package runs hundreds of them in seconds. The images come
> out the same on Windows, Linux and macOS, and nothing needs installing
> beyond `npm ci`. It covers views drawn on a canvas, by any renderer, and
> HTML views. It draws Pixi and three.js views itself. It runs on Vitest's
> browser mode. It is not published yet.

## Requirements

- **Vitest 5.** vsnap runs on Vitest's browser mode, so visual tests are
  Vitest tests. They use Vitest's `describe`, `beforeAll` and the rest of
  its test API. A project's unit tests can use any test runner.
- **Views that Vite can compile.** Vitest compiles the tests, and the views
  that they import, with Vite. A project that builds with Vite points the
  `viteConfig` option at its config. A project that builds with something
  else needs a small Vite config, with the aliases and plugins that its
  views rely on.
- **Playwright 1.63, any patch release.** vsnap installs it, because its
  browser draws every image. Each run first checks the browser's
  fingerprint, which names its exact build, so a patch release that changed
  the browser would stop the run rather than change the images. A newer
  minor version of Playwright brings a new browser, so it needs a new
  release of vsnap. A project that uses another version of Playwright, for
  other tests, gets both copies.
- **Node 22 or later.**
- **No renderer library.** A canvas test can draw with the browser's own
  canvas, and needs no library. vsnap's support for Pixi and three.js views
  draws with the project's own copy of `pixi.js` or `three`, so a project
  that uses it installs only the library its views use.

---

## Writing a Test

A test is a declaration in a `*.visual.test.ts` or `*.visual.test.tsx`
file beside the view. The file is a Vitest test file, which runs in a
browser, and it can hold ordinary tests too. (A project can keep its tests
elsewhere, as [Choosing Where Files Go](#choosing-where-files-go)
describes.) A view drawn on a canvas is declared with
`canvasTest(name, options?, pose)`, and an HTML view with
`htmlTest(name, options?, pose)`. The options (if any) come before the pose,
as they do in Vitest's `test`. The `pose` function's only job is to return a
view that has been arranged into the pose that the test describes.

```tsx
import { describe } from 'vitest';
import { canvasTest } from 'vsnap';
import { HudView } from './hud-view';

describe('HudView', () => {
    canvasTest('at the start', () => HudView({ score: () => 0 }));
    canvasTest('a high score', { artStyle: 'smooth' }, () => HudView({ score: () => 98_765 }));
});
```

`HudView` returns a Pixi container here. vsnap knows how to draw it because
the project registers Pixi views, and makes them its default view, as
[Kinds of View](#kinds-of-view) describes.

A view that changes over time, such as one that animates, is posed at a
known moment: the pose advances it by a fixed amount of time before it
returns it. A pose never waits for real time to pass.

The options can also hold Vitest's own `timeout`, `retry`, `repeats` and
`fails`, which work as they do on `test`. So do the modifiers
`canvasTest.skip`, `canvasTest.only` and `canvasTest.todo`, and the same on
`htmlTest`. Visual tests never run concurrently, even in a
`describe.concurrent` block, because the tests of a page share its
renderers.

The first time a test runs, its image is new, and it is written as the
test's reference image, as Vitest writes a new snapshot. Look at each new
reference before committing it. In CI, where Vitest writes no new
snapshots, a new image fails its test instead.

### Kinds of View

Each canvas test is of one kind of view, which its options name as `kind`.
A kind is one that the project registers, such as `'pixi'`, or `'canvas'`,
for a canvas that the pose drew. A project registers its kinds in
`vsnap.config.ts`, which is vsnap's config for the project. It is in
vsnap's root, beside `vitest.config.ts` in a project with one package.

```ts
import { defineVsnapConfig } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';
import { threeViews } from 'vsnap/three';

const config = defineVsnapConfig({
    views: [pixiViews(), threeViews()],
    defaultView: 'pixi',
});

// Gives canvasTest's types the kinds of view above, and the default view.
declare module 'vsnap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

The file runs in the test page, not in Node as `vitest.config.ts` does,
because what it registers runs on the views: checks of their classes,
drawing, preparing and disposing. So the settings that Node needs before
any page exists, such as `maxPixels` and where the files go, are options of
`vsnap()` in `vitest.config.ts`, as [Configuration](#configuration)
describes.

- **Pixi views,** registered with `pixiViews()` from `vsnap/pixi`. The pose
  returns a Pixi container. By default, the image is framed by the view's
  bounds, and drawn as pixel art, with hard edges and whole pixels. The
  options can set the image's `width`, `height` and `background`, and
  `artStyle: 'smooth'` for antialiased art.
- **three.js views,** registered with `threeViews()` from `vsnap/three`. The
  pose returns a three.js object. A three.js view has no bounds to frame it
  by, so the options always set the image's `width` and `height`, and the
  `camera` to draw it with. They can also dress the `scene` as the view's
  game does, with its lights, environment and tone mapping.
- **A canvas that the pose has drawn,** of the kind `'canvas'`, with any
  renderer, needs no registration. It can be an `HTMLCanvasElement` or an
  `OffscreenCanvas`, drawn with canvas 2D or WebGL. A WebGL canvas that is
  in the page needs `preserveDrawingBuffer: true`, because the browser
  clears it once it is shown. The canvas stays the pose's own: vsnap
  doesn't dispose of it, since a pose may draw on the same canvas for every
  test. A pose that makes a new WebGL canvas for each test should release
  its context, since a page keeps only so many.

`defaultView` names the kind that a test is of when it gives no `kind`.
Most projects draw most of their views one way, so most of their tests give
no kind. A test of another kind names it:

```ts
canvasTest('spinning', { artStyle: 'smooth' }, () => ReelView(...));
canvasTest('at rest', { kind: 'three', width: 240, height: 300, camera }, () => LeverView(...));
canvasTest('a bar chart', { kind: 'canvas' }, () => drawChart(SALES));
```

Without `defaultView`, the default is `'canvas'`. HTML views need no
registration, unless they need preparing or disposing of, as
[Preparing and Disposing of Views](#preparing-and-disposing-of-views)
describes.

The `Register` declaration gives the config's type to `canvasTest`. So each
test's options are checked against its kind, and its pose must return its
kind's view. A three.js test that leaves out its `kind` is taken as Pixi,
so `camera` is a type error, and so is a three.js object from its pose. For
that, the project's `tsconfig.json` must include `vsnap.config.ts`. One
TypeScript program holds one `Register`, so a monorepo whose packages have
configs of their own type-checks each package on its own.

A test also checks its view as it runs, by its kind's check, such as
`instanceof Container`. A view of another kind fails its test, and the
message says which kind the view is, and the `kind` to give.

`pixiViews` and `threeViews` each keep one renderer for every image, which
is much faster than a renderer for each test. Support for another renderer
can do the same. It is a `CanvasViewKind`: a name, a check of the view, and
the steps that draw it and dispose of it. Its `draw` can return the canvas
that it drew on, and vsnap reads it. `vsnap` exports the types, with two
helpers: `fitImage` says how an image fits the size budget, and
`readCanvas` reads a canvas that was drawn smaller to fit. Listed in the
config, the kind joins `canvasTest`'s types through `Register`, as the
others do.

Each kind is listed once. Two kinds with one name, a kind named
`'canvas'`, `htmlViews` listed twice, or a `defaultView` that names no
listed kind, stop the run with an error.

#### If `canvasTest` Rejects Every View

If every canvas test that gives no kind is a type error, such as
"Container is not assignable to HTMLCanvasElement", `canvasTest`'s types
have no default view. Check that `vsnap.config.ts` has the `Register`
declaration, and that `tsconfig.json` includes the file.

### Tests, Actual Images and Reference Images

Each test renders its view to one image. This README keeps three terms
apart:

- A **test** is one `canvasTest` or `htmlTest` declaration. A test runs,
  and passes or fails.
- An **actual image** is the image that a test renders during a run.
- A **reference image**, or just a **reference**, is an image that has been
  accepted, and committed as a PNG file.

A visual test passes when its actual image matches its reference image.

An image's name comes from its test's full name. The full name is the
names of the test's `describe` blocks, followed by the test's own name.
Each run of characters other than letters, digits and dots becomes one
hyphen, and hyphens at either end are dropped. So the first test above,
whose full name is `HudView > at the start`, has the image name
`HudView-at-the-start`. By default, its reference image is that name with
`.png` added, in a folder named after the test file:
`__references__/hud-view.visual.test.tsx/HudView-at-the-start.png`, beside the
test file. Vitest's own screenshot features write to `__screenshots__`
folders, so this package uses a name of its own. That way, a file that
Vitest writes is never mistaken for a reference image.

An image name has no spaces, so it can be typed on a command line.
Two tests whose full names differ only in
punctuation would have the same image name, and share one reference
image. If any tests share a reference image, the run fails and identifies the duplicate tests.

### One Kind of Test in Each File

The tests run in a browser. Vitest loads each test file into a browser
page, much like a tab, and the views are drawn in that page. The two kinds
of test need their pages arranged differently.

- **Canvas tests share one page.** Every file of canvas tests runs in the
  same page, one file after another. The libraries load once, the shaders
  compile once, and `pixi` and `three` each draw every actual image with
  one renderer. That is what lets hundreds of tests run in seconds.
- **Each file of HTML tests gets a fresh page.** This is because html views use stylesheets, which can't be unloaded from a page, so the fresh pages ensure that
each view gets only its own styles.

A test file runs in one page, so it should only declare one kind of visual test.
When the config loads, the package reads each file's declarations, and sends
the file to the right kind of page. Visual test files may include unit tests,
but they will also run in the browser page. So a unit test that needs Node, such
as one that reads a file, should go in a separate test file. A visual test file
that declares both `canvasTest` and `htmlTest`, or neither, stops the run with an
error.

The package finds the declarations by reading each file's text for
`canvasTest(` and `htmlTest(`, since Vitest needs each file's project before
any test code runs. So a file must call `canvasTest` or `htmlTest` by those
names. A file whose tests all go through a helper of its own, which calls
them, is reported as declaring neither, and a comment that mentions the
other one, followed by a bracket, counts as a declaration.

### Preparing and Disposing of Views

By default, the package takes an image of a view just as the pose returns
it. Afterwards, it disposes of the view the plain way: removing the HTML
element, Pixi's `destroy`, or three.js's `dispose` on every geometry and
material. A project whose views need more says so in each kind's
registration.

- **`prepare(view)`** runs after the pose, before the image is taken. A
  framework whose views write their state to the screen in a separate
  step does that step here.
- **`dispose(view)`** runs after the image is taken, in place of the plain
  disposal. A framework that runs cleanup of its own when a view is
  destroyed does that here.

For example, views built with [MVT](https://github.com/yortus/mvt-games)
draw in a refresh step, and are destroyed through MVT. HTML views are
registered with `htmlViews`, to prepare and dispose of them too. So a
project's `vsnap.config.ts` reads:

```ts
import { destroyElement } from '@mvtjs/html';
import { refreshView } from '@mvtjs/pixi';
import { destroyObject } from '@mvtjs/three';
import { defineVsnapConfig, htmlViews } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';
import { threeViews } from 'vsnap/three';

const config = defineVsnapConfig({
    views: [
        // A Pixi container's own destroy runs MVT's cleanup.
        pixiViews({ prepare: refreshView }),
        threeViews({ prepare: refreshView, dispose: destroyObject }),
        htmlViews({ prepare: refreshView, dispose: destroyElement }),
    ],
    defaultView: 'pixi',
});

declare module 'vsnap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

Each `prepare` and `dispose` is typed by its kind's view, so it needs no
checks of what it was given.

## Configuration

vsnap's tests run in two Vitest projects, beside a project's unit tests.
`vsnap(options)` returns the projects, which the config lists:

```ts
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'vsnap/config';

export default defineConfig({
    plugins: [/* the plugins that the project's views need */],
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    exclude: [...configDefaults.exclude, '**/*.visual.test.{ts,tsx}'],
                },
            },
            ...vsnap(),
        ],
    },
});
```

The projects bring vsnap's reporter with them, which prints the visual
tests' summary and checks the reference images. So there is nothing else
to add, and a run without vsnap's projects, such as `vitest -p unit`,
prints no summary.

The unit project leaves out the visual test files, which run in vsnap's
projects instead. Vitest's default `include` matches both kinds of file. A
project also needs dev dependencies on `vsnap` and `vitest`.

vsnap's projects inherit the config that they are listed in, as Vitest's
`extends: true` does. So the views compile with the same plugins and
aliases as the rest of the project. Vitest adds the config's own `include`
and `exclude` lists to an inheriting project's, so keep them in the unit
project, as above, not in the config's `test` block. A run stops with a
message if they leak into vsnap's projects.

Every option is optional.

| Option | What it sets |
| --- | --- |
| `name` | The start of the projects' names, which end in `-canvas` and `-html`. The default is `visual` |
| `root` | The folder that the other paths are relative to, and that holds `vsnap.config.ts`. The default is the folder Vitest runs in |
| `include` | Globs for the test files. See [Choosing Where Files Go](#choosing-where-files-go) |
| `referencePath` | Where each reference image is kept. See [Choosing Where Files Go](#choosing-where-files-go) |
| `maxPixels` | The size budget, which is the most pixels an image may have. The default, `DEFAULT_MAX_PIXELS`, is 500,000 |
| `viteConfig` | A Vite config for vsnap's projects to extend, in place of the config they are listed in. A monorepo whose views need a package's own Vite config names it here |

The first run downloads the browser, and later runs find it in place. A
monorepo can call `vsnap` once for each package that has visual tests, with
its own `root` and `name`, and list all their projects in one config.

### Choosing Where Files Go

Two options say where a project keeps its visual test files and their
reference images. Both are relative to the root.

- **`include`** is a list of globs for the test files. The default,
  `DEFAULT_INCLUDE`, is `['**/*.visual.test.{ts,tsx}']`.
- **`referencePath`** is a template for each reference image's path. Its
  variables are `{testFileDir}`, `{testFileName}`, `{testFilePath}` and
  `{imageName}`. The default, `DEFAULT_REFERENCE_PATH`, is
  `'{testFileDir}/__references__/{testFileName}/{imageName}.png'`.

`{imageName}` must appear once, in the file name, and the file name must
end in `.png`. A template that breaks these rules stops the run when the
config loads. Two other layouts are common.

```ts
// Tests in a visual-tests folder inside each view folder, with their
// reference images beside them:
//   src/hud/visual-tests/hud-view.test.ts
//   src/hud/visual-tests/HudView-at-the-start.png
vsnap({
    include: ['src/**/visual-tests/*.test.ts'],
    referencePath: '{testFileDir}/{imageName}.png',
});

// Every reference image in one folder, which mirrors the source tree:
//   visual-references/src/hud/hud-view.visual.test.tsx/HudView-at-the-start.png
vsnap({ referencePath: 'visual-references/{testFilePath}/{imageName}.png' });
```

The unit project must leave out a layout's test files, as it leaves out
`*.visual.test.ts` files. For the first layout, that is
`exclude: [...configDefaults.exclude, '**/visual-tests/**']`. Also, any
other PNG in a `visual-tests` folder would match the reference path, and
the check of every reference image would report it. Keep such files elsewhere, or give
the reference images a pattern of their own, such as
`'{testFileDir}/{imageName}.ref.png'`.

The package tells its reference images from other PNGs by the hash that
each one carries. So the check for references that no test uses never
deletes another PNG, whatever folder it is in. To change layout, change the
options, then run the visual tests with Vitest's `-u` once. Each test writes its
reference image at the new path, with the same pixels as before. The same
run deletes the old files, because no test uses them. This package's own
`fixtures/visual-tests-folders/` project uses the first layout, and its run
checks that layout end to end.

## Running the Tests

The tests run with Vitest's own commands. Its `-p` (`--project`) filter
picks the unit tests or the visual tests alone, and only a run that
includes vsnap's projects starts a browser.

| Command | What it does |
| --- | --- |
| `vitest run` | Runs every test, unit and visual. Each actual image is compared with its reference image. A new image is written as its reference, except in CI |
| `vitest run -p unit` | Runs the unit tests alone. No browser starts |
| `vitest run -p "visual-*"` | Runs the visual tests alone |
| `vitest run -u` | Also writes each new or changed actual image as its reference image, as `-u` does for snapshots |
| `vitest run <file> -u` | Updates the reference images of one test file. A failure message gives this command |
| `vitest -p "visual-*"` | Watches the visual tests, and reruns a test file when it or its view changes. See [Watch Mode](#watch-mode) |
| `vitest run -p "visual-*" --sequence.shuffle` | Runs the visual tests in a random order, which finds any test that depends on the ones before it. Vitest prints the order's seed, and adding `--sequence.seed=<seed>` repeats that order |

A complete run of a project's visual tests, with no filters, does two more
things. It decodes every reference image, and checks its pixels against the
hash it carries. A run compares only the hashes, so this catches a
reference whose pixels were edited without its hash. It also finds
reference images that no test uses, which renamed or deleted tests left
behind. Without `-u`, it lists them and fails. With `-u`, it deletes them.
A run that doesn't run every visual test, such as one with `-t`, or one
with a test skipped by `.skip`, `.only` or `.todo`, does neither, and its
summary says why.

vsnap's own `vitest.config.ts` is set up this way too. In its folder,
`npm test` runs all of its tests: its unit tests, its visual tests and
calibration set, and its fixture project's, which keeps its tests in
`visual-tests` folders (`visual-fixture-*`). `npm run test:unit` and
`npm run test:visual` run one half each. After a deliberate upgrade of
Playwright, `npm run test:visual:environment` rewrites the browser's
fingerprint and the calibration set's references.

### Watch Mode

In watch mode, Vitest reruns a test file when the file changes, or when a
module that it imports changes, such as its view. Two other changes work
differently.

- **A new or deleted test file restarts Vitest.** Each project gets its test
  files when the config loads, so the restart sends a new file to its kind
  of page. The browser starts again, which takes a few seconds.
- **A change to `vsnap.config.ts` needs Vitest stopped and started again.**
  The test page loads the file in its setup, and Vitest's browser mode keeps
  the setup's modules for the rest of the session, even across its own
  restarts. Edits to the modules that `vsnap.config.ts` imports are the
  same.

## FAQ

### Q: Why use this instead of Playwright's screenshot tests?

It is up to 15x faster, and it needs no Docker. Just `npm ci` and run the
tests anywhere.

This package distinguishes between _canvas_ and _HTML_ tests. Canvas tests
(for Pixi, three.js etc.) are much faster because they read the image
directly from the renderer, while HTML tests still take screenshots and get
less speedup.

### Q: How does it achieve such high speed?

- **Canvas test files share one page.** Libraries load once, and shaders
  compile once.
- **Canvas tests take no screenshots.** The actual image is read straight
  from the renderer.
- **Hashes are compared first.** Only an actual image whose hash differs
  is further processed.

### Q: How does it achieve consistency across machines without Docker?

- **The browser** is always the same version of Chromium and draws in
  software (no graphics cards).
- **Settings** such as the colour profile, screen scale, locale and time
  zone are fixed.
- **Canvas text** is always drawn using a known font from this package.
- **HTML text** is set in a blank font, to sidestep text engine
  differences.
- **A tolerance** of 2 levels of 255 covers rounding on arm64 processors.

### Q: What's the catch?

Test images give up these details:

- **Images of HTML views have no text.** Layout and styling show, but the
  words don't. For a game's menus and panels, that is usually what
  matters, and a copy edit doesn't fail a test. Words that matter can be
  checked with assertions.
- **Canvas text uses the two test fonts,** not the view's own.
- **Rotated `<img>` elements look a little jagged,** because smooth
  sampling rounds differently on arm64 processors.
- **Differences of 2 levels or less pass.** A real change is almost never
  that small.
- **The drawing is software's,** so it can differ a little from a real
  graphics card.

Tests must also follow two rules:

- **Don't leave global state changed, or depend on real time.** Either can
  make images change from one run to the next. Canvas tests share one
  page, so a change that one test leaves behind affects the tests after it.
- **End each canvas font list with `sans-serif` or `monospace`.** Canvas
  text is drawn in this package's own sans-serif or monospace font,
  picked from the list. So `'"Press Start 2P", monospace'` works, but
  `'"Press Start 2P"'` alone fails its test.

## How It Is Laid Out

The tests run in a browser, and the browser talks to Node through Vitest's
browser commands. So the package has two sides, and the messages between
them are defined once, in `src/protocol.ts`.

| Folder | What it holds |
| --- | --- |
| `src/browser/` | The side that runs in the test page. It holds `canvasTest`, `htmlTest`, `defineVsnapConfig` and `htmlViews`, which the main entry point exports, with the types of the kinds of view. It also loads the project's `vsnap.config.ts`. It also reads canvases, captures HTML views, and sets the page up. The setup seeds random numbers the same way every time, draws canvas text from two test fonts, and blanks HTML text. Then it checks the calibration set, which draws with the browser's own canvas 2D and WebGL |
| `src/pixi/`, `src/three/` | The kinds of view for Pixi and three.js, `pixiViews` and `threeViews`, which `vsnap/pixi` and `vsnap/three` export. Only these folders import the libraries |
| `src/shared/` | Helpers that the test page and the support for Pixi and three.js share, such as the size budget |
| `src/node/` | The side that runs in Node. `vsnap/config` exports `vsnap`, which makes the projects and the reporter. It also holds the layout, the browser commands, the PNG files, the comparison, the reporter and the step that installs the browser |
| `src/node/cli/` | The maintainers' scripts: the environment's rewrite, and the generator of the blank font |
| `src/browser/__references__/` | The references for the calibration set, and for this package's own tests |
| `fixtures/visual-tests-folders/` | A small project that keeps its tests in `visual-tests` folders, to check that layout |

`visual-environment.json` holds the browser's fingerprint, which every
machine's browser must match.

The package's entry points are its TypeScript source, for now. Vitest
compiles a config file before it runs it, but leaves the packages that it
imports to Node. Node runs TypeScript source itself, as long as each
relative import names its file with `.ts`, so vsnap's Node side writes its
imports that way, and a config in this repo imports `vsnap/config` by name.
Node won't do that for a package installed in `node_modules`, so the
published package will ship built JavaScript.

## Licence

MIT. The fonts in `src/browser/fonts/` are under the SIL Open Font
License, whose text is beside them.
