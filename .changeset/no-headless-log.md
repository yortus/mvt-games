---
"audio90": minor
---

A headless chip no longer logs what it plays. The `record` option, `log`, `clear`, `Audio80Write` and `Audio90Write` are gone. A test of what a view plays spies on the chip's `play`, `queue` and `stop`, as with Vitest's `vi.spyOn`, and reads its `song` and `tempoScale`: a view chooses the song and its tempo, and how the chip plays a song is the chip's own concern. A headless chip now checks a play's options as every chip does, and `render` says `render: tickMs must be above 0` for a tick that would never end.
