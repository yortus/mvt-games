---
"audio90": minor
---

An Audio90 sound has one way to say each thing. `legato: { glideMs }` is gone: give `glideMs`, and `isLegato: true` to glide only into a note that overlaps the one before. `filter.envelope: { octaves, ... }` is gone too: aim a `modEnvelope` at the cutoff, as in `modEnvelope: { to: 'cutoff', amount: 3, envelope: { attackMs: 0, decayMs: 200, sustain: 0, releaseMs: 40 } }`.
