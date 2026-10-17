import { createTextureRegistry } from '@mvtjs/pixi';

/** The Tune Tracker's one texture: its pixel font, as `scripts/generate-tune-tracker-textures.ts` draws it. */
export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/tune-tracker-textures.json`, {
    font: 'font',
});
