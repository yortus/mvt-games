// The module `scripts/vite-plugin-entry-facts.ts` provides: each entry's size
// and renderers, by id, measured from its source at build time. Its shape is
// `EntryFacts` in `src/entry-types/`, written out here because an ambient module
// cannot import one by a relative path.
declare module 'virtual:entry-facts' {
    export const ENTRY_FACTS: Readonly<Record<string, {
        readonly lines: number;
        readonly files: number;
        readonly renderers: readonly ('pixi' | 'three' | 'html')[];
        readonly sourcePath: string;
    }>>;
}
