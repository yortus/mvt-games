# Sound: Follow-Ons From the Audio80

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-09 |
| Updated  | 2026-10-17 |

## Description

Proposal 045 built the Audio80 sound chip (`@mvtjs/chiptune`) and gave every
game in the Arcade its sound. It was archived on 2026-10-09. This task holds
what it left open. None of it is needed for the sound to work. Each item can
be done on its own, or dropped.

### Small fixes

- ~~**Boxed doubles on the Hot Paths page.**~~ Dropped (2026-10-18). 051
  wrote a section on it, and the owner removed it in review, as too subtle
  for most readers. The chip's first build allocated
  on every block of samples. V8 boxed the doubles held in closure variables
  that changed every sample, and the doubles passed to and returned from
  helpers it did not inline. Typed arrays fixed it. The Hot Paths page has no
  line on this yet: a double that crosses a call that is not inlined is
  boxed. See 045 section 16.1.
- **`findSounds` and arrays.** `findSounds`, in `@mvtjs/chiptune/headless`,
  finds the sound effects and songs that a module exports. It does not look
  inside an exported array. So Kwazy Cactii's audio test adds its
  `CASCADE_FANFARES` by hand. See 045 section 16.3.
- **A slide over several rows.** In the tracker notation, a slide (`u` or
  `d`) lasts one row. A slide over several rows repeats its token on each
  row. A way to write it once may read better. See 045 section 16.3.

### Open design questions

These are 045's open questions 5, 6, 7 and 9 (045 section 14).

- **Effects borrowing music voices.** Task 065 asks the same for the
  Audio90, so the two can be decided together. C64 games often let a sound effect
  take a voice from the music, so the tune lost a part for the length of an
  explosion. It is authentic, and it frees voices. It could be an option on
  the song, such as `yieldsToEffects: [2]`.
- **iOS's silent switch.** On iOS, the silent switch mutes Web Audio unless
  the page asks for media playback, with `navigator.audioSession`. Should the
  Arcade ask?
- ~~**Publishing the package.**~~ Done in 055 (2026-10-18): renamed
  `@mvtjs/chiptune` and made ready for npm, with the Audio80 guide's "A
  Page's Sound, in Full" showing the Arcade's `PageSound` as an example.
- ~~**A Sound Test entry.**~~ Dropped (2026-10-17). 051 built one on the
  Audio90, and the owner dropped it, since the Tune Tracker plays the same
  tunes. A demo in the Arcade, like the sound test menus of
  16-bit games. It would be a jukebox of every entry's sounds and tunes, with
  a scope for each voice. It would show the chip off, and give composers a
  page with hot reload.

### Docs: keep the MVT pages about MVT

The MVT docs should teach how to give an MVT game good sound. How the
Audio80 works, and how to use its API, belongs in the package's own docs,
with links from the MVT pages. Most of "Sound and Music"
(`packages/sites/docs/building-with-mvt/presenting-the-world/sound.md`) already
does this. Its sections on why sound is presentation, finding the moment,
what the model exposes, audio views in a list, and common mistakes are
about MVT. Some parts slip into teaching the library:

- **"Testing"** shows `createHeadlessAudio80`, `AudioControls.update` and
  the chip's `log`. The MVT lesson is that a view's sound output is a
  binding, so a test can pass a stand-in that records what the view plays,
  and assert the exact sound. A plain object with a `play` method that
  pushes into an array would show that with no library. The paragraph on
  audio tests can say what they are for and link to the package.
- **"Time"** describes the Audio80's clock: writes stamped with the chip's
  time, and sound effects played as they arrive. The MVT lesson is shorter.
  Sound should follow the ticks, not the wall clock, so that pausing pauses
  it and the same ticks always sound the same. The chip's mechanism is in
  the Audio80 guide's "Time" section.
- **"Sound Over Time"** keeps its metronome example, since the metronome is
  in `@mvtjs/utils`. The music player paragraph names `MusicPlayer.update`,
  `refresh`, `play` and `computeSongDurationMs`. It can say the same in
  general terms: a tune's place is presentation state, advanced in the
  update step and played in the refresh step, and a new song cuts the old
  one off, so a jingle should be no longer than its phase.
- **Testing Views, "Testing Audio Views"**
  (`packages/sites/docs/building-with-mvt/iterating-with-confidence/testing-views.md`)
  has the same issue as "Testing", with a `createHeadlessAudio80` example.
  The same recording stand-in would suit it. "For music, compare the notes
  with a music player" is library-specific too.
- **The glossary** (`packages/sites/docs/reference/glossary.md`) defines
  `AudioControls` and "Tracker notation". These are the package's terms, not
  MVT's, so they belong in the package's docs. "Audio80" and "Music player"
  can stay as short project-convention entries that link to the package,
  as other "this project's" entries do.

These are fine as they are:

- The "Project convention" box on the Sound and Music page, which names the
  Audio80 and says any sound library would do.
- The example audio view, which plays on an Audio80 as the repo's views do.
- `packages/sites/docs/ai-agents/skill-mvt-view.md`, which is for agents working
  in this repo, so its specifics are what they need.
- The other pages that mention audio views (Change Detection, Why Polling,
  Presenting Collections, Presentation State), which only use them as
  examples of MVT ideas.

**Who owns the clock.** The pages also assume that sound follows game time,
which is true of the Audio80 but not of most sound libraries. Libraries such
as @pixi/sound, Howler and the Web Audio API play on the audio device's
clock. A view can start, stop, pause and resume a sound, and change its
volume or speed. But once a sound starts, it plays in real time, not with
the game's ticks. The Audio80 is unusual: the game loop advances its clock
with the models' `deltaMs`, so its sound follows game time like everything
else in MVT. The pages should teach both:

- **With any library**, audio views trigger sounds on a change, and the
  advice on finding the moment, counts, lists and common mistakes holds. But
  the library owns time. So a paused game must pause its sounds itself,
  from the audio view as it sees the pause, or from the game loop. "A paused
  game is quiet" is only half true then: no new sound starts, but the sounds
  already playing carry on, the music among them. A song's place is the
  library's, so the view's presentation state is only which song should be
  playing. A test can check what the view triggered, but not the timing
  after it.
- **With a tick-driven output** such as the Audio80, pausing, a steady
  tempo, the same sound from the same ticks, and audio tests all come free.
  The page can present this as the ideal, and say why this repo chose it,
  but not as how sound works in general.

The revision is about 100 to 150 lines over three files, most of them in
Sound and Music. Check it against the visual tests docs, which had the same
review, so the two read alike.

### Music for the demoscene demo

Proposal 035 (a demoscene demo) defers its music. Once 035 is built, it can
use the Audio80. That work belongs to 035.

## Acceptance Criteria

- [x] The Hot Paths page explains boxed doubles, or the item is dropped.
- [ ] `findSounds` finds sounds inside exported arrays, or the item is
      dropped.
- [ ] A slide over several rows can be written once, or the item is dropped.
- [ ] Each open design question is decided, built or dropped.
- [ ] The MVT pages teach sound as MVT, and leave the Audio80's own API to
      the package's docs.
- [ ] The MVT pages say what changes when a sound library owns the clock,
      including pausing sounds that are already playing.

## Progress Log

- **2026-10-09.** Created from 045's loose ends, as 045 was archived.
- **2026-10-11.** Added the docs item. The owner found that the visual
  tests docs taught the library rather than MVT, and asked whether the
  sound docs did too. They do, in three sections of one page, one section
  of another, and two glossary entries. The owner also asked whether most
  sound libraries leave a view little control once a sound starts. Mostly
  yes: they play on the audio device's clock, not the game's ticks. So the
  pages should say what changes then, including pausing sounds already
  playing.
- **2026-10-17.** 051 wrote a Hot Paths section on boxed doubles, which
  the owner then removed as too subtle, and built a Sound Test on the
  Audio90, which the owner then dropped. Its
  follow-ons are task 065.
