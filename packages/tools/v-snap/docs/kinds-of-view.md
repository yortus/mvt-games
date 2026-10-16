# Kinds of View

v-snap draws views of several kinds: Pixi containers, three.js objects,
canvases that a test drew itself, and HTML elements. This page shows how a
project tells v-snap which kinds its tests pose, and how each kind is drawn.

- [Registering Kinds of View](#registering-kinds-of-view)
- [The Kinds](#the-kinds)
- [The Default Kind](#the-default-kind)
- [Types That Know the Kinds](#types-that-know-the-kinds)
- [Configs in a Monorepo](#configs-in-a-monorepo)
- [Options of Each Kind](#options-of-each-kind)
- [Preparing and Disposing of Views](#preparing-and-disposing-of-views)
- [Support for Another Renderer](#support-for-another-renderer)

## Registering Kinds of View

Each canvas test is of one kind of view, which its options name as `kind`.
A kind is either one that the project registers, such as `'pixi'`, or
`'canvas'`, for a canvas that the pose drew. A project registers its kinds
in `vsnap.config.ts`, which is v-snap's config for the project. The file
is in v-snap's root, which in a project with one package is beside
`vitest.config.ts`.

```ts
import { defineVsnapConfig } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';
import { threeViews } from 'v-snap/three';

const config = defineVsnapConfig({
    views: [pixiViews(), threeViews()],
    defaultKind: 'pixi',
});

// Gives canvasTest's types the kinds of view above, and the default kind.
declare module 'v-snap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

The file runs in the test page, not in Node as `vitest.config.ts` does.
That is because what it registers works on the views themselves: it
checks their classes, draws them, and prepares and disposes of them. The
settings that Node needs before any page exists, such as `maxPixels` and
where the files go, are v-snap's options in `vitest.config.ts` instead, as
[Configuration](configuration.md) describes.

## The Kinds

### Pixi Views

Pixi views are registered with `pixiViews()`, from `v-snap/pixi`. The pose
returns a Pixi container. By default, the image is framed by the view's
bounds, plus a margin of 4 pixels, and drawn smooth, with antialiased
edges.

A test's options can set the image's `width`, `height` and `background`.
Each axis is framed on its own. An axis with a size runs from 0 to that
size, as a game's screen does, and an axis without one is framed by the
view's bounds. So `{ width: 320 }` gives the screen's width and the view's
own height.

`pixelArt: true` draws pixel art, with hard edges and whole pixels. A
project whose views are mostly pixel art registers
`pixiViews({ pixelArt: true })`, and a test of a smooth view then says
`pixelArt: false`. `pixiViews({ background })` sets every test's
background, unless the test sets its own.

Some views need a renderer to build themselves, such as one that calls
`generateTexture`. Such a view's pose is `async`, and gets the renderer
that draws the images from `getPixiRenderer()`. v-snap keeps that renderer
for every test. So a test mustn't resize it, destroy it or change its
settings, and it destroys the textures that it makes.

### three.js Views

three.js views are registered with `threeViews()`, from `v-snap/three`.
The pose returns a three.js object. A three.js view has no bounds to frame
it by, so a test gives the image's `width` and `height`, and a `camera`
function that makes the camera to draw it with. A test's `scene` function
can also dress the scene as the view's game does, with its lights,
environment and tone mapping.

`threeViews()` can set `width`, `height`, `camera`, `scene` and
`background` for every test, such as the game's screen size and camera.
A test can then leave them out, or set its own. The tests' types know
which options `threeViews()` set:

```ts
threeViews({ width: 320, height: 240, camera: createCamera })
```

### Canvases That the Pose Drew

A canvas that the pose drew, with any renderer, is of the kind `'canvas'`,
which needs no registration. It can be an `HTMLCanvasElement` or an
`OffscreenCanvas`, drawn with canvas 2D or WebGL. A WebGL canvas that is
in the page needs `preserveDrawingBuffer: true`, because the browser
clears it once it is shown.

The canvas stays the pose's own. v-snap doesn't dispose of it, since a
pose may draw on the same canvas for every test. A pose that makes a new
WebGL canvas for each test should release its context, since a page keeps
only so many.

### HTML Views

HTML views are declared with `htmlTest`. They need no registration,
unless they need preparing or disposing of, as
[Preparing and Disposing of Views](#preparing-and-disposing-of-views)
describes, or a background for every test, with
`htmlViews({ background })`.

## The Default Kind

`defaultKind` names the kind that a test is of when it gives no `kind`.
Most projects draw most of their views one way, so most of their tests give
no kind. A test of another kind names it:

```ts
const LEVER = { kind: 'three', width: 240, height: 300, camera } as const;

canvasTest('spinning', () => ReelView(...));
canvasTest('at rest', LEVER, () => LeverView(...));
canvasTest('a bar chart', { kind: 'canvas' }, () => drawChart(SALES));
```

Without `defaultKind`, the default is `'canvas'`.

## Types That Know the Kinds

The `Register` declaration gives the config's type to `canvasTest`. So
each test's options are checked against its kind, and its pose must return
its kind's view. For example, if Pixi is the default kind, a three.js test
that leaves out its `kind` is taken as Pixi. Its `camera` is then a type
error, and so is the three.js object that its pose returns. This needs the
project's `tsconfig.json` to include `vsnap.config.ts`.

A test also checks its view as it runs, by its kind's check, such as
`instanceof Container`. A view of another kind fails its test, and the
message says which kind the view is, and the `kind` to give.

Each kind is listed once. These are errors:

- Two kinds with one name.
- A kind named `'canvas'` or `'html'`, which are v-snap's own.
- `htmlViews` listed twice.
- A `defaultKind` that names no listed kind.

`vsnap.config.ts` runs in the test page, so such an error, or any other
that the file throws, fails every visual test file. The error appears
under "Failed to import test file", with v-snap's setup file. The other
projects still run.

## Configs in a Monorepo

One TypeScript program holds one `Register`. So in a monorepo whose
packages have configs of their own, and share one `tsconfig.json`, each
package's config binds `canvasTest` to itself instead, and its tests import
it from there:

```ts
import { bindCanvasTest, defineVsnapConfig } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

// canvasTest, with types that know this config's kinds of view.
export const canvasTest = bindCanvasTest(config);

export default config;
```

```ts
import { canvasTest } from '../vsnap.config';
```

As each test runs, such a `canvasTest` also checks that its config is the
one for the test's own project. So a test that imports another package's
`canvasTest` fails. The type of a test's options names the config after
the kind, as in `CanvasTestOptions<'three', typeof config>`.

## Options of Each Kind

A test's options are those of its kind, with `kind` to name it, Vitest's
`timeout`, `retry`, `repeats` and `fails`, and, for a canvas test,
`canBeBlank`. A kind's registration can set the defaults that every test of
the kind gets, unless the test sets its own.

| Kind | A test's options | The registration's options |
| --- | --- | --- |
| Pixi, `pixiViews()` | `width` and `height` (the view's bounds and a margin by default), `background`, `pixelArt` (`false` by default) | `prepare`, `dispose`, `pixelArt`, `background` |
| three.js, `threeViews()` | `width`, `height` and `camera`, all needed, unless `threeViews()` sets them; `scene`, to dress the scene; `background` | `prepare`, `dispose`, `background`, `width`, `height`, `camera`, `scene` |
| A canvas that the pose drew, `'canvas'` | none | none needed |
| HTML, `htmlTest` | `width` and `height` (the element's own size by default), `background`; `margin`, the space around the element that the image takes in (0 by default); `act`, a step on the view once it is in the page; `viewport` and `colorScheme`, for its media queries (see [How HTML Views Are Captured](writing-tests.md#how-html-views-are-captured)) | `htmlViews()`: `prepare`, `dispose`, `background` |

A `background` is a number, such as `0x202024`, or a CSS colour. By
default, it is one dark grey for every kind, so that transparent areas
show.

## Preparing and Disposing of Views

By default, v-snap takes an image of a view just as the pose returns it.
Afterwards, it disposes of the view in the plain way for its kind. It
removes an HTML element, calls a Pixi container's `destroy`, and calls
`dispose` on every geometry and material of a three.js object. A project
whose views need more says so in each kind's registration.

- **`prepare(view)`** runs after the pose, before the image is taken. A
  framework whose views write their state to the screen in a separate
  step does that step here. An HTML view is already in the page when it is
  prepared, so a step that measures its layout sees it.
- **`dispose(view)`** runs after the image is taken, in place of the plain
  disposal. A framework that runs cleanup of its own when a view is
  destroyed does that here.

For example, views built with [MVT](https://github.com/yortus/mvt-games)
draw in a refresh step, and are destroyed through MVT. HTML views are
registered with `htmlViews`, to prepare and dispose of them too. So a
project's `vsnap.config.ts` reads:

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

Each `prepare` and `dispose` is typed by its kind's view, so it needs no
checks of what it was given.

## Support for Another Renderer

`pixiViews` and `threeViews` each keep one renderer for every image, which
is much faster than a renderer for each test. Support for another renderer
can do the same.

Support for a renderer is a `CanvasViewKind`. It has a name, as `kind`, a
check of the view, and a step that draws it. It can also have steps that
prepare and dispose of the view. Its `defaults` are options that every
test of the kind gets, unless the test sets its own, as
`pixiViews({ background })` does. Its `draw` can return the canvas that it
drew on, and v-snap reads it.

Here is a small kind, for views that paint themselves on a 2D canvas. For
brevity, it makes a canvas for each image. A kind for a real renderer would
make its renderer once, and draw every image with it.

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

A test then poses a sketch:

```ts
canvasTest('a red square', { width: 40, height: 40 }, () => ({
    paint: (ctx) => {
        ctx.fillStyle = 'red';
        ctx.fillRect(10, 10, 20, 20);
    },
}));
```

`v-snap` exports the types, and two helpers. `fitImage` returns how an
image fits the size budget, and `readCanvas` returns a canvas's pixels at
full resolution. A kind that draws an image smaller, to fit the budget,
reads its canvas itself, and gives the image its resolution. Once the kind
is listed in the config, `Register` gives it to `canvasTest`'s types, as
it does the other kinds.
