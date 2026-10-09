import { pixelateRotatedImages, quantizeFontSizes } from './html-rules';
import { visualCommands } from './judge';
import { fitPicture } from './picture-budget';
import type { VisualPictureId, VisualRect, VisualVerdict } from './protocol';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface HtmlPictureOptions {
    /** The picture's size in CSS pixels. Default: the element's own, as it lays itself out. */
    readonly width?: number;
    readonly height?: number;
    /** A CSS colour. Default: the same dark grey as WebGL pictures. */
    readonly background?: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Photographs an element: mounts it in a host that shrinks to fit it (or
 * takes the given size), waits for its fonts and every image, and has Node
 * capture the host's rectangle through the DevTools protocol and judge it.
 * Font sizes are rounded to quarter pixels first (`quantizeFontSizes`).
 * The element is removed after, whatever happens. HTML pictures are always
 * full size (the browser's own scaling differs between systems), so one
 * over the size budget fails.
 */
export async function captureHtmlPicture(
    element: Element,
    options: HtmlPictureOptions & { readonly maxPixels: number },
    id: VisualPictureId,
): Promise<VisualVerdict & { readonly captureMs: number; readonly width: number; readonly height: number }> {
    const host = document.createElement('div');
    host.style.cssText = `position:absolute;left:0;top:0;display:inline-block;background:${options.background ?? DEFAULT_BACKGROUND};`;
    if (options.width !== undefined) host.style.width = `${options.width}px`;
    if (options.height !== undefined) host.style.height = `${options.height}px`;
    host.append(element);
    document.body.append(host);
    try {
        await document.fonts.ready;
        pixelateRotatedImages(host);
        quantizeFontSizes(host);
        // Every image loaded and decoded, lazy ones too (a lazy image off screen never loads)
        await Promise.all([...host.querySelectorAll('img')].map((image) => {
            image.loading = 'eager';
            return image.decode().catch(() => undefined);
        }));
        const rect = measureRect(host);
        const fit = fitPicture({ width: rect.width, height: rect.height, maxPixels: options.maxPixels, canScale: false });
        if ('problem' in fit) throw new Error(fit.problem);
        const verdict = await visualCommands.captureVisualPicture({ ...id, rect });
        return { ...verdict, width: rect.width, height: rect.height };
    }
    finally {
        host.remove();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_BACKGROUND = '#202024';

/**
 * The host's rectangle in the top-level page, which holds the test's page
 * in an iframe: rounded outwards to whole pixels, as Playwright's element
 * screenshots are.
 */
function measureRect(host: HTMLElement): VisualRect {
    const box = host.getBoundingClientRect();
    const frame = window.frameElement?.getBoundingClientRect();
    const left = box.left + (frame?.left ?? 0);
    const top = box.top + (frame?.top ?? 0);
    const x = Math.floor(left);
    const y = Math.floor(top);
    return { x, y, width: Math.ceil(left + box.width) - x, height: Math.ceil(top + box.height) - y };
}
