import { BufferImageSource, type Container, Sprite, Texture } from 'pixi.js';
import { createMemo, createRenderEffect, createRoot, indexArray, onCleanup } from 'solid-js';
import type { Grains } from '../models';
import { pickGrainPixel } from './grain-colors';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SolidGrainPixelsViewBindings {
    /** The tank's size in cells, and so the texture's size in pixels. Read once, when the view is built. */
    cols: number;
    rows: number;
    /** Every grain, addressed by id. Its reads must be tracked (a `'store'` model), or nothing ever updates. */
    grains: () => Grains;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grains as one texture with a pixel per cell, like `GrainPixelsView`,
 * but driven by SolidJS: an effect per grain id, which Solid re-runs only
 * when that grain changes, erases the grain's old pixel and writes its new
 * one. So a frame's work follows the grains that changed, not all of them.
 * The texture is uploaded in the refresh pass, and only on frames when some
 * pixel changed.
 *
 * pixi-solid has nothing to add here, since the view is one sprite with one
 * texture, so this uses Solid's own primitives.
 */
export function SolidGrainPixelsView(bindings: SolidGrainPixelsViewBindings): Container {
    const { cols, rows } = bindings;

    const bytes = new Uint8Array(cols * rows * 4);
    const pixels = new Int32Array(bytes.buffer);
    const source = new BufferImageSource({
        resource: bytes,
        width: cols,
        height: rows,
        scaleMode: 'nearest',
        alphaMode: 'premultiplied-alpha',
    });
    const texture = new Texture({ source });

    // Presentation state: which grain each cell's pixel shows (-1 for none),
    // and which cell each grain's pixel is in (-1 for none), so a grain can
    // erase its old pixel without erasing another grain's that has since
    // been drawn there.
    const drawnIdAt = new Int32Array(cols * rows).fill(-1);
    const drawnCellOf = new Int32Array(cols * rows).fill(-1);
    let isChanged = true;

    const sprite = new Sprite(texture);
    setRefresh(sprite, uploadIfChanged);

    createRoot((dispose) => {
        sprite.on('destroyed', () => {
            dispose();
            texture.destroy(true);
        });

        const ids = createMemo(() => idsBelow(bindings.grains().length));
        // An effect per id, made when the id first comes into range, and
        // disposed (erasing its pixel) when the range shrinks past it.
        const perGrain = indexArray(ids, (_item, id) => {
            createRenderEffect(() => draw(id));
            onCleanup(() => erase(id));
            return id;
        });
        createRenderEffect(perGrain);
    });

    return sprite;

    function draw(id: number): void {
        const grains = bindings.grains();
        erase(id);
        if (grains.at(id) === undefined) return;
        const cell = grains.rowOf(id) * cols + grains.colOf(id);
        pixels[cell] = pickGrainPixel(grains.kindOf(id), id);
        drawnIdAt[cell] = id;
        drawnCellOf[id] = cell;
        isChanged = true;
    }

    function erase(id: number): void {
        const cell = drawnCellOf[id];
        if (cell < 0) return;
        drawnCellOf[id] = -1;
        if (drawnIdAt[cell] !== id) return;
        drawnIdAt[cell] = -1;
        pixels[cell] = 0;
        isChanged = true;
    }

    function uploadIfChanged(): void {
        if (!isChanged) return;
        isChanged = false;
        source.update();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function idsBelow(length: number): number[] {
    const ids: number[] = [];
    for (let id = 0; id < length; id++) ids.push(id);
    return ids;
}
