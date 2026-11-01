import { Container } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createForestModel } from '../../models';
import { ForestView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../forest-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

/** The forest at a time of year, in seconds from the start of spring, with a year lasting a minute. */
async function poseAt(seconds: number): Promise<ReturnType<typeof ForestView>> {
    const model = createForestModel();
    const view = ForestView({ model });
    await advanceTime(seconds * 1000, model, view);
    return view;
}

canvasTest('growing in spring', SIZE, () => poseAt(8));
canvasTest('in summer', SIZE, () => poseAt(22));
canvasTest('turning in autumn', SIZE, () => poseAt(38));
canvasTest('bare in winter', SIZE, () => poseAt(52));

// In a wider window: the sky, ground and haze reach on past the screen's sides, behind the trees that do
canvasTest('past the edges of the screen', { ...SIZE, width: SCREEN_WIDTH * 2 }, async () => {
    const view = await poseAt(22);
    const window = new Container();
    view.x = SCREEN_WIDTH / 2;
    window.addChild(view);
    return window;
});
