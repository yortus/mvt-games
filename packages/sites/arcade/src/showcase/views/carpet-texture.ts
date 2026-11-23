import { Texture } from 'pixi.js';
import { createRandom } from '@mvtjs/site-kit/random';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the hall's carpet, drawn on a canvas: dark blue, scattered with
 * bright rings, zigzags and dots, like a cinema foyer's. It's drawn from a
 * fixed seed, so it's the same every time.
 */
export function createCarpetTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('arcade hall: the carpet needs a 2D canvas');
    const random = createRandom({ seed: 1977 });
    context.fillStyle = '#141236';
    context.fillRect(0, 0, SIZE, SIZE);
    context.lineWidth = 5;
    context.lineCap = 'round';
    for (let i = 0; i < SHAPE_COUNT; i++) {
        const x = random.between(0, SIZE);
        const y = random.between(0, SIZE);
        const color = COLORS[random.nextIndex(COLORS.length)];
        context.strokeStyle = color;
        context.fillStyle = color;
        context.beginPath();
        switch (random.nextIndex(3)) {
            case 0:
                context.arc(x, y, random.between(7, 14), 0, Math.PI * 2);
                context.stroke();
                break;
            case 1: {
                const angle = random.between(0, Math.PI);
                const dx = Math.cos(angle) * 9;
                const dy = Math.sin(angle) * 9;
                context.moveTo(x - dx * 2, y - dy * 2);
                context.lineTo(x - dx - dy, y - dy + dx);
                context.lineTo(x + dx + dy, y + dy - dx);
                context.lineTo(x + dx * 2, y + dy * 2);
                context.stroke();
                break;
            }
            default:
                context.arc(x, y, 4, 0, Math.PI * 2);
                context.fill();
        }
    }
    return Texture.from(canvas);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SIZE = 1024;
const SHAPE_COUNT = 900;
const COLORS: readonly string[] = ['#ff3d9a', '#29e0ff', '#ffd23f', '#7cff6b', '#a46bff'];
