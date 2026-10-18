# Reduced Motion

> Some people ask their system for less motion, because large movements on
> screen make them dizzy or sick. In MVT, implementing reduced motion is a presentation concern. The views take the setting through a binding and choose a quieter way to
> show the same thing, and the model never knows. This page shows where the
> setting comes from, how a view chooses its quiet path, and how to test
> both paths.

**Previous:** [Taming Complex Views](taming-complex-views.md)

**Related:** [Presentation State](presentation-state.md) ·
[Bindings](../presenting-the-world/bindings.md) ·
[Open-Ended Phases](../animating-transitions/open-ended-phases.md) ·
[Testing Views](../iterating-with-confidence/testing-views.md)

---

*Assumes familiarity with [Presentation State](presentation-state.md) and
[Taming Complex Views](taming-complex-views.md).*

## Motion Is Presentation

A setting for less motion changes how things look, not what happens. When
a level ends, the player still moves on to the next one. The only question
is how the screen gets there: with a wipe that sweeps across it, or with a
gentle fade.

So the setting belongs with the views, not the model. A model that read it
would tie its domain logic to one way of presenting it. Its tests, and
anything else that runs it headless, would have to choose a value for a
setting that changes nothing they check. The views already decide how
everything looks, so they decide this too.

## Where the Setting Comes From

Where the setting comes from depends on what your game runs on. A web page
can ask the browser, which reports the system's setting as
`prefers-reduced-motion`. Most game engines don't pass on a system's
setting like this, even where the system has one. So a game made with one
usually offers a setting of its own, in its options menu, such as switches
for screen shake or flashing effects.

This page's examples are for the web, where this repo's games run. With
another engine, read the setting however that engine allows, or from the
game's own options. Everything else on this page still applies. Whatever
runs the game reads the setting and passes it to the views as a binding,
and the model never knows.

On the web, the page reads the setting. In MVT terms, the page is outside
the architecture, like the renderer. It passes the setting down to the
views as a query binding:

```ts
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const view = GameView({
    model,
    isMotionReduced: () => reducedMotion.matches,
});
```

The binding is a function, so it follows the setting if the player changes
it while the game runs. Each view that moves things passes it on to the
views and view models that need it, as it would any other binding. Nothing
but the page touches `matchMedia`, so every view can be built in a test
with the binding fixed to `true` or `false`.

Motion that CSS draws, such as a transition on a button's colour, can use
the `@media (prefers-reduced-motion: reduce)` rule in the stylesheet
instead. The binding is for motion that the views drive themselves, frame
by frame.

## Choosing the Quiet Path

A quiet path shows the same thing as the full one, with less movement.
Fades take the place of slides, sweeps and zooms. Flashes go. What changes
is the presentation state, never the phases that the model or the rest of
the views see.

Here is a [view model](taming-complex-views.md) for a wipe between levels.
The wipe decides when the next level starts, so its timing is the model's,
as [Open-Ended Phases](../animating-transitions/open-ended-phases.md#when-a-transition-decides-when-play-starts)
explains. The view model follows the model's `phase` and `progress`
through bindings, and reads the setting as each wipe starts:

```ts
update(_deltaMs) {
    const isWiping = options.phase() === 'wiping';
    if (isWiping && !wasWiping) isQuiet = options.isMotionReduced();
    wasWiping = isWiping;
    const progress = options.progress();
    if (isQuiet) {
        // Fade to black where it stands
        cover.x = 0;
        cover.alpha = progress;
    }
    else {
        // Sweep in from the left
        cover.x = (progress - 1) * screenWidth;
        cover.alpha = 1;
    }
},
```

Two details make this work well:

- **Read the setting when the wipe starts,** not every frame. A setting that
  changed half way through would otherwise make the wipe jump from one path
  to the other. The next wipe picks the change up.
- **Follow the same progress on both paths.** The model's wipe takes as
  long whichever path the view draws, so the game plays the same for every
  player. Only the look changes.

Smaller motion follows the same idea. A view that eases cards into place
can jump them there instead. A view that scrolls something into sight can
pass `behavior: 'auto'` rather than `'smooth'`. An effect that plays only
for show, such as a moving preview, can be left out altogether.

## Testing Both Paths

The setting is a binding, so a test can run the view model once with each
value. For the quiet path, check that nothing moves:

```ts
it('fades in place for a player who asked for less motion', () => {
    const wipe = createWipeViewModel({
        phase: () => 'wiping',
        progress: () => 0.5,
        isMotionReduced: () => true,
    });
    wipe.update(16);
    expect(wipe.cover.x).toBe(0);
    expect(wipe.cover.alpha).toBeCloseTo(0.5);
});
```

The view model has no clock of its own, so a test sets the progress it
wants to see. A [visual test](../iterating-with-confidence/visual-tests.md)
of each path, part way through, shows the difference to anyone reviewing a
change.

## In This Repo

The Arcade's way into an entry has a quiet path. The full one burns the
wall away, floats the card's photo up to the play area and powers the
screen on. The quiet one fades the page, then the photo, then fades the
entry up. The page reads `prefers-reduced-motion` in `main.ts`, and passes
`isMotionReduced` to `ArcadeView`, which hands it to the transition's view
model, the card wall's layout, and attract mode, which stays off. The view
model reads it as each transition starts, and its tests run both paths:

- [`main.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/arcade/main.ts)
- [`transition-view-model.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/arcade/views/transition-view-model.ts)
  and its [tests](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/arcade/views/transition-view-model.test.ts)
- [`card-wall-layout.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/arcade/views/card-wall-layout.ts)

---

**Next:** [Phase-Based Transitions](../animating-transitions/phase-based-transitions.md) -
modelling components that cycle through mutually exclusive phases.
