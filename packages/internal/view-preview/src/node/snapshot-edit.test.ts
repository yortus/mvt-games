import { describe, expect, it } from 'vitest';
import type { KnobValue, SnapshotEdit } from '../shared';
import { findVisualTests, parseTestFile } from './find-visual-tests';
import { listKnobLiterals } from './knob-literals';
import { createSnapshotEdit } from './snapshot-edit';

const FILE = 'hud-view.test.tsx';

/** Takes a snapshot of the test whose name is `of`, as the preview would ask for one, and returns the edit and the code with it applied. */
function snapshot(code: string, options: { readonly of: string; readonly values: readonly (readonly [number, KnobValue])[]; readonly name: string }) {
    const source = parseTestFile({ code, fileName: FILE });
    const test = findVisualTests(source).find((candidate) => candidate.name === options.of)!;
    const literals = test.pose === undefined ? [] : listKnobLiterals({ pose: test.pose, source }).map((literal) => literal.value);
    const edit: SnapshotEdit = createSnapshotEdit({
        code,
        request: { file: FILE, poseLine: test.line, poseColumn: test.column, literals, values: options.values, name: options.name },
    });
    return { edit, code: edit.kind === 'insert' ? code.slice(0, edit.offset) + edit.text + code.slice(edit.offset) : code };
}

describe('createSnapshotEdit', () => {
    it('copies the test below it, with the new name and the changed knobs written as their literals were', () => {
        const code = [
            `describe('hud', () => {`,
            `    canvasTest('a score', SIZE, () => HudView({ score: () => 98_765, hint: "Swipe", tint: 0xFF8800, isLit: true, at: 0.5 })); // a note`,
            `});`,
        ].join('\n');
        const result = snapshot(code, { of: 'a score', values: [[0, 120], [1, 'Tap "here"'], [2, 0x00aaff], [3, false], [4, 0.1 + 0.2]], name: 'a low score, it\'s lit' });
        expect(result.code.split('\n')).toEqual([
            `describe('hud', () => {`,
            `    canvasTest('a score', SIZE, () => HudView({ score: () => 98_765, hint: "Swipe", tint: 0xFF8800, isLit: true, at: 0.5 })); // a note`,
            `    canvasTest('a low score, it\\'s lit', SIZE, () => HudView({ score: () => 120, hint: "Tap \\"here\\"", tint: 0x00AAFF, isLit: false, at: 0.3 }));`,
            `});`,
        ]);
        expect(result.edit).toMatchObject({ line: 3, column: 5 });
    });

    it('keeps a JSX attribute\'s string as an attribute, unless it needs a double quote', () => {
        const code = `canvasTest('hint', () => <HudView hint="Swipe" label="Go" />);`;
        const result = snapshot(code, { of: 'hint', values: [[0, 'Tap'], [1, 'Say "go"']], name: 'tap' });
        expect(result.code.split('\n')[1]).toBe(`canvasTest('tap', () => <HudView hint="Tap" label={'Say "go"'} />);`);
    });

    it('refuses a test in a loop, a test for a table of cases, and a name that\'s taken', () => {
        const looped = `for (const n of [1, 2]) {\n    canvasTest('at', () => HudView({ score: () => n * 2 }));\n}`;
        const cases = `canvasTest.each([[1]])('a', (n) => HudView({ score: () => n * 2 }));`;
        const taken = `canvasTest('a', () => HudView({ score: () => 1 }));\ncanvasTest('b', poseB);`;
        expect(snapshot(looped, { of: 'at', values: [[0, 3]], name: 'x' }).edit).toMatchObject({ kind: 'refused', reason: expect.stringContaining('loop') });
        expect(snapshot(cases, { of: 'a', values: [[0, 3]], name: 'x' }).edit).toMatchObject({ kind: 'refused', reason: expect.stringContaining('.each') });
        expect(snapshot(taken, { of: 'a', values: [[0, 3]], name: 'b' }).edit).toMatchObject({ kind: 'refused', reason: expect.stringContaining('already') });
    });

    it('refuses once the file\'s literals differ from those the preview loaded', () => {
        const code = `canvasTest('a', () => HudView({ score: () => 1 }));`;
        const edit = createSnapshotEdit({ code, request: { file: FILE, poseLine: 1, poseColumn: 17, literals: [2], values: [[0, 3]], name: 'b' } });
        expect(edit).toMatchObject({ kind: 'refused', reason: expect.stringContaining('changed') });
    });
});
