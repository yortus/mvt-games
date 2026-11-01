# Why Views Poll

> An MVT view never receives a notification that the model changed.
> Every frame, it reads the state it shows, and where it matters, it
> compares that with what it read last time. That is polling, and it's the
> opposite of most UI code, where the model pushes each change out with
> events or signals. In a game loop, polling is the simpler choice: the
> loop already sets when views read, every read returns finished state,
> and the model stays plain state. This chapter shows why, along with
> polling's drawbacks, and when pushing would be faster.

**Related:** [Noticing Changes](09-noticing-changes.md) ·
[The Tick](05-the-tick.md) ·
[Single Source of Truth (SSOT)](27-single-source-of-truth.md) ·
[Measurements](../appendices/c-measurements.md)

Here's a model that notifies its views of a change the moment it makes
it:

```ts
function update(deltaMs: number): void {
    // ...
    if (pickedUpCoin) {
        coins++;
        emit('coins-changed'); // every listener runs now, mid-update
        if (coins === COINS_PER_LIFE) {
            coins = 0;
            lives++;
        }
    }
}
```

Every fifth coin turns into an extra life. A HUD listens for
`'coins-changed'`, and redraws both the coins and the lives. On the fifth
coin, the listener runs at the `emit` call, before the coins turn into a
life. So the HUD shows a full row of five coins beside the old number of
lives, which the game never settles on. The model doesn't emit an event
when the coins turn into a life, so the full row stays on screen until the
next coin.

The fix is to move `emit` to the end of the update. But the code doesn't
force you to do it, and the next person to edit `update` may move it back.
An MVT view can't have this bug. It doesn't run until every model has
finished its update, so everything it reads is final.

[§](#try-poll-vs-event-coins) shows both kinds of HUD, side by side, on
one model. The left one listens for `'coins-changed'`, and the right one
polls. Watch for the fifth coin. The right HUD empties its row and gains a
life, but the left one shows five coins and no new life until the next
coin arrives. Then open `player-model.ts`, and move `emit` below the
`if` block that turns the coins into a life. Now the two HUDs agree.

<TryIt example="poll-vs-event-coins" file="models/player-model.ts" />

## Three Ways to Detect a Change

When a model's state changes, its views must detect the change. The
general name for how they detect it is **reactivity**, and there are three
broad approaches:

| Approach | Started by | Examples |
| --- | --- | --- |
| **Events** (push) | The model sends a notification | The DOM's `addEventListener`, Node's `EventEmitter` |
| **Signals** (push, then pull) | A runtime tracks what reads what | Solid's `createSignal`, Angular's signals |
| **Polling** (pull) | The view reads, at a fixed point | A game view's `refresh()` |

With **events**, the model sends a named notification, and each listener
that registered for it runs straight away. This is the observer pattern,
and it's the oldest of the three.

With **signals**, each value lives in a small container, a signal. Code
that reads signals runs inside an **effect**. The runtime records which
signals each effect read, and runs the effect again when one of them
changes.

With **polling**, the view reads the current state at a point that comes
round regularly, and compares it with the last read where that matters. In
networking, "polling" means asking a server over and over whether anything
is new, and it's often wasteful, since most answers are "no". In a game
loop, the view reads at a point that runs every frame anyway, so polling
doesn't add any work just for checking.

All three work. The question is which one fits a program that runs in
frames.

## The Game Loop Already Decides When Views Read

Every reactivity system has to settle one central question: *when should
the code that depends on a value run again?*

A typical app doesn't have a natural answer. The user might click, a
network reply might arrive, a timer might fire. Events and signals settle
the question by notifying the code that depends on a value when it
changes.

In a game, the answer is already decided: every frame. On each
[tick](05-the-tick.md), the models update, then the views refresh. A view
reads the model's state every frame, whether or not the state changed. So
the question shifts from "when should I look?" to "what changed since last
frame?" That is change detection, and [Chapter 9](09-noticing-changes.md)
showed how little machinery it needs.

## Why Polling Suits a Game Loop

### Every read returns finished state

All the models finish updating before any view refreshes. So every value
that a view reads is final for the frame, and two values it reads always
belong together. A view never reads a half-updated model, you don't batch
anything, and you don't have a scheduler to reason about.

Push systems have to work for the same guarantee. Events need the
discipline you saw at the top of the chapter: emit only once all related
state is settled. Signals can have the same problem in another form. In
libraries whose effects run as each write lands, such as Solid and
Preact's signals, an effect can run between two related writes and read
a new score with an old level. These libraries provide a `batch()`
function to group the writes, but you have to know when to use it. Forget
it, and the bug comes and goes depending on what the effect does.
Libraries that schedule their effects to run later, such as Angular and
Vue, avoid this, but then you have to understand their scheduler.

### Models stay plain state

A model doesn't need to emit or wrap anything, and doesn't reference the
views that read it:

```ts
// The model doesn't reference anything that reads it
function createScoreModel(): ScoreModel {
    let score = 0;
    return {
        get score() { return score; },
        addPoints(points: number): void { score += points; },
    };
}
```

That keeps the model about the game, and easy to test.

### Each view decides which changes matter

With events, the model decides which changes are worth announcing. Say an
enemy model emits `'phase-changed'`, and you add a view that must react
when the enemy enters a tunnel. The model doesn't emit an
`'entered-tunnel'` event, so you add one, and the model now has code that
exists for one view. Over time, the
model collects events that exist only for particular views, and the
dependency runs the wrong way.

Some conditions don't have a natural moment to emit at all. "The enemy is
frightened *and* near the player" spans two values that change at
different times. With events, the view listens for one and polls for the
other, two mechanisms for one concern.

With polling, a view can watch any value that it reads, and the model's
code doesn't change. You can think of it as an event defined by its
consumer: the view decides what counts as a change worth acting on, with
the tools from [Chapter 9](09-noticing-changes.md). A condition over
several values is a computed value that a reaction watches. Signals have a
milder form of the same limit, since only values wrapped in signals can be
tracked.

### A polling view doesn't subscribe to anything

When a polling view is removed, its `refresh()` is never called again,
and its reactions and watchers go with it. With events and signals, each
listener or effect has to be removed or disposed of when its view goes.
Forget one, and it keeps running for a view that no longer exists,
without any visible sign.

## Drawbacks of Events and Signals

Beyond the drawbacks they share, events and signals each have one of
their own.

### Events scatter the control flow

As listeners multiply, what happens on a change is spread across the code.
To find out what `emit('enemy-defeated')` does, you search for every
listener. When a listener emits another event, the chain runs deeper, and
its order depends on which listener registered first, so the path is
only fully known at run time. A polling view's reactions sit in its update
and refresh steps, and run top to bottom, so the path is the code you
read.

### Continuous state doesn't fit well in signals

Positions and animation progress change every frame. If they're signals,
every write runs the runtime's tracking and notifying, sixty times a
second per value, for a view that would have read them every frame anyway.
If they aren't signals, some state is reactive and some isn't, and the
call site doesn't show which. An effect that reads one signal and one
plain getter silently ignores changes to the getter.

### How you group effects changes what runs

Three one-line effects and one three-line effect look the same, but they
aren't:

```ts
// Three effects: a new score runs only the first
createEffect(() => { scoreText.text = String(model.score); });
createEffect(() => { livesText.text = String(model.lives); });
createEffect(() => { waveText.text = String(model.wave); });

// One effect: a new score runs all three lines
createEffect(() => {
    scoreText.text = String(model.score);
    livesText.text = String(model.lives);
    waveText.text = String(model.wave);
});
```

To choose the right one, you have to think about how the runtime tracks
what each effect reads. Collections make the choice harder. A signal can
hold a whole array of enemies, a signal for each enemy, or one for each of
their properties, and each choice changes what effects can follow and how
long they take. A polling view's `refresh()` runs top to bottom every
frame, however you arrange it, and its model keeps plain arrays.

## Drawbacks of Polling

### A little work every frame

Polling reads every value, every frame, even when the values haven't
changed. Measured for this book, keeping 1000 Pixi containers in step with
a model by polling takes about 4-19 µs per frame, and doesn't leave any
garbage for the collector, however much changes
([Appendix C](../appendices/c-measurements.md)). A frame at 60 frames a
second lasts about 16.7 ms (16,667 µs), so at that scale polling takes a
small part of it. Signals and events take very little time while the
state stays the same.

### Very large scenes

The time per container stays flat up to about 1,000 containers, then
climbs, because the scene no longer fits in the processor's caches. At
100,000 containers, polling a scene at rest takes about 3.7 ms per frame,
over a fifth of a frame. The remedy is to skip what isn't active: a
hidden subtree doesn't need reading at all, and
[Chapter 7](07-views.md#updating-and-refreshing-views-with-the-mvtjs-libraries)
shows how a view skips the views below it. Watching one value that stands
for many, such as a count that rises whenever a collection changes, helps
too.

### Moments that pass within one update

Polling reads only the state that's still there when the view refreshes.
If a model sets a flag, acts on it and clears it within one update, views
never read it, where an event would have run at the moment itself. So the
model has to leave a trace, usually a count that rises each time the
moment happens, as [Chapter 9](09-noticing-changes.md) shows.

### Polling models don't list what's worth watching

A model's list of events shows a newcomer what it can report. A polling
model doesn't have such a list: each view decides which getters matter, so
that knowledge lives in the views. And while a computed value is worked
out again only when the values it reads change, you list those reads
yourself when you make it. The library doesn't track them for you, as a
signal runtime would.

## When Push Is Faster Than Polling

Push does its work only when a value changes. Polling does a little work
for every value, every frame. So which is faster depends on how much of
the state changes each frame.

Measured against Solid's signals, on the same 1000 containers, signals
are faster when fewer than about 2-9% of the containers change per frame.
Past that, polling is faster, and when everything changes, signals take
8-25 times as long. Signals also leave garbage on every change. Events
were the fastest of all in these measurements, because the model sends
notifications only for what changed, and the code doesn't scan any
state. Their drawbacks are in the design, as the earlier sections show,
and at this scale the difference from polling is a few microseconds a
frame. The full tables are in
[Appendix C](../appendices/c-measurements.md).

- **Mostly idle state favours push.** A typical app changes a handful of
  values in response to input, and is otherwise still. That is why UI
  frameworks use signals or events.
- **State that changes all the time favours polling.** In a game,
  positions and animations change every frame. The discrete state, such as
  scores and phases, is small enough that polling it takes very little
  time.
- **Push changes the model too.** Its fields become signals, or it gains
  events to emit, so it's no longer plain state. That drawback doesn't
  show in the timings.

## Other Approaches to Reactivity

Two other patterns turn up in games. With a **message queue**, the model
adds messages during its update, such as
`{ kind: 'enemy-destroyed', id: 42 }`, and a consumer reads them and
clears the queue once a frame. Messages wait until the model is done, so
they avoid the trouble with events at the top of this chapter. But the
model now keeps a queue, some code must drain it every frame, and when
there are two consumers, you have to decide which of them clears it.

With **snapshots and diffs**, an engine copies the state each frame and
compares it automatically. That is polling done by a framework, for
everything. Change detection in this book is the same idea, applied only
where you choose.

Finding a change by comparing a value with what it was, rather than
waiting for a notification, has a name: **dirty checking**. AngularJS's
digest cycle is the best-known example. In MVT it does a second job,
because a view writes to a structure that stays between frames, such as a
Pixi scene or the DOM. When a value hasn't changed, the view can skip
rebuilding what shows it. If the output were drawn again from scratch
every frame, skipping wouldn't save anything.

## Mixing Polling with Events

Polling covers nearly everything that a view does in a game, even sound, which
looks like the classic case for an event: a view plays a boom each time a
count of kills rises, as [Chapter 20](20-sound-and-music.md) shows.

Events still have a place outside the game loop, where a late or missed
notification doesn't change the screen. An analytics logger is the usual
example. It can listen for `'enemy-defeated'` without the game model
referencing analytics, as long as the model emits only after its state is
settled. A message queue suits this kind of listener too. The important
rule is that **views never depend on events to be correct.** The
models stay plain, the views stay reliable, and other systems can listen
where listening helps.

## Summary

In a game, the loop already sets when views read, so views don't need
notifications. They poll: read the state every frame, and compare where a
change matters. That makes every read consistent, keeps models plain, and
lets each view decide what's worth noticing.

| | Polling | Events | Signals |
| --- | --- | --- | --- |
| When code runs again | Every frame, already | When the model emits | When the runtime decides |
| The model | Plain state | Must emit events | Must wrap values in signals |
| Consistency | Built in: update, then read | Emit only after state settles | Batch related writes |
| Cleaning up | Not needed | Remove each listener | Dispose of each effect |
| Continuous state | Read directly | Wasteful, or left out | Wasteful, or left out |
| Values a view can follow | Any value it can read | Only the events declared | Only values in signals |
| Control flow | Top to bottom, in the view | Spread across listeners | Set by the runtime |
| Time taken while the state is unchanged | A little, every frame | Very little | Very little |

Events and signals aren't wrong. They're the right choice for much of the
software in the world, where code doesn't run every frame. But in a game
loop, the problems they solve are already solved, more simply, and their
drawbacks aren't worth taking on.

## Further Reading

- Erich Gamma, Richard Helm, Ralph Johnson and John Vlissides, *Design
  Patterns* (1994). The Observer pattern, the idea behind events.
- Robert Nystrom, *Game Programming Patterns* (2014), the Observer and
  Event Queue chapters. Events and message queues as games use them, and
  where they go wrong.
- The [TC39 signals proposal](https://github.com/tc39/proposal-signals)
  (2024). Signals as a common foundation for JavaScript frameworks, with a
  clear account of how they track what reads what.
