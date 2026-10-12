// The kinds of view that the fixture's tests pose. It runs in the test page.
// The fixture's tests are in vsnap's own TypeScript program, which registers
// vsnap's own config, as a monorepo's packages share one program. So the
// fixture binds canvasTest to its own config, and its tests import it from
// here.
import { bindCanvasTest, defineVsnapConfig } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultView: 'pixi' });

export const canvasTest = bindCanvasTest(config);

export default config;
