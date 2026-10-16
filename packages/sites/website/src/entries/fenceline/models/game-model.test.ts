import { describe, expect, it } from 'vitest';
import { BLOW_OUT_POINTS, FARM_SPEED_UP, POINTS_PER_CELL, type RoundConfig, SHEEP_POINTS } from '../data';
import { DIRECTION_DELTA, type HeldDirection } from './common';
import { createGameModel, type GameModel } from './game-model';
import { FARM_FENCED_MS, READY_MS, ROUND_CLEAR_MS, SNAPPED_MS, START_LIVES } from './model-constants';

// A meadow of 30 rows and 40 columns. The farmhand starts at the bottom
// middle, at grid point (30, 20). Dust devils stand still, so a test can
// string wire round them.
const ROWS = 30;
const COLS = 40;
const STEP_MS = 1000 / 60;

const QUIET_ROUND: RoundConfig = {
    devilCount: 1,
    devilSpeed: 0,
    devilChase: 0,
    beetleSpeed: 0,
    startBeetles: 0,
    maxBeetles: 0,
    hatchIntervalMs: 60_000,
    sheepCount: 1,
    targetShare: 0.9,
    obstacles: [],
    devilStarts: [{ row: 10, col: 30 }],
    sheepStarts: [{ row: 27.5, col: 2.5 }],
};

/** A round cleared by fencing off one corner, with `clearCorner`. */
const QUICK_ROUND: Partial<RoundConfig> = { targetShare: 0.05, sheepCount: 0 };

/** Makes a game whose farms each have `roundCount` rounds like `round`, and gets it ready to play. */
function makeGame(round: Partial<RoundConfig> = {}, roundCount = 1, extraLifePoints?: number): GameModel {
    const rounds: RoundConfig[] = [];
    for (let i = 0; i < roundCount; i++) rounds.push({ ...QUIET_ROUND, ...round });
    const game = createGameModel({ rounds, rows: ROWS, cols: COLS, extraLifePoints });
    run(game, READY_MS);
    return game;
}

/** Runs the game for `ms`, a frame at a time. */
function run(game: GameModel, ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) game.update(STEP_MS);
}

/**
 * Moves the farmhand through the grid points given, in straight lines.
 * Stops early if the game leaves play.
 */
function travel(game: GameModel, ...points: (readonly [number, number])[]): void {
    const input = game.playerInput;
    for (const [row, col] of points) {
        for (let frame = 0; frame < 2000; frame++) {
            const farmhand = game.farmhand;
            const isAtPoint = farmhand.row === farmhand.pointRow && farmhand.col === farmhand.pointCol;
            const nextRow = isAtPoint ? farmhand.pointRow : farmhand.pointRow + DIRECTION_DELTA[farmhand.direction][0];
            const nextCol = isAtPoint ? farmhand.pointCol : farmhand.pointCol + DIRECTION_DELTA[farmhand.direction][1];
            if (isAtPoint && nextRow === row && nextCol === col) break;
            input.direction = nextRow === row && nextCol === col ? 'none' : directionTowards(nextRow, nextCol, row, col);
            game.update(STEP_MS);
            if (game.phase !== 'playing') {
                input.direction = 'none';
                return;
            }
        }
    }
    input.direction = 'none';
}

/** Fences off the bottom left corner, 110 cells, which clears a `QUICK_ROUND`. */
function clearCorner(game: GameModel): void {
    travel(game, [30, 11], [20, 11], [20, 0]);
}

/** Walks the farmhand left along the fence for `ms`, and returns how far they went, in grid steps. */
function walkLeft(game: GameModel, ms: number): number {
    const startCol = game.farmhand.col;
    game.playerInput.direction = 'left';
    run(game, ms);
    game.playerInput.direction = 'none';
    return startCol - game.farmhand.col;
}

function directionTowards(row: number, col: number, toRow: number, toCol: number): HeldDirection {
    if (toRow < row) return 'up';
    if (toRow > row) return 'down';
    if (toCol < col) return 'left';
    if (toCol > col) return 'right';
    return 'none';
}

describe('GameModel', () => {
    it('gets ready, then plays', () => {
        const game = createGameModel({ rounds: [QUIET_ROUND], rows: ROWS, cols: COLS });
        expect(game.phase).toBe('ready');
        run(game, READY_MS);
        expect(game.phase).toBe('playing');
        expect(game.lives).toBe(START_LIVES);
    });

    it('fences off a corner with no dust devil in it, scoring its cells and penning its sheep', () => {
        const game = makeGame();
        travel(game, [30, 5], [24, 5], [24, 0]);
        expect(game.field.claimedCount).toBe(30);
        expect(game.sheep[0].phase).toBe('penned');
        expect(game.sheepPennedThisRound).toBe(1);
        expect(game.sheepPennedCount).toBe(1);
        expect(game.score).toBe(30 * POINTS_PER_CELL + SHEEP_POINTS);
        expect(game.lastClosurePoints).toBe(game.score);
        expect(game.farmhand.phase).toBe('walking');
        expect(game.field.isOnFence(game.farmhand.pointRow, game.farmhand.pointCol)).toBe(true);
    });

    it('snaps the wire when it touches a dust devil, and puts the farmhand back at its post', () => {
        const game = makeGame();
        travel(game, [30, 30], [11, 30]);
        expect(game.phase).toBe('snapped');
        expect(game.lives).toBe(START_LIVES - 1);
        expect(game.field.closureCount).toBe(0);
        run(game, SNAPPED_MS + 50);
        expect(game.phase).toBe('playing');
        expect(game.farmhand.row).toBe(30);
        expect(game.farmhand.col).toBe(30);
        expect(game.farmhand.wireLength).toBe(0);
    });

    it('blows out a dust devil fenced into a small region, and fences its region off', () => {
        const game = makeGame({ devilCount: 2, devilStarts: [{ row: 25, col: 5 }, { row: 10, col: 30 }], sheepCount: 0 });
        travel(game, [30, 11], [20, 11], [20, 0]);
        expect(game.devils[0].phase).toBe('blowing-out');
        expect(game.devils[1].phase).toBe('whirling');
        expect(game.devilsBlownOut).toBe(1);
        expect(game.field.claimedCount).toBe(110);
        expect(game.score).toBe(110 * POINTS_PER_CELL + BLOW_OUT_POINTS);
    });

    it('keeps open a region a dust devil is in, if it is big enough', () => {
        const game = makeGame({ devilCount: 2, devilStarts: [{ row: 22, col: 5 }, { row: 10, col: 30 }], sheepCount: 0 });
        expect(game.devils[0].size).toBe(1);
        expect(game.devils[0].isStarving).toBe(false);
        travel(game, [30, 11], [15, 11], [15, 0]);
        expect(game.devils[0].phase).toBe('whirling');
        expect(game.field.claimedCount).toBe(0);
        expect(game.field.closureCount).toBe(1);
        // 165 cells is under twice the 120 at which it would blow out, so it shrinks and starves
        expect(game.devils[0].size).toBeLessThan(0.6);
        expect(game.devils[0].isStarving).toBe(true);
        // The other still has most of the meadow
        expect(game.devils[1].size).toBe(1);
        expect(game.devils[1].isStarving).toBe(false);
    });

    it('clears the round once its share is fenced off, with a bonus for each percent over', () => {
        const game = makeGame(QUICK_ROUND, 2);
        clearCorner(game);
        expect(game.phase).toBe('round-clear');
        // 110 of 1200 cells is 9.2%, 4 whole percent over the target
        expect(game.roundBonus).toBe(4 * 1000);
        expect(game.score).toBe(110 * POINTS_PER_CELL + 4000);
        run(game, ROUND_CLEAR_MS + 50);
        expect(game.round).toBe(2);
        expect(game.farm).toBe(1);
        expect(game.phase).toBe('ready');
        expect(game.field.claimedCount).toBe(0);
    });

    it('fences the farm once its last round is cleared, then starts the next farm, faster', () => {
        const game = makeGame(QUICK_ROUND, 2);
        clearCorner(game);
        run(game, ROUND_CLEAR_MS + 50 + READY_MS);
        clearCorner(game);
        expect(game.round).toBe(2);
        run(game, ROUND_CLEAR_MS + 50);
        expect(game.phase).toBe('farm-fenced');
        expect(game.phaseMs).toBeLessThan(100);
        run(game, FARM_FENCED_MS);
        expect(game.phase).toBe('ready');
        expect(game.round).toBe(3);
        expect(game.farm).toBe(2);
        expect(game.speed).toBe(FARM_SPEED_UP);
    });

    it('runs everything faster on a later farm, the farmhand too', () => {
        const firstFarm = makeGame(QUICK_ROUND);
        const secondFarm = makeGame(QUICK_ROUND);
        clearCorner(secondFarm);
        run(secondFarm, ROUND_CLEAR_MS + FARM_FENCED_MS + READY_MS + 100);
        expect(secondFarm.farm).toBe(2);
        expect(secondFarm.phase).toBe('playing');
        expect(walkLeft(secondFarm, 400) / walkLeft(firstFarm, 400)).toBeCloseTo(FARM_SPEED_UP, 2);
    });

    it('loses the sheep left out in the meadow when the round is cleared', () => {
        const game = makeGame({ targetShare: 0.05, sheepStarts: [{ row: 5.5, col: 5.5 }] });
        clearCorner(game);
        expect(game.phase).toBe('round-clear');
        expect(game.sheep[0].phase).toBe('lost');
    });

    it('gives an extra life for each mark of points the score passes', () => {
        // Fencing off the corner scores its 30 cells and its sheep
        const points = 30 * POINTS_PER_CELL + SHEEP_POINTS;
        const lifePoints = Math.floor(points / 2) - 1;
        const game = makeGame({}, 1, lifePoints);
        travel(game, [30, 5], [24, 5], [24, 0]);
        expect(game.score).toBe(points);
        expect(game.extraLivesEarned).toBe(2);
        expect(game.lives).toBe(START_LIVES + 2);
        game.reset();
        expect(game.extraLivesEarned).toBe(0);
        expect(game.lives).toBe(START_LIVES);
    });

    it('loses a life to a beetle that reaches the farmhand', () => {
        const game = makeGame({ startBeetles: 1, maxBeetles: 1, beetleSpeed: 20 });
        run(game, 5000);
        expect(game.lives).toBe(START_LIVES - 1);
    });

    it('ends the game when the last life is lost, and starts again on restart', () => {
        const game = makeGame({ startBeetles: 2, maxBeetles: 2, beetleSpeed: 25 });
        for (let i = 0; i < 100 && game.phase !== 'game-over'; i++) run(game, 1000);
        expect(game.phase).toBe('game-over');
        expect(game.lives).toBe(0);
        game.playerInput.restartPressed = true;
        game.update(STEP_MS);
        game.playerInput.restartPressed = false;
        expect(game.phase).toBe('ready');
        expect(game.lives).toBe(START_LIVES);
        expect(game.score).toBe(0);
    });

    it('moves a beetle left in new pasture to a fence well clear of the farmhand, not onto them', () => {
        // The third beetle starts on the left edge at (15, 0). The wire ties
        // off on the left edge at (13, 0), the nearest fence point to it.
        const game = makeGame({ startBeetles: 3, maxBeetles: 3, beetleSpeed: 0 });
        travel(game, [30, 5], [13, 5], [13, 0]);
        expect(game.field.closureCount).toBe(1);
        expect(game.phase).toBe('playing');
        const beetle = game.beetles[2];
        expect(game.field.isOnFence(beetle.row, beetle.col)).toBe(true);
        const distance = Math.hypot(beetle.row - game.farmhand.row, beetle.col - game.farmhand.col);
        expect(distance).toBeGreaterThanOrEqual(15);
        run(game, 500);
        expect(game.lives).toBe(START_LIVES);
    });

    it('hatches beetles as the round goes on, up to the most there can be', () => {
        const game = makeGame({ startBeetles: 0, maxBeetles: 2, hatchIntervalMs: 1000 });
        run(game, 3500);
        expect(game.beetles.length).toBe(2);
        expect(game.beetlesHatched).toBe(2);
    });
});
