import { Container, Graphics } from 'pixi.js';
import { watch } from '#common';
import type { GamePhase, TileKind } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MazeViewBindings {
    getTileSize(): number;
    getRows(): number;
    getCols(): number;
    getTileKind(row: number, col: number): TileKind;
    isDotAt(row: number, col: number): boolean;
    getGamePhase(): GamePhase;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMazeView(bindings: MazeViewBindings): Container {
    let dotEntries: { r: number; c: number; gfx: Graphics }[] = [];

    // ---- Change detection ---------------------------------------------------
    const watcher = watch({
        rows: bindings.getRows,
        cols: bindings.getCols,
        tileSize: bindings.getTileSize,
        phase: bindings.getGamePhase,
    });

    // ---- Scene elements -------------------------------------------------------
    const view = new Container();
    const wallGfx = new Graphics();
    view.addChild(wallGfx);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        // Poll all watches
        const watched = watcher.poll();
        const dimsChanged = watched.rows.changed || watched.cols.changed || watched.tileSize.changed;

        // Full rebuild on dimension change or game reset (phase → playing)
        if (dimsChanged || (watched.phase.changed && watched.phase.value === 'playing')) {
            updateLayout();
            return;
        }

        // Normal path - hide eaten dots
        for (let i = dotEntries.length - 1; i >= 0; i--) {
            const entry = dotEntries[i];
            if (!bindings.isDotAt(entry.r, entry.c)) {
                entry.gfx.visible = false;
                dotEntries[i] = dotEntries[dotEntries.length - 1];
                dotEntries.pop();
            }
        }
    }

    function updateLayout(): void {
        buildWalls();
        buildDots();
    }

    function buildWalls(): void {
        wallGfx.clear();
        const rows = bindings.getRows();
        const cols = bindings.getCols();
        const ts = bindings.getTileSize();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (bindings.getTileKind(r, c) === 'wall') {
                    wallGfx.rect(c * ts, r * ts, ts, ts).fill(0x1a1aff);
                }
            }
        }
    }

    function buildDots(): void {
        // Remove old dot graphics
        for (let i = 0; i < dotEntries.length; i++) {
            dotEntries[i].gfx.destroy();
        }
        dotEntries = [];

        const rows = bindings.getRows();
        const cols = bindings.getCols();
        const ts = bindings.getTileSize();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (bindings.isDotAt(r, c)) {
                    const dot = new Graphics();
                    dot.circle(c * ts + ts / 2, r * ts + ts / 2, ts * 0.15).fill(0xffff00);
                    view.addChild(dot);
                    dotEntries.push({ r, c, gfx: dot });
                }
            }
        }
    }
}
