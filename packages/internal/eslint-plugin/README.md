# @mvtjs/eslint-plugin

This repo's ESLint rules, in the plain ESLint v9 plugin format, so they also
load in Oxlint as a JS plugin. It's private, and isn't published: its
`architecture` rules are too few to be worth publishing on their own, and the
rest are this repo's own conventions.

| Rule | Preset | Reports |
| --- | --- | --- |
| `@mvtjs/no-wall-clock` | `architecture` | Timers (`setTimeout`, `setInterval`, `requestAnimationFrame`), clock reads (`Date.now()`, `new Date()`, `performance.now()`) and GSAP tweens made without `paused: true`. Apply it to model files |
| `@mvtjs/no-module-state` | `architecture` | `let` and `var` at module level, exported or not. Every model the file makes would share that state, in every game played on the same page. Apply it to model files |
| `@mvtjs/no-control-names` | `architecture` | Members of interfaces and type literals named for a control or a gesture: `restartPressed`, `cellTapped`, `swipeCount`, `pressPlay`. A model takes what the player means, so name held state for what it does (`isThrusting`), and make a one-off command an action (`startNewRun()`). Apply it to model files |
| `@mvtjs/no-em-dash` | `style` | Em-dashes in comments, strings, template literals and JSX text. Auto-fixes each to a hyphen |
| `@mvtjs/no-null` | `style` | `null` that our own code or APIs introduce: as a value, or in a type outside a function body. Comparisons and local types, which handle third-party values, are allowed |
| `@mvtjs/no-this` | `style` | `this` |
| `@mvtjs/no-deep-imports` | none | Imports that reach past a folder's `index.ts` (`../models/ship-model`), or into a package that has no `exports` field (`lz-string/libs/lz-string.js`). A package's `exports` field is left to TypeScript, which already refuses paths it doesn't list. The `allowIndexFile` option allows a folder's index file by its full name (`./scripts/index.ts`), for files that Node loads itself |
| `@mvtjs/no-unused-watch` | none | A watcher made with `watch` from `@mvtjs/utils` whose `poll()` is never called, a reaction made with `createReaction` that's never called or passed on, and either one made and thrown away. Each fails silently |
| `@mvtjs/no-inline-watch` | none | A `watch`, `createReaction` or `createComputed` made and used in one expression, such as `watch(x).poll()`. It's made again each time it runs, so it never sees a change, or never caches |
| `@mvtjs/no-repeated-poll` | none | A watcher polled twice in one function body. The second poll always reports that nothing changed |
| `@mvtjs/no-conditional-poll` | none | A poll, or a call of a reaction made in the file, inside an `if`, a `switch`, a ternary, `&&`, `\|\|` or `??`, or after an early `return` in its function. Skipped on some steps, it compares with an older read and can miss a change. A gap someone intends takes an `eslint-disable` comment saying why |
| `@mvtjs/no-relative-imports-into-src` | none | Relative imports into a package's `src/` folder from a file outside it, such as `'../src/highscores'` from a worker or a script beside `src/`. Import by the package's name, or through an `imports` mapping in its `package.json` (`#highscores`) |

The repo's `eslint.config.ts` applies `style` to all code and `architecture`
to model files, and exempts the few files that need `this`. It applies
`no-deep-imports` to each package's code, scripts and config files, and
`no-relative-imports-into-src` to every file in a package. It applies the four
watch rules to all TypeScript, except that a test may poll a watcher more than
once, and between checks, since one test stands in for several steps.

## Working on the rules

The repo's `eslint.config.ts` imports the plugin from its source, `src/`, as
`#eslint-plugin`, which the root `package.json` maps in its `imports`. ESLint
loads a TypeScript config through jiti, which compiles the config and what it
imports as it loads them, so nothing needs building first, and
`npm run lint` always runs the current rules. An editor's ESLint server keeps
the config it loaded: after editing a rule, restart the server to lint with
the change. It has no build, since nothing loads it but the repo's own
tools.

Each rule has a test beside it, run with ESLint's `RuleTester` under Vitest
(`npm test`).
