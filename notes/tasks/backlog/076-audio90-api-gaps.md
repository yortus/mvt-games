# audio90: Gaps in the API

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-29 |
| Updated  | 2026-10-29 |

## Description

Proposal [074](../../archive/074-audio90-standalone-package.md) published the
sound chips as `audio90` 0.8.0. Writing its guides found places where the
API falls short: things a page can't do, or does with a confusing error.
None of them blocked the release. Together they suit a 0.9.0. Each item
can be done on its own, or dropped. Each change people would notice needs a
changeset, an update to the guides, and, if it changes a sound, a song or
sound added to the reference set (`src/reference-sounds.test-support.ts`).

[065](065-audio90-follow-ons.md) holds the Arcade's follow-ons from building
the Audio90, and [048](048-sound-follow-ons.md) the Audio80's. This task is
the package's own.

### Things a page can't do

- **A sound-effects chip can't change its effects.** Only a song sets a
  chip's filters and echo (Audio80), or its reverb, echo, chorus and
  character (Audio90). A chip that only plays sounds keeps their starting
  settings for good: on the Audio80, each filter is a 2,000 Hz low pass
  with no resonance, and the echo 300 ms, 0.35 feedback and a level of 0.5.
  A game that wants a dry room, or a longer echo, for its sound effects has
  no way to get one, short of playing a silent song that sets them. 074
  section 5.9 removed the setters on purpose, so the fix should keep the
  API small: the settings as options to `createAudio80` and `createAudio90`
  (and the headless and rendering chips), say, not setters to call at any
  time. The Audio80 guide documents today's defaults, and would change
  with it.
- **A scope doesn't say where its newest point is.** `Scope.points` go
  round in a ring, "so the newest is not always last", but nothing says
  where the ring starts. A drawn wave can show a seam that moves. Either
  report the start, or keep the points oldest first. The Audio90 guide
  left the order out until this is settled.
- **Two chips made without a `context` make two audio contexts.** Each
  listens for the first click, tap or key press itself. The guides tell a
  page to make one context and share it, but then starting it is the
  page's job. Consider one shared context, made by the first chip that
  needs one and closed with the last.
- **The published build makes each worklet's Blob URL as its module
  loads** (074 open question 2). A bundler drops the worklets from a page
  that makes no chip, but Node doesn't, so a Node script that imports
  `audio90` holds both worklets' code, about 55 KB, whether or not it makes
  a chip. Making the URL when the first chip is made would fix that.

### Errors that could be clearer

- **`render` of a held sound.** A sound with `lengthMs: Infinity` and no
  `durationMs` makes `render` throw a `RangeError` as it tries to make an
  endless array. Throw an error that names the missing `durationMs`, or
  render a set length. The headless README tells you to give one.
- **`printAudio90Song` of a held sound.** It throws for a song with a sound
  whose `lengthMs` is `Infinity`, which is a valid sound, since JSON can't
  hold `Infinity`. Write it as something JSON holds, which
  `parseAudio90Song` reads back.
- **The parser's errors still say "instrument".** "unknown instrument 'Q'",
  "no instrument named on this channel", "needs an analog instrument",
  "a sample instrument". The option is still called `instruments`, but
  what it holds are sounds, and the guides say so. Reword the errors, and
  the tracker guide's table of them.
- **The Audio80 checks few of its sound's options.** The Audio90 checks
  every option's range, and names the option in its error. The Audio80
  checks an arpeggio's length, a filter sweep's frequencies, the length,
  and, since 074, the pulse width and its sweep. An out-of-range `volume`,
  `echo` or envelope value passes silently, as `pulseWidth: 2` did, which
  played a full-scale click. Give the Audio80 the same checks.

### Later, if a game needs it

- **A clock shared by the music and the sounds** (074 open question 9).
  With a chip each, a sound can't be stamped on the music's clock, for
  example to land exactly on a beat. Both chips run on one audio context,
  so chip time as the context's time, less the time spent paused, would
  agree on two chips paused together. It would bring back `time` and
  `atMs`, which 074 removed. Nothing needs it yet, but a rhythm game would.

### In the Arcade

- **`MusicChip` leaves out `positionMs`.** The Arcade's view type for the
  music chip (`packages/sites/arcade/src/shared/sound-chips.ts`) picks the
  members a view uses, and `positionMs` came after it. Add it when a view
  first wants it.

## Acceptance Criteria

- [ ] Each thing a page can't do is built, or dropped with the reason.
- [ ] Each error is clearer, or dropped with the reason.
- [ ] Each change people would notice has a changeset, and the guides say
      what changed.
- [ ] The reference set still passes, or each changed hash was listened to
      and accepted.

## Progress Log

- **2026-10-29.** Created from what writing `audio90`'s guides found, as 074
  was archived (074 section 12, step 11), with 074's open questions 2 and
  9.
