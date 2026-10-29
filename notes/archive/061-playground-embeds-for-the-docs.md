# Playground: Embeds for the Docs

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-17 |
| Updated  | 2026-10-29 |

**Folded into [075](../proposals/075-docs-as-a-book.md), section 9, on
2026-10-29.** Its four questions are answered in 075 section 9.4, and its
work is 075's implementation steps 12 and 13.

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

### 2026-10-29

Folded into 075, which plans the docs as a book, with examples that run
inline online and print as stills. 075 section 9.4 answers the four
questions above: the page names the file, edits last only while the page
is open, no language service, and the docs' theme is passed in. A trial
build measured the playground's parts: its language service worker is
1,019 KB gzipped, its page 310 KB, Pixi 77 KB. Archived, not done: the
work continues under 075.
