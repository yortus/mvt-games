/**
 * Generate retro pixel-art sprite PNGs for Pac-Man.
 *
 * Run:  npx tsx scripts/generate-pacman-sprites.ts
 *
 * Each sprite is defined as a grid of palette-index characters.
 * The script encodes them into tiny PNG files using `pngjs`.
 */

import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'pacman', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (hex RGBA)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0],           // transparent
    Y: [255, 255, 0, 255],       // yellow (Pac-Man body)
    W: [255, 255, 255, 255],     // white (ghost body / eye whites)
    B: [0, 0, 170, 255],         // blue (ghost pupils)
};

// ---------------------------------------------------------------------------
// Pac-Man mouth frames (16×16, facing right)
// ---------------------------------------------------------------------------

/** Mouth closed - full yellow circle */
const PACMAN_CLOSED: string[] = [
    '.....YYYYYY.....',
    '....YYYYYYYY....',
    '...YYYYYYYYYY...',
    '..YYYYYYYYYYYY..',
    '..YYYYYYYYYYYY..',
    '.YYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYY.',
    '..YYYYYYYYYYYY..',
    '..YYYYYYYYYYYY..',
    '...YYYYYYYYYY...',
    '....YYYYYYYY....',
    '.....YYYYYY.....',
];

/** Mouth half-open - small wedge cut from right */
const PACMAN_MID: string[] = [
    '.....YYYYYY.....',
    '....YYYYYYYY....',
    '...YYYYYYYYYY...',
    '..YYYYYYYYYYYY..',
    '..YYYYYYYYYYY...',
    '.YYYYYYYYYYYYY..',
    '.YYYYYYYYYYYY...',
    '.YYYYYYYYYYY....',
    '.YYYYYYYYYYY....',
    '.YYYYYYYYYYYY...',
    '.YYYYYYYYYYYYY..',
    '..YYYYYYYYYYY...',
    '..YYYYYYYYYYYY..',
    '...YYYYYYYYYY...',
    '....YYYYYYYY....',
    '.....YYYYYY.....',
];

/** Mouth wide open - large wedge cut from right */
const PACMAN_OPEN: string[] = [
    '.....YYYYYY.....',
    '....YYYYYYYY....',
    '...YYYYYYYYYY...',
    '..YYYYYYYYYY....',
    '..YYYYYYYY......',
    '.YYYYYYYYY......',
    '.YYYYYYYY.......',
    '.YYYYYY.........',
    '.YYYYYY.........',
    '.YYYYYYYY.......',
    '.YYYYYYYYY......',
    '..YYYYYYYY......',
    '..YYYYYYYYYY....',
    '...YYYYYYYYYY...',
    '....YYYYYYYY....',
    '.....YYYYYY.....',
];

// ---------------------------------------------------------------------------
// Ghost sprites (16×16)
// ---------------------------------------------------------------------------

/** Ghost body - white shape for tinting at runtime */
const GHOST_BODY: string[] = [
    '.....WWWWWW.....',
    '....WWWWWWWW....',
    '...WWWWWWWWWW...',
    '..WWWWWWWWWWWW..',
    '..WWWWWWWWWWWW..',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.WWW.WWWWWW.WWW.',
    '..WW..WWWW..WW..',
    '................',
    '................',
    '................',
];

/** Ghost eyes - transparent with white eyes and blue pupils */
const GHOST_EYES: string[] = [
    '................',
    '................',
    '................',
    '................',
    '....WW..WW......',
    '...WWWW.WWWW....',
    '...WBBW.WBBW....',
    '...WWWW.WWWW....',
    '....WW..WW......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
];

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

/** Tile size the sprites will be displayed at. */
const TARGET_TILE = 20;

function encode(rows: string[], targetW: number, targetH: number): Buffer {
    const srcH = rows.length;
    const srcW = Math.max(...rows.map((row) => row.length));
    const png = new PNG({ width: targetW, height: targetH });

    for (let oy = 0; oy < targetH; oy++) {
        const sy = Math.floor(oy * srcH / targetH);
        const row = rows[sy];
        for (let ox = 0; ox < targetW; ox++) {
            const sx = Math.floor(ox * srcW / targetW);
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

const sprites: Array<[string, string[]]> = [
    ['pacman-closed.png', PACMAN_CLOSED],
    ['pacman-mid.png', PACMAN_MID],
    ['pacman-open.png', PACMAN_OPEN],
    ['ghost-body.png', GHOST_BODY],
    ['ghost-eyes.png', GHOST_EYES],
];

for (const [name, rows] of sprites) {
    const buf = encode(rows, TARGET_TILE, TARGET_TILE);
    const outPath = join(OUT_DIR, name);
    writeFileSync(outPath, buf);
    console.log(`  wrote ${name} (${TARGET_TILE}×${TARGET_TILE})`);
}

console.log(`\nDone - ${sprites.length} sprites written to ${OUT_DIR}`);
