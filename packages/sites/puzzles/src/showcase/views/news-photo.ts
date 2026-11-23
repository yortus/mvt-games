import { createRandom, type Random } from '@mvtjs/site-kit/random';

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Draws a made-up news photo into a rectangle on `context`, in the greys of
 * newsprint, with a fine grain of dots over it, as printed photos have. It's
 * a scene of one of a few kinds, a landscape, a street, a few people or one
 * big thing up close, laid out from `seed`, so the same seed draws the same
 * photo. It isn't meant to be made out in detail. It just has to read as a
 * photo at a glance.
 */
export function drawNewsPhoto(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, seed: number): void {
    const random = createRandom({ seed });
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    switch (random.nextIndex(4)) {
        case 0:
            drawLandscape(context, random, x, y, width, height);
            break;
        case 1:
            drawStreet(context, random, x, y, width, height);
            break;
        case 2:
            drawPeople(context, random, x, y, width, height);
            break;
        default: drawCloseUp(context, random, x, y, width, height);
    }
    drawGrain(context, x, y, width, height);
    context.restore();
    context.strokeStyle = '#3a3733';
    context.lineWidth = 1.5;
    context.strokeRect(x, y, width, height);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Spacing of the grain's dots, in pixels. */
const GRAIN_STEP = 4;

function grey(level: number): string {
    const v = Math.round(Math.min(255, Math.max(0, level)));
    // A touch warm, like ink on newsprint
    return `rgb(${v}, ${Math.round(v * 0.98)}, ${Math.round(v * 0.94)})`;
}

function fillSky(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, top: number, bottom: number): void {
    const sky = context.createLinearGradient(0, y, 0, y + height);
    sky.addColorStop(0, grey(top));
    sky.addColorStop(1, grey(bottom));
    context.fillStyle = sky;
    context.fillRect(x, y, width, height);
}

/** Hills, one behind the other, darker as they come nearer, with a pale sun and a few trees. */
function drawLandscape(context: CanvasRenderingContext2D, random: Random, x: number, y: number, width: number, height: number): void {
    fillSky(context, x, y, width, height, 175, 232);
    context.fillStyle = grey(244);
    context.beginPath();
    context.arc(x + random.between(0.2, 0.8) * width, y + random.between(0.15, 0.35) * height, height * 0.1, 0, Math.PI * 2);
    context.fill();
    const layers = 3;
    for (let layer = 0; layer < layers; layer++) {
        const base = y + height * (0.45 + layer * 0.15);
        context.fillStyle = grey(165 - layer * 40);
        context.beginPath();
        context.moveTo(x, y + height);
        const bumps = 3 + random.nextIndex(3);
        for (let i = 0; i <= bumps; i++) {
            context.lineTo(x + (i / bumps) * width, base - random.between(0, height * 0.12));
        }
        context.lineTo(x + width, y + height);
        context.fill();
    }
    const trees = 2 + random.nextIndex(4);
    for (let i = 0; i < trees; i++) {
        const treeX = x + random.between(0.05, 0.95) * width;
        const treeY = y + random.between(0.7, 0.9) * height;
        const size = height * random.between(0.06, 0.12);
        context.fillStyle = grey(60);
        context.fillRect(treeX - size * 0.1, treeY, size * 0.2, size * 1.2);
        context.fillStyle = grey(70 + random.between(-15, 15));
        context.beginPath();
        context.arc(treeX, treeY, size, 0, Math.PI * 2);
        context.fill();
    }
}

/** A row of buildings with lit windows, over a dark road. */
function drawStreet(context: CanvasRenderingContext2D, random: Random, x: number, y: number, width: number, height: number): void {
    fillSky(context, x, y, width, height, 200, 236);
    let left = x - random.between(0, width * 0.1);
    while (left < x + width) {
        const buildingWidth = width * random.between(0.12, 0.28);
        const top = y + height * random.between(0.12, 0.5);
        const shade = random.between(80, 150);
        context.fillStyle = grey(shade);
        context.fillRect(left, top, buildingWidth, y + height - top);
        context.fillStyle = grey(shade + 55);
        const windowSize = Math.max(3, buildingWidth * 0.14);
        for (let wy = top + windowSize; wy < y + height * 0.8; wy += windowSize * 2) {
            for (let wx = left + windowSize * 0.8; wx < left + buildingWidth - windowSize; wx += windowSize * 1.9) {
                context.fillRect(wx, wy, windowSize, windowSize);
            }
        }
        left += buildingWidth + width * random.between(0, 0.03);
    }
    context.fillStyle = grey(55);
    context.fillRect(x, y + height * 0.84, width, height * 0.16);
}

/** A few people, nearer ones bigger, in front of a wall. */
function drawPeople(context: CanvasRenderingContext2D, random: Random, x: number, y: number, width: number, height: number): void {
    fillSky(context, x, y, width, height, 150, 205);
    const count = 2 + random.nextIndex(4);
    for (let i = 0; i < count; i++) {
        const scale = random.between(0.55, 1);
        const centreX = x + random.between(0.1, 0.9) * width;
        const headRadius = height * 0.1 * scale;
        const headY = y + height * (0.95 - 0.7 * scale);
        context.fillStyle = grey(40 + (1 - scale) * 90);
        context.beginPath();
        context.arc(centreX, headY, headRadius, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.ellipse(centreX, headY + headRadius * 3.3, headRadius * 1.9, headRadius * 2.4, 0, 0, Math.PI * 2);
        context.fill();
    }
}

/** One big round thing up close, such as a prize vegetable, on a table. */
function drawCloseUp(context: CanvasRenderingContext2D, random: Random, x: number, y: number, width: number, height: number): void {
    fillSky(context, x, y, width, height, 215, 185);
    context.fillStyle = grey(120);
    context.fillRect(x, y + height * 0.72, width, height * 0.28);
    const centreX = x + width * random.between(0.35, 0.65);
    const radius = Math.min(width, height) * random.between(0.28, 0.4);
    const centreY = y + height * 0.72 - radius * 0.7;
    const body = context.createRadialGradient(centreX - radius * 0.35, centreY - radius * 0.35, radius * 0.1, centreX, centreY, radius);
    body.addColorStop(0, grey(190));
    body.addColorStop(1, grey(55));
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(centreX, centreY, radius * random.between(1, 1.3), radius, 0, 0, Math.PI * 2);
    context.fill();
}

/** The grain of a printed photo, as rows of faint dots. */
function drawGrain(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    context.fillStyle = 'rgba(30, 28, 25, 0.12)';
    for (let gy = y; gy < y + height; gy += GRAIN_STEP) {
        const offset = ((gy - y) / GRAIN_STEP) % 2 === 0 ? 0 : GRAIN_STEP / 2;
        for (let gx = x + offset; gx < x + width; gx += GRAIN_STEP) context.fillRect(gx, gy, 1.5, 1.5);
    }
}
