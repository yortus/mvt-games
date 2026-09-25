import { readParams, report, timeFrames } from '../harness/measure';
import { createSyncedScene, type Approach } from '../shared/synced-scene';

// Measured file for the `reactivity` and `scaling` suites: microseconds per
// frame to change the model and bring the view up to date.

const params = readParams();
const count = Number(params.count);
const scene = createSyncedScene({
    approach: params.approach as Approach,
    count,
    dynamicProperties: Number(params.dynamicProperties) === 1 ? 1 : 3,
    changedPercent: Number(params.changedPercent),
});
const usPerFrame = timeFrames(scene.frame);
report({ usPerFrame, nsPerContainer: (usPerFrame * 1000) / count });
