# Link Previews for Each Entry

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-05 |
| Updated  | 2026-10-16 |

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

- **Each entry's address is a path: `/<id>/`.** At build time, a small Vite
  plugin copies the built `index.html` to `dist/<id>/index.html` for each
  catalogue entry, with the entry's own `<title>`, `og:title`,
  `og:description`, `og:image` and `og:url`. The copy is the Arcade, not a
  redirect: the built page's asset URLs are absolute (they carry
  `BASE_URL`), so it works one level down unchanged. Pages serves each copy
  as a plain file, so no rewriting is needed.
- **The Arcade reads and writes the path, not the fragment.** `writeUrl` in
  `arcade/main.ts` pushes `<base><id>/<query>` as an entry plays, and leaving
  returns to `<base><query>`. Every copy is the same page, so these steps
  never reload. `launchFromFragment` becomes `launchFromPath`, run on load and
  on `popstate`; the `hashchange` listener goes. The page's title follows the
  entry playing, for bookmarks and history.
- **Old links keep working.** On load, a fragment that names an entry is
  rewritten to its path with `replaceState`, and the entry launches.
- **A 404 page.** `dist/404.html` is a copy of the Arcade too, so a mistyped
  or retired entry's address lands on the wall rather than Pages' own 404.
  It needs the same care as the others: its asset URLs must be absolute.
- **The dev server.** Vite runs with `appType: 'mpa'`, so it does not fall
  back to `index.html` for `/crumb-chase/`. A small middleware, like
  `trailingSlashPlugin`, serves the Arcade's page for a path that names a
  catalogue entry.

This reverses proposal [036](../../archive/036-website-arcade.md)'s
decision (section 12, question 5) that entries stay on fragments. Only
`writeUrl` and `launchFromFragment` read or write the fragment today.

### To decide

- `/<id>/` or `/play/<id>/`. The bare path is shorter to share. If it is
  chosen, the build fails when an entry's id is a top-level folder of the
  site (`docs`, `playground`, `assets`, or any other the build writes).
- Whether `og:image` wants a bigger picture than the card's thumbnail
  (previews are commonly 1200 by 630), and whether it should be a PNG or
  JPEG: not every site that builds previews reads WebP.
- Whether an open info panel should also have its entry's address, so a
  link copied while it is open previews as that entry. Today a panel's
  history step keeps the wall's URL.

### To check

- Anything at run time that builds a URL relative to the page, rather than
  from `import.meta.env.BASE_URL`, breaks one level down. Search for
  relative `fetch`es, `new URL(...)` with `location`, and links in the
  Arcade's HTML.
- The home page's size budget (`check:home-page-budget`) still measures the
  right page.
- The playground and the docs are unaffected.

## Acceptance Criteria

- [ ] While an entry plays, the address bar shows its own address, and that
  address previews with the entry's name, summary and picture
- [ ] Opening that address, or reloading it, plays the entry in the Arcade
- [ ] Back and Forward move between the wall, the info panels and the entry
  as they do now
- [ ] An old `/#<id>` link plays the entry and shows its new address
- [ ] The pages are generated from the catalogue, never written by hand, and
  the build fails if an entry's address collides with another of the site's
- [ ] `npm run dev` serves each entry's address

## Progress Log

- 2026-10-05: Created from 036's step 10.
- 2026-10-16: Replanned. Redirect stubs would never be shared, since the
  address bar would still show the fragment. Each entry's page is now a copy
  of the Arcade at the entry's own path, and the Arcade writes that path as
  the entry plays.
