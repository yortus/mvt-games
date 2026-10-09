# @mvtjs/audio

This package holds virtual audio chips for the Arcade. There is one so far,
the **Audio80**. It is a sound chip in the spirit of the 1980s home
computers. It has eight voices, and each voice plays one note at a time.
It also has two filters, which make a sound duller or thinner by cutting
some of its frequencies. They are resonant, so they can also make it ring.
The chip also has an echo, and its output is mono, not stereo.

The chip comes with a tracker notation for writing its music and sound
effects. A tracker writes music as a grid of text, read from top to bottom,
as the musicians of the 1980s did. The package also has a music player,
which audio views use to play songs on the chip. An audio view is a view
that plays sound and draws nothing.
The package is private to this repo for now.

## Guides

- **[Using the Audio80](docs/using-the-audio80.md)** covers getting a chip,
  designing sound effects and instruments, and playing them from audio
  views as the game changes. It also covers music, repeating sounds, the
  balance of music and effects, and testing.
- **[Writing Tracker Music](docs/writing-tracker-music.md)** builds one
  tune, from a single note up to a loop with four parts. On the way it
  covers instruments, patterns of rows, the order they play in, and
  everything a cell of the grid can hold. It also covers arranging habits
  that suit the chip.

The MVT guide's [Sound](../docs/building-with-mvt/presenting-the-world/sound.md)
page explains why playing sound is a view's job. It also shows where audio
views run in each tick.

## A Taste

This sound effect is written as a step table. A step table lists how a
sound changes, one short step per row. Here each step lasts 25 ms. The
pitch rises by 0, then 7, then 12 semitones above the note E-6, which is
the E in octave 6. A semitone is the step from one piano key to the next,
and 12 semitones make an octave. The envelope sets how the volume rises
and fades. The effect is created once, when the module loads:

```ts
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

This song is written as rows and channels. The rows are time, from top to
bottom. The channels are voices, from left to right. Each channel plays
one part of the tune. Here they are the lead (the melody), the bass and
the drums. Each pattern is a string in backticks, with one row on each
line:

```ts
export const FANFARE = createSong({
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

An **audio view** draws nothing. In its refresh step it polls its bindings,
like any view. It plays a sound when it sees the model change:

```ts
setRefresh(view, () => {
    const w = watcher.poll();
    if (w.coins.increased) sound.play(COIN);
});
```

The chip never reads the wall clock. Its clock advances only when the game
loop advances it, by the same `deltaMs` as the models. So the sound pauses
when the game pauses, and music keeps its tempo at any frame rate.

## Exports

The package has three import paths:

- `@mvtjs/audio` holds what games use, and runs anywhere.
- `@mvtjs/audio/web` holds the chip that plays sound in a browser, through
  Web Audio. It loads an `AudioWorklet`, the browser's way to run code that
  computes sound on its own thread, so it runs only in a browser.
- `@mvtjs/audio/headless` runs the chip without a speaker. A game run
  headless, as for thumbnails, plays on a headless chip. Tests and tools use
  one to render sound in memory, measure it and save it as WAV files, as
  `npm run audio:render` does. Its [README](src/headless/README.md) covers
  those tools.

| Import Path | Export | Description |
| --- | --- | --- |
| `@mvtjs/audio` | `createInstrument` | Returns a new `Instrument`, parsed from its options. A mistake throws an error that says where it is |
| | `createSoundEffect` | Returns a new `SoundEffect`, parsed the same way |
| | `createSong` | Returns a new `Song`, parsed the same way |
| | `computeSongDurationMs` | Returns how long one pass through a song's order (its list of patterns) lasts, in ms |
| | `createMusicPlayer` | Returns a new `MusicPlayer`, which plays one song at a time on a chip |
| `@mvtjs/audio/web` | `createWebAudio80` | Returns a new chip that plays on an `AudioContext` you give it, and its controls. An `AudioContext` is the browser's object for playing sound |
| `@mvtjs/audio/headless` | `createHeadlessAudio80` | Returns a new chip with no speaker, and its controls. It can be silent, log every write, or render sound in memory |

The types in these signatures are exported too, among them `Audio80`,
`AudioControls`, `Audio80WithControls`, `Song`, `SoundEffect` and `Wave`.

## Layout

```
src/
├── index.ts            @mvtjs/audio
├── core/               The synthesiser: voices, filters, echo, the
│                       command queue and the voice allocator
├── notation/           Parses the tracker notation (createInstrument,
│                       createSoundEffect, createSong)
├── chip/               The Audio80 interface, its controls interface,
│                       and an implementation that writes commands to a buffer
├── music-player/       The music player
├── headless/           @mvtjs/audio/headless: the chip without a speaker,
│                       and tools that render, measure and save sound
└── web/                @mvtjs/audio/web: the browser chip, which runs in an
                        AudioWorklet
docs/                   The guides
scripts/
└── render-wav.ts       Renders a module's songs and effects to WAV files
```

The synthesiser, in `src/core/`, is plain TypeScript with no Web Audio in it.
It reads no clock. So the same writes always render the same samples, in
the browser's worklet and in Node alike.
