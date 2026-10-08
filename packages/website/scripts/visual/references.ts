/**
 * The reference pictures on disk: finding them, checking that each one's
 * pixels still match the hash it carries, and finding and removing those
 * no picture was compared with.
 */

import { readdirSync, readFileSync, rmdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { decodePng, hashPicture, readPngHash } from './png';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Where a test file's references are: `__screenshots__/<the file's name>/` beside it. */
export function referenceDirOf(testFile: string): string {
    return join(dirname(testFile), '__screenshots__', basename(testFile));
}

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

/**
 * The references no picture was compared with, of those given: the files
 * of tests renamed or deleted (in a full run, where every test ran).
 */
export function orphansOf(options: { readonly references: readonly string[]; readonly compared: Iterable<string> }): string[] {
    const compared = new Set<string>();
    for (const file of options.compared) compared.add(fileKey(file));
    return options.references.filter((file) => !compared.has(fileKey(file)));
}

/** Deletes a reference, and its test file's directory and `__screenshots__` if that leaves them empty. */
export function removeReference(file: string): void {
    rmSync(file);
    for (let dir = dirname(file), i = 0; i < 2; dir = dirname(dir), i++) {
        if (readdirSync(dir).length > 0) return;
        rmdirSync(dir);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A path to compare by: resolved, and on Windows, whose paths ignore case, lower-cased (Vitest's are `V:/...`, Node's `v:\...`). */
function fileKey(file: string): string {
    const resolved = resolve(file);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function find(dir: string, isReference: boolean): { file: string; bytes: number }[] {
    const found: { file: string; bytes: number }[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...find(path, isReference || entry.name === '__screenshots__'));
        else if (isReference && entry.name.endsWith('.png')) found.push({ file: path, bytes: statSync(path).size });
    }
    return found;
}
