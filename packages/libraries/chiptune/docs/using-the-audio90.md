# Using the Audio90

> The Audio90 is a virtual sound chip in the spirit of the synthesisers,
> samplers and game consoles of the 1990s. It has sixteen stereo voices, and
> each voice can play FM, analog or samples. This guide shows you how its
> engines, instruments, samples and stereo sound effects work, how to mix
> them, and how to change the way the chip sounds. It ends with recipes for
> the decade's sounds. A lot works just as it does on the Audio80, so the
> guide points you to the Audio80's guide for those parts.

**Related:** [Using the Audio80](using-the-audio80.md) · [Writing Tracker Music](writing-tracker-music.md) · [The package's README](../README.md)

---

## Which Chip

The package has two chips. Pick the one that matches your game's decade.

| | Audio80 | Audio90 |
| --- | --- | --- |
| Spirit | 1980s home computers | 1990s synthesisers, samplers and consoles |
| Voices | 8, mono | 16, stereo |
| What a voice plays | Pulse, saw, triangle and noise waves, combined, or a wavetable you draw | FM, analog oscillators, or a sample |
| Filters | Two, shared by the voices routed through them | One for each voice |
| Effects | An echo | A reverb, a stereo echo and a chorus, and the pump |
| Suits | Chiptune, arcade and 8-bit games | Dance music, 16-bit games, and anything you want in stereo |

You play both chips the same way, and both keep your game's time. An audio
view polls its bindings and plays a sound when something changes. A music
player plays songs written in tracker notation. Your game loop drives the
chip through its `AudioControls`. These parts work the same on both chips,
so [Using the Audio80](using-the-audio80.md) covers them once:

- [Time](using-the-audio80.md#time-the-chip-runs-on-game-time) explains why
  the chip's clock moves only when your game does.
- [Playing from Audio Views](using-the-audio80.md#playing-from-audio-views)
  shows what to watch for, and how to handle views in lists.
- [Music](using-the-audio80.md#music) covers the music player.
- [Repeating Sounds](using-the-audio80.md#repeating-sounds) covers the
  metronome.
- [Testing and Listening](using-the-audio80.md#testing-and-listening) shows
  you how to write audio tests and render WAV files.

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

The instrument a note plays decides which engine runs. So one voice can
play an FM bass, then a sampled snare straight after.

After its engine, every voice goes through the same stages:

1. A **filter**. A filter cuts some of the frequencies from a sound. A
   low-pass filter makes it duller, and a high-pass filter makes it
   thinner. It's off unless the instrument has one.
2. A **volume envelope**, which shapes how each note rises and fades.
3. A **pan**, from -1 (left) to 1 (right). A sound keeps the same loudness
   as you move it across.
4. The **dry mix**, and three **sends**. A send is how much of the voice
   goes to an effect: the reverb, the echo or the chorus.

Each voice also has two things that change a note while it plays. A **mod
envelope** moves the pitch, the filter's cutoff or the brightness. An
**LFO** is a slow oscillator that wobbles a setting, such as the pitch or
the pan. Each voice also has the Audio80's driver, which steps through
arpeggios and step tables, 60 steps a second by default.

The chip keeps a few limits. They make it feel like a chip, and they mean
a busy moment has to make choices:

- **Sixteen voices**, shared by the music and the sound effects.
- **Four operators** for each voice, and up to **seven** copies of an
  analog oscillator.
- **48 analog oscillators** across the whole chip. If a note would go over
  that budget, it plays with fewer copies instead, so you never lose it.
- **Sample memory** of 262,144 samples (`AUDIO90_SAMPLE_MEMORY`), which is
  about 8 seconds at 32 kHz.
- **One of each effect**, shared by every voice.

---

## Getting a Chip

You make and drive the Audio90 the same way as the Audio80. The
[Audio80's guide](using-the-audio80.md#getting-a-chip) walks through each
way in full. Here's what's different.

**In the Arcade**, your game asks for the chip with `soundChip: 'audio90'`,
and gets it as `sound`. If your game plays samples, bounce them as it
loads, beside its textures. [Samples](#samples) explains why:

```ts
await textures.load();
prepareAudio90Samples(SAMPLES);
```

**On your own page**, call `createWebAudio90` from `@mvtjs/chiptune/web`. You
give it an `AudioContext`, and it returns `{ audio90, controls }`. It can
share the context with an Audio80. It also takes `leadMs`, as the Audio80
does, and a `character`, which [The Character](#the-character) describes.

**Without a speaker**, call `createHeadlessAudio90` from
`@mvtjs/chiptune/headless`. It takes the same options as the Audio80's. If you
make it with `render`, its `render(left, right)` fills two `Float32Array`s,
one for each side. The
[headless README](../src/headless/README.md#the-headless-audio90) covers it.

---

## Instruments

An instrument says which engine it uses, and sets that engine's options.
Every option has a default, so a simple instrument is short. You make each
one once, when your module loads:

```ts
import { createAudio90Instrument } from '@mvtjs/chiptune';

/** A pad: five slow saws, swelling in, in the chorus. */
export const PAD = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 5, detune: 0.25, spread: 0.9 },
    filter: { cutoffHz: 1800, resonance: 0.15 },
    envelope: { attackMs: 500, decayMs: 600, sustain: 0.85, releaseMs: 1200 },
    volume: 0.25,
    chorus: 0.3,
    reverb: 0.5,
});
```

If you make a mistake, `createAudio90Instrument` throws an error that names
the option, such as `operators[3].ratio: 0.3 is not a multiple of 0.5`.
Giving one engine's option to another engine is a mistake too, such as
`operators` on an analog instrument. So you find out as the module loads,
not halfway through a game. If you're writing a view that lists
instruments, an instrument's `engine` property gives you its engine's
name.

### Options for Every Engine

| Option | Meaning | Default |
| --- | --- | --- |
| `engine` | `'fm'`, `'analog'` or `'sample'` | `'analog'` |
| `envelope` | `{ attackMs, decayMs, sustain, releaseMs }`, as on the Audio80. A volume envelope that decays to a sustain of 0 ends its note | a 2 ms attack, full sustain, a 60 ms release |
| `volume` | 0 or more | 1 |
| `pan` | -1 (left) to 1 (right) | 0 |
| `reverb`, `echo`, `chorus` | How much goes to each effect, 0 to 1 | 0 |
| `filter` | `{ mode, cutoffHz, resonance, drive, keyTrack, accent, envelope }`. The modes are `lowpass24`, `lowpass12`, `bandpass` and `highpass`. `lowpass24` cuts more steeply than `lowpass12`, and rings at its cutoff when its `resonance` is near 1. `drive` pushes the filter harder, for a growl. `keyTrack` makes the cutoff follow the note, so high notes don't sound dull. `accent` is how much further an accented note opens it. `envelope: { octaves, ... }` opens the filter on each note and lets it close | none |
| `modEnvelope` | `{ to, amount, envelope }`. A second envelope, sent `to` the `'pitch'` (in semitones), the `'cutoff'` (in octaves) or the `'brightness'` (0 to 1). Use this or `filter.envelope`, not both | none |
| `lfo` | `{ shape, rateHz, rateBeats, delayMs, isRetriggered, pitch, cutoff, brightness, volume, pan }`. The shapes are `sine`, `triangle`, `square`, `saw` and `random`, which jumps to a new level each cycle. `rateBeats` times it to the song, such as `1 / 4` for sixteenths. Each amount says how far it moves that setting. Without `isRetriggered`, it runs on from note to note | none |
| `note` | The note it plays when a song names it without one, as drums do | `C-4` |
| `stepMs`, `steps`, `arpeggio` | The driver's step length, step table and arpeggio, as on the Audio80 | |
| `vibrato` | `{ semitones, hz, delayMs }` | none |
| `glideMs` | Glides into each note from the last one | none |
| `legato` | `{ glideMs }`. Glides only into a note that overlaps the last one, and keeps the envelopes running rather than starting them again, the way an acid bass slides | none |

**Brightness** is one setting that each engine reads in its own way. On an
analog or sample voice, it closes the filter. On an FM voice, it softens the
operators that do the pushing. So a song's `f` token, the mod envelope and
the LFO can open up any sound, whatever its engine.

A step table works just like the Audio80's
[Step Tables](using-the-audio80.md#step-tables). Each row can set an analog
wave (`saw`, `pulse`, `triangle` or `sine`), a pitch, a volume (`v0` to
`vF`), a pan (`P00` for left, `P80` for the centre, `PFF` for right), a
brightness (`f0` to `fF`) and a sample's slice (`s00` to `sFF`).

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
import { createAudio90Sample, createAudio90Song } from '@mvtjs/chiptune';

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
with your samples as the game loads, and none will bounce while it plays.
It bounces each one that isn't bounced yet. If your samples need more than
the chip's sample memory between them, it throws, and lists each one's
size. A sample's size is its `length`, which is `lengthMs` times `rate`,
divided by 1000.

---

## Sound Effects

You make a sound effect as you would on the Audio80, from an instrument
and a note, with a length, an optional glide and a step table
([Sound Effects](using-the-audio80.md#sound-effects)). The Audio90 adds a
pan and the three sends:

```ts
import { createAudio90SoundEffect } from '@mvtjs/chiptune';

/** An explosion: white noise through a falling low-pass filter. */
export const EXPLODE = createAudio90SoundEffect({
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
```

`play(effect, pan)` plays the effect at `pan`, from -1 to 1. If you leave
the pan out, it plays at the effect's own. That lets you place each sound
where it happens on screen:

```ts
// Made once, with the view: the arena's left edge is -0.8, its right 0.8
const toPan = (x: number): number => (x / arenaWidth * 2 - 1) * 0.8;

// In the refresh step
if (w.explosions.increased) {
    sound.play(EXPLODE, toPan(bindings.lastExplosionX()));
}
```

Notice that the pan only reaches 0.8 at the edges. A sound in one ear
alone can feel detached from the game, so it helps to stop a little short.

Effects take voices from the top, starting at voice 15, just as the
Audio80's start at voice 7. `priority` and `maxVoices` work as they do on
the Audio80
([Which Voice an Effect Gets](using-the-audio80.md#which-voice-an-effect-gets)).

**Make explosions from noise.** A good explosion is white noise through a
gentle low-pass filter, falling in brightness and volume. If you add a
sine under it, a resonant filter or a random LFO, it starts to sound like
a drum or an instrument instead. For a small explosion that plays often,
try a hiss through a high-pass filter. It sits under the music rather than
fighting it.

---

## The Mix

A song sets up the mix as it starts. You can also change each part of the
mix yourself.

### Pan and Sends

Each voice has a pan and three sends. Each of them comes from three
places, and the three add up:

- **The instrument**, with its `pan`, `reverb`, `echo` and `chorus`
  options.
- **The channel**. A song's `mixer` gives each channel a starting pan and
  sends, and its `P`, `r` and `e` tokens change them as it plays.
- **The LFO**, for the pan.

So an instrument panned left, on a channel panned left, sits further left
still. The sends add up to at most 1.

### The Effects

The three effects are shared by every voice. Each voice chooses how much it
sends to them:

| Effect | What it does | Settings |
| --- | --- | --- |
| **Reverb** | Puts the sound in a room, from a small booth to a hall | `size` 0 to 1, `decayMs` (how long it rings), `damping` 0 to 1 (how fast the highs fade), `level` 0 to 1 |
| **Echo** | Repeats the sound, in stereo | `timeMs`, or `timeBeats` to follow the tempo, such as `3 / 4` for a dotted eighth. `feedback` 0 to 0.95 (how much of each repeat repeats again), `toneHz` (a low-pass filter on each repeat, which darkens it, as tape did), `isPingPong` (repeats that alternate sides), `level` |
| **Chorus** | Widens the sound, with two slowly moving short delays, one on each side | `depth` 0 to 1, `rateHz`, `level` 0 to 1 |

If you time the echo in beats, it keeps time with your song at any tempo.
You don't have to tell it the tempo, since the music player does that.

### The Pump

The **pump** ducks every music channel but one, each time that one starts
a note, and then lets the mix swell back. It's how the decade's club tracks
breathed with their bass drum:

```ts
pump: { channel: 0, depth: 0.45, releaseMs: 200 },
```

Set `channel` to your bass drum's channel. `depth` is how far the other
channels duck, from 0 to 1, and `releaseMs` is how long they take to come
back. The pump follows the notes rather than listening to the sound, so it
costs almost nothing. It never ducks your sound effects. A song with no
`pump` turns off any pump left by the song before it.

### Setting the Mix Yourself

`setVoice` sets one voice's `pan`, `reverbSend`, `echoSend` or
`chorusSend`, among its other settings. `setEffect` sets one of an effect's
settings:

```ts
sound.setEffect('reverb', 'level', 0.5);
sound.setEffect('pump', 'voice', -1);   // no pump
```

---

## The Character

The **character** sets how much of a machine's grit the chip keeps. A song
sets it as it starts, so your game can move from a console's sound to a
club's:

| Character | What changes | Suits |
| --- | --- | --- |
| `studio` (the default) | Nothing. The chip sounds clean | Pop and dance music, and anything that should sound like a polished record |
| `console` | FM voices are rounded to 9 bits, with a small step where the wave crosses zero, which gives console FM its edge. Samples are dulled a little | Game soundtracks of the early and middle decade |
| `sampler` | Samples play with no smoothing, so you hear their own rate and bits. The output is driven a little harder | Hip hop, trip-hop, jungle, and music made of short looped samples |

The character never changes an analog voice itself. Only the `sampler`'s
harder output reaches it.

---

## Scopes

A scope draws the wave that a voice is playing. The chip can tell your view
what each voice is playing and where it's panned, so the view can draw a
scope for it. Scopes cost a little, so they're off until you turn them on:

```ts
sound.setScopes(true);
```

While they're on, the chip fills `sound.scope` about 90 times a second. It
stays the same `Float32Array` for the chip's whole life, so reading it
never allocates. It holds `AUDIO90_SCOPE_POINTS` points for each voice,
starting with voice 0. After those, from `AUDIO90_SCOPE_PANS`, it holds
each voice's pan. A reset turns the scopes off again, so one game never
pays for another's.

## Showing the Music as It Is Heard

The sound the listener hears trails the game a little, by the sound card's
latency and, for the notes a game writes itself, the chip's lead. For most
games that never matters. But a view that shows a song as it plays, as a
tracker does, must show the row being heard, not the row the game is on.

A music player does this for you. Its `orderIndex` and `row` are the row
coming out of the speaker now, so a view can show them as they are:

```ts
const music = createMusicPlayer({ audio90: sound });
// In the view that draws the song
const row = () => music.row;
```

There is one catch, just after a change of song. The player then reports
the new song from its start, until the new song is heard. If your view
chooses what to draw by its own state, such as the tune the visitor
picked, check that `music.song` is that tune before you read the row.
Otherwise a row of one song could be read against another's patterns:

```ts
const row = () => (music.song === chosen() ? music.row : 0);
```

For notes a view writes itself, with `noteOn`, `sound.heardTime` tells you
how far the listener has got. It is a chip time, like `sound.time`, but it
trails behind. Keep a short history of what you wrote, with the chip time
each part starts at, and show the newest part whose start `heardTime` has
reached. For example, say one note starts at 4,000 ms and the next at
4,125 ms. If `heardTime` is 4,060, the listener is hearing the first. Keep
the history in arrays you make once, so that nothing is allocated as the
music plays.

A chip with no speaker, such as the headless chip, has nothing to wait
for. Its music player reports the row it is on, and its `heardTime` is
always the same as its `time`.

---

## Direct Chip Calls

The Audio90 has the Audio80's calls
([Direct Chip Calls](using-the-audio80.md#direct-chip-calls)), with these
differences:

| Call | Does |
| --- | --- |
| `play(effect, pan?)` | Plays an effect, at `pan` or at its own pan |
| `setVoice(voice, setting, value, atMs?)` | Its settings include `pan`, `brightness`, the three sends, `chord` (an analog voice's two extra notes, packed as `x * 16 + y`), `slice`, `accent` and `pulseWidth` |
| `setEffect(effect, setting, value, atMs?)` | Sets one of the `'reverb'`, `'echo'`, `'chorus'` or `'pump'` settings above |
| `setCharacter(character, atMs?)` | Sets the character |
| `setTempo(bpm, atMs?)` | Sets the tempo for LFOs and an echo timed in beats. The music player calls it for you |
| `voiceCount` | 16 |

You won't find `setFilter` or `setEcho` here. Each voice has its own
filter, set by its instrument, and the echo is one of the effects.

---

## The Mix and Loudness

Write each song at the shared loudness, about -20 LUFS, just as on the
Audio80 ([The Mix and Loudness](using-the-audio80.md#the-mix-and-loudness)).
`npm run audio:render` prints each song's loudness, and you set a song's
`volume` to bring it there.

**Set your effects by loudness, not by peak.** Two effects with the same
peak can sound very different in loudness. Noise has a high peak for how
loud it actually sounds, so if you match peaks, your explosions end up too
quiet. Instead, measure each effect with `measureLoudness` from
`@mvtjs/chiptune/headless`, and compare it with the music's -20 LUFS. An LU is
one step on the LUFS scale. An effect that plays often, such as a shot,
should sit well below the music, about 18 LU below it, at -38 LUFS. A rare
effect that matters, such as losing the player's ship, can sit closer.

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

export const ELECTRIC_PIANO = createAudio90Instrument({
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
export const ACID = createAudio90Instrument({
    oscillator: { wave: 'saw' },
    filter: {
        cutoffHz: 280, resonance: 0.88, drive: 0.4, keyTrack: 0.5,
        accent: 0.6, envelope: { octaves: 3.2, decayMs: 200, releaseMs: 40 },
    },
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 25 },
    legato: { glideMs: 70 },
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
instrument from its technique, and never copy a synthesiser's factory
preset. Name each sound for what it is, such as `PAD` or `ACID`, not for a
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
| Your effects are lost under the music | They were set by peak. Set them by loudness |
| An explosion sounds like a drum | There's a sine, a resonant filter or a random LFO under the noise. Use noise through a gentle filter |
| The pump does nothing | Its `channel` isn't the bass drum's, or a later song had no `pump` |
