import { describe, expect, it } from 'vitest';
import { FONT } from './font';
import {
    BOOT_BANNER, BOOT_COMMAND, BOOT_FOUND, BOOT_KEYS, BOOT_LOADING, BOOT_SEARCHING, BORDER_SCROLLER_TEXT, CREDITS,
    DYCP_TEXT, INTRO_CAPTIONS, LOGO_SUBTITLE, SPRITES_CAPTION_BOTTOM, SPRITES_CAPTION_TOP, VECTORS_CAPTION,
} from './texts';

const SCREEN_LINES: readonly string[] = [
    ...BOOT_BANNER, BOOT_COMMAND, BOOT_SEARCHING, BOOT_FOUND, BOOT_LOADING, BOOT_KEYS,
    ...INTRO_CAPTIONS, LOGO_SUBTITLE, SPRITES_CAPTION_TOP, SPRITES_CAPTION_BOTTOM, VECTORS_CAPTION, ...CREDITS,
];

describe('texts', () => {
    it('fit the screen\'s 40 columns', () => {
        const tooLong = SCREEN_LINES.filter((line) => line.length > 40);
        expect(tooLong).toEqual([]);
    });

    it('use only characters the font draws', () => {
        const all = [...SCREEN_LINES, BORDER_SCROLLER_TEXT, DYCP_TEXT].join('');
        const missing = new Set<string>();
        for (const ch of all) {
            const code = ch.charCodeAt(0);
            const isDrawn = code < 128 && FONT.subarray(code * 8, code * 8 + 8).some((row) => row !== 0);
            if (ch !== ' ' && !isDrawn) missing.add(ch);
        }
        expect([...missing]).toEqual([]);
    });
});
