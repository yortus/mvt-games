# Architecture Rules

> MVT architecture rules have moved to the
> [Architecture section](../architecture/rules.md). This page provides
> quick-reference tables linking each rule to its documentation.

**See:** [Architecture Rules (full)](../architecture/rules.md) -
[Style Guide](style-guide.md) -
[Glossary](glossary.md)

---

## Universal MVT Rules

These apply to any MVT implementation regardless of language or renderer.
The canonical definitions live in [Architecture Rules](../architecture/rules.md).

### Model Rules

| Rule | Constraint | Reference |
|---|---|---|
| **M-time** | All state advances through `update(deltaMs)` only | [Architecture Rules](../architecture/rules.md#model-rules) |
| **M-isolation** | Models must not reference views or the ticker | [Architecture Rules](../architecture/rules.md#model-rules) |
| **M-domain** | State uses domain-level terms, not presentation terms | [Architecture Rules](../architecture/rules.md#model-rules) |
| **M-composition** | Parent models delegate `update(deltaMs)` to children | [Architecture Rules](../architecture/rules.md#model-rules) |

### View Rules

| Rule | Constraint | Reference |
|---|---|---|
| **V-stateless** | Views hold no domain state | [Architecture Rules](../architecture/rules.md#view-rules) |
| **V-refresh** | `refresh()` runs once per frame, after all models have updated | [Architecture Rules](../architecture/rules.md#view-rules) |
| **V-idempotent** | `refresh()` must be idempotent | [Architecture Rules](../architecture/rules.md#view-rules) |
| **V-readonly** | `refresh()` must not mutate models | [Architecture Rules](../architecture/rules.md#view-rules) |
| **V-reactive** | Binding values must be re-read in `refresh()`, never cached | [Architecture Rules](../architecture/rules.md#view-rules) |
| **V-presentation** | Views may hold cosmetic presentation state the model does not track | [Architecture Rules](../architecture/rules.md#view-rules) |
| **V-output** | Views can target any output technology | [Architecture Rules](../architecture/rules.md#view-rules) |
| **V-tree** | View trees do not need to mirror model trees | [Architecture Rules](../architecture/rules.md#view-rules) |

### Ticker Rules

| Rule | Constraint | Reference |
|---|---|---|
| **T-sequence** | Each frame follows strict order: update, advance view state, refresh, render | [Architecture Rules](../architecture/rules.md#ticker-rules) |
| **T-cap** | Cap `deltaMs` to a safe maximum | [Architecture Rules](../architecture/rules.md#ticker-rules) |
| **T-minimal** | The ticker contains no domain logic and no rendering code | [Architecture Rules](../architecture/rules.md#ticker-rules) |
| **T-control** | The ticker may pause, slow, speed up, or single-step time | [Architecture Rules](../architecture/rules.md#ticker-rules) |

### Binding Rules

| Rule | Constraint | Reference |
|---|---|---|
| **B-contract** | Bindings are the contract between a view and the world | [Architecture Rules](../architecture/rules.md#binding-rules) |
| **B-reusable** | Reusable leaf views use a bindings interface; top-level views may access models directly | [Architecture Rules](../architecture/rules.md#binding-rules) |
| **B-optional** | `on*()` bindings should usually be optional | [Architecture Rules](../architecture/rules.md#binding-rules) |
| **B-wiring** | Bindings are wired at the view construction site | [Architecture Rules](../architecture/rules.md#binding-rules) |

### Hot-Path Rules

| Rule | Constraint | Reference |
|---|---|---|
| **H-cost** | Minimise per-tick computation cost | [Architecture Rules](../architecture/rules.md#hot-path-rules) |
| **H-alloc** | Avoid per-tick heap allocations in `update()` and `refresh()` | [Architecture Rules](../architecture/rules.md#hot-path-rules) |
| **H-loops** | Use index-based loops and pre-allocated structures | [Architecture Rules](../architecture/rules.md#hot-path-rules) |
| **H-change** | Use change detection for rare but expensive updates | [Architecture Rules](../architecture/rules.md#hot-path-rules) |

## Repo-Specific Conventions

These are style and structural choices for this project, not MVT
requirements. See the [Style Guide](style-guide.md) for full details.

| Convention | Reference |
|---|---|
| Factory functions, not classes | [Style Guide](style-guide.md#factory-functions) |
| String-literal unions, not `enum` | [Style Guide](style-guide.md#enumeration-types) |
| `Kind` not `Type`, `phase` not `state` | [Style Guide](style-guide.md#easily-confused-names) |
| Barrel imports only | [Project Structure](project-structure.md) |
| 4-space indentation | [Style Guide](style-guide.md#formatting) |
