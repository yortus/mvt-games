import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { FieldModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TileGridViewBindings {
    readonly model: FieldModel;
    /** The width and height of one tile, in pixels. */
    readonly tileSize: number;
    /** Whether to use the refresh from the chapter's opening, which makes garbage every tick. */
    readonly allocateEveryTick: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A sprite of dirt for each tile, made once, which a refresh hides once its
 * tile is dug. It has two refresh steps that do the same work: the one from
 * the chapter's opening, and one that follows the hot path rules.
 */
export function TileGridView({ model, tileSize, allocateEveryTick }: TileGridViewBindings): Container {
    const view = new Container();
    const { tiles } = model;

    // The chapter's refresh finds a tile's sprite by a key made from its row
    // and column. The other finds it by number: tile i's sprite is sprites[i].
    const spritesByKey = new Map<string, Sprite>();
    const sprites: Sprite[] = [];
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const sprite = new Sprite(Texture.WHITE);
        sprite.position.set(tile.col * tileSize, tile.row * tileSize);
        sprite.width = tileSize;
        sprite.height = tileSize;
        sprite.tint = DIRT_COLORS[(tile.row * 7 + tile.col * 3 + ((tile.row * tile.col) % 5)) % DIRT_COLORS.length];
        spritesByKey.set(`${tile.row},${tile.col}`, sprite);
        sprites.push(sprite);
        view.addChild(sprite);
    }

    setRefresh(view, allocateEveryTick ? refresh : refreshByIndex);
    return view;

    // The refresh from the chapter's opening. Every tick, it makes a new
    // array, a new closure, and a new string for every dug tile.
    function refresh(): void {
        const dug = tiles.filter((tile) => tile.isDug);
        for (const tile of dug) {
            const sprite = spritesByKey.get(`${tile.row},${tile.col}`);
            if (sprite) sprite.alpha = 0;
        }
    }

    // The same work, by the hot path rules: an index loop, over the tiles
    // and sprites made once, and nothing new made
    function refreshByIndex(): void {
        for (let i = 0; i < tiles.length; i++) {
            if (tiles[i].isDug) sprites[i].alpha = 0;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DIRT_COLORS: readonly number[] = [0x7a5230, 0x6e4a2b, 0x845a35, 0x734d2d, 0x7f5532];
