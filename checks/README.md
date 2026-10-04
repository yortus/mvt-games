# Checks

> Tests of properties this repo has chosen to keep, such as how its packages
> fit together, rather than of what any one piece of code does. They run with
> the other tests, and fail when the repo's structure drifts from what was
> decided.

**Related:** [Project Structure](../packages/docs/reference/project-structure.md)

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
| A property of the repo's layout or manifests that lint cannot express | A rule about how a single file is written: lint (`eslint.config.js`) |

A check needs this package because it reaches across the others: this
package depends on each package it checks, and nothing depends on it.

## The checks

| File | Keeps |
| --- | --- |
| [renderer-tick-api.test.ts](./renderer-tick-api.test.ts) | Every renderer package re-exports the same tick API names from `@mvtjs/utils`, as the base's own values |
| [scripts/published-view-types.ts](./scripts/published-view-types.ts) | Every entry point a renderer package publishes brings the renderer's view type into `View`, in its built declaration files. Checks `dist/`, so `npm run build:packages` runs it after building, rather than `npm test` |

## Adding a check

1. Add a `*.test.ts` file here, named for the property it keeps.
2. Start it with a comment saying what the property is and why the repo keeps
   it, without citing planning notes.
3. Add any package it imports to this package's `devDependencies`.
4. Add a row to the table above.

`npm test` at the repo root runs the checks with every other test.
