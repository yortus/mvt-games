# @mvtjs/eslint-plugin

This repo's ESLint rules, in the plain ESLint v9 plugin format, so they also
load in Oxlint as a JS plugin. Private for now: the `architecture` rules are
meant to be published once there are enough of them to be useful to others.

| Rule | Preset | Reports |
| --- | --- | --- |
| `@mvtjs/no-wall-clock` | `architecture` | Timers (`setTimeout`, `setInterval`, `requestAnimationFrame`), clock reads (`Date.now()`, `new Date()`, `performance.now()`) and GSAP tweens made without `paused: true`. Apply it to model files |
| `@mvtjs/no-module-state` | `architecture` | `let` and `var` at module level, exported or not. Every model the file makes would share that state, in every game played on the same page. Apply it to model files |
| `@mvtjs/no-em-dash` | `style` | Em-dashes in comments, strings, template literals and JSX text. Auto-fixes each to a hyphen |
| `@mvtjs/no-null` | `style` | `null` that our own code or APIs introduce: as a value, or in a type outside a function body. Comparisons and local types, which handle third-party values, are allowed |
| `@mvtjs/no-this` | `style` | `this` |
| `@mvtjs/no-deep-imports` | none | Imports that reach past a folder's `index.ts` (`../models/ship-model`), or into a package that has no `exports` field (`lz-string/libs/lz-string.js`). A package's `exports` field is left to TypeScript, which already refuses paths it doesn't list. The `allowIndexFile` option allows a folder's index file by its full name (`./scripts/index.ts`), for files that Node loads itself |

The repo's `eslint.config.ts` applies `style` to all code and `architecture`
to model files, and exempts the few files that need `this`. It applies
`no-deep-imports` to each package's code, scripts and config files.

## Working on the rules

The repo's `eslint.config.ts` imports the plugin from its source, `src/`, as
`#eslint-plugin`, which the root `package.json` maps in its `imports`. ESLint
loads a TypeScript config through jiti, which compiles the config and what it
imports as it loads them, so nothing needs building first, and
`npm run lint` always runs the current rules. An editor's ESLint server keeps
the config it loaded: after editing a rule, restart the server to lint with
the change. The package's `build` makes `dist/`, for publishing.

Each rule has a test beside it, run with ESLint's `RuleTester` under Vitest
(`npm test`).
