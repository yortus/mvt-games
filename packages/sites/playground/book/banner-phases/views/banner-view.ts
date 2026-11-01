import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { BannerPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BannerViewBindings {
    readonly phase: () => BannerPhase;
    /** How far through the phase, from 0 to 1. */
    readonly progress: () => number;
    /** The words on the banner. */
    readonly text: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The banner, which slides and fades in from the left as it opens, and back
 * out as it closes. It reads the phase and the progress, and needs no timer
 * of its own.
 */
export function BannerView(bindings: BannerViewBindings): Container {
    const view = new Container();

    // The banner, drawn once around its own centre
    const banner = new Container();
    const back = new Graphics()
        .roundRect(-BANNER_WIDTH / 2, -BANNER_HEIGHT / 2, BANNER_WIDTH, BANNER_HEIGHT, 10)
        .fill(0xf2c14e)
        .stroke({ color: 0xffe9a8, width: 3 });
    const words = new Text({
        text: bindings.text,
        style: { fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold', fill: 0x2a1d05 },
    });
    words.anchor.set(0.5, 0.5);
    banner.addChild(back, words);
    view.addChild(banner);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const phase = bindings.phase();
        const progress = bindings.progress();

        banner.visible = phase !== 'closed';
        if (phase === 'opening') {
            banner.alpha = progress;
            banner.x = lerp(OFF_SCREEN_X, CENTRE_X, progress);
        }
        else if (phase === 'open') {
            banner.alpha = 1;
            banner.x = CENTRE_X;
        }
        else if (phase === 'closing') {
            banner.alpha = 1 - progress;
            banner.x = lerp(CENTRE_X, OFF_SCREEN_X, progress);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the banner's centre rests while it's open, in pixels from the view's left edge. */
const CENTRE_X = 320;
const BANNER_WIDTH = 280;
const BANNER_HEIGHT = 64;
/** Where the banner's centre is when it's just out of sight, to the left. */
const OFF_SCREEN_X = -BANNER_WIDTH / 2;

/** Blends from `a` to `b` as `t` goes from 0 to 1. */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
