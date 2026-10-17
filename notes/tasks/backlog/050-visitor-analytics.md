# Visitor Analytics: Who Comes, and From Where

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-15 |
| Updated  | 2026-10-15 |

## Description

Nothing records who visits the site or where they come from. The site is on
GitHub Pages, which gives no server logs. The owner wants enough to trace a
burst of visitors back to where the project was mentioned, such as a Reddit
thread. It must be free, unobtrusive and light, with no cookies and no cookie
banner.

This came up when v-snap was added to Awesome Vitest (porada/awesome-vitest)
about 17 hours after it was first published, before it had been announced
anywhere. Its maintainer appears to watch npm for new packages with the
`vitest` keyword.

### Analytics on the site

Cloudflare Web Analytics is the pick. It is one `<script>` tag, free, and
sets no cookies. It reports referring sites, pages, countries, and device and
browser types. It works on GitHub Pages without moving DNS, and the owner
already has a Cloudflare account for the highscores Worker. GoatCounter is
the alternative: open source, free for non-commercial sites, and good at
referrers.

Points to settle while adding it:

- **Which pages.** The Arcade (`packages/sites/arcade/index.html`), the playground
  (`packages/sites/playground/index.html`, a package of its own since 052,
  built into `dist/playground/`) and the docs (VitePress, built into the same
  Pages site by `deploy.yml`) each need the tag, or a decision to leave one
  out. The playground's sandbox runs visitors' code in an iframe of its own,
  which should not report.
- **Production only.** The test deploy to Surge (`test-deploy.yml`) and the
  dev server should not report. Passing the site token only in `deploy.yml`,
  for example as a `VITE_` variable, and adding the tag only when it is set,
  would do it.
- **The home page's size budget.** The script loads from Cloudflare,
  asynchronously, so it should not count against the budget, but check.
- **The move to yortus.com/mvt-games.** If that domain goes through
  Cloudflare, its built-in traffic analytics counts every request at the
  edge, with no script. It is coarser, but ad blockers cannot hide visits
  from it, so it is a useful cross-check.

### Finding the mentions themselves

Browsers usually send only the referring site, not the page, so analytics
shows "reddit.com" but not which thread. Mobile apps (Reddit, Discord,
Slack) often send nothing, and those visits show as direct. Some ad blockers
block the script, so counts run low.

To find the thread itself, F5Bot is free and emails when a keyword appears on
Reddit, Hacker News or Lobsters. Candidate keywords: `mvt-games`, `v-snap`,
`yortus.com/mvt-games`, `mvtjs`.

### Already available

- **GitHub's traffic page.** The repo's Insights, then Traffic, shows
  referring sites and popular pages for the repo (not the site), for the
  last 14 days only.
- **npm downloads.** v-snap's npm page, and `api.npmjs.org/downloads`.
  Early counts include many bots and mirrors, so read them as a trend.

## Acceptance Criteria

- [ ] Cloudflare Web Analytics (or GoatCounter) reports visits to the live
      site, from production builds only, or the item is dropped.
- [ ] The Arcade, the playground and the docs each report, or are left out
      on purpose.
- [ ] F5Bot alerts are set up for the project's names, or the item is
      dropped.
- [ ] After the move to yortus.com/mvt-games, the domain's own Cloudflare
      analytics is checked as a cross-check, or the item is dropped.

## Progress Log

- **2026-10-15.** Created from a conversation about how v-snap reached
  Awesome Vitest so quickly. Nothing is set up yet. The site token comes from
  the Cloudflare dashboard, which only the owner can create.
