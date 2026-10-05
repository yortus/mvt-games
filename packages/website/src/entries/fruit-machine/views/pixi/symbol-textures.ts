import { Texture } from 'pixi.js';
import { PICTURE_KINDS, type SymbolKind } from '../../data';
import type { SymbolArt } from '../art';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The symbols' pictures as Pixi textures, sharp and blurred. */
export interface SymbolTextures {
    textureFor: (kind: SymbolKind, isBlurred: boolean) => Texture;
    /** Destroys the textures; the art's canvases are left alone. */
    release: () => void;
}

export interface SymbolTexturesOptions {
    readonly art: SymbolArt;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Wraps the shared art's canvases as textures, for the view that made them to release. */
export function createSymbolTextures(options: SymbolTexturesOptions): SymbolTextures {
    const { art } = options;
    const kinds: readonly SymbolKind[] = [...PICTURE_KINDS, 'wild'];
    const sharp = {} as Record<SymbolKind, Texture>;
    const blurred = {} as Record<SymbolKind, Texture>;
    for (const kind of kinds) {
        sharp[kind] = Texture.from(art.canvasFor(kind));
        blurred[kind] = Texture.from(art.blurredCanvasFor(kind));
    }

    return {
        textureFor: (kind, isBlurred) => (isBlurred ? blurred[kind] : sharp[kind]),
        release() {
            for (const kind of kinds) {
                sharp[kind].destroy(true);
                blurred[kind].destroy(true);
            }
        },
    };
}
