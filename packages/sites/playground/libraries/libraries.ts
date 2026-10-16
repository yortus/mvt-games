// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Every package a project may import, by the specifier it imports. Each is
 * built as a module of its own, which the sandbox's import map names.
 */
export const LIBRARIES = [
    'playground',
    '@mvtjs/utils',
    '@mvtjs/utils/jsx',
    '@mvtjs/pixi',
    '@mvtjs/pixi/jsx-runtime',
    '@mvtjs/html',
    '@mvtjs/html/jsx-runtime',
    '@mvtjs/three',
    '@mvtjs/three/jsx-runtime',
    '@mvtjs/audio',
    'pixi.js',
    'three',
    'gsap',
] as const;

export type LibrarySpecifier = (typeof LIBRARIES)[number];

/** The module that runs a project inside the sandbox. It is built as a library's module is, but no project imports it. */
export const SANDBOX_RUNNER = 'sandbox-runner';

/** The name of the build's manifest, which says which chunk holds each library's module. */
export const LIBRARY_MANIFEST = 'library-manifest.json';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Whether a project may import a package by this specifier. */
export function isLibrary(specifier: string): specifier is LibrarySpecifier {
    return (LIBRARIES as readonly string[]).includes(specifier);
}

/**
 * The name of the module that holds a library, in `libraries/entries/`:
 * `@mvtjs/pixi/jsx-runtime` is `mvtjs-pixi-jsx-runtime`, and `pixi.js` is
 * `pixi-js`.
 */
export function toLibraryEntryName(specifier: string): string {
    return specifier.replace(/^@/, '').replace(/[/.]/g, '-');
}
