# Skill: Writing MVT Models

> Load before writing or changing anything under a `models/` directory, or
> a `*-model.ts` file. What a model is, and why, is taught in the book,
> mostly in [Chapter 4, Models](../chapters/04-models.md) and
> [Chapter 6, Time and Phases](../chapters/06-time-and-phases.md). This
> file is the checklist, the lint rules, and what must pass before you
> hand over.

---

## Before You Write

Read the sections you need, by anchor:

| Topic | Read |
| --- | --- |
| The `update(deltaMs)` contract | [Chapter 4](../chapters/04-models.md#the-update-deltams-contract) |
| What belongs in a model, and what stays out | [Chapter 4](../chapters/04-models.md#splitting-concerns-between-model-and-view), [and out](../chapters/04-models.md#things-to-keep-out-of-a-model) |
| Domain coordinates, not pixels | [Chapter 4](../chapters/04-models.md#domain-coordinates) |
| The factory, its interface and options | [Chapter 4](../chapters/04-models.md#writing-a-model-as-a-factory), [Code Style](../working-in-this-repo/code-style.md#factory-functions) |
| Input: what the player means, not the control | [Chapter 4](../chapters/04-models.md#actions-say-what-the-player-means) |
| Counts for moments that repeat (`shotsFired`) | [Chapter 4](../chapters/04-models.md#state-that-views-can-notice), [Chapter 9](../chapters/09-noticing-changes.md#counts-moments-that-repeat) |
| Parents and children, and collections | [Chapter 4](../chapters/04-models.md#trees-of-models), [collections](../chapters/04-models.md#collections-of-models) |
| Advance, then orchestrate | [Chapter 6](../chapters/06-time-and-phases.md#advance-then-orchestrate) |
| Phases and a single progress value | [Chapter 6](../chapters/06-time-and-phases.md#phases-and-progress) |
| Steps of any size up to the ticker's cap, carrying leftover time | [Chapter 6](../chapters/06-time-and-phases.md#steps-of-different-sizes) |
| Watching a sub-model inside `update` | [Chapter 9](../chapters/09-noticing-changes.md#where-to-poll-for-changes) |
| Paused GSAP timelines in a model | [Appendix E](../appendices/e-timelines-with-gsap.md) |
| Hot paths in `update` | [Chapter 24](../chapters/24-hot-paths.md#the-hot-path-rules) |
| Testing a model, `advanceTime` | [Chapter 15](../chapters/15-testing-models.md#advancing-time) |
| Every model rule (M-time, M-isolation, M-domain, M-composition) | [Appendix A](../appendices/a-mvt-on-one-page.md#model-rules) |

## Checklist

- Time arrives only as `deltaMs`. No `setTimeout`, `setInterval`,
  `requestAnimationFrame`, `Date.now()`, `performance.now()`, or a GSAP
  tween or timeline that isn't paused.
- No module-level `let`: every model that the file creates would share it. State
  lives in the factory's closure.
- No import of a view, a renderer or the ticker.
- Positions in domain units (`row`, `col`, world units), never pixels.
  Named phases, never colours or textures.
- Input as state for a control held (`isThrusting`) or an action for a
  one-off command (`startNewRun()`), never a control's name.
- A moment that can repeat without a change of state is a count, reset for
  a new game, plus the details of the last occurrence if a sound needs them.
  Models don't emit events or play sounds.
- A parent updates its children first, then does what spans them
  (collisions, phase changes). Sequencing lives in `schedule*()` helpers.
- The model produces the same results at any step size up to the
  ticker's cap (typically 100 ms). A timer or phase that ends partway
  through a step carries the time left over into what comes next, in a
  `while` loop.
  Collisions are checked along the way, not only at the end of a step,
  and everything that came due during a step happens.
- The file follows [Code Organisation](../working-in-this-repo/code-style.md#code-organisation),
  and exports the interface, options, factory and the domain types that
  its interface uses, and only those.
- No per-tick allocations in `update` (index loops, numeric keys).

## Lint

ESLint runs the first three on `models/` directories and `*-model.ts`
files in the sites, and the last row on every file:

| Rule | Reports |
| --- | --- |
| `@mvtjs/no-wall-clock` | Timers, clock reads and auto-playing tweens |
| `@mvtjs/no-module-state` | Module-level `let` |
| `@mvtjs/no-control-names` | Members named for a control (`firePressed`, `swipeCount`) |
| `@mvtjs/no-conditional-poll`, `no-repeated-poll`, `no-unused-watch`, `no-inline-watch` | A watcher or reaction called behind a condition, twice in a step, never, or made and used in one expression |

## Before You Hand Over

- A test beside the model (`xxx-model.test.ts`), creating it, acting
  through its public API, and asserting on its state. Expected values come
  from the model's own constants, not copied numbers. Move time on in
  steps no bigger than the ticker's cap, with `advanceTime`, never one
  big `update`.
- `npm run lint`, `npx tsc -b` and `npm run test:unit` pass.
- Load the `code-style` skill's checklist too.
