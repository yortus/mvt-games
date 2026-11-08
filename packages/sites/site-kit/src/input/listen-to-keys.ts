// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Which keys to listen for, and where to report them. Keys are named as
 * `KeyboardEvent.key` names them. A letter given in lower case works with
 * Shift too, unless its capital is listed as well.
 */
export interface KeysOptions<H extends string> {
    /**
     * Whether the keys are being taken. They aren't while the view plays only
     * to be watched. Even then, a key let go still counts, so none stays held.
     */
    isActive: () => boolean;
    /** What to do for each key pressed, once for each press, however long it stays down. */
    pressed: Readonly<Record<string, () => void>>;
    /** What to do for each key pressed, and again each time it repeats while held. */
    repeating: Readonly<Record<string, () => void>>;
    /** The keys that work while held, and what each one holds. Several keys can hold the same thing. */
    held: Readonly<Record<string, H>>;
    /** What is held has changed. Ask `isHeld` about each thing the keys can hold. */
    onHeldChanged: (isHeld: (hold: H) => boolean) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Listens to the keyboard, and returns a function that stops listening. It
 * only reports. What each key means is up to whoever calls it.
 *
 * It reports from the browser's key events, and from the window losing
 * focus, all of which come between frames. Stopping releases every hold,
 * and reports that from a microtask, once the code running has finished, so
 * it is safe to stop during a frame.
 *
 * A focused slider or button keeps the keys it uses itself, such as the
 * arrows and Space. So does an open dialog, such as the page's pause menu.
 */
export function listenToKeys<H extends string>(options: KeysOptions<H>): () => void {
    const { pressed, repeating, held } = options;
    // The keys down, as the table names them, and how many are down for each
    // hold. Several keys can be for one hold, which stays held while any of them is down
    const keysDown = new Set<string>();
    const holdCounts = new Map<H, number>();
    const isHeld = (hold: H): boolean => (holdCounts.get(hold) ?? 0) > 0;

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', releaseAll);
        // A view may stop listening as it is destroyed, during a frame, so
        // what was held is released once the frame's code has finished
        queueMicrotask(releaseAll);
    };

    function onKeyDown(event: KeyboardEvent): void {
        if (!options.isActive() || event.ctrlKey || event.metaKey || event.altKey) return;
        if (isTakenByTarget(event) || isDialogOpen()) return;

        const heldKey = findKey(held, event.key);
        if (heldKey !== undefined) {
            event.preventDefault();
            if (keysDown.has(heldKey)) return;
            keysDown.add(heldKey);
            const hold = held[heldKey];
            const count = holdCounts.get(hold) ?? 0;
            holdCounts.set(hold, count + 1);
            if (count === 0) options.onHeldChanged(isHeld);
            return;
        }
        const repeated = lookUp(repeating, event.key);
        if (repeated !== undefined) {
            event.preventDefault();
            repeated();
            return;
        }
        const press = lookUp(pressed, event.key);
        if (press === undefined) return;
        event.preventDefault();
        if (!event.repeat) press();
    }

    function onKeyUp(event: KeyboardEvent): void {
        const heldKey = findKey(held, event.key);
        if (heldKey === undefined || !keysDown.delete(heldKey)) return;
        const hold = held[heldKey];
        const count = (holdCounts.get(hold) ?? 1) - 1;
        holdCounts.set(hold, count);
        if (count === 0) options.onHeldChanged(isHeld);
    }

    /** Releases everything, as when the window loses focus and the keys' releases would go astray. */
    function releaseAll(): void {
        if (keysDown.size === 0) return;
        keysDown.clear();
        holdCounts.clear();
        options.onHeldChanged(isHeld);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The keys a focused control uses itself, by the kind of control. */
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const BUTTON_KEYS = new Set([' ', 'Enter']);

/** What `table` says for `key`, or for its lower case. */
function lookUp<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
    return table[key] ?? table[key.toLowerCase()];
}

/** The name that `table` uses for `key`: the key itself, or its lower case, if the table has either. */
function findKey(table: Readonly<Record<string, unknown>>, key: string): string | undefined {
    if (table[key] !== undefined) return key;
    const lower = key.toLowerCase();
    return table[lower] === undefined ? undefined : lower;
}

/** Whether the key belongs to the control it was pressed in: a text field handles every key, a slider its arrows, and a button Space and Enter. */
function isTakenByTarget(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
    if (target instanceof HTMLInputElement) {
        if (target.type !== 'range') return true;
        return SLIDER_KEYS.has(event.key);
    }
    if (target instanceof HTMLButtonElement) return BUTTON_KEYS.has(event.key);
    return false;
}

/** Whether a dialog is open over the page, such as its pause menu. Its keys are its own. */
function isDialogOpen(): boolean {
    const dialogs = document.querySelectorAll('[aria-modal="true"]');
    for (let i = 0; i < dialogs.length; i++) {
        if (dialogs[i].getClientRects().length > 0) return true;
    }
    return false;
}
