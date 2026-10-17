import { METRIC_KINDS, type MetricKind, type PerformanceMetrics, setRefresh } from '@mvtjs/utils';
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
     * which would otherwise show a false zero. Read once. None by default.
     */
    readonly unmeasured?: readonly MetricKind[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A panel of performance metrics, each with a small graph of its recent
 * values: frames per second, then CPU and GPU time per frame, and the work
 * of each frame. An (i) button opens an explanation of each one.
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
    const unmeasured = bindings.unmeasured ?? [];

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
    const { panel: info, closeButton } = infoPanel();
    closeButton.addEventListener('click', () => {
        isInfoOpen = false;
        infoButton.focus();
    });

    const table = document.createElement('div');
    table.className = `${PERFMON_CLASS}-rows`;
    const rows: MetricRow[] = [];
    for (const kind of METRIC_KINDS) {
        if (kind === 'cpuMs') table.append(captionRow(infoButton));
        const row = metricRow(kind, unmeasured.includes(kind));
        rows.push(row);
        table.append(row.label, row.value, row.graph);
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
        const metrics = bindings.metrics();
        const sample = metrics?.sampleCount ?? -1;
        if (sample === shownSample && metrics === shownMetrics) return;
        shownSample = sample;
        shownMetrics = metrics;
        for (let i = 0; i < rows.length; i++) showRow(rows[i], metrics);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A metric's three cells: its label, its value, and its graph. */
interface MetricRow {
    readonly kind: MetricKind;
    readonly isMeasured: boolean;
    readonly label: HTMLElement;
    readonly value: HTMLElement;
    readonly graph: SVGSVGElement;
    readonly bars: SVGPathElement;
    readonly budget: SVGPathElement;
}

const SVG = 'http://www.w3.org/2000/svg';
/** The graph's height, in its own units. The graph is stretched to fit its cell. */
const GRAPH_HEIGHT = 12;
const FRAME_BUDGET_MS = 1000 / 60;
const NO_VALUE = '--';
const NOT_MEASURED = 'n/a';

const LABELS: Readonly<Record<MetricKind, string>> = {
    fps: 'FPS',
    cpuMs: 'CPU',
    gpuMs: 'GPU',
    reads: 'Reads',
    methodCalls: 'Methods',
    methodListRebuilds: 'Rebuilds',
    rebuildNodeVisits: 'Visits',
};

function metricRow(kind: MetricKind, isNotMeasured: boolean): MetricRow {
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
    return { kind, isMeasured: !isNotMeasured, label, value, graph, bars, budget };
}

/** The "per frame" caption, with a rule across the rest of the row, and the (i) button at its end. */
function captionRow(infoButton: HTMLElement): HTMLElement {
    const caption = document.createElement('div');
    caption.className = `${PERFMON_CLASS}-caption`;
    const text = document.createElement('span');
    text.textContent = 'per frame';
    const rule = document.createElement('span');
    rule.className = `${PERFMON_CLASS}-rule`;
    caption.append(text, rule, infoButton);
    return caption;
}

function showRow(row: MetricRow, metrics: PerformanceMetrics | undefined): void {
    const text = metrics === undefined ? NO_VALUE : row.isMeasured ? formatValue(row.kind, metrics) : NOT_MEASURED;
    row.value.textContent = text;
    const isDim = text === NOT_MEASURED;
    row.label.classList.toggle(`${PERFMON_CLASS}-dim`, isDim);
    row.value.classList.toggle(`${PERFMON_CLASS}-dim`, isDim);
    drawGraph(row, row.isMeasured ? metrics : undefined);
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
 * include one frame at 60 FPS, which a faint line marks. FPS is scaled to at
 * least 60, and counts to their own peak.
 */
function drawGraph(row: MetricRow, metrics: PerformanceMetrics | undefined): void {
    const count = metrics?.historyLength ?? 1;
    row.graph.setAttribute('viewBox', `0 0 ${count} ${GRAPH_HEIGHT}`);
    if (metrics === undefined) {
        row.bars.setAttribute('d', '');
        row.budget.setAttribute('d', '');
        return;
    }
    const { kind } = row;
    const isTime = kind === 'cpuMs' || kind === 'gpuMs';
    let max = kind === 'fps' ? 60 : isTime ? FRAME_BUDGET_MS : 0;
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
    const budgetY = GRAPH_HEIGHT - (FRAME_BUDGET_MS / max) * GRAPH_HEIGHT;
    row.budget.setAttribute('d', isTime ? `M0 ${budgetY}H${count}` : '');
}

/** What each metric means, as the explanation lists them. */
const MEANINGS: Readonly<Record<MetricKind, string>> = {
    fps: 'How many frames are drawn each second.',
    cpuMs: 'Milliseconds of main-thread work, from the start of the frame to the end of drawing it. The faint line in its graph marks 16.7 ms, all the time a frame has at 60 FPS.',
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
function infoPanel(): { readonly panel: HTMLElement; readonly closeButton: HTMLButtonElement } {
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
