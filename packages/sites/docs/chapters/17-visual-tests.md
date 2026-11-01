# Visual Tests

> A visual test checks what a view looks like. It arranges the view in a
> known state, takes an image of it, and compares that image with an
> accepted one, its reference image. MVT's rules make these tests quick
> to write and dependable: a view shows only the values that its bindings
> return, and time moves only when something calls `update`. So the same
> test draws the same image on every run, whether it tests one button or a
> whole game's screen.

**Related:** [Testing Views](16-testing-views.md) ·
[Testing Models](15-testing-models.md) ·
[Bindings](08-bindings.md) ·
[Presentation State](11-presentation-state.md)

Here is a visual test, shortened a little from the fruit machine's
[own](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/fruit-machine/views/pixi/visual-tests/spin-button-view.test.tsx).
It takes three images of the machine's spin button, one in each of its
modes:

```tsx
const MODES: readonly SpinButtonMode[] = ['spin', 'stop', 'disabled'];

for (const mode of MODES) {
    canvasTest(mode, () => SpinButtonView({
        mode: () => mode,
        radius: BUTTON_RADIUS,
    }));
}
```

Each test builds the view with stand-in bindings and returns it. The test
tool refreshes the view once, draws it, and compares the image with the
reference image accepted last time. The test doesn't need a game, a
model, any waiting or any setup beyond the view.
[Chapter 16](16-testing-views.md) explained why an image is often the best
check of a view. This chapter shows how to write image tests that stay
this short, and how to keep them from failing when the view hasn't
changed.

## Why MVT Views Suit Visual Tests

A visual test is only useful if the same view, in the same state, draws
the same image every time. Elsewhere that's often hard to arrange. In MVT,
the rules prevent most of the causes of a changing image, as
[Keeping Images the Same](#keeping-images-the-same) shows.

They also keep the test short. A view reads everything it shows through
its [bindings](08-bindings.md), so a test can arrange any state by passing
stand-in bindings, without setting up a game. And a view writes its output
in its refresh step, so one refresh before the image draws exactly what
the game would show at that moment.

So a visual test of an MVT view builds the view, perhaps lets some time
pass, and returns it. This chapter calls that **posing** the view:
arranging it in one state for its image.

::: info In this book
The examples use [v-snap](https://github.com/yortus/mvt-games/blob/main/packages/libraries/v-snap/README.md),
a visual testing tool that runs on Vitest. Each test has a name, and a
function, its pose, that returns the posed view. A view drawn on a canvas,
such as a Pixi or three.js view, is tested with `canvasTest`, and an HTML
view with `htmlTest`. The reference image is kept beside the test file.
The v-snap config for this book's examples runs `refreshView` on each
posed view before v-snap draws it, so that's the one refresh before the
image.

v-snap draws each image in a few milliseconds, and the same image on
every machine, because it draws text its own way rather than as a player
would see it. If the exact look of your words matters, a screenshot tool
such as Playwright's suits better, and the README covers the trade-offs.
:::

## Posing a View

A leaf view reads what it shows through its bindings. To pose it, pass
bindings that always return the same values, as the spin button test
does.

Which states are worth an image? Start with the ones that a player can
tell apart, such as each mode of a button. Values at the edges of what a view
must show are often worth one too: an empty meter, a full one, or the
longest number a counter must fit. These are suggestions, not a
checklist. Even a few tests catch a lot, and you can add more where a
view proves easy to break.

A top-level view is posed the same way, but its binding is its model,
which it reads once. To pose it, create the model and bring it into the
state you want through its public actions, as a player would. The next
section shows one.

## Advancing Time

Some views hold [presentation state](11-presentation-state.md), such as a
banner that counts up to a win, or a flash that fades. Such a view has an
update step, and how it looks depends on how much time has passed. To pose
it, move time on by a fixed amount with `advanceTime`.

```tsx
canvasTest('counting up, 300 ms in', async () => {
    let amount = 0;
    const view = WinBannerView({
        isShown: () => true,
        amount: () => amount,
        caption: () => CAPTION,
    });
    // The banner counts up from the amount it was built with.
    amount = WIN;
    await advanceTime(300, view);
    return view;
});
```

`advanceTime` moves the models and then the views on in steps of 16 ms,
without refreshing them, as
[Chapter 15](15-testing-models.md#advancing-time) explains. The test tool
refreshes the view once, just before it takes the image.

[§](#try-win-banner-poses) poses a banner like that one four times, as the
test poses it, at four moments in its count. Below them, the same banner
runs in a stand-in game, counting up again and again. A pose stays still
once it's taken. Press View code, and in `main.ts` change `POSE_MS` to
pose other moments.

<TryIt example="win-banner-poses" file="main.ts" />

A top-level view and its model move on together. This test, shortened
from Kwazy Cactii's, shows the game's board after a restart:

```tsx
canvasTest('after a restart', async () => {
    const model = createGameModel();
    // A sound chip that doesn't play through a speaker: an image is silent.
    const view = GameView({ model, sfx: createHeadlessAudio80() });
    await advanceTime(16, model, view);
    model.reset();
    await advanceTime(16, model, view);
    return view;
});
```

The view first shows the board that the game starts with, and then the
one that the restart deals. If the view kept showing the old board, this
image would match the test of the game's start, and someone reviewing it
would notice.

The board dealt depends on random numbers, and Kwazy Cactii's game model
doesn't take a random source of its own. Its board model does, but the game
model doesn't pass one on. So this test leans on the safety net that
[Keeping Images the Same](#keeping-images-the-same) describes: the test
tool seeds `Math.random` the same way before every test. A game model
that took a seeded `random` and passed it to its board wouldn't need
that net.

In [§](#try-seeded-boards), a board model that takes its random source
deals three boards. The first two receive the same seed, and the third
receives `Math.random`. Press Run, then Restart a few times. The seeded
boards deal the same cactii every time, and the third deals new ones.

<TryIt example="seeded-boards" file="main.ts" />

Pose the moments that matter in a transition: its start, a point partway
through, and its end. A view that never stops moving can still be tested
at any moment, because the view stays still between the pose and the
image.

### Testing a whole game's screen

A test of a game's top-level view is a test of its whole screen. It
catches problems that a single view's test misses, such as the layout, the
order in which views are drawn, or a view that its parent doesn't add.

But it also changes with almost any change to the game. So one or two for
each game are usually enough. A big screen can be cropped to the part
that the test is about. Smaller images are faster to compare, and their failures
are easier to read.

## The Limits of a Visual Test

A visual test checks how a view looks, and only that. Exact words and
numbers, a relay binding and the sounds a view plays are better checked
another way, as
[Chapter 16](16-testing-views.md#where-assertions-still-help) says.

## Keeping Images the Same

A test whose image changes from run to run is worse than a missing test.
It fails when the view hasn't changed, and soon people stop trusting it.
MVT's rules keep most of the causes out, and a few habits keep out the
rest.

- **A view doesn't hold domain state.** It doesn't have a hidden history,
  so one image for each state of its bindings covers it.
- **Models never read the clock.** A model that read the time of day, or
  timed itself with `setTimeout`, would be at a different moment in every
  run. Time reaches a model only through `update`, so the test decides
  it, and a whole game moved on by a set amount is always at the same
  moment. The models and views stay still between the pose and the image.
- **Models don't keep state outside themselves.** If they did, one test's
  model could change the next test's
  ([Chapter 4](04-models.md#models-that-share-state-through-the-module)).
- **Random numbers repeat.** A model that receives its random source, as
  [Dependency Inversion](29-dependency-inversion.md)
  advises, deals the same board whenever a test passes it the same seed.
  As a safety net, a test tool can also seed `Math.random` the same way
  before every test, as v-snap does, so code that still calls it repeats
  too. The safety net doesn't make that code right. It only keeps its
  images still.
- **Everything else is fixed too.** Give each test the same image size,
  and stand-in bindings that always return the same values. A binding
  that reads something that changes, such as a real model left running,
  produces an image that changes with it.
- **A test cleans up after itself.** Some tools, v-snap among them, run
  many tests in one page, for speed. There, a test that changes a
  library's defaults changes the images of the tests after it.

Keep one state in each image, too. An image that shows a button idle,
pressed and disabled side by side fails when any of the three changes,
and its failure doesn't say which.

## Reviewing a Change

A [reference image](../appendices/b-glossary.md) is the test's expected
result, so it lives beside the test and is committed with it. The first
time a test runs, the test doesn't have a reference yet. The tool writes
the test's image as the reference, and you look at it before you commit
it. That first look matters. Without it, a bug on the first run becomes
the expected result.

When a later change makes a view look different, its test fails. The
tool keeps the new image, called the
[actual image](../appendices/b-glossary.md), beside a diff that
marks the pixels that changed. Look at all three, and decide.

- **If you meant the change,** accept the actual image as the new
  reference, and commit it with the code that caused it. Whoever reviews
  your change then sees the old and new images side by side, and sees what
  your code did to the screen, not only how.
- **If you didn't mean it,** the test has found a bug. Fix the code, and
  leave the reference alone.

Accepting new images without looking defeats the purpose. A test that
fails and is updated without a look doesn't check anything, and it's
worse than a missing test, because it looks like a check.

::: info In this book
v-snap writes a failed test's actual image and diff to a folder that
isn't committed, and its failure message ends with a command that accepts
that one image as the new reference. The
[v-snap README](https://github.com/yortus/mvt-games/blob/main/packages/libraries/v-snap/README.md)
shows the three images, and its guides cover the commands.
:::

## Common Mistakes

### An image that differs on every run

The test fails now and then with a small difference, and passes when it
runs again. Something in the pose isn't fixed: a clock, a random number
that isn't seeded, state left by an earlier test, or a real model left
running behind a binding. Work through
[Keeping Images the Same](#keeping-images-the-same).

### A transition that's always at its first frame

Every image of a fading or counting view shows the start of its
transition. The view has presentation state, and the test posed it
without `advanceTime`, so time didn't pass. Move time on to the moment you
want to test.

### A dozen whole-screen tests failing at once

Every change to the game fails a dozen whole-screen tests, and reviewing
them becomes a chore that people skip. A whole screen changes with almost
any change to the game. Test the parts on their own, and keep one or two
images of the whole screen.

### A bug in a reference image

A failure was accepted to make the test pass, without a look, and a bug
became the new reference. Look at every new image, including the first.

## Summary

A visual test poses a view and compares its image with a reference image.
MVT makes the pose short and the image dependable. A leaf view is posed
with stand-in bindings. A top-level view is posed by bringing its model
into a state through its actions. A view with presentation state, or a model and
its view together, are moved on with `advanceTime`, after which one refresh
draws exactly that moment.

Images stay the same from run to run because models never read the clock
and receive their random numbers, and because each test fixes everything
else that it depends on and cleans up after itself. Test the parts of a game one
at a time, and keep a few images of the whole screen for layout.

Every new image is a decision. Look at it, then accept it with the code
that caused it, or fix the bug it found.
