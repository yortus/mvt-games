import { definePixiProject } from 'playground';
import { createComputed } from '@mvtjs/utils';
import { createFrameMeter } from './meter';
import { createFieldModel, createSeededRandom } from './models';
import { DiggersView, MeterView, TileGridView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * Whether the tiles' view uses the refresh from the chapter's opening, which
 * makes a new string for every dug tile, every tick. Watch its time climb as
 * more of the field is dug. Then try false.
 */
const ALLOCATE_EVERY_TICK = true;

/** The width and height of one tile, in pixels. Smaller tiles make a field of more tiles. */
const TILE_SIZE = 3;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;
/** The height of the field, above the meter, in pixels. */
const FIELD_HEIGHT = 252;

// The project: a field of dirt, diggers that wander through it, and a meter
// that times the models and views each tick. The playground ticks what
// `start` returns, which starts the meter's clock, then moves the field on.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x17110c,
    start: ({ stage }) => {
        const model = createFieldModel({
            rows: Math.floor(FIELD_HEIGHT / TILE_SIZE),
            cols: Math.floor(WIDTH / TILE_SIZE),
            diggerCount: 24,
            random: createSeededRandom({ seed: 25 }),
        });
        const meter = createFrameMeter({ warmUpTicks: 150, historyLength: 90, sampleTicks: 30 });

        // What the tiles' refresh makes each tick, made again only when the count of dug tiles changes
        const note = createComputed({ watch: () => model.dugCount, compute: describeWork });

        const tiles = TileGridView({ model, tileSize: TILE_SIZE, allocateEveryTick: ALLOCATE_EVERY_TICK });
        const diggers = DiggersView({ count: model.diggerCount, rowAt: model.diggerRowAt, colAt: model.diggerColAt, tileSize: TILE_SIZE });
        const meterView = MeterView({ meter, note, width: WIDTH - 32 });
        meterView.position.set(16, FIELD_HEIGHT + 12);
        // The meter goes last, so its refresh comes after the others'
        stage.addChild(tiles, diggers, meterView);

        return {
            update(deltaMs: number) {
                meter.startTick();
                model.update(deltaMs);
            },
        };
    },
});

function describeWork(dugCount: number): string {
    if (!ALLOCATE_EVERY_TICK) return `Each tick, the refresh checks ${dugCount.toLocaleString('en-US')} dug tiles, and makes nothing new.`;
    return `Each tick, the refresh makes 1 array, 1 closure and ${dugCount.toLocaleString('en-US')} strings.`;
}
