import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { createDailyRecords } from './daily-records';
import { toDayNumber } from './day-numbers';

const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });
const LEVELS = ['easy', 'hardest'] as const;

describe('DailyRecords', () => {
    it('keeps puzzles by date and level, under the game\'s id, in names a person can read', () => {
        const store = createMemoryStore();
        const records = createDailyRecords({ store, gameId: 'test', levels: LEVELS });
        records.markSolved(TODAY, 'hardest');
        records.writePuzzle(TODAY - 1, 'easy', { marks: '012' });
        expect(store.readJson('mvt-arcade:test:records')).toEqual({ solved: ['2026-10-30/hardest'], started: ['2026-10-29/easy'] });
        expect(store.readJson('mvt-arcade:test:puzzle:2026-10-29/easy')).toEqual({ marks: '012' });
        expect(records.readPuzzle(TODAY - 1, 'easy')).toEqual({ marks: '012' });
    });

    it('forgets a puzzle\'s progress, so it is no longer started, unless it is solved', () => {
        const store = createMemoryStore();
        const records = createDailyRecords({ store, gameId: 'test', levels: LEVELS });
        records.writePuzzle(TODAY - 1, 'easy', { marks: '012' });
        records.writePuzzle(TODAY, 'easy', { marks: '345' });
        records.markSolved(TODAY, 'easy');
        records.forgetPuzzle(TODAY - 1, 'easy');
        records.forgetPuzzle(TODAY, 'easy');
        expect(records.readPuzzle(TODAY - 1, 'easy')).toBeUndefined();
        expect(records.readPuzzle(TODAY, 'easy')).toBeUndefined();
        expect(records.isStarted(TODAY - 1, 'easy')).toBe(false);
        expect(records.isStarted(TODAY, 'easy')).toBe(true);
        expect(store.readJson('mvt-arcade:test:records')).toEqual({ solved: ['2026-10-30/easy'], started: ['2026-10-30/easy'] });
    });

    it('skips names it cannot read, as an older version might have left', () => {
        const store = createMemoryStore();
        store.writeJson('mvt-arcade:test:records', { solved: ['2026-10-30/hardest', 'yesterday', 3, '2026-10-29/fiendish'], started: 'all' });
        store.write('mvt-arcade:test:level', 'fiendish');
        const records = createDailyRecords({ store, gameId: 'test', levels: LEVELS });
        expect(records.isSolved(TODAY, 'hardest')).toBe(true);
        expect(records.isStarted(TODAY, 'hardest')).toBe(true);
        expect(records.countSolved('hardest')).toBe(1);
        expect(records.chosenLevel).toBeUndefined();
    });

    it('remembers the level chosen, and the way in seen, for the next visit', () => {
        const store = createMemoryStore();
        const records = createDailyRecords({ store, gameId: 'test', levels: LEVELS });
        expect(records.isIntroSeen).toBe(false);
        records.rememberLevel('hardest');
        records.markIntroSeen();
        const next = createDailyRecords({ store, gameId: 'test', levels: LEVELS });
        expect(next.chosenLevel).toBe('hardest');
        expect(next.isIntroSeen).toBe(true);
    });
});

describe('DailyRecords, with a level renamed', () => {
    it('reads what was kept under the level\'s former name as the level\'s, and writes it under the new name', () => {
        const store = createMemoryStore();
        store.writeJson('mvt-arcade:test:records', { solved: ['2026-10-30/hardest'], started: ['2026-10-29/hardest'] });
        store.writeJson('mvt-arcade:test:puzzle:2026-10-29/hardest', { marks: '012' });
        store.write('mvt-arcade:test:level', 'hardest');
        const records = createDailyRecords({ store, gameId: 'test', levels: ['easy', 'expert'], formerLevelNames: { hardest: 'expert' } });
        expect(records.chosenLevel).toBe('expert');
        expect(records.isSolved(TODAY, 'expert')).toBe(true);
        expect(records.isStarted(TODAY - 1, 'expert')).toBe(true);
        expect(records.readPuzzle(TODAY - 1, 'expert')).toEqual({ marks: '012' });
        records.markSolved(TODAY - 1, 'expert');
        expect(store.readJson('mvt-arcade:test:records')).toEqual({
            solved: ['2026-10-30/expert', '2026-10-29/expert'], started: ['2026-10-29/expert', '2026-10-30/expert'],
        });
    });

    it('forgets what was kept under the level\'s former name too, so it is not read in its place', () => {
        const store = createMemoryStore();
        store.writeJson('mvt-arcade:test:records', { solved: [], started: ['2026-10-29/hardest'] });
        store.writeJson('mvt-arcade:test:puzzle:2026-10-29/hardest', { marks: '012' });
        const records = createDailyRecords({ store, gameId: 'test', levels: ['easy', 'expert'], formerLevelNames: { hardest: 'expert' } });
        records.forgetPuzzle(TODAY - 1, 'expert');
        expect(records.readPuzzle(TODAY - 1, 'expert')).toBeUndefined();
        expect(records.isStarted(TODAY - 1, 'expert')).toBe(false);
    });
});
