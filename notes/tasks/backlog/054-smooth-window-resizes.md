# Smooth Window Resizes While an Entry Plays

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-16 |
| Updated  | 2026-10-16 |

## Description

While an entry plays, resizing the browser window blanks the screen and
makes the sound choppy until the resize ends. The owner saw it in Kwazy
Cactii, Neon Monsoon and the Tune Tracker, so it is the Arcade's host, not
any one entry.

The sound is choppy because the main thread stalls. The sound chip plays
each note a short lead after it is written (35 ms by default, in
`packages/libraries/audio/src/web/chip-clock.ts`). A frame that takes
longer than that leaves the chip without its next notes, so they arrive
late. The screen blanks because the canvas is given a new size, which
clears it, and the next frame is late to draw it again.

### What happens on each step of a resize

- **The host fits the entry again.** `entry-host.ts` follows its element
  with a `ResizeObserver`, which fires on every frame of a drag. Each time,
  `pixi-stage.ts` calls `app.renderer.resize`, which gives the canvas a new
  drawing buffer. Measured in the Audio90 branch, in Playwright's headless
  shell: about 7 ms of script a step in Pixi's `resizeCanvas`, for every
  Pixi entry, before the GPU's own work.
- **The Arcade lays itself out behind the entry.** The card wall's
  `ResizeObserver` (`card-wall-view.tsx`) measures its width and every
  card's height, and the wall's effect (`wall-effect-view.ts`) and the head
  (`arcade-head-view.tsx`) follow the window too, though none of them is
  seen while an entry plays. A profile of a resize showed the cards' `place`
  and `fitToWidth`, and their photos, at work.

### Measured so far

On 2026-10-16, with 40 resizes of the viewport while each entry played
(Playwright's headless shell, the Audio90 branch). With the GPU, every Pixi
entry tried had one or two frames over 35 ms out of about 160, the longest
50 to 83 ms. Drawn in software, an entry that draws thousands of sprites
was far worse, until it drew its unchanging parts into textures. A viewport
resize in a headless browser is not a real window drag, so the first step
is to measure in a real browser.

### Ideas, not yet tried

- Resize the canvas's drawing buffer at most every 100 ms or so while the
  size keeps changing, and once more when it settles. In between, scale the
  canvas with CSS, so the picture stretches for a moment instead of
  blanking.
- Pause the Arcade's own layout while an entry plays: the card wall, the
  head and the wall's effect lay themselves out once, when the entry is
  closed.
- Keep the chip's lead as it is unless the stalls cannot be fixed. A longer
  lead hides them, but every sound reacts later.

## Acceptance Criteria

- [ ] Measured in a real browser: how long frames take while the window is
      dragged, with an entry playing music, before and after.
- [ ] Dragging the window does not blank the screen, or blanks it only for a
      frame.
- [ ] No frame takes longer than the chip's lead while the window is
      dragged, so the music does not stutter.
- [ ] The Arcade behind the entry is laid out right when the entry closes.

## Progress Log

- 2026-10-16: Created. Found while playtesting the Tune Tracker on the
  Audio90 branch; the owner then saw the same in Kwazy Cactii and Neon
  Monsoon.
