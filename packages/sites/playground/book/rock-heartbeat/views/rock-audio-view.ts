import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction, increased } from '@mvtjs/utils';
import type { Audio80 } from 'audio90';
import { BREAK } from './sounds';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RockAudioViewBindings {
    /** What the view plays its sounds on. The view reads it once. */
    readonly sfx: Pick<Audio80, 'play'>;
    /** Rocks broken this game. Each rise is a rock broken. */
    readonly rocksBroken: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** An audio view that plays a crunch each time a rock breaks. */
export function RockAudioView(bindings: RockAudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    const playBreakSoundOnEachRockBroken = createReaction({
        watch: bindings.rocksBroken,
        when: increased,
        react: () => sfx.play(BREAK),
    });

    setRefresh(view, playBreakSoundOnEachRockBroken);
    return view;
}
