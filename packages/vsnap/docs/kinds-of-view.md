# Kinds of View

vsnap draws views of several kinds: Pixi containers, three.js objects,
canvases that a test drew itself, and HTML elements. This page shows how a
project tells vsnap which kinds its tests pose, and how each kind is drawn.

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
A kind is one that the project registers, such as `'pixi'`, or `'canvas'`,
for a canvas that the pose drew. A project registers its kinds in
`vsnap.config.ts`, which is vsnap's config for the project. It is in
vsnap's root, beside `vitest.config.ts` in a project with one package.

```ts
import { defineVsnapConfig } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';
import { threeViews } from 'vsnap/three';

const config = defineVsnapConfig({
    views: [pixiViews(), threeViews()],
    defaultKind: 'pixi',
});

// Gives canvasTest's types the kinds of view above, and the default kind.
declare module 'vsnap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

The file runs in the test page, not in Node as `vitest.config.ts` does,
because what it registers runs on the views: checks of their classes,
drawing, preparing and disposing. So the settings that Node needs before
any page exists, such as `maxPixels` and where the files go, are options of
`vsnap()` in `vitest.config.ts`, as [Configuration](configuration.md)
describes.

## The Kinds

- **Pixi views,** registered with `pixiViews()` from `vsnap/pixi`. The pose
  returns a Pixi container. By default, the image is framed by the view's
  bounds, and drawn smooth, with antialiased edges. The options can set the
  image's `width`, `height` and `background`, and `pixelArt: true` for
  pixel art, with hard edges and whole pixels. A project whose views are
  mostly pixel art registers `pixiViews({ pixelArt: true })`, and a test of
  a smooth view then says `pixelArt: false`. `pixiViews({ background })`
  sets every test's background, unless the test sets its own.
- **three.js views,** registered with `threeViews()` from `vsnap/three`. The
  pose returns a three.js object. A three.js view has no bounds to frame it
  by, so the options always set the image's `width` and `height`, and the
  `camera` to draw it with. They can also dress the `scene` as the view's
  game does, with its lights, environment and tone mapping.
  `threeViews({ background })` sets every test's background.
- **A canvas that the pose has drawn,** of the kind `'canvas'`, with any
  renderer, needs no registration. It can be an `HTMLCanvasElement` or an
  `OffscreenCanvas`, drawn with canvas 2D or WebGL. A WebGL canvas that is
  in the page needs `preserveDrawingBuffer: true`, because the browser
  clears it once it is shown. The canvas stays the pose's own: vsnap
  doesn't dispose of it, since a pose may draw on the same canvas for every
  test. A pose that makes a new WebGL canvas for each test should release
  its context, since a page keeps only so many.
- **HTML views,** declared with `htmlTest`, need no registration, unless
  they need preparing or disposing of, as
  [Preparing and Disposing of Views](#preparing-and-disposing-of-views)
  describes, or a background for every test, `htmlViews({ background })`.

## The Default Kind

`defaultKind` names the kind that a test is of when it gives no `kind`.
Most projects draw most of their views one way, so most of their tests give
no kind. A test of another kind names it:

```ts
canvasTest('spinning', () => ReelView(...));
canvasTest('at rest', { kind: 'three', width: 240, height: 300, camera }, () => LeverView(...));
canvasTest('a bar chart', { kind: 'canvas' }, () => drawChart(SALES));
```

Without `defaultKind`, the default is `'canvas'`.

## Types That Know the Kinds

The `Register` declaration gives the config's type to `canvasTest`. So each
test's options are checked against its kind, and its pose must return its
kind's view. A three.js test that leaves out its `kind` is taken as Pixi,
so `camera` is a type error, and so is a three.js object from its pose. For
that, the project's `tsconfig.json` must include `vsnap.config.ts`.

A test also checks its view as it runs, by its kind's check, such as
`instanceof Container`. A view of another kind fails its test, and the
message says which kind the view is, and the `kind` to give.

Each kind is listed once. Two kinds with one name, a kind named
`'canvas'` or `'html'`, `htmlViews` listed twice, or a `defaultKind` that
names no listed kind, are errors. `vsnap.config.ts` runs in the test page,
so such an error, or any other that the file throws, fails every visual
test file, with the error under "Failed to import test file" and vsnap's
setup file. The other projects still run.

## Configs in a Monorepo

One TypeScript program holds one `Register`. So in a monorepo whose
packages have configs of their own, and share one `tsconfig.json`, each
package's config binds `canvasTest` to itself instead, and its tests import
it from there:

```ts
import { bindCanvasTest, defineVsnapConfig } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

// canvasTest, with types that know this config's kinds of view.
export const canvasTest = bindCanvasTest(config);

export default config;
```

```ts
import { canvasTest } from '../vsnap.config';
```

Such a `canvasTest` also checks, as each test runs, that it is the config
of the test's own project, so a test that imports another package's fails.
The type of its tests' options is `CanvasTestOptions<'three', typeof config>`,
with the config named after the kind.

## Options of Each Kind

A test's options are those of its kind, with `kind` to name it, Vitest's
`timeout`, `retry`, `repeats` and `fails`, and, for a canvas test,
`canBeBlank`. A kind's registration can set the defaults that every test of
the kind gets, unless the test sets its own.

| Kind | A test's options | The registration's options |
| --- | --- | --- |
| Pixi, `pixiViews()` | `width` and `height` (the view's bounds and a margin by default), `background`, `pixelArt` (`false` by default) | `prepare`, `dispose`, `pixelArt`, `background` |
| three.js, `threeViews()` | `width`, `height` and `camera`, all needed; `scene`, to dress the scene; `background` | `prepare`, `dispose`, `background` |
| A canvas that the pose drew, `'canvas'` | none | none needed |
| HTML, `htmlTest` | `width` and `height` (the element's own size by default), `background` | `htmlViews()`: `prepare`, `dispose`, `background` |

A `background` is a number, such as `0x202024`, or a CSS colour. By
default, it is one dark grey for every kind, so that transparent areas
show.

## Preparing and Disposing of Views

By default, the package takes an image of a view just as the pose returns
it. Afterwards, it disposes of the view the plain way: removing the HTML
element, Pixi's `destroy`, or three.js's `dispose` on every geometry and
material. A project whose views need more says so in each kind's
registration.

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
import { defineVsnapConfig, htmlViews } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';
import { threeViews } from 'vsnap/three';

const config = defineVsnapConfig({
    views: [
        // A Pixi container's own destroy runs MVT's cleanup.
        pixiViews({ prepare: refreshView }),
        threeViews({ prepare: refreshView, dispose: destroyObject }),
        htmlViews({ prepare: refreshView, dispose: destroyElement }),
    ],
    defaultKind: 'pixi',
});

declare module 'vsnap' {
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

It is a `CanvasViewKind`: its name, as `kind`, a check of the view, and
the step that draws it. It can also have steps that prepare and dispose of
the view, and `defaults`, options that every test of the kind gets unless
it sets its own, as `pixiViews({ background })` does. Its `draw` can return
the canvas that it drew on, and vsnap reads it.

`vsnap` exports the types, with two helpers: `fitImage` says how an image
fits the size budget, and `readCanvas` reads a canvas's pixels at full
resolution. A kind that draws an image smaller, to fit the budget, reads
its canvas itself, and gives the image its resolution. Listed in the
config, the kind joins `canvasTest`'s types through `Register`, as the
others do.
