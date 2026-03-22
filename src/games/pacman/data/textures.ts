import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/pacman-textures.json`, {
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
