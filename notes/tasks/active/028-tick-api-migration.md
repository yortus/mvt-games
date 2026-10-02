# Move to the Tick API (`tickScene` / `onTick`)

| Field    | Value      |
| -------- | ---------- |
| Priority | high       |
| Created  | 2026-10-02 |
| Updated  | 2026-10-02 |

## Description

Move the whole repo from the `onUpdate` / `onRefresh` properties and the
`updateScene` / `refreshScene` functions to the tick API, which settles
[proposal 027](../../proposals/027-mvt-method-names.md)'s question of how this
repo's scene methods should line up with MVT's `update` and `refresh`.

### The tick vocabulary

"Tick" is the umbrella term for one turn of the ticker's loop, and MVT's own
T:

| What gets ticked | What a tick does |
| --- | --- |
| a model | its `update(deltaMs)` |
| a view | its `update(deltaMs)`, if it has one, then its `refresh()` |
| a renderer's scene | the update scene pass over a subtree, then the refresh scene pass |
| the app (the Ticker) | ticks the models, then the scene; then the renderer draws |

### The API

Each renderer (`pixi-mvt`, `three-mvt`, `html-mvt`) exports these, typed to
its own node type, so passing anything else is a type error:

```ts
// What a view does on each tick. A member left out is left as it is; one
// given as `undefined` is cleared.
onTick(view, {
    update: (deltaMs) => { flash.update(deltaMs); },
    refresh: () => { view.alpha = flash.alpha; },
});

// A member that declares a parameter for the method it replaces wraps it:
onTick(slot, { refresh: (own) => (isPresent() ? own?.() : SKIP_DESCENDANTS) });
onTick(node, { update: (deltaMs, own) => own?.(deltaMs) });

// Ticking a scene: a whole tick, or one of its two scene passes
tickScene({ root: app.stage, deltaMs });         // update, then refresh
tickScene({ root, deltaMs, only: 'update' });
tickScene({ root, only: 'refresh' });            // takes no deltaMs

hasUpdate(node); hasRefresh(node);               // booleans; nothing hands out a method
```

How it works underneath, all already built (see "State at creation"):

- **Storage.** The methods live in the scene passes' private `_mvt*` fields on
  each node, with defaults on the renderer's prototype, including
  `_mvtInvalidators` (the invalidation climbs of that renderer's scene
  passes). Nothing public is added to any node.
- **Wrapping.** A method's declared `length` decides whether it wraps: one or
  more parameters for a refresh, two or more for an update. A default-valued
  or rest parameter doesn't count. A wrapper is bound to the method it
  replaces once, when it is set, and only if there is one; the scene-pass loop
  is unchanged. Setting a method afterwards, or clearing it, replaces the
  whole chain.
- **Arguments.** The refresh scene pass calls methods with `undefined`, not a
  placeholder `0`, so a refresh method's defaulted parameter sees its default.
- **`tickScene`'s options** are a discriminated union: leaving out `deltaMs`
  without `only: 'refresh'` is a type error, and so is giving `deltaMs` to a
  refresh alone. A literal options object per frame was measured at 0-0.3
  bytes per frame, because V8 removes it, so hosts can write it inline.

### How games tick (proven on Kwazy Cactii)

- **Sessions advance only their models.** `GameSession.update` does no view
  work.
- **The host ticks the stage once per frame**, after the models:
  `tickScene({ root: app.stage, deltaMs })`.
- **Pausing is the host's call.** The host's game container sits out the
  update scene pass while paused, with
  `onTick(gameContainer, { update: () => (paused ? SKIP_DESCENDANTS : undefined) })`.
  It is still refreshed, so the pause menu shows over the frozen game. No game
  knows about pause.

### Decisions (settled; do not reopen without new information)

- **The JSX attributes stay as they are:** `onUpdate={}`, `onRefresh={}`, and
  `onDestroyed={}`. The `onRefresh` attribute is a step that runs after the
  element's bindings and receives the element, not the element's refresh
  method.
- **Negative `deltaMs` is allowed**, for example speed control run backwards.
  The dev check only requires a finite number.
- **`tickScene` is opt-out**, with `only`, not opt-in
  (`{ update: deltaMs, refresh: true }`). The whole tick is the default and
  the point of the umbrella term. With opt-in, leaving out `refresh: true` or
  `update` type-checks and fails quietly; with opt-out, the only way to get a
  partial tick is to write `only`.
- **The per-node fields stay named `_mvt*` properties on the node.** One record
  object per node, a single `_mvt` record, symbol-keyed fields, and a
  `WeakMap` were each benchmarked, and each was slower or larger. 027 section
  11.8 has the numbers.
- **Wrapping is decided by declared parameters**, not by separate `wrap*`
  functions. Getters were removed: nothing hands out a node's method, which
  would be a way to call a view's step by hand.
- **`<List>` keeps detaching its tail slots when its length shrinks.** Hiding
  them instead was tried earlier and dropped, because hidden tail slots are
  still visited by every refresh scene pass.
- **The scene counter for the perfmon is in scope** (phase 5).

### State at creation (2026-10-02)

All of the following was uncommitted on branch `vnext-027` at `677e420`, partly
staged by the user for review. Phase 0 commits it.

- **Library, done and tested:**
  - `src/mvt-utils/scene-passes.ts` has `setUpdate` / `setRefresh` (untyped,
    with the wrapping rule), `onTick`, `hasUpdate` / `hasRefresh`, and the
    variant C storage.
  - `createScenePasses` returns `updateScene`, `refreshScene`, `invalidate`,
    `installMethods`, `setUpdate`, `setRefresh`, `tickScene` and `onTick`,
    typed to the node.
  - The renderer barrels export all of these.
  - `tickScene` and `onTick` still carry "EXPERIMENT (proposal 027)"
    markers.
- **Transitional layer, still in place:**
  - `installMethods` adds the `onUpdate` / `onRefresh` accessors as well as
    the field defaults. The accessors call the setters.
  - Each mixin declares them on its node type (`SceneNode`).
  - `assertNoShadowedMethods` guards them.
  - So unmigrated code keeps working.
- **Library code is name-free.** The JSX base, `<List>`, `<Switch>`,
  `DestroyRegistry` and the destroy wrappers use the setters, and all JSX tests
  pass with the accessors switched off.
- **Kwazy Cactii is converted:**
  - Its session updates only its model, with `isViewTickedByHost: true`, an
    experimental flag on `GameSession`.
  - Its views use `onTick`.
- **`src/main.ts` runs the experiment:**
  - `tickScene` once per frame.
  - The game container's update gate, which also skips games without the
    flag.
  - Thumbnails tick a flagged game's view.
- **The `games-and-demos` harness** special-cases flagged sessions.
- **Benchmark baselines** (`scene-passes`, `html-scene-passes`) keep their own
  references in a `baselineRefresh` property. `games-and-demos` counts methods
  with `hasUpdate` / `hasRefresh`.
- **Checks at creation:** both type-checks pass, lint is clean, and 1174 tests
  pass. Cactii and Pac-Man were checked in a real browser, including pause.

## Acceptance Criteria

### Phase 0: commit

- [ ] The state above is committed (the user stages and commits).

### Phase 1: finish the library API

- [ ] `tickScene` throws in dev builds unless `deltaMs` is a finite number.
  Negative values are allowed. Add tests. This is 027 section 7.6's check,
  minus its sign rule.
- [ ] The "EXPERIMENT" markers on `tickScene` and `onTick` are gone, and
  their doc comments read as the main API.
- [ ] Old exports stay in place until phase 4, so the build stays green.

### Phase 2: hosts and sessions

- [ ] Every session advances only its models:
  - game entries: `asteroids`, `digdug`, `galaga`, `ik`, `pacman`,
    `scramble` (cactii is done);
  - demo entries: `boids`, `falling-sand`, `reordering-lists`.
- [ ] Every host ticks its stage once per frame with `tickScene`:
  - `src/main.ts`;
  - `src/demos/main.ts`;
  - `src/demos/boids-3d/main.ts` (three.js, plus its HTML settings panel);
  - `src/playground/sandbox/sandbox-runner.ts`.
- [ ] Pause works as a gate on each host's game or demo container. The gate
  in `src/main.ts` becomes `paused` alone.
- [ ] The experiment scaffolding is removed:
  - `GameSession.isViewTickedByHost`;
  - the second condition in the host's gate;
  - the special cases in the thumbnail code and in
    `benchmarks/suites/games-and-demos.case.ts`.
- [ ] Both thumbnail paths (`src/main.ts`, `src/demos/main.ts`) tick views
  while advancing, then refresh once with `{ only: 'refresh' }`.
- [ ] The `games-and-demos` harness is uniform: `session.update(dt)`, then the
  tick. It times models, the update scene pass and the refresh scene pass
  separately, using `only`. Today's "update" column mixes models with view
  updates.
- [ ] Every game and demo is checked in a browser, including pause (see
  "Working notes").

### Phase 3: views and other callers

- [ ] About 113 `x.onUpdate =` / `x.onRefresh =` assignments become `onTick`:
  games, demos, `src/common/` (touch input, pause menu), and
  `src/cabinet/cabinet-view.ts`. Merge an update and a refresh on the same
  node into one call.
- [ ] Re-run the arity audit first. In the 2026-10-02 audit, no refresh method
  declared a parameter and no update method declared two, so nothing changes
  meaning. Re-check anything added since.
- [ ] The playground's presets (`src/playground/presets.ts`, six
  `view.onRefresh = refresh` samples and a comment explaining them) use
  `onTick`, and the sandbox exposes `onTick` to user code. Check what
  `src/playground/sandbox/compile.ts` hands to compiled code.
- [ ] The benchmark suites (15 files) set methods with `onTick`, or with the
  renderer's internal setters where a suite measures the scene passes
  themselves.
- [ ] The tests (14 files call the scene passes directly) use `tickScene`, or
  import the internal functions from the mixin files.

### Phase 4: remove the transitional layer

- [ ] The `onUpdate` / `onRefresh` accessors are gone. `installMethods` only
  installs the field defaults, and is renamed to match.
- [ ] Each mixin's type declarations for `Container`, `Object3D` and
  `Element` (`SceneNode`) are gone. Remove `SceneNode` itself if nothing else
  needs it.
- [ ] `assertNoShadowedMethods` is gone. It only protected the accessors.
- [ ] The renderer barrels stop exporting `updateScene`, `refreshScene`,
  `setUpdate` and `setRefresh`. The public surface is `tickScene`, `onTick`,
  `hasUpdate`, `hasRefresh`, `SKIP_DESCENDANTS`, the destroy helpers, and what
  each renderer already exports besides.
- [ ] `grep -rn "onUpdate\|onRefresh" src` finds only the JSX attributes,
  their types, and docs about them.

### Phase 5: scene counter for the perfmon

- [ ] A counter in the style of `readCounter` (`src/mvt-utils/read-counter.ts`):
  - switched on by `createFrameStats` for one frame in each window, like
    `'reads'`;
  - counts, per frame, the methods the scene passes called and the walks they
    rebuilt (churn); nodes visited by rebuilds too, if cheap.
- [ ] Switched off, it costs a flag check per scene pass or per call, no
  more. Confirm with `scene-passes` and `jsx-refresh`, interleaved against the
  commit before it.
- [ ] New rows in `src/common/perfmon-view.tsx`, next to "reads". Add the stat
  kinds to `FrameStatKind`.

### Phase 6: docs

- [ ] Update the docs:
  - AGENTS.md;
  - the architecture section, which introduces "tick" as MVT's umbrella term;
  - `docs/building-with-mvt/the-game-loop.md`, whose project section becomes
    "the ticker ticks models, then the scene";
  - the glossary ("scene pass" stays, as each half of a tick; don't shorten
    it to "pass");
  - the style guide's examples, the skills (`docs/ai-agents/`) and
    `docs/public/llms.txt`;
  - the pixi-mvt README and design notes;
  - `src/games/README.md`, the guide to adding a game.

  24 files mentioned the old names at creation.
- [ ] No coined jargon; use the existing terms (the user's standing
  preference).

### Phase 7: benchmarks

- [ ] Every suite is re-run and re-saved (`npm run bench -- all --save`) from
  a worktree, on a quiet machine.
- [ ] The saved results note the two known shifts:
  - the DOM naive baseline reads its own property now, which made it 2-6%
    faster;
  - the `games-and-demos` columns are new.
- [ ] `docs/building-with-mvt/performance/measurements.md` is updated if it
  quotes changed numbers.

### Phase 8: notes

- [ ] Proposal 027 is rewritten around what was decided: the tick vocabulary,
  `tickScene` / `onTick`, and variant C storage. Mark the rename sections
  (3-6.3) superseded, and keep them as the record of why. Then archive it, with
  its index row.
- [ ] This task is archived, and its loose ends below are filed.

## Out of scope (file in 017 or their own tasks when this closes)

- **Dev checks** from 027: the stale-walk and coverage checks (section 7.5 b
  and c), and the method-result check (7.6, item 2).
- **DOM churn costs 3-6% more** with variant C than before, in
  `html-scene-passes`. This round of changes adds nothing to it. The cause is
  unexplained; the per-node `visit()` call in rebuilds is the first suspect.
- **Pixi's "[Cache] already has key" warnings** (`ghost-eyes`, `ship-icon`,
  `ship`) on loading the cabinet. Check whether they predate this work.
- **When the packages are published (proposal 011):** 027 section 11.7's
  duplicate-copy mitigations, and `Symbol.for` for `SKIP_DESCENDANTS`.
- **Rename `onTick` to `setTickMethods`:** follow-up task
  [029](../backlog/029-rename-ontick-to-settickmethods.md), after this one.
  Adoption, mixed-library and dependency-direction notes for the docs phase
  are in [027 section 12](../../proposals/027-mvt-method-names.md).

## Working notes

- **Benchmarks.** Follow the "benchmark pitfalls" and "worktrees lack
  node_modules" memories:
  - Run baseline and change from worktrees under `.claude/worktrees/`, never
    the main checkout. The user's Vite dev server watches it, and
    `npm run bench` rewrites `refresh-copies.ts`, which biased results by
    3-13%.
  - Interleave the runs, in both orders, and use rows the change cannot
    affect (Solid, naive walks) to gauge noise.
  - Junction `node_modules` into each worktree. Delete the junction on its
    own (`[System.IO.Directory]::Delete(path, $false)`) before removing the
    worktree.
  - While worktrees exist, run Vitest in the main checkout with
    `--exclude ".claude/**"`.
- **Browser checks.** Start Vite on a spare port (`npx vite --port 5199
  --strictPort`), launch headless Chrome with `--remote-debugging-port`, and
  drive it with a small Node script over the DevTools protocol (Node 22's
  built-in `WebSocket`):
  - open `/games/#<id>`, wait in real time, and capture
    `Page.captureScreenshot`;
  - record `Runtime.consoleAPICalled` and `Runtime.exceptionThrown`;
  - send Escape with `Input.dispatchKeyEvent` to pause.

  `--virtual-time-budget` screenshots come out black, so use real time. Stop
  both processes by PID afterwards; stopping the task leaves its children
  running.
- **Arity audit.** Search for refresh methods that declare a parameter and
  update methods that declare two, inline or named:
  `grep -rnE "\.onRefresh\s*=\s*\(\s*[a-zA-Z_]"` and the equivalent for
  `onUpdate` with a comma. Then check the definitions of named methods.

## Progress Log

- **2026-10-02** Created from the session that ran 027's spikes. The state at
  creation is described above.
