import { describe, expect, it } from 'vitest';
import { attributesOf, defineElements, element, event, type JsxTarget } from '../src/mvt-utils/jsx';
import type { RefreshMethod, UpdateMethod } from '../src/mvt-utils';
import { createPrecompileManifest, findManifestAttribute, PRECOMPILE_MANIFEST_FORMAT } from './jsx-precompile-manifest';

// ---------------------------------------------------------------------------
// A small JSX target
// ---------------------------------------------------------------------------

interface Node {
    x: number;
    label: string;
    isShown: boolean;
    onUpdate: UpdateMethod | undefined;
    onRefresh: RefreshMethod | undefined;
}

const node = attributesOf<Node>();
const createNode = (): Node => ({ x: 0, label: '', isShown: true, onUpdate: undefined, onRefresh: undefined });

const target = {
    name: 'small-jsx',
    visible: node.everyFrame('isShown'),
} as JsxTarget<Node>;

const shared = {
    x: node.everyFrame('x'),
    label: node.onChange((e, v: string) => { e.label = v; }),
    mode: node.fixed('label'),
    onPoke: event<string>('poke'),
};
const elements = defineElements({
    box: element(createNode, shared),
    ring: element(createNode, shared),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPrecompileManifest', () => {
    const manifest = createPrecompileManifest({ target, elements });

    it('records each attribute\'s write kind, and the property of a changeable one', () => {
        expect(manifest.format).toBe(PRECOMPILE_MANIFEST_FORMAT);
        expect(manifest.target).toBe('small-jsx');
        expect(manifest.visible).toEqual({ kind: 'every-frame', property: 'isShown' });
        expect(findManifestAttribute(manifest, 'box', 'x')).toEqual({ kind: 'every-frame', property: 'x' });
        expect(findManifestAttribute(manifest, 'box', 'label')).toEqual({ kind: 'on-change' });
        // A fixed value is never bound, so its property is left out
        expect(findManifestAttribute(manifest, 'box', 'mode')).toEqual({ kind: 'fixed' });
        expect(findManifestAttribute(manifest, 'box', 'onPoke')).toEqual({ kind: 'event' });
    });

    it('finds nothing it does not have', () => {
        expect(findManifestAttribute(manifest, 'box', 'width')).toBeUndefined();
        expect(findManifestAttribute(manifest, 'none', 'x')).toBeUndefined();
        expect(findManifestAttribute(manifest, 'toString', 'x')).toBeUndefined();
    });

    it('shares one record between elements with the same attributes', () => {
        expect(manifest.elements.box.attributes).toBe(manifest.elements.ring.attributes);
        expect(manifest.sets).toHaveLength(1);
    });

    it('is plain data, the same after a round trip through JSON', () => {
        expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
    });
});
