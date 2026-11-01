import type { MarkdownEnv, MarkdownRenderer } from 'vitepress';
import { CHEAT_SHEETS, LEFT_OUT, type ReferenceSheet } from '../../playground/cheat-sheets/index.ts';
import { makeReferenceSheets } from '../../playground/scripts/make-reference-sheets.ts';
import { toCheatSheetGroupId } from './components/cheat-sheet-group-id';

/**
 * Creates what the local search renders each page with, for its index. The
 * search reads a page's Markdown without running its components, so a
 * `<CheatSheet>` would leave its section empty. Each one is written out as
 * Markdown first: the sheet's summary, a `###` for each group, at the
 * group's anchor on the page, and a line for each entry, with its name and
 * what it's for. The sheets are made once, the first time a page needs them.
 */
export function createSearchRender(): (src: string, env: MarkdownEnv, md: MarkdownRenderer) => string {
    let sheets: readonly ReferenceSheet[] | undefined;
    return (src, env, md) => {
        const expanded = !CHEAT_SHEET_TAG.test(src)
            ? src
            : src.replace(CHEAT_SHEET_TAG, (_tag, id: string) => {
                sheets ??= makeReferenceSheets({ sheets: CHEAT_SHEETS, leftOut: LEFT_OUT }).sheets;
                const sheet = sheets.find((s) => s.id === id);
                return sheet === undefined ? '' : writeSheet(sheet);
            });
        const html = md.render(expanded, env);
        return env.frontmatter?.search === false ? '' : html;
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CHEAT_SHEET_TAG = /<CheatSheet\s+id="([^"]+)"[^>]*\/>/g;

/** A sheet as Markdown, with the words a reader might search for. */
function writeSheet(sheet: ReferenceSheet): string {
    const lines = [sheet.summary, ''];
    for (const group of sheet.groups) {
        lines.push(`### ${group.title} {#${toCheatSheetGroupId(sheet.id, group.title)}}`, '');
        for (const entry of group.entries) lines.push(`\`${entry.name}\` ${entry.useFor}`, '');
    }
    return lines.join('\n');
}
