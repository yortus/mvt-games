import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './tile-size';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MazeViewBindings {
    /** The maze, one string for each row of tiles, with `#` for a wall. It never changes, so it's read once. */
    readonly layout: readonly string[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The maze's tiles, drawn once, TILE_SIZE pixels to a tile. */
export function MazeView({ layout }: MazeViewBindings): Container {
    const view = new Container();
    const tiles = new Graphics();
    for (let row = 0; row < layout.length; row++) {
        for (let col = 0; col < layout[row].length; col++) {
            const isWall = layout[row][col] === '#';
            tiles
                .rect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)
                .fill(isWall ? 0x3b4a6b : 0x182238)
                .stroke({ color: 0x0d1520, width: 1 });
        }
    }
    view.addChild(tiles);
    return view;
}
