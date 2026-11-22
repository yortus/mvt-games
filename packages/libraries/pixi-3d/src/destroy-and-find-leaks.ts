import { BaseMaterial3D, BatchedMesh3D, type Container3D, Geometry3D, Mesh3D, SHARED_DEFAULT_TEXTURES, Sprite3D, View3D } from '@pixi/3d';
import { type Container, Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A geometry, material or texture that a view didn't release, or released too early. */
export interface ResourceLeak {
    readonly kind: 'geometry' | 'material' | 'texture';
    /**
     * `'leaked'` when it outlived the tree, and `'freed-early'` when it was
     * already destroyed while a mesh in the tree still drew with it.
     */
    readonly problem: 'leaked' | 'freed-early';
    readonly resource: object;
    /** The labels (or class names) of the nodes from the root down to the first node that used it. */
    readonly usedBy: string;
}

/** Options for {@link destroyAndFindLeaks}. */
export interface DestroyAndFindLeaksOptions {
    /**
     * Resources that the tree uses but doesn't own, such as a texture from a
     * loaded sprite sheet that outlives the tree. They're expected to
     * survive.
     */
    readonly shared?: Iterable<object>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Destroys a tree with `{ children: true }`. Then it returns each geometry,
 * material and texture that the tree's meshes drew with and that survived.
 * It also returns any that were destroyed while a mesh still used them. Use
 * it in a test, to check that every 3D view lists the resources that it
 * makes in `owns`.
 *
 * The tree may be a 2D Pixi container or a 3D node. The search goes into
 * the scene of every `View3D` it meets, such as a `Scene3DView`. It checks
 * each mesh's geometry and material, a material's textures and a sprite's
 * texture. It skips PixiJS 3D's shared placeholders, and anything listed in
 * `shared`.
 */
export function destroyAndFindLeaks(root: Container | Container3D, options: DestroyAndFindLeaksOptions = {}): ResourceLeak[] {
    const shared = new Set<object>(options.shared);
    const used = new Map<object, Use>();
    collectUses(root, labelOf(root), used, shared);

    const leaks: ResourceLeak[] = [];
    for (const [resource, use] of used) {
        if (isDestroyed(resource, use.kind)) leaks.push({ kind: use.kind, problem: 'freed-early', resource, usedBy: use.usedBy });
    }
    root.destroy({ children: true });
    for (const [resource, use] of used) {
        if (!isDestroyed(resource, use.kind)) leaks.push({ kind: use.kind, problem: 'leaked', resource, usedBy: use.usedBy });
    }
    return leaks;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Use {
    readonly kind: ResourceLeak['kind'];
    readonly usedBy: string;
}

function collectUses(node: Container | Container3D, path: string, used: Map<object, Use>, shared: ReadonlySet<object>): void {
    if (node instanceof View3D) {
        collectUses(node.root, `${path} > ${labelOf(node.root)}`, used, shared);
        return;
    }
    if (node instanceof Sprite3D) {
        noteUse(used, shared, node.texture, 'texture', path);
    }
    else if (node instanceof Mesh3D) {
        noteMeshUses(used, shared, node.geometry, node.material, path);
    }
    else if (node instanceof BatchedMesh3D) {
        // A batch isn't a mesh: each of its slots draws with a geometry and a material of its own
        const items = node.batch.items;
        for (let i = 0; i < items.length; i++) noteMeshUses(used, shared, items[i].geometry, items[i].material, `${path} [slot ${i}]`);
    }
    const children: readonly (Container | Container3D)[] = node.children;
    for (let i = 0; i < children.length; i++) collectUses(children[i], `${path} > ${labelOf(children[i])}`, used, shared);
}

/** Notes the geometry, material and textures that a mesh, or a slot of a batch, draws with. */
function noteMeshUses(used: Map<object, Use>, shared: ReadonlySet<object>, geometry: Geometry3D | undefined, material: BaseMaterial3D | undefined, path: string): void {
    noteUse(used, shared, geometry, 'geometry', path);
    noteUse(used, shared, material, 'material', path);
    // A destroyed material no longer references its textures
    if (material && !material.destroyed) {
        for (const texture of material._textures) noteUse(used, shared, texture, 'texture', path);
    }
}

function noteUse(used: Map<object, Use>, shared: ReadonlySet<object>, resource: object | undefined, kind: Use['kind'], usedBy: string): void {
    // A destroyed mesh's geometry and material are Pixi's `null`, though their types say otherwise
    if (!resource || used.has(resource) || shared.has(resource)) return;
    if (resource === Geometry3D.EMPTY || resource === BaseMaterial3D.EMPTY) return;
    if (resource instanceof Texture && (SHARED_DEFAULT_TEXTURES.has(resource) || resource === Texture.EMPTY || resource === Texture.WHITE)) return;
    used.set(resource, { kind, usedBy });
}

function isDestroyed(resource: object, kind: Use['kind']): boolean {
    if (kind === 'geometry') {
        // A Pixi geometry sets its buffers to `null` as it's destroyed, since it lacks a `destroyed` flag
        return (resource as Geometry3D).buffers === null;
    }
    return (resource as BaseMaterial3D | Texture).destroyed;
}

function labelOf(node: Container | Container3D): string {
    return node.label || node.constructor.name;
}
