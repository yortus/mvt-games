# audio90

## 0.8.0

### Minor Changes

- `@mvtjs/chiptune` is now `audio90`, a package of its own, and its API has been simplified throughout. Install `audio90` in its place. `@mvtjs/chiptune/web` is merged into `audio90`, and `@mvtjs/chiptune/headless` is now `audio90/headless`. What changed since `@mvtjs/chiptune` 0.7.0:

  - **A chip is one object.** `createWebAudio80` and `createWebAudio90` are now `createAudio80` and `createAudio90`, with the options types `Audio80Options` and `Audio90Options`, and each returns the chip itself, not `{ audio80, controls }`. What the controls did, `ready`, `pause`, `resume`, `isPaused`, `volume`, `isMuted` and `destroy`, is on the chip, and both chips share the `SoundChip` interface. `AudioControls`, `HeadlessControls`, `Audio80WithControls` and `Audio90WithControls` are gone.
  - **One clock.** A browser chip keeps the sound card's time, so nothing needs to tick it. Pause it with `pause` as your game pauses. It also holds its sound while the page is hidden, unless it is made with `pauseWhenHidden: false`. A play starts as soon as it reaches the chip. `update`, `flush`, `stallCount`, `leadMs`, `time`, `heardTime` and `atMs` are gone. `context` is optional: without one, a chip makes its own audio context and starts it at the page's first click, tap or key press.
  - **Sounds.** Instruments and sound effects are now one thing, a sound, made with `createAudio80Sound` or `createAudio90Sound`, in place of `createAudio80Instrument`, `createAudio80SoundEffect`, `createAudio90Instrument` and `createAudio90SoundEffect`. A song's `instruments` are sounds. `play(sound, options?)` takes the play's `note`, `glideTo`, `lengthMs`, `volume` and, on the Audio90, `pan`, and returns the play's id. A `lengthMs` of `Infinity` holds the note until `stop(id)`. `noteOn` and `noteOff` are gone, and so are the setters (`setVoice`, `setFilter`, `setEcho`, `setEffect`, `setCharacter` and `setTempo`): a song sets all of these as it plays.
  - **A chip for music and a chip for sound effects.** The chips no longer keep voices for music. A sound takes a free voice, or else the oldest song note or sound of no higher priority, so a game plays its music and its sound effects on a chip each. `reserveVoices`, `musicVolume` and `effectsVolume` are gone. The Audio80 has 4 voices, not 8.
  - **Songs play on the chip.** `createMusicPlayer` and `MusicPlayer` are gone. `play(song, options?)` starts a song on the chip's own sequencer, which runs on the sound card's clock, so a late frame never holds the music up. `queue(song, options?)` plays one after it without a gap, and `stop(id?, { fadeMs }?)` stops it, fading it out if asked. `stop()` with no id stops everything, in place of `releaseAll`. The chip reports the song heard, with its `orderIndex`, `row`, `beat` and `positionMs`, and has a `tempoScale`. A song has a `durationMs`, in place of `computeSongDurationMs`.
  - **Song play options.** `repeat` (how many more times the loop plays), `pitch` (semitones up or down, which may be a fraction), `fadeMs` (a fade in), and a start part way, either `startMs` or `startAt: { orderIndex, row }`, typed `SongPlace`. A song started part way is heard as it would be on reaching that place.
  - **Callbacks.** A chip takes `onRow(song, orderIndex, row)` and `onEnded(song)` as it is made, for a page that doesn't poll `row` and `song` each frame.
  - **Stereo width.** An Audio90 has a `stereoWidth`, from 0 (mono) to 1.
  - **Scopes.** `createScope(chip)` attaches a scope to either chip, in place of the Audio90's `scope` and `setScopes`.
  - **Song text.** `printAudio90Song` prints an Audio90 song as text, and `parseAudio90Song` reads it back. `formatAudio90Cell` is now `printAudio90Cell`.
  - **One way to say each thing.** Both chips read their songs with one parser, so rows, cells and errors work the same on each. An Audio90 sound's `legato: { glideMs }` is now `glideMs`, with `isLegato`, and `filter.envelope` is now a `modEnvelope` aimed at the cutoff.
  - **Headless chips** make no sound and log nothing. `createHeadlessAudio80` and `createHeadlessAudio90` take only `onRow` and `onEnded`, and a headless chip's clock moves on with `update(deltaMs)`, so a test of the code that plays sound is exact. Spy on its `play`, `queue` and `stop` to see what was played. To hear a song or a sound, render it with `render`, which replaces `renderSong` and `renderSoundEffect`. `findSounds` returns `songs` and `sounds`.
  - **Fixes.** An Audio90 note that starts exactly on a sample now starts on that sample, not one later, which can change a song's rendered samples. An Audio80 sound that decays to a sustain of 0 now ends there. An Audio80 sound's `pulseWidth` and `pulseSweep.to` must be 0 to 1: a width outside that range played a full-scale click, and now throws.

## 0.7.0

### Minor Changes

- 56ae64a: In a browser, the chips now play 100 ms behind the game, rather than 35 ms, so music plays on through late frames on slow devices such as phones. A frame later than even that holds the music still, with its notes ringing on, rather than dropping out, and `AudioControls.stallCount` counts each one. Pausing now fades out at once, and resuming fades back in at once. The new `Audio90.heardTime` says which chip time is reaching the speaker now, for a view that shows the music as it is heard.

## 0.6.1

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.0

### Minor Changes

- 112a6fb: `findSounds` finds the sounds inside a module's exported arrays too, each named for its place, such as `FANFARES[2]`.

## 0.4.0

### Minor Changes

- b73a833: `@mvtjs/chiptune` is published. It holds two virtual sound chips for games: the Audio80, eight mono voices in the spirit of the 1980s home computers, and the Audio90, sixteen stereo voices of FM, analog oscillators and samples, in the spirit of the 1990s. Each comes with a tracker notation for writing its music and sound effects, and a music player that audio views use. `@mvtjs/chiptune/web` plays them in a browser, through an `AudioWorklet` whose code is inlined, so no file needs copying beside your app. `@mvtjs/chiptune/headless` runs them without a speaker, for tests and tools.

### Patch Changes

- Both chips render the same samples on every system. They used `Math.pow`, which Node and Chrome compute with the system's own C library, so a sound could differ in its last digit between Linux and Windows. A test that hashes a sound could then pass on one system and fail on another. Some Audio90 sounds render slightly differently from 0.3.0, by far less than you could hear.
