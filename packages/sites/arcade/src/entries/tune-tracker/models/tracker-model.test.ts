import { describe, expect, it } from 'vitest';
import { createTrackerModel } from './tracker-model';

const TUNE_COUNT = 4;

describe('createTrackerModel', () => {
    it('starts with the first tune chosen, and nothing playing', () => {
        const model = create();
        expect([model.tuneIndex, model.isPlaying, model.starts, model.playedMs]).toEqual([0, false, 0, 0]);
    });

    it('starts the tune chosen, counts how long it plays, and stops it at the next press', () => {
        const model = create();
        model.pressPlay();
        model.update(250);
        expect([model.isPlaying, model.starts, model.playedMs]).toEqual([true, 1, 250]);
        model.pressPlay();
        model.update(250);
        expect([model.isPlaying, model.starts, model.playedMs]).toEqual([false, 1, 0]);
    });

    it('starts a tune chosen while one plays, and only chooses one while none does', () => {
        const model = create();
        model.chooseTune(2);
        expect([model.tuneIndex, model.isPlaying, model.starts]).toEqual([2, false, 0]);
        model.pressPlay();
        model.update(1000);
        model.chooseTune(3);
        expect([model.tuneIndex, model.isPlaying, model.starts, model.playedMs]).toEqual([3, true, 2, 0]);
    });

    it('starts a tune played again from its beginning, even the one playing', () => {
        const model = create();
        model.playTune(1);
        model.update(500);
        model.playTune(1);
        expect([model.tuneIndex, model.isPlaying, model.starts, model.playedMs]).toEqual([1, true, 2, 0]);
    });

    it('moves the choice round and round, and ignores a tune it does not have', () => {
        const model = create();
        model.moveChoice(-1);
        expect(model.tuneIndex).toBe(TUNE_COUNT - 1);
        model.moveChoice(2);
        expect(model.tuneIndex).toBe(1);
        model.chooseTune(TUNE_COUNT);
        model.playTune(-1);
        expect([model.tuneIndex, model.starts]).toEqual([1, 0]);
    });
});

function create() {
    return createTrackerModel({ tuneCount: TUNE_COUNT });
}
