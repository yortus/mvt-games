# How It Works

Visual tests tend to be slow, and they tend to give different images on
different machines. Both problems matter. You won't run a slow suite
often. And a suite whose images differ between machines fails for
reasons that nobody can fix, so people learn to ignore it. This page
explains how v-snap avoids both problems, and shows the measurements.

- [Speed](#speed)
- [The Benchmark](#the-benchmark)
- [The Same Images on Every Machine](#the-same-images-on-every-machine)
- [Checks Before Every Run](#checks-before-every-run)
- [Why Not Docker, or References for Each System?](#why-not-docker-or-references-for-each-system)

## Speed

The usual way to test how a view looks is to take a screenshot of it, as
Vitest's `toMatchScreenshot` and Playwright's `toHaveScreenshot` do. A
screenshot waits for the browser to show a frame, encodes it as a PNG,
and sends it to Node. Most tools also take screenshots until two in a row
agree, so that an animation can't fail a test. And each test file gets a
fresh page, which loads its libraries again. So each image costs a
hundred milliseconds or more, before any drawing.

v-snap avoids most of that work for views drawn on a canvas, in four
ways.

- **Canvas test files share one page.** The libraries load once, and
  shaders compile once, rather than once for each file.
- **One renderer draws every image.** v-snap's support for Pixi and
  three.js makes one renderer for each, and reuses it for every test.
  That matters for long runs too. A browser page allows only about 16
  WebGL contexts at once, and after that it drops old ones, along with
  their canvases.
- **Canvas tests take no screenshots.** v-snap reads each actual image,
  the one that the test draws now, straight from the renderer, as pixels
  in memory. There is no frame to wait for, and no PNG to encode.
- **Hashes are compared first.** The page works out a hash of each
  image's pixels, which is a short code computed from them. It compares
  that with the hash stored in the reference image. So a passing test
  sends nothing to Node. Only an image whose hash differs is sent,
  decoded and compared pixel by pixel.

HTML views can only be seen in a screenshot, so HTML tests take one.
v-snap asks the browser for it directly, through the Chrome DevTools
Protocol, the interface that tools use to control Chromium. That's faster
than a Playwright screenshot. But each file of HTML tests still gets a
fresh page, because a stylesheet can't be unloaded once a view has
imported it. So HTML tests gain much less than canvas tests.

## The Benchmark

The benchmark draws the same 1000 images of Pixi views in two ways. One
way uses v-snap's `canvasTest`. The other is what a project would do
without v-snap. It draws each view on a canvas in the page, and checks it
with Vitest's `toMatchScreenshot`. Each view is a panel of the kind that
a game's HUD might have, with a title, a meter and a row of lights. The
panels range from 160 by 100 to 400 by 180 pixels. There are 10 in each
of 100 test files. Both ways run in the same browser, launched with the
same settings. Every timed run compares every image with its reference,
and every test passes.

The screenshot tests ran in two ways. The first used Vitest's defaults.
Vitest opens one browser tab for each processor core but one, and runs
that many test files at once. The second ran one file at a time, in a
single tab, as v-snap runs its canvas tests. In both, each screenshot
file still loaded into a fresh page, as Vitest does by default. v-snap's
canvas test files all share one page.

| | 1000 images, start-up included | One image, at the median | One image, 95th percentile |
| --- | ---: | ---: | ---: |
| **v-snap**, in one page | **7.8 s** | **4.0 ms** | **5.8 ms** |
| `toMatchScreenshot`, one file at a time | 89.9 s (11.5x) | 67 ms (17x) | 173 ms |
| `toMatchScreenshot`, 13 files at once | 18.0 s (2.3x) | 131 ms (33x) | 391 ms |

A whole run is timed from starting Vitest to its exit, so it includes
starting the browser. Each way ran three times, taking turns with the
other ways. A whole run's time is the median of its three runs. The
times for one image are the median and 95th percentile of every image's
time, across all three runs. They were measured on 2026-10-13, on a
laptop with an Intel Core Ultra 9 185H (14 cores) and Windows 11. It ran
Node 26, Vitest 5.0.3 and Playwright 1.63.0, the Playwright version that
v-snap then supported.

Here is some context for the figures.

- **Like for like, v-snap is 11.5 times as fast.** Running one file at a
  time, the screenshot tests take 67 ms an image, and each file also
  loads a fresh page. v-snap takes 4 ms an image. About half of its
  7.8 s is start-up. In that time, it launches the browser, loads the
  page and its fonts, and checks the environment.
- **Running several files at once narrows the gap, but it takes over the
  whole machine.** The 13 tabs share the processor, so each screenshot
  takes longer, 131 ms at the median. But 13 run at once. Even so,
  v-snap finishes in less than half the time, using one page.
- **A machine with fewer cores runs fewer files at once.** A CI runner
  with 4 cores runs 3, so there the gap should be closer to the figure
  for one file at a time. This wasn't measured.
- **A small suite is mostly start-up.** Both ways take a few seconds to
  start, so a suite of a few dozen images gains less than a big one. As
  your suite grows, each new image adds only about 4 ms.
- **These are canvas tests.** v-snap's HTML tests take screenshots, so
  they gain much less, as [Speed](#speed) explains.

To run the benchmark yourself, clone
[the repository](https://github.com/yortus/mvt-games), run `npm ci`, then
run `npm run bench -w v-snap`. It takes about 20 minutes, most of it in
the screenshot tests. The views are in [`bench/views.ts`](../bench/views.ts),
and the script that writes and times the tests is
[`bench/run.ts`](../bench/run.ts).

## The Same Images on Every Machine

Many things differ between machines, and each of them can change an
image's pixels. They include the GPU and its driver, the fonts installed,
how the system draws and lays out text, the browser's version, the
locale, the time zone, and the screen's scale and colour profile. v-snap
fixes each of them inside the browser. So you don't need Docker or any
other setup. `npm ci` installs everything but the browser, and the first
run downloads that.

- **The browser** is always the same build of Chromium, Playwright's
  Chrome Headless Shell. Each minor version of Playwright names one
  build, and each release of v-snap accepts one minor version of
  Playwright. So every machine gets the same build.
  [Playwright Versions](getting-started.md#playwright-versions) says more.
- **No graphics card takes part.** WebGL runs on the CPU, in SwiftShader,
  a software GPU that comes with Chromium. 2D canvas drawing and
  compositing, which puts the page's layers together, run on the CPU
  too. So every system runs the same drawing code.
- **Settings** such as the colour profile, screen scale, locale and time
  zone are fixed when the browser starts.
- **Canvas text** is drawn in v-snap's own fonts, Source Sans 3 and
  Source Code Pro, which come with the package. v-snap lays the text out
  itself, and draws each letter as a shape, so the system's text engine
  takes no part. Every system draws shapes alike. This covers text drawn
  with the canvas's text methods, such as `fillText`, which is how Pixi's
  `Text` draws. Text that reaches a canvas in another way is drawn by the
  system, in its own fonts. Pixi's `HTMLText` is one example, since it
  draws HTML through an SVG image.
- **HTML text** is set in a blank font. In that font, every letter is an
  empty space 0.625 em wide. Every system lays that font out the same
  way, but not the way the real font would be laid out. Lines wrap, and
  long text is cut off with an ellipsis, at different points. No setting
  inside the browser made real HTML text draw alike on every system. So
  the tests check the layout, but not the words.
- **Random numbers** start from the same seed before every test. (A seed
  is the value that a random number generator starts from.) So a view
  that calls `Math.random`, `crypto.getRandomValues` or
  `crypto.randomUUID` draws the same every time. The two `crypto`
  functions draw from a generator of their own. So if you add a call to
  one of them, the numbers that `Math.random` gives don't change.
- **A tolerance** lets each colour channel of a pixel differ by up to 2
  levels out of 255. That covers the rounding of some drawing on arm64
  processors, and a real change is almost never that small. On arm64,
  Vitest's `-u` keeps the reference of an image that is within the
  tolerance, so that an arm64 machine doesn't keep rewriting references.
  Other processors draw exactly. So on them, a difference within the
  tolerance is a small real change, and `-u` writes it.

The images were checked on GitHub's Windows x64, Linux x64, Linux arm64
and macOS arm64 runners. Every image was identical on all four, except
for small differences on arm64 that the tolerance covers.
[Limits and Rules](limits-and-rules.md) lists what these measures give
up.

## Checks Before Every Run

Before any test runs, v-snap checks that your machine draws the way its
reference images expect. First it reads the browser's fingerprint. That
is a short record of the browser's exact build, its WebGL renderer, its
locale and time zone, and the screen's scale. v-snap compares it with
the fingerprint that it was released with. Then it draws a calibration
set, which is a set of small images. Each image tests one way that
drawing can differ between machines. The canvas images cover shapes,
images, text, and WebGL shading and textures. The HTML images cover
boxes, light and dark controls, filters and rotation.

If the fingerprint differs, or a calibration image differs beyond the
tolerance, the run stops with one error that says what differs. That's
more useful than every test failing for a reason that nobody can see.

## Why Not Docker, or References for Each System?

There are two usual answers to images that differ between machines.

- **Draw every image in a container,** with Docker or a virtual machine.
  That works, but every developer and every CI job must install it and
  run it, and each run pays the time to start it. On Windows and macOS,
  Docker itself runs in a virtual machine.
- **Keep a set of references for each system.** Then every visual change
  needs new references on every system. And nobody can update the set
  for a system that they don't have.

v-snap needs neither. `npm ci` installs everything but the browser, which
the first run downloads once, into Playwright's cache.
