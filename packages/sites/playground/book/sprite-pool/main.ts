import { Graphics } from 'pixi.js';
import { definePixiProject } from 'playground';
import { createComputed } from '@mvtjs/utils';
import { createFrameMeter } from './meter';
import { createFountainModel, createSeededRandom } from './models';
import { MeterView, SparksView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many sparks the fountain throws each second. Try 6000. */
const SPARKS_PER_SECOND = 2500;

/**
 * Whether the sparks' view keeps a pool of sprites, made once and reused
 * every tick, or makes a new sprite for every spark, every tick, and
 * throws the old ones away. Try true, and compare the times.
 */
const USE_POOL = false;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;
const BACKGROUND = 0x0c0a14;
/** The height of the area the sparks fly in, above the meter. */
const SKY_HEIGHT = 252;

// The project: a fountain of sparks, a view of them, and a meter that
// times the models and views each tick. The playground ticks what `start`
// returns, which starts the meter's clock, then moves the fountain on.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: BACKGROUND,
    start: ({ stage }) => {
        const model = createFountainModel({
            x: WIDTH / 2,
            y: SKY_HEIGHT - 10,
            sparksPerSecond: SPARKS_PER_SECOND,
            random: createSeededRandom({ seed: 25 }),
        });
        const meter = createFrameMeter({ warmUpTicks: 150, historyLength: 90, sampleTicks: 30 });

        // What the sparks' refresh does each tick, made again only when the count of sparks changes
        const note = createComputed({ watch: () => model.count, compute: describeWork });

        const sparks = SparksView({
            count: () => model.count,
            xAt: model.xAt,
            yAt: model.yAt,
            burnedAt: model.burnedAt,
            usePool: USE_POOL,
        });
        // The meter's panel hides the sparks that fall below the sky
        const panel = new Graphics().rect(0, SKY_HEIGHT, WIDTH, HEIGHT - SKY_HEIGHT).fill(BACKGROUND);
        const meterView = MeterView({ meter, note, width: WIDTH - 32 });
        meterView.position.set(16, SKY_HEIGHT + 12);
        // The meter goes last, so its refresh comes after the sparks'
        stage.addChild(sparks, panel, meterView);

        return {
            update(deltaMs: number) {
                meter.startTick();
                model.update(deltaMs);
            },
        };
    },
});

function describeWork(count: number): string {
    const sprites = count.toLocaleString('en-US');
    if (USE_POOL) return `Each tick, the refresh moves ${sprites} sprites from its pool, and makes none.`;
    return `Each tick, the refresh makes ${sprites} new sprites, and throws as many away.`;
}
