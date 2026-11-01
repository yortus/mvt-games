import { describe, expect, it } from 'vitest';
import { findImportedNames } from './find-imported-names';

describe('findImportedNames', () => {
    it('finds the names imported from the libraries, each once', () => {
        const names = findImportedNames([
            "import { Container, Graphics } from 'pixi.js';\nimport { setRefresh } from '@mvtjs/pixi';",
            "import { createReaction, type Watcher, watch as poll } from '@mvtjs/utils';\nimport { Graphics } from 'pixi.js';",
            "import gsap from 'gsap';",
        ]);
        expect(names).toEqual([
            { name: 'Container', from: 'pixi.js' },
            { name: 'Graphics', from: 'pixi.js' },
            { name: 'setRefresh', from: '@mvtjs/pixi' },
            { name: 'createReaction', from: '@mvtjs/utils' },
            { name: 'Watcher', from: '@mvtjs/utils' },
            { name: 'watch', from: '@mvtjs/utils' },
            { name: 'gsap', from: 'gsap' },
        ]);
    });

    it('leaves out the project\'s own files, whole modules, and packages the playground doesn\'t provide', () => {
        const names = findImportedNames([
            "import { createBallModel } from './models';\nimport * as PIXI from 'pixi.js';\nimport { thing } from 'left-pad';",
        ]);
        expect(names).toEqual([]);
    });

    it('reads an import written over several lines', () => {
        const names = findImportedNames(["import {\n    definePixiProject,\n} from 'playground';"]);
        expect(names).toEqual([{ name: 'definePixiProject', from: 'playground' }]);
    });
});
