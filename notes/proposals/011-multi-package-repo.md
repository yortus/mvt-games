# Proposal: multi-package repo

> The repo has outgrown a single package. This proposal splits the reusable
> code into libraries published under the `@mvtjs` npm scope, keeps the games,
> demos and playground together as one private `site` package, and cuts the
> top level from 21 visible entries to about a dozen. It records the research
> behind the tooling choices (the state of multi-package tooling in September
> 2026), the results of a hands-on lint trial that decides whether Vite+ can
> enforce this repo's own formatting, and a phased migration plan.

**Status:** proposed. The npm scopes and GitHub org in section 3 are
registered. The top-level tidy-up was done separately on 2026-09-26, without
the package split (section 7, "Done already"). Nothing else is implemented.

**Written:** 2026-09-25.

**Related:** [`AGENTS.md`](../../AGENTS.md) (project structure, commands),
[`docs/reference/project-structure.md`](../../docs/reference/project-structure.md),
[`docs/reference/style-guide.md`](../../docs/reference/style-guide.md),
[`eslint.config.js`](../../eslint.config.js),
[`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml),
[the `Watch()` builder spike](./008-watch-builder-spike.md) (its prototype moves with `src/common/`).

---

## 1. Summary

Decisions this proposal makes, and where each is argued:

| Decision | Section |
| --- | --- |
| Publish under `@mvtjs`. Hold `@mvt.js` unused. No unscoped package for now | 3 |
| One pnpm workspace: `packages/*` (published) plus private `site` and `docs` | 5, 6, 7 |
| First two libraries: `@mvtjs/utils` (no dependencies) and `@mvtjs/pixi` (plugin, JSX runtime, Pixi helpers) | 5 |
| Later libraries: `@mvtjs/html`, `@mvtjs/three`, `@mvtjs/pixi-widgets`, `@mvtjs/eslint-plugin` | 5.5, 10 |
| Libraries consumed from source inside the repo; built only for publishing | 5.3 |
| All libraries share one version, starting at `0.1.0` | 5.4 |
| `@mvtjs/pixi` does not re-export the dependency-free library | 5.2 |
| Games, demos, playground and cabinet stay together as one private `site` package, with the site-specific input views | 5.2, 6 |
| Planning material moves under `notes/` | 6.3 |
| Formatting stays this repo's own (`@stylistic` plus custom rules), enforced and auto-fixed. No Prettier-style formatter | 8.4 |
| pnpm 11, Changesets (no release PRs), tsdown, publint/attw, npm trusted publishing | 8 |
| Vite+ gets a time-boxed trial with go/no-go criteria. The lint side is already shown to work | 9 |
| The repo stays at `yortus/mvt-games` for now. The site moves to `yortus.com/mvt-games/` | 13.2, 13.3 |
| Fix the barrel-rule crash (section 11.1) as part of the restructure | 11 |

**What this proposal asks for** is the migration in section 12: eight phases (0 to 7),
each leaving `lint`, `test` and `build` green.

---

## 2. Motivation

**The reusable code is worth publishing, and nothing marks it as reusable.**
`src/pixi-mvt/`, `src/pixi-jsx/` and half of `src/common/` are libraries in all
but packaging. Their boundaries are held up by convention: import-map aliases
(`#common`, `#pixi-jsx`), relative imports such as `'../../pixi-mvt'` (22 files),
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

- **The package manager owns the workspace.** Linking, one root lockfile and
  `workspace:` ranges are standard. Lerna 9 removed `bootstrap` and `add`.
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
  tsdown, Oxlint and Oxfmt, with a cached task runner. It reached
  `1.0.0-rc.0` on 2026-09-22. Cloudflare acquired VoidZero in June 2026 and
  committed to keeping the tools MIT and vendor-neutral. Section 9 evaluates it.
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
| Package manager | pnpm 11 (12 stable) | npm workspaces (no `workspace:` ranges or catalogs); Bun (has catalogs); Yarn 6 (preview); nub/aube (launched June 2026) | |
| Task running | `pnpm -r` / `--filter`, no cache | `pnpm pipeline` (weeks old); Vite+ `vp run` | Turborepo 2.11; Nx 23; moon v2 |
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
| `src/common/watch.ts` | |
| `src/common/sequence.ts`, `sequence-reaction.ts` | |
| `src/common/boolean-tween.ts`, `edge-tween.ts` | |
| `src/common/slot-list/` | |
| `src/common/type-utils.ts` | |
| `src/common/watch-builder.spike.ts` and its test | Moves with `watch`, still unexported, per [008](./008-watch-builder-spike.md) |
| Reactivity benchmarks (`benchmarks/*.bench.ts`, `scripts/bench-reactivity*.ts`) | To `packages/utils/bench/`. `solid-js` becomes a dev dependency of `@mvtjs/utils` |

### 5.2 `@mvtjs/pixi`

`pixi.js` is a **peer** dependency. It depends on `@mvtjs/utils`.

| From | Notes |
| --- | --- |
| `src/pixi-mvt/` | Mixin, `updateScene`, `refreshScene`, `SKIP_DESCENDANTS` |
| `src/pixi-jsx/` | JSX runtime, `<List>`, `<Switch>` |
| `src/common/texture-registry.ts` | Generic Pixi helper, used by six games |
| `src/pixi-mvt/scene-passes-benchmark.ts`, `scripts/bench-scene-passes.ts` | To `packages/pixi/bench/`. The benchmark stays outside the public API |

Exports: `.`, `./jsx-runtime` and `./jsx-dev-runtime`. JSX files then declare
`/** @jsxImportSource @mvtjs/pixi */` in place of today's `#pixi-jsx`.

**Staying in the site, not the library:** `keyboard-input-view`,
`touch-input-view` and `pause-menu-view` (used only by `src/main.ts`),
`overlay-view` (the games' shared overlay), and `is-touch-device` (DOM only).
They move to `site/src/shared/`. The input views in particular are shaped
around this site's cabinet and games, and are not general enough to publish.

**`@mvtjs/pixi` does not re-export `@mvtjs/utils`.** Each name is imported from
the package that defines it. A re-export would give Pixi users one import
source, at the cost of two valid ways to import the same name, and the question
repeating for every later renderer package.

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
        "./jsx-runtime": {
            "@mvtjs/source": "./src/jsx-runtime.ts",
            "types": "./dist/jsx-runtime.d.ts",
            "default": "./dist/jsx-runtime.js"
        }
    },
    "files": ["dist"],
    "dependencies": { "@mvtjs/utils": "workspace:^" },
    "peerDependencies": { "pixi.js": "catalog:" }
}
```

- `tsconfig.base.json` sets `customConditions: ["@mvtjs/source"]`, and the
  site's Vite config and the root Vitest config add the same condition to
  `resolve.conditions`. The site, the docs and the tests then run the libraries
  from source: no build step, no watch mode, live types.
- The condition is namespaced so it cannot collide with another package's
  conditions.
- The published `exports` drop the source condition, through pnpm's
  `publishConfig.exports` override.
- The lint barrel rule becomes redundant between packages: `exports` enforces
  it. It is still needed inside each package.

### 5.4 Versioning

All libraries share one version, starting at `0.1.0` (with Changesets, a
`fixed` group). They depend on each other and are young, so separate version lines
would mostly produce compatibility questions. Revisit at 1.0.

### 5.5 Later packages

| Package | Contents |
| --- | --- |
| `@mvtjs/html` | DOM renderer: JSX runtime and widgets |
| `@mvtjs/three` | three.js renderer |
| `@mvtjs/pixi-widgets` | Reusable Pixi views |
| `@mvtjs/eslint-plugin` | MVT architecture rules (section 10) |

**Known points of generalisation, not to be acted on yet.** `list.ts` and
`switch.ts` depend on Pixi's `Container` and `refreshScene`, but their logic
(index-addressed slots, matching on a key) is not Pixi-specific. The `onUpdate`/`onRefresh` tree walk is the same
idea on any scene graph. When a second renderer arrives, these are the parts
that may move into `@mvtjs/utils` behind a small host interface. Abstracting them before
then would be guessing.

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
    utils/            @mvtjs/utils   src/, bench/
    pixi/             @mvtjs/pixi    src/, bench/
site/                 private package
    src/              cabinet/, games/, demos/, playground/, shared/, main.ts
    public/
    scripts/          texture generation, spritesheet plugin
    index.html, games/, demos/, playground/  (HTML entry points)
    vite.config.ts
.editorconfig  .gitignore  AGENTS.md  README.md
package.json  pnpm-workspace.yaml  pnpm-lock.yaml  tsconfig.base.json
eslint.config.js      (root vite.config.ts instead, under Vite+)
```

Where each current top-level entry goes:

| Now | Goes to |
| --- | --- |
| `site/nav.css` | `site/src/shared/nav.css` |
| `vite.config.ts` | `site/` |
| `src/main.ts`, `cabinet/`, `games/`, `demos/`, `playground/` | `site/src/` |
| `src/common/` | Split per sections 5.1, 5.2 |
| `src/pixi-mvt/`, `src/pixi-jsx/` | `packages/pixi/src/` |
| `scripts/generate-*.ts`, `vite-plugin-spritesheet.ts` | `site/scripts/` |
| `scripts/bench-*.ts`, `benchmarks/` | `packages/*/bench/` |
| `dist/` (build output) | `site/dist/`, still ignored |
| `package-lock.json` | Replaced by `pnpm-lock.yaml` |
| `tsconfig.json` | `tsconfig.base.json` plus one `tsconfig.json` per package |

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
| Node | 24 LTS, pinned in `.node-version` and CI | Vite+ needs 22.18+ or 24.11+, trusted publishing needs 22.14+, and TypeScript-written lint rules need Node's type stripping (section 9.2). Local is 22.11 today |
| Package manager | pnpm 11 (11.1.3 or later), pinned | `workspace:` ranges, catalogs, and trusted publishing without the npm CLI. Why not 12 yet: section 13.2 |
| Shared versions | pnpm catalogs (`pixi.js`, `typescript`, `vitest`, ...) | One place to bump |
| Task running | Plain `pnpm -r` / `--filter` scripts | Source-first consumption removes most build ordering. Add caching only when something is slow |
| Library build | tsdown, with `isolatedDeclarations` | Current standard. Produces `exports` and `.d.ts` |
| Package checks | publint and attw on every build | Catches broken `exports` before publishing |
| Tests | One root Vitest config using `projects` | One command, per-package environments |
| Versioning | Changesets, all libraries in one `fixed` group, used without release PRs (section 8.5) | Mature. One command bumps every version and writes the changelogs. Why not pnpm's native commands: section 13.2 |
| Publishing | GitHub Actions with npm trusted publishing and provenance | No stored tokens. Consider staged publishing once there are users |

### 8.2 Not chosen

- **npm workspaces:** no `workspace:` ranges and no catalogs.
- **Turborepo, Nx, moon:** caching and orchestration this repo does not need
  at two libraries and a site. Turborepo is the fallback if builds become slow.
- **`pnpm pipeline`:** attractive, but weeks old. Revisit after a few
  releases, or if caching is needed before then.
- **pnpm 12 and pnpm's native release commands:** see section 13.2.
- **The Changesets GitHub Action and bot:** they exist to manage release PRs,
  which this repo does not use (section 8.5).

### 8.3 CI

`deploy.yml` changes from `npm ci` on Node 22 to pnpm on Node 24. It
otherwise does the same job: lint, test, build the site, build the docs, deploy
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

**Day to day, nothing changes.** Optionally, run `pnpm changeset` when a
change deserves a changelog line while it is fresh. It asks for the bump size
and one line of summary, and writes a small `.changeset/*.md` file to commit
with the change. Skipping this is fine; the summary can be written at release
time instead.

**To release:**

1. `pnpm changeset`, if no change files are waiting: pick the bump, write the
   summary.
2. `pnpm changeset version`: bumps every library to the same new version,
   updates the dependency ranges between them, writes each package's
   `CHANGELOG.md`, and deletes the used change files.
3. Commit and push to `main`.

**CI does the rest.** `release.yml` runs on every push to `main`: install,
lint, test, build, then `pnpm changeset publish`. That publishes only versions
not yet on npm, so on an ordinary push it does nothing. When a version is new,
it publishes each library through `pnpm publish` (which rewrites `workspace:`
and `catalog:` ranges to real versions), authenticated by trusted publishing
with provenance, then pushes the `@mvtjs/<name>@<version>` git tags it
created (`git push --follow-tags`, so the job needs `contents: write`).

A `pnpm release` script can wrap steps 2 and 3. The whole release is then
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
pnpm keeps running underneath, so the workspace layout in section 7 is the
same with or without it.

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
- It is young: about 1,300 public repos used it in August 2026, so there are
  fewer answers when something breaks.
- Oxlint's JS plugin support, which this repo's formatting depends on (9.2),
  is alpha.

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

**Caveats found:**

- Oxlint needs repeated `--fix` runs to converge on heavily damaged files. For
  everyday edits one run is enough; a bulk reformat needs a loop that re-runs
  until the tree is clean.
- JS plugins cannot use type information. Only Oxlint's built-in rules are
  type-aware.
- Under pnpm's strict layout, a package holding lint rules must declare its
  own dependencies.

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
6. `vp run` caching works across the packages, and `vp pack` output passes
   publint and attw.
7. The VitePress docs still build and deploy.

If any fails, the repo stays on ESLint, pnpm scripts and tsdown. Nothing else
in the plan changes.

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
Node 24; the published package is built to JavaScript.

---

## 11. Issues to fix during the restructure

### 11.1 The barrel rule crashes on its first violation

**Must be fixed as part of phase 1** (section 12.2). `import/no-internal-modules`
in `eslint.config.js` crashes ESLint the first time any file actually reaches
past a barrel:

```
TypeError: re.test is not a function
Rule: "import/no-internal-modules"
```

The rule compiles each `allow` entry with minimatch 3, which treats a leading
`#` as a comment. `'#common'` and `'#pixi-jsx'` therefore compile to `false`
instead of a regular expression, and the rule calls `.test()` on it. `npm run
lint` passes today only because nothing violates the rule.

Reproduced on 2026-09-25 by piping a file with
`import { refreshScene } from '../pixi-mvt/scene-passes';` into the repo's
ESLint with `--stdin --stdin-filename src/zz-violations/bad.ts`.

**Fix:** escape the entries (`'\\#common'`, `'\\#pixi-jsx'`), or drop them
when the aliases are replaced by package names. **Either way, the phase is
not done until a deliberate violation is shown to be reported, not crashed
on.** The same check applies to whatever allow list the rule ends up with in
each package, and under Oxlint if Vite+ is adopted.

### 11.2 Node version

Local Node is 22.11 and CI uses 22. The toolchain needs 24 (section 8.1).
Upgrade in phase 0.

---

## 12. Migration plan

Each phase is one PR that leaves `lint`, `test`, `build` and the Pages deploy
working. Moves use `git mv` so history follows the files.

### 12.1 Phase 0: prerequisites

- Node 24 LTS locally and in CI; add `.node-version`.
- Switch npm to pnpm with the repo still a single package (`pnpm import`
  converts `package-lock.json`). Pin the pnpm version.
- Update `deploy.yml` for pnpm.

### 12.2 Phase 1: extract the libraries

- Add `pnpm-workspace.yaml`, `tsconfig.base.json` and catalogs.
- Create `packages/utils` and `packages/pixi` from the files in sections 5.1
  and 5.2, with their tests and benchmarks.
- The root package (still the app) depends on both through `workspace:^`.
  Replace `#common` and `#pixi-jsx` imports and relative `pixi-mvt` imports
  with `@mvtjs/utils` and `@mvtjs/pixi`, and the three `@jsxImportSource
  #pixi-jsx` pragmas with `@mvtjs/pixi`.
- Wire the `@mvtjs/source` condition into TypeScript, Vite and Vitest.
- Rework the barrel rule for the new layout and **fix section 11.1**,
  verified with a deliberate violation.

### 12.3 Phase 2: move the app into `site/`

- Everything listed for `site/` in section 7.
- The site's own `package.json` takes the app's dependencies (`gsap`,
  CodeMirror, `sucrase`, `lz-string`) and its scripts.

### 12.4 Phase 3: docs package and top-level cleanup

- `docs/` gets its own `package.json` (VitePress, the Mermaid plugin).
  Keep the combined Pages output (site at the root, docs under `/docs`).
- ~~Create `notes/`; move `CLAUDE.md` into `.claude/` and `llms.txt` to where
  it is served.~~ Done (section 7).

### 12.5 Phase 4: references

Update every path that moved. A grep for
`src/(common|pixi-mvt|pixi-jsx|games|demos|playground|cabinet)` finds them in
`AGENTS.md`, `README.md`, `docs/public/llms.txt`, seven `docs/` files
(including the AI-agent skills), two task files and four scripts. Also update
`AGENTS.md`'s project structure and commands table, and
`docs/reference/project-structure.md`. Archived notes are historical and keep
their old paths; `notes/README.md` gets one line saying so.

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
| Should `@mvtjs/pixi` re-export `@mvtjs/utils`? | No (section 5.2) |
| Where the input views go | They stay in `site/src/shared/`; they are not general enough to publish (section 5.2) |
| pnpm 11 or 12? | pnpm 11. Move to 12 when npm's `latest` tag does, or earlier if a 12-only feature is wanted |
| Changesets or pnpm's native release commands? | Changesets, without release PRs (section 8.5) |
| Name of the dependency-free library | `utils` (section 5.1) |

The trade-offs behind the repo's home and the last three decisions are kept
below, so they can be revisited with the same information.

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

**pnpm 11 or 12.** Low stakes: both use the same commands, settings and
lockfile format, so switching later is a version bump and one install.

| | pnpm 11 | pnpm 12 |
| --- | --- | --- |
| Maturity | npm's `latest` tag; years of use | Stable since 2026-08-26; a complete Rust rewrite, one month old |
| Speed | Baseline | Up to 90% faster installs reported on large monorepos. At this repo's size (about 30 direct dependencies), seconds at most |
| Features | New features still land on both lines for now (11.26 and 12.2-12.3 shipped the same catalog work) | Some land here first (`pnpm pipeline` in 12.4). Eventually 11 becomes maintenance-only |
| Risk | Low | Edge-case bugs in a new implementation. Windows (this repo's development platform) got shared build artifacts only in 12.1. Tools that drive pnpm (Vite+, CI setup actions) have had less time to test against it |

**Changesets or pnpm native.** Both read and write the same
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
`three`) without sounding like a rival target, and survive the package growing
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

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm staged publishing (GitHub Changelog)](https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/)
- [npm token timeline](https://github.com/orgs/community/discussions/178140)
- [npm package moniker rules](https://blog.npmjs.org/post/168978377570/new-package-moniker-rules.html)
- ["Too similar" rule undocumented](https://github.com/orgs/community/discussions/205030)
- [pnpm blog](https://pnpm.io/blog), [pnpm 11.11-11.14](https://pnpm.io/blog/releases/11.11-11.14), [pnpm 12.0](https://pnpm.io/blog/releases/12.0), [pnpm 12.4](https://pnpm.io/blog/releases/12.4), [pnpm catalogs](https://pnpm.io/catalogs)
- [Vite 8.0](https://vite.dev/blog/announcing-vite8)
- [Vite+ repo](https://github.com/voidzero-dev/vite-plus), [Vite+ monorepo guide](https://viteplus.dev/guide/monorepo), [Vite+ run guide](https://viteplus.dev/guide/run), [Vite+ lint guide](https://viteplus.dev/guide/lint), [Vite+ beta (InfoQ)](https://www.infoq.com/news/2026/08/vite-plus-beta/)
- [VoidZero is joining Cloudflare](https://voidzero.dev/posts/voidzero-cloudflare)
- [Oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins), [Oxlint JS plugins alpha](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html)
- [TypeScript 7 GA (InfoQ)](https://www.infoq.com/news/2026/08/typescript-7-released/)
- [Turborepo 2.11](https://turborepo.dev/blog/2-11), [Nx 23](https://nx.dev/blog/nx-23-release), [moon v2 (InfoQ)](https://www.infoq.com/news/2026/05/moonrepo-2-release/), [Yarn 6](https://v6.yarnpkg.com/concepts/yarn-6.html)
- [Changesets releases](https://github.com/changesets/changesets/releases)
- [tsdown](https://tsdown.dev/guide/), [tsdown package validation](https://tsdown.dev/options/lint)
- [Live types in a TypeScript monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo)
