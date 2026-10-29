import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { Audio90PlayOptions, Audio90Sound } from 'audio90';
import { createHeadlessAudio90, type HeadlessAudio90 } from 'audio90/headless';
import {
    ALL_CLEAR, ATTACK_BROKEN, BOMB, BOMB_PICKUP, BOSS_HIT, BOSS_THEME, CHARGE_TONES, EXPLODE_HUGE, EXPLODE_LARGE, EXPLODE_SMALL,
    EXTEND, FOCUS, FOCUSED_SHOT, GAME_OVER, GEM, type ItemKind, LOCK_TICK, LOCKED, POWER_UP, RESPAWN, RING_UP, SHIELD_HIT,
    SHIP_EXPLODE, SHOT, STAGE_CLEAR, STAGE_THEME, VOLLEY_BURST, VOLLEY_CHARGED, VOLLEY_LAUNCH, WARNING,
} from '../data';
import type { BossPhase, ExplosionSize, GamePhase, VolleyPhase } from '../models';
import { GameAudioView } from './game-audio-view';

// The view is tested by what it asks of its chips: which songs and sounds it plays, and where. How a chip plays a
// song is the chip's own concern, tested with it.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameAudioView', () => {
    it('starts the stage\'s theme as the game starts', () => {
        const { music } = setUp();
        expect(listPlayed(music)).toEqual([STAGE_THEME]);
    });

    for (const previous of ['tally', 'game-over', 'all-clear'] as const) {
        it(`starts the stage's theme again as play follows the ${previous} phase`, () => {
            const { music, state, tick } = setUp();
            state.phase = previous;
            tick();
            vi.clearAllMocks();
            state.phase = 'playing';
            tick();
            expect(listPlayed(music)).toEqual([STAGE_THEME]);
        });
    }

    for (const [phase, song] of [['tally', STAGE_CLEAR], ['game-over', GAME_OVER], ['all-clear', ALL_CLEAR]] as const) {
        it(`plays its own song as the game turns to the ${phase} phase`, () => {
            const { music, state, tick } = setUp();
            vi.clearAllMocks();
            state.phase = phase;
            tick();
            expect(listPlayed(music)).toEqual([song]);
        });
    }

    it('plays the guns\' first blip in the game\'s first tick', () => {
        const { sfx } = setUp({ isFiring: true });
        expect(listPlayedOf(sfx, SHOT)).toHaveLength(1);
    });

    it('patters while the guns fire, focused or not, and stops when they stop', () => {
        const { sfx, state, tick } = setUp();
        state.isFiring = true;
        tickFor(tick, 1000);
        expect(listPlayedOf(sfx, SHOT).length).toBeGreaterThan(3);
        state.isFocused = true;
        tickFor(tick, 1000);
        expect(listPlayedOf(sfx, FOCUSED_SHOT).length).toBeGreaterThan(3);
        state.isFiring = false;
        vi.clearAllMocks();
        tickFor(tick, 1000);
        expect(listPlayedOf(sfx, SHOT)).toHaveLength(0);
        expect(listPlayedOf(sfx, FOCUSED_SHOT)).toHaveLength(0);
    });

    it('sweeps down as the ship focuses in play, and not as it lets go or after the game ends', () => {
        const { sfx, state, tick } = setUp();
        state.isFocused = true;
        tick();
        state.isFocused = false;
        tick();
        expect(listPlayedOf(sfx, FOCUS)).toHaveLength(1);
        state.phase = 'all-clear';
        tick();
        state.isFocused = true;
        tick();
        expect(listPlayedOf(sfx, FOCUS)).toHaveLength(1);
    });

    it('plays each explosion by its size', () => {
        const { sfx, state, tick } = setUp();
        const sizes: readonly ExplosionSize[] = ['small', 'large', 'huge'];
        for (const size of sizes) {
            state.lastExplosionSize = size;
            state.explosionsStarted++;
            tick();
        }
        expect(listPlayed(sfx)).toEqual([EXPLODE_SMALL, EXPLODE_LARGE, EXPLODE_HUGE]);
    });

    it('plays the ship\'s loss instead of its explosion, then its return, with the music playing on', () => {
        const { music, sfx, state, tick } = setUp();
        vi.clearAllMocks();
        state.phase = 'dying';
        state.lastExplosionSize = 'large';
        state.explosionsStarted++;
        tick();
        expect(listPlayedOf(sfx, SHIP_EXPLODE)).toHaveLength(1);
        expect(listPlayedOf(sfx, EXPLODE_LARGE)).toHaveLength(0);

        state.phase = 'playing';
        tick();
        expect(listPlayedOf(sfx, RESPAWN)).toHaveLength(1);
        // The theme neither stops nor starts again
        expect(music.stop).not.toHaveBeenCalled();
        expect(music.play).not.toHaveBeenCalled();
    });

    it('chimes for each extra life, even one earned as the stage is cleared', () => {
        const { sfx, state, tick } = setUp();
        state.extendsEarned++;
        tick();
        expect(listPlayedOf(sfx, EXTEND)).toHaveLength(1);

        state.phase = 'tally';
        state.extendsEarned++;
        tick();
        expect(listPlayedOf(sfx, EXTEND)).toHaveLength(2);
    });

    it('plays a sound for each kind of pickup, a gem and a bomb', () => {
        const { sfx, state, tick } = setUp();
        const pickUp = (kind: ItemKind): void => {
            state.lastItemKind = kind;
            state.itemsCollected++;
            tick();
        };
        pickUp('power');
        pickUp('bomb');
        state.gemsCollected += 5;
        state.isBombing = true;
        tick();
        expect(listPlayedOf(sfx, POWER_UP)).toHaveLength(1);
        expect(listPlayedOf(sfx, BOMB_PICKUP)).toHaveLength(1);
        expect(listPlayedOf(sfx, GEM)).toHaveLength(1);
        expect(listPlayedOf(sfx, BOMB)).toHaveLength(1);
    });

    it('stops the theme and sounds the warning as it starts, sounds it again while it shows, then plays the boss\'s theme', () => {
        const { music, sfx, state, tick } = setUp();
        vi.clearAllMocks();
        runWarning(state, tick, TICK_MS);
        expect(music.stop).toHaveBeenCalledTimes(1);
        expect(listPlayedOf(sfx, WARNING)).toHaveLength(1);
        runWarning(state, tick, 2000);
        expect(listPlayedOf(sfx, WARNING).length).toBeGreaterThan(2);

        state.warningElapsedMs = -1;
        state.bossPhase = 'entering';
        vi.clearAllMocks();
        tickFor(tick, 500);
        expect(listPlayedOf(sfx, WARNING)).toHaveLength(0);
        expect(listPlayed(music)).toEqual([BOSS_THEME]);
    });

    it('stops sounding the warning when the game ends during it', () => {
        const { sfx, state, tick } = setUp();
        runWarning(state, tick, 500);
        // The game stops, and its warning timer with it, but the views still tick
        state.phase = 'game-over';
        tick();
        vi.clearAllMocks();
        tickFor(tick, 3000);
        expect(listPlayedOf(sfx, WARNING)).toHaveLength(0);
    });

    it('ticks while shots land on the boss, and plays a break as an attack ends', () => {
        const { sfx, state, tick } = setUp();
        state.bossPhase = 'attacking';
        state.bossMsSinceHit = 0;
        tickFor(tick, 500);
        expect(listPlayedOf(sfx, BOSS_HIT).length).toBeGreaterThan(2);
        state.bossMsSinceHit = Infinity;
        state.bossPhase = 'breaking';
        vi.clearAllMocks();
        tickFor(tick, 500);
        expect(listPlayedOf(sfx, BOSS_HIT)).toHaveLength(0);
        expect(listPlayedOf(sfx, ATTACK_BROKEN)).toHaveLength(1);
    });

    it('plays a break and stops the music as the last attack ends', () => {
        const { music, sfx, state, tick } = setUp({ bossPhase: 'attacking' });
        vi.clearAllMocks();
        state.bossPhase = 'exploding';
        tick();
        expect(listPlayedOf(sfx, ATTACK_BROKEN)).toHaveLength(1);
        expect(music.stop).toHaveBeenCalledTimes(1);
    });

    it('plays each sound where it happens: the ship\'s where the ship is, the boss\'s where the boss is, and each explosion where it went off', () => {
        const { sfx, state, tick } = setUp({ shipX: 0, bossX: ARENA / 2, lastExplosionX: ARENA });
        state.volleyShieldHits++;
        state.lastExplosionSize = 'small';
        state.explosionsStarted++;
        state.bossPhase = 'breaking';
        state.isBombing = true;
        tick();
        const panOf = (effect: Audio90Sound) => listPlayOptionsOf(sfx, effect)[0]?.pan;
        expect(panOf(SHIELD_HIT)).toBeLessThan(-0.5);
        expect(panOf(EXPLODE_SMALL)).toBeGreaterThan(0.5);
        expect(panOf(ATTACK_BROKEN)).toBeCloseTo(0, 9);
        // A bomb fills the screen, so it plays in the middle
        expect(listPlayedOf(sfx, BOMB)).toHaveLength(1);
        expect(panOf(BOMB)).toBeUndefined();
    });

    it('chimes as the volley charges, ticks faster as it locks on, chirps once locked, then rushes out and bursts', () => {
        const { sfx, state, tick } = setUp({ volleyBurstX: ARENA });
        state.volleyPhase = 'ready';
        tick();
        expect(listPlayedOf(sfx, VOLLEY_CHARGED)).toHaveLength(1);

        state.volleyPhase = 'locking';
        const tickTimes: number[] = [];
        for (let i = 0; i < 60; i++) {
            state.volleyLockProgress = i / 60;
            const before = listPlayedOf(sfx, LOCK_TICK).length;
            tick();
            if (listPlayedOf(sfx, LOCK_TICK).length > before) tickTimes.push(i);
        }
        expect(tickTimes.length).toBeGreaterThan(4);
        const firstGap = tickTimes[1] - tickTimes[0];
        const lastGap = tickTimes[tickTimes.length - 1] - tickTimes[tickTimes.length - 2];
        expect(lastGap).toBeLessThan(firstGap);

        state.volleyPhase = 'locked';
        state.volleyLockProgress = 1;
        tick();
        expect(listPlayedOf(sfx, LOCKED)).toHaveLength(1);
        vi.clearAllMocks();
        tickFor(tick, 500);
        expect(listPlayedOf(sfx, LOCK_TICK)).toHaveLength(0);

        state.volleyPhase = 'flying';
        state.volleysFired++;
        tick();
        expect(listPlayedOf(sfx, VOLLEY_LAUNCH)).toHaveLength(1);
        state.volleyPhase = 'charging';
        state.volleyBursts++;
        tick();
        expect(listPlayOptionsOf(sfx, VOLLEY_BURST)[0]?.pan).toBeGreaterThan(0.5);
        expect(listPlayedOf(sfx, VOLLEY_CHARGED)).toHaveLength(0);
    });

    it('sounds a tone on and on while the volley charges, rising as the bar fills, and none while it does not', () => {
        const { sfx, state, tick } = setUp();
        state.isVolleyFilling = true;
        tickFor(tick, 500);
        const lowTones = listPlayedOf(sfx, CHARGE_TONES[0]).length;
        expect(lowTones).toBeGreaterThan(5);

        state.volleyCharge = 1;
        tickFor(tick, 200);
        expect(listPlayedOf(sfx, CHARGE_TONES[CHARGE_TONES.length - 1]).length).toBeGreaterThan(0);

        state.isVolleyFilling = false;
        vi.clearAllMocks();
        tickFor(tick, 500);
        for (let i = 0; i < CHARGE_TONES.length; i++) expect(listPlayedOf(sfx, CHARGE_TONES[i])).toHaveLength(0);
    });

    it('sweeps up as the ring forms, and tinks as it stops each bullet', () => {
        const { sfx, state, tick } = setUp();
        state.isVolleyRingUp = true;
        tick();
        expect(listPlayedOf(sfx, RING_UP)).toHaveLength(1);
        state.volleyShieldHits++;
        tick();
        state.volleyShieldHits++;
        tick();
        expect(listPlayedOf(sfx, SHIELD_HIT)).toHaveLength(2);
        expect(listPlayedOf(sfx, RING_UP)).toHaveLength(1);
    });

    it('plays no chime for a full bar that a lock let go of', () => {
        const { sfx, state, tick } = setUp({ volleyPhase: 'locking' });
        state.volleyPhase = 'ready';
        tick();
        expect(listPlayedOf(sfx, VOLLEY_CHARGED)).toHaveLength(0);
    });

    it('plays nothing for the counts\' starting values', () => {
        const { sfx } = setUp({
            volleyShieldHits: 4, explosionsStarted: 12, itemsCollected: 3, gemsCollected: 90, extendsEarned: 1, volleysFired: 2, volleyBursts: 2,
        });
        expect(listPlayed(sfx)).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The arena's width, which the places across it are measured in. */
const ARENA = 240;

interface State {
    phase: GamePhase;
    extendsEarned: number;
    isBombing: boolean;
    warningElapsedMs: number;
    bossPhase: BossPhase;
    bossMsSinceHit: number;
    isFiring: boolean;
    isFocused: boolean;
    explosionsStarted: number;
    lastExplosionSize: ExplosionSize | undefined;
    itemsCollected: number;
    lastItemKind: ItemKind | undefined;
    gemsCollected: number;
    isVolleyFilling: boolean;
    volleyCharge: number;
    isVolleyRingUp: boolean;
    volleyShieldHits: number;
    volleyPhase: VolleyPhase;
    volleyLockProgress: number;
    volleysFired: number;
    volleyBursts: number;
    volleyBurstX: number;
    shipX: number;
    bossX: number;
    lastExplosionX: number;
}

/**
 * Makes the view for a game that has just started, and runs its first tick.
 * Returns the chips it plays on, the state its bindings read, and a function
 * that runs one more tick.
 */
function setUp(initial: Partial<State> = {}) {
    const state: State = {
        phase: 'playing', extendsEarned: 0, isBombing: false, warningElapsedMs: -1, bossPhase: 'absent',
        bossMsSinceHit: Infinity, isFiring: false, isFocused: false, explosionsStarted: 0,
        lastExplosionSize: undefined, itemsCollected: 0, lastItemKind: undefined, gemsCollected: 0,
        isVolleyFilling: false, volleyCharge: 0, isVolleyRingUp: false, volleyShieldHits: 0,
        volleyPhase: 'charging', volleyLockProgress: 0, volleysFired: 0, volleyBursts: 0, volleyBurstX: ARENA / 2,
        shipX: ARENA / 2, bossX: ARENA / 2, lastExplosionX: ARENA / 2, ...initial,
    };
    // The chips are spied on before the view is made, since the view starts the stage's theme as it is made
    const music = createSpiedChip();
    const sfx = createSpiedChip();
    const view = GameAudioView({
        music,
        sfx,
        phase: () => state.phase,
        extendsEarned: () => state.extendsEarned,
        isBombing: () => state.isBombing,
        warningElapsedMs: () => state.warningElapsedMs,
        bossPhase: () => state.bossPhase,
        bossMsSinceHit: () => state.bossMsSinceHit,
        isFiring: () => state.isFiring,
        isFocused: () => state.isFocused,
        explosionsStarted: () => state.explosionsStarted,
        lastExplosionSize: () => state.lastExplosionSize,
        itemsCollected: () => state.itemsCollected,
        lastItemKind: () => state.lastItemKind,
        gemsCollected: () => state.gemsCollected,
        isVolleyFilling: () => state.isVolleyFilling,
        volleyCharge: () => state.volleyCharge,
        isVolleyRingUp: () => state.isVolleyRingUp,
        volleyShieldHits: () => state.volleyShieldHits,
        volleyPhase: () => state.volleyPhase,
        volleyLockProgress: () => state.volleyLockProgress,
        volleysFired: () => state.volleysFired,
        volleyBursts: () => state.volleyBursts,
        volleyBurstX: () => state.volleyBurstX,
        shipX: () => state.shipX,
        bossX: () => state.bossX,
        lastExplosionX: () => state.lastExplosionX,
        arenaWidth: ARENA,
    });
    // One tick as the Arcade runs it: the chips' clocks, then the view's update and refresh
    const tick = (): void => {
        music.update(TICK_MS);
        sfx.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
    tick();
    return { music, sfx, state, tick };
}

function runTicks(tick: () => void, count: number): void {
    for (let i = 0; i < count; i++) tick();
}

/** Runs ticks for about `totalMs`. */
function tickFor(tick: () => void, totalMs: number): void {
    runTicks(tick, Math.round(totalMs / TICK_MS));
}

/** Runs ticks for about `totalMs` with the warning showing, advancing its timer as the model does. */
function runWarning(state: State, tick: () => void, totalMs: number): void {
    const count = Math.round(totalMs / TICK_MS);
    for (let i = 0; i < count; i++) {
        state.warningElapsedMs = Math.max(0, state.warningElapsedMs) + TICK_MS;
        tick();
    }
}

/** Creates a headless chip whose `play`, `queue` and `stop` are spied on, so a test can read what a view asked of it. */
function createSpiedChip(): HeadlessAudio90 {
    const chip = createHeadlessAudio90();
    vi.spyOn(chip, 'play');
    vi.spyOn(chip, 'queue');
    vi.spyOn(chip, 'stop');
    return chip;
}

/** The songs and sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio90): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}

/** Each play of `sound` on `chip`. */
function listPlayedOf(chip: HeadlessAudio90, sound: Audio90Sound): unknown[] {
    return listPlayed(chip).filter((played) => played === sound);
}

/** The options each play of `sound` on `chip` was given, oldest first, or undefined for a play given none. */
function listPlayOptionsOf(chip: HeadlessAudio90, sound: Audio90Sound): (Audio90PlayOptions | undefined)[] {
    // `play` is overloaded, and the mock's calls are typed by its last form, a song's, which takes no options
    const calls = vi.mocked(chip.play).mock.calls as unknown as readonly [unknown, Audio90PlayOptions?][];
    return calls.filter((call) => call[0] === sound).map((call) => call[1]);
}
