# Proposal: `update` and `refresh` as the scene methods' names

> Rename the per-frame methods the scene passes call, `onUpdate` and
> `onRefresh`, to the names MVT's documentation already uses: `update` and
> `refresh`. This note goes back over each objection to doing that, checked
> against the installed Pixi, three.js and DOM typings and runtimes. It
> concludes that the rename is feasible on all three renderers, with three
> small hardening changes to the scene-pass core. The only real cost it cannot
> remove is friction for outside codebases that already give their own
> subclasses an `update` method. That matters for the published packages
> (011), and not at all for this repo.

**Status:** proposed. Investigation only; no code changed.

**Written:** 2026-09-30, against Pixi 8.21.0, three 0.186.1 (`@types/three`
0.186), TypeScript 5.9, happy-dom 20, and this repo at `aa1f37f` plus the
working tree. Type behaviour was checked with `tsc` in a scratch project
outside the repo, with the renamed augmentation applied to the real Pixi and
three typings. Clashes were found by walking every exported `Container` and
`Object3D` subclass's prototype chain at runtime.

**Related:** [scene-passes.ts](../../src/mvt-utils/scene-passes.ts) and
[scene-node.ts](../../src/mvt-utils/scene-node.ts) (the core) -
[container-mixin.ts](../../src/pixi-mvt/container-mixin.ts),
[object3d-mixin.ts](../../src/three-mvt/object3d-mixin.ts),
[element-mixin.ts](../../src/html-mvt/element-mixin.ts) (the three installs) -
[destroy-registry.ts](../../src/mvt-utils/destroy-registry.ts) -
[attributes.ts](../../src/mvt-utils/jsx/attributes.ts) (`MVT_ATTRIBUTE_KEYS`) -
[001](../archive/001-mvt-plugin-rework-plan.md) (where the current names come
from) - [003](../archive/003-mvt-plugin-appraisal.md) "API review" (which
praised them for mirroring Pixi's `onRender`) -
[011](011-multi-package-repo.md) (the published packages) -
[022](022-renderer-agnostic-jsx.md) section 9.2 (methods on
`Element.prototype`).

---

## Summary

| # | Recommendation | Section |
| --- | --- | --- |
| 1 | Rename the node methods to `update` / `refresh` on every renderer. Feasible; no blocker found | 3, 4 |
| 2 | The scene passes and the destroy paths only ever read and write the backing fields, never the public names. This makes every class-defined `update` inert | 4.1 |
| 3 | Installing the methods throws if the prototype chain already has the name, so a future Pixi, three or DOM release that adds one fails at load instead of being silently overwritten | 4.2 |
| 4 | Keep the dev-only shadowing assertion, and make its message name the class and say "wrap it" | 4.3 |
| 5 | A class that brings its own `update` is a leaf. To give it an MVT update, wrap it in a plain group node | 4.4 |
| 6 | JSX attributes keep their `on` prefix: `onUpdate={...}`, `onRefresh={...}` | 7.2 |
| 7 | Decide, before 011 publishes, whether `@mvtjs/pixi` and `@mvtjs/three` claim `update` on every node. Recommended: yes, with a migration note | 6 |
| 8 | Land the hardening (2-4) under the current names first, then rename in one mechanical pass | 8 |

---

## 1. Why align

- **One vocabulary.** The architecture docs, the style guide and every skill
  say `update(deltaMs)` and `refresh()`. Today each of them needs a footnote:
  AGENTS.md ("In this repo, `refresh()` and `update(deltaMs)` are a view
  container's `onRefresh` and `onUpdate`"), the glossary, `the-game-loop.md`'s
  project section, `llms.txt` and the view skill. Every reader, human or agent,
  has to do the mapping. After the rename the footnotes go away.
- **The current names break this repo's own naming rule.** A binding named
  `on` + something is a relay binding, reporting what the user did
  (`onFirePressed`). `onRefresh` on a view looks exactly like one. `refresh`
  does not.
- **`onUpdate` is one underscore away from a Pixi internal.** Pixi 8's
  `Container._onUpdate(point)` is the `ObservablePoint` observer callback: "my
  transform changed". That meaning is unrelated to ours.
- **Familiar.** An engine's per-frame hook is usually called `update` (Unity's
  `Update`, which 001 section 3.1 already cited).

## 2. The objections to re-examine

The current names were chosen during the pixi-mvt rework (001) to mirror
Pixi's `onRender`, and 003 approved them on that basis. The notes do not
record a clash analysis, so this list reconstructs the objections from the
code and the libraries:

| # | Objection | Resolved? | Section |
| --- | --- | --- | --- |
| O1 | Library classes already define `update` (`AnimatedSprite` and others), so the scene passes would call them | Yes, fully (4.1) | 3, 4 |
| O2 | Assigning an MVT `update` to such a class bypasses the accessor | Caught in dev (4.3); design rule (4.4) | 4 |
| O3 | Our own writes (`destroy`) would overwrite a library's `update` | Yes, fully (4.1) | 4 |
| O4 | Some library constructors assign `this.update = fn` | Residual, documented | 4.4 |
| O5 | TypeScript: our augmentation conflicts with class declarations | Mostly a feature; one cast for three's `LOD` / `CubeCamera` | 5 |
| O6 | Outside codebases with their own `update` methods stop compiling | Not removable; an adoption cost | 6 |
| O7 | A future library or web-platform version adds the name | Yes, fails loudly at load (4.2) | 4.2 |
| O8 | The `on` prefix says "the system calls this, not you" | Mitigated by docs; optional lint | 7.1 |
| O9 | In JSX a function-valued attribute reads as a getter | Resolved by keeping `on` in JSX | 7.2 |
| O10 | `update` already means several things in this repo | Consistent meaning; minor | 7.3 |
| O11 | Migration cost | Mechanical, about 160 code sites | 8 |

## 3. What actually clashes

Every exported node class of each library was scanned at runtime for
`update` and `refresh` anywhere on its prototype chain:

| Library | Class | Member | What it does |
| --- | --- | --- | --- |
| Pixi | `AnimatedSprite` | `update(ticker)` | Advances its own playhead from `ticker.deltaTime` |
| Pixi | `GifSprite` (`pixi.js/gif`) | `update(ticker)` | Same, for GIFs |
| Pixi | `ParticleContainer` | `update()` | Marks static properties dirty, so they are re-uploaded |
| three core | `LOD` | `update(camera)` | Picks a level; **called by `WebGLRenderer` itself** during render when `autoUpdate` is set |
| three core | `CubeCamera` | `update(renderer, scene)` | Renders the six faces |
| three core | `BoxHelper`, `CameraHelper`, `DirectionalLightHelper`, `HemisphereLightHelper`, `PointLightHelper`, `SpotLightHelper` | `update()` | Recomputes the helper's geometry |
| three addons | About 15 files, mostly helpers (`VertexNormalsHelper`, `OctreeHelper`, `PositionalAudioHelper`...), plus `MorphBlendMesh.update(delta)` | `update(...)` | Various |
| three addons | `ViewHelper`, `MarchingCubes` | `this.update = function` **in the constructor** | Animates itself / re-polygonises the field |
| DOM | none | - | No `Element` member in `lib.dom.d.ts`; none on 18 element kinds in happy-dom |
| Web components | Lit's `ReactiveElement` (not installed; from Lit's documented lifecycle) | `protected update(changedProperties)` | Lit's render step |
| Spine | `spine-pixi-v8`'s `Spine` (not installed; from memory, **verify**) | `update(dt)`, `dt` in seconds | Advances the skeleton |

**`refresh` clashes with nothing** in Pixi, three core, three addons or the
DOM. All the risk sits on `update`.

**None of the clashing classes are used in this repo** (a grep of `src/`,
`benchmarks/`, `scripts/` and `site/`). None appears in any JSX element table.

## 4. Runtime: making clashes harmless

Today the accessors are installed on the base prototype (`Container`,
`Object3D`, `Element`). A subclass whose own prototype defines `update` sits
in front of that accessor in the chain. So on its instances, `node.update`
is the library's method, and `node.update = fn` creates an own data property
without ever reaching our setter. If the rename only changed the strings,
four things would go wrong:

| Failure | Example | Effect |
| --- | --- | --- |
| a. The walk reads `node.update`, finds the library's method, and calls it with `deltaMs` | `AnimatedSprite` | Nothing while stopped. While playing it reads `ticker.deltaTime` off a number and the playhead becomes `NaN` |
| | `ParticleContainer` | Static properties re-uploaded every frame: a silent performance loss |
| | `LOD` | Throws: the "camera" is a number |
| | Helpers | Geometry recomputed every frame |
| | `Spine`, if confirmed | Advances 1000x too fast (seconds, not milliseconds) |
| b. A view assigns `node.update = fn` on such an instance | `anim.update = ...` | Own property: no invalidation, and the library's own method is gone |
| c. Our `destroy` wrappers assign `node.update = undefined` | `destroyObject(lod)` | Leaves an own `update: undefined`. If that `LOD` is added to a scene again, three's renderer throws `object.update is not a function` (`destroyObject` detaches, it does not dispose) |
| d. A library constructor assigns `this.update = fn` | `ViewHelper`, `MarchingCubes` | Goes through our setter, so the scene pass calls it every frame |

### 4.1 Read and write the backing fields only

Change the core so nothing inside it touches the public names:

- `collectSubtreeMethods`, `has`, the live-read path of
  `invokeSubtreeMethods`, and `invokeMissedMethods` read `_mvtOnUpdate` /
  `_mvtOnRefresh` (to be renamed, see 9) rather than `node.update` /
  `node.refresh`.
- The `Container.destroy` wrapper and `DestroyRegistry` clear methods through
  an internal helper. It writes the backing field and invalidates, just as the
  setter does, but it never assigns the public property.

That removes failures a and c completely. The rule becomes: **only a method
assigned through the base accessor ever runs.** A class-defined `update` is
invisible to the scene passes, and the library keeps calling its own (three's
renderer still calls `LOD.update(camera)`).

Performance: the accessor's getter already just reads the field, so reading
the field directly is neutral or slightly better. It only affects list
rebuilds, not the steady-state loop, which already calls cached methods
(012 section 2). Confirm with `npm run bench`.

### 4.2 Guard the install

`installMethods` uses `Object.defineProperties`, which today would silently
**replace** a `Container.prototype.update` if a future Pixi added one. Before
installing, throw if the name is already anywhere on the prototype chain. A
Pixi, three or DOM upgrade that claims the name then fails at load, in the
test suite, rather than breaking the library. This check is worth adding for
the current names too.

### 4.3 Keep the shadowing assertion, with a better message

`assertNoShadowedMethods` (dev only) already throws when a walked node has
the method as an own property, and that is exactly failure b. Keep it for the
new names. Make the message name the class
(`node.constructor.name`) and give the fix: "`AnimatedSprite` defines its own
`update`, so it cannot carry a view's update method. Put the method on a
container around it." It fires when the node is next walked, not at
assignment. Only patching each clashing class would catch it at assignment,
and that is not worth doing.

### 4.4 The design rule, and what is left

**A class that brings its own `update` is a leaf.** It can sit in an MVT tree
and it can have a `refresh`, since `refresh` is free on every class. To give
it an update step, wrap it in a plain `container` / `group`. That matches how
MVT views already use these classes:

- Own-timing classes (`AnimatedSprite`, `GifSprite`, `ViewHelper`, an
  auto-updating `Spine`) break MVT's time rule anyway. The repo uses a `Sprite`
  whose `texture` is set in `refresh`, and a passive Spine posed in `refresh`.
- Presentation classes (`ParticleContainer`, `LOD`, `CubeCamera`, helpers)
  work unchanged as leaves. Their own `update` is called by the renderer or by
  a view's `refresh`, as before.

**Residual (failure d):** a library constructor that assigns
`this.update = fn` cannot be told apart from a view doing the same. The two
known cases, `ViewHelper` and `MarchingCubes`, are three addons that MVT
views would not use as-is. Document this in the three-mvt notes rather than
engineer around it.

## 5. Types

Checked with `tsc` 5.9 (`skipLibCheck` on, as in this repo), with
`update: UpdateMethod | undefined` merged into `PixiMixins.Container` and
three's `Object3D`:

| Case | Result |
| --- | --- |
| `stage.addChild(new AnimatedSprite(...))` | **Error** TS2345: `update(ticker)` is not assignable to `UpdateMethod` |
| `anim.update = (dt: number) => {}` | **Error** TS2322 |
| `scene.add(new LOD())` | **Error** TS2345: `update(camera)` (verified; `CubeCamera` and `MorphBlendMesh` have the same shape) |
| `stage.addChild(new ParticleContainer())`, `scene.add(new CameraHelper(...))` | Compiles: a zero-argument method is assignable. The runtime guards in 4.1 cover these |
| A user `class Player extends Container { update(deltaMs: number) {} }` | **Error** TS2425: base declares a property, subclass a method |
| A user `update(ticker: Ticker)` method | **Error** TS2416 and TS2425, and not assignable to `Container` |
| A user arrow-function field `update = (deltaMs) => {}` | Compiles, but `useDefineForClassFields` makes it an own property, so 4.3 throws in dev |

For Pixi, the error is welcome. It turns "don't use `AnimatedSprite`" from a
convention into a compile error. For three's `LOD` and `CubeCamera`, which
are legitimate presentation objects, it costs a cast
(`scene.add(lod as unknown as Object3D)`) or a small typed helper. Neither is
used here.

## 6. Outside codebases: the published packages (O6)

This is the one cost the design cannot remove, so it is set out on its own.

**In this repo it costs nothing:** there are no classes (style rule 4), and no
clashing library class is used.

**For `@mvtjs/pixi` and `@mvtjs/three` (011)** the augmentation is global
once imported. Any codebase adopting them that has a `Container` or
`Object3D` subclass declaring `update` stops compiling (TS2425 above), even
if it never runs a scene pass on that class. Pixi and three codebases very
often have such subclasses. This repo's own former `StatefulPixiView` pattern
was one. `onUpdate` collides with none of them, and `refresh` is rare in
either ecosystem.

Options:

- **(a) Accept it (recommended).** The fix for the adopter is to rename their
  method. Often it is a hand-forwarded `update` chain, which is exactly what
  the scene passes replace, so the rename is the first step of adopting them
  anyway. Put a short migration note in each package README, and record the
  cost in 011.
- **(b) Keep `onUpdate` in the published packages only.** Then this repo's
  docs and the packages' docs would disagree, which undoes the point.
- **(c) Let each renderer choose its method names** (an option to
  `installMethods`). This costs little once 4.1 is in, because the core would
  never read the names. It is useful later for a renderer whose base node
  class already has `update`, where 4.2 would refuse the install. (Phaser's
  `GameObject.update` is an example; from memory, not checked.) Keep it as a
  fallback for such a renderer, not as a way to split the vocabulary.

## 7. The other objections

### 7.1 The `on` prefix says "don't call me" (O8)

The prefix does signal "a hook the system calls". Without it, someone may
hand-forward again (`child.update(deltaMs)`), and that child's presentation
state would then advance twice per frame. Three things weaken this
objection:

- MVT's own model is that the ticker calls the view's `update`. The repo's
  `updateScene(root, deltaMs)` *is* that call, applied to the whole tree, so
  the name now says what the step is.
- The failure is visible (animations run at double speed), not silent. A
  hand-called `refresh()` is idempotent, so it only wastes work.
- Docs cover it in one sentence, next to "views never forward these calls".
  If it turns up in review, a small typed ESLint rule can flag `.update(` /
  `.refresh(` calls whose receiver is a `Container`, `Object3D` or `Element`.
  Don't build that until it is needed.

### 7.2 JSX attributes (O9)

Keep `onUpdate={...}` and `onRefresh={...}` as the JSX attribute names, and
rename only the node properties:

- In this JSX, a function given to a non-`on` attribute is a getter
  (`x={() => model.x}`). `refresh={(el) => ...}` would be the one exception to
  that reading. An `on` attribute takes a handler (`onPointerTap`,
  `onDestroyed`), and a per-frame step is a handler.
- The `onRefresh` attribute is not the element's refresh method anyway. It is
  a step appended after the element's bindings, it receives the element, and
  it is skipped while a `visible` getter hides the element. A different name
  for it is more accurate.
- Docs then read: "`onRefresh={fn}` adds a step to the element's `refresh`;
  `onUpdate={fn}` sets its `update`".

The alternative, `update={...}` / `refresh={...}`, would also mean changing
`MVT_ATTRIBUTE_KEYS`, the precompiler's `MVT_KEYS`, and the rule that no
element table may define those names. It is workable, but it gives up the
"function means getter" reading. Only 9 JSX sites use these attributes.

### 7.3 `update` already means several things here (O10)

Models, view models, tweens, sequences, slot lists and `GameSession` all have
`update(deltaMs)`. The contract is the same everywhere (advance by `deltaMs`),
so the overlap is consistent, and it reads naturally:
`view.update = (deltaMs) => pieces.update(deltaMs)`. What gets worse is
finding "every view's update step" by text search. That is minor.

## 8. Migration plan

1. **Harden under the current names:** 4.1 (backing fields only), 4.2
   (install guard), 4.3 (message). Add tests: a tree containing an
   `AnimatedSprite`, a `ParticleContainer` and an `LOD` runs its scene passes
   without calling them; assigning a method on one throws in dev;
   `destroyObject` on an `LOD` and adding it back renders; installing on a
   prototype that already has the name throws. Run `npm run bench` before and
   after. This step is worth doing even if the rename is not.
2. **Rename the core:** `SceneNode`, the accessors, `SceneMemoFields` (see 9),
   `UpdateMethod` / `RefreshMethod` docs, the three mixins' augmentations,
   `DestroyRegistry`, and the core tests. JSX attribute names stay (7.2).
3. **Rename the call sites:** about 135 `.onRefresh` and 24 `.onUpdate`
   property uses in `src/`, 53 mentions in `benchmarks/`, 8 in `scripts/`,
   and 7 test files. This is mechanical. If a green build at each step is
   wanted, a temporary dev-warning alias (`onUpdate` forwarding to `update`)
   allows going file by file. For a private repo, one pass is simpler.
4. **Docs:** AGENTS.md, the glossary, `the-game-loop.md`'s project section
   (it shrinks to "the ticker's view calls are `updateScene` /
   `refreshScene`"), the skills, `llms.txt`, and the pixi-mvt README and design
   notes. About 200 mentions under `docs/`. Leave `notes/archive/` as it is,
   since it is history.
5. `npm run build`, `npm run lint`, `npm test`, and the benchmarks again.

## 9. Open questions

1. JSX attribute names: keep `onUpdate` / `onRefresh` (recommended, 7.2), or
   rename them too?
2. Published contract (6): accept that `@mvtjs/pixi` / `@mvtjs/three` claim
   `update` on every node?
3. Backing-field names. `_mvtUpdate` is already the update walk, so
   `_mvtOnUpdate` becomes something like `_mvtUpdateMethod` /
   `_mvtRefreshMethod`.
4. Is `PassiveSpine` a `Spine` subclass (so it keeps `Spine.update(dt)` on
   its prototype, and must be wrapped to carry an MVT update), or a wrapper?
   Also confirm `spine-pixi-v8`'s `update` signature.
5. Is the typed lint rule of 7.1 wanted up front, or only if hand-forwarding
   reappears?

## 10. Settled here

Do not reopen without new information:

- **`AnimatedSprite` / `GifSprite` are not a blocker.** After 4.1 the scene
  passes never call them, and the types reject adding them to a container.
  That enforces the rule the repo already follows (a `Sprite` with `texture`
  set in `refresh`).
- **`refresh` clashes with nothing** in Pixi 8.21, three r186 (core and
  addons) or the DOM (typings and happy-dom).
- **The DOM has no `Element` member named `update` or `refresh`.** Checked in
  `lib.dom.d.ts` and happy-dom only. Real browsers were not checked, but 4.2
  would catch one at load.
- **The name itself has no runtime cost.** 4.1 removes an accessor call from
  list rebuilds.
- **Not verified here:** Spine and Lit (neither is installed), and Phaser's
  `GameObject.update` (from memory).
