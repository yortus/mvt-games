import type { Container3D, ContainerTexture } from '@pixi/3d';
import { Container, type ExtensionMetadata, extensions, ExtensionType, type Renderer, type RenderOptions } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Marks a screen's texture to be drawn before the next render that draws
 * its scene. `ScreenView` calls it from its refresh step, once its 2D
 * content is refreshed. The texture is drawn with the renderer that draws
 * the scene. So the screen shows its content from the first frame, even in
 * a picture taken after a single render, such as a visual test.
 */
export function requestScreenRender(screen: Container3D, texture: ContainerTexture): void {
    pendingScreens.set(screen, texture);
}

/** Removes a screen that's being destroyed from the pending screens, so it isn't drawn. */
export function cancelScreenRender(screen: Container3D): void {
    pendingScreens.delete(screen);
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * Creates a Pixi renderer system. Pixi adds it to every renderer that
 * starts after this module loads, as it does PixiJS 3D's own systems. The
 * system wraps the renderer's `render` method. Before each render draws a
 * container, the system draws the texture of each pending screen whose
 * scene is in that container. PixiJS 3D requires a texture to be drawn
 * before the scene that samples it, and never during a render, so this is
 * the one safe moment.
 *
 * Pixi creates each system with `new`. This function returns an object, so
 * `new` returns that object in place of a new instance.
 */
function ScreenRenderSystem(renderer: Renderer): { readonly destroy: () => void } {
    const baseRender = renderer.render as (options: RenderOptions | Container, deprecated?: never) => void;
    let isDrawingScreens = false;
    renderer.render = function render(options: RenderOptions | Container, deprecated?: never): void {
        // Drawing a screen's texture is a render too, and it mustn't draw screens itself
        if (!isDrawingScreens && pendingScreens.size > 0) {
            isDrawingScreens = true;
            try {
                drawScreensIn(options instanceof Container ? options : (options as RenderOptions).container, renderer);
            }
            finally {
                isDrawingScreens = false;
            }
        }
        baseRender.call(renderer, options, deprecated);
    } as Renderer['render'];
    return {
        destroy: () => {
            renderer.render = baseRender as Renderer['render'];
        },
    };
}

const extension: ExtensionMetadata = {
    type: [ExtensionType.WebGLSystem, ExtensionType.WebGPUSystem],
    name: 'mvtScreens',
};
extensions.add(Object.assign(ScreenRenderSystem, { extension }));

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Each screen that has been refreshed since it was last drawn, with its texture. */
const pendingScreens = new Map<Container3D, ContainerTexture>();

/**
 * The container and renderer of the render that is drawing its screens.
 * They're kept here, not captured in a closure, so the walk over the pending
 * screens allocates nothing in a frame.
 */
const drawing: { container: Container | undefined; renderer: Renderer | undefined } = { container: undefined, renderer: undefined };

/** Draws each pending screen whose scene the render is about to draw. */
function drawScreensIn(container: Container, renderer: Renderer): void {
    drawing.container = container;
    drawing.renderer = renderer;
    // `forEach` rather than `for...of`, which would allocate an iterator and an entry for each screen
    pendingScreens.forEach(drawScreenIfInRender);
    drawing.container = undefined;
    drawing.renderer = undefined;
}

/** Draws a pending screen if its scene is in the render's container. Deleting the current entry is safe in `forEach`. */
function drawScreenIfInRender(texture: ContainerTexture, screen: Container3D): void {
    if (screen.destroyed) {
        pendingScreens.delete(screen);
        return;
    }
    if (!isInContainer(screen, drawing.container as Container)) return;
    pendingScreens.delete(screen);
    texture.render(drawing.renderer as Renderer);
}

/** Checks whether a scene node's `View3D` is the container, or inside it. */
function isInContainer(screen: Container3D, container: Container): boolean {
    // Pixi's parent chain ends in `null`
    for (let node: Container | null = screen.view3d; node !== null; node = node.parent) {
        if (node === container) return true;
    }
    return false;
}
