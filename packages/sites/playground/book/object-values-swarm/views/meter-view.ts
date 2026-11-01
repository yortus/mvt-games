import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { FrameMeter } from '../meter';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MeterViewBindings {
    readonly meter: FrameMeter;
    /** A line about the work each tick does, shown above the times. */
    readonly note: () => string;
    /** The width of the panel, in pixels. */
    readonly width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * How much of a 60 frames a second frame the models and views take. On the
 * left, a bar the length of a frame, filled to the average tick's share,
 * with a mark at the slowest. On the right, the last few seconds of ticks,
 * one bar each, where a frame's time is the full height.
 *
 * Add it to the stage last. Its refresh is then the last one in each tick,
 * which is when it stops the meter's clock.
 */
export function MeterView({ meter, note, width }: MeterViewBindings): Container {
    const view = new Container();
    const graphWidth = meter.historyLength * BAR_WIDTH;
    const barWidth = width - graphWidth - 24;

    const noteText = new Text({ text: '', style: { ...TEXT_STYLE, fill: 0xffcc66 } });

    const budget = new Graphics().rect(0, BAR_Y, barWidth, BAR_HEIGHT).fill(0x262c3a);
    const used = new Sprite(Texture.WHITE);
    used.tint = 0x55cc77;
    used.position.set(0, BAR_Y);
    used.height = BAR_HEIGHT;
    const worst = new Sprite(Texture.WHITE);
    worst.tint = 0xffffff;
    worst.position.set(0, BAR_Y - 3);
    worst.width = 2;
    worst.height = BAR_HEIGHT + 6;

    const timesText = new Text({ text: '', style: TEXT_STYLE });
    timesText.y = BAR_Y + BAR_HEIGHT + 10;

    // The graph, with a line at the top for a whole frame
    const graph = new Container();
    graph.position.set(width - graphWidth, GRAPH_Y);
    const graphBack = new Graphics()
        .rect(0, 0, graphWidth, GRAPH_HEIGHT).fill(0x161b26)
        .moveTo(0, 0).lineTo(graphWidth, 0).stroke({ color: 0x8a6a6a, width: 1 });
    const frameLabel = new Text({ text: '16.7 ms', style: { ...TEXT_STYLE, fontSize: 10, fill: 0x8a6a6a } });
    frameLabel.position.set(2, 2);
    graph.addChild(graphBack, frameLabel);
    const bars: Sprite[] = [];
    for (let i = 0; i < meter.historyLength; i++) {
        const bar = new Sprite(Texture.WHITE);
        bar.anchor.set(0, 1);
        bar.position.set(i * BAR_WIDTH, GRAPH_HEIGHT);
        bar.width = BAR_WIDTH - 0.5;
        bars.push(bar);
        graph.addChild(bar);
    }

    view.addChild(noteText, budget, used, worst, timesText, graph);

    // The text is made again only when the meter takes a new sample, or warms up
    const timesLabel = createComputed({
        watch: () => (meter.isWarm ? meter.sampleCount : -1),
        compute: () => (meter.isWarm ? formatTimes(meter.averageMs, meter.worstMs) : WARMING_UP),
    });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        meter.endTick();

        used.width = barWidth * shareOfFrame(meter.averageMs);
        worst.x = barWidth * shareOfFrame(meter.worstMs);
        worst.visible = meter.isWarm;
        noteText.text = note();
        timesText.text = timesLabel();

        for (let i = 0; i < bars.length; i++) {
            const ms = meter.msAt(i);
            bars[i].height = GRAPH_HEIGHT * shareOfFrame(ms);
            bars[i].tint = ms > FRAME_MS ? 0xff5566 : 0x55cc77;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A frame at 60 frames a second, in ms. */
const FRAME_MS = 1000 / 60;

const BAR_Y = 32;
const BAR_HEIGHT = 14;
const BAR_WIDTH = 2;
const GRAPH_Y = 24;
const GRAPH_HEIGHT = 64;

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: 12, fill: 0xd8deea };

const WARMING_UP = 'Timing starts in a moment, once the engine has warmed up.';

/** How much of a frame some time takes, from 0 to 1. */
function shareOfFrame(ms: number): number {
    return Math.min(1, ms / FRAME_MS);
}

function formatTimes(averageMs: number, worstMs: number): string {
    return `Models and views: ${averageMs.toFixed(2)} ms of 16.7, ${worstMs.toFixed(2)} at worst`;
}
