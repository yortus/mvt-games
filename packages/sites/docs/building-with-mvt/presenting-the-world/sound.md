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
[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/using-the-audio80.md) ·
[Using the Audio90](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/using-the-audio90.md) ·
[Writing Tracker Music](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/writing-tracker-music.md)

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

The view's `sound` binding asks only for the one method it calls, `play`.
That's the whole of the view's output. So a test can pass a stand-in that
records each sound instead of playing it, as [Testing](#testing) shows.

This audio view plays a shot each time the ship fires, and a crash when
the ship is lost:

```ts
import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/chiptune';
import { watch } from '@mvtjs/utils';
import { SHIP_EXPLODE, SHOT } from './sounds';

export interface ShipAudioViewBindings {
    /** What the view plays its sounds on. The view reads it once. */
    readonly sound: Pick<Audio80, 'play'>;
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
module loads, with `createAudio80SoundEffect` from `@mvtjs/chiptune`.

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
- **A paused game starts no new sounds.** The game loop still refreshes a
  paused game's views, to show them. No state changes, so no sound starts.
  Whether the sounds already playing stop too depends on who keeps the
  sound's time. [Time](#time) explains.

::: info Project convention
This repo's audio views play on a virtual sound chip from `@mvtjs/chiptune`. A
virtual sound chip is a sound chip simulated in code. There are two. The
**Audio80** is modelled on the chips in 1980s home computers. The
**Audio90**, with sixteen stereo voices of FM, analog and samples, is in
the spirit of the 1990s. Each game names the chip it wants. The Arcade,
this repo's home page, gives it that chip as `sound`, in the game's start
options. Any sound library would do. MVT asks only that views play the
sound, not models, and that they play it from state they poll.
[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/using-the-audio80.md)
and [Using the Audio90](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/using-the-audio90.md) cover the chips.
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

A tune can work the same way. Its place in the song is then presentation
state. The view moves it on in the update step, and plays the notes that
are due in the refresh step. A view usually plays one song at a time, so a
new song cuts the old one off. A jingle that plays as a phase begins stops
when the next phase starts its own song. Keep each such jingle no longer
than its phase.

Only the update step moves the heartbeat on. A paused game's views sit out
the update step, so it stops while the game is paused, and carries on from
the same place when the game resumes. A tune's place works like that when
the view keeps it. Many sound libraries keep it themselves, as the next
section explains, and so do this repo's sound chips. Then the view's
presentation state is only which song plays, and how fast.

## Time

A model's time is the ticks, never the wall clock. Ideally, sound keeps the
same time, for the same reasons. When sound follows the ticks, pausing the
game pauses its sound, and the same ticks always make the same sound. But
whether it does depends on who keeps the sound's time, and that's up to
the sound library.

### When the Library Keeps the Time

Most sound libraries, such as Howler, `@pixi/sound` and the Web Audio API,
play on the audio device's clock. An audio view can start and stop a
sound, pause and resume it, and change its volume or speed. But once a
sound starts, it plays in real time, not with the game's ticks.

Everything above still holds. Audio views play on a change, and the advice
on finding the moment, counts and lists is the same. What changes is time:

- **Pausing is your job.** A paused game starts no new sounds, but the
  sounds already playing carry on, and so does the music. Pause them
  yourself, from the audio view as it sees the game pause, or from the game
  loop.
- **The library keeps the song's place.** So the view's presentation state
  is only which song should be playing. When the phase changes, the view
  starts the new song.
- **A test sees what the view started, but not its timing.** It can check
  that a shot played, but not when each of its notes sounded.

### When the Ticks Keep the Time

Some sound output takes its time from the game loop. The loop advances its
clock by the models' `deltaMs` each tick. Then sound behaves like
everything else in MVT:

- Pausing the game pauses its sound, including notes already playing.
- A tune keeps its tempo, however uneven the frames.
- The same ticks always make the same sound, so the sound can be tested.

This repo's sound chips work this way for the notes a game writes itself.
It's a choice, though, not how sound works in general. The
[Audio80 guide's "Time" section](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/using-the-audio80.md#time-the-chip-runs-on-game-time)
shows how its clock does it.

### When the Library Keeps the Time, and the Ticks Pause It

The sound has one need that the picture doesn't. A display can show a late
frame's picture a moment late, and almost nobody notices. A sound card
can't wait for a late frame. A block of sound it doesn't get in time is a
gap, and everybody hears it. So the music shouldn't wait for the game's
frames.

This repo's chips play their music a third way, as game audio engines do.
The chip's own sequencer keeps each song's place, where the sound is made,
on the sound card's clock. A frame that comes late, even by most of a
second, never holds the music up. The ticks still decide when it plays:

- **Pausing pauses the music.** When the ticks stop bringing time, the
  sequencer stops, and carries on when the game resumes.
- **The view decides what plays.** Which song, when it starts and stops,
  and how fast it goes are the view's presentation state. It sends them as
  it refreshes, as it writes any other output.
- **The same ticks still make the same notes.** A headless chip, which has
  no sound card, runs the same sequencer on the ticks. So a test can check
  each note a song played, and when.

What the chip reports of the music, such as the row playing, is what the
listener hears now, which trails what the view asked for by a moment. A
view that shows the music, as a tracker does, shows what is heard.

## Testing

An audio view is tested like any other view. The test drives its bindings,
refreshes the view, and checks what it wrote. Here the output is the
sounds the view played. The view's `sound` binding asks only for `play`, so
the test can pass a plain object that records each sound in an array. You
don't need a sound library at all:

```ts
import { expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { ShipAudioView } from './ship-audio-view';
import { SHOT } from './sounds';

it('plays a shot each time the ship fires', () => {
    const played: unknown[] = [];
    const sound = { play: (effect: unknown) => { played.push(effect); } };
    const state = { shots: 0 };
    const view = ShipAudioView({
        sound,
        shotsFired: () => state.shots,
        isAlive: () => true,
    });

    state.shots++;
    refreshView(view);
    expect(played).toEqual([SHOT]);
});
```

Check for the exact sound, as the last line does. Two sounds often start
alike, so a check that some sound played still passes when the view plays
the wrong one.

The sounds themselves can have audio tests, which catch a sound that
changes by accident. They do for sound what
[visual tests](../iterating-with-confidence/visual-tests.md) do for what a
view looks like. How you write one depends on your sound library.
[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/using-the-audio80.md#testing-and-listening)
shows them for this repo's chips.

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
| Expecting a pause to silence a library's sounds | Sounds already playing carry on, the music among them | Pause and resume them yourself, from the audio view or the game loop |

## Going Further

The audio package has three guides. They cover what this page leaves out.

- **[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/using-the-audio80.md)**
  covers getting a chip, designing sound effects and instruments, music,
  repeating sounds, the balance of music and effects, and testing.
- **[Using the Audio90](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/using-the-audio90.md)**
  helps you choose a chip. It shows you the Audio90's engines, samples,
  stereo sound effects and mix, with recipes for the sounds of the 1990s.
- **[Writing Tracker Music](https://github.com/yortus/mvt-games/blob/main/packages/libraries/chiptune/docs/writing-tracker-music.md)**
  shows how to write songs in tracker notation. A tracker writes music as a
  grid of text, with a row for each moment in time and a column for each
  voice of the chip.
