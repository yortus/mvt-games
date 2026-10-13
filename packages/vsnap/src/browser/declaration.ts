// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns an error that ended a visual test, pointed at the test's
 * declaration, if vsnap threw it. A failed image, a blank one or a view of
 * the wrong kind is found by vsnap's own code, after the pose, so the
 * error's stack would show only vsnap's code, and the code frame that Vitest
 * shows would be vsnap's. So the error takes the stack of the declaration
 * instead, without vsnap's frames or the test runner's, and its first frame
 * is the line of the test file that declared the test, as an assertion's
 * first frame is the line of the test that made it.
 *
 * An error that the pose threw, or a library that the view uses, keeps its
 * stack, which already points at the code that went wrong.
 *
 * `ownBase` is the start of the URLs of vsnap's modules, which tells its
 * frames from the others.
 */
export function pointAtDeclaration(error: unknown, options: { readonly declaration: string | undefined; readonly ownBase: string }): unknown {
    if (!(error instanceof Error) || error.stack === undefined || options.declaration === undefined) return error;
    const isOwn = (frame: string): boolean => findFrameUrl(frame)?.startsWith(options.ownBase) === true;
    const errorFrames = listFrames(error.stack);
    if (errorFrames.length > 0 && !isOwn(errorFrames[0])) return error;
    // The frames below vsnap's, from the test file down, without the test
    // runner's own, which come from installed packages.
    const frames = listFrames(options.declaration).filter((frame) => !isOwn(frame) && findFrameUrl(frame)?.includes('/node_modules/') !== true);
    if (frames.length === 0) return error;
    error.stack = `${error.name}: ${error.message}\n${frames.join('\n')}`;
    return error;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns the lines of a stack that are frames, such as `    at pose (http://.../hud.visual.test.ts:12:5)`. */
function listFrames(stack: string): string[] {
    return stack.split('\n').filter((line) => /^\s+at /.test(line));
}

/** Returns a frame's URL, without its line and column. */
function findFrameUrl(frame: string): string | undefined {
    const match = /\((.*?):\d+:\d+\)$/.exec(frame) ?? /at (.*?):\d+:\d+$/.exec(frame);
    return match?.[1];
}
