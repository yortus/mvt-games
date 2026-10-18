import gsap from 'gsap';
import { createSlotList, type Slot, type SlotList } from '@mvtjs/utils';
import { VISIBLE_COLS, VISIBLE_ROWS } from '../data';
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
    MAX_ROCKETS,
    ROCKET_DETECT_RANGE,
    ROCKET_LAUNCH_SPEED,
    ROCKET_EXIT_ROW,
    MAX_UFOS,
    UFO_SPEED,
    UFO_OSCILLATION_AMP,
    UFO_OSCILLATION_FREQ,
    MAX_FUEL_TANKS,
    FUEL_DEPLETION_RATE,
    FUEL_REFILL_AMOUNT,
    RESPAWN_FUEL_AMOUNT,
    SCORE_ROCKET,
    SCORE_UFO,
    SCORE_FUEL_TANK,
    SCORE_BASE,
    INITIAL_LIVES,
    SPAWN_AHEAD,
    SPEED_INCREASE_PER_LOOP,
    MAX_EXPLOSIONS,
    EXPLOSION_DURATION_MS,
} from './model-constants';
import type { SectionProfile, SpawnKind } from '../data';
import type { GamePhase, XDirection, YDirection } from './common';
import { createShipModel, type ShipModel } from './ship-model';
import { createBulletModel, type BulletModel } from './bullet-model';
import { createBombModel, type BombModel } from './bomb-model';
import { createTerrainModel, type TerrainModel } from './terrain-model';
import { createRocketModel, type RocketModel } from './rocket-model';
import { createUfoModel, type UfoModel } from './ufo-model';
import { createFuelTankModel, type FuelTankModel } from './fuel-tank-model';
import { createFuelModel, type FuelModel } from './fuel-model';
import { createExplosionModel, type ExplosionModel } from './explosion-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly ship: ShipModel;
    readonly bullets: SlotList<BulletModel>;
    readonly bombs: SlotList<BombModel>;
    readonly rockets: SlotList<RocketModel>;
    readonly ufos: SlotList<UfoModel>;
    readonly fuelTanks: SlotList<FuelTankModel>;
    readonly explosions: SlotList<ExplosionModel>;
    readonly terrain: TerrainModel;
    readonly score: number;
    readonly lives: number;
    readonly fuel: FuelModel;
    readonly sectionIndex: number;
    readonly loop: number;
    readonly scrollCol: number;
    readonly scrollSpeed: number;
    /**
     * The way the player is pushing the ship along the screen, on top of the
     * scroll. 'left' holds it back against the scroll, and 'right' speeds it
     * ahead. It stays within its part of the screen.
     */
    thrustX: XDirection;
    /** The way the player is pushing the ship up or down the screen: 'up' climbs and 'down' dives, within the screen. */
    thrustY: YDirection;
    readonly isBaseAlive: boolean;
    readonly baseWorldCol: number;
    readonly baseWorldRow: number;
    readonly isScrollClamped: boolean;
    /**
     * The number of shots fired this game. It is a count rather than a flag,
     * because a shot's slot may be gone, or taken again, before a view looks.
     * Each rise is a shot, and it goes back to 0 for a new game. The counts
     * below work the same way.
     */
    readonly shotsFired: number;
    /** The number of bombs dropped this game. */
    readonly bombsDropped: number;
    /**
     * The number of rockets that have left the ground this game. A rocket can
     * launch in the tick it appears, so a view of its slot cannot tell its
     * launch from its arrival. This count can.
     */
    readonly rocketsLaunched: number;
    /**
     * The number of rockets, UFOs and fuel tanks destroyed by the ship's shots
     * and bombs this game. The base is not counted here, and neither is an
     * enemy the ship crashes into. Those have counts or phases of their own.
     */
    readonly enemiesDestroyed: number;
    /** The number of fuel tanks destroyed this game. Each one gives the ship fuel. */
    readonly fuelTanksDestroyed: number;
    /** The number of times the base has been destroyed this game. There is one base on each loop of the sections. */
    readonly basesDestroyed: number;
    /** Fires a shot ahead. It leaves at the next update, if the game is playing and a bullet is free. */
    fire: () => void;
    /** Drops a bomb. It drops at the next update, if the game is playing and a bomb is free. */
    dropBomb: () => void;
    /** Asks for a new game. It starts at the next update, if the last game is over. */
    startNewRun: () => void;
    reset: () => void;
    /**
     * Returns the game as a value JSON can hold, for `load` to restore. A
     * game is saved as of the start of its section, with the score it had
     * then, the lives it has now, and no more fuel than it has now, so that
     * leaving and resuming a game never helps it. A loop just cleared is
     * saved as the start of the next. Returns undefined once the last life
     * is lost, and while the game has passed no section and won no points,
     * since resuming there would only start the game again.
     */
    save: () => SavedGame | undefined;
    /**
     * Restores a game that `save` returned, in place of this one, at the
     * start of its section. Returns whether it could: a value that is not a
     * saved game of these sections, such as one from an older version,
     * leaves the game as it was.
     */
    load: (saved: unknown) => boolean;
    update: (deltaMs: number) => void;
}

/** A game part way through, as `save` returns it: the loop and section to start, with its score, lives and fuel. */
export interface SavedGame {
    readonly version: typeof SAVED_GAME_VERSION;
    /** The loop of the sections, from 0. Each loop scrolls faster than the last. */
    readonly loop: number;
    /** The section to start, from 0. */
    readonly section: number;
    readonly score: number;
    readonly lives: number;
    /** The fuel level, more than 0.0 and at most 1.0. */
    readonly fuel: number;
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
    /** Whether a shot was asked for since the last update. */
    let isFireRequested = false;
    /** Whether a bomb was asked for since the last update. */
    let isBombRequested = false;
    /** Whether a new game was asked for since the last update. */
    let isNewRunRequested = false;
    let baseSlot: Slot<FuelTankModel> | undefined;
    let scrollClamped = false;
    let score = 0;
    let shotsFired = 0;
    let bombsDropped = 0;
    let rocketsLaunched = 0;
    let enemiesDestroyed = 0;
    let fuelTanksDestroyed = 0;
    let basesDestroyed = 0;
    let lives = INITIAL_LIVES;
    let sectionIndex = 0;
    let loop = 0;
    /** The score as this section started, which a save keeps. The section's own points are won again on resuming. */
    let sectionStartScore = 0;
    /** The fuel as this section started. A save keeps this, or the fuel now if that is less. */
    let sectionStartFuel = 1.0;

    const phaseTimeline = gsap.timeline({ paused: true });

    // ---- Spawn list (sorted by absolute world column) ----------------------

    const spawnList = buildSpawnList(sections);
    let spawnCursor = 0;

    // ---- Initialise --------------------------------------------------------

    const terrain = createTerrainModel({ sections, rows: VISIBLE_ROWS });
    const fuelModel = createFuelModel({
        fuelDepletionRate: FUEL_DEPLETION_RATE,
    });
    let ship = buildShip();
    const bullets = createSlotList<BulletModel>({ maxSlots: MAX_BULLETS });
    const bombs = createSlotList<BombModel>({ maxSlots: MAX_BOMBS });
    const rockets = createSlotList<RocketModel>({ maxSlots: MAX_ROCKETS });
    const ufos = createSlotList<UfoModel>({ maxSlots: MAX_UFOS });
    const fuelTanks = createSlotList<FuelTankModel>({ maxSlots: MAX_FUEL_TANKS });
    const explosions = createSlotList<ExplosionModel>({ maxSlots: MAX_EXPLOSIONS, releaseDelayMs: EXPLOSION_DURATION_MS });

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
            return score;
        },
        get lives() {
            return lives;
        },
        get fuel() {
            return fuelModel;
        },
        get sectionIndex() {
            return sectionIndex;
        },
        get loop() {
            return loop;
        },
        get scrollCol() {
            return scrollCol;
        },
        get scrollSpeed() {
            return currentScrollSpeed;
        },
        thrustX: 'none',
        thrustY: 'none',
        get isBaseAlive() {
            return isBaseLive();
        },
        get baseWorldCol() {
            return baseSlot !== undefined && baseSlot.isLive ? baseSlot.value.worldCol : -1;
        },
        get baseWorldRow() {
            return baseSlot !== undefined && baseSlot.isLive ? baseSlot.value.worldRow : -1;
        },
        get isScrollClamped() {
            return scrollClamped;
        },
        get shotsFired() {
            return shotsFired;
        },
        get bombsDropped() {
            return bombsDropped;
        },
        get rocketsLaunched() {
            return rocketsLaunched;
        },
        get enemiesDestroyed() {
            return enemiesDestroyed;
        },
        get fuelTanksDestroyed() {
            return fuelTanksDestroyed;
        },
        get basesDestroyed() {
            return basesDestroyed;
        },

        fire(): void {
            isFireRequested = true;
        },

        dropBomb(): void {
            isBombRequested = true;
        },

        startNewRun(): void {
            isNewRunRequested = true;
        },

        reset(): void {
            scrollCol = 0;
            currentScrollSpeed = SCROLL_SPEED;
            spawnCursor = 0;
            baseSlot = undefined;
            scrollClamped = false;
            score = 0;
            shotsFired = 0;
            bombsDropped = 0;
            rocketsLaunched = 0;
            enemiesDestroyed = 0;
            fuelTanksDestroyed = 0;
            basesDestroyed = 0;
            lives = INITIAL_LIVES;
            sectionIndex = 0;
            loop = 0;
            fuelModel.reset();
            ship = buildShip();
            bullets.clear();
            bombs.clear();
            rockets.clear();
            ufos.clear();
            fuelTanks.clear();
            explosions.clear();
            gamePhase = 'playing';
            phaseTimeline.clear().time(0);
            markSectionStart();
        },

        save() {
            if (gamePhase === 'game-over') return undefined;
            // A life lost while the ship breaks up is taken once the pieces settle
            const livesLeft = gamePhase === 'dying' ? lives - 1 : lives;
            if (livesLeft <= 0) return undefined;
            if (gamePhase === 'section-clear') {
                return { version: SAVED_GAME_VERSION, loop: loop + 1, section: 0, score, lives: livesLeft, fuel: fuelModel.fuel };
            }
            // A checkpoint at the start of the game is no better than a restart
            if (loop === 0 && sectionIndex === 0 && sectionStartScore === 0) return undefined;
            return {
                version: SAVED_GAME_VERSION,
                loop,
                section: sectionIndex,
                score: sectionStartScore,
                lives: livesLeft,
                fuel: Math.min(sectionStartFuel, measureShipFuel()),
            };
        },

        load(value) {
            if (!isSavedGame(value, sections.length)) return false;
            loop = value.loop;
            sectionIndex = value.section;
            score = value.score;
            lives = value.lives;
            fuelModel.setFuel(value.fuel);
            explosions.clear();
            phaseTimeline.clear().time(0);
            startSection();
            return true;
        },

        update(deltaMs: number): void {
            // Take what the player asked for since the last update. What the game can't do now is dropped
            const wasFireAsked = isFireRequested;
            const wasBombAsked = isBombRequested;
            const wasNewRunAsked = isNewRunRequested;
            isFireRequested = false;
            isBombRequested = false;
            isNewRunRequested = false;

            // A new game starts only once the last is over
            if (wasNewRunAsked) {
                if (gamePhase === 'game-over') {
                    // The new game starts on the next tick. So nothing happens in the
                    // tick its counts go back to 0, and each count's next change is a rise.
                    model.reset();
                    return;
                }
            }

            // Advance phase timeline (dying / section-clear delays)
            phaseTimeline.time(phaseTimeline.time() + 0.001 * deltaMs);

            if (gamePhase !== 'playing') return;

            // Advance scroll
            scrollCol += currentScrollSpeed * deltaMs * 0.001;

            // Update section index
            const scrolledSectionIndex = terrain.getSectionIndex(Math.floor(scrollCol));
            if (scrolledSectionIndex !== sectionIndex) {
                sectionIndex = scrolledSectionIndex;
                markSectionStart();
            }

            // Apply the player's intent
            ship.setXDirection(model.thrustX);
            ship.setYDirection(model.thrustY);
            if (wasFireAsked) tryFireBullet();
            if (wasBombAsked) tryDropBomb();

            // Spawn entities from cursor
            advanceSpawnCursor();

            // Update entities
            ship.update(deltaMs, scrollCol);
            updateEach(bullets, deltaMs);
            updateEach(bombs, deltaMs);
            updateRockets(deltaMs);
            updateEach(ufos, deltaMs);
            updateEach(explosions, deltaMs);
            explosions.update(deltaMs);
            fuelModel.update(deltaMs);

            // Remove off-screen entities
            removeOffscreenBullets();
            removeOffscreenBombs();
            removeOffscreenEnemies();

            // Collision detection
            if (gamePhase === 'playing') checkShipTerrainCollision();
            if (gamePhase === 'playing') checkShipVsRockets();
            if (gamePhase === 'playing') checkShipVsUfos();
            checkBulletsTerrainCollision();
            checkBombsTerrainCollision();
            checkBulletsVsEnemies();
            checkBombsVsEnemies();

            // Fuel death
            if (gamePhase === 'playing' && fuelModel.isFuelEmpty) {
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

    // Visits pending-release slots too, so born-removed explosions keep animating.
    function updateEach<T extends { update: (deltaMs: number) => void }>(list: SlotList<T>, deltaMs: number): void {
        for (let i = 0; i < list.slots.length; i++) {
            const slot = list.slots.at(i);
            if (slot !== undefined) slot.value.update(deltaMs);
        }
    }

    function updateRockets(deltaMs: number): void {
        for (let i = 0; i < rockets.slots.length; i++) {
            const slot = rockets.slots.at(i);
            if (slot === undefined) continue;
            const wasIdle = slot.value.phase === 'idle';
            slot.value.update(deltaMs, ship.worldCol);
            if (wasIdle && slot.value.phase !== 'idle') rocketsLaunched++;
        }
    }

    // ---- Explosions --------------------------------------------------------

    function spawnExplosion(worldCol: number, worldRow: number): void {
        if (explosions.isFull) return;
        const explosion = createExplosionModel({ worldCol, worldRow, durationMs: EXPLOSION_DURATION_MS });
        // Born removed: the slot lingers for its release delay so the fade renders,
        // then frees itself. update() advances the explosion while it lingers.
        explosions.remove(explosions.insert(explosion));
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
        // Ground entities sit on the terrain surface; +0.5 offsets centre
        // sprites within their tile on both axes.
        const centredCol = worldCol + 0.5;
        const groundRow = terrain.getSurfaceRow(Math.floor(worldCol)) + 0.5;

        if (kind === 'rocket') {
            if (rockets.isFull) return;
            rockets.insert(createRocketModel({
                worldCol: centredCol,
                worldRow: groundRow,
                detectRange: ROCKET_DETECT_RANGE,
                launchSpeed: ROCKET_LAUNCH_SPEED,
            }));
        }
        else if (kind === 'ufo') {
            if (ufos.isFull) return;
            ufos.insert(createUfoModel({
                worldCol: centredCol,
                worldRow: row,
                speed: UFO_SPEED,
                oscillationAmp: UFO_OSCILLATION_AMP,
                oscillationFreq: UFO_OSCILLATION_FREQ,
            }));
        }
        else if (kind === 'fuel-tank') {
            if (fuelTanks.isFull) return;
            fuelTanks.insert(createFuelTankModel({ worldCol: centredCol, worldRow: groundRow }));
        }
        else if (kind === 'base') {
            // The base occupies a fuel-tank slot; hold the slot reference so its
            // identity survives other tanks coming and going, and its isLive flag
            // says whether the base still stands.
            if (fuelTanks.isFull) return;
            baseSlot = fuelTanks.insert(createFuelTankModel({ worldCol: centredCol, worldRow: groundRow }));
        }
    }

    // ---- Firing ------------------------------------------------------------

    function tryFireBullet(): void {
        if (!ship.isAlive || bullets.isFull) return;
        bullets.insert(createBulletModel({
            worldCol: ship.worldCol + 0.5,
            worldRow: ship.worldRow,
            speed: BULLET_SPEED,
        }));
        shotsFired++;
    }

    function tryDropBomb(): void {
        if (!ship.isAlive || bombs.isFull) return;
        bombs.insert(createBombModel({
            worldCol: ship.worldCol,
            worldRow: ship.worldRow + 0.5,
            vCol: currentScrollSpeed + BOMB_FORWARD_SPEED,
            gravity: BOMB_GRAVITY,
        }));
        bombsDropped++;
    }

    // ---- Boundary management -----------------------------------------------

    function removeOffscreenBullets(): void {
        const rightEdge = scrollCol + VISIBLE_COLS + 1;
        for (let i = 0; i < bullets.slots.length; i++) {
            const slot = bullets.slots.at(i);
            if (slot !== undefined && slot.value.worldCol > rightEdge) {
                bullets.remove(slot);
            }
        }
    }

    function removeOffscreenBombs(): void {
        for (let i = 0; i < bombs.slots.length; i++) {
            const slot = bombs.slots.at(i);
            if (slot !== undefined && slot.value.worldRow > VISIBLE_ROWS) {
                bombs.remove(slot);
            }
        }
    }

    function removeOffscreenEnemies(): void {
        const leftEdge = scrollCol - 2;
        for (let i = 0; i < rockets.slots.length; i++) {
            const slot = rockets.slots.at(i);
            if (slot !== undefined && (slot.value.worldCol < leftEdge || slot.value.worldRow < ROCKET_EXIT_ROW)) {
                rockets.remove(slot);
            }
        }
        for (let i = 0; i < ufos.slots.length; i++) {
            const slot = ufos.slots.at(i);
            if (slot !== undefined && slot.value.worldCol < leftEdge) {
                ufos.remove(slot);
            }
        }
        for (let i = 0; i < fuelTanks.slots.length; i++) {
            const slot = fuelTanks.slots.at(i);
            if (slot !== undefined && slot.value.worldCol < leftEdge) {
                fuelTanks.remove(slot);
            }
        }
    }

    // ---- Collision detection -----------------------------------------------

    function checkShipTerrainCollision(): void {
        if (!ship.isAlive) return;

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
        if (!ship.isAlive) return;
        const shipCol = ship.worldCol;
        const shipRow = ship.worldRow;
        const hitDist = SHIP_HALF_SIZE + ENEMY_HALF_SIZE;

        for (let i = 0; i < rockets.slots.length; i++) {
            const slot = rockets.slots.at(i);
            if (slot === undefined) continue;
            const r = slot.value;
            const dc = shipCol - r.worldCol;
            const dr = shipRow - r.worldRow;
            if (dc * dc + dr * dr < hitDist * hitDist) {
                spawnExplosion(r.worldCol, r.worldRow);
                rockets.remove(slot);
                shipDied();
                return;
            }
        }
    }

    function checkShipVsUfos(): void {
        if (!ship.isAlive) return;
        const shipCol = ship.worldCol;
        const shipRow = ship.worldRow;
        const hitDist = SHIP_HALF_SIZE + ENEMY_HALF_SIZE;

        for (let i = 0; i < ufos.slots.length; i++) {
            const slot = ufos.slots.at(i);
            if (slot === undefined) continue;
            const u = slot.value;
            const dc = shipCol - u.worldCol;
            const dr = shipRow - u.worldRow;
            if (dc * dc + dr * dr < hitDist * hitDist) {
                spawnExplosion(u.worldCol, u.worldRow);
                ufos.remove(slot);
                shipDied();
                return;
            }
        }
    }

    function checkBulletsTerrainCollision(): void {
        for (let i = 0; i < bullets.slots.length; i++) {
            const slot = bullets.slots.at(i);
            if (slot === undefined) continue;
            const b = slot.value;
            const col = Math.floor(b.worldCol);
            const row = Math.floor(b.worldRow);
            if (terrain.isSolid(col, row)) {
                bullets.remove(slot);
            }
        }
    }

    function checkBombsTerrainCollision(): void {
        for (let i = 0; i < bombs.slots.length; i++) {
            const slot = bombs.slots.at(i);
            if (slot === undefined) continue;
            const b = slot.value;
            const col = Math.floor(b.worldCol);
            const row = Math.floor(b.worldRow);
            if (terrain.isSolid(col, row)) {
                bombs.remove(slot);
            }
        }
    }

    function checkBulletsVsEnemies(): void {
        for (let b = 0; b < bullets.slots.length; b++) {
            const bulletSlot = bullets.slots.at(b);
            if (bulletSlot === undefined) continue;

            const bCol = bulletSlot.value.worldCol;
            const bRow = bulletSlot.value.worldRow;
            const hitDist = ENEMY_HALF_SIZE;
            let consumed = false;

            // vs rockets
            for (let i = 0; i < rockets.slots.length; i++) {
                const slot = rockets.slots.at(i);
                if (slot === undefined) continue;
                const r = slot.value;
                const dc = bCol - r.worldCol;
                const dr = bRow - r.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    spawnExplosion(r.worldCol, r.worldRow);
                    rockets.remove(slot);
                    bullets.remove(bulletSlot);
                    score += SCORE_ROCKET;
                    enemiesDestroyed++;
                    consumed = true;
                    break;
                }
            }
            if (consumed) continue;

            // vs UFOs
            for (let i = 0; i < ufos.slots.length; i++) {
                const slot = ufos.slots.at(i);
                if (slot === undefined) continue;
                const u = slot.value;
                const dc = bCol - u.worldCol;
                const dr = bRow - u.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    spawnExplosion(u.worldCol, u.worldRow);
                    ufos.remove(slot);
                    bullets.remove(bulletSlot);
                    score += SCORE_UFO;
                    enemiesDestroyed++;
                    consumed = true;
                    break;
                }
            }
            if (consumed) continue;

            // vs fuel tanks
            for (let i = 0; i < fuelTanks.slots.length; i++) {
                const slot = fuelTanks.slots.at(i);
                if (slot === undefined) continue;
                const f = slot.value;
                const dc = bCol - f.worldCol;
                const dr = bRow - f.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    handleFuelTankKill(slot);
                    bullets.remove(bulletSlot);
                    break;
                }
            }
        }
    }

    function checkBombsVsEnemies(): void {
        for (let b = 0; b < bombs.slots.length; b++) {
            const bombSlot = bombs.slots.at(b);
            if (bombSlot === undefined) continue;

            const bCol = bombSlot.value.worldCol;
            const bRow = bombSlot.value.worldRow;
            const hitDist = ENEMY_HALF_SIZE;
            let consumed = false;

            // vs rockets
            for (let i = 0; i < rockets.slots.length; i++) {
                const slot = rockets.slots.at(i);
                if (slot === undefined) continue;
                const r = slot.value;
                const dc = bCol - r.worldCol;
                const dr = bRow - r.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    spawnExplosion(r.worldCol, r.worldRow);
                    rockets.remove(slot);
                    bombs.remove(bombSlot);
                    score += SCORE_ROCKET;
                    enemiesDestroyed++;
                    consumed = true;
                    break;
                }
            }
            if (consumed) continue;

            // vs UFOs
            for (let i = 0; i < ufos.slots.length; i++) {
                const slot = ufos.slots.at(i);
                if (slot === undefined) continue;
                const u = slot.value;
                const dc = bCol - u.worldCol;
                const dr = bRow - u.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    spawnExplosion(u.worldCol, u.worldRow);
                    ufos.remove(slot);
                    bombs.remove(bombSlot);
                    score += SCORE_UFO;
                    enemiesDestroyed++;
                    consumed = true;
                    break;
                }
            }
            if (consumed) continue;

            // vs fuel tanks (including base)
            for (let i = 0; i < fuelTanks.slots.length; i++) {
                const slot = fuelTanks.slots.at(i);
                if (slot === undefined) continue;
                const f = slot.value;
                const dc = bCol - f.worldCol;
                const dr = bRow - f.worldRow;
                if (dc * dc + dr * dr < hitDist * hitDist) {
                    handleFuelTankKill(slot);
                    bombs.remove(bombSlot);
                    break;
                }
            }
        }
    }

    function handleFuelTankKill(slot: Slot<FuelTankModel>): void {
        spawnExplosion(slot.value.worldCol, slot.value.worldRow);
        fuelTanks.remove(slot);
        if (slot === baseSlot) {
            score += SCORE_BASE;
            basesDestroyed++;
        }
        else {
            score += SCORE_FUEL_TANK;
            fuelModel.addFuel(FUEL_REFILL_AMOUNT);
            enemiesDestroyed++;
            fuelTanksDestroyed++;
        }
    }

    // ---- Section progression -----------------------------------------------

    function checkSectionProgression(): void {
        // Check if scroll has passed the end of the terrain
        if (scrollCol >= terrain.totalCols - VISIBLE_COLS) {
            // Section 3 end - require base destroyed to complete loop
            if (isBaseLive()) {
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
                loop++;
                sectionIndex = 0;
                startSection();
            },
            undefined,
            SECTION_CLEAR_DELAY_MS * 0.001,
        );
    }

    /** Starts the section `sectionIndex` of the loop `loop` at its first column, as a new loop starts. */
    function startSection(): void {
        currentScrollSpeed = SCROLL_SPEED + loop * SPEED_INCREASE_PER_LOOP;
        scrollCol = terrain.getSectionStartCol(sectionIndex);
        scrollClamped = false;
        // The enemies before the section are in its starting score already, so they are not met again
        spawnCursor = 0;
        while (spawnCursor < spawnList.length && spawnList[spawnCursor].worldCol < scrollCol) spawnCursor++;
        clearEntities();
        const shipCol = scrollCol + SHIP_START_COL;
        ship.respawn(shipCol, findSafeRow(shipCol));
        gamePhase = 'playing';
        markSectionStart();
    }

    function markSectionStart(): void {
        sectionStartScore = score;
        sectionStartFuel = measureShipFuel();
    }

    /** Returns the ship's fuel. A ship that is dying or respawning has the fuel that respawning gives it, which is always some. */
    function measureShipFuel(): number {
        const isShipDown = gamePhase === 'dying' || gamePhase === 'respawning';
        return isShipDown ? Math.min(fuelModel.fuel + RESPAWN_FUEL_AMOUNT, 1.0) : fuelModel.fuel;
    }

    // ---- Phase management --------------------------------------------------

    function shipDied(): void {
        spawnExplosion(ship.worldCol, ship.worldRow);
        ship.kill();
        gamePhase = 'dying';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                lives--;
                if (lives > 0) {
                    // Respawn with brief delay
                    gamePhase = 'respawning';
                    phaseTimeline.clear().time(0);
                    phaseTimeline.call(
                        () => {
                            // Respawn at a safe position relative to current scroll
                            const safeCol = scrollCol + SHIP_START_COL;
                            const safeRow = findSafeRow(safeCol);
                            ship.respawn(safeCol, safeRow);
                            clearProjectiles();
                            fuelModel.addFuel(RESPAWN_FUEL_AMOUNT);
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

    function clearProjectiles(): void {
        bullets.clear();
        bombs.clear();
    }

    function clearEntities(): void {
        clearProjectiles();
        rockets.clear();
        ufos.clear();
        fuelTanks.clear();
        baseSlot = undefined;
    }

    function isBaseLive(): boolean {
        return baseSlot !== undefined && baseSlot.isLive;
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Marks the shape of a saved game. A change to the shape changes it, so older saves are not loaded. */
const SAVED_GAME_VERSION = 1;

/**
 * Whether `value` is a saved game of `sectionCount` sections: a loop from 0,
 * one of the sections, a score from 0, from 1 life to as many as a game
 * starts with, and some fuel, up to a full tank.
 */
function isSavedGame(value: unknown, sectionCount: number): value is SavedGame {
    // typeof null is 'object' too
    if (typeof value !== 'object' || value === null) return false;
    const { version, loop, section, score, lives, fuel } = value as Record<string, unknown>;
    return version === SAVED_GAME_VERSION
        && isWholeNumber(loop)
        && isWholeNumber(section) && section < sectionCount
        && isWholeNumber(score)
        && isWholeNumber(lives) && lives >= 1 && lives <= INITIAL_LIVES
        && typeof fuel === 'number' && fuel > 0 && fuel <= 1.0;
}

/** Whether `value` is a whole number, 0 or more. */
function isWholeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

interface AbsoluteSpawn {
    readonly worldCol: number;
    readonly row: number;
    readonly kind: SpawnKind;
}
