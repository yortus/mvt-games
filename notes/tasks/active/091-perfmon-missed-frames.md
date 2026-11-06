# The Perfmon: Frames Missed While the Main Thread Is Free

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-11-06 |
| Updated  | 2026-11-06 |

## Description

While playtesting Penrose Tiling, panning at full zoom-out fell from 60 to about
45 FPS and looked choppy, yet the Perfmon's CPU figure stayed near 1.2 ms. A
trace showed why: the main thread was nearly idle, and the GPU process was busy
for the whole trace, almost all of it in `SkCanvas::drawPath`. Canvas 2D calls
only record commands. The drawing happens later, off the main thread, so the CPU
figure can't see it.

The GPU row didn't help either. It uses WebGL timer queries, so it only works
for Pixi, and `start-site-page.ts` marks it n/a for every other kind of entry.
Canvas 2D has no GPU timer in any browser. All the visitor had was FPS falling
beside a healthy CPU figure, with nothing to connect the two.

### What was built

- A Missed row, `missedShare` in `PerformanceSample`: the share of the frames the
  display could have shown that went missing though the main thread had time to
  spare. It works for every renderer.
- `estimateFrameBudgetMs` in `@mvtjs/utils`, moved out of `PerfmonView`, so the
  meter and the view agree on the budget.
- A CPU explanation that says the browser's own drawing isn't counted, and a
  paragraph on reading the row in `@mvtjs/html`'s README. The book doesn't cover
  the Perfmon, so that README is its home, not Appendix D as first planned.

### How it's measured

For each window, the meter compares the frames that came with the frames the
display could have shown, and takes off the time lost after any frame whose own
work took half its budget or more. Less than one frame's shortfall is ignored,
as jitter. A gap of a second or more is taken for a hidden page, and nothing is
counted in the first window, before the budget is known.

### What was tried first, and why it isn't that

The first version counted frames that arrived over 1.5 budgets after the last.
It looked perfect on a severe case, at 5 FPS. On milder ones it failed: in
Playwright's headless shell, gaps aren't whole vsyncs, they spread smoothly from
17 to 30 ms. So a threshold made a cliff, with 44 FPS reading 9% and 35 FPS
reading 98%. The owner's 45 FPS case would hardly have shown. Comparing whole
windows has no threshold, so it doesn't matter how the gaps fall.

A WebGL fence (a tiny context asking when the GPU process has caught up) also saw
the problem, but read 60 ms for slow JS, because its polling waits for the main
thread, and it would add a WebGL context to every page with the Perfmon open.
Reading a pixel back to force the drawing to finish was ruled out without a test:
readbacks can move a canvas off the GPU, so the meter would change what it
measures.

### Results

The real Perfmon on the real demo, with the old drawing brought back by a patch
inside the test browser, batching every Nth colour:

| Case | FPS | Missed | CPU |
| --- | --- | --- | --- |
| Healthy | 60 | 0% | 1.7 ms |
| Every 8th colour | 50.5 | 16% | 1.7 ms |
| Every 6th colour | 42.7 | 28% | 1.7 ms |
| Every 5th colour | 35.3 | 41% | 1.7 ms |
| Every 4th colour | 30.3 | 49% | 1.7 ms |
| Every 3rd colour | 22.2 | 63% | 1.8 ms |
| Every colour, the old bug | 5.5 | 89% | 1.8 ms |
| Slow JS (28 ms busy) | 33 | 0% | 29 ms |
| The old bug, from the moment the Perfmon opened | 5 | 83% | 1.3 ms |

### What to watch for

- It can't name the GPU. It only says the time wasn't lost to the frame's own
  JS. A compositor backlog, another busy app or main-thread work between frames
  could all cause it, so the label mustn't say GPU.
- It needs the display's rate. If frames have been slow since the meter started,
  `estimateFrameBudgetMs` rounds the best rate it has seen to a common refresh
  rate. So 5 FPS reads 83% rather than 92%, and a steady 45 FPS from the very
  start would round to 48 and read about 6%. Opening the Perfmon before the slow
  part gets it right.
- A display rate that isn't in `REFRESH_RATES`, such as 85 Hz, rounds to a faster
  one, so it could show a small false Missed figure. Add the rate if that turns
  up.
- A frame whose own work takes half its budget or more explains the time lost
  after it, even when the real cause was elsewhere. The CPU row will be high for
  such a frame, so there's still a clue.

## Acceptance Criteria

- [x] The Perfmon shows a Missed row for every kind of entry
- [x] Slow rendering shows in it, at severe and mild levels, and slow JS and a healthy entry don't
- [x] The budget it uses holds up for an entry that is slow from the start
- [x] The CPU row's explanation says the drawing itself isn't counted
- [x] `@mvtjs/html`'s README says how to read the new row
- [x] Tests for `@mvtjs/utils` and `@mvtjs/html`, and a changeset for both
- [ ] Seen in the owner's own Chrome. Everything above ran in Playwright's headless shell, where the old bug ran at 5 FPS rather than 45
- [ ] Tried in Firefox and Safari

## Progress Log

- 2026-11-06: Measured two signals on a bare page, and bookmarked the idea.
- 2026-11-06: Built late frames, found the cliff on mild slowdowns, and rebuilt it as missed frames. Everything above is in the working tree, uncommitted.
