// Checks that a link to any page of the built site previews well when it is
// shared. Chat apps and social networks build a link's preview from the
// page's Open Graph tags, as the page is served, without running its
// scripts. So the tags are checked in the built pages, in `dist/`: the
// Arcade's, each entry's, the site's root, the playground's and every page
// of the docs. Three builds write them, each its own way, and nothing else
// would notice one of them going missing until a link was shared.
//
// Each page needs a title, a description, its address, a picture with its
// size and a description of it, and a large card on X (`twitter:card`). The
// picture is a file in `dist/`, the size its tags say, at least as wide as a
// large preview, and small enough for WhatsApp to show. Each entry's page
// shows a picture of its own.
//
// Addresses are full, since a preview is built away from the site: each
// begins with the site's origin (`SITE_ORIGIN`) and its base (`BASE_URL`),
// as the builds were given them. A build for trying the site out has no
// origin, and writes addresses from the site's root, which this allows, with
// a note. In CI, which deploys the site, a missing origin fails.
//
// `npm run build` runs it after building the three; `npm run
// check:link-previews` runs it alone, once they are built.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

/** The width a large preview is drawn at. A narrower picture is stretched, and blurs. */
const MIN_IMAGE_WIDTH = 1200;
/** WhatsApp leaves out a preview's picture larger than about 300 KB. */
const MAX_IMAGE_BYTES = 300_000;
/** The tags every page needs. */
const REQUIRED_TAGS = [
    'og:title',
    'og:description',
    'og:url',
    'og:image',
    'og:image:width',
    'og:image:height',
    'og:image:alt',
    'twitter:card',
];

const dist = fileURLToPath(new URL('../../../../dist/', import.meta.url));
const origin = process.env.SITE_ORIGIN ?? '';
const base = process.env.BASE_URL ?? '/';
const isCi = process.env.CI === 'true';

const problems: string[] = [];
if (origin === '' && isCi) problems.push('SITE_ORIGIN is not set, so the builds wrote addresses a preview cannot follow');
if (origin !== '' && !origin.startsWith('https://')) problems.push(`SITE_ORIGIN, ${origin}, is not an https:// address`);

const pages = listPages();
if (pages.length === 0) problems.push('found no pages: build the site first (`npm run build`)');
const checkedImages = new Set<string>();
const entryImages = new Map<string, string>();
for (const page of pages) {
    const name = relative(dist, page).replaceAll('\\', '/');
    const tags = readTags(readFileSync(page, 'utf8'));
    for (const tag of REQUIRED_TAGS) {
        if ((tags.get(tag) ?? '') === '') problems.push(`${name}: no ${tag}`);
    }
    if (tags.has('twitter:card') && tags.get('twitter:card') !== 'summary_large_image') {
        problems.push(`${name}: twitter:card is ${tags.get('twitter:card')}, not summary_large_image, so X shows a small card`);
    }
    for (const tag of ['og:url', 'og:image']) {
        const url = tags.get(tag);
        if (url !== undefined && !url.startsWith(origin + base)) problems.push(`${name}: ${tag}, ${url}, does not begin with ${origin + base}`);
    }

    const image = tags.get('og:image');
    if (image === undefined || !image.startsWith(origin + base)) continue;
    if (/^arcade\/[^/]+\/index\.html$/.test(name)) {
        const other = entryImages.get(image);
        if (other !== undefined) problems.push(`${name}: shows the same picture as ${other}`);
        entryImages.set(image, name);
    }
    if (checkedImages.has(image)) continue;
    checkedImages.add(image);
    problems.push(...checkImage(image, tags).map((problem) => `${name}: ${problem}`));
}

if (problems.length > 0) {
    for (const problem of problems) console.error(`Link previews: ${problem}`);
    process.exit(1);
}
console.log(`Link previews: ${pages.length} pages, with ${checkedImages.size} pictures, all complete`);
if (origin === '') console.log('Link previews: no SITE_ORIGIN, so the addresses begin at the site\'s root. A deploy sets it.');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every page a link can name: each `.html` file in `dist/` but the not-found pages. */
function listPages(): string[] {
    let entries;
    try {
        entries = readdirSync(dist, { withFileTypes: true, recursive: true });
    }
    catch {
        return [];
    }
    const pages: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== '404.html') pages.push(join(entry.parentPath, entry.name));
    }
    return pages.sort();
}

/** The page's `<meta>` tags, by property or name. */
function readTags(html: string): Map<string, string> {
    const tags = new Map<string, string>();
    for (const match of html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)) {
        tags.set(match[1], unescapeHtml(match[2]));
    }
    return tags;
}

/** What is wrong with the picture at `url`, which the page's `tags` describe. */
function checkImage(url: string, tags: Map<string, string>): string[] {
    const file = join(dist, url.slice((origin + base).length));
    let bytes;
    try {
        if (!statSync(file).isFile()) return [`og:image, ${url}, is not a file in dist/`];
        bytes = readFileSync(file);
    }
    catch {
        return [`og:image, ${url}, is not a file in dist/`];
    }
    const found: string[] = [];
    const size = readImageSize(bytes);
    if (size === undefined) return [`og:image, ${url}, is not a PNG or a JPEG`];
    if (String(size.width) !== tags.get('og:image:width') || String(size.height) !== tags.get('og:image:height')) {
        found.push(`${url} is ${size.width}x${size.height}, but its tags say ${tags.get('og:image:width')}x${tags.get('og:image:height')}`);
    }
    if (size.width < MIN_IMAGE_WIDTH) found.push(`${url} is ${size.width} pixels wide, under the ${MIN_IMAGE_WIDTH} a large preview is drawn at`);
    if (bytes.length > MAX_IMAGE_BYTES) found.push(`${url} is ${Math.round(bytes.length / 1000)} KB, over the ${MAX_IMAGE_BYTES / 1000} KB WhatsApp shows`);
    return found;
}

/** A PNG's or a JPEG's size, from its header, or `undefined` if it is neither. */
function readImageSize(bytes: Buffer): { width: number; height: number } | undefined {
    // A PNG starts with its signature, then the IHDR chunk, which starts with the size
    if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47) {
        return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    // A JPEG is a run of segments; the frame's (SOF0 to SOF15, but for the tables C4, C8 and CC) holds the size
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
    let at = 2;
    while (at + 9 < bytes.length) {
        if (bytes[at] !== 0xff) return undefined;
        const marker = bytes[at + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
        }
        at += 2 + bytes.readUInt16BE(at + 2);
    }
    return undefined;
}

function unescapeHtml(text: string): string {
    return text.replaceAll('&quot;', '"').replaceAll('&#39;', '\'').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}
