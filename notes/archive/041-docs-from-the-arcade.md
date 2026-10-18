# Docs: Questions the Arcade Raised

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-05 |
| Updated  | 2026-10-18 |

## Description

The Arcade (`packages/sites/arcade/src/arcade/`, proposal
[036](036-website-arcade.md)) is the first MVT application
in the repo that is not a game, and building it needed answers the docs do
not give. Its [README](../../packages/sites/arcade/src/arcade/README.md) shows
how it answered each; the docs should answer them in general, in the guide
(`packages/sites/docs/building-with-mvt/`), each where it fits, with the Arcade as
the worked example.

### Topics

- [x] **When a view may read layout back.** Views write presentation
  output and read state; but a view's input can include measurements of the
  page (a `ResizeObserver` reporting card sizes to a layout view model), and
  once, a pose read back from the page as a transition starts
  (`photoPoseOf`). When is that sound, when does it cost a forced layout,
  and why should measuring happen outside `refresh`? Likely a page in
  `presenting-the-world/` or `adding-visual-polish/`.
- [x] **Hand-offs between a view model and the model.** The model loads an
  entry and waits; the transition view model says when to start playing,
  through a relay binding (`onHandOver: model.startPlaying`). A pattern for
  presentation that must finish before the domain moves on, and how it
  differs from a model that waits on time. Likely `animating-transitions/`.
- [x] **Reduced motion.** `prefers-reduced-motion` is presentation: the
  views and view models take an `isMotionReduced` binding and choose a quiet
  path (a fade for the burn and float, no sliding cards), and the model
  never knows. Where the setting comes from (the page, through bindings),
  and how to test both paths. Likely `adding-visual-polish/`.
- [x] **The URL as a projection of the model.** The search and the entry
  playing are written to the query and the fragment from the model, after it
  changes (`watch`), and read back on load and on `hashchange`, through the
  model's methods. Where the URL belongs in MVT (outside it, like the
  renderer), and why the model never touches `location`. Likely
  `reacting-to-changes/`.

Add new terms to the glossary as they come, and the pages to the sidebar.

## Acceptance Criteria

- [x] Each topic covered in the guide, or folded into an existing page
- [x] Each links the Arcade's code as its example
- [x] The Arcade's README links the pages, in place of this task

## Progress Log

- 2026-10-05: Created from 036's step 10, from the Arcade's README.
- 2026-10-18: Done. Three new guide pages, each ending with the Arcade's
  code: Reading Layout Back (`presenting-the-world/reading-layout.md`),
  Reduced Motion (`adding-visual-polish/reduced-motion.md`), and The URL and
  the Model (`reacting-to-changes/the-url.md`). The hand-over became a
  section of Open-Ended Phases, "Handing Over Between a View and the Model",
  since the view model's wait is an open-ended phase. The pages are in the
  sidebar and the docs home page's list, linked from their siblings, and
  "Reduced motion" is in the glossary. The Arcade's README links them in
  place of its open questions.
- 2026-10-18: The hand-over section taught the view model telling the model
  when to start, which bends MVT. It was rewritten as "When a Transition
  Decides When Play Starts", where the model owns the timing and the view
  follows. Reduced Motion's wipe example now follows the model's progress
  too. The Arcade still hands over the old way; task 066 changes it.
- 2026-10-18: Dropped The URL and the Model. A review found that almost all
  of it follows from MVT's rules: the URL is written like any view's output,
  and read back like any input. The one lesson the rules don't give, a
  write that comes back as an event (`history.back()` firing `popstate`), is
  not URL-specific. So it joined Presentation State's text field example,
  as "Controls that are both output and input", with in-progress state kept
  in the view and writes from the model that mustn't fight the user.
