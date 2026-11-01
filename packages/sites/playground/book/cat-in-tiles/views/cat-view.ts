import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Direction } from '../models';
import { TILE_SIZE } from './tile-size';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CatViewBindings {
    /** The row, in tiles, with a fraction while moving between tiles. */
    readonly row: () => number;
    /** The column, in tiles, with a fraction while moving between tiles. */
    readonly col: () => number;
    readonly direction: () => Direction;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The cat, which looks the way it's walking. The model gives its place in
 * tiles, and this view turns tiles into pixels.
 */
export function CatView(bindings: CatViewBindings): Container {
    const view = new Container();
    const size = TILE_SIZE * 0.36;

    const head = new Graphics()
        .poly([-size, -size * 0.3, -size * 0.85, -size * 1.25, -size * 0.25, -size * 0.8]).fill(0xf0a040)
        .poly([size, -size * 0.3, size * 0.85, -size * 1.25, size * 0.25, -size * 0.8]).fill(0xf0a040)
        .circle(0, 0, size).fill(0xf0a040);

    // Drawn looking straight ahead, and moved the way the cat is walking
    const eyes = new Graphics()
        .circle(-size * 0.38, -size * 0.1, size * 0.17).fill(0x1a1a1a)
        .circle(size * 0.38, -size * 0.1, size * 0.17).fill(0x1a1a1a);

    const cat = new Container();
    cat.addChild(head, eyes);
    view.addChild(cat);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        cat.position.set(
            (bindings.col() + 0.5) * TILE_SIZE,
            (bindings.row() + 0.5) * TILE_SIZE,
        );
        const direction = bindings.direction();
        const look = size * 0.25;
        eyes.position.set(
            direction === 'left' ? -look : direction === 'right' ? look : 0,
            direction === 'up' ? -look : direction === 'down' ? look : 0,
        );
    }
}
