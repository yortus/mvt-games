import { Container, Graphics, Text } from 'pixi.js';
import {
    FONT,
    PANEL_BG,
    PANEL_BORDER,
    PANEL_FLASH,
    PANEL_RADIUS,
    PANEL_PAD,
    TEXT_MAIN,
    TEXT_DIM,
    TITLE_SIZE,
    LABEL_SIZE,
    TEXT_RESOLUTION,
} from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A titled panel frame with a live "recomputes" counter and a border that
 * flashes when its derived structure recomputes. Specific views populate
 * {@link PanelView.content} and give it its own `onRender`.
 */
export interface PanelView {
    readonly view: Container;
    readonly content: Container;
    readonly contentWidth: number;
    readonly contentHeight: number;
}

export interface PanelViewOptions {
    width: number;
    height: number;
    title: string;
    subtitle?: string;
    /** Number of times the panel's derived structure has recomputed. */
    getRecomputes(): number;
    /** Flash intensity 0..1, decaying after each recompute. */
    getFlash(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPanelView(options: PanelViewOptions): PanelView {
    const { width, height, title, subtitle, getRecomputes, getFlash } = options;

    const view = new Container();

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, PANEL_RADIUS).fill({ color: PANEL_BG });
    view.addChild(bg);

    const border = new Graphics();
    view.addChild(border);

    const titleText = new Text({
        text: title,
        resolution: TEXT_RESOLUTION,
        style: { fontFamily: FONT, fontSize: TITLE_SIZE, fill: TEXT_MAIN, fontWeight: 'bold' },
    });
    titleText.position.set(PANEL_PAD, PANEL_PAD);
    view.addChild(titleText);

    const counterText = new Text({
        text: '',
        resolution: TEXT_RESOLUTION,
        style: { fontFamily: FONT, fontSize: LABEL_SIZE, fill: TEXT_DIM },
    });
    counterText.anchor.set(1, 0);
    counterText.position.set(width - PANEL_PAD, PANEL_PAD + 1);
    view.addChild(counterText);

    let contentTop = PANEL_PAD + TITLE_SIZE + 8;
    if (subtitle) {
        const subtitleText = new Text({
            text: subtitle,
            resolution: TEXT_RESOLUTION,
            style: { fontFamily: FONT, fontSize: LABEL_SIZE, fill: TEXT_DIM },
        });
        subtitleText.position.set(PANEL_PAD, PANEL_PAD + TITLE_SIZE + 4);
        view.addChild(subtitleText);
        contentTop = PANEL_PAD + TITLE_SIZE + LABEL_SIZE + 12;
    }

    const content = new Container();
    content.position.set(PANEL_PAD, contentTop);
    view.addChild(content);

    const contentWidth = width - PANEL_PAD * 2;
    const contentHeight = height - contentTop - PANEL_PAD;

    let prevRecomputes = -1;
    let prevBorderColor = -1;

    view.onRender = refreshFrame;

    return { view, content, contentWidth, contentHeight };

    // ---- Refresh -----------------------------------------------------------

    function refreshFrame(): void {
        const flash = getFlash();
        const color = lerpColor(PANEL_BORDER, PANEL_FLASH, flash);
        if (color !== prevBorderColor) {
            prevBorderColor = color;
            border.clear();
            border.roundRect(0, 0, width, height, PANEL_RADIUS)
                .stroke({ color, width: 1 + flash * 1.5, alignment: 1 });
        }

        const recomputes = getRecomputes();
        if (recomputes !== prevRecomputes) {
            prevRecomputes = recomputes;
            counterText.text = `recomputes: ${recomputes}`;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
}
