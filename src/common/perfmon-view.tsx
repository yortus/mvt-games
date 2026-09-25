/** @jsxImportSource #pixi-jsx */

import type { Container, Graphics } from 'pixi.js';
import type { FrameStatKind, FrameStats } from './frame-stats';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PerfmonViewBindings {
    /** The stats to show, or undefined where there are none (e.g. rendering a thumbnail). */
    getFrameStats(): FrameStats | undefined;
}

/** Size of the panel, for laying it out. */
export const PERFMON_WIDTH = 220;
export const PERFMON_HEIGHT = 80;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A small panel of frame timing: frames per second, CPU and GPU milliseconds
 * per frame, and prop reads per frame (`RPF`, e.g. `21K`), each with a
 * sparkline of recent values. CPU and GPU sparklines are scaled to at least
 * one 60fps frame (16.7 ms), marked by a faint line.
 *
 * The GPU figure is an upper bound: see `FrameStats.gpuMs` for what it
 * includes, and why some drivers overstate it.
 *
 * The stats publish a few times a second, so the text and sparklines are
 * rebuilt only then; other frames cost one comparison per row.
 */
export function createPerfmonView(bindings: PerfmonViewBindings): Container {
    return (
        <container label="perfmon">
            <graphics ref={drawPanel} />
            {statRow(bindings, 'fps', 0)}
            {statRow(bindings, 'cpu', 1)}
            {statRow(bindings, 'gpu', 2)}
            {statRow(bindings, 'reads', 3)}
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PADDING = 8;
const ROW_PITCH = 16;
const LABEL_X = PADDING;
const VALUE_X = PADDING + 34;
const GRAPH_X = PADDING + 100;
const GRAPH_WIDTH = PERFMON_WIDTH - GRAPH_X - PADDING;
const GRAPH_HEIGHT = 12;
const FRAME_BUDGET_MS = 1000 / 60;

const ROW_LABELS: Readonly<Record<FrameStatKind, string>> = { fps: 'FPS', cpu: 'CPU', gpu: 'GPU', reads: 'RPF' };
const ROW_COLORS: Readonly<Record<FrameStatKind, number>> = {
    fps: 0x7ee787,
    cpu: 0x79c0ff,
    gpu: 0xffa657,
    reads: 0xd2a8ff,
};

function statRow(bindings: PerfmonViewBindings, kind: FrameStatKind, rowIndex: number): Container {
    const style = { fill: ROW_COLORS[kind], fontSize: 12, fontFamily: 'monospace' };

    // The text shown for the last published sample, rebuilt only when a new one arrives.
    let textSample = -1;
    let text = NO_VALUE;

    return (
        <container y={PADDING + rowIndex * ROW_PITCH}>
            <text text={ROW_LABELS[kind]} x={LABEL_X} style={style} />
            <text text={getValueText} x={VALUE_X} style={style} />
            <graphics x={GRAPH_X} y={2} ref={setUpSparkline} />
        </container>
    );

    function getValueText(): string {
        const stats = bindings.getFrameStats();
        if (stats === undefined) return NO_VALUE;
        if (stats.sampleCount !== textSample) {
            textSample = stats.sampleCount;
            text = formatValue(kind, stats);
        }
        return text;
    }

    function setUpSparkline(g: Graphics): void {
        let drawnSample = -1;
        g.onRefresh = () => {
            const stats = bindings.getFrameStats();
            const sample = stats?.sampleCount ?? -1;
            if (sample === drawnSample) return;
            drawnSample = sample;
            drawSparkline(g, kind, stats);
        };
    }
}

const NO_VALUE = '--';

function formatValue(kind: FrameStatKind, stats: FrameStats): string {
    if (kind === 'fps') return String(Math.round(stats.fps));
    if (kind === 'reads') return stats.readsPerFrame === undefined ? 'n/a' : formatCount(stats.readsPerFrame);
    const ms = kind === 'cpu' ? stats.cpuMs : stats.gpuMs;
    return ms === undefined ? 'n/a' : `${ms.toFixed(1)} ms`;
}

/** A count in at most four characters: `950`, `9.5K`, `21K`, `1.2M`. */
function formatCount(count: number): string {
    if (count < 999.5) return String(Math.round(count));
    if (count < 9950) return `${(count / 1e3).toFixed(1)}K`;
    if (count < 999500) return `${Math.round(count / 1e3)}K`;
    if (count < 9.95e6) return `${(count / 1e6).toFixed(1)}M`;
    return `${Math.round(count / 1e6)}M`;
}

function drawSparkline(g: Graphics, kind: FrameStatKind, stats: FrameStats | undefined): void {
    g.clear();
    g.rect(0, 0, GRAPH_WIDTH, GRAPH_HEIGHT).fill({ color: 0xffffff, alpha: 0.06 });
    if (stats === undefined) return;

    const count = stats.historyLength;
    // Frame times are scaled to include a frame's budget; counts to their own peak.
    let max = kind === 'fps' ? 60 : kind === 'reads' ? 0 : FRAME_BUDGET_MS;
    for (let i = 0; i < count; i++) {
        const value = stats.historyAt(kind, i);
        if (value > max) max = value;
    }

    if (kind === 'cpu' || kind === 'gpu') {
        const budgetY = GRAPH_HEIGHT - (FRAME_BUDGET_MS / max) * GRAPH_HEIGHT;
        g.rect(0, budgetY, GRAPH_WIDTH, 1).fill({ color: 0xffffff, alpha: 0.2 });
    }

    const barWidth = GRAPH_WIDTH / count;
    for (let i = 0; i < count; i++) {
        const value = stats.historyAt(kind, i);
        if (!(value > 0)) continue; // NaN (no value yet) or zero
        const height = Math.max(1, (value / max) * GRAPH_HEIGHT);
        g.rect(i * barWidth, GRAPH_HEIGHT - height, barWidth, height);
    }
    g.fill({ color: ROW_COLORS[kind] });
}

function drawPanel(g: Graphics): void {
    g.roundRect(0, 0, PERFMON_WIDTH, PERFMON_HEIGHT, 6).fill({ color: 0x000000, alpha: 0.35 });
}
