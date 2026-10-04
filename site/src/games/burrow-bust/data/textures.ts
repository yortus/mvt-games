import { createTextureRegistry } from '@mvtjs/pixi';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/burrow-bust-textures.json`, {
    digger: {
        idle: 'digger-idle',
        walkA: 'digger-walk-a',
        walkB: 'digger-walk-b',
        pump: 'digger-pump',
        icon: 'digger-icon',
    },
    mole: {
        normal: 'mole',
        step: 'mole-step',
        inflate1: 'mole-inflate1',
        inflate2: 'mole-inflate2',
        inflate3: 'mole-inflate3',
        crushed: 'mole-crushed',
    },
    salamander: {
        normal: 'salamander',
        step: 'salamander-step',
        inflate1: 'salamander-inflate1',
        inflate2: 'salamander-inflate2',
        inflate3: 'salamander-inflate3',
        crushed: 'salamander-crushed',
    },
    ghostEyes: 'ghost-eyes',
    rock: {
        normal: 'rock',
        shattered: 'rock-shattered',
    },
});
