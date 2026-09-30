/**
 * Vite plugin that precompiles the JSX runtime's refresh factories at build
 * time, so a page whose Content Security Policy forbids `new Function` still
 * gets generated refresh code instead of the runtime's much slower closure
 * fallback. Proposal 022, section 7.6, option B.
 *
 * Opt-in: the site's Vite config adds it only when `MVT_JSX_PRECOMPILE` is
 * `1` or `true`, for `vite`, `vite build` and the test runner alike:
 *
 *     MVT_JSX_PRECOMPILE=1 npm run build                  # bash
 *     $env:MVT_JSX_PRECOMPILE = '1'; npm run build        # PowerShell
 *
 * It needs no configuration. For each `.tsx` module, it reads the module's
 * `@jsxImportSource` and resolves `<importSource>/precompile` as the module
 * would import it: the JSX target's precompile manifest, a JSON file of what
 * each element's attributes are and how they are written
 * (`PrecompileManifest`, in `jsx-precompile-manifest.ts`). A module whose
 * import source has no manifest is left alone. Only the manifest is read,
 * never the renderer's code, so none is loaded in Node.
 *
 * In each such module it finds every intrinsic element
 * (`<sprite x={() => ...} />`), works out
 * which attributes the runtime will bind (a function given to a changeable
 * attribute) and in what order, and writes the refresh factories the runtime
 * would otherwise generate with `new Function`, using the runtime's own
 * source (`refreshFactorySource`). It adds them to the module, on the
 * pragma comment's line so that no line of the module moves:
 *
 *     /** @jsxImportSource #pixi-mvt/jsx *\/import { registerRefreshFactories as ... } from '#pixi-mvt/jsx/jsx-runtime';...({ "|e.x,": function (e, s, u, c, g0, a0) {...} }, 1);
 *
 * The last argument is the `REFRESH_SOURCE_VERSION` the factories were made
 * with; a runtime of another version ignores them and generates its own.
 *
 * The runtime then finds each shape registered and never needs `new
 * Function` for it; on a page that allows eval, nothing changes but where
 * the same code comes from.
 *
 * Whether an attribute's value is a function is read from the syntax: an
 * arrow or function expression is, a literal is not, and a local `const` or
 * function declaration is resolved. Anything else (`bindings.score`, a
 * parameter, a call) could be either, so the plugin emits both variants, up
 * to {@link MAX_UNDECIDED} such attributes per element. Not covered, and left
 * to the runtime: elements with spread attributes, elements built by calling
 * `jsx()` directly, and elements whose tag or attributes the table lacks
 * (which throw at run time anyway).
 */

import { readFileSync } from 'node:fs';
import type { Plugin, ResolvedConfig } from 'vite';
import type TypeScript from 'typescript';
import { REFRESH_SOURCE_VERSION, refreshFactorySource, refreshShapeKey, type ShapeBinding } from '../src/mvt-utils/jsx';
import {
    findManifestAttribute, type ManifestAttribute, PRECOMPILE_MANIFEST_FORMAT, type PrecompileManifest,
} from './jsx-precompile-manifest';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A JSX target, as far as the precompiler needs it. */
export interface PrecompileTarget {
    /**
     * The `@jsxImportSource` its modules name, such as `'#pixi-mvt/jsx'`. The
     * registration is imported from `<importSource>/jsx-runtime`, which must
     * export `registerRefreshFactories`.
     */
    readonly importSource: string;
    /** The JSX target's precompile manifest, from `<importSource>/precompile`. */
    readonly manifest: PrecompileManifest;
}

/** What precompiling one module found and produced. */
export interface ModulePrecompilation {
    /** The code to put after the pragma comment, or `''` if the module needs none. */
    readonly registration: string;
    /** Where in the module to put it: the offset just past the pragma comment. */
    readonly insertAt: number;
    /** The shape keys registered, one per distinct shape. */
    readonly keys: readonly string[];
    /** Intrinsic elements of this JSX target found in the module. */
    readonly elementCount: number;
    /** Elements left to the runtime, with why. */
    readonly skipped: readonly SkippedElement[];
}

export interface SkippedElement {
    readonly tag: string;
    /** 1-based line of the element in the module. */
    readonly line: number;
    readonly reason: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function jsxPrecompilePlugin(): Plugin {
    let config: ResolvedConfig | undefined;
    let resolve: ReturnType<ResolvedConfig['createResolver']> | undefined;
    // Each import source's JSX target, or `undefined` for one with no manifest
    const targets = new Map<string, Promise<PrecompileTarget | undefined>>();
    let typescript: Promise<typeof TypeScript> | undefined;
    const totals = { modules: 0, elements: 0, skipped: 0, keys: new Set<string>(), bytes: 0 };

    return {
        name: 'mvt-jsx-precompile',
        // Before esbuild compiles the JSX away
        enforce: 'pre',
        configResolved(resolved) {
            config = resolved;
            resolve = resolved.createResolver();
        },
        async transform(code, id) {
            const path = id.split('?')[0];
            if (!path.endsWith('.tsx') || path.includes('/node_modules/')) return undefined;
            const importSource = findImportSource(code);
            if (importSource === undefined) return undefined;
            let pending = targets.get(importSource);
            if (pending === undefined) {
                pending = loadTarget(importSource, path);
                targets.set(importSource, pending);
            }
            const target = await pending;
            if (target === undefined) return undefined;

            const ts = await (typescript ??= import('typescript').then((m) => m.default));
            const result = precompileModule(ts, code, path, target);
            totals.modules++;
            totals.elements += result.elementCount;
            totals.skipped += result.skipped.length;
            for (let i = 0; i < result.keys.length; i++) totals.keys.add(result.keys[i]);
            totals.bytes += result.registration.length;
            if (result.registration === '') return undefined;
            return {
                code: code.slice(0, result.insertAt) + result.registration + code.slice(result.insertAt),
                // Only the pragma comment's line changes, after the comment
                map: null,
            };
        },
        buildEnd() {
            if (config?.command !== 'build' || totals.modules === 0) return;
            config.logger.info(
                `[mvt-jsx-precompile] ${totals.modules} modules, ${totals.elements} elements, `
                + `${totals.keys.size} refresh shapes precompiled (${(totals.bytes / 1024).toFixed(1)} KiB before minifying), `
                + `${totals.skipped} ${totals.skipped === 1 ? 'element' : 'elements'} left to the runtime`,
            );
        },
    };

    /**
     * The JSX target for an import source: its manifest, resolved as `importer`
     * would import `<importSource>/precompile`. `undefined` if it has none,
     * or one of a format this plugin does not read, which is reported.
     */
    async function loadTarget(importSource: string, importer: string): Promise<PrecompileTarget | undefined> {
        let resolved: string | undefined;
        try {
            resolved = await resolve?.(`${importSource}/precompile`, importer);
        }
        catch {
            // A package whose `exports` or `imports` has no `./precompile`
            // throws rather than resolving to nothing
            return undefined;
        }
        if (resolved === undefined) return undefined;
        const manifest = JSON.parse(readFileSync(resolved.split('?')[0], 'utf8')) as PrecompileManifest;
        if (manifest.format !== PRECOMPILE_MANIFEST_FORMAT) {
            config?.logger.warn(
                `[mvt-jsx-precompile] ${importSource}'s precompile manifest is format ${manifest.format}; this plugin reads `
                + `format ${PRECOMPILE_MANIFEST_FORMAT}, so its modules are left to the runtime. Install matching versions.`,
            );
            return undefined;
        }
        return { importSource, manifest };
    }
}

/**
 * Finds the intrinsic elements of `target` in one module and returns the
 * registration of every refresh factory they may need.
 */
export function precompileModule(
    ts: typeof TypeScript,
    code: string,
    fileName: string,
    target: PrecompileTarget,
): ModulePrecompilation {
    const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const factories = new Map<string, string>();
    const skipped: SkippedElement[] = [];
    let elementCount = 0;

    visit(sourceFile);

    const insertAt = pragmaEnd(code);
    let registration = '';
    if (factories.size > 0) {
        const entries: string[] = [];
        for (const [key, source] of factories) entries.push(`${JSON.stringify(key)}:${source}`);
        registration = `import { registerRefreshFactories as ${REGISTER} } from ${JSON.stringify(`${target.importSource}/jsx-runtime`)};`
            + `${REGISTER}({${entries.join(',')}},${REFRESH_SOURCE_VERSION});`;
    }
    return { registration, insertAt, keys: [...factories.keys()], elementCount, skipped };

    function visit(node: TypeScript.Node): void {
        if (ts.isJsxSelfClosingElement(node)) {
            addElement(node.tagName, node.attributes);
        }
        else if (ts.isJsxElement(node)) {
            addElement(node.openingElement.tagName, node.openingElement.attributes);
        }
        ts.forEachChild(node, visit);
    }

    function addElement(tagName: TypeScript.JsxTagNameExpression, attributes: TypeScript.JsxAttributes): void {
        // Intrinsic elements are lower-case identifiers; anything else is a component
        if (!ts.isIdentifier(tagName) || !/^[a-z]/.test(tagName.text)) return;
        const tag = tagName.text;
        elementCount++;
        const skip = (reason: string): void => {
            skipped.push({ tag, line: sourceFile.getLineAndCharacterOfPosition(tagName.getStart()).line + 1, reason });
        };
        const manifest = target.manifest;
        if (!Object.hasOwn(manifest.elements, tag)) return skip('the element table has no such element');

        // The attributes the runtime may bind, in source order, and whether
        // each is known to be a function.
        const candidates: Candidate[] = [];
        for (const property of attributes.properties) {
            if (!ts.isJsxAttribute(property)) return skip('spread attributes');
            if (!ts.isIdentifier(property.name)) return skip('a namespaced attribute');
            const key = property.name.text;
            if (key === 'key') continue;
            let attribute: ManifestAttribute;
            if (key === 'visible') {
                attribute = manifest.visible;
            }
            else if (MVT_KEYS.has(key)) {
                continue;
            }
            else {
                const found = findManifestAttribute(manifest, tag, key);
                if (found === undefined) return skip(`the element table has no attribute '${key}'`);
                attribute = found;
            }
            const kind = attribute.kind;
            if (kind === 'fixed' || kind === 'event') continue;
            const valueKind = classifyAttribute(property.initializer);
            if (valueKind === 'value') continue;
            candidates.push({ key, kind, property: attribute.property, isUndecided: valueKind === 'undecided' });
        }

        const undecided = candidates.filter((c) => c.isUndecided);
        if (undecided.length > MAX_UNDECIDED) return skip(`${undecided.length} attributes that may or may not be functions`);

        // Every combination of the undecided attributes being functions or not
        for (let mask = 0; mask < 1 << undecided.length; mask++) {
            const bound = candidates.filter((c) => !c.isUndecided || (mask & (1 << undecided.indexOf(c))) !== 0);
            addShape(bound);
        }
    }

    /** Adds the factory for these bound attributes, ordered as the runtime orders them. */
    function addShape(bound: readonly Candidate[]): void {
        if (bound.length === 0) return;
        const bindings: ShapeBinding[] = [];
        const visible = bound.find((c) => c.key === 'visible');
        if (visible !== undefined) bindings.push(visible);
        for (const c of bound) if (c !== visible && c.kind === 'every-frame') bindings.push(c);
        for (const c of bound) if (c !== visible && c.kind !== 'every-frame') bindings.push(c);
        const hasVisible = visible !== undefined;
        const key = refreshShapeKey(hasVisible, bindings);
        if (factories.has(key)) return;
        const source = refreshFactorySource(hasVisible, bindings);
        factories.set(key, `function(${source.params.join(',')}){${source.body}}`);
    }

    /** Whether an attribute's value is a function (a getter), is not, or cannot be told from the syntax. */
    function classifyAttribute(initializer: TypeScript.JsxAttributeValue | undefined): ValueKind {
        if (initializer === undefined || ts.isStringLiteral(initializer)) return 'value';
        if (ts.isJsxExpression(initializer)) return initializer.expression === undefined ? 'value' : classify(initializer.expression, 0);
        return 'value';
    }

    function classify(expression: TypeScript.Expression, depth: number): ValueKind {
        const e = unwrap(expression);
        if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return 'getter';
        if (
            ts.isLiteralExpression(e) || ts.isTemplateExpression(e) || ts.isObjectLiteralExpression(e)
            || ts.isArrayLiteralExpression(e) || ts.isNewExpression(e) || ts.isPrefixUnaryExpression(e)
            || ts.isPostfixUnaryExpression(e) || ts.isTypeOfExpression(e) || ts.isVoidExpression(e)
            || ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)
            || e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword
            || e.kind === ts.SyntaxKind.NullKeyword
        ) {
            return 'value';
        }
        if (ts.isConditionalExpression(e)) return combine(classify(e.whenTrue, depth), classify(e.whenFalse, depth));
        if (ts.isBinaryExpression(e)) {
            const operator = e.operatorToken.kind;
            if (
                operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.AmpersandAmpersandToken
                || operator === ts.SyntaxKind.QuestionQuestionToken
            ) {
                return combine(classify(e.left, depth), classify(e.right, depth));
            }
            if (operator === ts.SyntaxKind.EqualsToken) return classify(e.right, depth);
            if (operator === ts.SyntaxKind.CommaToken) return classify(e.right, depth);
            return 'value'; // Arithmetic, comparison and the like
        }
        if (ts.isIdentifier(e)) {
            if (e.text === 'undefined') return 'value';
            return depth < MAX_RESOLVE_DEPTH ? resolveIdentifier(e, depth) : 'undecided';
        }
        return 'undecided'; // Member accesses, calls, and anything else
    }

    /** Resolves a local name to its declaration in this module, if it is a function or a `const`. */
    function resolveIdentifier(identifier: TypeScript.Identifier, depth: number): ValueKind {
        const name = identifier.text;
        for (let scope: TypeScript.Node | undefined = identifier.parent; scope !== undefined; scope = scope.parent) {
            if (ts.isFunctionLike(scope) && scope.parameters.some((p) => bindsName(p.name, name))) return 'undecided';
            const statements = ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope) ? scope.statements : undefined;
            if (statements === undefined) continue;
            for (const statement of statements) {
                if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return 'getter';
                if (!ts.isVariableStatement(statement)) continue;
                for (const declaration of statement.declarationList.declarations) {
                    if (!bindsName(declaration.name, name)) continue;
                    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
                    if (!isConst || !ts.isIdentifier(declaration.name) || declaration.initializer === undefined) return 'undecided';
                    return classify(declaration.initializer, depth + 1);
                }
            }
        }
        return 'undecided'; // An import, a global, or a name from a pattern this does not follow
    }

    function bindsName(binding: TypeScript.BindingName, name: string): boolean {
        if (ts.isIdentifier(binding)) return binding.text === name;
        return binding.elements.some((element) => !ts.isOmittedExpression(element) && bindsName(element.name, name));
    }

    function unwrap(expression: TypeScript.Expression): TypeScript.Expression {
        let e = expression;
        while (
            ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)
            || ts.isNonNullExpression(e) || ts.isTypeAssertionExpression(e)
        ) {
            e = e.expression;
        }
        return e;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type ValueKind = 'getter' | 'value' | 'undecided';

interface Candidate extends ShapeBinding {
    readonly isUndecided: boolean;
}

/**
 * At most this many attributes per element whose values may or may not be
 * functions. Each doubles the variants emitted; past this, the element is
 * left to the runtime.
 */
const MAX_UNDECIDED = 4;

/** How many `const` indirections to follow when resolving a name. */
const MAX_RESOLVE_DEPTH = 4;

/** Attributes the base handles on every element, other than `visible`. */
const MVT_KEYS: ReadonlySet<string> = new Set(['children', 'ref', 'onUpdate', 'onRefresh', 'onDestroyed']);

/** The value kind of an expression that is one of two others. */
function combine(a: ValueKind, b: ValueKind): ValueKind {
    return a === b ? a : 'undecided';
}

/** The local name the registration is imported under. */
const REGISTER = '__mvtRegisterRefreshFactories';

const IMPORT_SOURCE_PRAGMA = /@jsxImportSource\s+(\S+)/;

/** The import source a module's pragma names, if it has one. */
function findImportSource(code: string): string | undefined {
    const match = IMPORT_SOURCE_PRAGMA.exec(code);
    return match === null ? undefined : match[1].replace(/\*\/$/, '');
}

/**
 * Just past the comment that holds the pragma, or 0. The registration goes
 * there, on the comment's own line, so the pragma stays the module's leading
 * comment, as TypeScript and esbuild expect, and no line moves.
 */
function pragmaEnd(code: string): number {
    const match = IMPORT_SOURCE_PRAGMA.exec(code);
    if (match === null) return 0;
    const blockEnd = code.indexOf('*/', match.index);
    const lineEnd = code.indexOf('\n', match.index);
    if (blockEnd !== -1 && (lineEnd === -1 || blockEnd < lineEnd)) return blockEnd + 2;
    // A line comment: the registration cannot share its line, so it goes on
    // the next one, before that line's own code.
    return lineEnd === -1 ? code.length : lineEnd + 1;
}
