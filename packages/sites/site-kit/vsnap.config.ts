// The kinds of view that the kit's visual tests pose: the shared views, on
// Pixi, and the page's own, in HTML. It runs in the test page, before the
// tests. An MVT view writes its state to its display objects in its refresh
// step, so each view is refreshed once before its image is
// taken, as the game loop refreshes once a frame. Afterwards it is destroyed
// the MVT way, which runs the cleanup that its views registered. A Pixi
// container's own destroy does that, so Pixi keeps v-snap's disposal.
import { destroyElement } from '@mvtjs/html';
import { refreshView } from '@mvtjs/pixi';
import { defineVsnapConfig, htmlViews } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';

const config = defineVsnapConfig({
    views: [
        pixiViews({ pixelArt: true, prepare: refreshView }),
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
