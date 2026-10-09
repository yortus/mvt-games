---
'@mvtjs/utils': minor
---

There is a new `createMetronome`, which returns a `Metronome`. A metronome counts beats at a tempo you can change, and does nothing itself. Set its `periodMs`, call its `update(deltaMs)` in a view's update step, and act each time its `count` rises. It suits anything that repeats while something lasts, such as a heartbeat that quickens, an alarm while fuel is low, or a blinking light. Its first beat comes as soon as it starts, not a period later.
