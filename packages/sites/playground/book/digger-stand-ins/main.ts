import { definePixiProject } from 'playground';
import { createDiggerModel, createTestRunModel, type DiggerModelOptions } from './models';
import { TestRunView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The column the digger starts in. */
const START_COL = 0;
/** How fast the digger moves, in tiles per second. */
const SPEED = 5;
/** The field's width and height, in tiles. */
const FIELD = 8;

/**
 * The test's stand-in for the whole field model: one line, which says the
 * digger can walk only on the first three columns. Try `col < 6`, or
 * `row !== 1 || col < 5`, and watch where the digger stops.
 */
const isWalkable = (_row: number, col: number): boolean => col < 3;

/** The column the test expects the digger to stop in. */
const EXPECTED_COL = 2;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;

// The project: the test below, run over and over, slowly enough to watch,
// and a view of it. The playground ticks the run, which moves the digger on.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x141820,
    start: ({ stage }) => {
        const model = createTestRunModel({
            // The test's first two lines. The run then moves time on by 120
            // frames of 16 ms, as the test's loop does.
            startRun: () => {
                const digger = createDigger({ isWalkable });
                digger.setDirection('right');
                return digger;
            },
            runMs: 120 * 16,
        });
        stage.addChild(TestRunView({
            model,
            fieldRows: FIELD,
            fieldCols: FIELD,
            isWalkableAt: isWalkable,
            expectedCol: EXPECTED_COL,
        }));
        return model;
    },
});

// The test file's helper. It fills in every option the digger needs, so a
// test names only the ones it's about.
function createDigger(options: Partial<DiggerModelOptions> = {}) {
    return createDiggerModel({
        startRow: 1,
        startCol: START_COL,
        speed: SPEED,
        fieldRows: FIELD,
        fieldCols: FIELD,
        isWalkable: () => true,
        isDirt: () => false,
        ...options,
    });
}
