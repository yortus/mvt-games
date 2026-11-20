import { MOST_CELL_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where a harbour, its numbers and its fleet go, in pixels, from the top left corner of the space they are fitted into. */
export interface BoardLayout {
    /** The size of each cell. */
    readonly cellSize: number;
    /** The left of the harbour. */
    readonly gridX: number;
    /** The top of the harbour. */
    readonly gridY: number;
    /** The size of the numbers, along the top and down the left. */
    readonly clueSize: number;
    /** The middle of the fleet list, under the harbour. */
    readonly fleetY: number;
    /** The length of one cell of a boat in the fleet list. */
    readonly fleetUnit: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a board is laid out from. */
export interface BoardLayoutOptions {
    /** How many cells along each side of the harbour. */
    readonly size: number;
    /** How many boat cells the fleet has in all, and how many boats, which the fleet list is fitted to. */
    readonly fleetCells: number;
    readonly fleetBoats: number;
    /** Whether the fleet list is shown under the harbour. The example on the How to play card leaves it out. */
    readonly hasFleet: boolean;
    /** The width of the space to fit into. */
    readonly width: number;
    /** The height of the space to fit into. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Fits a harbour into a space, as large as it will go, up to
 * `MOST_CELL_SIZE` a cell, with room for its numbers above and to its left,
 * and for the fleet list under it, and centres them all.
 */
export function layOutBoard(options: BoardLayoutOptions): BoardLayout {
    const { size, fleetCells, fleetBoats, hasFleet, width, height } = options;
    const fleetRoom = hasFleet ? FLEET_ROOM : 0;
    // The numbers take a strip a fixed share of a cell, so fit the cells and the strip together
    const cellSize = Math.min(MOST_CELL_SIZE, width / (size + CLUE_SHARE), (height - fleetRoom) / (size + CLUE_SHARE));
    const clueRoom = cellSize * CLUE_SHARE;
    const span = size * cellSize;
    const gridX = (width - span - clueRoom) / 2 + clueRoom;
    const gridY = (height - span - clueRoom - fleetRoom) / 2 + clueRoom;
    const gaps = Math.max(0, fleetBoats - 1) * FLEET_GAP_SHARE;
    return {
        cellSize,
        gridX,
        gridY,
        clueSize: Math.min(MOST_CLUE_SIZE, cellSize * CLUE_TEXT_SHARE),
        fleetY: gridY + span + fleetRoom / 2 + FLEET_DROP,
        fleetUnit: fleetCells > 0 ? Math.min(MOST_FLEET_UNIT, (width * FLEET_WIDTH_SHARE) / (fleetCells + gaps)) : 0,
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How deep the strip for the numbers is, and how large the numbers are, as shares of a cell, and the largest they are drawn. */
const CLUE_SHARE = 0.75;
const CLUE_TEXT_SHARE = 0.5;
const MOST_CLUE_SIZE = 26;

/** The height of the space under the harbour for the fleet list, how far its middle sits below the middle of that space, the largest a boat cell is drawn there, the gap between two boats as a share of a cell, and how much of the width it may take. */
const FLEET_ROOM = 56;
const FLEET_DROP = 4;
const MOST_FLEET_UNIT = 26;
const FLEET_GAP_SHARE = 0.7;
const FLEET_WIDTH_SHARE = 0.95;
