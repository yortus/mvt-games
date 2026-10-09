/**
 * Turns a test's full name (`'SpinButtonView > spin'`) into the file name
 * of its picture (`'SpinButtonView-spin'`). The file name joins the test's
 * describe blocks and its name. Each run of characters other than letters,
 * digits and dots becomes a single hyphen, and hyphens at either end are
 * trimmed.
 */
export function toPictureName(test: string): string {
    return test.split(' > ').join('-').replace(/[^A-Za-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
}
