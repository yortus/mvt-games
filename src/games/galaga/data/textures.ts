import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/galaga-textures.json`, {
    enemy: {
        boss: 'boss',
        butterfly: 'butterfly',
        bee: 'bee',
    },
    ship: {
        sprite: 'ship',
        icon: 'ship-icon',
    },
});
