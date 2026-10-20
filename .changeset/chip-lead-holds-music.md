---
"@mvtjs/chiptune": minor
---

In a browser, the chips now play 100 ms behind the game, rather than 35 ms, so music plays on through late frames on slow devices such as phones. A frame later than even that holds the music still, with its notes ringing on, rather than dropping out, and `AudioControls.stallCount` counts each one. Pausing now fades out at once, and resuming fades back in at once. The new `Audio90.heardTime` says which chip time is reaching the speaker now, for a view that shows the music as it is heard.
