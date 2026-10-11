/**
 * Turns a test's full name (`'SpinButtonView > spin'`) into its image name
 * (`'SpinButtonView-spin'`). The image name is also the file name of the
 * test's reference image, without `.png`. It joins the test's describe
 * blocks and its name. Each run of characters other than letters,
 * digits and dots becomes a single hyphen, and hyphens at either end are
 * trimmed.
 */
export function toImageName(test: string): string {
    return test.split(' > ').join('-').replace(/[^A-Za-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
}
