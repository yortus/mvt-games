import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/digdug-textures.json`, {
    digger: {
        idle: 'digger-idle',
        walkA: 'digger-walk-a',
        walkB: 'digger-walk-b',
        pump: 'digger-pump',
        icon: 'digger-icon',
    },
    pooka: {
        normal: 'pooka',
        inflate1: 'pooka-inflate1',
        inflate2: 'pooka-inflate2',
        inflate3: 'pooka-inflate3',
        crushed: 'pooka-crushed',
    },
    fygar: {
        normal: 'fygar',
        inflate1: 'fygar-inflate1',
        inflate2: 'fygar-inflate2',
        inflate3: 'fygar-inflate3',
        crushed: 'fygar-crushed',
    },
    ghostEyes: 'ghost-eyes',
    rock: {
        normal: 'rock',
        shattered: 'rock-shattered',
    },
});
