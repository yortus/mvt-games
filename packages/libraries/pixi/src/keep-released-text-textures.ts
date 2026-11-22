import type { Renderer, Text, Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The textures `keepReleasedTextTextures` keeps for one renderer. */
export interface KeptTextTextures {
    /**
     * Releases every kept texture now, such as when the views that used them
     * have gone for good. Textures released after this are kept again.
     */
    readonly releaseAll: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface KeepReleasedTextTexturesOptions {
    /** The renderer whose text textures are kept. */
    readonly renderer: Renderer;
    /**
     * The most pixels the kept textures may hold, all together. Each pixel
     * costs four bytes of GPU memory, so 1,048,576 pixels is 4 MB. When a new
     * release would go over, the textures released longest ago go first.
     */
    readonly maxPixels: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Keeps the textures of `renderer`'s texts that have gone, for a while, so
 * that a text drawn again with the same string and style finds its texture
 * still there. Call it once, after the renderer starts.
 *
 * Pixi draws a text's string into a texture, and shares that texture between
 * texts with the same string, style and resolution. When the last of them is
 * destroyed, or changes its string, Pixi releases the texture straight away.
 * So a view that is destroyed and built again draws and uploads every one of
 * its texts again. For 60 texts, that measured about 15 ms. With this, the
 * view reuses them.
 *
 * Only texts that share a Pixi style can find their textures again, since
 * Pixi finds a texture by the style's identity. Texts in JSX share one Pixi
 * style for each style object. A text made in code shares one only if you
 * pass it the same `TextStyle` instance.
 *
 * A kept texture is released when newer releases push it over the budget,
 * when you call `releaseAll`, or when the renderer is destroyed, as Pixi
 * releases every text texture then. Releasing returns it to Pixi's pool of
 * textures, as Pixi does without this.
 *
 * This relies on how Pixi's text system keeps its textures, which is not part
 * of Pixi's public API, so its test checks that Pixi still works that way.
 */
export function keepReleasedTextTextures(options: KeepReleasedTextTexturesOptions): KeptTextTextures {
    const { renderer, maxPixels } = options;
    const system = renderer.canvasText as unknown as TextSystem;

    // Pixi's own methods, which the wrappers below call
    const release = system.decreaseReferenceCount.bind(system);
    const findTexture = system.getManagedTexture.bind(system);
    const returnToPool = system.returnTexture.bind(system);

    // The kept textures, by key, released longest ago first. Each has a count
    // of 0 in the system, so Pixi's own lookup still finds it, and counts the
    // next user.
    const kept = new Map<string, KeptTexture>();
    const keyByTexture = new Map<Texture, string>();
    let keptPixels = 0;

    system.decreaseReferenceCount = (textKey) => {
        const active = system._activeTextures[textKey];
        if (active === undefined || active === null || active.usageCount !== 1) {
            release(textKey);
            return;
        }
        active.usageCount = 0;
        keep(textKey, active.texture);
        releaseDownTo(maxPixels);
    };

    system.getManagedTexture = (text) => {
        const texture = findTexture(text);
        // Read after Pixi's lookup, which sets the resolution the key includes.
        // A kept texture in use again stops counting against the budget.
        forget(text.styleKey);
        return texture;
    };

    // Pixi also returns a text's texture to the pool directly, such as when a
    // text goes while its key's count is 0. A kept texture returned that way
    // must leave the system's textures too. Otherwise a later text could find
    // a texture that the pool has already passed to another. Pixi tests these
    // entries for truthiness, so a deleted entry reads as a released one.
    system.returnTexture = (texture) => {
        const key = keyByTexture.get(texture);
        if (key !== undefined) {
            forget(key);
            if (system._activeTextures[key]?.usageCount === 0) delete system._activeTextures[key];
        }
        returnToPool(texture);
    };

    return { releaseAll: () => releaseDownTo(0) };

    function keep(key: string, texture: Texture): void {
        const pixels = texture.source.pixelWidth * texture.source.pixelHeight;
        kept.set(key, { texture, pixels });
        keyByTexture.set(texture, key);
        keptPixels += pixels;
    }

    function forget(key: string): void {
        const entry = kept.get(key);
        if (entry === undefined) return;
        kept.delete(key);
        keyByTexture.delete(entry.texture);
        keptPixels -= entry.pixels;
    }

    /** Releases the textures kept longest ago until the rest hold `pixels` or fewer. */
    function releaseDownTo(pixels: number): void {
        while (kept.size > 0 && keptPixels > pixels) {
            const oldestKey = kept.keys().next().value!;
            forget(oldestKey);
            const oldest = system._activeTextures[oldestKey];
            if (oldest === undefined || oldest === null || oldest.usageCount !== 0) continue;
            // Set to 1, so Pixi's own release counts it down to 0 and returns it to the pool
            oldest.usageCount = 1;
            release(oldestKey);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The parts of Pixi's text system this relies on, some of which its types keep private. */
interface TextSystem {
    // eslint-disable-next-line @mvtjs/no-null -- Pixi sets a released texture's entry to null
    _activeTextures: Record<string, { texture: Texture; usageCount: number } | null | undefined>;
    decreaseReferenceCount: (textKey: string) => void;
    getManagedTexture: (text: Text) => Texture;
    returnTexture: (texture: Texture) => void;
}

interface KeptTexture {
    readonly texture: Texture;
    readonly pixels: number;
}
