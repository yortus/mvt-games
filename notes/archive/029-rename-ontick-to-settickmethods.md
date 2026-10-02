# Rename `onTick` to `setTickMethods`

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-02 |
| Updated  | 2026-10-02 |

## Description

Rename the tick API's per-node function, `onTick(node, { update, refresh })`,
to `setTickMethods(node, { update, refresh })`. Do it after task
[028](028-tick-api-migration.md), which introduces `onTick` and
migrates the repo to it. Another session was working on 028 when this was
decided, so it was kept out of 028 to avoid rewriting a moving target.

The behaviour doesn't change, only the name:
- a member left out is left as it is;
- a member given as `undefined` is cleared;
- a member that declares a parameter for the method it replaces wraps it.

**Why rename.** `onTick` reads as "subscribe to the ticker", the pattern
pixi-solid's `onTick` is criticised for (a hidden, concrete clock that the
component closes over). This function does the opposite: it attaches steps
that run only when a caller ticks an ancestor with an explicit `deltaMs`.
Its "on" also suggests adding a listener, where a call replaces, and it
stretches this repo's convention that `on…` names a relay binding or an event
handler. `setTickMethods` says what happens, uses MVT's word ("methods"), and
matches the internal `TickMethods` type.

The candidates and the reasoning are in
[027 section 12.4](027-mvt-method-names.md). `whenTicked` was
the runner-up, rejected because its event flavour invites people to expect
calls to add up.

## Acceptance Criteria

- [x] **Decide first:** should `setTickMethods` return the node, so a view's
  last line can be `return setTickMethods(view, { refresh })`? 027 section
  12.4 leaves this open. **Decided: no.** It returns `void`, as `onTick`
  did.
- [x] The function is renamed in `src/mvt-utils/scene-passes.ts`, in
  `ScenePasses<N>`, in each renderer's mixin and barrel (`pixi-mvt`,
  `three-mvt`, `html-mvt`), and in the tests.
- [x] Every call site 028 created uses the new name: games, demos, common
  views, the cabinet, the playground's presets and its sandbox's exposed
  names, and the benchmarks.
- [x] Every doc 028 wrote or updated uses the new name: AGENTS.md, the
  architecture and game-loop pages, the glossary, the style guide, the skills,
  `llms.txt`, and the pixi-mvt README and design notes.
- [x] The docs say plainly that it registers steps for `tickScene` to call,
  and doesn't subscribe to a clock.
- [x] `grep -rn "onTick" src docs benchmarks` finds no references to the old
  function. The JSX attributes (`onUpdate`, `onRefresh`, `onDestroyed`) are
  unaffected.
- [x] Type-check, lint and tests pass.

## Progress Log

- **2026-10-02** Created from the session that designed the tick API.
- **2026-10-02** Done, before 028's phases 1-4 were committed, so they land
  with the new name. A whole-word rename across `src/`, `benchmarks/` and
  `scripts/` (63 files), then comments rewrapped and import lists re-sorted.
  `setTickMethods` returns `void`. Its doc comment now says it registers
  steps for `tickScene` to call, does not subscribe to a clock, and replaces
  rather than adds. No docs under `docs/` used the name yet: 028's phase 6
  will write them with the new one. 028's task file now uses the new name
  too. Both type-checks pass, lint is clean, and 1176 tests pass.
