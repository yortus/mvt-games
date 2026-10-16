import { createSlotList, type Slot, type SlotList, watch } from '@mvtjs/utils';
import {
    ARENA_HEIGHT,
    ARENA_WIDTH,
    LOOP_COUNT,
    REVENGE_RING,
    type BossAttackDef,
    type BulletKind,
    type EnemyKind,
    type ItemKind,
    type SpawnEvent,
    type StageEvent,
} from '../data';
import { createBossModel, type BossModel, type BossPhase } from './boss-model';
import { createBulletField, type BulletField } from './bullet-field';
import type { ExplosionSize, GamePhase, ShotKind } from './common';
import { createEnemyModel, type EnemyModel } from './enemy-model';
import { createExplosionModel, type ExplosionModel } from './explosion-model';
import { createGemField, type GemField } from './gem-field';
import { createItemModel, type ItemModel } from './item-model';
import {
    ATTACK_BONUS,
    BOMB_DAMAGE_PER_SEC,
    BOMB_MS,
    BOMBS_PER_LIFE,
    BOSS_EXPLOSION_INTERVAL_MS,
    BOSS_POINTS,
    BULLET_HIT_RADII,
    BULLET_MARGIN,
    DYING_MS,
    ENEMY_POINTS,
    GEM_COLLECT_RADIUS,
    GEM_POINTS,
    INITIAL_LIVES,
    ITEM_COLLECT_RADIUS,
    LOOP_DENSITY_SCALES,
    LOOP_SPEED_SCALES,
    MAX_BOMBS,
    MAX_ENEMIES,
    MAX_ENEMY_BULLETS,
    MAX_EXPLOSIONS,
    MAX_GEMS,
    MAX_ITEMS,
    MAX_PLAYER_SHOTS,
    MAX_STEPS_PER_UPDATE,
    RESPAWN_INVULNERABLE_MS,
    SCROLL_SPEED,
    SHIP_GRAZE_RADIUS,
    SHOT_DAMAGE,
    SHOT_HIT_RADII,
    SPARE_ITEM_POINTS,
    STEP_MS,
    TALLY_BOMB_BONUS,
    TALLY_MS,
    WARNING_MS,
} from './model-constants';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createRandom } from './random';
import { createScoreModel, type ScoreModel } from './score-model';
import { createShipModel, type ShipModel } from './ship-model';
import { createStageModel, type StageModel } from './stage-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The whole game. It owns every other model and the rules between them:
 * what hits what, scoring, bombs, lives, the boss's attacks and the loops.
 *
 * **A fixed step.** `update(deltaMs)` collects time and advances the game in
 * whole steps of `STEP_MS` (1/60 s), so every child model always sees the
 * same `deltaMs`. Bullet patterns then come out the same at any frame rate,
 * and, with seeded random numbers, the same input replays the same game.
 */
export interface GameModel {
    readonly phase: GamePhase;
    /** 1 on the first loop, 2 on the second. */
    readonly loop: number;
    /** Ships left, counting the one flying. */
    readonly lives: number;
    readonly bombs: number;
    readonly isBombing: boolean;
    /** Milliseconds since the current bomb went off. Only meaningful while bombing. */
    readonly bombElapsedMs: number;
    /** Milliseconds the boss warning has been shown, or -1 while it is not. */
    readonly warningElapsedMs: number;
    /** The stage-clear bonus, shown during the tally. */
    readonly tallyBonus: number;
    /**
     * Steps since this game started. A clock for cosmetic effects (flicker,
     * shake) that should replay exactly with the game.
     */
    readonly stepCount: number;

    /**
     * Explosions started this game. Each rise is one or more explosions going
     * off. The `explosions` list can't tell of them, because an explosion may
     * come and go between frames, and its slot is reused.
     */
    readonly explosionsStarted: number;
    /** The size of the explosion started last, or `undefined` before the first in a game. */
    readonly lastExplosionSize: ExplosionSize | undefined;
    /** Items picked up this game. Each rise is one or more pickups. */
    readonly itemsCollected: number;
    /** The kind of item picked up last, or `undefined` before the first in a game. */
    readonly lastItemKind: ItemKind | undefined;
    /** Gems picked up this game. */
    readonly gemsCollected: number;

    /** Score, high score, chain and grazes. */
    readonly scoring: ScoreModel;
    readonly ship: ShipModel;
    readonly stage: StageModel;
    readonly boss: BossModel;
    readonly airEnemies: SlotList<EnemyModel>;
    /** Turrets on the rooftops: drawn under everything flying, and harmless to fly over. */
    readonly groundEnemies: SlotList<EnemyModel>;
    readonly items: SlotList<ItemModel>;
    readonly explosions: SlotList<ExplosionModel>;
    readonly enemyBullets: BulletField<BulletKind>;
    readonly playerShots: BulletField<ShotKind>;
    readonly gems: GemField;
    readonly playerInput: PlayerInput;

    /** Start a new game. The high score is kept. */
    reset: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    /** The stage's script, sorted by time. */
    readonly events: readonly StageEvent[];
    readonly bossAttacks: readonly BossAttackDef[];
    /** Seeds the game's random numbers. Defaults to 1. */
    readonly seed?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameModel(options: GameModelOptions): GameModel {
    const { events, bossAttacks, seed = 1 } = options;

    // ---- Initialise --------------------------------------------------------

    const random = createRandom(seed);
    const scoring = createScoreModel();
    const playerInput = createPlayerInput();
    const enemyBullets = createBulletField<BulletKind>({
        capacity: MAX_ENEMY_BULLETS, hitRadii: BULLET_HIT_RADII, width: ARENA_WIDTH, height: ARENA_HEIGHT, margin: BULLET_MARGIN,
    });
    const playerShots = createBulletField<ShotKind>({
        capacity: MAX_PLAYER_SHOTS, hitRadii: SHOT_HIT_RADII, width: ARENA_WIDTH, height: ARENA_HEIGHT, margin: BULLET_MARGIN,
    });
    const ship = createShipModel({ input: playerInput, shots: playerShots });
    const gems = createGemField({ capacity: MAX_GEMS, target: ship, margin: BULLET_MARGIN });
    const stage = createStageModel({ events, scrollSpeed: SCROLL_SPEED });
    const boss = createBossModel({ attacks: bossAttacks, bullets: enemyBullets, target: ship });
    const airEnemies = createSlotList<EnemyModel>({ maxSlots: MAX_ENEMIES });
    const groundEnemies = createSlotList<EnemyModel>({ maxSlots: MAX_ENEMIES });
    const items = createSlotList<ItemModel>({ maxSlots: MAX_ITEMS });
    const explosions = createSlotList<ExplosionModel>({ maxSlots: MAX_EXPLOSIONS });

    let phase: GamePhase = 'playing';
    let phaseMs = 0;
    let loop = 1;
    let difficulty = difficultyFor(loop);
    let lives = INITIAL_LIVES;
    // How many of the scoring's extra lives have been given.
    let extendsGiven = 0;
    let bombs = BOMBS_PER_LIFE;
    let bombMsLeft = 0;
    let warningMsLeft = 0;
    let tallyBonus = 0;
    let stepCount = 0;
    let explosionsStarted = 0;
    let lastExplosionSize: ExplosionSize | undefined;
    let itemsCollected = 0;
    let lastItemKind: ItemKind | undefined;
    let gemsCollected = 0;
    let accumulatedMs = 0;
    let untilBossExplosionMs = 0;
    // Whether the current boss attack has gone without a death or a bomb.
    let isAttackClean = true;

    // Edges: a restart or bomb press, and the boss changing phase.
    const restartWatcher = watch({ isPressed: () => playerInput.restartPressed });
    const bombWatcher = watch({ isPressed: () => playerInput.bombPressed });
    const bossWatcher = watch({ phase: () => boss.phase });

    // Callbacks for the slot lists' walks, made once rather than every step.
    const sweepAirEnemy = (enemy: EnemyModel, slot: Slot<EnemyModel>): void => sweepEnemy(airEnemies, enemy, slot);
    const sweepGroundEnemy = (enemy: EnemyModel, slot: Slot<EnemyModel>): void => sweepEnemy(groundEnemies, enemy, slot);

    // ---- Public record -----------------------------------------------------

    const model: GameModel = {
        get phase() {
            return phase;
        },
        get loop() {
            return loop;
        },
        get lives() {
            return lives;
        },
        get bombs() {
            return bombs;
        },
        get isBombing() {
            return bombMsLeft > 0;
        },
        get bombElapsedMs() {
            return BOMB_MS - bombMsLeft;
        },
        get warningElapsedMs() {
            return warningMsLeft > 0 ? WARNING_MS - warningMsLeft : -1;
        },
        get tallyBonus() {
            return tallyBonus;
        },
        get stepCount() {
            return stepCount;
        },
        get explosionsStarted() {
            return explosionsStarted;
        },
        get lastExplosionSize() {
            return lastExplosionSize;
        },
        get itemsCollected() {
            return itemsCollected;
        },
        get lastItemKind() {
            return lastItemKind;
        },
        get gemsCollected() {
            return gemsCollected;
        },
        scoring,
        ship,
        stage,
        boss,
        airEnemies,
        groundEnemies,
        items,
        explosions,
        enemyBullets,
        playerShots,
        gems,
        playerInput,

        reset() {
            loop = 1;
            scoring.reset();
            lives = INITIAL_LIVES;
            extendsGiven = 0;
            bombs = BOMBS_PER_LIFE;
            stepCount = 0;
            explosionsStarted = 0;
            lastExplosionSize = undefined;
            itemsCollected = 0;
            lastItemKind = undefined;
            gemsCollected = 0;
            ship.reset();
            startLoop();
        },

        update(deltaMs) {
            const restart = restartWatcher.poll().isPressed;
            if (restart.changed && restart.value && (phase === 'game-over' || phase === 'all-clear')) {
                model.reset();
            }

            // Run whole steps. After a long frame, drop what is left over
            // MAX_STEPS_PER_UPDATE, so the game slows down instead of jumping.
            accumulatedMs += deltaMs;
            let steps = 0;
            while (accumulatedMs >= STEP_MS - STEP_TOLERANCE_MS) {
                if (steps === MAX_STEPS_PER_UPDATE) {
                    accumulatedMs = 0;
                    break;
                }
                step();
                accumulatedMs -= STEP_MS;
                steps++;
            }
        },
    };

    return model;

    // ---- One step ----------------------------------------------------------

    function step(): void {
        if (phase === 'game-over' || phase === 'all-clear') return;
        stepCount++;
        phaseMs += STEP_MS;

        // Advance everything.
        stage.update(STEP_MS);
        runDueStageEvents();
        if (phase === 'playing') handleBombButton();
        ship.update(STEP_MS);
        updateEach(airEnemies);
        updateEach(groundEnemies);
        boss.update(STEP_MS);
        enemyBullets.update(STEP_MS);
        playerShots.update(STEP_MS);
        gems.update(STEP_MS);
        updateEach(items);
        updateEach(explosions);
        scoring.update(STEP_MS);
        advanceTimers();

        // Then apply the rules between them.
        if (bombMsLeft > 0) applyBomb();
        shootEnemies(airEnemies);
        shootEnemies(groundEnemies);
        shootBoss();
        if (ship.isAlive) touchShip();
        reactToBoss();
        airEnemies.forEachLive(sweepAirEnemy);
        groundEnemies.forEachLive(sweepGroundEnemy);
        items.forEachLive(sweepItem);
        explosions.forEachLive(sweepExplosion);
        giveExtends();
        advancePhase();
    }

    /** Run every scripted event that has come due by this step. */
    function runDueStageEvents(): void {
        for (let event = stage.consumeNextDueEvent(); event !== undefined; event = stage.consumeNextDueEvent()) {
            switch (event.kind) {
                case 'spawn':
                    spawnEnemy(event);
                    break;
                case 'warning':
                    warningMsLeft = WARNING_MS;
                    break;
                case 'boss':
                    boss.arrive(difficulty);
                    break;
            }
        }
    }

    function advanceTimers(): void {
        bombMsLeft = Math.max(0, bombMsLeft - STEP_MS);
        warningMsLeft = Math.max(0, warningMsLeft - STEP_MS);
    }

    function advancePhase(): void {
        if (phase === 'dying' && phaseMs >= DYING_MS) {
            if (lives > 0) respawn();
            else enterPhase('game-over');
        }
        else if (phase === 'tally' && phaseMs >= TALLY_MS) {
            if (loop < LOOP_COUNT) {
                loop++;
                startLoop();
            }
            else {
                enterPhase('all-clear');
            }
        }
    }

    // ---- Enemies -----------------------------------------------------------

    function spawnEnemy(event: SpawnEvent): void {
        const list = event.path.kind === 'ground' ? groundEnemies : airEnemies;
        if (list.isFull) return;
        // On later loops, kites leave a ring of bullets behind when they die.
        const deathPatterns = loop > 1 && event.enemy === 'kite' ? REVENGE_PATTERNS : undefined;
        list.insert(createEnemyModel({
            kind: event.enemy,
            x: event.x,
            y: event.y ?? ENTRY_Y,
            path: event.path,
            patterns: event.patterns,
            deathPatterns,
            drop: event.drop,
            bullets: enemyBullets,
            target: ship,
            ground: stage,
            speedScale: difficulty.speedScale,
            densityScale: difficulty.densityScale,
        }));
    }

    function shootEnemies(list: SlotList<EnemyModel>): void {
        list.forEachLive(shootEnemy);
    }

    function shootEnemy(enemy: EnemyModel): void {
        if (!enemy.isOnScreen) return;
        let hit = playerShots.findTouching(enemy.x, enemy.y, enemy.radius);
        while (hit >= 0 && enemy.isAlive) {
            enemy.takeDamage(SHOT_DAMAGE[playerShots.kindOf(hit)]);
            playerShots.remove(hit);
            hit = playerShots.findTouching(enemy.x, enemy.y, enemy.radius);
        }
    }

    /** Remove an enemy that has died or left, scoring the kill. */
    function sweepEnemy(list: SlotList<EnemyModel>, enemy: EnemyModel, slot: Slot<EnemyModel>): void {
        if (!enemy.isAlive) {
            scoring.addKill(ENEMY_POINTS[enemy.kind]);
            explode(enemy.x, enemy.y, EXPLOSION_SIZES[enemy.kind]);
            if (enemy.drop !== undefined && !items.isFull) {
                items.insert(createItemModel({ kind: enemy.drop, x: enemy.x, y: enemy.y }));
            }
            list.remove(slot);
        }
        else if (enemy.hasLeft) {
            list.remove(slot);
        }
    }

    // ---- Boss --------------------------------------------------------------

    function shootBoss(): void {
        if (!boss.isVulnerable) return;
        let hit = playerShots.findTouching(boss.x, boss.y, boss.radius);
        while (hit >= 0) {
            boss.takeDamage(SHOT_DAMAGE[playerShots.kindOf(hit)]);
            playerShots.remove(hit);
            hit = playerShots.findTouching(boss.x, boss.y, boss.radius);
        }
    }

    /** Respond to the boss changing phase, and keep its explosions going. */
    function reactToBoss(): void {
        const changed = bossWatcher.poll().phase;
        if (changed.changed) onBossPhase(changed.value);

        if (boss.phase === 'exploding') {
            untilBossExplosionMs -= STEP_MS;
            if (untilBossExplosionMs <= 0) {
                untilBossExplosionMs += BOSS_EXPLOSION_INTERVAL_MS;
                const spread = boss.radius * 1.5;
                explode(boss.x + (random.next() - 0.5) * spread * 2, boss.y + (random.next() - 0.5) * spread, 'large');
            }
        }
    }

    function onBossPhase(bossPhase: BossPhase): void {
        switch (bossPhase) {
            case 'attacking':
                isAttackClean = true;
                break;
            case 'breaking':
                endBossAttack();
                break;
            case 'exploding':
                endBossAttack();
                scoring.addPoints(BOSS_POINTS * loop);
                untilBossExplosionMs = 0;
                break;
            case 'defeated':
                explode(boss.x, boss.y, 'huge');
                startTally();
                break;
            case 'absent':
            case 'entering':
                break;
        }
    }

    /** Every bullet on screen becomes a gem, and a clean break earns the bonus. */
    function endBossAttack(): void {
        enemyBullets.clear(spawnGem);
        if (boss.lastOutcome === 'broken' && isAttackClean) scoring.addPoints(ATTACK_BONUS * loop);
    }

    // ---- The ship ----------------------------------------------------------

    /** Everything that can touch the ship: bullets, enemies, items and gems. */
    function touchShip(): void {
        const x = ship.x;
        const y = ship.y;

        if (!ship.isInvulnerable) {
            scoring.addGrazes(enemyBullets.markGrazed(x, y, SHIP_GRAZE_RADIUS));
            if (enemyBullets.findTouching(x, y, ship.hitRadius) >= 0 || isRammed(x, y)) {
                loseLife();
                return;
            }
        }

        items.forEachLive(collectItem);
        const collected = gems.collectTouching(x, y, GEM_COLLECT_RADIUS);
        if (collected > 0) {
            gemsCollected += collected;
            scoring.addPoints(collected * GEM_POINTS * loop);
        }
    }

    /** Whether the ship has flown into an enemy in the air, or the boss. */
    function isRammed(x: number, y: number): boolean {
        const slots = airEnemies.slots;
        for (let i = 0; i < slots.length; i++) {
            const slot = slots.at(i);
            if (slot?.isLive && isTouching(x, y, slot.value.x, slot.value.y, slot.value.radius * BODY_FRACTION)) return true;
        }
        return boss.isVulnerable && isTouching(x, y, boss.x, boss.y, boss.radius * BODY_FRACTION);
    }

    function loseLife(): void {
        explode(ship.x, ship.y, 'large');
        ship.explode();
        lives--;
        scoring.breakChain();
        bombMsLeft = 0;
        isAttackClean = false;
        enemyBullets.clear();
        enterPhase('dying');
    }

    function respawn(): void {
        ship.respawn(RESPAWN_INVULNERABLE_MS);
        bombs = BOMBS_PER_LIFE;
        enterPhase('playing');
    }

    // ---- Bombs -------------------------------------------------------------

    function handleBombButton(): void {
        const press = bombWatcher.poll().isPressed;
        if (!press.changed || !press.value) return;
        if (bombs === 0 || bombMsLeft > 0 || !ship.isAlive) return;
        bombs--;
        bombMsLeft = BOMB_MS;
        ship.shieldFor(BOMB_MS);
        isAttackClean = false;
    }

    /** While a bomb lasts, every bullet becomes a gem and everything on screen takes damage. */
    function applyBomb(): void {
        enemyBullets.clear(spawnGem);
        airEnemies.forEachLive(bombEnemy);
        groundEnemies.forEachLive(bombEnemy);
        boss.takeDamage(BOMB_DAMAGE_PER_STEP);
    }

    function bombEnemy(enemy: EnemyModel): void {
        if (enemy.isOnScreen) enemy.takeDamage(BOMB_DAMAGE_PER_STEP);
    }

    // ---- Items, gems and explosions ----------------------------------------

    function collectItem(item: ItemModel, slot: Slot<ItemModel>): void {
        if (!isTouching(ship.x, ship.y, item.x, item.y, ITEM_COLLECT_RADIUS)) return;
        itemsCollected++;
        lastItemKind = item.kind;
        if (item.kind === 'power') {
            if (!ship.powerUp()) scoring.addPoints(SPARE_ITEM_POINTS);
        }
        else if (bombs < MAX_BOMBS) {
            bombs++;
        }
        else {
            scoring.addPoints(SPARE_ITEM_POINTS);
        }
        items.remove(slot);
    }

    function sweepItem(item: ItemModel, slot: Slot<ItemModel>): void {
        if (item.y > ARENA_HEIGHT + BULLET_MARGIN) items.remove(slot);
    }

    function spawnGem(x: number, y: number): void {
        gems.spawn(x, y);
    }

    function explode(x: number, y: number, size: ExplosionSize): void {
        explosionsStarted++;
        lastExplosionSize = size;
        if (!explosions.isFull) explosions.insert(createExplosionModel({ size, x, y }));
    }

    function sweepExplosion(explosion: ExplosionModel, slot: Slot<ExplosionModel>): void {
        if (explosion.isFinished) explosions.remove(slot);
    }

    /** A life for each extra life the score has earned and not yet been given. */
    function giveExtends(): void {
        while (extendsGiven < scoring.extendsEarned) {
            lives++;
            extendsGiven++;
        }
    }

    // ---- Loops and phases --------------------------------------------------

    /** Start the stage from the top: a new game, or the next loop. */
    function startLoop(): void {
        difficulty = difficultyFor(loop);
        stage.restart();
        boss.reset();
        airEnemies.clear();
        groundEnemies.clear();
        items.clear();
        explosions.clear();
        enemyBullets.clear();
        playerShots.clear();
        gems.clear();
        scoring.breakChain();
        bombMsLeft = 0;
        warningMsLeft = 0;
        if (!ship.isAlive) ship.respawn(0);
        enterPhase('playing');
    }

    function startTally(): void {
        tallyBonus = bombs * TALLY_BOMB_BONUS * loop;
        scoring.addPoints(tallyBonus);
        enterPhase('tally');
    }

    function enterPhase(next: GamePhase): void {
        phase = next;
        phaseMs = 0;
    }

    // ---- Helpers -----------------------------------------------------------

    function updateEach<T extends { update: (deltaMs: number) => void }>(list: SlotList<T>): void {
        list.forEachLive(updateOne);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Leeway when comparing collected time with a step: 1000 / 60 is not exact
 * in floating point, so a frame of exactly one step must not fall a hair
 * short and be carried to the next frame.
 */
const STEP_TOLERANCE_MS = 0.01;

/** Enemies enter just above the top edge. */
const ENTRY_Y = -16;

const BOMB_DAMAGE_PER_STEP = BOMB_DAMAGE_PER_SEC * STEP_MS * 0.001;

/** Ramming uses part of an enemy's hit radius: the body, not the wings. */
const BODY_FRACTION = 0.6;

const REVENGE_PATTERNS = [REVENGE_RING];

const EXPLOSION_SIZES: Readonly<Record<EnemyKind, ExplosionSize>> = {
    kite: 'small',
    lancer: 'small',
    turret: 'small',
    barge: 'large',
    gunship: 'huge',
};

function updateOne(item: { update: (deltaMs: number) => void }): void {
    item.update(STEP_MS);
}

function isTouching(x1: number, y1: number, x2: number, y2: number, reach: number): boolean {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy < reach * reach;
}

function difficultyFor(loop: number): { readonly speedScale: number; readonly densityScale: number } {
    return { speedScale: LOOP_SPEED_SCALES[loop - 1], densityScale: LOOP_DENSITY_SCALES[loop - 1] };
}
