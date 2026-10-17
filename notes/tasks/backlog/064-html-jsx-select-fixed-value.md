# HTML JSX: A Fixed `value` on a `<select>` Is Lost

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

In `@mvtjs/html`'s JSX, a `<select>` given a fixed `value`, such as
`<select value="b">`, shows its first option instead. The JSX core writes
an element's attributes before it adds its children. A `<select>` with no
options yet can't take a value, so the browser drops it, and when the
options arrive, the first one is selected.

A `value` that's a function, such as `value={() => 'b'}`, works, because it's
written again on every refresh, after the options are there. The
playground's theme menu uses that form, so nothing in the repo is affected
today. The bug was found by the test for `<optgroup>`, added for the
playground's theme menu (052, step 7).

### Ways to fix it

- **Write `value` after the children,** for the elements where it depends
  on them: `<select>`, and perhaps `<textarea>`. That changes the order in
  which the JSX core writes attributes and adds children, which is shared
  by every renderer, so it needs care, and the conformance tests run on
  every JSX target.
- **Give `<select>`'s `value` special handling** in the HTML element table
  (`packages/libraries/html/src/jsx/html-elements.ts`), so that it's
  written again once the children are added.

## Acceptance Criteria

- [ ] `<select value="b">` with options `a` and `b` shows `b`.
- [ ] A test in `@mvtjs/html` covers it, with `<option>`s given directly
      and through `<optgroup>`.
- [ ] The conformance tests still pass for every JSX target.
- [ ] A changeset for `@mvtjs/html`.

## Progress Log

### 2026-10-17

Created when 052 was archived. Found while adding `<optgroup>` in 052's
step 7, and left for later.
