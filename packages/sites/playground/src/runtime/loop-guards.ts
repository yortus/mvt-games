import { parse } from 'acorn';
import { simple as walk } from 'acorn-walk';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AddLoopGuardsOptions {
    /** A module's JavaScript, after its types are stripped. */
    readonly code: string;
    /** The file's path, to say where a loop is. */
    readonly path: string;
    /** Where each guarded loop is, as `path:line`. The guards added here are pushed onto it. */
    readonly loops: string[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Adds a guard to the top of each loop's body that may never end, on the
 * same line, so line numbers hold. A guard counts down a budget kept in the
 * module, and when it runs out, every 4096 turns, calls the sandbox's
 * `__pgLoopCheck`. The check refills the budget, and throws if the current
 * frame has run for more than a second, naming the loop.
 *
 * Counted loops (`for (let i = 0; i < n; i++)`) end by themselves, and go
 * unguarded. They are the hot loops of most games, and leaving them out is
 * what keeps the guards cheap.
 */
export function addLoopGuards(options: AddLoopGuardsOptions): string {
    const { code, path, loops } = options;
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const edits: Edit[] = [];
    const guard = (node: LoopNode): void => {
        if (isCountedLoop(node)) return;
        const id = loops.length;
        loops.push(`${path}:${node.loc.start.line}`);
        const check = `if(--__pgBudget<0)__pgCheck(${id});`;
        const body = node.body;
        if (body.type === 'BlockStatement') {
            edits.push({ at: body.start + 1, text: check });
        }
        else {
            edits.push({ at: body.start, text: `{${check}` });
            edits.push({ at: body.end, text: '}' });
        }
    };
    walk(ast, {
        ForStatement: guard as never,
        ForInStatement: guard as never,
        ForOfStatement: guard as never,
        WhileStatement: guard as never,
        DoWhileStatement: guard as never,
    });
    if (edits.length === 0) return code;

    edits.sort((a, b) => b.at - a.at);
    let out = code;
    for (const edit of edits) out = out.slice(0, edit.at) + edit.text + out.slice(edit.at);
    // On the first line, so line numbers hold
    return `${BUDGET_PRELUDE}${out}`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BUDGET_PRELUDE = 'let __pgBudget=4096;const __pgCheck=(id)=>{__pgBudget=4096;globalThis.__pgLoopCheck(id);};';

interface Edit {
    readonly at: number;
    readonly text: string;
}

/** The parts of acorn's loop nodes that the guards read. */
interface LoopNode {
    readonly type: string;
    readonly loc: { readonly start: { readonly line: number } };
    readonly body: SyntaxNode;
    readonly init?: SyntaxNode;
    readonly test?: SyntaxNode;
    readonly update?: SyntaxNode;
}

/** A syntax node, read loosely: only the fields the counted-loop test looks at. */
interface SyntaxNode {
    readonly type: string;
    readonly start: number;
    readonly end: number;
    readonly [field: string]: unknown;
}

/**
 * Whether a loop is `for (let i = ...; i < n; i++)`, which ends by itself.
 * The comparison may be `<`, `<=`, `>` or `>=`, and may be the left side of
 * `&&`. The step may be `++`, `--`, `+=` or `-=`. The bound `n` must be a
 * name or a number, not something like `arr.length`, which the body may
 * grow. And the body must assign neither `i` nor `n`.
 */
function isCountedLoop(node: LoopNode): boolean {
    if (node.type !== 'ForStatement' || node.init?.type !== 'VariableDeclaration') return false;
    const declarations = node.init.declarations as readonly { id: SyntaxNode }[];
    const name = nameOf(declarations[0]?.id);
    if (name === undefined) return false;

    let test = node.test;
    while (test?.type === 'LogicalExpression' && test.operator === '&&') test = test.left as SyntaxNode;
    if (test?.type !== 'BinaryExpression' || !COMPARISONS.has(test.operator as string)) return false;
    if (nameOf(test.left as SyntaxNode) !== name) return false;
    const bound = test.right as SyntaxNode;
    const boundName = nameOf(bound);
    const isNumber = bound.type === 'Literal' || (bound.type === 'UnaryExpression' && (bound.argument as SyntaxNode).type === 'Literal');
    if (boundName === undefined && !isNumber) return false;

    const update = node.update;
    const isStep = (update?.type === 'UpdateExpression' && nameOf(update.argument as SyntaxNode) === name)
        || (update?.type === 'AssignmentExpression' && STEPS.has(update.operator as string) && nameOf(update.left as SyntaxNode) === name);
    if (!isStep) return false;

    const watched = new Set(boundName === undefined ? [name] : [name, boundName]);
    let isAssigned = false;
    walk(node.body as never, {
        AssignmentExpression(n) {
            const assigned = nameOf(n.left as unknown as SyntaxNode);
            if (assigned !== undefined && watched.has(assigned)) isAssigned = true;
        },
        UpdateExpression(n) {
            const assigned = nameOf(n.argument as unknown as SyntaxNode);
            if (assigned !== undefined && watched.has(assigned)) isAssigned = true;
        },
    });
    return !isAssigned;
}

const COMPARISONS = new Set(['<', '<=', '>', '>=']);
const STEPS = new Set(['+=', '-=']);

function nameOf(node: SyntaxNode | undefined): string | undefined {
    return node?.type === 'Identifier' ? (node.name as string) : undefined;
}
