import { Container, Graphics, Text } from 'pixi.js';
import { createSequenceReaction, type Sequence } from '#common';
import { GRID_COLS, GRID_ROWS } from '../../data';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BannerViewBindings {
    getMatchSequence(): Sequence<'bannerIn' | 'bannerHold' | 'bannerOut'>;
    getCascadeStep(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBannerView(bindings: BannerViewBindings): Container {
    const view = new Container();

    // Ribbon background + text
    const banner = new Container();
    const ribbon = new Graphics();
    ribbon.roundRect(
        -BANNER_WIDTH * 0.5, -BANNER_HEIGHT * 0.5,
        BANNER_WIDTH, BANNER_HEIGHT,
        BANNER_CORNER_RADIUS,
    ).fill(RIBBON_COLOUR);
    const bannerText = new Text({
        text: '',
        style: {
            fontFamily: 'monospace',
            fontSize: BANNER_FONT_SIZE,
            fill: 0xffffff,
            fontWeight: 'bold',
            align: 'center',
        },
        anchor: { x: 0.5, y: 0.5 },
    });
    banner.addChild(ribbon, bannerText);
    banner.alpha = 0;
    banner.position.set(BOARD_WIDTH_PX * 0.5, BOARD_HEIGHT_PX * 0.5);
    view.addChild(banner);

    const updateBanner = createSequenceReaction(bindings.getMatchSequence(), {
        bannerIn: {
            entering: () => {
                const cascade = bindings.getCascadeStep();
                if (cascade < MIN_CASCADE_FOR_BANNER) return;
                bannerText.text = cascade >= 5
                    ? `SUPER COMBO x${cascade}!`
                    : `MEGA COMBO x${cascade}!`;
                // Start off-screen to the right
                banner.position.x = BOARD_WIDTH_PX + BANNER_WIDTH;
            },
            active: (progress) => {
                if (bindings.getCascadeStep() < MIN_CASCADE_FOR_BANNER) return;
                const targetX = BOARD_WIDTH_PX * 0.5;
                const startX = BOARD_WIDTH_PX + BANNER_WIDTH;
                banner.position.x = startX + (targetX - startX) * easeOutBack(progress);
                banner.alpha = progress;
                banner.scale.set(1);
            },
        },
        bannerHold: {
            active: (progress) => {
                if (bindings.getCascadeStep() < MIN_CASCADE_FOR_BANNER) return;
                banner.position.x = BOARD_WIDTH_PX * 0.5;
                banner.alpha = 1;
                // Subtle breathing pulse
                const pulse = 1 + 0.03 * Math.sin(progress * Math.PI * 4);
                banner.scale.set(pulse);
            },
        },
        bannerOut: {
            inactive: () => {
                banner.alpha = 0;
                banner.scale.set(1);
            },
            active: (progress) => {
                if (bindings.getCascadeStep() < MIN_CASCADE_FOR_BANNER) return;
                const startX = BOARD_WIDTH_PX * 0.5;
                const targetX = -BANNER_WIDTH;
                banner.position.x = startX + (targetX - startX) * progress * progress;
                banner.alpha = 1 - progress;
                banner.scale.set(1);
            },
        },
    });

    view.onRender = updateBanner;
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BOARD_WIDTH_PX = GRID_COLS * CELL_WIDTH_PX;
const BOARD_HEIGHT_PX = GRID_ROWS * CELL_HEIGHT_PX;

/** Minimum cascade step before the banner appears. */
const MIN_CASCADE_FOR_BANNER = 4;

const BANNER_WIDTH = 800;
const BANNER_HEIGHT = 120;
const BANNER_CORNER_RADIUS = 20;
const BANNER_FONT_SIZE = 64;
const RIBBON_COLOUR = 0xCC2244;

/** Overshoot ease for the banner slide-in. */
function easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
