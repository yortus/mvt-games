import { ContainerTexture, FlatMaterial, Material3D, Mesh3D, PlaneGeometry } from '@pixi/3d';
import type { ColorSource, Container } from 'pixi.js';
import { refreshView, setRefresh, setUpdate, updateView } from '@mvtjs/utils';
import type { ValueOrGetter } from '@mvtjs/utils/jsx';
// Registers PixiJS 3D's scene nodes, so `updateView` and `refreshView` walk the screen
import './container3d-mixin';
import { createContentPointerForwarder } from './content-pointer-forwarder';
import { cancelScreenRender, requestScreenRender } from './screen-render-system';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ScreenViewBindings {
    /**
     * The 2D view that the screen shows, such as a scoreboard. It's drawn
     * upright, and fills the screen. The screen owns it, and destroys it
     * when the screen is destroyed.
     */
    readonly content: Container;
    /** The content's size, in its own pixels. */
    readonly contentWidth: number;
    readonly contentHeight: number;
    /** The screen's size in the scene, in world units. */
    readonly width: number;
    readonly height: number;
    /** How many texture pixels to draw for each of the content's pixels. Defaults to 1. */
    readonly resolution?: number;
    /** The colour drawn where the content leaves the screen empty. Defaults to black. */
    readonly clearColor?: ColorSource;
    /**
     * Whether the scene's lights light the screen, as they would a poster.
     * When it's absent or false, the screen shows the content's own colours
     * whatever the lighting, like a display.
     */
    readonly isLit?: boolean;
    /** Whether the content is pixel art, magnified with hard edges. Defaults to false. */
    readonly isPixelArt?: boolean;
    /** Whether the content's edges are smoothed as it's drawn. Defaults to false. */
    readonly antialias?: boolean;
    /**
     * Whether a pointer on the screen reaches the content, so the player can
     * press the buttons drawn on it. While it doesn't, a press passes
     * through to whatever is behind the screen. Defaults to false.
     */
    readonly isInteractive?: ValueOrGetter<boolean>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows a 2D view on a screen in a 3D scene, such as a scoreboard over the
 * track, or a game on an arcade cabinet. The screen is a plane, centred on
 * its origin and facing +z, that shows the content through a texture.
 *
 * The content isn't in the 2D stage or in the scene, so `updateView` and
 * `refreshView` never reach it on their own. Instead, the screen's update
 * step updates the content, and its refresh step refreshes it. The renderer
 * that draws the scene then draws the screen's texture, just before it
 * draws the scene. This works from the first frame, so a visual test or a
 * thumbnail shows the content.
 *
 * The screen owns its texture, plane, material and content, and destroys
 * them all when it's destroyed.
 */
export function ScreenView(bindings: ScreenViewBindings): Mesh3D {
    const { content, contentWidth, contentHeight, width, height, isInteractive = false } = bindings;
    const texture = new ContainerTexture({
        container: content,
        width: contentWidth,
        height: contentHeight,
        resolution: bindings.resolution ?? 1,
        clearColor: bindings.clearColor ?? 'black',
        antialias: bindings.antialias ?? false,
    });
    if (bindings.isPixelArt === true) texture.source.scaleMode = 'nearest';
    const geometry = new PlaneGeometry({ width, height });
    const material = bindings.isLit === true
        ? new Material3D({ baseColorTexture: texture })
        : new FlatMaterial({ baseColorTexture: texture });
    const screen = new Mesh3D({ geometry, material });
    const pointer = isInteractive === false
        ? undefined
        : createContentPointerForwarder({ screen, width, height, content, contentWidth, contentHeight });

    setUpdate(screen, (deltaMs) => {
        updateView(content, deltaMs);
    });
    setRefresh(screen, () => {
        refreshView(content);
        requestScreenRender(screen, texture);
        pointer?.setEnabled(typeof isInteractive === 'function' ? isInteractive() : isInteractive);
    });
    screen.on('destroyed', () => {
        cancelScreenRender(screen);
        material.destroy();
        geometry.destroy(true);
        // Frees the texture's source, and destroys the content with its children
        texture.destroy({ container: true });
    });
    return screen;
}
