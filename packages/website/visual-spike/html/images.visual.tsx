// Spike: which step of drawing a photo differs between systems: decoding WebP, scaling, or rotating.
// The same steps on a lossless PNG (made here, from fixed noise) separate decoding from the rest.
import { describe } from 'vitest';
import { findEntry } from '../../src/entries';
import { visualHtmlTest } from '../harness';

const WEBP = findEntry('crumb-chase')!.thumbnail;

/** A photo-like PNG: smooth gradients with fixed noise, 280 by 235 like the thumbnails. */
function noisePng(): string {
    const c = document.createElement('canvas');
    c.width = 280;
    c.height = 235;
    const ctx = c.getContext('2d')!;
    const image = ctx.createImageData(280, 235);
    let seed = 1;
    for (let i = 0; i < image.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const x = (i / 4) % 280;
        const y = Math.floor(i / 4 / 280);
        image.data[i] = (x * 0.9 + (seed & 31)) & 255;
        image.data[i + 1] = (y * 1.1 + ((seed >> 5) & 31)) & 255;
        image.data[i + 2] = ((x + y) * 0.5 + ((seed >> 10) & 63)) & 255;
        image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return c.toDataURL('image/png');
}

function img(src: string, style: string): () => HTMLElement {
    return () => {
        const root = document.createElement('div');
        root.style.cssText = 'padding:12px;';
        root.innerHTML = `<img src="${src}" style="display:block;${style}">`;
        return root;
    };
}

describe('webp', () => {
    visualHtmlTest('natural size', img(WEBP, ''));
    visualHtmlTest('scaled smooth', img(WEBP, 'width:200px'));
    visualHtmlTest('scaled pixelated', img(WEBP, 'width:200px;image-rendering:pixelated'));
    visualHtmlTest('scaled and rotated', img(WEBP, 'width:200px;transform:rotate(-3deg)'));
});

describe('png', () => {
    visualHtmlTest('natural size', () => img(noisePng(), '')());
    visualHtmlTest('scaled smooth', () => img(noisePng(), 'width:200px')());
    visualHtmlTest('scaled pixelated', () => img(noisePng(), 'width:200px;image-rendering:pixelated')());
    visualHtmlTest('scaled and rotated', () => img(noisePng(), 'width:200px;transform:rotate(-3deg)')());
    visualHtmlTest('rotated only', () => img(noisePng(), 'transform:rotate(-3deg)')());
});
