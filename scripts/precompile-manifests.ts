/**
 * This repo's JSX targets and their precompile manifests, made from their
 * element tables. Each manifest is saved beside its JSX target as
 * `precompile-manifest.json` and reached as `<importSource>/precompile`,
 * through `package.json`'s `imports`, which is how the precompiler finds it
 * (`vite-plugin-jsx-precompile.ts`).
 *
 * Saved by `npm run generate-precompile-manifests`, and checked by
 * `precompile-manifests.test.ts`, which fails when a table and its saved
 * manifest disagree. A published renderer package would make its manifest
 * when it is built instead (proposal 022 section 12.1).
 */

import { pixiElements, pixiTarget } from '../src/pixi-mvt/jsx';
import { threeElements, threeTarget } from '../src/three-mvt/jsx';
import { createPrecompileManifest, type PrecompileManifest } from './jsx-precompile-manifest';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ManifestFile {
    /** The `@jsxImportSource` the JSX target's modules name. */
    readonly importSource: string;
    /** Where the manifest is saved, relative to the repo. */
    readonly path: string;
    readonly manifest: PrecompileManifest;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Every JSX target's manifest, as its element table makes it now. */
export function precompileManifests(): ManifestFile[] {
    return [
        {
            importSource: '#pixi-mvt/jsx',
            path: 'src/pixi-mvt/jsx/precompile-manifest.json',
            manifest: createPrecompileManifest({ target: pixiTarget, elements: pixiElements }),
        },
        {
            importSource: '#three-mvt/jsx',
            path: 'src/three-mvt/jsx/precompile-manifest.json',
            manifest: createPrecompileManifest({ target: threeTarget, elements: threeElements }),
        },
    ];
}

/** A manifest as saved: JSON, one attribute or element to a line, so a change to a table is a readable diff. */
export function formatManifest(manifest: PrecompileManifest): string {
    const lines = [
        '{',
        `    "format": ${manifest.format},`,
        `    "target": ${JSON.stringify(manifest.target)},`,
        `    "visible": ${JSON.stringify(manifest.visible)},`,
        '    "sets": [',
    ];
    for (let i = 0; i < manifest.sets.length; i++) {
        const comma = i < manifest.sets.length - 1 ? ',' : '';
        const entries = entriesOf(manifest.sets[i], '            ');
        if (entries.length === 0) lines.push(`        {}${comma}`);
        else lines.push('        {', ...entries, `        }${comma}`);
    }
    lines.push('    ],', '    "elements": {', ...entriesOf(manifest.elements, '        '), '    }', '}');
    return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A record's entries as lines of JSON, each value on its key's line. */
function entriesOf(record: Readonly<Record<string, unknown>>, indent: string): string[] {
    const keys = Object.keys(record);
    const lines: string[] = [];
    for (let i = 0; i < keys.length; i++) {
        const comma = i < keys.length - 1 ? ',' : '';
        lines.push(`${indent}${JSON.stringify(keys[i])}: ${JSON.stringify(record[keys[i]])}${comma}`);
    }
    return lines;
}
