import { expect, it } from 'vitest';
import { type MatchableFace, matchFace } from './match-face';

/** A face named for its weights and style, such as `400` or `300-700 italic`. */
function face(name: string): MatchableFace & { readonly name: string } {
    const [weights, style] = name.split(' ');
    const [min, max = min] = weights.split('-').map(Number);
    return { name, weight: [min, max], isItalic: style === 'italic' };
}

// A mistake here picks the wrong face without a word, so each of CSS's
// branches is checked: the weight asked for, the faces, and the face and
// weight that CSS picks.
it('picks the face that CSS picks, for each weight and style', () => {
    const statics = ['300', '400', '700'];
    const cases: [faces: string[], weight: number, isItalic: boolean, picked: string][] = [
        [statics, 400, false, '400 at 400'],
        // 400 to 500: heavier faces up to 500, then lighter, then heavier.
        [statics, 450, false, '400 at 400'],
        [['300', '400', '500', '700'], 450, false, '500 at 500'],
        [['300', '700'], 480, false, '300 at 300'],
        [['600', '700'], 480, false, '600 at 600'],
        // Less than 400: lighter faces, nearest first, then heavier.
        [statics, 350, false, '300 at 300'],
        [statics, 200, false, '300 at 300'],
        // More than 500: heavier faces, nearest first, then lighter.
        [statics, 600, false, '700 at 700'],
        [statics, 900, false, '700 at 700'],
        // A variable face takes the weight asked for, held within its range.
        [['200-900'], 650, false, '200-900 at 650'],
        [['200-900'], 950, false, '200-900 at 900'],
        [['400', '500-900'], 450, false, '500-900 at 500'],
        // Style first: italic faces for italic text, and normal faces for
        // normal text, then the other.
        [['400', '700 italic'], 400, true, '700 italic at 700'],
        [['400', '700 italic'], 700, false, '400 at 400'],
        [['400'], 400, true, '400 at 400'],
        [['400 italic'], 400, false, '400 italic at 400'],
    ];
    const picks = cases.map(([faces, weight, isItalic]) => {
        const match = matchFace(faces.map(face), weight, isItalic);
        return `${match.face.name} at ${match.weight}`;
    });
    expect(picks).toEqual(cases.map((c) => c[3]));
});
