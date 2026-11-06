---
'@mvtjs/utils': minor
---

`createRepeater`, new in `@mvtjs/utils`, calls a function once every `periodMs` milliseconds of game time, such as to fire a ship's gun while the player holds the trigger. Time passes only through `update`, so it stops while the game is paused, and a `periodMs` of 0 turns it off. It's for models. A view that needs a steady beat should read a metronome's `count` instead.
