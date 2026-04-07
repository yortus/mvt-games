import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/cactii-textures.json`, {
    cactus: {
        astrophytum: 'astrophytum',
        cereus: 'cereus',
        euphorbia: 'euphorbia',
        ferocactus: 'ferocactus',
        opuntia: 'opuntia',
        rebutia: 'rebutia',
    },
});
