# Single Source of Truth (SSOT)

> Every piece of domain state lives in exactly one model. Any other model or
> view that needs it reads it from that model, or computes what it needs
> from what it reads. None of them keeps a copy. With one place to look,
> nothing in the game can disagree with anything else.

**Previous:** [Separation of Concerns (SoC)](separation-of-concerns.md)

**Related:** [Architecture Overview](../index.md) ·
[Rules](../rules.md) ·
[Why Polling](../../building-with-mvt/reacting-to-changes/why-polling.md) ·
[Command-Query Separation (CQS)](command-query-separation.md)

**Note:** Examples are in TypeScript; see [why](index.md#examples-are-in-typescript).

---

## The Principle

A piece of state has a **single source of truth** when exactly one place
holds it, and everything else that needs it reads it from there. A copy is a
second answer to the same question, and two answers can drift apart. The
principle is not against copying as such; it is against two places that are
both meant to be right.

The idea is older than the phrase. Edgar Codd's relational model (1970)
stores each fact in a database once, because redundant copies can become
inconsistent. Andrew Hunt and David Thomas widened it to all knowledge in
a program as DRY (1999): "Every piece of knowledge must have a single,
unambiguous, authoritative representation within a system." The phrase
itself comes from information systems, and UI frameworks use it for state:
for each piece of state, one component owns it.

## Symptoms

Copies are tempting because they are close at hand. Here is a view that
shows the player's lives as a row of icons, and keeps its own count:

```ts
function LivesView(bindings: { lives: () => number; isExploding: () => boolean }) {
    let lives = bindings.lives(); // a copy, taken at construction
    let wasExploding = false;

    function refresh() {
        const exploding = bindings.isExploding();
        if (exploding && !wasExploding) lives--; // kept in step by hand
        wasExploding = exploding;
        for (let i = 0; i < icons.length; i++) icons[i].visible = i < lives;
    }
    // ...
}
```

It works on the first playtest: the ship explodes, an icon disappears. The
copy is right as long as the only way to change the lives is to explode.
Now try a few ordinary requests:

- **Add an extra-life pickup.** The model's lives go up; the view's copy
  doesn't, so it shows one life fewer than the player has.
- **Restart the game.** The model resets lives to three. The view's copy
  stays at zero.
- **Show the lives in the pause menu too.** The second view needs its own
  copy, kept in step its own way, with its own bugs. The game now has three
  answers to "how many lives?"

In a real game the same thing happens wherever state is copied, between
views and between models, and it shows up as three symptoms:

- **Things disagree.** A copy is kept in step by code that runs on some
  paths. On every other path (a reset, a loaded save, a debug menu, a new
  rule), it falls behind, and nothing says so.
- **Every new rule costs more than it should.** The extra-life pickup is a
  one-line change to the model. Finding and fixing every copy of it is not.
- **Bugs depend on history.** A copy is right or wrong depending on what
  has happened since it was taken. The bug appears only after a particular
  sequence, and a test has to replay that sequence to see it.

## Applied to MVT: One Owner, Many Readers

[Separation of Concerns](separation-of-concerns.md) puts domain state in
models. SSOT goes one step further: each piece of domain state lives in
exactly one model, and nothing else keeps it.

The same view, reading instead of copying:

```ts
function LivesView(bindings: { lives: () => number }) {
    function refresh() {
        const lives = bindings.lives();
        for (let i = 0; i < icons.length; i++) icons[i].visible = i < lives;
    }
    // ...
}
```

It is shorter, and every request above now works without touching it. The
extra-life pickup, the restart and the pause menu all change or read the
model's lives, and every view reads the same number on the next frame, because
there is nothing to keep in step. This is [V-reactive](../rules.md#view-rules):
a query binding given as a function is read again in every `refresh()`,
never kept from construction.

Notice that the view is never told the lives changed. It reads them every
frame, and a read always gets the current answer. Notifying views of
changes, with events, is a way to keep copies in step; a view that reads
the source has no copy to keep.
[Why Polling](../../building-with-mvt/reacting-to-changes/why-polling.md)
follows that choice through, cost included.

### Between models

The principle applies between models too.
[Burrow Bust](https://github.com/yortus/mvt-games/tree/main/packages/sites/arcade/src/entries/burrow-bust)'s
[field model](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/burrow-bust/models/field-model.ts)
is the one record of which tiles have been dug. The digger, the rocks and
the enemies keep no map of their own: each is given a function to ask
(`isWalkable(row, col)`), and the
[game model](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/burrow-bust/models/game-model.ts)
wires it to the field. Each enemy chases the digger by reading the digger
model's position, not a copy handed over each tick.

### Derived, not stored

Reading is half of it; computing is the other half. A value that can be
computed from the source is computed when it is needed, rather than stored
beside it. Burrow Bust's game model clears a level when no enemies are left alive,
and it counts them each time it asks, rather than keeping a counter. An
enemy can leave by being popped, crushed or escaping, and a counter would
need decrementing correctly on all three paths, and on any path added
later. A count taken from the enemies themselves can't miss one.

### State flows one way

Put together, state flows in one direction. Query bindings carry it from
the models to the views. Relay bindings carry the player's input back, to
a model that changes its own state, and every view reads the result on the
next frame. No view corrects another view, and no view writes the model's
state for it. This shape is often called **unidirectional data flow**; here
it is simply what is left when nothing keeps a copy. The next page,
[Command-Query Separation](command-query-separation.md), explains why the
reads in it never change anything.

## Practical Benefits

- **Nothing to keep in step.** A new rule changes the model, and every view
  shows it on the next frame. No view needs editing to stay correct.
- **Views agree without trying.** Any number of views can show the same
  state, and they cannot disagree, because there is one answer to read.
  [View Composition](../../building-with-mvt/presenting-the-world/view-composition.md#multiple-views-one-model)
  shows this in practice.
- **Saving, loading and replaying are exact.** All of the game's domain
  state is in its models, so saving the models saves the game. No domain
  state is hidden in a view, waiting to be lost on load.
- **Tests set state, not history.** To test the lives view, give it
  `() => 2` and look. There is no sequence of explosions to replay.
- **Bugs have one suspect fewer.** If the wrong number of lives is shown,
  either the model holds the wrong number, or the view draws it wrongly.
  There is no copy that might have drifted.

## Practical Costs

- **Views read values that haven't changed.** Every frame, a view reads
  every value it shows, changed or not. Each read is cheap: keeping 1000
  containers in step with a model costs about 5-8 µs per frame when nothing
  changes ([measured](../../building-with-mvt/performance/measurements.md#keeping-containers-in-step)).
  Where a change triggers expensive work, such as rebuilding text,
  [change detection](../../building-with-mvt/reacting-to-changes/change-detection.md)
  does that work only when the value changes.
- **Derived values are recomputed.** Counting the living enemies loops over
  them every tick. That is usually trivial. When it isn't, the owner may
  cache the result, as long as it updates the cache in the same place it
  changes the source: Burrow Bust's field model keeps a count of dug tiles,
  updated inside `dig()`, beside the tiles themselves. A cache kept by the
  owner, at the same writes, cannot drift. The same cache kept anywhere else
  is a copy.
- **Something that happens and is over needs a trace.** A hit that starts
  and ends within one update leaves nothing for a view to read. The model
  has to keep something readable, such as a count of hits taken; the
  [overview](index.md#deciding-a-case-no-rule-covers) works through this
  case.
- **Shared state needs a decision about who owns it.** When two models both need a piece
  of state, one of them has to own it, or their parent does. In Burrow
  Bust, the digger can't walk through rocks, but the rocks don't belong to
  the digger. So the digger doesn't track them. It asks
  `isWalkable(row, col)`, and the game model, which owns the field and the
  rocks, answers by checking both.

## Common Misreadings

- **Not one big model.** SSOT means one source for each piece of state, not
  one place for all of it. React's documentation puts it well: "It doesn't
  mean that all state lives in one place - but that for *each* piece of
  state, there is a *specific* component that holds that piece of
  information." Burrow Bust has a model for the field, the digger, and each
  rock and enemy, and each is the source of its own state.
- **Presentation state is not a copy.** A score counter that rolls up to a
  new score holds its own displayed number, which trails the model's score
  for a moment. That number answers a different question: not "what is the
  score?", which only the model answers, but "what number is on screen right
  now?", which only the view knows. See
  [Presentation State](../../building-with-mvt/adding-visual-polish/presentation-state.md).
- **A change-detection cache is not a copy.** A view that remembers last
  frame's value, to notice when it changes, never treats it as the answer,
  and replaces it every frame. The `wasExploding` flag in the first example
  is this kind, and is fine; the copied `lives` was the problem.
- **A starting value is not a copy.** Burrow Bust's field model copies its
  level's layout when it is built, then owns the tiles from then on. The
  layout says where the field starts, not where it is, and after the first
  dig the two are meant to differ. A copy is only a problem when both are
  meant to stay the same.
- **A fixed binding is not a stale copy.** A view may read a query binding
  once, at construction, if its bindings declare it as a fixed value (`T`,
  not `() => T`), so every caller can see the view won't follow a change.
  The bug is a binding declared as a function but read only once: the
  declaration says the view follows changes, and the view doesn't. See
  [Fixed Values and Getters](../bindings.md#fixed-values-and-getters).

## Checklist

Questions to ask of a design, or in a review:

- For each piece of domain state: which one model owns it?
- Does any view or model keep its own copy of state another model owns?
- Is any value kept in step by hand, adjusted when something happens,
  instead of read or worked out from its source?
- Is any query binding declared as a function, but read once and kept?
- Is any stored value always equal to something that could be computed? If
  so, does the owner of the source keep it, updated at the same writes?
- Does anything happen and end within one update that a view needs to
  show? If so, does the model keep a trace a view can read?

## Rules It Underpins

| Rule | How it follows |
| --- | --- |
| [V-stateless](../rules.md#view-rules) | Domain state has one home, a model, so a view keeps none of its own |
| [V-reactive](../rules.md#view-rules) | A query binding given as a function leads to the source, so it is read every frame, never kept |
| [V-presentation](../rules.md#view-rules) | Presentation state answers a different question from the model's state, so it is not a second source |
| [M-composition](../rules.md#model-rules) | Questions that span several models are answered by their parent, from its children's state, not from copies of it |

## Further Reading

- E. F. Codd, "A Relational Model of Data for Large Shared Data Banks",
  *Communications of the ACM* (1970). Storing each fact once, and what goes
  wrong when copies of it disagree.
- Andrew Hunt and David Thomas, *The Pragmatic Programmer* (1999). DRY, the
  same principle applied to every kind of knowledge in a program.
- React documentation,
  ["Sharing State Between Components"](https://react.dev/learn/sharing-state-between-components#a-single-source-of-truth-for-each-state).
  One owner for each piece of state, and lifting shared state up to a
  common parent, as UI frameworks practise it.

---

**Next:** [Command-Query Separation (CQS)](command-query-separation.md)
