// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How many decimal places a coordinate deserves in a view `span` wide: a few
 * more than the view can tell apart, and never more than a double carries.
 */
export function countDigits(span: number): number {
    const needed = Math.ceil(-Math.log10(span)) + 5;
    return Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, needed));
}

/**
 * How much the view magnifies, as the panel shows it: plainly while the
 * numbers are small, and in powers of ten once they are not.
 */
export function formatZoom(zoom: number): string {
    if (zoom < 10) return `${zoom.toFixed(2)}x`;
    if (zoom < 100000) return `${Math.round(zoom)}x`;
    return `${zoom.toExponential(1).replace('e+', 'e')}x`;
}

/**
 * Creates a reader that turns a number into text with `digits` decimal
 * places. It keeps the last text it made, and makes a new one only when the
 * number or the number of places changes, so that reading it every frame
 * allocates nothing.
 */
export function createFixedText(): (value: number, digits: number) => string {
    let lastValue = Number.NaN;
    let lastDigits = -1;
    let text = '';
    return (value, digits) => {
        if (value !== lastValue || digits !== lastDigits) {
            lastValue = value;
            lastDigits = digits;
            text = value.toFixed(digits);
        }
        return text;
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MIN_DIGITS = 4;
/** A double carries about 16 significant digits, and the view never goes past them. */
const MAX_DIGITS = 17;
