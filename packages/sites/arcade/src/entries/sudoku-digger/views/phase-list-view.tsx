/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { DIM_TEXT_COLOR, FOCUS_COLOR, LOGIC_COLOR, TEXT_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PhaseListViewBindings {
    /** The names of the steps of the method, in order. Read once. */
    names: readonly string[];
    /** Which step is under way, counting from 0. Every step before it is done. A number past the last means all are done. */
    current: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The steps of the method, one to a line, each with a dot: green once it is
 * done, gold while it is under way, and hollow before it starts.
 */
export function PhaseListView(bindings: PhaseListViewBindings): Container {
    const rows: Container[] = [];
    for (let i = 0; i < bindings.names.length; i++) {
        const isDone = () => bindings.current() > i;
        const isCurrent = () => bindings.current() === i;
        rows.push(
            <container y={i * ROW_HEIGHT}>
                <graphics
                    x={DOT_RADIUS + 1}
                    y={ROW_HEIGHT / 2}
                    ref={(g) => g.circle(0, 0, DOT_RADIUS).fill(0xffffff)}
                    visible={() => isDone() || isCurrent()}
                    tint={() => (isDone() ? LOGIC_COLOR : FOCUS_COLOR)}
                />
                <graphics
                    x={DOT_RADIUS + 1}
                    y={ROW_HEIGHT / 2}
                    ref={(g) => g.circle(0, 0, DOT_RADIUS).stroke({ color: DIM_TEXT_COLOR, width: 1 })}
                    visible={() => bindings.current() < i}
                />
                <text
                    x={DOT_RADIUS * 2 + 10}
                    y={ROW_HEIGHT / 2}
                    anchorY={0.5}
                    text={`${i + 1}. ${bindings.names[i]}`}
                    style={NAME_STYLE}
                    tint={() => (isCurrent() ? FOCUS_COLOR : isDone() ? TEXT_COLOR : DIM_TEXT_COLOR)}
                />
            </container>,
        );
    }
    return <container label="phase-list">{rows}</container>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 19;
const DOT_RADIUS = 5;
const NAME_STYLE = { fontFamily: 'monospace', fontSize: 13, fill: 0xffffff };
