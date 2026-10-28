---
"audio90": minor
---

A scope is attached to a chip rather than built into it, since playing music and sounds needs none. `createScope(chip)`, from `audio90/tracker`, returns a `Scope`: the chip's `voiceCount`, each voice's last `SCOPE_POINTS` points in `points`, each voice's pan in `pans`, and `destroy`. A chip draws scopes only while one is attached, and fills every one attached. The Audio80 has scopes too now, with every pan at 0, since it is mono, so both chips have the same interface: the Audio90's `scope` and `setScopes` are gone, as are `AUDIO90_SCOPE_POINTS`, `AUDIO90_SCOPE_PANS` and `AUDIO90_SCOPE_LENGTH`. A headless chip makes no sound, so a scope attached to it has no voices.
