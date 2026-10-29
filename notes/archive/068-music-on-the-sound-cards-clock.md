# Proposal: music on the sound card's clock

> Move the music player's place in a song from the page to the audio
> thread, where the synthesiser runs. The sequencer there plays the song on
> the sound card's clock, as game audio engines do, so a late frame can no
> longer stall the music, however late it is. The game's ticks still gate
> it: it pauses when the game pauses, and stops when the ticks stop for
> good. Views keep the same `MusicPlayer` interface, but for `update`, and
> its `row` and `beat` become what the listener hears. Tests stay exact,
> because a headless chip runs the same sequencer on its own clock.

**Status:** done. Built on 2026-10-21 in the worktree
`.claude/worktrees/068-music-on-the-sound-card` (branch
`068-music-on-the-sound-card`), and committed on 2026-10-27 as `0ebacfec`,
on the branch `audio90`. Both chips have a sequencer, every entry's music
plays on it, and the docs say so. Section 15 says what was built, where it
differs from the plan, and what was measured. The spike before it was
confirmed on the user's phone over Bluetooth (section 14.4). The one thing
left, trying the full build on a phone, moved to
[074](074-audio90-standalone-package.md), before `audio90` is
published.

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
[song-sequencer.ts](../../packages/libraries/chiptune/src/web/song-sequencer.ts),
[web-song-slots.ts](../../packages/libraries/chiptune/src/web/web-song-slots.ts),
[headless-song-slots.ts](../../packages/libraries/chiptune/src/headless/headless-song-slots.ts),
[045](../archive/045-sound-chip.md) and [051](../archive/051-audio90-chip.md),
which built the chips.

| Decision | Recommendation | Section |
| --- | --- | --- |
| Where a song's place is kept | On the audio thread, beside the synthesiser | 4 |
| Which clock moves it | The sound card's, while the game runs | 5 |
| How a pause stops it | As the chip clock already tells: ticks that bring no time | 5.2 |
| What views see | The same `MusicPlayer`, without `update`. `row`, `beat` and `song` report what is heard | 6 |
| How tests stay exact | A headless chip runs the same sequencer on its own clock, so note logs are unchanged | 7 |
| What becomes of the lead | Kept at 100 ms, for writes a game stamps itself. Music no longer needs it | 8, 12 |
| Where MVT's rules change | Nowhere in the rules. The sequencer is the sound renderer's, not a view's: it schedules within a song, as a display schedules within a frame | 9, 15.3 |

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
- **A stall that lasts:** no ticks for a second, as in a hidden tab (300 ms
  before the spike, section 14.1).

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

## 12. Open Questions, Decided

All five were decided as recommended, on 2026-10-21, as the work was done.

1. **A hidden tab:** the music stops after a second with no ticks. The
   clock already fades out then, and the sequencer moves only in blocks the
   worklet renders.
2. **A song started while audio cannot play:** it skips ahead to where it
   would have got to. Each call carries the chip time it was made at, and
   the sequencer skips by however far its clock is past it. The settings the
   song writes on the way apply at once, and the notes it passed are left
   out.
3. **`update` on `MusicPlayer`:** removed, with a changeset that says so.
4. **The lead:** stays at 100 ms. Nothing in the Arcade stamps its own
   notes any more, so it costs nothing, and a shorter one would only matter
   to a game that does. Do not reopen without a game that needs it.
5. **The Perfmon's stall count:** kept, as "Chip stalls". A stall no longer
   touches the music, but the count still shows frames that reach the
   chips late.

## 13. Implementation Steps

1. ~~Spike: run `createSongPlayer` and an Audio90 driver in the worklet,
   with songs sent by id, and only play and stop. Measure the worklet's
   added size, Long Exposure at 6x throttle, and Long Exposure with the
   page frozen on a timer.~~ Done, 2026-10-20 (section 14). Still to do:
   the user's phone.
2. ~~The full protocol: song definitions, play, queue, stop and tempo
   scale by slot, held writes while suspended, and slot reports. Both
   chips.~~ Done (section 15.1). The places come back as their own
   messages, not with the buffer replies.
3. ~~The page's `MusicPlayer` on the new protocol, answering `song` and
   `isPlaying` at once and `row`, `orderIndex` and `beat` from reports.
   Remove `update`.~~ Done.
4. ~~The headless chips running the same sequencer, recording and
   rendering.~~ Done. The audio views' tests pass, apart from a change to
   when a tempo takes effect (section 15.2).
5. ~~The ten audio views: drop their update steps. The Tune Tracker: drop
   `heard-row.ts`.~~ Done. Views that set a tempo now set it in their
   refresh step (section 15.2).
6. ~~Docs.~~ Done: AGENTS.md's "Sound is a view's job", the view skill,
   Sound and Music's "Time" section with a third kind of library, the
   Audio80 guide's Time and Music sections, the Audio90 guide's "Showing
   the Music as It Is Heard", the headless README, the package README and
   the glossary, which gains "Sequencer". Architecture rule 2 is unchanged
   (section 15.3).
7. ~~A changeset, and a decision on open question 4.~~ Done:
   `.changeset/music-on-the-sequencer.md`, a minor bump. Question 4 is
   decided in section 12.
8. ~~Move the branch to main.~~ Done: committed as `0ebacfec` on
   2026-10-27. Trying the full build on a phone moved to 074.

## 14. The Spike

Built on 2026-10-20, in main, unstaged.

### 14.1 What it is

- **In the worklet:** `audio90-sequencer.ts` runs a stock music player
  through a second command writer. The writer's new `idOf` option names
  each instrument by the id the page gave it, so the two writers' ids never
  clash. Before each block the worklet renders, the sequencer moves the
  song on by the block's length at the sound card's rate. It then restamps
  each write with the chip time of the sample it falls on, and queues it
  with the page's writes. So it plays only in blocks the worklet renders,
  and it stops when the clock pauses or waits, as the game does.
- **Messages:** `song` sends a song once, after its instruments, under the
  page's ids and without their samples. `song-play` and `song-stop` start
  and stop it. The worklet sends `song-row`, with the frame it starts at,
  each time the sequencer reaches a new row.
- **On the page:** the Audio90 gains optional `playSong`, `stopSong` and
  `songPlace`. Only the browser's chip has them. `songPlace` finds the
  newest reported row that has reached the speaker, from the speaker's
  frame that `heardTime` already works out.
- **In the Tune Tracker:** `tracker-playback.ts` plays on the chip's
  sequencer where the chip has one. Elsewhere, as on the headless chip that
  draws the thumbnail, it falls back to a music player and `heard-row.ts`.
- **One change to the clock:** a stall now lasts up to 1 second, rather
  than 300 ms, before the clock fades out. A song on the sequencer plays on
  through a stall, so the limit only has to catch a hidden tab.

### 14.2 Measured

In headless Chromium against the dev server, playing Long Exposure for 30
seconds. "Row timing error" is how far each row started from a row's length
after the one before it. A block is 2.7 ms.

| Conditions | Clock stalls | Worst row timing error | Silent gaps |
| --- | --- | --- | --- |
| No throttle | 0 | 2.1 ms | 0 |
| 6x CPU throttle (frames up to 233 ms) | 15 | 2.1 ms | 0 |
| Page frozen 250 ms every 2 s | 14 | 2.1 ms | 0 |
| 4x throttle, page frozen 400 ms every 3 s, 300 ms stall limit | 9 | 125 ms | 9, about 100 ms each |
| The same, with the 1 s stall limit | 9 | 2.1 ms | 0 |
| Page frozen 700 ms every 4 s | 7 | 2.1 ms | 0 |

The clock's stalls still happen, but the Tune Tracker's music no longer
waits for them. The 300 ms limit was the only thing left that a stalled
page could hear, which is why it went to 1 second.

The Audio90 worklet grew from 27.8 KB (10.6 KB gzipped) to 38.3 KB
(14.1 KB gzipped), bundled with rolldown and minified. It loads on the
visitor's first press, so the home page's budget is untouched.

### 14.3 What the spike leaves out

- **Only play and stop:** no `queue` and no `tempoScale`. The Tune Tracker
  uses neither.
- **The Audio90 only.** The Audio80 and the other entries are untouched.
- **The Perfmon's "Music stalls"** still counts the clock's stalls. On the
  Tune Tracker, the music now plays through them, so the count no longer
  says whether the music was heard to stall.
- **Allocations:** a `song-row` reply allocates a small object on the audio
  thread, about eight times a second for Long Exposure.
- **Held writes:** a song played before the worklet runs waits with the
  other messages, and starts from its beginning once the worklet runs.

### 14.4 Found on the phone, 2026-10-21

- **The music played without gaps**, over Bluetooth, with a few very brief
  glitches. The frames were steady and the CPU low.
- **The clock still stalled**, about 8 times in under a minute, with no
  dropped frames. Ticks reach the worklet late without the page being late,
  which fits the sound card asking for sound in large requests over
  Bluetooth. The Tune Tracker's music plays through these stalls now.
- **Pressing down quickly hung the tab.** Each press starts the next tune,
  and `songPlace` went on reporting the old tune's rows until the new
  tune's sound reached the speaker, which over Bluetooth takes a while. The
  pattern view read the new tune with the old tune's place, past the end of
  its order, and the exception stopped the page's loop. Fixed: each
  `song-row` carries its song's id, the page keeps only the rows of the song
  it last asked for, and the Tune Tracker's playback checks every place
  against the tune it played. Step 3 must keep both: a reported place
  always lags a change of song.
- **After that fix**, on the same phone over Bluetooth, the Tune Tracker
  sounds and works well, the rapid presses included (the user, 2026-10-21).

## 15. As Built

Built on 2026-10-21, in the worktree, on top of the spike.

### 15.1 What was built

- **Both chips have a sequencer.** `web/song-sequencer.ts` is one sequencer
  for either chip, which the chip runner moves on before each block it
  renders. Each slot plays through a song player (`SongPlayer`, the old
  music player's engine, now internal) on a writer and a clock of its own.
  So one slot can skip ahead without moving the others. The Audio80's
  command writer gained `idOf` and `defineInstrument`, as the Audio90's did
  in the spike, and the Audio80 gained an `Audio80Writer`, as the Audio90
  has.
- **The chips' interface.** Each chip has `openSongSlot()`, which returns a
  `SongSlot`: `play`, `queue`, `stop`, `setTempoScale`, and the `song`,
  `orderIndex`, `row` and `beat` heard. The spike's `playSong`, `stopSong`
  and `songPlace` are gone. `createMusicPlayer` opens a slot, keeps its
  calls until `refresh`, and answers with the song asked for until then.
- **The protocol.** `song` sends a song once, under an id. `song-call` asks
  a slot to play, queue, stop or change its tempo, stamped with the chip
  time it was made at and the slot's generation. The worklet sends
  `song-place` as a slot reaches a new row, or takes a call, with the
  generation of its last call. A call that changes the song raises the
  generation, and the page keeps only the places of the latest one. That
  replaces the spike's song ids on rows, and it covers a place of the same
  song played again, which song ids did not.
- **The page's side.** `web/web-song-slots.ts` keeps the places, and
  reports the newest that has reached the speaker. The beat heard is the
  place's beat, moved on by the time since, at its tempo. Song messages
  wait with the others until the worklet runs.
- **Headless chips.** `headless/headless-song-slots.ts` runs a song player
  for each slot on the chip itself, moved on by `AudioControls.update`. A
  call takes effect at once, so a recording chip logs the same notes, at
  the same times, as the old music player did. `renderSong` drives the song
  player directly, so the sound tests' hashes are unchanged.
- **The Arcade.** The page's chip slots open song slots lazily, once their
  chip has loaded. The Tune Tracker reads its music player again, and shows
  a place only when the player's song is the tune shown. The Perfmon's line
  is "Chip stalls".

### 15.2 Where it differs from the plan

- **A tempo takes effect a tick later.** The sequencer has already played
  the tick a view refreshes in, so a tempo the view sets then applies from
  the next tick. In Burrow Bust, the walking tune moves on one tick (16 ms)
  after the digger does, and its test says so. To start a song at a new
  tempo, a view sets `tempoScale` in its refresh step, after `play`, and
  the player sends the tempo ahead of the song. Burrow Bust, Crumb Chase,
  Fenceline and Galaxy Raiders moved their tempos from the update step to
  the refresh step for this.
- **The headless advance refreshes every step.** `advanceHeadless`, which
  draws the thumbnails, used to refresh once at the end. A music player
  sends what it plays as it refreshes, so the Tune Tracker's tune never
  started. Each step now refreshes, as each frame does. Fenceline's
  thumbnail changed: its list makes each sheep's view as it refreshes, so
  the sheep now arrive earlier and are part way through their steps. The
  reference image was updated after a look. Every other image is
  unchanged.
- **Places travel on their own**, not with the buffer replies, so a slot
  that reaches a new row between ticks sends it then.

### 15.3 Architecture rule 2

The rule says views hold no autonomous animations. The sequencer is not a
view's: it belongs to the sound chip, as the compositor belongs to the
display. The view still decides what plays, and writes it in its refresh
step. So the rule stands as it is, and the exception lives in Sound and
Music's new "When the Library Keeps the Time, and the Ticks Pause It".

### 15.4 Measured

In Playwright's headless Chromium shell, against a build of the worktree.
"Row timing error" is the most a row started from the median row length
after the one before. Rows are reported at the start of the block they fall
in, so a block, 2.7 ms, is the finest this can see.

| Entry, chip | Conditions | Clock stalls | Worst row timing error | Silent gaps |
| --- | --- | --- | --- | --- |
| Tune Tracker, Long Exposure, Audio90 | None | 0 | 2.7 ms | 0 |
| | 6x CPU throttle | 8 | 2.7 ms | 0 |
| | Page frozen 250 ms every 2 s | 9 | 2.7 ms | 0 |
| | 4x throttle, page frozen 700 ms every 4 s | 4 | 2.7 ms | 0 |
| Galaxy Raiders, Audio80 | None | 0 | 2.7 ms | 0 |
| | Page frozen 250 ms every 2 s | 7 | 2.7 ms | 0 |

Pausing Galaxy Raiders with Escape for 3 seconds: no rows while paused,
and 30 rows in the 3 seconds after it resumed. Pressing down 15 times, 50
ms apart, in the Tune Tracker: no page errors.

The built worklets grew from 14.2 KB (5.7 KB gzipped) to 27.4 KB (10.3 KB
gzipped) for the Audio80, and from 26.3 KB (10.1 KB gzipped) to 39.6 KB
(14.7 KB gzipped) for the Audio90. They load on the visitor's first press,
so the home page's first load is unchanged.
