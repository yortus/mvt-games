import { onDestroyed, setRefresh } from '@mvtjs/html';
import type { Rect } from './rect';
import type { WallEffectKind } from './transition-view-model';
import { createWallPainter, type WallPainter } from './wall-painter';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WallEffectViewBindings {
    /** What to draw over the cards: nothing hides the canvas. */
    readonly effect: () => WallEffectKind;
    /** How many cards there are to draw over. */
    readonly cardCount: () => number;
    /** Card `index`'s rectangle in the viewport, in CSS pixels; zero-sized where there is no card. */
    readonly cardRectAt: (index: number) => Rect;
    /** How far card `index` has burnt, or developed, from 0 to 1. */
    readonly cardProgressAt: (index: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Burns the wall's cards away, or develops them back, by drawing over them
 * on a canvas the size of the window. Burning paints the page's own
 * background in behind a front that creeps across each card from a corner,
 * ragged with noise, glowing at its edge and scorching the card ahead of it.
 * Developing fades each card up from a blank, as a polaroid develops. One
 * WebGL fragment shader draws every card at once; without WebGL, the cards
 * simply fade. The canvas takes no pointer events, and draws nothing, and is
 * hidden, when there is no effect.
 */
export function WallEffectView(bindings: WallEffectViewBindings): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'wall-effect';
    canvas.setAttribute('aria-hidden', 'true');
    // Hidden by style, not `hidden`, which would stop its refresh
    canvas.style.visibility = 'hidden';
    let painter: WallPainter | undefined;
    let drawnEffect: WallEffectKind = 'none';
    let isSizeStale = true;
    const onResize = (): void => {
        isSizeStale = true;
    };
    window.addEventListener('resize', onResize);
    onDestroyed(canvas, () => window.removeEventListener('resize', onResize));
    setRefresh(canvas, refresh);
    return canvas;

    function refresh(): void {
        const effect = bindings.effect();
        if (effect !== drawnEffect) {
            if (effect === 'none') painter?.clear();
            canvas.style.visibility = effect === 'none' ? 'hidden' : 'visible';
            drawnEffect = effect;
        }
        if (effect === 'none') return;
        painter ??= createWallPainter(canvas);
        if (isSizeStale) {
            isSizeStale = false;
            const bounds = canvas.getBoundingClientRect();
            painter.resize(bounds.width, bounds.height, Math.min(2, window.devicePixelRatio || 1));
        }
        painter.draw(effect, bindings);
    }
}
