/** @jsxImportSource @mvtjs/pixi */
import type { Container, Graphics } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { formatCredits } from '../shared';
import { BACKDROP, FONT_FAMILY, FRAME_SHADE, METER_VALUE, SCREEN_WIDTH, SHADOW, WHITE } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WinBannerViewBindings {
    readonly isShown: () => boolean;
    /** The spin's whole win. The banner counts up to it. */
    readonly amount: () => number;
    /** A line about the current step, such as the way's fruit and payout. */
    readonly caption: () => string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * "WIN 120" on a banner over the title, counting up to the spin's win as the
 * celebration begins. The count is presentation state: the
 * model pays the whole win at once; only the banner takes its time.
 */
export function WinBannerView(bindings: WinBannerViewBindings): Container {
    let shownAmount = bindings.amount();
    const amountText = memoiseLast((amount: number) => `WIN ${formatCredits(amount)}`);

    return (
        <container x={SCREEN_WIDTH / 2} y={BANNER_Y} visible={bindings.isShown} onUpdate={countUp}>
            <graphics ref={drawBanner} />
            <text text={() => amountText(Math.round(shownAmount))} y={-9} anchor={0.5} style={AMOUNT_STYLE} />
            <text text={bindings.caption} y={17} anchor={0.5} style={CAPTION_STYLE} />
        </container>
    );

    function countUp(deltaMs: number): void {
        const amount = bindings.amount();
        // A new spin clears the win: start again from nothing
        if (amount < shownAmount) shownAmount = 0;
        const step = Math.max(amount * (deltaMs / COUNT_UP_MS), 1);
        shownAmount = Math.min(amount, shownAmount + step);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the count takes to reach the win. */
const COUNT_UP_MS = 700;
const BANNER_WIDTH = 400;
const BANNER_HEIGHT = 62;
/** Over the title's banner, which it hides while it shows. */
const BANNER_Y = 40;

const AMOUNT_STYLE = { fontFamily: FONT_FAMILY, fontSize: 28, fontWeight: '900', letterSpacing: 2, fill: METER_VALUE };
const CAPTION_STYLE = { fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '800', letterSpacing: 1, fill: WHITE };

function drawBanner(g: Graphics): void {
    const x = -BANNER_WIDTH / 2;
    const y = -BANNER_HEIGHT / 2;
    g.roundRect(x, y + 6, BANNER_WIDTH, BANNER_HEIGHT, BANNER_HEIGHT / 2).fill(SHADOW);
    g.roundRect(x, y, BANNER_WIDTH, BANNER_HEIGHT, BANNER_HEIGHT / 2).fill(FRAME_SHADE);
    g.roundRect(x + 5, y + 5, BANNER_WIDTH - 10, BANNER_HEIGHT - 10, (BANNER_HEIGHT - 10) / 2).fill(BACKDROP);
}
