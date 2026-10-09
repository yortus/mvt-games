---
'@mvtjs/utils': minor
---

A number watched with `watch` now has `increased` and `decreased`. `increased` is true when the number changed on this poll to a greater number than `previous`, and `decreased` is true when it changed to a lesser one. Both are false when nothing changed, and on the first poll, which has no previous value. So a view can write `if (w.shots.increased)` instead of `if (w.shots.changed && w.shots.value > (w.shots.previous ?? 0))`. Only numbers have them: reading `increased` on a watched string or boolean is a type error. Nothing else about `watch` has changed.
