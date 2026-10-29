import type { MutableWatched } from '../watched';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ReadingGuardOptions {
    readonly reading: unknown;
    readonly watched: readonly MutableWatched[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * For development only. Creates a function that wraps a watcher's reading in
 * fresh proxies on each poll, and marks the last poll's proxies stale, so a
 * reading kept past the next poll throws when it's used. It uses a flag
 * rather than a revocable proxy, so the error can say what went wrong.
 */
export function createReadingGuard(options: ReadingGuardOptions): () => unknown {
    const { reading, watched } = options;
    let poll: Poll = { isStale: false };
    return () => {
        poll.isStale = true;
        poll = { isStale: false };
        // Each `Watched` in a record's or an array's reading is handed out as a proxy too
        const proxies = new Map<unknown, unknown>();
        for (let i = 0; i < watched.length; i++) {
            if (watched[i] !== reading) proxies.set(watched[i], createGuardProxy({ target: watched[i], poll }));
        }
        return createGuardProxy({ target: reading as object, poll, proxies });
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Poll {
    isStale: boolean;
}

interface GuardProxyOptions {
    readonly target: object;
    readonly poll: Poll;
    readonly proxies?: ReadonlyMap<unknown, unknown>;
}

function createGuardProxy(options: GuardProxyOptions): object {
    const { target, poll, proxies } = options;
    return new Proxy(target, {
        get: (target, key) => {
            checkFresh(poll);
            const value: unknown = Reflect.get(target, key);
            return proxies?.get(value) ?? value;
        },
        has: (target, key) => {
            checkFresh(poll);
            return Reflect.has(target, key);
        },
        ownKeys: (target) => {
            checkFresh(poll);
            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor: (target, key) => {
            checkFresh(poll);
            return Reflect.getOwnPropertyDescriptor(target, key);
        },
        set: () => {
            throw new Error("watch: a reading can't be changed. It reports what the watcher read.");
        },
    });
}

function checkFresh(poll: Poll): void {
    if (poll.isStale) {
        throw new Error(
            'watch: this reading was kept past the next poll(). A watcher updates its reading in place on every '
            + 'poll, so a kept reading would report the wrong values. Use the reading in the step that polled, '
            + 'and copy out any values you need to keep.',
        );
    }
}
