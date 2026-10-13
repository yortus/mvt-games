# Contributing to v-snap

This file is for people who work on v-snap itself. The
[README](./README.md) is for people who use it.

v-snap lives in a monorepo, beside the games and demos that its visual
tests were first written for. The repository's own conventions apply to
its code: its `AGENTS.md` and style guide say how code, comments and
messages are written.

## Running v-snap's Own Tests

v-snap's own `vitest.config.ts` is set up as the README tells a project to
set up its own: a unit project, then the projects that `vsnap()` returns.
It calls `vsnap()` twice:

- **`visual-canvas` and `visual-html`** run v-snap's own visual tests, in
  `src/browser/visual-tests/`, with the kinds of view that its
  `vsnap.config.ts` registers. They also run the calibration set (see
  [The Environment](#the-environment)).
- **`visual-fixture-*`** run a small project in
  `fixtures/visual-tests-folders/`. Its reference images are named without
  their test file's stem, so its run checks a layout whose images belong to
  a folder, not to one file, end to end. It also binds `canvasTest` to its own config, since it
  shares v-snap's TypeScript program, as a monorepo's packages can.

In v-snap's folder:

| Command | What it does |
| --- | --- |
| `npm test` | Runs all of v-snap's tests: unit, visual and the fixture's |
| `npm run test:unit` | Runs the unit tests alone, in Node |
| `npm run test:visual` | Runs the visual tests alone, the fixture's included |
| `npm run test:visual:update` | Also writes changed actual images as reference images |
| `npm run test:visual:environment` | Rewrites the environment's fingerprint and the calibration set's references (see [The Environment](#the-environment)) |
| `npm run generate-blank-font` | Rewrites the blank font that HTML text is drawn in |
| `npm run build` | Builds the package into `lib/` (see [Building and Publishing](#building-and-publishing)) |
| `npm run bench` | Runs the speed benchmark (see [The Speed Benchmark](#the-speed-benchmark)) |

From the repository's root, `npm run test:vsnap` runs `npm test` here. The
root's own `npm test` runs the other workspaces' unit tests and the
website's visual tests, which are v-snap's biggest user. It leaves v-snap's
own tests out, as if v-snap lived in a repository of its own.

Some unit tests check details of the libraries that v-snap relies on but
that the libraries don't promise. `src/pixi/pixi-views.test.ts` fails when
an update of Pixi fixes the bug that `patchPixiPools` works around, or
stops reading the renderer's `_roundPixels` field. A failure there means
v-snap's code must change with the library.

## How It Is Laid Out

The tests run in a browser, and the browser talks to Node through Vitest's
browser commands. So the package has two sides, and the messages between
them are defined once, in `src/protocol.ts`. `src/image-name.ts` holds the
rule that turns a test's name into its image's name, which both sides use:
the page names each image, and Node names the image of a test that didn't
run, so that its reference still counts as used.

| Folder | What it holds |
| --- | --- |
| `src/browser/` | The side that runs in the test page. It holds `canvasTest`, `htmlTest`, `bindCanvasTest`, `defineVsnapConfig` and `htmlViews`, which the main entry point exports, with the types of the kinds of view. It loads the project's `vsnap.config.ts`, reads canvases, captures HTML views, and sets the page up. The setup seeds random numbers the same way every time, draws canvas text from two test fonts, and blanks HTML text. Then it checks the calibration set |
| `src/pixi/`, `src/three/` | The kinds of view for Pixi and three.js, `pixiViews` and `threeViews`, which `v-snap/pixi` and `v-snap/three` export. Only these folders import the libraries |
| `src/shared/` | Helpers that the test page and the support for Pixi and three.js share, such as the size budget |
| `src/node/` | The side that runs in Node. `v-snap/vitest` exports `v-snap`, which makes the projects and the reporter. It also holds the layout, the browser commands, the PNG files, the comparison, the reporter and the step that installs the browser |
| `src/browser/visual-tests/` | v-snap's own visual tests, and their references |
| `src/browser/calibration-images/` | The calibration set's references, for each kind of page |
| `scripts/` | The maintainers' scripts: the environment's rewrite, the blank font's generator, and the step that puts the published `package.json` in place while npm packs the package |
| `fixtures/visual-tests-folders/` | The fixture project (see above) |
| `bench/` | The speed benchmark (see [The Speed Benchmark](#the-speed-benchmark)) |
| `docs/` | The guides that the README links to, and the logo |

Each folder imports another through its index file, as everywhere in the
repository. The Node side is the exception that shows: it names each file
with its `.ts` extension, such as `'./commands.ts'`, and imports
`'../protocol.ts'` as a file. Inside the repository, Node runs that source
itself, and Node needs whole file names. It can't import a folder through
its index file.

## The Environment

The images come out the same on every machine only if every machine runs
the same browser, set up the same way. v-snap checks that before any test
runs, in `src/browser/calibration.ts`.

- **`visual-environment.json`** is the environment's fingerprint: the
  browser's build, the WebGL renderer, the locale, the time zone and the
  screen scale. Every machine's must match it.
- **The calibration set** is a set of small images, each of which
  exercises one way that drawing can differ between machines: shapes,
  images, text, WebGL shading and textures, and HTML boxes, controls,
  filters and rotation. Their references are in
  `src/browser/calibration-images/canvas/` and `html/`.

If anything differs beyond the tolerance, the run stops with one error that
says what differs, rather than failing every test for a reason nobody can
see.

### Upgrading Playwright

A new minor version of Playwright brings a new Chromium, which can draw
differently. To upgrade:

1. Change the `playwright` range in `package.json`'s `peerDependencies`
   and `devDependencies`, and in the repository root's `devDependencies`,
   then run `npm install` at the root.
2. Run `npm run test:visual:environment`. It reruns v-snap's own visual
   tests in an environment mode, which writes the new fingerprint and the
   calibration set's references instead of checking them.
3. Look at every changed calibration image before committing it. A change
   there means the new browser draws differently, and the projects that use
   v-snap will need to update their references too.
4. Let the visual tests' CI workflow run on Linux, Windows and macOS. A
   change of Playwright's version makes it run on all three, and their
   images must match.

### The Blank Font

HTML text is drawn in `src/browser/fonts/visual-blank.ttf`, a TrueType
font in which every code point maps to one empty glyph, 0.625 em wide,
with fixed vertical metrics. So text keeps its place in the layout but
draws nothing, and every system lays it out alike. `scripts/blank-font.ts`
says why it is TrueType, and how each system lays it out.
`scripts/generate-blank-font.ts` writes it, and `scripts/blank-font.test.ts`
checks that the committed file is what the script builds. Canvas text is
drawn in the two test fonts, Source Sans 3 and Source Code Pro, which are
under the SIL Open Font License, whose text is beside them.

## The Speed Benchmark

`npm run bench` checks the speed figures that the README gives. It writes
1000 tests of Pixi views, in 100 files, into `.vitest/bench/`. It writes
them twice: once with v-snap's `canvasTest`, and once as a project would
write them without v-snap, drawing on a canvas in the page and checking it
with Vitest's own `toMatchScreenshot`. Both run in the same browser,
launched with the same settings. The screenshot tests run twice, once with
Vitest's defaults, which run several files at once in pages of their own,
and once one file at a time.

The script runs each way once to write the reference images, then times
three runs of each, taking turns, and prints the medians. Each timed run
compares every image with its reference, and every test must pass.
`--files`, `--tests` and `--runs` change the numbers, such as
`npm run bench -- --files 10 --runs 1` for a quick check. It takes about
20 minutes with the defaults, most of it in the screenshot tests. The
results are also written to `.vitest/bench/results.json`.

The views are in `bench/views.ts`. Close other work while it runs, since a
busy machine slows each way by a different amount.

## Building and Publishing

Inside this repository, nothing needs building. The entry points in
`package.json` name the TypeScript source, and a Vitest config imports
`v-snap/vitest` by name, as the root's does.

Node won't run TypeScript inside `node_modules`, so the published package
is built. `npm pack` and `npm publish` first run `prepack`, which builds
the package into `lib/` with tsdown, one JavaScript file and one
declaration file for each module. Then `scripts/publish-manifest.ts` puts a
`package.json` whose entry points name those files in place, and checks the
package with publint and attw, as npm will pack it. `postpack` puts the
repository's `package.json` back once the tarball is made, even when a
publish fails.

npm sends the registry its own copy of `package.json` after packing, so
the registry's copy names the source, while the tarball's, which installs
use, names `lib/`.

The folder isn't named `dist`, because Vite leaves files under `dist` out
of its scan for libraries, and v-snap's setup file must be scanned.

v-snap's page code is never bundled by Vite, in a project or here. The setup
file loads it by path, and the tests load it by name. Bundled, it would load
twice: once for the setup, and once in the bundle for the tests, which
would also hold a copy of the project's `vsnap.config.ts`. So v-snap's
projects leave its entry points out of Vite's bundling, and name the
libraries that its page code imports instead. To check that a change keeps
this working, pack the package, install the tarball in a scratch project
outside the repository, and run a few tests there.

The package isn't published yet, and `package.json` marks it private.
