/** @jsxImportSource @mvtjs/pixi/jsx */

import { type Container, type Graphics, Rectangle, Text, type TextStyleOptions } from 'pixi.js';
import type { MetricKind, PerformanceMetrics } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PerfmonViewBindings {
    /** The metrics to show, or undefined where there are none (e.g. rendering a thumbnail). */
    performanceMetrics: () => PerformanceMetrics | undefined;
    /**
     * Metrics the host cannot measure honestly, shown as `n/a`: `reads` where
     * the views do not count their reads (`addReads`), which would otherwise
     * show a false zero. Read once. None by default.
     */
    unmeasured?: readonly MetricKind[];
}

/** Size of the panel, for laying it out. */
export const PERFMON_WIDTH = 220;
export const PERFMON_HEIGHT = 144;

/**
 * Height of the info card the (i) button opens. The card is as wide as the
 * panel, shares its bottom edge, and rises above it over whatever the host
 * put there, so the host leaves this much room and draws nothing in front of
 * the panel within it.
 */
export const PERFMON_INFO_HEIGHT = 256;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A small panel of performance metrics, each row with a sparkline of recent
 * values. FPS comes first; every row below the "per frame" divider is per
 * frame:
 *
 * - `CPU`, `GPU`: milliseconds, averaged over the window (GPU: the median).
 * - `Reads`: values the views read (e.g. `21K`), for scenes that count them.
 * - `Methods`: update and refresh methods called.
 * - `Rebuilds`: method lists rebuilt, which is the scene's churn; zero in a
 *   steady scene.
 * - `Visits`: node visits made rebuilding those method lists, which is what
 *   the churn cost.
 *
 * The counts come from one frame sampled in each window. A metric the host
 * lists as `unmeasured`, and the GPU where it cannot be timed, shows `n/a`,
 * its row dimmed. CPU and GPU sparklines are scaled to at least one 60fps
 * frame (16.7 ms), marked by a faint line.
 *
 * The (i) button on the divider opens a card explaining all this, which a tap
 * closes. Its text describes `createPerformanceMetrics`' default window and
 * history length. The GPU figure is an upper bound: see
 * `PerformanceMetrics.gpuMs` for what it includes, and why some drivers
 * overstate it.
 *
 * The metrics publish a few times a second, so the text and sparklines are
 * rebuilt only then; other frames cost one comparison per row.
 */
export function PerfmonView(bindings: PerfmonViewBindings): Container {
    // Presentation state: whether the info card is open, and whether the
    // pointer is over the (i) button.
    let isInfoOpen = false;
    let isButtonHovered = false;

    return (
        <container label="perfmon">
            <graphics ref={drawPanel} />
            {metricRow(bindings, 'fps', 0)}
            <container y={rowY(1)}>
                <text text="per frame" x={LABEL_X} y={2} style={CAPTION_STYLE} />
                <graphics ref={drawDivider} />
                <container
                    x={INFO_BUTTON_X}
                    y={ROW_CENTER_Y}
                    alpha={() => (isButtonHovered ? 1 : 0.65)}
                    cursor="pointer"
                    hitArea={INFO_BUTTON_HIT_AREA}
                    onPointerTap={() => { isInfoOpen = true; }}
                    onPointerOver={() => { isButtonHovered = true; }}
                    onPointerOut={() => { isButtonHovered = false; }}
                >
                    <graphics ref={drawInfoButton} />
                </container>
            </container>
            {metricRow(bindings, 'cpuMs', 2)}
            {metricRow(bindings, 'gpuMs', 3)}
            {metricRow(bindings, 'reads', 4)}
            {metricRow(bindings, 'methodCalls', 5)}
            {metricRow(bindings, 'methodListRebuilds', 6)}
            {metricRow(bindings, 'rebuildNodeVisits', 7)}
            <container
                label="perfmon-info"
                y={PERFMON_HEIGHT - PERFMON_INFO_HEIGHT}
                visible={() => isInfoOpen}
                cursor="pointer"
                hitArea={new Rectangle(0, 0, PERFMON_WIDTH, PERFMON_INFO_HEIGHT)}
                onPointerTap={() => { isInfoOpen = false; }}
            >
                <graphics ref={drawInfoCard} />
                {infoText()}
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PADDING = 8;
const ROW_PITCH = 16;
/** The middle of a row's 12px text, from the row's top. */
const ROW_CENTER_Y = 7;
const LABEL_X = PADDING;
/** Values are right-aligned here, after labels of up to eight characters. */
const VALUE_RIGHT = PADDING + 116;
const GRAPH_X = VALUE_RIGHT + 6;
const GRAPH_WIDTH = PERFMON_WIDTH - GRAPH_X - PADDING;
const GRAPH_HEIGHT = 12;
const FRAME_BUDGET_MS = 1000 / 60;

const INFO_BUTTON_RADIUS = 5.5;
const INFO_BUTTON_X = PERFMON_WIDTH - PADDING - INFO_BUTTON_RADIUS;
/** Larger than the button, for fingers on a scaled-down canvas. */
const INFO_BUTTON_HIT_AREA = new Rectangle(-16, -12, 30, 24);

const DIM_ALPHA = 0.4;
const CAPTION_COLOR = 0x8b949e;
const INFO_TEXT_COLOR = 0xc9d1d9;

const ROW_LABELS: Readonly<Record<MetricKind, string>> = {
    fps: 'FPS',
    cpuMs: 'CPU',
    gpuMs: 'GPU',
    reads: 'Reads',
    methodCalls: 'Methods',
    methodListRebuilds: 'Rebuilds',
    rebuildNodeVisits: 'Visits',
};
const ROW_COLORS: Readonly<Record<MetricKind, number>> = {
    fps: 0x7ee787,
    cpuMs: 0x79c0ff,
    gpuMs: 0xffa657,
    reads: 0xd2a8ff,
    methodCalls: 0xf2cc60,
    methodListRebuilds: 0xff7b72,
    rebuildNodeVisits: 0xffa198,
};

/** What each row means, for the info card; the label is added in its colour. */
const ROW_INFO: Readonly<Record<MetricKind, string>> = {
    fps: 'frames drawn per second.',
    cpuMs: 'main-thread ms, tick to end of render. Faint line: 16.7 ms (60 fps).',
    gpuMs: 'ms on the GPU, the median. An upper bound: some drivers count waiting.',
    reads: 'values the views read.',
    methodCalls: 'update and refresh calls.',
    methodListRebuilds: 'method lists rebuilt as the scene changed; 0 when steady.',
    rebuildNodeVisits: 'node visits making those rebuilds.',
};

const CAPTION_STYLE = { fill: CAPTION_COLOR, fontSize: 10, fontFamily: 'monospace' };

function rowY(rowIndex: number): number {
    return PADDING + rowIndex * ROW_PITCH;
}

function metricRow(bindings: PerfmonViewBindings, kind: MetricKind, rowIndex: number): Container {
    const style = { fill: ROW_COLORS[kind], fontSize: 12, fontFamily: 'monospace' };
    const isMeasured = bindings.unmeasured?.includes(kind) !== true;

    // The text shown for the last published sample, and whether it was
    // `n/a`, updated only when a new one arrives.
    let textSample = -1;
    let text = NO_VALUE;
    let drawnSample = -1;

    return (
        <container y={rowY(rowIndex)} onRefresh={refreshValue}>
            <text text={ROW_LABELS[kind]} x={LABEL_X} style={style} />
            <text text={() => text} x={VALUE_RIGHT} anchorX={1} style={style} />
            <graphics x={GRAPH_X} y={1} onRefresh={refreshSparkline} />
        </container>
    );

    function refreshValue(row: Container): void {
        const metrics = bindings.performanceMetrics();
        const sample = metrics?.sampleCount ?? -1;
        if (sample === textSample) return;
        textSample = sample;
        text = metrics === undefined ? NO_VALUE : isMeasured ? formatValue(kind, metrics) : NOT_MEASURED;
        row.alpha = text === NOT_MEASURED ? DIM_ALPHA : 1;
    }

    function refreshSparkline(g: Graphics): void {
        const metrics = bindings.performanceMetrics();
        const sample = metrics?.sampleCount ?? -1;
        if (sample === drawnSample) return;
        drawnSample = sample;
        drawSparkline(g, kind, isMeasured ? metrics : undefined);
    }
}

const NO_VALUE = '--';
const NOT_MEASURED = 'n/a';

function formatValue(kind: MetricKind, metrics: PerformanceMetrics): string {
    if (kind === 'fps') return String(Math.round(metrics.fps));
    if (kind === 'cpuMs' || kind === 'gpuMs') {
        const ms = metrics[kind];
        if (ms === undefined) return NOT_MEASURED;
        return ms < 99.95 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;
    }
    return formatCount(metrics[kind]);
}

/** A count in at most four characters: `950`, `9.5K`, `21K`, `1.2M`. */
function formatCount(count: number): string {
    if (count < 999.5) return String(Math.round(count));
    if (count < 9950) return `${(count / 1e3).toFixed(1)}K`;
    if (count < 999500) return `${Math.round(count / 1e3)}K`;
    if (count < 9.95e6) return `${(count / 1e6).toFixed(1)}M`;
    return `${Math.round(count / 1e6)}M`;
}

function drawSparkline(g: Graphics, kind: MetricKind, metrics: PerformanceMetrics | undefined): void {
    g.clear();
    g.rect(0, 0, GRAPH_WIDTH, GRAPH_HEIGHT).fill({ color: 0xffffff, alpha: 0.06 });
    if (metrics === undefined) return;

    const count = metrics.historyLength;
    // Frame times are scaled to include a frame's budget; counts to their own peak.
    let max = kind === 'fps' ? 60 : kind === 'cpuMs' || kind === 'gpuMs' ? FRAME_BUDGET_MS : 0;
    for (let i = 0; i < count; i++) {
        const value = metrics.historyAt(kind, i);
        if (value > max) max = value;
    }

    if (kind === 'cpuMs' || kind === 'gpuMs') {
        const budgetY = GRAPH_HEIGHT - (FRAME_BUDGET_MS / max) * GRAPH_HEIGHT;
        g.rect(0, budgetY, GRAPH_WIDTH, 1).fill({ color: 0xffffff, alpha: 0.2 });
    }

    const barWidth = GRAPH_WIDTH / count;
    for (let i = 0; i < count; i++) {
        const value = metrics.historyAt(kind, i);
        if (!(value > 0)) continue; // NaN (no value yet) or zero
        const height = Math.max(1, (value / max) * GRAPH_HEIGHT);
        g.rect(i * barWidth, GRAPH_HEIGHT - height, barWidth, height);
    }
    g.fill({ color: ROW_COLORS[kind] });
}

function drawPanel(g: Graphics): void {
    g.roundRect(0, 0, PERFMON_WIDTH, PERFMON_HEIGHT, 6).fill({ color: 0x000000, alpha: 0.35 });
}

/** A rule from after the "per frame" caption to before the (i) button. */
function drawDivider(g: Graphics): void {
    const left = LABEL_X + 60;
    const right = INFO_BUTTON_X - INFO_BUTTON_RADIUS - 6;
    g.rect(left, ROW_CENTER_Y, right - left, 1).fill({ color: 0xffffff, alpha: 0.2 });
}

/** A ringed "i", drawn rather than set in type so it stays upright and centred at this size. */
function drawInfoButton(g: Graphics): void {
    g.circle(0, 0, INFO_BUTTON_RADIUS)
        .fill({ color: 0xe6edf3, alpha: 0.12 })
        .stroke({ color: 0xe6edf3, width: 1 });
    g.circle(0, -2.6, 0.9).fill(0xe6edf3);
    g.rect(-0.7, -0.9, 1.4, 4.1).fill(0xe6edf3);
}

// --- Info card ----------------------------------------------------------------

const INFO_PADDING = 8;
const INFO_TEXT_WIDTH = PERFMON_WIDTH - INFO_PADDING * 2;
/** Space between paragraphs, and more before each heading. */
const INFO_PARAGRAPH_GAP = 3;
const INFO_HEADING_GAP = 6;

function drawInfoCard(g: Graphics): void {
    g.roundRect(0, 0, PERFMON_WIDTH, PERFMON_INFO_HEIGHT, 6)
        .fill({ color: 0x0d1117 })
        .stroke({ color: 0xffffff, alpha: 0.15, width: 1 });
}

/**
 * The card's text: a paragraph per row, its label in the row's colour, under
 * headings for how the values are gathered. Built the first time the card is
 * shown, so a card never opened measures no text, and laid out by measuring
 * each paragraph.
 */
function infoText(): Container {
    const tagStyles: Record<string, TextStyleOptions> = {
        b: { fill: 0xe6edf3, fontWeight: 'bold' },
        dim: { fill: CAPTION_COLOR },
    };
    for (let i = 0; i < METRIC_KINDS.length; i++) {
        tagStyles[METRIC_KINDS[i]] = { fill: ROW_COLORS[METRIC_KINDS[i]], fontWeight: 'bold' };
    }
    const style: TextStyleOptions = {
        fill: INFO_TEXT_COLOR,
        fontSize: 11,
        fontFamily: 'sans-serif',
        lineHeight: 13,
        wordWrap: true,
        wordWrapWidth: INFO_TEXT_WIDTH,
        tagStyles,
    };
    let isBuilt = false;
    return <container x={INFO_PADDING} y={INFO_PADDING} onRefresh={buildOnce} />;

    function buildOnce(el: Container): void {
        if (isBuilt) return;
        isBuilt = true;
        layOutParagraphs(el, style);
    }
}

const METRIC_KINDS: readonly MetricKind[] = ['fps', 'cpuMs', 'gpuMs', 'reads', 'methodCalls', 'methodListRebuilds', 'rebuildNodeVisits'];

/** The card's paragraphs, each with the space above it. */
const INFO_PARAGRAPHS: readonly (readonly [gapAbove: number, text: string])[] = [
    [0, '<b>Performance metrics</b>, updated 4 times a second. Graphs show the last 15 s. <dim>Tap to close.</dim>'],
    [INFO_PARAGRAPH_GAP, metricInfo('fps')],
    [INFO_HEADING_GAP, 'Per frame, averaged:'],
    [INFO_PARAGRAPH_GAP, metricInfo('cpuMs')],
    [INFO_PARAGRAPH_GAP, metricInfo('gpuMs')],
    [INFO_HEADING_GAP, 'Per frame, in one sampled frame:'],
    [INFO_PARAGRAPH_GAP, metricInfo('reads')],
    [INFO_PARAGRAPH_GAP, metricInfo('methodCalls')],
    [INFO_PARAGRAPH_GAP, metricInfo('methodListRebuilds')],
    [INFO_PARAGRAPH_GAP, metricInfo('rebuildNodeVisits')],
    [INFO_HEADING_GAP, '<dim>n/a: not measured in this demo.</dim>'],
];

function metricInfo(kind: MetricKind): string {
    return `<${kind}>${ROW_LABELS[kind]}</${kind}> ${ROW_INFO[kind]}`;
}

function layOutParagraphs(parent: Container, style: TextStyleOptions): void {
    let y = 0;
    for (let i = 0; i < INFO_PARAGRAPHS.length; i++) {
        const [gapAbove, text] = INFO_PARAGRAPHS[i];
        y += gapAbove;
        const paragraph = new Text({ text, style, y });
        parent.addChild(paragraph);
        y += paragraph.height;
    }
}
