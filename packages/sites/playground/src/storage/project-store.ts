import type { OldPlaygroundCode, ProjectFile } from '../runtime';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A project as the browser keeps it between visits. */
export interface SavedProject {
    readonly name: string;
    readonly files: readonly ProjectFile[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The project the visitor last worked on, if the browser kept one. */
export function loadSavedProject(): SavedProject | undefined {
    const data = readJson(PROJECT_KEY) as { name?: unknown; files?: unknown } | undefined;
    if (data === undefined || typeof data.name !== 'string' || !Array.isArray(data.files)) return undefined;
    const files: ProjectFile[] = [];
    for (const file of data.files as { path?: unknown; text?: unknown }[]) {
        if (typeof file?.path !== 'string' || typeof file.text !== 'string') return undefined;
        files.push({ path: file.path, text: file.text });
    }
    return { name: data.name, files };
}

/** Keeps the project for the visitor's next visit. Does nothing where the browser keeps nothing. */
export function saveProject(project: SavedProject): void {
    try {
        localStorage.setItem(PROJECT_KEY, JSON.stringify({ name: project.name, files: project.files }));
    }
    catch {
        // Storage is off or full. The project stays open, unsaved.
    }
}

/** The project the old playground kept, if the browser still has it and no new one was saved. */
export function loadOldPlaygroundProject(): OldPlaygroundCode | undefined {
    const data = readJson(OLD_PROJECT_KEY) as { m?: unknown; v?: unknown; w?: unknown; h?: unknown } | undefined;
    if (data === undefined || typeof data.m !== 'string' || typeof data.v !== 'string') return undefined;
    return {
        modelCode: data.m,
        viewCode: data.v,
        canvasWidth: typeof data.w === 'number' ? data.w : 400,
        canvasHeight: typeof data.h === 'number' ? data.h : 400,
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PROJECT_KEY = 'mvt-playground-project';
/** Where the old playground kept its one project. */
const OLD_PROJECT_KEY = 'mvt-playground-custom';

function readJson(key: string): unknown {
    try {
        const text = localStorage.getItem(key);
        return text === null ? undefined : JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
