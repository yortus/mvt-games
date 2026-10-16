import { decodeOldCode, type OldPlaygroundCode } from './old-links';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a link into the playground asks for, from its hash. */
export type HashRequest =
    /** An example, by its id: `#example=<id>`, or the old `#preset=<id>`, which the docs' links use. */
    | { readonly kind: 'example'; readonly id: string }
    /** A shared project: `#p1=<encoded>`. */
    | { readonly kind: 'shared'; readonly encoded: string }
    /** A project shared from the old playground: `#code=<encoded>`. */
    | { readonly kind: 'old-code'; readonly code: OldPlaygroundCode }
    /** Nothing, or nothing the playground can read. */
    | { readonly kind: 'none' };

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Reads what a link's hash asks for. */
export function readHashRequest(hash: string): HashRequest {
    const text = hash.startsWith('#') ? hash.slice(1) : hash;
    const example = /^(?:example|preset)=([a-z0-9-]+)$/.exec(text);
    if (example !== null) return { kind: 'example', id: example[1] };
    if (text.startsWith(SHARED_PREFIX)) return { kind: 'shared', encoded: text.slice(SHARED_PREFIX.length) };
    if (text.startsWith(OLD_CODE_PREFIX)) {
        const code = decodeOldCode(text.slice(OLD_CODE_PREFIX.length));
        return code === undefined ? { kind: 'none' } : { kind: 'old-code', code };
    }
    return { kind: 'none' };
}

/** The hash for an example. */
export function toExampleHash(id: string): string {
    return `#example=${id}`;
}

/** The hash for a shared project, from its encoded form. */
export function toSharedHash(encoded: string): string {
    return `#${SHARED_PREFIX}${encoded}`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A share link's format, with its version, so the format can change later. */
const SHARED_PREFIX = 'p1=';
const OLD_CODE_PREFIX = 'code=';
