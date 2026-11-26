import { describe, expect, it } from 'vitest';
import { instrumentKnobs } from './instrument-knobs';

const RUNTIME = '/runtime/knobs.ts';

function instrument(code: string, fileName = 'hud-view.test.tsx') {
    return instrumentKnobs({ code, fileName, runtimeModule: RUNTIME });
}

describe('instrumentKnobs', () => {
    it('turns each literal in a pose into a knob, labelled by what it sets', () => {
        const result = instrument([
            `canvasTest('a score', SIZE, () => HudView({ score: () => -1230, hint: 'Swipe', isLit: true, tint: 0xff8800, width: SCREEN_WIDTH }));`,
            `canvasTest('flying', SIZE, () => pose(openToday, swapOneHome, 180));`,
        ].join('\n'))!;
        expect(result.poses.map((pose) => pose.knobs.map((knob) => [knob.label, knob.kind, knob.value]))).toEqual([
            [['score', 'number', -1230], ['hint', 'string', 'Swipe'], ['isLit', 'boolean', true], ['tint', 'color', 0xff8800]],
            [['pose arg 3', 'number', 180]],
        ]);
        const [first, second] = result.poses;
        expect(result.code).toContain(`__viewPreviewKnob("${first.id}", 0, -1230)`);
        expect(result.code).toContain(`__viewPreviewPose({"id":"${second.id}"`);
    });

    it('leaves out literals in types, property names, test names, options and poses defined elsewhere', () => {
        const result = instrument([
            `canvasTest('a', { pixelArt: false }, () => make<'easy'>({ 'key': x }));`,
            `canvasTest('b', poseB);`,
        ].join('\n'))!;
        expect(result.poses.map((pose) => pose.knobs)).toEqual([[]]);
    });

    it('wraps a JSX attribute\'s string in braces, and finds poses declared with modifiers and cases', () => {
        const result = instrument(`canvasTest.skip.each([[1]])('%s', (n) => <HudView hint="Swipe" score={() => n * 2} />);`)!;
        expect(result.poses[0].knobs.map((knob) => knob.label)).toEqual(['hint', 'score']);
        expect(result.code).toContain(`hint={__viewPreviewKnob(`);
    });

    it('keeps a JSX pragma in the file\'s first comment', () => {
        const result = instrument(`/** @jsxImportSource @mvtjs/pixi */\ncanvasTest('a', () => <HudView score={() => 1} />);`)!;
        expect(result.code.startsWith('/** @jsxImportSource @mvtjs/pixi */')).toBe(true);
    });

    it('leaves a file without poses written in place as it is', () => {
        expect(instrument(`import { x } from 'y';\ncanvasTest('a', poseA);`)).toBeUndefined();
    });
});
