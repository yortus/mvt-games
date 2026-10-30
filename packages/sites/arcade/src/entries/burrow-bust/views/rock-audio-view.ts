import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction } from '@mvtjs/utils';
import type { SfxChip } from '#shared';
import { ROCK_CRASH, ROCK_FALL, ROCK_WOBBLE } from '../data';
import type { RockPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What `RockAudioView` reads about one rock. */
export interface RockAudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio80'>;
    /** What the rock is doing. */
    readonly phase: () => RockPhase;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One rock's sounds. It creaks as it works loose, whistles as it falls, and
 * crashes as it lands and breaks.
 *
 * It plays only on a change into one of those phases. A `<List>` reuses a
 * slot's view for later rocks, and a new rock arrives `'stable'`. So a new
 * rock taking over a slot makes no sound.
 */
export function RockAudioView(bindings: RockAudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'rock-audio';
    const playRockSoundWhenPhaseChanges = createReaction({
        watch: bindings.phase,
        react: (phase) => {
            if (phase === 'wobbling') sfx.play(ROCK_WOBBLE);
            else if (phase === 'falling') sfx.play(ROCK_FALL);
            else if (phase === 'shattered') sfx.play(ROCK_CRASH);
        },
    });

    setRefresh(view, playRockSoundWhenPhaseChanges);
    return view;
}
