import gsap from 'gsap';
import { createWatch } from '#utils';
import type { TileKind, DepthLayer, LevelConfig } from '../data';
import { DEPTH_LAYERS } from '../data';
import { createFieldModel, type FieldModel } from './field-model';
import { createDiggerModel, type DiggerModel } from './digger-model';
import { createEnemyModel, type EnemyModel } from './enemy-model';
import { createRockModel, type RockModel } from './rock-model';
import { createPlayerInputModel, type PlayerInputModel } from './player-input-model';
import { createScoreModel, type ScoreModel } from './score-model';
import type { GamePhase, Direction } from './common';
import { DIRECTION_DELTA } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly field: FieldModel;
    readonly digger: DiggerModel;
    readonly enemies: readonly EnemyModel[];
    readonly rocks: readonly RockModel[];
    readonly score: ScoreModel;
    readonly playerInput: PlayerInputModel;
    reset(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    levels: readonly LevelConfig[];
    fieldCols: number;
    fieldRows: number;
    baseLayout: readonly TileKind[];
    diggerSpawn: [number, number];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const COLLISION_THRESHOLD_SQ = 0.5 * 0.5;
const FIRE_RANGE = 3; // tiles
const LEVEL_CLEAR_DELAY_MS = 1000;
const DYING_DELAY_MS = 1000;

/** Points for pumping an enemy, indexed by depth layer (0–3). */
const PUMP_POINTS = [200, 300, 400, 500];

/** Points for each enemy crushed by a rock. */
const ROCK_CRUSH_POINTS = 1000;

function depthLayerIndex(row: number): number {
    for (let i = 0; i < DEPTH_LAYERS.length; i++) {
        const layer: DepthLayer = DEPTH_LAYERS[i];
        if (row >= layer.startRow && row <= layer.endRow) return i;
    }
    return 0;
}

export function createGameModel(options: GameModelOptions): GameModel {
    const { levels, fieldCols, fieldRows, baseLayout, diggerSpawn } = options;

    let gamePhase: GamePhase = 'playing';
    let levelIndex = 0;

    /** Index of the enemy currently attached to the harpoon, or -1. */
    let harpoonTarget = -1;
    /** Whether we've already inflated for the current pump hold. */
    let pumpConsumed = false;

    const phaseTimeline = gsap.timeline({ paused: true });

    // ---- Child model construction ------------------------------------------

    function currentLevel(): LevelConfig {
        return levels[Math.min(levelIndex, levels.length - 1)];
    }

    function buildField(): FieldModel {
        return createFieldModel({ rows: fieldRows, cols: fieldCols, layout: baseLayout });
    }

    function isRockAt(row: number, col: number): boolean {
        for (let i = 0; i < rocks.length; i++) {
            const rock = rocks[i];
            if (rock.phase === 'shattered') continue;
            if (rock.row === row && rock.col === col) return true;
        }
        return false;
    }

    function buildDigger(fieldRef: FieldModel): DiggerModel {
        return createDiggerModel({
            startRow: diggerSpawn[0],
            startCol: diggerSpawn[1],
            speed: currentLevel().diggerSpeed,
            fieldRows,
            fieldCols,
            isWalkable: (r, c) => fieldRef.isWalkable(r, c) && !isRockAt(r, c),
            isDirt: (r, c) => fieldRef.isDirt(r, c) && !isRockAt(r, c),
            getHarpoonMaxDistance: harpoonMaxDistance,
        });
    }

    function isAnyEnemyGhosting(): boolean {
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].alive && enemies[i].phase === 'ghosting') return true;
        }
        return false;
    }

    function buildEnemies(fieldRef: FieldModel): EnemyModel[] {
        const lvl = currentLevel();
        const result: EnemyModel[] = [];
        for (let i = 0; i < lvl.enemySpawns.length; i++) {
            const spawn = lvl.enemySpawns[i];
            result.push(
                createEnemyModel({
                    startRow: spawn.row,
                    startCol: spawn.col,
                    kind: spawn.kind,
                    speed: lvl.enemySpeed,
                    ghostInterval: lvl.ghostInterval,
                    fieldRows,
                    fieldCols,
                    isWalkable: (r, c) => fieldRef.isWalkable(r, c),
                    chaseTarget: digger,
                    canStartGhosting: () => !isAnyEnemyGhosting(),
                }),
            );
        }
        return result;
    }

    function buildRocks(fieldRef: FieldModel): RockModel[] {
        const lvl = currentLevel();
        const result: RockModel[] = [];
        for (let i = 0; i < lvl.rockPositions.length; i++) {
            const pos = lvl.rockPositions[i];
            result.push(
                createRockModel({
                    row: pos[0],
                    col: pos[1],
                    fieldRows,
                    isWalkable: (r, c) => fieldRef.isWalkable(r, c),
                }),
            );
        }
        return result;
    }

    // ---- Initialise --------------------------------------------------------

    let field = buildField();
    let digger = buildDigger(field);
    let enemies = buildEnemies(field);
    let rocks = buildRocks(field);
    const scoreModel = createScoreModel();
    const playerInput = createPlayerInputModel();
    let watchRestart = createWatch(() => playerInput.restartRequested);

    // ---- Helpers -----------------------------------------------------------

    function entityDistSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
        return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    }

    function aliveEnemyCount(): number {
        let count = 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].alive) count++;
        }
        return count;
    }

    /**
     * Compute how far the harpoon can extend before hitting dirt.
     * Scans tile-by-tile in the given direction.
     */
    function harpoonMaxDistance(direction: Direction, fromRow: number, fromCol: number, maxRange: number): number {
        const delta = DIRECTION_DELTA[direction];
        for (let t = 1; t <= maxRange; t++) {
            const checkRow = fromRow + delta[0] * t;
            const checkCol = fromCol + delta[1] * t;
            // Out of bounds — stop
            if (checkRow < 0 || checkRow >= fieldRows || checkCol < 0 || checkCol >= fieldCols) {
                return t - 0.5;
            }
            // Dirt blocks the harpoon
            if (field.isDirt(checkRow, checkCol)) {
                return t - 0.5;
            }
        }
        return maxRange;
    }

    function loadLevel(): void {
        field = buildField();
        // Carve tunnels at enemy spawn positions so they start in tunnels
        const lvl = currentLevel();
        for (let i = 0; i < lvl.enemySpawns.length; i++) {
            field.dig(lvl.enemySpawns[i].row, lvl.enemySpawns[i].col);
        }
        digger = buildDigger(field);
        enemies = buildEnemies(field);
        rocks = buildRocks(field);
        harpoonTarget = -1;
        pumpConsumed = false;
        gamePhase = 'playing';
        phaseTimeline.clear().time(0);
    }

    function scheduleDying(): void {
        gamePhase = 'dying';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(() => {
            if (scoreModel.loseLife()) {
                loadLevel();
            } else {
                gamePhase = 'game-over';
            }
        }, undefined, DYING_DELAY_MS * 0.001);
    }

    function scheduleLevelClear(): void {
        gamePhase = 'level-clear';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(() => {
            scoreModel.advanceLevel();
            levelIndex++;
            loadLevel();
        }, undefined, LEVEL_CLEAR_DELAY_MS * 0.001);
    }

    // ---- Collision detection -----------------------------------------------

    function checkDigging(): void {
        // If digger is at a dirt tile, dig it
        if (field.isDirt(digger.row, digger.col)) {
            field.dig(digger.row, digger.col);
        }
    }

    function checkHarpoonHits(): void {
        if (!digger.harpoonExtended) {
            harpoonTarget = -1;
            pumpConsumed = false;
            digger.lockHarpoon(false);
            return;
        }

        // Reset consumed flag when pump is released (allows next press to inflate)
        if (!playerInput.pumpPressed) {
            pumpConsumed = false;
        }

        // If we already have a target, keep pumping that one
        if (harpoonTarget >= 0) {
            const target = enemies[harpoonTarget];
            if (!target.alive || target.phase === 'popped' || target.phase === 'crushed') {
                harpoonTarget = -1;
                digger.lockHarpoon(false);
                return;
            }
            // Keep the harpoon locked at its current distance
            digger.lockHarpoon(true);
            // Inflate once per pump press
            if (playerInput.pumpPressed && !pumpConsumed) {
                pumpConsumed = true;
                const popped = target.inflate();
                if (popped) {
                    const layer = depthLayerIndex(target.row);
                    let points = PUMP_POINTS[layer];
                    if (target.kind === 'fygar' && (digger.direction === 'left' || digger.direction === 'right')) {
                        points *= 2;
                    }
                    scoreModel.addPoints(points);
                    harpoonTarget = -1;
                    digger.lockHarpoon(false);
                }
            }
            return;
        }

        // No target yet — scan for enemy near the harpoon tip
        if (digger.harpoonDistance < 0.3) return;

        const delta = DIRECTION_DELTA[digger.direction];
        const tipRow = digger.row + delta[0] * digger.harpoonDistance;
        const tipCol = digger.col + delta[1] * digger.harpoonDistance;

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.alive || enemy.phase === 'popped' || enemy.phase === 'crushed') continue;

            const dist = (enemy.x - tipCol) ** 2 + (enemy.y - tipRow) ** 2;
            if (dist < COLLISION_THRESHOLD_SQ) {
                harpoonTarget = i;
                pumpConsumed = true;
                digger.lockHarpoon(true);
                // First pump hit
                const popped = enemy.inflate();
                if (popped) {
                    const layer = depthLayerIndex(enemy.row);
                    let points = PUMP_POINTS[layer];
                    if (enemy.kind === 'fygar' && (digger.direction === 'left' || digger.direction === 'right')) {
                        points *= 2;
                    }
                    scoreModel.addPoints(points);
                    harpoonTarget = -1;
                    digger.lockHarpoon(false);
                }
                return; // Only one target at a time
            }
        }
    }

    function checkRockDestabilization(): void {
        for (let i = 0; i < rocks.length; i++) {
            const rock = rocks[i];
            if (!rock.alive || rock.phase !== 'stable') continue;
            // Check if tile below rock is now a tunnel
            if (field.isWalkable(rock.row + 1, rock.col)) {
                rock.destabilize();
            }
        }
    }

    function checkRockCrush(): void {
        for (let i = 0; i < rocks.length; i++) {
            const rock = rocks[i];
            if (!rock.alive || rock.phase !== 'falling') continue;

            // Check collision with enemies
            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
                if (!enemy.alive) continue;
                if (entityDistSq(rock, enemy) < COLLISION_THRESHOLD_SQ) {
                    enemy.crush();
                    scoreModel.addPoints(ROCK_CRUSH_POINTS);
                }
            }

            // Check collision with digger
            if (entityDistSq(rock, digger) < COLLISION_THRESHOLD_SQ) {
                digger.kill();
                scheduleDying();
            }
        }
    }

    function checkEnemyDiggerCollision(): void {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.alive) continue;
            if (enemy.phase === 'inflating' || enemy.phase === 'popped' || enemy.phase === 'crushed') continue;
            if (entityDistSq(digger, enemy) < COLLISION_THRESHOLD_SQ) {
                digger.kill();
                scheduleDying();
                return;
            }
        }
    }

    function checkFygarFire(): void {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.alive || enemy.kind !== 'fygar' || !enemy.fireActive) continue;

            // Fire extends horizontally from fygar in its facing direction
            const dir = enemy.direction;
            if (dir !== 'left' && dir !== 'right') continue;
            const dc = dir === 'right' ? 1 : -1;

            for (let t = 1; t <= FIRE_RANGE; t++) {
                const fireCol = enemy.col + dc * t;
                const fireRow = enemy.row;
                const dx = digger.x - fireCol;
                const dy = digger.y - fireRow;
                if (dx * dx + dy * dy < COLLISION_THRESHOLD_SQ) {
                    digger.kill();
                    scheduleDying();
                    return;
                }
            }
        }
    }

    function checkLastEnemyFlee(): void {
        if (aliveEnemyCount() !== 1) return;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].alive && !enemies[i].fleeing) {
                enemies[i].startFleeing();
            }
        }
    }

    // ---- Public model record -----------------------------------------------

    const model: GameModel = {
        get phase() {
            return gamePhase;
        },
        get field() {
            return field;
        },
        get digger() {
            return digger;
        },
        get enemies() {
            return enemies;
        },
        get rocks() {
            return rocks;
        },
        get score() {
            return scoreModel;
        },
        get playerInput() {
            return playerInput;
        },

        reset(): void {
            scoreModel.reset();
            levelIndex = 0;
            loadLevel();
        },

        update(deltaMs: number): void {
            playerInput.update(deltaMs);

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
                digger.setDirection(playerInput.direction);
                if (playerInput.pumpPressed) {
                    digger.startPump();
                } else {
                    digger.stopPump();
                }
            }

            // Advance phase timeline (dying / level-clear delays)
            phaseTimeline.time(phaseTimeline.time() + 0.001 * deltaMs);
            if (gamePhase !== 'playing') return;

            // Update children
            field.update(deltaMs);
            digger.update(deltaMs);
            for (let i = 0; i < enemies.length; i++) {
                enemies[i].update(deltaMs);
            }
            for (let i = 0; i < rocks.length; i++) {
                rocks[i].update(deltaMs);
            }
            scoreModel.update(deltaMs);

            // Collision checks
            checkDigging();
            checkHarpoonHits();
            checkRockDestabilization();
            checkRockCrush();
            if (gamePhase === 'playing') checkEnemyDiggerCollision();
            if (gamePhase === 'playing') checkFygarFire();
            if (gamePhase === 'playing') checkLastEnemyFlee();

            // Level clear check
            if (gamePhase === 'playing' && aliveEnemyCount() === 0) {
                scheduleLevelClear();
            }
        },
    };

    return model;
}
