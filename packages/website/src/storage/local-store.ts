// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Text the browser keeps for the site between visits, by key: the visitor's
 * settings, their initials, their favourites and their saved games. Storage
 * can be blocked, as in a private window, or full. Then nothing is kept, and
 * nothing throws: a read finds nothing, and a write reports that it failed.
 */
export interface LocalStore {
    /** Returns the text kept at `key`. Returns undefined if none is, or if storage is blocked. */
    readonly read: (key: string) => string | undefined;
    /** Keeps `text` at `key`, in place of anything kept there. Returns whether it was kept. */
    readonly write: (key: string, text: string) => boolean;
    /** Forgets what is kept at `key`, if anything is. */
    readonly remove: (key: string) => void;
    /**
     * Returns the value kept at `key` as JSON, parsed. Returns undefined if
     * nothing is kept there, or if what is kept is not JSON. The caller
     * checks the value's shape, since an older version of the site may have
     * written it.
     */
    readonly readJson: (key: string) => unknown;
    /** Keeps `value` at `key`, as JSON. Returns whether it was kept. */
    readonly writeJson: (key: string, value: unknown) => boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a local store. */
export interface LocalStoreOptions {
    /**
     * Where the text is kept. Defaults to the browser's `localStorage`. A
     * test passes a `Storage` of its own.
     */
    readonly storage?: Storage;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a store over the browser's `localStorage`, or over
 * `options.storage`. Even reaching `localStorage` can throw where storage is
 * blocked, so the store reaches it on each call, and catches what it throws.
 */
export function createLocalStore(options: LocalStoreOptions = {}): LocalStore {
    const storageOf = (): Storage => options.storage ?? globalThis.localStorage;

    const store: LocalStore = {
        read(key) {
            try {
                return storageOf().getItem(key) ?? undefined;
            }
            catch {
                return undefined;
            }
        },
        write(key, text) {
            try {
                storageOf().setItem(key, text);
                return true;
            }
            catch {
                return false;
            }
        },
        remove(key) {
            try {
                storageOf().removeItem(key);
            }
            catch {
                // Storage is blocked, so nothing was kept there
            }
        },
        readJson(key) {
            const text = store.read(key);
            if (text === undefined) return undefined;
            try {
                return JSON.parse(text) as unknown;
            }
            catch {
                return undefined;
            }
        },
        writeJson(key, value) {
            let text: string;
            try {
                text = JSON.stringify(value);
            }
            catch {
                return false;
            }
            return store.write(key, text);
        },
    };

    return store;
}

/** Creates a store that keeps its text in memory, and forgets it when the page closes. For tests. */
export function createMemoryStore(): LocalStore {
    const texts = new Map<string, string>();
    return createLocalStore({
        storage: {
            get length() {
                return texts.size;
            },
            clear: () => texts.clear(),
            getItem: (key) => texts.get(key) ?? null, // eslint-disable-line @mvtjs/no-null -- Storage's own contract
            key: (index) => [...texts.keys()][index] ?? null, // eslint-disable-line @mvtjs/no-null -- Storage's own contract
            removeItem: (key) => { texts.delete(key); },
            setItem: (key, value) => { texts.set(key, value); },
        },
    });
}
