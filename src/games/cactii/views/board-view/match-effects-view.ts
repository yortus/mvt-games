import { Container, Graphics, Text } from 'pixi.js';
import { createSequenceReaction, type Sequence } from '#common';
import type { CactusCell } from '../../models';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MatchEffectsViewBindings {
    getMatchedCells(): readonly Readonly<CactusCell>[];
    getCascadeStep(): number;
    getMatchSequence(): Sequence<'dust' | 'popup'>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMatchEffectsView(bindings: MatchEffectsViewBindings): Container {
    const view = new Container();
    view.sortableChildren = true;

    // Dust cloud pool (pre-allocated circles)
    const dustPool: Graphics[] = [];
    for (let i = 0; i < DUST_POOL_SIZE; i++) {
        const g = new Graphics();
        g.circle(0, 0, 1).fill(0xffffff);
        g.alpha = 0;
        g.zIndex = 50;
        view.addChild(g);
        dustPool.push(g);
    }

    // Score popup text
    const popupTextContainer = new Container();
    popupTextContainer.zIndex = 60;
    view.addChild(popupTextContainer);
    const popupText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: POPUP_FONT_SIZE, fill: 0xffff00, fontWeight: 'bold' },
        anchor: { x: 0.5, y: 0.5 },
        alpha: 0,
    });
    popupTextContainer.addChild(popupText);

    const updateEffects = createSequenceReaction(bindings.getMatchSequence(), {
        dust: {
            inactive: () => {
                for (let i = 0; i < DUST_POOL_SIZE; i++) {
                    dustPool[i].alpha = 0;
                }
            },
            active: (progress) => {
                const matchedCells = bindings.getMatchedCells();
                const cascade = bindings.getCascadeStep();
                const radius = DUST_RADIUS + DUST_CASCADE_BONUS * (cascade - 1);
                const count = matchedCells.length < DUST_POOL_SIZE ? matchedCells.length : DUST_POOL_SIZE;
                const expand = progress;
                const fade = 1 - progress;

                for (let i = 0; i < count; i++) {
                    const cell = matchedCells[i];
                    const cx = gridX(cell.col);
                    const cy = gridY(cell.row);
                    const g = dustPool[i];
                    g.position.set(cx, cy);
                    g.scale.set(radius * (0.5 + expand * 0.5));
                    g.alpha = fade * 0.6;
                }
                for (let i = count; i < DUST_POOL_SIZE; i++) {
                    dustPool[i].alpha = 0;
                }
            },
        },
        popup: {
            inactive: () => {
                popupText.alpha = 0;
            },
            entering: () => {
                const centre = computeMatchCentre(bindings.getMatchedCells());
                popupTextContainer.position.set(centre.x, centre.y);
                const cascade = bindings.getCascadeStep();
                const matchCount = bindings.getMatchedCells().length;
                const pts = matchCount * 10;
                popupText.text = cascade > 1 ? `+${pts} x${cascade}` : `+${pts}`;
            },
            active: (progress) => {
                popupText.position.set(0, -POPUP_RISE_PX * progress);
                popupText.alpha = 1 - progress ** 2;
            },
        },
    });

    view.onRender = updateEffects;
    return view;

    function computeMatchCentre(matchedCells: readonly Readonly<CactusCell>[]): { x: number; y: number } {
        let sumX = 0;
        let sumY = 0;
        for (let i = 0; i < matchedCells.length; i++) {
            sumX += gridX(matchedCells[i].col);
            sumY += gridY(matchedCells[i].row);
        }
        return { x: sumX / matchedCells.length, y: sumY / matchedCells.length };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Base dust cloud radius in pixels. */
const DUST_RADIUS = 30;
/** Extra dust radius per additional cascade step. */
const DUST_CASCADE_BONUS = 10;
/** Number of pre-allocated dust sprites. */
const DUST_POOL_SIZE = 16;

/** Score popup font size. */
const POPUP_FONT_SIZE = 60;
/** How far the popup floats upward in pixels. */
const POPUP_RISE_PX = 100;

function gridX(col: number): number {
    return col * CELL_WIDTH_PX + CELL_WIDTH_PX * 0.5;
}

function gridY(row: number): number {
    return row * CELL_HEIGHT_PX + CELL_HEIGHT_PX * 0.5;
}
