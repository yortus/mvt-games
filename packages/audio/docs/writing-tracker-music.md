# Writing Tracker Music

> This guide shows how to write music for the Audio80 as text. You define
> instruments, then patterns of rows and channels, then an order to play
> the patterns in. The guide builds one tune from a single note to a
> four-channel loop. It covers every token a cell can hold, and ends with
> arranging habits that suit the chip.

**Related:** [Using the Audio80](using-the-audio80.md) · [The package's README](../README.md)

---

## What a Tracker Is

A tracker is a way of writing music for sound chips. It was used on the
machines the Audio80 imitates. It is a grid read top to bottom. Each
**row** is a moment in time. By default a row is a sixteenth note, which is
a quarter of a beat. Each **channel** is a column, and is one voice of the
chip. A voice plays one note at a time, and the chip has eight of them. A
**cell** is where a row meets a channel. It says what that voice does at
that moment. It can start a note, change something about the note
playing, or do nothing at all.

```ts
const tune = `
    // lead | bass
    C-5 L   | C-3 B
    ...     | ...
    E-5     | ...
    ===     | ===
`;
```

Here the lead channel plays the melody, and the bass channel plays the low
notes beneath it. In row 0, both channels start a note. In row 1, both
carry on. In row 2, the lead moves to E. In row 3, both release their
notes. To release a note is to stop it, so that it fades out.

In this package the grid is plain TypeScript. Each **pattern** is a string
in backticks, with one row on each line. The indentation of each line is
ignored. Blank lines are skipped, so you can use them to split a pattern
into bars. A line that starts with `//` is a comment, such as the column
headings above, and is skipped too. Neither counts as a row.

`createSong` reads the grid once, when the module loads. If there is a
mistake, it throws an error naming the pattern, row and channel, counted
from 0. A typo fails the tests that import the module, not a game in
progress.

---

## A First Tune

Start with one instrument and one channel:

```ts
import { createInstrument, createSong } from '@mvtjs/audio';

/** A plucked square, ringing a little. */
const LEAD = createInstrument({
    wave: 'pulse',
    envelope: { attackMs: 2, decayMs: 300, sustain: 0.4, releaseMs: 150 },
});

export const HELLO = createSong({
    bpm: 120,
    instruments: { L: LEAD },
    patterns: {
        tune: `
            C-5 L
            ...
            E-5
            ...
            G-5
            ...
            C-6
            ...
            ===
        `,
    },
    order: ['tune'],
});
```

- **`wave`** is the shape of the sound wave, which sets the instrument's
  tone. The waves are `pulse`, `saw`, `triangle`, `noise` and `wavetable`,
  and [Using the Audio80](using-the-audio80.md#the-chip) describes them.
- **`envelope`** shapes each note's volume over time. The note rises to
  full volume over the attack. It then falls over the decay to the sustain
  level, and stays there while the note is held. When the note is
  released, it fades out over the release.
- **`bpm`** is beats per minute. By default a row is a sixteenth note, so
  four rows make a beat. `rowsPerBeat` can change that. At 120 BPM a row
  lasts 125 ms.
- **`instruments`** names each instrument by one letter. A cell can name
  the instrument for its note. Later notes in that channel use the same
  instrument until another is named.
- **`C-5 L`** starts the C an octave above middle C, using instrument `L`.
  A note is a letter, then `-` or `#`, then an octave, such as `C-4`,
  `F#5` or `A-3`. The `#` makes it a sharp, one semitone higher. A
  semitone is the step from one piano key to the next, and 12 semitones
  make an octave. `C-4` is middle C, note number 60.
- **`...`** changes nothing. The note carries on, as its envelope allows.
  An empty cell means the same.
- **`===`** releases the note. Its envelope's release begins.
- **`order`** lists the patterns to play. Without a `loop`, the song plays
  once. Then it frees its voices for sound effects.

Play it with a music player, from an audio view (a view that plays sound
and draws nothing), as [Using the Audio80](using-the-audio80.md#music)
shows. To listen to it
straight away, run `npm run audio:render -- path/to/music.ts`. It writes a
WAV file for each song and effect.

### Adding Channels

Each `|` starts another channel. Spaces are ignored, so use them to line up
the columns:

```ts
const BASS = createInstrument({
    wave: 'triangle',
    envelope: { attackMs: 2, decayMs: 200, sustain: 0.6, releaseMs: 80 },
});

export const HELLO = createSong({
    bpm: 120,
    instruments: { L: LEAD, B: BASS },
    patterns: {
        tune: `
            // lead   | bass
            C-5 L     | C-3 B
            ...       | ...
            E-5       | C-3
            ...       | ...
            G-5       | G-2
            ...       | ...
            C-6       | C-3
            ...       | ...
            ===       | ===
        `,
    },
    order: ['tune'],
});
```

The first row of the first pattern in `patterns` sets how many channels
the song has. Every row of every pattern must have that many cells. A row
with too few or too many throws an error.

### Adding Drums

A drum is an instrument with its own `note`. A cell that names it without a
note plays that note. Transposition, which plays a pattern higher or lower
(below), does not change it. So a kick always sounds the same.

A drum's sound usually comes from a step table. A step table is a list of
changes, with one row per short step. It is written like a pattern, as a
string in backticks with one row on each line. Blank lines and `//`
comments are skipped, as in a pattern. Each step lasts the instrument's
`stepMs`, a 60th of a second by default. Each row can switch the wave,
move the pitch by some semitones, or set the volume (`v` and a hex digit).
A setting stays until a later row changes it:

```ts
/** A kick: a click of noise, then a triangle dropping fast. */
const KICK = createInstrument({
    note: 'C-3',
    envelope: { attackMs: 0, decayMs: 170, sustain: 0, releaseMs: 0 },
    steps: `
        // wave    pitch
        noise      +24
        triangle   +7
        triangle   +0
        triangle   -5
    `,
});

/** A snare: noise over a short, low body. */
const SNARE = createInstrument({
    note: 'D-5',
    stepMs: 20,
    envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 0 },
    steps: `
        noise      +0      vF
        triangle   -24     vC
        noise      +0      vB
    `,
});

/** A closed hat: a tick of high noise. */
const HAT = createInstrument({
    wave: 'noise',
    note: 'C-7',
    envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 0 },
    volume: 0.25,
});
```

```ts
tune: `
    // lead   | bass     | drums
    C-5 L     | C-3 B    | k
    ...       | ...      | h
    E-5       | C-3      | s
    ...       | ...      | h
`,
```

The kick, snare and hat stand for the bass drum, snare drum and hi-hat
cymbal of a drum kit. The song names them with
`instruments: { L: LEAD, B: BASS, k: KICK, s: SNARE, h: HAT }`. Lower case
for drums is only a habit. Any single letter will do.

---

## Rows and Time

| Setting | Meaning | Default |
| --- | --- | --- |
| `bpm` | Beats per minute, above 0 | (required) |
| `rowsPerBeat` | Rows per beat, a whole number. 4 makes a row a sixteenth note, 2 an eighth | 4 |
| `swing` | 0 to 0.5. Delays rows 1, 3, 5, ... of a pattern by this fraction of a row | 0 |

A row lasts `60000 / (bpm * rowsPerBeat)` ms. Rows are timed in
milliseconds, not frames, so a song keeps its tempo at 60 Hz and at 144 Hz.
`computeSongDurationMs(song)` returns how long one pass through the order
lasts, in ms. Swing does not change it.

A little swing, 0.1 to 0.2, makes a rhythm of sixteenths feel looser and
less mechanical. More makes a shuffle, a bouncing rhythm of long and short
notes.

---

## What a Cell Can Hold

A cell holds tokens separated by spaces, in any order. Each kind of token
may appear at most once in a cell. A note and `===` count as the same
kind.

| Token | Meaning | Lasts | Example |
| --- | --- | --- | --- |
| Note | Starts a note. A letter, `-` or `#`, then an octave | until released or replaced | `C-4`, `F#5` |
| `...` or nothing | No change | | |
| `===` | Releases the note | | |
| One letter | The instrument. Without a note, it plays the instrument's own note. Only a letter on its own is an instrument. A letter with digits after it, such as `v9`, is an effect | in the channel, until another is named | `L`, `k` |
| `v` and a hex digit | Volume, `0` to `F`. With a note, sets that note's volume. On its own, changes the volume of the note already playing | the note | `v9` |
| `a` and two hex digits | Arpeggio, which steps quickly through the notes of a chord. With the digits x and y, it plays the note, then x semitones up, then y up, one step each, and repeats. `a00` turns arpeggio off, even the instrument's own | the note | `a37` |
| `~` | Vibrato, which makes the pitch waver. It wavers by a quarter of a semitone, six times a second | the note | `~` |
| `~` and two hex digits | Vibrato. Depth in eighths of a semitone, then rate in Hz | the note | `~46` |
| `>` | Glides from the last note to this one, moving smoothly in pitch over the row | the row | `G-5 >` |
| `u` and two hex digits | Slides up that many semitones over the row. The pitch stays there until the next note | the row | `u0C` |
| `d` and two hex digits | Slides down, the same way | the row | `d05` |
| `p` and a hex digit | Pulse width, in sixteenths. A pulse wave jumps between two levels, and its width is the share of each cycle it spends at one of them. `p8` is a square | the note | `p4` |
| `f` and a hex digit | Filter cutoff, the frequency where the filter starts to cut the sound. It runs from `0` (80 Hz) to `F` (about 14.5 kHz). Sets the filter the channel's instrument goes through. Ignored if the instrument has no `filter` | until changed | `f8` |

In the Lasts column, "the note" means the note in the same cell. If the
cell has no note, it means the note already playing. The next note starts
again from its instrument's own settings. So `a37` on a chord's first row
lasts until the next note. The next chord needs its own `a` token.

Hex digits are `0` to `9` and `A` to `F`, in either case. `vF` is full
volume and `v8` is about half. `a7C` is a fifth (7 semitones) and an
octave (12 semitones).

---

## Chords, Vibrato, Glides and Slides

### Chords as Arpeggios

A voice plays one note at a time. So a chord on one channel is played as an
arpeggio. The voice steps through the chord's notes so fast that the ear
hears them together. It is the sound of the 8-bit era.

| Chord | Token | Notes, from C |
| --- | --- | --- |
| Major | `a47` | C E G |
| Minor | `a37` | C E♭ G |
| Sus4 | `a57` | C F G |
| Power (fifth and octave) | `a7C` | C G C |
| Diminished | `a36` | C E♭ G♭ |
| Augmented | `a48` | C E G♯ |

Each step lasts the instrument's `stepMs`, a 60th of a second by default.
A longer `stepMs`, 40 to 60 ms, makes a rippling arpeggio rather than a
chord. An instrument's own `arpeggio` option, such as `[0, 4, 7, 12]`,
does the same for every note it plays.

### Vibrato

`~` on a held note makes it waver. Vibrato suits long notes better than
short ones. An instrument can also have its own vibrato. It can have a
delay, so that short notes end before it starts:
`vibrato: { semitones: 0.2, hz: 5.5, delayMs: 180 }`.

### Glides and Slides

`>` glides from the channel's last note to the new one over the row. This
is called portamento, and it suits leads and basses. `u0C` slides up an
octave over the row, for a rising zip. `d0C` slides down an octave, for a
bass drop. A slide lasts one row, and the pitch stays where it ended. To keep
sliding, repeat the token on each row.

### Filters and Pulse Width

A filter cuts some of the frequencies from the sound that passes through
it. Its cutoff is the frequency where it starts to cut. A low-pass filter
keeps the frequencies below its cutoff, so it makes a sound duller. A
high-pass filter keeps those above it, so it makes a sound thinner. A
band-pass filter keeps only those near it, and a notch filter removes only
those near it. Resonance boosts the frequencies near the cutoff, for a
ringing or whistling tone.

`f` sets the cutoff of the filter that the channel's instrument is routed
through, as in `filter: 'a'`. It does nothing if the instrument has no
filter. For a build-up, write a filter sweep into the music. A sweep is a
steady move from one value to another. Raise `f` by one each row across a
bar, which is a group of beats, usually four. The filter belongs to the
chip, and everything routed through it shares it. So `f` on one channel
moves it for every channel on that filter.

`p` sets a pulse instrument's width for the note. `p8` is a square. `p2`
is thin and nasal, and `pE` sounds the same.

---

## Patterns and the Order

A song can have any number of named patterns. The order lists which to
play, in sequence:

```ts
patterns: {
    intro: `...`,
    verse: `...`,
    chorus: `...`,
},
order: ['intro', 'verse', 'chorus', 'verse+5', 'chorus'],
loop: 1,
```

- **Transposition.** `'verse+5'` plays `verse` five semitones up, and
  `'verse-2'` plays it two down. A drum named without a note keeps its own
  note. A transposition throws an error if it takes a note outside the
  chip's range of note numbers 0 to 127.
- **`loop`** is the index in the order to go back to after the last one.
  `loop: 1` plays the intro once, then repeats the rest. Without it, the
  song plays once.
- Patterns can have any number of rows, and need not be the same length.

Writing a pattern once and transposing it is the cheapest way to make a
song longer without making it repetitive.

---

## A Song's Settings

| Option | Meaning |
| --- | --- |
| `instruments` | One letter each, as cells name them |
| `filters` | `{ a, b }`, set as the song starts. Each filter has a `mode`, `cutoffHz`, `resonance` and `drive` (0 to 1). Drive pushes the filter's input harder, for a slight growl. The modes are `lowpass`, `bandpass`, `highpass`, `notch`, `lowpass+bandpass` and `bandpass+highpass` |
| `echo` | `{ timeMs, feedback, level }`. The chip's echo, set as the song starts. `timeMs` is the delay before each repeat, and is at most 1000. `feedback` is how much of each repeat is echoed again, and is at most 0.95. `level` is how loud the echo is |
| `volume` | A gain on every note. A gain is a number that the volume is multiplied by. At 1 the song plays as written. Brings a song to the shared loudness (below) |

**Echo in time.** An echo a dotted eighth long sits behind a melody without
muddying it. A dotted eighth is three rows of sixteenths. At 150 BPM a
row is 100 ms, so use `timeMs: 300`. Each instrument's `echo` option, such
as `echo: 0.3`, sets how much of its sound goes to the echo.

**Sharing a band.** Songs in one game usually share their instruments,
filters and echo. Put them in one object and spread it:

```ts
const BAND = {
    instruments: { L: LEAD, C: CHORD, B: BASS, k: KICK, s: SNARE, h: HAT },
    filters: {
        a: { mode: 'lowpass', cutoffHz: 1200, resonance: 0.6, drive: 0.3 },
    },
    echo: { timeMs: 300, feedback: 0.35, level: 0.4 },
} satisfies Partial<SongOptions>;

export const STAGE_TUNE = createSong({
    ...BAND,
    bpm: 150,
    patterns: { /* ... */ },
    order: ['a', 'b'],
    loop: 0,
});
```

---

## Channels, Voices and Loudness

The chip has eight voices. While a song plays, it reserves one voice per
channel, from voice 0 up. Sound effects share the rest, from voice 7 down.
A four-channel song leaves four voices for effects, which suits most
games. A game with many sounds at once is better served by a
three-channel song. The Arcade's games use two to four channels.

**Loudness.** Every song is written to the same loudness, so one game's
music is not much louder than another's. The target is about -20 LUFS
(`REFERENCE_LOUDNESS_LUFS`), give or take `LOUDNESS_TOLERANCE_LU`. LUFS
is the standard unit for how loud sound seems to a listener. The values
are negative, and nearer 0 is louder. Songs are measured the way
streaming services measure loudness.
`npm run audio:render` prints each song's loudness. If a song comes out
louder or quieter, set its `volume`. It scales every note equally, so the
balance between channels stays the same. The game's sounds test checks
each song's loudness.

---

## Arranging for the Chip

A few habits do most of the work:

- **Give each channel a job.** Use one for a lead, one for chords as
  arpeggios, one for a bass and one for drums. Two voices playing the same
  part sound like one, louder.
- **Move the bass.** Octave jumps on eighths (`C-2`, `C-3`, `C-2`, `C-3`)
  drive a fast tune. A bass sounds plucked if its filter closes (its
  cutoff falls) on each note, as with `filterSweep: { fromHz: 2400, toHz: 450, ms: 180 }`.
- **Leave space.** Release notes (`===`) before the next phrase. Rests,
  the silences between notes, are what make a melody singable.
- **Keep the lead out of the chords' octave.** Arpeggios an octave or two
  below the lead keep both clear.
- **Keep drums short.** Play the hat at a quarter volume. Make the kick and
  snare fade out in under 200 ms.
- **Choose a sound for the era.**

| Era | Instruments |
| --- | --- |
| Early 1980s arcade boards | `wavetable` voices (soft, buzzy), short plucks, little echo |
| 1980s home computers | Pulse leads with a `pulseSweep`, saw basses through a resonant filter, noise drums, arpeggio chords |
| 1990s | `wavetable` shapes drawn from FM tones (the sound of that decade's FM synthesis chips), saws through a gentle low-pass, slow attacks, delayed vibrato, plenty of echo |

A wavetable is a wave shape that you draw yourself. It is written as 32
hex digits, each a level from `0` to `F`.
`'89AC DEEF FFEE DCA9 8653 2110 0011 2356'` is a sine. Draw your own, or
work one out from a formula and round each of the 32 points to 0 to 15. A
sine with some of its second harmonic sounds like an electric piano. The
second harmonic is a sine at twice the frequency, an octave higher.

---

## When It Goes Wrong

`createSong`, `createInstrument` and `createSoundEffect` throw an error
when the module loads. The message says where the mistake is. Rows,
channels, steps and order entries are counted from 0. Blank lines and
comment lines are not counted as rows or steps. A song's message starts
with the place:

- `song: pattern 'verse', row 3, channel 1:` for a cell
- `song: pattern 'verse', row 4:` for a row
- `song: order entry 3 ('verse+5'), pattern 'verse', row 0, channel 1:`
  for a problem found while walking the order
- `song:` alone for anything else

The table shows what follows the place:

| Message | Cause |
| --- | --- |
| `unknown instrument 'Q'` | A letter not in `instruments` |
| `expected 3 cells (one per channel), found 2` | A missing or extra `\|` |
| `two notes` | Two notes in one cell, or a note and `===`. Often a missing `\|` |
| `two volumes`, `two glides`, `two slides`, ... | The same kind of token twice in one cell |
| `a release (===) cannot name an instrument` | `=== L`. A release applies to the note already playing |
| `a release (===) cannot take a volume` | `=== v4`. A release ends the note, so it cannot set the note's volume |
| `a glide needs a note to glide to` | `>` without a note |
| `'H-4' is not a note, an instrument or an effect` | A note name outside `A` to `G`, or a misspelt token |
| `'A-9' is above G-9, the highest note` | A note above G-9 (note number 127) |
| `a note with no instrument named on this channel before it` | A channel's first note in playing order names no instrument |
| `note 120 transposed by 12 is 132, outside the chip's range (0 to 127)` | A transposition in the order takes a note out of range |
| `order names 'chrous', which is not a pattern` | A typo in the order |
| `loop 3 is not an index into its order (0 to 2)` | A loop past the end |
| `bpm must be above 0; got 0` | Likewise `rowsPerBeat` (a whole number, 1 or more), `swing` (0 to 0.5) and `volume` (above 0) |

An instrument's or effect's message names the step or the option instead:

| Message | Cause |
| --- | --- |
| `step 2: two waves` | The same kind of token twice in one row of a step table |
| `wavetable: needs 32 hex digits, one level (0-F) each; got '...'` | A wavetable of the wrong length, or a character that is not hex |
| `instrument: an arpeggio has at most 16 notes; this one has 17` | An `arpeggio` option that is too long |
| `instrument: a filter sweep's fromHz and toHz must be above 0; got 0 and 450` | A `filterSweep` to or from 0 Hz |
| `effect note: 'C4' is not a note (write C-4, F#5)` | A misspelt note. Likewise for `instrument note:` and `effect glideTo:` |
| `effect: lengthMs must be above 0; got 0` | A `lengthMs` of 0 or less |
| `effect: give either an instrument or the options to make one, not both; found wave with the instrument` | `instrument` given together with instrument options |

A song that parses but sounds wrong is usually one of these:

- **A note goes on and on.** It is never released, and its instrument
  sustains. Add `===`, or give the instrument a sustain of 0.
- **A drum is transposed.** Write it without a note (`k`), not with one.
- **Everything is too quiet or too loud.** Check the loudness that
  `audio:render` prints, and set the song's `volume`.
- **A filter does not move.** `f` does nothing on a channel whose
  instrument has no `filter`.

---

## Your Own Music

The Arcade's games and their music are original. Being inspired by a
classic is fine, but transcribing one is not. Write your own melodies, in
the spirit of the era. The chip and these habits will do the rest.
