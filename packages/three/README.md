# @mvtjs/three

`@mvtjs/three` helps keep a three.js scene in step with your game's state.
Any object can be given two optional methods: `refresh`, which makes the
object show the game's current state, and `update`, which advances anything
the object animates on its own. Calling `tickScene` once per frame then runs
those methods across the whole scene, parents before children. The package
is part of MVT (Model-View-Ticker), an approach to building games that keeps
game state, how it is shown, and the passing of time apart;
[the MVT documentation](https://yortus.com/mvt-games/docs/) explains the
ideas behind it.

```sh
npm install @mvtjs/three three
```

`@mvtjs/utils`, which this package builds on, comes with it as a peer
dependency. TypeScript users also need `@types/three`, as for three.js itself.

## Example

```ts
import { BoxGeometry, Mesh, MeshNormalMaterial } from 'three';
import { setTickMethods, tickScene } from '@mvtjs/three';

// A model: the game's state, and how it changes over time (an object sliding along x)
const model = {
    x: 0,
    update: (deltaMs: number) => { model.x = (model.x + 0.002 * deltaMs) % 10; },
};

// A view: how the state is shown (a cube, kept at the model's x position)
const meshView = new Mesh(new BoxGeometry(), new MeshNormalMaterial());
setTickMethods(meshView, {
    // Write the model's state to the object, once per frame
    refresh: () => { meshView.position.x = model.x; },
});
scene.add(meshView);

// The ticker: each frame, advance the model, tick the views, then render
let last = performance.now();
renderer.setAnimationLoop((now) => {
    const deltaMs = now - last;
    last = now;
    model.update(deltaMs);                  // advance the model
    tickScene({ root: scene, deltaMs });    // then the view
    renderer.render(scene, camera);
});
```

One `tickScene` call runs every update method in the subtree, then every
refresh method, each object before its descendants, whether it is visible or
not. It touches no renderer, so a scene can be stepped in a test. The package
also has a pointer picker (`createPointerPicker`).

## JSX support

The package's JSX runtime, at `@mvtjs/three/jsx`, builds objects whose
properties follow your game's state:

```tsx
/** @jsxImportSource @mvtjs/three/jsx */
const meshView = (
    <mesh
        geometry={new BoxGeometry()}
        material={new MeshNormalMaterial()}
        x={() => model.x}
    />
);
```

A function attribute is read on every refresh; a plain value is set once.

## Learn more

- [The guide and reference](https://yortus.com/mvt-games/docs/)

## License

MIT
