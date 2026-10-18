import gsap from 'gsap';
import type { TileKind, DepthLayer, LevelConfig } from '../data';
import { DEPTH_LAYERS } from '../data';
import { createFieldModel, type FieldModel } from './field-model';
import { createDiggerModel, type DiggerModel } from './digger-model';
import { createEnemyModel, type EnemyModel } from './enemy-model';
import { createRockModel, type RockModel } from './rock-model';
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
    readonly score: number;
    readonly lives: number;
    readonly level: number;
    /**
     * The way the player steers the digger, or 'none' to stop. In play, the
     * digger turns and tunnels this way.
     */
    direction: Direction;
    /**
     * Whether the player is keeping the harpoon out. While it is, the digger
     * stops, shoots its harpoon the way it faces, and keeps it out, holding
     * any creature it hits. Once it is not, the digger draws the harpoon back
     * in, unless it holds a creature.
     */
    isHarpoonOut: boolean;
    /**
     * Pumps the creature the harpoon holds, once, at the next update. A pump
     * with nothing held does nothing, since a creature the harpoon hits is
     * pumped as it is hit.
     */
    pump: () => void;
    /** Asks for a new game. It starts at the next update, if the last game is over. */
    startNewRun: () => void;
    reset: () => void;
    /**
     * Returns the game as a value JSON can hold, for `load` to restore. A
     * game is saved as of the start of its level, with the score it had then,
     * and the lives it has now, so that leaving and resuming a game never
     * helps it. A level just cleared is saved as the start of the next.
     * Returns undefined once the last life is lost, and while the game is
     * still at its start, since resuming it would only start it again.
     */
    save: () => SavedGame | undefined;
    /**
     * Restores a game that `save` returned, in place of this one, at the
     * start of its level. Returns whether it could: a value that is not a
     * saved game, such as one from an older version, leaves the game as it
     * was.
     */
    load: (saved: unknown) => boolean;
    update: (deltaMs: number) => void;
}

/** A game part way through, as `save` returns it: the level to start, with its score and lives. */
export interface SavedGame {
    readonly version: typeof SAVED_GAME_VERSION;
    readonly level: number;
    readonly score: number;
    readonly lives: number;
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

export function createGameModel(options: GameModelOptions): GameModel {
    const { levels, fieldCols, fieldRows, baseLayout, diggerSpawn } = options;

    let gamePhase: GamePhase = 'playing';
    let levelIndex = 0;
    let score = 0;
    let lives = START_LIVES;
    let level = 1;
    /**
     * The score as this level last started, which a save keeps. A level
     * starts again after a death, keeping the score, so this is the score
     * as of that restart. The level's own points are won again on resuming.
     */
    let levelStartScore = 0;

    /** Index of the enemy currently attached to the harpoon, or -1. */
    let harpoonTarget = -1;
    /** Whether a pump was asked for since the last update. */
    let isPumpRequested = false;
    /** Whether a new game was asked for since the last update. */
    let isNewRunRequested = false;

    const phaseTimeline = gsap.timeline({ paused: true });

    // ---- Initialise --------------------------------------------------------

    let field = buildField();
    let digger = buildDigger(field);
    let enemies = buildEnemies(field);
    let rocks = buildRocks(field);

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
            return score;
        },
        get lives() {
            return lives;
        },
        get level() {
            return level;
        },
        direction: 'none',
        isHarpoonOut: false,
        pump: () => { isPumpRequested = true; },
        startNewRun: () => { isNewRunRequested = true; },

        reset(): void {
            score = 0;
            lives = START_LIVES;
            level = 1;
            levelIndex = 0;
            loadLevel();
        },

        save() {
            if (gamePhase === 'game-over') return undefined;
            // A life lost while the digger dies is taken once the delay is over
            const livesLeft = gamePhase === 'dying' ? lives - 1 : lives;
            if (livesLeft <= 0) return undefined;
            if (gamePhase === 'level-clear') return { version: SAVED_GAME_VERSION, level: level + 1, score, lives: livesLeft };
            // A game still at its start has nothing worth resuming: it would only start again
            if (level === 1 && levelStartScore === 0) return undefined;
            return { version: SAVED_GAME_VERSION, level, score: levelStartScore, lives: livesLeft };
        },

        load(value) {
            if (!isSavedGame(value)) return false;
            level = value.level;
            levelIndex = value.level - 1;
            score = value.score;
            lives = value.lives;
            loadLevel();
            return true;
        },

        update(deltaMs: number): void {
            // A new game asked for while one is under way is dropped, not kept for later
            if (isNewRunRequested && gamePhase === 'game-over') model.reset();
            isNewRunRequested = false;
            // A pump counts at this update only: with nothing to pump, it is dropped
            const isPumping = isPumpRequested;
            isPumpRequested = false;

            // Apply input
            if (gamePhase === 'playing') {
                digger.setDirection(model.direction);
                if (model.isHarpoonOut) {
                    digger.startPump();
                }
                else {
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

            // Collision checks
            checkDigging();
            checkHarpoonHits(isPumping);
            checkRockDestabilization();
            checkRockCrush();
            if (gamePhase === 'playing') checkEnemyDiggerCollision();
            if (gamePhase === 'playing') checkSalamanderFire();
            if (gamePhase === 'playing') checkLastEnemyFlee();

            // Level clear check
            if (gamePhase === 'playing' && aliveEnemyCount() === 0) {
                scheduleLevelClear();
            }
        },
    };

    return model;

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
            if (enemies[i].isAlive && enemies[i].phase === 'ghosting') return true;
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

    // ---- Helpers -----------------------------------------------------------

    function aliveEnemyCount(): number {
        let count = 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].isAlive) count++;
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
            // Out of bounds - stop
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
        levelStartScore = score;
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
                    loadLevel();
                }
                else {
                    gamePhase = 'game-over';
                }
            },
            undefined,
            DYING_DELAY_MS * 0.001,
        );
    }

    function scheduleLevelClear(): void {
        gamePhase = 'level-clear';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                level++;
                levelIndex++;
                loadLevel();
            },
            undefined,
            LEVEL_CLEAR_DELAY_MS * 0.001,
        );
    }

    // ---- Collision detection -----------------------------------------------

    function checkDigging(): void {
        // If digger is at a dirt tile, dig it
        const digRow = Math.round(digger.row);
        const digCol = Math.round(digger.col);
        if (field.isDirt(digRow, digCol)) {
            field.dig(digRow, digCol);
        }
    }

    /** Hooks a creature at the harpoon's tip, and pumps the one it holds if `isPumping`. */
    function checkHarpoonHits(isPumping: boolean): void {
        if (!digger.isHarpoonExtended) {
            harpoonTarget = -1;
            digger.lockHarpoon(false);
            return;
        }

        // If we already have a target, keep pumping that one
        if (harpoonTarget >= 0) {
            const target = enemies[harpoonTarget];
            if (!target.isAlive || target.phase === 'popped' || target.phase === 'crushed') {
                harpoonTarget = -1;
                digger.lockHarpoon(false);
                return;
            }
            // Keep the harpoon locked at its current distance
            digger.lockHarpoon(true);
            // Inflate once per pump
            if (isPumping) {
                const popped = target.inflate();
                if (popped) {
                    const layer = depthLayerIndex(target.row);
                    let points = PUMP_POINTS[layer];
                    if (target.kind === 'salamander' && (digger.direction === 'left' || digger.direction === 'right')) {
                        points *= 2;
                    }
                    score += points;
                    harpoonTarget = -1;
                    digger.lockHarpoon(false);
                }
            }
            return;
        }

        // No target yet - scan for enemy near the harpoon tip
        if (digger.harpoonDistance < 0.3) return;

        const delta = DIRECTION_DELTA[digger.direction];
        const tipRow = digger.row + delta[0] * digger.harpoonDistance;
        const tipCol = digger.col + delta[1] * digger.harpoonDistance;

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.isAlive || enemy.phase === 'popped' || enemy.phase === 'crushed') continue;

            const dist = (enemy.col - tipCol) ** 2 + (enemy.row - tipRow) ** 2;
            if (dist < COLLISION_THRESHOLD_SQ) {
                harpoonTarget = i;
                digger.lockHarpoon(true);
                // First pump hit
                const popped = enemy.inflate();
                if (popped) {
                    const layer = depthLayerIndex(enemy.row);
                    let points = PUMP_POINTS[layer];
                    if (enemy.kind === 'salamander' && (digger.direction === 'left' || digger.direction === 'right')) {
                        points *= 2;
                    }
                    score += points;
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
            if (!rock.isAlive || rock.phase !== 'stable') continue;
            // Check if tile below rock is now a tunnel
            if (field.isWalkable(rock.row + 1, rock.col)) {
                rock.destabilize();
            }
        }
    }

    function checkRockCrush(): void {
        for (let i = 0; i < rocks.length; i++) {
            const rock = rocks[i];
            if (!rock.isAlive || rock.phase !== 'falling') continue;

            // Check collision with enemies
            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
                if (!enemy.isAlive) continue;
                const dr = rock.smoothRow - enemy.row;
                const dc = rock.smoothCol - enemy.col;
                if (dr * dr + dc * dc < COLLISION_THRESHOLD_SQ) {
                    enemy.crush();
                    score += ROCK_CRUSH_POINTS;
                }
            }

            // Check collision with digger
            const ddr = rock.smoothRow - digger.row;
            const ddc = rock.smoothCol - digger.col;
            if (ddr * ddr + ddc * ddc < COLLISION_THRESHOLD_SQ) {
                digger.kill();
                scheduleDying();
            }
        }
    }

    function checkEnemyDiggerCollision(): void {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.isAlive) continue;
            if (enemy.phase === 'inflating' || enemy.phase === 'popped' || enemy.phase === 'crushed') continue;
            const dr = digger.row - enemy.row;
            const dc = digger.col - enemy.col;
            if (dr * dr + dc * dc < COLLISION_THRESHOLD_SQ) {
                digger.kill();
                scheduleDying();
                return;
            }
        }
    }

    function checkSalamanderFire(): void {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.isAlive || enemy.kind !== 'salamander' || !enemy.isFireActive) continue;

            // Fire extends horizontally from salamander in its facing direction
            const dir = enemy.direction;
            if (dir !== 'left' && dir !== 'right') continue;
            const dc = dir === 'right' ? 1 : -1;

            for (let t = 1; t <= FIRE_RANGE; t++) {
                const fireCol = enemy.col + dc * t;
                const fireRow = enemy.row;
                const dx = digger.col - fireCol;
                const dy = digger.row - fireRow;
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
            if (enemies[i].isAlive && !enemies[i].isFleeing) {
                enemies[i].startFleeing();
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

/**
 * Whether `value` is a saved game: a level from 1, a score from 0, and from
 * 1 life to as many as a game starts with. Any level from 1 will do, since
 * the levels past the last play the last again.
 */
function isSavedGame(value: unknown): value is SavedGame {
    // typeof null is 'object' too
    if (typeof value !== 'object' || value === null) return false;
    const { version, level, score, lives } = value as Record<string, unknown>;
    return version === SAVED_GAME_VERSION
        && isWholeNumber(level) && level >= 1
        && isWholeNumber(score)
        && isWholeNumber(lives) && lives >= 1 && lives <= START_LIVES;
}

/** Whether `value` is a whole number, 0 or more. */
function isWholeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

const COLLISION_THRESHOLD_SQ = 0.5 * 0.5;
const FIRE_RANGE = 3; // tiles
const LEVEL_CLEAR_DELAY_MS = 1000;
const DYING_DELAY_MS = 1000;

/** Points for pumping an enemy, indexed by depth layer (0–3). */
const PUMP_POINTS = [100, 150, 200, 250];

/** Points for each enemy crushed by a rock. */
const ROCK_CRUSH_POINTS = 800;

function depthLayerIndex(row: number): number {
    for (let i = 0; i < DEPTH_LAYERS.length; i++) {
        const layer: DepthLayer = DEPTH_LAYERS[i];
        if (row >= layer.startRow && row <= layer.endRow) return i;
    }
    return 0;
}
