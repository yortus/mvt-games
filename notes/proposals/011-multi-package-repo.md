# Proposal: multi-package repo

> The repo has outgrown a single package. This proposal splits the reusable
> code into libraries published under the `@mvtjs` npm scope, keeps the games,
> demos and playground together as one private `site` package, and cuts the
> top level from 21 visible entries to about a dozen. It records the research
> behind the tooling choices (the state of multi-package tooling in September
> 2026), the results of a hands-on lint trial that decides whether Vite+ can
> enforce this repo's own formatting, and a phased migration plan.

**Status:** being implemented, on the `vnext-011` branch from 2026-10-02.
Phases 0 to 3 are done (sections 12.1 to 12.4): the four libraries are
workspace packages under `packages/`, and the site, the docs, the benchmarks
and the new checks are private workspace packages beside them. The npm scopes and GitHub org in section 3 are
registered. The top-level tidy-up was done separately on 2026-09-26, without
the package split (section 7, "Done already").

**Written:** 2026-09-25. Updated 2026-10-02 for the Vite+ 1.0 release
(sections 4.1 and 9), and to stay on npm rather than move to pnpm (sections
5.3, 8 and 13.2).

**Related:** [`AGENTS.md`](../../AGENTS.md) (project structure, commands),
[`docs/reference/project-structure.md`](../../docs/reference/project-structure.md),
[`docs/reference/style-guide.md`](../../docs/reference/style-guide.md),
[`eslint.config.js`](../../eslint.config.js),
[`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml),
[the `Watch()` builder spike](./008-watch-builder-spike.md) (its prototype moves with `watch`).

---

## 1. Summary

Decisions this proposal makes, and where each is argued:

| Decision | Section |
| --- | --- |
| Publish under `@mvtjs`. Hold `@mvt.js` unused. No unscoped package for now | 3 |
| One npm workspace: `packages/*` (published) plus private `site` and `docs` | 5, 6, 7 |
| First two libraries: `@mvtjs/utils` (no dependencies; with 022's JSX base at `./jsx`) and `@mvtjs/pixi` (plugin, Pixi helpers, and its JSX runtime at `./jsx`) | 5 |
| One package per renderer, each with its JSX support at `./jsx`, and one base; no separate JSX package | 5.2, 5.5 |
| Later libraries: `@mvtjs/html`, `@mvtjs/three`, `@mvtjs/pixi-widgets`, `@mvtjs/eslint-plugin` | 5.5, 10 |
| Libraries consumed from source inside the repo; built only for publishing | 5.3 |
| All libraries share one version, starting at `0.1.0` | 5.4 |
| Each renderer package re-exports the tick API it shares with `@mvtjs/utils`, and nothing else from it | 5.2 |
| Games, demos, playground and cabinet stay together as one private `site` package, with the site-specific input views | 5.2, 6 |
| Planning material moves under `notes/` | 6.3 |
| Formatting stays this repo's own (`@stylistic` plus custom rules), enforced and auto-fixed. No Prettier-style formatter | 8.4 |
| npm workspaces (not pnpm), Changesets (no release PRs), tsdown, publint/attw, npm trusted publishing | 8, 13.2 |
| Vite+ gets a time-boxed trial with go/no-go criteria. The lint side is already shown to work | 9 |
| The repo stays at `yortus/mvt-games` for now. The site moves to `yortus.com/mvt-games/` | 13.2, 13.3 |
| ~~Fix the barrel-rule crash (section 11.1) as part of the restructure~~ Fixed early, 2026-09-30 | 11 |

**What this proposal asks for** is the migration in section 12: eight phases (0 to 7),
each leaving `lint`, `test` and `build` green.

---

## 2. Motivation

**The reusable code is worth publishing, and nothing marks it as reusable.**
`src/pixi-mvt/`, `src/pixi-mvt/jsx/` and half of `src/common/` are libraries in all
but packaging. Their boundaries are held up by convention: import-map aliases
(`#common`, `#pixi-mvt/jsx`), relative imports such as `'../../pixi-mvt'` (22 files),
and a lint rule. A package boundary enforces the same thing through `exports`.

**`src/common/` mixes two kinds of code.** Seven of its modules are pure logic
with no imports at all (`watch`, `sequence`, `sequence-reaction`, both tweens,
`slot-list`, `type-utils`). The rest are Pixi views or DOM helpers used only by
the site. A library split has to separate them anyway.

**The top level is cluttered.** It has 21 visible entries, most of them inputs
to one Vite multi-page build: `index.html`, `games/`, `demos/`, `playground/`,
`spike/`, `site/` (which holds one CSS file), `public/`, `vite.config.ts`, and
texture scripts in `scripts/`. Planning material (`proposals/`, `tasks/`,
`articles/`) sits beside them. Most of this was tidied on 2026-09-26; see
section 7, "Done already".

**More renderers are planned.** HTML and three.js libraries would each need
the same shape as the Pixi one. Settling the structure with two libraries is
cheaper than with five.

---

## 3. Names

Registered on 2026-09-25:

| Name | Where | Use |
| --- | --- | --- |
| `@mvtjs` | npm org | All published packages |
| `@mvt.js` | npm org | Held so nobody else can take it. Nothing published |
| `mvtjs` | GitHub org | Reserved. The repo stays at `github.com/yortus/mvt-games` for now (section 13.2) |

**Why `mvtjs` and not `mvt.js`.** Both work on npm (`@socket.io` shows dotted
scopes are fine). But GitHub org names cannot contain dots, so `mvtjs` is the
only spelling that can be the same on npm, GitHub and a domain. `mvtjs.dev` is
registered (owner unknown), and `mvtjs.org`, `.com` and `.io` showed no
nameservers when checked. Prose can still say "MVT.js", the way Vue.js
publishes as `vue`.

**Taken:** `@mvt` (exists, no public packages), `@mvtt`, `@mvts`, `@mvtm`.

**No unscoped package for now.** An unscoped `mvtjs` or `mvt.js` is very
likely refused: npm strips `.`, `-` and `_` from a new unscoped name and
rejects it if the result matches an existing name, and an unrelated `mvt-js`
(2022) exists. npm does not document the exact rule, so only a publish attempt
settles it. If a scaffolder is wanted later, `npm create @mvtjs` runs
`@mvtjs/create`, and `create-mvtjs` (for `npm create mvtjs`) is free.

---

## 4. Background: multi-package tooling in September 2026

This section is the research the tooling choices rest on. It dates quickly;
check it before relying on it.

### 4.1 What changed in the last few years

- **The package manager owns the workspace.** Linking and one root lockfile
  are standard in all of them, and `workspace:` ranges in all but npm. Lerna 9 removed `bootstrap` and `add`.
- **pnpm is the default choice, and does more than install:**
  - `workspace:^` ranges, rewritten to real versions on publish.
  - Catalogs: a shared version declared once in `pnpm-workspace.yaml` and
    referenced as `catalog:`.
  - Native changeset-compatible versioning since 11.11 (July 2026):
    `pnpm change`, `pnpm version -r`, reading the same `.changeset/*.md` files
    as Changesets.
  - A cached task runner since 11.25 and 12.4 (late August to September 2026):
    `tasks` in `pnpm-workspace.yaml`, run by `pnpm pipeline`.
  - pnpm 12, a Rust rewrite, went stable on 2026-08-26 with the same commands,
    settings and lockfile. npm's `latest` tag still pointed at 11 when checked.
- **Rust and Go rewrites everywhere:** pnpm 12, Yarn 6 (preview), Turborepo,
  Rolldown and Oxc (inside Vite 8, released 2026-03-12), and TypeScript 7 (Go,
  GA 2026-07-08). TypeScript 7 has no stable API until 7.1, so tools built on
  the compiler API, including typescript-eslint, stay on the JavaScript
  compiler for now.
- **Vite+** (VoidZero, MIT) is one `vp` CLI over Vite, Vitest, Rolldown,
  tsdown, Oxlint and Oxfmt, with a cached task runner. **1.0 was released on
  2026-09-28**, after two release candidates (2026-09-22 and 2026-09-26); it
  is `1.0.0-rc.1` unchanged, and is npm's `latest` tag. Cloudflare acquired
  VoidZero in June 2026 and committed to keeping the tools MIT and
  vendor-neutral. Section 9 evaluates it.
- **Publishing security was overhauled:**
  - Classic npm tokens are gone. New write tokens default to a 7-day lifetime
    (90 at most), and npm plans to stop direct publishing with tokens from
    January 2027.
  - The expected route is **trusted publishing**: the CI job authenticates to
    npm through OIDC, with no stored secret. Provenance is attached
    automatically for public GitHub repos. It needs npm 11.5.1+ and Node 22.14+.
  - **Staged publishing** (GA May 2026): CI stages a version with
    `npm stage publish`, and a maintainer approves it with 2FA.
- **Library builds:** tsup is unmaintained and tsdown replaced it. The
  `isolatedDeclarations` compiler option makes `.d.ts` generation near-instant.
  `publint` and `attw` check a package before it ships.
- **Source-first internal packages.** A custom `exports` condition plus
  `customConditions` in `tsconfig.json` lets everything inside the repo read a
  sibling package's `src/*.ts`. There is no build step in development, and
  types stay live across packages.

### 4.2 Repo shapes

| Shape | Verdict |
| --- | --- |
| One package with subpath exports (`@mvtjs/mvt/pixi`) | Least churn, but one version and one dependency set for everything |
| **Workspace monorepo:** published `packages/*` plus private apps | The mainstream choice, and the one taken here |
| One repo per library | Wrong fit: the libraries depend on each other |

### 4.3 Tools by layer

| Layer | Mature | Newer or lighter | Heavier |
| --- | --- | --- | --- |
| Package manager | pnpm 11 (12 stable); npm workspaces (no `workspace:` ranges or catalogs) | Bun (has catalogs); Yarn 6 (preview); nub/aube (launched June 2026) | |
| Task running | `pnpm -r` / `--filter` or `npm run --workspaces` / `-w`, no cache | `pnpm pipeline` (weeks old); Vite+ `vp run` | Turborepo 2.11; Nx 23; moon v2 |
| Versioning and release | Changesets 3 | pnpm native (same files) | release-please; semantic-release; Nx release |
| Library build | tsdown, or plain `tsc` for pure-ESM TypeScript | Vite+ `vp pack` (tsdown underneath) | |
| Package checks | publint, attw, knip | sherif / manypkg / syncpack (keep manifests consistent) | |
| Publishing | GitHub Actions, trusted publishing, provenance | Staged publishing with 2FA approval | |

---

## 5. Packages

### 5.1 `@mvtjs/utils`

No runtime dependencies, and no DOM or Pixi use, so it runs anywhere.

**Why `utils` and not `core`.** MVT is a pattern that needs no library at
all, and "core" would suggest this package is required to use it. `utils`
reads as what it is: optional helpers. The other names considered are in
section 13.2.

| From | Notes |
| --- | --- |
| `src/mvt-utils/` | The scene-pass core ([022](./022-renderer-agnostic-jsx.md)), at `.` |
| `src/mvt-utils/jsx/` | 022's renderer-agnostic JSX base, at `./jsx`: for renderer packages and authors of new JSX targets, not for views. Its `refresh-copies.ts` is generated, not checked in (by the package's own `scripts/generate-refresh-copies.ts`, task 025): the package's build must generate it first, and ship it |
| `src/mvt-utils/watch.ts` | Moved from `src/common/` (2026-09-30), as were the rows below |
| `src/mvt-utils/sequence.ts`, `sequence-reaction.ts` | |
| `src/mvt-utils/boolean-tween.ts`, `edge-tween.ts` | |
| `src/mvt-utils/memoise-last.ts` | |
| `src/mvt-utils/slot-list/` | |
| `src/mvt-utils/type-utils.ts` | |
| `src/mvt-utils/watch-builder.spike.ts` and its test | Moves with `watch`, still unexported, per [008](./008-watch-builder-spike.md) |
| `src/mvt-utils/jsx/conformance/` | The conformance suite for JSX targets, at `./jsx/conformance`, with `vitest` an optional peer. 022 section 12 left this open beside a private package; exporting it was the smaller change, and phase 6 can still choose otherwise |
| ~~Reactivity benchmarks~~ | Stay in `benchmarks/` (section 7) |

### 5.2 `@mvtjs/pixi`

`pixi.js` is a **peer** dependency. It depends on `@mvtjs/utils`.

| From | Notes |
| --- | --- |
| `src/pixi-mvt/` | Mixin, `updateScene`, `refreshScene`, `SKIP_DESCENDANTS` |
| `src/pixi-mvt/jsx/` | JSX runtime, `<List>`, `<Switch>`, at `./jsx` |
| `src/pixi-mvt/texture-registry.ts` | Generic Pixi helper, used by six games. Moved from `src/common/` (2026-09-30) |
| `src/pixi-mvt/frame-stats.ts` | Frame timing for a Pixi app, used by the perfmon. Moved from `src/common/` (2026-09-30) |
| ~~Scene-pass benchmarks~~ | Stay in `benchmarks/` (section 7) |

Exports: `.`, `./jsx`, `./jsx/jsx-runtime` and `./jsx/jsx-dev-runtime`. JSX files then declare `/** @jsxImportSource
@mvtjs/pixi/jsx */` in place of today's `#pixi-mvt/jsx`. The root never
re-exports `./jsx`, so a view written in plain TypeScript imports only the
root, and JSX stays optional. Its `sideEffects` must list the mixin, which
installs itself on `Container` when loaded.

**Staying in the site, not the library:** `keyboard-input-view`,
`touch-input-view` and `pause-menu-view` (used only by `src/main.ts`),
`overlay-view` (the games' shared overlay), and `is-touch-device` (DOM only).
They move to `site/src/shared/`. The input views in particular are shaped
around this site's cabinet and games, and are not general enough to publish.

**Each renderer package re-exports the tick API it shares with
`@mvtjs/utils`, and nothing else from it.** That is `SKIP_DESCENDANTS`,
`hasUpdate`, `hasRefresh`, the read and scene counters, and the method types:
with the renderer's own `tickScene` and `setTickMethods`, everything a view
needs to take part in the tick. So a game installs one renderer package and
imports its whole tick API from it, and `@mvtjs/utils` stays optional, for its
helpers (`watch`, tweens, sequences, slot lists). `@mvtjs/utils` still
defines those names, and the renderer packages use them from there. In this
repo, lint makes the site and the benchmarks import them from a renderer
package, and a test checks that every renderer re-exports the same names, as
the base's own values. Decided 2026-10-02, reversing this proposal's first
draft; the trade-offs are in section 13.2.

### 5.3 Consumption inside the repo

Each library exports its source under a namespaced custom condition, and its
build output otherwise:

```jsonc
// packages/pixi/package.json (sketch)
{
    "name": "@mvtjs/pixi",
    "version": "0.1.0",
    "type": "module",
    "exports": {
        ".": {
            "@mvtjs/source": "./src/index.ts",
            "types": "./dist/index.d.ts",
            "default": "./dist/index.js"
        },
        "./jsx": {
            "@mvtjs/source": "./src/jsx/index.ts",
            "types": "./dist/jsx/index.d.ts",
            "default": "./dist/jsx/index.js"
        },
        "./jsx/jsx-runtime": {
            "@mvtjs/source": "./src/jsx/jsx-runtime.ts",
            "types": "./dist/jsx/jsx-runtime.d.ts",
            "default": "./dist/jsx/jsx-runtime.js"
        }
    },
    "files": ["dist", "src"],
    "dependencies": { "@mvtjs/utils": "^0.1.0" },
    "peerDependencies": { "pixi.js": "^8.16.0" }
}
```

- `tsconfig.base.json` sets `customConditions: ["@mvtjs/source"]`, and the
  site's Vite config and the root Vitest config add the same condition to
  `resolve.conditions`. The site, the docs and the tests then run the libraries
  from source: no build step, no watch mode, live types.
- The condition is namespaced so it cannot collide with another package's
  conditions.
- The published `exports` keep the source condition, and `src/` ships beside
  `dist/` so the paths it names exist (publint reports exported files missing
  from the tarball). Nothing outside the repo sets the condition, so consumers
  get `dist/`. Shipping `src/` also gives source maps real files to point at.
  npm has no way to drop the condition at publish time: pnpm's
  `publishConfig.exports` override, which the first draft used, is not an npm
  feature (section 13.2). If tsdown is set to generate `exports`, it must keep
  the condition; otherwise `exports` stays hand-written.
- The lint barrel rule becomes redundant between packages: `exports` enforces
  it. It is still needed inside each package.

### 5.4 Versioning

All libraries share one version, starting at `0.1.0` (with Changesets, a
`fixed` group). They depend on each other and are young, so separate version lines
would mostly produce compatibility questions. Revisit at 1.0.

### 5.5 Later packages

| Package | Contents |
| --- | --- |
| `@mvtjs/html` | DOM renderer: scene passes, and its JSX runtime at `./jsx` (`src/html-mvt/`) |
| `@mvtjs/three` | three.js renderer: scene passes and pointer picker, and its JSX runtime at `./jsx` (`src/three-mvt/`) |
| `@mvtjs/pixi-widgets` | Reusable Pixi views |
| `@mvtjs/eslint-plugin` | MVT architecture rules (section 10) |

**Known points of generalisation, not to be acted on yet.** `list.ts` and
`switch.ts` depend on Pixi's `Container` and `refreshScene`, but their logic
(index-addressed slots, matching on a key) is not Pixi-specific. The `onUpdate`/`onRefresh` tree walk is the same
idea on any scene graph. When a second renderer arrives, these are the parts
that may move into `@mvtjs/utils` behind a small host interface. Abstracting them before
then would be guessing.

*Since acted on:* [022](./022-renderer-agnostic-jsx.md) designed this against
three renderers. Its phase 1 split the JSX runtime into a base (`src/mvt-utils/jsx/`,
with `<List>` and `<Switch>`) and Pixi's JSX target, and moved the scene-pass types to
`src/mvt-utils/`; the generic tree walk is its phase 2. Its section 12 maps
the result onto these packages. HTML and three.js are built too. After 022,
the directories were shaped as the packages (2026-09-30): one base,
`src/mvt-utils/`, with the JSX base in `jsx/`, and one directory per
renderer, `src/<renderer>-mvt/`, with its JSX support in `jsx/`. A separate
`@mvtjs/jsx`, planned at first, was folded into `@mvtjs/utils`. A build-time
JSX precompiler, `@mvtjs/jsx-precompile`, was planned from 022 and built,
then removed with the runtime's generated code (task 025, 022 section 7.7):
the runtime needs no build tool.

---

## 6. The non-library parts

### 6.1 Options considered

| Option | For | Against |
| --- | --- | --- |
| **One `site` package** (cabinet, games, demos, playground, spike) | Mirrors today's single Vite multi-page build. Least churn | One manifest carries the playground's editor dependencies |
| One package per deployable (site, playground) | Separate dependencies | Nothing needs the separation yet |
| Each game as its own package | Strongest isolation | Seven or more extra manifests for little gain |

**Chosen: one `site` package.** Nothing outside the site uses the games,
demos or playground. `site/src/` is organised by area (`cabinet/`, `games/`,
`demos/`, `playground/`, `shared/`), so extracting any of them later is a move,
not a refactor.

**Reconsidered before phase 2 (2026-10-02): should the playground be a
package of its own?** It was already the most separable part: it imports
nothing from the games, demos, cabinet or shared views, only the libraries and
its own dependencies (CodeMirror, `sucrase`, `lz-string`). Splitting it out
would mean:

- its own `package.json`, Vite config (two page entries) and tsconfig;
- a build into `dist/playground/` with its own `base`, and a root `build` that
  runs the site's, the playground's and the docs' builds in turn;
- a second dev server, with the site's forwarding `/playground` to it as it
  forwards `/docs` today, or the nav's links break in development;
- the nav (`nav.css` and the links every page repeats) shared across
  packages, through a small package of its own or by copying.

| | For | Against |
| --- | --- | --- |
| Split the playground out | Its dependencies in their own manifest; tests and build that run alone; ready to be hosted elsewhere, or to run against the published packages | Nothing changes for users: Vite already gives each page only its own imports, so no game page loads CodeMirror. The costs above are all new problems |
| Keep one `site` package (chosen) | One dev server, one build, one nav | The site's manifest carries the playground's dependencies |

The independence that matters, the playground sharing no code with the rest
of the site, is kept by lint instead (`import/no-restricted-paths`, both
ways). Splitting games from demos was ruled out too: both use the shared views,
so it would need a shared package first, and the benchmarks would depend on
two app packages, for no gain.

**Revisit if** the playground needs Vite settings or plugins the site does
not, is hosted elsewhere (its own origin would isolate the sandbox), or should
run against the published packages.

### 6.2 Docs stay separate

`docs/` becomes its own private package at the top level:

- VitePress is a separate tool with its own Vite (VitePress 1.6.4 is on
  Vite 5; 2.0 is alpha).
- The `.md` files need to stay readable on GitHub, and `AGENTS.md` and the
  skills link into them throughout.
- It documents the libraries, so its versions track theirs rather than the
  site's.

### 6.3 Planning material

`proposals/` and `tasks/` move under one folder, `notes/`. Done
(2026-09-26), with one change: `articles/` went to `docs/articles/` instead,
since an article is written for publication rather than planning. It is
excluded from the docs build until it is published.

---

## 7. Target layout

```
.claude/  .github/  .vscode/
docs/                 VitePress, private package
notes/                proposals/, tasks/, archive/
packages/
    utils/            @mvtjs/utils   src/, scripts/
    pixi/             @mvtjs/pixi    src/
    three/            @mvtjs/three   src/
    html/             @mvtjs/html    src/
benchmarks/           private package: the harness and suites, for libraries and games alike
checks/               private package: tests of the repo's structure, not behaviour
site/                 private package
    src/              cabinet/, games/, demos/, playground/, shared/, main.ts
    scripts/          texture generation, spritesheet plugin
    index.html, games/, demos/, playground/  (HTML entry points)
    vite.config.ts
dist/                 the Pages output (ignored): the site, and the docs in docs/
.editorconfig  .gitignore  .node-version  AGENTS.md  README.md
package.json  package-lock.json  tsconfig.json  tsconfig.base.json
eslint.config.js  vitest.config.ts   (one root vite.config.ts instead, under Vite+)
```

Where each current top-level entry goes:

| Now | Goes to |
| --- | --- |
| `site/nav.css` | `site/src/shared/nav.css` |
| `vite.config.ts` | `site/` |
| `src/main.ts`, `cabinet/`, `games/`, `demos/`, `playground/` | `site/src/` |
| `src/common/` | Already split per sections 5.1 and 5.2 (2026-09-30); what is left is the site's shared views, in `site/src/shared/` (its alias renamed `#shared`) |
| `src/pixi-mvt/`, `src/pixi-mvt/jsx/` | `packages/pixi/src/` |
| `scripts/generate-refresh-copies.ts` | `packages/utils/scripts/` (done in phase 1) |
| `scripts/generate-*-textures.ts`, `generate-textures.ts`, `vite-plugin-spritesheet.ts` | `site/scripts/` |
| `benchmarks/` | Stays, as a private package (phase 2). It became one harness after this proposal was written, and its suites measure the games and demos as well as the libraries, so it cannot split by package. It imports the libraries by package name, the site's code by path, and its bundler sets the source condition |
| `dist/` (build output) | Stays at the top level, still ignored. It is the Pages output of two packages, the site and the docs (in `dist/docs/`), so inside `site/` the docs package would write into the site's |
| The site's test settings in `vite.config.ts` | A root `vitest.config.ts`, which runs every workspace's tests (phase 2) |
| `package-lock.json` | Stays, covering every workspace |
| `tsconfig.json` | `tsconfig.base.json` for shared options, one `tsconfig.json` per project, and the root `tsconfig.json` as the solution file `tsc -b` reads (done in phase 1) |

**Done already (2026-09-26).** Without the package split:

- The HTML entry points (`index.html`, `games/`, `demos/`, `playground/`)
  moved into `site/` beside `nav.css`, and `site/` is Vite's root. The pages
  still load `/src/...`, through a Vite alias. `dist/` stays at the top level.
- `spike/` and `src/pixi-mvt-demo/` were deleted; `<List>`, `<Switch>`, the
  scene-passes tests and the `scene-passes` benchmark cover what they showed.
- `public/` (only an empty `.nojekyll`) and `.github/copilot-instructions.md`
  (Copilot reads `AGENTS.md`) were deleted.
- `proposals/` and `tasks/` are under `notes/`; `articles/` is in
  `docs/articles/`; `CLAUDE.md` is `.claude/CLAUDE.md`; `llms.txt` is
  `docs/public/llms.txt`.

---

## 8. Toolchain

### 8.1 Base stack

Independent of the Vite+ decision:

| Concern | Choice | Why |
| --- | --- | --- |
| Node | 26, pinned in `.node-version` and CI | Vite+ needs 22.18+ or 24.11+, trusted publishing needs 22.14+, and TypeScript-written lint rules need Node's type stripping (section 9.2). 26 enters LTS in late October 2026, so it is the next LTS line rather than one about to be superseded. Local is 26.10 already |
| Package manager | npm 11 workspaces | Already in use, and enough for this plan. Why not pnpm: section 13.2 |
| Ranges between libraries | Plain semver ranges (`^0.1.0`), updated by Changesets at each release | npm links a sibling whose version satisfies the range. If a range stops matching, npm installs the published copy instead of linking, without an error; `npm ls @mvtjs/utils` shows which |
| Shared versions | Dev tools (`typescript`, `vitest`, ESLint) once, in the root `devDependencies`. Runtime versions repeated across manifests (`pixi.js`, `three`) kept in step by hand | Too few repeats to need pnpm's catalogs. Add `sherif` if they drift |
| Undeclared dependencies | `import/no-extraneous-dependencies`, checked per package | npm's flat `node_modules` lets a package import what it never declared, which works here and breaks for consumers. The lint rule catches it, the job pnpm's strict layout would do |
| Task running | Plain `npm run --workspaces` / `-w <name>` scripts | npm runs workspaces in the order listed, not by dependency. Source-first consumption and `isolatedDeclarations` remove the need for build ordering. Add caching only when something is slow |
| Library build | tsdown, with `isolatedDeclarations` | Current standard. Produces `exports` and `.d.ts` |
| Package checks | publint and attw on every build | Catches broken `exports` before publishing |
| Tests | One root Vitest config using `projects` | One command, per-package environments |
| Versioning | Changesets, all libraries in one `fixed` group, used without release PRs (section 8.5) | Mature, and works with npm. One command bumps every version and writes the changelogs |
| Publishing | GitHub Actions with npm trusted publishing and provenance | No stored tokens. Consider staged publishing once there are users |

### 8.2 Not chosen

- **pnpm:** nothing in this plan needs it (section 13.2). That also rules
  out `pnpm pipeline` and pnpm's native release commands.
- **Turborepo, Nx, moon:** caching and orchestration this repo does not need
  at two libraries and a site. Turborepo is the fallback if builds become slow.
- **The Changesets GitHub Action and bot:** they exist to manage release PRs,
  which this repo does not use (section 8.5).

### 8.3 CI

`deploy.yml` stays on `npm ci`, moving from Node 22 to 26. It otherwise
does the same job: lint, test, build the site, build the docs, deploy
Pages. A second workflow, `release.yml`, publishes (section 8.5). The
trusted-publisher entry on npm names the GitHub owner, repo and workflow file
(`yortus/mvt-games`, `release.yml`), so moving the repo later means
re-registering it (section 13.2).

### 8.4 Formatting

**Formatting stays this repo's own.** The standard is the current
`@stylistic` configuration (4-space indent, single quotes, stroustrup braces,
operators at line starts, and the rest of `eslint.config.js`), plus custom
rules where the style guide says more than `@stylistic` can (section 10).
It is checked in CI and auto-applied by `--fix` and by fix-on-save in the
editor.

Opinionated formatters (Prettier, and Oxfmt, which follows Prettier) are out.
Consistency is the goal. Adopting someone else's preferences is not, and
Prettier offers too few ways out of choices this repo disagrees with (it
cannot produce stroustrup braces, for one). Published packages are unaffected
either way; this is about contributions to this repo.

### 8.5 Release workflow

The repo has one maintainer, who commits straight to `main`. Releasing keeps
that: no pull requests, no bot, and nothing to do per commit.

**Day to day, nothing changes.** Optionally, run `npx changeset` when a
change deserves a changelog line while it is fresh. It asks for the bump size
and one line of summary, and writes a small `.changeset/*.md` file to commit
with the change. Skipping this is fine; the summary can be written at release
time instead.

**To release:**

1. `npx changeset`, if no change files are waiting: pick the bump, write the
   summary.
2. `npx changeset version`: bumps every library to the same new version,
   updates the dependency ranges between them, writes each package's
   `CHANGELOG.md`, and deletes the used change files. Then
   `npm install --package-lock-only`, since `package-lock.json` records each
   workspace's version and Changesets does not update it.
3. Commit and push to `main`.

**CI does the rest.** `release.yml` runs on every push to `main`: install,
lint, test, build, then `npx changeset publish`. That publishes only versions
not yet on npm, so on an ordinary push it does nothing. When a version is new,
it publishes each library through `npm publish`, authenticated by trusted
publishing with provenance, then pushes the `@mvtjs/<name>@<version>` git tags it
created (`git push --follow-tags`, so the job needs `contents: write`).

An `npm run release` script can wrap steps 2 and 3. The whole release is then
about a minute of attention.

**One-time setup:** `.changeset/config.json` (the `fixed` group, public
access, base branch `main`, `commit: false`), the `release.yml` workflow, and
a trusted-publisher entry on npm for each package (`npm trust` configures
several at once).

**Optional additions, if they ever pay for themselves:**

- `changeset status` in CI, to fail a push whose changes have no change file.
  Only worth it with other contributors.
- Staged publishing, so CI can only stage a version and nothing reaches npm
  until it is approved with 2FA. That protects against a compromised CI
  pipeline or GitHub account, at the cost of one approval per release.
- `@changesets/changelog-github`, for commit links in the changelogs.

---

## 9. Vite+ evaluation

### 9.1 Fit

Vite+ wraps the tools the repo already uses or would adopt: Vite, Vitest,
tsdown (`vp pack`), and a cached task runner (`vp run`), plus Oxlint and Oxfmt.
It drives whichever package manager the repo uses (npm, pnpm, Yarn or Bun;
npm is detected from `package-lock.json`), so the workspace layout in section
7 is the same with or without it.

**For:**

- The same team makes Vite, Vitest, Rolldown and Oxc, and tests them as one
  stack.
- Low lock-in. Published packages never depend on it, and every tool under it
  works on its own. Leaving means replacing `vp x` with the direct command and
  moving the `lint`, `run` and `pack` config blocks out of `vite.config.ts`.
- Lint, task and pack config all live in the root `vite.config.ts`, which
  removes `eslint.config.js` and any separate tsdown config.
- Oxlint's type-aware rules run on TypeScript 7 (through tsgolint), so linting
  is not held back by typescript-eslint's dependence on the older compiler.

**Against:**

- No release tooling. Changesets is still needed.
- Adopting it moves Vite 7 to 8 and Vitest 4 to 5 in the same step.
- VitePress keeps its own Vite 5, so the docs sit outside the unified Vite
  version.
- It is young. 1.0 is stable but days old, and about 2,600 public repos
  depended on it at release (1,300 in August 2026), so there are fewer answers
  when something breaks.
- Oxlint's JS plugin support, which this repo's formatting depends on (9.2),
  is still alpha. Vite+ 1.0 being stable does not change that: the Oxlint docs
  still said "alpha" on 2026-10-02.

### 9.2 Lint trial (2026-09-25)

The question was whether Vite+ can enforce section 8.4's formatting without
Oxfmt. It can. Details and method are in appendix A; in short:

| Test | Result |
| --- | --- |
| The 65 `@stylistic` rules (the repo's `customize()` call plus its overrides) as an Oxlint JS plugin | All load and report correctly, including stroustrup braces and operator placement |
| Unmodified copy of `src/` | Clean, as with ESLint |
| All 266 files scrambled (about 53k changed lines), then `--fix` with each tool | **Byte-identical results.** ESLint converges in one run, Oxlint in five |
| One `--fix` run over `src/` | Oxlint 2.5s, ESLint 15.8s |
| `import/no-internal-modules` from `eslint-plugin-import` as a JS plugin | Works (after the section 11.1 fix) |
| Custom rules in a local workspace package, loaded by package name | Work, including an auto-fix |
| The same package loaded by ESLint | Works: rules in the plain ESLint format are portable |
| A rule written in TypeScript, no build step | Loads on Node 24; fails on Node 22.11 |
| Vite+ RC with the rules in `vite.config.ts`: `vp lint`, `vp lint --fix`, `vp check` | All work. `check: { fmt: false }` makes `vp check` lint and type-check only, and prints a note saying so |

The Vite+ docs cover this case directly: `check.fmt: false` is described as
being "for a team that lints but does not format". Fix-on-save in VS Code goes
through the Oxc extension's `source.fixAll.oxc` code action.

**The results hold for 1.0.** The trial used `1.0.0-rc.0`. 1.0 bundles the
same Oxlint (1.85.0) and Vitest (5.0.1), and its lint changes since then
affect only setup, not results (section 9.3).

**Caveats found:**

- Oxlint needs repeated `--fix` runs to converge on heavily damaged files. For
  everyday edits one run is enough; a bulk reformat needs a loop that re-runs
  until the tree is clean.
- JS plugins cannot use type information. Only Oxlint's built-in rules are
  type-aware.
- A package holding lint rules must declare its own dependencies. The trial
  ran under pnpm, whose strict layout enforces this; npm's hoisting would hide
  a missing one.

### 9.3 Trial phase

The migration runs on the base stack (section 8.1) first. Vite+ is then tried
on a branch (phase 5 in section 12), and adopted only if all of these hold:

1. `vp lint` with the repo's rule set reports nothing on the clean tree and
   matches ESLint on a scrambled one.
2. Oxlint's built-in rules cover `@eslint/js` recommended and typescript-eslint
   recommended, or every gap is listed and judged acceptable.
3. The barrel rule reports a deliberate violation (section 11.1).
4. Fix-on-save in VS Code applies `@stylistic` fixes, with no formatter
   configured.
5. `vp test` runs every suite, including the `solid-js` alias the
   benchmarks need, after the Vitest 5 upgrade.
6. `vp install` and `vp run` work on the npm workspace (Vite+ defaults to
   pnpm, so npm is the less-travelled path), `vp run` caching works across
   the packages, and `vp pack` output passes publint and attw.
7. The VitePress docs still build and deploy.

If any fails, the repo stays on ESLint, npm scripts and tsdown. Nothing else
in the plan changes.

The trial uses 1.0 or a later 1.x. Two breaking changes since the RC the lint
trial used (both in `1.0.0-rc.1`) affect how it is set up:

- Task-cache settings (`env`, `untrackedEnv`, `input`, `output`) now sit under
  a `cache` field; `vp migrate` converts older config (criterion 6).
- Editors now start the linter's language server with `vp lint --lsp` rather
  than Oxlint directly. Fix-on-save (criterion 4) is checked against that
  setup.

---

## 10. Lint rules package

Custom rules live in one workspace package with two presets:

- **`architecture`**, publishable as `@mvtjs/eslint-plugin`: rules that
  enforce MVT itself, useful to anyone building with it. Candidates, from
  `AGENTS.md`'s critical rules:
  - no `setTimeout`, `setInterval`, `requestAnimationFrame` or `Date.now()` in
    models;
  - no per-tick allocation in `update`/`refresh` bodies (`.map()`,
    `for...of` on arrays, inline closures, template-string keys).
- **`style`**, used only in this repo: what the style guide says and lint does
  not check today. Candidates: no em-dashes (the trial rule, with auto-fix),
  no `null`, no `this`, no self-imports. On the trial copy of `src/`, `no-null`
  found 23 uses and `no-this` 30. Some `this` uses may be legitimate (the Pixi
  mixin), so that rule needs exceptions or an allow list.

Rules are written in the plain ESLint v9 plugin format, not with Vite+'s
`definePlugin` helpers, so the published plugin works under ESLint and
Oxlint alike, and leaving Vite+ stays cheap. TypeScript source is fine on
Node 24 and later; the published package is built to JavaScript.

---

## 11. Issues to fix during the restructure

### 11.1 The barrel rule crashes on its first violation

*Fixed 2026-09-30, ahead of phase 1, when 022 moved JSX runtimes to
`jsx/` subpaths and the first import reached past a barrel: the entries are
escaped, and a deliberate violation is reported, not crashed on. The check
below still applies to each package's allow list after the split.*

**Must be fixed as part of phase 1** (section 12.2). `import/no-internal-modules`
in `eslint.config.js` crashes ESLint the first time any file actually reaches
past a barrel:

```
TypeError: re.test is not a function
Rule: "import/no-internal-modules"
```

The rule compiles each `allow` entry with minimatch 3, which treats a leading
`#` as a comment. `'#common'` and `'#pixi-mvt/jsx'` therefore compile to `false`
instead of a regular expression, and the rule calls `.test()` on it. `npm run
lint` passes today only because nothing violates the rule.

Reproduced on 2026-09-25 by piping a file with
`import { refreshScene } from '../pixi-mvt/scene-passes';` into the repo's
ESLint with `--stdin --stdin-filename src/zz-violations/bad.ts`.

**Fix:** escape the entries (`'\\#common'`, `'\\#pixi-mvt/jsx'`), or drop them
when the aliases are replaced by package names. **Either way, the phase is
not done until a deliberate violation is shown to be reported, not crashed
on.** The same check applies to whatever allow list the rule ends up with in
each package, and under Oxlint if Vite+ is adopted.

### 11.2 Node version

CI uses Node 22. The toolchain needs 24 or later, and the plan pins 26
(section 8.1). Local is on 26.10 already (2026-10-02); CI upgrades in phase 0.

---

## 12. Migration plan

Each phase is one PR that leaves `lint`, `test`, `build` and the Pages deploy
working. Moves use plain `mv`, leaving staging to review; git detects
the renames when the moved files are staged, so history follows them.

### 12.1 Phase 0: prerequisites

- ~~Node 26 locally and in CI; add `.node-version`.~~ Done (2026-10-02).
- ~~Update `deploy.yml` and `test-deploy.yml` for Node 26.~~ Done: both read
  `.node-version` through `node-version-file`, so it is the one place the
  version is set. The repo stays on npm (section 13.2), so nothing else
  changes.

### 12.2 Phase 1: extract the libraries

- ~~Add `workspaces` to the root `package.json`, and `tsconfig.base.json`.~~
- ~~Create `packages/utils` and `packages/pixi` from the files in sections 5.1
  and 5.2, with their tests, and `packages/three` and
  `packages/html` from 022's renderers. Each is one directory already
  (`src/mvt-utils/`, `src/pixi-mvt/`, `src/three-mvt/`, `src/html-mvt/`,
  each renderer's JSX in `jsx/`), so this moves directories. **The `-mvt`
  suffixes go here**: they only tell renderers apart from the site's code in
  one `src/`, and a package directory is named for its package.~~
- ~~The root package (still the app) depends on both through `^0.1.0` ranges,
  which npm links to the workspaces.
  Replace the `#mvt-utils` and `#<renderer>-mvt/jsx` imports, and relative
  imports into the library directories, with the package names, and the
  `@jsxImportSource #<renderer>-mvt/jsx` pragmas with `@mvtjs/<renderer>/jsx`.
  `#common` is the site's own and stays.~~
- ~~Wire the `@mvtjs/source` condition into TypeScript, Vite and Vitest.~~
- ~~Turn on `import/no-extraneous-dependencies` for each package (section 8.1),
  verified with a deliberate violation.~~
- Worktrees need their own `npm ci` from here on. A `node_modules` junctioned
  from the main checkout holds links to the main checkout's packages, so a
  worktree would run the main checkout's library code.
- ~~Rework the barrel rule for the new layout and **fix section 11.1**,
  verified with a deliberate violation.~~

All done, 2026-10-02.

**Progress.** Done one library at a time, each checked with lint, the tests,
the full build, the dev server, and a Node and a browser benchmark case.

- `@mvtjs/utils` (2026-10-02). The generator for `refresh-copies.ts` moved
  into the package and runs on Node's type stripping, so it needs no `tsx`;
  the root's `prepare` and `pre*` hooks call it through `-w @mvtjs/utils`.
  `tsconfig.base.json` holds the shared options. The root `tsconfig.json`
  became a solution file listing each project (the packages, `src/` and
  `benchmarks/`), and `build` and `build:site` run `tsc -b`, which checks each
  in turn and re-checks only what changed. It needs no project references
  between them: TypeScript 5.9 builds `noEmit` projects this way. A package's
  own tsconfig covers its tests, which nothing in the site imports. The barrel rule now covers `packages/*/src/`, and
  allows `@mvtjs/**`, whose `exports` set the boundary. Both rules reported a
  deliberate violation inside the package. The new dependency rule found four
  `@codemirror/*` packages the playground imported without declaring, which
  are now declared. The tarball leaves out tests and the spike
  (`npm pack --dry-run`), and publint finds nothing wrong except the missing
  `dist/`, which phase 6 builds.
- `@mvtjs/pixi`, `@mvtjs/three` and `@mvtjs/html` (2026-10-02), together,
  on the pattern `utils` set. Each exports `.`, `./jsx`, `./jsx/jsx-runtime`
  and `./jsx/jsx-dev-runtime` (the last two the same file, as the aliases
  were), depends on `@mvtjs/utils`, and takes its renderer as a peer. The root
  `imports` keeps only `#common`, and so does the barrel rule's allow list.
  Relative links in the notes that moved, `utils`'s included, were re-pointed
  for their new depth. The old names were renamed where code uses them as
  names: comments, the JSX targets' `name` (which error messages show), and
  test titles. Two benchmark labels keep `pixi-mvt` until the suite is next
  saved, so they match the saved results the docs include. The prose of the
  packages' own notes (`README.md`, `design-notes.md`) still says `pixi-mvt`
  and the like: phase 4 updates it with the rest of the docs.

**Left for phase 6:** each renderer package's `sideEffects`, which must list
its mixin (left unset for now, so nothing is tree-shaken by mistake while the
site builds from source), and wider peer ranges for `three` and
`@types/three`. On a 0.x version, `^0.186.1` allows only 0.186.x, and three
releases a new 0.x minor about every month, so a consumer a release ahead
would get a peer conflict from npm. `pixi.js`'s `^8.16.0` is fine.

**Since phase 1:** the renderers' re-exports were settled (section 5.2), with
the lint rule and the test described there, and `@mvtjs/three` takes
`@types/three` as an optional peer (section 13.2). The root `typecheck` script
gave way to `tsc -b`.

### 12.3 Phase 2: move the app into `site/`

- ~~Everything listed for `site/` in section 7.~~
- ~~The site's own `package.json` takes the app's dependencies (`gsap`,
  CodeMirror, `sucrase`, `lz-string`) and its scripts.~~
- ~~`src/renderer-packages.test.ts` does not move with the site. It checks the
  libraries' shape (every renderer re-exports the same tick API, section
  5.2), and sits in `src/` only because the app was the one project depending
  on all four packages. It moves to a new top-level private package,
  `checks/`, for tests that guard the repo's structure rather than test
  behaviour. `checks/` gets its own `package.json` (depending on the
  packages it checks) and a `tsconfig.json` listed in the root solution.
  Rename the test for what it guards (such as `renderer-tick-api.test.ts`).
  Later candidates: checks that each package's `exports` match its source
  tree.~~
- ~~A `README.md` in `checks/`, in plain words: what a check is (a test of a
  property the repo has chosen to keep, such as how the packages fit
  together, rather than of what the code does), what belongs there and what
  does not (a unit test of one package stays beside its code; a rule lint
  can express stays in lint), and how to add one. It alludes to the idea's
  name in the literature, fitness functions (from *Building Evolutionary
  Architectures*), for readers who know it, without making it the repo's
  term.~~

All done, 2026-10-02.

**Progress.** The app moved into `site/src/` and its build tooling into
`site/`: `vite.config.ts`, the texture scripts and the spritesheet plugin,
which needed no path changes, since each finds `src/games/` relative to its
own package. The pages load `nav.css` from `/src/shared/`, and the `/src/`
alias is gone: the pages and `src/` now share a root. `src/common/` became
`site/src/shared/`, and its alias, defined in `site/package.json`, `#shared`.

The root is now tooling only: ESLint, TypeScript, Vitest and, until phase 3,
VitePress. Its scripts call the site's with `-w site`, so every command is
unchanged. The workspaces are `packages/*`, `site`, `benchmarks` and
`checks`; the benchmarks became a package because, without one, the root
would have to declare everything they import. The tests' settings moved to a
root `vitest.config.ts`, which also stops the run picking up the agent
worktrees under `.claude/`: the counts before this phase included up to two
other checkouts' tests. 55 test files and 1158 tests are this repo's own.

Lint covers the site's new paths, lets config files at any depth use their
package's dev dependencies, and keeps the playground boundary (section 6.1),
shown to report a deliberate import each way, including from the level of
`main.ts`. Checked with `tsc -b`, lint, the tests, the full build (every
game's spritesheet emitted, the docs in `dist/docs/`), the dev server (every
page, the `/playground` redirect, `#shared`, the spritesheets), and three
Node benchmark cases through the site's new paths, one of them on solid-js.
The browser cases were not run.

### 12.4 Phase 3: docs package and top-level cleanup

- ~~`docs/` gets its own `package.json` (VitePress, the Mermaid plugin).
  Keep the combined Pages output (site at the root, docs under `/docs`).~~
- ~~Create `notes/`; move `CLAUDE.md` into `.claude/` and `llms.txt` to where
  it is served.~~ Done (section 7).

All done, 2026-10-02.

**Progress.** `docs/package.json` declares VitePress, the Mermaid plugin,
`mermaid` and `vue`, which the docs' theme imports directly and nobody
declared before (lint skips `docs/.vitepress/`). Its scripts run VitePress
from `docs/`, and the root's `build`, `build:docs` and `docs:dev` call them
with `-w docs`, so the commands are unchanged. VitePress keeps its own Vite 5,
resolved exactly as before. The output still lands in `dist/docs/`, with the
benchmark tables the docs include from `benchmarks/results/`, and a build with
CI's `BASE_URL` gives `/mvt-games/docs/` paths. The rest of the top level
already matched section 7, so there was nothing else to clean up.

### 12.5 Phase 4: references

Update every path that moved. A grep for
`src/(common|pixi-mvt|pixi-jsx|games|demos|playground|cabinet)` finds them in
`AGENTS.md`, `README.md`, `docs/public/llms.txt`, seven `docs/` files
(including the AI-agent skills), two task files and four scripts. Also update
`AGENTS.md`'s project structure and commands table, and
`docs/reference/project-structure.md`. Archived notes are historical and keep
their old paths; `notes/README.md` gets one line saying so.

Also in this phase:

- The prose of the packages' own notes (`README.md`, `design-notes.md`),
  which still says `pixi-mvt`, `mvt-utils` and the like.
- Comments in code that cite proposals (such as "proposal 012 section 2" in
  `scene-passes.ts`, and 022 in `owned-text.ts`, `html-elements.ts` and the
  conformance suite): each says the reason itself instead. Code and config
  never cite `notes/`.

### 12.6 Phase 5: Vite+ trial

Section 9.3, on a branch. It comes before publishing so the build and release
setup is written once, for whichever stack wins.

### 12.7 Phase 6: publishing

- tsdown builds (or `vp pack`), with publint and attw.
- Changesets and `release.yml`, set up as in section 8.5.
- Set up npm trusted publishing for each package, against
  `yortus/mvt-games` and `release.yml`. Each package's `repository` field
  names the same repo, with `directory` set to the package's folder, and its
  `homepage` is `https://yortus.com/mvt-games/docs/` (section 13.3; ideally
  switched over before this phase).
- Before the first publish, from the tick API's design
  ([027](../archive/027-mvt-method-names.md), task
  [028](../archive/028-tick-api-migration.md)): 027 section 11.7's mitigations
  for two copies of the scene passes in one program, and `SKIP_DESCENDANTS`
  made with `Symbol.for('mvt.skipDescendants')`, so every copy agrees (027
  section 7.6, item 3).
- Publish `@mvtjs/utils` and `@mvtjs/pixi` at `0.1.0`.

### 12.8 Phase 7: lint rules package

Section 10: the `style` preset first (it enforces this repo's existing rules),
then `architecture` rules one at a time.

---

## 13. Open questions

### 13.1 Unresolved

None.

### 13.2 Settled

| Question | Decision |
| --- | --- |
| Where the repo lives | For now, `github.com/yortus/mvt-games`. The `mvtjs` GitHub org is reserved. What a later move involves is below |
| Where the site lives | `yortus.com/mvt-games/`, on the owner's personal domain (section 13.3). MVT gets its own domain only if it outgrows being a personal project |
| Name of the planning folder | `notes/` |
| Do the renderer packages re-export from `@mvtjs/utils`? | The tick API they share with it, and nothing else (section 5.2) |
| How does `@mvtjs/three` declare `@types/three`? | As an optional peer |
| Where the input views go | They stay in `site/src/shared/`; they are not general enough to publish (section 5.2) |
| npm or pnpm? | npm workspaces. Nothing in this plan needs pnpm (decided 2026-10-02; the first draft chose pnpm 11) |
| Release tooling | Changesets, without release PRs (section 8.5) |
| Name of the dependency-free library | `utils` (section 5.1) |

The trade-offs behind the repo's home, the package manager, the release
tooling, the library's name, the re-exports and `@types/three` are kept below,
so they can be revisited with the same information.

**If the repo moves later.** Candidate homes are `github.com/mvtjs/mvt`
(libraries named after the pattern, like `vitejs/vite` or `pixijs/pixijs`),
`github.com/mvtjs/mvtjs` (matches the npm scope), or `mvtjs/mvt-games` (the
simplest transfer, but the name undersells a library repo). Splitting the
games into their own repo would suit a future where they are a showcase
consuming published packages, at the cost of source-first development across
both.

A move involves:

- **Site URLs.** GitHub redirects git operations and web links after a
  transfer, but **not Pages URLs**. With the site on `yortus.com` (section
  13.3), a move leaves the old paths in the owner's hands: the
  `yortus.github.io` repo can keep redirect pages at `/mvt-games/` pointing to
  the new home. If MVT later gets its own domain, `mvtjs.org` showed no
  nameservers when checked; `mvtjs.dev` is registered (owner unknown).
- **npm.** Re-register each package's trusted publisher (it names the owner,
  repo and workflow file), and update each package's `repository`, `homepage`
  and `bugs` fields before the next release.
- **Everything else that names the URL:** `README.md`, the docs' config and
  links, `llms.txt`, and the `BASE_URL` the deploy workflow sets.

**npm or pnpm.** The first draft chose pnpm 11, as the most common choice
for new monorepos. On review, nothing in this plan needs it, and npm is the
tool the owner already knows, so the repo stays on npm. What pnpm would add
here, and the answer under npm:

| pnpm feature | What it gives | Under npm |
| --- | --- | --- |
| `workspace:^` ranges | An error if a sibling's version stops matching the range | Plain ranges, kept in step by Changesets. A mismatch installs the published copy without an error (section 8.1) |
| Catalogs | One place for each shared version | Dev tools once in the root `devDependencies`; the two or three repeated runtime versions by hand, or `sherif` |
| `publishConfig.exports` | Drops the source condition at publish time | The condition ships, with `src/` (section 5.3) |
| Strict `node_modules` | Undeclared imports fail in development | `import/no-extraneous-dependencies` (section 8.1) |
| `pnpm -r` in dependency order | Builds that depend on each other run in order | Not needed: source-first consumption and `isolatedDeclarations` |
| Shared content store | Fast, disk-cheap installs in each new worktree | `npm ci` per worktree; this repo installs in seconds |
| Trusted publishing | | npm's own feature; no difference |
| `pnpm pipeline`, native versioning | | Weeks old, and turned down for that reason even with pnpm |

**Revisit if** catalogs start to pay (more packages sharing more peer
versions), an undeclared dependency gets past lint, or a range mismatch
causes a bug. Switching later is mechanical: `pnpm import` converts
`package-lock.json`, sibling ranges become `workspace:^`, the source condition
can move to `publishConfig.exports` (and `src/` stop shipping), and the
workflows change their install and run commands. At the time of the first
draft the choice within pnpm was 11 (npm's `latest` tag) over 12 (a Rust
rewrite, stable since 2026-08-26, with the same commands, settings and
lockfile).

**Changesets or pnpm native.** Only a choice if the repo moves to pnpm;
compared when the first draft chose pnpm. Both read and write the same
`.changeset/*.md` files, so switching later costs only the config.

| | Changesets 3 | pnpm native (11.11+) |
| --- | --- | --- |
| Maturity | Years of wide use, well documented | Two months old |
| Extra dependency | Yes (`@changesets/cli` and its config file) | None: config under `versioning` in `pnpm-workspace.yaml` |
| One shared version | `fixed` groups | `versioning.fixed` |
| Publishing | `changeset publish` publishes only versions not yet on npm, and tags them | `pnpm publish -r`, scripted by hand |
| CI automation | `changesets/action` opens a "Version Packages" PR and publishes when it merges; a bot flags PRs with no change file (neither used here) | `pnpm change check` validates versions in CI. No documented release-PR automation |
| Changelogs | Committed `CHANGELOG.md` files, with generators such as `@changesets/changelog-github` | Default `registry` storage (composed at publish time, packed into the tarball, nothing committed); `repository` storage commits them instead |
| Prereleases | A repo-wide "pre" mode | Per-package "lanes" (`X.Y.Z-lane.N`) alongside stable releases |
| Release branches | No special support | A committed ledger (`.changeset/ledger.yaml`) keeps cherry-picks between release branches safe |
| Extras | None needed here | "Epics" tie members' major versions to a lead package |

Changesets won on maturity and on `changeset publish`, which makes the
publish-on-every-push workflow in section 8.5 safe. pnpm's extras (lanes,
epics, the ledger) solve problems this repo does not have.

**Name of the dependency-free library.** `core` suggests the package is
required to use MVT, and MVT is a pattern that needs no library. The name had
to read as optional, stand apart from the renderer packages (`pixi`, `html`,
`three`) without sounding like a rival renderer, and survive the package growing
beyond today's time and change-detection helpers.

| Candidate | For | Against |
| --- | --- | --- |
| **`utils` (chosen)** | Plainly optional, instantly understood | Reads as a grab-bag, and `@x/utils` is everywhere |
| `std` | Short. "Standard library" reads as canonical but optional (Deno's `std`, Zig's `std`) | Some readers take "standard library" as "the runtime" |
| `kit` / `toolkit` | Optional helpers | SvelteKit-style names suggest a framework |
| `helpers` | Plain and accurate | Longer, and slightly apologetic |
| `primitives` | Accurate for `watch`, tweens and sequences | Long, and suggests low-level types |
| `common` | Matches today's `src/common/` | Sounds internal: code shared between the other packages |
| `tools` | | Suggests CLIs or build tooling |
| `ticker` / `tick` | Everything in it advances or polls per tick | The Ticker is MVT's loop driver, and this package does not drive the loop |
| `headless` | Says "no renderer" | Reads as a headless alternative to the renderers, which implies "core" again |
| `core`, `base`, `essentials` | | Imply the package is required |

Whatever the name, the docs should say plainly that MVT needs no library, and
that these packages are optional helpers.

**The renderers' re-exports.** The first draft said `@mvtjs/pixi` would not
re-export `@mvtjs/utils`. 022 then had `pixi-mvt` re-export the names it moved
into the base, so no call site changed, and the other renderers followed. Seen
from a game built on one renderer:

| | Keep the re-exports (chosen) | Remove them |
| --- | --- | --- |
| Installing | The renderer package and its renderer | Also `@mvtjs/utils`, as soon as a view skips a subtree, types its methods or reads a counter |
| Importing | The whole tick API from one package | Two imports, split along this repo's package internals rather than the game's task (`tickScene` from the renderer, `SKIP_DESCENDANTS` from utils) |
| `@mvtjs/utils` | Optional, as the docs promise | Needed by nearly every game |
| Counters | Always the copy the renderer counts into | A second installed copy of utils would count separately |
| One place per name | No: each of these names can be imported from two packages. Lint holds this repo to one | Yes |
| Upkeep | Three renderers keep one list in step; a test checks it | None |

**`@types/three`.** three ships no types; `@types/three` tracks its versions.
`@mvtjs/three`'s published types import `three`'s in their signatures
(`Object3D`, `Light`), and add nothing to them.

| Option | For a consumer |
| --- | --- |
| A dev dependency only | TypeScript users without `@types/three` lose `@mvtjs/three`'s types silently: with `skipLibCheck`, which most projects set, its imports from `three` become `any`. Mismatched versions go unnoticed |
| A dependency | Installed for everyone, but a consumer whose own range differs gets two copies, and classes with private members, such as `Object3D`, stop matching across them |
| A required peer | npm installs it for every consumer, JavaScript ones included, and checks its version |
| **An optional peer (chosen)** | Nothing extra is installed; when a consumer has it, as every TypeScript user of three does, npm checks its version against ours |

### 13.3 The site on `yortus.com`

**Decision.** The site is served from the owner's personal domain,
`yortus.com`, which will also hold a blog and other personal projects. MVT and
its games are, for now, a personal contribution and portfolio piece, so they
build one name alongside everything else there. A project domain (such as
`mvtjs.org`) waits until MVT outgrows that.

**How it works.** The custom domain is set on the owner's user site, the
`yortus/yortus.github.io` repo (Pages already enabled). GitHub then serves
every project site under the account that has no custom domain of its own at
the repo name as the path:

| Repo | Before | After |
| --- | --- | --- |
| `yortus/mvt-games` | `yortus.github.io/mvt-games/` | `yortus.com/mvt-games/` |
| `yortus/compression` (and other project sites) | `yortus.github.io/compression/` | `yortus.com/compression/` |

GitHub normally redirects the old `github.io` addresses to the custom domain;
confirm once switched.

**No change in this repo.** Nothing here names the site's host: the deploy
workflow sets `BASE_URL` from the repo name, which stays `/mvt-games/`. The
switch can happen before, during or after the migration. Doing it before
phase 6 means the packages' `homepage` fields
(`https://yortus.com/mvt-games/docs/`) are right from the first release.

**Steps, all outside this repo:**

1. Verify `yortus.com` in the GitHub account's Pages settings, before adding
   it to any repo. GitHub recommends this so nobody else can host a site on
   the domain if the Pages site is ever disabled.
2. Replace the domain's DNS records (at dnsowl/NameSilo). `yortus.com`
   currently resolves to `192.168.33.10`, a private address. It needs GitHub
   Pages' four A records (and AAAA records for IPv6) for the apex, and a
   `www` CNAME to `yortus.github.io`. GitHub recommends setting up `www` even
   when the apex is the main address.
3. Set `yortus.com` as the custom domain on the `yortus.github.io` repo, and
   enable "Enforce HTTPS" once the certificate is issued.
4. Give `yortus.com/` itself at least an index page (a list of projects is
   enough until the blog exists).
5. Optional: short links as redirect pages in the `yortus.github.io` repo,
   such as `yortus.com/mvt/` to the docs and `yortus.com/games/` to the games.
   GitHub Pages cannot do server-side redirects, so these are small HTML pages
   with a meta refresh and a canonical link.

**Trade-offs, for revisiting.**

- **For:** matches MVT's current stage; no new domain to buy or maintain;
  moves every project site in one step; and puts the site's URLs on a domain
  the owner controls, so a later repo move need not break them.
- **Against:** a personal domain signals "one person's project", which only
  matters if MVT starts attracting users and contributors. Moving to a project
  domain later would be a second URL change, handled with redirect pages from
  the `yortus.github.io` repo. Paths follow repo names, so renaming
  `mvt-games` would change its URL.
- **Alternative not taken:** a subdomain such as `mvt.yortus.com`, set as the
  `mvt-games` repo's own custom domain. It is independent of the repo name and
  easier to repoint at a DNS level, but it is one more thing to set up for no
  present need.

---

## Appendix A: lint trial method

Run on 2026-09-25 in a scratch directory outside the repo, on a copy of `src/`.

- **Setup:** Oxlint 1.85.0, `@stylistic/eslint-plugin` 5.10.0,
  `eslint-plugin-import` 2.32, ESLint 9.39, `vite-plus` 1.0.0-rc.0, on
  Windows. Oxlint's Windows binary had to be installed by hand because of an
  npm optional-dependency bug.
- **Config:** generated by calling the repo's
  `stylistic.configs.customize({ indent: 4, quotes: 'single', semi: true, jsx: true })`,
  merging the overrides from `eslint.config.js`, and writing the resulting 65
  rules to an Oxlint config with `jsPlugins: ['@stylistic/eslint-plugin', ...]`.
  The ESLint side read the same rule list, so both tools ran identical rules.
- **Scrambling:** every `.ts`/`.tsx` file had its leading indentation halved,
  `else`/`catch`/`finally` pulled onto the closing brace's line, simple
  single-quoted strings switched to double quotes, and trailing commas
  before closers removed. The scrambler is lossy (it breaks some strings and
  comments), so neither tool can restore the original exactly. The comparison
  that matters is the two tools' outputs against each other.
- **Fix runs:** after one `--fix` run, Oxlint left 122 problems and differed
  from ESLint's output by 320 lines. After runs two to five: 15, 0, 0 and 0
  problems, and 32, 14, 2 and 0 differing lines. ESLint's leftovers were parse
  errors in files the scrambler broke, which Oxlint reported too.
- **Custom rules:** a local package, `@mvtjs/eslint-plugin-repo`, with
  `no-em-dash` (comments, string literals and template literals, with a fix)
  and `no-null`, loaded by package name in both tools. A third rule,
  `no-this`, written as a `.ts` file, loaded by path on Node 24.21.

## Sources

- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces), [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm staged publishing (GitHub Changelog)](https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/)
- [npm token timeline](https://github.com/orgs/community/discussions/178140)
- [npm package moniker rules](https://blog.npmjs.org/post/168978377570/new-package-moniker-rules.html)
- ["Too similar" rule undocumented](https://github.com/orgs/community/discussions/205030)
- [pnpm blog](https://pnpm.io/blog), [pnpm 11.11-11.14](https://pnpm.io/blog/releases/11.11-11.14), [pnpm 12.0](https://pnpm.io/blog/releases/12.0), [pnpm 12.4](https://pnpm.io/blog/releases/12.4), [pnpm catalogs](https://pnpm.io/catalogs)
- [Vite 8.0](https://vite.dev/blog/announcing-vite8)
- [Vite+ repo](https://github.com/voidzero-dev/vite-plus), [Vite+ install guide](https://viteplus.dev/guide/install) (package manager detection), [Vite+ monorepo guide](https://viteplus.dev/guide/monorepo), [Vite+ run guide](https://viteplus.dev/guide/run), [Vite+ lint guide](https://viteplus.dev/guide/lint), [Vite+ beta (InfoQ)](https://www.infoq.com/news/2026/08/vite-plus-beta/), [Announcing Vite+ 1.0](https://voidzero.dev/posts/announcing-vite-plus-1-0), [Vite+ releases](https://github.com/voidzero-dev/vite-plus/releases)
- [VoidZero is joining Cloudflare](https://voidzero.dev/posts/voidzero-cloudflare)
- [Oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins), [Oxlint JS plugins alpha](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html)
- [TypeScript 7 GA (InfoQ)](https://www.infoq.com/news/2026/08/typescript-7-released/)
- [Turborepo 2.11](https://turborepo.dev/blog/2-11), [Nx 23](https://nx.dev/blog/nx-23-release), [moon v2 (InfoQ)](https://www.infoq.com/news/2026/05/moonrepo-2-release/), [Yarn 6](https://v6.yarnpkg.com/concepts/yarn-6.html)
- [Changesets releases](https://github.com/changesets/changesets/releases)
- [tsdown](https://tsdown.dev/guide/), [tsdown package validation](https://tsdown.dev/options/lint)
- [Live types in a TypeScript monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo)
