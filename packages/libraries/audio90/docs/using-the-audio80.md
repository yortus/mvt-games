# Using the Audio80

> The Audio80 is a virtual sound chip in the spirit of the 1980s home
> computers. It has four voices, two filters and an echo. This guide covers
> getting a chip, designing sounds and playing them, and playing songs. It
> also covers volume, loudness, using a chip with a game loop, and testing.

**Related:** [Writing Tracker Music](writing-tracker-music.md) · [Using the Audio90](using-the-audio90.md) · [The package's README](../README.md) · [Without a speaker](../src/headless/README.md)

---

The package has a second chip, the **Audio90**, for games in the spirit of
the 1990s. It has sixteen stereo voices that play FM, analog or samples,
and a reverb, a stereo echo and a chorus. The Audio80 suits chiptune,
arcade and 8-bit games. If you're not sure which you need,
[Using the Audio90](using-the-audio90.md#which-chip) compares the two.

Both chips work the same way. You get one, play sounds and songs on it, and
pause it as your game pauses. So much of this guide applies to the Audio90
too, and its guide links back here for those parts.

## The Chip

The chip has four **voices**. Each voice plays one note at a time. A voice
has these parts:

| Part | What it does |
| --- | --- |
| **Waveform** | The shape of the sound wave, which sets the tone. It is `pulse`, `saw`, `triangle`, `noise` or `wavetable`. A pulse wave jumps between two levels. Its width is the share of each cycle it spends at one of them, and a width of 0.5 is a square wave. Noise is pitched. Higher notes hiss, and lower ones rumble. A wavetable is 32 steps of 16 levels, drawn by you. Triangle, saw and pulse can also be ANDed together for a thin, metallic tone. The combinations are `triangle+saw`, `triangle+pulse`, `saw+pulse` and `triangle+saw+pulse`, named in that order. Noise combines with nothing |
| **Envelope** | How a note's volume changes over time. It has attack, decay and release times in milliseconds, and a sustain level from 0 to 1. The note rises to full volume over the attack. It then falls over the decay to the sustain level, and stays there while the note is held. When the note is released (stopped), it fades out over the release |
| **Volume** | Set by each note |
| **Echo send** | How much of the voice goes to the echo, set by the sound it plays |
| **Filter route** | Which filter the voice's sound passes through: filter `a`, filter `b`, or neither |
| **Sync and ring** | Hard sync to another voice, or ring modulation by one, for harsh, bell-like tones. Hard sync restarts this voice's wave each time the other voice's wave starts a cycle. Ring modulation combines this voice's triangle wave with the other voice's wave |

A **filter** cuts some of the frequencies from the sound that passes
through it. Its cutoff is the frequency where it starts to cut. A low pass
filter keeps the frequencies below its cutoff, so it makes a sound duller.
A high pass filter keeps those above it, so it makes a sound thinner. A
band pass filter keeps only those near it. Each of the two filters can be
low pass, band pass, high pass, notch, or a combination of them. They are
resonant, which means they can boost the frequencies near the cutoff, for
a ringing or whistling tone. A filter is shared by every voice routed
through it.

Each voice sends part of its output to the **echo**. That part is its echo
send. The **output** is mono, as the sound chips of the 1980s were. It
removes DC, which is a steady offset in the wave that a speaker cannot
play. It also soft-clips, which means it rounds off any level too loud for
the output. So a loud moment sounds thick rather than crackling.

**Sounds** play on the voices. A sound sets a voice's waveform, envelope
and starting settings. It also sets what changes while a note plays. That
can be an arpeggio, vibrato, pulse-width and filter sweeps, and a **step
table**. An arpeggio steps quickly through the notes of a chord. Vibrato
makes the pitch waver. A sweep moves the pulse width or a filter's cutoff
smoothly from one value to another. A step table is a list of changes,
made one short step at a time. The chip itself advances the step table and
the arpeggio. By default it takes one step every 60th of a second. The old
machines' sound drivers worked the same way, updating their chips once a
frame. Vibrato and the sweeps change smoothly, not in steps.

A sound can be played on its own, as a game plays a coin's chime. A song
plays its notes on sounds too.

---

## Getting a Chip

### A Chip for Music, and One for Sound Effects

A game usually makes two chips. One plays the music, and the other plays
the sound effects. There are two reasons:

- **A sound may take a song's voice.** A chip has only four voices. When a
  sound is played and no voice is free, it may take a voice that a song is
  using. That part of the song goes quiet until its next note takes the
  voice back. The old consoles did the same, but it's rarely what you want.
- **A fade fades the whole chip.** When you fade a song out, every voice on
  its chip fades with it, sounds included. On a chip of their own, the
  sound effects play on at full volume.

Two chips also let the listener set the music and the sound effects to
different volumes, with a slider for each.

### In a Browser

`createAudio80` makes a chip that plays through the browser's Web Audio.
An `AudioContext` is the browser's object for playing sound. Both chips
can share one:

```ts
import { createAudio80 } from 'audio90';

const context = new AudioContext({ latencyHint: 'interactive' });
const music = createAudio80({ context });
const sfx = createAudio80({ context });

// A browser starts sound only after the visitor does something
const start = (): void => void context.resume();
for (const gesture of ['pointerdown', 'keydown', 'touchend']) {
    addEventListener(gesture, start, { capture: true });
}

music.ready.catch(() => {
    console.warn('No sound here: AudioWorklet needs a secure page');
});
```

The chip computes its sound in an `AudioWorklet`. That's browser code that
runs on a thread of its own, so a busy frame on the page doesn't interrupt
the sound. Only a secure page has one, which means a page served over
HTTPS, or from `localhost`.

If you give a chip no `context`, it makes its own. It also starts it at the
page's first click, tap or key press, so you don't need the listeners
above. That suits a page with one chip. With two, share a context, as here,
so the browser doesn't run two.

`createAudio80` takes these options. Every one is optional:

| Option | Meaning | Default |
| --- | --- | --- |
| `context` | The `AudioContext` to play in. With one, starting it is your job | a context of its own, started at the first gesture |
| `pauseWhenHidden` | Whether the chip holds its sound while the page is hidden, as `pause` does. Turn it off for sound that should play on in the background, such as a music player's | `true` |
| `character` | How gritty the chip sounds, below | `'classic'` |
| `onRow`, `onEnded` | Functions the chip calls as its songs play, for a page with no game loop. [Being Told as a Song Plays](#being-told-as-a-song-plays) explains them | none |

**The character.** A sharp jump in a wave adds a harsh, out-of-tune buzz
to high notes. This buzz is called aliasing. Band limiting is a way of
smoothing the jumps so that they don't alias. Each voice makes its wave
with an oscillator. With `'clean'`, the oscillators are band-limited at
full resolution. With `'classic'`, they are band-limited and reduced to 12
bits, which makes their levels coarser. With `'raw'`, they alias freely,
and each voice is reduced to 8 bits. Band limiting smooths only the jumps
in the saw and pulse waves. Combined waves, noise, wavetables, ring
modulation and hard-synced voices alias in every character.

### Before the Chip Can Play

The chip's `ready` promise resolves once it can play, or rejects if it
can't, as on a page with no `AudioWorklet`. The chip also can't play while
its `AudioContext` isn't running. A browser starts a context only after the
visitor clicks or presses a key. It can also suspend one later, as a phone
does when a call comes in. Your game keeps running meanwhile, and keeps
calling the chip. The chip handles those calls in three ways:

- **It drops sounds.** They are never played late, since a coin's chime a
  second after the coin would be confusing.
- **It keeps each `stop`.** So a held sound that started before the wait
  still stops.
- **It starts a song played meanwhile from its beginning,** once it can
  play.

So your game never needs to wait for the chip, or check whether it's
ready before it plays.

### Loading the Chips Later

Each browser chip carries its worklet's code inside it, so there's no file
to copy beside your page. The code for both chips is about 55 KB, minified. A page
that wants to show something before that arrives can load it later, the
first time the visitor clicks or presses a key.

There's a catch. Your songs and sounds also come from `audio90`, and the
page needs them at once. A dynamic `import('audio90')` would then bring the
whole package into the page's first load. So put the chips' factories in a
module of your own:

```ts
// browser-chips.ts
export { createAudio80, createAudio90 } from 'audio90';
```

Then load that module with `import('./browser-chips')`. A bundler then
splits the chips' code off into its own file. Until it arrives, hand your
game stand-ins that drop what they're asked to play, so nothing waits for
the download.

### Without a Speaker

`createHeadlessAudio80`, from `audio90/headless`, makes a chip with no
speaker. It takes every call a browser chip takes, and makes no sound. A
game run without a speaker, as in Node or in a test, plays on one. Its song
moves on only when you call its `update(deltaMs)`, so a test is exact. The
[headless README](../src/headless/README.md) covers it, and the tools that
render sound in memory, measure it and save it as WAV files.

---

## Sounds

A sound says how a note sounds. You make it once, when the module loads,
with `createAudio80Sound`:

```ts
import { createAudio80Sound } from 'audio90';

/** A coin: a bright blip up a fifth. */
export const COIN = createAudio80Sound({
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

Then you play it on a chip, as the coin is collected:

```ts
sfx.play(COIN);
```

A note is written as a letter, then `-` or `#`, then an octave number. The
`#` makes it a sharp, one semitone higher. So `E-6` is the E in octave 6,
and `C-4` is middle C. A semitone is the step from one piano key to the
next, and 12 semitones make an octave. A fifth is 7 semitones.

### Sound Options

`createAudio80Sound` takes these options. Every one is optional. A mistake
throws an error that says what's wrong.

| Option | Meaning | Default |
| --- | --- | --- |
| `wave` | The waveform | `pulse` |
| `pulseWidth` | 0 to 1. For a lone pulse, it is the share of each cycle at one level. `w` sounds the same as `1 - w`, and 0.5 is a square. In a combined wave, the pulse lets the other waves through from `pulseWidth` of the way through each cycle to its end | 0.5 |
| `wavetable` | 32 hex digits, each a level `0` to `F`. Spaces are ignored | |
| `envelope` | `{ attackMs, decayMs, sustain, releaseMs }`. `sustain` is a level from 0 to 1. `decayMs` is the time to fall to 60 dB below the peak (a thousandth of its level), or to `sustain` | a 2 ms attack, full sustain, a 60 ms release |
| `volume` | 0 or more | 1 |
| `filter` | `'a'` or `'b'` | neither |
| `echo` | How much of each note goes to the echo, 0 to 1 | 0 |
| `note` | The note it plays when it's played with no note, or named in a song with no note, as for drums | `C-4` |
| `glideTo` | A note to glide to, moving smoothly in pitch over the play's length, for a zap down or a rising whine | |
| `lengthMs` | How long it holds its note when played, before its release | the step table's length, or 250 |
| `priority` | When no voice is free, it may take the voice of a sound with the same or lower priority | 0 |
| `maxVoices` | The most voices it plays on at once. Playing it again at that limit restarts its oldest copy | 1 |
| `stepMs` | How long each step lasts, for the step table and the arpeggio | 1000 / 60 |
| `steps` | A step table, a string in backticks with one step on each line | |
| `arpeggio` | Semitone offsets, one per step, repeating (`[0, 4, 7]`) | |
| `vibrato` | `{ semitones, hz, delayMs }`. How far the pitch wavers, how many times a second, and how long it waits after the note starts | |
| `pulseSweep` | `{ to, ms, isPingPong }`. Sweeps the width from `pulseWidth` to `to` over `ms`, once or back and forth | |
| `filterSweep` | `{ fromHz, toHz, ms }`. Sweeps the cutoff of the sound's filter on each note | |
| `syncSource`, `ringSource` | Another voice's index, for hard sync or ring modulation. A song's channel 0 plays on voice 0, and so on, so these suit sounds in songs | |

A few settings are worth knowing by heart:

- **A pluck**: `envelope: { attackMs: 1, decayMs: 200, sustain: 0, releaseMs: 60 }`.
- **A held tone**: `sustain` above 0, with `releaseMs` for how it fades after release.
- **A shifting pulse**: `pulseSweep: { to: 0.6, ms: 900, isPingPong: true }`.
- **A plucked bass**: a saw through filter `a`, with `filterSweep: { fromHz: 2400, toHz: 450, ms: 180 }`.

**The filters and the echo belong to the chip.** A song sets them as it
starts, and a filter sweep moves its filter for every voice routed through
it. On a chip that plays only sounds, nothing sets them. There, each filter
stays a low pass at 2,000 Hz with no resonance, which a sound's sweep or
step table can move. The echo stays at a 300 ms delay, with each repeat at
0.35 of the last and the echo at half volume.

**Wavetables** give the softer, rounder tones of early arcade boards. A
wavetable drawn from an FM tone sounds closer to the 1990s. FM tones are
the sound of the FM synthesis chips in many sound cards and consoles of
that time:

```ts
const SINE = '89AC DEEF FFEE DCA9 8653 2110 0011 2356';
const BELL = '7CEF FEDD DFFD A766 7998 5200 2221 0013';
```

### Step Tables

Most sounds for games are shaped by a **step table**. A step table is a
string in backticks. Each line is a row, and each row is one step. Each
step lasts `stepMs`, which is a 60th of a second by default. A setting that
a row changes stays until a later row changes it. The last row's settings
stay in effect until the note ends. A row holds any of these tokens, at
most one of each kind:

| Token | Meaning | Example |
| --- | --- | --- |
| A wave | Switch waveform | `noise`, `pulse`, `saw+pulse` |
| A relative pitch | Semitones from the note | `+12`, `-5` |
| A note | That exact pitch, ignoring the note played | `C-6` |
| `v` and a hex digit | Volume, `0` to `F` | `vA` |
| `p` and a hex digit | Pulse width, in sixteenths | `p4` |
| `f` and a hex digit | The cutoff of the sound's filter (ignored without a `filter`) | `f8` |

```ts
/** A rock breaking: a burst of noise, falling. */
export const BREAK = createAudio80Sound({
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

### Playing a Sound

`Audio80.play` plays a sound now, and returns the play's id. A second
argument changes this one play. Each option defaults to the sound's own:

| Option | Meaning |
| --- | --- |
| `note` | The note to play, as a name such as `'E-5'`, or a note number. Note numbers count semitones, as MIDI (the standard for music hardware) does, and 60 is middle C, `C-4` |
| `glideTo` | A note to glide to over the play's length |
| `lengthMs` | How long to hold the note before releasing it, above 0. `Infinity` holds it until you stop it |
| `volume` | 0 or more, which scales the sound's own volume |

So one sound can make several effects. Here one blip plays a menu's moves
up and down:

```ts
const BLIP = createAudio80Sound({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    lengthMs: 40,
});

sfx.play(BLIP, { note: 'C-6' }); // up
sfx.play(BLIP, { note: 'G-5' }); // down
```

**A sound that lasts as long as something does,** such as an engine while
it thrusts, is held. Play it with a `lengthMs` of `Infinity`, keep its id,
and stop it when the thrust ends. `Audio80.stop` releases the note, so it
fades out as its envelope's release says:

```ts
const thrust = sfx.play(ENGINE, { lengthMs: Infinity });
// ...later, when the thrust ends
sfx.stop(thrust);
```

`stop` does nothing if the play has already ended, or if another sound has
taken its voice. So you never need to check first.

**A sound that repeats,** such as an alarm while fuel is low, is played
again each time it's due. Count the time with your game's own clock, not
`setTimeout`, so the repeats pause when your game pauses.

### Which Voice a Sound Gets

The chip chooses a voice for each sound you play, in this order:

1. If the sound already plays on `maxVoices` voices, it restarts on the
   oldest of them. So rapid fire with the default `maxVoices: 1` uses only
   one voice.
2. Otherwise it takes a free voice, from the top down, starting at voice 3.
3. If none is free, it takes the oldest voice that is playing a song's note,
   or a sound with the same or lower `priority`.
4. If there's no such voice, the sound doesn't play.

A song takes its voices from the bottom up, so channel 0 plays on voice 0.
That's why sounds start from the top. But on a chip of their own, sounds
have all four voices to share.

Give the sounds that must be heard a higher priority than the ones that
can be lost in a crowd. The player's death and a stage cleared must be
heard. Shots and ticks can be lost.

### Recipes

| Sound | How |
| --- | --- |
| A laser shot | A pulse falling an octave or so over five or six fast steps, the width narrowing |
| An explosion | Noise falling in pitch and volume over a third of a second. Bigger is slower and lower, with a triangle step for a thump |
| A coin or pickup | A pulse stepping up a chord (`+0`, `+7`, `+12`) at 25 to 45 ms a step, with a little echo |
| A jump | A triangle or pulse with `glideTo` a fifth or an octave up, 100 to 150 ms |
| A hit | A step of noise, then a low triangle falling |
| A menu blip | One or two short steps of pulse or a sine wavetable, quiet |
| An alarm | A short tone, played again every half second or so while it lasts |
| A machine's hum | Noise or a low pulse, held while the machine runs |

---

## Songs

A song is made of patterns, which are short blocks of music. Its order is
the list of patterns it plays, one after another. A looping song then goes
back to the place in the order that its `loop` option names, and repeats.
A song's `instruments` are the sounds it plays its notes on, each named by
one letter:

```ts
import { createAudio80Song } from 'audio90';

export const FANFARE = createAudio80Song({
    bpm: 150,
    instruments: { L: LEAD, B: BASS, k: KICK, h: HAT },
    patterns: {
        fanfare: `
            # lead      | bass      | drums
            | E-5 L v9  | E-2 B     | k
            | ...       | ...       | h
            | G-5       | E-3       | h
            | B-5 ~     | ...       | h
        `,
    },
    order: ['fanfare', 'fanfare+5'],
});
```

[Writing Tracker Music](writing-tracker-music.md) explains how to write
songs.

### Playing Songs

A chip plays one song at a time, on a sequencer of its own. A sequencer is
the part of a chip that plays a song, row by row. In a browser, it runs on
the audio thread, on the sound card's clock. So a late frame on the page
never holds the music up.

| Call | What it does |
| --- | --- |
| `play(song, options?)` | Starts `song` from its beginning, in place of any song playing, and cancels any song queued. Returns the play's id |
| `queue(song, options?)` | Plays `song` without a gap when the song playing reaches the end of its order, even if that song loops. If no song is playing, it starts at once. Returns the id of the play it follows, or a new id if it starts at once |
| `stop(id?, { fadeMs }?)` | Stops the song with that id, and any song queued after it, unless another song has been played since. With no id, it stops everything on the chip, the song and every sound |

A fanfare into a stage's loop is a play then a queue:

```ts
music.play(STAGE_FANFARE);
music.queue(STAGE_TUNE);
```

`queue` returns the fanfare's id, so stopping that id stops both.

### Play Options

`play` and `queue` take these options for a song. Each is checked as the
song is played, and a mistake throws an error that says what's wrong.

| Option | Meaning | Default |
| --- | --- | --- |
| `repeat` | How many more times the song's loop plays before the song ends. 0 plays to the end of its order once. A song with no `loop` ends at the end of its order whatever this says | `Infinity` |
| `pitch` | Semitones to play every note up, or below 0, down. It may be a fraction: 0.5 is a quarter tone, and a small fraction detunes the song, as a tape running fast would. A sound's own note, as a drum plays, isn't moved. A pitch that takes a note out of the chip's range throws | 0 |
| `fadeMs` | How long to fade the song in over, from silence | 0 |
| `startMs` | Where to start, in ms from the song's start, at its own tempo | 0 |
| `startAt` | Where to start, as `{ orderIndex, row }`: an entry in the song's order, and a row of its pattern, each counted from 0 | the start |

### Fading

A fade changes the chip's volume evenly in decibels, so it sounds even to
the ear. The chip fades as a whole, sounds included, which is one reason a
game plays its sound effects on a chip of their own.

- **To fade a song in,** play it with a `fadeMs`.
- **To fade a song out,** stop it with one: `stop(id, { fadeMs: 1000 })`.
  The song plays on as the chip fades, and stops as the fade ends. Then the
  chip cuts every voice, sounds included. Until then, the chip still
  reports the song, since it's still heard.

A song played during a fade-out starts at full volume. A song queued
during one starts as the fade ends. So a title tune can fade out into the
first stage's music:

```ts
music.stop(titleId, { fadeMs: 800 });
music.queue(STAGE_TUNE);
```

### Starting Part Way

A song can start part way through, in either of two ways. Give one or the
other, never both:

- **`startMs`** is a time, in ms from the song's start at its own tempo.
  It suits a seek bar, or music timed to a cutscene. It must be less than
  the song's `durationMs`, the length of one pass through its order. A
  start that falls inside a row waits for the next row to play.
- **`startAt`** is a place in the song: an entry in its order, and a row.
  It suits skipping to a section, such as past an intro. The row plays at
  once.

The song is heard from there as it would be on reaching it. Each channel
has the sound and settings the earlier rows left it with. But the notes
those rows started don't sound, so you hear the song from the first note
at or after the start.

### What the Chip Reports

The chip reports where its song has got to. It reports what the listener
hears now, not what was last asked for. In a browser, sound takes a moment
to reach the speaker, so the two differ a little. A display that shows the
song, as a tracker does, then shows the row being heard.

| Member | What it is |
| --- | --- |
| `song` | The song playing, or `undefined`. A song played, stopped, or queued with none playing shows here at once |
| `orderIndex` | The entry in the song's order whose row is heard now |
| `row` | The row heard now, within that entry's pattern |
| `beat` | How many beats the song has played, for things that pulse in time |
| `positionMs` | Where the song is in its order, in ms at its own tempo, 0 or more and less than its `durationMs`. It goes back as the song loops. It's what a seek bar shows |

Each is 0 when no song is playing. Playing a song with `positionMs` as its
`startMs` resumes it from where it was:

```ts
const at = music.positionMs;
music.stop();
// ...later
music.play(TUNE, { startMs: at });
```

### Tempo

`Audio80.tempoScale` multiplies the song's tempo. At 1, the song plays at
its own tempo. Above 1, it speeds up, and below 1, it slows down. Slides,
which move a note's pitch smoothly, keep pace.

At 0, the song holds where it is. Its notes ring on as their envelopes
allow, and its slides stop. That suits music that plays only while
something moves. A negative value, or one that isn't finite, acts as 0.

The chip sends the scale on only when it changes, so you can set it every
frame. A change made just before or just after `play` applies from the
song's start, so the tempo can follow the song just chosen.

### Being Told as a Song Plays

A game loop can read the chip's `song` and `row` each frame, and act on a
change. A page with no loop can have the chip tell it instead. Give these
functions as you make the chip:

```ts
const music = createAudio80({
    context,
    onRow: (song, orderIndex, row) => highlight(song, orderIndex, row),
    onEnded: () => showCredits(),
});
```

- **`onRow`** is called as the song reaches each row, the first row
  included.
- **`onEnded`** is called when a song ends by itself, at the end of its
  order, with no repeats left and no song queued. A song stopped with
  `stop`, or followed by a song queued after it, doesn't end this way.

In a browser, each is called as the audio thread reports the row or the
end. That's a moment before the listener hears it, by about the time the
sound takes to reach the speaker.

---

## Volume and Mute

Each chip has its own volume and mute:

| Member | What it does |
| --- | --- |
| `volume` | 0 to 1, where 1 plays songs and sounds as written. A value outside that range is clamped to it |
| `isMuted` | Silences the chip, whatever `volume` says |

A change settles over about 30 ms, so moving a slider doesn't click. Give
the listener a slider for each chip, the music and the sound effects. Turn
a slider's position into a volume by squaring it. Then equal steps of the
slider sound like equal steps in loudness:

```ts
music.volume = slider.valueAsNumber ** 2;
```

## The Mix and Loudness

Write each song and sound at the level it should be heard at. Then a
listener's sliders start from a good balance.

- **Songs** should be at the shared loudness, about -20 LUFS. LUFS is the
  standard unit for how loud sound seems to a listener. The values are
  negative, and nearer 0 is louder. The shared loudness is
  `REFERENCE_LOUDNESS_LUFS`, from `audio90/headless`, and
  `measureLoudness` measures a song rendered in memory. Set a song's
  `volume` to bring it to that level.
- **Sounds** should be loud enough to be heard over the music, and quiet
  enough not to clip. A sound clips when it is too loud for the output.
  The output then rounds off its loudest moments, which distorts it. Aim
  for a peak between about 0.08 and 0.3. The peak is the highest level the
  sound reaches, and the output holds levels up to 1. `measurePeak`
  measures it. Noise through a filter comes out quieter than its settings
  suggest, so give it more volume.

[Testing and Listening](#testing-and-listening) shows how to render a song
or sound in memory, to measure it.

---

## Using It with a Game Loop

A browser chip keeps the sound card's time, not your game's. So it plays
on whatever your game loop does, and a few things are up to you:

- **Pause the chip as your game pauses.** Call `Audio80.pause` as the game
  pauses, and `Audio80.resume` as it resumes. The chip's voices fade out at
  once and keep their place, and its song stops moving. When it resumes,
  everything carries on from where it was. A chip you don't pause plays
  on, so a pause menu can play its clicks on a chip of its own.
- **The page hidden.** A browser chip holds its sound while the page is
  hidden, and plays on as it shows again. It does so whether or not you
  paused it, and it leaves `isPaused` as it is. Make the chip with
  `pauseWhenHidden: false` for sound that should play on in the background.
- **Starting over.** `stop()` with no id stops everything on the chip. Call
  it as a game ends or a new one starts. While the chip is paused, it cuts
  every voice at once, rather than letting the notes fade out as it
  resumes.
- **Play a sound when something happens,** such as a coin being collected,
  not while a state holds. A sound played every frame while the player is
  dead is played sixty times a second.
- **Reading the chip each frame is cheap.** So is setting `tempoScale`
  every frame, since the chip sends it on only when it changes.

**Without a speaker,** as in a test, your game plays on a headless chip
from `audio90/headless`. Its clock moves on only when you call its
`update(deltaMs)`. Call it once each frame with the same `deltaMs` as your
game, and its song keeps exact time with your game:

```ts
import { createHeadlessAudio80 } from 'audio90/headless';

const music = createHeadlessAudio80();
music.play(FANFARE);
music.update(500);
// Half a second in, at 150 beats a minute and four rows a beat
console.log(music.beat, music.orderIndex, music.row); // 1.25 1 1
```

`FANFARE` is the song in [Songs](#songs). Its pattern is four rows long,
so half a second in, it's on the second row of its second entry.

The same game, run the same way, reaches the same rows at the same moment
every time. So a test can check what your game plays.

---

## Testing and Listening

You can render any song or sound in memory, without a speaker or a
browser. `render`, from `audio90/headless`, returns its samples. A sample
is the level of the sound wave at one instant. The Audio80's samples come
as one `Float32Array`, 48,000 a second by default.

**Listen** to a sound by saving it as a WAV file, in Node:

```ts
import { writeFileSync } from 'node:fs';
import { encodeWav, measurePeak, render } from 'audio90/headless';
import { COIN } from './sounds';

const samples = render(COIN);
console.log('peak', measurePeak(samples));
writeFileSync('coin.wav', encodeWav(samples, 48000));
```

**Audio tests** catch sounds that change by accident. Render each song and
sound, and check that it's audible and not clipped. Check that each song
is at the shared loudness too. Then snapshot a hash of its samples. A
change that alters the sound then fails the test. It keeps failing until
someone has listened to it and updated the snapshot with `vitest -u`.
`findSounds` finds every song and sound a module exports:

```ts
import { expect, it } from 'vitest';
import {
    findSounds, hashSamples, measurePeak, render,
} from 'audio90/headless';
import * as sounds from './sounds';

const AUDIBLE = 0.05;
const CLIPPING = 0.9;

for (const [name, sound] of findSounds(sounds).sounds) {
    it(`${name} sounds as it did, audible and unclipped`, () => {
        const samples = render(sound);
        expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
        expect(measurePeak(samples)).toBeLessThan(CLIPPING);
        expect(hashSamples(samples)).toMatchSnapshot();
    });
}
```

The [headless README](../src/headless/README.md) covers rendering,
measuring and testing in full.

---

## When It Goes Wrong

| Symptom | Likely cause |
| --- | --- |
| Nothing plays at all | The `AudioContext` hasn't been started. A browser starts one only in the handler of a click, tap or key press. If you gave the chip a context, resume it there |
| Nothing plays on a phone | The page isn't served over HTTPS, and `AudioWorklet` needs a secure page. The chip's `ready` rejects |
| Sound plays on while the game is paused | The game doesn't call the chip's `pause` as it pauses |
| A song loses notes while sounds play | The sounds play on the music's chip, and take the song's voices. Play them on a chip of their own |
| Fading the music out fades the sound effects too | They share a chip. A fade fades the whole chip |
| A sound is cut short or never heard | No voice was free and its `priority` was too low, or it reached its `maxVoices` and restarted |
| A sound sounds wrong only after a song has played | The song set its chip's filters or echo, and the sound goes through them |
| A sound plays over and over, or buzzes | It's played every frame while a state holds, not once as something happens |
| `play` throws for a song | An option isn't valid, or its `pitch` takes a note out of the chip's range. The error says which |
