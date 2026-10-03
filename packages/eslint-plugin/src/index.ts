import type { ESLint, Linter } from 'eslint';
import { version } from '../package.json';
import { noEmDash, noNull, noThis, noWallClock } from './rules';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * ESLint rules for this repo, in the plain ESLint v9 plugin format, so that
 * they also load in Oxlint as a JS plugin. Registered under the `@mvtjs`
 * namespace (`'@mvtjs/no-null'`).
 *
 * Presets:
 *
 * - `architecture`: rules that enforce MVT itself. Apply it to model files:
 *   no wall-clock time.
 * - `style`: what this repo's style guide says that other rules do not
 *   check: no em-dashes, no `null`, no `this`.
 */
const plugin = {
    meta: { name: '@mvtjs/eslint-plugin', version },
    rules: {
        'no-em-dash': noEmDash,
        'no-null': noNull,
        'no-this': noThis,
        'no-wall-clock': noWallClock,
    },
    configs: {} as Record<string, Linter.Config>,
} satisfies ESLint.Plugin;

plugin.configs.architecture = {
    name: '@mvtjs/architecture',
    plugins: { '@mvtjs': plugin },
    rules: {
        '@mvtjs/no-wall-clock': 'error',
    },
};

plugin.configs.style = {
    name: '@mvtjs/style',
    plugins: { '@mvtjs': plugin },
    rules: {
        '@mvtjs/no-em-dash': 'error',
        '@mvtjs/no-null': 'error',
        '@mvtjs/no-this': 'error',
    },
};

export default plugin;
