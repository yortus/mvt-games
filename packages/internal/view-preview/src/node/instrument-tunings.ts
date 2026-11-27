import MagicString, { type SourceMap } from 'magic-string';
import ts from 'typescript';
import type { TuningField, TuningInfo } from '../shared';
import { parseTestFile } from './find-visual-tests.ts';
import { readLiteral } from './knob-literals.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A module whose tuning objects register with the preview as they're created. */
export interface InstrumentedTunings {
    readonly code: string;
    readonly map: SourceMap;
    readonly tunings: readonly TuningInfo[];
}

export interface InstrumentTuningsOptions {
    /** The module's code. */
    readonly code: string;
    /** Its path, which names its tunings, and says whether it holds JSX. */
    readonly fileName: string;
    /** The module the instrumented code imports `registerTuning` from. */
    readonly runtimeModule: string;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns a module with each of its tuning objects passed through
 * `registerTuning`, or `undefined` if it doesn't declare one. A tuning object is a
 * top-level `const` whose name ends in `_TUNING`, exported or not, whose
 * value is an object literal. The literal may have a type on it, with `as`
 * or `satisfies`, as may a table inside it.
 *
 * `registerTuning` returns the object passed to it, so the module keeps the
 * same object, of the same type, and the preview can change its fields as
 * the module's code reads them.
 */
export function instrumentTunings(options: InstrumentTuningsOptions): InstrumentedTunings | undefined {
    const { code, fileName, runtimeModule } = options;
    const source = parseTestFile({ code, fileName });
    const out = new MagicString(code);
    const file = fileName.replaceAll('\\', '/');
    const tunings: TuningInfo[] = [];
    for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement) || (statement.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || !TUNING_NAME.test(declaration.name.text) || declaration.initializer === undefined) continue;
            const literal = unwrapTypes(declaration.initializer);
            if (!ts.isObjectLiteralExpression(literal)) continue;
            const name = declaration.name.text;
            const at = source.getLineAndCharacterOfPosition(declaration.name.getStart(source));
            const info: TuningInfo = {
                id: `${file}#${name}`,
                name,
                file,
                line: at.line + 1,
                column: at.character + 1,
                doc: readDoc(statement),
                fields: listFields({ literal, path: [], source }),
            };
            tunings.push(info);
            out.appendLeft(declaration.initializer.getStart(source), `${REGISTER}(${JSON.stringify(info)}, `);
            out.appendRight(declaration.initializer.end, ')');
        }
    }
    if (tunings.length === 0) return undefined;
    // At the end, since imports are hoisted, so that a JSX pragma in the file's first comment stays first
    out.append(`\nimport { registerTuning as ${REGISTER} } from ${JSON.stringify(runtimeModule)};\n`);
    return { code: out.toString(), map: out.generateMap({ hires: true, source: fileName, includeContent: true }), tunings };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A tuning object's name, in upper case and ending in `_TUNING`. */
const TUNING_NAME = /^[A-Z][A-Z0-9_]*_TUNING$/;

/** The name of `registerTuning` in the instrumented code, chosen so it can't clash with a module's own names. */
const REGISTER = '__viewPreviewTuning';

/** A name whose value is a colour, though it's written as a plain number. */
const COLOR_NAME = /(Color|Colour)$/;

/** Returns the fields of an object literal, and of the tables inside it, in the order they're written. */
function listFields(options: { readonly literal: ts.ObjectLiteralExpression; readonly path: readonly string[]; readonly source: ts.SourceFile }): TuningField[] {
    const { literal, path, source } = options;
    const fields: TuningField[] = [];
    for (const property of literal.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = readKey(property.name);
        if (key === undefined) continue;
        const value = unwrapTypes(property.initializer);
        if (ts.isObjectLiteralExpression(value)) {
            fields.push(...listFields({ literal: value, path: [...path, key], source }));
            continue;
        }
        const read = readLiteral(value, source);
        if (read === undefined) continue;
        const at = source.getLineAndCharacterOfPosition(value.getStart(source));
        const kind = read.kind === 'number' && COLOR_NAME.test(key) ? 'color' : read.kind;
        fields.push({ path: [...path, key], kind, value: read.value, line: at.line + 1, column: at.character + 1, doc: readDoc(property) });
    }
    return fields;
}

/** Returns a property's key, if it's written as a name, a string or a number. */
function readKey(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    return undefined;
}

/** Returns an expression without the types and parentheses round it, as `{ a: 1 }` for `({ a: 1 } as T)`. */
function unwrapTypes(node: ts.Expression): ts.Expression {
    let current = node;
    while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current) || ts.isTypeAssertionExpression(current)) {
        current = current.expression;
    }
    return current;
}

/** Returns the first paragraph of a node's doc comment, if it has one. */
function readDoc(node: ts.Node): string | undefined {
    const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
    const text = docs.length === 0 ? undefined : ts.getTextOfJSDocComment(docs[docs.length - 1].comment);
    return text?.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim() || undefined;
}
