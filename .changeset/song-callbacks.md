---
"audio90": minor
---

A chip takes `onRow` and `onEnded` as it is made, for a page that doesn't tick to poll `row` and `song`. `onRow(song, orderIndex, row)` is called as a song reaches each row, and `onEnded(song)` as a song ends by itself, at the end of its order with no repeat left and nothing queued; stopping a song doesn't call it. In a browser they are called as the audio thread reports the row or the end, a moment before it is heard. The headless chips take them too, and call them during `update`, never inside `play` or `stop`.
