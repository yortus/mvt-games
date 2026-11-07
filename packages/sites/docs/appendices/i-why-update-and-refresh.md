# Why Update and Refresh

> MVT's tick has more steps than many game engines' loops. Models and views
> each have an `update`, which keeps game logic and presentation apart, and
> views also have a `refresh`. The first split does real work. The second is a
> choice. One step works too, so the difference is mostly in how mistakes show
> up, and this page explains why MVT keeps two.

**Related:** [Why MVT](../chapters/02-why-mvt.md) ·
[The Tick](../chapters/05-the-tick.md) ·
[Views](../chapters/07-views.md) ·
[Presentation State](../chapters/11-presentation-state.md) ·
[MVT on One Page](a-mvt-on-one-page.md) ·
[MVT Beyond the Web](h-mvt-beyond-the-web.md)

## Two Updates: Models and Views

Every model updates before any view runs, and views never change models. Models
and views both move state on by `deltaMs`, but different kinds of state. A
model's `update` moves domain state, which decides what happens in the game. A
view's `update` moves presentation state, such as a fade, which changes only how
things are shown. That split gives you three things:

- **Models run without views.** A test, a replay or a server can run the models
  with no views and no renderer at all.
- **Views can't disturb each other.** Every view reads the same settled state,
  so adding a view never changes what another view reads
  ([§](../chapters/05-the-tick.md#why-the-tick-s-order-matters)).
- **Time can differ on each side.** A paused game can stop its models and its
  views while a menu's views run on
  ([§](../chapters/05-the-tick.md#time-control)).

The split has a drawback. An object's game logic and the way it's shown no longer
sit in one script, and
[Chapter 26](../chapters/26-separation-of-concerns.md) weighs that trade-off.

### Unity's `Update` and `LateUpdate`

Unity makes a similar split, in time. Every object's `Update` runs first, and
then every object's `LateUpdate`, so a camera that follows the player in
`LateUpdate` reads where the player is now, not where it was. A model's `update`
plays the part of `Update`, and a view's steps play the part of `LateUpdate`.
But Unity's split is only in time. A `LateUpdate` can still change the game, and
it usually sits on the same object as the game logic. MVT also splits code by
what it may change, and the three things above come from that.

## One Step or Two in a View

The second split, between a view's `update` and `refresh`, is a different kind of
decision. You don't need it. One step works too, and most of MVT's rules apply
either way, so the choice is mostly about how a mistake shows up: loudly, or
quietly. Here is the sliding door from
[Chapter 11](../chapters/11-presentation-state.md), written with one step:

```ts
function update(deltaMs: number): void {
    const target = bindings.isOpen() ? 1 : 0;
    const step = deltaMs / SLIDE_MS;
    if (openness < target) openness = Math.min(target, openness + step);
    if (openness > target) openness = Math.max(target, openness - step);

    const slide = openness * PANEL_WIDTH;
    left.x = -slide;
    right.x = PANEL_WIDTH + slide;
}
```

The door looks the same in a running game, and the code is what you'd write in
Unity's `Update` or Godot's `_process`. Running each view's `refresh` straight
after its `update`, across the games built with this book's libraries, leaves them
all working.

### Attractions of one step

- **It's simpler to learn.** There's one verb, and you never choose which step a
  line belongs in.
- **Values don't need carrying.** A value that `update` works out and `refresh`
  needs can stay a local variable.
- **Tests and libraries get simpler.** A test that only updates a view still sees
  its output, and the libraries walk the tree once.

Engines' scripts often work this way, though game libraries such as XNA and LÖVE
pair an update with a draw, as MVT does.

### Rules that apply with one step or two

Dropping `refresh` removes fewer rules than you might expect. Each of these stays:

- Models never change while views update or refresh.
- A relay binding fires outside the frame.
- Every `update` accepts a `deltaMs` of 0.
- Output is worked out from state, with no time in the calculation.
- A view never reads back what it wrote.

With two steps, the shape of the code enforces some of these. With one step,
they become rules about the order of lines in a function.

## Five Reasons MVT Keeps Two Steps

These reasons don't prove anything. Each one has an answer in a one-step design,
and each section includes that answer, so you can weigh it yourself. Taken
together, they lean toward two steps, which is why MVT keeps both.

### Returning early from an update step

A ship flashes for a moment after a hit. Most of the time there's nothing to
time, so `update` returns early. With one step, the early return skips the
output too. This sample shows the mistake:

```ts
function update(deltaMs: number): void {
    if (flashMs <= 0) return;
    flashMs -= deltaMs;
    ship.x = bindings.x();
    ship.tint = flashMs > 0 ? FLASH_TINT : NORMAL_TINT;
}
```

Once the flash ends, the ship stops following the model. With a separate
`refresh`, code in `update` can't stop the output being written. A one-step
design answers this with local `advance(deltaMs)` and `draw()` functions. That
works well, but it's two steps again, kept apart by habit rather than by the
structure.

### Getters in JSX attributes

This fuel gauge eases towards the real fuel level:

```tsx
export function FuelGaugeView(bindings: FuelGaugeViewBindings): Container {
    let shownFuel = bindings.fuel();

    return (
        <container visible={bindings.isShown} onUpdate={ease}>
            <sprite texture={barTexture} width={() => shownFuel * BAR_WIDTH} />
            <sprite texture={lowTexture} visible={() => shownFuel < LOW_FUEL} />
        </container>
    );

    function ease(deltaMs: number): void {
        const follow = 1 - Math.exp(-deltaMs / EASE_MS);
        shownFuel += (bindings.fuel() - shownFuel) * follow;
    }
}
```

Each getter runs after `ease`, with no `deltaMs`, and never while the gauge is
hidden, so it's a refresh step in all but name. A JSX runtime could make each
element's `update` call its `onUpdate` and then write its attributes. That
removes a walk of the tree, but you'd still write two kinds of code. So for JSX,
the second step stays as an idea either way.

One step does change the order, though. With two walks, every `onUpdate` runs
before any attribute. With one walk, parents first, an attribute that reads state
moved on below it reads the value from the tick before:

```tsx
<container alpha={() => shownAlpha}>
    <sprite texture={glowTexture} onUpdate={fadeIn} />
</container>
```

Here the container's `alpha` stays one tick behind `fadeIn`. Putting `onUpdate`
on the top element avoids it, as most views do, but a one-step design doesn't
warn you when you don't.

### A binding that's invalid while a view is hidden

A health bar shows the current target, and there may be no target:

```tsx
<container visible={() => target() !== undefined}>
    <HealthBarView health={() => target()!.health} />
</container>
```

The bar pulses, so its update step keeps running while it's hidden. A hidden view
isn't refreshed, and only `refresh` reads `health`:

```ts
function update(deltaMs: number): void {
    pulseMs += deltaMs;
}

function refresh(): void {
    bar.width = bindings.health() * PIXELS_PER_POINT;
    bar.alpha = pulseAt(pulseMs);
}
```

Move the output into `update`, and the game throws as soon as there's no target.
A one-step design can stop updating hidden views, but then the pulse freezes. Or
the walk can tell each view that it's hidden, so that the view skips its output.
A JSX runtime could do that for every element, but a view in plain TypeScript has
to remember it, after the code that moves its state on. With two steps, the
`visible` getter skips the refresh steps below it, with no code in the views.

### Keeping state on the output

A pixel-art sprite moves at 40 pixels a second, and it should land on whole
pixels. With `deltaMs` available, this looks fine. This sample shows the mistake:

```ts
function update(deltaMs: number): void {
    sprite.x = Math.round(sprite.x + SPEED * deltaMs);
}
```

Rounding throws away part of every step, so the speed now depends on the frame
rate. Here's how far the sprite moves in one second:

| Frame rate | Position kept on the sprite | Position kept in a variable |
| --- | --- | --- |
| 30 Hz | 30 pixels | 40 pixels |
| 60 Hz | 60 pixels | 40 pixels |
| 144 Hz | 0 pixels | 40 pixels |

With two steps, `refresh` doesn't have a `deltaMs`, so you keep `x` in a variable
and write `sprite.x = Math.round(x)`. A worse form of the same mistake is
`sprite.y -= speed * deltaMs`, a copy of the model's motion that looks correct
until the model changes speed. With one step, `deltaMs` is always within reach,
so either mistake is an easy one to make.

### Checks that a linter can make

A linter can use a function's name to tell what its job is. With two steps, a
`flashMs += 16` in a refresh and a write to `label.alpha` in an update are both
mistakes that a lint rule could flag. In one step, the same lines look like any
other:

```ts
function update(deltaMs: number): void {
    flashMs += 16;                     // A bug, which looks like any other line
    label.alpha = flashAlpha(flashMs); // Correct
}
```

Yet `flashMs += 16` is a real bug, because it ties the flash to the frame rate.
Here's what each design can check:

| Check | Two steps | One step |
| --- | --- | --- |
| Output code doesn't use `deltaMs` | Yes, and the compiler does it | No |
| A refresh doesn't build on its own state | Yes, with a lint rule | No |
| An update writes no output | Yes, with a lint rule | No |
| Models never change during a tick | Yes, with a lint rule | Yes, with a lint rule |

## Choosing Between One Step and Two

MVT keeps two view steps, because they make common mistakes loud
rather than quiet. It's easier to keep to a rule that the shape of the code
enforces than to one that requires discipline.

An experienced team building one game might weigh that differently, and it doesn't
need a different architecture. A view can write its output in `update()` and
leave out `refresh()`, and it will run. Be aware of what you take on:

- **You relax a rule.** That style breaks
  [V-presentation](a-mvt-on-one-page.md#view-rules), so you check by hand what
  the structure checked for you.
- **JSX still refreshes.** Attributes with getters, `<List>` and `<Switch>` all
  use refresh steps, so the realistic style is "no hand-written `refresh`".

You can reach one step from two by leaving `refresh` out. You can't reach a step
with no time in it from one step without adding that step back. So two steps keep
the choice open.

## Summary

The split between models and views keeps game logic and presentation apart, so
models run alone and views can't disturb each other. Unity's `LateUpdate` makes a
similar split, but only in time. The split between a view's two steps is a choice, and MVT
keeps it because it makes common mistakes loud rather than quiet.

## Further Reading

- Unity Technologies, [`MonoBehaviour.LateUpdate`](https://docs.unity.com/en-us/engine/current/script-reference/unityengine/monobehaviour/lateupdate).
  When `LateUpdate` runs, with a follow camera as its example.
- Robert Nystrom, *Game Programming Patterns* (2014), the "Game Loop" and
  "Update Method" chapters. Why games have these loops, and what each object's
  update is for.
