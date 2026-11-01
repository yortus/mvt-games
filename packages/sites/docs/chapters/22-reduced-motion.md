# Reduced Motion

> Some people ask their system for less motion, because large movements on
> screen make them dizzy or sick. In MVT, that setting is a presentation
> concern. Whatever runs the game reads it and passes it to the views as a
> binding, and the views choose a quieter way to show the same thing. The
> model never reads it, so the game plays the same for everyone, and a test
> can check both paths by setting the binding.

**Related:** [Presentation State](11-presentation-state.md) ·
[Bindings](08-bindings.md) ·
[Time and Phases](06-time-and-phases.md) ·
[Growing a Complex View](18-growing-a-complex-view.md) ·
[Testing Views](16-testing-views.md)

When a level ends, the screen wipes across to the next one: a black cover
sweeps in from the left, the level changes behind it, and the cover sweeps
away. For most players, it's a nice touch. For a player who has asked
their system for less motion, it's a large, fast movement across the
whole screen, the very thing they asked to be spared.

The player still needs to move on to the next level. The only question is
how the screen gets there: with a wipe that sweeps across it, or with a
gentle fade.

## Motion Is Presentation

A setting for less motion changes how things look, not what happens. So
the setting belongs with the views, not the model.

A model that read it would tie its domain logic to one way of presenting
it. Its tests, and anything else that runs it headless, would have to
choose a value for a setting that doesn't change anything they check. The views
already decide how everything looks, so they decide this too.

## Where the Setting Comes From

Where the setting comes from depends on what your game runs on. A web page
can query the browser, which reports the system's setting as
`prefers-reduced-motion`. Most game engines don't pass on a system's
setting like this, even where the system has one. So a game made with one
usually offers a setting of its own, in its options menu, such as switches
for screen shake or flashing effects.

This chapter's examples are for the web. With another engine, read the
setting however that engine allows, or from the game's own options.
Everything else here still applies. Whatever runs the game reads the
setting and passes it to the views as a binding, and the model never
reads it.

On the web, the page reads the setting. In MVT terms, the page is outside
the architecture, like the renderer. It queries the browser with
`matchMedia`, which returns an object whose `matches` property is `true`
when the setting is on. A top-level view's main binding is the model, and
a value from outside the model, such as this setting, comes in as a query
binding beside it, as [Chapter 8](08-bindings.md) describes:

```ts
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const view = GameView({
    model,
    isMotionReduced: () => reducedMotion.matches,
});
```

The binding is a getter, so it follows the setting if the player changes
it while the game runs. Each view that moves things passes it on to the
views and view models that use it, as it would any other binding. Only the
page touches `matchMedia`, so every view can be built in a test with the
binding fixed to `true` or `false`.

Motion that CSS draws, such as a transition on a button's colour, can use
the `@media (prefers-reduced-motion: reduce)` rule in the stylesheet
instead. The binding is for motion that the views drive themselves, frame
by frame.

## Choosing the Quiet Path

A quiet path shows the same thing as the full one, with less movement.
Fades take the place of slides, sweeps and zooms. Flashes are left out.
The quiet path changes only the presentation state, never the phases that
the model or the other views read.

Here is the wipe between levels again, as a
[view model](18-growing-a-complex-view.md). The wipe decides when the next
level starts, so its timing belongs to the model, which keeps a `phase`
and a `progress` for it, as [Chapter 6](06-time-and-phases.md) shows. The
view model follows them through its options, and reads the setting as
each wipe starts:

```ts
update: (_deltaMs) => {
    const isWiping = options.phase() === 'wiping';
    if (isWiping && !wasWiping) isQuiet = options.isMotionReduced();
    wasWiping = isWiping;
    const progress = options.progress();
    if (isQuiet) {
        // Fade to black where it stands, and back
        cover.x = 0;
        cover.alpha = 1 - Math.abs(2 * progress - 1);
    }
    else {
        // Sweep in from the left, and out to the right
        cover.x = (2 * progress - 1) * screenWidth;
        cover.alpha = 1;
    }
},
```

`cover` here isn't the display object. It's a plain record of two
numbers, which the view model owns and the view reads. So this `update`
doesn't write any presentation output, as
[Chapter 11](11-presentation-state.md) requires. It works out presentation
state, and the view's `refresh` writes it, by copying `cover.x` and
`cover.alpha` onto the real cover. Like any presentation state, `cover`
should start valid, so the view model works it out once as it's made too.

Two details make this work well:

- **Read the setting when the wipe starts,** not every frame. A setting
  that changed half way through would otherwise make the wipe jump from
  one path to the other. The next wipe picks the change up.
- **Follow the same progress on both paths.** The model's wipe takes as
  long whichever path the view draws, so the game plays the same for every
  player. Only the look changes.

[§](#try-wipe-reduced-motion) shows the wipe twice from one model. On the
left is the full path, and on the right the quiet one. Watch the level
change at the same moment in both. Press Step, and keep pressing it, to
compare them a frame at a time.

<TryIt example="wipe-reduced-motion" file="views/wipe-view-model.ts" />

[§](#try-wipe-motion-setting) shows one screen of it, as a player sees it,
with a switch for less motion that starts from your system's setting. The
page owns the setting, and passes it in as a getter. Flip the switch
during a wipe: the wipe finishes the way it started, and the next one
picks up the change.

<TryIt example="wipe-motion-setting" file="main.ts" />

Smaller motion follows the same idea. A view that eases cards into place
can jump them there instead. A view that scrolls something into sight can
set the scroll to jump there (`behavior: 'auto'`) rather than glide
(`'smooth'`). An effect that plays only for show, such as a moving
preview, can be left out altogether.

## Testing Both Paths

The setting is a binding, so a test can run the view model once with each
value. For the quiet path, check that the cover stays in place:

```ts
it('fades in place for a player who asked for less motion', () => {
    const wipe = createWipeViewModel({
        phase: () => 'wiping',
        progress: () => 0.25,
        isMotionReduced: () => true,
    });
    wipe.update(16);
    expect(wipe.cover.x).toBe(0);
    expect(wipe.cover.alpha).toBeCloseTo(0.5);
});
```

The view model doesn't have a clock of its own, so a test sets the
progress that it checks. A [visual test](17-visual-tests.md) of each path,
part way through, shows the difference to anyone reviewing a change.

## Summary

Reduced motion is presentation. Whatever runs the game reads the setting,
from the system or the game's own options, and passes it to the views as
a getter. A view, or its view model, reads it as each transition starts,
and follows the model's progress on either path, so only the look changes
and the game plays the same. Fades take the place of sweeps and zooms, and
effects that are only for show can be left out. Because the setting is a
binding, a test runs each path by fixing it to `true` or `false`.

## Further Reading

- W3C, [Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/TR/WCAG21/#animation-from-interactions),
  success criterion 2.3.3, "Animation from Interactions" (2018). Why
  motion that the user didn't ask for should be possible to turn off.
- MDN, [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
  The media feature, and how browsers report the system's setting.
