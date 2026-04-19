# Testing

> MVT's strict separation makes testing straightforward. Models are
> deterministic - call `update()`, assert state. Views produce pixels -
> capture and compare. Neither depends on the other.

**Related:** [Models (Learn)](../simulating-the-world/models.md) -
[Views (Learn)](../presenting-the-world/views.md) -
[Model Composition](../simulating-the-world/model-composition.md)

---

## Philosophy

Test against **public, specified behaviours** - not internal
implementation details. A model test calls public methods and asserts on
public properties. A view test captures visual output and compares
against a known baseline. If either layer's internals change, tests
should not break unless the observable result changes.

This project uses [Vitest](https://vitest.dev/) for model and view model
tests, and [Playwright](https://playwright.dev/) for visual snapshot
tests.

## Testing by Layer

| Layer | What to test | How | Page |
|---|---|---|---|
| **Models** | State, transitions, composition | `update()` + assert values | [Testing Models](testing-models.md) |
| **View models** | Presentation state transforms | `update()` + assert values | [Testing Models](testing-models.md) |
| **Views** | Visual correctness | Visual snapshots | [Testing Views](testing-views.md) |

Models and view models are tested the same way - they are both stateful
objects with a public API and no rendering dependency. Views are a
fundamentally different problem because their output is pixels, not
values.

## Quick Links

- [Advancing time deterministically](testing-models.md#advancing-time) -
  the `advanceTime` helper, microtask flushing, leap safety
- [Factory with defaults](testing-models.md#factory-with-defaults) -
  reducing construction noise in tests
- [Scene graph assertions](testing-views.md#scene-graph-assertions) -
  when they help and when they hurt
- [Visual snapshot testing](testing-views.md#visual-snapshot-testing) -
  capturing and comparing rendered output
