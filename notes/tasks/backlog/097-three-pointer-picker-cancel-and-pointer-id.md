# `@mvtjs/three`'s pointer picker: a cancel, and one pointer

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-11-13 |
| Updated  | 2026-11-13 |

## Description

From [095](../../archive/095-input-across-the-sites.md) section 6.6, step 9.
The rest of 095 is finished.

`createPointerPicker`, in
[`packages/libraries/three/src/pointer-picker.ts`](../../../packages/libraries/three/src/pointer-picker.ts),
raycasts each DOM pointer event into a three.js scene. It has two gaps.

- **No cancel.** It listens for `pointerdown`, `pointermove`, `pointerup`,
  `click` and `pointerleave`, but not `pointercancel`. After a cancel, the
  browser sends no `pointerup`. So `isPressed` stays true, and the next
  move counts towards a drag that has ended.
- **No pointer id.** It keeps one press (`isPressed`, `pressX`, `pressY`,
  `isDrag`) for every pointer. A second finger's `pointerdown` restarts the
  first one's press, and either finger's `pointerup` ends it.

The Fruit Machine's three.js cabinet is the only user in the repo. Its lever
uses the picker's `click`, and its drag to turn the cabinet uses
`listenToElementPointer` from the site kit, not the picker.

`@mvtjs/three` is published, so this needs a changeset.

## Acceptance Criteria

- [ ] A `pointercancel` ends the press, and reports no `click` for it.
- [ ] The picker follows one pointer's press at a time, by its
      `pointerId`. A second finger neither restarts nor ends the first's
      press. Hover still follows whichever pointer moves.
- [ ] Unit tests for both, beside the picker's own.
- [ ] A changeset for `@mvtjs/three`.
- [ ] Its docs, and the three.js cheat sheet if it mentions either, are
      current.

## Progress Log

- 2026-11-13: created from 095 step 9.
