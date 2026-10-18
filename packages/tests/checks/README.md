# Checks

> Tests of properties this repo has chosen to keep, such as how its packages
> fit together, rather than of what any one piece of code does. They run with
> the other tests, and fail when the repo's structure drifts from what was
> decided.

**Related:** [Project Structure](../../sites/docs/reference/project-structure.md)

---

## What a check is

A unit test asks "does this code do the right thing?". A check asks "is the
repo still shaped the way we decided?". The answer can change without any one
package's behaviour changing: a renderer package stops re-exporting a name the
others still re-export, or a package's `exports` stop matching its source.
Each package's own tests would still pass.

Software architecture writing calls tests like these *fitness functions*
(from *Building Evolutionary Architectures*). This repo calls them checks.

## What belongs here

| Belongs here | Goes elsewhere |
| --- | --- |
| A property that spans packages, such as every renderer re-exporting the same names from `@mvtjs/utils` | A test of one package's behaviour: beside that package's code |
| A property of the repo's layout or manifests that lint cannot express | A rule about how a single file is written: lint (`eslint.config.ts`) |

A check needs this package because it reaches across the others: this
package depends on each package it checks, and nothing depends on it.

## The checks

| File | Keeps |
| --- | --- |
| [renderer-view-tick-api.test.ts](./renderer-view-tick-api.test.ts) | Every renderer package re-exports the same names from `@mvtjs/utils`, as the base's own values |
| [home-page-budget.test.ts](./home-page-budget.test.ts) | The site's home page, the Arcade, loads no renderer before its first paint (no Pixi, no three.js), and its JavaScript stays under a budget, gzipped (60 KB). It builds the Arcade in memory, as deployed, which takes a second or two, so it runs with the other tests and fails before a push. The deploy runs the same check, [scripts/home-page-budget.ts](./scripts/home-page-budget.ts), as `npm run build:arcade` builds. Alone: `npm run check:home-page-budget`. What it measures is in [scripts/home-page-load.ts](./scripts/home-page-load.ts) |
| [scripts/link-previews.ts](./scripts/link-previews.ts) | Every page of the built site, the Arcade's, each entry's, the playground's and the docs', has what a link preview needs: a title, a description, its full address, and a picture at least 1200 pixels wide and under 300 KB, the size its tags say. Each entry shows a picture of its own. Chat apps and social networks read these tags without running the page's scripts, and three builds write them, so nothing else would notice one going missing. Checks `dist/`, so `npm run build` runs it after building all three, and so do the deploys, with the site's origin. Alone, once built: `npm run check:link-previews` |
| [scripts/one-copy-of-utils.ts](./scripts/one-copy-of-utils.ts) | The built site holds one copy of `@mvtjs/utils`, in the Arcade's JavaScript and in the playground's. A second copy throws as the page loads, and a duplicate can appear in a build alone. Checks `dist/`, so `npm run build` runs it after building the two. Alone, once built: `npm run check:one-copy-of-utils` |
| [scripts/view-type-registration.ts](./scripts/view-type-registration.ts) | Every entry point a renderer package publishes brings the renderer's view type into `View`, in its built declaration files. Checks `dist/`, so `npm run build:packages` runs it after building, rather than `npm test`. Alone, once built: `npm run check:view-type-registration` |

## Adding a check

1. Add a `*.test.ts` file here, named for the property it keeps.
2. Start it with a comment saying what the property is and why the repo keeps
   it, without citing planning notes.
3. Add any package it imports to this package's `devDependencies`.
4. Add a row to the table above.

`npm test` at the repo root runs the checks with every other test.

A check that needs built output, as `view-type-registration` needs the
libraries' `dist/`, cannot run as a test. It is a script in `scripts/`,
with an npm script named `check:<name>` in this package's `package.json`,
and one of the same name at the repo root that runs it
(`npm run check:<name> -w @mvtjs/checks`). Whatever builds what it checks
runs it after building.
