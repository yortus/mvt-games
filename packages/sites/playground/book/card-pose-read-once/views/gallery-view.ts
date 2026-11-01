import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createReaction } from '@mvtjs/utils';
import type { GalleryModel } from '../models';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast the ring turns, in radians a ms. */
const TURN_PER_MS = 0.0004;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GalleryViewBindings {
    readonly model: GalleryModel;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The cards on a slowly turning ring, and a card that flies out of the ring
 * to fill the screen as it opens. The ring's turn is this view's own
 * presentation state, so the model doesn't know where a card is drawn. As
 * a card starts to open, the view reads where the card is drawn right now,
 * once, and the flight starts from there. It reads it once more as the card
 * starts to close, to fly back to its place.
 */
export function GalleryView({ model, width, height }: GalleryViewBindings): Container {
    const view = new Container();
    // A click anywhere closes an open card
    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointerdown', model.closeCard);

    const ring = new Container();
    ring.sortableChildren = true;
    const ringCards: Container[] = [];
    for (let i = 0; i < model.cardCount; i++) {
        const card = makeCard(i);
        card.eventMode = 'static';
        card.cursor = 'pointer';
        card.on('pointerdown', () => model.openCard(i));
        ring.addChild(card);
        ringCards.push(card);
    }

    // One flying card for each card, of which only the open one shows
    const flyingCards: Container[] = [];
    for (let i = 0; i < model.cardCount; i++) flyingCards.push(makeCard(i));

    const hint = new Text({ text: 'Click a card to open it.', style: HINT_STYLE });
    hint.anchor.set(0.5, 0);
    hint.position.set(width / 2, 16);
    view.addChild(hint, ring, ...flyingCards);

    // The ring's turn, in radians, which moves on only while every card shows
    let turn = 0;
    // Where the flight starts and ends, read from the ring once each time
    let fromPose: Rect = { x: 0, y: 0, width: CARD_W, height: CARD_H };
    let toPose: Rect = fromPose;

    const readStartPoseWhenOpening = createReaction({
        watch: () => model.phase,
        when: 'opening',
        react: () => {
            fromPose = measurePose(ringCards[model.openIndex]);
        },
    });
    const readEndPoseWhenClosing = createReaction({
        watch: () => model.phase,
        when: 'closing',
        react: () => {
            toPose = measurePose(ringCards[model.openIndex]);
        },
    });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        if (model.phase === 'browsing') turn += TURN_PER_MS * deltaMs;
    }

    function refresh(): void {
        const phase = model.phase;
        for (let i = 0; i < ringCards.length; i++) {
            const angle = turn + (i / ringCards.length) * Math.PI * 2;
            // 0 at the back of the ring, 1 at the front
            const depth = (Math.sin(angle) + 1) / 2;
            const card = ringCards[i];
            card.position.set(width / 2 + RING_RX * Math.cos(angle), RING_Y + RING_RY * Math.sin(angle));
            card.scale.set(0.6 + 0.5 * depth);
            card.zIndex = depth;
            // The open card leaves a gap in the ring, but keeps its place there
            card.alpha = phase !== 'browsing' && i === model.openIndex ? 0 : 0.5 + 0.5 * depth;
        }

        // With the ring in place, read where the card is drawn, once, as it
        // starts to open or close. The ring stops turning as a card opens, so
        // this is where the player saw the card they clicked.
        readStartPoseWhenOpening();
        readEndPoseWhenClosing();

        const t = easeInOut(model.progress);
        for (let i = 0; i < flyingCards.length; i++) {
            const card = flyingCards[i];
            card.visible = phase !== 'browsing' && i === model.openIndex;
            if (!card.visible) continue;
            if (phase === 'closing') placeBetween(card, OPEN_POSE, toPose, t);
            else placeBetween(card, fromPose, OPEN_POSE, t);
        }
        hint.text = phase === 'open' ? 'Click anywhere to close it.' : 'Click a card to open it.';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where something is drawn, and how big, in the view's pixels. */
interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

const CARD_W = 60;
const CARD_H = 84;
/** The ring's middle, and its radii across and down, in pixels. */
const RING_Y = 200;
const RING_RX = 220;
const RING_RY = 70;
/** Where an open card is drawn. */
const OPEN_POSE: Rect = { x: 320 - CARD_W * 1.4, y: 180 - CARD_H * 1.4, width: CARD_W * 2.8, height: CARD_H * 2.8 };

const COLORS: readonly number[] = [0xe05561, 0xe8a33d, 0x4cb860, 0x3d8fe8, 0x9b6be0, 0x2fb5a8];

/** The shape on each card's face. */
const SHAPES: readonly ((g: Graphics) => void)[] = [
    (g) => g.circle(0, 0, 14),
    (g) => g.star(0, 0, 5, 16, 7),
    (g) => g.poly([0, -16, 15, 12, -15, 12]),
    (g) => g.poly([0, -17, 13, 0, 0, 17, -13, 0]),
    (g) => g.rect(-12, -12, 24, 24),
    (g) => g.star(0, 0, 6, 15, 10),
];
const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x8b949e };

/**
 * Reads where a card is drawn right now, from the scene. The view's
 * container sits at the stage's top left corner, unscaled, so the scene's
 * coordinates are the view's.
 */
function measurePose(card: Container): Rect {
    const { x, y, width, height } = card.getBounds();
    return { x, y, width, height };
}

/** Moves and scales a card to a pose part way between two others. */
function placeBetween(card: Container, from: Rect, to: Rect, t: number): void {
    const x = from.x + from.width / 2 + (to.x + to.width / 2 - from.x - from.width / 2) * t;
    const y = from.y + from.height / 2 + (to.y + to.height / 2 - from.y - from.height / 2) * t;
    card.position.set(x, y);
    card.scale.set((from.width + (to.width - from.width) * t) / CARD_W);
}

function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
}

/** A card with its middle at 0, 0, and a shape of its own on its face. */
function makeCard(index: number): Container {
    const g = new Graphics();
    g.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8).fill(COLORS[index]).stroke({ color: 0xffffff, width: 2 });
    SHAPES[index](g);
    g.fill(0xffffff);
    const card = new Container();
    card.addChild(g);
    return card;
}
