import gsap from 'gsap';
import { watch } from '@mvtjs/utils';
import { BLOW_OUT_POINTS, BONUS_PER_PERCENT, EXTRA_LIFE_POINTS, FARM_SPEED_UP, POINTS_PER_CELL, type RoundConfig, SHEEP_POINTS } from '../data';
import { createBeetleModel, type BeetleModel } from './beetle-model';
import type { GamePhase } from './common';
import type { DevilTarget, DustDevilModel } from './dust-devil-model';
import { createFarmhandModel, type FarmhandModel } from './farmhand-model';
import { createFieldModel, type FieldModel } from './field-model';
import { measureDistanceSquared } from './geometry';
import {
    BEETLE_CATCH_DISTANCE,
    FARM_FENCED_MS,
    FARMHAND_SPEED,
    MAX_STEP_MS,
    READY_MS,
    ROUND_CLEAR_MS,
    SNAPPED_MS,
    START_LIVES,
    STARVE_SHARE,
} from './model-constants';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createRandom } from './random';
import { placeBeetles, placeDevils, placeSheep } from './round-setup';
import type { SheepModel } from './sheep-model';

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
 *
 * A farm is one pass through the rounds. Clearing its last round fences the
 * whole farm, and after a moment to celebrate, the farmhand starts on the
 * next farm, which plays faster.
 */
export interface GameModel {
    readonly phase: GamePhase;
    /** How long the game has been in its phase. */
    readonly phaseMs: number;
    /** The round, counting from 1 and on through the farms. */
    readonly round: number;
    /** The farm, counting from 1. */
    readonly farm: number;
    /** How fast this farm plays, as a multiple of the first farm's speed. */
    readonly speed: number;
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
    /** Extra lives earned this game, one for each `extraLifePoints` scored. Each rise is a life earned. */
    readonly extraLivesEarned: number;
    /** The points the latest wire tied off scored. They count its cells, its sheep and any dust devil it blew out. */
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
    /** The rounds of each farm, in order. */
    readonly rounds: readonly RoundConfig[];
    /** The meadow's size, in cells. */
    readonly rows: number;
    readonly cols: number;
    /** Seeds the game's random numbers. Defaults to 1. */
    readonly seed?: number;
    /** Lives at the start of each game. Defaults to `START_LIVES`. */
    readonly startLives?: number;
    /** The points that earn each extra life. Defaults to `EXTRA_LIFE_POINTS`. */
    readonly extraLifePoints?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game, ready to start round 1. */
export function createGameModel(options: GameModelOptions): GameModel {
    const { rounds, rows, cols } = options;
    const startLives = options.startLives ?? START_LIVES;
    const extraLifePoints = options.extraLifePoints ?? EXTRA_LIFE_POINTS;
    const random = createRandom({ seed: options.seed ?? 1 });
    const playerInput = createPlayerInput();
    const watcher = watch({ restart: () => playerInput.restartPressed });
    const phaseTimeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    let phase: GamePhase = 'ready';
    let phaseMs = 0;
    let round = 1;
    let speed = 1;
    let score = 0;
    let lives = startLives;
    let config = rounds[0];
    let sheepPennedThisRound = 0;
    let sheepPennedCount = 0;
    let devilsBlownOut = 0;
    let beetlesHatched = 0;
    let extraLivesEarned = 0;
    let lastClosurePoints = 0;
    let roundBonus = 0;
    let hatchMs = 0;

    let field = createFieldModel({ rows, cols, obstacles: [] });
    let farmhand = buildFarmhand();
    let devils: DustDevilModel[] = [];
    let beetles: BeetleModel[] = [];
    let sheep: SheepModel[] = [];

    // The dust devils lean towards the farmhand while they have wire out in the meadow
    const devilTarget: DevilTarget = {
        get row() { return farmhand.row; },
        get col() { return farmhand.col; },
        get isExposed() { return farmhand.phase === 'stringing'; },
    };

    loadRound();

    const model: GameModel = {
        get phase() { return phase; },
        get phaseMs() { return phaseMs; },
        get round() { return round; },
        get farm() { return findFarm(round); },
        get speed() { return speed; },
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
        get extraLivesEarned() { return extraLivesEarned; },
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
            extraLivesEarned = 0;
            lastClosurePoints = 0;
            roundBonus = 0;
            loadRound();
        },

        update(deltaMs) {
            const watched = watcher.poll();
            if (phase === 'game-over' && watched.restart.changed && watched.restart.value) model.reset();

            // A long update runs as several short steps, so nothing jumps a
            // fence. A faster farm packs more play into each step, so its
            // steps are shorter.
            const maxStepMs = MAX_STEP_MS / speed;
            let remaining = deltaMs;
            while (remaining > 0) {
                const stepMs = Math.min(remaining, maxStepMs);
                step(stepMs);
                remaining -= stepMs;
            }
        },
    };

    return model;

    // ---- Each step ---------------------------------------------------------

    function step(deltaMs: number): void {
        phaseMs += deltaMs;
        phaseTimeline.time(phaseTimeline.time() + deltaMs * 0.001);
        if (phase === 'playing') play(deltaMs * speed);
    }

    /** Advances play by `deltaMs` of the meadow's time, which runs faster on a faster farm. */
    function play(deltaMs: number): void {
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
        const point = field.findFencePoint({ row: farmhand.pointRow, col: farmhand.pointCol, which: 'farthest' });
        if (point === undefined) return;
        beetles.push(createBeetleModel({
            row: point.row,
            col: point.col,
            direction: field.findWayAlongFence(point.row, point.col) ?? 'right',
            hand: beetlesHatched % 2 === 0 ? 'right' : 'left',
            speed: config.beetleSpeed,
            isWalkable: field.isWalkable,
            isHatching: true,
        }));
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
        addScore(lastClosurePoints);
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
            devil.room = region < 0 ? 0 : field.regionSize(region) / starveSize;
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
            const point = field.findFencePoint({ row: farmhand.pointRow, col: farmhand.pointCol, which: 'nearest' });
            if (point !== undefined) farmhand.moveTo(point.row, point.col);
        }
        for (let i = 0; i < beetles.length; i++) {
            const beetle = beetles[i];
            const row = Math.round(beetle.row);
            const col = Math.round(beetle.col);
            if (field.isOnFence(row, col)) continue;
            const clearOf = { row: farmhand.pointRow, col: farmhand.pointCol, distance: SAFE_DISTANCE };
            const point = field.findFencePoint({ row, col, which: 'nearest', clearOf })
                ?? field.findFencePoint({ row: farmhand.pointRow, col: farmhand.pointCol, which: 'farthest' });
            if (point !== undefined) beetle.moveTo(point.row, point.col);
        }
    }

    /** Adds `points` to the score, with a life for each `extraLifePoints` mark it passes. */
    function addScore(points: number): void {
        const marksBefore = Math.floor(score / extraLifePoints);
        score += points;
        const earned = Math.floor(score / extraLifePoints) - marksBefore;
        lives += earned;
        extraLivesEarned += earned;
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
            if (devil.phase === 'whirling' && farmhand.isWireWithin(devil.row, devil.col, devil.radius)) return true;
        }
        return false;
    }

    function snapFarmhand(): void {
        farmhand.snap();
        lives--;
        enterPhase('snapped');
        phaseTimeline.clear().time(0);
        phaseTimeline.call(lives > 0 ? carryOn : endGame, undefined, SNAPPED_MS * 0.001);
    }

    /** Puts the farmhand back on the fence, and any beetle near them at the far side of the meadow. */
    function carryOn(): void {
        farmhand.respawn();
        const point = field.findFencePoint({ row: farmhand.pointRow, col: farmhand.pointCol, which: 'farthest' });
        if (point !== undefined) {
            for (let i = 0; i < beetles.length; i++) {
                const beetle = beetles[i];
                if (measureDistanceSquared(beetle.row, beetle.col, farmhand.row, farmhand.col) > SAFE_DISTANCE * SAFE_DISTANCE) continue;
                beetle.moveTo(point.row, point.col);
            }
        }
        enterPhase('playing');
    }

    function endGame(): void {
        enterPhase('game-over');
    }

    // ---- Rounds ------------------------------------------------------------

    function clearRound(): void {
        enterPhase('round-clear');
        const percentOver = Math.floor((field.claimedShare - config.targetShare) * 100 + 1e-9);
        roundBonus = Math.max(0, percentOver) * BONUS_PER_PERCENT;
        addScore(roundBonus);
        for (let i = 0; i < sheep.length; i++) sheep[i].lose();
        phaseTimeline.clear().time(0);
        phaseTimeline.call(round % rounds.length === 0 ? fenceFarm : nextRound, undefined, ROUND_CLEAR_MS * 0.001);
    }

    /** The farm's last round is cleared, so the whole farm is fenced. */
    function fenceFarm(): void {
        enterPhase('farm-fenced');
        phaseTimeline.clear().time(0);
        phaseTimeline.call(nextRound, undefined, FARM_FENCED_MS * 0.001);
    }

    function nextRound(): void {
        round++;
        loadRound();
    }

    function loadRound(): void {
        config = rounds[(round - 1) % rounds.length];
        speed = FARM_SPEED_UP ** (findFarm(round) - 1);
        field = createFieldModel({ rows, cols, obstacles: config.obstacles });
        farmhand = buildFarmhand();
        devils = placeDevils({ field, config, random, target: devilTarget });
        measureDevilRooms();
        beetles = placeBeetles({ field, config });
        sheep = placeSheep({ field, config, random, devils: () => devils });
        sheepPennedThisRound = 0;
        hatchMs = 0;
        enterPhase('ready');
        phaseTimeline.clear().time(0);
        phaseTimeline.call(startPlaying, undefined, READY_MS * 0.001);
    }

    function startPlaying(): void {
        enterPhase('playing');
    }

    function enterPhase(next: GamePhase): void {
        phase = next;
        phaseMs = 0;
    }

    /** Returns the farm that round `roundNumber` is on, counting from 1. */
    function findFarm(roundNumber: number): number {
        return Math.floor((roundNumber - 1) / rounds.length) + 1;
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
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * How far, in grid steps, a beetle must be from the farmhand as they come
 * back, or it is moved away. A beetle moved off new pasture lands at least
 * this far from them too.
 */
const SAFE_DISTANCE = 15;
