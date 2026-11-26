import { callApi } from './call-api';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The panel that shows a snapshot test's reference image, once v-snap has
 * written it. v-snap draws it in its own browser, as the test will draw it
 * each run, so you can set it beside the preview. The panel is hidden for a
 * test that the preview hasn't written a reference image for.
 */
export interface ReferencePanel {
    /** Shows how the writing of a test's reference image is going, and keeps it up to date until it's done. */
    readonly show: (test: { readonly file: string; readonly name: string } | undefined) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createReferencePanel(options: { readonly host: HTMLElement }): ReferencePanel {
    const { host } = options;
    const state = { shows: 0 };

    const render = (status: ReferenceStatus): void => {
        host.hidden = status.state === 'none';
        host.replaceChildren(Object.assign(document.createElement('h2'), { textContent: 'Reference image' }));
        if (status.state === 'running') {
            host.append(note('v-snap is drawing it, in its own browser. This takes a few seconds.'));
        }
        else if (status.state === 'written') {
            const image = Object.assign(document.createElement('img'), { src: status.imageUrl, alt: 'The reference image v-snap wrote' });
            host.append(note('As v-snap drew it. Each run of the test compares its image with this one.'), image);
        }
        else if (status.state === 'failed') {
            host.append(note('v-snap didn\'t write it. Vitest\'s output:'), Object.assign(document.createElement('pre'), { textContent: status.output }));
        }
    };

    return {
        show: (test) => {
            const shows = ++state.shows;
            if (test === undefined) {
                render({ state: 'none' });
                return;
            }
            // The server keys the image by the test's own name, without its describe blocks' names
            const at = test.name.lastIndexOf(' > ');
            const name = at === -1 ? test.name : test.name.slice(at + 3);
            const route = `reference?file=${encodeURIComponent(test.file)}&name=${encodeURIComponent(name)}`;
            const poll = async (): Promise<void> => {
                const status = await callApi<ReferenceStatus>({ route }).catch((error: unknown): ReferenceStatus => ({ state: 'failed', output: String(error) }));
                if (shows !== state.shows) return;
                render(status);
                if (status.state === 'running') setTimeout(() => void poll(), POLL_MS);
            };
            void poll();
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type ReferenceStatus =
    | { readonly state: 'none' }
    | { readonly state: 'running' }
    | { readonly state: 'written'; readonly imageUrl: string }
    | { readonly state: 'failed'; readonly output: string };

/** How often the panel checks how the writing is going, in milliseconds. */
const POLL_MS = 1000;

function note(text: string): HTMLElement {
    return Object.assign(document.createElement('p'), { className: 'vp-note', textContent: text });
}
