import { Container, Graphics } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import type { GamePhase, TileKind } from '../models';
import { setRefresh } from '@mvtjs/pixi';
import { CRUMB_COLOR, HEDGE_COLOR, HEDGE_LEAF_COLOR, PATH_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MazeViewBindings {
    tileSize: () => number;
    rows: () => number;
    cols: () => number;
    tileKindAt: (row: number, col: number) => TileKind;
    isCrumbAt: (row: number, col: number) => boolean;
    gamePhase: () => GamePhase;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function MazeView(bindings: MazeViewBindings): Container {
    let crumbEntries: { r: number; c: number; gfx: Graphics }[] = [];
    const watcher = watch({
        rows: bindings.rows,
        cols: bindings.cols,
        tileSize: bindings.tileSize,
        phase: bindings.gamePhase,
    });
    let wallGfx: Graphics;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        wallGfx = new Graphics();
        view.addChild(wallGfx);
    }

    function refresh(): void {
        // Poll all watches
        const watched = watcher.poll();
        const dimsChanged = watched.rows.changed || watched.cols.changed || watched.tileSize.changed;

        // Full rebuild on dimension change or game reset (phase → playing)
        if (dimsChanged || (watched.phase.changed && watched.phase.value === 'playing')) {
            updateLayout();
            return;
        }

        // Normal path - hide eaten crumbs
        for (let i = crumbEntries.length - 1; i >= 0; i--) {
            const entry = crumbEntries[i];
            if (!bindings.isCrumbAt(entry.r, entry.c)) {
                entry.gfx.visible = false;
                crumbEntries[i] = crumbEntries[crumbEntries.length - 1];
                crumbEntries.pop();
            }
        }
    }

    function updateLayout(): void {
        buildWalls();
        buildCrumbs();
    }

    function buildWalls(): void {
        wallGfx.clear();
        const rows = bindings.rows();
        const cols = bindings.cols();
        const ts = bindings.tileSize();
        wallGfx.rect(0, 0, cols * ts, rows * ts).fill(PATH_COLOR);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (bindings.tileKindAt(r, c) === 'wall') {
                    wallGfx.rect(c * ts, r * ts, ts, ts).fill(HEDGE_COLOR);

                    // Two clumps of leaves per hedge tile, placed by a hash of
                    // the tile so they stay put when the maze is rebuilt
                    const hash = tileHash(r, c);
                    const leaf = ts * 0.2;
                    const x = c * ts + leaf;
                    const y = r * ts + leaf;
                    const span = ts - 2 * leaf;
                    wallGfx.circle(x + (hash % span), y + ((hash >>> 5) % span), leaf).fill(HEDGE_LEAF_COLOR);
                    wallGfx.circle(x + ((hash >>> 10) % span), y + ((hash >>> 15) % span), leaf * 0.7).fill(HEDGE_LEAF_COLOR);
                }
            }
        }
    }

    function buildCrumbs(): void {
        // Remove old crumb graphics
        for (let i = 0; i < crumbEntries.length; i++) {
            crumbEntries[i].gfx.destroy();
        }
        crumbEntries = [];

        const rows = bindings.rows();
        const cols = bindings.cols();
        const ts = bindings.tileSize();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (bindings.isCrumbAt(r, c)) {
                    // A wedge of cheese
                    const cx = c * ts + ts / 2;
                    const cy = r * ts + ts / 2;
                    const size = ts * 0.18;
                    const crumb = new Graphics();
                    crumb.poly([cx - size, cy + size * 0.7, cx + size, cy + size * 0.7, cx + size, cy - size * 0.7])
                        .fill(CRUMB_COLOR);
                    view.addChild(crumb);
                    crumbEntries.push({ r, c, gfx: crumb });
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A small integer hash of a tile's position. */
function tileHash(row: number, col: number): number {
    let h = Math.imul(row, 0x27d4eb2d) ^ Math.imul(col, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    return (h ^ (h >>> 13)) >>> 0;
}
