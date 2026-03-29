/**
 * Generate pixel-art texture PNGs for Kwazy Cupcakes.
 *
 * Run:  npx tsx scripts/generate-cupcakes-textures.ts
 *
 * Six cupcake flavours, each with a distinctive shape and colour-blind
 * friendly colour from the Wong (2011) palette family. Shapes differ enough
 * that players can distinguish them even without colour perception.
 */

import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Output directory
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'cupcakes', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette - colour-blind safe (Wong 2011 derivatives)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0], // transparent

    // Cup / wrapper
    'W': [160, 105, 59, 255], // wrapper main (golden brown)
    'w': [123, 78, 32, 255], // wrapper dark stripe
    'L': [192, 138, 80, 255], // lip highlight
    'K': [90, 52, 16, 255], // base dark

    // Strawberry frosting (reddish purple - CB safe #CC79A7)
    'P': [204, 121, 167, 255], // main
    'p': [232, 168, 200, 255], // highlight

    // Cherry (on strawberry)
    'Y': [220, 50, 50, 255], // cherry red
    'y': [255, 112, 112, 255], // cherry shine

    // Chocolate frosting (warm brown)
    'C': [140, 80, 20, 255], // main
    'c': [180, 115, 55, 255], // highlight
    'D': [100, 55, 5, 255], // dark drizzle

    // Grape frosting (vivid purple - distinct from strawberry's reddish-pink)
    'N': [138, 43, 226, 255], // main (blue-violet)
    'n': [186, 120, 255, 255], // highlight (light purple)
    'X': [255, 255, 255, 255], // white cream drizzle

    // Lemon frosting (yellow - CB safe #F0E442)
    'V': [240, 228, 66, 255], // main
    'v': [255, 245, 157, 255], // highlight
    'R': [213, 94, 0, 255], // vermillion sprinkle (CB safe)
    'T': [86, 180, 233, 255], // sky blue sprinkle (CB safe)

    // Blueberry frosting (blue - CB safe #0072B2)
    'B': [0, 114, 178, 255], // main
    'b': [86, 180, 233, 255], // highlight

    // Mint frosting (bluish green - CB safe #009E73)
    'M': [0, 158, 115, 255], // main
    'm': [86, 212, 168, 255], // highlight
};

// ---------------------------------------------------------------------------
// Cupcake texture definitions (16x16 character grids)
//
// Each flavour has a unique silhouette so shape alone differentiates them:
//   Strawberry - classic round dome + cherry on top
//   Chocolate  - tall dome with diagonal drizzle pattern
//   Grape      - smooth dome with white cream drizzle swirl
//   Blueberry  - bumpy triple-peaked top (berry cluster)
//   Mint       - pointed zigzag peak (leaf-like)
//   Lemon      - peaked piped swirl + colourful sprinkles
// ---------------------------------------------------------------------------

const STRAWBERRY: string[] = [
    '................',
    '.......YY.......',
    '......YyyY......',
    '.......YY.......',
    '.....pppppp.....',
    '....pPPPPPPp....',
    '...PPPPPPPPPP...',
    '..pPPPPPPPPPPp..',
    '..PPPPPPPPPPPP..',
    '...PPPPPPPPPP...',
    '...LWWWWWWWWL...',
    '...WwWWWWWWwW...',
    '...WWWWWWWWWW...',
    '....WwWWWWwW....',
    '....WWWWWWWW....',
    '.....KKKKKK.....',
];

const CHOCOLATE: string[] = [
    '................',
    '.......cc.......',
    '......cCCc......',
    '.....cCCCCc.....',
    '....cCCDCCDc....',
    '...cCCCDCCDCc...',
    '..cCCDCCDCCDCc..',
    '..CCCCCCCCCCCC..',
    '..cCCCCCCCCCCc..',
    '...CCCCCCCCCC...',
    '...LWWWWWWWWL...',
    '...WwWWWWWWwW...',
    '...WWWWWWWWWW...',
    '....WwWWWWwW....',
    '....WWWWWWWW....',
    '.....KKKKKK.....',
];

const GRAPE: string[] = [
    '................',
    '......nnn.......',
    '.....nNNNn......',
    '....nNNXNNn.....',
    '...nNNNNNNNn....',
    '..nNXNNNNNXNn...',
    '..NNNNNNNNNNNN..',
    '..nNNNNXNNNNn...',
    '..NNNNNNNNNNNN..',
    '...NNNNNNNNNN...',
    '...LWWWWWWWWL...',
    '...WwWWWWWWwW...',
    '...WWWWWWWWWW...',
    '....WwWWWWwW....',
    '....WWWWWWWW....',
    '.....KKKKKK.....',
];

const BLUEBERRY: string[] = [
    '................',
    '.....bb..bb.....',
    '....bBBbbBBb....',
    '...bBBBBBBBBb...',
    '..bBBBBBBBBBBb..',
    '..BBbbBBBBbbBB..',
    '..BBBBBBBBBBBB..',
    '..bBBBBBBBBBBb..',
    '..BBBBBBBBBBBB..',
    '...BBBBBBBBBB...',
    '...LWWWWWWWWL...',
    '...WwWWWWWWwW...',
    '...WWWWWWWWWW...',
    '....WwWWWWwW....',
    '....WWWWWWWW....',
    '.....KKKKKK.....',
];

const MINT: string[] = [
    '........m.......',
    '.......mMm......',
    '......mMmMm.....',
    '.....mMMMMMm....',
    '....mMMMMMMMm...',
    '...mMMMMMMMMm...',
    '..mMMMMMMMMMMm..',
    '..MMMMMMMMMMMM..',
    '..mMMMMMMMMMMm..',
    '...MMMMMMMMMM...',
    '...LWWWWWWWWL...',
    '...WwWWWWWWwW...',
    '...WWWWWWWWWW...',
    '....WwWWWWwW....',
    '....WWWWWWWW....',
    '.....KKKKKK.....',
];

const LEMON: string[] = [
    '................',
    '........v.......',
    '.......vVv......',
    '......vVVVv.....',
    '.....vVVVVVv....',
    '....VVRVVVTVV...',
    '...VVVVVVVVVV...',
    '..VVTVVVVVRVVV..',
    '..VVVVVVVVVVVV..',
    '...VVVVVVVVVV...',
    '...LWWWWWWWWL...',
    '...WwWWWWWWwW...',
    '...WWWWWWWWWW...',
    '....WwWWWWwW....',
    '....WWWWWWWW....',
    '.....KKKKKK.....',
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

const textures: Array<[string, string[]]> = [
    ['strawberry.png', STRAWBERRY],
    ['chocolate.png', CHOCOLATE],
    ['grape.png', GRAPE],
    ['blueberry.png', BLUEBERRY],
    ['mint.png', MINT],
    ['lemon.png', LEMON],
];

for (const [name, rows] of textures) {
    const buf = encode(rows);
    const outPath = join(OUT_DIR, name);
    writeFileSync(outPath, buf);
    console.log(`  wrote ${name} (${rows[0].length}x${rows.length})`);
}

console.log(`\nDone - ${textures.length} textures written to ${OUT_DIR}`);
