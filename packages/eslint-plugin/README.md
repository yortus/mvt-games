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

The repo's `eslint.config.js` applies `style` to all code and `architecture`
to model files, and exempts the few files that need `this`.

## Working on the rules

ESLint loads the plugin through Node, by its package name, which resolves to
the built `dist/`. The root's `prepare` and `prelint` scripts build it, so
`npm run lint` always runs the current rules. After editing a rule, rebuild
it (`npm run build:lint-plugin`) before linting from the editor.

Each rule has a test beside it, run with ESLint's `RuleTester` under Vitest
(`npm test`).
