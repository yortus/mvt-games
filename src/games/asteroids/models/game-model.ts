import gsap from 'gsap';
import { watch } from '#common';
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
} from '../data';
import type { AsteroidSize, GamePhase } from './common';
import { createShipModel, type ShipModel } from './ship-model';
import { createAsteroidModel, type AsteroidModel } from './asteroid-model';
import { createBulletModel, type BulletModel } from './bullet-model';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createScoreModel, type ScoreModel } from './score-model';
import { createDebrisModel, type DebrisModel } from './debris-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly ship: ShipModel;
    readonly asteroids: readonly AsteroidModel[];
    readonly bullets: readonly BulletModel[];
    readonly debris: DebrisModel;
    readonly score: ScoreModel;
    readonly playerInput: PlayerInput;
    reset(): void;
    update(deltaMs: number): void;
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

export function createGameModel(options: GameModelOptions): GameModel {
    const { arenaWidth, arenaHeight } = options;

    let gamePhase: GamePhase = 'playing';
    let fireConsumed = false;

    const phaseTimeline = gsap.timeline({ paused: true });

    // ---- Initialise --------------------------------------------------------

    const ship = buildShip();
    let bullets = buildBulletPool();
    let asteroids: AsteroidModel[] = [];
    const scoreModel = createScoreModel();
    const debrisModel = createDebrisModel({ lifetimeMs: DYING_DELAY_MS });
    const playerInput = createPlayerInput();
    const watcher = watch({ restart: () => playerInput.restartPressed });

    // Spawn first wave
    asteroids = spawnWaveAsteroids(asteroidCountForWave(1));

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
            return scoreModel;
        },
        get playerInput() {
            return playerInput;
        },

        reset(): void {
            scoreModel.reset();
            loadWave();
        },

        update(deltaMs: number): void {
            // Restart handling
            const watched = watcher.poll();
            if (watched.restart.changed && watched.restart.value) {
                if (gamePhase === 'game-over') {
                    model.reset();
                }
            }

            // Apply input
            if (gamePhase === 'playing') {
                ship.setRotationDirection(playerInput.rotationDirection);
                ship.setThrust(playerInput.thrustPressed);

                if (playerInput.firePressed) {
                    tryFire();
                } else {
                    fireConsumed = false;
                }
            }

            // Advance phase timeline (dying / wave-clear / respawn delays)
            phaseTimeline.time(phaseTimeline.time() + 0.001 * deltaMs);
            debrisModel.update(deltaMs);

            // During dying, respawning, wave-clear, and game-over,
            // asteroids keep moving but no input or collision checks
            if (gamePhase !== 'playing' && gamePhase !== 'respawning') {
                if (gamePhase === 'dying') {
                    for (let i = 0; i < asteroids.length; i++) asteroids[i].update(deltaMs);
                }
                return;
            }

            // During respawning, only advance asteroids (no input or collisions)
            if (gamePhase === 'respawning') {
                for (let i = 0; i < asteroids.length; i++) asteroids[i].update(deltaMs);
                return;
            }

            // Update children
            ship.update(deltaMs);
            for (let i = 0; i < asteroids.length; i++) asteroids[i].update(deltaMs);
            for (let i = 0; i < bullets.length; i++) bullets[i].update(deltaMs);
            scoreModel.update(deltaMs);

            // Collision checks
            checkBulletsVsAsteroids();
            if (gamePhase === 'playing') checkShipVsAsteroids();

            // Wave clear
            if (gamePhase === 'playing' && aliveAsteroidCount() === 0) {
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
            arenaWidth,
            arenaHeight,
        });
    }

    function spawnWaveAsteroids(count: number): AsteroidModel[] {
        const result: AsteroidModel[] = [];
        for (let i = 0; i < count; i++) {
            let ax: number;
            let ay: number;
            // Keep trying positions until outside safe radius from ship
            do {
                ax = Math.random() * arenaWidth;
                ay = Math.random() * arenaHeight;
            } while (distSq(ax, ay, ship.x, ship.y) < SPAWN_SAFE_RADIUS * SPAWN_SAFE_RADIUS);
            result.push(spawnAsteroid(ax, ay, 'large'));
        }
        return result;
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

    function aliveAsteroidCount(): number {
        let count = 0;
        for (let i = 0; i < asteroids.length; i++) {
            if (asteroids[i].alive) count++;
        }
        return count;
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
            for (let a = 0; a < asteroids.length; a++) {
                if (!asteroids[a].alive) continue;
                const d = distSq(cx, cy, asteroids[a].x, asteroids[a].y);
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
        ship.respawn(arenaWidth / 2, arenaHeight / 2);
        bullets = buildBulletPool();
        asteroids = spawnWaveAsteroids(asteroidCountForWave(scoreModel.wave));
        debrisModel.clear();
        fireConsumed = false;
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
                if (scoreModel.loseLife()) {
                    // Find a safe respawn position away from all asteroids
                    const safePos = findSafeRespawnPosition();
                    respawnX = safePos.x;
                    respawnY = safePos.y;
                    // Start reverse-explode animation converging to safe position
                    gamePhase = 'respawning';
                    debrisModel.reverseSpawn(respawnX, respawnY, 0, RESPAWN_ANIM_MS);
                } else {
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
                scoreModel.advanceWave();
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
        if (!ship.alive || !playerInput.firePressed) return;
        if (!fireConsumed) {
            fireConsumed = true;
            for (let b = 0; b < bullets.length; b++) {
                if (!bullets[b].active) {
                    const bvx = Math.sin(ship.angle) * BULLET_SPEED;
                    const bvy = -Math.cos(ship.angle) * BULLET_SPEED;
                    bullets[b].fire(ship.x, ship.y, bvx, bvy);
                    break;
                }
            }
        }
    }

    // ---- Collision detection -----------------------------------------------

    function checkBulletsVsAsteroids(): void {
        for (let b = 0; b < bullets.length; b++) {
            const bullet = bullets[b];
            if (!bullet.active) continue;

            for (let a = 0; a < asteroids.length; a++) {
                const ast = asteroids[a];
                if (!ast.alive) continue;

                const hitDist = ast.radius + BULLET_RADIUS;
                if (distSq(bullet.x, bullet.y, ast.x, ast.y) < hitDist * hitDist) {
                    scoreModel.addPoints(SCORE_BY_SIZE[ast.size]);
                    bullet.deactivate();
                    splitAsteroid(a);
                    break;
                }
            }
        }
    }

    function checkShipVsAsteroids(): void {
        if (!ship.alive) return;

        for (let a = 0; a < asteroids.length; a++) {
            const ast = asteroids[a];
            if (!ast.alive) continue;

            const hitDist = ast.radius + SHIP_RADIUS;
            if (distSq(ship.x, ship.y, ast.x, ast.y) < hitDist * hitDist) {
                ship.kill();
                scheduleDying();
                return;
            }
        }
    }

    function splitAsteroid(index: number): void {
        const ast = asteroids[index];
        ast.kill();

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
                arenaWidth,
                arenaHeight,
            });
            asteroids.push(child);
        }
    }
}
