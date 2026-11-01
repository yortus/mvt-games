# MVT on One Page

> This page gathers MVT's core rules in one place, so that you can check a
> design against them. A game has three parts: models that decide what
> happens, views that show it, and a ticker that keeps time. Each tick
> moves the models on, then the views, then draws. The rules hold in any
> language and with any renderer, and each one names the principles it
> serves and the chapter that teaches it. The book also teaches practices
> that aren't rules, and the last section lists them.

**Related:** [Why MVT](../chapters/02-why-mvt.md) ·
[The Tick](../chapters/05-the-tick.md) ·
[The Eight Principles](../chapters/25-the-eight-principles.md) ·
[Glossary](b-glossary.md) ·
[MVT Beyond the Web](h-mvt-beyond-the-web.md)

This page summarises the book. It doesn't teach anything that the
chapters don't, and each rule links to the chapter where you'll find it
explained, with examples. When a rule doesn't cover a case, the principle
pages in the **Serves** column explain the reasoning, so that you can
apply it to the new case.

## The Three Parts

| Part | Owns | Its inputs | Never does |
| --- | --- | --- | --- |
| **Model** | The game's domain state, and the rules that change it | `deltaMs` from the ticker, and the player's actions | References views or the ticker, or reads the clock |
| **View** | How the state is presented, and any presentation state of its own | The state, through its bindings | Keeps domain state, changes a model while it refreshes, or keeps its own clock |
| **Ticker** | Time: how much has passed, and when each part runs | A callback from the platform each frame | Holds game rules, or presents anything |

**Bindings** connect a view to the rest of the game. Query bindings carry
state into the view. Relay bindings carry the player's input out of it.
The view depends only on its bindings, never on where they lead.

## Two Kinds of State

| | Domain state | Presentation state |
| --- | --- | --- |
| Meaning | State that decides the game's outcomes | State that changes only how things are shown |
| Example | A ball's height and speed | How far a flash has faded |
| Owned by | A model | The view that shows it |
| Moves forward in | The model's `update(deltaMs)` | The view's `update(deltaMs)` |
| Without it | The game plays differently | Only the presentation changes |

Presentation state may follow domain state, but domain state never
depends on presentation state. If the game would play differently without
some piece of state, it's domain state, and it belongs in a model.
[Chapter 2](../chapters/02-why-mvt.md) introduces the two kinds, and
[Chapter 11](../chapters/11-presentation-state.md) shows how a view keeps
its own.

## The Tick

One tick, in pseudocode:

```text
each frame:
    deltaMs = min(time since the last frame, MAX_DELTA_MS)

    for each root model:
        model.update(deltaMs)       // children first, then what spans them

    for each view with presentation state:
        view.update(deltaMs)        // advances presentation state only

    for each view, parents first:
        view.refresh()              // reads settled state, writes output

    draw the frame
```

Every model has finished its update before any view reads it. A paused
game leaves out the two `update` steps, and still refreshes and draws, so
it shows frozen. Slow motion passes a smaller `deltaMs`. The models
don't need any code for either. [Chapter 5](../chapters/05-the-tick.md) follows
a tick through in detail.

## Model Rules

| Rule | What it says | Serves | Taught in |
| --- | --- | --- | --- |
| **M-time** | All state moves forward only through `update(deltaMs)`. A model doesn't read a clock or start a timer of its own. Time reaches it only as the ticker's `deltaMs`, so the same inputs always produce the same result. | [SoC](../chapters/26-separation-of-concerns.md), [DIP](../chapters/29-dependency-inversion.md), [DfT](../chapters/33-design-for-testability.md) | [Chapter 4](../chapters/04-models.md), [Chapter 6](../chapters/06-time-and-phases.md) |
| **M-isolation** | A model doesn't refer to any view, renderer or ticker. It can be built, run and tested without anything else around it. | [SoC](../chapters/26-separation-of-concerns.md), [DIP](../chapters/29-dependency-inversion.md), [DfT](../chapters/33-design-for-testability.md) | [Chapter 4](../chapters/04-models.md) |
| **M-domain** | A model's state is in the game's own terms, not the presentation's. Positions are in tiles, metres or world units, not pixels. States are named values, such as `'alive'` and `'exploding'`, not colour values or textures. | [SoC](../chapters/26-separation-of-concerns.md), [MISU](../chapters/32-make-illegal-states-unrepresentable.md) | [Chapter 4](../chapters/04-models.md) |
| **M-composition** | A parent model passes `update(deltaMs)` to its children. The parent handles the work that spans several children, such as collisions or a change of phase, after its children have updated. | [SSOT](../chapters/27-single-source-of-truth.md), [CRP](../chapters/30-composite-reuse.md) | [Chapter 4](../chapters/04-models.md) |

## View Rules

| Rule | What it says | Serves | Taught in |
| --- | --- | --- | --- |
| **V-stateless** | A view doesn't hold any domain state. It reads state and writes presentation output, and doesn't have any game logic of its own. Replacing a view never changes what happens in the game. | [SoC](../chapters/26-separation-of-concerns.md), [SSOT](../chapters/27-single-source-of-truth.md) | [Chapter 7](../chapters/07-views.md) |
| **V-refresh** | `refresh()` runs once a frame, after every model has updated, so views never see a half-updated world. | [CQS](../chapters/28-command-query-separation.md) | [Chapter 7](../chapters/07-views.md) |
| **V-idempotent** | Calling `refresh()` twice with the same state produces the same output. State doesn't build up from one frame to the next. | [CQS](../chapters/28-command-query-separation.md), [DfT](../chapters/33-design-for-testability.md) | [Chapter 7](../chapters/07-views.md) |
| **V-readonly** | `refresh()` never changes a model. A view reports the player's input through relay bindings, and doesn't act on it while it refreshes. | [CQS](../chapters/28-command-query-separation.md) | [Chapter 5](../chapters/05-the-tick.md), [Chapter 7](../chapters/07-views.md), [Chapter 8](../chapters/08-bindings.md) |
| **V-reactive** | A query binding given as a function, a getter, is read again in every `refresh()`, and never kept from when the view was built. A value the view reads only once is declared as a fixed value, so the bindings say so. A getter with arguments doesn't have a fixed form, so a view that calls one less often says so in the binding's documentation. | [SSOT](../chapters/27-single-source-of-truth.md), [DbC](../chapters/31-design-by-contract.md) | [Chapter 7](../chapters/07-views.md), [Chapter 8](../chapters/08-bindings.md) |
| **V-presentation** | A view may hold presentation state that the model doesn't track. Such a view gains an `update(deltaMs)` step, which moves its presentation state on and doesn't write any output. `refresh()` writes all of the output, including adding and removing elements. Presentation state is valid from the moment the view is built, since a view's first `refresh()` may come before its first `update()`. Complex presentation logic can move into a view model. Presentation state never affects what happens in the game. | [SSOT](../chapters/27-single-source-of-truth.md) | [Chapter 11](../chapters/11-presentation-state.md), [Chapter 18](../chapters/18-growing-a-complex-view.md) |
| **V-output** | A view can write to any kind of output: a canvas, the DOM, sound, a terminal or a test. MVT isn't tied to a renderer. | [SoC](../chapters/26-separation-of-concerns.md) | [Chapter 7](../chapters/07-views.md), [Chapter 20](../chapters/20-sound-and-music.md) |
| **V-tree** | The tree of views doesn't need to match the tree of models. How the game is shown and how it's built are separate concerns, and bindings connect the two. | [SoC](../chapters/26-separation-of-concerns.md), [CRP](../chapters/30-composite-reuse.md) | [Chapter 13](../chapters/13-composing-views.md) |

## Ticker Rules

| Rule | What it says | Serves | Taught in |
| --- | --- | --- | --- |
| **T-sequence** | Each frame runs in a fixed order: update the models, update the views' presentation state, refresh the views, draw. The order never changes, and steps are never interleaved, so models finish updating before views read them. A paused game leaves out the update steps, and keeps the order of the rest. | [CQS](../chapters/28-command-query-separation.md) | [Chapter 5](../chapters/05-the-tick.md) |
| **T-cap** | `deltaMs` is capped at a safe maximum. A long gap, from a lost focus, a slow load or a slow device, would otherwise reach models built for short steps. | [DbC](../chapters/31-design-by-contract.md) | [Chapter 5](../chapters/05-the-tick.md) |
| **T-minimal** | The ticker doesn't hold any game rules or drawing code. It only keeps time and calls the other parts in order. | [SoC](../chapters/26-separation-of-concerns.md) | [Chapter 2](../chapters/02-why-mvt.md) |
| **T-control** | The ticker may pause, slow down, speed up or single-step time. Models stay correct, because their only input from the ticker is `deltaMs`. | [DfT](../chapters/33-design-for-testability.md) | [Chapter 5](../chapters/05-the-tick.md) |

## Binding Rules

| Rule | What it says | Serves | Taught in |
| --- | --- | --- | --- |
| **B-contract** | A view's bindings are its contract with the rest of the game. Query bindings carry state in, from model to view. Relay bindings carry input out, from view to model. The bindings' type lists everything the view depends on. | [CQS](../chapters/28-command-query-separation.md), [DIP](../chapters/29-dependency-inversion.md), [DbC](../chapters/31-design-by-contract.md) | [Chapter 8](../chapters/08-bindings.md) |
| **B-reusable** | A reusable leaf view takes query and relay bindings. A top-level view may take its model as one binding, a fixed value, since it's specific to its game, and a binding for each property wouldn't gain anything. | [DIP](../chapters/29-dependency-inversion.md), [CRP](../chapters/30-composite-reuse.md) | [Chapter 8](../chapters/08-bindings.md) |
| **B-optional** | Relay bindings are usually optional, so a view can be used where its input isn't needed. | [DbC](../chapters/31-design-by-contract.md) | [Chapter 8](../chapters/08-bindings.md) |
| **B-wiring** | Bindings are wired where the view is built. The view's code doesn't depend on how it's connected to the rest of the game. | [DIP](../chapters/29-dependency-inversion.md) | [Chapter 8](../chapters/08-bindings.md), [Chapter 13](../chapters/13-composing-views.md) |

## Hot-Path Rules

These rules serve performance rather than a design principle, so they
don't have a Serves column. Where one pulls against a principle, the
principle's chapter says so, and Chapter 34 shows an example in
[When Principles Pull Against Each Other](../chapters/34-using-the-principles.md#when-principles-pull-against-each-other).
A hot path is any code that runs every tick: `update`, `refresh`, and
everything they call.

| Rule | What it says | Taught in |
| --- | --- | --- |
| **H-alloc** | Don't allocate objects, arrays, strings or closures in `update()` and `refresh()` every tick, so the engine collects garbage less often. | [Chapter 24](../chapters/24-hot-paths.md) |
| **H-loops** | Loop with an index, over structures made once and reused. | [Chapter 24](../chapters/24-hot-paths.md) |
| **H-cost** | Keep the work done each tick small. Prefer a lookup that takes the same time however big the collection to a search through it, and don't work out an unchanged value again. | [Chapter 24](../chapters/24-hot-paths.md) |
| **H-change** | When slow work depends on a value that changes rarely, check the value every tick, and do the work only when it changes. | [Chapter 24](../chapters/24-hot-paths.md), [Chapter 9](../chapters/09-noticing-changes.md) |

## Practices the Book Teaches

The rules above are MVT's core. The book also teaches practices that
follow from them. They don't have names of their own, and each is taught
where its link leads.

- **An action says what the player means,** such as `startNewRun()`, not
  which control they used
  ([Chapter 4](../chapters/04-models.md#actions-say-what-the-player-means)).
- **A model counts moments that repeat,** such as shots fired, so that a
  view can notice each one
  ([Chapter 9](../chapters/09-noticing-changes.md#counts-moments-that-repeat)).
- **An audio view plays on a change, never on a state,** such as a phase
  beginning or a count rising
  ([Chapter 20](../chapters/20-sound-and-music.md#play-on-a-change-never-on-a-state)).
- **Views never forward `update` or `refresh` to their children.**
  A function walks the view tree and calls each view's steps
  ([Chapter 5](../chapters/05-the-tick.md#trees-the-ticker-calls-only-the-roots)).
- **Values that many views share travel by import or by binding,** not through
  a hidden context
  ([Chapter 13](../chapters/13-composing-views.md#sharing-values-between-many-views)).
- **Child models don't reference each other.** Their parent handles the
  work that spans them
  ([Chapter 4](../chapters/04-models.md#siblings-interact-through-their-parent)).
- **A layout measurement is the view's input, not model state.** The
  view reads it back and uses it on the next frame
  ([Chapter 21](../chapters/21-reading-layout-back.md#measurements-are-input)).
- **State never lives at module level,** where every model that a file
  creates would share it
  ([Chapter 4](../chapters/04-models.md#state-at-module-level-is-shared)).
