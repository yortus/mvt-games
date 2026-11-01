# The Three Sites and Their Themes: Follow-Ons

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-11-01 |
| Updated  | 2026-11-01 |

## Description

Proposal [084](../../archive/084-three-sites-and-themes.md) split the Arcade
into three sites, the arcade, the demos and the puzzles, sharing
`packages/sites/site-kit/`, and gave them three themes, Arcade, Dark and
Light. What it left for later, and what building it found, is here. Each
item can be done on its own, or dropped.

### The themes

- **A way into an entry of Dark's and Light's own.** Both are quiet themes
  (`isQuiet` in `site-kit/src/arcade/views/themes.ts`), so they borrow the
  way in a visitor who asks for less motion gets: the wall fades rather than
  burns. A way of their own, such as the card's photo growing to fill the
  screen, would suit them better than a fade.
- **The page's sounds in every theme.** The page plays the Arcade's sounds
  whatever the theme. Softer ones might suit Dark and Light.
- ~~**The docs' nav following the theme.**~~ Decided the other way
  (2026-11-01): the sites' nav no longer follows the theme either. It is
  yellow on dark blue, in the pixel font, on every site and in every theme,
  so the bar stays put going from one site to another.
- **Entries reading the theme.** No entry knows the theme. Sudoku could
  draw in ink on paper in Light, say. It would need the theme passed to
  the entry's starter, and a decision on whether entries should change with
  it at all.
- **What is still the Arcade's in every theme.** The wall's burn (only the
  Arcade burns, so it shows only there), and the search box's magnifier,
  which is a data URI that the theme's custom properties can't reach. The
  page's title, the pixel marquee, is the Arcade's in every theme on
  purpose.
- **Pale empty rows in Light's highscore tables.** An empty row's dashes
  are faint on Light's paper. Check them against the contrast test's
  ratios, and add the pair to `themes.test.ts` if they need one.
- **A font of our own.** The themes use the system's fonts, so the titles'
  small capitals are made up by the browser on Windows, which has none in
  Segoe UI. A self-hosted font with real small capitals (Source Sans 3 or
  Fira Sans, under the SIL Open Font License) would look the same on every
  device, for about 20 to 40 KB a weight, loaded only by a page that uses
  it. The home page's budget counts JavaScript only, so it would not fail
  the build, but the demos' and puzzles' first view would be a little
  slower. The user's decision.
- **The outlined titles on real phones.** Dark's and Light's card titles
  are outlines (`-webkit-text-stroke`, with the letter filled over its
  stroke by `paint-order: stroke fill`, which hides the overlapping pieces
  of phones' variable fonts). They were checked in a desktop browser at a
  phone's size, with Windows' fonts. Check them on an Android phone and an
  iPhone.

### The cards' photos

- **Fruit Machine's crop shows a clipped label.** Its `thumbnailCrop`
  starts part way across a label, so "...rn machine" shows at the top left
  of its card in every theme. Move the crop, or the label.
- **Sudoku Digger's square photo includes its buttons.** In Dark and Light
  a card's photo is square, and the Digger's play area is only 480 pixels
  tall, so the square takes its whole height, buttons and all. A
  `thumbnailCrop` above the buttons would leave them out.

### The dev server

- **The docs' page updates use a socket of their own.** The one dev server
  (`site-kit/scripts/run-dev-server.ts`) hands every site's Vite its HTTP
  server for page updates (`ws: { server }`), but VitePress's opens its own
  socket on port 24678 instead. With one dev server that works. A second,
  on another port, can't open the socket, and its docs page reloads every
  few seconds. Find why VitePress's server ignores the option, or give it a
  port of its own.

### Decided against for now (084 section 13)

- **Renaming the page's types** (`ArcadeEntry` to `SiteEntry`, and so on).
  Later, or never.
- **A landing page at the site's root**, with the three sites as doors, in
  place of the redirect to the arcade. The redirect stays for now.

## Acceptance Criteria

- [ ] Each item is done, or dropped with the reason.
- [ ] Each change to a theme passes `themes.test.ts`, and any new text on a
      new background has its contrast pair there.
- [ ] The demos' and puzzles' link previews are retaken after any change to
      how their walls look (`npm run generate-thumbnails -w @mvtjs/demos --
      demos`).

## Progress Log

- **2026-11-01.** Created from 084's section 15 as 084 was archived.
