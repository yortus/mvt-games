# Using the Audio80

> The Audio80 is a virtual sound chip in the spirit of the 1980s home
> computers. It has eight voices, two filters and an echo. This guide covers
> getting a chip, designing sound effects and instruments, and playing them
> from audio views as the game changes. (An audio view is a view that plays
> sounds instead of drawing visuals.) It also covers music, repeating
> sounds, the balance of music and effects, and testing.

**Related:** [Writing Tracker Music](writing-tracker-music.md) · [The package's README](../README.md) · [Sound, in the MVT guide](../../docs/building-with-mvt/presenting-the-world/sound.md)

---

## The Chip

The chip has eight **voices**. Each voice plays one note at a time. A voice
has these parts:

| Part | What it does |
| --- | --- |
| **Waveform** | The shape of the sound wave, which sets the tone. It is `pulse`, `saw`, `triangle`, `noise` or `wavetable`. A pulse wave jumps between two levels. Its width is the share of each cycle it spends at one of them, and a width of 0.5 is a square wave. Noise is pitched. Higher notes hiss, and lower ones rumble. A wavetable is 32 steps of 16 levels, drawn by you. Triangle, saw and pulse can also be ANDed together for a thin, metallic tone. The combinations are `triangle+saw`, `triangle+pulse`, `saw+pulse` and `triangle+saw+pulse`, named in that order. Noise combines with nothing |
| **Envelope** | How a note's volume changes over time. It has attack, decay and release times in milliseconds, and a sustain level from 0 to 1. The note rises to full volume over the attack. It then falls over the decay to the sustain level, and stays there while the note is held. When the note is released (stopped), it fades out over the release |
| **Volume** | Set by each note |
| **Echo send** | How much of the voice goes to the echo. The instrument's `echo` option sets it as each note starts, and `setVoice(voice, 'echoSend', value)` changes it |
| **Filter route** | Which filter the voice's sound passes through: filter `a`, filter `b`, or neither |
| **Sync and ring** | Hard sync to another voice, or ring modulation by one, for harsh, bell-like tones. Hard sync restarts this voice's wave each time the other voice's wave starts a cycle. Ring modulation combines this voice's triangle wave with the other voice's wave |

A **filter** cuts some of the frequencies from the sound that passes
through it. Its cutoff is the frequency where it starts to cut. A low pass
filter keeps the frequencies below its cutoff, so it makes a sound duller.
A high pass filter keeps those above it, so it makes a sound thinner. A
band pass filter keeps only those near it. Each of the two filters can be
low pass, band pass, high pass, or a combination of them. They are
resonant, which means they can boost the frequencies near the cutoff, for
a ringing or whistling tone. A filter is shared by every voice routed
through it.

Each voice sends part of its output to the **echo**. That part is its echo
send. The **output** is mono, as the sound chips of the 1980s were. It
removes DC, which is a steady offset in the wave that a speaker cannot
play. It also soft-clips, which means it rounds off any level too loud for
the output. So a loud moment sounds thick rather than crackling.

**Instruments** play on the voices. An instrument sets a voice's envelope
and starting settings. It also sets what changes while a note plays. That
can be an arpeggio, vibrato, pulse-width and filter sweeps, and a **step
table**. An arpeggio steps quickly through the notes of a chord. Vibrato
makes the pitch waver. A sweep moves the pulse width or a filter's cutoff
smoothly from one value to another. A step table is a list of changes,
made one short step at a time. The chip itself advances the step table and
the arpeggio. By default it takes one step every 60th of a second. The old
machines' sound drivers worked the same way, updating their chips once a
frame. Vibrato and the sweeps change smoothly, not in steps.

---

## Getting a Chip

### In the Arcade

The Arcade makes one chip. It passes the chip to each game as `sound`, in
the game's start options. Pass it on to the views that play sounds on it:

```ts
start({ stage, sound }): EntrySession {
    const model = createGameModel();
    stage.addChild(GameView({ model, sound }));
    // ...
}
```

Each tick, the Arcade's game loop advances the chip's clock by the same
`deltaMs` as the game's models. Each call a view makes on the chip is a
write, and the game loop sends the tick's writes after the views refresh.
The Arcade also resets the chip between games, and it applies the
visitor's volume settings. The game only plays sounds on the chip.

### On Your Own Page

An `AudioContext` is the browser's object for playing sound. Make a chip
on one, and drive it from your loop. The chip computes its sound in an
`AudioWorklet`, which is browser code that runs on its own thread:

```ts
import { createWebAudio80 } from '@mvtjs/audio/web';

const context = new AudioContext({ latencyHint: 'interactive' });
const { audio80, controls } = createWebAudio80({ context });
controls.ready.catch(() => {
    console.warn('No sound here: AudioWorklet needs a secure page');
});

// Browsers start audio only after a gesture
const resume = (): void => void context.resume();
window.addEventListener('pointerdown', resume, { once: true });

const view = GameView({ model, sound: audio80 });

function tick(deltaMs: number): void {
    model.update(deltaMs);
    controls.update(deltaMs);    // the chip's clock advances with the models
    updateView(view, deltaMs);
    refreshView(view);
    controls.flush();            // sends this tick's writes to be played
}
```

`createWebAudio80` returns two separate objects. The first is the chip, which
views play sounds on. The second is its **controls**, which only your game
loop uses. The controls are `update`, `flush`, `reset`, the volumes and
`destroy`. Because the two are separate, a view cannot pause, reset or mute
the sound by mistake. `AudioControls.reset` silences every voice between
games. It fades the output over about 3 ms, so that it does not click.
`AudioControls.destroy` stops the worklet.

The chip can play only after `AudioControls.ready` resolves and while the
`AudioContext` is running. A browser starts an `AudioContext` only after the
player clicks or presses a key. It can also suspend one later, as iOS does
when a call comes in. The game keeps running meanwhile, and its views keep
writing to the chip. The chip handles those writes in three ways:

- It drops notes and sound effects. They are never played late.
- It keeps settings, such as a filter's cutoff or the echo. It keeps only
  the latest value of each, and applies them as soon as it can play. A song
  sets its filters and echo once, when it starts. Without this, a song
  started during the wait would sound wrong.
- It keeps the latest call to stop a note (`noteOff`) on each voice, and
  sends it as soon as it can play. So a note that started before the wait
  still stops. Without this, the note would keep sounding until the voice
  played something else.

`createWebAudio80` also takes two optional settings. `leadMs` is how far
playback stays behind the newest tick. It is 35 by default, and
[Time](#time-the-chip-runs-on-game-time) says more about it. `character`
sets how gritty the chip sounds. A sharp jump in a wave adds a harsh,
out-of-tune buzz to high notes. This buzz is called aliasing. Band
limiting is a way of smoothing the jumps so that they do not alias. Each
voice makes its wave with an oscillator. With `'clean'`, the oscillators
are band-limited at full resolution. With `'classic'`, the default, they
are band-limited and reduced to 12 bits, which makes their levels coarser.
With `'raw'`, they alias freely, and each voice is reduced to 8 bits. Band
limiting smooths only the jumps in the saw and pulse waves. Combined
waves, noise, wavetables, ring modulation and hard-synced voices alias in
every character. The headless chip takes `character` too, when it renders.

### Without a Speaker

`createHeadlessAudio80`, from `@mvtjs/audio/headless`, makes a chip with no
speaker. It is for running a game headless, testing audio views and
rendering sound in memory. Rendered sound is a list of samples. Each sample
is the level of the sound wave at one instant. The sample rate is how many
samples make up each second:

| Call | What it does with each write | Use |
| --- | --- | --- |
| `createHeadlessAudio80()` | Nothing: it plays nothing and logs nothing, at almost no cost | Thumbnails and benchmarks |
| `createHeadlessAudio80({ record: true })` | Logs it, on the chip's `log` property, which its `clear` method empties | Testing audio views |
| `createHeadlessAudio80({ render: true })` | Plays it in memory. `render(output)` then fills the `Float32Array` you pass it with the next `output.length` samples | Audio tests, which check that a sound has not changed, and WAV files |
| `createHeadlessAudio80({ record: true, render: true })` | Logs it and plays it | Tests that check both what was written and how it sounds |

`render` also takes `{ sampleRate, character }` in place of `true`. They
default to 48,000 Hz and `'classic'`. The chip has `log` and `clear` only
if it was made with `record: true`. The object returned has `render` and
`sampleRate`, beside `audio80` and `controls`, only if it was made with
`render`. Their types say so. Reading the log of a chip that does not
record is a type error, not an empty log.

Like the browser's chip, it returns `{ audio80, controls }`, an
`Audio80WithControls`. So code written against one runs on the other. Its
clock still runs, and `AudioControls.update` advances it.

The [headless README](../src/headless/README.md) covers the headless chip
in full. It also covers the tools that render songs and effects, measure
them and save them as WAV files.

---

## Time: the Chip Runs on Game Time

The chip keeps the game's time, not the wall clock's. Its clock advances
only when the game loop advances it, by the same `deltaMs` as the models.
Every write is stamped with the chip's current time. The chip applies it at
exactly that time, to the sample. That has three results:

- **Pausing pauses the sound.** When the ticks stop, the sound fades out
  and every voice holds where it is. When the game resumes, the chip waits
  until it is a full `leadMs` behind again. Then it fades back in, and the
  notes continue from where they stopped.
- **Music keeps its tempo** at any frame rate, however uneven the frames.
- **The same ticks make the same sound.** That makes the sound testable.

In a browser, the chip plays a steady 35 ms behind the newest tick. This
delay is `leadMs`, and it smooths out uneven frames. **Sound effects** are
the exception. They play as soon as they arrive, because a shot should be
heard when it is seen.

---

## Sound Effects

A sound effect plays one note on an instrument, for a set length. You make
it once, when the module loads. Here the effect defines its own instrument,
with the `stepMs`, `envelope` and `steps` options:

```ts
import { createSoundEffect } from '@mvtjs/audio';

/** A coin: a bright blip up a fifth. */
export const COIN = createSoundEffect({
    note: 'E-6',
    stepMs: 25,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    steps: `
        # wave   pitch  width
        pulse    +0     p3
        pulse    +7
        pulse    +12
    `,
});
```

It is played by passing it to `Audio80.play`.

Several effects can share one instrument instead. Make the instrument with
`createInstrument`, and pass it as the `instrument` option:

```ts
import { createInstrument, createSoundEffect } from '@mvtjs/audio';

const BLIP = createInstrument({
    wave: 'pulse',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
});

export const MENU_UP = createSoundEffect({
    instrument: BLIP,
    note: 'C-6',
    lengthMs: 40,
});
export const MENU_DOWN = createSoundEffect({
    instrument: BLIP,
    note: 'G-5',
    lengthMs: 40,
});
```

A note is written as a letter, then `-` or `#`, then an octave number. The
`#` makes it a sharp, one semitone higher. So `E-6` is the E in octave 6,
and `C-4` is middle C. A semitone is the step from one piano key to the
next, and 12 semitones make an octave. A fifth is 7 semitones.

| Option | Meaning | Default |
| --- | --- | --- |
| `instrument` | The instrument to play. Leave it out to define the instrument here instead, with instrument options (`wave`, `envelope`, `steps`, ...). Giving both throws an error | |
| `note` | The note to play | the instrument's |
| `glideTo` | A note to glide to, moving smoothly in pitch over the effect's length, for a zap down or a rising whine | |
| `lengthMs` | How long the note is held before its release | the step table's length, or 250 |
| `volume` | 0 to 1 | 1 |
| `priority` | When no voice is free, it may take over the voice of an effect with the same or lower priority | 0 |
| `maxVoices` | The most voices it plays on at once. Playing it again at that limit restarts its oldest copy | 1 |

### Step Tables

Most effects are shaped by a **step table**. A step table is a string in
backticks. Each line is a row, and each row is one step. Each step lasts
`stepMs`, which is a 60th of a second by default. A setting that a row
changes stays until a later row changes it. The last row's settings stay
in effect until the note ends. A row holds any of these tokens, at most
one of each kind:

| Token | Meaning | Example |
| --- | --- | --- |
| A wave | Switch waveform | `noise`, `pulse`, `saw+pulse` |
| A relative pitch | Semitones from the note | `+12`, `-5` |
| A note | That exact pitch, ignoring the effect's `note` | `C-6` |
| `v` and a hex digit | Volume, `0` to `F` | `vA` |
| `p` and a hex digit | Pulse width, in sixteenths | `p4` |
| `f` and a hex digit | The cutoff of the instrument's filter (ignored without a `filter`) | `f8` |

```ts
/** A rock breaking: a burst of noise, falling. */
export const BREAK = createSoundEffect({
    note: 'C-4',
    stepMs: 30,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    steps: `
        # wave   pitch  vol
        noise    +17    vF
        noise    +12    vE
        noise    +8     vC
        noise    +5     vA
        noise    +2     v7
        noise    +0     v4
    `,
});
```

Put a comment naming the columns above the rows, as here. A `#` starts a
comment, which runs to the end of the line. The `#` must be the first
thing on its line, or have a space before it, so the `#` in `F#5` is part
of the note. Comment lines and blank lines are skipped, and neither counts
as a step. Indentation and extra spaces are ignored, so you can line the
tokens up.

### Recipes

| Sound | How |
| --- | --- |
| A laser shot | A pulse falling an octave or so over five or six fast steps, the width narrowing |
| An explosion | Noise falling in pitch and volume over a third of a second. Bigger is slower and lower, with a triangle step for a thump |
| A coin or pickup | A pulse stepping up a chord (`+0`, `+7`, `+12`) at 25 to 45 ms a step, with a little echo |
| A jump | A triangle or pulse with `glideTo` a fifth or an octave up, 100 to 150 ms |
| A hit | A step of noise, then a low triangle falling |
| A menu blip | One or two short steps of pulse or a sine wavetable, quiet |
| An alarm | A short tone, repeated with a metronome (below) |
| A machine's hum | Noise or a low pulse, repeated with a metronome while it runs |

### Which Voice an Effect Gets

While a song plays, it reserves one voice per channel, from voice 0 up. A
channel is one part of the song, such as the bass or the drums. An effect
takes a free voice from the top down, starting at voice 7. So an
effect and a song that start together do not collide. If no voice is free,
the effect takes over the voice of the oldest effect with the same or lower
`priority`. If there is no such effect, the new effect is not played. An
effect already playing on `maxVoices` voices restarts on its own oldest
voice instead. So rapid fire with the default `maxVoices: 1` uses only one
voice.

Give the sounds that must be heard a higher priority than the ones that
can be lost in a crowd. The player's death and a stage cleared must be
heard. Shots and ticks can be lost.

---

## Instruments

An instrument says how a note sounds. It sets the waveform, how the volume
rises and fades, and what changes while the note plays. A song plays its
notes on instruments, and so does a sound effect. You make an instrument
once, when the module loads, with `createInstrument`:

```ts
import { createInstrument } from '@mvtjs/audio';

/** A soft lead: a pulse wave that wavers a little once the note has started. */
export const LEAD = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.25,
    envelope: { attackMs: 5, decayMs: 300, sustain: 0.6, releaseMs: 120 },
    vibrato: { semitones: 0.2, hz: 5, delayMs: 200 },
});
```

A sound effect can also define its own instrument, with the same options.
[Sound Effects](#sound-effects) shows how.

### Instrument Options

`createInstrument` takes these options. Every one is optional.

| Option | Meaning | Default |
| --- | --- | --- |
| `wave` | The waveform | `pulse` |
| `pulseWidth` | 0 to 1. For a lone pulse, it is the share of each cycle at one level. `w` sounds the same as `1 - w`, and 0.5 is a square. In a combined wave, the pulse lets the other waves through from `pulseWidth` of the way through each cycle to its end | 0.5 |
| `wavetable` | 32 hex digits, each a level `0` to `F`. Spaces are ignored | |
| `envelope` | `{ attackMs, decayMs, sustain, releaseMs }`. `sustain` is a level from 0 to 1. `decayMs` is the time to fall to 60 dB below the peak (a thousandth of its level), or to `sustain` | a 2 ms attack, full sustain, a 60 ms release |
| `volume` | 0 to 1 | 1 |
| `filter` | `'a'` or `'b'` | neither |
| `echo` | How much of each note goes to the echo, 0 to 1 | 0 |
| `note` | The note it plays when a song names the instrument but no note, as for drums | `C-4` |
| `stepMs` | How long each step lasts, for the step table and the arpeggio | 1000 / 60 |
| `steps` | A step table, a string in backticks with one step on each line | |
| `arpeggio` | Semitone offsets, one per step, repeating (`[0, 4, 7]`) | |
| `vibrato` | `{ semitones, hz, delayMs }`. How far the pitch wavers, how many times a second, and how long it waits after the note starts | |
| `pulseSweep` | `{ to, ms, isPingPong }`. Sweeps the width from `pulseWidth` to `to` over `ms`, once or back and forth | |
| `filterSweep` | `{ fromHz, toHz, ms }`. Sweeps the cutoff of the instrument's filter on each note | |
| `syncSource`, `ringSource` | Another voice's index, for hard sync or ring modulation | |

A few settings are worth knowing by heart:

- **A pluck**: `envelope: { attackMs: 1, decayMs: 200, sustain: 0, releaseMs: 60 }`.
- **A held tone**: `sustain` above 0, with `releaseMs` for how it fades after release.
- **A shifting pulse**: `pulseSweep: { to: 0.6, ms: 900, isPingPong: true }`.
- **A plucked bass**: a saw through filter `a`, with `filterSweep: { fromHz: 2400, toHz: 450, ms: 180 }`.

**The filters are shared.** A song sets them as it starts. A filter sweep
moves its filter for every voice routed through it. Give effects no filter,
or route them through a filter the music does not use.

**Wavetables** give the softer, rounder tones of early arcade boards. A
wavetable drawn from an FM tone sounds closer to the 1990s. FM tones are
the sound of the FM synthesis chips in many sound cards and consoles of
that time:

```ts
const SINE = '89AC DEEF FFEE DCA9 8653 2110 0011 2356';
const BELL = '7CEF FEDD DFFD A766 7998 5200 2221 0013';
```

---

## Playing from Audio Views

Sound is presentation, so views play it. An **audio view** is an ordinary
view that plays sounds instead of drawing visuals. In its refresh step,
it polls the model through its bindings with `watch`, like any view. It
plays a sound when it sees a change that calls for one:

```ts
import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';

export interface ShipAudioViewBindings {
    /** The chip: an output, read once. */
    readonly sound: Audio80;
    /** Shots fired this game: each rise is a shot. */
    readonly shotsFired: () => number;
    readonly isAlive: () => boolean;
}

/** The ship's sounds: a shot as it fires, and a crash as it is lost. */
export function ShipAudioView(bindings: ShipAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    const watcher = watch({
        shots: bindings.shotsFired,
        isAlive: bindings.isAlive,
    });
    // So the first refresh plays only for changes made after the view is made
    watcher.poll();

    setRefresh(view, () => {
        const w = watcher.poll();
        if (w.shots.increased) sound.play(SHOT);
        if (w.isAlive.changed && !w.isAlive.value) sound.play(SHIP_EXPLODE);
    });
    return view;
}
```

Here is what to watch for:

| The event | What the model exposes | The view plays when |
| --- | --- | --- |
| A state begins: dying, a stage cleared | A phase or a flag | It changes to that value |
| Something that can happen twice in a row: a shot, a coin | A **count** (`shotsFired`) | It rises |
| Several at once: rocks breaking in one tick | A count, and the latest one's details (`lastBrokenRockSize`) | It rises; one sound for the whole tick |

A refresh that sees no change plays nothing. So a second refresh in the
same tick does not play the sound again. A paused game stays quiet too,
even though its views are still refreshed. A watched number's `increased`
is true when it changed to a greater number, so it finds each rise. A count
going back to 0 for a new game is not a rise.

**The first poll.** `watch` reports every value as changed on its first
poll. So poll once when the view is made, as above. Skip that poll if the
view should play something for the starting state, such as a fanfare as
the game begins.

**Views in a list.** A `<List>` makes the view for a slot once, when the
first item fills the slot. It reuses that view for every later item in the
slot. A poll at construction covers only that first item. When a later item
fills the slot, its values show up as changes. So play only on changes that
a newly arrived item cannot produce. For example, an item arrives
alive. So `isAlive` going from `true` to `false` is always a real loss:

```ts
if (w.isAlive.changed && w.isAlive.previous === true) sound.play(EXPLODE);
```

This needs no poll at construction either, since the first poll has no
`previous`. Sometimes there is no such change to rely on. Then also watch a
binding that identifies the item, such as an id. Ignore any poll in which
it changed.

An item may be removed in the same tick as the event, like a rock that
breaks and disappears. Then its view never refreshes to see the change.
Record the event in the model instead, as a count plus the latest one's
details. Play it from a view outside the list.

---

## Music

A song is made of patterns, which are short blocks of music. Its order is
the list of patterns it plays, one after another. A looping song then goes
back to the place in the order that its `loop` option names, and repeats.

A song is played by a **music player**, which an audio view owns. The
player's position in the song is presentation state of that view. It
advances in the view's update step. So the music pauses when the view's
updates stop, and it keeps time with the ticks:

```ts
const music = createMusicPlayer({ audio80: sound });
const watcher = watch({ phase: bindings.phase });

setUpdate(view, (deltaMs) => music.update(deltaMs));
setRefresh(view, () => {
    const w = watcher.poll();
    if (w.phase.changed) {
        if (w.phase.value === 'playing' && w.phase.previous !== 'dying') {
            music.play(STAGE_FANFARE);
            music.queue(STAGE_TUNE);
        }
        else if (w.phase.value === 'game-over') music.play(GAME_OVER);
    }
    music.refresh();
});
```

| Member | Use |
| --- | --- |
| `play(song)` | Starts `song` now, from the beginning, releasing any song playing |
| `queue(song)` | Plays `song` when the current song reaches the end of its order, with no gap, as with a fanfare into a loop. A looping song hands over at the end of its order too, instead of going back to its `loop`. If nothing is playing, `song` starts at once |
| `stop()` | Releases the notes and gives the voices back to effects |
| `tempoScale` | 1 for the song's own tempo. Above 1 speeds it up, and below 1 slows it down. Slides, which move a note's pitch smoothly, keep pace. 0 pauses the song where it is, while its notes ring out and its slides stop. Use it for music that plays only while something moves. A negative value, or one that is not finite, acts as 0. Set it in the update step, before calling `update` |
| `beat` | The song's position, in beats, for views that pulse in time |
| `song`, `isPlaying` | What is playing |

Call `update` from the view's update step. Call `refresh` at the end of its
refresh step, after any `play` or `queue`. One player plays one song at a
time. A game's jingles and its loop usually share one player, so they never
compete for voices. [Writing Tracker Music](writing-tracker-music.md)
explains how to write songs.

---

## Repeating Sounds

Some sounds repeat for as long as a condition holds. Examples are a
heartbeat that quickens, an alarm while fuel is low, and an engine while
thrusting. A **metronome** counts the repeats. It comes from `@mvtjs/utils`,
since it is not only for sound. It counts beats at a tempo you can change,
and plays nothing itself. It is presentation state. It starts stopped, with
a `periodMs` of 0. The update step sets its period and then calls its
`update`. The refresh step plays a sound each time its count rises:

```ts
import { createMetronome, watch } from '@mvtjs/utils';

const heartbeat = createMetronome();
const watcher = watch({ beats: () => heartbeat.count });
watcher.poll();

setUpdate(view, (deltaMs) => {
    // The period in ms, or 0 to stop. The first beat comes as it starts.
    const { isPlaying, rocksLeft } = bindings;
    heartbeat.periodMs = isPlaying() ? periodFor(rocksLeft()) : 0;
    heartbeat.update(deltaMs);
});
setRefresh(view, () => {
    const { beats } = watcher.poll();
    if (beats.increased) {
        sound.play(beats.value % 2 === 0 ? BEAT_HIGH : BEAT_LOW);
    }
});
```

The update step only counts beats, and the refresh step only plays sounds.
That follows the rule for views. Update advances presentation state, and
refresh writes output.

---

## The Mix and Loudness

The chip has two **buses**. A bus is a group of voices that are mixed
together and share one volume. Voices playing a sound effect are on the
effects bus. Every other voice is on the music bus. Each bus has its own
gain, which is the number its sound is multiplied by. The gains are set
through `AudioControls.musicVolume` and `AudioControls.effectsVolume`. In
the Arcade, the visitor's sliders set them. A gain of 1 plays the sound as
written, and values are clamped to 0 to 2. `AudioControls.volume` sets the
volume of the whole chip, and is clamped to 0 to 1. `AudioControls.isMuted`
silences the chip.
Every chip clamps the same way. Changes ramp over a few ms, so moving a
slider does not click.

Write each sound at the level it should be heard at:

- **Songs** should be at the shared loudness, about -20 LUFS. LUFS is the
  standard unit for how loud sound seems to a listener. The values are
  negative, and nearer 0 is louder. The shared loudness is
  `REFERENCE_LOUDNESS_LUFS`, from `@mvtjs/audio/headless`.
  `npm run audio:render` prints each song's loudness. Set a song's `volume`
  to bring it to that level.
- **Effects** should be loud enough to be heard over the music, and quiet
  enough not to clip. A sound clips when it is too loud for the output.
  The output then rounds off its loudest moments, which distorts it. Aim
  for a peak between about 0.08 and 0.3. The peak is the highest level the
  sound reaches, and the output holds levels up to 1.
  `audio:render` prints each effect's peak. Noise through a filter comes
  out quieter than its settings suggest, so give it more volume.
- An effect's `volume` is applied once, to its note. It is not also applied
  to the instrument the effect defines. So an effect at 0.5 peaks at about
  half the level it has at 1.

---

## Direct Chip Calls

For anything effects and songs do not cover, call the chip directly:

| Call | Does |
| --- | --- |
| `noteOn(voice, instrument, note, volume, atMs?)` | Starts a note on a voice at `atMs`, by default the chip's current time. `note` is a note number, as MIDI (the standard for music hardware) numbers them. There is one number per semitone, and 60 is middle C, `C-4`. A `volume` of 1 is the instrument's own |
| `noteOff(voice, atMs?)` | Releases the voice's note, so that its envelope's release begins |
| `setVoice(voice, setting, value, atMs?)` | Changes one of a voice's settings: `note` (a bend, which changes the pitch without starting a new note), `volume`, `pulseWidth`, `wave` (a name, such as `'saw+pulse'`), `arpeggio`, `vibratoDepth`, `slide`, `glide`, ... |
| `setFilter(filter, setting, value, atMs?)` | Sets a filter's `mode` (a name, such as `'lowpass'`), `cutoffHz`, `resonance` or `drive`. Drive pushes the filter's input harder, for a slight growl |
| `setEcho(setting, value, atMs?)` | Sets the echo's `timeMs` (at most 1000), `feedback` (at most 0.95) or `level`. The feedback is how much of each repeat is echoed again, and the level is how loud the echo is |
| `reserveVoices(count, atMs?)` | Reserves voices 0 to `count` - 1 for music, so effects cannot take them |
| `releaseAll()` | Releases every voice |
| `time` | The chip's current time in ms. Calls without `atMs` are stamped with it |
| `voiceCount` | The number of voices: 8 |

A write stamped earlier than the chip has already played applies at once.
A write with a value that is NaN or infinite is dropped. The calls take
their arguments in order, not as an options object. That is because they
are called from refresh steps, which must not allocate.

---

## Testing and Listening

**Listen** without starting the game:

```sh
npm run audio:render -- \
    packages/website/src/entries/galaxy-raiders/data/music.ts
```

This command renders every song and effect the module exports to WAV
files, in `renders/<module path>/`. It prints each one's length and peak,
and each song's loudness. The
[headless README](../src/headless/README.md#listening) says more.

**Audio tests** catch sounds that change by accident. Render each export,
and check that it is audible and not clipped. Check that each song is at
the shared loudness too. Then snapshot a hash of its samples. A change that
alters the sound then fails the test. It keeps failing until someone has
listened to it and updated the snapshot with `vitest -u`:

```ts
import {
    findSounds, hashSamples, measurePeak, renderSoundEffect,
} from '@mvtjs/audio/headless';

const { songs, effects } = findSounds({ ...sounds, ...music });

for (const [name, effect] of effects) {
    it(`${name} sounds as it did, audible and unclipped`, () => {
        const samples = renderSoundEffect(effect);
        expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
        expect(measurePeak(samples)).toBeLessThan(CLIPPING);
        expect(hashSamples(samples)).toMatchSnapshot();
    });
}
```

Views have the same kind of test for their pictures. See
[Visual Tests](../../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)
in the MVT guide.

**Audio views** are tested against a headless chip that records. The test
advances the chip's clock and ticks the view, as a game loop would:

```ts
const { audio80, controls } = createHeadlessAudio80({ record: true });
const view = ShipAudioView({
    sound: audio80,
    shotsFired: () => state.shots,
    isAlive: () => true,
});
const tick = (): void => {
    controls.update(1000 / 60);
    updateView(view, 1000 / 60);
    refreshView(view);
};

state.shots++;
tick();
const shot = expect.objectContaining({ kind: 'play', effect: SHOT });
expect(audio80.log).toContainEqual(shot);
```

---

## When It Goes Wrong

| Symptom | Likely cause |
| --- | --- |
| A sound plays as the game starts, unasked | `watch` reports every value as changed on its first poll. Poll once when the view is instantiated |
| A sound never plays from a view in a list | The item was removed in the same tick as the event. Record it in the model as a count, and play it from a view outside the list |
| A list view plays a sound when a new item fills its slot | The view plays on a change that a newly arrived item can cause. Play only on changes it cannot cause (`isAlive` from `true` to `false`), or ignore polls in which the item's id changed |
| An effect is cut short or never heard | No voice was free and its `priority` was too low, or it reached its `maxVoices` and restarted. The music may be using more channels than it needs |
| An effect sounds wrong only while music plays | Both use the same filter, and the song set or swept it |
| Two sounds play for one event | Two values changed in the same tick for one event (a returning ship also refills its fuel). Check them together and play one sound |
| Nothing plays on a phone | The page is not served over HTTPS, and `AudioWorklet` needs a secure page |
| Nothing plays at all | The `AudioContext` has not been resumed after a user gesture |
