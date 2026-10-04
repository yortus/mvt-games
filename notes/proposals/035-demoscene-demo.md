# Proposal: A Demoscene Demo

> A new demo for the gallery: a three-minute, non-interactive show in the style
> of a 1980s home-computer demo, the kind demo groups made for the C64. Raster
> bars, a wobbling logo, a sine scroller in the border, plasma, filled vectors,
> more sprites than the machine has, and a credits roll, all in a 16-colour
> palette at 320x200, cut to a beat. The limits are real, not just a filter:
> the screen is drawn through a small virtual video chip whose memory layout
> carries the original hardware's rules, so every effect has to use the tricks
> demo coders used to get around them. For MVT it is the purest program in the
> repo: no input, a model that is a clock and a script, and views that hold no
> state at all, which makes pause, seek and thumbnails free.

**Status:** proposed. Nothing implemented.

**Written:** 2026-10-03, against `vnext` at `dd3ec54`. Checked against the demo
registry ([`demo-entry.ts`](../../packages/website/src/demos/demo-entry.ts),
[`main.ts`](../../packages/website/src/demos/main.ts)), the falling-sand pixel view, which
this design copies for its texture upload, and the animation pages of the docs.
Nothing has been spiked or measured; the performance figures in section 9 are
estimates to be checked in step 1.

**Related:**
[`grain-pixels-view.ts`](../../packages/website/src/demos/falling-sand/views/grain-pixels-view.ts) -
[Complex Sequences](../../docs/building-with-mvt/animating-transitions/complex-sequences.md) -
[Open-Ended Phases](../../docs/building-with-mvt/animating-transitions/open-ended-phases.md) -
[Presentation State](../../docs/building-with-mvt/adding-visual-polish/presentation-state.md) -
[Hot Paths](../../docs/building-with-mvt/performance/hot-paths.md) -
[Originality](../../packages/website/src/games/README.md#originality) (the rules this demo follows from day one) -
[033](../tasks/backlog/033-fruit-machine-demo/task.md) (the other demo in the pipeline) -
[026](../tasks/backlog/026-demos-screen-for-every-renderer.md)

---

## Summary

| # | Decision | Recommendation | Section |
| --- | --- | --- | --- |
| 1 | What the demo is | A looping 2 min 40 s show in seven parts, at 125 BPM, in the gallery as a Pixi demo | [1](#1-the-show) |
| 2 | How faithful | A virtual video chip whose data structures carry the hardware's limits. Not an emulator: no CPU, no cycle timing | [3](#3-the-virtual-video-chip) |
| 3 | What the model owns | The clock, the script, and the choreography (what is where, when), in character cells, turns and beats | [4](#4-the-model) |
| 4 | How it is computed | Every value is a closed-form function of show time, with no accumulated state, so seeking costs nothing | [4.3](#43-closed-form-no-accumulated-state) |
| 5 | What the view is | One plain-TypeScript view owning the virtual chip, and a painter function per effect. No presentation state | [5](#5-the-view) |
| 6 | Art, font and music | All original. No Commodore name, boot banner, character ROM or SID rips | [7](#7-originality) |
| 7 | Music | Not in the first version. The show is beat-timed from the start, so an original tune can be added later as an audio view | [8](#8-music-later) |

---

## 1. The Show

A demo, in the demoscene sense, is a real-time audiovisual show that exists to
make an audience at a party say "that can't run on that machine". The C64 era
(roughly 1985-1992) gave the form most of its vocabulary: raster bars, sine
scrollers, tech-tech, DYCP, FLD, plasmas, vector bobs, opened borders and
sprite multiplexers. This demo performs that vocabulary in order, roughly from
the tricks of 1985 to the tricks of 1990, so it also reads as a short history.

At 125 BPM a beat is 480 ms and a bar 1.92 s. Parts start on bar lines, and
effects hit beats (a border flash on every bar, the logo dropping on a
downbeat), so the show feels cut to music before there is any.

| # | Part | Bars | Time | What happens |
| --- | --- | ---: | --- | --- |
| 0 | Boot | 4 | 0:00 | A light-blue-on-blue boot screen in our own wording; `LOAD"MEGADEMO",8,1` types itself; the border fills with loading stripes |
| 1 | Intro | 8 | 0:08 | Black. Raster bars roll in from the top and bottom and cross. "MVT PRESENTS" fades up and down through the palette's brightness ramp |
| 2 | Logo | 16 | 0:23 | The multicolour MVT logo drops in and bounces (FLD), then wobbles line by line (tech-tech) with raster bars passing behind it. A big sine scroller runs through the opened lower border |
| 3 | Plasma | 12 | 0:54 | A full-screen colour plasma, colour-cycled, with a DYCP scroller weaving across it |
| 4 | Vectors | 16 | 1:17 | A filled, flat-shaded 3D object (the letters M, V, T, extruded) turns over a three-layer parallax starfield |
| 5 | Sprites | 12 | 1:48 | 48 ball sprites on a rotating sphere and then a Lissajous snake, six times the machine's eight, with a counter saying so |
| 6 | Credits | 16 | 2:11 | An upscroller of credits and greetings in colour-washed text, then a fade to black and back to part 0 |

84 bars, 161 s, then it loops. Each part fades in and out through fade tables
(section 3.4) rather than alpha, as the originals did.

**Interaction:** none required. The gallery's runner already offers back and
Escape. Section 10 asks whether to add keys for pause and part skipping, which
section 4.3 makes trivial.

**Screen:** the PAL visible area, 384x272 pixels (the 320x200 screen inside a
32-pixel side border and 35/37-pixel top and bottom borders), shown at 2x as a
768x544 canvas. Square pixels; the real machine's 0.94 pixel aspect is not
reproduced.

---

## 2. Effects

Every effect, the trick it imitates, and the chip feature (section 3) it is
built from. "Core" effects are in the first complete version; "stretch" ones
are candidates if time allows.

| Effect | Part | The original trick | Built from | |
| --- | --- | --- | --- | --- |
| Loading stripes | 0 | The tape loader changed the border colour as bits arrived | Per-line border colour, seeded hash of (frame, line) | Core |
| Raster bars | 1, 2 | Background colour rewritten on every raster line, so bars pass behind text | Per-line background colour, 7-line brightness ramps on sines | Core |
| Palette fades | all | Fade tables: each colour steps to the next darker one by brightness | A global fade level mapped through a 16x8 fade table | Core |
| FLD bounce | 2 | Flexible Line Distance: delaying character rows to push the screen down | Per-line character-row start | Core |
| Tech-tech | 2 | Shifting each line horizontally by its own amount | Per-line horizontal offset | Core |
| Multicolour logo | 2 | 160x200 fat-pixel mode, four colours per character | Multicolour character mode, custom character set | Core |
| Border scroller | 2 | Opening the lower border so sprites can show there | Sprites, the open-borders flag | Core |
| Colour plasma | 3 | Rewriting only colour memory each frame, 1000 bytes | Colour memory plus 2x2 dither characters, for 80x50 blocks | Core |
| DYCP scroller | 3 | Different Y Character Position: each letter on its own sine, by redrawing a strip of characters | Character-set redefinition in a 40x4 strip | Core |
| Filled vectors | 4 | Span-filled polygons in a multicolour bitmap | Multicolour bitmap, span filler with ordered-dither shades | Core |
| Parallax starfield | 4 | Single-pixel stars at three speeds | Bitmap plots behind the vectors | Core |
| Sprite multiplexer | 5 | Reusing the eight sprites further down the screen, every frame | The virtual sprite pool and its multiplexer (section 3.3) | Core |
| Colour wash text | 6 | Cycling colour memory diagonally across static text | Colour memory | Core |
| Upscroller | 6 | Smooth vertical scroll by the hardware's fine scroll and a row copy | Per-line character-row start | Core |
| Rotozoomer | 5 | A chunky 80x50 rotozoom, rare on the machine and a showpiece when done | 2x2 dither characters, as the plasma | Stretch |
| Twister | 3 | A rotating bar drawn line by line from a sine table | Per-line offset and colour into a narrow bitmap column | Stretch |
| CRT look | all | Not a trick: the TV it ran on | A Pixi filter (scanlines, slight glow) over the canvas | Stretch, section 10 |

---

## 3. The Virtual Video Chip

### 3.1 Why not just draw pixels

A 384x272 RGBA canvas can draw anything, and a demo drawn on one would look
retro without being constrained. The look of the era came from its limits:
colour clash because a character cell has one foreground colour, fat pixels
because four colours cost half the horizontal resolution, raster bars because
changing a register between lines was cheap and drawing was not. Imitating the
look without the limits produces something that feels subtly wrong, the way
"pixel art" fonts at the wrong scale do.

So the screen is drawn through a **virtual video chip** (`VirtualChip`),
modelled on the C64's VIC-II, whose memory has the original's shape. The
limits are in the data structures, not in a checker: a hires character cell
has one nibble of colour memory, so it cannot hold a second foreground colour,
and nobody has to test that it doesn't. Pushing the limits means doing what
the originals did: changing registers per line, redefining characters every
frame, reusing sprites.

**Settled; do not reopen without new information:** this is not an emulator.
There is no 6502, no cycle counting, no badlines and no bank switching. The
goal is the look and the vocabulary of constraints, not running real programs.

### 3.2 What it holds

| Structure | Shape | Original |
| --- | --- | --- |
| Screen memory | `Uint8Array(1000)`, a character code per cell of the 40x25 grid | $0400 |
| Colour memory | `Uint8Array(1000)`, one colour (0-15) per cell | $D800 |
| Character set | `Uint8Array(2048)`, 256 characters of 8 bytes | The character generator |
| Bitmap | `Uint8Array(8000)`, 320x200 at 1 bit or 160x200 at 2 bits per pixel | Bitmap mode |
| Per-line registers | Typed arrays of 272, one entry per visible line: border colour, background colour, display mode, horizontal offset, character-row start, the two shared multicolours | Registers rewritten by raster interrupts |
| Sprite pool | Up to 64 virtual sprites: x, y, shape, colour, multicolour, expand, priority | Eight hardware sprites, multiplexed |
| Sprite shapes | `Uint8Array(64 * 63)`, 24x21 at 1 bit per pixel | Sprite pointers |
| Flags | Open borders | The border-opening trick |

The display modes are the four the demo needs: hires and multicolour
characters, hires and multicolour bitmap. Because mode is a per-line register,
split screens (a bitmap logo above a text scroller) come free, as they did on
the original.

### 3.3 Sprites and the multiplexer

The pool holds up to 64 sprites, but the chip draws at most **eight on any
line**, the hardware's real limit. Each frame the multiplexer sorts the pool by
`y` (an insertion sort into preallocated arrays: the order barely changes
between frames) and hands out the eight hardware slots line by line, reusing a
slot once its sprite has ended. A sprite that finds no free slot is dropped,
which on the real machine shows as flicker.

The sprites part (5) is choreographed so nothing drops. The sphere is six rings
of eight balls, at least 21 lines (a sprite's height) apart, spun about its
vertical axis, so each ring stays at its height and no line ever crosses more
than one ring; the snake that follows has its curve's vertical spread chosen
the same way. A test plays the whole show and asserts
the multiplexer never dropped a sprite, which is the demo coder's own
discipline turned into a check.

### 3.4 Palette and fades

Sixteen fixed colours, from the published luma and chroma measurements of the
VIC-II (Philip Timmermann's analysis, as used by most emulators). A colour
palette is a fact about the hardware, not anyone's expression.

Fades never touch alpha. A **fade table** maps each colour to the next darker
one with a similar hue, eight steps to black, and the chip applies the global
fade level through it when it composes the frame. Raster bars use the same
brightness ordering for their ramps.

### 3.5 Composing a frame

`composeFrame(chip, out)` walks the 272 visible lines. For each line it reads
the line's registers, draws the border or the 320-pixel screen area in the
line's mode (through the character-row start and horizontal offset), draws the
sprites assigned to the line in priority order, and writes palette indices
(0-15) into `out`, a `Uint8Array(384 * 272)`. The view then converts indices to
RGBA through a 16-entry lookup table, after the fade table, and uploads.

### 3.6 Where it cheats

Things the real chip could not do, or could only do with cycle-exact code that
this demo does not imitate. The README lists them so nobody mistakes the demo
for a claim about the hardware.

- **Per-line registers are unlimited.** The real machine had 63 cycles per
  line, enough to rewrite a few registers; here every line can change all of
  them. The show uses no more than three per line, which is plausible.
- **Horizontal offset is any number of pixels,** where the hardware's fine
  scroll is 0-7. Real tech-tech combined fine scroll with a moving screen
  pointer to the same effect.
- **The side borders are never opened.** Top and bottom only, as most demos
  of the era managed.
- **No badlines,** so FLD and the upscroller have no timing to get right.

---

## 4. The Model

All under `packages/website/src/demos/demoscene/models/`, in domain units: milliseconds,
beats, turns, character cells and 3D object space. Nothing in the model knows
about pixels, raster lines or the chip.

### 4.1 What belongs in the model

Proposed test: **anything a second, different view of the same show would
need is the model's.** Imagine a "remastered" view drawing the show in smooth
modern vector graphics (section 10 asks whether to build it). It would need to
know which part is playing, where the logo is, how far the scroller has
scrolled, which way the cube is facing and where the 48 balls are. It would
not need to know about character sets, colour clash or sprite slots.

So the model owns the **choreography**: the clock, the script of parts, the
beat, and every position, angle, offset and fade level. The view owns the
**rendering**: how a 1985 machine would draw that choreography, in its
palette, at its resolution, within its limits.

This also answers [Presentation State](../../docs/building-with-mvt/adding-visual-polish/presentation-state.md)'s
question, "if the view were deleted, would the application still behave
correctly?": for a show, the choreography is the behaviour.

Coordinates follow rule 6: like the grid games, positions are fractional
`row` and `col` on the 40x25 character grid. Things in the border have rows
below 0 or above 25.

### 4.2 Interfaces

```ts
type PartKind = 'boot' | 'intro' | 'logo' | 'plasma' | 'vectors' | 'sprites' | 'credits';

interface ShowModel {
    /** Milliseconds since the show began, wrapping at the end of the loop. */
    readonly timeMs: number;
    /** Fractional beats since the show began; a bar is four. */
    readonly beat: number;
    readonly part: PartKind;
    readonly partElapsedMs: number;
    /** 0 at the part's start, 1 at its end. */
    readonly partProgress: number;
    /** 0 for black, 1 for full colour; the part transitions. */
    readonly brightness: number;
    readonly boot: BootModel;
    readonly intro: IntroModel;
    readonly logo: LogoPartModel;
    // ...one per part
    /** Jumps to any time in the show; nothing else changes. */
    seek: (timeMs: number) => void;
    update: (deltaMs: number) => void;
}

interface LogoPartModel {
    /** 0..1: the logo's drop and bounce into place. */
    readonly drop: number;
    /** The wobble, in turns, and its amplitude in character columns. */
    readonly wobblePhase: number;
    readonly wobbleCols: number;
    readonly bars: readonly RasterBar[];
    readonly scroller: ScrollerModel;
}

interface ScrollerModel {
    /** The scroller's text. Read once. */
    readonly text: string;
    /** How far it has scrolled, in characters of text; fractional. */
    readonly offset: number;
}

interface RasterBar {
    /** The bar's centre, as a fractional row; may be in the border. */
    readonly row: number;
    readonly ramp: RampKind;
}
```

Part models are small: a handful of getters each. The script (part order,
lengths in bars, texts) is data in `data/`.

### 4.3 Closed form, no accumulated state

Every value the model exposes is a **pure function of show time**. `update`
adds `deltaMs` to `timeMs` and wraps it; every getter computes from `timeMs`.
There is no velocity integrated frame by frame, no particle list, no random
generator advanced per frame. Where the effect wants randomness (loading
stripes, star positions), it uses a stateless integer hash of a seed and an
index; where it wants motion that changes speed, the speed is piecewise linear
in time so its integral has a closed form.

What this buys:

- **Seek is free.** `seek(t)` sets `timeMs`. Skipping to the plasma does not
  mean simulating a minute of logo.
- **The thumbnail is any moment.** The gallery advances a demo by
  `thumbnailAdvanceMs` before rendering its thumbnail; this one can choose the
  logo part at its best and cost almost nothing to get there.
- **Seek and play agree, by construction**, and a test holds them to it: play
  to time `t` in random-sized steps, seek a second model to `t`, compare every
  getter.
- **Pausing, slow motion and single-stepping work** with no help from the demo,
  since the host already owns pausing.

Getters compute on every read, which is fine at the handful of values per part
per frame. A part with a lot of derived state (the 48 sprite positions, the
rotated vertices) computes it once per `update` into preallocated arrays, which
is still closed form: the arrays are a cache of a function of `timeMs`.

This is the main contrast with a game, and worth saying in the README: in a
game, state accumulates from input and cannot be recomputed from the time
alone. A show has no input, so it can be.

---

## 5. The View

All under `packages/website/src/demos/demoscene/views/`.

### 5.1 One view and painters, not a view per effect

The natural MVT shape would be a view per effect, composed in a tree. It does
not fit here, for three reasons:

- **Effects share one frame.** Raster bars show through the logo's background
  pixels; sprites sit in front of or behind characters by priority. Composing
  needs the chip's rules, not Pixi's display order.
- **Order.** `refreshView` refreshes parents before children, so a parent view
  cannot compose and upload a frame after its children have written into it.
- **One texture, one upload.** Like `GrainPixelsView`, the cheapest way to show
  a framebuffer that changes completely every frame.

So there is one view, `ScreenView` (plain TypeScript, which the style guide
suggests for views that mostly draw), and a **painter** per effect. A painter
is a plain function, `paintLogoPart(chip, part)`, that reads a part model and
writes the chip's memory and registers. `ScreenView`'s refresh clears the chip,
calls the painters for the current part, composes the frame, maps it through
the palette and uploads. The chip and the painters are internal to the view,
and testable without Pixi.

The top-level view takes `{ model }`, as top-level views do, and the painters
take the part models directly for the same reason: they are this application's
own, never reused.

### 5.2 No presentation state

Because the model is closed form and owns the choreography, `ScreenView` has
no `update` method and keeps nothing between frames except its preallocated
buffers. Every frame is drawn from scratch from the model. That makes it the
plainest example in the repo of a view as a pure projection, which is worth a
line in the README.

### 5.3 Pixi

One `Sprite` of a 384x272 `BufferImageSource` texture with `scaleMode:
'nearest'`, scaled 2x. The gallery shrinks the canvas when the window is
smaller than 768x544, which makes the pixels uneven; section 10 asks whether
the CRT filter should hide that, or the demo should snap to whole multiples.

---

## 6. Files

```
packages/website/src/demos/demoscene/
├── README.md               What to look for, the effects, where the chip cheats
├── demoscene-entry.ts      createDemosceneEntry(): DemoEntry
├── index.ts
├── data/                   The script, texts, font, logo, sprite shapes, palette, fade table
├── models/                 ShowModel and a model per part; hash and easing helpers
└── views/
    ├── screen-view.ts      The one Pixi view
    ├── chip/               VirtualChip, composeFrame, the multiplexer (each with tests)
    └── painters/           One painter per effect
```

The font, logo and sprite shapes are drawn as text art in `data/` (rows of `.`
and `#`, or of `.123` for multicolour), parsed once when the demo loads, so
they can be edited in a text editor and reviewed in a diff.

---

## 7. Originality

This demo follows the games'
[originality rules](../../packages/website/src/games/README.md#originality) from the
start: ideas and techniques are free; titles, artwork, character designs and
music are not.

- **Techniques, palette and the look are free.** Raster bars, scrollers and a
  16-colour palette belong to no one.
- **No Commodore name, logo or boot banner.** Part 0's boot screen uses the
  familiar colours and our own words ("MVT SHOW SYSTEM", "READY."). The demo's
  description may say "in the style of the C64" as plain description.
- **No character ROM.** The machine's built-in font is Commodore's work; this
  demo draws its own 8x8 font.
- **No ripped music or graphics** from any demo or game, should music be added
  (section 8).
- **Greetings are generic** ("to everyone who ever timed a raster
  interrupt"), not to real groups, which could read as a claim of association.

---

## 8. Music, Later

A demo without music is half a demo, but music is a project of its own: an
original tune, and a small three-voice synthesiser in Web Audio imitating the
SID chip's character (pulse with width modulation, sawtooth, triangle, noise,
ADSR envelopes, a resonant filter sweep). Neither is needed to show the
visuals, so the first version is silent.

The first version is still **beat-timed** (section 1), so a tune drops in
later without re-cutting the show. When it does, it is an **audio view**: it
reads the model's beat each refresh and schedules the next few notes ahead on
Web Audio's clock, rescheduling when the beat jumps (a seek, or a resumed
pause). The model stays the single authority on time; the audio follows it,
as the screen does. Browsers only start audio after a user gesture, which the
demo can turn into an authentic "PRESS SPACE" screen.

This would be the repo's first audio view, and its sync with a model clock is a
useful pattern to document. A separate proposal when the time comes.

---

## 9. Testing and Performance

**Tests:**

- Show model: seek and play agree (section 4.3); the loop wraps; part
  boundaries fall on bar lines; brightness is 0 at every part change.
- Chip: `composeFrame` against small hand-built cases per mode (one cell, one
  line, one sprite in front of and behind a character); the multiplexer never
  draws more than eight sprites on a line, and reuses slots correctly.
- The whole show: played at 50 frames a second, the multiplexer drops nothing.
- Golden frames: a hash of the composed frame at one moment per part, so a
  change to a painter or the chip that changes the picture is noticed.
- Data: every glyph and sprite shape has the right size and only legal
  characters.

**Performance**, estimated: composing 104,448 pixels, mapping them through the
palette and uploading 418 KB should take 1-2 ms per frame in JavaScript; the
heaviest painter (vector spans over a 160x200 bitmap) well under 1 ms. Target:
**under 3 ms CPU per frame** on the development machine, measured in step 1
with the bare chip before any painter is written, and added to the
`games-and-demos` benchmark suite. If composing is too slow, the fallback is to
upload the 8-bit index buffer as a single-channel texture and do the palette
lookup in a shader.

All the hot-path rules apply: no allocation in `update` or `refresh`, index
loops, preallocated arrays.

---

## 10. Open Questions

1. **Name.** Proposed: id `demoscene`, name "MVT Megademo" ("megademo" being
   the era's own word for a multi-part demo). Alternatives welcome.
2. **Keys.** Space to pause and left/right to skip parts cost a few lines,
   given section 4.3, and make the demo easier to enjoy and to debug.
   Proposed: add them, and say so on the boot screen.
3. **CRT filter.** A subtle scanline and glow filter makes the look, and hides
   uneven pixels when the gallery shrinks the canvas, but it is not part of the
   machine. Proposed: on by default, with `?crt=off` in the URL, like
   falling-sand's switches.
4. **A remastered view.** A second view drawing the same model in smooth
   modern graphics, switched with a key, would show "one model, many views" as
   033 does, from a different angle. Proposed: not in this proposal; revisit
   once the show exists. The model is designed so it could be added (section
   4.1).
5. **Display rate.** Real PAL demos ran at exactly 50 frames a second, and
   effects stepped once a frame. Proposed: run at the display's rate and snap
   positions to whole pixels; offer no 50 Hz mode.
6. **Raster-time bar.** Demo coders changed the border colour while their code
   ran, to see how much of the frame it took. A `?debug` switch could draw the
   painters' real CPU time that way in the right border, plus a column of
   sprite slots per line. Proposed: yes, it is cheap and on theme.

---

## 11. Implementation Steps

1. **The chip.** `VirtualChip`, `composeFrame`, palette, fade table, and the
   multiplexer, with tests. `ScreenView` showing a static test frame. Register
   the entry. Measure composing and upload (section 9) before going further.
2. **Font and boot.** The 8x8 font as text art; the show model's clock,
   script, beat, seek and brightness, with the seek-and-play test; part 0.
3. **Intro and logo.** Raster bars, fades, FLD, tech-tech, the multicolour
   logo, the border scroller. This is the thumbnail.
4. **Plasma and vectors.** Colour plasma, DYCP, the span filler, starfield.
5. **Sprites and credits.** The 48-sprite choreography with the no-drop test,
   upscroller, colour wash, the loop.
6. **Polish.** Open questions 2, 3 and 6 as decided; golden frames; the
   benchmark; the README; the entry's description and techniques.
7. **Later, separately:** music (section 8), stretch effects, the remastered
   view.
