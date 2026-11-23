---
'v-snap': patch
---

On arm64 processors, an image now passes if only a few scattered pixels differ from its reference by more than the tolerance: at most one in 10,000, in clumps of at most two. arm64 processors draw an odd pixel along the edge of a 3D shape differently, and these images used to fail on macOS. Other processors still need every pixel within the tolerance.
