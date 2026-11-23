import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/pixi';
import { toDayNumber } from '../../shared';
import { LEAN_MS, TURN_MS } from '../data';
import { createGameModel, type GameModel } from './game-model';

describe('turning the pages', () => {
    it('opens on the next spread once a page has turned all the way, and ignores other turns meanwhile', async () => {
        const model = createPaper();
        model.turnForward();
        await advanceTime(TURN_MS / 2, model);
        model.turnForward();
        model.turnBack();
        expect(model.spread).toBe(0);
        await advanceTime(TURN_MS, model);
        expect(model.spread).toBe(1);
        expect(model.mode).toBe('reading');
        expect(model.pagesTurned).toBe(1);
    });

    it('turns no further than the back page, nor back past the front page', async () => {
        const model = createPaper();
        model.turnBack();
        expect(model.mode).toBe('reading');
        for (let i = 0; i < model.spreadCount + 2; i++) {
            model.turnForward();
            await advanceTime(TURN_MS, model);
        }
        expect(model.spread).toBe(model.spreadCount - 1);
        expect(model.pagesTurned).toBe(model.spreadCount - 1);
    });
});

describe('playing a puzzle', () => {
    it('leans in to the puzzle on the spread, plays it, then leans back to read again', async () => {
        const model = createPaper();
        model.turnForward();
        await advanceTime(TURN_MS, model);
        const puzzle = model.puzzleOnSpread;
        expect(puzzle).toBeDefined();
        model.playPuzzle();
        await advanceTime(LEAN_MS, model);
        expect(model.mode).toBe('playing');
        expect(model.puzzleInPlay).toBe(puzzle);
        expect(model.lean).toBe(1);
        model.stopPlaying();
        await advanceTime(LEAN_MS, model);
        expect(model.mode).toBe('reading');
        expect(model.puzzleInPlay).toBeUndefined();
    });

    it('leans back as far as it had leant in, without a jump, when stopped part way in', async () => {
        const model = createPaper();
        model.turnForward();
        await advanceTime(TURN_MS, model);
        model.playPuzzle();
        await advanceTime(LEAN_MS / 4, model);
        const lean = model.lean;
        model.stopPlaying();
        expect(model.lean).toBeCloseTo(lean);
        await advanceTime(LEAN_MS / 4, model);
        expect(model.mode).toBe('reading');
    });

    it('doesn\'t lean in on the front page, which has no puzzle', () => {
        const model = createPaper();
        model.playPuzzle();
        expect(model.mode).toBe('reading');
    });

    it('turns no page while the reader is leant in', async () => {
        const model = createPaper();
        model.turnForward();
        await advanceTime(TURN_MS, model);
        model.playPuzzle();
        model.turnForward();
        await advanceTime(LEAN_MS, model);
        expect(model.spread).toBe(1);
        expect(model.mode).toBe('playing');
    });
});

function createPaper(): GameModel {
    return createGameModel({ day: toDayNumber({ year: 2026, month: 11, day: 21 }), puzzleAspects: [0.7, 0.7, 0.7] });
}
