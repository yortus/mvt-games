// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The pan of a two-digit hex value, as the `P` token writes it: `00` is hard
 * left, `80` the centre and `FF` hard right.
 */
export function toPan(value: number): number {
    return value < 0x80 ? (value - 0x80) / 0x80 : (value - 0x80) / 0x7f;
}
