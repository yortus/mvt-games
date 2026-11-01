/** @jsxImportSource @mvtjs/pixi */

import { type Container, type FederatedPointerEvent, type Graphics, Rectangle } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import type { Audio80 } from 'audio90';
import type { RockFieldModel } from '../models';
import { HeartbeatView } from './heartbeat-view';
import { RockAudioView } from './rock-audio-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FieldViewBindings {
    readonly model: RockFieldModel;
    /** What the game's sounds play on, read once. */
    readonly sfx: Pick<Audio80, 'play'>;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The rocks, a count of those left, and the heart, with an audio view for
 * the rocks breaking. Click a rock to break it.
 */
export function FieldView({ model, sfx, width, height }: FieldViewBindings): Container {
    const rocksLeftLabel = createComputed({ watch: () => model.rocksLeft, compute: (left) => 'Rocks left: ' + left });

    return (
        <container
            hitArea={new Rectangle(0, 0, width, height)}
            onPointerDown={(e: FederatedPointerEvent) => model.breakRockAt(e.globalX, e.globalY)}
        >
            <text text="Click the rocks to break them." x={24} y={130} style={HINT_STYLE} />
            <text text={rocksLeftLabel} x={24} y={154} style={COUNT_STYLE} />
            {/* The field's rocks never move, so each is drawn once, and hidden once it's broken */}
            {model.rocks.map((rock) => (
                <graphics x={rock.x} y={rock.y} visible={() => !rock.isBroken} ref={(g) => drawRock(g, rock.radius)} />
            ))}
            <HeartbeatView sfx={sfx} rocksLeft={() => model.rocksLeft} />
            <RockAudioView sfx={sfx} rocksBroken={() => model.rocksBroken} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HINT_STYLE = { fontFamily: 'monospace', fontSize: 13, fill: 0x8b949e };
const COUNT_STYLE = { fontFamily: 'monospace', fontSize: 16, fill: 0xe6edf3 };

/** Draws a rock, with its middle at 0, 0. */
function drawRock(g: Graphics, radius: number): void {
    const r = radius;
    g.poly([-r, -4, -r * 0.5, -r, r * 0.4, -r * 0.9, r, -r * 0.2, r * 0.8, r * 0.6, 0, r, -r * 0.7, r * 0.7])
        .fill(0x8a7a6a)
        .stroke({ color: 0xb8a898, width: 2 });
}
