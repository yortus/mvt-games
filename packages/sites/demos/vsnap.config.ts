// The kinds of view that the site's visual tests pose. It runs in the test
// page, before the tests. An MVT view writes its state to its display objects
// in its refresh step, so each view is refreshed once before its image is
// taken, as the game loop refreshes once a frame. Afterwards it is destroyed
// the MVT way, which runs the cleanup that its views registered. A Pixi
// container's own destroy does that, so Pixi keeps v-snap's disposal.
//
// PixiJS 3D adds itself to a Pixi renderer only as the renderer starts, and
// so does the renderer system that @mvtjs/pixi-3d draws a `ScreenView` with.
// v-snap starts one renderer for the page and keeps it for every test file
// after, so @mvtjs/pixi-3d, which imports PixiJS 3D, is imported here,
// before any test can start the renderer. Otherwise a `View3D` doesn't draw
// whenever an earlier file started the renderer.
import '@mvtjs/pixi-3d';
import { destroyElement } from '@mvtjs/html';
import { refreshView } from '@mvtjs/pixi';
import { destroyObject } from '@mvtjs/three';
import { defineVsnapConfig, htmlViews } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';
import { threeViews } from 'v-snap/three';

const config = defineVsnapConfig({
    views: [
        // Most of the games are pixel art.
        pixiViews({ pixelArt: true, prepare: refreshView }),
        threeViews({ prepare: refreshView, dispose: destroyObject }),
        htmlViews({ prepare: refreshView, dispose: destroyElement }),
    ],
    // Most of the site's views are Pixi views, so their tests give no kind.
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
