/**
 * Functions for the reference pictures on disk. They find the references,
 * and check that each one's pixels still match the hash it carries. They
 * also find and remove the references that no picture was compared with.
 */

import { readdirSync, readFileSync, rmdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { decodePng, hashPicture, readPngHash } from './png';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns the directory of a test file's references, which is `__screenshots__/<the file's name>/` beside it. */
export function findReferenceDir(testFile: string): string {
    return join(dirname(testFile), '__screenshots__', basename(testFile));
}

/** Returns every reference picture under a directory, which means every PNG in a `__screenshots__` directory. */
export function findReferences(dir: string): { readonly file: string; readonly bytes: number }[] {
    return find(dir, false);
}

/**
 * Returns what is wrong with a reference file, or undefined if nothing is.
 * A visual run trusts the hash a reference carries, without decoding the
 * file. So a file whose pixels were edited, or that carries no hash, would
 * pass the run unnoticed.
 */
export function checkReference(file: string): string | undefined {
    const stored = readPngHash(file);
    if (stored === undefined) return 'carries no pixel hash, so the visual tests did not write it';
    let actual: string;
    try {
        actual = hashPicture(decodePng(readFileSync(file)));
    }
    catch (error) {
        return `cannot be decoded (${error instanceof Error ? error.message : String(error)})`;
    }
    return actual === stored ? undefined : `its pixels hash to ${actual}, but the hash it carries is ${stored}`;
}

/**
 * Returns the references, of those given, that no picture was compared
 * with. After a full run, in which every test ran, these are the files of
 * tests that were renamed or deleted.
 */
export function findOrphans(options: { readonly references: readonly string[]; readonly compared: Iterable<string> }): string[] {
    const compared = new Set<string>();
    for (const file of options.compared) compared.add(toFileKey(file));
    return options.references.filter((file) => !compared.has(toFileKey(file)));
}

/**
 * Deletes a reference. If that leaves its test file's directory empty, it
 * deletes that too, and then `__screenshots__` if that is also left empty.
 */
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

/**
 * Returns a path in a form that can be compared. The path is resolved. On
 * Windows, where paths ignore case, it is also lower-cased, because Vitest
 * writes paths as `V:/...` and Node writes them as `v:\...`.
 */
function toFileKey(file: string): string {
    const resolved = resolve(file);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function find(dir: string, isReference: boolean): { file: string; bytes: number }[] {
    const found: { file: string; bytes: number }[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory() && isSkipped(entry.name)) continue;
        if (entry.isDirectory()) found.push(...find(path, isReference || entry.name === '__screenshots__'));
        else if (isReference && entry.name.endsWith('.png')) found.push({ file: path, bytes: statSync(path).size });
    }
    return found;
}

/** Returns whether a folder holds no references: installed packages, build output, and hidden folders such as `.git`. */
function isSkipped(name: string): boolean {
    return name === 'node_modules' || name === 'dist' || name.startsWith('.');
}
