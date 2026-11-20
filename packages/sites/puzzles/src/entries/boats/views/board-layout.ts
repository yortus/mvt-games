import type { BoatPuzzle } from '../models';
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
    /** The puzzle. The board is fitted to its harbour's size and its fleet. */
    readonly puzzle: BoatPuzzle;
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
 * Fits a puzzle's harbour into a space, as large as it will go, up to
 * `MOST_CELL_SIZE` a cell. It leaves room for the numbers above the harbour
 * and to its left, and for the fleet list under it. Then it centres them
 * all in the space.
 */
export function layOutBoard(options: BoardLayoutOptions): BoardLayout {
    const { puzzle, hasFleet, width, height } = options;
    const { size } = puzzle.grid;
    const fleetBoats = puzzle.fleet.length;
    let fleetCells = 0;
    for (let i = 0; i < fleetBoats; i++) fleetCells += puzzle.fleet[i];
    const fleetRoom = hasFleet ? FLEET_ROOM : 0;
    // The numbers sit in a strip whose depth is a share of a cell, so the cells and the strip are fitted together
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

/** How deep the strip for the numbers is, as a share of a cell. */
const CLUE_SHARE = 0.75;

/** How large the numbers are, as a share of a cell. */
const CLUE_TEXT_SHARE = 0.5;

/** The largest the numbers are drawn, in pixels. */
const MOST_CLUE_SIZE = 26;

/** The height of the space under the harbour for the fleet list, in pixels. */
const FLEET_ROOM = 56;

/** How far the fleet list's middle sits below the middle of its space, in pixels. */
const FLEET_DROP = 4;

/** The largest a boat cell is drawn in the fleet list, in pixels. */
const MOST_FLEET_UNIT = 26;

/** The gap between two boats in the fleet list, as a share of a boat cell there. */
const FLEET_GAP_SHARE = 0.7;

/** How much of the space's width the fleet list may cover. */
const FLEET_WIDTH_SHARE = 0.95;
