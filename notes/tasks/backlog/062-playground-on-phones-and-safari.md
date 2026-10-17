# Check the Playground on Real Phones and in Safari

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

The playground has only been checked in desktop browsers. 052's spike
(its section 16, 2026-10-16) ran in Chromium, Firefox and WebKit through
Playwright, and everything built since was checked in headless Chromium.
Nothing has been tried on a real phone, or in Safari itself.

The spike also found that, with a phone-like profile (a slow CPU and
network), two of 052's load-time targets were missed (its section 11).

### What to check

- **Loading:** how long the page takes until it can be typed in, and until
  the language service is ready, on a mid-range phone. Compare with 052
  section 11's targets.
- **The narrow layout:** the panel tabs (files, code, run), the dialogs,
  the theme menu and the (i) in the nav, and the Performance tab.
- **Typing:** the on-screen keyboard with CodeMirror, completions, and the
  editor's right-click menu, which needs a long press on a phone.
- **Running:** the sandbox, sound (which needs a tap first, and HTTPS on
  the network: `npm run dev:https`), and touch input for projects that use
  it.
- **Safari on a Mac and on iOS:** the sandbox's import map and blob URLs,
  IndexedDB (Safari may clear it after a week without a visit), the
  `CompressionStream` that share links use, and the CSS container queries
  that the Perfmon uses.

## Acceptance Criteria

- [ ] Checked on at least one Android phone, one iPhone, and Safari on a
      Mac, with what was found written here.
- [ ] Anything broken is fixed, or recorded as a task of its own.
- [ ] The load times are measured on a phone, and compared with 052
      section 11's targets.

## Progress Log

### 2026-10-17

Created when 052 was archived, from its open note that nothing had been
checked on a real phone or in Safari.
