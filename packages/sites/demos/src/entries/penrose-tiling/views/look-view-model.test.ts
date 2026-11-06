import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/html';
import { createMultigridTiles, type TileSet } from '../models';
import { COLOR_MODES } from './color-mode';
import { createLookViewModel, type LookViewModel } from './look-view-model';
import { PALETTE_NAMES } from './palette-name';
import { DEFAULT_GAP, DEFAULT_GRID_REVEAL, MAX_FLOW_SPEED } from './view-constants';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createLookViewModel', () => {
    describe('the colours', () => {
        it('flow while the tiling drifts', async () => {
            const { look } = setup({ isDrifting: true });
            await advanceTime(1000, look);
            expect(look.colorOffset).toBeCloseTo(look.flowSpeed, 6);
        });

        it('hold still while it doesn\'t', async () => {
            const { look } = setup({ isDrifting: false });
            await advanceTime(1000, look);
            expect(look.colorOffset).toBe(0);
        });

        it('come back round to the start of the palette', async () => {
            const { look } = setup({ isDrifting: true });
            look.flowSpeed = MAX_FLOW_SPEED;
            look.colorOffset = 0.99;
            await advanceTime(1000, look);
            expect(look.colorOffset).toBeGreaterThanOrEqual(0);
            expect(look.colorOffset).toBeLessThan(MAX_FLOW_SPEED);
        });

        it('flow no faster than their limit', () => {
            const { look } = setup({});
            look.flowSpeed = MAX_FLOW_SPEED * 2;
            expect(look.flowSpeed).toBe(MAX_FLOW_SPEED);
            look.flowSpeed = -1;
            expect(look.flowSpeed).toBe(0);
        });
    });

    describe('the grids', () => {
        it('starts with its gaps open, and the tiles in place', () => {
            const { look } = setup({});
            expect(look.gridReveal).toBe(DEFAULT_GRID_REVEAL);
            expect(look.gap).toBe(DEFAULT_GAP);
            expect(look.drawBack).toBe(0);
        });

        it('closes the gaps as the reveal falls to 0', () => {
            const { look } = setup({});
            look.gridReveal = DEFAULT_GRID_REVEAL / 2;
            expect(look.gap).toBeCloseTo(DEFAULT_GAP / 2, 9);
            expect(look.drawBack).toBe(0);
            look.gridReveal = 0;
            expect(look.gap).toBe(0);
        });

        it('draws the tiles back as the reveal rises to 1, keeping the gap', () => {
            const { look } = setup({});
            look.gridReveal = (DEFAULT_GRID_REVEAL + 1) / 2;
            expect(look.drawBack).toBeCloseTo(0.5, 9);
            expect(look.gap).toBe(DEFAULT_GAP);
            look.gridReveal = 1;
            expect(look.drawBack).toBe(1);
        });

        it('glides up to the grids alone, and back down to where it starts', async () => {
            const { look } = setup({});
            look.toggleGrids();
            await advanceTime(300, look);
            expect(look.gridReveal).toBeGreaterThan(DEFAULT_GRID_REVEAL);
            expect(look.gridReveal).toBeLessThan(1);
            await advanceTime(3000, look);
            expect(look.gridReveal).toBe(1);
            look.toggleGrids();
            await advanceTime(3000, look);
            expect(look.gridReveal).toBe(DEFAULT_GRID_REVEAL);
        });

        it('glides up from no gaps at all', async () => {
            const { look } = setup({});
            look.gridReveal = 0;
            look.toggleGrids();
            await advanceTime(3000, look);
            expect(look.gridReveal).toBe(1);
        });

        it('turns back part way through a glide', async () => {
            const { look } = setup({});
            look.toggleGrids();
            await advanceTime(300, look);
            look.toggleGrids();
            await advanceTime(3000, look);
            expect(look.gridReveal).toBe(DEFAULT_GRID_REVEAL);
        });

        it('holds where the reveal is set, within its range', async () => {
            const { look } = setup({});
            look.toggleGrids();
            look.gridReveal = 0.4;
            await advanceTime(500, look);
            expect(look.gridReveal).toBe(0.4);
            look.gridReveal = 2;
            expect(look.gridReveal).toBe(1);
        });
    });

    describe('finding a tile', () => {
        it('finds the tile whose middle is nearest', () => {
            const { look, tiles } = setup({});
            const tile = 5;
            const x = (tiles.cornerXs[tile * 4] + tiles.cornerXs[tile * 4 + 2]) / 2;
            const y = (tiles.cornerYs[tile * 4] + tiles.cornerYs[tile * 4 + 2]) / 2;
            expect(look.findDrawnTile(x, y)).toBe(tile);
        });

        it('finds a tile by where it is drawn, once it has drawn back to its crossing', () => {
            const { look, tiles } = setup({});
            const tile = 5;
            look.gridReveal = 1;
            expect(look.findDrawnTile(tiles.crossingXs[tile], tiles.crossingYs[tile])).toBe(tile);
        });

        it('finds nothing where there are no tiles', () => {
            const { look } = setup({ tiles: createMultigridTiles() });
            expect(look.findDrawnTile(0, 0)).toBe(-1);
        });
    });

    it('picks a palette and a colour mode other than the ones it has, for a random look', () => {
        for (const roll of [0, 0.5, 0.999]) {
            const { look } = setup({ random: () => roll });
            const { palette, colorMode } = look;
            look.pickRandomLook();
            expect(PALETTE_NAMES).toContain(look.palette);
            expect(COLOR_MODES).toContain(look.colorMode);
            expect(look.palette).not.toBe(palette);
            expect(look.colorMode).not.toBe(colorMode);
            expect(look.colorOffset).toBe(roll);
        }
    });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface SetupOptions {
    readonly isDrifting?: boolean;
    readonly tiles?: TileSet;
    readonly random?: () => number;
}

/** A look at some tiles, which are the Penrose tiling's unless others are given. */
function setup(options: SetupOptions): { look: LookViewModel; tiles: TileSet } {
    const laid = createMultigridTiles();
    laid.lay(5, 0.1, 0, 0, 10);
    const tiles = options.tiles ?? laid;
    const look = createLookViewModel({
        tiles: () => tiles,
        isDrifting: () => options.isDrifting ?? false,
        random: options.random,
    });
    return { look, tiles };
}
