import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createMetronome, createReaction, increased } from '@mvtjs/utils';
import type { MusicChip, SfxChip } from '#shared';
import {
    BASE_DESTROYED, BASE_SIREN, BOMB_DROP, EXPLOSION, FUEL_ALARM, GAME_OVER, LAUNCH, REFUEL, ROCKET_LAUNCH, RUN_CLEAR, SAUCER,
    SHIP_CRASH, SHOT,
} from '../data';
import type { GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `GameAudioView` plays on, and the state it plays the sounds of. */
export interface GameAudioViewBindings {
    /** The chip the music plays on. It is the view's output, so the view reads it once. */
    readonly music: MusicChip<'audio80'>;
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio80'>;
    /** The game's phase. The view starts and stops the music as it changes. */
    readonly phase: () => GamePhase;
    /** Shots fired this game. The view plays a shot each time the count rises. */
    readonly shotsFired: () => number;
    /** Bombs dropped this game. The view plays a falling whistle each time the count rises. */
    readonly bombsDropped: () => number;
    /** Rockets launched this game. The view plays a launch each time the count rises. */
    readonly rocketsLaunched: () => number;
    /** Enemies destroyed by the ship's shots and bombs this game. The view plays an explosion each time the count rises. */
    readonly enemiesDestroyed: () => number;
    /** Fuel tanks destroyed this game. The view plays a refuelling chime each time the count rises. */
    readonly fuelTanksDestroyed: () => number;
    /** Times the base has been destroyed this game. The view plays a blast each time the count rises. */
    readonly basesDestroyed: () => number;
    /** The fuel left, from 0 to 1. While it is low, the alarm beeps, and faster as it runs out. */
    readonly fuel: () => number;
    /** How many saucers are in the air. While there are any, they warble. */
    readonly saucersFlying: () => number;
    /** Whether the scroll is held at the base, waiting for the base to be destroyed. While it is, the siren sounds. */
    readonly isWaitingAtBase: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's music and sounds. It plays a march as each run starts, a
 * fanfare as a run is cleared, and a slow tune as the game ends. It plays the
 * ship's shots, bombs and crash, rockets launching, enemies and the base
 * blowing up, and a chime as fuel is taken on. Three sounds repeat while their
 * cause lasts. They are the low-fuel alarm, the saucers' warble and the base's
 * siren.
 *
 * The repeats are the view's presentation state. Each is timed by a
 * metronome, which counts beats in the view's update step, so the repeats
 * stop while the game is paused. The chip's own sequencer keeps the song's
 * place, and it pauses with the game too. The refresh step plays a sound each
 * time a count rises, the metronomes' and the model's alike.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { music, sfx } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const fuelAlarm = createMetronome();
    const saucers = createMetronome();
    const siren = createMetronome();
    const playSoundsWhenPhaseChanges = createReaction({ watch: bindings.phase, react: playPhase });
    // A rise in a count is one event, which plays the sound beside it. A count going back to 0 for a new game is
    // not a rise. Each reads its count as it's made, so the first refresh hears a rise from the first tick, such as a
    // rocket that launches at once
    const counts = [
        { count: bindings.shotsFired, sound: SHOT },
        { count: bindings.bombsDropped, sound: BOMB_DROP },
        { count: bindings.rocketsLaunched, sound: ROCKET_LAUNCH },
        { count: bindings.enemiesDestroyed, sound: EXPLOSION },
        { count: bindings.fuelTanksDestroyed, sound: REFUEL },
        { count: bindings.basesDestroyed, sound: BASE_DESTROYED },
        { count: () => fuelAlarm.count, sound: FUEL_ALARM },
        { count: () => saucers.count, sound: SAUCER },
        { count: () => siren.count, sound: BASE_SIREN },
    ];
    const playEachCountsSoundWhenItRises = createReaction({
        watch: counts.map((entry) => entry.count),
        when: increased,
        react: (_count, _previous, index) => sfx.play(counts[index].sound),
    });
    // The view is made as the game starts, so the game opens with the march
    playPhase(bindings.phase(), undefined);

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        const isPlaying = bindings.phase() === 'playing';
        fuelAlarm.periodMs = isPlaying ? computeAlarmPeriodMs(bindings.fuel()) : 0;
        fuelAlarm.update(deltaMs);
        saucers.periodMs = isPlaying && bindings.saucersFlying() > 0 ? WARBLE_MS : 0;
        saucers.update(deltaMs);
        siren.periodMs = isPlaying && bindings.isWaitingAtBase() ? SIREN_MS : 0;
        siren.update(deltaMs);
    }

    function refresh(): void {
        playSoundsWhenPhaseChanges();
        playEachCountsSoundWhenItRises();
    }

    function playPhase(phase: GamePhase, previous: GamePhase | undefined): void {
        switch (phase) {
            case 'playing':
                // A new game or a new run starts with the march. The ship coming back does not
                if (previous !== 'respawning') music.play(LAUNCH);
                break;
            case 'dying':
                music.stop();
                sfx.play(SHIP_CRASH);
                break;
            case 'section-clear':
                music.play(RUN_CLEAR);
                break;
            case 'game-over':
                music.play(GAME_OVER);
                break;
            case 'respawning':
                break;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** With less fuel than this, the alarm beeps. */
const LOW_FUEL = 0.25;
/** With less fuel than this, the alarm beeps faster. */
const VERY_LOW_FUEL = 0.1;
/** The time between the alarm's beeps with fuel low, in ms. */
const SLOW_ALARM_MS = 500;
/** The time between the alarm's beeps with fuel very low, in ms. */
const FAST_ALARM_MS = 250;
/** The time between the saucers' warbles, in ms. */
const WARBLE_MS = 260;
/** The time between the siren's rises, in ms. */
const SIREN_MS = 700;

/** Returns the time between the alarm's beeps with this much fuel, or 0 for no alarm. */
function computeAlarmPeriodMs(fuel: number): number {
    if (fuel >= LOW_FUEL) return 0;
    return fuel < VERY_LOW_FUEL ? FAST_ALARM_MS : SLOW_ALARM_MS;
}
