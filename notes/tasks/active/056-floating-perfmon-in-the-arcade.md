# A Perfmon Throughout the Arcade, and a New Nav

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-17 |
| Updated  | 2026-10-18 |

## Description

Broadened on 2026-10-18 to include a touch-up of the Arcade's nav, which
gains the Perfmon's button. The design is tried in the Arcade first, and
copied to the docs and the playground once it is settled.

### The nav

- The links, on the left: Arcade, Docs, Playground and GitHub, which moves
  from an icon at the right to a fourth link. Each shows a monochrome SVG
  icon (a gamepad, an open book, a slide, the GitHub mark) before its label
  where there is room, the label alone where the nav is narrower, and the
  hamburger below 600px, with the icons back in its menu.
- The tools, on the right: the search magnifier (once the head scrolls
  away), the sound, the Perfmon's button (a gauge), and the (i), moved up
  from beside the Arcade's name, rightmost. Its note drops from the nav.
- New colours, the first of a few schemes to try: a very dark blue
  background with yellow text. The nav's colours are variables of their
  own, so a scheme changes in one place.
- The runner's bar, which covers the nav while an entry plays, copies the
  nav's styling and layout, with its own differences (back, title, pause,
  fullscreen, and no (i)).
- The head's wordmark says "ARCADE", matching the nav. The site is MVT
  Games; the Arcade, the docs and the playground are parts of it.

The owner wants a Perfmon that can float over any entry in the Arcade,
whatever its renderer. The view for it already exists. `@mvtjs/html` has
`PerfmonView`, built for this and for the playground's Performance tab. It
fits the space it's given, so in a small box over a corner of the screen,
it's a compact panel.

The Arcade's page runs one loop for itself and the entry it's running
(`packages/sites/arcade/src/arcade/main.ts`, through the entry host in
`runner/`). That loop knows when each frame starts and ends, for every
renderer. So it can drive one `createPerformanceMeter` (`@mvtjs/utils`)
itself, as the playground's sandbox does in
`packages/sites/playground/src/sandbox/run-sandbox.ts`. For Pixi entries, a
`createGpuTimer` (`@mvtjs/pixi`) on the Arcade's renderer gives the GPU's
time. For the others, GPU shows n/a.

### What moves with it

Two entries show a Perfmon of their own today, drawn with Pixi:

- **Boids** puts it under its sliders (`entries/boids/views/boids-view.ts`),
  and its layout leaves room for it (`PERFMON_GAP`, `PERFMON_HEIGHT`). It
  marks `reads` as not measured.
- **Falling Sand** puts it in its toolbar
  (`entries/falling-sand/views/toolbar-view.tsx`), and checks that the
  toolbar is tall enough for its info card (`view-constants.ts`).

Both get their metrics from `createPerformanceMetrics(host)`, in their
`start/load.ts`, using the `PixiHost` the Arcade hands a Pixi entry
(`entry-types/entry-starter.ts`). Once the Arcade has a meter of its own,
they should read that instead. Then the Arcade's Pixi `PerfmonView` in
`#shared` (`shared/perfmon-view.tsx`) and `PixiHost` may have no users left.

### Removing `@mvtjs/pixi`'s wrapper

`createPerformanceMetrics` in `@mvtjs/pixi` is now a thin wrapper. It
creates a meter and a GPU timer, and hooks the meter to Pixi's ticker and
renderer. Boids and Falling Sand are its only users. Once they use the
Arcade's meter, remove the wrapper, and its `PixiPerformanceMetrics` and
`PerformanceMetricsOptions` types, with a changeset (a minor version, since
the libraries are at 0.x). Show the four lines it replaced in
`@mvtjs/pixi`'s README, for a Pixi app that uses Pixi's own ticker.

### Answered (2026-10-18)

1. A button turns it on and off, in the nav and in the runner's bar. It
   always starts closed: nothing is kept between visits.
2. It drops down at the top right, under the bar, fixed there, over the
   card wall and over any entry. Whether it should float or move is for
   later, once this has been tried.
3. Boids and Falling Sand drop their own, and their layouts take back the
   room.
4. The panel shows n/a for anything it has no data for: the GPU, for every
   entry but a Pixi one, and the metrics an entry says it can't measure,
   such as Boids' `reads`.

## Acceptance Criteria

- [x] The owner has answered the open questions.
- [x] The nav, and the runner's bar, as described above.
- [x] The Arcade drives one performance meter from its own loop, for every
      renderer, with the GPU timed for Pixi entries.
- [x] A floating `PerfmonView` from `@mvtjs/html` shows it, over any entry,
      turned on and off as decided.
- [x] Boids and Falling Sand read the Arcade's meter, or show it, as decided.
- [x] `@mvtjs/pixi`'s `createPerformanceMetrics` is removed, with a
      changeset, and its README shows the wiring by hand. The Arcade's Pixi
      `PerfmonView` and `PixiHost` are removed if nothing uses them.
- [x] Lint, type checks, the unit tests and the visual tests pass. Changed
      reference images have been looked at.

## Progress Log

### 2026-10-17

Created at the owner's request, after the playground gained its
Performance tab and `@mvtjs/html` gained `PerfmonView` (052).

### 2026-10-18

Picked up, and broadened to the nav's touch-up. The owner answered the
open questions.

Done, for the owner to playtest:

- The nav: four links with icons (hidden from 760px down, back in the
  hamburger's menu below 600px), the tools at the right, yellow on dark
  blue from `--site-nav-*` variables in `shared/nav.css`. The open menu no
  longer lifts the top row (the spacer holds it at the nav's height). The
  playground's copy of `nav.css` probably has the same jump.
- The runner's bar takes the nav's height (`--runner-bar-height`), colours
  and icon buttons, with a gauge beside its speaker.
- `ArcadeModel.isPerfmonOpen`, false at the start. The page makes a meter,
  and switches on the host's GPU timer (`EntryHost.isGpuTimed`,
  `takeGpuMs`), only while it is open, so each opening starts afresh.
- `PerfmonView`'s `unmeasured` takes a function. The page shows the GPU as
  n/a unless a Pixi entry runs, and an entry's starter can name more
  (`unmeasuredMetrics`, which Boids sets to `reads`).
- Boids (960x492 now) and Falling Sand (480x774) dropped their panels.
  `PixiHost` became `isInPage`, which Falling Sand reads to tell a page from
  a headless start. The Arcade's Pixi `PerfmonView` is deleted.
- `createPerformanceMetrics` removed, with a changeset; the README shows the
  four lines.

Second round of playtesting:

- `PerfmonView` takes a `title`, for a title bar with the (i) at its right
  end (the explanation then opens below the bar), and an `infoNote`, a
  paragraph at the top of its explanation.
- The Arcade's panel is `PerfmonFloatView`: titled "Performance", opaque,
  dragged from anywhere on it but its buttons and the explanation's text,
  by mouse or finger, and kept in the window. Its note says how to move it
  and that the gauge closes it.
- The runner's pause button is a toggle: lit while paused, and pressed
  again, it resumes.
- Falling Sand's counts and hints share one line at the bottom (480x722).

Third round:

- `PerfmonView`'s frame budget follows the display, from the highest frame
  rate in its history, rounded to a common refresh rate (8.3 ms at 120 Hz),
  and `frameBudgetMs` sets it. It was a fixed 16.7 ms.
- The site's pixel font: `scripts/pixel-font.ts` writes the pixel glyphs as
  a TrueType font of squares, wrapped as WOFF (2.3 KB), with no new
  dependency; `npm run generate-pixel-font -w @mvtjs/arcade` writes
  `src/shared/mvt-pixel.woff`, and a test fails while it is stale. Its em
  is a capital's height, so it is sharp at 14px. Only "MVT Games" uses it,
  on a layer of its own (`will-change`), which trades Windows' coloured
  subpixel fringes for plain, sharp edges. The docs and the playground can
  take the same file when the nav is copied to them.
- The links' icons hide at 760px and the hamburger takes over at 660px,
  measured with the GitHub link's label, which the old 600px did not fit.

Fourth round:

- The nav's links to the Arcade (its name, and "Arcade") scroll back to
  the top of the wall, closing any panel, rather than load the page again
  (`ArcadeView`'s `homeLinks`). A click that opens a new tab still does.
- The runner's title is in the pixel font, as the site's name is.
- The runner's bar reads pause, sound, gauge, fullscreen, so the speaker
  and the gauge sit on the same pixels as the nav's, and fullscreen takes
  the (i)'s place at the end.
- Both bars draw their bottom line as a shadow below them, so their buttons
  centre on whole pixels (they were half a pixel off).

Fifth round:

- The runner's bar keeps the entry's whole name in view: buttons that don't
  fit beside it move into a menu (⋮) at the bar's end, from the last, with
  pause the last to go. A `ResizeObserver` on the bar, and on an unseen copy
  of the name, works out how many fit; the refresh step only shows them. The
  bar's buttons and the menu's items are made from one list, `tools`.
- Stacking: the Perfmon sits under the nav on the wall (9998) and under the
  runner's bar over an entry (10005), so the (i)'s note and the bar's menu
  drop in front of it; the bar (10006) is above the pause menu, the offer
  to resume and the initials, which all sit below it. A dragged Perfmon
  stays below the bar.

Sixth round:

- The runner's bar has an (i), which opens the entry's info panel over it,
  and reads pause, fullscreen, sound, gauge, (i), so the last three sit
  where the nav's do. In the overflow menu, fullscreen goes first, then the
  gauge, the sound and the (i); pause stays last (`BarTool.rank`).
- The info panel has tabs where the entry has more than one page:
  Description (with the techniques and the size), How to Play and
  Highscores. Over the entry it opens on How to Play, and its Play is
  Resume. Opening it pauses the entry; closing it resumes the entry only if
  it paused it. It hides the pause menu while it is open, and adds no
  history step (Back from an entry leaves it).
- The pause menu has no tabs: Resume, Restart, the volumes and Exit.

Seventh round:

- How to Play is data, not wrapped text: `EntryDetails.howToPlay`, with an
  `intro`, `controls` (an action, and its inputs: keys, keys together,
  gestures, on-screen buttons) and `notes`, typed in `arcade-entry.ts`.
  Every entry's instructions were rewritten into it, keeping their words.
  `HowToPlayView` shows the controls as a table, with a column for the
  keyboard (key caps) and one for touch (gesture icons, round buttons).
- The info panel's height follows the tab that shows; its width and its
  top stay put, as it hangs from the top of the space below the bar rather
  than being centred. The selected tab and its page share a lighter shade
  than the panel.

Still to do: regenerate the Boids and Falling Sand thumbnails
(`npm run generate-thumbnails -- boids falling-sand`), whose play areas
changed. Then copy the nav's design to the docs and the playground once it
is settled.
