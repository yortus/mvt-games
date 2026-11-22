# @mvtjs/pixi-3d

`@mvtjs/pixi-3d` helps keep a [PixiJS 3D](https://github.com/pixijs/3d)
scene in step with your game's state. Any scene node can be given two
optional methods: `refresh`, which makes the node show the game's current
state, and `update`, which advances anything the node animates on its own.
Calling `updateView` and then `refreshView` once per frame runs those
methods across the whole stage, 2D and 3D, parents before children. The
package is part of MVT (Model-View-Ticker), an approach to building games
that keeps game state, how it is shown, and the passing of time apart.
[The MVT documentation](https://yortus.com/mvt-games/docs/) explains the
ideas behind it.

The package isn't published to npm yet, because PixiJS 3D is still new.
It's built and checked in the same way as a published package, so it's
ready to publish when PixiJS 3D is.

`@mvtjs/utils` and `@mvtjs/pixi` are its peer dependencies, since a 3D
scene always sits on a Pixi stage.

## Example

```tsx
/** @jsxImportSource @mvtjs/pixi-3d */
import { CubeGeometry, Material3D, type Container3D } from '@pixi/3d';

// A view's bindings: what it reads from the model
interface CrateViewBindings {
    readonly x: () => number;
}

// A view: how the state is shown (a crate, kept at the model's x position)
function CrateView({ x }: CrateViewBindings): Container3D {
    const box = new CubeGeometry({ width: 1, height: 1, depth: 1 });
    const wood = new Material3D({ baseColor: 0x9a6b3f, roughness: 0.8 });
    return (
        <group owns={[box, wood]}>
            <camera z={6} />
            <directionalLight intensity={2} x={-3} y={5} z={4} lookAt={{ x: 0, y: 0, z: 0 }} />
            <mesh geometry={box} material={wood} x={x} />
        </group>
    );
}
```

```tsx
/** @jsxImportSource @mvtjs/pixi */
import { Scene3DView } from '@mvtjs/pixi-3d';

// In a 2D Pixi view: the scene, drawn like any other container
<Scene3DView scene={CrateView({ x: () => model.x })} width={800} height={600} background={0x203040} />;
```

A function attribute is read on every refresh. A plain value is set once.
The ticker works as it does for any Pixi view. Each frame, it updates the
model, calls `updateView(stage, deltaMs)` and `refreshView(stage)`, then
renders.

## Views that mix 2D and 3D

- **`Scene3DView`** puts a 3D scene in a 2D Pixi tree. It draws from the
  first `<camera>` in the scene, which it finds once, as it's made. So keep
  one camera as a fixed part of the scene, outside any `<Switch>` or
  `<List>`, and move it rather than swap it for another. Its size, background, fog and exposure can
  each be a getter, so they can change while the game runs. The other
  settings, such as the post-processing `passes` and the shadow settings,
  are read once.
- **`ScreenView`** puts a 2D view on a plane in a 3D scene, such as a
  scoreboard over a track. It updates and refreshes the 2D view along with
  the stage, and draws it before each render. Because of this, the screen
  shows its content from the first frame, in a visual test as well as in
  the game. With `isInteractive`, a pointer on the screen reaches the
  buttons drawn on it.
- **`ScreenAnchorView`** places a 2D view over a point in the scene, such
  as a name tag over a car. The 2D view stays crisp, and draws over the
  scene. Its `Scene3DView` places it after refreshing the scene, so it
  follows the camera's position in the current frame.

## Elements

The package's JSX runtime has these elements: `group`, `mesh`, `sprite3d`,
`batchedMesh`, `model`, `camera`, `ambientLight`, `directionalLight`,
`pointLight` and `spotLight`. Each attribute is written only as often as
it needs to be. Transforms are written every frame. Anything that rebuilds
GPU state, such as a texture or a shadow setting, is written only when it
changes. Some options are read by PixiJS 3D only when it creates a node,
such as a batch's `size` or a model's `source`. These are passed to the
node's constructor, and must be fixed values. Every element accepts the
twelve pointer events, from `onPointerDown` to `onWheel`. The `hitVolume`
attribute sets what a pointer is tested against. Geometry and materials
are attributes, not child elements, because they're usually shared.

## Views own the resources they make

PixiJS 3D frees a mesh's geometry and material only when you ask it to,
because they're often shared. So a view that makes one lists it in an
`owns` attribute, on any element, and it's freed when that element is
destroyed. A view written in plain TypeScript calls
`ownResources(node, [...])` instead. A resource that several views share
belongs to the view that made it. For example, a scene might make one set
of car parts for every car, and own them itself.

```tsx
const paint = new Material3D({ baseColor: color });
return <group owns={[paint]}><mesh geometry={parts.body} material={paint} /></group>;
```

In a test, `destroyAndFindLeaks(view)` destroys a tree. It returns each
geometry, material and texture that the tree drew with and that is still
alive afterwards.

## Time comes from `deltaMs`

PixiJS 3D can advance a model's animation, particles, a live texture, and
its own orbit and first-person cameras, on Pixi's shared ticker. That's
wall-clock time in a view. It keeps moving while the game is paused, and a
test can't hold it still. So with this package, each of these moves only
by the `deltaMs` that your views receive:

- `<model clip="walk" clipTimeMs={() => model.walkMs} />` poses the clip at
  the time that a binding returns, and never plays it by itself.
- `ParticlesView` advances its particles in its update step, by `deltaMs`.
  Its random numbers come from a seed, so the particles land in the same
  places on every run. A count binding, such as the model's count of
  explosions, spawns a burst each time the count rises.
- `ScreenView` draws its texture itself, so a live texture never needs
  `autoUpdate`.
- The package leaves out PixiJS 3D's orbit and first-person cameras. They
  move on Pixi's shared ticker, and they read the page's events
  themselves, which bypasses your bindings. Write a camera view instead,
  as you would any other view.

## Load it before the renderer starts

PixiJS 3D, and this package's screen drawing, add themselves to each Pixi
renderer as it starts. So import `@mvtjs/pixi-3d`, which imports
`@pixi/3d`, before you start your `Application`. A renderer that started
earlier can't draw 3D.

## Visual tests

In a v-snap visual test, a pose returns a 2D view that holds a
`Scene3DView`, as it would for any Pixi view. The v-snap config must
import `@mvtjs/pixi-3d` before any test starts the renderer, for the
reason above.

## Keep one copy

A program must load one copy of this package, and one of `@mvtjs/utils`. A
second copy that extends the same PixiJS 3D `Container3D` throws an error
as it loads. `npm ls @mvtjs/pixi-3d` finds it, and in Vite,
`resolve.dedupe` keeps one copy of each. See [Keep one copy](https://github.com/yortus/mvt-games/blob/main/packages/libraries/utils/README.md#keep-one-copy) in `@mvtjs/utils` for the causes and their fixes.

## Learn more

- [The guide and reference](https://yortus.com/mvt-games/docs/)
- [Design notes](./src/jsx/design-notes.md), which explain why the
  elements, ownership and time work as they do

## License

MIT
