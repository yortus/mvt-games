# Proposal: music on the sound card's clock

> Move the music player's place in a song from the page to the audio
> thread, where the synthesiser runs. The sequencer there plays the song on
> the sound card's clock, as game audio engines do, so a late frame can no
> longer stall the music, however late it is. The game's ticks still gate
> it: it pauses when the game pauses, and stops when the ticks stop for
> good. Views keep the same `MusicPlayer` interface, but for `update`, and
> its `row` and `beat` become what the listener hears. Tests stay exact,
> because a headless chip runs the same sequencer on its own clock.

**Status:** proposed. Nothing built. The fixes that led here are in main,
unstaged, as of 2026-10-20 (section 2).

**Written:** 2026-10-20, against main at `4b0eabb5` plus the unstaged
chip-clock work. Measured on this desktop in Node and in Playwright's
headless Chromium shell, with CPU throttling standing in for a phone. No
phone has been measured yet.

**Related:**
[chip-clock.ts](../../packages/libraries/chiptune/src/web/chip-clock.ts),
[music-player/](../../packages/libraries/chiptune/src/music-player/),
[web-chip.ts](../../packages/libraries/chiptune/src/web/web-chip.ts),
[Sound and Music](../../packages/sites/docs/building-with-mvt/presenting-the-world/sound.md)
(its "Time" section),
[the Audio80 guide's Music and Time sections](../../packages/libraries/chiptune/docs/using-the-audio80.md),
[heard-row.ts](../../packages/sites/arcade/src/entries/tune-tracker/views/heard-row.ts),
[045](../archive/045-sound-chip.md) and [051](../archive/051-audio90-chip.md),
which built the chips.

| Decision | Recommendation | Section |
| --- | --- | --- |
| Where a song's place is kept | On the audio thread, beside the synthesiser | 4 |
| Which clock moves it | The sound card's, while the game runs | 5 |
| How a pause stops it | As the chip clock already tells: ticks that bring no time | 5.2 |
| What views see | The same `MusicPlayer`, without `update`. `row`, `beat` and `song` report what is heard | 6 |
| How tests stay exact | A headless chip runs the same sequencer on its own clock, so note logs are unchanged | 7 |
| What becomes of the lead | Kept, for writes a game stamps itself. Music no longer needs it | 8 |
| Where MVT's rules change | One exception: a sound renderer schedules within a song, as a display schedules within a frame | 9 |

---

## 1. The Problem

On a phone, the Tune Tracker's tunes play with short pauses at irregular
intervals, most of all Long Exposure. It happens on this desktop too, less
often.

The cause is not the synthesiser. Every tune renders in 2.3% to 4.2% of
real time in Node here, and Long Exposure is the costliest at 4.2%. The
cause is that the music depends on the page's frames arriving on time.

Today the music player is a view's presentation state. It advances in the
view's update step, and writes each row's notes stamped with the chip's
time. The chip's time advances only with the ticks. The worklet plays a
fixed distance, the lead, behind the newest tick. So any frame later than
the lead leaves the worklet with nothing to play.

Long Exposure shows it worst because it is sustained pads under a long
reverb, where any hole is heard. A drum-led tune hides some of its gaps
between hits.

## 2. What Was Done First, and What It Leaves

Three rounds, all on 2026-10-20:

1. **A lead that grew after each dropout** (35 ms to start, growing by the
   shortfall, up to 150 ms). Rejected in playtesting: dropouts were fewer,
   but still there, and the design guarantees them as it learns. Reverted.
   Do not reopen without new information.
2. **A fixed 100 ms lead, a harder catch-up, and stalls that hold.** This
   is in main, unstaged:
   - The lead is 100 ms.
   - The clock plays up to 2% slower to win back lead lost to long frames.
   - A frame later than the lead holds chip time still, while every voice
     keeps sounding, rather than fading to silence.
   - A pause fades out at once, and resuming fades back in at once.
   - `AudioControls.stallCount` counts the stalls. The Arcade's Perfmon
     shows the count.
   - `Audio90.heardTime` lets the Tune Tracker show the row being heard.
3. **This proposal**, for what round 2 cannot fix.

Measured in headless Chromium, playing Long Exposure, against the dev
server:

| CPU throttle | 35 ms lead, fading when dry | 100 ms lead, fading when dry | Round 2 |
| --- | --- | --- | --- |
| none (the shell draws at about 30 FPS) | 30 gaps in 20 s | 0 | 0 stalls in 30 s |
| 4x | 126 gaps in 20 s, silent 19% of the time | 0 | 0 stalls |
| 6x | not measured | not measured | 70 stalls, no silent gaps |

Round 2's stalls no longer drop out, but each is still heard: the music
stands still for a moment. At 6x they come from the game loop's longest
step, 50 ms. A frame longer than that loses chip time for good. About four
frames a second ran long, which drains the lead faster than a 2% slowdown
wins it back. No lead size fixes a steady drain, and no lead covers a
frame longer than itself.

## 3. What Other Systems Do

- **Game audio engines** (FMOD, Wwise, Unity's mixer) run the music's
  sequencer on the audio thread, on the sound card's clock. The game sends
  events and parameters, such as "play this", "pause the music bus" or
  "tempo 1.2". The mixer applies each at its next block. A stalled game
  frame cannot starve the music. Visuals sync to the music by asking the
  engine where it is, or through beat and marker callbacks.
- **Web Audio's standard pattern** ("A tale of two clocks") schedules notes
  about 100 ms ahead on the audio clock, from a timer on the page. A stall
  longer than that still makes notes late, but notes already scheduled play.
- **Emulators** (RetroArch) tie audio to emulated frames, as this repo
  does, and keep a buffer of 64 ms by default, with handheld guides
  suggesting 96 to 128 ms when the sound crackles. A stall longer than the
  buffer is heard.

This repo's chips work like the emulators. This proposal moves music to
how the engines do it.

## 4. The Design: a Sequencer Beside the Synthesiser

The worklet gets a sequencer: the music player's core, `createSongPlayer`,
with a driver that writes straight into the synthesiser's queue rather
than into the page's command buffer. Both are plain TypeScript with no DOM,
so they can run on the audio thread.

- **Songs are sent once, by id**, as instruments, effects and samples are
  today. A song is already plain data: its patterns' cells are a
  `Float64Array`, and its instruments are sent by id already.
- **Each music player on the page is one slot** in the worklet. Today a
  player owns its song's voices through `reserveVoices`, and effects take
  the rest. That stays in the synthesiser, unchanged.
- **The page sends commands, stamped "as soon as possible"**: play,
  queue, stop and tempo scale, each naming its slot and song. They take
  effect at the worklet's next block, within one frame plus one sound card
  request, about 20 to 40 ms. Today a song starts 100 ms after its tick,
  because of the lead, so this is quicker.
- **The worklet reports each slot's place** with each buffer it sends back,
  as round 2 reports the clock's place: the song, order index, row and beat
  it has reached, and the frame they are at. The page subtracts the sound
  card's latency, as `heardTime` does.

## 5. The Sequencer's Clock

### 5.1 The sound card's time, while the game runs

The sequencer advances by the time each block covers, at the sound card's
rate, whatever the ticks are doing. A late frame changes nothing it plays.
Nor does the 50 ms longest step: the game loop's clamp no longer touches
the music.

### 5.2 Gated by the ticks

The chip clock already tells three cases apart:

- **A pause:** ticks keep coming, but bring no time.
- **A stall:** no ticks come.
- **A stall that lasts:** no ticks for 300 ms, as in a hidden tab.

The sequencer stops on a pause, so pausing still pauses the music, notes
held where they are, and resumes on the next tick that brings time. It
plays on through a stall. It stops after a stall that lasts, as the music
does today, unless open question 1 decides otherwise.

### 5.3 What `tempoScale` becomes

Four games set `tempoScale` from play every tick. Burrow Bust holds its
walk tune while the digger stands. Galaxy Raiders hurries when few enemies
are left. Crumb Chase and Fenceline follow play too. The page sends a
tempo command only when the scale changes, so a scale held at 0 costs
nothing. It takes effect at the next block, rather than at its tick's
exact chip time. Nobody will hear 20 to 40 ms on a tempo change.

## 6. What Views See

The `MusicPlayer` interface stays, so the ten audio views that use it barely
change:

- `play`, `queue`, `stop` and `tempoScale` work as now. `refresh` sends
  them, as it sends notes now.
- `update` goes. The view's update step no longer advances the music, so
  most audio views lose their update step entirely.
- `song`, `isPlaying`, `orderIndex`, `row` and `beat` come from the
  worklet's reports. So they are what the listener hears, not what was last
  written. The Tune Tracker's `heard-row.ts` view model goes, and its views
  read the player again.
- `song` and `isPlaying` lag a call to `play` or `stop` by a message. The
  player should answer from what it was last told until a report arrives,
  so `music.song === STAGE_TUNE` (Galaxy Raiders) stays true at once after
  `play(STAGE_TUNE)`.

## 7. Tests and Determinism

The audio views' tests check the exact notes a song writes, at exact chip
times, such as "holds the walking tune while the digger stands". They must
keep doing that.

A headless chip runs the same sequencer in-process. A recording chip
advances it with `AudioControls.update`, by the ticks, and logs the notes
it writes as it logs them today. A rendering chip advances it by the
samples it renders. So the same ticks still make the same notes, and the
tests, thumbnails, loudness checks and sample hashes stay as they are.

What does change is in a browser only: where the music is at a given tick
depends on the sound card's timing. Nothing in the Arcade depends on that,
and the reported `row` and `beat` say where it is.

## 8. What Becomes of the Lead

Once music leaves the tick path, nothing in the Arcade writes notes stamped
with chip time. Effects are already "as soon as possible", and only the
music player calls `noteOn` and its kin (checked 2026-10-20, outside tests).
The library still lets a game stamp its own writes, so the chip clock, its
lead and its stalls stay for those. Whether the lead can then shrink is
open question 4.

The metronome's repeating sounds (15 uses) are effects played as a
view's metronome counts beats on the ticks. A stall delays one, which is
an effect played late, not a gap in the music. They stay as they are.

## 9. MVT's Rules

Rule 2 says views hold no autonomous animations, and AGENTS.md says
"Music and repeating sounds are presentation state, advanced in the update
step". This design breaks the second for music. The argument for an
exception:

- **A display can repeat a frame, and a sound card cannot.** A late frame
  shows the last picture again, and almost nobody notices. A late block of
  sound is a gap, and everybody hears it. So scheduling within a song
  belongs to the sound renderer, as scheduling within a frame belongs to
  the display.
- **The view still decides what plays.** Which song, when it starts and
  stops, and its tempo are still the view's presentation state, written in
  its refresh step from its bindings. Only the place within the song moves
  to the renderer.
- **The ticks still own the game's time.** Pausing, the headless clock and
  the tests all still follow them.

The Sound and Music page already describes two kinds of sound library:
those that keep their own time and those that follow the ticks. This is a
third: the library keeps the song's time, and the ticks gate it.

## 10. Costs and Risks

- **Worklet size.** The Audio90 worklet is 26.3 KB (10.1 KB gzipped) in
  the last build, and the Audio80's is 14.2 KB (5.7 KB gzipped). The music
  player, its drivers and the song writers add to both. They load on the
  first press, not in the home page's first load, so the home page budget
  is untouched. The spike measures the cost.
- **A wider message protocol:** song definitions, four commands and the
  slot reports, each with tests in the fake audio context.
- **Held writes while the context is suspended.** Today a song started
  while audio cannot play keeps advancing, its notes dropped, and is heard
  part way through once audio starts. The new protocol must decide the
  same case (open question 2).
- **Two pieces of music state.** The page's player and the worklet's slot
  must agree after a reset, a destroy, and a song that ends by itself.

## 11. Settled Questions

- **The synthesiser is fast enough.** 2.3% to 4.2% of real time in Node on
  this desktop (section 1). Do not reopen without new information.
- **A lead that learns by dropping out is rejected** (section 2). Do not
  reopen without new information.
- **A larger fixed lead alone is not enough.** It does not survive a frame
  longer than itself, nor the drain of the 50 ms longest step (section 2).

## 12. Open Questions

1. **A hidden tab.** Should the music stop after 300 ms with no ticks, as
   today, or play on, as most engines do? Recommend: stop, since the game
   behind it has stopped.
2. **A song started while audio cannot play.** Should it start from the
   beginning when audio starts, or from where it would have got to, as
   today? Recommend: from where it would have got to, so that a jingle that
   has passed does not play late. The page can send how much game time has
   passed since `play`.
3. **`update` on `MusicPlayer`.** Remove it at once (0.x allows it), or
   keep it as a no-op for one release? Recommend: remove it, with a
   changeset that says so.
4. **The lead.** Once music no longer needs it, should it drop back towards
   35 ms for stamped writes, or stay at 100? Decide after measuring a phone.
5. **The Perfmon's stall count.** Should it go on counting stalls of
   stamped writes, which the Arcade no longer makes, or count something
   music-specific, such as blocks the worklet rendered late?

## 13. Implementation Steps

1. Spike on a branch: run `createSongPlayer` and an Audio90 driver in the
   worklet, with songs sent by id, and only play and stop. Measure:
   - the worklet's added size,
   - Long Exposure at 6x throttle (stalls, and silent gaps),
   - Long Exposure with a forced 250 ms busy loop on the page every 2 s,
     which should be inaudible,
   - and, if possible, the user's phone, with the Perfmon open.
2. The full protocol: song definitions, play, queue, stop and tempo scale
   by slot, held writes while suspended, and slot reports with the buffer
   replies. Both chips.
3. The page's `MusicPlayer` on the new protocol, answering `song` and
   `isPlaying` at once and `row`, `orderIndex` and `beat` from reports.
   Remove `update`.
4. The headless chips running the same sequencer, recording and rendering.
   The audio views' tests should pass unchanged, apart from dropping their
   `update` calls.
5. The ten audio views: drop their update steps. The Tune Tracker: drop
   `heard-row.ts`.
6. Docs:
   - AGENTS.md's "Sound is a view's job".
   - The view skill's "Music and repeating sounds".
   - Sound and Music's "Time" section, with the third kind of library.
   - The Audio80 guide's Music and Time sections.
   - The Audio90 guide's "Showing the Music as It Is Heard".
   - Architecture rule 2, if the exception belongs there.
7. A changeset (breaking, for `MusicPlayer.update`), and a decision on
   open question 4.
