import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import { COLOURS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WireViewBindings {
    /** A cell's size in pixels, read once. */
    cellSize: number;
    /** How many grid points the wire runs through, from its post. 0 with no wire out. */
    wireLength: () => number;
    /** The grid point the wire passes at `index`, counting from its post. */
    wireRowAt: (index: number) => number;
    wireColAt: (index: number) => number;
    /** Where the farmhand is, at the wire's live end, in grid steps. */
    endRow: () => number;
    endCol: () => number;
    /** How far along the wire from its post it has gone slack, in grid steps. */
    slackDistance: () => number;
    /** Whether the wire has snapped. It flickers red. */
    isSnapped: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The wire being strung, a thin bright line with a shadow, from its post to
 * the farmhand. Slack running along it from the post shows red. A snapped
 * wire flickers. Each new step of wire is added to what is drawn, and the
 * stretch to the farmhand, which moves every frame, is a sprite.
 */
export function WireView(bindings: WireViewBindings): Container {
    const { cellSize } = bindings;
    const laid = new Graphics();
    const tail = new Sprite(Texture.WHITE);
    const tailShadow = new Sprite(Texture.WHITE);
    tail.tint = COLOURS.wire;
    tailShadow.tint = COLOURS.wireShadow;
    const slack = new Graphics();
    const view = new Container();
    view.addChild(tailShadow, laid, tail, slack);

    // How many of the wire's points are drawn in `laid`
    let drawnLength = 0;
    // Presentation state: time, for the snapped wire's flicker
    let flickerMs = 0;
    const watcher = watch({ slack: bindings.slackDistance, length: bindings.wireLength });
    drawSlack(bindings.wireLength(), bindings.slackDistance());

    setUpdate(view, (deltaMs) => {
        flickerMs = bindings.isSnapped() ? flickerMs + deltaMs : 0;
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        // Polled while the wire is hidden too. Its length always changes as it shows again, so the slack is drawn then
        const watched = watcher.poll();
        const length = bindings.wireLength();
        view.visible = length > 0;
        if (length < drawnLength) {
            laid.clear();
            drawnLength = 0;
        }
        for (let i = Math.max(1, drawnLength); i < length; i++) {
            drawSegment(laid, bindings.wireRowAt(i - 1), bindings.wireColAt(i - 1), bindings.wireRowAt(i), bindings.wireColAt(i));
        }
        drawnLength = length;
        if (length === 0) return;

        placeTail(length);
        if (watched.anyChanged) drawSlack(length, watched.slack.current);

        const isSnapped = bindings.isSnapped();
        const isLit = !isSnapped || Math.floor(flickerMs / FLICKER_MS) % 2 === 0;
        const colour = isSnapped ? COLOURS.slack : 0xffffff;
        laid.tint = colour;
        tail.tint = isSnapped ? COLOURS.slack : COLOURS.wire;
        view.alpha = isLit ? 1 : 0.35;
    }

    /** One step of wire, between two neighbouring grid points, and its shadow. */
    function drawSegment(g: Graphics, row0: number, col0: number, row1: number, col1: number): void {
        const x = Math.min(col0, col1) * cellSize;
        const y = Math.min(row0, row1) * cellSize;
        const isAcross = row0 === row1;
        const width = isAcross ? cellSize + 1 : 1;
        const height = isAcross ? 1 : cellSize + 1;
        g.rect(x + 1, y + 1, width, height).fill(COLOURS.wireShadow);
        g.rect(x, y, width, height).fill(COLOURS.wire);
    }

    /** The stretch from the wire's last point to the farmhand. */
    function placeTail(length: number): void {
        const fromX = bindings.wireColAt(length - 1) * cellSize;
        const fromY = bindings.wireRowAt(length - 1) * cellSize;
        const toX = Math.round(bindings.endCol() * cellSize);
        const toY = Math.round(bindings.endRow() * cellSize);
        const x = Math.min(fromX, toX);
        const y = Math.min(fromY, toY);
        const width = Math.abs(toX - fromX) + 1;
        const height = Math.abs(toY - fromY) + 1;
        tail.position.set(x, y);
        tail.setSize(width, height);
        tailShadow.position.set(x + 1, y + 1);
        tailShadow.setSize(width, height);
    }

    /** The slack, from the post along the wire for `distance` grid steps, in red, sagging a pixel. */
    function drawSlack(length: number, distance: number): void {
        slack.clear();
        let left = distance;
        for (let i = 1; i < length && left > 0; i++) {
            const row0 = bindings.wireRowAt(i - 1);
            const col0 = bindings.wireColAt(i - 1);
            const share = Math.min(1, left);
            const row1 = row0 + (bindings.wireRowAt(i) - row0) * share;
            const col1 = col0 + (bindings.wireColAt(i) - col0) * share;
            const x = Math.min(col0, col1) * cellSize;
            const y = Math.min(row0, row1) * cellSize;
            const width = Math.max(1, Math.abs(col1 - col0) * cellSize);
            const height = Math.max(1, Math.abs(row1 - row0) * cellSize);
            slack.rect(Math.round(x), Math.round(y) + 1, Math.round(width), Math.round(height)).fill(COLOURS.slack);
            left -= 1;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FLICKER_MS = 90;
