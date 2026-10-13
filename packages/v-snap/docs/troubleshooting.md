# Troubleshooting

Each message below is the start of one that v-snap gives, with what it
usually means.

- **"This machine is not the visual tests' reference environment."** The
  browser's fingerprint, or one of the calibration images, differs, so no
  test was compared. Check that the project installs the Playwright version
  that v-snap names, and only one copy of it (`npm ls playwright`).
- **"The visual tests run in Playwright's headless Chromium, ... but this
  page runs in another browser."** The run is headed
  (`--browser.headless=false`), or the config names another browser. Run
  the visual tests headless.
- **"The actual image ... is blank."** The view drew nothing inside the
  image: it may need its kind's `prepare` step, or a three.js camera that
  looks at it. A view that is meant to be one colour sets
  `canBeBlank: true`.
- **"The view in ... asks for fonts that visual tests can't draw."** A
  canvas font list names no family that v-snap knows. End it with
  `sans-serif` or `monospace`.
- **Every canvas test that gives no kind is a type error,** such as
  "Container is not assignable to HTMLCanvasElement". `canvasTest`'s types
  have no default kind. Check that `vsnap.config.ts` has the `Register`
  declaration, and that `tsconfig.json` includes the file. A test that
  imports a bound `canvasTest` imports it from the config, not from
  `v-snap`. See [Kinds of View](kinds-of-view.md#types-that-know-the-kinds).
- **"Failed to import test file" for v-snap's setup file.** The project's
  `vsnap.config.ts` threw an error as the page loaded it. The cause follows
  the message.
- **"v-snap couldn't load its test font."** Vite won't serve files from
  v-snap's package, such as when it is installed outside the project. Allow
  its folder in Vite's `server.fs.allow`.
- **"... matches the visual test files' globs, but it declares no
  canvasTest or htmlTest."** The file is new, imports them under other
  names, or calls them through a helper of its own. Call `canvasTest` or
  `htmlTest` in the file, by those names, or leave it out with `exclude`.
- **"... poses undefined."** The pose returned nothing. A pose with a
  block body, `() => { ... }`, ends with `return` and its view.
- **"Image ... has the reference ..., whose name differs ... only in
  case."** A test was renamed, and only the case of its name changed.
  macOS and Windows find the old reference, but Linux doesn't. Run the
  file with `-u`, which renames the reference.
- **"The reference image ... is a Git LFS pointer."** The checkout has
  Git LFS's pointer files, not the images. Run `git lfs pull`, or check out
  with Git LFS, such as with `lfs: true` in `actions/checkout`.
- **"... references do not match their hashes."** A reference was written
  by something other than v-snap, such as an image optimiser, or edited
  since. Run the tests with `-u`, which rewrites each from its test, and
  look at them before committing them.
- **"The project ... runs v-snap's visual tests a second time."** The
  config's `browser` settings reach v-snap's projects. Move them into the
  project that needs them.
- **"v-snap's root is the folder that Vitest runs in, ... but Vitest's own
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
