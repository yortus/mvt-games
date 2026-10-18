import { createTextureRegistry } from '@mvtjs/pixi';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/fuel-run-textures.json`, {
    ship: {
        sprite: 'jet',
        icon: 'jet-icon',
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
