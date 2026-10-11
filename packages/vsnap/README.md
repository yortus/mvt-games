# vsnap

> Visual tests for views, made as convenient as unit tests. A visual test
> is a kind of snapshot test, also known as visual regression testing. A
> snapshot test compares a test's output with a saved copy, and a visual
> test compares an image. It builds a view in a known state, renders it to
> an image, and compares that image with a reference image, which is an
> accepted image committed beside the test file. To be as convenient as unit
> tests, visual tests must be fast, and must give the same result on every
> machine. This package runs hundreds of them in seconds. The images come
> out the same on Windows, Linux and macOS, and nothing needs installing
> beyond `npm ci`. It covers Pixi, three.js and HTML views. It runs on
> Vitest's browser mode. It is not published yet.

---

## Writing a Test

A test is a declaration in a `*.visual.ts` or `*.visual.tsx` file beside
the view. (A project can keep its tests elsewhere, as
[Choosing Where Files Go](#choosing-where-files-go) describes.) A Pixi or three.js view is declared with
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
    canvasTest('a high score', () => HudView({ score: () => 98_765 }));
});
```

A view that changes over time, such as one that animates, is posed at a
known moment: the pose advances it by a fixed amount of time before it
returns it. A pose never waits for real time to pass.

### Tests, Actual Images and Reference Images

Each test renders its view to one image. This README keeps three terms
apart.

- A **test** is one `canvasTest` or `htmlTest` declaration. A test runs,
  and passes or fails.
- An **actual image** is the image that a test renders during a run.
- A **reference image**, or just a **reference**, is an image that has been
  accepted, and committed as a PNG file.

A test passes when its actual image matches its reference image. Where
something applies to both, such as an image's name or size, this README
says just "image".

An image's name comes from its test's full name. The full name is the
names of the test's `describe` blocks, followed by the test's own name.
Each run of characters other than letters, digits and dots becomes one
hyphen, and hyphens at either end are dropped. So the first test above,
whose full name is `HudView > at the start`, has the image name
`HudView-at-the-start`. By default, its reference image is that name with
`.png` added, in a folder named after the test file:
`__references__/hud-view.visual.tsx/HudView-at-the-start.png`, beside the
test file. Vitest's own screenshot features write to `__screenshots__`
folders, so this package uses a name of its own. That way, a file that
Vitest writes is never mistaken for a reference image.

An image name has no spaces, so it can be typed on a command line, and
failure messages give it. Two tests whose full names differ only in
punctuation would have the same image name, and share one reference
image. If any tests share a reference image, the run fails, and names
them.

### One Kind of Test in Each File

The tests run in a browser. Vitest loads each test file into a browser
page, much like a tab, and the views are drawn in that page. The two kinds
of test need their pages arranged differently.

- **Canvas tests share one page.** Every file of canvas tests runs in the
  same page, one file after another. The libraries load once, the shaders
  compile once, and one renderer draws every actual image. That is what
  lets hundreds of tests run in seconds.
- **Each file of HTML tests gets a fresh page.** This is because html views use stylesheets, which can't be unloaded from a page, so the fresh pages ensure that
each view gets only its own styles.

A file runs in one page, so it declares one kind of test only. When the
config loads, the package reads each file's declarations, and sends the
file to the right kind of page. A file that declares both kinds, or
neither, stops the run with an error.

### Preparing and Disposing of Views

By default, the package takes an image of a view just as the pose returns
it. Afterwards, it disposes of the view the plain way: Pixi's `destroy`,
three.js's `dispose` on every geometry and material, or removing the HTML
element. A project whose views need more can set two hooks, with
`setViewHooks`, in a setup file that `vsnap.config.ts` names.

- **`prepare(view)`** runs after the pose, before the image is taken. A
  framework whose views write their state to the screen in a separate
  step does that step here.
- **`dispose(view)`** runs after the image is taken, in place of the plain
  disposal. A framework that runs cleanup of its own when a view is
  destroyed does that here.

For example, views built with [MVT](https://github.com/yortus/mvt-games)
draw in a refresh step, and are destroyed through MVT, so a project's setup
file reads:

```ts
import { Object3D } from 'three';
import { destroyElement } from '@mvtjs/html';
import { refreshView } from '@mvtjs/pixi';
import { destroyObject } from '@mvtjs/three';
import { setViewHooks } from 'vsnap';

setViewHooks({
    prepare: (view) => refreshView(view),
    dispose: (view) => {
        if (view instanceof Element) destroyElement(view);
        else if (view instanceof Object3D) destroyObject(view);
        else view.destroy({ children: true });
    },
});
```

## Configuration

A project that has visual tests needs three things.

1. Dev dependencies on `vsnap` and `vitest`, and on `pixi.js` and `three`,
   which the package draws with.
2. A `vsnap.config.ts` at the project's root, beside its `package.json`:

   ```ts
   import { defineConfig } from 'vsnap/config';

   export default defineConfig({ viteConfig: './vite.config.ts' });
   ```

3. Scripts that run the package's command:

   ```json
   "test:visual": "vsnap",
   "test:visual:update": "vsnap --update",
   "test:visual:check-references": "vsnap check-references"
   ```

Every option is optional.

| Option | What it sets |
| --- | --- |
| `include` | Globs for the test files. See [Choosing Where Files Go](#choosing-where-files-go) |
| `referencePath` | Where each reference image is kept. See [Choosing Where Files Go](#choosing-where-files-go) |
| `maxPixels` | The size budget, which is the most pixels an image may have. The default, `DEFAULT_MAX_PIXELS`, is 500,000 |
| `viteConfig` | The project's own Vite config, for the plugins and aliases its views need |
| `setup` | A module that runs in the test page before the tests, such as one that calls `setViewHooks` |

### Why a Config of Its Own

The `vsnap` command reads `vsnap.config.ts`, and makes Vitest's config from
it. A project's own Vitest config, for its unit tests, is not involved.

- **Unit tests stay fast, and need no browser.** A run with visual tests
  starts a browser, and its first run downloads one.
- **The `vsnap` command does work that a Vitest config can't.** It
  installs the browser if it is missing, and runs Vitest with tsx's loader.
  It also tells the run whether every test ran. The check for references
  that no test uses depends on that, and Vitest does not tell a reporter
  which filters a run had.

To run every test with one command, a project's `test` script can run its
unit tests, then `vsnap`.

### Choosing Where Files Go

Two options say where a project keeps its visual test files and their
reference images. Both are relative to the folder that holds
`vsnap.config.ts`.

- **`include`** is a list of globs for the test files. The default,
  `DEFAULT_INCLUDE`, is `['src/**/*.visual.{ts,tsx}']`.
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
defineConfig({
    include: ['src/**/visual-tests/*.test.ts'],
    referencePath: '{testFileDir}/{imageName}.png',
});

// Every reference image in one folder, which mirrors the source tree:
//   visual-references/src/hud/hud-view.visual.tsx/HudView-at-the-start.png
defineConfig({ referencePath: 'visual-references/{testFilePath}/{imageName}.png' });
```

The first layout names its tests `*.test.ts`, which a unit test run also
matches. So the project's unit test config must exclude them, for example
with `exclude: [...configDefaults.exclude, '**/visual-tests/**']`. Also,
any other PNG in a `visual-tests` folder would match the reference path,
and `check-references` would report it. Keep such files elsewhere, or give
the reference images a pattern of their own, such as
`'{testFileDir}/{imageName}.ref.png'`.

The package tells its reference images from other PNGs by the hash that
each one carries. So the check for references that no test uses never
deletes another PNG, whatever folder it is in. To change layout, change the
options, then run `vsnap --update` once. Each test writes its
reference image at the new path, with the same pixels as before. The same
run deletes the old files, because no test uses them. This package's own
`fixtures/visual-tests-folders/` project uses the first layout, and its run
checks that layout end to end.

## Commands

| Command | What it does |
| --- | --- |
| `vsnap` | Runs every test, and compares each actual image with its reference image. The first run downloads the browser |
| `vsnap --image <name>` | Runs only the test with that image name. Failure messages give the name, and the option can be repeated |
| `vsnap --sequence.shuffle` | Runs every test in a random order, which finds any test that depends on the ones before it. Vitest prints the order's seed, and adding `--sequence.seed=<seed>` repeats that order |
| `vsnap --update` | Also writes each new or changed actual image as its reference image, and deletes reference images that no test uses |
| `vsnap check-references` | Decodes every reference image, and checks its pixels against the hash it carries |

Run the command in a project's root, as npm runs a package's scripts, or
with `npx vsnap` there.

This package's own tests and calibration set run with
`npm run test:visual -w vsnap`. Its fixture project runs with
`npm run test:visual:fixture -w vsnap`, which takes the same arguments as
`vsnap`. After a deliberate upgrade of Playwright,
`npm run test:visual:environment -w vsnap` rewrites the browser's
fingerprint and the calibration set's references.

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
| `src/browser/` | The side that runs in the test page. It holds `canvasTest`, `htmlTest` and `setViewHooks`, which the main entry point exports. It also holds the code that produces an image of each kind of view, and the page's setup. The setup seeds random numbers the same way every time, draws canvas text from two test fonts, and blanks HTML text |
| `src/node/` | The side that runs in Node. `vsnap/config` exports `defineConfig`, for a project's `vsnap.config.ts`. It also holds the Vitest config that the command runs, the layout, the browser commands, the PNG files, the comparison and the run's summary |
| `src/node/cli/` | The `vsnap` command, its reference check, and the generator of the blank font |
| `src/browser/__references__/` | The references for the calibration set, and for this package's own tests |
| `fixtures/visual-tests-folders/` | A small project that keeps its tests in `visual-tests` folders, to check that layout |

`visual-environment.json` holds the browser's fingerprint, which every
machine's browser must match.

The package's entry points are its TypeScript source, for now. The command
runs Vitest with tsx's loader, so that Node can run that TypeScript, and a
project's `vsnap.config.ts` too. The command's `bin` entry is a small
JavaScript file, which loads the command through tsx.

## Licence

MIT. The fonts in `src/browser/fonts/` are under the SIL Open Font
License, whose text is beside them.
