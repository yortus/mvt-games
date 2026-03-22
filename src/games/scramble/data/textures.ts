import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/scramble-textures.json`, {
    ship: {
        sprite: 'ship',
        icon: 'ship-icon',
    },
    bullet: 'bullet',
    bomb: 'bomb',
    rocket: {
        idle: 'rocket-idle',
        launching: 'rocket-launching',
    },
    ufo: 'ufo',
    fuelTank: 'fuel-tank',
    base: 'base',
});
