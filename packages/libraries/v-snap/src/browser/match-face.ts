// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What face matching needs to know of a face. */
export interface MatchableFace {
    /** The weights that the face covers: one weight twice for a static face, or a variable face's range. */
    readonly weight: readonly [number, number];
    readonly isItalic: boolean;
}

/** The face that matches, and the weight to set it to. */
export interface FaceMatch<F> {
    readonly face: F;
    /** The weight asked for, held within the face's weights. */
    readonly weight: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the face of a family that a browser would pick for a weight and
 * style, by CSS's font matching (CSS Fonts 4, section 5.2). Style comes
 * first: italic faces for italic text, if there are any, and normal faces
 * otherwise, and the other way round for normal text. Then weight: a face
 * that covers the weight is used at that weight. Otherwise the nearest is
 * used, searched in the order that CSS gives:
 *
 * - for 400 to 500, heavier faces up to 500, then lighter faces, then faces
 *   heavier than 500;
 * - for less than 400, lighter faces, then heavier;
 * - for more than 500, heavier faces, then lighter.
 *
 * The family has at least one face.
 */
export function matchFace<F extends MatchableFace>(faces: readonly F[], weight: number, isItalic: boolean): FaceMatch<F> {
    const styled = faces.filter((face) => face.isItalic === isItalic);
    const candidates = styled.length > 0 ? styled : faces;
    const covering = candidates.find((face) => face.weight[0] <= weight && weight <= face.weight[1]);
    if (covering !== undefined) return { face: covering, weight };
    // Lighter faces nearest first, by their heaviest weight, and heavier
    // faces nearest first, by their lightest.
    const lighter = candidates.filter((face) => face.weight[1] < weight).sort((a, b) => b.weight[1] - a.weight[1]);
    const heavier = candidates.filter((face) => face.weight[0] > weight).sort((a, b) => a.weight[0] - b.weight[0]);
    let order: readonly F[];
    if (weight >= 400 && weight <= 500) {
        const upTo500 = heavier.filter((face) => face.weight[0] <= 500);
        const past500 = heavier.filter((face) => face.weight[0] > 500);
        order = [...upTo500, ...lighter, ...past500];
    }
    else if (weight < 400) order = [...lighter, ...heavier];
    else order = [...heavier, ...lighter];
    const face = order[0];
    return { face, weight: Math.min(Math.max(weight, face.weight[0]), face.weight[1]) };
}
