import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80, SoundEffect } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { CARRIER_HIT, DIVE, SCOUT_HIT, STRIKER_HIT } from '../data';
import type { EnemyKind, EnemyPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What an `EnemyAudioView` plays on, and the raider's state it plays the sounds of. */
export interface EnemyAudioViewBindings {
    /** The chip to play on. It is the view's output, not model state, so the view reads it once. */
    readonly sound: Audio80;
    /** Whether the raider is alive. The view plays its explosion when this goes from true to false. */
    readonly isAlive: () => boolean;
    /** The raider's phase. The view plays the whistle when it changes to 'diving'. */
    readonly phase: () => EnemyPhase;
    /** The raider's kind, which picks the explosion. */
    readonly kind: () => EnemyKind;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays one raider's sounds. It plays a whistle as the raider starts a dive,
 * and an explosion when the raider is destroyed. A bigger raider's explosion
 * is deeper. The view draws nothing. In a `<List>`, a slot's view is reused
 * for the raiders of later stages and games. So the view plays only on
 * changes that a newly arrived raider cannot cause. A new raider arrives alive
 * and entering, so it plays nothing.
 */
export function EnemyAudioView(bindings: EnemyAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'enemy-audio';
    const watcher = watch({ isAlive: bindings.isAlive, phase: bindings.phase });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (w.isAlive.changed && w.isAlive.previous === true) {
            sound.play(chooseHit(bindings.kind()));
        }
        else if (w.phase.changed && w.phase.value === 'diving' && w.phase.previous !== undefined) {
            sound.play(DIVE);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function chooseHit(kind: EnemyKind): SoundEffect {
    switch (kind) {
        case 'carrier': return CARRIER_HIT;
        case 'striker': return STRIKER_HIT;
        case 'scout': return SCOUT_HIT;
    }
}
