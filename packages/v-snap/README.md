<p align="center">
  <img src="docs/images/logo.svg" width="110" height="92" alt="">
</p>

<h1 align="center">v-snap</h1>

<p align="center">
  <strong>Visual tests as fast and as dependable as unit tests.</strong><br>
  For views drawn with Pixi, three.js, any canvas, or HTML.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vitest-5-6E9F18?logo=vitest&logoColor=white" alt="Vitest 5">
  <img src="https://img.shields.io/badge/Playwright-1.64-2EAD33" alt="Playwright 1.64">
  <img src="https://img.shields.io/badge/Node-22.17%2B-5FA04E?logo=nodedotjs&logoColor=white" alt="Node 22.17 or later">
  <img src="https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript types">
  <img src="https://img.shields.io/badge/licence-MIT-e8456b" alt="MIT licence">
</p>

Unit tests can't see a sprite in the wrong place, a colour that changed,
or a panel that overflows. Visual tests can. A visual test draws a view in
a known state, and compares the image with a reference image. The
reference is an image that someone looked at, accepted and committed in an
earlier run.

Most projects give up on visual tests, for two reasons. They are slow,
because each image is a screenshot. And they fail for no visible reason,
because each system draws a little differently, so a reference made on one
machine fails on another. The usual cure for that is to draw every image
in Docker.

v-snap fixes both, without Docker:

- **It is fast.** A canvas image takes about 4 ms to draw and check. A
  screenshot test in the same browser takes 67 ms. 1000 images run in under
  8 seconds, start-up included.
- **Every machine draws the same images.** A reference made on Windows
  passes on Linux and macOS, and the other way round. v-snap is checked on
  Windows x64, Linux x64 and arm64, and macOS arm64. `npm ci` installs
  everything but the browser, which the first run downloads.
- **Its tests are Vitest tests.** v-snap adds two projects to a Vitest
  config. Watch mode, the Vitest UI and the VS Code extension all work.
- **One line declares one image.** There is no test page to build.
- **It draws Pixi and three.js views itself,** and any canvas that a test
  draws. HTML views are tested too, and support for another renderer can
  be added.

## A Test

A test file sits in a `visual-tests` folder beside its view. Each test has
a name, and a pose. A pose is a function that returns the view in the
state that the test describes.

```tsx
// src/hud/visual-tests/hud-view.test.tsx
import { canvasTest } from 'v-snap';
import { HudView } from '../hud-view';

canvasTest('at the start', () => HudView({ score: () => 0 }));
canvasTest('a high score', () => HudView({ score: () => 98_765 }));
```

The first run writes each image as its test's reference, beside the test
file: `hud-view.at-the-start.png` and `hud-view.a-high-score.png`. Look at
them, and commit them. From then on, each run compares the images with
them.

## When an Image Changes

A test whose image changed fails. v-snap writes its actual image, and a
diff that shows the reference dimmed and the changed pixels in red. Here,
one more light is on:

| The reference | The actual image | The diff |
| :---: | :---: | :---: |
| <img src="docs/images/example-reference.png" width="250" alt="A panel, with three of its lights on at the left, and two at the right"> | <img src="docs/images/example-actual.png" width="250" alt="The same panel, with a fourth light on in the middle"> | <img src="docs/images/example-diff.png" width="250" alt="The panel dimmed, with the new light in red"> |

The failure message says where the image changed, and by how much:

```
Image 'a-panel' differs from its reference in 214 pixels, by up to 194 of 255,
in the 16x16 pixels at (116, 108).
```

It goes on to name the three files. It ends with a command that accepts
this image alone, if the change was meant. The Vitest UI shows the same
three images, with a slider between the reference and the actual image.

## How Fast?

The same 1000 images of Pixi views, checked with v-snap and with Vitest's
own `toMatchScreenshot`, in the same browser, took these times:

| | 1000 images, start-up included | One image, at the median |
| --- | ---: | ---: |
| **v-snap**, in one page | **7.8 s** | **4.0 ms** |
| `toMatchScreenshot`, in one page | 89.9 s (11.5x) | 67 ms (17x) |
| `toMatchScreenshot`, 13 pages at once | 18.0 s (2.3x) | 131 ms (33x) |

Vitest runs screenshot tests in several pages at once by default, one for
each processor core but one. That makes the whole run faster, but each
screenshot slower. Even with 13 pages, v-snap in one page was 2.3 times as
fast. [The benchmark](docs/how-it-works.md#the-benchmark) says how it was
measured, and how to run it.

## What It Gives Up

The images are the same everywhere because v-snap decides how they are
drawn. That has costs, which [Limits and Rules](docs/limits-and-rules.md)
lists in full.

- **Canvas text is drawn in v-snap's own fonts,** Source Sans 3 and Source
  Code Pro. Text that a view measures is measured in them too. A character
  that they lack, such as an emoji, is drawn as a box.
- **HTML text is drawn blank.** Every letter is an empty space 0.625 em
  wide, so an HTML image shows layout and styling, but not words. Text
  wraps where it would if every letter were that wide.
- **Drawing is done in software.** WebGL runs on the processor, so what a
  graphics card would draw differently isn't tested.
- **Each release of v-snap supports one minor version of Playwright.**
  Every machine must draw with the same build of Chromium, and Playwright
  moves to a new build in each minor version. So a project upgrades
  Playwright when v-snap does.
  [Playwright Versions](docs/getting-started.md#playwright-versions)
  explains why.

## Quick Start

1. Install v-snap beside Vitest. npm also installs Playwright and Vitest's
   Playwright provider, which v-snap needs.

   ```sh
   npm install --save-dev v-snap vitest
   ```

2. Wrap the config in `vitest.config.ts` in `withVsnap()`, which adds
   v-snap's projects to it. The unit tests keep their settings, in a
   project of their own that leaves out the visual tests.

   ```ts
   import { defineConfig } from 'vitest/config';
   import { withVsnap } from 'v-snap/vitest';

   export default defineConfig(withVsnap({
       test: {
           // The unit tests' settings, as before.
       },
   }));
   ```

3. Create `vsnap.config.ts` beside it, and add the file to
   `tsconfig.json`'s `include`. It registers the kinds of view that the
   tests pose, such as Pixi containers.

   ```ts
   import { defineVsnapConfig } from 'v-snap';
   import { pixiViews } from 'v-snap/pixi';

   const config = defineVsnapConfig({
       views: [pixiViews()],
       defaultKind: 'pixi',
   });

   // Gives canvasTest's types the kinds of view above, and the default kind.
   declare module 'v-snap' {
       interface Register {
           config: typeof config;
       }
   }

   export default config;
   ```

4. Add `.vitest/` to `.gitignore`. v-snap writes a failed test's images
   there.

5. Write a test, as above, and run `npx vitest`.

[Getting Started](docs/getting-started.md) says what v-snap needs, and
covers a config that already has settings or projects.

## Documentation

- **[Getting Started](docs/getting-started.md)**: the requirements,
  Playwright versions, adding v-snap to a project, and the first test.
- **[Writing Tests](docs/writing-tests.md)**: declaring tests, views that
  change over time, shared setup, options, how HTML views are captured,
  and image names.
- **[Kinds of View](docs/kinds-of-view.md)**: Pixi, three.js, canvases and
  HTML, the options of each, preparing and disposing of views, configs in
  a monorepo, and support for another renderer.
- **[Configuration](docs/configuration.md)**: adding v-snap's projects,
  their options, and where test files and references go.
- **[Running the Tests](docs/running-tests.md)**: the commands, the checks
  of the references, reviewing a failed image, CI and watch mode.
- **[How It Works](docs/how-it-works.md)**: what makes v-snap fast, the
  benchmark, and how every machine draws the same images.
- **[Limits and Rules](docs/limits-and-rules.md)**: what the images leave
  out, and the rules that tests follow.
- **[Troubleshooting](docs/troubleshooting.md)**: v-snap's messages, and
  what they usually mean.

## API

The package is named `v-snap`. Names in code can't hold a hyphen, so the
code says `vsnap`, as in `vsnap()`, `defineVsnapConfig` and
`vsnap.config.ts`.

| Import | Export | What it does |
| --- | --- | --- |
| `v-snap` | `canvasTest(name, options?, pose)` | Declares a test of a view drawn on a canvas. It has Vitest's modifiers, such as `.skip`, `.only` and `.each` |
| | `htmlTest(name, options?, pose)` | Declares a test of an HTML view, with the same modifiers |
| | `defineVsnapConfig(config)` | Returns the config that `vsnap.config.ts` exports, with its kinds of view and its default kind |
| | `bindCanvasTest(config)` | Returns a `canvasTest` whose types know one config's kinds of view, for a monorepo's packages |
| | `htmlViews(options?)` | Returns the kind for HTML views, with steps to prepare and dispose of them, and a background for every test |
| | `fitImage`, `readCanvas` | Help to support another renderer. `fitImage` returns how an image fits the size budget, and `readCanvas` returns a canvas's pixels |
| `v-snap/vitest` | `withVsnap(config)` | Returns the Vitest config with v-snap's projects added. It takes v-snap's options from the config's `vsnap` key, and moves a flat config's unit test settings into a `unit` project |
| | `vsnap(options?)` | Returns the Vitest projects that run the visual tests, for a config that lists its projects itself |
| `v-snap/pixi` | `pixiViews(options?)` | Returns the kind for Pixi views |
| | `getPixiRenderer()` | Returns a promise of the Pixi renderer that draws the images, for a view that needs one to build itself |
| `v-snap/three` | `threeViews(options?)` | Returns the kind for three.js views |

## Requirements

| Needs | Version |
| --- | --- |
| Vitest, with `@vitest/browser-playwright` | 5 |
| Playwright, installed with v-snap | 1.64, any patch release |
| Node | 22.17 or later |
| Pixi, for Pixi views | 8.16 or later |
| three.js, for three.js views | 0.160 or later |

A canvas test can draw with the browser's own canvas, and needs no
renderer library. [Getting Started](docs/getting-started.md#requirements)
says why each is needed.

## Contributing

To work on v-snap itself, see [CONTRIBUTING.md](./CONTRIBUTING.md). It says
how v-snap's own tests run, how the package is laid out, how the test
environment is checked and upgraded, and how the package is built and
published.

## Licence

MIT, but for the two test fonts, Source Sans 3 and Source Code Pro, which
are under the SIL Open Font License. The published package holds them in
`lib/browser/fonts/`, and their licences in `src/browser/fonts/`.
