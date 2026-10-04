/** @jsxImportSource @mvtjs/pixi */

import { type Container, Texture } from 'pixi.js';
import { List } from '@mvtjs/pixi/jsx';
import { pickGrainTint } from './grain-colors';
import type { Grains } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GrainSpritesViewBindings {
    /** Every grain, addressed by id: slot `id` shows the grain with id `id`. */
    grains: () => Grains;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grains as a sprite per grain, projected by a `<List>` over `grains`.
 * Drawn in cells: each sprite is one unit square at its grain's column and
 * row, and whoever places this view scales cells to pixels.
 *
 * Each sprite has three function attributes (`x`, `y`, `tint`), so the refresh
 * pass does work for every grain in the tank every frame, settled or not, while
 * the simulation only does work for the grains that move. All sprites share
 * one white texture and differ only by tint, so Pixi draws them in a handful
 * of batches.
 */
export function GrainSpritesView(bindings: GrainSpritesViewBindings): Container {
    // The grains, as the list read them this frame. The list reads its items
    // once per frame, before any of its slots refresh, so every slot's
    // attributes share that one read rather than each reading
    // `bindings.grains()` again.
    let grains: Grains = NO_GRAINS;

    return (
        <List items={readGrains}>
            {(_item, id) => (
                <sprite
                    texture={Texture.WHITE}
                    width={1}
                    height={1}
                    x={() => grains.colOf(id)}
                    y={() => grains.rowOf(id)}
                    tint={() => pickGrainTint(grains.kindOf(id), id)}
                />
            )}
        </List>
    );

    function readGrains(): Grains {
        grains = bindings.grains();
        return grains;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Until the list's first read, which comes before any slot reads it. */
const NO_GRAINS: Grains = {
    length: 0,
    at: () => undefined,
    colOf: () => 0,
    rowOf: () => 0,
    kindOf: () => 'sand',
};
