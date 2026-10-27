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
| Sounds | One kind, a sound (`createAudio90Sound`), in place of instruments and sound effects. A song's `instruments` hold sounds. `play(sound, options?)` replaces `noteOn`, and returns an id that `release(id)` takes. Decided by the user, 2026-10-27 | 5.8 |
| Music and sound effects | A chip each. The voices kept for music and the two volume groups in each chip go, and each chip has one `volume`. The Audio80 has 4 voices, and the Audio90 keeps 16. Arcade entries get a `music` chip and an `sfx` chip. Decided by the user, 2026-10-27 | 5.8 |
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
player.playSound(coin);         // over the music, on a chip of its own
```

It is a thin layer over a chip, its controls and a music player. It follows this repo's style rather than chiptune3's: a
factory, not a class, and properties for settings rather than setters.

| chiptune3 | `createPlayer` | What it takes |
| --- | --- | --- |
| `play(buffer)`, `load(url)` | `play(song)`, `load(url)` | `play` exists. `load` needs the song file format (5.5) |
| `stop` | `stop()` | Exists |
| `pause`, `unpause`, `togglePause` | `pause()`, `resume()`, `isPaused` | The music chip's own `pause` and `resume` (5.3). Sounds play on their own chip (5.8), so a paused player still plays a menu's clicks |
| `setRepeatCount` | `repeat`: how many more times the loop plays, `Infinity` by default | New, and small: the sequencer counts its returns to the song's `loop` |
| `seek`, `setOrderRow` | `seek(ms)`, `seekTo(orderIndex, row)` | New, and the most work (below) |
| `setVol` | `volume`, `musicVolume`, `sfxVolume` | Each chip's `volume` (5.8). `volume` scales both |
| `setTempo` | `tempo` | Exists, as the music player's `tempoScale` |
| `setPitch` | `pitch`, in semitones | New. Whole semitones are small, since the order already transposes patterns (`'verse+5'`). A fraction of a semitone needs each engine, samples too, to scale its frequency |
| `setStereoSeparation` | `stereoWidth` | New, and small, on the Audio90's mix. The Audio80 is mono |
| `onProgress`, `currentTime` | `time`, `orderIndex`, `row`, `beat`, and an `onRow` option | The values exist. The callback is new |
| `onEnded` | `isPlaying`, and an `onEnded` option | The value exists. The callback is new |
| `onMetadata`, `duration` | `song`, `duration` | `computeSongDurationMs` exists. A song has no title or author yet, which the file format should add |
| `onError` | `ready`, which rejects | Exists, on the controls |

What the player keeps that chiptune3 lacks: sound effects over the music,
on a second chip it makes when the first sound plays, and both kinds of
chip. If each song says which chip it is for, `play` can make the
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
chips and a music player directly, pauses the chips when it pauses, and
tests its audio views on headless chips, which step with its models.

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
chip. Decide in step 6.

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
4. Sounds, and a chip each for music and sound effects (section 5.8).
5. The song file format (section 5.5).
6. The player (section 5.7): first what exists and the small additions,
   then seeking and fractional pitch.
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
6. **The player's name.** `createPlayer`, or `createAudio90Player`, which
   says what it plays but not that it plays Audio80 songs too?
7. **The Studio's address.** Beside the others under the site, as
   `/studio/`, or its own domain once it is good enough to stand alone?
8. **The `src/web/` folder.** Since step 2 it names no entry point. It
   holds the chips as they play through Web Audio, beside `headless/`,
   where they play without a speaker, and that still holds. But it mixes
   two threads: the page's side (`audio80.ts`, `audio90.ts`, `web-chip.ts`,
   `web-song-slots.ts`, `held-writes.ts` and the two held-slots files) and
   the audio thread's (the processors and runners, `chip-runner.ts`,
   `chip-clock.ts`, `song-sequencer.ts` and `register-chip-processor.ts`),
   with `song-messages.ts` between them. Should the audio thread's side move
   to a `web/worklet/` folder of its own, so the line is visible and lint
   can keep worklet code from importing the page's? Each chip loads its
   worklet with `'./audio80-processor?worker&url'`, which would then reach
   past the new barrel, so the lint rule would need an exception. Renaming
   the folder `browser/` was considered and set aside: "web" names the API,
   Web Audio, not the platform, and the rename would carry into
   `web-chip.ts`, `createWebChip` and `WebSongSlots`. Decide before the
   docs, step 11, describe the package's layout.
   While there, `song-sequencer.ts` exports `createWorkletSequencer`, so
   its file is misnamed (`worklet-sequencer.ts`).
9. **A clock shared by the music and the sounds.** With a chip each
   (section 5.8), a sound can't be stamped on the music's clock, for
   example to land exactly on a beat. `beat` is what the listener hears
   now, so a sound played as it ticks over is heard one output delay late:
   tens of milliseconds, more on some phones. Nothing in the Arcade needs
   it today, and both chips run on one `AudioContext`, so a shared clock
   could come later: chip time as the context's time, less the time spent
   paused, would agree on two chips paused together.
10. **`setVoice`.** It sets one voice's setting, and takes a voice number.
    With no `noteOn`, nothing outside the worklet chooses voices (section
    5.8). Should it take a play id, as `release` does, or go? Check its
    callers in step 6.

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
6. Sounds, and a chip each for music and sound effects (section 5.8).
   Decide open question 10 first.
   - **The package:** one kind, a sound, in place of instruments and sound
     effects; `play` with options, returning an id; `release`; no
     `noteOn` or `noteOff`. Remove `reserveVoices`, the voices kept for
     music and the two volume groups, so each chip has one `volume`. Take
     the Audio80 to 4 voices, and make a song with more channels an error.
     The render script, the changesets and the tests follow.
   - **The Arcade:** `music` and `sfx` chips for each entry with sound, in
     the entry host, `PageSound` and its stand-in chips; the settings'
     `musicVolume` and `sfxVolume`; the music slider's preview; every
     entry's sounds, songs, audio views and tests; the tunes and the Tune
     Tracker. Listen to Burrow Bust, Crumb Chase, Fruit Machine and Fuel
     Run at their busiest, with 4 voices for effects.
   - **Elsewhere:** the playground's examples, starters and exported
     projects, the benchmarks, and AGENTS.md's sound rule.
   - **Checks:** lint, unit and visual tests, the build and its budget,
     `build:packages`, and a page test in Playwright's headless shell, as
     in step 5.
7. Add `formatAudio90Song` and `parseAudio90Song`, with a round-trip test
   over every tune in the Arcade.
8. Add `createPlayer` with what exists, plus `pause`, `resume`, `repeat`,
   whole-semitone `pitch`, `stereoWidth`, `onEnded` and `onRow`. It becomes
   the README's first example in step 11.
9. Add `seek` and `seekTo`, with a test that a song played from a row
   sounds the same as one seeked to it. Then fractional pitch.
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
