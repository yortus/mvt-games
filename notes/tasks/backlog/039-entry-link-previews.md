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
  `<base>arcade/foo/`. The code works an entry's address out from the
  Arcade page's own path, never from `<base>`, so moving the Arcade again
  would move its entries with it.
- **Each entry's page is a copy of the Arcade.** At build time, a small Vite
  plugin copies the Arcade's built page to `dist/arcade/<id>/index.html` for
  each catalogue entry, with the entry's own `<title>`, `og:title`,
  `og:description`, `og:image` and `og:url`. The copy is the Arcade, not a
  redirect. Pages serves each copy as a plain file, so no rewriting is
  needed. The build fails if an id collides with a folder the build writes
  into `dist/arcade/` itself.
- **The Arcade reads and writes the path, not the fragment.** `writeUrl` in
  `arcade/main.ts` pushes `<arcade><id>/<query>` as an entry plays, and
  leaving returns to `<arcade><query>`, where `<arcade>` is the Arcade
  page's path. Every copy is the same page, so these steps never reload.
  `launchFromFragment` becomes `launchFromPath`, run on load and on
  `popstate`; the `hashchange` listener goes. The page's title follows the
  entry playing, for bookmarks and history.
- **A 404 page.** `dist/404.html` is a copy of the Arcade too, so a mistyped
  or retired entry's address lands on the wall rather than Pages' own 404.
  Pages serves it at the address that was asked for, so the Arcade rewrites
  that address to the wall's.
- **The site's links follow the Arcade.** The nav in the Arcade's page links
  relative to the page (`./`, `./docs/`, `./playground/`), which breaks both
  at `<base>arcade/` and one level further down in an entry's page. Its
  links become absolute, built from `<base>`. The playground's nav
  (`../`) and the docs' (`__SITE_ROOT__` in `.vitepress/theme/index.ts`)
  link to the Arcade at its new address rather than through the redirect.
- **The dev server.** Vite runs with `appType: 'mpa'`, so it does not fall
  back to an HTML page for `/arcade/crumb-chase/`. A small middleware, like
  `trailingSlashPlugin`, serves the Arcade's page for a path that names a
  catalogue entry. `/` serves the redirect page, as `<base>` does on Pages.

This reverses proposal [036](../../archive/036-website-arcade.md)'s
decision (section 12, question 5) that entries stay on fragments, and its
plan for the Arcade to be the site's root page. Only `writeUrl` and
`launchFromFragment` read or write the fragment today.

### To decide

- Whether `og:image` wants a bigger picture than the card's thumbnail
  (previews are commonly 1200 by 630), and whether it should be a PNG or
  JPEG: not every site that builds previews reads WebP.
- Whether an open info panel should also have its entry's address, so a
  link copied while it is open previews as that entry. Today a panel's
  history step keeps the wall's URL.

### To check

- Anything else at run time that builds a URL relative to the page, rather
  than from `import.meta.env.BASE_URL`, breaks at the new depth. Search for
  relative `fetch`es, `new URL(...)` with `location`, and links in the
  Arcade's HTML. The entries' texture registries already use `BASE_URL`.
- `check:home-page-budget` (`packages/tests/checks/scripts/home-page-budget.ts`)
  measures `dist/arcade/index.html`, not the redirect page.
- What else names the Arcade's address: the thumbnail script
  (`scripts/generate-thumbnails.ts`), `measure-load` usage notes, the
  READMEs and docs that link to the site. Every package's `homepage` is the
  docs or GitHub, so none changes.
- The playground and the docs still build and deploy into the same `dist/`.

## Acceptance Criteria

- [ ] The Arcade is at `<base>arcade/`, and `<base>` redirects to it,
  keeping the query
- [ ] While an entry plays, the address bar shows its own address
  (`<base>arcade/<id>/`), and that address previews with the entry's name,
  summary and picture
- [ ] Opening that address, or reloading it, plays the entry in the Arcade
- [ ] Back and Forward move between the wall, the info panels and the entry
  as they do now
- [ ] An old `<base>#<id>` link plays the entry and shows its new address
- [ ] The nav links in the Arcade, the playground and the docs reach each
  other from every page, an entry's page included
- [ ] The pages are generated from the catalogue, never written by hand, and
  the build fails if an entry's address collides with another of the site's
- [ ] `npm run dev` serves the redirect, the Arcade and each entry's address

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
