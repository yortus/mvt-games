import { decompressFromEncodedURIComponent } from 'lz-string';
import type { ProjectFile } from './prepare-project';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A project shared from the old playground: a model's code, which defined
 * `createModel()`, and a view's code, which defined `createView(model)`. Both
 * used the old sandbox's globals in place of imports.
 */
export interface OldPlaygroundCode {
    readonly modelCode: string;
    readonly viewCode: string;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Reads an old playground link's `#code=` value. Returns undefined if it cannot. */
export function decodeOldCode(encoded: string): OldPlaygroundCode | undefined {
    try {
        const json = decompressFromEncodedURIComponent(encoded);
        if (!json) return undefined;
        const data = JSON.parse(json) as { m?: string; v?: string; w?: number; h?: number };
        return {
            modelCode: data.m ?? '',
            viewCode: data.v ?? '',
            canvasWidth: data.w ?? DEFAULT_WIDTH,
            canvasHeight: data.h ?? DEFAULT_HEIGHT,
        };
    }
    catch {
        return undefined;
    }
}

/**
 * Converts code from the old playground into a project of three files. The
 * model's code goes to `models/model.ts`, and the view's to `views/view.tsx`.
 * Each gains imports for the old globals it uses, and an `export` on its
 * `createModel` or `createView`. A `main.ts` is written to call them, with
 * the old canvas size. The first `setBackground` call with a fixed colour
 * becomes the project's `background`.
 */
export function convertOldCode(old: OldPlaygroundCode): ProjectFile[] {
    let viewCode = old.viewCode;
    let background: string | undefined;
    const backgroundCall = /^[ \t]*setBackground\(\s*(0x[0-9a-fA-F]+|\d+)\s*\);?[ \t]*\r?\n?/m.exec(viewCode);
    if (backgroundCall !== null) {
        background = backgroundCall[1];
        viewCode = viewCode.slice(0, backgroundCall.index) + viewCode.slice(backgroundCall.index + backgroundCall[0].length);
    }
    const viewNote = /\bsetBackground\(/.test(viewCode)
        ? '// The old `setBackground` is gone. Set `background` in main.ts instead.\n'
        : '';

    const main = [
        "import { definePixiProject } from 'playground';",
        "import { createModel } from './models/model';",
        "import { createView } from './views/view';",
        '',
        '// Converted from a link to the old playground, which had one model and one view.',
        'export const project = definePixiProject({',
        `    width: ${old.canvasWidth},`,
        `    height: ${old.canvasHeight},`,
        ...(background === undefined ? [] : [`    background: ${background},`]),
        '    start: ({ stage }) => {',
        '        const model = createModel();',
        '        stage.addChild(createView(model));',
        '        return model;',
        '    },',
        '});',
        '',
    ].join('\n');

    return [
        { path: 'main.ts', text: main },
        { path: 'models/model.ts', text: withImportsAndExport(old.modelCode, 'createModel', '') },
        { path: 'views/view.tsx', text: withImportsAndExport(viewCode, 'createView', `/** @jsxImportSource @mvtjs/pixi */\n${viewNote}`) },
    ];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 400;

/** The old sandbox's globals, by the package each now comes from. */
const OLD_GLOBALS: readonly { readonly from: string; readonly names: readonly string[] }[] = [
    { from: 'pixi.js', names: ['Container', 'Graphics', 'Text', 'Sprite', 'Texture', 'Rectangle', 'TextStyle'] },
    { from: '@mvtjs/pixi', names: ['setUpdate', 'setRefresh', 'SKIP_DESCENDANTS', 'List', 'Switch', 'Match'] },
    { from: '@mvtjs/utils', names: ['watch'] },
];

/** The old playground removed import lines before it ran the code, so they are removed here too. */
const IMPORT_LINE = /^\s*import\s+.*?['"].*?['"];?\s*$\r?\n?/gm;

function withImportsAndExport(code: string, factory: string, header: string): string {
    const body = code.replace(IMPORT_LINE, '')
        .replace(new RegExp(`^(\\s*)(function\\s+${factory}\\b)`, 'm'), '$1export $2')
        .replace(new RegExp(`^(\\s*)((?:const|let|var)\\s+${factory}\\b)`, 'm'), '$1export $2');
    const imports: string[] = [];
    for (const { from, names } of OLD_GLOBALS) {
        const used = names.filter((name) => new RegExp(`\\b${name}\\b`).test(body));
        if (used.length > 0) imports.push(`import { ${used.join(', ')} } from '${from}';`);
    }
    return `${header}${imports.join('\n')}${imports.length > 0 ? '\n\n' : ''}${body}`;
}
