import { Assets, type Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Texture names
// ---------------------------------------------------------------------------

export const textureNames = [
    'digger-idle',
    'digger-walk-a',
    'digger-walk-b',
    'digger-pump',
    'digger-icon',
    'pooka',
    'pooka-inflate1',
    'pooka-inflate2',
    'pooka-inflate3',
    'pooka-crushed',
    'fygar',
    'fygar-inflate1',
    'fygar-inflate2',
    'fygar-inflate3',
    'fygar-crushed',
    'ghost-eyes',
    'rock',
    'rock-shattered',
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
