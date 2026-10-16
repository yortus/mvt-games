import type ts from 'typescript';
import { createSystem, createVirtualTypeScriptEnvironment, type VirtualTypeScriptEnvironment } from '@typescript/vfs';
import { BASE_TYPE_BUNDLES, isLibrary, LIBRARIES, TYPE_BUNDLES_OF, type TypeBundleKind } from '../../libraries';
import { resolveRelative } from '../runtime';
import type {
    CodeFix,
    CompletionDetails,
    CompletionEntry,
    CompletionList,
    DefinitionTarget,
    FileEdit,
    QuickInfo,
    SignatureHelp,
    TypeProblem,
} from './language-types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A project file, by its path from the project's root. */
export interface ServiceFile {
    readonly path: string;
    readonly text: string;
}

/** How the project is written, besides its files. */
export interface ServiceFileOptions {
    /**
     * Whether the playground keeps the project's barrels. While it does, an
     * import from another folder goes through that folder's barrel, and a
     * file never imports its own folder's barrel, or an ancestor's: the
     * diagnostics say where an import does not.
     */
    readonly isBarrelKept?: boolean;
}

/**
 * TypeScript's language service over a playground project: the project's
 * files, TypeScript's libs, and the type bundles of the libraries the project
 * imports. Paths are the project's (`models/ball-model.ts`), and a library's
 * declarations are named by their path in the service's own files
 * (`/node_modules/pixi.js/lib/index.d.ts`). Offsets count characters from a
 * file's start.
 */
export interface ProjectLanguageService {
    /** Brings the service's copy of the project up to date, and loads the type bundles its imports need. */
    readonly setFiles: (files: readonly ServiceFile[], options?: ServiceFileOptions) => Promise<void>;
    /** Every type error and warning in the project, with fixes where TypeScript has them. */
    readonly diagnostics: () => readonly TypeProblem[];
    readonly completions: (path: string, offset: number) => CompletionList | undefined;
    readonly completionDetails: (path: string, offset: number, entry: CompletionEntry) => CompletionDetails | undefined;
    readonly quickInfo: (path: string, offset: number) => QuickInfo | undefined;
    readonly signatureHelp: (path: string, offset: number) => SignatureHelp | undefined;
    readonly definition: (path: string, offset: number) => DefinitionTarget | undefined;
    /** The edits that rename what is at the offset, in every file, or why it cannot be renamed. */
    readonly rename: (path: string, offset: number, newName: string) => readonly FileEdit[] | string;
    readonly organizeImports: (path: string) => readonly FileEdit[];
    /**
     * Each folder's barrel, as the playground keeps it: for each folder with
     * code in it, an `index.ts` that names everything its files export, and
     * everything its subfolders' barrels do, a line for each.
     */
    readonly keptBarrels: () => readonly ServiceFile[];
    /** The edits that update each import of a file or folder, as it moves to a new path. */
    readonly fileRenameEdits: (oldPath: string, newPath: string) => readonly FileEdit[];
    readonly format: (path: string) => readonly FileEdit[];
    /** A library's declaration file's text, by its path, as a definition names it. */
    readonly libraryFileText: (path: string) => string | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ProjectLanguageServiceOptions {
    /** The TypeScript compiler, which the caller loads. */
    readonly ts: typeof ts;
    /** Loads a type bundle: each declaration file's text, by its path. */
    readonly loadBundle: (kind: TypeBundleKind) => Promise<Readonly<Record<string, string>>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a language service with no project yet. `setFiles` gives it one. */
export function createProjectLanguageService(options: ProjectLanguageServiceOptions): ProjectLanguageService {
    const { ts: tsc, loadBundle } = options;
    const bundles = new Map<TypeBundleKind, Readonly<Record<string, string>>>();
    let env: VirtualTypeScriptEnvironment | undefined;
    let envBundles = '';
    let envRenderer = '';
    let texts = new Map<string, string>();
    let isBarrelKept = false;

    // TypeScript's defaults, such as a space after each comma, which a setting left out would turn off
    const formatOptions: ts.FormatCodeSettings = {
        ...tsc.getDefaultFormatCodeSettings('\n'),
        indentSize: 4,
        tabSize: 4,
        convertTabsToSpaces: true,
        newLineCharacter: '\n',
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
        semicolons: tsc.SemicolonPreference.Insert,
    };
    const preferences: ts.UserPreferences = {
        includeCompletionsForModuleExports: true,
        includeCompletionsWithInsertText: true,
        includeAutomaticOptionalChainCompletions: true,
        importModuleSpecifierPreference: 'shortest',
        quotePreference: 'single',
    };

    const service: ProjectLanguageService = {
        async setFiles(files, fileOptions) {
            isBarrelKept = fileOptions?.isBarrelKept ?? false;
            const wanted = wantedBundles(files);
            for (const kind of wanted) {
                if (!bundles.has(kind)) bundles.set(kind, await loadBundle(kind));
            }
            const bundleKey = [...bundles.keys()].sort().join(',');
            const renderer = rendererOf(files);
            const next = new Map(files.map((f) => [toServicePath(f.path), f.text]));
            const isRemoval = [...texts.keys()].some((path) => !next.has(path));
            if (env === undefined || bundleKey !== envBundles || renderer !== envRenderer || isRemoval) {
                env = createEnvironment(next, renderer);
                envBundles = bundleKey;
                envRenderer = renderer;
            }
            else {
                for (const [path, text] of next) {
                    if (!texts.has(path)) env.createFile(path, toServiceText(text));
                    else if (texts.get(path) !== text) env.updateFile(path, toServiceText(text));
                }
            }
            texts = next;
        },

        diagnostics() {
            if (env === undefined) return [];
            const found: TypeProblem[] = [];
            for (const path of texts.keys()) {
                const all = [
                    ...env.languageService.getSyntacticDiagnostics(path),
                    ...env.languageService.getSemanticDiagnostics(path),
                ];
                for (const d of all) {
                    if (d.start === undefined || d.file === undefined) continue;
                    if (d.category !== tsc.DiagnosticCategory.Error && d.category !== tsc.DiagnosticCategory.Warning) continue;
                    const place = d.file.getLineAndCharacterOfPosition(d.start);
                    found.push({
                        path: toProjectPath(path),
                        line: place.line + 1,
                        column: place.character + 1,
                        start: d.start,
                        length: d.length ?? 0,
                        message: tsc.flattenDiagnosticMessageText(d.messageText, '\n'),
                        severity: d.category === tsc.DiagnosticCategory.Error ? 'error' : 'warning',
                        fixes: found.length < MAX_FIXED_PROBLEMS ? fixesFor(path, d) : [],
                    });
                }
            }
            if (isBarrelKept) found.push(...barrelImportProblems());
            return found;
        },

        keptBarrels() {
            const program = env?.languageService.getProgram();
            if (program === undefined) return [];
            const checker = program.getTypeChecker();
            const paths = [...texts.keys()].map(toProjectPath);
            const codePaths = paths.filter((path) => /\.tsx?$/.test(path) && !isIndexFile(path) && path.includes('/'));
            const folders = new Set<string>();
            for (const path of codePaths) {
                for (let folder = folderOf(path); folder !== ''; folder = folderOf(folder)) folders.add(folder);
            }
            // The deepest first, so each folder's subfolders' names are known
            const ordered = [...folders].sort((a, b) => b.split('/').length - a.split('/').length || a.localeCompare(b));
            const namesOf = new Map<string, readonly ExportedName[]>();
            const barrels: ServiceFile[] = [];
            for (const folder of ordered) {
                const sources: { specifier: string; names: readonly ExportedName[] }[] = [];
                for (const path of codePaths) {
                    if (folderOf(path) === folder) sources.push({ specifier: `./${path.slice(folder.length + 1).replace(/\.tsx?$/, '')}`, names: exportedNames(program, checker, path) });
                }
                for (const sub of folders) {
                    if (folderOf(sub) === folder) sources.push({ specifier: `./${sub.slice(folder.length + 1)}`, names: namesOf.get(sub) ?? [] });
                }
                sources.sort((a, b) => a.specifier.localeCompare(b.specifier));
                const lines: string[] = [];
                const all: ExportedName[] = [];
                for (const { specifier, names } of sources) {
                    if (names.length === 0) continue;
                    lines.push(`export { ${names.map((n) => (n.isType ? `type ${n.name}` : n.name)).join(', ')} } from '${specifier}';`);
                    all.push(...names);
                }
                namesOf.set(folder, all);
                barrels.push({ path: `${folder}/index.ts`, text: lines.length === 0 ? '' : `${lines.join('\n')}\n` });
            }
            return barrels.sort((a, b) => a.path.localeCompare(b.path));
        },

        fileRenameEdits(oldPath, newPath) {
            if (env === undefined) return [];
            return toEdits(env.languageService.getEditsForFileRename(toServicePath(oldPath), toServicePath(newPath), formatOptions, preferences));
        },

        completions(path, offset) {
            const servicePath = toServicePath(path);
            const pathStart = importPathStartAt(servicePath, offset);
            if (pathStart !== undefined) {
                const typed = texts.get(servicePath)?.slice(pathStart, offset) ?? '';
                const projectPaths = [...texts.keys()].map(toProjectPath);
                return { isMemberCompletion: false, replaceFrom: pathStart, entries: importPathCompletions(path, typed, projectPaths) };
            }
            const info = env?.languageService.getCompletionsAtPosition(servicePath, offset, preferences);
            if (info === undefined) return undefined;
            // The list can run to thousands, with the DOM's names. Only those that
            // start as the word being typed does are sent, and the editor matches
            // the rest of the word itself.
            const typed = /[\w$]*$/.exec(texts.get(servicePath)?.slice(0, offset) ?? '')?.[0] ?? '';
            const first = typed.slice(0, 1).toLowerCase();
            const entries: CompletionEntry[] = [];
            for (const e of info.entries) {
                if (entries.length >= MAX_COMPLETIONS) break;
                if (first !== '' && !e.name.toLowerCase().startsWith(first)) continue;
                entries.push({ name: e.name, kind: e.kind, sortText: e.sortText, source: e.source, data: e.data, insertText: e.insertText });
            }
            return { isMemberCompletion: info.isMemberCompletion, entries };
        },

        completionDetails(path, offset, entry) {
            const details = env?.languageService.getCompletionEntryDetails(
                toServicePath(path), offset, entry.name, formatOptions, entry.source, preferences, entry.data as ts.CompletionEntryData | undefined,
            );
            if (details === undefined) return undefined;
            return {
                displayText: tsc.displayPartsToString(details.displayParts),
                documentation: tsc.displayPartsToString(details.documentation),
                edits: toEdits(details.codeActions?.flatMap((a) => a.changes) ?? []),
            };
        },

        quickInfo(path, offset) {
            const info = env?.languageService.getQuickInfoAtPosition(toServicePath(path), offset);
            if (info === undefined) return undefined;
            return {
                start: info.textSpan.start,
                length: info.textSpan.length,
                displayText: tsc.displayPartsToString(info.displayParts),
                documentation: tsc.displayPartsToString(info.documentation),
            };
        },

        signatureHelp(path, offset) {
            const help = env?.languageService.getSignatureHelpItems(toServicePath(path), offset, undefined);
            const item = help?.items[help.selectedItemIndex];
            if (help === undefined || item === undefined) return undefined;
            let label = tsc.displayPartsToString(item.prefixDisplayParts);
            let activeStart: number | undefined;
            let activeEnd: number | undefined;
            const separator = tsc.displayPartsToString(item.separatorDisplayParts);
            item.parameters.forEach((parameter, i) => {
                if (i > 0) label += separator;
                const text = tsc.displayPartsToString(parameter.displayParts);
                if (i === help.argumentIndex) {
                    activeStart = label.length;
                    activeEnd = label.length + text.length;
                }
                label += text;
            });
            label += tsc.displayPartsToString(item.suffixDisplayParts);
            return { label, activeStart, activeEnd, documentation: tsc.displayPartsToString(item.documentation) };
        },

        definition(path, offset) {
            const definitions = env?.languageService.getDefinitionAtPosition(toServicePath(path), offset);
            const first = definitions?.[0];
            if (env === undefined || first === undefined) return undefined;
            const file = env.languageService.getProgram()?.getSourceFile(first.fileName);
            const place = file?.getLineAndCharacterOfPosition(first.textSpan.start) ?? { line: 0, character: 0 };
            const isLibrary = !texts.has(first.fileName);
            return {
                path: isLibrary ? first.fileName : toProjectPath(first.fileName),
                line: place.line + 1,
                column: place.character + 1,
                isLibrary,
            };
        },

        rename(path, offset, newName) {
            if (env === undefined) return 'The language service is not ready yet.';
            const servicePath = toServicePath(path);
            const info = env.languageService.getRenameInfo(servicePath, offset, { allowRenameOfImportPath: false });
            if (!info.canRename) return info.localizedErrorMessage;
            // No prefix or suffix text, which would keep a re-exported name with an alias: a rename here renames everywhere
            const locations = env.languageService.findRenameLocations(servicePath, offset, false, false, { providePrefixAndSuffixTextForRename: false }) ?? [];
            const edits: FileEdit[] = [];
            for (const location of locations) {
                // A rename changes the project, never a library's declarations
                if (!texts.has(location.fileName)) continue;
                edits.push({
                    path: toProjectPath(location.fileName),
                    start: location.textSpan.start,
                    end: location.textSpan.start + location.textSpan.length,
                    newText: `${location.prefixText ?? ''}${newName}${location.suffixText ?? ''}`,
                });
            }
            return edits;
        },

        organizeImports(path) {
            const servicePath = toServicePath(path);
            const text = texts.get(servicePath);
            if (env === undefined || text === undefined) return [];
            // TypeScript keeps imports apart where a blank line parts them. Here they
            // are one block: the blank lines go, then TypeScript sorts and merges them
            const joined = withoutBlankLinesBetweenImports(text);
            env.updateFile(servicePath, toServiceText(joined));
            try {
                const changes = env.languageService.organizeImports({ type: 'file', fileName: servicePath }, formatOptions, preferences);
                const organised = applyTextChanges(joined, changes.filter((c) => c.fileName === servicePath).flatMap((c) => c.textChanges));
                return organised === text ? [] : [toOneEdit(path, text, organised)];
            }
            finally {
                env.updateFile(servicePath, toServiceText(text));
            }
        },

        format(path) {
            const servicePath = toServicePath(path);
            const changes = env?.languageService.getFormattingEditsForDocument(servicePath, formatOptions) ?? [];
            return toEdits([{ fileName: servicePath, textChanges: changes }]);
        },

        libraryFileText(path) {
            return env?.sys.readFile(path);
        },
    };

    return service;

    function createEnvironment(files: ReadonlyMap<string, string>, renderer: string): VirtualTypeScriptEnvironment {
        const fsMap = new Map<string, string>();
        for (const bundle of bundles.values()) {
            for (const [path, text] of Object.entries(bundle)) fsMap.set(path, text);
        }
        for (const [path, text] of files) fsMap.set(path, toServiceText(text));
        const compilerOptions: ts.CompilerOptions = {
            target: tsc.ScriptTarget.ES2022,
            module: tsc.ModuleKind.ESNext,
            moduleResolution: tsc.ModuleResolutionKind.Bundler,
            strict: true,
            jsx: tsc.JsxEmit.ReactJSX,
            jsxImportSource: `@mvtjs/${renderer}`,
            lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
            skipLibCheck: true,
            noEmit: true,
            types: [],
            allowImportingTsExtensions: true,
        };
        return createVirtualTypeScriptEnvironment(createSystem(fsMap), [...files.keys()], tsc, compilerOptions);
    }

    function fixesFor(path: string, diagnostic: ts.Diagnostic): CodeFix[] {
        if (env === undefined || diagnostic.start === undefined) return [];
        const end = diagnostic.start + (diagnostic.length ?? 0);
        try {
            const fixes = env.languageService.getCodeFixesAtPosition(path, diagnostic.start, end, [diagnostic.code], formatOptions, preferences);
            return fixes.map((fix) => ({ description: fix.description, edits: toEdits(fix.changes) }));
        }
        catch {
            // A fix TypeScript cannot make for this diagnostic is no fix
            return [];
        }
    }

    /**
     * Where the text of an import's path begins, if the offset is inside
     * one: in `import ... from '...'`, `export ... from '...'`, `import '...'`,
     * or `import('...')`, in code or in a type.
     */
    function importPathStartAt(servicePath: string, offset: number): number | undefined {
        const source = env?.languageService.getProgram()?.getSourceFile(servicePath);
        if (source === undefined) return undefined;
        let found: number | undefined;
        const visit = (node: ts.Node): void => {
            if (found !== undefined || offset <= node.getStart(source) || offset > node.end) return;
            if (tsc.isStringLiteralLike(node) && isImportPath(node)) found = node.getStart(source) + 1;
            else tsc.forEachChild(node, visit);
        };
        tsc.forEachChild(source, visit);
        return found;
    }

    function isImportPath(node: ts.StringLiteralLike): boolean {
        const parent = node.parent;
        if ((tsc.isImportDeclaration(parent) || tsc.isExportDeclaration(parent)) && parent.moduleSpecifier === node) return true;
        if (tsc.isCallExpression(parent) && parent.expression.kind === tsc.SyntaxKind.ImportKeyword) return true;
        return tsc.isLiteralTypeNode(parent) && tsc.isImportTypeNode(parent.parent);
    }

    /**
     * Each import, or export from, that breaks the barrel rule: one that goes
     * past a folder's barrel, from outside the folder, with a fix that
     * imports the barrel; and one of the file's own folder's barrel, or an
     * ancestor's.
     */
    function barrelImportProblems(): TypeProblem[] {
        const program = env?.languageService.getProgram();
        if (program === undefined) return [];
        const paths = new Set([...texts.keys()].map(toProjectPath));
        const barrelFolders = new Set<string>();
        for (const path of paths) if (isIndexFile(path) && path.includes('/')) barrelFolders.add(folderOf(path));
        const problems: TypeProblem[] = [];
        for (const path of paths) {
            const source = program.getSourceFile(toServicePath(path));
            if (source === undefined) continue;
            const from = folderOf(path);
            for (const statement of source.statements) {
                if (!(tsc.isImportDeclaration(statement) || tsc.isExportDeclaration(statement))) continue;
                const specifier = statement.moduleSpecifier;
                if (specifier === undefined || !tsc.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
                const target = resolveRelative(path, specifier.text, paths);
                if (target === undefined) continue;
                const barrelOf = isIndexFile(target) ? folderOf(target) : undefined;
                // The outermost folder with a barrel that holds the target, but not this file
                let wanted: string | undefined;
                for (const folder of foldersOf(target)) {
                    if (barrelFolders.has(folder) && !isInside(from, folder)) {
                        wanted = folder;
                        break;
                    }
                }
                const start = specifier.getStart(source);
                const place = source.getLineAndCharacterOfPosition(start);
                const at = { path, line: place.line + 1, column: place.character + 1, start, length: specifier.getWidth(source), severity: 'error' as const };
                if (wanted !== undefined && barrelOf !== wanted) {
                    const barrel = toRelativePath(from, wanted);
                    problems.push({
                        ...at,
                        message: `Import from '${barrel}', the barrel of ${wanted}/: from outside a folder, only its barrel is imported.`,
                        fixes: [{ description: `Import from '${barrel}'`, edits: [{ path, start: start + 1, end: specifier.getEnd() - 1, newText: barrel }] }],
                    });
                }
                else if (barrelOf !== undefined && isInside(from, barrelOf)) {
                    problems.push({
                        ...at,
                        message: `Import the file itself: a file in ${barrelOf}/ does not import its own folder's barrel.`,
                        fixes: [],
                    });
                }
            }
        }
        return problems;
    }

    /** What a project file exports, by name, sorted as a barrel lists them: by name, whatever its case. A default export has no name, and is left out. */
    function exportedNames(program: ts.Program, checker: ts.TypeChecker, path: string): ExportedName[] {
        const source = program.getSourceFile(toServicePath(path));
        const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);
        if (module === undefined) return [];
        const names: ExportedName[] = [];
        for (const symbol of checker.getExportsOfModule(module)) {
            if (symbol.name === 'default') continue;
            const resolved = (symbol.flags & tsc.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
            names.push({ name: symbol.name, isType: (resolved.flags & tsc.SymbolFlags.Value) === 0 });
        }
        return names.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.name.localeCompare(b.name));
    }

    /** A file's text, with no blank line between the imports it starts with. A comment between them stays. */
    function withoutBlankLinesBetweenImports(text: string): string {
        const source = tsc.createSourceFile('file.tsx', text, tsc.ScriptTarget.ES2022, true);
        let last: ts.Statement | undefined;
        for (const statement of source.statements) {
            if (!tsc.isImportDeclaration(statement)) break;
            last = statement;
        }
        if (last === undefined) return text;
        const start = source.statements[0].getStart(source);
        return text.slice(0, start) + text.slice(start, last.end).replace(/\n[ \t]*(?=\r?\n)/g, '') + text.slice(last.end);
    }

    function toEdits(changes: readonly ts.FileTextChanges[]): FileEdit[] {
        const edits: FileEdit[] = [];
        for (const change of changes) {
            if (!texts.has(change.fileName) && !change.isNewFile) continue;
            for (const textChange of change.textChanges) {
                edits.push({
                    path: toProjectPath(change.fileName),
                    start: textChange.span.start,
                    end: textChange.span.start + textChange.span.length,
                    newText: textChange.newText,
                });
            }
        }
        return edits;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most problems that get fixes, since finding them takes time. */
const MAX_FIXED_PROBLEMS = 50;
/** The most completions sent to the editor. */
const MAX_COMPLETIONS = 600;

/**
 * What can go in an import's path, from a file: the libraries, and the
 * project's other files and folders, relative to it. A folder with an
 * `index.ts` is offered by its own path, and the files in it are not, from
 * outside it: imports go through the index. Files are offered without
 * `.ts` or `.tsx`, as they are imported. Once the visitor has typed a `.`,
 * folders rank first, then files, then libraries; before that, libraries
 * rank first.
 */
function importPathCompletions(fromPath: string, typed: string, projectPaths: readonly string[]): CompletionEntry[] {
    const isRelative = typed.startsWith('.');
    const ranks = isRelative ? { folder: '0', file: '1', library: '2' } : { library: '0', folder: '1', file: '2' };
    const entries: CompletionEntry[] = [];
    for (const library of LIBRARIES) {
        // A JSX runtime is imported by a view's pragma, never by hand
        if (library.endsWith('/jsx-runtime')) continue;
        entries.push({ name: library, kind: 'external module name', sortText: ranks.library });
    }
    const fromFolder = folderOf(fromPath);
    const indexedFolders = new Set<string>();
    for (const path of projectPaths) if (/(^|\/)index\.tsx?$/.test(path)) indexedFolders.add(folderOf(path));
    const isInside = (folder: string, outer: string): boolean => `${folder}/`.startsWith(`${outer}/`);
    const offered = new Set<string>();
    for (const path of projectPaths) {
        if (path === fromPath) continue;
        const folder = folderOf(path);
        const isIndex = /(^|\/)index\.tsx?$/.test(path);
        // A folder's own files import each other directly, not through its index
        if (isIndex && isInside(fromFolder, folder)) continue;
        // From outside a folder with an index, only the index's folder is offered
        if (!isIndex && [...indexedFolders].some((f) => f !== '' && isInside(folder, f) && !isInside(fromFolder, f))) continue;
        const relative = toRelativePath(fromFolder, isIndex ? folder : path.replace(/\.tsx?$/, ''));
        if (offered.has(relative)) continue;
        offered.add(relative);
        entries.push({ name: relative, kind: isIndex ? 'directory' : 'script', sortText: isIndex ? ranks.folder : ranks.file });
    }
    return entries;
}

/** A name a module exports, and whether it is a type only. */
interface ExportedName {
    readonly name: string;
    readonly isType: boolean;
}

function isIndexFile(path: string): boolean {
    return /(^|\/)index\.tsx?$/.test(path);
}

/** Whether a folder is another, or inside it. The root, '', holds every folder. */
function isInside(folder: string, outer: string): boolean {
    return outer === '' || `${folder}/`.startsWith(`${outer}/`);
}

/** The folders a path is in, the outermost first, the root left out: `a/b/c.ts` is in `a`, then `a/b`. */
function foldersOf(path: string): string[] {
    const parts = path.split('/').slice(0, -1);
    return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}

/** A path's folder, or '' at the project's root. */
function folderOf(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
}

/** The path from a folder to a file or folder, as an import writes it: `./ball-view`, `../models`. */
function toRelativePath(fromFolder: string, to: string): string {
    const from = fromFolder === '' ? [] : fromFolder.split('/');
    const parts = to.split('/');
    let shared = 0;
    while (shared < from.length && shared < parts.length && from[shared] === parts[shared]) shared++;
    const up = from.length - shared;
    const rest = parts.slice(shared).join('/');
    return up === 0 ? `./${rest}` : `${'../'.repeat(up)}${rest}`;
}

const IMPORT_SPECIFIER = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

/** The type bundles a project's imports need, the base ones included. */
function wantedBundles(files: readonly ServiceFile[]): Set<TypeBundleKind> {
    const wanted = new Set<TypeBundleKind>(BASE_TYPE_BUNDLES);
    for (const file of files) {
        for (const match of file.text.matchAll(IMPORT_SPECIFIER)) {
            const specifier = match[1];
            if (isLibrary(specifier)) for (const kind of TYPE_BUNDLES_OF[specifier]) wanted.add(kind);
        }
        // A view's JSX pragma names a renderer's runtime too
        for (const match of file.text.matchAll(/@jsxImportSource\s+(\S+)/g)) {
            const runtime = `${match[1]}/jsx-runtime`;
            if (isLibrary(runtime)) for (const kind of TYPE_BUNDLES_OF[runtime]) wanted.add(kind);
        }
    }
    // A .tsx file with no pragma takes its JSX from the project's renderer
    if (files.some((f) => f.path.endsWith('.tsx'))) {
        const runtime = `@mvtjs/${rendererOf(files)}/jsx-runtime`;
        if (isLibrary(runtime)) for (const kind of TYPE_BUNDLES_OF[runtime]) wanted.add(kind);
    }
    return wanted;
}

/** The renderer whose JSX a `.tsx` file with no pragma uses: the one `main.ts` defines its project with. */
function rendererOf(files: readonly ServiceFile[]): string {
    const main = files.find((f) => f.path === 'main.ts')?.text ?? '';
    const match = /\bdefine(Pixi|Html|Three)Project\b/.exec(main);
    return match === null ? 'pixi' : match[1].toLowerCase();
}

/** A text with TypeScript's changes made, from the last, so each change's place still holds. */
function applyTextChanges(text: string, changes: readonly ts.TextChange[]): string {
    let result = text;
    for (const change of [...changes].sort((a, b) => b.span.start - a.span.start)) {
        result = result.slice(0, change.span.start) + change.newText + result.slice(change.span.start + change.span.length);
    }
    return result;
}

/** The one edit that turns a file's text into another: what lies between their common start and their common end. */
function toOneEdit(path: string, before: string, after: string): FileEdit {
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    let end = 0;
    while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
    return { path, start, end: before.length - end, newText: after.slice(start, after.length - end) };
}

/**
 * A file's text as the service's file system holds it. That file system
 * takes an empty text for no file at all, so an empty file, such as one just
 * added, is given a space, which TypeScript reads the same.
 */
function toServiceText(text: string): string {
    return text === '' ? ' ' : text;
}

function toServicePath(path: string): string {
    return `/${path}`;
}

function toProjectPath(path: string): string {
    return path.startsWith('/') ? path.slice(1) : path;
}
