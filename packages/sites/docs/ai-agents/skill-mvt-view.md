# Skill: Writing MVT Views

> Load before writing or changing anything under a `views/` directory. What
> a view is, and why, is taught in the book, from
> [Chapter 7, Views](../chapters/07-views.md) to
> [Chapter 14, Lists and Switches](../chapters/14-lists-and-switches.md),
> with sound in [Chapter 20](../chapters/20-sound-and-music.md) and visual
> tests in [Chapter 17](../chapters/17-visual-tests.md). This file is the
> checklist, the lint rules, and what must pass before you hand over.

---

## Before You Write

Read the sections you need, by anchor:

| Topic | Read |
| --- | --- |
| What a view is, and what belongs in one | [Chapter 7](../chapters/07-views.md#the-role-of-a-view), [what belongs](../chapters/07-views.md#concerns-that-belong-in-a-view) |
| The `refresh()` contract | [Chapter 7](../chapters/07-views.md#the-refresh-contract) |
| Doing less work in `refresh()` | [Chapter 7](../chapters/07-views.md#doing-less-work-in-refresh) |
| `setUpdate`, `setRefresh`, `updateView`, `refreshView`, `SKIP_DESCENDANTS` | [Chapter 7](../chapters/07-views.md#updating-and-refreshing-views-with-the-mvtjs-libraries); edge cases (wrapping a method, a child added mid-walk, clearing with `undefined`) in the [`@mvtjs/pixi` notes](https://github.com/yortus/mvt-games/blob/main/packages/libraries/pixi/src/README.md) |
| Releasing a listener, texture or shared context | [Chapter 7](../chapters/07-views.md#releasing-a-view-s-resources) |
| Query and relay bindings | [Chapter 8](../chapters/08-bindings.md#query-bindings), [relay](../chapters/08-bindings.md#relay-bindings-and-input-handling) |
| `() => T`, `T` or `ValueOrGetter<T>` | [Chapter 8](../chapters/08-bindings.md#fixed-values-and-getters) |
| Optional relay bindings, wiring at the construction site | [Chapter 8](../chapters/08-bindings.md#optional-bindings), [wiring](../chapters/08-bindings.md#wiring-bindings) |
| Top-level views take `{ model }` | [Chapter 8](../chapters/08-bindings.md#when-to-pass-the-whole-model) |
| Reactions, watchers, computed values | [Chapter 9](../chapters/09-noticing-changes.md#three-tools-one-idea), [the four rules](../chapters/09-noticing-changes.md#the-four-rules-of-change-detection) |
| Counts for moments that repeat | [Chapter 9](../chapters/09-noticing-changes.md#counts-moments-that-repeat) |
| Presentation state and the view's `update` | [Chapter 11](../chapters/11-presentation-state.md#a-view-s-update-deltams) |
| What `update` and `refresh` each do | [Chapter 11](../chapters/11-presentation-state.md#the-jobs-of-update-and-refresh) |
| Start valid: refresh may come before update | [Chapter 11](../chapters/11-presentation-state.md#start-valid-the-first-refresh-may-come-before-the-first-update) |
| A JSX body: attributes, `visible`, `ref`, `onRefresh`, `onUpdate`, `onDestroyed` | [Chapter 12](../chapters/12-writing-views-in-jsx.md#fixed-values-and-getters), [`visible`](../chapters/12-writing-views-in-jsx.md#hiding-a-subtree-with-visible), [stepping out](../chapters/12-writing-views-in-jsx.md#stepping-out-into-code) |
| JSX or plain TypeScript | [Chapter 12](../chapters/12-writing-views-in-jsx.md#choosing-between-jsx-and-plain-typescript), [mixing](../chapters/12-writing-views-in-jsx.md#mixing-the-two) |
| Parent views and children | [Chapter 13](../chapters/13-composing-views.md#parent-views-wire-their-children) |
| `<List>` and `<Switch>` | [Chapter 14](../chapters/14-lists-and-switches.md#how-list-works), [item views](../chapters/14-lists-and-switches.md#two-rules-for-item-views), [`<Switch>`](../chapters/14-lists-and-switches.md#showing-one-of-several-switch) |
| Helpers (tweens, metronome, sequences), view models | [Chapter 18](../chapters/18-growing-a-complex-view.md#reach-for-a-helper), [view models](../chapters/18-growing-a-complex-view.md#extract-a-view-model) |
| Audio views | [Chapter 20](../chapters/20-sound-and-music.md#audio-views), [collections](../chapters/20-sound-and-music.md#sound-for-a-collection), [music](../chapters/20-sound-and-music.md#music), [testing](../chapters/20-sound-and-music.md#testing-an-audio-view) |
| Hot paths in `refresh()` | [Chapter 24](../chapters/24-hot-paths.md#the-hot-path-rules) |
| Every view and binding rule | [Appendix A](../appendices/a-mvt-on-one-page.md#view-rules), [bindings](../appendices/a-mvt-on-one-page.md#binding-rules) |

## Checklist

**Shape** ([Code Style: Views and Bindings](../working-in-this-repo/code-style.md#views-and-bindings))

- `export function XxxView(bindings: XxxViewBindings)`, returning its Pixi
  container, three.js object or DOM element. Never `createXxxView`, never
  `props`.
- File sections: Bindings, View, Internals. A JSX body is a `.tsx` file
  starting `/** @jsxImportSource @mvtjs/pixi */` (or `three`, `html`).
- Query bindings named for what they return (`At`, `For` suffixes when
  they take arguments), relay bindings `on` + what the user did, usually
  optional and called with `?.()`.
- Leaf views take query and relay bindings. A top-level view takes
  `{ model }`.

**Refresh**

- Every getter binding is read in `refresh()`, never kept from
  construction. A value read once is declared `T`.
- `refresh()` only writes output: it never changes a model or starts a
  timer. It's idempotent.
- Display objects are made once, at construction or in `refresh()`, never
  in `update()`. Properties change in `refresh()`.
- Never forward `update` or `refresh` to child views. `updateView` and
  `refreshView` find them.
- Skip a hidden subtree with `SKIP_DESCENDANTS` (or a `visible` getter in
  JSX). `visible = false` alone doesn't skip anything.
- Don't use Pixi's `onRender` for refresh.

**Change detection**

- Text from a number is a `createComputed`, made once. Slow rebuilds go
  behind a reaction or a watcher. Fast writes read their values directly.
- Reactions are called, and watchers polled, on every step,
  unconditionally. A reaction is named effect-then-trigger
  (`playPumpSoundWhenInflationRises`).
- A reaction never reacts to its first read, so draw (or play) the
  starting state as the view is made.

**Presentation state**

- Only cosmetic state that the model doesn't track. Advanced in the view's
  `update(deltaMs)`, set with `setUpdate` or `onUpdate`. Never hardcode a
  frame delta, or read a clock.
- Valid from construction, from the bindings if it depends on them.
- Tween a plain state object, and apply it in `refresh()`. More than one
  value, or logic worth testing, goes into a view model (named like
  bindings), or a helper from `@mvtjs/utils`.

**Sound** (an audio view)

- Plays in `refresh()`, on a change (a phase changing, a count rising
  with `when: increased`), never on a state.
- Takes its chips as fixed values, `MusicChip<'audio80'>` and
  `SfxChip<'audio80'>` from `@mvtjs/site-kit/shared`. Music: `play`, `queue`, `stop` and
  `tempoScale` on the music chip. A jingle is no longer than its phase.
- In a `<List>`, a `when` that a newly arrived item can't trigger
  (`changedFrom(true)`). An item removed in the tick it finishes is
  counted by the model, and played from a view outside the list.
- Pan and loudness: [Sounds in Stereo](https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/docs/using-the-audio90.md#sounds-in-stereo)
  and [Loudness](https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/docs/using-the-audio90.md#loudness).
  The starter's side is in
  [Adding an Entry: Sound](../../arcade/src/entries/README.md#sound).

**Hot path**

- No allocations per tick in `refresh()` or a getter attribute: index
  loops, numeric keys, no `map`/`filter`/spread, no template strings.
- Before a per-frame redraw, check whether drawing once and then scaling,
  tinting or resizing would do.

## Lint

| Rule | Reports |
| --- | --- |
| `no-restricted-syntax` (view files) | `createXxxView`, `XxxViewProps`, a `get` prefix in `XxxViewBindings`, `XxxViewModel` or `XxxViewModelOptions` |
| `@mvtjs/no-conditional-poll`, `no-repeated-poll`, `no-unused-watch`, `no-inline-watch` | A watcher or reaction called behind a condition, twice in a step, never, or made and used in one expression |
| `@mvtjs/no-control-names` | Off in a view model (`views/**/*-model.ts`), where controls are handled |
| `no-restricted-imports` | The view tick API imported from `@mvtjs/utils` rather than the renderer package |

## Visual Tests

A new or changed view gets a visual test
([Chapter 17](../chapters/17-visual-tests.md#posing-a-view)):

- In `visual-tests/` beside the view, named for the view's file
  (`visual-tests/hud-view.test.tsx`). No `describe` block that only names
  the view.
- One `canvasTest` (Pixi, three.js) or `htmlTest` (HTML) per state the
  bindings can show, from `v-snap`. The pose returns the view, built from
  stand-in bindings, or for a top-level view a model brought into a state by
  its actions. `advanceTime(ms, model, view)`, from the renderer package,
  moves presentation state on.
- The Arcade's options (`pixelArt: false`, `kind: 'three'`, `camera`,
  `scene`) are in
  [Adding an Entry](../../arcade/src/entries/README.md#step-6-list-it-and-take-its-thumbnail).
- A new reference image is written on the first run. Accept a change with
  `npx vitest run <test file> -u`. Look at every new or changed PNG, and
  the diff of a failure, before you accept it
  ([Reviewing a Change](../chapters/17-visual-tests.md#reviewing-a-change)).
  Never accept a change you haven't looked at.
- Visual runs use Playwright's own browser, so you can repeat them freely.

## Before You Hand Over

- `npm run lint`, `npx tsc -b`, `npm run test:unit` and
  `npm run test:visual` pass.
- Every new or changed reference image has been looked at.
- Load the `code-style` skill's checklist too.
