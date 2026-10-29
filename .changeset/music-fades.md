---
"audio90": minor
---

Music fades. `stop(id, { fadeMs })` fades a song out before it stops, and a song's `play` and `queue` take `fadeMs` to fade it in from silence. The fade is even in decibels, so it sounds even to the ear, down to 60 dB below full volume. The chip fades as a whole, sounds included, which is why a game plays its sound effects on a chip of their own. While a song fades out it is still the song heard, so `song` and `row` report it; as the fade ends, the chip cuts every voice and empties its echo and reverb, so nothing comes back, and plays at full volume again. A song stopped with a fade doesn't call `onEnded`.
