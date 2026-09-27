# Proposal: one view convention for the repo

> The repo's views are written in two styles: `createFooView(bindings)` with
> `get*`/`on*` members, and JSX function components `FooView(props)` with bare
> getters. Should the repo settle on one, or keep both and bridge them as 007
> proposes? This proposal separates what a view's callers see from how its
> body is written, and recommends one convention for the first while leaving
> the second as a per-view choice: every view is a function `FooView(bindings)`
> returning a Pixi container, its accessors are named for what they return,
> and its body is JSX where JSX fits and imperative where it does not.

**Status:** accepted 2026-09-27, being implemented. It supersedes 007, now
archived. Done: the architecture docs (section 12), the `ValueOrGetter`
rename, the `onRefresh` attribute, the convention docs, and every module's
migration: Scramble as the pilot (section 17), `common/` (section 18), and
the demos, the cabinet and the other games (section 19). Remaining (section
16): the rest of the JSX runtime's graduation, optional JSX bodies, and the
Building with MVT rewrite.

**Written:** 2026-09-26, against the `vnext` branch at `4b633e6` plus the
uncommitted boids changes. Counts are from `grep` over `src/`.

**Related:** [007 - Authoring-convention bridge](../archive/007-authoring-convention-bridge.md) (superseded),
[`src/pixi-jsx/`](../../src/pixi-jsx/index.ts),
[Architecture: Bindings](../../docs/architecture/bindings.md),
[Bindings](../../docs/building-with-mvt/presenting-the-world/bindings.md) and
[Bindings in Depth](../../docs/building-with-mvt/presenting-the-world/bindings-in-depth.md),
[Style Guide](../../docs/reference/style-guide.md),
[017 - Miscellaneous loose ends](../tasks/backlog/017-misc-loose-ends.md) (the
method-syntax item and the parked `<List>` guide item),
[011 - Multi-package repo](./011-multi-package-repo.md).

---

## 1. Summary

| # | Question | Recommendation | Section |
| --- | --- | --- | --- |
| 1 | One convention, or two? | One, for everything a view's callers see. Leave how each view's body is written to the view | [4](#4-two-questions-not-one), [5](#5-is-one-convention-worth-it) |
| 2 | Which one? | Option C: the JSX function-component shape outside. Inside, JSX or plain TypeScript, whichever suits the view; neither is required | [6](#6-the-options), [10](#10-is-jsx-everywhere-viable) |
| 3 | `createFooView` or `FooView`? | `FooView`. It works as a JSX tag and as a plain call; `createFooView` works only as a call | [7](#7-naming-the-view-createfooview-or-fooview) |
| 4 | `props` or `bindings`? | `bindings`, in JSX files too. `props` is React's word, not JSX's, and it collides with "property" | [8](#8-naming-the-input-bindings-or-props) |
| 5 | Keep the `get` prefix? | No. Name query bindings for what they return, as boolean query bindings already are. Let each query binding's type say whether it takes a fixed value, a function, or either | [9](#9-naming-accessors-with-or-without-get) |
| 6 | Is JSX everywhere viable? | For most views, yes, but it is not required: each view's body can be JSX or plain TypeScript, and a few views suit plain TypeScript better | [10](#10-is-jsx-everywhere-viable) |
| 7 | 007's bridge? | Not needed. It bridges a difference this proposal removes. Archive 007 as superseded, keeping its `ValueOrGetter` rename | [11](#11-what-happens-to-007) |
| 8 | Architecture docs? | Stay free of JSX. Describe binding members by role, not by prefix | [12](#12-the-docs-architecture-versus-this-repo) |

---

## 2. The question

The repo has two ways to write a view, and they do not compose without glue:

- **Classic views** follow the current docs and skills: a `createFooView`
  factory takes a `FooViewBindings` object of `get*()` accessors and `on*()`
  handlers, builds Pixi containers imperatively, and sets `view.onRefresh`.
- **JSX views** are function components: `FooView` takes a `FooViewProps`
  object whose getters have no `get` prefix (`grainCount: () => number`),
  whose `on*` handlers are named exactly as bindings are, and whose fixed
  values can be plain values (`cols: number`). See the falling-sand demo.

The main question is whether to settle on one of these, or support both,
perhaps with 007's transforms. Behind it are five smaller ones, each taken
in its own section: the function's name, the word for its input, the `get`
prefix, whether JSX can carry every view, and what the architecture docs
should say.

Two constraints frame the answer:

- The architecture docs describe a pattern that is independent of language
  and runtime. JSX is one technology in one ecosystem, and its vocabulary
  should not leak into them.
- The Building with MVT docs describe what this repo does, and already say
  where the repo's choices are its own rather than the architecture's
  (factory functions, `onRefresh`, GSAP timelines). A repo convention built
  on JSX fits that pattern, provided the docs say how it maps to the
  architecture's terms.

---

## 3. What the repo has today

| | Classic | JSX |
| --- | --- | --- |
| Files | 59 `*-view.ts` | 5 `*-view.tsx` |
| Input type | 52 `*ViewBindings` interfaces | 6 `*Props` interfaces (falling-sand, reordering-lists) |
| Accessors | 214 `get*` members, 27 `is*` members | bare: `grainCount`, `isFlipping` |
| Handlers | 19 `on*` members | `on*`, the same |
| Values read once | a getter read at construction, or a separate options type | a plain value: `cols: number`, `label: string` |
| Body | Pixi objects built by hand, a hand-written `refresh` | JSX tags; getter attributes compiled into a refresh method |
| Returns | `Container` | `Container` |

There is also a third style, a mix of the two:
[perfmon-view.tsx](../../src/common/perfmon-view.tsx) has a JSX body but a
classic outside (`createPerfmonView`, `PerfmonViewBindings`, `getFrameStats`),
and [card-row-view.tsx](../../src/demos/reordering-lists/card-row-view.tsx)
is a `createCardRowView` top-level view with a JSX body and an internal
`CardView` component.

Where the two styles meet, the join is written by hand. The falling-sand
toolbar embeds the perfmon like this:

```tsx
<container x={TOOLBAR_WIDTH - PERFMON_WIDTH}>
    {createPerfmonView({ getFrameStats: () => props.frameStats() })}
</container>
```

The JSX runtime has not "graduated": the Building with MVT pages on views and
bindings teach only the classic style, JSX appears in the docs only in the
performance pages and two glossary entries, and 017 parks folding the
`<List>` guide into the docs until it does.

---

## 4. Two questions, not one

The two styles differ along several axes, and they fall into two groups:

| Axis | Classic | JSX | Seen by callers? |
| --- | --- | --- | --- |
| Function name | `createFooView` | `FooView` | yes |
| Word for the input | bindings | props | yes |
| Accessor names | `getRow` | `row` | yes |
| Values read once | getter | plain value | yes |
| How the body is written | Pixi calls | JSX tags | **no** |
| What it returns, how it refreshes | `Container`, `onRefresh` | `Container`, `onRefresh` | yes, and already the same |

Callers see a function's name and parameter type, and the container it
returns. They never see its body. A JSX function component is nothing more
than a function taking one object and returning a `Container`, so **any
view, however its body is written, is a JSX component if its outside has the
JSX shape.** The boids view, which builds a pool of `Graphics` by hand and
turns them with `skew` to avoid an allocation, would be a valid JSX tag
today if it were named `BoidsView`.

So "should everything be JSX?" is two questions:

1. **Should every view have the same outside?** This is where consistency
   pays: every caller, every doc page and every agent skill deals with it.
2. **Should every view's body be written the same way?** This is a matter of
   fit, view by view, and it costs callers nothing if views differ.

007 treats these as one question, which is why it concludes that two
conventions need a bridge between them.

---

## 5. Is one convention worth it?

Two conventions cost something every time a view is written, read, reviewed
or documented:

- **Docs and skills teach both.** The views, bindings, composition, testing
  and presentation-state pages, the `mvt-view` skill, `AGENTS.md` and the
  style guide would each need both forms, or would silently describe only
  one.
- **Every new view starts with a choice**, and every reviewer has to check
  the right rules were applied to the choice made.
- **Every crossing needs glue**: either 007's adapters, or hand-written
  wrappers like the perfmon one in section 3.

The case for two conventions in 007 rests on not having to migrate the 52
bindings interfaces. That is a strong argument where one side is code you
cannot change: a published library, another team's code, a legacy module.
None of that applies here. Every view is in this repo, nothing outside
consumes them, and the renames are mechanical. The one future exception is
011's split into published packages, taken in section 11.

Two conventions give nothing that one convention with a free choice of body
(section 4) does not also give. **One convention is worth it.**

---

## 6. The options

### Option A: keep both, bridge them (007)

Classic views stay classic, JSX views stay JSX, and
`componentFromView`/`viewFromComponent` rename keys where one is used in the
other.

**For.** No migration. Each style keeps its own idiom. The bridge is small,
typed, allocation-free per accessor, and 007 has proved it round-trips.

**Against.** It builds machinery to connect two things that could simply be
one. Everything in section 5 stays: both forms taught, a choice per view,
reviewers applying two rule sets. The bridge is one more concept to learn
(`PropsFromBindings<B>` and friends). Runtime key renames also make code
harder to follow: a search for `getRow` finds the interface but not the
`row={...}` attribute that supplies it.

### Option B: classic everywhere

Every view is `createFooView(bindings)` with `get*`/`on*` members. JSX is
allowed inside a body, as in the perfmon, but views are always called as
expressions: `{createGhostView({ ... })}`.

**For.** Matches every current doc page, skill, playground preset and 52 of
the interfaces. No doc rewrite. The architecture's examples need no change.
JSX stays an optional detail inside a few files.

**Against.** It gives up what JSX is best at, composing views: a view can
never be a tag. Inside JSX bodies the naming is mixed, since intrinsic
elements use Pixi's names (`x`, `alpha`) and bindings use `getX`, so
forwarding a binding means renaming it: `x={bindings.getX}`. Values read once
stay getters, which look live but are not (section 9.3). The
falling-sand and reordering-lists demos, the most recent code in the repo,
would be converted backwards.

### Option C: the JSX shape outside, either body inside (recommended)

Every view is `FooView(bindings: FooViewBindings): Container`. Query bindings
are named for what they return (`row`, `isAlive`), relay bindings are `on*` as
now, and a query binding the view reads once takes a plain value. Each
view's body is written in JSX or plain TypeScript, whichever suits it, with
the same outside either way; neither is required (section 10).
*Revised 2026-09-27:* the first draft made JSX the default body. It is a
choice, not a default.

```tsx
export interface GhostViewBindings {
    row: () => number;
    col: () => number;
    color: () => number;
    tileSize: () => number;
}

export function GhostView(bindings: GhostViewBindings): Container {
    const { body, eyes } = textures.get().ghost;
    return (
        <container
            x={() => (bindings.col() + 0.5) * bindings.tileSize()}
            y={() => (bindings.row() + 0.5) * bindings.tileSize()}
            scale={() => bindings.tileSize() / 20}
        >
            <sprite texture={body} anchor={0.5} tint={bindings.color} />
            <sprite texture={eyes} anchor={0.5} />
        </container>
    );
}

// Used as a tag in a JSX body...
<GhostView row={() => ghost().row} col={() => ghost().col} color={() => GHOST_COLORS[i]} tileSize={() => TILE_SIZE} />

// ...or called from imperative code, with no adapter.
view.addChild(GhostView({ row: () => g.row, col: () => g.col, color: () => g.color, tileSize: () => TILE_SIZE }));
```

**For.** Every view can be used from JSX and from plain TypeScript, so no
bridge is needed. Binding names match Pixi's, so a binding can be passed
straight to an intrinsic attribute (`tint={bindings.color}`, and `CardView`'s
`x={props.x}` today). A binding's type says whether it is read every frame
or once. Boolean accessors do not change at all. Views that do not suit JSX
keep their imperative bodies. The recent code already follows it.

**Against.** The largest migration of the four: 59 view files, 52 interfaces,
about 214 `get*` members and every call site. A substantial docs rewrite:
the views and bindings pages, skills, `AGENTS.md`, style guide, glossary and
playground presets. The JSX runtime has to graduate, including JSX support
in the playground's Sucrase sandbox. The `get` prefix is lost as a visual
cue (section 9). View functions are named like types, unlike
`createXxxModel`.

### Option D: JSX syntax everywhere

Option C, with the rule that every body is JSX.

**For.** The most uniform. One way to build any part of the scene.

**Against.** Some views do not fit tags, and forcing them produces JSX in
name only: a tag whose `ref` callback does all the work. Section 10 lists
them. It also buys nothing over C, since callers cannot tell the difference.
In practice D becomes C with a rule that will be broken.

---

## 7. Naming the view: `createFooView` or `FooView`

In JSX, a lowercase tag is an intrinsic element and a capitalised tag is a
component, so `<createGhostView>` is not possible. `FooView` works in both
places: `<FooView ... />` and `FooView({ ... })`.

**Against `FooView`:**

- The style guide reserves PascalCase for types. Views would be the only
  functions named that way.
- Views would no longer match models: `createScoreModel` but `ScoreView`.
- A view function can share a name with a type. There is one such case,
  `CabinetView`, an interface extending `Container` with a `requestExit()`
  method. TypeScript allows a function and an interface with the same name,
  but it is confusing (open question 5).

**Response.** The difference from models is real, and the names can say so:
a model factory returns an object that the ticker updates, while a view
function returns a node in the scene. PascalCase for components is universal
in JSX code, so a reader who knows JSX expects it, and one who does not
learns one rule. The style guide gains one row: "View functions: PascalCase
noun ending in `View`."

**Ruled out:** keeping `createFooView` and adding an alias
(`const GhostView = createGhostView`). Two names for one function, and
the docs would have to explain which to use where.

---

## 8. Naming the input: bindings or props

**Where "props" comes from.** The JSX syntax does not say "props": its
specification, and TypeScript's syntax tree, call `x={...}` an *attribute*.
"Props" is React's word, adopted by the libraries that followed it (Preact,
Solid, Vue, Svelte). TypeScript only needs a function component's first
parameter to have a type; what the parameter and its type are called is up
to us. So using "bindings" in JSX files has no technical cost.

**Why "props" fits this repo badly.**

- It reuses the word "property" for something else. In this repo the clash
  is concrete: an attribute on an intrinsic element sets a Pixi property
  (`x={...}` sets `container.x`), and the glossary already defines "dynamic
  property" and "static property" as properties of the view's output. "A
  prop that sets a property" is muddled.
- The JSX runtime already calls getter attributes bindings. Its header says
  "function-valued props become dynamic bindings", and its internal type is
  `DynamicBinding`.
- "Bindings" is the architecture's term, is not tied to a language, and
  already names 52 interfaces.

**The cost.** Developers coming from React, Solid or Vue will expect
`props`, and will meet an unfamiliar word. One sentence in the docs covers
it: "In JSX, a view's bindings are written as attributes; React calls the
same object props."

**Ruled out:** "props" in JSX files and "bindings" elsewhere. Two words for
one object is the problem this proposal is trying to remove.

**Recommendation.** `FooViewBindings`, with the parameter named `bindings`,
in every view. When the docs need a word for the `name={value}` syntax, use
the JSX term, *attribute*. The runtime's internal `ContainerProps`,
`SpriteProps` and so on can become `...Attributes` when it graduates; that
rename is internal and optional.

---

## 9. Naming accessors: with or without `get`

### 9.1 The options

| | Accessor names | In a JSX tag | Notes |
| --- | --- | --- | --- |
| (a) Keep `get` everywhere | `getRow` | `<GhostView getRow={...} />` beside `<container x={...}>` | Two naming rules in one tag; forwarding needs a rename, `x={bindings.getX}`. 007 section 4.1 rules this out for the same reason |
| (b) Drop `get` everywhere | `row` | `<GhostView row={...} />` | One naming rule; bindings forward to intrinsics unchanged |
| (c) Per style | `getRow` in classic, `row` in JSX | either | Option A: needs the bridge |

(c) belongs to option A. The real choice is between (a) and (b).

### 9.2 What dropping `get` costs

- **The prefix is a visible cue.** `getRow` says "call me for a value" in the
  name. Without it, the cue is in two other places that are always present:
  the type (`row: () => number`), and the parentheses where it is used
  (`bindings.row()`). If code forgets either, TypeScript reports it: passing
  a value where a getter is expected, or using a getter as a value.
- **The prefix is already not universal.** The style guide requires
  `is`/`has`/`can` for booleans, so 27 accessors (`isAlive`, `isActive`,
  `isDotAt`) already have no `get`, alongside 214 that do. The rule today is
  really "prefix with `get` unless it is a boolean". Dropping `get` makes it
  "name it for what it returns", which is the boolean rule applied to every
  accessor.
- **Accessors with parameters read a little worse bare.** There are five:
  `getTileKind(row, col)` (twice), `getSectionIndex(col)`,
  `getGameName(index)` and `getGameThumbnail(index)`. `tileKind(row, col)`
  is fine; `tileKindAt(row, col)` is better, and matches the existing
  `isDotAt(row, col)`. Suggested rule: an accessor taking a position or index
  ends in `At`.
- **Searching for accessors by prefix stops working**, since `get[A-Z]` no
  longer finds them. Searching for the interface still does.
- **The architecture docs' table changes**, from a table of prefixes to a
  table of roles (section 12). It stays three rows long.

`bindings.row()` is slightly less self-explanatory than `bindings.getRow()`
to someone reading one line with no context. That is the whole cost, and it
is small against one naming rule for every tag.

### 9.3 Query bindings with fixed answers

*Revised 2026-09-27.* The first draft treated values a view reads once as a
third kind of member, "settings". They are not: they are query bindings whose
answer does not change. The architecture docs now describe this in
[Changing and Fixed Answers](../../docs/architecture/bindings.md#changing-and-fixed-answers):
a query binding is answered with a function the view calls every frame, or
with a fixed value it reads once, and the bindings type declares which it
accepts:

| Declared as | Callers | The view |
| --- | --- | --- |
| `() => T` | Can supply anything; a fixed value must be wrapped, `() => 42`, which hides that it is fixed | Must support change, even for something structural such as a grid size |
| `T` | Can supply only a fixed value | The simplest: read once at construction |
| `ValueOrGetter<T>` | Supply whichever suits, and the wiring shows what is fixed | Handles both: wraps values in getters at construction (simple), or keeps the distinction to skip per-frame work (as the JSX runtime's codegen does) |

Widening `T` or `() => T` to `ValueOrGetter<T>` does not break callers, so a
view can start narrow and widen later. TypeScript makes `ValueOrGetter<T>`
practical; the architecture page notes that most statically typed languages
do not, and that it is ambiguous when `T` is itself a function type.

**The views that read getters once are bugs, not a style.** Rule
[V-reactive](../../docs/architecture/rules.md#view-rules) already forbids it:

- [overlay-view.ts](../../src/common/overlay-view.ts) reads `getWidth()` and
  `getHeight()` once, to lay itself out.
- [terrain-view.ts](../../src/games/scramble/views/terrain-view.ts) reads
  `getTileSize()`, `getVisibleCols()` and `getVisibleRows()` once, to size
  its ring buffer.
- Scramble's base target view and HUD read `getTileSize()` and
  `getScreenWidth()` once.

A sweep on 2026-09-27 found these, plus some lesser cases; the full list,
and the views checked and found live, is in
[017](../tasks/backlog/017-misc-loose-ends.md)'s Fix list.

Each declares a query binding that may change and silently stops following
it. The fix is to declare what the view supports: `T` if it only handles a
fixed value, or a getter that it genuinely follows. Separately,
[boids-view.ts](../../src/demos/boids/boids-view.ts) has a
`BoidsViewOptions` type mixing the model, fixed values and getters, which
becomes an ordinary bindings type.

For this repo:

- **Model state:** `() => T`. It changes, so the query binding must be a
  function.
- **What the view is built around** (a size that shapes its structure, a
  button's label): `T`, unless supporting change is cheap. It can widen
  later without breaking callers.
- **Views reused with both kinds of answer**, such as the shared views in
  `common/`: `ValueOrGetter<T>`, where the convenience at many call sites
  repays the extra work in one view. Intrinsic elements already accept both.

### 9.4 Recommendation

(b): drop `get`. Query bindings are named for what they return, booleans keep
`is`/`has`/`can`, query bindings taking a position or index end in `At`, relay
bindings keep `on`, and each query binding's type declares whether it accepts
a fixed value, a function, or either (section 9.3). Write every member as a
function-valued property (`row: () => number`), which is 017's method-syntax
item; doing both in the same pass touches each interface once.

---

## 10. Is JSX everywhere viable?

As a default, yes. Most views in the repo are a fixed tree of containers
whose properties follow the model: the game leaf views (ghost, bullet, ship,
enemy, rock), the HUDs, the overlays. These convert directly. Game views that
destroy and rebuild children when a count changes (galaga's `buildEnemies`,
`buildPlayerBullets`, `buildEnemyBullets`) get simpler with `<List>`.

As a rule, no. Some views' work is drawing, or managing a pool of display
objects themselves, and tags add nothing:

- [boids-view.ts](../../src/demos/boids/boids-view.ts): a grown pool of
  `Graphics` over a shared `GraphicsContext`, turned with `skew` because
  `rotation` allocated (017). Several thousand boids.
- [terrain-view.ts](../../src/games/scramble/views/terrain-view.ts): a ring
  buffer of column `Graphics`, redrawn as they scroll into view.
- [match-effects-view.ts](../../src/games/cactii/views/board-view/match-effects-view.ts):
  pools of particles driven by a `Sequence`.
- [slider-view.ts](../../src/demos/boids/slider-view.ts): redraws several
  `Graphics` and `Text` together, gated on any of seven inputs changing.

The repo already has three escape hatches, from smallest to largest, all in
use:

1. **`ref` to draw once.** `<graphics ref={(g) => drawGlass(g, width, height)} />`
   in the tank view.
2. **`ref` plus a hand-written `onRefresh`**, for a per-frame step the
   attributes cannot express: the tank's brush ring, the card face redrawn on
   a color change, the perfmon sparklines. The runtime's own `onRefresh` has
   to be kept and called by hand (`const ownRefresh = g.onRefresh`), which is
   easy to get wrong (open question 2).
3. **An imperative body.** The function builds its containers and sets
   `view.onRefresh` as classic views do now. Under option C, its outside is
   the same as any other view's, so callers cannot tell.

The JSX runtime's cost is not a reason to avoid it for ordinary views. Its
refresh costs 1.2-1.7x as much as hand-written refresh methods, about 1 ns
more per dynamic property, and a static attribute costs nothing per frame
([Performance Measurements](../../docs/building-with-mvt/performance/measurements.md)).
It matters at tens of thousands of containers, which is where escape hatch 3
applies anyway.

**Guidance, not a rule** (*revised 2026-09-27*; the first draft made JSX the
default): JSX tends to suit a view that is mostly a tree of containers whose
properties follow the model. Plain TypeScript tends to suit a view whose work
is mostly drawing, or managing its own display objects each frame, or one
that needs tight control of per-frame work. Neither is required, and a view
can use whichever its author finds clearer. The convention docs present both
bodies side by side
([Style Guide: Writing the Body](../../docs/reference/style-guide.md#writing-the-body)).

---

## 11. What happens to 007

007's bridge exists because the two styles' outsides differ in accessor
names. Under option C, they do not, so there is nothing to bridge.

007 section 4 argues against a single convention on two grounds:

- **4.1, `get` names in JSX mix two naming rules in one tag.** Agreed. It is
  an argument against option (a) in section 9, not against a single
  convention, and option C avoids it.
- **4.2, dropping `get` everywhere costs too much.** Its reasons: migrating
  50 interfaces, losing the prefix as a cue, and that the runtime treats
  `on*` attributes other than `onPointer*` as getters on intrinsic elements.
  The migration is mechanical, and nothing outside the repo depends on the
  names (section 5). The cue is weighed in section 9.2. The `on*` point is
  about intrinsic elements, whose attributes are typed, so TypeScript
  already rejects an unknown `onFoo`; it does not depend on how view
  bindings are named.

The one place a bridge might return is 011's published packages: an outside
user with their own naming convention could want an adapter. That is a
decision for when the packages exist, and 007 would be the starting point.

**Recommendation.** Archive 007 as superseded by this proposal, noting that
its type-level work is kept for the case above. Its `MaybeGetter` to
`ValueOrGetter` rename (007 section 8) does not depend on the rest and should
go ahead with the runtime's graduation.

---

## 12. The docs: architecture versus this repo

**Architecture docs.** They should not mention JSX, components or props, and
under this proposal they do not need to. *Done 2026-09-27:* the bindings
page now describes a bindings object by the roles of its members, *query
bindings* (read state, model to view) and *relay bindings* (report user
input out of the view, view to model), rather than by `get*`/`on*` prefixes. Its pseudocode names
query bindings for what
they return (`x: () -> number`) and says naming is a convention of each
language and codebase. A new section, "Changing and Fixed Answers", covers
query bindings answered with fixed values (section 9.3), which fills a gap: a
reusable view's fixed parameters, such as a button's label, were neither
state nor application constants, the two cases the docs covered. Rules
V-reactive, V-readonly, B-contract and B-optional, the ticker, overview and
views pages, and the glossary (new *Query binding* and *Relay binding*
entries) were updated to match.

**Building with MVT docs.** These show what the repo does, JSX included. The
views and bindings pages show the same view with a JSX body and with a plain
TypeScript body, side by side, with the guidance from section 10. One
short passage maps terms for readers who know JSX from elsewhere: a view is
a component, and its bindings are what React calls props, written as
attributes. The glossary gains *attribute* and loses nothing.

---

## 13. Recommendation

Adopt **option C**:

1. Every view is a function `FooView(bindings: FooViewBindings): Container`
   (sections 6, 7).
2. The input is called bindings everywhere, JSX files included (section 8).
3. Query bindings are named for what they return, with `is`/`has`/`can` for
   booleans and `At` for query bindings taking a position or index; relay
   bindings are `on*`; each query binding's type declares whether it accepts a
   fixed value, a function, or either (section 9).
4. Bodies are JSX or plain TypeScript, whichever suits the view; neither is
   required (section 10).
5. 007 is archived as superseded (section 11).
6. The architecture docs describe binding members as query and relay
   bindings and never mention JSX (done); the Building with MVT docs teach
   the repo's convention and map its terms (section 12).

The grounds, in short: callers never see a view's body, so one outside shape
gives all the consistency that matters while leaving each body free to be
written the way that suits it (section 4). Of the possible outside shapes,
only the JSX one works both as a tag and as a call (section 7). Dropping
`get` extends a rule the repo already follows for booleans and lets bindings
pass straight to intrinsic attributes (section 9). Keeping the word bindings
avoids a React term that clashes with "property", and matches both the
architecture and the JSX runtime (section 8). The bridge in 007 answers a
constraint, code that cannot be changed, which this repo does not have
(sections 5, 11).

---

## 14. Cost of the change

| Area | Scope | Mechanical? |
| --- | --- | --- |
| Rename view functions | 59 classic view files, their barrels and call sites | Yes: TypeScript rename |
| Rename accessors | About 214 `get*` members in 52 interfaces, and their call sites | Mostly: a codemod stripping `get` and lowercasing, as in 007 section 5.2 applied to source; the five accessors with parameters by hand |
| Fixed answers | Getters read once (listed in 017's Fix list, unless fixed there first), and `BoidsViewOptions` | No: each needs a decision between `T`, `() => T` and `ValueOrGetter<T>` (section 9.3) |
| Method syntax to property syntax | 017's item: 537 places, most in these interfaces | Yes: ESLint auto-fix |
| JSX bodies | Optional, per view | No |
| JSX runtime graduation | `ValueOrGetter` rename; playground support (Sucrase `jsx` transform, runtime available in the sandbox); `<List>` guide into `docs/` (017's parked item) | Partly |
| Docs | Architecture bindings page; Building with MVT views, bindings, bindings in depth, composition, presentation state, testing views; style guide; glossary; `AGENTS.md`; `mvt-view` and `code-style` skills; playground presets | No |

Behaviour should not change at any step until bodies are converted, and the
per-game benchmarks (`npm run bench`) can confirm it after each step that
converts one.

---

## 15. Open questions

All settled 2026-09-27. Do not reopen without new information.

1. ~~**Top-level views' input.**~~ Settled: the object form,
   `GameView({ model })`, so every view has one signature. Today top-level
   views take the model directly (`createGameView(game)`) or an object
   holding it (`DemoView({ model, frameStats })`); a top-level view is never
   used as a tag, so either would work, but one form is simpler to teach.
2. ~~**An `onRefresh` attribute on intrinsic elements.**~~ Settled: yes. It
   runs after the generated refresh and replaces escape hatch 2's manual
   keep-and-call pattern, which already appears three times (the tank's
   brush ring, the card face, the perfmon sparklines). `onUpdate` is already
   an attribute. Built as part of the runtime's graduation (section 16, step
   3).
3. ~~**What to call the member roles in the docs.**~~ Settled 2026-09-27:
   *query bindings* and *relay bindings*, chosen from 22 candidate pairs.
   Values read once are query bindings with fixed answers, not a third role.
   Do not reopen without new information.
4. ~~**A lint rule.**~~ Settled: yes, against `get[A-Z]` members in
   `*ViewBindings` interfaces and exported `create*View` functions. It
   applies to each module as that module is migrated, so it holds the
   convention without failing on code not yet migrated.
5. ~~**`CabinetView`.**~~ Settled: the view stops exposing a method.
   `CabinetView` is the only view whose return type adds one,
   `requestExit()`, which `main.ts` calls when the pause menu's Exit is
   chosen, to start the zoom back out to the menu. That is code outside the
   view commanding it, the one call into a view in the repo. Instead, the
   request to exit becomes cabinet model state that the view reads through a
   query binding, and the end of the zoom is reported through a relay
   binding. The `CabinetView` interface then goes, and the view is
   `CabinetView(bindings): Container` like any other. Done when the cabinet
   is migrated.
   *Done 2026-09-27, more simply than planned* (section 19): exiting was
   already model state. The view's `onExitPressed` relay binding was not
   user input at all, only an echo of `main.ts` telling the view to exit.
   Now `main.ts` exits the cabinet model directly, and the view starts its
   zoom out when it sees the phase change from `'playing'` to `'menu'`.
   Nothing waits on the end of the zoom, so no relay binding was needed for
   it.

---

## 16. Implementation steps

1. ~~Decide this proposal. If accepted, archive 007 as superseded and
   update the index.~~ Done 2026-09-27.
2. ~~Update the style guide, `AGENTS.md`, glossary and the `mvt-view` and
   `code-style` skills with the convention, so new code follows it from the
   start.~~ Done 2026-09-27.
3. Graduate the JSX runtime: ~~the `ValueOrGetter` rename~~ (done
   2026-09-27), ~~the `onRefresh` attribute (open question 2)~~ (done
   2026-09-27, section 18), playground JSX support, and the `<List>` guide
   into `docs/`.
4. Migrate outsides, one module at a time: function names, query binding
   names, fixed answers, and property syntax. Type-check and run the
   benchmarks after each. ~~Scramble, as the pilot.~~ Done 2026-09-27; see
   section 17. ~~`common/`.~~ Done 2026-09-27; see section 18. ~~Each demo,
   the cabinet (with open question 5), and the other games.~~ Done
   2026-09-27; see section 19.
5. Where a view's body would read better in JSX (section 10's guidance),
   convert it, starting with the game views that rebuild children on a count
   change. Optional, view by view; a plain TypeScript body is never wrong.
6. ~~Rewrite the architecture bindings page by member role.~~ Done
   2026-09-27 (section 12). Rewrite the Building with MVT views and bindings
   pages for the new convention.
7. ~~Add the lint rule (open question 4), extending it to each module as it
   is migrated.~~ Done 2026-09-27: it covers all of `src/` except the
   playground (section 19).

---

## 17. The Scramble pilot

*Done 2026-09-27.* Scramble's 14 views were moved to the convention, to test
it on real code before the other modules.

### 17.1 What changed

| Before | After |
| --- | --- |
| 14 `createXxxView` factories in `.ts` files | 14 `XxxView` functions: 13 with JSX bodies (`.tsx`), `TerrainView` imperative (`.ts`) |
| `createGameView(game)` | `GameView({ model })` |
| `getScreenX`, `getPhase`, `isSolid(col, row)`, ... | `screenX`, `phase`, `isSolidAt(col, row)`, ... |
| Six queries declared as functions but read once | Six fixed answers: `tileSize: number`, `screenWidth: number`, ... |
| Six hand-built pools of views, each view with an `isPresent` binding | Six `<List>`s over the model's `SlotList`s; empty slots hide themselves, so the presence bindings are gone |
| 70 method-syntax members in the module | None; `method-signature-style` enforced |

The lint rule (open question 4) is in `eslint.config.js`, applied to the
files listed in `VIEW_CONVENTION_FILES`, which so far is Scramble.

Measured with `npm run bench -- games-and-demos entry=scramble`, median of 3
runs each:

| | Before | After |
| --- | --- | --- |
| Model and view updates | 2.23 µs | 2.23 µs |
| `refreshScene` | 8.95 µs | 4.45 µs |
| Total per frame | 11.2 µs | 6.68 µs |
| Pixi containers | 135 | 84 |
| `onUpdate` and `onRefresh` methods | 46 | 40 |
| Bytes allocated per frame | 2,730 | 273 |
| Collections per simulated minute | 3 | 0 |

The saved results in `benchmarks/results/` still show the old figures, since
`--save` needs a run of the whole suite.

### 17.2 What the pilot showed

1. **The JSX-or-plain-TypeScript guidance held, with one refinement.** The
   pilot chose JSX wherever it fitted, to try it out; only the terrain
   needed a plain TypeScript body. Two views that redrew graphics every frame, the
   explosion and the HUD's fuel bar, turned out not to need it: the explosion
   is drawn once at full size and then scaled and faded, and the fuel bar is a
   white sprite resized and tinted. That is likely where most of the 2.4 KB
   per frame went (not measured separately). Refinement for section 10's
   guidance, whichever body a view has: before writing a redraw, check whether drawing once and then
   scaling, tinting or resizing would do.
2. **Fixed answers made hidden bugs visible.** Declaring each query binding's
   type forced a decision for every value, which found three read-once views
   that a `grep` sweep had missed (base alert, death flash, section
   announcement). See 017.
3. **`<List>` removed a binding from every pooled view.** The old pools gave
   each view an `isPresent` query binding; a `<List>` over a `SlotList` hides
   empty slots itself.
4. **Leaf views got smaller.** A sprite view is now one `<sprite>` rather than
   a container holding a sprite, which is most of the drop in containers.
5. **Text that follows a number needs a small change-gated getter.** The HUD
   has two (score, and section and loop), and the falling-sand toolbar has
   its own `mapOnChange`. A shared helper would save each view writing one;
   008's `Watch()` builder, with memoised derivation, may be the place for it.
6. **Embedding a view not yet migrated works as an expression.** The game view
   calls `createOverlayView({ ... })` from `common/` inside its JSX. That glue
   goes when `common/` is migrated.
7. **A rename codemod was not needed here**, because every body was rewritten
   anyway. It will matter for modules where only the outside changes. ESLint's
   auto-fix handled the 21 method-syntax members in the models.

### 17.3 Checked in the browser

*2026-09-27:* checked by eye and by playtesting; everything looks and plays
as before. That covers the places a difference could have shown: explosions
(now scaled rather than redrawn), the fuel bar (now a resized, tinted
sprite), the lives icons (now a `<List>`), and the play area's mask. Headless
Chrome on the machine used drew the Pixi canvas blank, the cabinet menu
included, so the check was by hand; automating it would need a browser
driver such as Playwright.

---

## 18. Migrating `common/`

*Done 2026-09-27.* The second module, and the first whose views are used
everywhere: every game uses the overlay, `main.ts` the keyboard, touch and
pause menu views, and two demos the perfmon.

### 18.1 What changed

| View | Body | Notes |
| --- | --- | --- |
| `OverlayView` | JSX (was plain TypeScript) | `width` and `height` became fixed answers, fixing its V-reactive bug (017); `getVisible` became `isVisible` |
| `PerfmonView` | JSX (already) | Its sparklines use the new `onRefresh` attribute instead of a `ref` |
| `PauseMenuView` | Plain TypeScript | Lays out its buttons by hand each frame, at the canvas's scale |
| `TouchInputView` | Plain TypeScript | Rebuilds its controls when their configuration changes, and lays them out by hand. `getShowDpad` became `hasDpad`, `getFloatingJoystick` became `isJoystickFloating`, and so on |
| `KeyboardInputView` | Plain TypeScript | No display; relay bindings only |

Alongside:

- **The `onRefresh` attribute** (open question 2) is in the JSX runtime,
  with tests. One design change from section 10: the step **receives the
  element**, as `ref` does. Its main use, redrawing a `Graphics` when a value
  changes, needs the element, and without it a view would still need a `ref`
  just to capture it. A step that ignores the argument is still a plain
  refresh method.
- **`memoiseLast`** (pilot finding 5), in `common/` with tests: a one-argument
  function wrapped so it runs only when its argument changes. It replaces the
  falling-sand toolbar's `mapOnChange`, and the toolbar and Scramble's HUD
  use it. *Revised 2026-09-27:* this first landed as `mapOnChange(read, map)`,
  which bundled the read with the mapping; `memoiseLast(fn)` is simpler and
  more general, and leaves the read at the call site. It was briefly named
  `memoise`, renamed because that name usually means a cache of every
  argument seen, where this keeps only the last.
- **All 61 method-syntax members in `common/`** were converted by ESLint's
  auto-fix, including `SlotList<T>` and `OrderedSlotList<T>`. The variance
  errors 017 expected did not appear: no code assigns a `SlotList` of a
  subtype to one of its base type.
- **Callers outside `common/`** were updated: the seven game views, the two
  demos, and `main.ts`. A module not yet migrated calls a migrated view
  directly, `OverlayView({ width, ... })`, so no glue is needed in that
  direction. Scramble's game view now uses `<OverlayView ... />` as a tag.
- The lint rule now covers `common/` as well as Scramble.

Measured with `npm run bench -- games-and-demos`, every game and demo was
the same before and after, within the runs' noise. Each game has one more
refresh method, from the overlay's text element.

### 18.2 What the migration showed

1. **The guidance on bodies held.** Three of the five views kept plain
   TypeScript bodies, and nothing about the convention pushed against that.
   Their outsides changed; their insides did not need to.
2. **Boolean query bindings needed the most thought.** `getShowDpad` is not
   `showDpad` under the `is`/`has`/`can` rule; `hasDpad` reads better. Worth
   a moment per boolean in the remaining modules.
3. **Found while migrating:** the overlay holds a restart press for two
   animation frames (`requestAnimationFrame`, twice) before relaying its
   release, which is wall-clock timing in a view. Kept as it was; recorded in
   017.

### 18.3 Checked in the browser

*2026-09-27:* checked by eye and by playtesting; everything looks and behaves
as before: the game-over overlay (and tapping it to restart), the pause menu,
the perfmon's sparklines in boids and falling sand, and the touch controls.

---

## 19. Migrating the rest

*Done 2026-09-27.* The three demos, the cabinet, and the six other games.

### 19.1 What changed

- **Outsides only.** Every view kept its body, JSX or plain TypeScript, as it
  was; section 16's step 5 (JSX bodies where they would read better) stays
  optional. The one body change: the reordering-lists card face and the
  falling-sand brush ring now redraw through the `onRefresh` attribute
  instead of a `ref` that kept and called the runtime's own refresh.
- **The games were renamed by script**, then checked by the type-checker:
  `get*` query bindings to bare names (`getTileKind(row, col)` to
  `tileKindAt`), `createXxxView` to `XxxView`, and each top-level view to
  `GameView({ model })`. Its one miss was Kwazy Cactii's pieces view model,
  whose options share key names with the view bindings; its reads were
  renamed to match. The falling-sand views, already function components,
  went from `props` to `bindings`.
- **Fixed answers.** Kwazy Cactii's `matchSequence`, read once by five views,
  is now a fixed answer (the pieces view model keeps a function, since it
  re-reads it). The asteroid view, which re-read its radius and size only
  when its shape seed changed, now watches all three. 017's list of
  read-once views is now empty.
- **The cabinet** (open question 5): `requestExit()` and the `CabinetView`
  interface are gone, and so is the view's `onExitPressed` relay binding. See
  question 5.
- **Method syntax** is gone from the whole repo, `benchmarks/` and the
  playground included, and `method-signature-style` now applies to every
  TypeScript file. 017's item is done.
- **The lint rule** covers all of `src/` except the playground, which builds
  DOM and CodeMirror views and whose presets follow the sandbox's own
  `createView(model)` contract. ESLint now also ignores `.claude/`, whose
  agent worktrees are separate checkouts.
- **Docs:** the notes about code not yet migrated are gone from the style
  guide, `AGENTS.md`, `llms.txt`, the glossary and the skills. The style
  guide keeps one note: the Building with MVT pages still show the older
  convention until they are rewritten.

Every game and demo benchmarked the same before and after, within the runs'
noise.

### 19.2 What the migration showed

1. **Once the convention was settled, the rest was mechanical.** Six games,
   37 views, took one script and one manual fix. The type-checker is
   what made that safe: a renamed binding that a call site missed does not
   compile.
2. **View models have their own options, and nothing names them.** The
   convention and its lint rule cover views' bindings. View models' options
   are query bindings in all but name, but only Kwazy Cactii's were renamed,
   because they shared keys with a view's; the reordering-lists view models
   still take `getCount` and `getId(index)`, and `common/`'s helpers (e.g.
   `createEdgeTween`'s `getSource`) keep `get`. Open question 6.
3. **Found:** the cabinet view's zoom transitions are GSAP timelines that
   play by themselves, on wall-clock time, in a view. Recorded in 017.

### 19.3 Open question 6

~~**Should view models' options, and `common/`'s helpers' options, follow the
query binding naming too?**~~ *Settled 2026-09-27:* view models yes, helper
options no, as suggested below. The one view model still taking `get*`
options, reordering-lists' array row, now takes `count` and `idAt(index)`;
the style guide says so, and the lint rule covers `XxxViewModelOptions`
interfaces too. Do not reopen without new information. For: one naming rule everywhere, and view models
are views' internals, so their inputs are the same kind of thing. Against:
helper options are an ordinary function's parameters, not a view's
contract, and `get` there reads naturally (`getSource`). Suggest: view
models yes (they are fed straight from a view's bindings), helper options
no.

### 19.4 Checked in the browser

*2026-09-27:* playtested, and everything works as before, including
exiting a game to the cabinet from the pause menu (whose zoom out is now
started by the phase change rather than a call), the boids sliders and
checkbox, the reordering-lists card faces and the falling-sand brush ring.
