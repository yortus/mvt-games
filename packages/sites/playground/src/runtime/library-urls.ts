import { LIBRARIES, LIBRARY_MANIFEST, SANDBOX_RUNNER, toLibraryEntryName } from '../../libraries';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where the sandbox loads each library from, and the runner. */
export interface LibraryUrls {
    /** Each library's specifier, and the URL of its module, for the import map. */
    readonly libraries: Readonly<Record<string, string>>;
    readonly runnerUrl: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Finds the URL of each library's module. In development, Vite serves each
 * entry module in `libraries/entries/` as it is. In a build, each is a chunk
 * with a hashed name, which the build's manifest lists. The URLs are whole,
 * with the page's origin, since the sandbox's own origin is opaque.
 */
export async function findLibraryUrls(): Promise<LibraryUrls> {
    const base = new URL(import.meta.env.BASE_URL, location.href);
    const urlOf = import.meta.env.DEV
        ? (name: string) => new URL(`libraries/entries/${name}.ts`, base).href
        : await readManifest(base);
    const libraries: Record<string, string> = {};
    for (const specifier of LIBRARIES) libraries[specifier] = urlOf(toLibraryEntryName(specifier));
    return { libraries, runnerUrl: urlOf(SANDBOX_RUNNER) };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function readManifest(base: URL): Promise<(name: string) => string> {
    const response = await fetch(new URL(LIBRARY_MANIFEST, base));
    const manifest = await response.json() as Record<string, { readonly file: string }>;
    return (name) => new URL(manifest[`libraries/entries/${name}.ts`].file, base).href;
}
