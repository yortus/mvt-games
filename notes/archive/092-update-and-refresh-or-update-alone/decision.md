# Decision: Update and Refresh, or Update Alone?

> Could MVT drop `refresh`, so that writing the output is just the last step
> of a view's `update`? It could, and the games would keep working: a spike ran
> the whole test suite that way and found no real site-level failure. We're
> keeping both steps anyway, by a thin margin. The rules that matter most apply
> in either design, so the choice is mostly about how mistakes fail: update-only's
> are quiet where today's are loud. For JSX, update-only removes a walk but not a
> concept. A team that wants update-only can already write it on top of today's
> MVT, as a house style.

**Status:** Decided 2026-11-06: keep `update` and `refresh`. Revised 2026-11-07,
with the rules that closed the gaps this record found (sections 5 and 7), a
second independent evaluation (section 9) and the examples in the book's
Chapter 34. Do not reopen without new information (section 11).

**Written:** 2026-11-06. The spike ran on `e92f9bce`. The code it cites was read
that day, and every path below was checked at `d26092a1`. The revision was
checked at `e0be2b81`. Counts and line-level detail will drift, so check them
before relying on them.

**Related:** [Chapter 34, "Choosing Between Two Designs That Both Work"](../../../packages/sites/docs/chapters/34-using-the-principles.md#choosing-between-two-designs-that-both-work)
(the version for the book's readers, with the five examples) · [Chapter 5, The Tick](../../../packages/sites/docs/chapters/05-the-tick.md) ·
[Chapter 28, Command-Query Separation](../../../packages/sites/docs/chapters/28-command-query-separation.md) ·
[Appendix A](../../../packages/sites/docs/appendices/a-mvt-on-one-page.md) ·
[001](../001-mvt-plugin-rework-plan.md) section 3.5 ·
[027](../027-mvt-method-names.md) ·
[task 072](../../tasks/backlog/072-update-and-refresh-method-names.md)

| Question | Answer | Section |
| --- | --- | --- |
| Is the statement's history right? | Yes, with one correction | 2 |
| Would update-only work? | Yes, on everything the spike could observe | 3 |
| Does the barrier between view updates and refreshes matter? | Not in practice | 4 |
| What does `refresh` really provide? | A step with no time in it, and no `deltaMs` in the code that writes the output | 4 |
| Which rules would change? | Five change, and three are added | 5 |
| Can `update(0)` be made foolproof? | Not by lint or types. It's now a stated rule, T-zero, in either design | 7 |
| Is a command from an update step a reason to keep `refresh`? | No. It was a gap in the rules under either design, and it's closed | 7 |
| Is update-only "stock game architecture"? | Close to engine scripting, but "every model, then every view" stays MVT's own | 8 |
| Which is better overall? | Update and refresh, by a thin margin | 9 |
| Can a team use update-only with MVT as it is? | Yes, as a house style that relaxes one rule | 10 |

## 1. The Question

The question keeps coming back, so here is the statement that this record
evaluates, in full:

> At the start, MVT was basically "models have update, views have refresh". This
> was simple to teach and explain and get right. Views were always timeless
> stateless projections of model state, and all time-sequencing happened in
> models. But we soon had to face the reality of presentation state, which would
> ruin model-view separation if put in models. The easiest solution was to use
> what we already had learned: the update method could be for both models (for
> domain state) _and_ views (presentation state). Now views could have update
> and/or refresh methods, each with different jobs. This worked and covered
> everything and we've build a bunch of games this way.
>
> But if we could start over, knowing what we know now, we'd probably not have
> the refresh methods at all. Refresh would just be the last step in a view's
> update method. Then MVT would be even simpler: just stock game arch (game loop
> + entity update methods) combined with strict model-view separation along
> domain-presentation boundaries.

## 2. What Held Up in the Statement

| Claim | Finding |
| --- | --- |
| It started as "models have update, views have refresh" | Supported. The first commit (`f90bdad6`, 2026-03-08) has the loop `model.update`, `view.refresh`, render. View `update` first appears in `93e90aa2`, on 2026-04-05 |
| Views were always timeless | Supported as the rule, not as the practice. The first commit's guide already has a Presentation State section, with a score tween as an allowed exception, but gives it no source of time. By 2026-03-31 (`6bc3ba8d`) views kept time in `refresh` with a hard-coded step, such as `timerMs += 16` in Scramble's `death-flash-view.ts`. The last of these went in `d639183d` (2026-09-22) |
| Refresh could be the last step of update | Supported. See section 3 |
| "We'd probably not have refresh" | Not adopted. It would work, but see section 9 |
| MVT would be "even simpler" | True of the statement of MVT, not of getting it right. Rules that the structure enforces today become rules to remember |
| "Just stock game arch" | Overclaimed. See section 8 |

A more accurate version of the second paragraph: if we started over, we could
fold refresh into update and it would work, since the games don't depend on the
ordering between the two. MVT would be shorter to state, but a few guarantees
that the structure gives for free would become rules to teach. For an
architecture that's taught, the second method earns its place.

## 3. The Spike

A throwaway worktree replaced the two walks with one interleaved walk: each
node's update, then its refresh, parents first. Four modes ran the full test
suite, and a probe compared each tick's output with a settled refresh. Section
13 says how to run it again.

| Mode | What it does | Tests | Newly failing |
| --- | --- | --- | --- |
| `off` | Today's two walks, the baseline | 3,611 of 3,616 pass | 5 fail, none about ticks (4 playground exports, 1 Minotaur timeout) |
| `order` | One interleaved walk, each walk's skips separate | 3,597 of 3,619 pass (3 more tests: the probe's controls) | 18 |
| `skip` | As `order`, and a skip from either step skips the subtree | 3,592 of 3,616 pass | 20 |
| `update0` | As `skip`, and `refreshView` is the walk at `deltaMs` 0 | 3,515 of 3,616 pass | 97 |

**The 18 in `order`.** None is a real site-level failure.

- 14 are the libraries' own tick tests. The 6 that were read assert the old call
  order or guards, such as "a container added during updateView waits for the
  next updateView".
- 3 are artefacts of the spike, whose shim refreshes twice: 2 in `entry-host`,
  whose fake game plays on every refresh, and the deliberately broken
  drifting bullet in the book.
- 1 is an audio timeout, in `sounds.test.ts`, which passed on the earlier run.

**`skip` added nothing real.** Beyond the tests above, it failed 2 book examples
and Fenceline's `game-view` test, each by reaching the 5-second limit under the
spike's slow walk. The same three tests passed under `order` with a longer limit,
though `skip` itself wasn't run again. Joining the two walks' skips adds no
failures, because `<List>` and `<Switch>` already gate updates the same way as
refreshes.

**The 97 in `update0`.** 66 are JSX conformance tests, and the ones sampled only
assert that `refreshView` doesn't call update. Not every remaining library
failure was read. Three real views broke:

- `fruit-machine/views/pixi/win-banner-view.tsx`: `Math.max(amount * (deltaMs /
  COUNT_UP_MS), 1)` moves on at delta 0, so the count would keep rolling through
  a pause.
- Deep Dive's `game-view`: 14 pixels changed, probably a bubble spawning at
  delta 0, inferred from the code.
- Fractalscope's `scope-view`: its photo work runs whatever the delta is.

**The staleness probe.** On each tick, the probe snapshotted the merged output,
ran a settled refresh and compared. It found **0 stale frames in 27,500 frames**,
1,250 for each of 22 Pixi entries, with generated input. Its positive controls
flagged 10 of 10 frames for a parent showing its child's state and for a mid-walk
command, and stayed silent on the safe case. (That long run's 21 failed image
comparisons are expected, since it changes each picture's timing and input. Its
result is the probe's totals in the log.)

**Limits of this evidence.**

- The probe can't see `Graphics` redraws or sound.
- It didn't cover the three.js or DOM entries.
- Input was generated, so a held key's repeat never ran.
- A merged pause was never run in a live host. That conclusion comes from reading
  the code.
- Performance wasn't measured, because the spike's walk was deliberately slow.

**A survey of update steps.** `survey-updates.py` found 52 update steps in
product code. It's a heuristic, so treat the count as a rough size. Four send
commands, and section 7 traces them. 0 of 121 `ref`s are on view components. 13
compound writes in view code are all on plain records, with time-scaled easing.
That search covered `+=` and the like, so it wouldn't find
`view.alpha = view.alpha - step`.

## 4. What `refresh` Really Provides

| Supposed reason to keep it | Finding |
| --- | --- |
| All updates finish before any output | **Weak.** Nothing in the games depended on it in the frames driven. Chapter 5's three guarantees come from the barrier between models and views, not this one |
| Hidden subtrees keep updating but skip refresh | **Real for plain views.** `<List>` and `<Switch>` already gate update the same way, and a merged JSX walk could still call `onUpdate` below a hidden element while skipping bindings. A plain view's merged update can't: it reads bindings that may be invalid while hidden, or it stops time while hidden. A health bar's `target()!.health` threw on the first tick |
| An early return is safe in `update` | **Real for plain views.** Merged, an early return skips the output too. A ship stopped at x=70 while the model reached 300. `coral/views/demo-view.ts` and Deep Dive's `game-view` return early on most frames, so they'd hit this at once. The fix, local `advance` and `draw` functions, is the split again by convention |
| Fast-forward: many updates, one refresh | **Weak.** `runner/headless.ts` already refreshes every step, and models can still be ticked alone. The book's claim that thumbnails work this way was wrong, and it's fixed |
| A tick with no time passing | **Real, but little used, and narrower now.** Entries are frozen but must still draw, while `'revealing'` and offering to resume (`isEntryFrozen` in `arcade-model.ts`). No confirmed case shows a model change while stopped (section 7.1), and `update(0)` is now required in either design |
| The code that writes the output has no `deltaMs` | **Real.** A view with only `refresh()` can't write a frame-rate-correct copy of the model's motion, and a refresh that asks for `deltaMs` doesn't compile. See section 6 |
| A linter can tell a step's job | **Real, but small.** "Update writes no output" and "refresh doesn't build on its own state" can't exist in one step, where both are normal. Prototyped with the type checker over 232 files: 2 update hits, both Tune Tracker's `AudioView`, since fixed, and 4 refresh hits, none a fault. The rules that protect the most, no relays and no model changes, need no split |

`refresh` also says something about a view. Most views are pure projections, and
`refresh` names them for what they are, where `update` would name them for time
they don't use.

## 5. How the Rules Would Change

Sections 7 and 9 give the rules as they stand. Most apply in either design. This
table lists what update-only would still change.

| Rule | Change under update-only |
| --- | --- |
| V-refresh | Becomes "a view's update runs after every model has updated" |
| V-presentation | Loses "doesn't write any output" and "a first refresh may come before a first update" |
| T-sequence | Goes from four steps to three. Models still all run first. Pause becomes a zero step, not a skip |
| T-zero | Stays, and becomes essential: `update(0)` runs on every paused frame, not only the first tick |
| V-idempotent | Moves rather than disappears, to the output part of `update`. That's a convention, where today `refresh` has no `deltaMs` to misuse |
| New: time | Output never depends on `deltaMs`, as a rule about lines in a function |
| New: late joiners | A view attached mid-walk gets `update(0)` in that walk. `catchUpRefresh` moves rather than disappears |
| New: hidden subtrees | Time while hidden has to be decided afresh |
| Tick API | `gateUpdates` and the second method list go. `SKIP_DESCENDANTS` also skips output, so freezing needs a nested `updateView(sub, 0)` |

**Presentation state is private.** An early draft added "read presentation state
only from yourself or your ancestors". It's now in V-presentation, in plainer
words: a view sees another's presentation state only if the owner passes it down
through a binding, never up or sideways. The architecture mostly enforces it.
Presentation state lives in closures, views return only their renderer object,
and no `ref` sits on a view component. The owner also moves it on, as Chapter 18
says. The one exception was the arcade page, where `arcade-view` made `layout` and
`card-wall-view` advanced it. `arcade-view` now does both.

## 6. Gotchas That Go Away, and New Ones

**These go away under update-only:**

- Choosing which step code belongs in.
- Output written in `update` going missing in tests.
- `+= 16` in `refresh`, since `deltaMs` is always there.
- Reactions being "less final" in update than in refresh.
- `gateUpdates` in `jsx/list.ts`, and its bugs of an item "as it is now, not at
  the last refresh".
- The naming drift in task 072.

**These are new:**

- An early return skips the output, which is the most serious (section 4).
- Time can reach output, so a paused frame can look different from a running one.
- Keeping state on display objects, which becomes tempting once update may write
  output, and `deltaMs` is right there.
- Hidden subtrees need a decision (section 4).
- `update(0)` runs on every paused frame, so a rarely used path runs all the time.
- Pause notices changes. `update(0)` may react to a change made while frozen, such
  as a saved game loading, so a flash could start frozen. Today update-side
  reactions wait for the resume.
- Tests that step time write output, and play sound, on every step (`advanceTime`
  is used in 45 files).
- Layout reads landing after writes. This one is minor. The case found,
  `cardRects()`, runs only on phase changes, in a root view that updates first.

**Keeping state on display objects.** Today `refresh` has no `deltaMs` to write
`view.y -= speed * deltaMs` with. In a merged update step, it looks correct, and
it passes the `update(0)` rule and the staleness probe. It goes wrong in these
ways:

| Problem | Example | Also with a local variable? |
| --- | --- | --- |
| The sprite drifts from the model | The book's drifting bullet, now frame-rate correct. It goes wrong only when the model changes, such as a slowdown that the sprite never sees | Yes |
| Rounding moves slow things wrongly | `x = Math.round(x + step)` at 30 px/s doubles the speed at 60 Hz, and never moves at 144 Hz | No |
| Effects corrupt each other | A shake by `content.x += offset`, or a flash and a fade sharing `alpha` | No |
| Fades never finish | `alpha += (1 - alpha) * 0.1` depends on frame rate, and never reaches 1 | Yes |
| Game timing depends on the view | `if (view.alpha <= 0) bindings.onFadedOut()` | Yes |
| A rebuild loses the animation | A grid rebuilt on resize, with progress stored on its sprites | Yes, if it's in the rebuilt view |

The operator isn't the problem. `+=` on a local is how presentation state moves
on, and `view.alpha = view.alpha - step` has every problem that `-=` has. The
rule is that output is write-only: a view works its output out from its state,
and assigns it. Reading a measurement that the renderer works out, such as a
`Text`'s `width`, is fine. A lint rule could flag the common form, but no lint
rule can spot a copy of domain state, so the drifting sprite stays a matter for
review. That's the worst of the six.

## 7. Delta 0, and Commands From Update Steps

### 7.1 Making `update(0)` foolproof

It can't be foolproof as a rule. "Delta 0 changes nothing" is a property of what
the code does, so neither a type nor a lint rule can prove it. Two designs remove
the risk:

| Design | How it removes the risk | Limit |
| --- | --- | --- |
| Never tick at delta 0 | Frozen views get no ticks, and the renderer keeps the last picture | It can't show changes while time is stopped |
| Keep a step with no time in it | The step can't advance anything, since it has no `deltaMs` | This is `refresh` |

Never ticking at 0 would need: one normal tick as a frozen entry starts, a view
made mid-walk getting the frame's delta, a ticker that never sends 0, and tests
that use a tiny delta in place of a bare `refreshView` (17 test files do that). It
looks workable for entries, but it wasn't tested.

**A paused world that still takes input needs the second design.** The repo has
no confirmed case of one. An earlier version of this record cited Chapter 11's door,
but that was wrong. From reading `run-sandbox.ts`, a paused project doesn't refresh
until the next step, so the snapping door moves on the Step after a click, not on
the click, and Chapter 11's text now says so. Frozen entries
do refresh, but the closest thing to a change while frozen is `bestScore`, in 3
entry files. So this is a property of the design rather than something the games
lean on. Passing absolute time instead of a delta doesn't help. Pure timers become safe,
but interruptible and physics-style effects need a stored previous value, which
brings the delta back.

**`update(0)` isn't a new requirement, only a much more exposed one.** An earlier
version of this record treated it as new. It isn't. Today's tickers already pass 0
on the first tick: `start-site-page.ts`, the playground's loops and Chapter 5's own
loop all use a delta of 0 when there's no last time. Models and view update steps
can see it, and rule T-zero now says that they must handle it. `refresh` doesn't
make any `update` safe at 0. An `update` that divides by `deltaMs` fails in either
design. The designs differ in exposure:

| | Two steps | Update-only |
| --- | --- | --- |
| How often `update` sees 0 | Once, on the first tick | On every paused frame |
| What has happened by then | Nothing has moved yet | The model may be changing |
| Does `if (deltaMs === 0) return` work? | Yes, because the output is written elsewhere | No, because it skips the output too |

So the benefit of `refresh` here is a paused tick that runs no time code at all, and
an early return that's safe. It's real but narrower than this record first said, and
it makes the margin in section 9 thinner.

**Choose examples of correct code.** `win-banner-view` is a poor example of this
risk, because its `Math.max(..., 1)` is already wrong at every frame rate, and
delta 0 only exposes it. The better case is code that's right at every real delta:

- Dividing by `deltaMs`, such as working out a speed from the distance moved. It
  gives `NaN` or `Infinity` at 0. Fractalscope's `pickBudgetShare` divides by
  `deltaMs` too, but its guard handles 0.
- A timer that has run out fires on the next update, whatever the delta. Deep Dive's
  bubbles work this way.
- A job spread across ticks, where each tick has a budget of work rather than of
  game time. Fractalscope's picture works this way.

A catalogue test would catch most mistakes without being foolproof: snapshot the
output at checkpoints, run `update(0)` twice and compare. It sees only the paths
that run.

**The sites that moved at 0 are fixed.** A temporary probe of that kind ran all 26
entries, before any time passed and at 100 checkpoints of generated play. Fractalscope's
picture did work at 0. Fireworks, Deep Dive, Crumb Chase and Fuel Run changed
something on the first tick. Reading the code found the win banner, which the probe's
input never reached. All six are fixed, and the probe then found only Sudoku Digger,
which applies a request.

That probe read output only, so "25 entries clean" was too strong. The second
evaluation found Boids, whose steering drew a random number for each boid at 0,
changing the flock's future with nothing visible, and `frame += 1` in the
reordering lists' view model. Both are fixed, and so is the same counter in the
book's `hand-state-by-id`. A later probe ran 59 of the 61 book, example and starter
projects, comparing output and counting random draws at 0. It found only the
deliberately broken drifting bullet, and three that apply something once, so that
a second `update(0)` changes nothing. It used no input.

**The rule, T-zero.** "No state changes at 0" was too strong, because `update(0)`
also applies what's already been asked for, and notices what's already changed.
`generateSudoku`, `edge-tween`, Chapters 19 and 21 and about 40 test calls rely on
that, and `arcade-view` starts its transition that way. So the rule is: `deltaMs` of
0 is always accepted, nothing measured in time moves, and no per-tick work is done.
An `update` may apply a request or notice a change, so a second `update(0)` changes
nothing. `sequence` and the tweens are safe at 0. `metronome` beats once as it's
turned on, even at 0, and `createRepeater` with it.

### 7.2 Commands from update steps

**This was a gap in the rules, not only a risk of update-only.** An earlier
version of this record counted it as a benefit of `refresh`. That was wrong. T-sequence,
Appendix A and Chapter 11 all said that model state is settled before any view runs,
while Chapter 28 let a view report input from its update step, and Chapter 5's
guarantee covered only "while views are refreshing". A report that changed a model at
once meant that a view updating before it saw the old state, and one after it saw the
new state. `refresh` keeps the output consistent, but it can't help an update step.

| Report from an update step | What it does |
| --- | --- |
| Astrovoid's `model.fire()`, Galaxy Raiders' and Fuel Run's `onHeld={model.fire}` | **Fixed.** The fire rate was game behaviour in a view, which failed the delete-the-view test. Each model now has `isAutoFiring` and `AUTO_FIRE_INTERVAL_MS`, and `drag-input-view` lost its update step |
| The card wall's `onLiveWanted` | **Fixed.** It was output, not input. The wall now plays on a `LivePreview`, from a reaction in its refresh step, as an audio view plays a sound |
| Sudoku's keypad hold | **Fixed.** It's a long press that fires once, and `fillCell` applied at once from the update step. `createKeypadGesturesViewModel` now notices the end of a hold as the keypad ticks it, and reports it with `queueMicrotask` |

So no report from an update step is left. That survey read update steps, and a
search of view models' `update` methods found the same: their relays all fire from
input events. The last case was a real recognised gesture, one that finishes when
time runs out, so something has to notice it during the tick.

A wider audit also traced relays from refresh steps and reactions, and recorded any
DOM listener that ran inside `frame()` on 11 pages under mouse and keyboard input.
It found two relays in refresh steps, both harmless, and both now fixed:
`touch-input-view` letting go of a held direction as it rebuilds, and
`code-editor-view` reporting an edit that came from the model. The only listener
seen inside `frame()` was the card wall's `focusin`, from `.focus()` in its refresh
step, which sets the wall's own state and fires no relay.

**What fixed it.** A gesture view model times the press, and `queueMicrotask` runs
the relay once the frame's code has finished, which is where an input event would
arrive. It needs no library code, and no change to the tick API. Game views don't
see it. The view ticks its view model, as Minotaur's board does, and never calls a
relay from its update step. On the real page, 20 of 20 holds were noticed inside
`frame()` and reported after it. Pausing stops the count. `advanceTime` awaits a
microtask on each step, so tests that use it see the report.
`advanceHeadless` is one synchronous loop, so a report would wait until it ends, but
nothing depends on that.

An earlier idea was a queue in the library, run at the end of the outermost
`refreshView`. It had a flaw: `frame()` runs several walks in one callback, so
it would have run mid-frame, before the page's own views. Requests in the model
don't work as a general rule either, because a model can't tell whether a call came
from an update step, so it would have to queue every call.

**The rules, as adopted.** These are now in Appendix A, as V-readonly, V-one-way,
B-outside, T-zero and additions to M-time, V-refresh, V-idempotent, V-presentation and
T-sequence.

> **Invariant:** models never change while views update or refresh.
>
> **Models:** an action may start async work, such as a load, and its result lands
> between frames. A model never uses async code (such as a
> `delay(ms: number): Promise<void>` helper) to wait for real time to pass.
> `update` is synchronous.
>
> **View update and refresh:** always synchronous. They may read query bindings, and
> never change a model, directly or through a relay. Neither queues state changes for
> later, apart from reporting a relay.
>
> **Update (views and models):** advances state only, and a view's update writes no
> output. A `deltaMs` of 0 is always accepted: nothing measured in time moves, and no
> per-tick work is done. It may apply a request or notice a change, so a second
> `update(0)` changes nothing. A view's state is valid from the moment it's built.
>
> **Refresh:** works out output from current state and writes it, with no time
> involved. Calling it twice gives the same result. It may remember what it drew.
>
> **Output:** a view never reads back what it wrote. Either step may take a measurement
> on a change.
>
> **Relays:** fire outside the frame, from a browser-delivered event, from a microtask
> for something noticed during a tick and timed in game time, or from a helper that
> does one of these. An event your own code causes during a tick runs inside the frame,
> so it must not fire a relay. A recognised gesture's timer isn't presentation
> state: it decides when the gesture is reported, so it's part of handling input.

A relay reports input, which is usually what the player did. It can also be something
else from outside the game that only the view can see, such as `onResized` from a
`ResizeObserver`. That fits Chapter 21, which treats a measurement as input.

Moving the hold into the model as held state is ruled out. It looks like
`isThrusting`, but hold timing is what a control does, and control behaviour
stays in views. It belongs in a model only where the rate is a game rule, such
as a fire rate.

## 8. Comparison With Game Engines

"Stock game arch" is fair for script layers such as Unity's `Update` and Godot's
`_process`, with two caveats. Not every stock loop is update-only: XNA, LÖVE and
Nystrom's game loop pair update with draw or render. And "every model, then every
view" isn't stock, as Chapter 2 says. So "MVT with one verb" is more accurate than
"just stock".

**Unity's `LateUpdate` isn't `refresh`.** It's closer to the merged view update.
Unity doesn't define the order of `Update` across objects, so a follow camera
written there might read its target before or after the target moves.
[`LateUpdate`](https://docs.unity.com/en-us/engine/current/script-reference/unityengine/monobehaviour/lateupdate)
runs after every `Update`, and a smoothed follow camera in it reads the settled
target, moves its damping on with `Time.deltaTime`, and writes the transform.

| Job | Unity | MVT today | MVT merged |
| --- | --- | --- | --- |
| Things move | `Update` | model `update` | model `update` |
| Read settled state, advance smoothing | `LateUpdate` | view `update` | view `update` |
| Write the output | `LateUpdate` | view `refresh` | view `update` |
| Draw | engine | renderer | renderer |

- **The barrier survives.** The one `LateUpdate` gives matches "every model, then
  every view". The barrier between view `update` and `refresh` is a second one,
  which Unity's pair has no equivalent of.
- **`refresh` guarantees what `LateUpdate` doesn't.** It has no `deltaMs`, it must
  be idempotent, and it never changes a model. Among the Unity phases checked, it
  has no counterpart.
- **Merged MVT would still order views better.** Views run parents first, where
  the order of `LateUpdate` calls is as undefined as `Update`'s.
- **Pausing has the same weak spot.** Setting
  [`timeScale`](https://docs.unity.com/en-us/engine/current/script-reference/unityengine/time/timescale)
  to 0 "acts as if paused if all your functions are frame rate independent". That's
  the convention `update(0)` would depend on, and `win-banner-view`'s
  `Math.max(..., 1)` is that bug.

Whether Unity "added" `LateUpdate` to solve this is unverified, so don't repeat
that as history.

## 9. The Overall Rating

Keep update and refresh, by a thin margin. Update-only is sound, and it would
work.

| Criterion | Better | Why |
| --- | --- | --- |
| Stating the architecture | Update-only | One verb and a shorter tick, familiar from engine scripting |
| Library internals | Update-only | `gateUpdates` and the second method list go, though mid-walk attach handling must move |
| Ordering safety | About even | The barrier wasn't needed in anything that could be observed |
| A view that only shows state | Update and refresh | `refresh` says so |
| Rules for stateful views | About even | Safety at 0, relays outside the frame and write-only output apply in both now. Today adds no output in update, and start valid. Update-only adds time kept out of output, hidden subtrees and late joiners |
| JSX views | About even | Authors keep both jobs either way. Update-only removes a walk and a name |
| Plain TypeScript views | Update and refresh | The new problems land here: early return, time reaching output, state on display objects |
| What lint can check | Update and refresh, slightly | Two checks need two steps. The most valuable checks don't |
| How mistakes fail | **Update and refresh** | See below |
| Stopped time with live input | Update and refresh | A step with no time in it handles this cleanly, though no confirmed case exists |
| Fit for tests and tools | Update and refresh | Posing a view with no time passing is natural. Update-only needs tiny deltas or `update(0)` |

**How mistakes fail decides it.** Today's typical mistakes are loud or impossible.
Output written in `update` goes missing in a test, and `refresh` has no `deltaMs`
to misuse. The update-only mistakes are quiet. An early return stops a ship following
the model only once an effect ends, and a `view.y -= speed * deltaMs` bullet looks
right until a power-up changes the model. This matters more here than elsewhere,
because this project's readers are learners and AI agents, who follow what the
structure allows more reliably than what a rule asks.

**Why the margin is thin.** The rules that closed section 7's gaps apply in either
design, so they no longer count against update-only. The evidence shows that
update-only is feasible. It doesn't show that the trade is worth making, in either
direction.

**The second evaluation.** A subagent repeated the evaluation at `4db87b43`, on the new
rules, without this record or the docs changes. It found the statement substantially
supported, with three corrections: views weren't always timeless, "even simpler" is
only partly earned because rules move rather than disappear, and "just stock game arch"
undersells the barrier, the invariant, the relay rule, `update(0)` and timeless output.
Its main finding was that Chapter 5's guarantees come from the barrier between models
and views. Its own list of code that broke the rules led to fixes in Boids, Burrow
Bust's rock, and the reordering lists.

**Two more arguments.**

- Refactoring state into helpers and view models is easier with two steps: **rejected.**
  Swapping a crossfade for a helper is about as easy either way.
- JSX with presentation state: **it works equally well under update-only, but it shows
  the concept stays.** All 28 `onUpdate`s are on a view's top element, and every
  attribute that reads what they change is on that element or a descendant, so a merged
  walk would run them in order. But a getter attribute has to run after `onUpdate`, with
  no `deltaMs`, and be skipped while hidden, which is a refresh step by behaviour. So
  are the 55 product `onRefresh` uses, such as `drawCave`. There are 126 `.tsx` view
  files and 122 `.ts`, so the "one verb" gain reaches about half of them.

**Five examples and a counterexample.** Chapter 34 gives the five: early return, JSX
ordering, a hidden binding, state on the output, and lint. The counterexample, Juice
Burst, where one step is simpler, is recorded only here. The one-step Juice Burst matched the real view tick for tick over 600 ticks.
It was faster too, but that's mostly plain TypeScript against JSX, and both are tiny
against a frame.

An early assessment called the trade favourable, since the new rules touched
about 4 of 52 update steps. That undercounted: the write-only rule applies to
every stateful view, and it didn't weigh how quietly the new mistakes fail.

**Migration wasn't part of the judgement,** because the statement is about
starting over. For this repo it would touch over 200 product files and about 550
mentions in the docs, which isn't worth doing whichever design is better.

## 10. Update-Only as a House Style

A small team of engine-experienced developers, shipping one game with no stepping
tools, might well prefer update-only. They don't need a different architecture.
They can write it on today's MVT, with skill and lint changes and no library work:
a view can write its output in its `setUpdate` method, a view with no refresh
method adds nothing to the refresh walk, and no lint rule objects. Only
V-presentation forbids it. It can even be done view by view, since both kinds
share a tree, though a command from an update step can still tear against views
that have already written their output.

"Everywhere" needs three qualifiers:

- **JSX, `<List>` and `<Switch>` still use refresh.** Function attributes compile
  to refresh methods (`create-jsx.ts`), and `<List>` and `<Switch>` do their
  presence checks there. The realistic version is "no hand-written refresh
  methods".
- **Views attached during `updateView` wait for the next one**
  (`container-mixin.test.ts`). `refreshView` catches up on new views, and
  `updateView` doesn't. So a child built in an update step must write its own
  output as it's made.
- **A view needs a tick to appear.** Anything that shows a view with only
  `refreshView` shows nothing from these views, and a frozen entry would need one
  starting tick. How v-snap's poses reach their refresh wasn't checked, so test
  that before relying on it.

It's a specialisation of the mechanism, but not of the rules:

| Form | Relation to update and refresh | Guarantees |
| --- | --- | --- |
| Refresh-only | A true specialisation, and what most views are today | All kept |
| Update and refresh | The general form | All |
| Update-only | The same mechanism, with looser rules | Some traded away |

Update-only narrows `refresh` to nothing, but it also widens `update`, so it gives
guarantees up rather than inheriting them. The team still needs the rules in
section 5, and misses the library simplifications, since `gateUpdates` and the
second list stay.

This strengthens the case for keeping both. You can get update-only from update
and refresh by not using `refresh`, but you can't get a step with no time in it
from update-only without adding it back. The general form keeps the choice open.

## 11. Settled Questions, and What Would Reopen Them

Do not reopen these without new information:

- **Keep both steps.** The decision is in sections 9 and 10.
- **The barrier isn't a blocker.** Don't argue against update-only from ordering
  between view updates and refreshes. It didn't hold up (section 4).
- **Presentation state is private.** A view sees another's only if the owner passes
  it down through a binding. Don't list reading a child's state as a gotcha
  (section 5).
- **Relays never fire during a tick.** A library queue and requests in the model were
  both considered and rejected (section 7.2).
- **Refactoring ease isn't an argument for two steps** (section 9).
- **The `+=` operator isn't the problem.** The rule is write-only output (section
  6).
- **`update(0)` can't be made safe by lint or types** (section 7.1).

These would be new information:

- The book drops its stop-time and stepping demos, so that output with no time
  passing is no longer needed.
- A catalogue test and lint rules prove reliable enough to make the quiet mistakes
  loud.
- MVT's main audience changes from learners and agents to experienced engine
  developers.
- A design appears that guarantees `update(0)` safety without a second step.

Even then, it would be a closer call rather than a clear win, and the migration
cost in section 9 still applies to this repo.

## 12. Follow-Ups

Done with this record:

- [Chapter 34, "Choosing Between Two Designs That Both Work"](../../../packages/sites/docs/chapters/34-using-the-principles.md#choosing-between-two-designs-that-both-work),
  the version for readers.
- The rules in sections 5 and 7, in Appendix A, the chapters that teach them, the
  glossary, `AGENTS.md`, the skills and `llms.txt`.
- Chapter 5 no longer says that the order of views never matters, and thumbnails no
  longer claim many updates and one refresh.
- Chapter 11's door text matches the paused sandbox. Chapter 18 says that the view that
  owns shared state moves it on, and teaches recognised gestures with a view model.
- Tune Tracker's `AudioView` plays from refresh, and `arcade-view` moves its own
  `layout` on.

Still open:

- Nothing enforces these rules yet: [task 093](../../tasks/backlog/093-enforce-the-tick-rules.md).
- The naming clean-up in [task 072](../../tasks/backlog/072-update-and-refresh-method-names.md).

## 13. Running the Spike Again

The [spike](spike/) folder holds everything needed. Nothing in it is part of the
repo's code. The patch keeps its TypeScript inside it, so that lint doesn't read
those files.

| File | What it's for |
| --- | --- |
| `merge-spike.diff` | The merged walk, the probe and its controls, and the entries' visual tests changed to drive 20 seconds of generated input. It applies to `e92f9bce`. On a later commit, the tick API's part may still apply, and the visual tests' part may need redoing |
| `run-mode.sh` | Runs the suite under one mode |
| `compare-runs.py` | Compares each mode's report with the baseline |
| `print-new-failures.py` | Prints each newly failing test's message |
| `survey-updates.py` | Lists update steps in product code, and flags what they do |

1. Make a worktree called `merge-spike`, and run `npm ci` in it, since worktrees
   lack `node_modules`.
2. From its root, apply everything but the visual tests, with
   `git apply --exclude='*/visual-tests/*' <patch>`. The suite's figures in section
   3 come from visual tests left as they are.
3. Run `run-mode.sh <mode> <runs dir>` for `off` and each other mode. The probe's
   3 controls pass only in the merged modes, so `off` shows them as 3 more
   failures.
4. Run `compare-runs.py <runs dir> order skip update0`, and then
   `print-new-failures.py <runs dir> order`.
5. For the probe, set `MERGE_MODE` to `order` and apply the rest, with
   `git apply --include='*/visual-tests/*' --exclude='*' <patch>`. Then run
   `npx vitest run entries/visual-tests/ --testTimeout=300000`, and read the
   `[PROBE-TOTAL]` and `[PROBE]` lines in its output. Expect those tests' image
   comparisons to fail (section 3).
6. Delete the worktree. Don't merge any of this.
