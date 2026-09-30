import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { resolveConfig } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { OverlayView } from '../src/common';
import { createDemoModel, DemoView, TANK_SIZES } from '../src/demos/falling-sand';
import { createJsx, REFRESH_SOURCE_VERSION, type RefreshFactory, type RefreshMethodCounts } from '../src/mvt-utils/jsx';
import { pixiElements, pixiTarget, refreshMethodCounts, registerRefreshFactories } from '../src/pixi-mvt/jsx';
import { refreshScene } from '../src/pixi-mvt';
import type { PrecompileManifest } from './jsx-precompile-manifest';
import { jsxPrecompilePlugin, precompileModule, type PrecompileTarget } from './vite-plugin-jsx-precompile';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A JSX target as the plugin sees it: its saved manifest, found where
 * `<importSource>/precompile` resolves through `package.json`'s `imports`.
 */
function savedTarget(importSource: string): PrecompileTarget {
    const imports = (JSON.parse(readFileSync('package.json', 'utf8')) as { imports: Record<string, string> }).imports;
    const manifest = JSON.parse(readFileSync(imports[`${importSource}/precompile`], 'utf8')) as PrecompileManifest;
    return { importSource, manifest };
}

const pixi = savedTarget('#pixi-mvt/jsx');

/** Precompiles a module made of `jsx`, a JSX expression, with `prelude` before it. */
function precompile(jsx: string, prelude = '') {
    const code = `/** @jsxImportSource #pixi-mvt/jsx */\n${prelude}\nexport const view = ${jsx};\n`;
    return precompileModule(ts, code, 'test.tsx', pixi);
}

/** Runs a module's registration against `register`, as the module would on import. */
function runRegistration(
    registration: string,
    register: (factories: Record<string, RefreshFactory>, version: number) => void,
): void {
    const call = registration.slice(registration.indexOf(';') + 1);
    new Function('__mvtRegisterRefreshFactories', call)(register);
}

/**
 * Precompiles every module under src/ whose pragma names one of this repo's
 * JSX targets, and registers the Pixi modules' factories with the Pixi runtime,
 * as the plugin's code would. Returns the elements left to the runtime.
 */
function precompileRepo(): string[] {
    const targets = ['#pixi-mvt/jsx'].map(savedTarget);
    const skipped: string[] = [];
    // Views, not tests, which write invalid elements on purpose
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
        .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
    for (const file of files.sort()) {
        const path = join('src', file).replace(/\\/g, '/');
        const code = readFileSync(path, 'utf8');
        const target = targets.find((t) => code.includes(`@jsxImportSource ${t.importSource} `));
        if (target === undefined) continue;
        const result = precompileModule(ts, code, path, target);
        for (const s of result.skipped) skipped.push(`${path}:${s.line} <${s.tag}>: ${s.reason}`);
        if (target === targets[0] && result.registration !== '') runRegistration(result.registration, registerRefreshFactories);
    }
    return skipped;
}

function snapshot(counts: RefreshMethodCounts): RefreshMethodCounts {
    return { precompiled: counts.precompiled, generated: counts.generated, fallback: counts.fallback };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jsx precompile plugin', () => {
    describe('finding bindings', () => {
        it('binds function expressions, not literals, in the order the runtime writes them', () => {
            const result = precompile('<container label={() => "a"} x={() => 1} y={2} visible={() => true} />');

            // visible first, then every-frame bindings, then on-change ones
            expect(result.keys).toEqual(['v|e.visible,e.x,c.label,']);
        });

        it('resolves local function declarations and consts', () => {
            const prelude = 'function readX() { return 1; }\nconst Y = 2;\nconst readAlpha = () => 1;\nconst readAlso = readAlpha;';
            const result = precompile('<container x={readX} y={Y} alpha={readAlso} />', prelude);

            expect(result.keys).toEqual(['|e.x,e.alpha,']);
        });

        it('emits every variant of attributes that may or may not be functions', () => {
            const result = precompile('<container x={props.x} y={props.y} alpha={() => 1} />', 'declare const props: any;');

            expect([...result.keys].sort()).toEqual(['|e.alpha,', '|e.x,e.alpha,', '|e.x,e.y,e.alpha,', '|e.y,e.alpha,'].sort());
        });

        it('treats a parameter as undecided, even where an outer const has its name', () => {
            const prelude = 'const x = 1;\nconst make = (x: number) => <container x={x} />;';
            const result = precompile('make(2)', prelude);

            expect(result.keys).toEqual(['|e.x,']);
        });

        it('writes an attribute written by an apply function by key, and one written by a property inline', () => {
            const result = precompile('<sprite scale={() => 2} texture={() => t} />', 'declare const t: any;');

            expect(result.keys).toEqual(['|e@scale,c.texture,']);
            expect(result.registration).toContain('a0(e,g0());');
            expect(result.registration).toContain('e.texture=_1;');
        });

        it('ignores components, fixed attributes, events and the other attributes every element has', () => {
            const result = precompile(
                '<List items={[]}>{() => <sprite anchor={0.5} onPointerTap={() => {}} ref={() => {}} onRefresh={() => {}} />}</List>',
                'declare const List: any;',
            );

            expect(result.keys).toEqual([]);
            expect(result.registration).toBe('');
            expect(result.elementCount).toBe(1);
        });

        it('leaves to the runtime what it cannot see: spreads, unknown attributes, and too many undecided ones', () => {
            const prelude = 'declare const p: any;';
            const result = precompile(
                '<container><container {...p} /><container bogus={() => 1} />'
                + '<container x={p.a} y={p.b} alpha={p.c} rotation={p.d} zIndex={p.e} /></container>',
                prelude,
            );

            expect(result.skipped.map((s) => s.reason)).toEqual([
                'spread attributes',
                'the element table has no attribute \'bogus\'',
                '5 attributes that may or may not be functions',
            ]);
        });

        it('puts the registration after the pragma comment, on its line, so no line moves', () => {
            const code = '/** @jsxImportSource #pixi-mvt/jsx */\nexport const view = <container x={() => 1} />;\n';
            const result = precompileModule(ts, code, 'test.tsx', pixi);

            expect(code.slice(0, result.insertAt)).toBe('/** @jsxImportSource #pixi-mvt/jsx */');
            expect(result.registration).not.toContain('\n');
            expect(result.registration).toMatch(/^import \{ registerRefreshFactories as \w+ \} from "#pixi-mvt\/jsx\/jsx-runtime";/);
            expect(result.registration.endsWith(`},${REFRESH_SOURCE_VERSION});`)).toBe(true);
        });
    });

    describe('as a Vite plugin', () => {
        /** The plugin's transform, in a Vite config resolved at the repo's root, with no config file. */
        async function transformWithPlugin() {
            const plugin = jsxPrecompilePlugin();
            await resolveConfig({ root: process.cwd(), configFile: false, plugins: [plugin], logLevel: 'silent' }, 'build');
            const transform = plugin.transform as (code: string, id: string) => Promise<{ code: string } | undefined>;
            return (code: string) => transform(code, join(process.cwd(), 'src', 'example.tsx').replace(/\\/g, '/'));
        }

        it('finds a target\'s manifest from the module\'s import source, with no configuration', async () => {
            const transform = await transformWithPlugin();

            const pixiModule = await transform('/** @jsxImportSource #pixi-mvt/jsx */\nexport const view = <container x={() => 1} />;\n');

            expect(pixiModule?.code).toContain('from "#pixi-mvt/jsx/jsx-runtime"');
            expect(pixiModule?.code).toContain('"|e.x,"');
        });

        it('leaves alone a module whose import source has no manifest', async () => {
            const transform = await transformWithPlugin();

            expect(await transform('/** @jsxImportSource #common */\nexport const view = <box x={() => 1} />;\n')).toBeUndefined();
        });
    });

    // Registrations are shared by every runtime on the page, and so by these
    // tests: each uses a binding shape no other registers.
    describe('with the runtime', () => {
        it('registers factories the runtime uses where it may not generate code', () => {
            const result = precompile('<container x={() => 1} label={() => "a"} visible={() => true} />');
            const runtime = createJsx({ target: pixiTarget, elements: pixiElements, canGenerateCode: false });
            runRegistration(result.registration, registerRefreshFactories);

            let x = 3;
            let isShown = true;
            const el = runtime.jsx('container', { x: () => x, label: () => 'a', visible: () => isShown });
            refreshScene(el);
            expect(el.x).toBe(3);
            expect(el.label).toBe('a');
            x = 4;
            isShown = false;
            refreshScene(el);
            expect(el.visible).toBe(false);
            expect(el.x).toBe(3); // Skipped while hidden

            expect(snapshot(runtime.refreshMethodCounts)).toEqual({ precompiled: 1, generated: 0, fallback: 0 });
            expect(String(el.onRefresh)).toContain('e.x=g1()');
        });

        it('uses a registration that arrives after the shape was first built, as a lazily loaded module\'s would', () => {
            const runtime = createJsx({ target: pixiTarget, elements: pixiElements, canGenerateCode: false });
            runtime.jsx('container', { rotation: () => 1 });

            runRegistration(precompile('<container rotation={() => 1} />').registration, registerRefreshFactories);
            runtime.jsx('container', { rotation: () => 1 });

            expect(snapshot(runtime.refreshMethodCounts)).toEqual({ precompiled: 1, generated: 0, fallback: 1 });
        });

        it('ignores factories precompiled for another version of the refresh source, with a warning', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                const runtime = createJsx({ target: pixiTarget, elements: pixiElements, canGenerateCode: false });
                const other = precompile('<container alpha={() => 1} />').registration.replace(
                    `},${REFRESH_SOURCE_VERSION});`,
                    `},${REFRESH_SOURCE_VERSION + 1});`,
                );
                runRegistration(other, registerRefreshFactories);

                runtime.jsx('container', { alpha: () => 1 });

                expect(snapshot(runtime.refreshMethodCounts)).toEqual({ precompiled: 0, generated: 0, fallback: 1 });
                expect(warn.mock.calls.some((args) => String(args[0]).includes('different releases'))).toBe(true);
            }
            finally {
                warn.mockRestore();
            }
        });

        it('falls back, as before, for a shape that was not precompiled', () => {
            const runtime = createJsx({ target: pixiTarget, elements: pixiElements, canGenerateCode: false });
            runRegistration(precompile('<container zIndex={() => 1} />').registration, registerRefreshFactories);

            runtime.jsx('container', { y: () => 1 });

            expect(snapshot(runtime.refreshMethodCounts)).toEqual({ precompiled: 0, generated: 0, fallback: 1 });
        });
    });

    // The plugin is opt-in, so the test runner does not compile the views
    // through it. These tests do its work themselves: they precompile every
    // view under src/, on every JSX target, check what each leaves to the
    // runtime, and, for Pixi, register the result with the runtime the views
    // use, as each module would on import, and check that the views then need
    // no refresh code made at run time.
    describe('on this repo\'s views', () => {
        let skipped: string[] = [];

        beforeAll(() => {
            skipped = precompileRepo();
        });

        it('leaves only one element to the runtime, which binds nothing', () => {
            expect(skipped).toEqual(['src/common/overlay-view.tsx:40 <graphics>: spread attributes']);
        });

        it('builds the overlay view with no refresh code made at run time', () => {
            const before = snapshot(refreshMethodCounts);

            refreshScene(OverlayView({ width: 200, height: 100, isVisible: () => true, text: () => 'GAME OVER' }));

            const after = snapshot(refreshMethodCounts);
            expect(after.generated - before.generated).toBe(0);
            expect(after.fallback - before.fallback).toBe(0);
            expect(after.precompiled - before.precompiled).toBe(2);
        });

        it('builds and runs the falling-sand demo with no refresh code made at run time', () => {
            const before = snapshot(refreshMethodCounts);

            const model = createDemoModel({ ...TANK_SIZES.small, storage: 'objects' });
            const view = DemoView({ model, grainsView: 'sprites', tankSize: 'small', frameStats: () => undefined });
            refreshScene(view);
            // Pour, so the tank's `<List>` builds grain sprites during a scene pass
            model.tool = 'sand';
            model.startPour(8, 3);
            for (let f = 0; f < 30; f++) {
                model.update(16);
                refreshScene(view);
            }

            const after = snapshot(refreshMethodCounts);
            expect(after.generated - before.generated).toBe(0);
            expect(after.fallback - before.fallback).toBe(0);
            expect(after.precompiled - before.precompiled).toBeGreaterThan(50);
        });
    });
});
