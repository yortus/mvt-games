# Skill: Reviewing Code

> Self-contained instructions for reviewing code in this project. Load this
> file before performing a code review to ensure consistent, thorough, and
> actionable feedback.

---

## Review Philosophy

A code review is an opportunity to improve the codebase, not just approve
changes. Report findings as concrete recommendations with rationale - not
vague suggestions. Each finding should explain **what** to change, **why**
it matters, and **how** to fix it.

Organise findings by importance - architectural and correctness issues first,
style nits last. The reviewer's attention budget mirrors the reader's: the
most impactful feedback should land first.

---

## Review Checklist

Work through these categories in order. Each section lists what to look for
and common fixes.

### 1. MVT Architecture Compliance

These are non-negotiable. Violations produce incorrect code.

| Rule | What to check | Common violation |
| ---- | ------------- | ---------------- |
| M-time, M-isolation, M-domain, M-composition | Models own all domain state; advance via `update(deltaMs)` only; no view/ticker references; domain-level coordinates; parent delegates to children | Model importing a view type; model using `Date.now()`; model storing pixel coordinates |
| V-stateless through V-tree | Views are stateless; `refresh()` is idempotent, side-effect-free; bindings re-read every frame; presentation state only when purely cosmetic | View caching a binding value at construction; `refresh()` mutating model state; domain logic in a view |
| T-sequence through T-control | Ticker sequence is update-refresh-render; `deltaMs` is capped; no domain logic in ticker | Ticker performing collision checks |
| B-contract through B-wiring | Bindings use `get*`/`on*`; leaf views use bindings; `on*` bindings are optional; wired at construction site | View reaching into model internals instead of using bindings |
| H-cost through H-change | No per-tick allocations; index-based loops; change detection for expensive infrequent updates | `array.map()` in `refresh()`; template-string keys in `update()` |

Reference: [Architecture Rules](../architecture/rules.md)

### 2. Software Engineering Principles

These principles apply broadly and keep the codebase maintainable.

#### Isolation and clear interfaces

Every part of the system should be understandable, testable, and replaceable
with minimal knowledge of its surroundings. Practically:

- **Directory modules** with isolated parts in separate files, connected
  through typed interfaces and barrel files.
- **File length** under a few hundred lines. A file growing past ~300 lines
  is a signal to look for natural split points.
- **Narrow public contracts** - interfaces should specify only what is
  required, not expose the full implementation surface. Narrow contracts
  maximise flexibility for non-breaking future changes and minimise the
  chance of consumers depending on implementation details (Hyrum's Law).
- **JSDoc on all public exports** - every exported interface, type, factory
  function, constant, and their public members must have a JSDoc comment.
  At minimum a one-line `/** ... */` summary. Add further detail for
  anything types alone cannot capture: units, valid ranges, invariants,
  side effects, or protocols.

When reviewing, ask: *Could someone understand this module by reading only
its public interface, without looking at anything else?*

**Common finding:** A module exposes internal helpers or types that callers
don't need. **Fix:** move them below the exports or into a private helper
file; tighten the barrel re-exports.

**Common finding:** An exported interface or factory function lacks any
JSDoc, forcing consumers to read the implementation to understand its
purpose. **Fix:** add at minimum a one-line `/** ... */` summary to every
export and its public members. Document units, constraints, and semantics
that the type signature does not convey.

#### Single responsibility (pragmatic, not dogmatic)

Each function, file, or module should "do one thing" - but avoid the
extremes:

- **Too coarse:** A very long function performing many steps with all details
  inline. Hard to read, test, or modify in isolation.
- **Too fine:** Many tiny functions requiring the reader to jump between
  files to understand a single flow. The indirection cost exceeds the
  abstraction benefit.

The happy medium: each function body either **orchestrates an entire flow**
(calling named steps) or **performs all the details of a single step**. Not
both at the same time.

**Common finding:** A factory function mixes orchestration with low-level
detail. **Fix:** extract the detail into a named helper; keep the factory
body as a readable sequence of steps.

#### Explicit dependencies, minimal side effects

Functions should operate on their declared inputs and return their result.
Prefer pure computations. Flag these during review:

- Functions that read or modify external state not passed as arguments.
- Methods that implicitly share instance state (a reason this project
  prefers factory functions over classes).
- Functions that mutate their input parameters.
- Code that depends on scene-graph structure not documented as stable in a
  public interface.

Where side effects are unavoidable, they **must** be documented in the
public API via JSDoc so that it is clear what constitutes a breaking change
at the contract level.

**Common finding:** A helper reaches into a parent's state through closure
without that dependency being visible in its signature. **Fix:** pass the
needed value as a parameter, or document the coupling in the interface
contract.

#### Contract-driven coupling

Parts of the system should interconnect through typed interfaces with JSDoc
for anything types alone cannot capture. Review for:

- **Over-specified contracts** that promise more than needed, constraining
  future evolution.
- **Under-specified contracts** that omit important shape or protocol
  details, forcing consumers to depend on observed behaviour.
- **Implementation coupling** - code depending on internal details of
  another module rather than its documented interface. When this creeps in,
  the system becomes brittle to change.

**Common finding:** A view accesses a model property not in the model's
public interface. **Fix:** add it to the interface if it is a genuine
requirement, or route it through a binding.

### 3. MVT Patterns and Practices

Beyond the hard rules, review for good use of established patterns.

#### Models

- **Advance-then-orchestrate:** `update()` should advance all timelines and
  child models first, then check state and trigger new sequences. Sequencing
  details belong in `schedule*()` helpers, not in `update()` itself.
- **Delegation:** Parent models delegate `update()` to children. Cross-model
  concerns (collisions, scoring) live in the parent's orchestration phase.
- **Time leap safety:** If the model is not leap-safe, is this documented
  or obvious from the implementation?
- **Domain coordinates:** Models expose domain-level values (row/col,
  world-units, named phases), not pixels or renderer-specific values.

#### Views

- **Stateless rendering:** Views build the scene graph once at construction,
  then update properties in `refresh()`. No display object recreation
  per frame.
- **Bindings usage:** Reusable leaf views use a bindings interface. Binding
  values are read inside `refresh()`, never cached at construction time.
- **Change detection:** Expensive, infrequent updates use `watch()`.
  Cheap per-frame updates (position, alpha) read directly.
- **Presentation state:** Used only when purely cosmetic and the model does
  not need to know. Views with presentation state receive time through
  `update(deltaMs)`. Complex logic should be extracted into a view model.

#### Composition

- **Model composition:** Parent creates and owns child models. Each child is
  independently testable.
- **View composition:** View trees need not mirror model trees. Multiple
  views from one model, decorative views with no model - all fine.
- **Bindings wiring:** Done at the construction site (parent view), not
  inside the child view.

### 4. Code Style

These are project conventions. Flag violations, but rank them below
architecture and engineering concerns.

#### File and code organisation

- **File sections follow the standard order:** Interface, Options, Factory,
  Internals. Public contract first, implementation details last.
- **Declaration order within functions:** Initialisation at top, public
  record and return, then child construction helpers, then low-level helpers
  at bottom.
- **Exports above internals:** All exports before any internal declarations.
  Main types before helper types they compose.

#### Naming

| Element | Convention |
| ------- | ---------- |
| Files | `lower-kebab-case.ts` |
| Types | `PascalCase`, suffix `Model` / `View` as appropriate |
| Functions/variables | `camelCase`; factories are `createXxx` |
| Booleans | `is` / `has` / `can` prefix |
| Bindings | `get*()` for accessors, `on*()` for event handlers |
| Enum-like types | String-literal unions; use `Kind` not `Type` |
| Lifecycle props | Use `phase` not `state` |
| Unused params | `_` prefix |

#### Other conventions

- **No classes** - factory functions returning plain records.
- **No `null`** - use `undefined`.
- **No `enum`** - string-literal unions.
- **Barrel imports only** - never import past a directory's `index.ts`.
- **No `.ts` extensions** in module specifiers.
- **4-space indentation.**

Reference: [Style Guide](../reference/style-guide.md)

### 5. Hot-Path Awareness

Code in `update()` and `refresh()` runs every tick. Flag:

- `array.map()`, `array.filter()`, `array.slice()`, spread syntax
- Template-string keys (`\`${row}-${col}\``)
- `for...of` on arrays
- Inline closures (arrow functions created per tick)
- Object destructuring creating new objects per tick
- Repeated traversals that could be pre-computed

**Fix pattern:** Pre-allocate structures at construction time; use
index-based `for` loops; cache derived values; use arithmetic keys
(`row * cols + col`).

---

## Report Structure

Organise review output in this order:

1. **Summary** - one-paragraph assessment of the change. Is it correct? Does
   it follow the architecture? Any high-level structural observations?

2. **Critical** - architecture violations, correctness bugs, or broken
   contracts that must be fixed before the code is acceptable.

3. **Structural improvements** - opportunities to improve isolation,
   simplify responsibilities, tighten contracts, or reduce coupling. Always
   include a concrete recommendation for each.

4. **Style** - naming, ordering, formatting, and convention issues. Important
   for consistency but not blocking.

5. **Observations** - optional. Patterns worth noting for future reference,
  questions about design intent, or places where tests would add value.

Within each section, list findings as bullet points with:
- **What:** the specific issue or opportunity.
- **Where:** file and location.
- **Why:** the principle or rule it relates to.
- **How:** concrete fix or recommendation.

---

## Tone

- Direct, constructive, and specific. No vague praise or unfounded criticism.
- Frame findings as improvements to the code, not critiques of the author.
- When a trade-off exists (e.g. simplicity vs flexibility), acknowledge it
  and recommend a direction with rationale.
- Use "consider" for genuinely optional suggestions; use "should" or "must"
  for rule violations.

## Full Reference

- [Architecture Rules](../reference/architecture-rules.md) - all MVT rules
- [Style Guide](../reference/style-guide.md) - code conventions
- [Hot Paths](../topics/hot-paths.md) - performance considerations
- [Bindings in Depth](../topics/bindings-in-depth.md) - bindings patterns
- [Model Composition](../topics/model-composition.md) - model hierarchy
- [View Composition](../topics/view-composition.md) - view hierarchy
- [Presentation State](../topics/presentation-state.md) - when views may
  hold state
