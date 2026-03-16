import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry('assets/galaga-textures.json', {
    boss: 'boss',
    butterfly: 'butterfly',
    bee: 'bee',
    ship: 'ship',
    shipIcon: 'ship-icon',
});
