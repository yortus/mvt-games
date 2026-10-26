---
"audio90": minor
---

Music now plays on each chip's own sequencer. In a browser, the sequencer runs on the audio thread, on the sound card's clock, so a late frame never holds the music up, even by most of a second. It still pauses with the game, and a headless chip runs it on its own clock, so the same ticks make the same notes. `MusicPlayer.update` is gone: a view tells its player what to play, sets `tempoScale` after any new song, and calls `refresh`, which sends both to the chip. The player's `row`, `orderIndex` and `beat` are now what the listener hears. A song started while the sound card could not play skips ahead to where it would have got to. Each chip gains `openSongSlot`, which a music player opens, and the new `SongSlot` type describes it.
