import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BeatPulseViewBindings {
    /** Where the music has got to, in beats from the start of its song. */
    readonly beat: () => number;
    /** Where the ring's middle is, read once. */
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A ring that pulses in time with the music. It jumps out on each beat, and
 * shrinks back before the next, so it follows the music as you hear it,
 * even as the music hurries.
 */
export function BeatPulseView(bindings: BeatPulseViewBindings): Container {
    const view = new Container();
    const ring = new Graphics();
    ring.circle(0, 0, 90).stroke({ color: 0x7fe0ff, width: 6 });
    ring.position.set(bindings.x, bindings.y);
    view.addChild(ring);

    setRefresh(view, () => {
        // How far through this beat the music is, from 0 to 1
        const beat = bindings.beat();
        const intoBeat = beat - Math.floor(beat);
        ring.scale.set(1 + 0.15 * (1 - intoBeat));
        ring.alpha = 0.3 + 0.7 * (1 - intoBeat);
    });
    return view;
}
