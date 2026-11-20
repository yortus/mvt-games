// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a number from 0 up to 1 that looks random, but is always the same
 * for the same `index` and `salt`. The board uses it to scatter the grass
 * and the glints the same way each time it's drawn.
 */
export function scatter(index: number, salt: number): number {
    const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
}
