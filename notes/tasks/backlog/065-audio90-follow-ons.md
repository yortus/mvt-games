# Audio90: Follow-Ons

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

Proposal 051 built the Audio90, a second sound chip in `@mvtjs/audio`, and
let each entry choose its chip. It added the Tune Tracker, set the older
entries' text in shared pixel glyphs, rescored Neon Monsoon, and moved the
cards' long text out of the home page's first load.
It was archived on 2026-10-17, on its worktree branch, before the merge
into `vnext`. This task holds what it left open. Only the first item is
needed before the work counts as tested. Each other item can be done on
its own, or dropped.

### Test on Safari and iOS

Every browser but Safari has played the Audio90: Chrome and Firefox on the
desktop, and Chrome on Android. Playwright's WebKit on Windows has no Web
Audio, so Safari is tested on Apple hardware, once this is deployed through
main. Play the Tune Tracker and Neon Monsoon on Safari on
the desktop and on iOS. Raise and fix whatever arises. The spike's Safari
test (051 step 1) is the same test.

### With 048's docs revision

048 keeps the package's own terms out of the MVT glossary. 051 step 16
added two: "Audio90", a short project-convention entry like "Audio80", and
"Bounce", which is the package's term. When 048 revises the glossary,
"Bounce" moves to the package's docs with the others.

### Open design questions

These are 051's open questions 3, 4, 5 and 8 (051 section 14), each with
the answer 051 recommended.

- **More than one chip for an entry.** A demo of both chips' tunes would
  need `soundChip` to be a list, and `sound` an object of chips.
  Recommended: not until an entry needs it.
- **The chip in the info panel.** "Sound: Audio90" beside the techniques.
  Recommended: later, if the owner wants the credit.
- **The pause menu's music preview** for an Audio90 entry. It plays an
  Audio80 phrase. A phrase on the entry's own chip would need that chip to
  play while the entry is paused, or a second Audio90 for the page.
  Recommended: keep the Audio80 phrase.
- **Effects borrowing music voices**, as 048 asks for the Audio80. It now
  applies to both chips, and can be decided once, in the shared voice
  allocator.

### Small things

- **"Amiga module" as a style's name.** Copper Sky's style is "Amiga
  module", and comments in `src/tunes/samples.ts` say "The Amiga module's
  samples". 051 section 9 asks that no console, sound chip or synthesiser
  be named as the source of a sound. "Module" music is a genre, but
  "Amiga" names a computer. Decide whether to keep it, or to say "tracker
  module" or "16-bit module" instead.
- **The Tune Tracker's bar and the sound.** The chip plays 35 ms behind
  the newest tick, so the bar may reach a row about two frames before the
  row is heard. Offset it if the owner hears the gap (051 step 11).
- **A search link that only a description matches.** The cards' long text
  loads just after the first paint (051 step 17). A link such as
  `?q=reynolds` shows an empty wall until it arrives, under a second and
  a half in a headless test. The page could load the text at once when
  the URL has a search, or the wall could say it is still looking.
- **`games-and-demos`, before and after.** 051 steps 4 and 9 changed the
  host's work per frame, and removed about 16 bytes a frame of the games'
  allocation in the headless chips. The suite was not run. Run it on a
  quiet machine and save it, or drop the item.

### Found along the way

- **The playground's language service test fails on a checkout with
  Windows line endings.** `project-language-service.test.ts`, "reports a
  type error at its place, with a fix to import a missing name", finds no
  diagnostic on the worktree's checkout, whose files have Windows line
  endings. The line endings looked to be the cause, but it was not chased
  further. It is the playground's (052), not the Audio90's, and was left
  alone.
- **Smooth window resizes** are task 054. The owner saw the Tune Tracker
  redraw slowly and its music stutter while resizing, and then the same in
  other entries. It is the host's, not the chip's.

## Acceptance Criteria

- [ ] The Tune Tracker and Neon Monsoon play on Safari, on
      the desktop and on iOS, and any issues are fixed.
- [ ] Each open design question is decided, built or dropped.
- [ ] Each small thing is done or dropped.

## Progress Log

- **2026-10-17.** Created from 051's loose ends as it was archived, as
  057, and renumbered 065 when `vnext` had used 057 to 064. As the branch
  took in `vnext`, 048's two items that 051 finished were ticked, and the
  archived 052's link to 051 was pointed at the archive.
