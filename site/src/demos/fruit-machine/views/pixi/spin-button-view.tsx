/** @jsxImportSource @mvtjs/pixi */
import type { Container, Graphics } from 'pixi.js';
import { FONT_FAMILY, WHITE } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What pressing the button would do, or `'disabled'` when nothing. */
export type SpinButtonMode = 'spin' | 'stop' | 'skip' | 'disabled';

export interface SpinButtonViewBindings {
    readonly mode: () => SpinButtonMode;
    readonly radius: number;
    /** The user pressed the button while it was enabled. */
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One round button that spins, stops a spin, or skips a celebration, its
 * colour and label saying which, and grey when there is nothing to do. It
 * sinks while held down: presentation state, from the pointer, not the model.
 */
export function SpinButtonView(bindings: SpinButtonViewBindings): Container {
    const { radius } = bindings;
    let isHeld = false;

    return (
        <container
            cursor={() => (bindings.mode() === 'disabled' ? 'default' : 'pointer')}
            onPointerDown={() => { isHeld = true; }}
            onPointerUp={() => { isHeld = false; }}
            onPointerUpOutside={() => { isHeld = false; }}
            onPointerTap={press}
        >
            <graphics y={PRESS_DEPTH} ref={(g) => drawDisc(g, radius)} tint={() => STYLES[bindings.mode()].shade} />
            <container y={() => (isHeld && bindings.mode() !== 'disabled' ? PRESS_DEPTH : 0)}>
                <graphics ref={(g) => drawDisc(g, radius)} tint={() => STYLES[bindings.mode()].face} />
                <graphics ref={(g) => drawRing(g, radius)} alpha={0.35} />
                <text text={() => STYLES[bindings.mode()].label} anchor={0.5} style={LABEL_STYLE} />
            </container>
        </container>
    );

    function press(): void {
        if (bindings.mode() !== 'disabled') bindings.onPressed?.();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the button sinks when held, and how deep its edge shows. */
const PRESS_DEPTH = 6;

const STYLES: { readonly [M in SpinButtonMode]: { readonly face: string; readonly shade: string; readonly label: string } } = {
    spin: { face: '#2fd27a', shade: '#1f9e57', label: 'SPIN' },
    stop: { face: '#ff5468', shade: '#c4283d', label: 'STOP' },
    skip: { face: '#ffb020', shade: '#c97f00', label: 'SKIP' },
    disabled: { face: '#6e6390', shade: '#4b4268', label: 'SPIN' },
};

const LABEL_STYLE = { fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: '900', letterSpacing: 2, fill: WHITE };

/** Drawn white once, and tinted for the mode. */
function drawDisc(g: Graphics, radius: number): void {
    g.circle(0, 0, radius).fill(WHITE);
}

function drawRing(g: Graphics, radius: number): void {
    g.circle(0, 0, radius - 8).stroke({ width: 4, color: WHITE });
}
