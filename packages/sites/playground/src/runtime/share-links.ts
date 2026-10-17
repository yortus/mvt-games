import type { ProjectFile } from './prepare-project';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A project as a share link holds it. */
export interface SharedProject {
    readonly name: string;
    readonly files: readonly ProjectFile[];
    /** Whether the playground keeps the project's barrels. A link without it keeps them, as links from before it did. */
    readonly isBarrelKept?: boolean;
    /** What the project is. A link without one has none. */
    readonly description?: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Writes a project for a share link: as JSON, gzipped, in URL-safe base64.
 */
export async function encodeSharedProject(project: SharedProject): Promise<string> {
    const json = JSON.stringify({
        n: project.name,
        f: project.files.map((f) => [f.path, f.text]),
        ...(project.isBarrelKept === false ? { b: 0 } : {}),
        ...(project.description === undefined || project.description === '' ? {} : { d: project.description }),
    });
    const zipped = await transform(new TextEncoder().encode(json), new CompressionStream('gzip'));
    return toBase64Url(zipped);
}

/** Reads a project from a share link. Returns undefined if the link is damaged. */
export async function decodeSharedProject(encoded: string): Promise<SharedProject | undefined> {
    try {
        const json = new TextDecoder().decode(await transform(fromBase64Url(encoded), new DecompressionStream('gzip')));
        const data = JSON.parse(json) as { n?: unknown; f?: unknown; b?: unknown; d?: unknown };
        if (typeof data.n !== 'string' || !Array.isArray(data.f)) return undefined;
        const files: ProjectFile[] = [];
        for (const entry of data.f as unknown[]) {
            if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') return undefined;
            files.push({ path: entry[0], text: entry[1] });
        }
        return { name: data.n, files, isBarrelKept: data.b !== 0, description: typeof data.d === 'string' ? data.d : '' };
    }
    catch {
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
    const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(output).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
