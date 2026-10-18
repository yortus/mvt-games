import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_FIELD, DIGGER_SPAWN, FIELD_COLS, FIELD_ROWS, LEVELS } from '../data';
import type { EnemyModel } from './enemy-model';
import { createGameModel, type GameModel, type SavedGame } from './game-model';

const TICK_MS = 1000 / 60;
/** Long enough for the creatures to catch a digger that stands still, three times over. */
const LONGEST_RUN_MS = 120_000;

describe('GameModel: pumping', () => {
    beforeEach(seedRandom);
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('pumps a hooked creature once for each pump, and not for keeping the harpoon out', () => {
        const model = createModel();
        const hooked = hookCreature(model);
        // Keeping the harpoon out holds the creature, but never pumps it up
        model.isHarpoonOut = true;
        let stage = hooked.inflationStage;
        for (let i = 0; i < 30; i++) {
            model.update(TICK_MS);
            expect(hooked.inflationStage).toBeLessThanOrEqual(stage);
            stage = hooked.inflationStage;
        }
        // Two pumps between the same two updates make one
        model.pump();
        model.pump();
        model.update(TICK_MS);
        expect(hooked.inflationStage).toBe(stage + 1);
    });
});

describe('GameModel: starting a new game', () => {
    beforeEach(seedRandom);
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts a new game asked for once the game is over, and drops one asked for during play', () => {
        const model = createModel();
        // The digger stands still on the surface until the creatures catch it
        model.startNewRun();
        for (let i = 0; i * TICK_MS < LONGEST_RUN_MS && model.phase !== 'game-over'; i++) {
            model.update(TICK_MS);
        }
        expect(model.phase).toBe('game-over');
        // The ask made during play was dropped, not kept for later
        model.update(TICK_MS);
        expect(model.phase).toBe('game-over');

        model.startNewRun();
        expect(model.phase).toBe('game-over');
        model.update(TICK_MS);
        expect(model.phase).toBe('playing');
        expect(model.lives).toBe(createModel().lives);
        expect(model.level).toBe(1);
    });
});

describe('GameModel: saving', () => {
    beforeEach(seedRandom);
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('saves nothing while the game is at its start, since resuming would only start it again', () => {
        const model = createModel();
        expect(model.save()).toBeUndefined();
        // Points won in the first level are won again on resuming, so its start is still the checkpoint
        playUntilScored(model);
        expect(model.phase).toBe('playing');
        expect(model.score).toBeGreaterThan(0);
        expect(model.save()).toBeUndefined();
    });

    it('saves a level part way through as of its start, with the score it had then', () => {
        const saved = saveAtFirstLevelClear();
        const model = createModel();
        expect(model.load(saved)).toBe(true);
        playUntilScored(model);
        expect(model.phase).toBe('playing');
        expect(model.score).toBeGreaterThan(saved.score);
        expect(model.save()).toMatchObject({ level: saved.level, score: saved.score, lives: model.lives });
    });

    it('saves a level just cleared as the start of the next, and loads it there', () => {
        const model = createModel();
        clearFirstLevel(model);
        const saved = model.save();
        expect(model.score).toBeGreaterThan(0);
        expect(saved).toMatchObject({ level: 2, score: model.score, lives: model.lives });

        const loaded = createModel();
        expect(loaded.load(JSON.parse(JSON.stringify(saved)))).toBe(true);
        expect(loaded.phase).toBe('playing');
        expect(loaded.level).toBe(2);
        expect(loaded.score).toBe(model.score);
        expect(loaded.lives).toBe(model.lives);
        expect(loaded.enemies.length).toBe(LEVELS[1].enemySpawns.length);
    });

    it('keeps a life lost, counting a death under way, and saves nothing once the last is lost', () => {
        const saved = saveAtFirstLevelClear();
        const model = createModel();
        model.load(saved);
        let deaths = 0;
        let wasDying = false;
        // The digger stands still on the surface until the creatures catch it
        for (let i = 0; i * TICK_MS < LONGEST_RUN_MS && model.phase !== 'game-over'; i++) {
            model.update(TICK_MS);
            const isDying = model.phase === 'dying';
            if (isDying && !wasDying) {
                deaths++;
                const dyingSave = model.save();
                if (model.lives > 1) expect(dyingSave).toMatchObject({ level: saved.level, lives: model.lives - 1 });
                else expect(dyingSave).toBeUndefined();
            }
            wasDying = isDying;
            if (model.phase === 'playing') expect(model.save()).toMatchObject({ level: saved.level, lives: model.lives });
        }
        expect(deaths).toBe(saved.lives);
        expect(model.phase).toBe('game-over');
        expect(model.save()).toBeUndefined();
    });

    it('loads nothing that is not a saved game, and plays on as it was', () => {
        const saved = saveAtFirstLevelClear();
        const model = createModel();
        const startLives = model.lives;
        const enemies = model.enemies;
        const rejects: unknown[] = [
            undefined,
            'saved',
            {},
            { ...saved, version: 0 },
            { ...saved, level: 0 },
            { ...saved, level: 1.5 },
            { ...saved, level: '2' },
            { ...saved, score: 1.5 },
            { ...saved, score: -1 },
            { ...saved, lives: 0 },
            { ...saved, lives: startLives + 1 },
        ];
        for (let i = 0; i < rejects.length; i++) {
            expect(model.load(rejects[i]), `save ${i}`).toBe(false);
        }
        expect(model.level).toBe(1);
        expect(model.score).toBe(0);
        expect(model.lives).toBe(startLives);
        // The level was not started again
        expect(model.enemies).toBe(enemies);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeds the random numbers, so the creatures patrol the same way on every run. */
function seedRandom(): void {
    let state = 12345;
    vi.spyOn(Math, 'random').mockImplementation(() => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    });
}

function createModel(): GameModel {
    return createGameModel({
        levels: LEVELS,
        fieldCols: FIELD_COLS,
        fieldRows: FIELD_ROWS,
        baseLayout: BASE_FIELD,
        diggerSpawn: DIGGER_SPAWN,
    });
}

/**
 * Digs straight down from the spawn to the tile above the first tunnel, then
 * pumps down into the tunnel in bursts, until the digger scores or the game
 * leaves play.
 */
function playUntilScored(model: GameModel): void {
    const startScore = model.score;
    const pumpRow = findTunnelBelowSpawn() - 1;
    for (let i = 0; i * TICK_MS < LONGEST_RUN_MS && model.phase === 'playing' && model.score === startScore; i++) {
        const isDugIn = model.digger.row >= pumpRow;
        model.direction = isDugIn ? 'none' : 'down';
        // Each burst holds the harpoon out, and pumps as it starts
        model.isHarpoonOut = isDugIn && i % 8 < 4;
        if (isDugIn && i % 8 === 0) model.pump();
        model.update(TICK_MS);
    }
    model.isHarpoonOut = false;
}

/**
 * Digs down and shoots the harpoon in bursts as `playUntilScored` does, but
 * never pumps, until it hooks a creature, and returns that creature.
 */
function hookCreature(model: GameModel): EnemyModel {
    const pumpRow = findTunnelBelowSpawn() - 1;
    for (let i = 0; i * TICK_MS < LONGEST_RUN_MS && model.phase === 'playing'; i++) {
        const isDugIn = model.digger.row >= pumpRow;
        model.direction = isDugIn ? 'none' : 'down';
        model.isHarpoonOut = isDugIn && i % 8 < 4;
        model.update(TICK_MS);
        for (let j = 0; j < model.enemies.length; j++) {
            if (model.enemies[j].inflationStage > 0) return model.enemies[j];
        }
    }
    throw new Error('The harpoon hooked no creature');
}

/** Scores in the first level, then pops every creature left, which clears it. */
function clearFirstLevel(model: GameModel): void {
    playUntilScored(model);
    expect(model.phase).toBe('playing');
    popEveryCreature(model);
    model.update(TICK_MS);
    expect(model.phase).toBe('level-clear');
}

/** Returns the save of a new game whose first level was just cleared: the start of the second, with a score. */
function saveAtFirstLevelClear(): SavedGame {
    const model = createModel();
    clearFirstLevel(model);
    const saved = model.save();
    if (saved === undefined) throw new Error('A level just cleared saves the next');
    return saved;
}

function popEveryCreature(model: GameModel): void {
    for (let i = 0; i < model.enemies.length; i++) {
        const enemy = model.enemies[i];
        while (enemy.isAlive) enemy.inflate();
    }
}

/** Returns the row of the first tunnel straight below the digger's spawn. */
function findTunnelBelowSpawn(): number {
    const [spawnRow, spawnCol] = DIGGER_SPAWN;
    for (let row = spawnRow + 1; row < FIELD_ROWS; row++) {
        if (BASE_FIELD[row * FIELD_COLS + spawnCol] === 'tunnel') return row;
    }
    throw new Error('No tunnel below the spawn');
}
