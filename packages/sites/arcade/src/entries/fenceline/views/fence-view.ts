import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import type { Direction } from '../models';
import { COLOURS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FenceViewBindings {
    /** The meadow's size in cells, and a cell's size in pixels. The view is built round them, so they are read once. */
    rows: number;
    cols: number;
    cellSize: number;
    /** Whether a fence runs from grid point (row, col) one step `direction`. */
    hasFence: (row: number, col: number, direction: Direction) => boolean;
    /** Whether that fence can still be walked, with open meadow beside it. */
    isWalkable: (row: number, col: number, direction: Direction) => boolean;
    /** Wires tied off so far. The fences change only as it changes. */
    closureCount: () => number;
    /** The round. Each round is a new meadow. */
    round: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The fences, drawn as wooden rails along the grid lines, with a post at
 * every other grid point and at each corner. Fences round the open meadow
 * are dark and solid. Those left behind inside the pasture, with pasture on
 * both sides, are faded. They are redrawn only as a wire is tied off, or a
 * round starts.
 */
export function FenceView(bindings: FenceViewBindings): Container {
    const { rows, cols, cellSize } = bindings;
    const oldFences = new Graphics();
    const fences = new Graphics();
    oldFences.alpha = 0.5;
    const view = new Container();
    view.addChild(oldFences, fences);
    const watcher = watch({ closures: bindings.closureCount, round: bindings.round });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.closures.changed || watched.round.changed) draw();
    }

    function draw(): void {
        oldFences.clear();
        fences.clear();
        // The rails
        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) {
                const x = c * cellSize;
                const y = r * cellSize;
                if (bindings.hasFence(r, c, 'right')) {
                    const g = bindings.isWalkable(r, c, 'right') ? fences : oldFences;
                    g.rect(x, y - 1, cellSize, 2).fill(COLOURS.rail);
                }
                if (bindings.hasFence(r, c, 'down')) {
                    const g = bindings.isWalkable(r, c, 'down') ? fences : oldFences;
                    g.rect(x - 1, y, 2, cellSize).fill(COLOURS.rail);
                }
            }
        }
        // The posts, over the rails
        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) drawPost(r, c);
        }
    }

    /** A post at grid point (row, col), if a fence passes it there and it is a corner, an end, or every other point. */
    function drawPost(row: number, col: number): void {
        const across = (bindings.hasFence(row, col, 'left') ? 1 : 0) + (bindings.hasFence(row, col, 'right') ? 1 : 0);
        const down = (bindings.hasFence(row, col, 'up') ? 1 : 0) + (bindings.hasFence(row, col, 'down') ? 1 : 0);
        if (across + down === 0) return;
        const isStraight = (across === 2 && down === 0) || (across === 0 && down === 2);
        if (isStraight && (row + col) % 2 !== 0) return;
        const isLive = bindings.isWalkable(row, col, 'left') || bindings.isWalkable(row, col, 'right')
            || bindings.isWalkable(row, col, 'up') || bindings.isWalkable(row, col, 'down');
        const g = isLive ? fences : oldFences;
        const x = col * cellSize;
        const y = row * cellSize;
        g.rect(x - 2, y - 2, 4, 4).fill(COLOURS.post);
        g.rect(x - 1, y - 2, 2, 1).fill(COLOURS.postTop);
    }
}
