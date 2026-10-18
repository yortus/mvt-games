# Better Link Previews

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-18 |
| Updated  | 2026-10-18 |

## Description

Since 039, each entry has its own address and its own link preview: a copy
of the Arcade's page with the entry's title, summary and thumbnail in its
Open Graph tags (`scripts/vite-plugin-entry-pages.ts`). Checked on the live
site on 2026-10-18, it works: a crawler fetching
`https://yortus.com/mvt-games/arcade/crumb-chase/` gets Crumb Chase's own
tags. The previews are crisp in Facebook's Sharing Debugger, opengraph.xyz
and the chat apps, but LinkedIn's Post Inspector shows the image very
blurred.

### Why LinkedIn blurs it

LinkedIn draws a link's image about 1200x627 and stretches a smaller one
up, smoothly. The previews use the cards' thumbnails, which
`generate-thumbnails` makes for the Arcade's cards: the longer side of the
crop is 600 pixels (`CROP_PIXELS`). So LinkedIn stretches them about two
times, and pixel art blurs. It also turns the image into a JPEG, which
softens it a little more. The other tools draw the image at its own size or
smaller.

The thumbnails also vary in shape, from 440x600 (Kwazy Cactii) to
1920x1200 (Fruit Machine). A large card is about 1.91:1, so a tall
thumbnail is cropped hard or shown as a small square.

### What to do

The entry pages, in one change (the generator, the images and the plugin):

1. **A share image for each entry, 1200x630.** `generate-thumbnails` takes
   a second photo of each entry, at a scale that fills the frame without
   stretching, centred on the Arcade's dark background (`#0d1117`) so a
   tall entry is not cropped. Committed beside the thumbnail, as
   `start/share.png`.
2. **PNG, not WebP.** Pixel art stays sharp in a PNG and packs small.
   LinkedIn and WhatsApp have been unreliable with WebP.
3. **`og:image:width` and `og:image:height`.** With them, Facebook, and
   apps that work like it, can draw the image the first time a link is
   shared, before fetching it.
4. **`twitter:card` set to `summary_large_image`.** X chooses its card from
   this tag. Without it, X shows a small card or none.
5. **`og:image:alt`**, such as "Crumb Chase, a maze game", for screen
   readers on the platforms that read it.
6. **Each share image under about 300 KB.** WhatsApp leaves out a larger
   one. The generator warns when an image is bigger.

The other pages:

7. **A share image for the Arcade and the site's root.** Both have a title
   and a description but no `og:image`, so a link to either shows as text
   only. A 1200x630 picture of the card wall, made by the same generator.
8. **Open Graph tags for the docs.** `/docs/` has a `<title>` and a
   description, but no `og:` tags. VitePress's `transformHead` can give
   each page its own `og:title`, `og:description` and `og:url`, with one
   shared image.
9. **A description and Open Graph tags for the playground.** `/playground/`
   has only `<title>MVT Playground</title>`.

Checks:

10. **A build check that every entry page's tags are complete:** the entry's
    own title, description, address and image, and an `og:image` that is an
    absolute `https://` address. The plugin already stops the build when a
    thumbnail is missing. This would also catch a build with no
    `SITE_ORIGIN`.
11. **Deploy the test site again.** On 2026-10-18,
    `https://mvt-games-test.surge.sh/arcade/crumb-chase/` gave a 404, so
    changes to the tags can't be tried there before they go live.
12. **After deploying, check again with each platform's tool:** Facebook's
    Sharing Debugger ("Scrape Again") and LinkedIn's Post Inspector, which
    also clear their caches, and a Slack or Discord message to yourself.
    Platforms keep a preview for a while, so to see a change at once, add a
    query such as `?v=2` to the address.

### How to check a page's tags

Crawlers don't run JavaScript, so the tags must be in the page as it is
served. Fetch it as a crawler does:

```
curl -sL -A "facebookexternalhit/1.1" https://yortus.com/mvt-games/arcade/<id>/ | grep -E "og:|twitter:|<title>"
```

The dev server can't show this: it serves the Arcade's page, with its own
tags, for every entry's address. Only a build writes the entries' copies,
with absolute image addresses only when `SITE_ORIGIN` is set.

## Acceptance Criteria

- [x] Every entry has a 1200x630 PNG share image under 300 KB, made by
      `generate-thumbnails` and committed. (Three are JPEGs, which the
      generator chooses when the PNG is over the budget: Coral, Fractalscope
      and the Arcade's wall.)
- [x] Each entry page's `og:image` names its share image, with
      `og:image:width`, `og:image:height` and `og:image:alt`.
- [x] Each entry page has `twitter:card` set to `summary_large_image`.
- [x] The Arcade's page and the site's root have a share image.
- [x] The docs and the playground have Open Graph tags, and the playground
      a description.
- [x] The build fails when an entry page's tags are incomplete, or its
      image address is not absolute. (`check:link-previews`, after the
      build and in both deploys.)
- [ ] Checked after deploying: LinkedIn's Post Inspector shows an entry's
      image crisp, and Facebook's Sharing Debugger, X and a chat app show
      the large card.

## Progress Log

- 2026-10-18: Created. 039's previews checked on the live site: they work,
  crisp everywhere but LinkedIn, which stretches the 600-pixel thumbnails.
- 2026-10-18: Items 1 to 10 done, in main, unstaged.
  - `generate-thumbnails` also writes `start/share.png` for each entry,
    photographed at the scale that fits 1200x630 and centred on `#0d1117`,
    or `share.jpg` when the PNG is over 300 KB. It then photographs the card
    wall, at 1200x630 with reduced motion, into `src/arcade/share.jpg`,
    always a JPEG, since the docs and the playground name its address. The
    sizes are in `scripts/share-image.ts`. All 22 entries are 20 to 225 KB.
  - The script now uses the Arcade's dev server when one is running, since a
    second would prepare the shared dependency cache again under it. It
    writes its pictures after the last photo: a thumbnail written into
    `src/` made the dev server reload the snapshot page mid-photo, and
    the next screenshot never returned. `headless-chrome.ts` now rejects
    waiting calls if Chrome closes the connection, instead of the script
    ending silently.
  - The entry pages plugin emits each entry's share image (hashed) and the
    wall's (at `arcade/share.jpg`), and writes `og:image`, its width,
    height and alt. The alt is "A screen from <name>, a <kind> in the MVT
    Arcade". The Arcade, the root and `404.html` show the wall; the root
    gains `og:url`, the Arcade's address. `twitter:card` is in both pages.
  - Docs: `transformHead` gives every page its title, the site's
    description (no page sets its own), its address and the wall. Playground:
    a description and the tags in `index.html`, and a small plugin for its
    address and the picture's.
  - `check:link-previews` (`@mvtjs/checks`) reads every page in `dist/`.
    It fails on a missing tag, an address not under `SITE_ORIGIN` and
    `BASE_URL`, a picture not the size its tags say, narrower than 1200 or
    over 300 KB, two entries sharing a picture, or, in CI, no `SITE_ORIGIN`.
    Tried against a missing alt, a wrong origin and CI with no origin. The
    deploys set `BASE_URL` and `SITE_ORIGIN` for the whole job now; the
    unit tests pass with them set.
  - Thumbnails were left as committed: Chrome's renders differ by a few
    bytes from run to run, so the rewritten ones were restored.
  - Left: item 11 (deploy the test site) and item 12 (check with each
    platform's tool after deploying).
