# Proposal: Tock, MVT for web apps

> A framework for building web apps the MVT way, offered as a rival to React
> and Vue. The ticker drives games; Tock is its other half, for apps: the
> same models, views and bindings, ticked only when something happens. The
> plan has five parts: libraries (an app ticker, keyed lists, forms,
> routing, async), a widget library, a site that sells the idea and teaches
> it, docs, and benchmarks against React, Vue, Solid and Svelte. Stage 0 is a
> spike that decides whether the rest is worth building. It ports the
> standard framework benchmark and one real app, and checks that an idle
> page costs nothing.

**Status:** proposed. Nothing built. Stage 0 (section 12) is a spike whose
results decide whether stages 1-5 go ahead.

**Written:** 2026-10-31, on `vnext`, against `@mvtjs/html` and its JSX
runtime as they are today, the saved results in
[packages/internal/benchmarks/results/](../../packages/internal/benchmarks/results/),
and npm as checked that day.

**Related:**
[@mvtjs/html](../../packages/libraries/html/README.md) (the view tick API
and JSX for the DOM, which Tock builds on),
[the JSX base's design notes](../../packages/libraries/utils/src/jsx/design-notes.md)
(sections 2-4 name the conditions under which context and cleanup scopes
should be revisited, and an app framework meets both),
[the Arcade's page](../../packages/sites/arcade/src/arcade/) (an app already
built with MVT: search, filters, routing, dialogs, forms, saved state),
[013](../archive/013-mvt-performance-ceiling.md) (MVT's one inherent cost: reading
every binding on every refresh),
[the watch API](../../packages/libraries/utils/src/watch-api/README.md),
[the playground](../../packages/sites/playground/) and
[its docs embeds](../archive/061-playground-embeds-for-the-docs.md),
[075](./075-docs-as-a-book.md) (the docs as a book),
[077](./077-audio90-studio.md) (the Studio, the first app-shaped MVT site
after the Arcade's page).

| Decision | Recommendation | Section |
| --- | --- | --- |
| Name | **Tock**, packages published as `@mvtjs/*`, the site and brand Tock. Runners-up: Vsync, Cadence | 3 |
| What makes it different | Explicit time, one-way flow with no re-render, models you can test and replay without a DOM. Not "faster at everything" | 1, 2 |
| The one big new idea | **Ticks on demand.** The app ticker ticks when input, an async result or a model's deadline needs a tick, and runs continuously only while something animates. An idle page costs nothing | 5.1 |
| Rule changes | None. "Every frame" becomes "every tick" in the docs; rule 1 (no wall-clock time in models) holds, and makes the deadlines possible | 5.1, 10 |
| New library work | Keyed lists, routine destruction with cleanup on a node's own destruction, form inputs that never fight the caret, a router model, async delivery into models | 5.2-5.6 |
| Context | Still none. Theming through CSS custom properties, services through grouped bindings | 5.7 |
| Server rendering | Later (stage 4): render to HTML once, then rebuild on the client. No hydration at first | 5.8 |
| Widgets | `@mvtjs/widgets`: each widget is a small model for its interaction state plus an unstyled, accessible view that follows the WAI-ARIA patterns. A default theme in CSS variables | 6 |
| Site | `packages/sites/tock/`, built with Tock: the pitch, live side-by-side demos, an interactive tutorial on the playground | 7 |
| Docs | A Tock section of the docs site, sharing the architecture pages with the games docs | 8 |
| Benchmarks | The community's js-framework-benchmark, ported and run in its own harness, plus our own suites for what we claim: idle cost, live data, input latency under load, long sessions | 9 |
| Go or no-go | Hypotheses with thresholds, checked in stage 0, and published even when we lose | 9.4 |

---

## 1. Why

React's central idea is that UI is a function of state. MVT takes the same
idea further. In React, a component re-runs when its state changes, and
whatever it captured on the last run (props, state, closures) is what it
sees. Hooks exist to manage that: dependency arrays, `useMemo`,
`useCallback`, the rules of hooks, stale closures, and effects that run
twice. Vue and Solid swap re-running for tracked reactivity, and with it
proxies, `.value`, lost reactivity when a value is destructured, and
effects whose triggers are invisible at the call site.

MVT has none of this machinery. A view is built once. Its bindings are
plain functions it calls on each refresh. Nothing re-runs and nothing is
tracked, so nothing goes stale. State lives in models, which are plain
objects with actions, advanced by `update(deltaMs)`. The whole program
moves in one step, the tick, in one fixed order. That gives an app three
things the big frameworks don't:

- **Time is explicit.** A toast that expires, a debounced search, a retry
  with backoff, an undo window: in React each is a `setTimeout` in an
  effect, with a cleanup, and tested with fake timers. In MVT each is a
  number in a model, counted down by `update`, and a test calls `update(3000)`.
- **Tests need no DOM.** Models carry all the behaviour, so most tests are
  plain function calls. Views get pixel tests from v-snap, posed through
  bindings.
- **A session can be replayed.** If the inputs and the `deltaMs` of every
  tick are recorded, a session replays exactly, because nothing else feeds
  the models. Time-travel debugging, bug reports with a recording attached,
  and tests made from recordings follow from that, rather than from a
  devtools add-on.

It also suits a kind of app the big frameworks handle badly: UIs that move
all the time. Trading screens, live dashboards, editors with playback,
multiplayer views and creative tools are mostly patched in React with
`requestAnimationFrame` escapes and refs. MVT is built for that, and can
mix DOM, Pixi and three.js views in one tick, as the Arcade does.

Why now: most of the pieces exist. `@mvtjs/html` has a JSX runtime with
`<List>` and `<Switch>`, and the Arcade's page is already a real app built
on it, with search, filters, routing over `popstate`, dialogs, a highscore
form and saved state, inside a 60 KB home page budget. The Studio (077)
will be another. What's missing is what turns a game library into an app
framework: an idle story, keyed lists, forms, async, routing, widgets, and
the case made in public with numbers.

## 2. Where Things Stand

### 2.1 The rivals

| | React 19 | Vue 3.5 | Solid 1.9 / Svelte 5 | MVT today |
| --- | --- | --- | --- | --- |
| What changes the UI | A component re-runs, then its virtual DOM is diffed | Proxies track reads; a component re-renders, diffed | Signals track reads; the exact DOM nodes are patched | Each refresh reads every binding; JSX writes when the value differs |
| Where state lives | Hooks in components, or a store library | `ref`/`reactive`, in components or Pinia | Signals, anywhere | Models, always |
| Time | Timers in effects | Timers in watchers | Timers in effects | `update(deltaMs)` only |
| Idle cost | None | None | None | One refresh per frame, continuously (section 2.2) |
| Testing behaviour | Render, then query the DOM | Mount, then query the DOM | Mount, then query the DOM | Call the model; pose the view |
| Ecosystem | Huge | Large | Growing | None |

React's Compiler and Vue's Vapor mode are both moving toward fine-grained
updates, so the gap in raw update speed is closing from their side. Tock
shouldn't compete on "less work per change", where signals win by design.
It should compete on the model of the program, and on apps where state
changes all the time.

### 2.2 What our own benchmarks already say

The saved results compare MVT with Solid's signals, on 1000 containers in
Node:

| Share changed per frame | MVT, hand-written | MVT, JSX | Solid signals |
| --- | --- | --- | --- |
| 0% | 4.96 µs | 13.3 µs | 0.01 µs |
| 10% | 6.12 µs | 14.6 µs | 23.3 µs |
| 100% | 9.8 µs | 18.9 µs | 244 µs |

([reactivity.md](../../packages/internal/benchmarks/results/reactivity.md),
three bound properties each.) MVT's cost grows with how much is **bound**,
signals' cost with how much **changes**. Where most things change every
frame, MVT is many times faster. Where nothing changes, signals cost
nothing and MVT still reads every binding. A game is in the first case
most of the time. A typical app is in the second.

On the DOM, `refreshView` over 1000 elements, each with a method, takes
7.7 µs a frame, and 77 µs over 10,000
([html-refresh-view.md](../../packages/internal/benchmarks/results/html-refresh-view.md)).
That's cheap while the page is in use, but it costs battery when it runs 60
times a second on a page nobody is touching. Section 5.1 removes that
cost. Nothing else in this proposal matters if it can't.

## 3. The Name

**Tock.** The ticker ticks, and Tock is the other half. In a game, the
ticker ticks every frame. In an app, a tick is answered when something
happens. The name is short, says "time" without explaining it, and leaves
room for the tagline: *UI that keeps time.*

- `tock` on npm is taken by a dormant timer package (0.2.1, last published
  2022). `tockjs` is free. We don't need either: the packages publish as
  `@mvtjs/*`, which we own, and Tock is the name of the site and the
  approach, as Next names a framework built from React packages.
- **Runners-up.** **Vsync**, the moment a frame reaches the screen. It's a
  good name with game heritage, and `vsync` on npm was unpublished in 2024,
  so the name may be free. Against it: it's a common graphics term, so it's
  hard to search for. **Cadence** is calm and musical, but `cadence` is
  taken and the word is in wide use.
- Ruled out: names with "react" in them (they'd define us by the rival),
  `escapement` (taken, active in 2026), and `tickjs` (taken).

Open question 1 asks whether Tock gets its own npm scope and domain.

## 4. What Gets Built

```
packages/
├── libraries/
│   ├── utils/        unchanged in shape; gains keyed list support in the JSX base (5.3)
│   ├── html/         gains the app ticker (5.1), form bindings (5.4), cleanup on destruction (5.3)
│   ├── app/          NEW @mvtjs/app: async delivery (5.2), the router model (5.5), recording and replay (5.9)
│   └── widgets/      NEW @mvtjs/widgets: widget models, views and a default theme (6)
├── sites/
│   ├── tock/         NEW private: the Tock site, promotional and teaching (7)
│   └── docs/         gains a Tock section (8)
└── internal/
    └── framework-benchmarks/  NEW private: the comparison benchmarks, in a browser (9)
```

Whether the ticker belongs in `@mvtjs/html` or `@mvtjs/app` is open
question 2. The ticker is renderer-agnostic, but it needs the DOM's events
and `requestAnimationFrame`.

## 5. The Libraries

### 5.1 The app ticker: ticks on demand

The MVT order stays exactly as it is: models update, views update, views
refresh, the browser paints. What changes is **when** a tick happens. The
app ticker ticks in the next animation frame when one of these asks for
it, and otherwise doesn't run:

1. **Input.** The JSX target already wires events before other attributes
   (design note 8). After any `on*` handler runs, it asks for a tick. A
   handler that sends a model action is therefore followed by one tick that
   shows the result.
2. **An async result** delivered to a model (section 5.2).
3. **A model's deadline.** A model that needs time to pass, such as a toast
   that hides after 3 s, exposes when it next needs a tick: a query such as
   `nextTickInMs` returning milliseconds, or `undefined` for never. After
   each tick the ticker reads the root model's deadline and sets one timer
   for it. The timer lives in the ticker, as `requestAnimationFrame` does
   today, so rule 1 holds: models still never touch the clock, and they
   advance only through `update(deltaMs)`. A parent model combines its
   children's deadlines with `Math.min`.
4. **Something animating.** While any model or view reports that it is
   moving (`isAnimating`, read after each tick), the ticker ticks every
   frame, as a game's does. A transition or a live chart keeps it running,
   and when it settles, the ticker stops.
5. **By hand:** `ticker.requestTick()`, for anything else, such as a
   `ResizeObserver` callback.

`deltaMs` on each tick is the real time since the last one, clamped as the
Arcade clamps it today. A model counting down a deadline gets the time it
asked for in one step. A model that simulates in fixed steps already copes
with large steps, and section 5.9's recording keeps those steps
reproducible.

A game is the same ticker with `isAnimating` always true, so games and apps
share one ticker and one set of rules.

What it costs: one boolean and one `Math.min` per model per tick, and no
work at all between ticks. A forgotten deadline shows up as a toast that
never hides, which happens every time and is easy to find, not as a
subtle timing bug. In development, the ticker can catch it: if a tick
changes the result of a binding while nothing has asked for a tick, warn.

Settled here, do not reopen without new information: **a continuous loop
with dirty checks** (tick every frame, skip the refresh if nothing
changed) doesn't remove the idle cost. Deciding "nothing changed" means
reading every binding, which is the refresh itself.

### 5.2 Async: results are input

Fetches, workers and sockets finish when they finish, like a click. So
they are handled like input: the result is handed to a model action, and a
tick is asked for. `@mvtjs/app` offers one helper:

```ts
// The view, or the app's wiring, starts the request; the model never sees the promise
deliver(fetchUser(id), {
    onResolved: (user) => model.userLoaded(id, user),
    onRejected: (error) => model.userFailed(id, error),
});
```

The model owns the request's state (`'idle' | 'loading' | 'loaded' |
'failed'`) as ordinary state, and ignores late results for an id it no
longer wants, so a stale response can't overwrite a newer one. Suspense,
loading boundaries and query caches become views that read that state and
models that hold it. A cache model in the style of TanStack Query (stale
times, retries with backoff) is a natural first-party model, because its
timers are deadlines (section 5.1), and it can be tested with plain
`update` calls.

### 5.3 Keyed lists, and destruction as routine

Today's `<List>` is unkeyed: slot `i` shows whatever item is at index `i`.
It keeps every slot it builds, and detaches the slots past the end rather
than destroying them. That suits a game session. An app needs two more
things:

- **A keyed list.** `<List each={items} key={(item) => item.id}>`: each
  item keeps its view as it moves, so focus, text selection, scroll
  position and transitions follow the item. Moves reorder DOM nodes. The
  algorithm is the familiar one, the longest increasing subsequence, as
  Vue, Solid and Inferno use it. The unkeyed list stays, as the faster
  choice when items have no identity of their own.
- **Releasing views.** A list that once showed 10,000 rows shouldn't hold
  10,000 views forever. A keyed list destroys an item's view when its key
  leaves, and the unkeyed list gains a limit on the detached slots it
  keeps.

Destruction becomes routine, which is exactly the "when to revisit" in
design note 4. So views get cleanup scopes, under the constraint that note
3 already sets: cleanups attach to the component's own root node, not to a
stack of owners, and registering one during a lazy build throws in
development. `onDestroyed` keeps working as it does.

### 5.4 Forms and text input

A binding written to an input's `value` while the user types would fight
the caret and break IME composition. The rule for form bindings:

- **Values flow both ways through bindings**, never through a store
  hidden in the input: `value={() => form.email}` reads and
  `onInput={(text) => form.setEmail(text)}` relays.
- **The view doesn't write the value while the user's own edit is the
  latest.** While the input has focus, or during IME composition, the
  value is written only when the model's value differs from the one the
  user last typed. A model that rewrites the text (an input mask, trimming)
  still wins. JSX's `onChange` write kind (write when the value differs) is
  the base for this.
- **Validation lives in models.** A form model holds values, which fields
  were touched, the errors, and submission state. Async validation, such as
  "is this username free?", is section 5.2 plus a debounce deadline from
  section 5.1.

### 5.5 Routing

The URL is state, so it belongs in a model. The Arcade already does this
([arcade-path.ts](../../packages/sites/arcade/src/arcade/models/arcade-path.ts),
`followUrl`, `popstate`). `@mvtjs/app` offers a router model: routes as
typed patterns, the current route and its params as queries, and
`navigate(...)` as an action. A small piece of wiring keeps the model and
`history` in step, in both directions. Views choose the page with
`<Switch>`. Code-split pages load as async results (section 5.2), and the
Arcade's entry loading already works this way.

### 5.6 Sharing state across an app

Models compose into a tree, and each part of the app gets the models it
needs through bindings, as now. Large apps need a few more patterns,
written down rather than built into the library: a model for one session's
shared state (the signed-in user, settings), a model per page that's
created when the page opens and destroyed when it closes (section 5.3), and
derived values with `createComputed` from the watch API.

### 5.7 No context, still

The JSX design notes ruled out context providers (note 2), because a value
looked up from wherever a view ends up is a hidden input. A widget library
is where people expect context most, for theming. Tock meets that need
without it:

- **Themes are CSS custom properties.** The cascade already is context,
  and the browser runs it for free.
- **Services** (translations, a logger) come through grouped bindings or
  imports, which are the four ways in the docs' "Sharing What Many Views
  Need".

If a widget-heavy app built in stage 2 shows the four ways fall short, that
is the new information note 4 asks for, and context can be revisited then.

### 5.8 Server rendering

Search engines, link previews and the first paint on a slow phone all want
HTML from the server. Because building a view is inert and one refresh
writes everything, a server render is: build the tree on a light DOM (such
as `linkedom`), refresh once, and serialise. At first the client rebuilds
from scratch and replaces the server's HTML. That's simple and correct,
but it costs a rebuild on load. Adopting the server's nodes instead
(hydration) is a later step, because the JSX target would need to match
nodes rather than create them. This is stage 4. Most of the apps Tock
targets are behind a login, and a site whose pages are mostly static is
not where Tock is strongest (open question 4).

### 5.9 Recording, replay, and devtools

The ticker can record each tick's `deltaMs` and every input and async
result it delivers, in order. Played back into fresh models, the recording
reproduces the session exactly. That gives:

- **Bug reports with a recording attached**, replayed to the frame.
- **Tests made from recordings**: replay a recording, then check the
  model's state or the view's pixels.
- **A devtools panel** (a later stage): a timeline of ticks with what each
  delivered, a scrubber that replays up to any tick, and the Perfmon's
  timings per tick.

Nothing in the libraries needs to change to allow this. The recording just
has to be complete: input that reaches a model without going through a
relay binding or `deliver` is a bug the recorder can warn about.

## 6. The Widget Library

`@mvtjs/widgets` is the piece people judge a framework's ecosystem by, so
it has to be good from its first release.

**Each widget is a model and a view.** The model holds the widget's
interaction state and rules: which option is active, whether the menu is
open, what the combobox's filter matches, a slider's value within its
steps. The model is tested without a DOM. The view follows the WAI-ARIA
Authoring Practices pattern for the widget: roles, keyboard support, focus
handling and `aria-activedescendant`. What each key does lives in the
view, which calls the model's small, guarded actions, as the repo already
does for controls. An app can own a widget's model inside its own model,
for full control, or let the view create one for simple use.

**Unstyled first, with a theme.** The views ship without visual styles,
with stable class names and data attributes. A default theme in CSS custom
properties makes them look finished out of the box. Every widget gets
v-snap visual tests in the default theme, light and dark, and in each
state it can be posed into.

**Tiers:**

| Tier | Widgets |
| --- | --- |
| 1 (stage 2) | Button, toggle, checkbox, radio group, switch, text field, slider, tabs, dialog, tooltip, toast, menu, listbox, select |
| 2 | Combobox with async options, data grid (virtualised, sortable, editable cells), tree, date picker, splitter, drag-and-drop list |
| 3: where MVT shines | Live charts and sparklines on canvas, a virtualised grid streaming 1000 rows of updates a second, a timeline with playback, a node editor in Pixi, transitions driven by models |

Tier 3 is the marketing. These are the widgets React apps struggle to
build, and they show what explicit time and mixed renderers make easy.
Virtualisation is cheap here because a hidden subtree is skipped whole
(`SKIP_DESCENDANTS`).

## 7. The Site

`packages/sites/tock/`, built with Tock itself, so the site is the first
demo. It is served beside the Arcade, the docs and the playground. Its
pages:

- **The front page.** The pitch in one screen: a React component and its
  Tock equivalent side by side, a live demo that runs both with a frame
  meter, and three sentences on what's different. No benchmark claims that
  section 9 doesn't back up.
- **See it move.** Three live demos with their source, each a tier 3
  widget: a market screen, a collaborative whiteboard, and an editor with
  undo and playback. Each has a "replay this session" button, which shows
  recording and replay (section 5.9) better than an essay can.
- **Learn.** An interactive tutorial on the playground's embeds (061):
  build a small app (a reading list with search, a form and a toast) in
  ten steps, each one editable and runnable.
- **For React developers** and **for Vue developers**: their patterns
  translated (`useState`, `useEffect` with a timer, context, Suspense,
  `computed`, `watch`, `v-model`), with what Tock does instead and why.
  Honest about what they'll miss.
- **Benchmarks.** The tables from section 9, generated from the saved
  results, with the method, the machine, every framework's version, and
  links to the code. The results we lose go on the same page.
- **Showcase**, once there is anything to show, starting with the Arcade's
  page and the Studio.

## 8. The Docs

The architecture pages (models, views, bindings, the ticker, the rules,
the principles) belong to MVT, not to games, and serve both audiences. So
Tock's docs are a section of the existing docs site, not a second site.
075's book structure gets a second track:

| Part | Pages |
| --- | --- |
| Getting started | Install, a first app, the shape of a Tock project |
| Thinking in Tock | One state, many views; time is a number; input is an action; why nothing re-runs |
| Building apps | Ticks on demand and deadlines; lists and keys; forms; async and caching; routing; pages that come and go; sharing state |
| Widgets | Each widget: its model, its view, its keyboard support, examples |
| Testing | Models without a DOM; visual tests; tests from recordings |
| Performance | What a tick costs; binding counts; virtualisation; when to keep ticking |
| Coming from React / Vue | The translation guides (section 7), kept in one place |
| Reference | API pages for `@mvtjs/app` and `@mvtjs/widgets` |

The architecture overview's line "There is no event-driven re-render;
instead, the ticker drives a steady frame loop" needs rewording, since
apps tick on demand. The rule doesn't change. Only how often a tick
happens does.

## 9. The Comparison Benchmarks

### 9.1 The standard benchmark

The community's [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark)
is what everyone cites: create 1,000 and 10,000 rows, replace them, update
every tenth, select a row, swap two, remove one, append, clear, plus
memory, startup and bundle size. Tock gets an entry in both of its
categories, keyed (section 5.3) and unkeyed, written as a Tock user would
write it. We run it in the benchmark's own harness, beside the current
entries for React (with and without the Compiler), Vue (and Vapor, if it
is listed), Solid, Svelte and vanilla JS. Submitting the entry upstream is
open question 5.

This benchmark measures what signals are best at: one change, then idle.
We expect to be behind Solid and Svelte there, and that's fine if we're
close (section 9.4).

### 9.2 Our own suites, for what we claim

Each claim on the site gets a benchmark, with every framework written in
its own idiomatic style and reviewed against its docs:

| Suite | What it measures | Why |
| --- | --- | --- |
| Idle | CPU time per minute on a page left open, after input stops | Proves section 5.1. Target: no work between ticks |
| Live data | N cells (100 to 10,000), a share of them changing at 1 to 60 Hz: time per frame, dropped frames | Where MVT should win (section 2.2) |
| Input under load | Delay from a key press to paint while live data runs | What users feel. The browser's Event Timing API |
| Transitions | 500 items moving to new places with eased motion | Explicit time against animation libraries |
| Long session | Memory and time per tick after 10,000 rows have been created and removed | Section 5.3's release of views |
| Startup | Bundle size, and time to first paint for a 50-component app | Where small runtimes win |
| Test speed | Time to run the same app's behaviour tests | Models without a DOM against render-and-query |

These live in `packages/internal/framework-benchmarks/`, a private
package with React, Vue, Solid and Svelte as its own dependencies, so the
libraries never see them. Each suite runs in headless Chrome, uses the
production build of each framework, and saves its results as generated
markdown, as the existing benchmarks do.

### 9.3 Fairness

The benchmarks are as credible as their weakest entry, so:

- Each rival's code follows its own docs, and is offered for review to
  someone who uses that framework every day before results are published.
- Runs are interleaved, on an idle machine, with the median of several
  processes, following the pitfalls already written up for this repo's
  benchmarks (JIT flips, dev-server bias, busy-machine saves).
- Versions, machine and browser are printed with every table, and the code
  is linked from it.
- Results we lose are published in the same table as those we win.

### 9.4 Hypotheses, and what would stop the project

Stage 0 checks these. They are the go or no-go for stages 1-5.

| # | Hypothesis | Threshold |
| --- | --- | --- |
| H1 | An idle Tock page does no work between ticks | 0 ticks, and under 1 ms of script per minute |
| H2 | On js-framework-benchmark, keyed, Tock is in the same class as Vue | Weighted mean within 1.25x of Vue's |
| H3 | On live data with 10% changing every frame, Tock beats React and Vue | At least 2x faster per frame at 1,000 cells |
| H4 | A real app ported to Tock is no larger in code than its React version | Lines of code within 1.2x, models included |
| H5 | Its behaviour tests run faster with no DOM | At least 3x faster than with Testing Library |

If H1 fails, stop: an app framework that drains batteries is not worth
building. If H2 fails, find out why before going on. If H3 fails, the main
pitch fails with it, and the project becomes a docs page on MVT for UIs
rather than a framework.

## 10. How MVT Fits

The rules don't change. Models own state and advance only by
`update(deltaMs)`, views read through bindings and hold only cosmetic
state, the order of a tick is fixed, and models never use wall-clock time.
Deadlines (section 5.1) are how a model that needs time says so without
breaking rule 1. Async delivery (5.2) is input by another name. Widget
models are ordinary models. The site, the widgets and the benchmarks
follow this repo's conventions: factory functions, views as functions,
barrel imports, and no `null` or `this`.

What does change is how the docs describe a tick: "every frame" becomes
"every tick", and the architecture pages say that a tick can come from the
clock or from an event.

## 11. Risks

- **The ecosystem.** People choose React for its libraries, hiring and
  answers on the web, not its model. Tock can't match that. It can target
  the apps where the model is decisive (live, animated, deterministic) and
  make interop easy: a Tock view inside a React app, and a React component
  inside a Tock view, as islands (open question 6).
- **Polling scales with bindings.** A page with 50,000 bound values that
  ticks continuously during an animation costs more than signals would.
  The mitigations are virtualisation, hidden subtrees being skipped, and
  section 9 measuring where the crossover is. The docs then say so.
- **Forgotten deadlines.** Section 5.1's development warning catches most
  of these. The rest fail in a visible, repeatable way.
- **Scope.** This is the largest proposal in the repo. The stages are cut
  so that each one is worth having even if the next never comes: stage 0
  alone gives a benchmark and an article, and stage 1 makes the Arcade's
  page and the Studio better.
- **Moving targets.** React's Compiler and Vue's Vapor will be faster by
  the time we publish. Benchmarks are rerun before each release, and the
  pitch never rests on speed alone.

## 12. Stages

| Stage | What | Worth it on its own because |
| --- | --- | --- |
| 0. Spike | The app ticker (5.1) on the Arcade's page; a js-framework-benchmark entry; a port of one real app (TodoMVC, then a small RealWorld-style app); the idle and live-data suites against React and Solid. Checks H1-H5 | Decides go or no-go. The Arcade's page stops costing battery at idle |
| 1. Core | Keyed lists and cleanup scopes, form bindings, `deliver`, the router model, recording and replay | The Arcade's page and the Studio use each part |
| 2. Widgets, tier 1 | Fourteen widgets, the default theme, visual tests. A widget-heavy demo checks section 5.7 | The Studio's panels use them |
| 3. Site and docs | The Tock site, the docs track, the tutorial, the translation guides, all benchmark suites | Tock can be launched |
| 4. Depth | Tier 2 and 3 widgets, server rendering, the devtools panel, React interop | Answers what early users ask for |
| 5. Launch | Release `@mvtjs/app` and `@mvtjs/widgets`, publish the site and benchmarks, an article on why there is no re-render | |

## 13. Open Questions

1. **Own scope and domain?** Publish as `@mvtjs/*` (owned) with Tock as
   the brand, or register `@tock`/`tockjs` and a domain of its own? A rival
   to React may need a name people can type without knowing MVT.
2. **Where does the ticker live?** In `@mvtjs/html`, beside the view tick
   API, or in `@mvtjs/app`? It needs DOM events and
   `requestAnimationFrame`, but a Pixi-only app could use it too.
3. **How do deadlines compose?** Every model exposes `nextTickInMs`, or
   models register with a small scheduler model that the root owns? The
   first is simpler; the second scales better to many timers.
4. **Server rendering's priority.** Stage 4, as proposed, or earlier if
   the target audience turns out to want it for content sites?
5. **Submit to js-framework-benchmark?** The benchmark is public and
   widely cited. Putting an entry there is an outward-facing step, best
   taken when the keyed list is stable.
6. **Interop.** Is a React component inside a Tock view, and the reverse,
   a stage 4 feature or a launch requirement?
7. **Is Tock games and apps, or apps only?** One framework whose ticker
   runs on demand for apps and continuously for games is the cleaner
   story. It would also make the Arcade Tock's biggest showcase.

## 14. Implementation Steps

Stage 0 only. Later stages get their steps when stage 0 reports.

1. Write the app ticker in the Arcade's page's loop: ask for a tick after
   input, a deadline from the root model, and `isAnimating`. Measure the
   idle page (H1).
2. Add the development warning for a binding that changes while nothing
   asked for a tick.
3. Create `packages/internal/framework-benchmarks/` with the idle and
   live-data suites for Tock, React 19 and Solid, in headless Chrome.
4. Write a js-framework-benchmark entry, unkeyed first, and run it in the
   benchmark's own harness against the current entries (H2).
5. Prototype the keyed list well enough for the keyed category.
6. Port TodoMVC, then a small RealWorld-style app, from React; compare
   code size and test speed (H4, H5).
7. Report against section 9.4 here, with the results saved, and decide on
   stage 1.

## 15. Progress

- 2026-10-31: proposed.
