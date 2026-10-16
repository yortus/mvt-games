// The kinds of view that the benchmark's v-snap tests pose. It runs in the
// test page. v-snap's own TypeScript program registers v-snap's own config, so
// this one binds canvasTest to itself, and the tests import it from here.
import { bindCanvasTest, defineVsnapConfig } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

export const canvasTest = bindCanvasTest(config);

export default config;
