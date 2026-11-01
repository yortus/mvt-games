import { definePixiProject } from 'playground';
import { createFrameMeter } from './meter';
import { createSeededRandom, createSwarmModel } from './models';
import { MeterView, SwarmView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many enemies there are. Try 40000, and watch the bar grow. */
const COUNT = 10_000;

/**
 * Whether each enemy's dot adds up its stats with Object.values(), which
 * makes a new array every time, or reads them directly. Try false, and
 * compare the times.
 */
const USE_OBJECT_VALUES = true;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;
/** The height of the arena the swarm moves in, above the meter. */
const ARENA_HEIGHT = 250;

// The project: a swarm of enemies, a view of them, and a meter that times
// the models and views each tick. The playground ticks what `start`
// returns, which starts the meter's clock, then moves the swarm on.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d0f16,
    start: ({ stage }) => {
        const model = createSwarmModel({ count: COUNT, width: WIDTH, height: ARENA_HEIGHT, random: createSeededRandom({ seed: 24 }) });
        const meter = createFrameMeter({ warmUpTicks: 150, historyLength: 90, sampleTicks: 30 });

        const swarm = SwarmView({ model, useObjectValues: USE_OBJECT_VALUES });
        const note = describeWork();
        const meterView = MeterView({ meter, note: () => note, width: WIDTH - 32 });
        meterView.position.set(16, ARENA_HEIGHT + 12);
        // The meter goes last, so its refresh comes after the swarm's
        stage.addChild(swarm, meterView);

        return {
            update(deltaMs: number) {
                meter.startTick();
                model.update(deltaMs);
            },
        };
    },
});

/** What the swarm's refresh makes each tick, which the meter shows above its times. */
function describeWork(): string {
    if (!USE_OBJECT_VALUES) return 'Each tick, the refresh reads the stats directly, and makes nothing new.';
    return `Each tick, Object.values() makes ${COUNT.toLocaleString('en-US')} new arrays: ${(COUNT * 60).toLocaleString('en-US')} a second.`;
}
