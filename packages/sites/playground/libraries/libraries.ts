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
    '@mvtjs/pixi',
    '@mvtjs/pixi/jsx-runtime',
    '@mvtjs/html',
    '@mvtjs/html/jsx-runtime',
    '@mvtjs/three',
    '@mvtjs/three/jsx-runtime',
    '@mvtjs/chiptune',
    'pixi.js',
    'three',
    'gsap',
] as const;

export type LibrarySpecifier = (typeof LIBRARIES)[number];

/** What each library is for, in a sentence, as the playground's Help lists them. */
export const LIBRARY_SUMMARIES: Readonly<Record<LibrarySpecifier, string>> = {
    'playground': 'Tells the playground about your project, with `definePixiProject` and friends.',
    '@mvtjs/utils': 'Handy helpers that work with any renderer, such as `watch` and tweens.',
    '@mvtjs/pixi': 'Lets you write Pixi views in JSX, and give them update and refresh methods.',
    '@mvtjs/pixi/jsx-runtime': "What your Pixi JSX turns into. You won't need to import it yourself.",
    '@mvtjs/html': 'Lets you write HTML views in JSX, and give them update and refresh methods.',
    '@mvtjs/html/jsx-runtime': "What your HTML JSX turns into. You won't need to import it yourself.",
    '@mvtjs/three': 'Lets you write three.js views in JSX, and give them update and refresh methods.',
    '@mvtjs/three/jsx-runtime': "What your three.js JSX turns into. You won't need to import it yourself.",
    '@mvtjs/chiptune': 'A little sound chip, for music and sound effects.',
    'pixi.js': 'Fast 2D drawing, with sprites, shapes and text.',
    'three': '3D scenes, with cameras, lights and meshes.',
    'gsap': 'Smooth animation, with tweens and timelines.',
};

/**
 * The bundles of declaration files the editor's language service loads.
 * `typescript`, `mvtjs` and `playground` are small, and always loaded. Each
 * of the others loads the first time a project imports its library.
 */
export const TYPE_BUNDLE_KINDS = ['typescript', 'mvtjs', 'playground', 'pixi', 'three', 'gsap'] as const;

export type TypeBundleKind = (typeof TYPE_BUNDLE_KINDS)[number];

/** The bundles always loaded, whatever a project imports. */
export const BASE_TYPE_BUNDLES: readonly TypeBundleKind[] = ['typescript', 'mvtjs', 'playground'];

/**
 * The bundles a library's types need, besides the base ones. `@mvtjs/pixi`
 * needs Pixi's, for one. The `playground` module's types name both Pixi's
 * and three.js's, but it needs neither: with `skipLibCheck`, a type it cannot
 * find is unknown, and reports no error. A project that uses that renderer
 * imports it, which loads its bundle.
 */
export const TYPE_BUNDLES_OF: Readonly<Record<LibrarySpecifier, readonly TypeBundleKind[]>> = {
    'playground': [],
    '@mvtjs/utils': [],
    '@mvtjs/pixi': ['pixi'],
    '@mvtjs/pixi/jsx-runtime': ['pixi'],
    '@mvtjs/html': [],
    '@mvtjs/html/jsx-runtime': [],
    '@mvtjs/three': ['three'],
    '@mvtjs/three/jsx-runtime': ['three'],
    '@mvtjs/chiptune': [],
    'pixi.js': ['pixi'],
    'three': ['three'],
    'gsap': ['gsap'],
};

/**
 * The packages an exported project depends on, by their names on npm: the
 * libraries a project may import, at the versions the playground runs. A
 * package not yet on npm is left out.
 */
export const EXPORT_DEPENDENCIES = ['@mvtjs/utils', '@mvtjs/pixi', '@mvtjs/html', '@mvtjs/three', '@mvtjs/chiptune', 'pixi.js', 'three', 'gsap'] as const;

/** What an exported project is built with, and three.js's types, which three.js does not include. */
export const EXPORT_DEV_DEPENDENCIES = ['typescript', 'vite', '@types/three'] as const;

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
