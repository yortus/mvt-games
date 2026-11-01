import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FieldViewBindings {
    readonly rows: number;
    readonly cols: number;
    /** The width and height of one tile, in pixels. */
    readonly tileSize: number;
    readonly isWalkableAt: (row: number, col: number) => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A field of tiles, with its top left corner at 0, 0: open ground where the
 * digger can walk, and rock where it can't. Each tile is drawn once, in
 * white, and each refresh tints it.
 */
export function FieldView(bindings: FieldViewBindings): Container {
    const { rows, cols, tileSize, isWalkableAt } = bindings;
    const view = new Container();

    // One tile for each cell, by row * cols + col
    const tiles: Graphics[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const tile = new Graphics();
            tile.roundRect(1, 1, tileSize - 2, tileSize - 2, 4).fill(0xffffff);
            tile.position.set(col * tileSize, row * tileSize);
            tiles.push(tile);
            view.addChild(tile);
        }
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                tiles[row * cols + col].tint = isWalkableAt(row, col) ? GROUND_COLOR : ROCK_COLOR;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const GROUND_COLOR = 0x3a2c22;
const ROCK_COLOR = 0x7a7f88;
