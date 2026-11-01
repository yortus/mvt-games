# Testing Models

> A model test builds a model, does something to it, and checks its
> public state. It doesn't need a screen, a browser or real time, so it
> runs in a millisecond and produces the same result every time. This chapter
> shows the pattern, how to move time forward safely with `advanceTime`,
> and how to keep model tests about what the game does rather than how the
> code happens to do it.

**Related:** [Models](04-models.md) ·
[Time and Phases](06-time-and-phases.md) ·
[Testing Views](16-testing-views.md) ·
[Design for Testability (DfT)](33-design-for-testability.md)

Here is a countdown timer, and a test of it:

```ts
import { advanceTime } from '@mvtjs/utils';
import { describe, expect, it } from 'vitest';
import { createTimerModel } from './timer-model';

describe('TimerModel', () => {
    it('counts down, and expires at zero', async () => {
        const timer = createTimerModel({ durationMs: 3000 });

        await advanceTime(1000, timer);
        expect(timer.remainingMs).toBe(2000);
        expect(timer.isExpired).toBe(false);

        await advanceTime(2000, timer);
        expect(timer.remainingMs).toBe(0);
        expect(timer.isExpired).toBe(true);
    });
});
```

Three seconds of game time pass in two lines. `advanceTime` calls the
timer's `update` in small steps, as a game would, and
[§](#advancing-time) shows how it works. The test doesn't wait or draw
anything, and it can't pass on one run and fail on the next. That isn't
luck, and it isn't a clever test. It follows from how the
model was built.

## Why Models Are Easy to Test

A design principle called Design for Testability (DfT) sums up what a
test needs as one question: how would I test this, without anything real
around it? For an MVT model the answer comes in three parts.

- **You can control it.** Everything the model needs arrives through its
  options, its actions and `deltaMs`. The test supplies all of it.
- **You can observe it.** The model's state is public, and reading it
  doesn't change anything, so a test can read it any number of times.
- **You can repeat it.** The same options, calls and time steps always
  produce the same state. The model doesn't use a clock, a timer or a
  hidden random source that could vary.

The timer test uses all three. It chooses the duration, it chooses how much
time passes, and it reads `remainingMs` any number of times. This chapter
is about using them. The book's last part comes back to why they matter,
and how the rest of MVT's design provides them, in the
[DfT chapter](33-design-for-testability.md).

## Choosing How and Where to Test Each Part

Each part of an MVT game is tested in its own way. This chapter covers the
first row, and the others have their own homes.

| Under test | How | Where |
| --- | --- | --- |
| A model | Act on it, then assert its state | This chapter |
| What a view does, such as reporting a press | Stand-in bindings, a refresh, then assertions | [Chapter 16](16-testing-views.md) |
| How a view looks | An image, compared with a reference image | [Chapter 17](17-visual-tests.md) |
| A view that plays sound | A stand-in chip that records each sound | [Chapter 20](20-sound-and-music.md) |

Later, [Chapter 18](18-growing-a-complex-view.md) moves a complex view's
presentation logic into a plain object of its own, a view model. It has
state, an `update(deltaMs)` that advances it, and it doesn't draw
anything, so it gets the same tests as a model. Everything below applies
to it unchanged.

::: info In this book
Every test runs on [Vitest](https://vitest.dev/). Model tests are ordinary
unit tests that run in Node, with no browser. The examples use Vitest's
`describe`, `it` and `expect`, but any test runner works the same way.
:::

## Create, Act, Assert

Every model test has the same three steps.

1. **Create** the model, with the options that the test needs.
2. **Act** on it: call its actions, and let time pass, with
   `update(deltaMs)` or `advanceTime`.
3. **Assert** what its public state now holds.

The timer test does them twice over, acting and asserting in turn. That's
fine. The important thing is that each assertion reads public state,
after the test has set up exactly what happened before it.

Notice what the test doesn't do. It doesn't reach into the model's
variables, wait for a real timer, or check how the countdown is stored. It
checks what the model's interface guarantees. If you later rewrite the
timer, its tests should still pass, as long as it still meets that
guarantee.

## Advancing Time

Time reaches a model only through `update(deltaMs)`, so a test chooses
exactly how much passes. Let it pass the way it could in a game: in steps
no bigger than the ticker's cap, typically 100 ms
([§](05-the-tick.md#the-delta-cap)). A model guarantees the same results
at any step size up to the cap, as
[§](06-time-and-phases.md#steps-of-different-sizes) explains, and doesn't
guarantee anything about a bigger step. A test that keeps to the cap
relies only on that guarantee. So you never need to look inside a model
to check whether a test's steps are fair.

### Steps no bigger than the cap

You could write the steps out yourself, each one a step that a game could
produce:

```ts
const timer = createTimerModel({ durationMs: 3000 });
for (let i = 0; i < 30; i++) timer.update(100);
expect(timer.isExpired).toBe(true);
```

Why not one call with 3000 ms? This timer would handle it, since it only
subtracts `deltaMs` and stops at zero. But you'd have to read its code to
know that, and a later change could make it untrue without breaking any
guarantee. Plenty of models can't handle a step that big:

- A model with phases might change phase partway through a step, and only
  start the new phase's work on the next one. That's fine at any step up
  to the cap, as long as every phase lasts longer than the cap.
- A model that starts each move only after the previous one has
  finished must detect, in an update, that the previous move finished.

Give such a model one huge step, and it can skip what should have happened
in between. A swap that should have finished and then matched might never
match at all.

### Moving time on with `advanceTime`

`advanceTime` runs that loop for you, and does a little more. Its steps
are 16 ms, a frame at 60 frames a second, which is well under any cap.
Here is `advanceTime` in a test like one that you might write for the
board in Kwazy Cactii, one of the arcade's games:

```ts
it('swaps back, and settles, when a swap makes no match', async () => {
    const board = createBoardModel({ startKinds: NO_MATCH_AFTER_SWAP });
    board.trySwap(board.cells[0][0], board.cells[0][1]);

    await advanceTime(3 * SWAP_DURATION_MS, board);

    expect(board.phase).toBe('idle');
});
```

The board swaps two cactii, doesn't find a match, swaps them back, and
comes to rest. Each of those is a phase, and each starts only after the
model has detected the end of the one before it.

[§](#try-big-step-skips-a-phase) runs that test on two boards side by
side, over and over, slowly enough to watch. The left board is moved on in
16 ms steps, as `advanceTime` does, and settles. The right board receives
the same time in one step of 1200 ms, far bigger than any step that a game
would pass it. The board model ends at most one phase in each update.
That's all a step up to the cap ever needs, since every phase lasts longer
than the cap. The big step ends the first phase and only that phase, so
the right board's check fails. The board isn't at fault: the test relied
on something that models never guarantee. Press View code, and in
`main.ts` set `BIG_STEP_MS` to 100, the cap. Both boards pass.

<TryIt example="big-step-skips-a-phase" file="main.ts" />

`advanceTime(ms, ...items)` moves time on by `ms` milliseconds, in steps
of 16 ms, the way the ticker does. In each step, it calls `update` on
each model, in the order you passed them. Then it waits for a microtask,
which lets any `await` inside a model move on. It can move views on too,
and [Chapter 17](17-visual-tests.md) uses it to pose one. The ticker
updates the models before the views, so `advanceTime` does too, whatever
order you pass them in. It doesn't refresh any views.

::: info In this book
`advanceTime` comes from `@mvtjs/utils`, and each renderer package, such
as `@mvtjs/pixi`, exports it too. It throws if you pass it something that
isn't a view and doesn't have an `update` method, so a typo can't make a test
silently skip time.
:::

Why wait for a microtask after each step? Most models never `await`
anything, and for them the wait doesn't have any effect. But a model may
use GSAP, or an `await`, inside its own update, in the narrow way that
[Appendix E](../appendices/e-timelines-with-gsap.md) describes. Work that
follows an `await` doesn't run until the code that's running now returns.
A plain loop of `update` calls never returns between steps, so that work
would all pile up until the loop ended. Waiting after each step lets each
tick start from a settled model, just as it would in the game. The
waiting doesn't use a real timer, so the test stays exactly repeatable.

Because it waits, `advanceTime` returns a `Promise`. Always `await` it, and
mark the test `async`.

Use `advanceTime` whenever a test needs more time than one step. Every
step it takes is one that a game could produce, so the test relies only
on what the model guarantees, and it keeps passing when the model's
insides change.

## A Helper That Fills In Defaults

A real model often needs several options, and a test that spells them all
out buries the one that matters. Burrow Bust's
[digger](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/burrow-bust/models/digger-model.test.ts)
needs a start position, a speed, the field's size and two functions that
describe the field. Its tests build it through a small helper, much like
this one, at the foot of the test file:

```ts
function createDigger(options: Partial<DiggerModelOptions> = {}) {
    return createDiggerModel({
        startRow: 1,
        startCol: START_COL,
        speed: SPEED,
        fieldRows: FIELD,
        fieldCols: FIELD,
        isWalkable: () => true,
        isDirt: () => false,
        ...options,
    });
}
```

A test then names only what it's about:

```ts
it('stops at a wall', () => {
    const digger = createDigger({ isWalkable: (_row, col) => col < 3 });
    digger.setDirection('right');
    for (let i = 0; i < 120; i++) digger.update(16);
    expect(digger.col).toBe(2);
});
```

The defaults still build the model, but the reader no longer has to look
past them. Keep the helper in the test file that uses it. A helper shared
between test files tends to grow options for every one of them, until it's
as hard to read as what it replaced.

The two functions in the defaults are worth a second look. In the game,
the digger calls a function that queries the field model for whether a
tile can be walked on. The test passes `() => true` instead: a one-line
stand-in for the whole field model. A model depends only on plain values
and small functions, so a stand-in is one line, and you rarely need a
library of test doubles. The same goes for random numbers. A model that
receives its random source as an option, such as `random: () => 0`,
behaves the same way in every run.

[§](#try-digger-stand-ins) runs the wall test over and over, slowly enough
to watch. The field is drawn from the test's stand-in, `isWalkable`, which
is the digger's only source of information about the field. Press View
code, and in `main.ts` change `col < 3` to `col < 6`. The wall moves, the
digger stops further on, and the test's check fails.

<TryIt example="digger-stand-ins" file="main.ts" />

## Testing Composed Models

A game is a tree of models, as [Chapter 4](04-models.md) showed. The
children each do one thing. The parent updates them, then handles what
spans them: collisions, scoring, the change from one phase to the next.
Test at both levels.

- **A child's tests** check its own behaviour, with stand-ins for
  whatever it reads through its options. The digger tests above are this kind.
- **The parent's tests** check what happens when its children meet: a
  harpoon reaches an enemy, a rock falls on the digger, the last enemy
  leaves and the level ends.

```ts
it('scores when the harpoon pops an enemy', async () => {
    const game = createGameModel({ ...OPTIONS, levels: [ENEMY_AHEAD] });
    game.isHarpoonOut = true;
    for (let i = 0; i < PUMPS_TO_POP; i++) {
        game.pump();
        await advanceTime(PUMP_GAP_MS, game);
    }
    expect(game.score).toBe(POP_SCORE);
});
```

A parent's test sets up a scene, lets time pass and checks the result.
Assert what the parent exposes, such as its score or its phase, not what a
child holds inside it. The children in the test are real, built by the
parent as they would be in the game, so the test covers them working
together. If you later move a rule from one child to another, a test that
checks the parent's state still passes.

## Tests Not Worth Writing

A test is worth writing when it would catch a change that you didn't mean
to make. Some tests catch only changes that you did mean to make, and
those take more effort to maintain than they save.

- **Implementation details.** Don't test a model's private variables, or
  whether it uses a GSAP timeline or plain arithmetic inside. If it
  changes from one to the other and still meets its guarantees, every
  test should still pass.
- **A library's own behaviour.** Don't test that a GSAP tween eases
  correctly, or that a sort sorts. The library has its own tests.
- **Construction alone.** A test that builds a model and checks that a
  property equals the option that it received tests the language, not the
  model. Test what the model does with it.
- **Exact timing of the steps in between.** Prefer "after the swap's
  duration, the board has moved on" to "at 199 ms it is swapping, and at
  201 ms it is matching". A test pinned to an exact millisecond breaks
  each time someone tunes a duration.

## Assertion Patterns

Use `toBeCloseTo` for any value that comes from adding up fractions. A
speed is often given in units per second, so each 16 ms step moves a
position on by a fraction, such as 0.08 of a tile. Added up over many
steps, those fractions add up to a number that is close to the one you
expect, but rarely equal to it.

Work out expected values from the model's own constants, rather than
copying the numbers into the test. `expect(game.score).toBe(POP_SCORE)`
still passes when someone changes what a pop is worth.
`expect(game.score).toBe(200)` fails, though the model is still correct.

## Common Mistakes

### A test that passes with the model barely moved

The test fails, or worse, passes, though the model has hardly moved. It
calls `advanceTime` without `await`, so the test carries on as soon as
the first step has run, and only 16 ms has passed when it asserts.
`await` every call, and mark the test `async`.

### A phase the test never reaches

A phase the model should have reached is never reached, or an action that
should have happened is skipped. The test moved the model on with one
`update` bigger than the ticker's cap, such as a whole second at once.
Models don't guarantee anything about a step that big, and this one
needed an update at a moment in between. Use `advanceTime`, or a loop of
steps no bigger than the cap.

### A position that's off by a hair

A position test fails with `expected 2.0000000000000004 to be 2`.
Fractions added up over many steps pick up tiny rounding errors, so an
exact comparison fails. Use `toBeCloseTo`.

### A parent's test that breaks when a rule moves

The test breaks when a rule moves from one child model to another, though
the game plays the same. It was reaching into a child, so it checked how
the parent is built, not what it does. Assert what the parent exposes
instead.

## Summary

A model test creates a model, acts on it and asserts its public state. It
can do that because MVT models are easy to control, observe and repeat:
everything they need comes in from outside, their state can be read
without changing it, and the same inputs always produce the same result.

Time passes only when a test calls `update`. Give a model time as a game
could, in steps no bigger than the ticker's cap, since a model's guarantee
covers only those steps. `advanceTime` does that for you, in 16 ms steps,
letting any `await` inside the model settle after each step. Always
`await` it.

Keep each test about one behaviour. A helper with defaults hides the
options that don't matter, and stand-ins for a model's options are plain
values and one-line functions. Test children alone and parents through
their own state. Leave out tests that only check how the code is written,
and
work out expected values from the model's own constants.

## Further Reading

- Bill Wake, "3A: Arrange, Act, Assert" (2001). The three-step shape of a
  unit test, which this chapter calls create, act, assert.
- Gerard Meszaros, *xUnit Test Patterns* (2007). A catalogue of test
  shapes, including test helpers that hide construction and the stand-ins
  that it calls test doubles.
