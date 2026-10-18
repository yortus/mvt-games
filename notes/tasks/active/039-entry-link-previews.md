# Link Previews for Each Entry

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-05 |
| Updated  | 2026-10-18 |

## Description

An entry's address is a fragment of the Arcade's (`/#crumb-chase`), so a
link to it, pasted into a chat or a post, previews as the Arcade itself:
the same title, description and image for every entry. Sites that build
previews read the page's `<meta>` tags (Open Graph's `og:title`,
`og:description`, `og:image`), and never see the fragment.

A page of its own for each entry, that redirects to the fragment, would not
help on its own. People share what is in the address bar, and the address
bar would still show the fragment. So the entry's own address has to be the
one the Arcade shows as the entry plays.

### The plan

Below, `<base>` is the site's base (`/mvt-games/` when deployed, `/` in
development).

- **The Arcade moves to `<base>arcade/`.** Its page's source moves from
  `packages/sites/arcade/index.html` to `packages/sites/arcade/arcade/index.html`,
  so Vite builds it to `dist/arcade/index.html`. The assets stay where they
  are, in `dist/assets/`.
- **`<base>` redirects to the Arcade.** `dist/index.html` becomes a small
  page that sends the visitor on to `<base>arcade/`, keeping the query. A
  fragment that names an entry goes straight to that entry's address
  (`<base>#crumb-chase` to `<base>arcade/crumb-chase/`), so links shared
  before the move keep working. A script does the redirect, since only a
  script can read the fragment, with a `<meta http-equiv="refresh">` for
  visitors without scripts. The page carries the Arcade's own `og:` tags,
  so a link to the bare site still previews as the Arcade.
- **Each entry's address is the Arcade's, with the entry's id added:**
  `<base>arcade/foo/`. Entries' addresses are made from the Arcade's path
  alone (`formatEntryPath`, `parseEntryPath`), so moving the Arcade again
  moves its entries with it. The folder's name is in three places:
  `ARCADE_DIR` in `vite.config.ts`, `ARCADE_PATH` in `main.ts`, and the
  links in the pages' HTML. The 404 page can be shown at any address, so
  the page cannot read its own path from the address it is shown at.
- **Each entry's page is a copy of the Arcade.** At build time, a small Vite
  plugin copies the Arcade's built page to `dist/arcade/<id>/index.html` for
  each catalogue entry, with the entry's own `<title>`, `og:title`,
  `og:description`, `og:image` and `og:url`. The copy is the Arcade, not a
  redirect. Pages serves each copy as a plain file, so no rewriting is
  needed. The build fails if an id collides with a folder the build writes
  into `dist/arcade/` itself. The plugin (`scripts/vite-plugin-entry-pages.ts`)
  reads the catalogue with Vite's `runnerImport`, so it gets each entry's
  name and summary as the Arcade does. `og:url` and `og:image` need full
  addresses, so the deploy workflows name the site's origin (`SITE_ORIGIN`).
- **The Arcade reads and writes the path, not the fragment.** `writeUrl` in
  `arcade/main.ts` pushes `<arcade><id>/<query>` as an entry plays, and
  leaving returns to `<arcade><query>`, where `<arcade>` is the Arcade
  page's path. Every copy is the same page, so these steps never reload.
  `launchFromFragment` becomes `followUrl`, run on load and on `popstate`;
  the `hashchange` listener goes. The Arcade itself no longer reads the
  fragment: the redirect page sends old links on. The page's title follows
  the entry playing, for bookmarks and history.
- **A 404 page.** `dist/404.html` is a copy of the Arcade too, so a mistyped
  or retired entry's address lands on the wall rather than Pages' own 404.
  Pages serves it at the address that was asked for, so the Arcade rewrites
  that address to the wall's. Pages serves one 404 page for the whole site,
  so a missing page in the docs or the playground lands on the wall too.
- **The site's links follow the Arcade.** The nav in the Arcade's page links
  relative to the page (`./`, `./docs/`, `./playground/`), which breaks both
  at `<base>arcade/` and one level further down in an entry's page. Its
  links become absolute, built from `<base>` (`%BASE_URL%` in the HTML). So
  do the cards' links and the Arcade's link to the docs, which the page
  now gives the views as bindings (`entryHref`, `docsHref`). The playground's nav
  (`../`) and the docs' (`__SITE_ROOT__` in `.vitepress/theme/index.ts`)
  link to the Arcade at its new address rather than through the redirect.
- **The dev server.** Vite runs with `appType: 'mpa'`, so it does not fall
  back to an HTML page for `/arcade/crumb-chase/`. A small middleware, like
  `trailingSlashPlugin`, serves the Arcade's page for a path that names a
  catalogue entry. `/` serves the redirect page, as `<base>` does on Pages.

This reverses proposal [036](../../archive/036-website-arcade.md)'s
decision (section 12, question 5) that entries stay on fragments, and its
plan for the Arcade to be the site's root page. Only `writeUrl` and
`launchFromFragment` read or wrote the fragment.

### To decide

- Whether `og:image` wants a bigger picture than the card's thumbnail
  (previews are commonly 1200 by 630), and whether it should be a PNG or
  JPEG: not every site that builds previews reads WebP. For now it is the
  card's thumbnail, as built. The Arcade's own page has no `og:image` yet.
- Whether an open info panel should also have its entry's address, so a
  link copied while it is open previews as that entry. Today a panel's
  history step keeps the wall's URL.

### Checked

- Nothing else at run time builds a URL relative to the page. The entries'
  texture registries already use `BASE_URL`. The Arcade's link to the docs
  was relative (`./docs/`), and is now built from `BASE_URL`.
- `check:home-page-budget` measures `arcade/index.html` (46 KB of 50).
- The thumbnail script loads `snapshot.html`, which stays at the site's
  root. The READMEs that named an entry by its fragment name it by its path.
  Every package's `homepage` is the docs or GitHub, so none changes.
- The playground and the docs still build into the same `dist/`.
- In a browser, on the dev server and on the built site: the root
  redirects, an old `/#crumb-chase` link plays Crumb Chase at its address,
  Back and Forward go between the wall and the entry, a card's link is the
  entry's address and keeps the search, reloading an entry's address plays
  it again, and the 404 page lands on the wall, keeping the search.

### Still to check after deploying

- How a shared entry link previews in a few real places (a chat app, a
  social site), and with an Open Graph debugger.
- That Pages serves `404.html` at a mistyped entry address, and the
  redirect at `https://yortus.com/mvt-games/`.

## Acceptance Criteria

- [x] The Arcade is at `<base>arcade/`, and `<base>` redirects to it,
  keeping the query
- [ ] While an entry plays, the address bar shows its own address
  (`<base>arcade/<id>/`), and that address previews with the entry's name,
  summary and picture (the address and the tags are done; the preview is
  checked after deploying)
- [x] Opening that address, or reloading it, plays the entry in the Arcade
- [ ] Back and Forward move between the wall, the info panels and the entry
  as they do now (checked for the wall and the entry, not yet by hand for
  the info panels)
- [x] An old `<base>#<id>` link plays the entry and shows its new address
- [x] The nav links in the Arcade, the playground and the docs reach each
  other from every page, an entry's page included
- [x] The pages are generated from the catalogue, never written by hand, and
  the build fails if an entry's address collides with another of the site's
- [x] `npm run dev` serves the redirect, the Arcade and each entry's address

## Progress Log

- 2026-10-05: Created from 036's step 10.
- 2026-10-16: Replanned. Redirect stubs would never be shared, since the
  address bar would still show the fragment. Each entry's page is now a copy
  of the Arcade at the entry's own path, and the Arcade writes that path as
  the entry plays.
- 2026-10-18: Decided where the pages live. The Arcade moves to
  `<base>arcade/`, and `<base>` redirects to it. An entry's address is the
  Arcade's with the entry's id added (`<base>arcade/foo/`), not a separate
  `/play/` folder.
- 2026-10-18: Built in the `arcade-paths` worktree. The Arcade's page moved
  to `packages/sites/arcade/arcade/index.html`, and the site's root page
  became the redirect. A new Vite plugin writes the entries' pages and the
  404 page, and serves entries' addresses on the dev server. `main.ts`
  follows the path, with `parseEntryPath` and `formatEntryPath` in the
  Arcade's models (unit tested). Lint, the type check, the unit tests and
  the home page's budget pass, and a headless browser walked the addresses
  on the dev server and the built site.
