# @mvtjs/audio/headless

This part of the package runs the Audio80 without a speaker. It holds the
headless chip, which plays sound in memory or not at all. It also holds the
tools that render songs and sound effects, measure them and save them as WAV
files. Nothing here uses Web Audio, so it all runs in Node as well as in a
browser.

Rendered sound is a list of **samples**. Each sample is the level of the
sound wave at one instant, from -1 to 1. The **sample rate** is how many
samples make up each second. Everything here renders at 48,000 a second
unless told otherwise. The chip is mono, so there is one sample for each
instant, not one for each speaker.

**Related:** [The package's README](../../README.md) · [Using the Audio80](../../docs/using-the-audio80.md)

## The Headless Chip

`createHeadlessAudio80` makes a chip with no speaker. A game run headless
plays on one, for thumbnails and benchmarks. Tests and tools use one too.
Each call a game makes on the chip is a **write**. The options say what the
chip does with each write:

| Call | What it does with each write | Use |
| --- | --- | --- |
| `createHeadlessAudio80()` | Nothing. It plays nothing and logs nothing, at almost no cost | Running a game headless |
| `createHeadlessAudio80({ record: true })` | Logs it, on the chip's `log` property | Testing audio views |
| `createHeadlessAudio80({ render: true })` | Plays it in memory, for `render` to write out as samples | Audio tests, benchmarks and WAV files |
| `createHeadlessAudio80({ record: true, render: true })` | Logs it and plays it | Tests that check what was written and how it sounds |

Like the browser's chip, it returns `{ audio80, controls }`. The first is
the chip, which views play sounds on. The second is its controls, which
only the game loop uses. So code written against one chip runs on the
other. The chip's clock still runs when it plays nothing, and
`AudioControls.update` advances it.

The types follow the options. The chip has `log` and `clear` only if it was
made with `record: true`. The object returned has `render` and `sampleRate`
only if it was made with `render`. So reading the log of a chip that does
not record is a type error, not an empty log.

### Recording

A chip made with `record: true` keeps every write in its `log` property,
oldest first, until its `clear` method empties it. Each entry is a
`ChipWrite`. It says what kind of write it was (`'play'`, `'note-on'`,
`'set-filter'` and so on), what it was given, and the time it was stamped
with. A sound effect is stamped `-Infinity`, because it plays as soon as it
arrives. Every other write is stamped with its `atMs`, or with the chip's
time if it had none.

### Rendering

A chip made with `render` plays each write exactly at its stamp. It has no
delay, because nothing here runs in real time. `render` also takes
`{ sampleRate, character }` in place of `true`. They default to 48,000 and
`'classic'`. The character sets how gritty the chip sounds, as
[Using the Audio80](../../docs/using-the-audio80.md#on-your-own-page)
explains.

`render(output)` fills the `Float32Array` you pass it. It renders the next
`output.length` samples, from where the last render ended, and plays the
writes made since. It allocates nothing, so you can render block after
block into the same buffer. To render part of a longer buffer, pass a view
of that part, made with `subarray`:

```ts
const chip = createHeadlessAudio80({ render: true });
chip.audio80.noteOn(0, LEAD, 60, 1);
chip.controls.update(250);

// A quarter of a second: 12,000 samples at 48,000 a second
const samples = new Float32Array(chip.sampleRate / 4);
chip.render(samples.subarray(0, 6000));
chip.render(samples.subarray(6000));
```

The two renders above give the same samples as one render of the whole
buffer. Advance the clock with `AudioControls.update` before rendering
the samples up to it. A write stamped later than the samples rendered so
far waits for a later render. The controls' volumes apply to the samples
`render` writes. Their `flush` method does nothing, since `render` takes
the writes itself.

## Rendering Songs and Effects

Most tests and tools need a whole song or effect, not blocks of samples.
Two functions make a rendering chip, play the sound on it, and return its
samples as a new `Float32Array`:

- `renderSong(song, options?)` renders one pass through the song. It ticks
  the chip and a music player every 60th of a second, as a game loop would.
  A looping song is stopped where it would go back to its loop.
- `renderSoundEffect(effect, options?)` renders the effect, played once.

Each renders a little past the end of the sound, so that its release and
echo can fade. They take these options:

| Option | Meaning | Default |
| --- | --- | --- |
| `sampleRate` | The sample rate to render at | 48,000 |
| `character` | How gritty the chip sounds | `'classic'` |
| `tickMs` | How long each tick is, in ms | 1000 / 60 |
| `durationMs` | How long to render, in ms | The sound's length, and 600 ms more |

## Measuring

`measurePeak(samples)` returns the peak, which is the level of the loudest
sample. The output holds levels up to 1. A sound that peaks near 1 is
squashed by the output, which distorts it.

`measureLoudness(samples, sampleRate?)` returns how loud the sound seems to
a listener, in LUFS. LUFS is the standard unit for that. The values are
negative, and nearer 0 is louder. It measures as the ITU-R BS.1770 standard
says, which is how streaming services measure it too. Silence measures
`-Infinity`.

Every song is written to the same loudness, `REFERENCE_LOUDNESS_LUFS`,
which is -20 LUFS. So one song is not much louder than another, in one game
or across games. `LOUDNESS_TOLERANCE_LU` is how far a song may stray from
it either way: 3 LU. An LU is a step of loudness, the same size as a
decibel.

## Audio Tests

An audio test catches a sound that changes by accident. It renders the
sound and compares it with a reference saved earlier. The reference is a
hash, which is a short string worked out from the samples. A Vitest
snapshot keeps it. Vitest stores the snapshots beside the test, in
`__snapshots__/`, one file for each test file, such as
`__snapshots__/sounds.test.ts.snap`.

`hashSamples(samples)` returns that hash, as 8 hex digits. It first rounds
each sample to 16 bits, as a WAV file holds it. So a difference too small
to hear in a WAV file does not change the hash.

`findSounds(exports)` returns the songs and sound effects a module exports,
each with its export name. Pass it the module's namespace, from
`import * as sounds from './sounds'`, and a test covers every sound the
module adds later too.

An audio test for a game's sounds checks that each one can be heard, is
not squashed and has not changed. It also checks that each song is at the
shared loudness:

```ts
import { describe, expect, it } from 'vitest';
import {
    findSounds, hashSamples, LOUDNESS_TOLERANCE_LU, measureLoudness,
    measurePeak, REFERENCE_LOUDNESS_LUFS, renderSoundEffect, renderSong,
} from '@mvtjs/audio/headless';
import * as music from './music';
import * as sounds from './sounds';

/** Quieter than this, a sound is lost under the music. */
const AUDIBLE = 0.08;
/** Louder than this, the output is squashing it. */
const CLIPPING = 0.9;

const { songs, effects } = findSounds({ ...sounds, ...music });

describe('sounds', () => {
    for (const [name, effect] of effects) {
        it(`${name} sounds as it did, audible and unclipped`, () => {
            const samples = renderSoundEffect(effect);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    for (const [name, song] of songs) {
        it(`${name} sounds as it did, as loud as every other song`, () => {
            const samples = renderSong(song);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            const loudness = measureLoudness(samples);
            const offBy = Math.abs(loudness - REFERENCE_LOUDNESS_LUFS);
            expect(offBy).toBeLessThanOrEqual(LOUDNESS_TOLERANCE_LU);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }
});
```

When a change alters a sound, its test fails. Listen to the new sound
first (see [Listening](#listening)). Then, if it is right, update its
reference with `vitest -u`.

## Testing an Audio View

An audio view is a view that plays sound and draws nothing. Test one
against a chip that records. Advance the chip's clock and tick the view, as
a game loop would. Then check the log:

```ts
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';

const TICK_MS = 1000 / 60;

it('plays a shot each time the ship fires', () => {
    const { audio80, controls } = createHeadlessAudio80({ record: true });
    let shots = 0;
    const view = ShipAudioView({
        sound: audio80,
        shotsFired: () => shots,
        isAlive: () => true,
    });
    const tick = (): void => {
        controls.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };

    shots++;
    tick();
    const shot = expect.objectContaining({ kind: 'play', effect: SHOT });
    expect(audio80.log).toContainEqual(shot);
});
```

## Listening

`encodeWav(samples, sampleRate)` returns the samples as a 16-bit mono WAV
file, in a `Uint8Array`. Any audio player can play it.

To listen to a module's sounds without starting the game, run this from the
repo's root:

```sh
npm run audio:render -- \
    packages/website/src/entries/galaxy-raiders/data/music.ts
```

It renders every song and effect the module exports to WAV files. It writes
them to `renders/<module path>/`, which git ignores. It prints each one's
length and peak, and each song's loudness beside the shared loudness. You
can name several modules. Name the modules that define the sounds, not a
barrel file. The script runs in Node, and a barrel may import textures,
which do not load there.

## Exports

| Export | Description |
| --- | --- |
| `createHeadlessAudio80` (`HeadlessAudio80`, `HeadlessAudio80Options`, `HeadlessRenderOptions`) | Returns a new chip with no speaker, and its controls. It plays nothing, logs every write (`record: true`), renders to samples (`render`), or does both |
| `ChipLog`, `ChipWrite` | The types of the log on a chip made with `record: true`, and of each entry in it |
| `ChipRenderer` | The type of what a chip made with `render` adds: `render(output)` and `sampleRate` |
| `renderSong` (`RenderOptions`) | Returns the samples of one pass through a song, as a new `Float32Array` |
| `renderSoundEffect` (`RenderOptions`) | Returns the samples of a sound effect played once, as a new `Float32Array` |
| `measurePeak` | Returns the peak of samples, which is the level of the loudest one |
| `measureLoudness` | Returns the loudness of samples, in LUFS |
| `REFERENCE_LOUDNESS_LUFS` | The loudness every song is written to: -20 LUFS |
| `LOUDNESS_TOLERANCE_LU` | How far a song's loudness may stray from `REFERENCE_LOUDNESS_LUFS`: 3 LU |
| `hashSamples` | Returns a short hash of samples, as a string of 8 hex digits |
| `findSounds` (`ModuleSounds`) | Returns the songs and sound effects a module exports, with their names |
| `encodeWav` | Returns samples encoded as a 16-bit mono WAV file, as a `Uint8Array` |
