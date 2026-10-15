# Writing Tests

A visual test builds a view in a known state, renders it to an image, and
compares that image with a reference image. This page shows how to declare
one, and what v-snap does with it.

- [Tests, Actual Images and Reference Images](#tests-actual-images-and-reference-images)
- [Declaring a Test](#declaring-a-test)
- [Views That Change Over Time](#views-that-change-over-time)
- [Shared Setup and Assets](#shared-setup-and-assets)
- [Options and Modifiers](#options-and-modifiers)
- [New Images](#new-images)
- [How HTML Views Are Captured](#how-html-views-are-captured)
- [One Kind of Test in Each File](#one-kind-of-test-in-each-file)
- [Image Names](#image-names)

## Tests, Actual Images and Reference Images

Each test renders its view to one image. These docs keep three terms
apart:

- A **test** is one `canvasTest` or `htmlTest` declaration. A test runs,
  and passes or fails.
- An **actual image** is the image that a test renders during a run.
- A **reference image**, or just a **reference**, is an image that has been
  accepted, and committed as a PNG file.

A visual test passes when its actual image matches its reference image.

## Declaring a Test

A test is a declaration in a `*.test.ts` or `*.test.tsx` file in a
`visual-tests` folder beside the view, such as
`visual-tests/hud-view.test.tsx` for `hud-view.tsx`. The file is a Vitest
test file that runs in a browser, and it can hold ordinary tests too.
Other files in the folder, such as poses that several tests share, are not
test files. A project can keep its tests elsewhere, as
[Where Files Go](configuration.md#where-files-go) describes.

A view drawn on a canvas is declared with
`canvasTest(name, options?, pose)`, and an HTML view with
`htmlTest(name, options?, pose)`. The options, if there are any, come
before the pose, as they do in Vitest's `test`. The pose is a function
whose only job is to return the view, arranged into the state that the
test describes.

```tsx
import { canvasTest } from 'v-snap';
import { HudView } from '../hud-view';

canvasTest('at the start', () => HudView({ score: () => 0 }));
canvasTest('a high score', { width: 320 }, () => HudView({
    score: () => 98_765,
}));
```

The test file is named for its view, and so is each of its images. So the
tests need no `describe` block that names the view. A `describe` block can
still group tests by something more specific, such as a state that they
share.

`HudView` returns a Pixi container here. v-snap knows how to draw it,
because the project registers Pixi views and makes them its default kind,
as [Kinds of View](kinds-of-view.md) describes.

## Views That Change Over Time

A view that changes over time, such as one that animates, is posed at a
known moment. The pose moves it on by a fixed amount of time, then returns
it. A pose never waits for real time to pass. A view that its game moves
on with an update function is moved on the same way:

```tsx
canvasTest('a quarter of the way through its spin', () => {
    const coin = CoinView();
    coin.update(250); // 250 ms on, as the game's loop would move it
    return coin;
});
```

Some views run on real time, with `setTimeout`, `requestAnimationFrame` or
a tween that plays by itself. Vitest's fake timers hold such a view still.
The pose moves the timers on to the moment that it wants. It gives real
timers back before it returns, because v-snap waits for frames as it takes
the image.

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

Before every test, v-snap seeds `Math.random`, `crypto.getRandomValues`
and `crypto.randomUUID` the same way. So a view that uses random numbers
draws the same every time.

## Shared Setup and Assets

A pose builds its view from scratch. What many tests share, such as a
spritesheet or a font, can be loaded once instead, at the top of the test
file or in a `beforeAll` step. A pose can also be `async`, and await what
it needs.

```tsx
import { Assets, type Spritesheet } from 'pixi.js';
import { beforeAll } from 'vitest';

let sheet: Spritesheet;
beforeAll(async () => {
    sheet = await Assets.load('/sprites/hud.json');
});

canvasTest('three lives', () => LivesView({ sheet, lives: () => 3 }));
```

Canvas test files share one page, so what one file loads stays loaded for
the files after it. A test must not change a shared asset.

## Options and Modifiers

A test's options can hold Vitest's own `timeout`, `retry`, `repeats` and
`fails`, which work as they do on `test`. Vitest's modifiers work too:
`canvasTest.skip`, `canvasTest.only`, `canvasTest.todo`,
`canvasTest.skipIf(condition)` and `canvasTest.runIf(condition)`, and the
same on `htmlTest`.

`.each(cases)` and `.for(cases)` declare a test for each case of a table,
as Vitest's do, and pass the case to the pose. `.each` spreads a case that
is an array, and `.for` passes it whole. The name can show the case, with
`%s` or `$property`:

```ts
canvasTest.each(['spin', 'stop'])('the %s button', (mode) => SpinButton({
    mode,
}));
```

They also follow the other modifiers, as in `canvasTest.skip.each(cases)`.

A canvas image that is one colour all over fails its test, because it
usually means that the view drew nothing. A view that is meant to be one
colour, such as an empty panel, sets `canBeBlank: true`.

The `background` of Pixi, three.js and HTML views takes a number, such as
`0x202024`, or a CSS colour. A canvas that the pose drew has its own
background. [Options of Each Kind](kinds-of-view.md#options-of-each-kind)
lists the other options.

Visual tests never run concurrently, even in a `describe.concurrent`
block, because the tests of a page share its renderers.

## New Images

The first time a test runs, its image is new. v-snap writes it as the
test's reference image, as Vitest writes a new snapshot. Look at each new
reference before committing it. In CI, Vitest writes no new snapshots, so
a new image fails its test instead.

## How HTML Views Are Captured

The pose builds an HTML view before it is in the page. v-snap then mounts
it in the page, and takes its image there.

A test's `act` step can act on the view once it is in the page, before its
image is taken. It can hover over the view, focus it or open a menu, with
Vitest's `userEvent`, or measure its layout. It runs after the kind's
`prepare` step, if the project registered one. Both steps see the view as
its image will be, with its text blank and its font sizes rounded. So a
measurement that they take matches the image on every machine. After the
image, v-snap moves the pointer off the page, so that the next test's view
isn't hovered.

```ts
import { userEvent } from 'vitest/browser';

htmlTest('the menu, open', {
    act: (menu) => userEvent.click(menu.querySelector('button')!),
}, () => Menu());
```

An HTML view must fit the test page, since the part of a view outside it
isn't drawn. A bigger view fails its test, and says so. The page's
viewport is 1280 by 800 pixels, unless `vsnap()`'s `viewport` option says
otherwise.

A test's `viewport` and `colorScheme` set what the view's media queries
see, for one test. For example, `viewport: { width: 400, height: 600 }`
gives a narrow layout, and `colorScheme: 'light'` a light theme. A test's
viewport can't be bigger than the page's, since a bigger one would be
scaled. The page goes back to its own after the test.

The image is the view's box. So what the view draws outside its box, such
as a shadow, an outline or a focus ring, is cut off. A test's `margin`
adds that many pixels around the box, as with `{ margin: 6 }` for a focus
ring.

A view whose root has `position: fixed` or `absolute`, such as a modal
overlay, takes no room where it is mounted. So its image runs from the
page's top left to the root's right and bottom edges. A test can give it a
`width` and `height` instead.

Before an HTML view's image is taken, v-snap waits for its fonts, its
`<img>` elements, and the images that its styles use, such as backgrounds.
It also brings its animations and transitions to rest, as Playwright's
screenshots do with `animations: 'disabled'`. An animation that ends is
finished, and one that never ends, such as a spinner, is cancelled. A text
field's caret is hidden.

The page prefers a dark colour scheme, unless `vsnap()`'s `colorScheme`
option or the test's own says otherwise. It also prefers reduced motion.
So a view's `prefers-color-scheme: dark` and
`prefers-reduced-motion: reduce` styles apply. Form controls are drawn
light or dark by CSS's `color-scheme`, as in any page, and v-snap checks
both.

HTML text is drawn blank, as
[Limits and Rules](limits-and-rules.md#what-the-images-leave-out)
explains. The text in a view's open shadow roots, such as a web
component's, is blank too. A closed shadow root can't be reached, so its
text is drawn in the system's fonts, which differ between systems.

## One Kind of Test in Each File

The tests run in a browser. Vitest loads each test file into a browser
page, much like a tab, and the views are drawn in that page. The two kinds
of test need their pages arranged differently.

- **Canvas tests share one page.** Every file of canvas tests runs in the
  same page, one file after another. The libraries load once, the shaders
  compile once, and v-snap draws every Pixi image with one renderer, and
  every three.js image with another. That is what lets hundreds of tests
  run in seconds.
- **Each file of HTML tests gets a fresh page.** HTML views use
  stylesheets, which can't be unloaded from a page. A fresh page for each
  file gives each view only its own styles.

A test file runs in one page, so it declares one kind of visual test.
When the config loads, v-snap reads each file's declarations, and sends
the file to the right kind of page. A visual test file may hold unit
tests, but they run in the browser page too. So a unit test that needs
Node, such as one that reads a file, goes in a separate test file.

A visual test file that declares both `canvasTest` and `htmlTest` can't
run, and nor can one that declares neither, such as a new empty file.
v-snap leaves such a file out of its projects, and says why when the
config loads. A run of the visual tests then fails, after running the
others. A run of the project's other tests, such as `vitest -p unit`, only
warns, so a half-written file stops no other test.

Vitest needs to know each file's project before any test code runs. So
v-snap finds the declarations by reading each file's text for
`canvasTest(` and `htmlTest(`. That has three effects:

- A file must call `canvasTest` or `htmlTest` by those names, not under an
  alias.
- A file whose tests all go through a helper of its own is reported as
  declaring neither.
- A comment that mentions the other one, followed by a bracket, counts as
  a declaration.

## Image Names

An image's name comes from its test's full name. The full name is the
names of the test's `describe` blocks, followed by the test's own name.
These rules turn it into an image name:

- Each run of characters other than letters, digits and dots becomes one
  hyphen. So the name has no spaces, and can be typed on a command line.
- Hyphens at either end are dropped.
- Letters and digits of every script count, so `日本` stays as it is. A
  test whose name has none fails.
- A name longer than 100 bytes is cut short, and a short hash of the whole
  name is added. That keeps file names inside every system's limits.

For example, a test named `at the start` has the image name
`at-the-start`. A test named `with a new best`, in a
`describe('after a game over')` block, has the image name
`after-a-game-over-with-a-new-best`.

By default, a reference image is beside its test file, named for the
file's stem and the image name, as in
`visual-tests/hud-view.at-the-start.png`. A test file's stem is its name
without `.test` or `.spec` and its extension. So each test file's images
sort together beside it, and each image's name says which file it belongs
to.

Each test has one image, named for the test. So renaming a test, or its
`describe` block, renames its image. A run outside CI writes the new
reference and deletes the old one, so version control shows the rename as
one file renamed.

Two tests whose full names differ only in punctuation would have the same
image name, and so share one reference image. So would two whose names
differ only in case, since macOS and Windows treat such names as one file.
If two tests of a file would share a reference image, the second fails,
and names the first.
