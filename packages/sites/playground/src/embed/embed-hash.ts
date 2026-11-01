// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the embed page is asked to show, from its hash, such as
 * `#example=bouncing-ball&file=views/ball-view.ts&theme=light`. The book
 * names each example below its embed, and links it to the playground there,
 * so the embed shows neither unless its hash asks, with `title=1` and
 * `playground-link=1`, for a page that doesn't.
 */
export interface EmbedRequest {
    /** The example to run, by its folder's name. */
    readonly exampleId: string;
    /** The file the editor opens on, by its path in the example. Undefined to open on `main.ts`. */
    readonly path: string | undefined;
    /** Whether the page around the embed is light or dark, so the embed matches it. */
    readonly scheme: 'light' | 'dark';
    /** Whether the bar shows the example's name. */
    readonly isNameShown: boolean;
    /** Whether the bar has a button that opens the example, with the reader's changes, in the playground. */
    readonly isPlaygroundLinkShown: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Reads what an embed's hash asks for. Returns undefined if it names no example. */
export function readEmbedRequest(hash: string): EmbedRequest | undefined {
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const exampleId = params.get('example') ?? '';
    if (!/^[a-z0-9-]+$/.test(exampleId)) return undefined;
    const path = params.get('file') ?? '';
    return {
        exampleId,
        path: path === '' ? undefined : path,
        scheme: params.get('theme') === 'light' ? 'light' : 'dark',
        isNameShown: params.get('title') === '1',
        isPlaygroundLinkShown: params.get('playground-link') === '1',
    };
}

/** Writes the hash that asks an embed for a request. */
export function toEmbedHash(request: EmbedRequest): string {
    const params = new URLSearchParams({ example: request.exampleId });
    if (request.path !== undefined) params.set('file', request.path);
    params.set('theme', request.scheme);
    if (request.isNameShown) params.set('title', '1');
    if (request.isPlaygroundLinkShown) params.set('playground-link', '1');
    return `#${params.toString()}`;
}
