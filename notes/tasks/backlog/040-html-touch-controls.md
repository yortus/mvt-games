# Touch Controls in HTML

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-05 |
| Updated  | 2026-10-05 |

## Description

On a touch screen, the entry host draws on-screen controls (a d-pad or a
floating joystick, and up to two buttons) for the entry it runs, from the
session's `inputConfig`. They are a Pixi view, `TouchInputView` in
`packages/website/src/shared/`, on the host's Pixi stage beside the entry
(`runner/pixi-stage.ts`). So only a `pixi` entry can have them: an `element`
entry brings its own renderers, and the host has no Pixi stage to put them
on. No `element` entry takes controls today; the first one that does will
need them.

Move the touch controls to an HTML view, in `@mvtjs/html`'s JSX, laid over
the play area by the host for an entry of either kind. The keyboard input
(`KeyboardInputView`) has no picture, and could move with them.

Decided in proposal [036](../../proposals/036-website-arcade.md) (section
12, question 7): touch controls stay a Pixi view until an `element` entry
needs them.

## Acceptance Criteria

- [ ] Touch controls drawn in HTML, over the play area, for `pixi` and
  `element` entries alike
- [ ] The same controls and feel as now: the d-pad, the floating joystick,
  the buttons and their labels, multi-touch
- [ ] The Pixi `TouchInputView` removed, and the host's Pixi stage holds
  only the entry
- [ ] Checked on a real touch screen

## Progress Log

- 2026-10-05: Created from 036's step 10.
