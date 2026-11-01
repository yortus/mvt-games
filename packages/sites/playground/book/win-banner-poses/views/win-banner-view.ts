import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the count takes to reach a new amount, in ms. */
const COUNT_UP_MS = 1000;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WinBannerViewBindings {
    readonly isShown: () => boolean;
    /** The amount won. When it rises, the banner counts up to it. */
    readonly amount: () => number;
    readonly caption: () => string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A banner that shows a win, centred on 0, 0. When the amount rises, the
 * number counts up to it over a second, slowing as it gets close, and turns
 * gold when it gets there. The count is presentation state, which the
 * view's update step moves on. A smaller amount shows at once.
 */
export function WinBannerView(bindings: WinBannerViewBindings): Container {
    const view = new Container();

    const panel = new Graphics();
    panel.roundRect(-130, -60, 260, 120, 18).fill(0x3a1d5c).stroke({ color: 0xffcc33, width: 4 });
    const captionText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 20, fill: 0xffffff } });
    captionText.anchor.set(0.5, 0.5);
    captionText.y = -28;
    // Drawn in white, and tinted gold once the count has reached a win
    const amountText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 44, fill: 0xffffff, fontWeight: 'bold' } });
    amountText.anchor.set(0.5, 0.5);
    amountText.y = 16;
    view.addChild(panel, captionText, amountText);

    // The count starts at the amount the banner was built with, so the
    // view is valid before its first update
    let fromAmount = bindings.amount();
    let toAmount = fromAmount;
    let shownAmount = fromAmount;
    let countMs = COUNT_UP_MS;

    // The texts are made again only when what they show changes
    const captionLabel = createComputed({ watch: bindings.caption, compute: (caption) => caption });
    const amountLabel = createComputed({ watch: () => Math.floor(shownAmount), compute: (amount) => String(amount) });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        const amount = bindings.amount();
        if (amount !== toAmount) {
            // A rise counts up from what's shown. A drop shows at once.
            fromAmount = amount > shownAmount ? shownAmount : amount;
            toAmount = amount;
            countMs = 0;
        }
        countMs = Math.min(COUNT_UP_MS, countMs + deltaMs);
        const share = 1 - (1 - countMs / COUNT_UP_MS) ** 3;
        shownAmount = fromAmount + (toAmount - fromAmount) * share;
    }

    function refresh(): void {
        view.visible = bindings.isShown();
        captionText.text = captionLabel();
        amountText.text = amountLabel();
        const isCountDone = countMs >= COUNT_UP_MS && shownAmount > 0;
        amountText.tint = isCountDone ? 0xffcc33 : 0xffffff;
    }
}
