# Proposal: pixi-jsx follow-ups

> The follow-ups still open from a research session (2026-09-26) that
> compared this repo's JSX runtime with the diverged copies in the sibling
> `mvt-workshop` repo, and asked whether SolidJS-style cleanup scopes or
> context providers belong here. Its cheap items shipped as task
> [021](../archive/021-jsx-and-teardown-quick-wins.md), and its largest idea,
> sharing the runtime and the passes across renderers, is now proposal
> [022](022-renderer-agnostic-jsx.md). This note records the rest, each with
> what is known, what is not, and a recommendation. None is designed yet.

**Status:** proposed. A collection of candidates, not a design. Each item
needs a decision, and the larger ones a proposal of their own, before any
code.

**Written:** 2026-09-28, against Pixi 8.16.0, this repo's `src/pixi-jsx/`
and `src/pixi-mvt/`, and the workshop's `main`, `solutions-and-extras` and
`html-widget-kit` branches as of 2026-09-17.

**Related:** [021](../archive/021-jsx-and-teardown-quick-wins.md) (the part
that shipped. The session listed 13 steps; 021 took 1, 5-7, 9 and 10, 022
covers 13, and this note records 2-4, 8, 11 and 12) -
[022](022-renderer-agnostic-jsx.md) (a renderer-agnostic JSX base; its
section 2 appraises the workshop's `common-jsx` as spike 022a) -
[src/pixi-jsx/design-notes.md](../../src/pixi-jsx/design-notes.md) (settled
decisions on context and cleanup scopes, and when to revisit them) -
[004](../archive/004-list-proposal.md) (`<List>` and `<Switch>`).

---

## Summary

| # | Item | Size | Recommendation |
| --- | --- | --- | --- |
| [1](#1-renderlayer-as-the-answer-to-portal) | `RenderLayer` as the answer to the workshop's `<Portal>` | spike, then small | Spike when a view first needs to draw outside its parent's layer |
| [2](#2-a-component-that-rebuilds-its-subtree-when-a-key-changes) | A component that rebuilds its subtree when a key changes | proposal | Worth a proposal when a real view needs it; it reopens cleanup scopes |
| [3](#3-a-model-driven-cross-fade) | A model-driven cross-fade (`<Transition>`) | medium | After 2, which it builds on |
| [4](#4-window-listeners-owned-by-the-session) | Window listeners owned by the session, not by views | medium | Low priority: today's listeners live as long as the page |
| [5](#5-findings-to-pass-on-to-the-workshop) | Findings to pass on to the workshop | message | Send whenever convenient |

---

## 1. `RenderLayer` as the answer to Portal

**What.** The workshop's `<Portal into={layer}>` reparents its children into
another container, so they draw above everything else (a tooltip, a popup,
a drag ghost). That breaks two things this runtime relies on:

- The children leave their call site's subtree, so a hidden ancestor, an
  unselected `<Switch>` branch or an empty `<List>` slot no longer skips
  their bindings, since `SKIP_DESCENDANTS` follows the scene graph.
- They stay visible when the call site is hidden. The workshop's Portal has
  this bug: a Portal inside a hidden `<Show>` branch still shows its
  children.

Pixi 8.9 added `RenderLayer`, which changes draw order without reparenting:
`layer.attach(child)` leaves the child in its parent, for transforms and
for the refresh pass, and draws it as part of the layer.

**Known.** In Pixi 8.16 a layered child keeps its parent
(`parentRenderLayer` is recorded separately), and `collectRenderables`
skips any container whose `globalDisplayStatus` is below 7. That status is
inherited through the scene graph, so hiding the logical parent should hide
the layered child too.

**Not known.** That last point is read from the source, not tested. Nor is
how a `<List>` slot or `<Switch>` branch behaves when its content is
attached to a layer.

**Shape, if the spike passes.** A `layer` attribute on intrinsic elements
(`<container layer={overlayLayer}>`), which attaches the element on
construction and detaches it on `'destroyed'`. There would then be no
`<Portal>`, and the design notes would say why. If 022 lands first, this is
one more entry in its Pixi element table.

**Spike.** Tests: a layered child of a hidden parent is not drawn, and a
layered child inside an unselected `<Switch>` branch neither refreshes nor
draws. Draw order can only be checked with a renderer, so check it in the
running app.

## 2. A component that rebuilds its subtree when a key changes

**What.** `<Switch>` covers a fixed set of branches, and `<List>` covers
collections. Neither covers "throw this subtree away and build a new one
when this value changes": a new level, a different enemy kind in a boss
slot, a screen chosen by an open-ended id. The workshop's `<Dynamic of={...}>`
does this, destroying the old child and building the new one when `of()`
changes identity.

**Why it needs a proposal.** It is the first component here that would
destroy views during play. The design notes name exactly this as the
trigger to revisit cleanup scopes (section 4), since releasing resources by
hand in every rebuilt subtree becomes error-prone. The proposal should
settle:

- Whether `onDestroyed` and `on('destroyed')` are enough, or whether
  per-component cleanup is needed, and if so in the form the design notes
  allow (attached to each component's own root container, never a stack of
  owners).
- Build timing. The new subtree is built during a refresh, like `<List>`'s
  item views, so it must be refreshed on the frame it appears, and it
  inherits their no-owner rule for cleanups.
- Whether it destroys the old subtree (`{ children: true }`) or keeps a
  small cache, for keys that alternate.
- If 022 lands first, it belongs in the shared base beside `<List>` and
  `<Switch>` (022 section 8), written against the target's operations.

**Evidence of need.** None yet in this repo: no current view rebuilds a
subtree on a key. Wait for one.

## 3. A model-driven cross-fade

**What.** The workshop's `<Transition of={...} progress={...}>` cross-fades
from the old subtree to the new one when `of()` changes, with the model
supplying `progress` from 0 to 1. The model owns the timing, so it fits
MVT's rules: the view holds no clock.

**Depends on 2.** It is item 2 plus a period during which both subtrees
exist. The workshop's version destroys the outgoing view when progress
reaches 1, and throws away a view still fading out if the key changes
again.

**Open.** Whether the fade belongs in the component at all, or whether
item 2 plus an `alpha` binding on each subtree is enough. Try that first.

## 4. Window listeners owned by the session

**What.** Three views add their own `window` keydown listeners: the
cabinet, the keyboard input view and the pause menu (plus a fourth in
`src/main.ts` itself). An alternative is input adapters that the session or
app creates and destroys, with the views only reading what they report.

**Why it is low priority.** All three views are created once in
`src/main.ts` and live as long as the page, so nothing leaks, and since 021
all three release their listeners the same way. The case for moving them is
architectural (views that relay DOM input are an odd kind of view), not a
bug.

**When to revisit.** When a view with a `window` listener starts being
created and destroyed during play, or when the separate keydown listeners
start conflicting over the same keys.

## 5. Findings to pass on to the workshop

Things found in the workshop's copies during the comparison, worth telling
whoever maintains them. Checked against this repo's Pixi (8.16.0); the
workshop pins 8.8.1, whose source was not available to check.
[022](022-renderer-agnostic-jsx.md) section 2.5 records more, from its own
appraisal: getters called at construction, `destroy` replaced on each
instance, and several HTML and three.js details. Send both lists together.

- **Hidden branches still refresh.** The `<Show>` / `<Switch>` doc comment
  says invisible objects skip `onRender`. They do not:
  `RenderGroup.runOnRender` calls every registered container, visible or
  not. So hidden branches keep polling every frame, and together with
  getters called at construction, a hidden branch whose bindings assume data
  that is not there yet (`model.boss!.hp`) throws while being built. This
  repo's fix is to call no getter until the first refresh, and to skip
  hidden subtrees with `SKIP_DESCENDANTS`.
- **Two event attributes never fire.** Pixi emits no `globalpointerdown` or
  `globalpointerup`, only `globalpointermove`, `globalmousemove` and
  `globaltouchmove`, so `onGlobalPointerDown` and `onGlobalPointerUp` do
  nothing.
- **Portal ignores its call site's visibility** (see item 1).
- **A compile per element.** The workshop's `buildRefreshFn` calls
  `new Function` for every element with bindings. This repo caches the
  compiled factory by binding signature, so the thousandth list item with a
  given shape costs a map lookup rather than a compile.
- **Removing many rows is quadratic.** Pixi removes a container from its
  `onRender` list with `indexOf` and `splice`, so a `<For>` that destroys n
  rows costs O(n) each. The keyed `<For>` also calls `getChildIndex` on every
  row at every rescan.

## 6. Not carried forward

- Steps 1, 5-7, 9 and 10 of the session's list shipped in 021.
- Step 13, running the scene passes over other renderers' trees, is covered
  by [022](022-renderer-agnostic-jsx.md) section 9.
- The workshop's keyed `<For>`, which moves views on reorder to keep their
  state, is not wanted: this repo keeps per-item presentation state in a
  view model keyed by item id instead (004, and
  [Presenting Collections](../../docs/building-with-mvt/presenting-the-world/collections.md)).
- The workshop's per-node update methods, combined at construction, are not
  wanted either: the pixi-mvt `onUpdate` pass does the same job and also
  follows later changes to the tree.
- The workshop's `ObjectFitContainer` (CSS-like `object-fit` for a subtree)
  is a general layout helper, unrelated to the runtime. Port it if a view
  needs it.

## 7. Open questions

- Item 1: does a layered child really inherit its logical parent's
  visibility (see its spike)?
- Items 2 and 3: is there a view in this repo, or planned, that needs a
  subtree rebuilt on a key? Without one, neither should be built.
- Items 1 and 2: if 022 is accepted, should they wait for it, so they are
  written once against the shared base rather than twice?

## 8. Implementation steps

1. Item 5: send the findings, with 022 section 2.5's, to the workshop's
   maintainers.
2. Item 1: the spike, when a view first needs to draw outside its parent's
   layer. If it passes, a `layer` attribute and a design-notes entry.
3. Items 2 and 3: a proposal, when a view needs one.
4. Item 4: only if its revisit condition occurs.
