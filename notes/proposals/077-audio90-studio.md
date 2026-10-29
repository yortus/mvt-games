# Proposal: Audio90 Studio

> An editor for `audio90`'s sounds and songs, in the browser, built with MVT
> and served beside the Arcade, the docs and the playground. It fills the
> gaps a survey of similar libraries found: jsfxr and ZzFX have a sound
> designer, and BeepBox a tracker with share links, but `audio90` has
> neither. It is also a showcase MVT has lacked: an editor, whose model is a
> document, a selection and an undo history, where every Arcade entry is a
> game. Four stages, each worth shipping on its own: a sound designer, an
> engine editor, a tracker, and sharing.

**Status:** proposed. Grown from [074](../archive/074-audio90-standalone-package.md)
section 8, which left the Studio for a proposal of its own once `audio90`
was published.

**Written:** 2026-10-29, on `vnext`, with `audio90` 0.8.0 published to npm.

**Related:**
[audio90](../../packages/libraries/audio90/README.md) and its guides,
[the Tune Tracker](../../packages/sites/arcade/src/entries/tune-tracker/) (the
pattern views a tracker would reuse),
[the playground's share links](../../packages/sites/playground/src/runtime/share-links.ts),
[076](../tasks/backlog/076-audio90-api-gaps.md) (gaps in the API, some of
which the Studio needs filled),
[073](../tasks/backlog/073-models-take-their-random-source.md) (models take
their random source, which randomise and mutate need).

| Decision | Recommendation | Section |
| --- | --- | --- |
| What it is | A site of its own, `packages/sites/studio/`, private, not an Arcade entry and not part of `audio90` | 3 |
| Address | `/studio/`, beside `/playground/` and `/docs/`, until it is good enough to stand alone (074 open question 7) | 3 |
| How it uses `audio90` | By its npm name, as any app does: the package's first user outside the Arcade's games | 3 |
| Order | A sound designer first, then an engine editor, a tracker, and sharing | 4 |
| Saved work | Kept in the browser, and exported as code, as song text, or as WAV | 4.4 |
| MVT | A document model with an undo history, a selection, and the chip's playback; HTML JSX panels, Pixi for grids and scopes; tests on headless chips and v-snap | 5 |

---

## 1. Why

`audio90` lets you write sounds and songs in code, and the guides teach
you how. But designing a sound by editing numbers and reloading is slow,
and nobody learns a chip's FM operators from a table. The libraries people
reach for instead each come with an editor: jsfxr and ZzFX a sound
designer with sliders and a randomise button, and BeepBox a tracker whose
songs live in a link. An editor is how most people will first meet
`audio90`, and how they will make the sounds they then paste into code.

The Studio also shows MVT where it hasn't been shown. Every Arcade entry
is a game: a simulation, a score, and a screen of a fixed size. An editor
has none of those. Its model is a document, a selection and an undo
history, its views are panels that resize, and its input is text and
clicks. If MVT suits that too, the Studio says so better than a page of
argument.

## 2. What It Builds On

- **`audio90` 0.8.0.** Sounds and songs are plain options objects, checked
  as they are made, with errors that say where they are. The chip plays a
  sound on demand, and a song from any place (`startAt`, `startMs`), reports
  what is heard (`orderIndex`, `row`, `positionMs`), and calls `onRow` as it
  goes. `printAudio90Song` and `parseAudio90Song` turn an Audio90 song into
  text and back exactly. `printAudio90Cell` prints a cell as a tracker
  shows it. `createScope` shows what each voice plays. `render` and
  `encodeWav` are plain TypeScript, so they work in a browser as in Node.
- **The Tune Tracker.** An Arcade entry that shows fifteen Audio90 tunes as
  a tracker does: a pattern view that scrolls with the music, the order,
  the song's settings, its sounds, and a meter for each channel, drawn in
  Pixi with a pixel font. It shows; it doesn't edit.
- **The playground's share links.** A project as JSON, gzipped with the
  browser's `CompressionStream`, in URL-safe base64.
- **The sites' setup.** The Arcade's dev server serves `/docs/` and
  `/playground/` from their own servers, and the build puts each site in a
  folder of `dist/`. A fourth site follows the same pattern.

## 3. Where It Lives

The Studio is a site of its own, `packages/sites/studio/` (`@mvtjs/studio`,
private), served at `/studio/` beside the playground.

- **Not an Arcade entry.** An entry has a fixed screen size, a game's
  controls, a card and a session, and the Arcade pauses it. An editor wants
  the whole window, a keyboard for typing, and its own address to share.
- **Not part of `audio90`.** The package has no dependencies and is meant to
  move to a repository of its own one day. The Studio needs Pixi and MVT's
  libraries. So the Studio depends on `audio90`, by its npm name, as any
  app would, and never the other way round. That makes it the package's
  first user outside the Arcade's games, which is a test of the API in
  itself.
- **At `/studio/` first.** Its own domain can wait until it is good enough
  to stand alone (074 open question 7). The address is one line of the
  deploy, so the choice is cheap to change.

## 4. Stages

Each stage is worth shipping on its own, and each is smaller than the next.

| Stage | What | Why in this order |
| --- | --- | --- |
| 1. Sound designer | Presets, sliders, randomise, mutate, play, and export as code | The smallest, and the tool people look for first |
| 2. Engine editor | A panel for each Audio90 engine, a scope and a meter, and the computer keyboard as a piano | A song's sounds are the hardest part of it to write by hand |
| 3. Tracker | The Tune Tracker's pattern view, made editable | Reuses what the Tune Tracker draws |
| 4. Sharing | A song in a link, Open in Playground, and export as text and WAV | Needs a finished song to share |

### 4.1 Stage 1: a sound designer

One sound at a time, for a game's sound effects, on either chip.

- **Presets** by kind: coin, laser, hit, jump, explosion, power-up, blip.
  Each is a starting point designed here, not copied from another tool's
  presets.
- **Sliders** for what a sound effect needs: the wave, the envelope, the
  note and a glide or sweep, the filter and its sweep, vibrato, and the
  step table as rows to edit.
- **Randomise** makes a new sound of the preset's kind, and **mutate** moves
  the current one a little. Both take a seeded random source, as 073 asks
  of models, so a test can repeat them.
- **Play** on every change, so dragging a slider is heard. The Audio80 and
  the Audio90 each have a chip for this, and the page pauses them while
  hidden, as every chip does.
- **Export as code:** the `createAudio80Sound` or `createAudio90Sound` call
  that makes the sound, ready to paste.

### 4.2 Stage 2: an engine editor

The Audio90's engines, in full: FM operators and the algorithm drawn as a
diagram, the analog oscillators, the filter, LFO and mod envelope, and a
sample's recipe. A scope and a meter show what the voice plays. The
computer keyboard plays the sound as a piano, two octaves on two rows of
keys, as trackers have always done.

The scope needs 076's fix for where its newest point is, or a drawn wave
shows a moving seam. A sound with reverb or echo needs 076's chip effect
settings too, or it is heard dry.

### 4.3 Stage 3: a tracker

The Tune Tracker's pattern view, made editable: a cursor, notes typed from
the keyboard, effects typed into their columns, patterns added and copied,
the order edited, and the song's settings and sounds in their panels.
Play from the cursor uses `startAt`, and the cursor follows the music with
`onRow`. A cell that doesn't parse shows the parser's error beside it,
which is when 076's rewording of "instrument" to "sound" matters.

The Tune Tracker's views live in an Arcade entry, which nothing else may
import. Either they move to a place both can import, or the Studio has its
own (open question 2).

### 4.4 Stage 4: sharing and saving

- **A song in a link:** its text from `printAudio90Song`, gzipped and in
  URL-safe base64, as the playground's share links are. Opening the link
  reads it back with `parseAudio90Song`.
- **Open in Playground:** a project that imports `audio90` and plays the
  song, opened in the playground with a share link of its own.
- **Export** as code, as song text, or as a WAV file, rendered in the page
  with `render` and `encodeWav`, in a worker so the page stays responsive.
- **Saved work** stays in the browser between visits, as the Arcade keeps
  its settings, with export and import for anything worth keeping. There
  are no accounts.

A held sound (`lengthMs: Infinity`) can't be printed as text yet. 076
fixes that, and stage 4 needs it.

## 5. How MVT Fits

- **Models.** The document (a sound, or a song with its sounds and
  patterns), the selection and cursor, the undo history, and playback: what
  is playing, from where. A sound or song is plain options data, so an undo
  history can keep each version whole, and a step back is a swap. Every
  model moves only by its actions and `update(deltaMs)`, and is tested
  without a page.
- **Views.** HTML JSX for the panels and sliders, and Pixi for the pattern
  grid, the scopes and the meters, as the Tune Tracker draws them. An audio
  view plays the document as it changes, as any audio view plays on a
  change.
- **The clock.** The chips keep the sound card's time, as in every app, and
  the Studio pauses them as a game does. What the chips report, such as the
  row heard, is what the cursor follows.
- **Tests.** Models in Node, audio views on headless chips with spies, and
  the panels and the grid as v-snap visual tests.

## 6. Open Questions

1. **The Audio80 in stage 1, or the Audio90 only?** The Audio80's sound
   effects are what jsfxr users want, and its options are few. Recommended:
   both chips in stage 1, since a sound designer for the Audio80 is small,
   and the Audio90's simpler options (one oscillator, the filter, the
   envelope) in stage 1, with its engines in full in stage 2.
2. **Where the Tune Tracker's views go.** Move the pattern view, meters and
   pixel font to a private package both sites import, or copy them into the
   Studio and let them grow apart. Moving them keeps one tracker; copying
   keeps the Tune Tracker a self-contained entry, as entries should be.
   Decide at stage 3.
3. **A text form for one sound.** `printAudio90Song` prints a song, not a
   sound. Export as code covers stage 1, but sharing a single sound in a
   link wants a `printAudio90Sound` and `parseAudio90Sound`, and the
   Audio80 has no text form at all. Add them to `audio90` when sharing a
   sound is wanted.
4. **Phones.** Sliders work on a phone, and a tracker hardly does. Make
   stages 1 and 2 work on a phone, and stage 3 on a desktop only, unless
   the owner wants more.

## 7. Implementation Steps

Stage 1 first; the later stages get their steps as each one starts.

1. Create `packages/sites/studio/`: a Vite site at `/studio/`, served by the
   dev servers beside the playground and built into `dist/studio/`, with
   one empty page. Add it to the workspace, the root type-check, lint and
   the deploy.
2. The sound document model for one sound, on either chip: its options, a
   change at a time, with an undo history. Tests in Node.
3. Presets, randomise and mutate, with a seeded random source.
4. The panels: a slider or a choice for each option, and the step table's
   rows. Visual tests.
5. The audio view: play the sound as it changes, on a browser chip, paused
   while the page is hidden. Tests on a headless chip.
6. Export as code, with a test that the exported code makes the same sound.
7. Try it on a phone and a desktop, then decide whether stage 2 starts.

## 8. Progress

- **2026-10-29.** Written from 074 section 8, as 074 was archived.
