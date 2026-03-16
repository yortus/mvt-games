import { Assets, type Spritesheet, type Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface TextureRegistry<TName extends string> {
    /** Load the spritesheet and populate the texture record. */
    load(): Promise<void>;
    /** Return the loaded texture record. Throws if load() has not completed. */
    get(): Record<TName, Texture>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTextureRegistry<T extends Record<string, string>>(
    spritesheetUrl: string,
    nameMap: T,
): TextureRegistry<keyof T & string> {
    type Name = keyof T;
    let record: Record<Name, Texture> | undefined;

    return {
        async load(): Promise<void> {
            if (record) return; // Already loaded
            await Assets.load<Spritesheet>({ src: spritesheetUrl, data: { scaleMode: 'nearest' } });
            record = {} as Record<Name, Texture>    ;
            for (const name in nameMap) {
                const assetId = nameMap[name];
                const texture = record[name] = Assets.get<Texture>(assetId);
                if (!texture) throw new Error(`Texture '${assetId}' not found after loading '${spritesheetUrl}'`);
            }
        },

        get(): Record<Name, Texture> {
            if (record) return record;
            throw new Error(`Textures not loaded - call load() before get() (spritesheet: '${spritesheetUrl}')`);
        },
    };
}
