# @mvtjs/pixi

`@mvtjs/pixi` helps keep a Pixi.js scene in step with your game's state.
Any container can be given two optional methods: `refresh`, which makes the
container show the game's current state, and `update`, which advances
anything the container animates on its own. Calling `updateView` and then
`refreshView` once per frame runs those methods across the whole stage,
parents before children. The package is part of MVT (Model-View-Ticker), an
approach to building games that keeps game state, how it is shown, and the
passing of time apart; [the MVT documentation](https://yortus.com/mvt-games/docs/)
explains the ideas behind it.

```sh
npm install @mvtjs/pixi pixi.js
```

`@mvtjs/utils`, which this package builds on, comes with it as a peer
dependency.

## Example

```ts
import { Application, Graphics } from 'pixi.js';
import { refreshView, setRefresh, updateView } from '@mvtjs/pixi';

// A model: the game's state, and how it changes over time (a ball crossing the screen)
const model = {
    x: 0,
    y: 100,
    update: (deltaMs: number) => { model.x = (model.x + 0.1 * deltaMs) % 800; },
};

// A view: how the state is shown (a ball, kept at the model's position)
const ballView = new Graphics().circle(0, 0, 10).fill(0xffffff);
// Write the model's state to the container, once per frame
setRefresh(ballView, () => { ballView.position.set(model.x, model.y); });

// The ticker: each frame, advance the model, then the views (Pixi then renders)
const app = new Application();
await app.init({ resizeTo: window });
app.stage.addChild(ballView);
app.ticker.add((ticker) => {
    model.update(ticker.deltaMS);           // advance the model
    updateView(app.stage, ticker.deltaMS);  // then every update method in the stage
    refreshView(app.stage);                 // then every refresh method
});
```

## JSX support

The package's JSX runtime builds containers whose properties follow your game's
state. A `.tsx` file names the package in its pragma, and imports `<List>`,
`<Switch>` and the binding types from the package itself:

```tsx
/** @jsxImportSource @mvtjs/pixi */
import { Texture } from 'pixi.js';

const boxView = (
    <sprite
        texture={Texture.WHITE}
        width={20}
        height={20}
        x={() => model.x}
        y={() => model.y}
    />
);
```

A function attribute is read on every refresh; a plain value is set once.

## Measuring performance

`createPerformanceMeter`, from `@mvtjs/utils`, measures your frames as your
game runs: frames per second, the time each frame takes on the CPU and the
GPU, and how much work the views do. It needs to know when each frame starts
and ends. For an app that runs on Pixi's own ticker, four lines tell it:

```ts
import { UPDATE_PRIORITY } from 'pixi.js';
import { createGpuTimer } from '@mvtjs/pixi';
import { createPerformanceMeter } from '@mvtjs/utils';

const gpuTimer = createGpuTimer({ renderer: app.renderer });
const meter = createPerformanceMeter({ takeGpuMs: gpuTimer?.takeMedianMs });
// The frame starts before any other ticker listener, and ends once Pixi has drawn it
app.ticker.add(meter.startFrame, undefined, UPDATE_PRIORITY.INTERACTION + 1);
app.renderer.runners.postrender.add({ postrender: meter.endFrame });
```

`createGpuTimer` times each render on the GPU. It returns `undefined` where
the browser can't do that, and the GPU's time then shows as n/a. If you
drive the frames yourself, call `meter.startFrame()` and `meter.endFrame()`
around each one instead. Show the numbers with `@mvtjs/html`'s
`PerfmonView`, or draw them yourself.

## Keep one copy

A program must load one copy of this package, and one of `@mvtjs/utils`. A
second copy that extends the same Pixi `Container` throws an error as it
loads. `npm ls @mvtjs/pixi` finds it, and in Vite, `resolve.dedupe` keeps
one copy of each. See [Keep one copy](https://github.com/yortus/mvt-games/blob/main/packages/libraries/utils/README.md#keep-one-copy) in `@mvtjs/utils` for the causes and their fixes.

## Learn more

- [The guide and reference](https://yortus.com/mvt-games/docs/)
- [How `updateView` and `refreshView` work](https://github.com/yortus/mvt-games/blob/main/packages/libraries/pixi/src/README.md)

## License

MIT
