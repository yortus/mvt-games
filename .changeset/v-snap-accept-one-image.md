---
'v-snap': patch
---

A failed image's message suggests a command that accepts that image alone, `vitest run <file> -t "^<test's name>$" -u`, instead of every changed image in the file. A name that a shell would change in double quotes gets the file's command, as before.
