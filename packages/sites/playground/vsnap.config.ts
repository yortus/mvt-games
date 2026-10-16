// The kinds of view that the playground's visual tests pose: its own views,
// which are HTML. It runs in the test page, before the tests. An MVT view
// writes its state to the page in its refresh step, so each view is
// refreshed once before its image is taken, as the page's loop refreshes
// once a frame. Afterwards it is destroyed the MVT way, which runs the
// cleanup that its views registered.
import { destroyElement, refreshView } from '@mvtjs/html';
import { defineVsnapConfig, htmlViews } from 'v-snap';

const config = defineVsnapConfig({
    views: [htmlViews({ prepare: refreshView, dispose: destroyElement })],
});

// Gives v-snap's types the kinds of view above.
declare module 'v-snap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
