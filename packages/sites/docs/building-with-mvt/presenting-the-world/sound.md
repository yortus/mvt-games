# Sound and Music

> Sound, like visuals, is part of presentation. So in MVT, views play sounds
> when the model's state changes. A view that plays sounds instead of drawing
> visuals is called an audio view. Like any other view, it reads the model's
> state through its bindings. The model does not need to know about sound at
> all.
>
> This page shows how to write audio views, what the model needs to expose
> for them, and how to test them. It also covers music, sounds that repeat,
> and who keeps the sound's time.

**Related:** [Views](views.md) · [Bindings](bindings.md) ·
[Presenting Collections](collections.md) ·
[Change Detection](../reacting-to-changes/change-detection.md) ·
[Presentation State](../adding-visual-polish/presentation-state.md) ·
[Testing Views](../iterating-with-confidence/testing-views.md) ·
[audio90](https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/README.md)

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
as a sound chip. That is passed in as a binding too, named `sfx` in the
example below. The chip stays the same for the view's whole life, so the
view reads that binding only once. In its refresh step, the view calls its
[reactions](../reacting-to-changes/change-detection.md#reactions-do-something-when-a-value-changes).
A reaction reads a binding, and plays a sound when the value changes in a
way worth hearing.

The view's `sfx` binding asks only for the one method it calls, `play`.
That's the whole of the view's output. So a test can pass a stand-in that
records each sound instead of playing it, as [Testing](#testing) shows.

This audio view plays a shot each time the ship fires, and a crash when
the ship is lost:

```ts
import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80 } from 'audio90';
import { createReaction, increased } from '@mvtjs/utils';
import { SHIP_EXPLODE, SHOT } from './sounds';

export interface ShipAudioViewBindings {
    /** What the view plays its sounds on. The view reads it once. */
    readonly sfx: Pick<Audio80, 'play'>;
    /** Shots fired this game. Each rise is a shot. */
    readonly shotsFired: () => number;
    readonly isAlive: () => boolean;
}

export function ShipAudioView(bindings: ShipAudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    const playShotSoundOnEachShot = createReaction({
        watch: bindings.shotsFired,
        when: increased,
        react: () => sfx.play(SHOT),
    });
    const playExplosionSoundWhenShipIsLost = createReaction({
        watch: bindings.isAlive,
        when: false,
        react: () => sfx.play(SHIP_EXPLODE),
    });

    setRefresh(view, () => {
        playShotSoundOnEachShot();
        playExplosionSoundWhenShipIsLost();
    });
    return view;
}
```

`SHOT` and `SHIP_EXPLODE` are sounds. Each is made once, as its module
loads, with `createAudio80Sound` from `audio90`.

The game's view adds the audio view as a child, beside the views that draw
the ship. It is ticked with them, and nothing about it is special to the
ticker:

```ts
view.addChild(
    ShipAudioView({
        sfx,
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
This repo's audio views play on a virtual sound chip from `audio90`. A
virtual sound chip is a sound chip simulated in code. There are two. The
**Audio80** is modelled on the chips in 1980s home computers. The
**Audio90**, with sixteen stereo voices of FM, analog and samples, is in
the spirit of the 1990s. Each game names the kind of chip it wants, and
the Arcade, this repo's home page, gives it two chips of that kind:
`music`, for its songs, and `sfx`, for its sound effects. A sound effect
on a chip of its own never takes a voice the music needs. Views take them
as `MusicChip<'audio80'>` and `SfxChip<'audio80'>`, from `#shared`, which
leave out the chip's pause and volume, since those are the Arcade's to
set. Any sound library would do. MVT asks only that views play the sound,
not models, and that they play it from state they poll.
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
count rises. A count going back to 0 for a new game is not a rise.
[Change Detection](../reacting-to-changes/change-detection.md#counts-moments-that-repeat)
covers counts in full.

**The starting state.** A reaction reads its value when it's made, as its
starting point, and never reacts to that. So a view made in the middle of a
game plays nothing for the state it finds. When the starting state should
sound, such as a fanfare as a game begins, the view plays it itself, as it's
made:

```ts
// The view is made as the game starts, so it opens with the fanfare
if (bindings.phase() === 'playing') music.play(STAGE_FANFARE);
```

**Two changes, one moment.** Sometimes one moment changes two values in the
same tick. Suppose a ship that comes back also gets a full tank, in the
tick its phase returns to playing. A view that played a respawn for the
phase and a refuel for the fuel would play two sounds for one moment. The
surest fix is for the model to count the moment itself, such as
`fuelTanksDestroyed`, so that the view plays the refuel only when that
count rises. Otherwise, watch the two values together with a
[watcher](../reacting-to-changes/change-detection.md#watchers-what-changed-for-logic-in-a-step),
and play one sound.

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

## Sound for a Collection

Some sounds belong to the items of a collection, such as enemies that dive
and get hit. There are two ways to play them. Start with the first.

**One audio view for the whole collection.** The model counts each kind of
moment, and one audio view, outside the collection, reacts to the counts.
An array reaction suits a count for each kind of enemy:

```ts
const playDiveSoundOnEachDive = createReaction({
    watch: () => model.divesStarted,
    when: increased,
    react: () => sfx.play(DIVE),
});
const playHitSoundOnEachHit = createReaction({
    watch: ENEMY_KINDS.map((kind) => () => model.hitsOf(kind)),
    when: increased,
    react: (_hits, _previous, index) => sfx.play(HIT_SOUNDS[index]),
});
```

This has nothing to go wrong when items come and go. A count rises in the
tick of the moment, so a sound plays even for an item removed in that same
tick. The cost is that the model keeps the counts. When a sound needs an
item's details, such as where it was, to pan the sound, the model keeps the
last one's details too (`lastHitX`).

**An audio view for each item,** when each item's sound depends on the item,
such as panning by its position, or a sound that lasts as long as the item
does. How its reactions behave depends on how the item views are made:

- **A view made for each item** makes new reactions with it. Each reads the
  item when it's made, as its starting point, so an item arriving is never a
  change. A game view that builds a new enemy layer for each wave works like
  this. It suits items that arrive in groups, rather than pools that change
  every frame, such as bullets.
- **A view reused by a [`<List>`](collections.md)** keeps its reactions when
  a new item takes over its slot. The next call compares the new item with
  the slot's last one, and sees any difference as a change. So each
  reaction needs a `when` that an arriving item can't trigger. For example,
  a new item always arrives alive, so `isAlive` changing from `true` is
  always a real loss:

  ```ts
  const playExplosionSoundWhenLost = createReaction({
      watch: bindings.isAlive,
      when: changedFrom(true),
      react: () => sfx.play(EXPLODE),
  });
  ```

  An empty slot skips its views, so their reactions aren't called until the
  slot fills again. [Presenting Collections](collections.md#two-rules-for-item-views)
  explains why a slot's view must not rely on what it saw when it was made.

Whichever you choose, an item's view can't hear a moment in the tick its item
is removed, since the slot is already empty at the next refresh. The model
counts that moment, and a view outside the collection plays it.

## Music

A song lasts across many ticks, but the view doesn't have to play it note
by note. Most sound libraries play a whole song, and keep its place
themselves, as this repo's chips do. Then the view's job is only to choose
what plays: which song, when it starts and stops, and how fast. It plays a
song when a phase begins, as it plays any sound on a change:

```ts
const { music } = bindings;
const playMusicWhenPhaseChanges = createReaction({
    watch: bindings.phase,
    react: (phase) => {
        if (phase === 'playing') {
            music.play(STAGE_FANFARE);
            music.queue(STAGE_TUNE);
        }
        else if (phase === 'game-over') {
            music.stop(undefined, { fadeMs: 1500 });
        }
    },
});

setRefresh(view, () => {
    playMusicWhenPhaseChanges();
    // After any new song, so the tempo suits the song that plays
    music.tempoScale = bindings.isHurrying() ? 1.3 : 1;
});
```

`queue` plays the stage's tune straight after the fanfare, with no gap.
The chip sends `tempoScale` on only when it changes, so the view can set it
in every refresh, from the state it reads. A tempo of 0 holds the song
where it is, which suits music that plays only while something moves.

A view can move in time with the music too. The chip's `beat` says where
the song the listener hears has got to, in beats, so a view can pulse on
each one. It reads `beat` as it reads any binding, in its refresh step.

A view usually plays one song at a time, so a new song cuts the old one
off. A jingle that plays as a phase begins stops when the next phase starts
its own song. Keep each jingle no longer than its phase.

## Sounds That Repeat

Some sounds repeat for as long as a condition holds. Examples are a
heartbeat that quickens as the rocks thin out, an alarm while fuel is low,
and an engine while the ship thrusts. When the model does not track such a
sound, it is the view's
**[presentation state](../../reference/glossary.md)**. Presentation state
is state a view keeps for its own output, which no domain outcome depends
on. It follows the usual split:

| Step | What it does |
| --- | --- |
| Update | Advances the presentation state, such as the beats so far |
| Refresh | Plays what is due, such as a sound for each new beat |

A **[metronome](../../reference/glossary.md)** from `@mvtjs/utils` suits
a heartbeat. It counts beats at a tempo the view can change, and plays
nothing itself. The view sets its `periodMs` in the update step, or sets
it to 0 to stop it. The refresh step plays a sound each time the
metronome's `count` rises:

```ts
import { createMetronome, createReaction, increased } from '@mvtjs/utils';

const heartbeat = createMetronome();
const playHeartbeatSoundOnEachBeat = createReaction({
    watch: () => heartbeat.count,
    when: increased,
    react: () => sfx.play(BEAT),
});

setUpdate(view, (deltaMs) => {
    heartbeat.periodMs = computeBeatPeriodMs(bindings.rocksLeft());
    heartbeat.update(deltaMs);
});
setRefresh(view, playHeartbeatSoundOnEachBeat);
```

A metronome beats as soon as it starts, which is in the view's first
update step. The reaction read a count of 0 when it was made, so the first
refresh sees the rise to 1, and the first beat sounds.

Only the update step moves the heartbeat on. A paused game's views sit out
the update step, so the heartbeat stops while the game is paused, and
carries on from the same place when the game resumes.

## Time

A model's time is the ticks, never the wall clock. Ideally, sound would
keep the same time, so that pausing the game paused its sound. But sound
has a need that pictures don't. A display can show a late frame's picture
a moment late, and almost nobody notices. A sound card can't wait for a
late frame. A block of sound it doesn't get in time is a gap, and
everybody hears it.

So most sound libraries, such as Howler, `@pixi/sound` and the Web Audio
API, play on the sound card's clock, not the game's ticks. A view starts
and stops a sound, and changes its volume or speed. But once a sound
starts, it plays in real time. Everything above still holds. Audio views
play on a change, and the advice on finding the moment, counts and lists
is the same. What changes is pausing:

- **Pausing the sound is the game loop's job.** A paused game starts no
  new sounds, but the sounds already playing carry on, and so does the
  music. So whatever pauses the game pauses its sound too. That's a
  presentation concern, like hiding the game's views, so it belongs with
  the code that runs the game, not in a model.
- **The library keeps the song's place.** So the view's presentation state
  is only which song should be playing, as [Music](#music) shows.
- **A page that's hidden** should hold its sound too, since the ticks stop
  while a browser tab is in the background.

::: info Project convention
This repo's chips play on the sound card's clock, so a late frame never
holds the music up. The Arcade pauses an entry's chips as it pauses the
entry, and resumes them with it, so an audio view never pauses anything.
What a chip reports of the music, such as `row` and `beat`, is what the
listener hears now, so a view that shows the music shows what is heard.
In tests, a headless chip from `audio90/headless` moves on only with the
ticks, so the same ticks always play the same notes.
:::

## Testing

An audio view is tested like any other view. The test drives its bindings,
refreshes the view, and checks what it wrote. Here the output is the
sounds the view played. The view's `sfx` binding asks only for `play`, so
the test can pass a plain object that records each sound in an array. You
don't need a sound library at all:

```ts
import { expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { ShipAudioView } from './ship-audio-view';
import { SHOT } from './sounds';

it('plays a shot each time the ship fires', () => {
    const played: unknown[] = [];
    const sfx = { play: (sound: unknown) => played.push(sound) };
    const state = { shots: 0 };
    const view = ShipAudioView({
        sfx,
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

A view that plays music reads the chip back too, such as `song` and
`beat`. A stand-in for that would have to act like a chip. So test it on a
real one with no speaker, and spy on its calls. In this repo, that's a
headless chip from `audio90/headless`, with `vi.spyOn(music, 'play')`.
Check only the view's own choices: which song it played, and the tempo it
set. What the chip does with them is the chip's to test.

The sounds themselves can have audio tests, which catch a sound that
changes by accident. They do for sound what
[visual tests](../iterating-with-confidence/visual-tests.md) do for what a
view looks like. How you write one depends on your sound library.
[The headless README](https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/src/headless/README.md)
shows them for this repo's chips.

## Common Mistakes

| Mistake | What goes wrong | Instead |
| --- | --- | --- |
| Playing sound from the model | The model is tied to one presentation, and its tests and thumbnails make noise | Expose state, and let an audio view play it |
| Playing on a state, not a change (`if (isDying) play()`) | The sound plays every frame | Play when the value changes to that state |
| Playing a sound in the update step | The update step advances state and writes no output | Advance state there, and play in the refresh step |
| Calling a reaction only on some refreshes | A change that comes and goes between calls is missed | Call every reaction on every refresh |
| Waiting for a reaction to play the starting state | Nothing plays as the game begins, since a reaction never reacts to its first read | Play the starting state's sound as the view is made |
| Using an event emitter for sounds | Events are missed while a view is made or a game is paused, and the model gains an API | Keep a count that the view watches |
| Watching for a list item's removal | The removed item's view never sees it | Keep a count in the model, and play it from a view outside the list |
| Playing a list view's sound on any change | A sound plays when a new item fills the slot | Play only on changes a new item cannot cause |
| Playing a sound for each of two values that change together | Two sounds play for one moment | Count the moment in the model, or watch the values together |
| A jingle in a phase shorter than the jingle | The next phase's song cuts it short | Shorten the jingle, or lengthen the phase |
| A wall-clock timer for a repeating sound | It ignores pausing, and drifts from the game | Use presentation state advanced in the update step, such as a metronome |
| Expecting a paused game to silence its sound | Sounds already playing carry on, the music among them | Pause the sound where the game is paused, in the code that runs it |

## Going Further

This repo's sound chips have their own documentation, which covers
designing sounds, writing songs and everything the chips can do. Start
with [the `audio90` README](https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/README.md).
