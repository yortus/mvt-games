// Which tags the search bar suggests as the visitor types, and how the arrow
// keys move between them: the search bar's presentation logic, kept apart so
// it can be tested without a page. Words are split as the search splits them
// (`searchWordsOf`).

/**
 * Whether a tag whose label has `labelWords` answers what was typed, `words`:
 * each begins one of the label's words. Nothing typed matches every tag.
 */
export function labelMatches(labelWords: readonly string[], words: readonly string[]): boolean {
    for (let w = 0; w < words.length; w++) {
        let isMatch = false;
        for (let l = 0; l < labelWords.length && !isMatch; l++) isMatch = labelWords[l].startsWith(words[w]);
        if (!isMatch) return false;
    }
    return true;
}

/**
 * The suggestion `step` places on from `from` (1 is the next, -1 the one
 * before), among `count` tags of which `isSuggested` says which are shown,
 * wrapping round at the ends. From -1, nothing highlighted, it goes to the
 * first or the last. -1 when nothing is suggested.
 */
export function stepSuggestion(options: {
    from: number;
    step: 1 | -1;
    count: number;
    isSuggested: (index: number) => boolean;
}): number {
    const { from, step, count, isSuggested } = options;
    let index = from < 0 ? (step > 0 ? -1 : count) : from;
    for (let tried = 0; tried < count; tried++) {
        index = (index + step + count) % count;
        if (isSuggested(index)) return index;
    }
    return -1;
}
