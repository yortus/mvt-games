import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { BoardLayout } from './board-layout';
import { scatter } from './scatter';
import { GLINT_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** Where a `GlintsView` scatters its glints, and where they show. */
export interface GlintsViewBindings {
    /** How many cells there are along each side of the valley. It's read once. */
    readonly size: number;
    /** Where the valley and its cells are, in pixels. It's read once. */
    readonly layout: BoardLayout;
    /** Whether the river runs through `cell`. A glint shows only on the river. */
    readonly isRiverCellAt: (cell: number) => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Small four-pointed sparkles that twinkle on the river's water. They're
 * scattered over the valley near the middles of the cells, the same way
 * each time. Each glint flashes for a moment once in its own period, and
 * grows as it brightens. A glint on a cell that the river doesn't run
 * through stays hidden.
 *
 * The glints' time is presentation state, which the update step moves on.
 */
export function GlintsView(bindings: GlintsViewBindings): Container {
    const { size, layout } = bindings;
    const { cellSize, gridX, gridY } = layout;
    const view = new Container();
    view.label = 'glints';
    // Each glint, the cell it sits in, where it starts in its period, and how long its period is
    const count = Math.round(size * size * GLINTS_PER_CELL);
    const glints: Graphics[] = [];
    const glintCells = new Int32Array(count);
    const glintPhases = new Float32Array(count);
    const glintPeriods = new Float32Array(count);
    const arm = cellSize * GLINT_ARM_SHARE;
    for (let i = 0; i < count; i++) {
        const glint = new Graphics()
            .poly([0, -arm, arm * 0.22, -arm * 0.22, arm, 0, arm * 0.22, arm * 0.22, 0, arm, -arm * 0.22, arm * 0.22, -arm, 0, -arm * 0.22, -arm * 0.22])
            .fill(GLINT_COLOR);
        // Each glint sits near the middle of its cell, where the river runs
        const cell = Math.floor(scatter(i, 1) * size * size);
        glintCells[i] = cell;
        glint.position.set(
            gridX + ((cell % size) + 0.5 + (scatter(i, 2) - 0.5) * GLINT_SPREAD) * cellSize,
            gridY + (Math.floor(cell / size) + 0.5 + (scatter(i, 3) - 0.5) * GLINT_SPREAD) * cellSize,
        );
        glint.alpha = 0;
        view.addChild(glint);
        glints.push(glint);
        glintPhases[i] = scatter(i, 4);
        glintPeriods[i] = GLINT_LEAST_MS + scatter(i, 7) * GLINT_SPREAD_MS;
    }
    // The glints' time, from when they were made
    let glintMs = 0;
    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        glintMs += deltaMs;
    }

    function refresh(): void {
        // Each glint on the river flashes for a moment once in its period, larger as it brightens
        for (let i = 0; i < glints.length; i++) {
            const at = (glintMs / glintPeriods[i] + glintPhases[i]) % 1;
            const shineAmount = bindings.isRiverCellAt(glintCells[i]) && at < GLINT_FLASH_SHARE ? Math.sin((at / GLINT_FLASH_SHARE) * Math.PI) : 0;
            glints[i].alpha = shineAmount;
            glints[i].scale.set(GLINT_LEAST_SCALE + (1 - GLINT_LEAST_SCALE) * shineAmount);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many glints there are for each cell. */
const GLINTS_PER_CELL = 0.8;

/** How far a glint's arms reach from its middle, as a share of a cell. */
const GLINT_ARM_SHARE = 0.12;

/** How small a glint is as it starts and ends its flash, as a share of its full size. */
const GLINT_LEAST_SCALE = 0.3;

/** How far from its cell's middle a glint may sit, as a share of a cell. */
const GLINT_SPREAD = 0.3;

/** How much of its period a glint flashes for. */
const GLINT_FLASH_SHARE = 0.3;

/** The shortest period a glint flashes once in, in ms. */
const GLINT_LEAST_MS = 1600;

/** How much longer than the shortest a glint's period may be, in ms. */
const GLINT_SPREAD_MS = 2400;
