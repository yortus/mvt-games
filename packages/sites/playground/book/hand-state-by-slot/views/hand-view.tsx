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
 * The hand, as a `<List>` of the hand's storage slots, and a button that
 * deals another card. A view model keeps each card's eased position and
 * fade by storage slot. Play a card, and it fades out where it stood, while
 * the cards to its right slide left over it.
 */
export function HandView({ model }: HandViewBindings): Container {
    const handLayout = createHandViewModel({ slots: model.slots });

    return (
        <container onUpdate={handLayout.update}>
            <text text="State kept by storage slot" x={40} y={28} style={TITLE_STYLE} />
            <text text="Click a card to play it. It fades out, and the rest slide." x={40} y={60} style={HINT_STYLE} />
            <container x={ROW_X} y={ROW_Y}>
                <List items={model.slots}>
                    {(slot, index) => (
                        <CardView
                            label={() => slot().value.label}
                            color={() => slot().value.color}
                            x={() => handLayout.xAt(index)}
                            alpha={() => handLayout.alphaAt(index)}
                            onPressed={() => model.playAt(slot().ordinal)}
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
