// The kinds of view that the benchmark's vsnap tests pose. It runs in the
// test page. vsnap's own TypeScript program registers vsnap's own config, so
// this one binds canvasTest to itself, and the tests import it from here.
import { bindCanvasTest, defineVsnapConfig } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

export const canvasTest = bindCanvasTest(config);

export default config;
