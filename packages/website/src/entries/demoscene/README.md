# MVT Megademo

A looping, 2 minute 40 second show in the style of a 1980s C64 demo, cut to
125 beats a minute. Nothing to play: sit back, or press the left and right
cursor keys to skip between parts. Add `?crt=off` to the
page's address for crisp square pixels, or `?debug` for the raster-time bars
described below.

| Part | Bars | What to look for |
| --- | ---: | --- |
| Boot | 4 | A command types itself at a prompt, then the loader fills the frame with stripes that change every 50 Hz frame |
| Intro | 8 | Raster bars roll in from the top and bottom, across the borders, and captions fade through the fade table |
| Logo | 16 | The logo bounces in (FLD), then wobbles line by line (tech-tech) while raster bars pass behind it; a sine scroller runs in the opened lower border |
| Plasma | 12 | An 80 x 50 plasma in sixteen colours, cycling, with a DYCP scroller weaving through the middle |
| Vectors | 16 | Solid, lit, dithered 3D letters over a three-layer parallax starfield |
| Sprites | 12 | 48 ball sprites, as a spinning sphere and then six waving rows, on a chip that has eight |
| Credits | 16 | A smooth upscroller, colour-washed, then a fade to black and round again |

## What it shows

**A model that is only a function of time.** The show has no input, so
nothing has to accumulate: every value the model exposes, from the logo's
height to each ball's place, is computed from the show's clock alone
([`show-model.ts`](./models/show-model.ts) and the part models beside it).
Randomness, where a part wants any, comes from a stateless hash of an index,
not a generator. So `seek` is as good as playing to the same time and costs
nothing, which is what makes skipping between parts trivial, and lets the
Arcade's thumbnail start 17 bars in without simulating them. A test plays
the whole show in uneven steps and checks that seeking agrees at every point.

**A view with no state.** [`ScreenView`](./views/screen-view.ts) has no update
step and keeps nothing between frames but its buffers: every frame is drawn
from scratch from the model. It is the plainest example in this repo of a
view as a projection of the model, and a test holds it to that.

**What belongs in the model.** The test used here: anything a second,
different view of the same show would need is the model's. A "remastered"
view, drawing the show in smooth modern graphics, would need to know where
the logo is, how far the scroller has scrolled, how the letters are turned
and where the 48 balls are. It would not care about character sets, colour
clash or sprite slots. So the model owns the choreography, in character
rows and columns, turns, beats and object space; the view owns how an 8-bit
machine would draw it.

**One view and painters, not a view per effect.** The effects share one frame,
composed by the chip's rules (raster bars show through the logo's background
pixels; a sprite can sit behind the text), and `refreshView` refreshes
parents before children, so a parent could not compose its children's
output. So one view resets the chip each frame, calls the playing part's
painter ([`painters/`](./views/painters/)), composes the frame and uploads
it as one texture, as falling sand's pixel view does.

## The virtual chip

Every frame is drawn through [`VirtualChip`](./views/chip/virtual-chip.ts), a
small model of the C64's video chip, the VIC-II. It is not an emulator (no
CPU, no timing), but its memory has the original's shape, so it has the
original's limits:

- **Screen and colour memory**, a byte per 8 x 8 cell of the 40 x 25 screen:
  a cell of text has one colour on the background, and a cell of
  multicolour bitmap has three of its own.
- **A character set** of 256 characters, which painters redefine every frame
  for the DYCP scroller.
- **Bitmap memory**, laid out cell by cell as the chip reads it, at 320 x 200
  or 160 x 200 in fat multicolour pixels.
- **Registers on every line**: border and background colours, display mode,
  a horizontal shift, and which display line the line shows. These make the
  raster bars, the split between the logo's bitmap and the text below it,
  tech-tech, FLD and the upscroller's fine scroll.
- **A pool of 64 sprites and eight hardware slots.** The
  [multiplexer](./views/chip/multiplexer.ts) hands the slots out down the
  frame, reusing each one once its sprite has ended. A sprite that finds no
  slot is dropped. The sprites part is choreographed (in its model) so that
  no line ever needs more than eight, and a test plays the whole show
  through the multiplexer to check that nothing is dropped.

[`composeFrame`](./views/chip/compose-frame.ts) turns it all into a frame of
palette indices, 384 x 272 with the borders. The view maps them to RGB at the
show's brightness through a fade table (fades step down through darker
colours of a similar hue, never through alpha), doubles each line as a darker
scanline when the CRT look is on, and uploads.

### Where it cheats

So that nobody mistakes the demo for a claim about the hardware:

- **Registers can change on every line, all of them.** The real chip had 63
  CPU cycles a line, enough to rewrite a few.
- **The horizontal shift is any number of pixels.** The hardware's fine
  scroll is 0-7; real tech-tech combined it with moving the screen.
- **No badlines, and the side borders are never opened.** Only the top and
  bottom, as most demos of the era managed.
- **The filled vectors use a depth buffer**, which a 1 MHz machine could not
  afford: real ones sorted faces.

## Debug bars

With `?debug`, the borders show what demo coders used to see by changing the
border colour while their code ran: down the right, a white bar as long as
the frame's paint and compose took (a 50 Hz frame is the whole height); down
the left, how many sprites each line shows, red where all eight slots are in
use.

## Performance

Measured headless on the development machine (Intel Core Ultra 9 185H),
painting and composing a frame takes 0.23-0.62 ms depending on the part,
the sprites part being the most; the `games-and-demos` benchmark suite puts
the demo's first minute at 0.41 ms a frame. It allocates a few hundred bytes
a frame, about 850 in that suite: no code in the painters or the chip makes
objects, and the bytes look like numbers V8 boxes as the part models'
getters return them. That is 29 young-generation collections a minute,
3.8 ms in all.

## Originality

Techniques, the palette and the look belong to no one; titles, artwork and
music do. The font, the logo and the sprite shapes are drawn for this demo
([`data/`](./data/)), as text art or computed. The boot screen uses the
familiar colours and its own words. There is no music yet; if there is ever
a tune, it will be an original one. See
[proposal 035](../../../../../notes/proposals/035-demoscene-demo.md).
