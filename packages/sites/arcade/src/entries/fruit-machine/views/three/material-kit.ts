import {
    type BufferGeometry, type ColorRepresentation, type Material, MeshPhysicalMaterial, MeshStandardMaterial,
    type Texture,
} from 'three';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Makes the materials, geometries and textures a three.js view needs, and
 * releases them all at once when the view is destroyed. The materials are
 * physically based, so they shine only where the scene gives them something
 * to reflect: an environment map, which the page sets on the scene.
 */
export interface MaterialKit {
    /** Glossy, clear-coated paint, like a cabinet's body. Shared by everything painted that colour. */
    paint: (color: ColorRepresentation) => MeshPhysicalMaterial;
    /** Polished metal: chrome, in a light grey. Shared by everything of that colour. */
    metal: (color: ColorRepresentation) => MeshStandardMaterial;
    /** A dull finish, for rubber, plastic and shadowed parts. Shared by everything of that colour. */
    matte: (color: ColorRepresentation) => MeshStandardMaterial;
    /** A satin finish showing a texture, of its own: a drum's printed strip. */
    printed: (map: Texture) => MeshStandardMaterial;
    /** A material that can glow in its own colour, of its own: turn up its `emissiveIntensity`. */
    glowing: (color: ColorRepresentation) => MeshStandardMaterial;
    /** Faint, clear glass that catches reflections. */
    glass: () => MeshPhysicalMaterial;
    /** Registers anything else disposable for release, and returns it. */
    own: <T extends BufferGeometry | Material | Texture>(resource: T) => T;
    release: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMaterialKit(): MaterialKit {
    const owned: (BufferGeometry | Material | Texture)[] = [];
    const shared = new Map<string, Material>();

    return {
        paint: (color) => sharedFor('paint', color, () => new MeshPhysicalMaterial({
            color,
            roughness: 0.32,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
        })),
        metal: (color) => sharedFor('metal', color, () => new MeshStandardMaterial({ color, metalness: 1, roughness: 0.16 })),
        matte: (color) => sharedFor('matte', color, () => new MeshStandardMaterial({ color, metalness: 0, roughness: 0.85 })),
        printed: (map) => own(new MeshStandardMaterial({ map, metalness: 0, roughness: 0.45 })),
        glowing: (color) => own(new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.25 })),
        glass: () => own(new MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 0.03,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
        })),
        own,
        release() {
            for (let i = 0; i < owned.length; i++) owned[i].dispose();
            owned.length = 0;
            shared.clear();
        },
    };

    function sharedFor<M extends Material>(finish: string, color: ColorRepresentation, create: () => M): M {
        const key = `${finish}:${String(color)}`;
        let material = shared.get(key) as M | undefined;
        if (material === undefined) {
            material = own(create());
            shared.set(key, material);
        }
        return material;
    }

    function own<T extends BufferGeometry | Material | Texture>(resource: T): T {
        owned.push(resource);
        return resource;
    }
}
