import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import { PixelTextView } from '#shared';
import type { SheepPhase } from '../models';
import { drawOutlinedPixels, drawPixels, type PixelRects } from './drawing';
import { COLOURS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SheepViewBindings {
    /** Its middle, in cells. */
    row: () => number;
    col: () => number;
    /** A cell's size in pixels, read once. */
    cellSize: number;
    /** How many times its pixel art's size to draw the sheep, read once. Larger reads better on a small screen. */
    spriteScale: number;
    phase: () => SheepPhase;
    isFacingLeft: () => boolean;
    /** The points a sheep scores as it is penned, shown rising from it. Read once. */
    penPoints: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A sheep, a puff of white wool with a dark face and legs. It nibbles the
 * grass with its head down while it grazes, in the meadow or penned. It
 * trots while it walks, and bounds while it runs. As it is penned, a little cluster of
 * hearts rises from it, swaying, with the points it scored, and fades. A
 * sheep lost to the storm is whirled up and away.
 */
export function SheepView(bindings: SheepViewBindings): Container {
    const { cellSize, spriteScale, penPoints } = bindings;
    const wool = drawPixels(new Graphics(), WOOL);
    const headUp = drawPixels(new Graphics(), HEAD_UP);
    const headDown = drawPixels(new Graphics(), HEAD_DOWN);
    const legsStill = drawPixels(new Graphics(), LEGS_STILL);
    const legsApart = drawPixels(new Graphics(), LEGS_APART);
    const sheep = new Container();
    sheep.addChild(legsStill, legsApart, wool, headUp, headDown);
    const hearts: Graphics[] = [];
    const cheer = new Container();
    for (let i = 0; i < HEART_XS.length; i++) {
        const heart = drawOutlinedPixels(new Graphics(), HEART, COLOURS.heartEdge);
        heart.scale.set(spriteScale);
        hearts.push(heart);
        cheer.addChild(heart);
    }
    const bonus = PixelTextView({ text: `+${penPoints}`, color: 0xffffff, outline: COLOURS.heartEdge, anchorX: 0.5, anchorY: 0.5 });
    cheer.addChild(bonus);
    const view = new Container();
    view.addChild(sheep, cheer);

    // Presentation state: time, for its nibbling and trotting; how long
    // since it was lost; and how long since it was penned, for its hearts
    let ageMs = 0;
    let lostMs = 0;
    let pennedMs = CHEER_MS;
    // A sheep in a list's slot arrives grazing, so only a sheep of its own becomes penned
    const watcher = watch({ phase: bindings.phase });
    watcher.poll();

    setUpdate(view, (deltaMs) => {
        ageMs += deltaMs;
        lostMs = bindings.phase() === 'lost' ? lostMs + deltaMs : 0;
        const { phase } = watcher.poll();
        pennedMs = phase.changed && phase.value === 'penned' ? 0 : pennedMs + deltaMs;
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const phase = bindings.phase();
        const isLost = phase === 'lost';
        view.visible = !isLost || lostMs < LOST_MS;
        if (!view.visible) return;

        sheep.scale.set(bindings.isFacingLeft() ? -spriteScale : spriteScale, spriteScale);
        const isMoving = phase === 'walking' || phase === 'fleeing';
        const stepMs = phase === 'fleeing' ? 80 : 160;
        const isStepping = isMoving && Math.floor(ageMs / stepMs) % 2 === 0;
        legsStill.visible = !isStepping;
        legsApart.visible = isStepping;

        // Grazing, it keeps its head down, and looks up now and then
        const isGrazing = phase === 'grazing' || phase === 'penned';
        const isHeadDown = isGrazing && (ageMs + bindings.col() * 300) % GRAZE_CYCLE_MS < GRAZE_DOWN_MS;
        headUp.visible = !isHeadDown;
        headDown.visible = isHeadDown;

        const hop = phase === 'fleeing' && isStepping ? -1 : 0;
        const lift = isLost ? lostMs * 0.05 : 0;
        view.position.set(
            Math.round(bindings.col() * cellSize),
            Math.round(bindings.row() * cellSize) + 4 + hop - Math.round(lift),
        );
        sheep.rotation = isLost ? lostMs * 0.015 : 0;
        view.alpha = isLost ? 1 - lostMs / LOST_MS : 1;
        placeCheer();
    }

    /** The hearts, each rising and swaying in turn, and the points, rising slowly and fading. */
    function placeCheer(): void {
        cheer.visible = pennedMs < CHEER_MS;
        if (!cheer.visible) return;
        for (let i = 0; i < hearts.length; i++) {
            const heart = hearts[i];
            const heartMs = pennedMs - i * HEART_GAP_MS;
            heart.visible = heartMs >= 0 && heartMs < HEART_MS;
            if (!heart.visible) continue;
            const progress = heartMs / HEART_MS;
            heart.position.set(
                Math.round(HEART_XS[i] * spriteScale + Math.sin(heartMs * 0.012 + i * 1.7) * 2),
                Math.round((-11 - progress * 20) * spriteScale),
            );
            heart.alpha = fadeOut(progress);
        }
        const progress = pennedMs / CHEER_MS;
        bonus.position.set(0, Math.round(-16 * spriteScale - 8 - progress * 14));
        bonus.alpha = fadeOut(progress);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const LOST_MS = 900;

/** How long the cheer for a penned sheep lasts, and each heart in it, and the time between hearts. */
const CHEER_MS = 1500;
const HEART_MS = 1000;
const HEART_GAP_MS = 110;
/** Where each heart rises from, across the sheep, in its pixels. */
const HEART_XS: readonly number[] = [-4, 3, -1, 5, -6];

/** Full until 60% of the way through, then fading to nothing. */
function fadeOut(progress: number): number {
    return progress < 0.6 ? 1 : Math.max(0, (1 - progress) / 0.4);
}
const GRAZE_CYCLE_MS = 2600;
const GRAZE_DOWN_MS = 1900;

// Facing right, with the feet at the origin

const WOOL: PixelRects = [
    [-4, -9, 7, 1, COLOURS.wool],
    [-5, -8, 9, 4, COLOURS.wool],
    [-4, -4, 7, 1, COLOURS.woolShade],
    [-3, -10, 2, 1, COLOURS.wool],
    [0, -10, 2, 1, COLOURS.wool],
];

const HEAD_UP: PixelRects = [
    [4, -10, 3, 3, COLOURS.sheepFace],
    [3, -10, 1, 1, COLOURS.sheepFace],
    [5, -9, 1, 1, COLOURS.wool],
];

const HEAD_DOWN: PixelRects = [
    [4, -6, 3, 3, COLOURS.sheepFace],
    [3, -7, 1, 1, COLOURS.sheepFace],
    [5, -5, 1, 1, COLOURS.wool],
];

const LEGS_STILL: PixelRects = [
    [-3, -3, 1, 3, COLOURS.sheepFace],
    [2, -3, 1, 3, COLOURS.sheepFace],
];

/** A little heart, centred on the origin. */
const HEART: PixelRects = [
    [-2, -2, 2, 1, COLOURS.heart],
    [1, -2, 2, 1, COLOURS.heart],
    [-2, -1, 5, 1, COLOURS.heart],
    [-1, 0, 3, 1, COLOURS.heart],
    [0, 1, 1, 1, COLOURS.heart],
    [-1, -2, 1, 1, COLOURS.flowerWhite],
];

const LEGS_APART: PixelRects = [
    [-4, -3, 1, 3, COLOURS.sheepFace],
    [-2, -3, 1, 2, COLOURS.sheepFace],
    [1, -3, 1, 2, COLOURS.sheepFace],
    [3, -3, 1, 3, COLOURS.sheepFace],
];
