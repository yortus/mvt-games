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
    setRefresh(element, refresh);
    onDestroyed(element, () => window.removeEventListener('message', onMessage));
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
        // A run starts unpaused, at the speed set; the watcher has seen both
        if (bindings.speed() !== 1) send({ kind: 'set-speed', speed: bindings.speed() });
    }

    function removeFrame(): void {
        frame?.remove();
        frame = undefined;
    }

    function send(message: HostMessage): void {
        frame?.contentWindow?.postMessage(message, '*');
    }

    function onMessage(event: MessageEvent<SandboxMessage>): void {
        // Only the sandbox running now; one just replaced may still be sending
        if (frame === undefined || event.source !== frame.contentWindow) return;
        bindings.onSandboxMessage?.(event.data);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far Step advances a paused run: one frame at 60 frames a second. */
const STEP_MS = 1000 / 60;
