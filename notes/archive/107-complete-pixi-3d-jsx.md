# Proposal: a complete JSX for PixiJS 3D

> `@mvtjs/pixi-3d` already draws five entries and the showcases, but it
> covers about a third of PixiJS 3D, it leaks the geometry and materials its
> views make, and it has little of what the other renderer packages have
> around them: docs, cheat sheets, playground support, publishing setup.
> This plan makes it complete. Views own what they make and release it when
> they go. Every scene node that suits an element becomes one. Features that
> PixiJS 3D moves on its own clock are driven by `deltaMs` instead. Bridges
> join 3D to 2D both ways. And the package reaches parity with `@mvtjs/pixi`
> and `@mvtjs/three`. The work comes in eight stages, each one reviewed
> before the next starts, and the leak fix comes first.

**Status:** Stages 0 to 7 were built on 2026-11-22, and brought into vnext the same day. The 3D entries that use them, and their playtest, come after. Stage 8, publishing, waits for a PixiJS 3D release past 0.1.0, as task 111. See the progress log, section 8.

**Written:** 2026-11-22, in the `pixi-3d` worktree, against `@pixi/3d` 0.1.0
(first published 2026-11-12), `@mvtjs/pixi-3d` as of b7d0f9dd, and the
uncommitted showcase work beside it (`site-kit/src/showcase/`, the Gallery,
the Newspaper).

**Related:**
[the package](../../packages/libraries/pixi-3d/),
[the JSX base](../../packages/libraries/utils/src/jsx/) and its
[design notes](../../packages/libraries/utils/src/jsx/design-notes.md),
[`@mvtjs/pixi`'s JSX](../../packages/libraries/pixi/src/jsx/) and
[`@mvtjs/three`'s](../../packages/libraries/three/src/jsx/) (the parity
targets), [022](./022-renderer-agnostic-jsx.md) (the base this builds on),
[106, showcases](../archive/106-showcases-as-a-site-mode.md) (the newest user
of the package), and PixiJS 3D's own agent skill, in
`node_modules/@pixi/3d/skills/pixijs-3d/`.

| Decision | Recommendation | Section |
| --- | --- | --- |
| Who frees a view's geometry, materials and textures | The view that made them, declared with an `owns` attribute on any element, in the JSX base for every renderer. A lint rule flags `new` inside `geometry=` and `material=`, which can't be owned | 3.1 |
| Options PixiJS 3D reads only at creation | Spike first: lights' `shadow` looks changeable later. For the rest (a model's `source`, a particle container's `capacity`), a new `creation` write kind in the base, passed to `create` | 3.2 |
| Which elements | `group`, `mesh`, `camera` and the four lights, completed; new `sprite3d`, `batchedMesh` and `model`. Materials and geometry stay attributes, not elements | 3.3 |
| Events | All 13 of PixiJS 3D's pointer events, plus `hitVolume` and `interactiveChildren` | 3.4 |
| Things that move on PixiJS 3D's own clock | Never on `Ticker.shared`. A model's clip plays from a time binding. Particles are a component with an update step. Camera controllers are left out. A lint rule enforces this | 3.5 |
| Bridges | `Scene3DView` completed; a new `ScreenView` (2D on a 3D plane, live from its first frame, optionally interactive); a new `ScreenAnchorView` (2D placed over a 3D point). An HTML `PixiCanvasView` follows, in `@mvtjs/pixi` | 3.6 |
| Package parity | The view tick API re-exported, the checks and tests the others have, build-ready but still private | 3.7 |
| Docs and tools | README, design notes, AGENTS.md, Project Structure, two lines in the book, two cheat sheets, the view skill, PixiJS 3D's own skill registered, playground support | 3.8 |
| Publishing | Kept private until PixiJS 3D has had a release or two after 0.1.0. Publishing then needs only a version and a changeset | 7 |

## 1. Where it stands

**The package.** 775 lines with tests: the tree registration
(`container3d-mixin.ts`), `connectScene`, `connectTexture`, `Scene3DView`,
and a JSX target with ten elements over the shared base. It passes the base's
conformance suite in Node.

**Its users.** 19 JSX files in five entries (the Arcade Hall, Chicane, the
Gallery, the orrery and the Newspaper), and four files in the site kit's
showcase module. Between them they write 85 `<mesh>`es, 33 `<group>`s, one
`<camera>`, two `<ambientLight>`s, one `<directionalLight>` and two
`<pointLight>`s. Plain TypeScript views make another 32 `Mesh3D`s, 16
`Container3D`s, 4 `Camera3D`s and 2 `BatchedMesh3D`s. Most of those are
pools, batches and geometry rebuilt as it moves, which suit plain TypeScript
and stay that way.

**What's missing or wrong, found in use:**

1. **The leak.** The target destroys with `{ children: true }`, and PixiJS 3D
   frees a mesh's geometry and material only when asked. Every geometry,
   material and canvas texture a view makes outlives it. 46 attributes create
   their geometry or material inline (`geometry={new CubeGeometry(...)}`),
   where it can't ever be freed. One view releases what it made, by hand,
   and the rest leak. This is the likely cause of the GPU growth on re-entering the hall.
2. **The sun.** Chicane and the hall build their `DirectionalLight` by hand,
   because its shadow settings were thought to be fixed at creation.
3. **The blank first frame.** `connectTexture` can't render until its
   `View3D` has rendered once, so Chicane's scoreboard and every live screen
   are blank in visual tests and thumbnails.
4. **Coverage.** The elements handle six of PixiJS 3D's 13 pointer events.
   They lack `hitVolume`, `billboardMode`, and elements for `Sprite3D`,
   `BatchedMesh3D` and `Model3D`. Lights lack `shadow`, `radius`, `coneAngle`
   and `penumbra`, cameras lack `mode` and `orthographicSize`, and
   `Scene3DView` lacks `passes` (post-processing).
5. **Features on their own clock.** A model's animation player, particle
   systems, the orbit and first-person cameras and a live texture's
   `autoUpdate` all advance on `Ticker.shared`. That's wall-clock time in a
   view, which MVT rules out, and a view can still use them.
6. **Around the package.** It lacks a README, design notes, a cheat sheet,
   playground support and a publishing setup. It isn't in AGENTS.md, Project Structure,
   the renderer checks or the benchmarks. The view tick API has to be
   imported from `@mvtjs/pixi`.

## 2. What complete means

The package is complete when:

- every PixiJS 3D scene node that makes sense as an element is one, with each
  property a view changes as an attribute of the right write kind (every
  frame, on change, fixed, or at creation);
- every element releases what its view made for it, and a lint rule catches
  what can't be released;
- every feature that moves over time moves only by `deltaMs`, so visual tests
  and thumbnails come out the same every run;
- 3D can hold 2D and 2D can hold 3D through bridges that work from their
  first frame;
- it has everything `@mvtjs/pixi` and `@mvtjs/three` have around them: tests,
  checks, benchmarks, docs, cheat sheets, playground support and a build
  ready to publish.

**Left out on purpose:**

- **Materials and geometry as elements.** They're usually shared, and JSX
  children stay one to one with scene children. A view keeps making them,
  and now owns them (3.1).
- **Writing shaders, render graphs and custom passes.** These are
  PixiJS 3D's own API, used through `ref` and plain TypeScript.
- **Geometry builders.** The hall's low-poly builders and Chicane's strips
  are each entry's own art.
- **A combined 2D and 3D runtime, and removing three.js.** Both were decided
  against on 2026-11-21.
- **Camera controllers** (`OrbitCamera`, `FPSCamera`). They read the DOM
  themselves and move the camera on their own clock. That skips bindings and
  relays, and the repo's own camera views already do the job the MVT way.

## 3. Design

### 3.1 Views own what they make

A view that makes a geometry, material or texture is the one that releases
it. A new MVT attribute, `owns`, works on any element of any renderer. It
lists what's destroyed with that element:

```tsx
const paint = new Material3D({ baseColor: color, roughness: 0.4 });
const body = new CubeGeometry({ width: 4, height: 0.7, depth: 1.8 });
return (
    <group owns={[paint, body]}>
        <mesh geometry={body} material={paint} />
    </group>
);
```

- **It's in the base, not only in 3D.** Pixi views make textures and
  graphics contexts too, and the base already has `onDestroyed`, which
  `owns` builds on. Each target defines how a resource is destroyed (PixiJS 3D's
  `destroy()`, Pixi's `destroy(true)` for a texture), so the base stays
  renderer-agnostic.
- **Shared parts stay explicit.** Convoy's 49 cars shared one set of parts,
  and Chicane's cars still do. The scene view that makes the parts owns them,
  and the car views don't. That's why destroying a mesh's geometry by default
  would be wrong.
- **Lint.** A new rule, `@mvtjs/no-unowned-resource`, flags `new` inside a
  `geometry=`, `material=` or `texture=` attribute, the 46 places today where
  what was made can't be released. Flagging every resource a view makes
  but never lists in `owns` needs type information and data flow. That
  stays an idea unless the simple rule turns out to miss real cases.
- **Proof.** A test helper walks a destroyed tree and reports any geometry,
  material or texture still alive that isn't listed as shared. Each 3D
  entry's visual test file gets one check with it. Before and after the
  fix, the hall's re-entry growth is measured in the browser, which is the
  symptom that started this.

### 3.2 Options known only at creation

A few options are read only by the constructor. Reading the type definitions
narrows the list:

| Option | Changeable later? |
| --- | --- |
| A light's `shadow` (cascades, distance, bias) | Probably: `light.shadow` is a plain object the constructor fills in, read as shadows render. **To verify** |
| A model's `source` and `scene` | Only at creation: `source` is `readonly` |
| A particle container's `capacity`, `space`, `texture` and `extraBits` | Only at creation: all `readonly` |
| A batched mesh's `size` and `instanceData` | `size` looks changeable; the instance data layout, **to verify** |

If the shadow spike passes, the suns become `<directionalLight shadow={...}
/>` and the base stays as it is. The rest still need creation options, so the
base gains a `creation` write kind. Its attributes are collected before the
element is made and passed to `create`, and must be fixed values (a function
value is a type error). The conformance suite gets a case for it, and each
of the four runtimes passes. The other way, making those elements components
instead of intrinsic elements, loses their `ref` types and their attribute
handling, so it's the fallback.

### 3.3 The element table

| Element | Class | Add | Notes |
| --- | --- | --- | --- |
| `group` | `Container3D` | `originX/Y/Z`, `hitVolume`, `interactiveChildren`, the 7 missing events | `angle` (degrees) isn't added: the JSX uses radians throughout |
| `mesh` | `Mesh3D` | `billboardMode`, `receiveShadow` and `castShadow` on change (fixed today), `weights` (on change) | `geometry` and `material` stay on change |
| `sprite3d` | `Sprite3D` | `texture`, `tint`, `alpha`, `alphaMode`, `alphaCutoff`, `anchor`, `width`, `height`, `pixelSize`, `billboardMode` | A picture in the scene that walls can hide |
| `batchedMesh` | `BatchedMesh3D` | `size`, `instanceData` (creation), `geometry`, `material`, `cull` | Each copy's matrix and data are written in `onRefresh` or a plain view. The JSX makes the batch, the view fills it |
| `model` | `Model3D` | `source`, `scene` (creation), `materials`, `clip`, `clipTimeMs` | glTF. Animation in 3.5 |
| `camera` | `Camera3D` | `mode`, `orthographicSize`, `zoom` | `lookAt` already works |
| `ambientLight` | `AmbientLight` | | |
| `directionalLight` | `DirectionalLight` | `shadow` (fixed or creation, from 3.2) | Replaces both hand-made suns |
| `pointLight` | `PointLight` | `radius`, `shadow` | |
| `spotLight` | `SpotLight` | `radius`, `coneAngle`, `penumbra`, `shadow` | |

Each new attribute gets the cheapest write kind that's still correct.
PixiJS 3D's vector setters skip unchanged values, so per-axis transforms
stay every-frame writes. Anything that rebuilds GPU state, such as a
texture, a mode or a shadow setting, is written on change. A table-driven
test checks that each attribute of each element writes the property it
names. The conformance suite checks one attribute per write kind, which
would miss a typo in the other forty.

### 3.4 Events and picking

The element table gains the seven missing events: `pointerenter`,
`pointerleave`, `pointercancel`, `pointerupoutside`, `globalpointermove`,
plus the mouse and touch forms PixiJS 3D lists. It also gains `hitVolume`
(`'box'`, `'geometry'`, or a shape), since without it a node is picked
against its bounding box. `listen` already sets `eventMode: 'static'`.
`Scene3DView` gains a `hitArea` binding: PixiJS 3D's docs warn that a
full-screen view blocks clicks meant for 2D behind it.

### 3.5 Time comes from `deltaMs` only

PixiJS 3D advances four features on `Ticker.shared` unless told otherwise.
Each gets an MVT shape:

- **A model's animation** is driven entirely by bindings. `clip` names the
  clip (on change) and `clipTimeMs` is where it is (every frame). The refresh
  sets the clip state's `time`. The player is made with `autoUpdate: false`
  and `autoPlay: false`, so it never moves itself. Where the time comes from
  is the view's choice: from the model, or from presentation state the view
  advances in its update step. That's how the rest of the repo works.
  Blending between clips waits for an entry that needs it.
- **Particles** are a component, `ParticlesView`, not an intrinsic element.
  A particle system is presentation state that moves every frame, so it
  needs an update step, and an intrinsic element's update slot belongs to its
  `onUpdate` attribute. The component makes the system with
  `autoUpdate: false` and a seeded `createRandom`, and advances it from
  `deltaMs`. It has bindings for whether it's emitting and a count whose
  rises fire a burst, like a sound's reaction. Seeded, a visual test's
  particles land in the same places every run.
- **A live texture** never uses `autoUpdate`. `ScreenView` draws it (3.6).
- **Camera controllers** are left out (section 2).

PixiJS 3D's `update(ticker)` methods accept a `Ticker`. An internal stand-in
object, written in place each frame with `deltaMS`, passes `deltaMs`
through without allocating.

A lint rule, `@mvtjs/no-self-updating-3d`, flags `new Model3D`,
`ParticleSystem3D`, `OrbitCamera`, `FPSCamera` and `ContainerTexture` in a
view file unless `autoUpdate: false` is written (and, for a model,
`autoPlay: false`). That keeps the Critical Rule against autonomous
animation as true for 3D as for 2D.

### 3.6 Bridges

As agreed on 2026-11-21, each renderer has its own bridges, written as
components.

- **`Scene3DView`** (2D holding 3D) exists. It gains `passes`
  (post-processing such as bloom), `shadowQuality`, `shadowFilter`,
  `exposure`, `anchor` and `hitArea`. Settings that are cheap to change accept
  functions: `exposure` probably does, and the fog's colour and distances
  need checking. The rest stay read once, since changing them rebuilds
  shaders.
- **`ScreenView`** (3D holding 2D) is new, and replaces `ContainerTexture`
  plus `connectTexture` written by hand. It's a plane showing a live 2D
  container, with bindings for its size in pixels and in metres, its
  resolution, clear colour and whether it's lit. It owns its texture.
  - **It's live from its first frame.** Two fixes to try. One renders
    pending screens from the `View3D`'s `onRender` hook, before the 3D pass
    samples them, if a nested render there is safe in Pixi 8. The other
    passes the renderer down: the entry host would pass it to starters, and
    `Scene3DView` would receive it as a binding. The spike picks one.
  - **It can be interactive.** An `isInteractive` binding replaces the
    showcase's `forwardPointerToStage`, so a pointer on the plane reaches the
    2D buttons drawn on it. Chicane's board, the showcases' live screens and
    the Newspaper's pages would use it.
- **`ScreenAnchorView`** (2D placed over a 3D point) is new. It's a Pixi
  container that follows a point in the scene through
  `View3D.worldToScreen`, for name tags and markers that stay crisp and
  always draw on top. There's an ordering problem: the walk visits siblings
  in any order, so an anchor beside the `View3D` could read last
  frame's camera. The fix is for anchors to register with their
  `Scene3DView`, which places them right after refreshing its scene.
- **An HTML `PixiCanvasView`** (HTML holding Pixi) belongs in `@mvtjs/pixi`,
  not here. It owns a Pixi application, its async start-up, sizing,
  rendering after its stage refreshes, and destroying it without releasing
  shared resources. It would remove most of Fruit Machine's renderer setup.
  It's a follow-on task, raised once this lands.

### 3.7 Parity with the other renderer packages

- **The view tick API** is re-exported from `@mvtjs/pixi-3d`, so a 3D view
  file imports `setUpdate` from the package it draws with, as AGENTS.md
  says to. The `renderer-view-tick-api` check gains pixi-3d, and so do
  `view-type-registration` and `one-copy-of-utils`.
- **Tests** the others have and this lacks: `second-copy.test.ts`, a target
  test, and the table-driven element test (3.3).
- **Design notes** in `src/jsx/design-notes.md`, like Pixi's: why elements
  are what they are, the write kinds, ownership, time.
- **Build-ready, still private.** A `tsdown.config.ts`, `exports` with
  `types` and `dist`, `files`, `LICENSE`, a README, and publint and attw
  passing in a dry run. `"private": true` stays until the decision in
  section 7.
- **Benchmarks.** A pixi-3d case in the `jsx-refresh` and `construction`
  suites beside three's, so the cost per element is measured, not assumed.

### 3.8 Docs and tools

- **The package README**: what it is, `Scene3DView` and the bridges, the
  elements, ownership, time, and the two traps PixiJS 3D sets (import
  `@pixi/3d` before any renderer starts, and never `autoUpdate`).
- **AGENTS.md** and **Project Structure**: the package in the list, and the
  rule settled on 2026-11-21. 3D entries on the arcade's Pixi stage use
  PixiJS 3D, and three.js stays for entries that set up their own renderers.
- **The book**: a line in Chapter 1's table, a line in Chapter 12's list of
  runtimes, and two cheat sheets for Appendix G (PixiJS 3D JSX and PixiJS 3D
  essentials), written as playground cheat sheets like the others. The book
  doesn't gain a chapter, because it teaches MVT, and the runtimes are
  examples of it.
- **Agent skills**: a 3D section in `skill-mvt-view.md` (ownership, time,
  bridges), and PixiJS 3D's own skill registered in `.claude/skills/`,
  pointing at the copy in `node_modules`, so agents read the current one.
- **The playground**: `@pixi/3d` and `@mvtjs/pixi-3d` added to the
  libraries a project may import and to the type bundles, the Pixi host
  importing `@pixi/3d` before it starts its renderer, a `pixi-3d` starter,
  and the two cheat sheets beside the editor.
- **v-snap** stays as it is, since a pose returns a `Scene3DView`. The README
  says so, and the first-frame fix makes screens show in the images.

## 4. Moving the existing views over

- **Ownership:** every 3D view that makes resources lists them in `owns`. The
  46 inline `new`s move to constants the view owns, or to shared parts the
  scene owns. The lint rule from 3.1 finds them all.
- **The suns:** Chicane and the hall get `<directionalLight>`.
- **Screens:** Chicane's gantry, the showcases' live screens and the
  Newspaper's pages use `ScreenView`, if each fits.
- **Imports:** the view tick API comes from `@mvtjs/pixi-3d` in 3D files.
- **Left alone:** the plain TypeScript views (explosions, wreckage, meadow
  chunks, the lantern batches, the leaves). They're plain on purpose.
- **Expected images:** unchanged, apart from screens that were blank and now
  show. Each changed image is looked at before its reference is updated.

The showcase module, the Gallery and the Newspaper are uncommitted work from
another session in this worktree. Moving them over waits until that work is
committed, so the two don't overwrite each other.

## 5. Stages

Each stage ends with types, lint, unit, slow and visual tests passing, then a
report. The next stage starts after review. Sizes are rough: S is under a
session, M about a session, and L more.

| # | Stage | Size | Done when |
| --- | --- | --- | --- |
| 0 | **Spikes.** Is `light.shadow` changeable after creation? Which batched mesh options are creation-only? Is a nested render in `onRender` safe? Does the `Ticker` stand-in drive a model and particles? Measure the hall's re-entry growth, as the baseline | S | A short write-up of each answer, added to this proposal |
| 1 | **Ownership.** `owns` in the base and every target, with conformance cases. The lint rule. The leak-check helper. Every 3D view moved over | M | The leak check passes for every 3D entry, and the hall's re-entry growth is gone or explained |
| 2 | **Creation options** (only if stage 0 says they're needed), then the light attributes, then both suns as elements | S-M | Four runtimes pass conformance, and Chicane's and the hall's images are unchanged |
| 3 | **The core table.** `group`, `mesh`, `camera` and the lights completed, `sprite3d` and `batchedMesh` added, all events, `hitVolume`, the table-driven test | M | Every attribute writes its property, by test |
| 4 | **Time.** `model` with `clip` and `clipTimeMs`, `ParticlesView`, the stand-in, the self-updating lint rule. A tiny glTF made by a script in the repo for the tests (originality) | M-L | A model's pose and seeded particles render the same image on every run |
| 5 | **Bridges.** `Scene3DView` completed, `ScreenView` (live from the first frame, interactive), `ScreenAnchorView`. Chicane's board and the live screens moved over | M | Chicane's thumbnail shows its scoreboard, and a pointer on a live screen reaches the game |
| 6 | **Parity.** Tick API re-export and the three checks, second-copy and target tests, design notes, README, build-ready dry run, benchmarks | M | `build:packages`' checks pass on it in a dry run. Benchmarks recorded |
| 7 | **Docs and tools.** AGENTS.md, Project Structure, Chapters 1 and 12, cheat sheets, the view skill, PixiJS 3D's skill, playground support with a starter | M-L | A new playground project from the 3D starter runs, and its cheat sheets show |
| 8 | **Publishing** (later, on the decision in section 7) | S | `@mvtjs/pixi-3d` is on npm |

Stages 1 and 5 are the ones that matter most for the entries. Stage 1 fixes
a real bug, and stage 5 fixes the blank screens. If the plan has to be cut
short, those two and stage 6's tick API re-export are the minimum.

## 6. Risks

| Risk | What could happen | What limits it |
| --- | --- | --- |
| PixiJS 3D changes | It's nine days old, at 0.1.0. A release could rename an option or change destroy | It's pinned exactly. The table-driven test and the leak check catch changes on upgrade. The package stays private until it settles |
| Changes to the published base | `owns` and the `creation` write kind change `@mvtjs/utils` | They only add, so existing code still works. Conformance across all four runtimes, and a changeset |
| Freeing what's shared | Ownership written wrongly destroys parts another view still uses | Shared parts belong to the scene view that made them. The leak check reports both missed and early frees. Chicane's shared car parts are the test case |
| Two sessions in one worktree | Moving views over collides with the showcase work | Moving them waits until that work is committed. Library stages touch only `packages/libraries/` |
| Nested render in `onRender` | Unsafe in Pixi 8, corrupting the frame | The spike decides. Passing the renderer down is the fallback |

## 7. Open questions

1. **`owns` for every renderer, or 3D only?** I recommend every renderer,
   since Pixi views leak textures the same way. It adds an attribute to the
   published `@mvtjs/utils`.
2. **`<model>` without an entry that uses it.** The originality rule means
   any glTF has to be made by a script in the repo. Stage 4 builds it with a
   tiny test model so the package is complete. Or it could wait for an entry
   that needs it.
3. **When to publish.** I suggest after PixiJS 3D's first release past 0.1.0
   that doesn't break us, with stages 1 to 7 done.
4. **Names.** `owns`, `ScreenView`, `ScreenAnchorView`, `ParticlesView`, and
   the lint rules' names, are suggestions.
5. **Number 106 is used twice.** Main's index uses 106 for the gamefab
   proposal, and this worktree's uses it for the showcases task. One of them
   needs a new number before the branches meet.

**Answered on 2026-11-22**, before the work started:

1. `owns` is in the base, for every renderer.
2. `<model>` is built now, tested with a glTF scene written in code.
3. Publishing waits for a PixiJS 3D release past 0.1.0 that doesn't break
   the package. Stages 1 to 7 leave it build-ready and private.
4. The names stay as suggested.
5. Main's index now numbers the gamefab proposal 109, and doesn't use
   106, so the two branches' numbers don't clash.

## 8. Progress log

### Stage 0: spikes (2026-11-22)

Each answer was found in PixiJS 3D 0.1.0's source and docs.

- **A light's `shadow` can change after creation.** Its docs say to
  "change a field at any time and the shadow's next redraw uses it", and
  `refreshShadows()` redraws it at once. Toggling `castShadow` doesn't
  recompile anything after the first light casts a shadow. So `shadow` and
  `castShadow` are on-change attributes, and lights don't need creation
  options.
- **A batch's `size` and instance data are creation-only.** `size` is a
  getter with no setter, and the instance data layout is fixed in the
  constructor. `cull` has a setter. So the base's `creation` write kind is
  needed, for `<batchedMesh>` and for `<model>`'s `source`.
- **A render inside `onRender` is ruled out.** PixiJS 3D's docs say to draw
  a `ContainerTexture` "before you render your scene, never from code that
  runs during a render". Pixi's `prerender` runner, the other early moment,
  is ruled out too, because the blend-mode pipe resets its state there. The
  chosen fix is neither of the two that the proposal named. It's a Pixi
  renderer system, which is added to every renderer as PixiJS 3D adds its
  own. The system wraps `renderer.render`, and draws each refreshed screen
  under the container being rendered, just before the render. Views don't
  need a renderer passed down to them, so a visual test's pose shows its
  screens too.
- **The `Ticker` stand-in drives particles.** `ParticleSystem3D.update` reads
  only `ticker.deltaMS`, and returns at once for 0. A model doesn't need a
  stand-in, because `AnimationState.gotoAndStop(seconds)` applies a pose
  directly. So `<model>` poses from bindings alone.
- **A mesh destroyed after its geometry or material is safe.** Both clear
  their list of meshes as they're destroyed. `UnstableList.clear` sets each
  mesh's index to -1, so the mesh's own `remove` is skipped. So `owns` can
  free resources from `onDestroyed`, as the element is destroyed and before
  its children are. It does this through one new target operation,
  `release`.
- **The hall's growth on re-entry** wasn't measured in a browser. See
  stage 1.

### Stages 1 to 7 (2026-11-22)

The stages were built one after another, as agreed. Each stage's checks
ran as it finished, and every suite ran at the end. These were the types
(`tsc -b`), lint, unit (3,506 tests), slow (179), visual (480 tests, 463
images) and the full build. The work is uncommitted, and awaiting review
and a playtest.

- **Stage 1, ownership.** `owns` is in the base, for every renderer. Each
  target has a `release`: Pixi destroys a texture with its source,
  three.js disposes, the DOM aborts or closes, and PixiJS 3D destroys a
  geometry with its buffers and a texture with its source. The base frees
  them from `onDestroyed`. Every target passes three new conformance cases.
  `ownResources(node, [...])` does the same for a plain TypeScript view. The
  lint rule `@mvtjs/no-unowned-resource` reports a `new` inside a
  `geometry`, `material` or `texture` attribute, but not one passed straight
  to a function, such as Fruit Machine's `kit.own(new ...)`. Every 3D view
  in the five entries and the site kit owns what it makes. Two parallel
  agents moved the showcases over, and every image stayed the same.
  `destroyAndFindLeaks` checks each 3D entry in its visual tests, and
  doesn't find any leaks. The hall's growth on re-entry wasn't measured in
  a browser, so that's left for the playtest. Before this stage, the views
  never freed their geometries, materials or canvas textures, which is the
  likely cause of the growth.
- **Stage 2, creation options and lights.** The base has a `creation`
  write kind, with `creation({ required: true })`, passed to `create`. Four
  runtimes pass its conformance cases. A `create` that reads them names its
  parameter's type, since TypeScript otherwise infers the element as
  `unknown`. Lights take `shadow` and `castShadow` on change, and point and
  spot lights take `radius`, `coneAngle` and `penumbra`. Chicane's sun and the
  Gallery's picture lights are elements now. The hall's only light made in
  code is set in a refresh step, and stays that way.
- **Stage 3, the core table.** `group`, `mesh`, `camera` and the lights are
  complete, and `sprite3d` and `batchedMesh` are added, with the twelve
  pointer events (`@mvtjs/pixi`'s ten, plus `pointerenter` and
  `pointerleave`), `hitVolume` and `interactiveChildren`. A table-driven
  test writes every attribute of every element and reads it back.
- **Stage 4, time.** `<model>` poses from `clip`, `clipTimeMs` and
  `clipLoops`, tested on a glTF scene written in code. `ParticlesView`
  advances in its update step through the `Ticker` stand-in, from a seed,
  and spawns a burst on each rise of a count. Its tests show the same seed
  repeats exactly, and a step of 0 doesn't move anything. The lint rule
  `@mvtjs/no-self-updating-3d` reports a feature left on the shared ticker.
- **Stage 5, bridges.** `Scene3DView` gained `passes`, `shadowQuality`,
  `shadowFilter`, `exposure`, `anchor` and `hitArea`, and getters for its
  background, fog and exposure. `ScreenView` replaced `connectTexture`, and
  draws through the renderer system that stage 0 chose, so it shows from
  the first frame. The pointer forwarding moved into it from the site kit,
  as `isInteractive`. `ScreenAnchorView` registers with its scene, and
  `Scene3DView` places it after refreshing the scene. Chicane's board and
  the showcases' live screens use `ScreenView`. Chicane's countdown image,
  its catalogue image and its thumbnail now show the board, which was blank
  before. A pointer on a live screen wasn't tried in a browser, but the
  forwarding code is the showcase's, moved as it was.
- **Stage 6, parity.** The package re-exports the view tick API, and the
  three checks include it. The `one-copy-of-utils` check lists sites, not
  packages, so it didn't need a change. The package has second-copy and target tests, design
  notes, a README, a licence, and a build that passes publint and attw.
  `build:packages` builds it, and the view-type check covers it. Benchmarks
  are recorded in `jsx-refresh` (a `scene3d` scene) and `construction`
  (PixiJS 3D groups), since neither suite had a three.js case to sit beside.
- **Stage 7, docs and tools.** These docs changed: AGENTS.md, Project
  Structure, Chapters 1, 7 (`owns`, with a glossary entry) and 12,
  Appendix G, the base's README and design notes, and the view skill's 3D
  section. PixiJS 3D's own skill is registered as `pixijs-3d`, and points
  at the copy in `node_modules`. A changeset covers the four published
  libraries. The playground has the libraries, a `pixi3d` type bundle, a
  PixiJS 3D starter and the two cheat sheets. Starters now have ids, so two
  starters can draw with Pixi. The Pixi host didn't need a change. The
  sandbox loads a project's module before it makes the host, so a 3D
  project's imports reach the renderer in time.

Two parts are left. Stage 8, publishing, waits for a PixiJS 3D release past
0.1.0 (task 111). The HTML `PixiCanvasView` is task 112.
