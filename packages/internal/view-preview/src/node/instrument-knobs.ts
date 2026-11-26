import MagicString, { type SourceMap } from 'magic-string';
import ts from 'typescript';
import type { KnobInfo, KnobKind, KnobValue, PoseInfo } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A test file whose poses read their literals from the preview's knobs. */
export interface InstrumentedFile {
    readonly code: string;
    readonly map: SourceMap;
    readonly poses: readonly PoseInfo[];
}

export interface InstrumentKnobsOptions {
    /** The test file's code. */
    readonly code: string;
    /** Its path, which says whether it holds JSX. */
    readonly fileName: string;
    /** The module the instrumented code imports `readKnob` and `markPose` from. */
    readonly runtimeModule: string;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns a test file with each literal in each pose replaced by a knob, or
 * `undefined` if it doesn't declare a pose written in place. A pose is the last
 * argument of a `canvasTest` or `htmlTest` call, in any of their forms,
 * such as `canvasTest.skip` or `canvasTest.each(cases)`. Only a pose written
 * in place, as an arrow function or a function expression, has knobs. A
 * literal is a number, a boolean or a string, anywhere in the pose but in a
 * type or as a property's name.
 *
 * Each literal becomes `readKnob(poseId, index, literal)`, which returns the
 * literal until you change its knob. Each pose becomes
 * `markPose(info, pose)`, so the preview can find the knobs of the pose a
 * test declares.
 */
export function instrumentKnobs(options: InstrumentKnobsOptions): InstrumentedFile | undefined {
    const { code, fileName, runtimeModule } = options;
    const scriptKind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, scriptKind);
    const out = new MagicString(code);
    const poses: PoseInfo[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && VISUAL_TESTS.has(findRootName(node.expression) ?? '')) {
            const pose = node.arguments[node.arguments.length - 1];
            if (pose !== undefined && (ts.isArrowFunction(pose) || ts.isFunctionExpression(pose))) {
                poses.push(instrumentPose({ pose, source, out }));
                return;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    if (poses.length === 0) return undefined;
    // At the end, since imports are hoisted, so that a JSX pragma in the file's first comment stays first
    out.append(`\nimport { readKnob as ${READ_KNOB}, markPose as ${MARK_POSE} } from ${JSON.stringify(runtimeModule)};\n`);
    return { code: out.toString(), map: out.generateMap({ hires: true, source: fileName, includeContent: true }), poses };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The functions that declare visual tests. */
const VISUAL_TESTS: ReadonlySet<string> = new Set(['canvasTest', 'htmlTest']);

/** The names of the runtime's functions in the instrumented code, chosen so they can't clash with a test file's own names. */
const READ_KNOB = '__viewPreviewKnob';
const MARK_POSE = '__viewPreviewPose';

interface Literal {
    readonly kind: KnobKind;
    readonly value: KnobValue;
}

/** Replaces the literals in one pose with knobs, wraps the pose, and returns its knobs. */
function instrumentPose(options: { readonly pose: ts.ArrowFunction | ts.FunctionExpression; readonly source: ts.SourceFile; readonly out: MagicString }): PoseInfo {
    const { pose, source, out } = options;
    const start = pose.getStart(source);
    const where = source.getLineAndCharacterOfPosition(start);
    const id = `${where.line + 1}:${where.character + 1}`;
    const knobs: KnobInfo[] = [];
    const visit = (node: ts.Node): void => {
        // A literal in a type, such as `'easy'` in `Promise<'easy'>`, isn't a value
        if (ts.isTypeNode(node)) return;
        const literal = readLiteral(node, source);
        if (literal !== undefined && canBeKnob(node)) {
            const nodeStart = node.getStart(source);
            const at = source.getLineAndCharacterOfPosition(nodeStart);
            const index = knobs.length;
            knobs.push({ index, kind: literal.kind, label: findLabel({ node, pose, source }), line: at.line + 1, column: at.character + 1, value: literal.value });
            const call = `${READ_KNOB}(${JSON.stringify(id)}, ${index}, ${node.getText(source)})`;
            // A JSX attribute's string, as in `hint="Swipe"`, needs braces round a call
            out.overwrite(nodeStart, node.end, ts.isJsxAttribute(node.parent) ? `{${call}}` : call);
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(pose, visit);
    const info: PoseInfo = { id, line: where.line + 1, column: where.character + 1, knobs };
    out.appendLeft(start, `${MARK_POSE}(${JSON.stringify(info)}, `);
    out.appendRight(pose.end, ')');
    return info;
}

/** Returns the literal a node is, or `undefined` if it isn't one. A negative number is a minus sign before a number. */
function readLiteral(node: ts.Node, source: ts.SourceFile): Literal | undefined {
    if (ts.isNumericLiteral(node)) {
        const text = node.getText(source);
        const value = Number(text.replaceAll('_', ''));
        return { kind: /^0x[0-9a-f]{6}$/i.test(text.replaceAll('_', '')) ? 'color' : 'number', value };
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
        return { kind: 'number', value: -Number(node.operand.getText(source).replaceAll('_', '')) };
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'boolean', value: true };
    if (node.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'boolean', value: false };
    if (ts.isStringLiteral(node)) return { kind: 'string', value: node.text };
    return undefined;
}

/** Returns whether a literal holds a value, rather than naming a property or a module. */
function canBeKnob(node: ts.Node): boolean {
    const parent = node.parent;
    if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyAccessExpression(parent)) && parent.name === node) return false;
    if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) return false;
    return true;
}

/**
 * Returns what a literal sets, for its knob's label. That's the property,
 * attribute, variable or parameter whose value it is. Or it's the call that
 * it's an argument of, such as `pose arg 3`. The search looks out from the
 * literal as far as the pose.
 */
function findLabel(options: { readonly node: ts.Node; readonly pose: ts.Node; readonly source: ts.SourceFile }): string {
    const { pose, source } = options;
    let child = options.node;
    while (child !== pose) {
        const current = child.parent;
        if (ts.isPropertyAssignment(current) && current.initializer === child) return current.name.getText(source);
        if (ts.isJsxAttribute(current)) return current.name.getText(source);
        if ((ts.isVariableDeclaration(current) || ts.isParameter(current)) && current.initializer === child) return current.name.getText(source);
        if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.EqualsToken && current.right === child) return current.left.getText(source);
        if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
            const index = current.arguments?.indexOf(child as ts.Expression) ?? -1;
            if (index >= 0) return `${findCalleeName(current.expression, source)} arg ${index + 1}`;
        }
        child = current;
    }
    return 'value';
}

/** Returns the name a call is made by: `openPuzzle` for `model.openPuzzle(...)`. */
function findCalleeName(callee: ts.Expression, source: ts.SourceFile): string {
    if (ts.isIdentifier(callee)) return callee.text;
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
    const text = callee.getText(source);
    return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}

/** Returns the name at the root of a callee, such as `canvasTest` for `canvasTest.each(cases)`. */
function findRootName(callee: ts.Expression): string | undefined {
    if (ts.isIdentifier(callee)) return callee.text;
    if (ts.isPropertyAccessExpression(callee)) return findRootName(callee.expression);
    if (ts.isCallExpression(callee)) return findRootName(callee.expression);
    return undefined;
}
