import {
    DEFAULT_SYMMETRY,
    MAX_MORPH_SPEED,
    SHIFT_STEP,
    SYMMETRIES,
} from '../data';
import { createMultigridTiles, type TileSet } from './multigrid-tiles';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A rhombus tiling: what goes under the scope. It's given by its symmetry and
 * how far its grids are shifted, and its grids can drift by themselves. All
 * lengths are in tile edges, and its y axis points down, as the screen's does.
 *
 * A tiling goes on forever, so it only lays the tiles it's asked for, the
 * ones whose middles lie within a disc somewhat wider than what is asked for.
 * It knows nothing of who is looking, or how they look.
 *
 * Tiles can't move part of the way: as the grids shift, a tile is in one
 * place, then another. So the tiles are laid at steps of the shift, as two
 * exact tilings, the step before the shift and the step after, and
 * `tileBlend` says how far the shift has gone from one to the other. Tiles
 * that are the same in both don't change at all.
 */
export interface TilingModel {
    /** The tiling's symmetry, one of `SYMMETRIES`. Set to any other number, it takes the nearest. */
    symmetry: number;
    /** How far the grids are shifted, from 0 to 1. Shifting by 1 comes back round to the start. */
    shift: number;
    /** Whether the grids shift by themselves. */
    isDrifting: boolean;
    /** How fast the grids shift while they drift, in whole shifts per second, up to `MAX_MORPH_SPEED`. */
    morphSpeed: number;
    /** Changes to a new tiling at random: a symmetry and a shift. */
    pickRandomTiling: () => void;

    /** The tile picked out, as an index into `tiles`, or -1 if none is. */
    readonly pickedTile: number;
    /**
     * Picks out `tile`, an index into `tiles`, or lets the picked tile go if
     * it is -1. It stays picked as the tiles are laid again, until it flips
     * away. Any other symmetry lets it go.
     */
    pickTile: (tile: number) => void;

    /** The tiles laid, at the step of the shift just before it. */
    readonly tiles: TileSet;
    /** The same tiles at the step just after the shift. */
    readonly nextTiles: TileSet;
    /** How far the shift has gone from `tiles` to `nextTiles`, from 0 up to, but not including, 1. */
    readonly tileBlend: number;
    /**
     * Makes sure tiles lie over the disc of `radius` about (`centreX`,
     * `centreY`). It lays them again only if it must: if the shift has passed
     * a step, if the tiling has changed, if the disc has strayed out of the
     * tiles, or if it has closed in so far that most of them are wasted.
     */
    layTilesOver: (centreX: number, centreY: number, radius: number) => void;
    /** Moves the grids on by `deltaMs`, if they are drifting. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a {@link TilingModel}. */
export interface TilingModelOptions {
    /**
     * Seed for the random numbers that pick a random tiling. Pass one for
     * tilings that come out the same each time; defaults to a random seed.
     */
    readonly seed?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the Penrose tiling, holding still, with no tiles laid yet. */
export function createTilingModel(options: TilingModelOptions): TilingModel {
    // The generator's state, in a typed array so that advancing it never boxes a number
    const randomState = new Uint32Array([options.seed ?? Math.random() * 4294967296]);
    const tiles = createMultigridTiles();
    const nextTiles = createMultigridTiles();

    let symmetry = DEFAULT_SYMMETRY;
    let shift = DEFAULT_SHIFT;
    let isDrifting = false;
    let morphSpeed = DEFAULT_MORPH_SPEED;

    // The tile picked out, and what makes it the same tile each time the tiles are laid
    let pickedTile = -1;
    let pickedPair = -1;
    let pickedFirstLine = 0;
    let pickedSecondLine = 0;

    // The disc and the step of the shift the tiles were last laid at, and whether the tiling has changed since
    let laidStep = -1;
    let laidCentreX = 0;
    let laidCentreY = 0;
    let laidRadius = 0;
    let isLayingDue = true;

    const model: TilingModel = {
        get symmetry() { return symmetry; },
        set symmetry(value) {
            const nearest = findNearestSymmetry(value);
            if (nearest === symmetry) return;
            symmetry = nearest;
            isLayingDue = true;
            pickedPair = -1;
        },
        get shift() { return shift; },
        set shift(value) {
            shift = wrapUnit(value);
        },
        get isDrifting() { return isDrifting; },
        set isDrifting(value) { isDrifting = value; },
        get morphSpeed() { return morphSpeed; },
        set morphSpeed(value) { morphSpeed = clamp(value, 0, MAX_MORPH_SPEED); },

        pickRandomTiling() {
            model.symmetry = SYMMETRIES[pickIndex(SYMMETRIES.length)];
            model.shift = nextRandom(randomState);
        },

        get pickedTile() { return pickedTile; },

        pickTile(tile) {
            const isTile = tile >= 0 && tile < tiles.count;
            pickedTile = isTile ? tile : -1;
            pickedPair = isTile ? tiles.pairs[tile] : -1;
            if (!isTile) return;
            pickedFirstLine = tiles.firstLines[tile];
            pickedSecondLine = tiles.secondLines[tile];
        },

        get tiles() { return tiles; },
        get nextTiles() { return nextTiles; },
        get tileBlend() { return shift / SHIFT_STEP - Math.floor(shift / SHIFT_STEP); },
        layTilesOver,
        update,
    };

    return model;

    // ---- Update ------------------------------------------------------------

    function update(deltaMs: number): void {
        if (isDrifting && morphSpeed > 0) model.shift = shift + morphSpeed * (deltaMs / 1000);
    }

    // ---- Laying ------------------------------------------------------------

    function layTilesOver(centreX: number, centreY: number, radius: number): void {
        const strayX = centreX - laidCentreX;
        const strayY = centreY - laidCentreY;
        const reach = Math.sqrt(strayX * strayX + strayY * strayY) + radius;
        const isOutside = reach > laidRadius;
        const wantedRadius = radius * LAYING_MARGIN + LAYING_SPARE;
        const isWasteful = wantedRadius * 2 < laidRadius;
        const step = Math.floor(shift / SHIFT_STEP);
        if (!isLayingDue && !isOutside && !isWasteful && step === laidStep) return;
        laidStep = step;
        laidCentreX = centreX;
        laidCentreY = centreY;
        laidRadius = wantedRadius;
        tiles.lay(symmetry, step * SHIFT_STEP, laidCentreX, laidCentreY, laidRadius);
        nextTiles.lay(symmetry, (step + 1) * SHIFT_STEP, laidCentreX, laidCentreY, laidRadius);
        isLayingDue = false;
        findPickedTile();
    }

    /** Finds the picked tile again, among tiles just laid. It has gone if it has flipped away. */
    function findPickedTile(): void {
        pickedTile = -1;
        if (pickedPair < 0) return;
        for (let i = 0; i < tiles.count; i++) {
            if (tiles.pairs[i] === pickedPair && tiles.firstLines[i] === pickedFirstLine && tiles.secondLines[i] === pickedSecondLine) {
                pickedTile = i;
                return;
            }
        }
    }

    /** A whole number from 0 up to, but not including, `length`. */
    function pickIndex(length: number): number {
        return Math.min(length - 1, Math.floor(nextRandom(randomState) * length));
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the grids start: a little off their most symmetric place, which looks busier, and on a step, so that one clean tiling shows. */
const DEFAULT_SHIFT = 13 * SHIFT_STEP;
const DEFAULT_MORPH_SPEED = 0.01;

/** How much wider than the disc asked for the tiles are laid, as a share of it, and in tile edges. The spare means every crossing in the disc has its tile. */
const LAYING_MARGIN = 1.3;
const LAYING_SPARE = 3;

function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

/** `value`, brought round into the range from 0 up to, but not including, 1. */
function wrapUnit(value: number): number {
    return value - Math.floor(value);
}

/** The symmetry in `SYMMETRIES` nearest to `value`, the lower of two as near. */
function findNearestSymmetry(value: number): number {
    let nearest = SYMMETRIES[0];
    for (let i = 1; i < SYMMETRIES.length; i++) {
        if (Math.abs(SYMMETRIES[i] - value) < Math.abs(nearest - value)) nearest = SYMMETRIES[i];
    }
    return nearest;
}

/** Mulberry32: a small seeded generator of uniform numbers in [0, 1). Advances `state`. */
function nextRandom(state: Uint32Array): number {
    state[0] += 0x6D2B79F5;
    let t = state[0];
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
