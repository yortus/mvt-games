import type { KnobValue, PoseInfo, SnapshotEdit, SnapshotRequest } from '../shared';
import { callApi } from './call-api';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The form that adds a snapshot test. That's a copy of the previewed test,
 * with the knobs as you've set them, under a name you choose. In a browser, the
 * preview's server edits the test file. In VS Code, the extension edits it,
 * through the editor, so that it can't overwrite changes you haven't saved.
 */
export interface SnapshotForm {
    readonly open: () => void;
    readonly close: () => void;
}

/** The previewed test, as a snapshot copies it. */
export interface SnapshotTarget {
    /** The test file's full path. */
    readonly file: string;
    /** The test file's path under `src/`, which the page's address names it by. */
    readonly fileKey: string;
    /** The test's whole name, after the names of any `describe` blocks round it. */
    readonly testName: string;
    readonly pose: PoseInfo | undefined;
    readonly values: ReadonlyMap<number, KnobValue>;
    /** The whole names of the file's tests, which a new test mustn't have. */
    readonly takenNames: readonly string[];
}

export interface SnapshotFormOptions {
    /** The form, which holds a text box for the name, a Cancel button and a place for messages. */
    readonly form: HTMLFormElement;
    /** Returns the previewed test, or `undefined` until you pick one. */
    readonly target: () => SnapshotTarget | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSnapshotForm(options: SnapshotFormOptions): SnapshotForm {
    const { form, target } = options;
    const nameBox = form.querySelector<HTMLInputElement>('input')!;
    const cancel = form.querySelector<HTMLButtonElement>('.vp-snapshot-cancel')!;
    const message = form.querySelector<HTMLElement>('.vp-snapshot-message')!;
    const state = { requests: 0 };

    const close = (): void => {
        form.hidden = true;
    };

    const open = (): void => {
        const current = target();
        if (current === undefined) return;
        form.hidden = false;
        message.textContent = current.pose === undefined ? 'This test\'s pose is a function defined elsewhere, so the preview can\'t copy it.' : '';
        nameBox.value = suggestName(current);
        nameBox.focus();
        nameBox.select();
    };

    /** Sends a snapshot request to whichever edits the file, and returns the edit it made, or why it refused. */
    const requestSnapshot = (request: SnapshotRequest): Promise<SnapshotEdit> => {
        if (window.parent === window) return callApi<SnapshotEdit>({ route: 'snapshot', body: request });
        const id = ++state.requests;
        return new Promise((resolve, reject) => {
            const answer = (event: MessageEvent<{ readonly type?: string; readonly id?: number; readonly edit?: SnapshotEdit }>): void => {
                if (event.data.type !== 'view-preview:snapshot-result' || event.data.id !== id || event.data.edit === undefined) return;
                removeEventListener('message', answer);
                resolve(event.data.edit);
            };
            addEventListener('message', answer);
            window.parent.postMessage({ type: 'view-preview:snapshot', id, request }, '*');
            setTimeout(() => {
                removeEventListener('message', answer);
                reject(new Error('VS Code didn\'t answer the snapshot request. Is the MVT View Preview extension up to date?'));
            }, ANSWER_TIMEOUT_MS);
        });
    };

    const takeSnapshot = async (): Promise<void> => {
        const current = target();
        if (current?.pose === undefined) return;
        const name = nameBox.value.trim();
        const wholeName = `${prefixOf(current.testName)}${name}`;
        if (name === '' || current.takenNames.includes(wholeName)) {
            message.textContent = name === '' ? 'The new test needs a name.' : `The file already has a test named '${name}'. Pick another name.`;
            return;
        }
        // The file changes as the test is added, which reloads the page, so the page's address names the new test first
        const previous = location.hash;
        history.replaceState(undefined, '', `#${encodeURIComponent(current.fileKey)}::${encodeURIComponent(wholeName)}`);
        message.textContent = 'Adding the test...';
        const request: SnapshotRequest = {
            file: current.file,
            poseLine: current.pose.line,
            poseColumn: current.pose.column,
            literals: current.pose.knobs.map((knob) => knob.value),
            values: [...current.values],
            name,
        };
        const edit = await requestSnapshot(request).catch((error: unknown): SnapshotEdit => ({ kind: 'refused', reason: error instanceof Error ? error.message : String(error) }));
        if (edit.kind === 'refused') {
            history.replaceState(undefined, '', previous);
            message.textContent = edit.reason;
            return;
        }
        message.textContent = `Added on line ${edit.line}. The page reloads on it, and v-snap writes its reference image.`;
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        void takeSnapshot();
    });
    cancel.addEventListener('click', close);
    return { open, close };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the page waits for VS Code to answer, in milliseconds. */
const ANSWER_TIMEOUT_MS = 20_000;

/** Returns the names of the `describe` blocks round a test, as they start its whole name, such as `hud > `. */
function prefixOf(wholeName: string): string {
    const at = wholeName.lastIndexOf(' > ');
    return at === -1 ? '' : wholeName.slice(0, at + 3);
}

/** Returns a name for the snapshot that says which knobs changed, for you to edit. */
function suggestName(target: SnapshotTarget): string {
    const name = target.testName.slice(prefixOf(target.testName).length);
    const changes = [...target.values].slice(0, 2).map(([index, value]) => `${target.pose?.knobs[index]?.label ?? 'a knob'} at ${String(value)}`);
    return changes.length === 0 ? `${name}, again` : `${name}, with ${changes.join(' and ')}`;
}
