import { onDestroyed, setRefresh } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import type { HostMessage, SandboxMessage } from '../sandbox';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PreviewViewBindings {
    /** The document the sandbox runs, or undefined when there is no sandbox. */
    readonly sandboxDocument: () => string | undefined;
    /** Rises each time a new sandbox document is ready, which starts a new sandbox. */
    readonly sandboxesStarted: () => number;
    readonly isPaused: () => boolean;
    /** Rises each time a paused run should advance one frame. */
    readonly steps: () => number;
    readonly speed: () => number;
    /** The colour around the project, as `#rrggbb`. A new sandbox's document has it already; a running one is told as it changes. */
    readonly background: () => string;
    /**
     * Whether keys pressed in this page go on to the sandbox, for a page
     * whose sandbox can't take the keyboard's focus itself, such as one
     * inside another page. Keys typed into a field or an editor stay there.
     */
    readonly isKeyboardForwarded?: boolean;
    /** Whether a new sandbox takes the keyboard's focus, as one the visitor started does. */
    readonly isFocusTaken: () => boolean;
    /** Shown while there is no sandbox. */
    readonly placeholder: () => string;
    /** Reported for each message from the sandbox now running. */
    readonly onSandboxMessage?: (message: SandboxMessage) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Where the project runs: an iframe whose origin is opaque, so the project
 * cannot reach the site's storage or the page around it. Each run gets a
 * fresh iframe, since a document loads each module only once. The view
 * passes on the sandbox's messages, and tells it to pause, resume, step,
 * change speed and change the colour around the project as the bindings
 * change.
 */
export function PreviewView(bindings: PreviewViewBindings): Element {
    const element = document.createElement('div');
    element.className = 'preview';
    const placeholder = document.createElement('div');
    placeholder.className = 'preview-placeholder';
    element.append(placeholder);
    let frame: HTMLIFrameElement | undefined;
    const watcher = watch({
        sandboxes: bindings.sandboxesStarted,
        hasDocument: () => bindings.sandboxDocument() !== undefined,
        isPaused: bindings.isPaused,
        steps: bindings.steps,
        speed: bindings.speed,
        background: bindings.background,
        placeholder: bindings.placeholder,
    });
    // The watcher sees only changes from here on, so the first sandbox, or the placeholder, shows now
    placeholder.textContent = bindings.placeholder();
    const firstDocument = bindings.sandboxDocument();
    if (firstDocument !== undefined) startFrame(firstDocument);
    placeholder.hidden = frame !== undefined;

    window.addEventListener('message', onMessage);
    if (bindings.isKeyboardForwarded === true) {
        window.addEventListener('keydown', forwardKey);
        window.addEventListener('keyup', forwardKey);
    }
    setRefresh(element, refresh);
    onDestroyed(element, () => {
        window.removeEventListener('message', onMessage);
        window.removeEventListener('keydown', forwardKey);
        window.removeEventListener('keyup', forwardKey);
    });
    return element;

    function refresh(): void {
        const w = watcher.poll();
        if (w.sandboxes.changed || !w.hasDocument.current) {
            const document = bindings.sandboxDocument();
            if (document === undefined) removeFrame();
            else if (w.sandboxes.changed) startFrame(document);
        }
        if (frame !== undefined) {
            if (w.isPaused.changed) send({ kind: w.isPaused.current ? 'pause' : 'resume' });
            if (w.steps.increased) send({ kind: 'step', deltaMs: STEP_MS });
            if (w.speed.changed) send({ kind: 'set-speed', speed: w.speed.current });
            if (w.background.changed) send({ kind: 'set-background', colour: w.background.current });
        }
        if (w.placeholder.changed) placeholder.textContent = w.placeholder.current;
        placeholder.hidden = frame !== undefined;
    }

    function startFrame(document: string): void {
        removeFrame();
        frame = window.document.createElement('iframe');
        frame.className = 'preview-frame';
        // Scripts only: no `allow-same-origin`, so the sandbox's origin is opaque
        frame.sandbox.add('allow-scripts');
        // The Run press in this page counts as the gesture that lets the sandbox start sound
        frame.allow = 'autoplay';
        frame.srcdoc = document;
        element.append(frame);
        if (bindings.isFocusTaken()) frame.focus();
    }

    function removeFrame(): void {
        frame?.remove();
        frame = undefined;
    }

    function send(message: HostMessage): void {
        frame?.contentWindow?.postMessage(message, '*');
    }

    function forwardKey(event: KeyboardEvent): void {
        const target = event.target instanceof Element ? event.target : undefined;
        const field = target?.closest('input, textarea, select, [contenteditable]') ?? undefined;
        if (frame === undefined || field !== undefined) return;
        // The page around would scroll on arrows and the space bar
        if (SCROLLING_KEYS.includes(event.key)) event.preventDefault();
        const { key, code, repeat, shiftKey, ctrlKey, altKey, metaKey } = event;
        send({ kind: 'key', key: { type: event.type === 'keyup' ? 'keyup' : 'keydown', key, code, repeat, shiftKey, ctrlKey, altKey, metaKey } });
    }

    function onMessage(event: MessageEvent<SandboxMessage>): void {
        // Only the sandbox running now; one just replaced may still be sending
        if (frame === undefined || event.source !== frame.contentWindow) return;
        // Told as it starts, since what's sent before the sandbox listens is lost: it can start paused, as a run after an edit does
        if (event.data.kind === 'started') {
            if (bindings.isPaused()) send({ kind: 'pause' });
            if (bindings.speed() !== 1) send({ kind: 'set-speed', speed: bindings.speed() });
        }
        bindings.onSandboxMessage?.(event.data);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far Step advances a paused run: one frame at 60 frames a second. */
const STEP_MS = 1000 / 60;

/** Keys that scroll a page, which a game uses too. */
const SCROLLING_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'Home', 'End'];
