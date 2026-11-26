import ts from 'typescript';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One `canvasTest` or `htmlTest` call in a test file. */
export interface VisualTestCall {
    readonly call: ts.CallExpression;
    /** Its pose, if it's written in place as an arrow function or a function expression. */
    readonly pose: ts.ArrowFunction | ts.FunctionExpression | undefined;
    /** Its name, if it's a plain string, or `undefined` for a name that's worked out as the file runs. */
    readonly name: string | undefined;
    /** Where the pose starts, from 1, which names the pose within its file. A pose passed by name starts at the call. */
    readonly line: number;
    readonly column: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the visual tests that a test file declares, in the order they're
 * written. Each is a call of `canvasTest` or `htmlTest`, in any of their
 * forms, such as `canvasTest.skip` or `canvasTest.each(cases)`. A call inside a
 * loop or a `describe` block is listed once, though it declares a test each
 * time it runs.
 */
export function findVisualTests(source: ts.SourceFile): readonly VisualTestCall[] {
    const found: VisualTestCall[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && VISUAL_TESTS.has(findRootName(node.expression) ?? '')) {
            const last = node.arguments[node.arguments.length - 1];
            const pose = last !== undefined && (ts.isArrowFunction(last) || ts.isFunctionExpression(last)) ? last : undefined;
            // `canvasTest.each(cases)` is itself a call to `canvasTest`, but its last argument is the cases
            if (pose !== undefined || node.arguments.length >= 2) {
                const first = node.arguments[0];
                const name = first !== undefined && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) ? first.text : undefined;
                const at = source.getLineAndCharacterOfPosition((pose ?? node).getStart(source));
                found.push({ call: node, pose, name, line: at.line + 1, column: at.character + 1 });
                return;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}

/** Returns whether a path is a visual test file's. That's a `.test.ts` or `.test.tsx` file in a `visual-tests` folder. */
export function isVisualTestFile(path: string): boolean {
    return /[\\/]visual-tests[\\/][^\\/]+\.test\.tsx?$/.test(path);
}

/** Parses a test file's code, as TypeScript, or TSX if its name says so. */
export function parseTestFile(options: { readonly code: string; readonly fileName: string }): ts.SourceFile {
    const { code, fileName } = options;
    const scriptKind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, scriptKind);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The functions that declare visual tests. */
const VISUAL_TESTS: ReadonlySet<string> = new Set(['canvasTest', 'htmlTest']);

/** Returns the name at the root of a callee, such as `canvasTest` for `canvasTest.each(cases)`. */
function findRootName(callee: ts.Expression): string | undefined {
    if (ts.isIdentifier(callee)) return callee.text;
    if (ts.isPropertyAccessExpression(callee)) return findRootName(callee.expression);
    if (ts.isCallExpression(callee)) return findRootName(callee.expression);
    return undefined;
}
