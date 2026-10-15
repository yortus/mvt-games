# Contributing to v-snap

This file is for people who work on v-snap itself. The
[README](./README.md) is for people who use it.

v-snap lives in a monorepo, beside the games and demos that its visual
tests were first written for. The repository's conventions apply to its
code. The repository's `AGENTS.md` and style guide say how code, comments
and messages are written.

## Running v-snap's Own Tests

v-snap's own `vitest.config.ts` lists its projects by hand, as
[Configuration](docs/configuration.md#v-snaps-projects) describes. It has
a unit project, then the projects of two `vsnap()` calls:

- **`visual-canvas` and `visual-html`** run v-snap's own visual tests, in
  `src/browser/visual-tests/`, with the kinds of view that its
  `vsnap.config.ts` registers. They also run the calibration set, which
  [The Environment](#the-environment) describes.
- **`visual-fixture-canvas` and `visual-fixture-html`** run a small
  project in `fixtures/visual-tests-folders/`. Its reference images are
  named without their test file's stem, so each image belongs to a folder,
  not to one file. Its run checks that layout from end to end. The fixture
  also binds `canvasTest` to its own config, as a monorepo's packages can,
  since it shares v-snap's TypeScript program.

These commands run in v-snap's folder:

| Command | What it does |
| --- | --- |
| `npm test` | Runs all of v-snap's tests: unit, visual and the fixture's |
| `npm run test:unit` | Runs the unit tests alone, in Node |
| `npm run test:visual` | Runs the visual tests alone, the fixture's included |
| `npm run test:visual:update` | Also writes changed actual images as reference images |
| `npm run test:visual:environment` | Rewrites the environment's fingerprint and the calibration set's references, as [Upgrading Playwright](#upgrading-playwright) describes |
| `npm run generate-blank-font` | Rewrites the blank font that HTML text is drawn in |
| `npm run build` | Builds the package into `lib/`, as [Building and Publishing](#building-and-publishing) describes |
| `npm run bench` | Runs the speed benchmark, which [The Speed Benchmark](#the-speed-benchmark) describes |

From the repository's root, `npm run test:vsnap` runs `npm test` here. The
root's own `npm test` runs the other workspaces' unit tests, and the
website's visual tests, since the website is v-snap's biggest user. It
leaves out v-snap's own tests, as if v-snap lived in a repository of its
own.

Some unit tests check details of the libraries that v-snap relies on,
which the libraries don't promise. For example, `src/pixi/pixi-views.test.ts`
fails if an update of Pixi fixes the bug that `patchPixiPools` works
around, or stops reading the renderer's `_roundPixels` field. A failure
there means that v-snap's code must change with the library.

## How It Is Laid Out

The tests run in a browser, and the browser talks to Node through Vitest's
browser commands. So the package has two sides. The messages between them
are defined once, in `src/protocol.ts`.

Both sides also use `src/image-name.ts`, which turns a test's name into
its image's name. The page names each image as its test runs. Node names
the image of a test that didn't run, so that its reference still counts as
used.

| Folder | What it holds |
| --- | --- |
| `src/browser/` | The side that runs in the test page. The main entry point exports `canvasTest`, `htmlTest`, `bindCanvasTest`, `defineVsnapConfig` and `htmlViews` from here, with the types of the kinds of view. This side loads the project's `vsnap.config.ts`, reads canvases, captures HTML views, and sets the page up. The setup seeds random numbers, draws canvas text in the two test fonts, blanks HTML text, and checks the calibration set |
| `src/pixi/`, `src/three/` | The kinds of view for Pixi and three.js, which `v-snap/pixi` and `v-snap/three` export: `pixiViews`, `getPixiRenderer` and `threeViews`. Only these folders import the libraries |
| `src/shared/` | Helpers that the test page and the support for Pixi and three.js share, such as the size budget |
| `src/node/` | The side that runs in Node. `v-snap/vitest` exports `withVsnap()` and `vsnap()` from here, which make the projects and the reporter. It also holds the layout, the browser commands, the PNG files, the comparison, the reporter, and the step that installs the browser |
| `src/browser/visual-tests/` | v-snap's own visual tests, and their references |
| `src/browser/calibration-images/` | The calibration set's references, for each kind of page |
| `scripts/` | The maintainers' scripts. They rewrite the environment, generate the blank font, and put the published `package.json` in place while npm packs the package |
| `fixtures/visual-tests-folders/` | The fixture project, described above |
| `bench/` | The speed benchmark |
| `docs/` | The guides that the README links to, and the logo |

Each folder imports another through its index file, as everywhere in the
repository. The Node side differs in one way. It names each file with its
`.ts` extension, such as `'./commands.ts'`, and imports `'../protocol.ts'`
as a file. That is because Node runs that source itself, inside the
repository. Node needs whole file names, and can't import a folder through
its index file.

## The Environment

The images come out the same on every machine only if every machine runs
the same browser, set up the same way. v-snap checks that before any test
runs, in `src/browser/calibration.ts`. It checks two things:

- **`visual-environment.json`** is the environment's fingerprint. It names
  the browser's build, the WebGL renderer, the locale, the time zone and
  the screen's scale. Every machine's must match it.
- **The calibration set** is a set of small images. Each one exercises one
  way that drawing can differ between machines: shapes, images, text,
  WebGL shading and textures, and HTML boxes, controls, filters and
  rotation. Their references are in
  `src/browser/calibration-images/canvas/` and `html/`.

If anything differs beyond the tolerance, the run stops with one error
that says what differs. That is clearer than every test failing for a
reason that nobody can see. When the browser's build differs, the error
also names the Playwright version that v-snap supports, and the one that
the run uses (`src/node/playwright-advice.ts`).

### Upgrading Playwright

A new minor version of Playwright brings a new build of Chromium, which
can draw differently. The repository's `playwright-releases` workflow
(`.github/workflows/playwright-releases.yml`) checks for one weekly. When
one is out, the workflow opens an issue with these steps. Then it tries
the new version, and comments on the issue with what changed: the new
browser build, the calibration images and references that changed, and
how the website's visual tests fared. Its run keeps the changed images for
review.

To upgrade:

1. Change the `playwright` range in v-snap's `package.json`, in both
   `peerDependencies` and `devDependencies`, and in the repository root's
   `devDependencies`. Then run `npm install` at the root.
2. Run `npm run test:visual:environment`. It reruns v-snap's own visual
   tests in an environment mode, which writes the new fingerprint and the
   calibration set's references instead of checking them.
3. Look at every changed calibration image before committing it. A change
   there means that the new browser draws differently. The projects that
   use v-snap will then need to update their references too.
4. Run the website's visual tests from the root, with
   `npm run test:visual`, and look at any image that changed.
5. Change the Playwright version that the docs name: the README's badge
   and Requirements table, and Getting Started's requirements.
6. Add a changeset that gives `v-snap` a minor version.
7. Let the visual tests' CI workflow run on Linux, Windows and macOS. A
   change of Playwright's version makes it run on all three, and their
   images must match.

### The Blank Font

HTML text is drawn in `src/browser/fonts/visual-blank.ttf`. It is a
TrueType font in which every code point maps to one empty glyph, 0.625 em
wide, with fixed vertical metrics. So text takes up room in the layout,
but draws nothing, and every system lays it out alike.
`scripts/blank-font.ts` says why it is TrueType, and how each system lays
it out. `scripts/generate-blank-font.ts` writes it, and
`scripts/blank-font.test.ts` checks that the committed file is what the
script builds.

Canvas text is drawn in the two test fonts, Source Sans 3 and Source Code
Pro. They are under the SIL Open Font License, whose text is beside them.

## The Speed Benchmark

`npm run bench` checks the speed figures that the README gives. It writes
1000 tests of Pixi views, in 100 files, into `.vitest/bench/`, in two
ways. One way uses v-snap's `canvasTest`. The other is how a project would
write them without v-snap: it draws on a canvas in the page, and checks it
with Vitest's own `toMatchScreenshot`. Both ways run in the same browser,
launched with the same settings. The screenshot tests run twice. One run
uses Vitest's defaults, which run several files at once, each in a page of
its own. The other runs one file at a time.

The script runs each way once to write the reference images. Then it times
three runs of each way, taking turns, and prints the medians. Each timed
run compares every image with its reference, and every test must pass.
`--files`, `--tests` and `--runs` change the numbers, such as
`npm run bench -- --files 10 --runs 1` for a quick check. With the
defaults, it takes about 20 minutes, most of it in the screenshot tests.
The results are also written to `.vitest/bench/results.json`.

The views are in `bench/views.ts`. Close other work while the benchmark
runs, since a busy machine slows each way by a different amount.

## Building and Publishing

Inside this repository, nothing needs building. The entry points in
`package.json` name the TypeScript source, and a Vitest config imports
`v-snap/vitest` by name, as the root's does.

Node won't run TypeScript inside `node_modules`, so the published package
is built. `npm pack` and `npm publish` both run `prepack` first, in two
steps:

1. tsdown builds the package into `lib/`, as one JavaScript file and one
   declaration file for each module.
2. `scripts/publish-manifest.ts` puts in place a `package.json` whose
   entry points name those files. Then it checks the package with publint
   and attw, packed as npm will pack it.

`postpack` puts the repository's `package.json` back once the tarball is
made, even when a publish fails. npm sends the registry its own copy of
`package.json` after packing. So the registry's copy names the source,
while the tarball's copy, which installs use, names `lib/`.

The folder isn't named `dist`, because Vite leaves files under `dist` out
of its scan for libraries, and v-snap's setup file must be scanned.

Vite never bundles v-snap's page code, in a project or here. The setup
file loads that code by path, and the tests load it by name. If Vite
bundled it, it would load twice: once for the setup, and once in the
bundle for the tests, which would also hold a copy of the project's
`vsnap.config.ts`. So v-snap's projects leave its entry points out of
Vite's bundling, and name the libraries that its page code imports
instead. To check that a change keeps this working, pack the package,
install the tarball in a scratch project outside the repository, and run a
few tests there.

v-snap is released from this repository with Changesets, on a version of
its own, so a change file names `v-snap` alone. The repository's
[`.changeset/README.md`](../../.changeset/README.md) says how a release
goes.
