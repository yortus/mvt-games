# A Self-Describing Perfmon Panel

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-02 |
| Updated  | 2026-10-02 |

## Description

The perfmon panel ([`src/common/perfmon-view.tsx`](../../src/common/perfmon-view.tsx))
shows seven stats, but most of its labels (`RPF`, `MPF`, `WPF`, `NPF`) mean
nothing to someone seeing them for the first time, and even `CPU` and `GPU`
don't say what their milliseconds are per. Every stat but FPS is per frame,
yet only four labels say so. Nothing on the panel explains the numbers: that
times are averaged over a window while counts come from one sampled frame,
how much history a sparkline holds, what the faint line marks, why the GPU
figure is an upper bound, or what `n/a` means.

The plan:

1. **Say "per frame" once.** FPS keeps its own row; a divider captioned
   "per frame" heads every row below it, so the `PF` suffixes go.
2. **Name rows after their `FrameStatKind`**, title-cased: CPU, GPU, Reads,
   Methods, Rebuilds, Visits. These match `FrameStats`' own names, so no new
   terms are coined. Values are right-aligned so magnitudes line up; only
   times carry a unit.
3. **Dim rows that show `n/a`**, so "not measured here" reads differently
   from a real zero.
4. **Add an (i) button** on the divider row that opens an info card: one
   line or two per stat, each stat's name in its row colour, plus how the
   values are gathered. The card sits over the panel, bottom-aligned with it
   and as wide, rising a fixed height (`PERFMON_INFO_HEIGHT`) over the host's
   neighbouring controls. Tapping it closes it. Whether it is open is
   presentation state held by the view.

The card is kept to the panel's width so it needs no host changes:
falling-sand right-aligns the panel and draws its tank after the toolbar,
while boids left-aligns it.

## Acceptance Criteria

- [x] No acronym on the panel other than FPS, CPU and GPU.
- [x] "Per frame" is stated once, covering every per-frame row.
- [x] Values right-aligned; rows showing `n/a` dimmed.
- [x] An (i) button opens a card explaining every stat; tapping the card
      closes it, and taps on it do not reach the controls beneath.
- [ ] The card fits above the panel in both falling-sand and boids, at
      desktop size and scaled down to a phone. Desktop checked; phone not
      yet (the canvas scales as a whole, so the card should too, but the
      (i) button's hit area, 30 by 24 canvas pixels, wants a try by finger).
- [x] No per-frame allocation added; the card's text is built once.
- [x] JSDoc, the falling-sand README and other mentions of the old labels
      updated.
- [x] `npm run build`, `npm run lint` and the tests pass.

## Progress Log

### 2026-10-02

- Task created from a review of the panel.
- Implemented in `src/common/perfmon-view.tsx`. The panel grows from 128 to
  144 pixels for the divider row; both hosts lay out from `PERFMON_HEIGHT`.
  The card's text uses Pixi's tagged text (`tagStyles`) to colour each
  label, and is built the first time the card is shown: measuring text at
  construction broke the falling-sand view tests, which run without a
  `document`. Its copy was cut until it fit `PERFMON_INFO_HEIGHT` (256), which
  is just under falling-sand's toolbar (262) and so stays clear of the tank.
- Two fixes found on the way:
  - `FrameStats` sampled its counters only after its first publish, so every
    count read `undefined` (shown `n/a`) for the first window even with
    counters attached. It now samples the first frame too (new test).
  - Boids in landscape sized the screen to the arena alone, so a short
    window cut the controls off (already so at 128 pixels). The screen is now
    at least `CONTROLS_HEIGHT` tall.
- Checked in headless Chrome over the DevTools protocol: both demos, card
  open and closed; a tap on (i) opens the card, and a tap on the card over
  CLEAR closes it without clearing the tank. `npm run lint`, `npm run build`
  and all 4,596 tests pass.
- The (i) was a 10px italic serif glyph, which rendered slanted, blurred and
  off-centre. It is now drawn with `Graphics` (a dot and a stem in a lightly
  filled ring), so it stays upright and centred at this size.
- Done. The phone-size criterion was left unchecked: the canvas scales as
  a whole, so the card should scale with it, but no one has tried the (i)
  by finger yet.
