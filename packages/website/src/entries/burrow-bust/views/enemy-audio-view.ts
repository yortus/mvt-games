import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80, SoundEffect } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { FIRE, FIRE_WARNING, GHOST, POP, PUMP_1, PUMP_2, PUMP_3, PUMP_4, SQUASH } from '../data';
import type { EnemyPhase, InflationStage } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What `EnemyAudioView` reads about one creature. */
export interface EnemyAudioViewBindings {
    /** The chip to play on. It is the view's output, not a query of the model, so it is read once. */
    readonly sound: Audio80;
    /** What the creature is doing. */
    readonly phase: () => EnemyPhase;
    /** How far the creature is pumped up, from 0 to 4. Each rise is a pump. */
    readonly inflationStage: () => InflationStage;
    /** Whether the creature fled off the field and got away, rather than being popped. */
    readonly hasEscaped: () => boolean;
    /** Whether the salamander is drawing breath to breathe fire. */
    readonly isFireTelegraph: () => boolean;
    /** Whether the salamander is breathing fire. */
    readonly isFireActive: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One creature's sounds. Each pump plays a puff, higher with each stage. The
 * creature pops, or is squashed under a rock, or slides eerily as it ghosts
 * through the earth. A salamander hisses before its fire, and its fire roars.
 * A creature that gets away makes no sound. The view draws nothing.
 *
 * A `<List>` reuses this view's slot when a level brings new creatures. So
 * the view polls once as it is made, and after that plays only on a change
 * that a new creature cannot cause: a stage rising, or a phase or fire
 * starting. A new creature arrives at stage 0, on patrol, with no fire.
 */
export function EnemyAudioView(bindings: EnemyAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'enemy-audio';
    const watcher = watch({
        phase: bindings.phase,
        inflationStage: bindings.inflationStage,
        isFireTelegraph: bindings.isFireTelegraph,
        isFireActive: bindings.isFireActive,
    });
    // The first refresh hears only what changes after the view is made
    watcher.poll();

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        const stage = w.inflationStage;
        if (stage.increased) play(PUMPS[stage.value]);
        if (w.phase.changed) {
            if (w.phase.value === 'popped' && !bindings.hasEscaped()) play(POP);
            else if (w.phase.value === 'crushed') play(SQUASH);
            else if (w.phase.value === 'ghosting') play(GHOST);
        }
        if (w.isFireTelegraph.changed && w.isFireTelegraph.value) play(FIRE_WARNING);
        if (w.isFireActive.changed && w.isFireActive.value) play(FIRE);
    }

    function play(effect: SoundEffect | undefined): void {
        if (effect !== undefined) sound.play(effect);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The pump to play as the stage rises to each value. Stage 0 has none, since a stage never rises to 0. */
const PUMPS: readonly (SoundEffect | undefined)[] = [undefined, PUMP_1, PUMP_2, PUMP_3, PUMP_4];
