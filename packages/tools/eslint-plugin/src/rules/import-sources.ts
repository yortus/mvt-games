import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The part of an import's path node that the rules read: a string literal's value. */
export interface PathNode {
    readonly value?: unknown;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * The visitors that find every path a file imports from: `import`, `export
 * ... from`, `import()` with a literal path, and a type imported inline
 * (`import('../models/ship-model').ShipModel`). Each calls `check` with the
 * path's string literal, which a report can point at.
 */
export function visitImportSources(check: (source: PathNode) => void): Rule.RuleListener {
    return {
        'ImportDeclaration': (node: Rule.Node) => {
            if (node.type === 'ImportDeclaration') check(node.source);
        },
        'ExportNamedDeclaration, ExportAllDeclaration': (node: Rule.Node) => {
            if (node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportAllDeclaration') return;
            if (node.source) check(node.source);
        },
        'ImportExpression': (node: Rule.Node) => {
            if (node.type === 'ImportExpression' && node.source.type === 'Literal') check(node.source);
        },
        'TSImportType': (node: Rule.Node) => {
            check((node as unknown as TSImportType).source);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The part of typescript-eslint's `TSImportType` node that the rules read. */
interface TSImportType {
    readonly source: PathNode;
}
