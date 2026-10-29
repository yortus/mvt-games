# Using the Audio90

> The Audio90 is a virtual sound chip in the spirit of the synthesisers,
> samplers and game consoles of the 1990s. It has sixteen stereo voices, and
> each voice can play FM, analog or samples. This guide shows you how its
> engines, sounds and samples work, how to place sounds in stereo, how to
> mix them, and how to change the way the chip sounds. It ends with recipes
> for the decade's sounds. A lot works just as it does on the Audio80, so
> the guide points you to the Audio80's guide for those parts.

**Related:** [Using the Audio80](using-the-audio80.md) · [Writing Tracker Music](writing-tracker-music.md) · [The package's README](../README.md)

---

## Which Chip

The package has two chips. Pick the one that matches your game's decade.

| | Audio80 | Audio90 |
| --- | --- | --- |
| Spirit | 1980s home computers | 1990s synthesisers, samplers and consoles |
| Voices | 4, mono | 16, stereo |
| What a voice plays | Pulse, saw, triangle and noise waves, combined, or a wavetable you draw | FM, analog oscillators, or a sample |
| Filters | Two, shared by the voices routed through them | One for each voice |
| Effects | An echo | A reverb, a stereo echo and a chorus, and the pump |
| Suits | Chiptune, arcade and 8-bit games | Dance music, 16-bit games, and anything you want in stereo |

You use both chips the same way. You make a chip for your music and
another for your sound effects. You play songs and sounds on them, and you
pause them when your game pauses. These parts work the same on both chips,
so [Using the Audio80](using-the-audio80.md) covers them once. Read it for
these:

- **Getting a chip**, starting the sound once the player does something,
  and pausing the chip with your game.
- **Songs**: playing, queueing and stopping them, how many times they
  repeat, transposing them, fading them in and out, and starting them part
  way.
- **Which voice a sound gets**, with `priority` and `maxVoices`.
- **Testing and listening**, with chips that have no speaker.

This guide covers what's new on the Audio90.

---

## The Chip

The chip has sixteen **voices**, and each one plays one note at a time. A
voice makes its sound with one of three **engines**:

| Engine | How it makes a sound | Good for |
| --- | --- | --- |
| **FM** | Up to four sine waves, called operators. One pushes another faster and slower many times a cycle. A gentle push adds a few overtones, and a hard one adds many | Electric pianos, bells, basses, brass, and the bright sound of the decade's consoles and sound cards |
| **Analog** | Oscillators that make saw, pulse, triangle and sine waves, through a filter, as synthesisers built from analogue circuits did | Pads, leads, acid basses, stabs and drums |
| **Sample** | A stored sound, played faster for higher notes and slower for lower ones | Orchestra hits, drum breaks, choirs, and anything you bounce from the other engines |

The sound a note plays decides which engine runs. So one voice can play an
FM bass, then a sampled snare straight after.

After its engine, every voice goes through the same stages:

1. A **filter**. A filter cuts some of the frequencies from a sound. A
   low-pass filter makes it duller, and a high-pass filter makes it
   thinner. It's off unless the sound has one.
2. A **volume envelope**, which shapes how each note rises and fades.
3. A **pan**, from -1 (left) to 1 (right). A sound keeps the same loudness
   as you move it across.
4. The **dry mix**, and three **sends**. A send is how much of the voice
   goes to an effect: the reverb, the echo or the chorus.

Each voice also has two things that change a note while it plays. A **mod
envelope** moves the pitch, the filter's cutoff or the brightness. An
**LFO** (low-frequency oscillator) is a slow wave that wobbles a setting,
such as the pitch or the pan. Each voice also has the Audio80's driver,
which steps through arpeggios and step tables, 60 steps a second by
default.

The chip keeps a few limits. They make it feel like a chip, and they mean
a busy moment has to make choices:

- **Sixteen voices** (`AUDIO90_VOICE_COUNT`).
- **Four operators** for each voice, and up to **seven** copies of an
  analog oscillator.
- **48 analog oscillators** across the whole chip. If a note would go over
  that budget, it plays with fewer copies instead, so you never lose it.
- **Sample memory** of 262,144 samples (`AUDIO90_SAMPLE_MEMORY`), which is
  about 8 seconds at 32 kHz.
- **One of each effect**, shared by every voice on the chip.

The `Audio90` has every member the Audio80 has, and two more things. Its
`play` takes a `pan` for a sound, which [Sounds in
Stereo](#sounds-in-stereo) describes. It also has a `stereoWidth`, which
[The Stereo Width](#the-stereo-width) describes.

---

## Getting a Chip

You make the Audio90 the same way as the Audio80, with `createAudio90`
from `audio90`. Make one for your music and one for your sound effects.
Give them the same `AudioContext`, the browser's object for playing sound.
A page needs only one, however many chips it plays, and an Audio80 can
share it too:

```ts
import { createAudio90 } from 'audio90';

// One audio context for the page, shared by both chips
const context = new AudioContext({ latencyHint: 'interactive' });
const music = createAudio90({ context });
const sfx = createAudio90({ context });
```

When you give the chips a context, starting it is your job. The
[Audio80's guide](using-the-audio80.md) shows you how, in "Getting a
Chip". Without a context, each chip makes its own, and starts it at the
page's first click, tap or key press.

`createAudio90` takes the Audio80's options: `context`, `pauseWhenHidden`,
`onRow` and `onEnded`. It also takes a `character`, which [The
Character](#the-character) describes.

**Without a speaker**, call `createHeadlessAudio90` from
`audio90/headless`. A headless chip takes every call a browser's chip
takes, and makes no sound. Its clock moves only when you call its
`update(deltaMs)`, so tests are exact. To hear a song or a sound in a test
or a tool, `render` from `audio90/headless` renders it in memory. For the
Audio90, it returns two `Float32Array`s, one for each side. The
[headless README](../src/headless/README.md) covers both.

---

## Sounds

A sound says which engine it uses, and sets that engine's options. A game
plays a sound on its own, as a laser or a coin. A song plays sounds too,
from its `instruments`, each named by a letter. Every option has a
default, so a simple sound is short. You make each one once, when your
module loads:

```ts
import { createAudio90Sound } from 'audio90';

/** A pad: five slow saws, swelling in, in the chorus. */
export const PAD = createAudio90Sound({
    oscillator: { wave: 'saw', unison: 5, detune: 0.25, spread: 0.9 },
    filter: { cutoffHz: 1800, resonance: 0.15 },
    envelope: { attackMs: 500, decayMs: 600, sustain: 0.85, releaseMs: 1200 },
    volume: 0.25,
    chorus: 0.3,
    reverb: 0.5,
});
```

If you make a mistake, `createAudio90Sound` throws an error that names the
option, such as `operators[3].ratio: 0.3 is not a multiple of 0.5`. Giving
one engine's option to another engine is a mistake too, such as
`operators` on an analog sound. So you find out as the module loads, not
halfway through a game. If you're writing an editor that lists sounds, a
sound's `engine` property gives you its engine's name.

### Options for Every Engine

| Option | Meaning | Default |
| --- | --- | --- |
| `engine` | `'fm'`, `'analog'` or `'sample'` | `'analog'` |
| `envelope` | `{ attackMs, decayMs, sustain, releaseMs }`, as on the Audio80. A volume envelope that decays to a sustain of 0 ends its note | a 2 ms attack, full sustain, a 60 ms release |
| `volume` | 0 or more | 1 |
| `pan` | -1 (left) to 1 (right) | 0 |
| `reverb`, `echo`, `chorus` | How much goes to each effect, 0 to 1 | 0 |
| `filter` | `{ mode, cutoffHz, resonance, drive, keyTrack, accent }`. The modes are `lowpass24`, `lowpass12`, `bandpass` and `highpass`. `lowpass24` cuts more steeply than `lowpass12`, and rings at its cutoff when its `resonance` is near 1. `drive` pushes the filter harder, for a growl. `keyTrack` makes the cutoff follow the note, so high notes don't sound dull. `accent` is how much further an accented note opens it. To open the filter on each note and let it close, aim a `modEnvelope` at the cutoff | none |
| `modEnvelope` | `{ to, amount, envelope }`. A second envelope, sent `to` the `'pitch'` (in semitones), the `'cutoff'` (in octaves) or the `'brightness'` (0 to 1) | none |
| `lfo` | `{ shape, rateHz, rateBeats, delayMs, isRetriggered, pitch, cutoff, brightness, volume, pan }`. The shapes are `sine`, `triangle`, `square`, `saw` and `random`, which jumps to a new level each cycle. `rateBeats` times it to the song, such as `1 / 4` for sixteenths. Each amount says how far it moves that setting. With `isRetriggered: false`, it runs on from note to note rather than starting again | a sine at 5 Hz that moves nothing |
| `note` | The note it plays when it's played with none, or when a song names it without one, as drums do | `C-4` |
| `stepMs`, `steps`, `arpeggio` | The driver's step length, step table and arpeggio, as on the Audio80 | |
| `vibrato` | `{ semitones, hz, delayMs }` | none |
| `glideMs` | Glides into each note from the last one | none |
| `isLegato` | Glides, over `glideMs`, only into a note that overlaps the last one, and keeps the envelopes running rather than starting them again, the way an acid bass slides | false |

A few options matter only when your game plays the sound on its own. A
song's patterns say which note plays and for how long, so a song ignores
these:

| Option | Meaning | Default |
| --- | --- | --- |
| `lengthMs` | How long it holds its note before releasing it | the step table's length, or 250 ms |
| `glideTo` | A note to glide to over `lengthMs` | none |
| `priority` | Which sounds it may take a voice from, as on the Audio80 | 0 |
| `maxVoices` | How many voices it may play on at once | 1 |

**Brightness** is one setting that each engine reads in its own way. On an
analog or sample voice, it closes the filter. On an FM voice, it softens the
operators that do the pushing. So a song's `f` token, the mod envelope and
the LFO can open up any sound, whatever its engine.

A step table works just like the Audio80's, which its guide describes in
"Step Tables". Each row can set an analog wave (`saw`, `pulse`, `triangle`
or `sine`), a pitch, a volume (`v0` to `vF`), a pan (`P00` for left, `P80`
for the centre, `PFF` for right), a brightness (`f0` to `fF`) and a
sample's slice (`s00` to `sFF`).

### FM

FM stands for frequency modulation. One sine wave, the **modulator**,
pushes another, the **carrier**, faster and slower many times a cycle.
That push adds overtones. Each sine wave is called an operator, and each
operator has its own envelope. So as a modulator's level fades, the sound
mellows. That's how a note can start bright and soften as it rings, the way
a piano's does.

| Option | Meaning |
| --- | --- |
| `operators` | One to four, operator 1 first. Each has a `ratio` to the note's pitch (0.5 to 32, in halves) or a `fixedHz`, a `detuneCents`, a `level`, a `wave` (`sine`, `half-sine`, `abs-sine` or `quarter-sine`), a `velocity` (how much a softer note lowers it), and its own `envelope` |
| `algorithm` | Which operators push which, such as `'2>1 4>3'`, where operator 2 modulates 1 and 4 modulates 3. You hear the operators that modulate nothing. By default, you hear every operator |
| `feedback` | How much the highest operator modulates itself, 0 to 1. A little turns a sine into a saw, and a lot makes a growl |
| `rateScaling` | How much faster high notes' operators fade, 0 to 1, as struck strings do |

A whole-number `ratio` keeps the overtones in tune with the note. Other
ratios sound like bells and metal. Watch out, though: even a whole number
can clash in a chord. A modulator at 3 times the note adds the seventh
harmonic, which is about a sixth of a semitone flat of the nearest piano
note. If a sound seems sharp in a chord, try a modulator at the note
itself. That's the softest choice.

### Analog

| Option | Meaning |
| --- | --- |
| `oscillator` | `{ wave, unison, detune, spread, pulseWidth, chord }`. `unison` is how many copies play at once, up to 7. `detune` tunes them apart, and `spread` spreads them across the speakers, both 0 to 1. `chord` tunes the copies to a chord instead, such as `[0, 4, 7]`. A `unison` of 0 leaves only the sub and the noise |
| `oscillatorB` | `{ interval, level, isSynced }`. A second oscillator, `interval` semitones from the first. `isSynced` restarts it with each of the first one's cycles, which makes a tearing sound as its interval moves |
| `sub` | The level of a square wave an octave below, 0 to 1 |
| `noise` | The level of white noise, 0 to 1. White noise holds every frequency at once, so the filter decides how it sounds: a rumble when it's low, wind when it's a narrow band, and a hiss when it's high |

### Sample

| Option | Meaning | Default |
| --- | --- | --- |
| `sample` | The sample to play, from `createAudio90Sample` | |
| `rootNote` | The note the sample sounds at its own rate | the sample's own |
| `isReversed` | Whether it plays backwards | false |

---

## Samples

A sample is a stored sound that the chip can play back at any pitch. **You
never record or download a sample.** Instead, you **bounce** it. The chip
plays a short song on its own engines, and keeps what it played. Producers
in the 1990s did this too, and called it resampling. It lets you do three
things that playing the engines live can't:

- **Play many voices on one.** An orchestra hit bounced from a brass chord,
  a string chord and a crack of noise takes one voice to play, not six.
- **Get the sampler's sound.** A bounced sound played two octaves down
  slows and darkens, just like pitched-down samples in hip hop and jungle.
- **Make breakbeats.** You can bounce a drum pattern, cut it into slices,
  and play the slices back in a new order.

```ts
import { createAudio90Sample, createAudio90Song } from 'audio90';

/** An orchestra hit: brass, strings and a crack, kept as one sound. */
export const ORCHESTRA_HIT = createAudio90Sample({
    rate: 32000,
    rootNote: 'C-4',
    lengthMs: 750,
    bounce: createAudio90Song({
        bpm: 120,
        instruments: { B: BRASS, S: STRING_STAB, n: CRACK },
        patterns: {
            hit: `
                # brass                 | strings | crack
                | C-4 B | E-4 B | G-4 B | C-5 S   | n
                | ...   | ...   | ...   | ...     | ...
                | ===   | ===   | ===   | ===     | ...
            `,
        },
        order: ['hit'],
    }),
});
```

To play it, make a sound with the sample engine:

```ts
export const HIT = createAudio90Sound({
    engine: 'sample',
    sample: ORCHESTRA_HIT,
});
```

| Option | Meaning | Default |
| --- | --- | --- |
| `bounce` | The song to play and keep. It plays once, from its start. Its effects stay silent unless it sets them | |
| `rate` | The sample's own rate, 8,000 to 32,000 Hz. A lower rate sounds duller and grittier, as the era's samplers did | 32,000 |
| `bits` | 8, 12 or 16. Fewer bits sound noisier | 16 |
| `rootNote` | The note the sample sounds at its own rate, which is the note the song plays | `C-4` |
| `lengthMs` | How much of the song to keep | one pass of the song |
| `slices` | How many equal slices to cut it into, 1 to 256. A song's `s` token plays one. A sliced sample doesn't loop | 1 |
| `loop` | `{ fromMs, toMs, isPingPong }`. The part that repeats while the note is held, forwards or back and forth | none |

**Hold the note to the end.** A sample keeps whatever the song played. If
the song lets go of its note before `lengthMs`, the end of your sample is
the note fading away. A loop over that part repeats the fade, so a held
note gaps and stutters. To avoid that, write the bounced song slowly
enough that its note lasts past `lengthMs`. At 15 BPM, a one-row note lasts
a whole second.

**Loop whole cycles.** A loop that starts and ends at the same point in a
tone's cycle plays smoothly. If it doesn't, you hear a click each time it
goes round. For example, 20 cycles of A-2, which is 110 Hz, last
20,000 / 110 ms.

**Bounce as your game loads.** A sample bounces the first time it's
needed, and that can take a few frames. So call `prepareAudio90Samples`
with your samples as the game loads, beside its pictures and fonts, and
none will bounce while it plays:

```ts
import { prepareAudio90Samples } from 'audio90';

prepareAudio90Samples([ORCHESTRA_HIT, BREAK, CHOIR]);
```

It bounces each one that isn't bounced yet. If your samples need more than
the chip's sample memory between them, it throws, and lists each one's
size. A sample's size is its `length`, which is `lengthMs` times `rate`,
divided by 1000.

Each chip has its own sample memory. A chip is sent a sample the first
time it plays a sound that uses it. So a sample that your music and your
sound effects both play is sent to both chips.

---

## Sounds in Stereo

On the Audio90, `play` takes a `pan` for a sound, from -1 (left) to 1
(right). If you leave it out, the sound plays at its own pan. That lets you
place each sound where it happens on screen:

```ts
import { createAudio90Sound } from 'audio90';

/** An explosion: white noise through a falling low-pass filter. */
export const EXPLODE = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 2400 },
    stepMs: 40,
    steps: `
        # brightness  volume
        fF            vF
        fA            vC
        f7            v8
        f4            v5
        f2            v2
    `,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    priority: 2,
    reverb: 0.3,
});

/** The pan for a point `x` across a play area `width` wide. */
function toPan(x: number, width: number): number {
    return (x / width * 2 - 1) * 0.8;
}

// As an explosion starts
sfx.play(EXPLODE, { pan: toPan(explosion.x, ARENA_WIDTH) });
```

Notice that the pan only reaches 0.8 at the edges. A sound in one ear
alone can feel detached from the game, so it helps to stop a little short.

The other play options work as on the Audio80: `note`, `glideTo`,
`lengthMs` and `volume`. So does the way the chip picks a voice for each
play, which its guide describes in "Which Voice a Sound Gets". On a chip of
their own, your sound effects have all sixteen voices between them.

**Make explosions from noise.** A good explosion is white noise through a
gentle low-pass filter, falling in brightness and volume. If you add a
sine under it, a resonant filter or a random LFO, it starts to sound like
a drum or a melody instead. For a small explosion that plays often, try a
hiss through a high-pass filter. It sits under the music rather than
fighting it.

---

## The Mix

Each chip has its own mix: its voices' pans and sends, its three effects
and its pump. A song sets up its chip's mix as it starts, and its rows
change it as it plays. The chip has no calls to change the effects
yourself.

### Pan and Sends

Each voice has a pan and three sends. Each of them comes from three
places, and the three add up:

- **The sound**, with its `pan`, `reverb`, `echo` and `chorus` options, or
  the `pan` it's played with.
- **The channel**. A song's `mixer` gives each channel a starting pan and
  sends, and its `P`, `r` and `e` tokens change them as it plays.
- **The LFO**, for the pan.

So a sound panned left, on a channel panned left, sits further left
still. The sends add up to at most 1.

### The Effects

The three effects are shared by every voice on the chip. Each voice
chooses how much it sends to them:

| Effect | What it does | Settings |
| --- | --- | --- |
| **Reverb** | Puts the sound in a room, from a small booth to a hall | `size` 0 to 1, `decayMs` (how long it rings), `damping` 0 to 1 (how fast the highs fade), `level` 0 to 1 |
| **Echo** | Repeats the sound, in stereo | `timeMs`, or `timeBeats` to follow the tempo, such as `3 / 4` for a dotted eighth. `feedback` 0 to 0.95 (how much of each repeat repeats again), `toneHz` (a low-pass filter on each repeat, which darkens it, as tape did), `isPingPong` (repeats that alternate sides), `level` |
| **Chorus** | Widens the sound, with two slowly moving short delays, one on each side | `depth` 0 to 1, `rateHz`, `level` 0 to 1 |

A song sets each effect with its `reverb`, `echo` and `chorus` options. A
setting it leaves out takes the effect's starting value. If a song doesn't
set an effect at all, the effect stays as it was.

A chip that plays only sounds never has its effects set. So it keeps their
starting settings: a medium room that rings for 1.8 seconds, an echo after
300 ms, and a gentle chorus. Those suit most sound effects. A sound's
sends decide how much of each it hears.

If you time the echo in beats, it keeps time with your song at any tempo,
and follows the chip's `tempoScale` too. You don't have to tell it the
tempo, since the song does that.

### The Pump

The **pump** ducks every channel of a song but one, each time that one
starts a note, and then lets the mix swell back. It's how the decade's club
tracks breathed with their bass drum. You set it in the song's options:

```ts
pump: { channel: 0, depth: 0.45, releaseMs: 200 },
```

Set `channel` to your bass drum's channel. `depth` is how far the other
channels duck, from 0 to 1, and `releaseMs` is how long they take to come
back. The pump follows the notes rather than listening to the sound, so it
costs almost nothing. It never ducks sounds played on their own. A song
with no `pump` turns off any pump left by the song before it.

### The Stereo Width

`stereoWidth` sets how wide the chip's whole mix is. At 1, which the chip
starts at, each voice sits where its sound and song place it. At 0, both
speakers play the same, which is mono. Values in between narrow the mix:

```ts
music.stereoWidth = 0.5;
```

It's a setting for the player, not for the music. Voices panned hard to
one side can tire a listener on headphones, and a phone held sideways may
have only one speaker. So offer it in your game's settings. A change
settles over about 30 ms, so it doesn't click. The chip keeps it as songs
start and stop.

---

## The Character

The **character** sets how much of a machine's grit the chip keeps. You
can give a chip a character as you make it, with the `character` option. A
song can set one too, as it starts, so your game can move from a
console's sound to a club's:

| Character | What changes | Suits |
| --- | --- | --- |
| `studio` (the default) | Nothing. The chip sounds clean | Pop and dance music, and anything that should sound like a polished record |
| `console` | FM voices are rounded to 9 bits, with a small step where the wave crosses zero, which gives console FM its edge. Samples are dulled a little | Game soundtracks of the early and middle decade |
| `sampler` | Samples play with no smoothing, so you hear their own rate and bits. The output is driven a little harder | Hip hop, trip-hop, jungle, and music made of short looped samples |

The character never changes an analog voice itself. Only the `sampler`'s
harder output reaches it.

---

## Showing the Music as It Is Heard

A browser plays sound a little after it's asked to, by the time the sound
takes to reach the speaker. For most games that never matters. But a
display that shows a song as it plays, as a tracker does, must show the
row being heard, not the row the chip has just played.

The chip does this for you. Its `song`, `orderIndex`, `row`, `beat` and
`positionMs` all describe what the listener hears now. So you can read
them every frame and show them as they are:

| Member | What it tells you |
| --- | --- |
| `song` | The song heard playing, or undefined |
| `orderIndex` | The entry in the song's order being heard |
| `row` | The row being heard, within that entry's pattern |
| `beat` | How many beats the song has played, for things that move in time with it |
| `positionMs` | Where the song is in its order, in ms, 0 or more and less than its `durationMs`, for a seek bar |

Draw the song the chip reports, from its `song`, not the one your game
last chose. Just after you play a new song, there's a moment before it's
heard. If you drew your own choice with the chip's `row`, you could read a
row of one song against another's patterns.

A tracker display also needs the text of each cell. `printAudio90Cell`
gives you one cell of a pattern, in columns that line up from row to row.
The text parses back into the same cell. This finds the pattern being
heard, and prints each of its rows:

```ts
import { type Audio90, printAudio90Cell } from 'audio90';

/** The text of each row of the pattern the listener is hearing. */
function printHeardPattern(chip: Audio90): string[] {
    const song = chip.song;
    if (song === undefined) return [];
    const entry = song.order[chip.orderIndex];
    const pattern = song.patterns[entry.pattern];
    const lines: string[] = [];
    for (let row = 0; row < pattern.rowCount; row++) {
        const cells: string[] = [];
        for (let channel = 0; channel < song.channelCount; channel++) {
            cells.push(printAudio90Cell(song, pattern, row, channel));
        }
        lines.push(cells.join(' | '));
    }
    return lines;
}
```

Building strings makes new objects, so call it only when the song or the
`orderIndex` changes. Each frame, highlight the line at the chip's `row`.
The cells show the notes as the pattern writes them. An order entry such
as `'verse+5'` plays them 5 semitones higher, and its `transpose` tells you
by how much.

If your page has no game loop to read the chip each frame, give the chip
an `onRow` instead, as you make it. It's called as the song reaches each
row, a moment before the listener hears it:

```ts
const music = createAudio90({
    context,
    onRow(song, orderIndex, row) {
        highlightRow(song, orderIndex, row);
    },
});
```

---

## Scopes

A scope draws the wave that a voice is playing, as an oscilloscope does.
`createScope` attaches one to a chip, and the chip fills it about 90 times
a second. A scope costs the chip a little, so it fills one only while one
is attached. When you're done with it, call its `destroy`:

```ts
import { createScope, SCOPE_POINTS } from 'audio90';

const scope = createScope(music);

// Each frame, for each voice v
const from = v * SCOPE_POINTS;
for (let i = 0; i < SCOPE_POINTS; i++) {
    drawPoint(i, scope.points[from + i]);
}
```

A scope stays the same object, with the same arrays, for its whole life,
so reading it never allocates. Its `points` hold `SCOPE_POINTS` points
for each voice, starting with voice 0. A point is about -1 to 1 for a voice
at full volume. Its `pans` hold each voice's pan, from -1 to 1. A silent
voice's points and pan are 0. A scope works on the Audio80 too, whose pans
are all 0. A headless chip's scope stays silent.

---

## Songs as Text

`printAudio90Song` turns a song into text, and `parseAudio90Song` turns
that text back into the same song. The text holds the options the song was
made from, never any audio, so it's small. That suits an editor that saves
songs, or songs kept in files of their own.
[Writing Tracker Music](writing-tracker-music.md#saving-a-song-as-text)
shows how.

---

## Loudness

Write each song at the shared loudness, about -20 LUFS, just as on the
Audio80. LUFS is a measure of how loud sound seems to the ear, and the
Audio80's guide explains it in "The Mix and Loudness". You can measure a
song with `render` and `measureLoudness`, from `audio90/headless`, and
set the song's `volume` to bring it there:

```ts
import { measureLoudness, render } from 'audio90/headless';

console.log(measureLoudness(render(THEME)));
```

**Set your sound effects by loudness, not by peak.** Two sounds with the
same peak can sound very different in loudness. Noise has a high peak for
how loud it actually sounds, so if you match peaks, your explosions end up
too quiet. Instead, measure each one with `measureLoudness`, and compare it
with the music's -20 LUFS. An LU is one step on the LUFS scale. A sound
that plays often, such as a shot, should sit well below the music, about
18 LU below it, at -38 LUFS. A rare sound that matters, such as losing the
player's ship, can sit closer.

**Balance a song by its parts.** If one part seems too loud, render a copy
of the song with only that part's channels, and measure each copy. Then
compare the parts with each other, rather than with the whole song.

---

## Recipes

Here are sketches of the decade's sounds. Each one names the technique
behind it, so you can change it to suit your game. Each was designed from
its technique, not copied from any machine's presets.

**An FM electric piano.** This uses two pairs of operators. A tine, which is
a high modulator that fades fast, gives each note its attack. A body
underneath keeps sounding. `velocity` makes softer notes darker, as on a
real electric piano:

```ts
// The body's carriers, and its modulator, which fades so each note mellows
const BODY = { attackMs: 2, decayMs: 1800, sustain: 0.2, releaseMs: 300 };
const BODY_MOD = { attackMs: 0, decayMs: 900, sustain: 0.1, releaseMs: 200 };
// The tine: a high modulator, gone in a tenth of a second
const TINE = { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 60 };

export const ELECTRIC_PIANO = createAudio90Sound({
    engine: 'fm',
    // 2 modulates 1, the body; 4 modulates 3, the tine's carrier
    algorithm: '2>1 4>3',
    operators: [
        { envelope: BODY },
        { level: 0.3, velocity: 0.8, envelope: BODY_MOD },
        { level: 0.6, detuneCents: 7, envelope: BODY },
        { ratio: 11, level: 0.12, velocity: 1, envelope: TINE },
    ],
    rateScaling: 0.4,
    volume: 0.5,
    chorus: 0.4,
    reverb: 0.3,
});
```

**A supersaw.** Seven saws, detuned and spread wide, through a filter left
open, give you the classic trance lead.
`oscillator: { wave: 'saw', unison: 7, detune: 0.3, spread: 0.8 }`.

**An acid line.** One saw goes into a resonant 24 dB filter that snaps shut
on each note. Notes you mark with `!` in the song open it further, and
notes that overlap slide into each other:

```ts
const SNAP = { attackMs: 0, decayMs: 200, sustain: 0, releaseMs: 40 };

export const ACID = createAudio90Sound({
    oscillator: { wave: 'saw' },
    filter: {
        cutoffHz: 280,
        resonance: 0.88,
        drive: 0.4,
        keyTrack: 0.5,
        accent: 0.6,
    },
    modEnvelope: { to: 'cutoff', amount: 3.2, envelope: SNAP },
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 25 },
    glideMs: 70,
    isLegato: true,
    volume: 0.45,
});
```

**A reese bass.** Two saws drift against each other, with a sub an octave
down, under a filter that a slow LFO moves:
`oscillator: { wave: 'saw', unison: 2, detune: 0.12 }`, `sub: 0.6`,
`lfo: { rateHz: 0.3, cutoff: 0.6 }`.

**A rave stab.** Three saws go through a filter that snaps shut. You play
them as chords from one voice with the song's `c` token. `c37` is a minor
chord, and `c47` is a major one.

**An orchestra hit.** Bounce a brass chord, a string chord and a crack of
noise together into one sample, as in [Samples](#samples).

**A sliced break.** Bounce a two-bar drum pattern with ghost notes and a
little swing, at 26 kHz and 12 bits. Cut it into 32 slices, one for each
sixteenth. Then a song can replay the slices in a new order with `s00` to
`s1F`. Play it an octave down, and each slice plays at half speed.

**A choir.** Send a buzzy pulse through three band-pass filters, each one
set to one of a vowel's resonances. A vowel's resonances are the
frequencies that a singer's throat and mouth make louder. For "aah", they're
near 700, 1,220 and 2,600 Hz. Bounce the three together, and they sing
"aah". Let the sample loop back and forth while the note is held.

**A trance gate.** Cut a pad into sixteenths with a square LFO on its
volume, timed in beats:
`lfo: { shape: 'square', rateBeats: 1 / 4, volume: 1 }`.

**A deep bass drum.** Use a sine that falls two octaves as it starts:
`modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0,
decayMs: 60, sustain: 0, releaseMs: 0 } }`.

---

## Your Own Sounds

Make every sound in your code. Don't use recordings, sample libraries or
sound fonts, and don't rebuild a famous drum break hit for hit. Design each
sound from its technique, and never copy a synthesiser's factory preset.
Name each sound for what it is, such as `PAD` or `ACID`, not for a
machine. And write your own melodies in the decade's styles, as
[Writing Tracker Music](writing-tracker-music.md#your-own-music) asks.

---

## When It Goes Wrong

| Symptom | Likely cause |
| --- | --- |
| A sampled note stutters or gaps while it's held | The bounced song let go of its note before the end of the sample's loop. Hold the note to the end |
| A looped sample clicks each time it goes round | The loop doesn't hold a whole number of the tone's cycles |
| `prepareAudio90Samples` throws | Your samples need more than the chip's sample memory. Lower a `rate`, or shorten a `lengthMs` |
| Your game stutters the first time a sound plays | A sample bounced right then. Call `prepareAudio90Samples` as your game loads |
| A chord sounds sour | Two of its notes, or a note and the tail of the last chord, sit a semitone apart. The echo, the reverb and a pad's long release carry each chord into the next |
| A sound is too bright or too sharp | An FM modulator is at a high or odd ratio, or there's no filter. Lower the ratio or the modulator's level, or add a gentle low-pass filter |
| A supersaw chord sounds thinner than you wrote it | It went over the budget of 48 analog oscillators, so some notes played with fewer copies |
| Your sound effects are lost under the music | They were set by peak. Set them by loudness |
| An explosion sounds like a drum | There's a sine, a resonant filter or a random LFO under the noise. Use noise through a gentle filter |
| The pump does nothing | Its `channel` isn't the bass drum's, or a later song had no `pump` |
| A song's sounds cut out when a sound effect plays | They share a chip, and the sound took a voice from the song. Play your sound effects on a chip of their own |
| A tracker display shows the wrong notes for a moment after a change of song | It drew the song your game chose, with the chip's `row`. Draw the chip's own `song` |
