/** @jsxImportSource #pixi-jsx */

import { type Container, type Graphics, Rectangle } from 'pixi.js';
import { List } from '#pixi-jsx';
import type { CardRowModel } from './card-row-model';
import { createArrayRowViewModel } from './array-row-view-model';
import { createSlotRowViewModel } from './slot-row-view-model';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Both forms of the row, one above the other. Each is an index-addressed
 * `<List>`; they differ in what the list projects and where each card's
 * presentation state is kept. The top-level view, so it takes the model itself.
 */
export function createCardRowView(model: CardRowModel): Container {
    const { cardArray, cardSlots } = model;

    const arrayRow = createArrayRowViewModel({
        getCount: () => cardArray.length,
        getId: (index) => cardArray[index].id,
        pitchPx: CARD_PITCH,
    });

    const slotRow = createSlotRowViewModel({ slots: cardSlots.slots, pitchPx: CARD_PITCH });

    return (
        <container label="reordering-lists" onUpdate={update}>
            <text text="Reordering lists" x={MARGIN} y={16} style={TITLE_STYLE} />
            <text text={() => model.caption} x={MARGIN} y={46} style={CAPTION_STYLE} />
            <text text="Tap a card to move it to the front." x={MARGIN} y={70} style={HINT_STYLE} />

            <text text="Plain array: state kept per card id" x={MARGIN} y={104} style={HEADING_STYLE} />
            <text text="reorders slide; a removed card vanishes" x={MARGIN} y={124} style={HINT_STYLE} />
            <container x={ROW_X} y={ARRAY_ROW_Y}>
                <List items={cardArray}>
                    {(card, index) => (
                        <CardView
                            label={() => card().label}
                            color={() => card().color}
                            x={() => arrayRow.getX(index)}
                            alpha={() => arrayRow.getAlpha(index)}
                            scale={() => arrayRow.getScale(index)}
                            onPressed={() => model.moveToFront(card())}
                        />
                    )}
                </List>
            </container>

            <text text="OrderedSlotList: state kept per slot" x={MARGIN} y={262} style={HEADING_STYLE} />
            <text text="reorders slide; a removed card fades out" x={MARGIN} y={282} style={HINT_STYLE} />
            <container x={ROW_X} y={SLOT_ROW_Y}>
                <List items={cardSlots.slots}>
                    {(slot, index) => (
                        <CardView
                            label={() => slot().value.label}
                            color={() => slot().value.color}
                            x={() => slotRow.getX(index)}
                            y={() => slotRow.getY(index)}
                            alpha={() => slotRow.getAlpha(index)}
                            scale={() => slotRow.getScale(index)}
                            onPressed={() => model.moveToFront(slot().value)}
                        />
                    )}
                </List>
            </container>
        </container>
    );

    function update(deltaMs: number): void {
        arrayRow.update(deltaMs);
        slotRow.update(deltaMs);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CARD_W = 60;
const CARD_H = 76;
const CARD_PITCH = CARD_W + 16;
const MARGIN = 24;
/** Card positions are card centres, so the row starts half a card in. */
const ROW_X = MARGIN + CARD_W / 2;
const ARRAY_ROW_Y = 196;
const SLOT_ROW_Y = 360;

const TITLE_STYLE = { fill: 0xe6edf3, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold' };
const HEADING_STYLE = { fill: 0xe6edf3, fontSize: 15, fontFamily: 'monospace' };
const CAPTION_STYLE = { fill: 0xf2cc60, fontSize: 14, fontFamily: 'monospace' };
const HINT_STYLE = { fill: 0x8b949e, fontSize: 12, fontFamily: 'monospace' };
const LABEL_STYLE = { fill: 0xffffff, fontSize: 30, fontFamily: 'monospace', fontWeight: 'bold' };

// --- Card ---------------------------------------------------------------------

interface CardViewProps {
    label: () => string;
    color: () => number;
    /** Centre X, in pixels. */
    x: () => number;
    /** Centre Y, in pixels. 0 if omitted. */
    y?: () => number;
    alpha: () => number;
    scale: () => number;
    onPressed?: () => void;
}

/** One card. Everything card-dependent is a getter, since a list slot changes cards. */
function CardView(props: CardViewProps): Container {
    return (
        <container
            x={props.x}
            y={props.y ?? 0}
            alpha={props.alpha}
            scale={props.scale}
            pivotX={CARD_W / 2}
            pivotY={CARD_H / 2}
            cursor="pointer"
            hitArea={new Rectangle(0, 0, CARD_W, CARD_H)}
            onPointerTap={() => props.onPressed?.()}
        >
            <graphics ref={(g) => redrawOnColorChange(g, props.color)} />
            <text text={props.label} x={CARD_W / 2} y={CARD_H / 2} anchor={0.5} style={LABEL_STYLE} />
        </container>
    );
}

/** The card's face depends on its color, so it is redrawn when the slot's card changes color. */
function redrawOnColorChange(g: Graphics, getColor: () => number): void {
    let drawnColor = -1;
    const ownRefresh = g.onRefresh;
    g.onRefresh = () => {
        const result = ownRefresh?.();
        const color = getColor();
        if (color !== drawnColor) {
            drawnColor = color;
            g.clear()
                .roundRect(0, 0, CARD_W, CARD_H, 10)
                .fill(color)
                .stroke({ color: 0x0d1117, width: 2 });
        }
        return result;
    };
}
