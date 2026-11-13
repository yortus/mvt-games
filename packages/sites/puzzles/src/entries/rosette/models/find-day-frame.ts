import { FRAME_KINDS, type FrameKind } from './trace-frame';

/**
 * Returns the frame of `day`'s windows, at every level: the frames in turn,
 * one a day, so each comes round again every few days. Like the seeds, the
 * frames must never change once players have windows made with them: a
 * player's progress is kept with its window, and is dropped if the window
 * it was kept for is no longer the one made. A longer list of frames changes
 * every day's, so lengthening it changes past days' windows too.
 */
export function findDayFrame(day: number): FrameKind {
    const count = FRAME_KINDS.length;
    return FRAME_KINDS[((day % count) + count) % count];
}
