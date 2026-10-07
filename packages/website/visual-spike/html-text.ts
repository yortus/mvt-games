// Spike: how HTML (and canvas) text is drawn, for the cross-platform HTML study.
//   native: as the page asks (with the test fonts standing in for named families)
//   blank:  every family is VT Blank: text keeps a fixed layout and draws nothing
//   block:  every family is VT Block: text keeps a fixed layout and draws as bars
//   blankreal: VT Sans Blank (the sans test font, outlines removed: real widths and kerning), VT Blank behind it
//   blanktt: as blank, but the font is TrueType (Windows lays it out with fractional advances, as macOS does)
//   green:  native fonts, every text coloured pure green, for a differ that ignores green
import blankUrl from './fonts/VTBlank.otf?url';
import blockUrl from './fonts/VTBlock.otf?url';
import sansBlankUrl from './fonts/VTSansBlank.otf?url';
import blankTtUrl from './fonts/VTBlankTT.ttf?url';

export type HtmlTextMode = 'native' | 'blank' | 'block' | 'blankreal' | 'blanktt' | 'green';

export const GREEN = '#00ff00';

export async function installHtmlText(mode: HtmlTextMode, wholeControlSize = false): Promise<string | undefined> {
    if (mode === 'native') return undefined;
    const style = document.createElement('style');
    if (mode === 'green') {
        style.textContent = `*, *::before, *::after, ::placeholder, ::marker {
            color: ${GREEN} !important; -webkit-text-fill-color: ${GREEN} !important;
            text-shadow: none !important; caret-color: transparent !important; }`;
        document.head.append(style);
        return undefined;
    }
    const faces = mode === 'block'
        ? [new FontFace('VT Block', `url(${blockUrl})`, { weight: '1 1000' })]
        : mode === 'blanktt' ? [new FontFace('VT Blank', `url(${blankTtUrl})`, { weight: '1 1000' })]
        : [new FontFace('VT Blank', `url(${blankUrl})`, { weight: '1 1000' })];
    if (mode === 'blankreal') faces.push(new FontFace('VT Sans Blank', `url(${sansBlankUrl})`, { weight: '200 900' }));
    await Promise.all(faces.map(async (face) => {
        await face.load();
        document.fonts.add(face);
    }));
    // VT Blank maps every code point, so nothing behind it reaches a system font
    const family = mode === 'block' ? '"VT Block"' : mode === 'blank' || mode === 'blanktt' ? '"VT Blank"' : '"VT Sans Blank", "VT Blank"';
    style.textContent = `*, *::before, *::after, ::placeholder, ::marker, input, button, select, textarea {
        font-family: ${family} !important; font-synthesis: none !important; }`
        // Form controls' default size is 13.33 px, at which Linux's fractional advances differ from the
        // others'. :where() has no specificity, so this replaces only the browser's default.
        + (wholeControlSize ? '\n:where(input, button, select, textarea) { font-size: 13px; }' : '');
    document.head.append(style);
    // Canvas text too: every font string's families become these
    return family;
}
