import { type Action, forEachDiagnostic, previousDiagnostic } from '@codemirror/lint';
import { gotoLine } from '@codemirror/search';
import { type Extension, Facet, Prec } from '@codemirror/state';
import { closeHoverTooltips, EditorView, keymap, ViewPlugin } from '@codemirror/view';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A command the editor's menu offers, and its keys run. */
export interface EditorCommand {
    readonly label: string;
    /** Its keys, as CodeMirror writes them, such as `Mod-s` or `F12`. `Mod` is Ctrl, or Cmd on a Mac. */
    readonly key: string;
    readonly run: (view: EditorView) => boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Binds commands to their keys, and adds them to the editor's menu, in the order given. */
export function provideEditorCommands(commands: readonly EditorCommand[]): Extension {
    return [
        menuCommands.of(commands),
        keymap.of(commands.map((command) => ({ key: command.key, run: command.run, preventDefault: true }))),
    ];
}

/**
 * Returns the extensions that give the editor its menu and keys beyond
 * CodeMirror's own. A right-click, or the menu key, opens the menu: the
 * fixes for a problem at that place, the commands that other extensions
 * provide, go to line, and cut, copy and paste. Ctrl+. opens only the fixes
 * at the cursor. Ctrl+G goes to a line, and Shift+F8 to the problem before
 * the cursor, as F8 goes to the one after it.
 */
export function createEditorMenu(): Extension {
    const menu = ViewPlugin.define((view) => {
        let element: HTMLElement | undefined;
        // Where the editor was scrolled to as the menu opened. A scroll event can come late, for a scroll made before
        let openScrollTop = 0;
        let openScrollLeft = 0;

        const onPointerDown = (event: PointerEvent): void => {
            if (element !== undefined && !element.contains(event.target as Node)) close();
        };
        const onBlur = (): void => close();
        const onScroll = (): void => {
            if (view.scrollDOM.scrollTop !== openScrollTop || view.scrollDOM.scrollLeft !== openScrollLeft) close();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('blur', onBlur);
        view.scrollDOM.addEventListener('scroll', onScroll);

        return {
            open,
            destroy() {
                close();
                document.removeEventListener('pointerdown', onPointerDown, true);
                window.removeEventListener('blur', onBlur);
                view.scrollDOM.removeEventListener('scroll', onScroll);
            },
        };

        /** Opens the menu at a point on screen, with its items in groups, a line between each two. */
        function open(groups: readonly (readonly MenuItem[])[], x: number, y: number): void {
            close();
            // A type or problem shown on hover would sit over the menu
            view.dispatch({ effects: closeHoverTooltips });
            openScrollTop = view.scrollDOM.scrollTop;
            openScrollLeft = view.scrollDOM.scrollLeft;
            element = document.createElement('div');
            element.className = 'editor-menu';
            element.setAttribute('role', 'menu');
            for (const group of groups) {
                if (group.length === 0) continue;
                if (element.childElementCount > 0) {
                    const line = document.createElement('div');
                    line.className = 'editor-menu-separator';
                    line.setAttribute('role', 'separator');
                    element.append(line);
                }
                for (const item of group) element.append(menuItemElement(item, () => choose(item)));
            }
            element.addEventListener('keydown', onMenuKey);
            // In the page, not the editor, so the editor's own pointer and key handling never sees it
            document.body.append(element);

            // Kept on screen, against the right and bottom edges if need be
            const box = element.getBoundingClientRect();
            element.style.left = `${Math.max(0, Math.min(x, window.innerWidth - box.width))}px`;
            element.style.top = `${Math.max(0, Math.min(y, window.innerHeight - box.height))}px`;
            focusItem(0, 1);
        }

        function close(): void {
            element?.remove();
            element = undefined;
        }

        function choose(item: MenuItem): void {
            close();
            view.focus();
            item.run?.();
        }

        function onMenuKey(event: KeyboardEvent): void {
            const items = menuItemsOf(element);
            const at = items.indexOf(document.activeElement as HTMLElement);
            if (event.key === 'ArrowDown') focusItem(at + 1, 1);
            else if (event.key === 'ArrowUp') focusItem(at - 1, -1);
            else if (event.key === 'Home') focusItem(0, 1);
            else if (event.key === 'End') focusItem(items.length - 1, -1);
            else if (event.key === 'Escape' || event.key === 'Tab') {
                close();
                view.focus();
            }
            else return;
            event.preventDefault();
            event.stopPropagation();
        }

        /** Focuses the first item that can be chosen, from `from`, going `step` at a time and wrapping around. */
        function focusItem(from: number, step: 1 | -1): void {
            const items = menuItemsOf(element);
            for (let i = 0; i < items.length; i++) {
                const item = items[(((from + i * step) % items.length) + items.length) % items.length];
                if (!(item as HTMLButtonElement).disabled) {
                    item.focus();
                    return;
                }
            }
            // Nothing can be chosen, so the menu takes the keys, to close on Escape
            element?.setAttribute('tabindex', '-1');
            element?.focus();
        }
    });

    return [
        menu,
        Prec.high(keymap.of([
            { key: 'Mod-.', run: (view) => openFixes(view), preventDefault: true },
            { key: 'Mod-g', run: gotoLine, preventDefault: true },
            { key: 'Shift-F8', run: previousDiagnostic, preventDefault: true },
        ])),
        EditorView.domEventHandlers({
            contextmenu(event, view) {
                event.preventDefault();
                // The menu key gives no point, so the menu opens at the cursor
                const isFromKey = event.clientX === 0 && event.clientY === 0;
                if (!isFromKey) moveCursorTo(view, event.clientX, event.clientY);
                const at = isFromKey ? cursorPoint(view) : { x: event.clientX, y: event.clientY };
                view.plugin(menu)?.open([fixItems(view), commandItems(view), clipboardItems(view)], at.x, at.y);
                return true;
            },
        }),
    ];

    function openFixes(view: EditorView): boolean {
        const fixes = fixItems(view);
        const at = cursorPoint(view);
        view.plugin(menu)?.open([fixes.length > 0 ? fixes : [{ label: 'No quick fixes here' }]], at.x, at.y);
        return true;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** An item in the menu. One without `run` is shown, but cannot be chosen. */
interface MenuItem {
    readonly label: string;
    /** Its keys, as CodeMirror writes them, shown beside the label. */
    readonly key?: string;
    readonly run?: () => void;
}

/** The commands extensions provide, for the menu, in the order provided. */
const menuCommands = Facet.define<readonly EditorCommand[], readonly EditorCommand[]>({
    combine: (lists) => lists.flat(),
});

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** How each modifier is written beside a menu item. */
const MODIFIER_LABELS: Readonly<Record<string, string>> = IS_MAC
    ? { Mod: '⌘', Alt: '⌥', Shift: '⇧', Ctrl: '⌃' }
    : { Mod: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Ctrl: 'Ctrl' };

/** The fixes for each problem at the cursor. */
function fixItems(view: EditorView): MenuItem[] {
    const head = view.state.selection.main.head;
    const items: MenuItem[] = [];
    forEachDiagnostic(view.state, (diagnostic, from, to) => {
        if (head < from || head > to) return;
        for (const action of diagnostic.actions ?? []) items.push(toFixItem(view, action, from, to));
    });
    return items;
}

function toFixItem(view: EditorView, action: Action, from: number, to: number): MenuItem {
    return { label: action.name, run: () => action.apply(view, from, to) };
}

/** The commands extensions provide, then go to line. */
function commandItems(view: EditorView): MenuItem[] {
    const items: MenuItem[] = view.state.facet(menuCommands).map((command) => ({
        label: command.label,
        key: command.key,
        run: () => void command.run(view),
    }));
    items.push({ label: 'Go to line...', key: 'Mod-g', run: () => void gotoLine(view) });
    return items;
}

/**
 * Cut, copy and paste, through the clipboard. Cut and copy need a selection,
 * and cut and paste an editable file. A browser that will not let the page
 * read the clipboard pastes nothing; Ctrl+V still pastes.
 */
function clipboardItems(view: EditorView): MenuItem[] {
    const { from, to } = view.state.selection.main;
    const hasSelection = from < to;
    const isEditable = !view.state.readOnly;
    const copy = (): Promise<void> => navigator.clipboard.writeText(view.state.sliceDoc(from, to));
    return [
        {
            label: 'Cut',
            key: 'Mod-x',
            run: hasSelection && isEditable
                ? () => void copy().then(() => view.dispatch({ changes: { from, to }, userEvent: 'delete.cut' }), () => undefined)
                : undefined,
        },
        { label: 'Copy', key: 'Mod-c', run: hasSelection ? () => void copy().catch(() => undefined) : undefined },
        {
            label: 'Paste',
            key: 'Mod-v',
            run: isEditable
                ? () => void navigator.clipboard.readText().then((text) => view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.paste' }), () => undefined)
                : undefined,
        },
    ];
}

/** Puts the cursor where the pointer is, unless that is inside the selection, which a right-click keeps. */
function moveCursorTo(view: EditorView, x: number, y: number): void {
    const pos = view.posAtCoords({ x, y });
    if (pos === null) return;
    for (const range of view.state.selection.ranges) if (pos >= range.from && pos <= range.to) return;
    view.dispatch({ selection: { anchor: pos } });
}

/** Where the cursor is on screen, or the editor's top left corner if it is out of view. */
function cursorPoint(view: EditorView): { x: number; y: number } {
    const coords = view.coordsAtPos(view.state.selection.main.head);
    if (coords !== null) return { x: coords.left, y: coords.bottom };
    const box = view.dom.getBoundingClientRect();
    return { x: box.left, y: box.top };
}

function menuItemElement(item: MenuItem, onChosen: () => void): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-menu-item';
    button.setAttribute('role', 'menuitem');
    button.disabled = item.run === undefined;
    const label = document.createElement('span');
    label.className = 'editor-menu-label';
    label.textContent = item.label;
    button.append(label);
    if (item.key !== undefined) {
        const keys = document.createElement('span');
        keys.className = 'editor-menu-keys';
        keys.textContent = toKeyLabel(item.key);
        button.append(keys);
    }
    button.addEventListener('click', onChosen);
    return button;
}

function menuItemsOf(element: HTMLElement | undefined): HTMLElement[] {
    return element === undefined ? [] : [...element.querySelectorAll<HTMLElement>('.editor-menu-item')];
}

/** Keys as CodeMirror writes them, such as `Shift-Alt-f`, as a person reads them: Shift+Alt+F, or the Mac's symbols. */
function toKeyLabel(key: string): string {
    const parts = key.split('-').map((part) => MODIFIER_LABELS[part] ?? (part.length === 1 ? part.toUpperCase() : part));
    return parts.join(IS_MAC ? '' : '+');
}
