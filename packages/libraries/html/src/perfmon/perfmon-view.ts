import { METRIC_KINDS, type MetricKind, type PerformanceMetrics, setRefresh } from '@mvtjs/utils';
import type { ValueOrGetter } from '@mvtjs/utils/jsx';
// Registers DOM elements, so the view's refresh method is walked, however the view was imported
import '../element-mixin';
import { addPerfmonStyles, PERFMON_CLASS } from './perfmon-styles';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PerfmonViewBindings {
    /** The metrics to show, or `undefined` while there are none, such as before a game starts. */
    readonly metrics: () => PerformanceMetrics | undefined;
    /**
     * Metrics that can't be measured honestly here, shown as `n/a`. For
     * example, `reads` where the views don't count their reads (`addReads`),
     * which would otherwise show a false zero. Give a function if they can
     * change, such as in a page that runs one game and then another. None
     * by default.
     */
    readonly unmeasured?: ValueOrGetter<readonly MetricKind[]>;
    /**
     * A title for a bar across the panel's top, with the (i) at its right
     * end, as a window's title bar has. The bar has the class
     * `mvt-perfmon-titlebar`, so a page that lets the visitor move the panel
     * can find it to drag it by. Without a title, there is no bar, and the
     * (i) sits at the end of the "per frame" line. Read once.
     */
    readonly title?: string;
    /**
     * A paragraph that opens the explanation, about the panel in this page,
     * such as how to move it or close it. Read once. None by default.
     */
    readonly infoNote?: string;
    /**
     * The time each frame has, in milliseconds, which a faint line marks in
     * the CPU and GPU graphs: 16.7 at 60 FPS, 8.3 at 120. By default, it
     * follows the display, from the highest frame rate in the recent
     * history, rounded to the nearest common refresh rate. Give it when you
     * know better, such as for a game held to 30 FPS on a faster display.
     */
    readonly frameBudgetMs?: ValueOrGetter<number>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A panel of performance metrics, each with a small graph of its recent
 * values: frames per second, then CPU and GPU time per frame, and the work
 * of each frame. An (i) button opens an explanation of each one. Given a
 * title, the panel has a title bar, with the (i) at its right end.
 *
 * It fits the space it's given. In a small box, such as a corner of a game,
 * it's a compact panel. Given more room, such as a whole pane, its text and
 * graphs grow to fill it. It adds a small stylesheet to the page the first
 * time it's used. Its colours are CSS variables, so a page can match it to
 * its own look: `--mvt-perfmon-background`, `--mvt-perfmon-text`,
 * `--mvt-perfmon-muted`, and one for each metric, such as
 * `--mvt-perfmon-fps` and `--mvt-perfmon-cpuMs`.
 *
 * The metrics change a few times a second, so the values and graphs are
 * redrawn only then. Every other frame costs one comparison.
 */
export function PerfmonView(bindings: PerfmonViewBindings): HTMLElement {
    addPerfmonStyles(document);
    const unmeasured = bindings.unmeasured ?? NONE;
    const { frameBudgetMs } = bindings;

    const root = document.createElement('div');
    root.className = PERFMON_CLASS;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Performance');

    // Presentation state: whether the explanation is open, and whether it has
    // opened since its close button last took the focus
    let isInfoOpen = false;
    let isFocusDue = false;
    const infoButton = document.createElement('button');
    infoButton.type = 'button';
    infoButton.className = `${PERFMON_CLASS}-info-button`;
    infoButton.textContent = 'i';
    infoButton.title = 'What these mean';
    infoButton.setAttribute('aria-label', 'What these mean');
    infoButton.addEventListener('click', () => {
        isInfoOpen = !isInfoOpen;
        isFocusDue = isInfoOpen;
    });
    const { panel: info, closeButton } = infoPanel(bindings.infoNote);
    closeButton.addEventListener('click', () => {
        isInfoOpen = false;
        infoButton.focus();
    });

    const table = document.createElement('div');
    table.className = `${PERFMON_CLASS}-rows`;
    const rows: MetricRow[] = [];
    const { title } = bindings;
    for (const kind of METRIC_KINDS) {
        if (kind === 'cpuMs') table.append(captionRow(title === undefined ? infoButton : undefined));
        const row = metricRow(kind);
        rows.push(row);
        table.append(row.label, row.value, row.graph);
    }
    if (title !== undefined) {
        root.classList.add(`${PERFMON_CLASS}-has-title`);
        root.append(titleBar(title, infoButton));
    }
    root.append(table, info);

    root.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !isInfoOpen) return;
        event.preventDefault();
        isInfoOpen = false;
        infoButton.focus();
    });

    let shownSample = -1;
    let shownMetrics: PerformanceMetrics | undefined;
    // The budget the display's frame rate suggests, worked out as each sample arrives
    let displayBudgetMs = DEFAULT_BUDGET_MS;
    let shownBudgetMs = DEFAULT_BUDGET_MS;
    setRefresh(root, refresh);
    return root;

    function refresh(): void {
        infoButton.setAttribute('aria-expanded', isInfoOpen ? 'true' : 'false');
        info.hidden = !isInfoOpen;
        // Only once the explanation shows can its close button take the focus
        if (isFocusDue) {
            isFocusDue = false;
            closeButton.focus();
        }
        const isMeasuringChanged = followUnmeasured(typeof unmeasured === 'function' ? unmeasured() : unmeasured);
        const metrics = bindings.metrics();
        const sample = metrics?.sampleCount ?? -1;
        const isNewSample = sample !== shownSample || metrics !== shownMetrics;
        if (isNewSample && frameBudgetMs === undefined) displayBudgetMs = budgetForDisplay(metrics);
        const budgetMs = frameBudgetMs === undefined
            ? displayBudgetMs
            : typeof frameBudgetMs === 'function' ? frameBudgetMs() : frameBudgetMs;
        if (!isMeasuringChanged && !isNewSample && budgetMs === shownBudgetMs) return;
        shownSample = sample;
        shownMetrics = metrics;
        shownBudgetMs = budgetMs;
        for (let i = 0; i < rows.length; i++) showRow(rows[i], metrics, budgetMs);
    }

    /** Marks each row measured or not, as `kinds` says. Returns whether any row changed. */
    function followUnmeasured(kinds: readonly MetricKind[]): boolean {
        let isChanged = false;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const isMeasured = !kinds.includes(row.kind);
            if (isMeasured === row.isMeasured) continue;
            row.isMeasured = isMeasured;
            isChanged = true;
        }
        return isChanged;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A metric's three cells: its label, its value, and its graph. */
interface MetricRow {
    readonly kind: MetricKind;
    /** Whether it is measured here. One that isn't shows `n/a`. */
    isMeasured: boolean;
    readonly label: HTMLElement;
    readonly value: HTMLElement;
    readonly graph: SVGSVGElement;
    readonly bars: SVGPathElement;
    readonly budget: SVGPathElement;
}

const SVG = 'http://www.w3.org/2000/svg';
/** The graph's height, in its own units. The graph is stretched to fit its cell. */
const GRAPH_HEIGHT = 12;
/** The frame budget before there is a frame rate to go by: 60 FPS. */
const DEFAULT_BUDGET_MS = 1000 / 60;
/** The refresh rates displays commonly run at, in frames per second, which a measured rate is rounded to. */
const REFRESH_RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 175, 240, 360];
const NO_VALUE = '--';
const NOT_MEASURED = 'n/a';
const NONE: readonly MetricKind[] = [];

const LABELS: Readonly<Record<MetricKind, string>> = {
    fps: 'FPS',
    cpuMs: 'CPU',
    gpuMs: 'GPU',
    reads: 'Reads',
    methodCalls: 'Methods',
    methodListRebuilds: 'Rebuilds',
    rebuildNodeVisits: 'Visits',
};

function metricRow(kind: MetricKind): MetricRow {
    const label = document.createElement('span');
    label.className = `${PERFMON_CLASS}-label`;
    label.textContent = LABELS[kind];
    const value = document.createElement('span');
    value.className = `${PERFMON_CLASS}-value`;
    value.textContent = NO_VALUE;
    const graph = document.createElementNS(SVG, 'svg');
    graph.setAttribute('class', `${PERFMON_CLASS}-graph`);
    graph.setAttribute('preserveAspectRatio', 'none');
    graph.setAttribute('aria-hidden', 'true');
    const budget = document.createElementNS(SVG, 'path');
    budget.setAttribute('class', `${PERFMON_CLASS}-budget`);
    const bars = document.createElementNS(SVG, 'path');
    graph.append(budget, bars);
    for (const cell of [label, value, graph]) cell.style.setProperty('--mvt-perfmon-row', `var(--mvt-perfmon-${kind})`);
    return { kind, isMeasured: true, label, value, graph, bars, budget };
}

/** The "per frame" caption, with a rule across the rest of the row, and the (i) button at its end, if it goes there. */
function captionRow(infoButton: HTMLElement | undefined): HTMLElement {
    const caption = document.createElement('div');
    caption.className = `${PERFMON_CLASS}-caption`;
    const text = document.createElement('span');
    text.textContent = 'per frame';
    const rule = document.createElement('span');
    rule.className = `${PERFMON_CLASS}-rule`;
    caption.append(text, rule);
    if (infoButton !== undefined) caption.append(infoButton);
    return caption;
}

/** The bar across the panel's top: its title, and the (i) button at its right end. */
function titleBar(title: string, infoButton: HTMLElement): HTMLElement {
    const bar = document.createElement('div');
    bar.className = `${PERFMON_CLASS}-titlebar`;
    const text = document.createElement('span');
    text.className = `${PERFMON_CLASS}-titlebar-title`;
    text.textContent = title;
    bar.append(text, infoButton);
    return bar;
}

function showRow(row: MetricRow, metrics: PerformanceMetrics | undefined, budgetMs: number): void {
    const text = metrics === undefined ? NO_VALUE : row.isMeasured ? formatValue(row.kind, metrics) : NOT_MEASURED;
    row.value.textContent = text;
    const isDim = text === NOT_MEASURED;
    row.label.classList.toggle(`${PERFMON_CLASS}-dim`, isDim);
    row.value.classList.toggle(`${PERFMON_CLASS}-dim`, isDim);
    drawGraph(row, row.isMeasured ? metrics : undefined, budgetMs);
}

/**
 * The time a frame has on this display: one frame at the highest rate in the
 * recent history, rounded to the nearest common refresh rate. A game that
 * keeps up runs at the display's rate, so the highest rate it reached is
 * the display's, even after it slows.
 */
function budgetForDisplay(metrics: PerformanceMetrics | undefined): number {
    if (metrics === undefined) return DEFAULT_BUDGET_MS;
    let peakFps = 0;
    for (let i = 0; i < metrics.historyLength; i++) {
        const fps = metrics.historyAt('fps', i);
        if (fps > peakFps) peakFps = fps;
    }
    if (peakFps === 0) return DEFAULT_BUDGET_MS;
    let rate = REFRESH_RATES[0];
    for (let i = 1; i < REFRESH_RATES.length; i++) {
        if (Math.abs(REFRESH_RATES[i] - peakFps) < Math.abs(rate - peakFps)) rate = REFRESH_RATES[i];
    }
    return 1000 / rate;
}

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

/**
 * Draws a bar for each recent value, as one path. Frame times are scaled to
 * include the frame budget, which a faint line marks. FPS is scaled to at
 * least the rate that budget is for, and counts to their own peak.
 */
function drawGraph(row: MetricRow, metrics: PerformanceMetrics | undefined, budgetMs: number): void {
    const count = metrics?.historyLength ?? 1;
    row.graph.setAttribute('viewBox', `0 0 ${count} ${GRAPH_HEIGHT}`);
    if (metrics === undefined) {
        row.bars.setAttribute('d', '');
        row.budget.setAttribute('d', '');
        return;
    }
    const { kind } = row;
    const isTime = kind === 'cpuMs' || kind === 'gpuMs';
    let max = kind === 'fps' ? 1000 / budgetMs : isTime ? budgetMs : 0;
    for (let i = 0; i < count; i++) {
        const value = metrics.historyAt(kind, i);
        if (value > max) max = value;
    }
    let path = '';
    for (let i = 0; i < count; i++) {
        const value = metrics.historyAt(kind, i);
        if (!(value > 0)) continue; // NaN (no value yet), or zero
        const height = Math.max(0.5, (value / max) * GRAPH_HEIGHT);
        path += `M${i} ${GRAPH_HEIGHT}V${GRAPH_HEIGHT - height}h1V${GRAPH_HEIGHT}z`;
    }
    row.bars.setAttribute('d', path);
    const budgetY = GRAPH_HEIGHT - (budgetMs / max) * GRAPH_HEIGHT;
    row.budget.setAttribute('d', isTime ? `M0 ${budgetY}H${count}` : '');
}

/** What each metric means, as the explanation lists them. */
const MEANINGS: Readonly<Record<MetricKind, string>> = {
    fps: 'How many frames are drawn each second.',
    cpuMs: 'Milliseconds of main-thread work, from the start of the frame to the end of drawing it. The faint line in its graph marks all the time a frame has at the display\'s frame rate: 16.7 ms at 60 FPS, or 8.3 ms at 120.',
    gpuMs: 'Milliseconds of work on the graphics card. It can be too high, because some drivers count time spent waiting.',
    reads: 'Values the views read from their bindings. Only views written in JSX, and views that report their reads with addReads, are counted.',
    methodCalls: 'Update and refresh methods called.',
    methodListRebuilds: 'Lists of methods rebuilt as views came and went. It stays at 0 while nothing is added or removed.',
    rebuildNodeVisits: 'Views visited to make those rebuilds.',
};

/**
 * The explanation the (i) opens: a title and a close button, which stay in
 * view, over the text, which scrolls.
 */
function infoPanel(note: string | undefined): { readonly panel: HTMLElement; readonly closeButton: HTMLButtonElement } {
    const panel = document.createElement('div');
    panel.className = `${PERFMON_CLASS}-info`;
    panel.hidden = true;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'What these mean');

    const head = document.createElement('div');
    head.className = `${PERFMON_CLASS}-info-head`;
    const title = document.createElement('span');
    title.className = `${PERFMON_CLASS}-info-title`;
    title.textContent = 'What these mean';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = `${PERFMON_CLASS}-info-close`;
    closeButton.textContent = '×';
    closeButton.title = 'Close';
    closeButton.setAttribute('aria-label', 'Close');
    head.append(title, closeButton);

    const body = document.createElement('div');
    body.className = `${PERFMON_CLASS}-info-body`;
    const paragraph = (text: string, className?: string): void => {
        const p = document.createElement('p');
        p.textContent = text;
        if (className !== undefined) p.className = className;
        body.append(p);
    };
    if (note !== undefined) paragraph(note);
    paragraph('These are updated a few times a second. Each graph shows the last few seconds.');
    for (const kind of METRIC_KINDS) {
        if (kind === 'cpuMs') paragraph('The rest are for each frame. CPU and GPU are averages, and the counts come from one frame in each update.', `${PERFMON_CLASS}-info-heading`);
        const p = document.createElement('p');
        const name = document.createElement('b');
        name.textContent = `${LABELS[kind]}: `;
        name.style.color = `var(--mvt-perfmon-${kind})`;
        p.append(name, MEANINGS[kind]);
        body.append(p);
    }
    paragraph("n/a means it isn't measured here.", `${PERFMON_CLASS}-info-heading`);
    panel.append(head, body);
    return { panel, closeButton };
}
