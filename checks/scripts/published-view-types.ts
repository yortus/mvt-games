// Checks that every entry point a renderer package publishes brings that
// renderer's view type into `View`, the type `updateView`, `refreshView` and
// the rest of the tick API take. If one does not, a program that imports only
// that entry point cannot pass the renderer's views to any of them: every
// call is a type error. It checks the built packages, reading their `dist/`
// and never their source, so `npm run build:packages` runs it after building
// them.
//
// Each case compiles a one-line program that imports one entry point, as
// published (no `@mvtjs/source` condition), and checks that the renderer's
// view type is a `View`. Each is its own program, since an augmentation from
// one would otherwise reach the others. The control case imports no renderer,
// and must fail, so that the check is known to be able to.
//
// Why an entry point can get this wrong: each renderer declares its view type
// with a module augmentation of `RendererViews`, in the module that registers
// the renderer. An augmentation reaches a program only when the declaration
// file holding it is part of that program, and a declaration file keeps an
// import only when its types need it. So every entry point must import its
// renderer's registering module itself, at least for its side effect.

import process from 'node:process';
import ts from 'typescript';

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

interface Case {
    /** The entry point, as a program imports it. */
    readonly entry: string;
    /** The renderer's view type: its import, and its name. */
    readonly viewImport: string;
    readonly viewName: string;
    /** Whether the renderer's view type should be a `View` after importing `entry`. */
    readonly expectView: boolean;
}

const ENTRY_SUFFIXES = ['', '/jsx-runtime', '/jsx-dev-runtime'];

const RENDERERS = [
    { name: '@mvtjs/pixi', viewImport: 'import type { Container } from \'pixi.js\';', viewName: 'Container' },
    { name: '@mvtjs/three', viewImport: 'import type { Object3D } from \'three\';', viewName: 'Object3D' },
    { name: '@mvtjs/html', viewImport: '', viewName: 'Element' },
];

const cases: Case[] = [
    // The control: no renderer, so no view type is a `View`
    { entry: '@mvtjs/utils', viewImport: RENDERERS[0].viewImport, viewName: 'Container', expectView: false },
];
for (const renderer of RENDERERS) {
    for (const suffix of ENTRY_SUFFIXES) {
        cases.push({ entry: renderer.name + suffix, viewImport: renderer.viewImport, viewName: renderer.viewName, expectView: true });
    }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const failures: string[] = [];
for (const c of cases) {
    const errors = compile(c);
    if (c.expectView && errors.length > 0) failures.push(`${c.entry}: ${c.viewName} is not a View.\n    ${errors.join('\n    ')}`);
    if (!c.expectView && errors.length === 0) failures.push(`${c.entry}: ${c.viewName} is a View with no renderer installed.`);
}

if (failures.length > 0) {
    process.stderr.write(`Published view types: ${failures.length} of ${cases.length} cases failed.\n${failures.join('\n')}\n`);
    process.exit(1);
}
process.stdout.write(`Published view types: all ${cases.length} cases passed.\n`);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Compiles one case's program, and returns its errors in the fixture. */
function compile(c: Case): string[] {
    // TypeScript names files with forward slashes, on Windows too
    const fileName = ts.sys.resolvePath(`${import.meta.dirname}/published-view-types.fixture.ts`).replaceAll('\\', '/');
    const source = [
        `import '${c.entry}';`,
        'import type { View } from \'@mvtjs/utils\';',
        c.viewImport,
        `export const isView: ${c.viewName} extends View ? true : false = true;`,
    ].join('\n');
    const options: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
        types: [],
        strict: true,
        noEmit: true,
        // The packages' own declarations are checked by their builds; this
        // checks only what reaches a program that imports them
        skipLibCheck: true,
    };
    const host = ts.createCompilerHost(options);
    const readFile = host.readFile.bind(host);
    const getSourceFile = host.getSourceFile.bind(host);
    host.readFile = (name) => (name === fileName ? source : readFile(name));
    host.fileExists = (name) => name === fileName || ts.sys.fileExists(name);
    host.getSourceFile = (name, languageVersion, onError) => (name === fileName
        ? ts.createSourceFile(name, source, languageVersion)
        : getSourceFile(name, languageVersion, onError));
    const program = ts.createProgram([fileName], options, host);
    const fixture = program.getSourceFile(fileName);
    // Without its fixture, a program has nothing to report, and every case would pass
    if (fixture === undefined) throw new Error(`the fixture was not compiled: ${fileName}`);
    const diagnostics = [
        ...program.getOptionsDiagnostics(),
        ...program.getSyntacticDiagnostics(fixture),
        ...program.getSemanticDiagnostics(fixture),
    ];
    return diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
}
