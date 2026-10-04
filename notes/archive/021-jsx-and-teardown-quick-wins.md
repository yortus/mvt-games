# JSX and Teardown Quick Wins

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-09-28 |
| Updated  | 2026-09-28 |

## Description

Small improvements that came out of a research session (2026-09-26),
and asking whether SolidJS-style cleanup scopes or
context providers belong here. The answers were "not now" for both, and
"no" for context. This task collects the cheap follow-ups: a few missing
element attributes, one way to release resources when a view is destroyed,
and a written record of the two decisions so they are not re-derived.

Bigger follow-ups from the same session are not part of this task: a
`RenderLayer`-based `<Portal>`, a component that
rebuilds its subtree when a key changes, a model-driven cross-fade
(`<Transition>`), and generalising the pixi-mvt passes to other renderers
(which belongs in [011](./011-multi-package-repo.md)).

### 1. Missing element attributes

In [jsx-runtime.ts](../../src/pixi-jsx/jsx-runtime.ts), add to the
attribute types, `applyAttribute`, `attributeAssignment` and
`EVENT_ATTRIBUTE_MAP` as each needs:

- `scaleX`, `scaleY` (value or getter; cheap, so written every frame like
  `scale`).
- `anchorX`, `anchorY` on `<sprite>` and `<text>` (fixed values, like
  `anchor`).
- `tint` on `<graphics>`. `applyAttribute` only sets it on a `Sprite` today;
  `tint` is already a watched attribute, and the generated `e.tint=` works
  for `Graphics` as it is.
- `eventMode` (fixed value). `applyEventAttributes` runs after the attribute
  loop and sets `eventMode = 'static'` whenever a handler is present, so an
  explicit `eventMode` must win over that default, not be overwritten by it.
- `onWheel` (`'wheel'`, `FederatedWheelEvent`).

Not `onGlobalPointerDown` / `onGlobalPointerUp`:
checked against Pixi 8.16's `lib/events`, the only global events Pixi emits
are `globalpointermove`, `globalmousemove` and `globaltouchmove`, so those
two would never fire.

### 5. One way to release resources when a view is destroyed

The repo releases view resources three ways. Standardise on Pixi's own
`'destroyed'` event, `view.on('destroyed', ...)`, which most sites already
use (the keyboard input, boids and falling-sand views, and `<List>`).
Convert the two that overwrite `view.destroy` on the instance:

- [cabinet-view.ts:193](../../src/cabinet/cabinet-view.ts#L193) (removes a
  `keydown` listener and kills `zoomTimeline`).
- [pause-menu-view.ts:133](../../src/common/pause-menu-view.ts#L133)
  (removes a `keydown` listener).

The `'destroyed'` listener runs partway through `destroy`, after the
children are detached and before they are destroyed, rather than before
`destroy` starts. That does not matter for either site. (Corrected
2026-09-28: this line first said "after the children are destroyed".)

No docs page covers releasing a view's resources yet. Add a short section to
[views.md](../../docs/building-with-mvt/presenting-the-world/views.md)
(when a view needs it: window listeners, a shared `GraphicsContext`, a
texture it made, a GSAP timeline; and how: `on('destroyed')`), and a line in
the [mvt-view skill](../../docs/ai-agents/skill-mvt-view.md). Also say that
a view whose resources should be released must be destroyed with
`{ children: true }` somewhere above it, or its listener never runs.

`src/demos/main.ts` and the playground's `sandbox-host.ts` remove listeners
in their own session teardown, which is correct for application code and is
out of scope.

### 6. An `onDestroyed` attribute

Add `onDestroyed` alongside `onUpdate` and `onRefresh`, so a JSX view can
release a resource on the element that owns it, where the resource is made:

```tsx
<graphics ref={(g) => { g.context = boidContext; }} onDestroyed={() => boidContext.destroy()} />
```

- Add it to `NON_GETTER_ATTRIBUTES`, or the runtime will treat it as a getter.
- Wire it with `el.on('destroyed', ...)`. Decide whether it receives the
  element, as `ref` and `onRefresh` do; consistency suggests yes.
- Intrinsic elements only. A component's attributes are its bindings, and
  its author decides what they are.

No JSX view in the repo needs it today: every current `'destroyed'` listener
is in a plain TypeScript view. So acceptance is tests and docs, not a
migration. It becomes necessary once a component rebuilds subtrees during
play (the key-rebuild follow-up above).

### 7. Dev warning when destroying without children skips a cleanup (optional)

`container.destroy()` without `{ children: true }` detaches the children but
does not destroy them, so their `'destroyed'` listeners silently never run.
In the pixi-mvt mixin's `destroy` wrapper
([mvt-container-mixin.ts:210](../../src/pixi-mvt/mvt-container-mixin.ts#L210)),
in dev builds only, warn when `children` is not set and a descendant has a
`'destroyed'` listener (`listenerCount('destroyed') > 0`).

Destroying without children is sometimes intended (the children are about to
be reused), so this may be noisy. Try it on the games and demos. If it
fires on intended uses, drop it and log why here.

### 9. Docs: sharing what many views need, without a context mechanism

Add a section to
[view-composition.md](../../docs/building-with-mvt/presenting-the-world/view-composition.md)
on what to do when many views deep in a tree need the same thing (colours
and text styles, textures, sounds, a formatter) and the views in between
don't. There are four ways, most explicit first:

1. **Module imports** for fixed shared values. The repo already does this
   (`view-constants.ts`, style constants).
2. **A function that takes the shared things once and returns views that
   close over them**, e.g. `const { ToolbarView } = createToolbarViews({ sounds })`.
   What they depend on is written once, where the views are created, and
   their own bindings stay small.
3. **Have the parent build the child and hand it over**, so the views in
   between never see what the child needs. For example,
   [demo-view.tsx](../../src/demos/falling-sand/views/demo-view.tsx) could build
   the perfmon and pass it to the toolbar, rather than pass `frameStats`
   through.
4. **Group several shared bindings into one object**, so each level passes
   one binding instead of several.

End with one or two sentences on why MVT offers no ambient lookup: a view's
bindings are its whole contract and its test seam; a value looked up from
wherever the view ends up at runtime hides an input from both, and fails at
runtime instead of at compile time.

Load the `mvt-documentation` skill first. Use the project's plain terms
(bindings, views, Pixi container); don't introduce "context", "provider",
"prop drilling" or "scoping" as terms, except to name the Solid feature once
if a comparison helps.

### 10. Record the two decisions next to the runtime

Create `src/pixi-jsx/design-notes.md` (on the model of
[src/pixi-mvt/design-notes.md](../../src/pixi-mvt/design-notes.md)) with a
"Settled decisions" section, marked "do not reopen without new information",
and link it from the header comment of `jsx-runtime.ts`. Record:

- **Why Solid's mechanisms don't carry over.** This runtime builds children
  before their parent (`<Switch>` relies on this), so in
  `<Provider><Child /></Provider>` the child already exists when the provider
  runs. Solid avoids this because its compiler makes children lazy.
- **No context providers.** A lookup could only work inside getters, by
  climbing `parent` at first refresh (inert construction makes the tree exist
  by then), and never while building. It hides inputs from a view's bindings
  and from its tests, and its answer changes if the view is reparented. Use
  the alternatives in item 9.
- **No cleanup scopes, for now.** Few views hold resources (they poll, and
  rule 1 bans timers), and `<List>` and `<Switch>` never destroy anything, so
  a view is destroyed about once per session. `on('destroyed')` and the
  `onDestroyed` attribute cover it. If scopes are ever added, each
  component's cleanups must attach to its own root container's
  `'destroyed'`, not to a stack of owners: with children built first, an
  owner stack would file a child's cleanups under whichever view's source
  contains it, not under the child's parent. Lazy builds (a `<List>` item
  function, a `<Match>` function child) run during refresh with no component
  being built, so a cleanup registered there directly has no owner and
  should throw in dev.
- **When to revisit.** A component that rebuilds subtrees during play
  (cleanup scopes), or a deep, widget-heavy UI where most leaves need the
  same services (context, though the item 9 alternatives still come first).

## Acceptance Criteria

- [x] 1: `scaleX`, `scaleY`, `anchorX`, `anchorY`, `tint` on `<graphics>`,
      `eventMode` and `onWheel` are supported, typed, and tested; an explicit
      `eventMode` is not overwritten by a handler's default
- [x] 5: `cabinet-view.ts` and `pause-menu-view.ts` release their resources
      with `on('destroyed')`; nothing in `src/` overwrites `destroy` on an
      instance (the pixi-mvt mixin's prototype wrapper excepted)
- [x] 5: `views.md` and the `mvt-view` skill say how to release a view's
      resources, including the `{ children: true }` caveat
- [x] 6: `onDestroyed` is supported on intrinsic elements, not treated as a
      getter, tested (fires on `destroy()`, and through an ancestor's
      `destroy({ children: true })`), and documented where `onUpdate` and
      `onRefresh` are
- [x] 7: the dev warning is in place, or dropped with the reason logged below
- [x] 9: `view-composition.md` has the section on sharing what many views need
- [x] 10: `src/pixi-jsx/design-notes.md` exists with the settled decisions,
      linked from `jsx-runtime.ts`
- [x] `npm run lint`, `npm run build` and `npm test` pass

## Progress Log

### 2026-09-28

- Created from the research session's proposed next steps (items 1, 5, 6, 7,
  9 and 10 of its list; numbering kept so the list can be cross-referenced).
- Checked before writing: Pixi 8.16 emits no `globalpointerdown` /
  `globalpointerup`; two views still overwrite `destroy`; no docs page
  covers releasing view resources.
- Done, all items:
  - **1.** `scaleX`/`scaleY` (value or getter), `anchorX`/`anchorY` (fixed),
    `tint` on `<graphics>`, `eventMode` and `onWheel`, in `jsx-runtime.ts`
    with tests. An explicit `eventMode` wins over the `'static'` default a
    handler sets.
  - **5.** The cabinet and pause menu now use `on('destroyed')`; nothing in
    `src/` replaces `destroy` on an instance. New section "Releasing What a
    View Holds" in `views.md`, a "Releasing Resources" section in the
    `mvt-view` skill, and a short subsection in the style guide (a new
    convention: never replace `destroy` on an instance).
  - **6.** `onDestroyed` attribute on intrinsic elements, wired with
    `el.on('destroyed', ...)`. It receives the element, because Pixi passes
    it to `'destroyed'` listeners. Skipped in the attribute loop like
    `onRefresh`, rather than added to `NON_GETTER_ATTRIBUTES`: it is wired
    separately, so it must not reach `applyAttribute` either. Tests cover a
    direct destroy (once only), a cascade from an ancestor destroyed with
    children, no run when the ancestor is destroyed without them, and that it
    is not a binding.
  - **7.** Kept. In dev builds the mixin's `destroy` wrapper warns, naming
    both containers, when a destroy without `{ children: true }` detaches a
    descendant with a `'destroyed'` listener. Pixi 8.16 adds no
    `'destroyed'` listeners of its own, so it only finds ours. Tried on the
    games and demos: a throwaway script bundled each entry as the benchmark
    driver does (textures stubbed) but with DEV on, ran it for 600 frames,
    then tore it down as `src/main.ts`'s thumbnail path does
    (`session.destroy()`, then the stage's `destroy()`). No warnings from any
    of the ten; a known-bad case in the same script did warn. The full test
    suite also runs without one. Every `destroy()` without children in `src/`
    was also read: each is on a leaf or an already-empty container.
    Documented in the pixi-mvt design notes, with the event's timing.
  - **9.** "Sharing What Many Views Need" in `view-composition.md`.
  - **10.** `src/pixi-jsx/design-notes.md`, linked from the header of
    `jsx-runtime.ts`. It also records three findings from the research
    session so they are not re-derived: the event's timing, Pixi's global
    events, and `onRender` not skipping hidden containers.
  - `npm run lint`, `npm run build` (including the docs site) and
    `npm test` (697 tests) pass.
