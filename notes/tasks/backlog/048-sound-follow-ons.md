# Sound: Follow-Ons From the Audio80

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-09 |
| Updated  | 2026-10-09 |

## Description

Proposal 045 built the Audio80 sound chip (`@mvtjs/audio`) and gave every
game in the Arcade its sound. It was archived on 2026-10-09. This task holds
what it left open. None of it is needed for the sound to work. Each item can
be done on its own, or dropped.

### Small fixes

- **Boxed doubles on the Hot Paths page.** The chip's first build allocated
  on every block of samples. V8 boxed the doubles held in closure variables
  that changed every sample, and the doubles passed to and returned from
  helpers it did not inline. Typed arrays fixed it. The Hot Paths page has no
  line on this yet: a double that crosses a call that is not inlined is
  boxed. See 045 section 16.1.
- **`findSounds` and arrays.** `findSounds`, in `@mvtjs/audio/headless`,
  finds the sound effects and songs that a module exports. It does not look
  inside an exported array. So Kwazy Cactii's audio test adds its
  `CASCADE_FANFARES` by hand. See 045 section 16.3.
- **A slide over several rows.** In the tracker notation, a slide (`u` or
  `d`) lasts one row. A slide over several rows repeats its token on each
  row. A way to write it once may read better. See 045 section 16.3.

### Open design questions

These are 045's open questions 5, 6, 7 and 9 (045 section 14).

- **Effects borrowing music voices.** C64 games often let a sound effect
  take a voice from the music, so the tune lost a part for the length of an
  explosion. It is authentic, and it frees voices. It could be an option on
  the song, such as `yieldsToEffects: [2]`.
- **iOS's silent switch.** On iOS, the silent switch mutes Web Audio unless
  the page asks for media playback, with `navigator.audioSession`. Should the
  Arcade ask?
- **Publishing `@mvtjs/audio`.** The package is private. Its own side is
  generic, and the site's side (`PageSound`) lives in the website. Publishing
  it would need its docs to show that side as an example.
- **A Sound Test entry.** A demo in the Arcade, like the sound test menus of
  16-bit games. It would be a jukebox of every entry's sounds and tunes, with
  a scope for each voice. It would show the chip off, and give composers a
  page with hot reload.

### Music for the demoscene demo

Proposal 035 (a demoscene demo) defers its music. Once 035 is built, it can
use the Audio80. That work belongs to 035.

## Acceptance Criteria

- [ ] The Hot Paths page explains boxed doubles, or the item is dropped.
- [ ] `findSounds` finds sounds inside exported arrays, or the item is
      dropped.
- [ ] A slide over several rows can be written once, or the item is dropped.
- [ ] Each open design question is decided, built or dropped.

## Progress Log

- **2026-10-09.** Created from 045's loose ends, as 045 was archived.
