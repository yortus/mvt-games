# Arcade: Fixes From the Playtest Review

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-06 |
| Updated  | 2026-10-06 |

## Description

An MVT code review on 2026-10-06 covered two sets of arcade changes:

- the "arcade visual tweaks" commit (`8f835ef`), and
- the playtest fixes after it: info panels clear of the nav and closing on
  Back (both kinds), the scroll lock under panels, the search list in the
  page's flow, `/` leaving the search, and the `inspiredBy` credits.

Both sets work, and mostly follow MVT. This task makes the improvements the
review found, plus one design change that came out of it.

**The design change.** When the search list opens or closes, the head
changes height, and the card wall moves. The wall now eases to its new place
by measuring the change after the head has drawn it, in the wall's refresh
step (`drawFrameShift` in `views/arcade-view.tsx`). That reads layout in a
refresh and changes presentation state there, which the arcade's README says
it never does. The fix is to stop the head from changing height in one go:
the list unfolds and folds with a CSS transition, and the wall follows the
page's layout every frame, with nothing to measure.

Two ways to unfold the list were weighed:

- **A CSS transition on the wrapper's grid rows** (chosen). About ten lines
  of CSS and two wrapper elements; no new view state. The arcade already
  uses CSS transitions for small effects (cards, polaroids, the search box,
  chips, the nav magnifier), switched off under reduced motion.
- **A tween in the search bar's update step** (`createBooleanTween` from
  `@mvtjs/utils`), writing the wrapper's height in refresh, with the list's
  height measured by a `ResizeObserver`. Driven by `deltaMs`, so testable and
  tied to the ticker, but about 40 lines, and it moves the search bar's
  `settle` from its refresh step to an update step. Not worth it while
  nothing pauses or slows the arcade page.

Settled; do not reopen without new information: the wall must not measure
layout in a refresh step to ease itself.

## Acceptance Criteria

### The search list unfolds (replaces the wall's easing)

- [x] In `views/search-bar-view.tsx`, wrap the tag list in an outer
      `.search-tags-reveal` and an inner `.search-tags-clip`. The outer one
      gets an `is-open` class from `isListOpen`, replacing the list's
      `visible={() => isListOpen}`. `aria-expanded` is unchanged.
- [x] In `arcade.css`, the outer wrapper is a grid whose one row goes from
      `0fr` (folded) to `1fr` (open). `visibility` turns hidden only after
      the fold ends (`visibility 0s 0.25s`), so a folded list is gone from
      screen readers and keyboard focus. The inner wrapper has `min-height: 0`
      and `overflow: hidden`. Do not use `hidden`: `[hidden]` is
      `display: none !important`, which would cut the fold short.
- [x] Add `.search-tags-reveal` to the reduced-motion rule, so it snaps.
- [x] In `views/arcade-view.tsx`, delete the wall's easing: `easeFrame`,
      `drawFrameShift`, `frameTop`, `frameShift`, `drawnFrameShift`,
      `FRAME_EASE_MS`, `FRAME_LANDED_PX`, the frame's `onRefresh`, and the
      sentence about gliding in the view's JSDoc.
- [x] Check in a browser (one headless run, reusing the profile) that the
      wall's top moves smoothly both ways, with no jump, and that `/` pressed
      twice quickly reverses the unfold smoothly.

### The model's info panels

- [x] In `models/arcade-model.ts`, hold which panel is open in one private
      field (`let panel: ArcadeEntry | 'about' | undefined`), so only one can
      be open by construction. `infoEntry` and `isAboutOpen` read from it.
      Today three places (`openInfo`, the `isAboutOpen` setter, `launch`)
      each clear the other panel.
- [x] Give the about panel `openAbout()` and `closeAbout()`, matching
      `openInfo()` and `closeInfo()`, in place of the writable `isAboutOpen`
      whose setter quietly clears `infoEntry`. Update `arcade-head-view.tsx`,
      `main.ts` and the model's tests.

### The URL and history (`main.ts`)

- [x] Split the panel cases out of `writeUrl` into their own
      `writePanelStep()`, and replace the nested ternary in its fallback.
- [x] Add an `infoIdOf(state)` helper, so `followPanelStep` no longer
      depends on checking `ABOUT_STEP` before `isPanelState` to slice an
      id safely.
- [x] Handle the race: closing the about panel calls `history.back()`, and a
      card's (i) clicked before that `popstate` arrives has its panel closed
      by `followPanelStep`. Count the backs `main.ts` makes itself and ignore
      their `popstate`s, or, if that proves fiddly, record the race in a
      comment.
- [x] Rewrap the over-long line in the header comment.

### Views

- [x] `goToSearch` in `views/arcade-view.tsx` reaches into the search bar
      with `head.querySelector('.search-input')`. Consider a query binding on
      `SearchBarView` that counts focus requests (it focuses its input when
      the count changes), passed down through `ArcadeHeadView`. Do it if it
      reads well; otherwise leave it and say why in the log.
- [x] Rename `AboutView`'s `onButtonPressed` to `onAboutPressed`, as other
      relay bindings name what was pressed.
- [x] `ArcadeView` (360 lines, about 325 once the wall's easing is gone)
      handles the keys, the scroll lock, the nav magnifier and the head
      observer beside the transition. Consider moving the magnifier's wiring
      (the `IntersectionObserver`, `isHeadInView`, `navHeight()`, appending
      into `navTools`, and taking it out again) into a view of its own, given
      the head element and an `isWallActive` binding. Do it if the result
      reads better; otherwise leave it and say why in the log.

### Types and CSS

- [x] Give each field of `Inspiration` (`entry-types/arcade-entry.ts`) a
      JSDoc line; `year` says it is the year of the first release. (Dojo Duel
      credits International Karate's 1985 ZX Spectrum release; the C64
      version is 1986.)
- [x] Merge `.about-credits` and `.about-note .about-credits` into one rule.
- [x] Replace `.info-inspired`'s negative top margin with spacing that says
      what it means (for example, `.info-tags` keeps a smaller margin when
      `.info-inspired` follows it).
- [x] Check `.arcade-head:not(.is-stacked) .search { margin-top: 2px }`
      against the 38px wordmark at 640px and below, where it centres the box
      about 3px low if the search fits beside the title.

### Docs

- [x] Update the arcade's [README](../packages/website/src/arcade/README.md):
      the model's state now includes which info panel is open, and opening a
      panel adds a history step, as going into an entry does.
- [x] If the wall's easing is gone (above), the README's "never in a
      refresh" sentence holds again and needs no change. If it stays for any
      reason, list it under "Where It Bends the Rules" instead.

### Finally

- [x] Type-check, lint, the website's tests, and one browser check of the
      panels (Back and Forward, both kinds, and one opening as the other
      closes).
- [x] Move this task to `notes/archive/` and update the index.

## Not in Scope

- The example entry in `packages/website/src/entries/README.md` is named
  "Breakout", a real game's title, against its own originality rules. Fix it
  in 017 or on its own.

## Progress Log

### 2026-10-06

- Created from the code review of `8f835ef` and the playtest fixes, and the
  discussion of how the wall should follow the search list.
- Done, on top of `752f8bc`:
  - **The unfold.** The search list unfolds and folds with a CSS transition
    on its wrapper's grid row (0.25s, ease-out), and the wall's easing is
    gone from `ArcadeView`, so nothing reads layout in a refresh step and the
    README needs no new exception. Checked in headless Chrome, sampling the
    wall's top every frame: it moves one way only, opening (178 to 433) and
    closing, and `/` pressed twice quickly folds back from part way.
  - **Panels.** The model holds the open panel in one field
    (`ArcadeEntry | 'about' | undefined`), with `openAbout()` and
    `closeAbout()` beside `openInfo()` and `closeInfo()`; each close closes
    only its own kind, and `openInfo` with an unknown id now does nothing
    rather than closing the panel open. Tests added.
  - **History.** `writePanelStep()` is split out of `writeUrl`, with
    `wallUrl()` and `infoIdOf()`. The race is handled rather than recorded:
    the page counts its own steps back (`stepBack`), and when one arrives the
    history follows the model (`writePanelStep`) instead of the model
    following the history. Ignoring the page's own `popstate` alone was not
    enough: a panel opened before the step back arrived would be left with
    no step of its own. Checked in the browser by opening a card's info in
    the frame the arcade's panel stepped back: the card's panel stays open
    on a step of its own, and Back closes it without leaving the site.
  - **`goToSearch` left as it is.** A focus request through a binding would
    focus the box in a later refresh, outside the tap's event handler, and
    iOS opens the keyboard only for a focus made in the handler itself: the
    nav's magnifier would bring the visitor to the box with no keyboard.
  - **The magnifier moved.** `NavSearchView` now takes the search element and
    an `isActive` binding, and owns its `IntersectionObserver` (disconnected
    in its `onDestroyed`); `ArcadeView` builds it, places it in the nav and
    destroys it with `destroyElement`. `ArcadeView` is 314 lines, from 360.
  - **Smaller items.** `onAboutPressed`; `Inspiration`'s fields documented;
    one rule for the about note's credits; the credit line spaced by margins
    that say what follows what; the search box centred on the name at both
    wordmark heights (`--wordmark-height`); main.ts's header rewrapped; the
    arcade README's model state and history steps brought up to date.
  - Type-check, lint and the website's tests (684) pass.
