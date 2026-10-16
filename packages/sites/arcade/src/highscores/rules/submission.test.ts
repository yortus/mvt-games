import { describe, expect, it } from 'vitest';
import { INITIALS_CHARACTERS, INITIALS_LENGTH } from './initials';
import { type GameRulesTable, findRefusal, findGameRules, type Submission } from './submission';

const GAMES: GameRulesTable = { 'some-game': { version: 1, maxScore: 1000 } };
const MAX_SCORE = GAMES['some-game'].maxScore;
const VALID: Submission = { gameId: 'some-game', initials: INITIALS_CHARACTERS[0].repeat(INITIALS_LENGTH), score: 1 };

describe('findRefusal', () => {
    it('takes a valid submission', () => {
        expect(findRefusal({ submission: VALID, games: GAMES })).toBeUndefined();
        expect(findRefusal({ submission: { ...VALID, score: MAX_SCORE }, games: GAMES })).toBeUndefined();
    });

    it('refuses a game without a table, including names every object has', () => {
        expect(findRefusal({ submission: { ...VALID, gameId: 'other-game' }, games: GAMES })).toBe('unknown-game');
        expect(findRefusal({ submission: { ...VALID, gameId: 'toString' }, games: GAMES })).toBe('unknown-game');
        expect(findRefusal({ submission: { ...VALID, gameId: '__proto__' }, games: GAMES })).toBe('unknown-game');
    });

    it('refuses initials that break the rules', () => {
        expect(findRefusal({ submission: { ...VALID, initials: ' '.repeat(INITIALS_LENGTH) }, games: GAMES })).toBe('bad-initials');
    });

    it('refuses a score that is not a whole number from 1 to the cap', () => {
        for (const score of [0, -1, 0.5, MAX_SCORE + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(findRefusal({ submission: { ...VALID, score }, games: GAMES }), `${score}`).toBe('bad-score');
        }
    });

    it('takes any game, and any whole score from 1, without a list of games', () => {
        expect(findRefusal({ submission: { ...VALID, gameId: 'other-game', score: MAX_SCORE * 1000 } })).toBeUndefined();
        expect(findRefusal({ submission: { ...VALID, score: Number.MAX_SAFE_INTEGER + 1 } })).toBe('bad-score');
    });
});

describe('findGameRules', () => {
    it('finds only games of its own', () => {
        expect(findGameRules(GAMES, 'some-game')).toBe(GAMES['some-game']);
        expect(findGameRules(GAMES, 'constructor')).toBeUndefined();
    });
});
