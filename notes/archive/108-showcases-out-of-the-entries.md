# Showcases Out of the Entries

| Field    | Value      |
| -------- | ---------- |
| Priority | high       |
| Created  | 2026-11-22 |
| Updated  | 2026-11-23 |
| Status   | done, in vnext since 2026-11-23 |

## Description

Each site's showcase (the arcade's Arcade Hall, the demos' Gallery and the
puzzles' newspaper, The Daily Fold) is an entry in its catalogue, marked
`isShowcase: true`. Since
[106](106-showcases-as-a-site-mode.md), the visitor sees it
as an alternative to the wall of cards, chosen from the nav's palette menu
under "Walk-in 3D", not as an entry. The page still runs it as one, and
that mismatch is where the bugs come from.

The page's idea is simple. An entry is something you play, launched from
the wall. So every entry feature had to be switched off for the showcase,
one at a time. Each one missed was a bug, found in a playtest:

- the card, the search, the chips' counts and the favourites;
- the magnifier's count, which took the showcase as hidden by a search;
- the way in (the picture, the black, the power-on and the static);
- the coin that plays as an entry launches;
- the runner's bar, the back arrow, Escape and the pause menu;
- the history step, the URL and the page's title;
- the letterbox, since the host fitted it as an entry of a fixed size;
- the scrollbar's gutter;
- the wall, which showed before the showcase on a page opened in 3D.

About 65 lines in the site kit handle "unless it's the showcase". They're
spread across the model, the views, the page and the CSS. One loss came
with them, too. Each showcase's `start/details.ts` holds its long text,
with the instructions for walking round. The visitor can't reach it any
more, since the showcase has no card, and the bar's (i) is hidden.

Nested launching, where one entry launches another over itself, exists
only for the showcases. No other entry declares `launchesEntries`. It
takes another 53 lines in the site kit: `parentEntry`, `isNested`, a
second entry host, the nested history step, `returnToParent`, and
measuring one host's play area against the other's.

### What changes

The showcase becomes a part of the site, not of its catalogue. It's a
layer the page shows in the wall's place.

- A site declares its showcase in its config (`SiteConfig.showcase`), with
  its name, its picture for link previews, and how to load it. Its code
  moves from `src/entries/<id>/` to `src/showcase/`, in each site. Its
  scenes, models and views don't change, and nor do their visual tests.
- The page runs the showcase in an entry host of its own, as the layer in
  the wall's place. The host already gives everything a showcase needs: a
  renderer (with PixiJS 3D), fitting to the area (`fitTo`), the touch
  controls, the sound chips, pausing while the page is hidden, and the
  Perfmon's timing.
- Which layer shows, the wall or the showcase, is a setting the page
  follows, like the theme (`isShowcaseMode`, kept as
  `mvt-arcade:showcase`).
- An entry launched from the showcase is an ordinary launch, over the
  showcase as it would be over the wall. Leaving it goes back to whichever
  layer shows. The model's phase `'browsing'` means "on the wall or the
  showcase".
- The way into an entry launched from the showcase is a new kind:
  in place, with the entry appearing exactly over its screen, which the
  showcase has framed. Today a nested launch skips the way in only because
  the outer entry's phase stays `'playing'`. The way out goes straight
  back to the showcase.

## What to Keep

These work now, and must still work after the move:

- The palette menu: "Card wall" (Site's own, Neon, Paper, Night), then
  "Walk-in 3D" with the showcase. The palette keeps its icon.
- The site's nav stays over the showcase, so the visitor can go to another
  site, which opens in its showcase too. The magnifier hides while the
  showcase is chosen.
- The showcase fills the area under the nav, at its own height and as wide
  as the area's shape needs (`fitShowcaseWidth`), following resizes
  without being built again.
- The way in: the wall dims while the showcase loads, and the showcase
  fades up over it once it has started. A page opened with the showcase
  chosen never shows the wall first (`is-showcase-starting`, set by the
  first paint's script). The way out is a fade. No coin.
- The URL stays at the wall's address while the showcase shows. Back from
  an entry launched from the showcase goes back to the showcase, and Back
  from the showcase leaves the site, as from the wall.
- A link to an entry, with the showcase chosen, opens the entry on its
  own, and leaving it goes to the showcase.
- A showcase that fails to load turns the setting off, so the wall shows.
- Entries on the showcase's screens: attract mode, the Pixi click-through
  (`forwardPointerToStage`), DOM entries on the overlay, and `launchedBy`,
  so Falling Sand restarts in place. `launchedBy` becomes "launched from
  the showcase", whatever it's called then.
- The three easter eggs, and the showcases' own tests.
- The home page's first load: no showcase code, no renderer and no audio90
  (`home-page-budget.slow.test.ts`).

## Acceptance Criteria

- [x] No site's catalogue lists its showcase. `isShowcase` is gone from
      `ArcadeEntry`, and so is every check for it in the model, the views
      and the page. `wallCount` went with it: the wall's count is the
      catalogue's again.
- [x] Each site's showcase is in `packages/sites/<site>/src/showcase/`,
      declared in the site's config (`SiteConfig.showcase`), and loaded only
      when it's chosen.
- [x] The page runs the showcase in a host of its own, in a layer laid over
      the wall, under the site's nav and under the runner. The wall and the
      showcase are the two layers an entry plays over.
- [x] Nested entries are gone: no `parentEntry`, `isNested`,
      `LoadEntryOptions`, inner host or nested history step, and no
      `launchesEntries`. An entry launched from the showcase is an ordinary
      launch (`isFromShowcase`), with no way in or out, on the entry host's
      canvas made clear round its play area (`EntryHost.isClear`). The one
      second host is the showcase's.
- [x] The showcase's instructions are in its info panel, which the nav's
      (i) opens while the showcase shows, in place of the site's note, on
      How to Play first, with Resume to
      go back to it. The showcase stands still behind it.
- [x] Each showcase keeps its own address (`demos/gallery/`), which opens
      the site with the showcase on and is rewritten to the wall's, with its
      own link preview. See Decisions.
- [x] `generate-thumbnails` photographs the showcase: the snapshot page
      lists it, and `findEntryDirectories` finds `src/showcase/`, so its
      pictures land in its `start/`. Not run, since the pictures haven't
      changed.
- [x] The showcases still start in `canvas-entries`, whose pictures of them
      kept their names and match unchanged. The catalogue checks now check
      the showcase isn't listed, and that its long text says how to walk
      round.
- [x] Everything under "What to Keep" works, checked in headless Chromium
      on all three sites (choosing it, the (i), a launch from it with the
      showcase round the entry, Back, its own address, a card wall again, a
      link straight to an entry with the showcase on, another site from the
      nav). Not on a phone.
- [x] The docs say what a showcase is now: a guide of its own,
      [`site-kit/src/showcase/README.md`](../../packages/sites/site-kit/src/showcase/README.md),
      AGENTS.md (the sites' layout and Showcases), the guide to adding an
      entry (a short pointer), Project Structure, and the site kit's Arcade
      README (section 11).

## Decisions

- **A showcase keeps its own address**, such as `demos/gallery/`, rather
  than a query such as `demos/?view=3d`.
  - A link preview needs a page of its own. The sites are on a static
    host, which serves the same page for any query, so `?view=3d` couldn't
    have its own title, description and picture. A path can: the build
    writes a copy of the page there, as for each entry.
  - Every link shared since 106 keeps working, with nothing to redirect.
  - The address is only a way in. The page turns the showcase on and
    rewrites the address to the wall's, so it pushes no history step, and
    Back leaves the site, as from the wall.
  - It costs a little in the build: the showcase's folder isn't named for
    its id, so `findEntryDirectories` reads the id from
    `start/showcase.ts`, and the entry-pages plugin reads the site's config
    rather than the catalogue.
- **The showcase's starter stays an `EntryStarter`**, and it's described
  with an `ArcadeEntry`, rather than types of its own.
  - The entry host runs it unchanged: its renderer (with PixiJS 3D), its
    fitting, its touch controls, its sound chips, pausing while the page
    is hidden, and the Perfmon's timing. A type of its own would need a
    second path through the host for all of that.
  - So do the parts that show and start entries: the info panel, the link
    preview, the snapshot page and `generate-thumbnails`, the entry facts,
    and the headless start in `canvas-entries`.
  - What a showcase never uses (highscores, saved games, notices, restart,
    a card's colour) is optional on both types, so it costs nothing to
    leave out.
  - `launchesEntries` went: the page passes the launcher to the showcase,
    and only to it.
- **The showcase's (i)** is the nav's own, as the playtest asked: while
  the showcase shows, it opens the showcase's info panel, the one an
  entry's (i) opens, in place of the site's note. One (i) under another
  would be one too many. The note's keys are the wall's, which don't apply
  in the showcase.
- **The entry host has one canvas, made clear**, and draws each entry
  opaque or clear as it starts (`isClear`). Pixi can draw a clear canvas
  opaque, but not an opaque one clear, so the canvas starts clear.
- **The showcase starts only on the wall**, as the visitor chooses it, not
  under an entry the visitor came straight to. Once started, it stays under
  every entry it launches, standing still, until a card wall is chosen.
- **Names.** The model keeps `isShowcaseMode`, and adds `showcase`,
  `isFromShowcase` and `showcaseFailed`. `EntryLauncher` keeps its shape.
  `launchedBy` keeps its name, meaning the showcase's id, for an entry it
  launched or runs on a screen.

## Brought Into vnext

The showcases came into vnext from the `pixi-3d` worktree on 2026-11-22
and 2026-11-23, reviewed in five batches: the page's showcase mode, the
showcase kit, then the Arcade Hall, the Gallery and The Daily Fold. Review
changed some of what's described above:

- **Terms.** A site browses its entries on its **card wall** or in its
  **showcase**, and the code, docs and comments say so. The palette menu is
  the nav's **Browse** menu (`NavBrowseView`), drawn as a grid of cards,
  with the headings "Card wall" and "Showcase", in place of "Walk-in 3D".
  The showcase's element is `.showcase-frame`, beside `.card-wall-frame`.
  The definition lives in `SiteConfig.showcase`, and the guides are the
  page's README, section 11, and the kit's README.
- **Launches from the showcase** skip the reveal, stay upright on a phone,
  and keep the size their card lists (the entry host's `isFittedToArea`),
  so each lands on the screen the showcase drew for it.
- **Sound.** A host behind another pauses its chips, and stopping an entry
  leaves shared chips resumed for the showcase under it.
- **The kit.** The live entries host catches a failed load, skips screens
  that can't run live, and ticks a DOM entry's views in `LiveElementView`.
  Screens forward only the primary button, so a right-drag looks round
  over them, and `LookDragView` does the same over the overlay.
- **The Arcade Hall.** The button in its last hall can be clicked or tapped
  from anywhere it's seen, without a hint. The river fades as the visitor
  goes back inside. The hall on its own cabinet's screen leaves out the
  meadow.
- **The Gallery.** A painting's demo keeps running through the glide in and
  out. The benches, pots and paintings share their shapes and materials.
- **The Daily Fold.** The open spread's puzzle loads as the spread opens,
  so its box lands where the puzzle plays, on a phone too. The margin game
  plays only while it's in view.
- **Tests.** Each showcase has a test that it holds every entry in its
  site's catalogue, and leak tests that reach its easter egg.

## Progress Log

- 2026-11-22: Created, after the first playtests of 106 turned up one
  "unless it's the showcase" bug after another.
- 2026-11-22: Done, in the `pixi-3d` worktree, uncommitted. The site kit
  (the model, the page, the Arcade's view, the entry host, the build
  scripts, the catalogue checks), the three showcases moved to
  `src/showcase/` (their lists of entries now read from the catalogue, by
  id, as the barrel rule asks), the (i), and the docs. Lint, the type
  check, 3,393 unit tests, 465 visual tests (no picture changed) and 178
  slow tests (each site built, with its link-preview pages) pass.
- 2026-11-22: The playtest asked for one (i), the nav's. The (i) on the
  showcase is gone. While the showcase shows, the nav's (i) opens the
  showcase's info panel in place of the site's note, and shows as on while
  it's open. The showcase now stands still behind its panel.
