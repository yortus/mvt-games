# Sound and Music

> Sound is presentation, just as pictures are, so views play it and models
> never do. A view that plays sounds is an audio view. It reads the model
> through its bindings, and plays a sound when a value changes in a way
> worth hearing. Unlike everything else in the game, a sound or a song,
> once started, plays on the sound card's clock, not the game's ticks. So
> pausing the game doesn't pause its sound: the code that pauses the game
> has to pause its sound too. And because an audio view's only output is
> the calls it makes, a test can record them and check them exactly.

**Related:** [Views](07-views.md) · [Bindings](08-bindings.md) ·
[Noticing Changes](09-noticing-changes.md) ·
[Presentation State](11-presentation-state.md) ·
[Lists and Switches](14-lists-and-switches.md) ·
[Growing a Complex View](18-growing-a-complex-view.md)

The quickest way to add a sound is to play it where the thing happens. The
ship fires, so the ship model plays the zap:

```ts
fire: () => {
    if (cooldownMs > 0) return;
    cooldownMs = FIRE_COOLDOWN_MS;
    shots.spawn(position);
    sfx.play(SHOT); // the model now needs a sound chip
},
```

It works on the first playtest. Then the model's tests need a sound chip to
build a ship, and the thumbnail renderer, which runs the game for a few
seconds to take a picture, makes a noise. A second game mode with a
different zap has to change the model. And the model now depends on a
sound library, even though the game's rules don't involve sound at all.

## Sound Is Presentation

A view turns domain state into output. The output is usually a picture,
but MVT doesn't restrict what it is. It can be a DOM element, a log in a test,
or a speaker. The model and the view divide the work for sound just as
they do for pictures:

| The model's state | The view's choice |
| --- | --- |
| The ship is dying | Which crash to play, how loud, and whether the music stops |
| Shots fired: 12 | That the 12th shot is a zap |
| The stage is being played | Which tune, at what tempo, and when it hurries |
| Rocks left: 3 | That the heartbeat quickens |

A model that only holds domain state can be presented in any way. Another
view could play different sounds for it. A test, a thumbnail or a
benchmark can run it without any sound.

## Audio Views

An **[audio view](../appendices/b-glossary.md)** is a view that plays
sounds instead of drawing visuals. Like any other view, it reads the
model's state through its bindings. It also needs something to play its
sounds on, such as a sound chip or a sound library's player. That's passed
in as a binding too, named `sfx` below. It stays the same for the view's
whole life, so the view reads it once, as it would a fixed value.

In its refresh step, the view calls its
[reactions](09-noticing-changes.md). Each reaction reads a binding, and
plays a sound when the value changes in a way worth hearing. This audio
view plays a zap each time the ship fires, and a crash when the ship is
lost:

```ts
import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction, increased } from '@mvtjs/utils';
import type { Audio80 } from 'audio90';
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

`SHOT` and `SHIP_EXPLODE` are sounds, each made once as its module loads.
The type of the view's `sfx` binding includes only the one method that
the view calls, `play`. Those calls are the view's whole output, so the
view is easy to test, as [§](#testing-an-audio-view) shows.

The game's view adds the audio view as a child, beside the views that draw
the ship, and the ticker ticks it with them. In every other way, the
audio view is an ordinary view.

In [§](#try-ship-audio-view), the audio view plays the sounds of a ship.
Move the pointer to steer, and click to fire. The sound starts with your
first click in the game. Then let a rock fall on the ship, and listen for
the crash: it plays once, as the ship is lost, and not again while the
ship stays lost.

<TryIt example="ship-audio-view" file="views/ship-audio-view.ts" />

### Play on a change, never on a state

The view plays the crash once, as `isAlive` turns `false`. It doesn't play
it again on each refresh while the ship stays lost. If it checked the state
instead, with `if (!bindings.isAlive()) sfx.play(SHIP_EXPLODE)`, it would
start a new crash on every frame, sixty times a second.

Playing on a change gives an audio view the same useful properties as any
other view:

- **A refresh without a change doesn't play anything.** So the view can
  be refreshed any number of times, as views can, and a second refresh in
  the same tick doesn't play anything more.
- **A paused game doesn't start new sounds.** The ticker still refreshes a
  paused game's views, to show them. The state doesn't change, so a sound
  doesn't start. Whether the sounds already playing stop too depends on
  which clock the sound plays on, as [§](#the-clock-that-sound-plays-on)
  explains.

Most moments worth a sound are already a change that the view can detect,
such as a phase beginning. A moment that repeats without changing any
phase, such as a shot, needs the model to keep a count, and the view
plays each time the count rises, as [Chapter 9](09-noticing-changes.md)
shows.

A reaction never reacts to its first read. So a sound for the state that
the view starts in, such as a fanfare as the game begins, is played by the
view itself, as it's made.

::: info In this book
Audio views play on a virtual sound chip, a sound chip simulated in code,
from the `audio90` package. There are two kinds. The **Audio80** is in the
spirit of the 1980s home computers, with four mono voices. The
**Audio90**, with sixteen stereo voices of FM, analog oscillators and
samples, is in the spirit of the 1990s. A game plays its music on one
chip and its sound effects on another, so a sound effect never takes a
voice that the music is using. The type of a view's binding includes only
the chip's members that the view calls, such as `play`, so the view can't
pause the chip or change its volume.

Any sound library would do. MVT requires only that views play the sound,
not models, and that they play it from state that they poll.
:::

## Sound for a Collection

Some sounds belong to the items of a collection, such as enemies that dive
and get hit. There are two ways to play them. Start with the first.

**One audio view for the whole collection.** The model counts each kind of
moment, such as `divesStarted`, and one audio view, outside the
collection, plays a sound as each count rises. For several kinds, such as
one hit count for each kind of enemy, one reaction can watch an array of
getters and receive the index of the one that rose, as
[Chapter 9](09-noticing-changes.md#reactions-do-something-when-a-value-changes)
shows.

Items coming and going can't cause a problem here. A count rises in the
tick of the moment, so a sound plays even for an item removed in that
same tick. The drawback is that the model keeps the counts, and the
details of the last moment when a sound needs them, such as where it
was, to pan the sound.

**An audio view for each item,** when each item's sound depends on the
item, such as panning by its position, or a sound that lasts as long as
the item does. How its reactions behave depends on how the item views are
made:

- **A view made for each item** makes new reactions with it. Each reads
  the item when it's made, as its starting point, so an item arriving is
  never a change. A game view that builds a new enemy layer for each wave
  works like this. It suits items that arrive in groups, rather than pools
  that change every frame, such as bullets.
- **A view reused by a `<List>`**, from
  [Chapter 14](14-lists-and-switches.md), keeps its reactions when a new
  item takes over its slot. The next call compares the new item with the
  slot's last one, and treats any difference as a change. So each reaction
  needs a `when` that an arriving item can't trigger. For example, a new
  item always arrives alive, so `isAlive` changing from `true` is always a
  real loss:

  ```ts
  const playExplosionSoundWhenLost = createReaction({
      watch: bindings.isAlive,
      when: changedFrom(true),
      react: () => sfx.play(EXPLODE),
  });
  ```

  An empty slot skips its views, so their reactions aren't called until
  the slot fills again.

Whichever you choose, an item's view can't play a sound for a moment in
the tick when its item is removed, since the slot is already empty at the
next refresh. The model counts that moment, and a view outside the
collection plays it.

## Sounds That Repeat

Some sounds repeat for as long as something lasts, such as a heartbeat
that quickens as the rocks thin out, or an alarm while the fuel is low.
When the model doesn't track the beat, it's the view's
[presentation state](11-presentation-state.md). As usual, the update step
advances it, and the refresh step plays what's due.

A **[metronome](../appendices/b-glossary.md)**, from
[Chapter 18](18-growing-a-complex-view.md), suits a heartbeat. The view
sets its period in the update step, and plays a sound each time its count
rises:

```ts
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

The first beat sounds at once, and the heartbeat stops while the game is
paused, as
[Chapter 18](18-growing-a-complex-view.md#repeating-beats) explains for
any metronome.

In [§](#try-rock-heartbeat), click the rocks to break them, and listen to
the heartbeat quicken. The heart on the screen swells on alternate beats,
so you can follow it with the sound off. Press Step, which pauses the
game, and the beat stops with it.

<TryIt example="rock-heartbeat" file="views/heartbeat-view.ts" />

## Music

A song lasts across many ticks, but a view doesn't have to play it note by
note. Most sound libraries play a whole song, and keep its place
themselves. Then the view's job is only to choose what plays: which song,
when it starts and stops, and how fast. It starts a song as a phase
begins, as it plays any sound on a change:

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
    music.tempoScale = bindings.isHurrying() ? HURRY_TEMPO_SCALE : 1;
});
```

Here is what each call does:

- **`play`** starts a song from its beginning, in place of any song
  playing.
- **`queue`** plays the stage's tune straight after the fanfare, without
  a gap.
- **`stop`**, without an id, stops everything on the chip: the song, and
  every sound playing on it. With `fadeMs`, the chip fades out over that
  time, then stops.
- **`tempoScale`** speeds the song up or slows it down, where 1 is the
  song's own tempo. The chip passes it on only when it changes, so the
  view can set it on every refresh, from the state it reads. A tempo of 0
  holds the song where it is, which suits music that plays only while
  something moves.

A view can also move in time with the music. The chip's `beat` is the
song's position, in beats from its start, so a view can pulse on each
one. It reads `beat` as it reads any binding, in its refresh step.

A chip plays one song at a time, so a new song cuts the old one off. A
jingle that plays as a phase begins stops when the next phase starts its
own song. So keep each jingle no longer than its phase.

In [§](#try-stage-music), click to start a stage, and listen. The fanfare
plays, and the stage's tune follows it without a gap. The tune hurries as
time runs short, and fades out as the game ends. The ring pulses on each
beat, which it reads from the chip's `beat`.

<TryIt example="stage-music" file="views/music-view.ts" />

::: info In this book
Playing a song on a chip also cancels any song queued after the old one.
`play` and `queue` each return an id for the play, and `stop(id)` stops
only that play. A song's `durationMs` is the length of one pass through
its order, so a test can check that a jingle fits its phase.
:::

## The Clock That Sound Plays On

A model's time is the ticks, never the wall clock. Ideally, sound would
keep the same time, so that pausing the game paused its sound. But sound
has a need that pictures don't. A display can show a late frame's picture
a moment late, and players rarely notice. A sound card can't wait for a
late frame. A block of sound that arrives late becomes a gap, and every
listener hears it.

So most sound libraries, such as Howler, `@pixi/sound` and the Web Audio
API, play on the sound card's clock, not the game's ticks. A view starts
and stops a sound, and changes its volume or speed. But once a sound
starts, it plays in real time, and so does a song. Everything above still
holds: audio views play on a change, and choose the song. The library
keeps the song's place, so the view's presentation state is only which
song should be playing. Only pausing changes.

A paused game doesn't start new sounds, but the sounds already playing
carry on, and so does the music. So the code that pauses the game has to
pause its sound too. Like hiding the game's views, that's a presentation
concern, so it belongs with the code that pauses the game, not in a model
or an audio view. A hidden page should hold its sound as well, since the
ticks stop while a browser tab is in the background, and a song playing
on would run ahead of the game. And a test needs a clock that it
controls, or its results would depend on how fast the machine runs, so
tests play on a chip, or a stand-in, whose time moves only with the
ticks.

::: info In this book
Each chip plays its songs on a sequencer of its own. In a browser, the
sequencer runs on the audio thread, on the sound card's clock, so a late
frame never holds the music up. The chip reports the song, such as its
`row` and `beat`, as the listener hears it now.

A chip's `pause()` holds it where it is: its voices fade out at once and
keep their place, and its song stops moving. `resume()` plays it on from
there. Call them on both chips as the game pauses and resumes. A chip in
a browser also holds its sound by itself while the page is hidden.

A headless chip, from `audio90/headless`, doesn't use a sound card. Its clock
moves only when you call its `update(deltaMs)`, once a tick, with the
same `deltaMs` as everything else. So the same calls and the same ticks
always play the same notes.
:::

## Testing an Audio View

An audio view is tested like any other view. The test drives its bindings,
refreshes the view, and checks what it wrote. Here the output is the
sounds the view played.

The `ShipAudioView` above calls only `play` on its `sfx` binding. So a
test can pass a plain object that records each sound in an array, and
doesn't play anything. You don't need a sound library at all:

```ts
import { expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { ShipAudioView } from './ship-audio-view';
import { SHIP_EXPLODE } from './sounds';

it('plays the crash once, as the ship is lost', () => {
    const played: unknown[] = [];
    const sfx = { play: (sound: unknown) => played.push(sound) };
    let isAlive = true;
    const view = ShipAudioView({
        sfx,
        shotsFired: () => 0,
        isAlive: () => isAlive,
    });

    isAlive = false;
    refreshView(view);
    // A second refresh without a change doesn't play anything more
    refreshView(view);

    expect(played).toEqual([SHIP_EXPLODE]);
});
```

Check for the exact sound, as the last line does, since a check that some
sound played still passes when the view plays the wrong one. And check
that a second refresh doesn't play anything more, which catches a view
that plays on a state rather than a change.

A view that plays music often reads the chip back too, such as its `song`
or `beat`. A stand-in for that would have to act like a chip. So test it on
a real chip without a speaker, and spy on its calls:

```ts
import { expect, it, vi } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from 'audio90/headless';

it('hurries the music when time runs short', () => {
    const music = createHeadlessAudio80();
    vi.spyOn(music, 'play');
    const state: { phase: GamePhase; isHurrying: boolean } = {
        phase: 'title',
        isHurrying: false,
    };
    const view = MusicView({
        music,
        phase: () => state.phase,
        isHurrying: () => state.isHurrying,
    });

    state.phase = 'playing';
    refreshView(view);
    expect(music.play).toHaveBeenCalledWith(STAGE_FANFARE);

    state.isHurrying = true;
    refreshView(view);
    expect(music.tempoScale).toBe(HURRY_TEMPO_SCALE);
});
```

Check only the view's own choices: which song it played, and the tempo it
set. The chip's own tests check what the chip does with them. When a test
checks where the song has got to, such as a view that pulses on each
`beat`, call the chip's `update` once a tick, so its clock keeps step with
the test's.

The sounds themselves can have audio tests too, which catch a sound that
changes by accident. They're the sound equivalent of
[visual tests](17-visual-tests.md). How you write one depends on your
sound library.

::: info In this book
`createHeadlessAudio80` and `createHeadlessAudio90` come from
`audio90/headless`. A headless chip accepts every call that a chip in a
browser accepts, and checks each one the same way, but doesn't make a
sound.
[The headless README](https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/src/headless/README.md)
shows how to write audio tests for the chips' sounds and songs.
:::

## Common Mistakes

### A model's tests that need a sound chip

A model's tests need a sound chip to build it, and making a thumbnail
makes a noise. The model plays its own sounds, so it's tied to one
presentation. Expose the state instead, and let an audio view play it.

### A sound that plays in the game, but not in a refresh alone

A sound plays in the game, but not when the view is refreshed without an
update, as a test might do. The view plays it in its update step, which
should only advance state, and not write any output. Advance state there, and
play in the refresh step.

### Sounds sent as events go missing

Sounds are missed while a view is being made, or while the game is
paused, and the model gains an event for one view's sake. Keep a count in
the model instead, and let the view play each rise, as
[Chapter 10](10-why-views-poll.md) explains.

## Summary

Sound is presentation, so an audio view plays it and the model only keeps
state. The view reads its bindings, and plays a sound when a value changes
in a way worth hearing, through reactions called in its refresh step. A
moment that repeats needs a count in the model. A sound that repeats while
something lasts is presentation state, such as a metronome, advanced in
the update step. Music plays on the sound library's clock, so the view
only chooses which song plays and how fast, and the code that pauses the
game has to pause its sound too. To test an audio view, record what it plays,
or spy on a chip whose clock moves with the ticks, and check the exact
sounds.

## Further Reading

- Chris Wilson, ["A Tale of Two Clocks"](https://web.dev/articles/audio-scheduling)
  (2013). Why sound in a browser is scheduled on the audio clock rather
  than JavaScript's timers, and how to keep the two in step.
- [The `audio90` README](https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/README.md),
  for the `audio90` sound chips: designing sounds, writing songs, and
  everything the chips can do.
