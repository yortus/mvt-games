/**
 * A link preview's picture: what `og:image` names on each of the site's
 * pages. Sites that show link previews draw a large picture about 1200 by 630
 * pixels, and stretch a smaller one up smoothly, which blurs pixel art. So
 * each entry has a picture of its own at that size, `start/share.png` beside
 * its thumbnail, and the Arcade has one of its card wall,
 * `src/arcade/share.jpg`, which the rest of the site's pages use too.
 * `generate-thumbnails.ts` makes them, and the entry pages plugin gives them
 * to the pages.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The picture's size, in pixels: the shape of a large link preview, about 1.91:1. */
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

/** WhatsApp leaves out a preview's picture larger than about 300 KB. */
export const SHARE_IMAGE_MAX_BYTES = 300_000;

/** Around a picture of another shape: the Arcade's own background. */
export const SHARE_IMAGE_BACKGROUND = '#0d1117';

/**
 * The names a share image may have, in the order they are looked for. A PNG
 * keeps pixel art sharp, and packs it small. A picture that packs badly as a
 * PNG, such as a smooth gradient, is a JPEG instead. WebP is left out:
 * LinkedIn and WhatsApp have been unreliable with it.
 */
export const SHARE_IMAGE_NAMES = ['share.png', 'share.jpg'] as const;

/**
 * Where the build writes the Arcade's share image, from the site's base. Its
 * address never changes, since the docs and the playground name it too, in
 * their own configs.
 */
export const SITE_SHARE_IMAGE = 'arcade/share.jpg';

/** What the Arcade's share image shows, for those who can't see it (`og:image:alt`). */
export const SITE_SHARE_IMAGE_ALT = 'The MVT Arcade\'s wall of cards, one for each game and demo';

/** The share image in `dir`, or `undefined` if it has none. */
export function findShareImage(dir: string): string | undefined {
    for (const name of SHARE_IMAGE_NAMES) {
        const path = join(dir, name);
        if (existsSync(path)) return path;
    }
    return undefined;
}
