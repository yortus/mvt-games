import { commands } from 'vitest/browser';
import { expect } from 'vitest';
import { pictureName } from './picture-name';
import type { VisualCommands, VisualKind, VisualScope, VisualSession, VisualVerdict } from './protocol';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The visual tests' browser commands, typed. */
export const visualCommands = commands as unknown as VisualCommands;

/** The name of the running test's picture, the file name of its reference: its describe blocks and name, joined. */
export function pictureNameOfCurrentTest(): { readonly name: string; readonly test: string } {
    const test = expect.getState().currentTestName ?? 'unnamed';
    return { name: pictureName(test), test };
}

/** The references in scope (the running file's, or a calibration set's), asked for once per page. */
export function sessionFor(scope: VisualScope): Promise<VisualSession> {
    const key = scope.calibration !== undefined ? `calibration-${scope.calibration}` : expect.getState().testPath ?? '';
    let session = sessions.get(key);
    if (session === undefined) {
        session = visualCommands.visualSession(scope);
        sessions.set(key, session);
    }
    return session;
}

/** A picture's hash: its size and the SHA-256 of its pixels, as Node computes it (scripts/visual/png.ts). */
export async function hashPixels(width: number, height: number, pixels: Uint8Array): Promise<string> {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels as Uint8Array<ArrayBuffer>));
    let hex = '';
    for (let i = 0; i < 16; i++) hex += digest[i].toString(16).padStart(2, '0');
    return `${width}x${height}:${hex}`;
}

export function toBase64(bytes: Uint8Array): string {
    return (bytes as Uint8Array & { toBase64: () => string }).toBase64();
}

/** Whether a verdict passes: identical, within tolerance, or just written as the reference. */
export function isPass(verdict: VisualVerdict): boolean {
    return verdict.outcome === 'same' || verdict.outcome === 'within-tolerance' || verdict.outcome === 'updated';
}

/** What a failed picture's error says: what differs, where to look, and what to run. */
export function failureMessage(name: string, verdict: VisualVerdict, kind: VisualKind): string {
    const filter = `-t "${name}"`;
    switch (verdict.outcome) {
        case 'new':
            return `New picture '${name}': run \`npm run test:visual:update -- ${filter}\`, and review ${verdict.actualFile ?? verdict.referenceFile}`;
        case 'size':
            return `Picture '${name}' changed size, from ${verdict.referenceSize}: see ${verdict.actualFile}`;
        default: {
            const where = `reference ${verdict.referenceFile}, actual ${verdict.actualFile}, diff ${verdict.diffFile}`;
            const kindNote = kind === 'html' ? ' (HTML text is drawn blank, so only layout and styling show)' : '';
            return `Picture '${name}' differs: ${verdict.changed} pixels, by up to ${verdict.maxDelta} of 255${kindNote}. ${where}. If intended, run \`npm run test:visual:update -- ${filter}\``;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const sessions = new Map<string, Promise<VisualSession>>();
