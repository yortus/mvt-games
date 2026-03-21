import gsap from 'gsap';
import { watch } from '#common';
import {
    SCROLL_SPEED,
    SHIP_SPEED,
    SHIP_START_COL,
    SHIP_START_ROW,
    SHIP_MIN_SCREEN_COL,
    SHIP_MAX_SCREEN_COL,
    SHIP_MIN_ROW,
    SHIP_MAX_ROW,
    MAX_BULLETS,
    BULLET_SPEED,
    MAX_BOMBS,
    BOMB_FORWARD_SPEED,
    BOMB_GRAVITY,
    SHIP_HALF_SIZE,
    ENEMY_HALF_SIZE,
    DYING_DELAY_MS,
    RESPAWN_DELAY_MS,
    SECTION_CLEAR_DELAY_MS,
    VISIBLE_COLS,
    VISIBLE_ROWS,
    MAX_ROCKETS,
    ROCKET_DETECT_RANGE,
    ROCKET_LAUNCH_SPEED,
    MAX_UFOS,
    UFO_SPEED,
    UFO_OSCILLATION_AMP,
    UFO_OSCILLATION_FREQ,
    MAX_FUEL_TANKS,
    FUEL_DEPLETION_RATE,
    FUEL_REFILL_AMOUNT,
    SCORE_ROCKET,
    SCORE_UFO,
    SCORE_FUEL_TANK,
    SCORE_BASE,
    INITIAL_LIVES,
    SPAWN_AHEAD,
    SPEED_INCREASE_PER_LOOP,
    MAX_EXPLOSIONS,
    EXPLOSION_DURATION_MS,
} from '../data';
import type { SectionProfile, SpawnKind } from '../data';
import type { GamePhase } from './common';
import { createShipModel, type ShipModel } from './ship-model';
import { createBulletModel, type BulletModel } from './bullet-model';
import { createBombModel, type BombModel } from './bomb-model';
import { createTerrainModel, type TerrainModel } from './terrain-model';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createRocketModel, type RocketModel } from './rocket-model';
import { createUfoModel, type UfoModel } from './ufo-model';
import { createFuelTankModel, type FuelTankModel } from './fuel-tank-model';
import { createScoreModel, type ScoreModel } from './score-model';
import { createExplosionModel, type ExplosionModel } from './explosion-model';

// ---------------------------------------------------------------------------
// Spawn list entry (absolute world column)
// ---------------------------------------------------------------------------

interface AbsoluteSpawn {
    readonly worldCol: number;
    readonly row: number;
    readonly kind: SpawnKind;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly ship: ShipModel;
    readonly bullets: readonly BulletModel[];
    readonly bombs: readonly BombModel[];
    readonly rockets: readonly RocketModel[];
    readonly ufos: readonly UfoModel[];
    readonly fuelTanks: readonly FuelTankModel[];
    readonly explosions: readonly ExplosionModel[];
    readonly terrain: TerrainModel;
    readonly score: ScoreModel;
    readonly scrollCol: number;
    readonly scrollSpeed: number;
    readonly playerInput: PlayerInput;
    readonly baseAlive: boolean;
    readonly baseWorldCol: number;
    readonly baseWorldRow: number;
    readonly scrollClamped: boolean;
    reset(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    readonly sections: readonly SectionProfile[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameModel(options: GameModelOptions): GameModel {
    const { sections } = options;

    let gamePhase: GamePhase = 'playing';
    let scrollCol = 0;
    let currentScrollSpeed = SCROLL_SPEED;
    let fireConsumed = false;
    let bombConsumed = false;
    let baseAlive = false;
    let baseActive = false;
    let baseFuelTankIndex = -1;
    let scrollClamped = false;

    const phaseTimeline = gsap.timeline({ paused: true });

    // ---- Spawn list (sorted by absolute world column) ----------------------

    const spawnList = buildSpawnList(sections);
    let spawnCursor = 0;

    // ---- Initialise --------------------------------------------------------

    const terrain = createTerrainModel({ sections, rows: VISIBLE_ROWS });
    const scoreModel = createScoreModel({
        initialLives: INITIAL_LIVES,
        fuelDepletionRate: FUEL_DEPLETION_RATE,
    });
    let ship = buildShip();
    let bullets = buildBulletPool();
    let bombs = buildBombPool();
    let rockets = buildRocketPool();
    let ufos = buildUfoPool();
    let fuelTanks = buildFuelTankPool();
    let explosions = buildExplosionPool();
    const playerInput = createPlayerInput();
    const watcher = watch({ restart: () => playerInput.restartPressed });

    // ---- Public record -----------------------------------------------------

    const model: GameModel = {
        get phase() {
            return gamePhase;
        },
        get ship() {
            return ship;
        },
        get bullets() {
            return bullets;
        },
        get bombs() {
            return bombs;
        },
        get rockets() {
            return rockets;
        },
        get ufos() {
            return ufos;
        },
        get fuelTanks() {
            return fuelTanks;
        },
        get explosions() {
            return explosions;
        },
        get terrain() {
            return terrain;
        },
        get score() {
            return scoreModel;
        },
        get scrollCol() {
            return scrollCol;
        },
        get scrollSpeed() {
            return currentScrollSpeed;
        },
        get playerInput() {
            return playerInput;
        },
        get baseAlive() {
            return baseAlive;
        },
        get baseWorldCol() {
            return baseFuelTankIndex >= 0 ? fuelTanks[baseFuelTankIndex].worldCol : -1;
        },
        get baseWorldRow() {
            return baseFuelTankIndex >= 0 ? fuelTanks[baseFuelTankIndex].worldRow : -1;
        },
        get scrollClamped() {
            return scrollClamped;
        },

        reset(): void {
            scrollCol = 0;
            currentScrollSpeed = SCROLL_SPEED;
            spawnCursor = 0;
            baseAlive = false;
            baseActive = false;
            baseFuelTankIndex = -1;
            scrollClamped = false;
            scoreModel.reset();
            ship = buildShip();
            bullets = buildBulletPool();
            bombs = buildBombPool();
            rockets = buildRocketPool();
            ufos = buildUfoPool();
            fuelTanks = buildFuelTankPool();
            explosions = buildExplosionPool();
            fireConsumed = false;
            bombConsumed = false;
            gamePhase = 'playing';
            phaseTimeline.clear().time(0);
        },

        update(deltaMs: number): void {
            // Restart handling
            const watched = watcher.poll();
            if (watched.restart.changed && watched.restart.value) {
                if (gamePhase === 'game-over') {
                    model.reset();
                }
            }

            // Advance phase timeline (dying / section-clear delays)
            phaseTimeline.time(phaseTimeline.time() + 0.001 * deltaMs);

            if (gamePhase !== 'playing') return;

            // Advance scroll
            scrollCol += currentScrollSpeed * deltaMs * 0.001;

            // Update section index
            scoreModel.setSectionIndex(terrain.getSectionIndex(Math.floor(scrollCol)));

            // Route input
            ship.setXDirection(playerInput.xDirection);
            ship.setYDirection(playerInput.yDirection);

            // Fire bullets
            if (playerInput.firePressed) {
                if (!fireConsumed) {
                    fireConsumed = true;
                    tryFireBullet();
                }
            }
            else {
                fireConsumed = false;
            }

            // Drop bombs
            if (playerInput.bombPressed) {
                if (!bombConsumed) {
                    bombConsumed = true;
                    tryDropBomb();
                }
            }
            else {
                bombConsumed = false;
            }

            // Spawn entities from cursor
            advanceSpawnCursor();

            // Update entities
            ship.update(deltaMs, scrollCol);
            for (let i = 0; i < bullets.length; i++) bullets[i].update(deltaMs);
            for (let i = 0; i < bombs.length; i++) bombs[i].update(deltaMs);
            for (let i = 0; i < rockets.length; i++) rockets[i].update(deltaMs, ship.worldCol);
            for (let i = 0; i < ufos.length; i++) ufos[i].update(deltaMs);
            for (let i = 0; i < fuelTanks.length; i++) fuelTanks[i].update(deltaMs);
            for (let i = 0; i < explosions.length; i++) explosions[i].update(deltaMs);
            scoreModel.update(deltaMs);

            // Deactivate off-screen entities
            deactivateOffscreenBullets();
            deactivateOffscreenBombs();
            deactivateOffscreenEnemies();

            // Collision detection
            if (gamePhase === 'playing') checkShipTerrainCollision();
            if (gamePhase === 'playing') checkShipVsRockets();
            if (gamePhase === 'playing') checkShipVsUfos();
            checkBulletsTerrainCollision();
            checkBombsTerrainCollision();
            checkBulletsVsEnemies();
            checkBombsVsEnemies();

            // Fuel death
            if (gamePhase === 'playing' && scoreModel.fuelEmpty) {
                shipDied();
            }

            // Section progression check
            if (gamePhase === 'playing') checkSectionProgression();
        },
    };

    return model;

    // ---- Spawn list builder ------------------------------------------------

    function buildSpawnList(secs: readonly SectionProfile[]): AbsoluteSpawn[] {
        const list: AbsoluteSpawn[] = [];
        let colOffset = 0;
        for (let s = 0; s < secs.length; s++) {
            const section = secs[s];
            for (let i = 0; i < section.spawns.length; i++) {
                const spawn = section.spawns[i];
                list.push({
                    worldCol: colOffset + spawn.col,
                    row: spawn.row,
                    kind: spawn.kind,
                });
            }
            colOffset += section.floor.length;
        }
        // Sort by world column
        list.sort((a, b) => a.worldCol - b.worldCol);
        return list;
    }

    // ---- Child construction ------------------------------------------------

    function buildShip(): ShipModel {
        return createShipModel({
            startWorldCol: SHIP_START_COL,
            startWorldRow: SHIP_START_ROW,
            speed: SHIP_SPEED,
            scrollSpeed: currentScrollSpeed,
            minScreenCol: SHIP_MIN_SCREEN_COL,
            maxScreenCol: SHIP_MAX_SCREEN_COL,
            minRow: SHIP_MIN_ROW,
            maxRow: SHIP_MAX_ROW,
        });
    }

    function buildBulletPool(): BulletModel[] {
        const pool: BulletModel[] = [];
        for (let i = 0; i < MAX_BULLETS; i++) {
            pool.push(createBulletModel());
        }
        return pool;
    }

    function buildBombPool(): BombModel[] {
        const pool: BombModel[] = [];
        for (let i = 0; i < MAX_BOMBS; i++) {
            pool.push(createBombModel({ gravity: BOMB_GRAVITY }));
        }
        return pool;
    }

    function buildRocketPool(): RocketModel[] {
        const pool: RocketModel[] = [];
        for (let i = 0; i < MAX_ROCKETS; i++) {
            pool.push(createRocketModel({
                detectRange: ROCKET_DETECT_RANGE,
                launchSpeed: ROCKET_LAUNCH_SPEED,
            }));
        }
        return pool;
    }

    function buildUfoPool(): UfoModel[] {
        const pool: UfoModel[] = [];
        for (let i = 0; i < MAX_UFOS; i++) {
            pool.push(createUfoModel({
                speed: UFO_SPEED,
                oscillationAmp: UFO_OSCILLATION_AMP,
                oscillationFreq: UFO_OSCILLATION_FREQ,
            }));
        }
        return pool;
    }

    function buildFuelTankPool(): FuelTankModel[] {
        const pool: FuelTankModel[] = [];
        for (let i = 0; i < MAX_FUEL_TANKS; i++) {
            pool.push(createFuelTankModel());
        }
        return pool;
    }

    function buildExplosionPool(): ExplosionModel[] {
        const pool: ExplosionModel[] = [];
        for (let i = 0; i < MAX_EXPLOSIONS; i++) {
            pool.push(createExplosionModel({ durationMs: EXPLOSION_DURATION_MS }));
        }
        return pool;
    }

    // ---- Explosions --------------------------------------------------------

    function spawnExplosion(worldCol: number, worldRow: number): void {
        for (let i = 0; i < explosions.length; i++) {
            if (!explosions[i].active) {
                explosions[i].spawn(worldCol, worldRow);
                return;
            }
        }
    }

    // ---- Spawn cursor ------------------------------------------------------

    function advanceSpawnCursor(): void {
        const spawnEdge = scrollCol + VISIBLE_COLS + SPAWN_AHEAD;
        while (spawnCursor < spawnList.length && spawnList[spawnCursor].worldCol <= spawnEdge) {
            const spawn = spawnList[spawnCursor];
            spawnEntity(spawn.kind, spawn.worldCol, spawn.row);
            spawnCursor++;
        }
    }

    function spawnEntity(kind: SpawnKind, worldCol: number, row: number): void {
        // Ground entities sit on the terrain surface (+0.5 so center-anchored
        // sprites are flush with the floor); airborne ones use the spawn row
        const groundRow = terrain.getSurfaceRow(Math.floor(worldCol)) + 0.5;

        if (kind === 'rocket') {
            for (let i = 0; i < rockets.length; i++) {
                if (!rockets[i].active) {
                    rockets[i].activate(worldCol, groundRow);
                    return;
                }
            }
        }
        else if (kind === 'ufo') {
            for (let i = 0; i < ufos.length; i++) {
                if (!ufos[i].active) {
                    ufos[i].activate(worldCol, row);
                    return;
                }
            }
        }
        else if (kind === 'fuel-tank') {
            for (let i = 0; i < fuelTanks.length; i++) {
                if (!fuelTanks[i].active) {
                    fuelTanks[i].activate(worldCol, groundRow);
                    return;
                }
            }
        }
        else if (kind === 'base') {
            // Use a fuel tank slot for the base, track it specially
            for (let i = 0; i < fuelTanks.length; i++) {
                if (!fuelTanks[i].active) {
                    fuelTanks[i].activate(worldCol, groundRow);
                    baseFuelTankIndex = i;
                    baseAlive = true;
                    baseActive = true;
                    return;
                }
            }
        }
    }

    // ---- Firing ------------------------------------------------------------

    function tryFireBullet(): void {
        if (!ship.alive) return;
        for (let i = 0; i < bullets.length; i++) {
            if (!bullets[i].active) {
                bullets[i].fire(ship.worldCol + 0.5, ship.worldRow, BULLET_SPEED);
                break;
            }
        }
    }

    function tryDropBomb(): void {
        if (!ship.alive) return;
        for (let i = 0; i < bombs.length; i++) {
            if (!bombs[i].active) {
                bombs[i].fire(
                    ship.worldCol,
                    ship.worldRow + 0.5,
                    currentScrollSpeed + BOMB_FORWARD_SPEED,
                );
                break;
            }
        }
    }

    // ---- Boundary management -----------------------------------------------

    function deactivateOffscreenBullets(): void {
        const rightEdge = scrollCol + VISIBLE_COLS + 1;
        for (let i = 0; i < bullets.length; i++) {
            if (bullets[i].active && bullets[i].worldCol > rightEdge) {
                bullets[i].deactivate();
            }
        }
    }

    function deactivateOffscreenBombs(): void {
        for (let i = 0; i < bombs.length; i++) {
            if (bombs[i].active && bombs[i].worldRow > VISIBLE_ROWS) {
                bombs[i].deactivate();
            }
        }
    }

    function deactivateOffscreenEnemies(): void {
        const leftEdge = scrollCol - 2;
        for (let i = 0; i < rockets.length; i++) {
            if (rockets[i].active && rockets[i].worldCol < leftEdge) {
                rockets[i].deactivate();
            }
        }
        for (let i = 0; i < ufos.length; i++) {
            if (ufos[i].active && ufos[i].worldCol < leftEdge) {
                ufos[i].deactivate();
            }
        }
        for (let i = 0; i < fuelTanks.length; i++) {
            if (fuelTanks[i].active && fuelTanks[i].worldCol < leftEdge) {
                fuelTanks[i].deactivate();
            }
        }
    }

    // ---- Collision detection -----------------------------------------------

    function checkShipTerrainCollision(): void {
        if (!ship.alive) return;

        const col = ship.worldCol;
        const row = ship.worldRow;
        const half = SHIP_HALF_SIZE;

        const minCol = Math.floor(col - half);
        const maxCol = Math.floor(col + half);
        const minRow = Math.floor(row - half);
        const maxRow = Math.floor(row + half);

        for (let c = minCol; c <= maxCol; c++) {
            for (let r = minRow; r <= maxRow; r++) {
                if (terrain.isSolid(c, r)) {
                    shipDied();
                    return;
                }
            }
        }
    }

    function checkShipVsRockets(): void {
        if (!ship.alive) return;
        const shipCol = ship.worldCol;
        const shipRow = ship.worldRow;
        const hitDist = SHIP_HALF_SIZE + ENEMY_HALF_SIZE;

        for (let i = 0; i < rockets.length; i++) {
            const r = rockets[i];
            if (!r.active || !r.alive) continue;
            const dc = shipCol - r.worldCol;
            const dr = shipRow - r.worldRow;
            if (dc * dc + dr * dr < hitDist * hitDist) {
                spawnExplosion(r.worldCol, r.worldRow);
                r.kill();
                shipDied();
                return;
            }
        }
    }

    function checkShipVsUfos(): void {
        if (!ship.alive) return;
        const shipCol = ship.worldCol;
        const shipRow = ship.worldRow;
        const hitDist = SHIP_HALF_SIZE + ENEMY_HALF_SIZE;

        for (let i = 0; i < ufos.length; i++) {
            const u = ufos[i];
            if (!u.active || !u.alive) continue;
            const dc = shipCol - u.worldCol;
            const dr = shipRow - u.worldRow;
            if (dc * dc + dr * dr < hitDist * hitDist) {
                spawnExplosion(u.worldCol, u.worldRow);
                u.kill();
                shipDied();
                return;
            }
        }
    }

    function checkBulletsTerrainCollision(): void {
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            if (!b.active) continue;
            const col = Math.floor(b.worldCol);
            const row = Math.floor(b.worldRow);
            if (terrain.isSolid(col, row)) {
                b.deactivate();
            }
        }
    }

    function checkBombsTerrainCollision(): void {
        for (let i = 0; i < bombs.length; i++) {
            const b = bombs[i];
            if (!b.active) continue;
            const col = Math.floor(b.worldCol);
            const row = Math.floor(b.worldRow);
            if (terrain.isSolid(col, row)) {
                b.deactivate();
            }
        }
    }

    function checkBulletsVsEnemies(): void {
        for (let b = 0; b < bullets.length; b++) {
            const bullet = bullets[b];
            if (!bullet.active) continue;

            const bCol = bullet.worldCol;
            const bRow = bullet.worldRow;
            const hitDist = ENEMY_HALF_SIZE;

            // vs rockets
            for (let i = 0; i < rockets.length; i++) {
                const r = rockets[i];
                if (!r.active || !r.alive) continue;
                const dc = bCol - r.worldCol;
                const dr = bRow - r.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    spawnExplosion(r.worldCol, r.worldRow);
                    r.kill();
                    bullet.deactivate();
                    scoreModel.addPoints(SCORE_ROCKET);
                    break;
                }
            }
            if (!bullet.active) continue;

            // vs UFOs
            for (let i = 0; i < ufos.length; i++) {
                const u = ufos[i];
                if (!u.active || !u.alive) continue;
                const dc = bCol - u.worldCol;
                const dr = bRow - u.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    spawnExplosion(u.worldCol, u.worldRow);
                    u.kill();
                    bullet.deactivate();
                    scoreModel.addPoints(SCORE_UFO);
                    break;
                }
            }
            if (!bullet.active) continue;

            // vs fuel tanks
            for (let i = 0; i < fuelTanks.length; i++) {
                const f = fuelTanks[i];
                if (!f.active || !f.alive) continue;
                const dc = bCol - f.worldCol;
                const dr = bRow - f.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    handleFuelTankKill(f);
                    bullet.deactivate();
                    break;
                }
            }
        }
    }

    function checkBombsVsEnemies(): void {
        for (let b = 0; b < bombs.length; b++) {
            const bomb = bombs[b];
            if (!bomb.active) continue;

            const bCol = bomb.worldCol;
            const bRow = bomb.worldRow;
            const hitDist = ENEMY_HALF_SIZE;

            // vs rockets
            for (let i = 0; i < rockets.length; i++) {
                const r = rockets[i];
                if (!r.active || !r.alive) continue;
                const dc = bCol - r.worldCol;
                const dr = bRow - r.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    spawnExplosion(r.worldCol, r.worldRow);
                    r.kill();
                    bomb.deactivate();
                    scoreModel.addPoints(SCORE_ROCKET);
                    break;
                }
            }
            if (!bomb.active) continue;

            // vs UFOs
            for (let i = 0; i < ufos.length; i++) {
                const u = ufos[i];
                if (!u.active || !u.alive) continue;
                const dc = bCol - u.worldCol;
                const dr = bRow - u.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    spawnExplosion(u.worldCol, u.worldRow);
                    u.kill();
                    bomb.deactivate();
                    scoreModel.addPoints(SCORE_UFO);
                    break;
                }
            }
            if (!bomb.active) continue;

            // vs fuel tanks (including base)
            for (let i = 0; i < fuelTanks.length; i++) {
                const f = fuelTanks[i];
                if (!f.active || !f.alive) continue;
                const dc = bCol - f.worldCol;
                const dr = bRow - f.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    handleFuelTankKill(f);
                    bomb.deactivate();
                    break;
                }
            }
        }
    }

    function handleFuelTankKill(tank: FuelTankModel): void {
        spawnExplosion(tank.worldCol, tank.worldRow);
        // Check if this is the base target
        if (baseActive && baseAlive && tank.worldCol === getBaseWorldCol()) {
            tank.kill();
            baseAlive = false;
            baseActive = false;
            baseFuelTankIndex = -1;
            scoreModel.addPoints(SCORE_BASE);
        }
        else {
            tank.kill();
            scoreModel.addPoints(SCORE_FUEL_TANK);
            scoreModel.addFuel(FUEL_REFILL_AMOUNT);
        }
    }

    function getBaseWorldCol(): number {
        // Find the base spawn entry's absolute world column
        for (let i = spawnList.length - 1; i >= 0; i--) {
            if (spawnList[i].kind === 'base') return spawnList[i].worldCol;
        }
        return -1;
    }

    // ---- Section progression -----------------------------------------------

    function checkSectionProgression(): void {
        // Check if scroll has passed the end of the terrain
        if (scrollCol >= terrain.totalCols - VISIBLE_COLS) {
            // Section 3 end - require base destroyed to complete loop
            if (baseActive && baseAlive) {
                // Base not destroyed yet - clamp scroll
                scrollCol = terrain.totalCols - VISIBLE_COLS;
                scrollClamped = true;
                return;
            }
            scrollClamped = false;
            scheduleSectionClear();
        }
    }

    function scheduleSectionClear(): void {
        gamePhase = 'section-clear';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                // Completed all 3 sections - start new loop
                scoreModel.advanceLoop();
                currentScrollSpeed = SCROLL_SPEED + scoreModel.loop * SPEED_INCREASE_PER_LOOP;
                scrollCol = 0;
                spawnCursor = 0;
                baseAlive = false;
                baseActive = false;
                baseFuelTankIndex = -1;
                deactivateAllEntities();
                ship.respawn(
                    SHIP_START_COL,
                    SHIP_START_ROW,
                );
                scoreModel.setSectionIndex(0);
                gamePhase = 'playing';
            },
            undefined,
            SECTION_CLEAR_DELAY_MS * 0.001,
        );
    }

    // ---- Phase management --------------------------------------------------

    function shipDied(): void {
        spawnExplosion(ship.worldCol, ship.worldRow);
        ship.kill();
        gamePhase = 'dying';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                if (scoreModel.loseLife()) {
                    // Respawn with brief delay
                    gamePhase = 'respawning';
                    phaseTimeline.clear().time(0);
                    phaseTimeline.call(
                        () => {
                            // Respawn at a safe position relative to current scroll
                            const safeCol = scrollCol + SHIP_START_COL;
                            const safeRow = findSafeRow(safeCol);
                            ship.respawn(safeCol, safeRow);
                            deactivateAllProjectiles();
                            scoreModel.addFuel(0.25);
                            gamePhase = 'playing';
                        },
                        undefined,
                        RESPAWN_DELAY_MS * 0.001,
                    );
                }
                else {
                    gamePhase = 'game-over';
                }
            },
            undefined,
            DYING_DELAY_MS * 0.001,
        );
    }

    function deactivateAllProjectiles(): void {
        for (let i = 0; i < bullets.length; i++) bullets[i].deactivate();
        for (let i = 0; i < bombs.length; i++) bombs[i].deactivate();
    }

    function deactivateAllEntities(): void {
        deactivateAllProjectiles();
        for (let i = 0; i < rockets.length; i++) rockets[i].deactivate();
        for (let i = 0; i < ufos.length; i++) ufos[i].deactivate();
        for (let i = 0; i < fuelTanks.length; i++) fuelTanks[i].deactivate();
    }

    function findSafeRow(worldCol: number): number {
        const col = Math.floor(worldCol);
        // Prefer the default start row if it's clear
        if (!terrain.isSolid(col, Math.floor(SHIP_START_ROW))) {
            return SHIP_START_ROW;
        }
        // Otherwise scan for the first empty row from the middle outward
        const midRow = Math.floor(VISIBLE_ROWS / 2);
        for (let offset = 0; offset < VISIBLE_ROWS; offset++) {
            const above = midRow - offset;
            if (above >= 0 && !terrain.isSolid(col, above)) return above + 0.5;
            const below = midRow + offset;
            if (below < VISIBLE_ROWS && !terrain.isSolid(col, below)) return below + 0.5;
        }
        return SHIP_START_ROW;
    }
}
