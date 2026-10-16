// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns an error that ended a visual test, pointed at the test's
 * declaration, if v-snap threw it. A failed image, a blank one or a view of
 * the wrong kind is found by v-snap's own code, after the pose, so the
 * error's stack would show only v-snap's code, and the code frame that Vitest
 * shows would be v-snap's. So the error takes the stack of the declaration
 * instead, without v-snap's frames or the test runner's, and its first frame
 * is the line of the test file that declared the test, as an assertion's
 * first frame is the line of the test that made it.
 *
 * An error that the pose threw, or a library that the view uses, keeps its
 * stack, which already points at the code that went wrong. An error from
 * one of v-snap's browser commands, which run in Node, starts with Vitest's
 * frames, which pass it to the page, then v-snap's, so it is v-snap's.
 *
 * `ownBase` is the start of the URLs of v-snap's modules, which tells its
 * frames from the others.
 */
export function pointAtDeclaration(error: unknown, options: { readonly declaration: string | undefined; readonly ownBase: string }): unknown {
    if (!(error instanceof Error) || error.stack === undefined || options.declaration === undefined) return error;
    const isOwn = (frame: string): boolean => findFrameUrl(frame)?.startsWith(options.ownBase) === true;
    const first = listFrames(error.stack).find((frame) => !isVitestFrame(frame));
    if (first !== undefined && !isOwn(first)) return error;
    // The frames below v-snap's, from the test file down, without the test
    // runner's own, which come from installed packages.
    const frames = listFrames(options.declaration).filter((frame) => !isOwn(frame) && findFrameUrl(frame)?.includes('/node_modules/') !== true);
    if (frames.length === 0) return error;
    error.stack = `${error.name}: ${error.message}\n${frames.join('\n')}`;
    return error;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns the lines of a stack that are frames, such as `    at pose (http://.../visual-tests/hud.test.ts:12:5)`. */
function listFrames(stack: string): string[] {
    return stack.split('\n').filter((line) => /^\s+at /.test(line));
}

/**
 * Matches the URLs of Vitest's modules in the test page: its tester, its
 * `vitest/browser` module, and its installed or prebundled packages.
 */
const VITEST_URL = /\/__vitest_browser__\/|\/@id\/__x00__vitest\/|\/node_modules\/(?:\.vite\/vitest\/|vitest\/|@vitest\/)/;

/** Returns whether a frame is Vitest's own, or has no URL, such as `at async Promise.all (index 0)`. */
function isVitestFrame(frame: string): boolean {
    const url = findFrameUrl(frame);
    return url === undefined || VITEST_URL.test(url);
}

/** Returns a frame's URL, without its line and column. */
function findFrameUrl(frame: string): string | undefined {
    const match = /\((.*?):\d+:\d+\)$/.exec(frame) ?? /at (.*?):\d+:\d+$/.exec(frame);
    return match?.[1];
}
