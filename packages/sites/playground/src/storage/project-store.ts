import { toUniqueProjectName } from '../models';
import { convertOldCode, type OldPlaygroundCode, type ProjectFile } from '../runtime';
import type { ProjectDatabase } from './project-database';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MoveLocalProjectsOptions {
    readonly database: ProjectDatabase;
    /** The browser's `localStorage`, or a stand-in for one in tests. */
    readonly storage: Storage;
    /** Makes a new project's id. */
    readonly createId: () => string;
    /** The time now, in milliseconds since 1970, for the projects' `savedAt`. */
    readonly now: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Moves the projects that `localStorage` kept into the database, where the
 * playground keeps its projects now: the one project this playground kept
 * before it kept many, and the one the old playground kept, converted, as
 * "My first project". Each is removed from `localStorage` once the database
 * has it, and only where the database outlasts the page. Returns the id of
 * the one this playground kept, which the visitor last worked on, if there
 * was one.
 */
export async function moveLocalProjects(options: MoveLocalProjectsOptions): Promise<string | undefined> {
    const { database, storage, createId, now } = options;
    let lastId: string | undefined;
    // Each with a name no project kept already has
    const names = (await database.list()).map((p) => p.name);
    const old = readOldPlaygroundCode(storage);
    if (old !== undefined) {
        const name = toUniqueProjectName('My first project', names);
        names.push(name);
        await database.save({ id: createId(), name, files: convertOldCode(old), savedAt: now - 1 });
        if (database.isKept) removeItem(storage, OLD_PROJECT_KEY);
    }
    const kept = readKeptProject(storage);
    if (kept !== undefined) {
        lastId = createId();
        await database.save({ id: lastId, name: toUniqueProjectName(kept.name, names), files: kept.files, savedAt: now });
        if (database.isKept) removeItem(storage, PROJECT_KEY);
    }
    return lastId;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where this playground kept its one project, before it kept many. */
const PROJECT_KEY = 'mvt-playground-project';
/** Where the old playground kept its one project. */
const OLD_PROJECT_KEY = 'mvt-playground-custom';

function readKeptProject(storage: Storage): { name: string; files: ProjectFile[] } | undefined {
    const data = readJson(storage, PROJECT_KEY) as { name?: unknown; files?: unknown } | undefined;
    if (data === undefined || typeof data.name !== 'string' || !Array.isArray(data.files)) return undefined;
    const files: ProjectFile[] = [];
    for (const file of data.files as { path?: unknown; text?: unknown }[]) {
        if (typeof file?.path !== 'string' || typeof file.text !== 'string') return undefined;
        files.push({ path: file.path, text: file.text });
    }
    return { name: data.name, files };
}

function readOldPlaygroundCode(storage: Storage): OldPlaygroundCode | undefined {
    const data = readJson(storage, OLD_PROJECT_KEY) as { m?: unknown; v?: unknown; w?: unknown; h?: unknown } | undefined;
    if (data === undefined || typeof data.m !== 'string' || typeof data.v !== 'string') return undefined;
    return {
        modelCode: data.m,
        viewCode: data.v,
        canvasWidth: typeof data.w === 'number' ? data.w : 400,
        canvasHeight: typeof data.h === 'number' ? data.h : 400,
    };
}

function readJson(storage: Storage, key: string): unknown {
    try {
        const text = storage.getItem(key);
        return text === null ? undefined : JSON.parse(text);
    }
    catch {
        return undefined;
    }
}

function removeItem(storage: Storage, key: string): void {
    try {
        storage.removeItem(key);
    }
    catch {
        // Storage is off. The item stays, and moves again next visit, as a copy
    }
}
