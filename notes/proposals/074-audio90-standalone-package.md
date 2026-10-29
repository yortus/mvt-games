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
moved here (step 10). Steps 1 to 5 are done: the move, the renames and one
clock. Step 6, sounds and a chip each for music and sound effects (section
5.8), is next. The docs come near the end (step 11), once the design has
settled, and the Studio last. Section 12 records the progress.

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
| Code names | Unchanged: `Audio90`, `Audio80`, `createAudio90Song`... The package is named for its newest chip. Instruments and sound effects become sounds (5.8) | 3 |
| Where it lives | `packages/libraries/audio90/`, still in the workspace | 4 |
| Versioning | Its own changesets version, out of the `@mvtjs/*` fixed group, as v-snap is | 4 |
| Entry points | `audio90` to write sounds and play them through Web Audio; `audio90/headless` to play them with no speaker, anywhere: tests, rendering, WAV and loudness | 5.1 |
| Factories | `createAudio90` and `createAudio80` for the browser chips. The headless ones keep their names | 5.2 |
| Clock | One clock, the sound card's. The browser chip's `update`, `flush`, lead and stalls go. A host pauses a chip with `pause()` and `resume()`. Headless chips still move by `update(deltaMs)`, so tests stay exact. Decided by the user, 2026-10-27 | 5.3 |
| Sounds | One kind, a sound (`createAudio90Sound`), in place of instruments and sound effects. A song's `instruments` hold sounds. `play(sound, options?)` replaces `noteOn`, and returns an id that `stop(id)` takes (5.9). Decided by the user, 2026-10-27 | 5.8 |
| Music and sound effects | A chip each. The voices kept for music and the two volume groups in each chip go, and each chip has one `volume`. The Audio80 has 4 voices, and the Audio90 keeps 16. Arcade entries get a `music` chip and an `sfx` chip. Decided by the user, 2026-10-27 | 5.8 |
| Song files | A text format that `parseAudio90Song` reads and `formatAudio90Song` writes, round trip exact | 5.5 |
| The first thing people see | The chip itself, as simple as a player: `createAudio90()` returns one object that plays songs and sounds, pauses, stops and sets its volume. No separate `createPlayer`. Decided by the user, 2026-10-27 | 5.7, 5.9 |
| A smaller API | The controls join the chip; songs play on the chip, with no music player; the setters nobody calls go; an option pauses a chip while the page is hidden; one headless chip type; the tracker's helpers move to `audio90/tracker`. Decided by the user, 2026-10-27 | 5.9 |
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

Sections 5.1 to 5.8 were decided one at a time. Section 5.9 then
simplifies the API they describe, so where they differ, 5.9 wins.

### 5.1 Entry points

Today there are three: `.` (the notation, the music player and the types),
`./web` (the browser chips) and `./headless` (the headless chips and the
tools for tests).

A general user expects `import { createAudio90 } from 'audio90'` to work in
a browser. So merge `./web` into `.`, which then holds what you write
sounds with and the chips that play them through Web Audio. Only those
chips need a browser. The rest of it runs anywhere, and importing it in
Node stays harmless (open question 2). `audio90/headless` keeps the
headless chips, rendering, WAV and loudness. "Headless" means with no
speaker, not Node: the headless chips run in Node and in a browser alike,
as every entry's visual test shows.

Each chip's worklet code is a string in its own module. A page that uses
only the Audio90 must not carry the Audio80's worklet. Check that the
bundle tree-shakes it, and add a check like the home page budget if needed.

### 5.2 Factories

`createWebAudio90` becomes `createAudio90`, and `createWebAudio80` becomes
`createAudio80`. The headless factories keep their names, since "headless"
says what makes them different. The return value was `{ audio90, controls }`,
and becomes the chip alone (5.9).

`context` becomes optional. Without it, the factory makes its own
`AudioContext`, and starts it at the page's first click, tap or key press,
because browsers allow sound to start only after the user does something.
`ready` already says when the chip can play.

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

068 kept `refresh`: the player held its calls until then, and sent them
together, so a song that starts at a new tempo got its tempo first (068,
section 15.2). With one clock, `refresh` goes, and the player sends each
call to its slot as it is made. Nobody calls anything each frame. An audio
view calls `play` and `stop`, and sets `tempoScale`, in its refresh step, as
it does now.

As built (step 5), a tempo set just after `play` still applies from the
song's start. Both calls reach the sequencer before the song moves on: in
the worklet, at the start of the same block, and on a headless chip, before
its next `update`. The song's tempo and slides are rewritten at the song's
start stamp, so its notes fall at exactly the same times as with the tempo
set first. Only a glide in the song's first row keeps the tempo the song
started at. Holding the calls until the chip next moves was tried first,
and dropped: on a headless chip, a call then took effect a tick later than a
test looks for it, and `SongSlot` promises it takes effect at once.

### 5.5 Song files

Today a song is TypeScript: `createAudio90Song({...})` with its patterns
written as tracker text and its instruments as objects. That is fine in a
code base, but an editor, a share link or a game that loads its music at
run time needs a file.

Add `formatAudio90Song(song)`, which writes a song as text, and
`parseAudio90Song(text)`, which reads it back. The same goes for sounds
(5.8). Use a JSON envelope for the song's sounds and settings, with each pattern as the tracker text the chips already read, so
a file is readable and diffs well. The test is a round trip: format then
parse gives the same song, for every tune in the Arcade. The Tune Tracker
already relies on the same kind of round trip for each cell.

Samples are bounced from the chip's own engines, never recorded, so a file
holds each sample's recipe, not its audio.

### 5.6 Smaller things

- The chip's docs say "the host" or "the code that owns the chip", not "the
  game loop".
- A small command line, `npx audio90 render <module> <out.wav>`, from the
  existing `render-wav` script, would let people hear a song without a page.
  Nice to have.

### 5.7 What a music player needs

[chiptune3](https://github.com/DrSnuggles/chiptune), a module player built
on libopenmpt, has an API that anyone can use in a minute. Its one class
(read from its 0.8.9 package) makes its own audio context, and has `play`,
`load(url)`, `stop`, `pause`, `unpause`, `togglePause`, `setRepeatCount`,
`seek` (and `setOrderRow`), `setVol`, `setTempo`, `setPitch` and
`setStereoSeparation`. It reports back through `onEnded`, `onProgress`
(with the order, pattern and row), `onMetadata` and `onError`.

This section first proposed a `createPlayer()` that hid the chip, its
controls and a music player. Section 5.9 makes the chip that simple
instead, so there is no separate player (the user, 2026-10-27). A chip
made with no options makes its own audio context, starts it on the first
click, and plays songs and sounds:

```ts
import { createAudio90 } from 'audio90';

const music = createAudio90();
music.play(song);                    // or: music.play(await loadAudio90Song('theme.a90.json'))
music.tempoScale = 1.25;
music.play(song, { repeat: 1 });     // play the loop once more, then end
music.play(song, { pitch: 2 });      // in semitones
music.play(song, { startMs: 30_000 });
music.pause();
music.resume();
```

It follows this repo's style rather than chiptune3's: a factory, not a
class, and properties for settings rather than setters.

| chiptune3 | The chip | What it takes |
| --- | --- | --- |
| `play(buffer)`, `load(url)` | `play(song)`, and a song loaded from a file | `play` exists. Loading needs the song file format (5.5) |
| `stop` | `stop()` | Exists (5.9) |
| `pause`, `unpause`, `togglePause` | `pause()`, `resume()`, `isPaused` | Exists (5.3). Sounds play on their own chip (5.8), so a paused song leaves a menu's clicks playing |
| `setRepeatCount` | A `repeat` play option: how many more times the loop plays, `Infinity` by default | New, and small: the sequencer counts its returns to the song's `loop` |
| `seek`, `setOrderRow` | A `startMs` play option, or a starting order entry and row | New, and the most work (below) |
| `setVol` | `volume` | Exists |
| `setTempo` | `tempoScale` | Exists |
| `setPitch` | A `pitch` play option, in semitones | New. Whole semitones are small, since the order already transposes patterns (`'verse+5'`). A fraction of a semitone needs each engine, samples too, to scale its frequency |
| `setStereoSeparation` | `stereoWidth`, on the Audio90 | New, and small, on its mix. The Audio80 is mono |
| `onProgress`, `currentTime` | `orderIndex`, `row`, `beat`, and an `onRow` option | The values exist. The callback is new |
| `onEnded` | `song`, which is undefined once it ends, and an `onEnded` option | The value exists. The callback is new |
| `onMetadata`, `duration` | `song`, `song.durationMs` | `computeSongDurationMs` exists, and becomes a property (5.9). A song has no title or author yet, which the file format should add |
| `onError` | `ready`, which rejects | Exists |

What the chips have that chiptune3 lacks: sound effects over the music, on
a second chip, and two kinds of chip.

**Seeking** is the one hard part. A tracker song's state at a row depends on
every row before it: the instruments set, the slides under way, the pan and
the sends. So a song started part way runs the sequencer from the start to
that row without making sound, then plays from there, as libopenmpt does.
The sequencer is deterministic, so this is exact, and after 068 it runs on
the audio thread, where the jump happens with no gap.

**Callbacks.** This repo's views poll and watch for changes, and never
subscribe. A page that doesn't tick needs to hear when a song ends, so
`onEnded` and `onRow` are options, given once as the chip is made, and
called on the main thread when the audio thread reports them. The values
they report can be polled too.

### 5.8 Sounds, and a chip each for music and sound effects

Decided with the user, 2026-10-27, before the docs, so they are written
once, with these names.

**Two kinds for one idea.** Each chip has an instrument, which says how a
voice sounds and which songs play, and a sound effect, which wraps an
instrument with a note, a length and a volume, and which `play` plays on a
voice the chip picks. They are one thing, a sound, at different stages: what
it sounds like, and how it is played. The names make them look like two
ideas, "instrument" suggests music, and "effect" also names the Audio90's
reverb, echo, chorus and pump.

**One kind: a sound.** `createAudio80Sound` and `createAudio90Sound` replace
the four instrument and sound effect factories, with the types
`Audio80Sound` and `Audio90Sound`, and `isAudio80Sound` and
`isAudio90Sound`. A sound holds how a note sounds, and how it plays on its
own: `note`, `glideTo`, `lengthMs`, `volume`, `priority` and `maxVoices`, and
on the Audio90 `pan` and the sends.

- A song's `instruments` keeps its name, and its values are sounds. An
  instrument is a sound's role in a song, not a kind of its own. A song
  takes the pitch, the length and the voice from its patterns, so it ignores
  the sound's `note`, `glideTo`, `lengthMs`, `priority` and `maxVoices`.
- The sound effect's `instrument` option goes. A play option changes the
  note, or one sound's options are spread into another's.
- `createAudio90Sample` stays: a sample is audio that a sound plays.
- "Effect" in the API then means only the reverb, echo, chorus and pump.
- The render script finds sounds among a module's exports, so it renders a
  song's instruments too, each at its own note.

**One way to play.** `play` and `noteOn` become one call, and `noteOff`
becomes `release`, which pairs with `releaseAll`:

```ts
play: (sound: Audio80Sound, options?: Audio80PlayOptions) => number;
release: (id: number, atMs?: number) => void;

interface Audio80PlayOptions {
    /** A note name, such as 'E-5', or a number, where 60 is middle C. Defaults to the sound's. */
    readonly note?: string | number;
    readonly glideTo?: string | number;
    /** How long it's held before its release. Infinity holds it until `release`. Defaults to the sound's. */
    readonly lengthMs?: number;
    /** Scales the sound's own volume. Defaults to 1. */
    readonly volume?: number;
    /** The chip time to start at. Defaults to as soon as it can. */
    readonly atMs?: number;
}
// Audio90PlayOptions adds pan.
```

```ts
// Before
chip.play(NIBBLE_HIGH);
chip.play(EXPLOSION, 0.5);
chip.noteOn(3, PAD, 64, 0.8, atMs);
chip.noteOff(3);

// After
chip.play(NIBBLE, { note: 'E-5' });
chip.play(EXPLOSION, { pan: 0.5 });
const id = chip.play(PAD, { note: 64, volume: 0.8, lengthMs: Infinity, atMs });
chip.release(id);
```

- **The id.** The worklet picks a sound's voice after `play` returns, so
  `play` can't return the voice. It numbers each play with a counter
  instead, and sends the number with the play. The worklet notes which play
  each voice holds. `release(id)` releases that play's note, and does
  nothing if its voice has since gone to another sound.
- **No voice to choose.** Nothing outside the worklet picks a voice any
  more, so `noteOn`'s voice has no replacement. Only the Arcade's stand-in
  chip passes `noteOn` on today. `setVoice` also takes a voice (open
  question 10).
- **Hot paths.** The options object is made only when a sound plays, which
  is rare. The check each frame for whether to play, such as a watched
  count's `increased`, makes nothing (rule 5).

**A chip each for music and sound effects.** Songs play on one chip, and
sounds on another. What goes:

- **Keeping voices for music.** `reserveVoices`, the chip's count of voices
  kept for music, free voices taken from the top down so an effect doesn't
  land where a song is about to start, and taking a note a song left
  behind. Choosing a voice comes down to one rule: a free voice, or else the
  oldest sound of equal or lower priority (`shared/choose-effect-voice.ts`).
- **The two volume groups in each chip.** Today each voice is routed to the
  music or the effects group by what it plays, and `setMix` sets each
  group's gain. Each chip has one `volume` instead. `musicVolume` and
  `effectsVolume` leave the controls. The Arcade keeps them as its settings,
  `musicVolume` and `sfxVolume`, and sets each chip's `volume` from them.
- **Shared settings.** A song's echo, filters, reverb, chorus and pump no
  longer colour the sound effects. The pump ducks the music in time with one
  of the song's voices, so it stays with the music.
- **Mixed logs.** A recording chip's log holds only the music or only the
  sounds, so a test reads the one it cares about.

A chip doesn't stop a song and sounds sharing it, but it no longer protects
the music: a sound may take a song's voice until that channel's next note
takes it back, as on the old consoles. The docs say to use a chip for each.

What it costs:

- **Processing.** Each worklet runs its effects every sample, sounding or
  not, so a second Audio90 roughly doubles that fixed part. Voices cost the
  same, since the same notes play. Measure on a phone, in step 10.
- **Samples.** A sample used by a song and by a sound is sent to both chips.
- **Timing between chips.** Each chip keeps its own time, so a sound can't
  be stamped on the music's clock (open question 9).
- **The Arcade's entries** get two chips (below), which touches every entry
  with sound, and its tests.

**The Audio80 has 4 voices,** down from 8. An Audio80 entry has 8 in all, 4
for music and 4 for sounds, as many as today. Several early sound chips had
3 or 4 channels, and arcade boards often carried two or three chips, so two
4-voice chips are true to the period.

- Every Audio80 song in the Arcade uses 3 or 4 channels already, by the
  comments in each entry's `data/music.ts`. A song with more than 4
  channels becomes an error.
- Burrow Bust, Crumb Chase, Fruit Machine and Fuel Run give effects 5 or 6
  voices today, and get 4. Priority and `maxVoices` handle that, but their
  busiest moments need a listen.
- Two 4-voice chips synthesise as many voices as one 8-voice chip. Only the
  echo and the two filters run twice, which is small on the Audio80.

The Audio90 keeps 16 voices (the user), so an Audio90 entry has 32.

**The Arcade.** An entry that names a chip gets two of that kind, `music`
and `sfx`, in place of `sound`, and its tests' recording chips follow. The
page's own Audio80 plays its interface sounds. `MUSIC_PREVIEW`, in
`arcade/data/sounds.ts`, is a one-note song only so that it plays at the
music's volume. It becomes a sound played on a chip at the music's volume:
the entry's music chip, which the page already loads, or a second page
chip. Decided in step 6c: a second page chip, `pageMusic`, since the entry's
music chip is paused while the pause menu, and its sliders, are open. The
preview stays a one-note song, so it sets its filter as it starts.

### 5.9 A smaller API

Decided by the user, 2026-10-27, after a survey of the API against what the
Arcade, the playground and the tests call, and against other sound
libraries: Howler, Pixi Sound, Phaser, Tone.js, ZzFX, PICO-8 and TIC-80. It
takes the root from about 80 exports to about 45, most of them the shapes
of sound options. What a newcomer learns is a chip, its `play`, `queue`,
`stop`, `pause`, `resume`, `volume` and `isMuted`, sounds and songs,
samples on the Audio90, and a headless chip for tests: about Howler's size,
with tracker music on top.

**1. A chip is one object.** `createAudio80()` returned `{ audio80,
controls }`, so that the Arcade's views got the chip without the power to
pause or destroy it. That was one app's rule, paid for by every user.
Howler, Pixi Sound and Phaser each hand you one object with `play`, `stop`,
`volume`, `mute` and `pause`. So the factories return the chip, and
`Audio80WithControls`, `Audio90WithControls`, `AudioControls` and
`HeadlessControls` go. The Arcade gives its views a narrower type of its
own, such as a `Pick` of `play` and `stop`.

**2. Songs play on the chip.** Each chip plays one song at a time, and
every entry in the Arcade makes one music player for its chip. So
`createMusicPlayer`, `MusicPlayer`, `MusicPlayerOptions`, `PlayableSong`,
`SongSlot` and `openSongSlot` go, and one verb plays both:

```ts
const music = createAudio80();
const sfx = createAudio80();

music.play(THEME);
music.queue(BOSS);            // plays when THEME reaches its end
music.tempoScale = 1.25;
music.row; music.beat;         // the song heard, as now

const id = sfx.play(LASER, { note: 'E-5' });
sfx.stop(id);
music.stop();                  // with no id: everything on the chip
```

- `play(song)` starts a song in place of the one playing, and
  `play(sound)` plays a sound (5.8). Both return an id.
- `stop(id?)` replaces `release`, `releaseAll`, the player's `stop` and
  `reset`, as Howler's `stop` does: with an id, that one play, a sound or a
  song; without, everything on the chip. A sound still fades out on its
  envelope's release. As built (step 6b), a chip that is paused cuts its
  voices instead, and forgets the sounds and songs it was sent, since
  nothing is heard while it is paused, and a release would otherwise sound
  as it resumed. The Arcade's entry host relies on that between sessions.
- The chip keeps the player's `song`, `orderIndex`, `row`, `beat` and
  `tempoScale`, and sends the tempo only as it changes. `isPlaying` goes:
  `song` is undefined when none plays.
- `createPlayer` goes (5.7). Its extras become play options for a song,
  as Pixi Sound's `play(alias, { speed, loop })` has them: `repeat`,
  `pitch` and `startMs`. Open question 6, the player's name, goes too.

**3. The setters nobody calls go.** Only the Arcade's stand-in chip, which
passes every call through, and its tests call these: `noteOn` and `noteOff`
(already going in 5.8), `setVoice` (open question 10), `setFilter`,
`setEcho`, `setEffect`, `setCharacter`, `setTempo`, `reserveVoices`,
`voiceCount` and `heardTime`. A song sets the filters, echo, reverb,
chorus and pump as it starts, and `character` stays an option when a chip
is made. A chip of sounds plays with the default effect settings, and a
creation option can follow if someone needs another room. A dozen setting
types go with them, such as `Audio80FilterSetting` and
`Audio90EffectSetting`, and the headless log shrinks to plays, stops and
songs. `time` and `atMs` go too (open question 11): every play starts as
soon as it reaches the chip, and the chip's clock stays inside it.

**4. Pausing while the page is hidden is an option.** Phaser pauses its
sound as the page loses focus, by default. Today every user wires up
`visibilitychange`, and the Arcade combines "paused by the game" with "the
page is hidden" in `PageSound`. A chip option, `pauseWhenHidden`, true by
default, lets the chip keep both reasons itself, and `PageSound.isHidden`
and its combining go. A music page that should play on in the background
turns it off.

**5. One headless chip type.** `HeadlessAudio80<O>` changed its type with
its options: `{ record: true }` added a log, and `{ render: true }` a
renderer. `createHeadlessAudio80({ record?, render? })` returns one type
instead: the chip, with `update(deltaMs)`, `log`, `clear` and
`renderInto(output)`. The log stays empty unless recording, and
`renderInto` throws unless rendering. `renderSong` and `renderSoundEffect`
become one `render(songOrSound, options?)`.

**6. What only an editor needs leaves the root.** `formatAudio90Cell`,
`AUDIO90_CELL_TEXT_WIDTH`, `AUDIO90_SCOPE_LENGTH`, `AUDIO90_SCOPE_PANS`,
`AUDIO90_SCOPE_POINTS`, `AUDIO90_SAMPLE_MEMORY`, `AUDIO90_VOICE_COUNT` and
`Audio90SongPattern` move to a third entry point, `audio90/tracker`, for the
Tune Tracker and later the Studio. The chip's `scope` and `setScopes` stay,
and the docs call them advanced. `computeSongDurationMs(song)` becomes
`song.durationMs`.

**What stays:**

- The shapes of sound options, such as `Audio90Operator` and `Audio90Lfo`.
  They are the sound design itself, and object literals infer them.
- `prepareAudio90Samples`. Samples are bounced on the main thread in a few
  frames, better at a moment the code chooses than as a stall on the first
  play. Bouncing in the worklet would risk a glitch.
- `isMuted` beside `volume`, as every library surveyed has.
- The prefixes on `createAudio80Song` and the rest, since each chip's
  options really differ.

## 6. Docs

The package's README and `docs/` become neutral. Talk to the reader as
someone making a page or a game in any framework.

- **README:** what the chips are, then a chip (5.9): a song, and a sound
  on a button press, in a few lines each. Then the chips
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
| 1. Sound designer | Presets (coin, laser, hit, jump, explosion...), sliders for the wave, envelope, sweep and filter, a randomise and a mutate button, and Play. Exports the sound as code or as a file | Smallest, and the gap people notice first |
| 2. Engine editor | A panel for each Audio90 engine (FM operators, analog oscillators, sample recipes), a scope and a meter, and the computer keyboard as a piano | A song's instruments are the hardest part of it to write by hand |
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
2. ~~Rename, move and re-version (sections 3, 4 and 7), with no API change
   but the factory names.~~ Done, 2026-10-27 (section 12).
3. ~~One clock and the optional context (sections 5.3 and 5.2).~~ Done,
   2026-10-27.
4. Sounds, a chip each for music and sound effects, and the smaller API
   (sections 5.8 and 5.9).
5. The song file format (section 5.5).
6. What a music player needs (section 5.7), on the chip: first the small
   additions, then seeking and fractional pitch.
7. Try the full build on a phone, as 068 left to do.
8. The neutral docs (section 6), near the end, so they are written once,
   after the design has settled (the user, 2026-10-27).
9. Publish `audio90`, and deprecate `@mvtjs/chiptune`.
10. The Studio, a stage at a time (section 8), last, once the package is
    finished (the user).

Section 11 breaks these into numbered steps. In its numbers, the rename
(steps 2 to 4), the docs (step 11) and publishing (step 12) alone make it a
standalone package. Steps 5 to 9 make it pleasant to use outside a game,
and the phone check, step 10, tries it where it is most likely to fail.

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
   needs the same small module, and the README should say so (step 11).
3. ~~**The free clock's default.**~~ Gone with the `clock` option: there
   is one clock (section 5.3, the user, 2026-10-27). What is left of it is
   that a game which forgets to pause its chip plays sound on while paused.
   The docs' first game example pauses the chip, to make that plain.
4. ~~**A free-clock sequencer.**~~ Answered by 068 as built: the sequencer
   moves on in every block the chip clock doesn't plan as silence, so the
   new clock needs no change to it (section 5.3).
5. ~~**Pausing the player.**~~ Answered by section 5.8: sounds play on a
   chip of their own, so pausing the player pauses only the music's chip,
   and a menu's clicks still play.
6. ~~**The player's name.**~~ Gone with `createPlayer`: the chip is the
   player (section 5.9).
7. **The Studio's address.** Beside the others under the site, as
   `/studio/`, or its own domain once it is good enough to stand alone?
8. ~~**The `src/web/` folder.**~~ Decided by the user, 2026-10-28: split
   it by thread. The page's side (`audio80.ts`, `audio90.ts`, `web-chip.ts`,
   `web-song-slots.ts`, `held-writes.ts` and the two held-slots files) stays
   in `web/`, and the audio thread's side (the processors and runners,
   `chip-runner.ts`, `chip-clock.ts`, the sequencer and
   `register-chip-processor.ts`) moves to `web/worklet/`, with
   `song-messages.ts`, which both sides use, where lint lets both reach it.
   Lint then keeps worklet code from importing the page's. Each chip loads
   its worklet with `'./worklet/audio80-processor?worker&url'`, which reaches
   past the new barrel, so the lint rule needs an exception for `?worker&url`
   imports. `song-sequencer.ts`, which exports `createWorkletSequencer`,
   becomes `worklet-sequencer.ts`. The folder keeps its name: "web" names the
   API, Web Audio, not the platform. Done in step 6b, which rewrites most of
   the page's side anyway.
9. **A clock shared by the music and the sounds.** With a chip each
   (section 5.8), a sound can't be stamped on the music's clock, for
   example to land exactly on a beat. `beat` is what the listener hears
   now, so a sound played as it ticks over is heard one output delay late:
   tens of milliseconds, more on some phones. Nothing in the Arcade needs
   it today, and both chips run on one `AudioContext`, so a shared clock
   could come later: chip time as the context's time, less the time spent
   paused, would agree on two chips paused together. It would bring back
   `time` and `atMs`, removed by question 11.
10. ~~**`setVoice`.**~~ It goes, with the other setters nobody calls
    (section 5.9).
11. ~~**`time` and `atMs`.**~~ Removed (the user, 2026-10-27). `atMs`
    started a write at an exact moment on the chip's clock, `time`, as Web
    Audio's `start(when)` does, so sounds scheduled a little ahead kept
    exact spacing: a countdown's ticks, a drum fill, a sound on a beat.
    Without it, a play starts at the worklet's next block after it
    arrives, so a frame's jitter shows in the gaps between sounds, which
    matters only for rhythm. Songs keep exact timing, since the sequencer
    stamps their notes in the worklet. Nothing in the Arcade used either:
    only the stand-in chip passed `atMs` on, and tests read times from the
    headless log, which keeps them. Both come back with question 9's
    shared clock, when a rhythm game needs them.

## 11. Implementation Steps

Reordered on 2026-10-27, at the user's request: the docs come near the
end, after any other change to the design, and the Studio last, once the
package is finished. The progress log uses these numbers.

1. ~~Merge 068.~~ Done: `0ebacfec`, on the branch `audio90`.
2. ~~Move the folder, rename the package, and swap the export condition
   for a publish manifest as v-snap's. Rewrite the imports across the repo.
   `npm test`, `npm run build` and `npm run build:packages` pass.~~ Done,
   2026-10-27 (section 12).
3. ~~Rename the browser factories and the worklet names.~~ Done,
   2026-10-27 (section 12).
4. ~~The playground's library list, descriptions and export dependencies
   name `audio90`. No alias for the old name (section 7).~~ Done with step
   2. The one-line description still says "A little sound chip", which
   step 11 can make "Two little sound chips".
5. ~~One clock (section 5.3): the browser chip on the sound card's time,
   with `pause` and `resume`, and writes sent by a microtask. Remove
   `update`, `flush`, the lead, the stalls and `stallCount` from the
   browser chip, and `refresh` from the music player. `update` moves to
   the headless chips' controls. The Arcade's entry host and page pause
   their chips, the page while it is hidden too, and the Perfmon loses
   "Chip stalls". Then the optional `context`. Unit tests in the fake audio
   context, and a page test in a real browser.~~ Done, 2026-10-27
   (section 12).
6. ~~Sounds, a chip each for music and sound effects, and the smaller API
   (sections 5.8 and 5.9). Both rewrite the chip's interface, so they go
   together, in five parts that each leave lint, the tests and the build
   passing, and each change the package and the Arcade together:~~ Done,
   2026-10-29 (section 12).
   - ~~**6a, sounds:** one kind in place of instruments and sound effects;
     `play(sound, options)` returning an id; `stop(id)`; no `noteOn` or
     `noteOff` on the chips.~~ Done, 2026-10-28 (section 12).
   - ~~**6b, the chip as one object:** the controls fold in, songs play on
     the chip, and the music player and song slots go; one headless chip
     type and one `render`; `src/web/` split by thread (open question 8).~~
     Done, 2026-10-28 (section 12).
   - ~~**6c, a chip each:** no voices kept for music, no volume groups, the
     Audio80 at 4 voices, `music` and `sfx` chips for each entry,
     `musicVolume` and `sfxVolume`, `pauseWhenHidden`.~~ Done, 2026-10-28
     (section 12).
   - ~~**6d, removals:** the setters, `time` and `atMs`; the tracker's
     helpers to `audio90/tracker`; `song.durationMs`.~~ Done, 2026-10-28
     (section 12). The user listened to the four busiest games after 6c,
     and they sounded fine.
   - ~~**6e, simplify.** A review after 6d (section 12, 2026-10-28) found
     about 800 to 1,000 of the package's 11,700 lines that could go, most
     of them doubled between the chips or left over from writes the page no
     longer makes. The user asked for all of it, in parts that each leave
     lint, the tests and the build passing:~~ Done, 2026-10-29 (section 12).
     1. **The writer by numbers.** The writer is internal now, so it takes
        each setting as the number the song's cells hold, and the drivers
        forward it as it is. The reverse tables, `listNamesByIndex`, the
        setting-name unions and the `*SettingValue` types go, and so do the
        voice settings no song writes. Fix `Audio80Writer`'s docs, which
        still say 8 voices.
     2. **Plain messages from the page.** The page writes only plays, stops
        and stopping everything, so each goes to the worklet as a message of
        its own. While the chip can't play, plays are dropped and the rest
        are sent anyway. The batches, the spare buffers, the held writes,
        `sendSoon`, `onFirstWrite` and `hasClock` go, and the page keeps no
        command writer, only its sound ids and the checks on play options.
        The worklet's clock reply goes too: the page measures the speaker's
        lag as each song place arrives.
     3. **The song player writes as it updates.** `update` and `refresh`
        become one, and the player is the `SongSequencer` itself, so the
        headless chip's adapter goes.
     4. **One interface for both chips, and scopes attached.** A scope is
        not needed to play music and sounds, so it leaves the chip:
        `createScope(chip)`, in `audio90/tracker`, attaches one, as an
        `AnalyserNode` attaches to a node. It returns a `Scope`:
        `voiceCount`, `data` (`SCOPE_POINTS` points a voice, then each
        voice's pan) and `destroy`. Each chip's factory registers its
        hooks in a `WeakMap` private to the package, so the chip carries no
        member for it, not even a hidden one. The chip sends scopes only
        while one is attached, and copies each into every scope attached.
        Both chips have them; an Audio80's pans are 0. A chip with no hooks,
        such as a headless chip that doesn't render, gives a silent scope.
        `scope` and `setScopes` leave the Audio90, so `Audio80` and
        `Audio90` are plain `SoundChip`s, differing only in their song,
        sound and play option types. `AUDIO90_SCOPE_PANS` and
        `AUDIO90_SCOPE_LENGTH` give way to `SCOPE_POINTS`. In the Arcade,
        the entry host passes a session the loaded chips rather than
        `PageSound`'s stand-ins, which a session gets only while sound is
        off, so `createScope` finds the real chip; the Tune Tracker attaches
        its scope as it starts and destroys it as it ends, and `MusicChip`
        loses its Audio90 members. (The user, 2026-10-28, in place of an
        `isScopeOn` property on every chip: other options were the chip's
        output node for an `AnalyserNode`, which sees only the mix, and a
        factory option, which keeps it on the chip's type.)
     5. **No headless log.** Tests spy on the chip's `play`, `queue` and
        `stop`, and read its `song`, `row` and `tempoScale`: a view chooses
        the song and its tempo, and the package's own tests check how the
        song plays. The `record` option, the logging writers, `Audio80Write`,
        `Audio90Write` and the recording writers go; the song player's tests
        use a writer made of `vi.fn()`. The Arcade's audio view tests compare
        calls and state, not notes, and the "tells every song apart" tests
        go. The headless chips carry no hidden writer members, so `render`
        builds what it needs from the package's internal parts, with no
        casts, and a chip made with no options keeps a writer it clears
        each update instead of a silent writer of its own.
     6. **Shared code for the two chips.** One tracker parser in
        `shared/tracker.ts`, driven by each chip's table of tokens, with
        `formatAudio90Cell` reading the same table. The synthesisers share
        `render`, `enqueue`, `toSampleIndex` (the Audio90's lacks the
        Audio80's `- 1e-9`, so a stamp on a sample boundary can apply a
        sample late), the play bookkeeping, the envelope stepper, the
        filter maths, polyBLEP and their constants, and one numbering of
        the common opcodes. Then the smaller repeats: `parseNote`, the
        highest-note checks, the tables that copy each other (the echo
        defaults, the Audio90's `DEFAULT_*` effects, `tokens.ts`, the engine
        and character mirrors), and `Audio80Sound.note` and `.filter`. The
        two row writers live in matching places; the Audio80's names gain
        the chip's prefix; barrel exports used only by tests go. One way to
        say each thing: `legato.glideMs` goes in favour of `glideMs`, and
        `filter.envelope` in favour of a `modEnvelope` aimed at the cutoff.
        The audio hash tests must stay exact, apart from any render the
        `toSampleIndex` fix moves, which the user hears first, and the
        benchmarks (`npm run bench -w audio90`, saved in the package's
        `bench/results/`) run before and after.
     7. **Tests.** Remove the duplicates the review found (the volume clamp
        tested 5 times, "refuses to render" 3 times, the raw command test,
        the voice choice repeated in the synthesiser tests, the browser
        tests copied between chips, a reset test another covers), share the
        browser test helpers, and keep the test support files out of the
        published package. Fill the gaps: the worklet's `tempo` and `queue`
        calls, the browser chip's volume and mute, an Audio80 song through a
        browser chip, and the worklet's note stamps against the headless
        player's.

   What the whole step covers:
   - **The package:** one kind, a sound, in place of instruments and sound
     effects. The chip is one object: `play` for songs and sounds, with
     options, returning an id; `queue`; `stop(id?)`; the song's place and
     `tempoScale`; `pause`, `resume`, `volume`, `isMuted`, `ready` and
     `destroy`; `pauseWhenHidden`. Remove the controls object, the music
     player and song slots, `noteOn`, `noteOff`, `releaseAll`, `reset`,
     the setters, `time`, `atMs`, `reserveVoices`, the voices kept for
     music and the two volume groups. Take the Audio80 to 4 voices, and make a song with more
     channels an error. One headless chip type, and one `render`. Move the
     tracker's helpers to `audio90/tracker`, and add `song.durationMs`. The
     render script, the changesets and the tests follow.
   - **The Arcade:** `music` and `sfx` chips for each entry with sound, in
     the entry host, `PageSound` and its stand-in chips, which shrink with
     the API; the chips pause themselves while the page is hidden; the
     settings' `musicVolume` and `sfxVolume`; the music slider's preview;
     a narrow chip type for views; every entry's sounds, songs, audio views
     and tests; the tunes and the Tune Tracker. Listen to Burrow Bust, Crumb Chase, Fruit Machine and Fuel
     Run at their busiest, with 4 voices for effects.
   - **Elsewhere:** the playground's examples, starters and exported
     projects, the benchmarks, and AGENTS.md's sound rule.
   - **Checks:** lint, unit and visual tests, the build and its budget,
     `build:packages`, and a page test in Playwright's headless shell, as
     in step 5.
7. ~~Add `formatAudio90Song` and `parseAudio90Song`, with a round-trip test
   over every tune in the Arcade.~~ Done, 2026-10-29.
8. ~~Add to the chip what a music player needs (section 5.7): the `repeat`
   and whole-semitone `pitch` play options, `stereoWidth`, and the
   `onEnded` and `onRow` options. Music fades too (the user, 2026-10-28):
   games fade their music out all the time, and today a page steps
   `volume` itself, so something like `stop(id, { fadeMs })`.~~ Done,
   2026-10-29, in four chunks (section 12). A chip playing a song becomes
   the README's first example in step 11.
9. Add the `startMs` play option, and starting at an order entry and row,
   with a test that a song started at a row sounds the same as one played
   to it. Then fractional pitch.
10. Try the full build on a phone, over Bluetooth too, as 068 left to do:
    every entry's music and sounds, pausing and resuming a game, and what a
    second Audio90 costs (section 5.8). It comes before the docs, since
    what it finds may change the design.
11. Rewrite the README and the three guides. Move the MVT material to the
    docs site's Sound and Music page. Update the glossary, project
    structure and AGENTS.md. Decide open question 8 first, since the README
    describes the package's layout.
12. A changeset for the rename, beside 068's. Publish `audio90`'s first
    version by hand, since npm trusts a workflow only with a package that
    exists, then set up trusted publishing for it, as
    `.changeset/README.md`'s "The first release" says. Deprecate
    `@mvtjs/chiptune`.
13. The Studio, stage 1, as its own proposal, once `audio90` is published.

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
    about entry points. The rest of their wording waits for step 11.
  - The playground's entry is `libraries/entries/audio90.ts`, and its type
    bundle script takes each library's npm name, so `audio90`'s types load
    under that name. An exported project that uses sound asks for
    `audio90@^0.7.0`, which npm won't have until step 12.
  - The Arcade gained `runner/web-chips.ts` (open question 2).
  - Checked: `npm run test:unit` (231 files), `npm run test:visual` (50
    files, no image changed), `npm run lint`, `npm run build` with its
    budget, one-copy and link checks, `npm run build:packages`, and
    `npm pack -w audio90`. The packed manifest names `dist/`, the repo's
    came back after, and plain Node imports both entry points from the
    tarball.
- **2026-10-27, step 3 done**, unstaged: `createWebAudio80` and
  `createWebAudio90` are `createAudio80` and `createAudio90`, and their
  options types `Audio80Options` and `Audio90Options`, everywhere but the
  notes and the changelog. The worklets register as `audio80-chip` and
  `audio90-chip`, through the same two constants the chips create their
  nodes with. Their files are named for what they export, as the user
  asked: `web/web-audio80.ts` and `web/web-audio90.ts` became
  `web/audio80.ts` and `web/audio90.ts`, with their tests.
  Checked: `tsc -b`, lint, `npm run test:unit`, `npm run build` (first
  load 54.7 KB) and `npm run build:packages`. Not yet heard in a real
  browser since the rename.
- **2026-10-27, step 5 done**, unstaged, before the docs at the user's
  choice, so they describe one clock:
  - **The worklet's clock** (`web/chip-clock.ts`) plays from chip time 0 at
    the sound card's rate. A pause holds chip time, fades out over one block
    with the voices sounding, then plans silence, so the sequencer stops. A
    resume fades back in. The lead, the catch-up, the stalls and the
    one-second fade are gone. The runner sends a `clock` reply, with the
    chip time at a frame and the rate, whenever the rate changes: at the
    first block, and as it pauses and resumes. The page works out `time` and
    `heardTime` from it. Batches lose `horizonMs`, and buffer replies carry
    only the buffer.
  - **The page's side** (`web/web-chip.ts`) sends the writer's commands at
    the end of the task (the writers' new `onFirstWrite`), and the writer has
    no clock (`hasClock: false`), so a write with no `atMs` plays as soon as
    it arrives. While the chip is paused, it keeps only the lasting writes,
    as while the context is suspended, and sends them as it resumes, as the
    context starts, or as the worklet loads. `pause` and `resume` are
    messages, kept until the worklet runs, and a reset before then keeps a
    pause. Without a `context`, the chip makes its own, starts it at the
    first `pointerdown`, `keydown` or `touchend`, and closes it when
    destroyed. Where there is no `AudioContext`, as in Node, it throws and
    names `audio90/headless`.
  - **Song calls** carry no chip time, so the sequencer's skip-ahead and its
    `noteOnOp` option are gone. A song started while audio cannot play
    starts from its beginning.
  - **Controls:** `AudioControls` has `pause`, `resume` and `isPaused`, and no
    `update`, `flush` or `stallCount`. `HeadlessControls`, from
    `audio90/headless`, adds `update`, which does nothing while paused.
    `Audio80WithControls` and `Audio90WithControls` take the controls' type
    as a second parameter, which the headless chips set.
  - **The music player** passes each call to its slot at once, and sends
    the tempo only as it changes (section 5.4).
  - **The Arcade:** the entry host pauses the entry's chip as it pauses
    the game, and resumes it for each new session. The Pixi stage and the
    loop no longer touch the chips. `PageSound` lost `stallCount` and gained
    `isHidden`, which `main.ts` sets on `visibilitychange`. Its stand-in
    controls pause a chip while either its own controls or the hidden page
    say so, so showing the page doesn't resume a paused game's chip. The
    Perfmon's "Chip stalls" line and its CSS are gone. The audio views and
    their tests lost every `refresh()` on a music player.
  - **The playground's** sandbox pauses the chip while the project is
    paused, and it and exported projects call `createAudio80()` with no
    context. Before, neither ever started the context they made, so an
    exported project's sound depended on the browser's autoplay rules.
  - **Changesets:** `one-clock.md` describes the API change, and
    `music-on-the-sequencer.md` no longer mentions `refresh` or the
    skip-ahead. AGENTS.md's sound rule says how music and pausing work now.
    The rest of the docs wait for step 11.
  - **Checked:** `npm run lint`, `npm run test:unit` (231 files, 3,005
    tests), `npm run test:visual` (50 files, no image changed),
    `npm run build` (first load 54.7 KB) and `npm run build:packages`. In
    Playwright's headless shell, against the build: Galaxy Raiders reported
    20 rows in 2 s, none while paused with Escape (a `pause` posted, and a
    clock reply with a rate of 0), and 20 in 2 s after resuming. Hiding the
    page posted `pause` to both Audio80s, and no rows came until it showed
    again. The Tune Tracker played 32 rows in 4 s on the Audio90. No page
    errors. Not yet listened to by a person.
- **2026-10-27, section 5.8 decided** with the user: one kind, a sound, in
  place of instruments and sound effects, with a song's `instruments`
  holding sounds; `play(sound, options?)` in place of `noteOn`, returning an
  id for `release`; a chip each for music and sound effects, with
  `musicVolume` and `sfxVolume` as the Arcade's settings; the Audio80 down to
  4 voices, the Audio90 kept at 16. Step 6 does it. Open
  question 5 is answered by it, and questions 9 and 10 are new.
- **2026-10-27, steps reordered** at the user's request. The docs moved
  from step 5 to step 11, after every change to the design. The phone
  check, step 10, comes before them, since it may change the design too.
  Publishing is step 12, and the Studio is last, step 13. One clock became
  step 5, and sounds step 6. The entries above use the new numbers.
- **2026-10-27, section 5.9 decided** with the user, after surveying the
  API against its callers and other sound libraries: the chip is one
  object, songs play on it with no music player, `createPlayer` and the
  unused setters go, `pauseWhenHidden`, one headless chip type, one
  `render`, and `audio90/tracker` for the tracker's helpers. Section 5.7
  now lists what the chip needs to be a music player. It goes into step 6
  with 5.8. Open questions 6 and 10 are answered, and 11, on `time` and
  `atMs`, is new.
- **2026-10-27, open question 11 answered:** `time` and `atMs` go (the
  user). They come back with question 9's shared clock if a rhythm game
  needs exact spacing between sounds.
- **2026-10-28, open question 8 decided** (the user): `src/web/` is split
  by thread, the audio thread's side in `web/worklet/`, in step 6b. Step 6
  is done in four parts, 6a to 6d.
- **2026-10-28, step 6a done**, unstaged, after the user listened to one
  clock and committed it:
  - **Sounds.** `createAudio80Sound` and `createAudio90Sound`, in
    `notation/sound.ts`, replace the instrument and sound effect factories,
    whose files are gone. A sound's data, now `SoundData` and
    `Audio90SoundData` in `synthesiser/sound-data.ts`, gains `lengthMs`,
    `glideTo`, `priority` and `maxVoices`. A song's `instruments` hold
    sounds. Error messages start `sound:`.
  - **Playing.** `play(sound, options?)` writes two commands, a play's
    options (its length, or -1 to hold, its glide and, on the Audio90, its
    pan) and then the play (the sound, the play's id, the note and the
    volume), because a command carries only four numbers. The page numbers
    the plays from 1. The synthesisers keep each voice's play id, and
    `stop(id)` releases that play's voice only. Their table of effects is
    gone: a played sound is defined once, by id, as a song's sounds are.
    The voice chooser is `chooseSoundVoice`, in `shared/choose-sound-voice.ts`.
    A play's pan on the Audio90 replaces the sound's own pan.
  - **Internals.** The public chips lose `noteOn` and `noteOff`, but the
    internal `Audio80Writer` and `Audio90Writer` keep them for the song
    drivers. The headless chips implement both, so their songs write
    through them. Package tests that drive voices directly name the chip as
    its writer with a small cast. The benchmarks hold their notes with a
    one-row song. While the chip can't play, a stop is kept in one of 32
    slots chosen by its play's id (`STOP_SLOT_COUNT`).
  - **The Arcade.** About 30 effects built on another sound were flattened:
    an inline sound's options merged in, and a named base turned into an
    options object that its sounds spread in. Neon Monsoon's storm hit
    exports `STORM_HIT_OPTIONS`, which its warning spreads, with the two
    volumes multiplied. No two levels set a volume or a pan. Neon Monsoon's
    pans are play options. The sounds tests test alone only the sounds
    played on their own: a song's instruments, now found by `findSounds`,
    are heard in their songs' tests.
  - **Checked:** `npm run lint`, `npm run test:unit` (231 files, 3,014
    tests, and no sound's hash changed), `npm run build` (first load
    54.6 KB). In Playwright's headless shell, against the
    build, Galaxy Raiders sent its plays as options then play, defined its
    sounds once each, and made sound while firing, with no page errors.
    `npm run test:visual` (50 files, no image changed) and
    `npm run build:packages` pass too. Not yet listened to by a person.
- **2026-10-28, step 6b done**, unstaged, after the user committed 6a:
  - **One object.** `createAudio80` and `createAudio90` return the chip.
    What the controls did is on it, through `SoundChip`, in
    `shared/sound-chip.ts`, which the root exports, and which `Audio80`
    and `Audio90` extend with their own members. `AudioControls`,
    `HeadlessControls` and the `WithControls` types are gone. Each factory
    joins the members every chip has with its own by copying property
    descriptors (`joinMembers`), so getters stay getters.
  - **Songs on the chip.** `play(song)`, `queue(song)`, `stop(id?)`, `song`,
    `orderIndex`, `row`, `beat` and `tempoScale` are made once for every
    chip, by `createChipPlayback` (`shared/chip-playback.ts`), over a
    `SongSequencer`: on the page, `web/web-songs.ts`, and on a headless
    chip, a song player run on its clock. `play` tells a song from a sound
    by its `order`, which a sound has none of, so a sound made by hand, as
    some tests make one, still plays as a sound. Songs take play ids from
    the writer's count (`takePlayId`), so no two plays share one. `queue`
    returns the id of the play it follows, or a new one if it starts at
    once. `stop(id)` with a song's id stops the song, unless another song
    has been played since. Each chip has one sequencer slot now, so the
    slots, their numbers and `openSongSlot` are gone from the messages, the
    worklet sequencer and the page. The music player and its tests went;
    `music-player/` is `song-player/`, which keeps the song player and the
    drivers. Their tests became `shared/chip-playback.test.ts` and
    `headless/headless-chip.test.ts`.
  - **`stop()`** releases every voice and stops the song. While the chip is
    paused, it resets the worklet instead (section 5.9, point 2): the page
    forgets the sounds and songs it sent, as the worklet does, and the
    Audio90 turns its scopes on again if they were on, since the worklet's
    reset turns them off. A headless chip that renders cuts its synthesiser
    in the same way, and sets the mix at once.
  - **One headless type.** `HeadlessAudio80` is `Audio80` with `update`,
    `log`, `clear`, `sampleRate` and `renderInto`, whatever the options:
    `log` stays empty unless recording, and `renderInto` throws unless
    rendering. Both chips share `headless/headless-chip.ts`. A recording
    chip logs each `stop`, with an `id` of `undefined` for a stop of
    everything, and no longer logs `release-all`. The chip is still its own
    writer at run time, with `noteOn` and `noteOff`, which its type leaves
    out, for code that writes a song's notes. `render(songOrSound)`
    replaces `renderSong` and `renderSound`.
  - **`src/web/` split** (open question 8): the audio thread's side is in
    `web/worklet/`, with a barrel the page imports types and names
    through. `song-sequencer.ts` is `worklet-sequencer.ts`. The lint rule
    `no-deep-imports` now allows a relative import with a query, such as
    `./worklet/audio80-processor?worker&url`, with a test. Nothing in lint
    stops the worklet's files importing the page's by path, so the split
    is kept by convention.
  - **The Arcade.** `PageSound.entryChips` is the chip of each kind, and
    `pageControls` is gone; each stand-in chip keeps the volumes, the
    pause and now the tempo scale until its chip loads. The entry host
    stops everything on the chip as a session starts and ends, pausing it
    first so the voices are cut, as the reset did, then leaving it paused
    or not as it was. The audio views play songs on the chip. Until 6c
    gives music a chip of its own, a view that stops its music keeps the
    song's play id and stops that (`musicId`), since `stop()` would release
    its sound effects too: Neon Monsoon plays a sound just before it stops
    its music. In 6c these become `music.stop()`. Views keep the full chip
    type until then too, since 6c retypes every view. The fake web audio's
    chips count `stop` with no id, in place of resets. The Tune Tracker
    reads the song heard from the chip. Stale comments about the page's
    chip being ticked, left from step 5, are fixed in `arcade/main.ts` and
    the Arcade's README.
  - **Elsewhere:** the playground's sandbox pauses the chip itself, and its
    tests and starters take the chip whole. The benchmarks play their held
    notes with `chip.play`, and `games-and-demos` ticks the chip. AGENTS.md's
    sound rule, its package line and the view skill describe songs on the
    chip. The package's README, guides and the headless README still
    describe the music player: step 11 rewrites them. A changeset,
    `.changeset/one-chip.md`.
  - **Checked:** `npm run lint`, `npm run test:unit` (232 files, 3,029
    tests, no snapshot changed), `npm run test:visual` (50 files, no image
    changed), `npm run build` (first load 54.6 KB) and
    `npm run build:packages`. In Playwright's headless shell, against the
    build, Galaxy Raiders' chip played its music (46 song places back from
    the worklet, a peak of 0.129) and its shots; a session's start sent
    `pause`, a song `stop`, `reset` and `resume` in that order; Escape
    paused the chip; no page errors. Not yet listened to by a person.
- **2026-10-28, step 6c done**, unstaged, after the user committed 6b:
  - **The package.** The synthesisers keep no voices for music and mix no
    groups apart: `OP_RESERVE_VOICES`, `OP_SET_MIX` and their Audio90
    twins, `setMix`, `reserveVoices`, `MIX_BUS_INDEX` and the song driver's
    `finish` are gone, and a song writes no voices to keep. The voice
    chooser takes a free voice from the top down, or else the oldest song
    note or sound of no higher priority. `musicVolume` and `effectsVolume`
    left `SoundChip`; a chip has one `volume`. Removing the gains changed
    no sample: they multiplied by 1. The Audio80 has 4 voices, and a song
    with more channels was already an error, against `VOICE_COUNT`.
  - **`pauseWhenHidden`** on `createAudio80` and `createAudio90`, true by
    default: the browser's chip holds its sound while the page is hidden,
    through the same pause message as `pause`, and `isPaused` reports only
    the chip's own pause. A chip made in a hidden page starts held. With no
    `document`, as in a worker, there is nothing to watch.
  - **The Arcade.** An entry that names a kind of chip gets two, `music`
    and `sfx`, typed for its views as `MusicChip<K>` and `SfxChip<K>`, from
    `#shared`: a `Pick` of the members a view plays with, so a view
    can't pause the chips or set their volumes (section 5.9, point 1). The
    Audio90's `MusicChip` keeps `scope` and `setScopes` for the Tune
    Tracker. `PageSound` has music and sound effects chips of each kind, and
    `pageSfx` and `pageMusic` for the page; the music chips play at the
    music's volume and the rest at the sound effects'. `isHidden` and its
    combining went, since the chips hold themselves while the page is
    hidden. The settings' `effectsVolume` is `sfxVolume`, with
    `turnSfxOn`, `turnSfxOff` and the rest renamed to match, and settings
    saved under the old names still read back. The menu still says
    "Effects". The entry host pauses, resumes and stops both chips. Every
    audio view plays its songs on `music` and its sounds on `sfx`, with no
    play ids kept for the music (6b's `musicId`). Astrovoid and Kwazy Cactii
    have no music, so they take only `sfx`.
  - **Tests.** Each audio view test with music records the two chips apart,
    and checks songs on the music chip's log and sounds on the other's. The
    data tests' checks that songs left voices to the sound effects went.
    Neon Monsoon's test finds a song's start by the tempo it sets, not the
    voices it keeps. The sounds' hashes are unchanged; `EFFECTS_PREVIEW` is
    `SFX_PREVIEW`, with the same hash.
  - **Elsewhere:** the games benchmark ticks two chips, and the Audio80
    benchmark measures 1, 2 and 4 voices, so its saved results no longer
    match its columns until the next save. The playground's projects keep
    one chip: none of its examples plays sound. AGENTS.md, the view skill
    and the entries README describe the two chips. A changeset,
    `.changeset/chip-each.md`.
  - **Checked:** `npm run lint`, `npm run test:unit` (232 files, 3,015
    tests), `npm run test:visual` (50 files, no image changed),
    `npm run build` (first load 54.6 KB) and `npm run build:packages`. In
    Playwright's headless shell, against the build, Galaxy Raiders made four
    Audio80s; its music played on one (47 song places, peak 0.349) and its
    shots on another, and hiding the page paused the page's two chips (the
    entry's were already paused by Escape). No page errors. Not yet
    listened to: Burrow Bust, Crumb Chase, Fruit Machine and Fuel Run at
    their busiest, with 4 voices for their sound effects.
- **2026-10-28, step 6d done**, unstaged, after the user committed 6c:
  - **The chips.** `Audio80` is now just `SoundChip` of its song, sound and
    play options, and `Audio90` adds only `scope` and `setScopes`. The
    setters, `time`, `heardTime` and `voiceCount` left both; with them goes
    every `atMs` a page could pass. The internal writers keep them all, for
    the song drivers and the worklet's sequencer. The browser chip's clock
    reply now only measures the speaker's lag, for the song's place, so
    `findChipTimeAt` and its constants went.
  - **Held writes.** A page writes only plays and stops, so a suspended
    context keeps only stops and "release everything":
    `createStopSlots` in `web/held-writes.ts` replaces the two chips'
    `*-held-slots.ts` files.
  - **Headless.** The log holds `play`, `stop`, `note-on` and `note-off`
    (the user's choice): the settings a song makes pass through unlogged.
    The headless chips keep the writer's members at run time, but their
    types leave them out, so `render` and the package's tests cast to the
    writer. The song player's tests use recording writers of their own,
    `createRecordingAudio80Writer` and `createRecordingAudio90Writer` in
    `song-player/recording-writers.ts`, which log the settings too, so the
    slides and filters are still checked.
  - **`audio90/tracker`**, a third entry point: the scope's layout,
    `formatAudio90Cell`, `AUDIO90_CELL_TEXT_WIDTH`, `AUDIO90_SAMPLE_MEMORY`,
    `AUDIO90_VOICE_COUNT` and `Audio90SongPattern`, which left the root.
  - **`song.durationMs`**, one pass at the song's own tempo, set as the
    song is made. `computeSongDurationMs` stays inside the package, and
    `render` uses the song's own.
  - **The Arcade.** `PageSound`'s Audio80 stand-in is the shared one alone,
    and the Audio90's adds only the scopes. The Tune Tracker imports from
    `audio90/tracker`. The tests read `song.durationMs`. Neon Monsoon's test
    clears the music chip's log before the song it listens to, since the
    log no longer has the tempo a song sets.
  - **Elsewhere:** the benchmarks, the render script and the playground
    used none of what went. The view skill checks a jingle with
    `durationMs`. The package's README and guides still name the setters, for step 11. A
    changeset, `.changeset/smaller-chip.md`.
  - **Checked:** `npm run lint`, `npx tsc -b`, `npm run test:unit` (232
    files, 3,008 tests), `npm run test:visual` (50 files, no image
    changed), `npm run build` and `npm run build:packages` (attw and
    publint clean, with `tracker/index` built). Not run in a browser: the
    browser chip lost only its clock and the held settings, which the
    stand-in context's tests cover.
- **2026-10-28, a review after 6d**, of the API, the code and the tests,
  with other sound libraries for comparison (Howler, Tone.js, ZzFX and
  ZzFXM, chiptune3):
  - **The API** is small: 15 members on a chip, one play options object,
    and four constructors. Only audio90 has a ticked headless clock with
    exact tests, the song's place as heard through the speaker's lag,
    gapless `queue` and voices stolen by priority. It lacks events, repeat
    counts and seeking (steps 8 and 9), changes to a play after it starts,
    and fades. Unused notation features (several song tokens, `fixedHz`,
    `oscillatorB`, `isReversed`, sync and ring) stay, as the chips'
    character.
  - **The code:** about 800 to 1,000 lines could go, listed as 6e's parts.
  - **The tests:** 5,021 lines, 43% of the source, mostly valuable; about
    280 lines of duplicates, and four gaps that matter more (6e, part 7).
  - **The user's answers:** all of the simplifications, as 6e; music fades
    noted for step 8; `isScopeOn` in place of `setScopes`, then, after
    parts 1 and 3, a scope attached with `createScope` from
    `audio90/tracker` instead, off the chip's interface; scopes on the
    Audio80 too, so both chips have one interface; and no headless log,
    with tests that spy on the chip and read its state.
- **2026-10-28, 6e parts 1 and 3 done together**, unstaged, since the drivers
  kept their writes only for a refresh to decode:
  - **One writer for songs.** `SongWriter<Sound>`, in `shared/song-player.ts`,
    is `time`, `write(op, stamp, a, b, c, d)` and `soundId(sound)`, which the
    command writers implement. `Audio80Writer` and `Audio90Writer` are gone,
    and so are the command writers' `noteOn`, `noteOff`, setters and
    `voiceCount`; `defineSound` is `soundId`. The drivers write each command
    as they make it, with no pending buffer, reverse tables or name round
    trip. The voice settings no song writes went: on the Audio80 `note`,
    `echoSend`, `filter`, `wave`, `syncSource` and `ringSource` (a sound
    still sets sync and ring from its data), and on the Audio90 `note`.
    With them went the `*SettingValue` types and `VOICE_SETTINGS`,
    `FILTER_SETTINGS` and `ECHO_SETTINGS`.
  - **Matching places.** The song player is in `shared/song-player.ts` and
    takes a driver: `createSongPlayer(createAudio80SongDriver(writer))`. Each
    chip's driver is in its `notation/song-driver.ts`; the Audio90's replaces
    `song-writer.ts`, and the sample bounce uses it. `src/song-player/`, the
    recording writers among it, is gone.
  - **The player writes as it updates.** `refresh` and `isPlaying` went, and
    the player is a `SongSequencer`, whose `setTempoScale` is now a
    `tempoScale` property, so the headless chip's adapter went.
  - **Tests.** The song player's tests use a writer whose `write` is a
    `vi.fn()`, read back as commands; the Audio90 driver's tests, with the two
    moved from `notation.test.ts`, are in `song-driver.test.ts`. The headless
    tests write through small helpers until part 5 rewrites them. The
    reverse tables' test, a pause test that only refreshed, the overloads'
    type test and the setter type tests went.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (231 files, 2,994
    tests, the audio hashes unchanged), `npm run build` (54.3 KB) and
    `npm run build:packages`. In Playwright's headless shell, Galaxy
    Raiders' music played on its chip (47 song places, peak 0.349, as in
    6c) and its shots on another, with no page errors. The package's source
    is about 11,240 lines, down from 11,950.
- **2026-10-28, 6e part 2 done**, unstaged, with the browser chips' share of
  part 7:
  - **Plain messages.** A play goes to the worklet as a `play` message, with
    the sound's id, the play's id and its checked numbers; a stop as `stop`,
    and stopping everything as `release-all`. The chip's own destroy
    message is now `destroy`. While the chip can't play (the worklet not
    yet running, the context suspended, the chip paused or the page
    hidden), a play is dropped as it is made, though its sound is still
    defined, and a stop is still sent; before the worklet runs, nothing has
    played, so a stop is dropped too. Gone: the batches, the spare and
    returned buffers, `held-writes.ts`, `sendSoon`, `onFirstWrite`,
    `hasClock`, `ChipBatch`, `ChipBufferReply` and the chips'
    `*ChipMessage` types, and the command buffer's `clear(buffer)`.
  - **No clock reply.** The page measures the speaker's lag as each song
    place arrives, so the worklet's `clock` reply and `ChipClockReply` went.
  - **One writer.** The four play opcodes are shared (`OP_PLAY_OPTIONS`,
    `OP_PLAY`, `OP_STOP`, `OP_RELEASE_ALL` in `shared/commands.ts`), so the
    runner turns a `play` message into its commands, and one
    `createCommandWriter`, in `shared/command-writer.ts`, replaces
    `createCommandAudio80` and `createCommandAudio90`. It takes a chip's
    sound ids, `createAudio80SoundIds` or `createAudio90SoundIds` (in each
    `chip/`), which the page uses too. `checkPlay` and `writePlay`, in
    `shared/play-options.ts`, check and write a play for every chip.
  - **Tests.** The browser chips' shared behaviour is tested once, on the
    Audio80, and the Audio90's file keeps only its own; the copied tests
    went. New: a browser chip's volume and mute (the fake context records
    its gains), an Audio80 song through a browser chip, and the worklet's
    `tempo` and `queue` calls. The runner's tests play as the page does;
    the clock reply's test and a reset test another covered went.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (231 files, 2,991
    tests), `npm run build` (54.3 KB), `npm run build:packages`, and Galaxy
    Raiders in Playwright's headless shell: its music on its chip (46 song
    places, peak 0.349), its shots as `play` messages on another, the pause
    menu's sound on the page's chip, and no page errors. The package's
    source is about 10,920 lines, and its tests about 4,900.
- **2026-10-28, 6e part 4 done**, unstaged:
  - **`createScope`.** `shared/scope.ts` holds `Scope`, `SCOPE_POINTS`,
    `SCOPE_STRIDE`, `toScopeLength`, the private `WeakMap` of scope
    sources, `registerScopeSource`, and `createScopeTargets`, which keeps
    the scopes attached to a chip and copies each scope into every one.
    `audio90/tracker` exports `createScope`, `Scope` and `SCOPE_POINTS`, in
    place of the `AUDIO90_SCOPE_*` constants. A `Scope` gives `points` and
    `pans` as two views of one array, so a view needs no offsets.
  - **Both chips.** The Audio80's synthesiser writes a scope as it renders,
    scaled so a voice at full volume spans about -1 to 1; the audio hashes
    are unchanged. The worklet runner handles `scopes`, `scope-buffer` and
    the `scope` reply for every chip, so the Audio90's runner lost its
    scope code, and the browser chip registers its source in
    `web-chip.ts`, so `web/audio90.ts` is as plain as the Audio80's and the
    `onReply` and `onReset` hooks went. The headless chips register
    `createHeadlessScopes`, which fills on each render, or stays silent.
    `Audio90` is a plain `SoundChip`.
  - **The Arcade.** `PageSound` has one slot factory, whose slots know the
    chip `loaded` behind them, and `findSessionChips(kind)`, which the entry
    host uses, so a session gets the loaded chips, and stand-ins only
    before they load and while sound is off. `MusicChip` is a `Pick` of
    the same members on both chips. The Tune Tracker attaches its scope as
    it starts and destroys it as it ends; `TrackerView` and
    `ChannelMetersView` take the `Scope`, and a channel the scope has no
    voice for, as with a stand-in, shows as silent.
  - **Tests.** The browser scope tests moved to the Audio80's file, with
    two scopes attached at once; new tests of `createScope` itself, of the
    Audio80's scope headless, and that a scope changes no rendered sample;
    `findSessionChips`.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (232 files, 2,998
    tests), `npm run test:visual` (50 files, no image changed), `npm run
    build` (54.0 KB) and `npm run build:packages`. In Playwright's headless
    shell, the Tune Tracker's music chip sent about 90 scopes a second with
    the tune playing (peak 1.46), and none once it was exited, with no page
    errors. The package's source is about 11,110 lines (up 190, for the
    Audio80's scopes and the registry), and its tests about 4,970. A
    changeset, `.changeset/attached-scopes.md`.
- **2026-10-28, 6e part 5 done**, unstaged:
  - **No headless log.** `record`, `log`, `clear`, `Audio80Write`,
    `Audio90Write`, the logging writers and the headless chips' hidden
    writer members are gone. A chip that doesn't render has a silent
    writer, `createSilentWriter` in `headless-chip.ts`, which checks and
    numbers plays as every chip does and empties itself as its clock moves
    on. The two headless files are each a short factory and the chip's
    rendering parts, `createAudio80Rendering` and `createAudio90Rendering`,
    which `render` builds on directly, with its own song player; the audio
    hashes are unchanged. `renderTicks` is internal, and `render` refuses a
    tick of 0 or less itself.
  - **Tests of views spy.** Each Arcade audio view test makes its chips with
    `createSpiedChip()`, spies on `play`, `queue` and `stop` before the view
    is made, and checks what the view asked of them, and the music chip's
    `song`, `tempoScale` and `beat`. The note-by-note comparisons and the
    "tells every song apart" tests went (Burrow Bust's by hand, the other
    eleven files by three agents, from Burrow Bust's as the model). Two
    tests now measure the tempo the view sets rather than the gaps between
    notes: Crumb Chase's speed-up and Galaxy Raiders' stage-clear jingle.
    The runner's fake browser chips keep `played` themselves. The package's
    headless tests use the public API, and the headless chip's own tests
    compare a song played on the chip with `render`, by hash.
  - **Docs:** the view skill's testing advice, and a style guide example
    that named the log. A changeset, `.changeset/no-headless-log.md`.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (232 files, 2,976
    tests), `npm run test:visual` (50 files, no image changed), `npm run
    build` (54.0 KB) and `npm run build:packages`. The package's source is
    about 10,870 lines, and its tests about 4,700.
- **2026-10-28, after 6e part 5**, unstaged, from the user's questions on
  what the audio view tests are worth, and whether the headless chips could
  be simpler:
  - **Audio view tests test the view.** An audit of the entries' ten audio
    test files found checks of the chip (`song` and `beat` after time
    passes, a queued song taking over, `song` after a `stop`), of `watch` (a
    count's first value or fall to 0, nothing played when nothing changes,
    for a view with no update step) and of the model. 14 tests went, and
    those checks in the rest (82 lines added, 364 removed). Fuel Run's
    fanfare-fits-the-pause check is its own test. Fenceline's tempo, picked
    from `music.song`, has no test, a gap to fill in part 7.
  - **A headless chip is silent.** `createHeadlessAudio80()` and
    `createHeadlessAudio90()` take no options, and have no `sampleRate`,
    `renderInto` or scope. The rendering chips, `createRenderingAudio80`
    and `createRenderingAudio90` in `src/headless/rendering-audio*.ts`, are
    internal: `render` builds on their parts, as before, and the package's
    tests and benchmarks use them. The Audio80's scope tests moved to its
    synthesiser's tests. A changeset, `.changeset/silent-headless-chip.md`,
    and two unreleased changesets brought into line.
  - **The benchmarks are in the package**, so `audio90` can move to a repo
    of its own without untangling the repo's benchmarks (the user):
    `bench/run.ts` bundles each suite with rolldown, as an app's build
    would, runs each case three times in its own process, prints the
    medians, and with `--save` writes `bench/results/<suite>.md`. The cases
    reach the rendering chips through `imports` mappings
    (`#rendering-audio80`, `#rendering-audio90`), which the published
    manifest leaves out. The Audio90's "effects alone" case had broken (an
    empty pattern is refused now); with no voices it plays no song.
  - **Measured** (saved): the Audio80 7.6 to 13 µs a block, 0 B; the
    Audio90 14.6 µs for the effects alone to 174 µs for 16 voices of the
    mix; a busy song 621 µs and 44 B a tick. The sample engine allocates
    13 B a block and the mix 10 B, where the old results (2026-10-16,
    esbuild) had 1 B. Not yet known whether that is a change since then or
    the bundler; worth a look with the sampling heap profiler in part 6.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (234 files, 2,960
    tests), `npm run test:visual` (50 files), `npm run build` (54.0 KB) and
    `npm run build:packages`. The package's docs still describe the old
    headless options and the log; step 11 rewrites them.
- **2026-10-29, 6e part 6, first chunk done**, unstaged: the synthesisers'
  shared parts. Part 6 goes in three chunks, each handed over on its own:
  this one, then the tracker parser and the small repeats, then the names
  and `glideMs`/`modEnvelope`.
  - **The allocation question first.** The sampling heap profiler, on the
    bundle as the benchmark builds it, puts the sample engine's 13 B a block
    on one boxed number: the block's start time, `fromMs`, passed to the
    synthesiser's `render`. Passing a constant brings it to 0. The other
    engines inline differently and show under 1 B. It is about 4.5 KB a
    second, one quick young-generation collection every few minutes, and the
    worklet passes its time the same way, so it was left.
  - **Shared now**, in `src/shared/`: `createCommandScheduler` (the queue,
    `enqueue`, the render loop in runs between commands, and
    `toSampleIndex`), `createEnvelopes` (start, step, release, sounding),
    `createSoundPlays` (each voice's sound and play, choosing a voice,
    stopping a play; `chooseSoundVoice` moved into it), and `synthesis.ts`
    (`CONTROL_SAMPLES`, the cutoff limits, `DC_POLE`, `MAX_ECHO_FEEDBACK`,
    `computeFall`, `tuneStateVariableFilter`, `polyBlep`, `clearTinyValues`,
    `clamp`). `OP_NOTE_ON`, `OP_NOTE_OFF` and `OP_SET_VOICE` are in the
    shared commands, and `OP90_NOTE_ON` and the rest went. Each
    synthesiser keeps its own per-sample filter, its `render` signature, and
    the next play's options.
  - **The `toSampleIndex` fix** moved 14 of the 19 Audio90 songs' hashes
    (the tunes and Neon Monsoon), and nothing else: with the fix taken out,
    every hash matched. Renders before and after are in the session's
    scratchpad for the user to hear; the samples differ through phase, as
    some notes start a sample earlier. An Audio80 envelope that decays to a
    sustain of 0 now ends, as the Audio90's did; no Audio80 hash moved. A
    changeset, `.changeset/notes-on-time.md`.
  - **Benchmarks**, interleaved before and after from bundles of each: every
    time within ±1.5% on a quiet machine, the Audio90 a little faster;
    allocation unchanged. A first try passed the envelope's scaled times to
    the shared envelopes, which boxed two numbers per FM operator per note
    (43 to 53 B a song tick); the envelopes now take the times and the scale.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (235 files, 2,965
    tests), `npm run build` (54.0 KB) and `npm run build:packages`; the
    benchmarks saved.
- **2026-10-29, 6e part 6, second chunk done**, unstaged, after the user
  committed the first (and heard the moved songs, which sound as before):
  - **One tracker parser.** Each chip lists its cell tokens in a
    `CellGrammar` (a prefix and digits, a flag such as `>`, or the slide,
    each with its field and the name its errors use), and `parseSongCore` in
    `shared/tracker.ts` makes what every song has: tempo, instruments,
    patterns, order, loop and volume, with every check and message as
    before. The Audio90 adds its engine checks through `checkCell`.
    `formatCell` in `shared/format-cell.ts` writes a cell back out from the
    same grammar, and `formatAudio90Cell` calls it. It is a module of its
    own because Vite puts a module shared by several pages into one chunk
    with everything any of them uses; in `tracker.ts` it rode along on the
    home page.
  - **One cell layout.** The fields both chips' cells start with are
    `CELL_NOTE` to `CELL_PULSE`, `NO_NOTE`, `RELEASE` and `DEFAULT_VIBRATO`
    in the shared tracker; `CELL90_NOTE` and the rest of those copies went,
    and `Audio90SongPattern` is the shared `SongPattern`.
  - **The small repeats.** `parseNote` and `parseNoteToken` (the
    highest-note check) are shared; the Audio80's `tokens.ts` folded into
    its sound; `ENGINE_NAMES` went (a sound keeps its engine's name); the
    Audio80's echo defaults are `AUDIO80_ECHO_DEFAULTS`, read by its
    synthesiser and its song driver; the Audio90's synthesiser reads
    `AUDIO90_EFFECT_DEFAULTS` and `AUDIO90_CHARACTERS` in place of 15
    copies; the song's echo limit is `MAX_ECHO_FEEDBACK`. An Audio80 sound
    lost `note` and `filter` (its `data` has both), and an Audio80 song
    gained `instrumentLetters`. A changeset, `.changeset/one-tracker.md`.
  - **Size:** 519 lines added and 747 removed, plus the formatter's 79.
    The home page's first load is 54.4 KB, from 54.0: the general parser is
    a little bigger than the Audio80's own was.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (235 files, 2,965
    tests, every audio hash unchanged), `npm run build` and
    `npm run build:packages`. Nothing on a hot path changed, so the
    benchmarks were not run.
  - **Then `audio90/tracker`'s code moved into its folder** (the user):
    `tracker/format-cell.ts` holds `formatAudio90Cell` and its width, and
    `tracker/scope.ts` holds `createScope` and `Scope`, with their tests.
    `shared/scope.ts` keeps the chip's side (the layout, the targets, and
    the registry, which gained `findScopeSource`). The folder is now the
    entry point, as `headless/` is, so nothing a game imports from the
    root can bring editor code with it. No public change.
- **2026-10-29, `audio90/tracker` folded into the root** (the user): with
  its code in modules of its own, the entry point saved no bytes, and held
  seven names. The root now exports `createScope`, `Scope`, `SCOPE_POINTS`,
  `formatAudio90Cell`, `AUDIO90_CELL_TEXT_WIDTH`, `AUDIO90_SAMPLE_MEMORY`,
  `AUDIO90_VOICE_COUNT` and `Audio90SongPattern`; `src/tracker/` stays as
  their folder. The `exports` entry and the build entry went, the Tune
  Tracker imports from `audio90`, and the two unreleased changesets that
  named `audio90/tracker` no longer do. This overturns point 6 of section
  5.9. The home page is unchanged, at 54.4 KB.
- **2026-10-29, 6e part 6, third chunk done, and so part 6**, unstaged:
  - **One way to say each thing.** An Audio90 sound's `legato: { glideMs }`
    is `glideMs` with `isLegato: true`, and `filter.envelope: { octaves }`
    is a `modEnvelope` aimed at the cutoff. The 13 shorthand envelopes and
    3 legato sounds (Neon Monsoon's sounds, the tunes' instruments, the
    benchmark) were rewritten by script, every hash unchanged. The guide's
    rows and its acid line follow. A changeset,
    `.changeset/one-way-to-say-it.md`.
  - **The Audio80's names gain the chip's prefix**, as the Audio90's have:
    `AUDIO80_VOICE_COUNT`, the `AUDIO80_*_SETTING_INDEX` tables, `OP80_*`,
    `WAVE80_*`, `FILTER80_*`, `AUDIO80_WAVETABLE_SIZE`, `CELL80_*`,
    `Audio80SoundData` and `Audio80StepData`. All internal.
  - **Barrel exports used only by tests:** `HELD_ENVELOPE` and
    `computeSongDurationMs` left their barrels (the tests write their own
    envelope and read `song.durationMs`). The other names only tests import
    from another folder, such as `HIGHEST_NOTE` and `DEFAULT_VIBRATO`, are
    the constants the tests derive from, so they stay.
  - **The row writers** were already in matching places, each chip's
    `notation/song-driver.ts`, since parts 1 and 3.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (236 files, 2,965
    tests), `npm run build` (54.4 KB) and `npm run build:packages`.
- **2026-10-29, 6e part 7 done, and so 6e**, unstaged. The review's list,
  checked against the code as it now is:
  - **Duplicates gone:** the Audio80 synthesiser's tests of choosing a
    voice that `sound-plays.test.ts` covers (a song's note, a sound at its
    maximum, a higher priority), its NaN and `+Infinity` stamps
    (`command-queue.test.ts`), its play-option checks
    (`command-writer.test.ts`), and both synthesisers' stamp tests
    (`command-scheduler.test.ts`); the worklet runner's two reset fades are
    one, on both channels. Already gone in earlier parts: the volume clamp
    five times (now once a chip kind), "refuses to render", and the copied
    browser tests (each file now tests its own chip).
  - **Shared helpers:** `installFakeAudioContext` lives in the stand-in
    context's module, which is now `fake-audio-context.test-support.ts`. A
    `*.test-support.ts` file is the repo's new name for test support: lint
    treats it as a dev file, and the package's `files` leave it out.
  - **Gaps:** the worklet's tempo and queue calls, the browser chip's volume
    and mute, and an Audio80 song through a browser chip were filled in
    parts 2 and 5. New: the worklet runner plays a song to the same samples
    as `render` (swing, a glide, a slide, a release, a drum, a transposed
    pattern), which fails if the worklet stamps notes a sample late; and
    Fenceline's tempo, which follows the share fenced up to the target.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (236 files, 2,958
    tests), `npm run build:packages`, and `npm pack --dry-run` lists no test
    or test support file.
- **2026-10-29, step 7 done**, unstaged: a song's text, printed and
  parsed (the user chose `print` over `format`, and "text" over "file",
  since neither function touches a file).
  - **What the text holds.** `printAudio90Song(song)` prints JSON: a
    `format` ("audio90 song") and a `version` (1), then the options the song
    was made from. Each instrument is its sound's options, and a sample its
    recipe, with the song it bounces nested in it. Each pattern and step
    table is a list of rows, a row on each line, comment rows kept, and
    anything else short enough, such as an envelope, on one line, within
    100 characters. The tunes' texts run from 236 to 690 lines.
  - **How.** The song, sound and sample factories keep the options each was
    made from, in the registries `isAudio90Song` and `isAudio90Sound`
    already used, so the text holds only what was set, never the defaults.
    A song, sound or sample made by hand, not by a `create` function,
    cannot be printed, and the error says which.
  - **Reading.** `parseAudio90Song(text)` builds the song with the `create`
    functions, so a text gets every check and error a song in code does. A
    pattern may also be one string. Sounds and samples written the same way
    in one text become one object, so a shared sample is bounced, and takes
    sample memory, once.
  - **Tests:** a round trip over every tune in the Arcade (`toEqual`, which
    compares each sample's bounced audio too), and the package's own: a song
    with every engine, a sample, a step table and the mix, the rows written,
    a shared sample made once, and the errors.
  - **Left for later:** a song's title and author (section 5.7 asks the
    format for them), a sound's text on its own (section 5.5 says "the
    same goes for sounds"), and the Audio80, which has none yet.
  - **Checked:** lint, `npx tsc -b`, `npm run test:unit` (237 files, 2,965
    tests), `npm run build` (54.4 KB) and `npm run build:packages`. A
    changeset, `.changeset/song-text.md`.
  - **`printAudio90Cell`**, renamed from `formatAudio90Cell` (and
    `tracker/format-cell.ts` to `print-audio90-cell.ts`) to match, and
    `formatHexToken` to `printHexToken`. `formatCell`, written for either
    chip, is inlined into it, since only the Audio90's cells are printed,
    and `AUDIO80_CELL_GRAMMAR` is private to its song's file.
- **2026-10-29, exports and file names**, unstaged.
  - **Exports.** `FILTER80_MODES` is gone (nothing used it), and the
    stages `ENV_ATTACK`, `ENV_DECAY` and `ENV_SUSTAIN` are private to
    `envelopes.ts`. Folder `index.ts` files no longer export what only
    their own folder uses: the `CELL80_*` and `CELL90_*` fields, the
    `WAVE80_*` and `FILTER80_*` flags, `bounceAudio90Song`,
    `Audio90SongEcho`, `AUDIO90_OSCILLATOR_BUDGET`, `HELD_LENGTH`,
    `NO_GLIDE`, `HIGHEST_NOTE_NAME` and `PlayMessage`.
  - **Placement.** `hashSamples`, `findSounds` and `measurePeak` left
    `render.ts` for files of their own, with their tests, and the WAV test
    moved to `encode-wav.test.ts`. `checkRange` has its own file.
    `createAudio80Rendering` became `createAudio80Renderer`, in
    `audio80-renderer.ts`, so it is not mistaken for
    `createRenderingAudio80`; the same for the Audio90.
  - **File names.** The user made the rule exact, and it is now in the
    style guide: a file is named for its main export's whole name, and its
    folders never shorten it. So the notation files became
    `audio80-song.ts`, `audio80-sound.ts`, `audio80-song-driver.ts`,
    `audio90-song.ts`, `audio90-sound.ts`, `audio90-sample.ts`,
    `audio90-song-driver.ts` and `bounce-audio90-song.ts`.
  - **Splits, as the user decided.** `song-text.ts` became
    `print-audio90-song.ts` and `parse-audio90-song.ts`, with the text's
    shape in `song-json.ts` and `mapValues` in its own file. The shared
    `tracker.ts` became `song-core.ts` (the types), `parse-song-core.ts`,
    `cell-grammar.ts` (the cell fields and tokens),
    `compute-song-duration-ms.ts`, and a file for each token and row
    helper; `isNoteInRange` joined `notes.ts`, and `checkInstrumentLetters`
    is private to `parse-song-core.ts`. `tokens.ts` became
    `audio90-tokens.ts`, with `lookUpName` and `toPan` in their own files.
    The chips' `sound-data.ts` and `commands.ts` gained their chip's name,
    and `shared/scope.ts` became `scope-source.ts`. The two
    `notation.test.ts` files became a test for each of the song, sound and
    sample files, and `tracker.test.ts` a test for each helper.
  - **Checked:** lint, `npx tsc -b`, the package's and the tunes' tests
    (46 files, 357 tests) and `npm run build`. The home page is 54.6 KB of
    its 60 KB budget, from 54.4 KB.
- **2026-10-29, folders**, unstaged. The longest folders gained
  subfolders, each with its own `index.ts`: `shared/` (46 files) gained
  `commands/`, `notation/` (with `tokens/`) and `synthesiser/`;
  `headless/` (27) gained `rendering/` and `rendered-samples/`; and
  `audio90/notation/` (22) gained `song-text/` and `values/`. The
  `#rendering-audio80` and `#rendering-audio90` imports, and the README's
  layout, follow. `web/worklet/` (12 files, 9 of them code) stays flat: its
  only split is by chip, which would make two folders of two files.
- **2026-10-29, step 8 started.** The user chose both recommendations: a
  `pitch` that takes a note out of range throws from `play`, and fades are
  even in decibels, with a fade-in too.
  - **Chunk 1, `repeat` and `pitch`**, unstaged. `play(song, options)` and
    `queue(song, options)` take `SongPlayOptions`: `repeat`, how many more
    times the loop plays (`Infinity` by default, 0 to end at the end of the
    order), and `pitch`, whole semitones added to every note but an
    instrument's own, as the order's transposition is. `checkSongPlay`, in
    `shared/check-song-play.ts`, checks them on the page and finds each
    song's note range once (a `WeakMap`), so a bad play throws before
    anything changes. The checked play goes to the sequencer: the song
    player counts its returns to the loop and gives the driver the pitch as
    the song starts; a browser chip sends both in the `song-call` message.
    `PlayableSong` gained the song's notes, which the check reads. Tests:
    the check, the player's repeats and pitch (a queued song's too), the
    playback checking before it plays, the message, and the worklet ending
    a song after its repeats. Changeset `.changeset/song-play-options.md`.
  - **Chunk 2, `stereoWidth`**, unstaged. The Audio90 has `stereoWidth`,
    0 (mono) to 1 (as written), clamped like `volume`. The synthesiser
    applies it last, after the limiter, as mid and side: each side becomes
    a blend of the two, so 0 is mono exactly and nothing passes the limit,
    and at 1 the output is untouched, so every audio hash stays exact. It
    glides to a new width over about 30 ms, as the volume does, and
    `reset` leaves it, since it is the listener's setting. A browser chip
    sends it to the worklet as a `stereo-width` message (sent once the
    worklet runs, like the rest); the headless Audio90 keeps it, and the
    rendering one sets it on its synthesiser. The Arcade's Audio90
    stand-ins keep it for the chip to come, as they keep the volume.
    Found on the way: a headless chip's `releaseAll` was stamped with the
    chip's time, so the queue (sorted by stamp) applied it after plays
    stamped "as soon as possible", releasing a sound played just after
    `stop()`. It is stamped "as soon as possible" now, so calls apply in
    the order made, as in a browser. No audio hash moved. Changesets
    `stereo-width.md` and `headless-stop-order.md`.
  - **Chunk 3, `onRow` and `onEnded`**, unstaged. `SongCallbacks<Song>`,
    in `shared/song-callbacks.ts`, is given as a chip is made: to
    `createAudio80` and `createAudio90`, whose options extend it, and to
    `createHeadlessAudio80` and `createHeadlessAudio90`, which now take
    options of their own. `onEnded` is only for a song ending by itself; a
    `stop`, or a queued song following, calls nothing. In a browser, the
    page's songs work both out from the places the worklet already sends,
    in the current generation: a new song, entry or row calls `onRow`, and
    no song after one calls `onEnded`. A stop changes the generation, so it
    calls nothing. They are called as the place arrives, a moment before it
    is heard, as section 5.7 said. The song player calls them as it writes,
    so the headless chip holds them, in reused arrays, and calls them after
    each `update`, never inside `play` or `stop`. `createSongPlayer` takes
    one options object now (`driver`, `onRow`, `onEnded`), and the headless
    chip makes its player from a `driver`. Changeset `song-callbacks.md`.
  - **Chunk 4, music fades**, unstaged. `stop(id?, { fadeMs })`
    (`StopOptions`, checked by `checkStopFadeMs`) and a `fadeMs` song play
    option. The fade is the synthesiser's, on its whole output, so it runs
    on the sound card's clock: `shared/synthesiser/fade.ts` keeps the gain
    in a typed array and moves it by the same factor each sample, so it is
    even in decibels, down to `FADE_FLOOR_DB` (-60). A fade-out ends in
    silence: the synthesiser cuts every voice and empties its effect lines,
    keeping every setting, and goes back to full volume, so no tail comes
    back. A new shared opcode, `OP_FADE` (15), carries it; a fade-out over
    0 ms is that cut at once. The song player writes the fades through its
    driver (`SongDriver.fade`): it plays the song on through a fade-out and
    writes no row at or after its end, then releases the song and writes
    the cut at the end's exact stamp, so the player and the synthesiser
    agree whichever gets there first. A song started while a fade-out may
    have left the chip quiet cuts first; a song queued during a fade-out
    starts as it ends. `stop` with no id and a fade leaves the voices to
    the fade's cut, unless no song is playing. A song that fades out
    doesn't call `onEnded`. In a browser, a stop with a fade keeps the
    generation, so the song's places still count while it is heard. The
    fade multiplies by exactly 1 at full volume, so every audio hash stayed
    exact. No Arcade entry stepped its music's volume by hand, so none
    changed. Changeset `music-fades.md`.
  - **Benchmarks after step 8**, interleaved with HEAD (a copy of the
    committed package in the scratchpad): rendering level within the noise
    (the busy mix on 16 voices 175 and 198 µs against 172 and 179), and
    the song tick 641 µs on average against 667 (+4%, within its ±6 to
    13%), its allocation down from 44 to 33 B a tick.
  - **Checked:** lint, `npx tsc -b`, the package's tests (45 files, 357)
    and the Arcade's (149 files, 1,516), and `npm run build:arcade`: the
    home page is 54.8 KB of its 60 KB budget, from 54.6 KB.
