# Visual Tests

> A visual test checks what a view looks like. It arranges the view into a
> known state, takes an image of it, and compares that image with an
> accepted one. MVT's rules make these tests unusually cheap and reliable:
> a view is a function of its bindings, and time moves only when the game
> loop says so. This page shows how to use those rules to test leaf views,
> top-level views and whole games.

**Previous:** [Testing Views](testing-views.md)
**Related:** [Testing](testing.md) -
[Testing Models](testing-models.md) -
[Presentation State](../adding-visual-polish/presentation-state.md) -
[Bindings](../presenting-the-world/bindings.md) -
[Sound and Music](../presenting-the-world/sound.md)

---

*Assumes familiarity with [Testing Views](testing-views.md). That page
explains visual snapshot testing in general, and when an image is the
right check.*

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
[vsnap](https://github.com/yortus/mvt-games/blob/main/packages/vsnap/README.md),
the visual testing tool that this project uses by convention. In vsnap, a
test of a view drawn on a canvas, such as a Pixi or three.js view, is a
call to `canvasTest`, and a test of an HTML view is a call to `htmlTest`. Each takes the test's **pose**: a
function that returns the view, posed. vsnap takes the image and compares
it. [In This Project: vsnap](#in-this-project-vsnap) says how this project
sets it up.

Other tools work too, such as Playwright's and Vitest's screenshot
comparisons. They organise tests in their own ways, and they differ in
speed, and in how they keep images the same from one machine to another.
The approach on this page applies to any of them.
:::

## Posing a Leaf View

A leaf view takes [bindings](../../reference/glossary.md). To pose it,
pass bindings that return fixed values. Write one test for each state the
bindings can show.

```tsx
const MODES: readonly SpinButtonMode[] = ['spin', 'stop', 'disabled'];

describe('SpinButtonView', () => {
    for (const mode of MODES) {
        canvasTest(mode, () => SpinButtonView({
            mode: () => mode,
            radius: BUTTON_RADIUS,
        }));
    }
});
```

Choose the states that a player could tell apart. Each distinct mode of
the view needs a test. So do values at the edges of what the view must
show, such as an empty meter, a full one, or the longest number a counter
must fit. Two states that look the same need only one test.

## Posing a View With Presentation State

Some views hold [presentation state](../adding-visual-polish/presentation-state.md),
such as a banner that counts up, or a flash that fades. Such a view has an
update step, and its look depends on how much time has passed. To pose it,
advance time by a fixed amount with `advanceTime`, from the tick API.

```tsx
canvasTest('counting up, 300 ms in', async () => {
    let amount = 0;
    const view = WinBannerView({
        isShown: () => true,
        amount: () => amount,
        caption: () => CAPTION,
    });
    // The win arrives after the banner is built. The count then catches up.
    amount = WIN;
    await advanceTime(300, view);
    return view;
});
```

`advanceTime(ms, ...items)` steps time in frame-sized steps, as the game
loop does. In each step it updates the models, then the views, whatever
order they are passed in. It does not refresh. The view is refreshed once,
just before its image is taken, as the game loop refreshes once a frame.
In this project, the website's `vsnap.config.ts` tells vsnap to do that
refresh. `advanceTime` is the
same idea as [`advanceTime` for models](testing-models.md#advancing-time).

Pose the moments that matter: the start of a transition, a point part of
the way through, and its end. A view that never stops moving can still be
tested at any moment, because nothing moves between the pose and the
image.

## Posing a Top-Level View Through Its Model

A top-level view takes its model, not bindings. To pose one, make the
model, bring it into a known state through its public actions, as a
player would, and advance both the model and the view.

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

Drive the model only through its interface. A test that reaches into the
model's internals breaks when they change, even though nothing a player
sees has changed.

A big screen can be cropped, so that its image shows the part that the
test is about. Smaller images are faster, and their failures are easier
to read.

## Whole Games

A game's whole screen can be tested at one moment too. Make the game as
it starts, advance it by a fixed amount of time, and take one image.
Because models never read the clock, that moment is the same on every
run.

These tests catch what a single view's test cannot see: layout, layering,
and a view left out of its parent. They also change with almost any
change to the game. So keep one or two for each game, and let the tests
of single views carry the detail.

In this project, every game and demo gets one whole-screen test without
any new code. Two test files make one for each game and demo in the
Arcade, at the same moment that its thumbnail shows.

## What an Image Checks, and What It Doesn't

An image checks how a view looks. Some things are better checked another
way.

| To check | Use |
| --- | --- |
| How a view looks in a state | A visual test |
| The exact words and numbers a view shows | An assertion on the bindings, or on the view model |
| Which sound a view plays | An assertion on a recording chip ([Testing Audio Views](testing-views.md#testing-audio-views)) |
| What the game does | [Model tests](testing-models.md) |

Words are worth checking separately because visual test tools often draw
text in their own fonts, or not at all, so that images match on every
machine. The image then checks where text is and how much room it takes,
and an assertion checks what it says.

## Keeping Images the Same

A test whose image changes from run to run is worse than no test. MVT's
rules keep most of the causes out, and a few habits keep out the rest.

- **Models never read the clock.** A model that read the time of day, or
  timed itself with `setTimeout`, would be at a different moment in every
  run. The lint rule `@mvtjs/no-wall-clock` reports it.
- **Models keep no state at module level.** A counter at the top of a
  model file is shared by every game played on the page, so a game's
  first image would depend on the games before it. This happened in one
  of this project's games, whose asteroid shapes depended on how many
  asteroids the page had made before. Running many games' tests in one
  page showed it. The lint rule `@mvtjs/no-module-state` now reports it.
- **Random numbers are repeatable.** A test tool can seed `Math.random`
  the same before every test, so a model that deals a random board deals
  the same one each time.
- **A test leaves nothing behind.** Some tools, vsnap among them, run many
  tests in one page, for speed. There, a test that changes a library's
  defaults changes the images of the tests after it.

## Reviewing a Change

Reference images are committed beside their tests. Whoever changes how a
view looks updates its reference images, looks at them, and commits them
with the code. Reviewers then see the old and new images side by side.

When a test fails, look at the difference before accepting it. If the
change was intended, accept the new image. If it wasn't, the test has
found a bug. Accepting new images without looking defeats the purpose.

## In This Project: vsnap

vsnap is a package in this repo. A test file sits beside the view it
tests, and is named `*.visual.test.tsx`. `canvasTest` and `htmlTest` come
from vsnap. `advanceTime` comes from the renderer package that the view
uses, with the rest of the tick API.

The visual tests run in Vitest projects beside the unit tests, listed in
the repo's root `vitest.config.ts`. Their names all start with `visual-`.
vsnap knows nothing about MVT. The website's `vsnap.config.ts` connects
the two. It registers the kinds of view that the tests pose: Pixi, three.js
and HTML views. For each kind, it refreshes the view before its image is
taken, and destroys it through MVT afterwards.

| Command | What it does |
| --- | --- |
| `npm test` | Runs the unit tests alone. No browser starts |
| `npm run test:visual` | Runs every visual test, and compares each image with its reference image |
| `npm run test:visual:update` | Also writes each new or changed image as its reference image |
| `npx vitest run <test file> -u` | Updates the reference images of one test file |

A failing test's message says what changed, and where. It also gives the
command that accepts the new image. vsnap's README covers its options,
where it keeps files, and how it stays fast and gives the same images on
Windows, Linux and macOS.

## Sounds Have the Same Kind of Test

Sounds can be tested the same way. An
[audio test](https://github.com/yortus/mvt-games/blob/main/packages/audio/src/headless/README.md#audio-tests)
renders a sound in memory, and compares a hash of its samples with an
accepted one. A change that alters the sound fails the test, until
someone has listened to it and accepted it.
