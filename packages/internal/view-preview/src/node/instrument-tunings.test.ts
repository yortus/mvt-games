import { describe, expect, it } from 'vitest';
import { instrumentTunings } from './instrument-tunings';

const RUNTIME = '/runtime/tunings.ts';

function instrument(code: string, fileName = 'V:/game/models/ship-model.ts') {
    return instrumentTunings({ code, fileName, runtimeModule: RUNTIME });
}

describe('instrumentTunings', () => {
    it('registers each top-level tuning object, exported or not, with its fields and their docs', () => {
        const result = instrument([
            `/** How the ship moves. */`,
            `export const SHIP_TUNING = {`,
            `    /** How fast it moves, in world units a second. */`,
            `    speedPerSecond: 150,`,
            `    trailColor: 16777215,`,
            `    points: { scout: 40, carrier: -1 } as Readonly<Record<Kind, number>>,`,
            `    label: 'Fighter',`,
            `    isArmed: true,`,
            `    halfWidth: SIZE / 2,`,
            `};`,
            `const VIEW_TUNING = { glow: 0.5 } satisfies Tuning;`,
        ].join('\n'))!;
        expect(result.tunings.map((tuning) => [tuning.id, tuning.doc])).toEqual([
            ['V:/game/models/ship-model.ts#SHIP_TUNING', 'How the ship moves.'],
            ['V:/game/models/ship-model.ts#VIEW_TUNING', undefined],
        ]);
        expect(result.tunings[0].fields.map((field) => [field.path.join('.'), field.kind, field.value, field.line])).toEqual([
            ['speedPerSecond', 'number', 150, 4],
            ['trailColor', 'color', 16777215, 5],
            ['points.scout', 'number', 40, 6],
            ['points.carrier', 'number', -1, 6],
            ['label', 'string', 'Fighter', 7],
            ['isArmed', 'boolean', true, 8],
        ]);
        expect(result.tunings[0].fields[0].doc).toBe('How fast it moves, in world units a second.');
        expect(result.code).toContain('export const SHIP_TUNING = __viewPreviewTuning({"id":');
        expect(result.code).toContain(`const VIEW_TUNING = __viewPreviewTuning({"id":"V:/game/models/ship-model.ts#VIEW_TUNING"`);
        expect(result.code).toContain('{ glow: 0.5 } satisfies Tuning)');
    });

    it('leaves out objects inside functions, lets, other names and values that aren\'t object literals', () => {
        const result = instrument([
            `let LOOSE_TUNING = { a: 1 };`,
            `const SHIP_SPEED = { a: 1 };`,
            `const MADE_TUNING = makeTuning();`,
            `function f() { const INNER_TUNING = { a: 1 }; }`,
        ].join('\n'));
        expect(result).toBeUndefined();
    });
});
