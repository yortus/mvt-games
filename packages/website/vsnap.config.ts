// The kinds of view that the site's visual tests pose. It runs in the test
// page, before the tests. An MVT view writes its state to its display objects
// in its refresh step, so each view is refreshed once before its image is
// taken, as the game loop refreshes once a frame. Afterwards it is destroyed
// the MVT way, which runs the cleanup that its views registered. A Pixi
// container's own destroy does that, so Pixi keeps vsnap's disposal.
import { destroyElement } from '@mvtjs/html';
import { refreshView } from '@mvtjs/pixi';
import { destroyObject } from '@mvtjs/three';
import { defineVsnapConfig, htmlViews } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';
import { threeViews } from 'vsnap/three';

const config = defineVsnapConfig({
    views: [
        // Most of the games are pixel art.
        pixiViews({ pixelArt: true, prepare: refreshView }),
        threeViews({ prepare: refreshView, dispose: destroyObject }),
        htmlViews({ prepare: refreshView, dispose: destroyElement }),
    ],
    // Most of the site's views are Pixi views, so their tests give no kind.
    defaultView: 'pixi',
});

// Gives canvasTest's types the kinds of view above, and the default view.
declare module 'vsnap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
