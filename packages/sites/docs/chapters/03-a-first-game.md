# A First Game

> This chapter untangles the bouncing ball from Chapter 2 into a model, a
> view and a loop. The model simulates the ball in its own units, and
> doesn't depend on the screen. The view reads the model and draws it. The
> loop ticks the model, then the view, every frame. The result is three
> short files, and each one can change without the others.

**Related:** [Why MVT](02-why-mvt.md) · [Models](04-models.md) ·
[The Tick](05-the-tick.md) · [Views](07-views.md)

In [Chapter 2](02-why-mvt.md), one function made the ball fall, drew it,
and kept time. You couldn't test it without Pixi, resize it without
changing the physics, or slow it down without the flash running at full
speed. Here's the same ball in three parts: a model, a view, and the loop
that ticks them. To keep this first version small, it leaves out the
flash.

## The Model

The model holds the ball's physics, and only its physics:

```ts
/** How big the ball is, in world units. */
const RADIUS = 15;
/** How fast the ball speeds up as it falls, in world units per ms, per ms. */
const GRAVITY = 0.0015;
/** The share of its speed the ball keeps as it bounces, from 0 to 1. */
const BOUNCE = 0.7;
/** How fast the ball starts moving to the right, in world units per ms. */
const START_SPEED = 0.12;

export interface BallModel {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly update: (deltaMs: number) => void;
}

export interface BallModelOptions {
    /** The width of the box, in world units. */
    readonly width: number;
    /** The height of the box, in world units. */
    readonly height: number;
}

/** Creates a ball near the top of the box, moving to the right. */
export function createBallModel(options: BallModelOptions): BallModel {
    const { width, height } = options;
    let x = width / 2;
    let y = height / 3;
    let vx = START_SPEED; // world units per ms
    let vy = 0;

    return {
        get x() { return x; },
        get y() { return y; },
        radius: RADIUS,

        update(deltaMs) {
            vy += GRAVITY * deltaMs;
            x += vx * deltaMs;
            y += vy * deltaMs;

            if (x < RADIUS) {
                x = RADIUS;
                vx = Math.abs(vx) * BOUNCE;
            }
            if (x > width - RADIUS) {
                x = width - RADIUS;
                vx = -Math.abs(vx) * BOUNCE;
            }
            if (y > height - RADIUS) {
                y = height - RADIUS;
                vy = -Math.abs(vy) * BOUNCE;
            }
        },
    };
}
```

The constants at the top are its tunables: the numbers you'd change to
make the ball feel different. This book puts them first in a file, so
they're easy to find. There are three more things to notice here.

- **Its units are its own.** The box is measured in world units, not
  pixels. The model doesn't reference the screen's size, or even whether
  there is a screen.
- **Time arrives only through `update(deltaMs)`.** The model doesn't call
  `setTimeout` or `Date.now()`, and doesn't use an animation library. Until
  something calls `update`, the ball stays still.
- **Its state is private.** `x`, `y`, `vx` and `vy` live inside the
  function, and the interface lets you read the position but not change
  it. The `get x()` syntax makes `model.x` call a function that returns the
  current value.

Writing a model as a function that returns an object, rather than as a
class, is this book's style, not something MVT requires.
[Chapter 4](04-models.md) explains the style, and everything else that a
model does.

## The View

The view draws the ball at the model's position:

```ts
import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { BallModel } from '../models';

export interface BallViewBindings {
    model: BallModel;
}

export function BallView(bindings: BallViewBindings): Container {
    const { model } = bindings;
    const view = new Container();
    const ball = new Graphics()
        .circle(0, 0, model.radius)
        .fill(0x44aaff);
    view.addChild(ball);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        ball.position.set(model.x, model.y);
    }
}
```

A view in this book is a function that takes one object, its bindings,
and returns what it draws into, here a Pixi `Container`. The bindings are
how the view reads the state that it shows. This view shows the whole
game, so its one binding is the model itself. Smaller views, such as a
score display you could reuse, take bindings for only the values they
show.
[Chapter 8](08-bindings.md) covers both.

The view does its work in two places:

- **When it's made,** it builds the circle, once. The radius never changes,
  so the view never draws the circle again.
- **Every frame,** its refresh step, `refresh()`, reads the model and moves
  the circle there. That's all a refresh step does: read the state, and
  write it to the output.

The view also owns the step from world units to pixels. Here one world
unit is drawn as one pixel, but the view decides that, not the model. To
draw the game twice as big, the view could set `view.scale.set(2)`, and
the model wouldn't change at all.

::: info In this book
`setRefresh`, from `@mvtjs/pixi`, sets a container's refresh step. You
don't call that step yourself. The loop calls every refresh step in the
scene at once, as the next section shows.
:::

## The Loop

The loop creates the model and the view, and ticks them every frame:

```ts
import { Application } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createBallModel } from './models';
import { BallView } from './views';

const app = new Application();
await app.init({ width: 400, height: 300, background: 0x0a1628 });
document.body.appendChild(app.canvas);

const model = createBallModel({ width: 400, height: 300 });
app.stage.addChild(BallView({ model }));

app.ticker.add((ticker) => {
    model.update(ticker.deltaMS);           // 1. the model moves on
    updateView(app.stage, ticker.deltaMS);  // 2. views with their own state
    refreshView(app.stage);                 // 3. every view reads and writes
});                                         // 4. then Pixi draws
```

This is the ticker from [Chapter 2](02-why-mvt.md). Each frame, Pixi
calls the function with the time since the last frame. The function ticks
the model first, so the ball has finished moving before any view reads
it. Then it ticks the views. `updateView` calls every view's update step,
which moves a view's own presentation state forward. This view doesn't
have an update step, but the flash from Chapter 2 would have one.
`refreshView` calls every view's refresh step. Pixi draws after the
function returns.

::: info In this book
`updateView` and `refreshView`, from `@mvtjs/pixi`, find every update
step and every refresh step in the stage, and call them, parents before
children. MVT requires only that views read the models after the models move
and before the frame is drawn. Any way of doing that works.
[Chapter 5](05-the-tick.md) shows the loop in detail.
:::

[§](#try-first-game) runs the three parts in the playground, a small
editor in the browser that runs MVT projects. Press View code, open
`models/ball-model.ts`, and change `GRAVITY` or `BOUNCE` at the top. The
ball restarts with your change as you type.

<TryIt example="first-game" file="models/ball-model.ts" />

In the playground, you don't write the loop. Your project's `start`
function, in `main.ts`, creates the model and the view, and returns the
model, and the playground ticks it for you, in the order above.

## Chapter 2's Requests, Revisited

Go back to the requests from Chapter 2.

- **Testing the ball** doesn't need Pixi. A test creates a model, calls
  `update(16)` a few hundred times, and checks `y`.
  [Chapter 15](15-testing-models.md) shows how.
- **Drawing it twice as big** is a change to the view. The physics is in
  world units, so it stays the same.
- **Slow motion** is the loop passing half of `ticker.deltaMS`, to the
  model and to `updateView` alike. Anything that a view times, such as a
  flash, slows down with the ball, because its time comes from the same
  loop.
- **Showing the height as a number** is a second view that reads
  `model.y`. Both views read the same model on the same frame, so they
  always agree.

Each of these changes touches only one of the three files.

[§](#try-first-game-two-views) shows two of them at once. The same
`BallView` draws the same model twice, once at half the size, and a new
`HeightView` shows the ball's height as a number. The model and
`BallView` are unchanged. Open `main.ts` to see how the three views are made.

<TryIt example="first-game-two-views" file="main.ts" />

## Opening the Examples in the Playground

[§](#try-first-game) and [§](#try-first-game-two-views) each have an "Open
in the playground" button, which opens the project in the playground
itself, where you have more room to change it. New to the playground?
Click the (i) at the top right for a quick tour.

## Summary

The tangled ball became three parts. The model simulates the ball in
world units, and time reaches it only through `update(deltaMs)`. The view
builds its display once, and each frame its refresh step reads the model
and moves the display to match. The loop ticks the model, then the views,
and then the renderer draws. Each request that ran into trouble with the
tangled version now changes one part only. The next three chapters look at the
simulation side more closely: what goes in a model
([Chapter 4](04-models.md)), the tick, which passes it `deltaMs`
([Chapter 5](05-the-tick.md)), and how a model uses that time, in
phases ([Chapter 6](06-time-and-phases.md)).
