import { CanvasSource, Texture } from 'pixi.js';
import { createRandom } from '@mvtjs/site-kit/random';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the desk's top, drawn on a canvas: warm wood, in long planks, with
 * a grain of fine, wavy streaks along them. It's drawn from a fixed seed, so
 * it's the same every time.
 */
export function createDeskTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('newspaper: the desk needs a 2D canvas');
    const random = createRandom({ seed: 1902 });
    const plankHeight = SIZE / PLANK_COUNT;
    for (let p = 0; p < PLANK_COUNT; p++) {
        const top = p * plankHeight;
        const tone = random.between(-14, 14);
        context.fillStyle = `rgb(${Math.round(132 + tone)}, ${Math.round(88 + tone * 0.7)}, ${Math.round(54 + tone * 0.4)})`;
        context.fillRect(0, top, SIZE, plankHeight);
        for (let s = 0; s < STREAKS_PER_PLANK; s++) {
            const y = top + random.between(4, plankHeight - 4);
            const amplitude = random.between(1, 5);
            const wavelength = random.between(120, 400);
            const phase = random.between(0, Math.PI * 2);
            context.strokeStyle = random.next() < 0.5 ? 'rgba(70, 40, 20, 0.22)' : 'rgba(190, 140, 95, 0.18)';
            context.lineWidth = random.between(1, 3);
            context.beginPath();
            for (let x = 0; x <= SIZE; x += 16) {
                const waveY = y + Math.sin((x / wavelength) * Math.PI * 2 + phase) * amplitude;
                if (x === 0) context.moveTo(x, waveY);
                else context.lineTo(x, waveY);
            }
            context.stroke();
        }
        // The dark seam between this plank and the next
        context.fillStyle = 'rgba(40, 22, 10, 0.55)';
        context.fillRect(0, top + plankHeight - 2, SIZE, 2);
    }
    return new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: true }) });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SIZE = 1024;
const PLANK_COUNT = 6;
const STREAKS_PER_PLANK = 34;
