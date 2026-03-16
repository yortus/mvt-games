import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry('assets/pacman-textures.json', {
    pacmanClosed: 'pacman-closed',
    pacmanMid: 'pacman-mid',
    pacmanOpen: 'pacman-open',
    ghostBody: 'ghost-body',
    ghostEyes: 'ghost-eyes',
});
