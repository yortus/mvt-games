import { INITIALS_CHARACTERS, INITIALS_LENGTH, isValidInitials } from '../../highscores';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The initials prompt, as a cabinet had it: three letter cells and an OK,
 * one of them under the cursor, which blinks. Down and up step the cursor's
 * letter forward and back through the characters initials may use; left and right move the
 * cursor; fire (Enter or Space) moves on, and on OK, sends. Typing a
 * character puts it in the cursor's cell and moves on. Escape, pressed
 * twice, skips. Presentation state: the letters become the visitor's
 * initials only when they are sent.
 */
export interface InitialsViewModel {
    /** The letter in cell `index`, 0 to 2. */
    readonly letterAt: (index: number) => string;
    /** The three letters, as they would be sent. */
    readonly initials: string;
    /** The cell under the cursor: 0 to 2 for a letter, `OK_CELL` for OK. */
    readonly cursor: number;
    /** Whether the cursor shows this moment: it blinks, and shows at once after any key. */
    readonly isCursorShown: boolean;
    /** Whether Escape has been pressed once: a second press skips. */
    readonly isConfirmingSkip: boolean;
    /** Whether OK was pressed on initials that cannot be sent (all spaces, or a blocked word). */
    readonly isRejected: boolean;

    /** Starts again: on remembered initials with the cursor on OK, so one press sends them, or on `A`s. */
    readonly open: (remembered: string | undefined) => void;
    /** Steps the cursor's letter forward (1) or back (-1) through the characters, round. */
    readonly step: (by: 1 | -1) => void;
    /** Moves the cursor to `cell`. */
    readonly moveTo: (cell: number) => void;
    /** Fire: on a letter, moves on; on OK, says to send, if the initials can be. */
    readonly fire: () => InitialsOutcome | undefined;
    /** Escape: the first asks, the second says to skip. */
    readonly escape: () => InitialsOutcome | undefined;
    /** A key pressed, as `KeyboardEvent.key`: what it did. */
    readonly pressKey: (key: string) => KeyResult;

    /** Advances the cursor's blink. */
    readonly update: (deltaMs: number) => void;
}

/** What the visitor has finished doing: sending their initials, or skipping. */
export type InitialsOutcome = 'send' | 'skip';

/** What a key did: finished the prompt, did something else, or nothing (it was not one of the prompt's). */
export type KeyResult = InitialsOutcome | 'handled' | 'ignored';

/** The cursor's cell when it is on OK, after the letters. */
export const OK_CELL = INITIALS_LENGTH;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the initials prompt's view model, with the first character in every cell. */
export function createInitialsViewModel(): InitialsViewModel {
    const letters: string[] = [];
    let cursor = 0;
    let blinkMs = 0;
    let isConfirmingSkip = false;
    let isRejected = false;
    reset(undefined);

    const viewModel: InitialsViewModel = {
        letterAt: (index) => letters[index],
        get initials() {
            return letters.join('');
        },
        get cursor() {
            return cursor;
        },
        get isCursorShown() {
            return blinkMs % (2 * BLINK_MS) < BLINK_MS;
        },
        get isConfirmingSkip() {
            return isConfirmingSkip;
        },
        get isRejected() {
            return isRejected;
        },

        open: reset,
        step(by) {
            acted();
            if (cursor === OK_CELL) return;
            const count = INITIALS_CHARACTERS.length;
            const index = INITIALS_CHARACTERS.indexOf(letters[cursor]);
            letters[cursor] = INITIALS_CHARACTERS[(index + by + count) % count];
        },
        moveTo(cell) {
            acted();
            cursor = Math.max(0, Math.min(OK_CELL, cell));
        },
        fire() {
            acted();
            if (cursor < OK_CELL) {
                cursor++;
                return undefined;
            }
            if (isValidInitials(viewModel.initials)) return 'send';
            isRejected = true;
            return undefined;
        },
        escape() {
            if (isConfirmingSkip) return 'skip';
            acted();
            isConfirmingSkip = true;
            return undefined;
        },
        pressKey(key) {
            switch (key) {
                case 'ArrowUp':
                case 'ArrowDown':
                    // Down runs on through the alphabet, A to B to C, as a list read downward does
                    viewModel.step(key === 'ArrowDown' ? 1 : -1);
                    return 'handled';
                case 'ArrowLeft':
                case 'ArrowRight':
                case 'Backspace':
                    viewModel.moveTo(key === 'ArrowRight' ? cursor + 1 : cursor - 1);
                    return 'handled';
                case 'Enter':
                case ' ':
                    return viewModel.fire() ?? 'handled';
                case 'Escape':
                    return viewModel.escape() ?? 'handled';
            }
            // Space is fire, above: a space in initials is stepped to, with up and down
            const char = key.length === 1 ? key.toUpperCase() : '';
            if (char === '' || !INITIALS_CHARACTERS.includes(char) || cursor === OK_CELL) return 'ignored';
            acted();
            letters[cursor] = char;
            cursor++;
            return 'handled';
        },

        update(deltaMs) {
            blinkMs += deltaMs;
        },
    };
    return viewModel;

    function reset(remembered: string | undefined): void {
        const start = remembered ?? FIRST_LETTER.repeat(INITIALS_LENGTH);
        letters.length = 0;
        for (let i = 0; i < INITIALS_LENGTH; i++) letters.push(start[i] ?? FIRST_LETTER);
        cursor = remembered === undefined ? 0 : OK_CELL;
        blinkMs = 0;
        isConfirmingSkip = false;
        isRejected = false;
    }

    /** Any key but a second Escape: the cursor shows at once, and a pending skip or rejection is forgotten. */
    function acted(): void {
        blinkMs = 0;
        isConfirmingSkip = false;
        isRejected = false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the cursor shows, then hides, as it blinks. */
const BLINK_MS = 400;

const FIRST_LETTER = INITIALS_CHARACTERS[0];
