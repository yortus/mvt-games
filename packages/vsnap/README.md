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
> out the same on Windows, Linux and macOS, with no Docker: `npm ci`
> installs everything but the browser, which the first run downloads. It
> covers views drawn on a canvas, by any renderer, and
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
- **Playwright 1.63, any patch release,** and Vitest's Playwright
  provider, `@vitest/browser-playwright`, at the same version as `vitest`.
  They are peer dependencies, which npm installs with vsnap. vsnap and
  Vitest must use one copy of Playwright, because vsnap installs the browser
  that Vitest launches, and that browser draws every image. Each run first
  checks the browser's fingerprint, which names its exact build, so a patch
  release that changed the browser would stop the run rather than change
  the images. A newer minor version of Playwright brings a new browser, so
  it needs a new release of vsnap. A project that uses Playwright for other
  tests uses the same version for both, so it upgrades Playwright when vsnap
  does. The first run downloads the browser, Playwright's Chrome Headless
  Shell (about 100 MB), into Playwright's cache. A bare Linux system also
  needs the libraries that the browser uses, which
  `npx playwright install-deps chromium` installs. [In CI](#in-ci) shows how
  to keep the browser between runs.
- **Node 22.17 or later,** where Node's file globbing is stable.
- **No renderer library.** A canvas test can draw with the browser's own
  canvas, and needs no library. vsnap's support for Pixi and three.js views
  draws with the project's own copy of `pixi.js` (8.16 or later) or
  `three` (0.160 or later), so a project that uses it installs only the
  library its views use.

---

## Writing a Test

A test is a declaration in a `*.test.ts` or `*.test.tsx` file in a
`visual-tests` folder beside the view, such as `visual-tests/hud-view.test.tsx`
for `hud-view.tsx`. The file is a Vitest test file, which runs in a
browser, and it can hold ordinary tests too. Other files in the folder,
such as poses that several tests share, are not test files. (A project can
keep its tests elsewhere, as
[Choosing Where Files Go](#choosing-where-files-go) describes.) A view drawn on a canvas is declared with
`canvasTest(name, options?, pose)`, and an HTML view with
`htmlTest(name, options?, pose)`. The options (if any) come before the pose,
as they do in Vitest's `test`. The `pose` function's only job is to return a
view that has been arranged into the pose that the test describes.

```tsx
import { canvasTest } from 'vsnap';
import { HudView } from '../hud-view';

canvasTest('at the start', () => HudView({ score: () => 0 }));
canvasTest('a high score', { width: 320 }, () => HudView({ score: () => 98_765 }));
```

The test file is named for its view, and so is each of its images, so the
tests need no `describe` block that names the view. A `describe` block can
group tests by something more specific, such as a state that they share.

`HudView` returns a Pixi container here. vsnap knows how to draw it because
the project registers Pixi views, and makes them its default kind, as
[Kinds of View](#kinds-of-view) describes.

A view that changes over time, such as one that animates, is posed at a
known moment: the pose advances it by a fixed amount of time before it
returns it. A pose never waits for real time to pass.

The options can also hold Vitest's own `timeout`, `retry`, `repeats` and
`fails`, which work as they do on `test`. So do the modifiers
`canvasTest.skip`, `canvasTest.only`, `canvasTest.todo`,
`canvasTest.skipIf(condition)` and `canvasTest.runIf(condition)`, and the
same on `htmlTest`. `.each(cases)` and `.for(cases)` declare a test for each case of
a table, as Vitest's do, and pass the case to the pose. `.each` spreads a
case that is an array, and `.for` passes it whole. The name can show the
case, with `%s` or `$property`:

```ts
canvasTest.each(['spin', 'stop'])('the %s button', (mode) => SpinButton({ mode }));
```

A canvas image that is one colour all over fails its test, since it
usually means that the view drew nothing. A view that is meant to be one
colour, such as an empty panel, sets `canBeBlank: true`. The `background`
of Pixi, three.js and HTML views takes a number, such as `0x202024`, or a
CSS colour. A canvas that the pose drew has its own background. Visual
tests never run concurrently, even in a `describe.concurrent` block,
because the tests of a page share its renderers.

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
    defaultKind: 'pixi',
});

// Gives canvasTest's types the kinds of view above, and the default kind.
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
  bounds, and drawn smooth, with antialiased edges. The options can set the
  image's `width`, `height` and `background`, and `pixelArt: true` for
  pixel art, with hard edges and whole pixels. A project whose views are
  mostly pixel art registers `pixiViews({ pixelArt: true })`, and a test of
  a smooth view then says `pixelArt: false`. `pixiViews({ background })`
  sets every test's background, unless the test sets its own.
- **three.js views,** registered with `threeViews()` from `vsnap/three`. The
  pose returns a three.js object. A three.js view has no bounds to frame it
  by, so the options always set the image's `width` and `height`, and the
  `camera` to draw it with. They can also dress the `scene` as the view's
  game does, with its lights, environment and tone mapping.
  `threeViews({ background })` sets every test's background.
- **A canvas that the pose has drawn,** of the kind `'canvas'`, with any
  renderer, needs no registration. It can be an `HTMLCanvasElement` or an
  `OffscreenCanvas`, drawn with canvas 2D or WebGL. A WebGL canvas that is
  in the page needs `preserveDrawingBuffer: true`, because the browser
  clears it once it is shown. The canvas stays the pose's own: vsnap
  doesn't dispose of it, since a pose may draw on the same canvas for every
  test. A pose that makes a new WebGL canvas for each test should release
  its context, since a page keeps only so many.

`defaultKind` names the kind that a test is of when it gives no `kind`.
Most projects draw most of their views one way, so most of their tests give
no kind. A test of another kind names it:

```ts
canvasTest('spinning', () => ReelView(...));
canvasTest('at rest', { kind: 'three', width: 240, height: 300, camera }, () => LeverView(...));
canvasTest('a bar chart', { kind: 'canvas' }, () => drawChart(SALES));
```

Without `defaultKind`, the default is `'canvas'`. HTML views need no
registration, unless they need preparing or disposing of, as
[Preparing and Disposing of Views](#preparing-and-disposing-of-views)
describes, or a background for every test, `htmlViews({ background })`.

The `Register` declaration gives the config's type to `canvasTest`. So each
test's options are checked against its kind, and its pose must return its
kind's view. A three.js test that leaves out its `kind` is taken as Pixi,
so `camera` is a type error, and so is a three.js object from its pose. For
that, the project's `tsconfig.json` must include `vsnap.config.ts`.

One TypeScript program holds one `Register`. So in a monorepo whose
packages have configs of their own, and share one `tsconfig.json`, each
package's config binds `canvasTest` to itself instead, and its tests import
it from there:

```ts
import { bindCanvasTest, defineVsnapConfig } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

// canvasTest, with types that know this config's kinds of view.
export const canvasTest = bindCanvasTest(config);

export default config;
```

```ts
import { canvasTest } from '../vsnap.config';
```

Such a `canvasTest` also checks, as each test runs, that it is the config
of the test's own project, so a test that imports another package's fails.
The type of its tests' options is `CanvasTestOptions<'three', typeof config>`,
with the config named after the kind.

A test also checks its view as it runs, by its kind's check, such as
`instanceof Container`. A view of another kind fails its test, and the
message says which kind the view is, and the `kind` to give.

`pixiViews` and `threeViews` each keep one renderer for every image, which
is much faster than a renderer for each test. Support for another renderer
can do the same. It is a `CanvasViewKind`: its name, as `kind`, a check of
the view, and the step that draws it. It can also have steps that prepare and dispose of
the view, and `defaults`, options that every test of the kind gets unless
it sets its own, as `pixiViews({ background })` does. Its `draw` can return the canvas
that it drew on, and vsnap reads it. `vsnap` exports the types, with two
helpers: `fitImage` says how an image fits the size budget, and
`readCanvas` reads a canvas's pixels at full resolution. A kind that draws
an image smaller, to fit the budget, reads its canvas itself, and gives the
image its resolution. Listed in the
config, the kind joins `canvasTest`'s types through `Register`, as the
others do.

Each kind is listed once. Two kinds with one name, a kind named
`'canvas'` or `'html'`, `htmlViews` listed twice, or a `defaultKind` that
names no listed kind, are errors. `vsnap.config.ts` runs in the test page, so such an
error, or any other that the file throws, fails every visual test file, with
the error under "Failed to import test file" and vsnap's setup file. The
other projects still run.

#### If `canvasTest` Rejects Every View

If every canvas test that gives no kind is a type error, such as
"Container is not assignable to HTMLCanvasElement", `canvasTest`'s types
have no default kind. Check that `vsnap.config.ts` has the `Register`
declaration, and that `tsconfig.json` includes the file. A test that
imports a bound `canvasTest` imports it from the config, not from `vsnap`.

### Options of Each Kind

A test's options are those of its kind, with `kind` to name it, Vitest's
`timeout`, `retry`, `repeats` and `fails`, and, for a canvas test,
`canBeBlank`. A kind's registration can set the defaults that every test of
the kind gets, unless the test sets its own.

| Kind | A test's options | The registration's options |
| --- | --- | --- |
| Pixi, `pixiViews()` | `width` and `height` (the view's bounds and a margin by default), `background`, `pixelArt` (`false` by default) | `prepare`, `dispose`, `pixelArt`, `background` |
| three.js, `threeViews()` | `width`, `height` and `camera`, all needed; `scene`, to dress the scene; `background` | `prepare`, `dispose`, `background` |
| A canvas that the pose drew, `'canvas'` | none | none needed |
| HTML, `htmlTest` | `width` and `height` (the element's own size by default), `background` | `htmlViews()`: `prepare`, `dispose`, `background` |

A `background` is a number, such as `0x202024`, or a CSS colour. By
default, it is one dark grey for every kind, so that transparent areas
show.

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
hyphen, and hyphens at either end are dropped. Letters and digits of every
script count, so `日本` stays as it is, and a test whose name has none fails.
So the first test above,
whose full name is `at the start`, has the image name `at-the-start`, and
a test named `with a new best` in a `describe('after a game over')` block
has the image name `after-a-game-over-with-a-new-best`. By default, a
reference image is beside the test file, named for the file's stem and
the image name: `visual-tests/hud-view.at-the-start.png`. A test file's stem is its
name without `.test` and its extension. So each test file's images sort
together, beside it, and the name says which file each image belongs to.

An image name has no spaces, so it can be typed on a command line. A name
longer than 100 bytes is cut short, and a short hash of the whole name is
added, so that file names stay inside every system's limits. Two tests
whose full names differ only in punctuation would have the same image name,
and share one reference image. So would two whose names differ only in
case, since macOS and Windows keep such names in one file. If any tests
share a reference image, the run fails, and names the tests.

### One Kind of Test in Each File

The tests run in a browser. Vitest loads each test file into a browser
page, much like a tab, and the views are drawn in that page. The two kinds
of test need their pages arranged differently.

- **Canvas tests share one page.** Every file of canvas tests runs in the
  same page, one file after another. The libraries load once, the shaders
  compile once, and `pixi` and `three` each draw every actual image with
  one renderer. That is what lets hundreds of tests run in seconds.
- **Each file of HTML tests gets a fresh page.** HTML views use
  stylesheets, which can't be unloaded from a page, so a fresh page for
  each file gives each view only its own styles.

A test file runs in one page, so it declares one kind of visual test.
When the config loads, the package reads each file's declarations, and
sends the file to the right kind of page. Visual test files may hold unit
tests, but they run in the browser page too. So a unit test that needs
Node, such as one that reads a file, goes in a separate test file.

A visual test file that declares both `canvasTest` and `htmlTest`, or
neither, as a new empty file does, can't run. vsnap leaves it out of its
projects, and says why when the config loads. A run of the visual tests
then fails, after running the others. A run of the project's other tests,
such as `vitest -p unit`, only warns, so a half-written file stops no
other test.

An HTML view must fit the test page, whose viewport is 1280 by 800
pixels, since the part of a view past it isn't drawn. The viewport is the
same in every project, as is the tolerance of 2 levels in 255, since both
are part of what makes the images the same on every machine. A bigger view fails
its test, and says so. Before an HTML view's image is taken, the package
waits for its fonts, its `<img>` elements, and the images that its styles
use, such as backgrounds. It also brings its animations and transitions to
rest, as Playwright's screenshots do with `animations: 'disabled'`: one
that ends is finished, and one that never ends, such as a spinner, is
cancelled. A text field's caret is hidden. The page prefers a dark colour
scheme and reduced motion, so a view's `prefers-color-scheme: dark` and
`prefers-reduced-motion: reduce` styles apply. The text in a view's open
shadow roots, such as a web component's, is blank too. A closed shadow
root can't be reached, so its text is drawn in the system's fonts, which
differ between systems.

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
  step does that step here. An HTML view is already in the page when it is
  prepared, so a step that measures its layout sees it.
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
    defaultKind: 'pixi',
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
They run in a group of their own (Vitest's `sequence.groupOrder`), after the
project's other projects. `vsnap(options)` returns the projects, which the
config lists:

```ts
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'vsnap/vitest';

export default defineConfig({
    plugins: [/* the plugins that the project's views need */],
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    exclude: [...configDefaults.exclude, '**/visual-tests/**'],
                },
            },
            ...vsnap(),
        ],
    },
});
```

The unit project has `extends: true`, so that it keeps the config's
plugins, as vsnap's projects do. The projects bring vsnap's reporter with them, which prints the visual
tests' summary and checks the reference images. So there is nothing else
to add, and a run without vsnap's projects, such as `vitest -p unit`,
prints no summary.

The unit project leaves out the visual test files, which run in vsnap's
projects instead. Vitest's default `include` matches both kinds of file. A
project also needs dev dependencies on `vsnap` and `vitest`. npm installs
vsnap's peers, Playwright and Vitest's Playwright provider, with it.

vsnap's projects inherit the config that they are listed in, as Vitest's
`extends: true` does. So the views compile with the same plugins and
aliases as the rest of the project. Vitest adds the config's own `include`
and `exclude` lists to an inheriting project's, so keep them in the unit
project, as above, not in the config's `test` block. The same goes for
`setupFiles`, which would run in vsnap's browser pages, where a setup file
written for Node, or for a simulated DOM, fails. A run stops with a message
if any of them leak into vsnap's projects.

Every option is optional.

| Option | What it sets |
| --- | --- |
| `name` | The start of the projects' names, which end in `-canvas` and `-html`. The default is `visual` |
| `root` | The folder that the other paths are relative to, and that holds `vsnap.config.ts`. The default is the folder Vitest runs in. A run whose Vitest root is elsewhere, such as with `vitest --root`, stops and asks for it, such as `root: import.meta.dirname` |
| `include` | Globs for the test files. See [Choosing Where Files Go](#choosing-where-files-go) |
| `exclude` | Globs for files that `include` matches but that aren't visual test files, such as fixtures. The default is none |
| `referencePath` | Where each reference image is kept. See [Choosing Where Files Go](#choosing-where-files-go) |
| `maxPixels` | The size budget, which is the most pixels an image may have. A smooth view over the budget is downsampled to fit: drawn at half its size, a quarter, and so on, so that detail finer than an image pixel is averaged away. The run's summary lists them as downsampled references, with their scales. Pixel art and HTML are drawn at full size, so they fail when over the budget. The default, `DEFAULT_MAX_PIXELS`, is 500,000 |
| `viteConfig` | A Vite config for vsnap's projects to extend, in place of the config they are listed in. A monorepo whose views need a package's own Vite config names it here |
| `vsnapConfig` | The project's `vsnap.config.ts`, which runs in the test page. The default is `vsnap.config.ts` in the root, if there is one. Naming it shows a reader of `vitest.config.ts` where the rest of vsnap's settings are |

The first run downloads the browser, and later runs find it in place. A
monorepo can call `vsnap` once for each package that has visual tests, with
its own `root` and `name`, and list all their projects in one config. Two
calls can also share a root, with `include` globs that don't overlap. A
test file that the globs of two calls match stops the run.

When the config loads, vsnap checks `vsnap.config.ts` by its text, without
running it. A file with no default export stops the run. A file that never
gives its config's type to vsnap, with `Register`, gets a warning, since
then `canvasTest`'s types don't know its kinds of view.

When a test fails, vsnap writes its actual image, and a diff for a changed
image, to `.vitest/vsnap/` at the root of the repository, in folders that
mirror the reference's path. Add `.vitest/` to `.gitignore`. The failure
points at the test's `canvasTest` or `htmlTest` line in its file, as a
failed assertion points at its line. An error that the pose threw points at
the pose's own code.

### Adding vsnap to a Project

Most projects that already use Vitest have one flat config. These steps
turn it into the shape above.

1. Install `vsnap` as a dev dependency, beside `vitest`. npm also installs
   `playwright` and `@vitest/browser-playwright`, which vsnap needs. A
   package manager that doesn't install peer dependencies needs them
   installed too.
2. Move the config's `test` settings into a project named `unit`, inside
   `test.projects`. That includes `include`, `exclude`, `environment` and
   `setupFiles`. Settings for the whole run, such as `reporters` and
   `coverage`, stay in the `test` block.
3. Add `'**/visual-tests/**'` to the unit project's `exclude`, after
   `...configDefaults.exclude`. Vitest's own `include` matches the visual
   test files, which end in `.test.tsx`, and vsnap's projects run them.
4. List vsnap's projects after the unit project: `...vsnap()`.
5. Create `vsnap.config.ts` beside `vitest.config.ts`, as
   [Kinds of View](#kinds-of-view) shows, with the kinds of view that the
   tests pose and the `Register` declaration. Add it to `tsconfig.json`'s
   `include`.
6. Add `.vitest/` to `.gitignore`.
7. Write a test in a `visual-tests` folder, such as
   `src/hud/visual-tests/hud-view.test.tsx`, and run `vitest`. Its image is
   new, so it is written as its reference image. Look at it, and commit it
   with the test.

For example, this flat config:

```ts
export default defineConfig({
    plugins: [react()],
    test: { environment: 'jsdom', setupFiles: ['./test-setup.ts'] },
});
```

becomes:

```ts
export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    environment: 'jsdom',
                    setupFiles: ['./test-setup.ts'],
                    exclude: [...configDefaults.exclude, '**/visual-tests/**'],
                },
            },
            ...vsnap(),
        ],
    },
});
```

The unit project has `extends: true`, so that it keeps the plugins, as
vsnap's projects do.

### Choosing Where Files Go

Two options say where a project keeps its visual test files and their
reference images. Both are relative to the root.

- **`include`** is a list of globs for the test files. The default,
  `DEFAULT_INCLUDE`, is `['**/visual-tests/*.test.{ts,tsx}']`.
- **`referencePath`** is a template for each reference image's path. Its
  variables are `{testFileDir}`, `{testFileName}`, `{testFileStem}` (the
  name without `.test` or `.spec` and its extension), `{testFilePath}` and
  `{imageName}`. The default, `DEFAULT_REFERENCE_PATH`, is
  `'{testFileDir}/{testFileStem}.{imageName}.png'`.

```
src/hud/
  hud-view.tsx
  visual-tests/
    hud-view.test.tsx
    hud-view.at-the-start.png
    hud-view.a-high-score.png
    poses.ts
```

Two test files in one folder with one stem, such as `hud-view.test.ts` and
`hud-view.test.tsx`, would share their images, so vsnap leaves the second
out, and says why. In VS Code, the explorer can fold each test file's
images under it, with these settings:

```json
"explorer.fileNesting.enabled": true,
"explorer.fileNesting.patterns": { "*.test.tsx": "${capture}.*.png", "*.test.ts": "${capture}.*.png" }
```

`{imageName}` must appear once, in the file name, and the file name must
end in `.png`. A template that breaks these rules stops the run when the
config loads. Two other layouts are common.

```ts
// Tests beside their views, with each test file's reference images in a
// folder of their own:
//   src/hud/hud-view.visual.test.tsx
//   src/hud/__references__/hud-view.visual.test.tsx/at-the-start.png
vsnap({
    include: ['**/*.visual.test.{ts,tsx}'],
    referencePath: '{testFileDir}/__references__/{testFileName}/{imageName}.png',
});

// Every reference image in one folder, which mirrors the source tree:
//   visual-references/src/hud/visual-tests/hud-view.test.tsx/at-the-start.png
vsnap({ referencePath: 'visual-references/{testFilePath}/{imageName}.png' });
```

The unit project must leave out a layout's test files. For the default
layout, that is `'**/visual-tests/**'` in its `exclude`, and for the first
layout above, `'**/*.visual.test.{ts,tsx}'`. Also, any other PNG whose name
starts with a test file's stem and a dot, beside the test file, would match
the reference path, and the check of every reference image would report
it. Keep such files elsewhere, or name them otherwise.

The package tells its reference images from other PNGs by the hash that
each one carries, and by where its reference path would put an image of
one of its test files. A file that the `include` globs match owns its
images even once it is deleted, so they are reported as unused. A template
without `{testFileName}`, `{testFileStem}` or `{testFilePath}` can't say
which file an image is for, so only the folders that hold a test file have
images, and a run of some test files checks only the images that are
theirs alone. So the
check for references that no test uses never deletes a PNG without a hash,
a copy of a reference in another folder such as `docs`, or the images of
another `vsnap` call's tests.

To change layout, change the options, then run the visual tests with
Vitest's `-u` once. Each test writes its reference image at the new path,
with the same pixels as before. The old files are at paths that the new
layout doesn't give, so the run leaves them, and they can be deleted by
hand.

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

Every run of the visual tests also checks the reference images, in two
ways, after the tests:

- **Each reference's pixels match the hash it carries.** A run compares
  only the hashes, so this catches a reference whose pixels were edited
  without its hash. A reference that passed before, unchanged since, isn't
  decoded again.
- **Every reference is used by a test.** Renamed and deleted tests leave
  references behind. Without `-u`, the run lists them and fails. With `-u`,
  it deletes them. A test that didn't run, because `.skip`, `.only`, `.todo`
  or `-t` left it out, still uses its reference.

A run of every visual test file checks every reference, those of deleted
test files too. A run of some of them, such as a shard (`--shard`), a run of
one file, or a rerun in watch mode, checks the references of the files that
ran, and its summary says so. A check that fails prints what it found under
a heading of its own, after the summary, and the run exits with code 1. In
GitHub Actions, it also adds an error annotation.

### Reviewing a Failed Image

A test whose image changed fails with a message that names its files: the
reference, the actual image in `.vitest/vsnap/`, and, for an image that
kept its size, a diff, which shows the reference dimmed and the pixels that
changed in red. The message ends with the command that
accepts the change, `vitest run <file> -u`. The files of a test that passes
again are deleted.

The Vitest UI shows them side by side. Run `vitest --ui`, and open the
failed test: its Visual Regression panel shows the diff, the reference,
the actual image, and a slider between the reference and the actual
image. Look at each change there before accepting it.

### In CI

In CI, Vitest writes no new snapshots, so a test whose image is new fails,
as does one whose image changed. Run the visual tests as any other Vitest
run, and keep Playwright's browser between runs, so that it isn't
downloaded each time. In GitHub Actions:

```yaml
- run: npm ci
- name: Where Playwright keeps its browser
  id: playwright
  run: |
      echo "PLAYWRIGHT_BROWSERS_PATH=$RUNNER_TEMP/ms-playwright" >> "$GITHUB_ENV"
      echo "version=$(node -p 'require("playwright/package.json").version')" >> "$GITHUB_OUTPUT"
- uses: actions/cache@v4
  with:
      path: ${{ runner.temp }}/ms-playwright
      key: playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.version }}
- run: npx playwright install chromium-headless-shell
- run: npx vitest run
```

GitHub's runners already have the libraries that the browser needs. A
bare Linux image also needs `npx playwright install-deps chromium`. A
failed test's actual and diff images are in `.vitest/vsnap/`, which a step
can upload for the reviewer.

### Watch Mode

In watch mode, Vitest reruns a test file when the file changes, or when a
module that it imports changes, such as its view. A change to
`vsnap.config.ts` reruns the tests with the new config.

A new or deleted test file restarts Vitest, since each project gets its
test files when the config loads, and the restart sends a new file to its
kind of page. The browser starts again, which takes a few seconds. A new
file that declares no test yet, such as an empty one, gets a warning, and
restarts Vitest once its first test is written.

An editor's test explorer, such as the one that the Vitest extension adds
to VS Code, reads the projects' test files when it starts. It doesn't see
a new visual test file until it reads them again: press its refresh
button.

## Troubleshooting

Each message below is the start of one that vsnap gives, with what it
usually means.

- **"This machine is not the visual tests' reference environment."** The
  browser's fingerprint, or one of the calibration images, differs, so no
  test was compared. Check that the project installs the Playwright version
  that vsnap names, and only one copy of it (`npm ls playwright`).
- **"The visual tests run in Playwright's headless Chromium, ... but this
  page runs in another browser."** The run is headed
  (`--browser.headless=false`), or the config names another browser. Run
  the visual tests headless.
- **"The actual image ... is blank."** The view drew nothing inside the
  image: it may need its kind's `prepare` step, or a three.js camera that
  looks at it. A view that is meant to be one colour sets `canBeBlank: true`.
- **"The view in ... asks for fonts that visual tests can't draw."** A
  canvas font list names no family that vsnap knows. End it with
  `sans-serif` or `monospace`.
- **Every canvas test that gives no kind is a type error.** See
  [If `canvasTest` Rejects Every View](#if-canvastest-rejects-every-view).
- **"Failed to import test file" for vsnap's setup file.** The project's
  `vsnap.config.ts` threw an error as the page loaded it. The cause follows
  the message.
- **"vsnap couldn't load its test font."** Vite won't serve files from
  vsnap's package, such as when it is installed outside the project. Allow
  its folder in Vite's `server.fs.allow`.
- **"... matches the visual test files' globs, but it declares no
  canvasTest or htmlTest yet."** The file is new, or calls the
  declarations through a helper of its own. Call `canvasTest` or `htmlTest`
  in the file, or leave it out with `exclude`.
- **"The project ... runs vsnap's visual tests a second time."** The
  config's `browser` settings reach vsnap's projects. Move them into the
  project that needs them.
- **"vsnap's root is the folder that Vitest runs in, ... but Vitest's own
  root is ..."** Give `vsnap()` its root, such as
  `root: import.meta.dirname`.
- **"... is not exported under the conditions ["node", ...]", from
  `vitest list` or an editor's test explorer.** Vitest lists the tests of
  a file in Node, without running it, and resolves its imports as a server
  does. A project that adds conditions to `resolve.conditions` adds them to
  `ssr.resolve.conditions` too.
- **A test passes locally but fails in CI as new.** Its reference image
  wasn't committed. Commit the PNG files beside its test file whose names
  start with the file's stem.

## FAQ

### Q: Why use this instead of Playwright's screenshot tests?

It is faster, and it needs no Docker. Just `npm ci` and run the tests
anywhere.

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
- **HTML views are captured at rest.** Animations are finished or
  cancelled, so an image shows where one ends, not a moment in it.
- **Canvas text uses the two test fonts,** not the view's own. A character
  that they lack, such as ★ or an emoji, is drawn as a box with its code
  point inside, so a change from one such character to another still
  changes the image.
- **Rotated `<img>` elements look a little jagged,** because smooth
  sampling rounds differently on arm64 processors.
- **Differences of 2 levels or less pass.** A real change is almost never
  that small.
- **The drawing is software's,** so it can differ a little from a real
  graphics card.

Tests must also follow these rules:

- **Don't leave global state changed, or depend on real time.** Either can
  make images change from one run to the next. Canvas tests share one
  page, so a change that one test leaves behind affects the tests after it.
  That includes Vitest's `vi.mock` and `vi.stubGlobal`.
- **Make a Pixi texture in the pose, if pixel art and smooth tests share
  it.** A texture keeps the sampling that it was made with, which
  `pixelArt` sets as each pose starts. One that a module makes once and
  caches keeps the sampling of the test that made it, so a later test of the
  other kind would draw it differently, and its image would depend on which
  test ran first. A texture whose sampling is set when it is made, such as a
  spritesheet's, draws the same in every test.
- **Give each canvas font list a family that vsnap knows.** Canvas text
  is drawn in this package's own sans-serif or monospace font, picked by
  the first family in the list that vsnap knows. It knows the generic
  families (`sans-serif`, `serif`, `system-ui`, `monospace` and the like)
  and the common system fonts, such as Arial, Helvetica, Segoe UI, Roboto,
  Consolas and Menlo. Serif families are drawn sans-serif. So
  `'"Press Start 2P", monospace'` works, but `'"Press Start 2P"'` alone
  fails its test. Ending each list with `sans-serif` or `monospace` always
  works.

## Contributing

To work on vsnap itself, see [CONTRIBUTING.md](./CONTRIBUTING.md). It says
how vsnap's own tests run, how the package is laid out, how the test
environment is checked and upgraded, and how the package is built and
published.

## Licence

MIT. The fonts in `src/browser/fonts/` are under the SIL Open Font
License, whose text is beside them.
