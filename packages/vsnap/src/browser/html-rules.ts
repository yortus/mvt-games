import { blankFontUrl } from './fonts';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Installs CSS rules that make HTML views draw the same on every system,
 * and from one run to the next, where they would otherwise differ. The rules
 * last for the rest of the page's life. There are three of them:
 *
 * - **Text is blank.** Every element's text is set in the blank font. In
 *   that font, every code point is one empty glyph, 0.625 em wide. So text
 *   keeps a layout that every system agrees on, and draws nothing. The
 *   systems' fonts and font engines draw text differently, and nothing in
 *   the browser makes them agree.
 * - **Unstyled text fields are 20 zeros wide (`20ch`).** A text field's
 *   default width comes from the font's average character width, which each
 *   system works out its own way. The rule uses `:where()`, which has no
 *   specificity, so a width that the page sets still wins.
 * - **A text field's caret is hidden,** since it blinks.
 *
 * A shadow root's elements don't see the page's rules, so `adoptHtmlRules`
 * gives them to each open shadow root of a view.
 */
export async function installHtmlRules(): Promise<void> {
    const face = new FontFace(BLANK_FAMILY, `url(${blankFontUrl})`, { weight: '1 1000' });
    await face.load();
    document.fonts.add(face);
    const style = document.createElement('style');
    style.textContent = HTML_RULES;
    document.head.append(style);
}

/**
 * Gives the page's rules (see `installHtmlRules`) to every open shadow root
 * under the host, such as a web component's, so that its text is blank too.
 * A closed shadow root can't be reached, and its text draws as the system
 * draws it.
 */
export function adoptHtmlRules(host: HTMLElement): void {
    for (const root of listShadowRoots(host)) {
        sheet ??= createSheet();
        if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    }
}

/**
 * Brings every animation and transition under the host to rest, as
 * Playwright's screenshots do with `animations: 'disabled'`. One that ends is
 * finished, so it shows its end. One that never ends is cancelled, so it
 * shows the element as it is without it. Then it waits for the page to draw
 * them at rest. Otherwise an image would catch a spinner or a fade at
 * whatever moment the capture came.
 */
export async function settleAnimations(host: HTMLElement): Promise<void> {
    // Settling one can start another, such as on an `animationend` event.
    for (let round = 0; round < 3; round++) {
        const animations = listAnimations(host);
        if (animations.length === 0) return;
        for (const animation of animations) {
            if (animation.effect?.getComputedTiming().iterations === Infinity) animation.cancel();
            else animation.finish();
        }
        for (let i = 0; i < 2; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
    }
}

/**
 * Returns the host and every element under it, those in open shadow roots
 * included, each before the elements inside it.
 */
export function listElements(host: HTMLElement): (HTMLElement | SVGElement)[] {
    const elements: (HTMLElement | SVGElement)[] = [];
    const visit = (element: Element): void => {
        if (element instanceof HTMLElement || element instanceof SVGElement) elements.push(element);
        if (element.shadowRoot !== null) for (const child of element.shadowRoot.children) visit(child);
        for (const child of element.children) visit(child);
    };
    visit(host);
    return elements;
}

/**
 * Makes every `<img>` element under a rotating transform use nearest-neighbour
 * sampling. Smooth sampling under a rotation rounds differently on arm64
 * processors, by up to 26 levels of 255. Nearest-neighbour sampling differs
 * by up to 2. Scaled images that are not rotated stay smooth, because every
 * system draws them the same.
 */
export function pixelateRotatedImages(host: HTMLElement): void {
    for (const element of listElements(host)) {
        if (element instanceof HTMLImageElement && isRotated(element, host)) element.style.imageRendering = 'pixelated';
    }
}

/**
 * Rounds every element's font size to the nearest quarter pixel. It sets
 * each size as an inline style that outranks the page's own. Linux scales
 * fonts in 64ths of a pixel, and Windows and macOS do not. So at a size like
 * 17.3 px, or a form control's default of 13.33 px, lines come out a
 * fraction of a pixel longer on one system than on the others, and a box's
 * edge can move. In quarter pixels, all three systems lay the blank font out
 * exactly alike. Every size is read before any is written. That way, an
 * element sized in `em` is rounded from its own size, not from its parent's
 * rounded one. Pseudo-elements with sizes of their own are not reached.
 */
export function quantizeFontSizes(host: HTMLElement): void {
    const elements = listElements(host);
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

/** The rules that `installHtmlRules` describes. */
const HTML_RULES = `
    *, *::before, *::after, ::placeholder, ::marker, input, button, select, textarea {
        font-family: "${BLANK_FAMILY}" !important;
        font-synthesis: none !important;
        caret-color: transparent !important;
    }
    :where(input:not([type]), input[type=text], input[type=search], input[type=number],
           input[type=email], input[type=password], input[type=url], input[type=tel]) {
        width: 20ch;
    }`;

/** The rules as a sheet that shadow roots adopt, made on first use. */
let sheet: CSSStyleSheet | undefined;

function createSheet(): CSSStyleSheet {
    const made = new CSSStyleSheet();
    made.replaceSync(HTML_RULES);
    return made;
}

function listShadowRoots(host: HTMLElement): ShadowRoot[] {
    const roots: ShadowRoot[] = [];
    for (const element of listElements(host)) {
        if (element.shadowRoot !== null) roots.push(element.shadowRoot);
    }
    return roots;
}

/** Returns the animations of the host, the elements under it, their pseudo-elements, and the elements in their open shadow roots. */
function listAnimations(host: HTMLElement): Animation[] {
    const animations = new Set(host.getAnimations({ subtree: true }));
    for (const root of listShadowRoots(host)) {
        for (const animation of root.getAnimations()) animations.add(animation);
    }
    return [...animations];
}

/** Returns an element's parent, across the edge of a shadow root. */
function findParent(element: Element): Element | undefined {
    if (element.parentElement !== null) return element.parentElement;
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root.host : undefined;
}

/** Returns whether the element, or an ancestor up to the host, is turned by a transform, not only moved or scaled. */
function isRotated(element: Element, host: Element): boolean {
    for (let e: Element | undefined = element; e !== undefined && e !== host.parentElement; e = findParent(e)) {
        const transform = getComputedStyle(e).transform;
        if (transform === 'none') continue;
        const m = new DOMMatrixReadOnly(transform);
        if (m.b !== 0 || m.c !== 0 || !m.is2D) return true;
    }
    return false;
}
