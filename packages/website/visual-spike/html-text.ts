// Spike: how HTML (and canvas) text is drawn, for the cross-platform HTML study.
//   native: as the page asks (with the test fonts standing in for named families)
//   blank:  every family is VT Blank: text keeps a fixed layout and draws nothing
//   block:  every family is VT Block: text keeps a fixed layout and draws as bars
//   green:  native fonts, every text coloured pure green, for a differ that ignores green
import blankUrl from './fonts/VTBlank.otf?url';
import blockUrl from './fonts/VTBlock.otf?url';

export type HtmlTextMode = 'native' | 'blank' | 'block' | 'green';

export const GREEN = '#00ff00';

export async function installHtmlText(mode: HtmlTextMode): Promise<string | undefined> {
    if (mode === 'native') return undefined;
    const style = document.createElement('style');
    if (mode === 'green') {
        style.textContent = `*, *::before, *::after, ::placeholder, ::marker {
            color: ${GREEN} !important; -webkit-text-fill-color: ${GREEN} !important;
            text-shadow: none !important; caret-color: transparent !important; }`;
        document.head.append(style);
        return undefined;
    }
    const family = mode === 'blank' ? 'VT Blank' : 'VT Block';
    const face = new FontFace(family, `url(${mode === 'blank' ? blankUrl : blockUrl})`, { weight: '1 1000', style: 'normal' });
    await face.load();
    document.fonts.add(face);
    style.textContent = `*, *::before, *::after, ::placeholder, ::marker, input, button, select, textarea {
        font-family: "${family}" !important; font-synthesis: none !important; }`;
    document.head.append(style);
    // Canvas text too: every font string's families become this one
    return family;
}
