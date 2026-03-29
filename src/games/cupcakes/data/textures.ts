import { createTextureRegistry } from '#common';

export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/cupcakes-textures.json`, {
    cupcake: {
        strawberry: 'strawberry',
        chocolate: 'chocolate',
        grape: 'grape',
        blueberry: 'blueberry',
        mint: 'mint',
        lemon: 'lemon',
    },
});
