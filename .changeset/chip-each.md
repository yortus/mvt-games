---
"audio90": minor
---

Music and sound effects play best on a chip each, and the chips no longer keep voices for music or mix it apart from the sounds. `reserveVoices`, the voices kept for music, `musicVolume` and `effectsVolume` are gone: a chip has one `volume`, so a page sets its music chip's `volume` and its sound effects chip's. A sound takes a free voice, from the top down, or else the oldest song note or sound of no higher priority, so a sound played on the music's chip may take a song's voice until that channel's next note takes it back. A song no longer writes how many voices it keeps, so a headless chip logs no `reserve-voices`. The Audio80 has 4 voices, not 8, and a song with more than 4 channels is an error. A browser's chip now holds its sound while the page is hidden, and plays on as it shows, unless it was paused itself, which leaves `isPaused` alone. Pass `pauseWhenHidden: false` to `createAudio80` or `createAudio90` for a chip that should play on in the background.
