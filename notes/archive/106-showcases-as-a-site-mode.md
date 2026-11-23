# Showcases as a Site Mode, Each With an Easter Egg

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-11-21 |
| Updated  | 2026-11-23 |
| Status   | done, in vnext since 2026-11-23 |

## Description

Each site has a showcase: an entry that holds the site's other entries for
the visitor to walk up to and play. They are the arcade's Arcade Hall, the
demos' Gallery and the puzzles' newspaper, The Daily Fold. Today each one is
listed on its site's wall as an entry, marked `showcase: { ribbon }` in its
`entry.ts`, so the wall shows it first, with a ribbon and no star. See
[A Showcase](../../packages/sites/arcade/src/entries/README.md#a-showcase-an-entry-that-holds-the-others).

To a visitor, a showcase isn't an entry. It's another way to see the whole
site, the way the card wall is one way. It isn't a theme either: a theme is
only colours, and a showcase replaces the wall. So it becomes a **site
mode**, switched on and off from a toggle button in the nav. The button sits
among the buttons on the right (sound, Perfmon and the rest), and is lit
while the mode is on, as the Perfmon's gauge is (`is-on`,
`aria-pressed`, a title that says "shown" or "hidden").

The code stays an entry: the page still loads it, starts it and runs it
through the entry host, and the launcher still plays each entry over it.
It just isn't listed on the wall, and the search never finds it.

Take this up after the click-through work in progress in the same worktree
(`LiveElementView`, the overlay, and pointer input for the Pixi entries on
their screens), since both change the showcases.

### The nav button's icon

Find an icon that suits all three showcases. A walk-through place rather
than a picture of any one of them. Candidates: a cube drawn in perspective
(a 3D view), an open doorway, or a figure walking. Draw it the way the
nav's other icons are drawn, in `site-kit/src/arcade/` (CSS, using the
`--site-nav-*` colours), so it looks the same in every theme.

### Leaving

A mode has no exit but its toggle, so each showcase's own way out changes:

- **The Arcade Hall.** Its outer door leaves the hall, which no longer
  makes sense. Its easter egg stays: the empty last hall, the button, and
  going outside to the meadow, which today has no way back. It needs one:
  a gesture to come back in to the hall (for example a long press, or
  walking back to where they arrived), with an instruction on screen that
  says how.
- **The Gallery.** Its door out goes, or leads somewhere else.
- **The Daily Fold.** Closing the paper goes back to its front page.

### Easter eggs

Each showcase gets an easter egg of its own:

- **The Arcade Hall:** going outside, as now, with the way back above.
- **The Gallery:** an extra room at the end, found rather than signposted.
  Either a room of striking effects, or an unusual interactive art
  installation. Ideas worth weighing: a room of mirrors whose reflections
  lag behind the visitor; a field of hanging lights that follow the
  visitor round; a "painting" that is a window into the room itself; a
  wall of pixels that ripples where the visitor walks.
- **The Daily Fold:** a game hidden in the paper. For example noughts and
  crosses in a margin, played against an invisible opponent whose pencil
  marks appear as if someone across the table were playing. Or a
  crossword that fills itself in when you look away, or a word search.

The easter eggs must follow the
[originality rules](../../packages/sites/arcade/src/entries/README.md#originality).

## Acceptance Criteria

- [x] A toggle button in each site's nav, among the buttons on the right,
      switches the site between its wall and its showcase. It's lit while
      the showcase is on, and has a title and `aria-pressed`, like the
      Perfmon's. It looks the same in every theme. (First a cube of its
      own, `NavShowcaseView`; revised to the last choice in the palette's
      menu, see Decisions.)
- [x] The showcases are not on the wall, and the search never finds them.
      The ribbon, the `is-showcase` card and the wall's "showcase first"
      rule are removed, along with their test. The catalogue check keeps
      "one showcase at most", which the model relies on.
- [x] Turning the mode on starts the showcase in place of the wall. Turning
      it off goes back to the wall. An entry launched from the showcase
      still plays over it, and leaving the entry returns to the showcase.
- [x] The URL and history follow the mode: a link to the site in the mode
      opens it in the mode, and Back does what a visitor expects. A link to
      an entry still opens that entry.
- [x] It's settled whether the mode is remembered between visits, and
      whether it's one setting for all three sites or one per site. The
      answer is kept with the other settings (`mvt-arcade:showcase`, in the
      page's local store, as the theme is).
- [x] The Arcade Hall's outer door no longer leaves the hall. The meadow
      has a way back to the hall, with an instruction on screen.
- [x] The Gallery has a hidden extra room or installation, and The Daily
      Fold a hidden game, each with a visual test of its own.
- [x] Falling Sand's switches still restart it in place when it's played
      from the Gallery (`launchedBy`), and now on its painting too.
- [x] The docs say what a showcase is now: AGENTS.md (the Showcases bullet),
      the guide to adding an entry (A Showcase), Project Structure, and the
      site kit's Arcade README (a new section 11).
- [x] Each showcase's thumbnail and share picture are still made. The
      showcase's address gives the link preview, and the way in shows the
      thumbnail.

## Decisions

- **The mode is the showcase as the outer entry.** The showcase stays in
  the catalogue, marked `isShowcase: true` (the `EntryShowcase` type and
  its ribbon are gone). `ArcadeModel.isShowcaseMode` turns it on and off.
  Turning it on leaves any entry playing and launches the showcase
  directly, with no card to leave from. Turning it off leaves it, and any
  entry it launched. The showcase itself can't be left (`exit()` does
  nothing there), as the wall can't. Launching it, as its address does,
  turns it on. While it's on, leaving
  any other entry goes back to the showcase. `exit()` on the wall launches
  the showcase if the mode is on, which is how the wall's address opens in
  the mode. A showcase that fails to load turns the mode off.
- **One setting for all three sites, remembered between visits**, as the
  theme is. It doesn't follow other tabs live, as the theme does, since
  that would launch the showcase in a tab the visitor isn't looking at.
- **The showcase is an alternative wall, not an entry** (revised after the
  first playtest). It's the last choice in the nav's palette menu, under
  "Walk-in 3D", after the card walls ("Card wall": Site's own, Neon, Paper
  and Night, the themes renamed, in the nav's order of their sites). The palette keeps its icon. It has no
  way in, as an entry has: the wall dims while it loads, and it fades up
  over the wall once started, with no coin; the way out is the quiet one.
  While it shows (`ArcadeModel.isShowcaseShown`), the site's nav stays over
  it (`is-showcase-shown` on `<html>`), with no runner's bar, so
  the visitor can go to another site, and the magnifier hides. An entry
  launched from it brings the bar back. Escape does nothing in it.
- **The URL is the wall's.** The showcase's own address (`demos/gallery/`)
  turns it on, and is rewritten to the wall's, so it has no history step,
  and Back leaves the site, as from the wall. An entry launched from it has
  its own step.
- **It fills the area under the nav.** Each showcase lays itself out
  (`fitTo`, `laysItselfOut: true`) at its design height, as wide as the
  area's shape needs (`fitShowcaseWidth`, an aspect from 0.45 to 2.6). Its
  views read the width each refresh (`Scene3DView`, `LookDragView`,
  `ShowcaseHudView`, `WalkerCameraView` and `LiveElementView` take a
  `ValueOrGetter` width), rather than being built again, since destroying
  a screen would destroy the live entry's stage. The scrollbar's gutter is
  dropped while the showcase is open (`is-showcase-open`). Thumbnails and
  visual tests keep the design width. The Arcade Hall's own cabinet, at
  its design shape, fills the view's height as the player steps in, so a
  wide window shows the cabinet's sides until the step inside.
- **A link to an entry, with the mode on, opens the entry on its own.**
  Leaving it goes to the showcase.
- **On a phone**, the menu is the same. Checked at 800x900, not on a
  phone.
- **The Daily Fold had no way out of its own**, so it needed no change for
  "Leaving".

### The easter eggs

- **The Arcade Hall.** The hall itself has its door shut: a pair of doors,
  no EXIT sign. Inside a cabinet's hall it's still open, and leads out.
  In the meadow, holding the primary button (Space, or the touch Play
  button) for `HEAD_INSIDE_MS` (1.2 s) whitens the view and fades the
  player back into the last hall, a step back from the button. The corner
  line in the meadow says "Hold Space to go back inside".
- **The Gallery.** The door it was entered by lost its EXIT sign and its
  hint, and leads to the lantern room, a dark room far west of the gallery
  (out of sight of it). Its 121 lanterns hang on threads, in a grid, amber
  to rose to violet, the whole sweep turning slowly round the colour wheel
  (once in 48 s) while the visitor is there. Those near the visitor rise
  and brighten, quickly as they come and slowly as they pass, so a glowing
  wake trails behind. Its
  own doorway leads back. It's drawn as two batches (`BatchedMesh3D`), with
  a per-slot tint bit for the glow.
- **The Daily Fold.** The back page has noughts and crosses pencilled over
  a story in its margin. A tap on a square pencils the reader's cross, and
  after 0.7 to 1.6 s the unseen player pencils a nought. They take wins and
  block, but miss either one time in five, and like the middle, then the
  corners. A finished game stays for 2.6 s, with a line through a win,
  then is rubbed out, and the first move alternates. (A tally of wins
  under the grid was taken out after the first playtest.) Each mark scratches (`PENCIL_MARKED`). It takes
  taps only, no keys.

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

- 2026-11-21: Created, from a request while the Gallery's click-through
  spike was being built.
- 2026-11-21: Done, in the `pixi-3d` worktree, uncommitted. The site mode,
  the nav and bar cubes, the three exits and easter eggs, tests (the
  model's mode rules, the margin game, the doorways, the hold), visual
  tests (the lantern room, the margin game), and the docs. Before this,
  the click-through was extended to Pixi entries
  (`forwardPointerToStage`). One Gallery visual pose was nudged (a walk of
  1320 ms, not 1360), as one anti-aliased pixel of a frame's edge came out
  differently in a full run and in the file alone.
- 2026-11-22: Revised after the first playtest: the showcase moved into the
  palette's menu as an alternative wall, under the site's nav, at the
  wall's address, filling the area; the themes renamed for the menu; the
  lanterns' colours turn slowly; the margin game's tally removed. Also
  fixed the home page's first load, which held the page's own sounds and
  the tracker notation's parser (about 6 KB gzipped, over the 60 KB
  budget): the timings the model imports shared a barrel with the sounds,
  which run as they load. The sounds moved to `arcade/sounds/`, and the
  home page check now forbids audio90 on the first load.
- 2026-11-22: More playtest fixes: the palette keeps its icon, the showcase
  fades up over the dimmed wall rather than taking an entry's way in, a page
  opened in 3D never shows the wall first, and the menu lists Neon, Paper,
  Night, in the nav's order of their sites. Playtests turned up one "unless
  it's the showcase" bug after another, so moving the showcases out of the
  entries is now [108](108-showcases-out-of-the-entries.md).
