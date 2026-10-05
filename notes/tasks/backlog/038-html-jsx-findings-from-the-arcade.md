# HTML JSX Runtime: Findings from the Arcade

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-05 |
| Updated  | 2026-10-05 |

## Description

The Arcade (`packages/website/src/arcade/`, proposal
[036](../../proposals/036-website-arcade.md)) is the first real application
screen built with `@mvtjs/html`'s JSX runtime: a search box with tokens and
suggestions, a card wall that reflows, dialogs, a pause menu, and a
transition that moves elements every frame. What it showed about the
runtime is below, each with what might be done. Decide each one: change the
runtime, document the behaviour, or leave it.

This was task 026's last criterion; 026 was absorbed into 036.

### Findings

- [ ] **Changing styles need an `onRefresh` step.** `style` is fixed, so
  the cards and the transition, which move every frame, each write their
  styles in an `onRefresh` step with change checks of their own
  (`card-view.tsx`, `transition-view.tsx`). A changeable attribute per style
  property, or one for CSS custom properties (`style-` or `var-`, as `data-`
  and `aria-` are prefixes now), would remove that boilerplate.
- [ ] **An element hidden by its own `visible` binding skips its `onRefresh`,
  and its subtree.** As designed, and said in `jsx-types.ts`, but it caught
  the Arcade twice: a step that watched a dialog to put the focus in it
  never saw the dialog close, until it moved to an element that is never
  hidden. Worth a sentence in `@mvtjs/html`'s README, and in the guide's page
  on visibility, if there is one.
- [ ] **A dialog cannot take the focus in the frame it opens.** Its
  `visible` binding is written in its own refresh, after its parent's step,
  so a parent step that focuses into it finds it still hidden, and a hidden
  element takes no focus. The Arcade's `focusOnOpen` (`views/focus-on-open.ts`)
  tries again each frame until the focus lands. A recipe in the docs, or a
  step that runs after the element's own bindings (an `onShown`, or an
  `onRefresh` that can ask to run after its subtree), would do.
- [ ] **Missing event attributes.** The Arcade adds three listeners by hand,
  through `ref`: `focusin` and `pointerover` (the bubbling forms of the
  `onFocus` and `onPointerEnter` the runtime has, which a container needs to
  hear about its children), and `mousedown` (to keep the focus in the search
  box when a suggestion is clicked). Add `onFocusIn`, `onFocusOut`,
  `onPointerOver`, `onPointerOut` and `onMouseDown`, or say how to add an
  event attribute.
- [ ] **`<img>` has no `loading` attribute**, and `loading` must be set
  before `src`, which starts a load, so a lazy image needs a `ref`. Add
  `loading` (and `decoding`), written before `src`.
- [ ] **`memoiseLast` takes primitives only**, so values derived per entry
  are keyed by its id. Fine as it is; worth a line in its doc comment.

### Worked well

- **`value` is not written while its field has the focus**, so a search box
  bound to the model never fights the person typing. Worth documenting as a
  feature.
- **`visible` is the `hidden` attribute**, so hidden content is hidden from
  assistive technology too.
- **Elements made outside JSX can be children** (the entry host's stage
  element), which kept the runner simple.

## Acceptance Criteria

- [ ] Each finding above decided, and done or left with a reason
- [ ] `@mvtjs/html`'s README describes what is kept as designed (`visible`
  skipping a subtree, `value` while focused)

## Progress Log

- 2026-10-05: Created from 036's step 10, from its section 11.1 and what
  the later rounds of the Arcade found.
