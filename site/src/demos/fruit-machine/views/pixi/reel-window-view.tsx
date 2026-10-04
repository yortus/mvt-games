/** @jsxImportSource @mvtjs/pixi */
import type { Container, Graphics, Texture } from 'pixi.js';
import { ROW_COUNT, type SymbolKind } from '../../data';
import { ReelView } from './reel-view';
import {
    CELL_SIZE, FRAME, FRAME_PADDING, FRAME_SHADE, REEL_COUNT, REEL_FACE, REEL_GAP, WINDOW_BACKING, WINDOW_WIDTH, WINDOW_X,
    WINDOW_Y,
} from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ReelWindowViewBindings {
    /** Fixed: one strip per reel. */
    readonly strips: readonly (readonly SymbolKind[])[];
    readonly positionAt: (reel: number) => number;
    readonly isBlurredAt: (reel: number) => boolean;
    readonly textureFor: (kind: SymbolKind, isBlurred: boolean) => Texture;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The window and its frame, with a reel behind each column, masked to the window. */
export function ReelWindowView(bindings: ReelWindowViewBindings): Container {
    // One rounded mask over the window, a child of the reels so it moves with them
    const windowMask = <graphics ref={drawWindowMask} />;

    return (
        <container>
            <graphics ref={drawFrame} />
            <container x={WINDOW_X} y={WINDOW_Y} mask={windowMask}>
                {windowMask}
                {bindings.strips.map((strip, reel) => (
                    <container x={reel * (CELL_SIZE + REEL_GAP)}>
                        <ReelView
                            strip={strip}
                            position={() => bindings.positionAt(reel)}
                            isBlurred={() => bindings.isBlurredAt(reel)}
                            textureFor={bindings.textureFor}
                        />
                    </container>
                ))}
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WINDOW_HEIGHT = ROW_COUNT * CELL_SIZE;

function drawFrame(g: Graphics): void {
    const x = WINDOW_X - FRAME_PADDING;
    const y = WINDOW_Y - FRAME_PADDING;
    const width = WINDOW_WIDTH + FRAME_PADDING * 2;
    const height = WINDOW_HEIGHT + FRAME_PADDING * 2;
    g.roundRect(x, y + 8, width, height, 28).fill(FRAME_SHADE);
    g.roundRect(x, y, width, height, 28).fill(FRAME);
    g.roundRect(WINDOW_X - 6, WINDOW_Y - 6, WINDOW_WIDTH + 12, WINDOW_HEIGHT + 12, 16).fill(WINDOW_BACKING);
    for (let reel = 0; reel < REEL_COUNT; reel++) {
        g.roundRect(WINDOW_X + reel * (CELL_SIZE + REEL_GAP), WINDOW_Y, CELL_SIZE, WINDOW_HEIGHT, 12).fill(REEL_FACE);
    }
}

function drawWindowMask(g: Graphics): void {
    g.roundRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT, 12).fill(REEL_FACE);
}
