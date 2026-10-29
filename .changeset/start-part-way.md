---
"audio90": minor
---

A song can start part way. Its `play` and `queue` take `startMs`, in ms of song time at its own tempo, as `durationMs` measures it, for a seek bar or music timed to a cutscene, or `startAt: { orderIndex, row }`, a place in its order, for skipping to a section or resuming where the chip's `orderIndex` and `row` said it was. It is heard from there as it would be on reaching it: each channel's instrument, pan and sends are as the rows before left them, but notes started before the start don't sound. A chip also reports `positionMs`, where the song heard is in its order, in the same ms, going back as it loops, so `play(song, { startMs: chip.positionMs })` resumes it. A `pitch` may now be a fraction of a semitone.
