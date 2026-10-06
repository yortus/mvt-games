import { createTextureRegistry } from '@mvtjs/pixi';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/crumb-chase-textures.json`, {
    mouse: {
        tailUp: 'mouse-tail-up',
        tailMid: 'mouse-tail-mid',
        tailDown: 'mouse-tail-down',
    },
    cat: {
        body: 'cat-body',
        face: 'cat-face',
    },
});
