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
    getMatchSequence(): Sequence<'dust' | 'popup' | 'stars'>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMatchEffectsView(bindings: MatchEffectsViewBindings): Container {
    const view = new Container();
    view.sortableChildren = true;

    // ---- Dust cloud pool (pre-allocated circles) ---------------------------
    const dustPool: Graphics[] = [];
    for (let i = 0; i < DUST_POOL_SIZE; i++) {
        const g = new Graphics();
        g.circle(0, 0, 1).fill(0xffffff);
        g.alpha = 0;
        g.zIndex = 50;
        view.addChild(g);
        dustPool.push(g);
    }

    // ---- Star particle pool (pre-allocated stars) --------------------------
    const starGfx: Graphics[] = [];
    const starAngle = new Float64Array(STAR_POOL_SIZE);
    const starSpeed = new Float64Array(STAR_POOL_SIZE);
    for (let i = 0; i < STAR_POOL_SIZE; i++) {
        const g = new Graphics();
        g.star(0, 0, 5, STAR_OUTER_RADIUS, STAR_INNER_RADIUS).fill(STAR_COLOURS[i % STAR_COLOURS.length]);
        g.alpha = 0;
        g.zIndex = 55;
        view.addChild(g);
        starGfx.push(g);
        starAngle[i] = (i / STAR_POOL_SIZE) * Math.PI * 2;
        // Deterministic speed variation per particle
        starSpeed[i] = STAR_BASE_SPEED + STAR_SPEED_RANGE * ((i * 7 + 3) % STAR_POOL_SIZE) / STAR_POOL_SIZE;
    }
    let starCentreX = 0;
    let starCentreY = 0;

    // ---- Score popup text --------------------------------------------------
    const popupTextContainer = new Container();
    popupTextContainer.zIndex = 60;
    view.addChild(popupTextContainer);
    const popupText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: POPUP_FONT_SIZE, fill: 0xffff00, fontWeight: 'bold', align: 'center' },
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
                // Higher cascades produce multiple staggered rings per cell
                const ringsPerCell = Math.min(MAX_DUST_RINGS, cascade);
                const cellCount = matchedCells.length;

                let idx = 0;
                for (let c = 0; c < cellCount && idx < DUST_POOL_SIZE; c++) {
                    const cell = matchedCells[c];
                    const cx = gridX(cell.col);
                    const cy = gridY(cell.row);

                    for (let ring = 0; ring < ringsPerCell && idx < DUST_POOL_SIZE; ring++) {
                        // Stagger each ring slightly behind the previous
                        const ringDelay = ring * DUST_RING_STAGGER;
                        const ringProgress = Math.max(0, Math.min(1,
                            (progress - ringDelay) / (1 - ringDelay),
                        ));
                        const radius = (DUST_RADIUS + DUST_CASCADE_BONUS * (cascade - 1)) * (1 + ring * 0.5);

                        const g = dustPool[idx];
                        g.position.set(cx, cy);
                        g.scale.set(radius * (0.3 + ringProgress * 0.7));
                        g.alpha = (1 - ringProgress) * (0.6 - ring * 0.12);
                        idx++;
                    }
                }
                for (let i = idx; i < DUST_POOL_SIZE; i++) {
                    dustPool[i].alpha = 0;
                }
            },
        },
        stars: {
            inactive: () => {
                for (let i = 0; i < STAR_POOL_SIZE; i++) {
                    starGfx[i].alpha = 0;
                }
            },
            entering: () => {
                const cascade = bindings.getCascadeStep();
                if (cascade < MIN_CASCADE_FOR_STARS) return;
                const centre = computeMatchCentre(bindings.getMatchedCells());
                starCentreX = centre.x;
                starCentreY = centre.y;
            },
            active: (progress) => {
                const cascade = bindings.getCascadeStep();
                if (cascade < MIN_CASCADE_FOR_STARS) return;

                const count = Math.min(STAR_POOL_SIZE, (cascade - MIN_CASCADE_FOR_STARS + 1) * STARS_PER_CASCADE);
                const fade = 1 - progress;
                const dist = progress * STAR_TRAVEL_PX;

                for (let i = 0; i < count; i++) {
                    const g = starGfx[i];
                    g.position.set(
                        starCentreX + Math.cos(starAngle[i]) * dist * starSpeed[i],
                        starCentreY + Math.sin(starAngle[i]) * dist * starSpeed[i],
                    );
                    g.alpha = fade;
                    g.rotation = progress * Math.PI * 2;
                    g.scale.set(STAR_DISPLAY_SCALE * (1 - progress * 0.4));
                }
                for (let i = count; i < STAR_POOL_SIZE; i++) {
                    starGfx[i].alpha = 0;
                }
            },
        },
        popup: {
            inactive: () => {
                popupText.alpha = 0;
                popupText.scale.set(1);
            },
            entering: () => {
                const centre = computeMatchCentre(bindings.getMatchedCells());
                popupTextContainer.position.set(centre.x, centre.y);
                const cascade = bindings.getCascadeStep();
                const matchCount = bindings.getMatchedCells().length;
                const pts = matchCount * 10;

                if (cascade >= 4) {
                    popupText.text = `SUPER x${cascade}!\n+${pts}`;
                }
                else if (cascade > 1) {
                    popupText.text = `COMBO x${cascade}!\n+${pts}`;
                }
                else {
                    popupText.text = `+${pts}`;
                }

                // Scale up font size for higher cascades
                const scaleFactor = 1 + (cascade - 1) * POPUP_CASCADE_SCALE;
                popupText.style.fontSize = POPUP_FONT_SIZE * scaleFactor;
            },
            active: (progress) => {
                const cascade = bindings.getCascadeStep();
                const rise = POPUP_RISE_PX + (cascade - 1) * POPUP_CASCADE_RISE_BONUS;

                // Bounce-in scale for combos: peaks in first third then settles
                const scaleT = Math.min(1, progress * 3);
                const bounceScale = cascade > 1
                    ? 1 + 0.3 * Math.sin(scaleT * Math.PI) * (1 - progress)
                    : 1;
                popupText.scale.set(bounceScale);
                popupText.position.set(0, -rise * progress);
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

// ---- Dust constants --------------------------------------------------------

/** Base dust cloud radius in pixels. */
const DUST_RADIUS = 30;
/** Extra dust radius per additional cascade step. */
const DUST_CASCADE_BONUS = 10;
/** Maximum number of staggered rings per cell. */
const MAX_DUST_RINGS = 3;
/** Progress delay between successive rings (fraction of total). */
const DUST_RING_STAGGER = 0.15;
/**
 * Number of pre-allocated dust sprites. Sized for MAX_DUST_RINGS rings
 * across typical match groups (~8 cells x 3 rings = 24, plus headroom).
 */
const DUST_POOL_SIZE = 32;

// ---- Star constants --------------------------------------------------------

/** Minimum cascade step before stars activate. */
const MIN_CASCADE_FOR_STARS = 2;
/** Number of additional stars per cascade step above the minimum. */
const STARS_PER_CASCADE = 6;
/** Total pre-allocated star sprites. */
const STAR_POOL_SIZE = 20;
/** Outer radius of the drawn star shape. */
const STAR_OUTER_RADIUS = 20;
/** Inner radius of the drawn star shape. */
const STAR_INNER_RADIUS = 8;
/** Base outward speed multiplier. */
const STAR_BASE_SPEED = 0.7;
/** Range of speed variation across stars. */
const STAR_SPEED_RANGE = 0.6;
/** How far stars travel outward in pixels. */
const STAR_TRAVEL_PX = 400;
/** Display scale for star graphics. */
const STAR_DISPLAY_SCALE = 3.0;
const STAR_COLOURS = [
    0xFF2222, 0xFF6622, 0xFFFF22, 0x22FF22,
    0x22FFFF, 0x2266FF, 0xCC22FF, 0xFF22CC,
];

// ---- Popup constants -------------------------------------------------------

/** Score popup base font size. */
const POPUP_FONT_SIZE = 60;
/** How far the popup floats upward in pixels. */
const POPUP_RISE_PX = 100;
/** Extra rise per cascade step in pixels. */
const POPUP_CASCADE_RISE_BONUS = 30;
/** Font scale increase per cascade step. */
const POPUP_CASCADE_SCALE = 0.2;

// ---- Shared helpers --------------------------------------------------------

function gridX(col: number): number {
    return col * CELL_WIDTH_PX + CELL_WIDTH_PX * 0.5;
}

function gridY(row: number): number {
    return row * CELL_HEIGHT_PX + CELL_HEIGHT_PX * 0.5;
}
