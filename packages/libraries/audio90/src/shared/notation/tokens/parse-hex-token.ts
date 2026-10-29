// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The value of a token made of `prefix` then `digits` hex digits, such as `v9` or `a37`. Undefined if the token is not one. */
export function parseHexToken(token: string, prefix: string, digits: number): number | undefined {
    if (!token.startsWith(prefix) || token.length !== prefix.length + digits) return undefined;
    const hex = token.slice(prefix.length);
    if (!HEX.test(hex)) return undefined;
    return parseInt(hex, 16);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HEX = /^[0-9A-Fa-f]+$/;
