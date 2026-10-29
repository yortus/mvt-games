# Visual Tests

> A visual test checks what a view looks like. It arranges the view into a
> known state, takes an image of it, and compares that image with an
> accepted one. MVT's rules make these tests unusually cheap and reliable:
> a view is a function of its bindings, and time moves only when the game
> loop says so. This page shows how to use those rules to test any view,
> from a single button to a game's whole screen.

**Previous:** [Testing Views](testing-views.md)
**Related:** [Testing](testing.md) -
[Testing Models](testing-models.md) -
[Presentation State](../adding-visual-polish/presentation-state.md) -
[Bindings](../presenting-the-world/bindings.md) -
[Sound and Music](../presenting-the-world/sound.md)

---

*Assumes familiarity with [Testing Views](testing-views.md). That page
explains visual snapshot testing in general, and when an image is the
right thing to check.*

## Why MVT Views Suit Visual Tests

A visual test is only useful if the same view, in the same state, gives
the same image every time. Most of what makes that hard elsewhere is
ruled out by MVT's rules.

| MVT rule | What it gives a visual test |
| --- | --- |
| A view reads everything it shows through its [bindings](../../reference/glossary.md) | A test can arrange any state by passing fixed bindings. It needs no game, no mocks and no setup beyond the view |
| A view holds no domain state | The view has no hidden history. One image for each state of the bindings covers it |
| Time moves only through `update(deltaMs)` | A test chooses exactly how much time passes. Nothing moves while the image is taken |
| A view writes its output in its refresh step | One refresh before the image draws exactly what the game would show at that moment |
| Models never read the clock | A whole game, advanced by a fixed amount of time, is always at the same moment |

So a visual test of an MVT view is short. It arranges the view into one
state, which this page calls **posing** it. It builds the view, perhaps
advances time, and refreshes the view once. Then it takes the view's image
and compares it.

::: info About the examples
The examples on this page use
[v-snap](https://github.com/yortus/mvt-games/blob/main/packages/tools/v-snap/README.md),
a visual testing tool that runs on Vitest. This project uses it by
convention. Each v-snap test has a name, and a function that returns the posed view. A view drawn on a canvas, such as a
Pixi or three.js view, is tested with `canvasTest`. An HTML view is tested
with `htmlTest`. v-snap takes the view's image and compares it with the
test's [reference image](../../reference/glossary.md), an accepted image
stored beside the test.

Other tools work too, such as Playwright's and Vitest's screenshot
comparisons. [Choosing a Tool](#choosing-a-tool) says how they differ.
The approach on this page applies to any of them.
:::

## Posing a View

A view reads what it shows through its bindings. To pose it, pass
bindings that always give the same values. This test poses a button in
each of its modes.

```tsx
const MODES: readonly PlayButtonMode[] = ['play', 'pause', 'disabled'];

for (const mode of MODES) {
    canvasTest(mode, () => PlayButtonView({
        mode: () => mode,
        radius: BUTTON_RADIUS,
    }));
}
```

A top-level view is posed the same way. Its binding is its model, which
it reads once. To pose it, create the model and bring it into a known state
through its public actions, as a player would.

A good place to start is the states that a player can tell apart, such as
each mode of a button. Values at the edges of what a view must show are
often worth a test too, such as an empty meter, a full one, or the longest
number a counter must fit. These are suggestions, not a checklist. Even a
few tests catch a lot, and more can be added where a view proves easy to
break.

## Advancing Time

Some views hold [presentation state](../adding-visual-polish/presentation-state.md),
such as a banner that counts up, or a flash that fades. Such a view has an
update step, and its look depends on how much time has passed. To pose it,
advance time by a fixed amount with `advanceTime`, from the renderer package.

```tsx
canvasTest('counting up, 300 ms in', async () => {
    let amount = 0;
    const view = BonusAwardView({
        isShown: () => true,
        bonus: () => amount,
        caption: () => CAPTION,
    });
    // The view tweens up to the new bonus amount.
    amount = BONUS;
    await advanceTime(300, view);
    return view;
});
```

`advanceTime(ms, ...items)` steps time in frame-sized steps, as the game
loop does. In each step it updates the models, then the views, whatever
order they are passed in. It does not refresh. The view is refreshed once,
just before its image is taken, as the game loop refreshes once a frame.
It is the same `advanceTime` that [model tests](testing-models.md#advancing-time)
use.

A top-level view and its model are advanced together. This test shows a
game's board after a restart. The view first shows the board that the game
starts with, and then the one that the restart deals.

```tsx
canvasTest('after a restart', async () => {
    const model = createGameModel();
    const view = GameView({ model, sound });
    await advanceTime(16, model, view);
    model.reset();
    await advanceTime(16, model, view);
    return view;
});
```

Pose the moments that matter: the start of a transition, a point part of
the way through, and its end. A view that never stops moving can still be
tested at any moment, because nothing moves between the pose and the
image.

::: tip A whole game's screen
A test of a game's top-level view is a test of its whole screen. It
catches what a single view's test cannot see, such as layout, layering,
or a view left out of its parent. But it also changes with almost any
change to the game. So one or two for each game are usually enough. A big
screen can be cropped to the part that the test is about. Smaller images
are faster, and their failures are easier to read.
:::

## What a Visual Test Checks, and What It Doesn't

A visual test checks how a view looks. Some things are better checked
another way.

| To check | Use |
| --- | --- |
| How a view looks in a state | A visual test |
| The exact words and numbers a view shows | An assertion on the bindings, or on the view model |
| Which sound a view plays | A stand-in that records each sound, or a spy on a headless chip's calls |
| What the game does | [Model tests](testing-models.md) |

## Choosing a Tool

Different projects need different things from their visual tests. The
tools make different trade-offs.

| | v-snap | Screenshot tools, such as Playwright's and Vitest's |
| --- | --- | --- |
| Speed | About 4 ms for each image, so 1000 images run in about 8 seconds | Over ten times as long for each image |
| The same images on every machine | Yes, with no extra setup | Requires Docker or similar to provide an identical system and fonts on every run |
| Text | Canvas text is drawn in v-snap's own fonts. HTML text is drawn blank | Drawn as the browser draws it |

v-snap suits many small, fast tests of the parts of a game, which is what
this project needs. It gets its speed and its matching images by drawing
text its own way. So if the exact look of words matters to a project, such
as its fonts or how its text wraps, a screenshot tool shows them as a
player would see them.

## Keeping Images the Same

A test whose image changes from run to run is worse than no test. MVT's
rules keep most of the causes out, and a few habits keep out the rest.

- **Models never read the clock.** A model that read the time of day, or
  timed itself with `setTimeout`, would be at a different moment in every
  run. The lint rule `@mvtjs/no-wall-clock` reports it.
- **Models keep no state at module level.** A counter at the top of a
  model file means models may behave differently over time, even with the same inputs. The lint rule `@mvtjs/no-module-state` reports it.
- **Random numbers are repeatable.** A test tool can seed `Math.random`
  the same before every test, so a model that deals a random board deals
  the same one each time.
- **A test leaves nothing behind.** Some tools, v-snap among them, run many
  tests in one page, for speed. There, a test that changes a library's
  defaults changes the images of the tests after it.

## Reviewing a Change

In visual testing, reference images are usually committed near their tests. 
When a code change affects how a view looks, the next test run will generate a new image that doesn't match the committed reference image. The test will report this mismatch. 

The developer then reviews the new image against the reference image. If the change is correct, the developer updates the reference image and commits it with the code. Reviewers then see the old and new images side by side.

When a visual test fails, look at the difference before accepting it. If the
change was intended, accept the new image. If it wasn't, the test has
found a bug. Accepting new images without looking defeats the purpose.


