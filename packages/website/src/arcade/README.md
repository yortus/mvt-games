# The Arcade

> The site's home page: every game and demo as a card, to search and to play
> in the page. It is an MVT application rather than a game, written in HTML
> JSX, and it shows parts of MVT the games never needed: a model with nothing
> to advance, async loading, view models with tests of their own, and a page
> that hosts entries on any renderer in one loop. This README is a guided
> path through those lessons, each pointing at the code that shows it.

**Related:** [Adding an Entry](../entries/README.md) ·
[Architecture Rules](../../../docs/architecture/rules.md) ·
[Presentation State](../../../docs/building-with-mvt/adding-visual-polish/presentation-state.md)

---

## The Pieces

| Where | What |
| --- | --- |
| [`main.ts`](./main.ts) | The page: makes the model, the views and the entry host, and runs the one loop |
| [`models/arcade-model.ts`](./models/arcade-model.ts) | `ArcadeModel`: the search, the tags chosen, the phase, the entry launched |
| [`models/arcade-query.ts`](./models/arcade-query.ts) | The search as a URL query, and back |
| [`views/arcade-view.tsx`](./views/arcade-view.tsx) | The top-level view: takes the model, wires the rest |
| [`views/card-wall-view.tsx`](./views/card-wall-view.tsx), [`card-view.tsx`](./views/card-view.tsx) | The wall of cards, and one card |
| [`views/card-wall-layout.ts`](./views/card-wall-layout.ts) | View model: where each card goes, in columns, and how it moves there |
| [`views/transition-view-model.ts`](./views/transition-view-model.ts), [`transition-view.tsx`](./views/transition-view.tsx) | View model and view: the way into an entry and back out |
| [`views/search-bar-view.tsx`](./views/search-bar-view.tsx), [`search-suggestions.ts`](./views/search-suggestions.ts) | The search box, its tag tokens and suggestions |
| [`views/runner-view.tsx`](./views/runner-view.tsx), [`pause-menu-view.tsx`](./views/pause-menu-view.tsx) | The bar over a running entry, and the pause menu |
| [`../runner/`](../runner/) | The entry host, which runs one entry of any renderer |

The rest are smaller views (the marquee, the info panel, the About note) and
their helpers.

## 1. A Model With Nothing to Advance

[`createArcadeModel`](./models/arcade-model.ts) has an `update(deltaMs)`,
because the loop calls every model's, and its body is a comment: nothing to
advance. Everything the Arcade's model owns changes only when the visitor
does something: the search text, the tags chosen, which entry is launching,
playing or paused. Time is not part of its domain.

That is worth seeing once. MVT does not need every model to be a
simulation; it needs every model to change only through its own methods, so
that views can read it every frame without asking what changed. A menu, a
form or a search is as much a model as a maze chase.

## 2. Domain State and Presentation State

Which state belongs to the model, and which to the views?

- **In the model:** the search text, the tags chosen (in the order chosen),
  the phase (`'browsing' | 'loading' | 'ready' | 'playing'`), the entry
  launched, and whether it is paused. These are what the visitor asked for.
  The URL is a projection of them: `main.ts` writes the query and the
  fragment from the model (`writeUrl`), and reads them back on load.
- **In the views:** which card is selected (`selected` in
  [`card-wall-view.tsx`](./views/card-wall-view.tsx)), where each card is
  and where it is sliding to (the layout), and every frame of the way in and
  out (the transition). None of it changes what the Arcade *does*; it
  changes how it looks while doing it.

The selection is the one to argue about. Selecting a card launches nothing,
and losing it on a reload loses nothing, so it is presentation. If the
selection drove something else, say a preview playing in the card, it would
move to the model.

## 3. Async Loading, Made Safe

Launching an entry loads its code, which takes time, and the visitor can
leave before it arrives. `launch` in
[`arcade-model.ts`](./models/arcade-model.ts) counts launches:

```ts
const launch = ++launchCount;
loadEntry(entry).then((loaded) => {
    if (launch !== launchCount || phase !== 'loading') return;
    starter = loaded;
    phase = 'ready';
});
```

`exit` increments the count too, so a load that finishes after the visitor
has left, or after a newer launch, is ignored. The promise is the only
wall-clock thing in the model, and all it may do is move the phase on, if
nothing has happened since.

## 4. View Models, Tested on Their Own

Five parts of the views are complex enough to test without a browser, so
each is a view model or a pure helper, with its own tests:

| View model | Test | What it decides |
| --- | --- | --- |
| [`card-wall-layout.ts`](./views/card-wall-layout.ts) | [`card-wall-layout.test.ts`](./views/card-wall-layout.test.ts) | Columns from the wall's width; each card in the shortest column; where cards slide as the search changes |
| [`transition-view-model.ts`](./views/transition-view-model.ts) | [`transition-view-model.test.ts`](./views/transition-view-model.test.ts) | The way in (the wall burns, the picture floats to the play area, the screen powers on) and out, and the quiet fade for reduced motion |
| [`search-suggestions.ts`](./views/search-suggestions.ts) | [`search-suggestions.test.ts`](./views/search-suggestions.test.ts) | Which tags match what was typed, and which one the arrow keys move to |
| [`card-wall-keys.ts`](./views/card-wall-keys.ts) | [`card-wall-keys.test.ts`](./views/card-wall-keys.test.ts) | Which card the arrow keys move to, across columns |
| [`attract-view-model.ts`](./views/attract-view-model.ts) | [`attract-view-model.test.ts`](./views/attract-view-model.test.ts) | Attract mode: which card plays its entry live, once it has stayed selected a second |

The transition is the clearest example. It is a few hundred lines of
phases, each advanced by `update(deltaMs)` and read by the transition view
each frame. Its tests step it through a whole launch in a few milliseconds,
reduced motion included, and never draw anything.

## 5. A View Model Telling the Model When to Act

The model loads an entry, then waits in `'ready'`. It does not start
playing on its own, because the way in is still running: the picture is
still floating to the play area. The transition view model says when:

```ts
const transition = createTransitionViewModel({
    isReady: () => model.phase === 'ready',
    onHandOver: model.startPlaying,
    // ...
});
```

(`arcade-view.tsx`.) `onHandOver` is a relay binding, like a button's
`onClick`: the view reports an event, and the model decides what it means.
The model knows nothing about transitions, and the transition knows nothing
about loading; each waits on the other through the bindings.

## 6. One Loop, Any Renderer

[`main.ts`](./main.ts) runs the page's one loop, in the MVT order:

```ts
model.update(deltaMs);        // the Arcade's model
followModel();                // start or stop the entry's session as the phase changes
host.tick(timeMs, deltaMs);   // the entry: its models, its views, its renderers
updateView(root, deltaMs);    // the Arcade's views
refreshView(root);
```

The entry host ([`../runner/entry-host.ts`](../runner/entry-host.ts)) runs
an entry of either kind. A Pixi entry draws on a stage the host owns, whose
ticker the loop steps; an `element` entry (three.js, Pixi and HTML, or any
mix) gives the host the roots of its views, and the host updates and
refreshes exactly those, then asks the entry to render. The tick API is the
same set of functions for every renderer, so one loop drives them all. The
entry's element sits out the page's own `updateView` and `refreshView`
(its steps return `SKIP_DESCENDANTS`), so nothing is ticked twice.

`followModel` uses `watch` to see the phase change, and starts or ends the
entry's session then: the page, not the model, owns sessions, since they
hold renderers.

The page runs a second entry host too, for attract mode: a card that stays
selected for a second plays its entry live over its photo. The wall's
attract view model says which card (`onLiveWanted`); the page loads the
entry and plays it in a host that takes no input (`playLive` in `main.ts`),
ticked in the same loop; the card shows it, scaled and cropped as its
photo. The model never knows: which card plays is presentation.

## 7. Measurements as Input

Where a card goes depends on how tall it is, which only the browser knows
once it has laid the card out. The wall measures with a `ResizeObserver`
([`card-wall-view.tsx`](./views/card-wall-view.tsx)) and reports what it
sees to the layout view model as input:

```ts
if (index === undefined) layout.setWidth(record.contentRect.width);
else layout.setCardHeightAt(index, record.borderBoxSize[0]?.blockSize ?? record.contentRect.height);
```

The layout decides positions from those numbers, and the cards' refresh
steps write them. Until a card has been measured, the layout uses an
estimate (`estimatedHeightAt`). The measuring happens in the observer's
callback, between frames, never in a refresh: a refresh that read layout
after writing it would make the browser lay out the page there and then.

## Where It Bends the Rules

Three places do something the rules would usually rule out. Each is
deliberate:

- **Reading a drawn pose back from the page.** When the way in starts, it
  needs the exact pose of the card's polaroid, which may be part way through
  a CSS transition as the card is selected. `photoPoseOf`
  ([`card-view.tsx`](./views/card-view.tsx)) reads it from the page
  (`getComputedStyle`, `getBoundingClientRect`), once, as the transition
  starts. Presentation output becomes input, but only at that one moment,
  and only to start presentation state.
- **Views with their own `window` listeners.** The page's keys (`/` for the
  search, Escape to close a panel, pause or leave, the pause menu's arrows)
  are not events on any one element, and the JSX runtime has no attribute
  for `window`. The views
  that need them add a listener and remove it in `onDestroyed`
  (`arcade-view.tsx`, `about-view.tsx`, `search-bar-view.tsx`,
  `pause-menu-view.tsx`, and `wall-effect-view.ts` for `resize`).
- **The transition writes to the runner's stage.** The screen powering on
  squashes the entry's own picture, which is in the stage element the entry
  host owns. `drawStage` ([`transition-view.tsx`](./views/transition-view.tsx))
  sets that element's `transform` while it plays, and clears it after.

## Open Questions

Building the Arcade raised questions the docs do not answer yet: when a view
may read layout back, how a view model and a model hand control to each
other, where reduced motion belongs, and how a URL relates to a model. They
are task [041](../../../../notes/tasks/backlog/041-docs-from-the-arcade.md).
What it showed about the HTML JSX runtime is task
[038](../../../../notes/tasks/backlog/038-html-jsx-findings-from-the-arcade.md).
