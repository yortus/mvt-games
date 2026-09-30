/**
 * Precompile manifests: what the build-time precompiler knows of a JSX target's
 * elements. Build-time code, like the precompiler: nothing here reaches the
 * runtime, which knows nothing of manifests.
 */

import type { AttributeDefinition, ElementTable, JsxTarget, WriteKind } from '../src/mvt-utils/jsx';
import type { SceneNode } from '../src/mvt-utils';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The format of {@link PrecompileManifest}. The precompiler reads only
 * manifests of the format it was built for, so a renderer and a precompiler
 * from different releases never misread each other. Bump it whenever the
 * manifest's shape changes.
 */
export const PRECOMPILE_MANIFEST_FORMAT = 1;

/**
 * What the build-time precompiler needs to know about a JSX target's elements:
 * for each element, which attributes it has, how each is written, and which
 * property it assigns. Plain data, made from the element table by
 * {@link createPrecompileManifest} and saved as JSON beside the JSX target
 * (`precompile-manifest.json`, reached as `<importSource>/precompile`), so
 * the precompiler never loads a renderer, some of which install themselves
 * on load (proposal 022 section 12.1).
 */
export interface PrecompileManifest {
    /** {@link PRECOMPILE_MANIFEST_FORMAT}, when the manifest was made. */
    readonly format: number;
    /** The JSX target's name, as in its error messages. */
    readonly target: string;
    /** The JSX target's `visible` attribute. */
    readonly visible: ManifestAttribute;
    /**
     * Attribute records, each shared by every element that has the same
     * attributes, so a table of many similar elements stays small. By key.
     */
    readonly sets: readonly Readonly<Record<string, ManifestAttribute>>[];
    /** Each element, by tag. */
    readonly elements: Readonly<Record<string, ManifestElement>>;
}

/** One attribute, as far as generated refresh code depends on it. */
export interface ManifestAttribute {
    readonly kind: 'fixed' | 'event' | WriteKind;
    /** The property a changeable attribute assigns, when it is defined by one. */
    readonly property?: string;
}

/** Options for {@link createPrecompileManifest}. */
export interface PrecompileManifestOptions<N extends SceneNode> {
    readonly target: JsxTarget<N>;
    /** The JSX target's intrinsic elements. */
    readonly elements: ElementTable<N>;
}

export interface ManifestElement {
    /** Index in `sets` of the element's attributes. */
    readonly attributes: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** The precompile manifest of a JSX target and its element table. */
export function createPrecompileManifest<N extends SceneNode>(options: PrecompileManifestOptions<N>): PrecompileManifest {
    const { target, elements } = options;
    const sets: Record<string, ManifestAttribute>[] = [];
    const setIndices = new Map<string, number>();
    const manifestElements: Record<string, ManifestElement> = {};

    for (const tag in elements) {
        const definition = elements[tag];
        const attributes: Record<string, ManifestAttribute> = {};
        for (const key in definition.attributes) attributes[key] = describe(definition.attributes[key]);
        manifestElements[tag] = { attributes: setIndex(attributes) };
    }

    return {
        format: PRECOMPILE_MANIFEST_FORMAT,
        target: target.name,
        visible: describe(target.visible as AttributeDefinition<never>),
        sets,
        elements: manifestElements,
    };

    /** The index of an identical record in `sets`, adding it if there is none. */
    function setIndex(set: Record<string, ManifestAttribute>): number {
        const key = JSON.stringify(set);
        let index = setIndices.get(key);
        if (index === undefined) {
            index = sets.length;
            sets.push(set);
            setIndices.set(key, index);
        }
        return index;
    }
}

/**
 * Attribute `key` of element `tag`, as the runtime would find it.
 * `undefined` if the element or the attribute is not in the manifest.
 */
export function findManifestAttribute(manifest: PrecompileManifest, tag: string, key: string): ManifestAttribute | undefined {
    const element = Object.hasOwn(manifest.elements, tag) ? manifest.elements[tag] : undefined;
    if (element === undefined) return undefined;
    const attributes = manifest.sets[element.attributes];
    return Object.hasOwn(attributes, key) ? attributes[key] : undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** An attribute, as the manifest records it. A fixed value is never bound, so its property does not matter. */
function describe(definition: AttributeDefinition<never>): ManifestAttribute {
    if (definition.kind === 'event' || definition.kind === 'fixed') return { kind: definition.kind };
    return definition.property === undefined ? { kind: definition.kind } : { kind: definition.kind, property: definition.property };
}
