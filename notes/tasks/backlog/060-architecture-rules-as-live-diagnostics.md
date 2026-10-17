# Playground: The Architecture's Rules as Live Diagnostics

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

Several of the repo's lint rules are MVT's rules: no wall-clock time in
models (`@mvtjs/no-wall-clock`), no module-level state
(`@mvtjs/no-module-state`), no `this`, and no `null`. ESLint runs in a
browser, and `@mvtjs/eslint-plugin` is plain code. Run in the playground's
language service worker, these rules would underline a `setTimeout` in a
model as it's typed, with a link to the docs page that explains why. That's
the docs' advice, delivered where it's needed. This was 052's idea 10.3.

The playground already checks one rule of its own: while barrels are kept,
an import that reaches past a folder's `index.ts` is an error, with a fix.
That check is written in the language service, not taken from ESLint.

### Things to decide

- **Which rules.** Some assume a repo, such as `no-deep-imports` and the
  dependency rules, and the barrel rule is already covered.
- **How big ESLint is in the worker,** and whether it loads only when a
  project first needs it, as the type bundles do.
- **How a diagnostic links to the docs,** and whether the docs pages need
  anchors for each rule.
- **Whether it can be switched off,** as barrels can.

## Acceptance Criteria

- [ ] The chosen rules show as problems in the editor and the Problems
      list, as the code is typed, each with a link to its docs.
- [ ] The cost of loading them is measured, and agreed with the owner.
- [ ] Help mentions them.
- [ ] Lint, type checks and tests pass.

## Progress Log

### 2026-10-17

Created from 052's section 10.3, when 052 was archived.
