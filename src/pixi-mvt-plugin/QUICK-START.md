# Quick Start

> Per-frame logic that belongs to a container instead of to a ticker. For Pixi
> developers; no architecture knowledge assumed. See [README.md](README.md) for
> the design rationale.

---

Your game has state, and your scene has to show it. This plugin adds two
optional methods to every `Container` for exactly that:

- `onRefresh()` makes the scene show the current state.
- `onUpdate(deltaMs)` changes state as time passes.

## Keeping game state and visuals in sync: `onRefresh`

Keeping a scene in sync with game state is normally a chore of remembering. E.g. every place that changes player `hp` also has to remember to resize the health bar.

`onRefresh` inverts that. It reads state and syncs itself to it:

```ts
const player = { hp: 100 };

healthBar.onRefresh = () => {
    const fraction = player.hp / 100;
    bar.scale.x = fraction;
    bar.tint = fraction > 0.5 ? GREEN : fraction > 0.2 ? YELLOW : RED;
};
```

Wire it up once:

```ts
import { Application } from 'pixi.js';
import { installMvtScenePlugin } from './pixi-mvt-plugin';

installMvtScenePlugin(); // before init, which is when Pixi applies app plugins

const app = new Application();
await app.init({ width: 960, height: 600 });
app.ticker.add(() => app.scene.refresh());
```

`app.scene.refresh()` walks the scene graph and calls every `onRefresh` it
finds.

The bar is now correct forever, and not because anything told it. A trap, a
healing potion, loading a save, a cheat typed into a debug console: none of them
need a line of code to keep the bar in sync, because the bar re-derives itself
from `player.hp` every frame. There is no `setHp()` that also has to remember to
resize a rectangle, and no event to forget to subscribe to. A whole category of stale-display and synchronization bugs go away.

## Maintaining localized animations: `onUpdate`

Most games have visuals that animate without affecting actual gameplay, like spinning indicators or character animations. This is localised state, and is exactly the kind of thing `onUpdate` is for. In bare Pixi, it means a ticker subscription and a (potentially forgotten) unsubscription. We're also coupling to the global ticker here, which makes testing more difficult:

```ts
function createSpinner(): Container {
    const view = new Graphics().rect(-20, -20, 40, 40).fill(0x44aaff);

    const tick = (ticker: Ticker) => {
        view.rotation += 0.002 * ticker.deltaMS;
    };
    Ticker.shared.add(tick);
    view.on('destroyed', () => Ticker.shared.remove(tick));

    return view;
}
```

With the plugin, keep the angle in a local variable and give each hook its own
job:

```ts
function createSpinner(): Container {
    const view = new Graphics().rect(-20, -20, 40, 40).fill(0x44aaff);
    let angle = 0;

    view.onUpdate = (deltaMs) => angle += 0.002 * deltaMs; // local state changes
    view.onRefresh = () => view.rotation = angle;          // scene matches state

    return view;
}
```

The subscription and ticker coupling problems disappear. A container animates
only if it's in the scene graph; there's nothing to unsubscribe or forget, and
testing becomes much simpler.

It is also the same split as the health bar, just smaller and private. `angle`
is the state and `view.rotation` is the picture of it, exactly as `player.hp` is
the state and `bar.scale.x` is the picture of it. The only difference is that
nothing outside this factory ever sees `angle`, and nothing needs to.

To hook this system into your game, just add `update` to your main loop:

```ts
app.ticker.add((ticker) => {
    app.scene.update(ticker.deltaMS); // all localized state changes
    app.scene.refresh();              // then the scene catches up
});
```

Now every `onUpdate` in the whole scene runs before any `onRefresh`. So the spinner
and the health bar both refresh from state that has finished moving, and nothing
is ever drawn from a half-updated world.

Rule of thumb: if it updates state, it belongs in `onUpdate`. If it updates the
scene to match state, it belongs in `onRefresh`.

## What `onRefresh` and `onUpdate` buy you

- **No lifecycle bookkeeping.** Both hooks live and die with their container.
  Destroying a parent stops everything beneath it, so one `levelRoot.destroy()`
  tears down a level cleanly. Nothing to unsubscribe, nothing to forget.
- **No invalidation to remember.** Nothing ever has to tell the scene that state
  changed. No dirty flags, no change events, no subscriptions, no setter that also has to resize a
  rectangle. Each piece of state has one home, and the scene converges on it every frame.
- **Scene order, not subscription order.** Both passes visit a container before
  its children, however they were added. And every `onUpdate` finishes before
  any `onRefresh` begins, so no frame is drawn from a half-updated world.
- **Time is an argument.** Nothing has its own clock. You control the clock.

The last two combine into something genuinely useful: because `onRefresh` does
not depend on time, you can stop time without stopping the picture.

```ts
app.ticker.add((ticker) => {
    if (!paused) {
        app.scene.update(ticker.deltaMS * timeScale); // 0.25 is slow motion
    }
    app.scene.refresh(); // runs either way
});

// and a single-step debug key is just:
onKeyPress('.', () => app.scene.update(16));
```

Pause, slow motion and single-stepping all fall out of that, and a paused frame
still draws correctly: menus opened while paused lay themselves out, sliders
track, and anything that changes state while the world is frozen shows up
immediately.

## Testing

Both passes are ordinary function calls, so a scene runs with no `Application`,
no renderer and no ticker.

`onRefresh` is the easy one, because it is a pure projection of state. Set the
state, refresh once, assert on the scene. No frames, no time:

```ts
it('shows a hurt bar in amber', () => {
    player.hp = 30;
    scene.refresh();

    expect(bar.scale.x).toBeCloseTo(0.3);
    expect(bar.tint).toBe(0xddaa33);
});
```

`onUpdate` takes the time you give it:

```ts
import { Container } from 'pixi.js';
import { createSceneScheduler } from './pixi-mvt-plugin';

it('spins two radians per second', () => {
    const root = new Container();
    const spinner = createSpinner();
    root.addChild(spinner);

    const scene = createSceneScheduler(root);
    scene.update(1000);
    scene.refresh();

    expect(spinner.rotation).toBeCloseTo(2);
});
```

Because you pass the time in, you can run a thousand frames instantly or step one frame at a time. The same trick can handle everything from promo shots to rewind and replays: step scene time however you like, then render it.

## Gotchas

- **Install before `init`.** Pixi applies application plugins during
  `app.init()`.
- **Both hooks fire even when `visible = false`.** An animation that pauses
  while hidden is wrong when it reappears. To stop a subtree, remove or destroy
  it.
- **`onRefresh` must be safe to run twice.** Assign, never accumulate:
  `view.x = ...`, not `view.x += ...`. Accumulate in `onUpdate` instead.
- **Both run every frame**, so do not allocate in them. Index-based loops, no
  `array.map()`, no template strings.

## Next

- [README.md](README.md) - ordering guarantees in full, the two call-list
  strategies and their benchmarks, and what Pixi's own `onRender` does and does
  not promise.
- Runnable demo: `npm run dev`, then open `/spike/`.
- Once game state outgrows a few closures, the rest of this repo shows the
  model-and-view split these two hooks were designed for. You do not need it to
  use them.
