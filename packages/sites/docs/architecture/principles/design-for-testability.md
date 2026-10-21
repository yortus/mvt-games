# Design for Testability (DfT)

> Design each component so that a test can control everything it depends
> on, see everything it does, and get the same result every time. In MVT
> this mostly comes from the principles before it: a component is given
> what it needs, time included, and its state can be read without changing
> it.

**Previous:** [Make Illegal States Unrepresentable (MISU)](illegal-states-unrepresentable.md)

**Related:** [Architecture Overview](../index.md) ·
[Rules](../rules.md) ·
[Testing](../../building-with-mvt/iterating-with-confidence/testing.md) ·
[Dependency Inversion Principle (DIP)](dependency-inversion.md)

**Note:** Examples are in TypeScript; see [why](index.md#examples-are-in-typescript).

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
A [component](../../reference/glossary.md) is testable when a test can:

- **Control it.** Supply everything it depends on, and bring it into any
  state the test needs.
- **Observe it.** See what it did, through its public interface.
- **Repeat it.** Get the same result from the same inputs, every time.

Each of these is a property of the design, not of the tests. No skill at
writing tests makes up for a component that reads the clock, hides its
state, or draws from a global random source.

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
  the test has to build one, with everything a world needs.
- **Check which wave it's on.** It can't. `wave` is private, so the test
  has to count enemies in the world and work backwards.
- **Watch a spawn bug in slow motion.** The interval runs at real speed,
  whatever the game does.

The same pattern across a game shows up as four symptoms:

- **Tests are slow.** They wait for real time, or build the whole game.
- **Tests are flaky.** They pass or fail by timing or by chance, so a
  failure gets ignored, and soon the tests do too.
- **Tests check internals.** With no public way to see a result, tests
  reach inside, and break whenever the inside changes.
- **Tests don't get written.** When a test is this much trouble, nobody
  writes it.

## Applied to MVT: Control, Observe, Repeat

### Control: everything comes in from outside

An MVT model is given what it needs: other models and random numbers as
options, and time as `deltaMs`
([DIP](dependency-inversion.md)). So a test controls all of it. The
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
No world is needed either: the spawner says how big each wave is, and the
game model, its parent, adds the enemies.

Michael Feathers calls a place like this a *seam*: "a place where you can
alter behavior in your program without editing in that place". He wrote
about finding seams in code that has none. In MVT they are there from the
start: every option, every binding and every `deltaMs` is one.

Views work the same way. A leaf view reads everything it shows through its
[bindings](../bindings.md), so a test poses it with fixed values. The
fruit machine's
[spin button test](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/views/pixi/visual-tests/spin-button-view.test.tsx)
takes one image of the button in each of its modes (abridged):

```ts
for (const mode of ['spin', 'stop', 'disabled'] as const) {
    canvasTest(mode, () => SpinButtonView({ mode: () => mode, radius: BUTTON_RADIUS }));
}
```

### Observe: state is read, never disturbed

A test checks what a component did by reading its public state.
[CQS](command-query-separation.md) makes that safe: a query changes
nothing, so a test can read as often as it likes, in any order, without
disturbing what it tests. And what a model exposes for its views, a test
can read too. The spawner's `wave` is the kind of count a view watches for
a rise, as in the overview's
[screen shake](index.md#deciding-a-case-no-rule-covers).

A view's output is what it draws, or plays. Because `refresh()` is
idempotent ([V-idempotent](../rules.md#view-rules)), refreshing once more
changes nothing. So a test refreshes the view once, takes an image of it,
and the image shows exactly what the game would show at that moment. A
[visual test](../../building-with-mvt/iterating-with-confidence/visual-tests.md)
compares that image with an accepted one, and an audio test compares a
hash of a sound's samples with an accepted hash.

### Repeat: the same inputs give the same result

A model's state depends only on what it was created with, the calls made
on it, and the time given to it ([M-time](../rules.md#model-rules)). No
clock, no timer, no hidden random source. So a test never needs a margin
for chance or timing, and a failure always means something changed.

Two of the Arcade's games show how far this goes.
[Neon Monsoon](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/neon-monsoon/models/game-model.test.ts)'s
game model takes a seed, and one of its tests plays thirty seconds of the
real stage twice, steering, focusing and bombing to a script, and checks
that both games end with the same score, lives and positions. One of the
fruit machine's
[long runs](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/models/compute-return.test.ts)
plays 50,000 spins from one seed, to check that the machine pays back what
its paytable says it should. As the test's own comment puts it: "They are
seeded, so they are slow, not flaky."

The same inputs include the same time steps. Two updates of 16 ms and one
of 32 ms can end in different states, unless the model is
[leap-safe](../../building-with-mvt/iterating-with-confidence/testing-models.md#advancing-time).
So that a replay matches at any frame rate, Neon Monsoon runs its
simulation in fixed steps: each `update` runs as many whole steps as its
`deltaMs` covers, and carries the rest over to the next.

### Time control is the same property, seen from the ticker

A model can't tell a test's `update(1000)` from a second of play. So it
can't tell a pause, slow motion or a single step from play either, and the
ticker is free to do any of them ([T-control](../rules.md#ticker-rules)):

- **Pause.** The Arcade pauses an entry by leaving its models, and its
  views' update steps, out of the tick. Its views are still refreshed and
  drawn, so the game shows frozen.
- **Slow motion and fast forward.** The
  [boids demo](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/boids/start/load.ts)
  has a time scale slider. Its session multiplies `deltaMs` by the
  slider's value before passing it on, and the flock model never knows.
- **Single step.** Call `update` once, with one frame's time. A debugging
  tool and a test do the same thing.
- **Replay.** The same seed, the recorded input and the same time steps
  play the same game again, so a bug seen once can be watched as often as
  it takes to find it.

None of these needs anything from the models. The design that lets a test
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

- **Can you write a meaningful test in a few lines, with no setup beyond
  calling the factory?** If not, the component is reaching for something
  it should be given ([DIP](dependency-inversion.md)), or doing too much
  ([SoC](separation-of-concerns.md)).
- **Can you write it from the interface and its documentation alone,
  without reading the implementation?** If not, the contract is
  incomplete: something the test needs to know is only in the code
  ([DbC](design-by-contract.md)).

The contract also says what to test. Each requirement and each guarantee
is a test case; anything the contract doesn't promise is an internal
detail, free to change, and not something a test should pin down.

## Practical Benefits

- **Refactoring is safe.** Tests that check the contract keep passing
  while the internals change, and fail as soon as a promise is broken. So
  you can rework a component's insides with confidence, which is the
  [goal](index.md#the-goal) all eight principles serve.
- **Tests are fast.** Models run without a renderer, and game time passes
  as fast as the code runs.
- **Tests aren't flaky.** The same inputs give the same result, so a
  failing test always means something changed.
- **Fakes are trivial.** A random source is `() => 0.5`; a binding is
  `() => 1230`. No mocking library, no patched globals.
- **Bugs can be replayed.** A seed and the recorded input play the game
  that showed the bug again, as many times as it takes.
- **Time control comes free.** Pause, slow motion, single-stepping and
  replays need no support from the models.

## Practical Costs

- **Every dependency has to be passed in.** A seed, a random source, the
  time: more options and more wiring than reaching for a global. This is
  [DIP](dependency-inversion.md#practical-costs)'s cost, paid here.
- **Determinism takes discipline.** One `Math.random()` in a model breaks
  it, silently, until a replay goes wrong. Lint keeps clocks and timers
  out of model files; a stray random call is still easy to miss.
- **Exact replays can depend on the platform.** JavaScript lets each
  engine approximate functions such as `Math.sin` in its own way, so a
  replay recorded in one browser can drift in another.
- **Fixed steps have a cost.** On a slow device, a fixed-step game
  can't run every step it owes without falling further behind. Neon
  Monsoon runs at most four steps per update and drops the rest, so the
  game slows down rather than jumps.
- **Images need a person.** A visual test fails on any change, wanted or
  not, and someone has to look at each new image and accept it.

## Common Misreadings

- **Not "write the tests first".** That's TDD, a practice. DfT is a
  property of the design, and a design can have it either way.
- **Not "test everything".** Testability makes a test cheap when it's worth
  writing. Trivial accessors and a library's own behaviour usually aren't
  ([what not to test](../../building-with-mvt/iterating-with-confidence/testing-models.md#what-not-to-test)).
- **Not "add hooks for tests".** A method or a field that exists only so a
  test can reach it widens the interface for the test alone. If a test
  needs to see something, ask whether the game needs it too. Usually the
  answer is a query the component should have had anyway, or a smaller
  component.
- **Not "mock everything".** MVT tests rarely need a mocking library.
  Needs are plain values and small functions, and a model's children are
  real, [built by the parent](dependency-inversion.md#building-its-own-children).
  A test of the parent tests them together, through the parent's
  interface.

## Checklist

Questions to ask of a design, or in a review:

- Can a test build this component from plain values and small functions,
  with no game around it?
- Does anything it depends on arrive some other way than its options, its
  bindings or `deltaMs`: a clock, a timer, `Math.random()`, a global?
- Can a test see everything the component promises through its public
  interface?
- Does the same test give the same result every time, with no margin for
  chance or timing?
- Could you write its tests from its interface and documentation alone?
- Would pausing, slowing or single-stepping the ticker work with no change
  to this component?

## Rules It Underpins

| Rule | How it follows |
| --- | --- |
| [M-time](../rules.md#model-rules) | Time is an input, so a test chooses how much passes, and the same steps give the same result |
| [M-isolation](../rules.md#model-rules) | A model needs no view, renderer or ticker, so a test can build it alone |
| [V-idempotent](../rules.md#view-rules) | One refresh draws exactly what the game would show, however many came before, so an image can be taken at any moment |
| [T-control](../rules.md#ticker-rules) | Models can't tell a paused, slowed or stepped ticker from play, just as they can't tell a test from play |

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
- This guide's
  [Testing](../../building-with-mvt/iterating-with-confidence/testing.md)
  pages: how MVT's models and views are tested in practice.

---

**Back to:** [The Principles Behind MVT](index.md)
