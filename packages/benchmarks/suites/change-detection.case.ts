import { readParams, report, timeFrames } from '../harness/measure';
import { createChangeDetectionFrame } from '../shared/change-detection-scene';

// Measured file for the `change-detection` suite: microseconds per frame. See
// `createChangeDetectionFrame` for the scenarios and approaches.

const params = readParams();
const frame = createChangeDetectionFrame(String(params.scenario), String(params.approach), Number(params.changedPercent));
report({ usPerFrame: timeFrames(frame) });
