---
"audio90": minor
---

An Audio90 song can be printed as text, to save or send, and parsed back. `printAudio90Song(song)` prints it as JSON: the options it was made from, each instrument as its sound's options, each sample as its recipe (the song it bounces, never its audio), and each pattern and step table as a list of its rows. `parseAudio90Song(text)` reads it back into the same song, and also takes a pattern written as one string. To match, `formatAudio90Cell` is now `printAudio90Cell`.
