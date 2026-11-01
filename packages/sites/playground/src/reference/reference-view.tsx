/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { createReaction } from '@mvtjs/utils';
import type { ReferenceEntry, ReferenceSheet } from '../../cheat-sheets';
import { type ReferenceModel, type ReferenceRow, USED_ID } from './reference-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ReferenceViewBindings {
    readonly model: ReferenceModel;
    /** Whether the cheat sheet shows. Its search field takes the focus each time it opens. */
    readonly isOpen: () => boolean;
    /** The address of a page of the book, by its path in the docs, such as `chapters/09-noticing-changes`. */
    readonly chapterUrlOf: (path: string) => string;
    /** Reported with an entry's import line, as its Copy import is pressed. */
    readonly onCopyImportPressed?: (line: string) => void;
    /** Reported as an entry's Go to definition is pressed. Without it, entries have no such button. */
    readonly onDefinitionPressed?: (entry: ReferenceEntry) => void;
    readonly onClosed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The cheat sheets: a search field, a chip for each sheet, and the rows of
 * the sheet chosen, or of the search. An entry shows its name, signature and
 * what it's for. Pressing it opens it, to show its summary, its snippet, its
 * import line and its links. Escape closes the cheat sheet.
 *
 * The rows are plain elements, made again only when the model's rows
 * change: an entry mixes text and code, which the JSX can't write.
 */
export function ReferenceView(bindings: ReferenceViewBindings): Element {
    const { model } = bindings;
    /** Whether the cheat sheet has opened since its field last took the focus. */
    let isFocusDue = false;
    /** The entry whose import line was copied last, for a moment's note, and how long the note has left. */
    let copiedEntry: ReferenceEntry | undefined;
    let copiedNoteMs = 0;
    /** The elements of each entry's row that change after it's made. */
    let entryParts = new Map<ReferenceEntry, EntryParts>();
    /** What the elements show now: the rows, the entry open, and the entry whose Copy import says "Copied". */
    let shownRows: readonly ReferenceRow[] | undefined;
    let shownOpenEntry: ReferenceEntry | undefined;
    let shownCopiedEntry: ReferenceEntry | undefined;

    const queueFocusWhenOpened = createReaction({
        watch: bindings.isOpen,
        when: true,
        react: () => {
            isFocusDue = true;
        },
    });
    const rowsElement = document.createElement('div');
    rowsElement.className = 'reference-rows';

    return (
        // The wrapper is never hidden, so it sees the cheat sheet close and open again
        <div class="reference-layer" onRefresh={queueFocusWhenOpened} onUpdate={update}>
            <div class="reference" visible={bindings.isOpen} onKeyDown={onKeyDown} onRefresh={refreshRows}>
                <div class="reference-head">
                    <h2 class="reference-title" text="Cheat sheet" />
                    <input
                        type="search"
                        class="reference-search"
                        placeholder="Search the APIs"
                        aria-label="Search the cheat sheets"
                        autocomplete="off"
                        spellcheck={false}
                        value={() => model.query}
                        onInput={(event) => {
                            model.query = (event.target as HTMLInputElement).value;
                        }}
                        onRefresh={focusIfDue}
                    />
                    <button type="button" class="reference-close" title="Close the cheat sheet (Esc)" aria-label="Close the cheat sheet" text="×" onClick={() => bindings.onClosed?.()} />
                </div>
                <div class="reference-chips">
                    <button
                        type="button"
                        class={() => chipClass(USED_ID)}
                        title="The APIs this example imports"
                        text="Used here"
                        visible={() => model.hasUsed}
                        onClick={() => chooseSheet(USED_ID)}
                    />
                    <List items={() => model.shownSheets}>
                        {(sheet) => <button type="button" class={() => chipClass(sheet().id)} text={() => sheet().title} onClick={() => chooseSheet(sheet().id)} />}
                    </List>
                    <label class="reference-every" title="Show the sheets for every renderer, not only this project's">
                        <input
                            type="checkbox"
                            checked={() => model.isShowingAll}
                            onChange={(event) => {
                                model.isShowingAll = (event.target as HTMLInputElement).checked;
                            }}
                        />
                        <span text="Every renderer" />
                    </label>
                </div>
                <div class="reference-loading" text="Loading the cheat sheets..." visible={() => model.sheets === undefined} />
                <div class="reference-body" ref={(body) => body.append(rowsElement)} />
            </div>
        </div>
    );

    function update(deltaMs: number): void {
        copiedNoteMs = Math.max(0, copiedNoteMs - deltaMs);
    }

    /**
     * Makes the rows again if the model's have changed since they were made,
     * and shows the entry open, and the note on the import copied, if either
     * has changed. It compares with what the elements show, rather than
     * reacting, since it runs only while the cheat sheet shows, and the
     * model's rows may change while it's hidden.
     */
    function refreshRows(): void {
        if (model.rows !== shownRows) showRows(model.rows);
        if (model.openEntry !== shownOpenEntry) showOpenEntry(model.openEntry);
        const copied = copiedNoteMs > 0 ? copiedEntry : undefined;
        if (copied !== shownCopiedEntry) {
            if (shownCopiedEntry !== undefined) writeCopyLabel(shownCopiedEntry, COPY_LABEL);
            if (copied !== undefined) writeCopyLabel(copied, COPIED_LABEL);
            shownCopiedEntry = copied;
        }
    }

    /** The class of a sheet's chip, which is lit while its sheet shows. A search shows no sheet. */
    function chipClass(id: string): string {
        return model.query === '' && model.chosenId === id ? 'reference-chip reference-chip-chosen' : 'reference-chip';
    }

    function chooseSheet(id: string): void {
        model.query = '';
        model.chosenId = id;
    }

    /** Focuses the search field once the cheat sheet shows. It runs after the wrapper's step, since a hidden field can't take the focus. */
    function focusIfDue(input: Element): void {
        if (!isFocusDue) return;
        isFocusDue = false;
        (input as HTMLInputElement).focus();
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        if (model.query !== '' && event.target instanceof HTMLInputElement && event.target.type === 'search') {
            model.query = '';
        }
        else {
            bindings.onClosed?.();
        }
    }

    /** Makes the rows' elements, in place of those before, scrolled to the top. */
    function showRows(rows: readonly ReferenceRow[]): void {
        entryParts = new Map();
        shownCopiedEntry = undefined;
        rowsElement.replaceChildren(...rows.map((row) => makeRow(row)));
        rowsElement.scrollTop = 0;
        shownRows = rows;
        showOpenEntry(model.openEntry);
    }

    function makeRow(row: ReferenceRow): HTMLElement {
        switch (row.kind) {
            case 'sheet':
                return makeSheetIntro(row.sheet);
            case 'group':
                return element('h3', 'reference-group', row.title);
            case 'note':
                return withCode(element('p', 'reference-note'), row.text);
            case 'entry':
                return makeEntry(row.entry);
        }
    }

    function makeSheetIntro(sheet: ReferenceSheet): HTMLElement {
        const intro = element('div', 'reference-sheet');
        intro.append(withCode(element('p', 'reference-sheet-summary'), sheet.summary));
        if (sheet.moreAt.length > 0) {
            const links = element('p', 'reference-links', 'More: ');
            for (let i = 0; i < sheet.moreAt.length; i++) {
                if (i > 0) links.append(', ');
                links.append(link(sheet.moreAt[i].label, sheet.moreAt[i].url));
            }
            intro.append(links);
        }
        return intro;
    }

    function makeEntry(entry: ReferenceEntry): HTMLElement {
        const row = element('div', 'reference-entry');
        const head = element('button', 'reference-entry-head') as HTMLButtonElement;
        head.type = 'button';
        head.append(element('code', 'reference-entry-name', entry.name));
        head.append(withCode(element('span', 'reference-entry-use'), entry.useFor));
        head.addEventListener('click', () => model.toggleEntry(entry));
        row.append(head);
        if (entry.signature !== '') row.append(element('pre', 'reference-signature', entry.signature));

        const more = element('div', 'reference-entry-more');
        more.hidden = true;
        if (entry.summary !== '') more.append(withCode(element('p', 'reference-summary'), entry.summary));
        if (entry.snippet !== undefined) more.append(element('pre', 'reference-snippet', entry.snippet));
        const actions = element('div', 'reference-actions');
        const importLine = model.importLineOf(entry);
        let copyButton: HTMLButtonElement | undefined;
        if (importLine !== undefined) {
            actions.append(element('code', 'reference-import', importLine));
            copyButton = element('button', 'reference-action', COPY_LABEL) as HTMLButtonElement;
            copyButton.type = 'button';
            copyButton.addEventListener('click', () => {
                copiedEntry = entry;
                copiedNoteMs = COPIED_NOTE_MS;
                bindings.onCopyImportPressed?.(importLine);
            });
            actions.append(copyButton);
        }
        if (entry.from !== undefined && bindings.onDefinitionPressed !== undefined) {
            const definitionButton = element('button', 'reference-action', 'Go to definition') as HTMLButtonElement;
            definitionButton.type = 'button';
            definitionButton.addEventListener('click', () => bindings.onDefinitionPressed?.(entry));
            actions.append(definitionButton);
        }
        if (entry.chapter !== undefined) actions.append(link(entry.chapter.title, bindings.chapterUrlOf(entry.chapter.path)));
        if (actions.childElementCount > 0) more.append(actions);
        row.append(more);
        entryParts.set(entry, { head, more, copyButton });
        return row;
    }

    /** Shows the open entry's details, and hides those of the one open before. */
    function showOpenEntry(open: ReferenceEntry | undefined): void {
        shownOpenEntry = open;
        for (const [entry, parts] of entryParts) {
            const isOpen = entry === open;
            parts.more.hidden = !isOpen;
            parts.head.setAttribute('aria-expanded', String(isOpen));
            parts.head.parentElement?.classList.toggle('reference-entry-open', isOpen);
        }
    }

    function writeCopyLabel(entry: ReferenceEntry, label: string): void {
        const button = entryParts.get(entry)?.copyButton;
        if (button !== undefined) button.textContent = label;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The parts of an entry's row that change after it's made. */
interface EntryParts {
    readonly head: HTMLButtonElement;
    readonly more: HTMLElement;
    readonly copyButton: HTMLButtonElement | undefined;
}

const COPY_LABEL = 'Copy import';
const COPIED_LABEL = 'Copied';

/** How long "Copied" shows on a Copy import button. */
const COPIED_NOTE_MS = 1500;

function element(tag: string, className: string, text?: string): HTMLElement {
    const made = document.createElement(tag);
    made.className = className;
    if (text !== undefined) made.textContent = text;
    return made;
}

/** A link that opens in a new tab, so the playground or the book stays where it is. */
function link(text: string, url: string): HTMLAnchorElement {
    const made = element('a', 'reference-link', text) as HTMLAnchorElement;
    made.href = url;
    made.target = '_blank';
    made.rel = 'noopener';
    return made;
}

/** Fills an element with text, each part in backticks made code. */
function withCode(target: HTMLElement, text: string): HTMLElement {
    const parts = text.split('`');
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            target.append(parts[i]);
        }
        else {
            const code = document.createElement('code');
            code.textContent = parts[i];
            target.append(code);
        }
    }
    return target;
}
