import { Assets, Spritesheet, type Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Map of asset names to textures, loaded from a packed spritesheet. */
export type SpritesheetTextures = Readonly<Record<string, Texture>>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Load a packed spritesheet and return its textures.
 *
 * Applies `scaleMode: 'nearest'` on the underlying base texture so
 * sprites scale with hard pixel edges (retro / blocky aesthetic).
 */
export async function loadSpritesheetTextures(jsonUrl: string): Promise<SpritesheetTextures> {
    const sheet: Spritesheet = await Assets.load({
        src: jsonUrl,
        data: { scaleMode: 'nearest' },
    });

    return sheet.textures;
}
