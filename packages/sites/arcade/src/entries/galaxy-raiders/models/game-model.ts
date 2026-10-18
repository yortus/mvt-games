import gsap from 'gsap';
import type { WaveConfig } from '../data';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../data';
import {
    FORMATION_LEFT,
    FORMATION_TOP,
    CELL_SIZE,
    HIT_RADIUS_SQ,
    ENEMY_BULLET_SPEED,
    BULLET_SPEED,
    MAX_PLAYER_BULLETS,
    MAX_ENEMY_BULLETS,
    SHIP_Y,
    SHIP_SPEED,
    SHIP_HALF_WIDTH,
} from './model-constants';
import type { Direction, EnemyKind, GamePhase } from './common';
import { createShipModel, type ShipModel } from './ship-model';
import { createEnemyModel, type EnemyModel } from './enemy-model';
import { createBulletModel, type BulletModel } from './bullet-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly ship: ShipModel;
    readonly enemies: readonly EnemyModel[];
    readonly playerBullets: readonly BulletModel[];
    readonly enemyBullets: readonly BulletModel[];
    readonly score: number;
    readonly lives: number;
    readonly stage: number;
    /**
     * Shots the ship has fired this game. It is a count rather than a flag, so
     * a view can play a sound for each shot. A shot's bullet can already be
     * gone when a view looks, if it hits a raider in the tick it is fired.
     */
    readonly shotsFired: number;
    /** How many raiders are still alive in this wave. */
    readonly enemiesLeft: number;
    /** The way the player is moving the ship, or 'none' to keep it still. It moves while the game is playing. */
    direction: Direction;
    /** Fires a shot. It leaves at the next update, if the game is playing and a bullet is free. */
    fire: () => void;
    /** Asks for a new game. It starts at the next update, if the last game is over. */
    startNewRun: () => void;
    reset: () => void;
    /**
     * Returns the game as a value JSON can hold, for `load` to restore. A
     * game is saved as of the start of its stage, with the score it had then,
     * and the lives it has now, so that leaving and resuming a game never
     * helps it. A stage just cleared is saved as the start of the next.
     * Returns undefined once the last life is lost, and while the game is
     * still on its first stage with no score, since resuming it would only
     * start the game again.
     */
    save: () => SavedGame | undefined;
    /**
     * Restores a game that `save` returned, in place of this one, at the
     * start of its stage. Returns whether it could: a value that is not a
     * saved game, such as one from an older version, leaves the game as it
     * was.
     */
    load: (saved: unknown) => boolean;
    update: (deltaMs: number) => void;
}

/** A game part way through, as `save` returns it: the stage to start, with its score and lives. */
export interface SavedGame {
    readonly version: typeof SAVED_GAME_VERSION;
    readonly stage: number;
    readonly score: number;
    readonly lives: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    readonly waves: readonly WaveConfig[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameModel(options: GameModelOptions): GameModel {
    const { waves } = options;
    const playHeight = ARENA_HEIGHT;
    const shipStartX = ARENA_WIDTH / 2;
    const shipMinX = SHIP_HALF_WIDTH;
    const shipMaxX = ARENA_WIDTH - SHIP_HALF_WIDTH;

    let gamePhase: GamePhase = 'playing';
    let waveIndex = 0;
    let breathTimer = 0;
    let formationOffsetX = 0;
    let formationOffsetY = 0;
    let diveTimer = 0;
    /** Whether a shot was asked for since the last update. */
    let isFireRequested = false;
    /** Whether a new game was asked for since the last update. */
    let isNewRunRequested = false;
    let score = 0;
    let lives = START_LIVES;
    let stage = 1;
    /** The score as this stage started, which a save keeps. The stage's own points are won again on resuming. */
    let stageStartScore = 0;
    let shotsFired = 0;

    const phaseTimeline = gsap.timeline({ paused: true });

    // ---- Initialise --------------------------------------------------------

    let ship = buildShip();
    let enemies = buildEnemies();
    let playerBullets = buildBulletPool(MAX_PLAYER_BULLETS);
    let enemyBullets = buildBulletPool(MAX_ENEMY_BULLETS);

    // ---- Public record -----------------------------------------------------

    const model: GameModel = {
        get phase() {
            return gamePhase;
        },
        get ship() {
            return ship;
        },
        get enemies() {
            return enemies;
        },
        get playerBullets() {
            return playerBullets;
        },
        get enemyBullets() {
            return enemyBullets;
        },
        get score() {
            return score;
        },
        get lives() {
            return lives;
        },
        get stage() {
            return stage;
        },
        get shotsFired() {
            return shotsFired;
        },
        get enemiesLeft() {
            return aliveEnemyCount();
        },
        direction: 'none',

        fire(): void {
            isFireRequested = true;
        },

        startNewRun(): void {
            isNewRunRequested = true;
        },

        reset(): void {
            score = 0;
            lives = START_LIVES;
            stage = 1;
            shotsFired = 0;
            waveIndex = 0;
            loadWave();
        },

        save() {
            if (gamePhase === 'game-over') return undefined;
            // A life lost while the ship explodes is taken once the delay is over
            const livesLeft = gamePhase === 'dying' ? lives - 1 : lives;
            if (livesLeft <= 0) return undefined;
            if (gamePhase === 'stage-clear') return { version: SAVED_GAME_VERSION, stage: stage + 1, score, lives: livesLeft };
            // A game still at its start has nothing worth resuming: it would only start again
            if (stage === 1 && stageStartScore === 0) return undefined;
            return { version: SAVED_GAME_VERSION, stage, score: stageStartScore, lives: livesLeft };
        },

        load(value) {
            if (!isSavedGame(value)) return false;
            stage = value.stage;
            // Each stage plays the next wave, and the stages past the last wave play the last wave again
            waveIndex = value.stage - 1;
            score = value.score;
            lives = value.lives;
            loadWave();
            return true;
        },

        update(deltaMs: number): void {
            // A new game starts only once the last is over. A request made sooner is dropped
            if (isNewRunRequested) {
                isNewRunRequested = false;
                if (gamePhase === 'game-over') {
                    model.reset();
                }
            }

            // Apply the player's intent. A shot asked for while the game isn't playing is dropped
            if (gamePhase === 'playing') {
                ship.setDirection(model.direction);
                if (isFireRequested) tryPlayerFire();
            }
            isFireRequested = false;

            // Advance phase timeline (dying / stage-clear delays)
            phaseTimeline.time(phaseTimeline.time() + 0.001 * deltaMs);
            if (gamePhase !== 'playing') return;

            // Formation breathing
            breathTimer += deltaMs;
            formationOffsetX = Math.sin(breathTimer * 0.001) * BREATH_AMP_X;
            formationOffsetY = Math.cos(breathTimer * 0.0007) * BREATH_AMP_Y;

            // Update children
            ship.update(deltaMs);
            for (let i = 0; i < enemies.length; i++) enemies[i].update(deltaMs);
            for (let i = 0; i < playerBullets.length; i++) playerBullets[i].update(deltaMs);
            for (let i = 0; i < enemyBullets.length; i++) enemyBullets[i].update(deltaMs);

            // Enemy firing (dive callbacks)
            handleEnemyFiring();

            // Dive timer
            if (allEnemiesEnteredOrDead()) {
                diveTimer += deltaMs;
                const wave = currentWave();
                if (diveTimer >= wave.diveInterval) {
                    diveTimer -= wave.diveInterval;
                    selectAndStartDive();
                }
            }

            // Collision checks
            checkPlayerBulletsVsEnemies();
            if (gamePhase === 'playing') checkEnemyBulletsVsShip();
            if (gamePhase === 'playing') checkDivingEnemiesVsShip();

            // Stage clear
            if (gamePhase === 'playing' && aliveEnemyCount() === 0) {
                scheduleStageClear();
            }
        },
    };

    return model;

    // ---- Helpers -----------------------------------------------------------

    function currentWave(): WaveConfig {
        return waves[Math.min(waveIndex, waves.length - 1)];
    }

    function slotX(col: number): number {
        return FORMATION_LEFT + col * CELL_SIZE + CELL_SIZE / 2;
    }

    function slotY(row: number): number {
        return FORMATION_TOP + row * CELL_SIZE + CELL_SIZE / 2;
    }

    // ---- Child construction ------------------------------------------------

    function buildShip(): ShipModel {
        return createShipModel({
            startX: shipStartX,
            startY: SHIP_Y,
            speed: SHIP_SPEED,
            minX: shipMinX,
            maxX: shipMaxX,
        });
    }

    function buildEnemies(): EnemyModel[] {
        const wave = currentWave();
        const result: EnemyModel[] = [];
        for (let i = 0; i < wave.slots.length; i++) {
            const slot = wave.slots[i];
            result.push(
                createEnemyModel({
                    slotX: slotX(slot.col),
                    slotY: slotY(slot.row),
                    formationRow: slot.row,
                    formationCol: slot.col,
                    kind: slot.kind,
                    enterDelay: slot.row * 0.4 + slot.col * 0.05,
                    diveSpeedFactor: wave.diveSpeedFactor,
                    fireChance: wave.enemyFireChance,
                    playHeight,
                    getFormationOffsetX: () => formationOffsetX,
                    getFormationOffsetY: () => formationOffsetY,
                }),
            );
        }
        return result;
    }

    function buildBulletPool(count: number): BulletModel[] {
        const pool: BulletModel[] = [];
        for (let i = 0; i < count; i++) {
            pool.push(createBulletModel({ minY: -20, maxY: playHeight + 20 }));
        }
        return pool;
    }

    // ---- Stage management --------------------------------------------------

    function loadWave(): void {
        stageStartScore = score;
        ship = buildShip();
        enemies = buildEnemies();
        playerBullets = buildBulletPool(MAX_PLAYER_BULLETS);
        enemyBullets = buildBulletPool(MAX_ENEMY_BULLETS);
        diveTimer = 0;
        breathTimer = 0;
        gamePhase = 'playing';
        phaseTimeline.clear().time(0);
    }

    function scheduleDying(): void {
        gamePhase = 'dying';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                lives--;
                if (lives > 0) {
                    // Respawn ship, continue same wave
                    ship.respawn(shipStartX);
                    deactivateAllBullets();
                    gamePhase = 'playing';
                }
                else {
                    gamePhase = 'game-over';
                }
            },
            undefined,
            DYING_DELAY_MS * 0.001,
        );
    }

    function scheduleStageClear(): void {
        gamePhase = 'stage-clear';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                stage++;
                waveIndex++;
                loadWave();
            },
            undefined,
            STAGE_CLEAR_DELAY_MS * 0.001,
        );
    }

    function deactivateAllBullets(): void {
        for (let i = 0; i < playerBullets.length; i++) playerBullets[i].deactivate();
        for (let i = 0; i < enemyBullets.length; i++) enemyBullets[i].deactivate();
    }

    // ---- Enemy helpers -----------------------------------------------------

    function aliveEnemyCount(): number {
        let count = 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].isAlive) count++;
        }
        return count;
    }

    function allEnemiesEnteredOrDead(): boolean {
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].isAlive && enemies[i].phase === 'entering') return false;
        }
        return true;
    }

    function selectAndStartDive(): void {
        let candidateCount = 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].isAlive && enemies[i].phase === 'formation') candidateCount++;
        }
        if (candidateCount === 0) return;

        let pick = (Math.random() * candidateCount) | 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].isAlive && enemies[i].phase === 'formation') {
                if (pick === 0) {
                    const curveDir = Math.random() > 0.5 ? 1 : -1;
                    enemies[i].startDive(ship.x, curveDir);
                    return;
                }
                pick--;
            }
        }
    }

    // ---- Firing ------------------------------------------------------------

    function tryPlayerFire(): void {
        if (!ship.isAlive) return;
        for (let b = 0; b < playerBullets.length; b++) {
            if (!playerBullets[b].isActive) {
                playerBullets[b].fire(ship.x, ship.y - 8, -BULLET_SPEED);
                shotsFired++;
                break;
            }
        }
    }

    function handleEnemyFiring(): void {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.wantsToFire) continue;
            enemy.consumeFire();

            for (let b = 0; b < enemyBullets.length; b++) {
                if (!enemyBullets[b].isActive) {
                    enemyBullets[b].fire(enemy.x, enemy.y + 8, ENEMY_BULLET_SPEED);
                    break;
                }
            }
        }
    }

    // ---- Collision detection -----------------------------------------------

    function checkPlayerBulletsVsEnemies(): void {
        for (let b = 0; b < playerBullets.length; b++) {
            const bullet = playerBullets[b];
            if (!bullet.isActive) continue;

            for (let e = 0; e < enemies.length; e++) {
                const enemy = enemies[e];
                if (!enemy.isAlive || enemy.phase === 'entering') continue;

                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                if (dx * dx + dy * dy < HIT_RADIUS_SQ) {
                    const points =
                        enemy.phase === 'diving' ? SCORE_WHILE_DIVING[enemy.kind] : SCORE_IN_FORMATION[enemy.kind];
                    score += points;
                    enemy.kill();
                    bullet.deactivate();
                    break;
                }
            }
        }
    }

    function checkEnemyBulletsVsShip(): void {
        if (!ship.isAlive) return;

        for (let b = 0; b < enemyBullets.length; b++) {
            const bullet = enemyBullets[b];
            if (!bullet.isActive) continue;

            const dx = bullet.x - ship.x;
            const dy = bullet.y - ship.y;
            if (dx * dx + dy * dy < HIT_RADIUS_SQ) {
                bullet.deactivate();
                ship.kill();
                scheduleDying();
                return;
            }
        }
    }

    function checkDivingEnemiesVsShip(): void {
        if (!ship.isAlive) return;

        for (let e = 0; e < enemies.length; e++) {
            const enemy = enemies[e];
            if (!enemy.isAlive || enemy.phase !== 'diving') continue;

            const dx = enemy.x - ship.x;
            const dy = enemy.y - ship.y;
            if (dx * dx + dy * dy < HIT_RADIUS_SQ) {
                enemy.kill();
                ship.kill();
                scheduleDying();
                return;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const START_LIVES = 3;
/** Marks the shape of a saved game. A change to the shape changes it, so older saves are not loaded. */
const SAVED_GAME_VERSION = 1;

/** Whether `value` is a saved game: a stage from 1, a score from 0, and from 1 life to as many as a game starts with. */
function isSavedGame(value: unknown): value is SavedGame {
    // typeof null is 'object' too
    if (typeof value !== 'object' || value === null) return false;
    const { version, stage, score, lives } = value as Record<string, unknown>;
    return version === SAVED_GAME_VERSION
        && isWholeNumber(stage) && stage >= 1
        && isWholeNumber(score)
        && isWholeNumber(lives) && lives >= 1 && lives <= START_LIVES;
}

/** Whether `value` is a whole number, 0 or more. */
function isWholeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

const STAGE_CLEAR_DELAY_MS = 1500;
const DYING_DELAY_MS = 1500;

/** Points for destroying an enemy while it sits in formation. */
const SCORE_IN_FORMATION: Record<EnemyKind, number> = {
    scout: 40,
    striker: 70,
    carrier: 120,
};

/** Points for destroying an enemy while it is diving. */
const SCORE_WHILE_DIVING: Record<EnemyKind, number> = {
    scout: 80,
    striker: 140,
    carrier: 300,
};

/** Amplitude of the formation breathing in world-units. */
const BREATH_AMP_X = 5;
const BREATH_AMP_Y = 3;
