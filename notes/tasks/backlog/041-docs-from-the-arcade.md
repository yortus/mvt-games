# Docs: Questions the Arcade Raised

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-05 |
| Updated  | 2026-10-05 |

## Description

The Arcade (`packages/website/src/arcade/`, proposal
[036](../../proposals/036-website-arcade.md)) is the first MVT application
in the repo that is not a game, and building it needed answers the docs do
not give. Its [README](../../../packages/website/src/arcade/README.md) shows
how it answered each; the docs should answer them in general, in the guide
(`packages/docs/building-with-mvt/`), each where it fits, with the Arcade as
the worked example.

### Topics

- [ ] **When a view may read layout back.** Views write presentation
  output and read state; but a view's input can include measurements of the
  page (a `ResizeObserver` reporting card sizes to a layout view model), and
  once, a pose read back from the page as a transition starts
  (`photoPoseOf`). When is that sound, when does it cost a forced layout,
  and why should measuring happen outside `refresh`? Likely a page in
  `presenting-the-world/` or `adding-visual-polish/`.
- [ ] **Hand-offs between a view model and the model.** The model loads an
  entry and waits; the transition view model says when to start playing,
  through a relay binding (`onHandOver: model.startPlaying`). A pattern for
  presentation that must finish before the domain moves on, and how it
  differs from a model that waits on time. Likely `animating-transitions/`.
- [ ] **Reduced motion.** `prefers-reduced-motion` is presentation: the
  views and view models take an `isMotionReduced` binding and choose a quiet
  path (a fade for the burn and float, no sliding cards), and the model
  never knows. Where the setting comes from (the page, through bindings),
  and how to test both paths. Likely `adding-visual-polish/`.
- [ ] **The URL as a projection of the model.** The search and the entry
  playing are written to the query and the fragment from the model, after it
  changes (`watch`), and read back on load and on `hashchange`, through the
  model's methods. Where the URL belongs in MVT (outside it, like the
  renderer), and why the model never touches `location`. Likely
  `reacting-to-changes/`.

Add new terms to the glossary as they come, and the pages to the sidebar.

## Acceptance Criteria

- [ ] Each topic covered in the guide, or folded into an existing page
- [ ] Each links the Arcade's code as its example
- [ ] The Arcade's README links the pages, in place of this task

## Progress Log

- 2026-10-05: Created from 036's step 10, from the Arcade's README.
