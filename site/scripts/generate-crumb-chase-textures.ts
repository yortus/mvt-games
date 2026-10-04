/**
 * Generate retro pixel-art texture PNGs for Crumb Chase.
 *
 * Run:  npx tsx scripts/generate-crumb-chase-textures.ts
 *
 * Each texture is defined as a grid of palette-index characters.
 * The script encodes them into tiny PNG files using `pngjs`.
 */

import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'crumb-chase', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (hex RGBA)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0], // transparent
    'K': [0, 0, 0, 255], // black (eyes, pupils)
    // Mouse colours
    'M': [176, 176, 188, 255], // mouse fur
    'm': [112, 112, 124, 255], // mouse fur shadow
    'P': [244, 154, 174, 255], // pink ears, nose and tail
    // Cat colours
    'W': [255, 255, 255, 255], // cat coat, tinted per cat at runtime
    'g': [150, 150, 150, 255], // cat outline, darkened by the same tint
    's': [200, 200, 200, 255], // cat tabby stripes, darkened by the same tint
    'E': [140, 220, 90, 255], // cat eyes
    'p': [230, 130, 150, 255], // cat nose and inner ears
    'w': [235, 235, 235, 255], // cat whiskers
};

// ---------------------------------------------------------------------------
// Mouse textures (16×16, seen from above, facing right)
// ---------------------------------------------------------------------------

/** Tail swished up */
const MOUSE_TAIL_UP: string[] = [
    '................',
    '................',
    '................',
    '..........mm....',
    '.........mPPm...',
    'P....mmmmmPPm...',
    '.P..mMMMMMMmMm..',
    '..PmMMMMMMMMMKm.',
    '...mMMMMMMMMMMMP',
    '...mMMMMMMMMMKm.',
    '....mMMMMMMmMm..',
    '.....mmmmmPPm...',
    '.........mPPm...',
    '..........mm....',
    '................',
    '................',
];

/** Tail straight behind */
const MOUSE_TAIL_MID: string[] = [
    '................',
    '................',
    '................',
    '..........mm....',
    '.........mPPm...',
    '.....mmmmmPPm...',
    '....mMMMMMMmMm..',
    '...mMMMMMMMMMKm.',
    'PPPmMMMMMMMMMMMP',
    '...mMMMMMMMMMKm.',
    '....mMMMMMMmMm..',
    '.....mmmmmPPm...',
    '.........mPPm...',
    '..........mm....',
    '................',
    '................',
];

/** Tail swished down */
const MOUSE_TAIL_DOWN: string[] = [
    '................',
    '................',
    '................',
    '..........mm....',
    '.........mPPm...',
    '.....mmmmmPPm...',
    '....mMMMMMMmMm..',
    '...mMMMMMMMMMKm.',
    '...mMMMMMMMMMMMP',
    '..PmMMMMMMMMMKm.',
    '.P..mMMMMMMmMm..',
    'P....mmmmmPPm...',
    '.........mPPm...',
    '..........mm....',
    '................',
    '................',
];

// ---------------------------------------------------------------------------
// Cat textures (24×24, seen from above, facing right: half again as big as a
// tile, and about twice the length of the mouse)
// ---------------------------------------------------------------------------

/** Cat body - white coat with grey tabby stripes and outline, tinted at runtime */
const CAT_BODY: string[] = [
    '........................',
    '........................',
    '........................',
    '...................g....',
    '..................gWg...',
    '..................gWg...',
    '......g.....gg...gWWWg..',
    '.....gWgggggWWgggWWWWg..',
    '....gWWWWWWWWWgWWWWWWg..',
    '....gWsWWsWWsWWWWWWWWWg.',
    '...gWWsWWsWWsWWWWWWWWWg.',
    '..gWWWsWWsWWsWWWWWWWWWg.',
    '.gWWWWsWWsWWsWWsssWWWWg.',
    '.gWgWWsWWsWWsWWWWWWWWWg.',
    'gWWggWsWWsWWsWWWWWWWWWg.',
    'gWg.gWWWWWWWWWgWWWWWWg..',
    'gWWg.gWgggggWWgggWWWWg..',
    'gWWWggg.....gg...gWWWg..',
    '.gWWWWg...........gWg...',
    '..gggWg...........gWg...',
    '.....g.............g....',
    '........................',
    '........................',
    '........................',
];

/** Cat face - eyes, nose, inner ears and whiskers, drawn untinted over the body */
const CAT_FACE: string[] = [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...................p....',
    '...................p....',
    '........................',
    '.......................w',
    '...................EK.w.',
    '.....................p..',
    '.....................p..',
    '...................EK.w.',
    '.......................w',
    '........................',
    '...................p....',
    '...................p....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
];

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

/**
 * Each grid pixel becomes 1.25 texture pixels: a 16×16 grid fills a 20px tile,
 * and every texture shares the same pixel size.
 */
const PIXEL_SCALE = 1.25;

function encode(rows: string[], targetW: number, targetH: number): Buffer {
    const srcH = rows.length;
    const srcW = Math.max(...rows.map((row) => row.length));
    const png = new PNG({ width: targetW, height: targetH });

    for (let oy = 0; oy < targetH; oy++) {
        const sy = Math.floor((oy * srcH) / targetH);
        const row = rows[sy];
        for (let ox = 0; ox < targetW; ox++) {
            const sx = Math.floor((ox * srcW) / targetW);
            const ch = sx < row.length ? row[sx] : '.';
            const [r, g, b, a] = PALETTE[ch] ?? PALETTE['.'];
            const idx = (oy * targetW + ox) * 4;
            png.data[idx] = r;
            png.data[idx + 1] = g;
            png.data[idx + 2] = b;
            png.data[idx + 3] = a;
        }
    }

    return PNG.sync.write(png);
}

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------

const textures: Array<[string, string[]]> = [
    ['mouse-tail-up.png', MOUSE_TAIL_UP],
    ['mouse-tail-mid.png', MOUSE_TAIL_MID],
    ['mouse-tail-down.png', MOUSE_TAIL_DOWN],
    ['cat-body.png', CAT_BODY],
    ['cat-face.png', CAT_FACE],
];

for (const [name, rows] of textures) {
    const width = Math.round(rows[0].length * PIXEL_SCALE);
    const height = Math.round(rows.length * PIXEL_SCALE);
    const buf = encode(rows, width, height);
    const outPath = join(OUT_DIR, name);
    writeFileSync(outPath, buf);
    console.log(`  wrote ${name} (${width}×${height})`);
}

console.log(`\nDone - ${textures.length} textures written to ${OUT_DIR}`);
