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

This project uses [Vitest](https://vitest.dev/) for every test. Tests of
models, view models and scene graphs run in Node.
[Visual tests](visual-tests.md) run in a browser, through
[v-snap](https://github.com/yortus/mvt-games/blob/main/packages/tools/v-snap/README.md),
which uses Vitest's browser mode.

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

## Tests That Compare With an Accepted Copy

A kind of test called a **snapshot test** compares what a previous run produced to what the next run produces. For games, two common snapshop tests are visual and audio tests, where a view produces output that is compared with a previously accepted copy.

- A [visual test](visual-tests.md) takes an image of a view and compares
  it with a reference image.
- An [audio test](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/src/headless/README.md#audio-tests)
  renders a sound in memory and compares a hash of its samples with a
  stored hash.

Either fails on any change to its output. It keeps failing until someone
has seen or heard the change and accepted it as the new reference.

## Quick Links

- [Advancing time deterministically](testing-models.md#advancing-time) -
  `advanceTime`, microtask flushing, leap safety
- [Factory with defaults](testing-models.md#factory-with-defaults) -
  reducing construction noise in tests
- [Scene graph assertions](testing-views.md#scene-graph-assertions) -
  when they help and when they hurt
- [Visual snapshot testing](testing-views.md#visual-snapshot-testing) -
  capturing and comparing rendered output
- [Visual tests](visual-tests.md) - posing views, advancing time, and
  keeping images the same
