# Writing Tests

A visual test builds a view in a known state, renders it to an image, and
compares that image with a reference image. This page shows how to declare
one, and what v-snap does with it.

- [Declaring a Test](#declaring-a-test)
- [Views That Change Over Time](#views-that-change-over-time)
- [Options and Modifiers](#options-and-modifiers)
- [New Images](#new-images)
- [Tests, Actual Images and Reference Images](#tests-actual-images-and-reference-images)
- [Image Names](#image-names)
- [One Kind of Test in Each File](#one-kind-of-test-in-each-file)
- [How HTML Views Are Captured](#how-html-views-are-captured)

## Declaring a Test

A test is a declaration in a `*.test.ts` or `*.test.tsx` file in a
`visual-tests` folder beside the view, such as
`visual-tests/hud-view.test.tsx` for `hud-view.tsx`. The file is a Vitest
test file, which runs in a browser, and it can hold ordinary tests too.
Other files in the folder, such as poses that several tests share, are not
test files. (A project can keep its tests elsewhere, as
[Where Files Go](configuration.md#where-files-go) describes.)

A view drawn on a canvas is declared with
`canvasTest(name, options?, pose)`, and an HTML view with
`htmlTest(name, options?, pose)`. The options (if any) come before the
pose, as they do in Vitest's `test`. The `pose` function's only job is to
return a view that has been arranged into the pose that the test
describes.

```tsx
import { canvasTest } from 'v-snap';
import { HudView } from '../hud-view';

canvasTest('at the start', () => HudView({ score: () => 0 }));
canvasTest('a high score', { width: 320 }, () => HudView({ score: () => 98_765 }));
```

The test file is named for its view, and so is each of its images, so the
tests need no `describe` block that names the view. A `describe` block can
group tests by something more specific, such as a state that they share.

`HudView` returns a Pixi container here. v-snap knows how to draw it because
the project registers Pixi views, and makes them its default kind, as
[Kinds of View](kinds-of-view.md) describes.

## Views That Change Over Time

A view that changes over time, such as one that animates, is posed at a
known moment: the pose advances it by a fixed amount of time before it
returns it. A pose never waits for real time to pass. A view whose game
moves it on with an update function is moved on the same way:

```tsx
canvasTest('a quarter of the way through its spin', () => {
    const coin = CoinView();
    coin.update(250); // 250 ms on, as the game's loop would move it
    return coin;
});
```

A view that runs on real time, with `setTimeout`, `requestAnimationFrame`
or a tween that plays by itself, is held still with Vitest's fake timers.
The pose moves them on to the moment, and gives real timers back before
it returns, since v-snap waits for frames as it takes the image:

```tsx
import { vi } from 'vitest';

htmlTest('the banner, half a second in', () => {
    vi.useFakeTimers();
    try {
        const banner = WinBanner();
        vi.advanceTimersByTime(500);
        return banner;
    }
    finally {
        vi.useRealTimers();
    }
});
```

Random numbers are seeded the same way before every test, those of
`Math.random`, `crypto.getRandomValues` and `crypto.randomUUID`, so a
view that uses them draws the same every time.

## Shared Setup and Assets

A pose builds its view from scratch, but what many tests share, such as a
spritesheet or a font, can be loaded once, at the top of the test file or
in a `beforeAll` step. A pose can be `async`, and await what it needs:

```tsx
import { Assets } from 'pixi.js';
import { beforeAll } from 'vitest';

let sheet: Spritesheet;
beforeAll(async () => {
    sheet = await Assets.load('/sprites/hud.json');
});

canvasTest('three lives', () => LivesView({ sheet, lives: () => 3 }));
```

What a test file loads stays loaded for the files after it, since canvas
test files share one page, so a loaded asset must not change.

## Options and Modifiers

The options can hold Vitest's own `timeout`, `retry`, `repeats` and
`fails`, which work as they do on `test`. So do the modifiers
`canvasTest.skip`, `canvasTest.only`, `canvasTest.todo`,
`canvasTest.skipIf(condition)` and `canvasTest.runIf(condition)`, and the
same on `htmlTest`.

`.each(cases)` and `.for(cases)` declare a test for each case of a table,
as Vitest's do, and pass the case to the pose. `.each` spreads a case that
is an array, and `.for` passes it whole. The name can show the case, with
`%s` or `$property`:

```ts
canvasTest.each(['spin', 'stop'])('the %s button', (mode) => SpinButton({ mode }));
```

They follow the other modifiers too, as in `canvasTest.skip.each(cases)`.

A canvas image that is one colour all over fails its test, since it
usually means that the view drew nothing. A view that is meant to be one
colour, such as an empty panel, sets `canBeBlank: true`.

The `background` of Pixi, three.js and HTML views takes a number, such as
`0x202024`, or a CSS colour. A canvas that the pose drew has its own
background. [Options of Each Kind](kinds-of-view.md#options-of-each-kind)
lists the other options.

Visual tests never run concurrently, even in a `describe.concurrent`
block, because the tests of a page share its renderers.

## New Images

The first time a test runs, its image is new, and it is written as the
test's reference image, as Vitest writes a new snapshot. Look at each new
reference before committing it. In CI, where Vitest writes no new
snapshots, a new image fails its test instead.

## Tests, Actual Images and Reference Images

Each test renders its view to one image. These docs keep three terms
apart:

- A **test** is one `canvasTest` or `htmlTest` declaration. A test runs,
  and passes or fails.
- An **actual image** is the image that a test renders during a run.
- A **reference image**, or just a **reference**, is an image that has been
  accepted, and committed as a PNG file.

A visual test passes when its actual image matches its reference image.

## Image Names

An image's name comes from its test's full name. The full name is the
names of the test's `describe` blocks, followed by the test's own name.
These rules turn it into an image name:

- Each run of characters other than letters, digits and dots becomes one
  hyphen, so the name has no spaces, and can be typed on a command line.
- Hyphens at either end are dropped.
- Letters and digits of every script count, so `日本` stays as it is. A
  test whose name has none fails.
- A name longer than 100 bytes is cut short, and a short hash of the whole
  name is added, so that file names stay inside every system's limits.

So the first test above, whose full name is `at the start`, has the image
name `at-the-start`, and a test named `with a new best` in a
`describe('after a game over')` block has the image name
`after-a-game-over-with-a-new-best`.

Each test has one image, named for the test, so renaming a test, or its
`describe` block, renames its image. A run outside CI writes the new
reference and deletes the old one, so the rename shows in version control
as one file renamed.

By default, a reference image is beside the test file, named for the
file's stem and the image name: `visual-tests/hud-view.at-the-start.png`.
A test file's stem is its name without `.test` or `.spec` and its
extension. So each test file's images sort together, beside it, and the
name says which file each image belongs to.

Two tests whose full names differ only in punctuation would have the same
image name, and share one reference image. So would two whose names differ
only in case, since macOS and Windows keep such names in one file. If two
tests of a file share a reference image, the second fails, and names the
first.

## One Kind of Test in Each File

The tests run in a browser. Vitest loads each test file into a browser
page, much like a tab, and the views are drawn in that page. The two kinds
of test need their pages arranged differently.

- **Canvas tests share one page.** Every file of canvas tests runs in the
  same page, one file after another. The libraries load once, the shaders
  compile once, and `pixi` and `three` each draw every actual image with
  one renderer. That is what lets hundreds of tests run in seconds.
- **Each file of HTML tests gets a fresh page.** HTML views use
  stylesheets, which can't be unloaded from a page, so a fresh page for
  each file gives each view only its own styles.

A test file runs in one page, so it declares one kind of visual test.
When the config loads, the package reads each file's declarations, and
sends the file to the right kind of page. Visual test files may hold unit
tests, but they run in the browser page too. So a unit test that needs
Node, such as one that reads a file, goes in a separate test file.

A visual test file that declares both `canvasTest` and `htmlTest`, or
neither, as a new empty file does, can't run. v-snap leaves it out of its
projects, and says why when the config loads. A run of the visual tests
then fails, after running the others. A run of the project's other tests,
such as `vitest -p unit`, only warns, so a half-written file stops no
other test.

The package finds the declarations by reading each file's text for
`canvasTest(` and `htmlTest(`, since Vitest needs each file's project
before any test code runs. So:

- A file calls `canvasTest` or `htmlTest` by those names, not under an
  alias.
- A file whose tests all go through a helper of its own, which calls them,
  is reported as declaring neither.
- A comment that mentions the other one, followed by a bracket, counts as
  a declaration.

## How HTML Views Are Captured

An HTML view must fit the test page, whose viewport is 1280 by 800
pixels unless `vsnap()`'s `viewport` option says otherwise, since the part
of a view past it isn't drawn. A bigger view fails its test, and says so.
The tolerance of 2 levels in 255 is the same in every project, since it is
part of what makes the images the same on every machine.

The pose builds the view before it is in the page. A test's `act` step
acts on it once it is, after its kind's `prepare` step, and before its
image is taken: it can hover over it, focus it or open a menu, with
Vitest's `userEvent`, or measure its layout. Both steps see the view as
its image will be, with its text in the blank font and its font sizes
rounded, so a measurement matches the image on every machine. After the
image, v-snap moves the pointer off the page, so that the next test's
view isn't hovered.

```ts
import { userEvent } from 'vitest/browser';

htmlTest('the menu, open', {
    act: (menu) => userEvent.click(menu.querySelector('button')!),
}, () => Menu());
```

A test's `viewport` and `colorScheme` set what the view's media queries
see, for one test: `viewport: { width: 400, height: 600 }` for a narrow
layout, and `colorScheme: 'light'` for a light theme. A test's viewport
can't be bigger than the page's, since a bigger one would be scaled. The
page returns to its own after the test.

The image is the view's box, so what the view draws outside it, such as a
shadow, an outline or a focus ring, is cut off. A test's `margin` takes in
that many pixels around the box, as with `{ margin: 6 }` for a focus ring.
A view whose root has `position: fixed` or `absolute`, such as a modal
overlay, takes no room where it is mounted, so its image reaches the
root's right and bottom edges, from the page's top left. A test can give
it a `width` and `height` instead.

Before an HTML view's image is taken, the package waits for its fonts, its
`<img>` elements, and the images that its styles use, such as backgrounds.
It also brings its animations and transitions to rest, as Playwright's
screenshots do with `animations: 'disabled'`: one that ends is finished,
and one that never ends, such as a spinner, is cancelled. A text field's
caret is hidden.

The page prefers a dark colour scheme, unless `vsnap()`'s `colorScheme`
option or the test's own says otherwise, and reduced motion. So a view's
`prefers-color-scheme: dark` and `prefers-reduced-motion: reduce` styles
apply. Form controls are drawn light or dark by CSS's `color-scheme`, as
in any page, and both are calibrated.

HTML text is drawn blank, as
[Limits and Rules](limits-and-rules.md#what-the-images-leave-out)
explains. The text in a view's open shadow roots, such as a web
component's, is blank too. A closed shadow root can't be reached, so its
text is drawn in the system's fonts, which differ between systems.
