# @mvtjs/visual-testing

> Visual tests for views. A visual test is a kind of snapshot test, also
> known as visual regression testing. A snapshot test compares a test's
> output with a saved copy, and a visual test compares a picture. It builds
> a view in a known state, takes a picture of it, and compares the picture
> with a reference picture committed beside the test. This package runs hundreds of these tests in
> seconds. The pictures come out the same on Windows, Linux and macOS, and
> nothing needs installing beyond `npm ci`. It covers Pixi, three.js and
> HTML views. The package is private for now.

**Related:** [Visual Tests, in the MVT guide](../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)

---

## Writing a Test

A test is a declaration in a `*.visual.ts` or `*.visual.tsx` file beside
the view. A Pixi or three.js view is declared with
`canvasTest(name, pose, options?)`, and an HTML view with
`htmlTest(name, pose, options?)`. A file declares one kind only,
because canvas tests share one page, and each file of HTML tests gets a
page of its own. The package reads each file's declarations to send it to
the right kind of page. The pose is a function that builds the view in the
state to photograph, and returns it.

```tsx
import { describe } from 'vitest';
import { canvasTest } from '@mvtjs/visual-testing';
import { HudView } from './hud-view';

describe('HudView', () => {
    canvasTest('at the start', () => HudView({ score: () => 0 }));
    canvasTest('a high score', () => HudView({ score: () => 98_765 }));
});
```

The reference for the first test is
`__screenshots__/hud-view.visual.tsx/HudView-at-the-start.png`, beside the
test file. `advanceTime({ models, views, totalMs })` advances a view with
presentation state, in frame-sized steps, before its picture is taken.
[Visual Tests](../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)
describes the options, HTML and three.js views, and how failures read.

## Setting a Package Up

A package that has visual tests needs three things.

1. A dev dependency on `@mvtjs/visual-testing`.
2. A `vitest.visual.config.ts` beside its `package.json`, which makes one
   Vitest project for each kind of page:

   ```ts
   import { defineConfig } from 'vitest/config';
   import {
       createVisualProject, createVisualReporters, DEFAULT_MAX_PIXELS,
   } from '@mvtjs/visual-testing/node';

   const options = {
       maxPixels: DEFAULT_MAX_PIXELS,
       viteConfig: './vite.config.ts',
       optimizeDeps: ['gsap'],
   };

   export default defineConfig({
       test: {
           projects: [
               createVisualProject({ kind: 'canvas', ...options }),
               createVisualProject({ kind: 'html', ...options }),
           ],
           reporters: createVisualReporters(),
       },
   });
   ```

   `viteConfig` is the package's own Vite config, for the plugins and
   aliases its views need. `optimizeDeps` lists the libraries its views
   import. Every test file runs in one page, so Vite must bundle them
   before the run starts.
3. Scripts that run the package's command:

   ```json
   "test:visual": "visual-tests",
   "test:visual:update": "visual-tests --update",
   "test:visual:check-references": "visual-tests check-references"
   ```

## Commands

| Command | What it does |
| --- | --- |
| `visual-tests` | Compares every picture. The first run downloads the browser |
| `visual-tests --picture <name>` | Runs only the tests whose pictures have that name |
| `visual-tests --update` | Also writes each new or changed picture as its reference, and deletes references that no test uses |
| `visual-tests check-references` | Decodes every reference, and checks its pixels against the hash it carries |

This package's own tests and calibration set run with
`npm run test:visual -w @mvtjs/visual-testing`. After a deliberate upgrade
of Playwright, `npm run test:visual:environment -w @mvtjs/visual-testing`
rewrites the browser's fingerprint and the calibration pictures.

## How It Is Laid Out

The tests run in a browser, and the browser talks to Node through Vitest's
browser commands. So the package has two sides, and the messages between
them are defined once, in `src/protocol.ts`.

| Folder | What it holds |
| --- | --- |
| `src/browser/` | The side that runs in the test page. It holds `canvasTest`, `htmlTest` and `advanceTime`, which the main entry point exports. It also holds the picture code for each kind of view, and the page's setup. The setup pins random numbers, draws canvas text from two test fonts, and blanks HTML text |
| `src/node/` | The side that runs in Node. `@mvtjs/visual-testing/node` exports its Vitest projects and reporters. It also holds the browser commands, the PNG files, the comparison and the run's summary |
| `src/node/cli/` | The `visual-tests` command, its reference check, and the generator of the blank font |
| `src/browser/__screenshots__/` | The calibration pictures, and the pictures of this package's own tests |

`visual-environment.json` holds the browser's fingerprint, which every
machine's browser must match.

The Node entry point gives its TypeScript source both under the repo's
`@mvtjs/source` condition and as the default. Vitest bundles a config file
before it runs it, and the bundler knows no custom conditions. So the
default lets a package's config import this one. The command then runs
Vitest with tsx's loader, so that Node can run that TypeScript. The
command's `bin` entry is a small JavaScript file, which loads the command
through tsx.

## How the Pictures Stay the Same Everywhere

The browser is Playwright's build of Chromium, pinned to one version. It
draws WebGL and 2D canvases in software (SwiftShader), with font hinting
off. Canvas text is drawn as shapes from two test fonts, which are Source
Sans 3 and Source Code Pro. HTML text is set in a blank font, so that the
layout stays and no letters are drawn. A tolerance of 2 levels per channel
covers the rounding of arm64 processors. Before any picture is compared,
each run checks the fingerprint and draws the calibration set, and stops
at once if they differ.
[Visual Tests](../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)
explains each of these, and what each one gives up.

The fonts in `src/browser/fonts/` are under the SIL Open Font License,
whose text is beside them.
