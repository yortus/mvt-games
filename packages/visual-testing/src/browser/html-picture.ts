import { pixelateRotatedImages, quantizeFontSizes } from './html-rules';
import { visualCommands } from './judge';
import { fitPicture } from './picture-budget';
import type { VisualPictureId, VisualRect, VisualVerdict } from '../protocol';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface HtmlPictureOptions {
    /** The picture's size in CSS pixels. By default, it is the element's own size, as the element lays itself out. */
    readonly width?: number;
    readonly height?: number;
    /** The background, as a CSS colour. By default, it is the same dark grey as canvas pictures. */
    readonly background?: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Photographs an element and returns the verdict. It mounts the element in a
 * host element, which shrinks to fit it or takes the given size. It waits
 * for the element's fonts and every image. Then Node captures the host's
 * rectangle through the DevTools protocol and judges it. Font sizes are
 * rounded to quarter pixels first (`quantizeFontSizes`). The element is
 * removed afterwards, whatever happens. HTML pictures are always full size,
 * because the browser's own scaling differs between systems. So an HTML
 * picture over the size budget fails.
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
        // Wait until every image is loaded and decoded, lazy ones too. A lazy
        // image that is off screen never loads, so each one is made eager.
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
 * Returns the host's rectangle in the top-level page, which holds the test's
 * page in an iframe. The rectangle is rounded outwards to whole pixels, as
 * Playwright's element screenshots are.
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
