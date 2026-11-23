import { Material3D, PlaneGeometry } from '@pixi/3d';
import { LABEL_TEXTURE_HEIGHT, LABEL_TEXTURE_WIDTH } from './label-texture';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What every painting has the same of, which the gallery's scene creates once, owns, and passes to each `PaintingView`. */
export interface PaintingParts {
    /** The white mat round each picture. */
    readonly mat: Material3D;
    /** The thin black frame round each mat. */
    readonly frame: Material3D;
    /** The plane each label is drawn on. Every label is the same size. */
    readonly labelPlane: PlaneGeometry;
    /** Every material and shape in the set, for the `owns` of the view that created it. */
    readonly resources: readonly (Material3D | PlaneGeometry)[];
}

/** The label's width, in metres. */
export const LABEL_WIDTH = 0.34;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the parts every painting shares. The view that calls it owns them, and lists `resources` in its `owns`. */
export function createPaintingParts(): PaintingParts {
    const mat = new Material3D({ baseColor: 0xf6f4ee, roughness: 0.9 });
    const frame = new Material3D({ baseColor: 0x1d1d1f, roughness: 0.5 });
    const labelPlane = new PlaneGeometry({ width: LABEL_WIDTH, height: (LABEL_WIDTH * LABEL_TEXTURE_HEIGHT) / LABEL_TEXTURE_WIDTH, flipV: true });
    return { mat, frame, labelPlane, resources: [mat, frame, labelPlane] };
}
