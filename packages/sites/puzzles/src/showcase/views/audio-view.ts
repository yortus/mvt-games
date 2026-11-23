import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { watch } from '@mvtjs/utils';
import { PAGE_TURNED, PENCIL_MARKED } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface AudioViewBindings {
    /** The chip the sounds play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** How many pages the reader has turned. It rises with each turn. */
    readonly pagesTurned: () => number;
    /** The side the last page lifted from, which its sound is panned to. It's 1 on the right, for a turn forward, and -1 on the left, for a turn back. */
    readonly turnPan: () => number;
    /** How many pencil marks have been made in the margin game, by either side. It rises with each. */
    readonly marginMarksMade: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Plays the rustle of a page as each one turns, from the side it lifts from, and the scratch of each pencil mark in the margin game. */
export function AudioView({ sfx, pagesTurned, turnPan, marginMarksMade }: AudioViewBindings): Container {
    const view = new Container();
    view.label = 'newspaper-audio';
    const watcher = watch({ pagesTurned, marginMarksMade });

    setRefresh(view, () => {
        const w = watcher.poll();
        if (w.pagesTurned.increased) sfx.play(PAGE_TURNED, { pan: turnPan() * PAN });
        // The grid is on the back page, which lies on the left
        if (w.marginMarksMade.increased) sfx.play(PENCIL_MARKED, { pan: -PAN });
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far to the side a turn's rustle sits. */
const PAN = 0.35;
