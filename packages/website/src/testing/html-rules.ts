import { blankFontUrl } from './fonts';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Pins what HTML pictures would otherwise draw differently on each system,
 * for the rest of the page's life:
 *
 * - **Text is blank.** Every element's text is set in the blank font: every
 *   code point one empty glyph, 0.625 em wide, so text keeps a layout every
 *   system agrees on and draws nothing. The systems' fonts and font engines
 *   draw text differently, and nothing in the browser makes them agree.
 * - **Unstyled text fields are 20 zeros wide.** A text field's default
 *   width comes from the font's average character width, which each system
 *   works out its own way. `:where()` has no specificity, so a width the
 *   page sets still wins.
 */
export async function installHtmlRules(): Promise<void> {
    const face = new FontFace(BLANK_FAMILY, `url(${blankFontUrl})`, { weight: '1 1000' });
    await face.load();
    document.fonts.add(face);
    const style = document.createElement('style');
    style.textContent = `
        *, *::before, *::after, ::placeholder, ::marker, input, button, select, textarea {
            font-family: "${BLANK_FAMILY}" !important;
            font-synthesis: none !important;
        }
        :where(input:not([type]), input[type=text], input[type=search], input[type=number],
               input[type=email], input[type=password], input[type=url], input[type=tel]) {
            width: 20ch;
        }`;
    document.head.append(style);
}

/**
 * Samples every image under a rotating transform nearest-neighbour: smooth
 * sampling under a rotation rounds differently on arm64 processors (by up
 * to 26 levels of 255; nearest-neighbour, 2). Scaled images that are not
 * rotated stay smooth, which every system draws the same.
 */
export function pixelateRotatedImages(host: HTMLElement): void {
    for (const image of host.querySelectorAll('img')) {
        if (isRotated(image, host)) image.style.imageRendering = 'pixelated';
    }
}

/**
 * Rounds every element's font size to the nearest quarter pixel, as an
 * inline style that outranks the page's own. Linux scales fonts in 64ths of
 * a pixel and Windows and macOS do not, so at a size like 17.3 px (or a
 * form control's default, 13.33 px) lines come out a fraction of a pixel
 * longer on one than the others, and a box's edge can move. In quarter
 * pixels, all three lay the blank font out exactly alike. Every size is
 * read before any is written, so an element sized in `em` is rounded from
 * its own size, not from its parent's rounded one. Pseudo-elements with
 * sizes of their own are not reached.
 */
export function quantizeFontSizes(host: HTMLElement): void {
    const elements = [host, ...host.querySelectorAll<HTMLElement | SVGElement>('*')];
    const sizes = elements.map((e) => parseFloat(getComputedStyle(e).fontSize));
    for (let i = 0; i < elements.length; i++) {
        const quantized = Math.round(sizes[i] * 4) / 4;
        if (quantized !== sizes[i]) elements[i].style.setProperty('font-size', `${quantized}px`, 'important');
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BLANK_FAMILY = 'Visual Blank';

/** Whether the element, or an ancestor up to the host, is turned by a transform (not only moved or scaled). */
function isRotated(element: Element, host: Element): boolean {
    for (let e: Element | null = element; e !== null && e !== host.parentElement; e = e.parentElement) {
        const transform = getComputedStyle(e).transform;
        if (transform === 'none') continue;
        const m = new DOMMatrixReadOnly(transform);
        if (m.b !== 0 || m.c !== 0 || !m.is2D) return true;
    }
    return false;
}
