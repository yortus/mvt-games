import { Container, Graphics, Text } from 'pixi.js';
import { type OrderedSlot } from '#common';
import { type OrderedListDemoModel, type Card } from './ordered-list-model';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Renders an `OrderedSlotList` as a row of cards. Card views are pooled by
 * stable storage index (`list.slots`), and each eases its rendered position
 * toward `slot.ordinal`, so a reorder slides for free. A removed card is still
 * reachable by storage index while it lingers pending release, so it fades and
 * floats out as its former neighbours close the gap.
 */
export function createOrderedListView(model: OrderedListDemoModel): Container {
    const view = new Container();

    const title = new Text({ text: 'OrderedSlotList', style: TITLE_STYLE });
    title.position.set(24, 16);
    view.addChild(title);

    const caption = new Text({ text: '', style: CAPTION_STYLE });
    caption.position.set(24, 46);
    view.addChild(caption);

    const cardsLayer = new Container();
    view.addChild(cardsLayer);

    const sprites: CardSprite[] = [];
    for (let i = 0; i < MAX_SPRITES; i++) {
        const sprite = createCardSprite();
        sprite.container.visible = false;
        cardsLayer.addChild(sprite.container);
        sprites.push(sprite);
    }

    view.onUpdate = update;
    return view;

    function update(deltaMs: number): void {
        caption.text = model.caption;

        const list = model.list;
        const count = list.slots.length;
        const k = 1 - Math.exp(-deltaMs / SMOOTH_MS);

        for (let i = 0; i < sprites.length; i++) {
            const sprite = sprites[i];
            const slot = i < count ? list.slots.at(i) : undefined;

            if (slot === undefined) {
                if (sprite.owner !== undefined) {
                    sprite.owner = undefined;
                    sprite.container.visible = false;
                }
                continue;
            }

            sprite.container.visible = true;
            if (slot !== sprite.owner) adoptSlot(sprite, slot);
            stepSprite(sprite, slot, k);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface CardSprite {
    container: Container;
    bg: Graphics;
    label: Text;
    // The slot this sprite currently renders; cosmetic state is keyed by it.
    owner: OrderedSlot<Card> | undefined;
    x: number;
    y: number;
    alpha: number;
    scale: number;
}

function createCardSprite(): CardSprite {
    const container = new Container();
    container.pivot.set(CARD_W / 2, CARD_H / 2);

    const bg = new Graphics();
    container.addChild(bg);

    const label = new Text({ text: '', style: LABEL_STYLE });
    label.anchor.set(0.5);
    label.position.set(CARD_W / 2, CARD_H / 2);
    container.addChild(label);

    return { container, bg, label, owner: undefined, x: 0, y: 0, alpha: 0, scale: ENTRANCE_SCALE };
}

function adoptSlot(sprite: CardSprite, slot: OrderedSlot<Card>): void {
    sprite.owner = slot;
    drawCardBg(sprite.bg, slot.value.color);
    sprite.label.text = slot.value.label;

    const ordinal = slot.ordinal < 0 ? 0 : slot.ordinal;
    sprite.x = ORIGIN_X + ordinal * PITCH;
    sprite.y = ROW_Y;
    sprite.alpha = 0;
    sprite.scale = ENTRANCE_SCALE;
}

function stepSprite(sprite: CardSprite, slot: OrderedSlot<Card>, k: number): void {
    let targetX: number;
    let targetY: number;
    let targetAlpha: number;
    let targetScale: number;

    if (slot.isLive) {
        targetX = ORIGIN_X + slot.ordinal * PITCH;
        targetY = ROW_Y;
        targetAlpha = 1;
        targetScale = 1;
    }
    else {
        // Detached (pending release): fade and float up, holding the last x.
        targetX = sprite.x;
        targetY = ROW_Y - EXIT_RISE;
        targetAlpha = 0;
        targetScale = EXIT_SCALE;
    }

    sprite.x += (targetX - sprite.x) * k;
    sprite.y += (targetY - sprite.y) * k;
    sprite.alpha += (targetAlpha - sprite.alpha) * k;
    sprite.scale += (targetScale - sprite.scale) * k;

    sprite.container.position.set(sprite.x, sprite.y);
    sprite.container.alpha = sprite.alpha;
    sprite.container.scale.set(sprite.scale);
}

function drawCardBg(bg: Graphics, color: number): void {
    bg.clear();
    bg.roundRect(0, 0, CARD_W, CARD_H, 10);
    bg.fill(color);
    bg.stroke({ color: 0x0d1117, width: 2 });
}

const CARD_W = 60;
const CARD_H = 76;
const GAP = 16;
const PITCH = CARD_W + GAP;
const ORIGIN_X = 24 + CARD_W / 2;
const ROW_Y = 165;
const SMOOTH_MS = 110;
const EXIT_RISE = 56;
const EXIT_SCALE = 0.7;
const ENTRANCE_SCALE = 0.4;
const MAX_SPRITES = 12;

const TITLE_STYLE = { fill: 0xe6edf3, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold' } as const;
const CAPTION_STYLE = { fill: 0x8b949e, fontSize: 14, fontFamily: 'monospace' } as const;
const LABEL_STYLE = { fill: 0xffffff, fontSize: 30, fontFamily: 'monospace', fontWeight: 'bold' } as const;
