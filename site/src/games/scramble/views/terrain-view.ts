import { Container, Graphics } from 'pixi.js';
import { setTickMethods } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TerrainViewBindings {
    /** How far the terrain has scrolled, in columns. */
    scrollCol: () => number;
    /** The view's size, which sizes its ring buffer of columns, so read once. */
    visibleCols: number;
    visibleRows: number;
    tileSize: number;
    /** Read when a column scrolls into view and is drawn. */
    isSolidAt: (col: number, row: number) => boolean;
    sectionIndexAt: (col: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The scrolling terrain. Written imperatively: it keeps a ring buffer of
 * column graphics, redrawing each column as it scrolls into view.
 */
export function TerrainView(bindings: TerrainViewBindings): Container {
    const { tileSize, visibleCols, visibleRows } = bindings;
    const BUFFER_SIZE = visibleCols + 4;

    // Ring buffer of column graphics
    const columnGfx: Graphics[] = new Array(BUFFER_SIZE);
    let ringStart = 0;
    let leftWorldCol = -1;

    // Outer container stays at (0,0).
    // Inner container shifts for sub-tile smooth scrolling.
    const view = new Container();
    view.label = 'terrain';

    const content = new Container();
    view.addChild(content);

    initialiseView();
    setTickMethods(view, { refresh });
    return view;

    function initialiseView(): void {
        for (let i = 0; i < BUFFER_SIZE; i++) {
            const gfx = new Graphics();
            columnGfx[i] = gfx;
            content.addChild(gfx);
            drawColumn(gfx, leftWorldCol + i);
        }
        positionColumns();
    }

    function refresh(): void {
        const scrollCol = bindings.scrollCol();
        const targetLeftCol = Math.floor(scrollCol) - 2;

        // Detect discontinuous scroll jump (e.g. loop reset) and rebuild buffer
        if (targetLeftCol < leftWorldCol || targetLeftCol > leftWorldCol + BUFFER_SIZE) {
            leftWorldCol = targetLeftCol;
            ringStart = 0;
            for (let i = 0; i < BUFFER_SIZE; i++) {
                drawColumn(columnGfx[i], leftWorldCol + i);
            }
        }

        // Recycle columns that scrolled off the left
        while (leftWorldCol < targetLeftCol) {
            const newWorldCol = leftWorldCol + BUFFER_SIZE;
            drawColumn(columnGfx[ringStart], newWorldCol);
            ringStart = (ringStart + 1) % BUFFER_SIZE;
            leftWorldCol++;
        }

        positionColumns();

        // Sub-tile smooth scroll offset (applied to inner content, not the masked outer)
        content.x = (leftWorldCol - scrollCol) * tileSize;
    }

    function positionColumns(): void {
        for (let i = 0; i < BUFFER_SIZE; i++) {
            columnGfx[(ringStart + i) % BUFFER_SIZE].x = i * tileSize;
        }
    }

    function drawColumn(gfx: Graphics, worldCol: number): void {
        gfx.clear();
        const section = bindings.sectionIndexAt(worldCol);
        const floorColor = SECTION_FLOOR_COLORS[section] ?? SECTION_FLOOR_COLORS[0];
        const ceilColor = SECTION_CEILING_COLORS[section] ?? SECTION_CEILING_COLORS[0];

        for (let r = 0; r < visibleRows; r++) {
            if (bindings.isSolidAt(worldCol, r)) {
                // Use ceiling color for top half, floor color for bottom half
                const color = r < visibleRows / 2 ? ceilColor : floorColor;
                gfx.rect(0, r * tileSize, tileSize, tileSize).fill(color);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Section color schemes
const SECTION_FLOOR_COLORS: readonly number[] = [
    0x5a8a3a, // Section 1 - green mountains
    0x6a7a8a, // Section 2 - grey-blue caves
    0x8a3a2a, // Section 3 - dark red base
];

const SECTION_CEILING_COLORS: readonly number[] = [
    0x4a7a2a, // Section 1 - darker green
    0x5a6a7a, // Section 2 - dark grey-blue
    0x7a2a1a, // Section 3 - darker red
];
