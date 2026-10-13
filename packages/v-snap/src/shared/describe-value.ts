// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/** Describes a value that a pose returned, for a message, such as 'a plain object' or 'an Array'. */
export function describeValue(value: unknown): string {
    if (!(value instanceof Object)) return String(value);
    const name: unknown = value.constructor?.name;
    if (typeof name !== 'string' || name === '' || name === 'Object') return 'a plain object';
    return `${/^([AEIOU]|HTML|SVG)/i.test(name) ? 'an' : 'a'} ${name}`;
}
