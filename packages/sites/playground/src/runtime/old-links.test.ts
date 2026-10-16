import { describe, expect, it } from 'vitest';
import { convertOldCode } from './old-links';
import { prepareProject } from './prepare-project';

// Code in the old playground's style: no imports, the sandbox's globals, and
// `createModel` and `createView` found by name
const OLD_MODEL = `// A counter
import { Container } from 'pixi.js';
function createModel() {
    let count = 0;
    return {
        get count() { return count; },
        update(deltaMs: number) { count += deltaMs; },
    };
}
`;

const OLD_VIEW = `function createView(model: any): any {
    setBackground(0x0a1628);
    const view = new Container();
    const text = new Text({ text: '' });
    view.addChild(text);
    const watcher = watch({ count: () => model.count });
    setRefresh(view, () => {
        if (watcher.poll().count.changed) text.text = String(model.count);
    });
    return view;
}
`;

const OLD_JSX_VIEW = `function createView(model: any): any {
    return <container><graphics x={() => model.count} /></container>;
}
`;

describe('convertOldCode', () => {
    it('makes a project of three files, with the old canvas size and background', () => {
        const files = convertOldCode({ modelCode: OLD_MODEL, viewCode: OLD_VIEW, canvasWidth: 320, canvasHeight: 240 });
        expect(files.map((f) => f.path)).toEqual(['main.ts', 'models/model.ts', 'views/view.tsx']);
        const main = files[0].text;
        expect(main).toContain('width: 320,');
        expect(main).toContain('height: 240,');
        expect(main).toContain('background: 0x0a1628,');
    });

    it('imports the globals each file uses, and exports its factory', () => {
        const [, model, view] = convertOldCode({ modelCode: OLD_MODEL, viewCode: OLD_VIEW, canvasWidth: 1, canvasHeight: 1 });
        expect(model.text).not.toContain('import');
        expect(model.text).toContain('export function createModel');
        expect(view.text).toContain("import { Container, Text } from 'pixi.js';");
        expect(view.text).toContain("import { setRefresh } from '@mvtjs/pixi';");
        expect(view.text).toContain("import { watch } from '@mvtjs/utils';");
        expect(view.text).toContain('export function createView');
        expect(view.text).not.toContain('setBackground');
    });

    it('makes projects that prepare with no problems, JSX views included', async () => {
        for (const viewCode of [OLD_VIEW, OLD_JSX_VIEW]) {
            const files = convertOldCode({ modelCode: OLD_MODEL, viewCode, canvasWidth: 1, canvasHeight: 1 });
            expect((await prepareProject({ files })).problems).toEqual([]);
        }
    });

    it('notes a setBackground call it cannot move', () => {
        const viewCode = 'function createView(model: any): any {\n    setBackground(model.colour);\n    return new Container();\n}\n';
        const [, , view] = convertOldCode({ modelCode: OLD_MODEL, viewCode, canvasWidth: 1, canvasHeight: 1 });
        expect(view.text).toContain('Set `background` in main.ts');
    });
});
