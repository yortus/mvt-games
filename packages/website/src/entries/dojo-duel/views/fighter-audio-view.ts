import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80, SoundEffect } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { BLOCK, type FighterPhase, HIT, KICK_SWISH, LEAP_SWISH, type MoveKind, PUNCH_SWISH } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `FighterAudioView` plays on, and the fighter's state it plays the sounds of. */
export interface FighterAudioViewBindings {
    /** The chip to play on. It is the view's output, not model state, so the view reads it once. */
    readonly sound: Audio80;
    /** The fighter's phase. The view plays a clack when it changes to 'blocking', and a hit when it changes to 'defeated'. */
    readonly phase: () => FighterPhase;
    /** The move the fighter is making, if any. The view plays a swish when it changes to a move. */
    readonly move: () => MoveKind | undefined;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays one fighter's sounds. It draws nothing. A swish sounds as each move
 * starts. It is short for a punch, longer for a kick, and longest for a move
 * through the air. A clack sounds as the fighter blocks, and a crack and a
 * thud as they are knocked down. The view plays only on a change. A move
 * starts when the fighter's move changes to one. That happens even when the
 * same move is made twice, because the move goes back to none between them.
 */
export function FighterAudioView(bindings: FighterAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'fighter-audio';
    const watcher = watch({ phase: bindings.phase, move: bindings.move });
    // Poll once now, so that the first refresh plays only for changes made
    // after the view is made. A fighter already in a move then makes no sound
    watcher.poll();

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        const move = w.move.value;
        if (w.move.changed && move !== undefined) sound.play(chooseSwish(move));
        if (!w.phase.changed) return;
        if (w.phase.value === 'blocking') sound.play(BLOCK);
        else if (w.phase.value === 'defeated') sound.play(HIT);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns the swish for `move`, which depends on whether it is a punch, a kick or a move through the air. */
function chooseSwish(move: MoveKind): SoundEffect {
    switch (move) {
        case 'high-punch':
        case 'crouch-punch':
        case 'back-lunge-punch':
        case 'back-crouch-punch':
            return PUNCH_SWISH;
        case 'flying-kick':
        case 'front-somersault':
        case 'back-somersault':
        case 'jump':
            return LEAP_SWISH;
        case 'high-kick':
        case 'mid-kick':
        case 'low-kick':
        case 'back-low-kick':
        case 'roundhouse':
        case 'foot-sweep':
            return KICK_SWISH;
    }
}
