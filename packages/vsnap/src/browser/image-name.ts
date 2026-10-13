/**
 * Turns a test's full name (`'SpinButtonView > spin'`) into its image name
 * (`'SpinButtonView-spin'`). The image name is also the file name of the
 * test's reference image, without `.png`. It joins the test's describe
 * blocks and its name. Each run of characters other than letters, digits
 * and dots becomes a single hyphen, and hyphens at either end are trimmed.
 * Letters and digits of every script are kept, so `'日本'` stays `'日本'`. It
 * throws for a name with no letters or digits, which can't name a file.
 *
 * A name longer than 100 bytes (in UTF-8) is cut short, and a hash of the
 * whole name is added, such as `'...-a1b2c3d4'`. A file name can have only
 * 255 bytes on Linux, and a long path breaks on Windows, so the cut keeps
 * names well inside both. The hash keeps two long names that start alike
 * apart.
 */
export function toImageName(test: string): string {
    const name = test.split(' > ').join('-').replace(/[^\p{L}\p{N}.]+/gu, '-').replace(/^-+|-+$/g, '');
    if (!/[\p{L}\p{N}]/u.test(name)) throw new Error(`The test '${test}' has no letters or digits in its name, so it can't be turned into an image name. Give it a name with some.`);
    const encoder = new TextEncoder();
    if (encoder.encode(name).length <= MAX_NAME_BYTES) return name;
    let cut = '';
    let bytes = 0;
    for (const char of name) {
        bytes += encoder.encode(char).length;
        if (bytes > MAX_NAME_BYTES - HASH_SUFFIX_BYTES) break;
        cut += char;
    }
    return `${cut.replace(/[-.]+$/, '')}-${hashName(encoder.encode(name))}`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most bytes, in UTF-8, that an image name may have. */
const MAX_NAME_BYTES = 100;

/** The bytes that a cut name's hash takes: a hyphen and 8 hex digits. */
const HASH_SUFFIX_BYTES = 9;

/** Returns a 32-bit FNV-1a hash of the bytes, as 8 hex digits. */
function hashName(bytes: Uint8Array): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
        hash ^= bytes[i];
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
