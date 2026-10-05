/** @jsxImportSource @mvtjs/pixi */
import type { Container, Graphics } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { formatCredits } from '../shared';
import { FONT_FAMILY, METER_FACE, METER_HEIGHT, METER_LABEL, METER_VALUE, METERS_Y, WINDOW_WIDTH, WINDOW_X } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MetersViewBindings {
    readonly balance: () => number;
    /** Fixed: the bet never changes. */
    readonly bet: number;
    readonly win: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Balance, bet and win, on three plates under the window. */
export function MetersView(bindings: MetersViewBindings): Container {
    const balanceText = memoiseLast(formatCredits);
    const winText = memoiseLast(formatCredits);
    const betText = formatCredits(bindings.bet);

    return (
        <container y={METERS_Y}>
            <PlateView index={0} label="BALANCE" value={() => balanceText(bindings.balance())} />
            <PlateView index={1} label="BET" value={() => betText} />
            <PlateView index={2} label="WIN" value={() => winText(bindings.win())} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PLATE_GAP = 12;
const PLATE_WIDTH = (WINDOW_WIDTH - 2 * PLATE_GAP) / 3;

const LABEL_STYLE = { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '800', letterSpacing: 2, fill: METER_LABEL };
const VALUE_STYLE = { fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: '900', fill: METER_VALUE };

interface PlateViewBindings {
    readonly index: number;
    readonly label: string;
    readonly value: () => string;
}

function PlateView(bindings: PlateViewBindings): Container {
    return (
        <container x={WINDOW_X + bindings.index * (PLATE_WIDTH + PLATE_GAP)}>
            <graphics ref={drawPlate} />
            <text text={bindings.label} x={PLATE_WIDTH / 2} y={14} anchor={0.5} style={LABEL_STYLE} />
            <text text={bindings.value} x={PLATE_WIDTH / 2} y={37} anchor={0.5} style={VALUE_STYLE} />
        </container>
    );
}

function drawPlate(g: Graphics): void {
    g.roundRect(0, 0, PLATE_WIDTH, METER_HEIGHT, 14).fill(METER_FACE);
}
