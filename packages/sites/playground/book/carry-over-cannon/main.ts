import { definePixiProject } from 'playground';
import { type CannonModel, createCannonModel, createCarryOverCannonModel, RANGE } from './models';
import { CannonRowView, LegendView, StepPickerView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * The step sizes you can pick, in ms: a frame at 144 Hz, 60 Hz and 30 Hz,
 * and the ticker's cap, the longest step a run of slow frames gives.
 */
const STEP_SIZES: readonly number[] = [7, 16, 33, 100];
/** The step size the example starts with, in ms. */
const STARTING_STEP_MS = 100;
/** The small steps the rings' cannons are given, in ms. */
const SMALL_STEP_MS = 1;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;

// Two cannons, each firing a ball every 250 ms: on top, one that drops the
// time left over when it fires, as the chapter's banner does, and below,
// one that carries it over. Real time is handed to both in steps of the
// size you pick, at a steady pace: with 100 ms steps, each cannon gets
// update(100) ten times a second. Beside each, a copy of the same cannon
// gets the same time in steps of 1 ms, and its balls are drawn as rings.
// A cannon keeps its promise when its balls sit in their rings at every
// step size.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d1520,
    start: ({ stage }) => {
        let stepMs = STARTING_STEP_MS;
        // Real time not yet handed to the cannons, because it's less than a step
        let owedMs = 0;
        const cannon = createCannonModel();
        const smallStepCannon = createCannonModel();
        const carryOverCannon = createCarryOverCannonModel();
        const smallStepCarryOverCannon = createCarryOverCannonModel();

        const top = CannonRowView({
            label: 'drops leftover time',
            color: 0xff8866,
            range: RANGE,
            balls: () => cannon.balls,
            smallStepBalls: () => smallStepCannon.balls,
        });
        top.y = 16;
        const bottom = CannonRowView({
            label: 'carries leftover time over',
            color: 0x66dd88,
            range: RANGE,
            balls: () => carryOverCannon.balls,
            smallStepBalls: () => smallStepCarryOverCannon.balls,
        });
        bottom.y = 116;
        const legend = LegendView({ text: `where steps of ${SMALL_STEP_MS} ms would put each ball` });
        legend.position.set(100, 244);
        const picker = StepPickerView({
            steps: STEP_SIZES,
            stepMs: () => stepMs,
            onStepPicked: (pickedMs) => {
                stepMs = pickedMs;
            },
        });
        picker.position.set(WIDTH / 2, 290);

        stage.addChild(top, bottom, legend, picker);

        return {
            update(deltaMs: number) {
                owedMs += deltaMs;
                while (owedMs >= stepMs) {
                    owedMs -= stepMs;
                    cannon.update(stepMs);
                    carryOverCannon.update(stepMs);
                    updateInSmallSteps(smallStepCannon, stepMs);
                    updateInSmallSteps(smallStepCarryOverCannon, stepMs);
                }
            },
        };
    },
});

/** Hands a cannon `totalMs` of time in steps of `SMALL_STEP_MS`, and whatever is left at the end. */
function updateInSmallSteps(cannon: CannonModel, totalMs: number): void {
    for (let remainingMs = totalMs; remainingMs > 0; remainingMs -= SMALL_STEP_MS) {
        cannon.update(Math.min(SMALL_STEP_MS, remainingMs));
    }
}
