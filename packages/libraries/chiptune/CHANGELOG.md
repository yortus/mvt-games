# @mvtjs/chiptune

## 0.4.0

### Minor Changes

- b73a833: `@mvtjs/chiptune` is published. It holds two virtual sound chips for games: the Audio80, eight mono voices in the spirit of the 1980s home computers, and the Audio90, sixteen stereo voices of FM, analog oscillators and samples, in the spirit of the 1990s. Each comes with a tracker notation for writing its music and sound effects, and a music player that audio views use. `@mvtjs/chiptune/web` plays them in a browser, through an `AudioWorklet` whose code is inlined, so no file needs copying beside your app. `@mvtjs/chiptune/headless` runs them without a speaker, for tests and tools.

### Patch Changes

- Both chips render the same samples on every system. They used `Math.pow`, which Node and Chrome compute with the system's own C library, so a sound could differ in its last digit between Linux and Windows. A test that hashes a sound could then pass on one system and fail on another. Some Audio90 sounds render slightly differently from 0.3.0, by far less than you could hear.
