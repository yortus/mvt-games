/** @jsxImportSource @mvtjs/pixi */
import type { Container, Texture } from 'pixi.js';
import type { SymbolKind } from '../../data';
import { CELL_SIZE, SYMBOL_SCALE } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ReelViewBindings {
    /** Fixed: a reel's strip never changes. */
    readonly strip: readonly SymbolKind[];
    /** The strip position to show in the top row, fractional while turning. */
    readonly position: () => number;
    /** True while the reel turns too fast to read: blurred pictures. */
    readonly isBlurred: () => boolean;
    readonly textureFor: (kind: SymbolKind, isBlurred: boolean) => Texture;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One reel, as a column of four sprites: three rows, and one more for the
 * symbol sliding in. As the position falls, the column slides down a cell,
 * then every sprite steps back up and takes the next symbol along, so four
 * sprites show a strip of any length. The parent masks it to the window.
 */
export function ReelView(bindings: ReelViewBindings): Container {
    const { strip } = bindings;
    // Worked out once per frame, in the column's refresh, before its sprites read them
    let topIndex = 0;
    let offset = 0;
    let isBlurred = false;

    return (
        <container onRefresh={place}>
            {SLOTS.map((slot) => (
                <sprite
                    anchor={0.5}
                    x={CELL_SIZE / 2}
                    y={() => (slot - offset) * CELL_SIZE + CELL_SIZE / 2}
                    texture={() => bindings.textureFor(strip[(topIndex + slot) % strip.length], isBlurred)}
                    width={CELL_SIZE * SYMBOL_SCALE}
                    height={CELL_SIZE * SYMBOL_SCALE}
                />
            ))}
        </container>
    );

    function place(): void {
        const position = bindings.position();
        const whole = Math.floor(position);
        topIndex = ((whole % strip.length) + strip.length) % strip.length;
        offset = position - whole;
        isBlurred = bindings.isBlurred();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The rows a column's sprites fill: the window's three, and one sliding in below. */
const SLOTS = [0, 1, 2, 3];
