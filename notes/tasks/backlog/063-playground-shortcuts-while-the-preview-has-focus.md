# Playground: Shortcuts While the Preview Has the Keyboard

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

Once a visitor clicks in the preview, the keyboard goes to the project in
the sandbox's iframe, so that games can use the keys. The playground's own
shortcuts, such as Ctrl+S, Ctrl+Enter and Ctrl+P, then stop working until
the visitor clicks back in the editor. Ctrl+S is worse: the browser's own
"Save as" dialog opens instead. Help says so ("Click back in the editor to
use these shortcuts again"), but it's easy to trip over.

The sandbox could pass the playground's shortcuts on to the page with a
message, and keep every other key for the project. The sandbox runs at an
opaque origin, so it can't call the page directly, and the page must check
that each message comes from the current run's iframe, as it does for the
sandbox's other messages.

### Things to decide

- **Which keys pass on.** Those with Ctrl or Cmd, which games rarely use,
  are a natural line. Plain keys, Escape and the function keys stay with
  the project.
- **Whether the sandbox prevents the browser's default** for the keys it
  passes on, such as Ctrl+S's "Save as".
- **Whether a project can opt out,** for a project that wants Ctrl+S
  itself.

## Acceptance Criteria

- [ ] With the preview focused, Ctrl+S, Ctrl+Enter, Ctrl+P and Ctrl+O do
      what they do in the editor, and no browser dialog opens.
- [ ] Every other key still reaches the project.
- [ ] Help's note about clicking back in the editor is updated.
- [ ] Tested in a browser, and with unit tests for the key filter.

## Progress Log

### 2026-10-17

Created when 052 was archived, from a loose end found while building the
editor's keys.
