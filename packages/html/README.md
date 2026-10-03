# @mvtjs/html

`@mvtjs/html` helps keep part of a web page, such as a game's HUD or a
settings panel, in step with your game's state. Any element can be given two
optional methods: `refresh`, which makes the element show the game's current
state, and `update`, which advances anything the element animates on its
own. Calling `tickScene` once per frame then runs those methods across the
whole element tree, parents before children. The package is part of MVT
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
import { setTickMethods, tickScene } from '@mvtjs/html';

// A model: the game's state, and how it changes over time (health draining away)
const model = {
    health: 100,
    update: (deltaMs: number) => { model.health = Math.max(0, model.health - 0.01 * deltaMs); },
};

// A view: how the state is shown (a meter, kept at the model's health)
const healthView = document.createElement('meter');
healthView.max = 100;
setTickMethods(healthView, {
    // Write the model's state to the element, once per frame
    refresh: () => { healthView.value = model.health; },
});
document.body.append(healthView);

// The ticker: each frame, advance the model, then tick the views
let last = performance.now();
function frame(now: number): void {
    model.update(now - last);                                // advance the model
    tickScene({ root: document.body, deltaMs: now - last }); // then the view
    last = now;
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

One `tickScene` call runs every update method in the subtree, then every
refresh method, each element before its descendants. Changes to the tree are
noticed through a `MutationObserver`, so elements can be added and removed
with any DOM method. A refresh method should only write: reading layout after
a write makes the browser lay the page out there and then.

## JSX support

The package's JSX runtime, at `@mvtjs/html/jsx`, builds elements whose
properties follow your game's state:

```tsx
/** @jsxImportSource @mvtjs/html/jsx */
const healthView = (
    <meter
        max={100}
        value={() => model.health}
    />
);
```

A function attribute is read on every refresh; a plain value is set once.

## Learn more

- [The guide and reference](https://yortus.com/mvt-games/docs/)

## License

MIT
