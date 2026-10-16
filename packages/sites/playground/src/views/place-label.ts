// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** A place in a file, as the console and the Problems list show it. */
export interface LabelledPlace {
    readonly path: string;
    readonly line?: number;
}

/**
 * Creates a function that labels a place as `path:line`, or `path` where
 * the line is not known. It builds the label only when it is given a
 * different place, so a refresh does not build a new string every frame.
 */
export function createPlaceLabeller(): (place: LabelledPlace | undefined) => string {
    let labelled: LabelledPlace | undefined;
    let label = '';
    return (place) => {
        if (place !== labelled) {
            labelled = place;
            label = place === undefined ? '' : place.line === undefined ? place.path : `${place.path}:${place.line}`;
        }
        return label;
    };
}
