import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createMetronome, createReaction, increased } from '@mvtjs/utils';
import type { Audio80 } from 'audio90';
import { BEAT } from './sounds';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HeartbeatViewBindings {
    /** What the view plays its sounds on. The view reads it once. */
    readonly sfx: Pick<Audio80, 'play'>;
    readonly rocksLeft: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A heartbeat that quickens as the rocks thin out, and stops when none are
 * left. The model keeps no beat, so the beat is this view's presentation
 * state: a metronome, whose period the update step sets from the rocks
 * left. The refresh step plays a sound each time the count rises. A heart
 * on the screen swells and shrinks on alternate beats too, so you can see
 * the beat with the sound off.
 */
export function HeartbeatView(bindings: HeartbeatViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    const heart = new Graphics();
    heart.circle(-10, -6, 12).circle(10, -6, 12).poly([-21, 0, 21, 0, 0, 24]).fill(0xff4d6d);
    heart.position.set(70, 70);
    view.addChild(heart);

    const heartbeat = createMetronome();
    const playHeartbeatSoundOnEachBeat = createReaction({
        watch: () => heartbeat.count,
        when: increased,
        react: () => sfx.play(BEAT),
    });

    setUpdate(view, (deltaMs) => {
        heartbeat.periodMs = computeBeatPeriodMs(bindings.rocksLeft());
        heartbeat.update(deltaMs);
    });
    setRefresh(view, () => {
        playHeartbeatSoundOnEachBeat();
        heart.scale.set(heartbeat.count % 2 === 1 ? 1.5 : 1);
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The time between beats, in ms: shorter as the rocks thin out, and 0, which stops it, with none left. */
function computeBeatPeriodMs(rocksLeft: number): number {
    return rocksLeft === 0 ? 0 : 250 + rocksLeft * 90;
}
