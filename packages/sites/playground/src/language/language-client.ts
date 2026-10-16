import * as Comlink from 'comlink';
import type {
    CompletionDetails,
    CompletionEntry,
    CompletionList,
    DefinitionTarget,
    FileEdit,
    QuickInfo,
    SignatureHelp,
    TypeProblem,
} from './language-types';
import type { ProjectLanguageService, ServiceFile } from './project-language-service';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The page's side of the language service, which runs in a worker. Each
 * call first sends the worker the project's files, if they have changed
 * since the last call. Until the worker has loaded TypeScript and the
 * project, every call gives undefined, or nothing, so the editor works as a
 * plain text editor meanwhile.
 */
export interface LanguageClient {
    /** Whether the worker has loaded TypeScript and the project. */
    readonly isReady: boolean;
    /** Starts the worker. Does nothing after the first call. */
    readonly start: () => void;
    readonly diagnostics: () => Promise<readonly TypeProblem[] | undefined>;
    readonly completions: (path: string, offset: number) => Promise<CompletionList | undefined>;
    readonly completionDetails: (path: string, offset: number, entry: CompletionEntry) => Promise<CompletionDetails | undefined>;
    readonly quickInfo: (path: string, offset: number) => Promise<QuickInfo | undefined>;
    readonly signatureHelp: (path: string, offset: number) => Promise<SignatureHelp | undefined>;
    readonly definition: (path: string, offset: number) => Promise<DefinitionTarget | undefined>;
    /** The edits that rename what is at the offset in every file, or why it cannot be renamed. */
    readonly rename: (path: string, offset: number, newName: string) => Promise<readonly FileEdit[] | string>;
    readonly organizeImports: (path: string) => Promise<readonly FileEdit[]>;
    readonly format: (path: string) => Promise<readonly FileEdit[]>;
    readonly libraryFileText: (path: string) => Promise<string | undefined>;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LanguageClientOptions {
    /** The project's files as they are now. A new array means they have changed. */
    readonly files: () => readonly ServiceFile[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a client whose worker has not started yet. */
export function createLanguageClient(options: LanguageClientOptions): LanguageClient {
    let remote: Comlink.Remote<ProjectLanguageService> | undefined;
    let isReady = false;
    let sentFiles: readonly ServiceFile[] | undefined;
    /** The sync in progress, so calls made meanwhile wait for it rather than send the files again. */
    let syncing: Promise<void> = Promise.resolve();

    const client: LanguageClient = {
        get isReady() { return isReady; },

        start() {
            if (remote !== undefined) return;
            const worker = new Worker(new URL('./language-worker.ts', import.meta.url), { type: 'module' });
            remote = Comlink.wrap<ProjectLanguageService>(worker);
            void sync().then(() => {
                isReady = true;
            });
        },

        diagnostics: async () => (await ready()) ? remote!.diagnostics() : undefined,
        completions: async (path, offset) => (await ready()) ? remote!.completions(path, offset) : undefined,
        completionDetails: async (path, offset, entry) => (await ready()) ? remote!.completionDetails(path, offset, entry) : undefined,
        quickInfo: async (path, offset) => (await ready()) ? remote!.quickInfo(path, offset) : undefined,
        signatureHelp: async (path, offset) => (await ready()) ? remote!.signatureHelp(path, offset) : undefined,
        definition: async (path, offset) => (await ready()) ? remote!.definition(path, offset) : undefined,
        rename: async (path, offset, newName) => (await ready()) ? remote!.rename(path, offset, newName) : 'The language service is still loading.',
        organizeImports: async (path) => (await ready()) ? remote!.organizeImports(path) : [],
        format: async (path) => (await ready()) ? remote!.format(path) : [],
        libraryFileText: async (path) => (await ready()) ? remote!.libraryFileText(path) : undefined,
    };

    return client;

    /** Whether the worker is ready, once the files it has are the project's as they are now. */
    async function ready(): Promise<boolean> {
        if (!isReady) return false;
        await sync();
        return true;
    }

    /** Sends the worker the project's files, if they have changed since they were last sent. */
    function sync(): Promise<void> {
        syncing = syncing.then(async () => {
            const files = options.files();
            if (files === sentFiles || remote === undefined) return;
            await remote.setFiles(files);
            sentFiles = files;
        });
        return syncing;
    }
}
