# Architecture Rules

> Every MVT rule on one page. Numbered, categorized, and linkable. When a rule
> here conflicts with a guide page, this page is the definitive authority.

**Related:** [Architecture Overview](../learn/architecture-overview.md) ·
[Style Guide](style-guide.md) · [Glossary](glossary.md)

---

These are **MVT architectural rules** - they apply to any codebase using the
MVT pattern, regardless of language, renderer, or code style conventions.
For this project's code style conventions (naming, factory functions, barrel
files), see the [Style Guide](style-guide.md).

## Model Rules

| # | Rule | Common Examples | Rationale |
| -- | ---- | --------------- | --------- |
| M1 | Models own all domain state and logic. | Position, health, score, phase transitions, collision rules | Single source of truth. Views and tickers never hold domain state. |
| M2 | All state advances through `update(deltaMs)` only. | No `setTimeout`, `setInterval`, `requestAnimationFrame`, auto-playing tweens, `Date.now()`, `performance.now()` | Determinism. Same `update()` calls produce the same state. The ticker controls time. [Time Management](../guide/time-management.md) |
| M3 | Models must not reference views or the ticker. | No imports from view modules; no scene-graph objects in model state | Separation of concerns. Models are independently testable. |
| M4 | Model state must use domain-level terms, not presentation-specific ones. | Fractional `row`/`col` for grid games; world-units for open arenas; named states (`'inflating'`) rather than pixel values or hex colours | Presentation independence. Models work unchanged regardless of screen size or rendering technology. [Models](../learn/models.md) |
| M5 | Parent models delegate `update(deltaMs)` to child models. Cross-model concerns live in the parent. | Root game model calls `ship.update(dt)` then checks collisions | Hierarchical composition. Each child is independently testable. [Model Composition](../guide/model-composition.md) |

## View Rules

| # | Rule | Common Examples | Rationale |
| -- | ---- | --------------- | --------- |
| V1 | Views hold no domain state. They read state and write to the presentation output. | No domain logic, no autonomous animations, no internal domain state | Views are pure projections that can be replaced or multiplied without affecting behaviour. [Views](../learn/views.md) |
| V2 | `refresh()` runs once per frame, after all models have updated. | Read bindings, set sprite positions and text labels | Frame-consistent snapshots. No view sees a half-updated world. |
| V3 | `refresh()` must be idempotent. | Calling it twice with the same model state produces the same result | Predictability. No hidden side effects accumulate across frames. |
| V4 | `refresh()` must not mutate models, emit domain events, or trigger state transitions. | Domain actions are relayed through `on*()` bindings, not called directly in `refresh()` | Views are read-only projections. |
| V5 | All binding values must be re-read in `refresh()`, never cached at construction time. | Call `bindings.getScore()` inside `refresh()`, not in the factory closure | Bindings are reactive. Values may change between frames. [Bindings in Depth](../guide/bindings-in-depth.md) |
| V6 | Views may hold cosmetic presentation state for transitions the model doesn't track. When the logic is complex enough to warrant separate testing, extract it into a view model. For the simplest cases (a single smoothed value), inline state with a `getClockMs()` binding is acceptable. | Death flash timer in a view; match effect sequence extracted to a view model; smoothed score counter inline with `getClockMs()` | Keeps models free of presentation concerns. View models are testable and deterministic when extraction is warranted. [Presentation State](../guide/presentation-state.md) |
| V7 | When a view has inline presentation state, receive elapsed time through a `getClockMs()` binding. Views must not invent their own notion of time or hardcode frame deltas. | `getClockMs()` binding driving an easing tween; never `timerMs += 16` | Keeps presentation animations deterministic and frame-rate-independent. [Presentation State](../guide/presentation-state.md) |
| V8 | MVT views can target any output technology. | Canvas scene graph, DOM, audio system, debug panel | MVT is not coupled to a particular renderer. |
| V9 | View trees do not need to mirror model trees. | Multiple views from one model; models with no view; decorative views with no model | Domain structure and presentation needs are different concerns. Bindings decouple the two trees. [View Composition](../guide/view-composition.md) |

## Ticker Rules

| # | Rule | Common Examples | Rationale |
| -- | ---- | --------------- | --------- |
| T1 | Each frame follows a strict sequence: update, refresh, render. Never interleave or skip steps. | `model.update(deltaMs)` then `view.update(deltaMs)` (stateful views) then `view.refresh()` then renderer draws | Models settle first, then stateful views advance presentation state, then all views read a stable snapshot. [The Ticker](../learn/ticker.md) |
| T2 | Cap `deltaMs` to a safe maximum. | e.g. 100ms cap to handle backgrounded tabs | Prevents huge time leaps that could break non-leap-safe models. |
| T3 | The ticker contains no domain logic and no rendering code. | No collision checks, no sprite creation | Separation of concerns. It is purely a timing orchestrator. |
| T4 | The ticker may pause, slow down, speed up, or single-step time. | Pause overlay, slow-mo debug, frame-by-frame stepping | Models stay in sync because they only see `deltaMs`. |

## Bindings Rules

| # | Rule | Common Examples | Rationale |
| -- | ---- | --------------- | --------- |
| B1 | Bindings are the contract between a view and the world. `get*()` reads state; `on*()` relays user input. | `getScore(): number`, `onDirectionChanged(dir): void` | Explicit dependencies. The bindings type is a complete manifest of everything the view requires or provides. [Bindings](../learn/bindings.md) |
| B2 | Reusable leaf views use a bindings interface. Top-level application views may access models directly. | HUD panel takes bindings; game-view takes the game model | Leaf views stay decoupled and reusable. Top-level views are application-specific. [Bindings in Depth](../guide/bindings-in-depth.md) |
| B3 | `on*()` bindings should usually be optional. | A gamepad view with optional `onFireChanged?()` | Keeps views usable in more contexts without forcing no-op handlers. |
| B4 | Bindings are wired at the view construction site. | Parent view maps `getScore: () => game.score.score` | Decoupling. The view does not know how it is connected to the outside. |

## Hot-Path Rules

| # | Rule | Common Examples | Rationale |
| -- | ---- | --------------- | --------- |
| H1 | Minimise per-tick computation cost. Prefer O(1) lookups over repeated traversals; cache derived values. | Flat array indexed by `row * cols + col` instead of `Map<string, T>`; pre-computed neighbour lists instead of per-tick neighbour scanning | Saves CPU budget for the frame. [Hot Paths](../guide/hot-paths.md) |
| H2 | Avoid per-tick heap allocations in `update()` and `refresh()`. | `array.map()`, template-string keys, `for...of` on arrays, inline closures, spread | Minimises GC pressure. [Hot Paths](../guide/hot-paths.md) |
| H3 | Use index-based `for` loops and pre-allocated structures. | `for (let i = 0; i < arr.length; i++)`, flat arrays indexed by `row * cols + col` | Avoids iterator and array allocation. |
| H4 | Use change detection when a binding changes rarely but triggers expensive work. | Watch a `getGamePhase()` binding; rebuild overlay only on change | Poll every frame, rebuild only on change. [Change Detection](../guide/change-detection.md) |
