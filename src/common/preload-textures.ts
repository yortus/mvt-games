import { Assets, Spritesheet, type Texture } from 'pixi.js';

export async function preloadTextures(spritesheetUrl: string, textureNames: readonly string[] = []): Promise<void> {
    await Assets.load<Spritesheet>({
        src: spritesheetUrl,
        data: { scaleMode: 'nearest' },
    });
    for (let i = 0; i < textureNames.length; i++) {
        if (!Assets.get<Texture>(textureNames[i])) {
            throw new Error(`Expected texture '${textureNames[i]}' not found after loading spritesheet`);
        }
    }
}
