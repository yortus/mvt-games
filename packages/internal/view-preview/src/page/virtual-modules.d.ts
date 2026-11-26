// The modules that the preview's Vite plugin makes up (see view-preview-plugin.ts).

declare module 'virtual:view-preview/test-files' {
    /** The package's visual test files. Each has its path under `src/`, and its URL on the preview's server. */
    const files: readonly { readonly path: string; readonly url: string }[];
    export default files;
}

declare module 'virtual:view-preview/vsnap-config' {
    /** The package's `vsnap.config.ts`. A package without one gets a config whose list of views is empty. */
    const config: { readonly views: readonly unknown[]; readonly defaultKind?: string };
    export default config;
}
