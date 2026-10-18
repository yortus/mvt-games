// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The class of the Perfmon's root. Its parts' classes start with it. */
export const PERFMON_CLASS = 'mvt-perfmon';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Adds the Perfmon's stylesheet to a document's head, unless it's there already. */
export function addPerfmonStyles(document: Document): void {
    if (document.getElementById(STYLE_ID) !== null) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;
    document.head.append(style);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STYLE_ID = 'mvt-perfmon-styles';

/**
 * The colours are variables, with defaults for a dark background. The panel
 * is a size container, so the queries at the end grow its text and graphs
 * when it's given more room than a corner of a game.
 */
const STYLES = `
.mvt-perfmon {
    --mvt-perfmon-background: rgba(0, 0, 0, 0.35);
    --mvt-perfmon-text: #c9d1d9;
    --mvt-perfmon-muted: #8b949e;
    --mvt-perfmon-fps: #7ee787;
    --mvt-perfmon-cpuMs: #79c0ff;
    --mvt-perfmon-gpuMs: #ffa657;
    --mvt-perfmon-reads: #d2a8ff;
    --mvt-perfmon-methodCalls: #f2cc60;
    --mvt-perfmon-methodListRebuilds: #ff7b72;
    --mvt-perfmon-rebuildNodeVisits: #ffa198;
    --mvt-perfmon-titlebar-height: 24px;
    container-type: inline-size;
    position: relative;
    box-sizing: border-box;
    min-width: 180px;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--mvt-perfmon-background);
    color: var(--mvt-perfmon-text);
    font: 12px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.mvt-perfmon-rows {
    display: grid;
    grid-template-columns: max-content minmax(7ch, max-content) 1fr;
    align-items: center;
    column-gap: 8px;
}
.mvt-perfmon-label, .mvt-perfmon-value {
    color: var(--mvt-perfmon-row);
    white-space: nowrap;
}
.mvt-perfmon-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.mvt-perfmon-dim {
    opacity: 0.4;
}
.mvt-perfmon-graph {
    display: block;
    width: 100%;
    height: 12px;
    background: color-mix(in srgb, var(--mvt-perfmon-text) 8%, transparent);
    fill: var(--mvt-perfmon-row);
}
.mvt-perfmon-budget {
    stroke: var(--mvt-perfmon-text);
    stroke-opacity: 0.35;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
    fill: none;
}
.mvt-perfmon-caption {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--mvt-perfmon-muted);
    font-size: 10px;
    line-height: 16px;
}
.mvt-perfmon-rule {
    flex: 1;
    height: 1px;
    background: currentColor;
    opacity: 0.5;
}
.mvt-perfmon-titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    height: var(--mvt-perfmon-titlebar-height);
    margin: -6px -8px 4px;
    padding: 0 6px 0 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--mvt-perfmon-text) 15%, transparent);
}
.mvt-perfmon-titlebar-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 600 12px/1 system-ui, sans-serif;
}
.mvt-perfmon-info-button {
    flex: none;
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 1px solid var(--mvt-perfmon-text);
    border-radius: 50%;
    background: transparent;
    color: var(--mvt-perfmon-text);
    font: italic 700 9px/12px Georgia, 'Times New Roman', serif;
    text-align: center;
    opacity: 0.65;
    cursor: pointer;
}
.mvt-perfmon-info-button:hover, .mvt-perfmon-info-button:focus-visible, .mvt-perfmon-info-button[aria-expanded="true"] {
    opacity: 1;
}
.mvt-perfmon-info {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    border-radius: inherit;
    background: var(--mvt-perfmon-info-background, #0d1117);
    color: var(--mvt-perfmon-text);
    font: 11px/14px system-ui, sans-serif;
}
/* With a title bar, the explanation opens under it, so the bar and its (i) stay in reach */
.mvt-perfmon-has-title .mvt-perfmon-info {
    top: var(--mvt-perfmon-titlebar-height);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
}
.mvt-perfmon-info-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--mvt-perfmon-text) 15%, transparent);
}
.mvt-perfmon-info-title {
    flex: 1;
    font-weight: 600;
}
.mvt-perfmon-info-close {
    flex: none;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--mvt-perfmon-text);
    font: 18px/22px system-ui, sans-serif;
    opacity: 0.75;
    cursor: pointer;
}
.mvt-perfmon-info-close:hover, .mvt-perfmon-info-close:focus-visible {
    opacity: 1;
    background: color-mix(in srgb, var(--mvt-perfmon-text) 12%, transparent);
}
.mvt-perfmon-info-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 6px 8px;
}
.mvt-perfmon-info[hidden] {
    display: none;
}
.mvt-perfmon-info p {
    margin: 0 0 4px;
}
.mvt-perfmon-info .mvt-perfmon-info-heading {
    margin-top: 8px;
    color: var(--mvt-perfmon-muted);
}
@container (min-width: 360px) {
    .mvt-perfmon-rows {
        font-size: 14px;
        line-height: 22px;
        column-gap: 12px;
    }
    .mvt-perfmon-graph {
        height: 18px;
    }
    .mvt-perfmon-caption {
        font-size: 12px;
        line-height: 22px;
    }
    .mvt-perfmon-titlebar-title {
        font-size: 14px;
    }
    .mvt-perfmon-info-button {
        width: 18px;
        height: 18px;
        font-size: 11px;
        line-height: 16px;
    }
    .mvt-perfmon-info {
        font-size: 13px;
        line-height: 18px;
    }
    .mvt-perfmon-info-head {
        padding: 6px 8px 6px 14px;
    }
    .mvt-perfmon-info-body {
        padding: 8px 14px;
    }
}
`;
