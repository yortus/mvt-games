/** @jsxImportSource #pixi-jsx */

import { type Container, type Graphics, Rectangle } from 'pixi.js';
import { createPerfmonView, type FrameStats, PERFMON_WIDTH } from '#common';
import { memo } from '#pixi-jsx';
import { lookUpShade } from './grain-colors';
import { BUTTON_GAP, BUTTON_SIZE, STATS_Y, TOOLBAR_WIDTH, TOOLBAR_X, TOOLBAR_Y } from './view-constants';
import type { ToolKind } from './demo-model';

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
    onToolPressed?: (tool: ToolKind) => void;
    onFlipPressed?: () => void;
    onResetPressed?: () => void;
    onClearPressed?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Everything below the tank: the tool palette, Flip, Reset and Clear, the grain
 * counts, and frame timing. Presses are relayed; what they do is up to
 * whoever handles them.
 */
export function ToolbarView(props: ToolbarViewProps): Container {
    // Formatted only when the count changes, not every frame.
    const getGrainText = memo(props, (p) => COUNT_FORMAT.format(p.grainCount()));
    const getMovingText = memo(props, (p) => COUNT_FORMAT.format(p.movingCount()));

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

            <container y={STATS_Y}>
                <text text="GRAINS" y={8} style={LABEL_STYLE} />
                <text text={getGrainText} x={72} y={4} style={COUNT_STYLE} />
                <text text="MOVING" y={32} style={LABEL_STYLE} />
                <text text={getMovingText} x={72} y={28} style={COUNT_STYLE} />
                <text text="Tap, hold and drag to pour" y={54} style={HINT_STYLE} />
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
