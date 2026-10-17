# Playground: Embeds for the Docs

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

A compact page, `/playground/embed.html#example=<id>`, with one file open
and the preview beside it, sized for an `<iframe>` in a docs page. The docs
could then show a running example right next to the text that explains it,
editable in place, with a link to open it in the full playground. This was
052's idea 10.4.

The docs link to the playground today through `PlaygroundLink`
(`packages/sites/docs/.vitepress/components/PlaygroundLink.vue`), which
opens an example in a new page.

### Things to decide

- Which file the embed shows, and whether the reader can switch files.
- Whether changes in an embed are kept, or thrown away when the page
  closes. An embed probably shouldn't fill the reader's project list.
- How much of the playground an embed loads. The language service is the
  biggest part, and an embed might do without it, or load it only once the
  reader starts typing.
- How it looks in the docs' light and dark themes.

## Acceptance Criteria

- [ ] An embed page that shows an example's file and runs it, sized for an
      `<iframe>`.
- [ ] A docs component that embeds it, used on at least one page.
- [ ] Its load size is measured, and agreed with the owner.
- [ ] Lint, type checks, tests and the docs build pass.

## Progress Log

### 2026-10-17

Created from 052's section 10.4, when 052 was archived.
