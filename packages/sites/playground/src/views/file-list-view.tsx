/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FileListViewBindings {
    /** The project's file paths, in the order to list them. */
    readonly paths: () => readonly string[];
    readonly activePath: () => string;
    /** A file that cannot be removed, which has no remove button. */
    readonly fixedPath: string;
    /** Whether the list is folded away, leaving only its unfold button. */
    readonly isFolded: () => boolean;
    readonly onFoldToggled?: () => void;
    readonly onFileChosen?: (path: string) => void;
    readonly onAddPressed?: () => void;
    readonly onRemovePressed?: (path: string) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The project's files, the open one marked, with buttons to add and remove
 * files, and to fold the list away.
 */
export function FileListView(bindings: FileListViewBindings): Element {
    return (
        <nav class={() => (bindings.isFolded() ? 'files files-folded' : 'files')} aria-label="Files">
            <div class="files-head">
                <button
                    type="button"
                    class="files-fold"
                    title={() => (bindings.isFolded() ? 'Show the files' : 'Hide the files')}
                    text={() => (bindings.isFolded() ? '›' : '‹')}
                    onClick={() => bindings.onFoldToggled?.()}
                />
                <span class="files-title" text="Files" />
                <button type="button" class="files-add" title="Add a file" text="+" onClick={() => bindings.onAddPressed?.()} />
            </div>
            <ul class="files-list">
                <List items={bindings.paths}>
                    {(path) => (
                        <li class={() => (path() === bindings.activePath() ? 'file file-active' : 'file')}>
                            <button type="button" class="file-name" text={path} onClick={() => bindings.onFileChosen?.(path())} />
                            <button
                                type="button"
                                class="file-remove"
                                title="Remove this file"
                                text="×"
                                visible={() => path() !== bindings.fixedPath}
                                onClick={() => bindings.onRemovePressed?.(path())}
                            />
                        </li>
                    )}
                </List>
            </ul>
        </nav>
    );
}
