# Proposal: A Virtual Sound Chip, and Sound for the Arcade

> No entry in the Arcade makes a sound, although the docs say more than once
> that a view can target audio. This proposal designs the tool every entry
> will make its sound with: a small virtual sound chip in the spirit of the
> C64's SID (pulse, sawtooth, triangle and pitched noise, hard sync and ring
> modulation, ADSR envelopes, a resonant filter), brought up to date with
> eight voices, two filters, an echo, wavetables and instruments that
> run their own arpeggios and sweeps. Instruments are TypeScript objects;
> sound effects and music are written as string arrays, a tracker in the
> source, the way pixel art is drawn as string arrays now. The chip keeps to
> MVT: its clock is the ticks, so it pauses when the entry pauses and plays
> nothing it has not been told, and sound is played by **audio views**, which
> poll bindings with `watch` like any other view. Galaxy Raiders is the
> demonstration, with sound effects and music.

**Status:** implemented, from 2026-10-06 to 2026-10-09. Two things remain.
The first is a check in Safari, on the desktop and on iOS, after the merge
and deploy (step 11). Firefox passed on 2026-10-07. The second is a listening
pass by the owner, on the sound questions that the games' code reviews
raised on 2026-10-09 (step 13). The proposal stays open until both are done.

What was built:

- **`@mvtjs/audio`** is a private package with three import paths. The root
  holds the notation (`createInstrument`, `createSoundEffect`, `createSong`),
  the music player (`createMusicPlayer`) and the types. `@mvtjs/audio/web`
  holds the browser's chip, `createWebAudio80`, which runs in an
  `AudioWorklet`. `@mvtjs/audio/headless` holds `createHeadlessAudio80`, a
  chip with no speaker, and the tools that render, measure and save sound.
  The chip is named the **Audio80** (section 16.4), and it is mono.
- **The page's sound** is `PageSound`, in
  `packages/website/src/runner/page-sound.ts`. It owns one `AudioContext`,
  made inside the visitor's first gesture, with two chips on it. The entry
  host plays each session on the entry chip, and the Arcade plays its own
  sounds on the page chip.
- **`@mvtjs/utils`** gained `createMetronome`, and `watch` gained
  `increased` and `decreased`. Audio views use them for repeating sounds and
  for counts.
- **All nine games have sound**, not only Galaxy Raiders. They are
  Astrovoid, Burrow Bust, Crumb Chase, Dojo Duel, Fruit Machine, Fuel Run,
  Galaxy Raiders, Kwazy Cactii and Neon Monsoon. Each has `data/sounds.ts`,
  most have `data/music.ts`, and their audio views are in `views/`.
- **The Arcade has sounds of its own**, a speaker in the nav, and a music
  volume and an effects volume in the pause menu.
- **The docs** are the package's README, the headless README, two guides in
  `packages/audio/docs/`, and the MVT guide's
  [Sound and Music](../../packages/docs/building-with-mvt/presenting-the-world/sound.md)
  page.

What was measured, and where the build departs from the design below, is in
[section 16](#16-as-built-measured-and-changed). The design sections keep
their reasoning, with a "Built" note in place where the result differs. The
dated record is in [section 17](#17-progress-log).

It was playtested by ear on 2026-10-06, after one fix (section 16.1), and it
sounds right, and of its era. It has been tried in Chrome, on the desktop
and on Android (over `npm run dev:https`), and in Firefox. A second
playtest (section 16.5) tuned three games.

**Mono** (2026-10-08): at the owner's decision, the chip is mono, like the
SID and the NES, since a chip of the 1980s would not have had stereo or
panning. No pan per voice or per song channel, one echo delay, and one
channel out, which the browser plays on both speakers. A sound that was
centred comes out at the level it had, and loudness is measured as the mono
signal heard on two speakers, so every song measures what it did. The design
below, and section 16's account of what was built, are updated to match.

**Notation** (2026-10-09): at the owner's decision, slides are written
`u0C` and `d0C` (no more `/` and `\`). Each pattern and step table is one
multiline string in backticks, not an array of strings. In a pattern, each
row starts with `|`, and the columns are of equal width. A `#` at the
start of a line, or after a space, starts a comment that runs to the end of
the line. Blank lines are skipped. (The first form, earlier the same day,
used `//` for comment lines and no leading `|`.) The design below keeps the
old form.

**How it lands:** built and committed on the `sound-chip` worktree branch,
then handed to the main checkout in reviewable chunks. The code reached
`vnext` on 2026-10-09 (`4023035` to `e3fb5f2`). The docs and these notes are
the last chunk (step 12).

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
| 1 | What the chip is | Eight voices, each with SID-style waveforms (combined waveforms and pitched noise included), sync, ring modulation and ADSR, plus a 32-step wavetable. Two resonant multimode filters, an echo, and a mono output stage with a choice of grit | [2](#2-the-chip) |
| 2 | How high-level it is | Two layers inside the chip: voices you can set directly, and instruments that run arpeggios, vibrato, pulse and filter sweeps and step tables by themselves at 60 steps a second | [2.6](#26-instruments-the-chips-driver) |
| 3 | Where the sound is made | An `AudioWorklet`, around a core of plain TypeScript with no Web Audio in it, so the same code runs in Node for tests and for rendering WAV files | [4](#4-where-the-code-lives) |
| 4 | Where time comes from | The ticks. The host advances the chip's clock with the same `deltaMs` as the models; every write is stamped with chip time; the worklet plays a short, steady distance behind and never past what it has been told. Pause, hidden tabs and fast-forward need nothing extra | [3](#3-time-the-chips-clock-is-the-ticks) |
| 5 | Latency against steadiness | Music is played from its stamps, sample-accurately. Sound effects skip the queue and play as soon as they arrive, since a one-shot has no rhythm to keep | [3.5](#35-sound-effects-skip-the-queue) |
| 6 | Who decides what plays | **Audio views**: views like any other, whose refresh polls bindings with `watch` and plays on a change. Models gain no events. Where an event leaves no lasting state, the model keeps a count | [6](#6-playing-sounds-from-views) |
| 7 | Where the song position lives | In the audio view, as presentation state advanced by its update step. So music pauses with the entry, follows the game's state (tempo, which tune), and other views can read the beat | [6.1](#61-the-music-player) |
| 8 | How sounds are written | Instruments as TypeScript objects. Sound effects and songs as string arrays in a small tracker notation, with instruments named by single letters as pixel art names its colours. Parsed once, at load, with errors that give the row and channel. Built: each pattern and step table is one multiline string in backticks, with `\|` before each cell and `#` comments | [5](#5-writing-sounds) |
| 9 | Who owns the chip | The entry host: one chip for the site, given to each session in its start options (`sound`), reset between sessions. Headless starts (thumbnails, benchmarks, tests) get a silent chip. Built: the page's sound (`PageSound`) owns the audio context and two chips, one for entries and one for the page's own sounds. Headless starts get `createHeadlessAudio80()` | [7](#7-the-host-and-the-arcade) |
| 10 | Where the code lives | A new private workspace package, `@mvtjs/audio`, beside `@mvtjs/utils`. Built: it has three import paths, `@mvtjs/audio`, `/web` and `/headless` | [4.1](#41-a-new-private-package-mvtjsaudio) |
| 11 | The demonstration | Galaxy Raiders: eight sound effects, four original tunes, one counter added to its model, and two audio views. Built: all nine games have sound, and so does the Arcade | [8](#8-the-demonstration-galaxy-raiders) |
| 12 | How it is tested | The core in Node: pitch, timing, envelopes, determinism, and golden hashes of rendered audio. Audio views against a recording chip. Built: "golden tests" became **audio tests**, which keep each sound's hash in a Vitest snapshot | [10](#10-testing) |

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
  modern comforts (an echo, more voices) that do not sand that off.
- **Easy at a high level, open at a low one.** Play an effect in one call;
  write a tune as text; set a voice's pulse width directly when you need to.
- **Faithful to MVT.** Time comes only from ticks. Models know nothing of
  sound. Views decide what plays, from state they poll.
- **Testable without a browser.** The synthesis is plain TypeScript, and an
  audio view can be ticked against a chip that records what it was told.

**Done looks like:** Galaxy Raiders plays a fanfare as each stage starts, a
four-voice tune while the raiders fly (which speeds up as the last few are
left), and effects for shots, dives, explosions, the ship's loss, stage
clear and game over. The Arcade has a
mute control. Pausing the game pauses the tune mid-note, and resuming picks it
up where it stopped. The docs have a page on audio views, and the tables that
mention sound say what the repo does.

**Built:** all of that, and more. Every game in the Arcade has sound, the
Arcade has sounds of its own, and the mute control became a speaker in the
nav and a volume for music and one for effects in the pause menu.

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
| Output | Mono, 4-bit master volume | Mono, an **echo** with a send per voice, master volume, and a character setting (section 2.4) | Mono, as the era's chips were; the echo is the modern chiptune staple |
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
- **Volume**, **filter** (none, `a` or `b`) and **echo send** (0 to 1).

Oscillators are phase accumulators at the output rate. Whether they are band
limited is the output stage's choice (section 2.4).

### 2.3 Filters

Two state-variable filters, `a` and `b`, each with a **mode** (any
combination of low-pass, band-pass and high-pass; low and high together
make a notch), a **cutoff** in hertz, **resonance** from 0 to 1, and a
**drive** that soft-clips the input for the growl of the analogue original.
Each voice is routed to one filter or past both.

### 2.4 Output stage

Voices are mixed to mono, filtered voices through their filter. An **echo**
(one delay with feedback, its time set in
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

**Built:** a fixed lead of 35 ms, with no adapting. A caller can set another
with `createWebAudio80`'s `leadMs` option. It held up in simulation (section
16.1), and by ear in Chrome, on the desktop and on Android, and in Firefox.
Safari is still to try.

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

### 4.1 A new private package, `@mvtjs/audio`

The chip has nothing to do with any one renderer, is used by every entry, has
a test suite of its own, and may be worth publishing one day. A package
beside `@mvtjs/utils` fits all four; `packages/website/src/shared/` fits only
the second. It starts private, as `@mvtjs/eslint-plugin` did.

```
packages/audio/
├── src/
│   ├── core/            The synthesis, in plain TypeScript: no Web Audio, runs in Node
│   │   ├── chip-core.ts         Voices, filters, echo, output stage; render(output, frames)
│   │   ├── instrument-engine.ts The 60 Hz driver: arpeggio, vibrato, sweeps, step tables
│   │   ├── voice-allocator.ts   Which voice an effect gets (section 6.2)
│   │   ├── commands.ts          The numeric command encoding shared with the main thread
│   │   └── notes.ts             Note names to pitches
│   ├── worklet/
│   │   ├── chip-processor.ts    The AudioWorkletProcessor: a thin shell around the core
│   │   └── chip-clock.ts        Chip time to samples: the lead, drift, running dry (section 3.3)
│   ├── chip/
│   │   ├── sound-chip.ts        createAudio80: the main thread's handle, and its host side
│   │   ├── silent-chip.ts       createSilentAudio80
│   │   └── recording-chip.ts    createRecordingAudio80, for tests
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

**Built:** the package is laid out by import path, as below. The worklet's
code sits in `web/`, so that only `@mvtjs/audio/web` imports the worklet's
URL, which Node cannot load. The voice allocator is `choose-effect-voice.ts`
in `core/`, and the synthesis is `audio80-synthesiser.ts`. The music player
has a folder of its own, `music-player/`, since it is the only player.

```
packages/audio/
├── src/
│   ├── index.ts         @mvtjs/audio: the notation, the music player, the types
│   ├── core/            The synthesiser, the command encoding and queue, the voice allocator, notes
│   ├── notation/        createInstrument, createSoundEffect, createSong
│   ├── chip/            The Audio80 and AudioControls interfaces, and a chip that writes commands to a buffer
│   ├── music-player/    createMusicPlayer
│   ├── headless/        @mvtjs/audio/headless: createHeadlessAudio80, rendering, loudness, hashes, WAV
│   └── web/             @mvtjs/audio/web: createWebAudio80, the clock, the worklet's runner and processor
├── docs/                Two guides: using the Audio80, and writing tracker music
├── scripts/render-wav.ts  Renders a module's songs and effects to WAV files
└── package.json
```

### 4.2 The core

The core is a closure-based record, like everything else here, holding typed
arrays for voice state: `createAudio80Core({ sampleRate })` with
`apply(command)` and `render(output, frames)`. It is the hot path of the
whole design (48,000 samples a second, eight voices), so it follows the hot
path rules strictly: no allocation after construction, index loops, no
closures per sample, state in `Float64Array`s. It never reads a clock: it is a
pure function of the commands applied and the samples rendered, so the same
commands always render the same samples. That is what makes golden tests and
offline rendering possible.

**Built:** as designed, under another name. The core is the **synthesiser**,
made by `createAudio80Synthesiser` in `core/audio80-synthesiser.ts`. It is
internal to the package. Tests, tools and the benchmark render through the
headless chip instead.

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

**Built:** as designed. `?worker&url` works in the dev server and the build
(section 16.1). `chip-processor.ts` is the one class in the repo.

### 4.4 The API

What an entry sees:

```ts
export interface Audio80 {
    /** The chip's clock, in ms: the sum of the deltas the host has advanced it by. */
    readonly time: number;
    /** Voices on the chip: 8. */
    readonly voiceCount: number;
    /**
     * Plays a sound effect now, on a voice the chip chooses (section 6.2).
     * Not stamped: effects play as soon as they arrive.
     */
    play: (effect: SoundEffect) => void;
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

export type VoiceSetting = 'pitch' | 'pulseWidth' | 'volume' | 'echoSend' | ...;
export type FilterId = 'a' | 'b';
```

The methods take their arguments in order, not as an options object, because
they are called from refresh steps and must not allocate. They are few and
numeric, and the docs page says which is which.

What the host sees is another object, made beside the chip: its controls,
the clock and the output. They are not part of the chip, and the entry is
never given them (section 16.4):

```ts
export interface AudioControls {
    readonly ready: Promise<void>;
    /** Advances the chip's clock: once a tick, with the models' delta, never while paused. */
    advance: (deltaMs: number) => void;
    /** Sends this tick's writes to the worklet. Once a tick, after the views have refreshed. */
    flush: () => void;
    /** Silences everything and forgets the session's instruments, between sessions. */
    reset: () => void;
    volume: number;
    isMuted: boolean;
    musicVolume: number;
    effectsVolume: number;
    destroy: () => void;
}

export function createAudio80(options: Audio80Options): { audio80: Audio80; controls: AudioControls };
export function createSilentAudio80(): { audio80: Audio80; controls: AudioControls };
export function createRecordingAudio80(): { audio80: RecordingAudio80; controls: AudioControls };
```

**Built:** the API above, with these differences. `Audio80` gained
`reserveVoices(count, atMs?)`, with which the music player keeps its voices
from effects. `setVoice` and `setFilter` take names for waves and filter
modes (`'saw+pulse'`, `'lowpass'`) rather than numbers. The controls'
`advance` became `update(deltaMs)`, like every other step in the repo. The
factories are `createWebAudio80({ context })` in `@mvtjs/audio/web` and
`createHeadlessAudio80(options?)` in `@mvtjs/audio/headless`. Each returns
an `Audio80WithControls`, which is `{ audio80, controls }`. There is no
plain `createAudio80`, since the browser's chip is one implementation among
possible others.

### 4.5 Silent and recording chips

`createSilentAudio80()` accepts every call and does nothing, quickly. Headless
starts use it, so no entry has a branch for "no sound".

`createRecordingAudio80()` keeps a log of every call (`{ kind: 'play', effect,
time }` and so on), and its controls' `advance` moves its clock, so a test
can tick an audio view, then assert that firing played `SHOT` once.

**Built:** one headless chip in place of the silent and recording chips and
the offline renderer (2026-10-08). `createHeadlessAudio80()` is silent.
`createHeadlessAudio80({ record: true })` keeps a `log` of every write.
`createHeadlessAudio80({ render: true })` plays the writes in memory, for its
`render(output)` method to write into a buffer the caller passes in. A chip
can do both. Its type has `log` only with `record`, and `render` only with
`render`.

---

## 5. Writing Sounds

Three kinds of thing, from most code-like to most data-like: instruments are
TypeScript objects; effects are an instrument and a note, or a step table;
songs are tracker patterns. The notation for step tables and patterns is one
notation, so it is learned once.

**Built:** the examples in this section keep the planned form. The built
form differs in three ways. The factories are `createInstrument`,
`createSoundEffect` and `createSong`. Each step table and pattern is one
multiline string in backticks. And in a pattern, each cell starts with `|`,
with `#` for comments. The guide
[Writing Tracker Music](../../packages/audio/docs/writing-tracker-music.md)
has the notation as built. Galaxy Raiders' fanfare starts like this:

```ts
patterns: {
    fanfare: `
        # lead      | chord     | bass      | drums
        # -----------------------------------------
        | E-5 L v9  | E-4 C a37 | E-2 B     | k
        | ...       | ...       | ...       | h
    `,
},
```

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

**Built:** these tokens, but slides are `u` and `d` with two hex digits
(`u0C`, `d05`), not `/` and `\`. A pattern is one multiline string, not an
array, and each cell starts with `|`, so each row does too. A slide lasts one
row. To slide on, the next rows repeat it.

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

**Built:** the error names the pattern, the row and the channel, as
`song: pattern 'fanfare', row 12, channel 1: unknown instrument 'Q'`. It
cannot name the song, since `createSong` is not told the name it is exported
under. Rows and channels count from 0. Each entry's sounds test is also its
audio test (section 10.5).

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

`createMusicPlayer({ audio80 })` plays one song at a time on voices 0 to *n* - 1.

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

**Built:** this interface, with two changes in behaviour. A `tempoScale` of 0
holds the song where it is, with its notes ringing on as their envelopes
allow (2026-10-07, for Burrow Bust's walking tune). And `play` now cancels
any song queued, as well as stopping the one playing (2026-10-09). Before
that, a game that ended during Crumb Chase's start tune played its end tune
and then the sneaking tune queued behind the start tune.

### 6.2 Sound effects, and which voice they get

`sound.play(effect)` hands the choice of voice to the chip, in the
worklet, because only the worklet knows which voices have finished their
release. The rule:

1. Effects may use the voices the music is not using: voices from the
   song's channel count up to 7. With a four-channel song, that is four;
   with none playing, all eight.
2. A free voice, if there is one, from the top down (section 16.2).
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
`refreshView`. Nothing in `@mvtjs/audio` depends on a renderer; the
node an audio view returns is the entry's choice, a few lines.

Its output is the chip, which the view does not create but is handed, as a
binding read once: `sound: Audio80`. That is a stretch of "binding" (it is
neither a query nor a relay); open question 4 asks whether it deserves a
name of its own.

**Built:** as designed. Every audio view takes `sound: Audio80` as a binding
read once, and its doc comment says it is the view's output, not model
state. Fruit Machine's audio view is an HTML element that is never added to
the page, and the Arcade's are HTML elements too.

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

**Built:** states and counts, as designed, and no model gained an event.
Three things were added on the way:

- **`increased` and `decreased`** on each number `watch` reports (2026-10-09).
  They replace the rise test written out above, which every audio view had
  needed (open question 8).
- **Polling once when the view is made** became the usual start for an audio
  view. Then the first refresh hears only later changes. A view uses the
  first poll on purpose only when it means to hear the start, as Galaxy
  Raiders' does for its fanfare (section 16.3).
- **A count for each cause.** Where two changes in one tick were one moment,
  the first games read two watched values together. The code reviews on
  2026-10-09 gave such models a count for each cause instead, such as Fuel
  Run's `fuelTanksDestroyed` (section 16.10).

---

## 7. The Host and the Arcade

### 7.1 One chip, owned by the host

Browsers allow few audio contexts, and need a user's gesture to start one; a
mute setting belongs to the site, not an entry. So the entry host owns one
chip, made the first time an entry is launched, and gives it to each session.

- `PixiStartOptions` and `ElementStartOptions` gain a required `sound:
  Audio80`. Required, not optional, so no entry carries a fallback; headless
  callers (the snapshot script, the benchmarks) pass `createSilentAudio80()`.
- In the host's tick, the chip's clock advances in the same branch as the
  models: `if (!isPaused) { session.update(deltaMs); sound.advance(deltaMs); }`.
  For Pixi entries that is inside the stage's ticker callback, before
  `updateView`. After `refreshView`, before rendering, `sound.flush()`.
- `start` and `stop` reset the chip, so one entry's sounds never leak into
  the next, and no entry has to clean up after itself.

**Built:** the page owns the sound, not the entry host (2026-10-07, renamed
2026-10-09). `createPageSound`, in `runner/page-sound.ts`, makes a
`PageSound`. It holds one audio context with two chips on it, each with its
controls:

- **`entryAudio80`** is the chip every session plays on, given to it as the
  `sound` start option. The entry host advances its controls with the
  session's delta and never while paused, flushes them after `refreshView`,
  and resets them between sessions, as designed.
- **`pageAudio80`** is the page's own chip, for the Arcade's sounds and the
  pause menu's volume previews. The page advances it every frame, so it can
  play over a paused game (section 16.8).

Each chip and its controls stay the same objects for the page's life. Until
the chips load, they drop every write. Headless callers pass
`createHeadlessAudio80()` as `sound`. An entry host made without a
`PageSound`, as for the cards' live previews, makes a silent one,
`createPageSound({ isEnabled: false })`.

### 7.2 Starting audio, and loading it

The `AudioContext` is created and resumed in the handler of the gesture that
launches an entry (a click or a key in the Arcade), which every browser
accepts. An entry opened straight from a link starts its audio on the first
key or touch.

`@mvtjs/audio` and its worklet load the first time an entry is launched, as
Pixi does, so the home page's size budget (036) is untouched. Where the
worklet cannot load (an insecure origin, such as the dev server reached
over the network by IP from a phone, since `AudioWorklet` needs a secure
context), the host falls back to the silent chip and the entry plays
silently.

**Built:** the sound loads on the visitor's first press anywhere on the
page, not with the first entry (2026-10-07). `PageSound.prepare` makes the
audio context before it awaits anything, so the context is made inside the
gesture, as Safari requires (2026-10-09). Then it loads `@mvtjs/audio/web`
and makes the two chips. A context that is not running, because it was made
without a gesture or a phone call interrupted it, resumes on the next key
press, click or touch. A failed download is tried again on the next press.
Where `AudioWorklet` is missing, no context is made and the chips stay
silent.

The Arcade's own audio views and sounds load in the same press, through
`loadArcadeAudioViews`, so the home page's first load holds none of them.
The home page's budget rose from 40 KB to 50 KB on 2026-10-09. Its first
load measured 40.1 KB that day, gzipped.

### 7.3 Mute and volume

A mute toggle in the Arcade's navigation and its pause menu, with `M` as a
key, remembered in `localStorage` (a per-viewer convenience, wrapped in
`try`). One volume, for now. Previews in attract mode are always silent: a
host made with `takesInput: false` gets the silent chip.

**Built:** no `M` key, and two volumes. The pause menu has a slider from 0
to 10 for the music and one for the effects, each with an icon that turns
it off and on. A speaker in the nav mutes all the sound, and a press on it
always brings the sound back. The settings start half way, live in the
Arcade's model (`soundSettings`), and are kept in `localStorage`. A slider's
gain is its position squared, so its steps sound even (sections 16.2, 16.6,
16.7 and 16.9). Previews on the cards are silent, as designed.

---

## 8. The Demonstration: Galaxy Raiders

### 8.1 Why this game

Galaxy Raiders has the richest set of moments of any game in the Arcade
(shots, dives, kills of three kinds, the ship's loss, stage clear, game over),
and a phase that drives music naturally. Shooters of its kind are also where
chip sound is most remembered. Crumb Chase was the other candidate; it has
fewer moments (crumbs eaten, caught, won).

### 8.2 The sounds

| Cue | Heard when (the binding watched) | Sound |
| --- | --- | --- |
| Stage fanfare | `phase` becomes `'playing'` from nothing, `'stage-clear'` or `'game-over'` | Two bars, four channels; then the stage tune is queued |
| Stage tune | After the fanfare | Sixteen bars, four channels, looping; `tempoScale` 1.15 while five or fewer raiders are left |
| Shot | `shotsFired` rises | `SHOT`, a falling zap |
| Dive | An enemy's `phase` becomes `'diving'` | `DIVE`, a falling whistle |
| Raider destroyed | An enemy's `isAlive` becomes false | `RAIDER_HIT`, its pitch by `kind` (carriers deepest) |
| Ship destroyed | `phase` becomes `'dying'` | A long noise explosion; the music stops |
| Respawn | `phase` becomes `'playing'` from `'dying'` | A rising four-note chirp; the stage tune starts again |
| Stage clear | `phase` becomes `'stage-clear'` | A one-bar jingle |
| Game over | `phase` becomes `'game-over'` | Four slow bars in a minor key, then silence |

Enemy shots stay silent, as the genre's usually were: with a dozen in the air,
they would bury everything else.

Voices: the songs use four channels (0-3), leaving four for effects.

**Built:** these cues, with small changes. Only the stage tune speeds up,
not whichever song is playing (2026-10-09). The raider's explosion is three
effects, one for each kind, on one instrument at three notes. The game-over
tune is five bars, not four.

### 8.3 The model change

One counter: `shotsFired`, incremented where a player bullet is fired, reset
with the game. Every other cue is a state the model already has.

**Built:** `shotsFired`, and later `enemiesLeft` (2026-10-09), the raiders
still alive in the wave. Before that, the game view counted them for the
audio view's binding.

### 8.4 The views

`GameView` takes `{ model, sound }` and places two audio views among the
others: one for the game, and one inside the enemies' `<List>`, so each
enemy's sounds follow its own state.

```ts
// --- Bindings ---

export interface GameAudioViewBindings {
    /** The chip to play on: the view's output, read once. */
    readonly sound: Audio80;
    readonly phase: () => GamePhase;
    readonly shotsFired: () => number;
    readonly enemiesLeft: () => number;
}

// --- View ---

/** The game's music, and the sounds that are not any one enemy's. Draws nothing. */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const music = createMusicPlayer({ audio80: sound });
    const watcher = watch({ phase: bindings.phase, shots: bindings.shotsFired });

    setUpdate(view, (deltaMs) => {
        music.tempoScale = bindings.enemiesLeft() <= HURRY_ENEMIES ? HURRY_TEMPO : 1;
        music.update(deltaMs);
    });
    setRefresh(view, () => {
        const w = watcher.poll();
        if (w.phase.changed) playPhase(w.phase.value, w.phase.previous);
        if (w.shots.previous !== undefined && w.shots.value > w.shots.previous) {
            sound.play(SHOT);
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
```

`EnemyAudioView` is the same shape, smaller: it watches `isAlive` and
`phase`, and plays `RAIDER_HIT` (by `kind`) or `DIVE`. Its `<List>` slot is
reused when a stage brings new enemies: the slot's `isAlive` goes from false
to true, which is not a transition it plays on, so a new stage makes no false
explosions. A new slot's first poll has `previous` undefined, which it
ignores in the same way.

The sound data lives in `galaxy-raiders/data/`: `sounds.ts` (instruments and
effects) and `music.ts` (the four songs), with `sounds.test.ts` importing
both so the notation is checked.

**Built:** as shown, except that the shot is heard with
`if (w.shots.increased)`, and the view uses a `switch` on the phase. The
tests are in `views/audio-views.test.ts`.

### 8.5 The music

Four original pieces, written for this game and this chip: the fanfare (two
bars), the stage tune (sixteen bars, lead, arpeggio chords, filtered bass,
noise drums, at 150 BPM in E minor), the stage-clear jingle (one bar) and the
game-over tune (four bars). None quotes or paraphrases any game's music.

**Built:** these four, with a five-bar game-over tune. The other eight games
have original music and effects of their own, each in the sound of its
era's hardware where the chip can make it (section 16.3).

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

Galaxy Raiders' audio views ticked against `createRecordingAudio80()` with a
model driven through its inputs: firing plays one `SHOT`; two shots in one
tick play two; killing a raider plays `RAIDER_HIT`;
restarting after game over plays the fanfare and no shot; a new stage plays no
explosion; a refresh without an update (paused) advances no music.

**Built:** these tests, against `createHeadlessAudio80({ record: true })`,
for every game's audio views, not only Galaxy Raiders'. Two shots in one
tick play one, since two at once would only be louder (section 16.2).

### 10.5 Golden audio

Each effect and song of an entry rendered offline to samples, hashed, and the
hash committed. A change to the core or to the sound data that changes the
sound fails the test, and writes the new render as a WAV beside the old one,
for someone to listen to before accepting it. This is 042's visual snapshots,
for the ear, and much cheaper: rendering a song in Node takes milliseconds,
needs no browser, and is the same on every machine: the core is plain
arithmetic on doubles, and the tests run in Node, whose maths library gives
the same results on every OS.

`npm run audio:render -- galaxy-raiders` writes every effect and song to
WAV files, for the composer's ears, without starting the site.

**Built:** these are **audio tests** (renamed 2026-10-09), the counterpart
of 042's visual tests. Each entry's `data/sounds.test.ts` renders every
sound it finds with `findSounds`, and checks that it can be heard, is not
squashed, and has the hash in its Vitest snapshot, its reference. Each song
is also checked against the shared loudness (section 16.6). A changed sound
fails its test but writes no WAV file. To hear it, run
`npm run audio:render`, which takes the paths of the modules that hold the
sounds, not an entry's id, such as
`npm run audio:render -- packages/website/src/entries/galaxy-raiders/data/music.ts`.
The tools are in `@mvtjs/audio/headless`, and its README covers them.

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

**Built:** the first two were measured (section 16.1). The mono core takes
21-27 µs per block with eight voices, about 1% of the block, well inside
the budget. Galaxy Raiders' sound costs about 1.5 µs a frame on the main
thread. The flush's cost and the size of the first launch's download were
not measured, beyond the worklet's script, which is 12 KB before
compression. In the browsers, only Chrome was measured, once and headless.
Firefox was checked by ear, and Safari is still to try.

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
- `@mvtjs/audio`'s own README: the chip, the API, the notation in full.
- `AGENTS.md` and `llms.txt`: the package in the structure, and a line on
  audio views.

**Built:** all of these (2026-10-07, and reworked through 2026-10-09). The
package's README is a front door to two guides in `packages/audio/docs/`,
[Using the Audio80](../../packages/audio/docs/using-the-audio80.md) and
[Writing Tracker Music](../../packages/audio/docs/writing-tracker-music.md).
The headless tools have a README of their own, in
`packages/audio/src/headless/`. The MVT guide has its
[Sound and Music](../../packages/docs/building-with-mvt/presenting-the-world/sound.md)
page. The glossary, the view and model skills and the style guide gained
what the work taught, including the writing rules.

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

1. ~~**The chip's name.** The code calls it `Audio80`, plainly. A name of
   its own, for the docs and an Arcade credit ("music on the ..."), would give
   it some personality. It must not echo a real chip's.~~ Resolved
   (2026-10-07): the plain name stays, and it is the chip's name too. The
   chip is the **Audio80**, and section 16.4 gives the rule for naming
   chips to come.
2. ~~**Sound on or off by default?** Recommended: on, since audio starts only
   from a deliberate launch, with the mute toggle remembered. Attract-mode
   previews are silent either way.~~ Resolved (2026-10-07): sound is on,
   with both volumes half way, and the settings are remembered. The cards'
   previews are silent.
3. ~~**The lead.** 35 ms is a guess. Should it adapt to the spread of tick gaps
   it sees, or be fixed? The spike decides.~~ Settled for now: the lead is
   fixed at 35 ms, which held in simulation and by ear in Chrome and
   Firefox. Reopen it only if Safari runs dry (step 11).
4. ~~**`sound` as a binding.** The chip is an output, neither a query nor a
   relay. Keep it among the bindings, documented as "read once", or give
   views a second parameter for outputs? Recommended: a binding, because a
   second parameter would be the only one in the repo.~~ Resolved: the chip
   is a binding, read once, as recommended. Every audio view and the docs do
   it this way.
5. **Effects borrowing music voices**, as C64 games did, with the tune losing
   a channel for the length of an explosion. Authentic, and it frees voices.
   An option on the song (`yieldsToEffects: [2]`)?
6. **iOS's silent switch** mutes Web Audio unless the page asks for media
   playback (`navigator.audioSession`). Should the Arcade ask?
7. **Publishing `@mvtjs/audio`.** Its host side assumes this site's host. If
   it is published, that side becomes an example in the docs. As built, the
   package's own side is generic: `AudioControls` is the same for every chip,
   and the site's host side, `PageSound`, lives in the website. The package
   is still private.
8. ~~**A helper in `watch` for rises.** `previous !== undefined && value >
   previous` will be written in every audio view. Worth a helper, or a
   terminal in 008's builder?~~ Resolved (2026-10-09): `watch` gained
   `increased` and `decreased`.
9. **A Sound Test entry.** A demo in the Arcade, in the style of the sound
   test menus of 16-bit games: a jukebox of every entry's sounds and tunes,
   with a scope for each voice. It would show the chip off, and give
   composers a page with hot reload. After Galaxy Raiders, not before.
10. ~~**Sounds in the Arcade itself**: a coin drop on launch, ticks as the
    search narrows. The Arcade's page loop would need a chip of its own, or
    a share of the host's.~~ Done (2026-10-07): the page has a chip of its
    own, on the same audio context (sections 16.8 and 16.9).

---

## 15. Implementation Steps

1. ~~**Spike.** A one-voice core, the worklet loaded through Vite in the dev
   server and the build, the clock of section 3.3, and the host advancing and
   flushing it. Measure the worklet's time per block, the gaps between ticks
   and the lead needed, on Chrome, Firefox and Safari, desktop and iOS. Play
   a scale through a pause and a hidden tab. Record the numbers here, and
   settle open question 3.~~ Done in part, with the whole core rather than one
   voice: the build and the dev server, the clock in simulation, the core's
   cost in Node, and one run of the game in headless Chrome (section 16.1).
   Not done then: Firefox, Safari and iOS, and listening. Since then,
   listening and Firefox are done (2026-10-06 and 2026-10-07), and open
   question 3 is settled for now. Safari is step 11.
2. ~~**The core.** All of section 2: voices, filters, echo, output stage,
   instruments. Tests of section 10.1; offline rendering and WAV encoding;
   the core benchmark.~~ Done: `packages/audio/src/core/`, the `sound-chip`
   benchmark suite, results saved. The suite is now `audio80`, re-saved for
   the mono core on 2026-10-08.
3. ~~**The package.** `packages/audio/`, its `package.json` and README, the
   main-thread chip, the silent and recording chips, the command encoding.~~
   Done. The silent and recording chips later became one headless chip
   (section 4.5).
4. ~~**The notation.** `instrument`, `effect`, `song`, the parser and its
   errors. Tests of section 10.2.~~ Done, as `createInstrument`,
   `createSoundEffect` and `createSong` (section 16.2).
5. ~~**The players.** The music player and the voice allocator. Tests of
   section 10.3.~~ Done.
6. ~~**The host.** `sound` in the start options; the chip made on the first
   launch; advance, flush and reset in the host's tick; the silent chip for
   previews, the snapshot script and the benchmarks; the mute toggle.~~ Done;
   the mute toggle became the pause menu's sound settings (section 16.2).
   The chip later moved from the host to the page's sound (section 7.1).
7. ~~**Galaxy Raiders.** `shotsFired`; the instruments, effects and four tunes;
   `GameAudioView` and `EnemyAudioView`; the tests of section 10.4; golden
   hashes; the benchmark before and after.~~ Done.
8. ~~**More games**~~ (decided 2026-10-07: before the docs, since a second game
   is the real test of the design). One at a time, by how well each suits a
   1980s chip, borrowing the sound of its era's hardware where the chip can
   (wavetables for the Namco-style games, plain pulse and noise for the
   Konami-style one):
   - Dojo Duel (1985, after a C64 game: the chip's home). Music, hits,
     blocks, the round bell.
   - Burrow Bust (1982). Walking music that plays only while the digger
     moves (the music player's tempo at 0 standing still).
   - Crumb Chase (1980). Crumbs, the start jingle, caught, cleared.
   - Astrovoid (1979). No music, as in its era: a heartbeat that quickens as
     the rocks thin out, thrust, shots, explosions by rock size.
   - Fuel Run (1981). Low fuel, bombs, explosions; a short tune at most.
   - Fruit Machine (a demo, but an 1980s slot machine beeped). An audio view
     as a fifth view of its one model.
   - Borderline, decided later: Neon Monsoon (1990s arcades used FM and
     samples, which the chip lacks; a two-operator FM voice would be a
     proposal of its own) and Kwazy Cactii (2000s; chimes, no music).
   - Not a fit: Boids, Boids 3D, Falling Sand, Reordering Lists
     (simulations and UI demos).
   Done (2026-10-07), all eight, with Galaxy Raiders making nine (section
   16.3). The borderline two were done at the owner's word. Neon Monsoon was
   tried on the chip as it is, and the owner found it "excellent", so it
   needs no FM voice or detune for now (section 16.5). Kwazy Cactii has
   sounds and no music. Every game's sound was reviewed and fixed on
   2026-10-09 (section 16.10).
9. ~~**Docs.** Section 12.~~ Done (2026-10-07): two guides in
   `packages/audio/docs/` (using the Audio80; writing tracker music), the
   package README as their front door, a Sound page in the MVT guide
   (Presenting the World), the named-events tables and Why Polling's
   example rewritten for polling, counts in Change Detection, six glossary
   terms, and the agent files (AGENTS.md, llms.txt, the view and model
   skills). Section 16.3's lessons are in the Sound and Music page
   and the Audio80 guide.
10. **Then**: 035's music, once 035 is built; open question 9's Sound Test.
    These are follow-ons, not needed to finish 045. When 045 is archived,
    they and the open questions still open (5, 6, 7 and 9) move to a task,
    or to 035 for its music.
11. **Firefox and Safari, desktop and iOS**: by ear, left to the owner, who
    asked to be reminded. Firefox: done, all well (section 16.5). Safari,
    desktop and iOS: after the merge and deploy, fixing what turns up then.
    iOS's silent switch is open question 6. **Open.**
12. ~~**Hand over.** The worktree's commits, to the main checkout as
    reviewable chunks, uncommitted.~~ Done for the code (2026-10-09): the
    package, the page's sound, the Arcade's sounds and every game's sound
    reached `vnext` in five commits, `4023035` to `e3fb5f2`. The docs and
    these notes are the last chunk.
13. **A listening pass**, by the owner. The code reviews of 2026-10-09
    (section 16.10) left every sound's samples as they were, but changed
    when some of them play. They also raised questions that only an ear can
    settle. Burrow Bust's brighter pump (section 16.5) is still to confirm
    too. The questions:
    - Burrow Bust: the death tune (1800 ms) and the level-clear tune
      (1600 ms) are cut off by their 1000 ms phases. The death tune never
      reaches its last note. Shorten the tunes, lengthen the phases, or
      queue the next song behind the death tune.
    - Fruit Machine: a big win with one way celebrates for 2300 ms, but its
      tune lasts 2812 ms. A quick Spin cuts its last held note about 325 ms
      early. Shorten the note, lengthen the opener, or accept it.
    - Kwazy Cactii: the fireworks sound (650 ms, one voice) restarts itself
      from a cascade's fourth step. The landing tock is buried under the
      match burst in a cascade.
    - Neon Monsoon: every song shares a 300 ms echo, which fits only the
      stage theme's 150 BPM. The gem and graze sounds can retrigger every
      frame while gems stream in. An attack that times out plays the
      "broken" sound.
    - Fuel Run: the base's blast plays over the run-clear fanfare. The march
      now stops as the ship is lost.
    - Astrovoid: the heartbeat now quickens with each break, from `breaksLeft`,
      rather than with the rocks left.
    **Open.**

---

## 16. As Built: Measured, and Changed

Steps 1 to 7 were built on 2026-10-06, on the `sound-chip` branch from
`edf5dd2`. Steps 8 and 9 and the changes after them followed, through
2026-10-09. Each subsection records what was true on its date. Where a later
change renamed something, a note says so, and section 16.10 lists the
renames.

### 16.1 Measured

- **The core's cost** (`npm run bench -- sound-chip`, Node 26, results saved):
  16 µs per 128-sample block with one voice, 22-24 µs with four and 28-34
  µs with eight, whatever the waveform, filtered or not. Eight voices take
  1.3% of a block's 2.67 ms, against section 11's estimate of 2-6%.
  **Re-measured for the mono core** (2026-10-08, `npm run bench -- audio80`,
  results saved): 11-12 µs with one voice, 15-18 µs with four and 21-27 µs
  with eight. Eight voices now take about 1% of a block. The allocation is
  523 bytes per block.
- **The core's allocation.** The first build allocated 23.8 KB per block, all
  of it doubles boxed by V8: closure variables written every sample (the
  echo's and the DC blocker's state) and doubles passed to and returned from
  per-sample helpers (the oscillator, the envelope, the filter). Moving that
  state into typed arrays and making the helpers write into arrays brought it
  to 528 bytes per block in the benchmark (about 100 in a bare probe: a few
  boxed arguments to `render` itself), a minor collection every few minutes
  on the audio thread rather than several a second. Worth a line in the Hot
  Paths page: a double crossing a call that is not inlined is boxed. (That
  line has not been written yet.)
- **The clock**, simulated (`chip-clock.test.ts`): ticks of 16.7 ms with up to
  ±6 ms of jitter never run it dry over a minute at a 35 ms lead; drift of
  0.3% either way is corrected within the 0.5% rate limit, without running
  dry or jumping; a 250 ms gap runs dry once, fades, and recovers.
- **Vite.** The build bundles the processor as one self-contained script
  (12 KB, no imports), which every browser's `addModule` accepts. The dev
  server serves it as an ES module importing the core, plus Vite's env shim,
  which touches only `globalThis`. The home page's first load stayed at
  36.1 KB of its 40 KB budget: the chip's code loads on the first launch.
  **Later** (2026-10-09): with the Arcade's own sound wired in, the budget
  rose to 50 KB, and the first load measured 40.1 KB, gzipped. The chips,
  the Arcade's sounds and its audio views load on the first press.
- **A browser**, once (headless Chrome, the dev server, Galaxy Raiders opened
  from its link, a key pressed): the worklet loaded with no errors, the
  context ran at 48 kHz with a base latency of 10 ms and an output latency of
  40 ms, and the chip's output peaked at about 0.19 while the tune and a shot
  played. Shift alone did not start the context; Space did (Chrome does not
  count a modifier key as a gesture). Not tried: Firefox, Safari, iOS, a real
  sound card, and anyone listening.
- **The first playtest** (2026-10-06, by ear) found the browser's chip
  playing only its first batch: a drone of the fanfare's first notes, no
  effects, and silence after re-entering. Sending a batch transfers its
  buffer, which detaches the main thread's copy (its length reads 0); the
  writer sized its next buffer from that length, and the flush compared the
  buffers handed back against it too, so every later write went into a
  buffer of length 0. The headless check above had measured only the output's
  level, which a drone has. Fixed: the writer keeps its batch size apart from
  any buffer. The runner's tests now transfer buffers as the browser does,
  with a buffer handed back no sooner than the next tick, and one fails on the
  old writer. A second headless run counted what reached the worklet: about
  60 batches a second, none empty, notes and effects arriving, the level
  changing from moment to moment, silence after leaving, and the same again on
  re-entry.
- **Galaxy Raiders, before and after** (`games-and-demos`, interleaved from
  two worktrees, two rounds each): 7.5-8.6 µs per frame before, 9.0-10.6 µs
  after, so about 1.5 µs for sound, most of it the forty enemies' audio
  views (containers 77 to 120, methods 38 to 80). Allocation and collections
  showed no change through their noise. The saved `games-and-demos` results
  were not re-saved.
- **Levels**, rendered offline: the tunes peak at 0.48-0.57, the effects at
  0.13-0.22. An effect is one voice, so it cannot pass about 0.21; the
  band's instruments were turned down to make room. Whether the
  balance is right needs ears.

### 16.2 Changed from the design

- **Names.** `createInstrument`, `createSoundEffect` and `createSong`, not
  `instrument`, `effect` and `song`: the style guide's factory rule. The
  examples in sections 5 and 8 use the old names.
- **`createAudio80` returns at once**, with a `ready` promise, rather than
  a promise of the chip: the host needs a chip for the session it starts, and
  this one drops writes until its worklet runs. Instruments and effects named
  before then wait, and are sent once it does. (It is now `createWebAudio80`.
  Since 2026-10-09, it also keeps the latest value of each setting while it
  cannot play, and applies them once it can.)
- **Where the code is.** The clock, the worklet's runner and its processor sit
  in `src/web/` beside `createAudio80`, and `@mvtjs/audio/web` is its own
  export, so only the browser's chip imports the worklet's URL (a Vite
  `?worker&url` import, which Node and esbuild cannot read). The benchmarks'
  bundler stubs that import, since every entry's imports reach the entry host
  through `#shared`.
- **`reserveVoices`** was added to `Audio80`: the music player says how many
  voices the song keeps, and effects take the rest.
- **The mute control** was first a speaker in the runner's bar, and `M`; not
  in the site's nav, since it matters only while an entry plays. Both went
  once the pause menu had its own controls (below): a mute of everything
  that the menu did not show left a visitor who pressed `M` by accident with
  silence and no way to see why. Sound is on by default (open question 2's
  recommendation, taken for now).
- **Music and effects have volumes of their own** (2026-10-07). The chip has a
  gain for the voices playing music and one for those playing effects (a voice
  is an effect's while it plays one), ramped over about 10 ms, and kept
  through a reset. The pause menu became two tabs: Pause Menu (resume,
  restart, a slider and a mute for the music and for the effects, exit) and
  How to Play, which every game now fills. The settings start at 50%, which
  plays the sounds at the level they were written and playtested at (a
  slider at full is twice that), and live in the Arcade's model
  (`soundSettings`), which the page keeps in `localStorage`
  (`mvt-arcade-sound`). The games' keyboard input now leaves keys pressed in
  a modal dialog to the dialog, so Tab, Space and a slider's arrows work in
  the menu. Fixed on the way: the saved mute was never read back, its key
  declared below the code that read it at load. (Section 16.6 later made a
  slider at full play the sounds as written, and section 16.7 changed the
  controls.)
- **Shots are played once a tick** when the count rises, however far: two in
  one tick would only be louder. Section 10.4's "two shots in one tick play
  two" became "a rise plays one".
- **Effects jump the queue entirely**, ahead of stamped writes made in the
  same tick, `reserveVoices` included. So an effect played as a song starts
  could land on a voice the song was about to take, and be cut: the playtest
  heard it, in Galaxy Raiders' respawn chirp, cut by the stage tune starting
  again. Fixed (2026-10-07) by taking free voices for effects from the top
  down, as music takes them from the bottom up; the two meet only when every
  voice is busy.
- **Golden audio** is a Vitest snapshot of each sound's hash; a mismatch does
  not write the new render beside the old one. `npm run audio:render` takes
  module paths (the files that hold sounds, not barrels, since it runs in
  Node) rather than an entry's id.
- **The notation's details**, settled: `~` with two digits is depth in eighths
  of a semitone and rate in hertz; a bare `~` is a quarter of a semitone at
  6 Hz; `f0` to `fF` run from 80 Hz to about 14.5 kHz, evenly in pitch; a cell
  with an instrument and no note plays its own note; a note with no
  instrument keeps the channel's last. Songs could set a pan per channel
  (`pans`) until the chip became mono (2026-10-08). The chip rejects a song
  with more than eight channels.
- **Phones on the dev server.** The first Android playtest was silent: the
  dev server's network address is plain HTTP, an insecure page, where
  browsers give no `AudioWorklet` (section 7.2's fallback, working as
  designed). `npm run dev:https` serves the site over HTTPS with a
  self-signed certificate (`@vitejs/plugin-basic-ssl`, in Vite's `https`
  mode), so a phone gets sound after accepting the certificate once. Plain
  `npm run dev` is unchanged, as are the scripts that drive it.
- **The host's sound** is a module of its own (`runner/host-sound.ts`): it
  loads the chip on the first launch, resumes the context on the next key or
  touch where it starts suspended, and falls back to a silent chip where audio
  cannot start. (It became the page's sound, `runner/page-sound.ts`, on
  2026-10-09. Section 7.1 describes it as built.)
- **One headless chip** (2026-10-08, the owner's decision). The silent,
  recording and rendering stand-ins merged into `createHeadlessAudio80`:
  silent with no options, logging with `record: true`, rendering with
  `render`, or both. Its type has `log` only with `record` and `render` only
  with `render`.
- **`advance` became `update`** (2026-10-08, the owner's decision). The
  controls and the rhythm now move on with `update(deltaMs)`, like the rest
  of the repo, and a rhythm's period is its `periodMs` property.
- **No `/internals`** (2026-10-09, the owner's decision). `@mvtjs/audio/internals`
  is gone, and the headless renderer fills a buffer the caller passes in,
  `render(output)`, instead of returning a new one. The `audio80` benchmark
  now renders through the headless chip.
- **`createWebAudio80`** (2026-10-09, the owner's decision). The browser's
  chip is one implementation among possible others, so it no longer takes
  the plain name: `createAudio80` became `createWebAudio80`, beside
  `createHeadlessAudio80`. The path stays `@mvtjs/audio/web`.
- **The rhythm became `createMetronome`** (2026-10-09, the owner's decision).
  It counts beats at a tempo you can change and plays nothing itself, so it
  is not audio-specific. It moved to `@mvtjs/utils` as `createMetronome`
  and `Metronome`, beside the tweens and sequences, and left `@mvtjs/audio`.
- **Audio tests** (2026-10-09, the owner's decision). "Golden tests" became
  "audio tests", the counterpart of proposal 042's visual tests. The hash
  a test compares with is its reference, as the picture is for a visual test.
- **`Audio80Synthesiser`** (2026-10-09, the owner's decision). `Audio80Core`
  became `Audio80Synthesiser`, made by `createAudio80Synthesiser`, in
  `core/audio80-synthesiser.ts`. The folder `core/` keeps its name: it also
  holds the definitions the notation and the chips share.
- **`@mvtjs/audio/headless`** (2026-10-08). The headless chip and the tools
  that render, measure and save sound have an import path of their own, so
  the root holds only what games use. It was briefly `@mvtjs/audio/rendering`
  the same day.
- **Function names start with a verb** (2026-10-08), as the style guide now
  says. `soundsIn` became `findSounds`, `loudnessOf` became
  `measureLoudness`, and the next day the files that hold them were named
  after them. `effectOn` became `findEffectOn` on 2026-10-09.
  `renderEffect` became `renderSoundEffect`, to match `createSoundEffect`.
- **`play` cancels the song queued** (2026-10-09). See section 6.1.

### 16.3 What the games taught

Step 8, game by game: what each needed, and what it showed that the docs
(step 9) should say. The names are those of the day. `soundsIn` is now
`findSounds`, and `createRhythm` is now `createMetronome`, in
`@mvtjs/utils`. The code reviews of 2026-10-09 changed some of what is
described here, as section 16.10 records.

- **Dojo Duel** (2026-10-07). No model change: every moment was already a
  state (a fighter's `phase` becoming `blocking` or `defeated`, its `move`
  becoming one) or a count (each side's points). Two audio views, one per
  fighter and one for the match, which owns the music: a gong each round, a
  fight theme that plays on through each point and from the top each round, stings for points, ticks in the last five
  seconds (a binding derived in the parent, `Math.ceil` of the time left),
  and won and lost jingles. Original music in the Japanese "in" scale.
  - **The first poll, again.** `watch` reports everything changed on its
    first poll, with `previous` undefined. For a count, `previous !==
    undefined` tells the first poll apart; for a value that may itself be
    undefined (a fighter's move), it cannot. The fix is to poll once when the
    view is made, so the first refresh hears only later changes. Galaxy
    Raiders uses the first poll on purpose (the fanfare as the game starts).
    The docs should show both, and say which to reach for.
  - **Every game's sound test is the same test**, so `@mvtjs/audio` gained
    `soundsIn` (a module's songs and effects, by name), and `isSong` and
    `isSoundEffect` (exact, from the factories' own records). The WAV script
    uses them too, and now writes under each module's path: two games'
    `sounds.ts` had overwritten each other's renders.
  - **Noise through a filter is quiet**: the swishes (noise through filter
    `b`, its cutoff stepped with `f`) came out at half a plain effect's peak,
    and needed full volume.
- **Burrow Bust** (2026-10-07). One model change: the digger's private
  `moving` flag became a read-only `isMoving` (with a test that it stays true
  tile after tile while a direction is held). Walking music that moves on
  only while the digger moves; a pump note rising with each stage; pops,
  squashes, a salamander's hiss and roar, a ghost's slide; rocks that creak,
  whistle and crash. Wavetable voices, for the arcade boards of 1982.
  - **A tempo of 0 holds a song.** The music player had refused 0; now it
    holds the song where it is, its notes ringing on as their envelopes
    allow. With plucks that die away by themselves, the tune falls quiet
    when the digger stops, and picks up mid-phrase when it moves again.
  - **One player, one song at a time.** The jingles and the walking tune
    share one music player, since two would fight over the low voices; the
    tempo follows the digger only while the song playing is the walking
    tune (`music.song === WALK_TUNE`). Two players on separate voices would
    be a feature of their own, not needed yet.
  - **Polling once when made** is now the norm for an audio view in a
    `<List>` (three in this game): a slot reused for a new creature must
    not hear its change from the old one. Worth a line in the docs, and
    perhaps an option on `watch` (008).
  - **A three-channel tune leaves five voices** for effects; this game has
    many at once (pumps, pops, rocks, fire), and it shows.
- **Crumb Chase** (2026-10-07). No model change, and one audio view: a tune
  as a game starts, a sneaking two-channel tune under the chase that quickens
  as the maze empties, a nibble per crumb, a wail when caught, a run up when
  cleared. Wavetable voices.
  - **Alternating sounds need no state.** The nibbles take turns low and high
    by whether the crumbs left are odd or even: derived from the model, so
    the view keeps no count, and a refresh is still idempotent.
  - **A binding read every update can steer the music**: the tempo is
    `1 + (share eaten) * 0.6`, from the crumbs left and a fixed-value binding,
    the full maze's count, read once (the game has one maze).
  - **A slide lasts one row.** To slide on over several, the cells after
    repeat it (`\03` in each), which reads oddly; the docs should say so,
    and a slide over a given number of rows might be worth a token of its own.
  - **Three tests now find a song's first note** from its cells; a helper
    in the package would serve them.
- **Astrovoid** (2026-10-07). No music, as in its day: a heartbeat of two
  thumps by turns, quickening as the rocks thin out; the engine's rumble
  while thrusting; shots; breaks by rock size; the ship lost and back; a
  chime and a knell. Pulse and noise only. The model gained `shotsFired`,
  `rocksBroken`, and the last broken rock's size and place (`x`), with a
  test, its first.
  - **A `SlotList` removal is invisible to a view in its `<List>`.** A broken
    rock's slot is removed in the tick it breaks, and an absent slot is
    skipped, so an audio view beside each rock would never hear it break.
    The model has to keep the moment: a count, and the last one's details
    (the docs' own advice for a transient change, a "last event"
    property). The docs should say this where they teach `<List>` with
    `SlotList`.
  - **Rhythms are presentation state, heard as counts.** The heartbeat and
    the engine's bursts are counts advanced in the view's update step (by a
    period from the rocks left, or while thrusting), and the refresh plays on
    a rise, through the same `watch` as the model's counts. So update still
    only advances, and refresh only plays.
  - **`rose(previous, value)` is now in four views**, written out or as a
    helper: open question 8 (a rise helper in `watch`) has its evidence.
- **Fuel Run** (2026-10-07). The model gained `shotsFired`, `bombsDropped`,
  `explosionsStarted` and `lastExplosionWorldCol` (tested; the column went
  when the chip became mono): every pool is a
  `SlotList`, and an explosion is born removed, lingering only while it
  fades. A march as each run begins, a fanfare as it is cleared, a lament at
  the end; shots, bombs, explosions, refuelling; a rocket's launch from a view
  beside each rocket (a rocket is in its slot as it launches, so that one can
  be heard there); and three repeating sounds: the low-fuel alarm, faster as
  the tank empties, the saucers' warble, and the base's siren. Square waves,
  triangles and noise, for the Konami boards of 1981.
  - **Repeating sounds became `createRhythm`** in `@mvtjs/audio`: a count of
    beats at a period that may change (0 stops it, and it beats at once when
    it starts), advanced in the update step and heard in the refresh. Fuel
    Run has three; Astrovoid's heartbeat and engine were rewritten on it.
  - **Two changes in one tick can be one moment.** The ship coming back tops
    up its fuel in the same tick its phase turns to `playing`; a rise in fuel
    is a tank refuelling only when the phase did not change with it. The
    docs should show reading two watched values together.
  - **Pan from world positions needed the scroll** (until the chip became
    mono): the parent turned world columns into screen columns for the audio
    view's bindings, as it does for the sprites.
- **Fruit Machine** (2026-10-07). No model change: the spin count, the
  machine's and each reel's phase, and the celebration's step were enough.
  One audio view as a fifth view of the one model, beside the Pixi, three.js
  and two HTML views: a detached element (the HTML renderer's tick API is the
  lightest), listed in the session's `views` and never added to the page,
  with a child per reel to thunk as it lands. The lever,
  clicks while any reel turns and coins through a win's opener (two
  rhythms), a jingle for a win and a longer one for a win of two bets or
  more, a chime for each way shown, higher for a longer way, a falling "aw"
  for nothing, and a slow tune as the credits run out. Pulse and triangle,
  bright and short.
  - **An effect's volume was applied twice.** An effect made with its own
    instrument (a step table, usually) passed its volume to that instrument
    as well as to its note, so it played at the square of its volume. Found
    tuning the clicks here: `createSoundEffect` now gives the instrument its
    own full volume, and the thirteen effects across the games written to
    the old behaviour have the squares of their old volumes, so they sound
    as they did (the golden hashes agree).
  - **A view that hears a model's actions should poll when made.** A spin
    can begin before the audio view's first refresh (a test did it): with
    the first poll in the refresh, the spin count's first value is the one
    after the spin, and the lever is never heard. Polling at construction,
    the Burrow Bust fix, covers this too, and is looking like the default
    for every audio view but one that means to hear the start.
  - **A new song cuts the last one short**, but a spin is not a song: the
    view stops the music itself when the next spin starts, so a big win's
    jingle, cut short by Stop, doesn't ring on over the lever.
- **Neon Monsoon** (2026-10-07; a try, for the owner's ear). A 1990s
  shooter, whose arcades had FM chips and samples: how near can the chip get
  to that decade's softer sound as it is? Wavetables drawn from FM tones (a
  sine bent by a second at a low index, an electric piano's sine with its
  second and third harmonics), saws through low-pass filters, slow attacks,
  delayed vibrato and a long echo; four channels (a filtered saw lead, bell
  arpeggios, an octave-jumping bass whose filter closes on each note, drums).
  A stage theme, a boss theme after a repeating warning, a stage-clear jingle,
  a finale and an ending; the guns' soft patter every other volley, grazes,
  explosions by size, pickups, gems, bombs, focus, the boss's hull ticking
  under fire and its attacks breaking. The model gained `explosionsStarted`
  with the last one's size and `x`, `itemsCollected` with the last kind, and
  `gemsCollected` (tested).
  - **What the chip lacks for the decade**, in the order they would help: a
    fine detune (a pitch in cents, not whole semitones), so two voices can
    beat against each other for the thick unison of the era's pads; then an
    FM voice (a proposal of its own). The wavetables' 16 levels add a grit
    that FM didn't have; the filter hides some of it.
  - **The filters are the music's.** A song sets them, and a sweep moves
    one for everything routed to it, so this game's effects use none.
  - **The ship's explosion is two changes in one tick** (an explosion
    counted, and the phase turning to `dying`), heard once: Fuel Run's
    lesson again.
- **Kwazy Cactii** (2026-10-07). No model change and no music: soft
  wavetable sounds (a marimba's tone and a glass's), a whoop for a swap, two
  knocks for one undone, a tock as the cactii land, a chime for each match
  that climbs a pentatonic scale with each step of a cascade (since a burst
  and a brass fanfare: section 16.5), a sparkle for a
  match of five, fireworks for a long cascade (the effect's own step table
  waits for the burst, so the view keeps no timer), and a few notes for a new
  board and the end. The audio view keeps no state at all: the board's phase
  says everything.
  - **A scale of effects is an array**, which `soundsIn` doesn't look in:
    the sounds test spreads it in by hand, and `audio:render` skips it.
    `soundsIn` could look one level into arrays.
  - **Bind to the root, not to a child that may be replaced.** A new game
    replaces the board, so the audio view's bindings read `game.board`
    afresh each time. The game's other views captured the board once, so
    they went on showing the old one after a restart: a bug of the game's
    own, found here and fixed in a commit of its own, with the game's first
    test of its whole view (its textures stubbed with `vi.mock`).

### 16.4 The name: Audio80, in `@mvtjs/audio`

Settled 2026-10-07: the chip is the **Audio80**. Not "the sound chip", which
says nothing of which; not SFX80, since it plays music as much as effects.

- **The rule, for every chip to come**: a plain word for what the chip
  does, then its decade as two digits, run together. An FM chip for the
  1990s would be the Audio90; a chip of visual effects for the 1980s, the
  Video80. The decade is loose: the Audio80 suits the games of 1979 to the
  mid-1980s.
- **One spelling everywhere**: no hyphen (TIC-80 has one; identifiers
  can't), so `Audio80` in prose and code alike.
- **A package per medium, two import paths**: `@mvtjs/audio` (the notation,
  the players, the stand-in chips and the offline renderer, all of which
  run in Node) and `@mvtjs/audio/web` (the browser's chips, whose worklet
  Node cannot load). An Audio90 would join both; a Video80 would have a
  package of its own, `@mvtjs/video`. The package was `@mvtjs/sound`.
- **Flat named exports, the chip in the names.** Each chip has its own API,
  so a game says which it uses in its types: `sound: Audio80`, made by
  `createAudio80`, with `createSilentAudio80`, `createRecordingAudio80` and
  `createOfflineAudio80` (since renamed `createRenderingAudio80`) beside it, and `Audio80Core` for the synthesis.
  Measured first: a namespace re-exported from the root
  (`import { audio80 } from '@mvtjs/audio'`, read as `audio80.createX`) is
  trimmed to what is used by rolldown (Vite 8's bundler) and Rollup, but
  kept whole by esbuild; named exports are trimmed by all three. A chip a
  game doesn't use is dropped by all three either way.
- **The notation and the players keep plain names** (`createInstrument`,
  `createSong`, `createMusicPlayer`, `renderSong`): a second chip may share
  them, and if it can't, they are renamed then. The music player's option
  is `audio80`, as it takes one.
- **The controls are apart from the chip.** What the host alone does
  (advance the clock, send the tick's writes, reset between sessions, the
  listener's volumes, `ready`, `destroy`) is `AudioControls`, the same for
  every chip, made by the chip's factory and returned beside it:
  `const { audio80, controls } = createAudio80({ context })`. It replaced
  `SoundChipHost`, which extended the chip, so an entry given the chip was
  given an object that could do all of it, a cast away. Apart, an entry has
  no way to; and a host drives every chip's controls alike, whichever chips
  its entries use. The stand-in chips return controls too: a test advances
  `controls`, as the host would.
- **The benchmark suite** is `audio80`, its saved results renamed with it,
  not re-run.

**Since then** (2026-10-08 and 2026-10-09), the package has three import
paths, not two. `@mvtjs/audio` holds only what games use: the notation, the
music player and the types. `@mvtjs/audio/headless` holds the headless chip
and the rendering tools, and `@mvtjs/audio/web` the browser's chip. The
chips' factories are `createWebAudio80` and `createHeadlessAudio80`, and the
synthesis is `Audio80Synthesiser`, internal to the package (section 16.2).
The rule for names, and the controls apart from the chip, stand.

### 16.5 The second playtest

2026-10-07, on Chrome (desktop and Android) and Firefox.

- **Firefox**: everything works. **Safari** (desktop and iOS) is left until
  after the merge and deploy; bugs found then are fixed then.
- **Neon Monsoon**: "excellent", on the chip as it is. No FM voice or
  detune needed for now.
- **Burrow Bust**: only the first pump was heard. Every pump was written:
  checked through the views, the real game view, the worklet's runner with
  its messages copied as `postMessage` copies them, and a render of the real
  game on the offline chip. The pump was a low, soft triangle (middle C,
  gliding up a fourth), which a laptop's or a phone's speakers barely play,
  next to the harpoon's bright zip on the first press. It is now a puff of
  noise and a bright square rising, louder than the zip, its pitch still
  rising with each pump. To confirm by ear.
- **Fruit Machine**: a reel's thunk now comes as it starts to settle (the
  moment it hits its stop and bounces), not as it comes to rest.
- **Kwazy Cactii**: the chimes were "a bit lame". Each match is now a crack
  of noise and a brass fanfare (a saw through a filter that opens as it
  speaks, up a major chord), the fanfare a step up a pentatonic scale with
  each step of a cascade.

### 16.6 Loudness

2026-10-07. The owner found the sound loud: Galaxy Raiders at 50% louder
than YouTube at 100%, and only 10% close to it, on the desktop and on a
phone. Measured as streaming services measure loudness (ITU-R BS.1770,
integrated, in LUFS):

- **Galaxy Raiders at 50%** was -16.4 LUFS for its music, and -15.1 in play,
  its effects adding about 1 LU: near YouTube's ceiling of -14, where it
  turns loud videos down, and louder than much of what plays there.
- **The songs spread over 13 LU**, from -16.4 (Galaxy Raiders) to -29
  (Crumb Chase's sneaking tune), nothing holding them together.
- **The sliders set the gain directly**, so half way was only 6 dB down,
  and all the useful travel was in the bottom fifth.

Changed:

- `@mvtjs/audio` gained `loudnessOf` and `REFERENCE_LOUDNESS_LUFS` (-20,
  give or take 3 LU). Every song is now within it, checked in each game's
  sounds test; seven songs in four games took a song `volume` (a gain on
  every note, new) to get there. A volume set mid-note is no longer capped
  at 1, as a note's starting volume never was, so a lifted song stays
  balanced. `audio:render` prints each song's loudness. (`loudnessOf` is now
  `measureLoudness`, with `REFERENCE_LOUDNESS_LUFS` and
  `LOUDNESS_TOLERANCE_LU`, in `@mvtjs/audio/headless`.)
- The sliders' gain is the square of their position: all the way up plays
  the sounds as written (-20 LUFS for a song), half way 12 dB quieter, a
  quarter 24 dB. At the default 50%, Galaxy Raiders now plays about 14 LU
  quieter than before: about where the owner found 10% comfortable.

### 16.7 The pause menu's volumes, in steps

2026-10-07. The music's and the effects' controls were each a slider and a
mute button, and they disagreed: muting dimmed the slider as if disabled
while it still moved, and a slider at 0 was silent without looking muted.
Two ways to say "silent", looking different. Now each is one control, in
steps, as games of the era set it (and as most games still do, with
sliders alone: Celeste, Hollow Knight, Stardew Valley): Off, then ten bars,
lit up to the volume, "Off" or the percentage beside them. An unseen
11-step slider lies over the bars for the pointer, a touch, the keys
(arrows a step, Home off, End full) and assistive technology. The mute
buttons and the settings' mutes are gone; a setting saved muted loads as
off. Up and down in the menu reach the two sliders, and R and X restart and
leave from anywhere in it.

Then, at the owner's eye, the bars became a plain slider again, keeping its
eleven steps (0 to 10), with nothing beside it, and the words "Music" and
"Effects" became icons (🎵 and 🔊), the words kept for assistive technology.
At 0 the icon greys and is struck through, which is all the "Off" needed.

### 16.8 The page's own Audio80: previews, and room for the Arcade's sounds

2026-10-07. The owner asked whether the music should play on under the pause
menu, to hear the level being set. Most modern games keep it playing,
muffled (Celeste, Hades); older ones stop it (Super Mario Bros.); and many
preview each slider's level as it moves. Here, pausing freezes the whole
entry, its views' presentation state included, so its music holds; playing
it on would tick some of a paused game's views and not others, and its
other repeating sounds (Fuel Run's alarm, Astrovoid's heartbeat) with them.

So the page has an Audio80 of its own, on the same audio context, which the
page ticks every frame, paused entry or not, and the pause menu previews on
it: a phrase of music as the music's volume moves, a blip as the effects'
do, through the same volumes, so each plays at the level being chosen. The
host's sound (`createHostSound`) now belongs to the page, which hands it to
the entry host, sets its settings and ticks its second chip; the page's chip
is the same object throughout, passing calls to the real chip once loaded.
Measured in Chrome: each blip's peak follows the slider's gain exactly, the
paused game's chip silent throughout. The Arcade's own sounds live in
`arcade/data/`, tested as an entry's are: room for the arcade screen's
sounds next. (`createHostSound` is now `createPageSound`, and the two chips
are `PageSound`'s `entryAudio80` and `pageAudio80`. Section 7.1 describes
them as built.)

### 16.9 The Arcade's sounds

2026-10-07. On the page's chip, small and soft (about half a game's
effects): a tick as the keyboard moves between cards (not as the pointer
does: too busy); key ticks in the search, two by turns so fast typing does
not drone; a pop up or down as a tag is chosen or taken away, in place of
the tick the same action makes; a bonk for a search that matches nothing;
a blip up or down as a panel opens or closes; a coin in as a card
launches; the cards burning (noise, its pitch jumping for the crackle); the
screen powering on (a thunk, static, the whine rising) and off (a zip down
to a pop), but not where less motion is asked for, as the screen does
neither; the cards developing back (glass, shimmering up); a chime as a
game pauses and resumes; and a buzz for an entry that will not load. One
`ArcadeAudioView` hears them all, from the model and from the way in and
out (the transition's own presentation state), as the games' audio views
do; the wall reports a keyed move, and the page counts them for it. The
music slider's preview became a twang: a low saw strummed up a fifth and
an octave, its filter snapping shut.

A speaker in the site's nav turns the sound effects off, and on again at
their level: the Arcade's and every game's, one setting in the model, the
same that the pause menu's slider and icon set. The sound now loads on the
visitor's first press anywhere on the page, not with the first entry; the
sound of that first press itself is lost while it loads. Checked in
Chrome: before a press, no audio; the page's chip took the ticks, the coin,
the burn, power-on, and the pause and resume chimes, and the game's chip
only the game's music, frozen while paused.

Then, at the owner's ear and eye: the speaker in the nav turns off all the
sound, music and effects, so a game launched next starts silent, as a
visitor who pressed it would expect; on again, each comes back at its
level. The pause menu keeps one icon for each. The screen's power-on lost
its rising whine, and its static lasts nearly a second, dying away. And
Escape now pauses a demo, as it does a game, rather than leaving it: the
bar's pause button already did.

Then: a game, entered, shows still for half a second after its screen
powers on, its first frame, before it runs. The way in (the transition's
new `showing` phase) lets it go; until then the Arcade's model holds it
(`isHeld`), and the page keeps the host paused. And the screen's static now
cuts in and out with the tube's concentrated beam, the transition's
`isBeamOn`: powering on, while it is a line (175 ms); powering off, from
the line to the dot going out (228 ms), with a pop. A test ties each
burst's length to the beam's.

### 16.10 The reviews and the hand-over

2026-10-09. The code went to the main checkout in chunks, and each chunk was
reviewed there. Then each game's sound was reviewed against the architecture
rules, the style guide and its writing rules. The fixes left every sound's
samples as they were, since no audio test's reference changed. But they
changed several models and audio views, and so when some sounds play.

**The page's sound**, from the review of the chunk that held it:

- The audio context is made inside the gesture, before anything is awaited,
  as Safari requires. A context that stops later, as when a phone takes a
  call, resumes on the next press. A failed download of the chips' code is
  tried again on the next press.
- The host's sound became the page's sound, `PageSound`, in
  `runner/page-sound.ts`. Its chips are `entryAudio80` and `pageAudio80`,
  each with its controls (section 7.1).
- The nav's speaker mutes the sound, rather than setting both volumes to 0.
  A press on a speaker that shows the sound off always brings it back. If
  both volumes are at 0, it turns both on at the level each had.
- The Arcade's audio views sit with its other views, and
  `loadArcadeAudioViews` imports them directly. The home page's budget rose
  to 50 KB (section 7.2).

**The games:**

- **Galaxy Raiders.** The model gained `enemiesLeft`. Only the stage tune
  speeds up, not whichever song is playing.
- **Astrovoid.** The model gained `breaksLeft`, the breaks still needed to
  clear the wave. A large rock takes seven, so the heartbeat now quickens
  evenly with each break, rather than by the rocks in the arena. The audio
  view polls when it is made.
- **Burrow Bust.** An enemy gained `hasEscaped`, so a creature that flees is
  not heard to pop.
- **Crumb Chase.** The maze gained `totalCrumbs`. A game can end during the
  start tune, and its end tune now cancels the sneaking tune queued behind
  the start tune. That case found the music player's bug (section 6.1).
- **Dojo Duel.** A point that ends the round is heard as the round's end,
  not as a point as well.
- **Fuel Run.** The model gained a count for each cause, `rocketsLaunched`,
  `enemiesDestroyed`, `fuelTanksDestroyed` and `basesDestroyed`, in place
  of `explosionsStarted`. A rocket can launch in the tick it appears, so the
  audio view beside each rocket could not tell a launch from an arrival. It
  is gone, and the game's audio view plays launches from the count. A
  refuel is a rise in `fuelTanksDestroyed`, not a rise in fuel with no
  change of phase. A new game now starts on the tick after its reset, so
  each count's next change is a rise.
- **Fruit Machine.** The audio view for each reel is gone. The machine's
  audio view counts the reels that have reached their stops, and plays one
  thunk however many land in a tick. The clicks follow the machine's phase.
- **Kwazy Cactii.** The match's binding is `matchedCellCount`, a number,
  rather than the cells themselves.
- **Neon Monsoon.** The warning's siren is counted from the model's
  `warningElapsedMs`, not by a metronome in the view. An extra life is heard
  from `extendsEarned`, not from a rise in lives. The view polls when it is
  made, and starts the stage theme then.

**What the reviews taught.** Where two changes in one tick are one moment,
a count for each cause is simpler and safer than reading two watched values
together, as Fuel Run first did (section 16.3). And a view beside a pooled
object cannot hear an event in the tick the object appears or goes. The
model has to count it.

**Loose ends**, for a task when 045 is archived:

- The Hot Paths page has no line yet on boxed doubles (section 16.1).
- `findSounds` does not look into arrays, so Kwazy Cactii's test spreads its
  fanfares in by hand (section 16.3).
- A slide over several rows still repeats its token on each row (section
  16.3).

---

## 17. Progress Log

- **2026-10-06.** The proposal was written, against `vnext` at `fafee01`.
  Steps 1 to 7 were built on the `sound-chip` worktree branch. They gave the
  core, the package, the notation, the music player, the host's chip and
  Galaxy Raiders' sound. The first playtest found the detached-buffer bug,
  which was fixed (section 16.1).
- **2026-10-07.** Steps 1 to 7 were committed (`c7c5d46`). Step 8 gave sound
  to Dojo Duel, Burrow Bust, Crumb Chase, Astrovoid, Fuel Run, Fruit
  Machine, Neon Monsoon and Kwazy Cactii (section 16.3). The chip was named
  the Audio80, in `@mvtjs/audio`, with its controls apart from it (section
  16.4). The second playtest tuned three games, and Firefox passed (section
  16.5). Loudness was measured and evened out (section 16.6). The pause menu
  gained its volumes (section 16.7). The page gained its own chip, and the
  Arcade its sounds (sections 16.8 and 16.9). Step 9 wrote the docs.
- **2026-10-08.** The chip became mono (`11d5219`), and its benchmark was
  re-saved. One headless chip replaced the three stand-ins, under
  `@mvtjs/audio/headless`. The controls' `advance` became `update`. Function
  names now start with a verb.
- **2026-10-09.** `/internals` went, and `createAudio80` became
  `createWebAudio80`. `createRhythm` became `createMetronome`, in
  `@mvtjs/utils`. Golden tests became audio tests, and `Audio80Core` became
  `Audio80Synthesiser`. `watch` gained `increased` and `decreased`. Slides
  became `u` and `d`. Patterns became multiline strings, and then rows that
  start with `|`, with `#` comments. The chunk reviews brought the page's
  sound, the speaker's fix and the home page's new budget.
  `MusicPlayer.play` now cancels any song queued. Every game's sound was
  reviewed and fixed (section 16.10). The code reached `vnext`, in commits
  `4023035` to `e3fb5f2`.
- **Remaining.** Safari, on the desktop and on iOS, is to be checked after
  the merge and deploy (step 11). The owner is to make a listening pass
  (step 13). Then 045 can be archived.
