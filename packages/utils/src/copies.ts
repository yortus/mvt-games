// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The version of what copies of the @mvtjs packages share in one program: the
 * `_mvt` fields the scene passes keep on nodes, and the objects made with
 * {@link shareAcrossCopies}. Copies with the same protocol share them; copies
 * with different ones keep apart.
 *
 * Bump it with any change to their layout or meaning, and rename the `_mvt`
 * fields in the same change, so that copies that disagree never read each
 * other's fields. `_mvtProtocol` alone keeps its name, so that every copy can
 * recognise a node set up by another.
 */
export const PROTOCOL = 1;

/**
 * One object for every copy of a package loaded in a program with the same
 * {@link PROTOCOL}: the first copy to ask makes it with `create`, and later
 * copies get that one. Kept on `host`, under a key made from `name` and the
 * protocol.
 *
 * A program can load two copies of a package: the same version twice (a
 * bundler reaching it by two paths), or two versions (a dependency nesting
 * its own). Whatever a package keeps at module level is then per copy, and
 * the copies quietly disagree. Keeping that state in a shared object makes
 * them agree.
 *
 * `host` decides what "a program" is. A package's own state goes on
 * `globalThis`. A renderer package's goes on the prototype it extends, such
 * as Pixi's `Container.prototype`, so that it is shared by every copy that
 * extends that prototype, and by nothing else: a second copy of the renderer
 * library itself has its own prototype, and needs its own state.
 *
 * The first copy's `create` runs, so with two versions loaded, the first one's
 * code makes the object; {@link registerCopy} warns of that.
 */
export function shareAcrossCopies<T extends object>(host: object, name: string, create: () => T): T {
    const key = Symbol.for(`mvtjs:${name}:v${PROTOCOL}`);
    const slots = host as Record<symbol, T | undefined>;
    let shared = slots[key];
    if (shared === undefined) {
        shared = create();
        Object.defineProperty(host, key, { value: shared, configurable: true });
    }
    return shared;
}

/**
 * Records that a copy of the package `name`, at `version`, has loaded, and
 * warns once if a copy of it at another version, or with another protocol,
 * already has. Each package calls it once, at module load. Two copies of the
 * same version share everything through {@link shareAcrossCopies}, so they
 * load silently.
 *
 * The record is kept on `globalThis` under a key that never changes, so that
 * every copy, whatever its protocol, can find the others.
 */
export function registerCopy(name: string, version: string): void {
    const registry = copyRegistry();
    let other: LoadedCopy | undefined;
    for (let i = 0; i < registry.copies.length; i++) {
        const copy = registry.copies[i];
        if (copy.name === name && (copy.version !== version || copy.protocol !== PROTOCOL)) other = copy;
    }
    registry.copies.push({ name, version, protocol: PROTOCOL });
    if (other === undefined || registry.warned.has(name)) return;
    registry.warned.add(name);
    if (other.protocol === PROTOCOL) {
        console.warn(
            `[mvt] Two copies of ${name} are loaded: ${other.version} and ${version}. They share one core, `
            + `made by the copy loaded first (${other.version}), so changes in the other do not apply. ${DEDUPE_ADVICE}`,
        );
    }
    else {
        console.warn(
            `[mvt] Two incompatible copies of ${name} are loaded: ${other.version} and ${version}. They share no `
            + `state, so a view set up by one is not ticked by the other. ${DEDUPE_ADVICE}`,
        );
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A copy of a package that has called {@link registerCopy}. */
interface LoadedCopy {
    readonly name: string;
    readonly version: string;
    readonly protocol: number;
}

/** Every copy loaded so far, and the packages already warned about. Its layout never changes. */
interface CopyRegistry {
    readonly copies: LoadedCopy[];
    readonly warned: Set<string>;
}

const DEDUPE_ADVICE = 'Keep one copy: run `npm dedupe`, add npm `overrides`, or list the packages in Vite\'s `resolve.dedupe`.';

function copyRegistry(): CopyRegistry {
    const key = Symbol.for('mvtjs:copies');
    const slots = globalThis as Record<symbol, CopyRegistry | undefined>;
    let registry = slots[key];
    if (registry === undefined) {
        registry = { copies: [], warned: new Set() };
        Object.defineProperty(globalThis, key, { value: registry, configurable: true });
    }
    return registry;
}
