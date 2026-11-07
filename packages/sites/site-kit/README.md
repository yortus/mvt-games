# The Site Kit

> What the three sites share: the Arcade, the Demos and the Puzzles. Each
> site is a small package that lists its own entries. Everything else is
> here: the page they all run, the host that runs an entry, the views entries
> share, the highscores, and the build.

**Related:** [The page](./src/arcade/README.md) ·
[Adding an Entry](../arcade/src/entries/README.md) ·
[The highscores Worker](./highscores-worker/README.md)

## What Is Here

| Where | What | A site imports it as |
| --- | --- | --- |
| [`src/arcade/`](./src/arcade/README.md) | The page each site runs: its model, its views, its styles, and its loop | `@mvtjs/site-kit/arcade`, and `@mvtjs/site-kit/site-page` for `startSitePage` |
| [`src/entry-types/`](./src/entry-types/) | What an entry is, and how it starts | `@mvtjs/site-kit/entry-types` |
| [`src/runner/`](./src/runner/) | The entry host, which runs one entry of any renderer, and the page's sound | `@mvtjs/site-kit/runner` |
| [`src/shared/`](./src/shared/) | The views entries share (overlay, pixel text, input, swipes, drags), `listenToPointer`, and the chip types views play on | `@mvtjs/site-kit/shared` |
| [`src/pixel-glyphs/`](./src/pixel-glyphs/) | Every printable character as rows of cells, which entries draw their own way | `@mvtjs/site-kit/pixel-glyphs` |
| [`src/highscores/`](./src/highscores/) | The highscore tables' rules, and the page's stores | `@mvtjs/site-kit/highscores` |
| [`src/storage/`](./src/storage/), [`src/device/`](./src/device/), [`src/input/`](./src/input/) | What the page keeps between visits, what the device supports, and input with no renderer: the keyboard, and taps and drags over a grid | `@mvtjs/site-kit/storage` and so on |
| [`src/snapshot/`](./src/snapshot/) | The page `generate-thumbnails` photographs each entry on | `@mvtjs/site-kit/snapshot` |
| [`src/testing/`](./src/testing/) | `describeCatalogue`: the checks every site's catalogue passes | `@mvtjs/site-kit/testing` |
| [`scripts/`](./scripts/) | `defineSiteConfig`, which each site's `vite.config.ts` exports, its plugins, the one dev server, and the thumbnail, texture and pixel-font scripts | `@mvtjs/site-kit/vite` |
| [`highscores-worker/`](./highscores-worker/README.md) | The Cloudflare Worker that keeps the highscore tables | |

Inside the kit, `#shared`, `#highscores` and `#pixel-glyphs` are aliases for
its own folders, which its `package.json` defines.

## A Site

Each site is the same small package. Its `src/site.ts` says what it is:

```ts
export const SITE: SiteConfig = {
    id: 'demos',
    name: 'MVT Demos',
    label: 'Demos',
    wordmark: 'DEMOS',
    about: 'Demos and art, each built with Model-View-Ticker (MVT)...',
    catalogue: CATALOGUE,
    entryKind: 'demo',
};
```

Its `src/main.ts` starts the page with it, `startSitePage(SITE)`, and its
`vite.config.ts` is one line, `defineSiteConfig({ site: 'demos', root:
import.meta.dirname })`. The site is built into `dist/demos/`, at the
address `<root>demos/`, with a page of its own for each entry, at
`<root>demos/<id>/`.

The arcade is the site's root: its build also writes the root's
`index.html`, which sends visitors on to it, and a `404.html` that sends an
address to the wall of the site whose folder it is in. Entries that moved
from the arcade to another site keep their old addresses, which send
visitors on (`movedEntries`, in its `vite.config.ts`).

The sites share one origin, so what the page keeps in the visitor's browser
(the favourites, the saved games, the sound settings, the theme) is the same
on each.

## Themes

Each site has a theme of its own (`SITE_THEMES`, in
[`src/arcade/site-config.ts`](./src/arcade/site-config.ts)): the arcade
Arcade, the demos Dark, the puzzles Light. The visitor can choose one for
every site from the palette in the nav. The themes are CSS custom
properties, in `src/arcade/themes.css` and `theme-*.css`. See
[the page's README](./src/arcade/README.md#10-themes-a-setting-the-stylesheet-follows).

## Running the Sites

`npm run dev`, from the repo's root, runs
[`scripts/run-dev-server.ts`](./scripts/run-dev-server.ts): one server, at
:5173, with each site's own Vite, the playground's and VitePress's for the
docs mounted under their paths. `npm run dev -w @mvtjs/demos` runs one site
alone.

To make a site's thumbnails and its wall's link preview:

```bash
npm run generate-thumbnails -w @mvtjs/demos           # every entry, and the wall
npm run generate-thumbnails -w @mvtjs/demos -- boids  # one entry
npm run generate-thumbnails -w @mvtjs/demos -- demos  # the wall alone
```
