# Using the Principles

> MVT's rules apply its principles to the situations that every game
> meets. For a request that no rule covers, you go back to the principles
> themselves. This chapter does that for the screen shake that Chapter 25
> began with. It also shows how naming a principle makes a design review
> shorter and clearer, and says what to do when two principles pull
> against each other, as they sometimes do for performance. Last, it
> chooses between two designs that both keep to every principle: a view
> with one step, or MVT's two.

**Related:** [The Eight Principles](25-the-eight-principles.md) ·
[MVT on One Page](../appendices/a-mvt-on-one-page.md) ·
[Hot Paths](24-hot-paths.md) ·
[Presentation State](11-presentation-state.md)

[Chapter 25](25-the-eight-principles.md) began with a designer's
request: *the screen should shake when the player is hit.* The rules in
[Appendix A](../appendices/a-mvt-on-one-page.md) don't mention screen
shake. Now that you've met all eight principles, you can go back to
them and settle it, and the same steps work for any request that no rule
covers.

## Deciding a Case That the Rules Don't Cover

Back to the screen shake. Four of the principles settle it between them.

- **SoC.** Would any domain outcome change without the shake? No. So it is
  presentation, and it belongs in a view, not the model.
- **SSOT.** The view needs to detect that a hit happened. It mustn't keep
  its own copy of the player's health, because the model is the one source.
  So the model needs to hold something that changes on a hit. A count of
  hits taken will do. A hit starts and ends within one update, but the count
  it leaves behind is still there when the view reads it.
- **CQS.** The view mustn't clear a "was hit" flag on the model once it
  has read it. That turns a read into a write, and a second view reading
  the same flag would miss the hit.
- **DfT.** The shake's own timer is
  [presentation state](11-presentation-state.md), advanced by the view's
  `update(deltaMs)`. So a test can drive it with fixed steps and check the
  offset.

Put together, the model counts hits. The view notices the count go up, as
[Chapter 9](09-noticing-changes.md) showed, starts its own shake timer,
and writes the offset in `refresh()`:

```ts
// In the player model: one more each time the player is hit
hitsTaken++;
```

```ts
// In the view: a rise in the count starts the view's own timer
let shakeMs = 0;

const startShakeWhenHitsRise = createReaction({
    watch: () => model.hitsTaken,
    when: increased,
    react: () => {
        shakeMs = SHAKE_MS;
    },
});

function update(deltaMs: number): void {
    shakeMs = Math.max(0, shakeMs - deltaMs);
    startShakeWhenHitsRise();
}

function refresh(): void {
    const strength = shakeMs / SHAKE_MS;
    playfield.x = Math.sin(shakeMs * SHAKE_RATE) * SHAKE_PX * strength;
}
```

The rules don't spell that out, but every step of it follows from a
principle. The model doesn't have any code for shaking. Any number of
other views can watch the same count, for a sound or a red flash, without
getting in each other's way. And the shake is easy to test, because its
timer moves only when a test passes it `deltaMs`.

::: info In this book
`createReaction` and `increased` come from `@mvtjs/utils`. A view sets the
`update` and `refresh` functions above as its two steps with `setUpdate`
and `setRefresh`, from the renderer package it uses, such as
`@mvtjs/pixi`.
:::

## Reviewing a Design

Name the principle in a review finding. "This view keeps a copy of the
score" is a finding about SSOT. "This getter starts a timer" is about CQS.
A named principle points the author at a chapter that explains the problem
and the usual fix. That is shorter, and more convincing, than a paraphrase.

Each principle's chapter ends with a checklist of questions for exactly
this.

## When Principles Pull Against Each Other

They rarely do, but it happens, and each principle's chapter says where. The usual
tension is with performance, on a [hot path](24-hot-paths.md): code that
runs for every object, every frame, where a small performance cost is
multiplied many times over. Chapter 24 covers hot paths in full.

Neon Monsoon's
[bullets](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/neon-monsoon/models/bullet-field.ts)
are an example. Thousands are fired, moved and removed every second. So
each bullet is an index into typed arrays rather than an object, and the
code doesn't allocate memory as it fires, moves and removes them. The
drawback is that an illegal state becomes representable. Code can still
read the position of a bullet that no longer exists, which MISU would rule
out. The model documents the limit
instead ("only meaningful for an index below `count`").

The principles' chapters show compromises like this where they arise. That way, each
one is a decision you make knowingly, not by accident.

## Choosing Between Two Designs That Both Work

The principles agreed on one answer for the screen shake. Sometimes two designs
both keep to every principle, and the principles only lean one way or the
other. Then you weigh how far each one leans. MVT's own view steps are a case
like this. A view has an `update` and a `refresh`, but it could manage with one
step, as game engines' scripts usually do.

### A view with one step

Here is the sliding door from
[Chapter 11](11-presentation-state.md#a-view-s-update-deltams), written with
one step:

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

The door looks the same in a running game. Running each view's `refresh`
straight after its `update`, across the games built with this book's libraries,
leaves them all working. One step is simpler to learn, because there's one verb,
and you never choose which step a line belongs in. A value that `update` works
out can stay a local variable, and the libraries walk the tree once.

Most of MVT's rules apply either way. Models never change while views update or
refresh, a view calls its relay bindings only between frames, every `update`
accepts a `deltaMs` of 0, and a view never reads back what it wrote. With two
steps, the shape of the code enforces some of these. With one step, they become
rules about the order of lines in a function.

### Principles that lean towards two steps

Five principles lean towards two steps, though none settles it alone. Each has
an answer in a one-step design, given with it, so you can weigh it yourself.

**SoC.** Moving state on with time, and writing the output, are separate
concerns. In one function, a line that belongs to one can skip the other. A ship
flashes for a moment after a hit, and its `update` returns early once the flash
is over. This sample shows the mistake:

```ts
function update(deltaMs: number): void {
    if (flashMs <= 0) return;
    flashMs -= deltaMs;
    ship.x = bindings.x(); // bug: skipped when flashMs <= 0
    ship.tint = flashMs > 0 ? FLASH_TINT : NORMAL_TINT;
}
```

Once the flash ends, the ship stops following the model. A one-step design can
keep the two concerns apart with local `advance(deltaMs)` and `draw()`
functions. That works, but it's two steps again, kept apart by habit rather than
by the structure.

**CQS.** Two walks give the whole view tree a command phase and then a query
phase, so every `onUpdate` runs before any getter reads what it moved on. This
fuel gauge's getters run after `ease`, with no `deltaMs`, and never while the
gauge is hidden:

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

Those getters are a refresh step in all but name. A JSX runtime could make each
element's `update` call its `onUpdate` and then write its attributes, so for JSX
the second step stays as an idea either way. But one walk, parents first, mixes
the two phases. An attribute that reads state moved on below it reads the value
from the tick before:

```tsx
<container alpha={() => shownAlpha}>
    <sprite texture={glowTexture} onUpdate={fadeIn} />
</container>
```

Here the container's `alpha` stays one tick behind `fadeIn`. Putting `onUpdate`
on the top element avoids it, as most views do, but a one-step design doesn't
warn you when you don't.

**DbC.** A binding can have a precondition. This health bar's `health` binding
is only valid while there's a target:

```tsx
<container visible={() => target() !== undefined}>
    <HealthBarView health={() => target()!.health} />
</container>
```

The `visible` getter keeps that precondition for the bar. A hidden view isn't
refreshed, and only its `refresh` reads `health`, while its pulse moves on in
`update`:

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
it can tell each view that it's hidden, so that the view skips its output. A JSX
runtime could do that for every element, but a view in plain TypeScript has to
remember it.

**SSOT.** A view's state lives in one place, a variable, and the output is worked
out from it. With `deltaMs` to hand in the same function, it's tempting to keep
the state on the display object instead. This sample shows the mistake, for a
pixel-art sprite that moves at 40 pixels a second and lands on whole pixels:

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
and write `sprite.x = Math.round(x)`. A worse form of the same mistake,
`sprite.y -= speed * deltaMs`, is a second copy of the model's motion. It looks
correct until the model changes speed.

**DfT.** Each step's job can be checked by a tool, not only by a test. A linter
can use a function's name to tell what its job is, so it could flag a
`flashMs += 16` in a refresh, or a write to `label.alpha` in an update. In one
step, the same lines look like any other:

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

### The choice MVT makes

MISU decides it. Two steps make some mistakes impossible to write, because
`refresh` doesn't have a `deltaMs` to misuse, and they make others loud, such as
output that goes missing in the first test that refreshes a view. It's easier to
keep to a rule that the shape of the code enforces than to one that requires
discipline. So MVT keeps two view steps.

An experienced team building one game might weigh that differently, and it
doesn't need a different architecture. A view can write its output in `update()`
and leave out `refresh()`, and it will run. Be aware of what you take on:

- **You relax a rule.** That style breaks
  [V-presentation](../appendices/a-mvt-on-one-page.md#view-rules), so you check
  by hand what the structure checked for you.
- **JSX still refreshes.** Attributes with getters, `<List>` and `<Switch>` all
  use refresh steps, so the realistic style is "no hand-written `refresh`".

You can reach one step from two by leaving `refresh` out. You can't reach a step
with no time in it from one step without adding that step back. So two steps keep
the choice open.

## Summary

When a request meets a situation that no rule covers, ask each
principle's question in turn, as this chapter did for the screen shake. Its answer will usually
fit the rest of MVT, because the rules came from the same questions. When
you review a design, name the principle that a finding is about. And when
two principles pull against each other, usually for performance, make the
trade on purpose and write it down. When two designs both keep to every
principle, as one view step and two do, weigh how far each principle leans.
For MVT's view steps, five lean towards two, and MISU settles it.
