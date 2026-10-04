import { createTextureRegistry } from '@mvtjs/pixi';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/galaxy-raiders-textures.json`, {
    enemy: {
        carrier: 'carrier',
        striker: 'striker',
        scout: 'scout',
    },
    ship: {
        sprite: 'ship',
        icon: 'ship-icon',
    },
});
