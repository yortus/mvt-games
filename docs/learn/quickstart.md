# Quickstart

> Build a working MVT example in under 5 minutes - a bouncing ball with
> gravity and floor collision.

**Next:** [The Game Loop](game-loop.md)

---

## 1. The Model

The model is a headless simulation. It knows nothing about rendering - just
physics:

```ts
interface BallModel {
    readonly x: number;      // metres
    readonly y: number;      // metres
    readonly radius: number; // metres
    update(deltaMs: number): void;
}

function createBallModel(): BallModel {
    const radius = 0.15;     // metres
    const floorY = 3;        // metres
    const gravity = 15;      // metres/s^2
    let x = 2;               // metres
    let y = 0.5;             // metres
    let vy = 0;              // metres/s

    const model: BallModel = {
        get x() { return x; },
        get y() { return y; },
        get radius() { return radius; },
        update(deltaMs) {
            const dt = deltaMs / 1000;
            vy += gravity * dt;
            y += vy * dt;
            if (y + radius > floorY) {
                y = floorY - radius;
                vy = -vy * 0.7;   // 70% energy retained
            }
        },
    };
    return model;
}
```

Key points:

- All units are **metres** - not pixels. The model has no idea how big the
  canvas is.
- `update(deltaMs)` is the only way time advances. No `setTimeout`, no
  `Date.now()`.
- State lives in the closure (`x`, `y`, `vy`) - truly private.

## 2. The View

The view reads the model each frame and converts domain coordinates (metres)
to pixel positions:

```ts
function createBallView(model: BallModel): Container {
    const SCALE = 100;   // pixels per metre

    const gfx = new Graphics();
    const view = new Container();
    view.addChild(gfx);
    view.onRender = refresh;

    function refresh() {
        gfx.clear();
        gfx.circle(model.x * SCALE, model.y * SCALE, model.radius * SCALE);
        gfx.fill(0xff6644);
    }

    return view;
}
```

The view owns the **metres-to-pixels conversion**. The model says "the ball is
at 2m, 1.5m with radius 0.15m" and the view multiplies by `SCALE` to get pixel
coordinates. Change `SCALE` and the ball gets bigger or smaller - the model
doesn't change.

## 3. The Ticker

The ticker wires model and view together in a frame loop:

```ts
const ball = createBallModel();
const view = createBallView(ball);
stage.addChild(view);

app.ticker.add((ticker) => {
    ball.update(ticker.deltaMS);
});
```

The sequence every frame is: **update model** -> **refresh view** -> **render**.
The ticker drives the model; Pixi's `onRender` hook drives the view. Neither
the model nor the view knows about the other's internals.

## Try It Live

> **[Open in Playground](/playground/#preset=bouncing-ball)** - edit the model
> and view side by side and see changes instantly.

## What's Next?

This is MVT at its simplest: a model that simulates, a view that renders, and
a ticker that drives the loop. To understand the architecture in depth:

1. **[The Game Loop](game-loop.md)** - frame sequencing and `deltaMs`
2. **[Models](models.md)** - what belongs in a model (and what doesn't)
3. **[Views](views.md)** - the `refresh()` contract and scene graph patterns
4. **[Bindings](bindings.md)** - decoupling views from specific models
