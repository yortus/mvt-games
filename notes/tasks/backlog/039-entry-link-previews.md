# Link Previews for Each Entry

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-05 |
| Updated  | 2026-10-05 |

## Description

An entry's address is a fragment of the Arcade's (`/#crumb-chase`), so a
link to it, pasted into a chat or a post, previews as the Arcade itself:
the same title, description and image for every entry. Sites that build
previews read the page's `<meta>` tags (Open Graph's `og:title`,
`og:description`, `og:image`), and never see the fragment.

Give each entry a small page of its own, generated at build time, that
carries the entry's own tags and its thumbnail as `og:image`, and sends the
visitor on to `/#<id>` (a `<meta http-equiv="refresh">`, with a script that
does it at once). Share links to it in place of the fragment.

Decided in proposal [036](../../proposals/036-website-arcade.md) (section
12, question 5): link previews come later, and entries stay on fragments
until then.

### To decide

- Where the pages live (`/play/<id>/`, or `/<id>/`), and whether the Arcade
  writes that address into the URL as an entry plays, or only offers it to
  copy.
- How they are generated: a small Vite plugin that writes one page per
  catalogue entry, from its metadata, like `virtual:entry-facts`.
- Whether `og:image` wants a bigger picture than the card's thumbnail
  (previews are commonly 1200 by 630).

## Acceptance Criteria

- [ ] Each entry has an address whose preview shows its own name,
  summary and picture
- [ ] Opening that address plays the entry in the Arcade
- [ ] The pages are generated from the catalogue, never written by hand

## Progress Log

- 2026-10-05: Created from 036's step 10.
