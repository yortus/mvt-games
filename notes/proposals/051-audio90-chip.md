# Proposal: The Audio90, and Entries That Choose Their Sound Chip

> Every entry in the Arcade is given an Audio80, the eight-voice mono chip
> that 045 built in the spirit of the early 1980s. That suits most of the
> games. It cannot make the sounds of the 1990s: the metallic FM basses and
> brass of the 16-bit consoles, the sampled orchestras and choirs of their
> rivals, the supersaw leads of trance and eurodance, the squelch of acid
> house, the chopped breakbeats of jungle, the piano and organ stabs of house.
> This proposal designs a second chip, the **Audio90**: sixteen stereo voices,
> each playing one of three engines (four-operator FM, an analogue-style
> oscillator with unison and a resonant filter, or a sample), with a reverb,
> an echo, a chorus and a pump on the master. Its samples are never recorded:
> each is made in the repo, by playing the chip's own engines and keeping the
> result, as producers of the era resampled their synths. It keeps the
> Audio80's clock, its tracker notation and its audio views. And it changes
> how an entry gets its sound: the entry's starter names the chip it plays on,
> `'audio80'` or `'audio90'`, or none, and the host loads that chip and gives
> it to the entry as `sound`. A new Sound Test demo shows the chip off with
> original tunes in the styles of the decade, and Neon Monsoon, the Arcade's
> one 1990s game, is rescored on it.

**Status:** proposed. Nothing is built.

**Written:** 2026-10-16, against `vnext` at `53012eb`. Checked against
`@mvtjs/audio` as built
([`audio80.ts`](../../packages/libraries/audio/src/chip/audio80.ts),
[`audio-controls.ts`](../../packages/libraries/audio/src/chip/audio-controls.ts),
[`commands.ts`](../../packages/libraries/audio/src/core/commands.ts),
[`audio80-synthesiser.ts`](../../packages/libraries/audio/src/core/audio80-synthesiser.ts),
[`web-audio80.ts`](../../packages/libraries/audio/src/web/web-audio80.ts),
[`chip-runner.ts`](../../packages/libraries/audio/src/web/chip-runner.ts),
[`music-player.ts`](../../packages/libraries/audio/src/music-player/music-player.ts),
the notation in [`notation/`](../../packages/libraries/audio/src/notation/index.ts)),
the Arcade's sound
([`page-sound.ts`](../../packages/sites/arcade/src/runner/page-sound.ts),
[`entry-host.ts`](../../packages/sites/arcade/src/runner/entry-host.ts),
[`pixi-stage.ts`](../../packages/sites/arcade/src/runner/pixi-stage.ts),
[`headless.ts`](../../packages/sites/arcade/src/runner/headless.ts),
[`snapshot.ts`](../../packages/sites/arcade/src/snapshot.ts)), the start options
in [`entry-starter.ts`](../../packages/sites/arcade/src/entry-types/entry-starter.ts),
and every entry's `start/load.ts`. Cost figures are estimates until the
spike (section 15, step 1). The Audio80's measured cost is the base they
are scaled from.

**Related:**
[045](../archive/045-sound-chip.md) (the Audio80; its sections 3, 4.3, 6 and 7 are the design this one extends, and its section 16.4 gives the rule for naming a second chip) -
[048](../tasks/backlog/048-sound-follow-ons.md) (the Audio80's loose ends; its Sound Test entry is section 8.1 here) -
[034](../archive/034-neon-monsoon-bullet-hell.md) (Neon Monsoon, rescored in section 8.2) -
[036](../archive/036-website-arcade.md) (the Arcade and its size budget) -
[Using the Audio80](../../packages/libraries/audio/docs/using-the-audio80.md) -
[Writing Tracker Music](../../packages/libraries/audio/docs/writing-tracker-music.md) -
[Sound and Music](../../packages/sites/docs/building-with-mvt/presenting-the-world/sound.md) -
[Originality](../../packages/sites/arcade/src/entries/README.md#originality)

---

## Summary

| # | Decision | Recommendation | Section |
| --- | --- | --- | --- |
| 1 | What the chip must sound like | Both halves of the decade: the 16-bit consoles, arcades and PC sound cards, and the studio synths of house, rave, eurodance, trance, jungle, hip hop and the pop ballad. Section 2 lists the sounds, and the technique behind each | [2](#2-what-the-1990s-sounded-like) |
| 2 | What the chip is | Sixteen stereo voices. Each voice plays one of three engines: **FM** (four operators, any modulation graph, feedback, four operator waves), **analog** (up to seven detuned oscillators, a sub oscillator, noise, chord memory) or **sample**. Each voice has its own resonant filter, two envelopes and an LFO. A reverb, an echo and a chorus take sends from every voice, and a pump ducks the mix in time with a chosen channel | [3](#3-the-chip) |
| 3 | Where samples come from | Never recorded or downloaded. A sample is **bounced**: a short song played on the chip's own engines, rendered once in the entry's `load`, and kept at the sample's own rate and bit depth. Breakbeats are cut into slices | [3.5](#35-the-sample-engine-and-samples-made-in-the-repo) |
| 4 | Time | The Audio80's clock, unchanged: chip time from the ticks, a 35 ms lead, effects that skip the queue | [4](#4-time) |
| 5 | Where the code lives | In `@mvtjs/audio`, beside the Audio80. The clock, the command queue, the held writes, the tracker grammar and the headless tools are shared; the synthesiser, the instruments and the worklet are each chip's own. Each chip has its own worklet module, so a page that plays no Audio90 never downloads it | [5](#5-where-the-code-lives) |
| 6 | Names | Each chip's names carry the chip, as 045 section 16.4 foresaw: `createAudio90Instrument`, `Audio90Song` and so on. The Audio80's notation is renamed to match, in a mechanical step of its own. `createMusicPlayer` keeps its name, and takes `{ audio80 }` or `{ audio90 }` | [5.2](#52-import-paths-and-names) |
| 7 | How sounds are written | The Audio80's tracker notation, with a few tokens added: pan, chord, slice, brightness, sends and accent. A song gains a mixer (a pan and sends for each channel), its effects' settings, a pump and a character | [6](#6-writing-sounds-for-the-audio90) |
| 8 | How an entry gets a chip | Its starter names one: `soundChip: 'audio80'`, `'audio90'`, or nothing for an entry that makes no sound. The types tie the name to the `sound` option, so an Audio90 entry's views are given an `Audio90` and cannot be given anything else. The host loads the chip as it prepares the entry | [7](#7-entries-choose-their-chip) |
| 9 | The page's sound | `PageSound` keeps one audio context, and a chip slot for each kind. A kind loads the first time an entry asks for it, and stays for the page's life. The Arcade's own sounds stay on the Audio80 | [7.2](#72-the-pages-sound-a-slot-for-each-chip) |
| 10 | The demonstrations | A new **Sound Test** demo on the Audio90: a jukebox of original tunes in the decade's styles, with a scope for each voice. Then **Neon Monsoon**, rescored on the Audio90, with its effects panned by where they happen. The owner's listening pass decides whether Neon Monsoon keeps the new score | [8](#8-the-demonstrations) |
| 11 | Testing | As for the Audio80: the synthesiser in Node, audio tests that hash each rendered sound, loudness held to the same reference. The Audio80's hashes must not change through the shared refactor | [10](#10-testing) |

---

## 1. Why, and What Done Looks Like

The Audio80 was designed for the games of 1979 to the mid-1980s (045
section 16.4), and it does that well. The owner's playtests kept every
sound it makes. But the Arcade's eras run to the 2010s, and its one 1990s
game, Neon Monsoon, plays on a chip of the decade before. 045's second
playtest found Neon Monsoon "excellent" on the Audio80 and asked for "no FM
voice or detune for now". This proposal is the "later".

The 1990s are worth a chip of their own because their sound is so different
from the 1980s'. The 1980s chips made a few oscillators sing. The 1990s
had FM, which makes bells, basses and brass from sine waves; samples, which
put an orchestra into a cartridge; and, by the middle of the decade,
synthesisers that modelled analogue circuits and stacked seven oscillators
on one key. Pop music and games shared those machines. A house record and a
fighting game could use the same organ stab.

The second reason is the architecture. 045 gave every session one chip,
which made sense with one chip in the repo. With two, the question becomes
how an entry asks for the one it wants, and how the host gives an entry
exactly that, with types that keep them honest. The answer should leave
room for a third chip without another rework.

**The goals:**

- **Both halves of the decade.** A game author can make a 16-bit console
  score or a club track, on one chip, without touching Web Audio.
- **Still a chip.** Kept limits (voices, operators, sample memory, one of
  each effect), so that a busy moment has to choose, and the sound has the
  character of its machines rather than a modern studio's polish.
- **Familiar.** An author who has written for the Audio80 already knows the
  notation, the music player, the audio views and the tests. What is new is
  the instruments.
- **Chosen, not given.** An entry names its chip. An entry that names none
  is given none, and the page loads no chip it does not need.
- **Faithful to MVT, and original.** The same clock from the ticks, the same
  audio views polling bindings, and nothing recorded: every sound is made in
  the repo.

**Done looks like:** the Sound Test demo plays a set of original tunes in
the styles of the decade, from a house piano to a jungle break to a 16-bit
shooter's FM rock, each with a scope per voice. Neon Monsoon plays an FM and
sample score on the Audio90, with its explosions panned to where they are.
The other games still play on the Audio80, and sound exactly as they did
(their audio tests' hashes unchanged). The demos that make no sound are given
no chip. Pausing, the volume controls and the pause menu's previews work for
both chips. The package's docs have a guide to the Audio90, and the entries'
README says how to choose a chip.

---

## 2. What the 1990s Sounded Like

The chip is designed from the sounds back. Each row names a sound people
remember, what made it, and what the Audio90 gives for it. The machines are
named here, in the notes, to ground the design. The code and the package's
docs name none of them (section 9).

### 2.1 Games

| Sound | What made it | In the Audio90 |
| --- | --- | --- |
| The 16-bit console's FM: hard metallic basses, slap bass, brass stabs, a lead that growls like a distorted guitar | A six-voice, four-operator FM chip; operator feedback for the growl; drums as low-rate samples on a DAC | The FM engine (3.3), with feedback; the sample engine at low rates; the `console` character (3.7) |
| The rival console's samples: strings, choirs, flutes, timpani, in a lush echo, a little muffled | Eight voices of compressed samples at 32 kHz, soft interpolation, an echo with a filter in its feedback | The sample engine (3.5) with bounced samples, the echo (3.7), the `console` character's soft interpolation |
| Arcade fighting and shooting games: FM bass and brass, sampled drums and voice-like stabs, stereo | FM chips beside sample chips, panned hard | FM and sample voices together, panned (3.7) |
| PC sound cards: thin, reedy two-operator FM, with odd waveforms | Two-operator FM with half and quarter sine waves | FM with two operators and the four operator waves (3.3) |
| Tracker music from the home computers: four to eight channels of samples, arpeggios, chopped drums | Sample playback with loops, effects written per row | The sample engine with slices (3.5); the Audio80's arpeggios and step tables, kept (3.6) |
| The first CD-era consoles: more voices, reverb on everything | 24 to 32 voices and a DSP reverb | Sixteen voices and a reverb send on each (3.7) |

### 2.2 Popular music

| Style | Sounds | What made them | In the Audio90 |
| --- | --- | --- | --- |
| House | Organ and piano stabs, a four-to-the-floor kick, clap and open hat, filter sweeps | Sample-based keyboards' presets, drum machines | FM organ and piano patches, bounced into stabs; analog drums; the brightness token (6.4) |
| Rave and hardcore | The "hoover" (a growl of detuned saws that bends down), chord stabs on one key, breaks played fast | Analogue synths' detuned unison and pitch envelopes; a "chord memory" that stacks a chord on one key | Analog unison and a mod envelope on pitch (3.4, 3.6); chord memory (3.4); slices (3.5) |
| Eurodance | Bright stacked-saw leads, an offbeat octave bass, piano chords, a mix that breathes with the kick | Supersaw-style leads, sidechain compression | Analog unison; the pump (3.7) |
| Trance | The supersaw anthem lead, gated pads, long delays and reverbs | Seven detuned saws on one key; a volume gate in time with the beat | Analog unison of up to seven; an LFO in beats on volume (3.6); the echo and reverb (3.7) |
| Acid house and techno | A resonant bass that squelches, with accents and slides | A monophonic bass synth with a resonant four-pole filter, accent and slide | The per-voice 24 dB filter with its envelope, the accent token, glides (3.4, 6.4) |
| Jungle and drum & bass | Breakbeats cut up and replayed, a "reese" bass that phases slowly, a deep sub | Samplers slicing breaks; two detuned saws; a sine | Slices (3.5); analog unison with a slow detune; a sine oscillator (3.4) |
| Hip hop, trip-hop, R&B | Crunchy drums, electric piano, a deep bass drum that falls in pitch, swing | 12-bit samplers; FM electric pianos; a sine with a pitch drop | The `sampler` character and 12-bit samples (3.5, 3.7); FM keys; a pitch envelope; swing (the Audio80's, kept) |
| The ballad and new age | Glassy electric piano, bell pads, a choir's "aah", chorused strings | FM pianos and bells; sampled choirs; a chorus effect | FM bells; a choir bounced from three filtered voices (6.2); the chorus (3.7) |

Two needs run through both tables. **Stereo**: every machine of the
decade was stereo, and its music used it. **Effects as sends**: the reverb,
echo and chorus were shared, and each sound sent some of itself to them.

---

## 3. The Chip

### 3.1 What it borrows from the Audio80, and what it changes

| | The Audio80 | The Audio90 | Why |
| --- | --- | --- | --- |
| Voices | 8, mono | **16, stereo**, a pan on each | The decade's chips had 6 to 32 voices, and stereo. Sixteen leaves room for a ten-channel tune and six effects |
| What a voice plays | Triangle, saw, pulse and noise, combined; a 32-step wavetable | One of three **engines**: FM, analog or sample (3.2) | The three ways the decade made sound |
| Filters | Two, shared by the voices routed to them | **One per voice**, 12 or 24 dB an octave, low, band and high pass, with drive | Acid basses and filter sweeps on pads need each voice's own. Sharing two was a 1980s limit |
| Envelopes | One ADSR | **Two** ADSRs (volume, and a mod envelope for pitch, cutoff or brightness), and each FM operator has its own | Every synth of the decade had a filter envelope. FM needs one per operator |
| Modulation | Vibrato, sweeps and step tables, run by the chip's driver at 60 Hz | The same driver, plus one **LFO** per voice (pitch, cutoff, volume, pan), whose rate may be in beats | Tremolo, wobble and the trance gate. The driver's arpeggios stay, for the game side |
| Effects | One echo, mono | A stereo **reverb**, a stereo **echo** (ping-pong if wanted, its time in ms or beats) and a **chorus**, each a send from every voice | The decade's mix. Reverb was everywhere |
| Master | Volume, a soft clip, a character | A **pump** (the mix ducks on each note of one channel), volume, a soft limiter, a character (3.7) | Eurodance and French house breathed with the kick |
| Samples | None | A sample engine, with **samples made in the repo** (3.5) | The decade's sound. Section 9 keeps it original |
| Character | `clean`, `classic`, `raw` | `studio`, `console`, `sampler` | Each names the kind of machine it sounds like |
| Clock, notation, music player, audio views, controls | | **The same** | So nothing else changes for the author or the host |

The Audio80 stays as it is. It stays mono (settled in 045; do not reopen
without new information), and its sounds stay byte for byte the same.

### 3.2 Voices and engines

Each of the sixteen voices plays one note at a time, like the Audio80's. An
instrument says which engine a voice runs while it plays that instrument's
note. So one voice can play an FM bass, then a sampled snare. Every voice has
the same stages after its engine:

```
engine (FM | analog | sample)
   -> filter (per voice; bypassed by default for FM)
   -> volume envelope x note volume
   -> pan (constant power)
   -> dry mix, and sends to reverb, echo and chorus
```

Each voice also has a **mod envelope** and an **LFO** (3.6), and the 60 Hz
driver the Audio80's instruments use (arpeggios, step tables, sweeps).

### 3.3 The FM engine

FM, frequency modulation, makes a sound by letting one sine wave, the
**modulator**, push another, the **carrier**, faster and slower many times a
cycle. A gentle push adds a few overtones; a hard one adds many. With each
operator's level on its own envelope, a sound can start bright and mellow
as it fades, which is how FM pianos, bells and basses work. An **operator**
is one such oscillator with its own envelope.

- **Four operators** a voice. Each has a **ratio** to the note's pitch
  (0.5 to 16, in halves; whole ratios sound harmonic, others bell-like), or
  a fixed pitch in Hz for drums and effects; a **detune** in cents; a
  **level**; an ADSR **envelope**; **velocity** sensitivity, so a note
  played harder is brighter; and **rate scaling**, so high notes fade faster,
  as on a real piano.
- **The algorithm** is written as a graph, not a number: `'2>1 4>3'` means
  operator 2 modulates 1 and 4 modulates 3, and the operators that modulate
  nothing (1 and 3) are heard. Any graph in which an operator only modulates
  lower-numbered ones is allowed. That covers every classic layout and
  copies no chip's table of them.
- **Feedback** on one operator, which modulates itself. A little makes a saw
  from a sine; a lot makes the noisy growl of FM guitars.
- **Operator waves**: `sine`, `half-sine` (the top half only), `abs-sine`
  (both halves, upwards) and `quarter-sine` (the rising quarters, in pulses).
  These give two-operator patches their reedy PC sound card colour.
- **Brightness**: one number, set by the `f` token and the mod envelope,
  scales every modulator's level at once. So a pattern can open an FM sound
  as it opens an analog one's filter (6.4).

The filter is bypassed by default for FM, which rarely needs one, but an
instrument can turn it on.

### 3.4 The analog engine

The analog engine models the synthesisers that followed analogue circuits,
whose sound defined dance music from acid house to trance.

- **Oscillator A**: `saw`, `pulse`, `triangle` or `sine`, with a pulse
  width that can be swept or moved by the LFO.
- **Unison**: up to seven copies of oscillator A, detuned apart (`detune`,
  0 to 1) and spread across the stereo field (`spread`, 0 to 1). Seven saws
  is the supersaw of trance and eurodance; two slowly drifting ones is the
  reese bass of drum & bass.
- **Chord memory**: unison copies can instead be tuned to a chord, set by the
  instrument or by the pattern's `c` token (`c47` stacks the note, a major
  third and a fifth). This is the rave stab, a whole chord from one voice.
- **Oscillator B**, at an interval from A (`interval`, in semitones, with a
  fine detune), with **hard sync** to A for the tearing sweeps of the era's
  leads.
- **A sub oscillator** (a square or sine an octave below) and **noise**
  (white, or the Audio80's pitched noise), each with a level.
- **Accent**: a note marked with `!` (6.4) opens the filter envelope further
  and plays louder, as on the acid basses.
- **Glide**, the Audio80's `>` token and instrument option, slides into a
  note. An analog instrument's `legato` option glides only when notes
  overlap, which is how acid lines slide.

### 3.5 The sample engine, and samples made in the repo

A **sample** is a stored recording of a sound, played back faster for
higher notes and slower for lower ones. The sample engine plays one sample
a voice, from a start point, with an optional **loop** (forward, or back
and forth), **reverse**, and **slices**: the sample cut into equal parts,
of which a note plays one. Slices are how the decade's producers cut up a
drum break and replayed it in a new order.

**A sample is never recorded or downloaded.** Every sample is **bounced**:
the chip plays a short song on its own engines, and keeps what it rendered.
This was a technique of the era too, called resampling, and it does things
that playing the engines live cannot:

- **One voice for many.** An orchestra hit bounced from a brass chord, a
  string chord and a burst of noise costs one voice to play, not nine.
- **The sampler's sound.** A bounced sound played two octaves down slows
  and darkens, its overtones moving with its pitch, which is the sound of
  pitched-down samples in hip hop and jungle. Playing the engines at that
  pitch sounds nothing like it.
- **Breakbeats.** An original break, programmed from analog and FM drums
  with some swing and ghost notes, bounced, then sliced and replayed fast.
- **Lo-fi.** A sample keeps its own **rate** (8 to 32 kHz) and **bits** (8,
  12 or 16), set when it is made. 12 bits at 26 kHz is the grit of the
  era's hip hop samplers.

A sample is defined with `createAudio90Sample` (6.2), which records what to
bounce. It is rendered once, on the main thread, the first time
`prepareAudio90Samples` is called with it. An entry calls that in its
`load`, which already loads its textures, so rendering is part of loading.
The rendered data is sent to the worklet the first time a note uses it, as
instruments are, and kept until the chip is reset. A sample played before it
is prepared is rendered then, with a warning in development, since it may
cost a frame.

Rendering on the main thread puts the Audio90's synthesiser in the entry's
code chunk as well as the worklet's. Only entries that bounce samples pay
for it, and entry chunks load on launch, not with the home page (section
11). Section 13 rules out the other places a bounce could happen.

### 3.6 Envelopes, the LFO and the driver

- **The volume envelope** is an ADSR in milliseconds, exponential in its
  decay and release, as the Audio80's is.
- **The mod envelope** is a second ADSR, with an amount sent to any of
  **pitch** (in semitones: an 808-style bass drum falling an octave, a
  hoover bending down), **cutoff** (in octaves) and **brightness** (FM).
- **The LFO** is a low-frequency oscillator: `sine`, `triangle`, `square`,
  `saw` or `random` (a new random level each cycle). Its rate is in Hz, or in
  beats of the song playing (`rateBeats: 1 / 4` for sixteenth notes). It is
  sent to pitch, cutoff, brightness, volume or pan. A square LFO in
  sixteenths on volume is the trance gate. It can start after a delay, and
  restart with each note or run free.
- **The driver** is the Audio80's: arpeggios, step tables, pulse and filter
  sweeps, at 60 steps a second (045 section 2.6). It is shared code (5.1),
  and its step tables gain the Audio90's columns (pan, slice, brightness).

### 3.7 Stereo, effects, the pump and the output stage

- **Pan**, from -1 (left) to 1 (right), set by the instrument, the song's
  mixer, the pattern's `P` token, the LFO, or the sound effect's play call
  (5.3). The pan law is constant power, so a sound keeps its loudness as it
  moves.
- **The reverb** is a stereo room, from a small booth to a hall: `size`,
  `decayMs`, `damping` (how fast the highs fade) and `level`. It is a
  network of delays and filters written in the repo, in the plain style of
  the 1990s' digital reverbs, not a modern one.
- **The echo** is stereo: a `timeMs` or a `timeBeats`, `feedback`, a filter
  on its repeats (`toneHz`, which darkens each repeat, as tape and the
  consoles' echoes did), `pingPong` (repeats alternate left and right), and
  `level`.
- **The chorus** is two slowly moving short delays, one a side, for the
  width of the era's pads, strings and electric pianos: `depth`, `rateHz`,
  `level`.
- **The pump** ducks every voice but one channel's, each time that channel
  starts a note: `channel`, `depth` (0 to 1) and `releaseMs`. It is driven by
  the notes, not by listening to the sound, so it costs almost nothing and
  is the same every time. Sound effects are not ducked.
- **The output stage**: the dry mix and the effects' returns, the master
  volume, then a gentle limiter, so that sixteen voices and three effects at
  full volume do not clip.

**The character** sets how much of a machine's grit survives. A song sets it
as it starts, so a game can move from a console's sound to a club's:

| Character | FM | Samples | Output | For |
| --- | --- | --- | --- | --- |
| `studio` (default) | Clean | Smooth interpolation | Full resolution | Pop and dance music, a polished record |
| `console` | Output quantised to 9 bits, with a small step where the wave crosses zero, which gives 16-bit console FM its edge | Soft interpolation that dulls the highs, as one 16-bit console's did | 16 bits | Game soundtracks of the early and middle decade |
| `sampler` | Clean | Each sample's own bits and rate kept exactly, with no smoothing | A little saturation | Hip hop, trip-hop, jungle |

### 3.8 Kept limits

Limits that make it a chip, and make a busy moment choose:

- **Sixteen voices**, shared by music and effects, as on the Audio80.
- **Four operators** a voice, **seven unison** copies a voice, and an
  **oscillator budget** of 48 oscillators across the chip. A song that
  plays three supersaw chords at once spends 21 of them. A note that would
  pass the budget plays with fewer unison copies, so it never goes silent.
  The budget also bounds the cost (section 11).
- **Sample memory**: 512 KB a session, which is 8 seconds at 32 kHz and 16
  bits, or 16 seconds at 16 kHz. `prepareAudio90Samples` throws if an entry's
  samples need more, naming them.
- **One of each effect**, shared by every voice.
- Instruments still step at **60 Hz** for their driver.

### 3.9 What it does not have

No recorded or downloaded sound of any kind. No MIDI. No effects chain per
voice beyond its filter. No convolution reverb (it would need a recorded
room). No time-stretching (slices do what the era did instead). No voice
synthesis beyond the vowel sounds a bounced, filtered choir makes. No
surround or 3D sound. Each would be a reasonable addition one day; none is
needed to sound like the decade, and each makes the chip less of a chip.

---

## 4. Time

The Audio90 keeps the Audio80's clock exactly (045 section 3). The host
advances it once a tick by the models' `deltaMs`, never while the entry is
paused. Each write is stamped with a chip time. The worklet plays a steady
35 ms behind the newest time it has been given, never past it, and runs dry
with a short fade when the ticks stop. Sound effects skip the queue. The
clock is shared code (5.1), so the Audio90 is born with its simulation tests.

What the Audio90 adds to time:

- **Beats.** The LFO and the echo can take their rate or time in beats, so
  the music player tells the chip the tempo with each song's start and each
  change of `tempoScale`, as a stamped write. A held song (a `tempoScale` of
  0) holds the LFOs that follow its beat.
- **The pump** starts on each note of its channel at the note's stamp, so
  it is sample-accurate and paused with everything else.
- **Samples** are sent once, as instruments are. They are larger (up to 512
  KB a session), so they are posted as soon as they are first used, not with
  the tick's batch, and a note that uses a sample still on its way waits for
  it, at most a few milliseconds. The spike measures it (step 1).

---

## 5. Where the Code Lives

### 5.1 What is shared, and what is each chip's

The Audio80's code divides cleanly. Some of it is about chips in general;
the rest is about the Audio80. The first step (15, step 2) moves the general
part into a folder of its own, with the Audio80's audio tests guarding it:
not one hash may change.

```
packages/libraries/audio/src/
├── index.ts             @mvtjs/audio: both chips' notation, the music player, the types
├── shared/              What every chip uses
│   ├── command-queue.ts         Stamped commands, in order
│   ├── command-writer.ts        The main thread's preallocated command buffer (from chip/command-audio80.ts)
│   ├── audio-controls.ts        The controls interface, the same for every chip
│   ├── notes.ts                 Note names and numbers
│   ├── tracker/                 The pattern grammar: rows, cells, tokens, order, loops, errors
│   └── driver.ts                The 60 Hz instrument driver: arpeggios, step tables, sweeps
├── audio80/             The Audio80, moved from core/, chip/ and notation/
│   ├── synthesiser/  notation/  chip/
├── audio90/             The Audio90
│   ├── synthesiser/             Voices, the three engines, filters, envelopes, LFOs, effects, the pump
│   ├── notation/                Instruments, samples, effects, songs
│   ├── chip/                    The Audio90 interface and its command writer
│   └── bounce.ts                Renders a sample's song on the main thread
├── music-player/        One player, for either chip (6.5)
├── headless/            @mvtjs/audio/headless: both chips' headless versions, rendering, loudness, hashes, WAV
└── web/                 @mvtjs/audio/web: the clock, the held writes, one runner and processor per chip
    ├── chip-clock.ts  held-writes.ts  chip-runner.ts
    ├── audio80-processor.ts  web-audio80.ts
    └── audio90-processor.ts  web-audio90.ts
```

**Each chip has its own worklet module.** `audio90-processor.ts` bundles
only the Audio90's synthesiser, and is loaded with `addModule` only when an
entry asks for the Audio90. A page that plays only Audio80 entries never
downloads it. `chip-runner.ts` is shared, made generic over a synthesiser
interface that both chips' synthesisers satisfy (`enqueue`, `render`,
`reset`, `setMix`, and the define calls), and renders one channel or two.

### 5.2 Import paths and names

The three import paths stay: `@mvtjs/audio` (what games use, and runs
anywhere), `@mvtjs/audio/web` and `@mvtjs/audio/headless`. Each holds both
chips. Named exports are trimmed by every bundler the repo uses (045 section
16.4 measured it), so an Audio80 entry carries none of the Audio90's
notation.

045 section 16.4 kept plain names for the notation "if a second chip can
share them, and if it can't, they are renamed then". The Audio90 cannot
share them: its instruments have operators and engines, its songs have a
mixer. So **each chip's names carry the chip**:

| Audio80, today | Audio80, renamed | Audio90 |
| --- | --- | --- |
| `createInstrument`, `Instrument` | `createAudio80Instrument`, `Audio80Instrument` | `createAudio90Instrument`, `Audio90Instrument` |
| `createSoundEffect`, `SoundEffect` | `createAudio80SoundEffect`, `Audio80SoundEffect` | `createAudio90SoundEffect`, `Audio90SoundEffect` |
| `createSong`, `Song` | `createAudio80Song`, `Audio80Song` | `createAudio90Song`, `Audio90Song` |
| | | `createAudio90Sample`, `Audio90Sample`, `prepareAudio90Samples` |
| `computeSongDurationMs` | unchanged, takes either song | |
| `createMusicPlayer` | unchanged, takes `{ audio80 }` or `{ audio90 }` (6.5) | |

The rename is mechanical: ten games' `data/` files, the Arcade's sounds,
the audio tests, the docs. It is its own step (15, step 3), so its diff is
nothing but names. Section 14 asks whether to rename, or to let plain names
mean the Audio80.

Every sound also carries a `chip` field, `'audio80'` or `'audio90'`. The
types are shaped differently anyway, but the field makes the type error
read plainly when an Audio80 sound is played on an Audio90, and lets the
music player and the headless tools tell them apart.

### 5.3 The API

What an Audio90 entry's views see. It follows the Audio80's, method for
method, with stereo and effects added. Its methods take their arguments in
order, for the same reason: views call them every refresh, and they must not
allocate.

```ts
export interface Audio90 {
    /** The chip's clock, in ms: the sum of the deltas the game loop has advanced it by. */
    readonly time: number;
    /** How many voices the chip has, which is 16. */
    readonly voiceCount: number;
    /**
     * Plays `effect` now, on a voice the chip chooses from those the music
     * does not keep, as the Audio80 does. `pan` is from -1 (left) to 1
     * (right), and defaults to the effect's own.
     */
    play: (effect: Audio90SoundEffect, pan?: number) => void;
    noteOn: (voice: number, instrument: Audio90Instrument, note: number, volume: number, atMs?: number) => void;
    noteOff: (voice: number, atMs?: number) => void;
    /** Sets one of a voice's settings, such as `'pan'`, `'brightness'` or `'reverbSend'`, at `atMs`. */
    setVoice: <S extends Audio90VoiceSetting>(voice: number, setting: S, value: Audio90VoiceSettingValue<S>, atMs?: number) => void;
    /** Sets one of an effect's settings: the reverb's, the echo's, the chorus's or the pump's. */
    setEffect: <E extends Audio90EffectId>(effect: E, setting: Audio90EffectSetting<E>, value: number, atMs?: number) => void;
    /** Sets how the chip sounds, at `atMs`. */
    setCharacter: (character: Audio90Character, atMs?: number) => void;
    reserveVoices: (count: number, atMs?: number) => void;
    releaseAll: () => void;
}
```

**Panning an effect** is how an audio view puts an explosion where it is.
The pan is presentation, computed by the view from the domain's position,
as a Pixi view computes pixels from it:

```ts
if (w.explosionsStarted.increased) {
    sound.play(EXPLODE, toPan(explosionCol(), PLAYFIELD_COLUMNS));
}
```

**The controls are unchanged.** `AudioControls` was made the same for every
chip (045 section 16.4) so that a host drives any chip alike. The Audio90's
factories return `{ audio90, controls }`, as an `Audio90WithControls`.

### 5.4 The worklet, in a browser

`createWebAudio90({ context })` mirrors `createWebAudio80`: a command writer
on the main thread, one `postMessage` a tick with the batch transferred and
a spare taken back, instruments and samples sent on first use, held writes
while the context cannot play, `ready` resolving once the worklet runs. Its
node has two output channels, not one. Both chips can run on one audio
context at once, each its own worklet node, as the page's two Audio80s do
now.

### 5.5 Headless

`createHeadlessAudio90(options?)` mirrors `createHeadlessAudio80`: silent by
default, `{ record: true }` for a log of every write, `{ render: true }` to
play the writes in memory, now into two channels. The render tools
(`renderSong`, `renderSoundEffect`, `hashSamples`, `measurePeak`,
`measureLoudness`, `encodeWav`, `findSounds`) take either chip's sounds and
work in stereo. Loudness is measured as ITU-R BS.1770 measures stereo, the
two channels' power summed, so an Audio90 song and an Audio80 song at the
same reference sound equally loud. `npm run audio:render` renders either.

---

## 6. Writing Sounds for the Audio90

### 6.1 Instruments

An instrument names its engine, and the engine's options. Every option has a
default, so a plain instrument is short. The patches below are sketches of
the techniques, not presets copied from any machine.

```ts
/** A soft electric piano: a bell-like tine over a warm body, brighter the harder it is struck. */
export const KEYS = createAudio90Instrument({
    engine: 'fm',
    // Operator 2 modulates 1, and 4 modulates 3. Operators 1 and 3 are heard
    algorithm: '2>1 4>3',
    operators: [
        { ratio: 1, envelope: { attackMs: 2, decayMs: 1800, sustain: 0.2, releaseMs: 300 } },
        { ratio: 1, level: 0.3, velocity: 0.8, envelope: { attackMs: 0, decayMs: 900, sustain: 0.1, releaseMs: 200 } },
        { ratio: 1, level: 0.6, detuneCents: 7, envelope: { attackMs: 2, decayMs: 1200, sustain: 0.1, releaseMs: 300 } },
        { ratio: 11, level: 0.12, velocity: 1, envelope: { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 60 } },
    ],
    rateScaling: 0.4,
    chorus: 0.4,
    reverb: 0.25,
});

/** A trance lead: seven saws, spread wide and detuned, through a filter left open. */
export const ANTHEM = createAudio90Instrument({
    engine: 'analog',
    oscillator: { wave: 'saw', unison: 7, detune: 0.3, spread: 0.8 },
    filter: { mode: 'lowpass24', cutoffHz: 6000, resonance: 0.1 },
    envelope: { attackMs: 5, decayMs: 300, sustain: 0.8, releaseMs: 450 },
    echo: 0.3,
    reverb: 0.35,
});

/** A squelching bass: one saw into a resonant filter that snaps shut, with accents and slides from the pattern. */
export const SQUELCH = createAudio90Instrument({
    engine: 'analog',
    oscillator: { wave: 'saw' },
    filter: {
        mode: 'lowpass24', cutoffHz: 350, resonance: 0.85, drive: 0.4,
        envelope: { octaves: 3, decayMs: 180 },
        accent: 0.6,
    },
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 20 },
    legato: { glideMs: 60 },
});

/** A deep bass drum: a sine that falls two octaves as it starts, long enough to be a bass line too. */
export const BOOM = createAudio90Instrument({
    engine: 'analog',
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 0, decayMs: 900, sustain: 0, releaseMs: 200 },
    modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 0 } },
    note: 'C-2',
});
```

`createAudio90Instrument` checks its options when the module loads, and
throws with the option's path on a mistake (`operators[3].ratio: 0.3 is not
a multiple of 0.5`), as the Audio80's instruments do.

### 6.2 Samples

A sample is a song to bounce, and how to keep what it renders:

```ts
/** An orchestra hit: a brass chord, a string chord and a crack of noise, all at once, kept as one sound. */
export const ORCHESTRA_HIT = createAudio90Sample({
    rate: 32000,
    bits: 16,
    rootNote: 'C-4',
    bounce: createAudio90Song({
        bpm: 120,
        instruments: { B: BRASS, S: STRINGS, n: CRACK },
        patterns: {
            hit: `
                # brass      | strings    | noise
                | C-4 B c47  | C-5 S c47  | n
                | ===        | ===        | ...
            `,
        },
        order: ['hit'],
    }),
    lengthMs: 700,
});

/** An original two-bar break, programmed with swing and ghost notes, cut into sixteenths to replay in any order. */
export const BREAK = createAudio90Sample({
    rate: 26000,
    bits: 12,
    bounce: BREAK_PATTERN,
    slices: 32,
});

/** A choir's "aah": three voices of a buzzy pulse, each through a band-pass filter at one of the vowel's resonances. */
export const CHOIR = createAudio90Sample({
    rate: 32000,
    bits: 16,
    rootNote: 'A-3',
    bounce: CHOIR_AAH_SONG,
    lengthMs: 1200,
    loop: { fromMs: 400, toMs: 1150, isPingPong: true },
});
```

An instrument plays a sample with `engine: 'sample'`:

```ts
export const DRUMS = createAudio90Instrument({ engine: 'sample', sample: BREAK, envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 } });
```

In the entry's `load`, beside its textures:

```ts
await textures.load();
prepareAudio90Samples([ORCHESTRA_HIT, BREAK, CHOIR]);
```

### 6.3 Sound effects

As on the Audio80: an instrument and a note, with a length and an optional
glide, or a step table. The Audio90 adds a `pan`, which `play` can override.

```ts
/** A large explosion: the deep drum under a falling burst of filtered noise, with a long tail of reverb. */
export const EXPLODE = createAudio90SoundEffect({
    instrument: BLAST,
    note: 'C-3',
    lengthMs: 900,
    priority: 2,
    maxVoices: 3,
    reverb: 0.5,
});
```

### 6.4 Songs, and the tokens the Audio90 adds

Every token of the Audio80's notation keeps its meaning
([Writing Tracker Music](../../packages/libraries/audio/docs/writing-tracker-music.md)):
notes, `...`, `===`, instrument letters, `v` volume, `a` arpeggio, `~`
vibrato, `>` glide, `u` and `d` slides, `p` pulse width, `f` filter. The
Audio90 adds:

| Token | Meaning | Example |
| --- | --- | --- |
| `P` + two hex digits | Pan: `P00` is hard left, `P80` the centre, `PFF` hard right | `P40` |
| `c` + two hex digits | Chord memory, on an analog instrument: the note, up x semitones and up y, at once | `c47` (major), `c37` (minor) |
| `s` + two hex digits | Plays slice n of a sample instrument | `s0C` |
| `f` + hex digit | Brightness: the filter's cutoff on analog and sample voices, the modulators' level on FM ones | `f4` |
| `r` + hex digit | The reverb send | `r6` |
| `e` + hex digit | The echo send | `e3` |
| `!` | Accent: on an analog instrument, the filter envelope opens further and the note plays louder | `C-2 Q !` |

A one-letter instrument name and a token never clash, since every token is
a letter followed by hex digits, or a symbol.

A song gains:

- **`mixer`**: one entry per channel, with its starting `pan` and its sends.
  The pattern's tokens change them as it plays.
- **`reverb`**, **`echo`** and **`chorus`**: the effects' settings as the
  song starts.
- **`pump`**: `{ channel, depth, releaseMs }`.
- **`character`**: how the chip sounds while the song plays.
- **Up to sixteen channels**, though ten leaves room for effects.

```ts
/** The Sound Test's eurodance study, its drop: a chord stab, an offbeat bass, a piano on both sides, and a pumping kick. */
export const DROP = createAudio90Song({
    bpm: 136,
    instruments: { S: STAB, B: OCTAVE_BASS, K: KEYS, k: BOOM, c: CLAP, h: HAT },
    mixer: [
        { pan: 0, reverb: 0.3 },      // stab
        { pan: 0 },                   // bass
        { pan: -0.4, chorus: 0.3 },   // piano, left
        { pan: 0.4, chorus: 0.3 },    // piano, right
        { pan: 0 },                   // drums
    ],
    pump: { channel: 4, depth: 0.5, releaseMs: 200 },
    reverb: { size: 0.6, decayMs: 1800, damping: 0.4, level: 0.4 },
    character: 'studio',
    patterns: {
        drop: `
            # stab       | bass   | piano L    | piano R    | drums
            # ------------------------------------------------------
            | A-4 S c37  | A-1 B  | ...        | ...        | k
            | ...        | A-2    | E-5 K      | A-5 K      | h
            | ===        | A-1    | ...        | ...        | k
            | ...        | A-2    | C-5 K      | E-5 K      | c
        `,
    },
    order: ['drop'],
    loop: 0,
});
```

The parser's errors name the pattern, the row and the channel, as the
Audio80's do (`song: pattern 'drop', row 3, channel 0: c37 needs an analog
instrument, and 'S' is FM`).

### 6.5 The music player

One player, for either chip. Its option names the chip, and its type
follows:

```ts
const music = createMusicPlayer({ audio90: sound });   // a MusicPlayer<Audio90Song>
music.play(DROP);
```

The interface is the Audio80's player's (`song`, `isPlaying`, `beat`,
`tempoScale`, `play`, `queue`, `stop`, `update`, `refresh`), made generic
over the song type. Its timing (rows, order, loops, swing, stamping each
write at its exact chip time) is shared; what a cell writes is each chip's.
The Audio90's player also writes the tempo to the chip, for beat-synced LFOs
and echoes (section 4). An audio view moves from one chip to the other by
changing its `sound` binding's type, its sounds, and this one option.

---

## 7. Entries Choose Their Chip

### 7.1 The declaration

Today every session is given an `Audio80` as `sound`, whether it plays
anything or not. With two chips, the entry says which it plays on, in its
starter. The starter is the right place, rather than `entry.ts`'s metadata:
it is the code that uses the chip, it is loaded before the host prepares
the entry, and the types can tie it to `start`'s options.

```ts
/** The sound chips an entry can play on. */
export type SoundChipKind = 'audio80' | 'audio90';

/** The chip of each kind, as an entry's audio views see it. */
export interface SoundChipsByKind {
    readonly audio80: Audio80;
    readonly audio90: Audio90;
}

/**
 * What a starter says about its sound. An entry that plays on a chip names
 * it, and is given that chip as `sound`. An entry that makes no sound names
 * none, and is given none.
 */
export type SoundChoice<K extends SoundChipKind | undefined> = K extends SoundChipKind
    ? { readonly soundChip: K }
    : { readonly soundChip?: undefined };

/** The `sound` start option that goes with each choice. */
export type SoundOption<K extends SoundChipKind | undefined> = K extends SoundChipKind
    ? { readonly sound: SoundChipsByKind[K] }
    : { readonly sound?: undefined };
```

`PixiEntryStarter`, `ElementEntryStarter` and their start options take the
chip kind as a type parameter, and become type aliases, so `soundChip` can be
required exactly when the entry plays on a chip. `EntryStarter` is the union
over every kind, so the host narrows a starter by its `soundChip`:

```ts
export type PixiEntryStarter<K extends SoundChipKind | undefined = SoundChipKind | undefined> =
    PixiStarterFields<K> & SoundChoice<K>;

export type PixiStartOptions<K extends SoundChipKind | undefined> =
    StartOptions & SoundOption<K> & { readonly stage: Container; readonly host?: PixiHost };

export type EntryStarter =
    | PixiEntryStarter<'audio80'> | PixiEntryStarter<'audio90'> | PixiEntryStarter<undefined>
    | ElementEntryStarter<'audio80'> | ElementEntryStarter<'audio90'> | ElementEntryStarter<undefined>;
```

An entry says its chip twice, in its type and in its field, and TypeScript
checks they agree:

```ts
export async function load(): Promise<PixiEntryStarter<'audio90'>> {
    await textures.load();
    prepareAudio90Samples(SAMPLES);
    return {
        kind: 'pixi',
        soundChip: 'audio90',
        // ...
        start({ stage, sound, bestScore }) {   // sound: Audio90
            const gameView = GameView({ model: gameModel, sound, bestScore });
            // ...
        },
    };
}
```

What this buys:

- **A view cannot be given the wrong chip.** An Audio90 audio view's
  `sound: Audio90` binding cannot take an Audio80, and the start option it
  is fed from is typed by the declaration.
- **A silent entry has nothing to ignore.** The boids, the falling sand and
  the other demos that make no sound declare nothing, and their start
  options have no `sound`.
- **Forgetting is a type error.** An entry that destructures `sound` without
  declaring a chip finds it typed `undefined`, and its audio view's binding
  rejects it.
- **A third chip** is one more key in `SoundChipsByKind` and one more slot in
  the page's sound.

### 7.2 The page's sound: a slot for each chip

`PageSound` (in `runner/page-sound.ts`) keeps its one audio context, made
in the visitor's first gesture, and its chip slots, which stand in for a
chip until it loads (045 section 7.1). What changes:

- **A slot for each kind of entry chip**, made empty: `entryChips.audio80`
  and `entryChips.audio90`, each an `Audio80WithControls` or
  `Audio90WithControls`. `pageAudio80` and `pageControls` stay as they are.
- **`prepare(kind?)`** makes the context as now, then loads the chip of the
  kind asked for, the first time it is asked for. The first gesture still
  prepares the page's own Audio80. The Audio90 loads the first time an
  Audio90 entry is prepared, in the same `prepare` call the host already
  awaits beside its renderer. Adding a worklet module to a running context
  needs no gesture, so a chip can load after the first one.
- **A loaded chip stays for the page's life**, its node connected and idle.
  An idle chip has run dry, so its worklet renders silence at almost no
  cost. The spike measures that cost (step 1); if it is not near zero, the
  slot disconnects the node between sessions.
- **The settings** (the music and effects volumes) go to every slot, loaded
  or not, as they go to both chips now.

### 7.3 The entry host and the Pixi stage

The entry host drives one session's chip, whichever it is. `AudioControls`
is the same for every chip, so the tick does not change shape:

- `prepare(starter)` awaits `sound.prepare(starter.soundChip)` beside the
  renderer, as it awaits `sound.prepare()` now.
- `start` picks the slot for `starter.soundChip`, resets its controls, and
  passes its chip as `sound`. For a starter with no chip, it passes no
  `sound`, and the session's controls are a shared set that does nothing.
  The host keeps the session's controls in a variable, so the tick reads one
  variable rather than branching.
- The tick calls `controls.update(deltaMs)` with the models, never while
  paused, and `controls.flush()` after `refreshView`, as now.
- `stop` resets the controls the session used.
- The Pixi stage takes the session's controls as its session changes,
  rather than one chip and its controls when it is made.

### 7.4 Headless starts

Thumbnails (`snapshot.ts`), the visual tests, the scoring test and the
`games-and-demos` benchmark start entries headless, each with
`createHeadlessAudio80()` today. They gain one helper in
`runner/headless.ts`:

```ts
/** Makes the headless chip that `starter` plays on, and its controls, or none for an entry with no sound. */
export function createHeadlessSound(starter: EntryStarter): HeadlessSound;
```

`startPixiHeadless` and `advanceHeadless` take what it returns. So no
headless caller names a chip, and a new chip needs no change to them.

### 7.5 What each entry declares

| Entry | Declares | Why |
| --- | --- | --- |
| Astrovoid, Burrow Bust, Crumb Chase, Dojo Duel, Fenceline, Fruit Machine, Fuel Run, Galaxy Raiders, Kwazy Cactii | `'audio80'` | They have sound on it now, and it suits them |
| Neon Monsoon | `'audio80'`, then `'audio90'` once rescored (8.2) | The Arcade's 1990s game |
| Sound Test (new) | `'audio90'` | Section 8.1 |
| Boids, Boids 3D, Falling Sand, Fractalscope, Reordering Lists | nothing | They make no sound |

The choice is the entry's, not its era tag's. Kwazy Cactii is tagged as
the 2000s and plays on the Audio80, and a 1980s game could pick the Audio90
for an arcade board's sound. The entries' README gives a rule of thumb: the
Audio80 for the late 1970s to the late 1980s, the Audio90 for the late 1980s
to the turn of the century.

### 7.6 The Arcade's own sounds stay on the Audio80

The home page's ticks, pops and the pause menu's previews play on the page's
own Audio80, which loads on the first press. They stay there: they are
small, they suit it, and moving them would put the Audio90 on the home
page's first press, against its size budget. The pause menu's music preview
for an Audio90 entry plays an Audio80 phrase; it previews a level, not a
sound, so this is acceptable. Section 14 asks whether it should be the
entry's own chip.

---

## 8. The Demonstrations

### 8.1 Sound Test

A new demo entry, `sound-test`, an `element` or Pixi entry (whichever suits
its scopes; Pixi is likely), tagged `demo`, era `1990s`. It is 048's Sound
Test idea, for the Audio90 first. It shows the chip off, covers the pop half
of the decade that no game would, and gives composers a page with hot
reload.

- **A jukebox** of original tunes, each a short study of one style, about a
  minute long and looping: a house piano tune, a eurodance drop, a trance
  breakdown and build, an acid line, a jungle tune on a sliced break, a
  trip-hop groove, a ballad on FM keys and choir, a 16-bit shooter's FM
  rock, a 16-bit role-playing game's overworld on sampled strings and
  echo, a fighting game's stage, and a PC sound card tune on two-operator
  FM.
- **A scope for each voice**: its waveform, its pan and its level, drawn
  from what the chip reports. The chip's worklet would send a few numbers a
  voice back each block for this. That is a new reply message, behind an
  option, so no other entry pays for it. If that is too much, the scopes
  draw from a headless render of the same writes on the main thread, which
  is deterministic and so matches.
- **An effects page**: every sound effect in the Sound Test's set, played
  with a pan the visitor chooses.
- **Each tune names its techniques** in the info panel, as the demos'
  `techniques` do: "four-operator FM electric piano", "seven-voice unison
  lead", "a break bounced from analog drums and sliced".

Its model is the jukebox's state (which tune, which page, playing or not).
Its audio view plays what the model says, so it follows the MVT rules like
any other entry.

### 8.2 Neon Monsoon, rescored

Neon Monsoon is a bullet hell shooter in the style of the 1990s. The
genre's sound is the 16-bit console's FM rock and the arcade's FM and
samples. So it is rescored on the Audio90:

- Its two themes, stage and boss, and its jingles, rewritten for the chip:
  FM bass and lead, sampled drums from a bounced kit, an orchestra hit for
  the warning, in the `console` character.
- Its effects, panned by where they happen: explosions, grazes and pickups
  by their column. The bindings gain the position each needs, as numbers
  already in the model.
- Its audio view's structure stays: the same watched states and counts, the
  same metronomes for repeating sounds.

The owner found Neon Monsoon's Audio80 sound excellent (045 section 16.5).
So the rescore is done on a branch and judged by ear beside the current one.
If it does not beat it, Neon Monsoon declares `'audio80'` and keeps its
score, and the Sound Test is the only demonstration. Section 14 records this
as open.

---

## 9. Originality

The entries' originality rules cover sound as they cover pictures. For the
Audio90 they mean:

- **No recorded sound.** Every sample is bounced from the chip's own engines
  by code in the repo (3.5). No drum break, vocal, orchestra or loop from a
  record, a sample library or a sound font, and no famous break recreated
  hit for hit.
- **No copied patches.** Instruments are designed from scratch. No factory
  preset of any synthesiser is transcribed, even where the technique (an FM
  piano's tine, seven detuned saws) is common knowledge.
- **No real chip's design copied.** The FM algorithms are a graph the author
  writes, not a chip's numbered table. No register map, no envelope rate
  table, no filter curve, no reverb algorithm taken from a chip or an
  emulator. Emulators' code is GPL, and an emulator is not the goal (045
  section 13).
- **Styles, not songs.** The Sound Test's tunes are studies in styles, with
  original melodies, chords and arrangements. No melody, bass line or hook
  from any record or game.
- **No names.** The code, the package's docs and the entries never name a
  console, a sound chip or a synthesiser as the source of a sound or an
  instrument. Instruments are named for what they are (`KEYS`, `ANTHEM`,
  `SQUELCH`). Style names (house, trance, jungle) are genres, and fine.

---

## 10. Testing

As for the Audio80 (045 section 10), with stereo and the new engines:

- **The synthesiser, in Node.** For each engine: pitch (an FM carrier at
  ratio 1 and a sample at its root note play the note's frequency), FM's
  sidebands at the expected frequencies for a given ratio and level, the
  operator waves' shapes, feedback's effect on the spectrum, unison's
  detune and spread, chord memory's intervals, hard sync, the ladder
  filter's cutoff and its self-oscillating pitch at full resonance, sample
  loops without a click at the seam, slices on their boundaries, reverse.
  Then the shared stages: envelopes' times, the LFO in beats, the pan law,
  the reverb's decay time, the echo's time in beats, the chorus's
  movement, the pump's timing on its channel's notes, the oscillator budget,
  the limiter. Denormal numbers guarded as the Audio80 guards them.
- **Determinism.** The same writes render the same samples, in the worklet's
  runner and the headless chip alike, and a bounced sample's data is the
  same on every run.
- **Audio tests.** Each entry's sounds test renders each sound and song and
  keeps its hash in a Vitest snapshot, checks each song's loudness against
  the reference (-20 LUFS), and its peak. The Audio90's tests run in stereo.
  The Sound Test's tunes have them too.
- **The shared refactor and the rename change no hash.** The Audio80's audio
  tests guard both steps. A changed hash means the refactor changed the
  sound, and the step is not done.
- **The notation.** Each new token, the mixer, the pump, bounce songs and
  every error message.
- **The plumbing.** The entry host's tests gain: an Audio90 session is given
  the Audio90, a silent entry is given no `sound`, a pause stops the
  session's chip's clock and not the other's, a stop resets the chip the
  session used, the page's sound loads the Audio90 only when an entry asks
  for it. A type test checks that an entry declaring `'audio90'` gets an
  `Audio90`, and that one declaring nothing gets no `sound`.
- **Visual tests** are unchanged, except that whole-entry tests make their
  chip with `createHeadlessSound`.

---

## 11. Performance

| Where | Cost, estimated | Budget |
| --- | --- | --- |
| Worklet, a busy song: sixteen voices (half FM, a quarter analog with unison, a quarter samples), every effect | 0.2-0.3 ms per 128-sample block on a desktop | Under 15% of a block (2.67 ms at 48 kHz) on a desktop; under 40% on a mid-range phone |
| Worklet, one voice of each engine | FM 6-8 µs, analog with seven unison 12-18 µs, sample 3-4 µs a block | |
| Worklet, the three effects | 40-70 µs a block, mostly the reverb | |
| Worklet, an idle chip (run dry) | Near zero | Measured, or the node is disconnected (7.2) |
| Main thread, per tick | As the Audio80: a few watched values and a handful of numbers written | Under 5 µs per audio view |
| Bouncing samples, in `load` | About 50-100 ms for 4 seconds of samples | Under 150 ms for a full 8 seconds |
| Download, on an Audio90 entry's first launch | The worklet's script, 25-40 KB before compression (the Audio80's is 12 KB) | Loaded only for Audio90 entries; the home page's first load unchanged |

The estimates scale the Audio80's measured cost (21-27 µs a block for eight
voices, 045 section 16.1). An Audio80 voice is about 3 µs a block. An FM
voice runs four table-lookup oscillators and four envelopes, about twice
that. A seven-voice unison voice runs seven band-limited oscillators and a
four-pole filter, about five times. The oscillator budget (3.8) caps the
worst case. Everything follows the hot-path rules the Audio80's synthesiser
does: no allocation after construction, state in typed arrays, controls
computed every 32 samples, a sine table rather than `Math.sin` per sample.

To measure:

- An `audio90` benchmark suite, beside `audio80`: µs per block for each
  engine, for each effect, and for the busy song above.
- The `games-and-demos` benchmark, before and after the plumbing (step 4):
  no change for the Audio80 entries.
- In the spike (step 1): the worklet's time per block in Chrome, Firefox
  and Safari, on a desktop and a phone, and the cost of an idle node.

If a phone cannot keep up, the levers are, in order: the oscillator budget
lowered for that device, the reverb's size, and rendering at 32 kHz with an
upsampler (which is also how the decade's consoles ran).

---

## 12. Docs

- **The package's README**: two chips, how to choose, and the guides.
- **A new guide, Using the Audio90**, in `packages/libraries/audio/docs/`: the
  engines, instruments, samples and bouncing, effects with pan, the mixer,
  the pump, the characters, and a short cookbook of the decade's sounds (an
  FM piano, a supersaw, an acid line, a reese, an orchestra hit, a sliced
  break, a choir), each with its technique explained plainly.
- **Writing Tracker Music** gains a section on the Audio90's tokens and
  song options, without repeating what is shared.
- **Using the Audio80** loses nothing, and says which chip suits what.
- **The entries' README**: choosing a chip, `soundChip` and `sound`, and the
  originality rules for sound (section 9).
- **`AGENTS.md`**: the sound convention says an entry's starter names its
  chip and is given that chip as `sound`, not that the host passes every
  entry an Audio80. The project structure line for `packages/libraries/audio/` names
  both chips.
- **`packages/sites/docs/ai-agents/skill-mvt-view.md`**, **the glossary** and
  **`llms.txt`**: the Audio90 beside the Audio80.
- **Sound and Music**: the "Project convention" box names both chips, and
  048's revision of the page still applies. Its example stays on the
  Audio80.

---

## 13. Ruled Out

Do not reopen without new information.

- **Giving every entry both chips.** Every page that runs an entry would
  load both worklets, and an entry would hold a chip it never plays. The
  owner asked for entries to choose.
- **A list of chips per entry**, for now. One chip per entry keeps `sound`
  a single chip and the views simple. The Sound Test of both chips that 048
  imagines would want two; section 14 asks.
- **One chip with every engine, the Audio80's waves included**, replacing
  the Audio80. It would change the sound of nine games that the owner has
  approved, and blur two characters into one.
- **One worklet module for both chips.** A page playing only Audio80 entries
  would download the Audio90's synthesiser.
- **Choosing the chip by the entry's era tag.** The era describes the look;
  the sound is a separate choice (7.5).
- **The chip named in `entry.ts`'s metadata.** The starter is what uses the
  chip, it is loaded before the host prepares it, and only there can the
  types tie the name to `sound`. The metadata could repeat it for the info
  panel later (section 14).
- **Recorded samples, sound fonts or sample libraries.** Against the
  originality rules, and heavy to download.
- **Samples committed as audio files**, generated by a script, as the
  textures are. Larger to download than the code that makes them, a binary
  blob in every review, and unnecessary when a bounce takes under 150 ms.
- **Bouncing in the worklet.** Rendering seconds of audio on the audio
  thread would glitch whatever is playing, or need rendering spread across
  blocks and a way to wait for it. The main thread renders it during
  `load`, where waiting is already expected.
- **A sample written as a code function** (a callback that fills a buffer).
  Every sound the decade needed can be bounced from the engines, and a
  callback could not reach the worklet or be checked by the parser. It could
  return if a sound turns up that the engines cannot make (section 14).
- **Web Audio's own nodes, or a library.** For the reasons in 045 section
  13: wall-clock timing, allocation per note, and not the sound.
- **Emulating any chip exactly.** Not the goal, and the emulators are GPL.
- **A stereo Audio80.** Settled in 045.

---

## 14. Open Questions

1. **Rename the Audio80's notation?** Recommended: yes,
   `createAudio80Instrument` and the rest (5.2), so every sound file says its
   chip, as 045 section 16.4 planned. The alternative is that plain names
   mean the Audio80 and only the Audio90's carry their chip, which saves a
   mechanical diff over ten games and leaves the names lopsided.
2. **Neon Monsoon: rescore, or keep?** Recommended: rescore on a branch, and
   let the owner's listening pass choose (8.2).
3. **More than one chip per entry?** For a Sound Test that plays both chips'
   tunes. `soundChip` could become a list, and `sound` an object of chips,
   for entries that ask for more than one. Recommended: not until an entry
   needs it.
4. **The chip in the info panel?** "Sound: Audio90" beside the techniques,
   from the metadata or from the loaded starter. Recommended: later, if the
   owner wants the credit.
5. **The pause menu's music preview** for an Audio90 entry: an Audio80
   phrase (7.6), or a phrase on the entry's own chip, which would need the
   entry chip to play while paused, or a second Audio90 for the page.
   Recommended: keep the Audio80 phrase.
6. **Sixteen voices, or 24?** Sixteen is the recommendation, and the spike
   measures what 24 would cost. More voices mean more room for effects in a
   dense game.
7. **Scopes from the worklet, or from a render on the main thread?** For the
   Sound Test (8.1). The spike tries the worklet's reply first.
8. **048's question of effects borrowing music voices** applies to both
   chips now. Deciding it once, in shared code, is easier after the shared
   refactor.

---

## 15. Implementation Steps

Built on a worktree branch, `audio90`, and handed to `vnext` in reviewable
chunks, as 045 was. The worktree needs its own `npm ci`.

1. **Spike.** An FM voice, a seven-voice unison analog voice with its
   ladder filter, a sample voice playing a bounced sound, the reverb, in a
   stereo worklet beside the page's running Audio80, on the same context.
   Measure the time per block in Chrome, Firefox and Safari, on a desktop
   and a phone, and the cost of an idle chip. Measure the transfer of a 512
   KB sample. Listen to three patches (an FM piano, a supersaw, an acid line)
   with the owner. Decide open questions 6 and 7.
2. **Shared refactor.** Move the clock, the command queue and writer, the
   held writes, the tracker grammar, the driver and the runner into
   `shared/` and `web/`, generic over the chip. No behaviour changes: every
   Audio80 audio test's hash is unchanged.
3. **The rename**, if open question 1 says so. Names only.
4. **Entries choose their chip.** `SoundChipKind`, `soundChip` on the
   starters, the typed start options, `PageSound`'s slots, the entry host,
   the Pixi stage, `createHeadlessSound`, and every entry's declaration
   (7.5), with only `'audio80'` in the union at first. The silent demos stop
   receiving a chip. The plumbing tests and the type test. `games-and-demos`
   before and after.
5. **The Audio90's synthesiser**: voices, the three engines, filters,
   envelopes, LFOs, the driver's new columns, the effects, the pump, the
   output stage and characters, the oscillator budget. Its Node tests.
6. **The chip**: commands, the writer, `createWebAudio90` and its
   processor, `createHeadlessAudio90`, stereo rendering, hashing and
   loudness. `'audio90'` joins `SoundChipKind`.
7. **The notation**: instruments, samples and bouncing,
   `prepareAudio90Samples`, sound effects, songs with the new tokens, the
   mixer, the effects and the pump. Its tests.
8. **The music player**, generic over the chip.
9. **The `audio90` benchmark suite**, results saved.
10. **The Sound Test demo**, with its tunes, scopes and effects page, and its
    audio tests. The owner's listening pass.
11. **Neon Monsoon's rescore**, on the branch, with panned effects. The
    owner's listening pass decides open question 2.
12. **Browsers**: Chrome, Firefox and Safari, on the desktop, Android and
    iOS, over `npm run dev:https`.
13. **Docs** (section 12).
14. **Close.** Record what was built and measured in an "As Built" section,
    move this proposal to `archive/`, and put loose ends in a task.
