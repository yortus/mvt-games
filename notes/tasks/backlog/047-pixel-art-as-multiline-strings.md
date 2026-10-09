# Pixel Art as Multiline Strings

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-09 |
| Updated  | 2026-10-09 |

## Description

The texture scripts draw pixel art as arrays of strings, one string per row
of pixels. Each row needs its own quotes and a comma, which clutters the
picture. Write each picture as one multiline string in backticks instead,
so it reads more like the picture it draws.

The Audio80's tracker notation made the same change on 2026-10-09, in
proposal 045. Its songs and step tables are now backtick strings. The parser
skips blank lines and lines that start with `//`, and trims each line's
indentation. The pixel art can follow the same rules.

## Files

The scripts with pixel art in arrays of strings:

- `packages/website/scripts/generate-burrow-bust-textures.ts`
- `packages/website/scripts/generate-crumb-chase-textures.ts`
- `packages/website/scripts/generate-fuel-run-textures.ts`
- `packages/website/scripts/generate-galaxy-raiders-textures.ts`
- `packages/website/scripts/generate-neon-monsoon-textures.ts`

Search the rest of the repo for others before starting.

## Done When

- Every picture is a backtick string, and the code that reads them splits
  it into rows the way the tracker notation does.
- `npm run generate-textures` produces textures identical to the committed
  ones, byte for byte. That shows each conversion was exact.

## Progress Log

- 2026-10-09: Created, after the tracker notation moved to backtick strings.
