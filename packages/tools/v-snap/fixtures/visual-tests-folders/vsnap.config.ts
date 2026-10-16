// The kinds of view that the fixture's tests pose. It runs in the test page.
// The fixture's tests are in v-snap's own TypeScript program, which registers
// v-snap's own config, as a monorepo's packages share one program. So the
// fixture binds canvasTest to its own config, and its tests import it from
// here.
import { bindCanvasTest, defineVsnapConfig } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';

// The fixture's views are pixel art.
const config = defineVsnapConfig({ views: [pixiViews({ pixelArt: true })], defaultKind: 'pixi' });

export const canvasTest = bindCanvasTest(config);

export default config;
