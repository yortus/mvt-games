import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { deserialize, serialize } from 'node:v8';

// ---------------------------------------------------------------------------
// A cache shared by one suite run's processes, for a Node suite's cases
// ---------------------------------------------------------------------------

/**
 * A value that is slow to build and the same for every case that asks for
 * it, such as a tank filled with grains: built by the first process of a
 * suite run that needs it, and loaded by the rest. The driver gives each
 * suite run a fresh directory (`MVT_BENCH_CACHE_DIR`), and every process of
 * the run executes the same bundle, so a cached value can never come from
 * other code. Run outside the driver, the value is built every time.
 *
 * `key` names the value among the run's others, and must say everything the
 * value depends on. The value must survive `node:v8`'s structured clone:
 * plain objects, arrays, typed arrays and primitives do, functions do not.
 */
export function cached<T>(key: string, build: () => T): T {
    const dir = process.env.MVT_BENCH_CACHE_DIR;
    if (dir === undefined) return build();
    const file = join(dir, `${key}.v8`);
    if (existsSync(file)) return deserialize(readFileSync(file)) as T;
    const value = build();
    // Written whole, then renamed, so a process that runs alongside never reads half a file
    const partial = `${file}.${process.pid}.partial`;
    writeFileSync(partial, serialize(value));
    renameSync(partial, file);
    return value;
}
