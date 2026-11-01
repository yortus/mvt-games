/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import type { HandModel } from '../models';
import { ButtonView } from './button-view';
import { CardView } from './card-view';
import { createHandViewModel } from './hand-view-model';

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
 * The hand, as a `<List>` of cards, and a button that deals another. A view
 * model keeps each card's eased position and fade by the card's id, so a
 * card's state moves with it from slot to slot. Play a card, and the cards
 * to its right slide left. The played card itself is gone from the array,
 * so it vanishes.
 */
export function HandView({ model }: HandViewBindings): Container {
    const handLayout = createHandViewModel({
        count: () => model.hand.length,
        idAt: (index) => model.hand[index].id,
    });

    return (
        <container onUpdate={handLayout.update}>
            <text text="State kept by card id" x={40} y={28} style={TITLE_STYLE} />
            <text text="Click a card to play it. The rest slide, but it vanishes." x={40} y={60} style={HINT_STYLE} />
            <container x={ROW_X} y={ROW_Y}>
                <List items={model.hand}>
                    {(card, index) => (
                        <CardView
                            label={() => card().label}
                            color={() => card().color}
                            x={() => handLayout.xAt(index)}
                            alpha={() => handLayout.alphaAt(index)}
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

/** Where the first card's middle is. */
const ROW_X = 72;
const ROW_Y = 180;

const TITLE_STYLE = { fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold', fill: 0xe6edf3 };
const HINT_STYLE = { fontFamily: 'monospace', fontSize: 13, fill: 0x8b949e };
