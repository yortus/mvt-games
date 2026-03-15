/**
 * Generate retro pixel-art texture PNGs for Dig Dug.
 *
 * Run:  npx tsx scripts/generate-digdug-textures.ts
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

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'digdug', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (hex RGBA)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0],           // transparent
    K: [0, 0, 0, 255],           // black
    W: [255, 255, 255, 255],     // white (suit, helmet)
    H: [252, 228, 184, 255],     // skin
    B: [68, 136, 255, 255],      // blue (visor)
    b: [51, 102, 204, 255],      // dark blue (belt, boots)
    // Pooka colours
    R: [255, 68, 68, 255],       // pooka body red
    r: [255, 120, 120, 255],     // pooka inflate-1 lighter red
    P: [255, 170, 170, 255],     // pooka inflate-2/3 pink
    // Fygar colours
    G: [68, 204, 68, 255],       // fygar body green
    g: [136, 255, 136, 255],     // fygar inflate lighter green
    V: [204, 238, 136, 255],     // fygar belly
    D: [34, 102, 34, 255],       // dark green (wings)
    // Rock colours
    N: [139, 115, 85, 255],      // brown
    n: [92, 74, 50, 255],        // dark brown (cracks)
    L: [170, 145, 110, 255],     // light brown
};

// ---------------------------------------------------------------------------
// Digger textures (16×16, facing right)
// ---------------------------------------------------------------------------

const DIGGER_IDLE: string[] = [
    '......WW........',
    '.....WWWW.......',
    '.....WWWW.......',
    '....WHHHHW......',
    '....HBBBKH......',
    '.....HHH........',
    '....WWWWWW......',
    '....WWWWWW......',
    '....bbbbbb......',
    '....WWWWWW......',
    '...WW.WW.WW.....',
    '......WW........',
    '.....WW.WW......',
    '.....bb.bb......',
    '................',
    '................',
];

const DIGGER_WALK_A: string[] = [
    '......WW........',
    '.....WWWW.......',
    '.....WWWW.......',
    '....WHHHHW......',
    '....HBBBKH......',
    '.....HHH........',
    '....WWWWWW......',
    '...WWWWWWWW.....',
    '....bbbbbb......',
    '...WWWWWWWW.....',
    '..WW..WW...WW...',
    '......WW........',
    '.....WWWW.......',
    '.....b..b.......',
    '................',
    '................',
];

const DIGGER_WALK_B: string[] = [
    '......WW........',
    '.....WWWW.......',
    '.....WWWW.......',
    '....WHHHHW......',
    '....HBBBKH......',
    '.....HHH........',
    '....WWWWWW......',
    '...WWWWWWWW.....',
    '....bbbbbb......',
    '...WWWWWWWW.....',
    '...WW.WW..WW....',
    '......WW........',
    '....WW..WW......',
    '....bb..bb......',
    '................',
    '................',
];

const DIGGER_PUMP: string[] = [
    '......WW........',
    '.....WWWW.......',
    '.....WWWW.......',
    '....WHHHHW......',
    '....HBBBKH......',
    '.....HHH........',
    '....WWWWWW......',
    '....WWWWWW......',
    '....bbbbbb......',
    '....WWWWWWWWH...',
    '....WWWWWWWWH...',
    '......WW........',
    '.....WW.WW......',
    '.....bb.bb......',
    '................',
    '................',
];

/** Digger lives icon - 8×8 */
const DIGGER_ICON: string[] = [
    '..WW....',
    '.WWWW...',
    '.WHBW...',
    '.WWWW...',
    '.bbbb...',
    '.WWWW...',
    '..WW....',
    '..bb....',
];

// ---------------------------------------------------------------------------
// Pooka textures (16×16)
// ---------------------------------------------------------------------------

const POOKA: string[] = [
    '................',
    '.....RRRR.......',
    '....RRRRRR......',
    '...RRRRRRRR.....',
    '..RRRRRRRRRR....',
    '..RWWWRRWWRR....',
    '..RWKRRRRWKR....',
    '..RRRRRRRRRR....',
    '...RRRRRRRR.....',
    '...RRRRRRRR.....',
    '....RRRRRR......',
    '....RRRRRR......',
    '.....RRRR.......',
    '.....RR.RR......',
    '................',
    '................',
];

const POOKA_INFLATE1: string[] = [
    '................',
    '.....rrrr.......',
    '....rrrrrr......',
    '...rrrrrrrr.....',
    '..rrrrrrrrrr....',
    '..rWWWrrWWrr....',
    '..rWKrrrrrWKr...',
    '..rrrrrrrrrr....',
    '...rrrrrrrr.....',
    '...rrrrrrrr.....',
    '....rrrrrr......',
    '....rrrrrr......',
    '.....rrrr.......',
    '................',
    '................',
    '................',
];

const POOKA_INFLATE2: string[] = [
    '................',
    '....PPPPPP......',
    '...PPPPPPPP.....',
    '..PPPPPPPPPP....',
    '..PPPPPPPPPP....',
    '..PWWWPPWWPP....',
    '..PWKPPPWKPP....',
    '..PPPPPPPPPP....',
    '..PPPPPPPPPP....',
    '...PPPPPPPP.....',
    '...PPPPPPPP.....',
    '....PPPPPP......',
    '................',
    '................',
    '................',
    '................',
];

const POOKA_INFLATE3: string[] = [
    '...PPPPPPPP.....',
    '..PPPPPPPPPP....',
    '..PPPPPPPPPP....',
    '.PPPPPPPPPPPP...',
    '.PPWWWPPWWPPP...',
    '.PPWKPPPPWKPP...',
    '.PPPPPPPPPPPP...',
    '.PPPPPPPPPPPP...',
    '..PPPPPPPPPP....',
    '..PPPPPPPPPP....',
    '..PPPPPPPPPP....',
    '...PPPPPPPP.....',
    '................',
    '................',
    '................',
    '................',
];

const POOKA_CRUSHED: string[] = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.RRRRRRRRRRRR...',
    '.RRRRRRRRRRRR...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
];

// ---------------------------------------------------------------------------
// Fygar textures (16×16)
// ---------------------------------------------------------------------------

const FYGAR: string[] = [
    '................',
    '..DD.GGGGG......',
    '.DGGGGGGGG......',
    '...GGGGGGGG.....',
    '...GWKGGGWKG....',
    '...GGGGGGGGGG...',
    '....GVVVVVGG....',
    '....GVVVVVG.....',
    '....GGGGGGG.....',
    '.....GGGGGGG....',
    '......GGGGG.....',
    '.......GG.GG....',
    '................',
    '................',
    '................',
    '................',
];

const FYGAR_INFLATE1: string[] = [
    '................',
    '.....ggggg......',
    '....ggggggg.....',
    '...ggggggggg....',
    '...gWKgggWKg....',
    '...ggggggggg....',
    '....gVVVVVgg....',
    '....gVVVVVg.....',
    '....ggggggg.....',
    '.....ggggg......',
    '.....ggggg......',
    '................',
    '................',
    '................',
    '................',
    '................',
];

const FYGAR_INFLATE2: string[] = [
    '................',
    '....gggggg......',
    '...gggggggg.....',
    '..gggggggggg....',
    '..gWKggggWKg....',
    '..gggggggggg....',
    '..ggVVVVVVgg....',
    '...gVVVVVVg.....',
    '...gggggggg.....',
    '...gggggggg.....',
    '....gggggg......',
    '................',
    '................',
    '................',
    '................',
    '................',
];

const FYGAR_INFLATE3: string[] = [
    '....gggggg......',
    '...gggggggg.....',
    '..gggggggggg....',
    '.gggggggggggg...',
    '.gWKggggggWKg...',
    '.ggggggggggg....',
    '.ggVVVVVVVVgg...',
    '..gVVVVVVVVg....',
    '..gggggggggg....',
    '..gggggggggg....',
    '...gggggggg.....',
    '....gggggg......',
    '................',
    '................',
    '................',
    '................',
];

const FYGAR_CRUSHED: string[] = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.GGGGGGGGGGGG...',
    '.GGGGGGGGGGGG...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
];

// ---------------------------------------------------------------------------
// Ghost eyes (16×16, transparent with just eyes)
// ---------------------------------------------------------------------------

const GHOST_EYES: string[] = [
    '................',
    '................',
    '................',
    '................',
    '....WW..WW......',
    '...WWWW.WWWW....',
    '...WKKW.WKKW....',
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
// Rock textures (16×16)
// ---------------------------------------------------------------------------

const ROCK: string[] = [
    '................',
    '....NNNN........',
    '...NNNNNN.......',
    '..NNNNNNNN......',
    '..NNNNnNNNN.....',
    '.NNNnNNNNNNN....',
    '.NNNNNNNNNNNN...',
    '.NNLNNNNNNNNN...',
    '.NNNNNnNNNNNN...',
    '..NNNNnNNNNN....',
    '..NNNNNNNNN.....',
    '...NNNNNNNN.....',
    '....NNNNNN......',
    '.....NNN........',
    '................',
    '................',
];

const ROCK_SHATTERED: string[] = [
    '................',
    '...NN...........',
    '.NNN....NN......',
    '...N.....NNN....',
    '..........N.....',
    '................',
    '.NN.............',
    'NNN....NNN......',
    '..N.....NNNN....',
    '........NNN.....',
    '.....NN.........',
    '......NNN..NN...',
    '.........N..NNN.',
    '..........NN....',
    '................',
    '................',
];

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

/** Tile size the textures will be displayed at. */
const TARGET_TILE = 20;
/** Icon target size (HUD lives). */
const TARGET_ICON = 10;

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

const textures: Array<[string, string[]]> = [
    // Digger
    ['digger-idle.png', DIGGER_IDLE],
    ['digger-walk-a.png', DIGGER_WALK_A],
    ['digger-walk-b.png', DIGGER_WALK_B],
    ['digger-pump.png', DIGGER_PUMP],
    ['digger-icon.png', DIGGER_ICON],
    // Pooka
    ['pooka.png', POOKA],
    ['pooka-inflate1.png', POOKA_INFLATE1],
    ['pooka-inflate2.png', POOKA_INFLATE2],
    ['pooka-inflate3.png', POOKA_INFLATE3],
    ['pooka-crushed.png', POOKA_CRUSHED],
    // Fygar
    ['fygar.png', FYGAR],
    ['fygar-inflate1.png', FYGAR_INFLATE1],
    ['fygar-inflate2.png', FYGAR_INFLATE2],
    ['fygar-inflate3.png', FYGAR_INFLATE3],
    ['fygar-crushed.png', FYGAR_CRUSHED],
    // Shared
    ['ghost-eyes.png', GHOST_EYES],
    // Rock
    ['rock.png', ROCK],
    ['rock-shattered.png', ROCK_SHATTERED],
];

for (const [name, rows] of textures) {
    const isIcon = name.includes('icon');
    const target = isIcon ? TARGET_ICON : TARGET_TILE;
    const buf = encode(rows, target, target);
    const outPath = join(OUT_DIR, name);
    writeFileSync(outPath, buf);
    console.log(`  wrote ${name} (${target}×${target})`);
}

console.log(`\nDone - ${textures.length} textures written to ${OUT_DIR}`);
