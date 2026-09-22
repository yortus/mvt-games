import { Container, Graphics, Text } from 'pixi.js';
import { createPanelView } from './panel-view';
import { KINDS, KIND_COLORS } from '../constants';
import { FONT, LABEL_SIZE, TEXT_MAIN, TEXT_RESOLUTION } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HistogramViewBindings {
    /** Per-kind counts, indexed by KIND_INDEX. Reused buffer - read only. */
    getCounts(): Int32Array;
    getRecomputes(): number;
    getFlash(): number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface HistogramViewOptions extends HistogramViewBindings {
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHistogramView(options: HistogramViewOptions): Container {
    const { getCounts, getRecomputes, getFlash } = options;

    const panel = createPanelView({
        width: options.width,
        height: options.height,
        title: 'Kind histogram',
        subtitle: 'aggregate (counts all kinds)',
        getRecomputes,
        getFlash,
    });

    const rowH = panel.contentHeight / KINDS.length;
    const barH = Math.min(22, rowH * 0.56);
    const swatch = Math.min(14, barH);
    const barStartX = swatch + 10;
    const maxBarW = panel.contentWidth - barStartX - 34;

    const bars = new Graphics();
    panel.content.addChild(bars);

    const countTexts: Text[] = [];
    for (let k = 0; k < KINDS.length; k++) {
        const cy = k * rowH + (rowH - barH) / 2;

        const sw = new Graphics();
        sw.roundRect(0, cy + (barH - swatch) / 2, swatch, swatch, 2).fill({ color: KIND_COLORS[KINDS[k]] });
        panel.content.addChild(sw);

        const count = new Text({
            text: '0',
            resolution: TEXT_RESOLUTION,
            style: { fontFamily: FONT, fontSize: LABEL_SIZE, fill: TEXT_MAIN },
        });
        count.anchor.set(0, 0.5);
        count.position.set(barStartX + maxBarW + 8, cy + barH / 2);
        panel.content.addChild(count);
        countTexts.push(count);
    }

    panel.content.onRender = refresh;

    return panel.view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const counts = getCounts();
        let max = 1;
        for (let k = 0; k < KINDS.length; k++) {
            if (counts[k] > max) max = counts[k];
        }

        bars.clear();
        for (let k = 0; k < KINDS.length; k++) {
            const cy = k * rowH + (rowH - barH) / 2;
            const len = Math.max(2, (counts[k] / max) * maxBarW);
            bars.roundRect(barStartX, cy, len, barH, 3).fill({ color: KIND_COLORS[KINDS[k]] });

            const text = String(counts[k]);
            if (countTexts[k].text !== text) countTexts[k].text = text;
        }
    }
}
