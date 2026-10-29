# audio90

Two little sound chips for games and web pages, simulated in code. Each
chip plays music and sound effects in the style of its decade. You write
both in plain text, and the chip plays them in the browser, on its own
thread, so a slow frame never makes the music stutter.

- The **Audio80** is in the spirit of the 1980s home computers. It has four
  voices, and each voice plays one note at a time. It has two resonant
  filters, which make a sound duller or thinner and can make it ring, and
  an echo. Its output is mono.
- The **Audio90** is in the spirit of the synthesisers, samplers and game
  consoles of the 1990s. It has sixteen stereo voices, and each one plays
  FM, analog oscillators or samples through a filter of its own. You never
  record its samples: the chip plays a short piece of music and keeps what
  it hears. It has a reverb, a stereo echo, a chorus, and a pump that makes
  the mix breathe with the bass drum.

```sh
npm install audio90
```

It has no dependencies, and it works with any framework, or none.

## A Song

A song is written as a grid of text. The rows are time, read from top to
bottom. The columns are channels, and each channel plays one part, here a
lead and a bass. Each sound is made once, and played as often as you like:

```ts
import { createAudio80, createAudio80Song, createAudio80Sound } from 'audio90';

const LEAD = createAudio80Sound({ wave: 'pulse', volume: 0.6 });
const BASS = createAudio80Sound({ wave: 'triangle' });

const TUNE = createAudio80Song({
    bpm: 120,
    instruments: { L: LEAD, B: BASS },
    patterns: {
        intro: `
            | C-5 L | C-3 B
            | E-5   | ...
            | G-5   | G-2
            | E-5   | ...
        `,
    },
    order: ['intro', 'intro+5'],
    loop: 0,
});

const music = createAudio80();
music.play(TUNE);
```

`C-5` is the note C in octave 5. The letter after a note names the sound
that plays it, and `...` lets the note before it ring on. The order plays
the pattern, then plays it again five semitones higher, and `loop: 0` sends
it back to the first entry, so it plays until it is stopped. [Writing Tracker Music](docs/writing-tracker-music.md) explains
everything a row can hold.

A browser lets a page make sound only after the visitor clicks, taps or
presses a key. So a song played before then starts as soon as they do.

## A Sound Effect

A sound effect is a sound too. This one is a coin: a bright blip that jumps
up a fifth and then an octave, one step every 25 ms:

```ts
import { createAudio80, createAudio80Sound } from 'audio90';

const COIN = createAudio80Sound({
    note: 'E-6',
    stepMs: 25,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    steps: `
        # wave   pitch
        pulse    +0
        pulse    +7
        pulse    +12
    `,
});

const sfx = createAudio80();
button.addEventListener('click', () => sfx.play(COIN));
```

The envelope sets how the volume rises and fades. A semitone is the step
from one piano key to the next, and 12 of them make an octave.

## A Chip for Each

A game makes two chips: one for its music and one for its sound effects.
Each chip has a few voices, and a sound effect may take a voice the music
was using, as on the old consoles. With a chip each, the music never loses
a note to an explosion. It also lets you fade or turn down the music
without touching the effects. Two chips can share one `AudioContext`, the
browser's object for playing sound.

## Playing With a Game

A chip keeps the sound card's time, not the game's. So when your game
pauses, pause its chips too, and resume them as it plays on:

```ts
function setPaused(isPaused: boolean): void {
    for (const chip of [music, sfx]) {
        if (isPaused) chip.pause();
        else chip.resume();
    }
}
```

A chip also holds its sound by itself while the page is hidden, such as
in a background tab. A page that should play on in the background, such as
a music player, makes its chips with `pauseWhenHidden: false`.

The music can follow the game, too. `tempoScale` speeds a song up or slows
it down, `stop(id, { fadeMs: 1000 })` fades it out, and `beat`, `row` and
`positionMs` say where the music the listener hears has got to, so a game
can move in time with it.

## Tests and Tools

`audio90/headless` has each chip without a speaker. A headless chip takes
every call a browser chip does, and its clock moves on only when you call
`update(deltaMs)`, so a test of the code that plays sound is exact. It can
also render songs and sounds in memory, measure them, and save them as WAV
files. Its [README](src/headless/README.md) covers those tools.

## Guides

- **[Using the Audio80](docs/using-the-audio80.md)** covers what both chips
  share: getting a chip on a page, designing sounds, playing songs and
  following them, the mix, and testing.
- **[Using the Audio90](docs/using-the-audio90.md)** helps you choose a
  chip. It shows what the Audio90 adds: its engines, samples, stereo, its
  effects and mix, and recipes for the decade's sounds, from an FM piano to
  a sliced drum break.
- **[Writing Tracker Music](docs/writing-tracker-music.md)** builds one
  tune, from a single note up to a loop with four parts, and covers
  everything a row can hold.

## Loading the Chips Later

Each browser chip carries the code its audio thread runs, 20 to 35 KB
minified, so there is no file to copy beside your app. A bundler leaves out
a chip you never make. If your page must show something before that code
arrives, you can load the chips later, as
[Using the Audio80](docs/using-the-audio80.md#loading-the-chips-later)
explains.

## Exports

| Export | Description |
| --- | --- |
| `createAudio80`, `createAudio90` | Return a new chip that plays in the browser, on an `AudioContext` you give it or one of its own |
| `createAudio80Sound`, `createAudio90Sound` | Return a new sound, checked and parsed from its options. A mistake throws an error that says where it is |
| `createAudio80Song`, `createAudio90Song` | Return a new song, parsed from its patterns and order, with its length in `durationMs` |
| `createAudio90Sample` | Returns a new sample: a song for the Audio90 to play and keep as a sample |
| `prepareAudio90Samples` | Bounces the samples given that are not bounced yet, and throws if they need more than the chip's sample memory |
| `printAudio90Song`, `parseAudio90Song` | Return a song as text, such as for saving to a file, and the song that text describes |
| `printAudio90Cell` | Returns the text of one cell of a song's pattern, in columns as a tracker shows it |
| `createScope` | Returns a scope attached to a chip: what each of its voices is playing, for drawing |

The types in these signatures are exported too, among them `Audio80`,
`Audio90`, `SoundChip`, `SongPlayOptions`, `SongPlace`, `StopOptions` and
`SongCallbacks`. So are the Audio90's sizes, `AUDIO90_VOICE_COUNT` and
`AUDIO90_SAMPLE_MEMORY`, and the constants a scope or a tracker display
lays itself out by.

`audio90/headless` exports `createHeadlessAudio80`,
`createHeadlessAudio90`, `render`, and the tools that measure rendered
sound. Its [README](src/headless/README.md) lists them.

## Contributing

To work on audio90 itself, see [CONTRIBUTING.md](./CONTRIBUTING.md). It
explains how its tests run, how the package is laid out, how to keep the
synthesisers fast, and how the package is built and published.
