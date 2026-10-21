# Models Take Their Random Source

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-15 |
| Updated  | 2026-10-21 |

## Description

A model must not reach for the global random source: it takes one as an
option, or a seed to make one, as the falling sand demo and Neon Monsoon
already do. This is the Dependency Inversion principle applied to random
numbers ([070](../../archive/070-principles-docs.md)'s DIP page,
"Time is a dependency too"). With a seeded source, recorded input and the
same time steps, a game replays exactly, and a test can fix the dice.

Found while drafting the DIP page. Model files that call `Math.random()`,
as of 2026-10-19 (no model reads a clock), under
`packages/sites/arcade/src/entries/`:

- `astrovoid/models/debris-model.ts` (10 calls)
- `astrovoid/models/game-model.ts` (6)
- `burrow-bust/models/enemy-model.ts` (1, the patrol switch timer)
- `coral/models/coral-model.ts` (2)
- `deep-dive/models/game-model.ts` (2)
- `dojo-duel/models/ai-model.ts` (7)
- `double-pendulum/models/pendulum-model.ts` (2)
- `fireworks/models/fireworks-model.ts` (7)
- `fractal-forest/models/forest-model.ts` (11)
- `galaxy-raiders/models/game-model.ts` (2)
- `galaxy-raiders/models/enemy-model.ts` (1)
- `garden-snake/models/game-model.ts` (2)

Two more fall back to it: `kwazy-cactii/models/board-model.ts` takes an
optional `random` but defaults to `Math.random` (and its game model passes
none), and `boids/models/flock-model.ts` takes an optional `seed` but
defaults to a random one.

For each game, the top-level game model takes an optional `seed` (as Neon
Monsoon's does), makes one seeded source, and passes it to the child models
that need it. Child models take `random: () => number` as a required option,
with no `Math.random` default. Neon Monsoon's `createRandom` (xorshift32) or
the fruit machine's random source could be shared rather than copied; if so,
decide where it lives (`@mvtjs/utils`, or the Arcade's `#shared`).

Find them again by searching model files for `Math.random`. A lint rule
could keep them out: `@mvtjs/no-wall-clock` already reports timers and clock
reads (`Date.now()`, `performance.now()`) in model files, which is why none
are left; `Math.random()` could join it, or get a sibling rule.

## Acceptance Criteria

- [ ] No model calls `Math.random()`
- [ ] Each game's top-level model takes an optional seed, and passes one seeded source to its children
- [ ] Child models take `random` as a required option, with no default
- [ ] Where a shared seeded random source lives is decided
- [ ] A lint rule keeps `Math.random()` out of models, or the reason not to is recorded
- [ ] `npm run lint`, `npm run build` and `npm test` pass

## Progress Log

- 2026-10-15: Created while drafting the DIP principle page, in place of a
  note on the page that some games don't yet comply.
- 2026-10-21: Renumbered 073 (was 071) on reaching `vnext`, where 069 was
  taken.
