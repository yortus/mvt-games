# Troubleshooting

Each item below starts with the opening words of a message that you might
see, from v-snap, Vitest or Vite, or with a problem that you might notice.
Then it says what usually causes it, and how to fix it. In a quoted
message, `...` stands for a part that changes, such as a file name or the
kind of page.

- **"This machine is not the visual tests' reference environment ..."**
  Before any test runs, v-snap checks that this browser draws exactly as
  the reference one does. It reads the browser's fingerprint, which names
  its exact build, and draws a few calibration images, which are small
  pictures with known pixels. One of these checks failed, so no test was
  compared. If the browser differs, the message names the Playwright
  version that v-snap supports, and the one that this run uses, with its
  folder. Install the supported version, and make sure that there's only
  one copy of it (`npm ls playwright`).
- **"The visual tests ... run in Playwright's headless Chromium, ... but
  this page runs in another browser."** The browser opened in a window (a
  headed run, as with `--browser.headless=false`), or your config names
  another browser. Any other browser draws different images, so run the
  visual tests headless.
- **"v-snap: TypeScript doesn't know which kinds of view ... registers",
  or a type error in every canvas test that gives no kind,** such as
  "Type 'Container' is not assignable to type 'HTMLCanvasElement |
  OffscreenCanvas'". TypeScript doesn't know your config, so `canvasTest`
  expects the built-in kind of view, which is a canvas that the pose drew.
  The warning means that `vsnap.config.ts` has no `Register` declaration,
  and it shows the declaration to add. If the declaration is there, check
  that `tsconfig.json` includes the file. If you use `bindCanvasTest`,
  which returns a `canvasTest` tied to one config, import that
  `canvasTest` from your config, not from `v-snap`. See
  [Kinds of View](kinds-of-view.md#types-that-know-the-kinds).
- **"... has no default export."** v-snap reads your config from the
  default export of `vsnap.config.ts`, and this file has none. Export the
  config as the default, such as with `export default config`.
- **"v-snap's vsnapConfig option names ..., which doesn't exist."** The
  path in the `vsnapConfig` option is wrong. It's relative to v-snap's
  `root` option, which is Vitest's root unless you set it.
- **"Failed to import test file" for v-snap's setup file.** Your
  `vsnap.config.ts` threw an error while the test page loaded it. Vitest
  shows that error's own message after this one.
- **"v-snap couldn't load its test font."** Vite refused to serve a file
  from v-snap's package. That usually happens when v-snap is installed
  outside your project's folder. Add v-snap's folder to Vite's
  `server.fs.allow` list.
- **"The actual image ... is blank."** The view drew nothing inside the
  image. It may need its kind's `prepare` step, or, for three.js, a camera
  that looks at it. If the view is meant to be a single colour, set
  `canBeBlank: true` in the test's options.
- **"The view in ... asks for fonts that visual tests can't draw."**
  v-snap draws canvas text only in its own fonts, so that every machine
  draws it alike. A font list in your view names no family that v-snap can
  swap for one of them. End each font list with `sans-serif` or
  `monospace`, and v-snap draws the text in its own font of that kind.
- **"... matches the visual test files' globs, but it declares no
  canvasTest or htmlTest."** v-snap sorts visual test files by reading
  them for those two names, before they run. This file has neither. It
  may be new and still empty. Or it may import them under other names, or
  call them through a helper of its own. Call `canvasTest` or `htmlTest`
  in the file, by those names, or leave the file out with `exclude`.
- **"... poses undefined."** The test's pose returned nothing. A pose with
  a block body, `() => { ... }`, needs to end with `return` and its view.
- **"Image ... has the reference ..., whose name differs ... only in
  case."** A test was renamed, and only the case of its name changed.
  macOS and Windows find the old reference anyway, because their file
  systems ignore case, but Linux doesn't. Run the file with `-u`, which
  renames the reference.
- **"The reference image ... is a Git LFS pointer."** Your checkout has
  Git LFS's small pointer files in place of the images. Run
  `git lfs pull`, or check out with Git LFS, such as with `lfs: true` in
  `actions/checkout`.
- **"Image ... matches its reference, ..., but the reference carries no
  pixel hash."** v-snap stores a hash of each reference's pixels inside
  the PNG file, so that a run can trust the file without decoding it. A
  similar message says that the hash is wrong. Something other than
  v-snap wrote or changed the reference, such as an image optimiser. This
  run writes no references, as in CI, so it can't fix it. Run the tests
  outside CI, or with `-u`, which adds the hash, and commit the reference.
- **"... and ... have one reference image."** Two tests in one file have
  names that differ only in punctuation or case, so each would overwrite
  the other's reference. Rename one of them.
- **"No test uses this reference."** A test was renamed or deleted, and
  its old reference is still committed. This run writes no references, as
  in CI, so it doesn't delete it. Run the visual tests outside CI, which
  deletes it, and commit the deletion.
- **"v-snap: --project ... leaves out the visual tests."** The `vsnap()`
  plugin runs as part of your config's own tests, such as the `unit`
  project, and adds v-snap's projects from there. Your `--project` filter
  left those tests out, so the plugin never added v-snap's projects, and
  Vitest then says that no projects matched. To run only the visual tests,
  filter by file path instead. The message names the globs that v-snap
  finds them with. With the default globs, that's `vitest visual-tests/`.
  To pick v-snap's projects by name, list them with `vsnapProjects()`
  instead, as
  [Configuration](configuration.md#listing-v-snaps-projects) shows.
- **"v-snap's root is the folder that Vitest runs in, ... but Vitest's own
  root is ..."** `vsnapProjects()` finds your visual test files from the
  folder that Vitest runs in, but Vitest's root is somewhere else. That
  happens with `vitest --root`, or with a config in another folder. Pass
  the root yourself, such as `vsnapProjects({ root: import.meta.dirname })`.
- **"... is not exported under the conditions ["node", ...]", from
  `vitest list` or an editor's test explorer.** To list a file's tests,
  Vitest loads it in Node without running it. It resolves the file's
  imports the way a server does, with `ssr.resolve.conditions`. If you add
  conditions to `resolve.conditions`, add them to
  `ssr.resolve.conditions` too.
- **A test passes locally but fails in CI as new.** Its reference image
  wasn't committed. By default, a test file's references sit beside it,
  named for its stem, which is its name without `.test.ts` or
  `.test.tsx`. For example, `hud-view.test.tsx` has references such as
  `hud-view.at-the-start.png`. Commit them.
