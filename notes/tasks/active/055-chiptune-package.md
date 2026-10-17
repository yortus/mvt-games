# Rename `@mvtjs/audio` to `@mvtjs/chiptune`, and Publish It

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-17 |
| Updated  | 2026-10-18 |

## Description

The sound chip's package, `@mvtjs/audio`, gets a new name, `@mvtjs/chiptune`,
and goes on npm beside the other four libraries. Then every place that names
it is brought up to date.

The new name says what the package is. "Audio" sounds like a general sound
library, but the package is a set of virtual sound chips, with their tracker
notation and music player. That's chiptune.

While the package is private, the playground has to work around it. An
exported project leaves it out, so `sound` can't be used, and Help tells the
reader so. Publishing it removes those workarounds.

### Before starting

- **Wait for the Audio90 work (051) to merge.** It's still going on in its
  own worktree, and it changes many of the same files. Renaming the package
  first would give that branch a large merge for no gain.
- **Check the name still fits once the Audio90 is in.** The Audio90 covers
  1990s sounds, such as FM synthesis and samples, which go beyond the
  classic chiptune sound. "Chiptune" is still a fair name for a package of
  virtual sound chips, but confirm it with the owner before renaming.

### What to rename

- **The package:** `packages/libraries/audio/` becomes
  `packages/libraries/chiptune/`, and its `package.json` name, description
  and keywords change to match. Its subpaths (`/web`, `/headless`) keep
  their names.
- **Every import and mention.** On 2026-10-17 there were about 250, in 126
  files outside the archive:
  - The Arcade: every entry's sounds, music and audio views, and the
    runner (`page-sound.ts`, `pixi-stage.ts`, `headless.ts`,
    `fake-web-audio.ts`), with their tests.
  - The playground: `libraries/libraries.ts`, `libraries/entries/mvtjs-audio.ts`
    (renamed to match), the sandbox, the project API, export, and Help.
  - The docs: the package's own README and guides, Sound and Music, the
    testing pages, the glossary, project structure, the AI agents' pages
    and skills, and `public/llms.txt`.
  - The repo's setup: `AGENTS.md`, the root `package.json` (the
    `audio:render` script), `tsconfig.json`, `eslint.config.ts`,
    `.github/workflows/deploy.yml`, the benchmarks, and each `package.json`
    that depends on it.
- **Don't rename what isn't the package.** An "audio view" is an MVT idea,
  a view that plays sounds, and keeps its name. So do the chips' own names
  (the Audio80, the Audio90) and the `sound` that a game is given.

### What publishing needs

- Add it to `build:packages` (tsdown, publint, attw), and to the changesets,
  as the four libraries are. `AGENTS.md` and the README say "four
  libraries", which becomes five.
- Its docs need to show the page's side of playing sound, which lives in
  the Arcade (`PageSound`), as an example. See 048, "Publishing
  `@mvtjs/audio`".
- In the playground, take out the export's workarounds for an unpublished
  chip (`isPublished(packages, '@mvtjs/audio')` and the copied `Audio80`
  type in `export-project.ts`), and Help's sentence saying exported
  projects can't play sound.

## Acceptance Criteria

- [x] 051 is merged, and the owner has confirmed the name.
- [x] The package is `@mvtjs/chiptune`, in `packages/libraries/chiptune/`.
- [x] Nothing outside `notes/archive/` names `@mvtjs/audio` or
      `libraries/audio`, except this task.
- [x] Audio views, the chips' names and `sound` keep their names.
- [x] It builds for publishing with the other libraries.
- [ ] It is on npm. The owner publishes its first version by hand, at the
      next release, as `.changeset/README.md` says.
- [x] An exported playground project plays sound, and Help no longer says it
      can't.
- [x] Lint, type checks, the unit tests and the visual tests pass, and the
      Arcade's entries still play their sounds.

## Progress Log

### 2026-10-17

Created at the owner's request, while finishing the playground's Help (052).

### 2026-10-18

The owner confirmed the name, `@mvtjs/chiptune`, with the Audio90 in. Done,
on vnext:

- The folder moved, and every mention changed, about 270 in 160 files. The
  playground's type bundles named the folder as a bare `'audio'`, which a
  search for the package's name missed.
- The package is at 0.3.0, in the changesets' fixed group with the other
  four, and the Arcade, the playground and the benchmarks depend on it as
  `^0.3.0`. It has a LICENSE, `files`, and a changeset for its first
  release.
- **The worklets.** In the source, each browser chip imports its worklet's
  URL with Vite's `?worker&url`, which only Vite understands. The package's
  `tsdown.config.ts` has a small plugin that turns each such import into
  the worklet bundled into one module, minified, and served from a Blob URL
  (14 kB for the Audio80's, 26 kB for the Audio90's). So the published
  package works with any bundler, and has no file to copy. A separate file
  loaded with `new URL(..., import.meta.url)` was ruled out: Vite's dev
  server pre-bundles dependencies into another folder, which breaks such
  URLs. The Arcade and the playground still use the source, so their
  worklets stay files of their own.
- **The playground.** An export always gives the project a chip now.
  `isPublished(packages, '@mvtjs/chiptune')`, `withoutSound` and Help's
  sentence are gone, and the runner's `createSound` is required. The README's
  general note on packages not yet on npm stays, with a test of its own.
- **The docs.** The Audio80 guide has "A Page's Sound, in Full", which
  shows what the Arcade's `PageSound` does, and links to it. Its example
  now listens for `keydown`, `click` and `touchend`, not `pointerdown`,
  which a touch doesn't count as a gesture.
- **Checked end to end:** the five libraries packed with `npm pack`, and a
  playground project exported with a sound on a timer, installed from the
  tarballs. It type-checks and builds, the Audio90 is left out of its
  bundle, and in a headless browser its sound reached the speakers, from
  `vite build` and from the dev server. The Arcade's build plays sound in
  Neon Monsoon (Audio90) and Galaxy Raiders (Audio80) too.

Left: publishing. The release workflow can't publish a package that isn't
on npm yet, so `.changeset/README.md` now says how its first version goes
out by hand.
