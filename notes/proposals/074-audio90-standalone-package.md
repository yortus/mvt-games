# Proposal: audio90, a standalone sound package

> Publish `@mvtjs/chiptune` as `audio90`: a sound and music package for any
> web page or game, versioned on its own like v-snap, but still built and
> tested in this repo. The Audio90 chip carries the Audio80 with it, as a
> newer machine played the games of the model before it. The work is mostly
> wording and names, because the package already has no dependencies and
> imports nothing from MVT. The real changes are one clock, the sound
> card's, in place of the game-driven one, a song file format, and a home
> for the docs' MVT material. A
> later stage adds Audio90 Studio, an editor for sounds and songs, built
> with MVT.

**Status:** in progress, on the branch `audio90`. 068, which this builds
on, was committed there as `0ebacfec` on 2026-10-27, and its last open item
moved here (step 10). Step 2, the move and rename, is done, unstaged.
Section 12 records the progress.

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
| Clock | One clock, the sound card's. The browser chip's `update`, `flush`, lead and stalls go. A host pauses a chip with `pause()` and `resume()`. Headless chips still move by `update(deltaMs)`, so tests stay exact. Decided by the user, 2026-10-27 | 5.3 |
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

### 5.3 One clock

This is the one change of design. Today the browser chip's clock moves only
when the host calls `controls.update(deltaMs)` once a tick and
`controls.flush()` after the views. That suits a game, but not a page that
only wants to play a sound when a button is pressed, where nobody is
ticking anything.

The first draft of this proposal kept both: a `clock` option, `'free'` for
pages and `'ticked'` for games. On 2026-10-27, after 068 had landed, the
user chose one clock, the sound card's, for every browser chip. Since 068,
the ticked clock does little that a game needs:

| What the ticked clock does | Since 068 | With one clock |
| --- | --- | --- |
| Pauses the sound when the game pauses, by seeing ticks that bring no time | The host already knows when it pauses | The host calls `controls.pause()` and `resume()` |
| Fades out when the ticks stop for a second, as in a hidden tab | A shorter stall no longer touches the music | The host pauses the chip while the page is hidden |
| Plays notes a game stamps with chip time exactly that far apart, a lead of 100 ms later | Nothing in the Arcade stamps its own notes. Effects and mix changes are sent as soon as possible, and music plays on the sequencer | A stamp is on the sound card's clock. A game that wants exact spacing stamps ahead of `time`, as Web Audio code schedules ahead of `currentTime` |
| Counts stalls, for the Perfmon's "Chip stalls" | Only a sign of late frames | Goes, with the stalls |
| Makes tests exact | It never did: the headless chips do, on their own clock | Unchanged |

So the browser chip changes like this:

- **Time** is the sound card's, from the moment the chip can play. `time`
  is where the worklet is now, and `heardTime` trails it by the sound
  card's latency.
- **Writes** are sent at the end of the current task, by a microtask, so a
  frame's writes still travel together. A write with no `atMs` plays as
  soon as possible. A stamp in the future waits in the worklet's queue.
- **Pausing** is `controls.pause()` and `controls.resume()`. A pause holds
  the chip in its worklet, as a pause does today: its voices fade out at
  once and hold their place, the sequencer stops, and resuming fades them
  back in. It does not suspend the audio context, because a page may play
  several chips on one context. The Arcade does: its own sounds play in the
  pause menu while the entry's chip is paused.
- **What goes:** `controls.update` and `flush` on the browser chip, the
  chip clock's lead, its catch-up and slow-down, its stalls and the
  one-second fade, `stallCount`, and the Perfmon's "Chip stalls" line.
  Most of `web/chip-clock.ts` goes with them.
- **A song started while audio cannot play** starts from its beginning
  once audio can play. Today it skips ahead to where the ticks say it
  would have got to (068, section 12). With no ticks there is no such
  place, and starting at the beginning is simpler to explain.

Since 068, the sequencer moves on in every block the chip clock doesn't
plan as silence (`web/chip-runner.ts`, `render`). So the sequencer needs no
change: the new clock plans every block at the sound card's rate, and
silence only while paused or before the chip can play.

**Headless chips** have no sound card, so they keep moving by
`update(deltaMs)`, which the code that owns them calls with the ticks. That
keeps the audio views' tests, the thumbnails and the sound hashes exact.
`update` moves from `AudioControls` to the headless chips' own controls,
and `flush`, which does nothing on them today, goes.

**For MVT,** this finishes the argument 068 made: the sound chip keeps its
own time, as a display does, and the ticks decide only what it plays.
Pausing becomes something the host says, rather than something the chip
works out. The Arcade's entry host pauses the entry's chip as it pauses the
entry, and the page pauses every chip while it is hidden, which it doesn't
need to do today. The headless host, which draws the thumbnails, advances
a headless chip by the ticks, as it does now.

### 5.4 The music player

Since 068, `createMusicPlayer({ audio90 })` (or `{ audio80 }`) has `play`,
`queue`, `stop`, `tempoScale` and the heard `song`, `orderIndex`, `row` and
`beat`, and no `update`. Its docs stop calling it presentation state.

068 kept `refresh`: the player holds its calls until then, and sends them
together, so a song that starts at a new tempo gets its tempo first (068,
section 15.2). With one clock, the player sends its calls on a microtask
instead, as the chip sends its other writes, so a song and its tempo still
travel together, and `refresh` goes. Nobody calls anything each frame. An
audio view calls `play` and `stop`, and sets `tempoScale`, in its refresh
step, as it does now.

On a headless chip, a call still takes effect at once, so a recording chip
logs the same notes at the same times.

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
player on the chip, and call `update`, `refresh` and `flush` in the right
order each tick. One clock (5.3) removes the calls each tick, but making a
chip and a music player is still a lot to learn before the first note. So the package's first example should
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

It is a thin layer over a chip, its controls and a music player. It follows this repo's style rather than chiptune3's: a
factory, not a class, and properties for settings rather than setters.

| chiptune3 | `createPlayer` | What it takes |
| --- | --- | --- |
| `play(buffer)`, `load(url)` | `play(song)`, `load(url)` | `play` exists. `load` needs the song file format (5.5) |
| `stop` | `stop()` | Exists |
| `pause`, `unpause`, `togglePause` | `pause()`, `resume()`, `isPaused` | The chip's own `pause` and `resume` (5.3), which hold the music and any effects ringing |
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

The chip API stays beneath the player. A game, and every MVT app, uses the
chip and a music player directly, pauses the chip when it pauses, and tests
its audio views on a headless chip, which steps with its models.

## 6. Docs

The package's README and `docs/` become neutral. Talk to the reader as
someone making a page or a game in any framework.

- **README:** what the chips are, then the player (5.7): a song, and a
  sound effect on a button press, in a few lines each. Then the chips
  beneath it, pausing them with a game, and links to the guides.
- **`using-the-audio80.md`, `using-the-audio90.md`,
  `writing-tracker-music.md`:** keep the substance, and rewrite the parts
  about audio views and ticks (about 67 MVT terms in the Audio80 guide
  alone). Add a short "Using it with a game loop" section: pausing the
  chip as the game pauses and while the page is hidden, and headless chips
  for exact tests.
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
- **Clock:** the chip keeps its own time, as in every app, and the Studio
  pauses it as any game does. Its tests play on a headless chip.

## 9. Order

1. ~~Merge 068.~~ Done: committed as `0ebacfec`, on the branch `audio90`,
   on 2026-10-27. It reshaped the music player and the chip clock, which
   sections 5.3 and 5.4 build on.
2. Rename, move and re-version (sections 3, 4 and 7), with no API change
   but the factory names. The Arcade keeps working throughout. The move and
   rename are done (section 12); the factory names are step 3 of section
   11.
3. The neutral docs (section 6).
4. One clock and the optional context (sections 5.3 and 5.2).
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
   Step 2 found the bundler's side of the same question. The Arcade used to
   load `@mvtjs/chiptune/web` with a dynamic `import()`, to keep the
   browser chips out of the home page's first load. A dynamic import of
   `audio90` itself, which the page also imports at once for its sounds,
   put them back in, with pixi.js beside them: 83.3 KB against a budget of
   60 KB. So the Arcade now has a module of its own,
   `runner/web-chips.ts`, which re-exports the two browser factories, and
   loads that. Its first load is 54.7 KB again. The runner's tests mock
   that module rather than the package. Any page that wants the same split
   needs the same small module, and the README should say so (step 5).
3. ~~**The free clock's default.**~~ Gone with the `clock` option: there
   is one clock (section 5.3, the user, 2026-10-27). What is left of it is
   that a game which forgets to pause its chip plays sound on while paused.
   The docs' first game example pauses the chip, to make that plain.
4. ~~**A free-clock sequencer.**~~ Answered by 068 as built: the sequencer
   moves on in every block the chip clock doesn't plan as silence, so the
   new clock needs no change to it (section 5.3).
5. **Pausing the player.** A chip's pause holds everything on it, music
   and effects (section 5.3). Should a paused player still play effects,
   such as a menu's clicks? Then it must hold only the sequencer, and
   silence the music's voices. A game that wants that today plays its
   menu's sounds on a second chip, as the Arcade does.
6. **The player's name.** `createPlayer`, or `createAudio90Player`, which
   says what it plays but not that it plays Audio80 songs too?
7. **The Studio's address.** Beside the others under the site, as
   `/studio/`, or its own domain once it is good enough to stand alone?

## 11. Implementation Steps

1. ~~Merge 068.~~ Done: `0ebacfec`, on the branch `audio90`.
2. ~~Move the folder, rename the package, and swap the export condition
   for a publish manifest as v-snap's. Rewrite the imports across the repo.
   `npm test`, `npm run build` and `npm run build:packages` pass.~~ Done,
   2026-10-27 (section 12).
3. Rename the browser factories and the worklet names.
4. The playground's library list, descriptions and export dependencies
   name `audio90`. No alias for the old name (section 7).
5. Rewrite the README and the three guides. Move the MVT material to the
   docs site's Sound and Music page. Update the glossary, project structure
   and AGENTS.md.
6. One clock (section 5.3): the browser chip on the sound card's time,
   with `pause` and `resume`, and writes sent by a microtask. Remove
   `update`, `flush`, the lead, the stalls and `stallCount` from the
   browser chip, and `refresh` from the music player. `update` moves to
   the headless chips' controls. The Arcade's entry host and page pause
   their chips, the page while it is hidden too, and the Perfmon loses
   "Chip stalls". Then the optional `context`. Unit tests in the fake audio
   context, and a page test in a real browser.
7. Add `formatAudio90Song` and `parseAudio90Song`, with a round-trip test
   over every tune in the Arcade.
8. Add `createPlayer` with what exists, plus `pause`, `resume`, `repeat`,
   whole-semitone `pitch`, `stereoWidth`, `onEnded` and `onRow`. Make it
   the README's first example.
9. Add `seek` and `seekTo`, with a test that a song played from a row
   sounds the same as one seeked to it. Then fractional pitch.
10. Try the full build on a phone, over Bluetooth too, as 068 left to do:
    every entry's music on the sequencer, and pausing and resuming a game.
    Then a changeset for the rename, beside 068's. Publish `audio90`'s
    first version by hand, since npm trusts a workflow only with a package
    that exists, then set up trusted publishing for it, as
    `.changeset/README.md`'s "The first release" says. Deprecate
    `@mvtjs/chiptune`.
11. The Studio, stage 1, as its own proposal.

## 12. Progress

- **2026-10-27:** 068 committed as `0ebacfec` and archived. Its one open
  item, a phone check of the full build, moved to step 10. Its as-built
  design answered open question 4 and the `refresh` question in section
  5.4. The playground keeps no alias for `@mvtjs/chiptune` (the user).
  The user chose one clock, the sound card's, over the two modes first
  proposed, so sections 5.3 and 5.4 were rewritten. Started step 2.
- **2026-10-27, step 2 done**, unstaged:
  - The package moved to `packages/libraries/audio90/` and is named
    `audio90`, still at 0.7.0 (open question 1). `./web` merged into `.`,
    so it has two entry points, `audio90` and `audio90/headless`. Its
    `exports` name the source, as v-snap's do, and
    `scripts/publish-manifest.ts`, adapted from v-snap's, swaps in the
    published manifest as npm packs it, then runs publint and attw. The
    build no longer runs them, since the repository's manifest names the
    source. `package.repo.json` is ignored by git.
  - Every import, dependency, path and script in the repo names `audio90`,
    and 068's changeset names it too. Prose that described the packages
    (AGENTS.md, the README, the project structure, `.changeset/README.md`)
    says four `@mvtjs` libraries, with `audio90` and `v-snap` on versions of
    their own. The package README and the Audio80 guide say what changed
    about entry points. The rest of their wording waits for step 5.
  - The playground's entry is `libraries/entries/audio90.ts`, and its type
    bundle script takes each library's npm name, so `audio90`'s types load
    under that name. An exported project that uses sound asks for
    `audio90@^0.7.0`, which npm won't have until step 10.
  - The Arcade gained `runner/web-chips.ts` (open question 2).
  - Checked: `npm run test:unit` (231 files), `npm run test:visual` (50
    files, no image changed), `npm run lint`, `npm run build` with its
    budget, one-copy and link checks, `npm run build:packages`, and
    `npm pack -w audio90`. The packed manifest names `dist/`, the repo's
    came back after, and plain Node imports both entry points from the
    tarball.
