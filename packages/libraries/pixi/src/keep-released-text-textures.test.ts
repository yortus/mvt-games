import { CanvasTextSystem, type Renderer, type Text, type Texture } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { keepReleasedTextTextures } from './keep-released-text-textures';

// These run Pixi's own text system methods on a stand-in system with fake
// textures, so they also check that Pixi still keeps its text textures the way
// `keepReleasedTextTextures` relies on.

describe('keepReleasedTextTextures', () => {
    it('keeps a released texture, so a text with the same key finds it again', () => {
        const menu = fakeTexture(64, 32);
        const { system, returnedTextures } = createRenderer({ menu }, 64 * 32);

        system.decreaseReferenceCount('menu');

        expect(returnedTextures).toEqual([]);
        expect(system.getManagedTexture(textWithKey('menu'))).toBe(menu);
        expect(system.getReferenceCount('menu')).toBe(1);
    });

    it('releases the textures released longest ago once the kept ones would go over the budget', () => {
        const first = fakeTexture(64, 32);
        const { system, returnedTextures } = createRenderer({ first, second: fakeTexture(64, 32), third: fakeTexture(64, 32) }, 2 * 64 * 32);

        system.decreaseReferenceCount('first');
        system.decreaseReferenceCount('second');
        system.decreaseReferenceCount('third');

        expect(returnedTextures).toEqual([first]);
        expect(system.getReferenceCount('first')).toBe(0);
    });

    it('stops offering a kept texture that Pixi returns to the pool itself', () => {
        const menu = fakeTexture(64, 32);
        const { system, returnedTextures } = createRenderer({ menu }, 64 * 32);

        system.decreaseReferenceCount('menu');
        system.returnTexture(menu);

        expect(returnedTextures).toEqual([menu]);
        expect(system.getActiveTexture('menu')).toBeUndefined();
    });

    it('releases every kept texture on releaseAll, and when the renderer is destroyed', () => {
        const menu = fakeTexture(64, 32);
        const title = fakeTexture(64, 32);
        const { system, kept, returnedTextures } = createRenderer({ menu, title }, 2 * 64 * 32);

        system.decreaseReferenceCount('menu');
        kept.releaseAll();
        expect(returnedTextures).toEqual([menu]);

        system.decreaseReferenceCount('title');
        system.destroy();
        expect(returnedTextures).toEqual([menu, title]);
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface StandInTextSystem {
    readonly decreaseReferenceCount: (textKey: string) => void;
    readonly getReferenceCount: (textKey: string) => number;
    readonly getManagedTexture: (text: Text) => Texture;
    readonly returnTexture: (texture: Texture) => void;
    readonly destroy: () => void;
    readonly getActiveTexture: (textKey: string) => unknown;
}

/**
 * A renderer whose text system has Pixi's methods, holding `textures` with one
 * user each, and keeping released ones within `maxPixels`. Pixi's own
 * `returnTexture` is stubbed, to record what goes back to the pool.
 */
function createRenderer(textures: Record<string, Texture>, maxPixels: number) {
    const activeTextures: Record<string, { texture: Texture; usageCount: number } | undefined> = {};
    for (const key in textures) activeTextures[key] = { texture: textures[key], usageCount: 1 };
    const returnedTextures: Texture[] = [];
    const system = Object.assign(Object.create(CanvasTextSystem.prototype) as StandInTextSystem, {
        _renderer: { resolution: 1 },
        _activeTextures: activeTextures,
        returnTexture: vi.fn((texture: Texture) => returnedTextures.push(texture)),
        getActiveTexture: (textKey: string) => activeTextures[textKey],
    });
    const kept = keepReleasedTextTextures({ renderer: { canvasText: system } as unknown as Renderer, maxPixels });
    return { system, kept, returnedTextures };
}

function fakeTexture(pixelWidth: number, pixelHeight: number): Texture {
    return { source: { pixelWidth, pixelHeight } } as unknown as Texture;
}

function textWithKey(styleKey: string): Text {
    return { styleKey, _autoResolution: true } as unknown as Text;
}
