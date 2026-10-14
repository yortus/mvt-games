# How It Works

Visual tests tend to be slow, and to give different images on different
machines. A slow suite doesn't get run, and a suite whose images differ
between machines fails for reasons nobody can fix, so people learn to
ignore it. This page explains how v-snap avoids both, and shows the
measurements.

- [Speed](#speed)
- [The Benchmark](#the-benchmark)
- [The Same Images on Every Machine](#the-same-images-on-every-machine)
- [Checks Before Every Run](#checks-before-every-run)
- [Why Not Docker, or References for Each System?](#why-not-docker-or-references-for-each-system)

## Speed

The usual way to test a view's looks is to take a screenshot of it, as
Vitest's `toMatchScreenshot` and Playwright's `toHaveScreenshot` do. A
screenshot waits for the browser to show a frame, encodes it as a PNG,
and sends it to Node. Most tools also take screenshots until two in a row
agree, so that an animation can't fail a test. Each test file also gets a
fresh page, which loads its libraries again. So each image costs a hundred
milliseconds or more, before any drawing.

v-snap avoids most of that work for views drawn on a canvas.

- **Canvas test files share one page.** The libraries load once, and
  shaders compile once, rather than once for each file.
- **One renderer draws every image.** v-snap's support for Pixi and
  three.js keeps one renderer of each, for every test. A browser page
  keeps only about 16 WebGL contexts, so this also keeps a long run from
  losing its canvases.
- **Canvas tests take no screenshots.** v-snap reads each actual image
  straight from the renderer, as pixels in memory. There is no frame to
  wait for, and no PNG to encode.
- **Hashes are compared first.** The page hashes each image's pixels, and
  compares the hash with the reference's. A passing test sends nothing to
  Node. Only an image whose hash differs is decoded and compared pixel by
  pixel.

HTML views can only be seen in a screenshot, so their tests take one. v-snap
takes it through the browser's own protocol, which takes about half as
long as a Playwright screenshot. Each file of HTML tests also gets a fresh
page, since a view's stylesheets can't be unloaded. So HTML tests gain
much less than canvas tests.

## The Benchmark

The benchmark draws the same 1000 images of Pixi views both ways: with
v-snap's `canvasTest`, and as a project would without v-snap, on a canvas in
the page, checked with Vitest's `toMatchScreenshot`. The views are panels
such as a game's HUD might have, of 160 by 100 to 400 by 180 pixels, with
a title, a meter and a row of lights. They are in 100 test files. Both
ways run in the same browser, launched with the same settings. Every
timed run compares every image with its reference, and every test passes.

The screenshot tests ran twice. Once was with Vitest's defaults, which
open a page for each processor core but one, and run that many test files
at once, each in a fresh page. The other was one file at a time, in one
page, as v-snap's canvas tests run.

| | 1000 images, start-up included | One image, at the median | One image, 95th percentile |
| --- | ---: | ---: | ---: |
| **v-snap**, in one page | **7.8 s** | **4.0 ms** | **5.8 ms** |
| `toMatchScreenshot`, in one page | 89.9 s (11.5x) | 67 ms (17x) | 173 ms |
| `toMatchScreenshot`, 13 pages at once | 18.0 s (2.3x) | 131 ms (33x) | 391 ms |

A whole run is timed from starting Vitest to its exit, so it includes
starting the browser. Each figure is the median of three runs of each way,
taken in turns. They were measured on 2026-10-13, on a laptop with an
Intel Core Ultra 9 185H (14 cores) and Windows 11, with Node 26, Vitest
5.0.3 and Playwright 1.63.0.

Some context for the figures:

- **Like for like, v-snap is 11.5 times as fast.** In one page each, the
  screenshot tests take 67 ms an image, and each file also loads a fresh
  page. v-snap takes 4 ms an image, and about half of its 7.8 s is start-up: it
  launches the browser, loads the page and its fonts, and checks the
  environment.
- **Running several pages at once narrows the gap, but costs the whole
  machine.** The 13 pages share the processor, so each screenshot takes
  longer, 131 ms at the median, but 13 run at once. v-snap still finishes
  in less than half the time, using one page.
- **A machine with fewer cores runs fewer pages at once.** A CI runner
  with 4 cores runs 3, so there the gap should be closer to the one-page
  figure. This wasn't measured.
- **A small suite is mostly start-up.** Both ways take a few seconds to
  start, so a suite of a few dozen images gains less than a big one. v-snap
  is built for the suite that grows, where adding an image adds about
  4 ms.
- **These are canvas tests.** v-snap's HTML tests take screenshots, so they
  gain much less, as [Speed](#speed) explains.

To run it, clone the repository, run `npm ci`, then
`npm run bench -w v-snap`. It takes about 20 minutes, most of it in the
screenshot tests. The views are in
[`bench/views.ts`](../bench/views.ts), and the script that writes and times
the tests is [`bench/run.ts`](../bench/run.ts).

## The Same Images on Every Machine

Many things differ between machines, and each changes an image's pixels:
the GPU and its driver, the fonts installed, how the system draws and lays
out text, the browser's version, the locale, the time zone, and the screen's
scale and colour profile. v-snap pins each of them inside the browser, so
that nothing but `npm ci` is needed.

- **The browser** is always the same build of Chromium, Playwright's
  Chrome Headless Shell. Playwright names one build for each of its
  versions, and the lockfile names Playwright's version.
- **No graphics card takes part.** WebGL runs on the CPU, in SwiftShader,
  which comes with Chromium. 2D canvas drawing and compositing run on the
  CPU too. So every system runs the same drawing code.
- **Settings** such as the colour profile, screen scale, locale and time
  zone are fixed when the browser starts.
- **Canvas text** is drawn in two fonts that come with v-snap, Source Sans 3
  and Source Code Pro. v-snap lays the text out and draws each letter as a
  shape, so the system's text engine takes no part. Every system draws
  shapes alike. This covers the text that the canvas's own text calls
  draw, such as Pixi's `Text`. Text that reaches a canvas
  another way, such as Pixi's `HTMLText`, which draws HTML through an SVG
  image, is drawn by the system, in its fonts.
- **HTML text** is set in a blank font, whose letters keep their widths
  but draw nothing. Nothing tried inside the browser made HTML text draw
  alike on every system, so the layout is tested, and the words aren't.
- **Random numbers** are seeded the same way before every test, so a view
  that calls `Math.random` draws the same every time.
- **A tolerance** of 2 levels in 255, for each colour channel, covers the
  rounding of some drawing on arm64 processors. A real change is almost
  never that small. On arm64, Vitest's `-u` leaves the reference of an
  image within the tolerance as it is, so that an arm64 machine doesn't
  keep rewriting references. Other processors draw exactly, so there a
  difference within the tolerance is a small real change, and `-u` writes
  it.

The images were checked on GitHub's Windows x64, Linux x64, Linux arm64
and macOS arm64 runners. Every image was identical on all four, except for
small differences on arm64 that the tolerance covers.
[Limits and Rules](limits-and-rules.md) lists what these measures give up.

## Checks Before Every Run

Before any test runs, v-snap checks that the machine is the environment
that its images assume. It compares the browser's fingerprint, which names
its exact build, the WebGL renderer, the locale, the time zone and the
screen's scale, with the fingerprint that v-snap was released with. Then it
draws a calibration set. That is a set of small images, each of which
tests one way that drawing can differ between machines: shapes, images,
text, WebGL shading and textures, and HTML boxes, light and dark controls,
filters and rotation.

If anything differs beyond the tolerance, the run stops with one error
that says what differs. That is better than every test failing for a
reason nobody can see.

## Why Not Docker, or References for Each System?

There are two usual answers to images that differ between machines.

- **Draw every image in a container,** with Docker or a virtual machine.
  That works, but every developer and every CI job must install and run
  it, and each run pays to start it. On Windows and macOS, that is a
  virtual machine.
- **Keep a set of references for each system.** Then every visual change
  needs new references on every system, and nobody can update the set for
  a system that they don't have.

v-snap needs neither. `npm ci` installs everything but the browser, which
the first run downloads once into Playwright's cache.
