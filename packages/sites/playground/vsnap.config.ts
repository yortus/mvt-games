// The kinds of view that the playground's visual tests pose: its own views,
// which are HTML, and its examples, which draw with Pixi. It runs in the test
// page, before the tests. An MVT view writes its state to the page in its
// refresh step, so each view is refreshed once before its image is taken, as
// the page's loop refreshes once a frame. Afterwards an HTML view is
// destroyed the MVT way, which runs the cleanup that its views registered. A
// Pixi container's own destroy does that, so Pixi keeps v-snap's disposal.
// The view tick API is one set of functions for every renderer, so one
// `refreshView` refreshes both kinds.
import { destroyElement, refreshView } from '@mvtjs/html';
import { defineVsnapConfig, htmlViews } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';

const config = defineVsnapConfig({
    views: [
        htmlViews({ prepare: refreshView, dispose: destroyElement }),
        // The examples draw smooth shapes, not pixel art
        pixiViews({ pixelArt: false, prepare: refreshView }),
    ],
});

// Tells TypeScript about the kinds of view above, so that v-snap's test
// functions check each test's options against them.
declare module 'v-snap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
