import { readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve, sep } from 'node:path';
import type { SnapshotRequest } from '../shared';
import { isVisualTestFile } from './find-visual-tests.ts';
import { createReferenceJobs, type TestId } from './reference-jobs.ts';
import { createSnapshotEdit } from './snapshot-edit.ts';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PreviewApiOptions {
    /** The package whose test files the API may change. It refuses any other file. */
    readonly packageRoot: string;
    /** The path its requests start with, such as `/puzzles/__view-preview/api/`. */
    readonly path: string;
    /** Returns the address the server serves a file at, for a reference image. */
    readonly toFileUrl: (path: string) => string;
    /** Returns the ids of the tuning objects that a test file imports, however indirectly. */
    readonly findTunings: (testFile: string) => readonly string[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the server's handler for the preview's requests, as a Connect
 * middleware, which passes on every other request.
 *
 * - `POST snapshot`, with a `SnapshotRequest`, adds the snapshot test to its
 *   file, and starts writing its reference image. The page in a browser
 *   sends it. In VS Code, the extension edits the file itself.
 * - `POST reference`, with a test's file and name, starts writing its
 *   reference image. The extension sends it once it has saved a snapshot.
 * - `GET reference?file=...&name=...` returns how the writing is going, with
 *   the image's address once it's written.
 * - `GET tunings?file=...` returns the ids of the tuning objects that a test
 *   file imports, however indirectly.
 */
export function createPreviewApi(options: PreviewApiOptions): (request: IncomingMessage, response: ServerResponse, next: () => void) => void {
    const { packageRoot, path, toFileUrl, findTunings } = options;
    const jobs = createReferenceJobs();

    /** Returns a test file's full path, after checking that it's one of the package's visual test files. */
    const checkTestFile = (file: unknown): string => {
        const full = typeof file === 'string' ? resolve(file).replace(/^[a-z]:/, (drive) => drive.toUpperCase()) : '';
        if (!full.startsWith(packageRoot + sep) || !isVisualTestFile(full)) throw new Error(`${String(file)} isn't one of the visual test files the preview shows.`);
        return full;
    };

    const handle = async (route: string, url: URL, request: IncomingMessage): Promise<unknown> => {
        if (route === 'POST snapshot') {
            const body = await readJson(request) as SnapshotRequest;
            const file = checkTestFile(body.file);
            const code = readFileSync(file, 'utf8');
            const edit = createSnapshotEdit({ code, request: { ...body, file } });
            if (edit.kind === 'insert') {
                writeFileSync(file, code.slice(0, edit.offset) + edit.text + code.slice(edit.offset));
                jobs.start({ file, name: body.name.trim() });
            }
            return edit;
        }
        if (route === 'POST reference') {
            const body = await readJson(request) as TestId;
            jobs.start({ file: checkTestFile(body.file), name: body.name });
            return { state: 'running' };
        }
        if (route === 'GET reference') {
            const status = jobs.statusOf({ file: checkTestFile(url.searchParams.get('file')), name: url.searchParams.get('name') ?? '' });
            if (status === undefined) return { state: 'none' };
            return status.state === 'written' ? { state: 'written', imageUrl: `${toFileUrl(status.image)}?t=${Math.round(status.modifiedMs)}` } : status;
        }
        if (route === 'GET tunings') return { ids: findTunings(checkTestFile(url.searchParams.get('file'))) };
        throw new Error(`The preview's server doesn't answer ${route}.`);
    };

    return (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith(path)) {
            next();
            return;
        }
        const route = `${request.method ?? 'GET'} ${url.pathname.slice(path.length)}`;
        const send = (status: number, body: unknown): void => {
            response.statusCode = status;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(body));
        };
        handle(route, url, request).then((body) => send(200, body), (error: unknown) => send(400, { error: error instanceof Error ? error.message : String(error) }));
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function readJson(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
