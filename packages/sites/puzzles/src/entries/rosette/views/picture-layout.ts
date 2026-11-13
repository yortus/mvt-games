import { RIM_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How a picture is fitted into a space: its middle, in the space's pixels, and the pixels to a tile edge. */
export interface PictureLayout {
    readonly centreX: number;
    readonly centreY: number;
    readonly scale: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LayOutPictureOptions {
    /** Half the picture's frame's width and height, in tile edges. */
    readonly halfWidth: number;
    readonly halfHeight: number;
    /** The space it is fitted into, in pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Fits a picture into a space, as large as it goes with room for its rim, centred. */
export function layOutPicture(options: LayOutPictureOptions): PictureLayout {
    const { halfWidth, halfHeight, width, height } = options;
    return { centreX: width / 2, centreY: height / 2, scale: Math.min((width / 2 - RIM_WIDTH) / halfWidth, (height / 2 - RIM_WIDTH) / halfHeight) };
}
