# @mvtjs/audio

This package holds virtual audio chips for the Arcade. A virtual sound chip
is a sound chip simulated in code. There are two:

- The **Audio80** is in the spirit of the 1980s home computers. It has
  eight voices, and each voice plays one note at a time. It also has two
  filters, which make a sound duller or thinner by cutting some of its
  frequencies. They are resonant, so they can also make it ring. The chip
  also has an echo, and its output is mono, not stereo.
- The **Audio90** is in the spirit of the synthesisers, samplers and game
  consoles of the 1990s. It has sixteen stereo voices. Each one plays FM,
  analog oscillators or samples, through a filter of its own. You never
  record its samples. Each one is a short song that the chip plays and
  keeps. It also has a reverb, a stereo echo and a chorus, and a pump that
  makes the mix breathe with the bass drum.

Both chips come with a tracker notation for writing their music and sound
effects. A tracker writes music as a grid of text, read from top to bottom,
as the musicians of the 1980s and 1990s did. The package also has a music
player, which audio views use to play songs on either chip. An audio view is
a view that plays sounds instead of drawing visuals.
The package is private to this repo for now.

## Guides

- **[Using the Audio80](docs/using-the-audio80.md)** covers getting a chip,
  designing sound effects and instruments, and playing them from audio
  views as the game changes. It also covers music, repeating sounds, the
  balance of music and effects, and testing.
- **[Using the Audio90](docs/using-the-audio90.md)** helps you choose a
  chip for your game. It shows you the Audio90's engines, instruments,
  samples and stereo sound effects, how to mix them, and how to change the
  way the chip sounds. It ends with recipes for the decade's sounds, from an
  FM piano to a sliced drum break.
- **[Writing Tracker Music](docs/writing-tracker-music.md)** builds one
  tune, from a single note up to a loop with four parts. On the way it
  covers instruments, patterns of rows, the order they play in, and
  everything a cell of the grid can hold. It also covers arranging habits
  that suit the chip, and what a song for the Audio90 adds.

The MVT guide's page
[Sound and Music](../../sites/docs/building-with-mvt/presenting-the-world/sound.md)
explains why playing sound is a view's job. It also shows how an audio view
sits among a game's other views, and is ticked with them.

## A Taste

These examples use the Audio80. You write the Audio90's the same way,
with a few more options. This sound effect is written as a step table. A step table lists how a
sound changes, one short step per row. Here each step lasts 25 ms. The
pitch rises by 0, then 7, then 12 semitones above the note E-6, which is
the E in octave 6. A semitone is the step from one piano key to the next,
and 12 semitones make an octave. The envelope sets how the volume rises
and fades. The effect is created once, when the module loads:

```ts
/** A coin: a bright blip up a fifth. */
export const COIN = createAudio80SoundEffect({
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

This song is written as rows and channels. The rows are time, from top to
bottom. The channels are voices, from left to right. Each channel plays
one part of the tune. Here they are the lead (the melody), the bass and
the drums. Each pattern is a string in backticks, with one row on each
line:

```ts
export const FANFARE = createAudio80Song({
    bpm: 150,
    instruments: { L: LEAD, B: BASS, k: KICK, h: HAT },
    patterns: {
        fanfare: `
            # lead      | bass      | drums
            # -----------------------------
            | E-5 L v9  | E-2 B     | k
            | ...       | ...       | h
            | G-5       | E-3       | h
            | B-5 ~     | ...       | h
        `,
    },
    order: ['fanfare', 'fanfare+5'],
});
```

An **audio view** is a view that plays sounds instead of drawing visuals.
In its refresh step it polls its bindings, like any view. It plays a sound
when it sees the model change:

```ts
setRefresh(view, () => {
    const w = watcher.poll();
    if (w.coins.increased) sound.play(COIN);
});
```

On the Audio90, your audio view plays its effects the same way. It can
also place each one in stereo, where it happens on screen:

```ts
if (w.coins.increased) sound.play(COIN, toPan(bindings.lastCoinX()));
```

The chip never reads the wall clock. Its clock advances only when the game
loop advances it, by the same `deltaMs` as the models. So the sound pauses
when the game pauses, and music keeps its tempo at any frame rate.

## Exports

The package has three import paths:

- `@mvtjs/audio` holds what games use, and runs anywhere.
- `@mvtjs/audio/web` holds the chips that play sound in a browser, through
  Web Audio. Each loads an `AudioWorklet`, the browser's way to run code that
  computes sound on its own thread, so it runs only in a browser. Each chip's
  worklet is a module of its own, downloaded only when that chip is made.
- `@mvtjs/audio/headless` runs each chip without a speaker. A game run
  headless, as for thumbnails, plays on a headless chip. Tests and tools use
  one to render sound in memory, measure it and save it as WAV files, as
  `npm run audio:render` does. Its [README](src/headless/README.md) covers
  those tools.

| Import Path | Export | Description |
| --- | --- | --- |
| `@mvtjs/audio` | `createAudio80Instrument` | Returns a new `Audio80Instrument`, parsed from its options. A mistake throws an error that says where it is |
| | `createAudio80SoundEffect` | Returns a new `Audio80SoundEffect`, parsed the same way |
| | `createAudio80Song` | Returns a new `Audio80Song`, parsed the same way |
| | `createAudio90Instrument` | Returns a new `Audio90Instrument`, an FM, analog or sample instrument, parsed from its options. A mistake throws an error that names the option, such as `operators[3].ratio` |
| | `createAudio90Sample` | Returns a new `Audio90Sample`: a song to bounce, which the chip plays and keeps as a sample, and how to keep it |
| | `prepareAudio90Samples` | Bounces the samples given that are not bounced yet, as an entry loads, and throws if they need more than the chip's sample memory |
| | `createAudio90SoundEffect` | Returns a new `Audio90SoundEffect`, parsed the same way |
| | `createAudio90Song` | Returns a new `Audio90Song`, with its mixer, effects, pump and character |
| | `formatAudio90Cell` | Returns the text of one cell of an `Audio90Song`'s pattern, in columns as a tracker shows it, which parses back into the same cell |
| | `computeSongDurationMs` | Returns how long one pass through either chip's song's order (its list of patterns) lasts, in ms |
| | `createMusicPlayer` | Returns a new `MusicPlayer`, which plays one song at a time on the chip it is given, `{ audio80 }` or `{ audio90 }` |
| `@mvtjs/audio/web` | `createWebAudio80` | Returns a new Audio80 that plays on an `AudioContext` you give it, and its controls. An `AudioContext` is the browser's object for playing sound |
| | `createWebAudio90` | Returns a new Audio90 that plays in stereo on an `AudioContext`, and its controls. It can share the context with an Audio80 |
| `@mvtjs/audio/headless` | `createHeadlessAudio80` | Returns a new Audio80 with no speaker, and its controls. It can be silent, log every write, or render sound in memory |
| | `createHeadlessAudio90` | Returns a new Audio90 with no speaker, and its controls, as `createHeadlessAudio80` does. It renders in stereo |

The types in these signatures are exported too, among them `Audio80`,
`Audio90`, `AudioControls`, `Audio80WithControls`, `Audio90WithControls`,
`Audio80Song`, `Audio80SoundEffect`, `Audio80Wave`, `Audio90Instrument`,
`Audio90SoundEffect` and `Audio90Sample`. So are the Audio90's sizes:
`AUDIO90_VOICE_COUNT` (16 voices), `AUDIO90_SAMPLE_MEMORY` (how many
samples its samples may hold between them), `AUDIO90_SCOPE_POINTS`,
`AUDIO90_SCOPE_PANS` and `AUDIO90_SCOPE_LENGTH` (how its `scope` array is
laid out), and `AUDIO90_CELL_TEXT_WIDTH` (how many characters
`formatAudio90Cell` writes before a cell's effects).

## Layout

```
src/
├── index.ts            @mvtjs/audio
├── shared/             What any chip uses: the controls interface, the
│                       command buffer and queue, note names, the note
│                       driver, the voice allocator for sound effects, and
│                       the tracker notation's grammar
├── audio80/            The Audio80
│   ├── synthesiser/    Its voices, filters and echo, and its commands
│   ├── notation/       Its instruments, sound effects and songs
│   │                   (createAudio80Instrument, createAudio80SoundEffect, createAudio80Song)
│   └── chip/           The Audio80 interface, and an implementation that
│                       writes commands to a buffer
├── audio90/            The Audio90
│   ├── synthesiser/    Its voices, engines, effects and output stage, and
│   │                   its commands
│   ├── notation/       Its instruments, samples and bouncing, sound effects
│   │                   and songs, and what a song's rows write to the chip
│   └── chip/           The Audio90 interface, and its command writer
├── music-player/       The music player
├── headless/           @mvtjs/audio/headless: each chip without a speaker,
│                       and tools that render, measure and save sound, in
│                       mono or stereo
└── web/                @mvtjs/audio/web: the browser chips, each with its
                        own AudioWorklet module, and what they share: the
                        clock, the held writes and the runner
docs/                   The guides
scripts/
└── render-wav.ts       Renders a module's songs and effects to WAV files
```

Each synthesiser, in `src/audio80/synthesiser/` and `src/audio90/synthesiser/`, is plain TypeScript with no Web Audio in it.
It reads no clock. So the same writes always render the same samples, in
the browser's worklet and in Node alike.
