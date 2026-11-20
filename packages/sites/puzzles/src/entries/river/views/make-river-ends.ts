import { Container, Graphics } from 'pixi.js';
import type { RiverPuzzle } from '../models';
import type { BoardLayout } from './board-layout';
import { BANK_COLOR, GLINT_COLOR, RIVER_COLOR, RIVER_PASS_ALPHAS, RIVER_PASS_COLORS, RIVER_PASS_SHARES, SEA_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Makes the river's two ends for `puzzle`, placed by `layout`. The river
 * rises in a pool left of the valley, and runs out to the sea below it. A
 * short reach of river joins each one to the valley's edge.
 */
export function makeRiverEnds(puzzle: RiverPuzzle, layout: BoardLayout): Container {
    const { cellSize, gridX, gridY } = layout;
    const { size } = puzzle.grid;
    const ends = new Container();
    const springY = gridY + (Math.floor(puzzle.spring / size) + 0.5) * cellSize;
    const seaX = gridX + ((puzzle.sea % size) + 0.5) * cellSize;
    const bottom = gridY + size * cellSize;
    const reach = cellSize * END_SHARE;
    const stubs = new Graphics();
    for (let pass = 0; pass < 3; pass++) {
        stubs.moveTo(gridX - reach, springY).lineTo(gridX, springY);
        stubs.moveTo(seaX, bottom).lineTo(seaX, bottom + reach);
        stubs.stroke({ color: RIVER_PASS_COLORS[pass], width: cellSize * RIVER_PASS_SHARES[pass], alpha: RIVER_PASS_ALPHAS[pass], cap: 'butt' });
    }
    // The pool is water in a ring of sand, with a couple of bubbles rising
    const poolX = gridX - reach - cellSize * POOL_SHARE * 0.6;
    const pool = new Graphics()
        .circle(poolX, springY, cellSize * POOL_SHARE).fill(BANK_COLOR)
        .circle(poolX, springY, cellSize * POOL_SHARE * 0.72).fill(RIVER_COLOR)
        .circle(poolX - cellSize * 0.06, springY - cellSize * 0.05, cellSize * 0.045).fill({ color: GLINT_COLOR, alpha: 0.85 })
        .circle(poolX + cellSize * 0.06, springY + cellSize * 0.04, cellSize * 0.03).fill({ color: GLINT_COLOR, alpha: 0.7 });
    // The sea is a bay of blue in a curve of sand, with a white wave
    const seaY = bottom + reach + cellSize * SEA_SHARE * 0.3;
    const width = cellSize * SEA_SHARE;
    const wave = width * 0.3;
    const sea = new Graphics()
        .ellipse(seaX, seaY, width * 0.62, width * 0.36).fill(BANK_COLOR)
        .ellipse(seaX, seaY + width * 0.04, width * 0.52, width * 0.28).fill(SEA_COLOR)
        .moveTo(seaX - wave, seaY + width * 0.06).quadraticCurveTo(seaX - wave / 2, seaY - width * 0.06, seaX, seaY + width * 0.06)
        .quadraticCurveTo(seaX + wave / 2, seaY + width * 0.18, seaX + wave, seaY + width * 0.06)
        .stroke({ color: GLINT_COLOR, width: Math.max(1.5, cellSize * 0.05), cap: 'round' });
    ends.addChild(stubs, pool, sea);
    return ends;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far each end's reach of river runs out from the valley, as a share of a cell. */
const END_SHARE = 0.2;

/** The pool's radius, as a share of a cell. */
const POOL_SHARE = 0.3;

/** How wide the sea is, as a share of a cell. */
const SEA_SHARE = 1.1;
