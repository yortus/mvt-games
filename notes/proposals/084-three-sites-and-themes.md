# Proposal: three sites, and themes for them

> Split the Arcade's package into three sites: `arcade` (the arcade games),
> `demos` (every demo) and `puzzles` (Sudoku now, more puzzles later). They
> share almost all their code: the page, the entry host, the shared views,
> the highscores, the build's plugins. That code moves into a fourth package,
> `site-kit`, which the three import. Then give the sites themes: the
> current look becomes **Arcade**, and two new ones join it, **Dark**
> (quiet, modern) and **Light** (warm paper and ink). They were first named
> Studio and Paper, as most of this proposal still calls them. A visitor
> picks one setting, which every site follows: **Default**, where each site
> wears its own theme (the arcade Arcade, the demos Dark, the puzzles
> Light), or one of the three, worn by all of them.

**Status:** implemented, uncommitted in the main checkout (2026-11-01).
Part A (the split, the flat tags, the one dev server) and Part B (the
themes, Arcade, Studio and Paper) are done. Follow-ons are listed at the end
of section 15.

**Written:** 2026-11-01, on `vnext` at `adba8e48`, against
`packages/sites/arcade/` as it is that day: 24 entries, 188 colour literals
in `arcade.css`, the dev servers in `scripts/run-dev-servers.ts`, the build
in `vite.config.ts` and `.github/workflows/deploy.yml`.

**Related:**
[the Arcade's page](../../packages/sites/arcade/src/arcade/README.md),
[Adding an Entry](../../packages/sites/arcade/src/entries/README.md),
[the playground's themes](../../packages/sites/playground/src/views/themes.ts)
(the one precedent in the repo, written to the page from TypeScript),
[036](../archive/036-website-arcade.md) and
[052](../archive/052-playground-ide.md) (the earlier splits of the website),
[081](../tasks/active/081-sudoku-digger-demo.md) and
[082](../tasks/active/082-sudoku-daily-game.md) (the Sudoku pair, which
share grid code).

| Decision | Recommendation | Section |
| --- | --- | --- |
| Where the shared code goes | A fourth private package, `packages/sites/site-kit/` (`@mvtjs/site-kit`). Putting it in `demos` works, but costs more than it saves | 2 |
| What moves where | The 11 games stay in `arcade`; the 12 demos go to `demos`; Sudoku goes to `puzzles`. Fenceline and Kwazy Cactii stay arcade games | 3 |
| Sudoku and its Digger | The grid code moves into Sudoku (`puzzles`); the Digger stays a demo and imports it. `demos` may depend on `puzzles`, never the reverse | 3.2 |
| The page | One page app in the kit, started by each site with its own config: name, catalogue, wordmark, default theme | 4 |
| URLs | `arcade/<id>/`, `demos/<id>/`, `puzzles/<id>/`. A moved entry's old address redirects | 5 |
| Visitor data | Unchanged keys (`mvt-arcade:*`). One origin, so favourites, saves, sound and the theme are shared by all three | 5.3 |
| Tags | A flat list of eras and genres. `kind` leaves the tags: the site says whether its entries are games or demos | 4.1 |
| Build and dev | Each site builds into its own folder of `dist/`. In development, one server on :5173 mounts all five sites' Vite servers as middleware | 6 |
| The two new themes | **Studio** for demos, **Paper** for puzzles | 8 |
| What a theme is | Colours and type in CSS custom properties, plus a few choices views make: the wordmark, the card's frame, the wall's way out, the way into an entry | 9 |
| The setting | `'default' \| ThemeKind`, in the page's model beside the sound settings, saved like them, followed across tabs | 10 |
| First paint | An inline script sets `data-theme` before the stylesheets load, so Paper never flashes dark | 10.3 |
| Entries | Not themed. Their screens keep their own looks | 11 |

---

# Part A: Three Sites

## 1. Why

The Arcade lists games and demos together, and puzzles are coming. They
want different things from a page. Games want the cabinet: the marquee,
attract mode, highscores. Demos are watched and read about. Puzzles are
calm, played for longer, and return daily. Three sites, each with its own
wall, name and look, let each be what it is, while sharing everything that
runs an entry.

## 2. Where the Shared Code Goes

Nearly everything in `packages/sites/arcade/src/` other than `entries/` is
shared: the page app (`arcade/`), `entry-types/`, `runner/`, `shared/`,
`pixel-glyphs/`, `input/`, `device/`, `storage/` and `highscores/`. So are
most of `scripts/` (the Vite plugins, the thumbnail and pixel-font
generators, the dev-server runner) and the highscores Worker.

### 2.1 In `demos`: feasible

It would work. npm links workspace packages, so `arcade` and `puzzles`
declare `"@mvtjs/demos": "*"` and import its barrels through `exports`, as
the benchmarks import `@mvtjs/arcade/entries` today. The sites are source
only, so nothing needs building first. There is no cycle as long as `demos`
never imports `arcade` or `puzzles`, which lint's declared-dependency rule
already enforces.

### 2.2 But a fourth package is better

- **The cost is the same.** In both designs the shared code leaves
  `arcade`, and every import of it is rewritten. The fourth package adds one
  `package.json`, one `tsconfig.json` and one README, nothing more.
- **Game-only code.** The highscores (client, rules, Worker, the initials
  prompt) serve games. Demos have none. In `demos`, the demos site would
  hold, and deploy scripts for, a Worker it never uses.
- **One direction, enforced.** A kit that lists no site in its dependencies
  cannot import one by accident. Inside `demos`, the page app sits beside the
  demos' catalogue, and nothing stops it reaching in.
- **Three alike sites.** Each site is the same thin shape (section 4), so
  any one of them is the template for the next.
- **Sudoku.** It needs the Digger's grid (section 3.2), so either `demos`
  depends on `puzzles` or the reverse. With the kit in `demos`, the edge must
  run `puzzles` to `demos`, so the kit's host also hosts a puzzle's code.

**Recommendation:** `packages/sites/site-kit/`, named `@mvtjs/site-kit`,
private. It sits under `sites/` because it ships, as part of each site.

### 2.3 How imports change

Between packages, the convention is the package's name. So
`../../../runner` and `#shared` in an entry become `@mvtjs/site-kit/runner`
and `@mvtjs/site-kit/shared`. A script does the rewrite: 76 entry files
import shared code by relative path, 54 through `#shared`. `#pixel-glyphs`
and `#highscores` become kit subpaths too. `#tunes` is used by the Tune
Tracker alone, so it moves with it to `demos`.

## 3. What Moves Where

| Site | Entries |
| --- | --- |
| `arcade` | astrovoid, burrow-bust, crumb-chase, deep-dive, dojo-duel, fenceline, fuel-run, galaxy-raiders, garden-snake, kwazy-cactii, neon-monsoon (11) |
| `demos` | boids, boids-3d, coral, double-pendulum, falling-sand, fireworks, fractal-forest, fractalscope, fruit-machine, reordering-lists, sudoku-digger, tune-tracker (12) |
| `puzzles` | sudoku (1) |

Each entry's texture script (`scripts/generate-<id>-textures.ts`) moves to
its site's `scripts/`.

### 3.1 Puzzle-genre arcade games

Fenceline and Kwazy Cactii are tagged `puzzle`, but they are action games
played against the clock with highscores. They stay arcade games. The
`puzzles` site is for puzzles you sit with.

### 3.2 Sudoku and the Digger

Sudoku imports the Digger's grid code (`#sudoku-digger`). The grid belongs
to the game; the Digger is a demo of the game's solver. So the grid moves
into Sudoku, exported from `@mvtjs/puzzles`, and the Digger imports it from
there. `demos` may depend on `puzzles`; `puzzles` never on `demos`.

## 4. The Site Shape

Each site is thin:

```
packages/sites/<site>/
├── index.html          the page: the nav, and a script that starts the page app
├── src/
│   ├── main.ts         startSitePage(SITE)
│   ├── site.ts         SITE: name, wordmark, catalogue, default theme, about text
│   └── entries/        its entries and catalogue.ts
├── scripts/            its entries' texture scripts
├── share.jpg           its link preview
├── vite.config.ts      defineSiteConfig({ site: 'demos', ... }), from the kit
└── vsnap.config.ts
```

`arcade` also keeps the site's root (`index.html`, which redirects to
`arcade/`, and `404.html`).

The page app takes the site as data:

```ts
export interface SiteConfig {
    /** The site's folder and id: 'arcade', 'demos' or 'puzzles'. */
    readonly id: SiteKind;
    /** Its title: 'MVT Arcade'. */
    readonly name: string;
    /** What its marquee spells. */
    readonly wordmark: string;
    readonly catalogue: readonly ArcadeEntry[];
    /** What its entries are: games are played, demos watched (section 4.1). */
    readonly entryKind: EntryKind;
    readonly defaultTheme: ThemeKind;
}
```

`main.ts`'s body becomes `startSitePage(site)` in the kit. Its
`ARCADE_PATH` becomes `${BASE_URL}${site.id}/`.

### 4.1 Simpler tags

Today an entry's tags have three parts: `kind` (game or demo, exactly one),
`era` (at most one) and `genres` (any number). After the split, the site
says what kind of entry it holds, so `kind` leaves the tags. It moves to the
site's config as `entryKind` (arcade and puzzles `'game'`, demos `'demo'`),
where the page reads it for what only games get: the touch controls' room,
turning on a phone, pixel-art scaling, the How to Play checks.

What is left is one flat list:

```ts
readonly tags: readonly EntryTag[];   // ['shooter', 'scrolling', '1980s']
export type EntryTag = Era | Genre;
```

No tag excludes another any more. An entry still has at most one era, but
the search already requires every tag chosen, two from one group included,
so choosing two eras finds nothing, today and after. The suggestions still
show eras and genres under their own labels, worked out from which list a
tag is in (`ERAS`, `GENRES`), not stored with the entry. The renderers stay
measured facts, offered as tags as now.

**Names.** The page app's names (`ArcadeModel`, `ArcadeView`,
`ArcadeEntry`) stay for now. Renaming them (`SiteModel`, `SiteEntry`) is a
separate, mechanical step, worth it only if the old names confuse; see the
open questions.

## 5. URLs, Links and Visitor Data

### 5.1 Addresses

`<base>arcade/`, `<base>demos/`, `<base>puzzles/`, each with
`<id>/` below it, as today. The nav lists Arcade, Demos, Puzzles, Docs,
Playground; the docs' and the playground's copies of the nav gain the two
links.

### 5.2 Old addresses

A demo's old address (`arcade/boids/`) and Sudoku's must keep working. The
arcade's build writes a small redirect page at each moved entry's old path,
as the root `index.html` already redirects. The `404.html` sends a path in
`demos/` or `puzzles/` to that site's wall, not the arcade's.

### 5.3 What the visitor keeps

The three sites share one origin, so `localStorage` is shared. The keys
stay as they are (`mvt-arcade:favourites`, `mvt-arcade-sound`, saved games
by entry id). Renaming them would lose every visitor's settings. The
favourites, the saved games and the sound settings follow the visitor
between sites for free, and so will the theme.

The highscores Worker's durable object keeps its name (`'arcade'`) for the
same reason.

## 6. Build and Development

### 6.1 Build

Each site builds into `dist/<site>/`. Only the arcade's build empties
`dist/`, as now, so it goes first. The root `build` script and
`deploy.yml` gain `build -w @mvtjs/demos` and `-w @mvtjs/puzzles`.

The kit exports `defineSiteConfig`, which holds what `vite.config.ts` holds
today (the conditions, the spritesheet, entry-facts and entry-pages
plugins, the trailing slash) with the site's folder as the output and the
base.

### 6.2 Development: one server

Today `npm run dev` starts three servers (the Arcade's at :5173, which
proxies the docs' at :5200 and the playground's at :5300). Two more sites
would make five. Instead, one server: a single Node process on :5173 that
mounts each site's Vite dev server as middleware (`server.middlewareMode`)
under its own path: `/arcade/` (and the site's root), `/demos/`,
`/puzzles/`, `/playground/`, and the docs at `/docs/`, through VitePress's
own `createServer`, which is Vite underneath. Each Vite instance keeps its
own config, the same one its build uses, so development and the build
cannot drift apart. Their HMR WebSockets share the one HTTP server, each on
its own base path.

One process, one port, one origin, so the visitor's settings are shared in
development as they will be live. It replaces `run-dev-servers.ts`, the
proxy and its "not running" page. `npm run dev -w <site>` still runs one
site alone, on its own port.

Two things need a spike first (step 6 of section 14): that Vite's HMR
sockets can share one server by base path, and that VitePress runs in
middleware mode. If VitePress will not, the docs stay a proxied second
process: two servers, not five.

One fix is needed either way: the spritesheet plugin serves atlases at a
root-absolute `/assets/<name>-textures.*` in development. With the sites
under their own paths, it must match the site's base.

### 6.3 Checks and CI

| What | Change |
| --- | --- |
| `check:home-page-budget` | Run for each site's page, each within the 60 KB budget |
| `check:link-previews` | Entry pages in any of the three folders |
| `check:one-copy-of-utils` | One site per folder, not "dist minus docs and playground" |
| `vitest.config.ts` | A `vsnap()` per site and one for the kit |
| `eslint.config.ts` | The arcade globs cover the four packages |
| `tsconfig.json` | References for the four, and the Worker's new place |
| `deploy-highscores.yml` | Paths into the kit |
| Benchmarks | Games from `@mvtjs/arcade`, the three demos from `@mvtjs/demos`, the entry types from the kit |

### 6.4 Docs

20 docs pages link into `packages/sites/arcade/src/` on GitHub (54 links),
mostly to `arcade/views` and to entries. A script rewrites them by the
table in section 3. `AGENTS.md`, `README.md`, the project-structure page,
the entries' guide and `notes/README.md`'s paths paragraph are updated by
hand. The Arcade README moves with the page app into the kit.

---

# Part B: Themes

## 7. Why

The Arcade's look is loud on purpose: yellow on navy, candy cards,
polaroids taped at a tilt, a wall that burns, a screen that powers on like
a tube. It suits arcade games. It suits a page of fluid simulations less,
and a puzzle you play over breakfast not at all. And some visitors want a
light page, whatever the site.

## 8. The Two New Themes

Two directions you suggested were "modern or slick" and "paper". The
recommendation takes one of each, since together with Arcade they cover
what a visitor most likely wants: loud and dark, quiet and dark, and light.

- **Studio**, for the demos. Dark, calm and modern, like a creative tool's
  interface. Graphite rather than navy, one cool accent, the system UI font
  throughout, rounded tiles, soft shadows, motion that glides rather than
  burns. It frames each demo's screen as the work, with nothing competing.
- **Paper**, for the puzzles. Light, like a newspaper's puzzle page: warm
  newsprint, ink-black text, hairline rules, serif headlines, a red-pencil
  accent. Cards are clippings. It reads as calm and familiar, the place
  puzzles have always lived.

Runners-up, if either misses: **Gallery** (light and white-walled, demos
hung as framed pieces with museum labels), which could stand in for Studio
if you want the demos light; and **Neon** (synthwave), which is a louder
Arcade, so it adds less.

## 9. What a Theme Changes

| Part | Arcade (as now) | Studio | Paper |
| --- | --- | --- | --- |
| Scheme | Dark | Dark | Light |
| Page and panels | Near-black navy | Graphite, raised panels a step lighter, translucent menus | Warm newsprint; white sheets with hairline rules |
| Nav | Yellow on deep blue, pixel-font name | Light grey on near-black, one accent for the active link | Ink on paper, rule beneath |
| Type | Pixel font for names and scores, system UI for text | System UI throughout; tabular numerals for scores | Serif headlines (system serif stack), system UI text, typewriter monospace for scores |
| Wordmark | Pixel marquee, extruded in orange | The name in the UI font, semibold, with an accent dot | Masthead: serif small caps over a double rule |
| Card | Candy colour, taped tilted polaroid, pixel title | Flat tile, picture full-bleed with rounded corners, title in the UI font, lifts with a shadow when selected | Clipping: paper card, picture in a thin ink frame, headline title, no tilt |
| Card colour | Candy palette, the card's background | A thin stripe in a deepened candy | A highlighter swipe in a muted candy, behind the title |
| Leaving the wall | Cards burn away (shader) | Cards fade and sink | Cards fade (a fold, later) |
| Into an entry | Picture floats, tube powers on | Picture grows into the play area as the page dims | The quiet way, as for reduced motion |
| Highscores, initials | Pixel font | UI font | Typewriter |

No theme loads a web font. They use system font stacks, so the home page
stays within its budget, and only the pixel font (already loaded) is
shared.

Studio's translucent menus use no backdrop blur. A blur over a running
WebGL canvas costs every frame on a phone; plain translucency looks almost
as good.

### 9.1 Colours and type: CSS custom properties

Each theme is a block of custom properties in its own CSS file
(`themes/arcade.css`, `studio.css`, `paper.css`), under
`:root[data-theme="paper"]`. Every colour, font, radius and shadow in
`arcade.css` and `nav.css` is read through a `--theme-*` property. That is
the first step: 188 literals become tokens, with the Arcade's values, and
no image changes, which the visual tests prove.

CSS holds the values, unlike the playground, which writes them from
TypeScript. Themes here change fonts, radii and shadows as well as colours,
and CSS has to know the theme before any script runs (section 10.3).

The candy palette (`CARD_COLOR_VALUES`) becomes nine properties per theme
(`--theme-candy-mint`), so a card names its colour and the theme says what
it is.

### 9.2 Choices views make: the `Theme` record

Some parts are drawn by views, not styled by CSS. Those read a record:

```ts
export interface Theme {
    readonly kind: ThemeKind;
    readonly name: string;
    readonly scheme: 'dark' | 'light';
    /** How the site's name is drawn. */
    readonly wordmark: 'marquee' | 'plain' | 'masthead';
    /** How cards leave the wall, and come back. */
    readonly wallEffect: 'burn' | 'sink' | 'fade';
    /** How the picture goes into an entry, and back. */
    readonly wayIn: 'tube' | 'grow' | 'quiet';
}
```

The quiet way in exists already, for visitors who ask for less motion
(`isMotionReduced` in the transition view model), so Paper costs nothing
there. Reduced motion still wins over any theme's way in.

### 9.3 Contrast

A unit test reads each theme's CSS and checks its text and background
pairs reach WCAG AA (4.5:1 for text, 3:1 for large text and controls).
Paper is the theme most at risk: its muted text on newsprint.

## 10. The Setting

### 10.1 In the model

The theme is a visitor setting, like the sound, so it lives in the page's
model beside `soundSettings`:

```ts
export type ThemeKind = 'arcade' | 'studio' | 'paper';
export type ThemeChoice = 'default' | ThemeKind;

readonly themeChoice: ThemeChoice;
/** The theme the page wears: the choice, or the site's own for 'default'. */
readonly theme: ThemeKind;
readonly chooseTheme: (choice: ThemeChoice) => void;
```

The page saves the choice under `mvt-arcade:theme` when it changes, as it
saves the sound, and reads it back on load. It listens for the `storage`
event, so a choice made in another tab, on another site, is followed at
once.

### 10.2 In the views

A small view sets `data-theme` and `color-scheme` on `<html>` in its
refresh step, when the theme changes. Views that draw differently per
theme (the wordmark, the card, the wall effect, the transition) take
`theme: () => Theme` as a binding.

The picker is a button in the nav's tools, beside the sound: a palette icon
that drops a menu of four, Default first, each with a small swatch. The
Default line names what it means here ("Default (Paper)").

### 10.3 First paint

Each page's `<head>` has, today, `<style>html { background: #0d1117; color-scheme: dark; }</style>`
so the page is dark from the first frame. With Paper, that would flash.
Instead, an inline script reads the saved choice and sets `data-theme` and
the background before any stylesheet loads. It knows the site's default
from the page it is in. A few lines, with storage blocked handled as
"default".

## 11. What Is Not Themed

- **Entries.** Each entry draws its own screen in its own style; a theme
  frames it. Sudoku in Paper might one day want ink on newsprint, which
  would need a theme binding passed to sessions. That is a later question.
- **The docs and the playground.** They keep the Arcade's nav colours. The
  docs' nav could follow the saved choice later; the playground has its own
  themes already.
- **The Arcade's own sounds.** Every theme plays the same blips for now.
  Softer sounds for Studio and Paper are a natural follow-on.

---

## 12. Risks

- **The split is wide.** Hundreds of files move and a few hundred imports
  change. Mitigation: scripted moves and rewrites, then lint, type-check,
  unit and visual tests, all of which must pass with no reference image
  changed, before anything else happens.
- **The single dev server.** It rests on two things not yet tried (section
  6.2). A missed root-absolute path shows only when the sites share a
  server, so the thumbnails script is run for one entry on each site as a
  check.
- **Theme drift.** Three themes triple the looks to keep right. Visual tests
  pose the views that differ (the card, the wordmark, a panel, the pause
  menu) once per theme.

## 13. Open Questions

1. ~~Shared code in `demos`, or a fourth package?~~ Settled 2026-11-01: a
   fourth package, `site-kit`. Under `sites/`, not `internal/`: `internal/`
   is what never ships, and the kit ships in every site's bundle. Imports
   name the package, never its path, so moving it costs three config lines.
2. ~~Theme names and directions?~~ Settled 2026-11-01: Studio and Paper.
3. ~~The Digger?~~ Settled 2026-11-01: it stays a demo, and imports the grid
   from Sudoku, in `puzzles`.
4. Rename the page app's types (`ArcadeEntry` to `SiteEntry` and so on)?
   Recommended later, or never.
5. The site's root: keep redirecting to the arcade, or a small landing page
   with the three sites as doors? Recommended: redirect for now.

## 14. Implementation Steps

Part A, the split. Each step leaves lint, the type-check and every test
passing, with no reference image changed.

1. ~~Create `packages/sites/site-kit/`: `package.json` (exports per barrel),
   `tsconfig.json`, README. Move the shared `src/` folders, the generic
   scripts, the Worker. Rewrite imports. The arcade still lists every entry.~~ Done.
2. ~~Make the page app take a `SiteConfig`; `arcade`'s `main.ts` calls
   `startSitePage`. Move `vite.config.ts`'s body into `defineSiteConfig`.
   Fix the atlas paths.~~ Done.
3. ~~Create `puzzles`: move Sudoku and the grid; repoint the Digger.~~ Done.
4. ~~Create `demos`: move the 12 demos, `#tunes` and their scripts.~~ Done.
5. ~~Redirects for moved entries, the 404 by folder, the nav's links in all
   five copies.~~ Done.
6. ~~The single dev server: a spike of two Vite instances and VitePress in
   middleware mode on one port, then the real thing. The root scripts, CI,
   checks, benchmarks, tsconfig, eslint, vitest.~~ Done.
6a. ~~The flat tags: `kind` to the site's config, `era` and `genres` into one
   `tags` list in every entry, the search's groups worked out from the lists.~~ Done.
7. ~~Docs, `AGENTS.md`, `README.md`, the notes' paths paragraph.~~ Done.

Part B, themes.

8. ~~Tokenise `arcade.css` and `nav.css` with the Arcade's values. No image
   changes.~~ Done.
9. ~~The setting: the model, saving, the `storage` event, the first-paint
   script, the `data-theme` view, the picker. Only Arcade defined.~~ Done.
10. ~~Paper: its tokens, then its wordmark, card and way in. Visual tests.~~ Done.
11. ~~Studio: the same.~~ Done.
12. ~~The contrast test. The site's defaults switched on: demos to Studio,
    puzzles to Paper.~~ Done.
13. ~~Docs: the page app's README on themes, a line in the entries' guide.~~ Done (the page's README section 10, the kit's README, `AGENTS.md`).

## 15. Progress

**2026-11-01, Part A, steps 1-6 in progress, in the main checkout.**

- Moved by script (`git ls-files --deleted` checked against the new places:
  781 files, 691 the same bytes, 90 differing only in import lines). 198
  imports rewritten, the rest by hand.
- Sudoku's grid and generator: the generator *is* the Digger's model
  (`generateSudoku` runs `createDiggerModel` to the end), so both moved into
  `puzzles/src/entries/sudoku/generator/`. Its barrel exports the model's
  types only, so Sudoku's chunk still loads the generator lazily
  (`loadSudokuGenerator`); the Digger imports the model's code from
  `@mvtjs/puzzles/sudoku-generator/models`.
- All three sites have the same shape: Vite base `<root><site>/`, the page
  at the package's root, built to `dist/<site>/`. The arcade's build also
  writes the root's `index.html` and a `404.html` that sends an address to
  the wall of the site whose folder it is in, and a redirect page at each
  moved entry's old address (`noindex`, so the link-preview check skips it).
- The nav is written into each site's page by the kit (`scripts/site-nav.ts`);
  the docs' and the playground's copies gained Demos and Puzzles.
- `startSitePage` is its own export (`@mvtjs/site-kit/site-page`), not in the
  `arcade` barrel: it imports `virtual:entry-facts`, which only a site's build
  has, and the catalogue tests import the barrel.
- The page's `nav.css` and the pixel font's `.woff` moved from `shared/` to
  `arcade/`, beside `arcade.css`: they are the page's styles.
- Spike for the single dev server: Vite 8.3 matches an HMR upgrade on a
  shared server by `pathname === base` (`createWebSocketServer`), so
  instances with different bases can share one; VitePress 1.6's
  `createServer(root, serverOptions)` passes `serverOptions` to Vite's
  `server`.
- Each site's wall picture (`src/share.jpg`) made with `generate-thumbnails`;
  the arcade's again, since its wall lost the demos.
- Flat tags: `tags: ['1980s', 'maze']`; `kind` moved to `SiteConfig.entryKind`.
  A link's old `?kind=` is ignored, and dropped as the URL is rewritten.
- Checked: `tsc -b`, lint, 3014 unit tests, 72 visual test files, `npm run
  build` with every check (each site's budget, one copy of utils per site,
  89 pages' link previews), and the walls photographed in a real browser
  from each site's own dev server. The one dev server served every route
  (root, slashless paths, moved entries, atlases under each base).
- One image matched within tolerance, not exactly: Sudoku's
  `puzzle-view.the-tutorial-its-arrow-tapping-a-second-digit-on-the-keypad.png`.
  Its reference is the same bytes as before the move, and Sudoku's code
  changed only in import lines; not rewritten.
- Left: the "Adding an Entry" guide stays in `arcade/src/entries/`, written
  for every site. `npm run preview` is gone: nobody used it. A stale
  `dist/assets/` from the old layout lingers locally until `dist/` is
  cleared (CI starts clean).

**2026-11-01, Part B done.**

- Step 8, by a sub-agent: 71 `--theme-*` properties in `themes.css` (the
  Arcade's, the default), 225 references in `arcade.css` and `nav.css`,
  each checked equal to the literal it replaced; the kit's 17 images and the
  arcade's and puzzles' walls byte-identical. `nav.css` keeps its `--site-*`
  names, now read from the theme, so the docs' and playground's copies are
  untouched. `arcade.css` imports the theme files itself, so the visual
  tests that import it alone get them.
- Studio and Paper are each a file (`theme-studio.css`, `theme-paper.css`):
  a value for every property, and rules for the site's name and the cards'
  names in type (plain-text twins beside the pixel ones, each theme showing
  one), straight untaped pictures, and their own card faces. The candy
  palette became `--theme-candy-*`; the way in's frame reads
  `--theme-polaroid`, `--theme-shadow-near` and `-far`.
- Both are quiet (`isQuiet` in `views/themes.ts`): the reduced-motion way
  in and out, with no burn. A way of their own (Studio's "grow") is a
  follow-on.
- The setting: `themeChoice`, `theme`, `chooseTheme` on the model;
  `mvt-arcade:theme` in storage, followed across tabs by the `storage`
  event; `SITE_THEMES` (arcade Arcade, demos Studio, puzzles Paper); the
  first paint written into each page's `<head>` by the kit
  (`first-paint-theme.ts`); the picker, `NavThemeView`, in the nav.
- Found: Vite's dev server resolved an `@import` nested in an imported CSS
  file from the repo's root on the demos site alone (not the arcade's or the
  puzzles'). Not chased; `arcade.css` imports each theme file directly.
- Checked: contrast (`themes.test.ts`, every theme, 20 pairs, AA; Studio's
  button violet darkened to #5e60e0 to pass), the first paint against the
  CSS (`first-paint-theme.test.ts`), 6 new visual poses (pause menu, a full
  highscore table, How to Play, in Studio and Paper), every old image
  identical, 3085 unit tests, lint, `npm run build` with every check (home
  pages 51.5 to 55.6 KB of 60). The demos' and puzzles' wall pictures
  retaken in their own themes.
- Follow-ons: a way in of Studio's own; softer page sounds for Studio and
  Paper; the docs' nav following the choice; entries reading the theme
  (Sudoku in ink on newsprint); the marquee's colours, the wall's ember
  shader and the search's magnifier icon are still the Arcade's in every
  theme (the last is a data URI, hidden from `var()`); empty highscore rows
  are pale on Paper.

**2026-11-01, Part B revised after a first look.** Studio and Paper are
renamed **Dark** and **Light** (`'dark'`, `'light'`; `theme-dark.css`,
`theme-light.css`); the names above are the first ones. Changed at the
user's asking:

- No tags on the cards: the era had been the only one left, and no tag is
  special enough for every card. Tags show in the info panel, as outlined
  pills like the search's chips, and in the search.
- No serif anywhere: `--theme-font-serif` is gone; the info button's letter
  and Light's masthead and names are in the system's sans-serif, and
  Light's typewriter for keys is the system's monospace.
- Dark and Light show each card's photo full width (`cardPhoto:
  'full-width'` in `views/themes.ts`): across the card's lower half, edge to
  edge, straight, unframed, and not growing as the card is selected, with
  the star and the info button just above it. The photo shows the middle
  of the entry's crop that fills it (`fullWidthPhotoIn`, `cropToAspect` in
  `card-photo.ts`); the card's pose now carries the whole picture behind
  the photo (`PhotoPose.frame`, read from the picture's place in the photo),
  so the way in starts from what the card shows. `PicturePose` merged into
  `PhotoPose`.
- Dark: larger names (24px at the design size), no stripe of colour across
  the card's top, and the card a shade lighter than the page
  (`--theme-raised`, the colour the photo's frame was).
- Light: larger names in ink, with no highlighter behind them; its card
  colours, now only the selected card's ring, deepened so the ring shows on
  paper.
- Open: the top half of a full-width card holds only the name and the two
  buttons, so it is mostly empty. The entry's summary, or a shorter card in
  these themes, would fill it; left for the user to judge.

**2026-11-01, square photos.** At the user's asking, a full-width photo is
now a square across the card's foot, under both bands' height, and the star
and the info button are back at the bottom right, floating over its corner
in Dark and Light. Each entry gives a focus (`thumbnailFocus`, in its own
pixels), which a closer crop keeps at its centre as nearly as its crop
allows (`cropToAspect`); `describeCatalogue` requires one inside the crop.
Each was chosen from the entry's picture and checked on the walls: Sudoku's
square crop now shows the whole grid. The empty top half is gone with it.

**2026-11-01, names.** Dark's and Light's card names are centred and larger
(32px at the design size), shrunk to fit one line as the pixel names fit
themselves: the card measures its name once per theme, once it is on the
wall, and sets `--name-fit`, which the size is multiplied by. Every size on
a card scales together, so one measure holds at any width. Light's names
are a soft warm grey (#9a9082), 3:1 on the card, enough for text this
large. Dark's are all one soft, warm grey (#c8c2b8),
no longer each card's colour. A name's box is padded 0.12em above and
below, so the tails of g, j and y are not cut off. Both themes set the names in
small capitals (`font-variant-caps`, after the `font` shorthand, which
resets it), spaced closer (-0.04em).

**2026-11-01, site names.** Dark's and Light's site names drop the accent's
full stop and the double rule. Both are 52px small capitals, like the
cards' names: Dark's letters are filled with a gradient from a warm pale
grey into the accent's violet (`background-clip: text`), and Light's are
ink, underlined with a wavy red-pencil squiggle (`text-decoration: underline
wavy`). Fonts beyond the system's are an open question for the user: the
home-page budget counts JavaScript only, so a self-hosted font would not
fail it.

**2026-11-01, the Arcade's marquee everywhere.** The user liked neither;
every theme now shows the Arcade's pixel marquee for the site's name, and
its plain-text twin is gone. The nav broke on phones (375px and under): the
palette made five tools, which wrapped under the name and behind the page's
title. Under 660px the nav's top row now stays one row: the name has a zero
flex basis, so the row shrinks it (to an ellipsis, at 320px) rather than
wrapping, and grows back to its own width; the tools sit at the right
(`margin-left: auto`), and close up under 400px. Dark's cards are their own colour
again, at a quarter of its brightness (`color-mix` with black), which
keeps the warm grey names easy to read. Light's are a wash of their colour, 24% of
it on white. The nav's breakpoints, set before the Demos and Puzzles links
and the palette joined it, overflowed from 665px to 930px: measured at
every width, the whole nav needs 935px and without its links' icons 790px,
so the icons go at 980px and the hamburger comes at 820px (the runner's
bar follows), which fits from 1100px down to 300px in the Arcade and Dark
themes. The playground's copy overflowed the same way (705px to 935px)
and takes the same breakpoints, its theme picker folding at 820px with
them. The docs' bar, VitePress's, overflowed from 905px to 1135px and
around its own breakpoints: the links' icons go at 1160px, and the search
box shows only its magnifier from 768px to 840px and from 960px to 1010px.
Each was measured at every width, 5px apart, and fits from 1400px down
(the docs to 315px, where VitePress's own phone bar runs a few pixels
over). Found on the way: the docs' Vite opens its own page-update socket
on port 24678, not the one server's, so a second `npm run dev` on another
port has docs that reload without end. Not fixed. Light's page is now a neutral pale
grey (#f4f4f5, and in the first paint), not warm newsprint, which clashed
with the cards' washes of colour. The names' colours are the other theme's
cards, turned about: Dark's are a pale wash of the card's colour (24% on
white), Light's the card's colour at a quarter brightness (25% on black),
each mixed from its own theme's palette. Then, at the user's asking, both
names are the card's plain Arcade colour (`--arcade-candy-*`, in a `:root`
block of `themes.css` no theme overrides, which the Arcade's own palette
reads; each card sets `--arcade-candy` beside `--candy`). It suits Dark;
on Light's pale cards the pastels barely show. Then both at half
brightness (`color-mix` with black): right for Light, dim on Dark's dark
cards. Settled: Light's names at half brightness, Dark's at full. Then Dark's drawn in
outline only (`-webkit-text-stroke`, 1.2px at the design size, with a
transparent fill), in the card's full Arcade colour. It looked bad on the
user's phone: phones' variable fonts build letters of overlapping pieces,
whose every edge a stroke traces, and the stroke thinned to 0.7px. Now the
letter is filled with the card's own colour over its stroke (`paint-order:
stroke fill`), hiding the inner half and the overlaps, with the stroke
twice as wide and at least 2px, the spacing looser (-0.01em), and 2px of
room at each end so the box does not cut the outline off. Light's names
are outlined the same way, in the card's Arcade colour at half
brightness, filled with its card's wash. Both outlines then thickened: the
stroke 3.6px at the design size, at least 3px, so 1.8px shows (at least
1.5px).
