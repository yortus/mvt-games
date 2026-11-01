# Using the Principles

> Rules cover the cases someone thought of, and principles cover the rest.
> This chapter puts the eight to work. It settles the screen shake that
> Chapter 25 began with, shows how naming a principle makes a design
> review shorter and clearer, and says what to do when two principles pull
> against each other, as they sometimes do for performance.

**Related:** [The Principles Behind MVT](25-the-principles-behind-mvt.md) ·
[MVT on One Page](../appendices/a-mvt-on-one-page.md) ·
[Hot Paths](24-hot-paths.md)

[Chapter 25](25-the-principles-behind-mvt.md) began with a designer's
request: *the screen should shake when the player is hit.* The rules in
[Appendix A](../appendices/a-mvt-on-one-page.md) don't mention screen
shake, so they can't say where it goes. Now that you've met all eight
principles, you can settle it, and the same steps work for any case the
rules don't cover.

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

## Summary

When a request falls outside the rules, ask each principle's question in
turn, as this chapter did for the screen shake. Its answer will usually
fit the rest of MVT, because the rules came from the same questions. When
you review a design, name the principle that a finding is about. And when
two principles pull against each other, usually for performance, make the
trade on purpose and write it down.

That's where the book ends. Its first parts taught MVT's three parts and
the rules that keep them apart, and the later ones how to test them, grow
them and keep them fast. This part has said why they work. When you meet a
case that no chapter covers, the principles' questions are the ones to ask.
