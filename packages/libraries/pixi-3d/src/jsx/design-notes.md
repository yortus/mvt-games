# Design notes

> These notes record the facts about PixiJS 3D that its JSX target relies
> on, and the decisions specific to that target. The JSX runtime itself is
> the renderer-agnostic base. The base builds children first, and doesn't
> use context providers. It defines the element tables, the write kinds
> and the `owns` attribute. [Its README](../../../utils/src/jsx/README.md)
> explains it, and [its design notes](../../../utils/src/jsx/design-notes.md)
> record its settled decisions.

**Written:** 2026-11-22, against `@pixi/3d` 0.1.0. Each finding below was
checked in PixiJS 3D's source, and should be checked again after an
upgrade. The element table's test and the leak check catch most changes.

## The target

[pixi3d-target.ts](./pixi3d-target.ts) describes PixiJS 3D's scene graph in
the form that the base requires, and
[pixi3d-elements.ts](./pixi3d-elements.ts) is its element table.

- **The 3D scene graph is registered as a renderer of its own.** A
  `Container3D` isn't a Pixi `Container`. It extends `EventEmitter`, and a
  scene hangs off a `View3D`'s `root`, not its children. So
  `container3d-mixin.ts` registers `Container3D.prototype` with
  `registerRenderer`. Then `connectScene` joins the scene's walk to the 2D
  stage's walk, through the `View3D`'s own update and refresh methods.
- **The tree methods follow Pixi's.** `addChild` and `removeChild` handle
  one child at a time, and `addChildAt` and `removeChildren` change
  `children` directly. Every other structural method calls one of those
  four. So wrapping those four clears the cached method lists whenever the
  tree changes.
- **`'destroyed'` fires after the children are detached, and before they're
  destroyed**, as it does in Pixi. The `onDestroyed` callbacks and `owns`
  run at that point.
- **`listen` sets the node's event mode to `'static'`.** PixiJS 3D doesn't
  pick a node until it has an event mode. The base wires events before it
  writes the other attributes, so an `eventMode` attribute still wins.

## Write kinds

Each attribute is written only as often as it needs to be.

- **Transforms are written every frame.** PixiJS 3D's observable vectors
  skip a value that hasn't changed, so the write itself is cheap. They're
  per axis, as Pixi's are, because a view works each one out from the
  model's domain coordinates. `position` and `quaternion` copy from an
  object that the model owns, so a refresh doesn't build a new vector.
- **Anything that rebuilds GPU state is written on change.** That covers a
  geometry, a material, a texture, a mode (`billboardMode`, a camera's
  `mode`, a batch's `cull`), and a light's `castShadow` and `shadow`.
- **Options that only the constructor reads are creation attributes.** A
  batch's `size` is a getter without a setter, and its instance data layout
  is fixed when the batch is made. A model's `source` is `readonly`. The
  base passes these attributes to the table's `create`, and they accept
  only a fixed value. A `create` that reads them declares its parameter's
  type, because TypeScript otherwise infers the element's type as
  `unknown`.
- **A light's `shadow` is written on change, not at creation.** PixiJS 3D's
  docs say that you can "change a field at any time and the shadow's next
  redraw uses it". So the attribute copies each field into `light.shadow`,
  resets the absent ones to their defaults, and calls `refreshShadows()`.
  Once the first light casts a shadow, toggling `castShadow` doesn't
  recompile any shaders.
- **Point and ambient lights don't have `castShadow`.** PixiJS 3D never
  draws a shadow for them.
- **`weights` only takes effect on a mesh with morph targets.** On any
  other mesh the setter ignores it, and the table's test records that.

## Ownership

PixiJS 3D frees a mesh's geometry and material only when `destroy` is
passed `{ geometry: true, material: true }`, because they're often shared.
So views list the resources that they make in `owns`, which is the base's
attribute for every renderer. This target's `release` then frees each one.

- **Freeing a resource as its element is destroyed is safe.** A geometry
  and a material clear their list of meshes as they're destroyed. A mesh
  that's removed from that list afterwards is skipped, because
  `UnstableList.clear` sets each index to -1. So the children of an element
  that owns a geometry can be destroyed after the geometry is freed.
- **A geometry is freed with its own buffers** (`destroy(true)`), and a
  texture with its source, since the view that owns one made those too. A
  material is freed without its textures. The view lists those as well if
  it made them.
- **The mesh's own destroy flags aren't used.** If destroying a mesh
  destroyed its geometry by default, it would free parts that other views
  share. For example, a race's scene might make one set of car parts for
  every car.

## Time

PixiJS 3D advances a model's animation player, particle systems, a live
texture's `autoUpdate`, and its own camera controllers on `Ticker.shared`,
unless they're configured not to. In a view, that's an autonomous
animation, which MVT rules out.

- **A model is posed from bindings.** `AnimationState.gotoAndStop(seconds)`
  applies the pose at once, without a ticker. So `<model>` creates its
  player with `autoUpdate: false`, and the `clip` and `clipTimeMs`
  attributes pose it. The attributes store the clip, the time and the
  looping flag in a `WeakMap` beside the model. They need to, because a
  refresh writes one attribute at a time, in the order that the JSX source
  lists them.
- **Particles are a view function, not an element.** A particle system is
  presentation state that moves every frame, so it needs an update step.
  An element's update slot is reserved for its `onUpdate` attribute.
  `ParticleSystem3D.update(ticker)` reads only `ticker.deltaMS`, so a
  stand-in object, written in place each frame, passes `deltaMs` through
  without allocating. A step of 0 returns at once. The system's random
  numbers come from PixiJS 3D's `seededRandom`, passed as its
  `createRandom` option.
- **The camera controllers are left out.** They move on `Ticker.shared`,
  and they read DOM events themselves, which bypasses bindings and relays. A camera view, written
  like any other view, does the same job.

## Screens

PixiJS 3D's docs say that `ContainerTexture.render` must run before the
scene that samples the texture is rendered, and never during a render.
Two ways to find that moment were tried and ruled out:

- **The `View3D`'s `onRender` hook** runs during the render.
- **Pixi's `prerender` runner** runs at the start of `renderer.render`,
  but the blend-mode pipe resets its state there. A nested render would
  leave that state as the screen left it.

So `screen-render-system.ts` adds a system to every renderer that starts
after the module loads, in the same way that PixiJS 3D adds its own. The
system wraps the renderer's `render` method. Before each render draws a
container, the system draws the texture of each screen that was refreshed
and whose `View3D` is in that container. The screen never needs a
renderer passed to it. This is why a visual test's pose, which never sees
the test's renderer, still shows its screens.

A screen's content isn't in the stage or the scene, so `ScreenView`
updates and refreshes it in its own steps.

## Anchors

A `ScreenAnchorView` sits beside the `View3D` in the 2D tree, and the walk
refreshes siblings in no fixed order. So the anchor can't place itself,
because it might read the camera before the scene's camera view has moved
it. Instead, it registers with its scene, and `Scene3DView` places it right
after refreshing the scene. It uses `View3D.worldToScreen`, which returns
Pixi's global coordinates.
