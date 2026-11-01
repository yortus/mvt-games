import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DiggersViewBindings {
    readonly count: number;
    /** Where each digger is, in tiles. */
    readonly rowAt: (index: number) => number;
    readonly colAt: (index: number) => number;
    /** The width and height of one tile, in pixels. */
    readonly tileSize: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A bright square for each digger, a little bigger than a tile. */
export function DiggersView({ count, rowAt, colAt, tileSize }: DiggersViewBindings): Container {
    const view = new Container();
    const size = tileSize + 3;

    const diggers: Sprite[] = [];
    for (let i = 0; i < count; i++) {
        const digger = new Sprite(Texture.WHITE);
        digger.anchor.set(0.5);
        digger.width = size;
        digger.height = size;
        digger.tint = 0xffe066;
        diggers.push(digger);
        view.addChild(digger);
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        for (let i = 0; i < count; i++) {
            diggers[i].position.set((colAt(i) + 0.5) * tileSize, (rowAt(i) + 0.5) * tileSize);
        }
    }
}
