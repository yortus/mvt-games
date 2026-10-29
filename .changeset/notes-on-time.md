---
"audio90": patch
---

An Audio90 note whose start falls exactly on a sample now starts on that sample. Rounding used to start some of them one sample late, as the Audio80's never did. Songs sound the same, but a song's rendered samples, and so its hash, can change. An Audio80 sound that decays to a sustain of 0 now ends there, as an Audio90's does, so its steps no longer move a filter another voice plays through.
