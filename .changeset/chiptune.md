---
'@mvtjs/chiptune': minor
---

`@mvtjs/chiptune` is new on npm. It holds two virtual sound chips for games: the Audio80, eight mono voices in the spirit of the 1980s home computers, and the Audio90, sixteen stereo voices of FM, analog oscillators and samples, in the spirit of the 1990s. Each comes with a tracker notation for writing its music and sound effects, and a music player that audio views use. `@mvtjs/chiptune/web` plays them in a browser, through an `AudioWorklet` whose code is inlined, so no file needs copying beside your app. `@mvtjs/chiptune/headless` runs them without a speaker, for tests and tools.
