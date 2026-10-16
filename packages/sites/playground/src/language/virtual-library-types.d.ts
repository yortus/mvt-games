// The module `scripts/vite-plugin-library-types.ts` provides: the URL of each
// type bundle the language service loads. Its keys are the `TypeBundleKind`s
// in `libraries/`, written out here because an ambient module cannot import
// one by a relative path.
declare module 'virtual:library-types' {
    export const TYPE_BUNDLE_URLS: Readonly<Record<'typescript' | 'mvtjs' | 'playground' | 'pixi' | 'three' | 'gsap', string>>;
}
