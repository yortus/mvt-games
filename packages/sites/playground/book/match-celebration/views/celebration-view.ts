import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createSequenceTracker, type Sequence } from '@mvtjs/utils';
import type { Cell } from '../models';
import { toCellX, toCellY } from './board-layout';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How big each puff of dust grows, in pixels. */
const MAX_DUST_RADIUS = 34;
/** How far the points popup rises, in pixels. */
const RISE_PX = 60;
/** How many stars burst out. */
const STAR_COUNT = 6;
/** How far the stars fly, in pixels. */
const STAR_RANGE_PX = 110;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CelebrationViewBindings {
    /** The board's match sequence. The view reads it once, and reads only these steps. */
    readonly matchSequence: Sequence<'dust' | 'popup' | 'stars'>;
    readonly matchedCells: () => readonly Cell[];
    readonly points: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A puff of dust on each matched cell, the match's points rising and
 * fading, and stars flying out. A sequence tracker sets each effect up once
 * as its step starts, moves it on while the step runs, and hides it as the
 * step comes to rest.
 */
export function CelebrationView(bindings: CelebrationViewBindings): Container {
    const view = new Container();

    // One puff for each cell a match can have. Each is drawn with a radius
    // of 1, and scaled up as it spreads.
    const dust: Graphics[] = [];
    for (let i = 0; i < MAX_MATCHED; i++) {
        const puff = new Graphics();
        puff.circle(0, 0, 1).fill({ color: 0xffffff, alpha: 0.5 });
        dust.push(puff);
        view.addChild(puff);
    }

    const stars = new Container();
    for (let i = 0; i < STAR_COUNT; i++) {
        const star = new Graphics();
        star.star(0, 0, 5, 9, 4).fill(0xffe066);
        stars.addChild(star);
    }

    const popup = new Container();
    const label = new Text({ style: POPUP_STYLE });
    label.anchor.set(0.5);
    popup.addChild(label);
    view.addChild(stars, popup);

    const refreshEffects = createSequenceTracker(bindings.matchSequence, {
        dust: {
            entering: () => placeDustAt(bindings.matchedCells()),
            active: (progress) => {
                for (let i = 0; i < dust.length; i++) {
                    dust[i].scale.set(progress * MAX_DUST_RADIUS);
                    dust[i].alpha = 1 - progress;
                }
            },
            inactive: () => {
                for (let i = 0; i < dust.length; i++) dust[i].alpha = 0;
            },
        },
        popup: {
            entering: () => {
                label.text = String(bindings.points());
                placeAtMatch(popup, bindings.matchedCells());
            },
            active: (progress) => {
                label.y = -RISE_PX * progress;
                label.alpha = 1 - progress * progress;
            },
            inactive: () => {
                label.alpha = 0;
            },
        },
        stars: {
            entering: () => placeAtMatch(stars, bindings.matchedCells()),
            active: (progress) => {
                for (let i = 0; i < STAR_COUNT; i++) {
                    const star = stars.children[i];
                    const angle = (i / STAR_COUNT) * Math.PI * 2;
                    star.position.set(Math.cos(angle) * STAR_RANGE_PX * progress, Math.sin(angle) * STAR_RANGE_PX * progress);
                    star.rotation = progress * Math.PI;
                }
                stars.alpha = 1 - progress;
            },
            inactive: () => {
                stars.alpha = 0;
            },
        },
    });

    setRefresh(view, refreshEffects);
    return view;

    function placeDustAt(cells: readonly Cell[]): void {
        for (let i = 0; i < dust.length; i++) {
            dust[i].visible = i < cells.length;
            if (i < cells.length) dust[i].position.set(toCellX(cells[i].col), toCellY(cells[i].row));
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most cells a match can have. */
const MAX_MATCHED = 3;

const POPUP_STYLE = { fontFamily: 'monospace', fontSize: 34, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x111827, width: 5 } } as const;

/** Moves an effect to the middle of the matched cells. */
function placeAtMatch(effect: Container, cells: readonly Cell[]): void {
    if (cells.length === 0) return;
    const first = cells[0];
    const last = cells[cells.length - 1];
    effect.position.set((toCellX(first.col) + toCellX(last.col)) / 2, (toCellY(first.row) + toCellY(last.row)) / 2);
}
