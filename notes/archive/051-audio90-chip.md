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

**Status:** implemented on the `audio90` worktree branch, from 2026-10-16 to
2026-10-17, and archived on 2026-10-17, ahead of the branch's merge into
`vnext`. Every step is done but its Safari and iOS test, which the owner
makes once the work is deployed through main. The owner's listening
passes kept the Audio90's sound, the fifteen tunes and Neon Monsoon's
rescore. Section 17 records what was built, measured and changed. The
loose ends, and open questions 3, 4, 5 and 8, are task
[065](../tasks/backlog/065-audio90-follow-ons.md).

What was built:

- **The Audio90**, in `@mvtjs/audio`: sixteen stereo voices, each running
  four-operator FM, an analog engine (unison, chord memory, a second
  oscillator, a sub, noise) or a sample, through a filter of its own, with a
  reverb, a stereo echo, a chorus, the pump, three characters and scopes
  from the worklet. Its notation (`createAudio90Instrument`,
  `createAudio90Sample`, `createAudio90SoundEffect`, `createAudio90Song`),
  samples bounced from its own engines, `createWebAudio90` and
  `createHeadlessAudio90`. The clock, the queue, the note driver, the
  tracker grammar, the held writes, the runner and the music player are
  shared by both chips.
- **Entries choose their chip**: `soundChip: 'audio80' | 'audio90'`, or
  none, and the types give the starter that chip as `sound`.
- **The Tune Tracker**, a demo that plays fifteen original tunes in the
  decade's styles, from `src/tunes/` (`#tunes`), and shows them as a
  tracker of the decade did. The Sound Test, a jukebox of the same tunes
  and an effects page, was built too, and dropped as the work was handed
  over (section 17.6).
- **Neon Monsoon** rescored on the Audio90, its effects panned where they
  happen.
- **Shared pixel glyphs** (`#pixel-glyphs`) and `PixelTextView`, in which
  eight entries of the 1970s to the 1990s now set their text.
- **The cards' long text** loads after the home page's first paint, which
  brought the first load from 51.7 KB to 45.5 KB, and the budget fails the
  build again.
- **The docs**: a guide, Using the Audio90, and the Audio90 across the
  package's and the site's docs.

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
| 10 | The demonstrations | A new **Sound Test** demo on the Audio90: a jukebox of original tunes in the decade's styles, with a scope for each voice. A **Tracker** demo that shows the same tunes as a tracker program did, the patterns scrolling as they play. Then **Neon Monsoon**, rescored on the Audio90, with its effects panned by where they happen. The owner's listening pass decides whether Neon Monsoon keeps the new score | [8](#8-the-demonstrations) |
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
shooter's FM rock, each with a scope per voice. The Tracker shows the same
tunes as a 1990s tracker program did, their patterns scrolling under the
row that plays. Neon Monsoon plays an FM and
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

**Built (step 2, 2026-10-16), in part.** The Audio80's code is in
`audio80/`, in `synthesiser/`, `notation/` and `chip/`, behind one barrel.
`shared/` holds what was already chip-agnostic: the controls interface,
the command layout (`COMMAND_STRIDE`), the command queue, note names, the
effect voice allocator, and the tracker grammar (`tracker.ts`: rows,
comments, cells, tokens, the order with transpositions, the tempo, the
instrument letters and the loop, with their error messages unchanged).
The clock stays in `web/`, where it already was, and is chip-agnostic as
it is. Four things the design moves here wait for the Audio90 instead,
because each is woven into the Audio80, and making it generic now would
guess at a chip that does not exist yet:

- **The driver**, which is part of the Audio80's synthesiser and writes
  its voice arrays. It is shared when step 5 builds the Audio90's
  synthesiser beside it.
- **The held writes**, whose slots are the Audio80's opcodes and settings.
  A generic version, given each chip's slots, comes with step 6.
- **The runner**, which makes an Audio80 synthesiser and renders one
  channel. It becomes generic in step 6, when there is a stereo chip to
  run.
- **The command writer.** Its buffer is generic, but its methods are the
  Audio80's. It splits in step 6 too.

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
score, and the Sound Test and the Tracker are the demonstrations. Section
14 records this as open.

### 8.3 Tracker

Added 2026-10-16, after the owner's listening pass of the Sound Test, which
found every tune worth keeping. The decade's musicians wrote such tunes in
**trackers**: programs that show a song as rows of notes, one column per
channel, scrolling past a play line as it plays. The Audio90's notation is
already a tracker's, written as text. This demo shows the Sound Test's
tunes the way their composers would have watched them.

A new demo entry, **Tune Tracker**, `tune-tracker` (open question 10),
tagged `demo`, era `1990s`, genre `sound`:

- **The pattern view**: one column per channel, one line per row, the row
  playing held on a bar across the middle while the pattern scrolls up
  through it, as the trackers did. Row numbers down the side in hex. Each
  cell in fixed columns: the note (`C-4`, `---` for none, `===` for a
  release), the instrument's letter, the volume, and the effect tokens
  (`c47`, `P40`, `s0C`, `!`, `>`). The next pattern follows the last row of
  this one without a gap, as it plays.
- **The order list**: the song's patterns in playing order, with their
  transpositions (`keys-4`), the entry playing marked and the loop point
  shown.
- **A meter above each channel**, from the chip's scopes (step 10): each
  voice's level and pan.
- **The song's panel**: its name and style, tempo, rows a beat, swing,
  character, effects, and the instruments by letter, each with its engine.
- **A tune chooser**, as the Sound Test's, and play and stop. The keys and
  the pointer work it, as they do the Sound Test.

Its look is original, in the spirit of the DOS-era trackers: text in a
pixel font of the repo's own, panels with bevelled edges, and a pattern
area in the colours of a text-mode screen. No tracker program's layout,
font or colours are copied (section 9).

**What it draws is what the chip plays.** The view does not keep a second
copy of the text. Each song's patterns are parsed once, as now, by
`createAudio90Song`, into cells of numbers; the view formats each cell back
into fixed-width tracker text as its row scrolls into view. The audio
package gains the formatter, `formatAudio90Cell`, beside the parser, and a
test that formatting a cell and parsing the text gives the same cell (open
question 11).

**Where the song is.** The music player knows which row is playing; it is
the presentation state of the view that owns it. So the player gains
`orderIndex` and `row`, read-only. The Tracker's top-level view owns one
player, as a view model: its audio view plays through it, and its pattern
view reads where it is. The chip plays 35 ms behind its writes (section
4), so the bar would lead the sound by about two frames; the pattern view
may offset by the chip's lead, judged by eye and ear in the browser.

**The tunes are shared.** The Sound Test's tunes, instruments, samples and
effects move out of its entry into `src/tunes/`, a module of the site's
that both entries import (open question 9). Neither entry keeps a copy, so a tune
changed for one changes for both, and both audio tests keep it honest.

**Renderer.** Recommended: Pixi, with the pixel font as a texture made by a
generator script, as the games' textures are, and a pool of row views, of
which only the rows scrolling into view are given new text. A tracker's
grid redrawn as DOM text each row would also do; Pixi keeps the scroll
smooth and the look exact.

**Tested:** the formatter's round trip for every token; the player's
`orderIndex` and `row` against the stamps it writes, through a loop and a
queued song; the pattern view's visual tests at chosen rows (the first row,
mid-pattern, across the join of two patterns); the audio view; and the
whole entry's visual test.

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

1. ~~**Rename the Audio80's notation?**~~ Decided (2026-10-16): **yes**, as
   recommended, and done in step 3. `createAudio80Instrument`,
   `createAudio80SoundEffect` and `createAudio80Song`, with the types
   `Audio80Instrument`, `Audio80SoundEffect` and `Audio80Song` and their
   options, and the guards `isAudio80Song` and `isAudio80SoundEffect`.
   The Audio80's setting types (`Wave`, `Character`, `VoiceSetting`,
   `FilterSetting` and the rest) keep their plain names for now. Whether
   they take the chip's name too is decided in step 5, beside the Audio90's
   own (`Audio90Character`, `Audio90VoiceSetting`). An `Envelope`, the same
   shape on both chips, may move to `shared/` then.
2. ~~**Neon Monsoon: rescore, or keep?**~~ Decided (2026-10-17): **the
   rescore**, after the owner's listening passes (step 13). The music was
   good at once; the effects took three passes.
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
6. ~~**Sixteen voices, or 24?**~~ Decided (2026-10-16): **sixteen**. The
   spike (16.2) found 24 costs about a third more than 16 (247 against 182
   µs a block in Chromium's worklet), and both are well inside the budget on
   a desktop, so cost did not decide it. Sixteen is the limit that makes a
   busy moment choose. Reopen only if a game runs out of voices.
7. ~~**Scopes from the worklet, or from a render on the main thread?**~~
   Decided (2026-10-16): **from the worklet**, behind an option. The spike
   (16.2) found capturing every voice costs 1-8 µs a block, and 94 scopes a
   second go back and forth in three reused buffers, with nothing
   allocated. A render on the main thread would run the whole synthesiser
   twice.
8. **048's question of effects borrowing music voices** applies to both
   chips now. Deciding it once, in shared code, is easier after the shared
   refactor.

9. ~~**Where the shared tunes live.**~~ Decided (2026-10-16): **in
   `src/tunes/`**, a module of the site's beside `src/shared/`, holding the
   instruments, samples, tunes and effects the Sound Test made, which both
   demos import. The alternative, the Tracker importing the Sound Test's
   `data` barrel, would tie one entry to another's insides.
10. ~~**The Tracker's name.**~~ Decided (2026-10-16): **Tune Tracker**,
    `tune-tracker`. Searched as a title: no game has it; the one app by that
    name is an iPad app that logs piano practice.
11. ~~**Formatted cells, or the source text?**~~ Decided (2026-10-16):
    **formatted cells**, each parsed cell put into fixed columns as a
    tracker shows them, so every tune looks alike and what is drawn is
    exactly what plays.
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
   with the owner. Decide open questions 6 and 7. **Done but for Safari
   (2026-10-16):** built and measured in Node and headless Chromium
   (section 16). The owner's listening found it excellent, it works in
   Firefox and on an Android phone, and 6 and 7 are decided. Safari is to
   try later.
2. **Shared refactor.** Move the clock, the command queue and writer, the
   held writes, the tracker grammar, the driver and the runner into
   `shared/` and `web/`, generic over the chip. No behaviour changes: every
   Audio80 audio test's hash is unchanged. **In part (2026-10-16):** the
   Audio80 moved into `audio80/`, and the queue, the command layout, the
   controls, notes, the voice allocator and the tracker grammar into
   `shared/`, with a test of their own for the grammar. Every audio test's
   hash is unchanged, and all 2493 unit tests pass. The driver, the held
   writes, the runner and the command writer wait for steps 5 and 6
   (section 5.1).
3. ~~**The rename**, if open question 1 says so. Names only.~~ Done
   (2026-10-16): 62 files, names only, in code and in the docs' code. The
   types check, and all 2493 unit tests pass with every audio test's hash
   unchanged.
4. **Entries choose their chip.** `SoundChipKind`, `soundChip` on the
   starters, the typed start options, `PageSound`'s slots, the entry host,
   the Pixi stage, `createHeadlessSound`, and every entry's declaration
   (7.5), with only `'audio80'` in the union at first. The silent demos stop
   receiving a chip. The plumbing tests and the type test. `games-and-demos`
   before and after. **Done (2026-10-16)** but for the benchmark. As
   designed in section 7, with these details:
   - The starter types are type aliases over a fields interface
     (`PixiEntryStarterFields<K>`) and the chip's field (`HasSoundChip<K>` or
     `HasNoSoundChip`). Two helpers, `startPixiEntry` and
     `startElementEntry`, give a starter its chip from a `SoundChipFinder`,
     so no caller casts. The host, the Pixi stage, the headless starts, the
     snapshot page, the visual tests, the scoring test and the benchmark all
     start entries through them.
   - `PageSound` has `entryChips` (a chip and its controls for each kind)
     and `isMuted`, which mutes every chip. `prepare()` loads the page's own
     chip, and `prepare(kind)` the entry chip of that kind as well, the first
     time it is asked for. So the first press loads one chip, not two, and
     the entries' chip loads with the first entry that plays on it.
   - The nine games and Fruit Machine name `'audio80'`. Boids, Boids 3D,
     Falling Sand, Fractalscope and Reordering Lists name none.
   - Tests: the host gives a silent entry no chip and loads none for it,
     and loads the entries' chip for the first entry that plays on it; the
     page's sound loads only its own chip until asked for another, and mutes
     every chip; a type test checks that a starter's chip and its `sound`
     agree, with `@ts-expect-error` lines that must fail to compile. All
     2500 unit tests pass, and the 15 whole-entry visual tests match their
     references.
   - In the real Arcade, in headless Chromium: Galaxy Raiders and Fruit
     Machine made two chips (the page's and the entries'), Boids made one,
     no page errors, and Galaxy Raiders' writes kept reaching its chip
     second by second while it played.
   - Not run: `games-and-demos` before and after. Per frame, the host now
     calls a getter for the session's controls and calls them only if there
     are any, and a silent demo no longer advances a chip it never played
     on. Both are far below the suite's noise.
5. **The Audio90's synthesiser**: voices, the three engines, filters,
   envelopes, LFOs, the driver's new columns, the effects, the pump, the
   output stage and characters, the oscillator budget. Its Node tests.
   **Done (2026-10-16)** in two commits:
   - **The note driver is shared.** The Audio80's driver (steps' pitch,
     arpeggio, vibrato, glides, slides, an effect's length) moved into
     `shared/note-driver.ts`, with `onStep` for what else a chip's step rows
     set. Its arithmetic is unchanged, and every audio test's hash is the
     same. The Audio80's sweeps stay its own.
   - **The synthesiser** is `audio90/synthesiser/`, internal to the package
     until step 6 gives it a chip: `createAudio90Synthesiser`, its commands
     (`OP90_*`, named voice and effect settings, the characters) and its
     instrument, step, effect and sample data, with
     `DEFAULT_AUDIO90_INSTRUMENT` for the notation to build on. It renders
     stereo from the shared command queue, with the shared driver and voice
     allocator. 27 tests check each engine's pitch and character, FM's
     overtones and brightness, unison spread, chord memory, the oscillator
     budget, samples (root note, loops, slices, reverse), the ladder ringing,
     drums freeing their voice, legato ties, the LFO in beats, accents, the
     pan law, the echo in beats and ping-pong, the reverb's decay, the pump,
     effects' voices and pan, the mix buses, the console character, stamps,
     determinism, sixteen voices without clipping, reset and sample memory.
   - **Decided while building it:** a song channel's pan, sends and
     brightness last across notes and add to the instrument's (brightness
     multiplies); an effect's voice drops the channel's settings. Brightness
     is 0 to 1, where 1 is the instrument as written: lower closes a filter
     by up to six octaves, and softens FM modulators. The LFO's volume dip
     follows the LFO falling, so a square LFO is a gate open on the beat. A
     legato instrument's overlapping note on the same voice glides and keeps
     its envelopes running. Any envelope that decays to 0 ends, so a drum
     frees its voice. `reset` puts the effects, the character and the tempo
     back to their defaults. `defineSample` returns false for a sample that
     does not fit, rather than throwing on the audio thread.
   - **Measured** (a probe in Node, not saved): 171 µs a block for a busy
     mix on all sixteen voices (6.4%), and 14 µs with none. Allocation looked
     small but not zero; the probe's own loop allocates, so step 9 measures
     it with the benchmark harness, and fixes any boxing it finds.
   - **Decided in step 6:** the Audio80's setting types take the chip's
     name, as the Audio90's do (below).
6. **The chip**: commands, the writer, `createWebAudio90` and its
   processor, `createHeadlessAudio90`, stereo rendering, hashing and
   loudness. `'audio90'` joins `SoundChipKind`.
   - **The Audio80's types take its name** (2026-10-16), in a commit of
     names only, as step 3 was. Every public type that belongs to one chip
     now says which, so that neither chip's names read as the default: the
     settings (`Audio80Wave`, `Audio80Character`, `Audio80VoiceSetting`,
     `Audio80FilterId`, `Audio80FilterMode`, `Audio80EchoSetting` and their
     values), the notation's parts (`Audio80Envelope`, `Audio80Vibrato`,
     `Audio80FilterSweep`, `Audio80PulseSweep`, `Audio80FilterSettings`,
     `Audio80EchoSettings`), and the headless chip's (`Audio80Log`,
     `Audio80Write`, `Audio80Renderer`, `HeadlessAudio80RenderOptions`). A
     game's own `Wave`, such as Astrovoid's, is untouched. 36 files; the
     types check and all 2536 unit tests pass with every hash unchanged.
   - **Built (2026-10-16)**, finishing what step 2 left (5.1):
     - **Shared:** the command buffer and `CommandWriter` (what the
       browser's and the headless chips need of any chip's writer), the
       batch and reply messages, `ASAP_STAMP` and `MixBus`. The Audio80's
       writer is now built on the buffer.
     - **`web/`, made generic:** the held writes take a chip's slots
       (`AUDIO80_HELD_SLOTS`, `AUDIO90_HELD_SLOTS`); the runner takes a
       synthesiser adapter and renders one channel or two, with each chip's
       runner (`createAudio80Runner`, `createAudio90Runner`) beside it; one
       file registers a processor (the repo's one class); and
       `createWebChip` holds the node, the waiting messages, the spares and
       the controls, so `createWebAudio80` and `createWebAudio90` are each a
       writer joined to it. Each chip's worklet is its own module: 14.1 KB
       and 25.2 KB minified, before gzip.
     - **The Audio90:** its interface (5.3, with `setTempo` added, since the
       player writes the tempo), `createCommandAudio90`, `createWebAudio90`
       and `createHeadlessAudio90` (silent, recording, rendering, both), its
       log's `Audio90Write`, and the types of its sounds in
       `audio90/notation/` (`Audio90Instrument`, `Audio90SoundEffect`,
       `Audio90Sample`, each with `chip: 'audio90'`), which step 7's
       notation makes.
     - **Stereo tools:** `StereoSamples`; `hashSamples`, `measurePeak`,
       `measureLoudness` and `encodeWav` take mono or stereo; and
       `renderSoundEffect` renders an Audio90 effect in stereo. Mono results
       are unchanged, so every hash is.
     - **The site:** `'audio90'` joins `SoundChipKind`, the page's sound has
       an Audio90 slot that loads on the first Audio90 entry's `prepare`,
       `createHeadlessSound` makes either chip, and the start helpers narrow
       by kind.
   - **Decided while building it:**
     - A sample goes to the worklet before the first instrument or effect
       that plays it, copied rather than moved, so the page keeps it for
       the next session. The writer puts the sample's id into a copy of the
       instrument's data, once, and leaves the sound's own data as written.
     - `setVoice` takes a number for every setting, since every Audio90
       voice setting is one, so there is no `Audio90VoiceSettingValue`.
     - The browser's and the headless chips' controls are shared code
       (`createWebChip`, `headless-controls.ts`), not copied per chip.
   - **Checked:** all 2571 unit tests pass (35 new: the writer, the held
     writes, the stereo runner, the browser and headless Audio90s, the
     stereo tools, the page's sound and the host loading the Audio90 only
     for an entry that asks, and a type test that an Audio90 starter gets
     an Audio90). Lint and the build are clean, and the home page's first
     load is 47.9 of 50 KB. In headless Chromium, a temporary page played
     the real worklets on one context: a note panned hard left read 0.140
     RMS on the left and 0 on the right; an effect panned right, 0.140 on
     the right; a looped sample, 0.076 on each side; the Audio80 beside it,
     0.105 on each; then silence.
   - **Left for later steps:** `renderSong` and `findSounds` for the
     Audio90, which need its songs and their guard (steps 7 and 8); a
     `chip` field on the Audio80's sounds, for the render tools to tell
     songs apart (step 8; `renderSoundEffect` tells by the Audio90's own
     field); `prepareAudio90Samples` checking the samples fit in sample
     memory, since the worklet drops one that does not (step 7); and the
     scopes from the worklet (step 10).
7. **The notation**: instruments, samples and bouncing,
   `prepareAudio90Samples`, sound effects, songs with the new tokens, the
   mixer, the effects and the pump. Its tests. **Done (2026-10-16):**
   - **Built**, in `audio90/notation/`: `createAudio90Instrument` (the three
     engines' options as 6.1 sketches them, the filter with its envelope
     shorthand and accent, the mod envelope, the LFO in Hz or beats, legato,
     and step tables with the Audio90's pan, brightness and slice columns),
     `createAudio90Sample` and `prepareAudio90Samples`,
     `createAudio90SoundEffect`, and `createAudio90Song` with the tokens of
     6.4, the mixer, the effects, the pump and the character. Each throws
     with the option's path or the cell's place. `computeSongDurationMs`
     moved to the shared tracker and takes either chip's song.
   - **What a song writes** is its own file, `song-writer.ts`:
     `writeAudio90SongStart`, `writeAudio90Row` and `releaseAudio90Song`
     write through the `Audio90` interface. The bounce drives them with a
     fixed-tempo loop over the rows; step 8's player will drive them in time
     and buffer their writes until its refresh, as the Audio80's player
     does. 6.5's split holds: the timing is the player's, what a cell writes
     is the chip's.
   - **Decided while building it:**
     - `bounce.ts` is in `notation/`, not beside it as 5.1 drew it, since a
       sample's first read bounces it, and that keeps the import one way.
     - A sample bounces the first time its `data` is read, which
       `prepareAudio90Samples` does as the entry loads. The bounce is mono,
       peaks at 90% of full scale, and is dry unless its song sets an effect.
       No warning is given for a sample first bounced as it plays; Node and
       the headless chips would warn too, and step 10 will show whether
       one is needed.
     - `prepareAudio90Samples` checks the samples' total length against
       sample memory before bouncing any, and names each one's size by its
       place in the list, since a sample has no name.
     - Option names: `oscillator` and `oscillatorB` for the analog engine,
       `modEnvelope: { to, amount, envelope }`, `lfo: { rateHz | rateBeats,
       pitch, cutoff, brightness, volume, pan }`, `legato: { glideMs }`, and
       an operator's waves `sine`, `half-sine`, `abs-sine`, `quarter-sine`.
       An option for another engine is an error.
     - A sound effect's pan and sends are its own, and may be given with an
       instrument; its sends override the instrument's on a copy.
     - The mixer sets every channel as a song starts (pan, sends, and
       brightness back to 1), and a song with no pump turns the pump off.
       A song that leaves out the reverb, echo, chorus or character leaves
       them as they are, as the Audio80's echo does; one that sets an
       effect sets all its settings, from `AUDIO90_EFFECT_DEFAULTS` for those
       left out.
     - `c`, `!` and `s` are checked against the channel's instrument: in the
       cell when it names one, and as the order plays when it does not.
   - **Tested:** 27 tests: algorithms and their errors, operator envelopes,
     engine options, the filter's shorthand, the LFO, legato, step tables,
     ranges; a bounce's pitch, length, peak, bits, determinism and dryness,
     a sample played at its root note's interval, the checks on loops,
     slices, rate and bits, sample memory; effects' own pan and sends;
     every new token in a cell, the proposal's own error message, checks
     as the order plays, slices, the mixer and effect defaults, and the
     writes of a song's start and of a row, in order. Step 6's stand-in
     sounds were replaced by the factories, except where a test needs a
     sound made by hand (an exact sine sample, the writer's own tests). All
     2598 unit tests pass.
   - **Measured** (in Node, a temporary probe): a 700 ms hit of a chord and
     an FM note bounces in 6-14 ms at 32 kHz. Eight seconds of two
     seven-copy chords and two FM notes, without stopping, took about 220
     ms, over the 150 ms budget for a full 8 seconds. Skipping the effects
     in a dry bounce (a new `hasEffects` option of the synthesiser) brought
     it to about 180 ms; the voices are the rest. That is a worst case no
     entry is likely to bounce, so it is left for step 9's benchmark to
     settle, with the Sound Test's real samples.
8. **The music player**, generic over the chip. **Done (2026-10-16):**
   - **Built:** `createMusicPlayer({ audio80 })` returns a
     `MusicPlayer<Audio80Song>` and `createMusicPlayer({ audio90 })` a
     `MusicPlayer<Audio90Song>`. The player keeps a song's time (rows, the
     order, loops, swing, the queue, the tempo scale, and each write's exact
     chip time) once, for both. A `SongDriver` for each chip writes: the
     Audio80's is the old player's writing, moved as it was, so every
     Audio80 hash is unchanged; the Audio90's drives step 7's song writer
     through a stand-in Audio90 that keeps the writes as numbers, and makes
     the calls on the chip at refresh.
   - **The tempo:** a song tells the Audio90 its tempo as it starts, scaled
     by the player's `tempoScale`, and again when the scale changes. A
     tempo of 0 now holds the LFOs timed in beats, so a held song holds
     them; the echo keeps the last tempo above 0, rather than an endless
     delay.
   - **The render tools:** `renderSong` renders an Audio90 song in stereo,
     and `findSounds` finds either chip's songs and effects. `renderSong`
     and `renderSoundEffect` each have a third signature for a sound of
     either chip, so a test that goes through a module's sounds needs no
     change. Every sound now has its `chip` field (5.2), the Audio80's
     included, which the render tools tell them apart by.
     `npm run audio:render` writes an Audio90's sounds as stereo files.
   - **Fixed:** step 3's rename had renamed a parameter of the render
     script, `isSong`, to `isAudio80Song`. A look through the rest of that
     commit found nothing else it should not have renamed.
   - **Tested:** six tests of the player on an Audio90 (the song's settings
     and then each row at its time, nothing before the refresh, the same
     stamps for any length of tick, the tempo with its scale and 0 while
     held, a queued song and a stop, a song rendered where its mixer pans
     it, and a type test that an Audio90's player refuses an Audio80 song),
     and one of the synthesiser holding a beat-timed LFO at a tempo of 0.
     The Audio80's 25 player tests and every audio test pass unchanged. All
     2605 unit tests pass.
9. **The `audio90` benchmark suite**, results saved. **Done (2026-10-16):**
   - **The suite** times the headless chip rendering 128-sample stereo
     blocks at 48 kHz, by engine and voices, with every effect running, and
     counts the bytes allocated; times a busy ten-channel song of every
     engine through the music player a tick at a time, and counts its
     allocation; and times four bounces. Its sounds are written for it.
   - **Measured** (Node 26, results saved in `audio90.md`):
     - The effects alone take 22 µs a block. Sixteen voices take 167 µs of
       FM (195 µs with the console character), 95 µs of acid bass, 140 µs
       of supersaws within the oscillator budget, and 96 µs of samples. A
       busy mix of every engine on sixteen voices takes 193 µs, 7.2% of a
       block, inside section 11's 15% for a desktop. The spike measured
       152 µs for its mix; the chip's mix is busier (its sample voice
       loops a bounced orchestra hit, and it renders through the headless
       chip and its command queue).
     - The busy song takes 698 µs a tick, for 800 samples and the player's
       work: about 110 µs a block.
     - Bouncing: an orchestra hit 27 ms, a two-bar break at 26 kHz 47 ms,
       and the full 8 s of sample memory, as busy as any song, 139 ms dry,
       inside the 150 ms budget, or 175 ms with the song's reverb running.
       Step 7's 180 ms came from a probe run under Vitest; the suite's
       bundled Node build is the one to go by. Section 11's budget holds
       for a dry bounce; one that runs its effects over all of sample memory
       goes past it, which no entry is likely to need.
   - **Allocation, found and fixed.** The first runs allocated about 1 KB
     a block on sixteen voices, and the song 3.9 KB a tick. V8's sampling
     heap profiler, run in a bundle built as the suite builds it, found
     each one. Under Vitest none of it shows, since Vitest does not bundle:
     - **The shared note driver** boxed a double for every voice at every
       control step: `stepMs[v] > 0 ? stepMs[v] : DEFAULT_STEP_MS`, a
       choice between a stored double and a module constant, which a
       bundler turns into a `var`. The step length is now resolved once, as
       the note starts. This was also all of the Audio80's 523 bytes a
       block, which 045 put down to arguments to `render`: the Audio80 now
       allocates nothing, and every audio hash is unchanged.
     - **The Audio90's control step** boxed one for a voice with key
       tracking, from its choices (`clamp` and the accent's ternary). They
       are written with `Math.min`, `Math.max` and a product now.
     - **The music player** kept its times in closure variables, which V8
       boxes on each write, and chose between a stored time and a
       function's result for the next row. Its times are in a typed array
       now, and the row's time is worked out without a choice. **The chips'
       writers** and the silent headless chips did the same with their
       clocks, which are in typed arrays now.
     - What is left: under 1 byte a block for every engine, and 35 bytes a
       tick for the song through the player, which is a few doubles passed
       through calls V8 does not inline (the clock's getter, the writes
       into the chip, the render's times). At 60 ticks a second, that is a
       minor collection about once an hour.
   - **Also re-saved `audio80`**, whose allocation went from 523 bytes a
     block to 0. Its times are as before, but for two cells that disagreed
     between runs on a busy machine.
   - **Not run:** `games-and-demos`. The silent headless chips' clocks no
     longer box, which removes about 16 bytes a frame from each game's
     allocation there. It is still offered, with step 4's before and after.
   - **Worth a line in the docs (step 16):** the Hot Paths page should say
     that a choice between a double and a constant can box the double, and
     that a bundled build is the one to profile.
10. **The Sound Test demo**, with its tunes, scopes and effects page, and its
    audio tests. The owner's listening pass. **Done (2026-10-16).** The
    owner listened to every tune and effect and likes them all, so they are
    kept, and step 11 adds a second demo for them (section 8.3).
    - **Scopes from the worklet** (open question 7), in the library: the
      Audio90 gains `scope`, one array for the chip's life, and
      `setScopes(isOn)`, off until turned on and off again at every reset,
      so no other entry pays. The worklet sends a scope every fourth block,
      about 94 a second, in one of three buffers that go back and forth; the
      page copies each into `scope`. A scope holds 64 points a voice, eight
      samples apart (11 ms, a cycle of a bass note; the spike's were two
      apart, too short to show a waveform), and each voice's pan. The
      headless Audio90 fills it as it renders. The runner's messages that
      it passes to a chip's own part are `PassedMessage`s now, as the scopes
      are not definitions, and the writes of a chip, which a song or a
      bounce needs, are `Audio90Writer`, which `Audio90` extends.
    - **The entry**, `sound-test`, an element entry on the DOM: HTML for
      the jukebox and a 2D canvas for the scopes, which suit a list of
      buttons better than Pixi would. Tagged `demo`, `1990s` and a new
      genre, `sound`. Its model is the jukebox (page, tune, effect, playing,
      time played, pan, effects played); its audio view plays what the
      model says through the music player; the scopes scale each voice to
      its own peak, with a bar for its level and a mark for its pan, in one
      colour for the music's voices and another for the effects'.
    - **Eleven tunes**, 27 to 54 seconds each, looping, each naming its
      techniques: Warehouse Keys (house), Lights Up (eurodance), Breakdown,
      Build (trance), Squelch (acid, eight rows a beat so each sixteenth is
      a note and its release), Night Bus (jungle, on a sliced break), Slow
      Burn (trip-hop: the same break an octave down, which plays each slice
      at half speed, a sixteenth at 84 beats a minute), Lantern (ballad),
      Scramble Wing (16-bit shooter, console), Wayfarer's Road (16-bit
      role-playing game, on sampled strings, console), Round One (fighting
      game, console) and Setup Complete (two-operator FM, its chords as
      fast arpeggios). Four samples are bounced as the entry loads, an
      orchestra hit, a two-bar break in 32 slices, a choir's "aah" and a
      string ensemble's note: 174,212 samples of sample memory's 262,144,
      in 96 ms. Ten effects for the effects page.
    - **The tunes were written with a script** in the scratchpad that lays
      out each pattern's cells and writes each tune's file; the files are
      plain notation, to edit by hand from now on. Each tune's song is
      exported as a constant of its own, so `npm run audio:render` renders
      a tune file, as a composer listening outside the site needs.
    - **Found and fixed:** the entry host passed keys only to Pixi entries,
      though an element entry's session can have an `inputConfig`. The
      keyboard's listening is now `listenToKeyboard`, renderer-free, in a
      new `input/` folder, which the Pixi stage's view wraps and the host
      calls for an element entry. (In `shared/`, its barrel would have
      brought Pixi into the home page.) Moving the scope constants out of
      the synthesiser's file into its commands' kept the synthesiser out of
      the home page too: `PageSound` reads one for its Audio90 slot.
    - **Tested:** the model (7 tests), the audio view (3), and the entry's
      audio tests: every tune and effect audible, unclipped and hashed,
      every tune at -20 LUFS (each within 0.2 LU), the samples within sample
      memory, and four voices left for the effects. The scopes in the
      runner, the browser chip and the headless chip (5 tests). The whole
      entry's visual test, drawn at 880 by 550. All 2644 unit tests and 51
      visual tests pass. The home page's first load is 49.7 of its 50 KB
      (47.9 before): the catalogue's new entry, the page's Audio90 slot and
      the host's keyboard. The budget is close to full.
    - **In headless Chromium**, in the real Arcade: Down chose the next
      tune, Space played it and the scopes drew it (159 to 721 pixels in the
      music's colour), Space stopped it and they cleared; the effects page
      played the explosion on voice 16, in the effects' colour; no page
      errors, and no failed logons (the thumbnail was taken in the headless
      shell too, rather than the installed Chrome).
    - **Not done:** touch controls for an element entry (the Sound Test's
      buttons are tapped directly), and a warning for a sample bounced as
      it plays (none here: the entry prepares its samples).
11. **The Tune Tracker demo** (section 8.3), open questions 9 to 11 decided: the
    tunes moved where both demos share them, the player's `orderIndex` and
    `row`, `formatAudio90Cell` and its round-trip test, the pixel font's
    generator, the entry and its tests. The owner's look at it in the
    browser. **Done (2026-10-16).** The owner played it and likes it:
    - **The tunes** are in `src/tunes/`, imported as `#tunes`, with a name
      for each instrument (`INSTRUMENT_NAMES`) for the tracker's panel. Their
      test formats every cell of every tune and parses it back.
    - **The audio package:** the music player's `orderIndex` and `row` (the
      row whose notes were written last, 0 when stopped);
      `formatAudio90Cell(song, pattern, row, channel)` and
      `AUDIO90_CELL_TEXT_WIDTH`; `toNoteName`; a song's `instrumentLetters`;
      an instrument's `engine` name. A blank in a cell's first three columns
      is a space, so the text parses back; the view draws each as a dot.
    - **The entry**, Pixi, 800 by 500, pixel art, in a 5 by 7 font drawn by
      `scripts/generate-tune-tracker-textures.ts`. Each tune's patterns are
      laid out once as glyph codes and inks (`createPatternSheet`), so a row
      step copies them into sprites and allocates nothing. Rows step, as
      the trackers' did, rather than scroll smoothly. Each channel keeps an
      effect column for the most effects its cells have, at least one: two
      for Squelch's acid line. Written notes show untransposed, as trackers
      showed them; the order list shows each entry's transposition.
    - **Where the song is:** the audio view starts, stops and advances the
      player in its update step, not its refresh, since the player's place
      is presentation state. Found because the headless runner refreshes
      only at the end of an advance, so a tune started in a refresh never
      played in the thumbnail.
    - **Tests:** the sheet's layout and inks, the model, 17 visual tests
      (the pattern at its first row, mid-pattern, past a join and before the
      loop; the meters silent and playing; each panel), and the whole
      entry's. All 2727 tests pass and lint is clean. Seen in the real
      Arcade in Playwright's headless shell, with no errors and no failed
      logons: the keys choose and play, and the scopes draw.
    - **The owner's look (2026-10-16):** it plays well, but resizing the
      window is slow to redraw, and the music stutters. Measured with 40
      resizes in Playwright's headless shell: drawn in software, a still
      frame took 33 ms (other entries 16.7) and 58 of 93 frames took over
      the chip's 35 ms lead while resizing, because every frame drew some
      6,000 glyph sprites. The panels and the pattern's lines are now drawn
      into textures of their own (`cacheAsPixels`), redrawn only when they
      change: 20 of 101. With the GPU, the Tune Tracker resized as smoothly
      as Galaxy Raiders and Neon Monsoon with the cache or without it, so
      what the owner saw is not reproduced. Every resize step costs about
      7 ms in Pixi's `resizeCanvas`, for every Pixi entry, and the Arcade's
      card wall lays itself out again behind the entry.
    - **Not done:** the chip's 35 ms lead is not offset, so the bar may move
      about two frames before the row is heard; the owner's ear decides.
      The new card takes the home page to 50.3 KB of its 50 KB budget, as
      any new card would (it had 0.3 KB left). The owner chose to load the
      cards' long text on demand, as step 17, and the budget only warns
      until then.
12. **Shared pixel glyphs.** Added 2026-10-16. The site has three pixel
    fonts, each its own copy: the Arcade's lettering, Fenceline's (its
    "FARM FENCED!" screen) and the Tune Tracker's. Their letters are mostly
    the same 5 by 7 shapes. The Tune Tracker's set is the fullest: every
    printable ASCII character, with lowercase and descenders.
    - **One set of glyphs**, as rows of cells in a module of the site's
      with no renderer in it, which each user draws its own way: sprites
      cut from a sheet, `Graphics` rectangles, or a canvas. Not in
      `#shared`, whose barrel brings Pixi. Its tests check every glyph's
      size, and the generator script reads it too.
    - **First, the Tune Tracker and Fenceline.** Fenceline's set is a
      monospace 5 by 7 too, drawn with `Graphics` and a drop shadow. It
      changes in a few letters (`I`, `M`, `W`, `0`, `S`, `3`, `G`), so its
      reference images change, after the owner's look. Fenceline is in main
      too, which has moved on since this branch started, so this is done
      on a branch that has caught up with main.
    - **Then the other entries of the 1970s to the 1990s.** Each is pixel
      art, and each draws its HUD in a system monospace font with Pixi
      `Text`, which suits a pixel-art screen less well than pixel glyphs:
      Astrovoid, Burrow Bust, Crumb Chase, Dojo Duel and Galaxy Raiders
      (their HUDs), Fuel Run (its HUD, section announcement and base
      alert), Neon Monsoon (its HUD, boss health and warning), Fenceline
      (its HUD, points and the rest), and Garden Snake in main, which is
      not pixel art. For each, the step judges whether its text fits at a
      6-pixel advance (Galaxy Raiders is 280 pixels wide and Neon Monsoon
      240, so a line holds 46 and 40 characters), whether it needs the
      glyphs larger, and what the drop shadow or outline should be, then
      lists which entries switch. The owner decides from that list.
    - **The Arcade's lettering stays apart.** Its shapes are drawn to be
      doubled into bold (`M` and `W` are 7 wide so their gaps survive it,
      and `I` is 3), and it is drawn as SVG on the home page, which loads
      no renderer and no texture before its first paint.

    **Built (2026-10-16), waiting for the owner's look and choice:**
    - **`src/pixel-glyphs/`**, imported as `#pixel-glyphs`: `PIXEL_GLYPHS`
      (the Tune Tracker's glyphs, for the codes 32 to 126), their measures
      (`GLYPH_COLUMNS` 5, `GLYPH_BASELINE_ROWS` 7, `GLYPH_ROWS` 9),
      `findGlyph(code)` and `listGlyphRuns(glyph)`. Its tests check every
      glyph's size, and that only `g j p q y`, the comma and `_` reach below
      the baseline.
    - **The Tune Tracker** generates its sheet from them, adding its own
      five symbols after `~`; its font is byte for byte as it was, so none
      of its images changed. Its measures and its symbols' codes now come
      from the module.
    - **Fenceline** draws them, still in capitals, with its drop shadow.
      Four letters and marks change: `S` is flat-ended where Fenceline's
      was round, the colon's dots are two pixels and set higher, the comma
      has a tail below the line, and the quotes are a little different.
      Its four "FARM FENCED!" references are rewritten.
    - **The other entries of the 1970s to the 1990s**, for the owner to
      choose from. Each sets its text with Pixi `Text` in a system
      monospace font. The glyphs drawn twice their size (12 pixels a
      character, capitals 14 tall) match text of 14 to 20 pixels, and at
      their own size (6 a character, 7 tall) text of 9 to 12.

      | Entry | Screen | Its text | Fits | Recommended |
      | --- | --- | --- | --- | --- |
      | Astrovoid | 400 by 430, whole-number scale | `Score: 0`, `Wave 1`, at 14 | Twice the size: 33 a line | Switch |
      | Burrow Bust | 280 by 390, whole-number scale | `Score: 0`, `LV 1`, at 16 | Twice: 23 a line, for about 19 | Switch |
      | Crumb Chase | 560 by 470, whole-number scale | `Score: 0`, and a hint such as "Swipe to steer", at 18 | Twice: 46 a line | Switch |
      | Galaxy Raiders | 280 by 390, whole-number scale | `Score: 0`, `Stage 1`, at 14 | Twice: 23 a line, for about 21 with a five-digit score | Switch |
      | Dojo Duel | 384 by 270, pixel art at any scale | The round's timer, two digits, at 16 with an outline | Easily, two or three times the size | Switch, with an outline as now |
      | Fuel Run | 448 by 248, whole-number scale | Score, section and `FUEL` at 10 to 12; `SECTION 1 - MOUNTAINS` and `DESTROY THE BASE!` at 18 to 20 | The HUD at its own size; the announcements twice: 21 characters is 252 pixels | Switch |
      | Neon Monsoon | 240 by 320, whole-number scale | Score, `HI 00000000`, `GRAZE`, `LOOP` and the boss's seconds at 9 to 11; `THE STORMCORE APPROACHES` at 18 | The HUD at its own size: 40 a line. The warning does not fit twice the size (288 pixels), so it would take two lines | Switch, the warning on two lines |
      | Fenceline | 496 by 368, whole-number scale | `ROUND 1`, the score and the points that pop up, at 10 to 12, bold | At its own size, or twice for the HUD | Switch: its "FARM FENCED!" screen already does |
      | Garden Snake | 256 by 280, not pixel art | `SCORE 0`, and "GAME OVER" with how to play again, at 14 | At its own size; "Press Enter to play again" is 24 characters, 288 pixels twice the size | Leave: it is not pixel art |

      To switch, the entries need a Pixi view of the glyphs that any of
      them can use. Fenceline's `PixelTextView` would do, moved to
      `#shared`: it draws rectangles in a `Graphics`, which stay crisp at
      any scale, and draws again only when its text changes, as a HUD's
      does a few times a second at most. Each entry's text keeps the case
      it is written in, since the glyphs have lower case too, unless the
      owner prefers capitals throughout, as the arcades had.

    **Done (2026-10-16).** The owner chose the recommendations, in capitals
    throughout. `PixelTextView` is in `#shared`: the glyphs as rectangles
    in a `Graphics`, in capitals, at a whole-number scale, with a shadow or
    an outline, anchored across and down. Fenceline's farm-fenced screen
    uses it and draws as before. Each entry's text takes the glyphs at
    their own size for text that was 9 to 12 pixels, and at twice their
    size for 14 to 20 where it fits:
    - **Twice their size:** Astrovoid's HUD, Crumb Chase's HUD and hint,
      Dojo Duel's timer, Fuel Run's section and base announcements, and
      Neon Monsoon's "WARNING".
    - **Their own size:** Burrow Bust's and Galaxy Raiders' HUDs (on a
      screen 280 pixels wide, twice the size runs into the lives in the
      middle, so the table above was wrong for them), Fuel Run's HUD, Neon
      Monsoon's HUD, boss timer and the line under "WARNING" (one line
      fits after all: it was 9 pixels, not twice the size), and Fenceline's
      HUD, its points and the sheep's and the dust devil's, outlined as
      their stroke was.
    - **The shared overlay** (each round's title, "GAME OVER" and the
      like) followed, after the owner saw Fenceline's round title in the
      system font: `OverlayView` takes `font: 'pixel'`, and the eight
      entries ask for it. `PixelTextView` gained line breaks, each line
      anchored on its own, and `maxWidth`, which draws text at a smaller
      whole-number scale when it is too wide. Both views have visual tests
      of their own.
    - **Left as it was:** Garden Snake.
    The right-hand text in each HUD is now set against the right edge
    rather than at a fixed place, so a longer number grows to the left.
    Fenceline's sheep test reads a pixel text's label, as its game test
    did. Twelve reference images changed, each looked at.
13. **Neon Monsoon's rescore**, on the branch, with panned effects. The
    owner's listening pass decides open question 2. **Done (2026-10-17).**
    The owner keeps the rescore:
    - **The music** keeps every note of the Audio80 score: its melodies,
      chords, bass lines and drums, rescored by a script from the old
      patterns. It is re-voiced for the Audio90 in its `console`
      character, in up to seven channels: an FM lead, the chords as
      arpeggios on FM bells (left) and held on a pad an octave below
      (right), an FM bass, drums, hats, and accents (a crash at the start
      of each part, and the orchestra hit at each chord of the boss's
      riff). The single echo becomes a ping-pong echo a dotted eighth
      behind, timed in beats, so it fits every song's tempo. Each song's
      volume brings it to -19.5 to -20.1 LUFS.
    - **The orchestra hit** is the game's own sample, bounced as it loads
      from a minor brass chord, a crack and a deep drum. It is the warning,
      and the boss theme's accent.
    - **The effects** keep their names, their shapes and, within a little,
      their levels: each was matched to the old one's peak, since a sound
      in the middle of the stereo field is about 3 dB lower in each ear
      than the mono chip's. Each plays where it happens: the ship's, the
      pickups' and the grazes' at the ship, the boss's ticks and broken
      attacks at the boss, and each explosion where it went off, which the
      model now keeps (`lastExplosionX`). The bomb, the warning and an
      extra life play in the middle. The edges pan to 0.8, never one ear
      alone.
    - **The audio view** keeps its structure: the same watched states and
      counts, the same metronomes. Its tests run on the headless Audio90,
      with a new one for where each sound plays. The music leaves the
      effects nine voices, where the Audio80 left four.
    - **Comparing:** the old score plays on `vnext`'s dev server, the new
      one on this worktree's. Both are rendered side by side in the
      worktree's `renders/packages/sites/arcade/src/entries/neon-monsoon/data/`:
      `music/` and `sounds/` are new, `zz-old-music/` and `zz-old-sounds/`
      the Audio80's. If the old score wins, this step's commit is reverted,
      and the game declares `'audio80'` again.
    - **The owner's first pass (2026-10-17):** the music is good, and the
      effects mostly, but the explosions sounded like drums, and with both
      volumes at half, the effects were lost under the music. The
      explosions, the ship's loss and the bomb were a sinking sine under
      noise, its filter closing to 160-500 Hz, where white noise has
      little left: a drum. They are now noise alone, the filter falling
      from bright to 500-1,200 Hz, and a random LFO jolting the cutoff 18
      to 40 times a second for crackle. Their loudness was the other
      fault: noise peaks far above its loudness, so matching the old
      effects' peaks had left the explosions at -30 to -36 LUFS, where the
      Audio80's were -20 to -27. Every effect's volume is now set by its
      loudness, measured as the songs' is: the guns, grazes and the boss's
      ticks at -29 to -31, the pickups, the warning and broken attacks at
      about -18, the explosions at -18 to -23 (as loud as their peaks
      allow), the bomb at -17 and the respawn at -16. The music stays at
      -20, as every song in the Arcade does.
    - **The owner's second pass (2026-10-17):** the most common sound, the
      guns' blip heard under every volley of enemy fire, was too loud and
      sounded off; and the explosions still sounded like instruments. The
      blip is now a soft, dark triangle tick through a gentle low-pass, at
      -38 LUFS. The explosions' resonance and random LFO had been playing
      random pitches, the classic computer bleep: the explosions, the ship's
      loss and the bomb are now white noise through a gentle 12 dB filter
      falling from bright, with no resonance, LFO or drive, the bigger ones
      stepping roughly down in volume for the debris. The owner then named
      the sound: the small explosion, which often plays just as enemies
      appear and fire, because they were hit at once. It is the commonest
      sound in the game, so it is now quiet, at -29 LUFS, ten below the
      large explosion's -19. As a dull thud of dark noise it still sounded
      like a drum, so it is a soft hiss of white noise: a high-pass at
      700 Hz cuts the thud, and it fades in over 8 ms rather than being
      struck. The guns' softer tick stays.
14. **Browsers**: Chrome, Firefox and Safari, on the desktop, Android and
    iOS, over `npm run dev:https`. **Done (2026-10-17), but for Safari and
    iOS,** which the owner tests once this is deployed through main; any
    issues are raised and fixed then:
    - **Chromium and Firefox, headless, on Windows:** the Sound Test, the
      Tune Tracker and Neon Monsoon each start their sound once clicked:
      the context runs, its clock advances, and the Audio90's worklet sends
      110 to 220 messages a second. No errors. Firefox warns that the
      context waited for a gesture, as it should, and that a WebGL context
      was lost, which Galaxy Raiders, on the Audio80, does too.
    - **Playwright's WebKit on Windows has no Web Audio at all** (no
      `AudioContext`), so Safari is tested on Apple hardware only. The page
      had said "Only a secure page has AudioWorklet" whenever the worklet
      was missing; it now says which: no HTTPS, or a browser without it.
    - **The owner played the entries on Android:** all pass.
    - **Safari and iOS** wait for the deployment through main, as the
      spike's Safari test does.
15. **Curate the tunes.** Added 2026-10-16, after the owner played the
    Tune Tracker. The Sound Test's eleven tunes were written quickly, to
    show the chip's techniques. Now that two demos play them, the owner
    listens to them as music: which to keep, which to polish, and whether
    any style the decade is known for is missing. Each change is heard in
    both demos, and the tunes' audio tests take new snapshots, each
    listened to first. **Started (2026-10-17):** the owner asked for a tune
    in each of four missing styles, and a longer club track in the spirit
    of French 79, all five for the owner to judge beside the first eleven:
    - **Copper Sky**, an Amiga module: four channels of samples bounced at
      16.5 kHz and 8 bits, panned hard in pairs, in the sampler character.
    - **Hairpin Night**, a racing game's Eurobeat at 156 BPM: an octave
      bass, offbeat stabs, a bright lead doubled in the chorus.
    - **Meadow Hop**, a 16-bit platformer: a whistled FM lead, a marimba's
      broken chords, a bouncing bass, swung, in the console character.
    - **Fuse Box**, big beat at 127 BPM: the jungle tune's break five
      semitones down, chopped, a driven riff, acid, a siren and the hit.
    - **Long Exposure**, melodic house at 122 BPM, 95 s a pass: warm chords
      a step apart, an arpeggio opening bar by bar, a rolling bass, a
      gliding lead, the pump, and a riser and clap roll into each drop.
    Each is at -20 LUFS. The new instruments and the Amiga's samples are in
    `src/tunes/`, named in `INSTRUMENT_NAMES`; the samples now take 197,000
    of the chip's 262,144. The owner finds the new four good but Copper
    Sky glitchy: a sound cut off on every repeat. Its chords' sample loops
    from 100 to 282 ms, but the song that bounced it released the note at
    250 ms, so each loop ended in 30 ms of silence. The bouncing song now
    holds its note for a second, longer than any sample made from it.
    **The owner's decisions (2026-10-17):** keep every tune but three.
    - **Lights Up** (eurodance) is deleted, with the hoover only it played.
      Fifteen tunes remain, and the two demos' cards say so.
    - **Warehouse Keys** sounded discordant in the keys. Its chords were one
      minor seventh moved down the scale, and the move down four semitones
      made F minor seventh, whose A flat and E flat are not in A minor. That
      bar now plays F major seventh, written out as patterns of its own
      (`grooveF`, `keysF`, `liftF`): A minor, F, D minor and E minor
      sevenths, the keys moving by step.
    - **Long Exposure** is rewritten as ambient house, which the owner
      asked to be "more ambient, smooth, dreamy, electric", as its chords
      were stereotypical. At 112 BPM, 86 s a pass: E major ninth, C major
      seventh with a sharp eleventh, A major ninth and C sharp minor ninth,
      two bars each, a third apart, all holding B and E. An FM electric
      piano sways between the speakers on an LFO timed in beats; two pads
      take turns, so each chord swells over the last one's release; a
      glassy FM arpeggio of three notes runs across the sixteenths through
      the ping-pong echo; wind is noise through a swept band-pass filter. A
      gliding lead comes in for the middle, and in the breakdown the bass
      holds E under every chord. The melodic house instruments gave way to
      seven new ones. Its ten channels are the most that fit the Tune
      Tracker's 800 pixels. The parts were balanced by rendering each alone
      and measuring its loudness, then the song set to -20 LUFS.
    The owner finds Warehouse Keys good now. Long Exposure was better but
    its arpeggio (channel 8) too sharp and intrusive, and its chord changes
    slightly discordant. The arpeggio's modulator was at three times the
    note, whose seventh harmonic is a sixth of a semitone flat of any
    piano note; it is now at the note, under a 1.8 kHz low-pass filter,
    with a softer attack, and 2.5 dB quieter. The C major seventh's G and
    D sat a semitone from the E chord's G sharp and D sharp, which the
    outgoing pad's release, the keys' push and the echo carried over each
    change. The chords now stay in E major, each a third below the last:
    E major ninth, C sharp minor eleventh, A major ninth and F sharp minor
    eleventh, still all holding B and E. The pads' saws are detuned less.
    **Done (2026-10-17):** the owner finds Long Exposure good now, and
    approves all fifteen tunes.
16. **Docs** (section 12). **Done (2026-10-17).**
    - **A new guide, Using the Audio90** (`packages/libraries/audio/docs/`):
      which chip suits which game, the engines and their options, samples
      and bouncing (hold the note to the end, loop whole cycles, bounce as
      the game loads), sound effects with a pan, the mix (pans and sends
      that add up, the three effects, the pump), the characters, scopes,
      direct calls, loudness (effects set by LUFS, not by peak), recipes
      for the decade's sounds, the originality rules for sound, and what
      goes wrong. It links to the Audio80's guide for what both share.
    - **Writing Tracker Music** gains a section on the Audio90: sixteen
      channels, the tokens it adds, its song settings, arranging habits
      (chords that share notes, two pads taking turns) and its errors.
    - **Using the Audio80** says the Audio90 exists and links to the
      comparison. **The package's README** describes both chips, lists the
      new guide, and names the Audio90's exported constants.
    - **The entries' README**: the originality rules cover sound, an
      Audio90 entry bounces its samples in `load`, and a new section says
      an entry of the 1970s to the 1990s sets its text in the pixel glyphs
      (`#pixel-glyphs`, `PixelTextView`, the overlay's `font: 'pixel'`).
    - **`AGENTS.md`**, **`skill-mvt-view.md`**, **the glossary** (new
      entries for the Audio90 and bouncing), **`llms.txt`**, **Sound and
      Music** and **Project Structure** name both chips.
    - **Hot Paths** gained "Numbers That Allocate": a closure variable or a
      choice between a double and a constant can box the double, and a
      bundled build is the one to profile. The owner removed it in review,
      as too subtle for most readers (section 17.6).
    - The new guide's code was run in a throwaway test, and the docs site
      builds.
17. **The cards' long text on demand.** Each entry's description,
    instructions and techniques, about 5.9 KB gzipped for every entry, load
    when a card's info opens, not in the home page's first load. Then the
    home page budget fails the build again (`IS_BUDGET_ENFORCED` in
    `packages/tests/checks/scripts/home-page-budget.ts`). The owner chose
    this over raising the budget (2026-10-16), and to do it last; until
    then the budget only warns, and a renderer in the first load still
    fails the build. **Done (2026-10-17).**
    - **Measured first:** the 21 entries' long text was 6.8 KB gzipped on
      its own, 4.0 KB of it descriptions. A search index of only their
      words would still cost 3.3 KB, so the search loads the text too.
    - **Each entry's long text** moved from `start/entry.ts` into
      `start/details.ts`, exported as `details: EntryDetails` (description,
      instructions, techniques). `ArcadeEntry` loses those three and gains
      `loadDetails()`, a dynamic import as `load()` is. A scratch script
      split all 21 entries.
    - **The model** keeps each entry's details (`detailsFor(id)`), and
      `loadDetails()` asks for every entry's. The page calls it just after
      its first frame. Opening an entry's info panel, or launching it, asks
      for that entry's at once. A load that fails can be asked for again.
      The search reads an entry's description and techniques once they
      arrive, and works the wall out again as each does, with no change to
      the URL. The info panel and the pause menu read the details.
    - **The home page's first load is 45.5 KB, of the budget of 50** (51.7
      before). Each entry's text is a chunk of 0.3 to 0.9 KB gzipped. The
      budget fails the build again: `IS_BUDGET_ENFORCED` is gone, the
      check as it was before step 11.
    - **Tested:** the model's new tests (the search before and after the
      text loads, each entry's text loaded once, on opening its panel, on
      launch, and again after a failure), the catalogue's (every entry has
      a description, every game instructions), and the built Arcade in
      headless Chrome: a URL searching a word only a description holds
      finds its entry once the text arrives, and the info panel shows the
      description and techniques. The Sound Test's and Tune Tracker's
      whole-screen images, which step 15 changed, are updated.
18. **Close.** Record what was built and measured in an "As Built" section,
    move this proposal to `archive/`, and put loose ends in a task.

---

## 16. The Spike (Step 1)

Built on 2026-10-16, on the `audio90` worktree branch from `81900f5`. Each
subsection records what was true on its date.

### 16.1 What was built

All of it is spike code, to be replaced by step 5's synthesiser. None of it
is exported from the package's barrels.

- **A synthesiser**, `packages/libraries/audio/src/spike-audio90/spike-synthesiser.ts`:
  the three engines (FM with four operators, a graph algorithm, feedback and
  the four operator waves; analog with up to seven unison copies, spread,
  chord memory, a sub oscillator and noise; samples with loops), a filter on
  every voice (a four-pole ladder with drive for 24 dB, a state-variable
  filter for 12 dB, band and high pass, two of each for a stereo voice), a
  volume and a mod envelope on each voice and an envelope on each operator,
  an LFO on each voice, constant-power pan, a chorus, a ping-pong echo, an
  eight-line feedback delay network reverb, the console character, and
  scopes. It has no command queue, clock, notation or driver, which the
  Audio90 would share with the Audio80. Notes apply at the start of the next
  render. It follows the Audio80's hot-path rules: state in typed arrays,
  controls every 32 samples.
- **Bouncing** (`spike-bounce.ts`), **a phrase player** (`spike-phrase-player.ts`,
  a stand-in for the music player, sample-accurate), and **the sounds**
  (`spike-sounds.ts`): fourteen patches, an orchestra hit bounced from FM
  brass, a chord-memory string stab, noise and a bass drum, and four demo
  phrases (FM piano stabs, a supersaw lead over a pad, an acid line with
  accents and slides, and orchestra hits with a bell and a reese bass).
- **A worklet** (`spike-processor.ts`), stereo, which plays the phrases or a
  busy mix, sends scopes, reports each second, and on request times itself.
- **A dev-only page**, `packages/sites/arcade/audio90-spike.html`, which runs an
  Audio80 playing a loop beside the spike's worklet on one audio context,
  and shows every number on screen, so a phone or a browser that cannot be
  automated can be measured by opening it. **A driver**,
  `packages/sites/arcade/scripts/audio90-spike-browser.ts`, runs the page in
  Playwright's headless Chromium.
- **Tests**: ten unit tests of the synthesiser (pitch for each engine, stereo
  spread, the ladder ringing at its cutoff, glides only between tied notes,
  determinism, every phrase finite and under full scale with no DC, the
  reverb's fade, the bounce, sample memory). **A benchmark suite**,
  `audio90-spike`, saved in `packages/tests/benchmarks/results/`. **A render
  script**, `npm run render-audio90-spike -w @mvtjs/audio -- <folder>`, writes
  the phrases as stereo WAV files for listening.

### 16.2 Measured

**The engines' cost, in Node** (`npm run bench -- audio90-spike`, saved). µs
per 128-sample stereo block at 48 kHz, every effect running. A block lasts
2667 µs:

| Engine | 1 voice | 8 voices | 16 voices | 24 voices |
| --- | --- | --- | --- | --- |
| The effects alone, no voices | 24 | | | |
| FM, four operators | 36 | 104 | 188 | |
| FM, console character | 37 | 127 | 213 | |
| Analog, one saw, 24 dB filter | 29 | 68 | 110 | |
| Analog, seven saws in stereo, two 24 dB filters | 37 | 110 | 197 | |
| Sample, looping | 26 | 42 | 61 | |
| A busy mix of every engine | | 87 | 152 | 219 |

The busy mix on sixteen voices takes 5.7% of a block, against section 11's
estimate of 8-11%. An FM voice costs about 10 µs a block, more than the
estimate of 6-8, and the most of any engine, level with the seven-saw
supersaw. A sample voice costs about 2 µs. The effects cost 24 µs, against
an estimate of 40-70.

**In Chromium, on the audio thread** (headless shell, the dev server, two
runs). The worklet has no `performance.now`, only `Date.now`, which counts
whole milliseconds. So its per-second means are not reliable for blocks far
shorter than a millisecond, and the worklet times itself instead: blocks
back to back for at least 100 ms per scenario. µs per block, the page's own
thread then the worklet:

| Scenario | Page | Worklet | Worklet, share of a block |
| --- | --- | --- | --- |
| The effects alone | 32 | 32 | 1.2% |
| FM x16 | 210 | 219 | 8.2% |
| Supersaw x16 | 180 | 185 | 6.9% |
| Acid x16 | 132 | 132 | 4.9% |
| Sample x16 | 76 | 77 | 2.9% |
| Mix x16 | 169 | 182 | 6.8% |
| Mix x16, scopes | 170 | 190 | 7.1% |
| Mix x16, console | 177 | 204 | 7.6% |
| Mix x24 | 241 | 247 | 9.3% |

Chromium runs the synthesiser 10-20% slower than Node, and the audio thread
is level with the page's thread. Everything is under section 11's 15% budget
for a desktop. A phone 2-4 times slower would put the 16-voice mix at 14-27%
and 24 voices at 19-37%, inside the 40% budget for a phone, but this is a
guess until a phone is measured.

**Allocation: none.** 0 bytes per block for every engine, the busy mix
included, after two fixes. The Audio80 allocates 523. Both causes were V8
boxing doubles, and both are worth a line on the Hot Paths page (048's
first item):

- The chorus's LFO phase, a closure variable, and a ternary that chose
  between it and a value computed from it, boxed the computed value once a
  sample: 2.1 KB a block, whatever played. Moved into a `Float64Array`.
- The console character's crossover step, `out > 0 ? STEP : out < 0 ? -STEP : 0`,
  mixed a small integer into a choice of doubles, so V8 boxed the doubles:
  16 KB a block. `Math.sign(out) * STEP` keeps it all doubles.

**An idle chip.** With no voices and the effects still running, a chip
costs 24-32 µs a block (about 1%). Once its voices are idle and its tails
have had four seconds to fade, it can skip rendering and write silence:
then it costs nothing measurable (3000 blocks skipped in a row in
Chromium). So section 7.2's loaded-but-idle chip needs no disconnecting: it
skips. The real chip's clock running dry does the same.

**Sample transfer.** A full sample memory, 512 KB, sent from the page to
the worklet: 0.3-0.8 ms there and back when copied, 0.1-0.2 ms of it in
`postMessage` on the main thread, and about 0.1 ms when transferred, over
three tries each. The 47 KB orchestra hit took 1.1 ms there and back,
stored. So section 4's "a note waits a few milliseconds" for its sample is
under 1 ms, and samples can go by copy, which leaves the main thread's copy
for the next session.

**Bouncing.** The orchestra hit (0.75 s at 32 kHz, seven voices of FM
brass, analog strings, noise and a bass drum) bounced in 20-25 ms, in Node
and in Chromium alike. That is about 30 ms per second of sample, so a full 8
seconds of samples as busy as this one would take about 250 ms, over
section 11's budget of 150 ms. Most samples would play fewer voices.
Options, for step 7: accept up to 300 ms in `load`, bounce in a worker
beside the textures' loading, or keep the bounced samples in the browser's
cache between visits.

**Two worklets, one context.** The spike's worklet loaded in 14 ms (the dev
server, unbundled), and ran in stereo beside the Audio80's, which played its
loop throughout. Neither stopped the other. Whether it sounds right was not
checked by ear.

**The output changes.** Each second, the page read the spike's output level
(RMS) from an analyser: it moved from second to second for every phrase
(the FM piano 0.04-0.24, the acid line 0.05-0.12), held steady for the busy
mix's held notes (0.17-0.27), and was 0.000 in both silent scenarios. So the
sound is not a stuck drone. In the first browser run, one block took about 9
ms as the acid phrase began, likely compiling; it did not recur in the
second run.

### 16.3 Not done

- **Safari**, on a desktop and on iOS, to try later. ~~Firefox and a
  phone~~: done by the owner (2026-10-16), in Firefox and on an Android
  phone, and it all works. Their numbers were not recorded. The page is
  ready for Safari: `npm run dev:https` in the worktree's
  `packages/sites/arcade`, open `/audio90-spike.html`, press "Start sound",
  then "Benchmark in the worklet" and "Benchmark on this thread".
- ~~**Listening.**~~ Done (2026-10-16). The owner listened to the WAV files
  from the render script (the FM piano, also with the console character,
  the supersaw, the acid line and the orchestra hits): "it sounds
  excellent". So the three engines, the filter, the effects and bouncing
  are right by ear as well as by test.
- **The production build.** The spike page is dev-only, so the build's
  bundling of a second processor was not checked. The Audio80's bundles as
  one self-contained script (045 section 16.1), and the Audio90's should do
  the same.
- ~~**The decisions** on open questions 6 and 7.~~ Decided by the owner
  (2026-10-16), as recommended: sixteen voices, and scopes from the
  worklet.

---

## 17. As Built: Measured, and Changed

Built from 2026-10-16 to 2026-10-17 on the `audio90` worktree branch, from
`vnext` at `53012eb`. The branch was brought up to `vnext` twice on
2026-10-16: at `b32f67b`, when the packages were grouped, and in
`e24de73`, when the website became `packages/sites/arcade`. Section 15's
steps record each step's details; this section gathers what holds at the
end.

### 17.1 What was built, and its size

| Where | What | Lines, and lines of tests |
| --- | --- | --- |
| `@mvtjs/audio`, `src/audio90/` | The synthesiser, the chip's interface and writer, and the notation: instruments, samples and bouncing, sound effects, songs, `formatAudio90Cell` | 4,456, and 1,038 |
| `src/shared/`, `src/web/`, `src/music-player/` | What both chips share: the command buffer and queue, the note driver, the voice allocator, the tracker grammar, the held writes, the runner, the browser's chip and one music player | 3,088, and 1,859 |
| The Arcade's `src/tunes/` | Fifteen tunes, their instruments, nine samples and ten effects | 4,494, and 129 |
| The Sound Test, the Tune Tracker | The two demos | 2,355, and 430 |
| `src/pixel-glyphs/` | The site's glyphs | 170, and 37 |

Each chip's worklet is a module of its own, which the build bundles as one
script: 14.1 KB for the Audio80 and 25.2 KB for the Audio90, minified,
before gzip. So the spike's doubt about bundling a second processor
(16.3) is settled.

### 17.2 Measured

- **The synthesiser** (Node 26, `npm run bench -- audio90`, results saved):
  the effects alone take 22 µs a 128-sample block. Sixteen voices take 167
  µs of FM (195 µs in the console character), 95 µs of acid bass, 140 µs of
  supersaws within the oscillator budget, and 96 µs of samples. A busy mix
  of every engine on sixteen voices takes 193 µs, 7.2% of a block, inside
  section 11's 15% for a desktop. Chromium's worklet ran the spike's mix
  10-20% slower than Node (16.2).
- **A song through the player**: 698 µs a tick of 800 samples, about 110
  µs a block.
- **Allocation**: under 1 byte a block for every engine, and 35 bytes a
  tick for a song through the player. The Audio80's went from 523 bytes a
  block to 0, from the same fix (step 9).
- **Bouncing**: an orchestra hit in 27 ms, a two-bar break at 26 kHz in 47
  ms, and all 8 seconds of sample memory, as busy as any song, in 139 ms
  dry, inside section 11's 150 ms. The Sound Test's samples take 197,000
  of the chip's 262,144.
- **The home page's first load**: 45.5 KB of its 50 KB budget, gzipped.
  It was 47.9 KB after step 6, and 51.7 KB before step 17, as each new card
  added its long text.
- **Loudness**: every song within 3 LU of the shared -20 LUFS, which the
  audio tests check. Neon Monsoon's effects run from -38 LUFS, the guns' tick, to -16, the respawn
  (step 13).
- **Tests**: 2,808 unit tests pass at the end. The one that fails is the
  playground's language service test, on this checkout's Windows line
  endings, which is 052's, not this proposal's (task 065).

### 17.3 Changed from the design

- **An operator's ratio** runs from 0.5 to 32, in halves, not to 16.
- **Noise** is white only. The Audio80's pitched noise was not carried
  over: white noise through the voice's filter made every sound that was
  asked for.
- **Sample memory** is 262,144 samples (`AUDIO90_SAMPLE_MEMORY`), 8.2
  seconds at 32 kHz, rather than 512 KB.
- **Pans and sends add up.** The instrument's, the channel's and the LFO's
  pan add, and the sends add up to at most 1. Brightness multiplies.
- **`bounce.ts`** is in `notation/`, since a sample bounces the first time
  its data is read.
- **The scopes** come from the worklet (open question 7): 64 points a
  voice, eight samples apart, and each voice's pan, about 90 times a
  second, off until a view asks.
- **A second demo**, the Tune Tracker, was added after the owner's first
  listening pass (step 11), with the music player's `orderIndex` and `row`
  and `formatAudio90Cell` to serve it.
- **Steps not in the first plan**: the shared pixel glyphs (12), the tunes'
  curation (15) and the cards' long text after the first paint (17). The
  last became necessary because each new card adds to the home page's first
  load.
- **The spike's code is gone.** The spike's synthesiser, its page, its
  render script, its browser script and its benchmark suite were removed as
  this proposal closed (step 18), since the chip replaced them. Section 16
  records what it measured, and git keeps it.

### 17.4 Learned

- **Set effects by loudness, not by peak.** Noise has a high peak for how
  loud it sounds, so matching the Audio80's peaks left Neon Monsoon's
  explosions 10 dB too quiet under the music.
- **Explosions are white noise** through a gentle filter. A sine under the
  noise sounded like a drum, and a resonant filter or a random LFO like an
  instrument.
- **A bounced note must be held to the end** of its sample. Copper Sky's
  chords gapped on every pass of their loop, because the bouncing song let
  go of its note 30 ms before the loop's end.
- **An FM modulator at three times the note** adds the seventh harmonic,
  about a sixth of a semitone flat of the piano's notes, which sounds sharp
  in a chord.
- **Chords that share notes change smoothly.** A pad's release, a push of
  the keys and the echo carry each chord into the next. A chromatic
  mediant's semitone clashed there in Long Exposure's first version.
- **V8 boxes doubles** in closure variables written often, and in a choice
  between a double and a constant. It shows only in a bundled build, so
  that is the one to profile. A section of the Hot Paths page said so, until
  the owner removed it as too subtle for most readers (section 17.6). A
  measurement for that review, 50 million writes in Node 26: a closure
  variable took 485 ms and 763 collections, a `Float64Array` 194 ms and
  none, an object field 195 ms and none, and a local in the loop 84 ms.

### 17.5 Not done

All in task [065](../tasks/backlog/065-audio90-follow-ons.md): Safari and
iOS; open questions 3, 4, 5 and 8; the tracker's bar against the chip's
lead; a search link that only a description matches; the
`games-and-demos` benchmark, before and after; whether to name the Amiga in
a style; and the notes on `vnext` to update as the branch merges. Smooth
window resizes are task 054.

### 17.6 Changed as the work was handed over

The work went to `vnext` in six chunks, each checked in a scratch worktree
before the owner reviewed it. The review changed three things:

- **The Sound Test was dropped** (2026-10-17). The Tune Tracker plays the
  same fifteen tunes, so the owner kept one demo. Its effects page and the
  ten sound effects only it played went with it. The Tune Tracker's text
  took over what the Sound Test's said of the chip and its tunes.
- **A starter's chip is inferred.** Entries wrote their chip twice, in
  `load()`'s return type (`Promise<PixiEntryStarter<'audio80'>>`) and in
  `soundChip`. Now an entry makes its loader with
  `export const load = definePixiLoader(async () => { ... })` (or
  `defineElementLoader`), whose generic works the chip out from the
  starter's `soundChip`, so `start` is given that chip as `sound` and no
  code writes a type argument. A bare `PixiEntryStarter` is any Pixi
  entry, as the host takes them.
- **The Hot Paths section on boxed numbers was removed.** The owner found
  it too subtle and esoteric for most readers, beside the page's other,
  easier advice. Its finding stays in section 17.4.

---

## 18. Progress Log

- **2026-10-16.** The proposal was written, against `vnext` at `53012eb`
  (`81900f5`). The spike was built and measured, and the owner found it
  excellent by ear (step 1, `5735dcb`). Steps 2 to 9 built the shared
  code, the renames, the entries' choice of chip, the synthesiser, the
  chip, the notation, one music player and the benchmark suite (`74caf47`
  to `a478554`). Step 10 built the Sound Test, with eleven tunes and the
  scopes (`e4ed967` to `afbf364`). The owner kept every tune, and step 11
  added the Tune Tracker, with the tunes moved to `src/tunes/` (`60af4a6` to
  `66b949b`). `vnext` was merged in, with the site now
  `packages/sites/arcade` (`e24de73`). Step 12 shared the pixel glyphs, and
  eight entries switched to them (`978b3a5` to `58520f9`). Neon Monsoon was
  rescored (`8da130b`).
- **2026-10-17.** The owner's three passes on Neon Monsoon's effects
  (`5250ac2` to `4d2311e`), and step 13 done (`d27c5ac`). Step 14's
  browsers, but for Safari and iOS (`80f82b2`, `83fbf64`). Step 15 added
  five tunes, dropped Lights Up, fixed Warehouse Keys and rewrote Long
  Exposure twice, and the owner approved all fifteen (`d2bc4f7` to
  `a20cb1a`). Step 16 wrote the docs (`b4682b1`). Step 17 moved the cards'
  long text after the first paint, and the budget fails the build again
  (`86e9886`). Step 18 removed the spike's code, wrote this section,
  archived the proposal and put its loose ends in task 065. The hand-over
  to `vnext` began in six chunks, and the owner's review dropped the Sound
  Test and had a starter's chip inferred (section 17.6).
