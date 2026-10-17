# Rename `@mvtjs/audio` to `@mvtjs/chiptune`, and Publish It

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

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

- [ ] 051 is merged, and the owner has confirmed the name.
- [ ] The package is `@mvtjs/chiptune`, in `packages/libraries/chiptune/`.
- [ ] Nothing outside `notes/archive/` names `@mvtjs/audio` or
      `libraries/audio`.
- [ ] Audio views, the chips' names and `sound` keep their names.
- [ ] It builds for publishing with the other libraries, and is on npm.
- [ ] An exported playground project plays sound, and Help no longer says it
      can't.
- [ ] Lint, type checks, the unit tests and the visual tests pass, and the
      Arcade's entries still play their sounds.

## Progress Log

### 2026-10-17

Created at the owner's request, while finishing the playground's Help (052).
