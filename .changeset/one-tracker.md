---
"audio90": minor
---

Both chips read their songs with one tracker parser, so a pattern's rows, cells and errors work the same on each. An Audio80 sound no longer has `note` and `filter` of its own: read them from `data`, as an Audio90 sound's. An Audio80 song now has `instrumentLetters`, as an Audio90 song does.
