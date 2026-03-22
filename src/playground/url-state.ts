// ---------------------------------------------------------------------------
// URL state - encode/decode playground state in the URL hash
// ---------------------------------------------------------------------------

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PlaygroundState {
    readonly presetId?: string;
    readonly modelCode?: string;
    readonly viewCode?: string;
    readonly canvasWidth?: number;
    readonly canvasHeight?: number;
}

// ---------------------------------------------------------------------------
// Encode / Decode
// ---------------------------------------------------------------------------

export function encodeState(state: PlaygroundState): string {
    // For preset-only states, use a short format
    if (state.presetId && !state.modelCode && !state.viewCode) {
        return `preset=${state.presetId}`;
    }

    // For full code states, compress as JSON
    const payload = JSON.stringify({
        p: state.presetId,
        m: state.modelCode,
        v: state.viewCode,
        w: state.canvasWidth,
        h: state.canvasHeight,
    });

    return `code=${compressToEncodedURIComponent(payload)}`;
}

export function decodeState(hash: string): PlaygroundState {
    // Strip leading '#'
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!raw) return {};

    // Check for preset=<id> format
    const presetMatch = raw.match(/^preset=([a-z0-9-]+)$/);
    if (presetMatch) {
        return { presetId: presetMatch[1] };
    }

    // Check for code=<compressed> format
    const codeMatch = raw.match(/^code=(.+)$/);
    if (codeMatch) {
        try {
            const json = decompressFromEncodedURIComponent(codeMatch[1]);
            if (!json) return {};
            const data = JSON.parse(json) as {
                p?: string;
                m?: string;
                v?: string;
                w?: number;
                h?: number;
            };
            return {
                presetId: data.p,
                modelCode: data.m,
                viewCode: data.v,
                canvasWidth: data.w,
                canvasHeight: data.h,
            };
        } catch {
            return {};
        }
    }

    return {};
}

export function pushState(state: PlaygroundState): void {
    const encoded = encodeState(state);
    window.history.replaceState(undefined, '', `#${encoded}`);
}

export function readState(): PlaygroundState {
    return decodeState(window.location.hash);
}
