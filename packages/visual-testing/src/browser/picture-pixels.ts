// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns whether every pixel is the same as the first. Such a picture shows
 * nothing but its background.
 */
export function isAllOne(pixels: Uint8Array): boolean {
    const words = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.byteLength >> 2);
    for (let i = 1; i < words.length; i++) {
        if (words[i] !== words[0]) return false;
    }
    return true;
}

/**
 * Reverses the order of a picture's RGBA rows, in place. This is needed
 * because WebGL reads the bottom row first.
 */
export function flipRows(pixels: Uint8Array, width: number, height: number): void {
    const row = width * 4;
    const swap = new Uint8Array(row);
    for (let top = 0, bottom = height - 1; top < bottom; top++, bottom--) {
        swap.set(pixels.subarray(top * row, top * row + row));
        pixels.copyWithin(top * row, bottom * row, bottom * row + row);
        pixels.set(swap, bottom * row);
    }
}
