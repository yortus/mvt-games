import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { CheatSheet, CheatSheetEntry, ReferenceEntry, ReferenceSheet } from '../cheat-sheets';
import type { LibrarySpecifier } from '../libraries';
import type { RendererKind } from '#project-api';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MadeReferenceSheets {
    readonly sheets: readonly ReferenceSheet[];
    /**
     * What's wrong with the sheets, one sentence each: a name that a library
     * doesn't export, a chapter that doesn't exist, or an export of this
     * repo's libraries that's on no sheet and not left out on purpose.
     */
    readonly problems: readonly string[];
}

export interface MakeReferenceSheetsOptions {
    readonly sheets: readonly CheatSheet[];
    /** The exports of this repo's libraries that no sheet shows, each with the reason. */
    readonly leftOut: Readonly<Record<string, string>>;
}

/**
 * The libraries whose every value export must be on a sheet, or left out
 * on purpose. Pixi, three.js and GSAP are too big for that, and their sheets
 * show only the essentials.
 */
export const COVERED_LIBRARIES: readonly LibrarySpecifier[] = ['playground', '@mvtjs/utils', '@mvtjs/pixi', '@mvtjs/html', '@mvtjs/three', 'audio90'];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Makes the reference sheets from the cheat sheets: looks up each entry in
 * its library's declarations, with the TypeScript compiler, and fills in
 * its signature, the first sentence of its doc comment, and its import
 * line. This repo's libraries are read from their sources, and Pixi,
 * three.js and GSAP from `node_modules`, as the playground's type bundles
 * are. It takes a few seconds, since it loads every library's types.
 */
export function makeReferenceSheets(options: MakeReferenceSheetsOptions): MadeReferenceSheets {
    const problems: string[] = [];
    const specifiers = new Set<LibrarySpecifier>(COVERED_LIBRARIES);
    for (const sheet of options.sheets) {
        for (const group of sheet.groups) {
            for (const entry of group.entries) if (entry.from !== undefined) specifiers.add(entry.from);
        }
    }
    const lookup = createLookup([...specifiers]);

    const ids = new Set<string>();
    const sheets: ReferenceSheet[] = [];
    for (const sheet of options.sheets) {
        if (ids.has(sheet.id)) problems.push(`Two sheets have the id '${sheet.id}'.`);
        ids.add(sheet.id);
        sheets.push({
            id: sheet.id,
            title: sheet.title,
            summary: sheet.summary,
            renderers: sheet.renderers,
            moreAt: sheet.moreAt ?? [],
            groups: sheet.groups.map((group) => ({
                title: group.title,
                entries: group.entries.map((entry) => makeEntry(entry, lookup, (problem) => problems.push(`${sheet.title}: ${problem}`))),
            })),
        });
    }
    problems.push(...findCoverageProblems(options, lookup));
    return { sheets, problems };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PLAYGROUND = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = resolve(PLAYGROUND, '../docs');

/** The file the lookup's program starts from, which imports every library. It exists only in memory. */
const ROOT_FILE = join(PLAYGROUND, '__reference-sheets__.ts');

/** How a library is imported in the lookup's program: the `playground` module from its source, the rest by name. */
const IMPORT_PATHS: Partial<Record<LibrarySpecifier, string>> = {
    playground: './src/project-api/index.ts',
};

const RENDERER_KINDS: readonly RendererKind[] = ['pixi', 'html', 'three'];

/** The most members an interface's signature lists before it stops. */
const MAX_LISTED_MEMBERS = 8;

interface Lookup {
    readonly checker: ts.TypeChecker;
    /** Each library's exports, by name, with aliases resolved. */
    readonly exportsOf: (specifier: LibrarySpecifier) => ReadonlyMap<string, ts.Symbol>;
}

/** Makes a program that imports every library, and returns a way to read each library's exports. */
function createLookup(specifiers: readonly LibrarySpecifier[]): Lookup {
    const options: ts.CompilerOptions = {
        noEmit: true,
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
    };
    const rootText = specifiers.map((s, i) => `import * as library${i} from '${IMPORT_PATHS[s] ?? s}';`).join('\n');
    const host = ts.createCompilerHost(options);
    const { getSourceFile, fileExists, readFile } = host;
    host.getSourceFile = (fileName, version, ...rest) => resolve(fileName) === ROOT_FILE
        ? ts.createSourceFile(fileName, rootText, version)
        : getSourceFile.call(host, fileName, version, ...rest);
    host.fileExists = (fileName) => resolve(fileName) === ROOT_FILE || fileExists.call(host, fileName);
    host.readFile = (fileName) => (resolve(fileName) === ROOT_FILE ? rootText : readFile.call(host, fileName));
    const program = ts.createProgram({ rootNames: [ROOT_FILE], options, host });
    const checker = program.getTypeChecker();
    const root = program.getSourceFile(ROOT_FILE);
    if (root === undefined) throw new Error('The reference sheets\' lookup could not read its own root file');

    const modules = new Map<LibrarySpecifier, ReadonlyMap<string, ts.Symbol>>();
    let index = 0;
    for (const statement of root.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        const specifier = specifiers[index++];
        const moduleSymbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
        const exports = new Map<string, ts.Symbol>();
        for (const symbol of moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol)) {
            exports.set(symbol.name, resolveAlias(checker, symbol));
        }
        modules.set(specifier, exports);
    }
    return { checker, exportsOf: (specifier) => modules.get(specifier) ?? new Map() };
}

function makeEntry(entry: CheatSheetEntry, lookup: Lookup, report: (problem: string) => void): ReferenceEntry {
    const chapter = entry.chapter === undefined ? undefined : findChapter(entry.chapter, report);
    const common = { name: entry.name, useFor: entry.useFor, snippet: entry.snippet, chapter };
    if (entry.from === undefined) {
        if (entry.signature === undefined) report(`${entry.name} names no library, so it needs a signature written out.`);
        return { ...common, signature: entry.signature ?? '', summary: '' };
    }
    const [rootName, ...memberNames] = entry.name.split('.');
    const importLine = `import { ${rootName} } from '${entry.from}';`;
    let symbol = lookup.exportsOf(entry.from).get(rootName);
    if (symbol === undefined) {
        report(`${entry.from} doesn't export ${rootName}.`);
        return { ...common, from: entry.from, importLine, signature: entry.signature ?? '', summary: '' };
    }
    for (const memberName of memberNames) {
        const member = findMember(lookup.checker, symbol, memberName);
        if (member === undefined) {
            report(`${entry.name}: ${symbol.name} has no member ${memberName}.`);
            return { ...common, from: entry.from, importLine, signature: entry.signature ?? '', summary: '' };
        }
        symbol = member;
    }
    return {
        ...common,
        from: entry.from,
        importLine,
        importLineFor: findImportLinesByRenderer(entry.from, rootName, lookup),
        signature: entry.signature ?? describeSignature(lookup.checker, symbol, entry.name),
        summary: summarise(lookup.checker, symbol),
    };
}

/**
 * The import line for each renderer's projects, for a name from a renderer's
 * package that every renderer's package exports, such as `setRefresh`. Else
 * undefined: the one import line is right for every project.
 */
function findImportLinesByRenderer(from: LibrarySpecifier, name: string, lookup: Lookup): Partial<Record<RendererKind, string>> | undefined {
    if (!RENDERER_KINDS.some((renderer) => from === `@mvtjs/${renderer}`)) return undefined;
    const lines: Partial<Record<RendererKind, string>> = {};
    for (const renderer of RENDERER_KINDS) {
        const specifier = `@mvtjs/${renderer}` as const;
        if (!lookup.exportsOf(specifier).has(name)) return undefined;
        lines[renderer] = `import { ${name} } from '${specifier}';`;
    }
    return lines;
}

/**
 * A member of a class's, interface's or type's instances, or else of the
 * value itself, such as a static method or an object's property.
 */
function findMember(checker: ts.TypeChecker, symbol: ts.Symbol, name: string): ts.Symbol | undefined {
    if (symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) {
        const member = checker.getPropertyOfType(checker.getDeclaredTypeOfSymbol(symbol), name);
        if (member !== undefined) return member;
    }
    if (symbol.flags & ts.SymbolFlags.Value) return checker.getPropertyOfType(checker.getTypeOfSymbol(symbol), name);
    return undefined;
}

/**
 * A symbol's signature, as the sheet shows it: a function's or method's
 * parameters and return type, a class's constructor, an interface's members,
 * a type alias's type, or a constant's type. Type parameters are shown
 * without their constraints, and an optional parameter or property without
 * its `| undefined`, so the signature stays short.
 */
function describeSignature(checker: ts.TypeChecker, symbol: ts.Symbol, name: string): string {
    const typeText = (type: ts.Type): string => checker.typeToString(type, undefined, TYPE_FORMAT);
    if (symbol.flags & ts.SymbolFlags.Class) {
        const constructors = checker.getTypeOfSymbol(symbol).getConstructSignatures();
        if (constructors.length === 0) return `class ${name}`;
        return `new ${name}${describeCall(checker, constructors[0], false)}${overloadNote(constructors.length)}`;
    }
    if (symbol.flags & ts.SymbolFlags.Value) {
        const type = checker.getTypeOfSymbol(symbol);
        const calls = type.getCallSignatures();
        if (calls.length > 0 && !(symbol.flags & ts.SymbolFlags.Variable && type.getProperties().length > 0)) {
            return `${name}${describeCall(checker, calls[0], true)}${overloadNote(calls.length)}`;
        }
        const keyword = symbol.flags & ts.SymbolFlags.Variable ? 'const ' : '';
        const optional = symbol.flags & ts.SymbolFlags.Optional;
        return `${keyword}${name}${optional ? '?' : ''}: ${typeText(optional ? checker.getNonNullableType(type) : type)}`;
    }
    const header = `${name}${typeParametersOf(symbol)}`;
    if (symbol.flags & ts.SymbolFlags.Interface) {
        const members = checker.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol));
        const lines = members.slice(0, MAX_LISTED_MEMBERS).map((member) => {
            const type = checker.getTypeOfSymbol(member);
            const optional = member.flags & ts.SymbolFlags.Optional;
            return `    ${member.name}${optional ? '?' : ''}: ${typeText(optional ? checker.getNonNullableType(type) : type)};`;
        });
        if (members.length > MAX_LISTED_MEMBERS) lines.push(`    // and ${members.length - MAX_LISTED_MEMBERS} more`);
        return `interface ${header} {\n${lines.join('\n')}\n}`;
    }
    if (symbol.flags & ts.SymbolFlags.TypeAlias) {
        return `type ${header} = ${checker.typeToString(checker.getDeclaredTypeOfSymbol(symbol), undefined, TYPE_FORMAT | ts.TypeFormatFlags.InTypeAlias)}`;
    }
    return name;
}

/** How types are written: by the names of their aliases where they have them, such as `View`, rather than spelled out. */
const TYPE_FORMAT = ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/** A call's type parameters, parameters and return type: `<T>(options?: SlotListOptions<T>): SlotList<T>`. A constructor's has no return type. */
function describeCall(checker: ts.TypeChecker, signature: ts.Signature, hasReturnType: boolean): string {
    const typeParameters = signature.getTypeParameters() ?? [];
    const generics = !hasReturnType || typeParameters.length === 0 ? '' : `<${typeParameters.map((t) => t.symbol.name).join(', ')}>`;
    const parameters = signature.getParameters().map((parameter) => {
        const declaration = parameter.valueDeclaration;
        const type = declaration === undefined ? checker.getTypeOfSymbol(parameter) : checker.getTypeOfSymbolAtLocation(parameter, declaration);
        const isRest = declaration !== undefined && ts.isParameter(declaration) && declaration.dotDotDotToken !== undefined;
        const isOptional = declaration !== undefined && ts.isParameter(declaration) && checker.isOptionalParameter(declaration);
        const shown = isOptional ? checker.getNonNullableType(type) : type;
        // A destructured parameter has no name of its own
        const parameterName = parameter.name.startsWith('__') ? 'options' : parameter.name;
        return `${isRest ? '...' : ''}${parameterName}${isOptional ? '?' : ''}: ${checker.typeToString(shown, undefined, TYPE_FORMAT)}`;
    });
    const returns = hasReturnType ? `: ${checker.typeToString(signature.getReturnType(), undefined, TYPE_FORMAT)}` : '';
    return `${generics}(${parameters.join(', ')})${returns}`;
}

/** A type's or interface's type parameters, without their constraints, such as `<T>`, or '' if it has none. */
function typeParametersOf(symbol: ts.Symbol): string {
    const declaration = symbol.declarations?.find((d) => ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d));
    const parameters = declaration === undefined ? undefined : (declaration as ts.InterfaceDeclaration | ts.TypeAliasDeclaration).typeParameters;
    return parameters === undefined ? '' : `<${parameters.map((p) => p.name.text).join(', ')}>`;
}

function overloadNote(count: number): string {
    return count > 1 ? ` (+${count - 1} more)` : '';
}

/** The first sentence of a symbol's doc comment, with `{@link X}` written as X, or '' if it has none. */
function summarise(checker: ts.TypeChecker, symbol: ts.Symbol): string {
    const text = ts.displayPartsToString(symbol.getDocumentationComment(checker))
        .replace(/\{@link(?:code|plain)?\s+([^}|\s]+)(?:[\s|][^}]*)?\}/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    const sentence = /^.*?[.!?](?=\s|$)/.exec(text);
    return sentence === null ? text : sentence[0];
}

function resolveAlias(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
    return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/** A page of the book, by its path, with its name as the book cites it: "Chapter 9, Noticing Changes", or "Appendix E, Timelines with GSAP". */
function findChapter(path: string, report: (problem: string) => void): { path: string; title: string } | undefined {
    const file = join(DOCS, `${path}.md`);
    if (!existsSync(file)) {
        report(`the book has no page ${path}.`);
        return undefined;
    }
    const heading = /^# (.+)$/m.exec(readFileSync(file, 'utf8'))?.[1].trim() ?? path;
    const chapter = /^chapters\/0*(\d+)-/.exec(path);
    if (chapter !== null) return { path, title: `Chapter ${chapter[1]}, ${heading}` };
    const appendix = /^appendices\/([a-z])-/.exec(path);
    if (appendix !== null) return { path, title: `Appendix ${appendix[1].toUpperCase()}, ${heading}` };
    return { path, title: heading };
}

/**
 * Each value export of the covered libraries that's on no sheet and not left
 * out, and each name left out that no covered library exports, or that a
 * sheet shows after all. A name counts as shown when an entry names it, or a
 * member of it, from any covered library, since the renderers' packages
 * export `@mvtjs/utils`'s view tick API again.
 */
function findCoverageProblems(options: MakeReferenceSheetsOptions, lookup: Lookup): string[] {
    const shown = new Set<string>();
    for (const sheet of options.sheets) {
        for (const group of sheet.groups) {
            for (const entry of group.entries) {
                if (entry.from !== undefined && COVERED_LIBRARIES.includes(entry.from)) shown.add(entry.name.split('.')[0]);
            }
        }
    }
    const problems: string[] = [];
    const exported = new Set<string>();
    for (const specifier of COVERED_LIBRARIES) {
        for (const [name, symbol] of lookup.exportsOf(specifier)) {
            if (!(symbol.flags & ts.SymbolFlags.Value)) continue;
            exported.add(name);
            if (!shown.has(name) && options.leftOut[name] === undefined && !problems.some((p) => p.startsWith(`${name},`))) {
                problems.push(`${name}, exported by ${specifier}, is on no cheat sheet. Add it to a sheet, or to LEFT_OUT in cheat-sheets/left-out.ts with the reason.`);
            }
        }
    }
    for (const name of Object.keys(options.leftOut)) {
        if (!exported.has(name)) problems.push(`LEFT_OUT names ${name}, which none of ${COVERED_LIBRARIES.join(', ')} exports as a value.`);
        else if (shown.has(name)) problems.push(`LEFT_OUT names ${name}, which a sheet shows.`);
    }
    return problems;
}
