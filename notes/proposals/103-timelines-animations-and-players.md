# Proposal: Timelines, animations and players

> Views animate Pixi containers today with `createSequence`, a clock and a set
> of timed steps in one object, and `createSequenceTracker`, which calls
> `entering`, `active` and `inactive` callbacks as each step changes state.
> Together they can't be shared, scrubbed or played backwards, they hand out
> callbacks, and their users write the same code again and again: hide this
> outside its step, capture that as the step begins, and in one case read back
> where a particle got to. This proposal replaces them with three layers, each
> usable on its own and each a building block for the next. A **timeline** says
> when each step runs (stateless, pure data). An **animation** says what each
> step does to each target's properties (stateless, data where it can be). A
> **player** holds the state: which phase is playing and how far it has got,
> moved on by `update(deltaMs)` and written out by `apply()`. The common case
> is one player in one view. Views that follow the model's progress use an
> animation alone, with no state at all.

**Status:** draft, for discussion. Nothing is built. The user has more changes
in mind.

**Written:** 2026-11-20, against `vnext` at `2ef9c043`, from a design
discussion that started from an outline of a stateless timeline (section 1.2).
The worked examples (section 8) port code that exists today; they are
sketches, not yet type-checked.

**Related:**
[sequence.ts](../../packages/libraries/utils/src/sequence.ts),
[sequence-tracker.ts](../../packages/libraries/utils/src/sequence-tracker.ts),
[edge-tween.ts](../../packages/libraries/utils/src/edge-tween.ts),
[boolean-tween.ts](../../packages/libraries/utils/src/boolean-tween.ts),
Kwazy Cactii's [board views](../../packages/sites/arcade/src/entries/kwazy-cactii/views/board-view/),
Fuel Run's [section announcement](../../packages/sites/arcade/src/entries/fuel-run/views/section-announcement-view.tsx),
the puzzles' [pointer view model](../../packages/sites/puzzles/src/shared/views/pointer-view-model.ts),
[Chapter 11, Presentation State](../../packages/sites/docs/chapters/11-presentation-state.md),
[Chapter 18, Growing a Complex View](../../packages/sites/docs/chapters/18-growing-a-complex-view.md).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | Three layers: timeline (when), animation (what), player (state). Each usable on its own, each taking the layer below as a built object or as plain data | 2 |
| 2 | A step is a duration and a start, and the start may follow another step (`after`) | 3.1, 6.2 |
| 3 | Repeat, yoyo and instant steps are timing, so they belong to the timeline | 3.1, 6.3 |
| 4 | Phases carry their order (`next`) and length (`durationMs`). A phase with no length is where a player waits | 3.2 |
| 5 | Easing belongs to the animation, on each keyframe, not to the timeline's steps | 4.3, 6.1 |
| 6 | Keyframes move a value from wherever it is, so a phase left early carries on smoothly | 4.2, 5.2 |
| 7 | The player has `play`, `update` and `apply`, and no callbacks | 5 |
| 8 | Whatever is written as data round-trips exactly; formulas and ease functions are code and stay in code | 7 |
| 9 | Retire `createSequence`, `createSequenceTracker` and `createEdgeTween` once their users are ported | 9 |

## 1. Why change

### 1.1 What the current tools cost

`createSequence` bundles two things: a clock (`start`, `update`, `isActive`)
and a shape (named steps with start times and durations). Because it holds a
clock, it can't be shared, and its pose can't be worked out for a moment
other than now. `createSequenceTracker` adds callbacks for each change of a
step's state, and remembers each step's last state so it can tell when to
call them.

Looking at what the callbacks actually do, across the five Kwazy Cactii board
layers and the book's match-celebration example:

| What the callback does | Where | Better done as |
| --- | --- | --- |
| Captures the match's data: centre, cascade, points, text, firework geometry | `entering` in the popup, stars, firework launch, banner and dust | Captured once as the match begins (section 8.2) |
| Hides something outside its step | Most `inactive` callbacks, `alpha = 0` | A property that rests at 0 at both ends, or `autoAlpha` |
| Skips an effect below a cascade | `if (cascade < MIN) return` in most `active` callbacks | A value captured as the match begins |
| Reads back where a particle got to | The firework burst's `entering` reads `gfxPool[i].position` | A formula over both steps (section 8.2) |
| Hides the unused items of a pool | The tail of each `active` callback | `apply` |

Two things stand out. Every `entering` callback fires before the model's
500 ms match phase ends, while `matchedCells` and `cascadeStep` are still the
same, so none of them needs to run when its own step starts: capturing
everything once, as the match begins, gives the same result. And the firework
burst breaks the rule that a view never reads back what it wrote.

The clock also forces a shape on the views. `BoardView` owns the one match
sequence and passes it down to five layers (six, counting `PiecesView`), so
that they stay in step.

### 1.2 Where this design came from

The discussion started from an outline of a stateless timeline: steps by
name, read at a progress value, with formulas setting each container's
properties and `keyframes` moving a value from step to step. It worked well
for views that follow the model's progress, and badly for the common case,
presentation state that runs on the view's own time: a banner that opens on a
big combo, holds, and closes. A separate "playhead" object was tried for that
and rejected as too clever. This proposal keeps the stateless outline as its
lower two layers and adds a plain stateful player on top.

## 2. The three layers

```
Layer 1  createTimeline         when each step runs       stateless, pure data
Layer 2  createAnimation        what each step does        stateless, data where it can be
Layer 3  createAnimationPlayer  which phase, how far       stateful: play, update, apply
```

Each layer takes the one below it either as a built object or as plain data.
So each is usable alone, the common case can be written inline in one call
(section 5.3), and a timeline can be shared by several animations, as Kwazy
Cactii's layers share one (section 8.2).

Layer 1 and layer 3, and the core of layer 2, are renderer-agnostic and would
live in `@mvtjs/utils`. Layer 2's property setters depend on the renderer, so
the Pixi property list would live in `@mvtjs/pixi`, as the view tick API is
split today. Three.js and HTML property lists can follow when an entry needs
them.

## 3. Layer 1: the timeline

### 3.1 Steps

A step is `{ durationMs, startMs?, after?, repeat?, yoyo? }`.

| Field | Form | What it does |
| --- | --- | --- |
| `durationMs` | `number`, at least 0 | How long it runs. A step of 0 is **instant**: it reads 0 before its start and 1 from then on |
| `startMs` | `number`, defaults to 0 | When it starts: from the phase's start, or from the end of the `after` step. It may be negative after `after`, for an overlap, but a step may not start before its phase |
| `after` | a step's name, in the same phase | The step this one follows |
| `repeat` | `number`, defaults to 1 | How many times it runs, end to end, within its own span. Its `durationMs` is one run |
| `yoyo` | `boolean` | Each run goes there and back, 0 to 1 to 0 |

A step's progress, read at any moment, is:

- 0 before it starts.
- Its linear progress through the current run while it runs, or there and
  back for a yoyo.
- Once it has ended, where its last run ended: 1, or 0 for a yoyo.

The timeline works out each step's absolute start and end once, as it is
built. It throws if a step names an `after` that doesn't exist, or that
leads round in a loop, if a step would start before its phase, or if a
duration or a repeat count is negative.

### 3.2 Phases

`createTimeline({ phases })` makes a timeline in phases, such as a banner's
opening, open, closing and closed. A phase is `{ steps?, durationMs?, next? }`.

| Field | What it does |
| --- | --- |
| `steps` | The phase's steps, by name. Step names must differ across all the phases |
| `durationMs` | How long the phase lasts. It defaults to the end of its last step, or 0 for a phase with no steps. It throws if a step ends after it, which catches a step that would overrun a length the view took from the model |
| `next` | The phase that follows. It defaults to the next one listed, and the last phase has none. A phase may name itself, to loop |

`phases` lists every phase in the order they run. Within a phase:

- Steps of earlier phases read as ended.
- Steps of later phases read 0.
- The current phase's steps follow its time.

So one formula per property covers every phase, and each phase carries on
from where the one before it ended.

`createTimeline({ steps })` is a timeline with one phase. Nothing that reads
it takes a phase argument.

### 3.3 Reading a timeline

```ts
interface Timeline<P extends string, S extends string> {
    readonly phases: readonly P[];
    readonly durationMs: { readonly [K in P]: number };
    readonly next: { readonly [K in P]: P | undefined };
    /** A record of every step's progress, made once and filled again by each read. */
    createReading: () => StepReading<S>;
    /** Fills in every step: earlier phases ended, later phases 0, this phase's steps at `ms` into it. */
    read: (reading: StepReading<S>, phase: P, ms: number) => void;
    /** Fills in only `phase`'s steps, at `ms` into it, and leaves the rest as they are. */
    readPhase: (reading: StepReading<S>, phase: P, ms: number) => void;
    /** The definition, as data (section 7). */
    readonly data: TimelineData;
}

type StepReading<S extends string> = { [K in S]: number };
```

A reading is a plain record of numbers, made once, so a read allocates
nothing. `ms` is clamped to the phase. To follow a model's progress, pass
`progress * timeline.durationMs[phase]`.

`readPhase` is a building block for the player: to carry on smoothly after a
phase was left early, it reads the current phase, then reads the phase it
left again, at the point where it left (section 5.2).

**Used on its own**, a timeline suits a view that draws in its own way, or
computes poses rather than setting container properties, such as the
puzzles' pointer walkthrough (section 8.5).

## 4. Layer 2: the animation

### 4.1 Creating one

```ts
interface Animation<P extends string, S extends string, T extends string> {
    readonly timeline: Timeline<P, S>;
    /** Sets each target's properties from a reading: the building block for the player. */
    apply: (reading: StepReading<S>, targets: AnimationTargets<T>) => void;
    /** Sets them at `progress` through `phase`: on its own, from a model's progress. */
    applyAt: (phase: P, progress: number, targets: AnimationTargets<T>) => void;
    /** The definition, as data. Throws, naming the property, if it holds code (section 7). */
    readonly data: AnimationData;
}

createAnimation({
    timeline,     // a Timeline, or TimelineData
    properties,   // each target's properties, by target name, then by property
})
```

`targets` holds a `Container` for each target name, and may hold other fields
too. Make it once, not in each refresh. For a one-phase timeline, `applyAt`
takes no phase.

### 4.2 Property values

| Property | |
| --- | --- |
| `x`, `y` | Position |
| `alpha` | Opacity, from 0 to 1 |
| `autoAlpha` | Opacity, and `visible` while it is above 0 |
| `visible` | Shown or hidden |
| `scale` | Uniform scale. It sets both axes |
| `scaleX`, `scaleY` | Scale on one axis |
| `rotation`, `angle` | Rotation, in radians or in degrees |
| `skewX`, `skewY` | Skew, in radians |
| `pivotX`, `pivotY` | The pivot, in the container's own pixels |
| `width`, `height` | Size, in the parent's pixels |

A value is one of these:

- **A number** holds the property still.
- **A keyframe track**, `keyframes(from, { step: to | { to, ease } })`. The
  value starts at `from`. Each key moves it towards `to` as its step runs,
  from wherever the value is, in the order the keys are written:
  `value = lerp(value, to, ease(progress))`. So a key whose step starts
  before the key before it has ended carries on from part-way, as a GSAP
  tween from the current value does. On a property that switches, such as
  `visible`, a key switches when its step starts; pair it with an instant
  step to switch at another step's end.
- **A formula**, `(reading, targets) => number`. Code only.

A target may also have `apply: (target, reading, targets) => void`, which sets
anything else, after the properties. Code only.

`createAnimation` throws if a key names no step, if a target has an unknown
property, or if a target sets two properties that fight: `scale` with
`scaleX` or `scaleY`, `scaleX` with `width`, `scaleY` with `height`,
`rotation` with `angle`, or `alpha` or `visible` with `autoAlpha`. It throws
whether the values are formulas or numbers, since a fixed number fights a
formula just as much. It can't see what `apply` writes, so `apply` runs last
and wins.

Each call fills one reading, and all the formulas share it. The next call
fills the same record, so a formula must not keep it.

### 4.3 Eases

An ease is one of:

- A name: `linear`, `quadIn`, `quadOut`, `quadInOut`, and the same for
  `cubic`, `quart`, `sine`, `expo`, `back` and `elastic`.
- A cubic Bezier, `[x1, y1, x2, y2]`, as in CSS.
- A function, `(progress: number) => number`. Code only.

A key with no ease is linear.

**Used on its own**, an animation is the path for views that follow the
model's progress: `animation.applyAt(phase(), progress(), targets)` in
refresh, with no update step at all (section 8.4). It can live at module
level and be shared. Data captured for a run rides along as extra fields on
`targets`, which formulas receive.

## 5. Layer 3: the player

### 5.1 Creating one

```ts
interface AnimationPlayer<P extends string> {
    /** The phase it's in, how long it has been in it, and how far through it, from 0 to 1. */
    readonly phase: P;
    readonly elapsedMs: number;
    readonly progress: number;
    /** False while it waits in a phase with no length, or at the end of the last phase. */
    readonly isPlaying: boolean;
    /** Plays from the start of `phase`, or of the first phase. */
    play: (phase?: P) => void;
    /** Moves the current phase on, and moves on to the next phase as one ends. An update of 0 changes nothing. */
    update: (deltaMs: number) => void;
    /** Sets the targets' properties for where it is now. */
    apply: () => void;
}

createAnimationPlayer({
    animation,   // an Animation, or AnimationData
    targets,     // the containers, by name
})
```

A view makes one player, calls `play` from a reaction, `update` from its
update step, and `apply` from its refresh step. Two calls, because of the MVT
rule that `update` moves presentation state on and `refresh` writes all
output. For a one-phase timeline, `play` takes no phase.

### 5.2 How a player moves

- **It starts at the end of its last phase.** A run that hasn't happened
  reads as finished, so a banner made in `closed` holds the closing's end
  pose, and is hidden by it.
- **A phase with a length plays, then moves on to `next`.** Any time left
  over in the update carries into the next phase.
- **A phase with no length waits** until `play` is called. So does the last
  phase, at its end.
- **Leaving a phase early carries on smoothly.** If `play` moves on to a
  later phase before the current one has ended, the phase left reads where
  it got to, not as ended. Keyframes then carry on from there. Playing an
  earlier phase starts a new cycle, and forgets where phases were left.
- **No callbacks.** A view that must act when a player finishes or changes
  phase watches `phase` or `isPlaying` with `createReaction`.

Formulas in a player's animation can close over the view's own variables,
since the player is made in the view. Captured data is just a `let`.

### 5.3 The common case, inline

```ts
const player = createAnimationPlayer({
    targets: { banner },
    animation: {
        timeline: { phases: { ... } },
        properties: { banner: { ... } },
    },
});
```

The definitions nest two levels deep. That makes the layers visible, at the
cost of some indentation (open question 4).

## 6. Decisions argued

### 6.1 Easing on the animation, not the timeline

The outline put `ease` on each step. This proposal moves it to each keyframe:

- **One step often drives properties that want different curves.** Kwazy
  Cactii's `bannerIn` slides in with an overshoot (`easeOutBack`) but fades in
  linearly; an overshoot on alpha would be wrong. With easing on the step,
  that takes two steps with the same timing.
- **It keeps the timeline purely about time.** Anything that reads a timeline
  alone, such as a custom drawing, or a sound lined up with a step, gets plain
  progress, and eases it if it wants to.
- **It's the CSS and Web Animations model**, where easing belongs to each
  keyframe interval, and GSAP's, where it belongs to each tween.
- **The timeline holds no functions,** so it is pure data.

The cost: when three properties share a step and an ease, the ease is written
three times. A shared constant fixes that.

### 6.2 A duration and a start, which may follow another step

- **Durations are the numbers people tune.** "Make the fade 300 ms" changes
  one number. With a start and an end it changes one, and with a following
  step it changes two.
- **Chaining is common.** Kwazy Cactii's `bannerHold` starts where `bannerIn`
  ends (317 = 150 + 167), and `bannerOut` where `bannerHold` ends. The pointer
  walkthrough adds its start times up in a loop. With `after`, retuning one
  step moves the steps that follow it.
- **It's one optional field,** not GSAP's language of position strings
  (`"<"`, `"+=100"`, labels), and it stays data, because it is a step's name.

### 6.3 Where each idea lives

| Concept | Layer | Why |
| --- | --- | --- |
| Repeat and yoyo on a step | 1 | Timing: the step's progress runs 0 to 1 several times, or there and back. CSS (`iteration-count`, `alternate`) and GSAP put them on timing too |
| Instant steps | 1 | A moment, for switching things |
| Phase order, length and `next`, looping phases | 1 | The phases' structure is data. Acting on it is the player's job |
| `loopProgress`, `yoyoProgress` | 1 | Helpers for time that isn't on a timeline, such as an endless shimmer |
| Keyframes, carrying on from part-way | 2 | They map progress to values |
| Easing | 2 | Section 6.1 |
| `autoAlpha` | 2 | A property, as in GSAP; it covers most "hide outside the step" cases |
| Formulas and `apply` | 2 | The way out to code |
| Playing, waiting, moving on, carrying on after leaving a phase early | 3 | They need state |
| Speed, playing backwards, seeking | 3, later | Only if two entries need them |

Some presentation state stays outside all three layers. A value that chases a
target, such as Neon Monsoon's boss health bar, has no start and no shape: it
is a filter, and plain code suits it. A two-way switch that can reverse at
any moment, such as a hover, is best served by `createBooleanTween`, which
could expose its `progress` so that an animation shapes it (section 9).

## 7. Data

Every layer is data first:

- **Timeline.** `TimelineData` is the definition itself: numbers and step
  names. `createTimeline` checks it as it is built, so a bad file throws.
  `timeline.data` hands it back.
- **Animation.** `AnimationData` is `{ timeline: TimelineData, properties }`.
  A property is a number or a keyframe track, and `keyframes()` returns a
  track's data form, `{ from, keys: [{ step, to, ease? }] }`, with keys in an
  array because their order matters. An ease is a name or a Bezier. Targets
  are matched by name, so a file never holds containers. `animation.data`
  throws, naming what is code, if any formula, `apply` or ease function is
  used.
- **Player.** State, never data.

The rule: whatever is written as data round-trips exactly, and code is the
stated exception. A future editor could then edit any animation that keeps
to keyframes and named eases. A `version` field can wait until the format
first changes, and a JSON Schema can be generated from the types if an editor
ever wants one. Section 8.6 shows one exported.

## 8. Worked examples

Each example ports code that exists today, except the banner in phases
(sections 8.3 and 8.4), which is the outline's own example.

### 8.1 Fuel Run's section announcement: a player of steps

Today, the view keeps a sequence, restarts it from a reaction, and works its
alpha out by hand (`sequence.isActive ? (fade.isActive ? 1 - fade.progress : 1) : 0`).
It hides its text outside the sequence too.

```tsx
export function SectionAnnouncementView(bindings: SectionAnnouncementViewBindings): Container {
    // Presentation state: the name being announced
    let text = '';
    const content = (
        <container x={bindings.screenWidth / 2} y={Math.round(bindings.screenHeight * 0.25)}>
            <PixelTextView text={() => text} color={LABEL_COLOR} scale={2} anchorX={0.5} anchorY={0.5} />
        </container>
    );
    const announcement = createAnimationPlayer({
        targets: { content },
        animation: {
            timeline: {
                steps: {
                    display: { durationMs: DISPLAY_DURATION_MS },
                    fade: { after: 'display', durationMs: FADE_DURATION_MS },
                },
            },
            properties: {
                content: { autoAlpha: keyframes(1, { fade: 0 }) },
            },
        },
    });
    const announceWhenSectionChanges = createReaction({ watch: bindings.sectionIndex, react: announce });
    // The view is made as the run starts, so the first section is announced now
    announce(bindings.sectionIndex());

    return <container onUpdate={update} onRefresh={announcement.apply}>{content}</container>;

    function update(deltaMs: number): void {
        announceWhenSectionChanges();
        announcement.update(deltaMs);
    }

    function announce(sectionIndex: number): void {
        text = SECTION_NAMES[sectionIndex] ?? '';
        announcement.play();
    }
}
```

Before the first `play`, the player is at its end, where `fade` reads 1, so
the content is hidden. Fuel Run's death flash, a `createEdgeTween` today,
becomes the same shape with one step: `{ flash: { durationMs: 200 } }` and
`alpha: keyframes(1, { flash: 0 })`, played from a reaction to `isDying`.

### 8.2 Kwazy Cactii's match effects: one timeline, a player in each layer

The match timeline moves out of the views into a file of its own, since six
views share it. Chaining replaces the hand-added start times:

```ts
export const MATCH_TIMELINE = createTimeline({
    steps: {
        flashIn:        { durationMs: 35 },
        flashOut:       { after: 'flashIn', durationMs: 82 },
        fade:           { durationMs: 433 },
        shake:          { startMs: 67, durationMs: 500 },
        dust:           { startMs: 150, durationMs: 500 },
        popupAppears:   { startMs: 217, durationMs: 0 },
        popup:          { after: 'popupAppears', durationMs: 567 },
        stars:          { startMs: 283, durationMs: 783 },
        zoom:           { durationMs: 1000 },
        fireworkLaunch: { startMs: 150, durationMs: 200 },
        fireworkBurst:  { after: 'fireworkLaunch', durationMs: 433 },
        bannerIn:       { startMs: 150, durationMs: 167 },
        bannerHold:     { after: 'bannerIn', durationMs: 283 },
        bannerOut:      { after: 'bannerHold', durationMs: 217 },
    },
});
```

`flash` became two steps, so that its peak at 30% is timing, not arithmetic.
The firework launch now ends where the burst starts (section below).

`BoardView` no longer owns a sequence. Each layer makes its own player and
plays it from its own reaction to the board's phase. All the reactions run on
the same tick, and every player gets the same `deltaMs`, so the layers stay
in step without sharing a clock.

**The flash overlay.** Its peak depends on the cascade, captured as the match
begins. The formula rests at 0 before `flashIn` and after `flashOut`, so it
needs no `inactive` callback:

```ts
let peakAlpha = 0;
const flashPlayer = createAnimationPlayer({
    targets: { flash },
    animation: {
        timeline: MATCH_TIMELINE,
        properties: {
            flash: { alpha: (r) => peakAlpha * (r.flashIn - r.flashOut) },
        },
    },
});
const playFlashWhenMatching = createReaction({
    watch: bindings.phase,
    when: 'matching',
    react: () => {
        peakAlpha = Math.min(MAX_FLASH_ALPHA, BASE_FLASH_ALPHA + (bindings.cascadeStep() - 1) * FLASH_CASCADE_BONUS);
        flashPlayer.play();
    },
});
setUpdate(view, (deltaMs) => {
    playFlashWhenMatching();
    flashPlayer.update(deltaMs);
});
setRefresh(view, flashPlayer.apply);
```

**The shake and zoom.** Both formulas rest at the board's centre and at a
scale of 1 at both ends of their steps, since `1 - r.shake` and
`sin(r.zoom * PI)` are 0 there:

```ts
properties: {
    content: {
        x: (r) => CENTRE_X + Math.sin(r.shake * SHAKE_FREQUENCY) * shakeAmp * (1 - r.shake),
        y: (r) => CENTRE_Y + Math.cos(r.shake * SHAKE_FREQUENCY * 0.7) * shakeAmp * 0.6 * (1 - r.shake),
        scale: (r) => 1 + zoomAmp * Math.sin(r.zoom * Math.PI),
    },
},
```

`shakeAmp` and `zoomAmp` are captured from the cascade as the match begins,
with `zoomAmp` 0 below the zoom's least cascade.

**The score popup.** The instant step shows it at full strength as its step
starts; `quadIn` gives today's `1 - progress ** 2`. Its text, place and rise
are captured as the match begins:

```ts
properties: {
    popupText: {
        autoAlpha: keyframes(0, { popupAppears: 1, popup: { to: 0, ease: 'quadIn' } }),
        y: (r) => -rise * r.popup,
    },
},
```

**The fireworks.** The particles are a pool, so `apply` places them, from
launch geometry captured as the match begins. The burst starts from the
launch's peak, worked out, not read back:

```ts
properties: {
    fireworks: {
        visible: (r) => showsFireworks && r.fireworkLaunch > 0 && r.fireworkBurst < 1,
        apply: (_fireworks, r) => {
            for (let i = 0; i < count; i++) {
                const g = gfxPool[i];
                const launch = r.fireworkLaunch;
                const burst = r.fireworkBurst;
                g.position.set(
                    launchX[i] + (peakX[i] - launchX[i]) * launch + burstDx[i] * burst,
                    launchY[i] + (peakY[i] - launchY[i]) * launch + burstDy[i] * burst + BURST_GRAVITY * burst * burst,
                );
                g.alpha = burst > 0 ? 1 - burst : 0.7 + 0.3 * launch;
                g.scale.set(burst > 0 ? 1.2 - burst * 0.7 : 0.8 + 0.7 * launch);
            }
            for (let i = count; i < FIREWORK_POOL_SIZE; i++) gfxPool[i].alpha = 0;
        },
    },
},
```

`visible` there is a formula returning a boolean, which a property that
switches accepts.

One change of look to playtest: today the burst starts 150 ms before the
launch ends, from wherever the particles have got to. Here the launch is
200 ms instead of 350, and the burst starts from its peak. Keeping today's
look takes a formula that holds the launch at its share at the burst's start,
a number the timeline knows.

### 8.3 A banner in phases, on the view's own time

The model reports only that a big combo happened. The view opens the banner,
holds it for 1.5 s, and closes it:

```ts
const banner = createAnimationPlayer({
    targets: { content, message },
    animation: {
        timeline: {
            phases: {
                opening: {
                    steps: {
                        fadeIn: { durationMs: 500 },
                        messageGrowIn: { durationMs: 800 },
                        messageFadeIn: { durationMs: 1000 },
                    },
                },
                open: { durationMs: 1500 },
                closing: {
                    steps: {
                        messageGrowOut: { durationMs: 500 },
                        messageFadeOut: { durationMs: 500 },
                        fadeOut: { durationMs: 1000 },
                    },
                },
                closed: {},
            },
        },
        properties: {
            content: {
                autoAlpha: keyframes(0, { fadeIn: 1, fadeOut: 0 }),
            },
            message: {
                scale: keyframes(0.5, {
                    messageGrowIn: { to: 1, ease: 'cubicOut' },
                    messageGrowOut: { to: 1.5, ease: 'cubicIn' },
                }),
                alpha: keyframes(0, {
                    messageFadeIn: { to: 1, ease: 'quadOut' },
                    messageFadeOut: 0,
                }),
            },
        },
    },
});

const showBannerWhenComboIsBig = createReaction({
    watch: bindings.bigCombos,
    when: increased,
    react: () => {
        messageText.text = describeCombo(bindings.cascadeStep());
        banner.play('opening');
    },
});
setUpdate(view, (deltaMs) => {
    showBannerWhenComboIsBig();
    banner.update(deltaMs);
});
setRefresh(view, banner.apply);
```

The player runs `opening`, then `open` for 1.5 s, then `closing`, and waits in
`closed`, whose pose is the closing's end: hidden. To keep the banner open
until something closes it, write `open: {}` and call `banner.play('closing')`
when it should close.

**Leaving the opening early.** Suppose `play('closing')` comes 300 ms into the
opening. The opening's steps read where they got to:

| Step | Linear | Eased | Value it left |
| --- | --- | --- | --- |
| `fadeIn` | 300 / 500 = 0.6 | linear, 0.6 | content alpha 0.6 |
| `messageGrowIn` | 300 / 800 = 0.375 | `cubicOut`, 0.756 | message scale 0.5 + 0.5 x 0.756 = 0.878 |
| `messageFadeIn` | 300 / 1000 = 0.3 | `quadOut`, 0.51 | message alpha 0.51 |

The closing's keys then move each value on from there: the content fades
from 0.6 to 0, the message grows from 0.878 to 1.5. Nothing jumps.

### 8.4 The same banner, from the model's progress

When the model owns the banner's phases and their timing, the view uses an
animation alone. The definition is the same, so it can live at module level:

```ts
const animateBanner = createAnimation({ timeline: BANNER_TIMELINE, properties: BANNER_PROPERTIES });

// In the view: refresh only, no update step
const targets = { content, message };
setRefresh(view, () => {
    animateBanner.applyAt(bindings.phase(), bindings.progress(), targets);
});
```

Here the timeline's milliseconds only set the steps' proportions: the
model's phase lengths decide the real time. A phase left early reads as
ended, so if that would jump, the model keeps the banner in the phase until
its steps can end.

### 8.5 The puzzles' pointer walkthrough: a timeline alone

The walkthrough's arrow is a pose (where it is, whether it is pressed, how far
a ripple has spread) that a view model computes and a view draws. It sets no
container properties directly, so it uses a timeline alone. Its legs come from
the puzzle, so the step names are built from data, typed as `string`:

```ts
function timeLegs(legs: readonly Leg[]): Timeline<string> {
    const steps: Record<string, StepData> = {};
    let previous: string | undefined;
    for (let i = 0; i < legs.length; i++) {
        const { name, ms, ripples } = legs[i];
        steps[name] = { after: previous, durationMs: ms };
        if (ripples === true) steps[toRippleName(name)] = { after: previous, durationMs: RIPPLE_MS };
        previous = name;
    }
    steps.pause = { after: previous, durationMs: PAUSE_MS };
    return createTimeline({ steps });
}

// In the view model
update(deltaMs) {
    // The show starts over once it has run, pause and all
    elapsedMs = (elapsedMs + deltaMs) % show.timeline.durationMs;
},
pose() {
    show.timeline.read(reading, elapsedMs);
    // ... each leg's reading[leg.name], as today's step.progress
},
```

`after` replaces the loop that adds the start times up. The pause becomes a
step, so the show's length includes it.

### 8.6 An animation as data

Fuel Run's section announcement (section 8.1) holds no code, so
`announcementAnimation.data` is:

```json
{
    "timeline": {
        "steps": {
            "display": { "durationMs": 2000 },
            "fade": { "after": "display", "durationMs": 500 }
        }
    },
    "properties": {
        "content": {
            "autoAlpha": { "from": 1, "keys": [{ "step": "fade", "to": 0 }] }
        }
    }
}
```

`createAnimationPlayer({ animation: thatJson, targets: { content } })` plays
it. Kwazy Cactii's flash overlay could not be exported: its alpha is a
formula over a captured value, and `data` would throw, naming `flash.alpha`.

## 9. What it replaces

| Tool | Users today | What happens |
| --- | --- | --- |
| `createSequence` | Kwazy Cactii's `BoardView` (and `PiecesView` through a binding), Fuel Run's section announcement, the pointer view model, three book examples, the time-and-motion cheat sheet | Ported to a player, or a timeline alone, then retired |
| `createSequenceTracker` | Kwazy Cactii's five layers, the book's celebration view | Ported to players, then retired |
| `createEdgeTween` | Fuel Run's death flash, the book's player HUD | A one-step player, then retired |
| `createBooleanTween` | The book's player HUD | Stays. It could expose `progress`, so that an animation shapes a two-way switch |

The book teaches the current tools in
[Chapter 18](../../packages/sites/docs/chapters/18-growing-a-complex-view.md),
and names them in the glossary and the project structure page. Those pages,
the playground's book examples and the cheat sheet change with the port. The
three tools are published in `@mvtjs/utils`, so retiring them is a breaking
change, with a changeset.

## 10. Costs and risks

- **Three layers is more to learn than one.** The common case only meets the
  player, written inline, but the docs have to explain why the other two
  exist. The layering is the reason a timeline can be shared and an animation
  exported, so the docs should show those, not just state them.
- **Two ways to animate.** The rule is short: if the model owns the time,
  apply an animation at its phase and progress; if the view owns it, use a
  player.
- **Pressure to grow the player.** Speed, playing backwards, seeking, and
  "when finished" callbacks will be asked for. Each pushes the player back
  towards `createSequence`. The player should take them only when two entries
  need them, and callbacks not at all.
- **A player in each layer instead of one clock.** Kwazy Cactii goes from one
  sequence to six players. Each is small (a phase index, a time, a reading),
  but a pool of many animated items, one player each, should be measured
  before it is recommended.
- **Formulas can't be exported.** That is by design, but it means "data
  first" holds only as far as authors stick to keyframes. Kwazy Cactii's
  effects mostly won't.

## 11. Open questions

1. **`after` across phases?** This proposal keeps it within a phase, since the
   phases already run in order.
2. **Ease names.** Plain names (`quadOut`) or GSAP's (`power1.out`)? The repo
   uses GSAP elsewhere, but plain names don't tie a data file to GSAP.
3. **Staggered pools,** such as rings of dust or firework particles. A track
   that takes an item's index, or one player per item? Wait for a second
   entry that needs it.
4. **How the options nest.** Inline, a player's definition nests two levels
   (`animation: { timeline: { phases } }`). A flatter form for the player is
   easy to add.
5. **Names.** `play` or `start` (to match `startNewRun()`)? `properties`, or
   something shorter? `applyAt`?
6. **The shared reading.** `apply` and `applyAt` reuse one reading inside
   each animation. That is safe while calls don't nest, which a formula
   calling another animation's `applyAt` would break.

## 12. Implementation steps

To be settled after the discussion. A likely order:

1. Layer 1, `createTimeline`, with its tests: chaining, repeat and yoyo,
   instant steps, phases, `read` and `readPhase`, and the errors.
2. Layer 2, `createAnimation`, its keyframes, eases and the Pixi property
   list, with tests that apply poses to plain containers.
3. Layer 3, `createAnimationPlayer`, with tests driven by `update`.
4. Port Kwazy Cactii's board layers and Fuel Run's two views, and playtest.
5. Port the pointer walkthrough and the book's examples, update Chapter 18,
   the glossary and the cheat sheet, and retire the three old tools.
