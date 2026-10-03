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

The package's JSX runtime, at `@mvtjs/pixi/jsx`, builds containers whose
properties follow your game's state:

```tsx
/** @jsxImportSource @mvtjs/pixi/jsx */
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

## Learn more

- [The guide and reference](https://yortus.com/mvt-games/docs/)
- [How `updateView` and `refreshView` work](https://github.com/yortus/mvt-games/blob/main/packages/pixi/src/README.md)

## License

MIT
