---
"audio90": minor
---

The chips are smaller: a page plays songs and sounds, and stops them, and no longer writes to a chip's voices or effects itself. The setters (`setVoice`, `setFilter`, `setEcho`, `setEffect`, `setCharacter` and `setTempo`), `time`, `heardTime` and `voiceCount` are gone. A song still sets all of these as it plays, and `tempoScale` still changes its speed. A headless chip's `log` now holds only plays, stops and a song's notes, not the settings a song makes. A song has a `durationMs`, the length of one pass at its own tempo, in place of `computeSongDurationMs`.
