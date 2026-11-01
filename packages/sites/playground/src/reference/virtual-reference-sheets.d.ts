// The module `scripts/vite-plugin-reference-sheets.ts` provides: the URL of
// the reference sheets, as JSON, which the page fetches as the cheat sheet
// first opens.
declare module 'virtual:reference-sheets' {
    export const REFERENCE_SHEETS_URL: string;
}
