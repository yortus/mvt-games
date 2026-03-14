export type TileKind = 'surface' | 'dirt' | 'tunnel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tile size in pixels. */
export const TILE_SIZE = 20;

/** Number of columns in the field. */
export const FIELD_COLS = 14;

/** Number of rows in the field (top row is surface). */
export const FIELD_ROWS = 18;

/** Height of the HUD area in pixels. */
export const HUD_HEIGHT = 30;

// ---------------------------------------------------------------------------
// Depth Layers
// ---------------------------------------------------------------------------

export interface DepthLayer {
    readonly startRow: number;
    readonly endRow: number;
    readonly color: number;
}

/** Four earth color bands - bright yellow-brown at top, darker reds with depth. */
export const DEPTH_LAYERS: readonly DepthLayer[] = [
    { startRow: 1, endRow: 5, color: 0xe8b830 },  // warm yellow-brown
    { startRow: 6, endRow: 9, color: 0xc87028 },  // orange-brown
    { startRow: 10, endRow: 13, color: 0xb04020 }, // burnt red-brown
    { startRow: 14, endRow: 17, color: 0x882218 }, // deep red
];

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

/** Digger spawn tile [row, col] - surface row, center. */
export const DIGGER_SPAWN: [number, number] = [0, 7];

// ---------------------------------------------------------------------------
// Base Field Layout
// ---------------------------------------------------------------------------

/**
 * Build the base field layout as a flat TileKind array (FIELD_ROWS × FIELD_COLS).
 * Top row is surface, rest is dirt with pre-carved starter tunnels.
 */
function buildBaseField(): TileKind[] {
    const field: TileKind[] = new Array(FIELD_ROWS * FIELD_COLS);

    // Fill everything as dirt
    for (let i = 0; i < field.length; i++) {
        field[i] = 'dirt';
    }

    // Top row is surface
    for (let c = 0; c < FIELD_COLS; c++) {
        field[c] = 'surface';
    }

    // Pre-carved starter tunnels (short horizontal runs)
    const starterTunnels: [number, number, number][] = [
        // [row, startCol, endCol]
        [3, 2, 5],
        [3, 9, 12],
        [7, 4, 10],
        [11, 1, 4],
        [11, 10, 13],
        [15, 3, 7],
        [15, 8, 11],
    ];

    for (let t = 0; t < starterTunnels.length; t++) {
        const row = starterTunnels[t][0];
        const startC = starterTunnels[t][1];
        const endC = starterTunnels[t][2];
        for (let c = startC; c <= endC; c++) {
            field[row * FIELD_COLS + c] = 'tunnel';
        }
    }

    return field;
}

/** Base field layout (flat array, indexed by row * FIELD_COLS + col). */
export const BASE_FIELD: readonly TileKind[] = buildBaseField();
