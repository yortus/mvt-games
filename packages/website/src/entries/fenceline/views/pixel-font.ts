import type { PixelRects } from './drawing';

// Fenceline's pixel font, drawn for this game: capitals, digits and a little
// punctuation, each 5 pixels wide and 7 tall, like the text of an 80s
// arcade game. It is fixed width, so every character takes the same room.

// ---------------------------------------------------------------------------
// Measures
// ---------------------------------------------------------------------------

/** A character's height, in the font's pixels. */
export const GLYPH_HEIGHT = 7;

/** How far each character moves the next along, in the font's pixels: its width and a pixel of space. */
export const GLYPH_ADVANCE = 6;

/** Returns how wide `text` is, in the font's pixels, with no space after its last character. */
export function measurePixelText(text: string): number {
    return text.length === 0 ? 0 : text.length * GLYPH_ADVANCE - 1;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Returns the pixels that spell `text`, in `colour`, from its top left
 * corner. Lower-case letters are drawn as capitals. A character the font
 * does not have is drawn as a space.
 */
export function spellPixelText(text: string, colour: number): PixelRects {
    const rects: [number, number, number, number, number][] = [];
    const upper = text.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        const runs = GLYPH_RUNS.get(upper[i]);
        if (runs === undefined) continue;
        const x = i * GLYPH_ADVANCE;
        for (let j = 0; j < runs.length; j++) {
            const [runX, runY, runWidth] = runs[j];
            rects.push([x + runX, runY, runWidth, 1, colour]);
        }
    }
    return rects;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Each character, as seven rows of five, `#` for a pixel. */
const GLYPHS: Readonly<Record<string, string>> = {
    'A': '.###. #...# #...# ##### #...# #...# #...#',
    'B': '####. #...# #...# ####. #...# #...# ####.',
    'C': '.###. #...# #.... #.... #.... #...# .###.',
    'D': '####. #...# #...# #...# #...# #...# ####.',
    'E': '##### #.... #.... ####. #.... #.... #####',
    'F': '##### #.... #.... ####. #.... #.... #....',
    'G': '.###. #...# #.... #.### #...# #...# .####',
    'H': '#...# #...# #...# ##### #...# #...# #...#',
    'I': '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
    'J': '..### ...#. ...#. ...#. #..#. #..#. .##..',
    'K': '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
    'L': '#.... #.... #.... #.... #.... #.... #####',
    'M': '#...# ##.## #.#.# #.#.# #...# #...# #...#',
    'N': '#...# ##..# #.#.# #..## #...# #...# #...#',
    'O': '.###. #...# #...# #...# #...# #...# .###.',
    'P': '####. #...# #...# ####. #.... #.... #....',
    'Q': '.###. #...# #...# #...# #.#.# #..#. .##.#',
    'R': '####. #...# #...# ####. #.#.. #..#. #...#',
    'S': '.###. #...# #.... .###. ....# #...# .###.',
    'T': '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
    'U': '#...# #...# #...# #...# #...# #...# .###.',
    'V': '#...# #...# #...# #...# #...# .#.#. ..#..',
    'W': '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
    'X': '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
    'Y': '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
    'Z': '##### ....# ...#. ..#.. .#... #.... #####',
    '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
    '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
    '2': '.###. #...# ....# ...#. ..#.. .#... #####',
    '3': '####. ....# ....# .###. ....# ....# ####.',
    '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
    '5': '##### #.... ####. ....# ....# #...# .###.',
    '6': '.###. #.... #.... ####. #...# #...# .###.',
    '7': '##### ....# ...#. ..#.. .#... .#... .#...',
    '8': '.###. #...# #...# .###. #...# #...# .###.',
    '9': '.###. #...# #...# .#### ....# ....# .###.',
    '.': '..... ..... ..... ..... ..... ..... ..#..',
    ',': '..... ..... ..... ..... ..... ..#.. .#...',
    '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
    '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
    '\'': '..#.. ..#.. .#... ..... ..... ..... .....',
    '"': '.#.#. .#.#. ..... ..... ..... ..... .....',
    ':': '..... ..#.. ..... ..... ..... ..#.. .....',
    '-': '..... ..... ..... .###. ..... ..... .....',
};

/** Each character's pixels, as runs along its rows: [x, y, width]. */
const GLYPH_RUNS: ReadonlyMap<string, readonly (readonly [number, number, number])[]> = findGlyphRuns();

function findGlyphRuns(): Map<string, (readonly [number, number, number])[]> {
    const runsByCharacter = new Map<string, (readonly [number, number, number])[]>();
    for (const [character, pattern] of Object.entries(GLYPHS)) {
        const rows = pattern.split(' ');
        const runs: (readonly [number, number, number])[] = [];
        for (let y = 0; y < rows.length; y++) {
            const row = rows[y];
            let start = -1;
            for (let x = 0; x <= row.length; x++) {
                const isSet = x < row.length && row[x] === '#';
                if (isSet && start < 0) start = x;
                if (!isSet && start >= 0) {
                    runs.push([start, y, x - start]);
                    start = -1;
                }
            }
        }
        runsByCharacter.set(character, runs);
    }
    return runsByCharacter;
}
