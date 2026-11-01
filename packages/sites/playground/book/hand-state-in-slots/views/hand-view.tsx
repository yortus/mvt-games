/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import type { HandModel } from '../models';
import { ButtonView } from './button-view';
import { CardView } from './card-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HandViewBindings {
    readonly model: HandModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The hand, as a `<List>` of cards, and a button that deals another. Each
 * card view keeps its own eased `x` and fade, so they belong to its slot.
 * Play a card, and the cards to its right jump left rather than slide, and
 * none of them fades.
 */
export function HandView({ model }: HandViewBindings): Container {
    return (
        <container>
            <text text="State kept in each slot's view" x={40} y={28} style={TITLE_STYLE} />
            <text text="Click a card to play it. Nothing slides, and nothing fades out." x={40} y={60} style={HINT_STYLE} />
            <container x={ROW_X} y={ROW_Y}>
                <List items={model.hand}>
                    {(card, index) => (
                        <CardView
                            label={() => card().label}
                            color={() => card().color}
                            targetX={index * PITCH}
                            onPressed={() => model.playAt(index)}
                        />
                    )}
                </List>
            </container>
            <ButtonView label="Deal" x={504} y={296} onPressed={model.deal} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The distance from one card's middle to the next, in pixels. */
const PITCH = 80;
/** Where the first card's middle is. */
const ROW_X = 72;
const ROW_Y = 180;

const TITLE_STYLE = { fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold', fill: 0xe6edf3 };
const HINT_STYLE = { fontFamily: 'monospace', fontSize: 13, fill: 0x8b949e };
