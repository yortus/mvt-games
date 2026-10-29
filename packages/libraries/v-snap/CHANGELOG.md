# v-snap

## 0.5.1

### Patch Changes

- b4b6921: HTML images match on macOS and other arm64 machines in two more cases. v-snap now waits for two frames before it takes an HTML view's image, so a view that lays itself out in a frame, such as a CodeMirror editor measuring its lines, has settled even on a slow machine. And it draws each scroll container with rounded corners as part of the page, by setting its `overflow` to `hidden` while it takes the image. Browsers draw a scrollable container as a layer of its own, and arm64 processors round the edges of that layer's rounded corners differently. The container keeps its layout and its scroll position. A reference image of such a container that was written on an x64 machine changes slightly at the corners, so update it once with `-u`.

## 0.5.0

### Minor Changes

- 5fb8f1f: v-snap is a Vitest plugin: `plugins: [vsnap()]` adds its projects when Vitest starts, so a config keeps its shape, and `vitest` runs the unit tests and the visual tests together. The plugin leaves the visual test files out of the config's own tests, and names a flat config's tests `unit`. Its `root` is Vitest's root by default. Vitest's `-p` filter can't pick the plugin's projects, so a part of the visual test files' paths picks them instead, such as `vitest visual-tests/` with the default `include`, and v-snap says so when a `-p` filter leaves them nothing to run in.
  
  Breaking changes. `withVsnap()` is gone: move its `vsnap` options into `vsnap()` in `plugins`, and leave the rest of the config as it was. The function that returns the projects, for a config that lists its projects itself, is now `vsnapProjects()`, in place of `vsnap()`, and spreading `vsnap()` into `test.projects` is a type error. v-snap's projects now keep their own `include`, `exclude`, `setupFiles` and `browser`, and leave out the config's `includeSource`, `environment` and `environmentOptions`, so those settings may stay in a config's `test` block. The run no longer stops over them.

## 0.4.1

### Patch Changes

- A run deletes an unused reference only if git tracks it, so that git can bring it back. A reference that git doesn't track, such as a new one, is kept, and so is every reference outside a git repository. A rerun in watch mode deletes none, unless it updates references, so a test commented out for a moment keeps its reference. The summary lists the unused references that were kept, and why.

## 0.4.0

### Minor Changes

- New options. An HTML test's `margin` takes in what its view draws outside its box, such as a shadow or a focus ring. `threeViews()` can set `width`, `height`, `camera` and `scene` for every test, which its tests may then leave out. `getPixiRenderer()`, from `v-snap/pixi`, gives a pose the renderer that draws the images, for a view that builds itself with one, such as with `generateTexture`. `crypto.getRandomValues` and `crypto.randomUUID` are seeded before every test, as `Math.random` is, so a view that uses them draws the same every time. A Pixi test that gives only one of `width` and `height` frames each axis on its own: the one with a size runs from 0 to it, and the other is framed by the view's bounds. Such a test's reference image may need updating.

### Patch Changes

- Fixes. An HTML test's `prepare` and `act` steps see the view as its image will be, with its font sizes rounded and its shadow roots' text in the blank font. A root with `position: fixed` or `absolute`, such as a modal overlay, is captured, instead of leaving the image empty, and an empty view gets a message that says so. Images in CSS `content` are loaded before the capture. Canvas text takes letter spacing in `em` and other units, aligns `start` and `end` by the text's direction, and knows the generic families `cursive`, `fantasy`, `emoji`, `math` and `fangsong`. When the browser isn't the reference environment's, the message names the Playwright version that v-snap supports, and the one that the run uses, with its folder. An old sources fingerprint file in `.vitest/vsnap/` is deleted.

## 0.3.0

### Minor Changes

- d3b7e98: v-snap now supports Playwright 1.64, whose headless shell is Chromium 156, in place of 1.63. A project upgrades Playwright to 1.64 with it. Every image is drawn as before, so no reference image needs updating.

### Patch Changes

- 47476fa: A failed image's message suggests a command that accepts that image alone, `vitest run <file> -t "^<test's name>$" -u`, instead of every changed image in the file. A name that a shell would change in double quotes gets the file's command, as before.
- 4aaf3cf: A run whose `--project` filter leaves out v-snap's projects, such as `vitest -p unit`, no longer fingerprints the repository's sources as the config loads, which took about a tenth of a second.

## 0.2.0

### Minor Changes

- 60b2b71: Reference checks show wherever test failures do. A reference whose pixels don't match its hash fails its own test, and two tests of a file with one image name fail the second test, instead of failing the run after Vitest's summary. Outside CI, a run deletes references that no test uses any more, as it writes new ones, so a renamed test leaves nothing behind; in CI, they still fail the run.
- 15148ba: HTML tests can act on their view once it is in the page, with `act`, such as to hover over it, focus it or open a menu with Vitest's `userEvent`; the pointer leaves the page afterwards. A test's `viewport` and `colorScheme` set what its media queries see, and `vsnap()`'s `viewport` and `colorScheme` options set the page's own. The calibration set checks dark form controls too.
- a1b319c: `withVsnap(config)`, from `v-snap/vitest`, adds v-snap's projects to a Vitest config as it is, with v-snap's options in the config, under `vsnap`. A flat config's unit test settings move into a `unit` project that leaves out the visual test files, so a project no longer restructures its config by hand. `...vsnap()` in `test.projects` still works.

### Patch Changes

- b6606d3: Fixes and clearer messages. A reference whose name differs from its test's only in case fails the test, on every system, and `-u` renames it. `-u` rewrites a reference whose pixels don't match its hash, and, except on arm64, an image within the tolerance. A Git LFS pointer, or a reference that can't be read, gets a message that says what to do. The diff marks differences within the tolerance in dark yellow. `.each` and `.for` follow `.skip`, `.only`, `.skipIf` and `.runIf`. Two configs' `vsnap()` calls with one name no longer share a sources fingerprint. Paths in messages are relative to the folder that Vitest runs in.

## 0.1.0

### Minor Changes

- f8358c3: The first release of v-snap: fast, consistent visual snapshot tests for views drawn with Pixi, three.js, any canvas, or HTML, as Vitest projects. A test is one `canvasTest` or `htmlTest` declaration, whose pose returns the view, and its image is compared with a reference image committed beside the test. The images are the same on Windows, Linux and macOS, with no Docker.
