import gsap from 'gsap';
import { createWatch } from '#utils';
import type { WaveConfig } from '../data';
import {
    FORMATION_LEFT,
    FORMATION_TOP,
    CELL_SIZE,
    HIT_RADIUS_SQ,
    ENEMY_BULLET_SPEED,
    BULLET_SPEED,
    MAX_PLAYER_BULLETS,
    MAX_ENEMY_BULLETS,
} from '../data';
import type { EnemyKind, GamePhase } from './common';
import { createShipModel, type ShipModel } from './ship-model';
import { createEnemyModel, type EnemyModel } from './enemy-model';
import { createBulletModel, type BulletModel } from './bullet-model';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createScoreModel, type ScoreModel } from './score-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly ship: ShipModel;
    readonly enemies: readonly EnemyModel[];
    readonly playerBullets: readonly BulletModel[];
    readonly enemyBullets: readonly BulletModel[];
    readonly score: ScoreModel;
    readonly playerInput: PlayerInput;
    reset(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    readonly waves: readonly WaveConfig[];
    readonly playHeight: number;
    readonly shipStartX: number;
    readonly shipStartY: number;
    readonly shipSpeed: number;
    readonly shipMinX: number;
    readonly shipMaxX: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const STAGE_CLEAR_DELAY_MS = 1500;
const DYING_DELAY_MS = 1500;

/** Points for destroying an enemy while it sits in formation. */
const SCORE_IN_FORMATION: Record<EnemyKind, number> = {
    bee: 50,
    butterfly: 80,
    boss: 150,
};

/** Points for destroying an enemy while it is diving. */
const SCORE_WHILE_DIVING: Record<EnemyKind, number> = {
    bee: 100,
    butterfly: 160,
    boss: 400,
};

/** Amplitude of the formation breathing in pixels. */
const BREATH_AMP_X = 5;
const BREATH_AMP_Y = 3;

export function createGameModel(options: GameModelOptions): GameModel {
    const {
        waves,
        playHeight,
        shipStartX,
        shipStartY,
        shipSpeed,
        shipMinX,
        shipMaxX,
    } = options;

    let gamePhase: GamePhase = 'playing';
    let waveIndex = 0;
    let breathTimer = 0;
    let formationOffsetX = 0;
    let formationOffsetY = 0;
    let diveTimer = 0;
    let fireConsumed = false;

    const phaseTimeline = gsap.timeline({ paused: true });

    // ---- Helpers -----------------------------------------------------------

    function currentWave(): WaveConfig {
        return waves[Math.min(waveIndex, waves.length - 1)];
    }

    function slotPixelX(col: number): number {
        return FORMATION_LEFT + col * CELL_SIZE + CELL_SIZE / 2;
    }

    function slotPixelY(row: number): number {
        return FORMATION_TOP + row * CELL_SIZE + CELL_SIZE / 2;
    }

    // ---- Child construction ------------------------------------------------

    function buildShip(): ShipModel {
        return createShipModel({
            startX: shipStartX,
            startY: shipStartY,
            speed: shipSpeed,
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
                    slotX: slotPixelX(slot.col),
                    slotY: slotPixelY(slot.row),
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

    // ---- Initialise --------------------------------------------------------

    let ship = buildShip();
    let enemies = buildEnemies();
    let playerBullets = buildBulletPool(MAX_PLAYER_BULLETS);
    let enemyBullets = buildBulletPool(MAX_ENEMY_BULLETS);
    const scoreModel = createScoreModel();
    const playerInput = createPlayerInput();
    let watchRestart = createWatch(() => playerInput.restartRequested);

    // ---- Stage management --------------------------------------------------

    function loadWave(): void {
        ship = buildShip();
        enemies = buildEnemies();
        playerBullets = buildBulletPool(MAX_PLAYER_BULLETS);
        enemyBullets = buildBulletPool(MAX_ENEMY_BULLETS);
        diveTimer = 0;
        breathTimer = 0;
        fireConsumed = false;
        gamePhase = 'playing';
        phaseTimeline.clear().time(0);
    }

    function scheduleDying(): void {
        gamePhase = 'dying';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(() => {
            if (scoreModel.loseLife()) {
                // Respawn ship, continue same wave
                ship.respawn(shipStartX);
                deactivateAllBullets();
                gamePhase = 'playing';
            } else {
                gamePhase = 'game-over';
            }
        }, undefined, DYING_DELAY_MS * 0.001);
    }

    function scheduleStageClear(): void {
        gamePhase = 'stage-clear';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(() => {
            scoreModel.advanceStage();
            waveIndex++;
            loadWave();
        }, undefined, STAGE_CLEAR_DELAY_MS * 0.001);
    }

    function deactivateAllBullets(): void {
        for (let i = 0; i < playerBullets.length; i++) playerBullets[i].deactivate();
        for (let i = 0; i < enemyBullets.length; i++) enemyBullets[i].deactivate();
    }

    // ---- Enemy helpers -----------------------------------------------------

    function aliveEnemyCount(): number {
        let count = 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].alive) count++;
        }
        return count;
    }

    function allEnemiesEnteredOrDead(): boolean {
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].alive && enemies[i].phase === 'entering') return false;
        }
        return true;
    }

    function selectAndStartDive(): void {
        let candidateCount = 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].alive && enemies[i].phase === 'formation') candidateCount++;
        }
        if (candidateCount === 0) return;

        let pick = (Math.random() * candidateCount) | 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].alive && enemies[i].phase === 'formation') {
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
        if (!ship.alive || !playerInput.firePressed) return;
        if (!fireConsumed) {
            fireConsumed = true;
            for (let b = 0; b < playerBullets.length; b++) {
                if (!playerBullets[b].active) {
                    playerBullets[b].fire(ship.x, ship.y - 8, -BULLET_SPEED);
                    break;
                }
            }
        }
    }

    function handleEnemyFiring(): void {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.wantsToFire) continue;
            enemy.consumeFire();

            for (let b = 0; b < enemyBullets.length; b++) {
                if (!enemyBullets[b].active) {
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
            if (!bullet.active) continue;

            for (let e = 0; e < enemies.length; e++) {
                const enemy = enemies[e];
                if (!enemy.alive || enemy.phase === 'entering') continue;

                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                if (dx * dx + dy * dy < HIT_RADIUS_SQ) {
                    const points =
                        enemy.phase === 'diving'
                            ? SCORE_WHILE_DIVING[enemy.kind]
                            : SCORE_IN_FORMATION[enemy.kind];
                    scoreModel.addPoints(points);
                    enemy.kill();
                    bullet.deactivate();
                    break;
                }
            }
        }
    }

    function checkEnemyBulletsVsShip(): void {
        if (!ship.alive) return;

        for (let b = 0; b < enemyBullets.length; b++) {
            const bullet = enemyBullets[b];
            if (!bullet.active) continue;

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
        if (!ship.alive) return;

        for (let e = 0; e < enemies.length; e++) {
            const enemy = enemies[e];
            if (!enemy.alive || enemy.phase !== 'diving') continue;

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
            return scoreModel;
        },
        get playerInput() {
            return playerInput;
        },

        reset(): void {
            scoreModel.reset();
            waveIndex = 0;
            loadWave();
        },

        update(deltaMs: number): void {

            // Restart handling
            if (watchRestart.changed() && watchRestart.value) {
                if (gamePhase === 'game-over') {
                    model.reset();
                    watchRestart = createWatch(() => playerInput.restartRequested);
                }
                playerInput.restartRequested = false;
            }

            // Apply input
            if (gamePhase === 'playing') {
                ship.setDirection(playerInput.direction);

                if (playerInput.firePressed) {
                    tryPlayerFire();
                } else {
                    fireConsumed = false;
                }
            }

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
            scoreModel.update(deltaMs);

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
}
