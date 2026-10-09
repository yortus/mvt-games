import { commands } from 'vitest/browser';
import { expect } from 'vitest';
import { toPictureName } from './picture-name';
import type { VisualCommands, VisualKind, VisualScope, VisualSession, VisualVerdict } from '../protocol';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The visual tests' browser commands, given their types from `VisualCommands`. */
export const visualCommands = commands as unknown as VisualCommands;

/**
 * Returns the name of the running test's picture, with the test's full name.
 * The picture's name is the file name of its reference. It joins the test's
 * describe blocks and its name.
 */
export function nameCurrentPicture(): { readonly name: string; readonly test: string } {
    const test = expect.getState().currentTestName ?? 'unnamed';
    return { name: toPictureName(test), test };
}

/**
 * Returns the session for a scope, which holds the hashes of the references
 * in scope. The scope is the running test file, or a calibration set. The
 * page asks Node for each scope's session only once, and keeps it.
 */
export function openSession(scope: VisualScope): Promise<VisualSession> {
    const key = scope.calibration !== undefined ? `calibration-${scope.calibration}` : expect.getState().testPath ?? '';
    let session = sessions.get(key);
    if (session === undefined) {
        session = visualCommands.openVisualSession(scope);
        sessions.set(key, session);
    }
    return session;
}

/**
 * Returns a picture's hash, which is made from its size and the SHA-256 of
 * its pixels. It is the same hash that Node computes in `src/node/png.ts`.
 */
export async function hashPixels(width: number, height: number, pixels: Uint8Array): Promise<string> {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels as Uint8Array<ArrayBuffer>));
    let hex = '';
    for (let i = 0; i < 16; i++) hex += digest[i].toString(16).padStart(2, '0');
    return `${width}x${height}:${hex}`;
}

export function toBase64(bytes: Uint8Array): string {
    return (bytes as Uint8Array & { toBase64: () => string }).toBase64();
}

/**
 * Returns whether a verdict passes. It passes when the picture is identical
 * to its reference, is within the tolerance, or was just written as the
 * reference.
 */
export function isPass(verdict: VisualVerdict): boolean {
    return verdict.outcome === 'same' || verdict.outcome === 'within-tolerance' || verdict.outcome === 'updated';
}

/**
 * Describes how much of a picture differs, and where. For example, it
 * returns '36 pixels, by up to 219 of 255, in the 2x18 pixels at (120, 40)'.
 */
export function describeDifference(verdict: VisualVerdict): string {
    const rect = verdict.changedRect;
    const where = rect === undefined ? '' : `, in the ${rect.width}x${rect.height} pixels at (${rect.x}, ${rect.y})`;
    return `${verdict.changed} pixels, by up to ${verdict.maxDelta} of 255${where}`;
}

/**
 * Returns the error message for a failed picture. It says what differs,
 * where to look, and what to run.
 */
export function describeFailure(name: string, verdict: VisualVerdict, kind: VisualKind): string {
    // The filter uses the picture name, which has no spaces or shell
    // characters. So nothing in it is lost when npm passes it on.
    const filter = `--picture ${toPictureName(name)}`;
    switch (verdict.outcome) {
        case 'new':
            return `Picture '${name}' is new. Run \`npm run test:visual:update -- ${filter}\`, and review ${verdict.actualFile ?? verdict.referenceFile}.`;
        case 'size':
            return `Picture '${name}' changed size from ${verdict.referenceSize}. See ${verdict.actualFile}.`;
        default: {
            const where = `The reference is ${verdict.referenceFile}, the actual picture is ${verdict.actualFile}, and the diff is ${verdict.diffFile}`;
            const kindNote = kind === 'html' ? ' (HTML text is drawn blank, so only layout and styling show)' : '';
            return `Picture '${name}' differs from its reference in ${describeDifference(verdict)}${kindNote}. ${where}. If the change is intended, run \`npm run test:visual:update -- ${filter}\`.`;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const sessions = new Map<string, Promise<VisualSession>>();
