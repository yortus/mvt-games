# Architecture Rules

> Universal MVT constraints. These apply to any MVT implementation regardless
> of language, renderer, or framework. For this project's code conventions,
> see the [Style Guide](../reference/style-guide.md).

**Related:** [Architecture Overview](index.md) -
[Models](models.md) -
[Views](views.md) -
[Bindings](bindings.md) -
[The Ticker](ticker.md)

---

## Model Rules

| Rule | Constraint | Detail |
|---|---|---|
| **M-time** | All state advances through `update(deltaMs)` only | No wall-clock time, no auto-advancing timers. Time enters exclusively through the ticker's `deltaMs`. Guarantees determinism: same inputs, same outputs. |
| **M-isolation** | Models must not reference views or the ticker | Models are self-contained simulations. They must not import or know about any view, presentation technology, or the ticker itself. Enables independent testing and renderer substitution. |
| **M-domain** | State uses domain-level terms, not presentation terms | Positions in tiles, metres, or world-units - not pixels. States as named values (`'alive'`, `'exploding'`) - not colours or texture names. The model defines the world; the view decides how to draw it. |
| **M-composition** | Parent models delegate `update(deltaMs)` to children | Cross-model concerns (collisions, phase transitions) live in the parent, after children have updated. Each child is independently testable. |

## View Rules

| Rule | Constraint | Detail |
|---|---|---|
| **V-stateless** | Views hold no domain state | Read state and write presentation output. No domain logic, no autonomous behaviour. Views are projections that can be replaced without affecting simulation outcomes. |
| **V-refresh** | `refresh()` runs once per frame, after all models have updated | Views read settled state - no view sees a half-updated world. |
| **V-idempotent** | `refresh()` must be idempotent | Calling it twice with the same model state produces the same output. No hidden side effects accumulate across frames. |
| **V-readonly** | `refresh()` must not mutate models | Domain actions are relayed through `on*()` bindings, not triggered in refresh. Views are read-only projections within the frame. |
| **V-reactive** | Binding values must be re-read in `refresh()`, never cached at construction | Values may change between frames. The view must always reflect current state. |
| **V-presentation** | Views may hold cosmetic presentation state the model doesn't track | Such views gain an `update(deltaMs)` method. Extract complex logic into a view model. Presentation state must not affect domain outcomes. |
| **V-output** | Views can target any output technology | Canvas, DOM, audio, terminal, test harness. MVT is not coupled to a particular renderer. |
| **V-tree** | View trees do not need to mirror model trees | Domain structure and presentation needs are different concerns. Bindings decouple the two hierarchies. |

## Ticker Rules

| Rule | Constraint | Detail |
|---|---|---|
| **T-sequence** | Each frame follows strict order: update models, advance view state, refresh views, render | Never interleave or skip steps. Models settle before views read. |
| **T-cap** | Cap `deltaMs` to a safe maximum | Prevents large time gaps (from lost focus, loading stalls, slow devices) from overwhelming models that assume small inter-frame deltas. |
| **T-minimal** | The ticker contains no domain logic and no rendering code | It is purely a timing orchestrator. |
| **T-control** | The ticker may pause, slow, speed up, or single-step time | Models stay in sync because they only see `deltaMs`. |

## Binding Rules

| Rule | Constraint | Detail |
|---|---|---|
| **B-contract** | Bindings are the contract between a view and the world | `get*()` reads state (model to view). `on*()` relays user input (view to model). The bindings type is a complete manifest of every dependency. |
| **B-reusable** | Reusable leaf views use a bindings interface; top-level views may access models directly | Leaf views stay decoupled and reusable. Top-level views are application-specific. |
| **B-optional** | `on*()` bindings should usually be optional | Keeps views usable in more contexts without forcing no-op handlers. |
| **B-wiring** | Bindings are wired at the view construction site | The view does not know how it is connected to the outside. |

## Hot-Path Rules

| Rule | Constraint | Detail |
|---|---|---|
| **H-cost** | Minimise per-tick computation cost | Prefer O(1) lookups over repeated traversals. Cache derived values. |
| **H-alloc** | Avoid per-tick heap allocations in `update()` and `refresh()` | Minimises garbage collection pressure. |
| **H-loops** | Use index-based loops and pre-allocated structures | Avoids iterator and temporary array allocation. |
| **H-change** | Use change detection when a value changes rarely but triggers expensive work | Check every frame, rebuild only on change. |
