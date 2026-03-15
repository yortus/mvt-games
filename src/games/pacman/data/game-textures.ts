import { Assets, type Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Texture names
// ---------------------------------------------------------------------------

export const textureNames = [
    'pacman-closed',
    'pacman-mid',
    'pacman-open',
    'ghost-body',
    'ghost-eyes',
] as const;

type TextureName = typeof textureNames[number];

// ---------------------------------------------------------------------------
// Texture lookup
// ---------------------------------------------------------------------------

export function getTexture(name: TextureName): Texture {
    const texture: Texture | undefined = Assets.get<Texture>(name);
    if (!texture) throw new Error(`Texture '${name}' not found in asset cache`);
    return texture;
}
