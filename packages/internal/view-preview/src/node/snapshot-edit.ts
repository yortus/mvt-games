import ts from 'typescript';
import type { KnobValue, SnapshotEdit, SnapshotRequest } from '../shared';
import { findVisualTests, parseTestFile } from './find-visual-tests.ts';
import { type KnobLiteral, listKnobLiterals } from './knob-literals.ts';

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the edit that adds a snapshot test to a test file's code. It
 * copies the statement that declares the previewed test, with the new name,
 * and with each changed knob's value in place of its literal. The rest of
 * the copy is written as the original is. The copy goes on the line after
 * the original, with the same indent.
 *
 * It refuses a test declared in a loop, or for a table of cases with
 * `.each` or `.for`. A copy of one would declare a test for each turn or
 * case, all with one name. It also refuses a name that a test in the file already
 * has, and a file that has changed since the preview loaded it.
 */
export function createSnapshotEdit(options: { readonly code: string; readonly request: SnapshotRequest }): SnapshotEdit {
    const { code, request } = options;
    const source = parseTestFile({ code, fileName: request.file });
    const tests = findVisualTests(source);
    const test = tests.find((candidate) => candidate.pose !== undefined && candidate.line === request.poseLine && candidate.column === request.poseColumn);
    const literals = test?.pose === undefined ? undefined : listKnobLiterals({ pose: test.pose, source });
    if (test === undefined || literals === undefined || !haveValues(literals, request.literals)) {
        return refuse('The test file has changed since the preview loaded it. Save it, let the preview reload, and take the snapshot again.');
    }
    if (ts.isCallExpression(test.call.expression)) {
        return refuse('This test is declared for a table of cases, with .each or .for, so a copy of it would declare every case again. Add the new test by hand.');
    }
    for (let node = test.call.parent; node !== source; node = node.parent) {
        if (ts.isIterationStatement(node, false)) return refuse('This test is declared in a loop, so a copy of it would declare a test on each turn, all with one name. Add the new test by hand.');
    }
    const statement = test.call.parent;
    const nameArgument = test.call.arguments[0];
    if (!ts.isExpressionStatement(statement) || nameArgument === undefined) {
        return refuse('The preview can only copy a test declared in a statement of its own, such as canvasTest(name, pose).');
    }
    const name = request.name.trim();
    if (name === '') return refuse('The new test needs a name.');
    if (tests.some((other) => other.name === name)) return refuse(`The file already has a test named '${name}'. Pick another name.`);

    // The copy's changes, from last to first, so each leaves the places of those before it as they were
    const start = statement.getStart(source);
    const changes = [{ start: nameArgument.getStart(source), end: nameArgument.end, text: quote(name, "'") }];
    for (const [index, value] of request.values) {
        const literal = literals[index];
        if (literal === undefined || value === literal.value) continue;
        changes.push({ start: literal.node.getStart(source), end: literal.node.end, text: formatValue({ literal, value, source }) });
    }
    changes.sort((a, b) => b.start - a.start);
    let copy = code.slice(start, statement.end);
    for (const change of changes) copy = copy.slice(0, change.start - start) + change.text + copy.slice(change.end - start);

    const lineStart = code.lastIndexOf('\n', start - 1) + 1;
    const indent = /^[ \t]*/.exec(code.slice(lineStart, start))?.[0] ?? '';
    const newlineAt = code.indexOf('\n', statement.end);
    const isCrlf = newlineAt > 0 && code[newlineAt - 1] === '\r';
    const offset = newlineAt === -1 ? code.length : isCrlf ? newlineAt - 1 : newlineAt;
    const endLine = source.getLineAndCharacterOfPosition(statement.end).line;
    return { kind: 'insert', offset, text: `${isCrlf ? '\r\n' : '\n'}${indent}${copy}`, line: endLine + 2, column: indent.length + 1 };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function refuse(reason: string): SnapshotEdit {
    return { kind: 'refused', reason };
}

function haveValues(literals: readonly KnobLiteral[], values: readonly KnobValue[]): boolean {
    return literals.length === values.length && literals.every((literal, index) => literal.value === values[index]);
}

/** Returns a knob's value, written as its literal was. A colour stays in hex, and a string keeps its quotes, or stays a JSX attribute's string. */
function formatValue(options: { readonly literal: KnobLiteral; readonly value: KnobValue; readonly source: ts.SourceFile }): string {
    const { literal, value, source } = options;
    const original = literal.node.getText(source);
    if (literal.kind === 'boolean') return String(value === true);
    if (literal.kind === 'string') {
        const text = String(value);
        // A JSX attribute's string can't hold escapes, so one with a double quote becomes an expression
        if (ts.isJsxAttribute(literal.node.parent)) return text.includes('"') ? `{${quote(text, "'")}}` : `"${text}"`;
        return quote(text, original.startsWith('"') ? '"' : "'");
    }
    if (literal.kind === 'color') {
        const hex = Number(value).toString(16).padStart(6, '0');
        return `0x${/[A-F]/.test(original) ? hex.toUpperCase() : hex}`;
    }
    // A slider's steps can leave a number like 0.30000000000000004
    return String(Math.round(Number(value) * 1e6) / 1e6);
}

/** Returns a string literal for `text`, in the quotes given. */
function quote(text: string, mark: string): string {
    const escaped = text.replaceAll('\\', '\\\\').replaceAll(mark, `\\${mark}`).replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t');
    return `${mark}${escaped}${mark}`;
}
