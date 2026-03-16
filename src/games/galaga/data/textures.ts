import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry('assets/galaga-textures.json', {
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
