# Proposal: A Virtual Sound Chip, and Sound for the Arcade

> No entry in the Arcade makes a sound, although the docs say more than once
> that a view can target audio. This proposal designs the tool every entry
> will make its sound with: a small virtual sound chip in the spirit of the
> C64's SID (pulse, sawtooth, triangle and pitched noise, hard sync and ring
> modulation, ADSR envelopes, a resonant filter), brought up to date with
> eight stereo voices, two filters, an echo, wavetables and instruments that
> run their own arpeggios and sweeps. Instruments are TypeScript objects;
> sound effects and music are written as string arrays, a tracker in the
> source, the way pixel art is drawn as string arrays now. The chip keeps to
> MVT: its clock is the ticks, so it pauses when the entry pauses and plays
> nothing it has not been told, and sound is played by **audio views**, which
> poll bindings with `watch` like any other view. Galaxy Raiders is the
> demonstration, with sound effects and music.

**Status:** proposed. Nothing implemented or spiked. Step 1 is a spike that
settles the numbers this design guesses at (section 3.3 and section 11).

**Written:** 2026-10-06, against `vnext` at `fafee01`. Checked against the
entry host ([`entry-host.ts`](../../packages/website/src/runner/entry-host.ts),
[`pixi-stage.ts`](../../packages/website/src/runner/pixi-stage.ts)), the start options in
[`entry-starter.ts`](../../packages/website/src/entry-types/entry-starter.ts), `watch`
([`watch.ts`](../../packages/utils/src/watch.ts)), Galaxy Raiders' models and views,
the texture scripts' string-array art
([`generate-crumb-chase-textures.ts`](../../packages/website/scripts/generate-crumb-chase-textures.ts)),
and every page of the docs that mentions sound or audio. Timing and cost
figures are estimates until the spike.

**Related:**
[Views (architecture)](../../packages/docs/architecture/views.md) -
[Change Detection](../../packages/docs/building-with-mvt/reacting-to-changes/change-detection.md) -
[Why Polling](../../packages/docs/building-with-mvt/reacting-to-changes/why-polling.md) -
[Presentation State](../../packages/docs/building-with-mvt/adding-visual-polish/presentation-state.md) -
[Time Management](../../packages/docs/building-with-mvt/simulating-the-world/time-management.md) -
[Hot Paths](../../packages/docs/building-with-mvt/performance/hot-paths.md) -
[Originality](../../packages/website/src/entries/README.md#originality) -
[035](035-demoscene-demo.md) section 8 (music deferred to "an audio view", which this would provide) -
[008](008-watch-builder-spike.md) (`watch`, which audio views lean on) -
[042](042-visual-snapshot-tests.md) (visual snapshots; section 10.5 here is their audio cousin)

---

## Summary

| # | Decision | Recommendation | Section |
| --- | --- | --- | --- |
| 1 | What the chip is | Eight voices, each with SID-style waveforms (combined waveforms and pitched noise included), sync, ring modulation and ADSR, plus a 32-step wavetable. Two resonant multimode filters, stereo pan, an echo, and an output stage with a choice of grit | [2](#2-the-chip) |
| 2 | How high-level it is | Two layers inside the chip: voices you can set directly, and instruments that run arpeggios, vibrato, pulse and filter sweeps and step tables by themselves at 60 steps a second | [2.6](#26-instruments-the-chips-driver) |
| 3 | Where the sound is made | An `AudioWorklet`, around a core of plain TypeScript with no Web Audio in it, so the same code runs in Node for tests and for rendering WAV files | [4](#4-where-the-code-lives) |
| 4 | Where time comes from | The ticks. The host advances the chip's clock with the same `deltaMs` as the models; every write is stamped with chip time; the worklet plays a short, steady distance behind and never past what it has been told. Pause, hidden tabs and fast-forward need nothing extra | [3](#3-time-the-chips-clock-is-the-ticks) |
| 5 | Latency against steadiness | Music is played from its stamps, sample-accurately. Sound effects skip the queue and play as soon as they arrive, since a one-shot has no rhythm to keep | [3.5](#35-sound-effects-skip-the-queue) |
| 6 | Who decides what plays | **Audio views**: views like any other, whose refresh polls bindings with `watch` and plays on a change. Models gain no events. Where an event leaves no lasting state, the model keeps a count | [6](#6-playing-sounds-from-views) |
| 7 | Where the song position lives | In the audio view, as presentation state advanced by its update step. So music pauses with the entry, follows the game's state (tempo, which tune), and other views can read the beat | [6.1](#61-the-music-player) |
| 8 | How sounds are written | Instruments as TypeScript objects. Sound effects and songs as string arrays in a small tracker notation, with instruments named by single letters as pixel art names its colours. Parsed once, at load, with errors that give the row and channel | [5](#5-writing-sounds) |
| 9 | Who owns the chip | The entry host: one chip for the site, given to each session in its start options (`sound`), reset between sessions. Headless starts (thumbnails, benchmarks, tests) get a silent chip | [7](#7-the-host-and-the-arcade) |
| 10 | Where the code lives | A new private workspace package, `@mvtjs/sound`, beside `@mvtjs/utils` | [4.1](#41-a-new-private-package-mvtjssound) |
| 11 | The demonstration | Galaxy Raiders: eight sound effects, four original tunes, one counter added to its model, and two audio views | [8](#8-the-demonstration-galaxy-raiders) |
| 12 | How it is tested | The core in Node: pitch, timing, envelopes, determinism, and golden hashes of rendered audio. Audio views against a recording chip | [10](#10-testing) |

---

## 1. Why, and What Done Looks Like

The architecture pages say a view can target "canvas, DOM, audio, terminal,
test harness" ([rules](../../packages/docs/architecture/rules.md), V-output), and the
model and view tables pair "named events" with "sound files, volume,
panning". Nothing in the repo shows it. The one worked example of audio in
the docs ([Why Polling](../../packages/docs/building-with-mvt/reacting-to-changes/why-polling.md#hybrid-approaches))
reaches for an event bus, `audioManager.on('enemy-destroyed', ...)`, which
is the one place the docs step outside polling. Sound is worth adding for
its own sake (an arcade without it is a museum), and it is also the
architecture's most interesting untested claim: audio runs on a clock of its
own, cannot be refreshed idempotently in the obvious way, and is about events
more than states.

**The goals:**

- **One tool, for every entry.** A game author writes instruments, effects
  and tunes, and plays them from views. Nobody touches Web Audio.
- **The sound of the 1980s.** Raspy pulse leads with width sweeps, fast
  arpeggio chords, a squelchy resonant filter on the bass, noise drums. A few
  modern comforts (stereo, an echo, more voices) that do not sand that off.
- **Easy at a high level, open at a low one.** Play an effect in one call;
  write a tune as text; set a voice's pulse width directly when you need to.
- **Faithful to MVT.** Time comes only from ticks. Models know nothing of
  sound. Views decide what plays, from state they poll.
- **Testable without a browser.** The synthesis is plain TypeScript, and an
  audio view can be ticked against a chip that records what it was told.

**Done looks like:** Galaxy Raiders plays a fanfare as each stage starts, a
four-voice tune while the raiders fly (which speeds up as the last few are
left), and effects for shots, dives, explosions, the ship's loss, stage
clear and game over, panned to where they happen on screen. The Arcade has a
mute control. Pausing the game pauses the tune mid-note, and resuming picks it
up where it stopped. The docs have a page on audio views, and the tables that
mention sound say what the repo does.

---

## 2. The Chip

### 2.1 What it borrows, and what it changes

The SID (1982) is the model because its sound is the most recognisable of
the era's chips and because its features are few and composable. The chip is
not an emulation of it, and borrows no name, register map or filter curve.

| | The SID | This chip | Why |
| --- | --- | --- | --- |
| Voices | 3 | **8** | Room for a four-channel tune and four effects at once. Still few enough that a busy moment has to choose |
| Waveforms | Triangle, saw, pulse, noise; combinations ANDed together | The same, combinations included, **plus a 32-step, 4-bit wavetable** per voice | The combined waveforms are much of the SID's metallic character. The wavetable is the other chips' trick (the console wave channels), good for bass and soft leads |
| Noise | Pitched, from a 23-bit shift register | The same idea: a shift register clocked at the voice's pitch, seeded, so it is deterministic | Pitched noise is what makes snares and explosions sound like a chip and not like hiss |
| Sync, ring | Each voice to the one before, fixed in a ring | Each voice to **any one other voice**, defaulting to the one before | The fixed ring is a constraint with no musical upside |
| Envelope | ADSR, 16 rates per stage, with a famous timing bug | ADSR in milliseconds, exponential decay and release, no bug | Players worked around the bug with "hard restart"; there is nothing to work around |
| Filter | One, 12 dB/octave, low/band/high-pass and combinations, resonance | **Two**, the same kind, with a little drive for its growl | One filter for the tune and one for effects, so an explosion does not sweep the bass |
| Output | Mono, 4-bit master volume | **Stereo**, pan per voice, an **echo** with a send per voice, master volume, and a character setting (section 2.4) | Stereo placement follows the game on screen; the echo is the modern chiptune staple |
| Who plays it | Software running 50 times a second, writing registers | The same idea, built in: instruments run their own tables at 60 steps a second (section 2.6) | Arpeggios and sweeps at frame steps are the sound; building them in makes them one call |

**Kept limits, on purpose.** Eight voices and no more: effects and music
share them, and a song with many channels leaves few for effects. No sampled
sound at all, only oscillators. Instruments step at 60 Hz, which is coarse on
purpose: a 60 Hz arpeggio is a chord on a chip, and a 1 kHz one is a buzz.
Wavetables are 32 steps of 16 levels.

### 2.2 Voices

Each voice has:

- **Pitch**, in hertz (set from notes by everything above it), and an
  optional **glide** time towards a new pitch.
- **Waveform**: any combination of `triangle`, `saw`, `pulse` and `noise`,
  or `wavetable`. Combinations are ANDed bitwise, as the SID's were, which
  is what gives `triangle+saw` and `pulse+saw` their thin, metallic tone.
  Noise combined with another waveform all but silenced the original; here
  it is rejected when the instrument is defined.
- **Pulse width**, 0 to 1.
- **Sync** (the voice's phase restarts whenever its source's wraps) and
  **ring** (the triangle's sign follows its source's), each from one other
  voice.
- **Envelope**: attack, decay, sustain, release, and a gate. Note-on opens
  the gate; note-off starts the release.
- **Volume**, **pan** (-1 to 1), **filter** (none, `a` or `b`) and **echo
  send** (0 to 1).

Oscillators are phase accumulators at the output rate. Whether they are band
limited is the output stage's choice (section 2.4).

### 2.3 Filters

Two state-variable filters, `a` and `b`, each with a **mode** (any
combination of low-pass, band-pass and high-pass; low and high together
make a notch), a **cutoff** in hertz, **resonance** from 0 to 1, and a
**drive** that soft-clips the input for the growl of the analogue original.
Each voice is routed to one filter or past both.

### 2.4 Output stage

Voices are mixed, filtered voices through their filter, then panned into
stereo. An **echo** (one stereo delay with feedback, its time set in
milliseconds or in beats of the song playing) takes each voice's send. A
**master volume**, then a gentle soft clip so that eight voices at full
volume do not hard-clip.

The **character** setting picks how much grit survives:

| Character | Oscillators | Output | For |
| --- | --- | --- | --- |
| `clean` | Band-limited (polyBLEP on saw and pulse) | Full resolution | A polished modern chiptune |
| `classic` (default) | Band-limited | Each voice's oscillator quantised to 12 bits, a little filter drive | The 1980s sound, without the harsh aliasing of high notes |
| `raw` | Naive, aliasing | Quantised to 8 bits | Deliberately crunchy |

### 2.5 What it does not have

No sample playback, no reverb, no per-voice effects chain, no MIDI. Each is
a reasonable addition later; none is needed to sound like the era, and each
makes the chip less of a chip.

### 2.6 Instruments: the chip's driver

The SID was played by a small routine, run once a frame, that rewrote the
registers: stepped through arpeggio and waveform tables, swept the pulse
width, wobbled the pitch for vibrato, slid the filter cutoff. That routine is
where most of what people remember as "the SID sound" came from. This chip
builds it in, so the person writing a game does not write one.

An **instrument** is a set of voice settings plus the things that move:

- **Envelope** (ADSR) and **waveform**, **pulse width**, **filter** and
  **echo**, as starting settings.
- **Pulse sweep**: the width moves towards a target and back, at a rate.
- **Vibrato**: depth in semitones, rate in hertz, and a delay before it
  starts, so held notes bloom.
- **Arpeggio**: semitone offsets cycled one per step (`[0, 4, 7]` is a major
  chord).
- **Filter sweep**: the cutoff moves from a start to an end over a time.
- **Steps**: a table, one row per step, that sets waveform, relative pitch,
  volume and pulse width as it goes. This is how drums are made: a kick is
  one step of noise, then triangle falling an octave.

Instruments step at 60 Hz by default (`stepMs`, per instrument), from the
moment the note starts. They run inside the worklet, so their timing is exact
whatever the display's refresh rate, and playing a note sends one message, not
sixty.

---

## 3. Time: The Chip's Clock Is the Ticks

### 3.1 The problem

Audio has a clock of its own: the sound card pulls samples at 48,000 a
second whether or not the game is ticking. MVT's rule is that time reaches
everything through `update(deltaMs)`. The obvious ways of using Web Audio
break that rule in visible ways:

- Scheduling notes against `AudioContext.currentTime` is wall-clock time. A
  paused game plays on; a hitch in the frame rate does not delay the music;
  a test cannot step it.
- Writing to the chip whenever a view refreshes ties notes to frame times,
  which jitter by a few milliseconds and arrive at the worklet in 128-sample
  blocks. Hi-hats that should be even come out uneven, and on a 144 Hz
  display everything shifts.

### 3.2 The idea

On the C64, the music routine ran once a frame and wrote the chip's
registers; the chip sang continuously between writes. That is MVT's shape
already: a tick produces writes, and a device turns them into output, as
Pixi turns a refreshed stage into pixels.

So the chip has a **clock of its own**, in milliseconds, which only the host
advances: once a tick, by the same `deltaMs` it gives the models. Every write
to the chip is **stamped** with a chip time: by default the clock's value
when the write was made, or a later time inside the current tick, given by
whoever wrote it (the music player stamps each note at its exact time,
section 6.1). The worklet's rule is simple: **it plays chip time, and never
plays past the latest time it has been given.**

### 3.3 A steady distance behind

The worklet runs a short, steady distance (the **lead**) behind the newest
time it has been given, and plays each stamped write at its exact sample.
Ticks arrive unevenly; the lead absorbs that, as a jitter buffer does in a
voice call.

```
chip time (ms)        0      16.7    33.3    50.0    66.7
ticks (host)          |-------|-------|-------|-------|      writes stamped in chip time
                                 \
worklet plays            <- lead ->\
                      ...............[playing here]          never past the newest tick
```

- **Starting.** When the first tick arrives, the worklet waits until it has
  a full lead of chip time before it starts, then plays.
- **Drift.** The display's clock and the sound card's are different
  crystals, and the host clamps long frames, so the two drift apart. When
  the lead strays from its target, the worklet plays chip time up to 0.5%
  faster or slower to bring it back. This changes when writes take effect
  by fractions of a millisecond, never the pitch: oscillators always run at
  the output rate, and only the mapping from chip time to samples bends.
- **Far behind.** If the lead grows beyond a limit (a burst of ticks after a
  long frame), the worklet jumps forward, applying the skipped writes
  instantly and in order, so its state is right even if a few notes are
  lost.
- **Run dry.** If it reaches the newest time it has been given, it stops: it
  fades its output to silence over a few milliseconds and holds every voice
  exactly where it is. When ticks resume it waits for a full lead and fades
  back in.

The target lead is a guess until the spike measures it: two frames, about
35 ms, is the starting point, perhaps adapting to the spread of gaps between
ticks it sees. Added to the output latency of the browser and device
(5-40 ms), music sounds 40-75 ms after the tick that wrote it, at a perfectly
steady rate.

### 3.4 Pause, hidden tabs, hitches, fast-forward

Because the chip plays nothing it has not been given, most of the hard
cases need no code:

| Case | What happens | Code needed |
| --- | --- | --- |
| The Arcade pauses the entry | The host stops advancing the chip, as it stops updating the models. The worklet runs dry, fades out, and holds every note. Resume, and the tune carries on from the same sample | None in the entry; one line in the host |
| The tab is hidden | `requestAnimationFrame` stops, so ticks stop, so the chip runs dry | None |
| A long frame | Up to the lead, nothing audible. Beyond it, a short silence, then the chip carries on | None |
| A fast-forward or a thumbnail | The audio views run against the silent chip | None |
| The entry ends | The host resets the chip: every voice cut with a short fade, the queue emptied | One line in the host |

### 3.5 Sound effects skip the queue

A tune needs steady timing and does not mind 40 ms of latency, since nothing
on screen is waiting for it. A shot is the other way round: it has no rhythm
to keep, and every millisecond between pressing fire and hearing it counts.
So effects are not stamped: they play **as soon as they arrive**, at the start
of the worklet's next block, and the lead does not apply to them. Their
jitter (up to a block, under 3 ms, plus the frame's) is inaudible on a
one-shot. Everything else, notes and voice settings, is stamped.

An effect that arrives while the chip has run dry (a pause) waits for it to
resume. Effects are started from refresh steps, which only follow changes in
the model, which does not change while paused, so this case does not arise in
practice.

### 3.6 Sound is triggered by changes, not drawn from state

A Pixi view's refresh is idempotent: refresh it twice and the picture is the
same. A sound cannot be re-drawn; it is started once, at a moment. Audio views
square this by only starting sounds on a **change**, found with `watch`, and by
draining what they have queued. A second refresh in the same tick finds no
change and nothing queued, and plays nothing. So refresh stays idempotent in
effect, and the rest of the view rules hold unchanged: update advances
presentation state, refresh writes output.

What would break that is a refresh that started a sound from state alone
(`if (isExploding) play(BOOM)`), which would play every frame. The docs page
(section 12) says so.

---

## 4. Where the Code Lives

### 4.1 A new private package, `@mvtjs/sound`

The chip has nothing to do with any one renderer, is used by every entry, has
a test suite of its own, and may be worth publishing one day. A package
beside `@mvtjs/utils` fits all four; `packages/website/src/shared/` fits only
the second. It starts private, as `@mvtjs/eslint-plugin` did.

```
packages/sound/
├── src/
│   ├── core/            The synthesis, in plain TypeScript: no Web Audio, runs in Node
│   │   ├── chip-core.ts         Voices, filters, echo, output stage; render(left, right, frames)
│   │   ├── instrument-engine.ts The 60 Hz driver: arpeggio, vibrato, sweeps, step tables
│   │   ├── voice-allocator.ts   Which voice an effect gets (section 6.2)
│   │   ├── commands.ts          The numeric command encoding shared with the main thread
│   │   └── notes.ts             Note names to pitches
│   ├── worklet/
│   │   ├── chip-processor.ts    The AudioWorkletProcessor: a thin shell around the core
│   │   └── chip-clock.ts        Chip time to samples: the lead, drift, running dry (section 3.3)
│   ├── chip/
│   │   ├── sound-chip.ts        createSoundChip: the main thread's handle, and its host side
│   │   ├── silent-chip.ts       createSilentChip
│   │   └── recording-chip.ts    createRecordingChip, for tests
│   ├── notation/        The tracker notation: parse instruments' steps, effects and songs (section 5)
│   ├── players/         The music player (section 6.1)
│   ├── offline/         renderOffline: commands in, samples out, in Node; WAV encoding
│   └── index.ts
├── scripts/render-wav.ts  Renders an entry's effects and songs to WAV files, for listening
└── package.json
```

The `chip-clock.ts` logic is a pure function of the ticks it is given and the
samples played, so it is tested in Node with simulated, jittery tick arrivals
and drifting clocks.

### 4.2 The core

The core is a closure-based record, like everything else here, holding typed
arrays for voice state: `createChipCore({ sampleRate })` with
`apply(command)` and `render(left, right, frames)`. It is the hot path of the
whole design (48,000 samples a second, eight voices), so it follows the hot
path rules strictly: no allocation after construction, index loops, no
closures per sample, state in `Float64Array`s. It never reads a clock: it is a
pure function of the commands applied and the samples rendered, so the same
commands always render the same samples. That is what makes golden tests and
offline rendering possible.

### 4.3 From the main thread to the worklet

A write on the main thread appends a few numbers to a preallocated
`Float64Array` (opcode, voice, value, stamp), with no allocation. Once a tick,
after the views have refreshed, the host **flushes**: one `postMessage` with
the batch and the newest chip time, the buffer transferred and a spare taken
back, so batches allocate nothing in the steady state. Instruments and
effects are sent to the worklet the first time they are played, keyed by
identity, and referred to by number after that.

The worklet API requires a class (`registerProcessor` takes one, and
`process` is a method). `chip-processor.ts` is the one class in the repo: a
few lines, with `eslint-disable` comments for `@mvtjs/no-this` and the
class rule saying why, delegating at once to the closure-based core.

Loading the worklet with Vite needs the processor bundled as its own module
(`?worker&url` is the likely route). The spike confirms it in the dev server
and the build.

### 4.4 The API

What an entry sees:

```ts
export interface SoundChip {
    /** The chip's clock, in ms: the sum of the deltas the host has advanced it by. */
    readonly time: number;
    /** Voices on the chip: 8. */
    readonly voiceCount: number;
    /**
     * Plays a sound effect now, on a voice the chip chooses (section 6.2), panned
     * from -1 (left) to 1 (right). Not stamped: effects play as soon as they arrive.
     */
    play: (effect: SoundEffect, pan?: number) => void;
    /** Starts `note` (a MIDI note number) on `voice` with `instrument`, at chip time `atMs` (default: now). */
    noteOn: (voice: number, instrument: Instrument, note: number, volume: number, atMs?: number) => void;
    /** Releases `voice`'s note at `atMs` (default: now). */
    noteOff: (voice: number, atMs?: number) => void;
    /** Sets one of a voice's settings directly, at `atMs` (default: now). */
    setVoice: (voice: number, setting: VoiceSetting, value: number, atMs?: number) => void;
    setFilter: (filter: FilterId, setting: FilterSetting, value: number, atMs?: number) => void;
    setEcho: (setting: EchoSetting, value: number, atMs?: number) => void;
    /** Releases every voice, music and effects. */
    releaseAll: () => void;
}

export type VoiceSetting = 'pitch' | 'pulseWidth' | 'volume' | 'pan' | 'echoSend' | ...;
export type FilterId = 'a' | 'b';
```

The methods take their arguments in order, not as an options object, because
they are called from refresh steps and must not allocate. They are few and
numeric, and the docs page says which is which.

What the host sees adds the clock and the output:

```ts
export interface SoundChipHost extends SoundChip {
    /** Advances the chip's clock: once a tick, with the models' delta, never while paused. */
    advance: (deltaMs: number) => void;
    /** Sends this tick's writes to the worklet. Once a tick, after the views have refreshed. */
    flush: () => void;
    /** Silences everything and forgets the session's instruments, between sessions. */
    reset: () => void;
    volume: number;
    isMuted: boolean;
    destroy: () => void;
}

export function createSoundChip(options: SoundChipOptions): Promise<SoundChipHost>;
export function createSilentChip(): SoundChip;
export function createRecordingChip(): RecordingChip;
```

### 4.5 Silent and recording chips

`createSilentChip()` accepts every call and does nothing, quickly. Headless
starts use it, so no entry has a branch for "no sound".

`createRecordingChip()` keeps a log of every call (`{ kind: 'play', effect,
pan, time }` and so on) and has an `advance` of its own, so a test can tick
an audio view, then assert that firing played `SHOT` once, panned left.

---

## 5. Writing Sounds

Three kinds of thing, from most code-like to most data-like: instruments are
TypeScript objects; effects are an instrument and a note, or a step table;
songs are tracker patterns. The notation for step tables and patterns is one
notation, so it is learned once.

### 5.1 Instruments

```ts
/** The tune's lead: a quarter-width pulse that sweeps wider, with a late vibrato. */
export const LEAD = instrument({
    wave: 'pulse',
    pulseWidth: 0.25,
    pulseSweep: { to: 0.6, ms: 900, pingPong: true },
    envelope: { attackMs: 3, decayMs: 160, sustain: 0.55, releaseMs: 220 },
    vibrato: { semitones: 0.2, hz: 5.5, delayMs: 180 },
    echo: 0.25,
});

/** A resonant saw bass, the filter closing on each note. */
export const BASS = instrument({
    wave: 'saw',
    envelope: { attackMs: 1, decayMs: 220, sustain: 0.4, releaseMs: 60 },
    filter: 'a',
    filterSweep: { fromHz: 2400, toHz: 500, ms: 180 },
});

/** A kick: one step of noise, then triangle falling an octave. */
export const KICK = instrument({
    envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 0 },
    note: 'C-3',
    steps: [
        // wave     pitch
        'noise      +24',
        'triangle   +7',
        'triangle   +0',
        'triangle   -5',
        'triangle   -9',
        'triangle   -12',
    ],
});
```

`instrument(...)` checks its options and parses its steps when the module
loads, and returns a frozen `Instrument`. `note` is the note the instrument
plays when a pattern names it without one, as drums are.

### 5.2 Sound effects

Most effects are an instrument and a note, with an optional glide:

```ts
/** A raider peeling off to dive: a whistle that falls two octaves. */
export const DIVE = effect({
    instrument: WHISTLE,
    note: 'C-6',
    glideTo: 'C-4',
    lengthMs: 700,
    priority: 1,
    maxVoices: 2,
});
```

The rest are a step table, which reads like the texture scripts' pixel art:
one row a step (1/60 s by default), top to bottom, the shape of the sound
visible in the columns.

```ts
/** The ship's shot: a pulse zap that drops an octave and narrows in a tenth of a second. */
export const SHOT = effect({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 30 },
    priority: 0,
    steps: [
        // wave    note   vol  width
        'pulse     C-7    vF   p4',
        'pulse     G-6    vE   p5',
        'pulse     D-6    vD   p6',
        'pulse     A-5    vB   p7',
        'pulse     E-5    v9   p8',
        'pulse     B-4    v6   p8',
        'pulse     F#4    v3   p8',
    ],
});

/** A raider destroyed: a burst of noise falling in pitch, under a triangle thump. */
export const RAIDER_HIT = effect({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    priority: 2,
    maxVoices: 3,
    steps: [
        'triangle  C-4    vF',
        'noise     C-6    vF',
        'noise     A-5    vE',
        'noise     F-5    vC',
        'noise     D-5    vA',
        'noise     A#4    v8',
        'noise     G-4    v6',
        'noise     D-4    v4',
        'noise     A#3    v2',
    ],
});
```

`priority` and `maxVoices` are for the voice allocator (section 6.2).

### 5.3 The tracker notation

A pattern is an array of strings, one per row, top to bottom. Each row has
one cell per channel, separated by `|`. A cell is zero or more tokens
separated by spaces; blank space is free, so columns can be lined up by eye.

| Token | Meaning | Example |
| --- | --- | --- |
| Note | Starts a note: letter, `-` or `#`, octave | `C-4`, `F#5` |
| `...` or nothing | No change: the note playing carries on | |
| `===` | Releases the note: its envelope enters release | |
| One letter | The instrument, from the song's `instruments` table. Alone, it plays the instrument's own `note` (drums) | `L`, `k` |
| `v` + hex digit | Volume, `0` to `F` | `v9` |
| `a` + two hex digits | Arpeggio: the note, then up x semitones, then up y, one per step | `a37` (minor), `a47` (major) |
| `~` | Vibrato, the instrument's own, or `~` + two hex digits for depth and rate | `~`, `~46` |
| `>` | Glide to this note from the last, over the row | `G-5 > ` |
| `/` or `\` + two hex digits | Slide the pitch up or down by that many semitones over the row | `/0C` |
| `p` + hex digit | Pulse width, in sixteenths | `p4` |
| `f` + hex digit | The channel's filter cutoff, `0` (closed) to `F` (open) | `f8` |

Instrument steps and effect step tables use the same tokens, plus a waveform
name and relative pitches (`+7`, `-12`), with one row a step and no `|`.

### 5.4 Songs

A song is patterns, an order to play them in, and a tempo:

```ts
/** Played as each stage starts: two bars, E minor to D major and home. */
export const STAGE_FANFARE = song({
    bpm: 150,
    rowsPerBeat: 4,
    instruments: { L: LEAD, C: CHORD, B: BASS, k: KICK, s: SNARE, h: HAT },
    filters: { a: { mode: 'lowpass', cutoffHz: 1200, resonance: 0.7, drive: 0.3 } },
    patterns: {
        fanfare: [
            // lead         chord          bass        drums
            'E-5 L v9     | E-4 C a37    | E-2 B     | k',
            '...          | ...          | ...       | h',
            '...          | ...          | E-3 B     | h',
            'B-4 L        | ...          | ...       | h',
            'E-5 L        | ...          | E-2 B     | s',
            'G-5 L        | ...          | ...       | h',
            '...          | ...          | E-3 B     | k',
            'F#5 L        | ...          | ...       | h',
            'E-5 L        | C-4 C a47    | C-2 B     | k',
            '...          | ...          | ...       | h',
            'D-5 L        | ...          | C-3 B     | h',
            '...          | ...          | ...       | h',
            'E-5 L ~      | D-4 C a47    | D-2 B     | s',
            '...          | ...          | ...       | h',
            '===          | ...          | D-3 B     | s',
            '...          | ===          | ===       | s',
            // ...the second bar
        ],
    },
    order: ['fanfare'],
});
```

- **Order and loop.** `order` lists patterns by name. `loop` is the index in
  `order` to go back to at the end; without it the song plays once. A
  pattern name may carry a transposition, `'verse+5'`, so a chord
  progression reuses one pattern, as the C64 players did to save memory.
- **Tempo.** `bpm` and `rowsPerBeat`. A row is a time, not a number of frames,
  so the tempo is the same on every display. `swing` (0 to 0.5) delays every
  second row.
- **Channels.** A song's channel count is its number of cells per row. The
  music player gives channel *n* voice *n*.
- **Filters and echo.** A song may set the filters and the echo as it
  starts; effects leave filter `a` to the music and use filter `b`.

### 5.5 Parsing

`song(...)`, `effect(...)` and `instrument(...)` parse their strings once, when
the module loads, into compact arrays of numbers that the players read with
index loops. A mistake throws with its place:

```
STAGE_FANFARE, pattern 'fanfare', row 12, channel 2 (chord): unknown instrument 'Q'
```

Every entry with sound has one test that imports its sound data, so a typo
fails `npm test`, not the game.

### 5.6 Writing a tune for this chip

The docs page (section 12) carries the craft, briefly: four channels is a
full arrangement (lead, chords as arpeggios, bass, drums on noise); leave
voices for effects; put drums on one channel by alternating instruments; use
`a37`/`a47` for chords; keep the echo send low on bass. A short example tune
in the docs, rendered to a file you can play, is worth more than a page of
advice.

---

## 6. Playing Sounds from Views

### 6.1 The music player

`createMusicPlayer({ chip })` plays one song at a time on voices 0 to *n* - 1.

```ts
export interface MusicPlayer {
    readonly song: Song | undefined;
    readonly isPlaying: boolean;
    /** Where the song is, in beats from its start: for views that move in time with it. */
    readonly beat: number;
    /** A multiplier on the song's tempo. Set in the view's update step from the game's state, if it changes with it. */
    tempoScale: number;
    /** Starts `song` from its beginning, stopping any song playing. */
    play: (song: Song) => void;
    /** Plays `song` when the one playing ends, without a gap. */
    queue: (song: Song) => void;
    /** Releases the song's notes, and stops. */
    stop: () => void;
    /** Advances the song, queueing the notes that fall in the next `deltaMs`. Call from the view's update step. */
    update: (deltaMs: number) => void;
    /** Writes the queued notes to the chip. Call from the view's refresh step. */
    refresh: () => void;
}
```

The song's position is **presentation state** of the audio view that owns the
player, advanced by its update step. That placement does a lot:

- **Pause** needs nothing: the host leaves the entry out of `updateView`, the
  position stops, and the chip runs dry (section 3.4).
- **Exact timing**: `update(deltaMs)` knows the window of chip time the tick
  covers, and stamps each note at its exact time inside it, so notes land on
  their samples whatever the frame rate.
- **Following the game**: which tune plays, and how fast, is read from
  bindings like anything else (section 6.4).
- **Readable**: `beat` lets another view pulse the starfield in time.

Why not in the worklet, uploaded whole? Then the position is invisible to the
views, pausing it needs its own message, and the tick no longer drives it.
See section 13.

The player stamps notes, and its update step only queues them; the view's
refresh writes them. This keeps the rule that update advances presentation
state and refresh writes output.

### 6.2 Sound effects, and which voice they get

`sound.play(effect, pan)` hands the choice of voice to the chip, in the
worklet, because only the worklet knows which voices have finished their
release. The rule:

1. Effects may use the voices the music is not using: voices from the
   song's channel count up to 7. With a four-channel song, that is four;
   with none playing, all eight.
2. A free voice, if there is one.
3. Otherwise, the voice of the oldest effect of lower or equal priority.
   If there is none, the new effect is dropped.
4. An effect at its `maxVoices` restarts its own oldest voice instead.

So any view can play effects without coordinating with any other, and a burst
of explosions cannot take the shot's voice away unless it outranks it.

Whether effects may also borrow a music voice, as C64 games did (the tune
loses its lead for the length of an explosion, which is part of the period
sound), is open question 5.

### 6.3 Audio views

An audio view is a view: a function of bindings, returning a node of the
renderer it sits in, with an update step if it holds presentation state and a
refresh step that writes output. For a Pixi entry it returns an empty
`Container`, so it can sit in the JSX tree beside the views it sounds for,
and is updated, refreshed and paused with them by the host's `updateView` and
`refreshView`. Nothing in `@mvtjs/sound` depends on a renderer; the
node an audio view returns is the entry's choice, a few lines.

Its output is the chip, which the view does not create but is handed, as a
binding read once: `sound: SoundChip`. That is a stretch of "binding" (it is
neither a query nor a relay); open question 4 asks whether it deserves a
name of its own.

### 6.4 Finding the moment: states, transitions and counts

The docs' tables put "named events" in models, for sounds to hang off. Audio
views make that unnecessary, and keep models plain. What a view needs is a
**change it can see by polling**, and there are two kinds:

- **A state that changes, and stays changed for at least a tick.** The game's
  phase, an enemy's `isAlive`, a ship's `isAlive`. The view watches it and
  plays on the transition it cares about (`true` to `false`), which is
  exactly the [consumer-defined events](../../packages/docs/building-with-mvt/reacting-to-changes/change-detection.md#change-detection-as-consumer-defined-events)
  the docs already describe.
- **An event that leaves no lasting state.** A shot: the bullet's slot may be
  reused before the next refresh, or several shots may happen in one tick
  when a model steps more than once per frame (Neon Monsoon's fixed step
  does). For these, the model keeps a **count** (`shotsFired`): a plain
  number, true domain state (a results screen could show it), which only
  rises during a game. The view plays when it rises, once per unit if it
  wants.

Two details the docs page spells out:

- **The first poll.** `watch` reports every value as changed on its first
  poll, with `previous` undefined. For a phase, that is useful (the game
  starts: play the fanfare). For a count, it is not: going from undefined to
  0 is not a shot. Test for a rise, `previous !== undefined && value > previous`.
- **Resets.** When a game restarts, counts go back to 0. A fall is not an
  event; the rule above ignores it.

Music follows state the same way, continuously rather than on changes: the
view's update step sets `music.tempoScale` from a binding before advancing the
song, so the tune
quickens as the last raiders are left, and slows again on the next stage.

---

## 7. The Host and the Arcade

### 7.1 One chip, owned by the host

Browsers allow few audio contexts, and need a user's gesture to start one; a
mute setting belongs to the site, not an entry. So the entry host owns one
chip, made the first time an entry is launched, and gives it to each session.

- `PixiStartOptions` and `ElementStartOptions` gain a required `sound:
  SoundChip`. Required, not optional, so no entry carries a fallback; headless
  callers (the snapshot script, the benchmarks) pass `createSilentChip()`.
- In the host's tick, the chip's clock advances in the same branch as the
  models: `if (!isPaused) { session.update(deltaMs); sound.advance(deltaMs); }`.
  For Pixi entries that is inside the stage's ticker callback, before
  `updateView`. After `refreshView`, before rendering, `sound.flush()`.
- `start` and `stop` reset the chip, so one entry's sounds never leak into
  the next, and no entry has to clean up after itself.

### 7.2 Starting audio, and loading it

The `AudioContext` is created and resumed in the handler of the gesture that
launches an entry (a click or a key in the Arcade), which every browser
accepts. An entry opened straight from a link starts its audio on the first
key or touch.

`@mvtjs/sound` and its worklet load the first time an entry is launched, as
Pixi does, so the home page's size budget (036) is untouched. Where the
worklet cannot load (an insecure origin, such as the dev server reached
over the network by IP from a phone, since `AudioWorklet` needs a secure
context), the host falls back to the silent chip and the entry plays
silently.

### 7.3 Mute and volume

A mute toggle in the Arcade's navigation and its pause menu, with `M` as a
key, remembered in `localStorage` (a per-viewer convenience, wrapped in
`try`). One volume, for now. Previews in attract mode are always silent: a
host made with `takesInput: false` gets the silent chip.

---

## 8. The Demonstration: Galaxy Raiders

### 8.1 Why this game

Galaxy Raiders has the richest set of moments of any game in the Arcade
(shots, dives, kills of three kinds, the ship's loss, stage clear, game over),
positions across the screen for panning, and a phase that drives music
naturally. Shooters of its kind are also where chip sound is most
remembered. Crumb Chase was the other candidate; it has fewer moments (crumbs
eaten, caught, won).

### 8.2 The sounds

| Cue | Heard when (the binding watched) | Sound |
| --- | --- | --- |
| Stage fanfare | `phase` becomes `'playing'` from nothing, `'stage-clear'` or `'game-over'` | Two bars, four channels; then the stage tune is queued |
| Stage tune | After the fanfare | Sixteen bars, four channels, looping; `tempoScale` 1.15 while five or fewer raiders are left |
| Shot | `shotsFired` rises | `SHOT`, panned to the ship |
| Dive | An enemy's `phase` becomes `'diving'` | `DIVE`, a falling whistle, panned to the enemy |
| Raider destroyed | An enemy's `isAlive` becomes false | `RAIDER_HIT`, its pitch by `kind` (carriers deepest), panned to the enemy |
| Ship destroyed | `phase` becomes `'dying'` | A long noise explosion; the music stops |
| Respawn | `phase` becomes `'playing'` from `'dying'` | A rising four-note chirp; the stage tune starts again |
| Stage clear | `phase` becomes `'stage-clear'` | A one-bar jingle |
| Game over | `phase` becomes `'game-over'` | Four slow bars in a minor key, then silence |

Enemy shots stay silent, as the genre's usually were: with a dozen in the air,
they would bury everything else.

Voices: the songs use four channels (0-3), leaving four for effects.

### 8.3 The model change

One counter: `shotsFired`, incremented where a player bullet is fired, reset
with the game. Every other cue is a state the model already has.

### 8.4 The views

`GameView` takes `{ model, sound }` and places two audio views among the
others: one for the game, and one inside the enemies' `<List>`, so each
enemy's sounds come from where it is.

```ts
// --- Bindings ---

export interface GameAudioViewBindings {
    /** The chip to play on: the view's output, read once. */
    readonly sound: SoundChip;
    readonly phase: () => GamePhase;
    readonly shotsFired: () => number;
    readonly shipX: () => number;
    readonly enemiesLeft: () => number;
}

// --- View ---

/** The game's music, and the sounds that are not any one enemy's. Draws nothing. */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const music = createMusicPlayer({ chip: sound });
    const watcher = watch({ phase: bindings.phase, shots: bindings.shotsFired });

    setUpdate(view, (deltaMs) => {
        music.tempoScale = bindings.enemiesLeft() <= HURRY_ENEMIES ? HURRY_TEMPO : 1;
        music.update(deltaMs);
    });
    setRefresh(view, () => {
        const w = watcher.poll();
        if (w.phase.changed) playPhase(w.phase.value, w.phase.previous);
        if (w.shots.previous !== undefined && w.shots.value > w.shots.previous) {
            sound.play(SHOT, panAt(bindings.shipX()));
        }
        music.refresh();
    });
    return view;

    function playPhase(phase: GamePhase, previous: GamePhase | undefined): void {
        if (phase === 'playing' && previous === 'dying') {
            sound.play(RESPAWN);
            music.play(STAGE_TUNE);
        }
        else if (phase === 'playing') {
            music.play(STAGE_FANFARE);
            music.queue(STAGE_TUNE);
        }
        else if (phase === 'dying') {
            music.stop();
            sound.play(SHIP_HIT);
        }
        else if (phase === 'stage-clear') music.play(STAGE_CLEAR);
        else music.play(GAME_OVER);
    }
}

// --- Internals ---

/** The arena's width, in its units, mapped to a pan that never goes hard to one side. */
function panAt(x: number): number {
    return (x / ARENA_WIDTH * 2 - 1) * MAX_PAN;
}
```

`EnemyAudioView` is the same shape, smaller: it watches `isAlive` and
`phase`, and plays `RAIDER_HIT` (by `kind`) or `DIVE`, panned to the enemy's
`x`. Its `<List>` slot is reused when a stage brings new enemies: the slot's
`isAlive` goes from false to true, which is not a transition it plays on, so a
new stage makes no false explosions. A new slot's first poll has `previous`
undefined, which it ignores in the same way.

The sound data lives in `galaxy-raiders/data/`: `sounds.ts` (instruments and
effects) and `music.ts` (the four songs), with `sounds.test.ts` importing
both so the notation is checked.

### 8.5 The music

Four original pieces, written for this game and this chip: the fanfare (two
bars), the stage tune (sixteen bars, lead, arpeggio chords, filtered bass,
noise drums, at 150 BPM in E minor), the stage-clear jingle (one bar) and the
game-over tune (four bars). None quotes or paraphrases any game's music.

---

## 9. Originality

The [originality rules](../../packages/website/src/entries/README.md#originality) cover
music as they cover art, and this proposal follows them:

- Every tune, effect and instrument is written in the repo. No melody, bass
  line or drum pattern from any game, and no rips of SID tunes or of any
  other chip's music. "In the style of" is fine; "sounds like the start of
  that game" is not.
- The chip borrows the SID's ideas, which are general (waveforms, envelopes,
  filters), and none of its specifics: no register map, no 6581 or 8580
  filter curves, no MOS or Commodore names. It is not an emulator, and uses no
  emulator's code (reSID is GPL, which would not fit this repo either).
- The tracker notation is our own: a simplification of the conventions every
  tracker shares (note names, hex volumes, `===`), not a copy of any one
  program's format.

---

## 10. Testing

### 10.1 The core, in Node

- **Pitch**: each waveform at a range of notes, frequency measured by
  counting zero crossings, within a cent.
- **Pulse width**: the duty cycle measured from the samples.
- **Envelopes**: attack peaks at its time; decay reaches sustain; release
  reaches silence; a note-off during attack releases from where it is.
- **Sync and ring**: a synced voice's phase resets at its source's wrap; a
  ringed triangle flips sign with its source.
- **Noise**: the same seed gives the same samples; higher pitch, faster
  changes.
- **Filters**: a sine below the cutoff passes; one two octaves above is cut
  by roughly the slope; resonance peaks at the cutoff.
- **Safety**: no `NaN`, no values beyond full scale after the soft clip, no
  denormals with every voice silent.
- **Determinism**: the same commands render the same samples, compared by
  hash.

### 10.2 The notation

Every token parses to what section 5.3 says; every error names its place;
patterns with uneven channel counts, unknown instruments and bad notes are
rejected. Expected values come from the constants, not copied literals.

### 10.3 The players and the allocator

- **Frame-rate independence**: one song advanced by ticks of 16.7 ms, of 6.9
  ms (144 Hz) and of random lengths stamps every note at the same chip time.
- **Pause**: no update, no notes; then resume, and the stamps carry on
  without a gap.
- **Order, loop, transposition, `queue`** and `tempoScale`.
- **Allocation**: free voices first, then priority, then age; `maxVoices`;
  music voices never taken.

### 10.4 Audio views, against a recording chip

Galaxy Raiders' audio views ticked against `createRecordingChip()` with a
model driven through its inputs: firing plays one `SHOT`; two shots in one
tick play two; killing a raider plays `RAIDER_HIT` panned to its side;
restarting after game over plays the fanfare and no shot; a new stage plays no
explosion; a refresh without an update (paused) advances no music.

### 10.5 Golden audio

Each effect and song of an entry rendered offline to samples, hashed, and the
hash committed. A change to the core or to the sound data that changes the
sound fails the test, and writes the new render as a WAV beside the old one,
for someone to listen to before accepting it. This is 042's visual snapshots,
for the ear, and much cheaper: rendering a song in Node takes milliseconds,
needs no browser, and is the same on every machine: the core is plain
arithmetic on doubles, and the tests run in Node, whose maths library gives
the same results on every OS.

`npm run sound:render -- galaxy-raiders` writes every effect and song to
WAV files, for the composer's ears, without starting the site.

### 10.6 The clock

`chip-clock.ts` fed ticks with jitter, drift both ways, a long gap and a
pause: the lead returns to its target, drift is corrected within its 0.5%
limit, a gap jumps forward with every write applied, and a pause runs dry and
recovers.

---

## 11. Performance

| Where | Cost, estimated | Budget |
| --- | --- | --- |
| Worklet, eight voices playing, both filters, echo | 0.05-0.15 ms per 128-sample block | Under 5% of a block (2.7 ms at 48 kHz) |
| Main thread, per tick | A few `watch` polls and a handful of numbers written | Under 5 µs per audio view |
| Main thread, per flush | One `postMessage` of a small buffer | Under 20 µs |
| First launch | Loading the package and the worklet module | Under 30 KB, compressed |

To measure:

- A Node benchmark of the core (`packages/benchmarks/`), µs per block with
  one, four and eight voices, every waveform and both filters.
- Galaxy Raiders' existing benchmark, before and after, with its audio views
  on the silent chip: the main-thread cost of sound.
- In the spike, in Chrome, Firefox and Safari (desktop and iOS): the worklet's
  time per block, the gaps between ticks the clock sees, and the lead that
  never runs dry in a minute of play.

---

## 12. Docs

- A new page, **Sound**, in *Presenting the World*: audio views, the chip
  handed to a view, triggering on changes (states and counts, the first
  poll), music as presentation state, writing instruments, effects and tunes,
  and the rule that a refresh never starts a sound from state alone.
- The model and view tables in [architecture/models.md](../../packages/docs/architecture/models.md),
  [simulating-the-world/models.md](../../packages/docs/building-with-mvt/simulating-the-world/models.md)
  and [architecture/views.md](../../packages/docs/architecture/views.md): "named events"
  becomes the states and counts a view can watch.
- [Why Polling](../../packages/docs/building-with-mvt/reacting-to-changes/why-polling.md#hybrid-approaches)'s
  audio example becomes the polling one, with events kept as an option, not
  the recommendation.
- [Change Detection](../../packages/docs/building-with-mvt/reacting-to-changes/change-detection.md):
  counts, beside states, as consumer-defined events.
- `@mvtjs/sound`'s own README: the chip, the API, the notation in full.
- `AGENTS.md` and `llms.txt`: the package in the structure, and a line on
  audio views.

---

## 13. Ruled Out

Do not reopen without new information.

- **Web Audio's own nodes, one graph per note** (`OscillatorNode`,
  `BiquadFilterNode`, envelopes as `AudioParam` ramps). No hard sync, no
  combined waveforms, no pitched shift-register noise, and an allocation per
  note on the main thread. Timing against `currentTime` is wall-clock time,
  so pause needs its own plumbing. It would not sound like the era.
- **A library** (Tone.js and the like). Its transport runs on wall-clock time,
  it is large next to the home page's budget, and its sound is not this one.
- **The sequencer in the worklet**, with whole songs uploaded. The position
  would be invisible to views, would not follow `updateView`, and changing the
  tempo or the tune from game state would be a message protocol. The cost of
  the main-thread player is a handful of stamped notes a tick.
- **Writes applied when they arrive, unstamped, for music.** Frame jitter
  and 128-sample blocks make even rhythms uneven, and timing would follow the
  display's rate. Right for effects (section 3.5), wrong for music.
- **A frame-locked player** (one row step per tick, as on the C64). Ties
  tempo to the display, so a 144 Hz screen plays the tune 2.4 times as fast.
  The instruments' 60 Hz steps keep the sound of it without the coupling.
- **Events from the model** (`model.on('enemy-destroyed', ...)`). They would
  make models emit for the sake of a view, and they are unnecessary: every
  cue in section 8.2 is a state or a count.
- **A `SharedArrayBuffer` ring between the threads.** Needs cross-origin
  isolation headers the site's hosting may not allow, and `postMessage` once
  a tick is cheap enough.
- **Emulating the SID exactly.** Not the goal (section 2.1), and the
  emulators' code is GPL.
- **Sampled drums ("digis").** Against the chip's limits, and every sample
  would have to be made in the repo anyway.
- **MIDI files as the music format.** Binary, not reviewable in a diff, and
  with no place for the chip's effects.

---

## 14. Open Questions

1. **The chip's name.** The code calls it `SoundChip`, plainly. A name of
   its own, for the docs and an Arcade credit ("music on the ..."), would give
   it some personality. It must not echo a real chip's.
2. **Sound on or off by default?** Recommended: on, since audio starts only
   from a deliberate launch, with the mute toggle remembered. Attract-mode
   previews are silent either way.
3. **The lead.** 35 ms is a guess. Should it adapt to the spread of tick gaps
   it sees, or be fixed? The spike decides.
4. **`sound` as a binding.** The chip is an output, neither a query nor a
   relay. Keep it among the bindings, documented as "read once", or give
   views a second parameter for outputs? Recommended: a binding, because a
   second parameter would be the only one in the repo.
5. **Effects borrowing music voices**, as C64 games did, with the tune losing
   a channel for the length of an explosion. Authentic, and it frees voices.
   An option on the song (`yieldsToEffects: [2]`)?
6. **iOS's silent switch** mutes Web Audio unless the page asks for media
   playback (`navigator.audioSession`). Should the Arcade ask?
7. **Publishing `@mvtjs/sound`.** Its host side assumes this site's host. If
   it is published, that side becomes an example in the docs.
8. **A helper in `watch` for rises.** `previous !== undefined && value >
   previous` will be written in every audio view. Worth a helper, or a
   terminal in 008's builder?
9. **A Sound Test entry.** A demo in the Arcade, in the style of the sound
   test menus of 16-bit games: a jukebox of every entry's sounds and tunes,
   with a scope for each voice. It would show the chip off, and give
   composers a page with hot reload. After Galaxy Raiders, not before.
10. **Sounds in the Arcade itself**: a coin drop on launch, ticks as the
    search narrows. The Arcade's page loop would need a chip of its own, or
    a share of the host's.

---

## 15. Implementation Steps

1. **Spike.** A one-voice core, the worklet loaded through Vite in the dev
   server and the build, the clock of section 3.3, and the host advancing and
   flushing it. Measure the worklet's time per block, the gaps between ticks
   and the lead needed, on Chrome, Firefox and Safari, desktop and iOS. Play
   a scale through a pause and a hidden tab. Record the numbers here, and
   settle open question 3.
2. **The core.** All of section 2: voices, filters, echo, output stage,
   instruments. Tests of section 10.1; offline rendering and WAV encoding;
   the core benchmark.
3. **The package.** `packages/sound/`, its `package.json` and README, the
   main-thread chip, the silent and recording chips, the command encoding.
4. **The notation.** `instrument`, `effect`, `song`, the parser and its
   errors. Tests of section 10.2.
5. **The players.** The music player and the voice allocator. Tests of
   section 10.3.
6. **The host.** `sound` in the start options; the chip made on the first
   launch; advance, flush and reset in the host's tick; the silent chip for
   previews, the snapshot script and the benchmarks; the mute toggle.
7. **Galaxy Raiders.** `shotsFired`; the instruments, effects and four tunes;
   `GameAudioView` and `EnemyAudioView`; the tests of section 10.4; golden
   hashes; the benchmark before and after.
8. **Docs.** Section 12.
9. **Then**: the other games, one at a time; 035's music; open question 9's
   Sound Test.
