# Sound and Music

> Sound, like visuals, is part of presentation. So in MVT, views play sounds
> when the model's state changes. A view that plays sounds instead of drawing
> visuals is called an audio view. Like any other view, it reads the model's
> state through its bindings. The model does not need to know about sound at
> all.
>
> This page shows how to write audio views, what the model needs to expose
> for them, and how to test them. It also covers music and other sounds that
> last over time.

**Related:** [Views](views.md) · [Bindings](bindings.md) ·
[Presenting Collections](collections.md) ·
[Change Detection](../reacting-to-changes/change-detection.md) ·
[Presentation State](../adding-visual-polish/presentation-state.md) ·
[Testing Views](../iterating-with-confidence/testing-views.md) ·
[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/audio/docs/using-the-audio80.md) ·
[Writing Tracker Music](https://github.com/yortus/mvt-games/blob/main/packages/audio/docs/writing-tracker-music.md)

---

*Assumes familiarity with [Views](views.md), [Bindings](bindings.md) and
[Change Detection](../reacting-to-changes/change-detection.md).*

## Sound Is Presentation

A view turns domain state into output. The output is usually a picture,
but MVT does not mind what it is. It can be a DOM element, a log in a
test, or a speaker. The model and the view divide the work as they do for
pictures:

| The model says | The view decides |
| --- | --- |
| The ship is dying | Which crash to play, how loud, and whether the music stops |
| Shots fired: 12 | That the 12th is a zap, and that two in one tick make one zap |
| The stage is being played | Which tune, at what tempo, and when it hurries |
| Rocks left: 3 | That the heartbeat quickens |

A model that played sounds would tie its domain logic to one way of
presenting it, just as a model that drew sprites would. A model that only
holds domain state can be presented in any way. Another view could give it
different sounds. A test, a thumbnail or a benchmark can run it with no
sound at all.

## Audio Views

An **[audio view](../../reference/glossary.md)** is a view that plays
sounds instead of drawing visuals. Like any other view, it reads model state
through its bindings. It also needs something to play its sounds on, such
as a sound chip. That is passed in as a binding too, named `sound` in the
example below. The sound player stays the same for the view's whole life,
so the view reads that binding only once. In its refresh step, the view
polls its other bindings. It plays a sound when some sound-triggering
change has occurred.

This audio view plays a shot each time the ship fires, and a crash when
the ship is lost:

```ts
import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { SHIP_EXPLODE, SHOT } from './sounds';

export interface ShipAudioViewBindings {
    /** The sound output. The view reads it once. */
    readonly sound: Audio80;
    /** Shots fired this game. Each rise is a shot. */
    readonly shotsFired: () => number;
    readonly isAlive: () => boolean;
}

export function ShipAudioView(bindings: ShipAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    const watcher = watch({
        shots: bindings.shotsFired,
        isAlive: bindings.isAlive,
    });
    // The first refresh hears only what changes after the view is made
    watcher.poll();

    setRefresh(view, () => {
        const w = watcher.poll();
        if (w.shots.increased) sound.play(SHOT);
        if (w.isAlive.changed && !w.isAlive.value) sound.play(SHIP_EXPLODE);
    });
    return view;
}
```

`SHOT` and `SHIP_EXPLODE` are sound effects. Each is made once, as its
module loads, with `createSoundEffect` from `@mvtjs/audio`.

The game's view adds the audio view as a child, beside the views that draw
the ship. It is ticked with them, and nothing about it is special to the
ticker:

```ts
view.addChild(
    ShipAudioView({
        sound,
        shotsFired: () => model.ship.shotsFired,
        isAlive: () => model.ship.isAlive,
    }),
);
```

The view plays a sound when a value *changes*.
For example, it plays the crash once, as `isAlive` turns false. It does not
play it again on each refresh while the ship stays lost. Two useful
properties follow from that:

- **A refresh with no change plays nothing.** A second refresh in the same
  tick plays nothing again. So a view can still be refreshed at any time,
  as usual.
- **A paused game is quiet.** The game loop still refreshes a paused
  game's views, to show them. No state changes, so no sound starts.

::: info Project convention
This repo's audio views play on the **Audio80**, from `@mvtjs/audio`. The
Audio80 is a virtual sound chip, which is a sound chip simulated in code.
It is modelled on the chips in 1980s home computers. The Arcade, this
repo's home page, gives one to each game as `sound`, in the game's start
options. Any sound library would do. MVT asks only that views play the
sound, not models, and that they play it from state they poll.
[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/audio/docs/using-the-audio80.md)
covers the chip.
:::

## Finding the Moment

A sound belongs to a moment, such as a shot being fired, the player dying,
or a coin being collected. The view has to find that moment in the state it
polls.

| The moment | The model exposes | The view plays when |
| --- | --- | --- |
| A state begins: dying, a stage cleared | A phase or a flag | It changes to that value |
| Something that can repeat: a shot, a coin | A **[count](../../reference/glossary.md)** | It rises (`increased`) |
| Several at once: rocks breaking in one tick | A count, and the last one's details | It rises, once for the tick |

Most moments change a phase, such as the ship going from flying to dying.
But firing a laser does not change any phase. The ship is flying before it
fires, and still flying after, so its phase never changes. Instead, the
model counts the shots fired, and the view plays a zap sound each time the
count rises.
[Change Detection](../reacting-to-changes/change-detection.md#counts-moments-that-repeat)
covers counts in full.

**The first poll.** `watch()` reports every value as changed on its first
poll. So poll once as the view is made, as above. Skip that poll only when
the starting state should sound, such as a fanfare as the game begins.

**Two changes, one moment.** Sometimes one moment changes two values in the
same tick. Suppose a ship that comes back also gets a full tank, in the
tick its phase returns to playing. A view that played a respawn for the
phase and a refuel for the fuel would play two sounds for one moment. The
surest fix is for the model to count the moment itself, such as
`fuelTanksDestroyed`, so that the view plays the refuel only when that
count rises. Otherwise, read the two values together, and play one sound.

## What the Model Needs to Expose

Usually the model needs nothing new, because most moments are already a
phase. When a model does add something for sound, it adds plain state,
named for the domain:

- **A count** for each kind of moment that repeats (`shotsFired`,
  `rocksBroken`). The model resets it for a new game.
- **The last one's details**, when the sound depends on them
  (`lastBrokenRockSize`).

Things removed in the tick they finish need extra care. Suppose a rock
breaks, and the model removes it from its `SlotList` in the same tick. The
rock's view in the `<List>` never sees the break, because the slot is
already empty at the next refresh. So the model counts the breaks, and a
view outside the list watches the count.

## Audio Views in a List

A `<List>` makes the view for a slot once, when an item first fills the
slot. It then reuses that view for every later item in the slot. The
view's watcher stays with the slot too. So when a new item arrives, the
next poll compares the new item's values with the old item's, and reports
any difference as a change.

A poll at construction is not enough here, because it covers only the
slot's first item. Instead, play only on changes that a newly arrived item
cannot cause. For example, a new item always arrives alive. So `isAlive`
going from `true` to `false` is always a real loss:

```ts
if (w.isAlive.changed && w.isAlive.previous === true) sound.play(EXPLODE);
```

If there is no such change to rely on, also watch a binding that
identifies the item, such as an id. Play nothing in a poll where the id
changed. [Presenting Collections](collections.md#two-rules-for-item-views)
explains why a slot's view must not rely on what it saw at construction.

## Sound Over Time

Some sound lasts across many ticks. Examples are a tune, a heartbeat that
quickens as the rocks thin out, and an engine's rumble while the ship
thrusts. When the model does not track such a sound, it is the view's
**[presentation state](../../reference/glossary.md)**. Presentation state
is state a view keeps for its own output, which no domain outcome depends
on. It follows the usual split:

| Step | What it does |
| --- | --- |
| Update | Advances the presentation state, such as the tune's place or the beats so far |
| Refresh | Plays what is due, such as the next notes or a sound for each new beat |

A **[metronome](../../reference/glossary.md)** from `@mvtjs/utils` suits
a heartbeat. It counts beats at a tempo the view can change, and plays
nothing itself. The view sets its `periodMs` in the update step, or sets
it to 0 to stop it. The refresh step plays a sound each time the
metronome's `count` rises:

```ts
import { createMetronome, watch } from '@mvtjs/utils';

const heartbeat = createMetronome();
const watcher = watch({ beats: () => heartbeat.count });
// Without this poll, the first refresh would miss the first beat
watcher.poll();

setUpdate(view, (deltaMs) => {
    heartbeat.periodMs = computeBeatPeriodMs(bindings.rocksLeft());
    heartbeat.update(deltaMs);
});
setRefresh(view, () => {
    if (watcher.poll().beats.increased) sound.play(BEAT);
});
```

A metronome beats as soon as it starts, which is in the view's first
update step. The poll at construction records a count of 0, so the first
refresh sees the rise to 1. Without that poll, the first refresh's poll
would take 1 as the starting count, and the first beat would be silent. So
poll at construction whenever the view's own first update can cause a
change.

A **music player** from `@mvtjs/audio` keeps a tune's place in the same
way. The view calls `MusicPlayer.update` in its update step. It calls
`MusicPlayer.refresh` at the end of its refresh step, after any call that
starts a song. A new song cuts the old one short, because
`MusicPlayer.play` releases the song playing and cancels any song queued.
So a jingle played as a phase begins stops when the next phase plays its
own song. Keep each such jingle no longer than its phase. A test can check
this with `computeSongDurationMs`, which returns how long one pass through
a song lasts.

Only the update step moves the tune and the heartbeat on. A paused game's
views sit out the update step, so both stop while the game is paused. They
carry on from the same place when it resumes.

## Time

A model's time is the ticks, never the wall clock. Sound keeps the same
time. In this repo, the game loop advances the Audio80's clock by the
models' `deltaMs` each tick. Each note is stamped with the chip's time,
and the chip plays it at that time. That has three results:

- Pausing the game pauses its sound, including notes already playing.
- A tune keeps its tempo, however uneven the frames.
- The same ticks always make the same sound, so the sound can be tested.

Sound effects are the exception. They play as soon as they arrive, not at
their stamped time, so that a shot is heard in the frame it is seen.

## Testing

An audio view is tested like any other view. The test drives its bindings,
ticks the view and checks what it wrote. Here the output is a log of what
the view told the chip to play. A headless chip, from
`@mvtjs/audio/headless`, records every write and plays nothing. The test
advances the chip's clock with `AudioControls.update`, as a game loop
would:

```ts
import { expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { ShipAudioView } from './ship-audio-view';
import { SHOT } from './sounds';

it('plays a shot each time the ship fires', () => {
    const { audio80, controls } = createHeadlessAudio80({ record: true });
    const state = { shots: 0 };
    const view = ShipAudioView({
        sound: audio80,
        shotsFired: () => state.shots,
        isAlive: () => true,
    });

    state.shots++;
    controls.update(1000 / 60);
    refreshView(view);
    const shot = expect.objectContaining({ kind: 'play', effect: SHOT });
    expect(audio80.log).toContainEqual(shot);
});
```

The sounds themselves can have audio tests. An audio test renders a sound
in memory and compares a hash of its samples with a saved one. A change
that alters the sound then fails the test, until someone has listened to it
and updated the saved hash. See
[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/audio/docs/using-the-audio80.md#testing-and-listening).
A view's pictures have the same kind of test, described in
[Visual Tests](../iterating-with-confidence/visual-tests.md).

## Common Mistakes

| Mistake | What goes wrong | Instead |
| --- | --- | --- |
| Playing sound from the model | The model is tied to one presentation, and its tests and thumbnails make noise | Expose state, and let an audio view play it |
| Playing on a state, not a change (`if (isDying) play()`) | The sound plays every frame | Play when the value changes to that state |
| Playing a sound in the update step | The update step advances state and writes no output | Advance state there, and play in the refresh step |
| Forgetting the poll at construction | A sound plays as the view is made, or the first beat is silent | Poll once at construction |
| Using an event emitter for sounds | Events are missed while a view is made or a game is paused, and the model gains an API | Keep a count that the view watches |
| Watching for a list item's removal | The removed item's view never sees it | Keep a count in the model, and play it from a view outside the list |
| Playing a list view's sound on any change | A sound plays when a new item fills the slot | Play only on changes a new item cannot cause |
| Playing a sound for each of two values that change together | Two sounds play for one moment | Count the moment in the model, or read the values together |
| A jingle in a phase shorter than the jingle | The next phase's song cuts it short | Shorten the jingle, or lengthen the phase |
| A wall-clock timer for a repeating sound | It ignores pausing, and drifts from the game | Use presentation state advanced in the update step, such as a metronome |

## Going Further

The audio package has two guides. They cover what this page leaves out.

- **[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/audio/docs/using-the-audio80.md)**
  covers getting a chip, designing sound effects and instruments, music,
  repeating sounds, the balance of music and effects, and testing.
- **[Writing Tracker Music](https://github.com/yortus/mvt-games/blob/main/packages/audio/docs/writing-tracker-music.md)**
  shows how to write songs in tracker notation. A tracker writes music as a
  grid of text, with a row for each moment in time and a column for each
  voice of the chip.
