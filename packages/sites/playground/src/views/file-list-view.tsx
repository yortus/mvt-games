/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { memoiseLast } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FileListViewBindings {
    /** The project's file paths. */
    readonly paths: () => readonly string[];
    readonly activePath: () => string;
    /** A file that cannot be removed or moved, which is listed first. */
    readonly fixedPath: string;
    /** Whether the list is folded away, leaving only its unfold button. */
    readonly isFolded: () => boolean;
    /** The folders folded, by path. A new set means they have changed. */
    readonly foldedFolders: () => ReadonlySet<string>;
    /** How many errors a file has, or a folder, given as its path and a `/`. A folded folder, or a file, with any shows the count. */
    readonly problemCountOf: (path: string) => number;
    /** Whether a file is a barrel the playground keeps, which cannot be removed or moved. */
    readonly isKeptBarrel: (path: string) => boolean;
    readonly onFoldToggled?: () => void;
    readonly onFolderToggled?: (path: string) => void;
    readonly onFileChosen?: (path: string) => void;
    /** Reported with the folder to add a file in, or '' for the project's root. */
    readonly onAddPressed?: (folder: string) => void;
    /** Reported with the file or folder to move. */
    readonly onMovePressed?: (path: string) => void;
    readonly onRemovePressed?: (path: string) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The project's files, as a tree of folders that fold, the open file
 * marked, and a folded folder's errors counted. A folder's row adds a file
 * in it, and each row moves its file or folder; a file's removes it. The
 * fixed file comes first, and keeps still.
 */
export function FileListView(bindings: FileListViewBindings): Element {
    let rows: readonly TreeRow[] = [];
    let rowsPaths: readonly string[] | undefined;
    let rowsFolded: ReadonlySet<string> | undefined;

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
                <button type="button" class="files-add" title="Add a file" text="+" onClick={() => bindings.onAddPressed?.('')} />
            </div>
            <ul class="files-list">
                <List items={treeRows}>
                    {(row) => {
                        const countLabel = memoiseLast((count: number) => String(count));
                        // A folder's errors are counted under its path and a slash
                        const folderKey = memoiseLast((path: string) => `${path}/`);
                        const isFolder = (): boolean => row().kind === 'folder';
                        const isFolded = (): boolean => isFolder() && bindings.foldedFolders().has(row().path);
                        const isFixed = (): boolean => row().path === bindings.fixedPath || bindings.isKeptBarrel(row().path);
                        const problemCount = (): number => {
                            if (!isFolder()) return bindings.problemCountOf(row().path);
                            return isFolded() ? bindings.problemCountOf(folderKey(row().path)) : 0;
                        };
                        return (
                            <li class={() => rowClassOf(row(), !isFolder() && row().path === bindings.activePath(), bindings.isKeptBarrel(row().path))}>
                                <button type="button" class="file-name" onClick={() => choose(row())}>
                                    <span class="file-caret" text={() => (isFolder() ? (isFolded() ? '▸' : '▾') : '')} />
                                    <span class="file-label" text={() => row().name} />
                                </button>
                                <span
                                    class="file-problems"
                                    title={() => (isFolder() ? 'Errors in this folder' : 'Errors in this file')}
                                    visible={() => problemCount() > 0}
                                    text={() => countLabel(problemCount())}
                                />
                                <button
                                    type="button"
                                    class="file-action"
                                    title="Add a file in this folder"
                                    text="+"
                                    visible={isFolder}
                                    onClick={() => bindings.onAddPressed?.(row().path)}
                                />
                                <button
                                    type="button"
                                    class="file-action"
                                    title={() => (isFolder() ? 'Move this folder' : 'Move or rename this file')}
                                    text="✎"
                                    visible={() => !isFixed()}
                                    onClick={() => bindings.onMovePressed?.(row().path)}
                                />
                                <button
                                    type="button"
                                    class="file-action"
                                    title="Remove this file"
                                    text="×"
                                    visible={() => !isFolder() && !isFixed()}
                                    onClick={() => bindings.onRemovePressed?.(row().path)}
                                />
                            </li>
                        );
                    }}
                </List>
            </ul>
        </nav>
    );

    /** The rows, made again only when the paths or the folded folders change. */
    function treeRows(): readonly TreeRow[] {
        const paths = bindings.paths();
        const folded = bindings.foldedFolders();
        if (paths !== rowsPaths || folded !== rowsFolded) {
            rows = toTreeRows(paths, bindings.fixedPath, folded);
            rowsPaths = paths;
            rowsFolded = folded;
        }
        return rows;
    }

    function choose(row: TreeRow): void {
        if (row.kind === 'folder') bindings.onFolderToggled?.(row.path);
        else bindings.onFileChosen?.(row.path);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A row of the tree: a folder, or a file, at a depth, 0 for the project's root. */
interface TreeRow {
    readonly kind: 'folder' | 'file';
    readonly path: string;
    /** The last name in its path. */
    readonly name: string;
    readonly depth: number;
}

/** The deepest a row is indented. Deeper rows are indented no more. */
const MAX_DEPTH = 6;

/**
 * Every row's class, by its kind, its depth, whether it is the open file,
 * and whether it is a kept barrel, at the index `rowClassOf` works out. Made
 * once, so a refresh makes no strings.
 */
const ROW_CLASSES: readonly string[] = makeRowClasses();

function makeRowClasses(): string[] {
    const classes: string[] = [];
    for (const kind of ['folder', 'file'] as const) {
        for (let depth = 0; depth <= MAX_DEPTH; depth++) {
            for (const isActive of [false, true]) {
                for (const isKept of [false, true]) {
                    classes.push([
                        'file',
                        `file-depth-${depth}`,
                        ...(kind === 'folder' ? ['file-folder'] : []),
                        ...(isActive ? ['file-active'] : []),
                        ...(isKept ? ['file-kept'] : []),
                    ].join(' '));
                }
            }
        }
    }
    return classes;
}

/** A row's class, from the table, in the order `makeRowClasses` made it. */
function rowClassOf(row: TreeRow, isActive: boolean, isKept: boolean): string {
    const kindIndex = row.kind === 'folder' ? 0 : 1;
    const depth = Math.min(row.depth, MAX_DEPTH);
    return ROW_CLASSES[((kindIndex * (MAX_DEPTH + 1) + depth) * 2 + (isActive ? 1 : 0)) * 2 + (isKept ? 1 : 0)];
}

/** The rows of a tree of paths: the fixed file first, then each folder, then the other files, at every level, in order, a folded folder's contents left out. */
function toTreeRows(paths: readonly string[], fixedPath: string, folded: ReadonlySet<string>): TreeRow[] {
    const children = new Map<string, { folders: Set<string>; files: string[] }>();
    const childrenOf = (folder: string): { folders: Set<string>; files: string[] } => {
        let found = children.get(folder);
        if (found === undefined) {
            found = { folders: new Set(), files: [] };
            children.set(folder, found);
        }
        return found;
    };
    for (const path of paths) {
        childrenOf(folderOf(path)).files.push(path);
        for (let folder = folderOf(path); folder !== ''; folder = folderOf(folder)) childrenOf(folderOf(folder)).folders.add(folder);
    }
    const rows: TreeRow[] = [];
    const addRows = (folder: string, depth: number): void => {
        const { folders, files } = childrenOf(folder);
        const sortedFiles = files.filter((p) => p !== fixedPath).sort();
        if (folder === '' && files.includes(fixedPath)) rows.push({ kind: 'file', path: fixedPath, name: nameOf(fixedPath), depth });
        for (const sub of [...folders].sort()) {
            rows.push({ kind: 'folder', path: sub, name: nameOf(sub), depth });
            if (!folded.has(sub)) addRows(sub, depth + 1);
        }
        for (const path of sortedFiles) rows.push({ kind: 'file', path, name: nameOf(path), depth });
    };
    addRows('', 0);
    return rows;
}

function folderOf(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
}

function nameOf(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}
