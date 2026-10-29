// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the command that accepts a test's actual image as its reference,
 * as a failure message shows it. It reruns the test's file with Vitest's
 * update flag, and picks the test by its full name with `-t`, so that it
 * accepts this image alone, not every changed image and snapshot in the
 * file. Vitest's `-t` is a regular expression, which the command anchors at
 * both ends. A name with a character that a shell treats specially in
 * double quotes gets the file's command alone, since no one form of it is
 * safe in every shell.
 */
export function toUpdateCommand(options: { readonly testFile: string | undefined; readonly testName: string | undefined }): string {
    const { testFile, testName } = options;
    if (testFile === undefined) return 'Vitest with -u';
    const filter = testName !== undefined && isShellSafe(testName) ? ` -t "^${escapeRegExp(testName)}$"` : '';
    return `\`npx vitest run ${testFile}${filter} -u\``;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Returns whether a test's name is safe in double quotes, in POSIX shells,
 * PowerShell and Windows' command prompt. Each treats some of `"`, `$`,
 * backticks, backslashes, `!` and `%` specially there, and none is safe
 * with a control character such as a line break.
 */
function isShellSafe(name: string): boolean {
    return !/["$`\\!%\p{Cc}]/u.test(name);
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
