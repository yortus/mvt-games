import { createTextureRegistry } from '@mvtjs/pixi';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/kwazy-cactii-textures.json`, {
    cactus: {
        astrophytum: 'astrophytum',
        cereus: 'cereus',
        ferocactus: 'ferocactus',
        gymnocalycium: 'gymnocalycium',
        opuntia: 'opuntia',
        rebutia: 'rebutia',
    },
});
