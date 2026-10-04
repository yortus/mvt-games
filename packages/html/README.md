# @mvtjs/html

`@mvtjs/html` helps keep part of a web page, such as a game's HUD or a
settings panel, in step with your game's state. Any element can be given two
optional methods: `refresh`, which makes the element show the game's current
state, and `update`, which advances anything the element animates on its
own. Calling `updateView` and then `refreshView` once per frame runs those
methods across the whole element tree, parents before children. The package is part of MVT
(Model-View-Ticker), an approach to building games that keeps game state,
how it is shown, and the passing of time apart;
[the MVT documentation](https://yortus.com/mvt-games/docs/) explains the
ideas behind it.

```sh
npm install @mvtjs/html
```

`@mvtjs/utils`, which this package builds on, comes with it as a peer
dependency.

## Example

```ts
import { refreshView, setRefresh, updateView } from '@mvtjs/html';

// A model: the game's state, and how it changes over time (health draining away)
const model = {
    health: 100,
    update: (deltaMs: number) => { model.health = Math.max(0, model.health - 0.01 * deltaMs); },
};

// A view: how the state is shown (a meter, kept at the model's health)
const healthView = document.createElement('meter');
healthView.max = 100;
// Write the model's state to the element, once per frame
setRefresh(healthView, () => { healthView.value = model.health; });
document.body.append(healthView);

// The ticker: each frame, advance the model, then the views
let last = performance.now();
function frame(now: number): void {
    const deltaMs = now - last;
    last = now;
    model.update(deltaMs);                  // advance the model
    updateView(document.body, deltaMs);     // then every update method in the page
    refreshView(document.body);             // then every refresh method
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

## JSX support

The package's JSX runtime builds elements whose properties follow your game's
state. A `.tsx` file names the package in its pragma, and imports `<List>`,
`<Switch>` and the binding types from `@mvtjs/html/jsx`:

```tsx
/** @jsxImportSource @mvtjs/html */
const healthView = (
    <meter
        max={100}
        value={() => model.health}
    />
);
```

A function attribute is read on every refresh; a plain value is set once.

## Notes

- Changes to the element tree are noticed through a `MutationObserver`, so
  elements can be added and removed with any DOM method.
- A refresh method should only write: reading layout after a write makes the
  browser lay the page out there and then.

## Learn more

- [The guide and reference](https://yortus.com/mvt-games/docs/)

## License

MIT
