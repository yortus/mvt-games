import { describe, expect, it } from 'vitest';
import { BOSS_ATTACKS, STAGE_EVENTS, type BossAttackDef, type StageEvent } from '../data';
import { createGameModel, type GameModel } from './game-model';
import {
    BOMBS_PER_LIFE,
    BOSS_ENTER_MS,
    BOSS_EXPLODE_MS,
    DYING_MS,
    GRAZE_POINTS,
    INITIAL_LIVES,
    SHIP_START_Y,
    STEP_MS,
    TALLY_MS,
} from './model-constants';

// A quiet stage, so a test fires exactly the bullets it means to.
const NO_EVENTS: readonly StageEvent[] = [];

const ONE_WEAK_ATTACK: readonly BossAttackDef[] = [
    { kind: 'squall', health: 20, timeLimitMs: 30_000, swayX: 0, swayPeriodMs: 1000, patterns: [] },
];

function makeGame(events: readonly StageEvent[] = NO_EVENTS, bossAttacks: readonly BossAttackDef[] = BOSS_ATTACKS): GameModel {
    return createGameModel({ events, bossAttacks });
}

/** Run the game for `ms`, a frame at a time, as the host does. */
function play(game: GameModel, ms: number): void {
    const frames = Math.round(ms / STEP_MS);
    for (let i = 0; i < frames; i++) game.update(STEP_MS);
}

/** Fire a still bullet at the ship's position, or offset from it. */
function bulletAtShip(game: GameModel, dx = 0, dy = 0): void {
    game.enemyBullets.fire(game.ship.x + dx, game.ship.y + dy, 0, 'pellet-red', { speed: 0 });
}

describe('GameModel', () => {
    describe('the fixed step', () => {
        it('runs whole steps, carrying what is left to the next update', () => {
            const game = makeGame();
            game.update(50);
            expect(game.stepCount).toBe(3);
            game.update(10);
            expect(game.stepCount).toBe(3);
            game.update(10);
            expect(game.stepCount).toBe(4);
        });

        it('runs one step per frame at 60 fps, however the sum rounds', () => {
            const game = makeGame();
            for (let i = 0; i < 600; i++) game.update(1000 / 60);
            expect(game.stepCount).toBe(600);
        });

        it('runs at most four steps per update, dropping the rest so the game slows rather than jumps', () => {
            const game = makeGame();
            game.update(1000);
            expect(game.stepCount).toBe(4);
            game.update(1);
            expect(game.stepCount).toBe(4);
        });
    });

    describe('the ship and the bullets', () => {
        it('scores a graze once for a bullet passing close by', () => {
            const game = makeGame();
            game.enemyBullets.fire(game.ship.x + 8, game.ship.y - 40, Math.PI / 2, 'pellet-red', { speed: 120 });
            play(game, 1000);
            expect(game.scoring.grazeCount).toBe(1);
            expect(game.scoring.score).toBe(GRAZE_POINTS);
            expect(game.lives).toBe(INITIAL_LIVES);
        });

        it('loses a life to a bullet on the hitbox, clearing the screen, then respawns invulnerable', () => {
            const game = makeGame();
            bulletAtShip(game, 0, -40);
            bulletAtShip(game);
            game.update(STEP_MS);
            expect(game.phase).toBe('dying');
            expect(game.lives).toBe(INITIAL_LIVES - 1);
            expect(game.ship.isAlive).toBe(false);
            expect(game.enemyBullets.count).toBe(0);

            play(game, DYING_MS + STEP_MS);
            expect(game.phase).toBe('playing');
            expect(game.ship.isAlive).toBe(true);
            expect(game.ship.y).toBe(SHIP_START_Y);
            bulletAtShip(game);
            game.update(STEP_MS);
            expect(game.phase).toBe('playing');
        });

        it('ends the game with the last life, and starts a new one on restart', () => {
            const game = makeGame();
            for (let life = 0; life < INITIAL_LIVES; life++) {
                play(game, 3000);
                bulletAtShip(game);
                play(game, DYING_MS + 3 * STEP_MS);
            }
            expect(game.phase).toBe('game-over');
            const frozenStep = game.stepCount;
            play(game, 1000);
            expect(game.stepCount).toBe(frozenStep);

            game.playerInput.restartPressed = true;
            game.update(STEP_MS);
            expect(game.phase).toBe('playing');
            expect(game.lives).toBe(INITIAL_LIVES);
        });
    });

    describe('bombs', () => {
        it('turn every bullet into a gem, which flies to the ship and scores', () => {
            const game = makeGame();
            for (let i = 0; i < 10; i++) game.enemyBullets.fire(20 + i * 20, 40, 0, 'orb-amber', { speed: 0 });
            game.playerInput.bombPressed = true;
            game.update(STEP_MS);
            expect(game.isBombing).toBe(true);
            expect(game.bombs).toBe(BOMBS_PER_LIFE - 1);
            expect(game.enemyBullets.count).toBe(0);
            expect(game.gems.count).toBe(10);

            play(game, 2000);
            expect(game.gems.count).toBe(0);
            expect(game.gemsCollected).toBe(10);
            expect(game.scoring.score).toBeGreaterThan(0);
        });

        it('go off once per press', () => {
            const game = makeGame();
            game.playerInput.bombPressed = true;
            play(game, 5000);
            expect(game.bombs).toBe(BOMBS_PER_LIFE - 1);
        });
    });

    describe('enemies', () => {
        it('are shot down by the ship, scoring and starting a chain', () => {
            const game = makeGame([
                { kind: 'spawn', atMs: 0, enemy: 'kite', x: 120, path: { kind: 'straight', speed: 40 }, patterns: [] },
            ]);
            for (let i = 0; i < 180 && game.scoring.score === 0; i++) game.update(STEP_MS);
            expect(game.airEnemies.liveCount).toBe(0);
            expect(game.scoring.score).toBeGreaterThan(0);
            expect(game.scoring.chain).toBe(1);
            expect(game.explosions.liveCount).toBe(1);
        });

        it('count each explosion as it starts, and keep the size of the last', () => {
            const x = 120;
            const game = makeGame([
                { kind: 'spawn', atMs: 0, enemy: 'kite', x, path: { kind: 'straight', speed: 40 }, patterns: [] },
            ]);
            for (let i = 0; i < 180 && game.explosionsStarted === 0; i++) game.update(STEP_MS);
            expect(game.explosionsStarted).toBe(1);
            const explosion = game.explosions.slots.at(0)?.value;
            expect(game.lastExplosionSize).toBe(explosion?.size);
        });

        it('drop their items for the ship to collect, counting each', () => {
            const game = makeGame([
                { kind: 'spawn', atMs: 0, enemy: 'kite', x: 120, path: { kind: 'straight', speed: 40 }, patterns: [], drop: 'power' },
            ]);
            for (let i = 0; i < 1200 && game.itemsCollected === 0; i++) game.update(STEP_MS);
            expect(game.itemsCollected).toBe(1);
            expect(game.lastItemKind).toBe('power');
        });

        it('start the counts of explosions, items and gems again in a new game', () => {
            const game = makeGame([
                { kind: 'spawn', atMs: 0, enemy: 'kite', x: 120, path: { kind: 'straight', speed: 40 }, patterns: [], drop: 'power' },
            ]);
            for (let i = 0; i < 1200 && game.itemsCollected === 0; i++) game.update(STEP_MS);
            for (let i = 0; i < 10; i++) game.enemyBullets.fire(20 + i * 20, 40, 0, 'orb-amber', { speed: 0 });
            game.playerInput.bombPressed = true;
            play(game, 2000);
            expect(game.explosionsStarted).toBeGreaterThan(0);
            expect(game.itemsCollected).toBeGreaterThan(0);
            expect(game.gemsCollected).toBeGreaterThan(0);
            game.reset();
            expect(game.explosionsStarted).toBe(0);
            expect(game.itemsCollected).toBe(0);
            expect(game.gemsCollected).toBe(0);
            expect(game.lastExplosionSize).toBeUndefined();
            expect(game.lastItemKind).toBeUndefined();
        });
    });

    describe('the boss', () => {
        it('stops the scroll, and once defeated leads to the tally and the next loop', () => {
            const game = makeGame([{ kind: 'boss', atMs: 0 }], ONE_WEAK_ATTACK);
            game.update(STEP_MS);
            expect(game.stage.scrollSpeed).toBe(0);
            expect(game.boss.phase).toBe('entering');

            // The ship sits under the boss, so its shots break the attack.
            play(game, BOSS_ENTER_MS + 2000);
            expect(game.boss.phase).toBe('exploding');
            play(game, BOSS_EXPLODE_MS + 100);
            expect(game.phase).toBe('tally');
            expect(game.tallyBonus).toBeGreaterThan(0);

            play(game, TALLY_MS + 100);
            expect(game.phase).toBe('playing');
            expect(game.loop).toBe(2);
            expect(game.boss.phase).not.toBe('exploding');
        });
    });

    describe('replays', () => {
        it('plays the same game twice from the same seed and the same input', () => {
            const first = playScripted();
            const second = playScripted();
            expect(second).toEqual(first);
            expect(first.score).toBeGreaterThan(0);
        });

        /** Thirty seconds of the real stage, steering left and right, focusing and bombing on a schedule. */
        function playScripted() {
            const game = makeGame(STAGE_EVENTS);
            const input = game.playerInput;
            for (let frame = 0; frame < 30 * 60; frame++) {
                const second = Math.floor(frame / 60);
                input.xDirection = second % 4 === 0 ? 'left' : second % 4 === 2 ? 'right' : 'none';
                input.yDirection = second % 6 === 1 ? 'up' : second % 6 === 4 ? 'down' : 'none';
                input.focusPressed = second % 5 === 3;
                input.bombPressed = frame % 600 === 300;
                game.update(STEP_MS);
            }
            return {
                score: game.scoring.score,
                lives: game.lives,
                grazeCount: game.scoring.grazeCount,
                bullets: game.enemyBullets.count,
                shipX: game.ship.x,
                shipY: game.ship.y,
                firstBulletX: game.enemyBullets.count > 0 ? game.enemyBullets.xOf(0) : -1,
            };
        }
    });
});
