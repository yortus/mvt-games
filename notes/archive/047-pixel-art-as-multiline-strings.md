# Pixel Art as Multiline Strings

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-09 |
| Updated  | 2026-10-18 |

## Description

The texture scripts draw pixel art as arrays of strings, one string per row
of pixels. Each row needs its own quotes and a comma, which clutters the
picture. Write each picture as one multiline string in backticks instead,
so it reads more like the picture it draws.

The Audio80's tracker notation made the same change on 2026-10-09, in
proposal 045. Its songs and step tables are now backtick strings. The parser
skips blank lines and `#` comments, and trims each line's indentation. The
pixel art can follow the same rules.

## Files

The scripts with pixel art in arrays of strings:

- `packages/sites/arcade/scripts/generate-burrow-bust-textures.ts`
- `packages/sites/arcade/scripts/generate-crumb-chase-textures.ts`
- `packages/sites/arcade/scripts/generate-fuel-run-textures.ts`
- `packages/sites/arcade/scripts/generate-galaxy-raiders-textures.ts`
- `packages/sites/arcade/scripts/generate-neon-monsoon-textures.ts`

Search the rest of the repo for others before starting.

## Done When

- Every picture is a backtick string, and the code that reads them splits
  it into rows the way the tracker notation does.
- `npm run generate-textures` produces textures identical to the committed
  ones, byte for byte. That shows each conversion was exact.

## Progress Log

- 2026-10-09: Created, after the tracker notation moved to backtick strings.
- 2026-10-18: Done. Each of the 48 pictures in the five scripts is a
  backtick string, read by `parsePixelArt` (`scripts/pixel-art.ts`, with a
  test). It trims each line's indentation and skips blank lines, as the
  tracker notation does, but has no comments: `#` is a pixel in Neon
  Monsoon's letters. The one-line pictures (Galaxy Raiders' bullets, Neon
  Monsoon's letters) became backtick strings too. `npm run generate-textures`
  rewrote every PNG, and git found none changed. Left as arrays on purpose:
  the shared pixel glyphs (`src/pixel-glyphs/`), which the site's views read
  as rows at run time, and the Tune Tracker's five symbols, which join them.
