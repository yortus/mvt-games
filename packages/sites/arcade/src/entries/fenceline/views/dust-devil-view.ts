import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { PixelTextView } from '#shared';
import { COLOURS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DustDevilViewBindings {
    /** Its middle, in cells. */
    row: () => number;
    col: () => number;
    /** A cell's size in pixels, read once. */
    cellSize: number;
    /** How big it is, as a share of its full size. It is smaller when fenced into less room. */
    size: () => number;
    /** Whether it is close to blowing out. It sputters. */
    isStarving: () => boolean;
    /** How far it has blown itself out, from 0 to 1. */
    blowOutProgress: () => number;
    /** Whether it is still there, whirling or blowing out. */
    isShown: () => boolean;
    /** The points it scores as it blows out, shown rising from it. Read once. */
    blowOutPoints: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A dust devil, drawn as a funnel of swirling dust, narrow at the ground and
 * wide at the top. It sways as it spins, with grit whirling round it. Each
 * ring of the funnel and each speck of grit is drawn once, then moved each
 * frame.
 *
 * Its size shows how much room it has. Fenced into less, it shrinks, easing
 * to its new size. Close to blowing out, it sputters. It flickers, its
 * rings break up and jitter, and it pales. Blowing out, it splits into
 * three small whirlwinds that fly apart, shrinking and fading, and its
 * points rise from where it was.
 */
export function DustDevilView(bindings: DustDevilViewBindings): Container {
    const { cellSize, blowOutPoints } = bindings;
    const shadow = new Graphics().ellipse(0, 0, 10, 3).fill({ color: COLOURS.earth, alpha: 0.35 });
    const main = buildFunnel();
    const body = new Container();
    body.addChild(shadow, main.container);
    const pieces: Funnel[] = [];
    const scattered = new Container();
    for (let i = 0; i < PIECE_ANGLES.length; i++) {
        const piece = buildFunnel();
        pieces.push(piece);
        scattered.addChild(piece.container);
    }
    const points = PixelTextView({ text: `+${blowOutPoints}`, color: 0xffffff, outline: COLOURS.devilEdge, anchorX: 0.5, anchorY: 0.5 });
    const view = new Container();
    view.addChild(body, scattered, points);

    // Presentation state: how long it has spun, and the size it is drawn
    // at, easing towards its size
    let spinMs = 0;
    let shownSize = bindings.size();

    setUpdate(view, (deltaMs) => {
        spinMs += deltaMs;
        const size = bindings.size();
        const step = SIZE_EASE_PER_MS * deltaMs;
        shownSize = shownSize < size ? Math.min(size, shownSize + step) : Math.max(size, shownSize - step);
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        view.visible = bindings.isShown();
        if (!view.visible) return;
        view.position.set(Math.round(bindings.col() * cellSize), Math.round(bindings.row() * cellSize) + 6);
        const blown = bindings.blowOutProgress();
        const isBlowingOut = blown > 0;
        body.visible = !isBlowingOut;
        scattered.visible = isBlowingOut;
        points.visible = isBlowingOut;
        if (isBlowingOut) placeScattered(blown);
        else placeWhole();
    }

    function placeWhole(): void {
        const isStarving = bindings.isStarving();
        // Sputtering flickers between two states, a few times a second
        const isFlickered = isStarving && Math.floor(spinMs / FLICKER_MS) % 2 === 0;
        body.alpha = isStarving ? (isFlickered ? 0.6 : 0.95) : 1;
        body.scale.set(shownSize);
        spinFunnel(main, spinMs, isStarving, isFlickered);
    }

    /** The three pieces flying apart, each smaller and fainter as they go, and the points rising. */
    function placeScattered(blown: number): void {
        // Fast at first, slowing as they go
        const flight = 1 - (1 - blown) * (1 - blown);
        for (let i = 0; i < pieces.length; i++) {
            const piece = pieces[i];
            const angle = PIECE_ANGLES[i];
            piece.container.position.set(
                Math.round(Math.cos(angle) * PIECE_FLIGHT * flight),
                Math.round(Math.sin(angle) * PIECE_FLIGHT * flight * 0.6 - 8 * flight),
            );
            piece.container.scale.set(shownSize * PIECE_SIZE * (1 - blown * 0.6));
            piece.container.alpha = 1 - blown * blown;
            spinFunnel(piece, spinMs * 1.6 + i * 500, false, false);
        }
        points.position.set(0, Math.round(-36 - blown * 16));
        points.alpha = blown < 0.6 ? 1 : (1 - blown) / 0.4;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const RING_COUNT = 8;
const RING_SPACING = 3.5;
const GRIT_COUNT = 9;
/** How fast its drawn size eases to its size, as a share of its full size per ms. */
const SIZE_EASE_PER_MS = 0.0008;
/** How long each flicker lasts while it sputters. */
const FLICKER_MS = 80;

/** The ways the three pieces fly as it blows out. They go up left, up right, and down. */
const PIECE_ANGLES: readonly number[] = [Math.PI * -0.8, Math.PI * -0.2, Math.PI * 0.5];
/** How far the pieces fly, in pixels, and how big each is to start with, as a share of the whole. */
const PIECE_FLIGHT = 40;
const PIECE_SIZE = 0.6;

/** One funnel of dust. It has rings, light streaks that circle them, and grit. */
interface Funnel {
    readonly container: Container;
    readonly rings: readonly Graphics[];
    readonly streaks: readonly Graphics[];
    readonly grit: readonly Graphics[];
}

function buildFunnel(): Funnel {
    const container = new Container();
    const rings: Graphics[] = [];
    const streaks: Graphics[] = [];
    for (let i = 0; i < RING_COUNT; i++) {
        const halfWidth = measureRingHalfWidth(i);
        const ring = new Graphics()
            .ellipse(0, 0, halfWidth, 2.5)
            .fill({ color: i % 2 === 0 ? COLOURS.dustDark : COLOURS.dust, alpha: 0.85 })
            .ellipse(0, 0, halfWidth, 2.5)
            .stroke({ color: COLOURS.devilEdge, width: 1, alpha: 0.6 });
        ring.y = -2 - i * RING_SPACING;
        const streak = new Graphics().rect(-1, -1, 3, 1).fill(COLOURS.dustLight);
        streak.y = ring.y;
        rings.push(ring);
        streaks.push(streak);
        container.addChild(ring, streak);
    }
    const grit: Graphics[] = [];
    for (let i = 0; i < GRIT_COUNT; i++) {
        const speck = new Graphics().rect(0, 0, 1, 1).fill(i % 2 === 0 ? COLOURS.dustDark : COLOURS.grit);
        grit.push(speck);
        container.addChild(speck);
    }
    return { container, rings, streaks, grit };
}

/**
 * Sways a funnel's rings, circles its streaks and whirls its grit, for the
 * time `spinMs`. Starving, its rings jitter, and while `isFlickered`, every
 * other ring drops out.
 */
function spinFunnel(funnel: Funnel, spinMs: number, isStarving: boolean, isFlickered: boolean): void {
    const { rings, streaks, grit } = funnel;
    for (let i = 0; i < rings.length; i++) {
        let sway = Math.sin(spinMs * 0.005 + i * 0.7) * (1 + i * 0.5);
        if (isStarving) sway += Math.sin(spinMs * 0.09 + i * 2.3) * 2;
        rings[i].x = Math.round(sway);
        rings[i].visible = !isFlickered || i % 2 === 0;
        const angle = spinMs * 0.018 + i * 1.3;
        streaks[i].x = Math.round(sway + Math.cos(angle) * measureRingHalfWidth(i) * 0.8);
        // The streak shows only on the near side of the funnel
        streaks[i].visible = rings[i].visible && Math.sin(angle) > 0;
    }
    for (let i = 0; i < grit.length; i++) {
        const angle = spinMs * 0.009 * (1 + i * 0.08) + i * 1.1;
        const reach = 7 + (i % 4) * 2;
        grit[i].position.set(Math.round(Math.cos(angle) * reach), Math.round(-4 - i * 3 + Math.sin(angle) * 2));
    }
}

/** Returns half the width of ring `i`, counting up from the ground. The funnel widens as it rises. */
function measureRingHalfWidth(i: number): number {
    return 3 + i * 1.7;
}
