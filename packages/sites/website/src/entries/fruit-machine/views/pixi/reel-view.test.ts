import { type Sprite, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { PICTURE_KINDS, type SymbolKind } from '../../data';
import { CELL_SIZE } from './pixi-layout';
import { ReelView } from './reel-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STRIP: readonly SymbolKind[] = PICTURE_KINDS;

/** A distinct texture per symbol, sharp and blurred, so the test can tell which a sprite shows. */
const SHARP = new Map<SymbolKind, Texture>();
const BLURRED = new Map<SymbolKind, Texture>();
for (const kind of [...PICTURE_KINDS, 'wild'] as const) {
    SHARP.set(kind, new Texture());
    BLURRED.set(kind, new Texture());
}

function setup(initialPosition: number, isBlurred = false) {
    let position = initialPosition;
    const view = ReelView({
        strip: STRIP,
        position: () => position,
        isBlurred: () => isBlurred,
        textureFor: (kind, blurred) => (blurred ? BLURRED : SHARP).get(kind)!,
    });
    refreshView(view);
    const sprites = view.children as Sprite[];
    const shownAt = (slot: number): SymbolKind | undefined => {
        for (const [kind, texture] of [...SHARP, ...BLURRED]) if (sprites[slot].texture === texture) return kind;
        return undefined;
    };
    return {
        sprites,
        shownAt,
        moveTo: (next: number) => {
            position = next;
            refreshView(view);
        },
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReelView', () => {
    it('shows the strip from its position down, a cell apart', () => {
        const t = setup(2);

        expect([t.shownAt(0), t.shownAt(1), t.shownAt(2)]).toEqual(['pic3', 'pic4', 'pic5']);
        expect(t.sprites[0].y).toBe(CELL_SIZE / 2);
        expect(t.sprites[1].y).toBe(CELL_SIZE * 1.5);
    });

    it('slides down as the position falls, bringing in the symbol above', () => {
        const t = setup(2);

        t.moveTo(1.75);

        expect(t.shownAt(0)).toBe('pic2');
        expect(t.sprites[0].y).toBeCloseTo(-0.75 * CELL_SIZE + CELL_SIZE / 2);
        expect(t.shownAt(1)).toBe('pic3');
        expect(t.sprites[1].y).toBeCloseTo(0.25 * CELL_SIZE + CELL_SIZE / 2);
    });

    it('wraps round the end of the strip', () => {
        const t = setup(5);

        expect([t.shownAt(0), t.shownAt(1), t.shownAt(2)]).toEqual(['pic6', 'pic1', 'pic2']);
    });

    it('shows blurred pictures while turning fast', () => {
        const t = setup(0, true);

        expect(t.sprites[0].texture).toBe(BLURRED.get('pic1'));
    });
});
