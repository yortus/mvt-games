# Writing Tests

A visual test builds a view in a known state, renders it to an image, and
compares that image with one you accepted earlier. This page shows you how
to declare a test, and what v-snap does with it.

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

Three terms come up throughout these docs. They mean different things, so
it helps to know them before you start.

- A **test** is one test that you declare with `canvasTest` or
  `htmlTest`. It runs, and it passes or fails.
- An **actual image** is the image that a test renders during a run.
- A **reference image**, or just a **reference**, is an image that you
  have checked and accepted, and committed to your repository as a PNG
  file.

A test passes when its actual image matches its reference image.

## Declaring a Test

You write a test in a `*.test.ts` or `*.test.tsx` file, in a
`visual-tests` folder beside the view. For example, the tests for
`hud-view.tsx` go in `visual-tests/hud-view.test.tsx`. It's an ordinary
Vitest test file that runs in a browser, so it can hold ordinary tests
too. Other files in the folder, such as poses that several tests share,
aren't test files. If you'd rather keep your tests somewhere else,
[Where Files Go](configuration.md#where-files-go) shows you how.

To test a view that draws on a canvas, call
`canvasTest(name, options?, pose)`. For an HTML view, call
`htmlTest(name, options?, pose)`. As with Vitest's `test`, any options
come before the function. That function is the **pose**. Its only job is
to build the view, set it up in the state that the test describes, and
return it.

```tsx
import { canvasTest } from 'v-snap';
import { HudView } from '../hud-view';

canvasTest('at the start', () => HudView({ score: () => 0 }));
canvasTest('a high score', { width: 320 }, () => HudView({
    score: () => 98_765,
}));
```

The samples after this one leave out their imports of v-snap and of the
views, so that you can see what matters in each.

Each test file is named for its view, and so is each of its images. So
you don't need a `describe` block that names the view. You can still use
one to group tests by something more specific, such as a state that they
share.

In this example, `HudView` returns a Pixi container. v-snap knows how to
draw it because your project registers Pixi views in its
`vsnap.config.ts`, and makes them the default kind of view. That's why
the test doesn't need to say what kind of view it is.
[Kinds of View](kinds-of-view.md) shows you how to set this up.

## Views That Change Over Time

A view that changes over time, such as an animation, needs a fixed moment
to be tested at. Your pose advances the view by a set amount of time, then
returns it. It never waits for real time to pass. If your game advances
the view by calling an update function, the pose calls that function too.

```tsx
canvasTest('a quarter of the way through its spin', () => {
    const coin = CoinView();
    coin.update(250); // Advance 250 ms, as your game loop would
    return coin;
});
```

Some views run on real time. They use `setTimeout`,
`requestAnimationFrame` or a tween that plays by itself. You can hold such
a view still with Vitest's fake timers, then advance the timers to the
moment you want. Switch back to real timers before the pose returns.
v-snap waits for real frames while it takes the image, so it would wait
forever on fake ones.

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

Before every test, v-snap resets `Math.random`, `crypto.getRandomValues`
and `crypto.randomUUID` to the same fixed starting point, called a seed.
So a view that uses random numbers gets the same numbers, and draws the
same image, on every run.

## Shared Setup and Assets

Each pose builds its view from scratch. If many tests need the same thing,
such as a spritesheet or a font, you can load it once instead. Load it at
the top of the test file, or in a `beforeAll` step. A pose can also be
`async`, and await what it needs.

```tsx
import { Assets, type Spritesheet } from 'pixi.js';
import { beforeAll } from 'vitest';

let sheet: Spritesheet;
beforeAll(async () => {
    sheet = await Assets.load('/sprites/hud.json');
});

canvasTest('three lives', () => LivesView({ sheet, lives: () => 3 }));
```

Canvas test files share one page, so anything that one file loads stays
loaded for the files after it. So don't change a shared asset in a test.
If you do, every test that runs after it sees the change.

## Options and Modifiers

You can give a test Vitest's own `timeout`, `retry`, `repeats` and
`fails` options. They work as they do on `test`. Vitest's modifiers work
too. You can use `canvasTest.skip`, `canvasTest.only`, `canvasTest.todo`,
`canvasTest.skipIf(condition)` and `canvasTest.runIf(condition)`, and the
same on `htmlTest`.

To declare one test for each row of a table, use `.each(cases)` or
`.for(cases)`, as you would in Vitest. Each one passes the row to the
pose. If a row is an array, `.each` spreads its items as separate
arguments, and `.for` passes the array whole. To show the row in the
test's name, use `%s` or `$property`.

```ts
canvasTest.each(['spin', 'stop'])('the %s button', (mode) => SpinButton({
    mode,
}));
```

You can chain `.each` and `.for` after the other modifiers too, as in
`canvasTest.skip.each(cases)`.

If a canvas image is one colour all over, its test fails, because that
usually means the view drew nothing. If your view is meant to be one
colour, such as an empty panel, give its test `canBeBlank: true`.

Each kind of view has options of its own, such as a test's `background`
colour. [Options of Each Kind](kinds-of-view.md#options-of-each-kind)
lists them.

Visual tests never run at the same time, even in a `describe.concurrent`
block. The tests in a page share that page, its renderers and its seeded
random numbers, so they must take turns.

## New Images

The first time a test runs, it has no reference image yet. v-snap saves
the actual image as the reference, just as Vitest saves a new snapshot.
Look at each new reference before you commit it, because every later run
is checked against it. In CI, Vitest saves no new snapshots, so a test
with no reference fails there instead.

## How HTML Views Are Captured

Your pose builds the HTML element, but doesn't add it to the page. v-snap
adds it to the test page, then takes its image there.

If you need to act on the view before its image is taken, give the test
an `act` step. It runs once the view is in the page. You could use
Vitest's `userEvent` to hover over the view, focus it or open a menu. You
could also measure its layout. The `act` step runs after your kind's
`prepare` step, if you registered one. Both steps see the view exactly as
its image will be, with its text blank and its font sizes rounded. So any
measurement they take matches the image on every machine. If a test has
an `act` step, v-snap moves the pointer off the page after the image, so
that the next test's view isn't hovered.

```ts
import { userEvent } from 'vitest/browser';

htmlTest('the menu, open', {
    act: (menu) => userEvent.click(menu.querySelector('button')!),
}, () => Menu());
```

An HTML view must fit inside the test page, because the browser doesn't
draw the part of a view that's outside it. If your view is bigger, its
test fails, and says why. The page is 1280 by 800 pixels, unless you set
v-snap's `viewport` option (see [Options](configuration.md#options)).

A test's `viewport` and `colorScheme` options change what the view's
media queries see, for that test only. For example,
`viewport: { width: 400, height: 600 }` gives a narrow layout, and
`colorScheme: 'light'` gives a light theme. A test's viewport can't be
bigger than the page, because the browser would then scale the image.
After the test, the page goes back to its usual size and colour scheme.

The image covers the view's box and nothing more. So anything the view
draws outside its box is cut off, such as a shadow, an outline or a focus
ring. To include it, give the test a `margin`, such as `{ margin: 6 }`
for a focus ring. That adds 6 pixels on every side.

A view whose root element has `position: fixed` or `absolute`, such as a
modal overlay, takes up no room where it's added. So its image runs from
the page's top-left corner to the root element's right and bottom edges.
If you want a different size, give the test a `width` and `height`.

Before v-snap takes an HTML view's image, it waits for the view's fonts,
its `<img>` elements, and the images that its styles use, such as
backgrounds. It also stops the view's animations and transitions, as
Playwright's screenshots do with `animations: 'disabled'`. An animation
that would end jumps to its end. One that repeats forever, such as a
spinner, is removed, so the image shows the view without it. A text
field's caret is hidden too. Then v-snap waits for two frames. Some views
lay themselves out in a frame after they're added to the page, as a code
editor such as CodeMirror does when it measures its lines. The wait lets
them settle, however slow the machine is. That way, the image never
catches a moment that differs from one run to the next.

v-snap also draws each scroll container with rounded corners as part of
the page. Browsers usually draw a container that you can scroll as a
layer of its own, and arm64 processors round the edges of that layer's
rounded corners differently. So while v-snap takes the image, it sets the
container's `overflow` to `hidden`. The container keeps its layout, and
stays scrolled where it was, so the image looks the same as before. A
`<textarea>` or a `<select>` keeps its own overflow, since its size
depends on it.

The page prefers a dark colour scheme, unless v-snap's `colorScheme`
option or the test's own says otherwise. It also prefers reduced motion.
So your view's `prefers-color-scheme: dark` and
`prefers-reduced-motion: reduce` styles apply. Form controls follow CSS's
`color-scheme` property, as in any page. Before every run, v-snap checks
that light and dark controls both draw the same on your machine as they
do everywhere else.

HTML text is drawn blank, as
[Limits and Rules](limits-and-rules.md#what-the-images-leave-out)
explains. That includes the text in a view's open shadow roots, such as a
web component's. A closed shadow root can't be reached, so its text is
drawn in the system's fonts. Those differ between systems, so its image
can differ too.

## One Kind of Test in Each File

Your tests run in a browser. Vitest loads each test file into a browser
page, much like a tab, and the views are drawn in that page. The two kinds
of test need their pages set up differently.

- **Canvas tests share one page.** Every file of canvas tests runs in the
  same page, one file after another. The libraries load once, and the
  shaders compile once. v-snap draws every Pixi image with one renderer,
  and every three.js image with another. That's what lets hundreds of
  tests run in seconds.
- **Each file of HTML tests gets a fresh page.** HTML views use
  stylesheets, and a page can't unload a stylesheet once it has loaded
  it. A fresh page for each file means each view sees only its own
  styles.

Since a test file runs in one page, it can declare only one kind of
visual test. When the config loads, v-snap reads each file's
declarations, and sends the file to the Vitest project for its kind of
page. A visual test file can hold unit tests too, but they also run in
the browser page. So if a unit test needs Node, such as one that reads a
file, put it in a separate test file.

A visual test file can't run if it declares both `canvasTest` and
`htmlTest`. It also can't run if it declares neither, such as a new,
empty file. v-snap leaves such a file out, and explains why when the
config loads. A run of the visual tests still runs every other visual
test file, then fails. A run of only your other tests, such as
`vitest -p unit`, just shows a warning. That way, a half-written file
never blocks your unit tests.

Vitest needs to know each file's project before any test code runs. So
v-snap finds the declarations by searching each file's text for calls
such as `canvasTest(`, `htmlTest(` or `canvasTest.skip.each(`. That has
three effects:

- You must call `canvasTest` and `htmlTest` by those names, not under an
  alias.
- If all of a file's tests go through a helper function of its own, the
  file is reported as declaring neither kind.
- A comment or a string that names the other kind, followed by `(`,
  counts as a declaration of that kind.

## Image Names

Each image's name comes from its test's full name. The full name is the
names of the test's `describe` blocks, followed by the test's own name.
v-snap turns it into an image name with these rules:

- Each run of characters other than letters, digits and dots becomes one
  hyphen. So the name has no spaces, and you can type it on a command
  line.
- Hyphens at either end are dropped.
- Letters and digits of every writing system count, so `日本` stays as it
  is. A test whose name has none fails.
- A name longer than 100 bytes is cut short, and a short hash of the whole
  name is added. That keeps file names inside every system's limits.

For example, a test named `at the start` has the image name
`at-the-start`. A test named `with a new best`, in a
`describe('after a game over')` block, has the image name
`after-a-game-over-with-a-new-best`.

By default, a reference image sits beside its test file. It's named for
the file's stem and the image name, as in
`visual-tests/hud-view.at-the-start.png`. A test file's stem is its name
without `.test` or `.spec` and its extension. So each test file's images
sort together beside it, and each image's name tells you which file it
belongs to.

Since each image is named for its test, renaming a test, or its
`describe` block, renames its image. A run outside CI writes the new
reference, and deletes the old one if git tracks it. So version control
shows the change as one file renamed. A rerun in watch mode keeps the old
one, as [Running the Tests](running-tests.md#checks-of-the-reference-images)
explains.

Two tests whose full names differ only in punctuation would get the same
image name, and so share one reference image. So would two whose names
differ only in case, because macOS and Windows treat such names as one
file. If two tests in a file would share a reference image, the second
one fails, and names the first.
