import type { RoundConfig } from '../data';
import { createBeetleModel, type BeetleHand, type BeetleModel } from './beetle-model';
import type { Direction } from './common';
import { createDustDevilModel, type DevilTarget, type DustDevilModel } from './dust-devil-model';
import type { FieldModel } from './field-model';
import { isClearOf } from './geometry';
import type { Random } from './random';
import { createSheepModel, type SheepModel, type SheepModelOptions } from './sheep-model';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a round is set up in, and how. */
export interface RoundSetupOptions {
    /** The round's new meadow. */
    readonly field: FieldModel;
    readonly config: RoundConfig;
    /** Places the dust devils and sheep where the round gives none. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/**
 * Creates the round's dust devils, each at its start or else somewhere open
 * at random, well in from the edge and apart from the others.
 */
export function placeDevils(options: RoundSetupOptions & { readonly target: DevilTarget }): DustDevilModel[] {
    const { field, config, random, target } = options;
    const devils: DustDevilModel[] = [];
    for (let i = 0; i < config.devilCount; i++) {
        const start = config.devilStarts?.[i];
        let row = start?.row ?? field.rows / 2;
        let col = start?.col ?? field.cols / 2;
        for (let attempt = 0; start === undefined && attempt < PLACEMENT_ATTEMPTS; attempt++) {
            row = random.between(DEVIL_MARGIN, field.rows - DEVIL_MARGIN);
            col = random.between(DEVIL_MARGIN, field.cols - DEVIL_MARGIN);
            if (isRoomForDevil(field, row, col) && isClearOf(devils, row, col, DEVIL_SPACING)) break;
        }
        devils.push(createDustDevilModel({
            row,
            col,
            speed: config.devilSpeed,
            chase: config.devilChase,
            target,
            random,
            regionAt: field.regionAt,
        }));
    }
    return devils;
}

/**
 * Creates the round's sheep, each at its start or else on an open cell at
 * random, clear of the dust devils and of one another.
 */
export function placeSheep(options: RoundSetupOptions & Pick<SheepModelOptions, 'devils'>): SheepModel[] {
    const { field, config, random, devils } = options;
    const sheep: SheepModel[] = [];
    for (let i = 0; i < config.sheepCount; i++) {
        const start = config.sheepStarts?.[i];
        let row = start?.row ?? field.rows / 2;
        let col = start?.col ?? field.cols / 2;
        for (let attempt = 0; start === undefined && attempt < PLACEMENT_ATTEMPTS; attempt++) {
            row = Math.floor(random.between(SHEEP_MARGIN, field.rows - SHEEP_MARGIN)) + 0.5;
            col = Math.floor(random.between(SHEEP_MARGIN, field.cols - SHEEP_MARGIN)) + 0.5;
            if (field.isMeadow(Math.floor(row), Math.floor(col))
                && isClearOf(devils(), row, col, SHEEP_DEVIL_SPACING)
                && isClearOf(sheep, row, col, SHEEP_SPACING)) break;
        }
        sheep.push(createSheepModel({ row, col, random, regionAt: field.regionAt, devils }));
    }
    return sheep;
}

/**
 * Creates the round's first beetles, on the edge of the meadow, crawling
 * round it. Each keeps to the hand that has the meadow on it.
 */
export function placeBeetles(options: Omit<RoundSetupOptions, 'random'>): BeetleModel[] {
    const { field, config } = options;
    const beetles: BeetleModel[] = [];
    for (let i = 0; i < config.startBeetles; i++) {
        const start = BEETLE_STARTS[i % BEETLE_STARTS.length];
        beetles.push(createBeetleModel({
            row: Math.floor(field.rows * start.rowShare),
            col: Math.floor(field.cols * start.colShare),
            direction: start.direction,
            hand: start.hand,
            speed: config.beetleSpeed,
            isWalkable: field.isWalkable,
            isHatching: false,
        }));
    }
    return beetles;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PLACEMENT_ATTEMPTS = 200;
/** How far in from the edge, in cells, dust devils and sheep start. */
const DEVIL_MARGIN = 9;
const SHEEP_MARGIN = 5;
/** How far apart, in cells, dust devils start from one another, and sheep from dust devils and one another. */
const DEVIL_SPACING = 14;
const SHEEP_DEVIL_SPACING = 8;
const SHEEP_SPACING = 5;
/** How much open meadow, in cells, a dust devil needs round its middle to start. */
const DEVIL_ROOM = 2.5;

/**
 * Where the round's first beetles start, as shares of the meadow's height
 * and width. The first two start at the top middle, going opposite ways.
 * The next start halfway down the left and right edges.
 */
const BEETLE_STARTS: readonly {
    readonly rowShare: number;
    readonly colShare: number;
    readonly direction: Direction;
    readonly hand: BeetleHand;
}[] = [
    { rowShare: 0, colShare: 0.5, direction: 'right', hand: 'right' },
    { rowShare: 0, colShare: 0.5, direction: 'left', hand: 'left' },
    { rowShare: 0.5, colShare: 0, direction: 'up', hand: 'right' },
    { rowShare: 0.5, colShare: 1, direction: 'down', hand: 'right' },
];

/** Whether every cell a dust devil at (row, col) would cover is open meadow. */
function isRoomForDevil(field: FieldModel, row: number, col: number): boolean {
    const reach = Math.ceil(DEVIL_ROOM);
    for (let r = Math.floor(row) - reach; r <= Math.floor(row) + reach; r++) {
        for (let c = Math.floor(col) - reach; c <= Math.floor(col) + reach; c++) {
            if (!field.isMeadow(r, c)) return false;
        }
    }
    return true;
}
