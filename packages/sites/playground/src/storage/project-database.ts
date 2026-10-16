import type { ProjectSummary } from '../models';
import type { ProjectFile } from '../runtime';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A project the visitor keeps, as the browser stores it. */
export interface StoredProject {
    readonly id: string;
    readonly name: string;
    readonly files: readonly ProjectFile[];
    /** When it was last saved, in milliseconds since 1970. */
    readonly savedAt: number;
    /** Whether the playground keeps its barrels. A project saved before it could is taken to. */
    readonly isBarrelKept?: boolean;
    /** What the project is. A project saved before it could have one has none. */
    readonly description?: string;
}

/** The projects the visitor keeps in this browser. */
export interface ProjectDatabase {
    /** Whether the projects outlast the page. Where the browser keeps nothing, they are kept in memory only. */
    readonly isKept: boolean;
    /** Every project, the one saved last first. */
    readonly list: () => Promise<readonly ProjectSummary[]>;
    readonly load: (id: string) => Promise<StoredProject | undefined>;
    /** Saves a project, in place of one with the same id. */
    readonly save: (project: StoredProject) => Promise<void>;
    readonly remove: (id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ProjectDatabaseOptions {
    /** The browser's IndexedDB, or a stand-in for one in tests. */
    readonly indexedDB: IDBFactory;
    /** The database's name. The default is the playground's own. */
    readonly name?: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Opens the playground's projects in IndexedDB, or a database in memory
 * where IndexedDB cannot be opened, as where the visitor blocks the site's
 * storage. The database has a name of its own, apart from the Arcade's, on
 * the same origin.
 */
export async function openProjectDatabase(options: ProjectDatabaseOptions): Promise<ProjectDatabase> {
    try {
        return createIndexedProjectDatabase(await openDatabase(options.indexedDB, options.name ?? DATABASE_NAME));
    }
    catch {
        return createMemoryProjectDatabase();
    }
}

/** A database kept in memory, which lasts as long as the page. */
export function createMemoryProjectDatabase(): ProjectDatabase {
    const projects = new Map<string, StoredProject>();
    return {
        isKept: false,
        list: async () => toSummaries([...projects.values()]),
        load: async (id) => projects.get(id),
        save: async (project) => {
            projects.set(project.id, project);
        },
        remove: async (id) => {
            projects.delete(id);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DATABASE_NAME = 'mvt-playground';
const STORE_NAME = 'projects';
const DATABASE_VERSION = 1;

function createIndexedProjectDatabase(database: IDBDatabase): ProjectDatabase {
    return {
        isKept: true,
        list: async () => toSummaries(await request<StoredProject[]>(database, 'readonly', (store) => store.getAll())),
        load: async (id) => readProject(await request<unknown>(database, 'readonly', (store) => store.get(id))),
        save: async (project) => {
            await request(database, 'readwrite', (store) => store.put(toRecord(project)));
        },
        remove: async (id) => {
            await request(database, 'readwrite', (store) => store.delete(id));
        },
    };
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const opening = factory.open(name, DATABASE_VERSION);
        opening.onupgradeneeded = () => {
            opening.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error ?? new Error(`Could not open ${name}`));
        opening.onblocked = () => reject(new Error(`${name} is open in an older version elsewhere`));
    });
}

/** Runs one request in a transaction of its own, and gives its result once the transaction is done. */
function request<T>(database: IDBDatabase, mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const pending = make(transaction.objectStore(STORE_NAME));
        transaction.oncomplete = () => resolve(pending.result as T);
        transaction.onerror = () => reject(transaction.error ?? new Error('A project database request failed'));
        transaction.onabort = () => reject(transaction.error ?? new Error('A project database request was stopped'));
    });
}

/** A plain copy, as IndexedDB stores it: no frozen arrays or other objects it would refuse. */
function toRecord(project: StoredProject): StoredProject {
    return {
        id: project.id,
        name: project.name,
        files: project.files.map((file) => ({ path: file.path, text: file.text })),
        savedAt: project.savedAt,
        isBarrelKept: project.isBarrelKept ?? true,
        description: project.description ?? '',
    };
}

/** A stored project, or undefined where what was stored is not one, as an older or damaged record. */
function readProject(value: unknown): StoredProject | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const { id, name, files, savedAt, isBarrelKept, description } = value as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof savedAt !== 'number' || !Array.isArray(files)) return undefined;
    const projectFiles: ProjectFile[] = [];
    for (const file of files as { path?: unknown; text?: unknown }[]) {
        if (typeof file?.path !== 'string' || typeof file.text !== 'string') return undefined;
        projectFiles.push({ path: file.path, text: file.text });
    }
    return { id, name, files: projectFiles, savedAt, isBarrelKept: isBarrelKept !== false, description: typeof description === 'string' ? description : '' };
}

function toSummaries(projects: readonly unknown[]): ProjectSummary[] {
    const summaries: ProjectSummary[] = [];
    for (const value of projects) {
        const project = readProject(value);
        if (project === undefined) continue;
        summaries.push({ id: project.id, name: project.name, description: project.description ?? '', savedAt: project.savedAt, fileCount: project.files.length });
    }
    return summaries.sort((a, b) => b.savedAt - a.savedAt);
}
