/**
 * Returns a cheat sheet group's anchor, unique on the page: the sheet's id,
 * then the group's title, such as `the-tick-a-view-tick-by-tick`. The page
 * and its search index both use it, so a search lands on the group.
 */
export function toCheatSheetGroupId(sheetId: string, groupTitle: string): string {
    return `${sheetId}-${groupTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
