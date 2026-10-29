import { describe, expect, it } from 'vitest';
import { BOSS_ATTACKS, LOOP_COUNT, STAGE_EVENTS, type BossAttackDef, type StageEvent } from '../data';
import { createGameModel, type GameModel, type SavedGame } from './game-model';
import {
    BOMBS_PER_LIFE,
    BOSS_ENTER_MS,
    BOSS_EXPLODE_MS,
    DYING_MS,
    ENEMY_POINTS,
    EXTEND_SCORES,
    INITIAL_LIVES,
    MAX_BOMBS,
    MAX_POWER,
    RESPAWN_INVULNERABLE_MS,
    SHIP_START_Y,
    STEP_MS,
    TALLY_MS,
    VOLLEY_CHARGE_MS,
    VOLLEY_FLIGHT_MS,
    VOLLEY_LOCK_MS,
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
        it('scores nothing for a bullet passing close by, but charges the volley', () => {
            const game = makeGame();
            game.enemyBullets.fire(game.ship.x + 8, game.ship.y - 40, Math.PI / 2, 'pellet-red', { speed: 120 });
            play(game, 1000);
            expect(game.volley.charge).toBeGreaterThan(0);
            expect(game.scoring.score).toBe(0);
            expect(game.lives).toBe(INITIAL_LIVES);
        });

        it('charges the volley for as long as a bullet stays within grazing distance', () => {
            const game = makeGame();
            bulletAtShip(game, 8);
            play(game, VOLLEY_CHARGE_MS / 2);
            expect(game.volley.charge).toBeCloseTo(0.5, 1);
            play(game, VOLLEY_CHARGE_MS / 2 + STEP_MS);
            expect(game.volley.phase).toBe('ready');
            expect(game.lives).toBe(INITIAL_LIVES);
        });

        it('does not charge the volley with no bullet close by', () => {
            const game = makeGame();
            bulletAtShip(game, 60);
            play(game, 1000);
            expect(game.volley.charge).toBe(0);
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
            // A new game asked for during play is dropped, not kept for the game over
            game.startNewRun();
            for (let life = 0; life < INITIAL_LIVES; life++) {
                play(game, 3000);
                bulletAtShip(game);
                play(game, DYING_MS + 3 * STEP_MS);
            }
            expect(game.phase).toBe('game-over');
            const frozenStep = game.stepCount;
            play(game, 1000);
            expect(game.stepCount).toBe(frozenStep);
            expect(game.phase).toBe('game-over');

            game.startNewRun();
            game.update(STEP_MS);
            expect(game.phase).toBe('playing');
            expect(game.lives).toBe(INITIAL_LIVES);
        });
    });

    describe('bombs', () => {
        it('turn every bullet into a gem, which flies to the ship and scores', () => {
            const game = makeGame();
            for (let i = 0; i < 10; i++) game.enemyBullets.fire(20 + i * 20, 40, 0, 'orb-amber', { speed: 0 });
            game.dropBomb();
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

        it('go off once each time one is asked for', () => {
            const game = makeGame();
            game.dropBomb();
            play(game, 5000);
            expect(game.bombs).toBe(BOMBS_PER_LIFE - 1);
        });

        it('are not kept for later when asked for while the ship is exploding', () => {
            const game = makeGame();
            bulletAtShip(game);
            game.update(STEP_MS);
            expect(game.phase).toBe('dying');
            game.dropBomb();
            play(game, DYING_MS + 1000);
            expect(game.phase).toBe('playing');
            expect(game.isBombing).toBe(false);
            expect(game.bombs).toBe(BOMBS_PER_LIFE);
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
            game.dropBomb();
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

    describe('the volley', () => {
        const BARGE_AHEAD: readonly StageEvent[] = [
            { kind: 'spawn', atMs: 0, enemy: 'barge', x: 60, y: 60, path: { kind: 'straight', speed: 0 }, patterns: [] },
        ];

        it('locks on while focused, and bursts on its target once released, scoring the kill', () => {
            const game = makeGame(BARGE_AHEAD);
            game.volley.addGrazeTime(VOLLEY_CHARGE_MS);
            game.isFocusing = true;
            play(game, VOLLEY_LOCK_MS + 2 * STEP_MS);
            expect(game.volley.phase).toBe('locked');

            game.isFocusing = false;
            game.releaseVolley();
            game.update(STEP_MS);
            expect(game.volley.phase).toBe('flying');
            play(game, VOLLEY_FLIGHT_MS + STEP_MS);
            expect(game.airEnemies.liveCount).toBe(0);
            expect(game.scoring.score).toBe(ENEMY_POINTS.barge);
        });

        it('fires nothing when Focus is let go before the lock is complete', () => {
            const game = makeGame(BARGE_AHEAD);
            game.volley.addGrazeTime(VOLLEY_CHARGE_MS);
            game.isFocusing = true;
            play(game, VOLLEY_LOCK_MS / 2);
            game.isFocusing = false;
            game.releaseVolley();
            play(game, VOLLEY_FLIGHT_MS + STEP_MS);
            expect(game.volley.volleysFired).toBe(0);
            expect(game.volley.phase).toBe('ready');
        });

        it('shields the focused ship with its ring, losing a shot for each bullet it stops', () => {
            const game = makeGame();
            game.volley.addGrazeTime(VOLLEY_CHARGE_MS);
            game.isFocusing = true;
            game.update(STEP_MS);
            expect(game.volley.isRingUp).toBe(true);

            // Straight down onto the hitbox
            game.enemyBullets.fire(game.ship.x, game.ship.y - 60, Math.PI / 2, 'pellet-red', { speed: 120 });
            play(game, 1000);
            expect(game.lives).toBe(INITIAL_LIVES);
            expect(game.enemyBullets.count).toBe(0);
            expect(game.volley.shotsLeft).toBe(game.volley.shotCount - 1);
            expect(game.volley.shieldHits).toBe(1);
        });

        it('empties its bar when the ship is lost', () => {
            const game = makeGame(BARGE_AHEAD);
            game.volley.addGrazeTime(VOLLEY_CHARGE_MS);
            bulletAtShip(game);
            game.update(STEP_MS);
            expect(game.phase).toBe('dying');
            expect(game.volley.charge).toBe(0);
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
            for (let frame = 0; frame < 30 * 60; frame++) {
                const second = Math.floor(frame / 60);
                game.headingX = second % 4 === 0 ? 'left' : second % 4 === 2 ? 'right' : 'none';
                game.headingY = second % 6 === 1 ? 'up' : second % 6 === 4 ? 'down' : 'none';
                game.isFocusing = second % 5 === 3;
                if (frame % 600 === 300) game.dropBomb();
                game.update(STEP_MS);
            }
            return {
                score: game.scoring.score,
                lives: game.lives,
                charge: game.volley.charge,
                bullets: game.enemyBullets.count,
                shipX: game.ship.x,
                shipY: game.ship.y,
                firstBulletX: game.enemyBullets.count > 0 ? game.enemyBullets.xOf(0) : -1,
            };
        }
    });

    describe('saving', () => {
        it('saves nothing on the first loop, since resuming would only start the game again', () => {
            const game = makeGame([
                { kind: 'spawn', atMs: 0, enemy: 'kite', x: 120, path: { kind: 'straight', speed: 40 }, patterns: [] },
            ]);
            expect(game.save()).toBeUndefined();
            for (let i = 0; i < 180 && game.scoring.score === 0; i++) game.update(STEP_MS);
            expect(game.scoring.score).toBeGreaterThan(0);
            expect(game.save()).toBeUndefined();
        });

        it('saves a loop part way through as of its start, with no more bombs or power than it has now', () => {
            const game = makeGameOnLoopTwo([
                { kind: 'spawn', atMs: 0, enemy: 'kite', x: 120, path: { kind: 'straight', speed: 40 }, patterns: [], drop: 'power' },
            ], { bombs: BOMBS_PER_LIFE, power: 1 });
            const start = { score: game.scoring.score, lives: game.lives };
            // The bomb shields the ship from the bullets the kite leaves on later loops.
            game.dropBomb();
            for (let i = 0; i < 1200 && game.itemsCollected === 0; i++) game.update(STEP_MS);
            expect(game.scoring.score).toBeGreaterThan(start.score);
            expect(game.lives).toBe(start.lives);
            expect(game.ship.power).toBe(2);
            expect(game.bombs).toBe(BOMBS_PER_LIFE - 1);

            // The power won is won again, and the bomb used stays used.
            expect(game.save()).toMatchObject({ loop: 2, ...start, bombs: BOMBS_PER_LIFE - 1, power: 1 });
        });

        it('keeps a life lost, even while the ship is still exploding, and saves nothing once the last is lost', () => {
            const game = makeGameOnLoopTwo(NO_EVENTS, { bombs: 1 });
            const startLives = game.lives;
            bulletAtShip(game);
            game.update(STEP_MS);
            expect(game.phase).toBe('dying');
            expect(game.save()?.lives).toBe(startLives - 1);

            // The new ship's fresh bombs do not come back either.
            play(game, DYING_MS + STEP_MS);
            expect(game.bombs).toBe(BOMBS_PER_LIFE);
            expect(game.save()).toMatchObject({ lives: startLives - 1, bombs: 1 });

            for (let life = 1; life < startLives; life++) {
                play(game, RESPAWN_INVULNERABLE_MS + DYING_MS + STEP_MS);
                bulletAtShip(game);
                game.update(STEP_MS);
            }
            expect(game.phase).toBe('dying');
            expect(game.save()).toBeUndefined();
            play(game, DYING_MS + STEP_MS);
            expect(game.phase).toBe('game-over');
            expect(game.save()).toBeUndefined();
        });

        it('does not keep a life won during the loop, since its points are won again', () => {
            const game = makeGameOnLoopTwo(NO_EVENTS);
            const start = { score: game.scoring.score, lives: game.lives };
            game.scoring.addPoints(EXTEND_SCORES[0]);
            game.update(STEP_MS);
            expect(game.lives).toBe(start.lives + 1);
            expect(game.save()).toMatchObject(start);

            // A life lost after it is still lost, and the life won is won again on resuming.
            bulletAtShip(game);
            game.update(STEP_MS);
            expect(game.lives).toBe(start.lives);
            expect(game.save()).toMatchObject({ score: start.score, lives: start.lives - 1 });
        });

        it('saves a loop just cleared as the start of the next, and loads it there', () => {
            const game = makeGame([{ kind: 'boss', atMs: 0 }], ONE_WEAK_ATTACK);
            playToTally(game);
            const saved = game.save();
            expect(saved).toMatchObject({
                loop: 2, score: game.scoring.score, lives: game.lives, bombs: game.bombs, power: game.ship.power,
            });

            const loaded = makeGame([{ kind: 'boss', atMs: 0 }], ONE_WEAK_ATTACK);
            expect(loaded.load(JSON.parse(JSON.stringify(saved)))).toBe(true);
            expect(loaded.phase).toBe('playing');
            expect(loaded.loop).toBe(2);
            expect(loaded.scoring.score).toBe(game.scoring.score);
            expect(loaded.lives).toBe(game.lives);
            expect(loaded.bombs).toBe(game.bombs);
            expect(loaded.stage.timeMs).toBe(0);

            // The last loop cleared ends the run, with nothing to resume
            expect(loaded.loop).toBe(LOOP_COUNT);
            playToTally(loaded);
            expect(loaded.save()).toBeUndefined();
        });

        it('loads the score, lives, bombs and power, without giving again the lives the score has earned', () => {
            const game = makeGame();
            const saved = {
                ...saveAtTally(), score: EXTEND_SCORES[0], lives: INITIAL_LIVES + 1, bombs: MAX_BOMBS, power: MAX_POWER,
            };
            expect(game.load(saved)).toBe(true);
            game.update(STEP_MS);
            expect(game.scoring.score).toBe(EXTEND_SCORES[0]);
            expect(game.lives).toBe(INITIAL_LIVES + 1);
            expect(game.bombs).toBe(MAX_BOMBS);
            expect(game.ship.power).toBe(MAX_POWER);
        });

        it('loads a save from before the volley, which also kept a graze count', () => {
            const game = makeGame();
            expect(game.load({ ...saveAtTally(), grazeCount: 12 })).toBe(true);
            expect(game.loop).toBe(2);
        });

        it('loads nothing that is not a saved game, and plays on as it was', () => {
            const game = makeGame();
            game.dropBomb();
            play(game, 1000);
            const saved = saveAtTally();
            const maxLives = INITIAL_LIVES + EXTEND_SCORES.length;
            const rejects: unknown[] = [
                undefined,
                'saved',
                { ...saved, version: 0 },
                { ...saved, loop: 0 },
                { ...saved, loop: LOOP_COUNT + 1 },
                { ...saved, score: 1.5 },
                { ...saved, score: '0' },
                { ...saved, lives: 0 },
                { ...saved, lives: maxLives + 1 },
                { ...saved, bombs: MAX_BOMBS + 1 },
                { ...saved, power: 0 },
                { ...saved, power: MAX_POWER + 1 },
            ];
            const stepCount = game.stepCount;
            const stageMs = game.stage.timeMs;
            for (let i = 0; i < rejects.length; i++) {
                expect(game.load(rejects[i]), `save ${i}`).toBe(false);
            }
            expect(game.loop).toBe(1);
            expect(game.lives).toBe(INITIAL_LIVES);
            expect(game.bombs).toBe(BOMBS_PER_LIFE - 1);
            expect(game.stepCount).toBe(stepCount);
            expect(game.stage.timeMs).toBe(stageMs);
        });

        /** Play until the boss is down and the tally shows, as in a stage that is only the boss. */
        function playToTally(game: GameModel): void {
            for (let i = 0; i < 60 * 60 && game.phase !== 'tally'; i++) game.update(STEP_MS);
            expect(game.phase).toBe('tally');
        }

        /** A save at the start of the second loop, from a first loop that is only a weak boss. */
        function saveAtTally(): SavedGame {
            const game = makeGame([{ kind: 'boss', atMs: 0 }], ONE_WEAK_ATTACK);
            playToTally(game);
            const saved = game.save();
            if (saved === undefined) throw new Error('A cleared first loop saves the second.');
            return saved;
        }

        /** A game on the second loop, with `events` for its stage, and any of the save's values changed. */
        function makeGameOnLoopTwo(events: readonly StageEvent[], changes: Partial<SavedGame> = {}): GameModel {
            const game = makeGame(events);
            expect(game.load({ ...saveAtTally(), ...changes })).toBe(true);
            return game;
        }
    });
});
