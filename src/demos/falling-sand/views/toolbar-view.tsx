/** @jsxImportSource #pixi-jsx */

import { type Container, type Graphics, Rectangle } from 'pixi.js';
import { createPerfmonView, type FrameStats, PERFMON_WIDTH } from '#common';
import { type GrainStorageKind, TANK_SIZES, type TankSizeKind, type ToolKind } from '../models';
import { lookUpShade } from './grain-colors';
import type { GrainsViewKind } from './tank-view';
import {
    BUTTON_GAP, BUTTON_SIZE, SEGMENT_HEIGHT, STATS_Y, TOOLBAR_WIDTH, TOOLBAR_X, TOOLBAR_Y, VARIANTS_Y,
} from './view-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ToolbarViewProps {
    selectedTool: () => ToolKind;
    /** Whether Flip is available: not while the tank is already flipping. */
    canFlip: () => boolean;
    grainCount: () => number;
    movingCount: () => number;
    /** Frame timing to show, or undefined where there is none (e.g. rendering a thumbnail). */
    frameStats: () => FrameStats | undefined;
    /**
     * The implementations and tank size the demo is running with. Fixed for
     * the demo's life, so read once, when the view is built.
     */
    storage: GrainStorageKind;
    grainsView: GrainsViewKind;
    tankSize: TankSizeKind;
    onToolPressed?: (tool: ToolKind) => void;
    onFlipPressed?: () => void;
    onResetPressed?: () => void;
    onClearPressed?: () => void;
    /**
     * A different storage, grains view or tank size was pressed. Whoever
     * handles these starts the demo afresh with it; without them, pressing a
     * switch does nothing.
     */
    onStoragePressed?: (storage: GrainStorageKind) => void;
    onGrainsViewPressed?: (grainsView: GrainsViewKind) => void;
    onTankSizePressed?: (tankSize: TankSizeKind) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Everything below the tank: the tool palette, Flip, Reset and Clear, the
 * switches showing which implementations are running, the grain counts, and
 * frame timing. Presses are relayed; what they do is up to whoever handles
 * them.
 */
export function ToolbarView(props: ToolbarViewProps): Container {
    // Formatted only when the count changes, not every frame.
    const getGrainText = mapOnChange(props.grainCount, formatCount);
    const getMovingText = mapOnChange(props.movingCount, formatCount);

    // Flip, Reset and Clear share the width the palette leaves.
    const actionsX = TOOLS.length * (BUTTON_SIZE + BUTTON_GAP);
    const actionWidth = (TOOLBAR_WIDTH - actionsX - BUTTON_GAP * 2) / 3;
    const actionPitch = actionWidth + BUTTON_GAP;

    return (
        <container label="toolbar" x={TOOLBAR_X} y={TOOLBAR_Y}>
            {TOOLS.map((tool, i) => (
                <container x={i * (BUTTON_SIZE + BUTTON_GAP)}>
                    <ToolButtonView
                        tool={tool}
                        isSelected={() => props.selectedTool() === tool}
                        onPressed={() => props.onToolPressed?.(tool)}
                    />
                </container>
            ))}

            <container x={actionsX}>
                <ActionButtonView
                    label="FLIP"
                    width={actionWidth}
                    isEnabled={() => props.canFlip()}
                    onPressed={() => props.onFlipPressed?.()}
                />
            </container>
            <container x={actionsX + actionPitch}>
                <ActionButtonView label="RESET" width={actionWidth} onPressed={() => props.onResetPressed?.()} />
            </container>
            <container x={actionsX + actionPitch * 2}>
                <ActionButtonView label="CLEAR" width={actionWidth} onPressed={() => props.onClearPressed?.()} />
            </container>

            <container y={VARIANTS_Y}>
                <SegmentedView
                    label="MODEL"
                    options={STORAGE_OPTIONS}
                    selected={props.storage}
                    onSelected={(storage) => props.onStoragePressed?.(storage)}
                />
                <container x={SEGMENT_GROUP_PITCH}>
                    <SegmentedView
                        label="VIEW"
                        options={GRAINS_VIEW_OPTIONS}
                        selected={props.grainsView}
                        onSelected={(grainsView) => props.onGrainsViewPressed?.(grainsView)}
                    />
                </container>
                <container x={SEGMENT_GROUP_PITCH * 2}>
                    <SegmentedView
                        label="TANK CELLS"
                        options={TANK_SIZE_OPTIONS}
                        selected={props.tankSize}
                        onSelected={(tankSize) => props.onTankSizePressed?.(tankSize)}
                    />
                </container>
            </container>

            <container y={STATS_Y}>
                <text text="GRAINS" y={8} style={LABEL_STYLE} />
                <text text={getGrainText} x={72} y={4} style={COUNT_STYLE} />
                <text text="MOVING" y={32} style={LABEL_STYLE} />
                <text text={getMovingText} x={72} y={28} style={COUNT_STYLE} />
                <text text="Tap, hold and drag to pour" y={52} style={HINT_STYLE} />
                <text text="Switches restart the demo" y={66} style={HINT_STYLE} />
                <container x={TOOLBAR_WIDTH - PERFMON_WIDTH}>
                    {createPerfmonView({ getFrameStats: () => props.frameStats() })}
                </container>
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TOOLS: readonly ToolKind[] = ['sand', 'water', 'wall', 'erase'];

/**
 * One formatter, reused. `toLocaleString` builds a new one on every call,
 * which costs tens of microseconds; the moving count changes most frames.
 */
const COUNT_FORMAT = new Intl.NumberFormat('en-US');

function formatCount(count: number): string {
    return COUNT_FORMAT.format(count);
}

/**
 * A getter returning `map(read())`, where `map` runs only when `read()` returns
 * something new (compared with `===`), and the last result is returned
 * otherwise. Polling it costs one `read()` and one comparison.
 */
function mapOnChange<V, T>(read: () => V, map: (value: V) => T): () => T {
    let isFirst = true;
    let lastValue: V;
    let lastResult: T;
    return () => {
        const value = read();
        if (isFirst || value !== lastValue) {
            isFirst = false;
            lastValue = value;
            lastResult = map(value);
        }
        return lastResult;
    };
}

const TOOL_LABELS: Readonly<Record<ToolKind, string>> = {
    sand: 'SAND',
    water: 'WATER',
    wall: 'WALL',
    erase: 'ERASE',
};

const LABEL_STYLE = { fill: 0x8b949e, fontSize: 12, fontFamily: 'monospace' };
const COUNT_STYLE = { fill: 0xe6edf3, fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold' };
const HINT_STYLE = { fill: 0x6e7681, fontSize: 11, fontFamily: 'monospace' };
const BUTTON_LABEL_STYLE = { fill: 0xe6edf3, fontSize: 10, fontFamily: 'monospace' };
const ACTION_LABEL_STYLE = { fill: 0xe6edf3, fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold' };

const BUTTON_FILL = 0x243044;
const BUTTON_SELECTED_FILL = 0x34486a;
const SELECTED_RING = 0xf2cc60;

// --- Tool button --------------------------------------------------------------

interface ToolButtonViewProps {
    tool: ToolKind;
    isSelected: () => boolean;
    onPressed?: () => void;
}

/** A palette swatch: a sample of the tool's material, its name, and a ring when selected. */
function ToolButtonView(props: ToolButtonViewProps): Container {
    const { tool } = props;
    return (
        <container
            cursor="pointer"
            hitArea={new Rectangle(0, 0, BUTTON_SIZE, BUTTON_SIZE)}
            onPointerTap={() => props.onPressed?.()}
        >
            <graphics ref={(g) => drawButton(g, BUTTON_SIZE, BUTTON_FILL)} visible={() => !props.isSelected()} />
            <graphics ref={(g) => drawButton(g, BUTTON_SIZE, BUTTON_SELECTED_FILL)} visible={() => props.isSelected()} />
            <graphics x={BUTTON_SIZE / 2} y={20} ref={(g) => drawToolIcon(g, tool)} />
            <text text={TOOL_LABELS[tool]} x={BUTTON_SIZE / 2} y={42} anchor={0.5} style={BUTTON_LABEL_STYLE} />
            <graphics ref={drawSelectedRing} visible={() => props.isSelected()} />
        </container>
    );
}

/** A 5 x 5 patch of grains for a material; a tilted eraser for erase. Centred on the origin. */
function drawToolIcon(g: Graphics, tool: ToolKind): void {
    if (tool === 'erase') {
        g.rotation = -0.5;
        g.roundRect(-13, -6, 16, 12, 2).fill(0xf08da0);
        g.roundRect(1, -6, 12, 12, 2).fill(0xe6edf3);
        return;
    }
    const cell = 5;
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            // Round the corners of the patch, like a little heap.
            if ((row === 0 || row === 4) && (col === 0 || col === 4)) continue;
            g.rect(col * cell - 12.5, row * cell - 12.5, cell, cell).fill(lookUpShade(tool, row * 5 + col * 3));
        }
    }
}

function drawSelectedRing(g: Graphics): void {
    g.roundRect(-2, -2, BUTTON_SIZE + 4, BUTTON_SIZE + 4, 9).stroke({ color: SELECTED_RING, width: 2 });
}

// --- Action button ------------------------------------------------------------

interface ActionButtonViewProps {
    label: string;
    width: number;
    /** Whether the button responds. Always, if omitted. */
    isEnabled?: () => boolean;
    onPressed?: () => void;
}

/** A text button that dims while disabled and dips while held down. */
function ActionButtonView(props: ActionButtonViewProps): Container {
    const { label, width } = props;
    const isEnabled = (): boolean => props.isEnabled?.() ?? true;
    // Presentation state: held down, for the press dip.
    let isHeld = false;

    return (
        <container
            x={width / 2}
            y={BUTTON_SIZE / 2}
            pivotX={width / 2}
            pivotY={BUTTON_SIZE / 2}
            scale={() => (isHeld ? 0.94 : 1)}
            alpha={() => (isEnabled() ? 1 : 0.45)}
            cursor="pointer"
            hitArea={new Rectangle(0, 0, width, BUTTON_SIZE)}
            onPointerDown={() => { isHeld = true; }}
            onPointerUp={() => { isHeld = false; }}
            onPointerUpOutside={() => { isHeld = false; }}
            onPointerCancel={() => { isHeld = false; }}
            onPointerTap={() => { if (isEnabled()) props.onPressed?.(); }}
        >
            <graphics ref={(g) => drawButton(g, width, BUTTON_FILL)} />
            <text text={label} x={width / 2} y={BUTTON_SIZE / 2} anchor={0.5} style={ACTION_LABEL_STYLE} />
        </container>
    );
}

function drawButton(g: Graphics, width: number, fill: number): void {
    g.roundRect(0, 0, width, BUTTON_SIZE, 8).fill(fill);
}

// --- Segmented switch ---------------------------------------------------------

interface SegmentOption<T extends string> {
    readonly value: T;
    readonly label: string;
}

const STORAGE_OPTIONS: readonly SegmentOption<GrainStorageKind>[] = [
    { value: 'objects', label: 'OBJECTS' },
    { value: 'arrays', label: 'ARRAYS' },
];

const GRAINS_VIEW_OPTIONS: readonly SegmentOption<GrainsViewKind>[] = [
    { value: 'sprites', label: 'SPRITES' },
    { value: 'pixels', label: 'PIXELS' },
];

const TANK_SIZE_OPTIONS: readonly SegmentOption<TankSizeKind>[] = [
    { value: 'small', label: formatCells('small') },
    { value: 'medium', label: formatCells('medium') },
    { value: 'large', label: formatCells('large') },
];

/** A tank size by its number of cells, in thousands: `27K`. */
function formatCells(size: TankSizeKind): string {
    const { cols, rows } = TANK_SIZES[size];
    return `${Math.round((cols * rows) / 1000)}K`;
}

/**
 * Three switches share the toolbar's width, the widest (tank size) with
 * three segments and the others two, at a common pitch.
 */
const SEGMENT_WIDTH = 60;
const SEGMENT_GROUP_PITCH = (TOOLBAR_WIDTH - SEGMENT_WIDTH * 3) / 2;
const SEGMENT_LABEL_HEIGHT = 16;

interface SegmentedViewProps<T extends string> {
    label: string;
    options: readonly SegmentOption<T>[];
    /** The selected option. Read once, when the view is built. */
    selected: T;
    onSelected?: (value: T) => void;
}

/** A label, and a row of segments, one of them selected. Pressing another relays its value. */
function SegmentedView<T extends string>(props: SegmentedViewProps<T>): Container {
    return (
        <container>
            <text text={props.label} style={LABEL_STYLE} />
            {props.options.map((option, i) => (
                <container
                    x={i * SEGMENT_WIDTH}
                    y={SEGMENT_LABEL_HEIGHT}
                    cursor={option.value === props.selected ? 'default' : 'pointer'}
                    hitArea={new Rectangle(0, 0, SEGMENT_WIDTH, SEGMENT_HEIGHT)}
                    onPointerTap={() => {
                        if (option.value !== props.selected) props.onSelected?.(option.value);
                    }}
                >
                    <graphics
                        ref={(g) => drawSegment(g, option.value === props.selected ? BUTTON_SELECTED_FILL : BUTTON_FILL)}
                    />
                    <text
                        text={option.label}
                        x={SEGMENT_WIDTH / 2}
                        y={SEGMENT_HEIGHT / 2}
                        anchor={0.5}
                        style={BUTTON_LABEL_STYLE}
                    />
                    <graphics ref={drawSelectedSegmentRing} visible={option.value === props.selected} />
                </container>
            ))}
        </container>
    );
}

/** One segment, with a hairline gap to the next. */
function drawSegment(g: Graphics, fill: number): void {
    g.roundRect(1, 0, SEGMENT_WIDTH - 2, SEGMENT_HEIGHT, 5).fill(fill);
}

function drawSelectedSegmentRing(g: Graphics): void {
    g.roundRect(1, 0, SEGMENT_WIDTH - 2, SEGMENT_HEIGHT, 5).stroke({ color: SELECTED_RING, width: 1.5 });
}
