---
'v-snap': patch
---

Fixes and clearer messages. A reference whose name differs from its test's only in case fails the test, on every system, and `-u` renames it. `-u` rewrites a reference whose pixels don't match its hash, and, except on arm64, an image within the tolerance. A Git LFS pointer, or a reference that can't be read, gets a message that says what to do. The diff marks differences within the tolerance in dark yellow. `.each` and `.for` follow `.skip`, `.only`, `.skipIf` and `.runIf`. Two configs' `vsnap()` calls with one name no longer share a sources fingerprint. Paths in messages are relative to the folder that Vitest runs in.
