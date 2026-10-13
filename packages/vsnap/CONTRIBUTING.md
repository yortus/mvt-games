# Contributing to vsnap

This file is for people who work on vsnap itself. The
[README](./README.md) is for people who use it.

vsnap lives in a monorepo, beside the games and demos that its visual
tests were first written for. The repository's own conventions apply to
its code: its `AGENTS.md` and style guide say how code, comments and
messages are written.

## Running vsnap's Own Tests

vsnap's own `vitest.config.ts` is set up as the README tells a project to
set up its own: a unit project, then the projects that `vsnap()` returns.
It calls `vsnap()` twice:

- **`visual-canvas` and `visual-html`** run vsnap's own visual tests, in
  `src/browser/*.visual.test.tsx`, with the kinds of view that its
  `vsnap.config.ts` registers. They also run the calibration set (see
  [The Environment](#the-environment)).
- **`visual-fixture-*`** run a small project in
  `fixtures/visual-tests-folders/`. It keeps its tests in `visual-tests`
  folders, with their reference images beside them, so its run checks that
  layout end to end. It also binds `canvasTest` to its own config, since it
  shares vsnap's TypeScript program, as a monorepo's packages can.

In vsnap's folder:

| Command | What it does |
| --- | --- |
| `npm test` | Runs all of vsnap's tests: unit, visual and the fixture's |
| `npm run test:unit` | Runs the unit tests alone, in Node |
| `npm run test:visual` | Runs the visual tests alone, the fixture's included |
| `npm run test:visual:update` | Also writes changed actual images as reference images |
| `npm run test:visual:environment` | Rewrites the environment's fingerprint and the calibration set's references (see [The Environment](#the-environment)) |
| `npm run generate-blank-font` | Rewrites the blank font that HTML text is drawn in |
| `npm run build` | Builds the package into `lib/` (see [Building and Publishing](#building-and-publishing)) |

From the repository's root, `npm run test:vsnap` runs `npm test` here. The
root's own `npm test` leaves vsnap out, as if it lived in a repository of
its own, and `npm run test:visual` runs the website's visual tests, which
are vsnap's biggest user.

Some unit tests check details of the libraries that vsnap relies on but
that the libraries don't promise. `src/pixi/pixi-views.test.ts` fails when
an update of Pixi fixes the bug that `patchPixiPools` works around, or
stops reading the renderer's `_roundPixels` field. A failure there means
vsnap's code must change with the library.

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
| `src/pixi/`, `src/three/` | The kinds of view for Pixi and three.js, `pixiViews` and `threeViews`, which `vsnap/pixi` and `vsnap/three` export. Only these folders import the libraries |
| `src/shared/` | Helpers that the test page and the support for Pixi and three.js share, such as the size budget |
| `src/node/` | The side that runs in Node. `vsnap/config` exports `vsnap`, which makes the projects and the reporter. It also holds the layout, the browser commands, the PNG files, the comparison, the reporter and the step that installs the browser |
| `src/browser/__references__/` | The calibration set's references, and those of vsnap's own visual tests |
| `scripts/` | The maintainers' scripts: the environment's rewrite, the blank font's generator, and the step that puts the published `package.json` in place while npm packs the package |
| `fixtures/visual-tests-folders/` | The fixture project (see above) |

Each folder imports another through its index file, as everywhere in the
repository. The Node side is the exception that shows: it names each file
with its `.ts` extension, such as `'./commands.ts'`, and imports
`'../protocol.ts'` as a file. Inside the repository, Node runs that source
itself, and Node needs whole file names. It can't import a folder through
its index file.

## The Environment

The images come out the same on every machine only if every machine runs
the same browser, set up the same way. vsnap checks that before any test
runs, in `src/browser/calibration.ts`.

- **`visual-environment.json`** is the environment's fingerprint: the
  browser's build, the WebGL renderer, the locale, the time zone and the
  screen scale. Every machine's must match it.
- **The calibration set** is a set of small images, each of which
  exercises one way that drawing can differ between machines: shapes,
  images, text, WebGL shading and textures, and HTML boxes, controls,
  filters and rotation. Their references are in
  `src/browser/__references__/calibration-canvas/` and
  `calibration-html/`.

If anything differs beyond the tolerance, the run stops with one error that
says what differs, rather than failing every test for a reason nobody can
see.

### Upgrading Playwright

A new minor version of Playwright brings a new Chromium, which can draw
differently. To upgrade:

1. Change the `playwright` range in `package.json`'s `peerDependencies`
   and `devDependencies`, and in the repository root's `devDependencies`,
   then run `npm install` at the root.
2. Run `npm run test:visual:environment`. It reruns vsnap's own visual
   tests in an environment mode, which writes the new fingerprint and the
   calibration set's references instead of checking them.
3. Look at every changed calibration image before committing it. A change
   there means the new browser draws differently, and the projects that use
   vsnap will need to update their references too.
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

## Building and Publishing

Inside this repository, nothing needs building. The entry points in
`package.json` name the TypeScript source, and a Vitest config imports
`vsnap/config` by name, as the root's does.

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
of its scan for libraries, and vsnap's setup file must be scanned.

vsnap's page code is never bundled by Vite, in a project or here. The setup
file loads it by path, and the tests load it by name. Bundled, it would load
twice: once for the setup, and once in the bundle for the tests, which
would also hold a copy of the project's `vsnap.config.ts`. So vsnap's
projects leave its entry points out of Vite's bundling, and name the
libraries that its page code imports instead. To check that a change keeps
this working, pack the package, install the tarball in a scratch project
outside the repository, and run a few tests there.

The package isn't published yet, and `package.json` marks it private.
