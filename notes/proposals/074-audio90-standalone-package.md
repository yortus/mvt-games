# Proposal: audio90, a standalone sound package

> Publish `@mvtjs/chiptune` as `audio90`: a sound and music package for any
> web page or game, versioned on its own like v-snap, but still built and
> tested in this repo. The Audio90 chip carries the Audio80 with it, as a
> newer machine played the games of the model before it. The work is mostly
> wording and names, because the package already has no dependencies and
> imports nothing from MVT. The real changes are a clock that can run on
> its own, a song file format, and a home for the docs' MVT material. A
> later stage adds Audio90 Studio, an editor for sounds and songs, built
> with MVT.

**Status:** in progress, on the branch `audio90`. 068, which this builds
on, was committed there as `0ebacfec` on 2026-10-27, and its last open item
moved here (step 10). Section 12 records the progress.

**Written:** 2026-10-25, against main at `5cd89d4c`, with proposal 068
built in its worktree but not yet merged. Name availability checked on npm
and the web that day.

**Related:**
[packages/libraries/chiptune/](../../packages/libraries/chiptune/README.md),
[v-snap](../../packages/tools/v-snap/README.md) (the precedent for a
standalone package in this repo),
[068](../archive/068-music-on-the-sound-cards-clock.md) (music on the sound card's
clock, which changed the music player and the chip clock first),
[065](../tasks/backlog/065-audio90-follow-ons.md) and
[048](../tasks/backlog/048-sound-follow-ons.md) (sound loose ends),
[Sound and Music](../../packages/sites/docs/building-with-mvt/presenting-the-world/sound.md),
[.changeset/config.json](../../.changeset/config.json).

| Decision | Recommendation | Section |
| --- | --- | --- |
| Name | `audio90`, unscoped. Free on npm, and no other software found by that name | 3 |
| Code names | Unchanged: `Audio90`, `Audio80`, `createAudio90Song`... The package is named for its newest chip | 3 |
| Where it lives | `packages/libraries/audio90/`, still in the workspace | 4 |
| Versioning | Its own changesets version, out of the `@mvtjs/*` fixed group, as v-snap is | 4 |
| Entry points | `audio90` for everything that runs in a browser, `audio90/headless` for Node and tests | 5.1 |
| Factories | `createAudio90` and `createAudio80` for the browser chips. The headless ones keep their names | 5.2 |
| Clock | Two modes: `'free'`, the default, runs on the sound card's clock; `'ticked'` keeps today's game-driven clock | 5.3 |
| Song files | A text format that `parseAudio90Song` reads and `formatAudio90Song` writes, round trip exact | 5.5 |
| The first thing people see | `createPlayer()`, a simple player in the style of chiptune3's: play, pause, stop, repeat, seek, volume, tempo, pitch. The chip API stays beneath it, for games | 5.7 |
| MVT material | Moves out of the package docs into the docs site's Sound and Music page | 6 |
| The old package | `@mvtjs/chiptune` deprecated on npm, pointing at `audio90`. The playground drops the old name, with no alias | 7 |
| Editor | Audio90 Studio, a private site in the repo, built with MVT, in four stages | 8 |
| Order | After 068, which reshaped the music player. 068 is now committed | 9 |

---

## 1. Why

The chips are a sound library that happens to have been written for MVT
games. Nothing in their code needs MVT, and a sound library is useful to far
more people than an architecture is. Tying it to `@mvtjs` hides it from them:

- **The name:** anyone who isn't using MVT skips a package in the `@mvtjs`
  scope.
- **The version:** it is versioned in lockstep with pixi, three and html. A
  song fix bumps all of them, with empty changelogs, and the reverse.
- **The docs:** they explain the chips in terms of audio views, ticks and
  refresh steps.

## 2. Starting Point

What is already independent:

- **No dependencies.** `package.json` lists only dev dependencies.
- **No MVT imports.** Nothing in `src/` imports an `@mvtjs` package, and no
  library imports the chips. Only the Arcade, the playground, the benchmarks
  and the docs use them.
- **Any bundler.** The published build inlines each chip's worklet as a Blob
  URL (`tsdown.config.ts`, `inlineWorklets`), so the package works with any
  bundler, or none, with no file to copy.
- **Node.** The headless chips, rendering, WAV encoding and loudness already
  run in Node.

What ties it to MVT:

| Tie | Where | Size |
| --- | --- | --- |
| Wording: audio views, the game loop, ticks, refresh, presentation state | Doc comments in `src/`, the README and `docs/` | About 59 places in `src/` comments, and 106 in the README and docs |
| A clock that moves only when a game loop calls `controls.update(deltaMs)` and `flush()` | `shared/audio-controls.ts`, `web/chip-clock.ts`, `web/web-chip.ts` | The design, not just the wording (section 5.3) |
| The music player as an audio view's presentation state, with `refresh` | `music-player/` | 068 removed `update`, and kept `refresh` |
| The `@mvtjs/source` export condition | `package.json` | Every entry point |
| The worklet names `mvt-audio80` and `mvt-audio90` | `web/audio80-runner.ts`, `web/audio90-runner.ts` | Two strings |
| The lockstep version | `.changeset/config.json`'s `fixed` group | One pattern |

## 3. The Name

**`audio90`** is free on npm, as is `audio80`, checked with `npm view` on
2026-10-25. Two web searches found no software, library or chip called
Audio90. That was not a trademark search.

It suits the package because the Audio90 is the newer and larger chip, and
it still plays everything written for the Audio80, much as a newer machine
often played the games of the model before it. So one name covers both
chips without a generic word like "chiptune", which many packages already
use.

Once `audio90` is published, npm's similarity check refuses names that
differ from it only in punctuation, such as `audio-90`, so nobody can publish
a confusable package.

The code names stay as they are: `Audio90`, `Audio80`, `createAudio90Song`,
`AUDIO90_VOICE_COUNT`. v-snap did the same, keeping `vsnap` in its code.

## 4. Package and Repo

- **Folder:** move `packages/libraries/chiptune/` to
  `packages/libraries/audio90/`, so the folder is named for the package, as
  `v-snap`'s is. It stays under `libraries/`, since people build with it.
- **Manifest:** `"name": "audio90"`, and `homepage` points at its README on
  GitHub, as v-snap's does. Keywords lose `mvt`, and the description
  describes sound, not games alone.
- **Export condition:** do what v-snap does. In the repo, each entry point
  in `exports` names its TypeScript source. A `prepack` script swaps in the
  published manifest, which names the built files, and `postpack` swaps it
  back. That drops the `@mvtjs/source` condition from the published package.
  The alternative is to keep the condition, which is harmless but shows an
  MVT name in every user's `node_modules`.
- **Versioning:** the package leaves the `@mvtjs/*` fixed group without a
  config change, because the group matches by name. It gets its own
  changesets entries and changelog, starting at `0.8.0` so the history
  carries on from `@mvtjs/chiptune` 0.7.0 (open question 1).
- **Worklet names:** `audio90-chip` and `audio80-chip`, in place of
  `mvt-audio90` and `mvt-audio80`.
- **Lint:** the repo's rules still apply, since it is still this repo's
  code: no classes but the one the worklet API needs, no `null`, no `this`.

## 5. API

### 5.1 Entry points

Today there are three: `.` (the notation, the music player and the types),
`./web` (the browser chips) and `./headless` (the headless chips and the
tools for tests).

A general user expects `import { createAudio90 } from 'audio90'` to work in
a browser. So merge `./web` into `.`, which then holds everything that runs
in a browser. Importing it in Node stays harmless, because nothing runs at
import time. `audio90/headless` keeps the headless chips, rendering, WAV and
loudness.

Each chip's worklet code is a string in its own module. A page that uses
only the Audio90 must not carry the Audio80's worklet. Check that the
bundle tree-shakes it, and add a check like the home page budget if needed.

### 5.2 Factories

`createWebAudio90` becomes `createAudio90`, and `createWebAudio80` becomes
`createAudio80`. The headless factories keep their names, since "headless"
says what makes them different. The return value stays `{ audio90, controls }`.

`context` becomes optional. Without it, the factory makes its own
`AudioContext`, and starts it at the page's first click, tap or key press,
because browsers allow sound to start only after the user does something.
`controls.ready` already says when the chip can play.

A page with a strict Content Security Policy may forbid `blob:` worklets. An
optional `processorUrl` lets it serve the worklet file itself.

### 5.3 The clock

This is the one change of design. Today the chip's clock moves only when the
host calls `controls.update(deltaMs)` once a tick and `controls.flush()`
after the views. That is right for a game, because the sound pauses with
the game and tests are exact. It is wrong for a page that only wants to play
a sound when a button is pressed, where nobody is ticking anything.

So the chip gets a `clock` option:

| `clock` | Time comes from | Writes are sent | Pausing | Suits |
| --- | --- | --- | --- | --- |
| `'free'` (default) | The sound card | At the end of the current task, by a microtask | `controls.pause()` and `resume()`, which suspend the context | Pages, tools, the Studio |
| `'ticked'` | `controls.update(deltaMs)` | By `controls.flush()` | Stop calling `update` | Games, and every entry in the Arcade |

Since 068, songs play on each chip's own sequencer on the audio thread,
gated by the ticks. The gate is the chip clock's plan for each block
(`web/chip-runner.ts`, `render`): the sequencer moves on in every block
the clock does not plan as silence, and the ticked clock plans silence
while the game is paused or the chip is waiting for its first ticks. So a
free clock is a second clock behind the same `plan`, which plays every
block at the sound card's rate and is silent only while paused. The
sequencer and the music player need no change for it.

One thing on the page changes with it. Each music player call carries the
chip time it was made at, so a song started while audio cannot play skips
ahead to where it would have got to (068, section 12). In ticked mode that
time comes from the ticks. In free mode it must come from the audio
context's own time, or every call would skip by the time since the page
loaded.

The Arcade's entry host passes `clock: 'ticked'`, and so do the docs' MVT
examples. Nothing about MVT's guarantees changes for games.

### 5.4 The music player

Since 068, `createMusicPlayer({ audio90 })` (or `{ audio80 }`) has `play`,
`queue`, `stop`, `tempoScale` and the heard `song`, `orderIndex`, `row` and
`beat`, and no `update`. Its docs stop calling it presentation state, and
say instead that a game that needs exact, pausable timing uses the ticked
clock.

068 kept `refresh`: the player holds its calls until then, and sends them
together, so a song that starts at a new tempo gets its tempo first (068,
section 15.2). With the free clock, nobody calls `refresh`. So in
free mode the player sends its calls on a microtask, as the chip sends its
other writes (5.3), and `refresh` does nothing. A free-clock user never
calls anything each frame, and the ticked clock keeps exactly what it has.

### 5.5 Song files

Today a song is TypeScript: `createAudio90Song({...})` with its patterns
written as tracker text and its instruments as objects. That is fine in a
code base, but an editor, a share link or a game that loads its music at
run time needs a file.

Add `formatAudio90Song(song)`, which writes a song as text, and
`parseAudio90Song(text)`, which reads it back. The same goes for sound
effects and instruments. Use a JSON envelope for the instruments and
settings, with each pattern as the tracker text the chips already read, so
a file is readable and diffs well. The test is a round trip: format then
parse gives the same song, for every tune in the Arcade. The Tune Tracker
already relies on the same kind of round trip for each cell.

Samples are bounced from the chip's own engines, never recorded, so a file
holds each sample's recipe, not its audio.

### 5.6 Smaller things

- `AudioControls` keeps its name, but its docs say "the host" or "the code
  that owns the chip", not "the game loop".
- `AudioControls.stallCount` only means something in ticked mode. Document
  it as such.
- A small command line, `npx audio90 render <module> <out.wav>`, from the
  existing `render-wav` script, would let people hear a song without a page.
  Nice to have.

### 5.7 A simple player

[chiptune3](https://github.com/DrSnuggles/chiptune), a module player built
on libopenmpt, has an API that anyone can use in a minute. Its one class
(read from its 0.8.9 package) makes its own audio context, and has `play`,
`load(url)`, `stop`, `pause`, `unpause`, `togglePause`, `setRepeatCount`,
`seek` (and `setOrderRow`), `setVol`, `setTempo`, `setPitch` and
`setStereoSeparation`. It reports back through `onEnded`, `onProgress`
(with the order, pattern and row), `onMetadata` and `onError`.

To use the chips today, you make a chip and its controls, make a music
player on the chip, and, with the ticked clock, call `update`, `refresh`
and `flush` in the right order each tick. That is right for a game, but a
lot to learn before the first note. So the package's first example should
be a player that hides all of that:

```ts
import { createPlayer } from 'audio90';

const player = createPlayer();  // its own audio context, started on a click
player.play(song);              // or: await player.load('theme.a90.json')
player.tempo = 1.25;
player.pitch = 2;               // in semitones
player.repeat = 1;              // play the loop once more, then end
player.pause();
player.resume();
player.seek(30_000);            // in ms, or player.seekTo(orderIndex, row)
player.playEffect(coin);        // over the music, on the voices it leaves
```

It is a thin layer over a chip with the free clock, its controls and a
music player. It follows this repo's style rather than chiptune3's: a
factory, not a class, and properties for settings rather than setters.

| chiptune3 | `createPlayer` | What it takes |
| --- | --- | --- |
| `play(buffer)`, `load(url)` | `play(song)`, `load(url)` | `play` exists. `load` needs the song file format (5.5) |
| `stop` | `stop()` | Exists |
| `pause`, `unpause`, `togglePause` | `pause()`, `resume()`, `isPaused` | New, and small: suspend the audio context, which holds the music and any effects ringing |
| `setRepeatCount` | `repeat`: how many more times the loop plays, `Infinity` by default | New, and small: the sequencer counts its returns to the song's `loop` |
| `seek`, `setOrderRow` | `seek(ms)`, `seekTo(orderIndex, row)` | New, and the most work (below) |
| `setVol` | `volume`, `musicVolume`, `effectsVolume` | Exist, on the controls |
| `setTempo` | `tempo` | Exists, as the music player's `tempoScale` |
| `setPitch` | `pitch`, in semitones | New. Whole semitones are small, since the order already transposes patterns (`'verse+5'`). A fraction of a semitone needs each engine, samples too, to scale its frequency |
| `setStereoSeparation` | `stereoWidth` | New, and small, on the Audio90's mix. The Audio80 is mono |
| `onProgress`, `currentTime` | `time`, `orderIndex`, `row`, `beat`, and an `onRow` option | The values exist. The callback is new |
| `onEnded` | `isPlaying`, and an `onEnded` option | The value exists. The callback is new |
| `onMetadata`, `duration` | `song`, `duration` | `computeSongDurationMs` exists. A song has no title or author yet, which the file format should add |
| `onError` | `ready`, which rejects | Exists, on the controls |

What the player keeps that chiptune3 lacks: sound effects over the music,
and both chips. If each song says which chip it is for, `play` can make the
chip it needs, so one player plays Audio80 and Audio90 songs alike.

**Seeking** is the one hard part. A tracker song's state at a row depends on
every row before it: the instruments set, the slides under way, the pan and
the sends. So `seek` runs the sequencer from the start to the target row
without making sound, then plays from there, as libopenmpt does. The
sequencer is deterministic, so this is exact, and after 068 it runs on the
audio thread, where the jump happens with no gap.

**Callbacks.** This repo's views poll and watch for changes, and never
subscribe. The player is for pages that don't tick, so `onEnded` and `onRow`
are options, given once to `createPlayer`, and called on the main thread
when the audio thread reports them. The values they report can be polled
too.

The chip API stays as it is, beneath the player. A game, and every MVT
app, uses the ticked clock and the chip, because its sound must pause and
step with its models.

## 6. Docs

The package's README and `docs/` become neutral. Talk to the reader as
someone making a page or a game in any framework.

- **README:** what the chips are, then the player (5.7): a song, and a
  sound effect on a button press, in a few lines each. Then the chips
  beneath it, the two clocks, and links to the guides.
- **`using-the-audio80.md`, `using-the-audio90.md`,
  `writing-tracker-music.md`:** keep the substance, and rewrite the parts
  about audio views and ticks (about 67 MVT terms in the Audio80 guide
  alone). Add a short "Using it with a game loop" section on the ticked
  clock.
- **The MVT material** moves to the docs site's
  [Sound and Music](../../packages/sites/docs/building-with-mvt/presenting-the-world/sound.md),
  which already teaches audio views. It becomes the one place that explains
  how MVT uses `audio90`. The package README links there in one line.
- **The docs site and AGENTS.md:** the glossary's Audio80, Audio90 and
  Music player entries, the project structure, and AGENTS.md's "five
  libraries published under `@mvtjs`" all change to name `audio90`.

## 7. Moving the Repo Over

About 130 files import `@mvtjs/chiptune`: 79 in the Arcade's entries, 21 in
its tunes, and the rest in the runner, the Arcade's own sounds, the
playground, the benchmarks and the docs. A script rewrites
`'@mvtjs/chiptune'` to `'audio90'`, `'@mvtjs/chiptune/web'` to `'audio90'`,
and `'@mvtjs/chiptune/headless'` to `'audio90/headless'`, then the factory
renames. Files are moved with plain `mv`, never `git mv`.

The **playground** drops the old name. Visitors' saved projects and share
links that import `@mvtjs/chiptune` stop working. The site is still in
stealth, so that is fine (the user, 2026-10-27). Its library list, descriptions and export dependencies
(`playground/libraries/libraries.ts`) change to `audio90`, and an exported
project names `audio90` in its `package.json`.

On npm, publish `audio90` first, then deprecate every version of
`@mvtjs/chiptune` with a message that names `audio90`.

## 8. Audio90 Studio

An editor for sounds and songs, in the browser, built with MVT. It fills the
gaps the survey of similar libraries found: jsfxr and ZzFX have a sound
designer, and BeepBox a tracker with share links. The chips have neither.

It should be a private site in the repo, `packages/sites/studio/`, served
beside the Arcade, the docs and the playground. An Arcade entry is the wrong
shape: entries have a fixed screen size and a game's controls. The npm
package does not depend on it, so `audio90` stays free of dependencies.

It is also a good MVT showcase: an editor's model is a document, an undo
history and a selection, which no game in the Arcade has.

### 8.1 Stages

| Stage | What | Why first |
| --- | --- | --- |
| 1. Sound effect designer | Presets (coin, laser, hit, jump, explosion...), sliders for the wave, envelope, sweep and filter, a randomise and a mutate button, and Play. Exports the effect as code or as a file | Smallest, and the gap people notice first |
| 2. Instrument editor | A panel for each Audio90 engine (FM operators, analog oscillators, sample recipes), a scope and a meter, and the computer keyboard as a piano | Instruments are the hardest part of a song to write by hand |
| 3. Tracker | The Tune Tracker's pattern view, made editable: a cursor, notes entered from the keyboard, patterns, the order, copy and paste, undo | Reuses the views the Tune Tracker already has |
| 4. Sharing | A song in a link, compressed, as the playground's share links are. Open in the Playground. Export as code, as a file, or as WAV | Needs the song file format (section 5.5) |

### 8.2 How MVT fits

- **Models:** the document (the song or effect), the selection and cursor,
  the undo history, and what is playing. All as plain models with
  `update(deltaMs)`, tested without a page.
- **Views:** HTML JSX for the panels, Pixi for the pattern grid, scopes and
  meters, as the Tune Tracker does. An audio view plays on the chip.
- **Clock:** the Studio is an MVT app, so it uses the ticked clock. That
  also makes it the first user of both clocks: the Studio is ticked, and
  the code it exports for a page is free.

## 9. Order

1. ~~Merge 068.~~ Done: committed as `0ebacfec`, on the branch `audio90`,
   on 2026-10-27. It reshaped the music player and the chip clock, which
   sections 5.3 and 5.4 build on.
2. Rename, move and re-version (sections 3, 4 and 7), with no API change
   but the factory names. The Arcade keeps working throughout.
3. The neutral docs (section 6).
4. The free clock and the optional context (section 5.3, 5.2).
5. The song file format (section 5.5).
6. The player (section 5.7): first what exists and the small additions,
   then seeking and fractional pitch.
7. Try the full build on a phone, as 068 left to do. Then publish
   `audio90`, and deprecate `@mvtjs/chiptune`.
8. The Studio, a stage at a time (section 8).

Steps 2 and 3 alone make it a standalone package. Steps 4 to 6 make it
pleasant to use outside a game.

## 10. Open Questions

1. **The first version.** `0.8.0`, carrying on from `@mvtjs/chiptune`
   0.7.0, or `0.1.0` for a new name? Carrying on keeps one changelog. It is
   also what happens by itself: 068's changeset, not yet released, is a
   minor bump, and once it names `audio90` it takes the package from 0.7.0
   to 0.8.0. Step 2 keeps 0.7.0 in the manifest for that reason.
2. **Merging `./web` into `.`** (section 5.1). Is anything in the root
   today unsafe to import where there's no `AudioContext`, such as a Web
   Worker? Partly answered, 2026-10-27: nothing in the source touches an
   `AudioContext`, a window or a document as it loads. But the published
   build makes each worklet's Blob URL as its module loads
   (`tsdown.config.ts`, `inlineWorklets`). Node 18 and later, and Web
   Workers, have `Blob` and `URL.createObjectURL`, so that works there, but
   every page or Node script that imports the package then holds both
   worklets' code, about 67 KB, whether it makes a chip or not. A bundler
   drops them when no chip is made, since the package has no side effects,
   but Node does not. Making the URL when a chip is first made would fix
   that. Still to decide: whether that is worth doing before publishing.
3. **The free clock's default.** `'free'` suits most people, but a game
   author who forgets the option gets sound that doesn't pause with the
   game. Would the docs' first example for games make that clear enough?
4. **A free-clock sequencer.** ~~After 068, is the audio thread's
   sequencer gated in a way that "always open" is a small change, or does
   free mode need its own path?~~ Answered by 068 as built: a small change.
   The sequencer moves on in every block the chip clock doesn't plan as
   silence, so a free clock behind the same `plan` is enough. The page's
   chip time for music calls must then come from the audio context (section
   5.3). And `refresh` stays for the ticked clock, while a free-clock
   player sends its calls on a microtask (section 5.4).
5. **Pausing the player.** Suspending the audio context is simple, and
   holds everything. Should a paused player still play effects, such as a
   menu's clicks? Then it must hold only the sequencer, and silence the
   music's voices.
6. **The player's name.** `createPlayer`, or `createAudio90Player`, which
   says what it plays but not that it plays Audio80 songs too?
7. **The Studio's address.** Beside the others under the site, as
   `/studio/`, or its own domain once it is good enough to stand alone?

## 11. Implementation Steps

1. ~~Merge 068.~~ Done: `0ebacfec`, on the branch `audio90`.
2. Move the folder, rename the package, and swap the export condition for a
   publish manifest as v-snap's. Rewrite the imports across the repo.
   `npm test`, `npm run build` and `npm run build:packages` pass.
3. Rename the browser factories and the worklet names.
4. The playground's library list, descriptions and export dependencies
   name `audio90`. No alias for the old name (section 7).
5. Rewrite the README and the three guides. Move the MVT material to the
   docs site's Sound and Music page. Update the glossary, project structure
   and AGENTS.md.
6. Add the `clock` option and the optional `context`, with unit tests for
   both modes and a page test in a real browser.
7. Add `formatAudio90Song` and `parseAudio90Song`, with a round-trip test
   over every tune in the Arcade.
8. Add `createPlayer` with what exists, plus `pause`, `resume`, `repeat`,
   whole-semitone `pitch`, `stereoWidth`, `onEnded` and `onRow`. Make it
   the README's first example.
9. Add `seek` and `seekTo`, with a test that a song played from a row
   sounds the same as one seeked to it. Then fractional pitch.
10. Try the full build on a phone, over Bluetooth too, as 068 left to do:
    every entry's music on the sequencer, and pausing and resuming a game.
    Then a changeset, publish `audio90`, and deprecate `@mvtjs/chiptune`.
11. The Studio, stage 1, as its own proposal.

## 12. Progress

- **2026-10-27:** 068 committed as `0ebacfec` and archived. Its one open
  item, a phone check of the full build, moved to step 10. Its as-built
  design answered open question 4 and the `refresh` question in section
  5.4. The playground keeps no alias for `@mvtjs/chiptune` (the user).
  Started step 2.
