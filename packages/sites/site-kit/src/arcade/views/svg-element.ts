// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** An SVG element, with `attributes`. */
export function svgElement<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
