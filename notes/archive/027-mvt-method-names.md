# Proposal: Aligning the scene methods with MVT's `update` and `refresh`

> How should this repo's per-frame scene methods line up with MVT's
> `update(deltaMs)` and `refresh()`? This began as a proposal to rename the
> `onUpdate` / `onRefresh` accessors on every node to `update` / `refresh`
> (sections 1-10), found that feasible but costly for outside code, and then
> found a better answer: no methods on nodes at all (section 11). What was
> built is the **tick API**. A view sets its steps with
> `setTickMethods(view, { update, refresh })`, a host ticks its scene with
> `tickScene({ root, deltaMs })`, and "tick" is MVT's umbrella term for both.
> Section 0 states the outcome; the rest is the record of how it was reached.

**Status:** implemented by task
[028](028-tick-api-migration.md), and archived. Sections 3-6.3
(the rename) are superseded and kept as the record of why it was dropped.
Section 7's dev checks are partly done: 7.6's `deltaMs` check is in, without
its sign rule; 7.4 is moot; the rest are filed in task
[017](../tasks/backlog/017-misc-loose-ends.md).

**Written:** 2026-09-30, against Pixi 8.21.0, three 0.186.1 (`@types/three`
0.186), TypeScript 5.9, happy-dom 20, and this repo at `aa1f37f` plus the
working tree. Type behaviour was checked with `tsc` in a scratch project
outside the repo, with the renamed augmentation applied to the real Pixi and
three typings. Clashes were found by walking every exported `Container` and
`Object3D` subclass's prototype chain at runtime. Section 11 added
2026-10-01, section 12 and the outcome 2026-10-02, when this document was
rewritten around the outcome.

**Related:** [scene-passes.ts](../../src/mvt-utils/scene-passes.ts) and
[scene-methods.ts](../../src/mvt-utils/scene-methods.ts) (the core; the
latter was `scene-node.ts`) -
[container-mixin.ts](../../src/pixi-mvt/container-mixin.ts),
[object3d-mixin.ts](../../src/three-mvt/object3d-mixin.ts),
[element-mixin.ts](../../src/html-mvt/element-mixin.ts) (the three installs) -
[destroy-registry.ts](../../src/mvt-utils/destroy-registry.ts) -
[attributes.ts](../../src/mvt-utils/jsx/attributes.ts) (`MVT_ATTRIBUTE_KEYS`) -
[001](001-mvt-plugin-rework-plan.md) (where the current names come
from) - [003](003-mvt-plugin-appraisal.md) "API review" (which
praised them for mirroring Pixi's `onRender`) -
[011](./011-multi-package-repo.md) (the published packages) -
[022](../proposals/022-renderer-agnostic-jsx.md) section 9.2 (methods on
`Element.prototype`).

---

## 0. Outcome

**The tick vocabulary.** "Tick" is the umbrella term for one turn of the
ticker's loop, and is MVT's own T. The architecture docs introduce it
(`docs/architecture/ticker.md`, "Ticks"):

| What gets ticked | What a tick does |
| --- | --- |
| a model | its `update(deltaMs)` |
| a view | its `update(deltaMs)`, if it has one, then its `refresh()` |
| a renderer's scene | the update scene pass over a subtree, then the refresh scene pass |
| the app (the ticker) | ticks the models, then the scene; then the renderer draws |

**The API.** Each renderer (`pixi-mvt`, `three-mvt`, `html-mvt`) exports these,
typed to its own node type:

```ts
setTickMethods(view, {
    update: (deltaMs) => { flash.update(deltaMs); },
    refresh: () => { view.alpha = flash.alpha; },
});                                               // a member left out is left as it is; `undefined` clears

setTickMethods(slot, { refresh: (own) => (isPresent() ? own?.() : SKIP_DESCENDANTS) }); // wraps

tickScene({ root: app.stage, deltaMs });          // update scene pass, then refresh scene pass
tickScene({ root, deltaMs, only: 'update' });
tickScene({ root, only: 'refresh' });             // takes no deltaMs

hasUpdate(node); hasRefresh(node);                // booleans; nothing hands out a method
```

Plus `SKIP_DESCENDANTS`, the destroy helpers, and the two counters
(`readCounter`, and `sceneCounter` for the perfmon). There is no second way:
the setters and scene passes underneath are private to `scene-passes.ts`.

**What was decided, and where it was argued:**

| Decision | Section |
| --- | --- |
| No methods on nodes. The `onUpdate` / `onRefresh` accessors, their global type augmentation and the shadowing guard are gone, so no name can clash with a class's own `update` | 11.2, 11.3 |
| Per-node data stays in the private named `_mvt*` fields, with defaults on each renderer's prototype, including `_mvtInvalidators` (variant C). A record per node, symbol keys and a `WeakMap` were each slower or larger | 11.8 |
| A method's declared parameters decide whether it wraps the one it replaces: one or more for a refresh method, two or more for an update method. No getters, so nothing can call a view's step by hand, which makes 7.4 moot | 11.5, task 028 |
| `tickScene` runs a whole tick by default, with `only` to opt out of one scene pass. Its options are a discriminated union, so a missing `deltaMs` is a type error | task 028 |
| In dev builds, `tickScene` throws unless `deltaMs` is a finite number. Negative values are allowed (speed control run backwards) | 7.6, item 1 |
| The JSX attributes keep their names: `onUpdate={}`, `onRefresh={}`, `onDestroyed={}` | 7.2 |
| Sessions advance only their models; the host ticks the stage once per frame and pauses by gating its game container out of the update scene pass | task 028 |
| The name `setTickMethods` (first `onTick`) | 12.4 |

**What is left**, filed in task 017 or for the published packages (011): 7.5
(b) and (c), 7.6 item 2, 11.7's duplicate-copy mitigations, and
`Symbol.for` for `SKIP_DESCENDANTS` (7.6 item 3).

## Summary of the original rename proposal

> Superseded by section 0. These were the recommendations for the rename
> (sections 3-8), before section 11.

| # | Recommendation | Section |
| --- | --- | --- |
| 1 | Rename the node methods to `update` / `refresh` on every renderer. Feasible; no blocker found | 3, 4 |
| 2 | The scene passes and the destroy paths only ever read and write the backing fields, never the public names. This makes every class-defined `update` inert | 4.1 |
| 3 | Installing the methods throws if the prototype chain already has the name, so a future Pixi, three or DOM release that adds one fails at load instead of being silently overwritten | 4.2 |
| 4 | Keep the dev-only shadowing assertion, and make its message name the class and say "wrap it" | 4.3 |
| 5 | A class that brings its own `update` is a leaf. To give it an MVT update, wrap it in a plain group node | 4.4 |
| 6 | JSX attributes keep their `on` prefix: `onUpdate={...}`, `onRefresh={...}` | 7.2 |
| 7 | Before 011 publishes: the packages claim no names. Each application chooses them in a small config, or imports a ready-made `update` / `refresh` entry; shareable code never touches the public names | 6.3 |
| 8 | A dev-only check that throws on any call to a node's `update` or `refresh` that the scene passes did not make | 7.4 |
| 9 | Dev-only checks for methods that will never run: a stale memoised walk (throws), and an `update` no `updateScene` covers (warns) | 7.5 |
| 10 | Dev-only checks on the values the scene passes already handle: `deltaMs` where `updateScene` is entered, and each method's result. Not an argument check on every call. `SKIP_DESCENDANTS` becomes `Symbol.for` | 7.6 |
| 11 | Land the hardening (2-4, 8-10) under the current names first, then rename in one mechanical pass | 8 |

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
| O6 | Outside codebases with their own `update` methods stop compiling | Reduced to warnings for MVT-shaped classes (6.2); an adoption cost otherwise | 6 |
| O7 | A future library or web-platform version adds the name | Yes, fails loudly at load (4.2) | 4.2 |
| O8 | The `on` prefix says "the system calls this, not you" | Mitigated by docs; caught in dev at runtime (7.4) | 7.1, 7.4 |
| O9 | In JSX a function-valued attribute reads as a getter | Resolved by keeping `on` in JSX | 7.2 |
| O10 | `update` already means several things in this repo | Consistent meaning; minor | 7.3 |
| O11 | Migration cost | Mechanical, about 160 code sites | 8 |

## 3. What actually clashes

> **Superseded** (sections 3-6.3): the rename was dropped for section 11's
> design, which puts no public names on nodes, so nothing here can clash.
> Kept as the record of why. The clash survey (3) still describes the
> libraries, and is why the tick API had to avoid public names.

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

> Superseded; see section 3's note.

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

> Superseded; see section 3's note. There is no global type augmentation.

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

> Superseded; see section 3's note. Section 12.1 covers adopting the tick API
> in existing Pixi code instead.

This is the cost the design cannot fully remove, so it is set out on its own. Section 6.2 reduces it.

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
  `installMethods`). It is useful later for a renderer whose base node class
  already has `update`, where 4.2 would refuse the install. (Phaser's
  `GameObject.update` is an example; from memory, not checked.) Keep it as a
  fallback for such a renderer, not as a way to split the vocabulary. It is
  not a fix for existing class-based views (6.2).

### 6.1 What happens to existing class-based views

Two common shapes, checked with `tsc` and with the accessor's runtime
semantics, assuming 4.1-4.3 are in place:

| | `class FooView extends Container { update(deltaMs) {...} }` | `class BarView extends Container { readonly update = (deltaMs) => {...} }` |
| --- | --- | --- |
| Type check | **Error** TS2425 (property in base, method in subclass) | Compiles (`readonly` is allowed) |
| Where `update` lives | `FooView.prototype`, in front of the accessor | Define semantics (`useDefineForClassFields`, the default from target ES2022): an own property on the instance. `[[Set]]` semantics: through the setter, into the backing field |
| Scene passes | Never call it: the backing field is empty | Define: never call it, and in dev the shadowing assertion **throws** on the first scene pass over a tree containing it. `[[Set]]`: **call it every frame** |
| The game's own hand-forwarded `fooView.update(dt)` | Unchanged | Unchanged |
| Net effect | Works as before if the build does not type-check (Vite strips types). Silently left out if the author expects `updateScene` to run it | Define: dev crash, production silently left out. `[[Set]]`: updated **twice per frame** while the hand-forwarding remains |

The `[[Set]]` case is the dangerous one: no error, and presentation state
advancing at double speed. The define case fails loudly, but all at once:
one such class anywhere under `app.stage` stops `refreshScene` in dev.

With the current names, neither class interacts with the scene passes at
all, and a game can adopt `onUpdate` one view at a time.

For an adopter the fix is the same for both: remove the hand-forwarding, and
either assign `this.update = ...` in the constructor (which goes through the
setter under either semantics) or rename the method.

A possible addition to 4.3: in dev, also warn once per class when a walked
node's `update` resolves to something other than the accessor (the `FooView`
case). It would turn "silently left out" into a message, at the cost of also
warning for `AnimatedSprite`, `ParticleContainer`, `LOD` and the helpers
(open question 6).

### 6.2 Helping existing classes

**Option (c) does not help, unless the game chooses the names.** As written,
(c) lets the renderer package choose its names; a game using
`@mvtjs/pixi` would still get `update`. Moving the choice to the game
(say, `onUpdate` for a game full of `FooView`s) would leave its classes
untouched, but it has three costs:

- **Timing.** The names must be known before any method is assigned. Today
  the install runs when the module loads, and 001 removed every other ordering
  rule. So each set of names would need its own entry point
  (`@mvtjs/pixi`, `@mvtjs/pixi/on-names`), or an explicit install call made
  before any view is built.
- **Types.** The augmentation is static. Each entry point would ship its own,
  or the game would write one from an exported generic type.
- **Interop, the decisive one.** Any view written against the MVT names, such
  as a shared widget, the site's common views, or an example from the docs,
  assigns `view.update = ...`. In a game installed with other names, that is
  a plain property on a `Container`. It never runs, and nothing reports it.
  Avoiding that would need a function API for shared code
  (`setUpdate(node, fn)`), which 022 section 9.2 rejected.

That is option (b) plus a runtime failure mode. It would also mean all
library code, not just the walk, must stop using the public names: the JSX
base (`create-jsx.ts`), `<List>` and `<Switch>` read and write `onRefresh`
directly today. That is harmless under 4.1 with fixed names, since `refresh`
clashes with nothing, but it matters once names vary.

**Declaring the members as methods in the augmentation does help.** Checked
with `tsc`: with `update?(deltaMs: number): ...` and `refresh?(): ...`
instead of property signatures:

| Case | Property signatures (5) | Method signatures |
| --- | --- | --- |
| `FooView`: `update(deltaMs)` method | Error TS2425 | Compiles |
| `BarView`: `readonly update = (deltaMs) => ...` | Compiles | Compiles |
| A class with `update(ticker)`, `AnimatedSprite`, `LOD` | Error | Error, unchanged |
| `c.update = (dt) => ...` (`dt` inferred as `number`), `c.update = undefined` | Compiles | Compiles |

So an existing class whose `update` has the MVT shape keeps compiling, and
the classes MVT rules out are still rejected. The cost is small: the
augmentation needs a lint exception for `method-signature-style`, and method
syntax checks parameters bivariantly. For example, a method declared with a
narrower parameter than `number` would be accepted. The lint rule is there to
prevent exactly that.

With method signatures and 4.1-4.3, the legacy shapes behave like this:

- **`FooView`** compiles and runs as before. The scene passes ignore it.
  Open question 6's warning would say so, once per class.
- **`BarView` with define semantics** compiles and runs as before, but in dev
  the shadowing assertion throws. For an own property that is already present
  when the node is first walked, a one-time warning would be enough. Such a
  property was set in the constructor, before the node could be attached, so
  no invalidation was lost. It is only ignored, the same as `FooView`.
- **`BarView` with `[[Set]]` semantics** is still the hazard. Its field goes
  through the setter, so it is a real scene method, and it runs twice per
  frame while the game still forwards by hand. A plain assignment cannot be
  told from a deliberate one, but the hand-forwarding can be caught when it
  happens: 7.4's dev-only check throws on the forwarded call.

Together, these bring a legacy game close to today's behaviour with
`onUpdate`: its classes compile, run as before, and are left alone by the
scene passes, with a message pointing at each one. Migrating a class then
means removing its hand-forwarding and assigning its method through the
accessor. For `FooView`, that means renaming the method, since an
assignment to `this.update` on an instance whose class defines `update`
never reaches the setter. For `BarView`, it means moving the field's
initialiser into the constructor as `this.update = ...`.

Not recommended: letting the scene passes call class-defined methods for
classes that opt in (`adoptSceneMethods(FooView)`). It would work, but the
loop would have to call methods with a receiver (`method.call(node, dt)`),
since `FooView.update` uses `this`. It would also add a second way to define
methods, built around classes, which the repo otherwise rules out.

### 6.3 Let each project choose the names

**The idea.** The library never commits to names for the two scene methods.
A consuming project chooses them in one small config file of its own, which
declares the global types and installs the accessors, and which it imports
for its side effects. A ready-made entry point installs `update` / `refresh`
for projects that want the MVT names with no config.

This revisits 6.2's rejection of game-chosen names. There, the decisive
cost was interop: a view written against one set of names silently does
nothing in a project that uses another. Below, that cost is contained by a
rule for shareable code, and it buys something 6.2's alternatives could not:
the library no longer claims any name on Pixi's, three's or the DOM's
prototypes unless the project asks it to.

#### Feasible: yes

- **Runtime.** With 4.1, the scene passes already read and write only the
  backing fields. 6.3 extends that to *all* library code. That is about 48
  sites in 11 files, many of which 4.1 touches anyway:
  - the JSX base (`create-jsx.ts`, `list.ts`, `switch.ts`, `jsx-target.ts`)
  - `DestroyRegistry` and the three mixins
  - the `SceneNode` type

  They go through internal functions instead, `setUpdate(node, fn)`,
  `setRefresh(node, fn)` and the matching getters, which write the backing
  field and invalidate. The core install (memo fields, structural wrappers)
  stays at module load. Only the two public accessors move to the project's
  config.
- **Types,** checked with `tsc`. An interface can extend a mapped type of the
  chosen names. The install call can be typed so that it only compiles when
  its names match the declared types: a mismatch is a compile error. The
  unchosen name is a compile error too ("Property 'update' does not exist...
  Did you mean 'onUpdate'?"), `deltaMs` is still inferred, and a legacy
  `FooView` with its own `update` compiles untouched.
- **JSX needs no config.** The JSX attributes keep fixed names (7.2), and the
  runtime uses the internal setters. A project that writes every view in JSX
  could skip the config entirely and claim nothing on any prototype.

#### The minimal config

The ready-made entry, as the first import of the app's entry module:

```ts
import '@mvtjs/pixi/scene-methods'; // installs `update` / `refresh`, with types
```

A project choosing other names, for example one full of `FooView`s:

```ts
// src/mvt-config.ts
import { installSceneMethods, type SceneMethods } from '@mvtjs/pixi';

declare global {
    namespace PixiMixins {
        interface Container extends SceneMethods<'onUpdate', 'onRefresh'> {}
    }
}

installSceneMethods({ update: 'onUpdate', refresh: 'onRefresh' });
```

It is imported first in `main.ts`, and listed in Vitest's `setupFiles` and
in the benchmark harness. On the library side, `SceneMethods` is a mapped
type, and `installSceneMethods` takes only names whose declared types match.
three's version repeats `Object3D`'s type parameter in its
`declare module 'three/src/core/Object3D.js'` block, and the DOM's extends
`Element`. Those details are why the ready-made entries matter: few projects
should ever write this file.

#### What it solves

- **Adoption (6, 6.1).** A codebase with its own `update` methods picks
  other names: no TS2425, no shadowing, no dev crash, and it can migrate one
  class at a time. Open question 2, whether the packages should claim
  `update`, goes away because the packages no longer decide it.
- **Restraint with other people's prototypes.** Nothing public is added to
  `Container`, `Object3D` or `Element` unless the project asks for it.
  That addresses 022 section 9.2's unease about changing `Element.prototype`,
  and O7's future-collision risk becomes the project's informed choice.
- **Renderers whose base class already has `update`** (option (c)'s
  original purpose) need no special case.
- **This repo's own migration (section 8 step 3).** The config could
  install both names as aliases of the same backing fields, so files can move
  from `onUpdate` to `update` one at a time with the build green. Then the old
  alias is dropped.
- **Discipline.** It forces 4.1 to be complete, rather than covering only the
  walk.

#### Risks and downsides

- **Interop between projects (the 6.2 objection).** A shareable view
  compiled against `update` assigns a plain property in a project that chose
  `onUpdate`. It never runs, and nothing reports it.
  - The rule that contains this: **shareable code never touches the public
    names.** A published view package, a widget kit, or anything meant to
    work in more than one project writes its views in JSX, or calls the
    exported `setUpdate` / `setRefresh`. It also never imports the
    ready-made entry, because only the application installs names. No such
    packages exist yet, so the rule can be in place before the first one.
  - A dev check can back the rule up: 7.5's rebuild already visits every
    node, so it can warn once per class about an own, function-valued
    property with a conventional name (`update`, `refresh`, `onUpdate`,
    `onRefresh`) that is not this project's name. This also flags a legacy
    `BarView`, which is arguably useful.
  - Within one project, the names are uniform and type-checked, so there is
    no interop risk there. That includes this repo's `src/common/` views.
- **Two vocabularies in the wild.** Docs, examples, skills and `llms.txt`
  teach `update` / `refresh`. A project that chose differently translates,
  and its agents and contributors may write the MVT names. In TypeScript
  that fails to compile with a "did you mean" hint. Plain JavaScript gets
  only the dev warning above. Channel choices toward two sets: the docs say
  "`update` / `refresh`, unless your codebase already uses those names, then
  `onUpdate` / `onRefresh`".
- **One more setup step, and an ordering rule.** Hello-world gains an import
  line, and the config must run before any view assigns a method. The
  pixi-mvt rework removed exactly that kind of rule (the mixin's comment:
  "Importing this module is the only ordering requirement"). The consequences
  are bounded:
  - Forgetting the config is a compile error at the first `view.update =`.
  - Importing it too late leaves own properties, which 4.3's assertion throws
    on.
  - Tests and benchmarks need it in their setup, and forgetting it there
    fails loudly the same way.
- **Custom names lose 6.2's method signatures.** A mapped type can only
  produce property signatures. That matters less for custom names, which are
  chosen not to clash. The ready-made `update` / `refresh` entry can declare
  method signatures by hand.
- **The config can declare one thing and install another.** The typed
  install call closes this off in TypeScript.
- **Internal discipline must be enforced, or it erodes.** Run the
  conformance suite and the scene-pass tests under a deliberately odd config
  (`__testUpdate` / `__testRefresh`). Any library code that still uses a
  public name then fails.
- **The core's types change shape.** `SceneNode` stops declaring the methods;
  generic code such as `createScenePasses<N>` and `JsxTarget` is typed
  against the memo fields and the internal setters instead. This is
  contained, but it touches every renderer.

#### Recommendation: yes, as the shape of the published packages

Adopt 6.3, with four conditions:

1. 4.1 is extended to all library code (the internal setters and getters),
   and the odd-names test run enforces it. Worth doing now, whatever else is
   decided, because it keeps this door open cheaply.
2. Ready-made entries for `update` / `refresh` on each renderer. These are
   what the docs teach and what this repo uses. A second set for
   `onUpdate` / `onRefresh` is optional; it would make the adoption path a
   one-line import too.
3. The shareable-code rule (above) is written into the docs and the skills,
   with the dev warning behind it.
4. Only applications install names. Packages never do.

It turns the question "should the library claim `update`?" from a bet into
each project's choice, with the MVT names as the default. Its main cost is
an ordering rule that fails loudly when it is broken.

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
  A dev-only runtime check (7.4) catches it when it happens anyway. It
  replaces the typed ESLint rule considered here earlier: a lint rule cannot
  follow a method once it is stored in a variable, handed to the ticker, or
  called from another module.

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
`MVT_ATTRIBUTE_KEYS` and the rule that no
element table may define those names. It is workable, but it gives up the
"function means getter" reading. Only 9 JSX sites use these attributes.

### 7.3 `update` already means several things here (O10)

Models, view models, tweens, sequences, slot lists and `GameSession` all have
`update(deltaMs)`. The contract is the same everywhere (advance by `deltaMs`),
so the overlap is consistent, and it reads naturally:
`view.update = (deltaMs) => pieces.update(deltaMs)`. What gets worse is
finding "every view's update step" by text search. That is minor.

### 7.4 A dev-only check for hand calls

> Moot: nothing hands out a node's method, so there is no call to make by hand
> (section 0). A port that keeps forwarding `child.update(dt)` fails to
> compile.

**What it catches:** any call to a node's `update` or `refresh` that the
scene passes did not make. That covers the likely porting and wiring errors:

- A parent forwarding to its children (`child.update(dt)` inside its own
  `update`). This is the most common one, and it happens *during* a scene
  pass. So "called outside a scene pass" is the wrong test, and the idea as
  first sketched in 6.2 would have missed it. The right test is "not called
  by the walk, for this node".
- A session or host calling `gameView.update(dt)` instead of `updateScene`.
- Wiring a view to Pixi directly: `app.ticker.add(view.update)`, or
  `view.onRender = view.refresh`.
- A view refreshing itself from an input handler, instead of relaying the
  input and letting the next frame refresh.
- A `BarView`-style field under `[[Set]]` semantics that is still forwarded
  by hand (6.2).

**How it works:**

1. In dev, the setter stores the method in the backing field as now, plus a
   wrapper that knows its node. The getter returns the wrapper. The scene
   passes read the backing field (4.1), so they call the original. So in dev,
   any call through the public property was not made by the walk.
2. One exception is composition on the same node:
   `const own = el.refresh; el.refresh = () => { own?.(); step(); }`. The
   node's new method calls its previous one. `create-jsx`'s `addRefreshStep`,
   `<List>`'s slot wrapper and `<Switch>`'s branch wrapper all do this, and
   user code may copy it. To allow it, the walk records in dev which node's
   method it is running. That is one module-level variable shared by every
   renderer's scene passes, like `methodAssignments`, saved and restored
   around each call so nested scene passes work. A wrapper called while its
   own node is running is allowed. Any other call throws.
3. The setter unwraps a wrapper it is given (`b.refresh = a.refresh`), so a
   wrapper never reaches a backing field, and the setter's identity check
   compares originals.

The error names the node and the method, and gives the fix: "Don't forward;
the scene passes call every node's `update`. To refresh a subtree now, call
`refreshScene(node)`." Nested refresh scene passes already run each node
exactly once. The error's stack trace points at the offending call.

**Throw rather than warn**, like the other dev assertions (re-entry,
shadowing), because the stack trace is what makes it useful. A hand-called
`update` is a real bug: that state advances twice per frame. A hand-called
`refresh` only wastes work, but it is still a wiring mistake, and
`refreshScene(child)` is the sanctioned way to refresh a subtree now. There
is no equivalent for `update`, and none is needed (open question 9).

**What it cannot catch:**

- A closure called directly rather than through the node. For example, a
  port that keeps the old `{ container, update }` record and forwards through
  it. Nothing marks such a call.
- Class-defined methods (`FooView`), which don't go through the accessor.
  The walk doesn't call them either, so nothing runs twice. 6.1's warning
  covers them.
- Production builds.

**What it costs:**

- Nothing in production. `DEV` is replaced at build time, so Vite drops the
  checks. The Node benchmarks run with `DEV` false.
- In dev: one closure per method assignment, and one store and restore per
  method call in the walk.
- In dev, `el.update === fn` is false, and the function's `name` and
  `length` differ. Nothing in `src/` compares them.
- Vitest runs with `DEV` true, so the check runs in the test suite, which is
  where porting errors should surface. Only one test helper calls methods by
  hand: `create-jsx.test.ts` line 45, a hand-rolled walk, which would move to
  `refreshScene`. The benchmarks' naive-walk baselines
  (`scene-passes.case.ts`, `html-scene-passes.case.ts`) call methods by hand,
  but they run without `DEV`.

**Feasibility:** small. The change is confined to the accessor install and
the two invoke loops in `scene-passes.ts`, plus tests for each case above.
It doesn't depend on the rename, so it belongs in step 1 of section 8, and
it is worth having under the current names too.

**Verdict: worthwhile.** It is the runtime answer to O8. It catches calls a
lint rule cannot see, and it turns 6.2's `[[Set]]` hazard from silent double
speed into an error with a stack trace.

### 7.5 A dev-only check for methods that never run

> Not done. (a) went with the accessors; (b) and (c) are filed in task 017.

The converse of 7.4: a node carries an `update` or `refresh` that no scene
pass will call. There are four ways that can happen:

| Case | Example | Detectable? |
| --- | --- | --- |
| a. A class-defined method hides the accessor | `FooView` (6.1) | Yes, when a walk is rebuilt (open question 6) |
| b. The tree is walked, but the memoised walk is stale | A child added by pushing onto Pixi's or three's `children` array directly; happy-dom's observer gap (`element-mixin.ts`); a bug in the invalidation wrappers | Yes, exactly |
| c. One kind of scene pass walks the tree, but no pass of the other kind covers the node | An animated pause menu with an `update`, under `app.stage`. `src/main.ts` runs `refreshScene(app.stage)` every frame, but `updateScene` only over `cabinetContainer` and each game view, so that `update` never runs | Yes, with one rule |
| d. No scene pass walks the tree at all | A view rendered into a `RenderTexture` without a `refreshScene`; an orphan | Only with a renderer hook |

**(b) Stale walks.** At the start of a scene pass, before any method runs, the
memoised walk must match a fresh build of the tree: everything that changes
the tree should have invalidated it. In dev, every Nth scene pass on a root,
build a fresh list and compare. A mismatch is always a bug, so throw, naming
the missing or extra node. For the DOM, the comparison comes after
`beforeScenePass` has taken the observer's records. The cost is one full
rebuild every N scene passes, in dev only. This check also serves as a
standing test of the invalidation wrappers, the part of the design that 001
and 003 found hardest to get right.

**(c) Coverage.** The rule that works: a node is covered for `update` if it,
or one of its ancestors, has *ever* been passed to `updateScene`. It must be
"ever" rather than "recently". While this repo is paused,
`updateScene(cabinetContainer)` keeps running but the game session's
`updateScene(gameView)` does not, so a recency rule would flag every game
view on pause.

- `updateScene` marks the node it is given: one field, in dev.
- Rebuilding a refresh walk already visits every node of the refreshed tree
  (`has` never exits early). So in dev it can collect the nodes there that
  carry an `update`, and keep that list with the memo, discarded along with
  it. There is no global registry of nodes, so nothing leaks.
- Every Nth refresh scene pass, check each collected node that is still
  attached. If neither it nor any ancestor is marked, warn once per node:
  "`'label'` has an `update` method, but no `updateScene` covers it. Pass its
  tree to `updateScene`, or remove the method."
- The update walk's rebuild gives the symmetric check (a `refresh` in a tree
  that is updated but never refreshed) at the same cost. That case is rarer.

Warn rather than throw: an uncovered method is almost always a mistake, but
not certainly one. Limits: coverage is structural. A covered node whose root
stops being updated after some phase is not caught, because "ever" cannot
tell that apart from a pause.

**By-product: overlapping update roots.** The same marks show when a node
has two marked ancestors, or a marked ancestor besides itself. That means two
`updateScene` calls cover it, and its state advances twice per update. For
example, someone adds `updateScene(app.stage)` while the sessions still
update their own game views. 7.4 cannot see this, because both calls come
from walks. The coverage check finds it while walking up from each node, and
warns.

**(d) Unwalked trees.** Neither scene pass sees these, so only the renderer
can. Pixi 8.21 emits a `prerender` runner with the container being rendered,
and three calls `scene.onBeforeRender`. A dev hook there could check that the
root being rendered was refreshed since its last render. This repo's
thumbnail path (`refreshScene(tempStage)`, then `renderer.render`) would
pass. But it needs code per renderer and a way to attach to the renderer
(Pixi: an extension or an explicit dev call; three: a patched `render`).
Defer it until a real bug calls for it.

**Frequency, and tests.** At every 60th scene pass, reports arrive within
about a second at 60 fps. Most tests run a handful of scene passes, so they
would rarely reach the check. Under Vitest (`import.meta.env.MODE ===
'test'`), N can be 1. The fresh build then doubles the cost of each scene
pass in tests, which is acceptable.

**Verdict: worthwhile for (b) and (c).** (b) is exact and cheap, and it
guards the library's own trickiest code. (c) catches a class of wiring error
that this repo's shape invites: several update roots under one refresh root.
(a) is open question 6, and (d) is deferred. All of it lives in the
renderer-agnostic core, so Pixi, three and the DOM get it together. None of
it depends on the rename.

### 7.6 Checking arguments and results

> Item 1 is done, without its sign rule: negative `deltaMs` is allowed. Item 2
> is filed in task 017, and item 3 waits for the published packages (011).

**The idea:** in dev, check that every `update` call receives one number and
every `refresh` call receives no arguments. That would catch calls the
scene passes did not make, such as Pixi's ticker handing a view its `Ticker`.

**As stated, it adds little:**

- **The scene passes' own calls are correct by construction.** Checking them
  would test this library, not the view. Also, to keep a single call site
  (012), the loop calls `refresh` methods with `deltaMs` set to `0`
  (`method(deltaMs)` in `invokeSubtreeMethods`), so "no arguments" would first
  need that call site split.
- **Any other call can only be intercepted through 7.4's wrapper, and 7.4
  already throws for every such call, whatever its arguments.**
  `app.ticker.add(view.update)` and `view.onRender = view.refresh` are both
  caught there. The only calls left for an argument check are a node calling
  its own previous method (`own(ticker)`), which is rare.
- **TypeScript already rejects the definitions and the calls**, checked with
  `tsc`: `updateScene(view, ticker)`, an update method that takes a `Ticker`,
  a refresh method that takes a parameter, `async` methods, and methods that
  return a boolean. A runtime check would add only JavaScript callers, `any`
  and casts.
- **It can't see the likeliest Pixi mistake.**
  `updateScene(view, ticker.deltaTime)` passes Pixi's frame-scaled delta
  (about 1) instead of `ticker.deltaMS` (about 16.7). It is a number, it type
  checks, and presentation state runs about 17 times too slow. No check can
  tell that apart from a test stepping 1 ms. Leave it to the pixi-mvt README,
  which should name it.

**What is worth keeping is checking the values the scene passes already
handle:**

1. **`deltaMs`, once, where `updateScene` is entered.** In dev, throw unless
   it is a finite number of zero or more. That catches a `Ticker` or
   `undefined` passed from JavaScript or `any`, and `NaN` from a bad
   calculation, which type checks and quietly poisons every piece of
   presentation state it reaches. It costs one test per scene pass, not per
   method. Whether a negative `deltaMs` should throw or be allowed (speed
   control run backwards) is open question 12.
2. **Each method's result, in the loop.** The loop already compares every
   result with `SKIP_DESCENDANTS`. In dev, on the other path, throw if the
   result is anything but `undefined`. That catches:
   - an `async` method from JavaScript or a cast. It returns a `Promise`, and
     its work lands after the frame is drawn.
   - `true` or `false` returned in the belief that it means "skip".
   - `SKIP_DESCENDANTS` from **another copy** of the base library. It is
     created with `Symbol('mvt.skipDescendants')`, so two instances of the
     module disagree, and the skip is silently ignored. Types can't catch this
     when both copies are the same version: a bundler that loads one version
     twice, a known Vite hazard with linked packages, gives identical types
     and two symbols. The message can name that cause.

   The check costs one comparison per call in dev and nothing in production.
   Include the scene-pass loop in 7.4's benchmark check anyway.
3. **Always, not just in dev: make the symbol shared.**
   `Symbol.for('mvt.skipDescendants')` makes every copy of the library agree.
   That removes the duplicate-copy case, rather than only reporting it. The
   cost is that any code can create the symbol, which is harmless here.

**Verdict:** don't add the argument check. Add 1 and 2, which are cheap and
sit where the scene passes already handle the values, and make change 3 when
the packages are published (011).

## 8. Migration plan

> Superseded by task 028, which migrated to the tick API instead.

1. **Harden under the current names:** 4.1 (backing fields only), 4.2
   (install guard), 4.3 (message), 7.4 (hand-call check), 7.5 (stale-walk
   and coverage checks), 7.6 (`deltaMs` and result checks, `Symbol.for`). Add tests: a tree containing an
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

> Answered as follows. 1: kept (7.2). 2, 6, 7, 8, 13, 14: moot, with no
> public names. 3: `_mvtUpdateMethod` / `_mvtRefreshMethod`, with the other
> fields renamed to match in task 028. 5: not needed so far. 9: moot (7.4).
> 10, 11: open, with 7.5 in task 017. 12: negative `deltaMs` is allowed. 15:
> yes, with named fields (11.8) and no getters. 16: open, for 011.

1. JSX attribute names: keep `onUpdate` / `onRefresh` (recommended, 7.2), or
   rename them too?
2. Published contract (6): accept that `@mvtjs/pixi` / `@mvtjs/three` claim
   `update` on every node? Superseded by 6.3 if it is adopted.
3. Backing-field names. `_mvtUpdate` is already the update walk, so
   `_mvtOnUpdate` becomes something like `_mvtUpdateMethod` /
   `_mvtRefreshMethod`.
4. ~~Is `PassiveSpine` a `Spine` subclass?~~ Settled (2026-09-30): it
   extends `Container` and has a `Spine`, so it has no class-defined `update`
   and can carry `update` / `refresh` like any container. The inner `Spine`
   is a leaf the scene passes never call (4.1).
5. Is the typed lint rule of 7.1 wanted up front, or only if hand-forwarding
   reappears?
6. Should dev mode warn once per class whose `update` shadows the accessor
   (6.1)? It helps adopters with `FooView`-style classes and is noise for
   library leaves such as `LOD`.
7. Should the augmentation use method signatures (6.2), at the cost of a lint
   exception and bivariant parameter checks, so that existing classes with an
   MVT-shaped `update` keep compiling?
8. Should the shadowing assertion become a one-time warning for an own
   property already present when a node is first walked (6.2)?
9. 7.4's check: throw (recommended), or warn once per node? Should a hand
   call to `refresh`, which is only wasted work, be treated the same as one
   to `update`, which is a bug?
10. 7.5: how often should the stale-walk and coverage checks run in dev
    (every 60th scene pass suggested), and should Vitest run them on every
    scene pass?
11. 7.5 (d): is a renderer hook for trees rendered without a refresh wanted
    now, or deferred (recommended)?
12. 7.6: should a negative `deltaMs` throw, or is running speed control
    backwards a supported use?
13. 6.3: adopt project-chosen names? If so, ship a ready-made
    `onUpdate` / `onRefresh` entry as well as the `update` / `refresh` one?
14. 6.3: should a JSX-only project be able to skip the config entirely, or
    should every project install names, so plain TypeScript views can be
    added later without a setup step?
15. 11: adopt `setUpdate` / `setRefresh` with no methods on the nodes, in
    place of the rename? If so, store the record under a symbol-keyed
    property or in a `WeakMap` (spike and measure), and export getters, a
    composing helper, or neither?
16. 11.7: share one core between copies of the same protocol (mitigation 3),
    or only detect and warn? Should the duplicate-copy warning stay on in
    production?

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
- **`PassiveSpine` is unaffected.** It extends `Container` and has a
  `Spine`; it is not a `Spine`.
- **Not verified here:** Spine and Lit (neither is installed), and Phaser's
  `GameObject.update` (from memory).

## 11. Alternative: no methods on the nodes at all

> Added 2026-10-01. If adopted, this replaces the rename rather than adding to
> it: most of sections 3-7.1 and 6.3 become unnecessary (11.3).

### 11.1 What the prototypes are used for today

The mixins change renderer prototypes in three ways:

1. **The public accessors** `onUpdate` / `onRefresh`. They are how a view
   attaches a step, and their setters invalidate the memoised walks.
2. **The memo fields** (`_mvt*`), per-node storage for the walks. They have
   defaults on the prototype and are written as own properties on each node a
   walk visits.
3. **Structural wrappers** on Pixi's and three's tree methods (`addChild`,
   `add` and the rest), and Pixi's `destroy`. These are how the walks hear
   about tree changes. The DOM uses a `MutationObserver` instead.

Only 1 claims a name and needs global types, and it is the source of every
clash in this proposal. Nothing but the scene passes is meant to call the
methods (7.4), so the accessor's only remaining job is attaching a step, and
a function does that equally well.

### 11.2 The design

- **Two functions from the base, the same on every renderer:**
  `setUpdate(node, fn | undefined)` and `setRefresh(node, fn | undefined)`.
  The JSX attributes keep their names (7.2) and call these.
- **One record per node** holds what the accessors and memo fields hold now:
  the two methods, the has-flags, the walks, the catch-up stamp, and the
  node's tree (its renderer's `SceneTree`). It is reached through a
  symbol-keyed property (`node[SCENE]`) or a `WeakMap` (11.4).
- **`setUpdate` / `setRefresh` invalidate by climbing with the tree stored in
  the record.** A node with no record has never been visited by a walk. Either
  no walk covers it, or it was attached after its ancestors' walks were built,
  and attaching it cleared those walks. Either way there is nothing to
  invalidate. So the functions need no dispatch by renderer, which answers
  the objection in 022 section 9.2 that a function form would make plain
  TypeScript views look different on each renderer: they would not.
- **The structural wrappers stay on Pixi and three, as now.** They claim no
  names and need no types. Both libraries emit parent-side events (Pixi
  `childAdded` / `childRemoved`, three `childadded` / `childremoved`; both
  checked), so listeners could replace the wrappers. But that means a
  listener on every container in a walked tree, so measure before switching.
  On the DOM, which has no wrappers, nothing at all is added to the prototype.

### 11.3 What becomes unnecessary

- **The naming question itself.** There is no property, so there is nothing
  to name. The MVT names appear in `setUpdate` / `setRefresh`, and in the docs
  as "a view's `update(deltaMs)` step, attached with `setUpdate`".
- **Every class clash** (3, 4, 5, 6, 6.1, 6.2). `FooView`, `BarView`,
  `AnimatedSprite`, `LOD` and Lit's `update` are never seen, never shadowed,
  and never type errors.
- **Everything that existed to support the public accessors:** the global
  type augmentation for the methods, 6.3's config and its ordering rule, 4.2's
  install guard, 4.3's shadowing assertion, and 7.5 (a).
- **Most of 7.4.** There is no `view.update(dt)` to call by hand, so a port
  that keeps forwarding fails to compile. 7.4 is needed only if a getter is
  exported (11.5).
- **O7, O8 and O10.**

Still relevant: 7.2 (JSX attribute names), 7.5 (b) and (c), and 7.6.

### 11.4 Performance

The steady-state loop never reads per-node storage. It walks the cached list
with its cached methods (012 section 2) and reads the renderer's own `parent`.
The storage is read only:

- once per scene pass, on the root;
- in rebuilds, for each node visited;
- in invalidation climbs;
- in catch-up rounds.

For those, the two ways to store the record compare like this:

- **A symbol-keyed record.** One read on varied node shapes, then every
  further read on a single record shape. Today each `_mvt*` read is on a
  varied Pixi shape (`Container`, `Sprite`, `Text`, `Graphics`...), which is
  the pattern 012 measured as costly. So rebuilds and climbs may get faster,
  not just stay level. The costs: one small object per visited node,
  allocated on its first visit, and one own property added to each renderer
  object. Today's fields add up to seven.
- **A `WeakMap`.** It never touches renderer objects, but every access is a
  hash lookup. Scenes that rebuild a lot (`<List>` churn, falling sand) would
  pay most.

None of this is measured yet. Spike the symbol-keyed record first, against
the existing suites: `scene-passes` (churn, scaling), `falling-sand-scaling`,
`games-and-demos` and `html-scene-passes`.

### 11.5 Costs and risks

- **Call sites change.** Plain TypeScript views go from
  `view.onRefresh = () => {...}` to `setRefresh(view, () => {...})`. That is
  about 160 sites, mechanical, the same size as the rename.
- **Reading a step back.** Composition (`const own = el.onRefresh; ...`)
  needs a `getRefresh(el)`, or a helper such as `addRefreshStep(el, fn)`. An
  exported getter reopens hand calls (`getUpdate(view)!(dt)`), though only
  deliberate ones, and 7.4's check could wrap whatever it returns. The smaller
  surface is to export the setters and a composing helper, and no getters.
- **Debugging.** Today `container.onRefresh` is visible in devtools. A
  symbol-keyed property still shows there; a `WeakMap` hides everything, so it
  would want a dev helper (`describeSceneNode(node)`).
- **The docs still need a footnote.** MVT's docs describe `update` and
  `refresh` as methods on the view; here they are steps attached to it. The
  footnote becomes "attach a view's update with `setUpdate`", which is
  natural, rather than a renaming.
- **It reverses a decision.** 022 section 9.2 chose accessors over functions;
  11.2 gives the reason that objection no longer holds.

### 11.6 Recommendation

> Adopted, with the named fields of 11.8 rather than a record, and with
> `setTickMethods` / `tickScene` (section 0) rather than separate
> `setUpdate` / `setRefresh` exports.

Prefer this over the rename, and over 6.3. Suggested order:

1. Spike the symbol-keyed record and `setUpdate` / `setRefresh`, with the
   current accessors kept as thin wrappers that call them, so the build stays
   green. Benchmark it.
2. If it is level or better, migrate the call sites, then remove the
   accessors and the global type augmentation.
3. The checks that still apply (7.5 (b) and (c), 7.6) can land first, or
   alongside.

### 11.7 More than one copy in a program

**How it happens.** Once the packages are published (011), one program can
load two copies of the base, or of a renderer package:

- **The same version, loaded twice by tooling.** For example, Vite's
  dependency pre-bundling reaches the package by two paths, a linked
  workspace package has its own `node_modules`, or both an ESM and a CJS
  build are loaded.
- **Two versions.** For example, the app depends on `@mvtjs/pixi@2`, and a
  widget kit pins `@mvtjs/pixi@1`, so npm nests a second copy.

**What breaks.** Everything the scene passes keep at module level is per
copy:

| State | If each copy has its own |
| --- | --- |
| The record key: `Symbol('...')` or a `WeakMap` (11.2) | A view set up by one copy carries a record the other copy cannot see. The app's `refreshScene` never runs the widget kit's views, and **nothing reports it** |
| `SKIP_DESCENDANTS` | A skip from the other copy is ignored (7.6) |
| `methodAssignments` | A step assigned through one copy during the other's scene pass is missed; the pass keeps calling a cached method, even a cleared one |
| The refresh pass id, re-entry guard and nested walks | A nested `refreshScene` from the other copy is not deduplicated, so nodes refresh twice |
| The DOM's observer and watched set | Each copy watches only its own roots |
| The Pixi / three structural wrappers | Both copies wrap the prototypes. Each invalidates only its own storage, so the cost is doubled and the destroy warning fires twice |

**Today's design is not immune either.** Its memo fields are plain string
names (`_mvtOnRefresh`), so two copies of the *same* version share them by
accident and mostly work. They still split everything in the table except
the fields. Two *different* versions read each other's fields with whatever
meaning each gives them. Section 11's symbol key turns that accidental
sharing into a clean split, which is more predictable, and silent unless
something checks.

**Mitigations, all cheap:**

1. **Detect it, always, at load.** Each copy adds itself, with its version,
   to a global registry (`globalThis[Symbol.for('mvtjs.instances')]`). A
   second entry logs one warning that names both versions and how to
   deduplicate (`npm dedupe`, `overrides`, Vite's `resolve.dedupe`). three
   ("Multiple instances of Three.js being imported") and Lit do the same. It
   costs one check per copy, so it can stay on in production, where the
   silent failure would otherwise show up first.
2. **Package so that one copy is the norm.** The base is a
   `peerDependency` of each renderer package. The renderer package (and the
   base) is a `peerDependency` of any widget or view package, never a
   `dependency`. That is how Pixi plugins depend on `pixi.js`. Document
   `resolve.dedupe` for Vite.
3. **Let copies of the same protocol share one core.** The first copy to
   load publishes its core on `globalThis` under a key that carries a
   protocol version: `Symbol.for('mvtjs.core.v1')`. The core here means the
   record key, the counters, the pass state, `SKIP_DESCENDANTS` and the
   setters. A later copy with the same protocol uses that core instead of
   its own. The protocol version changes whenever the record's layout or the
   shared state's meaning changes, so incompatible copies never share. This
   makes the common case, the same version loaded twice by tooling, simply
   work. The cost: whichever copy loads first supplies the code, so a fix in
   a later-loaded patch release does not apply. Mitigation 1's warning says
   so.
4. **In dev, flag nodes from an incompatible copy.** Rebuilds already visit
   every node (7.5), so they can check for another protocol's record key and
   warn once: "this node was set up by a different, incompatible copy of
   @mvtjs; its update and refresh will not run".
5. **Wrap the prototypes once.** Mark `Container.prototype` and
   `Object3D.prototype` with a protocol-versioned symbol when wrapping them,
   so a second copy of the same protocol skips its wrappers. A copy of
   another protocol still wraps, which is correct, since its storage is
   separate.

Two more things to check:

- **Vitest.** Make sure that a core left on `globalThis` cannot outlive the
  module instances of an earlier test file, by checking how the pool and
  `isolate` settings scope `globalThis`.
- **This repo.** It is not affected today: `#mvt-utils` and relative imports
  resolve to the same module. This matters from 011 onward.

**Recommendation:** all five, when the packages are published. 1, 2, 4 and 5
make every remaining case loud. 3 removes the most common case outright.

### 11.8 Spike results (2026-10-01)

**What was built.** It is uncommitted on branch `vnext-027`, on top of
`6b431f7` (task 025's single eval-free refresh builder): 13 files.

- `setUpdate`, `setRefresh`, `getUpdate` and `getRefresh` are exported from
  `mvt-utils`, and work on any renderer's nodes.
- The JSX base, `<List>`, `<Switch>`, `DestroyRegistry` and Pixi's `destroy`
  wrapper use them, and no longer read or write `onUpdate` / `onRefresh`.
- Each node's passes are reached through a default on its prototype, which
  is how a setter invalidates the right tree with no dispatch by renderer
  (11.2). A plain-object node gets them when a walk first visits it.
- `onUpdate` / `onRefresh` remain only as transitional accessors over the
  setters, so views, tests and benchmarks are otherwise unchanged.
- The structural wrappers are untouched.

**Feasible: yes, for all three variants tried.**

- Type checks (app and benchmarks) and lint pass.
- All 1115 tests pass.
- With the transitional accessors and the prototype defaults switched off,
  all 443 JSX tests pass: the base, and the conformance suites of all three
  renderers. So no library code needs a public method name.

**Where the per-node data lives decides the performance.** Each variant was
benchmarked against a detached baseline worktree at the same commit,
interleaved, with the order reversed in the second round:

| Variant | Per-node storage | Result |
| --- | --- | --- |
| A | One record object per node, behind `Symbol('mvt.sceneRecord')` | Level at 1,000 nodes. 3-10% slower at 10,000-100,000, where the extra object per node spreads the nodes out in memory. +88 bytes kept alive per node, and +110 bytes allocated per node built. `<List>` pools 6-7% faster |
| B | The same fields as symbol-keyed properties of the node, with symbol-keyed defaults on the prototype | Memory identical to the baseline. Level at scale. But churn 40-90% slower: V8 reads a symbol-keyed property found only on the prototype slowly once the read site sees many node shapes (profiled: `visit`, then `has`). A named property in the same position is fast |
| **C** | **The baseline's own private `_mvt*` fields, with their prototype defaults** | **Level with the baseline on every suite run, and identical memory.** Churn 2% faster |
| D | One record object per node, like A, but under one named field, `_mvt`, with a prototype default | +88 bytes kept alive per node and +9% allocated per node built, as A. 4-7% slower at 100,000 containers (C, in the same run: +1% to +6%); churn +7%; attaching subtrees 12% faster. A dummy 8-field object allocated next to each node in C slows the steady loop by 2.5-4% on its own, so the extra object explains D's cost at scale, and the symbol key in A was not the problem |
| E1 | One record object per node, in a module-level `WeakMap`: nothing stored on nodes at all | Ruled out. Churn +137%, invalidation and attach +15-24% (a hash lookup per node). Steady frames 45-234% slower in the harness at 50,000-100,000 nodes, about 20% in a standalone bundle of the same scene. That steady-state cost is not garbage collection (4% of time in both profiles) and not lookups (the loop does none); it is unexplained |

For C, `scene-passes`, `construction`, `jsx-refresh`, `scaling` and
`memory` are all within noise. At 100,000 containers, C first looked 5-13%
slower. Rerun with both sides in worktrees, it was within -1.3% to +2.8%. The
first runs were from the main checkout, where `npm run bench` rewrites
`refresh-copies.ts` under the running Vite dev server; Solid's rows, which
the change cannot affect, were 3-5% slower there too. `games-and-demos`,
`falling-sand-scaling` and `html-scene-passes` were not run.

**Not tried: E2**, events instead of the structural wrappers. Leaving
renderer objects untouched also means keeping the per-node data off them,
which is E1's storage and its costs, before any listener costs. Revisit only
if a concrete need appears, such as frozen nodes, or a library that rejects
patched prototypes.

**Decision for 11.2: the private fields stay named.** 11.4 expected a
symbol-keyed record to be at least as fast. It is not (A), and moving the
same fields to symbol keys is worse (B). What section 11 is for still
holds with C:

- There are no public method names.
- There is no global type augmentation for the methods, once the
  transitional accessors go.
- There are no class clashes, since a class's own `update` or `refresh` is
  never seen.

What remains on the prototype is the `_mvt*` fields that are already there
today. They are underscore-prefixed implementation details that need no
declared types, and they are the fastest storage measured.

**Noise, for whoever measures next.** The `memory` suite's `watch()` case
allocated 1,437 bytes per frame in some rounds of both baseline and spike,
and none in others. That is a V8 optimization flip, not the change. Vitest
in the main checkout also picks up test files inside
`.claude/worktrees/`; run it with `--exclude ".claude/**"` while spike
worktrees exist.

**Next steps** (all done by task 028).

1. Migrate the call sites from `view.onRefresh = ...` to
   `setRefresh(view, ...)`: about 160 in `src/`, plus the benchmarks and the
   docs.
2. Remove the transitional accessors and the `SceneNode` augmentation from
   the three mixins.
3. Decide 11.5's open points: whether to export the getters, and whether to
   add a helper for composing steps.
4. Run `games-and-demos` from two worktrees as a final check.

## 12. Adoption, interop and the dependency direction (2026-10-02)

> Discussion notes from the session that designed the tick API, kept for task
> 028's docs phase and for whoever publishes the packages (011). They assume
> 028 is complete: the `onUpdate` / `onRefresh` accessors are gone, and a
> renderer's public surface is `tickScene`, `onTick` (to be renamed
> `setTickMethods`, 12.4), `hasUpdate` / `hasRefresh` and `SKIP_DESCENDANTS`.

### 12.1 Upgrading existing Pixi code incrementally

The case: a Pixi app whose views have hand-forwarded `update(dt)` chains and
refresh through Pixi's `onRender`. The tick API can be adopted one node at a
time.

**Why it can:**

- **Importing the mixin is invisible to existing code.** It adds only private
  `_mvt*` field defaults and wraps `Container.prototype`'s tree methods. It
  adds no public names and no global types. So classes with their own
  `update` methods compile and run as before (section 6.1's `TS2425` problem
  is gone), and so do `onRender` and `AnimatedSprite`.
- **Unconverted subtrees cost almost nothing.** A scene pass prunes subtrees
  with no methods after its first walk. The tree-method wrappers measured at
  about 1-2% on code that changes the tree heavily.
- **Each node, and each of its two steps, converts separately.** `onTick`
  leaves members it isn't given as they are.

**The path:**

1. Add one `tickScene` call to the ticker: for the whole stage, or for each
   converted root, as long as the roots don't overlap. Pixi's ticker runs it
   before the render.
2. Move refresh logic one node at a time: `view.onRender = refresh` becomes
   `onTick(view, { refresh })`. Don't keep both on one node, or it refreshes
   twice a frame.
3. Untangle update chains at the edges:
   - when a child converts, its parent stops forwarding `child.update(dt)`, or
     the child updates twice a frame;
   - a parent that converts first can forward to its unconverted children from
     its own update step, as a temporary bridge;
   - converting from the leaves up is simplest.

   The library can't see double calls made through old code, so this needs
   care. 7.5's coverage check would catch the opposite mistake: a converted
   update no `tickScene` root reaches.

**Behaviour differences to check:**

- **Sibling order is not guaranteed.** Scene passes only promise parents
  before descendants, so a hand-written chain that relies on one child
  updating before another breaks once both convert. This is the most likely
  surprise.
- **Refresh moves earlier,** from during the render to just before it.
- **`cacheAsTexture` subtrees are refreshed by `tickScene`,** where
  `onRender` does not fire. Code that relied on that freeze changes a cached
  subtree's content without `updateCacheTexture`, and the display goes stale.
- **A render-on-demand app** must call `tickScene` before each render;
  `onRender` fired per render on its own.
- **Time units:** old chains often take Pixi's `Ticker` or `deltaTime` (in
  frames); converted updates get `deltaMs`.
- **Own-timing objects** (`AnimatedSprite`, an auto-updating Spine) keep
  running on Pixi's ticker. That works during migration but isn't MVT-pure.

### 12.2 One game using an old-style library and a tick-based one

A transitional case, until libraries align. It integrates without much
trouble:

- **The tick-based library's components** set their steps with `onTick`, and
  the game's host calls `tickScene` once a frame. They work anywhere in the
  tree, under old-style parents too, since the scene passes walk any
  `Container`.
- **The old library's components** keep refreshing through `onRender`, during
  the render, after `tickScene`. Their update chains still need calling every
  frame. A few lines adapt them into the tick:

  ```ts
  /** Ticks an old-style component's update chain with the rest of the scene. */
  function adoptLegacy<C extends Container & { update: (deltaMs: number) => void }>(component: C): C {
      onTick(component, { update: (deltaMs) => component.update(deltaMs) });
      return component;
  }
  ```

  This only works because the tick API puts no public names on nodes: the
  component's own `update` method and the mixin's fields cannot collide.
- **The frame order holds for both:** models, then every view update (adopted
  old components included, parents first), then the tick-based refreshes,
  then the render with the old `onRender` refreshes.
- **Pausing covers both.** Adopted components sit under the host's pause gate,
  while their `onRender` keeps them drawn.
- **Nesting works both ways.** A tick-based component holding an old one
  adopts it, or forwards to it from its own update step. An old component
  holding a tick-based one needs nothing.

**The catches:**

- Adopt an old component at the top of its own chain, and don't also call it
  from an old parent's chain, or it updates twice.
- Convert time units inside the adapter.
- Adopt a chain that depends on its children's update order as one unit,
  since scene passes don't guarantee sibling order.
- **A library built on an earlier version of this mixin is a different
  case:** two copies of the mixin in one program. That is section 11.7's
  problem, and needs its protocol-versioned sharing.

### 12.3 Does the tick API invert dependencies?

pixi-solid's `onTick(callback)` has been criticised for violating the
dependency inversion principle. It subscribes a component to the Pixi
application's ticker, found through Solid's context. So:

- the component depends on a concrete clock its signature doesn't show;
- it can't run without a live app and ticker, which makes tests, headless
  runs, fast-forwarding and replays hard;
- the ticker, not the caller, decides when the callback runs, and with what
  time.

**Those criticisms don't apply to this `onTick`, which does the opposite
under the same name.** It subscribes to nothing. It attaches a node's two
steps to that node, and they run only when some caller ticks an ancestor with
an explicit `deltaMs`:

- **The dependency is inverted.** A view depends only on "I will be ticked
  with a `deltaMs`". Whoever owns time decides when and how: Pixi's ticker, a
  fixed timestep, a paused gate, a thumbnail's fast-forward, or a test.
- **Nothing is hidden.** The node is passed in explicitly. A form with no node
  argument, using an implicit "current view", was considered and avoided for
  that reason.
- **It's easy to test.** `tickScene({ root: view, deltaMs: 16 })` steps a view
  with no app, ticker or renderer. The `games-and-demos` benchmark already
  runs every game headless under Node, and the scene passes work even on plain
  objects.

**What does still apply, in weaker forms:**

- **The contract is implicit.** A view that sets its steps assumes some
  ancestor is ticked; if none is, its steps never run, silently. This is
  equally true of explicit `update` methods: a parent that forgets to forward
  `child.update(dt)` gets a frozen child and no error. The difference is where
  the obligation shows. An explicit method puts it in the child's type but
  adds a place to forget it at every composition site. The tick API hides it
  from types but satisfies it once per root. Neither enforces it. A dev
  coverage check (7.5 c) recovers most of the visibility.
- **Importing has global effects.** The mixin patches `Container.prototype`,
  and the scene passes keep a little module-level state (the assignment
  counter, pass ids). Tests can't substitute it, though it needs no setup and
  behaves deterministically.
- **The name `onTick` invites the misreading** "subscribe to the ticker", the
  very pattern criticised above. That is the reason for 12.4.

### 12.4 The name: `setTickMethods`

`onTick` reads as a clock subscription (pixi-solid, Pixi's `ticker.add`), and
its "on" suggests adding a listener, where a call replaces the members it is
given. It also stretches this repo's convention that `on…` names a relay
binding or an event handler.

| Candidate | For | Against |
| --- | --- | --- |
| `onTick` | short; reads as natural English | reads as a clock subscription; "on" suggests listeners that add up |
| `setTick` | an assignment; pairs with `tickScene` | "setting a tick" is odd English |
| **`setTickMethods`** | **says exactly what happens; "methods" is MVT's word, and matches the internal `TickMethods` type; no event connotation** | **longest; the members are strictly function-valued properties, though the docs already say "refresh method" throughout** |
| `whenTicked` | reads best; its passive voice gets the dependency direction right | still event-flavoured: a second call silently replaces the first unless it declares `prev`, the one way this API surprises people |
| `defineTick` | declarative | suggests a single definition, but members can be set separately |
| `tickWith` | reads as a sentence | could read as ticking now |
| `setTickSteps`, `setSteps` | precise, or neutral | wordy, or loses the link to `tickScene` |
| `tickable` | could return the node, for a one-line view | reads like a predicate |
| `defineView`, `asView` | MVT's "a view has update and refresh" | "view" already means the `XxxView` function here |

**Chosen: `setTickMethods`.** The rename was task
[029](029-rename-ontick-to-settickmethods.md), done 2026-10-02.
Decided there: it returns nothing, as `onTick` did, so a view ends with
`setTickMethods(view, { refresh });` and then `return view;`.
