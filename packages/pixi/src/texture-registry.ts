import { Assets, type Spritesheet, type Texture } from 'pixi.js';
import { assert } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface TextureRegistry<T extends TextureNameMap> {
    /** Load the spritesheet and populate the texture record. */
    load: () => Promise<void>;
    /** Return the loaded texture record. Throws if load() has not completed. */
    get: () => TextureRecord<T>;
}

/** A (possibly nested) map of logical names to spritesheet frame IDs. */
export type TextureNameMap = { [key: string]: string | TextureNameMap };

/** Recursively maps a TextureNameMap shape, replacing leaf strings with Texture. */
export type TextureRecord<T extends TextureNameMap> = {
    [K in keyof T]: T[K] extends string ? Texture : T[K] extends TextureNameMap ? TextureRecord<T[K]> : never;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTextureRegistry<T extends TextureNameMap>(
    spritesheetUrl: string,
    nameMap: T,
): TextureRegistry<T> {
    let record: TextureRecord<T> | undefined;
    // Built once: `get()` is called often, and checks on every call.
    const notLoadedMessage = `Textures not loaded - call load() before get() (spritesheet: '${spritesheetUrl}')`;

    return {
        async load(): Promise<void> {
            if (record) return; // Already loaded
            await Assets.load<Spritesheet>({ src: spritesheetUrl, data: { scaleMode: 'nearest' } });
            record = buildRecord(nameMap, spritesheetUrl) as TextureRecord<T>;
        },

        get(): TextureRecord<T> {
            assert(record !== undefined, notLoadedMessage);
            return record;
        },
    };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildRecord(map: TextureNameMap, spritesheetUrl: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key in map) {
        const value = map[key];
        if (typeof value === 'string') {
            const texture = Assets.get<Texture>(value);
            assert(texture, () => `Texture '${value}' not found after loading '${spritesheetUrl}'`);
            result[key] = texture;
        }
        else {
            result[key] = buildRecord(value, spritesheetUrl);
        }
    }
    return result;
}
