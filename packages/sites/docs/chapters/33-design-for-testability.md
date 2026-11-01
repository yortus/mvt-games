# Design for Testability (DfT)

> Design each component so that a test can control everything it depends
> on, observe everything it does, and get the same result every time. In
> MVT this mostly comes from the principles before it: a component
> receives everything it depends on, time included, and its state can be
> read without changing it.

**Related:** [Why MVT](02-why-mvt.md) ·
[Rules](../appendices/a-mvt-on-one-page.md) ·
[Testing Models](15-testing-models.md) ·
[Dependency Inversion Principle (DIP)](29-dependency-inversion.md)

---

## The Principle

The *Design for testability* principle comes from electronics. A chip is
tested by driving its pins and checking what comes out, but most of its
circuits are buried deep inside, out of the test equipment's reach. So
chip designers build in ways to set the state inside (*controllability*)
and to read it (*observability*). Testing stops being a problem solved
after the design is done, and becomes something the design provides.

The idea carried over to software in the 1990s; Robert Binder's "Design for
Testability in Object-Oriented Systems" (1994) is an early statement of it.
A [component](../appendices/b-glossary.md) is testable when a test can:

- **Control it.** Supply everything it depends on, and bring it into any
  state the test needs.
- **Observe it.** Read what it did, through its public interface.
- **Repeat it.** Get the same result from the same inputs, every time.

Each of these is a property of the design, not of the tests. Skill at
writing tests can't make up for a component that reads the clock, hides
its state, or draws from a global random source.

## Symptoms

Code that wasn't designed to be tested shows it the first time someone
tries. Here is a spawner that sends a bigger wave of enemies every ten
seconds:

```ts
function createWaveSpawner(world: World) {
    let wave = 0;
    setInterval(() => {
        wave++;
        const size = 2 + wave + Math.floor(Math.random() * 3);
        for (let i = 0; i < size; i++) world.addEnemy(randomEdgePoint());
    }, 10_000);
}
```

Now try to test it:

- **Test that each wave is bigger than the last.** The test waits twenty
  real seconds. And a wave's size varies by up to two from run to run, so
  the second wave can be smaller than the first: the test fails by chance.
- **Test it without a game.** The spawner writes into a real `world`, so
  the test has to build one, with everything that a world depends on.
- **Check which wave it's on.** `wave` is private, so the test has to
  count enemies in the world and work backwards.
- **Watch a spawn bug in slow motion.** The interval runs at real speed,
  whatever the game does.

The same pattern across a game shows up as four symptoms:

- **Tests are slow.** They wait for real time, or build the whole game.
- **Tests are flaky.** They pass or fail by timing or by chance, so a
  failure gets ignored, and soon the tests do too.
- **Tests check internals.** When the component doesn't expose a result,
  tests reach inside, and break whenever the inside changes.
- **Tests don't get written.** When a test is this much trouble, people
  stop writing it.

## Applied to MVT: Control, Observe, Repeat

### Control: everything comes in from outside

An MVT model receives everything it depends on: other models and random
numbers as options, and time as `deltaMs`
([DIP](29-dependency-inversion.md)). So a test controls all of it. The
spawner, rewritten:

```ts
interface WaveSpawner {
    /** The waves started so far: 0 before the first. */
    readonly wave: number;
    /** How many enemies the latest wave brings. */
    readonly waveSize: number;
    update: (deltaMs: number) => void;
}

function createWaveSpawner(options: { random: () => number }): WaveSpawner {
    // ...
}
```

The test that was slow and flaky becomes:

```ts
it('makes each wave bigger than the one before', () => {
    const spawner = createWaveSpawner({ random: () => 0 });
    spawner.update(WAVE_INTERVAL_MS);
    const firstSize = spawner.waveSize;
    spawner.update(WAVE_INTERVAL_MS);
    expect(spawner.wave).toBe(2);
    expect(spawner.waveSize).toBeGreaterThan(firstSize);
});
```

Twenty seconds of game time pass at once, and the random part is fixed.
The test doesn't need a world either: the spawner exposes how big each
wave is, and the game model, its parent, adds the enemies.

Michael Feathers calls a place like this a *seam*: "a place where you can
alter behavior in your program without editing in that place". He wrote
about finding seams in code that doesn't have any. In MVT they are there
from the start: every option, every binding and every `deltaMs` is one.

Views work the same way. A leaf view reads everything it shows through its
[bindings](08-bindings.md), so a test poses it with fixed values. The
fruit machine's
[spin button test](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/fruit-machine/views/pixi/visual-tests/spin-button-view.test.tsx)
takes one image of the button in each of its modes (abridged):

```ts
for (const mode of ['spin', 'stop', 'disabled'] as const) {
    canvasTest(mode, () => SpinButtonView({ mode: () => mode, radius: BUTTON_RADIUS }));
}
```

### Observe: state is read, never disturbed

A test checks what a component did by reading its public state.
[CQS](28-command-query-separation.md) makes that safe: a query doesn't
change any state, so a test can read it any number of times, in any
order, without disturbing what it tests. And a test can read anything
that a model exposes for its views. The spawner's `wave` is the kind of
count that a view watches for a rise, as in Chapter 34's
[screen shake](34-using-the-principles.md#deciding-a-case-that-the-rules-don-t-cover).

A view's output is what it draws, or plays. Because `refresh()` is
idempotent ([V-idempotent](../appendices/a-mvt-on-one-page.md#view-rules)), refreshing
once more doesn't change the output. So a test refreshes the view once,
takes an image of it, and the image shows exactly what the game would
show at that moment. A
[visual test](17-visual-tests.md)
compares that image with an accepted one, and an audio test compares a
hash of a sound's samples with an accepted hash.

### Repeat: the same inputs produce the same result

A model's state depends only on what it was created with, the calls made
on it, and the time passed to it
([M-time](../appendices/a-mvt-on-one-page.md#model-rules)). It doesn't read a clock,
use a timer or draw on a hidden random source. So a test never needs a
margin for chance or timing, and a failure always means something
changed.

Two of the Arcade's games show how far this goes.
[Neon Monsoon](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/neon-monsoon/models/game-model.test.ts)'s
game model takes a seed, and one of its tests plays thirty seconds of the
real stage twice, steering, focusing and bombing to a script, and checks
that both games end with the same score, lives and positions. One of the
fruit machine's
[long runs](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/fruit-machine/models/compute-return.test.ts)
plays 50,000 spins from one seed, to check that the machine pays back what
its paytable says it should. As the test's own comment puts it: "They are
seeded, so they are slow, not flaky."

The same inputs include the same time steps. A model produces the same
outcomes at any step size up to the ticker's cap
([§](06-time-and-phases.md#steps-of-different-sizes)), but
not always exactly the same numbers. Two updates of 16 ms and one of
32 ms can round differently, or move a falling object a hair differently,
and over a long replay those hairs add up. So that a replay matches
exactly at any frame rate, Neon Monsoon runs its simulation in fixed
steps: each `update` runs as many whole steps as its
`deltaMs` covers, and carries the rest over to the next.

### Time control is the same property, seen from the ticker

To a model, a test's `update(16)` is the same as a frame of play: both
are one call with 16 ms. So a pause, slow motion or a single step doesn't
need any change to the model either, and the ticker can do any of them
([T-control](../appendices/a-mvt-on-one-page.md#ticker-rules)):

- **Pause.** The Arcade pauses an entry by leaving its models, and its
  views' update steps, out of the tick. Its views are still refreshed and
  drawn, so the frozen game stays on screen.
- **Slow motion and fast forward.** The
  [boids demo](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/boids/start/load.ts)
  has a time scale slider. Its session multiplies `deltaMs` by the
  slider's value before passing it on, and the flock model's code doesn't
  change.
- **Single step.** Call `update` once, with one frame's time. A debugging
  tool and a test do the same thing.
- **Replay.** The same seed, the recorded input and the same time steps
  play the same game again, so a bug seen once can be watched as often as
  it takes to find it.

The models don't need any code for these. The design that lets a test
control time lets the game control it too.

### Writing the test first

Test-driven development (TDD) is a practice: write a test that fails,
write just enough code to make it pass, tidy up, and repeat. Kent Beck
described it in *Test-Driven Development: By Example* (2002). TDD and DfT
are different things: DfT is a property of the design, and holds whether
the tests were written first or last. But TDD is the surest way to get it,
since code written to pass a test that already exists is testable from the
start.

Even without writing tests first, two questions catch most problems early:

- **Can you write a meaningful test in a few lines, with only a call to
  the factory as setup?** If not, the component is fetching a dependency
  that it should receive ([DIP](29-dependency-inversion.md)), or doing
  too much
  ([SoC](26-separation-of-concerns.md)).
- **Can you write it from the interface and its documentation alone,
  without reading the implementation?** If not, the contract is
  incomplete: something that the test depends on is written only in the
  code
  ([DbC](31-design-by-contract.md)).

The contract also says what to test. Each requirement and each guarantee
is a test case; anything that the contract doesn't guarantee is an
internal
detail, free to change, and not something a test should pin down.

## Practical Benefits

- **Refactoring is safe.** Tests that check the contract keep passing
  while the internals change, and fail as soon as a guarantee is broken.
  So
  you can rework a component's insides with confidence, which is the
  [goal](25-the-principles-behind-mvt.md#the-goal) all eight
  principles serve.
- **Tests are fast.** Models run without a renderer, and game time passes
  as fast as the code runs.
- **Tests aren't flaky.** The same inputs produce the same result, so a
  failing test always means something changed.
- **Stand-ins are trivial.** A random source is `() => 0.5`; a stand-in
  binding is `() => 1230`. You don't need a library of test doubles, or
  patched globals.
- **Bugs can be replayed.** A seed and the recorded input play the game
  that showed the bug again, as many times as it takes.
- **Time control comes with the design.** Pause, slow motion,
  single-stepping and replays don't need any support from the models.

## Practical Drawbacks

- **Every dependency has to be passed in.** A seed, a random source and
  the time each need an option, which means more options and more wiring
  than reading a global. This is
  [DIP](29-dependency-inversion.md#practical-drawbacks)'s drawback,
  showing up here.
- **Determinism takes discipline.** One `Math.random()` in a model breaks
  it, silently, until a replay goes wrong. Lint keeps clocks and timers
  out of model files; a stray random call is still easy to miss.
- **Exact replays can depend on the platform.** JavaScript lets each
  engine approximate functions such as `Math.sin` in its own way, so a
  replay recorded in one browser can drift in another.
- **Fixed steps have a drawback.** On a slow device, a fixed-step game
  can't run every step that its `deltaMs` covers without falling further
  behind. Neon
  Monsoon runs at most four steps per update and drops the rest, so the
  game slows down rather than jumps.
- **Images need a person to review them.** A visual test fails on any
  change, wanted or not, and someone has to look at each new image and
  accept it.

## Common Misreadings

- **Not "write the tests first".** That's TDD, a practice. DfT is a
  property of the design, and a design can have it either way.
- **Not "test everything".** Testability makes a test quick to write
  when it's worth writing. Trivial accessors and a library's own
  behaviour usually aren't
  ([Testing Models](15-testing-models.md)).
- **Not "add hooks for tests".** A method or a field that exists only so a
  test can reach it widens the interface for the test alone. If a test
  needs to read something, ask whether the game reads it too. Usually the
  answer is a query that the component should have had anyway, or a
  smaller component.
- **Not "mock everything".** MVT tests rarely need a mocking library.
  Dependencies are plain values and small functions, and a model's
  children are
  real, [built by the parent](29-dependency-inversion.md#building-its-own-children).
  A test of the parent tests them together, through the parent's
  interface.

## Checklist

Questions to ask of a design, or in a review:

- Can a test build this component from plain values and small functions,
  without a game around it?
- Does anything it depends on arrive some other way than its options, its
  bindings or `deltaMs`: a clock, a timer, `Math.random()`, a global?
- Can a test read everything that the component guarantees, through its
  public interface?
- Does the same test produce the same result every time, without a margin
  for chance or timing?
- Could you write its tests from its interface and documentation alone?
- Would pausing, slowing or single-stepping the ticker work without any
  change to this component?

## Rules Built on DfT

| Rule | How it follows |
| --- | --- |
| [M-time](../appendices/a-mvt-on-one-page.md#model-rules) | Time is an input, so a test chooses how much passes, and the same steps produce the same result |
| [M-isolation](../appendices/a-mvt-on-one-page.md#model-rules) | A model doesn't need a view, a renderer or a ticker, so a test can build it alone |
| [V-idempotent](../appendices/a-mvt-on-one-page.md#view-rules) | One refresh draws exactly what the game would show, however many came before, so an image can be taken at any moment |
| [T-control](../appendices/a-mvt-on-one-page.md#ticker-rules) | A model's code is the same under a paused, slowed or stepped ticker as in play, just as it's the same under a test |

## Further Reading

- Robert V. Binder,
  ["Design for Testability in Object-Oriented Systems"](https://doi.org/10.1145/182987.184077),
  *Communications of the ACM* 37(9) (1994). Brings the idea from hardware
  to object-oriented software.
- Kent Beck, *Test-Driven Development: By Example* (Addison-Wesley, 2002).
  The practice, worked through from the first test.
- Michael Feathers, *Working Effectively with Legacy Code* (Prentice Hall,
  2004). Seams, and how to add them to code that was never designed to be
  tested. An excerpt,
  ["Testing Effectively With Legacy Code"](https://www.informit.com/articles/article.aspx?p=359417&seqNum=2),
  defines the seam.
- This book's chapters on testing,
  [Testing Models](15-testing-models.md),
  [Testing Views](16-testing-views.md) and
  [Visual Tests](17-visual-tests.md): how MVT's models and
  views are tested in practice.
