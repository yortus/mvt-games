import { describe, expect, it } from 'vitest';
import { readEmbedRequest, toEmbedHash } from './embed-hash';

describe('an embed hash', () => {
    it('names an example, a file and the theme', () => {
        expect(readEmbedRequest('#example=bouncing-ball&file=views%2Fball-view.ts&theme=light')).toEqual({
            exampleId: 'bouncing-ball',
            path: 'views/ball-view.ts',
            scheme: 'light',
            isNameShown: false,
            isPlaygroundLinkShown: false,
        });
    });

    it('opens on main.ts, in the dark theme, without the name or the playground button, when it names only the example', () => {
        expect(readEmbedRequest('#example=clock')).toEqual({ exampleId: 'clock', path: undefined, scheme: 'dark', isNameShown: false, isPlaygroundLinkShown: false });
    });

    it('shows the name and the playground button when it asks for them', () => {
        expect(readEmbedRequest('#example=clock&title=1&playground-link=1')).toMatchObject({ isNameShown: true, isPlaygroundLinkShown: true });
    });

    it('names nothing without an example, or with one that is not a folder name', () => {
        expect(readEmbedRequest('')).toBeUndefined();
        expect(readEmbedRequest('#file=main.ts')).toBeUndefined();
        expect(readEmbedRequest('#example=../secrets')).toBeUndefined();
    });

    it('reads back what it writes', () => {
        const request = { exampleId: 'traffic-light', path: 'models/light-model.ts', scheme: 'light', isNameShown: true, isPlaygroundLinkShown: false } as const;
        expect(readEmbedRequest(toEmbedHash(request))).toEqual(request);
    });
});
