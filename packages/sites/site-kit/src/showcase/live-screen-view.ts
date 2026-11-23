import { Container3D, type Mesh3D } from '@pixi/3d';
import { ScreenView, setRefresh, type ValueOrGetter } from '@mvtjs/pixi-3d';
import type { LiveEntry } from './live-entries-host';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LiveScreenViewBindings {
    /** The entry running on this screen, or undefined while it isn't running. */
    readonly live: () => LiveEntry | undefined;
    /** The screen's size, in metres. */
    readonly width: number;
    readonly height: number;
    /**
     * Whether a Pixi entry receives pointer events on its screen now, such as
     * while the visitor stands at it, so they can use it in place. Never, if
     * absent.
     */
    readonly isInteractive?: ValueOrGetter<boolean>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A screen in a showcase while its entry runs, such as a cabinet's screen.
 * The entry draws on a 2D Pixi container, and a `ScreenView` shows that
 * container on a plane. The plane is unlit, so it glows like a real screen.
 * The screen updates and refreshes the entry's views as the showcase's
 * scene ticks, and draws them every frame, starting with the first. While
 * the entry isn't running, the plane is gone, and whatever is behind it
 * shows, such as the entry's picture.
 *
 * While the screen is interactive, it passes the pointer on to the entry.
 * The visitor can then press the entry's buttons and drag its sliders on
 * the screen, where it hangs in the scene.
 */
export function LiveScreenView({ live, width, height, isInteractive = false }: LiveScreenViewBindings): Container3D {
    const view = new Container3D();
    let shown: LiveEntry | undefined;
    let screen: Mesh3D | undefined;

    setRefresh(view, () => {
        const next = live();
        if (next !== shown) show(next);
    });
    return view;

    function show(next: LiveEntry | undefined): void {
        shown = next;
        if (screen !== undefined) {
            view.removeChild(screen);
            // Destroying the screen destroys its texture and the entry's container, which the entry has already left
            screen.destroy();
            screen = undefined;
        }
        // An entry that draws with the DOM is laid over the screen by a LiveElementView, and its picture shows beneath
        if (next === undefined || next.element !== undefined) return;
        screen = ScreenView({
            content: next.stage,
            contentWidth: next.width,
            contentHeight: next.height,
            width,
            height,
            // Pixel art is drawn at its own size and magnified with hard edges. Anything else is drawn sharper, within reason
            resolution: next.isPixelArt ? 1 : Math.min(2, MAX_SMOOTH_SIDE / Math.max(next.width, next.height)),
            isPixelArt: next.isPixelArt,
            isInteractive,
        });
        // Just in front of the picture behind it, so it covers it
        screen.z = 0.002;
        view.addChild(screen);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The longest side, in pixels, that a smooth entry's screen is drawn at. */
const MAX_SMOOTH_SIDE = 1280;
