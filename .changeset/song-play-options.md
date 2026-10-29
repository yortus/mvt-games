---
"audio90": minor
---

A song's `play` and `queue` take options: `repeat`, how many more times the song's loop plays before it ends (`Infinity` by default), and `pitch`, semitones to play every note up or down, as an order entry's transposition does, which may be a fraction, such as 0.5 for a quarter tone. An instrument's own note, as a drum plays, is not moved. Both are checked as the song is played, and a `pitch` that takes a note out of the chip's range throws.
