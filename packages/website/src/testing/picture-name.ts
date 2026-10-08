/**
 * A test's full name (`'SpinButtonView > spin'`) as the file name of its
 * picture (`'SpinButtonView-spin'`): its describe blocks and name joined,
 * with anything but letters, digits and dots made a single hyphen.
 */
export function pictureName(test: string): string {
    return test.split(' > ').join('-').replace(/[^A-Za-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
}
