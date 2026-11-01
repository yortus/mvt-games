import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction, increased } from '@mvtjs/utils';
import type { Audio80 } from 'audio90';
import { SHIP_EXPLODE, SHOT } from './sounds';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipAudioViewBindings {
    /** What the view plays its sounds on. The view reads it once. */
    readonly sfx: Pick<Audio80, 'play'>;
    /** Shots fired this game. Each rise is a shot. */
    readonly shotsFired: () => number;
    readonly isAlive: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An audio view: it draws nothing, and plays a zap each time the ship fires,
 * and a crash as the ship is lost. Each reaction plays on a change, so a
 * refresh with no change plays nothing.
 */
export function ShipAudioView(bindings: ShipAudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    const playShotSoundOnEachShot = createReaction({
        watch: bindings.shotsFired,
        when: increased,
        react: () => sfx.play(SHOT),
    });
    const playExplosionSoundWhenShipIsLost = createReaction({
        watch: bindings.isAlive,
        when: false,
        react: () => sfx.play(SHIP_EXPLODE),
    });

    setRefresh(view, () => {
        playShotSoundOnEachShot();
        playExplosionSoundWhenShipIsLost();
    });
    return view;
}
