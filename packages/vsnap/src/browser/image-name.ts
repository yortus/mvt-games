/**
 * Turns a test's full name (`'SpinButtonView > spin'`) into its image name
 * (`'SpinButtonView-spin'`). The image name is also the file name of the
 * test's reference image, without `.png`. It joins the test's describe
 * blocks and its name. Each run of characters other than letters, digits
 * and dots becomes a single hyphen, and hyphens at either end are trimmed.
 * Letters and digits of every script are kept, so `'日本'` stays `'日本'`. It
 * throws for a name with no letters or digits, which can't name a file.
 */
export function toImageName(test: string): string {
    const name = test.split(' > ').join('-').replace(/[^\p{L}\p{N}.]+/gu, '-').replace(/^-+|-+$/g, '');
    if (!/[\p{L}\p{N}]/u.test(name)) throw new Error(`The test '${test}' has no letters or digits in its name, so it can't be turned into an image name. Give it a name with some.`);
    return name;
}
