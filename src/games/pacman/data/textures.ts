import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry('assets/pacman-textures.json', {
    pacman: {
        closed: 'pacman-closed',
        mid: 'pacman-mid',
        open: 'pacman-open',
    },
    ghost: {
        body: 'ghost-body',
        eyes: 'ghost-eyes',
    },
});
