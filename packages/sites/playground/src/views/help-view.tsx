/** @jsxImportSource @mvtjs/html */
import { watch } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HelpViewBindings {
    readonly isOpen: () => boolean;
    /** The libraries a project may import, by the names it imports them by, and what each is for. */
    readonly libraries: readonly HelpLibrary[];
    readonly onClosed?: () => void;
}

export interface HelpLibrary {
    readonly name: string;
    /** A sentence saying what the library is for. Code goes in backticks. */
    readonly summary: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A friendly guide to the playground, for someone new to it: what goes in a
 * project, what it can import, files and barrels, running a project, help
 * from the editor, the keyboard shortcuts, and saving, sharing and
 * exporting. Escape, or a click outside the dialog, closes it.
 */
export function HelpView(bindings: HelpViewBindings): Element {
    const watcher = watch({ isOpen: bindings.isOpen });
    watcher.poll();
    /** Whether the dialog has opened since it last took the focus. */
    let isFocusDue = false;

    return (
        // The wrapper is never hidden, so it sees the dialog close and open again
        <div class="help-layer" onRefresh={noteOpening}>
            <div class="help" visible={bindings.isOpen} onPointerDown={onBackdropPressed} onKeyDown={onKeyDown}>
                <div class="help-panel" role="dialog" aria-modal="true" aria-label="Help" tabIndex={-1} onRefresh={focusIfDue}>
                    <div class="help-head">
                        <h2 class="help-title" text="Welcome to the playground" />
                        <button type="button" class="help-close" text="Close" onClick={() => bindings.onClosed?.()} />
                    </div>
                    {helpContent(bindings.libraries)}
                </div>
            </div>
        </div>
    );

    function noteOpening(): void {
        const { isOpen } = watcher.poll();
        if (isOpen.changed && isOpen.value) isFocusDue = true;
    }

    /** Focuses the dialog once it shows, so Escape closes it, and the keys scroll it. */
    function focusIfDue(panel: Element): void {
        if (!isFocusDue) return;
        isFocusDue = false;
        (panel as HTMLElement).focus();
        panel.scrollTop = 0;
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        bindings.onClosed?.();
    }

    function onBackdropPressed(event: PointerEvent): void {
        if (event.target === event.currentTarget) bindings.onClosed?.();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * A part of the help: a paragraph, where `code` in backticks shows as code;
 * a list of such paragraphs; a block of code; or a table of keys and what
 * they do.
 */
type HelpBlock =
    | { readonly kind: 'paragraph'; readonly text: string }
    | { readonly kind: 'list'; readonly items: readonly string[] }
    | { readonly kind: 'code'; readonly text: string }
    | { readonly kind: 'keys'; readonly rows: readonly (readonly [keys: string, does: string])[] };

interface HelpSection {
    readonly title: string;
    readonly blocks: readonly HelpBlock[];
}

const paragraph = (text: string): HelpBlock => ({ kind: 'paragraph', text });

/** The help, in order. The list of libraries comes from the playground's own, so it is always up to date. */
function helpSections(libraries: readonly HelpLibrary[]): HelpSection[] {
    return [
        {
            title: "What's in a project",
            blocks: [
                paragraph('Every project starts from `main.ts`. That file tells the playground about your project: how big it is, and what to do when it starts. You describe it with `definePixiProject`, and export the result as `project`, like this:'),
                { kind: 'code', text: MAIN_EXAMPLE },
                paragraph('For a page built from HTML elements, use `defineHtmlProject` instead. For a 3D scene, use `defineThreeProject`.'),
                paragraph("When your project runs, the playground calls your `start` function. It hands you somewhere to put your views. That's a Pixi `stage` in this example, a `root` element for an HTML project, or a `scene` and `camera` for three.js. You also get `sound`, a little sound chip you can play notes on."),
                paragraph("Your `start` function must return a model. From then on, each frame, the playground moves that model forward by calling its `update`, then redraws your views to match. That's the heart of MVT: models change, and then views follow."),
            ],
        },
        {
            title: 'Libraries available for import',
            blocks: [
                paragraph('Your files can import each other with paths such as `../models` or `./views`. They can also import these libraries by name:'),
                { kind: 'list', items: libraries.map((library) => `\`${library.name}\` - ${library.summary}`) },
                paragraph("Packages not on this list aren't available in the playground."),
            ],
        },
        {
            title: 'Files and folders',
            blocks: [
                paragraph("The file list on the left shows your files as a tree. Click a folder to fold it away. Point at a row to see its buttons. + adds a new file, and a folder's own + adds one inside that folder. ✎ moves or renames a file or a folder, and × deletes a file. When you move something, the playground updates every import that points to it, so nothing breaks."),
                paragraph("You'll notice that each folder has an `index.ts`. This is called a barrel. It lists everything the folder offers to the rest of the project. That lets other files write `import { createBallModel } from './models'`, without needing to know which file inside the folder it lives in."),
                paragraph("The playground writes these barrels for you, and keeps them up to date as you add and change files. It also helps you stick to the pattern. If a file reaches past a barrel to a file inside the folder, you'll see an error, usually with a one-click fix."),
                paragraph("Barrels are a good habit in bigger projects, but you don't have to use them. If you'd rather organise things your own way, click the ⚙ next to the project's name and switch them off. The playground then stops writing barrels, and stops checking your imports."),
            ],
        },
        {
            title: 'Running your project',
            blocks: [
                paragraph("Press Run to start your project in the preview on the right. You usually won't need to press it again. With Run on change ticked, the project restarts by itself a moment after you stop typing. If there's a problem that would stop it running, it waits until you've fixed it."),
                paragraph("Pause and Step let you freeze time and move forward one frame at a time. That's handy for seeing exactly what happens. The speed menu slows time down or speeds it up."),
                paragraph("Below the preview, the Console shows anything your project logs with `console.log`. Problems lists anything that's wrong, with a link to the exact place. Problems that stop your project from running come first. Type errors are listed too, but they won't stop it from running."),
                paragraph('The Performance tab shows how fast your project runs, and how much work each frame does. Click its (i) to find out what each number means.'),
            ],
        },
        {
            title: 'Getting help from the editor',
            blocks: [
                paragraph("The editor understands TypeScript, so it can help you as you type. It suggests names as you go, including what you can import. Rest the pointer on a name to see its type signature and documentation. While you type a function call, it shows what the function expects. Problems are underlined, and many come with a quick fix. Right-click for more, such as renaming something everywhere it's used."),
                paragraph("Organise Imports tidies up the imports at the top of a file. It sorts them into one block, merges imports from the same place, and removes any you aren't using. It follows TypeScript's order, so `@mvtjs/pixi` comes before `pixi.js`. If you want to keep two groups of imports apart, put a comment between them."),
            ],
        },
        {
            title: 'Keyboard shortcuts',
            blocks: [
                paragraph('On a Mac, use Cmd wherever you see Ctrl.'),
                paragraph('When you click in the preview, the keyboard goes to your project, so that games can use the keys. Click back in the editor to use these shortcuts again.'),
                { kind: 'keys', rows: KEYS },
            ],
        },
        {
            title: 'Saving, sharing and exporting',
            blocks: [
                paragraph("There's no need to save. The playground keeps your projects in this browser, and saves them as you type. Open Projects to switch between them, start a new one, or open an example."),
                paragraph('Examples are yours to play with. As soon as you change one, it becomes a project of your own, and the original example stays as it was.'),
                paragraph('Share gives you a link to send to someone. The whole project is packed into the link itself, so nothing is uploaded anywhere. Whoever opens the link gets their own copy to play with.'),
                paragraph("Export downloads your project as a zip, so you can carry on working on it on your own computer, without the playground. Here's how to run it:"),
                {
                    kind: 'list',
                    items: [
                        'Unzip it, and open a terminal in its folder.',
                        'Run `npm install` to fetch the libraries it needs.',
                        'Run `npm run dev`, then open the address it shows. Edit the files in `src/`, and the page updates each time you save.',
                        'Run `npm run build` to check the whole project for type errors. It also builds a finished copy of your page into `dist/`, and `npm run preview` lets you try it out.',
                    ],
                },
                paragraph("There's one thing to watch for. The playground runs the very latest code of the MVT libraries, including changes that haven't been published to npm yet. An exported project installs the libraries from npm, so it only gets what has been published. If your project uses something that brand new, it may not build until the next version is published. Also, exported projects can't play sound yet, because `@mvtjs/audio` hasn't been published."),
            ],
        },
        {
            title: 'Colours',
            blocks: [
                paragraph("Pick a colour theme from the menu at the top right of the page. On a phone, it's the ◐ button. There are dark and light themes, and the playground remembers your choice."),
            ],
        },
    ];
}

const MAIN_EXAMPLE = `import { definePixiProject } from 'playground';
import { createBallModel } from './models';
import { BallView } from './views';

export const project = definePixiProject({
    width: 400,
    height: 300,
    start: ({ stage }) => {
        const model = createBallModel();
        stage.addChild(BallView({ model }));
        return model;
    },
});`;

const KEYS: readonly (readonly [string, string])[] = [
    ['Ctrl+Enter', 'Run your project'],
    ['Ctrl+S', 'Save now (your projects also save as you type)'],
    ['Ctrl+P', 'Jump to a file by typing its name'],
    ['Ctrl+O', 'Open your projects'],
    ['Ctrl+Space', 'Show suggestions for the word you are typing'],
    ['F12, or Ctrl+click', 'Jump to where something is defined'],
    ['F2', 'Rename something everywhere it is used'],
    ['Ctrl+.', 'Show quick fixes for the problem under the cursor'],
    ['F8, Shift+F8', 'Jump to the next problem, or the previous one'],
    ['Shift+Alt+F', 'Tidy up the formatting of the file'],
    ['Shift+Alt+O', 'Organise the imports'],
    ['Ctrl+G', 'Jump to a line number'],
    ['Ctrl+F', 'Find, and replace'],
    ['Ctrl+/', 'Comment out a line, or uncomment it'],
];

/**
 * The help's elements, made once. They never change, so they are plain
 * elements, which the JSX could not make: a paragraph mixes text and code.
 */
function helpContent(libraries: readonly HelpLibrary[]): HTMLElement {
    const content = document.createElement('div');
    content.className = 'help-content';
    for (const section of helpSections(libraries)) {
        const title = document.createElement('h3');
        title.className = 'help-section';
        title.textContent = section.title;
        content.append(title);
        for (const block of section.blocks) content.append(blockElement(block));
    }
    return content;
}

function blockElement(block: HelpBlock): HTMLElement {
    switch (block.kind) {
        case 'paragraph':
            return withCode(document.createElement('p'), block.text);
        case 'list': {
            const list = document.createElement('ul');
            for (const item of block.items) list.append(withCode(document.createElement('li'), item));
            return list;
        }
        case 'code': {
            const pre = document.createElement('pre');
            pre.className = 'help-code';
            pre.textContent = block.text;
            return pre;
        }
        case 'keys': {
            const table = document.createElement('table');
            table.className = 'help-keys';
            for (const [keys, does] of block.rows) {
                const row = table.insertRow();
                const keysCell = row.insertCell();
                const kbd = document.createElement('kbd');
                kbd.textContent = keys;
                keysCell.append(kbd);
                row.insertCell().textContent = does;
            }
            return table;
        }
    }
}

/** Fills an element with text, each part in backticks made code. */
function withCode(element: HTMLElement, text: string): HTMLElement {
    const parts = text.split('`');
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            element.append(parts[i]);
        }
        else {
            const code = document.createElement('code');
            code.textContent = parts[i];
            element.append(code);
        }
    }
    return element;
}
