/**
 * The reference pictures on disk: finding them, and checking that each
 * one's pixels still match the hash it carries.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng, hashPicture, readPngHash } from './png';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Every reference picture under a directory: the PNGs in `__screenshots__` directories. */
export function findReferences(dir: string): { readonly file: string; readonly bytes: number }[] {
    return find(dir, false);
}

/**
 * What is wrong with a reference file, or undefined if nothing is: a run
 * trusts the hash a reference carries without decoding it, so a file whose
 * pixels were edited, or that carries no hash, would pass unnoticed.
 */
export function checkReference(file: string): string | undefined {
    const stored = readPngHash(file);
    if (stored === undefined) return 'carries no pixel hash (not written by the visual tests)';
    let actual: string;
    try {
        actual = hashPicture(decodePng(readFileSync(file)));
    }
    catch (error) {
        return `cannot be decoded: ${error instanceof Error ? error.message : String(error)}`;
    }
    return actual === stored ? undefined : `pixels hash to ${actual}, but the file says ${stored}`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function find(dir: string, isReference: boolean): { file: string; bytes: number }[] {
    const found: { file: string; bytes: number }[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...find(path, isReference || entry.name === '__screenshots__'));
        else if (isReference && entry.name.endsWith('.png')) found.push({ file: path, bytes: statSync(path).size });
    }
    return found;
}
