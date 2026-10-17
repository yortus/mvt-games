# Playground: Port a Project to an Arcade Entry

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

A playground project that grows into a game worth listing shouldn't need
rewriting by hand to join the Arcade. "Export as an Arcade entry" would
download a zip of one folder, ready to drop into
`packages/sites/arcade/src/entries/<id>/`. This was 052's idea 10.2.

The zip would hold:

- the project's `models/`, `views/` and `data/`, as they are;
- `main.ts`, moved to `start/project.ts`, with its `playground` import
  pointed at a small adapter;
- a generated `start/load.ts`, whose starter wraps the project: its screen
  size from the project's options, a `start` that gives the project a
  container of its own on the stage, and a `destroy` that removes it;
- a generated `start/entry.ts`, with the entry's name filled in, and its
  summary, description and tags marked for the author to write.

The author then adds the entry to `catalogue.ts` and makes its thumbnail,
as for any new entry. The tool lives in the playground, so the Arcade's
code never depends on it.

### Things to decide

- Whether the adapter is generated into each ported entry, or kept once in
  the Arcade's `entry-types/`.
- How a project's input, if it reads the keyboard itself, maps to the
  Arcade's `inputConfig`.
- The originality rules for entries
  (`packages/sites/arcade/src/entries/README.md`), which a ported project
  must follow too.

Task 057 goes the other way, opening an entry in the playground. If both
are built, they should share the adapter's idea of what an entry's starter
needs.

## Acceptance Criteria

- [ ] "Export as an Arcade entry" downloads a folder that runs as an entry
      once it's added to `catalogue.ts`.
- [ ] Tested on each starter (Pixi, HTML and three.js) and on an example.
- [ ] The docs on adding an entry mention it.
- [ ] Lint, type checks and tests pass.

## Progress Log

### 2026-10-17

Created from 052's section 10.2, when 052 was archived.
