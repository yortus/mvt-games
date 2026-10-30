import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { Audio80Sound } from 'audio90';
import { createMetronome, createReaction, increased } from '@mvtjs/utils';
import type { SfxChip } from '#shared';
import {
    BEAT_HIGH, BEAT_LOW, BREAK_LARGE, BREAK_MEDIUM, BREAK_SMALL, FIRE, GAME_OVER, RESPAWN, SHIP_EXPLODE, THRUST,
    WAVE_CLEAR,
} from '../data';
import type { AsteroidSize, GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `GameAudioView` plays on, and the state it plays the sounds of. */
export interface GameAudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio80'>;
    /** The game's phase. The view plays a sound as it changes, and the heartbeat runs only while the ship is in play. */
    readonly phase: () => GamePhase;
    /** Shots fired this game. The view plays a shot each time the count rises. */
    readonly shotsFired: () => number;
    /** Rocks broken this game. The view plays a break each time the count rises. */
    readonly rocksBroken: () => number;
    /** The size of the rock broken last. It chooses which break the view plays. */
    readonly lastBrokenRockSize: () => AsteroidSize | undefined;
    /** The breaks still needed to clear the wave. The fewer there are, the faster the heartbeat. */
    readonly breaksLeft: () => number;
    /** Whether the ship's engine is firing. The engine rumbles while it is. */
    readonly isThrusting: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's sounds. The game has no music. Instead, a heartbeat of two
 * thumps, low and high by turns, quickens with each rock broken in the wave.
 * The engine rumbles while the ship thrusts. The view also plays each shot
 * and each rock breaking, deeper for a bigger rock. It plays the ship's loss
 * and its return, a chime when a wave is cleared, and a knell when the game
 * ends.
 *
 * The heartbeat and the engine's bursts are the view's presentation state.
 * Each is a metronome, which counts beats in the view's update step, so both
 * stop while the game is paused. The refresh step plays a sound each time a
 * count rises, the metronomes' and the model's alike.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'game-audio';

    // Presentation state: the heartbeat, and the engine's bursts
    const heartbeat = createMetronome();
    const engine = createMetronome();

    // Each reads its count as it's made, so the first refresh hears the heartbeat's first beat, which the first update makes
    const playSoundsWhenPhaseChanges = createReaction({ watch: bindings.phase, react: (phase) => playPhase(phase) });
    const playFireSoundOnEachShot = createReaction({
        watch: bindings.shotsFired,
        when: increased,
        react: () => sfx.play(FIRE),
    });
    const playBreakSoundOnEachRockBroken = createReaction({
        watch: bindings.rocksBroken,
        when: increased,
        react: () => sfx.play(chooseBreak(bindings.lastBrokenRockSize())),
    });
    const playHeartbeatSoundOnEachBeat = createReaction({
        watch: () => heartbeat.count,
        when: increased,
        react: (beats) => sfx.play(beats % 2 === 0 ? BEAT_HIGH : BEAT_LOW),
    });
    const playThrustSoundOnEachBurst = createReaction({
        watch: () => engine.count,
        when: increased,
        react: () => sfx.play(THRUST),
    });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        const phase = bindings.phase();
        const isShipInPlay = phase === 'playing' || phase === 'respawning';
        heartbeat.periodMs = isShipInPlay ? computeBeatPeriodMs(bindings.breaksLeft()) : 0;
        heartbeat.update(deltaMs);
        engine.periodMs = phase === 'playing' && bindings.isThrusting() ? THRUST_BURST_MS : 0;
        engine.update(deltaMs);
    }

    function refresh(): void {
        playSoundsWhenPhaseChanges();
        playFireSoundOnEachShot();
        playBreakSoundOnEachRockBroken();
        playHeartbeatSoundOnEachBeat();
        playThrustSoundOnEachBurst();
    }

    function playPhase(phase: GamePhase): void {
        switch (phase) {
            case 'dying':
                sfx.play(SHIP_EXPLODE);
                break;
            case 'respawning':
                sfx.play(RESPAWN);
                break;
            case 'wave-clear':
                sfx.play(WAVE_CLEAR);
                break;
            case 'game-over':
                sfx.play(GAME_OVER);
                break;
            case 'playing':
                break;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The time between the engine's bursts while the ship thrusts, in ms. */
const THRUST_BURST_MS = 80;
/** The time between the heartbeat's beats at its slowest, in ms. */
const SLOWEST_BEAT_MS = 900;
/** The time between the heartbeat's beats at its fastest, with one break left, in ms. */
const FASTEST_BEAT_MS = 260;
/**
 * With this many breaks left or more, the heartbeat is at its slowest. It is
 * a first wave's worth, which is 4 large rocks of 7 breaks each.
 */
const BREAKS_FOR_SLOWEST = 28;

/** Returns the time between beats, which shortens evenly with each break until one is left. */
function computeBeatPeriodMs(breaksLeft: number): number {
    const share = Math.min(1, Math.max(0, (breaksLeft - 1) / (BREAKS_FOR_SLOWEST - 1)));
    return FASTEST_BEAT_MS + (SLOWEST_BEAT_MS - FASTEST_BEAT_MS) * share;
}

/** Returns the sound of a rock of this size breaking. */
function chooseBreak(size: AsteroidSize | undefined): Audio80Sound {
    return size === 'large' ? BREAK_LARGE : size === 'medium' ? BREAK_MEDIUM : BREAK_SMALL;
}
