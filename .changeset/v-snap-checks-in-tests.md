---
'v-snap': minor
---

Reference checks show wherever test failures do. A reference whose pixels don't match its hash fails its own test, and two tests of a file with one image name fail the second test, instead of failing the run after Vitest's summary. Outside CI, a run deletes references that no test uses any more, as it writes new ones, so a renamed test leaves nothing behind; in CI, they still fail the run.
