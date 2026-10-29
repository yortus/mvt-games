# audio90/headless

This part of the package runs the Audio80 and the Audio90 without a
speaker. It holds each chip's headless version, which takes every call a
chip in a browser takes, but makes no sound. It also holds the tools that
render songs and sounds in memory, measure them, and save them as WAV
files. Nothing here uses Web Audio, so it all runs in Node as well as in a
browser.

Rendered sound is a list of **samples**. Each sample is the level of the
sound wave at one instant, from -1 to 1. The **sample rate** is how many
samples make up each second. Everything here renders at 48,000 a second
unless you say otherwise. The Audio80 is mono, so it renders one sample for
each instant, which a browser plays on both speakers. The Audio90 is
stereo, so it renders two: a `StereoSamples` holds its `left` and `right`
channels.

**Related:** [The package's README](../../README.md) · [Using the Audio80](../../docs/using-the-audio80.md)

## The Headless Chip

`createHeadlessAudio80` and `createHeadlessAudio90` each make a chip with no
speaker. You'll use one in two places:

- **Running a game without a page,** such as in Node to make thumbnails or
  run benchmarks. The game's code plays on it just as it would on a chip in
  a browser, so it needs no changes.
- **Testing the code that plays sound.** A test can check what the code
  asked the chip to play, and where its song has got to (see
  [Testing the Code That Plays Sound](#testing-the-code-that-plays-sound)).

A headless chip has everything a browser's chip has: `play`, `queue`,
`stop`, `song`, `row`, `beat`, `positionMs`, `pause`, `volume` and the
rest. It checks each play's options, and throws for the same mistakes. Its
`ready` has already resolved, since it has nothing to load.

It adds one method, `update(deltaMs)`, which moves its clock on. A browser's
chip keeps the sound card's time. A headless chip has no sound card, so its
clock moves only when you call `update`. Call it once a tick, with the same
`deltaMs` your game's loop advances everything else by. That keeps a test
exact: the same calls and the same ticks always give the same result.

Its song moves on with its clock. So `song`, `orderIndex`, `row`, `beat`
and `positionMs` say where the song has got to after each `update`. There's
no speaker to wait for, so a song played shows in `song` at once, and
reaches its first row straight away. While the chip is paused, `update`
does nothing.

```ts
import { createHeadlessAudio80 } from 'audio90/headless';

const chip = createHeadlessAudio80();
chip.play(FANFARE);
for (let i = 0; i < 60; i++) chip.update(1000 / 60);
console.log(chip.beat); // 2.5 at 150 BPM, a second in
```

The options a headless chip takes are the callbacks a browser's chip takes:
`onRow`, called as the song reaches each row, and `onEnded`, called as a
song ends by itself. A headless chip calls them during `update`, in order,
for what that update played. So a callback never runs inside your call to
`play` or `stop`.

## Rendering Songs and Sounds

To hear what a song or a sound sounds like, render it. `render(songOrSound,
options?)` plays it on a chip that renders into memory, and returns its
samples:

- For an Audio80 song or sound, it returns a new `Float32Array`.
- For an Audio90 song or sound, it returns a new `StereoSamples`.

A song is rendered for one pass through its order. A song that loops is
stopped where it would go back to its loop. The chip and the song are
moved on a tick at a time, every 60th of a second, as a game loop would
move them. A sound is played once, with its own note and length, and on
the Audio90 at its own pan.

Each renders a little past the end, so that the release of the last notes,
and the echo, can fade. They take these options:

| Option | Meaning | Default |
| --- | --- | --- |
| `sampleRate` | The sample rate to render at | 48,000 |
| `character` | How the chip sounds | `'classic'` on the Audio80, `'studio'` on the Audio90 |
| `tickMs` | How long each tick is, in ms | 1000 / 60 |
| `durationMs` | How long to render, in ms | One pass through the song, or the sound's length and release, and then 600 ms more |

A sound that holds its note until it is stopped, with a `lengthMs` of
`Infinity`, never ends by itself. So give it a `durationMs` to render.

## Measuring

`measurePeak(samples)` returns the peak, which is the level of the loudest
sample. The output holds levels up to 1. A sound that peaks near 1 is
squashed by the output, which distorts it.

`measureLoudness(samples, sampleRate?)` returns how loud the sound seems to
a listener, in LUFS. LUFS is the standard unit for that. The values are
negative, and nearer 0 is louder. It measures as the ITU-R BS.1770 standard
says, which is how streaming services measure it too. Silence measures
`-Infinity`.

Both take mono or stereo sound. The peak of stereo sound is its louder
channel's. Its loudness adds up the two channels' power, as BS.1770 adds up
each speaker's. Mono sound is measured as a browser plays it, on both
speakers, so a song measures the same on either chip if it sounds as loud.

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

`findSounds(exports)` returns the songs and sounds a module exports, each
with its export name. Pass it the module's namespace, from
`import * as sounds from './sounds'`, and a test covers every sound the
module adds later too. It looks inside exported arrays as well, so a set of
sounds you make in a loop is found. Each is named for its place in the
array, such as `FANFARES[2]`.

An audio test for a game's sounds checks that each one can be heard, is
not squashed and has not changed. It also checks that each song is at the
shared loudness:

```ts
import { describe, expect, it } from 'vitest';
import {
    findSounds, hashSamples, LOUDNESS_TOLERANCE_LU, measureLoudness,
    measurePeak, REFERENCE_LOUDNESS_LUFS, render,
} from 'audio90/headless';
import * as music from './music';
import * as effects from './sounds';

/** Quieter than this, a sound is lost under the music. */
const AUDIBLE = 0.08;
/** Louder than this, the output is squashing it. */
const CLIPPING = 0.9;

const { songs, sounds } = findSounds({ ...effects, ...music });

describe('sounds', () => {
    for (const [name, sound] of sounds) {
        it(`${name} sounds as it did, audible and unclipped`, () => {
            const samples = render(sound);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    for (const [name, song] of songs) {
        it(`${name} sounds as it did, as loud as every other song`, () => {
            const samples = render(song);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            const loudness = measureLoudness(samples);
            const offBy = Math.abs(loudness - REFERENCE_LOUDNESS_LUFS);
            expect(offBy).toBeLessThanOrEqual(LOUDNESS_TOLERANCE_LU);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }
});
```

A song's sounds are found too, if the module exports them. A sound made for
a song, such as a bass drum, may be too quiet on its own for `AUDIBLE`. If
so, leave it unexported, or check it in a test of its own.

When a change alters a sound, its test fails. Listen to the new sound
first (see [Listening](#listening)). Then, if it is right, update its
reference with `vitest -u`.

## Testing the Code That Plays Sound

An audio test checks how a sound sounds. A different test checks that your
game plays the right sound at the right moment. For that, give your game's
code a headless chip, and watch the calls it makes. Vitest's `vi.spyOn`
records each call to a method while still running it:

```ts
import { expect, it, vi } from 'vitest';
import { createHeadlessAudio80 } from 'audio90/headless';
import { BOSS_TUNE, COIN } from './sounds';

it('plays a coin each time the player picks one up', () => {
    const sfx = createHeadlessAudio80();
    vi.spyOn(sfx, 'play');
    const game = createGame({ sfx });
    game.collectCoin();
    expect(sfx.play).toHaveBeenCalledWith(COIN);
});

it('fades the boss music out as the boss is beaten', () => {
    const music = createHeadlessAudio80();
    vi.spyOn(music, 'stop');
    const game = createGame({ music });
    game.spawnBoss();
    expect(music.song).toBe(BOSS_TUNE);
    game.defeatBoss();
    const fade = { fadeMs: 2000 };
    expect(music.stop).toHaveBeenCalledWith(expect.any(Number), fade);
});
```

Name the exact sound in the check, as `COIN` is named here. Two sounds
often share a first note, so a check that some note played still passes
when the code plays the wrong sound.

To check something that happens over time, such as music that speeds up as
a timer runs down, call the chip's `update` as your game's loop does, then
read `song`, `row` or `tempoScale`.

## Listening

`encodeWav(samples, sampleRate)` returns rendered samples as a 16-bit WAV
file, in a `Uint8Array`. Mono samples make a mono file, and stereo samples
a stereo one. Any audio player can play it. This Node script saves every
song and sound a module exports, so you can listen without starting your
game:

```ts
import { writeFileSync } from 'node:fs';
import { encodeWav, findSounds, render } from 'audio90/headless';
import * as music from './music';

const { songs, sounds } = findSounds(music);
for (const [name, songOrSound] of [...songs, ...sounds]) {
    const wav = encodeWav(render(songOrSound), 48000);
    writeFileSync(`${name}.wav`, wav);
}
```

Import the modules that define the sounds, not a module that also loads
pictures or other files that only a browser can load.

## Exports

| Export | Description |
| --- | --- |
| `createHeadlessAudio80` (`HeadlessAudio80`, `HeadlessAudio80Options`) | Returns a new Audio80 with no speaker, whose clock moves on with its `update` |
| `createHeadlessAudio90` (`HeadlessAudio90`, `HeadlessAudio90Options`) | Returns a new Audio90 with no speaker, as `createHeadlessAudio80` does |
| `HeadlessChip` | The type of what every headless chip has: a chip's members, and `update` |
| `render` (`RenderOptions`, `Audio80RenderOptions`, `Audio90RenderOptions`) | Returns the samples of a song's one pass, or of a sound played once: a new `Float32Array` for the Audio80, and a new `StereoSamples` for the Audio90 |
| `StereoSamples`, `RenderedSamples` | The types of stereo sound, and of sound in mono or stereo |
| `measurePeak` | Returns the peak of samples, mono or stereo, which is the level of the loudest one |
| `measureLoudness` | Returns the loudness of samples, mono or stereo, in LUFS |
| `REFERENCE_LOUDNESS_LUFS` | The loudness every song is written to: -20 LUFS |
| `LOUDNESS_TOLERANCE_LU` | How far a song's loudness may stray from `REFERENCE_LOUDNESS_LUFS`: 3 LU |
| `hashSamples` | Returns a short hash of samples, mono or stereo, as a string of 8 hex digits |
| `findSounds` (`ModuleSounds`) | Returns the songs and sounds a module exports, for either chip, with their names |
| `encodeWav` | Returns samples encoded as a 16-bit WAV file, mono or stereo, as a `Uint8Array` |
