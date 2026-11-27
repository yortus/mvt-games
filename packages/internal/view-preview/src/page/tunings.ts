import type { KnobValue, TuningField, TuningInfo } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A tuning object that registered with the page, and the object itself, whose fields the page changes. */
export interface RegisteredTuning {
    readonly info: TuningInfo;
    /** The object as the module declared it, which the page writes to without noting a read. */
    readonly tuning: object;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Notes a tuning object, and returns a stand-in for it that notes each field
 * the code reads (see `collectTuningReads`). Every tuning object in a module the
 * plugin instruments is passed through this as it's created, and the module
 * keeps the stand-in in its place. A field you changed before the page
 * reloaded is set again here, before any code reads it, as long as its
 * value in the file hasn't changed since.
 */
export function registerTuning<T extends object>(info: TuningInfo, tuning: T): T {
    registry.set(info.id, { info, tuning });
    for (const field of info.fields) {
        const saved = readSaved({ info, field });
        if (saved !== undefined) writePath(tuning, field.path, saved);
        noteKey({ tuning, path: field.path, key: fieldKey(info, field) });
    }
    return watchReads(tuning) as T;
}

/** Returns a tuning object that has registered, by its id, or `undefined` if its module hasn't run. */
export function findTuning(id: string): RegisteredTuning | undefined {
    return registry.get(id);
}

/** Returns the key that names a field across the page. It's the tuning object's id and the field's path, as `<id>:points.scout`. */
export function fieldKey(info: TuningInfo, field: TuningField): string {
    return `${info.id}:${field.path.join('.')}`;
}

/** Returns a field's value as the tuning object holds it now. */
export function readField(registered: RegisteredTuning, field: TuningField): KnobValue {
    let current: unknown = registered.tuning;
    for (const key of field.path) current = (current as Record<string, unknown>)[key];
    return current as KnobValue;
}

/** Sets a field, and keeps it for the browser's tab, so it survives a reload. Its value from the file resets it. */
export function writeField(options: { readonly registered: RegisteredTuning; readonly field: TuningField; readonly value: KnobValue }): void {
    const { registered, field, value } = options;
    writePath(registered.tuning, field.path, value);
    const key = storageKey({ info: registered.info, field });
    if (value === field.value) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify([field.value, value]));
}

/** Sets a field for a moment, without keeping it, and returns how to put it back. */
export function overrideField(options: { readonly registered: RegisteredTuning; readonly field: TuningField; readonly value: KnobValue }): () => void {
    const { registered, field, value } = options;
    const previous = readField(registered, field);
    writePath(registered.tuning, field.path, value);
    return () => writePath(registered.tuning, field.path, previous);
}

/**
 * Returns the keys of the fields the code has read since the last call, and
 * starts noting afresh. A key is `fieldKey`'s.
 */
export function collectTuningReads(): ReadonlySet<string> {
    const taken = reads.keys;
    reads.keys = new Set();
    return taken;
}

/** Returns the keys of the fields read since `collectTuningReads` was last called, without starting afresh. */
export function listTuningReads(): ReadonlySet<string> {
    return reads.keys;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const registry = new Map<string, RegisteredTuning>();

/** The key of each field, by the object that holds it and its own name, so a read finds its key without building a string. */
const keysByObject = new WeakMap<object, Map<PropertyKey, string>>();
/** The stand-in for each object and table, so a table read twice returns the same stand-in. */
const standIns = new WeakMap<object, object>();
const reads = { keys: new Set<string>() };

function noteKey(options: { readonly tuning: object; readonly path: readonly string[]; readonly key: string }): void {
    const { tuning, path, key } = options;
    let holder = tuning as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) holder = holder[path[i]] as Record<string, unknown>;
    let keys = keysByObject.get(holder);
    if (keys === undefined) {
        keys = new Map();
        keysByObject.set(holder, keys);
    }
    keys.set(path[path.length - 1], key);
}

/** Returns a stand-in for an object that notes each read of a field, and returns a stand-in for each table inside it. */
function watchReads(target: object): object {
    let standIn = standIns.get(target);
    if (standIn === undefined) {
        standIn = new Proxy(target, {
            get: (object, property, receiver) => {
                const value: unknown = Reflect.get(object, property, receiver);
                const key = keysByObject.get(object)?.get(property);
                if (key !== undefined) reads.keys.add(key);
                return typeof value === 'object' && value !== null ? watchReads(value) : value;
            },
        });
        standIns.set(target, standIn);
    }
    return standIn;
}

function writePath(tuning: object, path: readonly string[], value: KnobValue): void {
    let current = tuning as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) current = current[path[i]] as Record<string, unknown>;
    current[path[path.length - 1]] = value;
}

function storageKey(options: { readonly info: TuningInfo; readonly field: TuningField }): string {
    return `view-preview:tuning:${options.info.id}:${options.field.path.join('.')}`;
}

/** Returns the value you set on a field before a reload, if its value in the file is still the one it had then. */
function readSaved(options: { readonly info: TuningInfo; readonly field: TuningField }): KnobValue | undefined {
    const saved = sessionStorage.getItem(storageKey(options));
    if (saved === null) return undefined;
    const [initial, value] = JSON.parse(saved) as [KnobValue, KnobValue];
    return initial === options.field.value ? value : undefined;
}
