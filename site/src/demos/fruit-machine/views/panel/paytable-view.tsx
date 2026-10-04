/** @jsxImportSource @mvtjs/html */
import { type Paytable, PICTURE_KINDS, type SymbolKind } from '../../data';
import { formatCredits } from '../shared';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PaytableViewBindings {
    /** Fixed: the machine's pays never change. */
    readonly paytable: Paytable;
    readonly urlFor: (kind: SymbolKind) => string;
    readonly nameFor: (kind: SymbolKind) => string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** What each picture pays per way, for three, four and five reels. */
export function PaytableView(bindings: PaytableViewBindings): Element {
    const { paytable, urlFor, nameFor } = bindings;

    return (
        <div class="paytable">
            <table>
                <thead>
                    <tr>
                        <th text="Symbol" />
                        <th class="number" text="x3" />
                        <th class="number" text="x4" />
                        <th class="number" text="x5" />
                    </tr>
                </thead>
                <tbody>
                    {PICTURE_KINDS.map((kind) => (
                        <tr>
                            <td>
                                <img src={urlFor(kind)} alt="" />
                                <span text={nameFor(kind)} />
                            </td>
                            <td class="number" text={formatCredits(paytable[kind][3])} />
                            <td class="number" text={formatCredits(paytable[kind][4])} />
                            <td class="number" text={formatCredits(paytable[kind][5])} />
                        </tr>
                    ))}
                </tbody>
            </table>
            <p class="paytable-note" text="The wild stands in for any fruit, on reels 2 to 5. Every way pays." />
        </div>
    );
}
