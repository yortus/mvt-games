// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The address of a page of the book, by its path in the docs, such as
 * `chapters/09-noticing-changes`. The book is served at the site's `docs/`,
 * beside the playground at its `playground/`, whose address is
 * `playgroundBase`, such as `/playground/`.
 */
export function toChapterUrl(path: string, playgroundBase: string): string {
    const siteRoot = playgroundBase.replace(/playground\/$/, '');
    return `${siteRoot}docs/${path}.html`;
}
