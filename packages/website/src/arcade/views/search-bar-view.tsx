/** @jsxImportSource @mvtjs/html */
import { memoiseLast } from '@mvtjs/utils';
import { searchWordsOf, TAG_GROUPS, type TagChip } from '../models';
import { GROUP_LABELS, tagLabel } from './labels';
import { labelMatches, stepSuggestion } from './search-suggestions';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SearchBarViewBindings {
    /** The tags that can be searched for, which do not change. */
    readonly chips: readonly TagChip[];
    /** How many tags are chosen, and which, in the order they were chosen. */
    readonly activeCount: () => number;
    readonly activeChipAt: (position: number) => number;
    /** How many entries the wall would show were this chip chosen. */
    readonly chipCountAt: (index: number) => number;
    /** Whether choosing this chip would narrow the search: only these are suggested. */
    readonly isChipOfferedAt: (index: number) => boolean;
    /** What has been typed beside the tags. */
    readonly text: () => string;
    /** Reported with the box's text as the visitor types. */
    readonly onTextChanged?: (text: string) => void;
    /** Reported with a chip's index as the visitor chooses its tag from the list. */
    readonly onChipChosen?: (index: number) => void;
    /** Reported with a chip's index as the visitor removes its token. */
    readonly onChipRemoved?: (index: number) => void;
    readonly onClearPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One search box for names and tags. The tags chosen sit in the box in the
 * order they were chosen, the last nearest the caret, each with a button to
 * remove it. While the box has focus, the tags that would
 * narrow the search drop down beneath it, group by group with their counts,
 * and narrowed to those beginning with what is typed; a click, or Enter,
 * chooses one. The arrow keys move between them, Backspace in an empty box
 * removes the last tag, and Escape closes the list.
 */
export function SearchBarView(bindings: SearchBarViewBindings): Element {
    const { chips } = bindings;
    const labels = chips.map((chip) => tagLabel(chip));
    const labelWords = labels.map((label) => searchWordsOf(label));
    const removeLabels = labels.map((label) => `Remove ${label}`);
    const optionIds = chips.map((_chip, index) => `search-tag-${index}`);
    const countTexts = chips.map(() => memoiseLast((count: number) => String(count)));
    const typedWords = memoiseLast((text: string) => searchWordsOf(text));
    const groups = TAG_GROUPS.filter((group) => chips.some((chip) => chip.group === group));

    // Presentation state: whether the box has focus, whether the list was
    // closed with Escape since, and the suggestion the arrow keys moved to
    let isFocused = false;
    let isDismissed = false;
    let highlighted = -1;
    // Worked out once a frame, before the children read them
    const isSuggestedAt: boolean[] = chips.map(() => false);
    const hasSuggestionIn: boolean[] = groups.map(() => false);
    let isListOpen = false;
    let shownHighlight = -1;

    let input: HTMLInputElement | undefined;

    return (
        <div class="search" onRefresh={settle}>
            <div class={() => (isFocused ? 'search-box has-focus' : 'search-box')} ref={keepFocusOnPress} onClick={focusFromBox}>
                {/* One slot for each tag that could be chosen, filled in the order they were */}
                {chips.map((_chip, position) => (
                    <span class="search-token" visible={() => position < bindings.activeCount()}>
                        <span text={() => labels[tokenAt(position)]} />
                        <button
                            type="button"
                            class="search-token-remove"
                            aria-label={() => removeLabels[tokenAt(position)]}
                            title={() => removeLabels[tokenAt(position)]}
                            text="×"
                            onClick={() => remove(tokenAt(position))}
                        />
                    </span>
                ))}
                <input
                    type="text"
                    class="search-input"
                    role="combobox"
                    aria-label="Search by name, tag or description"
                    aria-autocomplete="list"
                    aria-controls="search-tags"
                    aria-expanded={() => isListOpen}
                    aria-activedescendant={() => (shownHighlight < 0 ? '' : optionIds[shownHighlight])}
                    autocomplete="off"
                    spellcheck={false}
                    placeholder={() => (bindings.activeCount() > 0 ? '' : 'Search by name, tag or description')}
                    value={bindings.text}
                    ref={(e) => { input = e; }}
                    onInput={onInput}
                    onKeyDown={onKeyDown}
                    onFocus={onFocus}
                    onBlur={onBlur}
                />
                <button
                    type="button"
                    class="search-clear"
                    aria-label="Clear the search"
                    title="Clear"
                    text="×"
                    visible={() => bindings.activeCount() > 0 || bindings.text() !== ''}
                    onClick={clear}
                />
            </div>
            <div
                class="search-tags"
                id="search-tags"
                role="listbox"
                aria-label="Tags"
                visible={() => isListOpen}
                ref={keepFocusOnPress}
            >
                {groups.map((group, g) => (
                    <div class="search-group" role="group" aria-label={GROUP_LABELS[group]} visible={() => hasSuggestionIn[g]}>
                        <span class="search-group-label" text={GROUP_LABELS[group]} />
                        <div class="search-group-tags">
                            {chips.map((chip, index) => (chip.group !== group
                                ? undefined
                                : (
                                        <div
                                            class={() => (index === shownHighlight ? 'chip is-highlighted' : 'chip')}
                                            id={optionIds[index]}
                                            role="option"
                                            aria-selected={() => index === shownHighlight}
                                            visible={() => isSuggestedAt[index]}
                                            onClick={() => choose(index)}
                                        >
                                            <span class="chip-label" text={labels[index]} />
                                            <span class="chip-count" text={() => countTexts[index](bindings.chipCountAt(index))} />
                                        </div>
                                    )))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    /**
     * Works out, once a frame and before the children read it, which tags
     * are suggested, and so which groups show, whether the list is open, and
     * which suggestion is highlighted.
     */
    function settle(): void {
        const words = typedWords(bindings.text());
        let isAnySuggested = false;
        hasSuggestionIn.fill(false);
        for (let i = 0; i < chips.length; i++) {
            // A tag is suggested if it would narrow the search, and answers what is typed
            isSuggestedAt[i] = bindings.isChipOfferedAt(i) && labelMatches(labelWords[i], words);
            if (!isSuggestedAt[i]) continue;
            isAnySuggested = true;
            hasSuggestionIn[groups.indexOf(chips[i].group)] = true;
        }
        shownHighlight = highlightedSuggestion();
        isListOpen = isFocused && !isDismissed && isAnySuggested;
    }

    function isSuggested(index: number): boolean {
        return isSuggestedAt[index];
    }

    /** The suggestion the arrow keys moved to, or, once something is typed, the first: what Enter chooses. */
    function highlightedSuggestion(): number {
        if (highlighted >= 0 && isSuggested(highlighted)) return highlighted;
        if (typedWords(bindings.text()).length === 0) return -1;
        return stepSuggestion({ from: -1, step: 1, count: chips.length, isSuggested });
    }

    function onFocus(): void {
        isFocused = true;
        isDismissed = false;
    }

    function onBlur(): void {
        isFocused = false;
        highlighted = -1;
    }

    function onInput(e: Event): void {
        isDismissed = false;
        highlighted = -1;
        bindings.onTextChanged?.((e.target as HTMLInputElement).value);
    }

    function onKeyDown(e: KeyboardEvent): void {
        // The text may have changed since the frame's settling, as it is typed
        settle();
        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowUp': {
                const step = e.key === 'ArrowDown' ? 1 : -1;
                const from = isDismissed ? -1 : highlightedSuggestion();
                isDismissed = false;
                highlighted = stepSuggestion({ from, step, count: chips.length, isSuggested });
                break;
            }
            case 'Enter': {
                const index = isDismissed ? -1 : highlightedSuggestion();
                if (index < 0) return;
                choose(index);
                break;
            }
            case 'Escape':
                // Closes the list, then, pressed again, leaves the box
                if (isListOpen) isDismissed = true;
                else input?.blur();
                break;
            case 'Backspace': {
                const box = e.target as HTMLInputElement;
                if (box.value !== '' || box.selectionStart !== 0 || box.selectionEnd !== 0) return;
                const last = lastActiveChip();
                if (last < 0) return;
                bindings.onChipRemoved?.(last);
                break;
            }
            default:
                return;
        }
        e.preventDefault();
        e.stopPropagation();
    }

    function choose(index: number): void {
        highlighted = -1;
        // The runtime leaves a focused box's text to the user, so the text the
        // tag was found by is cleared here, as the model clears its own
        if (input !== undefined) input.value = '';
        bindings.onChipChosen?.(index);
    }

    /**
     * Removes a token, and leaves the caret in the box: the token's button,
     * which a keyboard may have focused, goes with it.
     */
    function remove(index: number): void {
        bindings.onChipRemoved?.(index);
        input?.focus();
    }

    function clear(): void {
        if (input !== undefined) input.value = '';
        bindings.onClearPressed?.();
        input?.focus();
    }

    /** The chip in token slot `position`: the first chip for an empty slot, which is hidden. */
    function tokenAt(position: number): number {
        return position < bindings.activeCount() ? bindings.activeChipAt(position) : 0;
    }

    function lastActiveChip(): number {
        const count = bindings.activeCount();
        return count === 0 ? -1 : bindings.activeChipAt(count - 1);
    }

    /** A press on the box, between its tags, puts the caret in it. */
    function focusFromBox(e: MouseEvent): void {
        if (e.target instanceof HTMLButtonElement) return;
        input?.focus();
    }

    /**
     * Pressing a suggestion, or a button in the box, would take the focus
     * from the box: closing the list before the click lands, or leaving the
     * focus on a button that then goes, so that typing would go nowhere.
     */
    function keepFocusOnPress(element: HTMLElement): void {
        element.addEventListener('mousedown', (e) => {
            if (e.target !== input) e.preventDefault();
        });
    }
}
