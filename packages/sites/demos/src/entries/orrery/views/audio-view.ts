import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction, increased } from '@mvtjs/utils';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { TICK, TOCK } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface AudioViewBindings {
    /** The chip the ticks play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio80'>;
    /** How many teeth of the crank's pinion have passed. Each rise is a click, a tick or a tock by turns. */
    readonly teethPassed: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the orrery's ticking. Each tooth of the crank's pinion that passes
 * clicks, a tick and a tock by turns, like a clock, so the clicks speed up
 * as the crank does. When several teeth pass in one frame, as they do when
 * it's spun fast, the frame plays one click, and the clicks run together
 * into a whirr.
 */
export function AudioView(bindings: AudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'orrery-audio';

    const playClickWhenToothPasses = createReaction({
        watch: bindings.teethPassed,
        when: increased,
        react: (teeth) => sfx.play(teeth % 2 === 0 ? TICK : TOCK),
    });

    setRefresh(view, () => {
        playClickWhenToothPasses();
    });
    return view;
}
