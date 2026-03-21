/**
 * Generate retro pixel-art texture PNGs for Scramble.
 *
 * Run:  npx tsx scripts/generate-scramble-textures.ts
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

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'scramble', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (hex RGBA)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0],             // transparent
    'W': [255, 255, 255, 255],     // white
    'C': [136, 204, 255, 255],     // cyan highlight
    'G': [255, 102, 0, 255],       // engine glow orange
    'g': [255, 204, 0, 255],       // engine glow yellow
    'Y': [255, 255, 0, 255],       // bright yellow (bullet)
    'K': [0, 0, 0, 255],           // black
    'D': [80, 80, 80, 255],        // dark gray (bomb body)
    'R': [255, 0, 0, 255],         // red (bomb fuse)
    'r': [180, 40, 0, 255],        // dim red (bomb spark)
};

// ---------------------------------------------------------------------------
// Texture definitions (character grids)
// ---------------------------------------------------------------------------

/** Player ship - 16x16, facing right */
const SHIP: string[] = [
    '................',
    '.........WW.....',
    '........WCCW....',
    '.......WCCCW....',
    '......WCCCCW....',
    '.G...WCCCCCWWWW.',
    'GgG.WWCCCCWWWWWW',
    'GgGWWWWWWWWWWWWW',
    'GgG.WWCCCCWWWWWW',
    '.G...WCCCCCWWWW.',
    '......WCCCCW....',
    '.......WCCCW....',
    '........WCCW....',
    '.........WW.....',
    '................',
    '................',
];

/** Ship lives icon - 8x8 tiny ship for HUD */
const SHIP_ICON: string[] = [
    '....CC..',
    '...CWWC.',
    '.GWWWWWW',
    '.GWWWWWW',
    '...CWWC.',
    '....CC..',
    '........',
    '........',
];

/** Bullet - 4x4 yellow projectile */
const BULLET: string[] = [
    '.YY.',
    'YYYY',
    'YYYY',
    '.YY.',
];

/** Bomb - 8x8 dark round bomb */
const BOMB: string[] = [
    '...rr...',
    '...RR...',
    '..DDDD..',
    '.DDDDDD.',
    '.DDDDDD.',
    '.DDDDDD.',
    '..DDDD..',
    '...DD...',
];

/** Rocket idle - 8x16, sitting on ground pointing up */
const ROCKET_IDLE: string[] = [
    '...WW...',
    '..WWWW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '.WWCCWW.',
    '.WKKKKW.',
    'WW.KK.WW',
    'W......W',
];

/** Rocket launching - 8x16, with flame */
const ROCKET_LAUNCHING: string[] = [
    '...WW...',
    '..WWWW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '..WCCW..',
    '.WWCCWW.',
    '.WKKKKW.',
    'WW.Gg.WW',
    'W.GggG.W',
];

/** UFO - 16x8 flying saucer */
const UFO: string[] = [
    '......CCCC......',
    '....CCCCCCCC....',
    '...CWWWWWWWWC...',
    '..CWWWWWWWWWWC..',
    '.CCCCCCCCCCCCCC.',
    'CCCCCCCCCCCCCCCC',
    '..CC..CC..CC..CC',
    '...C...C...C...C',
];

/** Fuel tank - 16x12 ground fuel depot */
const FUEL_TANK: string[] = [
    '....YYYYYYYY....',
    '...YRKRKRKRKY...',
    '..YRKRKRKRKRKY..',
    '.YRKRKRKRKRKRKY.',
    '.YRKRKRKRKRKRKY.',
    '.YRKRKRKRKRKRKY.',
    '.YRKRKRKRKRKRKY.',
    '.YRKRKRKRKRKRKY.',
    '..YRKRKRKRKRKY..',
    '...YRKRKRKRKY...',
    '....YYYYYYYY....',
    '................',
];

/** Base target - 16x16 enemy headquarters */
const BASE: string[] = [
    '.....RRRRRR.....',
    '....RRRRRRRR....',
    '...RRKKKKKRRR...',
    '..RRKKKKKKKRR...',
    '..RRKKWWKKRRR...',
    '.RRKKWWWWKKRR...',
    '.RRKKWWWWKKRRR..',
    'RRRKKKKKKKKKRR..',
    'RRRKKKKKKKKRRR..',
    'RRRRRRRRRRRRRR..',
    '.RRRRRRRRRRRR...',
    '..RRRRRRRRRR....',
    '...RRRRRRRR.....',
    '....RRRRRRR.....',
    '.....RRRRR......',
    '................',
];

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

function encode(rows: string[]): Buffer {
    const height = rows.length;
    const width = Math.max(...rows.map((r) => r.length));
    const png = new PNG({ width, height });

    for (let y = 0; y < height; y++) {
        const row = rows[y];
        for (let x = 0; x < width; x++) {
            const ch = x < row.length ? row[x] : '.';
            const [r, g, b, a] = PALETTE[ch] ?? PALETTE['.'];
            const idx = (y * width + x) * 4;
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

const allTextures: Array<[string, string[]]> = [
    ['ship.png', SHIP],
    ['ship-icon.png', SHIP_ICON],
    ['bullet.png', BULLET],
    ['bomb.png', BOMB],
    ['rocket-idle.png', ROCKET_IDLE],
    ['rocket-launching.png', ROCKET_LAUNCHING],
    ['ufo.png', UFO],
    ['fuel-tank.png', FUEL_TANK],
    ['base.png', BASE],
];

for (const [name, rows] of allTextures) {
    const buf = encode(rows);
    const outPath = join(OUT_DIR, name);
    writeFileSync(outPath, buf);
    console.log(`  wrote ${name} (${rows[0].length}x${rows.length})`);
}

console.log(`\nDone - ${allTextures.length} textures written to ${OUT_DIR}`);
