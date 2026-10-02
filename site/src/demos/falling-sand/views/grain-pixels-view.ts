import { BufferImageSource, type Container, Sprite, Texture } from 'pixi.js';
import { addReads, setTickMethods } from '@mvtjs/pixi';
import type { Grains } from '../models';
import { pickGrainPixel } from './grain-colors';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GrainPixelsViewBindings {
    /** The tank's size in cells, and so the texture's size in pixels. Read once, when the view is built. */
    cols: number;
    rows: number;
    /** Every grain, addressed by id. */
    grains: () => Grains;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grains as one texture with a pixel per cell: each frame, clear the
 * pixels, write one for every grain, and upload the lot. Drawn in cells, like
 * `GrainSpritesView`: the texture is `cols` x `rows` pixels, and whoever
 * places this view scales cells to pixels.
 *
 * Still an MVT view, and still polling: it reads every grain every frame,
 * settled or not, and changes nothing but its own pixels. What it drops is
 * the object per grain on the view side (a sprite, its bindings, its place
 * in Pixi's scene graph), leaving a loop over the model's grains that writes
 * into a flat array, and one draw call.
 *
 * It counts its reads with `addReads`, as `GrainSpritesView`'s JSX
 * counts them: `grains` once, a presence check per id, and three reads
 * (column, row and kind) per grain. The two views read the same, and their
 * reads per frame say so.
 */
export function GrainPixelsView(bindings: GrainPixelsViewBindings): Container {
    const { cols, rows } = bindings;

    // The texture's pixel data, and a view of it as one 32-bit RGBA pixel per cell.
    const bytes = new Uint8Array(cols * rows * 4);
    const pixels = new Int32Array(bytes.buffer);
    const source = new BufferImageSource({
        resource: bytes,
        width: cols,
        height: rows,
        // Hard-edged cells when scaled up, as the sprites are.
        scaleMode: 'nearest',
        // Every pixel is either opaque or all zeroes, so it is already premultiplied.
        alphaMode: 'premultiplied-alpha',
    });
    const texture = new Texture({ source });

    const sprite = new Sprite(texture);
    setTickMethods(sprite, { refresh });
    // A sprite does not destroy its texture unless told to.
    sprite.on('destroyed', () => texture.destroy(true));
    return sprite;

    function refresh(): void {
        const grains = bindings.grains();
        pixels.fill(0);
        const length = grains.length;
        let drawnCount = 0;
        for (let id = 0; id < length; id++) {
            if (grains.at(id) === undefined) continue;
            pixels[grains.rowOf(id) * cols + grains.colOf(id)] = pickGrainPixel(grains.kindOf(id), id);
            drawnCount++;
        }
        addReads(1 + length + 3 * drawnCount);
        source.update();
    }
}
