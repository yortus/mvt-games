import gsap from 'gsap';
import { watch } from '@mvtjs/utils';
import { LAP_SPEED_UP, type RoundConfig } from '../data';
import { createBeetleModel, type BeetleHand, type BeetleModel } from './beetle-model';
import type { Direction, GamePhase } from './common';
import { createDustDevilModel, type DevilTarget, type DustDevilModel } from './dust-devil-model';
import { createFarmhandModel, type FarmhandModel } from './farmhand-model';
import { createFieldModel, type FieldModel } from './field-model';
import {
    BEETLE_CATCH_DISTANCE,
    BLOW_OUT_POINTS,
    BONUS_PER_PERCENT,
    FARMHAND_SPEED,
    MAX_STEP_MS,
    POINTS_PER_CELL,
    READY_MS,
    ROUND_CLEAR_MS,
    SHEEP_POINTS,
    SNAPPED_MS,
    START_LIVES,
    STARVE_SHARE,
} from './model-constants';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createRandom } from './random';
import { createSheepModel, type SheepModel } from './sheep-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The whole game. Each round is a fresh meadow, with dust devils whirling in
 * it, sheep grazing in it, and beetles on its fences. The farmhand strings
 * wire across it from fence to fence. Each wire tied off fences off every
 * region with no dust devil in it, and pens the sheep there. A dust devil
 * left in a small enough region blows itself out, and its region is fenced
 * off too. Fencing off the round's share of the meadow clears the round. A
 * dust devil touching the wire or the farmhand out in the meadow, slack
 * reaching the farmhand, or a beetle reaching them, costs a life.
 */
export interface GameModel {
    readonly phase: GamePhase;
    /** The round, counting from 1. */
    readonly round: number;
    readonly score: number;
    readonly lives: number;
    /** The share of the meadow to fence off this round, from 0 to 1. */
    readonly targetShare: number;
    readonly field: FieldModel;
    readonly farmhand: FarmhandModel;
    readonly devils: readonly DustDevilModel[];
    readonly beetles: readonly BeetleModel[];
    readonly sheep: readonly SheepModel[];
    /** Sheep penned this round. */
    readonly sheepPennedThisRound: number;
    /** Sheep penned this game. Each rise is a sheep penned. */
    readonly sheepPennedCount: number;
    /** Dust devils blown out this game. Each rise is one blown out. */
    readonly devilsBlownOut: number;
    /** Beetles hatched this game. Each rise is a new beetle. */
    readonly beetlesHatched: number;
    /** The points the latest wire tied off scored: for its cells, its sheep and any dust devil blown out. */
    readonly lastClosurePoints: number;
    /** The bonus for the share fenced off past the target, as the latest round was cleared. */
    readonly roundBonus: number;
    readonly playerInput: PlayerInput;
    /** Starts a new game from round 1. */
    reset: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    readonly rounds: readonly RoundConfig[];
    /** The meadow's size, in cells. */
    readonly rows: number;
    readonly cols: number;
    /** Seeds the game's random numbers. Defaults to 1. */
    readonly seed?: number;
    /** Lives at the start of each game. Defaults to `START_LIVES`. */
    readonly startLives?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game, ready to start round 1. */
export function createGameModel(options: GameModelOptions): GameModel {
    const { rounds, rows, cols } = options;
    const startLives = options.startLives ?? START_LIVES;
    const random = createRandom({ seed: options.seed ?? 1 });
    const playerInput = createPlayerInput();
    const watcher = watch({ restart: () => playerInput.restartPressed });
    const phaseTimeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    let phase: GamePhase = 'ready';
    let round = 1;
    let score = 0;
    let lives = startLives;
    let config = findRoundConfig(1);
    let sheepPennedThisRound = 0;
    let sheepPennedCount = 0;
    let devilsBlownOut = 0;
    let beetlesHatched = 0;
    let lastClosurePoints = 0;
    let roundBonus = 0;
    let hatchMs = 0;

    let field = createFieldModel({ rows, cols, obstacles: [] });
    let farmhand = buildFarmhand();
    let devils: DustDevilModel[] = [];
    let beetles: BeetleModel[] = [];
    let sheep: SheepModel[] = [];

    // What the dust devils lean towards: the farmhand, out in the meadow with wire
    const devilTarget: DevilTarget = {
        get row() { return farmhand.row; },
        get col() { return farmhand.col; },
        get isExposed() { return farmhand.phase === 'stringing'; },
    };

    // Where the latest search for a fence point found one
    let foundRow = 0;
    let foundCol = 0;

    loadRound();

    const model: GameModel = {
        get phase() { return phase; },
        get round() { return round; },
        get score() { return score; },
        get lives() { return lives; },
        get targetShare() { return config.targetShare; },
        get field() { return field; },
        get farmhand() { return farmhand; },
        get devils() { return devils; },
        get beetles() { return beetles; },
        get sheep() { return sheep; },
        get sheepPennedThisRound() { return sheepPennedThisRound; },
        get sheepPennedCount() { return sheepPennedCount; },
        get devilsBlownOut() { return devilsBlownOut; },
        get beetlesHatched() { return beetlesHatched; },
        get lastClosurePoints() { return lastClosurePoints; },
        get roundBonus() { return roundBonus; },
        playerInput,

        reset() {
            round = 1;
            score = 0;
            lives = startLives;
            sheepPennedCount = 0;
            devilsBlownOut = 0;
            beetlesHatched = 0;
            lastClosurePoints = 0;
            roundBonus = 0;
            loadRound();
        },

        update(deltaMs) {
            const watched = watcher.poll();
            if (phase === 'game-over' && watched.restart.changed && watched.restart.value) model.reset();

            // A long update runs as several short steps, so nothing jumps a fence
            let remaining = deltaMs;
            while (remaining > 0) {
                const stepMs = Math.min(remaining, MAX_STEP_MS);
                step(stepMs);
                remaining -= stepMs;
            }
        },
    };

    return model;

    // ---- Each step ---------------------------------------------------------

    function step(deltaMs: number): void {
        phaseTimeline.time(phaseTimeline.time() + deltaMs * 0.001);
        if (phase !== 'playing') return;

        farmhand.update(deltaMs);
        for (let i = 0; i < devils.length; i++) devils[i].update(deltaMs);
        for (let i = 0; i < beetles.length; i++) beetles[i].update(deltaMs);
        for (let i = 0; i < sheep.length; i++) sheep[i].update(deltaMs);
        advanceHatching(deltaMs);

        if (farmhand.hasReachedFence) tieOff();
        if (phase === 'playing' && isFarmhandCaught()) snapFarmhand();
    }

    function advanceHatching(deltaMs: number): void {
        if (beetles.length >= config.maxBeetles) return;
        hatchMs += deltaMs;
        if (hatchMs < config.hatchIntervalMs) return;
        hatchMs = 0;
        findFencePoint(farmhand.pointRow, farmhand.pointCol, 'farthest');
        beetles.push(buildBeetle(foundRow, foundCol, findWayFrom(foundRow, foundCol), beetlesHatched % 2 === 0 ? 'right' : 'left', true));
        beetlesHatched++;
    }

    // ---- Tying off a wire --------------------------------------------------

    /**
     * Turns the farmhand's wire into fence, and fences off every region with
     * no dust devil in it. A dust devil left in a small region blows itself
     * out, and its region is fenced off too. Sheep in the new pasture are
     * penned.
     */
    function tieOff(): void {
        field.addFence(farmhand.wireRows, farmhand.wireCols, farmhand.wireLength);
        let claimed = field.claimRegions(hasDevilIn);

        const starveSize = STARVE_SHARE * field.claimableCount;
        let blown = 0;
        for (let i = 0; i < devils.length; i++) {
            const devil = devils[i];
            if (devil.phase !== 'whirling') continue;
            const region = field.regionAt(Math.floor(devil.row), Math.floor(devil.col));
            if (region >= 0 && field.regionSize(region) > starveSize) continue;
            devil.blowOut();
            blown++;
        }
        if (blown > 0) claimed += field.claimRegions(hasDevilIn);

        let penned = 0;
        for (let i = 0; i < sheep.length; i++) {
            const one = sheep[i];
            if (one.phase === 'penned' || one.phase === 'lost') continue;
            if (field.isMeadow(Math.floor(one.row), Math.floor(one.col))) continue;
            one.pen();
            penned++;
        }

        lastClosurePoints = claimed * POINTS_PER_CELL + penned * SHEEP_POINTS + blown * BLOW_OUT_POINTS;
        score += lastClosurePoints;
        sheepPennedThisRound += penned;
        sheepPennedCount += penned;
        devilsBlownOut += blown;

        farmhand.tieOff();
        keepOnFences();
        measureDevilRooms();
        if (field.claimedShare >= config.targetShare) clearRound();
    }

    /** Tells each whirling dust devil how much room its region gives it, as a multiple of the region at which it blows out. */
    function measureDevilRooms(): void {
        const starveSize = STARVE_SHARE * field.claimableCount;
        for (let i = 0; i < devils.length; i++) {
            const devil = devils[i];
            if (devil.phase !== 'whirling') continue;
            const region = field.regionAt(Math.floor(devil.row), Math.floor(devil.col));
            devil.setRoom(region < 0 ? 0 : field.regionSize(region) / starveSize);
        }
    }

    /** Whether a whirling dust devil is in region `region`. */
    function hasDevilIn(region: number): boolean {
        for (let i = 0; i < devils.length; i++) {
            const devil = devils[i];
            if (devil.phase === 'whirling' && field.regionAt(Math.floor(devil.row), Math.floor(devil.col)) === region) return true;
        }
        return false;
    }

    /**
     * Moves the farmhand and any beetle left off the fences by new pasture to
     * the nearest fence. A beetle goes to the nearest fence point well clear
     * of the farmhand, who has just tied off nearby, so it never lands on
     * them. If there is none, it goes as far from them as it can.
     */
    function keepOnFences(): void {
        if (!field.isOnFence(farmhand.pointRow, farmhand.pointCol)) {
            if (findFencePoint(farmhand.pointRow, farmhand.pointCol, 'nearest')) farmhand.moveTo(foundRow, foundCol);
        }
        for (let i = 0; i < beetles.length; i++) {
            const beetle = beetles[i];
            const row = Math.round(beetle.row);
            const col = Math.round(beetle.col);
            if (field.isOnFence(row, col)) continue;
            const isFound = findFencePoint(row, col, 'nearest', SAFE_DISTANCE)
                || findFencePoint(farmhand.pointRow, farmhand.pointCol, 'farthest');
            if (isFound) beetle.moveTo(foundRow, foundCol);
        }
    }

    // ---- Being caught ------------------------------------------------------

    function isFarmhandCaught(): boolean {
        if (farmhand.hasWireSnapped) return true;
        for (let i = 0; i < beetles.length; i++) {
            const beetle = beetles[i];
            if (beetle.phase !== 'crawling') continue;
            if (measureDistanceSquared(beetle.row, beetle.col, farmhand.row, farmhand.col) < BEETLE_CATCH_DISTANCE * BEETLE_CATCH_DISTANCE) return true;
        }
        if (farmhand.phase !== 'stringing') return false;
        for (let i = 0; i < devils.length; i++) {
            const devil = devils[i];
            if (devil.phase === 'whirling' && isDevilOnWire(devil)) return true;
        }
        return false;
    }

    /** Whether the dust devil touches the wire, or the farmhand at its end. */
    function isDevilOnWire(devil: DustDevilModel): boolean {
        const radiusSquared = devil.radius * devil.radius;
        const wireRows = farmhand.wireRows;
        const wireCols = farmhand.wireCols;
        const length = farmhand.wireLength;
        for (let i = 1; i < length; i++) {
            if (measureSegmentDistanceSquared(devil.row, devil.col, wireRows[i - 1], wireCols[i - 1], wireRows[i], wireCols[i]) < radiusSquared) {
                return true;
            }
        }
        const lastRow = wireRows[length - 1];
        const lastCol = wireCols[length - 1];
        return measureSegmentDistanceSquared(devil.row, devil.col, lastRow, lastCol, farmhand.row, farmhand.col) < radiusSquared;
    }

    function snapFarmhand(): void {
        farmhand.snap();
        lives--;
        phase = 'snapped';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(lives > 0 ? carryOn : endGame, undefined, SNAPPED_MS * 0.001);
    }

    /** Puts the farmhand back on the fence, and any beetle near them at the far side of the meadow. */
    function carryOn(): void {
        farmhand.respawn();
        if (findFencePoint(farmhand.pointRow, farmhand.pointCol, 'farthest')) {
            for (let i = 0; i < beetles.length; i++) {
                const beetle = beetles[i];
                if (measureDistanceSquared(beetle.row, beetle.col, farmhand.row, farmhand.col) > SAFE_DISTANCE * SAFE_DISTANCE) continue;
                beetle.moveTo(foundRow, foundCol);
            }
        }
        phase = 'playing';
    }

    function endGame(): void {
        phase = 'game-over';
    }

    // ---- Rounds ------------------------------------------------------------

    function clearRound(): void {
        phase = 'round-clear';
        const percentOver = Math.floor((field.claimedShare - config.targetShare) * 100 + 1e-9);
        roundBonus = Math.max(0, percentOver) * BONUS_PER_PERCENT;
        score += roundBonus;
        for (let i = 0; i < sheep.length; i++) sheep[i].lose();
        phaseTimeline.clear().time(0);
        phaseTimeline.call(nextRound, undefined, ROUND_CLEAR_MS * 0.001);
    }

    function nextRound(): void {
        round++;
        loadRound();
    }

    function loadRound(): void {
        config = findRoundConfig(round);
        field = createFieldModel({ rows, cols, obstacles: config.obstacles });
        farmhand = buildFarmhand();
        devils = buildDevils();
        measureDevilRooms();
        beetles = buildBeetles();
        sheep = buildSheep();
        sheepPennedThisRound = 0;
        hatchMs = 0;
        phase = 'ready';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(startPlaying, undefined, READY_MS * 0.001);
    }

    function startPlaying(): void {
        phase = 'playing';
    }

    /** The round's settings. Past the last round, they repeat, faster each lap. */
    function findRoundConfig(roundNumber: number): RoundConfig {
        const base = rounds[(roundNumber - 1) % rounds.length];
        const lap = Math.floor((roundNumber - 1) / rounds.length);
        if (lap === 0) return base;
        const speedUp = 1 + lap * LAP_SPEED_UP;
        return {
            ...base,
            devilSpeed: base.devilSpeed * speedUp,
            beetleSpeed: base.beetleSpeed * speedUp,
            hatchIntervalMs: base.hatchIntervalMs / speedUp,
        };
    }

    // ---- Building the round ------------------------------------------------

    function buildFarmhand(): FarmhandModel {
        return createFarmhandModel({
            row: rows,
            col: Math.floor(cols / 2),
            speed: FARMHAND_SPEED,
            input: playerInput,
            field,
        });
    }

    function buildDevils(): DustDevilModel[] {
        const result: DustDevilModel[] = [];
        for (let i = 0; i < config.devilCount; i++) {
            const start = config.devilStarts?.[i];
            let row = start?.row ?? rows / 2;
            let col = start?.col ?? cols / 2;
            for (let attempt = 0; start === undefined && attempt < PLACEMENT_ATTEMPTS; attempt++) {
                row = random.between(DEVIL_MARGIN, rows - DEVIL_MARGIN);
                col = random.between(DEVIL_MARGIN, cols - DEVIL_MARGIN);
                if (isRoomForDevil(row, col) && isClearOf(result, row, col, DEVIL_SPACING)) break;
            }
            result.push(createDustDevilModel({
                row,
                col,
                speed: config.devilSpeed,
                chase: config.devilChase,
                target: devilTarget,
                random,
                regionAt: field.regionAt,
            }));
        }
        return result;
    }

    function buildBeetles(): BeetleModel[] {
        const result: BeetleModel[] = [];
        const middle = Math.floor(cols / 2);
        for (let i = 0; i < config.startBeetles; i++) {
            const start = BEETLE_STARTS[i % BEETLE_STARTS.length];
            const row = start.atBottom ? rows : start.atMiddleRow ? Math.floor(rows / 2) : 0;
            const col = start.side === 'left' ? 0 : start.side === 'right' ? cols : middle;
            result.push(buildBeetle(row, col, start.direction, start.hand, false));
        }
        return result;
    }

    function buildBeetle(row: number, col: number, direction: Direction, hand: BeetleHand, isHatching: boolean): BeetleModel {
        return createBeetleModel({
            row,
            col,
            direction,
            hand,
            speed: config.beetleSpeed,
            isWalkable: field.isWalkable,
            isHatching,
        });
    }

    function buildSheep(): SheepModel[] {
        const result: SheepModel[] = [];
        for (let i = 0; i < config.sheepCount; i++) {
            const start = config.sheepStarts?.[i];
            let row = start?.row ?? rows / 2;
            let col = start?.col ?? cols / 2;
            for (let attempt = 0; start === undefined && attempt < PLACEMENT_ATTEMPTS; attempt++) {
                row = Math.floor(random.between(SHEEP_MARGIN, rows - SHEEP_MARGIN)) + 0.5;
                col = Math.floor(random.between(SHEEP_MARGIN, cols - SHEEP_MARGIN)) + 0.5;
                if (field.isMeadow(Math.floor(row), Math.floor(col))
                    && isClearOf(devils, row, col, SHEEP_DEVIL_SPACING)
                    && isClearOf(result, row, col, SHEEP_SPACING)) break;
            }
            result.push(createSheepModel({ row, col, random, regionAt: field.regionAt, devils: () => devils }));
        }
        return result;
    }

    /** Whether every cell a dust devil at (row, col) would cover is open meadow. */
    function isRoomForDevil(row: number, col: number): boolean {
        const reach = Math.ceil(DEVIL_ROOM);
        for (let r = Math.floor(row) - reach; r <= Math.floor(row) + reach; r++) {
            for (let c = Math.floor(col) - reach; c <= Math.floor(col) + reach; c++) {
                if (!field.isMeadow(r, c)) return false;
            }
        }
        return true;
    }

    // ---- Fence points ------------------------------------------------------

    /**
     * Finds the fence point nearest to, or farthest from, point (row, col),
     * at least `clearance` grid steps from the farmhand, and leaves it in
     * `foundRow` and `foundCol`. Returns whether there is any such point.
     */
    function findFencePoint(row: number, col: number, which: 'nearest' | 'farthest', clearance = 0): boolean {
        let best = which === 'nearest' ? Infinity : -1;
        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) {
                const distance = measureDistanceSquared(r, c, row, col);
                if (which === 'nearest' ? distance >= best : distance <= best) continue;
                if (!field.isOnFence(r, c)) continue;
                if (clearance > 0 && measureDistanceSquared(r, c, farmhand.pointRow, farmhand.pointCol) < clearance * clearance) continue;
                best = distance;
                foundRow = r;
                foundCol = c;
            }
        }
        return which === 'nearest' ? best !== Infinity : best >= 0;
    }

    /** A way along a fence from point (row, col). */
    function findWayFrom(row: number, col: number): Direction {
        for (let i = 0; i < DIRECTIONS.length; i++) {
            if (field.isWalkable(row, col, DIRECTIONS[i])) return DIRECTIONS[i];
        }
        return 'right';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];
const PLACEMENT_ATTEMPTS = 200;
/** How far in from the edge, in cells, dust devils and sheep start. */
const DEVIL_MARGIN = 9;
const SHEEP_MARGIN = 5;
/** How far apart, in cells, dust devils start from one another, and sheep from dust devils and one another. */
const DEVIL_SPACING = 14;
const SHEEP_DEVIL_SPACING = 8;
const SHEEP_SPACING = 5;
/** How much open meadow, in cells, a dust devil needs round its middle to start. */
const DEVIL_ROOM = 2.5;
/**
 * How far, in grid steps, a beetle must be from the farmhand as they come
 * back, or it is moved away. A beetle moved off new pasture lands at least
 * this far from them too.
 */
const SAFE_DISTANCE = 15;

/**
 * Where the round's first beetles start, on the edge of the meadow: the top
 * middle, the left and right middles, and the bottom middle. Each keeps to
 * the hand that has the meadow on it, so it goes round the meadow's edge.
 */
const BEETLE_STARTS: readonly {
    readonly side: 'left' | 'middle' | 'right';
    readonly atMiddleRow: boolean;
    readonly atBottom: boolean;
    readonly direction: Direction;
    readonly hand: BeetleHand;
}[] = [
    { side: 'middle', atMiddleRow: false, atBottom: false, direction: 'right', hand: 'right' },
    { side: 'middle', atMiddleRow: false, atBottom: false, direction: 'left', hand: 'left' },
    { side: 'left', atMiddleRow: true, atBottom: false, direction: 'up', hand: 'right' },
    { side: 'right', atMiddleRow: true, atBottom: false, direction: 'down', hand: 'right' },
];

interface Placed {
    readonly row: number;
    readonly col: number;
}

/** Whether (row, col) is at least `spacing` cells from everything in `placed`. */
function isClearOf(placed: readonly Placed[], row: number, col: number, spacing: number): boolean {
    for (let i = 0; i < placed.length; i++) {
        if (measureDistanceSquared(placed[i].row, placed[i].col, row, col) < spacing * spacing) return false;
    }
    return true;
}

function measureDistanceSquared(row0: number, col0: number, row1: number, col1: number): number {
    const dRow = row1 - row0;
    const dCol = col1 - col0;
    return dRow * dRow + dCol * dCol;
}

/** The squared distance from (row, col) to the line segment from (row0, col0) to (row1, col1). */
function measureSegmentDistanceSquared(row: number, col: number, row0: number, col0: number, row1: number, col1: number): number {
    const dRow = row1 - row0;
    const dCol = col1 - col0;
    const lengthSquared = dRow * dRow + dCol * dCol;
    let t = lengthSquared === 0 ? 0 : ((row - row0) * dRow + (col - col0) * dCol) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    return measureDistanceSquared(row, col, row0 + dRow * t, col0 + dCol * t);
}
