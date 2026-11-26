import MagicString, { type SourceMap } from 'magic-string';
import ts from 'typescript';
import type { KnobInfo, PoseInfo } from '../shared';
import { findVisualTests, parseTestFile } from './find-visual-tests.ts';
import { listKnobLiterals } from './knob-literals.ts';

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
    const source = parseTestFile({ code, fileName });
    const out = new MagicString(code);
    const poses: PoseInfo[] = [];
    for (const test of findVisualTests(source)) {
        if (test.pose !== undefined) poses.push(instrumentPose({ pose: test.pose, source, out }));
    }
    if (poses.length === 0) return undefined;
    // At the end, since imports are hoisted, so that a JSX pragma in the file's first comment stays first
    out.append(`\nimport { readKnob as ${READ_KNOB}, markPose as ${MARK_POSE} } from ${JSON.stringify(runtimeModule)};\n`);
    return { code: out.toString(), map: out.generateMap({ hires: true, source: fileName, includeContent: true }), poses };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The names of the runtime's functions in the instrumented code, chosen so they can't clash with a test file's own names. */
const READ_KNOB = '__viewPreviewKnob';
const MARK_POSE = '__viewPreviewPose';

/** Replaces the literals in one pose with knobs, wraps the pose, and returns its knobs. */
function instrumentPose(options: { readonly pose: ts.ArrowFunction | ts.FunctionExpression; readonly source: ts.SourceFile; readonly out: MagicString }): PoseInfo {
    const { pose, source, out } = options;
    const start = pose.getStart(source);
    const where = source.getLineAndCharacterOfPosition(start);
    const id = `${where.line + 1}:${where.character + 1}`;
    const knobs = listKnobLiterals({ pose, source }).map(({ node, kind, value, label }, index): KnobInfo => {
        const nodeStart = node.getStart(source);
        const at = source.getLineAndCharacterOfPosition(nodeStart);
        const call = `${READ_KNOB}(${JSON.stringify(id)}, ${index}, ${node.getText(source)})`;
        // A JSX attribute's string, as in `hint="Swipe"`, needs braces round a call
        out.overwrite(nodeStart, node.end, ts.isJsxAttribute(node.parent) ? `{${call}}` : call);
        return { index, kind, label, line: at.line + 1, column: at.character + 1, value };
    });
    const info: PoseInfo = { id, line: where.line + 1, column: where.character + 1, knobs };
    out.appendLeft(start, `${MARK_POSE}(${JSON.stringify(info)}, `);
    out.appendRight(pose.end, ')');
    return info;
}
