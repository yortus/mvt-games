# Architecture Rules

> Universal MVT constraints. These apply to any MVT implementation regardless
> of language, renderer, or framework. For this project's code conventions,
> see the [Style Guide](../reference/style-guide.md).

**Related:** [Architecture Overview](index.md) -
[Models](models.md) -
[Views](views.md) -
[Bindings](bindings.md) -
[The Ticker](ticker.md) -
[The Principles Behind MVT](principles/index.md)

---

Each rule follows from one or more of the
[principles behind MVT](principles/index.md). The **Serves** column links
to them. When a case comes up that no rule covers, those pages explain the
reasoning, so you can apply it to the new case.

## Model Rules

| Rule | Constraint | Detail | Serves |
|---|---|---|---|
| **M-time** | All state advances through `update(deltaMs)` only | No wall-clock time, no auto-advancing timers. Time enters exclusively through the ticker's `deltaMs`. Guarantees determinism: same inputs, same outputs. | [SoC](principles/separation-of-concerns.md), [DIP](principles/dependency-inversion.md), [DfT](principles/design-for-testability.md) |
| **M-isolation** | Models must not reference views or the ticker | Models are self-contained simulations. They must not import or know about any view, presentation technology, or the ticker itself. Enables independent testing and renderer substitution. | [SoC](principles/separation-of-concerns.md), [DIP](principles/dependency-inversion.md), [DfT](principles/design-for-testability.md) |
| **M-domain** | State uses domain-level terms, not presentation terms | Positions in tiles, metres, or world-units - not pixels. States as named values (`'alive'`, `'exploding'`) - not colours or texture names. The model defines the world; the view decides how to draw it. | [SoC](principles/separation-of-concerns.md), [MISU](principles/illegal-states-unrepresentable.md) |
| **M-composition** | Parent models delegate `update(deltaMs)` to children | Cross-model concerns (collisions, phase transitions) live in the parent, after children have updated. Each child is independently testable. | [SSOT](principles/single-source-of-truth.md), [CRP](principles/composite-reuse.md) |

## View Rules

| Rule | Constraint | Detail | Serves |
|---|---|---|---|
| **V-stateless** | Views hold no domain state | Read state and write presentation output. No domain logic, no autonomous behaviour. Views are projections that can be replaced without affecting simulation outcomes. | [SoC](principles/separation-of-concerns.md), [SSOT](principles/single-source-of-truth.md) |
| **V-refresh** | `refresh()` runs once per frame, after all models have updated | Views read settled state - no view sees a half-updated world. | [CQS](principles/command-query-separation.md) |
| **V-idempotent** | `refresh()` must be idempotent | Calling it twice with the same model state produces the same output. No hidden side effects accumulate across frames. | [CQS](principles/command-query-separation.md), [DfT](principles/design-for-testability.md) |
| **V-readonly** | `refresh()` must not mutate models | Views report user input through relay bindings; they do not act on it in refresh. Views are read-only projections within the frame. | [CQS](principles/command-query-separation.md) |
| **V-reactive** | Query bindings given as functions must be re-read in `refresh()`, never cached at construction | Their values may change between frames, and the view must always reflect current state. A query binding the view reads only once must be declared as a fixed value, so the bindings state the limitation. A function with arguments has no fixed form, so a view that calls one less often says so in the binding's documentation. See [Fixed Values and Getters](bindings.md#fixed-values-and-getters). | [SSOT](principles/single-source-of-truth.md), [DbC](principles/design-by-contract.md) |
| **V-presentation** | Views may hold cosmetic presentation state the model doesn't track | Such views gain an `update(deltaMs)` method. It advances presentation state and writes no presentation output: `refresh()` writes all of it, including adding and removing elements. Presentation state starts valid at construction, since a view's first `refresh()` may come before its first `update()`. Extract complex logic into a view model. Presentation state must not affect domain outcomes. | [SSOT](principles/single-source-of-truth.md) |
| **V-output** | Views can target any output technology | Canvas, DOM, audio, terminal, test harness. MVT is not coupled to a particular renderer. | [SoC](principles/separation-of-concerns.md) |
| **V-tree** | View trees do not need to mirror model trees | Domain structure and presentation needs are different concerns. Bindings decouple the two hierarchies. | [SoC](principles/separation-of-concerns.md), [CRP](principles/composite-reuse.md) |

## Ticker Rules

| Rule | Constraint | Detail | Serves |
|---|---|---|---|
| **T-sequence** | Each frame follows strict order: update models, advance view state, refresh views, render | Never interleave or skip steps. Models settle before views read. | [CQS](principles/command-query-separation.md) |
| **T-cap** | Cap `deltaMs` to a safe maximum | Prevents large time gaps (from lost focus, loading stalls, slow devices) from overwhelming models that assume small inter-frame deltas. | [DbC](principles/design-by-contract.md) |
| **T-minimal** | The ticker contains no domain logic and no rendering code | It is purely a timing orchestrator. | [SoC](principles/separation-of-concerns.md) |
| **T-control** | The ticker may pause, slow, speed up, or single-step time | Models stay in sync because they only see `deltaMs`. | [DfT](principles/design-for-testability.md) |

## Binding Rules

| Rule | Constraint | Detail | Serves |
|---|---|---|---|
| **B-contract** | Bindings are the contract between a view and the world | Query bindings read state (model to view). Relay bindings report user input out of the view (view to model). The bindings type is a complete manifest of every dependency. | [CQS](principles/command-query-separation.md), [DIP](principles/dependency-inversion.md), [DbC](principles/design-by-contract.md) |
| **B-reusable** | Reusable leaf views take query and relay bindings; a top-level view may take the model itself as a fixed binding | Leaf views stay decoupled and reusable. Top-level views are application-specific, so a binding for each model property would gain nothing. | [DIP](principles/dependency-inversion.md), [CRP](principles/composite-reuse.md) |
| **B-optional** | Relay bindings should usually be optional | Keeps views usable in more contexts without forcing no-op handlers. | [DbC](principles/design-by-contract.md) |
| **B-wiring** | Bindings are wired at the view construction site | The view does not know how it is connected to the outside. | [DIP](principles/dependency-inversion.md) |

## Hot-Path Rules

These rules serve performance rather than a design principle, so they have
no Serves column. Where one pulls against a principle, the principle's page
says so. The overview shows an example, in
[When Principles Pull Against Each Other](principles/index.md#when-principles-pull-against-each-other).

| Rule | Constraint | Detail |
|---|---|---|
| **H-cost** | Minimise per-tick computation cost | Prefer O(1) lookups over repeated traversals. Cache derived values. |
| **H-alloc** | Avoid per-tick heap allocations in `update()` and `refresh()` | Minimises garbage collection pressure. |
| **H-loops** | Use index-based loops and pre-allocated structures | Avoids iterator and temporary array allocation. |
| **H-change** | Use change detection for discrete state that changes rarely but triggers expensive work | Check every frame, rebuild only on change. |
