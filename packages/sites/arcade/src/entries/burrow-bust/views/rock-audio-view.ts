import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
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
    const watcher = watch({ phase: bindings.phase });
    // The first refresh hears only what changes after the view is made
    watcher.poll();

    setRefresh(view, () => {
        const { phase } = watcher.poll();
        if (!phase.changed) return;
        if (phase.value === 'wobbling') sfx.play(ROCK_WOBBLE);
        else if (phase.value === 'falling') sfx.play(ROCK_FALL);
        else if (phase.value === 'shattered') sfx.play(ROCK_CRASH);
    });
    return view;
}
