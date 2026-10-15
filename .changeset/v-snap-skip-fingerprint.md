---
'v-snap': patch
---

A run whose `--project` filter leaves out v-snap's projects, such as `vitest -p unit`, no longer fingerprints the repository's sources as the config loads, which took about a tenth of a second.
