import gsap from 'gsap';
import { createSlotList, type Slot, type SlotList } from '@mvtjs/utils';
import {
    SHIP_ROTATION_SPEED,
    SHIP_THRUST,
    SHIP_DRAG,
    SHIP_MAX_SPEED,
    SHIP_RADIUS,
    MAX_BULLETS,
    BULLET_SPEED,
    BULLET_LIFETIME_MS,
    BULLET_RADIUS,
    ASTEROID_RADIUS_LARGE,
    ASTEROID_RADIUS_MEDIUM,
    ASTEROID_RADIUS_SMALL,
    ASTEROID_MIN_SPEED,
    ASTEROID_MAX_SPEED,
    ASTEROID_SPLIT_SPEED_MULT,
    WAVE_BASE_ASTEROIDS,
    WAVE_ASTEROID_INCREMENT,
    WAVE_MAX_ASTEROIDS,
    SCORE_LARGE,
    SCORE_MEDIUM,
    SCORE_SMALL,
    WAVE_CLEAR_DELAY_MS,
    DYING_DELAY_MS,
    RESPAWN_ANIM_MS,
    SPAWN_SAFE_RADIUS,
} from './model-constants';
import type { AsteroidSize, GamePhase, RotationDirection } from './common';
import { createShipModel, type ShipModel } from './ship-model';
import { createAsteroidModel, type AsteroidModel } from './asteroid-model';
import { createBulletModel, type BulletModel } from './bullet-model';
import { createDebrisModel, type DebrisModel } from './debris-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly ship: ShipModel;
    readonly asteroids: SlotList<AsteroidModel>;
    readonly bullets: readonly BulletModel[];
    readonly debris: DebrisModel;
    readonly score: number;
    readonly lives: number;
    readonly wave: number;
    /**
     * The number of shots fired this game. It is a count rather than a flag,
     * because a shot's bullet may be gone before a view looks. Each rise is
     * a shot, and it goes back to 0 for a new game.
     */
    readonly shotsFired: number;
    /**
     * The number of rocks broken this game. A broken rock leaves its slot in
     * the same tick, so its own view never sees it break. Each rise is a
     * break, and it goes back to 0 for a new game.
     */
    readonly rocksBroken: number;
    /** The size of the rock broken last. It is undefined until a rock breaks in this game. */
    readonly lastBrokenRockSize: AsteroidSize | undefined;
    /**
     * The number of breaks still needed to clear the wave. A large rock takes
     * 7, since it splits into 2 medium rocks and each of those into 2 small
     * ones. It falls by 1 with each break, and is 0 once the wave is cleared.
     */
    readonly breaksLeft: number;
    /** The way the player is turning the ship. It turns this way while the game is playing. */
    turning: RotationDirection;
    /** Whether the player is running the ship's engine, which pushes it the way it faces. It pushes while the game is playing. */
    isThrusting: boolean;
    /** Fires a shot. It leaves at the next update, if the game is playing and a bullet is free. */
    fire: () => void;
    /** Asks for a new game. It starts at the next update, if the last game is over. */
    startNewRun: () => void;
    reset: () => void;
    /**
     * Returns the game as a value JSON can hold, for `load` to restore. A
     * game is saved as of the start of its wave, with the score it had then,
     * and the lives it has now, so that leaving and resuming a game never
     * helps it. A wave just cleared is saved as the start of the next.
     * Returns undefined once the last life is lost, and while the game is
     * still on its first wave, since resuming that would only start it
     * again.
     */
    save: () => SavedGame | undefined;
    /**
     * Restores a game that `save` returned, in place of this one, at the
     * start of its wave. Returns whether it could: a value that is not a
     * saved game, such as one from an older version, leaves the game as it
     * was.
     */
    load: (saved: unknown) => boolean;
    update: (deltaMs: number) => void;
}

/** A game part way through, as `save` returns it: the wave to start, with its score and lives. */
export interface SavedGame {
    readonly version: typeof SAVED_GAME_VERSION;
    readonly wave: number;
    readonly score: number;
    readonly lives: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    readonly arenaWidth: number;
    readonly arenaHeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameModel(options: GameModelOptions): GameModel {
    const { arenaWidth, arenaHeight } = options;

    let gamePhase: GamePhase = 'playing';
    /** Whether a shot was asked for since the last update. */
    let isFireRequested = false;
    /** Whether a new game was asked for since the last update. */
    let isNewRunRequested = false;
    let score = 0;
    let lives = START_LIVES;
    let wave = 1;
    /** The score as this wave started, which a save keeps. The wave's own points are won again on resuming. */
    let waveStartScore = 0;
    /** The next asteroid's shape seed. It counts from 1 in each game, so one game's shapes never depend on another's. */
    let nextShapeSeed = 1;
    let shotsFired = 0;
    let rocksBroken = 0;
    let lastBrokenRockSize: AsteroidSize | undefined;
    let breaksLeft = 0;

    const phaseTimeline = gsap.timeline({ paused: true });

    // ---- Initialise --------------------------------------------------------

    const ship = buildShip();
    let bullets = buildBulletPool();
    const asteroids = createSlotList<AsteroidModel>();
    const debrisModel = createDebrisModel({ lifetimeMs: DYING_DELAY_MS });

    // Spawn first wave
    spawnWaveAsteroids(asteroidCountForWave(1));

    // ---- Public record -----------------------------------------------------

    const model: GameModel = {
        get phase() {
            return gamePhase;
        },
        get ship() {
            return ship;
        },
        get asteroids() {
            return asteroids;
        },
        get bullets() {
            return bullets;
        },
        get debris() {
            return debrisModel;
        },
        get score() {
            return score;
        },
        get lives() {
            return lives;
        },
        get wave() {
            return wave;
        },
        get shotsFired() {
            return shotsFired;
        },
        get rocksBroken() {
            return rocksBroken;
        },
        get lastBrokenRockSize() {
            return lastBrokenRockSize;
        },
        get breaksLeft() {
            return breaksLeft;
        },
        turning: 'none',
        isThrusting: false,

        fire(): void {
            isFireRequested = true;
        },

        startNewRun(): void {
            isNewRunRequested = true;
        },

        reset(): void {
            score = 0;
            shotsFired = 0;
            rocksBroken = 0;
            lastBrokenRockSize = undefined;
            lives = START_LIVES;
            wave = 1;
            loadWave();
        },

        save() {
            if (gamePhase === 'game-over') return undefined;
            // A life lost while the ship breaks up is taken once the pieces settle
            const livesLeft = gamePhase === 'dying' ? lives - 1 : lives;
            if (livesLeft <= 0) return undefined;
            if (gamePhase === 'wave-clear') return { version: SAVED_GAME_VERSION, wave: wave + 1, score, lives: livesLeft };
            // A game still at its start has nothing worth resuming. Resuming would only start it again
            if (wave === 1 && waveStartScore === 0) return undefined;
            return { version: SAVED_GAME_VERSION, wave, score: waveStartScore, lives: livesLeft };
        },

        load(value) {
            if (!isSavedGame(value)) return false;
            wave = value.wave;
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
                ship.setRotationDirection(model.turning);
                ship.setThrust(model.isThrusting);
                if (isFireRequested) tryFire();
            }
            isFireRequested = false;

            // Advance phase timeline (dying / wave-clear / respawn delays)
            phaseTimeline.time(phaseTimeline.time() + 0.001 * deltaMs);
            debrisModel.update(deltaMs);
            asteroids.update(deltaMs);

            // During dying, respawning, wave-clear, and game-over,
            // asteroids keep moving but no input or collision checks
            if (gamePhase !== 'playing' && gamePhase !== 'respawning') {
                if (gamePhase === 'dying') {
                    updateAsteroids(deltaMs);
                }
                return;
            }

            // During respawning, only advance asteroids (no input or collisions)
            if (gamePhase === 'respawning') {
                updateAsteroids(deltaMs);
                return;
            }

            // Update children
            ship.update(deltaMs);
            updateAsteroids(deltaMs);
            for (let i = 0; i < bullets.length; i++) bullets[i].update(deltaMs);

            // Collision checks
            checkBulletsVsAsteroids();
            if (gamePhase === 'playing') checkShipVsAsteroids();

            // Wave clear
            if (gamePhase === 'playing' && asteroids.liveCount === 0) {
                scheduleWaveClear();
            }
        },
    };

    return model;

    // ---- Random helpers ----------------------------------------------------

    function randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    function randomAngle(): number {
        return Math.random() * Math.PI * 2;
    }

    // ---- Child construction ------------------------------------------------

    function buildShip(): ShipModel {
        return createShipModel({
            startX: arenaWidth / 2,
            startY: arenaHeight / 2,
            rotationSpeed: SHIP_ROTATION_SPEED,
            thrust: SHIP_THRUST,
            drag: SHIP_DRAG,
            maxSpeed: SHIP_MAX_SPEED,
            arenaWidth,
            arenaHeight,
        });
    }

    function buildBulletPool(): BulletModel[] {
        const pool: BulletModel[] = [];
        for (let i = 0; i < MAX_BULLETS; i++) {
            pool.push(createBulletModel({ lifetimeMs: BULLET_LIFETIME_MS, arenaWidth, arenaHeight }));
        }
        return pool;
    }

    function spawnAsteroid(x: number, y: number, size: AsteroidSize): AsteroidModel {
        const speed = randomRange(ASTEROID_MIN_SPEED, ASTEROID_MAX_SPEED);
        const dir = randomAngle();
        return createAsteroidModel({
            startX: x,
            startY: y,
            vx: Math.cos(dir) * speed,
            vy: Math.sin(dir) * speed,
            size,
            radius: RADIUS_BY_SIZE[size],
            shapeSeed: nextShapeSeed++,
            arenaWidth,
            arenaHeight,
        });
    }

    function spawnWaveAsteroids(count: number): void {
        for (let i = 0; i < count; i++) {
            let ax: number;
            let ay: number;
            // Keep trying positions until outside safe radius from ship
            do {
                ax = Math.random() * arenaWidth;
                ay = Math.random() * arenaHeight;
            } while (distSq(ax, ay, ship.x, ship.y) < SPAWN_SAFE_RADIUS * SPAWN_SAFE_RADIUS);
            asteroids.insert(spawnAsteroid(ax, ay, 'large'));
            breaksLeft += BREAKS_BY_SIZE.large;
        }
    }

    function asteroidCountForWave(wave: number): number {
        const count = WAVE_BASE_ASTEROIDS + (wave - 1) * WAVE_ASTEROID_INCREMENT;
        return count > WAVE_MAX_ASTEROIDS ? WAVE_MAX_ASTEROIDS : count;
    }

    // ---- Helpers -----------------------------------------------------------

    function distSq(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    function updateAsteroids(deltaMs: number): void {
        for (let i = 0; i < asteroids.slots.length; i++) {
            const slot = asteroids.slots.at(i);
            if (slot !== undefined) slot.value.update(deltaMs);
        }
    }

    function findSafeRespawnPosition(): { x: number; y: number } {
        // Try up to 50 random positions and pick the one farthest from
        // the nearest asteroid. Fall back to centre if nothing found.
        const safeRadiusSq = SPAWN_SAFE_RADIUS * SPAWN_SAFE_RADIUS;
        let bestX = arenaWidth / 2;
        let bestY = arenaHeight / 2;
        let bestMinDist = -1;

        for (let attempt = 0; attempt < 50; attempt++) {
            const cx = Math.random() * arenaWidth;
            const cy = Math.random() * arenaHeight;

            let minDist = Infinity;
            for (let a = 0; a < asteroids.slots.length; a++) {
                const slot = asteroids.slots.at(a);
                if (slot === undefined || !slot.value.isAlive) continue;
                const d = distSq(cx, cy, slot.value.x, slot.value.y);
                if (d < minDist) minDist = d;
            }

            if (minDist > bestMinDist) {
                bestMinDist = minDist;
                bestX = cx;
                bestY = cy;
            }

            // Good enough - far from all asteroids
            if (bestMinDist >= safeRadiusSq * 4) break;
        }

        return { x: bestX, y: bestY };
    }

    // ---- Wave management ---------------------------------------------------

    function loadWave(): void {
        waveStartScore = score;
        ship.respawn(arenaWidth / 2, arenaHeight / 2);
        bullets = buildBulletPool();
        asteroids.clear();
        breaksLeft = 0;
        spawnWaveAsteroids(asteroidCountForWave(wave));
        debrisModel.clear();
        gamePhase = 'playing';
        phaseTimeline.clear().time(0);
    }

    function scheduleDying(): void {
        gamePhase = 'dying';
        debrisModel.spawn(ship.x, ship.y, ship.angle);
        phaseTimeline.clear().time(0);

        let respawnX = arenaWidth / 2;
        let respawnY = arenaHeight / 2;

        phaseTimeline.call(
            () => {
                debrisModel.clear();
                lives--;
                if (lives > 0) {
                    // Find a safe respawn position away from all asteroids
                    const safePos = findSafeRespawnPosition();
                    respawnX = safePos.x;
                    respawnY = safePos.y;
                    // Start reverse-explode animation converging to safe position
                    gamePhase = 'respawning';
                    debrisModel.reverseSpawn(respawnX, respawnY, 0, RESPAWN_ANIM_MS);
                }
                else {
                    gamePhase = 'game-over';
                }
            },
            undefined,
            DYING_DELAY_MS * 0.001,
        );

        phaseTimeline.call(
            () => {
                if (gamePhase === 'respawning') {
                    debrisModel.clear();
                    ship.respawn(respawnX, respawnY);
                    deactivateAllBullets();
                    gamePhase = 'playing';
                }
            },
            undefined,
            (DYING_DELAY_MS + RESPAWN_ANIM_MS) * 0.001,
        );
    }

    function scheduleWaveClear(): void {
        gamePhase = 'wave-clear';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                wave++;
                loadWave();
            },
            undefined,
            WAVE_CLEAR_DELAY_MS * 0.001,
        );
    }

    function deactivateAllBullets(): void {
        for (let i = 0; i < bullets.length; i++) bullets[i].deactivate();
    }

    // ---- Firing ------------------------------------------------------------

    function tryFire(): void {
        if (!ship.isAlive) return;
        for (let b = 0; b < bullets.length; b++) {
            if (!bullets[b].isActive) {
                const bvx = Math.sin(ship.angle) * BULLET_SPEED;
                const bvy = -Math.cos(ship.angle) * BULLET_SPEED;
                bullets[b].fire(ship.x, ship.y, bvx, bvy);
                shotsFired++;
                break;
            }
        }
    }

    // ---- Collision detection -----------------------------------------------

    function checkBulletsVsAsteroids(): void {
        for (let b = 0; b < bullets.length; b++) {
            const bullet = bullets[b];
            if (!bullet.isActive) continue;

            for (let a = 0; a < asteroids.slots.length; a++) {
                const slot = asteroids.slots.at(a);
                if (slot === undefined || !slot.value.isAlive) continue;

                const ast = slot.value;
                const hitDist = ast.radius + BULLET_RADIUS;
                if (distSq(bullet.x, bullet.y, ast.x, ast.y) < hitDist * hitDist) {
                    score += SCORE_BY_SIZE[ast.size];
                    bullet.deactivate();
                    splitAsteroid(slot);
                    break;
                }
            }
        }
    }

    function checkShipVsAsteroids(): void {
        if (!ship.isAlive) return;

        for (let a = 0; a < asteroids.slots.length; a++) {
            const slot = asteroids.slots.at(a);
            if (slot === undefined || !slot.value.isAlive) continue;

            const ast = slot.value;
            const hitDist = ast.radius + SHIP_RADIUS;
            if (distSq(ship.x, ship.y, ast.x, ast.y) < hitDist * hitDist) {
                ship.kill();
                scheduleDying();
                return;
            }
        }
    }

    function splitAsteroid(slot: Slot<AsteroidModel>): void {
        const ast = slot.value;
        ast.kill();
        rocksBroken++;
        lastBrokenRockSize = ast.size;
        breaksLeft--;
        asteroids.remove(slot);

        const childSize = CHILD_SIZE[ast.size];
        if (!childSize) return;

        // Spawn two children
        for (let c = 0; c < 2; c++) {
            const speed = randomRange(ASTEROID_MIN_SPEED, ASTEROID_MAX_SPEED) * ASTEROID_SPLIT_SPEED_MULT;
            const dir = randomAngle();
            const child = createAsteroidModel({
                startX: ast.x,
                startY: ast.y,
                vx: Math.cos(dir) * speed,
                vy: Math.sin(dir) * speed,
                size: childSize,
                radius: RADIUS_BY_SIZE[childSize],
                shapeSeed: nextShapeSeed++,
                arenaWidth,
                arenaHeight,
            });
            asteroids.insert(child);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const START_LIVES = 3;
/** Marks the shape of a saved game. A change to the shape changes it, so older saves are not loaded. */
const SAVED_GAME_VERSION = 1;

/** Whether `value` is a saved game: a wave from 1, a score from 0, and from 1 life to as many as a game starts with. */
function isSavedGame(value: unknown): value is SavedGame {
    // typeof null is 'object' too
    if (typeof value !== 'object' || value === null) return false;
    const { version, wave, score, lives } = value as Record<string, unknown>;
    return version === SAVED_GAME_VERSION
        && isWholeNumber(wave) && wave >= 1
        && isWholeNumber(score)
        && isWholeNumber(lives) && lives >= 1 && lives <= START_LIVES;
}

/** Whether `value` is a whole number, 0 or more. */
function isWholeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

const SCORE_BY_SIZE: Record<AsteroidSize, number> = {
    large: SCORE_LARGE,
    medium: SCORE_MEDIUM,
    small: SCORE_SMALL,
};

const RADIUS_BY_SIZE: Record<AsteroidSize, number> = {
    large: ASTEROID_RADIUS_LARGE,
    medium: ASTEROID_RADIUS_MEDIUM,
    small: ASTEROID_RADIUS_SMALL,
};

const CHILD_SIZE: Record<AsteroidSize, AsteroidSize | undefined> = {
    large: 'medium',
    medium: 'small',
    small: undefined,
};

/** The breaks it takes to clear a rock and all its pieces. A rock splits into 2 of the next size down. */
const BREAKS_BY_SIZE: Record<AsteroidSize, number> = {
    large: 7,
    medium: 3,
    small: 1,
};
