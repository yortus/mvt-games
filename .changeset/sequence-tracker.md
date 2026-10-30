---
'@mvtjs/utils': minor
---

Breaking: `createSequenceReaction` is now `createSequenceTracker`. It works as before: it keeps track of each step's phase from frame to frame, and calls a step's `entering`, `active` and `inactive` handlers. It isn't a reaction in the sense of `createReaction`, which acts only on a change, so the new name says what it does. Rename it where you import it.
