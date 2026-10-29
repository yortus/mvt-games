# Kinds of View

v-snap can draw four kinds of view: Pixi containers, three.js objects,
canvases that your test drew itself, and HTML elements. This page shows
how you tell v-snap which kinds your tests use, and how it draws each
one.

- [Registering Kinds of View](#registering-kinds-of-view)
- [The Kinds](#the-kinds)
- [The Default Kind](#the-default-kind)
- [Types That Know the Kinds](#types-that-know-the-kinds)
- [Configs in a Monorepo](#configs-in-a-monorepo)
- [Options of Each Kind](#options-of-each-kind)
- [Preparing and Disposing of Views](#preparing-and-disposing-of-views)
- [Support for Another Renderer](#support-for-another-renderer)

## Registering Kinds of View

Each canvas test has a kind of view, which says what its pose returns.
The pose is the function in each test that builds the view and returns
it. The kind tells v-snap how to recognise that view and how to draw it.
A test names its kind with the `kind` option. It can be a kind that you
register, such as `'pixi'`, or the built-in `'canvas'`, for a canvas that
the pose drew itself.

You register your kinds in a file named `vsnap.config.ts`. v-snap looks
for it in the folder that its `root` option names. By default, that's
the root of your Vitest run, which in a project with one package is
usually the folder that holds `vitest.config.ts`. The `vsnapConfig`
option can point to the file somewhere else. Both are options of
`vsnap()` or `vsnapProjects()`, as [Options](configuration.md#options)
describes.

```ts
import { defineVsnapConfig } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';
import { threeViews } from 'v-snap/three';

const config = defineVsnapConfig({
    views: [pixiViews(), threeViews()],
    defaultKind: 'pixi',
});

// Tells TypeScript about the kinds of view above, so that canvasTest
// accepts tests of those kinds and checks their options. It also lets a
// test leave out its kind, to use the default kind.
declare module 'v-snap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

The `declare module` block at the end uses a TypeScript feature called
declaration merging. v-snap exports an empty interface named `Register`,
and your block adds your config's type to it. That's how `canvasTest`,
which v-snap wrote without knowing your project, learns which kinds of
view you registered and which one is your default. Without the block,
TypeScript reports every test of a registered kind as an error. v-snap
looks for the block when the config loads, and warns you if it's
missing. Copy the block as it is. If your config's variable has another
name, use that name in place of `config`.

This file runs in the browser page that draws your tests, not in Node as
`vitest.config.ts` does. It has to, because the kinds that it registers
work on the views themselves. They check each view's class, prepare it,
draw it and dispose of it. Settings that Node needs before the page
opens are options of `vsnap()` or `vsnapProjects()` in
`vitest.config.ts` instead. They include where the reference images go,
and the size budget, which is the most pixels an image may have (the
`maxPixels` option). [Options](configuration.md#options) lists them all.

List each kind once. v-snap stops with an error if your config has any
of these:

- Two kinds with the same name.
- A kind named `'canvas'` or `'html'`, since v-snap uses those names
  itself.
- `htmlViews` listed twice.
- A `defaultKind` that isn't the name of a listed kind.

Because `vsnap.config.ts` runs in the test page, any error that it throws
fails every visual test file. You'll see the error under "Failed to
import test file", next to v-snap's setup file. Your other Vitest
projects still run. (A Vitest project is a group of test files with its
own settings, such as your unit tests.)

## The Kinds

### Pixi Views

Register Pixi views with `pixiViews()`, from `v-snap/pixi`. A Pixi test's
pose returns a Pixi container. By default, the image covers the view's
bounds, plus a margin of 4 pixels. It's drawn smooth, with antialiased
edges.

A test's options can set the image's `width`, `height` and `background`.
v-snap treats each axis separately. If you give a size for an axis, the
image runs from 0 to that size on that axis, as a game's screen does. If
you don't, the image follows the view's bounds on that axis. So
`{ width: 320 }` gives you the screen's width and the view's own height.

Set `pixelArt: true` for pixel art. v-snap then draws hard edges, and
rounds positions to whole pixels. If most of your views are pixel art,
register `pixiViews({ pixelArt: true })`, and give each smooth view's
test `pixelArt: false`. In the same way, `pixiViews({ background })` sets
the background of every test that doesn't set its own.

Some views need a renderer to build themselves, such as a view that calls
`generateTexture`. Make that view's pose `async`, and get the renderer by
awaiting `getPixiRenderer()`, from `v-snap/pixi`. It's the same renderer
that draws every image, and v-snap keeps it for every test. So don't
resize it, destroy it or change its settings, or the tests after yours
would see the change. And destroy any texture that your test makes with
it.

### three.js Views

Register three.js views with `threeViews()`, from `v-snap/three`. A
three.js test's pose returns a three.js object. Such an object has no
bounds that v-snap could take the image's size from. So each test gives
the image's `width` and `height`, and a `camera` function, which returns
the camera to draw the view with.

A test can also give a `scene` function. It sets up the scene as your
game does, so that the view is lit as it is in the game. That includes
the lights, the tone mapping and the environment map, which is an image
that lights the scene and is reflected in it.

Your tests often share these settings, such as the game's screen size
and camera. So `threeViews()` can set `width`, `height`, `camera`,
`scene` and `background` for every test. A test can then leave them out,
or set its own. TypeScript knows which options you gave `threeViews()`,
so it lets your tests leave out only those:

```ts
threeViews({ width: 320, height: 240, camera: createCamera })
```

### Canvases That the Pose Drew

If your pose draws a canvas itself, with any renderer, its kind is
`'canvas'`, and you don't need to register it. The canvas can be an
`HTMLCanvasElement` or an `OffscreenCanvas`, drawn with canvas 2D or
WebGL. If a WebGL canvas is in the page, create its context with
`preserveDrawingBuffer: true`. Otherwise the browser clears the canvas
once it has shown it, and the test reads a blank image.

v-snap leaves the canvas alone after the test, because your pose may draw
every test on the same canvas. If your pose makes a new WebGL canvas for
each test, release each context when you're done with it, such as with
the `WEBGL_lose_context` extension. A browser page allows only about 16
WebGL contexts at once.

### HTML Views

You declare tests of HTML views with `htmlTest`, and you don't need to
register them. List `htmlViews()` in your config only if you want v-snap
to prepare or dispose of them your own way, as
[Preparing and Disposing of Views](#preparing-and-disposing-of-views)
describes. You can also give every HTML test one background, with
`htmlViews({ background })`.

## The Default Kind

Most projects draw most of their views one way. So rather than make every
test name its kind, you name a default kind in your config, with
`defaultKind`. A test that gives no `kind` is of the default kind. A test
of another kind names its own:

```ts
const LEVER = { kind: 'three', width: 240, height: 300, camera } as const;

canvasTest('spinning', () => ReelView(...));
canvasTest('at rest', LEVER, () => LeverView(...));
canvasTest('a bar chart', { kind: 'canvas' }, () => drawChart(SALES));
```

If Pixi is your default kind, the first test is a Pixi test. The second
is a three.js test, whose options are kept in a constant that several
tests can share. The third poses a canvas that it drew itself. Without
`defaultKind`, the default kind is `'canvas'`.

## Types That Know the Kinds

The `Register` block gives your config's type to `canvasTest`. TypeScript
then checks each test's options against its kind, and checks that its
pose returns that kind's view. Say Pixi is your default kind, and you
write a three.js test but forget its `kind`. TypeScript takes it as a
Pixi test. So its `camera` option is a type error, and so is the
three.js object that its pose returns. For this to work, your
`tsconfig.json` must include `vsnap.config.ts`.

Each test also checks its view while it runs, with its kind's own check,
such as `instanceof Container` for Pixi. If the view is of another kind,
the test fails. The message says which kind the view is, and which
`kind` to give the test.

## Configs in a Monorepo

TypeScript allows only one `Register` in each program. In a monorepo,
your packages may each have their own `vsnap.config.ts` but share one
`tsconfig.json`. Then the configs can't each use `Register`. Instead,
each config exports a `canvasTest` that is bound to it, made with
`bindCanvasTest`:

```ts
import { bindCanvasTest, defineVsnapConfig } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

// This canvasTest's types know this config's kinds of view.
export const canvasTest = bindCanvasTest(config);

export default config;
```

The package's tests then import `canvasTest` from its config, rather than
from `v-snap`:

```ts
import { canvasTest } from '../vsnap.config';
```

While each test runs, a bound `canvasTest` checks that its config is the
one for the test's own project. So if a test imports another package's
`canvasTest` by mistake, it fails. To name the type of a test's options,
give the config as the second type argument, after the kind:
`CanvasTestOptions<'three', typeof config>`.

## Options of Each Kind

Each kind has its own test options, which the table lists. Every test can
also take Vitest's `timeout`, `retry`, `repeats` and `fails`. A canvas
test also takes `kind`, and `canBeBlank`, which lets its image be one
colour all over. Without `canBeBlank`, a blank image fails, since that
usually means the view drew nothing. When you register a kind, you can
set defaults for every test of that kind. A test's own options override
them.

| Kind | A test's options | The registration's options |
| --- | --- | --- |
| Pixi, `pixiViews()` | `width` and `height` (the view's bounds and a margin by default), `background`, `pixelArt` (`false` by default) | `prepare`, `dispose`, `pixelArt`, `background` |
| three.js, `threeViews()` | `width`, `height` and `camera`, all needed, unless `threeViews()` sets them; `scene`, to set up the scene's lights and environment; `background` | `prepare`, `dispose`, `background`, `width`, `height`, `camera`, `scene` |
| A canvas that the pose drew, `'canvas'` | none | none, since it needs no registration |
| HTML, `htmlTest` | `width` and `height` (the element's own size by default), `background`; `margin`, the space around the element that the image takes in (0 by default); `act`, a step on the view once it is in the page; `viewport` and `colorScheme`, for its media queries (see [How HTML Views Are Captured](writing-tests.md#how-html-views-are-captured)) | `htmlViews()`: `prepare`, `dispose`, `background` |

A `background` is a number, such as `0x202024`, or a CSS colour. Every
built-in kind uses the same dark grey by default, so that you can see a
view's transparent areas in its image.

## Preparing and Disposing of Views

By default, v-snap takes the image of a view just as the pose returns it.
Afterwards, it disposes of the view in the usual way for its kind. It
removes an HTML element, calls a Pixi container's `destroy`, and disposes
of every geometry and material in a three.js object. If your views need
more than that, give the kind's registration these functions:

- **`prepare(view)`** runs after the pose, before the image is taken. If
  your framework writes a view's state to the screen in a separate step,
  run that step here. An HTML view is already in the page when it's
  prepared, so a step that measures its layout gets real sizes.
- **`dispose(view)`** runs after the image is taken, instead of the usual
  disposal. If your framework has its own cleanup for a view, run it
  here.

For example, [MVT](https://github.com/yortus/mvt-games) views draw their
state in a separate refresh step, which MVT's `refreshView` runs, and MVT
destroys them. So a project built with MVT prepares and disposes of each
kind its own way, HTML views included. Its `vsnap.config.ts` reads:

```ts
import { destroyElement } from '@mvtjs/html';
import { refreshView } from '@mvtjs/pixi';
import { destroyObject } from '@mvtjs/three';
import { defineVsnapConfig, htmlViews } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';
import { threeViews } from 'v-snap/three';

const config = defineVsnapConfig({
    views: [
        // A Pixi container's own destroy runs MVT's cleanup.
        pixiViews({ prepare: refreshView }),
        // refreshView works on views of every renderer, not only Pixi's.
        threeViews({ prepare: refreshView, dispose: destroyObject }),
        htmlViews({ prepare: refreshView, dispose: destroyElement }),
    ],
    defaultKind: 'pixi',
});

declare module 'v-snap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

TypeScript types each `prepare` and `dispose` by its kind's view, so your
functions don't need to check what they were given.

## Support for Another Renderer

You can teach v-snap to draw views of another renderer. You describe the
renderer as a `CanvasViewKind`, which has these members:

- `kind`, the name that tests give as their `kind`.
- `isView`, which returns whether a value that a pose returned is a view
  of this kind.
- `draw`, which draws the view and returns its image. It can return the
  canvas that it drew on instead, and v-snap reads the pixels for you.
- `prepare` and `dispose`, if you need them, which work as they do for
  the built-in kinds.
- `defaults`, the options that every test of the kind gets unless it
  sets its own, as `pixiViews({ background })` does.

`pixiViews` and `threeViews` each make one renderer and draw every image
with it, which is much faster than making a renderer for each test. A
kind for another renderer should do the same.

Here is a small kind, for views that paint themselves on a 2D canvas. To
keep the example short, it makes a new canvas for each image. A kind for
a real renderer would make its renderer once, and draw every image with
it.

```ts
// vsnap.config.ts
import { type CanvasViewKind, defineVsnapConfig } from 'v-snap';

export interface Sketch {
    readonly paint: (ctx: CanvasRenderingContext2D) => void;
}

interface SketchOptions {
    readonly width?: number;
    readonly height?: number;
}

const sketchViews: CanvasViewKind<Sketch, SketchOptions, 'sketch'> = {
    kind: 'sketch',
    isView: (value) => typeof (value as Partial<Sketch>)?.paint === 'function',
    draw: (view, options) => {
        const canvas = document.createElement('canvas');
        canvas.width = options.width ?? 80;
        canvas.height = options.height ?? 60;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#202024';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        view.paint(ctx);
        return canvas;
    },
};

const config = defineVsnapConfig({
    views: [sketchViews],
    defaultKind: 'sketch',
});

declare module 'v-snap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

A test of this kind then returns a sketch from its pose:

```ts
canvasTest('a red square', { width: 40, height: 40 }, () => ({
    paint: (ctx) => {
        ctx.fillStyle = 'red';
        ctx.fillRect(10, 10, 20, 20);
    },
}));
```

`v-snap` exports the types that you need, and two helpers:

- `fitImage` returns how an image fits the size budget. It gives the
  scale to draw the image at, or the reason that the test must fail.
- `readCanvas` returns a canvas's pixels, as an image at full
  resolution.

If your `draw` draws an image smaller to fit the size budget, read the
canvas yourself, and set the image's `resolution` to the scale that you
drew it at, such as 0.5. Once you list the kind in your config, the
`Register` block gives it to `canvasTest`'s types, as it does for the
other kinds.
