// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A picture drawn as text, one character per pixel: `.` is pixel value 0,
 * and each character in `inks` is the value of its index plus one. So with
 * inks `'x'`, `x` is 1; with inks `'123'`, `2` is 2.
 */
export interface TextArt {
    readonly width: number;
    readonly height: number;
    /** Pixel values, row by row. */
    readonly pixels: Uint8Array;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ParseTextArtOptions {
    /** The rows, each the same length. Leading and trailing blank lines are ignored. */
    readonly text: string;
    /** The characters that draw, in value order from 1. */
    readonly inks: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function parseTextArt(options: ParseTextArtOptions): TextArt {
    const { text, inks } = options;
    const rows = text.split('\n').map((row) => row.trimEnd());
    while (rows.length > 0 && rows[0] === '') rows.shift();
    while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
    const width = rows.length === 0 ? 0 : rows[0].length;
    const height = rows.length;
    const pixels = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        const row = rows[y];
        if (row.length !== width) {
            throw new Error(`text art row ${y} is ${row.length} wide, not ${width}: "${row}"`);
        }
        for (let x = 0; x < width; x++) {
            const ch = row[x];
            if (ch === '.') continue;
            const ink = inks.indexOf(ch);
            if (ink < 0) throw new Error(`text art row ${y} has "${ch}", which is not "." or one of "${inks}"`);
            pixels[y * width + x] = ink + 1;
        }
    }
    return { width, height, pixels };
}
