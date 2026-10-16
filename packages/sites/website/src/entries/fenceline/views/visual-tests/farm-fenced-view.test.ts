import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { FarmFencedView } from '../farm-fenced-view';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../view-constants';

const IMAGE = { width: FIELD_WIDTH, height: FIELD_HEIGHT };

/** The celebration of farm `farm`, `ms` in. Its clock is advanced with the view, as the game's would be. */
async function poseScene(farm: number, ms: number): Promise<ReturnType<typeof FarmFencedView>> {
    let elapsedMs = 0;
    const clock = {
        update: (deltaMs: number) => {
            elapsedMs += deltaMs;
        },
    };
    const view = FarmFencedView({
        width: FIELD_WIDTH,
        height: FIELD_HEIGHT,
        isShown: () => true,
        farm: () => farm,
        elapsedMs: () => elapsedMs,
    });
    await advanceTime(ms, clock, view);
    return view;
}

// The title has dropped in, and the first line of the story is showing.
canvasTest('as it starts', IMAGE, () => poseScene(1, 1200));
// The sheep bounce, and the pie is in the air.
canvasTest('with the pie on its way', IMAGE, () => poseScene(1, 4150));
// The farmhand is in, and the ute is driving off, leaving dust.
canvasTest('as the ute drives off', IMAGE, () => poseScene(1, 7900));
// A later farm has its own story.
canvasTest('on the third farm', IMAGE, () => poseScene(3, 6000));
