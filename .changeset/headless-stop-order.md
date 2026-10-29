---
"audio90": patch
---

On a headless chip, a sound played just after `stop()` now plays, as it does in a browser. Stopping everything was applied after the plays that followed it, which it released at once.
