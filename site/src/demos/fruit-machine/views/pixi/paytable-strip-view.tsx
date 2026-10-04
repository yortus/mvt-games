/** @jsxImportSource @mvtjs/pixi/jsx */
import type { Container, Texture } from 'pixi.js';
import { type Paytable, PICTURE_KINDS, type SymbolKind, type WinLength } from '../../data';
import { FONT_FAMILY, METER_LABEL, WHITE } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PaytableStripViewBindings {
    /** Fixed: the machine's pays never change. */
    readonly paytable: Paytable;
    readonly textureFor: (kind: SymbolKind) => Texture;
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A column of the fruits with their pays for 3, 4 and 5 reels. Static. */
export function PaytableStripView(bindings: PaytableStripViewBindings): Container {
    const { paytable, textureFor } = bindings;

    return (
        <container x={bindings.x} y={bindings.y}>
            <text text="PAYS PER WAY" style={HEADING_STYLE} />
            {PAY_LENGTHS.map((length, i) => <text text={`x${length}`} x={PAY_COLUMN_X + i * PAY_COLUMN_WIDTH} y={22} style={HEADING_STYLE} />)}
            {PICTURE_KINDS.map((kind, i) => (
                <container y={44 + i * 46}>
                    <sprite texture={textureFor(kind)} width={40} height={40} />
                    {PAY_LENGTHS.map((length, j) => (
                        <text text={String(paytable[kind][length])} x={PAY_COLUMN_X + j * PAY_COLUMN_WIDTH} y={10} style={PAYS_STYLE} />
                    ))}
                </container>
            ))}
            <sprite texture={textureFor('wild')} y={44 + 6 * 46} width={40} height={40} />
            <text text={'stands in\nfor any fruit'} x={50} y={44 + 6 * 46 + 2} style={NOTE_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HEADING_STYLE = { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '800', letterSpacing: 1, fill: METER_LABEL };
const PAYS_STYLE = { fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: '800', fill: WHITE };
const NOTE_STYLE = { fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '600', fill: METER_LABEL, lineHeight: 16 };

const PAY_LENGTHS: readonly WinLength[] = [3, 4, 5];
const PAY_COLUMN_X = 48;
const PAY_COLUMN_WIDTH = 34;
