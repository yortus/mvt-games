// The module `scripts/vite-plugin-export-packages.ts` provides: the version
// of each package an exported project depends on, by its name on npm, and
// whether it is private, as the playground runs it.
declare module 'virtual:export-packages' {
    export const EXPORT_PACKAGES: Readonly<Record<string, { readonly version: string; readonly isPrivate: boolean }>>;
}
