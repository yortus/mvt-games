import { describe, expect, it } from 'vitest';
import { type Level, LEVELS } from '../sudoku-grid';
import { createDiggerModel, type DiggerModel, type DiggerPhase } from './digger-model';
import { LEVEL_SETTINGS, SEED_COUNT, TECHNIQUE_LEVEL } from './model-constants';
import { countSolutions } from './test-grids.test-support';

describe('the digger model', () => {
    it('makes the same puzzle from the same seed, however its time is split into frames', () => {
        const short = createDiggerModel({ seed: 11, level: 'hard' });
        const long = createDiggerModel({ seed: 11, level: 'hard' });
        runUntilFinished(short, 16);
        runUntilFinished(long, 50);
        expect(readGrid(short)).toEqual(readGrid(long));
    });

    for (const level of LEVELS) {
        it(`makes a puzzle with one solution that keeps the ${level} level's limits, and comes out ${level}`, () => {
            const settings = LEVEL_SETTINGS[level];
            const model = createDiggerModel({ seed: 21, level });
            runUntilFinished(model, 1000);
            const puzzle = readGrid(model);
            expect(countSolutions(puzzle)).toBe(1);
            expect(model.grade).toBe(level);
            expect(model.digging.givensTarget).toBeGreaterThanOrEqual(settings.fewestGivens);
            expect(model.digging.givensTarget).toBeLessThanOrEqual(settings.mostGivens);
            expect(model.digging.givensCount).toBeGreaterThanOrEqual(model.digging.givensTarget);
            expect(puzzle.filter((digit) => digit !== 0).length).toBe(model.digging.givensCount);
            for (let line = 0; line < 9; line++) {
                expect(model.digging.givensInRow(line)).toBeGreaterThanOrEqual(settings.fewestPerLine);
                expect(model.digging.givensInColumn(line)).toBeGreaterThanOrEqual(settings.fewestPerLine);
            }
        });
    }

    it('goes through each phase in turn, then starts the next puzzle', () => {
        const model = createDiggerModel({ seed: 31, level: 'medium' });
        const phases: DiggerPhase[] = [];
        model.choosePlayback('fast');
        while (model.puzzlesFinished === 0 || model.phase === 'finished') {
            model.update(16);
            if (phases[phases.length - 1] !== model.phase) phases.push(model.phase);
        }
        // A grid the search gives up on is seeded again, so seeding and filling may take turns more than once
        expect(phases[0]).toBe('trying');
        const digging = phases.indexOf('digging');
        for (let i = 1; i < digging; i++) expect(phases[i]).toBe(i % 2 === 1 ? 'seeding' : 'filling');
        expect(phases.slice(digging - 2)).toEqual(['seeding', 'filling', 'digging', 'shuffling', 'grading', 'finished', 'trying']);
    });

    it('grades a finished puzzle by the hardest technique it needed, or Hardest if it needed guesswork', () => {
        for (let seed = 41; seed < 46; seed++) {
            const model = createDiggerModel({ seed, level: 'hardest' });
            runUntilFinished(model, 1000);
            const technique = model.grading.hardestTechnique;
            const expected: Level = model.grading.needsGuessing ? 'hardest' : technique === undefined ? 'easiest' : TECHNIQUE_LEVEL[technique];
            expect(model.grade).toBe(expected);
        }
    });

    it('marks each cell it digs, and counts the givens it leaves', () => {
        const model = createDiggerModel({ seed: 51, level: 'easy' });
        model.choosePlayback('fast');
        while (model.phase !== 'shuffling') model.update(16);
        let dug = 0;
        let needed = 0;
        let held = 0;
        for (let cell = 0; cell < 81; cell++) {
            const mark = model.digMarkAt(cell);
            if (mark === 'dug') dug++;
            if (mark === 'needed') needed++;
            if (mark === 'held') held++;
            expect(model.digitAt(cell) === 0).toBe(mark === 'dug');
        }
        expect(dug).toBe(model.digging.dug.count);
        expect(needed).toBe(model.digging.needed.count);
        expect(held).toBe(model.digging.held.count);
        expect(model.digging.givensCount).toBe(81 - dug);
    });

    it('tries puzzles out of sight without raising a count, then makes the one chosen in sight', () => {
        const model = createDiggerModel({ seed: 63, level: 'hard' });
        model.choosePlayback('paused');
        model.update(0);
        while (!model.trying.isGridChosen) {
            model.step();
            model.update(0);
            expect(model.phase).toBe('trying');
            expect(model.trying.gridsTried).toBeGreaterThan(0);
            expect([model.filling.seeds.count, model.search.tries.count, model.digging.dug.count, model.shuffling.count, model.grading.placements.count]).toEqual([0, 0, 0, 0, 0]);
        }
        const chosen = model.trying.triedGrade;
        const tries = model.trying.gridsTried;
        runUntilFinished(model, 1000);
        expect(model.grade).toBe(chosen);
        expect(model.trying.gridsTried).toBe(tries);
    });

    it('marks where a second solution differs from the full grid, as a cell is found needed', () => {
        const model = createDiggerModel({ seed: 71, level: 'hardest' });
        model.choosePlayback('fast');
        let seen = 0;
        while (seen < 3) {
            model.update(16);
            if (model.stepKind !== 'dig-needed') continue;
            seen++;
            const cell = model.digging.focusCell;
            expect(model.digging.needed.cell).toBe(cell);
            expect(model.isDifferentAt(cell)).toBe(true);
            expect(model.fullGridDigitAt(cell)).toBe(model.digging.originalDigit);
            expect(model.digitAt(cell)).toBe(model.digging.testDigit);
            // Two solutions of a Sudoku always differ in at least four cells
            let different = 0;
            for (let other = 0; other < 81; other++) {
                if (!model.isDifferentAt(other)) continue;
                different++;
                expect(model.digitAt(other)).not.toBe(model.fullGridDigitAt(other));
            }
            expect(different).toBeGreaterThanOrEqual(4);
            // The step holds, so the next update moves on before another is seen
            while (model.stepKind === 'dig-needed') model.update(16);
        }
    });

    it('rules out each rival digit it tries in the cell being dug, and keeps the cell for one that works', () => {
        const model = createDiggerModel({ seed: 73, level: 'hardest' });
        model.choosePlayback('fast');
        let verdicts = 0;
        while (verdicts < 20) {
            model.update(16);
            if (model.digging.testedCell < 0) continue;
            const own = 1 << model.digging.originalDigit;
            expect(model.digging.testedCell).toBe(model.digging.focusCell);
            expect(model.digging.rivalDigits & own).toBe(0);
            expect(model.digging.ruledOutDigits & ~model.digging.rivalDigits).toBe(0);
            if (model.stepKind === 'dig-dug' || model.stepKind === 'dig-only-digit') {
                // Dug: every rival led nowhere
                expect(model.digging.ruledOutDigits).toBe(model.digging.rivalDigits);
                verdicts++;
            }
            if (model.stepKind === 'dig-needed') {
                // Kept: the digit that worked is a rival, and not ruled out
                expect(model.digging.rivalDigits & (1 << model.digging.testDigit)).not.toBe(0);
                expect(model.digging.ruledOutDigits & (1 << model.digging.testDigit)).toBe(0);
                verdicts++;
            }
            const kind = model.stepKind;
            while (model.stepKind === kind && model.digging.testedCell >= 0) model.update(16);
        }
    });

    it('places its seeds one step at a time, as givens, once a puzzle is chosen', () => {
        const model = createDiggerModel({ seed: 61 });
        model.choosePlayback('paused');
        while (!model.trying.isGridChosen) {
            model.step();
            model.update(0);
        }
        for (let i = 0; i < SEED_COUNT; i++) {
            model.step();
            model.update(16);
            expect(model.filling.seeds.count).toBe(i + 1);
            expect(model.digitAt(model.filling.seeds.cell)).toBe(model.filling.seeds.digit);
        }
        const givens = readGrid(model).filter((digit) => digit !== 0).length;
        expect(givens).toBe(SEED_COUNT);
        expect(model.cellKindAt(model.filling.seeds.cell)).toBe('given');
    });

    it('stands still while paused, and takes one step for each step asked for', () => {
        const model = createDiggerModel({ seed: 71 });
        model.update(16);
        model.choosePlayback('paused');
        const steps = model.stepCount;
        for (let i = 0; i < 100; i++) model.update(16);
        expect(model.stepCount).toBe(steps);
        model.step();
        model.step();
        model.update(16);
        expect(model.stepCount).toBe(steps + 2);
    });

    it('runs four times as fast when fast, as normal', () => {
        const normal = createDiggerModel({ seed: 81 });
        const fast = createDiggerModel({ seed: 81 });
        fast.choosePlayback('fast');
        for (let i = 0; i < 248; i++) normal.update(16);
        for (let i = 0; i < 62; i++) fast.update(16);
        expect(fast.stepCount).toBe(normal.stepCount);
        expect(readGrid(fast)).toEqual(readGrid(normal));
    });

    it('starts a new puzzle for a level chosen, at the next update', () => {
        const model = createDiggerModel({ seed: 91, level: 'easy' });
        model.choosePlayback('fast');
        for (let i = 0; i < 300; i++) model.update(16);
        expect(model.phase).not.toBe('trying');
        model.chooseLevel('hardest');
        expect(model.level).toBe('easy');
        model.update(0);
        expect(model.level).toBe('hardest');
        expect(model.phase).toBe('trying');
        expect(model.trying.gridsTried).toBe(0);
        expect(model.filling.seeds.count).toBe(0);
    });

    it('makes each puzzle a level harder than the last, and Easiest after Hardest', () => {
        const model = createDiggerModel({ seed: 101, level: 'hardest' });
        runUntilFinished(model, 1000);
        while (model.phase === 'finished') model.update(1000);
        expect(model.level).toBe(LEVELS[0]);
    });
});

function runUntilFinished(model: DiggerModel, frameMs: number): void {
    model.choosePlayback('fast');
    while (model.phase !== 'finished') model.update(frameMs);
}

/** The digits the model shows, cell by cell. */
function readGrid(model: DiggerModel): Uint8Array {
    const grid = new Uint8Array(81);
    for (let cell = 0; cell < 81; cell++) grid[cell] = model.digitAt(cell);
    return grid;
}
