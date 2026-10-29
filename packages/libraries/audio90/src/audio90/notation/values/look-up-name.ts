// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The number of `name` in `index`, or throws an error that starts with `where` and lists the names allowed. */
export function lookUpName<T extends string>(index: Readonly<Record<T, number>>, name: string, where: string): number {
    if (Object.hasOwn(index, name)) return index[name as T];
    throw new Error(`${where}: '${name}' is not one of ${Object.keys(index).join(', ')}`);
}
