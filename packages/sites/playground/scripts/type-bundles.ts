import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { LIBRARIES, type TypeBundleKind } from '../libraries';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One bundle of declaration files: each file's text, by its path in the language service's virtual file system. */
export type TypeBundle = Readonly<Record<string, string>>;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Makes the type bundles the playground's language service loads, one for
 * each kind: TypeScript's own libs, the `@mvtjs` libraries and the
 * `playground` module (their declarations emitted from their sources), and
 * Pixi, three.js and GSAP with the packages their types import (from
 * `node_modules`). Paths are laid out as a project's would be, so the
 * language service resolves imports as it would on disk.
 */
export function makeTypeBundles(): Record<TypeBundleKind, TypeBundle> {
    const emitted = emitDeclarations();
    return {
        typescript: readTypeScriptLibs(),
        mvtjs: emitted.mvtjs,
        playground: emitted.playground,
        pixi: readPackages(['pixi.js', ...dependencyTypesOf('pixi.js')], { 'pixi.js': ['lib'] }),
        // `build` holds what `import 'three'` resolves to, through the package's `exports`
        three: readPackages(['@types/three', '@types/webxr'], { '@types/three': ['build', 'src', 'index.d.ts'] }),
        gsap: readPackages(['gsap'], { gsap: ['types'] }),
    };
}

/** A short hash of a bundle's contents, for a file name that changes only when the bundle does. */
export function hashBundle(bundle: TypeBundle): string {
    return createHash('sha256').update(JSON.stringify(bundle)).digest('hex').slice(0, 10);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const REPO = resolve(import.meta.dirname, '../../../..');
const NODE_MODULES = join(REPO, 'node_modules');
const PLAYGROUND = resolve(import.meta.dirname, '..');
const LIBRARY_ROOT = join(REPO, 'packages/libraries');

/** TypeScript's libs for ES2022 and the DOM, and every lib they reference. */
function readTypeScriptLibs(): TypeBundle {
    const libs: Record<string, string> = {};
    const pending = ['es2022', 'dom', 'dom.iterable'];
    while (pending.length > 0) {
        const name = pending.pop()!;
        const file = `lib.${name}.d.ts`;
        if (libs[`/${file}`] !== undefined) continue;
        const text = readFileSync(join(NODE_MODULES, 'typescript/lib', file), 'utf8');
        libs[`/${file}`] = text;
        for (const match of text.matchAll(/<reference lib="([^"]+)"/g)) pending.push(match[1].toLowerCase());
    }
    return libs;
}

/** The packages a package's types may import: each dependency with types of its own, or its `@types` package. */
function dependencyTypesOf(name: string): string[] {
    const manifest = JSON.parse(readFileSync(join(NODE_MODULES, name, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    const found: string[] = [];
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        if (hasDeclarations(join(NODE_MODULES, dependency))) found.push(dependency);
        if (existsSync(join(NODE_MODULES, '@types', dependency))) found.push(`@types/${dependency}`);
    }
    return found;
}

/** Each package's `package.json` and declaration files, from the folders named for it, or all of it. */
function readPackages(names: readonly string[], folders: Readonly<Record<string, readonly string[]>>): TypeBundle {
    const bundle: Record<string, string> = {};
    for (const name of names) {
        const dir = join(NODE_MODULES, name);
        bundle[`/node_modules/${name}/package.json`] = readFileSync(join(dir, 'package.json'), 'utf8');
        for (const part of folders[name] ?? ['.']) {
            walk(join(dir, part), (path) => {
                if (path.endsWith('.d.ts') || path.endsWith('.d.mts')) bundle[`/node_modules/${name}/${relative(dir, path).replaceAll('\\', '/')}`] = readFileSync(path, 'utf8');
            });
        }
    }
    return bundle;
}

/**
 * The entries a project can't import, but whose declarations the libraries'
 * own declarations import. The JSX runtimes' types are built on
 * `@mvtjs/utils/jsx`, so without it they would quietly become `any`.
 */
const SUPPORTING_ENTRIES: readonly string[] = ['@mvtjs/utils/jsx'];

/**
 * Emits the declarations of the `@mvtjs` libraries and of the `playground`
 * module from their sources, in one program, so their imports of each other
 * resolve. Each library gets a `package.json` whose `exports` name the
 * declarations of the entries a project may import, and of the supporting
 * entries their declarations import.
 */
function emitDeclarations(): { mvtjs: TypeBundle; playground: TypeBundle } {
    const packages = ['utils', 'pixi', 'html', 'three', 'chiptune'];
    const entries: string[] = [];
    const exportsOf: Record<string, Record<string, { types: string }>> = {};
    for (const name of packages) {
        const manifest = JSON.parse(readFileSync(join(LIBRARY_ROOT, name, 'package.json'), 'utf8')) as {
            exports: Record<string, Record<string, string>>;
        };
        exportsOf[name] = {};
        for (const [subpath, conditions] of Object.entries(manifest.exports)) {
            const specifier = subpath === '.' ? `@mvtjs/${name}` : `@mvtjs/${name}/${subpath.slice(2)}`;
            if (!(LIBRARIES as readonly string[]).includes(specifier) && !SUPPORTING_ENTRIES.includes(specifier)) continue;
            const source = conditions['@mvtjs/source'];
            entries.push(join(LIBRARY_ROOT, name, source));
            exportsOf[name][subpath] = { types: source.replace(/\.tsx?$/, '.d.ts') };
        }
    }
    const playgroundEntry = join(PLAYGROUND, 'src/project-api/index.ts');
    entries.push(playgroundEntry);

    const program = ts.createProgram({
        rootNames: entries,
        options: {
            declaration: true,
            emitDeclarationOnly: true,
            skipLibCheck: true,
            strict: true,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            customConditions: ['@mvtjs/source'],
            jsx: ts.JsxEmit.ReactJSX,
            lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
            types: ['vite/client'],
            allowImportingTsExtensions: true,
        },
    });
    const mvtjs: Record<string, string> = {};
    const playground: Record<string, string> = {};
    program.emit(undefined, (fileName, text) => {
        const path = resolve(fileName);
        for (const name of packages) {
            const packageDir = join(LIBRARY_ROOT, name);
            if (path.startsWith(packageDir + '\\') || path.startsWith(packageDir + '/')) {
                mvtjs[`/node_modules/@mvtjs/${name}/${relative(packageDir, path).replaceAll('\\', '/')}`] = text;
                return;
            }
        }
        const apiDir = dirname(playgroundEntry);
        if (path.startsWith(apiDir)) playground[`/node_modules/playground/${relative(apiDir, path).replaceAll('\\', '/')}`] = text;
    });
    for (const name of packages) {
        mvtjs[`/node_modules/@mvtjs/${name}/package.json`] = JSON.stringify({ name: `@mvtjs/${name}`, type: 'module', exports: exportsOf[name] });
    }
    playground['/node_modules/playground/package.json'] = JSON.stringify({ name: 'playground', type: 'module', types: './index.d.ts' });
    return { mvtjs, playground };
}

function hasDeclarations(dir: string): boolean {
    if (!existsSync(join(dir, 'package.json'))) return false;
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { types?: string; typings?: string };
    return manifest.types !== undefined || manifest.typings !== undefined || existsSync(join(dir, 'index.d.ts'));
}

function walk(path: string, visit: (path: string) => void): void {
    if (!existsSync(path)) return;
    if (!statSync(path).isDirectory()) {
        visit(path);
        return;
    }
    for (const name of readdirSync(path)) {
        if (name === 'node_modules') continue;
        walk(join(path, name), visit);
    }
}
