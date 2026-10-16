// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How many characters a player's initials have. */
export const INITIALS_LENGTH = 3;

/**
 * The characters initials may use, in the order a cabinet's up and down step
 * through them: the letters, the digits, a full stop, and a space.
 */
export const INITIALS_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789. ';

/**
 * Three-letter words initials may not spell, in capitals. Digits that look
 * like letters count as those letters (`A55` is `ASS`), so the list needs
 * only letters.
 */
export const BLOCKED_INITIALS: ReadonlySet<string> = new Set([
    'ASS', 'CNT', 'COK', 'CUM', 'DIK', 'DIX', 'FAG', 'FCK', 'FUC', 'FUK', 'FUQ', 'JIZ', 'KKK',
    'NAZ', 'NGR', 'NIG', 'PIS', 'SEX', 'SHT', 'SLT', 'TIT', 'TWT', 'VAG', 'WTF', 'XXX',
]);

/** Why initials are refused: the wrong length, a character not in the set, all spaces, or a blocked word. */
export type InitialsProblem = 'length' | 'character' | 'blank' | 'blocked';

/** What is wrong with `initials`, if anything. They are checked as they are: lowercase is a character not in the set. */
export function findInitialsProblem(initials: string): InitialsProblem | undefined {
    if (initials.length !== INITIALS_LENGTH) return 'length';
    let isBlank = true;
    let letters = '';
    for (let i = 0; i < initials.length; i++) {
        const char = initials[i];
        if (!INITIALS_CHARACTERS.includes(char)) return 'character';
        if (char !== ' ') isBlank = false;
        letters += LOOKALIKES[char] ?? char;
    }
    if (isBlank) return 'blank';
    if (BLOCKED_INITIALS.has(letters)) return 'blocked';
    return undefined;
}

/** Whether `initials` may go in a table: exactly three characters from the set, not all spaces, and not a blocked word. */
export function isValidInitials(initials: string): boolean {
    return findInitialsProblem(initials) === undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The letter each digit stands in for, when checking for a blocked word. */
const LOOKALIKES: Readonly<Record<string, string>> = {
    '0': 'O', '1': 'I', '3': 'E', '4': 'A', '5': 'S', '7': 'T', '8': 'B',
};
