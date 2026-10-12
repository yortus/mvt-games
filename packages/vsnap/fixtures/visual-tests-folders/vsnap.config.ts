// The kinds of view that the fixture's tests pose. It runs in the test page.
// Its type is not registered for canvasTest, since the fixture's tests are
// in vsnap's own TypeScript program, which registers vsnap's own config. A
// project registers its config as vsnap's own vsnap.config.ts does.
import { defineVsnapConfig } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';

export default defineVsnapConfig({ views: [pixiViews()], defaultView: 'pixi' });
