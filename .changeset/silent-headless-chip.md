---
"audio90": minor
---

A headless chip makes no sound. `createHeadlessAudio80()` and `createHeadlessAudio90()` take no options, and the `render` option, `sampleRate`, `renderInto`, `HeadlessAudio80Options`, `HeadlessAudio80RenderOptions`, `HeadlessAudio90Options` and `HeadlessAudio90RenderOptions` are gone. A headless chip is for running a game, or testing a view, without a speaker. To hear what a song or a sound sounds like, render it with `render`, which returns its samples.
