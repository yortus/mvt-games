import { Assets, Texture } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTextureRegistry } from './texture-registry';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createTextureRegistry', () => {
    it('loads the sheet with its image sampled nearest-neighbour, whatever the default', async () => {
        // Typed loosely: `Assets` is generic over what it loads
        const load = vi.spyOn(Assets, 'load').mockResolvedValue(undefined as never);
        vi.spyOn(Assets, 'get').mockReturnValue(Texture.WHITE as never);
        const textures = createTextureRegistry('sheet.json', { hero: 'hero.png' });

        await textures.load();

        expect(load).toHaveBeenCalledWith({ src: 'sheet.json', data: { textureOptions: { scaleMode: 'nearest' } } });
        expect(textures.get().hero).toBe(Texture.WHITE);
    });
});
