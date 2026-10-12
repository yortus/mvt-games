import { pixelateRotatedImages, quantizeFontSizes } from './html-rules';
import { visualCommands } from './judge';
import { fitImage } from '../shared';
import type { VisualImageId, VisualRect, VisualVerdict } from '../protocol';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface HtmlImageOptions {
    /** The image's size in CSS pixels. By default, it is the element's own size, as the element lays itself out. */
    readonly width?: number;
    readonly height?: number;
    /**
     * The background, as a CSS colour or a number such as `0x202024`, as
     * canvas tests take it. By default, it is the same dark grey as canvas
     * images.
     */
    readonly background?: string | number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Captures an element and returns the verdict. It mounts the element in a
 * host element, which shrinks to fit it or takes the given size, and then
 * prepares it, if the options say how, so that the element is in the page
 * as it is prepared. It waits for the element's fonts, its `<img>` elements
 * and the images that its styles use. Then Node captures the host's
 * rectangle through the DevTools protocol and judges it. Font sizes are
 * rounded to quarter pixels first (`quantizeFontSizes`). The element is
 * removed afterwards, whatever happens. HTML images are always full size,
 * because the browser's own scaling differs between systems. So an HTML
 * image over the size budget fails, and so does one bigger than the page,
 * which can't be captured.
 */
export async function captureHtmlImage(
    element: Element,
    options: HtmlImageOptions & { readonly maxPixels: number; readonly prepare?: (element: Element) => void },
    id: VisualImageId,
): Promise<VisualVerdict & { readonly captureMs: number; readonly prepareMs: number; readonly width: number; readonly height: number }> {
    const host = document.createElement('div');
    host.style.cssText = `position:absolute;left:0;top:0;display:inline-block;background:${toCssColour(options.background ?? DEFAULT_BACKGROUND)};`;
    if (options.width !== undefined) host.style.width = `${options.width}px`;
    if (options.height !== undefined) host.style.height = `${options.height}px`;
    host.append(element);
    document.body.append(host);
    try {
        const prepared = performance.now();
        options.prepare?.(element);
        const prepareMs = performance.now() - prepared;
        await document.fonts.ready;
        pixelateRotatedImages(host);
        quantizeFontSizes(host);
        // Wait until every `<img>` element is loaded and decoded, lazy ones
        // too. A lazy one that is off screen never loads, so each one is made
        // eager.
        await Promise.all([...host.querySelectorAll('img')].map((image) => {
            image.loading = 'eager';
            return image.decode().catch(() => undefined);
        }));
        await loadStyleImages(host);
        checkFitsPage(host);
        const rect = measureRect(host);
        const fit = fitImage({ width: rect.width, height: rect.height, maxPixels: options.maxPixels, canScale: false, advice: 'HTML is drawn at full size, so give the view a smaller size, or pose part of it.' });
        if ('problem' in fit) throw new Error(fit.problem);
        const verdict = await visualCommands.captureVisualImage({ ...id, rect });
        return { ...verdict, prepareMs, width: rect.width, height: rect.height };
    }
    finally {
        host.remove();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_BACKGROUND = '#202024';

/** Returns a colour as CSS: a number such as `0x202024` as `#202024`, and a CSS colour as it is. */
function toCssColour(colour: string | number): string {
    return typeof colour === 'number' ? `#${colour.toString(16).padStart(6, '0')}` : colour;
}

/**
 * Throws if the host goes past the page, which is the viewport's size. The
 * part past it isn't drawn, so its capture would be blank there.
 */
function checkFitsPage(host: HTMLElement): void {
    const box = host.getBoundingClientRect();
    if (box.right <= innerWidth && box.bottom <= innerHeight) return;
    throw new Error(`The view is ${Math.ceil(box.width)}x${Math.ceil(box.height)}, which goes past the test page's ${innerWidth}x${innerHeight} viewport, so the part past it can't be captured. Give the view a smaller size, or pose part of it.`);
}

/**
 * Loads and decodes the images that the host's styles use, so that they are
 * drawn before the capture: backgrounds, border images, list markers and
 * masks, of every element and of its ::before and ::after, and the images
 * of SVG `<image>` elements and video posters. It then waits for two frames,
 * so that the page draws them, but only if there were any.
 */
async function loadStyleImages(host: HTMLElement): Promise<void> {
    const urls = new Set<string>();
    for (const element of [host, ...host.querySelectorAll('*')]) {
        for (const pseudo of [undefined, '::before', '::after']) {
            const style = getComputedStyle(element, pseudo);
            for (let i = 0; i < IMAGE_PROPERTIES.length; i++) {
                for (const match of style.getPropertyValue(IMAGE_PROPERTIES[i]).matchAll(CSS_URL)) urls.add(match[2]);
            }
        }
        if (element instanceof SVGImageElement && element.href.baseVal !== '') urls.add(element.href.baseVal);
        if (element instanceof HTMLVideoElement && element.poster !== '') urls.add(element.poster);
    }
    if (urls.size === 0) return;
    await Promise.all([...urls].map((url) => {
        const image = new Image();
        image.src = url;
        return image.decode().catch(() => undefined);
    }));
    for (let i = 0; i < 2; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** The style properties that can hold images. */
const IMAGE_PROPERTIES = ['background-image', 'border-image-source', 'list-style-image', 'mask-image'];

/** Matches each `url(...)` in a computed style, with its address in the second group. */
const CSS_URL = /url\((["']?)(.*?)\1\)/g;

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
