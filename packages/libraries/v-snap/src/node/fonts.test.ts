import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveFonts } from './fonts.ts';

const packageRoot = resolve(import.meta.dirname, '..', '..');
const regular = 'fixtures/fonts/fixture-mono-regular.otf';
const bold = 'fixtures/fonts/fixture-mono-bold.woff';

describe('resolveFonts', () => {
    const folder = mkdtempSync(join(tmpdir(), 'vsnap-fonts-'));
    afterAll(() => rmSync(folder, { recursive: true, force: true }));

    it("reads each face's weight and style from its file, unless the option gives them", () => {
        const { families } = resolveFonts(packageRoot, {
            Mono: [regular, bold],
            Variable: 'src/browser/fonts/SourceCodeVF-Upright.otf',
            Given: { src: bold, weight: 600, style: 'italic' },
        });
        const faces = families.map((family) => family.faces.map((face) => `${family.family} ${face.weight.join('-')} ${face.style}`));
        expect(faces).toEqual([['Mono 400-400 normal', 'Mono 700-700 normal'], ['Variable 200-900 normal'], ['Given 600-600 italic']]);
    });

    // Each mistake fails as the config loads, before the browser starts,
    // with the family named, so the message is checked for that.
    it('fails, naming the family, for a file that is missing, not a font, or a collection, and for names that clash', () => {
        const notAFont = join(folder, 'notes.txt');
        writeFileSync(notAFont, 'not a font');
        // A collection starts with 'ttcf', then its version and its fonts.
        const collection = join(folder, 'pair.ttc');
        writeFileSync(collection, Buffer.from([0x74, 0x74, 0x63, 0x66, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 16]));
        const fail = (fonts: Parameters<typeof resolveFonts>[1]): string => {
            try {
                resolveFonts(packageRoot, fonts);
                return 'no error';
            }
            catch (error) {
                return (error as Error).message;
            }
        };
        expect([
            fail({ Missing: 'fixtures/fonts/missing.woff' }),
            fail({ Text: notAFont }),
            fail({ Pair: collection }),
            fail({ MyGameFont: regular, MYGAMEFONT: bold }),
            fail({ serif: regular }),
            fail({ Heavy: { src: regular, weight: 1200 } }),
        ]).toEqual([
            expect.stringMatching(/gives Missing the file .*missing\.woff, which doesn't exist/),
            expect.stringMatching(/gives Text the file .*notes\.txt, which isn't a font file/),
            expect.stringMatching(/gives Pair the file .*pair\.ttc, which is a collection of fonts/),
            expect.stringMatching(/registers MyGameFont and MYGAMEFONT, which differ only in case/),
            expect.stringMatching(/registers serif, which is a generic family/),
            expect.stringMatching(/gives Heavy the weight 1200/),
        ]);
    });

    it('lets the page fetch each file through Vite, from a folder that it allows', () => {
        const { families, folders } = resolveFonts(packageRoot, { Mono: regular });
        const path = resolve(packageRoot, regular).replaceAll('\\', '/').replace(/^\/+/, '');
        expect(families[0].faces[0].url).toBe(`/@fs/${path}`);
        expect(folders).toEqual([resolve(packageRoot, 'fixtures/fonts')]);
    });
});
